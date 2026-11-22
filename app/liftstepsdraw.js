// ================= each step drawn with the app's own engineering drawings =================
// The plan and the elevations of a step are the same drawings as the plan sheet (cranes with their outriggers / tracks,
// counterweight, boom slewed and luffed to the hook, rigging, the load and the site), with the lift put in that step's
// position for the moment it is drawn: the load where the step has it, turned up as far as the step says, the cranes
// on it as they are at that step, and a crane that is off the hook shown with its hook clear of the load.
let LS_DRAW = null;   // { ld, tilt, xc } while a step is drawn or played ({ d3, L, s, evCr } too while it is drawn in 3D)
// the load at its set position (liftset.js): plan / foot = its plan and travel ghosts drawn standing up, el = a crane's
// elevation at set, ph = the phase the 3D view is being built for, rel / guard = the tail crane off the hook at set
const LS_SET = { plan: null, foot: null, el: null, ph: null, rel: null, guard: false };
// the load's plan when it is turned up (at a step, or standing at set): shortened along its length – and near vertical
// what is seen from above is its cross-section (round for a round load) with the centre marked
{ const _lp = loadPlan; loadPlan = function (ld, ...a) { const s = _lp.call(this, ld, ...a), D = LS_DRAW || LS_SET.plan; if (!D || D.ld !== ld || !D.tilt) return s;
    if (Math.abs(Math.cos(D.tilt * D2R)) < 0.2) {
    const st = s.items.find(it => it.t === "poly" && it.closed) || {}, d = loadDims(ld), xc = D.xc || 0, o = new Scene(), round = /cyl|pipe|pile|spud|silo|tank|reel/i.test(ld.kind || "");
    if (round) o.circle("LOAD", [xc, 0], d.y / 2, { fill: st.fill, color: st.color, w: st.w }); else o.poly("LOAD", [[xc - d.z / 2, -d.y / 2], [xc + d.z / 2, -d.y / 2], [xc + d.z / 2, d.y / 2], [xc - d.z / 2, d.y / 2]], { closed: true, fill: st.fill, color: st.color, w: st.w });
    const r = Math.max(d.y, 0.6) * 0.7; o.poly("LOAD", [[xc - r, 0], [xc + r, 0]], { w: 0.8, color: st.color || "#34393f" }); o.poly("LOAD", [[xc, -r], [xc, r]], { w: 0.8, color: st.color || "#34393f" });
      return o; }
    try { const k = Math.cos(D.tilt * D2R), xc = D.xc || 0, f = p => [xc + (p[0] - xc) * k, p[1]];
      const o = new Scene(); for (const it of s.items) { if (it.t === "poly") o.items.push({ ...it, pts: it.pts.map(f) }); else if (it.t === "circle") o.items.push({ ...it, c: f(it.c) }); else o.items.push({ ...it, p: f(it.p) }); } return o; } catch (e) { return s; } }; }
// put the lift in one step's state for drawing (load where the step has it, turned up, cranes and forklift as they are);
// lsEnter returns the function that puts everything back. lsWith wraps a drawing in it.
function lsEnter(L, s, opt = {}) {
  const ld = L.ld, R = ld.rig, keep = { pick: ld.pick, tilt: R ? R.tilt : undefined, cr: L.cranes.map(c => ({ c, tip: c.tip, L: c.L, cfg: c.boomCfg, ak: c._autoKey, ab: c.autoBoom })), phase: plan.phase };
  ld.pick = { x: s.pose.x, y: s.pose.y, rot: s.pose.rot, h: s.h };
  if (R && lsBuild2(ld)) R.tilt = s.tilt || 0;
  for (const q of s.per) { if (q.fork) continue; q.c.autoBoom = false; if (q.rel || opt.hooksFree) q.c.tip = { ...(q.c.tip || {}), pick: { free: true, R: q.R, brg: q.brg } }; else if (q.c.tip) q.c.tip = { ...q.c.tip, pick: null }; }
  LS_DRAW = { ld, tilt: s.tilt || 0, xc: L.ft ? (+ld.cog || 0) : (R && lsBuild2(ld) && typeof tiltFn === "function") ? (tiltFn(ld, { tilt: 1 }).xc || 0) : 0 };
  if (L.ft) { const fq = s.per.find(q => q.fork), o = L.fork; keep.fork = { o, x: o.x, y: o.y, rot: o.rot, fh: o._forkH };
    o.x = fq.ctr[0]; o.y = fq.ctr[1]; o.rot = fq.rot; o._forkH = fq.forkH;
    for (const q of s.per) if (!q.fork && !q.rel) q.c.tip = { ...(q.c.tip || {}), pick: { free: true, R: q.R, brg: q.brg } }; }
  return () => {
    LS_DRAW = null; ld.pick = keep.pick; if (R) { if (keep.tilt === undefined) delete R.tilt; else R.tilt = keep.tilt; }
    if (keep.fork) { const k = keep.fork; k.o.x = k.x; k.o.y = k.y; k.o.rot = k.rot; if (k.fh === undefined) delete k.o._forkH; else k.o._forkH = k.fh; }
    for (const k of keep.cr) { k.c.tip = k.tip; k.c.L = k.L; k.c.boomCfg = k.cfg; k.c._autoKey = k.ak; k.c.autoBoom = k.ab; }
    plan.phase = keep.phase; };
}
async function lsWith(L, s, fn) { const leave = lsEnter(L, s); try { return await fn(); } finally { leave(); } }
// the plan of one step, framed on the lift
// a crane's slew from one step to the next: the move from pick to set goes the way the plan says (load panel "Travel from
// pick to set": shortest / clockwise / anticlockwise – ld.travelDir); small corrections during an upend take the short way
function lsSlewDelta(a, b, p, q) {
  let d = ((((q.brg - p.brg) % 360) + 540) % 360) - 180; if (Math.abs((+b.t || 0) - (+a.t || 0)) < 1e-6) return d;
  const ld = plan.loads.find(l => l.id === q.c?.attach?.load), dir = ld?.travelDir || "short";
  if (dir === "cw" && d < 0) d += 360; else if (dir === "ccw" && d > 0) d -= 360; return d;
}
// what moved in plan from the step before: the load's travel and turn, each crane's slew
function lsPlanMove(prev, s) {
  if (!prev || Math.abs((+s.tilt || 0) - (+prev.tilt || 0)) > 0.5) return null;
  let dRot = ((+s.pose.rot || 0) - (+prev.pose.rot || 0)); dRot = ((dRot + 540) % 360) - 180;
  const dXY = Math.hypot(s.pose.x - prev.pose.x, s.pose.y - prev.pose.y), slews = [];
  for (const q of s.per) { if (q.fork || q.rel) continue; const p = prev.per.find(x => x.c === q.c); if (!p || p.rel) continue; const dB = lsSlewDelta(prev, s, p, q); if (Math.abs(dB) >= 0.5 || Math.abs(q.R - p.R) >= 0.1) slews.push({ q, p, dB, dR: q.R - p.R }); }
  return Math.abs(dRot) >= 1 || dXY >= 0.2 || slews.some(x => Math.abs(x.dB) >= 0.5) ? { dRot, dXY, slews } : null;
}
// the move drawn on the plan the way the plan sheet draws a slew: the load's path round the crane on its slew arc (the
// radius going from the step before to this one), the load ghosted along the way, where it was dashed, where it is now;
// the label along the arc. A load several cranes carry moves straight. A turn of the load on the hook (beyond what the
// slew turns it) gets its own small arc at the load.
function lsCarrier(prev, s) { const on = s.per.filter(q => !q.fork && !q.rel); if (on.length !== 1) return null; const q = on[0], p = prev.per.find(x => x.c === q.c); return p && !p.rel ? { q, p } : null; }
function lsHookTurn(prev, s) { let dRot = ((+s.pose.rot || 0) - (+prev.pose.rot || 0)); dRot = ((dRot + 540) % 360) - 180; const cr = lsCarrier(prev, s); if (!cr) return dRot;
  const dB = lsSlewDelta(prev, s, cr.p, cr.q); let t = dRot - dB; t = ((t + 540) % 360) - 180; return t; }
function lsMoveOverlay(sc, L, prev, s, mv, bb) {
  const ld = L.ld, d = loadDims(ld), col = "#d9661f", grey = "#7a8794", ts = 0.85;
  const foot = (P, tilt) => { const k = Math.cos((+tilt || 0) * D2R), xc = +ld.cog || 0;
    const loc = Math.abs(k) < 0.2 ? (/cyl|pipe|pile|spud|silo|tank|reel/i.test(ld.kind || "") ? Array.from({ length: 24 }, (_, i) => [xc + d.y / 2 * Math.cos(i * Math.PI / 12), d.y / 2 * Math.sin(i * Math.PI / 12)]) : [[xc - d.z / 2, -d.y / 2], [xc + d.z / 2, -d.y / 2], [xc + d.z / 2, d.y / 2], [xc - d.z / 2, d.y / 2]]) : loadOutline(ld).map(q => [xc + (q[0] - xc) * k, q[1]]);
    return loc.map(q => { const r = rot2(q, -(P.rot || 0)); return [P.x + r[0], P.y + r[1]]; }); };
  const arrow = (a, b, c) => { const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, u = [(b[0] - a[0]) / L0, (b[1] - a[1]) / L0], n = [-u[1], u[0]], h = 0.9;
    sc.poly("DIMS", [[b[0] - u[0] * h + n[0] * h * 0.5, b[1] - u[1] * h + n[1] * h * 0.5], b, [b[0] - u[0] * h - n[0] * h * 0.5, b[1] - u[1] * h - n[1] * h * 0.5]], { w: 1.4, color: c }); };
  const readable = a => { a = ((a + 180) % 360 + 360) % 360 - 180; return a > 90 ? a - 180 : a < -90 ? a + 180 : a; };
  // the load's path: round the carrying crane, or straight
  const cr = lsCarrier(prev, s), N = 36, poses = [], DB = cr ? lsSlewDelta(prev, s, cr.p, cr.q) : 0;
  for (let i = 0; i <= N; i++) { const u = i / N, rot = lsAngLerp(+prev.pose.rot || 0, +s.pose.rot || 0, u);
    if (cr) { const brg = cr.p.brg + DB * u, R = cr.p.R + (cr.q.R - cr.p.R) * u, c = cr.q.c, hk = [c.x + R * Math.sin(brg * D2R), c.y + R * Math.cos(brg * D2R)];
      const o0 = [prev.pose.x - cr.p.hook[0], prev.pose.y - cr.p.hook[1]], o1 = [s.pose.x - cr.q.hook[0], s.pose.y - cr.q.hook[1]];
      poses.push({ x: hk[0] + o0[0] + (o1[0] - o0[0]) * u, y: hk[1] + o0[1] + (o1[1] - o0[1]) * u, rot, hk, brg, R }); }
    else poses.push({ x: prev.pose.x + (s.pose.x - prev.pose.x) * u, y: prev.pose.y + (s.pose.y - prev.pose.y) * u, rot }); }
  // ghosts along the way, where it was, where it is now
  for (const u of [0.25, 0.5, 0.75]) sc.poly("DIMS", foot(poses[Math.round(u * N)], s.tilt), { closed: true, w: 0.6, color: "#b9a38a", dash: [0.5, 0.35] });
  sc.poly("DIMS", foot(prev.pose, prev.tilt), { closed: true, w: 1.1, color: grey, dash: [0.5, 0.3] });
  sc.poly("DIMS", foot(s.pose, s.tilt), { closed: true, w: 1.5, color: col });
  // the path (the hook's arc when a crane slews it round), arrow at the end, label along it
  const line = cr ? poses.map(q => q.hk) : poses.map(q => [q.x, q.y]); sc.poly("DIMS", line, { w: 1.4, color: col, dash: [0.7, 0.35] }); arrow(line[N - 2], line[N], col);
  const mid = poses[N / 2];
  if (cr) { const dB = DB, c = cr.q.c;
    // the label goes where the arc is furthest from any crane (just outside the arc)
    let best = null; for (let i = 4; i <= N - 4; i++) { const q = poses[i], r = q.R + 2, pt = [c.x + r * Math.sin(q.brg * D2R), c.y + r * Math.cos(q.brg * D2R)], keep = [...plan.cranes.map(k => [k.x, k.y]), [prev.pose.x, prev.pose.y], [s.pose.x, s.pose.y], ...s.per.filter(x => x.hook).map(x => x.hook)], dmin = Math.min(...keep.map(k => Math.hypot(pt[0] - k[0], pt[1] - k[1]))) - (bb && (pt[0] < bb[0] + 4 || pt[0] > bb[2] - 4 || pt[1] < bb[1] + 3 || pt[1] > bb[3] - 2) ? 1e3 : 0); if (!best || dmin > best.d) best = { d: dmin, pt }; }
    sc.text("DIMS", best.pt, `slew ${fx(Math.abs(dB), 0)}°`, ts * 1.1, { bold: true, color: col }); }
  else if (mv.dXY >= 0.2) { const a = poses[0], b = poses[N]; sc.text("DIMS", [mid.x, mid.y + 1.2], `moved ${fx(mv.dXY, 1)} m`, ts, { bold: true, color: col, rot: readable(Math.atan2(b.y - a.y, b.x - a.x) / D2R) }); }
  // a turn on the hook (tag lines): a small arc at the load
  const tH = lsHookTurn(prev, s);
  if (Math.abs(tH) >= 1) { const rr = Math.max(1.3, Math.min(4, Math.max(d.y, Math.abs(Math.cos((+s.tilt || 0) * D2R)) * d.x / 2) * 0.9)), b0 = bearingDeg(...rot2([1, 0], -(prev.pose.rot || 0))) + ((s.pose.rot || 0) - (prev.pose.rot || 0)) - tH, n = Math.max(6, Math.ceil(Math.abs(tH) / 6));
    const pts = Array.from({ length: n + 1 }, (_, i) => { const bb = (b0 + tH * i / n) * D2R; return [s.pose.x + rr * Math.sin(bb), s.pose.y + rr * Math.cos(bb)]; });
    sc.poly("DIMS", pts, { w: 1.2, color: "#b42318" }); arrow(pts[n - 1], pts[n], "#b42318"); const bm = (b0 + tH / 2) * D2R;
    const tc = cr ? [cr.q.c.x - s.pose.x, cr.q.c.y - s.pose.y] : [0, 1], tl = Math.hypot(...tc) || 1;   // the label on the crane's side of the load – inside the drawing
    sc.text("DIMS", [s.pose.x + tc[0] / tl * (rr + 1.6), s.pose.y + tc[1] / tl * (rr + 1.6)], `turned ${fx(Math.abs(tH), 0)}° on the hook`, ts * 0.85, { bold: true, color: "#b42318" }); }
}
async function lsPlanSVG(L, s, pxPerM = 20, opt = {}) {
  return lsWith(L, s, async () => {
    // framed tight on this lift: the cranes (outriggers / tracks and tail swing), the load where it is and where it goes, the hooks
    const P = [];
    for (const c of L.cranes) { const C = REG.cranes[c.model], t = Math.max(C?.up?.tail || 0, (C?.car?.len || 12) * 0.62, 6) + 1; P.push([c.x - t, c.y - t], [c.x + t, c.y + t]); try { for (const pd of cranePads(c, C)) P.push(pd.w); } catch (e) { } }
    { const k = Math.cos((+s.tilt || 0) * D2R), xc = +L.ld.cog || 0, k0 = opt.prev ? Math.cos((+opt.prev.tilt || 0) * D2R) : k;   // the load as it is seen from above at this step
      for (const [q, kk] of [[s.pose, k], [L.ld.set, k], ...(opt.prev ? [[opt.prev.pose, k0]] : [])]) for (const o of loadOutline(L.ld)) { const r = rot2([xc + (o[0] - xc) * kk, o[1]], -(q.rot || 0)); P.push([q.x + r[0], q.y + r[1]]); } }
    for (const q of s.per) { if (q.fork) { const F = q.F || L.F, u = q.u, v = [-u[1], u[0]]; for (const [kx, ky] of [[-F.l1 / 2, -F.b / 2], [F.l1 / 2, F.b / 2]]) P.push([q.ctr[0] + u[0] * kx + v[0] * ky, q.ctr[1] + u[1] * kx + v[1] * ky]); } else if (q.hook) P.push(q.hook); }
    let b = [Math.min(...P.map(p => p[0])), Math.min(...P.map(p => p[1])), Math.max(...P.map(p => p[0])), Math.max(...P.map(p => p[1]))]; const m = 1.5; b = [b[0] - m, b[1] - m - 2, b[2] + m, b[3] + m + (opt.prev ? 2.5 : 0)];
    const mv = opt.prev ? lsPlanMove(opt.prev, s) : null;
    let svg = await siteSVGStatic("pick", { pxPerM, bounds: b, extra: mv ? sc => lsMoveOverlay(sc, L, opt.prev, s, mv, b) : null });
    if (L.ft) svg = svg.replace(/>PICK \(tip moved\) R /g, ">R ");   // the crane holds the top: its hook is over the lug, not moved off
    return svg.replace(/>PICK \(tip moved\) R /g, ">OFF THE HOOK · R ").replace(/>PICK R /g, ">R ").replace(/ · PICK</g, "<"); });
}
// the elevation of each crane at one step: the crane, its boom luffed to the step's radius, the hook at the height the step
// needs, and the load drawn as it really is at that step – turned up, and seen from this crane (projected on the plane of its boom)
async function lsElevSVGs(L, s, pxPerM = 20) {
  return lsWith(L, s, async () => { const ld = L.ld, rigH = loadRigHeight(ld, L.cranes.length > 1), out = [];
    for (const cr of L.cranes) { const q = s.per.find(x => x.c === cr);
      ld.pick = { ...ld.pick, h: (q && !q.rel ? q.z : s.h + 3) - rigH };   // the hook where the step has it (a crane off the hook: hook parked clear above the ground)
      LS_DRAW.L = L; LS_DRAW.s = s; LS_DRAW.cur = { cr, q };
      const ev = elevScene(cr, "pick"); if (!ev) { out.push(null); continue; }
      ev.scene.items = ev.scene.items.filter(it => !(it.t === "text" && /^\d+(\.\d+)?$/.test(String(it.s).trim())));
      for (const it of ev.scene.items) if (it.t === "text") it.s = String(it.s).replace(/ · PICK$/, q && q.rel ? " · OFF THE HOOK" : "").replace(/ – hook too low$/, "");
      lsTidyElev(ev.scene, LS_DRAW.maxU);
      out.push({ cr, q, svg: toSVG(ev.scene, { lw: 0.06, pxPerM }) }); }
    return out; });
}
// the load and its rigging in one crane's elevation at a step (used by the elevation while a step is drawn)
function lsElevLoad(D, hookY) {
  const { L, s, cur } = D, ld = L.ld, cr = cur.cr, q = cur.q, P = s.pose, bb = (q ? q.brg : 0) * D2R, b = [Math.sin(bb), Math.cos(bb)];
  const proj = (x, y) => (x - cr.x) * b[0] + (y - cr.y) * b[1];
  const ax = rot2([1, 0], -(P.rot || 0)), ay = rot2([0, 1], -(P.rot || 0)), cx = ax[0] * b[0] + ax[1] * b[1], cy = ay[0] * b[0] + ay[1] * b[1];
  const view = Math.abs(cx) >= 0.5 || s.tilt ? "side" : "end", k = view === "side" ? cx : cy, uc = proj(P.x, P.y), h0 = s.h;
  const TTp = s.tilt ? tiltFn(ld, { tilt: s.tilt }) : null, prof = loadProfile(ld, view).s, o = new Scene(), T = ([x, z]) => { if (TTp && view === "side") { const q = TTp([x, 0, z]); return [uc + q[0] * k, h0 + q[2]]; } return [uc + x * k, h0 + z]; };
  for (const it of prof.items) { if (it.t === "poly") o.items.push({ ...it, pts: it.pts.map(T) }); else if (it.t === "circle") o.items.push({ ...it, c: T(it.c) }); else o.items.push({ ...it, p: T(it.p) }); }
  // lifting points where they are at this step
  const R = ld.rig, TT = s.tilt ? tiltFn(ld, { tilt: s.tilt }) : (p => p), d = loadDims(ld);
  let lugs; if (R && lsBuild2(ld) && (ld.pts || []).length >= 2) { const byK = k2 => (ld.pts.find(p => p.k === k2) || {}); const pa = R.legPts?.[0] ? byK(R.legPts[0]) : ld.pts[0], pb = R.legPtsB?.[0] ? byK(R.legPtsB[0]) : ld.pts[1]; lugs = [pa, pb].map(p => TT([+p.x || 0, +p.y || 0, +p.z || 0])); }
  else { const sp = tandemSpan(ld) || 0, zl = typeof liftPointZ === "function" ? liftPointZ(ld) : d.z; lugs = [[-sp / 2, 0, zl], [sp / 2, 0, zl]].map(TT); }
  const W = p => { const v = rot2([p[0], p[1]], -(P.rot || 0)); return [P.x + v[0], P.y + v[1], h0 + p[2]]; };
  L.cranes.forEach((c, i) => { const qq = s.per.find(x => x.c === c); if (!qq || qq.rel) return; const lug = W(lugs[c.attach?.point === "B" ? 1 : 0] || lugs[0]), u = proj(lug[0], lug[1]);
    if (c === cr) { o.poly("RIGGING", [[q.R, hookY], [u, lug[2]]], { w: 1.4 }); o.circle("RIGGING", [u, lug[2]], 0.2, { fill: true }); }
    else { const uh = proj(qq.hook[0], qq.hook[1]); o.poly("RIGGING", [[uh, qq.z], [u, lug[2]]], { w: 0.9, dash: [0.5, 0.3] }); o.circle("RIGGING", [u, lug[2]], 0.16, { fill: true });
 } });
  let bottom = Infinity; for (const it of o.items) { if (it.t === "poly") for (const p of it.pts) bottom = Math.min(bottom, p[1]); else if (it.t === "circle") bottom = Math.min(bottom, it.c[1] - it.r); }
  let mu = -Infinity; for (const it of o.items) { if (it.t === "poly") for (const p of it.pts) mu = Math.max(mu, p[0]); else if (it.t === "circle") mu = Math.max(mu, it.c[0] + it.r); } D.maxU = mu;
  return { s: o, bottom: Number.isFinite(bottom) ? bottom : h0 };
}
{ const _lsr = loadSideRig; loadSideRig = function (ld, hookY, ...a) { const D = LS_DRAW || LS_SET.el; if (D && D.ld === ld && D.cur && D.s) { try { return lsElevLoad(D, hookY); } catch (e) { console.warn(e); } } return _lsr.call(this, ld, hookY, ...a); }; }

// the height column of an elevation sits just clear of the drawing (it is set for the whole load length otherwise)
function lsTidyElev(sc, maxU) {
  const v = sc.items.filter(it => it.t === "poly" && it.L === "DIMS" && it.pts.length === 2 && Math.abs(it.pts[0][0] - it.pts[1][0]) < 1e-6 && Math.abs(it.pts[0][1]) < 1e-6).pop(); if (!v) return;
  const hx = v.pts[0][0]; let mx = -Infinity;
  for (const it of sc.items) { if (it === v) continue; if (it.t === "poly" && it.L !== "DIMS" && it.L !== "GROUND") for (const p of it.pts) if (p[0] < hx - 0.5) mx = Math.max(mx, p[0]); }
  if (Number.isFinite(maxU)) mx = Math.max(mx, maxU); const dx = hx - (mx + 1.5); if (!(dx > 0.5)) return;
  for (const it of sc.items) { if (it.t === "poly" && it.L === "DIMS" && it.pts.every(p => p[0] >= hx - 0.45)) it.pts = it.pts.map(p => [p[0] - dx, p[1]]); else if (it.t === "text" && it.L === "DIMS" && it.p[0] >= hx + 0.5 && it.anchor === "start") it.p = [it.p[0] - dx, it.p[1]];
    else if (it.t === "poly" && it.L === "GROUND") it.pts = it.pts.map(p => [Math.min(p[0], hx - dx + 1), p[1]]); }
}
// what each crane does to get from the last step to this one – the instruction for the operator and the lift supervisor
function lsMoves(prev, s) {
  return s.per.map(q => { const p = prev && prev.per.find(x => x.c === q.c);
    if (q.fork) { if (q.rel && p && p.rel) return { q, txt: "clear of the load" }; if (q.rel) return { q, txt: "lower the forks clear, back away 2.5 m" }; if (!p) return { q, txt: "forks under the tail, take the weight" };
      const m = [], dd = Math.hypot(q.ctr[0] - p.ctr[0], q.ctr[1] - p.ctr[1]), dz = q.forkH - p.forkH; if (dd >= 0.05) m.push(`drive forward ${fx(dd, 1)} m`); if (Math.abs(dz) >= 0.05) m.push(`${dz > 0 ? "raise" : "lower"} forks ${fx(Math.abs(dz), 2)} m`);
      return { q, txt: m.length ? m.join(" · ") : "hold" }; }
    if (q.rel && p && p.rel) return { q, txt: "off the hook" };
    if (q.rel) return { q, txt: "lower off, unhook, hook clear" }; if (!p) return { q, txt: "hook on, take the weight" };
    const m = [], dz = q.z - p.z, dR = q.R - p.R, dB = lsSlewDelta(prev, s, p, q);
    if (Math.abs(dz) >= 0.1) m.push(`${dz > 0 ? "hoist" : "lower"} ${fx(Math.abs(dz), 1)} m`);
    if (Math.abs(dR) >= 0.1) m.push(`${dR > 0 ? "luff out" : "luff in"} ${fx(Math.abs(dR), 1)} m (R ${fx(p.R, 1)} → ${fx(q.R, 1)})`);
    if (Math.abs(dB) >= 0.5) m.push(`slew ${fx(Math.abs(dB), 0)}° ${dB > 0 ? "clockwise" : "anticlockwise"}`);
    { const on = s.per.filter(x => !x.fork && !x.rel), dr = lsHookTurn(prev, s);
      if (on.length === 1 && Math.abs(dr) >= 1 && Math.abs((+s.tilt || 0) - (+prev.tilt || 0)) < 0.5) m.push(`turn the load ${fx(Math.abs(dr), 0)}° ${dr > 0 ? "clockwise" : "anticlockwise"} on the hook (tag lines)`); }
    return { q, txt: m.length ? m.join(" · ") : "hold" }; });
}
// ---------------- the lift sequence sheets ----------------
// 1: the summary – the lift from above (pick and set) and the table of every step and crane
// 2…: three steps a sheet – for each step the plan, each crane's elevation, and what each crane does and is checked for
async function liftSeqSheets(ld, liftLabel) {
  const L = liftSteps(ld); if (!L || L.steps.length < 2) return [];
  const out = [], up = L.up, nm = ld.name || "load", lim = L.lim, ucol = u => u == null ? "#566476" : u > lim ? "#b42318" : u > lim * 0.9 ? "#9a6200" : "#1d7a4f";
  const wrapT = (t, n) => (typeof wrapLines === "function" ? wrapLines(t, n) : [t]);
  // ---- summary
  { const F = ssFrame(`LIFT SEQUENCE · ${nm} – ${up ? "top and tail upend" : L.cranes.length > 1 ? "tandem lift" : "lift"} in ${L.steps.length} steps`, liftLabel), e = F.e, x0 = F.M + 30, tw = F.W - 2 * F.M - 60;
    const top = F.M + 80, ch = L.units || L.cranes, colsW = [0.25, 0.09, ...ch.flatMap(() => [0.06, 0.07, 0.07, 0.065, 0.05])], sw = colsW.reduce((a, b) => a + b, 0), wd = colsW.map(v => v * tw / sw);
    const tabH = (L.steps.length + 2) * 38 + 20, planH = F.bandY - top - tabH - 90;
    const pl = await siteSVGStatic("both", { pxPerM: 20, focus: true });
    F.add(nestSVG(pl, x0, top, tw, planH));
    F.add(`<text x="${x0}" y="${top + 26}" font-size="24" font-weight="700" fill="#16202a">PICK (solid) / SET (dashed) – the steps between are drawn on the sheets that follow</text>`);
    let y = top + planH + 20; const row = (v, o = {}) => { let x = x0; if (o.fill) F.add(`<rect x="${x0}" y="${y}" width="${tw}" height="38" fill="${o.fill}"/>`);
      v.forEach((t, i) => { F.add(`<text x="${i ? x + wd[i] - 10 : x + 10}" y="${y + 26}" font-size="20" ${o.bold ? 'font-weight="700"' : ""} text-anchor="${i ? "end" : "start"}" fill="${o.col?.[i] || "#16202a"}">${e(t)}</text>`); x += wd[i]; }); y += 38; };
    const y0 = y; let xh = x0 + wd[0] + wd[1];
    ch.forEach((c, k) => { const w5 = wd.slice(2 + k * 5, 7 + k * 5).reduce((a, b) => a + b, 0); F.add(`<rect x="${xh}" y="${y}" width="${w5}" height="38" fill="${k % 2 ? "#e2e8ee" : "#d5dde5"}"/><text x="${xh + w5 / 2}" y="${y + 26}" font-size="21" font-weight="700" text-anchor="middle" fill="#16202a">${e((c.label || "Crane") + " · " + (REG.cranes[c.model]?.name || c.model))}</text>`); xh += w5; }); y += 38;
    row(["Step", "Load", ...ch.flatMap(c => c.attach?.point === "F" ? ["Load c. (m)", "Share (t)", "~Cap. (t)", "Forks (m)", "Use"] : ["R (m)", "Share (t)", "Cap. (t)", "Hook (m)", "Use"])], { bold: true, fill: "#eef1f4" });
    L.steps.forEach((s, k) => row([`${s.no}. ${s.name}`, `${fx(s.h, 1)} m${s.tilt ? " · " + fx(s.tilt, 0) + "°" : ""}`, ...s.per.flatMap(q => q.rel ? ["–", q.fork ? "clear" : "off", "–", "–", "–"] : q.fork ? [fx(q.cl, 2), fx(q.used, 1) + (q.design > q.geom + 0.01 ? "*" : ""), fx(q.cap, 1), fx(q.forkH, 2), fx(q.util, 0) + "%"] : [fx(q.R, 1), fx(q.used, 1) + (q.design > q.geom + 0.01 ? "*" : ""), q.cap != null ? fx(q.cap, 1) : "–", fx(q.z, 1), q.util != null ? fx(q.util, 0) + "%" : "–"])],
      { fill: k % 2 ? "#f7f9fa" : null, col: ["", "", ...s.per.flatMap(q => ["", "", "", q.tooHigh ? "#b42318" : "", ucol(q.util)])] }));
    F.add(`<rect x="${x0}" y="${y0}" width="${tw}" height="${y - y0}" fill="none" stroke="#16202a" stroke-width="2"/>`);
    const notes = [`Share = ${L.ft ? "each machine's" : "the crane's"} part of the load + rigging at that step (from the rigging geometry)${up ? `; * checked for the design share – top crane ${rule("tt.top") ?? 100}%, ${L.ft ? `forklift ${rule("tt.fork") ?? 75}% of the load` : `tail crane ${rule("tt.tail") ?? 75}% of the load + rigging`} while both are on` : ""}.`,
      ...(L.ft ? [`Forklift: ${L.F.name}, ${fx(L.F.Q, 1)} t rated at ${fx(L.F.c0 * 1000, 0)} mm; capacity at the load centre ~ by the load moment about the front axle (check against the truck's plate). Forks = fork height.`] : []),
      `Capacity from each crane's load chart at the step's radius (next row up). Use = (share + hook block + extras) ÷ capacity, limit ${lim}%. Hook = height of the hook at that step.`];
    notes.forEach((t, i) => F.add(`<text x="${x0}" y="${y + 32 + i * 28}" font-size="19" fill="#3d4a57">${e(t)}</text>`));
    out.push({ name: `lift_sequence_${nm.replace(/[^\w\-]+/g, "_")}`, svg: F.close() }); }
  // ---- the steps, three to a sheet
  if ((L.cranes.length > 1 || L.ft) && (L.ft || (plan.meta.seqStyle || "cad") === "cad" || (typeof glAvailable === "function" && glAvailable()))) { for (const s of L.steps) out.push(await lsStageSheet(L, s, liftLabel)); return out; }
  const per = 1, nS = Math.ceil(L.steps.length / per);
  for (let k = 0; k < nS; k++) {
    const st = L.steps.slice(k * per, k * per + per), a = st[0].no, b = st[st.length - 1].no;
    const F = ssFrame(`LIFT SEQUENCE · ${nm} – STEP${a === b ? "" : "S"} ${a}${a === b ? "" : "–" + b} of ${L.steps.length}`, liftLabel), e = F.e, x0 = F.M + 20, tw = F.W - 2 * F.M - 40;
    const top = F.M + 76, rh = (F.bandY - top - 10) / per, nC = L.cranes.length, dataW = 640, planW = (tw - dataW) * (nC > 1 ? 0.44 : 0.55), elevW = (tw - dataW - planW) / nC;
    for (let i = 0; i < st.length; i++) {
      const s = st[i], prev = L.steps[s.no - 2], y = top + i * rh, mv = lsMoves(prev, s);
      if (i) F.add(`<line x1="${F.M}" y1="${y}" x2="${F.W - F.M}" y2="${y}" stroke="#16202a" stroke-width="2"/>`);
      F.add(`<rect x="${F.M + 2}" y="${y + 2}" width="${F.W - 2 * F.M - 4}" height="46" fill="${s.ok ? "#eef1f4" : "#fbe9e7"}"/><text x="${x0 + 6}" y="${y + 34}" font-size="28" font-weight="700" fill="${s.ok ? "#16202a" : "#b42318"}">STEP ${s.no} – ${e(s.name.toUpperCase())}</text>`);
      F.add(`<text x="${F.W - F.M - 20}" y="${y + 34}" font-size="22" text-anchor="end" fill="#3d4a57">${e(`load ${fx(s.h, 1)} m up${s.tilt ? ` · turned up ${fx(s.tilt, 0)}°` : ""}${s.under ? (s.clear >= 0 ? ` · ${fx(s.clear, 2)} m over ${s.under.name}` : ` · RUNS INTO ${s.under.name}`) : ""}`)}</text>`);
      const by = y + 54, bh = rh - 62;
      const pl = await lsPlanSVG(L, s, 20); F.add(nestSVG(pl, x0, by, planW - 10, bh));
      F.add(`<line x1="${x0 + planW}" y1="${by}" x2="${x0 + planW}" y2="${by + bh}" stroke="#9aa5b1" stroke-width="1.5"/>`);
      const el = await lsElevSVGs(L, s, 20); el.forEach((E, j) => { if (E) F.add(nestSVG(E.svg, x0 + planW + j * elevW + 6, by, elevW - 12, bh)); });
      // what each crane does, and its numbers
      const dx = x0 + tw - dataW + 14; let ty = by + 8; F.add(`<line x1="${dx - 14}" y1="${by}" x2="${dx - 14}" y2="${by + bh}" stroke="#9aa5b1" stroke-width="1.5"/>`);
      for (const { q, txt } of mv) { const c = q.c;
        F.add(`<text x="${dx}" y="${ty + 22}" font-size="23" font-weight="700" fill="${c.color || "#16202a"}">${e(c.label || "Crane")}</text>`); ty += 32;
        for (const t of wrapT(txt, 44)) { F.add(`<text x="${dx}" y="${ty + 20}" font-size="20" font-weight="700" fill="#16202a">${e(t)}</text>`); ty += 26; }
        const lines = q.rel ? [] : [`R ${fx(q.R, 1)} m · slew ${fx(q.brg, 0)}° · boom ${q.ba.ok ? fx(q.ba.theta, 1) + "°" : "–"}`, `hook ${fx(q.z, 1)} m (most ${q.hMax != null ? fx(q.hMax, 1) : "–"} m)`,
          `share ${fx(q.geom, 2)} t${q.design > q.geom + 0.01 ? ` · checked ${fx(q.design, 2)} t (${q.dWhy})` : ""}`];
        for (const t of lines) { F.add(`<text x="${dx}" y="${ty + 20}" font-size="19" fill="#3d4a57">${e(t)}</text>`); ty += 25; }
        if (!q.rel) { F.add(`<text x="${dx}" y="${ty + 20}" font-size="19" fill="#3d4a57">${e(`${fx(q.hookLoad, 2)} t on ${q.cap != null ? fx(q.cap, 1) + " t" : "no chart"} = `)}<tspan font-weight="700" fill="${ucol(q.util)}">${q.util != null ? fx(q.util, 0) + "%" : "–"}</tspan></text>`); ty += 25; }
        ty += 12; }
    }
    out.push({ name: `lift_sequence_${nm.replace(/[^\w\-]+/g, "_")}_steps_${a}-${b}`, svg: F.close() });
  }
  return out;
}
async function withLiftA(i, fn) { syncLift(); const pc = plan.cranes, pl = plan.loads, L = plan.lifts[i]; plan.cranes = L.cranes; plan.loads = L.loads; try { return await fn(L); } finally { plan.cranes = pc; plan.loads = pl; } }
{ const _bs = buildSheets; buildSheets = async function (...a) { const out = await _bs.apply(this, a);
    try { for (let i = 0; i < plan.lifts.length; i++) await withLiftA(i, async Lf => { for (const ld of Lf.loads) { if (!lsTwo(ld) && !(Array.isArray(ld.steps) && ld.steps.length)) continue;
          for (const sh of await liftSeqSheets(ld, Lf.name)) out.push({ ...sh, name: `${sh.name}_${i + 1}`, regen: () => sh.svg }); } }); } catch (e) { console.warn("lift sequence sheets", e); }
    for (const s of out || []) if (s && typeof s.svg === "string") s.svg = s.svg.replace(/>([^<]+)</g, (m, t) => ">" + lsSheetText(t) + "<");   // see lsSheetText
    return out; }; }

// ================= top and tail: each stage as one large front view of both cranes and the load =================
// The realistic 3D renderer (the same cranes as the 3D view) draws both cranes side by side, booms at the stage's angle,
// hooks at the stage's height, the load turned up as far as the stage says, and the rigging from each hook to its lug.
// The camera looks across the load at the cranes, level, so the picture reads like the stage drawings of a top-and-tail plan.
function lsLugsWorld(L, s) {
  const ld = L.ld, R = ld.rig, P = s.pose, h0 = s.h, d = loadDims(ld), build = R && lsBuild2(ld), TT = build && typeof tiltFn === "function" ? tiltFn(ld, { ...R, tilt: s.tilt || 0 }) : (p => p);
  if (L.ft) { const sp = tandemSpan(ld) || d.x * 0.9, T2 = tiltFn(ld, { tilt: s.tilt || 0 }), zl = liftPointZ(ld);
    return [T2([-sp / 2, 0, zl]), T2([sp / 2, 0, L.fork.fl.how === "hook" ? zl : 0])].map(p => { const v = rot2([p[0], p[1]], -(P.rot || 0)); return [P.x + v[0], P.y + v[1], h0 + p[2]]; }); }
  let lugs; if (build && (ld.pts || []).length >= 2) { const byK = k => ld.pts.find(p => p.k === k) || {}; const pa = R.legPts?.[0] ? byK(R.legPts[0]) : ld.pts[0], pb = R.legPtsB?.[0] ? byK(R.legPtsB[0]) : ld.pts[1]; lugs = [pa, pb].map(p => TT([+p.x || 0, +p.y || 0, +p.z || 0])); }
  else { const sp = tandemSpan(ld) || 0, zl = typeof liftPointZ === "function" ? liftPointZ(ld) : d.z; lugs = [[-sp / 2, 0, zl], [sp / 2, 0, zl]]; }
  return lugs.map(p => { const v = rot2([p[0], p[1]], -(P.rot || 0)); return [P.x + v[0], P.y + v[1], h0 + p[2]]; });
}
// the picture: W × H px, looking across the load at the cranes
async function lsFrontPic(L, s, W, H) {
  if (typeof glAvailable !== "function" || !glAvailable()) return null;
  return lsWith(L, s, async () => {
    if (!GL.R) glInit(); const R = GL.R, keep = { pr: R.getPixelRatio(), v3: JSON.stringify(V3), last: V3.last, phase: plan.phase }, host = R.domElement.parentNode, rr = host?.getBoundingClientRect();
    try {
      LS_DRAW.d3 = true; LS_DRAW.L = L; LS_DRAW.s = s; plan.phase = "pick";
      // look from the load towards the cranes, square to the load's long axis
      const cx = L.cranes.reduce((a, c) => a + c.x, 0) / L.cranes.length, cy = L.cranes.reduce((a, c) => a + c.y, 0) / L.cranes.length, P = s.pose;
      let n = rot2([0, 1], -(P.rot || 0)); if ((cx - P.x) * n[0] + (cy - P.y) * n[1] < 0) n = [-n[0], -n[1]];
      V3.mode = "3d"; V3.az = (Math.atan2(n[0], n[1]) / D2R + 360) % 360; V3.el = 7; V3.pan = [0, 0]; V3.zoom = 1;
      R.setPixelRatio(1); R.setSize(W, H); GL.sig = ""; const MM = buildMesh("pick"); glBuild(MM);
      // framed on the two cranes, their booms and the load
      const pts = []; for (const q of s.per) { const C = REG.cranes[q.c.model], t = Math.max(C?.up?.tail || 0, (C?.car?.len || 12) * 0.45); pts.push([q.c.x - t, q.c.y - t, 0], [q.c.x + t, q.c.y + t, 0], [q.hook[0], q.hook[1], (q.hMax || q.z) + 4]); }
      for (const p of lsLugsWorld(L, s)) pts.push(p); const ex = loadExtent(L.ld); pts.push([P.x - ex, P.y - ex, s.h], [P.x + ex, P.y + ex, s.h]);
      // fit: project on the picture plane and size the view to the widest of width / height
      const B = viewBasis(), r = B.r, u = vcross(B.r, B.d); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of pts) { const a = vdot(p, r), b = vdot(p, u); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }
      const c = [(x0 + x1) / 2, (y0 + y1) / 2], half = (x1 - x0) / 2 * 1.06, halfY = (y1 - y0) / 2 * 1.12;
      // glCamera aims at the focus centre and fits its radius; set the focus so that centre and radius are what this picture needs
      const dm = pts.reduce((a, p) => a + vdot(p, B.d), 0) / pts.length, ctr = [0, 1, 2].map(k => r[k] * c[0] + u[k] * c[1] + B.d[k] * dm), cz = Math.max(1, ctr[2]), radNeed = Math.max(half / (W / H), halfY);
      const F = [ctr[0] - 1, ctr[1] - 1, 0, ctr[0] + 1, ctr[1] + 1, cz / 0.35];
      GL.focus = F; const radF = Math.max(10, Math.hypot(2, 2, F[5]) / 2), fovH = Math.tan(GL.fov / 2 * D2R);
      V3.zoom = (radF / Math.min(fovH, fovH * W / H)) * 1.22 / (radNeed / fovH);
      // shift so the picture centre is the middle of what is shown (focus z is used as 0.35 × top)
      glCamera(W, H); R.render(GL.scene, GL.cam);
      const url = R.domElement.toDataURL("image/png"), v = new THREE.Vector3(), proj = p => { v.set(...p).project(GL.cam); return v.z > 1 ? null : [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
      return { url, proj, occ: lsOcc(MM, proj, W, H) };
    } finally {
      LS_DRAW && (LS_DRAW.d3 = false); Object.assign(V3, JSON.parse(keep.v3)); V3.last = keep.last; plan.phase = keep.phase; R.setPixelRatio(keep.pr); GL.sig = "";
      if (host && rr) { R.setSize(Math.max(300, Math.round(rr.width)), Math.max(300, Math.round(rr.height))); try { if (V3.mode === "3d") render3D(); } catch (e) { } }
    }
  });
}

// one stage of a top-and-tail upend on its own sheet: the front view large, a key plan, and what each crane does and is checked for
function lsRigText(ld, i) { const R = ld.rig || {}, list = [...((i ? R.topB : R.top) || []), ...((i ? R.legB : R.leg) || [])];
  return list.map(e => (e.snap?.name || rigItem(e.id)?.name || "").replace(/\s*\(.*?\)\s*/g, " ").trim()).filter(Boolean).join(" + "); }
async function lsStageSheet(L, s, liftLabel) {
  const ld = L.ld, nm = ld.name || "load", lim = L.lim, ucol = u => u == null ? "#566476" : u > lim ? "#b42318" : u > lim * 0.9 ? "#9a6200" : "#1d7a4f";
  const F = ssFrame(`LIFT SEQUENCE · ${nm} – STAGE ${s.no} of ${L.steps.length}: ${s.name.toUpperCase()}`, liftLabel), e = F.e, x0 = F.M + 4, tw = F.W - 2 * F.M - 8;
  const top = F.M + 76, stripH = 470, ph = F.bandY - top - stripH, pw = tw;
  const cad = (plan.meta.seqStyle || "cad") === "cad" || !!L.ft, prev = L.steps[s.no - 2], mv = lsPlanMove(prev, s);
  if (mv) {   // the load turns / travels or a crane slews: that only shows from above – TOP VIEW of the move, FRONT VIEW beside it
    const tw2 = Math.round(pw * 0.58), fw = Math.round(pw - tw2), tp = await lsPlanSVG(L, s, 30, { prev });
    F.add(`<rect x="${x0}" y="${top}" width="${tw2}" height="${ph}" fill="#ffffff"/>`); F.add(nestSVG(tp, x0 + 10, top + 96, tw2 - 20, ph - 106));
    F.add(`<rect x="${x0}" y="${top}" width="${pw}" height="${ph}" fill="none" stroke="#16202a" stroke-width="2"/><line x1="${x0 + tw2}" y1="${top}" x2="${x0 + tw2}" y2="${top + ph}" stroke="#16202a" stroke-width="2"/>`);
    const tH = lsHookTurn(prev, s), what = [...mv.slews.filter(x => Math.abs(x.dB) >= 0.5).map(x => `${x.q.c.label || "crane"} slews ${fx(Math.abs(x.dB), 0)}° ${x.dB > 0 ? "clockwise" : "anticlockwise"}${Math.abs(x.dR) >= 0.1 ? ` (R ${fx(x.p.R, 1)} → ${fx(x.q.R, 1)} m)` : ""}`), mv.slews.length ? "" : mv.dXY >= 0.2 ? `load moved ${fx(mv.dXY, 1)} m` : "", Math.abs(tH) >= 1 ? `load turned ${fx(Math.abs(tH), 0)}° ${tH > 0 ? "clockwise" : "anticlockwise"} on the hook` : ""].filter(Boolean).join(" · ");
    F.add(`<text x="${x0 + 24}" y="${top + 44}" font-size="30" font-weight="700" fill="#16202a" text-decoration="underline">${e(`TOP VIEW – ${what}`)}</text>`);
    F.add(`<text x="${x0 + 24}" y="${top + 76}" font-size="20" fill="#3d4a57">${e("Grey dashed: the load at the step before · orange: its path (the slew arc at the hook), on the way and where it is now")}</text>`);
    const fp = await lsCadFront(L, s, fw, Math.round(ph));
    if (fp) { F.add(`<g transform="translate(${x0 + tw2} ${top})">${fp.svg}</g>`); F.add(lsCallouts([...lsStageLabels(L, s, fp.proj), ...(fp.extra || [])], fp.occ, x0 + tw2, top, fw, ph, e));
      F.add(`<text x="${x0 + tw2 + 24}" y="${top + 44}" font-size="30" font-weight="700" fill="#16202a" paint-order="stroke" stroke="#fff" stroke-width="6" text-decoration="underline">${e(`FRONT VIEW – load ${fx(s.h, 1)} m up`)}</text>`); }
    F.add(`<rect x="${x0}" y="${top}" width="${pw}" height="${ph}" fill="none" stroke="#16202a" stroke-width="2"/><line x1="${x0 + tw2}" y1="${top}" x2="${x0 + tw2}" y2="${top + ph}" stroke="#16202a" stroke-width="2"/>`);
  }
  const pic = mv ? null : cad ? await lsCadFront(L, s, Math.round(pw), Math.round(ph)) : await lsFrontPic(L, s, Math.round(pw), Math.round(ph));
  if (mv) { } else if (pic) {
    F.add(pic.url ? `<image href="${pic.url}" x="${x0}" y="${top}" width="${pw}" height="${ph}"/>` : `<g transform="translate(${x0} ${top})">${pic.svg}</g>`);
    F.add(lsCallouts([...lsStageLabels(L, s, pic.proj), ...(pic.extra || [])], pic.occ, x0, top, pw, ph, e));
    F.add(`<rect x="${x0}" y="${top}" width="${pw}" height="${ph}" fill="none" stroke="#16202a" stroke-width="2"/>`);
    F.add(`<text x="${x0 + 24}" y="${top + 44}" font-size="30" font-weight="700" fill="#16202a" paint-order="stroke" stroke="#fff" stroke-width="6" text-decoration="underline">${e(`FRONT VIEW – load ${fx(s.h, 1)} m up${s.tilt ? ` · turned up ${fx(s.tilt, 0)}°` : " · level"}`)}</text>`);
  } else F.add(`<text x="${x0 + 40}" y="${top + 80}" font-size="30" fill="#b42318">The front view needs WebGL – open the sheets in a browser with it on.</text>`);
  // the strip: key plan, then for each crane what it does from the last stage and its checks
  const sy = F.bandY - stripH + 10, sh = stripH - 20, kpW = 760; F.add(`<line x1="${F.M}" y1="${sy - 10}" x2="${F.W - F.M}" y2="${sy - 10}" stroke="#16202a" stroke-width="3"/>`);
  const kp = await lsPlanSVG(L, s, 14); F.add(nestSVG(kp, x0 + 6, sy + 30, kpW - 20, sh - 34)); F.add(`<text x="${x0 + 14}" y="${sy + 24}" font-size="23" font-weight="700" fill="#16202a">KEY PLAN</text><line x1="${x0 + kpW}" y1="${sy - 10}" x2="${x0 + kpW}" y2="${F.bandY}" stroke="#16202a" stroke-width="2"/>`);
  const mvs = lsMoves(L.steps[s.no - 2], s), cw = (tw - kpW) / s.per.length;
  mvs.forEach(({ q, txt }, k) => { const cx = x0 + kpW + k * cw + 24; let y = sy + 30; if (k) F.add(`<line x1="${cx - 24}" y1="${sy - 10}" x2="${cx - 24}" y2="${F.bandY}" stroke="#9aa5b1" stroke-width="1.5"/>`);
    F.add(`<text x="${cx}" y="${y}" font-size="30" font-weight="700" fill="${q.c.color || "#16202a"}">${e(q.fork ? (q.c.label || "Forklift") : `${q.c.label || "Crane"} · ${REG.cranes[q.c.model]?.name || q.c.model}`)}</text>`); y += 46;
    F.add(`<text x="${cx}" y="${y}" font-size="26" font-weight="700" fill="#16202a">${e(txt.charAt(0).toUpperCase() + txt.slice(1))}</text>`); y += 44;
    const rows = q.rel ? [] : q.fork ? [["Fork height (mast lift)", `${fx(q.forkH, 2)} m (${fx(q.h3, 2)} m)`], ["Load centre", `${fx(q.cl * 1000, 0)} mm`], ["Share on the forks", `${fx(q.geom, 2)} t`], ...(q.design > q.geom + 0.01 ? [[`Checked for (${q.dWhy})`, `${fx(q.design, 2)} t`]] : []),
      ["On the forks (+ attachment)", `${fx(q.hookLoad, 2)} t`], ["Capacity at load centre", `~${fx(q.cap, 1)} t`], ["Axle loads front / rear", `${fx(q.axles[0], 1)} / ${fx(q.axles[1], 1)} t`]] : [["Radius", `${fx(q.R, 1)} m`], ["Slew / boom angle", `${fx(q.brg, 0)}° / ${q.ba.ok ? fx(q.ba.theta, 1) + "°" : "–"}`], ["Hook height (most)", `${fx(q.z, 1)} m (${q.hMax != null ? fx(q.hMax, 1) : "–"} m)`],
      ["Share from the rigging", `${fx(q.geom, 2)} t`], ...(q.design > q.geom + 0.01 ? [[`Checked for (${q.dWhy})`, `${fx(q.design, 2)} t`]] : []), ["Hook load (+ block)", `${fx(q.hookLoad, 2)} t`], ["Chart capacity", q.cap != null ? `${fx(q.cap, 1)} t${q.rUsed ? ` (${fx(q.rUsed, 1)} m row)` : ""}` : "–"]];
    for (const [a, b] of rows) { F.add(`<text x="${cx}" y="${y}" font-size="23" fill="#3d4a57">${e(a)}</text><text x="${cx + cw - 60}" y="${y}" font-size="23" font-weight="700" text-anchor="end" fill="#16202a">${e(b)}</text>`); y += 33; }
    if (!q.rel) F.add(`<text x="${cx}" y="${y + 8}" font-size="25" fill="#3d4a57">Use</text><text x="${cx + cw - 60}" y="${y + 8}" font-size="34" font-weight="700" text-anchor="end" fill="${q.fork ? (q.util > L.flim || q.axles[1] <= 0 ? "#b42318" : q.util > L.flim * 0.9 ? "#9a6200" : "#1d7a4f") : ucol(q.util)}">${q.util != null ? fx(q.util, 0) + "%" : "–"}</text>`); });
  return { name: `lift_sequence_${nm.replace(/[^\w\-]+/g, "_")}_stage_${s.no}`, svg: F.close() };
}

// ---------- labels that keep clear of the cranes and the load ----------
// what is drawn, as a coarse grid of the picture (cells covered by a crane, boom, rope or the load)
function lsOcc(M, proj, W, H, c = 12) {
  const nx = Math.ceil(W / c), ny = Math.ceil(H / c), g = new Uint8Array(nx * ny);
  const mark = (i, j) => { if (i >= 0 && j >= 0 && i < nx && j < ny) g[j * nx + i] = 1; };
  for (const f of M.faces) { if (f.alpha < 1 || Math.max(...f.pts.map(p => p[2])) <= 0.25) continue; const q = f.pts.map(proj); if (q.some(v => !v)) continue;
    const xs = q.map(v => v[0]), ys = q.map(v => v[1]), i0 = Math.max(0, Math.floor(Math.min(...xs) / c)), i1 = Math.min(nx - 1, Math.floor(Math.max(...xs) / c)), j0 = Math.max(0, Math.floor(Math.min(...ys) / c)), j1 = Math.min(ny - 1, Math.floor(Math.max(...ys) / c));
    if (i1 - i0 < 1 && j1 - j0 < 1) { mark(i0, j0); continue; }
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!g[j * nx + i] && inPolyPt([(i + 0.5) * c, (j + 0.5) * c], q)) g[j * nx + i] = 1;
    for (let k = 0; k < q.length; k++) { const a = q[k], b = q[(k + 1) % q.length], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / c) + 1; for (let t = 0; t <= n; t++) mark(Math.floor((a[0] + (b[0] - a[0]) * t / n) / c), Math.floor((a[1] + (b[1] - a[1]) * t / n) / c)); } }
  for (const l of M.lines) { const a = proj(l.a), b = proj(l.b); if (!a || !b) continue; const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / c) + 1; for (let t = 0; t <= n; t++) mark(Math.floor((a[0] + (b[0] - a[0]) * t / n) / c), Math.floor((a[1] + (b[1] - a[1]) * t / n) / c)); }
  return { g, nx, ny, c };
}
// the callouts of a stage: each crane at its boom head, each lifting point with its rigging, the load
function lsStageLabels(L, s, proj) {
  const ld = L.ld, out = [], lugs = lsLugsWorld(L, s);
  s.per.forEach(q => {
    if (q.fork) { const F = q.F || L.F, top = proj([q.ctr[0], q.ctr[1], F.h6]); if (top) out.push({ a: top, col: "#8a6a00", lines: [`${q.c.label || "Forklift"}`, q.rel ? "Forks lowered clear – backed away" : `Forks ${fx(q.forkH, 2)} m · load centre ${fx(q.cl * 1000, 0)} mm`, ...(q.rel ? [] : [`${fx(q.hookLoad, 1)} t on ~${fx(q.cap, 1)} t = ${fx(q.util, 0)}%`])], pref: -120 });
      if (!q.rel) { const b = proj(lsLugsWorld(L, s)[1]); if (b) out.push({ a: b, col: "#0b5e4f", lines: [L.fork.fl.how === "hook" ? "Tail end · fork-mounted lifting hook" : "Tail end · resting on the forks (cradle)", `${fx(q.used, 1)} t at ${fx(q.cl * 1000, 0)} mm from the fork face`], pref: 90, small: true }); }
      return; }
    const C = REG.cranes[q.c.model], i = q.c.attach?.point === "B" ? 1 : 0, tip = q.ba.ok ? [q.c.x + (q.hook[0] - q.c.x) * 1, q.c.y + (q.hook[1] - q.c.y) * 1, q.hMax != null ? q.hMax + 2 : q.z + 6] : [q.hook[0], q.hook[1], q.z];
    const a = proj(tip); if (a) out.push({ a, col: q.c.color || "#16202a", lines: [`${q.c.label || "Crane"} · ${C?.name || q.c.model}`, q.ba.ok ? `Boom ${fx(q.c.L, 1)} m @ ${fx(q.ba.theta, 1)}° · R ${fx(q.R, 1)} m` : `R ${fx(q.R, 1)} m`, q.rel ? "Off the hook" : `Hook ${fx(q.z, 1)} m · ${fx(q.hookLoad, 1)} t on ${q.cap != null ? fx(q.cap, 1) : "–"} t = ${q.util != null ? fx(q.util, 0) + "%" : "–"}`], pref: -90 });
    if (!q.rel) { const b = proj(lugs[i]), rt = lsRigText(ld, i) || (L.ft ? `Top sling, hook ${fx(+ld.tandemRig || 0, 1)} m above the lug` : ""); if (b) out.push({ a: b, col: "#0b5e4f", lines: [`${L.up ? (i ? "Tail end rigging" : "Top end rigging") : "Lifting point " + (i ? "B" : "A")} · ${q.c.label || "crane"}`, ...(rt ? wrapLines(rt, 44).slice(0, 3) : [])], pref: 90, small: true }); } });
  { const lg = lsLugsWorld(L, s), m = [(lg[0][0] + lg[1][0]) / 2, (lg[0][1] + lg[1][1]) / 2, (lg[0][2] + lg[1][2]) / 2], a = proj(m);
    if (a) out.push({ a, col: "#16202a", lines: [`${ld.name || "Load"} · ${fx(+ld.weight || 0, 1)} t`, `${s.tilt ? `turned up ${fx(s.tilt, 0)}°` : "level"} · bottom ${fx(s.h, 1)} m up`], pref: s.tilt > 45 ? 0 : -60, small: true }); }
  return out;
}
// place each callout where it covers nothing (or as little as possible), joined to its point by a leader
function lsCallouts(labels, occ, ox, oy, W, H, e) {
  const placed = [], fsz = l => l.small ? 22 : 25, size = l => { const f = fsz(l); return [Math.max(...l.lines.map(t => t.length)) * f * 0.55 + 22, l.lines.length * f * 1.3 + 14]; };
  const cost = (x, y, w, h) => { if (x < 6 || y < 56 || x + w > W - 6 || y + h > H - 6) return 1e9; let n = 0; if (occ) { const c = occ.c; for (let j = Math.floor(y / c); j <= Math.floor((y + h) / c); j++) for (let i = Math.floor(x / c); i <= Math.floor((x + w) / c); i++) if (i >= 0 && j >= 0 && i < occ.nx && j < occ.ny && occ.g[j * occ.nx + i]) n++; }
    for (const p of placed) if (x < p.x + p.w + 10 && x + w + 10 > p.x && y < p.y + p.h + 10 && y + h + 10 > p.y) n += 1e6; return n * 1000; };
  let g = "";
  for (const l of labels) { const [w, h] = size(l), A = l.a; let best = null;
    for (const d of [70, 110, 160, 220, 300, 400, 520, 660]) for (let k = 0; k < 24; k++) { const ang = (l.pref + (k ? (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 15 : 0)) * D2R, cx = A[0] + Math.cos(ang) * d, cy = A[1] + Math.sin(ang) * d, x = cx - w / 2, y = cy - h / 2;
      const sc = cost(x, y, w, h) + d * 2 + Math.abs(k) * 3; if (!best || sc < best.sc) best = { x, y, sc }; }
    if (!best) continue; placed.push({ x: best.x, y: best.y, w, h });
    const ex = Math.max(best.x, Math.min(best.x + w, A[0])), ey = Math.max(best.y, Math.min(best.y + h, A[1])), f = fsz(l);
    g += `<line x1="${(ox + A[0]).toFixed(1)}" y1="${(oy + A[1]).toFixed(1)}" x2="${(ox + ex).toFixed(1)}" y2="${(oy + ey).toFixed(1)}" stroke="${l.col}" stroke-width="2"/><circle cx="${(ox + A[0]).toFixed(1)}" cy="${(oy + A[1]).toFixed(1)}" r="5" fill="${l.col}"/>`;
    g += `<rect x="${(ox + best.x).toFixed(1)}" y="${(oy + best.y).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#ffffff" fill-opacity="0.94" stroke="${l.col}" stroke-width="2"/>`;
    l.lines.forEach((t, k) => g += `<text x="${(ox + best.x + 11).toFixed(1)}" y="${(oy + best.y + 8 + f * (k + 1) * 1.22).toFixed(1)}" font-size="${k ? f - 2 : f}" font-weight="${k ? 400 : 700}" fill="${k ? "#16202a" : l.col}">${e(t)}</text>`); }
  return g;
}
// ---------- the CAD option: the same cranes and load as an engineering front elevation ----------
// square to the load, no perspective, white faces with dark edges, ground hatched, the heights and the load angle dimensioned
const lsTint = (hex, k) => { try { const c = hexRgb(hex); return rgbHex(c.map(v => v + (255 - v) * k)); } catch (e) { return "#ffffff"; } };
async function lsCadFront(L, s, W, H) {
  return lsWith(L, s, async () => { const keepPh = plan.phase;
    try {
      LS_DRAW.d3 = true; LS_DRAW.L = L; LS_DRAW.s = s; LS_DRAW._clr = null; plan.phase = "pick";
      const cx = L.cranes.reduce((a, c) => a + c.x, 0) / L.cranes.length, cy = L.cranes.reduce((a, c) => a + c.y, 0) / L.cranes.length, P = s.pose;
      // one view for the whole sequence: square to the load as it is picked, from the side away from the cranes; the same scale on every stage
      const P0 = L.steps[0].pose, P9 = L.steps[L.steps.length - 1].pose, mx = (P0.x + P9.x) / 2, my = (P0.y + P9.y) / 2;
      let n = rot2([0, 1], -(P0.rot || 0)); { const lx = L.up ? P0.x : mx, ly = L.up ? P0.y : my; if ((cx - lx) * n[0] + (cy - ly) * n[1] < 0) n = [-n[0], -n[1]]; }   // look from the side away from the cranes: the load in front of them
      // a load carried somewhere is seen side-on to its way, pick on the left and set on the right
      // a load carried somewhere: look square to the line between the two cranes (both seen side by side), from behind the pick towards the set
      { const tx = P9.x - P0.x, ty = P9.y - P0.y, tl = Math.hypot(tx, ty); if (tl > 1 && !L.up && L.cranes.length > 1) { const a = L.cranes[0], b = L.cranes[1], ux = b.x - a.x, uy = b.y - a.y, ul = Math.hypot(ux, uy) || 1; n = [-uy / ul, ux / ul]; if (n[0] * tx + n[1] * ty < 0) n = [-n[0], -n[1]]; } }
      const d = [n[0], n[1], 0], r = [n[1], -n[0], 0], M = buildMesh("pick");
      // framed on the cranes, booms and the load, room left round it for the callouts
      const pts = []; for (const st of L.steps) { for (const q of st.per) { if (q.fork) { const F = q.F || L.F; pts.push([q.ctr[0] - F.l1 / 2, q.ctr[1] - F.l1 / 2, 0], [q.ctr[0] + F.l1 / 2, q.ctr[1] + F.l1 / 2, F.h4]); continue; } const C = REG.cranes[q.c.model], t = (C?.car?.len || 12) * 0.5; pts.push([q.c.x - t, q.c.y - t, 0], [q.c.x + t, q.c.y + t, 0], [q.hook[0], q.hook[1], (q.hMax || q.z) + 3]); }
        for (const p of lsLugsWorld(L, st)) pts.push(p); const ex = loadExtent(L.ld), Q = st.pose; pts.push([Q.x - ex, Q.y - ex, st.h], [Q.x + ex, Q.y + ex, st.h]); }
      let x0 = 1e9, x1 = -1e9, z1 = 0; for (const p of pts) { const a = vdot(p, r); x0 = Math.min(x0, a); x1 = Math.max(x1, a); z1 = Math.max(z1, p[2]); }
      const padX = 380, padT = 120, padB = 150, k = Math.min((W - 2 * padX) / (x1 - x0), (H - padT - padB) / Math.max(5, z1)), X = a => W / 2 + (a - (x0 + x1) / 2) * k, Y = z => H - padB - z * k;
      const proj = p => [X(vdot(p, r)), Y(p[2])];
      const light = vnorm([-0.45, -0.6, 0.75]), items = [];
      for (const f of M.faces) { if (Math.max(...f.pts.map(p => p[2])) <= 0.01) continue; const nn = newell(f.pts), facing = vdot(nn, d); if (facing > 1e-6 && f.alpha >= 1 && !f.flat) continue;
        const nl = Math.hypot(...nn) || 1, lit = 0.86 + 0.14 * Math.max(0, -vdot(nn, light) / nl * (facing > 0 ? -1 : 1));
        items.push({ z: f.pts.reduce((a, p) => a + vdot(p, d), 0) / f.pts.length - (f.bias || 0), q: f.pts.map(proj), fill: lsTint(f.fill || "#cccccc", 0.72), lit, soft: f.soft, alpha: f.alpha }); }
      for (const l of M.lines) items.push({ z: (vdot(l.a, d) + vdot(l.b, d)) / 2 - 0.05, line: [proj(l.a), proj(l.b)], color: /0b7a66/i.test(l.color) ? "#0b7a66" : "#16202a", w: l.w });
      items.sort((a, b) => b.z - a.z);
      let g = `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
      // ground line and hatch
      const gy = Y(0); g += `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="#16202a" stroke-width="3"/>`; for (let x = 0; x < W; x += 26) g += `<line x1="${x}" y1="${gy}" x2="${x - 18}" y2="${gy + 18}" stroke="#16202a" stroke-width="1.2"/>`;
      g += `<text x="${W - 24}" y="${gy - 12}" font-size="22" text-anchor="end" fill="#16202a">GROUND ±0.00</text>`;
      for (const it of items) { if (it.line) { g += `<line x1="${it.line[0][0].toFixed(1)}" y1="${it.line[0][1].toFixed(1)}" x2="${it.line[1][0].toFixed(1)}" y2="${it.line[1][1].toFixed(1)}" stroke="${it.color}" stroke-width="${Math.max(1.4, it.w * 1.6)}" stroke-linecap="round"/>`; continue; }
        const f = shade(it.fill, it.lit); g += `<polygon points="${it.q.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}" fill="${f}"${it.alpha < 1 ? ` fill-opacity="${it.alpha}"` : ""} stroke="${it.soft ? f : "#1d2833"}" stroke-width="${it.soft ? 0.6 : 0.9}" stroke-linejoin="round"/>`; }
      // dimensions: each hook's height from the ground, the load's angle at its lower end
      const dimV = (x, z, txt, col) => { const ya = Y(0), yb = Y(z); return `<line x1="${x}" y1="${ya}" x2="${x}" y2="${yb}" stroke="${col}" stroke-width="1.6"/><path d="M${x - 8} ${ya - 14}L${x} ${ya}L${x + 8} ${ya - 14}M${x - 8} ${yb + 14}L${x} ${yb}L${x + 8} ${yb + 14}" fill="none" stroke="${col}" stroke-width="1.6"/><line x1="${x - 14}" y1="${yb}" x2="${x + 14}" y2="${yb}" stroke="${col}" stroke-width="1.6"/><text transform="translate(${x - 10} ${(ya + yb) / 2}) rotate(-90)" font-size="22" text-anchor="middle" fill="${col}" font-weight="700">${txt}</text>`; };
      const dims = [];
      // hook heights dimensioned clear of the drawing: left-hand cranes on the left, right-hand cranes on the right, extension line from the hook
      const xl = X(x0), xr = X(x1); let nl = 0, nr = 0;
      s.per.forEach(q => { if (q.rel) return; const hp = proj([q.hook[0], q.hook[1], Math.min(q.z, q.hMax ?? q.z)]), left = hp[0] < (xl + xr) / 2, dx = left ? xl - 60 - 70 * nl++ : xr + 60 + 70 * nr++, col = q.c.color || "#16202a";
        g += `<line x1="${hp[0]}" y1="${hp[1]}" x2="${dx + (left ? -16 : 16)}" y2="${hp[1]}" stroke="${col}" stroke-width="1" stroke-dasharray="6 5"/>` + dimV(dx, Math.min(q.z, q.hMax ?? q.z), q.fork ? `FORKS ${fx(q.z, 2)} m` : `HOOK ${fx(q.z, 1)} m`, col); dims.push([dx, hp[1]]); });
      // what the load passes over: the gap between its bottom and the top of the item, dimensioned
      if (s.under && s.clear != null) { const P = s.pose, xm = proj([P.x, P.y, 0])[0] + (loadDims(L.ld).x / 2) * k * 0.0, ya = Y(s.under.top), yb = Y(s.h), col = s.clear < TRAVEL_CLEAR - 0.01 ? "#b42318" : "#16202a", xx = xm;
        g += `<line x1="${xx - 60}" y1="${ya}" x2="${xx + 60}" y2="${ya}" stroke="${col}" stroke-width="1.6" stroke-dasharray="8 5"/><line x1="${xx}" y1="${ya}" x2="${xx}" y2="${yb}" stroke="${col}" stroke-width="1.8"/><path d="M${xx - 7} ${ya - 12}L${xx} ${ya}L${xx + 7} ${ya - 12}M${xx - 7} ${yb + 12}L${xx} ${yb}L${xx + 7} ${yb + 12}" fill="none" stroke="${col}" stroke-width="1.8"/>`;
        dims.push([xx, yb]); LS_DRAW._clr = { a: [xx, (ya + yb) / 2], txt: [`${fx(s.clear, 2)} m clear`, `over ${s.under.name} (top ${fx(s.under.top, 1)} m)`], col }; }
      if (s.tilt) { const lg = lsLugsWorld(L, s), lo = lg[0][2] < lg[1][2] ? lg[0] : lg[1], hi = lo === lg[0] ? lg[1] : lg[0], pl = proj(lo), phh = proj(hi), dir = Math.sign(phh[0] - pl[0]) || 1, b0 = [pl[0], Y(s.h)], rr = 150, a = s.tilt * D2R;
        g += `<line x1="${b0[0]}" y1="${b0[1]}" x2="${b0[0] + dir * (rr + 40)}" y2="${b0[1]}" stroke="#16202a" stroke-width="1.4" stroke-dasharray="10 6"/><path d="M${b0[0] + dir * rr} ${b0[1]} A${rr} ${rr} 0 0 ${dir > 0 ? 0 : 1} ${(b0[0] + dir * rr * Math.cos(a)).toFixed(1)} ${(b0[1] - rr * Math.sin(a)).toFixed(1)}" fill="none" stroke="#16202a" stroke-width="1.8"/>`;
        g += `<text x="${(b0[0] + dir * (rr + 18) * Math.cos(a / 2)).toFixed(1)}" y="${(b0[1] - (rr + 18) * Math.sin(a / 2)).toFixed(1)}" font-size="26" font-weight="700" text-anchor="${dir > 0 ? "start" : "end"}" fill="#16202a">${fx(s.tilt, 0)}°</text>`; }
      const occ = lsOcc(M, proj, W, H); { const c = occ.c; for (const [x, yt] of dims) for (let j = Math.floor(yt / c); j <= Math.floor(gy / c); j++) for (let i = Math.floor((x - 26) / c); i <= Math.floor((x + 14) / c); i++) if (i >= 0 && j >= 0 && i < occ.nx && j < occ.ny) occ.g[j * occ.nx + i] = 1; for (let j = Math.floor((gy - 14) / c); j < occ.ny; j++) for (let i = 0; i < occ.nx; i++) if (j >= 0 && j < occ.ny) occ.g[j * occ.nx + i] = 1; }
      return { svg: g, proj, occ, dir: d, extra: LS_DRAW._clr ? [{ a: LS_DRAW._clr.a, col: LS_DRAW._clr.col, lines: LS_DRAW._clr.txt, pref: 180, small: true }] : [] };
    } finally { LS_DRAW && (LS_DRAW.d3 = false); plan.phase = keepPh; }
  });
}

// ================= sheets: equipment names never print a company mark =================
// Library items and the copies saved in plans may carry a company prefix ("SSB sling set leg …"). Nicko's rule: never
// print "SSB" on sheets. A last pass over every sheet's text drops "SSB " / "(SSB …)" from names; the user's own plan
// (applied in the buildSheets wrapper above, after the step sheets are added)
// and lift numbers ("SSB-004") are left alone.
const lsSheetText = t => t.replace(/\s*\(SSB [^)]*\)/g, "").replace(/\bSSB\s+(?=[A-Za-zØ0-9])/g, "");
