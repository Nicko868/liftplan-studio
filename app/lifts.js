// ================= Multiple lifts =================
// status + summary of one lift
function liftInfo(i) {
  return withLift(i, L => {
    const cr = L.cranes.map(c => ({ c, S: craneSummary(c) }));
    let st = cr.length ? "ok" : "na";
    const rank = { na: 0, ok: 1, amber: 2, bad: 3 };
    for (const x of cr) if (rank[x.S.status] > rank[st]) st = x.S.status;
    const rig = L.loads.map(ld => ({ ld, auto: !ld.rig?.arr || ld.rig.auto }));
    if (rig.some(r => r.auto) && st === "ok") st = "amber";
    const clash = L.loads.some(ld => { const tp = travelPath(ld), h = tp ? obstacleHits(ld, tp) : null; return h && h.bad; });
    if (clash) st = "bad";
    // why: the reasons behind the status, shown next to it
    const lim = +plan.site.ulim || 100, why = [];
    for (const x of cr) {
      if (x.S.util != null && x.S.util > 100) why.push(`${x.c.label} over 100% of chart`);
      else if (x.S.util != null && x.S.util > lim) why.push(`${x.c.label} ${fx(x.S.util, 1)}% > ${lim}% limit`);
      if (x.S.gbpOk === false) why.push(`${x.c.label} ground bearing over ${gbcFor(x.c)} t/m²`);
      if (x.S.status === "bad" && !(x.S.util > 100) && x.S.gbpOk !== false && x.S.warn.length) why.push(x.S.warn[0].slice(0, 60));
    }
    if (rig.some(r => r.auto)) why.push("rigging not confirmed");
    if (clash) why.push("travel path clash");
    const utils = cr.map(x => x.S.util).filter(u => u != null), gbps = cr.map(x => x.S.gbp).filter(g => g != null);
    return { L, cr, st, rig, clash, maxU: utils.length ? Math.max(...utils) : null, maxG: gbps.length ? Math.max(...gbps) : null,
      why, weight: L.loads.reduce((a, l) => a + (+l.weight || 0) + rigW(l), 0) };
  });
}
function renderLiftBar() {
  const bar = $("liftBar"); if (!bar) return;
  syncLift();
  const many = plan.lifts.length > 1;
  bar.innerHTML = plan.lifts.map((L, i) => {
    let st = "na"; try { st = liftInfo(i).st; } catch (e) { }
    return `<div class="lt" role="tab" data-lift="${i}" aria-selected="${!allMode && i === plan.al}" title="Double-click to rename"><span class="st ${st}"></span><span class="nm">${escH(L.name)}</span>${many ? `<button class="x" data-dellift="${i}" title="Delete this lift">×</button>` : ""}</div>`;
  }).join("") + `<button class="add" id="liftAdd" title="Add another lift to this plan">+ Add lift</button><span class="sp"></span>` +
    (many ? `<button class="all" id="liftAll" aria-pressed="${allMode}" title="See every lift together">All lifts (${plan.lifts.length})</button>` : "");
}
let _lbT = null;
function queueLiftBar() { clearTimeout(_lbT); _lbT = setTimeout(renderLiftBar, 120); }
function switchLift(i) {
  syncLift();
  i = Math.max(0, Math.min(plan.lifts.length - 1, i));
  plan.al = i; plan.cranes = plan.lifts[i].cranes; plan.loads = plan.lifts[i].loads;
  allMode = false; sel = null;
  if (typeof elevPhase !== "undefined") { }
  renderAll(); renderLiftBar();
}
function setAllMode(on) {
  syncLift(); allMode = !!on && plan.lifts.length > 1; sel = null;
  renderAll(); renderLiftBar(); fitView();
}
// copy a crane for a new lift: same machine, set-up and position, hook left where it was
function copyCraneFree(c) {
  const n = clone(c); n.unit = c.unit || c.id; n.id = uid();
  const t = {};
  for (const ph of ["pick", "set"]) { const ev = evalCrane(c, ph); t[ph] = { free: true, R: Math.round((ev.R || 10) * 10) / 10, brg: Math.round((ev.bearing ?? c.heading) * 10) / 10 }; }
  n.tip = t; n.attach = null;
  return n;
}
function addLift(kind) {
  syncLift();
  const cur = plan.lifts[plan.al], n = plan.lifts.length + 1;
  let L = { id: uid(), name: "Lift " + n, cranes: [], loads: [] };
  if (kind === "cranes") L.cranes = cur.cranes.map(copyCraneFree);
  else if (kind === "dup") {
    const map = {};
    L.loads = cur.loads.map(ld => { const x = clone(ld); x.unit = ld.unit || ld.id; x.id = uid(); map[ld.id] = x.id; return x; });
    L.cranes = cur.cranes.map(c => { const x = clone(c); x.unit = c.unit || c.id; x.id = uid(); if (x.attach?.load) x.attach.load = map[x.attach.load] || ""; return x; });
  }
  plan.lifts.splice(plan.al + 1, 0, L);
  switchLift(plan.al + 1); markDirty(); renderLiftBar();
  toast(kind === "cranes" ? `${L.name} added with the same cranes – now add its load` : kind === "dup" ? `${L.name} added – change what's different` : `${L.name} added`, 3200);
}
function deleteLift(i) {
  syncLift(); if (plan.lifts.length < 2) return;
  const name = plan.lifts[i].name;
  plan.lifts.splice(i, 1);
  const al = i < plan.al ? plan.al - 1 : Math.min(plan.al, plan.lifts.length - 1);
  plan.al = al; plan.cranes = plan.lifts[al].cranes; plan.loads = plan.lifts[al].loads;
  if (plan.lifts.length < 2) allMode = false;
  sel = null; markDirty(); renderAll(); renderLiftBar();
  toast(`${name} deleted – Ctrl+Z to undo`);
}
function moveLift(i, d) {
  syncLift(); const j = i + d; if (j < 0 || j >= plan.lifts.length) return;
  const A = plan.lifts, act = A[plan.al];
  [A[i], A[j]] = [A[j], A[i]]; plan.al = A.indexOf(act);
  markDirty(); renderAll(); renderLiftBar();
}
function openLiftMenu(btn) {
  closeLiftMenu();
  const r = btn.getBoundingClientRect(), m = document.createElement("div"); m.id = "liftMenu";
  const cur = plan.lifts[plan.al], hasCr = cur.cranes.length;
  m.innerHTML = `<p class="small" style="margin:2px 0 4px">New lift after <b>${escH(cur.name)}</b></p>
    <button data-lk="cranes" ${hasCr ? "" : "disabled"}>Same crane(s), new load<br><span class="small">Cranes stay set up where they are</span></button>
    <button data-lk="dup">Duplicate this lift<br><span class="small">Cranes, load and rigging copied</span></button>
    <button data-lk="empty">Empty lift</button>`;
  document.body.appendChild(m);
  m.style.left = Math.min(innerWidth - 250, r.left) + "px"; m.style.top = (r.bottom + 4) + "px";
  m.onclick = e => { const b = e.target.closest("[data-lk]"); if (b && !b.disabled) { closeLiftMenu(); addLift(b.dataset.lk); } };
  setTimeout(() => document.addEventListener("pointerdown", closeLiftMenuOut, true), 0);
}
function closeLiftMenuOut(e) { if (!e.target.closest("#liftMenu")) closeLiftMenu(); }
function closeLiftMenu() { $("liftMenu")?.remove(); document.removeEventListener("pointerdown", closeLiftMenuOut, true); }
function renameLift(i, tab) {
  const nm = tab.querySelector(".nm"); if (!nm) return;
  const inp = document.createElement("input"); inp.value = plan.lifts[i].name; inp.style.cssText = "width:120px;padding:1px 4px;font-size:13px";
  nm.replaceWith(inp); inp.focus(); inp.select();
  const done = ok => { if (ok && inp.value.trim()) { plan.lifts[i].name = inp.value.trim().slice(0, 40); markDirty(); } renderLiftBar(); if (allMode) renderAll(); };
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); };
  inp.onblur = () => done(true);
}
function wireLiftBar() {
  const bar = $("liftBar"); if (!bar) return;
  bar.addEventListener("pointerdown", () => { const a = document.activeElement; if (a && a.closest && a.closest("#props") && a.blur) a.blur(); }, true);
  bar.addEventListener("click", e => {
    const del = e.target.closest("[data-dellift]");
    if (del) {
      const i = +del.dataset.dellift;
      if (del.dataset.armed) deleteLift(i);
      else { del.dataset.armed = "1"; del.textContent = "Delete?"; del.style.color = "var(--bad)"; setTimeout(() => renderLiftBar(), 2500); }
      e.stopPropagation(); return;
    }
    if (e.target.closest("#liftAdd")) { openLiftMenu(e.target.closest("#liftAdd")); return; }
    if (e.target.closest("#liftAll")) { setAllMode(!allMode); return; }
    const t = e.target.closest("[data-lift]"); if (t && !e.target.closest("input")) { const i = +t.dataset.lift; if (i !== plan.al || allMode) switchLift(i); }
  });
  bar.addEventListener("dblclick", e => { const t = e.target.closest("[data-lift]"); if (t) renameLift(+t.dataset.lift, t); });
  // summary table actions (checks panel in All lifts)
  document.addEventListener("click", e => {
    const o = e.target.closest("[data-openlift]"); if (o) { switchLift(+o.dataset.openlift); return; }
    const mv = e.target.closest("[data-mvlift]"); if (mv) { const [i, d] = mv.dataset.mvlift.split(",").map(Number); moveLift(i, d); }
  });
}
function liftsSummaryHTML() {
  const pill = (st, t) => `<span class="pill ${st}">${t}</span>`, lim = +plan.site.ulim || 100;
  const infos = plan.lifts.map((_, i) => liftInfo(i));
  const n = infos.length, worst = infos.reduce((m, x) => x.maxU != null && x.maxU > (m?.maxU ?? -1) ? x : m, null);
  const bad = infos.filter(x => x.st === "bad").length, amb = infos.filter(x => x.st === "amber").length;
  let h = `<div class="card" style="margin-bottom:10px"><div class="ch"><b>All lifts · ${n}</b><span class="small">${bad ? `<span style="color:var(--bad)">${bad} not OK</span>` : amb ? `<span style="color:var(--amber)">${amb} to review</span>` : "all OK"}</span></div>
    <table><tr><td>Heaviest lift</td><td class="n">${(() => { const x = infos.reduce((m, y) => y.weight > (m?.weight ?? -1) ? y : m, null); return x ? `${escH(x.L.name)} · ${fx(x.weight, 2)} t` : "–"; })()}</td></tr>
    <tr><td>Highest utilisation</td><td class="n">${worst ? `${escH(worst.L.name)} · ${pill(worst.maxU > 100 ? "bad" : worst.maxU > lim ? "amber" : "ok", fx(worst.maxU, 1) + "%")}` : "–"}</td></tr>
    <tr><td>Cranes used</td><td class="n">${[...new Set(infos.flatMap(x => x.cr.map(c => (c.S.C ? c.S.C.short : c.c.model))))].map(escH).join(", ") || "–"}</td></tr></table></div>`;
  infos.forEach((x, i) => {
    h += `<div class="card lsum" style="margin-bottom:8px"><div class="ch"><b>${i + 1}. ${escH(x.L.name)}</b><span style="display:flex;gap:4px;align-items:center">${pill(x.st, x.st === "ok" ? "OK" : x.st === "amber" ? "Review" : x.st === "bad" ? "Not OK" : "–")}
      <button data-mvlift="${i},-1" title="Earlier in sequence" ${i ? "" : "disabled"}>▲</button><button data-mvlift="${i},1" title="Later in sequence" ${i < n - 1 ? "" : "disabled"}>▼</button><button data-openlift="${i}">Open</button></span></div>
      <table><tr><td>Load</td><td class="n">${x.L.loads.map(l => `${escH(l.name)} ${fx(+l.weight || 0, 2)} t`).join("<br>") || "–"}</td></tr>
      ${x.cr.map(c => `<tr><td style="color:${c.c.color}">${escH(c.c.label)} ${escH(c.S.C ? c.S.C.short : "")}</td><td class="n">R ${fx(c.S.maxR)} m · ${c.S.util != null ? pill(c.S.util > 100 ? "bad" : c.S.util > lim ? "amber" : "ok", fx(c.S.util, 1) + "%") : "–"}${c.S.gbp != null ? ` · ${fx(c.S.gbp, 1)} t/m²` : ""}</td></tr>`).join("") || `<tr><td colspan="2" class="small">No crane</td></tr>`}
      ${x.why.length ? `<tr><td colspan="2" class="small" style="color:${x.st === "bad" ? "var(--bad)" : "var(--amber)"}">${x.st === "bad" ? "Not OK" : "Review"} because: ${x.why.map(escH).join(" · ")}</td></tr>` : ""}</table></div>`;
  });
  return h;
}
// keep the tabs' status dots current
{ const _ra = renderAll; renderAll = function (k) { _ra(k); queueLiftBar(); }; }
wireLiftBar(); renderLiftBar();
