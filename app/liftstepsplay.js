// ================= Play lift: a lift with steps plays its steps =================
// A tandem lift, a top and tail (cranes or crane + forklift) or a lift you gave steps to plays step by step in 3D: the load
// turning up stage by stage, every crane luffing / slewing / hoisting to the step's hook, the tail crane lowering off or the
// forklift driving in and backing away, the turn and move to the set point – the same numbers as the step sheets.
const lsAngLerp = (a, b, u) => a + ((((b - a) % 360) + 540) % 360 - 180) * u;
function lsLerpStep(a, b, u) {
  const s0 = lsLerpStep0(a, b, u), cr = Math.abs((+b.t || 0) - (+a.t || 0)) > 1e-6 ? lsCarrier(a, b) : null; if (!cr) return s0;
  // one crane carries it to the set point: the load swings round with the hook on the slew arc, turning on the hook as planned
  const DB = lsSlewDelta(a, b, cr.p, cr.q), R = cr.p.R + (cr.q.R - cr.p.R) * u, brg = cr.p.brg + DB * u, c = cr.q.c, hk = [c.x + R * Math.sin(brg * D2R), c.y + R * Math.cos(brg * D2R)];
  const rot = (+a.pose.rot || 0) + (DB + lsHookTurn(a, b)) * u, loc = rot2([a.pose.x - cr.p.hook[0], a.pose.y - cr.p.hook[1]], +a.pose.rot || 0), off = rot2(loc, -rot);
  s0.pose = { x: hk[0] + off[0], y: hk[1] + off[1], rot }; return s0;
}
function lsLerpStep0(a, b, u) {
  const L = (x, y) => x + (y - x) * u, s = { ...b, pose: { x: L(a.pose.x, b.pose.x), y: L(a.pose.y, b.pose.y), rot: lsAngLerp(+a.pose.rot || 0, +b.pose.rot || 0, u) }, h: L(a.h, b.h), tilt: L(+a.tilt || 0, +b.tilt || 0), forkH: b.forkH != null ? L(a.forkH ?? b.forkH, b.forkH) : undefined };
  s.per = b.per.map(q => { const p = a.per.find(x => x.c === q.c) || q;
    if (q.fork) { const ctr = [L(p.ctr[0], q.ctr[0]), L(p.ctr[1], q.ctr[1])]; return { ...q, ctr, rot: lsAngLerp(p.rot, q.rot, u), forkH: L(p.forkH, q.forkH), rel: u < 0.5 ? p.rel : q.rel, util: u < 0.5 ? p.util : q.util }; }
    const R = L(p.R, q.R), brg = p.brg + lsSlewDelta(a, b, p, q) * u, c = q.c;
    return { ...q, R, brg, z: L(p.z, q.z), hook: [c.x + R * Math.sin(brg * D2R), c.y + R * Math.cos(brg * D2R)], rel: q.rel && u > 0.6 ? true : p.rel && u < 0.4 ? true : false, util: u < 0.5 ? p.util : q.util, hookLoad: u < 0.5 ? p.hookLoad : q.hookLoad, cap: u < 0.5 ? p.cap : q.cap }; });
  return s;
}
// the 3D model: notes which phase it is built for (the load standing at set – liftset.js) and, while a lift with steps
// plays, puts the lift in the played moment (lsEnter: load, tilt, hooks, forklift) for the build and back afterwards
{ const _bm = buildMesh; buildMesh = function (phase, ...a) { const k = LS_SET.ph; LS_SET.ph = phase; let leave = null;
    try { const C = typeof LP !== "undefined" && LP.on ? LP.seqCur : null;
      if (C && !LS_DRAW) { leave = lsEnter(C.L, C.s, { hooksFree: true }); Object.assign(LS_DRAW, { d3: true, L: C.L, s: C.s }); }
      return _bm.call(this, phase, ...a); } finally { if (leave) leave(); LS_SET.ph = k; } }; }
window.addEventListener("load", () => {   // Play lift (liftplay.js) loads after this file
{ const _lps = lpSteps; lpSteps = function (...a) { const out = _lps.apply(this, a);
    for (const S of out) { const ld = S.ld; if (!lsTwo(ld) && !(Array.isArray(ld.steps) && ld.steps.length)) continue; const L = liftSteps(ld); if (!L || L.steps.length < 2) continue;
      const ph = [{ k: "seq", a: 0, b: 0, dur: 2.2, txt: `Step 1 – ${L.steps[0].name}: ${lsMoves(null, L.steps[0]).map(m => `${m.q.c.label || "crane"} – ${m.txt}`).join(" · ")}` }];
      for (let i = 1; i < L.steps.length; i++) { const A = L.steps[i - 1], B = L.steps[i], mv = lsMoves(A, B);
        let dur = 1.6 + Math.abs((+B.tilt || 0) - (+A.tilt || 0)) / 14 + Math.hypot(B.pose.x - A.pose.x, B.pose.y - A.pose.y) / 2.5 + Math.abs(B.h - A.h) / 2.5;
        for (const q of B.per) { const p = A.per.find(x => x.c === q.c); if (p && !q.fork) dur += Math.abs(lsAngLerp(0, q.brg - p.brg, 1)) / 25 + Math.abs(q.R - p.R) / 4; if (p && q.fork && p.ctr && q.ctr) dur += Math.hypot(q.ctr[0] - p.ctr[0], q.ctr[1] - p.ctr[1]) / 2; }
        ph.push({ k: "seq", a: i - 1, b: i, dur: Math.max(2, Math.min(7, dur)), txt: `Step ${B.no} – ${B.name}: ${mv.map(m => `${m.q.c.label || "crane"} – ${m.txt}`).join(" · ")}` }); }
      ph.push({ k: "seq", a: L.steps.length - 1, b: L.steps.length - 1, dur: 2, txt: `Done – ${ld.name || "the load"} is set. Slack off and unhook.` });
      S.seq = L; S.phases = ph; S.pts = L.steps.map(s => [s.pose.x, s.pose.y]).concat(L.steps.flatMap(s => s.per.filter(q => q.fork && q.ctr).map(q => q.ctr)));
      S.Hc = Math.max(...L.steps.flatMap(s => s.per.map(q => q.fork ? 4 : (q.hMax != null ? Math.min(q.z, q.hMax) : q.z)))); S.rigH = 2; }
    return out; }; }
{ const _lpa = lpApply; lpApply = function (st, ...a) { _lpa.call(this, st, ...a); LP.seqCur = null;
    for (const S of LP.steps || []) if (S.seq && S.save) Object.assign(S.ld.pick, S.save.pick);   // a lift with steps is drawn from its steps – its pick stays as planned
    if (st && st.S && st.S.seq && st.ph.k === "seq") { const L = st.S.seq, A = L.steps[st.ph.a], B = L.steps[st.ph.b]; LP.seqCur = { L, s: lsLerpStep(A, B, lpEase(st.u)) }; } }; }
{ const _lpr = lpReadout; lpReadout = function (st, ...a) { const C = LP.seqCur; if (!C || !st.S.seq) return _lpr.call(this, st, ...a);
    const s = C.s; return s.per.map(q => q.fork ? `${q.c.label || "Forklift"}: ${q.rel ? "clear" : `forks ${fx(q.forkH, 2)} m · ${fx(q.util, 0)} %`}` : `${q.c.label || "Crane"}: ${q.rel ? "off the hook" : `R ${fx(q.R, 1)} m · hook ${fx(q.z, 1)} m${q.util != null ? ` · ${fx(q.util, 0)} %` : ""}`}`).join("  |  ") + `  |  load ${s.tilt > 0.5 ? `turned up ${fx(s.tilt, 0)}°` : "level"}, bottom ${fx(s.h, 1)} m`; }; }
});

