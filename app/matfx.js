// ================= Crane mats: only the ground contact area that really carries load =================
// A mat spreads the track / pad load only as far as it is stiff and strong enough to. Past that the mat lifts or
// bends and the ground under it does nothing – so a 6 m timber mat under a 1.2 m track does not give 6 m of bearing.
// Method: D. Duerr, "Effective Bearing Length of Crane Mats" (2DM Associates) – the mat works as a cantilever past the
// track edge / pad; the cantilever that counts is the shortest of the bending, shear and deflection limits:
//   bending     Lc = t·√(Fb / 3q)            (cantilever moment q·Lc²/2 ≤ Fb·t²/6, per metre of mat width)
//   shear       Lc = t·(1 + Fv / 1.5q)         (shear at t from the support face: q·(Lc − t) ≤ Fv·t / 1.5)
// q in these is the net upward pressure on the cantilever: ground pressure less the mat's own weight (Duerr eq. 16).
//   deflection  Lc = ∛(E·t³ / (200·q))          (tip deflection q·Lc⁴/8EI ≤ 0.75 % of Lc, Duerr eq. 26–27)
// q = the ground pressure under the mat: the site's allowable ground bearing when it is set, otherwise the pressure the
// crane actually puts down (worked out by repeating the check). Effective area = the mat footprint on the GROUND (mats
// that overlap or are stacked count once) inside the track / pad grown by Lc on every side.
const MAT_MAT = {
  timber: { name: "Timber (hardwood)", Fb: 9.65, Fv: 1.38, E: 8274, rho: 1.0 },      // Duerr's mixed hardwood: 1,400 / 200 / 1,200,000 psi
  steel: { name: "Steel", Fb: 165, Fv: 100, E: 200000, rho: 7.85 },                   // S275 / A36 allowable ≈ 0.66 fy, 0.4 fy
  composite: { name: "Composite / HDPE", Fb: 8, Fv: 2, E: 1100, rho: 0.95 }           // conservative – use the maker's figures if you have them
};
// ON THE SHELF (Nicko, Oct 2026): ground bearing uses the full area of the mats under one track / under the pad.
// The effective-area method below is kept for later but switched off – set MATFX_ON = true to bring it back.
const MATFX_ON = false;
const MPA = 101.97;   // 1 MPa in t/m²
const matMaterial = m => MAT_MAT[m?.matl] ? m.matl : (/steel/i.test(m?.label || "") ? "steel" : /composite|hdpe/i.test(m?.label || "") ? "composite" : "timber");
const matThk = m => Math.max(0.02, +m?.hgt || 0.2);
function matCantilever(m, q) {
  const P = MAT_MAT[matMaterial(m)], t = matThk(m); q = Math.max(1, (+q || 20) - (P.rho || 0) * t);   // net of the mat's own weight
  const b = t * Math.sqrt(P.Fb * MPA / (3 * q)), s = t * (1 + P.Fv * MPA / (1.5 * q)), d = Math.cbrt(P.E * MPA * t ** 3 / (200 * q));
  let Lc = Math.min(b, s, d), by = Lc === b ? "bending" : Lc === s ? "shear" : "stiffness";
  // simple rule (default): timber / composite count up to 3 × their thickness past the track or pad – never more than the strength allows
  if ((plan.site.matRule || "simple") === "simple" && matMaterial(m) !== "steel" && 3 * t < Lc) { Lc = 3 * t; by = "3 × thickness"; }
  return { Lc, by, b, s, d };
}
// ground area of the mats that one support (track rectangle / pad) can load
function supportEffArea(cr, mats, sup, q) {
  if (!mats.length) return { a: 0, raw: 0, Lc: 0 };
  const L = mats.map(m => ({ m, P: obsPts(m), c: matCantilever(m, q) })), grow = Math.min(4, Math.max(...L.map(x => x.c.Lc)));
  // a mat that runs from one track to the other: each track only gets its own side of the centre line between them
  const x0 = Math.max(sup.x0 - grow, sup.cx0 ?? -1e9), x1 = Math.min(sup.x1 + grow, sup.cx1 ?? 1e9), y0 = sup.y0 - grow, y1 = sup.y1 + grow;
  const st = Math.max(0.05, Math.min(0.15, Math.sqrt((x1 - x0) * (y1 - y0) / 6000)));
  let n = 0, nRaw = 0;
  for (let x = x0 + st / 2; x < x1; x += st) for (let y = y0 + st / 2; y < y1; y += st) {
    const w = craneLocalToWorld(cr, [x, y]), dx = Math.max(0, sup.x0 - x, x - sup.x1), dy = Math.max(0, sup.y0 - y, y - sup.y1), d = Math.max(dx, dy);
    let raw = false, eff = false;
    for (const it of L) if (inPolyPt(w, it.P)) { raw = true; if (d <= it.c.Lc) { eff = true; break; } }
    if (raw) nRaw++; if (eff) n++;
  }
  const rawAll = mats.reduce((a, m) => a + (+m.w || 0) * (+m.h || 0), 0);
  const gov = L.reduce((a, b) => (b.c.Lc < a.c.Lc ? b : a));
  return { a: Math.min(n * st * st, rawAll), raw: rawAll, rawIn: nRaw * st * st, Lc: gov.c.Lc, by: gov.c.by, m: gov.m };
}
const GAWH = new WeakMap();   // last gross applied weight per crane – the pressure the mats work against when no allowable is set
const matEffCache = new Map();
{ const _mi = matInfo; matInfo = function (cr, C) {
    const M = _mi(cr, C); C = C || REG.cranes[cr.model];
    if (!MATFX_ON) return M;
    if (!C || C.type === "ped" || !M.on || !M.mats.length) return M;
    try {
      const gbc = gbcFor(cr), gaw = GAWH.get(cr) || 0;
      const qOf = A => gbc > 0 ? gbc : gaw > 0 && A > 0 ? Math.max(5, gaw * 0.75 / A) : 20;
      const key = JSON.stringify([plan.site.matRule || "simple", cr.model, cr.trackContact, cr.x, cr.y, cr.heading, cr.orMode, gbc, Math.round(gaw * 10), M.mats.map(m => [m.x, m.y, m.w, m.h, m.rot, m.hgt, m.matl])]);
      let R = matEffCache.get(key);
      if (!R) {
        const sups = [];
        if (C.type === "cr") { const k = C.car; for (const sx of [-1, 1]) { const xc = sx * k.gauge / 2; const tl = trackContact(cr, C); sups.push({ name: sx < 0 ? "left track" : "right track", x0: xc - k.shoe / 2, x1: xc + k.shoe / 2, y0: -tl / 2, y1: tl / 2, ...(sx < 0 ? { cx1: 0 } : { cx0: 0 }) }); } }
        else { const d = (C.or && C.or.float) || 0.6; for (const pd of cranePads(cr, C)) sups.push({ name: pd.name, x0: pd.local[0] - d / 2, x1: pd.local[0] + d / 2, y0: pd.local[1] - d / 2, y1: pd.local[1] + d / 2 }); }
        let A = M.area; const res = [];
        for (let it = 0; it < (gbc > 0 ? 1 : 4); it++) {
          res.length = 0;
          for (const s of sups) {
            const P = []; for (let x = s.x0 + 0.05; x <= s.x1 - 0.05 + 1e-9; x += Math.max(0.1, (s.x1 - s.x0 - 0.1) / 4)) for (let y = s.y0 + 0.05; y <= s.y1 - 0.05 + 1e-9; y += Math.max(0.1, Math.min(0.3, (s.y1 - s.y0 - 0.1) / 4))) P.push(craneLocalToWorld(cr, [x, y]));   // points over the track / pad footprint
            const mine = M.mats.filter(m => { const Q = obsPts(m); return P.some(p => inPolyPt(p, Q)); });
            res.push({ s, ...supportEffArea(cr, mine, s, qOf(A)) });
          }
          const g = res.reduce((a, b) => (b.a < a.a ? b : a)); if (Math.abs(g.a - A) < 0.02 * A) { A = g.a; break; } A = g.a;
        }
        const g = res.reduce((a, b) => (b.a < a.a ? b : a));
        R = { g, q: qOf(A), fromGbc: gbc > 0 }; if (matEffCache.size > 400) matEffCache.clear(); matEffCache.set(key, R);
      }
      const g = R.g, mt = MAT_MAT[matMaterial(g.m)], cut = g.a < (C.type === "cr" ? M.area : M.L * M.W) - 0.05;
      const side = C.type === "cr" ? "the track" : "the pad", rule = g.by === "3 × thickness" ? `3 × ${fx(matThk(g.m) * 1000, 0)} mm ${mt.name.toLowerCase()}` : `${fx(matThk(g.m) * 1000, 0)} mm ${mt.name.toLowerCase()}, ${g.by} at ${fx(R.q, 1)} t/m²`;
      const how = `mats count ${fx(g.Lc, 2)} m either side of ${side} – ${rule}`;
      return { ...M, area: g.a, rawArea: C.type === "cr" ? M.area : M.L * M.W, eff: true, cut, Lc: g.Lc, by: g.by, q: R.q, gov: g.s.name,
        text: `${M.text} · ${how} · ${fx(g.a, 1)} m² working${cut ? ` of ${fx(C.type === "cr" ? M.area : M.L * M.W, 1)} m²` : " (all of it)"} under the ${C.type === "cr" ? "busiest track" : "smallest pad"}`,
        short: `${fx(g.a, 2)} m² effective ${C.type === "cr" ? "under one track" : "mat area"}`, how };
    } catch (e) { console.warn(e); return M; }
  }; }
// the check runs against the crane's own pressure when no allowable is set: settle it in one extra pass when the weight changes
{ const _cs = craneSummary; craneSummary = function (cr) {
    let S = _cs(cr);
    if (S && S.GAW > 0 && !(gbcFor(cr) > 0) && S.mat?.eff) { const h = GAWH.get(cr) || 0; if (Math.abs(h - S.GAW) > 0.01 * S.GAW) { GAWH.set(cr, S.GAW); S = _cs(cr); } }
    else if (S && S.GAW > 0) GAWH.set(cr, S.GAW);
    return S;
  }; }
// mats know what they are made of (sets the stiffness the effective area comes from)
{ const _mk = makeObject; makeObject = function (type, ...a) { const T = OBJ_TYPES[type], o = _mk(type, ...a); if (o && T?.mat) { o.matl = /steel/i.test(T.name) ? "steel" : /composite/i.test(T.name) ? "composite" : "timber"; if (o.matl === "timber" && /crawler/i.test(T.name)) o.hgt = Math.max(+o.hgt || 0, 0.3); } return o; }; }
// mat panel: material next to the thickness, and what the check makes of this mat
{ const _rp = renderProps; renderProps = function (...a) {
    const r = _rp.apply(this, a);
    try {
      const o = sel?.kind === "obs" ? plan.obstacles.find(x => x.id === sel.id) : null;
      if (MATFX_ON && o && isMat(o) && $("oHgt") && !$("oMatl")) {
        const wrap = $("oHgt").closest("label") || $("oHgt").parentElement, d = document.createElement("div");
        const cr = plan.cranes.find(c => matsUnderCrane(c).includes(o)), c = matCantilever(o, cr ? matInfo(cr).q : (+plan.site.gbc || 20));
        d.innerHTML = `<label>Mat material<select id="oMatl">${Object.entries(MAT_MAT).map(([k, v]) => `<option value="${k}" ${matMaterial(o) === k ? "selected" : ""}>${v.name}</option>`).join("")}</select></label>
          <p class="small" style="margin:4px 0 0">Only the part of the mat near the ${cr && REG.cranes[cr.model]?.type === "cr" ? "track" : "pad"} counts for ground bearing: this ${fx(matThk(o) * 1000, 0)} mm ${MAT_MAT[matMaterial(o)].name.toLowerCase()} mat counts <b>${fx(c.Lc, 2)} m</b> past the ${cr && REG.cranes[cr.model]?.type === "cr" ? "track edge" : "pad"} (${c.by}). Thicker mats count further. Stacked or overlapping mats count once – only the ground contact.</p>`;
        wrap.after(d);
        $("oMatl").onchange = e => { o.matl = e.target.value; markDirty(); renderAll(); };
      }
    } catch (e) { console.warn(e); }
    return r;
  }; }
// crawler mats laid from the crane panel are timber (300 mm unless the planner sets another thickness on a mat)
{ const _lay = layCrawlerMats; layCrawlerMats = function (cr, ...a) {
    const before = new Set(plan.obstacles.filter(isMat).map(m => m.id)), r = _lay.call(this, cr, ...a);
    for (const m of plan.obstacles) if (isMat(m) && !before.has(m.id)) { m.matl = cr.matMatl || "timber"; m.hgt = +cr.matThk || 0.3; }
    return r;
  }; }
// plan view: with the crane selected, a dashed outline shows how far past each track / pad the mats count
{ const _sp = siteParts; siteParts = function (phaseMode, ui, ...a) {
    const parts = _sp.call(this, phaseMode, ui, ...a);
    try {
      const cr = ui && sel?.kind === "crane" ? plan.cranes.find(c => c.id === sel.id) : null, C = cr && REG.cranes[cr.model];
      if (cr && C && C.type !== "ped") { const M = matInfo(cr, C);
        if (M.eff) { const s = new Scene(), g = M.Lc, col = "#1f8a4c";
          const zone = (x0, x1, y0, y1) => s.poly("LOAD", [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(p => craneLocalToWorld(cr, p)), { closed: true, dash: [0.5, 0.3], w: 3.5, color: col, fill: "rgba(31,138,76,.16)" });
          if (C.type === "cr") { const k = C.car; for (const sx of [-1, 1]) { const xc = sx * k.gauge / 2; const tl = trackContact(cr, C); zone(Math.max(xc - k.shoe / 2 - g, sx < 0 ? -1e9 : 0), Math.min(xc + k.shoe / 2 + g, sx < 0 ? 0 : 1e9), -tl / 2 - g, tl / 2 + g); } }
          else { const d = (C.or && C.or.float) || 0.6; for (const pd of cranePads(cr, C)) zone(pd.local[0] - d / 2 - g, pd.local[0] + d / 2 + g, pd.local[1] - d / 2 - g, pd.local[1] + d / 2 + g); }
          parts.push({ key: "mateff:" + cr.id, scene: s, ui: true, nohit: true }); } }
    } catch (e) { console.warn(e); }
    return parts;
  }; }
// crane panel (crawler): the track's ground contact length, next to the mats
{ const _rp = renderProps; renderProps = function (...a) {
    const r = _rp.apply(this, a);
    try {
      const c = sel?.kind === "crane" ? plan.cranes.find(x => x.id === sel.id) : null, C = c && REG.cranes[c.model];
      const h = C && C.type === "cr" ? [...document.querySelectorAll("#props h4, #props details.psec > summary")].find(x => /Crawler mats/.test(x.textContent)) : null;
      if (h && !$("pTrackC")) {
        const d = document.createElement("div");
        d.innerHTML = `<label>Track ground contact length (m)<input type="number" id="pTrackC" step="0.01" min="1" value="${c.trackContact || ""}" placeholder="${fx(trackContact(c, C), 2)} – ${escH(trackContactSrc({}, C))}"></label>
          <p class="small" style="margin:2px 0 6px">The length of track on the ground, idler to sprocket (from the crane's spec sheet) – shorter than the ${fx(C.car.len, 2)} m overall length. Used for ground bearing when the crane stands on its tracks without mats.</p>`;
        h.after(d);
        $("pTrackC").onchange = e => { const v = +e.target.value; if (v > 0) c.trackContact = Math.min(v, C.car.len); else delete c.trackContact; markDirty(); renderAll(); };
      }
    } catch (e) { console.warn(e); }
    return r;
  }; }
// site setting: simple rule or detailed calculation for how far mats count
{ const el = $("matRule"); if (el && !MATFX_ON) { const lb = el.closest("label"); if (lb) lb.style.display = "none"; } if (el) { el.onchange = e => { plan.site.matRule = e.target.value; matEffCache.clear(); markDirty(); renderAll(true); }; }
  const _rm = renderMeta; renderMeta = function (...a) { const r = _rm.apply(this, a); if ($("matRule")) $("matRule").value = plan.site.matRule || "simple"; return r; }; }
// a new mat belongs to the lift it is made in, so it doesn't show up in the other lifts
{ const _mo = makeObject; makeObject = function (...a) { const o = _mo.apply(this, a); try { if (o && isMat(o) && (plan.lifts || []).length > 1) o.lift = curLiftId(); } catch (e) { } return o; }; }
// a new lift with the same cranes gets its own copy of their mats (same place), so each lift's mats are its own
{ const _al = addLift; addLift = function (kind, ...a) {
    syncLift(); const src = plan.lifts[plan.al]; tagMats(); if (src) for (const m of plan.obstacles) if (isMat(m) && (!m.lift || m.lift === "shared")) m.lift = src.id;
    const r = _al.call(this, kind, ...a);
    try {
      const L = plan.lifts[plan.al]; if (!src || !L || L === src) return r;
      const add = [];
      for (const x of L.cranes) { const c0 = src.cranes.find(c => (c.unit || c.id) === (x.unit || x.id) || (c.label === x.label && c.model === x.model)); if (!c0 || Math.hypot(c0.x - x.x, c0.y - x.y) > 0.05 || (+c0.heading || 0) !== (+x.heading || 0)) continue;
        const mine = withLift(plan.lifts.indexOf(src), () => matsUnderCrane(c0)); for (const m of mine) add.push({ ...clone(m), id: uid(), lift: L.id }); }
      if (add.length) { plan.obstacles.push(...add); renderAll(); }
    } catch (e) { console.warn(e); }
    return r;
  }; }
