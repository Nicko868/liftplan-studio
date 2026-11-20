// ---------- Crane mats as site objects (shore cranes only – vessel cranes have no ground bearing check) ----------
// A mat is an ordinary site object (type "mat", rectangle, L × W adjustable). The GBP check looks for mats under
// the crane's outrigger pads / tracks and uses the area of one mat; with no mat it falls back to the pad / track.
// ground contact length of a crawler track (idler to sprocket centres) – shorter than the track's overall length
function trackContact(cr, C) { C = C || REG.cranes[cr?.model]; const k = C?.car || {}, v = +cr?.trackContact || +k.contact; return v > 0 ? Math.min(v, k.len || v) : Math.round((k.len || 10) * 0.9 * 100) / 100; }
const trackContactSrc = (cr, C) => { C = C || REG.cranes[cr?.model]; return +cr?.trackContact > 0 ? "set for this crane" : +C?.car?.contact > 0 ? "from the crane's data" : "estimate: 90 % of the " + fx(C?.car?.len || 10, 2) + " m overall track – enter the spec value"; };
const isMat = o => o && o.type === "mat" && o.kind === "rect";
function craneLocalToWorld(cr, p) { const r = rot2(p, -(+cr.heading || 0)); return [r[0] + cr.x, r[1] + cr.y]; }
function cranePads(cr, C) {
  if (!C || !C.or) return [];
  const om = C.or.modes[cr.orMode] || Object.values(C.or.modes)[0];
  return om.pads.map(([sx, y], i) => ({ name: "P" + (i + 1), local: [sx * om.spread / 2, y], w: craneLocalToWorld(cr, [sx * om.spread / 2, y]) }));
}
function craneTracks(cr, C) {
  if (!C || C.type !== "cr") return [];
  const k = C.car, tl = trackContact(cr, C); return [-1, 1].map(sx => { const xc = sx * k.gauge / 2, pts = []; for (const dx of [-k.shoe / 2 + 0.1, 0.013, k.shoe / 2 - 0.1]) { const nY = Math.max(2, Math.ceil((tl - 0.1) / 0.25)); for (let j = 0; j <= nY; j++) pts.push(craneLocalToWorld(cr, [xc + dx, -tl / 2 + 0.05 + (tl - 0.1) * j / nY])); } return { side: sx, pts }; });
}
// the lift a crane is in (its own copy of the crane in each lift)
function liftIdOf(cr) { const L = (plan.lifts || []).find(L => (L.cranes || []).includes(cr)); return L ? L.id : (plan.cranes || []).includes(cr) && typeof curLiftId === "function" ? curLiftId() : null; }
function matsUnderCrane(cr, C, obs) {
  C = C || REG.cranes[cr.model]; obs = obs || plan.obstacles; if (!C || C.type === "ped") return [];
  const lid = (plan.lifts || []).length > 1 ? liftIdOf(cr) : null;
  const mats = obs.filter(m => isMat(m) && (!lid || !m.lift || m.lift === "shared" || m.lift === lid)); if (!mats.length) return [];
  if (C.type === "cr") { const T = craneTracks(cr, C); return mats.filter(m => { const P = obsPts(m); return T.some(t => t.pts.some(p => inPolyPt(p, P))); }); }
  const pads = cranePads(cr, C); return mats.filter(m => { const P = obsPts(m); return pads.some(pd => inPolyPt(pd.w, P)); });
}
const matLW = m => [Math.max(+m.w || 0, +m.h || 0), Math.min(+m.w || 0, +m.h || 0)];
// everything the GBP check, panel and sheets need to know about what the crane stands on
const MAT_AREA_CACHE = new Map();
function matAreaAlongTrack(cr, C, ms, sx, tl) {
  if (!ms.length) return 0;
  const key = JSON.stringify([cr.x, cr.y, cr.heading, cr.model, tl, sx, ms.map(m => [m.x, m.y, m.w, m.h, m.rot])]);
  if (MAT_AREA_CACHE.has(key)) return MAT_AREA_CACHE.get(key);
  // mats square to the crane (the usual case): exact – each mat's rectangle clipped to the track contact and to this side
  const hd = +cr.heading || 0, sq = ms.every(m => { const d = (((+m.rot || 0) - hd) % 90 + 90) % 90; return d < 0.5 || d > 89.5; });
  if (sq) { let A = 0; const loc0 = q => rot2([q[0] - cr.x, q[1] - cr.y], hd);
    for (const m of ms) { const Q = obsPts(m).map(loc0), xs = Q.map(q => q[0] * sx), ys = Q.map(q => q[1]);
      const x0 = Math.max(0, Math.min(...xs)), x1 = Math.max(...xs), y0 = Math.max(-tl / 2, Math.min(...ys)), y1 = Math.min(tl / 2, Math.max(...ys));
      if (x1 > x0 && y1 > y0) A += (x1 - x0) * (y1 - y0); }
    A = Math.round(A * 100) / 100; if (MAT_AREA_CACHE.size > 400) MAT_AREA_CACHE.clear(); MAT_AREA_CACHE.set(key, A); return A; }
  const P = ms.map(m => obsPts(m)), st = 0.05, k = C.car;
  // how far across the mats reach on this side of the crane (local x), so the grid covers them
  const loc = q => rot2([q[0] - cr.x, q[1] - cr.y], +cr.heading || 0);
  const xs = P.flat().map(q => loc(q)[0] * sx).filter(Number.isFinite), xMax = Math.max(k.gauge / 2 + k.shoe, ...xs);
  let n = 0;
  for (let y = -tl / 2 + st / 2; y < tl / 2; y += st) for (let x = st / 2; x < xMax; x += st) { const w = craneLocalToWorld(cr, [sx * x, y]); if (P.some(q => inPolyPt(w, q))) n++; }
  const a = Math.round(n * st * st * 100) / 100;
  if (MAT_AREA_CACHE.size > 400) MAT_AREA_CACHE.clear(); MAT_AREA_CACHE.set(key, a); return a;
}
function matInfo(cr, C) {
  C = C || REG.cranes[cr.model];
  if (!C || C.type === "ped") return { on: false, none: true, area: 0, basis: "vessel", mats: [], text: "Vessel crane – no mats" };
  const mats = matsUnderCrane(cr, C);
  const sizes = [...new Set(mats.map(m => matLW(m).map(v => fx(v, 1)).join(" × ")))];
  if (C.type === "cr") {
    const tl = trackContact(cr, C), ta = tl * (C.car.shoe || 1.2), T = craneTracks(cr, C);
    if (mats.length) {
      // area of the mats under ONE track (a mat under both tracks counts half to each); the smaller track governs
      const seen = new Set(), flat = mats.filter(m => { const k = [m.x, m.y, m.w, m.h, m.rot || 0].map(v => (+v || 0).toFixed(2)).join(); if (seen.has(k)) return false; seen.add(k); return true; });   // stacked mats: one ground footprint
      const under = T.map(t => flat.filter(m => { const P = obsPts(m); return t.pts.some(p => inPolyPt(p, P)); }));
      // only the mat area alongside the track's ground contact counts: a 10 m mat under an 8 m track gives 8 m of it
      // (mat area past the track ends carries nothing). Across the track the whole mat width counts; a plate under
      // both tracks is split at the crane's centre line.
      const side = under.map((ms, k) => ({ n: ms.length, a: matAreaAlongTrack(cr, C, ms, k ? 1 : -1, tl) }));
      const bare = side.findIndex(x => !x.n);
      if (bare >= 0) return { on: false, partial: true, mats, area: ta, basis: "track", text: `No mats under the ${bare ? "right" : "left"} track – GBP on the track (${fx(tl, 2)} m contact × ${fx(C.car.shoe, 2)} m)`, short: `${fx(ta, 2)} m² track` };
      const g = side[0].a <= side[1].a ? side[0] : side[1];
      return { on: true, mats, area: g.a, basis: "matrow", text: `${mats.length} × mat ${sizes.join(" / ")} m – ${g.n} under each track · counted along the ${fx(tl, 1)} m track contact only`, short: `${fx(g.a, 2)} m² of mats under one track (over its ${fx(tl, 1)} m contact)` };
    }
    return { on: false, mats, area: ta, basis: "track", text: `No mats – on tracks (${fx(tl, 2)} m ground contact × ${fx(C.car.shoe, 2)} m each)`, short: `${fx(ta, 2)} m² track` };
  }
  const pads = cranePads(cr, C), d = (C.or && C.or.float) || 0.6, padA = Math.PI * d * d / 4;
  const per = pads.map(pd => { const under = mats.filter(m => inPolyPt(pd.w, obsPts(m))); return { pd, m: under.length ? under.reduce((a, b) => (a.w * a.h <= b.w * b.h ? a : b)) : null }; });
  const bare = per.filter(x => !x.m).map(x => x.pd.name);
  if (!mats.length) return { on: false, mats, area: padA, basis: "pad", text: `No mats – on outrigger pads Ø${fx(d, 2)} m`, short: `${fx(padA, 2)} m² pad` };
  if (bare.length) return { on: false, partial: true, mats, area: padA, basis: "pad", text: `No mat under ${bare.join(", ")} – GBP on pad Ø${fx(d, 2)} m`, short: `${fx(padA, 2)} m² pad (no mat under ${bare.join(", ")})` };
  const m = per.map(x => x.m).reduce((a, b) => (a.w * a.h <= b.w * b.h ? a : b)), [L, W] = matLW(m);
  return { on: true, mats, area: L * W, basis: "mat", L, W, text: `${mats.length} × mat ${sizes.join(" / ")} m`, short: `${fx(L, 1)} × ${fx(W, 1)} m mat` };
}
// drop mats under the crane's pads (one each) or across its tracks, lined up with the crane
function placeMats(cr, L, W) {
  const C = REG.cranes[cr.model]; if (!C || C.type === "ped") return 0;
  const add = (x, y, w, h) => { const o = makeObject("mat", [x, y]); Object.assign(o, { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, w, h, rot: +cr.heading || 0, label: "Mat" }); plan.obstacles.push(o); return o; };
  let n = 0;
  if (C.type === "cr") return layCrawlerMats(cr, L || 6.0, W || 1.2, "perp");
  {
    L = +L || 2.5; W = +W || 2.5;
    for (const pd of cranePads(cr, C)) { if (plan.obstacles.some(m => isMat(m) && inPolyPt(pd.w, obsPts(m)))) continue; add(pd.w[0], pd.w[1], W, L); n++; }
  }
  return n;
}
// mats this crane stands on that no crane in another lift is also using (those can travel with the crane)
function matsToCarry(cr) {
  if (cr.matLock === false) return [];   // mats unlocked from the crane: the crane moves on its own
  const mine = matsUnderCrane(cr); if (!mine.length) return [];
  const others = [];   // each lift has its own mats – only another crane in this lift standing on the same mat stops it moving
  plan.cranes.forEach(c => { if (c !== cr) others.push(...matsUnderCrane(c)); });
  return mine.filter(m => !others.includes(m));
}
// older plans kept the mat size on the crane – turn it into real mat objects once
function migrateMats(p) {
  if (p.matsV >= 2) return; p.matsV = 2;
  const prev = plan; plan = p;
  try {
    const seen = [];
    (p.lifts || [{ cranes: p.cranes }]).forEach(Lf => (Lf.cranes || []).forEach(cr => {
      const C = REG.cranes[cr.model]; if (!C || C.type === "ped" || cr.mats === false || !((+cr.matW || 0) > 0 && (+cr.matL || 0) > 0)) return;
      if (seen.some(s => Math.hypot(s.x - cr.x, s.y - cr.y) < 0.05 && s.h === cr.heading && s.m === cr.model)) return; seen.push({ x: cr.x, y: cr.y, h: cr.heading, m: cr.model });
      if (C.type === "cr") placeMats(cr, Math.max(cr.matW, cr.matL), Math.min(cr.matW, cr.matL)); else placeMats(cr, +cr.matL, +cr.matW);
    }));
  } finally { plan = prev; }
}

// crawler mats: laid perpendicular (across) or parallel (along) to the tracks, centred on each track
// n = how many under each track, in one row along the track (blank = enough to cover the track's ground contact)
function layCrawlerMats(cr, L, W, ori, nPer) {
  const C = REG.cranes[cr.model]; if (!C || C.type !== "cr") return 0;
  if (ori === "one") { ori = "par"; nPer = nPer || 1; }
  L = +L || 6.0; W = +W || 1.2; const k = C.car, h = +cr.heading || 0; let n = 0;
  const add = (lx, ly, w, hh) => { const p = craneLocalToWorld(cr, [lx, ly]), o = makeObject("mat", p); Object.assign(o, { x: Math.round(p[0] * 100) / 100, y: Math.round(p[1] * 100) / 100, w, h: hh, rot: h, label: "Mat" }); plan.obstacles.push(o); n++; };
  for (const sx of [-1, 1]) {
    const xc = sx * k.gauge / 2;
    if (+nPer > 0) { const pitch = ori === "par" ? L : W, m = Math.round(+nPer);
      for (let i = 0; i < m; i++) { const y = -m * pitch / 2 + pitch / 2 + i * pitch; if (ori === "par") add(xc, y, W, L); else add(xc, y, L, W); } continue; }
    if (ori === "par") { const rows = Math.max(1, Math.ceil(k.len / L)), cols = Math.max(1, Math.ceil(k.shoe / W));
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) add(xc - cols * W / 2 + W / 2 + q * W, -rows * L / 2 + L / 2 + r * L, W, L); }
    else { const per = Math.max(1, Math.ceil(k.len / W)); for (let i = 0; i < per; i++) add(xc, -per * W / 2 + W / 2 + i * W, L, W); }
  }
  return n;
}
function addCrawlerMat(cr, L, W, ori) {
  const C = REG.cranes[cr.model], k = C.car, p = craneLocalToWorld(cr, [k.gauge / 2 + (+L || 6) / 2 + 2, 0]), o = makeObject("mat", p);
  Object.assign(o, { x: Math.round(p[0] * 100) / 100, y: Math.round(p[1] * 100) / 100, w: ori === "par" ? +W || 1.2 : +L || 6, h: ori === "par" ? +L || 6 : +W || 1.2, rot: +cr.heading || 0, label: "Mat" });
  plan.obstacles.push(o); return o;
}
// which mats to draw: the ones under this lift's cranes (all lifts when "All lifts" is on) plus any loose mat under no crane
// the lift a mat belongs to: the lift whose cranes are on plan.cranes right now (withLift swaps them in)
function curLiftId() { const L = (plan.lifts || []).find(L => L.cranes === plan.cranes) || (plan.lifts || [])[plan.al]; return L ? L.id : null; }
// mats carry the lift they were laid / added in (m.lift). Older mats get one here: the lift whose crane stands on
// them, else the lift with the nearest crane. A mat under cranes of several lifts (same set-up) is shared – no tag.
function tagMats() {
  const lifts = plan.lifts || []; if (lifts.length < 2) return;
  const add = [];
  for (const m of plan.obstacles) {
    if (!isMat(m) || (m.lift && m.lift !== "shared")) continue;
    const on = lifts.filter(L => (L.cranes || []).some(c => { const C = REG.cranes[c.model]; return C && matsUnderCrane(c, C, [{ ...m, lift: undefined }]).length; }));
    if (on.length) { m.lift = on[0].id; on.slice(1).forEach(L => add.push({ ...clone(m), id: uid(), lift: L.id })); continue; }
    let best = null, bd = 1e9; for (const L of lifts) for (const c of L.cranes || []) { const d = Math.hypot(c.x - m.x, c.y - m.y); if (d < bd) { bd = d; best = L; } }
    m.lift = best ? best.id : lifts[0].id;
  }
  plan.obstacles.push(...add);
}
function shownMatIds() {
  const mats = plan.obstacles.filter(isMat), out = new Set(); if (!mats.length) return out;
  if (typeof allMode !== "undefined" && allMode) { mats.forEach(m => out.add(m.id)); return out; }
  tagMats(); const cur = curLiftId();
  mats.forEach(m => { if (!m.lift || m.lift === cur || (plan.lifts || []).length < 2) out.add(m.id); });
  return out;
}
const matHidden = (o, S) => (isMat(o) && !S.has(o.id)) || (typeof itemInLift === "function" && !itemInLift(o));   // a mat of another lift, or an item used in another lift only
