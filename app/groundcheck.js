// ================= What the crane stands on: hazards from the site under each outrigger pad / track =================
// Imported sites carry manholes, pits, drains and the deck edge. A pad or mat on (or next to) one of those is a ground
// bearing problem the GBP figure alone doesn't show – flag it in the crane's checks.
const GC = { get manhole() { return rule("ground.manhole") ?? 1.0; }, get drain() { return rule("ground.drain") ?? 1.5; }, get edge() { return rule("ground.edge") ?? 2.0; } };   // Rules & limits   // clearances, m
function polyDist(A, B) {
  if (A.some(p => inPolyPt(p, B)) || B.some(p => inPolyPt(p, A))) return 0;
  let d = Infinity;
  for (const [P, Q] of [[A, B], [B, A]]) for (const p of P) for (let i = 0; i < Q.length; i++) d = Math.min(d, segDist(p, Q[i], Q[(i + 1) % Q.length]));
  return d;
}
const lineDist = (A, L) => { let d = Infinity; for (let i = 0; i < L.length - 1; i++) { for (const p of A) d = Math.min(d, segDist(p, L[i], L[i + 1])); for (const q of [L[i], L[i + 1]]) if (inPolyPt(q, A)) return 0; } return d; };
const circlePts = (x, y, r, n = 12) => Array.from({ length: n }, (_, i) => [x + r * Math.cos(i * 2 * Math.PI / n), y + r * Math.sin(i * 2 * Math.PI / n)]);
// the ground contact of each pad / track: the mat under it, else the pad (or track) itself
function craneFootprints(cr) {
  const C = REG.cranes[cr.model]; if (!C || C.type === "ped") return [];
  const mats = matsUnderCrane(cr, C), out = [];
  if (C.type === "cr") {
    const k = C.car;
    [-1, 1].forEach((sx, i) => { const xc = sx * k.gauge / 2, tl = trackContact(cr, C), P = [[xc - k.shoe / 2, -tl / 2], [xc + k.shoe / 2, -tl / 2], [xc + k.shoe / 2, tl / 2], [xc - k.shoe / 2, tl / 2]].map(p => craneLocalToWorld(cr, p));
      const ms = mats.filter(m => { const Q = obsPts(m); return P.some(p => inPolyPt(p, Q)) || Q.some(q => inPolyPt(q, P)); });
      const name = `${i ? "Right" : "Left"} track`;
      if (ms.length) ms.forEach(m => out.push({ name: name + " mat", P: obsPts(m), at: [m.x, m.y] })); else out.push({ name, P, at: centroid(P) }); });
    return out;
  }
  for (const pd of cranePads(cr, C)) {
    const m = mats.find(m => inPolyPt(pd.w, obsPts(m)));
    out.push(m ? { name: `${pd.name} mat`, P: obsPts(m), at: pd.w } : { name: `Pad ${pd.name}`, P: circlePts(pd.w[0], pd.w[1], 0.4), at: pd.w });
  }
  return out;
}
function groundWarnings(cr) {
  const F = craneFootprints(cr); if (!F.length) return { bad: [], warn: [] };
  const bad = [], warn = [], nm = o => o.note || o.label || (OBJ_TYPES[o.type]?.name || "").replace(/ –.*$/, "");
  const holes = plan.obstacles.filter(o => o.type === "manhole"), drains = plan.obstacles.filter(o => o.type === "drain" && (o.pts || []).length > 1);
  const decks = plan.obstacles.filter(o => o.type === "deck" && (o.pts || []).length > 2);
  for (const f of F) {
    for (const h of holes) { const d = polyDist(f.P, h.kind === "circle" ? circlePts(h.x, h.y, h.r || 0.5) : obsPts(h));
      if (d === 0) bad.push(`${f.name} sits on a manhole / pit (${nm(h)}) – move the crane or bridge it with a mat rated for the span`);
      else if (d < GC.manhole) warn.push(`${f.name} is ${fx(d, 1)} m from a manhole / pit (${nm(h)}) – keep ${fx(GC.manhole, 1)} m clear or bridge it`); }
    for (const l of drains) { const d = lineDist(f.P, l.pts);
      if (d < GC.drain) warn.push(`${f.name} is ${d === 0 ? "over" : fx(d, 1) + " m from"} an underground drain (${nm(l)}) – check its depth and cover, or spread the load with mats`); }
    if (decks.length) {
      const inside = decks.some(dk => inPolyPt(f.at, dk.pts));
      if (!inside) bad.push(`${f.name} is off the quay / yard deck – check what it stands on`);
      else { const e = Math.min(...decks.filter(dk => inPolyPt(f.at, dk.pts)).map(dk => Math.min(...f.P.map(p => Math.min(...dk.pts.map((q, i) => segDist(p, q, dk.pts[(i + 1) % dk.pts.length]))))))); if (e < GC.edge) warn.push(`${f.name} is ${fx(e, 1)} m from the deck edge – check edge / quay-wall loading`); }
    }
  }
  return { bad: [...new Set(bad)], warn: [...new Set(warn)] };
}
{ const _cs = craneSummary; craneSummary = function (cr) {
    const S = _cs(cr);
    try { const g = groundWarnings(cr); if (g.bad.length || g.warn.length) { S.ground = g; S.warn.push(...g.bad, ...g.warn); if (g.bad.length) S.status = "bad"; else if (S.status === "ok") S.status = "amber"; } } catch (e) { console.warn(e); }
    return S;
  }; }
// berthing: a vessel near the edge of an imported quay / yard deck berths along that edge too (not only along a drawn quay line)
{ const _nq = nearestQuaySeg; nearestQuaySeg = function (o) {
    const q = _nq(o); if (q) return q;
    let best = null; const reach = (+o.h || 15) / 2 + 40;
    for (const dk of plan.obstacles) {
      if (dk.type !== "deck" || !(dk.pts || []).length) continue;
      let P = dk.pts, A = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; A += a[0] * b[1] - b[0] * a[1]; }
      if (A < 0) P = [...P].reverse();                    // counter-clockwise: the deck (land) is on the left of each edge, as for a quay line
      for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 15) continue; const d = segDist([o.x, o.y], a, b); if (d < reach && (!best || d < best.d)) best = { d, a, b }; }
    }
    return best;
  }; }
