// ================= Sheet preview before the PDF is saved =================
// Export → Full lift plan – PDF opens the sheets first. On a rigging arrangement sheet you can drag a callout label,
// drag its point onto the right part, and double-click a callout to change its words. Your changes are kept with the
// load, so the next export starts from them; "Reset this sheet" goes back to the app's own layout.
(() => {
  const css = document.createElement("style");
  css.textContent = `#dPrev{width:min(1500px,97vw);max-width:97vw}#dPrev .db{display:flex;flex-direction:column;gap:10px}
#pvBar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}#pvPages{display:flex;flex-wrap:wrap;gap:4px}#pvPages button{font-size:12px;padding:4px 8px}#pvPages button[aria-pressed="true"]{background:var(--accent);color:#fff;border-color:var(--accent)}
#pvView{position:relative;border:1px solid var(--line);background:#fff;overflow:auto;max-height:72vh}#pvView>svg{display:block;width:100%;height:auto}
#pvView.edit [data-kind="label"]{cursor:move}#pvView.edit [data-kind="anchor"]{cursor:crosshair}#pvView.edit [data-kind="label"]:hover text{fill:#0b5cad}
#pvEd{position:absolute;z-index:5;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.2);padding:8px;display:none;width:360px}#pvEd textarea{width:100%;min-height:70px;font:13px Arial}`;
  document.head.append(css);
  const dlg = document.createElement("dialog"); dlg.id = "dPrev";
  dlg.innerHTML = `<div class="dh"><b>Check the sheets before saving</b><button data-close>Close</button></div><div class="db">
    <div id="pvBar"><div id="pvPages"></div><span class="sp" style="flex:1"></span><button id="pvNotes" title="Your own notes – one per line, shown in the notes column">Notes…</button><button id="pvReset" title="Put this sheet back the way the app drew it">Reset this sheet</button><button class="pri" id="pvSave">Save PDF</button></div>
    <p class="small" id="pvTip" style="margin:0"></p>
    <div id="pvWrap" style="position:relative"><div id="pvView"></div><div id="pvEd"><textarea id="pvTxt"></textarea><div class="btnrow" style="margin-top:6px"><button class="pri" id="pvTxtOk">Use this text</button><button id="pvTxtAuto">App's text</button><button id="pvTxtX">Cancel</button></div></div></div>
    <p class="small" id="pvMsg" style="margin:0"></p></div>`;
  document.body.append(dlg);
  dlg.querySelector("[data-close]").onclick = () => dlg.close();
  const PV = { sheets: [], i: 0, ctx: new Map() };
  const loadById = id => plan.lifts.flatMap(L => L.loads).find(l => l.id === id) || plan.loads.find(l => l.id === id);
  const liftOfLoad = id => plan.lifts.findIndex(L => L.loads.some(l => l.id === id));
  // remember each rigging sheet's title-block context so a reset redraws it the same
  { const _r = rigSheetSVG; rigSheetSVG = function (ld, ...a) { if (PV.building && ld) PV.ctx.set(ld.id, sheetCtx ? { ...sheetCtx } : null); return _r.call(this, ld, ...a); }; }
  const svgEl = () => $("pvView").querySelector("svg");
  const edits = ld => { ld.sheetEdits = ld.sheetEdits || { co: {} }; ld.sheetEdits.co = ld.sheetEdits.co || {}; return ld.sheetEdits.co; };
  function show(i) {
    PV.i = Math.max(0, Math.min(PV.sheets.length - 1, i));
    const sh = PV.sheets[PV.i]; $("pvView").innerHTML = sh.svg; $("pvEd").style.display = "none";
    $("pvPages").querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-pressed", String(k === PV.i)));
    const id = svgEl()?.getAttribute("data-ld"), ed = !!id;
    $("pvView").classList.toggle("edit", ed); $("pvReset").disabled = !ed || !(loadById(id)?.sheetEdits || [...(svgEl()?.querySelectorAll("[data-ed]") || [])].some(el => plan.meta?.sheetText?.[el.getAttribute("data-ed")] != null));
    $("pvTip").textContent = ed ? "Drag a callout label to move it · drag its dot onto the right part · double-click a callout to change its words." : "This sheet is drawn from the plan – change the plan to change it.";
    if (ed) { wire(id); wireEd(); $("pvTip").textContent = "Drag a callout label to move it · drag its dot onto the right part · double-click any text to change its words."; }
    else if (svgEl()?.querySelector("[data-ed]")) { $("pvTip").textContent = "Double-click any figure or note to change its words – the plan's data is not changed. “App's text” puts it back."; $("pvReset").disabled = !svgEl().querySelector("[data-ed]") || ![...svgEl().querySelectorAll("[data-ed]")].some(el => plan.meta?.sheetText?.[el.getAttribute("data-ed")] != null); wireEd(); }
  }
  // sheets drawn from the plan's figures (crane data, calculations): any marked text can be reworded for this PDF
  function regen() { const sh = PV.sheets[PV.i], lid = svgEl()?.getAttribute("data-ld"); if (lid && loadById(lid)) { redraw(loadById(lid)); return; } if (sh && sh.regen) { try { sh.svg = sh.regen(); } catch (e) { console.warn(e); } } show(PV.i); }
  function wireEd() {
    const svg = svgEl(); if (!svg) return;
    svg.addEventListener("dblclick", e => {
      const hit = document.elementFromPoint(e.clientX, e.clientY); if (hit && hit.closest && hit.closest("[data-kind='label']")) return; const el = hit && hit.closest && hit.closest("[data-ed]"); if (!el) return;
      const key = el.getAttribute("data-ed"), auto = el.getAttribute("data-auto") || "", cur = plan.meta?.sheetText?.[key];
      const ed = $("pvEd"), host = $("pvWrap").getBoundingClientRect(), r = el.getBoundingClientRect();
      ed.style.left = Math.max(0, Math.min(host.width - 370, r.left - host.left)) + "px"; ed.style.top = (r.bottom - host.top + 6) + "px"; ed.style.display = "block";
      $("pvTxt").value = cur != null ? cur : auto; $("pvTxt").focus();
      const put = t => { plan.meta = plan.meta || {}; plan.meta.sheetText = plan.meta.sheetText || {}; if (t == null) delete plan.meta.sheetText[key]; else plan.meta.sheetText[key] = t; markDirty(); ed.style.display = "none"; regen(); };
      $("pvTxtOk").onclick = () => put($("pvTxt").value); $("pvTxtAuto").onclick = () => put(null); $("pvTxtX").onclick = () => { ed.style.display = "none"; };
    });
  }
  function pages() { $("pvPages").innerHTML = PV.sheets.map((s, k) => `<button data-pg="${k}">${k + 1}. ${escH(s.name.replace(/^\d+_/, "").replace(/_/g, " ").slice(0, 38))}</button>`).join(""); $("pvPages").querySelectorAll("[data-pg]").forEach(b => b.onclick = () => { keep(); show(+b.dataset.pg); }); }
  const keep = () => { const s = svgEl(); if (s) PV.sheets[PV.i].svg = s.outerHTML; };
  const pt = (svg, e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  function leadOf(svg, co) { return svg.querySelector(`[data-co="${co}"][data-kind="lead"] polyline`); }
  function wire(ldId) {
    const svg = svgEl(), ld = loadById(ldId); if (!svg || !ld) return;
    let drag = null;
    svg.addEventListener("pointerdown", e => {
      const el = e.target.closest("[data-kind='label'],[data-kind='anchor']"); if (!el) return;
      e.preventDefault(); const co = el.getAttribute("data-co"), kind = el.getAttribute("data-kind"), p0 = pt(svg, e), pl = leadOf(svg, co);
      const P = pl ? pl.getAttribute("points").trim().split(/\s+/).map(q => q.split(",").map(Number)) : null;
      drag = { el, co, kind, p0, P, dx: 0, dy: 0, tx: +el.dataset.tx || 0, ty: +el.dataset.ty || 0 }; svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener("pointermove", e => {
      if (!drag) return; const p = pt(svg, e); drag.dx = p.x - drag.p0.x; drag.dy = p.y - drag.p0.y;
      if (drag.kind === "label") drag.el.setAttribute("transform", `translate(${drag.tx + drag.dx} ${drag.ty + drag.dy})`);
      else { drag.el.setAttribute("cx", +drag.P?.[0][0] + drag.dx); drag.el.setAttribute("cy", +drag.P?.[0][1] + drag.dy); }
      const pl = leadOf(svg, drag.co); if (pl && drag.P) { const Q = drag.P.map(q => [...q]); if (drag.kind === "label") for (let k = 1; k < Q.length; k++) { Q[k][0] += drag.dx; Q[k][1] += drag.dy; } else { Q[0][0] += drag.dx; Q[0][1] += drag.dy; } pl.setAttribute("points", Q.map(q => q.join(",")).join(" ")); }
    });
    const end = () => {
      if (!drag) return; const d = drag; drag = null; if (Math.hypot(d.dx, d.dy) < 1) return;
      const o = edits(ld)[d.co] = { ...(edits(ld)[d.co] || {}) };
      if (d.kind === "label") { o.dx = (+o.dx || 0) + d.dx; o.dy = (+o.dy || 0) + d.dy; d.el.dataset.tx = d.tx + d.dx; d.el.dataset.ty = d.ty + d.dy; } else { o.ax = (+o.ax || 0) + d.dx; o.ay = (+o.ay || 0) + d.dy; }
      markDirty(); $("pvReset").disabled = false; keep();
    };
    svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
    svg.addEventListener("dblclick", e => {
      const hit = document.elementFromPoint(e.clientX, e.clientY), el = hit && hit.closest && hit.closest("[data-kind='label']"); if (!el) return;
      const co = el.getAttribute("data-co"), o = edits(ld)[co] || {}, auto = el.getAttribute("data-auto") || "";
      const ed = $("pvEd"), host = $("pvWrap").getBoundingClientRect(), r = el.getBoundingClientRect();
      ed.style.left = Math.max(0, Math.min(host.width - 370, r.left - host.left)) + "px"; ed.style.top = (r.bottom - host.top + 6) + "px"; ed.style.display = "block";
      $("pvTxt").value = o.text != null ? o.text : auto; $("pvTxt").focus();
      const put = text => { const oo = edits(ld)[co] = { ...(edits(ld)[co] || {}) }; if (text == null) delete oo.text; else oo.text = text; markDirty(); redraw(ld); ed.style.display = "none"; };
      $("pvTxtOk").onclick = () => put($("pvTxt").value); $("pvTxtAuto").onclick = () => put(null); $("pvTxtX").onclick = () => { ed.style.display = "none"; };
    });
  }
  // redraw one rigging sheet from the load (after a wording change or a reset)
  function redraw(ld) {
    const i = liftOfLoad(ld.id), keepC = sheetCtx; sheetCtx = PV.ctx.get(ld.id) || null;
    try { let svg = i >= 0 ? withLift(i, () => rigSheetSVG(ld)) : rigSheetSVG(ld); if (svg) { const sh = PV.sheets[PV.i], k = PV.i; if (sh.base) svg = ssAllEd(svg.replace(/(>SHEET<\/text><text [^>]*>)[^<]*(<\/text>)/, `$1${k + 1} of ${PV.sheets.length}$2`), sh.base); sh.svg = svg; show(PV.i); } } finally { sheetCtx = keepC; }
  }
  $("pvNotes").onclick = () => { const ed = $("pvEd"); ed.style.left = "0px"; ed.style.top = "0px"; ed.style.display = "block"; $("pvTxt").value = plan.meta?.notes || ""; $("pvTxt").placeholder = "One note per line"; $("pvTxt").focus();
    const put = async t => { plan.meta = plan.meta || {}; if (t == null) delete plan.meta.notes; else plan.meta.notes = t; markDirty(); ed.style.display = "none"; $("pvMsg").textContent = "Updating the sheets…"; const i = PV.i; PV.building = true; try { PV.sheets = await buildSheets(); } finally { PV.building = false; } pages(); show(i); $("pvMsg").textContent = ""; };
    $("pvTxtOk").onclick = () => put($("pvTxt").value); $("pvTxtAuto").onclick = () => put(null); $("pvTxtX").onclick = () => { ed.style.display = "none"; }; };
  $("pvReset").onclick = () => { const s0 = svgEl(); if (s0 && !s0.getAttribute("data-ld") && s0.querySelector("[data-ed]")) { s0.querySelectorAll("[data-ed]").forEach(el => { if (plan.meta?.sheetText) delete plan.meta.sheetText[el.getAttribute("data-ed")]; }); markDirty(); regen(); return; }
    const id = svgEl()?.getAttribute("data-ld"), ld = id && loadById(id); if (!ld) return; s0?.querySelectorAll("[data-ed]").forEach(el => { if (plan.meta?.sheetText) delete plan.meta.sheetText[el.getAttribute("data-ed")]; }); delete ld.sheetEdits; markDirty(); redraw(ld); };
  $("pvSave").onclick = async () => {
    keep(); $("pvMsg").textContent = "Saving…";
    try { const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
      for (let k = 0; k < PV.sheets.length; k++) { const c = await sheetCanvas(PV.sheets[k].svg); if (k) pdf.addPage("a3", "landscape"); pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 420, 297); }
      await save(fbase() + ".pdf", pdf.output("blob")); $("pvMsg").textContent = "PDF saved."; }
    catch (err) { console.warn(err); $("pvMsg").textContent = "Couldn't make the PDF – try the PNG sheets."; }
  };
  // Export → PDF opens the preview first
  const b = $("xPdf");
  if (b) b.addEventListener("click", async e => {
    e.stopImmediatePropagation(); e.preventDefault();
    if (!window.jspdf) { $("xMsg").textContent = "PDF library didn't load – use PNG."; return; }
    $("xMsg").textContent = "Rendering…"; PV.ctx.clear(); PV.building = true;
    try { PV.sheets = await buildSheets(progress); } finally { PV.building = false; }
    if (!PV.sheets.length) { $("xMsg").textContent = "Nothing to export yet."; return; }
    $("xMsg").textContent = ""; $("dExport").close(); pages(); $("pvMsg").textContent = ""; dlg.showModal(); show(0);
  }, true);
})();
