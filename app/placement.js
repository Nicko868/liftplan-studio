// ================= Placing new things where they can be seen =================
// A new crane, load or site item used to drop on the centre of the screen – on top of whatever was already there.
// Now it goes to the nearest free spot (clear of cranes, loads and solid site items, on the deck when there is one),
// is selected, and the view moves to it if it landed off screen.
function itemCircles(skipId) {
  const C = [];
  for (const c of plan.cranes) { if (c.id === skipId) continue; const M = REG.cranes[c.model]; const r = M ? (M.type === "cr" ? Math.max(M.car.len, M.car.gauge + 1) / 2 : Math.max(M.car.front || 6, (M.or ? Math.max(...Object.values(M.or.modes).map(m => m.spread || 0)) : 0) / 2 + 1, M.up?.tail || 4)) : 6; C.push({ x: c.x, y: c.y, r }); }
  for (const l of plan.loads) { if (l.id === skipId) continue; const r = loadExtent(l) + 0.5; for (const ph of ["pick", "set"]) if (l[ph]) C.push({ x: l[ph].x, y: l[ph].y, r }); }
  for (const o of plan.obstacles) {
    if (o.id === skipId || o.kind === "dim" || o.zone || isMat(o) || o.type === "deck" || o.kind === "line") continue;
    if ((typeof objPass === "function" && objPass(o)) && !(+o.hgt > 0.3) && !(typeof isVessel === "function" && isVessel(o))) continue;   // flat areas (laydown, roads) can be stood on
    if (o.kind === "circle") { C.push({ x: o.x, y: o.y, r: o.r || 1 }); continue; }
    const P = obsPts(o); if (!P.length) continue; const c = centroid(P); C.push({ x: c[0], y: c[1], r: Math.max(...P.map(p => Math.hypot(p[0] - c[0], p[1] - c[1]))), P });
  }
  return C;
}
// is a circle of radius r at p clear of an item? (true shape for buildings and vessels, not their bounding circle)
function clearOf(it, p, r, gap = 0.5) {
  if (!it.P) return Math.hypot(p[0] - it.x, p[1] - it.y) >= it.r + r + gap;
  if (Math.hypot(p[0] - it.x, p[1] - it.y) >= it.r + r + gap) return true;
  if (inPolyPt(p, it.P)) return false;
  for (let i = 0; i < it.P.length; i++) if (segDist(p, it.P[i], it.P[(i + 1) % it.P.length]) < r + gap) return false;
  return true;
}
// nearest free point to `want` for something of radius r
function freeSpot(want, r, skipId, anywhere) {
  const occ = itemCircles(skipId), decks = anywhere ? [] : plan.obstacles.filter(o => o.type === "deck" && (o.pts || []).length > 2);
  const onDeck = p => !decks.length || decks.some(d => inPolyPt(p, d.pts));
  const free = p => onDeck(p) && occ.every(c => clearOf(c, p, r, 1));
  if (free(want)) return want;
  const step = Math.max(2, r);
  for (let ring = 1; ring <= 60; ring++) {
    const d = ring * step, n = Math.max(8, Math.round(2 * Math.PI * d / step));
    for (let k = 0; k < n; k++) { const a = k * 2 * Math.PI / n, p = [Math.round((want[0] + d * Math.cos(a)) * 10) / 10, Math.round((want[1] + d * Math.sin(a)) * 10) / 10]; if (free(p)) return p; }
  }
  return want;
}
function showItem(p) {
  const r = $("site").getBoundingClientRect(), hw = r.width / 2 / view.s, hh = r.height / 2 / view.s;
  if (Math.abs(p[0] - view.cx) > hw * 0.85 || Math.abs(p[1] - view.cy) > hh * 0.85) { view.cx = p[0]; view.cy = p[1]; renderSite(); }
}
// cranes: next to the load as before, but never on top of another crane, load or building
{ const _ac = addCraneOf; addCraneOf = function (...a) {
    const n0 = plan.cranes.length, r = _ac.apply(this, a), c = plan.cranes[plan.cranes.length - 1];
    if (plan.cranes.length > n0 && c) {
      const M = REG.cranes[c.model], rc = M ? (M.type === "cr" ? Math.max(M.car.len, M.car.gauge + 1) / 2 : Math.max(M.car.front || 6, 5)) : 6;
      const p = freeSpot([c.x, c.y], rc, c.id);
      if (p[0] !== c.x || p[1] !== c.y) { const op = objPos("crane:" + c.id); if (op && op.set) op.set(p[0], p[1]); if (typeof autoBoom === "function") try { autoBoom(c); } catch (e) { } renderAll(); }
      showItem([c.x, c.y]);
    }
    return r;
  }; }
// loads: in front of a crane that has nothing to lift yet, otherwise near the centre of the screen – always on a free spot
{ const btn = $("lbOk"), _ok = btn.onclick; btn.onclick = function (...a) {
    const isNew = !LB.editId, n0 = plan.loads.length;
    const r = _ok.apply(this, a);
    if (isNew && plan.loads.length > n0) {
      const ld = plan.loads[plan.loads.length - 1], rl = loadExtent(ld) + 0.5;
      const cr = plan.cranes.find(c => c.attach?.load === ld.id) || plan.cranes[0];
      let want = [view.cx, view.cy];
      if (cr) { const M = REG.cranes[cr.model], front = M ? (M.type === "cr" ? M.car.len / 2 : (M.car.front || 6)) : 6, d = front + rl + 4, h = (+cr.heading || 0) * D2R; want = [cr.x + d * Math.sin(h), cr.y + d * Math.cos(h)]; }
      const p = freeSpot(want, rl, ld.id);
      ld.pick = { ...ld.pick, x: p[0], y: p[1] }; ld.set = { ...ld.set, x: p[0], y: p[1] };
      // a crane that was waiting with a free hook now hooks onto the new load
      plan.cranes.filter(c => c.attach?.load === ld.id).forEach(c => { if (c.tip && c.tip.pick?.free && c.tip.set?.free) c.tip = null; try { autoBoom(c); } catch (e) { } });
      markDirty(); renderAll(); showItem(p);
    }
    return r;
  }; }
// site items from the object library
{ const _po = placeObject; placeObject = function (type) {
    const n0 = plan.obstacles.length, r = _po(type);
    if (plan.obstacles.length > n0) {
      const o = plan.obstacles[plan.obstacles.length - 1];
      if (o.x != null && !o.pts) { const rr = o.kind === "circle" ? (o.r || 1) : Math.hypot(o.w || 2, o.h || 2) / 2; const p = freeSpot([o.x, o.y], rr, o.id, ["water", "bollard", "fender"].includes(o.type)); o.x = p[0]; o.y = p[1]; markDirty(); renderAll(); showItem(p); }
    }
    return r;
  }; }
