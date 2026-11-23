// ================= the load at its set position after an upend: standing up, not lying flat =================
// ld.set.tilt = how far the load is turned up where it is set (°). Not set = automatic: a top-and-tail lift sets the load
// down at the angle it was upended to (90° = vertical), anything else level. With the load turned up at set:
//  · the lifting points at set are where they really are (over the load, not out at the ends) – so the crane's radius and
//    slew at set, and the travel / slew from pick to set, are worked out to the load standing up;
//  · the tail crane is off the hook at set (it let go at vertical): it carries nothing there, its hook left where it let go;
//  · the plan shows the load's footprint standing up (round for a round load) and the 3D view shows it upright.
function lsSetTilt(ld) { const v = ld?.set?.tilt; if (v != null && v !== "") return Math.max(0, Math.min(90, +v || 0)); try { return lsUpend(ld) ? Math.max(15, Math.min(90, +(ld.upend?.to ?? 90) || 90)) : 0; } catch (e) { return 0; } }
const lsTailCrane = ld => { const cr = lsCranes(ld); return cr.length === 2 && lsBuild2(ld) ? cr.find(c => (c.attach?.point || "C") === "B") || null : null; };
{ const _lpw = liftPointWorld; liftPointWorld = function (load, point, phase) {
    if (phase !== "set" || LS_DRAW || !load) return _lpw.call(this, load, point, phase);
    const t = lsSetTilt(load); if (t < 0.5) return _lpw.call(this, load, point, phase);
    if (!LS_SET.guard && lsUpend(load)) { LS_SET.guard = true; try { const L = liftSteps(load), st = L && L.steps[L.steps.length - 1], q = st && st.per.find(x => !x.fork && (x.c.attach?.point || "C") === point); if (q && q.hook) return [q.hook[0], q.hook[1]]; } catch (e) { } finally { LS_SET.guard = false; } }
    const pos = load.set, sp = tandemSpan(load), xc = +load.cog || 0, off = point === "A" ? -sp / 2 : point === "B" ? sp / 2 : xc, o2 = xc + (off - xc) * Math.cos(t * D2R), v = rot2([o2, 0], -(pos.rot || 0));
    return [pos.x + v[0], pos.y + v[1]]; }; }
{ const _ls = loadShares; loadShares = function (load, att, ...a) { const r = _ls.call(this, load, att, ...a);
    if (!LS_SET.rel || LS_SET.rel.ld !== load || !Array.isArray(att)) return r; const i = att.findIndex(x => x.id === LS_SET.rel.tail); if (i < 0) return r;
    const tot = r.reduce((s, v) => s + (+v || 0), 0), n = att.length - 1; return r.map((v, k) => k === i ? 0 : n ? tot / n : v); }; }
{ const _ev = evalCrane; evalCrane = function (cr, phase, ...a) {
    const ev = () => { const r = _ev.call(this, cr, phase, ...a); if (LS_DRAW && LS_DRAW.d3) LS_DRAW.evCr = cr; return r; };   // a step drawn in 3D: its hook height (loadRigHeight)
    if (phase !== "set" || LS_DRAW || LS_SET.guard) return ev();
    const ld = plan.loads.find(l => l.id === cr.attach?.load); if (!ld || lsSetTilt(ld) < 89.5 || !lsUpend(ld)) return ev();
    const tail = lsTailCrane(ld); if (!tail) return ev();
    const keepTip = tail.tip; let rel = null;
    if (!(tail.tip && tail.tip.set && tail.tip.set.free)) { LS_SET.guard = true; try { const L = liftSteps(ld), st = L && [...L.steps].reverse().find(s => s.per.some(q => q.c === tail && q.rel)), q = st && st.per.find(x => x.c === tail); if (q) rel = { free: true, R: q.R, brg: q.brg }; } catch (e) { } finally { LS_SET.guard = false; } }
    LS_SET.rel = { ld, tail: tail.id }; if (rel) tail.tip = { ...(tail.tip || {}), set: rel };
    try { const out = ev(); if (cr === tail) { out.released = true; out.warn = out.warn.filter(w => !/moved off the load/.test(w)); } return out; }
    finally { LS_SET.rel = null; if (rel) tail.tip = keepTip; } }; }
// plan: the footprint of the load as it stands at set (and at a turned-up lift step)
{ const _ls2 = loadScene; loadScene = function (ld, phase, ...a) { if (phase !== "set" || LS_DRAW) return _ls2.call(this, ld, phase, ...a); const t = lsSetTilt(ld); if (t < 0.5) return _ls2.call(this, ld, phase, ...a);
    const keep = LS_SET.plan; LS_SET.plan = { ld, tilt: t, xc: +ld.cog || 0 }; let sc; try { sc = _ls2.call(this, ld, phase, ...a); } finally { LS_SET.plan = keep; }
    // standing up: the name just clear of the footprint, the top lifting point (A) where the hook is, no tail point (it is at the bottom)
    const d = loadDims(ld), pos = ld.set, k = Math.cos(t * D2R), half = Math.abs(k) < 0.2 ? d.y / 2 : Math.max(d.y / 2, d.x / 2 * Math.abs(k)), nm = String(ld.name || "");
    let row = 0; sc.items = sc.items.filter(it => !(it.t === "text" && it.L === "RIGGING" && it.s === "B"));
    const away = [pos.x - (ld.pick?.x ?? pos.x), pos.y - (ld.pick?.y ?? pos.y)], al = Math.hypot(...away), u = al > 0.3 ? [away[0] / al, away[1] / al] : [0, 1], up = u[1] >= 0 ? 1 : -1;   // on the side away from the pick
    for (const it of sc.items) if (it.t === "text" && it.L === "TEXT" && nm && (String(it.s).includes(nm) || row)) { it.p = [pos.x + u[0] * (half + 2.2), pos.y + u[1] * (half + 2.2) + up * row * 0.95]; it.rot = 0; it.size = Math.min(it.size || 0.7, 0.7); row++; }
    return sc; }; }
// ---------------- 3D: the load turned up – at a lift step being drawn / played, or standing at its set position ----------------
// lsTilt3D says how the load is turned (about its CoG, lowest point on the load's bottom height – as the rigging works it
// out) and where: a step drawn in 3D uses the step's tilt and pose; otherwise the set position uses the set tilt.
function lsTilt3D(ld, pos, ghost) { const D = LS_DRAW;
  if (D) return D.d3 && D.ld === ld && !ghost && D.s && D.s.tilt && (lsBuild2(ld) || D.L?.ft) ? { TT: D.L?.ft ? tiltFn(ld, { tilt: D.s.tilt }) : tiltFn(ld, ld.rig), P: D.s.pose } : null;
  if (pos !== ld.set) return null; const t = lsSetTilt(ld); return t < 0.5 ? null : { TT: tiltFn(ld, { tilt: t }), P: pos }; }
{ const _l3 = load3D; load3D = function (M, ld, pos, ghost) { const X = lsTilt3D(ld, pos, ghost); if (!X) return _l3.call(this, M, ld, pos, ghost);
    const T = new Mesh(); _l3.call(this, T, ld, pos, ghost); const { TT, P } = X, h0 = +pos.h || 0;
    const f = w => { const v = rot2([w[0] - P.x, w[1] - P.y], P.rot || 0), q = TT([v[0], v[1], w[2] - h0]), r = rot2([q[0], q[1]], -(P.rot || 0)); return [P.x + r[0], P.y + r[1], h0 + q[2]]; };
    for (const fc of T.faces) M.faces.push({ ...fc, pts: fc.pts.map(f) }); for (const l of T.lines) M.lines.push({ ...l, a: f(l.a), b: f(l.b) }); for (const l of T.labels) M.labels.push({ ...l, p: l.p ? f(l.p) : l.p }); }; }
// the rigging: at a step each crane's hook straight to its lug (shackle at the padeye / choke round the leg);
// standing at set the hooks to its top lifting point
{ const _r3 = rig3D; rig3D = function (M, ld, pos, res, hooks) { const D = LS_DRAW;
    if (D) { if (!D.d3 || D.ld !== ld) return _r3.call(this, M, ld, pos, res, hooks);
      const L = D.L, s = D.s, lugs = lsLugsWorld(L, s), d = loadDims(ld);
      L.cranes.forEach(c => { const q = s.per.find(x => x.c === c); if (!q || q.rel) return; const i = c.attach?.point === "B" ? 1 : 0, lug = lugs[i], hk = [q.hook[0], q.hook[1], Math.min(q.z, q.hMax ?? q.z)];
        M.line(hk, lug, "#0b7a66", 2.2); M.cyl(vadd(lug, [0, 0, -0.12]), vadd(lug, [0, 0, 0.32]), Math.max(0.12, d.y * 0.12), "#d9661f"); });
      return; }
    if (pos !== ld.set || lsSetTilt(ld) < 0.5) return _r3.call(this, M, ld, pos, res, hooks);
    const t = lsSetTilt(ld), TT = tiltFn(ld, { tilt: t }), sp = tandemSpan(ld), lug = TT([-sp / 2, 0, liftPointZ(ld)]), v = rot2([lug[0], lug[1]], -(pos.rot || 0)), L = [pos.x + v[0], pos.y + v[1], (+pos.h || 0) + lug[2]];
    for (const h of hooks || []) M.line(h, L, "#0b7a66", 2); }; }
// each crane's hook block: at a step at the step's hook height (evalCrane notes which crane is being drawn); at set over
// the top lifting point of the load standing up
// (a top and tail with a forklift has no bridle: the crane's hook is on the top lug like a tandem lift – loadSideRig too)
{ const _rh = loadRigHeight; loadRigHeight = function (ld, ...a) { const D = LS_DRAW; if (ld && !a[0] && !(ld.rig && ld.rig.arr) && lsFT(ld)) a = [true, ...a.slice(1)];
    if (D) { if (D.d3 && D.ld === ld && D.evCr && D.s) { const q = D.s.per.find(x => x.c === D.evCr); if (q) return (q.rel ? D.s.h + 4 : q.z) - (+ld.pick.h || 0); } return _rh.call(this, ld, ...a); }
    if (LS_SET.ph !== "set" || !ld) return _rh.call(this, ld, ...a); const t = lsSetTilt(ld); if (t < 0.5) return _rh.call(this, ld, ...a);
    const sp = tandemSpan(ld), zl = liftPointZ(ld), lug = tiltFn(ld, { tilt: t })([-sp / 2, 0, zl]), rh = ld.rig?.arr ? (+ld.tandemRig || 2) + zl : (+ld.tandemRig || 0) + zl; return lug[2] + (rh - zl); }; }
// the load panel: how the load stands at its set position
{ const _rp = renderProps; renderProps = function (...a) { const r = _rp.apply(this, a);
    try { const hEl = $("l_seth"), ld = hEl && plan.loads.find(l => l.id === sel?.id); if (!ld || $("l_setT")) return r;
      const v = ld.set?.tilt, auto = lsSetTilt({ ...ld, set: { ...ld.set, tilt: undefined } });
      hEl.closest("label, .row, div").insertAdjacentHTML("afterend", `<div class="row"><label>Load at set<select id="l_setT"><option value="" ${v == null || v === "" ? "selected" : ""}>Automatic – ${auto >= 89.5 ? "standing up (top and tail ends vertical)" : auto > 0.5 ? `turned up ${fx(auto, 0)}°` : "as picked (level)"}</option><option value="0" ${v === 0 ? "selected" : ""}>Level, as picked</option><option value="90" ${v === 90 ? "selected" : ""}>Standing up – vertical</option>${v != null && v !== "" && v !== 0 && v !== 90 ? `<option value="${v}" selected>Turned up ${fx(v, 0)}°</option>` : ""}</select></label></div>`);
      $("l_setT").onchange = e => { if (e.target.value === "") delete ld.set.tilt; else ld.set.tilt = +e.target.value; LS_CACHE.clear(); markDirty(); renderAll(); renderProps(); }; } catch (e) { console.warn(e); }
    return r; }; }

// travel ghosts (and what the load passes over on the way) use the footprint of the load standing up
{ const _lo = loadOutline; loadOutline = function (ld, ...a) { const U = LS_SET.foot; if (!U || U.ld !== ld) return _lo.call(this, ld, ...a);
    const d = loadDims(ld), xc = +ld.cog || 0, k = Math.cos(U.tilt * D2R);
    if (Math.abs(k) >= 0.2) return _lo.call(this, ld, ...a).map(q => [xc + (q[0] - xc) * k, q[1]]);
    return /cyl|pipe|pile|spud|silo|tank|reel/i.test(ld.kind || "") ? Array.from({ length: 20 }, (_, i) => [xc + d.y / 2 * Math.cos(i * Math.PI / 10), d.y / 2 * Math.sin(i * Math.PI / 10)]) : [[xc - d.z / 2, -d.y / 2], [xc + d.z / 2, -d.y / 2], [xc + d.z / 2, d.y / 2], [xc - d.z / 2, d.y / 2]]; }; }
// the travel on the plan for an upend: ghosts standing up; and none at all when the hook never moves (upended in place
// on its top lug – the stage sheets show that), so no "slew 0°" line along the load
{ const _ts = travelScene; travelScene = function (ld, tp, ...a) { if (LS_DRAW || !ld || !lsUpend(ld)) return _ts.call(this, ld, tp, ...a); const t = lsSetTilt(ld); if (t < 0.5) return _ts.call(this, ld, tp, ...a);
    if (tp && tp.hooks && Math.abs(tp.slew || 0) < 0.5 && Math.abs((tp.R1 || 0) - (tp.R0 || 0)) < 0.1) return new Scene();
    const k = LS_SET.foot; LS_SET.foot = { ld, tilt: t }; try { return _ts.call(this, ld, tp, ...a); } finally { LS_SET.foot = k; } }; }
// each crane's elevation at set: the load standing up, the hook over its top lifting point, the tail crane off the hook
{ const _es = elevScene; elevScene = function (cr, phase, ...a) {
    const ld = phase === "set" && !LS_DRAW ? plan.loads.find(l => l.id === cr.attach?.load) : null, t = ld ? lsSetTilt(ld) : 0;
    if (!ld || t < 0.5) return _es.call(this, cr, phase, ...a);
    const cranes = lsCranes(ld), rh = (+ld.tandemRig || 0), sp = tandemSpan(ld), lugTop = tiltFn(ld, { tilt: t })([-sp / 2, 0, liftPointZ(ld)])[2], h0 = +ld.set.h || 0;
    const per = cranes.map(c => { const e = evalCrane(c, "set"); return { c, R: e.R, brg: e.bearing, hook: e.hook, z: h0 + lugTop + rh, rel: !!e.released }; });
    const keepPh = LS_SET.ph; LS_SET.ph = "set"; LS_SET.el = { ld, L: { ld, cranes }, s: { pose: ld.set, h: h0, tilt: t, per }, cur: { cr, q: per.find(x => x.c === cr) } };
    try { const r = _es.call(this, cr, phase, ...a); if (r && r.scene && per.find(x => x.c === cr)?.rel) for (const it of r.scene.items) if (it.t === "text") it.s = String(it.s).replace(/ · SET$/, " · SET – OFF THE HOOK"); return r; }
    finally { LS_SET.el = null; LS_SET.ph = keepPh; } }; }

// a crane that let go at vertical is marked off the hook at set (not "tip moved")
{ const _hl = hookLine; hookLine = function (s, cr, ev, ...a) { const r = _hl.call(this, s, cr, ev, ...a);
    if (ev && ev.released) for (const it of s.items) if (it.t === "text" && /^SET \(tip moved\) R /.test(String(it.s))) it.s = String(it.s).replace("SET (tip moved)", "SET – OFF THE HOOK ·");
    return r; }; }

