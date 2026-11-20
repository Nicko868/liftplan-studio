// ================= Site templates =================
// Save the site you've set up – the imported drawing (cleaned, straightened, scaled), site picture, vessels, buildings,
// zones, mats left out – and start any new plan from it. Cranes, loads and lifts are not part of a site.
let siteTemplates = [];
const STK = "lps_siteTemplates";
function stLoadLocal() { try { return JSON.parse(localStorage.getItem(STK) || "[]"); } catch (e) { return []; } }
function stSaveLocal(list) { try { localStorage.setItem(STK, JSON.stringify(list)); return true; } catch (e) { toast("Couldn't save the template here (storage full or blocked)"); return false; } }
if (CAP.db) { try { CAP.db.collection("siteTemplates").onSnapshot(s => { siteTemplates = s.docs.map(d => ({ id: d.id, ...d.data() })); stRefresh(); }, e => { console.warn(e); siteTemplates = stLoadLocal(); }); } catch (e) { siteTemplates = stLoadLocal(); } }
else siteTemplates = stLoadLocal();
function stRefresh() { if ($("stSite")) $("stSite").innerHTML = stOptions(); if (typeof renderLayoutTools === "function" && $("ltBoxUI")) renderSiteTplBox(); }
const stOptions = () => `<option value="">Blank site</option>${siteTemplates.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(t => `<option value="${escH(t.id)}">${escH(t.name)}</option>`).join("")}`;
// what a site is: everything on the plan that isn't a crane, load or mat
function siteSnapshot() {
  syncLift();
  const site = clone(plan.site); if (site.bg && site.bg.asset) delete site.bg.url;
  const obstacles = clone(plan.obstacles.filter(o => !(typeof isMat === "function" && isMat(o))));
  return { site, obstacles };
}
async function saveSiteTemplate(name) {
  const s = siteSnapshot(), c = plan.site.cad, D = c && CADS[c.id];
  const t = { id: "site_" + uid(), name, created: Date.now(), site: s.site, obstacles: s.obstacles };
  // the drawing's linework is stored with the template (its own copy), so later edits to a plan never change the template
  if (D) { const cid = "cad_" + uid(); t.site.cad = { ...c, id: cid }; delete t.site.cad.asset; delete t.site.cad.local; t.cadJson = JSON.stringify(D); }
  if (CAP.db) {
    try {
      if (t.cadJson && CAP.assets && !CAP.local) { const a = await CAP.assets.upload(new File([t.cadJson], t.site.cad.id + ".json", { type: "application/json" })); t.site.cad.asset = a.id; delete t.cadJson; }
      await CAP.db.doc("siteTemplates/" + t.id).set(t); toast(`Site saved as template “${name}”`); return;
    } catch (e) { console.warn(e); }
  }
  const list = stLoadLocal().concat([t]); if (stSaveLocal(list)) { siteTemplates = list; stRefresh(); toast(`Site saved as template “${name}” (on this computer)`); }
}
async function stCadJson(t) {
  if (t.cadJson) return t.cadJson;
  const c = t.site?.cad; if (!c) return null;
  try { if (c.asset) return await (await fetch("/_blob/" + c.asset)).text(); } catch (e) { console.warn(e); }
  return null;
}
// put a template's site into the open plan (replaces the current site; cranes, loads and lifts stay)
async function applySiteTemplate(t) {
  if (!t) return;
  const keepMats = plan.obstacles.filter(o => typeof isMat === "function" && isMat(o));
  plan.site = { ...plan.site, ...clone(t.site) };
  plan.obstacles = [...clone(t.obstacles || []).map(o => ({ ...o, id: o.id || uid() })), ...keepMats];
  if (t.site?.cad) {
    const json = await stCadJson(t);
    if (json) { const nid = "cad_" + uid(); CADS[nid] = JSON.parse(json); plan.site.cad = { ...clone(t.site.cad), id: nid, v: 0 }; delete plan.site.cad.asset; delete plan.site.cad.local; saveCad(nid, CADS[nid]); }
    else { plan.site.cad = null; toast("The template's drawing couldn't be loaded – the site items were placed"); }
  }
  if (plan.site.bg && plan.site.bg.asset && !plan.site.bg.url) plan.site.bg.url = "/_blob/" + plan.site.bg.asset;
  if (typeof registerVesselCranes === "function") try { registerVesselCranes(); } catch (e) {}
  if (typeof LT !== "undefined") LT.undo = [];
  markDirty(); renderMeta(); renderAll(); if (typeof ltFit === "function" && (plan.site.cad || plan.site.bg)) setTimeout(ltFit, 30); else fitView();
  toast(`Site “${t.name}” placed`);
}
async function deleteSiteTemplate(id) {
  if (CAP.db && siteTemplates.some(t => t.id === id && !stLoadLocal().some(x => x.id === id))) { try { await CAP.db.doc("siteTemplates/" + id).delete(); return; } catch (e) { console.warn(e); } }
  const list = stLoadLocal().filter(t => t.id !== id); stSaveLocal(list); siteTemplates = siteTemplates.filter(t => t.id !== id); stRefresh();
}
// ---- in the plan: a "Site templates" box under the site background ----
function renderSiteTplBox() {
  let box = $("stplBox");
  if (!box) { box = document.createElement("div"); box.id = "stplBox"; box.className = "ltools"; const anchor = $("ltBoxUI") || $("bgInfo"); anchor.after(box); }
  const has = !!(plan.site.cad || plan.site.bg || plan.obstacles.some(o => !(typeof isMat === "function" && isMat(o))));
  box.innerHTML = `<div class="lth"><b>Site templates</b><span class="small">${siteTemplates.length} saved</span></div>
    <div class="ltrow"><button id="stplSave" ${has ? "" : "disabled"} title="Save the drawing, vessels and site items to reuse in other plans">💾 Save this site as a template</button></div>
    ${siteTemplates.length ? `<div class="ltrow"><select id="stplPick" style="flex:1;min-width:0">${siteTemplates.map(t => `<option value="${escH(t.id)}">${escH(t.name)}</option>`).join("")}</select><button id="stplUse">Use</button><button id="stplDel" title="Delete this template">×</button></div>` : ""}
    <div id="stplName" hidden class="ltrow"><input type="text" id="stplNameIn" placeholder="e.g. Port of Dakar – Berth 3" style="flex:1;min-width:0"><button id="stplOk" class="pri">Save</button></div>`;
  $("stplSave").onclick = () => { $("stplName").hidden = false; const n = $("stplNameIn"); n.value = plan.meta.project || plan.name || ""; n.focus(); n.select(); };
  $("stplOk") && ($("stplOk").onclick = () => { const v = $("stplNameIn").value.trim(); if (!v) { toast("Give the site a name"); return; } $("stplName").hidden = true; saveSiteTemplate(v); });
  if ($("stplNameIn")) $("stplNameIn").onkeydown = e => { if (e.key === "Enter") $("stplOk").click(); };
  if ($("stplUse")) $("stplUse").onclick = () => { const b = $("stplUse"); if (b.dataset.armed !== "1" && (plan.site.cad || plan.site.bg || plan.obstacles.length)) { b.dataset.armed = "1"; b.textContent = "Replace this site?"; return; } applySiteTemplate(siteTemplates.find(t => t.id === $("stplPick").value)); };
  if ($("stplDel")) $("stplDel").onclick = () => { const b = $("stplDel"); if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Delete?"; return; } deleteSiteTemplate($("stplPick").value); };
}
{ const _rm = renderMeta; renderMeta = function (...a) { const r = _rm(...a); try { renderSiteTplBox(); } catch (e) { console.warn(e); } return r; }; }
// ---- on the home page: start a new plan on a saved site ----
{
  const btn = $("stNew");
  if (btn) {
    btn.insertAdjacentHTML("beforebegin", `<label>Site<select id="stSite">${stOptions()}</select></label>`);
    const orig = btn.onclick;
    btn.onclick = async (...a) => { const id = $("stSite").value, t = siteTemplates.find(x => x.id === id); if (orig.apply(btn, a) === false) return; if (t) await applySiteTemplate(t); };
  }
}
