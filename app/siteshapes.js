// ================= Find objects in a drawing (shape recognition) =================
// A drawing traced from a picture has no shapes in it – only short line pieces. This finds what those pieces draw:
//  · round tanks / silos – pieces that lie on the same circle, all the way round (the outer ring is kept)
//  · buildings / slabs   – pieces that join end to end into a closed, near-rectangular outline
// The finds are shown on the plan for review; the ones you keep become ordinary site items (tank / building) marked
// "~ (from drawing)" – sizes are approximate and heights are defaults to confirm. Items already on the plan are skipped.
const SHP = { cand: null };
function shpCircleFit(P) {   // algebraic (Kåsa) circle fit → {x, y, r, rms}
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0; const n = P.length;
  for (const [x, y] of P) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
  const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], b = [sxz, syz, sz];
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(A); if (Math.abs(d) < 1e-12) return null;
  const col = (i) => A.map((r, k) => r.map((v, j) => j === i ? b[k] : v));
  const a1 = det(col(0)) / d, a2 = det(col(1)) / d, a3 = det(col(2)) / d, x = a1 / 2, y = a2 / 2, r2 = a3 + x * x + y * y;
  if (!(r2 > 0)) return null; const r = Math.sqrt(r2);
  let e = 0; for (const p of P) e += (Math.hypot(p[0] - x, p[1] - y) - r) ** 2;
  return { x, y, r, rms: Math.sqrt(e / n) };
}
function shpDensify(P, step) { const out = [P[0]]; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step)); for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return out; }
const shpInside = (p, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const shpArea = P => { let s = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += (P[j][0] + P[i][0]) * (P[j][1] - P[i][1]); return Math.abs(s) / 2; };
function shpHull(P) { const p = [...P].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1)); }
function shpMinRect(P) {   // smallest rectangle round a point set (rotating the hull's edges)
  const H = shpHull(P); let best = null;
  for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length], t = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(t), s = Math.sin(t);
    let x0 = 1e18, x1 = -1e18, y0 = 1e18, y1 = -1e18; for (const q of H) { const u = q[0] * c + q[1] * s, v = -q[0] * s + q[1] * c; x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
    const A = (x1 - x0) * (y1 - y0); if (!best || A < best.A) { const um = (x0 + x1) / 2, vm = (y0 + y1) / 2; best = { A, w: x1 - x0, h: y1 - y0, rot: t / D2R, x: um * c - vm * s, y: um * s + vm * c }; } }
  return best; }
// existing site items – a find that sits on one of them is not offered again
function shpTaken(x, y, r = 0) {
  for (const o of plan.obstacles || []) { if (o.zone || o.kind === "dim") continue;
    if (o.kind === "circle" && Math.hypot(o.x - x, o.y - y) < Math.max(1, (o.r || 0) * 0.6, r * 0.6)) return true;
    if (o.kind === "rect") { const t = -(o.rot || 0) * D2R, dx = x - o.x, dy = y - o.y, u = dx * Math.cos(t) - dy * Math.sin(t), v = dx * Math.sin(t) + dy * Math.cos(t); if (Math.abs(u) <= o.w / 2 && Math.abs(v) <= o.h / 2 && o.type !== "laydown" && o.type !== "deck") return true; }
  } return false; }
function shpFind() {
  const k = dwgCur(); if (!k) return null; const objs = dwgEnsure(k.D) || []; const lines = objs.filter(o => !o.hide && o.k !== "t" && o.pts && o.pts.length >= 2);
  // ---- circles
  const arcs = [];
  for (const o of lines) { if (o.pts.length < 4) continue; const L = lenOf(o.pts); if (L < 1.2) continue;
    const f = shpCircleFit(o.pts); if (!f || f.r < 1.5 || f.r > 45 || f.rms > Math.max(0.05, f.r * 0.025)) continue;
    const span = L / f.r; if (span < 0.6 || span > 7) continue;
    const bins = new Set(); for (const p of shpDensify(o.pts, f.r * 0.1)) bins.add(Math.floor(((Math.atan2(p[1] - f.y, p[0] - f.x) + Math.PI) / (2 * Math.PI)) * 36) % 36);
    arcs.push({ ...f, bins }); }
  const used = new Array(arcs.length).fill(false), circ = [];
  arcs.sort((a, b) => b.bins.size - a.bins.size);
  for (let i = 0; i < arcs.length; i++) { if (used[i]) continue; const a = arcs[i], grp = [a]; used[i] = true;
    for (let j = i + 1; j < arcs.length; j++) { if (used[j]) continue; const b = arcs[j]; if (Math.hypot(a.x - b.x, a.y - b.y) < Math.max(0.5, a.r * 0.08) && Math.abs(a.r - b.r) < a.r * 0.1) { grp.push(b); used[j] = true; } }
    const bins = new Set(); grp.forEach(g => g.bins.forEach(v => bins.add(v))); if (bins.size < 26) continue;
    const w = grp.reduce((s, g) => s + g.bins.size, 0), x = grp.reduce((s, g) => s + g.x * g.bins.size, 0) / w, y = grp.reduce((s, g) => s + g.y * g.bins.size, 0) / w, r = grp.reduce((s, g) => s + g.r * g.bins.size, 0) / w;
    circ.push({ x, y, r }); }
  // concentric rings (shell + roof, double lines) → the outer one
  circ.sort((a, b) => b.r - a.r); const tanks = [];
  for (const c of circ) { if (tanks.some(t => Math.hypot(t.x - c.x, t.y - c.y) < t.r * 0.35 && c.r < t.r * 1.02) || tanks.some(t => Math.hypot(t.x - c.x, t.y - c.y) < t.r + c.r - 0.3 && Math.hypot(t.x - c.x, t.y - c.y) > t.r * 0.35)) continue; if (shpTaken(c.x, c.y, c.r)) continue; tanks.push(c); }
  // ---- closed outlines: join pieces end to end (0.4 m) and keep the loops
  const tol = 0.4, key = p => Math.round(p[0] / tol) + "," + Math.round(p[1] / tol), ends = new Map(), segs = [];
  for (const o of lines) { if (o.k === "a") { segs.push({ P: o.pts, closed: true }); continue; } const s = { P: o.pts, used: false }; segs.push(s);
    for (const [end, p] of [[0, o.pts[0]], [1, o.pts[o.pts.length - 1]]]) { const kk = key(p); if (!ends.has(kk)) ends.set(kk, []); ends.get(kk).push([s, end]); } }
  const near = p => { const [gx, gy] = [Math.round(p[0] / tol), Math.round(p[1] / tol)], out = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const l = ends.get((gx + dx) + "," + (gy + dy)); if (l) out.push(...l); } return out; };
  const loops = segs.filter(s => s.closed).map(s => s.P);
  for (const s0 of segs) { if (s0.closed || s0.used) continue; const chain = [...s0.P]; s0.used = true; let steps = 0, closed = false;
    while (steps++ < 400) { const tail = chain[chain.length - 1]; if (chain.length > 3 && Math.hypot(tail[0] - chain[0][0], tail[1] - chain[0][1]) < tol) { closed = true; break; }
      const nx = near(tail).filter(([s]) => !s.used && !s.closed); if (nx.length !== 1) break; const [s, end] = nx[0]; s.used = true; const Q = end === 0 ? s.P : [...s.P].reverse(); chain.push(...Q.slice(1)); }
    if (closed) loops.push(chain); }
  const blds = [];
  for (const P of loops) { const A = shpArea(P); if (A < 15 || A > 20000) continue; const R = shpMinRect(P); if (!R || A / R.A < 0.85 || Math.min(R.w, R.h) < 3 || A < 30) continue;
    if (shpTaken(R.x, R.y) || tanks.some(t => Math.hypot(t.x - R.x, t.y - R.y) < t.r)) continue; blds.push({ ...R, A }); }
  // nested outlines (double walls) → the outer one
  blds.sort((a, b) => b.A - a.A); const keep = [];
  for (const b of blds) { if (keep.some(o => Math.hypot(o.x - b.x, o.y - b.y) < Math.min(o.w, o.h) / 2 && b.A < o.A)) continue; keep.push(b); }
  return { tanks, blds: keep };
}
// ---- review on the plan
function shpOverlay() {
  const svg = $("site"); if (!svg) return; let g = svg.querySelector("#shpCand"); if (!SHP.cand) { if (g) g.remove(); return; }
  if (!g) { g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.id = "shpCand"; g.setAttribute("pointer-events", "none"); } svg.appendChild(g);
  const st = `fill="rgba(232,89,12,.10)" stroke="#e8590c" stroke-width="2.4" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"`; let h = "";
  if (SHP.cand.useT) for (const t of SHP.cand.tanks) if (!t.skip) h += `<circle cx="${t.x}" cy="${-t.y}" r="${t.r}" ${st}/>`;
  if (SHP.cand.useB) for (const b of SHP.cand.blds) if (!b.skip) h += `<rect x="${b.x - b.w / 2}" y="${-b.y - b.h / 2}" width="${b.w}" height="${b.h}" transform="rotate(${-b.rot} ${b.x} ${-b.y})" ${st}/>`;
  for (const t of SHP.cand.useT ? SHP.cand.tanks.filter(x => x.skip) : []) h += `<circle cx="${t.x}" cy="${-t.y}" r="${t.r}" fill="none" stroke="#9aa3ab" stroke-width="1.2" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`;
  for (const b of SHP.cand.useB ? SHP.cand.blds.filter(x => x.skip) : []) h += `<rect x="${b.x - b.w / 2}" y="${-b.y - b.h / 2}" width="${b.w}" height="${b.h}" transform="rotate(${-b.rot} ${b.x} ${-b.y})" fill="none" stroke="#9aa3ab" stroke-width="1.2" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`;
  g.innerHTML = h;
}
function shpPanel() {
  let p = $("shpBar"); const c = SHP.cand;
  if (!c) { if (p) p.hidden = true; return; }
  if (!p) { p = document.createElement("div"); p.id = "shpBar"; p.style.cssText = "position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:31;background:var(--surface,#fff);border:1px solid var(--line,#ccd);border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.18);padding:8px 10px;font-size:13px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:92%"; ($("site").parentNode || document.body).appendChild(p); }
  p.hidden = false;
  p.innerHTML = `<b>Found in the drawing</b>
    <label style="display:flex;gap:4px;align-items:center;margin:0"><input type="checkbox" id="shpT" ${c.useT ? "checked" : ""}> ${c.tanks.filter(x => !x.skip).length} round tank${c.tanks.filter(x => !x.skip).length === 1 ? "" : "s"}</label>
    <label style="display:flex;gap:4px;align-items:center;margin:0"><input type="checkbox" id="shpB" ${c.useB ? "checked" : ""}> ${c.blds.filter(x => !x.skip).length} building / slab outline${c.blds.filter(x => !x.skip).length === 1 ? "" : "s"}</label>
    <span class="small">click a find on the plan to leave it out · sizes ~ from the drawing · heights are defaults – set them after</span>
    <button class="pri" id="shpAdd" ${(c.useT && c.tanks.length) || (c.useB && c.blds.length) ? "" : "disabled"}>Add as site items</button><button id="shpNo">Cancel</button>`;
  $("shpT").onchange = e => { c.useT = e.target.checked; shpOverlay(); shpPanel(); };
  $("shpB").onchange = e => { c.useB = e.target.checked; shpOverlay(); shpPanel(); };
  $("shpNo").onclick = () => { SHP.cand = null; shpOverlay(); shpPanel(); };
  $("shpAdd").onclick = () => {
    let n = 0;
    if (c.useT) for (const t of c.tanks.filter(x => !x.skip)) { const o = makeObject("tank", [t.x, t.y]) || { id: uid(), type: "tank", kind: "circle", hgt: 10, color: "#95a5a6", zone: false };
      Object.assign(o, { kind: "circle", x: +t.x.toFixed(2), y: +t.y.toFixed(2), r: +t.r.toFixed(2), label: `Tank ~Ø${fx(2 * t.r, 1)} m (from drawing)`, fromDwg: true, approx: true }); delete o.pts; plan.obstacles.push(o); n++; }
    if (c.useB) for (const b of c.blds.filter(x => !x.skip)) { const o = makeObject("building", [b.x, b.y]) || { id: uid(), type: "building", kind: "rect", hgt: 4, color: "#b5b3ad", zone: false };
      Object.assign(o, { kind: "rect", x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.w.toFixed(2), h: +b.h.toFixed(2), rot: +b.rot.toFixed(1), label: `Building ~${fx(b.w, 1)} × ${fx(b.h, 1)} m (from drawing)`, fromDwg: true, approx: true }); delete o.pts; plan.obstacles.push(o); n++; }
    SHP.cand = null; shpOverlay(); shpPanel(); markDirty(); renderAll(); toast(`${n} site item${n === 1 ? "" : "s"} added – set their heights in the Site items list`);
  };
}
function shpStart() {
  const k = dwgCur(); if (!k) { toast("Import a site drawing first"); return; }
  if (k.D.fill) { toast("This drawing is filled ink – nothing to find in it"); return; }
  const t0 = performance.now(), r = shpFind(); if (!r) return;
  SHP.cand = { ...r, useT: true, useB: true };
  if (!r.tanks.length && !r.blds.length) { SHP.cand = null; toast("Nothing new found – the shapes are already site items, or the lines don't close"); return; }
  shpOverlay(); shpPanel(); console.info("shape finder", Math.round(performance.now() - t0), "ms");
}
{ const _rs = renderSite; renderSite = function (...a) { const r = _rs.apply(this, a); try { shpOverlay(); } catch (e) { } return r; }; }
// the button sits in the layout tools, next to the other clean-up tools
{ const _rl = renderLayoutTools; renderLayoutTools = function (...a) { const r = _rl.apply(this, a);
    try { const box = $("ltBoxUI"); if (box && !box.hidden && dwgCur() && !box.querySelector("#shpGo")) { const row = document.createElement("div"); row.className = "ltrow";
        row.innerHTML = `<button id="shpGo" title="Find round tanks and buildings in the drawing and turn them into site items">🔍 Find objects in the drawing</button>`; box.appendChild(row); $("shpGo").onclick = shpStart; } } catch (e) { console.warn(e); }
    return r; }; }
// while reviewing, a click on a find leaves it out (a click again puts it back)
(() => { const svg = $("site"); if (!svg) return;
  // on the parent, so it runs before the plan's own handlers (a locked deck under the click would take it otherwise)
  (svg.parentNode || svg).addEventListener("pointerdown", e => { const c = SHP.cand; if (!svg.contains(e.target)) return; if (!c || e.button !== 0) return; const w = toWorld(e);
    const hitT = c.useT && c.tanks.find(t => Math.hypot(w[0] - t.x, w[1] - t.y) <= t.r);
    const hitB = c.useB && c.blds.find(b => { const t = -b.rot * D2R, dx = w[0] - b.x, dy = w[1] - b.y, u = dx * Math.cos(t) - dy * Math.sin(t), v = dx * Math.sin(t) + dy * Math.cos(t); return Math.abs(u) <= b.w / 2 && Math.abs(v) <= b.h / 2; });
    const hit = hitT || hitB; if (!hit) return; hit.skip = !hit.skip; e.stopImmediatePropagation(); e.preventDefault(); shpOverlay(); shpPanel(); }, true);
  // a left-out find stays visible, faint, so it can be put back
})();
