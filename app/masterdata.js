// ================= Master data: one JSON file for every library (rigging, cranes + charts, loads, vessels, set-ups) =================
// Export → edit / have Claude build it from certificates or lists → import. Nothing in the app has to change to add equipment.
const MD_TYPES = { shackle: "shackle", "bow shackle": "shackle", "dee shackle": "shackle", "d shackle": "shackle", masterlink: "masterlink", "master link": "masterlink", "master link assembly": "masterlink", hook: "hook",
  "round sling": "sling_round", roundsling: "sling_round", sling_round: "sling_round", "webbing sling": "sling_web", "web sling": "sling_web", sling_web: "sling_web", "wire rope sling": "sling_wire", wire: "sling_wire", sling_wire: "sling_wire", grommet: "sling_wire",
  "chain sling": "sling_chain", chain: "sling_chain", sling_chain: "sling_chain", spreader: "spreader", "spreader beam": "spreader", "lifting beam": "spreader", beam: "spreader", other: "other", swivel: "other", "load cell": "other", "load link": "other", turnbuckle: "other" };
const MD_NAMES = { rigging: "rigging items", rigTemplates: "rigging set-ups", cranes: "cranes", charts: "load charts", loads: "loads", vessels: "vessels", plans: "plans", siteTemplates: "site templates" };
const mdCount = n => Object.entries(n).filter(([k, v]) => v && k !== "skipped").map(([k, v]) => `${v} ${MD_NAMES[k] || k}`).join(", ");
const num = v => v === "" || v == null ? null : +String(v).replace(/[^0-9.\-]/g, "");
// accept our own format or plain spreadsheet-style columns (swl_t, weight_kg, length_m, kg_per_m …)
function mdRigItem(x) {
  const type = RIG_TYPES[x.type] ? x.type : MD_TYPES[String(x.type || x.category || "").toLowerCase().trim()] || (/shackle/i.test(x.name) ? "shackle" : /master ?link/i.test(x.name) ? "masterlink" : /round sling/i.test(x.name) ? "sling_round" : /web/i.test(x.name) ? "sling_web" : /wire|grommet/i.test(x.name) ? "sling_wire" : /chain/i.test(x.name) ? "sling_chain" : /hook/i.test(x.name) ? "hook" : /spreader|beam/i.test(x.name) ? "spreader" : "other");
  const sl = RIG_TYPES[type]?.sling;
  const swl = num(x.swl ?? x.swl_t ?? x.wll ?? x.wll_t), wKg = num(x.weight_kg ?? x.mass_kg), w = wKg != null ? wKg / 1000 : num(x.weight ?? x.weight_t);
  const wpm = x.wpm != null ? +x.wpm : num(x.kg_per_m) != null ? num(x.kg_per_m) / 1000 : 0, len = num(x.len ?? x.length_m ?? x.length ?? x.span_m);
  if (!x.name || !(swl > 0)) return null;
  const it = { type, name: String(x.name).trim(), swl, weight: sl ? 0 : (w || 0), len: sl ? 0 : (len || (type === "spreader" ? 4 : 0.2)), wpm: sl ? (wpm || 0) : 0 };
  for (const k of ["colour", "cert", "notes", "serial", "pad", "drawing"]) if (x[k] != null && x[k] !== "") it[k] = x[k];
  if (x.certificate) it.cert = x.certificate;
  return { id: x.id && !String(x.id).startsWith("shk_") ? String(x.id) : "r_" + String(it.name).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60), ...it };
}
function mdLoad(x) {
  if (!x || !x.name) return null;
  const kind = LOAD_TYPES[x.kind] ? x.kind : "box", base = clone(LOAD_DEFAULTS[kind] || LOAD_DEFAULTS.box);
  const o = { ...base, ...x, kind, weight: num(x.weight ?? x.weight_t) ?? base.weight };
  for (const [a, b] of [["length_m", "L"], ["width_m", "W"], ["height_m", "H"], ["diameter_m", "D"]]) if (x[a] != null) o[b] = +x[a];
  delete o.id; delete o.pick; delete o.set; return { id: x.id || "lt_" + String(x.name).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60), ...o };
}
function masterData() {
  return { liftplanMaster: 1, app: "LiftPlan Studio", saved: new Date().toISOString(),
    rigging: rigCustom.map(i => ({ ...i })), rigTemplates: rigTemplates.map(t => ({ ...t })), cranes: customCranes.map(c => ({ ...c })), charts: customCharts.map(c => ({ ...c })),
    loads: loadTemplates.map(l => ({ ...l })), vessels: (typeof VD !== "undefined" ? VD.lib : []).map(v => ({ ...v })) };
}
async function importMaster(d) {
  if (!CAP.db) { toast("Saving isn't available in this view."); return null; }
  const n = { rigging: 0, rigTemplates: 0, cranes: 0, charts: 0, loads: 0, vessels: 0, plans: 0, skipped: 0 };
  const put = async (coll, id, doc) => { await CAP.db.doc(coll + "/" + id).set(doc); };
  for (const x of d.rigging || d.rigItems || []) { const it = mdRigItem(x); if (!it) { n.skipped++; continue; } const { id, ...rest } = it; await put("rigging", id, rest); n.rigging++; }
  for (const x of d.rigTemplates || []) { if (!x.rig) { n.skipped++; continue; } const { id, ...rest } = x; await put("rigTemplates", id || uid(), rest); n.rigTemplates++; }
  for (const x of d.cranes || []) { if (!x.id) { n.skipped++; continue; } const { id, ...rest } = x; await put("cranes", id, rest); n.cranes++; }
  for (const x of d.charts || []) { if (!x.id || !x.craneId) { n.skipped++; continue; } await put("charts", x.id, x); n.charts++; }
  for (const x of d.loads || d.loadTemplates || []) { const l = mdLoad(x); if (!l) { n.skipped++; continue; } const { id, ...rest } = l; await put("loadTemplates", id, { ...rest, updated: Date.now() }); n.loads++; }
  for (const x of d.vessels || []) { const v = x.vessel ? x : { label: x.label || x.name, w: x.w, cranes: x.cranes || [], vessel: x }; if (!v.label && !v.vessel?.label) { n.skipped++; continue; } await put("vessels", x.id || x.libId || uid(), { label: v.label || v.vessel.label, w: v.w || v.vessel.w, cranes: v.cranes || v.vessel.cranes || [], vessel: v.vessel, updated: Date.now() }); n.vessels++; }
  for (const p of d.plans || []) { if (!p.id) continue; await put("plans", p.id, p); n.plans++; }
  return n;
}
document.body.insertAdjacentHTML("beforeend", `
<dialog id="dMaster" style="width:min(720px,96vw)"><div class="dh"><div><b>Master data</b><div class="small">All your libraries in one file – rigging, cranes and load charts, loads, vessels and saved set-ups</div></div><button data-close>Close</button></div><div class="db">
  <div id="mdCounts" class="kpis3"></div>
  <div class="btnrow" style="margin:12px 0"><button class="pri" id="mdExport">Export master data (.json)</button><button id="mdImport">Import master data or backup…</button><input type="file" id="mdFile" accept=".json,application/json" hidden></div>
  <div id="mdStatus" class="status" hidden></div>
  <details class="small"><summary>What goes in the file</summary>
    <p>A JSON file with any of these lists: <code>rigging</code>, <code>cranes</code> + <code>charts</code>, <code>loads</code>, <code>vessels</code>, <code>rigTemplates</code> (and <code>plans</code> from a full backup). Importing adds new items and updates ones with the same id or name – nothing else is removed.</p>
    <p>Rigging rows can be as simple as <code>{"type": "shackle", "name": "Green Pin 35 t", "swl_t": 35, "weight_kg": 18.8, "cert": "GP-1234"}</code> – slings take <code>kg_per_m</code>, beams take <code>length_m</code>. Send Claude your certificate register or spreadsheet and ask for a LiftPlan master data file – then import it here. No new version of the app is needed.</p></details>
</div></dialog>`);
function renderMaster() {
  const m = masterData(), c = [["Rigging items", m.rigging.length], ["Cranes", m.cranes.length], ["Load charts", m.charts.length], ["Loads", m.loads.length], ["Vessels", m.vessels.length], ["Rigging set-ups", m.rigTemplates.length]];
  $("mdCounts").innerHTML = c.map(([k, v]) => `<div class="kpi3"><b>${v}</b><span>${k}</span></div>`).join("");
}
function openMaster() { renderMaster(); $("mdStatus").hidden = true; $("dMaster").showModal(); }
$("mdExport").onclick = async () => {
  if (!CAP.downloads) { toast("Saving files isn't available in this view."); return; }
  try { await CAP.downloads.save({ filename: "LiftPlan_master_data_" + new Date().toISOString().slice(0, 10) + ".json", data: JSON.stringify(masterData(), null, 1), mimeType: "application/json" }); toast("Master data saved"); } catch (e) { toast("Couldn't save"); }
};
$("mdImport").onclick = () => $("mdFile").click();
$("mdFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  const st = $("mdStatus"); st.hidden = false; st.className = "status busy"; st.textContent = "Importing…";
  let d; try { d = JSON.parse(await f.text()); } catch (err) { st.className = "status bad"; st.textContent = "That file isn't valid JSON."; return; }
  if (Array.isArray(d)) d = { rigging: d };   // a bare list = rigging items
  try {
    const n = await importMaster(d); if (!n) return;
    const parts = mdCount(n) ? [mdCount(n)] : [];
    st.className = "status ok"; st.textContent = parts.length ? `Imported ${parts.join(", ")}${n.skipped ? ` · ${n.skipped} row(s) skipped (missing name / SWL / id)` : ""}.` : "Nothing to import in that file.";
    setTimeout(renderMaster, 600);
  } catch (err) { st.className = "status bad"; st.textContent = "Import stopped (" + (err.code || err.message || err) + ")"; }
};
// a full backup now carries every library too, and the old restore accepts master data files
{ const b = $("bBackup"); if (b) b.onclick = async () => {
    const strip = p => { const d = clone(p); if (d.site?.bg && !CAP.local) delete d.site.bg.url; return d; };
    if (!CAP.downloads) { toast("Saving files isn't available in this view."); return; }
    const data = { liftplanBackup: 1, ...masterData(), plans: planIndex.map(strip) };
    try { await CAP.downloads.save({ filename: "LiftPlan_backup_" + new Date().toISOString().slice(0, 10) + ".json", data: JSON.stringify(data), mimeType: "application/json" }); toast("Backup saved – plans and every library"); } catch (e) { toast("Couldn't save the backup"); }
  }; }
{ const inp = $("restoreFile"), _ch = inp.onchange; inp.onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    let d = null; try { d = JSON.parse(await f.text()); } catch (err) { }
    if (d && (d.liftplanMaster || (d.liftplanBackup && (d.rigging || d.loads || d.vessels)))) { e.target.value = ""; const n = await importMaster(d); if (n) toast(`Imported ${mdCount(n) || "nothing"}`); return; }
    return _ch.call(inp, e);
  }; }
// entry points: the Lift plans dialog and the home page tools
{ const row = $("bBackup")?.parentElement; if (row) row.insertAdjacentHTML("beforeend", `<button id="bMaster">Master data…</button>`); $("bMaster").onclick = () => { $("dPlans").close(); openMaster(); }; }
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-dgo='master']"); if (b) { $("dStart").close(); openMaster(); } });
