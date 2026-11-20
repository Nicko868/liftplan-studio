// ================= Site import: PDF drawings (vector linework, exact scale) and photos / screenshots =================
// A CAD PDF is read as real lines at the drawing scale (not a picture). Closed shapes and long lines become
// candidates that you turn into site objects (buildings, quay edge, stacks…) in the review panel.
// Photos / screenshots stay a picture; you set the scale, then trace (by hand, or with Claude in the Claude version).
const CADS = {};            // id -> {paths:[{p:[x,y,...], c:bool}], texts:[[x,y,size,rot,str]], bbox}
let cadPathCache = { id: null, v: -1, d: "", t: "" };
const IMPORT = { file: null, pdf: null, page: 1, vec: 0, scale: 500, texts: [], kind: "cad" };
const A_SIZES = { 0: 1189, 1: 841, 2: 594, 3: 420, 4: 297 };

// ---------- dialog ----------
document.body.insertAdjacentHTML("beforeend", `
<dialog id="dSite" style="width:min(820px,96vw)"><div class="dh"><div><b>Import the site layout</b><div class="small">PDF drawing, photo or screenshot – it becomes the site you plan the lift in</div></div><button data-close>Close</button></div><div class="db" style="display:flex;flex-direction:column;gap:10px">
  <div class="btnrow"><button class="pri" id="siPick">Choose PDF, photo or screenshot…</button><input type="file" id="siFile" accept="application/pdf,image/png,image/jpeg,image/webp" hidden><span class="small" id="siName"></span></div>
  <div id="siBody"></div>
</div></dialog>`);
function openSiteImport() { IMPORT.file = null; IMPORT.pdf = null; $("siName").textContent = ""; $("siBody").innerHTML = `<div class="card" style="padding:12px"><p class="small" style="margin:0"><b>CAD / PDF drawings</b> are read as real lines at the drawing's scale – exact, and you can turn the buildings, quay edge, stacks and roads into objects.<br><b>Photos, aerial / Google Earth screenshots and scans</b> are placed as a picture: you set the scale with two points a known distance apart, then trace the objects${CAP.sample ? " (or let Claude trace them)" : ""}.<br>Phone photos taken at an angle are fine as a reference, but distances on them aren't reliable.</p></div>`; $("dSite").showModal(); }
$("siPick").onclick = () => $("siFile").click();
$("siFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  IMPORT.file = f; $("siName").textContent = f.name;
  if (f.type !== "application/pdf") { $("dSite").close(); importPicture(f); return; }
  if (!window.pdfjsLib) { $("siBody").innerHTML = `<p class="status bad">The PDF reader didn't load.</p>`; return; }
  $("siBody").innerHTML = `<p class="status busy">Reading the PDF…</p>`;
  try { IMPORT.pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise; IMPORT.page = 1; await analysePage(); }
  catch (err) { $("siBody").innerHTML = `<p class="status bad">Couldn't read that PDF (${escH(err.message || err)}).</p>`; }
};
async function analysePage() {
  const pg = await IMPORT.pdf.getPage(IMPORT.page), vp = pg.getViewport({ scale: 1 });
  const ops = await pg.getOperatorList(), O = pdfjsLib.OPS;
  IMPORT.vec = ops.fnArray.filter(f => f === O.constructPath).length;
  const tc = await pg.getTextContent(); IMPORT.texts = tc.items.filter(t => (t.str || "").trim());
  const all = IMPORT.texts.map(t => t.str).join(" ");
  const sc = [...all.matchAll(/1\s*[:\/]\s*(\d{2,5})(?:\s*@\s*A\s*([0-4]))?/g)].map(m => ({ den: +m[1], a: m[2] }));
  const best = sc.sort((a, b) => sc.filter(x => x.den === b.den).length - sc.filter(x => x.den === a.den).length)[0];
  IMPORT.scale = best ? best.den : (IMPORT.scale || 500); IMPORT.scaleFrom = best ? "drawing" : "";
  IMPORT.nts = /\bS\s*\/\s*E\b|\bN\.?T\.?S\.?\b|sans [ée]chelle|not to scale/i.test(all);
  IMPORT.printed = best ? best.den : null;
  if (IMPORT.vec >= 3) { try {
    const raw = pdfVectors(ops, 80000), dm = scaleFromDimensions(raw.paths, IMPORT.texts);
    if (dm && (!best || Math.abs(dm.den - best.den) / best.den > 0.015)) { IMPORT.scale = dm.den; IMPORT.scaleFrom = `${dm.n} dimensions printed on it`; }
    else if (dm) IMPORT.scaleFrom = `drawing – confirmed by ${dm.n} dimensions`;
    else if (!best) { const c = scaleFromContainers(raw.paths); if (c) { IMPORT.scale = c.den; IMPORT.scaleFrom = `${c.n} containers`; } }
  } catch (e) { console.warn(e); } }
  const longMm = Math.max(vp.width, vp.height) * 25.4 / 72;
  IMPORT.paperFix = best && best.a != null && A_SIZES[best.a] ? A_SIZES[best.a] / longMm : 1; if (Math.abs(IMPORT.paperFix - 1) < 0.02) IMPORT.paperFix = 1;
  IMPORT.kind = IMPORT.vec >= 3 ? "cad" : "pic";
  const c = document.createElement("canvas"), k = Math.min(1.2, 700 / Math.max(vp.width, vp.height)), v2 = pg.getViewport({ scale: k }); c.width = v2.width; c.height = v2.height;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); await pg.render({ canvasContext: g, viewport: v2 }).promise;
  $("siBody").innerHTML = `
    ${IMPORT.pdf.numPages > 1 ? `<label>Page<select id="siPage">${Array.from({ length: IMPORT.pdf.numPages }, (_, i) => `<option value="${i + 1}" ${i + 1 === IMPORT.page ? "selected" : ""}>Page ${i + 1}</option>`).join("")}</select></label>` : ""}
    <div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:12px;align-items:start">
      <img src="${c.toDataURL("image/jpeg", 0.85)}" style="width:100%;border:1px solid var(--line);border-radius:4px">
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="status ${IMPORT.vec >= 3 ? "ok" : ""}">${IMPORT.vec >= 3 ? `CAD drawing – ${IMPORT.vec.toLocaleString()} line groups found. It can be imported as exact linework.` : "This page is a scanned picture (no vector lines). It will be placed as a picture – set the scale after."}</div>
        <label class="chk"><input type="radio" name="siKind" value="cad" ${IMPORT.kind === "cad" ? "checked" : ""} ${IMPORT.vec >= 3 ? "" : "disabled"}> Import the lines (exact, recommended)</label>
        <label class="chk"><input type="radio" name="siKind" value="pic" ${IMPORT.kind === "pic" ? "checked" : ""}> Import as a picture</label>
        <label>Drawing scale 1 :<input type="number" id="siScale" value="${IMPORT.scale}" step="1" min="1"></label>
        <p class="small" style="margin:0">${/dimensions printed/.test(IMPORT.scaleFrom) ? `${best ? `The drawing says 1:${best.den}, but ` : ""}<b>${IMPORT.scaleFrom.split(" ")[0]} dimensions printed on it give 1:${IMPORT.scale}</b>${best ? " – using that" : ""}.` : /confirmed/.test(IMPORT.scaleFrom) ? `Found “1:${best.den}” on the drawing – <b>confirmed by ${IMPORT.scaleFrom.match(/\d+/)[0]} dimensions</b> printed on it.` : best ? `Found “1:${best.den}${best.a != null ? " @ A" + best.a : ""}” on the drawing.` : IMPORT.scaleFrom ? `${IMPORT.nts ? "The drawing is marked not to scale (S/E). " : "No scale printed on the drawing. "}<b>Worked out 1:${IMPORT.scale} from ${IMPORT.scaleFrom}</b> drawn on it (40 ft = 12.19 m, 20 ft = 6.06 m).` : `${IMPORT.nts ? "The drawing is marked not to scale (S/E)" : "No scale found on the drawing"} – enter it, or set it after import from a dimension you know.`}${IMPORT.paperFix !== 1 ? ` The PDF is not at A${best.a} size – corrected for that.` : ""} You can check it after import with Set scale (two points a known distance apart).</p>
        <button class="pri" id="siGo">Import</button>
      </div></div>`;
  if ($("siPage")) $("siPage").onchange = async e => { IMPORT.page = +e.target.value; $("siBody").innerHTML = `<p class="status busy">Reading page ${IMPORT.page}…</p>`; await analysePage(); };
  document.querySelectorAll('[name="siKind"]').forEach(r => r.onchange = () => IMPORT.kind = r.value);
  $("siScale").onchange = e => IMPORT.scale = +e.target.value || IMPORT.scale;
  $("siGo").onclick = async () => {
    IMPORT.scale = +$("siScale").value || IMPORT.scale;
    if (IMPORT.kind === "pic") { $("siGo").disabled = true; const img = await pdfPageToFile(IMPORT.pdf, IMPORT.page); $("dSite").close(); importPicture(img, true); return; }
    $("siGo").disabled = true; $("siGo").textContent = "Importing the lines…";
    try { await importCad(); $("dSite").close(); } catch (err) { $("siGo").disabled = false; $("siGo").textContent = "Import"; toast("Couldn't import the lines (" + (err.message || err) + ")"); }
  };
}
async function pdfPageToFile(pdf, n) {
  const pg = await pdf.getPage(n), vp0 = pg.getViewport({ scale: 1 }), k = Math.min(4, 4000 / Math.max(vp0.width, vp0.height)), vp = pg.getViewport({ scale: k });
  const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvasContext: g, viewport: vp }).promise;
  return new File([await new Promise(r => c.toBlob(r, "image/png"))], "site.png", { type: "image/png" });
}
// picture route: existing background flow (upload + two-point scale), then the review panel for tracing
function importPicture(f, fromPdf) {
  if (plan.site.cad) plan.site.cad = null;
  const inp = $("bgFile"), h = inp.onchange;
  Promise.resolve(h({ target: { files: [f] } })).then(() => setTimeout(() => {
    // with Claude available the picture is read and rebuilt as objects straight away; otherwise set the scale and trace by hand
    if (CAP.sample && CAP.sampleImages) { toast("Claude is reading the picture and building the site… (20–60 s)", 8000); $("bgAi").click(); }
    else { REV.cands = []; REV.src = "pic"; openReview(); toast("Placed as a picture – click two points a known distance apart to set the scale, then trace the objects.", 7000); }
  }, 300));
}

// ---------- vector extraction ----------
// every painted path of a PDF page in PDF points, with its stroke / fill colour (legends are colour-coded), and whether the page holds a picture
function pdfVectors(ops, maxPts = 250000) {
  const O = pdfjsLib.OPS;
  let ctm = [1, 0, 0, 1, 0, 0], sc = "", fc = ""; const st = [], paths = []; let pend = [], img = null;
  const hx = a => "#" + Array.from(a).slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(+v || 0))).toString(16).padStart(2, "0")).join("");
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const T = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
  const STROKE = new Set([O.stroke, O.closeStroke]), FILL = new Set([O.fill, O.eoFill]), BOTH = new Set([O.fillStroke, O.eoFillStroke, O.closeFillStroke, O.closeEOFillStroke]);
  const IMG = new Set([O.paintImageXObject, O.paintInlineImageXObject, O.paintImageXObjectRepeat, O.paintJpegXObject].filter(v => v != null));
  let nPts = 0;
  for (let i = 0; i < ops.fnArray.length && nPts < maxPts; i++) {
    const fn = ops.fnArray[i], a = ops.argsArray[i];
    if (fn === O.save) st.push([ctm.slice(), sc, fc]);
    else if (fn === O.restore) { const s = st.pop(); if (s) [ctm, sc, fc] = s; }
    else if (fn === O.transform) ctm = mul(ctm, a);
    else if (fn === O.setStrokeRGBColor) sc = hx(a); else if (fn === O.setFillRGBColor) fc = hx(a);
    else if (fn === O.setStrokeGray) sc = hx([a[0] * 255, a[0] * 255, a[0] * 255]); else if (fn === O.setFillGray) fc = hx([a[0] * 255, a[0] * 255, a[0] * 255]);
    else if (fn === O.paintFormXObjectBegin) { st.push([ctm.slice(), sc, fc]); if (a && a[0]) ctm = mul(ctm, a[0]); }
    else if (fn === O.paintFormXObjectEnd) { const s = st.pop(); if (s) [ctm, sc, fc] = s; }
    else if (IMG.has(fn)) { const c = [T(0, 0), T(1, 0), T(1, 1), T(0, 1)]; img = { box: [Math.min(...c.map(p => p[0])), Math.min(...c.map(p => p[1])), Math.max(...c.map(p => p[0])), Math.max(...c.map(p => p[1]))] }; }
    else if (fn === O.constructPath) {
      const sub = a[0], co = a[1]; let j = 0, cur = null, last = null;
      const flush = () => { if (cur && cur.p.length >= 4) pend.push(cur); cur = null; };
      const bez = (x0, y0, x1, y1, x2, y2, x3, y3) => { for (let t = 0.25; t <= 1.001; t += 0.25) { const u = 1 - t; const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3; cur.p.push(...T(x, y)); } };
      for (const op of sub) {
        if (op === O.moveTo) { flush(); last = [co[j], co[j + 1]]; cur = { p: [...T(co[j], co[j + 1])], c: false }; j += 2; }
        else if (op === O.lineTo) { if (!cur) cur = { p: [], c: false }; last = [co[j], co[j + 1]]; cur.p.push(...T(co[j], co[j + 1])); j += 2; }
        else if (op === O.curveTo) { if (cur && last) bez(last[0], last[1], co[j], co[j + 1], co[j + 2], co[j + 3], co[j + 4], co[j + 5]); last = [co[j + 4], co[j + 5]]; j += 6; }
        else if (op === O.curveTo2) { if (cur && last) bez(last[0], last[1], last[0], last[1], co[j], co[j + 1], co[j + 2], co[j + 3]); last = [co[j + 2], co[j + 3]]; j += 4; }
        else if (op === O.curveTo3) { if (cur && last) bez(last[0], last[1], co[j], co[j + 1], co[j + 2], co[j + 3], co[j + 2], co[j + 3]); last = [co[j + 2], co[j + 3]]; j += 4; }
        else if (op === O.closePath) { if (cur) cur.c = true; }
        else if (op === O.rectangle) { flush(); const [x, y, w, h] = [co[j], co[j + 1], co[j + 2], co[j + 3]]; j += 4; pend.push({ p: [...T(x, y), ...T(x + w, y), ...T(x + w, y + h), ...T(x, y + h)], c: true }); }
      }
      flush();
    } else if (STROKE.has(fn) || FILL.has(fn) || BOTH.has(fn)) {
      for (const q of pend) { if (!FILL.has(fn)) q.s = sc; if (!STROKE.has(fn)) q.f = fc; paths.push(q); nPts += q.p.length / 2; } pend = [];
    }
    else if (fn === O.endPath) pend = [];
  }
  return { paths, img };
}
// the dimensions printed on the drawing ("18.4 m" beside a line) give the true scale – often better than a "fit to page" scale
function scaleFromDimensions(paths, texts) {
  const segs = [];
  for (const q of paths) { const n = q.p.length / 2; for (let i = 1; i < (q.c ? n + 1 : n); i++) { const a = [q.p[2 * (i - 1)], q.p[2 * (i - 1) + 1]], b = [q.p[(2 * i) % (2 * n)], q.p[(2 * i + 1) % (2 * n)]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > 2) segs.push({ a, b, L }); } }
  if (segs.length > 60000) return null;
  const dens = [];
  for (const t of texts) {
    const m = /(\d+(?:[.,]\d+)?)\s*m\b/.exec(t.str || ""); if (!m || /\d\s*m\s*[\/²³]/.test(t.str)) continue; const v = +m[1].replace(",", "."); if (!(v > 0.5)) continue;
    const [A, B, , , e, f] = t.transform, size = Math.hypot(A, B), ang = Math.atan2(B, A), dir = [Math.cos(ang), Math.sin(ang)], w = t.width || t.str.length * size * 0.5, c = [e + dir[0] * w / 2, f + dir[1] * w / 2];
    let best = null;
    for (const s of segs) {
      const d = [(s.b[0] - s.a[0]) / s.L, (s.b[1] - s.a[1]) / s.L]; let da = Math.abs(Math.atan2(d[1], d[0]) - ang) % Math.PI; da = Math.min(da, Math.PI - da); if (da > 0.14 || s.L < w * 0.8) continue;
      const tt = ((c[0] - s.a[0]) * d[0] + (c[1] - s.a[1]) * d[1]) / s.L; if (tt < -0.05 || tt > 1.05) continue;
      const perp = Math.abs((c[0] - s.a[0]) * d[1] - (c[1] - s.a[1]) * d[0]); if (perp > Math.max(size * 4, s.L * 0.08)) continue;
      if (!best || perp < best.perp - 0.5 || (Math.abs(perp - best.perp) <= 0.5 && s.L > best.L)) best = { perp, L: s.L };
    }
    if (best) dens.push(v * 1000 / (best.L * 25.4 / 72));
  }
  if (dens.length < 3) return null;
  let grp = []; for (const d of dens) { const g = dens.filter(x => Math.abs(x - d) / d < 0.025); if (g.length > grp.length) grp = g; }
  if (grp.length < 3 || grp.length < dens.length * 0.3) return null;
  grp.sort((a, b) => a - b); const den = grp[grp.length >> 1];
  return { den: Math.round(den / 5) * 5, n: grp.length, of: dens.length };
}
// no scale printed (S/E, NTS…)? Shipping containers drawn on the plan give it: 40 ft = 12.19 m (5 : 1), 20 ft = 6.06 m (2.5 : 1)
function scaleFromContainers(paths) {
  const sat = c => { if (!c || c.length < 7) return 0; const v = [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16)); return Math.max(...v) - Math.min(...v); };
  const dens = [];
  for (const q of paths) {
    const n = q.p.length / 2; if (n < 4 || n > 5 || !(sat(q.f) > 50 || sat(q.s) > 50)) continue;
    const P = []; for (let i = 0; i < 8; i += 2) P.push([q.p[i], q.p[i + 1]]);
    const s = [0, 1, 2, 3].map(i => Math.hypot(P[(i + 1) % 4][0] - P[i][0], P[(i + 1) % 4][1] - P[i][1]));
    if (Math.abs(s[0] - s[2]) > 0.05 * s[0] || Math.abs(s[1] - s[3]) > 0.05 * s[1]) continue;
    const L = Math.max(s[0], s[1]), B = Math.min(s[0], s[1]); if (B < 1) continue; const r = L / B;
    const mm = L * 25.4 / 72;
    if (Math.abs(r - 5.0) < 0.3) dens.push(12192 / mm); else if (Math.abs(r - 2.48) < 0.18) dens.push(6058 / mm);
  }
  if (dens.length < 2) return null;
  dens.sort((a, b) => a - b);
  // the biggest group that agrees within 6 %
  let best = []; for (const d of dens) { const g = dens.filter(x => Math.abs(x - d) / d < 0.06); if (g.length > best.length) best = g; }
  if (best.length < 2) return null;
  const den = best.reduce((a, b) => a + b, 0) / best.length;
  return { den: Math.round(den / 5) * 5, n: best.length };
}
async function importCad() {
  const pg = await IMPORT.pdf.getPage(IMPORT.page);
  const ops = await pg.getOperatorList();
  const k = 25.4 / 72 / 1000 * IMPORT.scale * (IMPORT.paperFix || 1);   // metres per PDF point
  const [vx0, vy0, vx1, vy1] = pg.view, cx = (vx0 + vx1) / 2, cy = (vy0 + vy1) / 2;
  const W = (x, y) => [Math.round((x - cx) * k * 100) / 100 + Math.round(view.cx), Math.round((y - cy) * k * 100) / 100 + Math.round(view.cy)];
  const raw = pdfVectors(ops);
  const paths = raw.paths.map(q => { const p = []; for (let i = 0; i < q.p.length; i += 2) p.push(...W(q.p[i], q.p[i + 1])); const o = { p, c: q.c }; if (q.s) o.s = q.s; if (q.f) o.f = q.f; return o; });
  IMPORT.img = raw.img;
  // drop the drawing frame / title block border (paths spanning almost the whole sheet) and tiny specks
  const pw = (vx1 - vx0) * k, ph = (vy1 - vy0) * k;
  const bb = q => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < q.p.length; i += 2) { x0 = Math.min(x0, q.p[i]); x1 = Math.max(x1, q.p[i]); y0 = Math.min(y0, q.p[i + 1]); y1 = Math.max(y1, q.p[i + 1]); } return [x0, y0, x1, y1]; };
  const keep = paths.filter(q => { const b = bb(q); const w = b[2] - b[0], h = b[3] - b[1]; return !(w > pw * 0.85 && h > ph * 0.85) && (w + h) > 0.02; });
  const texts = IMPORT.texts.slice(0, 3000).map(t => { const [a, b, , , e, f] = t.transform, p = W(e, f); return [p[0], p[1], Math.round(Math.hypot(a, b) * k * 100) / 100, Math.round(Math.atan2(b, a) / D2R), t.str.trim().slice(0, 60)]; });
  const id = "cad_" + uid(), data = { paths: keep, texts };
  { const a = W(vx0, vy0), b = W(vx1, vy1); data.sheetBox = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; }
  if (typeof sheetClean === "function") try { sheetClean(data); } catch (e) { console.warn(e); }   // title block, legend, north arrow, notes off
  data.bbox = data.paths.reduce((m, q) => { const b = bb(q); return [Math.min(m[0], b[0]), Math.min(m[1], b[1]), Math.max(m[2], b[2]), Math.max(m[3], b[3])]; }, [1e9, 1e9, -1e9, -1e9]);
  CADS[id] = data;
  plan.site.cad = { id, name: IMPORT.file?.name || "drawing.pdf", page: IMPORT.page, scale: IMPORT.scale, show: true, op: 0.9, n: data.paths.length };
  plan.site.cad.scaleFrom = IMPORT.scaleFrom || "";
  await saveCad(id, data);
  plan.site.bg = null;
  // a drawing printed over an aerial photo: keep the whole page as the "original" picture, lined up with the lines
  if (IMPORT.img) { try { await pdfPageAsReference(pg, data.sheetBox, id); } catch (e) { console.warn(e); } }
  markDirty(); renderMeta(); fitView(); renderAll();
  // turn the drawing into site objects straight away (the review list is still there under "Pick shapes…")
  if (typeof siteFromDrawing === "function") siteFromDrawing();
  else { REV.src = "cad"; REV.cands = cadCandidates(data); openReview(); }
}
async function pdfPageAsReference(pg, SB, cadId) {
  const v0 = pg.getViewport({ scale: 1, rotation: 0 }), k = Math.min(4, 3600 / Math.max(v0.width, v0.height)), vp = pg.getViewport({ scale: k, rotation: 0 });
  const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvasContext: g, viewport: vp }).promise;
  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
  const bg = { w: c.width, h: c.height, mpp: (SB[2] - SB[0]) / c.width, x: SB[0], y: SB[3], opacity: 0.9, fromPdf: cadId, show: true };
  if (CAP.assets && !CAP.local) { const a = await CAP.assets.upload(new File([blob], "site-original.jpg", { type: "image/jpeg" })); bg.asset = a.id; bg.url = a.url; }
  else bg.url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  plan.site.bg = bg;
}
async function saveCad(id, data) {
  const json = JSON.stringify(data);
  try {
    if (CAP.assets && !CAP.local) { const a = await CAP.assets.upload(new File([json], id + ".json", { type: "application/json" })); plan.site.cad.asset = a.id; return; }
    if (CAP.db) { await CAP.db.doc("cad/" + id).set({ json }); plan.site.cad.local = true; return; }
  } catch (e) { toast("The linework couldn't be stored (" + (e.code || e.message || e) + ") – it shows until you reload."); }
}
async function loadCad() {
  const c = plan.site.cad; if (!c || CADS[c.id]) return;
  try {
    let json = null;
    if (c.asset) json = await (await fetch("/_blob/" + c.asset)).text();
    else if (c.local && CAP.db) { const d = await CAP.db.doc("cad/" + c.id).get(); json = d.exists ? d.data().json : null; }
    if (json) { CADS[c.id] = JSON.parse(json); renderSite(); }
  } catch (e) { console.warn(e); }
}
function cadRescale(c, k) {
  const cad = plan.site.cad, D = cad && CADS[cad.id]; if (!D) return;
  const f = (x, y) => [Math.round((c[0] + (x - c[0]) * k) * 100) / 100, Math.round((c[1] + (y - c[1]) * k) * 100) / 100];
  for (const q of D.paths) for (let i = 0; i < q.p.length; i += 2) { const p = f(q.p[i], q.p[i + 1]); q.p[i] = p[0]; q.p[i + 1] = p[1]; }
  for (const t of D.texts) { const p = f(t[0], t[1]); t[0] = p[0]; t[1] = p[1]; t[2] *= k; }
  D.bbox = [...f(D.bbox[0], D.bbox[1]), ...f(D.bbox[2], D.bbox[3])];
  cad.scale = Math.round(cad.scale * k); cad.v = (cad.v || 0) + 1; cad.scaleFrom = "Set scale";
  const bg = plan.site.bg; if (bg && bg.fromPdf === cad.id) { const p = f(bg.x, bg.y); bg.x = p[0]; bg.y = p[1]; bg.mpp *= k; }
  if (REV.src === "cad") REV.cands = cadCandidates(D);
  saveCad(cad.id, D);
}
// ---------- drawing the linework (own layer behind the plan, so dragging stays fast) ----------
function cadMarkup(forExport) {
  const c = plan.site.cad, D = c && CADS[c.id]; if (!D || c.show === false) return "";
  if (cadPathCache.id !== c.id || cadPathCache.v !== (c.v || 0)) {
    let d = ""; for (const q of D.paths) { const p = q.p; d += `M${p[0]} ${-p[1]}`; for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${-p[i + 1]}`; if (q.c) d += "Z"; }
    const t = D.texts.map(([x, y, s, r, str]) => `<text x="${x}" y="${-y}" font-size="${Math.max(0.05, s)}" ${r ? `transform="rotate(${-r} ${x} ${-y})"` : ""}>${escH(str)}</text>`).join("");
    cadPathCache = { id: c.id, v: c.v || 0, d, t };
  }
  const col = c.col || "#5f6b78";
  // a drawing traced from a scan is a set of filled outlines (the ink itself); CAD / PDF linework is stroked
  return `<g opacity="${c.op ?? 0.9}" pointer-events="none">${D.fill ? `<path d="${cadPathCache.d}" fill="${col}" fill-rule="evenodd" stroke="none"/>` : `<path d="${cadPathCache.d}" fill="none" stroke="${col}" stroke-width="${forExport ? 0.06 : 0.9}" ${forExport ? "" : 'vector-effect="non-scaling-stroke"'} stroke-linejoin="round"/>`}<g fill="${col}" font-family="Arial, sans-serif">${cadPathCache.t}</g></g>`;
}
{
  const site = $("site");
  const layer = document.createElementNS("http://www.w3.org/2000/svg", "svg"); layer.id = "cadLayer";
  layer.style.cssText = "position:absolute;pointer-events:none;background:#f7f8f9";
  site.parentElement.insertBefore(layer, site);
  let shown = "";
  const _rs = renderSite;
  renderSite = function (...a) {
    const r = _rs(...a);
    const c = plan.site.cad, on = c && c.show !== false && V3.mode === "top";
    if (c && !CADS[c.id]) loadCad();
    layer.style.display = on ? "" : "none"; site.style.background = on ? "transparent" : "";
    if (on) {
      const sr = site.getBoundingClientRect(), pr = site.parentElement.getBoundingClientRect();
      Object.assign(layer.style, { left: sr.left - pr.left + "px", top: sr.top - pr.top + "px", width: sr.width + "px", height: sr.height + "px" });
      layer.setAttribute("viewBox", site.getAttribute("viewBox"));
      const key = c.id + ":" + (c.v || 0) + ":" + (c.op ?? 0.9) + ":" + (c.col || "") + ":" + !!CADS[c.id];
      if (key !== shown) { layer.innerHTML = cadMarkup(); shown = key; }
    }
    return r;
  };
  const _wb = worldBounds;
  worldBounds = function (parts) {
    const b = _wb(parts), c = plan.site.cad, D = c && CADS[c.id];
    if (!D || c.show === false || !D.bbox) return b;
    const empty = !parts.length;
    return empty ? D.bbox.slice() : [Math.min(b[0], D.bbox[0]), Math.min(b[1], D.bbox[1]), Math.max(b[2], D.bbox[2]), Math.max(b[3], D.bbox[3])];
  };
}

// ---------- candidates: closed shapes + long lines, labelled from the drawing text ----------
// English and French
const KEYWORDS = [[/radiation|controlled area|restricted|exclusion|no[ -]?go|danger zone|zone interdite|zone contr[ôo]l[ée]e/i, "zone"], [/quay|berth|wharf|jetty|pier|\bquai|appontement|jet[ée]e/i, "quay"], [/warehouse|shed|store|hangar|magasin|entrep[oô]t/i, "warehouse"], [/office|cabin|admin|welfare|canteen|gate ?house|security|bureau|gu[ée]rite|poste de garde|vestiaire|r[ée]fectoire|\bwc\b|sanitaire/i, "cabin"], [/workshop|building|bldg|atelier|b[aâ]timent/i, "building"],
  [/tank|silo|cuve|r[ée]servoir|citerne/i, "tank"], [/road|access|route|lane|\bvoie|chauss[ée]e|light motor vehicle|\blmv\b|vehicle (?:route|lane|track)|traffic|walkway|footpath|pedestrian|crossing/i, "road"], [/laydown|lay-down|storage|yard|stack(ing)? area|parking|car ?park|aire de stockage|stockage|\bparc\b|terre-plein/i, "laydown"], [/container|stack|conteneur/i, "stack"], [/water|sea|basin|dock|harbour|river|\bmer\b|bassin|darse/i, "water"],
  [/fence|gate|cl[ôo]ture|portail/i, "fence"], [/pipe ?rack|pipeline|tuyauterie/i, "pipes"], [/power|ohl|overhead|cable|ligne|poteau|m\.?t\.?\b/i, "powerline"], [/\bwall\b|\bmur\b/i, "wall"], [/vessel|ship|psv|barge|navire/i, "vessel"]];
function areaOf(P) { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
function lenOf(P) { let l = 0; for (let i = 1; i < P.length; i++) l += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return l; }
// closed outlines (CAD often draws them as separate lines – joined end to end) and the open lines left over
function cadShapes(D) {
  // every shape remembers which drawing paths it was made from (src), so building an object can take those lines off the drawing
  const pts = q => { const P = []; for (let i = 0; i < q.p.length; i += 2) P.push([q.p[i], q.p[i + 1]]); return P; };
  const tol = 0.08, key = p => Math.round(p[0] / tol) + "," + Math.round(p[1] / tol);
  const closed = [], closedSrc = [], open = [], openSrc = [];
  D.paths.forEach((q, j) => { const P = pts(q); if (P.length < 2) return; const e = P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < tol; if ((q.c || e) && P.length >= 3) { closed.push(e ? P.slice(0, -1) : P); closedSrc.push([j]); } else { open.push(P); openSrc.push([j]); } });
  // join open pieces end to end (CAD outlines are often drawn as separate lines)
  if (open.length < 30000) {
    const ends = new Map(), used = new Set(); open.forEach((P, i) => { for (const k of [key(P[0]), key(P[P.length - 1])]) { if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); } });
    const gone = new Set();
    for (let i = 0; i < open.length; i++) {
      if (used.has(i)) continue; used.add(i); let chain = open[i].slice(), grown = true, guard = 0; const mem = [i];
      while (grown && guard++ < 400) { grown = false;
        for (const [end, atStart] of [[chain[chain.length - 1], false], [chain[0], true]]) {
          const c = (ends.get(key(end)) || []).find(j => !used.has(j)); if (c == null) continue;
          used.add(c); mem.push(c); let Q = open[c].slice(); const qk0 = key(Q[0]) === key(end);
          if (atStart) { if (qk0) Q.reverse(); chain = [...Q.slice(0, -1), ...chain]; } else { if (!qk0) Q.reverse(); chain = [...chain, ...Q.slice(1)]; }
          grown = true; break;
        }
      }
      const src = mem.flatMap(m => openSrc[m]);
      // an outline left open by a gate or an access gap (a long line whose ends nearly meet) still bounds an area
      const L = lenOf(chain), gap = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]);
      const nearly = chain.length >= 4 && L > 40 && gap < Math.min(0.06 * L, 40) && gap > tol;
      if (chain.length >= 4 && (key(chain[0]) === key(chain[chain.length - 1]) || nearly)) { closed.push(nearly ? chain : chain.slice(0, -1)); closedSrc.push(src); mem.forEach(m => gone.add(m)); }
      else { open[i] = chain; openSrc[i] = src; mem.slice(1).forEach(m => gone.add(m)); }
    }
    const keep = open.map((_, i) => !gone.has(i)), o2 = open.filter((_, i) => keep[i]), s2 = openSrc.filter((_, i) => keep[i]);
    open.length = 0; open.push(...o2); openSrc.length = 0; openSrc.push(...s2);
  }
  return { closed, open, closedSrc, openSrc };
}
function cadCandidates(D) {
  const { closed, open } = cadShapes(D);
  const bbA = (D.bbox[2] - D.bbox[0]) * (D.bbox[3] - D.bbox[1]);
  const seen = new Set(), C = [];
  const labelIn = P => { let best = null; for (const t of D.texts) if (inPolyPt([t[0], t[1]], P) && (!best || t[2] > best[2])) best = t; return best ? best[4] : ""; };
  const typeFor = s => (KEYWORDS.find(([re]) => re.test(s)) || [])[1] || "";
  for (const P of closed) {
    const A = areaOf(P); if (A < 6 || A > bbA * 0.6) continue;
    const c = centroid(P), k2 = Math.round(c[0]) + ":" + Math.round(c[1]) + ":" + Math.round(Math.sqrt(A)); if (seen.has(k2)) continue; seen.add(k2);
    const lab = labelIn(P), ty = typeFor(lab);
    C.push({ kind: "poly", pts: P.map(p => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]), area: A, label: lab, type: ty === "quay" || ty === "fence" || ty === "powerline" || ty === "wall" ? "area" : ty || "building", on: !!ty });
  }
  C.sort((a, b) => b.area - a.area); const polys = C.slice(0, 300);
  const lines = open.map(P => ({ P, L: lenOf(P) })).filter(x => x.L > 15).sort((a, b) => b.L - a.L).slice(0, 80).map(({ P, L }) => {
    let near = "", bd = 8; for (const t of D.texts) { let d = 1e9; for (let k = 0; k < P.length - 1; k++) d = Math.min(d, segDist([t[0], t[1]], P[k], P[k + 1])); if (d < bd) { bd = d; near = t[4]; } }
    const ty = typeFor(near); return { kind: "line", pts: P, len: L, label: near, type: ["quay", "fence", "powerline", "wall"].includes(ty) ? ty : "quay", on: ["quay", "fence", "powerline", "wall"].includes(ty) };
  });
  return [...polys, ...lines];
}

// ---------- review panel ----------
const REV = { open: false, cands: [], hi: -1, src: "cad", filter: "likely" };
const REV_TYPES = ["building", "warehouse", "cabin", "stack", "laydown", "road", "area", "water", "tank", "pipes", "vessel"], REV_LTYPES = ["quay", "fence", "wall", "powerline"];
{
  const el = document.createElement("div"); el.id = "siteRev"; el.hidden = true;
  el.style.cssText = "position:absolute;right:10px;top:96px;width:360px;max-width:calc(100% - 20px);max-height:calc(100% - 110px);overflow:auto;z-index:25;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:10px 12px;display:flex;flex-direction:column;gap:8px";
  $("site").parentElement.appendChild(el);
}
function openReview() { REV.open = true; REV.hi = -1; renderReview(); renderSite(); }
function closeReview() { REV.open = false; $("siteRev").hidden = true; renderSite(); }
function renderReview() {
  const el = $("siteRev"); if (!REV.open) { el.hidden = true; return; } el.hidden = false;
  const cad = plan.site.cad, list = REV.cands.map((c, i) => ({ c, i })).filter(({ c }) => REV.filter === "all" || c.on || c.label);
  const opt = (arr, v) => arr.map(t => `<option value="${t}" ${t === v ? "selected" : ""}>${escH(OBJ_TYPES[t]?.name.replace(/ \(.*\)$/, "").replace(/ –.*$/, "") || t)}</option>`).join("");
  const nOn = REV.cands.filter(c => c.on).length;
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>Site import – make it real</b><button id="rvX" title="Close">×</button></div>
    ${cad ? `<div class="row"><label class="chk"><input type="checkbox" id="rvShow" ${cad.show !== false ? "checked" : ""}> Show drawing lines</label><label>Line strength<input type="range" id="rvOp" min="0.15" max="1" step="0.05" value="${cad.op ?? 0.9}"></label></div>
      <p class="small" style="margin:0">Imported at 1:${cad.scale}. Check it: <button id="rvScale">Set scale from a known dimension</button> <button id="rvCrop">Crop to the site area</button></p>` :
      plan.site.bg ? `<p class="small" style="margin:0">Picture placed. <button id="rvScale">Set scale (two points)</button>${CAP.sample && CAP.sampleImages ? ` <button id="rvAi" class="pri">Trace with Claude</button>` : ""}</p>` : ""}
    <div class="card" style="padding:8px"><b class="small">Trace by hand</b><div class="row" style="margin-top:4px"><label>Object<select id="rvDrawT"><optgroup label="Areas">${opt(REV_TYPES.filter(t => t !== "vessel"))}</optgroup><optgroup label="Lines">${opt(REV_LTYPES)}</optgroup></select></label><button id="rvDraw" style="align-self:end">Draw it</button></div>
      <p class="small" style="margin:4px 0 0">Click the corners on the drawing · double-click or Enter to finish.${cad ? " Or click inside a shape on the drawing to pick it from the list." : ""}</p></div>
    ${REV.cands.length ? `<div style="display:flex;justify-content:space-between;align-items:center"><b class="small">${REV.src === "ai" ? "Traced by Claude" : "Shapes found on the drawing"} · ${nOn} selected</b><span class="seg"><button data-rvf="likely" aria-pressed="${REV.filter === "likely"}">Labelled</button><button data-rvf="all" aria-pressed="${REV.filter === "all"}">All ${REV.cands.length}</button></span></div>
      <div style="display:flex;flex-direction:column;gap:4px" id="rvList">${list.map(({ c, i }) => `<div class="rigline" data-rvi="${i}" style="gap:6px;${REV.hi === i ? "outline:2px solid var(--accent)" : ""}"><input type="checkbox" data-rvon="${i}" ${c.on ? "checked" : ""}>
        <select data-rvt="${i}" style="max-width:130px">${c.kind === "line" ? opt(REV_LTYPES, c.type) : opt(REV_TYPES, c.type)}</select>
        <span class="small" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escH(c.label)}">${escH(c.label || (c.kind === "line" ? "line" : "shape"))} · ${c.kind === "line" ? fx(c.len || lenOf(c.pts), 0) + " m" : fx(c.area || areaOf(c.pts), 0) + " m²"}</span></div>`).join("") || `<p class="small">Nothing labelled – switch to All, or click a shape on the drawing.</p>`}</div>
      <div class="btnrow"><button class="pri" id="rvMake" ${nOn ? "" : "disabled"}>Create ${nOn} object${nOn === 1 ? "" : "s"}</button><button id="rvNone">Clear selection</button></div>` : `<p class="small" style="margin:0">${REV.src === "pic" ? "Set the scale first, then trace the quay edge, buildings, stacks and roads." : "No closed shapes found – trace by hand."}</p>`}
    <p class="small" style="margin:0">Objects get heights for the Side / 3D views and are checked against the load's travel path. Edit any of them after.</p>`;
  $("rvX").onclick = closeReview;
  if ($("rvShow")) $("rvShow").onchange = e => { cad.show = e.target.checked; markDirty(); renderSite(); };
  if ($("rvOp")) $("rvOp").oninput = e => { cad.op = +e.target.value; renderSite(); }, $("rvOp") && ($("rvOp").onchange = () => markDirty());
  if ($("rvScale")) $("rvScale").onclick = () => { startCalib(); toast("Click the two ends of a dimension you know (e.g. a building side or grid spacing)"); };
  if ($("rvCrop")) $("rvCrop").onclick = () => { setTool("crop"); $("hint").textContent = "Crop: click two opposite corners around the site area – everything outside is removed (title block, notes, borders)"; $("hint").hidden = false; };
  if ($("rvAi")) $("rvAi").onclick = () => $("bgAi").click();
  $("rvDraw").onclick = () => { const t = $("rvDrawT").value; setTool("obj"); tool.objType = t; $("hint").textContent = `Trace ${OBJ_TYPES[t].name.toLowerCase()}: click each corner · double-click or Enter to finish · Esc cancels`; $("hint").hidden = false; };
  el.querySelectorAll("[data-rvf]").forEach(b => b.onclick = () => { REV.filter = b.dataset.rvf; renderReview(); });
  el.querySelectorAll("[data-rvon]").forEach(c => c.onchange = () => { REV.cands[+c.dataset.rvon].on = c.checked; renderReview(); renderSite(); });
  el.querySelectorAll("[data-rvt]").forEach(s => s.onchange = () => { const c = REV.cands[+s.dataset.rvt]; c.type = s.value; c.on = true; renderReview(); renderSite(); });
  el.querySelectorAll("[data-rvi]").forEach(r => { r.onmouseenter = () => { REV.hi = +r.dataset.rvi; renderSite(); }; });
  if ($("rvNone")) $("rvNone").onclick = () => { REV.cands.forEach(c => c.on = false); renderReview(); renderSite(); };
  if ($("rvMake")) $("rvMake").onclick = makeFromCands;
}
function candToObject(c) {
  if (c.type === "vessel") { const xs = c.pts.map(p => p[0]), ys = c.pts.map(p => p[1]), v = newVessel("psv", centroid(c.pts)); let best = 0, ang = 0; for (let i = 0; i < c.pts.length; i++) { const p = c.pts[i], q = c.pts[(i + 1) % c.pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L > best) { best = L; ang = Math.atan2(q[1] - p[1], q[0] - p[0]); } } v.w = Math.round(best); v.h = Math.max(4, Math.round(areaOf(c.pts) / Math.max(1, best))); v.rot = ((-ang / D2R) % 360 + 360) % 360; if (c.label) v.label = c.label; return v; }
  if (c.type === "tank") { const c0 = centroid(c.pts), r = c.pts.reduce((a, p) => a + Math.hypot(p[0] - c0[0], p[1] - c0[1]), 0) / c.pts.length, o = makeObject("tank", c0); o.r = Math.round(r * 10) / 10; if (c.label) o.label = c.label; return o; }
  const pts = c.pts.length > 60 ? c.pts.filter((_, i) => i % Math.ceil(c.pts.length / 60) === 0) : c.pts;
  const o = makeObject(c.type, null, pts); if (c.label) o.label = c.label.slice(0, 40); o.imported = true; return o;
}
function makeFromCands() {
  const sel2 = REV.cands.filter(c => c.on); let n = 0;
  for (const c of sel2) { const o = candToObject(c); if (o) { plan.obstacles.push(o); n++; } }
  REV.cands = REV.cands.filter(c => !c.on);
  markDirty(); renderAll(); renderReview();
  toast(`${n} object${n === 1 ? "" : "s"} created – select any of them to change its height, colour or type`, 5000);
}
// highlight candidates on the plan and pick them by clicking inside
function revMarkup() {
  if (!REV.open || !REV.cands.length) return "";
  let m = "";
  REV.cands.forEach((c, i) => {
    if (!(c.on || i === REV.hi)) return;
    const d = c.pts.map((p, j) => `${j ? "L" : "M"}${p[0]} ${-p[1]}`).join("") + (c.kind === "poly" ? "Z" : "");
    const col = OBJ_TYPES[c.type]?.color || "#d9661f";
    m += `<path d="${d}" fill="${c.kind === "poly" ? rgbaOf(col, i === REV.hi ? 0.35 : 0.2) : "none"}" stroke="${i === REV.hi ? "#d9661f" : col}" stroke-width="${(i === REV.hi ? 3 : 2) / view.s}" pointer-events="none"/>`;
  });
  return m;
}
function revPick(w) {
  if (!REV.open || !REV.cands.length || tool.mode) return false;
  let best = -1, bestA = 1e12;
  REV.cands.forEach((c, i) => { if (c.kind === "poly" && inPolyPt(w, c.pts)) { const A = c.area || areaOf(c.pts); if (A < bestA) { bestA = A; best = i; } } else if (c.kind === "line" && c.pts.some((q, k, P) => k < P.length - 1 && segDist(w, q, P[k + 1]) < 6 / view.s)) { best = i; bestA = 0; } });
  if (best < 0) return false;
  const c = REV.cands[best]; c.on = !c.on; REV.hi = best; if (!c.label) REV.filter = "all";
  renderReview(); renderSite();
  const row = document.querySelector(`[data-rvi="${best}"]`); if (row) row.scrollIntoView({ block: "nearest" });
  return true;
}
{ const _rs2 = renderSite; renderSite = function (...a) { const r = _rs2(...a); const m = revMarkup(); if (m && V3.mode === "top") $("site").insertAdjacentHTML("beforeend", m); return r; }; }
// crop tool (two corners): keep only linework inside
function cropCad(a, b) {
  const cad = plan.site.cad, D = cad && CADS[cad.id]; if (!D) return;
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]), inb = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  D.paths = D.paths.filter(q => { for (let i = 0; i < q.p.length; i += 2) if (!inb(q.p[i], q.p[i + 1])) return false; return true; });
  D.texts = D.texts.filter(t => inb(t[0], t[1]));
  D.bbox = [x0, y0, x1, y1]; cad.n = D.paths.length; cad.v = (cad.v || 0) + 1;
  REV.cands = cadCandidates(D); saveCad(cad.id, D); markDirty(); fitView(); renderReview();
  toast(`Cropped – ${D.paths.length.toLocaleString()} lines kept`);
}
// ---------- hooks into the plan view ----------
{
  const svg = $("site");
  svg.addEventListener("pointerdown", e => {
    if (tool.mode === "crop") { e.stopImmediatePropagation(); const w = toWorld(e); tool.pts.push(w); if (tool.pts.length === 2) { const [a, b] = tool.pts; setTool(null); cropCad(a, b); } else renderSite(); return; }
    if (REV.open && !tool.mode && !calib.active && !e.target.closest("g[data-key]")) { if (revPick(toWorld(e))) e.stopImmediatePropagation(); }
  }, true);
}
{ const _ft = finishTool; finishTool = function () { const was = tool.mode === "obj"; _ft(); if (was && REV.open) renderReview(); }; }
$("bgUpload").onclick = openSiteImport;
$("bgUpload").textContent = "Import site layout…";
// the Claude trace of a picture builds the site straight away: its objects are site objects like any other (deck locked)
{
  const btn = $("bgAi"), orig = btn.onclick;
  btn.onclick = async () => {
    const before = plan.obstacles.length;
    await orig();
    const added = plan.obstacles.slice(before); if (!added.length) return;
    for (const o of added) { o.src = "drawing"; o.cad = "picture"; if (o.type === "deck") o.locked = true; }
    // a second reading replaces the first one's unlocked objects (locked ones are kept as they are)
    const old = plan.obstacles.slice(0, before).filter(o => !(o.cad === "picture" && !o.locked));
    const keepLocked = old.filter(o => o.cad === "picture"), drop = added.filter(a => keepLocked.some(o => o.type === a.type && Math.hypot(centroid(o.pts || [[o.x, o.y]])[0] - centroid(a.pts || [[a.x, a.y]])[0], centroid(o.pts || [[o.x, o.y]])[1] - centroid(a.pts || [[a.x, a.y]])[1]) < 3));
    plan.obstacles = [...added.filter(a => !drop.includes(a)), ...old];   // ground items first, so cranes and loads draw on top
    if (plan.site.bg) plan.site.bg.show = false;   // the objects are the site now – the picture stays as a reference to compare with
    markDirty(); renderAll(); renderMeta();
  };
}
// the bare "clear background" also removes imported linework
{ const b = $("bgClear"), orig = b.onclick; b.onclick = () => { if (plan.site.cad) { plan.site.cad = null; closeReview(); } orig(); }; }
