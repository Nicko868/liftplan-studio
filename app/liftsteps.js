// ================= Lift steps – how the lift is done, step by step, checked at every step =================
// A lift is not one position. Every load with two cranes (and any load you give steps to) is checked at each step of
// the lift: take the weight, lift clear, the moves on the way (slew / luff / travel), over the set position, set down –
// and for a top-and-tail upend each stage of the turn, the tail crane lowering off at vertical and the top crane on its
// own after that. At every step, for every crane: where the hook is (radius, slew, boom angle, hook height), the share
// of the load it carries – from the rigging geometry at that step, and the design share where one applies (top and
// tail: top crane checked for 100 %, tail for 75 % – Rules & limits) – the chart capacity there and the use, and what the
// load clears underneath. Nothing about one lift is written in: the steps are data on the load (automatic until you
// change them), and the same engine runs a level tandem discharge, an upend or a single-crane lift.
const LS_CACHE = new Map();
const lsCranes = ld => plan.cranes.filter(c => c.attach?.load === ld.id && REG.cranes[c.model]);
const lsChart = cr => { const ch = REG.charts[cr.chartId]; return ch && ch.craneId === cr.model ? ch : null; };
const lsBuild2 = ld => ld.rig?.arr === "build" && +ld.rig.cranes === 2;
// a cached lift-steps result is only good for the same load and crane objects (a plan reopened or a lift switched has new
// objects with the same ids – drawing or playing an old result moves the old objects, and nothing on screen moves)
const lsCacheOk = (r, ld, cranes) => r.ld === ld && r.cranes.length === cranes.length && r.cranes.every((c, i) => c === cranes[i]) && (!r.fork || plan.obstacles.includes(r.fork));
const lsFork = ld => (plan.obstacles || []).find(o => o.type === "forklift" && o.fl && o.fl.load === ld.id && typeof FORKLIFTS !== "undefined" && FORKLIFTS[o.fl.model]) || null;
const lsFT = ld => lsCranes(ld).length === 1 && !!lsFork(ld);   // top and tail: one crane on the top, a forklift on the tail
// a crane topping with a forklift on the tail hangs the top from its own rigging: no default two-leg sling set is made up for it
{ const _rs = rigShown; rigShown = function (ld, cranes) { if (lsFT(ld) && !ld.rig?.arr) return false; return _rs.call(this, ld, cranes); }; }
const lsTwo = ld => lsCranes(ld).length >= 2 || lsFT(ld);       // a lift that gets the step-by-step treatment
function lsUpend(ld) { return lsFT(ld) || (lsBuild2(ld) && (ld.upend != null ? !!ld.upend : ld.rig.preset === "build_upend")); }
// the height to carry the load at: 1 m over the tallest thing on the way, never above what the hooks reach
function lsCarry(ld, tp, cranes) {
  const rigH = loadRigHeight(ld, cranes.length > 1), hit = tp ? obstacleHits(ld, tp) : null; let top = 0; if (hit && hit.over) for (const v of hit.over.values()) top = Math.max(top, v.top);
  let H = Math.max((+ld.pick.h || 0) + 1, (+ld.set.h || 0) + 1, top + TRAVEL_CLEAR), hMax = Infinity;
  for (const c of cranes) for (const p of (tp && tp.hooks) || (tp ? tp.pts : [])) { const m = travelHookMax(c, Math.hypot(p[0] - c.x, p[1] - c.y)); if (m != null) hMax = Math.min(hMax, m - rigH); }
  if (Number.isFinite(hMax)) H = Math.max(Math.min(H, hMax), Math.max(+ld.pick.h || 0, +ld.set.h || 0));
  return { H, top };
}
// the steps: yours, or worked out from the lift
function lsAutoSteps(ld) {
  const up = lsUpend(ld), to = Math.max(15, Math.min(90, +(ld.upend?.to ?? 90) || 90)); let moved = Math.hypot(ld.set.x - ld.pick.x, ld.set.y - ld.pick.y) > 0.5 || Math.abs((+ld.set.rot || 0) - (+ld.pick.rot || 0)) > 1;
  // with a forklift the crane's hook stays over the top lug while the load turns up, so it stands where its top end was:
  // it is "moved" only when the set position (where it stands – lsAddForklift puts it there) is somewhere else
  if (up && lsFT(ld)) { const d = loadDims(ld), sp = tandemSpan(ld) || d.x * 0.9, aE = tiltFn(ld, { tilt: to })([-sp / 2, 0, liftPointZ(ld)]), w = (P, q) => { const v = rot2(q, -(+P.rot || 0)); return [P.x + v[0], P.y + v[1]]; }, A0 = w(ld.pick, [-sp / 2, 0]), A1 = w(ld.set, [aE[0], aE[1]]);
    moved = Math.hypot(A1[0] - A0[0], A1[1] - A0[1]) > 0.5 || Math.abs((+ld.set.rot || 0) - (+ld.pick.rot || 0)) > 1; }
  if (up) { const fk = lsFT(ld), tail = fk ? "F" : "B", S = [{ name: fk ? "Take the weight – crane and forklift" : "Take the weight – both cranes", t: 0, h: "pick", tilt: 0 }, { name: "Lift clear, load level", t: 0, h: "lift", tilt: 0 }];
    for (let a = 15; a < to; a += 15) S.push({ name: fk ? `Upend to ${a}° – crane hoists, forklift drives in` : `Upend to ${a}° – top crane hoists, tail crane lowers`, t: 0, h: "lift", tilt: a });
    S.push({ name: fk ? (to >= 90 ? "Vertical – forklift lowers its forks clear and backs away" : `At ${to}° – forklift lowers off`) : to >= 90 ? "Vertical – tail crane lowers off and is unhooked" : `At ${to}° – tail crane lowers off`, t: 0, h: "lift", tilt: to, release: tail });
    if (moved) S.push({ name: fk ? "Crane takes it to the set position" : "Top crane takes it to the set position", t: 1, h: "carry", tilt: to, release: tail }, { name: "Set down", t: 1, h: "set", tilt: to, release: tail });
    else S.push({ name: "Set down", t: 0, h: "pick", tilt: to, release: tail });
    return S; }
  const S = [{ name: "Take the weight", t: 0, h: "pick" }, { name: "Lift clear", t: 0, h: "carry" }];
  if (moved) S.push({ name: "On the way – ¼", t: 0.25, h: "carry" }, { name: "On the way – ½", t: 0.5, h: "carry" }, { name: "On the way – ¾", t: 0.75, h: "carry" }, { name: "Over the set position", t: 1, h: "carry" });
  S.push({ name: "Set down", t: 1, h: "set" });
  return S;
}
const lsSteps = ld => (Array.isArray(ld.steps) && ld.steps.length ? ld.steps : lsAutoSteps(ld));
// everything at every step
function liftSteps(ld) {
  if (!ld) return null; const cranes = lsCranes(ld); if (!cranes.length) return null;
  if (lsFT(ld)) return lsFTSteps(ld, cranes, lsFork(ld));
  const key = `${ld.id}|${plan.updated}|${plan.al}|${JSON.stringify(ld.steps || "")}|${ld.upend ?? ""}|${JSON.stringify(cranes.map(c => [c.x, c.y, c.L, c.chartId, c.heading, c.hookBlock, c.attach?.point]))}|${JSON.stringify([ld.pick, ld.set, ld.rig?.tilt])}`;
  { const hit = LS_CACHE.get(key); if (hit && lsCacheOk(hit, ld, cranes)) return hit; } if (LS_CACHE.size > 60) LS_CACHE.clear();
  normLoad(ld); const tp = travelPath(ld), C0 = cranes.map(c => REG.cranes[c.model]), build2 = lsBuild2(ld) && cranes.length === 2, up = lsUpend(ld);
  const carry = lsCarry(ld, tp, cranes), W = +ld.weight || 0, lim = +plan.site.ulim || (rule("crane.util") ?? 100), d = loadDims(ld);
  const pose = t => { if (!tp) return { x: ld.pick.x + (ld.set.x - ld.pick.x) * t, y: ld.pick.y + (ld.set.y - ld.pick.y) * t, rot: +ld.pick.rot || 0 }; const i = Math.round(t * (tp.pts.length - 1)); return { x: tp.pts[i][0], y: tp.pts[i][1], rot: tp.rots ? tp.rots[i] : (+ld.pick.rot || 0) }; };
  const hOf = (s, t) => s.h === "pick" ? (+ld.pick.h || 0) : s.h === "set" ? (+ld.set.h || 0) : s.h === "carry" ? carry.H : s.h === "lift" ? (+ld.pick.h || 0) + 1 : (+s.h || 0);
  const idxOf = c => (c.attach?.point === "B" ? 1 : 0); let total0 = null;
  const lastHk = {};   // a crane that comes off the hook stays where it last held the load (hook lowered off)
  const steps = lsSteps(ld).map((s0, no) => {
    const s = { ...s0 }, t = Math.max(0, Math.min(1, +s.t || 0)), P = pose(t), h = hOf(s, t), tilt = +s.tilt || 0;
    let hooks, shares, zs, total; const topI = tilt >= 0 ? 0 : 1;   // + tilt raises end A: the crane on A is the top crane
    if (build2) { const R = ld.rig, keep = R.tilt; R.tilt = tilt; let res; try { res = solveRig(ld); } finally { R.tilt = keep; }
      hooks = (res?.hookPts || []).map(hp => { const v = rot2([hp[0], hp[1]], -P.rot); return [P.x + v[0], P.y + v[1]]; }); zs = (res?.hookPts || []).map(hp => h + hp[2]);
      shares = (res?.shares || [W / 2, W / 2]).slice(); }
    else { const sp = tandemSpan(ld), off = cranes.map(c => c.attach?.point === "A" ? -sp / 2 : c.attach?.point === "B" ? sp / 2 : (+ld.cog || 0));
      hooks = off.map(o => { const v = rot2([o * Math.cos(tilt * D2R), 0], -P.rot); return [P.x + v[0], P.y + v[1]]; }); const rh = loadRigHeight(ld, cranes.length > 1); zs = off.map(() => h + rh);
      shares = loadShares(ld, cranes.map(c => ({ id: c.id, point: c.attach?.point || "C" }))); }
    // the whole weight on the hooks (load + rigging) – taken level, where the rigging geometry is never singular
    if (total0 == null) { if (build2) { const R = ld.rig, keep = R.tilt; R.tilt = 0; let r0; try { r0 = solveRig(ld); } finally { R.tilt = keep; } total0 = (r0?.shares || []).reduce((a, v) => a + (+v || 0), 0); } if (!(total0 > 0)) total0 = W + (typeof rigW === "function" ? rigW(ld) : 0); }
    total = total0;
    if (shares.some(v => !Number.isFinite(+v) || +v < -0.01 || +v > total * 1.02)) { const k = cranes.length; shares = shares.map(() => total / k); if (tilt >= 89.5 && build2) shares = shares.map((v, j) => j === topI ? total : 0); }
    const per = cranes.map((c, k) => {
      const C = C0[k], i = build2 ? idxOf(c) : k, rel = s.release && (c.attach?.point || "C") === s.release, hk = rel && lastHk[c.id] ? lastHk[c.id].hk : (hooks[i] || hooks[0]), z = rel && lastHk[c.id] ? Math.max(h + 2, Math.min(lastHk[c.id].z, h + 4)) : (zs[i] ?? zs[0]); if (!rel) lastHk[c.id] = { hk, z };
      let geom = rel ? 0 : (+shares[build2 ? i : k] || 0); if (s.release && !rel) geom = total;
      let design = 0, dWhy = "";
      if (up && !s.release) { design = (i === topI ? (rule("tt.top") ?? 100) : (rule("tt.tail") ?? 75)) / 100 * total; dWhy = i === topI ? "top crane" : "tail crane"; }
      const used = Math.max(geom, design), R = Math.hypot(hk[0] - c.x, hk[1] - c.y), brg = bearingDeg(hk[0] - c.x, hk[1] - c.y), ba = boomAngle(C, c.L, R), ch = lsChart(c);
      const k2 = ch ? craneCapacity(C, c, ch, R) : { cap: null, why: "no load chart" }, hookLoad = used + (+c.hookBlock || 0) + (+c.extra || 0), util = k2.cap ? hookLoad / k2.cap * 100 : null;
      const hMax = ba.ok ? hookMaxZ(c, { C, ba }) : null, tooHigh = hMax != null && z > hMax + 0.05;
      return { c, C, rel, R, brg, ba, cap: k2.cap, why: k2.why, rUsed: k2.rUsed, geom, design, dWhy, used, hookLoad, util, hook: hk, z, hMax, tooHigh, ok: !rel && (k2.cap == null || util > lim || !ba.ok || tooHigh) ? false : true };
    });
    // what the load passes over at this step
    const out = loadOutline(ld).map(q => { const r = rot2([q[0] * Math.cos(tilt * D2R), q[1]], -P.rot); return [P.x + r[0], P.y + r[1]]; });
    // what is under (or in the way of) the load: what the app treats as solid on the site – a wall or coaming, a building, a vessel's accommodation
    let under = null; const segX = (p, q, r, t) => { const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return d(p, q, r) * d(p, q, t) < 0 && d(r, t, p) * d(r, t, q) < 0; };
    const atEnd = s.t <= 0.001 || s.t >= 0.999;
    for (const o of (typeof hitShapes === "function" ? hitShapes() : plan.obstacles)) { if ((o.type && !itemInLift(o)) || o.zone || o.kind === "dim" || !(+o.hgt > 0)) continue;
      const Q = o.kind === "circle" ? Array.from({ length: 16 }, (_, k) => [o.x + (+o.r || 1) * Math.cos(k * Math.PI / 8), o.y + (+o.r || 1) * Math.sin(k * Math.PI / 8)]) : o.kind === "line" ? (o.pts || []) : obsPts(o); if (!Q || Q.length < 2) continue;
      let hit = Q.some(p => inPolyPt(p, out)); if (!hit && o.kind !== "line") hit = out.some(p => inPolyPt(p, Q));
      if (!hit) for (let j = 0; j < Q.length - (o.kind === "line" ? 1 : 0) && !hit; j++) for (let m = 0; m < out.length && !hit; m++) hit = segX(out[m], out[(m + 1) % out.length], Q[j], Q[(j + 1) % Q.length]);
      if (!hit) continue; const top = +o.hgt; if (atEnd && top <= h + 0.05) continue;   // what it stands on at the pick or set
      if (!under || top > under.top) under = { top, name: o.label || OBJ_TYPES[o.type]?.name || "site item" }; }
    const clear = under ? h - under.top : null;
    return { no: no + 1, ...s, t, pose: P, h, tilt, per, under, clear, ok: per.every(q => q.ok) && !(clear != null && clear < TRAVEL_CLEAR - 0.01 && !atEnd) };
  });
  const r = { ld, cranes, units: cranes, steps, carry, up, auto: !(Array.isArray(ld.steps) && ld.steps.length), lim };
  LS_CACHE.set(key, r); return r;
}
// ---------- top and tail with a forklift ----------
// The crane's hook stays over the top lifting point and hoists; the tail rests on the forks (or hangs from a fork hook)
// at fork height, and the forklift drives in under the crane as the load turns up. At vertical the forks are lowered
// clear and the forklift backs away; the crane carries on alone. Shares by moments about the two supports (vertical
// rope, vertical fork reaction): the tail's part stays the same at every angle until it is let go.
// The set position is where the load ends up standing (as for two cranes): the top lug ends at the set pose's top lug.
function lsFTSteps(ld, cranes, fo) {
  const c = cranes[0], C = REG.cranes[c.model], F = FORKLIFTS[fo.fl.model], fl = fo.fl;
  const key = `ft|${ld.id}|${plan.updated}|${plan.al}|${JSON.stringify(ld.steps || "")}|${ld.upend ?? ""}|${JSON.stringify([c.x, c.y, c.L, c.chartId, c.hookBlock, c.extra, fl, ld.pick, ld.set, ld.cog, ld.span, ld.weight, ld.rigWeight])}`;
  { const hit = LS_CACHE.get(key); if (hit && lsCacheOk(hit, ld, cranes)) return hit; } if (LS_CACHE.size > 60) LS_CACHE.clear();
  normLoad(ld); const d = loadDims(ld), W = +ld.weight || 0, rw = typeof rigW === "function" ? rigW(ld) : 0, total = W + rw, lim = +plan.site.ulim || (rule("crane.util") ?? 100), flim = rule("fork.util") ?? 100;
  const sp = tandemSpan(ld) || d.x * 0.9, xA = -sp / 2, xB = sp / 2, zl = liftPointZ(ld), supZ = fl.how === "hook" ? zl : 0, rh = ld.rig?.arr ? loadRigHeight(ld, true) : (+ld.tandemRig || 0) + zl, cl = +fl.c || F.c0;
  const cog = +ld.cog || 0, tailW = Math.max(0, Math.min(W, W * (cog - xA) / (xB - xA)));
  const rot0 = +ld.pick.rot || 0, toW = (P, q) => { const v = rot2([q[0], q[1]], -(P.rot || 0)); return [P.x + v[0], P.y + v[1]]; };
  const sEnd = lsSteps(ld).slice(-1)[0], aEnd = tiltFn(ld, { tilt: +sEnd?.tilt || 0 })([xA, 0, zl]), A0 = toW(ld.pick, [xA, 0]), A1 = toW(ld.set, [aEnd[0], aEnd[1]]), hOf = s => s.h === "pick" ? (+ld.pick.h || 0) : s.h === "set" ? (+ld.set.h || 0) : s.h === "carry" ? Math.max(+ld.pick.h || 0, +ld.set.h || 0) + 1 : s.h === "lift" ? (+ld.pick.h || 0) + 1 : (+s.h || 0);
  const fx0 = { id: fo.id, label: fo.label || "Forklift", color: "#b8860b", model: F.name, attach: { point: "F" } }; let lastF = null;
  const steps = lsSteps(ld).map((s0, no) => {
    const s = { ...s0 }, t = Math.max(0, Math.min(1, +s.t || 0)), tilt = +s.tilt || 0, rel = s.release === "F", TT = tiltFn(ld, { tilt }), rot = rot0 + ((+ld.set.rot || 0) - rot0) * t;
    const a = TT([xA, 0, zl]), b = TT([xB, 0, supZ]), Ap = [A0[0] + (A1[0] - A0[0]) * t, A0[1] + (A1[1] - A0[1]) * t];
    let hf = hOf(s), h0;
    if (rel) h0 = s.h === "lift" ? Math.max(0.05, (lastF ? lastF.h0 : hf)) : hf; else { h0 = hf - b[2]; if (h0 < 0.05) { h0 = 0.05; hf = h0 + b[2]; } }
    const va = rot2([a[0], a[1]], -rot), P = { x: Ap[0] - va[0], y: Ap[1] - va[1], rot }, Bp = toW(P, b);
    const zA = h0 + a[2], z = zA + (rh - zl);
    // the crane
    const R = Math.hypot(Ap[0] - c.x, Ap[1] - c.y), brg = bearingDeg(Ap[0] - c.x, Ap[1] - c.y), ba = boomAngle(C, c.L, R), ch = lsChart(c), k2 = ch ? craneCapacity(C, c, ch, R) : { cap: null, why: "no load chart" };
    const geom = rel ? total : total - tailW, design = rel ? 0 : (rule("tt.top") ?? 100) / 100 * total, used = Math.max(geom, design), hookLoad = used + (+c.hookBlock || 0) + (+c.extra || 0), util = k2.cap ? hookLoad / k2.cap * 100 : null;
    const hMax = ba.ok ? hookMaxZ(c, { C, ba }) : null, tooHigh = hMax != null && z > hMax + 0.05;
    const qc = { c, C, rel: false, R, brg, ba, cap: k2.cap, why: k2.why, rUsed: k2.rUsed, geom, design, dWhy: "top crane", used, hookLoad, util, hook: Ap, z, hMax, tooHigh, ok: !(k2.cap == null || util > lim || !ba.ok || tooHigh) };
    // the forklift: forks under the tail, facing the crane
    let qf;
    if (!rel) {
      const u0 = [Ap[0] - Bp[0], Ap[1] - Bp[1]], ul = Math.hypot(u0[0], u0[1]), u = ul > 0.05 ? [u0[0] / ul, u0[1] / ul] : (lastF ? lastF.u : rot2([-1, 0], -rot));
      const face = [Bp[0] - u[0] * cl, Bp[1] - u[1] * cl], ctr = [face[0] - u[0] * F.l2 / 2, face[1] - u[1] * F.l2 / 2];
      const fgeom = tailW, fdesign = (rule("tt.fork") ?? 75) / 100 * W, fused = Math.max(fgeom, fdesign), load = fused + (+fl.attW || 0), cap = flCap(F, cl, fl.mast), ax = flAxles(F, load, cl), futil = load / cap * 100;
      qf = { c: fx0, fork: true, F, rel: false, ctr, u, rot: flHeading(u), face, B: Bp, hook: Bp, z: hf, forkH: hf, cl, geom: fgeom, design: fdesign, dWhy: "tailing forklift", used: fused, hookLoad: load, cap, util: futil, axles: ax, h3: +fl.mast || F.h3,
        tooHigh: hf > (+fl.mast || F.h3) + 0.01, ok: futil <= flim && ax[1] > 0 && hf <= (+fl.mast || F.h3) + 0.01 };
      lastF = { ctr, u, rot: qf.rot, hf, h0 };
    } else { const L0 = lastF || { ctr: [fo.x, fo.y], u: rot2([1, 0], -(fo.rot || 0)), rot: fo.rot || 0, hf: 0.15 }, back = 2.5;
      qf = { c: fx0, fork: true, F, rel: true, ctr: [L0.ctr[0] - L0.u[0] * back, L0.ctr[1] - L0.u[1] * back], u: L0.u, rot: L0.rot, z: 0.15, forkH: 0.15, cl, geom: 0, design: 0, used: 0, hookLoad: 0, cap: null, util: null, ok: true, hook: null }; }
    // what is under the load (the forklift holding it doesn't count)
    const out = loadOutline(ld).map(q => { const r = rot2([q[0] * Math.cos(tilt * D2R), q[1]], -rot); return [P.x + r[0], P.y + r[1]]; });
    let under = null; for (const o of (typeof hitShapes === "function" ? hitShapes() : plan.obstacles)) { if (o === fo || o.id === fo.id || (o.type && !itemInLift(o)) || o.zone || o.kind === "dim" || !(+o.hgt > 0) || o.kind === "line") continue;
      const Q = o.kind === "circle" ? Array.from({ length: 16 }, (_, k) => [o.x + (+o.r || 1) * Math.cos(k * Math.PI / 8), o.y + (+o.r || 1) * Math.sin(k * Math.PI / 8)]) : obsPts(o); if (!Q || Q.length < 3) continue;
      if (!(Q.some(p => inPolyPt(p, out)) || out.some(p => inPolyPt(p, Q)))) continue; const top = +o.hgt; if ((t <= 0.001 || t >= 0.999) && top <= h0 + 0.05) continue; if (!under || top > under.top) under = { top, name: o.label || OBJ_TYPES[o.type]?.name || "site item" }; }
    const clear = under ? h0 - under.top : null;
    return { no: no + 1, ...s, t, pose: P, h: h0, forkH: hf, tilt, per: [qc, qf], under, clear, ok: qc.ok && qf.ok };
  });
  const r = { ld, cranes, units: [c, fx0], fork: fo, F, ft: true, steps, carry: { H: Math.max(+ld.pick.h || 0, +ld.set.h || 0) + 1, top: 0 }, up: true, auto: !(Array.isArray(ld.steps) && ld.steps.length), lim, flim };
  LS_CACHE.set(key, r); return r;
}
// every step that fails goes into the crane's checks
{ const _cs = craneSummary; craneSummary = function (cr, ...a) { const S = _cs.call(this, cr, ...a);
    try { const ld = plan.loads.find(l => l.id === cr.attach?.load); if (!S || !ld || !lsTwo(ld)) return S; const L = liftSteps(ld); if (!L) return S;
      const name = cr.label || REG.cranes[cr.model]?.short || "Crane";
      let worst = null; for (const s of L.steps) { const q = s.per.find(p => p.c.id === cr.id); if (!q || q.rel) continue; if (q.util != null && (!worst || q.util > worst.q.util)) worst = { s, q };
        if (q.cap == null) S.warn.push(`${name}: lift step ${s.no} (${s.name}) – no chart capacity at R ${fx(q.R, 1)} m${q.why ? " – " + q.why : ""}`);
        else if (q.util > L.lim) S.warn.push(`${name}: lift step ${s.no} (${s.name}) – ${fx(q.hookLoad, 1)} t at R ${fx(q.R, 1)} m on ${fx(q.cap, 1)} t = ${fx(q.util, 0)}%, over the ${L.lim}% limit${q.design > q.geom + 0.01 ? ` (checked as the ${q.dWhy} for ${q.dWhy === "top crane" ? (rule("tt.top") ?? 100) : (rule("tt.tail") ?? 75)}% of the load)` : ""}`);
        if (q.tooHigh) S.warn.push(`${name}: lift step ${s.no} (${s.name}) – the hook would need to be ${fx(q.z, 1)} m up; this boom gives ${fx(q.hMax, 1)} m at R ${fx(q.R, 1)} m`);
        if (!q.ba.ok) S.warn.push(`${name}: lift step ${s.no} (${s.name}) – ${q.ba.why}`); }
      if (worst) S.steps = { worst, L };
      if (L.ft && cr === L.cranes[0]) { const fn = `${L.fork.label || "Forklift"}`;
        for (const s of L.steps) { const f = s.per.find(p => p.fork); if (!f || f.rel) continue;
          if (f.util > L.flim) S.warn.push(`${fn}: lift step ${s.no} (${s.name}) – ${fx(f.hookLoad, 1)} t on the forks at ${fx(f.cl * 1000, 0)} mm load centre on ~${fx(f.cap, 1)} t = ${fx(f.util, 0)}%, over the ${L.flim}% limit${f.design > f.geom + 0.01 ? ` (checked as the tailing forklift for ${rule("tt.fork") ?? 75}% of the load)` : ""}`);
          if (f.axles[1] <= 0) S.warn.push(`${fn}: lift step ${s.no} – the rear axle is unloaded (${fx(f.axles[1], 1)} t): the forklift would tip forward`);
          if (f.tooHigh) S.warn.push(`${fn}: lift step ${s.no} – forks at ${fx(f.forkH, 2)} m, above the mast's ${fx(f.h3, 2)} m lift`); } }
      if (cr === L.cranes[0]) for (const s of L.steps) if (s.clear != null && s.clear < TRAVEL_CLEAR - 0.01 && ((s.t > 0.001 && s.t < 0.999) || (s.h > (+ld.pick.h || 0) + 0.05 && s.h > (+ld.set.h || 0) + 0.05)))
        S.warn.push(s.clear < 0 ? `${ld.name}: lift step ${s.no} (${s.name}) – the load at ${fx(s.h, 1)} m runs into ${s.under.name} (${fx(s.under.top, 1)} m high) – raise it to ${fx(s.under.top + TRAVEL_CLEAR, 1)} m` : `${ld.name}: lift step ${s.no} (${s.name}) – only ${fx(s.clear, 2)} m over ${s.under.name}; keep ${fx(TRAVEL_CLEAR, 1)} m`);
    } catch (e) { console.warn(e); }
    return S; }; }

// ================= the crane's check through the lift follows the lift steps =================
// A lift with steps (tandem, top and tail, crane + forklift) is checked along the path the steps take – each step, and
// points along any slew or travel between them – not along a straight line from pick to set with the load lying flat.
{ const _seq = liftSequence; liftSequence = function (cr, S) {
    const ld = plan.loads.find(l => l.id === cr.attach?.load);
    if (!ld || !(lsTwo(ld) || (Array.isArray(ld.steps) && ld.steps.length))) return _seq.call(this, cr, S);
    const L = liftSteps(ld); if (!L || !S.C) return _seq.call(this, cr, S);
    const rows = [], n = L.steps.length;
    const row = (name, t, q) => { const ba = boomAngle(S.C, cr.L, q.R); rows.push({ name, t, R: q.R, ang: ba.ok ? ba.theta : null, cap: q.cap ?? null, rUsed: q.rUsed, util: q.util ?? null }); };
    L.steps.forEach((s, i) => { const q = s.per.find(x => x.c === cr); if (!q || q.rel) return; const t = n > 1 ? i / (n - 1) : 0;
      const prev = L.steps[i - 1], p = prev && prev.per.find(x => x.c === cr);
      if (p && !p.rel && lsPlanMove(prev, s)) for (const u of [0.25, 0.5, 0.75]) { const m = lsLerpStep(prev, s, u).per.find(x => x.c === cr), k = lsChart(cr) ? craneCapacity(S.C, cr, lsChart(cr), m.R) : { cap: null };
        row(`Step ${s.no} – on the way (${u * 100}%)`, t - (1 - u) / Math.max(1, n - 1), { R: m.R, cap: k.cap, rUsed: k.rUsed, util: k.cap ? q.hookLoad / k.cap * 100 : null }); }
      row(`Step ${s.no} – ${s.name}`, t, q); });
    if (!rows.length) return _seq.call(this, cr, S);
    const mx = rows.reduce((m, r) => (r.util ?? -1) > (m.util ?? -1) ? r : m, rows[0]);
    return { rows, mx, W: Math.max(...rows.map(r => r.util && r.cap ? r.util * r.cap / 100 : 0)), slew: 0, steps: true }; }; }
