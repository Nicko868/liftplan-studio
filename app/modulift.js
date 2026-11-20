// ================= Modular spreaders – the maker's table drives each beam =================
// Any spreader in the rigging library can carry its maker's data as a TABLE (item.table): load v span by top-leg angle,
// minimum top sling, how each span is made up and what each part weighs, the build step, and the maker's angle limits.
// The engine below knows nothing about any one maker – the table is data: read from the maker's document (Import), typed
// or corrected in the library. The two Modulift tables below are only the starting data for the built-in items.
// From the Modulift user instructions: load v span table (WLL by span and sling angle), minimum top sling length, the strut
// make-up for each span and every component's weight. For each Modulift beam in a rig (the main beam and any lower / cross
// spreaders) the app uses: its real weight for the span, its WLL for that span and its top legs' angle, the minimum top
// sling length, the 45° top-leg limit and the maker's rule for the lower slings: no more than 6° from vertical ALONG the beam
// (the drop-link shackle hangs straight under the drop link); across the beam the limit is the shackle's own, 45° each leg
// (Modulift, Nov 2026).
// Table keys are the top-leg angle FROM VERTICAL: 45 (= 45° base-to-sling), 30 (= 60° BSA), 20 (= 70° BSA).
const FT = 0.3048, ftIn = (f, i) => Math.round((f * 12 + i) * 0.0254 * 100) / 100;
const MOD250 = {
  key: "MOD250", name: "Modulift MOD 250/250", src: "Modulift MOD 250/250 user instructions (UK, Jan 2019)", unit: "m", minSpan: 2, maxSpan: 21,
  spans: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
  wll: { 45: [250, 250, 250, 250, 250, 250, 250, 250, 250, 234, 204, 178, 158, 138, 120, 105, 91, 80, 69, 59],
         30: [250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 235, 211, 185, 160, 141, 122, 106],
         20: [250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 226, 196, 171] },
  minTop: { 45: [0.9, 1.6, 2.3, 3.1, 3.8, 4.5, 5.2, 5.9, 6.6, 7.3, 8.0, 8.7, 9.4, 10.1, 10.8, 11.5, 12.2, 13.0, 13.7, 14.4],
            30: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5, 16.5, 17.5, 18.5, 19.5, 20.5],
            20: [2.4, 3.9, 5.4, 6.8, 8.3, 9.7, 11.2, 12.7, 14.1, 15.6, 17.1, 18.5, 20.0, 21.4, 22.9, 24.4, 25.8, 27.3, 28.8, 30.2] },
  struts: { 2: [], 3: [1], 4: [2], 5: [3], 6: [3, 1], 7: [3, 2], 8: [6], 9: [6, 1], 10: [6, 2], 11: [6, 3], 12: [3, 6, 1], 13: [3, 6, 2], 14: [6, 6], 15: [6, 6, 1], 16: [6, 6, 2], 17: [6, 6, 3], 18: [1, 6, 6, 3], 19: [2, 6, 6, 3], 20: [2, 6, 6, 3, 1], 21: [2, 6, 6, 3, 2] },
  half: 0.5, kg: { eu: 365, dl: 90, s6: 860, s3: 495, s2: 375, s1: 255, s05: 192 },
  shk: "top shackles 200 t wide body, drop-link shackles 125 t wide body", parts: "end units & drop links 125 t each"
};
// MOD 110 (US, Feb 2018): spans 6–59 ft in 1 ft steps, end unit 3 ft, weights in lbs
const MOD110 = (() => {
  const S = Array.from({ length: 54 }, (_, i) => 6 + i), lb = 0.45359237;
  const w45 = { 29: 108, 30: 103, 31: 96, 32: 91, 33: 84, 34: 80, 35: 74, 36: 70, 37: 65, 38: 60, 39: 56, 40: 52, 41: 48, 42: 46, 43: 43, 44: 40, 45: 37, 46: 35, 47: 32, 48: 30, 49: 28, 50: 26, 51: 24, 52: 23, 53: 21, 54: 20, 55: 19, 56: 17, 57: 16, 58: 15, 59: 14 };
  const w30 = { 38: 106, 39: 98, 40: 92, 41: 85, 42: 81, 43: 75, 44: 70, 45: 65, 46: 62, 47: 57, 48: 54, 49: 50, 50: 47, 51: 44, 52: 41, 53: 38, 54: 37, 55: 34, 56: 32, 57: 30, 58: 28, 59: 26 };
  const w20 = { 45: 105, 46: 99, 47: 92, 48: 87, 49: 81, 50: 76, 51: 71, 52: 67, 53: 62, 54: 59, 55: 55, 56: 52, 57: 48, 58: 46, 59: 42 };
  const m45 = [[3, 1], [3, 10], [4, 6], [5, 2], [5, 11], [6, 7], [7, 4], [8, 0], [8, 8], [9, 5], [10, 1], [10, 11], [11, 7], [12, 4], [13, 0], [13, 8], [14, 5], [15, 1], [15, 10], [16, 6], [17, 2], [17, 11], [18, 7], [19, 4], [20, 0], [20, 10], [21, 6], [22, 2], [22, 11], [23, 7], [24, 4], [25, 0], [25, 8], [26, 5], [27, 1], [27, 10], [28, 6], [29, 2], [29, 11], [30, 8], [31, 5], [32, 1], [32, 10], [33, 6], [34, 2], [34, 11], [35, 7], [36, 4], [37, 0], [37, 8], [38, 5], [39, 1], [39, 10], [40, 7]];
  const m20 = [[7, 7], [9, 1], [10, 6], [12, 0], [13, 6], [14, 11], [16, 5], [17, 10], [19, 4], [20, 10], [22, 2], [23, 8], [25, 1], [26, 7], [28, 1], [29, 6], [31, 0], [32, 6], [33, 11], [35, 5], [36, 10], [38, 4], [39, 10], [41, 2], [42, 8], [44, 2], [45, 7], [47, 1], [48, 6], [50, 0], [51, 6], [52, 11], [54, 5], [55, 10], [57, 4], [58, 10], [60, 2], [61, 8], [63, 2], [64, 7], [66, 1], [67, 6], [69, 0], [70, 6], [71, 11], [73, 5], [74, 11], [76, 4], [77, 10], [79, 2], [80, 8], [82, 2], [83, 7], [85, 1]];
  const st = { 6: [], 7: [1], 8: [2], 9: [2, 1], 10: [4], 11: [4, 1], 12: [6], 13: [6, 1], 14: [6, 2], 15: [2, 6, 1], 16: [6, 4], 17: [1, 6, 4], 18: [12], 19: [12, 1], 20: [12, 2], 21: [2, 12, 1], 22: [12, 4], 23: [4, 12, 1], 24: [12, 6], 25: [6, 12, 1], 26: [6, 12, 2], 27: [6, 12, 2, 1], 28: [6, 12, 4], 29: [6, 12, 4, 1], 30: [12, 12], 31: [12, 12, 1], 32: [12, 12, 2], 33: [2, 12, 12, 1], 34: [12, 12, 4], 35: [4, 12, 12, 1], 36: [6, 12, 12], 37: [6, 12, 12, 1], 38: [6, 12, 12, 2], 39: [2, 12, 12, 6, 1], 40: [6, 12, 12, 4], 41: [6, 12, 12, 4, 1], 42: [12, 12, 12], 43: [12, 12, 12, 1], 44: [12, 12, 12, 2], 45: [2, 12, 12, 12, 1], 46: [4, 12, 12, 12], 47: [4, 12, 12, 12, 1], 48: [12, 12, 12, 6], 49: [6, 12, 12, 12, 1], 50: [6, 12, 12, 12, 2], 51: [6, 12, 12, 12, 2, 1], 52: [6, 12, 12, 12, 4], 53: [6, 12, 12, 12, 4, 1], 54: [12, 12, 12, 12], 55: [12, 12, 12, 12, 1], 56: [12, 12, 12, 12, 2], 57: [12, 12, 12, 12, 2, 1], 58: [12, 12, 12, 12, 4], 59: [12, 12, 12, 12, 4, 1] };
  return { key: "MOD110", name: "Modulift MOD 110", src: "Modulift MOD 110 user instructions (US, Feb 2018)", unit: "ft", minSpan: 6 * FT, maxSpan: 59 * FT,
    spans: S.map(s => s * FT), ft: S,
    wll: { 45: S.map(s => w45[s] || 110), 30: S.map(s => w30[s] || 110), 20: S.map(s => w20[s] || 110) },
    minTop: { 45: m45.map(q => ftIn(...q)), 30: S.map(s => ftIn(s - 2, 10)), 20: m20.map(q => ftIn(...q)) },
    struts: st, kg: { eu: 379 * lb, dl: 99 * lb, s20: 1170 * lb, s12: 750 * lb, s10: 650 * lb, s8: 540 * lb, s6: 440 * lb, s4: 345 * lb, s2: 230 * lb, s1: 185 * lb },
    shk: "top shackles 85 t, lower shackles 55 t", parts: "end units & drop links 55 t each" };
})();
// ---- the built-in tables, in the general form every table takes
//   unit "m" | "ft" (how spans are written), step (m) the span is built to, minSpan / maxSpan (m), spans [m] table rows,
//   wll / minTop { "20" | "30" | "45": [...] } keyed by the largest top-leg angle from vertical, fixedKg (end units + drop
//   links), parts { label: kg }, makeUp { span key: [part labels] }, ends (label at each end), lowAlong / lowAcross / topMax (°)
const tKey = s => String(Math.round(s * 1000) / 1000);
function modToTable(M) {
  const T = { maker: "Modulift", model: M.name, src: M.src, unit: M.unit, step: M.unit === "ft" ? FT : 0.5, minSpan: M.minSpan, maxSpan: M.maxSpan, spans: M.spans.slice(),
    wll: { 20: M.wll[20].slice(), 30: M.wll[30].slice(), 45: M.wll[45].slice() }, minTop: { 20: M.minTop[20].slice(), 30: M.minTop[30].slice(), 45: M.minTop[45].slice() },
    fixedKg: Math.round((2 * M.kg.eu + 2 * M.kg.dl) * 10) / 10, parts: {}, makeUp: {}, ends: "EU", lowAlong: 6, lowAcross: 45, topMax: 45,
    notes: `${M.parts} · ${M.shk} · lower slings within 6° of vertical along the beam; across it, the drop-link shackle's 45° each leg (Modulift, Nov 2026)` };
  const u = M.unit === "ft" ? " ft" : " m";
  for (const [k, v] of Object.entries(M.kg)) if (/^s\d/.test(k)) T.parts[(k === "s05" ? "0.5" : k.slice(1)) + (k === "s05" ? " m" : u)] = Math.round(v * 10) / 10;
  if (M.unit === "ft") for (const f of M.ft) T.makeUp[tKey(f * FT)] = (M.struts[f] || []).map(m => m + u);
  else for (let s2 = M.minSpan * 2; s2 <= M.maxSpan * 2; s2++) { const s = s2 / 2, w = Math.floor(s + 1e-6); T.makeUp[tKey(s)] = [...(M.struts[w] || []).map(m => m + u), ...(s - w > 0.25 ? ["0.5 m"] : [])]; }
  return T;
}
const TABLES = { MOD250: modToTable(MOD250), MOD110: modToTable(MOD110) };
// the table for a spreader in a rig: the library item's own table, else (older plans) the built-in it was made from
function tableOf(e) { const it = rigItem(e?.id); if (it?.table?.spans?.length) return it.table; if (e?.snap?.table?.spans?.length) return e.snap.table;
  const k = it?.mod || e?.mod || e?.snap?.mod || (/^mod110/.test(e?.id || "") ? "MOD110" : /^mod250/.test(e?.id || "") ? "MOD250" : null); return TABLES[k] || null; }
const tName = T => T.model || T.name || "Spreader";
const tBand = (b, T) => { const ks = Object.keys(T.wll).map(Number).sort((a, c) => a - c); return ks.find(k => b <= k + 1e-6) ?? null; };
const tRow = (span, T) => { const i = T.spans.findIndex(s => s >= span - 0.005); return i < 0 ? -1 : i; };
// the span the beam is built to: up to the maker's next step (a few mm over a step is that step)
function tSpan(span, T) { const s = Math.max(T.minSpan || 0, Math.min(T.maxSpan || 99, span)), st = +T.step > 0 ? +T.step : 0; return st ? Math.ceil(s / st - 0.01) * st : s; }
const tParts = (span, T) => (T.makeUp || {})[tKey(tSpan(span, T))] || null;
function tWeight(span, T) { const p = tParts(span, T); return p && +T.fixedKg > 0 ? (+T.fixedKg + p.reduce((a, l) => a + (+(T.parts || {})[l] || 0), 0)) / 1000 : null; }
function tMakeUp(span, T) { const p = tParts(span, T); return p ? [T.ends, ...p, T.ends].filter(Boolean).join(" + ") : ""; }
const tSpanTxt = (span, T) => { const s = tSpan(span, T); return T.unit === "ft" ? `${Math.round(s / FT)} ft (${fx(s, 2)} m)` : `${fx(s, 1)} m`; };
const tRowTxt = (i, T) => T.unit === "ft" ? `${Math.round(T.spans[i] / FT)} ft` : `${fx(T.spans[i], 1)} m`;
// older names still used elsewhere
const modOf = e => tableOf(e), isMod250 = e => tableOf(e) === TABLES.MOD250;
const modWeight = (span, M) => tWeight(span, M && M.spans ? (M.makeUp ? M : TABLES[M.key]) : TABLES.MOD250);
// the library items carry their tables
RIG_BUILTIN.push(RG("mod250_250", "spreader", "Modulift MOD 250/250 × 12 m", 250, tWeight(12, TABLES.MOD250), 12,
  { mod: "MOD250", table: TABLES.MOD250, adjust: true, maker: "Modulift", cert: "", notes: MOD250.src + " · " + MOD250.parts + " · " + MOD250.shk }));
RIG_BUILTIN.push(RG("mod110", "spreader", "Modulift MOD 110 × 16 ft (4.88 m)", 110, tWeight(16 * FT, TABLES.MOD110), Math.round(16 * FT * 1000) / 1000,
  { mod: "MOD110", table: TABLES.MOD110, adjust: true, maker: "Modulift", cert: "", notes: MOD110.src + " · " + MOD110.parts + " · " + MOD110.shk }));
// each table beam in the rig, with where it sits in the list
function modBeams(R) {
  const out = [], ch = R?.chain || [];
  const add = (e, role) => { if (e && e.snap?.type === "spreader") { const T = tableOf(e); if (T) out.push({ e, T, role, ci: ch.indexOf(e) }); } };
  if (R?.arr === "tree" && R.tree) {   // the workbench: every spreader with a table, and the slings coming down onto its top padeyes
    for (const n of R.tree.nodes) if (n.kind === "beam" && n.beam && tableOf(n.beam)) out.push({ e: n.beam, T: tableOf(n.beam), role: "tree", ci: -1,
      top: R.tree.nodes.flatMap(m => (m.legs || []).filter(L => L.to?.node === n.id)).flatMap(L => (L.parts || []).filter(e => RIG_TYPES[e.snap.type]?.sling && +e.len > 0)) });
    return out; }
  if (ch.length) { add(R.beam, "main"); if (R.beam2) add(R.beam2, R.xbeam ? "cross" : "lower"); }
  else for (const v of Object.values(R || {})) for (const e of [].concat(v || [])) if (e && e.snap?.type === "spreader" && tableOf(e)) { add(e, "main"); break; }
  return out;
}
// while the rig is solved: each beam at the span it is built to, its weight for that span, then its WLL and the maker's rules
{ const _sr = solveRig; solveRig = function (ld, ...a) {
    const R = ld?.rig; let MB = [];
    // the span entered is taken up to the next span the maker builds, and that built span is used everywhere – drawing,
    // geometry, weight, rating. Top and bottom connections are on the same pins, so both spacings are the built span.
    const keep = [];
    try { if (R) { MB = modBeams(R); for (const m of MB) { const T = m.T, c = m.e.cfg || {}, chain = !!(R.chain || []).length;
        const s0 = +c.padSpan > 0 ? +c.padSpan : !chain && m.role === "main" && +R.padSpan > 0 ? +R.padSpan : m.role === "cross" && +ld.spanY > 0 ? +ld.spanY : T === TABLES.MOD250 && m.role === "main" ? Math.max(2, (+m.e.len || 12) - 0.2) : (+m.e.len || +m.e.snap.len || 5);
        const sb = Math.round(tSpan(s0, T) * 1000) / 1000; m.span0 = sb; const w = tWeight(sb, T); if (w) m.e.snap.weight = w;
        keep.push([m.e, "len", m.e.len]); m.e.len = sb;
        if (chain || m.e.cfg) { m.e.cfg = c; keep.push([c, "padSpan", c.padSpan], [c, "topSpan", c.topSpan]); c.padSpan = sb; c.topSpan = sb; }
        if (!chain && m.role === "main") { keep.push([R, "padSpan", R.padSpan], [R, "topSpan", R.topSpan]); R.padSpan = sb; R.topSpan = sb; } } } } catch (e) { console.warn(e); }
    let r; try { r = _sr.call(this, ld, ...a); } finally { for (let k = keep.length - 1; k >= 0; k--) { const [o, f, v] = keep[k]; if (v === undefined) delete o[f]; else o[f] = v; } }
    try { if (!r || !MB.length || !(r.beams || []).length) return r;
      r.warn = r.warn || []; r.mods = [];
      const B = r.beams, inline2 = R.b2 && R.beam2 && !R.xbeam && B.length > 1;
      const geomOf = m => B.some(b => b.entry === m.e) ? B.filter(b => b.entry === m.e) : m.role === "main" ? [inline2 ? B[1] : B[0]] : m.role === "lower" ? [B[0]] : B.filter(b => b.cross);
      const beta = q => Math.atan2(Math.hypot(q.a[0] - q.b[0], q.a[1] - q.b[1]), Math.abs(q.a[2] - q.b[2])) / D2R;
      const near = (p, q, t) => Math.hypot(p[0] - q[0], p[1] - q[1]) < t;
      for (const m of MB) { const T = m.T, ch = R.chain || [];
        let span = m.span0, bT = 0, bD = 0, bX = 0;
        for (const b of geomOf(m)) { if (!b) continue;
          const zt = b.a[2] + b.h, L = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]) || 1, u = [(b.b[0] - b.a[0]) / L, (b.b[1] - b.a[1]) / L];
          const onLine = p => Math.abs((p[0] - b.a[0]) * u[1] - (p[1] - b.a[1]) * u[0]) < 0.05, along = p => (p[0] - b.a[0]) * u[0] + (p[1] - b.a[1]) * u[1];
          const tp = (r.pads || []).filter(p => p[3] === "top" && Math.abs(p[2] - zt) < 0.05 && onLine(p)), lp = (r.pads || []).filter(p => p[3] === "low" && Math.abs(p[2] - b.a[2]) < 0.05 && onLine(p));
          if (tp.length > 1) span = Math.max(...tp.map(along)) - Math.min(...tp.map(along));
          // a top leg: its line, carried down to the top padeye height, meets a top padeye (fittings at the padeye end are not in the line)
          const atZ = (q, z) => { const dz = q.b[2] - q.a[2]; if (Math.abs(dz) < 1e-6) return q.a; const t = (z - q.a[2]) / dz; return [q.a[0] + (q.b[0] - q.a[0]) * t, q.a[1] + (q.b[1] - q.a[1]) * t, z]; };
          const tops = (r.seg || []).filter(q => Math.min(q.a[2], q.b[2]) >= zt - 0.05 && Math.abs(q.a[2] - q.b[2]) > 0.05 && tp.some(p => near(atZ(q, zt), p, 0.1)));
          // what hangs from a bottom padeye: the upper end is under the padeye (below its shackle / link)
          const drops = (r.seg || []).filter(q => Math.max(q.a[2], q.b[2]) <= b.a[2] + 0.05 && lp.some(p => near(q.a[2] >= q.b[2] ? q.a : q.b, p, 0.2)));
          const zH = drops.length ? Math.max(...drops.map(q => Math.max(q.a[2], q.b[2]))) : 0, hang = drops.filter(q => Math.max(q.a[2], q.b[2]) >= zH - 0.05);
          // each lower sling's lean split into along the beam and across it
          const lean = (q, ax) => { const hi = q.a[2] >= q.b[2] ? q.a : q.b, lo = hi === q.a ? q.b : q.a, dz = Math.abs(hi[2] - lo[2]) || 1e-6, dx = lo[0] - hi[0], dy = lo[1] - hi[1], c = ax ? dx * u[0] + dy * u[1] : dx * u[1] - dy * u[0]; return Math.atan2(Math.abs(c), dz) / D2R; };
          bT = Math.max(bT, ...tops.map(beta)); bD = Math.max(bD, ...hang.map(q => lean(q, 1))); bX = Math.max(bX, ...hang.map(q => lean(q, 0))); }
        const topMax = +T.topMax > 0 ? +T.topMax : 45, band = bT <= topMax + 1e-6 ? tBand(bT, T) : null, i = tRow(span, T), tag = `${tName(T)}${m.role === "cross" ? " (cross spreader)" : m.role === "lower" ? " (lower beam)" : ""}`;
        const info = { role: m.role, model: tName(T), span, bT, bD, bX, band, row: i }; r.mods.push(info); if (m.role === "main") r.mod = info;
        if (i < 0) { r.warn.push(`${tag}: span ${fx(span, 2)} m is over its ${fx(T.maxSpan || T.spans[T.spans.length - 1], 1)} m maximum`); continue; }
        if (band == null) { r.warn.push(`${tag}: top legs ${fx(bT, 1)}° from vertical – over the maker's ${fx(topMax, 0)}° limit`); continue; }
        const wll = +T.wll[band][i], minL = +((T.minTop || {})[band] || [])[i] || 0, spTxt = tRowTxt(i, T);
        const row = (r.rows || []).find(x => x.type === "spreader" && x.entry === m.e); if (row && wll > 0) { row.swl = wll; row.baseSwl = wll; row.util = row.load / wll * 100; row.name = `${tName(T)} – ${tSpanTxt(span, T)} span`; row.makeUp = tMakeUp(span, T); row.note = `WLL ${wll} t at ${spTxt} span, top legs ≤ ${band}° from vertical (maker's table)${row.makeUp ? " · made up " + row.makeUp : ""}`; }
        // the top sling: the last sling above this beam in the list
        const above = m.ci > 0 ? ch.slice(0, m.ci) : [].concat(R.top || [], R.leg || []), ts = m.top ? m.top.slice().sort((a, b) => +a.len - +b.len)[0] : above.filter(e => RIG_TYPES[e?.snap?.type]?.sling && +e.len > 0).pop();
        if (ts && minL > 0 && +ts.len < minL - 1e-6) r.warn.push(`${tag}: top sling ${fx(+ts.len, 1)} m is too short – the maker's minimum at ${spTxt} span and top legs ≤ ${band}° from vertical is ${fx(minL, 2)} m`);
        const la = +T.lowAlong > 0 ? +T.lowAlong : null, lx = +T.lowAcross > 0 ? +T.lowAcross : null;
        if (la != null && bD > la + 0.05) r.warn.push(`${tag}: lower slings ${fx(bD, 1)}° from vertical along the beam – over the maker's ${fx(la, 0)}° limit (the shackle under each drop link must hang within ${fx(la, 0)}° of straight below it, along the beam)`);
        if (lx != null && bX > lx + 0.05) r.warn.push(`${tag}: lower slings ${fx(bX, 1)}° from vertical across the beam – over the ${fx(lx, 0)}° limit for the drop-link shackle`);
      }
      for (const x of r.rows || []) if (x.type === "spreader" && x.util > 100 && !r.warn.some(w => w.startsWith(x.name))) r.warn.push(`${x.name}: ${fx(x.load, 2)} t is over its ${fx(x.swl, 2)} t SWL`);
    } catch (e) { console.warn(e); }
    return r; }; }
// ---------- the maker's table on a spreader in the rigging library: read from the document, checked and corrected here ----------
// the table as text: one row per span – span, WLL at each top-leg angle, minimum top sling at each angle
const T_BANDS = ["20", "30", "45"];
function tableToText(T) {
  const u = T.unit === "ft" ? "ft" : "m", sp = s => T.unit === "ft" ? String(Math.round(s / FT)) : String(+s.toFixed(3)), v = x => x == null || x === "" ? "-" : String(+(+x).toFixed(2));
  const rows = T.spans.map((s, i) => [sp(s), ...T_BANDS.map(b => v((T.wll[b] || [])[i])), ...T_BANDS.map(b => v(((T.minTop || {})[b] || [])[i]))].join("\t"));
  const mk = Object.entries(T.makeUp || {}).sort((a, b) => +a[0] - +b[0]).map(([k, p]) => `${sp(+k)}: ${p.join(" + ") || "–"}`);
  return { rows: rows.join("\n"), makeUp: mk.join("\n"), parts: Object.entries(T.parts || {}).map(([k, w]) => `${k} = ${+(+w).toFixed(1)}`).join(", "), u };
}
function tableFromForm(f) {
  const unit = f.unit === "ft" ? "ft" : "m", k = unit === "ft" ? FT : 1, num = x => x === "-" || x === "" || x == null ? null : +String(x).replace(",", ".");
  const lines = String(f.rows || "").split(/\n+/).map(l => l.trim().split(/[\t;| ]+/).filter(Boolean)).filter(r => r.length >= 2 && isFinite(num(r[0])));
  if (!lines.length) return null;
  const spans = lines.map(r => Math.round(num(r[0]) * k * 1000) / 1000), wll = {}, minTop = {};
  T_BANDS.forEach((b, j) => { const w = lines.map(r => num(r[1 + j])), t = lines.map(r => num(r[4 + j])); if (w.some(x => x > 0)) wll[b] = w.map(x => x || 0); if (t.some(x => x > 0)) minTop[b] = t.map(x => x || 0); });
  if (!Object.keys(wll).length) return null;
  const parts = {}; String(f.parts || "").split(/[,;\n]+/).forEach(p => { const m = p.split("="); if (m.length === 2 && m[0].trim() && isFinite(num(m[1].trim()))) parts[m[0].trim()] = num(m[1].trim()); });
  const makeUp = {}; String(f.makeUp || "").split(/\n+/).forEach(l => { const m = l.split(":"); if (m.length >= 2 && isFinite(num(m[0].trim()))) makeUp[tKey(num(m[0].trim()) * k)] = m.slice(1).join(":").split("+").map(x => x.trim()).filter(x => x && x !== "–"); });
  const st = num(f.step);
  return { maker: f.maker || "", model: f.model || "", src: f.src || "", unit, step: st > 0 ? st * k : 0, minSpan: num(f.minSpan) > 0 ? num(f.minSpan) * k : spans[0], maxSpan: num(f.maxSpan) > 0 ? num(f.maxSpan) * k : spans[spans.length - 1], spans, wll, minTop,
    fixedKg: num(f.fixedKg) || 0, parts, makeUp, ends: f.ends || "", lowAlong: num(f.lowAlong), lowAcross: num(f.lowAcross), topMax: num(f.topMax) || 45, notes: f.notes || "" };
}
// from a maker's document read by Claude (see the rigging import prompt)
function tableFromAI(t) {
  try { if (!t || !(t.rows || []).length) return null; const unit = t.unit === "ft" ? "ft" : "m", rows = t.rows.filter(r => +r.span_m > 0).sort((a, b) => a.span_m - b.span_m);
    const wll = {}, minTop = {}; T_BANDS.forEach(b => { if (rows.some(r => +(r.wll_t || {})[b] > 0)) wll[b] = rows.map(r => +(r.wll_t || {})[b] || 0); if (rows.some(r => +(r.min_top_sling_m || {})[b] > 0)) minTop[b] = rows.map(r => +(r.min_top_sling_m || {})[b] || 0); });
    if (!Object.keys(wll).length) return null;
    const makeUp = {}; rows.forEach(r => { if ((r.make_up || []).length) makeUp[tKey(+r.span_m)] = r.make_up.map(String); });
    return { maker: String(t.maker || ""), model: String(t.model || ""), src: String(t.source || ""), unit, step: +t.step_m || (unit === "ft" ? FT : 0), minSpan: +t.min_span_m || +rows[0].span_m, maxSpan: +t.max_span_m || +rows[rows.length - 1].span_m,
      spans: rows.map(r => Math.round(+r.span_m * 1000) / 1000), wll, minTop, fixedKg: +t.end_units_and_drop_links_kg || 0, parts: t.part_weights_kg || {}, makeUp, ends: String(t.end_label || ""),
      lowAlong: +t.lower_sling_max_deg_along_beam || null, lowAcross: +t.lower_sling_max_deg_across_beam || null, topMax: +t.top_sling_max_deg || 45, notes: String(t.notes || "") }; } catch (e) { console.warn(e); return null; }
}
{ const _rf = renderRLForm; renderRLForm = function (...a) { const r = _rf.apply(this, a);
    try { const it = RL.edit; if (!it || it.type !== "spreader" || !$("rfSave")) return r;
      const T = it.table || (rigItem(it.id) && tableOf({ id: it.id })) || null, X = T ? tableToText(T) : { rows: "", makeUp: "", parts: "", u: "m" }, v = (k, d = "") => escH(T && T[k] != null ? String(T[k]) : d);
      const unitTxt = T && T.unit === "ft" ? "ft" : "m", inU = x => x == null || x === "" ? "" : String(+(T && T.unit === "ft" ? x / FT : x).toFixed(3));
      const box = document.createElement("details"); box.className = "spec"; box.open = !!T; box.id = "rfTbl";
      box.innerHTML = `<summary><b>Maker's load table</b> <span class="small">– for a modular / adjustable spreader: the app then builds it to the maker's spans and takes its WLL, weight, minimum top sling and angle limits from here</span></summary>
        <div class="row3"><label>Maker<input type="text" data-tf="maker" value="${v("maker")}"></label><label>Model<input type="text" data-tf="model" value="${v("model")}"></label><label>From (document)<input type="text" data-tf="src" value="${v("src")}"></label></div>
        <div class="row3"><label>Spans written in<select data-tf="unit"><option value="m" ${unitTxt === "m" ? "selected" : ""}>metres</option><option value="ft" ${unitTxt === "ft" ? "selected" : ""}>feet</option></select></label><label>Built in steps of (same unit)<input type="number" step="0.1" data-tf="step" value="${inU(T?.step)}"></label><label>Spans from – to<span style="display:flex;gap:6px"><input type="number" step="0.1" data-tf="minSpan" value="${inU(T?.minSpan)}"><input type="number" step="0.1" data-tf="maxSpan" value="${inU(T?.maxSpan)}"></span></label></div>
        <label>Load v span – one line per span: <b>span · WLL (t) with top legs ≤ 20° / ≤ 30° / ≤ 45° from vertical · minimum top sling (m) at ≤ 20° / ≤ 30° / ≤ 45°</b> (use – where the maker gives none)
          <textarea data-tf="rows" rows="7" style="font-family:monospace" placeholder="12	250	250	204	17.1	11.5	8.0">${escH(X.rows)}</textarea></label>
        <div class="row3"><label>Top legs – maker's limit (° from vertical)<input type="number" data-tf="topMax" value="${v("topMax", "45")}"></label><label>Lower slings – along the beam, max (°)<input type="number" data-tf="lowAlong" value="${v("lowAlong")}"></label><label>Lower slings – across the beam, max (°)<input type="number" data-tf="lowAcross" value="${v("lowAcross")}"></label></div>
        <div class="row3"><label>End units + drop links, both ends (kg)<input type="number" data-tf="fixedKg" value="${v("fixedKg")}"></label><label>Part weights (kg): label = kg, …<input type="text" data-tf="parts" value="${escH(X.parts)}" placeholder="6 ft = 199.6, 4 ft = 156.5"></label><label>End label<input type="text" data-tf="ends" value="${v("ends", "EU")}"></label></div>
        <label>Make-up for each span (span: part + part …)<textarea data-tf="makeUp" rows="3" style="font-family:monospace" placeholder="16: 6 ft + 4 ft">${escH(X.makeUp)}</textarea></label>
        <label>Notes (shackles, rules from the maker)<input type="text" data-tf="notes" value="${v("notes")}"></label>`;
      $("rfSave").closest(".btnrow").before(box);
      const save = $("rfSave"), _h = save.onclick; save.onclick = async ev => { const f = {}; box.querySelectorAll("[data-tf]").forEach(el => f[el.dataset.tf] = el.value);
        const T2 = f.rows.trim() ? tableFromForm(f) : null; if (f.rows.trim() && !T2) { toast("The load table couldn't be read – one line per span, numbers separated by spaces or tabs"); return; }
        if (T2) RL.edit.table = T2; else delete RL.edit.table; return _h.call(save, ev); };
    } catch (e) { console.warn(e); }
    return r; }; }
