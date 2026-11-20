// ================= Start screen: new plan or open an existing one =================
document.body.insertAdjacentHTML("beforeend", `
<dialog id="dStart" class="dash"><div class="dsh">
  <header class="dtop">
    <div class="dbrand">LiftPlan <span>Studio</span></div>
    <div class="dhi"><div id="dGreet">Welcome</div><div class="small" id="dDate"></div></div>
    <span style="flex:1"></span>
    <button id="stTheme" class="dghost" style="margin-right:8px">☾ Dark</button>
    <button id="stClose" class="dghost">Back to the plan ›</button>
  </header>
  <p class="small" id="stWarn" hidden>The plan that's open has unsaved changes – they'll be lost if you start or open another.</p>
  <section class="dkpis" id="dKpis"></section>
  <div class="dgrid">
    <section class="dcard dnew">
      <h3>New lift plan</h3>
      <label><span>Plan title <i class="req">*</i></span><input type="text" id="stName" data-req="Plan title" placeholder="e.g. Berth 3 – reel load-out"></label>
      <label><span>Client</span><input type="text" id="stClient" placeholder="Client / company the plan is for"></label>
      <div class="drow"><label><span>Project / location <i class="req">*</i></span><input type="text" id="stProj" data-req="Project / location" placeholder="Site, berth or vessel"></label><label><span>Lift plan no. <i class="req">*</i></span><input type="text" id="stLift" data-req="Lift plan no." placeholder="e.g. LP-SB-003"></label></div>
      <div class="drow"><label><span>Author <i class="req">*</i></span><input type="text" id="stBy" data-req="Author"></label><label><span>Date <i class="req">*</i></span><input type="text" id="stDate" data-req="Date" placeholder="dd/mm/yyyy"></label></div>
      <button class="pri off" id="stNew" aria-disabled="true">Create plan ›</button>
      <p class="small stmiss" id="stMiss"></p>
      <p class="small">Then: site layout (drawing, photo or PDF) → vessel &amp; objects → load → cranes.</p>
      <h3 style="margin-top:14px">Libraries &amp; tools</h3>
      <div class="dtools">
        <button data-dgo="cranes"><b>Crane library</b><span id="dtCr"></span></button>
        <button data-dgo="rigging"><b>Rigging library</b><span id="dtRg"></span></button>
        <button data-dgo="plans"><b>All plans</b><span>manage · back up</span></button>
        <button data-dgo="master"><b>Master data</b><span>import / export libraries</span></button>
        <button id="stRestore"><b>Restore backup</b><span>from a file</span></button>
      </div>
    </section>
    <section class="dcard dplans">
      <div class="dhead"><h3>Lift plans</h3><input type="search" id="stSearch" placeholder="Search plans, projects, cranes…"></div>
      <div id="stList"></div>
    </section>
    <section class="dcard dside">
      <h3>Recent activity</h3><div id="dAct"></div>
      <h3 style="margin-top:14px">Cranes used most</h3><div id="dFleet"></div>
    </section>
  </div>
</div></dialog>`);
const plansLifts = p => (p.lifts && p.lifts.length ? p.lifts : [{ cranes: p.cranes || [], loads: p.loads || [] }]);
function planCranes(p) { return [...new Set(plansLifts(p).flatMap(L => (L.cranes || []).map(c => REG.cranes[c.model]?.short || c.model)))]; }
function renderStartList() {
  const q = ($("stSearch").value || "").trim().toLowerCase();
  const all = [...planIndex].sort((a, b) => (b.savedAt || b.updated || 0) - (a.savedAt || a.updated || 0));
  const list = all.filter(p => !q || [p.name, p.meta?.project, ...planCranes(p), ...plansLifts(p).flatMap(L => (L.loads || []).map(l => l.name))].join(" ").toLowerCase().includes(q));
  const who = id => typeof teamName === "function" ? teamName(id) : "";
  const when = t => typeof ago === "function" ? ago(t) : new Date(t).toLocaleDateString("en-GB");
  $("stList").innerHTML = list.map(p => { const Ls = plansLifts(p), nl = Ls.length, loads = [...new Set(Ls.flatMap(L => (L.loads || []).map(l => l.name)))], maxW = Math.max(0, ...Ls.flatMap(L => (L.loads || []).map(l => +l.weight || 0)));
    const t = p.savedAt || p.updated;
    return `<div class="dplan"><button class="dpmain" data-stopen="${p.id}"><div class="dpt"><b>${escH(p.name || "Lift plan")}</b><span class="dtag">${nl} lift${nl > 1 ? "s" : ""}</span></div>
      <div class="small">${escH(p.meta?.project || "No project")}</div>
      <div class="dpm"><span>${escH(loads.slice(0, 2).join(", ") || "no load")}${loads.length > 2 ? " +" + (loads.length - 2) : ""}</span>${maxW ? `<span>${fx(maxW, 1)} t</span>` : ""}<span>${escH(planCranes(p).join(", ") || "no crane")}</span></div>
      <div class="dpf small">${t ? `Saved ${when(t)}` : ""}${p.savedBy ? ` by ${escH(who(p.savedBy))}` : ""}</div></button>
      <button class="dpcopy" data-stcopy="${p.id}" title="Duplicate this plan">⧉</button></div>`; }).join("")
    || `<p class="small" style="padding:10px">${CAP.db ? (planIndex.length ? "No plans match your search." : "No saved plans yet – create your first one.") : "Loading saved plans…"}</p>`;
  $("stList").querySelectorAll("[data-stopen]").forEach(b => b.onclick = () => {
    const p = planIndex.find(x => x.id === b.dataset.stopen); if (!p) return;
    const q2 = clone(p); if (q2.site.bg && q2.site.bg.asset && !CAP.local) q2.site.bg.url = "/_blob/" + q2.site.bg.asset;
    $("dStart").close(); openPlan(q2); toast(`Opened ${q2.name}`);
  });
  $("stList").querySelectorAll("[data-stcopy]").forEach(b => b.onclick = () => {
    const p = clone(planIndex.find(x => x.id === b.dataset.stcopy)); if (!p) return; p.id = uid(); p.name = (p.name || "Lift plan") + " (copy)"; delete p.rev; delete p.createdBy; delete p.createdAt; delete p.savedBy; delete p.savedAt;
    if (p.site.bg?.asset && !CAP.local) p.site.bg.url = "/_blob/" + p.site.bg.asset; $("dStart").close(); openPlan(p, true); toast("Copy opened – save it to keep it");
  });
  renderDash(all);
}
function renderDash(all) {
  const wk = Date.now() - 7 * 864e5, lifts = all.reduce((a, p) => a + plansLifts(p).length, 0), recent = all.filter(p => (p.savedAt || p.updated || 0) > wk).length;
  const cr = Object.values(REG.cranes).filter(c => c.type !== "ped").length, rg = typeof rigLibrary === "function" ? rigLibrary().length : 0;
  const tile = (k, v, s2) => `<div class="dkpi"><div class="dk">${k}</div><div class="dv">${v}</div><div class="small">${s2}</div></div>`;
  $("dKpis").innerHTML = tile("Lift plans", all.length, `${recent} saved this week`) + tile("Lifts planned", lifts, "across all plans") + tile("Cranes in library", cr, "with load charts") + tile("Rigging items", rg, "in the rigging library");
  $("dtCr").textContent = `${cr} cranes`; $("dtRg").textContent = `${rg} items`;
  const who = id => typeof teamName === "function" ? teamName(id) : "";
  $("dAct").innerHTML = all.slice(0, 6).map(p => `<div class="dact"><i></i><div><b>${escH(p.name || "Lift plan")}</b><div class="small">${p.savedBy ? escH(who(p.savedBy)) + " saved" : "Saved"} ${typeof ago === "function" ? ago(p.savedAt || p.updated || 0) : ""}</div></div></div>`).join("") || `<p class="small">Nothing yet.</p>`;
  const use = {}; all.forEach(p => planCranes(p).forEach(c => use[c] = (use[c] || 0) + 1));
  const top = Object.entries(use).sort((a, b) => b[1] - a[1]).slice(0, 5), mx = top[0]?.[1] || 1;
  $("dFleet").innerHTML = top.map(([c, n]) => `<div class="dfl"><span>${escH(c)}</span><div class="dbar"><i style="width:${n / mx * 100}%"></i></div><b>${n}</b></div>`).join("") || `<p class="small">No cranes used yet.</p>`;
  if (typeof teamResolve === "function") { const ids = all.slice(0, 20).map(p => p.savedBy); teamResolve(ids).then(() => { if (!ids.some(Boolean)) return; }); }
}
async function dashGreet() {
  const h = new Date().getHours(), g = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  let n = ""; try { if (typeof TEAM !== "undefined" && TEAM.user) { const me = await TEAM.user.me(); n = me.name ? me.name.split(" ")[0] : ""; if (me.name && !$("stBy").value) $("stBy").value = me.name; } } catch (e) { }
  $("dGreet").textContent = n ? `${g}, ${n}` : g; $("dDate").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-dgo]"); if (!b) return; const k = b.dataset.dgo; $("dStart").close();
  if (k === "cranes") $("bCranes").click(); else if (k === "rigging") { if (typeof openRigLib === "function") openRigLib(); } else if (k === "plans") $("bPlans").click(); });
// ---- a new plan needs its title block filled in before it can be created ----
let planStarted = false;   // false while the app shows the untitled scratch plan it starts with
{ const _op = openPlan; openPlan = function (...a) { planStarted = true; return _op.apply(this, a); }; }
const ST_REQ = () => [...document.querySelectorAll("#dStart [data-req]")];
function stValidate(show) {
  const miss = ST_REQ().filter(i => !i.value.trim());
  if (show) { ST_REQ().forEach(i => i.classList.toggle("miss", !i.value.trim())); if (miss[0]) miss[0].focus(); }
  const b = $("stNew"); b.classList.toggle("off", !!miss.length); b.setAttribute("aria-disabled", miss.length ? "true" : "false");
  $("stMiss").textContent = miss.length ? (show ? "Fill in: " : "Still needed: ") + miss.map(i => i.dataset.req).join(", ") : "";
  $("stMiss").classList.toggle("bad", !!(show && miss.length));
  return !miss.length;
}
ST_REQ().forEach(i => {
  i.addEventListener("input", () => { if (i.value.trim()) i.classList.remove("miss"); stValidate(false); });
  i.addEventListener("keydown", e => { if (e.key === "Enter") $("stNew").click(); });
});
// no Esc / "Back" out of the home page onto an untitled plan
$("dStart").addEventListener("cancel", e => { if (!planStarted) e.preventDefault(); });
// libraries opened from the home page bring you back here when closed, if no plan has been started yet
function stReturnHome() { setTimeout(() => { if (planStarted || $("dStart").open) return; const d = [...document.querySelectorAll("dialog[open]")].pop(); if (d) d.addEventListener("close", stReturnHome, { once: true }); else openStart(false); }, 60); }
document.addEventListener("click", e => { if (e.target.closest && e.target.closest("[data-dgo], #stRestore")) stReturnHome(); });
$("restoreFile").addEventListener("cancel", stReturnHome);
let _stT = null, _stN = -1;
function openStart(fromNew) {
  $("stName").value = ""; $("stClient").value = ""; $("stProj").value = ""; $("stLift").value = ""; $("stBy").value = plan.meta?.by || ""; $("stDate").value = new Date().toLocaleDateString("en-GB");
  ST_REQ().forEach(i => i.classList.remove("miss")); stValidate(false);
  // until a plan has been created or opened there is nothing to go back to – the form (or an existing plan) is the only way in
  $("stClose").hidden = !planStarted;
  $("stWarn").hidden = !(fromNew && dirty && (plan.cranes.length + plan.loads.length + plan.obstacles.length));
  $("stSearch").value = ""; renderStartList(); dashGreet(); $("dStart").showModal();
  clearInterval(_stT); _stN = planIndex.length;
  _stT = setInterval(() => { if (!$("dStart").open) { clearInterval(_stT); return; } if (planIndex.length !== _stN) { _stN = planIndex.length; renderStartList(); } }, 400);
}
$("stSearch").oninput = renderStartList;
$("stClose").onclick = () => $("dStart").close();
$("stRestore").onclick = () => { $("dStart").close(); $("restoreFile").click(); };
$("stNew").onclick = () => {
  if (!stValidate(true)) return false;
  const v = id => $(id).value.trim();
  const p = blankPlan(); p.name = v("stName"); p.meta.project = v("stProj"); p.meta.client = v("stClient"); try { const c = JSON.parse(localStorage.getItem("lp_company") || "null"); if (c && c.company) { p.meta.company = c.company; if (c.logo) p.meta.companyLogo = c.logo; } } catch (e) { } p.meta.lift = v("stLift"); p.meta.by = v("stBy"); p.meta.date = v("stDate");
  $("dStart").close(); openPlan(p); view.cx = 0; view.cy = 0; view.s = 12; renderSite(); dirty = true; refreshSaveState();
};
$("bNew").onclick = () => openStart(true);
// the empty-canvas guide: site first, then load and cranes
$("welcome").querySelector(".wcard").innerHTML = `
  <b>Set up the lift</b>
  <ol>
    <li><span>Set up the site</span><small>Upload the site drawing, map, photo or PDF and set its scale – or build it from objects. Add the vessel if the lift is on or off a ship.</small>
      <div class="wbtns" style="grid-column:2 / 4;display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="pri" id="wBg">Import site layout (PDF / photo)</button><button id="wVessel">+ Vessel</button><button id="wObj">+ Site objects</button></div></li>
    <li><span>Add the load</span><small>Library, photo / PDF, or build it – reels, CCUs, bulk bags, tanks, pipes…</small><button id="wLoad">+ Add load</button></li>
    <li><span>Add your crane(s)</span><small>Shore crane from the library, or the vessel's own crane.</small><button id="wCrane">+ Add crane</button></li>
    <li><span>Hook on &amp; check</span><small>Drag each boom tip onto a lifting point – utilisation, GBP, clearances and rigging update as you go.</small></li>
    <li><span>Export</span><small>PDF lift plan with site, elevations and rigging sheets.</small></li>
  </ol>
  <button id="wOpen">Open a saved plan</button>`;
document.head.insertAdjacentHTML("beforeend", `<style>.wcard li .wbtns button{grid-row:auto;grid-column:auto}.wcard li .wbtns{font-weight:400}</style>`);
$("wLoad").onclick = () => openLoadBuilder(null); $("wCrane").onclick = () => openCranePicker(); $("wOpen").onclick = () => openStart(false);
$("wBg").onclick = () => openSiteImport(); $("wVessel").onclick = () => openVesselDialog(null); $("wObj").onclick = () => openObjLib();
setTimeout(() => openStart(false), 50);
