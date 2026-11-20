// ================= Site layout tools =================
// Whatever drawing or picture you import, you can make it work for planning:
// fit it to the screen, straighten / rotate it, erase what you don't need (legend, title block, notes),
// crop to the site, delete single lines, fade it, hide it or remove it – and undo any of it.
const LT = { undo: [], last: null };
const ltCad = () => { const c = plan.site.cad; return c && CADS[c.id] ? { c, D: CADS[c.id] } : null; };
const ltHas = () => !!(ltCad() || plan.site.bg);
function ltBBox() {
  const k = ltCad(); if (k && k.D.bbox) return k.D.bbox.slice();
  const bg = plan.site.bg; if (!bg) return null;
  const W = bg.w * bg.mpp, H = bg.h * bg.mpp, cx = bg.x + W / 2, cy = bg.y - H / 2, a = (+bg.rot || 0);
  const P = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]].map(p => { const r = rot2(p, a); return [cx + r[0], cy + r[1]]; });
  return [Math.min(...P.map(p => p[0])), Math.min(...P.map(p => p[1])), Math.max(...P.map(p => p[0])), Math.max(...P.map(p => p[1]))];
}
function ltSnap(label) {
  const k = ltCad(); syncLift();
  LT.undo.push({ label, cad: k ? JSON.stringify(k.D) : null, cadId: k ? k.c.id : null, plan: JSON.stringify({ obstacles: plan.obstacles, lifts: plan.lifts, site: plan.site }) });
  if (LT.undo.length > 10) LT.undo.shift();
}
function ltUndo() {
  const u = LT.undo.pop(); if (!u) return;
  const p = JSON.parse(u.plan); plan.obstacles = p.obstacles; plan.lifts = p.lifts; plan.site = { ...plan.site, ...p.site };
  plan.cranes = plan.lifts[plan.al].cranes; plan.loads = plan.lifts[plan.al].loads;
  if (u.cad && u.cadId && plan.site.cad) { CADS[u.cadId] = JSON.parse(u.cad); plan.site.cad.v = (plan.site.cad.v || 0) + 1; saveCad(u.cadId, CADS[u.cadId]); if (typeof REV !== "undefined" && REV.src === "cad") REV.cands = cadCandidates(CADS[u.cadId]); }
  markDirty(); renderAll(); renderMeta(); toast(`Undone: ${u.label}`);
}
function ltSaveCad() { const k = ltCad(); if (!k) return; k.c.v = (k.c.v || 0) + 1; k.c.n = k.D.paths.length; if (typeof REV !== "undefined" && REV.src === "cad") REV.cands = cadCandidates(k.D); saveCad(k.c.id, k.D); }
function ltRecalcBBox(D) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of D.paths) for (let i = 0; i < q.p.length; i += 2) { x0 = Math.min(x0, q.p[i]); x1 = Math.max(x1, q.p[i]); y0 = Math.min(y0, q.p[i + 1]); y1 = Math.max(y1, q.p[i + 1]); }
  for (const t of D.texts) { x0 = Math.min(x0, t[0]); x1 = Math.max(x1, t[0]); y0 = Math.min(y0, t[1]); y1 = Math.max(y1, t[1]); }
  if (isFinite(x0)) D.bbox = [x0, y0, x1, y1];
}
// ---- fit the view to the drawing only ----
function ltFit() {
  const b = ltBBox(); if (!b) return;
  const r = $("site").getBoundingClientRect();
  view.cx = (b[0] + b[2]) / 2; view.cy = (b[1] + b[3]) / 2;
  view.s = Math.max(0.05, Math.min((r.width - 60) / (b[2] - b[0] || 1), (r.height - 110) / (b[3] - b[1] || 1)));
  view.cy -= 15 / view.s;   // clear of the hint bar along the bottom
  renderSite();
}
// ---- rotate the drawing AND everything already placed on it (cranes, loads, site items), about the drawing centre ----
function ltRotate(deg, quiet) {
  if (!deg || !ltHas()) return;
  ltSnap(`rotate ${fx(deg, 1)}°`);
  const b = ltBBox(), C = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], R = p => { const r = rot2([p[0] - C[0], p[1] - C[1]], deg); return [Math.round((C[0] + r[0]) * 1000) / 1000, Math.round((C[1] + r[1]) * 1000) / 1000]; };
  const k = ltCad();
  if (k) { for (const q of k.D.paths) for (let i = 0; i < q.p.length; i += 2) { const p = R([q.p[i], q.p[i + 1]]); q.p[i] = p[0]; q.p[i + 1] = p[1]; }
    for (const t of k.D.texts) { const p = R([t[0], t[1]]); t[0] = p[0]; t[1] = p[1]; t[3] = (+t[3] || 0) + deg; }
    ltRecalcBBox(k.D); ltSaveCad(); }
  const bg = plan.site.bg;
  if (bg) { const W = bg.w * bg.mpp, H = bg.h * bg.mpp, c = R([bg.x + W / 2, bg.y - H / 2]); bg.x = c[0] - W / 2; bg.y = c[1] + H / 2; bg.rot = ((+bg.rot || 0) + deg) % 360;
    bg.masks = (bg.masks || []).map(m => ({ ...m, P: m.P.map(R) })); }
  syncLift();
  const turn = o => { if (o.rot != null || o.kind === "rect") o.rot = ((+o.rot || 0) - deg) % 360; };
  for (const o of plan.obstacles) {
    if (Array.isArray(o.pts)) o.pts = o.pts.map(R);
    if (o.x != null && o.y != null) { const p = R([o.x, o.y]); o.x = p[0]; o.y = p[1]; }
    turn(o);
  }
  for (const L of plan.lifts) {
    for (const c of L.cranes) { const p = R([c.x, c.y]); c.x = p[0]; c.y = p[1]; c.heading = ((+c.heading || 0) - deg + 360) % 360; if (c.tip) for (const ph of ["pick", "set"]) if (c.tip[ph]?.free) c.tip[ph].brg = ((+c.tip[ph].brg || 0) - deg + 360) % 360; }
    for (const ld of L.loads) for (const ph of ["pick", "set"]) { const q = ld[ph]; if (!q) continue; const p = R([q.x, q.y]); q.x = p[0]; q.y = p[1]; q.rot = ((+q.rot || 0) - deg); if (q._vw) q._vw = [q.x, q.y]; }
  }
  if (typeof syncVessels === "function") try { syncVessels(); } catch (e) {}
  markDirty(); renderAll(); if (!quiet) ltFit();
}
// straighten: turn the drawing so its main direction (the longest lines) runs left → right
function ltStraighten() {
  const k = ltCad(); if (!k) { toast("Straighten works on imported drawings – for a picture, type the angle"); return; }
  const bins = new Float64Array(180);
  for (const q of k.D.paths) for (let i = 2; i < q.p.length; i += 2) { const dx = q.p[i] - q.p[i - 2], dy = q.p[i + 1] - q.p[i - 1], L = Math.hypot(dx, dy); if (L < 1e-6) continue; let a = Math.round(Math.atan2(dy, dx) / D2R); a = ((a % 180) + 180) % 180; bins[a] += L * L; }
  let best = 0; for (let a = 0; a < 180; a++) { const s = bins[a] + bins[(a + 1) % 180] + bins[(a + 179) % 180]; const sb = bins[best] + bins[(best + 1) % 180] + bins[(best + 179) % 180]; if (s > sb) best = a; }
  // refine: length-weighted mean direction of the lines within ±2° of the peak
  let sx = 0, sy = 0;
  for (const q of k.D.paths) for (let i = 2; i < q.p.length; i += 2) { const dx = q.p[i] - q.p[i - 2], dy = q.p[i + 1] - q.p[i - 1], L = Math.hypot(dx, dy); if (L < 1e-6) continue; let a = Math.atan2(dy, dx) / D2R; a = ((a % 180) + 180) % 180; let d = a - best; if (d > 90) d -= 180; if (d < -90) d += 180; if (Math.abs(d) <= 2.5) { const t = 2 * a * D2R; sx += L * L * Math.cos(t); sy += L * L * Math.sin(t); } }
  const fine = sx || sy ? ((Math.atan2(sy, sx) / D2R / 2) + 180) % 180 : best;
  let rot = -Math.round(fine * 10) / 10; if (rot <= -90) rot += 180; if (rot > 90) rot -= 180;
  if (Math.abs(rot) < 0.5) { toast("Already straight"); return; }
  ltRotate(rot); toast(`Turned ${fx(rot, 0)}° so the main lines run across the screen`);
}
// ---- erase / crop / pick lines ----
function ltInBox(x, y, b) { return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]; }
function ltErase(a, c) {
  const b = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])], k = ltCad(); ltSnap("erase area");
  if (k) { const n0 = k.D.paths.length, t0 = k.D.texts.length;
    k.D.paths = k.D.paths.filter(q => { let inside = 0; const n = q.p.length / 2; for (let i = 0; i < q.p.length; i += 2) if (ltInBox(q.p[i], q.p[i + 1], b)) inside++; return inside < n; });
    k.D.texts = k.D.texts.filter(t => !ltInBox(t[0], t[1], b));
    ltRecalcBBox(k.D); ltSaveCad(); markDirty(); renderSite(); toast(`Erased ${(n0 - k.D.paths.length).toLocaleString()} lines and ${t0 - k.D.texts.length} labels`); return; }
  const bg = plan.site.bg; if (bg) { bg.masks = [...(bg.masks || []), { P: [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]] }]; markDirty(); renderSite(); toast("Area blanked out on the picture"); }
}
function ltCrop(a, c) {
  const k = ltCad(); if (k) { ltSnap("crop"); cropCad(a, c); return; }
  const bg = plan.site.bg; if (!bg) return; ltSnap("crop");
  bg.crop = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])]; markDirty(); ltFit(); toast("Cropped to that area");
}
function segD(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-12; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
function ltPickLine(w) {
  const k = ltCad(); if (!k) return false;
  const tol = 8 / view.s; let best = -1, bd = tol, bt = -1, btd = tol * 1.5;
  k.D.paths.forEach((q, j) => { for (let i = 2; i < q.p.length; i += 2) { const d = segD(w, [q.p[i - 2], q.p[i - 1]], [q.p[i], q.p[i + 1]]); if (d < bd) { bd = d; best = j; } } if (q.c && q.p.length > 4) { const n = q.p.length; const d = segD(w, [q.p[n - 2], q.p[n - 1]], [q.p[0], q.p[1]]); if (d < bd) { bd = d; best = j; } } });
  k.D.texts.forEach((t, j) => { const d = Math.hypot(w[0] - t[0], w[1] - t[1]); if (d < btd) { btd = d; bt = j; } });
  if (best < 0 && bt < 0) return false;
  ltSnap("delete line");
  if (bt >= 0 && (best < 0 || btd < bd)) k.D.texts.splice(bt, 1); else k.D.paths.splice(best, 1);
  ltSaveCad(); markDirty(); renderSite(); return true;
}
// ---- picture backgrounds: rotation, crop and blanked-out areas ----
{ const _bm = bgMarkup; bgMarkup = function (url) {
    const bg = plan.site.bg; if (!bg) return "";
    let m = _bm(url);
    const W = bg.w * bg.mpp, H = bg.h * bg.mpp, cx = bg.x + W / 2, cy = bg.y - H / 2;
    if (+bg.rot) m = `<g transform="rotate(${-(+bg.rot)} ${cx} ${-cy})">${m}</g>`;
    if (bg.crop) { const c = bg.crop, id = "bgcrop"; m = `<clipPath id="${id}"><rect x="${c[0]}" y="${-c[3]}" width="${c[2] - c[0]}" height="${c[3] - c[1]}"/></clipPath><g clip-path="url(#${id})">${m}</g>`; }
    for (const k of bg.masks || []) m += `<polygon points="${k.P.map(p => `${p[0]},${-p[1]}`).join(" ")}" fill="#f7f8f9"/>`;
    return m;
  }; }
// fit / world bounds use the cropped / rotated picture
{ const _wb = worldBounds; worldBounds = function (parts) {
    const b = _wb(parts), bg = plan.site.bg; if (!bg || (!bg.crop && !+bg.rot)) return b;
    const lb = bg.crop || ltBBox(); return parts.length ? [Math.min(b[0], lb[0]), Math.min(b[1], lb[1]), Math.max(b[2], lb[2]), Math.max(b[3], lb[3])] : lb;
  }; }
// ---- the tool modes on the plan: erase box, crop box (with a live rectangle) and click-to-delete ----
{
  const svg = $("site");
  let hoverW = null;
  svg.addEventListener("pointermove", e => { if (tool.mode !== "lterase" && tool.mode !== "ltcrop") return; hoverW = toWorld(e); ltDrawBox(); });
  svg.addEventListener("pointerdown", e => {
    if (tool.mode === "lterase" || tool.mode === "ltcrop") {
      e.stopImmediatePropagation(); e.preventDefault(); const w = toWorld(e); tool.pts.push(w);
      if (tool.pts.length === 2) { const [a, b] = tool.pts, m = tool.mode; tool.pts = []; if (m === "ltcrop") { setTool(null); ltCrop(a, b); } else { ltErase(a, b); $("hint").textContent = "Erase: drag / click two corners of the next area · Esc when done"; } renderLayoutTools(); }
      else { ltDrawBox(); }
      return;
    }
    if (tool.mode === "ltpick") { e.stopImmediatePropagation(); e.preventDefault(); if (!ltPickLine(toWorld(e))) toast("No line there – click right on a line or label"); renderLayoutTools(); return; }
  }, true);
  svg.addEventListener("pointerup", e => {
    // a drag (rather than two clicks) also makes the box
    if ((tool.mode === "lterase" || tool.mode === "ltcrop") && tool.pts.length === 1) { const w = toWorld(e), a = tool.pts[0]; if (Math.hypot(w[0] - a[0], w[1] - a[1]) * view.s > 12) svg.dispatchEvent(new PointerEvent("pointerdown", { clientX: e.clientX, clientY: e.clientY, bubbles: true })); }
  }, true);
  function ltDrawBox() {
    svg.querySelector("#ltBox")?.remove();
    if (tool.pts.length !== 1 || !hoverW) return;
    const a = tool.pts[0], b = hoverW, x = Math.min(a[0], b[0]), y = Math.max(a[1], b[1]);
    svg.insertAdjacentHTML("beforeend", `<rect id="ltBox" x="${x}" y="${-y}" width="${Math.abs(b[0] - a[0])}" height="${Math.abs(b[1] - a[1])}" fill="${tool.mode === "lterase" ? "rgba(180,35,24,.12)" : "rgba(31,95,168,.08)"}" stroke="${tool.mode === "lterase" ? "#b42318" : "#1f5fa8"}" stroke-width="${2 / view.s}" stroke-dasharray="${6 / view.s} ${4 / view.s}" pointer-events="none"/>`);
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && /^lt/.test(tool.mode || "")) { setTool(null); svg.querySelector("#ltBox")?.remove(); renderLayoutTools(); } });
}
function ltMode(m, hint) { if (tool.mode === m) { setTool(null); renderLayoutTools(); return; } setTool(m); $("site").style.cursor = "crosshair"; $("hint").textContent = hint; renderLayoutTools(); }
// ---- the panel ----
function renderLayoutTools() {
  let box = $("ltBoxUI");
  if (!box) { box = document.createElement("div"); box.id = "ltBoxUI"; box.className = "ltools"; $("bgInfo").after(box); }
  if (!ltHas()) { box.innerHTML = ""; box.hidden = true; return; }
  box.hidden = false;
  const k = ltCad(), bg = plan.site.bg, on = k ? k.c.show !== false : bg?.show !== false, op = k ? (k.c.op ?? 0.9) : (bg.opacity ?? 0.85), m = tool.mode;
  const b = ltBBox();
  box.innerHTML = `<div class="lth"><b>${k ? "Imported drawing" : "Site picture"}</b><span class="small">${b ? `${fx(b[2] - b[0], 0)} × ${fx(b[3] - b[1], 0)} m` : ""}${k ? ` · ${k.D.paths.length.toLocaleString()} lines` : ""}</span></div>
    <div class="ltrow"><button data-lt="fit" title="Zoom to the drawing">⤢ Fit to screen</button><button data-lt="show" aria-pressed="${on}">${on ? "Hide" : "Show"}</button><label class="ltop" title="Fade the drawing so your plan stands out">Fade<input type="range" min="0.15" max="1" step="0.05" value="${op}" data-lt="op"></label></div>
    <div class="ltrow"><span class="small" style="min-width:52px">Rotate</span><button data-lt="r-90" title="Turn 90° anticlockwise">⟲ 90°</button><button data-lt="r90" title="Turn 90° clockwise">⟳ 90°</button><input type="number" step="0.5" placeholder="°" data-lt="rdeg" style="width:64px" title="Type an angle, + turns anticlockwise"><button data-lt="rgo">Turn</button>${k ? `<button data-lt="straight" title="Turn it so the main lines run across the screen">Straighten</button>` : ""}</div>
    <div class="ltrow"><span class="small" style="min-width:52px">Clean up</span><button data-lt="erase" aria-pressed="${m === "lterase"}" title="Box round the legend, title block, notes… to remove them">🧽 Erase area</button>${k ? `<button data-lt="pick" aria-pressed="${m === "ltpick"}" title="Click single lines or labels to delete them">✕ Delete lines</button>` : ""}<button data-lt="crop" aria-pressed="${m === "ltcrop"}" title="Keep only what's inside a box">Crop</button></div>
    <div class="ltrow"><button data-lt="undo" ${LT.undo.length ? "" : "disabled"}>↶ Undo ${LT.undo.length ? escH(LT.undo[LT.undo.length - 1].label) : "layout edit"}</button><button data-lt="scale">Set scale</button><button data-lt="remove" class="rmvbig">Remove layout</button></div>
    ${m && /^lt/.test(m) ? `<p class="small" style="margin:2px 0 0;color:var(--accent,#d9661f)">${m === "lterase" ? "Drag a box (or click two corners) round what to erase – the legend, title block, notes. Keep going; Esc when done." : m === "ltpick" ? "Click a line or label to delete it. Esc when done." : "Drag a box round the site – everything outside goes."}</p>` : `<p class="small" style="margin:2px 0 0">Rotate everything together (your cranes, loads and site items turn with it). Erase the legend and title block so only the site is left.</p>`}`;
  box.querySelectorAll("[data-lt]").forEach(el => {
    const a = el.dataset.lt;
    if (a === "op") { el.oninput = () => { const v = +el.value; if (k) { k.c.op = v; } else bg.opacity = v; renderSite(); }; el.onchange = () => markDirty(); return; }
    if (a === "rdeg") return;
    el.onclick = () => {
      if (a === "fit") ltFit();
      else if (a === "show") { if (k) k.c.show = !on; else bg.show = !on; markDirty(); renderSite(); renderLayoutTools(); }
      else if (a === "r-90") ltRotate(90); else if (a === "r90") ltRotate(-90);
      else if (a === "rgo") { const v = +box.querySelector('[data-lt="rdeg"]').value; if (v) ltRotate(v); }
      else if (a === "straight") ltStraighten();
      else if (a === "erase") ltMode("lterase", "Erase: drag a box (or click two corners) round what to remove · Esc when done");
      else if (a === "pick") ltMode("ltpick", "Delete lines: click a line or label · Esc when done");
      else if (a === "crop") ltMode("ltcrop", "Crop: drag a box round the site area");
      else if (a === "undo") ltUndo();
      else if (a === "scale") $("bgCal").click();
      else if (a === "remove") { if (el.dataset.armed !== "1") { el.dataset.armed = "1"; el.textContent = "Click again to remove"; return; } $("bgClear").click(); LT.undo = []; }
      renderLayoutTools();
    };
  });
}
// a hidden picture is not drawn
{ const _bm2 = bgMarkup; bgMarkup = function (url) { return plan.site.bg && plan.site.bg.show === false ? "" : _bm2(url); }; }
{ const _rm = renderMeta; renderMeta = function (...a) { const r = _rm(...a);
    try { const k = ltCad(), has = ltHas(); if (k) $("bgInfo").textContent = `Drawing imported at 1:${k.c.scale || "?"} – check it with Set scale on a dimension you know.`;
      for (const id of ["bgCal", "bgClear"]) if ($(id)) $(id).hidden = has;          // these live in the layout tools once there is a layout
      renderLayoutTools(); } catch (e) { console.warn(e); } return r; }; }
// after an import, the drawing fills the screen and the tools are right there
{ const _rs = renderSite; let lastKey = ""; renderSite = function (...a) { const r = _rs(...a); const c = plan.site.cad, key = c ? c.id + ":" + !!CADS[c.id] : plan.site.bg ? "bg" + (plan.site.bg.asset || plan.site.bg.w) : ""; if (key !== lastKey) { const fresh = lastKey !== "" || (c && CADS[c.id]); lastKey = key; setTimeout(() => { renderLayoutTools(); if (key && fresh && (c ? CADS[c.id] : true)) ltFit(); }, 0); } return r; }; }
