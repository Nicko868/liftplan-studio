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
// ---------------- cranes in the same lift standing on each other or swinging into each other ----------------
// Each crane's plan footprint: the carrier (or crawler tracks), the outrigger beams and pads, and the mats it stands on.
// Two footprints that overlap can't both be set up there. The superstructure's tail swing (data: up.tail) that reaches
// the other crane's carrier / tracks, or the other crane's own tail swing, is flagged so the slews are kept apart.
const segX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
function polysTouch(A, B) { if (polyDist(A, B) === 0) return true; for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) if (segX(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return true; return false; }
function craneBodyPolys(cr) {
  const C = REG.cranes[cr.model]; if (!C || C.type === "ped") return null;
  const W = p => craneLocalToWorld(cr, p), rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(W), body = [], legs = [];
  if (C.type === "cr") { const k = C.car; body.push(rect(-k.gauge / 2 - k.shoe / 2, -k.len / 2, k.gauge / 2 + k.shoe / 2, k.len / 2)); }
  else { const k = C.car || {}, w = (+k.w || 2.8) / 2; body.push(rect(-w, +k.rear || -4, w, +k.front || 6));
    for (const pd of cranePads(cr, C)) { const [x, y] = pd.local, f = Math.max(0.3, (+C.or?.float || 0.6) / 2); legs.push(rect(Math.min(x, 0), y - 0.25, Math.max(x, 0), y + 0.25), rect(x - f, y - f, x + f, y + f)); } }
  const mats = matsUnderCrane(cr, C).map(m => obsPts(m));
  return { C, body, all: [...body, ...legs, ...mats], tail: +C.up?.tail || 0 };
}
function craneClashWarnings(cr) {
  const bad = [], warn = [], A = craneBodyPolys(cr); if (!A) return { bad, warn };
  const nm = c => c.label || REG.cranes[c.model]?.short || "the other crane", me = nm(cr);
  for (const o of plan.cranes) { if (o === cr) continue; const B = craneBodyPolys(o); if (!B) continue;
    if (A.all.some(P => B.all.some(Q => polysTouch(P, Q)))) { bad.push(`${me}: its outriggers / mats clash with ${nm(o)}'s – the two set-ups overlap; move one crane`); continue; }
    const d = Math.hypot(o.x - cr.x, o.y - cr.y), circ = (r, c) => circlePts(c.x, c.y, r, 24);
    if (A.tail > 0 && B.body.some(P => polysTouch(circ(A.tail, cr), P))) warn.push(`${me}: its tail swing (R ${fx(A.tail, 1)} m) reaches ${nm(o)}'s carrier – limit the slew or move a crane`);
    else if (A.tail > 0 && B.tail > 0 && d < A.tail + B.tail) warn.push(`${me}: its tail swing and ${nm(o)}'s overlap (${fx(d, 1)} m apart, ${fx(A.tail + B.tail, 1)} m needed) – never slew both tails towards each other`); }
  return { bad, warn };
}
{ const _cs = craneSummary; craneSummary = function (cr) {
    const S = _cs(cr);
    try { const g = groundWarnings(cr), k = craneClashWarnings(cr); g.bad.push(...k.bad); g.warn.push(...k.warn);
      if (g.bad.length || g.warn.length) { S.ground = g; S.warn.push(...g.bad, ...g.warn); if (g.bad.length) S.status = "bad"; else if (S.status === "ok") S.status = "amber"; } } catch (e) { console.warn(e); }
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
