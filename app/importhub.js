// ================= One import for everything =================
// Drop or choose any PDF / photo. The app works out what it is – site layout, load, vessel, crane load chart or
// rigging item – and hands it to the builder that turns it into the app's own model. Every builder works the same way:
// read the upload → build the model → show what it found → you check, correct and lock. The upload stays only as a reference.
const IH = { files: [], cat: null, why: "", busy: false, thumb: null };
const IH_CATS = [
  { k: "site", name: "Site layout", sub: "Plan, CAD drawing, aerial photo → quay deck, buildings, stacks, roads", plan: true },
  { k: "load", name: "Load", sub: "Photo, GA or lifting drawing → a 3D load with weight and lifting points", plan: true },
  { k: "vessel", name: "Vessel", sub: "GA, spec sheet or photo → a vessel with its deck (and cranes)", plan: true },
  { k: "crane", name: "Crane load chart", sub: "Manufacturer chart or spec sheet → a crane in the library" },
  { k: "rigging", name: "Rigging item", sub: "Certificate, drawing or photo → an item in the rigging library" }
];
const IH_PROMPT = `Look at this document or photo. It was uploaded to a crane lift planning app. Which ONE of these is it?
"site" – a site / yard / port / quay layout plan, CAD drawing of an area, map or aerial photo of a site
"load" – an item to be lifted (reel, pipe, container, tank, module, machine, bulk bag…): photo, general arrangement or lifting drawing
"vessel" – a ship / PSV / barge: general arrangement, deck plan, spec sheet or photo of a vessel
"crane" – a crane load chart, crane spec sheet or crane brochure
"rigging" – a sling, shackle, spreader beam, hook, chain or other lifting gear: certificate, data sheet, drawing or photo
Return JSON only: {"category": "site"|"load"|"vessel"|"crane"|"rigging"|"other", "confidence": 0 to 1, "what": "a few words saying what it is, e.g. 'SSB quay layout 1:500 by Herbosh-Kier'"}`;
document.body.insertAdjacentHTML("beforeend", `
<dialog id="dImport" style="width:min(720px,96vw)"><div class="dh"><div><b>Import</b><div class="small">A drawing, PDF or photo – the app builds it into a site, load, vessel, crane or rigging item</div></div><button data-close>Close</button></div>
<div class="db" style="display:flex;flex-direction:column;gap:12px">
  <div id="ihDrop" class="ihdrop"><b>Drop a PDF, photo or LiftPlan data file (.json) here</b><span class="small">or</span><button class="pri" id="ihPick">Choose file…</button><input type="file" id="ihFile" accept="application/pdf,image/*,.json,application/json" multiple hidden></div>
  <div id="ihBody"></div>
</div></dialog>`);
function openImport(files) {
  IH.files = []; IH.cat = null; IH.why = ""; IH.thumb = null; $("ihBody").innerHTML = ""; $("ihDrop").hidden = false;
  if (!$("dImport").open) $("dImport").showModal();
  if (files && files.length) ihTake(files);
}
$("ihPick").onclick = () => $("ihFile").click();
$("ihFile").onchange = e => { const f = [...e.target.files]; e.target.value = ""; if (f.length) ihTake(f); };
{ const d = $("ihDrop");
  d.addEventListener("dragover", e => { e.preventDefault(); d.classList.add("on"); });
  d.addEventListener("dragleave", () => d.classList.remove("on"));
  d.addEventListener("drop", e => { e.preventDefault(); d.classList.remove("on"); const f = [...e.dataTransfer.files].filter(ihOk); if (f.length) ihTake(f); }); }
const ihJson = f => /\.json$/i.test(f.name) || f.type === "application/json";
const ihOk = f => f.type === "application/pdf" || f.type.startsWith("image/") || ihJson(f);
// a LiftPlan data file (backup, master data, site template, plan) goes straight to the data import
function ihData(f) { if ($("dImport").open) $("dImport").close(); ihFeed("restoreFile", [f]); }
// guess without Claude: the file name and, for a PDF, whether it is a line drawing with a scale
async function ihGuess(files) {
  const n = files.map(f => f.name).join(" ").toLowerCase();
  const by = [[/layout|plan d|site|yard|quay|quai|berth|base|implantation|masse|aerial|google/, "site"], [/chart|ltm|gmk|grove|liebherr|tadano|demag|crane|grue|xca|codex/, "crane"], [/vessel|ship|psv|barge|navire|\bga\b|general arrangement/, "vessel"], [/shackle|sling|elingue|manille|spreader|palonnier|hook|crochet|chain|certificate|certif/, "rigging"], [/reel|touret|load|colis|pipe|tube|container|silo|tank|module/, "load"]];
  for (const [re, k] of by) if (re.test(n)) return { cat: k, why: "from the file name" };
  const f = files[0];
  if (f.type === "application/pdf" && window.pdfjsLib) {
    try { const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise, pg = await pdf.getPage(1), ops = await pg.getOperatorList(), t = (await pg.getTextContent()).items.map(x => x.str).join(" ");
      const vec = ops.fnArray.filter(x => x === pdfjsLib.OPS.constructPath).length;
      if (vec > 50 && /1\s*[:\/]\s*\d{2,5}/.test(t)) return { cat: "site", why: "a scaled line drawing" };
      if (/SWL|WLL|CMU|safe working load/i.test(t)) return { cat: "rigging", why: "it mentions a working load limit" };
      if (/outrigger|counterweight|boom|radius|stabilisateur|fl[èe]che/i.test(t)) return { cat: "crane", why: "it reads like a load chart" };
    } catch (e) { }
  }
  return { cat: null, why: "" };
}
async function ihTake(files) {
  const j = files.find(ihJson); if (j) { ihData(j); return; }
  IH.files = files; IH.busy = true; $("ihDrop").hidden = true; ihRender("Working out what this is…");
  try {
    const imgs = await toImages(files.slice(0, 2)); IH.thumb = imgs[0] ? URL.createObjectURL(imgs[0]) : null; ihRender("Working out what this is…");
    let g = null;
    if (CAP.sample && CAP.sampleImages && imgs.length) {
      try { const r = await CAP.sample.json(IH_PROMPT, { images: imgs.slice(0, 1) }); if (r && IH_CATS.some(c => c.k === r.category)) g = { cat: r.category, why: r.what || "" }; else if (r && r.what) g = { cat: null, why: r.what }; } catch (e) { console.warn(e); }
    }
    if (!g || !g.cat) { const h = await ihGuess(files); g = { cat: h.cat, why: g?.why || h.why }; }
    IH.cat = g.cat; IH.why = g.why;
  } catch (e) { IH.why = "Couldn't preview it (" + (e.message || e) + ")"; }
  IH.busy = false; ihRender();
}
function ihRender(busyMsg) {
  const C = IH_CATS.find(c => c.k === IH.cat), needPlan = C && C.plan && typeof planStarted !== "undefined" && !planStarted;
  $("ihBody").innerHTML = `<div class="ihgrid">
    <div class="ihthumb">${IH.thumb ? `<img src="${IH.thumb}">` : `<span class="small">${escH(IH.files.map(f => f.name).join(", "))}</span>`}</div>
    <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
      <div class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escH(IH.files.map(f => f.name).join(", "))}">${escH(IH.files.map(f => f.name).join(", "))}</div>
      ${busyMsg ? `<p class="status busy" style="margin:0">${escH(busyMsg)}</p>` : `<p style="margin:0">${C ? `This is a <b>${escH(C.name.toLowerCase())}</b>${IH.why ? ` – ${escH(IH.why)}` : ""}.` : `What is it?${IH.why ? ` <span class="small">(${escH(IH.why)})</span>` : ""}`}</p>
      <div class="ihcats">${IH_CATS.map(c => `<button data-ihc="${c.k}" aria-pressed="${c.k === IH.cat}"><b>${c.name}</b><span>${c.sub}</span></button>`).join("")}</div>
      ${needPlan ? `<p class="small" style="margin:0;color:var(--bad)">Create or open a lift plan first – a ${escH(C.name.toLowerCase())} goes into a plan.</p>` : ""}
      <div class="btnrow"><button class="pri" id="ihGo" ${C && !needPlan ? "" : "disabled"}>Build it ›</button><button id="ihOther">Another file…</button></div>`}
    </div></div>`;
  $("ihBody").querySelectorAll("[data-ihc]").forEach(b => b.onclick = () => { IH.cat = b.dataset.ihc; ihRender(); });
  if ($("ihGo")) $("ihGo").onclick = () => ihRoute(IH.cat, IH.files);
  if ($("ihOther")) $("ihOther").onclick = () => openImport();
}
// hand the files to a builder's own file input, exactly as if they'd been chosen there
function ihFeed(inputId, files) { const inp = $(inputId), dt = new DataTransfer(); files.forEach(f => dt.items.add(f)); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true })); }
function ihRoute(cat, files) {
  $("dImport").close();
  if (cat === "site") { if (typeof openSiteImport === "function") { IMPORT.auto = true; openSiteImport(); ihFeed("siFile", files.slice(0, 1)); } }
  else if (cat === "load") { openLoadBuilder(null); setTimeout(() => ihFeed("lbFile", files), 50); }
  else if (cat === "vessel") { openVesselDialog(null); setTimeout(() => ihFeed("vdFile", files), 50); }
  else if (cat === "crane") { openEditor(null); setTimeout(() => ihFeed("edFile", files), 50); }
  else if (cat === "rigging") { openRigLib(); setTimeout(() => ihFeed("rlFile", files), 50); }
}
// entry points: a header button, the home page, and dropping a file anywhere on the app
{ const b = document.createElement("button"); b.id = "bImport"; b.textContent = "⤓ Import"; b.title = "Import a drawing, PDF or photo – site, load, vessel, crane chart or rigging"; $("bSave").before(b); b.onclick = () => openImport(); }
{ const t = document.querySelector('#dStart .dtools'); if (t) { t.insertAdjacentHTML("afterbegin", `<button id="stImport"><b>Import a drawing or photo</b><span>crane chart · rigging · (site, load, vessel in a plan)</span></button>`); $("stImport").onclick = () => openImport(); } }
{
  let depth = 0;
  window.addEventListener("dragenter", e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { depth++; document.body.classList.add("ihdragging"); } });
  window.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove("ihdragging"); });
  window.addEventListener("dragover", e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) e.preventDefault(); });
  window.addEventListener("drop", e => {
    depth = 0; document.body.classList.remove("ihdragging");
    if (e.defaultPrevented || e.target.closest?.("#ihDrop")) return;
    const f = [...(e.dataTransfer?.files || [])].filter(ihOk); if (!f.length) return;
    e.preventDefault();
    const open = [...document.querySelectorAll("dialog[open]")].filter(d => d.id !== "dImport" && d.id !== "dStart");
    if (open.length) return;                         // a builder dialog is open – leave its own upload alone
    openImport(f);
  });
}
// the site route skips the extra "Import" click
{ const _ap = analysePage; analysePage = async function (...a) { const r = await _ap(...a); if (IMPORT.auto) { IMPORT.auto = false; const b = $("siGo"); if (b && !b.disabled) b.click(); } return r; }; }
{ const _sp = importPicture; importPicture = function (...a) { IMPORT.auto = false; return _sp(...a); }; }
// a LiftPlan data file (.json – plan, site, backup) picked in any upload box goes to the data import, so it is never "missing" from the picker
for (const id of ["siFile", "lbFile", "bgFile", "edFile"]) { const el = $(id); if (el && !/\.json/.test(el.accept)) el.accept += ",.json,application/json"; }
document.addEventListener("change", e => {
  const el = e.target; if (!(el instanceof HTMLInputElement) || el.type !== "file" || ["restoreFile", "mdFile", "ihFile"].includes(el.id)) return;
  const f = [...(el.files || [])].find(ihJson); if (!f) return;
  e.stopImmediatePropagation(); el.value = ""; document.querySelectorAll("dialog[open]").forEach(d => d.close()); ihData(f);
}, true);
