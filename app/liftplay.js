// ================= Play the lift in 3D =================
// A walk-through for briefing the crew: in the 3D view, ▶ Play lift runs the lift as it will be done –
// take the weight, hoist to the height needed to clear everything on the way, slew (booming up / down where the plan
// says so, the load turned in just before set-down), lower onto the set position. The camera moves round so the
// viewer sees it from different sides, and a caption says what is happening with the radius, boom angle, hook height
// and utilisation at that moment. Nothing in the plan is changed: positions are put back when it stops.
const LP = { on: false, raf: 0, t0: 0, tPause: 0, paused: false, speed: 1, steps: null, save: null, lastBuild: 0, focus: null };
function lpSteps() {
  const out = [];
  for (const ld of plan.loads) {
    const cranes = plan.cranes.filter(c => c.attach?.load === ld.id && REG.cranes[c.model]); if (!cranes.length) continue;
    const tp = travelPath(ld), rigH = loadRigHeight(ld, cranes.length > 1), d = loadDims(ld);
    const P0 = [ld.pick.x, ld.pick.y], P1 = [ld.set.x, ld.set.y];
    const pts = tp ? tp.pts : [P0, P1], rots = tp ? tp.rots : [+ld.pick.rot || 0, +ld.set.rot || 0];
    // height to carry it at: 1 m over the tallest thing it passes over, at least 1 m up – never above what the hook can reach
    const hit = tp ? obstacleHits(ld, tp) : null; let top = 0; if (hit && hit.over) for (const v of hit.over.values()) top = Math.max(top, v.top);
    let Hc = Math.max((+ld.pick.h || 0) + 1, (+ld.set.h || 0) + 1, top + TRAVEL_CLEAR);
    let hMax = Infinity; for (const c of cranes) for (const p of (tp && tp.hooks) || pts) { const m = travelHookMax(c, Math.hypot(p[0] - c.x, p[1] - c.y)); if (m != null) hMax = Math.min(hMax, m - rigH); }
    if (Number.isFinite(hMax)) Hc = Math.max(Math.min(Hc, hMax), Math.max(+ld.pick.h || 0, +ld.set.h || 0));
    const slew = tp && tp.hooks ? tp.slew : 0, luff = tp && tp.luff;
    const moveTxt = Math.abs(slew) > 1 ? `Slew ${fx(Math.abs(slew), 0)}° ${slew >= 0 ? "clockwise" : "anticlockwise"}` : `Travel ${fx(Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), 1)} m`;
    const name = ld.name || "the load";
    out.push({ ld, cranes, pts, rots, rigH, Hc, d, phases: [
      { k: "hold", dur: 2.2, txt: `Hook on ${name} and take the weight` },
      { k: "up", dur: 3.2, txt: `Lift off – hoist the load ${fx(Hc - (+ld.pick.h || 0), 1)} m${top > 0 ? ` (1 m over the highest item it passes, ${fx(top, 1)} m)` : ""}` },
      { k: "move", dur: Math.max(5, Math.min(16, 3 + Math.abs(slew) / 14 + pts.length * 0.05)), txt: `${moveTxt}${luff ? ` – ${luff.up ? "boom up" : "boom down"} ${fx(luff.boom, 1)} m to R ${fx(luff.Rmin, 1)} m${luff.names.length ? " to clear " + luff.names.join(", ") : ""}` : ""}${Math.abs(((+ld.set.rot || 0) - (+ld.pick.rot || 0) + 540) % 360 - 180) > 2 ? " – turn it into line just before set-down" : ""}` },
      { k: "down", dur: 3.2, txt: `Lower onto the set position${ld.set.h > 0 ? ` (${fx(+ld.set.h, 2)} m up)` : ""}` },
      { k: "land", dur: 2, txt: `Landed – slack off and unhook` }] });
  }
  return out;
}
const lpEase = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
function lpTotal() { return LP.steps.reduce((a, s) => a + s.phases.reduce((b, p) => b + p.dur, 0), 0); }
// where everything is at time t (seconds)
function lpState(t) {
  let acc = 0;
  for (let si = 0; si < LP.steps.length; si++) { const S = LP.steps[si];
    for (let pi = 0; pi < S.phases.length; pi++) { const ph = S.phases[pi];
      if (t <= acc + ph.dur || (si === LP.steps.length - 1 && pi === S.phases.length - 1)) { const u = Math.max(0, Math.min(1, (t - acc) / ph.dur)); return { si, pi, u, S, ph }; }
      acc += ph.dur; } }
  return null;
}
function lpPose(S, k, u) {
  const n = S.pts.length - 1, ld = S.ld, h0 = +S.save.pick.h || 0, h1 = +S.save.set.h || 0;
  const at = f => { const x = f * n, i = Math.min(n - 1, Math.floor(x)), w = n ? x - i : 0, a = S.pts[i], b = S.pts[Math.min(n, i + 1)];
    let r0 = S.rots[i], r1 = S.rots[Math.min(n, i + 1)]; r1 = r0 + ((r1 - r0 + 540) % 360 - 180);
    return { x: a[0] + (b[0] - a[0]) * w, y: a[1] + (b[1] - a[1]) * w, rot: r0 + (r1 - r0) * w }; };
  const e = lpEase(u);
  if (k === "hold") return { ...at(0), h: h0 };
  if (k === "up") return { ...at(0), h: h0 + (S.Hc - h0) * e };
  if (k === "move") return { ...at(e), h: S.Hc };
  if (k === "down") return { ...at(1), h: S.Hc + (h1 - S.Hc) * e };
  return { ...at(1), h: h1 };
}
function lpApply(st) {
  // earlier loads sit at their set positions, later ones at their picks
  LP.steps.forEach((S, i) => { const ld = S.ld;
    if (i < st.si) ld.pick = { ...S.save.pick, x: S.save.set.x, y: S.save.set.y, h: S.save.set.h, rot: S.save.set.rot };
    else if (i > st.si) ld.pick = { ...S.save.pick };
    else { const q = lpPose(S, st.ph.k, st.u); ld.pick = { ...S.save.pick, x: q.x, y: q.y, h: q.h, rot: q.rot }; delete ld.pick.onT; delete ld.pick.onV; } });
}
function lpCamera(T, t) {
  const u = Math.max(0, Math.min(1, t / T)), C = LP.save.v3;
  V3.az = C.az - 20 + 80 * lpEase(u);
  V3.el = 24 + 10 * Math.sin(Math.PI * u);
  V3.zoom = 1.15 - 0.2 * Math.sin(Math.PI * u);
  // lift the picture a little so the footer caption doesn't sit over the lift
  const F = LP.focus || GL.focus, size = F ? Math.hypot(F[3] - F[0], F[4] - F[1], F[5] || 8) / 2 : 0; V3.pan = [0, -size * 0.1];
}
function lpReadout(st) {
  const S = st.S, cr = S.cranes[0], ev = evalCrane(cr, "pick"), C = REG.cranes[cr.model];
  const R = ev.R, ba = C ? boomAngle(C, cr.L, R) : null, cap = ev.chart && C ? craneCapacity(C, cr, ev.chart, R).cap : null;
  const W = ev.hookLoad || 0, hk = (+S.ld.pick.h || 0) + S.rigH;
  return `R ${fx(R, 1)} m · boom ${fx(cr.L, 1)} m${ba && ba.ok ? ` at ${fx(ba.theta, 1)}°` : ""} · hook ${fx(hk, 1)} m · load bottom ${fx(+S.ld.pick.h || 0, 1)} m${cap ? ` · ${fx(W / cap * 100, 0)} % of ${fx(cap, 0)} t` : ""}`;
}
function lpFrame(now) {
  if (!LP.on) return;
  const T = lpTotal(), t = LP.paused ? LP.tPause : (now - LP.t0) / 1000 * LP.speed;
  const st = lpState(Math.min(t, T)); if (!st) return lpStop();
  lpApply(st); lpCamera(T, Math.min(t, T));
  const host = $("view3d"), r = host.getBoundingClientRect(), W = Math.max(300, Math.round(r.width)), H = Math.max(300, Math.round(r.height));
  try {
    if (!LP.paused || !LP.built) { lpBuildFrame(); LP.built = true; }
    GL.focus = LP.focus.slice(); GL.sig = "";
    glCamera(W, H); GL.R.render(GL.scene, GL.cam); glLabels(host, W, H);
  } catch (e) { console.warn("play", e); return lpStop(); }
  // caption
  const cap = $("lpCap"); if (cap) {
    const n = LP.steps.reduce((a, S, i) => a + (i < st.si ? S.phases.length : 0), 0) + st.pi + 1, N = LP.steps.reduce((a, S) => a + S.phases.length, 0);
    cap.innerHTML = `<div class="lpStep">${LP.all ? `${escH(plan.lifts[plan.al].name)} (${LP.qi + 1} of ${LP.queue.length}) · ` : ""}${LP.steps.length > 1 ? `${escH(st.S.ld.name || "Load")} · ` : ""}Step ${n} of ${N}</div><div class="lpTxt">${escH(st.ph.txt)}</div><div class="lpRead">${escH(lpReadout(st))}</div><div class="lpBar"><i style="width:${(Math.min(t, T) / T * 100).toFixed(1)}%"></i></div>`; }
  if (t >= T + 1.2 && !LP.paused) {
    if (LP.all && LP.qi < LP.queue.length - 1) { if (!lpNextLift()) return lpStop(); LP.raf = requestAnimationFrame(lpFrame); return; }
    LP.paused = true; LP.tPause = T; $("lpPause").textContent = "↻ Again"; LP.done = true; }
  LP.raf = requestAnimationFrame(lpFrame);
}
// set up the current lift for playing (its loads' positions and crane tips are kept to be put back)
function lpBegin() {
  const steps = lpSteps(); if (!steps.length) return false;
  steps.forEach(S => { S.save = { pick: { ...S.ld.pick }, set: { ...S.ld.set }, pickRef: S.ld.pick }; });
  LP.tips = plan.cranes.map(c => [c, c.tip]); plan.cranes.forEach(c => { if (c.tip) c.tip = null; });
  plan.phase = "pick"; LP.steps = steps; LP.paused = false; LP.done = false; LP.built = false; LP.t0 = performance.now();
  // what the camera keeps in view: the cranes and the whole path
  const P = []; steps.forEach(S => { S.pts.forEach(p => P.push(p)); S.cranes.forEach(c => P.push([c.x, c.y])); });
  const zMax = Math.max(...steps.map(S => S.Hc + S.rigH + 6), ...steps.flatMap(S => S.cranes.map(c => (+c.L || 30) * 0.9)));
  LP.focus = [Math.min(...P.map(p => p[0])) - 6, Math.min(...P.map(p => p[1])) - 6, 0, Math.max(...P.map(p => p[0])) + 6, Math.max(...P.map(p => p[1])) + 6, zMax];
  return true;
}
// Each frame only what moves is rebuilt: the still scenery (site items, buildings, mats, zones – everything in
// plan.obstacles except a forklift working the lift) is built once when the lift starts and kept with its lines and
// labels; each frame rebuilds the cranes with their hooks and ropes, the loads, the rigging and the forklift.
// Rebuilding everything every frame (ground textures included) held playback to a few frames a second.
const lpMoves = o => !!(o && o.fl);
function lpBuildFrame() {
  const O = plan.obstacles;
  if (!LP.still) { const L0 = plan.loads, C0 = plan.cranes, MS = shownMatIds(), sm = shownMatIds; let Ms;   // which mats show is decided with the real cranes
    shownMatIds = () => MS; plan.loads = []; plan.cranes = []; plan.obstacles = O.filter(o => !lpMoves(o));
    try { Ms = buildMesh("pick"); } finally { plan.loads = L0; plan.cranes = C0; plan.obstacles = O; shownMatIds = sm; }
    glBuild({ ...Ms, lines: [], labels: [] }); LP.still = new THREE.Group(); for (const ch of [...GL.root.children]) { GL.root.remove(ch); LP.still.add(ch); } GL.root.parent.add(LP.still);
    LP.stillLines = Ms.lines; LP.stillLabels = Ms.labels; LP.stillBounds = GL.bounds; }
  let M; const MS = shownMatIds(), sm = shownMatIds; shownMatIds = () => MS; plan.obstacles = O.filter(lpMoves); try { M = buildMesh("pick"); } finally { plan.obstacles = O; shownMatIds = sm; }
  GL.bounds = LP.stillBounds; glBuild({ ...M, lines: [...M.lines, ...(LP.stillLines || [])], labels: [...M.labels, ...(LP.stillLabels || [])] }, { movingOnly: true });
}
function lpDropStill() { if (!LP.still) return; LP.still.parent && LP.still.parent.remove(LP.still); LP.still.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material._keep) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!m._keepMap && m.map) m.map.dispose(); m.dispose(); }); }); LP.still = null; LP.stillLines = LP.stillLabels = null; }
function lpEndLift() {
  lpDropStill();
  if (!LP.steps) return;
  LP.steps.forEach(S => { S.ld.pick = S.save.pickRef; Object.assign(S.ld.pick, S.save.pick); });
  (LP.tips || []).forEach(([c, t]) => { c.tip = t; }); LP.tips = null;
}
// the lifts that can be played: ones with a crane hooked on to a load
function lpPlayable() { syncLift(); return plan.lifts.map((L, i) => i).filter(i => plan.lifts[i].loads.some(ld => plan.lifts[i].cranes.some(c => c.attach?.load === ld.id && REG.cranes[c.model]))); }
function lpStart(all) {
  if (V3.mode !== "3d" || typeof GL === "undefined" || !glAvailable() || V3.flat) { toast("Switch to the 3D view to play the lift"); return; }
  LP.all = !!all && plan.lifts.length > 1; LP.startAl = plan.al;
  if (LP.all) { LP.queue = lpPlayable(); if (!LP.queue.length) { toast("No lift has a crane hooked on to its load yet"); return; } LP.qi = 0; if (plan.al !== LP.queue[0]) switchLift(LP.queue[0]); }
  LP.save = { phase: plan.phase, v3: { az: V3.az, el: V3.el, zoom: V3.zoom, pan: [...V3.pan] } };
  if (!lpBegin()) { toast("Hook a crane on to the load first – then the lift can be played"); return; }
  LP.on = true; document.body.classList.add("lpOn"); lpUi();
  LP.raf = requestAnimationFrame(lpFrame);
}
// all lifts: when one lift is done, the next one starts (its own cranes, mats and transport)
function lpNextLift() {
  lpEndLift();
  LP.qi++; if (LP.qi >= LP.queue.length) return false;
  switchLift(LP.queue[LP.qi]); return lpBegin();
}
function lpStop() {
  if (!LP.on) return;
  LP.on = false; cancelAnimationFrame(LP.raf);
  lpEndLift(); lpDropStill();
  plan.phase = LP.save.phase; Object.assign(V3, LP.save.v3);
  document.body.classList.remove("lpOn"); GL.sig = "";
  if (LP.all && plan.al !== LP.startAl) switchLift(LP.startAl);
  lpUi(); renderAll(); if (V3.mode !== "top") render3D();
}
function lpUi() {
  const sec = $("view3d")?.parentElement; if (!sec) return;
  let box = $("lpBox");
  if (!box) {
    box = document.createElement("div"); box.id = "lpBox";
    box.innerHTML = `<span id="lpGos" style="display:flex;gap:6px"><button id="lpAll" title="Play every lift in this plan, one after the other">▶▶ Play all lifts</button><button id="lpGo" class="pri" title="Play this lift in 3D – for briefing the crew">▶ Play lift</button></span><span id="lpCtl"><button id="lpPause">❚❚ Pause</button><button id="lpSpd" title="Speed">1×</button><button id="lpX">■ Stop</button></span><div id="lpCap"></div>`;
    sec.append(box);
    $("lpGo").onclick = () => lpStart(false); $("lpAll").onclick = () => lpStart(true); $("lpX").onclick = lpStop;
    $("lpPause").onclick = () => { if (!LP.on) return;
      if (LP.done) { if (LP.all && LP.qi > 0) { lpEndLift(); LP.qi = 0; switchLift(LP.queue[0]); lpBegin(); } LP.done = false; LP.paused = false; LP.t0 = performance.now(); LP.built = false; $("lpPause").textContent = "❚❚ Pause"; return; }
      if (LP.paused) { LP.paused = false; LP.t0 = performance.now() - LP.tPause * 1000 / LP.speed; $("lpPause").textContent = "❚❚ Pause"; }
      else { LP.tPause = (performance.now() - LP.t0) / 1000 * LP.speed; LP.paused = true; LP.built = false; $("lpPause").textContent = "▶ Resume"; } };
    $("lpSpd").onclick = () => { const s = LP.speed === 1 ? 2 : LP.speed === 2 ? 0.5 : 1, tNow = LP.paused ? LP.tPause : (performance.now() - LP.t0) / 1000 * LP.speed; LP.speed = s; if (!LP.paused) LP.t0 = performance.now() - tNow * 1000 / s; $("lpSpd").textContent = s === 0.5 ? "½×" : s + "×"; };
    document.addEventListener("keydown", e => { if (e.key === "Escape" && LP.on) lpStop(); });
  }
  const show3d = V3.mode === "3d" && !$("view3d").hidden;
  box.hidden = !show3d;
  $("lpGos").style.display = LP.on ? "none" : "flex"; $("lpAll").hidden = (plan.lifts || []).length < 2; $("lpCtl").hidden = !LP.on; $("lpCap").hidden = !LP.on;
}
(() => {
  const css = document.createElement("style");
  css.textContent = `#lpBox{position:absolute;right:14px;bottom:14px;z-index:6;display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:none;max-width:min(560px,calc(100% - 28px))}
#lpBox>*{pointer-events:auto}#lpCtl{display:flex;gap:6px}#lpCtl[hidden],#lpCap[hidden],#lpGo[hidden]{display:none}
#lpCap{background:rgba(22,32,42,.86);color:#fff;border-radius:10px;padding:10px 14px;box-shadow:0 6px 24px rgba(0,0,0,.25);width:100%;box-sizing:border-box}
#lpCap .lpStep{font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.7}#lpCap .lpTxt{font-size:16px;font-weight:600;margin:2px 0 4px;line-height:1.3}
#lpCap .lpRead{font:12px var(--mono, monospace);opacity:.85}#lpCap .lpBar{height:3px;background:rgba(255,255,255,.18);border-radius:2px;margin-top:8px;overflow:hidden}#lpCap .lpBar i{display:block;height:100%;background:#f0a04b}
body.lpOn #view3d{pointer-events:none}body.lpOn #hint{display:none}
body.lpOn #lpBox{left:0;right:0;top:0;bottom:0;max-width:none;align-items:stretch;justify-content:space-between;gap:0;padding:10px 12px 0}
body.lpOn #lpCtl{align-self:flex-end}
body.lpOn #lpCap{border-radius:0;margin:0 -12px;width:auto;padding:7px 16px 9px;display:grid;grid-template-columns:auto 1fr;column-gap:14px;align-items:baseline;position:relative;box-shadow:0 -2px 12px rgba(0,0,0,.18)}
body.lpOn #lpCap .lpStep{grid-row:1/3;white-space:nowrap;align-self:center}body.lpOn #lpCap .lpTxt{font-size:14px;margin:0}body.lpOn #lpCap .lpRead{font-size:11.5px}
body.lpOn #lpCap .lpBar{position:absolute;left:0;right:0;top:0;margin:0;height:3px;border-radius:0}`;
  document.head.append(css);
  const sec = $("view3d")?.parentElement; if (sec && getComputedStyle(sec).position === "static") sec.style.position = "relative";
  { const _r3 = render3D; render3D = function (...a) { if (LP.on) return; const r = _r3.apply(this, a); try { lpUi(); } catch (e) { } return r; }; }
  { const _ra = renderAll; renderAll = function (...a) { if (LP.on) return; const r = _ra.apply(this, a); try { lpUi(); } catch (e) { } return r; }; }
  // the 3D view being shown or hidden (any way it happens) shows / hides the play buttons
  const v = $("view3d"); if (v && window.MutationObserver) new MutationObserver(() => { try { lpUi(); } catch (e) { } }).observe(v, { attributes: true, attributeFilter: ["hidden", "style", "class"] });
  // and a Play button in the toolbar next to Present – it opens the 3D view and plays
  const pres = $("pnP");
  if (pres && !$("lpTool")) {
    const b = document.createElement("button"); b.id = "lpTool"; b.textContent = "▶ Play lift"; b.title = "Play the lift in 3D – for briefing the crew";
    pres.after(b);
    b.onclick = () => { if (LP.on) return; const go = () => lpStart(false);
      if (V3.mode !== "3d") { $("vw3d")?.click(); setTimeout(go, 600); } else go(); };
  }
})();
