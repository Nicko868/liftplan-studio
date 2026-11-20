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
function lsUpend(ld) { return lsBuild2(ld) && (ld.upend != null ? !!ld.upend : ld.rig.preset === "build_upend"); }
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
  const up = lsUpend(ld), to = Math.max(15, Math.min(90, +(ld.upend?.to ?? 90) || 90)), moved = Math.hypot(ld.set.x - ld.pick.x, ld.set.y - ld.pick.y) > 0.5 || Math.abs((+ld.set.rot || 0) - (+ld.pick.rot || 0)) > 1;
  if (up) { const tail = "B", S = [{ name: "Take the weight – both cranes", t: 0, h: "pick", tilt: 0 }, { name: "Lift clear, load level", t: 0, h: "lift", tilt: 0 }];
    for (let a = 15; a < to; a += 15) S.push({ name: `Upend to ${a}° – top crane hoists, tail crane lowers`, t: 0, h: "lift", tilt: a });
    S.push({ name: to >= 90 ? "Vertical – tail crane lowers off and is unhooked" : `At ${to}° – tail crane lowers off`, t: 0, h: "lift", tilt: to, release: tail });
    if (moved) S.push({ name: "Top crane takes it to the set position", t: 1, h: "carry", tilt: to, release: tail }, { name: "Set down", t: 1, h: "set", tilt: to, release: tail });
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
  const key = `${ld.id}|${plan.updated}|${plan.al}|${JSON.stringify(ld.steps || "")}|${ld.upend ?? ""}|${JSON.stringify(cranes.map(c => [c.x, c.y, c.L, c.chartId, c.heading, c.hookBlock, c.attach?.point]))}|${JSON.stringify([ld.pick, ld.set, ld.rig?.tilt])}`;
  if (LS_CACHE.has(key)) return LS_CACHE.get(key); if (LS_CACHE.size > 60) LS_CACHE.clear();
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
  const r = { ld, cranes, steps, carry, up, auto: !(Array.isArray(ld.steps) && ld.steps.length), lim };
  LS_CACHE.set(key, r); return r;
}
// every step that fails goes into the crane's checks
{ const _cs = craneSummary; craneSummary = function (cr, ...a) { const S = _cs.call(this, cr, ...a);
    try { const ld = plan.loads.find(l => l.id === cr.attach?.load); if (!S || !ld || lsCranes(ld).length < 2) return S; const L = liftSteps(ld); if (!L) return S;
      const name = cr.label || REG.cranes[cr.model]?.short || "Crane";
      let worst = null; for (const s of L.steps) { const q = s.per.find(p => p.c.id === cr.id); if (!q || q.rel) continue; if (q.util != null && (!worst || q.util > worst.q.util)) worst = { s, q };
        if (q.cap == null) S.warn.push(`${name}: lift step ${s.no} (${s.name}) – no chart capacity at R ${fx(q.R, 1)} m${q.why ? " – " + q.why : ""}`);
        else if (q.util > L.lim) S.warn.push(`${name}: lift step ${s.no} (${s.name}) – ${fx(q.hookLoad, 1)} t at R ${fx(q.R, 1)} m on ${fx(q.cap, 1)} t = ${fx(q.util, 0)}%, over the ${L.lim}% limit${q.design > q.geom + 0.01 ? ` (checked as the ${q.dWhy} for ${q.dWhy === "top crane" ? (rule("tt.top") ?? 100) : (rule("tt.tail") ?? 75)}% of the load)` : ""}`);
        if (q.tooHigh) S.warn.push(`${name}: lift step ${s.no} (${s.name}) – the hook would need to be ${fx(q.z, 1)} m up; this boom gives ${fx(q.hMax, 1)} m at R ${fx(q.R, 1)} m`);
        if (!q.ba.ok) S.warn.push(`${name}: lift step ${s.no} (${s.name}) – ${q.ba.why}`); }
      if (worst) S.steps = { worst, L };
      if (cr === L.cranes[0]) for (const s of L.steps) if (s.clear != null && s.clear < TRAVEL_CLEAR - 0.01 && ((s.t > 0.001 && s.t < 0.999) || (s.h > (+ld.pick.h || 0) + 0.05 && s.h > (+ld.set.h || 0) + 0.05)))
        S.warn.push(s.clear < 0 ? `${ld.name}: lift step ${s.no} (${s.name}) – the load at ${fx(s.h, 1)} m runs into ${s.under.name} (${fx(s.under.top, 1)} m high) – raise it to ${fx(s.under.top + TRAVEL_CLEAR, 1)} m` : `${ld.name}: lift step ${s.no} (${s.name}) – only ${fx(s.clear, 2)} m over ${s.under.name}; keep ${fx(TRAVEL_CLEAR, 1)} m`);
    } catch (e) { console.warn(e); }
    return S; }; }

// ---------------- the steps on the checks panel ----------------
function lsTableHTML(L, opt = {}) {
  const lim = L.lim, cls = u => u == null ? "" : u > 100 ? "bad" : u > lim ? "bad" : u > lim * 0.9 ? "amber" : "ok";
  return `<table class="lst"><tr><th>Step</th>${L.cranes.map(c => `<th class="n" colspan="2">${escH(c.label || REG.cranes[c.model]?.short || "Crane")}</th>`).join("")}</tr>
    ${L.steps.map(s => `<tr class="${s.ok ? "" : "lsbad"}"><td>${s.no}. ${escH(s.name)}${s.tilt ? ` <span class="small">· ${fx(s.tilt, 0)}°</span>` : ""}${opt.full ? `<div class="small">load ${fx(s.h, 1)} m up${s.under ? ` · ${s.clear >= 0 ? fx(s.clear, 2) + " m over" : "runs into"} ${escH(s.under.name)}` : ""}</div>` : ""}</td>
      ${s.per.map(q => q.rel ? `<td class="n small" colspan="2">off the hook</td>` : `<td class="n small">R ${fx(q.R, 1)} m<br>${fx(q.used, 1)} t${q.design > q.geom + 0.01 ? "*" : ""}</td><td class="n"><span class="pill ${cls(q.util)}">${q.util != null ? fx(q.util, 0) + "%" : "–"}</span></td>`).join("")}</tr>`).join("")}</table>
    ${L.up ? `<p class="small" style="margin:2px 0 0">* checked for the design share: top crane ${rule("tt.top") ?? 100}%, tail crane ${rule("tt.tail") ?? 75}% of the load while both are on (Rules & limits).</p>` : ""}`;
}
{ const st = document.createElement("style"); st.textContent = `table.lst{width:100%;font-size:11.5px;border-collapse:collapse}table.lst td,table.lst th{padding:2px 4px;border-bottom:1px solid var(--line)}table.lst th{text-align:left;font-weight:600}table.lst .n{text-align:right}table.lst tr.lsbad td:first-child{color:var(--bad)}`; document.head.append(st); }
{ const _rc = renderChecks; renderChecks = function (...a) { const r = _rc.apply(this, a);
    try { const box = $("checks"); if (!box || allMode) return r;
      for (const ld of plan.loads) { if (lsCranes(ld).length < 2 && !(Array.isArray(ld.steps) && ld.steps.length)) continue; const L = liftSteps(ld); if (!L) continue; const bad = L.steps.filter(s => !s.ok).length;
        box.insertAdjacentHTML("beforeend", `<div class="card" style="margin-bottom:10px${bad ? ";border-color:var(--bad)" : ""}"><div class="ch"><b>Lift steps · ${escH(ld.name)}</b><button data-lsedit="${ld.id}">Steps…</button></div>
          <p class="small" style="padding:4px 10px 0;margin:0">${L.up ? "Top and tail upend" : L.cranes.length > 1 ? "Tandem lift" : "Lift"} in ${L.steps.length} steps${L.auto ? " (worked out by the app – change them under Steps…)" : ""}${bad ? ` · <b style="color:var(--bad)">${bad} step${bad > 1 ? "s" : ""} not OK</b>` : " · every step OK"}</p>
          <div style="padding:4px 10px 8px">${lsTableHTML(L)}</div></div>`); } } catch (e) { console.warn(e); }
    return r; }; }
document.addEventListener("click", e => { const b = e.target.closest("[data-lsedit]"); if (!b) return; e.preventDefault(); openLiftSteps(plan.loads.find(l => l.id === b.dataset.lsedit)); });

// ---------------- the steps window: change them, see each one ----------------
const LSV = { ld: null, sel: 0 };
(() => {
  if ($("dLs")) return; const d = document.createElement("dialog"); d.id = "dLs"; d.style.cssText = "width:min(1250px,97vw)";
  d.innerHTML = `<div class="dh"><b>Lift steps</b><span class="small" id="lsSub" style="margin-left:8px"></span><span style="flex:1"></span><label class="small" style="display:flex;align-items:center;gap:6px;margin-right:8px">Stage drawings<select id="lsStyle" style="width:auto"><option value="cad">CAD front elevation</option><option value="real">Realistic 3D</option></select></label><button id="lsAuto">Back to the app's steps</button><button data-close>Close</button></div><div class="db" id="lsBody"></div>`;
  document.body.append(d); d.querySelector("[data-close]").onclick = () => { d.close(); renderAll(); };
  $("lsAuto").onclick = () => { if (!LSV.ld) return; delete LSV.ld.steps; markDirty(); renderLs(); };
})();
function openLiftSteps(ld) { if (!ld) return; LSV.ld = ld; LSV.sel = 0; $("lsStyle").value = plan.meta.seqStyle || "cad"; $("lsStyle").onchange = () => { plan.meta.seqStyle = $("lsStyle").value; markDirty(); }; $("lsSub").textContent = ld.name || ""; renderLs(); $("dLs").showModal(); }
function renderLs() {
  const ld = LSV.ld, L = liftSteps(ld); if (!L) { $("lsBody").innerHTML = `<p class="small">Hook a crane on to this load first.</p>`; return; }
  const S = lsSteps(ld), s = L.steps[Math.min(LSV.sel, L.steps.length - 1)], two = L.cranes.length > 1;
  const hOpt = v => [["pick", "at the pick height"], ["lift", "1 m up"], ["carry", `carry height (${fx(L.carry.H, 1)} m)`], ["set", "at the set height"]].map(([k, n]) => `<option value="${k}" ${v === k ? "selected" : ""}>${n}</option>`).join("") + `<option value="num" ${typeof v === "number" ? "selected" : ""}>height…</option>`;
  const rows = S.map((x, i) => `<tr data-lsi="${i}" class="${i === LSV.sel ? "lssel" : ""}"><td>${i + 1}</td><td style="white-space:normal;min-width:140px"><input type="text" data-lsf="name" value="${escH(x.name || "")}"></td>
      <td><input type="number" data-lsf="t" min="0" max="100" step="5" value="${Math.round((+x.t || 0) * 100)}" style="width:62px"> %</td>
      <td><select data-lsf="h">${hOpt(x.h)}</select>${typeof x.h === "number" ? `<input type="number" data-lsf="hn" step="0.1" value="${x.h}" style="width:62px"> m` : ""}</td>
      <td><input type="number" data-lsf="tilt" step="5" value="${+x.tilt || 0}" style="width:58px">°</td>
      ${two ? `<td><select data-lsf="release"><option value="">both on</option>${L.cranes.map(c => `<option value="${c.attach?.point || "C"}" ${x.release === (c.attach?.point || "C") ? "selected" : ""}>${escH(c.label || "crane")} off</option>`).join("")}</select></td>` : ""}
      <td style="white-space:nowrap"><button class="rmv" data-lsup ${i ? "" : "disabled"}>▲</button><button class="rmv" data-lsdel>×</button></td></tr>`).join("");
  $("lsBody").innerHTML = `<div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:12px">
    <div><p class="small" style="margin:0 0 6px">Each step: where along the way from pick to set (0 % = at the pick, 100 % = over the set position), how high the load is, how far it is turned up (upending) and which crane is off the hook. ${L.auto ? "These are the app's steps for this lift – change any and they become yours." : "Your steps – “Back to the app's steps” starts again."}</p>
      <table class="lse"><tr><th>#</th><th>Step</th><th>Along</th><th>Height</th><th>Turned up</th>${two ? "<th>Cranes</th>" : ""}<th></th></tr>${rows}</table>
      <div class="btnrow" style="margin-top:6px"><button id="lsAdd">+ Add a step after the one picked</button>${two && lsBuild2(ld) ? `<label class="chk" style="display:flex;flex-direction:row;gap:6px;align-items:center;margin-left:8px"><input type="checkbox" id="lsUp" ${L.up ? "checked" : ""} style="width:auto;margin:0"> top and tail upend</label>` : ""}</div>
      <div style="margin-top:10px">${lsTableHTML(L, { full: true })}</div></div>
    <div><div class="small" style="margin-bottom:4px"><b>Step ${s.no} – ${escH(s.name)}</b></div><div id="lsDraw" style="min-height:330px;border:1px solid var(--line);border-radius:6px;background:#fff"><p class="small" style="padding:10px">Drawing step…</p></div>
      <table class="lst" style="margin-top:6px"><tr><th></th>${s.per.map(q => `<th class="n">${escH(q.c.label || "Crane")}</th>`).join("")}</tr>
        ${[["Radius", q => fx(q.R, 2) + " m"], ["Slew (bearing)", q => fx(q.brg, 0) + "°"], ["Boom angle", q => q.ba.ok ? fx(q.ba.theta, 1) + "°" : "–"], ["Hook height / most", q => `${fx(q.z, 1)} / ${q.hMax != null ? fx(q.hMax, 1) : "–"} m`],
           ["Share from the rigging", q => q.rel ? "off" : fx(q.geom, 2) + " t"], ["Design share", q => q.design ? `${fx(q.design, 2)} t (${q.dWhy})` : "–"], ["Hook load (+ block)", q => q.rel ? "–" : fx(q.hookLoad, 2) + " t"],
           ["Chart capacity", q => q.cap != null ? fx(q.cap, 1) + " t" + (q.rUsed ? ` (row ${fx(q.rUsed, 1)} m)` : "") : "–"], ["From the last step", q => escH((lsMoves(L.steps[s.no - 2], s).find(m => m.q === q) || {}).txt || "")], ["Use", q => q.rel ? "–" : q.util != null ? `<b style="color:${q.util > L.lim ? "var(--bad)" : "inherit"}">${fx(q.util, 0)}%</b>` : "–"]].map(([n, f]) => `<tr><td>${n}</td>${s.per.map(q => `<td class="n">${f(q)}</td>`).join("")}</tr>`).join("")}</table>
      <p class="small">${s.under ? (s.clear >= 0 ? `The load is ${fx(s.clear, 2)} m over ${escH(s.under.name)} (${fx(s.under.top, 1)} m high).` : `<b style="color:var(--bad)">The load runs into ${escH(s.under.name)} (${fx(s.under.top, 1)} m high).</b>`) : "Nothing under the load at this step."}</p></div></div>`;
  const st = document.getElementById("lsCss") || Object.assign(document.createElement("style"), { id: "lsCss" }); st.textContent = `table.lse{width:100%;font-size:12px;border-collapse:collapse}table.lse td,table.lse th{white-space:nowrap;padding:2px 3px;border-bottom:1px solid var(--line);text-align:left}table.lse input[type=text]{width:100%}table.lse select{width:auto;max-width:128px}table.lse input[type=number]{padding:4px}table.lse tr.lssel{background:rgba(217,102,31,.08)}table.lse tr{cursor:pointer}`; document.head.append(st);
  { const tok = LSV.tok = (LSV.tok || 0) + 1; setTimeout(async () => { try { if (tok !== LSV.tok) return; const pl = await lsPlanSVG(L, s, 14); if (tok !== LSV.tok) return; const el = await lsElevSVGs(L, s, 14); if (tok !== LSV.tok || !$("lsDraw")) return;
      const fit = v => v.replace(/^<svg /, '<svg style="width:100%;height:auto;display:block" ');
      $("lsDraw").innerHTML = `<div style="border-bottom:1px solid var(--line)">${fit(pl)}</div><div style="display:grid;grid-template-columns:repeat(${el.length},minmax(0,1fr))">${el.map(E => E ? `<div style="border-left:1px solid var(--line)">${fit(E.svg)}</div>` : "<div></div>").join("")}</div>`;
      } catch (e) { console.warn(e); } }, 0); }
  const own = () => { if (!(Array.isArray(ld.steps) && ld.steps.length)) ld.steps = clone(lsAutoSteps(ld)); return ld.steps; };
  $("lsBody").querySelectorAll("tr[data-lsi]").forEach(tr => { const i = +tr.dataset.lsi;
    tr.addEventListener("click", e => { if (e.target.closest("input,select,button")) return; LSV.sel = i; renderLs(); });
    tr.querySelectorAll("[data-lsf]").forEach(el => el.onchange = () => { const st = own(), x = st[i], f = el.dataset.lsf;
      if (f === "name") x.name = el.value; else if (f === "t") x.t = Math.max(0, Math.min(100, +el.value || 0)) / 100; else if (f === "tilt") x.tilt = +el.value || 0;
      else if (f === "h") x.h = el.value === "num" ? (+liftSteps(ld)?.steps[i]?.h || 1) : el.value; else if (f === "hn") x.h = +el.value || 0; else if (f === "release") { if (el.value) x.release = el.value; else delete x.release; }
      LSV.sel = i; markDirty(); renderLs(); });
    const up = tr.querySelector("[data-lsup]"); if (up) up.onclick = () => { const st = own(); if (!i) return; [st[i - 1], st[i]] = [st[i], st[i - 1]]; LSV.sel = i - 1; markDirty(); renderLs(); };
    tr.querySelector("[data-lsdel]").onclick = () => { const st = own(); st.splice(i, 1); LSV.sel = Math.max(0, i - 1); markDirty(); renderLs(); }; });
  $("lsAdd").onclick = () => { const st = own(), cur = st[LSV.sel] || st[st.length - 1]; st.splice(LSV.sel + 1, 0, { ...clone(cur), name: "New step" }); LSV.sel++; markDirty(); renderLs(); };
  const u = $("lsUp"); if (u) u.onchange = () => { ld.upend = u.checked ? { to: 90 } : false; delete ld.steps; markDirty(); renderLs(); };
}
// ================= each step drawn with the app's own engineering drawings =================
// The plan and the elevations of a step are the same drawings as the plan sheet (cranes with their outriggers / tracks,
// counterweight, boom slewed and luffed to the hook, rigging, the load and the site), with the lift put in that step's
// position for the moment it is drawn: the load where the step has it, turned up as far as the step says, the cranes
// on it as they are at that step, and a crane that is off the hook shown with its hook clear of the load.
let LS_DRAW = null;   // { ld, tilt } while a step is being drawn
{ const _lp = loadPlan; loadPlan = function (ld, ...a) { const s = _lp.call(this, ld, ...a);
    try { if (!LS_DRAW || LS_DRAW.ld !== ld || !LS_DRAW.tilt) return s; const k = Math.cos(LS_DRAW.tilt * D2R), xc = LS_DRAW.xc || 0, f = p => [xc + (p[0] - xc) * k, p[1]];
      const o = new Scene(); for (const it of s.items) { if (it.t === "poly") o.items.push({ ...it, pts: it.pts.map(f) }); else if (it.t === "circle") o.items.push({ ...it, c: f(it.c) }); else o.items.push({ ...it, p: f(it.p) }); } return o; } catch (e) { return s; } }; }
async function lsWith(L, s, fn) {
  const ld = L.ld, R = ld.rig, keep = { pick: ld.pick, tilt: R ? R.tilt : undefined, cr: L.cranes.map(c => ({ c, tip: c.tip, L: c.L, cfg: c.boomCfg, ak: c._autoKey, ab: c.autoBoom })), phase: plan.phase };
  try {
    ld.pick = { x: s.pose.x, y: s.pose.y, rot: s.pose.rot, h: s.h };
    if (R && lsBuild2(ld)) R.tilt = s.tilt || 0;
    for (const q of s.per) { q.c.autoBoom = false; if (q.rel) q.c.tip = { ...(q.c.tip || {}), pick: { free: true, R: q.R, brg: q.brg } }; else if (q.c.tip) q.c.tip = { ...q.c.tip, pick: null }; }
    LS_DRAW = { ld, tilt: s.tilt || 0, xc: (R && lsBuild2(ld) && typeof tiltFn === "function") ? (tiltFn(ld, { tilt: 1 }).xc || 0) : 0 };
    return await fn();
  } finally {
    LS_DRAW = null; ld.pick = keep.pick; if (R) { if (keep.tilt === undefined) delete R.tilt; else R.tilt = keep.tilt; }
    for (const k of keep.cr) { k.c.tip = k.tip; k.c.L = k.L; k.c.boomCfg = k.cfg; k.c._autoKey = k.ak; k.c.autoBoom = k.ab; }
    plan.phase = keep.phase;
  }
}
// the plan of one step, framed on the lift
async function lsPlanSVG(L, s, pxPerM = 20) {
  return lsWith(L, s, async () => {
    // framed tight on this lift: the cranes (outriggers / tracks and tail swing), the load where it is and where it goes, the hooks
    const P = [];
    for (const c of L.cranes) { const C = REG.cranes[c.model], t = Math.max(C?.up?.tail || 0, (C?.car?.len || 12) * 0.62, 6) + 1; P.push([c.x - t, c.y - t], [c.x + t, c.y + t]); try { for (const pd of cranePads(c, C)) P.push(pd.w); } catch (e) { } }
    for (const q of [s.pose, L.ld.set]) for (const o of loadOutline(L.ld)) { const r = rot2(o, -(q.rot || 0)); P.push([q.x + r[0], q.y + r[1]]); }
    for (const q of s.per) P.push(q.hook);
    let b = [Math.min(...P.map(p => p[0])), Math.min(...P.map(p => p[1])), Math.max(...P.map(p => p[0])), Math.max(...P.map(p => p[1]))]; const m = 1.5; b = [b[0] - m, b[1] - m - 2, b[2] + m, b[3] + m];
    let svg = await siteSVGStatic("pick", { pxPerM, bounds: b });
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
  const prof = loadProfile(ld, view).s, o = new Scene(), T = ([x, z]) => [uc + x * k, h0 + z];
  for (const it of prof.items) { if (it.t === "poly") o.items.push({ ...it, pts: it.pts.map(T) }); else if (it.t === "circle") o.items.push({ ...it, c: T(it.c) }); else o.items.push({ ...it, p: T(it.p) }); }
  // lifting points where they are at this step
  const R = ld.rig, TT = R && lsBuild2(ld) && typeof tiltFn === "function" ? tiltFn(ld, R) : (p => p), d = loadDims(ld);
  let lugs; if (R && lsBuild2(ld) && (ld.pts || []).length >= 2) { const byK = k2 => (ld.pts.find(p => p.k === k2) || {}); const pa = R.legPts?.[0] ? byK(R.legPts[0]) : ld.pts[0], pb = R.legPtsB?.[0] ? byK(R.legPtsB[0]) : ld.pts[1]; lugs = [pa, pb].map(p => TT([+p.x || 0, +p.y || 0, +p.z || 0])); }
  else { const sp = tandemSpan(ld) || 0, zl = typeof liftPointZ === "function" ? liftPointZ(ld) : d.z; lugs = [[-sp / 2, 0, zl], [sp / 2, 0, zl]]; }
  const W = p => { const v = rot2([p[0], p[1]], -(P.rot || 0)); return [P.x + v[0], P.y + v[1], h0 + p[2]]; };
  L.cranes.forEach((c, i) => { const qq = s.per.find(x => x.c === c); if (!qq || qq.rel) return; const lug = W(lugs[c.attach?.point === "B" ? 1 : 0] || lugs[0]), u = proj(lug[0], lug[1]);
    if (c === cr) { o.poly("RIGGING", [[q.R, hookY], [u, lug[2]]], { w: 1.4 }); o.circle("RIGGING", [u, lug[2]], 0.2, { fill: true }); }
    else { const uh = proj(qq.hook[0], qq.hook[1]); o.poly("RIGGING", [[uh, qq.z], [u, lug[2]]], { w: 0.9, dash: [0.5, 0.3] }); o.circle("RIGGING", [u, lug[2]], 0.16, { fill: true });
 } });
  let bottom = Infinity; for (const it of o.items) { if (it.t === "poly") for (const p of it.pts) bottom = Math.min(bottom, p[1]); else if (it.t === "circle") bottom = Math.min(bottom, it.c[1] - it.r); }
  let mu = -Infinity; for (const it of o.items) { if (it.t === "poly") for (const p of it.pts) mu = Math.max(mu, p[0]); else if (it.t === "circle") mu = Math.max(mu, it.c[0] + it.r); } D.maxU = mu;
  return { s: o, bottom: Number.isFinite(bottom) ? bottom : h0 };
}
{ const _lsr = loadSideRig; loadSideRig = function (ld, hookY, ...a) { const D = LS_DRAW; if (D && D.ld === ld && D.cur && D.s) { try { return lsElevLoad(D, hookY); } catch (e) { console.warn(e); } } return _lsr.call(this, ld, hookY, ...a); }; }

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
  return s.per.map(q => { const p = prev && prev.per.find(x => x.c === q.c); if (q.rel && p && p.rel) return { q, txt: "off the hook" };
    if (q.rel) return { q, txt: "lower off, unhook, hook clear" }; if (!p) return { q, txt: "hook on, take the weight" };
    const m = [], dz = q.z - p.z, dR = q.R - p.R; let dB = q.brg - p.brg; dB = ((dB + 540) % 360) - 180;
    if (Math.abs(dz) >= 0.1) m.push(`${dz > 0 ? "hoist" : "lower"} ${fx(Math.abs(dz), 1)} m`);
    if (Math.abs(dR) >= 0.1) m.push(`${dR > 0 ? "luff out" : "luff in"} ${fx(Math.abs(dR), 1)} m (R ${fx(p.R, 1)} → ${fx(q.R, 1)})`);
    if (Math.abs(dB) >= 0.5) m.push(`slew ${fx(Math.abs(dB), 0)}° ${dB > 0 ? "clockwise" : "anticlockwise"}`);
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
    const top = F.M + 80, ch = L.cranes, colsW = [0.25, 0.09, ...ch.flatMap(() => [0.06, 0.07, 0.07, 0.065, 0.05])], sw = colsW.reduce((a, b) => a + b, 0), wd = colsW.map(v => v * tw / sw);
    const tabH = (L.steps.length + 2) * 38 + 20, planH = F.bandY - top - tabH - 90;
    const pl = await siteSVGStatic("both", { pxPerM: 20, focus: true });
    F.add(nestSVG(pl, x0, top, tw, planH));
    F.add(`<text x="${x0}" y="${top + 26}" font-size="24" font-weight="700" fill="#16202a">PICK (solid) / SET (dashed) – the steps between are drawn on the sheets that follow</text>`);
    let y = top + planH + 20; const row = (v, o = {}) => { let x = x0; if (o.fill) F.add(`<rect x="${x0}" y="${y}" width="${tw}" height="38" fill="${o.fill}"/>`);
      v.forEach((t, i) => { F.add(`<text x="${i ? x + wd[i] - 10 : x + 10}" y="${y + 26}" font-size="20" ${o.bold ? 'font-weight="700"' : ""} text-anchor="${i ? "end" : "start"}" fill="${o.col?.[i] || "#16202a"}">${e(t)}</text>`); x += wd[i]; }); y += 38; };
    const y0 = y; let xh = x0 + wd[0] + wd[1];
    ch.forEach((c, k) => { const w5 = wd.slice(2 + k * 5, 7 + k * 5).reduce((a, b) => a + b, 0); F.add(`<rect x="${xh}" y="${y}" width="${w5}" height="38" fill="${k % 2 ? "#e2e8ee" : "#d5dde5"}"/><text x="${xh + w5 / 2}" y="${y + 26}" font-size="21" font-weight="700" text-anchor="middle" fill="#16202a">${e((c.label || "Crane") + " · " + (REG.cranes[c.model]?.name || c.model))}</text>`); xh += w5; }); y += 38;
    row(["Step", "Load", ...ch.flatMap(() => ["R (m)", "Share (t)", "Cap. (t)", "Hook (m)", "Use"])], { bold: true, fill: "#eef1f4" });
    L.steps.forEach((s, k) => row([`${s.no}. ${s.name}`, `${fx(s.h, 1)} m${s.tilt ? " · " + fx(s.tilt, 0) + "°" : ""}`, ...s.per.flatMap(q => q.rel ? ["–", "off", "–", "–", "–"] : [fx(q.R, 1), fx(q.used, 1) + (q.design > q.geom + 0.01 ? "*" : ""), q.cap != null ? fx(q.cap, 1) : "–", fx(q.z, 1), q.util != null ? fx(q.util, 0) + "%" : "–"])],
      { fill: k % 2 ? "#f7f9fa" : null, col: ["", "", ...s.per.flatMap(q => ["", "", "", q.tooHigh ? "#b42318" : "", ucol(q.util)])] }));
    F.add(`<rect x="${x0}" y="${y0}" width="${tw}" height="${y - y0}" fill="none" stroke="#16202a" stroke-width="2"/>`);
    const notes = [`Share = the crane's part of the load + rigging at that step (from the rigging geometry)${up ? `; * checked for the design share – top crane ${rule("tt.top") ?? 100}%, tail crane ${rule("tt.tail") ?? 75}% of the load + rigging while both cranes are on` : ""}.`,
      `Capacity from each crane's load chart at the step's radius (next row up). Use = (share + hook block + extras) ÷ capacity, limit ${lim}%. Hook = height of the hook at that step.`];
    notes.forEach((t, i) => F.add(`<text x="${x0}" y="${y + 32 + i * 28}" font-size="19" fill="#3d4a57">${e(t)}</text>`));
    out.push({ name: `lift_sequence_${nm.replace(/[^\w\-]+/g, "_")}`, svg: F.close() }); }
  // ---- the steps, three to a sheet
  if (L.cranes.length > 1 && ((plan.meta.seqStyle || "cad") === "cad" || (typeof glAvailable === "function" && glAvailable()))) { for (const s of L.steps) out.push(await lsStageSheet(L, s, liftLabel)); return out; }
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
    try { for (let i = 0; i < plan.lifts.length; i++) await withLiftA(i, async Lf => { for (const ld of Lf.loads) { if (lsCranes(ld).length < 2 && !(Array.isArray(ld.steps) && ld.steps.length)) continue;
          for (const sh of await liftSeqSheets(ld, Lf.name)) out.push({ ...sh, name: `${sh.name}_${i + 1}`, regen: () => sh.svg }); } }); } catch (e) { console.warn("lift sequence sheets", e); }
    return out; }; }

// ================= top and tail: each stage as one large front view of both cranes and the load =================
// The realistic 3D renderer (the same cranes as the 3D view) draws both cranes side by side, booms at the stage's angle,
// hooks at the stage's height, the load turned up as far as the stage says, and the rigging from each hook to its lug.
// The camera looks across the load at the cranes, level, so the picture reads like the stage drawings of a top-and-tail plan.
function lsLugsWorld(L, s) {
  const ld = L.ld, R = ld.rig, P = s.pose, h0 = s.h, d = loadDims(ld), build = R && lsBuild2(ld), TT = build && typeof tiltFn === "function" ? tiltFn(ld, { ...R, tilt: s.tilt || 0 }) : (p => p);
  let lugs; if (build && (ld.pts || []).length >= 2) { const byK = k => ld.pts.find(p => p.k === k) || {}; const pa = R.legPts?.[0] ? byK(R.legPts[0]) : ld.pts[0], pb = R.legPtsB?.[0] ? byK(R.legPtsB[0]) : ld.pts[1]; lugs = [pa, pb].map(p => TT([+p.x || 0, +p.y || 0, +p.z || 0])); }
  else { const sp = tandemSpan(ld) || 0, zl = typeof liftPointZ === "function" ? liftPointZ(ld) : d.z; lugs = [[-sp / 2, 0, zl], [sp / 2, 0, zl]]; }
  return lugs.map(p => { const v = rot2([p[0], p[1]], -(P.rot || 0)); return [P.x + v[0], P.y + v[1], h0 + p[2]]; });
}
// the load turned up in 3D (about its CoG, lowest point on the load's bottom height – as the rigging works it out)
{ const _l3 = load3D; load3D = function (M, ld, pos, ghost) {
    const D = LS_DRAW; if (!D || !D.d3 || D.ld !== ld || ghost || !D.s || !D.s.tilt || !lsBuild2(ld)) return _l3.call(this, M, ld, pos, ghost);
    const T = new Mesh(); _l3.call(this, T, ld, pos, ghost); const TT = tiltFn(ld, ld.rig), P = D.s.pose, h0 = +pos.h || 0;
    const f = w => { const v = rot2([w[0] - P.x, w[1] - P.y], P.rot || 0), q = TT([v[0], v[1], w[2] - h0]), r = rot2([q[0], q[1]], -(P.rot || 0)); return [P.x + r[0], P.y + r[1], h0 + q[2]]; };
    for (const fc of T.faces) M.faces.push({ ...fc, pts: fc.pts.map(f) }); for (const l of T.lines) M.lines.push({ ...l, a: f(l.a), b: f(l.b) }); for (const l of T.labels) M.labels.push({ ...l, p: l.p ? f(l.p) : l.p });
  }; }
// the rigging at the stage: each crane's hook straight to its lug (shackle at the padeye / choke round the leg)
{ const _r3 = rig3D; rig3D = function (M, ld, pos, res, hooks) {
    const D = LS_DRAW; if (!D || !D.d3 || D.ld !== ld) return _r3.call(this, M, ld, pos, res, hooks);
    const L = D.L, s = D.s, lugs = lsLugsWorld(L, s), d = loadDims(ld);
    L.cranes.forEach(c => { const q = s.per.find(x => x.c === c); if (!q || q.rel) return; const i = c.attach?.point === "B" ? 1 : 0, lug = lugs[i], hk = [q.hook[0], q.hook[1], Math.min(q.z, q.hMax ?? q.z)];
      M.line(hk, lug, "#0b7a66", 2.2); M.cyl(vadd(lug, [0, 0, -0.12]), vadd(lug, [0, 0, 0.32]), Math.max(0.12, d.y * 0.12), "#d9661f"); });
  }; }
// each crane's hook block at the stage's height
{ const _ev = evalCrane; evalCrane = function (cr, ...a) { const r = _ev.call(this, cr, ...a); if (LS_DRAW && LS_DRAW.d3) LS_DRAW.evCr = cr; return r; }; }
{ const _rh = loadRigHeight; loadRigHeight = function (ld, ...a) { const D = LS_DRAW;
    if (D && D.d3 && D.ld === ld && D.evCr && D.s) { const q = D.s.per.find(x => x.c === D.evCr); if (q) return (q.rel ? D.s.h + 4 : q.z) - (+ld.pick.h || 0); }
    return _rh.call(this, ld, ...a); }; }
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
  const cad = (plan.meta.seqStyle || "cad") === "cad", pic = cad ? await lsCadFront(L, s, Math.round(pw), Math.round(ph)) : await lsFrontPic(L, s, Math.round(pw), Math.round(ph));
  if (pic) {
    F.add(pic.url ? `<image href="${pic.url}" x="${x0}" y="${top}" width="${pw}" height="${ph}"/>` : `<g transform="translate(${x0} ${top})">${pic.svg}</g>`);
    F.add(lsCallouts([...lsStageLabels(L, s, pic.proj), ...(pic.extra || [])], pic.occ, x0, top, pw, ph, e));
    F.add(`<rect x="${x0}" y="${top}" width="${pw}" height="${ph}" fill="none" stroke="#16202a" stroke-width="2"/>`);
    F.add(`<text x="${x0 + 24}" y="${top + 44}" font-size="30" font-weight="700" fill="#16202a" paint-order="stroke" stroke="#fff" stroke-width="6" text-decoration="underline">${e(`FRONT VIEW – load ${fx(s.h, 1)} m up${s.tilt ? ` · turned up ${fx(s.tilt, 0)}°` : " · level"}`)}</text>`);
  } else F.add(`<text x="${x0 + 40}" y="${top + 80}" font-size="30" fill="#b42318">The front view needs WebGL – open the sheets in a browser with it on.</text>`);
  // the strip: key plan, then for each crane what it does from the last stage and its checks
  const sy = F.bandY - stripH + 10, sh = stripH - 20, kpW = 760; F.add(`<line x1="${F.M}" y1="${sy - 10}" x2="${F.W - F.M}" y2="${sy - 10}" stroke="#16202a" stroke-width="3"/>`);
  const kp = await lsPlanSVG(L, s, 14); F.add(nestSVG(kp, x0 + 6, sy + 30, kpW - 20, sh - 34)); F.add(`<text x="${x0 + 14}" y="${sy + 24}" font-size="23" font-weight="700" fill="#16202a">KEY PLAN</text><line x1="${x0 + kpW}" y1="${sy - 10}" x2="${x0 + kpW}" y2="${F.bandY}" stroke="#16202a" stroke-width="2"/>`);
  const mv = lsMoves(L.steps[s.no - 2], s), cw = (tw - kpW) / s.per.length;
  mv.forEach(({ q, txt }, k) => { const cx = x0 + kpW + k * cw + 24; let y = sy + 30; if (k) F.add(`<line x1="${cx - 24}" y1="${sy - 10}" x2="${cx - 24}" y2="${F.bandY}" stroke="#9aa5b1" stroke-width="1.5"/>`);
    F.add(`<text x="${cx}" y="${y}" font-size="30" font-weight="700" fill="${q.c.color || "#16202a"}">${e(`${q.c.label || "Crane"} · ${REG.cranes[q.c.model]?.name || q.c.model}`)}</text>`); y += 46;
    F.add(`<text x="${cx}" y="${y}" font-size="26" font-weight="700" fill="#16202a">${e(txt.charAt(0).toUpperCase() + txt.slice(1))}</text>`); y += 44;
    const rows = q.rel ? [] : [["Radius", `${fx(q.R, 1)} m`], ["Slew / boom angle", `${fx(q.brg, 0)}° / ${q.ba.ok ? fx(q.ba.theta, 1) + "°" : "–"}`], ["Hook height (most)", `${fx(q.z, 1)} m (${q.hMax != null ? fx(q.hMax, 1) : "–"} m)`],
      ["Share from the rigging", `${fx(q.geom, 2)} t`], ...(q.design > q.geom + 0.01 ? [[`Checked for (${q.dWhy})`, `${fx(q.design, 2)} t`]] : []), ["Hook load (+ block)", `${fx(q.hookLoad, 2)} t`], ["Chart capacity", q.cap != null ? `${fx(q.cap, 1)} t${q.rUsed ? ` (${fx(q.rUsed, 1)} m row)` : ""}` : "–"]];
    for (const [a, b] of rows) { F.add(`<text x="${cx}" y="${y}" font-size="23" fill="#3d4a57">${e(a)}</text><text x="${cx + cw - 60}" y="${y}" font-size="23" font-weight="700" text-anchor="end" fill="#16202a">${e(b)}</text>`); y += 33; }
    if (!q.rel) F.add(`<text x="${cx}" y="${y + 8}" font-size="25" fill="#3d4a57">Use</text><text x="${cx + cw - 60}" y="${y + 8}" font-size="34" font-weight="700" text-anchor="end" fill="${ucol(q.util)}">${q.util != null ? fx(q.util, 0) + "%" : "–"}</text>`); });
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
  s.per.forEach(q => { const C = REG.cranes[q.c.model], i = q.c.attach?.point === "B" ? 1 : 0, tip = q.ba.ok ? [q.c.x + (q.hook[0] - q.c.x) * 1, q.c.y + (q.hook[1] - q.c.y) * 1, q.hMax != null ? q.hMax + 2 : q.z + 6] : [q.hook[0], q.hook[1], q.z];
    const a = proj(tip); if (a) out.push({ a, col: q.c.color || "#16202a", lines: [`${q.c.label || "Crane"} · ${C?.name || q.c.model}`, q.ba.ok ? `Boom ${fx(q.c.L, 1)} m @ ${fx(q.ba.theta, 1)}° · R ${fx(q.R, 1)} m` : `R ${fx(q.R, 1)} m`, q.rel ? "Off the hook" : `Hook ${fx(q.z, 1)} m · ${fx(q.hookLoad, 1)} t on ${q.cap != null ? fx(q.cap, 1) : "–"} t = ${q.util != null ? fx(q.util, 0) + "%" : "–"}`], pref: -90 });
    if (!q.rel) { const b = proj(lugs[i]), rt = lsRigText(ld, i); if (b) out.push({ a: b, col: "#0b5e4f", lines: [`${L.up ? (i ? "Tail end rigging" : "Top end rigging") : "Lifting point " + (i ? "B" : "A")} · ${q.c.label || "crane"}`, ...(rt ? wrapLines(rt, 44).slice(0, 3) : [])], pref: 90, small: true }); } });
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
      let n = rot2([0, 1], -(P0.rot || 0)); if ((cx - mx) * n[0] + (cy - my) * n[1] < 0) n = [-n[0], -n[1]];
      // a load carried somewhere is seen side-on to its way, pick on the left and set on the right
      // a load carried somewhere: look square to the line between the two cranes (both seen side by side), from behind the pick towards the set
      { const tx = P9.x - P0.x, ty = P9.y - P0.y, tl = Math.hypot(tx, ty); if (tl > 1 && !L.up && L.cranes.length > 1) { const a = L.cranes[0], b = L.cranes[1], ux = b.x - a.x, uy = b.y - a.y, ul = Math.hypot(ux, uy) || 1; n = [-uy / ul, ux / ul]; if (n[0] * tx + n[1] * ty < 0) n = [-n[0], -n[1]]; } }
      const d = [n[0], n[1], 0], r = [n[1], -n[0], 0], M = buildMesh("pick");
      // framed on the cranes, booms and the load, room left round it for the callouts
      const pts = []; for (const st of L.steps) { for (const q of st.per) { const C = REG.cranes[q.c.model], t = (C?.car?.len || 12) * 0.5; pts.push([q.c.x - t, q.c.y - t, 0], [q.c.x + t, q.c.y + t, 0], [q.hook[0], q.hook[1], (q.hMax || q.z) + 3]); }
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
        g += `<line x1="${hp[0]}" y1="${hp[1]}" x2="${dx + (left ? -16 : 16)}" y2="${hp[1]}" stroke="${col}" stroke-width="1" stroke-dasharray="6 5"/>` + dimV(dx, Math.min(q.z, q.hMax ?? q.z), `HOOK ${fx(q.z, 1)} m`, col); dims.push([dx, hp[1]]); });
      // what the load passes over: the gap between its bottom and the top of the item, dimensioned
      if (s.under && s.clear != null) { const P = s.pose, xm = proj([P.x, P.y, 0])[0] + (loadDims(L.ld).x / 2) * k * 0.0, ya = Y(s.under.top), yb = Y(s.h), col = s.clear < TRAVEL_CLEAR - 0.01 ? "#b42318" : "#16202a", xx = xm;
        g += `<line x1="${xx - 60}" y1="${ya}" x2="${xx + 60}" y2="${ya}" stroke="${col}" stroke-width="1.6" stroke-dasharray="8 5"/><line x1="${xx}" y1="${ya}" x2="${xx}" y2="${yb}" stroke="${col}" stroke-width="1.8"/><path d="M${xx - 7} ${ya - 12}L${xx} ${ya}L${xx + 7} ${ya - 12}M${xx - 7} ${yb + 12}L${xx} ${yb}L${xx + 7} ${yb + 12}" fill="none" stroke="${col}" stroke-width="1.8"/>`;
        dims.push([xx, yb]); LS_DRAW._clr = { a: [xx, (ya + yb) / 2], txt: [`${fx(s.clear, 2)} m clear`, `over ${s.under.name} (top ${fx(s.under.top, 1)} m)`], col }; }
      if (s.tilt) { const lg = lsLugsWorld(L, s), lo = lg[0][2] < lg[1][2] ? lg[0] : lg[1], hi = lo === lg[0] ? lg[1] : lg[0], pl = proj(lo), phh = proj(hi), dir = Math.sign(phh[0] - pl[0]) || 1, b0 = [pl[0], Y(s.h)], rr = 150, a = s.tilt * D2R;
        g += `<line x1="${b0[0]}" y1="${b0[1]}" x2="${b0[0] + dir * (rr + 40)}" y2="${b0[1]}" stroke="#16202a" stroke-width="1.4" stroke-dasharray="10 6"/><path d="M${b0[0] + dir * rr} ${b0[1]} A${rr} ${rr} 0 0 ${dir > 0 ? 0 : 1} ${(b0[0] + dir * rr * Math.cos(a)).toFixed(1)} ${(b0[1] - rr * Math.sin(a)).toFixed(1)}" fill="none" stroke="#16202a" stroke-width="1.8"/>`;
        g += `<text x="${(b0[0] + dir * (rr + 18) * Math.cos(a / 2)).toFixed(1)}" y="${(b0[1] - (rr + 18) * Math.sin(a / 2)).toFixed(1)}" font-size="26" font-weight="700" text-anchor="${dir > 0 ? "start" : "end"}" fill="#16202a">${fx(s.tilt, 0)}°</text>`; }
      const occ = lsOcc(M, proj, W, H); { const c = occ.c; for (const [x, yt] of dims) for (let j = Math.floor(yt / c); j <= Math.floor(gy / c); j++) for (let i = Math.floor((x - 26) / c); i <= Math.floor((x + 14) / c); i++) if (i >= 0 && j >= 0 && i < occ.nx && j < occ.ny) occ.g[j * occ.nx + i] = 1; for (let j = Math.floor((gy - 14) / c); j < occ.ny; j++) for (let i = 0; i < occ.nx; i++) if (j >= 0 && j < occ.ny) occ.g[j * occ.nx + i] = 1; }
      return { svg: g, proj, occ, extra: LS_DRAW._clr ? [{ a: LS_DRAW._clr.a, col: LS_DRAW._clr.col, lines: LS_DRAW._clr.txt, pref: 180, small: true }] : [] };
    } finally { LS_DRAW && (LS_DRAW.d3 = false); plan.phase = keepPh; }
  });
}
