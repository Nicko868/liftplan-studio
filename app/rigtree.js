// ================= Rigging workbench – any arrangement, built part by part =================
// The rigging is a tree hung from the crane hook: NODES (the hook, a junction such as a master link or shackle where legs
// meet, a spreader beam turned any way) joined by LEGS (the parts in line, top → bottom: slings, shackles, links …).
// Every leg ends on a lifting point of the load, a junction, or a top padeye of a spreader. Nothing about any one
// arrangement is written into the code: single legs, bridles, spreaders, spreaders under spreaders, cross spreaders,
// master links between – it is all the same tree, solved the same way:
//   1. the load is shared out from the hook down (the load is stiff: each node splits what it carries between the
//      branches below it by moments about the load point – two branches by the lever rule, three or more by a plane fit);
//   2. the geometry is worked out from the bottom up (each leg's length and where it ends give its angle and height;
//      a spreader hangs level under the resultant of its load);
//   3. the forces go back up with the rigging weights added (spreader padeyes by moments along the beam);
//   4. every part gets its load share, angle and use, and the result has the same form as every other rigging in the app,
//      so the drawings, sheets, calculation, maker's tables and checks all work on it unchanged.
// R = { arr: "tree", tree: { root, nodes: [{ id, kind: "hook" | "join" | "beam", parts: [entries], beam: entry, axis: 0 | 90,
//       top: [offsets m], bot: [offsets m], legs: [{ id, from: bottom pad (beams), parts: [entries], to: { pt } | { node, pad } }] }] } }
const WB_H = 0.45;
const hide = (o, k, v) => Object.defineProperty(o, k, { value: v, writable: true, configurable: true, enumerable: false });   // worked-out values stay out of the saved plan
const wbId = () => "w" + uid();
const wbNode = (T, id) => T.nodes.find(n => n.id === id);
function wbIsTree(ld) { return ld?.rig?.arr === "tree" && ld.rig.tree?.nodes?.length; }

function solveTree(ld) {
  const R = ld.rig, T = R.tree, W = +ld.weight || 0, d = loadDims(ld), lz = liftPointZ(ld), TT = tiltFn(ld, R);
  const warn = [], notes = [], seg = [], shk = [], links = [], hooks = [], pads = [], lpPts = [], beams = [], checks = [], partsAt = [];
  const N = new Map(T.nodes.map(n => [n.id, n])), root = N.get(T.root);
  if (!root) return null;
  const P = new Map(allPts(ld).map(p => [p.k, p])), ptPos = k => { const p = P.get(k); return p ? TT([p.x, p.y || 0, p.wrap ? d.z : (p.z ?? lz)]) : null; };
  const g0 = TT([+ld.cog || 0, 0, d.z / 2]);
  // a ramshorn hook: two legs straight on the hook sit one on each horn
  const crH = plan.cranes.filter(c => c.attach?.load === ld.id && REG.cranes[c.model]), bdH = crH.length === 1 ? blockDims(crH[0], REG.cranes[crH[0].model]) : null, hornX = bdH && bdH.type === "ramshorn" ? Math.max(0.12, bdH.hookLen * 0.27) : 0;
  const legLen = L => chainLenB(L.parts || []), legW = L => chainW(L.parts || []), nodeLen = n => chainLenFull(n.parts || []), nodeW = n => chainW(n.parts || []);
  // a maker's-table spreader is built to the maker's span: top and bottom pins on the same span
  for (const n of T.nodes) if (n.kind === "beam" && n.beam) { const Tb = typeof tableOf === "function" ? tableOf(n.beam) : null;
    if (Tb) { const sp0 = Math.max(...(n.bot || [0]).map(Math.abs)) * 2 || +n.beam.len || 5, sb = Math.round(tSpan(sp0, Tb) * 1000) / 1000, w = tWeight(sb, Tb);
      n._bot = (n.bot || []).length === 2 ? [-sb / 2, sb / 2] : n.bot; n._top = (n.top || []).length === 2 ? [-sb / 2, sb / 2] : n.top; n._span = sb; if (w) n.beam.snap.weight = w; n.beam.len = sb; }
    else { n._bot = n.bot || [0]; n._top = n.top || [0]; n._span = null; } }
  // ---- what sits under each node: the lifting points (for sharing the load)
  const seen = new Set();
  const leaves = n => { if (n._leaves) return n._leaves; if (seen.has(n.id)) { warn.push("Workbench: the rigging loops back on itself – a leg goes to a node above it"); return []; } seen.add(n.id);
    const out = []; for (const L of n.legs || []) { if (L.to?.pt) { const p = ptPos(L.to.pt); if (p) out.push(p); else warn.push(`Workbench: lifting point ${L.to.pt} is not on the load`); } else if (L.to?.node && N.get(L.to.node)) out.push(...leaves(N.get(L.to.node))); else warn.push("Workbench: a leg isn't connected at its lower end"); }
    hide(n, "_leaves", out); return out; };
  for (const n of T.nodes) { delete n._leaves; delete n._V; delete n._g; delete n._xy; }
  leaves(root);
  const cen = pts => pts.length ? [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length] : [0, 0];
  // ---- 1. share the load from the hook down
  function split(cs, V, g) {
    const n = cs.length; if (n === 1) return [{ V, g }];
    const cm = cen(cs.map(c => [c[0], c[1]])); let sxx = 0, sxy = 0, syy = 0; cs.forEach(c => { const a = c[0] - cm[0], b = c[1] - cm[1]; sxx += a * a; sxy += a * b; syy += b * b; });
    const det = sxx * syy - sxy * sxy, gd = [g[0] - cm[0], g[1] - cm[1]]; let Vs;
    if (det > 1e-6 * Math.max(1e-9, (sxx + syy) ** 2)) { const w = [(syy * gd[0] - sxy * gd[1]) / det, (-sxy * gd[0] + sxx * gd[1]) / det]; Vs = cs.map(c => V / n + V * ((c[0] - cm[0]) * w[0] + (c[1] - cm[1]) * w[1])); }
    else if (sxx + syy < 1e-9) Vs = cs.map(() => V / n);
    else { const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), u = [Math.cos(th), Math.sin(th)], s = cs.map(c => (c[0] - cm[0]) * u[0] + (c[1] - cm[1]) * u[1]), S = s.reduce((a, x) => a + x * x, 0); Vs = s.map(x => V / n + V * (gd[0] * u[0] + gd[1] * u[1]) * x / S); }
    if (Vs.some(v => v < -1e-6)) warn.push("The load's centre of gravity is outside the lifting points of one part of the rigging – it will tip; move the points or the junction");
    Vs = Vs.map(v => Math.max(0, v)); const tot = Vs.reduce((a, v) => a + v, 0) || 1; Vs = Vs.map(v => v * V / tot);
    const gp = [Vs.reduce((a, v, i) => a + v * cs[i][0], 0) / V || 0, Vs.reduce((a, v, i) => a + v * cs[i][1], 0) / V || 0], rs = [g[0] - gp[0], g[1] - gp[1]];
    return Vs.map((v, i) => ({ V: v, g: [cs[i][0] + rs[0], cs[i][1] + rs[1]] }));
  }
  const groupsOf = n => { const m = new Map(); for (const L of n.legs || []) { const tn = L.to?.node && N.get(L.to.node), k = tn && tn.kind === "beam" ? "b" + tn.id : "l" + L.id; if (!m.has(k)) m.set(k, { legs: [], beam: tn && tn.kind === "beam" ? tn : null }); m.get(k).legs.push(L); } return [...m.values()]; };
  const legLeaves = L => L.to?.pt ? [ptPos(L.to.pt)].filter(Boolean) : L.to?.node && N.get(L.to.node) ? leaves(N.get(L.to.node)) : [];
  function alloc(n, V, g, upXY, upLen) {
    n._V = V; n._g = g;
    const G = groupsOf(n), cs = G.map(gr => cen(gr.legs.flatMap(legLeaves))), sh = split(cs, V, g);
    if (n.kind === "beam") {
      // the beam hangs level under its load: its bottom padeyes centred (by load) over where its load acts
      const u = n.axis ? [0, 1] : [1, 0], vv = [-u[1], u[0]], oB = n._bot, legsV = G.map((gr, i) => ({ gr, V: sh[i].V }));
      let sv = 0, so = 0; legsV.forEach(({ gr, V: v }) => gr.legs.forEach(L => { const o = oB[Math.min(oB.length - 1, +L.from || 0)] || 0; sv += v / gr.legs.length; so += v / gr.legs.length * o; }));
      const om = sv > 0 ? so / sv : 0, gpar = g[0] * u[0] + g[1] * u[1], gper = g[0] * vv[0] + g[1] * vv[1];
      n._xy = [u[0] * (gpar - om) + vv[0] * gper, u[1] * (gpar - om) + vv[1] * gper]; n._u = u;
    } else n._xy = upXY && upLen < 1.0 ? upXY.slice() : g.slice();   // a junction right under a padeye (shackle / link only) hangs straight under it
    G.forEach((gr, i) => { for (const L of gr.legs) { L._V = sh[i].V / gr.legs.length;
      const from = n.kind === "beam" ? wbPadXY(n, n._bot, +L.from || 0) : n._xy;
      if (L.to?.node && N.get(L.to.node) && N.get(L.to.node).kind !== "beam") alloc(N.get(L.to.node), sh[i].V, sh[i].g, from, legLen(L)); }
      if (gr.beam && !gr.beam._V) alloc(gr.beam, sh[i].V, sh[i].g, null, 9); });
  }
  const wbPadXY = (n, offs, k) => { const o = offs[Math.min(offs.length - 1, k)] || 0; return [n._xy[0] + n._u[0] * o, n._xy[1] + n._u[1] * o]; };
  alloc(root, W, [g0[0], g0[1]], null, 9);
  // ---- 2. geometry from the bottom up: where each node sits (z), each leg's upper and lower ends
  const placed = new Set();
  function place(n) {
    if (placed.has(n.id)) return; placed.add(n.id);
    const ends = (n.legs || []).map(L => { let p = null; if (L.to?.pt) p = ptPos(L.to.pt); else if (L.to?.node && N.get(L.to.node)) { const c = N.get(L.to.node); place(c); p = c.kind === "beam" ? [...wbPadXY(c, c._top, +L.to.pad || 0), c._zb + WB_H] : c._top; } return { L, p }; }).filter(x => x.p);
    if (n.kind === "beam") {
      const zs = ends.map(({ L, p }) => { const a = wbPadXY(n, n._bot, +L.from || 0), dd = Math.hypot(p[0] - a[0], p[1] - a[1]), Ln = legLen(L); let v = Ln * Ln - dd * dd; L._noReach = v < 1e-4 && (Ln > 0.05 || dd > 0.05); if (v < 1e-4) { if (Ln > 0.05 || dd > 0.05) warn.push(`${n.beam?.snap?.name || "Spreader"}: a ${fx(Ln, 2)} m drop can't reach ${fx(dd, 2)} m across to its point`); v = 1e-4; } return p[2] + Math.sqrt(v); });
      n._zb = zs.length ? Math.max(...zs) : lz + 1; if (zs.length > 1 && Math.max(...zs) - Math.min(...zs) > 0.1) warn.push(`${n.beam?.snap?.name || "Spreader"}: its drops reach different heights (${fx(Math.max(...zs) - Math.min(...zs), 2)} m) – the shorter ones take the load; check the lengths`);
      if (n._zb < d.z + 0.3) warn.push(n._zb < d.z ? `${n.beam?.snap?.name || "Spreader"} would sit ${fx(d.z - n._zb, 2)} m inside the load – longer drops needed` : `${n.beam?.snap?.name || "Spreader"} only ${fx(n._zb - d.z, 2)} m above the load – use longer drops`);
      hide(n, "_ends", ends.map(({ L, p }) => ({ L, a: [...wbPadXY(n, n._bot, +L.from || 0), n._zb], b: p })));
    } else {
      const xy = n._xy || [0, 0], horn = n === root && hornX > 0 && !(n.parts || []).length && ends.length === 2, aOf = p => { if (!horn) return xy; const dx = p[0] - xy[0], dy = p[1] - xy[1], L0 = Math.hypot(dx, dy) || 1; return [xy[0] + dx / L0 * hornX, xy[1] + dy / L0 * hornX]; };
      const zs = ends.map(({ L, p }) => { const a0 = aOf(p), dd = Math.hypot(p[0] - a0[0], p[1] - a0[1]), Ln = legLen(L); let v = Ln * Ln - dd * dd; L._noReach = v < 1e-4 && (Ln > 0.05 || dd > 0.05); if (v < 1e-4) { if (Ln > 0.05 || dd > 0.05) warn.push(`A ${fx(Ln, 2)} m leg can't reach the ${fx(dd, 2)} m out to ${L.to?.pt ? "point " + L.to.pt : "where it goes"} – longer leg`); v = 1e-4; } return p[2] + Math.sqrt(v); });
      const z = zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : lz + 1;
      if (zs.length > 1 && Math.max(...zs) - Math.min(...zs) > 0.1) warn.push(`Legs from the ${n.kind === "hook" ? "hook" : (n.parts?.[0]?.snap?.name || "junction")} reach different heights (${fx(Math.max(...zs) - Math.min(...zs), 2)} m) – the shorter ones take more load; check the lengths`);
      n._J = [xy[0], xy[1], z]; n._top = [xy[0], xy[1], z + nodeLen(n)];
      hide(n, "_ends", ends.map(({ L, p }) => ({ L, a: horn ? [...aOf(p), z] : n._J, b: p })));
    }
  }
  place(root);
  for (const n of T.nodes) if (!placed.has(n.id)) warn.push(`Workbench: ${n.kind === "beam" ? (n.beam?.snap?.name || "a spreader") : "a junction"} isn't hung from anything – connect a leg to it or remove it`);
  // ---- 3. forces back up, with the rigging weights
  const done = new Set();
  function up(n) {   // total vertical this node carries (load below + gear below + its own parts); sets each down-leg's vertical
    if (done.has(n.id)) return n._Fup; done.add(n.id);
    for (const e of n._ends || []) { const L = e.L; let below; if (L.to?.pt) below = L._V || 0; else { const c = N.get(L.to.node); up(c); below = c.kind === "beam" ? (c._padF?.[+L.to.pad || 0] || 0) / Math.max(1, (c._legsAt?.[+L.to.pad || 0] || 1)) : c._Fup; }
      L._Vv = below + legW(L); const dd = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]), dz = Math.max(1e-6, e.a[2] - e.b[2]); L._beta = Math.atan2(dd, dz) / D2R; L._T = L._noReach ? L._Vv : L._Vv / Math.cos(Math.min(85, L._beta) * D2R); }   // a leg that can't reach isn't sized until it can
    if (n.kind === "beam") { const wB = n.beam ? eWeight(n.beam) : 0, oT = n._top, oB = n._bot; let tot = wB, mom = 0;
      for (const e of n._ends || []) { const o = oB[Math.min(oB.length - 1, +e.L.from || 0)] || 0; tot += e.L._Vv; mom += e.L._Vv * o; }
      n._load = tot - wB; n._Fup = tot; const xG = tot ? mom / tot : 0;
      if (oT.length >= 2) { const a = Math.min(...oT), b = Math.max(...oT); if (xG < a - 0.01 || xG > b + 0.01) warn.push(`${n.beam?.snap?.name || "Spreader"}: the load is outside its top padeyes – it will tip`); const fa = tot * Math.max(0, Math.min(1, (b - xG) / ((b - a) || 1))); n._padF = oT.map(o => Math.abs(o - a) < 1e-6 ? fa : tot - fa); }
      else n._padF = [tot];
    } else n._Fup = (n._ends || []).reduce((a, e) => a + e.L._Vv, 0) + nodeW(n);
    return n._Fup;
  }
  // how many legs come down onto each top padeye (they share it)
  for (const n of T.nodes) for (const L of n.legs || []) if (L.to?.node) { const c = N.get(L.to.node); if (c && c.kind === "beam") { c._legsAt = c._legsAt || []; const k = +L.to.pad || 0; c._legsAt[k] = (c._legsAt[k] || 0) + 1; } }
  up(root);
  for (const n of T.nodes) delete n._legsAt;
  // ---- 4. drawing, rows and checks in the app's usual form
  const inst = [];   // every part where it is: { e, load, where, p, ang }
  const shortName = e => { const Tb = e && typeof tableOf === "function" ? tableOf(e) : null; return Tb ? tName(Tb) : String(e?.snap?.name || "").replace(/\s*[×(–].*$/, "").trim(); };
  const nameOf = n => n.kind === "hook" ? "the hook" : n.kind === "beam" ? (shortName(n.beam) || "spreader") : (shortName(n.parts?.[0]) || "junction");
  const drawLeg = (L, a, b, where) => { const list = L.parts || [], lens = list.map(e => Math.max(RIG_TYPES[e.snap.type]?.sling ? 0.1 : 0.05, RIG_TYPES[e.snap.type]?.sling && e.hitch === "basket" ? eLen(e) / 2 : eLen(e)));
    const tot = lens.reduce((x, y) => x + y, 0) || 1, D = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; let acc = 0;
    list.forEach((e, i) => { const t0 = acc / tot, t1 = (acc + lens[i]) / tot; acc += lens[i]; const Pp = t => [a[0] + D[0] * t, a[1] + D[1] * t, a[2] + D[2] * t], pa = Pp(t0), pb = Pp(t1), pm = Pp((t0 + t1) / 2);
      if (RIG_TYPES[e.snap.type]?.sling) seg.push({ a: pa, b: pb, e }); else if (e.snap.type === "masterlink") links.push(pm); else if (e.snap.type === "hook") hooks.push(pa); else shk.push(pm);
      inst.push({ e, load: L._T || 0, where, p: pm, ang: L._beta, sl: !!RIG_TYPES[e.snap.type]?.sling }); });
    if (!list.some(e => RIG_TYPES[e.snap.type]?.sling) && Math.hypot(...D) > 0.05) seg.push({ a, b, e: null }); };
  for (const n of T.nodes) { if (!placed.has(n.id)) continue;
    const lab = n.kind === "hook" ? "top legs" : n.kind === "beam" ? `drops from the ${nameOf(n)}` : `legs from the ${nameOf(n)}`;
    for (const e of n._ends || []) { drawLeg(e.L, e.a, e.b, lab); if (e.L.to?.pt) lpPts.push(e.b);
      if (n.kind === "beam" && e.L._beta > (rule("rig.dropMax") ?? 30)) warn.push(`Drops from the ${nameOf(n)} ${fx(e.L._beta, 0)}° from vertical – over ${rule("rig.dropMax") ?? 30}°: line the padeyes up over the points or use longer drops`);
      else if (n.kind !== "beam" && e.L._beta > (rule("rig.legHard") ?? 60)) warn.push(`Legs from ${nameOf(n)} ${fx(e.L._beta, 0)}° from vertical – over ${rule("rig.legHard") ?? 60}°: longer slings or a spreader`);
      else if (n.kind !== "beam" && e.L._beta > (rule("rig.legMax") ?? 45)) warn.push(`Legs from ${nameOf(n)} ${fx(e.L._beta, 0)}° from vertical – over ${rule("rig.legMax") ?? 45}°: check the reduced capacity`); }
    if (n.kind === "beam") { const a = [...wbPadXY(n, [Math.min(...n._bot, ...n._top, -(+n.beam?.len || 0) / 2)], 0), n._zb], b = [...wbPadXY(n, [Math.max(...n._bot, ...n._top, (+n.beam?.len || 0) / 2)], 0), n._zb];
      beams.push({ a, b, h: WB_H, entry: n.beam, cross: !!n.axis, node: n.id });
      n._top.forEach(o => pads.push([...wbPadXY(n, [o], 0), n._zb + WB_H, "top"])); n._bot.forEach(o => pads.push([...wbPadXY(n, [o], 0), n._zb, "low"]));
      if (n.beam) { const tl = T.nodes.flatMap(m => (m._ends || []).filter(e => e.L.to?.node === n.id)), comp = tl.length ? Math.max(...tl.map(e => e.L._T * Math.sin(e.L._beta * D2R))) : 0;
        inst.push({ e: n.beam, load: n._load, where: `spreader · ${n._span ? "span " + fx(n._span, 2) + " m" : (n._bot.length + " bottom padeyes")} · ${n.axis ? "turned across the load" : "along the load"}`, comp, p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, n._zb + WB_H / 2], ang: null, beam: true }); } }
    else { // parts at a junction / on the hook: stacked up from where the legs meet; they carry the legs' pull (added – on the safe side)
      let z = n._J[2]; const F = (n._ends || []).reduce((a, e) => a + e.L._T, 0) + nodeW(n), Fv = n._Fup;
      [...(n.parts || [])].reverse().forEach(e => { const Lp = Math.max(0.05, eLen(e)), pm = [n._J[0], n._J[1], z + Lp / 2]; z += Lp; if (e.snap.type === "masterlink") links.push(pm); else if (e.snap.type === "hook") hooks.push(pm); else shk.push(pm);
        inst.push({ e, load: n.kind === "hook" ? Fv : ((n._ends || []).length > 1 ? F : Fv), where: n.kind === "hook" ? "on the crane hook" : `junction – ${(n._ends || []).length} leg${(n._ends || []).length > 1 ? "s" : ""} on it`, p: pm, ang: null }); }); } }
  // rows: the same item in the same place on several legs is one row (quantity added, the highest load)
  const rows = [], byKey = new Map(); let no = 0;
  for (const x of inst) { const e = x.e, k = `${e.id}|${RIG_TYPES[e.snap.type]?.sling ? (+e.len || 0) : ""}|${x.where}`; let r = byKey.get(k);
    if (!r) { const sl = RIG_TYPES[e.snap.type]?.sling; r = { no: 0, name: e.snap.name + (sl && e.len ? ` × ${(+e.len).toFixed(1)} m` : ""), hitchF: 1, hitchParts: [], type: e.snap.type, qty: 0, swl: +e.snap.swl || 0, baseSwl: +e.snap.swl || 0, load: 0, len: eLen(e), unitW: eWeight(e), weight: 0, where: x.where, entry: e, entries: [], angs: [], pos: x.p }; byKey.set(k, r); rows.push(r); }
    const q = e.qty || 1; r.qty += q; r.load = Math.max(r.load, x.load / q); r.weight += eWeight(e) * q; r.entries.push(e); if (x.ang != null) r.angs.push(x.ang); if (x.comp > 0.01) r.comp = Math.max(r.comp || 0, x.comp); }
  rows.forEach(r => { r.no = ++no; if (r.angs.length && RIG_TYPES[r.type]?.sling) r.where += `, ${fx(Math.max(...r.angs), 0)}° from vertical`; if (r.comp) r.where += ` · compression ${fx(r.comp, 2)} t`; r.util = r.swl ? r.load / r.swl * 100 : null; delete r.angs; });
  // one callout per row, on the right-hand / front part of the rig (leaders don't cross the drawing)
  rows.forEach(r => { const ps = inst.filter(x => r.entries.includes(x.e)).map(x => x.p), p = ps.reduce((m, q) => !m || q[0] + q[1] * 0.01 > m[0] + m[1] * 0.01 ? q : m, null) || r.pos; partsAt.push({ key: "wb", i: 0, entry: r.entry, row: r.no, p }); });
  for (const r of rows) if (r.util != null && r.util > 100) warn.push(`${r.name}: ${fx(r.load, 2)} t is over its ${fx(r.swl, 2)} t SWL`);
  // connections, leg by leg (what is above → the parts → what is below)
  const seenChk = new Set();
  try { for (const n of T.nodes) for (const e of n._ends || []) { const above = n.kind === "beam" ? "padeye" : (n.parts || []).slice(-1)[0] || "crane", below = e.L.to?.pt ? "lug" : N.get(e.L.to?.node)?.kind === "beam" ? "padeye" : (N.get(e.L.to?.node)?.parts || [])[0] || "padeye";
      for (const c of chainChecks(e.L.parts || [], above, below, {})) if (c.text && !seenChk.has(c.text)) { seenChk.add(c.text); checks.push(c); } } } catch (err) { }
  if (W > 0 && !lpPts.length) warn.push("Workbench: no leg reaches a lifting point yet");
  const weight = rows.reduce((a, r) => a + (r.weight || 0), 0), hp = root._top || [0, 0, lz + 5];
  const ptsDraw = (ld.pts || []).map(p => ({ k: p.k, p: TT([p.x, p.y, p.wrap ? d.z : p.z]), wrap: p.wrap }));
  R._geom = { beam: beams[0] || null };
  return { tree: true, build: true, hornX: 0, hornN: 0, nTop: 0, lpPts, wrap: false, fix: null, rows, notes, warn, weight, hookZ: hp[2], hookPts: [hp], seg, shk, links, hooks, pads, beam: beams[0] || null, beams, topLen: chainLenFull(root.parts || []), checks, wraps: [], ptsDraw, shares: null, tilt: TT.deg, partsAt };
}
{ const _sr = solveRig; solveRig = function (ld, ...a) { if (wbIsTree(ld)) { try { return solveTree(ld); } catch (e) { console.warn(e); return null; } } return _sr.call(this, ld, ...a); }; }
{ const _rp = rigParts; rigParts = function (ld, res) { if (res?.tree) return res.partsAt || []; return _rp(ld, res); }; }
if (typeof RIG_ARR !== "undefined") RIG_ARR.tree = { name: "Workbench – any arrangement", legs: 2 };
{ const _ic = rigArrIcon; rigArrIcon = function (arr) { if (arr !== "tree") return _ic(arr);
    return `<svg viewBox="-2 0 4 4" width="44" height="40"><g stroke="#e0701f" stroke-width=".12" fill="none"><path d="M0 .3v.5M0 .8L-1.2 1.6M0 .8L1.2 1.6"/><rect x="-1.5" y="1.6" width="3" height=".25" fill="#f2c200" stroke="#5a4a00" stroke-width=".05"/><path d="M-1.2 1.85v.4M1.2 1.85v.4M-1.2 2.25L-1.7 2.9M-1.2 2.25L-.7 2.9M1.2 2.25L.7 2.9M1.2 2.25L1.7 2.9"/><rect x="-1.9" y="2.9" width="3.8" height=".7" fill="#dfe4e9" stroke="#6b7682" stroke-width=".05"/></g></svg>`; }; }

// ---------------- from the rigging you have to the workbench ----------------
function wbFromRig(ld) {
  const R0 = ld.rig || {}, cl = x => x ? clone(x) : x, cls = L => (L || []).map(cl);
  if (R0.arr === "build" && R0.chain) compileChain(R0, ld);
  if (+R0.cranes === 2 || R0.arr === "tandem") return null;
  const res = solveRig(ld), pts = allPts(ld).filter(p => !/^C$/.test(p.k));
  const keyAt = p => { let best = null, bd = 1e9; for (const q of pts) { const dd = Math.hypot(q.x - p[0], (q.y || 0) - p[1]); if (dd < bd) { bd = dd; best = q.k; } } return best; };
  const LP = (res?.lpPts || []).map(p => ({ p, k: keyAt(p) })).filter(x => x.k);
  const nodes = [], root = { id: wbId(), kind: "hook", parts: cls(R0.top), legs: [] }; nodes.push(root);
  const splitLink = list => { const i = (list || []).map(e => e.snap.type).lastIndexOf("masterlink"); return i < 0 ? { leg: cls(list), node: [] } : { leg: cls(list.slice(0, i)), node: cls(list.slice(i)) }; };
  if (R0.legTo === "beam" && R0.beam) {
    const pTop = (res.pads || []).filter(p => p[3] === "top" && Math.abs(p[1]) < 0.05), pLow = (res.pads || []).filter(p => p[3] === "low" && Math.abs(p[1]) < 0.05);
    const zTop = pTop.length ? Math.max(...pTop.map(p => p[2])) : 0, tops = pTop.filter(p => Math.abs(p[2] - zTop) < 0.05).map(p => p[0]).sort((a, b) => a - b), zLow = zTop - WB_H, lows = pLow.filter(p => Math.abs(p[2] - zLow) < 0.05).map(p => p[0]).sort((a, b) => a - b);
    const xc = tops.length ? (tops[0] + tops[tops.length - 1]) / 2 : 0;
    const B = { id: wbId(), kind: "beam", beam: cl(R0.beam), axis: 0, top: tops.map(x => +(x - xc).toFixed(3)), bot: lows.map(x => +(x - xc).toFixed(3)), legs: [] }; nodes.push(B);
    B.top.forEach((_, k) => root.legs.push({ id: wbId(), parts: cls(R0.leg), to: { node: B.id, pad: k } }));
    const side = x => x < xc ? -1 : 1;
    B.bot.forEach((o, k) => { const mine = LP.filter(q => side(q.p[0]) === side(o + xc) || B.bot.length === 1);
      if (R0.xbeam && R0.beam2) {
        const s = splitLink(R0.pad), J = { id: wbId(), kind: "join", parts: s.node, legs: [] }; nodes.push(J); B.legs.push({ id: wbId(), from: k, parts: s.leg, to: { node: J.id } });
        const b2 = R0.b2 || {}, sp = +b2.padSpan || +ld.spanY || 5, ts = +b2.topSpan || sp;
        const X = { id: wbId(), kind: "beam", beam: cl(R0.beam2), axis: 90, top: [-ts / 2, ts / 2], bot: [-sp / 2, sp / 2], legs: [] }; nodes.push(X);
        [0, 1].forEach(t => J.legs.push({ id: wbId(), parts: cls(R0.drop), to: { node: X.id, pad: t } }));
        [0, 1].forEach(t => { const q = mine.find(x => (x.p[1] < 0) === (t === 0)) || mine[t] || mine[0]; if (q) X.legs.push({ id: wbId(), from: t, parts: [...cls(R0.pad2), ...cls(R0.drop2)], to: { pt: q.k } }); });
      } else if (mine.length > 1 && (R0.pad || []).length) {
        const J = { id: wbId(), kind: "join", parts: cls(R0.pad), legs: [] }; nodes.push(J); B.legs.push({ id: wbId(), from: k, parts: [], to: { node: J.id } });
        mine.forEach(q => J.legs.push({ id: wbId(), parts: cls(R0.drop), to: { pt: q.k } }));
      } else mine.forEach(q => B.legs.push({ id: wbId(), from: k, parts: [...cls(R0.pad), ...cls(R0.drop)], to: { pt: q.k } }));
    });
  } else LP.forEach(q => root.legs.push({ id: wbId(), parts: cls(R0.leg), to: { pt: q.k } }));
  if (!root.legs.length) { const a = pts.find(p => p.k === "A"), b = pts.find(p => p.k === "B"); [a, b].filter(Boolean).forEach(p => root.legs.push({ id: wbId(), parts: [wbNew("sling_round", ld)], to: { pt: p.k } })); }
  return { arr: "tree", tree: { root: root.id, nodes }, prev: clone(R0), share4: R0.share4 || 3, top: [], leg: [], lower: [] };
}
function wbNew(kind, ld, W) { const w = Math.max(1, W ?? (+ld.weight || 5) / 2); if (kind === "spreader") { const e = rigEntry(pickItem("spreader", +ld.weight || 5)); return e; }
  const it = pickItem(kind, w, kind === "shackle" ? std : null) || rigLibrary().find(i => i.type === kind); const e = rigEntry(it); if (RIG_TYPES[kind]?.sling) e.len = 3; return e; }

// ---------------- the workbench panel (in the rigging window) ----------------
const WB = { same: true };
function wbChoices(e, load, daf) {   // the items you could use here, best first: in the green, lightest rating that does it
  const sl = !!RIG_TYPES[e.snap.type]?.sling, fam = t => RIG_TYPES[t]?.sling ? "sling" : t, need = (load || 0) * daf;
  return rigLibrary().filter(i => (sl ? fam(i.type) === "sling" : i.type === e.snap.type) && +i.swl > 0).map(i => ({ i, use: need / i.swl * 100 }))
    .sort((a, b) => ((a.use > RIG_GREEN) - (b.use > RIG_GREEN)) || (a.use <= RIG_GREEN && b.use <= RIG_GREEN ? a.i.swl - b.i.swl : a.use - b.use) || ((+a.i.weight || 0) - (+b.i.weight || 0)));
}
function wbPanelHTML(ld, R, res) {
  const T = R.tree, N = new Map(T.nodes.map(n => [n.id, n])), daf = typeof rcDaf === "function" ? rcDaf(ld) : 1.1, rowOf = e => res?.rows.find(r => (r.entries || [r.entry]).includes(e));
  const pts = allPts(ld), ptOpts = sel => pts.map(p => `<option value="pt:${escH(p.k)}" ${sel === "pt:" + p.k ? "selected" : ""}>${escH(p.name)}</option>`).join("");
  const nodeName = n => n.kind === "hook" ? "Crane hook" : n.kind === "beam" ? `Spreader – ${escH(n.beam?.snap?.name || "")}` : `Junction – ${escH(n.parts?.[0]?.snap?.name || "")}`;
  const useChip = r => r && r.util != null ? `<span class="wbuse ${r.load * daf > r.swl ? "bad" : r.load * daf / r.swl * 100 > RIG_GREEN ? "warn" : ""}" title="load share ${fx(r.load, 2)} t × DAF ${fx(daf, 2)} = ${fx(r.load * daf, 2)} t on ${fx(r.swl, 1)} t">${fx(r.load, 1)} t · ${fx(r.load * daf / r.swl * 100, 0)}%</span>` : "";
  const partRow = (e, path, k, list) => { const r = rowOf(e), sl = !!RIG_TYPES[e.snap.type]?.sling, ch = wbChoices(e, r?.load || 0, daf).slice(0, 40);
    return `<div class="wbp" data-wbp="${path}" data-k="${k}"><select data-wbitem>${rigItem(e.id) ? "" : `<option selected>${escH(e.snap.name)} (saved)</option>`}${ch.map(c => `<option value="${escH(c.i.id)}" ${c.i.id === e.id ? "selected" : ""}>${escH(c.i.name)}${r ? ` – ${fx(c.use, 0)}%${c.use > 100 ? " ✕" : c.use > RIG_GREEN ? " !" : ""}` : ""}</option>`).join("")}</select>
      ${sl ? `<label class="wbl">m<input type="number" step="0.5" min="0.5" data-wblen value="${+e.len || 0}"></label>` : ""}${useChip(r)}<button class="rmv" data-wbup ${k ? "" : "disabled"}>▲</button><button class="rmv" data-wbdel>×</button></div>`; };
  const addBar = path => `<span class="wbadd" data-wbadd="${path}">+ Add <select data-wbaddk><option value="">add part…</option>${[["sling_round", "Round sling"], ["sling_wire", "Wire rope sling"], ["sling_chain", "Chain sling"], ["sling_web", "Webbing sling"], ["shackle", "Shackle"], ["masterlink", "Master link"], ["hook", "Hook"], ["loadcell", "Load cell"], ["swivel", "Swivel"]].map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></span>`;
  const drawn = new Set();
  const legHTML = (n, L, j) => { const tn = L.to?.node ? N.get(L.to.node) : null, val = L.to?.pt ? "pt:" + L.to.pt : tn ? (tn.kind === "beam" ? `bm:${tn.id}:${+L.to.pad || 0}` : `jn:${tn.id}`) : "";
    const beams = T.nodes.filter(m => m.kind === "beam" && m.id !== n.id), joins = T.nodes.filter(m => m.kind === "join" && m.id !== n.id && m.id !== T.root);
    const r = res?.rows && L.parts?.length ? null : null, ang = (() => { const x = (res?.seg || []).find(s => s.e && (L.parts || []).includes(s.e)); if (!x) return ""; const dd = Math.hypot(x.a[0] - x.b[0], x.a[1] - x.b[1]), dz = Math.abs(x.a[2] - x.b[2]) || 1e-6; return `${fx(Math.atan2(dd, dz) / D2R, 1)}° from vertical`; })();
    let h = `<div class="wbleg" data-wbleg="${n.id}:${L.id}"><div class="wblh"><b>Leg ${j + 1}</b>${n.kind === "beam" ? ` from bottom padeye <select data-wbfrom>${(n.bot || [0]).map((o, k) => `<option value="${k}" ${+L.from === k ? "selected" : ""}>${k + 1} (${fx(o, 2)} m)</option>`).join("")}</select>` : ""}
      <span class="wbang">${ang}</span><button class="rmv" data-wbcopy title="Another leg like this">⧉</button><button class="rmv" data-wblegdel title="Remove this leg">×</button></div>
      <div class="wbparts">${(L.parts || []).map((e, k) => partRow(e, `${n.id}:${L.id}`, k, L.parts)).join("") || `<p class="bnote">No parts – it joins straight on.</p>`}${addBar(`${n.id}:${L.id}`)}</div>
      <label class="wbto">Goes to <select data-wbto><option value="">– choose –</option><optgroup label="Lifting points">${ptOpts(val)}</optgroup>
        ${beams.length ? `<optgroup label="A spreader's top padeye">${beams.flatMap(m => (m.top || [0]).map((o, k) => `<option value="bm:${m.id}:${k}" ${val === `bm:${m.id}:${k}` ? "selected" : ""}>${escH(m.beam?.snap?.name || "Spreader")} – top padeye ${k + 1}</option>`)).join("")}</optgroup>` : ""}
        ${joins.length ? `<optgroup label="A junction">${joins.map(m => `<option value="jn:${m.id}" ${val === "jn:" + m.id ? "selected" : ""}>${escH(m.parts?.[0]?.snap?.name || "Junction")}</option>`).join("")}</optgroup>` : ""}
        <optgroup label="Something new"><option value="new:join">A new junction (master link / shackle) – legs spread from it</option><option value="new:beam0">A new spreader along the load</option><option value="new:beam90">A new spreader turned across the load</option></optgroup></select></label></div>`;
    if (tn && !drawn.has(tn.id) && (tn.kind !== "beam" || !(n.legs || []).slice(0, j).some(x => x.to?.node === tn.id))) h += `<div class="wbkid">${nodeHTML(tn)}</div>`;
    return h; };
  const nodeHTML = n => { if (drawn.has(n.id)) return ""; drawn.add(n.id); const br = res?.rows.find(r => (r.entries || [r.entry]).includes(n.beam));
    let h = `<div class="wbnode ${n.kind}" data-wbnode="${n.id}"><div class="wbnh"><b>${nodeName(n)}</b>${n.id !== T.root ? `<button class="rmv" data-wbnodedel title="Remove it (and what hangs from it)">×</button>` : ""}</div>`;
    if (n.kind === "beam") { const Tb = typeof tableOf === "function" && n.beam ? tableOf(n.beam) : null;
      h += `<div class="wbbeam"><select data-wbbeam>${rigItem(n.beam?.id) ? "" : `<option selected>${escH(n.beam?.snap?.name || "")} (saved)</option>`}${itemOptions(n.beam?.id, it => it.type === "spreader")}</select>${useChip(br)}
        <label>Turned<select data-wbaxis><option value="0" ${!n.axis ? "selected" : ""}>along the load</option><option value="90" ${n.axis ? "selected" : ""}>across the load</option></select></label>
        <label>Top padeyes (m from centre)<input type="text" data-wbtop value="${escH((n.top || []).join(", "))}"></label><label>Bottom padeyes (m from centre)<input type="text" data-wbbot value="${escH((n.bot || []).join(", "))}"></label>
        ${Tb ? `<p class="bnote" style="grid-column:1/-1">Maker's table: built to ${escH(tSpanTxt(Math.max(...(n.bot || [1]).map(Math.abs)) * 2, Tb))} span – padeyes on that span.</p>` : ""}</div>`; }
    else h += `<div class="wbparts">${(n.parts || []).map((e, k) => partRow(e, n.id, k, n.parts)).join("")}${addBar(n.id)}</div>`;
    h += (n.legs || []).map((L, j) => legHTML(n, L, j)).join("");
    h += `<button class="badd" data-wbaddleg="${n.id}">+ Leg ${n.kind === "beam" ? "from a bottom padeye" : "from here"}</button></div>`;
    return h; };
  return `<div class="wb"><div class="wbhd"><b>Workbench</b><span class="bnote">Any arrangement: the hook at the top, then legs, junctions and spreaders (turned any way) down to the lifting points. The forces, angles and use of every part update as you change it; each item list is in order of what suits it best.</span>
    <label class="chk"><input type="checkbox" id="wbSame" ${WB.same ? "checked" : ""}> A change to a part goes to every leg that has the same parts</label>
    ${R.prev ? `<button id="wbBack">Back to the simple list</button>` : ""}</div>${nodeHTML(N.get(T.root))}
    ${T.nodes.filter(n => !drawn.has(n.id)).map(n => `<div class="status bad">Not hung from anything: ${nodeName(n)}</div>${nodeHTML(n)}`).join("")}</div>`;
}
{ const st = document.createElement("style"); st.textContent = `.wb{display:flex;flex-direction:column;gap:6px}.wbhd{display:flex;flex-direction:column;gap:4px;margin-bottom:4px}
.wbnode{border:1px solid var(--line,#d5dbe1);border-radius:8px;padding:6px 8px;background:var(--panel,#fff)}.wbnode.beam{border-color:#d4a800;background:rgba(242,194,0,.06)}.wbnode.join{border-color:#b8860b}
.wbnh{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px}.wbleg{border-left:3px solid var(--accent,#d9661f);margin:6px 0 4px 6px;padding:2px 0 2px 8px}
.wblh{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px}.wbang{color:var(--muted);font-size:11.5px;margin-left:auto}.wbkid{margin:4px 0 2px 14px}
.wbp{display:flex;align-items:center;gap:4px;margin:3px 0}.wbp select{flex:1;min-width:0}.wbl{display:flex;align-items:center;gap:2px;font-size:11px}.wbl input{width:58px}
.wbuse{font-size:11px;padding:1px 6px;border-radius:9px;background:#e3f4ea;color:#1e7a3c;white-space:nowrap}.wbuse.warn{background:#fff1dc;color:#a15c00}.wbuse.bad{background:#fde4e1;color:#b42318}
.wbbeam{display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;align-items:end}.wbbeam select[data-wbbeam]{grid-column:1/-1}.wbto{display:block;font-size:12px;margin:3px 0}
.wb .wbp{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto auto;gap:4px;align-items:center}.wb .wbp select{width:100%;min-width:0}
.wb label.wbl{display:flex;flex-direction:row;align-items:center;gap:3px;margin:0;font-size:11px}.wb label.wbl input{width:62px;margin:0}
.wb .wbadd{display:flex;align-items:center;gap:4px;margin:2px 0;font-size:12px;color:var(--muted)}.wb .wbadd select{width:auto;font-size:12px;padding:2px 6px}
.wb .wblh select{width:auto;padding:1px 4px;font-size:12px}.wb .wbleg .wblh .rmv,.wb .wbp .rmv{padding:1px 6px}.wb .wbuse{justify-self:end}`; document.head.append(st); }
// in the rigging window: the workbench takes the place of the list when the rigging is a workbench rigging
{ const _rb = renderRB; renderRB = function (...a) {
    const ld0 = RB.work; if (wbIsTree(ld0)) { if (typeof QB !== "undefined") QB.detail = true; for (const k of ["top", "leg", "lower"]) if (!Array.isArray(ld0.rig[k])) ld0.rig[k] = []; }   // the workbench is its own editor (not the simple builder) if (ld0?.rig?.arr === "tree" && !wbIsTree(ld0)) { const t = wbFromRig({ ...ld0, rig: ld0.rig.prev || { arr: "build", chain: [] } }); if (t) ld0.rig = t; }
    const r = _rb.apply(this, a);
    try { const ld = RB.work, R = ld.rig, left = $("rbLeft");
      // a way in from any rigging
      const arr = left.querySelector(".rarr"); if (arr && !arr.querySelector('[data-arr="tree"]') && R.arr !== "tree") arr.insertAdjacentHTML("beforeend", `<button class="ltype" data-arr="tree" aria-pressed="false">${rigArrIcon("tree")}${RIG_ARR.tree.name}</button>`);
      if (!wbIsTree(ld) && +R.cranes !== 2 && R.arr !== "tandem" && !left.querySelector(".wbin")) left.insertAdjacentHTML("afterbegin", `<div class="wbin status"><b>Need an arrangement the list can't make?</b> <button data-arr="tree">Open it on the workbench</button> <span class="small">– any number of junctions and spreaders, turned any way; your rigging comes across as it is.</span></div>`);
      if (!wbIsTree(ld)) return r;
      const res = solveRig(ld), mark = [...left.children].find(el => /Where it connects on the load/.test(el.textContent || ""));
      if (mark) { while (mark.nextSibling) mark.nextSibling.remove(); mark.insertAdjacentHTML("afterend", wbPanelHTML(ld, R, res)); }
      // the standard set-ups fold away while on the workbench (choosing one leaves the workbench)
      const pre = [...left.children].find(el => /Start from a set-up/.test(el.querySelector(".rh")?.textContent || "")), arr2 = left.querySelector(".rarr");
      if (pre && arr2 && !pre.closest("details")) { const dd = document.createElement("details"); dd.className = "bswitch"; dd.innerHTML = `<summary>Start again from a set-up · <span>this replaces the workbench rigging</span></summary>`; pre.before(dd); dd.append(pre, arr2); }
      wbWire(ld, R);
    } catch (e) { console.warn(e); }
    return r; }; }
// into the workbench: from the rigging as it is now (nothing is lost – "Back to the simple list" returns to it)
document.addEventListener("click", e => { const b = e.target.closest('#rbLeft [data-arr="tree"]'); if (!b || !RB.work) return; if (typeof openWorkbench === "function") return;   // the workbench on the drawing takes it
  e.preventDefault(); e.stopImmediatePropagation();
  const ld = RB.work; if (wbIsTree(ld)) return; try { if (typeof stdToBuild === "function") stdToBuild(ld); } catch (err) { }
  if (typeof QB !== "undefined") QB.detail = true; delete ld.rig.q;
  const t = wbFromRig(ld); if (!t) { toast("The workbench is for one crane – a tandem lift stays in the list"); return; } delete ld.rig.auto; ld.rig = t; renderRB(); toast("Your rigging is on the workbench – change anything; the forces follow"); }, true);
function wbWire(ld, R) {
  const T = R.tree, N = id => wbNode(T, id), root = $("rbLeft").querySelector(".wb"); if (!root) return;
  const redo = () => { delete R.auto; renderRB(); };
  const listAt = path => { const [nid, lid] = path.split(":"), n = N(nid); if (!n) return null; if (!lid) return n.parts || (n.parts = []); const L = (n.legs || []).find(x => x.id === lid); return L ? (L.parts || (L.parts = [])) : null; };
  const sig = list => (list || []).map(e => e.id + "/" + (+e.len || "")).join(",");
  const twins = (path, k) => { const me = listAt(path); if (!WB.same || !me) return [me]; const s = sig(me), out = [];
    for (const n of T.nodes) { if (!path.includes(":") && sig(n.parts) === s && n.kind === N(path.split(":")[0])?.kind) out.push(n.parts); for (const L of n.legs || []) if (path.includes(":") && sig(L.parts) === s) out.push(L.parts); }
    return out.length ? out : [me]; };
  if ($("wbSame")) $("wbSame").onchange = e => { WB.same = e.target.checked; };
  if ($("wbBack")) $("wbBack").onclick = () => { ld.rig = R.prev; delete ld.rig.prev; redo(); };
  root.querySelectorAll(".wbp").forEach(row => { const path = row.dataset.wbp, k = +row.dataset.k, list = listAt(path), e = list?.[k]; if (!e) return;
    const sel = row.querySelector("[data-wbitem]"); if (sel) sel.onchange = () => { const it = rigItem(sel.value); if (!it) return; for (const Ls of twins(path, k)) { const x = Ls[k]; if (!x) continue; const n2 = rigEntry(it); x.id = n2.id; x.snap = n2.snap; if (!RIG_TYPES[it.type]?.sling) x.len = n2.len; else if (!(+x.len > 0)) x.len = 3; } redo(); };
    const len = row.querySelector("[data-wblen]"); if (len) len.onchange = () => { const v = +len.value; if (!(v > 0)) return; for (const Ls of twins(path, k)) if (Ls[k]) Ls[k].len = v; redo(); };
    row.querySelector("[data-wbdel]").onclick = () => { for (const Ls of twins(path, k)) Ls.splice(k, 1); redo(); };
    const upb = row.querySelector("[data-wbup]"); if (upb) upb.onclick = () => { if (!k) return; for (const Ls of twins(path, k)) { const t = Ls[k - 1]; Ls[k - 1] = Ls[k]; Ls[k] = t; } redo(); }; });
  root.querySelectorAll("[data-wbadd]").forEach(sp => { const s = sp.querySelector("select"); s.onchange = () => { const kind = s.value; if (!kind) return; const path = sp.dataset.wbadd, me = listAt(path), group = WB.same ? twins(path, 0) : [me];
      const r = solveRig(ld), row = r?.rows.find(x => (x.entries || []).some(e => (me || []).includes(e))), load = row ? row.load : (+ld.weight || 5) / 2;
      for (const Ls of group) Ls.push(wbNew(kind, ld, load)); redo(); }; });
  root.querySelectorAll("[data-wbleg]").forEach(box => { const [nid, lid] = box.dataset.wbleg.split(":"), n = N(nid), L = (n?.legs || []).find(x => x.id === lid); if (!L) return;
    const to = box.querySelector("[data-wbto]"); to.onchange = () => { const v = to.value; if (!v) return;
      if (v.startsWith("pt:")) L.to = { pt: v.slice(3) };
      else if (v.startsWith("bm:")) { const [, id, k] = v.split(":"); L.to = { node: id, pad: +k }; }
      else if (v.startsWith("jn:")) L.to = { node: v.slice(3) };
      else if (v === "new:join") {   // a junction at the bottom of this leg: the leg ends on it, and a leg carries on from it to where this one went
        const J = { id: wbId(), kind: "join", parts: [wbNew("masterlink", ld)], legs: [] }, old = L.to;
        J.legs.push({ id: wbId(), parts: [wbNew("sling_round", ld), wbNew("shackle", ld)], to: old?.pt || old?.node ? clone(old) : { pt: (allPts(ld).find(p => p.k !== "C") || {}).k } });
        T.nodes.push(J); L.to = { node: J.id }; }
      else if (v.startsWith("new:beam")) {   // a spreader under this node: it takes over the legs that went from here to lifting points
        const ax = +v.slice(8) || 0, u = ax ? [0, 1] : [1, 0], P = new Map(allPts(ld).map(p => [p.k, p]));
        let pl = (n.legs || []).filter(x => x.to?.pt && P.get(x.to.pt)); if (!pl.length && L.to?.pt) pl = [L];
        const at = x => { const p = P.get(x.to.pt); return p.x * u[0] + (p.y || 0) * u[1]; }; pl.sort((x, y) => at(x) - at(y));
        const sp = pl.length > 1 ? Math.max(0.5, Math.round((at(pl[pl.length - 1]) - at(pl[0])) * 100) / 100) : (ax ? (+ld.spanY || 4) : (+ld.span || 4)), r0 = solveRig(ld), Vb = (r0?.rows || []).find(x => (x.entries || []).includes((L.parts || [])[0]))?.load * 2 || (+ld.weight || 5);
        const B = { id: wbId(), kind: "beam", beam: wbNew("spreader", ld), axis: ax, top: [-sp / 2, sp / 2], bot: pl.length > 1 ? pl.map(x => +(at(x) - (at(pl[0]) + at(pl[pl.length - 1])) / 2).toFixed(3)) : [-sp / 2, sp / 2], legs: [] };
        { const need = Vb * (typeof rcDaf === "function" ? rcDaf(ld) : 1.1) / (RIG_GREEN / 100), c = rigLibrary().filter(i => i.type === "spreader" && !i.pad && ((+i.len || 0) >= sp - 0.01 || i.table || i.adjust) && +i.swl >= need)
            .sort((x, y) => (+x.len || 99) - (+y.len || 99) || x.swl - y.swl), it = c[0]; if (it) B.beam = rigEntry(it); B.beam.len = it?.table || it?.adjust ? sp : Math.max(+B.beam.len || 0, sp); }
        const lugShk = (L.parts || []).filter(e => e.snap.type === "shackle").slice(-1)[0];
        (pl.length ? pl : [L]).forEach((x, k) => B.legs.push({ id: wbId(), from: Math.min(k, B.bot.length - 1), parts: [wbNew("shackle", ld, Vb / 2), Object.assign(wbNew("sling_round", ld, Vb / 2), { len: 3 }), ...(lugShk ? [clone(lugShk)] : [wbNew("shackle", ld, Vb / 2)])], to: x.to?.pt ? { pt: x.to.pt } : clone(x.to || {}) }));
        T.nodes.push(B); const keep = (n.legs || []).filter(x => !pl.includes(x) && x !== L), parts = clone(L.parts || []);
        n.legs = [...keep, { id: wbId(), parts, to: { node: B.id, pad: 0 } }, { id: wbId(), parts: clone(parts), to: { node: B.id, pad: 1 } }]; }
      wbPrune(T); redo(); };
    const fr = box.querySelector("[data-wbfrom]"); if (fr) fr.onchange = () => { L.from = +fr.value; redo(); };
    box.querySelector("[data-wbcopy]").onclick = () => { const used = new Set(T.nodes.flatMap(m => (m.legs || []).filter(x => x.to?.pt).map(x => x.to.pt))), free = allPts(ld).find(p => p.k !== "C" && !used.has(p.k));
      n.legs.push({ id: wbId(), from: L.from, parts: clone(L.parts || []), to: L.to?.pt && free ? { pt: free.k } : clone(L.to || {}) }); redo(); };
    box.querySelector("[data-wblegdel]").onclick = () => { n.legs = n.legs.filter(x => x !== L); wbPrune(T); redo(); }; });
  root.querySelectorAll("[data-wbaddleg]").forEach(b => b.onclick = () => { const n = N(b.dataset.wbaddleg); if (!n) return; const used = new Set(T.nodes.flatMap(m => (m.legs || []).filter(x => x.to?.pt).map(x => x.to.pt))), free = allPts(ld).find(p => p.k !== "C" && !used.has(p.k)) || allPts(ld)[0];
    const last = (n.legs || []).slice(-1)[0]; (n.legs = n.legs || []).push({ id: wbId(), from: 0, parts: last ? clone(last.parts) : [wbNew("sling_round", ld), wbNew("shackle", ld)], to: free ? { pt: free.k } : {} }); redo(); });
  root.querySelectorAll("[data-wbnode]").forEach(box => { const n = N(box.dataset.wbnode); if (!n) return;
    const del = box.querySelector(":scope > .wbnh [data-wbnodedel]"); if (del) del.onclick = () => { for (const m of T.nodes) m.legs = (m.legs || []).filter(x => x.to?.node !== n.id); T.nodes = T.nodes.filter(m => m !== n); wbPrune(T); redo(); };
    if (n.kind !== "beam") return;
    const bs = box.querySelector(":scope > .wbbeam [data-wbbeam]"), ax = box.querySelector(":scope > .wbbeam [data-wbaxis]"), tp = box.querySelector(":scope > .wbbeam [data-wbtop]"), bt = box.querySelector(":scope > .wbbeam [data-wbbot]");
    const nums = s => String(s).split(/[,;\s]+/).filter(Boolean).map(Number).filter(x => isFinite(x));
    if (bs) bs.onchange = () => { const it = rigItem(bs.value); if (!it) return; const n2 = rigEntry(it); n.beam = { ...n2, len: Math.max(+it.len || 0, ...(n.bot || [0]).map(x => Math.abs(x) * 2)) }; redo(); };
    if (ax) ax.onchange = () => { n.axis = +ax.value; redo(); };
    if (tp) tp.onchange = () => { const v = nums(tp.value); if (v.length) n.top = v; redo(); };
    if (bt) bt.onchange = () => { const v = nums(bt.value); if (v.length) { n.bot = v; for (const L of n.legs || []) if (+L.from >= v.length) L.from = v.length - 1; } redo(); }; });
}
// nodes nothing hangs from any more are dropped
function wbPrune(T) { let ch = true; while (ch) { ch = false; const used = new Set([T.root, ...T.nodes.flatMap(n => (n.legs || []).filter(L => L.to?.node).map(L => L.to.node))]); const keep = T.nodes.filter(n => used.has(n.id)); if (keep.length !== T.nodes.length) { T.nodes = keep; ch = true; } } }

// the simple builder offers the workbench too (wrapped once everything is loaded)
window.addEventListener("load", () => { if (typeof qrPanelHTML !== "function") return; const _qp = qrPanelHTML; qrPanelHTML = function (ld, ...a) { const h = _qp.call(this, ld, ...a); return +ld?.rig?.cranes === 2 || ld?.rig?.arr === "tandem" ? h : h.replace('<button id="qrStart">', '<button data-arr="tree">Open it on the workbench</button><button id="qrStart">'); }; });
