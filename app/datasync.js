// ================= Moving data between the online app and the offline file =================
// The two keep their own storage. A master data file or full backup carries everything across – libraries, site templates
// and plans – with the drawings and pictures INSIDE the file (the online app keeps them as uploaded assets the offline file
// can't reach, and the offline file keeps them in its own browser storage). On import they're stored the way that copy needs.
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
async function assetData(id, cache) {
  if (!id || id === "local") return null;
  if (cache.has(id)) return cache.get(id);
  let v = null; try { const r = await fetch("/_blob/" + id); if (r.ok) v = await blobToDataURL(await r.blob()); } catch (e) { }
  cache.set(id, v); return v;
}
async function cadText(cad) {
  if (!cad) return null;
  if (CADS[cad.id]) return JSON.stringify(CADS[cad.id]);
  try { if (cad.asset && !CAP.local) { const r = await fetch("/_blob/" + cad.asset); if (r.ok) return await r.text(); } } catch (e) { }
  try { if (cad.local && CAP.db) { const d = await CAP.db.doc("cad/" + cad.id).get(); if (d.exists) return d.data().json; } } catch (e) { }
  return null;
}
// pictures: {asset, url} and {photoAsset, photoUrl} pairs anywhere in a document → data URLs inside the file
async function packImages(node, cache) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const x of node) await packImages(x, cache); return; }
  if (typeof node.asset === "string") { const d = await assetData(node.asset, cache); if (d) { node.url = d; delete node.asset; } }
  if (typeof node.photoAsset === "string") { const d = await assetData(node.photoAsset, cache); if (d) { node.photoUrl = d; delete node.photoAsset; } }
  for (const [k, v] of Object.entries(node)) if (v && typeof v === "object" && k !== "cad") await packImages(v, cache);
}
async function packSite(site, cache, cadHolder) {
  if (!site) return;
  if (site.cad) { const t = cadHolder.cadJson || await cadText(site.cad); if (t) { cadHolder.cadJson = t; delete site.cad.asset; delete site.cad.local; } }
  await packImages(site, cache);
}
async function packedData(withPlans) {
  const cache = new Map(), d = { ...clone(masterData()) };
  await packImages(d.vessels, cache); await packImages(d.loads, cache);
  d.siteTemplates = [];
  for (const t0 of (typeof siteTemplates !== "undefined" ? siteTemplates : [])) { const t = clone(t0); if (!t.cadJson && t.site?.cad) t.cadJson = await stCadJson(t0); if (t.site?.cad) { delete t.site.cad.asset; delete t.site.cad.local; } await packImages(t.site, cache); await packImages(t.obstacles, cache); d.siteTemplates.push(t); }
  if (withPlans) {
    d.plans = [];
    for (const p0 of planIndex) { const p = clone(p0); if (p.id === plan.id) Object.assign(p, clone(plan)); const h = {}; await packSite(p.site, cache, h); if (h.cadJson) p.cadJson = h.cadJson; await packImages(p.obstacles, cache); await packImages(p.lifts, cache); d.plans.push(p); }
  }
  d.packed = 1;
  return d;
}
// on import: data URLs become this copy's assets (online) or stay inline (offline); drawings are stored the same way
// data: URL → Blob without fetch (the online app's sandbox may not allow fetching data: URLs)
function dataUrlBlob(u) { const i = u.indexOf(","), head = u.slice(5, i), b64 = /;base64/.test(head), mime = head.split(";")[0] || "application/octet-stream", raw = b64 ? atob(u.slice(i + 1)) : decodeURIComponent(u.slice(i + 1)), a = new Uint8Array(raw.length); for (let k = 0; k < raw.length; k++) a[k] = raw.charCodeAt(k); return new Blob([a], { type: mime }); }
async function hostImages(node) {
  if (!node || typeof node !== "object" || CAP.local || !CAP.assets) return;
  if (Array.isArray(node)) { for (const x of node) await hostImages(x); return; }
  const up = async (dataUrl, name) => { const b = dataUrlBlob(dataUrl); const a = await CAP.assets.upload(new File([b], name, { type: b.type || "image/jpeg" })); return a.id; };
  try { if (typeof node.url === "string" && node.url.startsWith("data:")) { node.asset = await up(node.url, "image.jpg"); node.url = "/_blob/" + node.asset; } } catch (e) { console.warn(e); }
  try { if (typeof node.photoUrl === "string" && node.photoUrl.startsWith("data:")) { node.photoAsset = await up(node.photoUrl, "photo.jpg"); node.photoUrl = "/_blob/" + node.photoAsset; } } catch (e) { console.warn(e); }
  for (const [k, v] of Object.entries(node)) if (v && typeof v === "object") await hostImages(v);
}
async function hostCad(cad, json) {
  if (!cad || !json) return;
  CADS[cad.id] = JSON.parse(json);
  try {
    if (CAP.assets && !CAP.local) { const a = await CAP.assets.upload(new File([json], cad.id + ".json", { type: "application/json" })); cad.asset = a.id; delete cad.local; }
    else if (CAP.db) { await CAP.db.doc("cad/" + cad.id).set({ json }); cad.local = true; delete cad.asset; }
  } catch (e) { console.warn(e); }
}
{ const _im = importMaster; importMaster = async function (d) {
    if (!CAP.db) return _im(d);
    await hostImages(d.vessels); await hostImages(d.loads);
    for (const p of d.plans || []) { if (p.cadJson && p.site?.cad) { await hostCad(p.site.cad, p.cadJson); delete p.cadJson; } await hostImages(p.site); await hostImages(p.obstacles); await hostImages(p.lifts); if (p.site?.bg?.asset && !CAP.local) delete p.site.bg.url; }
    const n = await _im(d);
    let nt = 0;
    for (const t of d.siteTemplates || []) {
      if (!t.id || !t.site) continue; const doc = clone(t);
      await hostImages(doc.site); await hostImages(doc.obstacles);
      if (doc.cadJson && CAP.assets && !CAP.local) { try { const a = await CAP.assets.upload(new File([doc.cadJson], (doc.site.cad?.id || "cad") + ".json", { type: "application/json" })); doc.site.cad.asset = a.id; delete doc.cadJson; } catch (e) { } }
      try { await CAP.db.doc("siteTemplates/" + t.id).set(doc); nt++; } catch (e) { const list = stLoadLocal().filter(x => x.id !== t.id).concat([doc]); if (stSaveLocal(list)) nt++; }
    }
    if (n) n.siteTemplates = nt;
    if (typeof stRefresh === "function") try { stRefresh(); } catch (e) { }
    return n;
  }; }
// export / backup carry the site templates and the drawings + pictures themselves
$("mdExport").onclick = async () => {
  if (!CAP.downloads) { toast("Saving files isn't available in this view."); return; }
  const st = $("mdStatus"); st.hidden = false; st.className = "status busy"; st.textContent = "Packing libraries, site templates, drawings and pictures…";
  try { const d = await packedData(false); await CAP.downloads.save({ filename: "LiftPlan_master_data_" + new Date().toISOString().slice(0, 10) + ".json", data: JSON.stringify(d), mimeType: "application/json" }); st.className = "status ok"; st.textContent = `Saved – ${d.siteTemplates.length} site template${d.siteTemplates.length === 1 ? "" : "s"} included with their drawings. Import it in the other copy (online or offline).`; }
  catch (e) { st.className = "status bad"; st.textContent = "Couldn't save (" + (e.code || e.message || e) + ")"; }
};
{ const b = $("bBackup"); if (b) b.onclick = async () => {
    if (!CAP.downloads) { toast("Saving files isn't available in this view."); return; }
    toast("Packing plans, libraries, drawings and pictures…");
    try { const d = { liftplanBackup: 1, ...(await packedData(true)) }; await CAP.downloads.save({ filename: "LiftPlan_backup_" + new Date().toISOString().slice(0, 10) + ".json", data: JSON.stringify(d), mimeType: "application/json" }); toast(`Backup saved – ${d.plans.length} plans, every library and ${d.siteTemplates.length} site templates, drawings included`); }
    catch (e) { toast("Couldn't save the backup (" + (e.code || e.message || e) + ")"); }
  }; }
{ const _rm = renderMaster; renderMaster = function () { _rm(); try { const n = (typeof siteTemplates !== "undefined" ? siteTemplates.length : 0); $("mdCounts").insertAdjacentHTML("beforeend", `<div class="kpi3"><b>${n}</b><span>Site templates</span></div>`); } catch (e) { } }; }
