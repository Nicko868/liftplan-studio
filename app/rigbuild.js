// ================= Rigging builder: build any rigging tier by tier =================
//  crane hook → gear on the hook → N legs → (spreader beam: top padeyes · bottom padeyes → gear at each padeye → drops) → load / bags
//  Every junction is checked against standard rigging practice (shackle bow / pin, master links, padeyes, bag loops).

// ---------- bulk bags lifted as a group (e.g. 16 bags under one spreader) ----------
const bagN = ld => ld && ld.kind === "bag" ? Math.max(1, Math.round(+ld.nx || 1)) * Math.max(1, Math.round(+ld.ny || 1)) : 1;
const isBagGroup = ld => bagN(ld) > 1;
function bagCentres(ld) {
  const nx = Math.max(1, Math.round(+ld.nx || 1)), ny = Math.max(1, Math.round(+ld.ny || 1)), g = Math.max(0, +ld.gap || 0);
  const px = nz(ld.L) + g, py = nz(ld.W) + g, out = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push([(i - (nx - 1) / 2) * px, (j - (ny - 1) / 2) * py]);
  return out;
}
const oneBag = ld => ({ ...ld, nx: 1, ny: 1, rig: null });
{ const _ld = loadDims; loadDims = function (ld) {
    if (!isBagGroup(ld)) return _ld(ld);
    const nx = Math.max(1, Math.round(+ld.nx || 1)), ny = Math.max(1, Math.round(+ld.ny || 1)), g = Math.max(0, +ld.gap || 0);
    return { x: nx * nz(ld.L) + (nx - 1) * g, y: ny * nz(ld.W) + (ny - 1) * g, z: nz(ld.H) };
  }; }
{ const _lp = loadPlan; loadPlan = function (ld) {
    if (!isBagGroup(ld)) return _lp(ld);
    const s = new Scene(), one = oneBag(ld); for (const [x, y] of bagCentres(ld)) s.add(_lp(one), 0, x, y); return s;
  }; }
{ const _pr = loadProfile; loadProfile = function (ld, view) {
    if (!isBagGroup(ld)) return _pr(ld, view);
    const one = oneBag(ld), s = new Scene(), d = loadDims(ld), seen = new Set(); let h = 0;
    for (const [x, y] of bagCentres(ld)) { const u = Math.round((view === "end" ? y : x) * 1000); if (seen.has(u)) continue; seen.add(u); const p = _pr(one, view); h = p.h; s.add(p.s, 0, u / 1000, 0); }
    return { s, w: view === "end" ? d.y : d.x, h };
  }; }
if (typeof load3D === "function") { const _l3 = load3D; load3D = function (M, ld, pos, ghost) {
    if (!isBagGroup(ld)) return _l3(M, ld, pos, ghost);
    const F = frame([pos.x, pos.y, +pos.h || 0], (pos.rot || 0) + 90), X = F.y, Y = vmul(F.x, -1), one = oneBag(ld);
    for (const [x, y] of bagCentres(ld)) { const w = vadd(F.o, vadd(vmul(X, x), vmul(Y, y))); _l3(M, one, { ...pos, x: w[0], y: w[1] }, ghost); }
  }; }

// ---------- connection rules (standard rigging practice) ----------
// kinds of connection point in a chain, top → bottom
const CK = e => !e ? null : RIG_TYPES[e.snap.type]?.sling ? "sling" : e.snap.type;   // masterlink, shackle, hook, sling, spreader, other
const isSoft = e => e && (e.snap.type === "sling_round" || e.snap.type === "sling_web");
const isAssembly = e => e && e.snap.type === "masterlink" && /assembly|quad|sub-link/i.test(e.snap.name);
// one junction: what sits above (u) and below (l); u / l may be "crane", "padeye", "bags", "lug", "load"
function joinRule(u, l, lo) {
  const nu = u === "crane" ? "Crane hook" : u === "padeye" ? "Spreader padeye" : u?.snap?.name || "?", nl = l === "bags" ? "bag loops" : l === "lug" ? "lifting lug / padeye on the load" : l === "padeye" ? "spreader padeye" : l === "round" ? "round the load" : l?.snap?.name || "?";
  const ku = typeof u === "string" ? u : CK(u), kl = typeof l === "string" ? l : CK(l);
  const R = (lvl, how) => ({ lvl, text: `${nu} → ${nl}: ${how}` });
  if (ku === "crane") {
    if (kl === "masterlink") return R("ok", "master link seated in the bowl of the hook");
    if (kl === "shackle") return R("ok", "shackle pin across the hook, slings on the bow");
    if (kl === "sling") return lo?.legsOnHook > 2 ? R("warn", `${lo.legsOnHook} sling eyes straight on the hook – put them on a master link (assembly)`) : R("ok", "sling eye(s) in the hook");
    if (kl === "hook") return R("bad", "hook into hook is not allowed – use a master link or shackle");
    if (kl === "padeye") return R("ok", "spreader lifting lug on the hook");
    return R("ok", "on the hook");
  }
  if (kl === "hook" && ku === "hook") return R("bad", "hook into hook is not allowed");
  if (ku === "masterlink") {
    if (kl === "sling" && lo?.legs > 2 && !isAssembly(u)) return R("warn", `${lo.legs} legs on one master link – use a master link assembly (sub-links) for 3–4 legs`);
    if (kl === "padeye" || kl === "lug") return R("bad", "master link can't go on a padeye – use a shackle (pin through the padeye)");
    if (kl === "bags") return R("warn", "bag loops on a master link – use a rounded hook or shackle bow");
    return R("ok", kl === "masterlink" ? "sub-link in the master link" : kl === "shackle" ? "shackle through the master link" : kl === "sling" ? "sling eye on the master link" : "connected in the master link");
  }
  if (ku === "shackle") {
    if (kl === "shackle") return R("warn", "shackle to shackle – bow to bow only, never pin to pin; a master link between them is better");
    if (kl === "sling" && lo?.eyes > 2 && l?.snap?.type === "sling_chain") return R("ok", "chain sling set – the legs gather in the set's own master link, which goes on the shackle bow");
    if (kl === "sling") return lo?.eyes > 2 ? R("bad", `${lo.eyes} sling eyes on one shackle bow – max 2 (use a bigger / wide-body shackle each, or a master link)`)
      : lo?.angle > 60 ? R("warn", `2 slings on the bow at ${fx(lo.angle * 2, 0)}° included – keep within 120°`)
      : R("ok", isSoft(l) ? "soft sling on the shackle BOW (not the pin) – wide-body shackle for heavy round slings" : "sling eye on the shackle bow");
    if (kl === "padeye" || kl === "lug") return R("ok", "shackle pin through the padeye, pin fully made up");
    if (kl === "bags") return R("ok", "bag loops on the shackle bow – loops vertical, no twist");
    return R("ok", "connected");
  }
  if (ku === "padeye") {
    if (kl === "shackle") return R("ok", "shackle pin through the padeye");
    if (kl === "sling") return R("bad", "a sling can't go straight on a padeye – add a shackle (pin through the padeye, sling on the bow)");
    if (kl === "hook") return R("warn", "hook in a padeye – only if the padeye is made for a hook; a shackle is normal");
    return R("warn", "check this connects to the padeye");
  }
  if (ku === "sling") {
    if (kl === "sling") return R("bad", "sling to sling is not allowed – join with a shackle or master link");
    if (kl === "padeye" || kl === "lug") return lo?.hitch && lo.hitch !== "straight" ? R("ok", "sling round the load / through the lug in a " + lo.hitch + " hitch") : R("bad", "a sling eye can't go straight on a padeye / lug – add a shackle");
    if (kl === "round") return R("ok", "sling round the load");
    if (kl === "bags") return R("warn", "bag loops straight on a sling – put the loops on a rounded hook or shackle bow");
    if (kl === "hook") return R("ok", "sling eye in the hook's eye");
    return R("ok", "sling eye on the " + (kl === "shackle" ? "shackle bow" : kl === "masterlink" ? "master link" : "fitting"));
  }
  if (ku === "hook") {
    if (kl === "bags") return R("ok", "all 4 bag loops on the hook, safety latch closed, loops vertical");
    if (kl === "lug" || kl === "padeye") return R("warn", "hook in a lifting lug – latch closed; check the lug suits a hook");
    if (kl === "sling") return R("ok", "sling in the hook");
    return R("ok", "in the hook");
  }
  if (ku === "other") return R("ok", "connected");
  return R("ok", "connected");
}
// a whole chain, from what is above it to what is below it
function chainChecks(list, above, below, lo = {}) {
  const out = [], seq = [above, ...(list || []), below];
  for (let i = 0; i < seq.length - 1; i++) {
    const u = seq[i], l = seq[i + 1], o = { ...lo };
    // several legs / eyes only meet where the legs gather – at the first sling; further down each leg is on its own
    const fsl = (list || []).find(e => RIG_TYPES[e?.snap?.type]?.sling); if (fsl && l !== fsl && seq.indexOf(fsl) < i + 1) { delete o.eyes; delete o.legs; delete o.angle; }
    if (i === seq.length - 2 && l === below && typeof l === "string") o.hitch = [...(list || [])].reverse().find(e => RIG_TYPES[e.snap.type]?.sling)?.hitch;
    out.push(joinRule(u, l, o));
  }
  return out;
}

// ---------- defaults for a new build ----------
function defaultBuild(ld, beam) {
  const W = Math.max(1, +ld.weight || 10), d = loadDims(ld), grp = isBagGroup(ld);
  const nx = Math.max(1, Math.round(+ld.nx || 1)), ny = Math.max(1, Math.round(+ld.ny || 1));
  const useBeam = beam || grp || d.x > 6;
  // 4 lifting points (2 each end / side): ONE shackle in each bottom padeye of the beam with BOTH slings of that end on its bow
  const four = !grp && ((+ld.nLP || 0) === 4 || +ld.spanY > 0);
  const padN = grp ? nx : 2, dropN = grp ? ny : four ? 2 : 1, D = padN * dropN, per = W / Math.max(1, D) * 1.2;
  const pitch = grp ? nz(ld.L) + Math.max(0, +ld.gap || 0) : 0;
  const padSpan = Math.round((grp ? (nx - 1) * pitch : Math.max(1, +ld.span || d.x * 0.7)) * 100) / 100;
  const sb = pickItem("spreader", W, i => !i.pad && !/single hook/i.test(i.name) && i.len >= padSpan + 0.4) || pickItem("spreader", W);
  const r = { arr: "build", top: [rigEntry(pickItem("masterlink", W))], legN: useBeam ? 2 : (grp || +ld.spanY > 0 ? 4 : +ld.span > 0 ? 2 : 1), legTo: useBeam ? "beam" : "load",
    leg: [rigEntry(pickItem("sling_round", W / 2 * 1.3), { len: 4 }), rigEntry(pickItem("shackle", W / 2 * 1.3, std))], share4: 3 };
  if (useBeam) {
    r.beam = rigEntry(sb, { len: Math.max(sb.len, padSpan + 0.4) }); r.topSpan = Math.round(Math.max(1, padSpan * 0.6) * 100) / 100; r.padN = padN; r.padSpan = Math.round(padSpan * 100) / 100;
    r.pad = [rigEntry(pickItem("shackle", per * dropN, std))];
    r.drop = [rigEntry(pickItem("sling_round", per), { len: grp ? 2 : 3 }), ...(grp ? [rigEntry(pickItem("hook", per))] : [rigEntry(pickItem("shackle", per, std))])];
    r.dropN = dropN; r.dropTo = grp ? "bags" : "points";
  } else if (grp) r.leg = [rigEntry(pickItem("sling_round", W / 4 * 1.3), { len: 3 }), rigEntry(pickItem("hook", W / 4 * 1.3))];
  return r;
}
{ const _dr = defaultRig; defaultRig = function (ld, arr) { return arr === "build" ? defaultBuild(ld) : _dr(ld, arr); }; }
RIG_ARR.build = { name: "Build your own", legs: 2 };
{ const _ic = rigArrIcon; rigArrIcon = function (arr) {
    if (arr !== "build") return _ic(arr);
    return `<svg viewBox="-2 0 4 4" width="44" height="40"><g stroke="#e0701f" stroke-width=".14" fill="none"><path d="M0 .3v.6M0 .9L-1.2 1.8M0 .9L1.2 1.8"/><rect x="-1.5" y="1.8" width="3" height=".3" fill="#f2c200" stroke="#5a4a00" stroke-width=".06"/>${[-1.2, -0.4, 0.4, 1.2].map(x => `<path d="M${x} 2.1L${x - 0.25} 3M${x} 2.1L${x + 0.25} 3"/>`).join("")}</g><g fill="#ebe5cf" stroke="#8a7f5c" stroke-width=".05">${[-1.45, -0.95, -0.65, -0.15, 0.15, 0.65, 0.95, 1.45].map(x => `<rect x="${x - 0.2}" y="3" width=".4" height=".55" rx=".08"/>`).join("")}</g></svg>`;
  }; }

// ---------- lifting points: the standard ones + your own, clicked on the load ----------
function stdPts(ld) {
  const d = loadDims(ld), lz = liftPointZ(ld), s = +ld.span || 0, sy = +ld.spanY || 0, cog = +ld.cog || 0, out = [];
  if (s > 0) out.push({ k: "A", name: "A – end A", x: -s / 2, y: 0, z: lz }, { k: "B", name: "B – end B", x: s / 2, y: 0, z: lz });
  if (s > 0 && sy > 0) for (const [k, sx, syy] of [["A1", -1, -1], ["A2", -1, 1], ["B1", 1, -1], ["B2", 1, 1]]) out.push({ k, name: `${k} – corner`, x: sx * s / 2, y: syy * sy / 2, z: lz });
  out.push({ k: "C", name: "C – centre, over the CoG", x: cog, y: 0, z: lz });
  return out;
}
const bagPts = ld => isBagGroup(ld) ? bagCentres(ld).map((c, i) => ({ k: "BAG" + (i + 1), name: `Bag ${i + 1} – all 4 loops`, x: c[0], y: c[1], z: liftPointZ(ld) })) : [];
const allPts = ld => [...bagPts(ld), ...stdPts(ld), ...(ld.pts || []).map(p => ({ ...p, name: `${p.k}${p.name ? " – " + p.name : ""}${p.wrap ? " (sling round the load)" : ""}`, custom: true }))];
// load tilt (upending / rotating): turn about the CoG in the front view, then sit the lowest corner on the ground line
function tiltFn(ld, R) {
  const th = -(+R?.tilt || 0) * D2R; if (!th) { const f = p => p; f.inv = p => p; f.deg = 0; return f; }
  const d = loadDims(ld), xc = +ld.cog || 0, zc = d.z / 2, c = Math.cos(th), s = Math.sin(th);
  const rot = p => [xc + (p[0] - xc) * c - (p[2] - zc) * s, p[1], zc + (p[0] - xc) * s + (p[2] - zc) * c];
  const dz = -Math.min(...[[-d.x / 2, 0, 0], [d.x / 2, 0, 0], [-d.x / 2, 0, d.z], [d.x / 2, 0, d.z]].map(q => rot(q)[2]));
  const f = p => { const q = rot(p); return [q[0], q[1], q[2] + dz]; };
  f.inv = p => { const q = [p[0], p[1], p[2] - dz]; return [xc + (q[0] - xc) * c + (q[2] - zc) * s, q[1], zc - (q[0] - xc) * s + (q[2] - zc) * c]; };
  f.deg = +R.tilt; f.rdeg = -(+R.tilt); f.rot = rot; f.dz = dz; f.xc = xc; f.zc = zc; return f;
}
// ---- how a sling's capacity changes with the way it is used (EN 13414 mode factors, ASME B30.9 angle of choke, wire rope D/d) ----
const CHOKE_ANG = [[120, 1, "120–180°"], [90, 0.87, "90–119°"], [60, 0.74, "60–89°"], [30, 0.62, "30–59°"], [0, 0.49, "under 30°"]];
function ropeDia(e) { const m = String(e?.snap?.name || "").match(/Ø\s*(\d+(?:[.,]\d+)?)\s*mm/); return +e?.snap?.dia || (m ? +m[1].replace(",", ".") / 1000 : 0); }
// wire rope bent round a small diameter loses strength: D/d 25:1 = full rating … 5:1 ≈ 75 % … 2:1 ≈ 60 % … 1:1 ≈ 50 %
function ddFactor(r) { if (!(r > 0) || r >= 25) return 1; if (r <= 1) return 0.5; const P = [[1, 0.5], [2, 0.6], [5, 0.75], [10, 0.87], [25, 1]];
  for (let i = 0; i < P.length - 1; i++) if (r <= P[i + 1][0]) { const t = Math.log(r / P[i][0]) / Math.log(P[i + 1][0] / P[i][0]); return Math.round((P[i][1] + t * (P[i + 1][1] - P[i][1])) * 1000) / 1000; } return 1; }
function hitchFactor(e, ctx = {}) {
  const hk = e.hitch || "straight", parts = []; let f = 1;
  if (hk === "choke" || hk === "dwchoke") { f = 0.8; parts.push([(HITCH[hk] || {}).name || "Choke", 0.8]); const ca = CHOKE_ANG.find(c => (+e.chokeAng || 120) >= c[0]) || CHOKE_ANG[0]; if (ca[1] < 1) { f *= ca[1]; parts.push(["angle of choke " + ca[2], ca[1]]); } }
  else if (hk === "basket" || hk === "dwbasket") { if (ctx.side) parts.push([(HITCH[hk] || {}).name + " – each side", 1]); else { f = +e.bf || 2; parts.push([(HITCH[hk] || {}).name, f]); } }
  if (hk !== "straight" && e.snap.type === "sling_wire" && ctx.D > 0) { const d = ropeDia(e); if (d > 0) { const r = ctx.D / d, k = ddFactor(r); if (k < 1) { f *= k; parts.push([`D/d ${fx(r, 1)}:1`, k]); } } }
  return { f: Math.round(f * 1000) / 1000, parts };
}
const chainLenB = list => (list || []).reduce((a, e) => a + (RIG_TYPES[e.snap.type]?.sling && e.hitch === "basket" ? eLen(e) / 2 : eLen(e)), 0);
const chainLenFull = list => (list || []).reduce((a, e) => a + eLen(e), 0);
const chainW = list => (list || []).reduce((a, e) => a + eWeight(e) * (e.qty || 1), 0);
function padXs(L) {
  if (L.padX && String(L.padX).trim()) { const v = String(L.padX).split(/[,;\s]+/).map(Number).filter(x => isFinite(x)); if (v.length) return v; }
  const n = Math.max(1, Math.round(+L.padN || 2)), s = +L.padSpan || 0;
  return n === 1 ? [0] : Array.from({ length: n }, (_, i) => -s / 2 + s * i / (n - 1));
}
// the two beam levels share one shape: level 0 lives on R itself, level 1 (a beam hung under the first) on R.b2 / beam2 / pad2 / drop2
const lvl = (R, i) => i === 0 ? { ...R, beam: R.beam, pad: R.pad, drop: R.drop, i: 0, kp: "pad", kd: "drop" } : { ...(R.b2 || {}), beam: R.beam2, pad: R.pad2, drop: R.drop2, i: 1, kp: "pad2", kd: "drop2" };

function solveBuild(ld) {
  const R = ld.rig, W = +ld.weight || 0, cog = +ld.cog || 0, d = loadDims(ld), lz = liftPointZ(ld), TT = tiltFn(ld, R);
  const warn = [], rows = [], notes = [], seg = [], shk = [], links = [], hooks = [], pads = [], lpPts = [], checks = [], wraps = [];
  let no = 0;
  // a ramshorn (double) hook: the gear goes one on each horn – never one link in the middle (it side-loads the hook)
  const crH = plan.cranes.filter(c => c.attach?.load === ld.id && REG.cranes[c.model]), bdH = crH.length === 1 ? blockDims(crH[0], REG.cranes[crH[0].model]) : null;
  // what you put on the hook decides it: the leading parts with 2 pieces sit one on each horn; the first single part below
  // them (e.g. one shackle through both master links) joins them, and everything after hangs from it
  const ramH = !!bdH && bdH.type === "ramshorn", topL0 = R.top || [], pcs = e => (e.qty || 1) * Math.max(1, Math.round(+e.mult || 1));
  let hornN = 0; if (ramH) while (hornN < topL0.length && pcs(topL0[hornN]) === 2) hornN++;
  // nothing between the hook and the top legs (e.g. soft-eye wire slings straight on the hook): on a ramshorn the two legs go one on each horn
  const legsOnHorns = ramH && !topL0.length && Math.round(+R.legN || 2) === 2;
  const hornX = hornN || legsOnHorns ? Math.max(0.12, bdH.hookLen * 0.27) : 0, hornJoin = hornN > 0 && hornN < topL0.length;
  if (ramH && topL0.length && !hornN) warn.push("Ramshorn hook: a single master link sits in the middle and side-loads the hook – use 2 master links, one on each horn");
  const row = (e, qty, load, where, ctx = {}) => { if (!e) return; const mult = ctx.noMult ? 1 : Math.max(1, Math.round(+e.mult || 1)); if (mult > 1) { qty *= mult; load /= mult; where = `${where} · ${mult} side by side, sharing the load`; } const sl = RIG_TYPES[e.snap.type]?.sling, hk = e.hitch || "straight", hf = sl ? hitchFactor(e, ctx) : { f: 1, parts: [] }, f = hf.f;
    const r = { no: ++no, name: e.snap.name + (sl && e.len ? ` × ${(+e.len).toFixed(1)} m` : "") + (sl && hk !== "straight" ? ` (${hf.parts.map(p => `${p[0].replace(/^[A-Z](?=[a-z])/, c => c.toLowerCase())} × ${p[1]}`).join(" · ")})` : ""), hitchF: f, hitchParts: hf.parts, type: e.snap.type, qty, swl: (+e.snap.swl || 0) * f, load, len: eLen(e), unitW: eWeight(e), weight: eWeight(e) * qty, where, entry: e };
    r.util = r.swl ? load / r.swl * 100 : null; rows.push(r); return r; };
  const grp = isBagGroup(ld), bagsC = grp ? bagCentres(ld) : [], bagV = grp ? W / bagsC.length : 0;
  const slingOf = list => (list || []).find(e => RIG_TYPES[e.snap.type]?.sling);
  const mark = (list, a, b) => { const L = list || [], si = L.findIndex(e => RIG_TYPES[e.snap.type]?.sling); const at = i => (si < 0 || i < si) ? a : b;
    L.forEach((e, i) => { const p = at(i); if (e.snap.type === "shackle") shk.push(p); if (e.snap.type === "hook") hooks.push(p); if (e.snap.type === "masterlink" && p !== a) links.push(p); }); };
  const angleCheck = (a, label, lim = (rule("rig.legMax") ?? 45)) => { const hard = (rule("rig.legHard") ?? 60); if (a > hard) warn.push(`${label} ${fx(a, 0)}° from vertical – over ${hard}°: longer slings or a spreader`); else if (a > lim) warn.push(`${label} ${fx(a, 0)}° from vertical – over ${lim}°: check the reduced capacity`); };
  const shares = (tg, Wt) => { const n = tg.length, xm = tg.reduce((a, t) => a + t.p[0], 0) / n, Sxx = tg.reduce((a, t) => a + (t.p[0] - xm) ** 2, 0), xg = TT([cog, 0, d.z / 2])[0];
    return tg.map(t => Math.max(0, Wt / n + (Sxx > 1e-9 ? Wt * (xg - xm) * (t.p[0] - xm) / Sxx : 0))); };
  const round = roundSection(ld), secR = round ? d.z / 2 : 0;
  const girth = round ? 2 * Math.PI * secR : 2 * (d.y + d.z), under = round ? Math.PI * secR : d.y + 2 * d.z;
  // a target on the load (standard / custom point or a bag)
  const byKey = k => allPts(ld).find(p => p.k === k);
  const mkT = (pt, V, extra = {}) => ({ p: TT([pt.x, pt.y, pt.wrap ? d.z : (pt.z ?? lz)]), V, wrap: !!pt.wrap, x0: pt.x, y0: pt.y || 0, key: pt.k, ...extra });
  const autoLoadPts = (n, side) => {
    if (side) { const s = +ld.span || d.x * 0.8, sy = +ld.spanY || d.y * 0.8, x = side * s / 2; return n === 1 ? [{ x, y: 0, z: lz }] : Array.from({ length: n }, (_, i) => ({ x, y: -sy / 2 + sy * i / Math.max(1, n - 1), z: lz })); }
    return rigLiftPoints(ld, n === 3 ? 4 : n).slice(0, n).map(p => ({ x: p[0], y: p[1], z: lz }));
  };
  const pickPts = (keys, n, side) => { const auto = autoLoadPts(n, side); return Array.from({ length: n }, (_, i) => { const k = keys?.[i]; const p = k && k !== "auto" ? byKey(k) : null; return p || auto[i] || auto[auto.length - 1]; }); };
  // legs (or drops) from a junction point to targets: works out the junction height, angles, tensions and draws them
  function hang(list, J, tg, label) {
    // the hitch is the sling that meets the load – the LAST sling in the leg (a chain leg + hook + wire sling choked round a pipe → the wire's choke)
    const sls = (list || []).filter(e => RIG_TYPES[e.snap.type]?.sling), sl = sls[sls.length - 1], hk = sl?.hitch || "straight", Lfull = chainLenFull(list), Lraw = chainLenB(list), turns = hk === "dwchoke" || hk === "dwbasket" ? 2 : 1, isBk = hk === "basket" || hk === "dwbasket";
    const res = tg.map(t => {
      let eff = Lraw, ends = [t.p];
      const goesRound = t.wrap || hk === "choke" || hk === "dwchoke" || (isBk && !grp);
      if (goesRound && !t.wrap) { t.p = TT([t.x0, t.y0 || 0, round ? 2 * secR : d.z]); ends = [t.p]; }      // choke / basket round the load: the sling meets it on top
      if (goesRound) {
        if (hk === "choke" || hk === "dwchoke") eff = Lfull - girth * turns;
        else if (isBk) { eff = (Lfull - under - (hk === "dwbasket" ? girth : 0)) / 2; const hw = round ? secR : d.y / 2, zc = round ? secR : d.z; ends = [TT([t.x0, -hw, zc]), TT([t.x0, hw, zc])]; }
        else warn.push(`${label}: point ${t.key} goes round the load – set the sling to choke or basket`);
        if (eff <= 0.3) warn.push(`${label}: the ${fx(Lfull, 1)} m sling is too short to go round the load (${fx(isBk ? under + (turns - 1) * girth : girth * turns, 2)} m round it)`);
        wraps.push({ x: TT([t.x0, 0, d.z / 2])[0], x0: t.x0, p: t.p, hk, turns, round, r: secR, w: d.y, h: d.z, e: sl });
      }
      const legs = ends.map(e => { const dd = Math.hypot(e[0] - J[0], e[1] - J[1]); let v = Math.max(0.05, eff) ** 2 - dd * dd; if (v <= 1e-4) { warn.push(`${label}: ${fx(Math.max(0, eff), 2)} m is shorter than the ${fx(dd, 2)} m reach to ${t.key || "the lifting point"}`); v = 1e-4; } v = Math.sqrt(v); return { e, v, a: Math.atan2(dd, v) / D2R }; });
      const T = t.V / legs.length / Math.cos(Math.max(...legs.map(q => q.a)) * D2R);
      return { t, legs, T, a: Math.max(...legs.map(q => q.a)), z: Math.max(...legs.map(q => q.e[2] + q.v)) };
    });
    const zs = res.map(r => r.z), zJ = zs.length ? zs.reduce((a, z) => a + z, 0) / zs.length : J[2];
    if (zs.length > 1 && Math.max(...zs) - Math.min(...zs) > 0.1) warn.push(`${label}: legs reach different heights (${fx(Math.max(...zs) - Math.min(...zs), 2)} m) – the shorter ones take more load; check the lengths`);
    // each leg drawn part by part, top → bottom: chain, then the hook on its end, then the wire sling to the load … each at its own length
    const drawLeg = (a, b, wrapped) => {
      const L = list || [], lens = L.map(e => { const isS = RIG_TYPES[e.snap.type]?.sling; let l = isS && (e.hitch === "basket" || e.hitch === "dwbasket") ? eLen(e) / 2 : eLen(e); if (wrapped && e === sl && (hk === "choke" || hk === "dwchoke")) l = Math.max(0.1, l - girth * turns); return Math.max(isS ? 0.1 : 0.05, l); });
      const tot = lens.reduce((x, y) => x + y, 0) || 1, D = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; let acc = 0;
      L.forEach((e, i) => { const t0 = acc / tot, t1 = (acc + lens[i]) / tot; acc += lens[i];
        const P = t => [a[0] + D[0] * t, a[1] + D[1] * t, a[2] + D[2] * t], pa = P(t0), pb = P(t1), pm = P((t0 + t1) / 2);
        if (RIG_TYPES[e.snap.type]?.sling) seg.push({ a: pa, b: pb, e });
        else { if (e.snap.type === "shackle") shk.push(pm); else if (e.snap.type === "hook") hooks.push(pa); else if (e.snap.type === "masterlink") links.push(pm); else shk.push(pm); } });
      if (!sls.length) seg.push({ a, b, e: null });
    };
    const wrapped = res.some(r => r.t.wrap) || hk === "choke" || hk === "dwchoke" || (isBk && !grp);
    return { res, zJ, sl, hk, isBk, nT: res.length, ctxFor: e => ({ D: wrapped && round ? 2 * secR : 0, side: isBk && e === sl }), loadFor: (e, T) => (isBk && e !== sl ? T * 2 : T), qtyFor: (e, n) => (isBk ? res.length : n), draw: zJ2 => res.forEach(r => r.legs.forEach(q => { drawLeg([J[0], J[1], zJ2], q.e, r.t.wrap || hk === "choke" || hk === "dwchoke"); lpPts.push(q.e); })), T: res.length ? Math.max(...res.map(r => r.T)) : 0, a: res.length ? Math.max(...res.map(r => r.a)) : 0, n: res.reduce((a, r) => a + r.legs.length, 0) };
  }
  // ---- a spreader level: beam, bottom padeyes, gear at each padeye, drops (to bags, points, or a lower beam)
  function level(i, nTop, beamXFixed) {
    const L = lvl(R, i), tag = R.dropTo === "beam" && R.b2 ? (R.xbeam ? "Beam" : i === 0 ? "Upper beam" : "Lower beam") : "Beam";
    if (!L.beam) { warn.push(`${tag}: choose a spreader beam`); return null; }
    const Sb = L.beam.snap.pad ? Math.max(+L.beam.snap.len || 0, ...L.beam.snap.pad.top, ...L.beam.snap.pad.low) : (+L.beam.len || +L.beam.snap.len || 4), hb = 0.45, xc = +L.beamX || 0, PX = padXs(L).map(x => x + xc), padN = PX.length;
    const dropN = Math.max(1, Math.min(4, Math.round(+L.dropN || 1))), D = padN * dropN, to = L.dropTo || (grp ? "bags" : "points");
    let drops = [], sub = null;
    let xs = null;
    if (to === "beam" && i === 0 && R.b2 && R.beam2 && R.xbeam) {
      // cross spreaders: one under each bottom padeye (shackle + master link straight down), turned across the load,
      // two legs up to the master link and drops from its bottom padeyes to the lugs on that end
      const L1 = lvl(R, 1), YP = padXs(L1).slice().sort((a, b) => a - b), Sx = +L1.beam.len || +L1.beam.snap.len || 4, hx = 0.45;
      const sy = +L1.dropY > 0 ? +L1.dropY : (+ld.spanY > 0 ? +ld.spanY : 0), LY = YP.length === 1 ? [0] : YP.map((_, k) => -sy / 2 + sy * k / (YP.length - 1));
      const lpx = !grp && padN === 2 && +ld.span > 0 ? [-(+ld.span) / 2 + (+ld.lpX || 0), (+ld.span) / 2 + (+ld.lpX || 0)] : null;
      const raw = []; PX.forEach((px, pi) => YP.forEach((yp, k) => raw.push({ pi, px, yp, pt: { x: lpx ? lpx[px < xc ? 0 : 1] : px, y: sy > 0 ? LY[k] : yp, z: lz, k: "" } })));
      raw.forEach((q, k) => { const key = (L1.dropPts || [])[k]; if (key && key !== "auto") { const p = byKey(key); if (p) q.pt = p; } });
      const tg = raw.map(q => mkT(q.pt, 0)), V = shares(tg, W); tg.forEach((t, k) => t.V = V[k]);
      // the shackle, master link, legs, cross spreader and drops hang as one string from the padeye to the lugs: when the lugs
      // are not straight under the padeye the cross spreader sits on the line between them
      const pad2Len0 = chainLenB(L1.pad), zP = q => { const z0 = Math.max(lz + 0.3, ...raw.filter(r => r.pi === q.pi).map((r, j) => lz + chainLenB(L1.drop) + pad2Len0)); return { z0, zp: z0 + hx + chainLenB(L.drop) + chainLenB(L.pad) }; };
      raw.forEach((q, k) => { const lx = raw.map((r, j) => j).filter(j => raw[j].pi === q.pi).reduce((a, j, _, A) => a + tg[j].p[0] / A.length, 0), e = zP(q); q.px = lx + (q.px - lx) * Math.max(0, Math.min(1, (e.z0 - lz) / Math.max(0.1, e.zp - lz))); });
      const hs = raw.map((q, k) => hang(L1.drop, [q.px, q.yp, 0], [tg[k]], "Cross spreader drops")), pad2Len = chainLenB(L1.pad), wX = eWeight(L1.beam), dW = chainW(L1.drop), pW = chainW(L1.pad);
      const ts = +L1.topSpan > 0 ? +L1.topSpan : Sx;
      xs = PX.map((px0, pi) => {
        const ks = raw.map((q, k) => k).filter(k => raw[k].pi === pi), px = raw[ks[0]].px, zXB = Math.max(...ks.map(k => hs[k].zJ + pad2Len), lz + 0.3), zXT = zXB + hx;
        const Vx = ks.reduce((a, k) => a + tg[k].V + dW + pW, 0) + wX, yG = (ks.reduce((a, k) => a + (tg[k].V + dW + pW) * raw[k].yp, 0)) / (Vx || 1);
        const tA = -ts / 2, tB = ts / 2, VA = Vx * Math.max(0, Math.min(1, (tB - yG) / (tB - tA)));
        if (zXB < d.z + 0.3) warn.push(zXB < d.z ? `Cross spreader would sit ${fx(d.z - zXB, 2)} m inside the load – longer drops needed` : `Cross spreader only ${fx(zXB - d.z, 2)} m above the load – use longer drops`);
        if (Math.max(...YP.map(Math.abs), ts / 2) > Sx / 2 + 0.01) warn.push(`Cross spreader: padeyes run past the ends of the ${fx(Sx, 2)} m beam`);
        return { px, pi, ks, zXB, zXT, Vx, tops: [{ y: tA, V: VA }, { y: tB, V: Vx - VA }] };
      });
      xs.forEach(x => x.tops.forEach(t => drops.push({ pi: x.pi, t: { p: [x.px, t.y, x.zXT], V: t.V, key: "cross spreader" } })));
      xs.hs = hs; xs.raw = raw; xs.tg = tg; xs.L1 = L1; xs.Sx = Sx; xs.hx = hx; xs.pad2Len = pad2Len; xs.wX = wX;
    } else if (to === "beam" && i === 0 && R.b2 && R.beam2) {
      sub = level(1, Math.min(2, D)); if (!sub) return null;
      if (D > 2) warn.push(`Upper beam: ${D} drops but the lower beam takes 1 or 2 – set the drops so there are 1 or 2 in total`);
      sub.tops.forEach((tp, k) => drops.push({ pi: Math.min(padN - 1, Math.floor(k / dropN)), t: { p: [tp.x, 0, sub.zTop], V: tp.V, key: "lower beam" } }));
    } else if (to === "bags" && grp) {
      const used = new Set(), kb = Math.max(1, Math.round(+L.bagsPer || 1));
      PX.forEach((px, pi) => { const pick = bagsC.map((c, bi) => ({ c, bi })).filter(b => !used.has(b.bi)).sort((a, b) => Math.hypot(a.c[0] - px, a.c[1] * 0.2) - Math.hypot(b.c[0] - px, b.c[1] * 0.2)).slice(0, dropN * kb).sort((a, b) => a.c[1] - b.c[1] || a.c[0] - b.c[0]);
        for (let s = 0; s < pick.length; s += kb) { const ch = pick.slice(s, s + kb); ch.forEach(b => used.add(b.bi)); const cx = ch.reduce((a, b) => a + b.c[0], 0) / ch.length, cy = ch.reduce((a, b) => a + b.c[1], 0) / ch.length;
          drops.push({ pi, t: mkT({ x: cx, y: cy, z: lz + (ch.length > 1 ? 0.45 : 0), k: ch.map(b => "bag " + (b.bi + 1)).join(" + ") }, bagV * ch.length, { bags: ch.map(b => b.c) }) }); } });
      if (used.size < bagsC.length) warn.push(`${bagsC.length - used.size} of the ${bagsC.length} bags have no sling – ${padN} padeyes × ${dropN} slings × ${kb} bag${kb > 1 ? "s" : ""} = ${D * kb}`);
    } else {
      if (+L.dropY > 0 && +ld.spanY > 0 && dropN > 1 && Math.abs(+L.dropY - +ld.spanY) > 0.05) warn.push(`${tag}: drops spread ${fx(+L.dropY, 2)} m across, but the load's lifting points are ${fx(+ld.spanY, 2)} m across – clear the beam's own spread to follow the load`);
      const sy = +L.dropY > 0 ? +L.dropY : (+ld.spanY > 0 ? +ld.spanY : 0), ys = dropN === 1 ? [0] : Array.from({ length: dropN }, (_, k) => -sy / 2 + sy * k / (dropN - 1));
      // each drop goes to the load's own lifting point, wherever the padeye is: a beam shorter or longer than the lifting
      // points gives leaning drops (only with no real points to go to does a drop hang straight under its padeye)
      const lpx = !grp && padN === 2 && +ld.span > 0 && i === (R.b2 && R.beam2 ? 1 : 0) ? [-(+ld.span) / 2 + (+ld.lpX || 0), (+ld.span) / 2 + (+ld.lpX || 0)] : null;
      const raw = []; PX.forEach((px, pi) => ys.forEach(y => raw.push({ pi, pt: { x: lpx ? lpx[px < xc ? 0 : 1] : px, y, z: lz, k: "" } })));
      raw.forEach((q, k) => { const key = (L.dropPts || [])[k]; if (key && key !== "auto") { const p = byKey(key); if (p) q.pt = p; } });
      const tg = raw.map(q => mkT(q.pt, 0)), V = shares(tg, W); tg.forEach((t, k) => { t.V = V[k]; drops.push({ pi: raw[k].pi, t }); });
      if (D > 2) notes.push(`${tag}: ${D} drops to one rigid load – shares worked out as if the load is stiff; uneven slings or a flexible load change this`);
    }
    // each padeye's drops hang from it: the beam height comes from the drops
    const perPad = PX.map((px, pi) => hang(L.drop, [px, 0, 0], drops.filter(q => q.pi === pi).map(q => q.t), `${tag} drops`));
    // the gear in the bottom padeye (shackle) hangs between the beam and the top of the drops
    const padLen = chainLenB(L.pad), zB = Math.max(...perPad.filter(h => h.res.length).map(h => h.zJ + padLen), (sub ? sub.zTop : xs ? Math.max(...xs.map(x => x.zXT)) : lz) + 0.3);
    if (!sub && !xs && zB < d.z + 0.3) warn.push(zB < d.z ? `${tag} would sit ${fx(d.z - zB, 2)} m inside the load – longer drops needed` : `${tag} only ${fx(zB - d.z, 2)} m above the load – use longer drops`);
    const dropW = chainW(L.drop), padW = chainW(L.pad), beamW = eWeight(L.beam);
    const padLoads = perPad.map((h, pi) => ({ px: PX[pi], V: h.res.reduce((a, r) => a + r.t.V + dropW, 0), F: h.res.reduce((a, r) => a + r.T * r.legs.length, 0), n: h.n, spread: h.n > 1 ? h.a : 0 }));
    const Vb = padLoads.reduce((a, p) => a + p.V + padW, 0) + beamW, xG = (padLoads.reduce((a, p) => a + (p.V + padW) * p.px, 0) + beamW * xc) / (Vb || 1);
    let tops;
    if (nTop === 1) tops = [{ x: xG, V: Vb }];
    else { const ts = +L.topSpan > 0 ? +L.topSpan : Sb, tA = xc - ts / 2, tB = xc + ts / 2; if (xG < tA || xG > tB) warn.push(`${tag}: the weight is outside the top padeyes – it will tip`); const VA = Vb * Math.max(0, Math.min(1, (tB - xG) / (tB - tA))); tops = [{ x: tA, V: VA }, { x: tB, V: Vb - VA }]; }
    const zTop = zB + hb;
    tops.forEach(t => pads.push([t.x, 0, zTop, "top"]));
    const b = { a: [Math.min(xc - Sb / 2, ...PX, ...tops.map(t => t.x)), 0, zB], b: [Math.max(xc + Sb / 2, ...PX, ...tops.map(t => t.x)), 0, zB], h: hb };
    if (Math.min(...PX, ...tops.map(t => t.x)) < xc - Sb / 2 - 0.01 || Math.max(...PX, ...tops.map(t => t.x)) > xc + Sb / 2 + 0.01) warn.push(`${tag}: padeyes run past the ends of the ${fx(Sb, 2)} m beam`);
    beams.push(b);
    PX.forEach((px, pi) => { pads.push([px, 0, zB, "low"]); mark(L.pad, [px, 0, zB], [px, 0, zB - padLen]); const n0 = lpPts.length; perPad[pi].draw(zB - padLen); if (xs) lpPts.splice(n0); });
    if (xs) xs.forEach(x => { beams.push({ a: [x.px, -xs.Sx / 2, x.zXB], b: [x.px, xs.Sx / 2, x.zXB], h: xs.hx, cross: true });
      x.tops.forEach(t => pads.push([x.px, t.y, x.zXT, "top"]));
      x.ks.forEach(k => { const q = xs.raw[k]; pads.push([q.px, q.yp, x.zXB, "low"]); mark(xs.L1.pad, [q.px, q.yp, x.zXB], [q.px, q.yp, x.zXB - xs.pad2Len]); xs.hs[k].draw(x.zXB - xs.pad2Len); }); });
    drops.forEach(q => (q.t.bags || []).length > 1 && q.t.bags.forEach(b => seg.push({ a: q.t.p, b: TT([b[0], b[1], lz]), e: null })));
    // rows (lower level first in the list order is fine – numbered as they come)
    const Tdrop = Math.max(0, ...perPad.map(h => h.T)), aDrop = Math.max(0, ...perPad.map(h => h.a)), Fpad = Math.max(...padLoads.map(p => p.F || p.V));
    const lv = { rows: () => {
      row(L.beam, 1, Vb - beamW, `${tag.toLowerCase()} · span ${fx(Sb, 2)} m · ${padN} bottom padeye${padN > 1 ? "s" : ""} · ${nTop} top`);
      (L.pad || []).forEach(e => row(e, padN * (e.qty || 1), Fpad / (e.qty || 1), xs ? `${tag.toLowerCase()} – at each bottom padeye, hangs straight down; the cross spreader's 2 legs on it` : `${tag.toLowerCase()} – at each bottom padeye, ${dropN} drop${dropN > 1 ? "s" : ""} on it`));
      { const h0 = perPad.find(h => h.res.length) || perPad[0]; (L.drop || []).forEach(e => row(e, h0 ? perPad.reduce((a, h) => a + h.qtyFor(e, h.n), 0) : 0, h0 ? h0.loadFor(e, Tdrop) : Tdrop, `${xs ? "cross spreader legs" : tag.toLowerCase() + " drops"}, ${fx(aDrop, 0)}° from vertical${grp && to === "bags" ? ` · ${fx(bagV, 2)} t per bag` : ""}`, h0 ? h0.ctxFor(e) : {})); }
      if (sub) sub.rows();
      if (xs) { const L1 = xs.L1, hs = xs.hs, n = hs.length, T2 = Math.max(0, ...hs.map(h => h.T)), a2 = Math.max(0, ...hs.map(h => h.a)), h0 = hs[0], Vx = Math.max(...xs.map(x => x.Vx));
        row(L1.beam, xs.length, Vx - xs.wX, `cross spreader – one under each bottom padeye of the beam above, turned across the load · span ${fx(xs.Sx, 2)} m · ${n / xs.length} bottom padeyes · 2 top`);
        (L1.pad || []).forEach(e => row(e, n * (e.qty || 1), Math.max(...xs.raw.map((q, k) => xs.tg[k].V + chainW(L1.drop))) / (e.qty || 1), "cross spreader – at each bottom padeye"));
        (L1.drop || []).forEach(e => row(e, hs.reduce((a, h) => a + h.qtyFor(e, h.n), 0), h0 ? h0.loadFor(e, T2) : T2, `cross spreader drops to the lifting points, ${fx(a2, 0)}° from vertical`, h0 ? h0.ctxFor(e) : {}));
        if (a2 > (rule("rig.dropMax") ?? 30)) angleCheck(a2, "Cross spreader drops", (rule("rig.dropMax") ?? 30));
        checks.push({ head: "Cross spreader: bottom padeye → drops", tier: "pad2" }, ...chainChecks(L1.pad, "padeye", (L1.drop || [])[0] || "lug", { eyes: 1, angle: 0 }));
        checks.push({ tier: "drops2", head: "Cross spreader: drops → load" }, ...chainChecks(L1.drop, (L1.pad || []).slice(-1)[0] || "padeye", "lug", {}).slice(1)); }
      if (xs) angleCheck(aDrop, "Cross spreader legs"); else if (aDrop > (rule("rig.dropMax") ?? 30)) angleCheck(aDrop, `${tag} drops`, (rule("rig.dropMax") ?? 30));
      checks.push({ head: `${tag}: bottom padeye → drops`, tier: i ? "pad2" : "pad" }, ...chainChecks(L.pad, "padeye", (L.drop || [])[0] || (to === "beam" ? "padeye" : grp ? "bags" : "lug"), { eyes: dropN, angle: Math.max(...padLoads.map(p => p.spread)) }));
      checks.push({ tier: i ? "drops2" : "drops", head: `${tag}: drops → ${to === "beam" ? (xs ? "cross spreader" : "lower beam") : grp && to === "bags" ? "bags" : "load"}` }, ...chainChecks(L.drop, (L.pad || []).slice(-1)[0] || "padeye", to === "beam" ? "padeye" : grp && to === "bags" ? "bags" : drops.some(q => q.t.wrap) ? "round" : "lug", {}).slice(1));
    } };
    return { ...lv, tops, zTop, zB, Vb, xG, beamGeom: b, Wall: Vb };
  }
  // ---------------- top: one crane or two (tandem) ----------------
  const nCr = +R.cranes === 2 ? 2 : 1, beamOn = R.legTo === "beam" && R.beam;
  const topList = c => c ? (R.topB || []) : (R.top || []), legList = c => c ? (R.legB || []) : (R.leg || []), legNOf = c => Math.max(1, Math.min(4, Math.round(+(c ? R.legNB : R.legN) || (c ? 1 : 2))));
  let hookPts = [], shareV = null, beams = [];
  const crName = c => nCr === 2 ? (c ? "crane B" : "crane A") : "the crane";
  if (beamOn) {
    const lv0 = level(0, nCr === 2 ? 2 : Math.min(2, legNOf(0)));
    if (!lv0) return null;
    if (nCr === 2) {
      shareV = [];
      lv0.tops.forEach((tp, c) => {
        const L = legList(c);
        const zJ = lv0.zTop + chainLenB(L); seg.push({ a: [tp.x, 0, zJ], b: [tp.x, 0, lv0.zTop], e: slingOf(L) }); mark(L, [tp.x, 0, zJ], [tp.x, 0, lv0.zTop]);
        const zH = zJ + chainLenB(topList(c)); hookPts.push([tp.x, 0, zH]);
        const Vc = tp.V + chainW(L) + chainW(topList(c)); shareV.push(Vc);
        topList(c).forEach(e => row(e, e.qty || 1, Vc / (e.qty || 1), `on ${crName(c)}'s hook`));
        L.forEach(e => row(e, 1, tp.V, `${crName(c)} to its end of the beam, vertical`));
        checks.push({ head: `${crName(c)} hook → beam`, tier: c ? "legsB" : "legsA" }, ...chainChecks([...topList(c), ...L], "crane", "padeye", { legsOnHook: 1, legs: 1 }));
      });
      notes.push(`Tandem: crane A ${fx(shareV[0], 2)} t · crane B ${fx(shareV[1], 2)} t (rigging included, hook blocks not)`);
    } else {
      const xG = lv0.xG, n = lv0.tops.length, L = legList(0), legLen = chainLenB(L);
      const hx = tp => hornX && !hornJoin && n === 2 ? xG + (tp.x < xG ? -hornX : hornX) : xG;
      const legs = lv0.tops.map(tp => { const dd = Math.abs(tp.x - hx(tp)); let v = legLen * legLen - dd * dd; if (v <= 1e-4) { warn.push("Top legs are too short for the top padeye spacing"); v = 1e-4; } v = Math.sqrt(v); const a = Math.atan2(dd, v) / D2R; return { tp, v, a, T: tp.V / Math.cos(a * D2R) }; });
      const zJ = lv0.zTop + legs.reduce((a, q) => a + q.v, 0) / legs.length, zH = zJ + chainLenB(topList(0));
      hookPts = [[xG, 0, zH]];
      legs.forEach(q => { seg.push({ a: [hx(q.tp), 0, zJ], b: [q.tp.x, 0, lv0.zTop], e: slingOf(L) }); mark(L, [hx(q.tp), 0, zJ], [q.tp.x, 0, lv0.zTop]); });
      const Ttop = Math.max(...legs.map(q => q.T)), aTop = Math.max(...legs.map(q => q.a)), Wt = lv0.Vb + chainW(L) * n;
      if (n > 1 && Math.abs(legs[0].a - legs[1].a) > 1) notes.push(`CoG off the beam centre – top legs ${fx(legs[0].a, 0)}° / ${fx(legs[1].a, 0)}°, ${fx(legs[0].tp.V, 2)} t / ${fx(legs[1].tp.V, 2)} t vertical`);
      topList(0).forEach((e, i) => hornN && !hornJoin && i < hornN && n === 2 ? row(e, e.qty || 1, Ttop * 2 / (e.qty || 1), "on the hook horns – one leg each, the link lines up with its leg and takes the leg force") : row(e, e.qty || 1, Wt / (e.qty || 1), "on the crane hook"));
      L.forEach(e => row(e, n, Ttop, n > 1 ? `top legs, ${fx(aTop, 0)}° from vertical · beam compression ${fx(Ttop * Math.sin(aTop * D2R), 2)} t` : "single leg to the beam"));
      if (n > 1) angleCheck(aTop, "Top legs");
      if (legNOf(0) > 2) warn.push("A spreader beam takes 1 or 2 top legs – set Legs to 1 or 2");
      checks.push({ head: "Crane hook → top legs", tier: "hookA" }, ...chainChecks(topList(0), "crane", L[0] || "padeye", { legs: n, legsOnHook: n, eyes: n, angle: aTop }));
      checks.push({ head: "Top legs → beam top padeyes", tier: "legsA" }, ...chainChecks(L, topList(0).slice(-1)[0] || "crane", "padeye", { legs: n }).slice(1));
    }
    lv0.rows();
  } else {
    // ---- legs straight to the load (single crane, or each crane of a tandem to its own points)
    const groups = [];
    for (let c = 0; c < nCr; c++) {
      const n = legNOf(c), keys = c ? R.legPtsB : R.legPts;
      let tg;
      const kl = Math.max(1, Math.round(+R.bagsPer || 1));
      if (nCr === 1 && grp && n * kl === bagsC.length && !(keys || []).some(k => k && k !== "auto")) { const srt = bagsC.map((c, i) => ({ c, i })).sort((a, b) => a.c[0] - b.c[0] || a.c[1] - b.c[1]); tg = []; for (let s = 0; s < srt.length; s += kl) { const ch = srt.slice(s, s + kl), cx = ch.reduce((a, b) => a + b.c[0], 0) / ch.length, cy = ch.reduce((a, b) => a + b.c[1], 0) / ch.length; tg.push(mkT({ x: cx, y: cy, z: lz + (kl > 1 ? 0.45 : 0), k: ch.map(b => "bag " + (b.i + 1)).join(" + ") }, bagV * kl, { bags: ch.map(b => b.c) })); } }
      else tg = pickPts(keys, n, nCr === 2 ? (c ? 1 : -1) : 0).map(pt => mkT(pt, 0));
      groups.push(tg);
    }
    if (grp && nCr === 1 && groups[0].length * Math.max(1, Math.round(+R.bagsPer || 1)) !== bagsC.length && !groups[0].some(t => t.bags)) warn.push(`${bagsC.length} bags but ${groups[0].length} leg${groups[0].length > 1 ? "s" : ""} – one leg per bag, or a spreader with a drop to each bag`);
    const xG = TT([cog, 0, d.z / 2])[0];
    if (nCr === 2) {
      const xm = groups.map(g => g.reduce((a, t) => a + t.p[0], 0) / g.length), VA = xm[1] - xm[0] ? W * (xm[1] - xG) / (xm[1] - xm[0]) : W / 2;
      if (xG < Math.min(...xm) - 0.01 || xG > Math.max(...xm) + 0.01) warn.push("Tandem: the CoG is outside the two cranes' connection points – the load will tip / one crane takes it all");
      if (Math.abs(xm[1] - xm[0]) < 0.2) warn.push("Tandem: both cranes connect at nearly the same place along the load");
      [VA, W - VA].forEach((Vc, c) => groups[c].forEach(t => t.V = Math.max(0, Vc) / groups[c].length));
    } else if (!(grp && groups[0].length === bagsC.length)) { const V = shares(groups[0], W); groups[0].forEach((t, i) => t.V = V[i]); }
    shareV = nCr === 2 ? [] : null;
    groups.forEach((tg, c) => {
      const cx = nCr === 2 ? tg.reduce((a, t) => a + t.p[0], 0) / tg.length : xG, cy = nCr === 2 ? tg.reduce((a, t) => a + t.p[1], 0) / tg.length : 0;
      const L = legList(c), h = hang(L, [cx, cy, 0], tg, nCr === 2 ? `Crane ${c ? "B" : "A"} legs` : "Legs"); h.draw(h.zJ);
      if (hornX && !hornJoin && nCr === 1 && tg.length >= 2) for (const g of seg) if (g.a && Math.abs(g.a[0] - cx) < 1e-6 && Math.abs(g.a[2] - h.zJ) < 1e-6 && g.b) g.a = [cx + (g.b[0] < cx ? -hornX : hornX), g.a[1], g.a[2]];
      tg.forEach(t => (t.bags || []).length > 1 && t.bags.forEach(b => seg.push({ a: t.p, b: TT([b[0], b[1], lz]), e: null })));
      const zH = h.zJ + chainLenB(topList(c)); hookPts.push([cx, cy, zH]);
      const n4 = tg.length === 4 && !(grp && nCr === 1) ? tg.length / Math.max(2, +R.share4 || 3) : 1, legW = chainW(L) * h.n, Vc = tg.reduce((a, t) => a + t.V, 0) + legW;
      if (shareV) shareV.push(Vc + chainW(topList(c)));
      topList(c).forEach((e, i) => hornN && !hornJoin && nCr === 1 && i < hornN && h.n === 2 ? row(e, e.qty || 1, h.T * n4 * 2 / (e.qty || 1), "on the hook horns – one leg each, the link lines up with its leg and takes the leg force") : row(e, e.qty || 1, Vc / (e.qty || 1), `on ${crName(c)}'s hook`));
      L.forEach(e => row(e, h.qtyFor(e, h.n), h.loadFor(e, h.T) * n4, (h.n > 1 ? `${nCr === 2 ? crName(c) + " – " : ""}each leg, ${fx(h.a, 0)}° from vertical${n4 > 1 ? ` (load shared by ${R.share4 || 3} of 4 legs)` : ""}` : `${nCr === 2 ? crName(c) + " – " : ""}single leg`) + (tg.some(t => t.wrap) ? ` · ${slingOf(L)?.hitch || "straight"} round the load (${fx((slingOf(L)?.hitch === "basket" ? under : girth), 2)} m round it)` : ""), h.ctxFor(e)));
      if (h.n > 1) angleCheck(h.a, nCr === 2 ? `Crane ${c ? "B" : "A"} legs` : "Legs");
      checks.push({ head: `${nCr === 2 ? crName(c) + " – " : ""}hook → load`, tier: c ? "legsB" : "legsA" }, ...chainChecks([...topList(c), ...L], "crane", grp ? "bags" : tg.some(t => t.wrap) ? "round" : "lug", { legs: tg.length, legsOnHook: tg.length, eyes: tg.length, angle: h.a }));
    });
    if (nCr === 2) notes.push(`Tandem: crane A ${fx(shareV[0], 2)} t · crane B ${fx(shareV[1], 2)} t (rigging included, hook blocks not)` + (TT.deg ? ` · load tilted ${fx(TT.deg, 0)}°` : ""));
  }
  if (TT.deg) notes.push(`Load shown tilted ${fx(TT.deg, 0)}° about its CoG (upending / rotating) – check each crane's share at every stage of the turn`);
  if (grp) checks.push({ head: "Bulk bags", tier: "load" }, { lvl: "ok", text: `FIBC: all 4 loops of each bag on its hook / bow, loops vertical, no twists – ${fx(bagV, 2)} t per bag (check the bag's SWL label)` });
  for (const r of rows) if (r.util != null && r.util > 100) warn.push(`${r.name}: ${fx(r.load, 2)} t is over its ${fx(r.swl, 2)} t SWL`);
  for (const c of checks) if (c.lvl === "bad") warn.push("Connection: " + c.text);
  const weight = rows.reduce((a, r) => a + (r.weight || 0), 0), hookZ = Math.max(...hookPts.map(h => h[2]));
  R._geom = { beam: beams[0] || null };
  const ptsDraw = (ld.pts || []).map(p => ({ k: p.k, p: TT([p.x, p.y, p.wrap ? d.z : p.z]), wrap: p.wrap }));
  if (hornN) rows.forEach(r => { const i = topL0.indexOf(r.entry); if (i >= 0 && i < hornN) r.where = "one on each horn of the ramshorn hook"; else if (i === hornN && hornJoin) r.where = `through both ${topL0[hornN - 1].snap.name.toLowerCase().includes("link") ? "master links" : "parts above"} – joins the two horns`; });
  return { hornX, hornN, hornJoin, nTop: 0, lpPts, wrap: false, fix: null, rows, notes, warn, weight, hookZ, hookPts, seg, shk, links, hooks, pads, beam: beams[0] || null, beams, topLen: chainLenB(R.top), checks, wraps, ptsDraw, shares: shareV, tilt: TT.deg, build: true };
}
{ const _sr = solveRig; solveRig = function (ld) { const R = ld?.rig; if (R && R.arr === "build") { try { return solveBuild(ld); } catch (e) { console.warn(e); return null; } } return _sr(ld); }; }
// tandem built here: each crane's share and hook position come from the rigging
{ const _ls = loadShares; loadShares = function (load, att) {
    const R = load?.rig; if (R && R.arr === "build" && +R.cranes === 2 && att.length === 2) { const r = solveRig(load); if (r && r.shares) return att.map(a => a.point === "B" ? r.shares[1] : r.shares[0]); }
    return _ls(load, att);
  }; }
{ const _lw = liftPointWorld; liftPointWorld = function (load, point, phase) {
    const R = load?.rig; if (R && R.arr === "build" && +R.cranes === 2 && (point === "A" || point === "B")) { const r = solveRig(load); if (r && r.hookPts.length === 2) { const pos = load[phase] || load.pick, h = r.hookPts[point === "B" ? 1 : 0], v = rot2([h[0], h[1]], -(pos.rot || 0)); return [pos.x + v[0], pos.y + v[1]]; } }
    return _lw(load, point, phase);
  }; }
// ---------- drawing: padeyes, hooks, second beam, slings round the load, your own lifting points, tilt ----------
{ const _r2 = rig2D; rig2D = function (s, ld, res, view, ox, oy, opts = {}) {
    const out = _r2(s, ld, res, view, ox, oy, opts);
    if (res && res.build) {
      const U = p => ox + (view === "end" ? p[1] : p[0]), Z = p => oy + p[2];
      for (const b of (res.beams || []).slice(1)) s.rect("RIGGING", Math.min(U(b.a), U(b.b)) - 0.1, Z(b.a), Math.max(U(b.a), U(b.b)) + 0.1, Z(b.a) + b.h, { fill: "#f2c200", w: 1, color: "#5a4a00" });
      for (const p of res.pads || []) { const x = U(p), z = Z(p), dir = p[3] === "top" ? 1 : -1; s.poly("RIGGING", [[x - 0.09, z], [x, z + dir * 0.16], [x + 0.09, z]], { closed: true, fill: "#d4a800", w: 0.8, color: "#5a4a00" }); }
      for (const p of res.hooks || []) { const x = U(p), z = Z(p) + 0.05; s.poly("RIGGING", [[x, z + 0.28], [x, z + 0.1], [x - 0.02, z + 0.02], [x + 0.06, z - 0.04], [x + 0.12, z + 0.02], [x + 0.12, z + 0.09]], { w: 1.5, color: "#3a3e42" }); }
      for (const w of res.wraps || []) {
        // the sling round the load in its own colour: one turn for a choke / basket, two for a double wrap choke, with the choke nip on top
        const col = slingColour(w.e ? w.e.snap : null), n = w.turns || 1, tw = w.e && w.e.snap.type === "sling_wire" ? 1.6 : 2.2;
        if (view === "end") {
          const bk = w.hk === "basket" || w.hk === "dwbasket";
          // choke: full turn(s) with the nip on top · basket: the sling cradles the underside and both sides go up · double wrap basket: one full turn + the cradle
          for (let k = 0; k < n; k++) { const half = bk && k === n - 1, g = 0.04 + k * 0.06;
            if (w.round) { const rr = w.r + g, P = [], a0 = half ? Math.PI : 0, a1 = half ? 2 * Math.PI : 2 * Math.PI; for (let i = 0; i <= 36; i++) { const a = a0 + (a1 - a0) * i / 36; P.push([ox + rr * Math.cos(a), oy + w.r + rr * Math.sin(a)]); } s.poly("RIGGING", P, { w: tw, color: col }); }
            else if (half) s.poly("RIGGING", [[ox - w.w / 2 - g, oy + w.h], [ox - w.w / 2 - g, oy - g], [ox + w.w / 2 + g, oy - g], [ox + w.w / 2 + g, oy + w.h]], { w: tw, color: col });
            else s.rect("RIGGING", ox - w.w / 2 - g, oy - g, ox + w.w / 2 + g, oy + w.h + g, { w: tw, color: col }); }
          if (!bk) s.circle("RIGGING", [ox, oy + (w.round ? 2 * w.r : w.h) + 0.06], 0.07, { fill: col, color: col, w: 0.6 });
        } else {
          const z0 = oy + (res.tilt ? w.p[2] - w.h : 0), z1 = oy + (res.tilt ? w.p[2] : w.h), xs = n === 2 ? [-0.09, 0.09] : [0];
          for (const dx of xs) { const x = ox + w.x + dx; s.rect("RIGGING", x - 0.045, z0 - 0.03, x + 0.045, z1 + 0.03, { fill: col, w: 0.4, color: col }); }
          if (n === 2) s.poly("RIGGING", [[ox + w.x - 0.09, z1 + 0.03], [ox + w.x + 0.09, z0 - 0.03]], { w: 1.2, color: col });
        }
      }
      for (const q of res.ptsDraw || []) { const x = U(q.p), z = Z(q.p), r = 0.11; s.circle("DIMS", [x, z], r, { fill: q.wrap ? "#fff3e6" : "#e8f1ff", w: 1, color: q.wrap ? "#e0701f" : "#1f5fa8" }); s.text("DIMS", [x + 0.28, z + 0.12], q.k, 0.26, { bold: true, color: q.wrap ? "#b85a14" : "#1f5fa8" }); }
    }
    return out;
  }; }
{ const _r3 = rig3D; rig3D = function (M, ld, pos, res, hooks) {
    // 3D shows the load level: re-solve without the tilt so the rigging meets it
    if (res && res.build && res.tilt) { const R = ld.rig, t = R.tilt; R.tilt = 0; try { res = solveRig(ld) || res; } finally { R.tilt = t; } }
    _r3(M, ld, pos, res, hooks);
    if (!res || !res.build) return;
    const F = frame([pos.x, pos.y, +pos.h || 0], (pos.rot || 0) + 90), X = F.y, Y = vmul(F.x, -1), Wd = p => vadd(F.o, vadd(vmul(X, p[0]), vadd(vmul(Y, p[1]), [0, 0, p[2]])));
    for (const p of res.hooks || []) M.box({ o: Wd(p), x: X, y: Y, z: [0, 0, 1] }, -0.05, 0.05, -0.02, 0.02, 0, 0.25, "#3a3e42");
    // slings round the load (choke / double wrap / basket) as rings round it
    for (const w of res.wraps || []) { const col = slingColour(w.e ? w.e.snap : null), n = w.turns || 1, rr = w.round ? w.r : Math.max(w.w, w.h) / 2;
      const bk = w.hk === "basket" || w.hk === "dwbasket";
      for (let k = 0; k < n; k++) { const x = w.x0 + (n === 2 ? (k ? 0.09 : -0.09) : 0), r = rr + 0.05, zc = w.round ? w.r : w.h / 2, N = 20, half = bk && k === n - 1, A0 = half ? Math.PI : 0, AS = half ? Math.PI : 2 * Math.PI;
        for (let i = 0; i < N; i++) { const a0 = A0 + AS * i / N, a1 = A0 + AS * (i + 1) / N; M.cyl(Wd([x, r * Math.cos(a0), zc + r * Math.sin(a0)]), Wd([x, r * Math.cos(a1), zc + r * Math.sin(a1)]), 0.045, col, { n: 6, open: true }); } } }
    for (const b of (res.beams || []).slice(1)) M.cyl(vadd(Wd(b.a), [0, 0, b.h / 2]), vadd(Wd(b.b), [0, 0, b.h / 2]), b.h / 2, "#f2c200", { n: 10 });
  }; }
// the load drawn tilted in the front view when the rigging turns it (upending)
{ const _pr2 = loadProfile; loadProfile = function (ld, view) {
    const out = _pr2(ld, view), R = ld?.rig;
    if (!R || R.arr !== "build" || !(+R.tilt) || view !== "side" || ld._noTilt) return out;
    const TT = tiltFn(ld, R), s = new Scene(), c = [TT.xc, TT.zc], th = TT.rdeg * D2R, cr = [c[0] * Math.cos(th) - c[1] * Math.sin(th), c[0] * Math.sin(th) + c[1] * Math.cos(th)];
    s.add(out.s, TT.rdeg, c[0] - cr[0], c[1] - cr[1] + TT.dz);
    return { ...out, s };
  }; }
{ const _rp = rigParts; rigParts = function (ld, res) {
    const R = ld.rig; if (!R || R.arr !== "build" || !res) return _rp(ld, res);
    const out = [], rowOf = e => (res.rows.find(r => r.entry === e) || {}).no, hp = res.hookPts[0];
    let z = hp[2]; (R.top || []).forEach((e, i) => { const L = Math.max(0.15, eLen(e)); out.push({ key: "top", i, entry: e, row: rowOf(e), p: [hp[0] + (res.hornX && i < res.hornN ? res.hornX : 0), hp[1], z - L / 2] }); z -= L; });
    // parts sit where they really are on a leg: the sling along its middle, fittings above it stacked down from the top end, fittings below it stacked up from the bottom end
    const along = (list, g, key) => { if (!list || !g) return; const n = list.length, L = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1], g.b[2] - g.a[2]) || 1, u = [0, 1, 2].map(k => (g.b[k] - g.a[k]) / L), si = list.findIndex(e => RIG_TYPES[e.snap?.type]?.sling), ln = e => Math.max(0.15, eLen(e));
      list.forEach((e, i) => { let t;
        if (si < 0) t = L * (i + 0.5) / n; else if (i === si) t = L / 2;
        else if (i < si) { let o = 0; for (let j = 0; j < i; j++) o += ln(list[j]); t = o + ln(e) / 2; }
        else { let o = 0; for (let j = n - 1; j > i; j--) o += ln(list[j]); t = L - o - ln(e) / 2; }
        t = Math.max(0, Math.min(L, t)); out.push({ key, i, entry: e, row: rowOf(e), p: [g.a[0] + u[0] * t, g.a[1] + u[1] * t, g.a[2] + u[2] * t] }); }); };
    const zb = res.beam ? res.beam.a[2] : null;
    const legSegs = zb == null ? res.seg : res.seg.filter(q => q.a[2] > zb + 0.2), dropSegs = zb == null ? [] : res.seg.filter(q => Math.abs(q.a[2] - zb) < 0.01);
    along(R.leg, legSegs.reduce((m, q) => (!m || q.b[0] > m.b[0] ? q : m), null), "leg");
    if (res.beam && R.beam) out.push({ key: "beam", i: 0, entry: R.beam, row: rowOf(R.beam), p: [(res.beam.a[0] + res.beam.b[0]) / 2, 0, res.beam.a[2] + res.beam.h / 2] });
    const lastPad = (res.pads || []).filter(p => p[3] === "low" && zb != null && Math.abs(p[2] - zb) < 0.01).slice(-1)[0];
    if (lastPad) (R.pad || []).forEach((e, i) => out.push({ key: "pad", i, entry: e, row: rowOf(e), p: [lastPad[0], 0, lastPad[2] - 0.15 - i * 0.2] }));
    along(R.drop, dropSegs.reduce((m, q) => (!m || q.b[0] > m.b[0] ? q : m), null), "drop");
    return out;
  }; }
// ---------- the builder panel: the rigging as a stack of steps, hook → load; one step open at a time ----------
const W1 = ld => (+ld.weight || 0) / bagN(ld);
const TIER_ICON = {
  load: `<rect x="3" y="11" width="18" height="9" rx="1.5"/><path d="M8 11V8M16 11V8"/>`,
  hook: `<path d="M12 2v7"/><path d="M12 9a4 4 0 1 1-4 4"/>`,
  legs: `<path d="M12 3L5 21M12 3l7 18"/>`,
  beam: `<rect x="2" y="9" width="20" height="5" rx="1"/><path d="M7 9V6M17 9V6"/>`,
  pad: `<path d="M12 4v5"/><path d="M8 13a4 4 0 0 0 8 0v-4H8z"/>`,
  drops: `<path d="M6 3v14M12 3v14M18 3v14"/><circle cx="6" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>`
};
const tierIcon = k => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${TIER_ICON[k] || TIER_ICON.hook}</svg>`;
const listSum = list => (list || []).length ? (list || []).map(e => `${(e.qty || 1) > 1 ? (e.qty + " × ") : ""}${e.snap.name.replace(/\s*\(.*?\)\s*/g, " ").trim()}${RIG_TYPES[e.snap.type]?.sling ? ` × ${fx(+e.len || 0, 1)} m${e.hitch && e.hitch !== "straight" ? " " + e.hitch : ""}` : ""}`).join(" · ") : "nothing yet";
// a small plan of the bags so "along" and "across" are obvious
function bagGridSVG(ld) {
  const nx = Math.max(1, Math.round(+ld.nx || 1)), ny = Math.max(1, Math.round(+ld.ny || 1)), c = Math.min(22, 200 / nx, 70 / ny), g = c * 0.18, W = nx * (c + g), H = ny * (c + g);
  let r = ""; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) r += `<rect x="${30 + i * (c + g)}" y="${14 + j * (c + g)}" width="${c}" height="${c}" rx="${c * 0.25}" fill="#ebe5cf" stroke="#8a7f5c"/>`;
  return `<svg class="bgrid" viewBox="0 0 ${W + 110} ${H + 34}" width="${Math.min(400, W + 110)}"><text x="4" y="${14 + H / 2 + 4}" font-size="11" font-weight="700" fill="currentColor">A</text><text x="${W + 44}" y="${14 + H / 2 + 4}" font-size="11" font-weight="700" fill="currentColor">B</text>
    ${r}<path d="M30 ${H + 22}H${30 + W - g}" stroke="currentColor" marker-end="url(#ar)"/><text x="${30 + (W - g) / 2}" y="${H + 32}" font-size="10" text-anchor="middle" fill="currentColor">${nx} along (A → B)</text>
    <path d="M${W + 36} 14V${14 + H - g}" stroke="currentColor"/><text x="${W + 40}" y="10" font-size="10" fill="currentColor">${ny} across</text>
    <defs><marker id="ar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="currentColor"/></marker></defs></svg>`;
}
function buildPanelHTML(ld, R, res) {
  const isBag = ld.kind === "bag", grp = isBagGroup(ld), n = bagN(ld), beamOn = R.legTo === "beam" && R.beam, nCr = +R.cranes === 2 ? 2 : 1, low2 = beamOn && R.dropTo === "beam" && R.beam2;
  const seg = (id, val, opts) => `<span class="seg bseg">${opts.map(([v, t]) => `<button data-bsel="${id}" data-v="${v}" aria-pressed="${String(val) === String(v)}">${t}</button>`).join("")}</span>`;
  const P = allPts(ld), ptSel = (list, i, cur) => `<select data-ptsel="${list}" data-i="${i}"><option value="auto">Auto</option>${P.map(p => `<option value="${escH(p.k)}" ${cur === p.k ? "selected" : ""}>${escH(p.name)}</option>`).join("")}</select>`;
  const rowsOf = (key, list) => `<div class="blist">${(list || []).map((_, i) => entryRow(list, i, key)).join("")}<button class="badd" data-add="${key}">+ Add a fitting or sling</button></div>`;
  // status of each step from the connection checks and the SWL checks of its parts
  const st = {}, worst = (a, b) => ({ bad: 3, warn: 2, ok: 1 }[b] > ({ bad: 3, warn: 2, ok: 1 }[a] || 0) ? b : a);
  let cur = null; for (const c of res?.checks || []) { if (c.head) { cur = c.tier; continue; } if (cur) st[cur] = worst(st[cur], c.lvl); }
  const tierLists = { hookA: R.top, legsA: R.leg, hookB: R.topB, legsB: R.legB, beam: [R.beam], pad: R.pad, drops: R.drop, beam2: [R.beam2], pad2: R.pad2, drops2: R.drop2 };
  for (const [k, list] of Object.entries(tierLists)) for (const r of res?.rows || []) if ((list || []).includes(r.entry) && r.util != null) st[k] = worst(st[k], r.util > 100 ? "bad" : r.util > 90 ? "warn" : "ok");
  const rowFor = e => res?.rows.find(r => r.entry === e);
  const useTxt = list => { const us = (list || []).map(rowFor).filter(r => r && r.util != null); if (!us.length) return ""; const m = us.reduce((a, b) => b.util > a.util ? b : a); return `max ${fx(m.util, 0)}% SWL`; };
  const L0 = lvl(R, 0), L1 = lvl(R, 1), D0 = padXs(L0).length * (+L0.dropN || 1);
  const tiers = [
    { k: "load", icon: "load", title: isBag ? "Load – bulk bags" : "Load & lifting points", sum: isBag ? `${n} bags (${+ld.nx || 1} along × ${+ld.ny || 1} across) · ${fx(W1(ld), 2)} t each · ${fx(+ld.weight || 0, 2)} t` : `${escH(ld.name || "Load")} · ${fx(+ld.weight || 0, 2)} t · ${(ld.pts || []).length ? (ld.pts.length + " own point" + (ld.pts.length > 1 ? "s" : "")) : "standard points"}${+R.tilt ? ` · tilted ${fx(+R.tilt, 0)}°` : ""}` },
    { k: "hookA", icon: "hook", title: nCr === 2 ? "Crane A – on the hook" : "On the crane hook", sum: listSum(R.top), use: useTxt(R.top) },
    { k: "legsA", icon: "legs", title: nCr === 2 ? "Crane A – legs" : "Legs", sum: beamOn ? `${nCr === 2 ? 1 : Math.min(2, +R.legN || 2)} × ${listSum(R.leg)} → beam` : `${+R.legN || 2} × ${listSum(R.leg)} → ${grp ? "bags" : "load"}`, use: useTxt(R.leg) },
    ...(nCr === 2 ? [{ k: "hookB", icon: "hook", title: "Crane B – on the hook", sum: listSum(R.topB), use: useTxt(R.topB) }, { k: "legsB", icon: "legs", title: "Crane B – legs", sum: `${beamOn ? 1 : (+R.legNB || 1)} × ${listSum(R.legB)} → ${beamOn ? "beam" : "load"}`, use: useTxt(R.legB) }] : []),
    ...(beamOn ? [{ k: "beam", icon: "beam", title: low2 ? "Upper spreader beam" : "Spreader beam", sum: `${escH(R.beam.snap.name)} · ${fx(+R.beam.len || 0, 2)} m · ${padXs(L0).length} bottom padeye${padXs(L0).length > 1 ? "s" : ""}`, use: useTxt([R.beam]) },
      { k: "pad", icon: "pad", title: "At each bottom padeye", sum: listSum(R.pad), use: useTxt(R.pad) },
      { k: "drops", icon: "drops", title: low2 ? "Drops to the lower beam" : "Drops", sum: `${D0} × ${listSum(R.drop)} → ${low2 ? "lower beam" : grp && (R.dropTo || "bags") === "bags" ? "one bag each" : "load"}`, use: useTxt(R.drop) }] : []),
    ...(low2 ? [{ k: "beam2", icon: "beam", title: "Lower spreader beam", sum: `${escH(R.beam2.snap.name)} · ${fx(+R.beam2.len || 0, 2)} m · ${padXs(L1).length} bottom padeyes`, use: useTxt([R.beam2]) },
      { k: "pad2", icon: "pad", title: "At each lower padeye", sum: listSum(R.pad2), use: useTxt(R.pad2) },
      { k: "drops2", icon: "drops", title: "Drops to the load", sum: `${padXs(L1).length * (+L1.dropN || 1)} × ${listSum(R.drop2)}`, use: useTxt(R.drop2) }] : [])
  ];
  if (!tiers.some(t => t.k === RB.tier)) RB.tier = null;
  const legPtRows = c => { const k = c ? "legPtsB" : "legPts", nn = Math.max(1, Math.round(+(c ? R.legNB : R.legN) || (c ? 1 : 2))); if (grp && nCr === 1 && nn === n) return `<p class="bnote">One leg to each bag.</p>`; return `<div class="bsub">Where each leg connects</div><div class="ptgrid">${Array.from({ length: nn }, (_, i) => `<label>Leg ${i + 1}${ptSel(k, i, (R[k] || [])[i])}</label>`).join("")}</div>`; };
  const levelBody = (i, part) => {
    const L = lvl(R, i), f = (k, lab, attrs = "") => `<label>${lab}<input ${attrs} data-lk2="${i}:${k}" value="${escH(L[k] ?? "")}"></label>`, D = padXs(L).length * (+L.dropN || 1);
    const dropTo = L.dropTo || (grp ? "bags" : "points"), nTop = i === 0 ? (nCr === 2 ? 2 : Math.min(2, +R.legN || 2)) : Math.min(2, D0);
    if (part === "beam") return `${i === 0 ? `<div class="rrow" data-list="beam" data-i="0"><select data-f="item">${itemOptions(R.beam?.id, it => it.type === "spreader")}</select><label>Length (m)<input type="number" data-f="len" step="0.1" value="${R.beam?.len ?? 4}"></label><span></span><span></span></div>`
        : `<div class="bgrid2"><label>Beam<select data-b2item>${itemOptions(R.beam2?.id, it => it.type === "spreader")}</select></label><label>Length (m)<input type="number" data-b2len step="0.1" value="${R.beam2?.len ?? 4}"></label></div>`}
      <div class="bsub">Padeyes (measured from the beam centre)</div>
      <div class="bgrid3">${nTop > 1 ? f("topSpan", "Top padeyes apart (m)", 'type="number" step="0.05" placeholder="beam length"') : `<p class="bnote">1 top padeye, over the centre of gravity.</p>`}${f("padN", "Bottom padeyes (number)", 'type="number" min="1" max="24" step="1"')}${f("padSpan", "First to last bottom padeye (m)", 'type="number" step="0.05"')}</div>
      <details class="bmore"><summary>Exact padeye positions from the drawing</summary>${f("padX", "Positions in m from the centre, comma-separated", 'type="text" placeholder="-3.15, -2.25, -1.35, -0.45, 0.45, 1.35, 2.25, 3.15"')}</details>
      ${i === 0 ? `<div class="bsub">Under this beam</div>${seg("0:dropTo", dropTo, [...(isBag ? [["bags", "Drops to the bags"]] : []), ["points", "Drops to lifting points"], ["beam", "A second beam"]])}` : ""}`;
    if (part === "pad") return `<p class="bnote">What goes on each bottom padeye – normally one shackle, pin through the padeye. Its drops hang off it.</p>${rowsOf(L.kp, L.pad)}`;
    return `<div class="bgrid2"><label>Drops per padeye${seg(`${i}:dropN`, L.dropN || 1, [[1, "1"], [2, "2"], [3, "3"], [4, "4"]])}</label>${dropTo === "points" && !grp ? f("dropY", "Drops spread across (m)", `type="number" step="0.05" placeholder="${fx(+ld.spanY || 0, 2)}"`) : "<span></span>"}</div>
      <p class="bnote">${padXs(L).length} padeyes × ${L.dropN || 1} = <b>${D} drop${D > 1 ? "s" : ""}</b>${grp && dropTo === "bags" ? ` for ${n} bags${D !== n ? ` – <span class="bwarn">should be ${n}</span>` : " ✓"}` : ""}. Each drop, top → bottom:</p>
      ${rowsOf(L.kd, L.drop)}
      ${dropTo === "points" && D <= 12 && (ld.pts || []).length ? `<details class="bmore"><summary>Choose the point for each drop</summary><div class="ptgrid">${Array.from({ length: D }, (_, k) => `<label>Drop ${k + 1}${ptSel(`${i}:dropPts`, k, (L.dropPts || [])[k])}</label>`).join("")}</div></details>` : ""}`;
  };
  const body = k => {
    if (k === "load") return `${isBag ? `<div class="bsub">Bags lifted together – set how many</div>${bagGridSVG(ld)}
        <div class="bgrid3"><label>Bags in a row, along A → B<input type="number" data-bk="nx" min="1" step="1" value="${+ld.nx || 1}"></label><label>Rows, across<input type="number" data-bk="ny" min="1" step="1" value="${+ld.ny || 1}"></label><label>Gap between bags (m)<input type="number" data-bk="gap" min="0" step="0.05" value="${+ld.gap || 0.1}"></label></div>
        <div class="bgrid3"><label>Weight of one bag (t)<input type="number" data-bk="bagW" step="0.01" value="${fx(W1(ld), 3)}"></label><span class="bnote" style="align-self:end">Total ${fx(+ld.weight || 0, 2)} t</span><span></span></div>${(() => { const nb = bagN(ld), legs = +R.legN || 2, D = beamOn ? padXs(L0).length * (+L0.dropN || 1) : 0;
          if (!beamOn && nb > 1 && legs !== nb) return `<div class="bsug"><b>${legs} leg${legs > 1 ? "s" : ""} for ${nb} bags.</b> Each bag needs its own leg or drop. You choose:<div class="btnrow">${nb <= 4 ? `<button data-act="legsPerBag">${nb}-leg sling – one leg per bag</button>` : ""}<button data-act="spreadBags">Spreader beam – a drop to each bag</button></div></div>`;
          if (beamOn && nb > 1 && (R.dropTo || "bags") === "bags" && D !== nb) return `<div class="bsug"><b>${D} drops for ${nb} bags.</b><div class="btnrow"><button data-act="matchPads">Set ${Math.max(1, Math.round(+ld.nx || 1))} padeyes × ${Math.min(4, Math.max(1, Math.round(+ld.ny || 1)))} drops to match</button></div></div>`;
          return ""; })()}`
      : `<div class="bsub">Standard lifting points</div><div class="bgrid3"><label>A – B apart (m)<input type="number" data-lp="span" step="0.05" value="${ld.span ?? 0}"></label><label>Across (m)<input type="number" data-lp="spanY" step="0.05" value="${ld.spanY ?? 0}"></label><label>CoG towards B (m)<input type="number" data-lp="cog" step="0.05" value="${ld.cog ?? 0}"></label></div>`}
      <div class="bsub">Your own lifting points</div>
      ${(ld.pts || []).length ? `<div class="pthead"><span></span><span>Name</span><span>Along (m)</span><span>Across (m)</span><span>Height (m)</span><span>Round</span><span></span></div>` : ""}
      ${(ld.pts || []).map((p, i) => `<div class="ptrow" data-pt="${i}"><b>${escH(p.k)}</b><input type="text" data-pf="name" value="${escH(p.name || "")}" placeholder="e.g. top lug"><input type="number" data-pf="x" step="0.05" value="${fx(p.x, 2)}"><input type="number" data-pf="y" step="0.05" value="${fx(p.y, 2)}"><input type="number" data-pf="z" step="0.05" value="${fx(p.z, 2)}"><input type="checkbox" data-pf="wrap" title="The sling goes round the load here (choke or basket)" ${p.wrap ? "checked" : ""}><button data-ptdel="${i}" title="Remove">×</button></div>`).join("")}
      <div class="btnrow"><button id="bpAdd" class="${RB.addPt ? "pri" : ""}">${RB.addPt ? "Now click the front view… (Esc to stop)" : "+ Click on the load"}</button><button id="bpAddNum">+ Type one in</button></div>
      <p class="bnote">Along from the load centre (+ towards B), across from the centre line, height from the bottom. Click the end view after placing a point to set it across. Tick <b>Round</b> where a sling goes round the load (pipes, piles – set that sling to choke or basket).</p>
      <div class="bsub">Turning the load (upending / rotating)</div>
      <div class="bgrid3"><label>Tilt (°) – + raises end A<input type="number" data-rk="tilt" step="5" value="${+R.tilt || 0}"></label><span class="bnote" style="grid-column:span 2;align-self:end">Step through the turn (0°, 30°, 60°, 90°) – each crane's share changes.</span></div>`;
    if (k === "hookA" || k === "hookB") return `<p class="bnote">Top → bottom, as it hangs from the hook: e.g. master link · shackle · load cell · shackle.</p>${rowsOf(k === "hookA" ? "top" : "topB", k === "hookA" ? R.top : R.topB)}`;
    if (k === "legsA") return `${beamOn ? (nCr === 2 ? `<p class="bnote">One leg from crane A to its end of the beam.</p>` : `<label>Legs to the beam${seg("legN", Math.min(2, +R.legN || 2), [[1, "1 – single leg"], [2, "2 – to two top padeyes"]])}</label>`) : `<label>Number of legs${seg("legN", +R.legN || 2, [[1, "1"], [2, "2"], [3, "3"], [4, "4"]])}</label>`}
      <p class="bnote">Each leg, top → bottom:</p>${rowsOf("leg", R.leg)}${!beamOn ? legPtRows(0) : ""}${(+R.legN || 2) === 4 && !beamOn && !grp ? `<label>4 legs – load shared by<select id="rbShare">${[2, 3, 4].map(k2 => `<option value="${k2}" ${+(R.share4 || 3) === k2 ? "selected" : ""}>${k2} legs${k2 === 3 ? " (usual)" : k2 === 2 ? " (most conservative)" : ""}</option>`).join("")}</select></label>` : ""}`;
    if (k === "legsB") return `${beamOn ? `<p class="bnote">One leg from crane B to its end of the beam.</p>` : `<label>Number of legs${seg("legNB", +R.legNB || 1, [[1, "1"], [2, "2"], [3, "3"], [4, "4"]])}</label>`}<p class="bnote">Each leg, top → bottom:</p>${rowsOf("legB", R.legB)}${!beamOn ? legPtRows(1) : ""}`;
    if (k === "beam") return levelBody(0, "beam"); if (k === "pad") return levelBody(0, "pad"); if (k === "drops") return levelBody(0, "drops");
    if (k === "beam2") return levelBody(1, "beam"); if (k === "pad2") return levelBody(1, "pad"); if (k === "drops2") return levelBody(1, "drops");
    return "";
  };
  const nBad = (res?.checks || []).filter(c => c.lvl === "bad").length, nWarn = (res?.checks || []).filter(c => c.lvl === "warn").length, nOk = (res?.checks || []).filter(c => c.lvl === "ok").length;
  const chk = (res?.checks || []).map(c => c.head ? `<div class="bchk-h">${escH(c.head)}</div>` : `<div class="bchk ${c.lvl}"><span>${c.lvl === "ok" ? "✓" : c.lvl === "warn" ? "!" : "✕"}</span>${escH(c.text)}</div>`).join("");
  return `<div class="bb">
    <div class="bmode">
      <div><span class="blab">Cranes</span>${seg("cranes", nCr, [[1, "One crane"], [2, "Two cranes (tandem)"]])}</div>
      <div><span class="blab">Legs go to</span>${seg("legTo", beamOn ? "beam" : "load", [["load", grp ? "The bags" : "The load"], ["beam", "A spreader beam"]])}</div>
    </div>
    <ol class="tiers">${tiers.map((t, i) => `<li class="tier ${RB.tier === t.k ? "open" : ""}" data-st="${st[t.k] || ""}">
      <button class="thead" data-tier="${t.k}"><span class="tnum">${i + 1}</span><span class="tico">${tierIcon(t.icon)}</span><span class="ttxt"><b>${t.title}</b><span>${t.sum}</span></span>${t.use ? `<span class="tuse">${t.use}</span>` : ""}<span class="tdot" title="${st[t.k] === "bad" ? "Has a problem" : st[t.k] === "warn" ? "Check this" : "OK"}"></span><span class="tchev">▾</span></button>
      ${RB.tier === t.k ? `<div class="tbody">${body(t.k)}</div>` : ""}</li>`).join("")}</ol>
    <details class="tier bchecks" ${nBad ? "open" : ""}><summary class="thead"><span class="tnum">✓</span><span class="ttxt"><b>Connection check</b><span>${nOk} OK${nWarn ? ` · ${nWarn} to check` : ""}${nBad ? ` · <b class="bbad">${nBad} not allowed</b>` : ""}</span></span><span class="tchev">▾</span></summary>
      <div class="tbody"><div class="bchks">${chk || `<p class="bnote">Add fittings and slings to check how they join.</p>`}</div>
      <p class="bnote">Rules used: shackle pin on the hook or through the padeye, sling eyes on the bow (max 2, within 120°), soft slings never on the pin, no sling-to-sling or hook-to-hook, master link assemblies for 3–4 legs, slings round a load in choke or basket, bulk bags by all 4 loops on a rounded hook.</p></div></details>
    <div class="btnrow"><button id="rbSize">Size everything for this load (≤ 90% SWL)</button></div>
  </div>`;
}

const nextPtKey = ld => { const ks = new Set((ld.pts || []).map(p => p.k)); let i = 1; while (ks.has("P" + i)) i++; return "P" + i; };
// wire the builder's own controls (the component rows use the shared rigging-list wiring)
{ const _w = wireRB; wireRB = function () {
    _w();
    const R = RB.work.rig; if (R.arr !== "build" || !$("rbLeft").querySelector(".bb")) return;
    const root = $("rbLeft"), redo = () => { delete R.auto; renderRB(); }, ld = RB.work;
    const setL = (i, k, v) => { if (+i === 0) R[k] = v; else { R.b2 = R.b2 || {}; R.b2[k] = v; } };
    root.querySelectorAll("[data-bsel]").forEach(b => b.onclick = () => {
      let k = b.dataset.bsel, v = b.dataset.v; v = isNaN(+v) ? v : +v;
      if (k.includes(":")) { const [i, kk] = k.split(":"); setL(i, kk, v);
        if (kk === "dropTo" && v === "beam" && !R.beam2) { const W = +ld.weight || 5; R.beam2 = rigEntry(pickItem("spreader", W)); R.pad2 = [rigEntry(pickItem("shackle", W / 2, std))]; R.drop2 = [rigEntry(pickItem("sling_round", W / 2), { len: 3 }), rigEntry(pickItem("shackle", W / 2, std))]; R.b2 = { padN: 2, padSpan: +ld.span || Math.round(loadDims(ld).x * 0.7 * 100) / 100, dropN: 1, dropTo: "points" }; R.padN = 1; R.dropN = Math.min(2, R.dropN || 2); if (R.dropN === 1) R.padN = 2; }
        return redo(); }
      R[k] = v;
      if (k === "legTo" && v === "beam" && R.legN > 2) R.legN = 2;
      if (k === "legN" && v > 2 && R.legTo === "beam") { R.legTo = "load"; toast("3–4 legs go straight to the load – switched off the spreader beam"); }
      if (k === "cranes" && v === 2) { if (!R.topB) R.topB = clone(R.top || []); if (!R.legB) R.legB = clone(R.leg || []); if (!R.legNB) R.legNB = 1; if (R.legTo !== "beam") R.legN = Math.min(R.legN || 1, 2); toast("Tandem: hook the second crane onto this load (point B) – each crane's share is worked out from the rigging"); }
      if (k === "legTo" && v === "beam" && !R.beam) { const nb = defaultBuild({ ...ld }); Object.assign(R, { beam: nb.beam || rigEntry(pickItem("spreader", +ld.weight || 5)), topSpan: nb.topSpan, padN: nb.padN || 2, padSpan: nb.padSpan ?? (+ld.span || 2), pad: nb.pad || [rigEntry(pickItem("shackle", 5, std))], drop: nb.drop || [rigEntry(pickItem("sling_round", 5), { len: 3 })], dropN: nb.dropN || 1, dropTo: nb.dropTo }); }
      redo();
    });
    root.querySelectorAll("[data-rk]").forEach(el => el.onchange = () => { const k = el.dataset.rk; R[k] = el.type === "text" ? el.value : (el.value === "" ? "" : +el.value); redo(); });
    root.querySelectorAll("[data-lk2]").forEach(el => el.onchange = () => { const [i, k] = el.dataset.lk2.split(":"); setL(i, k, el.type === "text" ? el.value : (el.value === "" ? "" : +el.value)); if (k === "padN" || k === "padSpan") setL(i, "padX", ""); redo(); });
    root.querySelectorAll("[data-ptsel]").forEach(el => el.onchange = () => { const key = el.dataset.ptsel, i = +el.dataset.i; if (key.includes(":")) { const [l, k] = key.split(":"); const L = +l === 0 ? R : (R.b2 = R.b2 || {}); (L[k] = L[k] || [])[i] = el.value; } else (R[key] = R[key] || [])[i] = el.value; redo(); });
    root.querySelectorAll("[data-bk]").forEach(el => el.onchange = () => {
      const k = el.dataset.bk, v = +el.value;
      if (k === "bagW") ld.weight = Math.round(v * bagN(ld) * 1000) / 1000;
      else { const per = W1(ld); ld[k] = k === "gap" ? Math.max(0, v) : Math.max(1, Math.round(v)); ld.weight = Math.round(per * bagN(ld) * 1000) / 1000; }
      redo();
    });
    if (root.querySelector("[data-b2item]")) { root.querySelector("[data-b2item]").onchange = e => { const it = rigItem(e.target.value); if (it) { R.beam2 = rigEntry(it); } redo(); }; root.querySelector("[data-b2len]").onchange = e => { if (R.beam2) R.beam2.len = +e.target.value; redo(); }; }
    // your own lifting points
    root.querySelectorAll(".ptrow").forEach(rw => { const p = ld.pts[+rw.dataset.pt]; rw.querySelectorAll("[data-pf]").forEach(el => el.onchange = () => { const f = el.dataset.pf; p[f] = f === "wrap" ? el.checked : f === "name" ? el.value : +el.value; redo(); }); });
    root.querySelectorAll("[data-ptdel]").forEach(b => b.onclick = () => { const k = ld.pts[+b.dataset.ptdel].k; ld.pts.splice(+b.dataset.ptdel, 1); for (const key of ["legPts", "legPtsB", "dropPts"]) if (R[key]) R[key] = R[key].map(x => x === k ? "auto" : x); redo(); });
    root.querySelectorAll("[data-tier]").forEach(b => b.onclick = () => { RB.tier = RB.tier === b.dataset.tier ? null : b.dataset.tier; RB.addPt = false; renderRB(); });
    root.querySelectorAll("[data-act]").forEach(b => b.onclick = () => {
      const act = b.dataset.act, nx = Math.max(1, Math.round(+ld.nx || 1)), ny = Math.max(1, Math.round(+ld.ny || 1)), pitch = nz(ld.L) + Math.max(0, +ld.gap || 0);
      if (act === "legsPerBag") { R.legN = bagN(ld); R.legTo = "load"; R.legPts = []; }
      if (act === "spreadBags") { const keepTop = R.top, nb = defaultBuild(ld); Object.assign(R, nb, keepTop?.length ? { top: keepTop } : {}); R.legTo = "beam"; }
      if (act === "matchPads") { R.dropTo = "bags"; R.padN = nx; R.dropN = Math.min(4, ny); R.padX = ""; R.padSpan = Math.round((nx - 1) * pitch * 100) / 100; if (R.beam && (+R.beam.len || 0) < R.padSpan + 0.4) R.beam.len = Math.ceil((R.padSpan + 0.4) * 10) / 10; }
      redo();
    });
    if ($("bpAdd")) $("bpAdd").onclick = () => { RB.addPt = !RB.addPt; renderRB(); };
    if ($("bpAddNum")) $("bpAddNum").onclick = () => { const d = loadDims(ld); ld.pts = ld.pts || []; ld.pts.push({ k: nextPtKey(ld), name: "", x: 0, y: 0, z: d.z }); redo(); };
    // clicks on the drawing place points (front view: along + height; end view: across for the last point)
    const svgEl = $("rbPrev").querySelector("svg");
    if (svgEl && !RB.addPt) svgEl.onclick = ev => { if (ev.target.closest("[data-part]") || ev.target.closest("[data-drag]") || RB.suppressClick) return; if (RB.edit) { RB.edit = null; renderRB(); } };
    if (svgEl) svgEl.classList.toggle("addpt", !!RB.addPt);
    if (svgEl && RB.addPt) { svgEl.style.cursor = "copy"; svgEl.onclick = ev => {
      const pt = svgEl.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const q = pt.matrixTransform(svgEl.getScreenCTM().inverse()), d = loadDims(ld), TT = tiltFn(ld, R);
      const endOx = RB.hits?.endOx ?? 1e9, x = q.x, z = -q.y;
      if (Math.abs(x - endOx) < d.y / 2 + 1 && (ld.pts || []).length) { const p = ld.pts[ld.pts.length - 1]; p.y = Math.round(Math.max(-d.y / 2, Math.min(d.y / 2, x - endOx)) * 100) / 100; toast(`${p.k}: ${fx(p.y, 2)} m across`); return redo(); }
      const u = TT.inv([x, 0, z]); if (Math.abs(u[0]) > d.x / 2 + 0.5 || u[2] < -0.5 || u[2] > d.z + 0.5) { toast("Click on or next to the load in the front view"); return; }
      ld.pts = ld.pts || []; const k = nextPtKey(ld); ld.pts.push({ k, name: "", x: Math.round(Math.max(-d.x / 2, Math.min(d.x / 2, u[0])) * 100) / 100, y: 0, z: Math.round(Math.max(0, Math.min(d.z, u[2])) * 100) / 100 });
      toast(`${k} added – pick it for a leg or drop; click the end view to set how far across`); redo();
    }; }
  }; }
document.addEventListener("keydown", e => { if (e.key === "Escape" && RB.addPt) { RB.addPt = false; if ($("dRig").open) renderRB(); } });
// the arrangement-specific half of the rigging panel is replaced by the builder when "Build your own" is chosen
{ const _rb = renderRB; renderRB = function () {
    _rb();
    const ld = RB.work, R = ld.rig; if (!R || R.arr !== "build") { RB.addPt = false; return; }
    const res = solveRig(ld), left = $("rbLeft"), mark = [...left.children].find(el => /Where it connects on the load/.test(el.textContent || ""));
    if (mark) { while (mark.nextSibling) mark.nextSibling.remove(); mark.outerHTML = buildPanelHTML(ld, R, res) + `<select id="rbLpType" hidden></select>`; }
    // the standard set-ups and arrangement buttons fold away while building your own
    const pre = [...left.children].find(el => /Start from a set-up/.test(el.querySelector(".rh")?.textContent || "")), arr = left.querySelector(".rarr");
    if (pre && arr) { const d = document.createElement("details"); d.className = "bswitch"; d.innerHTML = `<summary>Start from a set-up · <span>standard set-ups fill the list below – you can change anything after</span></summary>`; pre.before(d); d.append(pre, arr); }
    wireRB();
  }; }
// the builder edits the load too (bags, your own points) – keep those when the rigging is saved
{ const b = $("rbSave"), _s = b.onclick; b.onclick = function (...a) { const l = plan.loads.find(x => x.id === RB.ldId), w = RB.work; if (l && w) { for (const k of ["pts", "nx", "ny", "gap", "bagW", "_n"]) if (w[k] !== undefined) l[k] = clone(w[k]); if (w.kind === "bag" && Math.abs((+w.weight || 0) - (+l.weight || 0)) > 1e-9) l.weight = w.weight; } return _s.apply(this, a); }; }
RIG_PRESETS.push(
  { id: "build_drops", name: "Spreader with drops – bags / many points", block: "any", desc: "Master link · 2 top legs · spreader with a row of bottom padeyes · shackle at each padeye · drops to each bag or lifting point (build your own)", arr: "build", build: ld => defaultBuild(ld, true) },
  { id: "build_pipe", name: "Pipe / pile – 2 slings choked round it", block: "any", desc: "Master link · 2 round slings in choke round the pipe at two points (build your own – move the points to suit)", arr: "build", build: ld => { const d = loadDims(ld), s = +ld.span > 0 ? +ld.span : Math.round(d.x * 0.6 * 100) / 100, W = Math.max(1, +ld.weight || 5); ld.pts = [{ k: "P1", name: "choke A", x: -s / 2, y: 0, z: d.z, wrap: true }, { k: "P2", name: "choke B", x: s / 2, y: 0, z: d.z, wrap: true }];
      return { arr: "build", cranes: 1, legN: 2, legTo: "load", legPts: ["P1", "P2"], top: [rigEntry(pickItem("masterlink", W))], leg: [rigEntry(pickItem("sling_round", W / 2 * 1.3 / 0.8), { len: Math.max(4, Math.ceil((Math.PI * d.z + s * 0.7) * 2) / 2), hitch: "choke" })], share4: 3 }; } },
  { id: "build_upend", name: "Tandem upend – main on top, tail on bottom", block: "any", desc: "Crane A on a lug at the top end, crane B (tailing) on a lug at the bottom end – set the tilt to check each stage (build your own)", arr: "build", build: ld => { const d = loadDims(ld), W = Math.max(1, +ld.weight || 5); ld.pts = [{ k: "P1", name: "top lug", x: -d.x / 2 + 0.3, y: 0, z: d.z }, { k: "P2", name: "tail lug", x: d.x / 2 - 0.3, y: 0, z: d.z }];
      const g = f => [rigEntry(pickItem("masterlink", W * f)), rigEntry(pickItem("shackle", W * f, std))], l = f => [rigEntry(pickItem("sling_round", W * f), { len: 3 }), rigEntry(pickItem("shackle", W * f, std))];
      return { arr: "build", cranes: 2, legN: 1, legNB: 1, legTo: "load", legPts: ["P1"], legPtsB: ["P2"], top: g(0.6), topB: g(0.6), leg: l(0.6), legB: l(0.6), tilt: 0, share4: 3 }; } }
);
{ const _ap = applyPreset; applyPreset = function (ld, id) { _ap(ld, id); if (ld.rig && ld.rig.arr === "build") sizeRig(ld); return ld.rig; }; }
