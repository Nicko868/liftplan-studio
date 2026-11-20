// ================= Rigging – the simple builder =================
// Pick how the load is rigged (arrangement), how it is held (shackles, hooks, choke, basket) and the sling type.
// The app works out the lengths from the lifting points, sizes every part from YOUR library (your own gear first,
// lightest part that runs at ≤ 90 %) and re-sizes by itself when the load changes. Any part you choose is Fixed and
// never changed. Underneath it writes the same rigging list the detailed editor uses, so drawings, checks, sheets,
// 3D and the planner all work from it unchanged.
const QR_TARGET = 0.9;
const QR_ARR = [
  { k: "single", name: "Single leg", pts: [1], icon: "M23 3v31", why: "One lifting point over the centre of gravity – one sling straight down." },
  { k: "2leg", name: "2-leg sling", pts: [2], icon: "M23 3v6M23 9L9 34M23 9l14 25", why: "Simplest for two lifting points. The legs angle in, so a long load needs long slings and more headroom." },
  { k: "4leg", name: "4-leg sling", pts: [4], icon: "M23 3v6M23 9L6 34M23 9L16 34M23 9l7 25M23 9l17 25", why: "Containers, skids, frames – one sling set on four points (checked as 3 legs carrying the load)." },
  { k: "spread", name: "Spreader beam", pts: [2, 4], icon: "M23 3v5M23 8L8 18M23 8l15 10M6 18h34M8 18v16M38 18v16", why: "The drop legs hang straight down, so nothing is squeezed – reels, long or soft loads." },
  { k: "lbeam", name: "Lifting beam", pts: [2, 4], icon: "M23 3v11M6 14h34M8 14v20M38 14v20", why: "Least headroom – the beam hangs straight off the hook, no top legs." },
  { k: "tandem", name: "Two cranes", pts: [2], icon: "M10 3v31M36 3v31M5 34h36", why: "Each crane takes its own end – each crane's share follows the centre of gravity." },
  { k: "bagspread", name: "Spreader to the bags", bag: true, icon: "M23 3v5M23 8L8 16M23 8l15 8M6 16h34M9 16v14M17 16v14M29 16v14M37 16v14", why: "One drop to each bag from a row of padeyes – the usual way to lift a row of bulk bags." },
  { k: "baglegs", name: "A leg to each bag", bag: true, icon: "M23 3v6M23 9L8 30M23 9l-5 21M23 9l5 21M23 9l15 21", why: "Up to four bags, one sling leg each, hooks in the loops." }
];
const QR_SLING = { round: ["sling_round", "Round sling"], wire: ["sling_wire", "Wire rope"], chain: ["sling_chain", "Chain"] };
const QR_HOLD = { shackle: ["Shackles on lugs", "a shackle at each lifting lug / padeye"], hook: ["Hooks", "a hook into each loop / corner casting"], choke: ["Choke", "sling choked round the load"], basket: ["Basket", "sling under the load, both eyes up"] };
const qrPts = ld => ld.kind === "bag" && isBagGroup(ld) ? 0 : (ld.nLP ?? (+ld.spanY > 0 ? 4 : +ld.span > 0 ? 2 : 1));
// slings come in whole-metre lengths (change plan.site.slStep for another step)
const slStep = () => +plan?.site?.slStep > 0 ? +plan.site.slStep : 1;
const qrUp = (v, s = slStep()) => Math.ceil(v / s - 1e-6) * s;
const qrCranes = ld => (plan.cranes || []).filter(c => c.attach?.load === ld.id).length;
const qrMod = it => /modular|adjust|telescop/i.test(it?.name || "") || !!it?.adjust;
function qrArrOk(ld, k) {
  const A = QR_ARR.find(a => a.k === k); if (!A) return "Unknown arrangement";
  if (ld.kind === "bag" && isBagGroup(ld)) {
    if (!A.bag) return "A group of bags is lifted with a spreader to the bags or a leg to each bag";
    if (k === "baglegs") { const nx = Math.round(+ld.nx || 1), ny = Math.round(+ld.ny || 1); if (!((ny === 1 && nx <= 2) || (nx === 2 && ny === 2))) return "A leg to each bag works for 2 bags in a row or 2 × 2"; }
    if (k === "bagspread" && Math.round(+ld.ny || 1) > 4) return "At most 4 bags across under each padeye";
    return "";
  }
  if (A.bag) return "For groups of bulk bags";
  const n = qrPts(ld);
  if (k === "tandem" && n >= 2) return "";
  if (!A.pts.includes(n)) return `Needs ${A.pts.join(" or ")} lifting point${A.pts[0] > 1 ? "s" : ""} – this load has ${n}`;
  return "";
}
function qrAutoArr(ld) {
  if (ld.kind === "bag" && isBagGroup(ld)) return !qrArrOk(ld, "baglegs") ? "baglegs" : "bagspread";
  const n = qrPts(ld);
  if (qrCranes(ld) >= 2 && n === 2) return "tandem";
  if (n === 1) return "single";
  if (n === 4) return "4leg";
  return ld.kind === "reel" ? "spread" : "2leg";      // reels: a spreader keeps the flanges from being squeezed; elsewhere a 2-leg sling is simpler and needs less headroom
}
function qrAutoHold(ld) {
  if (ld.kind === "bag") return "hook";
  if (ld.lpType === "wrap") return "choke";
  return "shackle";
}
function qrAutoSling(ld, arr) {
  if (arr === "4leg" && ld.kind !== "bag") { const per = (+ld.weight || 1) / 3; return per <= 31.5 * QR_TARGET ? "chain" : "wire"; }
  return "round";
}
function qrNew(ld, arr) {
  const a = arr && !qrArrOk(ld, arr) ? arr : qrAutoArr(ld);
  return { v: 1, arr: a, hold: qrAutoHold(ld), sling: qrAutoSling(ld, a), top: null, drop: null, fixed: {}, fsnap: {}, pick: {} };
}
// the library, your own certified gear first: the lightest part that runs at or under 90 %
function qrPick(type, need, pref, byWeight) {
  const all = rigLibrary().filter(i => i.type === type && (!pref || pref(i))); if (!all.length) return null;
  const wt = i => (i.weight || 0) + (i.wpm || 0);
  const ord = l => l.slice().sort((a, b) => (a._rank || 0) - (b._rank || 0) || (byWeight ? wt(a) - wt(b) : 0) || a.swl - b.swl || wt(a) - wt(b));
  const mine = ord(all.filter(i => !i.builtin)), gen = ord(all.filter(i => i.builtin));
  return mine.find(i => i.swl * QR_TARGET >= need) || gen.find(i => i.swl * QR_TARGET >= need) || mine.find(i => i.swl >= need) || gen.find(i => i.swl >= need) || ord(all).sort((a, b) => b.swl - a.swl)[0];
}
{ const st = document.createElement("style"); st.textContent = `.qselrow{grid-area:sel;display:flex;gap:6px;align-items:center}.qselrow .qsel{flex:1;min-width:0}.qmult{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:4px;overflow:hidden;flex:0 0 auto}.qmult button{padding:2px 8px;font-size:13px;border:0;border-radius:0}.qmult b{padding:0 6px;font-size:12px;min-width:26px;text-align:center}`; document.head.append(st); }
// pieces side by side at a point: what you set, else 2 master links on a ramshorn hook (one on each horn)
function qrRamshorn(ld) { const cr = (plan.cranes || []).filter(c => c.attach?.load === ld.id && REG.cranes[c.model]); return cr.length === 1 && blockDims(cr[0], REG.cranes[cr[0].model]).type === "ramshorn"; }
function qrMultOf(ld, q, k) { const v = q.mult?.[k]; if (v != null) return Math.max(1, Math.round(+v)); return k === "ml" && qrRamshorn(ld) ? 2 : 1; }
// geometry the lengths come from
function qrGeom(ld, q) {
  const d = loadDims(ld), lz = liftPointZ(ld), n = qrPts(ld), grp = ld.kind === "bag" && isBagGroup(ld);
  const span = grp ? 0 : (n >= 2 ? Math.max(0.3, +ld.span || d.x * 0.7) : 0), spanY = !grp && n === 4 ? Math.max(0.3, +ld.spanY || d.y * 0.8) : 0;
  const round = roundSection(ld), girth = round ? Math.PI * d.z : 2 * (d.y + d.z), under = round ? Math.PI * d.z / 2 : d.y + 2 * d.z;
  const nx = Math.max(1, Math.round(+ld.nx || 1)), ny = Math.max(1, Math.round(+ld.ny || 1)), pitch = grp ? nz(ld.L) + Math.max(0, +ld.gap || 0) : 0, pitchY = grp ? nz(ld.W) + Math.max(0, +ld.gap || 0) : 0;
  const hold = ld.kind === "bag" ? "hook" : q.hold;
  // sling length for a wanted straight-line length (eff): a choke loses one girth, a basket goes under the load and doubles up
  const slLen = (eff, wrap) => qrUp(Math.max(1, wrap && hold === "choke" ? eff + girth : wrap && hold === "basket" ? 2 * eff + under : eff));
  return { d, lz, n, grp, span, spanY, round, girth, under, nx, ny, pitch, pitchY, hold, slLen };
}
// the parts, top → bottom, for an arrangement
function qrSlots(ld, q) {
  const G = qrGeom(ld, q), W = Math.max(0.1, +ld.weight || 1), [slType] = QR_SLING[q.sling] || QR_SLING.round, a = q.arr, sin30 = 0.5;
  const ownOr = f => i => !i.builtin || f(i);
  const P = {
    ml: ownOr(i => !/assembly|quad|sub-link/i.test(i.name)), ml4: ownOr(i => /assembly|quad|sub-link/i.test(i.name)),
    shk: ownOr(std), hook: ownOr(i => /Eye sling hook|Self-locking|S-320/i.test(i.name)),
    sl: i => !/grommet/i.test(i.name) || G.hold === "choke" || G.hold === "basket"
  };
  const end = (key, what, need) => G.hold === "shackle" ? [{ key, type: "shackle", pref: P.shk, need, what }] : G.hold === "hook" ? [{ key, type: "hook", pref: P.hook, need, what }] : [];
  const wrapH = G.hold === "choke" ? "choke" : G.hold === "basket" ? "basket" : "straight", wrap = wrapH !== "straight";
  const S = { A: [], B: null, cfg: null, beamPref: null, top: 0, drop: 0, legs: 1 };
  if (a === "single" || a === "tandem") {
    S.top = G.slLen(2, wrap);
    const one = (p, Wc) => [{ key: p + "ml", type: "masterlink", pref: P.ml, need: Wc, what: "on the crane hook" }, { key: p + "sl", type: slType, pref: P.sl, need: Wc, legs: 1, len: "top", hitch: wrapH, what: "sling" }, ...end(p + "end", "at the lifting point", Wc)];
    if (a === "single") S.A = [{ key: "sl", type: slType, pref: P.sl, need: W, legs: 1, len: "top", hitch: wrapH, what: "sling" }, ...end("end", "at the lifting point", W)];
    else { S.A = one("A", W * 0.6); S.B = one("B", W * 0.6); }
  } else if (a === "2leg" || a === "4leg" || a === "baglegs") {
    const legs = a === "4leg" ? 4 : a === "baglegs" ? bagN(ld) : 2;
    let reach = Math.hypot(G.span / 2, G.spanY / 2);
    if (a === "baglegs") { const c = bagCentres(ld); reach = Math.max(0.3, ...c.map(p => Math.hypot(p[0], p[1]))); }
    S.top = G.slLen(Math.max(1.5, reach / sin30), wrap && a !== "baglegs"); S.legs = legs;
    const per = W / Math.min(legs, legs === 4 ? 3 : legs) * 1.2;
    S.A = [{ key: "ml", type: "masterlink", pref: legs > 2 ? P.ml4 : P.ml, need: W, what: "on the crane hook" }, { key: "sl", type: slType, pref: P.sl, need: per, legs, len: "top", hitch: a === "baglegs" ? "straight" : wrapH, bagsPer: a === "baglegs" ? 1 : undefined, what: "legs" }, ...end("end", "at each lifting point", per)];
  } else {   // spread, lbeam, bagspread
    const bag = a === "bagspread", lb = a === "lbeam";
    // padeye spacing on the beam: the lifting-point spacing (straight drops) unless you set your own – a shorter or longer beam
    // than the lifting points makes the drops lean (out or in); the drop length then covers the lean
    const padN = bag ? G.nx : 2, perPad = bag ? Math.min(4, G.ny) : (G.n === 4 ? 2 : 1), padSpan = bag ? Math.round((G.nx - 1) * G.pitch * 100) / 100 : (+q.pads > 0 ? +q.pads : G.span);
    const lean = bag ? 0 : Math.abs(G.span - padSpan) / 2;
    const dropY = bag ? "" : (perPad === 2 ? G.spanY : "");
    const clear = Math.max(0.5, G.d.z - G.lz) + 0.6, acrossReach = bag ? (perPad > 1 ? (perPad - 1) * G.pitchY / 2 : 0) : (perPad === 2 ? G.spanY / 2 : 0);
    S.drop = G.slLen(Math.max(1.5, clear, acrossReach / sin30, Math.hypot(lean, acrossReach) / sin30), wrap && !bag);
    S.cfg = { padN, padSpan, topSpan: padSpan, perPad, bagsPer: 1, dropY };
    S.padSpan = padSpan;
    S.top = lb ? 0 : G.slLen(Math.max(2, Math.max(1, padSpan) / 2 / sin30), false); S.legs = 2;
    const nDrop = padN * perPad, perDrop = W / Math.max(1, Math.min(nDrop, nDrop >= 4 && !bag ? 3 : nDrop)) * 1.2;
    // beams: those that give straight drops first (modular set to the spacing, or a fixed beam with its padeyes at the spacing), then the smallest rating
    S.beamPref = it => it.type === "spreader" && !it.pad && (lb ? /single hook/i.test(it.name) : !/single hook/i.test(it.name)) && (+it.len || 0) >= Math.max(1, padSpan) - (qrMod(it) ? 0.5 : 0.05);   // a modular beam may be set a little short (up to 0.25 m each end – the drops lean ~2–3°) of the lugs – the drops then lean in slightly
    S.A = [
      ...(lb ? [{ key: "sh0", type: "shackle", pref: P.shk, need: W, what: "beam lug on the crane hook" }]
        : [{ key: "ml", type: "masterlink", pref: P.ml, need: W, what: "on the crane hook" }, { key: "st", type: slType, pref: P.sl, need: W / 2 * 1.2, legs: 2, len: "top", hitch: "straight", what: "top legs" }, { key: "sh1", type: "shackle", pref: P.shk, need: W / 2 * 1.2, what: "top legs to the beam" }]),
      { key: "bm", type: "spreader", beam: true, need: W, what: lb ? "lifting beam" : "spreader beam" },
      { key: "sh2", type: "shackle", pref: P.shk, need: perDrop * perPad, what: "at each bottom padeye" },
      { key: "dr", type: slType, pref: P.sl, need: perDrop, len: "drop", hitch: bag ? "straight" : wrapH, what: "drops" },
      ...(bag ? [{ key: "end", type: "hook", pref: P.hook, need: perDrop, what: "into the bag loops" }] : end("end", "at each lifting point", perDrop))
    ];
  }
  S.G = G;
  return S;
}
function qrItemFor(q, s, need, S) {
  if (q.fixed[s.key]) { const it = rigItem(q.fixed[s.key]); if (it) return it; const sn = q.fsnap?.[s.key]; if (sn) return { ...sn, id: q.fixed[s.key] }; delete q.fixed[s.key]; }
  if (s.beam) {
    const span = Math.max(1, S.padSpan || 1), rank = it => qrMod(it) || Math.abs((+it.len || 0) - 0.3 - span) <= 0.35 ? 0 : 1;
    const cands = rigLibrary().filter(S.beamPref); cands.forEach(i => i._rank = rank(i));
    let it = cands.length ? qrPick("spreader", need, S.beamPref, true) : null; cands.forEach(i => delete i._rank);
    return it || qrPick("spreader", need, i => !i.pad && !/single hook/i.test(i.name));
  }
  return qrPick(s.type, need, s.pref) || qrPick(s.type, need);
}
// write the rigging list from the spec, with the parts sized for the needs found so far
function qrWrite(ld, needs) {
  const R = ld.rig, q = R.q, S = qrSlots(ld, q), mk = s => {
    const it = qrItemFor(q, s, needs[s.key] ?? s.need / qrMultOf(ld, q, s.key), S); if (!it) return null;
    const e = rigEntry(it); e._slot = s.key; { const m = qrMultOf(ld, q, s.key); if (m > 1) e.mult = m; }
    if (RIG_TYPES[it.type]?.sling) { e.len = s.len === "drop" ? (+q.drop || S.drop) : (+q.top || S.top); if (s.legs) e.legs = s.legs; if (s.hitch && s.hitch !== "straight") e.hitch = s.hitch; if (s.bagsPer != null) e.bagsPer = s.bagsPer; }
    // a modular beam is made up to the lifting-point spacing (and weighs less short); a fixed beam has its padeyes near its ends
    if (s.beam) { const c = { ...S.cfg }; if (qrMod(it)) { if (+it.len > 0 && c.padSpan > +it.len) { c.padSpan = +it.len; c.topSpan = Math.min(c.topSpan || c.padSpan, +it.len); } e.len = Math.max(1, Math.round(Math.max(c.padSpan, 0.5) * 100) / 100 + 0.2); if (+it.len > 0) e.snap.weight = Math.round((+it.weight || 0) * Math.max(0.35, Math.min(1, e.len / +it.len)) * 1000) / 1000; } else { e.len = +it.len || 4; const ps = Math.round(Math.max(0.5, Math.min(e.len - 0.3, +q.pads > 0 ? +q.pads : 1e9)) * 100) / 100; c.padSpan = ps; c.topSpan = ps; } e.cfg = c; }   // a fixed beam: padeyes near its ends – the drops angle in if the load's points are closer
    q.pick[s.key] = it.id;
    return e;
  };
  const keep = { tilt: R.tilt, preset: undefined };
  const A = S.A.map(mk).filter(Boolean), B = S.B ? S.B.map(mk).filter(Boolean) : null;
  ld.rig = Object.assign({ arr: "build", share4: 3, q, chain: A }, B ? { cranes: 2, chainB: B, legNB: 1 } : { cranes: 1 }, keep.tilt ? { tilt: keep.tilt } : {}, R.auto ? { auto: true } : {});
  compileChain(ld.rig, ld);
  q.built = Object.fromEntries([...A, ...(B || [])].map(e => [e._slot, { id: e.id, len: e.len }]));
  return S;
}
// size: solve, pick the lightest part for what each one actually carries, repeat until nothing changes
function qrSize(ld) {
  const needs = {}; let res = null;
  for (let it = 0; it < 6; it++) {
    qrWrite(ld, needs);
    res = solveBuild(ld); if (!res) break;
    let changed = false;
    for (const r of res.rows) {
      const k = r.entry?._slot; if (!k || ld.rig.q.fixed[k]) continue;
      const need = Math.round((r.load || 0) / (r.hitchF || 1) * 1000) / 1000;
      if (Math.abs((needs[k] ?? -1) - need) > 1e-3) { needs[k] = need; changed = true; }
    }
    if (!changed) break;
  }
  ld.rig.q.sig = qrSig(ld);
  return res;
}
const qrSig = ld => JSON.stringify([qrCranes(ld), ...["weight", "kind", "orient", "L", "W", "H", "D", "FW", "span", "spanY", "lpZ", "lpType", "cog", "nLP", "nx", "ny", "gap", "loops", "bore"].map(k => ld[k] ?? null)]);
function qrApply(ld, arr, auto) {
  const q = qrNew(ld, arr);
  if (!(+ld.span > 0) && q.arr !== "single" && !(ld.kind === "bag" && isBagGroup(ld))) ld.span = Math.round(loadDims(ld).x * 0.7 * 100) / 100;
  ld.rig = { arr: "build", q, chain: [], ...(auto ? { auto: true } : {}) };
  qrSize(ld);
  return ld.rig;
}
// a part changed somewhere else (the drawing's pop-up, the detailed editor): adopt it as the user's choice
function qrAdopt(R) {
  const q = R?.q; if (!q || !q.built) return;
  for (const e of [...(R.chain || []), ...(R.chainB || [])]) {
    const k = e._slot, b = q.built[k]; if (!k || !b) continue;
    if (e.id !== b.id) { q.fixed[k] = e.id; q.fsnap[k] = clone(e.snap); delete R.auto; }
    if (RIG_TYPES[e.snap.type]?.sling && Math.abs((+e.len || 0) - (+b.len || 0)) > 1e-6) { if (k === "dr") q.drop = +e.len; else q.top = +e.len; delete R.auto; }
  }
}
// the load changed (weight, size, lifting points): the app re-sizes its own parts – yours stay as they are
{ const _nl = normLoad; normLoad = function (ld, ...a) {
    try { const q = ld?.rig?.q; if (q && q.sig !== qrSig(ld) && ld.rig.arr === "build") { qrAdopt(ld.rig); if (qrArrOk(ld, q.arr) || ld.rig.auto) { const a = qrAutoArr(ld); if (a !== q.arr) { q.arr = a; q.sling = qrAutoSling(ld, a); } } qrSize(ld); } } catch (e) { console.warn(e); }
    return _nl.call(this, ld, ...a);
  }; }
// new loads and the planner get the simple builder's rigging
{ const _er = ensureRig; ensureRig = function (ld) {
    if (!ld.rig || !ld.rig.arr || (ld.rig.auto && !ld.rig.q)) { qrApply(ld, null, true); return ld.rig; }
    return _er(ld);
  }; }
{ const _rn = rigName; rigName = function (R) { if (R?.q) { const A = QR_ARR.find(a => a.k === R.q.arr); return (A ? A.name : "Rigging") + (R.q.hold && !A?.bag ? ` · ${QR_HOLD[R.q.hold]?.[0].toLowerCase() || ""}` : ""); } return _rn(R); }; }

// ---------- the panel ----------
const QB = { detail: false, sig0: null };
function qrIcon(A) { return `<svg viewBox="0 0 46 38" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${A.icon}"/></svg>`; }
function qrAngles(res, keys) { let a = 0; for (const s of res?.seg || []) { if (!s.e || !keys.includes(s.e._slot)) continue; const h = Math.hypot(s.a[0] - s.b[0], s.a[1] - s.b[1]), v = Math.abs(s.a[2] - s.b[2]); a = Math.max(a, Math.atan2(h, v) / D2R); } return a; }
function qrUseCls(u) { return u == null ? "" : u > 100 ? "bad" : u > QR_TARGET * 100 ? "warn" : ""; }
function qrRowHTML(q, r, e, no, S) {
  const k = e._slot, fixed = !!q.fixed[k], u = r?.util, sl = RIG_TYPES[e.snap.type]?.sling, it = rigItem(e.id), mine = it && !it.builtin;
  const col = sl && e.snap.type !== "sling_wire" && e.snap.type !== "sling_chain" ? `<i class="qdot" style="background:${slingColour(e.snap)}"></i>` : "";
  const slot = [...S.A, ...(S.B || [])].find(s => s.key === k) || {}, need = r ? (r.load || 0) / (r.hitchF || 1) : 0;
  const opts = rigLibrary().filter(i => slot.beam ? i.type === "spreader" && !i.pad : i.type === e.snap.type).sort((a, b) => a.swl - b.swl)
    .map(i => `<option value="${escH(i.id)}" ${i.id === e.id ? "selected" : ""}>${escH(i.name)}${i.builtin ? "" : " ★"}${i.swl < need - 1e-6 ? " – too small" : ""}</option>`).join("");
  return `<div class="qrow ${qrUseCls(u)}" data-qk="${escH(k)}">
    <span class="qno">${no}</span>
    <div class="qmain"><div class="qname">${col}<b>${r?.qty > 1 ? r.qty + " × " : ""}</b>${escH(e.snap.name)}${sl ? ` · ${fx(+e.len || 0, 1)} m` : e.snap.type === "spreader" ? ` · ${fx(+e.len || 0, 2)} m` : ""}${mine ? ` <span class="qmine" title="From your own certified gear">★ yours</span>` : ""}</div>
      <div class="qwhat">${escH(r?.where || slot.what || "")}</div></div>
    <span class="quse"><span class="qbar"><i class="${qrUseCls(u)}" style="width:${Math.min(100, u || 0)}%"></i></span><b class="${qrUseCls(u)}">${u != null ? fx(u, 0) + "%" : ""}</b></span>
    <span class="seg qmode"><button data-qm="${escH(k)}" data-v="auto" aria-pressed="${!fixed}" title="The app picks the lightest part that runs at ≤ 90 %, and re-sizes it when the load changes">Auto</button><button data-qm="${escH(k)}" data-v="fix" aria-pressed="${fixed}" title="Keep this exact part – the app never changes it">Fixed</button></span>
    <div class="qselrow"><select class="qsel" data-qsel="${escH(k)}" aria-label="Choose the part">${it ? "" : `<option selected>${escH(e.snap.name)} (saved)</option>`}${opts}</select>${slot.beam ? "" : `<span class="qmult" title="Pieces side by side at this point, sharing the load (e.g. 2 master links)"><button data-qx="${escH(k)}" data-d="-1" ${(e.mult || 1) <= 1 ? "disabled" : ""}>−</button><b>×${e.mult || 1}</b><button data-qx="${escH(k)}" data-d="1">+</button></span>`}</div>
  </div>`;
}
function qrPanelHTML(ld, R, res) {
  const nCr = qrCranes(ld), bagG = ld.kind === "bag" && isBagGroup(ld);
  if (!R.q) {
    const rows = (res?.rows || []).map(r => `<div class="qrow ${qrUseCls(r.util)}"><span class="qno">${r.no}</span><div class="qmain"><div class="qname"><b>${r.qty > 1 ? r.qty + " × " : ""}</b>${escH(r.name)}</div><div class="qwhat">${escH(r.where || "")}</div></div><span class="quse"><span class="qbar"><i class="${qrUseCls(r.util)}" style="width:${Math.min(100, r.util || 0)}%"></i></span><b class="${qrUseCls(r.util)}">${r.util != null ? fx(r.util, 0) + "%" : ""}</b></span></div>`).join("");
    return `<div class="qr"><div class="qcard"><div class="qh"><b>Your own rigging</b>${R.preset ? `<span class="small">from “${escH(rigName(R))}”</span>` : ""}</div>
      <p class="small" style="margin:0 0 8px">This rigging was set up part by part in the detailed editor, so it is kept exactly as it is – nothing is changed or re-sized by itself.</p>
      <div class="qgear">${rows || `<p class="small">No parts yet.</p>`}</div>
      <div class="btnrow" style="margin-top:8px"><button id="qrDetail" class="pri">Edit in the detailed editor</button><button id="qrStart">Let the app set it up instead</button></div></div></div>`;
  }
  const q = R.q, S = qrSlots(ld, q), G = S.G, A0 = QR_ARR.find(a => a.k === q.arr) || QR_ARR[1];
  const bad = (res?.checks || []).filter(c => c.lvl === "bad"), warns = [...new Set(res?.warn || [])].filter(w => !/^Connection:/.test(w));
  const C = [...(R.chain || []), ...(R.chainB || [])], rowOf = e => res?.rows.find(r => r.entry === e);
  const topKeys = ["st", "sl", "Asl", "Bsl"], aTop = qrAngles(res, topKeys), aDrop = qrAngles(res, ["dr"]);
  const hookToTop = res ? res.hookZ - G.d.z : 0, bm = C.find(e => e._slot === "bm");
  const tiles = QR_ARR.filter(a => bagG ? a.bag : !a.bag).map(a => { const why = qrArrOk(ld, a.k); return `<button type="button" class="qtile" data-qa="${a.k}" aria-pressed="${q.arr === a.k}" ${why ? `disabled title="${escH(why)}"` : `title="${escH(a.why)}"`}>${qrIcon(a)}<span>${a.name}</span></button>`; }).join("");
  const holds = ld.kind === "bag" ? [] : Object.entries(QR_HOLD).filter(([k]) => q.arr !== "baglegs" && q.arr !== "bagspread");
  const n = qrPts(ld), f = (key, lab, v, ph, st = 0.05) => `<label>${lab}<input type="number" step="${st}" data-ql="${key}" value="${v === "" || v == null ? "" : v}" ${ph != null ? `placeholder="${escH(ph)}"` : ""}></label>`;
  const legs = q.arr === "lbeam" ? 0 : 1, hasDrop = ["spread", "lbeam", "bagspread"].includes(q.arr);
  const fmtA = a => `<b class="${a > 45 ? "bbad" : ""}">${fx(a, 0)}°</b>`;
  return `<div class="qr">
    ${R.auto ? `<div class="status busy">Set up by the app for this load – check it, change anything you like, then Save.</div>` : ""}
    ${q.arr === "tandem" && nCr < 2 ? `<div class="status busy">Two-crane rigging – hook a second crane onto this load to see each crane's share on the plan.</div>` : ""}
    ${nCr >= 2 && q.arr !== "tandem" && !bagG ? `<div class="status bad">${nCr} cranes are hooked onto this load – pick <b>Two cranes</b>.</div>` : ""}
    <div class="qcard"><div class="qh"><b><span class="qstep">1</span>The load</b><span class="small">${escH(ld.name || "Load")} · ${fx(+ld.weight || 0, 2)} t${bagG ? ` · ${bagN(ld)} bags (${Math.round(+ld.nx || 1)} × ${Math.round(+ld.ny || 1)})` : ""}</span></div>
      ${bagG ? `<p class="small" style="margin:0">Hooks into the four loops of each bag. Change the number of bags in the load.</p>` : `
      <div class="seg qpts">${[1, 2, 4].map(k => `<button data-qn="${k}" aria-pressed="${n === k}">${k} lifting point${k > 1 ? "s" : ""}</button>`).join("")}</div>
      <div class="qf">${n >= 2 ? f("span", "Apart, along (m)", ld.span ?? "", null) : ""}${n === 4 ? f("spanY", "Apart, across (m)", ld.spanY ?? "", null) : ""}${f("lpZ", "Height above the load's bottom (m)", fx(liftPointZ(ld), 2), null)}${f("cog", "CoG offset towards B (m)", ld.cog ?? 0, null)}</div>`}</div>
    <div class="qcard"><div class="qh"><b><span class="qstep">2</span>Arrangement</b><span class="small">greyed out = doesn't suit this load's lifting points</span></div>
      <div class="qtiles">${tiles}</div><p class="small qwhy">${escH(A0.why)}</p>
      ${holds.length ? `<div class="qsub">Holds the load with</div><div class="seg qhold">${holds.map(([k, [nm, ds]]) => `<button data-qh="${k}" aria-pressed="${q.hold === k}" title="${escH(ds)}">${nm}</button>`).join("")}</div>` : ""}
      <div class="qsub">Slings</div><div class="seg qsl">${Object.entries(QR_SLING).map(([k, [, nm]]) => `<button data-qs="${k}" aria-pressed="${q.sling === k}">${nm}</button>`).join("")}</div></div>
    <div class="qcard"><div class="qh"><b><span class="qstep">3</span>Lengths</b><span class="small">blank = worked out by the app</span></div>
      <div class="qf">${legs ? f("top", hasDrop ? "Top legs (m)" : "Sling length (m)", q.top ?? "", `${fx(S.top, 1)} – auto`, 0.5) : ""}${hasDrop ? f("drop", "Drop legs (m)", q.drop ?? "", `${fx(S.drop, 1)} – auto`, 0.5) : ""}${hasDrop && !bagG ? f("pads", "Spreader padeyes apart (m)", q.pads ?? "", `${fx(G.span, 2)} – = lifting points`, 0.1) : ""}</div>
      <div class="qcalc">${legs && q.arr !== "single" && q.arr !== "tandem" ? `${hasDrop ? "Top legs" : "Sling angle"} ${fmtA(aTop)} from vertical <span class="small">(≤ 45°, 30° preferred)</span> · ` : ""}${hasDrop ? `drops ${fmtA(aDrop)} · ${bm ? `beam ${fx(+bm.len || 0, 2)} m${qrMod(bm.snap) && !(+q.pads > 0) ? " (set to the lifting points)" : ""} · ` : ""}` : ""}hook to load top <b>${fx(hookToTop, 2)} m</b> · rigging <b>${fmtT(res?.weight || 0)} t</b></div></div>
    <div class="qcard"><div class="qh"><b><span class="qstep">4</span>Gear, crane hook → load</b><span class="small">Auto = lightest part at ≤ 90 % · ★ = your own gear</span></div>
      ${R.chainB ? `<div class="qsub">Crane A</div>` : ""}<div class="qgear">${(R.chain || []).map((e, i) => qrRowHTML(q, rowOf(e), e, i + 1, S)).join("")}</div>
      ${R.chainB ? `<div class="qsub">Crane B</div><div class="qgear">${R.chainB.map((e, i) => qrRowHTML(q, rowOf(e), e, "B" + (i + 1), S)).join("")}</div>` : ""}
      ${Object.keys(q.fixed).length ? `<div class="btnrow" style="margin-top:6px"><button id="qrAllAuto">Set every part back to Auto</button></div>` : ""}</div>
    <div class="qcard qchk ${bad.length || warns.length ? "has" : "ok"}">${!bad.length && !warns.length ? `<b>✓ Every part within 90 % and every connection checks out.</b>` : `<b>${bad.length + warns.length} to look at</b><ul>${[...bad.map(c => c.text), ...warns].slice(0, 8).map(t => `<li>${escH(t)}</li>`).join("")}</ul>`}</div>
    <div class="qfoot"><button id="qrDetail" title="Every part, its order, padeyes, your own lifting points, tilt for upending">Detailed editor…</button>${rigTemplates.length ? `<select id="qrTpl"><option value="">My saved set-ups…</option>${rigTemplates.map(t => `<option value="${escH(t.id)}">${escH(t.name)}</option>`).join("")}</select>` : ""}<button id="qrSaveTpl">Save as my set-up</button><button id="qrReset" title="Start again from what the app suggests for this load">Start again</button></div>
  </div>`;
}
function qrRedo(ld) { delete ld.rig.auto; qrSize(ld); renderRB(); }
function qrWire(ld) {
  const R = ld.rig, q = R.q, root = $("rbLeft");
  const on = (sel, fn, ev = "onclick") => root.querySelectorAll(sel).forEach(el => el[ev] = () => fn(el));
  if ($("qrDetail")) $("qrDetail").onclick = () => { QB.detail = true; QB.sig0 = JSON.stringify([R.chain, R.chainB]); renderRB(); };
  if ($("qrStart")) $("qrStart").onclick = () => { qrApply(ld, null, false); renderRB(); };
  if (!q) return;
  on("[data-qa]", b => { q.arr = b.dataset.qa; q.fixed = {}; q.fsnap = {}; q.top = null; q.drop = null; q.sling = qrAutoSling(ld, q.arr); if (q.arr === "tandem" || q.arr === "single") q.hold = q.hold === "basket" ? "shackle" : q.hold; qrRedo(ld); });
  on("[data-qh]", b => { q.hold = b.dataset.qh; q.top = null; q.drop = null; for (const k of ["end", "Aend", "Bend"]) { delete q.fixed[k]; } qrRedo(ld); });
  on("[data-qs]", b => { q.sling = b.dataset.qs; for (const k of ["sl", "st", "dr", "Asl", "Bsl"]) delete q.fixed[k]; qrRedo(ld); });
  on("[data-qn]", b => { const nn = +b.dataset.qn, d = loadDims(ld); ld.nLP = nn; if (nn >= 2 && !(+ld.span > 0)) ld.span = Math.round(d.x * 0.7 * 100) / 100; if (nn === 4 && !(+ld.spanY > 0)) ld.spanY = Math.round(d.y * 0.8 * 100) / 100; if (nn < 4) ld.spanY = 0; if (nn < 2) ld.span = 0; if (qrArrOk(ld, q.arr)) { q.arr = qrAutoArr(ld); q.fixed = {}; q.sling = qrAutoSling(ld, q.arr); } qrRedo(ld); });
  on("[data-ql]", el => { const k = el.dataset.ql, v = el.value === "" ? null : +el.value;
    if (k === "top" || k === "drop" || k === "pads") q[k] = v > 0 ? v : null;
    else if (k === "lpZ") { ld.lpType = "custom"; ld.lpZ = v ?? 0; }
    else { ld[k] = v ?? 0; if (k === "span") ld.spanSet = true; }
    qrRedo(ld); }, "onchange");
  on("[data-qm]", b => { const k = b.dataset.qm, e = [...R.chain, ...(R.chainB || [])].find(x => x._slot === k); if (b.dataset.v === "fix" && e) { q.fixed[k] = e.id; q.fsnap[k] = clone(e.snap); } else { delete q.fixed[k]; delete q.fsnap[k]; } qrRedo(ld); });
  on("[data-qsel]", el => { const k = el.dataset.qsel, it = rigItem(el.value); if (!it) return; q.fixed[k] = it.id; q.fsnap[k] = { name: it.name, type: it.type, swl: it.swl, weight: it.weight, wpm: it.wpm || 0, len: it.len, colour: it.colour }; qrRedo(ld); }, "onchange");
  on("[data-qx]", b => { const k = b.dataset.qx; q.mult = q.mult || {}; const cur = [...(R.chain || []), ...(R.chainB || [])].find(x => x._slot === k)?.mult || 1; q.mult[k] = Math.max(1, Math.min(8, cur + +b.dataset.d)); qrRedo(ld); });
  if ($("qrAllAuto")) $("qrAllAuto").onclick = () => { q.fixed = {}; q.fsnap = {}; qrRedo(ld); };
  if ($("qrReset")) $("qrReset").onclick = () => { qrApply(ld, null, true); renderRB(); };
  if ($("qrTpl")) $("qrTpl").onchange = e => { const t = rigTemplates.find(x => x.id === e.target.value); if (!t) return; ld.rig = clone(t.rig); ld.rig.preset = "tpl:" + t.id; delete ld.rig.auto; if (ld.rig.q) { ld.rig.q.sig = null; qrSize(ld); } renderRB(); toast(`“${t.name}” applied${ld.rig.q ? " – parts re-sized for this load where they're on Auto" : ""}`); };
  if ($("qrSaveTpl")) $("qrSaveTpl").onclick = async () => {
    if (!CAP.db) { toast("Saving set-ups isn't available in this copy – it works in the published app"); return; }
    const name = prompt("Name for this rigging set-up", rigName(R)); if (!name) return;
    const rig = clone(R); delete rig.auto; delete rig._geom;
    try { await CAP.db.doc("rigTemplates/" + uid()).set({ name, rig, updated: Date.now() }); toast("Rigging set-up saved – pick it from “My saved set-ups” on any load"); } catch (err) { toast("Couldn't save"); }
  };
}
// the rigging dialog: the simple builder unless the detailed editor was asked for
{ const _open = openRigBuilder; openRigBuilder = function (...a) { QB.detail = false; QB.sig0 = null; return _open.apply(this, a); }; }
{ const _rb = renderRB; renderRB = function () {
    const ld = RB.work; if (!ld) return _rb();
    if (ld.rig?.q) qrAdopt(ld.rig);
    // edits made in the detailed editor turn the rigging into your own (the app stops sizing it)
    if (QB.detail && ld.rig?.q && QB.sig0 != null && JSON.stringify([ld.rig.chain, ld.rig.chainB]) !== QB.sig0) { delete ld.rig.q; delete ld.rig.auto; }
    if (QB.detail && ld.rig && ld.rig.arr === "build" && !ld.rig.q && QB.sig0 != null) QB.sig0 = JSON.stringify([ld.rig.chain, ld.rig.chainB]);
    _rb();
    const left = $("rbLeft");
    if (QB.detail) {
      const bar = document.createElement("div"); bar.className = "qback";
      bar.innerHTML = `<button id="qrBack">← Simple builder</button><span class="small">${ld.rig?.q ? "Any change here makes this rigging your own – the app then stops re-sizing it." : "Your own rigging – kept exactly as you set it."}</span>`;
      left.prepend(bar); $("qrBack").onclick = () => { QB.detail = false; renderRB(); };
      return;
    }
    const res = solveRig(ld);
    left.innerHTML = qrPanelHTML(ld, ld.rig, res);
    qrWire(ld);
  }; }

// a second crane hooked on / taken off: the simple builder's rigging follows (each crane to its own end), and the
// one-crane rigging comes back when the second crane comes off
{ const _ft = fixTandems; fixTandems = function (...a) {
    for (const ld of plan.loads) {
      const q = ld.rig?.q; if (!q) continue;
      const n = plan.cranes.filter(c => c.attach?.load === ld.id && REG.cranes[c.model]).length, prev = ld.nCr ?? n;
      if (n >= 2 && q.arr !== "tandem" && !(ld.kind === "bag" && isBagGroup(ld))) {
        ld.rigSingle = clone(ld.rig);
        if (ld.rigTandem?.q) { ld.rig = clone(ld.rigTandem); ld.rig.q.sig = null; qrSize(ld); } else qrApply(ld, "tandem", true);
        toast(`${ld.name}: 2 cranes hooked on – rigging changed to two cranes, each on its own end. Open Rigging… to check it.`, 5000);
      } else if (n < 2 && prev >= 2 && q.arr === "tandem") {
        ld.rigTandem = clone(ld.rig);
        if (ld.rigSingle?.q && ld.rigSingle.q.arr !== "tandem") { ld.rig = clone(ld.rigSingle); ld.rig.q.sig = null; qrSize(ld); } else { ld.rig = null; qrApply(ld, null, true); }
        toast(`${ld.name}: one crane now – rigging back to “${rigName(ld.rig)}”.`, 5000);
      }
    }
    return _ft.apply(this, a);
  }; }

// drops that lean (spreader padeyes not over the lifting points): the lugs and the beam see a sideways pull – say so
{ const _sr = solveRig; solveRig = function (ld, ...a) {
    const r = _sr.call(this, ld, ...a); const q = ld?.rig?.q;
    try { if (r && q && ["spread", "lbeam"].includes(q.arr)) { const dg = (r.seg || []).find(g => g.e && g.e._slot === "dr"), ang = dg ? Math.atan2(Math.abs(dg.b[0] - dg.a[0]), Math.abs(dg.a[2] - dg.b[2]) || 1) / D2R : 0; if (ang > 3) { const pull = (+ld.weight || 0) / Math.max(2, qrPts(ld)) * Math.tan(ang * D2R), dr = (r.seg || []).find(g => g.e && g.e._slot === "dr"), out = dr ? Math.abs(dr.a[0]) < Math.abs(dr.b[0]) : true;
          r.warn = r.warn || []; r.warn.push(`Drops lean ${fx(ang, 0)}° along the load (spreader padeyes ${out ? "inside" : "outside"} the lifting points) – each lug takes ≈ ${fx(pull, 1)} t sideways and the beam is in ${out ? "tension" : "compression"}: check the lugs are rated for an angled pull`); } } } catch (e) { }
    return r;
  }; }
