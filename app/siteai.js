// ================= Claude reads the drawing: what each shape really is =================
// The lines give exact geometry; Claude looks at the drawing itself (labels, legend, symbols, hatching) and says what
// every built object is, names it, gives heights, drops non-objects and adds features the outlines missed.
// Runs by itself after a PDF import when Claude is available (the published app); the offline file keeps the geometry-only build.
const SITEAI = { busy: false, last: "" };
const AI_TYPES = ["deck", "building", "warehouse", "cabin", "stack", "laydown", "road", "water", "tank", "fence", "wall", "pipes", "mast", "powerline", "quay", "area", "bollard", "ignore"];
const SITE_AI_PROMPT = (items, nBoll) => `The image is a site layout drawing of a port / supply base where crane lifts are planned (north is up unless the drawing shows otherwise).
The app has read the drawing's lines and built these objects from its closed outlines. "box" is where each one is on the image as fractions [u0, v0, u1, v1] (u from the left edge, v from the top edge):
${JSON.stringify(items)}
${nBoll ? `It also found ${nBoll} small circles it took for bollards.` : ""}
Look at the drawing itself – its labels, legend / key, symbols and hatching – and:
1. say what each listed object really is,
2. add the main physical features the outlines missed (container stacks or cabins drawn as symbols, roads, laydown areas, fences, walls, light towers, tanks, overhead lines, the quay edge if the deck outline was missed).
Return JSON only:
{"items": [{"id": "...", "type": one of ${AI_TYPES.filter(t => t !== "bollard").map(t => `"${t}"`).join(",")}, "label": "short name from the drawing or a plain description", "height_m": number or null}],
 "extra": [{"type": one of ${AI_TYPES.filter(t => t !== "ignore").map(t => `"${t}"`).join(",")}, "label": "", "height_m": number or null, "pts": [[u, v], ...]}],
 "bollards_ok": true or false,
 "notes": "one short sentence"}
Rules: "deck" = the quay / jetty / yard surface cranes stand on. "ignore" = not a physical object (legend box, title block, table cell, hatching boundary, annotation, dimension, drawing symbol in a key). Give a height only when the drawing shows it or the type makes it obvious (containers 2.6 m per tier, office cabin 2.8 m, guard house 3 m). For "extra": polygons for areas and buildings (corners in order), polylines for fences / walls / quay edges / overhead lines, 4 points round a tank or mast. At most 60 extra features, only what you can actually see.`;

async function pageJpeg(maxPx = 2000) {
  const pg = await IMPORT.pdf.getPage(IMPORT.page), v0 = pg.getViewport({ scale: 1, rotation: 0 }), k = Math.min(3, maxPx / Math.max(v0.width, v0.height)), vp = pg.getViewport({ scale: k, rotation: 0 });
  const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvasContext: g, viewport: vp }).promise;
  return await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
}
function retypeObject(o, type, label, h) {
  const T = OBJ_TYPES[type]; if (!T || T.special) return o;
  if (T.kind === "circle" && o.kind !== "circle") {           // a tank / mast drawn as an outline → a circle
    const P = o.pts || obsPts(o), c = centroid(P), r = Math.sqrt(areaOf(P) / Math.PI);
    const n = makeObject(type, c); n.r = Math.max(0.3, Math.round(r * 10) / 10); n.id = o.id; Object.assign(n, { src: o.src, cad: o.cad, imported: true });
    if (label) n.label = label; if (h > 0) n.hgt = h; return n;
  }
  o.type = type; o.color = T.color; o.hgt = h > 0 ? h : T.hgt; if (T.pass) o.pass = true; else delete o.pass; if (T.tiers) o.tiers = T.tiers;
  if (T.kind === "line") { o.kind = "line"; }
  if (label) o.label = label;
  if (type === "deck") o.locked = true;
  return o;
}
async function aiReadDrawing(quiet) {
  const k = ltCad(); if (!k || !IMPORT.pdf || !CAP.sample || !CAP.sampleImages || SITEAI.busy) return false;
  if (k.c.turned) { toast("The drawing has been turned since import – Claude reads it as it was imported, so undo the rotation first"); return false; }
  const SB = k.D.sheetBox; if (!SB) return false;
  const U = x => +((x - SB[0]) / (SB[2] - SB[0])).toFixed(3), V = y => +((SB[3] - y) / (SB[3] - SB[1])).toFixed(3);
  const toW = p => [Math.round((SB[0] + (+p[0]) * (SB[2] - SB[0])) * 100) / 100, Math.round((SB[3] - (+p[1]) * (SB[3] - SB[1])) * 100) / 100];
  const mine = plan.obstacles.filter(o => fromDrawing(o) && o.cad === k.c.id);
  // objects typed by the drawing's own legend are already right – Claude only looks at the rest (and adds what's missing)
  const items = mine.filter(o => o.type !== "bollard" && !o.byLegend).slice(0, 150).map(o => { const P = o.pts || obsPts(o), xs = P.map(p => p[0]), ys = P.map(p => p[1]); return { id: o.id, now: o.type, label: o.label || "", box: [U(Math.min(...xs)), V(Math.max(...ys)), U(Math.max(...xs)), V(Math.min(...ys))], area_m2: Math.round(areaOf(P)) }; });
  SITEAI.busy = true; SITEAI.last = "Claude is reading the drawing…"; renderSiteBuildBox();
  try {
    const img = await pageJpeg();
    const r = await CAP.sample.json(SITE_AI_PROMPT(items, mine.length - items.length), { images: [img], modelTier: "complex" });
    ltSnap("Claude's reading of the drawing");
    let changed = 0, dropped = 0, added = 0;
    for (const it of r.items || []) {
      const i = plan.obstacles.findIndex(o => o.id === it.id); if (i < 0) continue;
      const o = plan.obstacles[i], ty = AI_TYPES.includes(it.type) ? it.type : null; if (!ty) continue;
      if (ty === "ignore") { if (!o.locked && o.type !== "deck" && !o.byLegend) { plan.obstacles.splice(i, 1); dropped++; } continue; }
      if ((o.locked && o.type !== "deck") || o.byLegend) continue;
      const lab = String(it.label || "").slice(0, 40), h = +it.height_m || 0;
      if (ty !== o.type || (lab && lab !== o.label) || h) { plan.obstacles[i] = retypeObject(o, ty, lab, h); changed++; }
    }
    if (r.bollards_ok === false) { const n0 = plan.obstacles.length; plan.obstacles = plan.obstacles.filter(o => !(o.type === "bollard" && fromDrawing(o) && o.cad === k.c.id && !o.locked)); dropped += n0 - plan.obstacles.length; }
    const newObjs = [];
    for (const ex of (r.extra || []).slice(0, 60)) {
      const ty = AI_TYPES.includes(ex.type) && ex.type !== "ignore" ? ex.type : null, T = ty && OBJ_TYPES[ty]; if (!T) continue;
      const pts = (ex.pts || []).filter(p => Array.isArray(p) && p.length >= 2).map(toW); let o;
      if (T.kind === "line") { if (pts.length < 2) continue; o = makeObject(ty, null, pts); }
      else if (T.kind === "circle") { if (!pts.length) continue; const c = centroid(pts); o = makeObject(ty, c); if (pts.length > 1) o.r = Math.max(0.3, Math.round(pts.reduce((a, p) => a + Math.hypot(p[0] - c[0], p[1] - c[1]), 0) / pts.length * 10) / 10); }
      else { if (pts.length < 3) continue; o = makeObject(ty, null, pts); }
      if (ex.label) o.label = String(ex.label).slice(0, 40); if (+ex.height_m > 0) o.hgt = +ex.height_m;
      o.src = "drawing"; o.cad = k.c.id; o.imported = true; o.byClaude = true; if (ty === "deck") o.locked = true;
      newObjs.push(o); added++;
    }
    // ground surfaces first so everything else draws on top of them
    const ground = newObjs.filter(o => objPass(o) && !(+o.hgt > 0.2)), rest = newObjs.filter(o => !ground.includes(o));
    plan.obstacles = [...ground, ...plan.obstacles, ...rest];
    k.c.ai = Date.now();
    SITEAI.last = `Claude: ${changed} named / retyped${added ? `, ${added} added` : ""}${dropped ? `, ${dropped} removed (not real objects)` : ""}.${r.notes ? " " + String(r.notes).slice(0, 160) : ""}`;
    markDirty(); renderAll(); renderMeta();
    if (!quiet || changed + added + dropped) toast(SITEAI.last, 9000);
    return true;
  } catch (e) { SITEAI.last = "Claude couldn't read the drawing (" + (e.code || e.message || e) + ") – the shapes from the lines are kept."; toast(SITEAI.last, 7000); return false; }
  finally { SITEAI.busy = false; renderSiteBuildBox(); }
}
// after a PDF import: build from the lines (instant), then let Claude refine it
{ const _sfd = siteFromDrawing; siteFromDrawing = function (...a) { const r = _sfd(...a); if (CAP.sample && CAP.sampleImages) setTimeout(() => aiReadDrawing(true), 200); return r; }; }
// Claude's reading is tied to the drawing as imported – a turned drawing is flagged
{ const _r = ltRotate; ltRotate = function (deg, ...a) { const k = ltCad(); const r = _r(deg, ...a); if (k && deg) k.c.turned = ((k.c.turned || 0) + deg) % 360 || undefined; return r; }; }
// the Site objects box: Claude's status and a "read again" button
{ const _rb = renderSiteBuildBox; renderSiteBuildBox = function (...a) {
    const r = _rb(...a);
    try {
      const box = $("sbBox"), k = ltCad(); if (!box || box.hidden || !k) return r;
      const can = CAP.sample && CAP.sampleImages && IMPORT.pdf;
      const p = document.createElement("div"); p.style.cssText = "display:flex;flex-direction:column;gap:4px";
      p.innerHTML = SITEAI.busy ? `<span class="status busy">Claude is reading the drawing – labels, legend, symbols… (20–60 s)</span>`
        : `${can ? `<div class="ltrow"><button data-sai="1" title="Claude looks at the drawing – labels, legend, symbols – names each object, gives heights and adds what the outlines missed">${k.c.ai ? "Read again with Claude" : "Read the drawing with Claude"}</button></div>` : ""}${SITEAI.last ? `<p class="small" style="margin:0">${escH(SITEAI.last)}</p>` : ""}`;
      if (p.innerHTML.trim()) box.querySelector(".lth").after(p);
      const b = p.querySelector("[data-sai]"); if (b) b.onclick = () => aiReadDrawing(false);
    } catch (e) { console.warn(e); }
    return r;
  }; }
