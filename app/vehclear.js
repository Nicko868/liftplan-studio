// ================= Trucks, trailers and SPMTs next to the crane =================
// Where a vehicle can actually stand decides the radius. For every truck / trailer / SPMT in the lift, against every
// crane: the gap to the tracks / mats / outrigger pads and to the counterweight's swing must be at least the minimum
// clearance (0.6 m unless the plan says otherwise). When it isn't, the vehicle has to move out – and the load on it
// with it: the app works out the radius the load then really sits at and whether the crane still lifts it there.
// The gaps are drawn on the plan while you place the vehicle (green = enough, red = too close).
const VC_TYPES = new Set(["truck", "trailer"]);
const vcIsVehicle = o => !!o && !o.zone && (VC_TYPES.has(o.type) || (typeof isTransport === "function" && isTransport(o)));
const vcMin = () => +plan.site?.minClear > 0 ? +plan.site.minClear : (rule("site.minClear") ?? 0.6);
function vcSeg(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-12; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L; t = Math.max(0, Math.min(1, t)); const q = [a[0] + t * dx, a[1] + t * dy]; return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), q }; }
function vcPolyGap(P, Q) {   // closest points of two outlines (0 if they overlap)
  let best = { d: 1e9, a: null, b: null };
  for (const p of P) for (let i = 0; i < Q.length; i++) { const r = vcSeg(p, Q[i], Q[(i + 1) % Q.length]); if (r.d < best.d) best = { d: r.d, a: p, b: r.q }; }
  for (const q of Q) for (let i = 0; i < P.length; i++) { const r = vcSeg(q, P[i], P[(i + 1) % P.length]); if (r.d < best.d) best = { d: r.d, a: r.q, b: q }; }
  const inside = (pt, R) => typeof inPolyPt === "function" && inPolyPt(pt, R);
  if (P.some(p => inside(p, Q)) || Q.some(q => inside(q, P))) best.d = 0;
  return best; }
function vcPtGap(c, P) { let best = { d: 1e9, q: null }; for (let i = 0; i < P.length; i++) { const r = vcSeg(c, P[i], P[(i + 1) % P.length]); if (r.d < best.d) best = r; } if (typeof inPolyPt === "function" && inPolyPt(c, P)) best.d = 0; return best; }
// all the gaps between one vehicle and one crane
function vcGaps(v, cr) {
  const C = REG.cranes[cr.model]; if (!C) return null; const VP = obsPts(v), ctr = [cr.x, cr.y], out = [];
  let fp = []; try { fp = craneFootprints(cr); } catch (e) { }
  for (const f of fp) { const g = vcPolyGap(VP, f.P); out.push({ what: f.name.toLowerCase().replace(/^pad /, "outrigger pad "), d: g.d, a: g.a, b: g.b, kind: "foot" }); }
  const tail = +(C.up?.tail || C.tail || 0);
  if (tail > 0) { const g = vcPtGap(ctr, VP), ux = g.q ? [(g.q[0] - ctr[0]) / (g.d || 1), (g.q[1] - ctr[1]) / (g.d || 1)] : [1, 0];
    out.push({ what: "counterweight swing", d: g.d - tail, a: g.q, b: [ctr[0] + ux[0] * tail, ctr[1] + ux[1] * tail], kind: "tail", r: tail }); }
  let sl = null; try { sl = slOf(cr, C); } catch (e) { }
  if (sl && +sl.R > 0) { const g = vcPtGap(ctr, VP), R = +sl.R + 1.5; if (g.d < R) out.push({ what: `superlift swing (${fx(+sl.R, 0)} m)`, d: g.d - R, kind: "sl", r: R }); }
  return out;
}
// loads standing on a vehicle at this phase (their CoG is where the crane picks / sets them)
function vcLoadsOn(v, ph) { const VP = obsPts(v); return (plan.loads || []).filter(l => l[ph] && (typeof inPolyPt === "function" ? inPolyPt([l[ph].x, l[ph].y], VP) : false)); }
// the checks, added to each crane's own warnings (checks panel, sheets, calculation check)
{ const _cs = craneSummary; craneSummary = function (cr, ...a) {
    const out = _cs.call(this, cr, ...a);
    try { if (!out || !out.C || out.C.type === "ped") return out; const m = vcMin();
      for (const v of plan.obstacles.filter(vcIsVehicle)) { if (typeof itemInLift === "function" && !itemInLift(v)) continue;
        const G = vcGaps(v, cr); if (!G) continue; const name = v.label || OBJ_TYPES[v.type]?.name || "Vehicle";
        const worst = G.filter(g => g.kind !== "sl").reduce((w, g) => !w || g.d < w.d ? g : w, null);
        if (worst && worst.d < m && worst.d > -50) {
          const move = m - worst.d; let tail = "";
          for (const ph of ["pick", "set"]) for (const l of vcLoadsOn(v, ph).filter(l => cr.attach?.load === l.id)) {
            const R0 = Math.hypot(l[ph].x - cr.x, l[ph].y - cr.y), R1 = R0 + move, W = out.ph?.[ph]?.hookLoad || 0;
            let cap = null; try { cap = out.chart ? craneCapacity(out.C, cr, out.chart, R1).cap : null; } catch (e) { }
            tail += ` – moved clear, ${l.name || "the load"} is ${ph === "pick" ? "picked" : "set"} at ~${fx(R1, 1)} m, not ${fx(R0, 1)} m` + (cap != null ? (W > cap ? `: the crane is over its capacity there (${fx(W, 1)} t on ${fx(cap, 1)} t) – it can't be done from this crane position` : ` (${fx(W, 1)} t on ${fx(cap, 1)} t at that radius – OK)`) : "");
          }
          out.warn.push(`${name}: ${worst.d <= 0 ? (worst.kind === "tail" ? "too close to the crane – inside its counterweight swing" : "clash with the crane " + worst.what) : `too close to the crane – only ${fx(worst.d, 2)} m from its ${worst.what}`} (min ${fx(m, 1)} m) – move it ~${fx(move, 1)} m out${tail}`);
        }
        const sl = G.find(g => g.kind === "sl"); if (sl) out.warn.push(`${name} is inside the superlift swing – check the superlift never slews round to it while it is there`);
      } } catch (e) { console.warn(e); }
    return out; }; }
// on the plan: the gap from each vehicle to the nearest crane part, green when there is enough room, red when not
{ const _rs = renderSite; renderSite = function (...a) { const r = _rs.apply(this, a);
    try { const svg = $("site"); let g = svg.querySelector("#vcGap"); if (!g) { g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.id = "vcGap"; g.setAttribute("pointer-events", "none"); } svg.appendChild(g);
      let h = ""; const m = vcMin();
      if (!allMode) for (const v of plan.obstacles.filter(vcIsVehicle)) { if (typeof itemInLift === "function" && !itemInLift(v)) continue;
        for (const cr of plan.cranes) { const G = (vcGaps(v, cr) || []).filter(x => x.kind !== "sl" && x.a && x.b); if (!G.length) continue; const w = G.reduce((p, x) => x.d < p.d ? x : p);
          if (w.d > 6) continue; const ok = w.d >= m, picked = sel && ((sel.kind === "obs" && sel.id === v.id) || (sel.kind === "crane" && sel.id === cr.id));
          if (ok && !picked) continue;   // quiet unless it is too close, or you are placing this vehicle / crane
          const col = ok ? "#1d7a4f" : "#c0392b", fs = 10 / view.s;
          if (!ok && w.kind === "tail") h += `<circle cx="${cr.x}" cy="${-cr.y}" r="${w.r}" fill="none" stroke="${col}" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" opacity=".8"/>`;
          h += `<line x1="${w.a[0]}" y1="${-w.a[1]}" x2="${w.b[0]}" y2="${-w.b[1]}" stroke="${col}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
          // the value sits beside the vehicle end of the line, on the side away from the crane
          const ux = w.a[0] - w.b[0], uy = w.a[1] - w.b[1], L = Math.hypot(ux, uy) || 1, tx = w.a[0] + ux / L * 8 / view.s, ty = w.a[1] + uy / L * 8 / view.s;
          h += `<text x="${tx}" y="${-ty}" font-size="${fs}" fill="${col}" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="${2.5 / view.s}">${w.d <= 0 ? "clash" : fx(w.d, 2) + " m"}</text>`; } }
      g.innerHTML = h; } catch (e) { }
    return r; }; }
// the minimum gap, under Site limits
(() => { const sec = $("siteLimits"); if (!sec || $("minClear")) return; const l = document.createElement("label");
  l.innerHTML = `Min. clearance crane ↔ vehicles (m)<input type="number" id="minClear" step="0.1" min="0" placeholder="${rule("site.minClear") ?? 0.6}">`; sec.append(l);
  const inp = $("minClear"); inp.value = plan.site?.minClear ?? ""; inp.onchange = () => { const v = +inp.value; if (v > 0) plan.site.minClear = v; else delete plan.site.minClear; markDirty(); renderAll(true); };
  const _rm = renderMeta; renderMeta = function (...a) { const r = _rm.apply(this, a); try { inp.value = plan.site?.minClear ?? ""; } catch (e) { } return r; }; })();
