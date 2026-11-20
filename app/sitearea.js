// ================= Rebuild the site round the lift as real objects =================
// The site picture (or traced lines) round the lift is shown to Claude, who reads what is there – roads, hard
// standing, kerbs/walls, fences, buildings, cabins, pipe racks, tanks, light towers, overhead lines – and gives each
// one's shape. They come back as ordinary site items (select, move, resize, set heights, lock, delete), marked
// "~ (from the picture)": positions and sizes are estimates from the picture and should be checked on site.
const SA = { cand: null, busy: false, box: null };
const SA_TYPES = { road: "road", area: "area", laydown: "laydown", building: "building", warehouse: "warehouse", cabin: "cabin", stack: "stack", wall: "wall", fence: "fence", pipes: "pipes", tank: "tank", mast: "mast", powerline: "powerline", quay: "quay", water: "water" };
const SA_RECT = new Set(["building", "warehouse", "cabin", "stack", "pipes", "laydown"]);
const SA_PROMPT = (wm, hm, have) => `The image is part of a site layout drawing round a planned crane lift (it covers about ${Math.round(wm)} m × ${Math.round(hm)} m; north is up).
Rebuild what is physically on the ground as objects, tracing each one's outline as closely as you can from the image:
- road: a carriageway / access road – its outline polygon following both kerb lines (split long roads at junctions)
- area: paved hard standing, yard or slab that is not a road (outline polygon)
- laydown: a marked storage / laydown area
- building, warehouse, cabin: a building / shed / small cabin or guard house – its 4 corners
- stack: containers
- pipes: a pipe rack or pipeline footprint – its 4 corners
- tank: a round tank, silo or bund-less vessel – its centre point plus "r" (radius as a fraction of the image width)
- mast: a light tower / pole – its centre point
- wall: a wall, bund wall or kerb line (polyline along it)
- fence: a fence / barrier line (often drawn x–x–x or as a dashed line) – polyline along it
- powerline: an overhead line (polyline)
- quay: a quay / jetty edge (polyline); water: a water area (polygon)
Points are [u, v] fractions of the image: u from the left edge (0–1), v from the top edge (0–1).
Leave out: text, dimensions, hatching, grid lines, symbols in a key, the drawing frame, and anything already listed here as existing site items (boxes as [u0, v0, u1, v1]): ${JSON.stringify(have)}.
Return JSON only:
{"objects": [{"type": one of ${Object.keys(SA_TYPES).map(t => `"${t}"`).join(", ")}, "label": "name from the drawing (e.g. its tag) or a plain description", "pts": [[u, v], ...], "r": number (tanks only), "height_m": number or null}],
 "notes": "one short sentence on anything uncertain"}
Use height_m only when the drawing shows it or it is obvious (a fence ≈ 2.0, a cabin ≈ 3.0). Accuracy of position and outline matters more than the number of objects.`;
// the square of site round the current lift: cranes, their reach, the load's pick and set
function saLiftBox() {
  const P = [];
  for (const c of plan.cranes || []) { if (!isFinite(+c.x)) continue; let R = 20; try { for (const ph of ["pick", "set"]) { const ev = evalCrane(c, ph); if (ev && ev.R) R = Math.max(R, ev.R + 12); } } catch (e) { }
    P.push([c.x - R, c.y - R], [c.x + R, c.y + R]); }
  for (const ld of plan.loads || []) for (const ph of ["pick", "set"]) if (ld[ph] && isFinite(+ld[ph].x)) P.push([ld[ph].x - 15, ld[ph].y - 15], [ld[ph].x + 15, ld[ph].y + 15]);
  if (!P.length) return null;
  let x0 = Math.min(...P.map(p => p[0])), x1 = Math.max(...P.map(p => p[0])), y0 = Math.min(...P.map(p => p[1])), y1 = Math.max(...P.map(p => p[1]));
  const s = Math.min(260, Math.max(80, x1 - x0, y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return [cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2];
}
function saViewBox() { const svg = $("site"), r = svg.getBoundingClientRect(), a = toWorld({ clientX: r.left, clientY: r.bottom }), b = toWorld({ clientX: r.right, clientY: r.top }); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; }
// the box as a picture: the site picture if there is one, otherwise the drawing's lines
async function saCrop(box) {
  const [x0, y0, x1, y1] = box, wm = x1 - x0, hm = y1 - y0, S = 1568, W = wm >= hm ? S : Math.round(S * wm / hm), H = wm >= hm ? Math.round(S * hm / wm) : S, k = W / wm;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  const bg = plan.site.bg; let drew = false;
  if (bg && (bg.url || bg.asset)) { try { const img = await ptLoadImage(bg), Wm = bg.w * bg.mpp, Hm = bg.h * bg.mpp;
      g.drawImage(img, (bg.x - x0) * k, (y1 - bg.y) * k, Wm * k, Hm * k); drew = true; } catch (e) { console.warn(e); } }
  if (!drew) { const cd = plan.site.cad, D = cd && CADS[cd.id]; if (!D) return null; g.strokeStyle = "#222"; g.lineWidth = 1.2; g.beginPath();
    for (const q of D.paths) { const p = q.p; g.moveTo((p[0] - x0) * k, (y1 - p[1]) * k); for (let i = 2; i < p.length; i += 2) g.lineTo((p[i] - x0) * k, (y1 - p[i + 1]) * k); } g.stroke(); }
  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.92));
  return { blob, W, H, wm, hm, toW: (u, v) => [Math.round((x0 + u * wm) * 100) / 100, Math.round((y1 - v * hm) * 100) / 100], toUV: (x, y) => [(x - x0) / wm, (y1 - y) / hm] };
}
// what is already on the plan inside the box – so it isn't drawn twice
function saHave(cr, box) {
  const out = [];
  for (const o of plan.obstacles || []) { if (o.zone || o.kind === "dim" || (typeof isVessel === "function" && isVessel(o))) continue; let P; try { P = obsPts(o); } catch (e) { continue; } if (!P || !P.length) continue;
    const U = P.map(p => cr.toUV(p[0], p[1])), u0 = Math.min(...U.map(p => p[0])), u1 = Math.max(...U.map(p => p[0])), v0 = Math.min(...U.map(p => p[1])), v1 = Math.max(...U.map(p => p[1]));
    if (u1 < 0 || v1 < 0 || u0 > 1 || v0 > 1 || (u1 - u0 > 0.95 && v1 - v0 > 0.95)) continue; out.push({ type: o.type || "object", label: o.label || "", box: [u0, v0, u1, v1].map(v => +v.toFixed(3)) }); }
  return out.slice(0, 80);
}
// Claude's answer → site items (not yet on the plan)
function saToObjects(res, cr) {
  const out = [];
  for (const it of (res && res.objects) || []) { const t = SA_TYPES[it.type]; if (!t) continue; const T = OBJ_TYPES[t]; if (!T) continue;
    const pts = (it.pts || []).filter(p => Array.isArray(p) && p.length === 2 && isFinite(+p[0]) && isFinite(+p[1])).map(p => cr.toW(+p[0], +p[1])); if (!pts.length) continue;
    const name = String(it.label || T.name).slice(0, 60), h = +it.height_m > 0 ? +it.height_m : null; let o;
    if (T.kind === "circle") { const c = pts.length > 1 ? centroid(pts) : pts[0]; o = makeObject(t, c); if (t === "tank") { const r = +it.r > 0 ? +it.r * cr.wm : pts.length > 2 ? Math.sqrt(areaOf(pts) / Math.PI) : 0; if (!(r > 0.5)) continue; o.r = Math.round(r * 100) / 100; } }
    else if (T.kind === "line") { if (pts.length < 2) continue; o = makeObject(t, null, pts); }
    else { if (pts.length < 3) continue;
      if (SA_RECT.has(t) && typeof shpMinRect === "function") { const R = shpMinRect(pts); if (!R || R.w < 0.5 || R.h < 0.5) continue; o = makeObject(t, [R.x, R.y]); Object.assign(o, { kind: "rect", x: +R.x.toFixed(2), y: +R.y.toFixed(2), w: +R.w.toFixed(2), h: +R.h.toFixed(2), rot: +R.rot.toFixed(1) }); }
      else o = makeObject(t, null, pts); }
    if (!o) continue; o.label = name + " ~"; if (h != null) o.hgt = h; o.fromPic = true; o.approx = true; out.push(o); }
  return out;
}
// ---- review on the plan: orange outlines, click one to leave it out, then add
function saOverlay() {
  const svg = $("site"); if (!svg) return; let g = svg.querySelector("#saCand"); if (!SA.cand) { if (g) g.remove(); return; }
  if (!g) { g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.id = "saCand"; g.setAttribute("pointer-events", "none"); } svg.appendChild(g);
  let h = ""; if (SA.box) { const [x0, y0, x1, y1] = SA.box; h += `<rect x="${x0}" y="${-y1}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="#1f5fa8" stroke-width="1.2" stroke-dasharray="8 6" vector-effect="non-scaling-stroke"/>`; }
  for (const o of SA.cand) { const P = obsPts(o), on = !o._skip, st = on ? `stroke="#e8590c" stroke-width="2.2"` : `stroke="#9aa3ab" stroke-width="1" stroke-dasharray="3 4"`;
    if (o.kind === "circle") h += `<circle cx="${o.x}" cy="${-o.y}" r="${o.r || 1}" fill="${on ? "rgba(232,89,12,.10)" : "none"}" ${st} vector-effect="non-scaling-stroke"/>`;
    else h += `<path d="M${P.map(p => `${p[0]} ${-p[1]}`).join(" L")}${o.kind === "line" ? "" : "Z"}" fill="${on && o.kind !== "line" ? "rgba(232,89,12,.08)" : "none"}" ${st} vector-effect="non-scaling-stroke"/>`; }
  g.innerHTML = h;
}
function saPanel(msg) {
  let p = $("saBar");
  if (!SA.cand && !msg) { if (p) p.hidden = true; return; }
  if (!p) { p = document.createElement("div"); p.id = "saBar"; p.style.cssText = "position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:32;background:var(--surface,#fff);border:1px solid var(--line,#ccd);border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.18);padding:8px 10px;font-size:13px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:92%"; ($("site").parentNode || document.body).appendChild(p); }
  p.hidden = false;
  if (msg) { p.innerHTML = `<span>${msg}</span>${SA.busy ? "" : `<button id="saX">Close</button>`}`; if ($("saX")) $("saX").onclick = () => { p.hidden = true; }; return; }
  const on = SA.cand.filter(o => !o._skip), by = {}; on.forEach(o => by[o.type] = (by[o.type] || 0) + 1);
  p.innerHTML = `<b>Rebuilt from the picture</b><span class="small">${Object.entries(by).map(([t, n]) => `${n} ${(OBJ_TYPES[t]?.name || t).replace(/ \(draw.*\)$/, "").toLowerCase()}`).join(" · ") || "nothing selected"}</span>
    <span class="small">click one on the plan to leave it out · positions ~ from the picture</span><button class="pri" id="saAdd" ${on.length ? "" : "disabled"}>Add ${on.length} site item${on.length === 1 ? "" : "s"}</button><button id="saNo">Cancel</button>`;
  $("saNo").onclick = () => { SA.cand = null; SA.box = null; saOverlay(); saPanel(); };
  $("saAdd").onclick = () => { const add = SA.cand.filter(o => !o._skip); add.forEach(o => delete o._skip); plan.obstacles.push(...add); SA.cand = null; SA.box = null; saOverlay(); saPanel(); markDirty(); renderAll(); toast(`${add.length} site items added round the lift – check positions and set heights in the Site items list`); };
}
async function saRebuild(which) {
  if (SA.busy) return;
  if (!CAP.sample || !CAP.sampleImages) { toast(CAP.local ? "Rebuilding from the picture needs Claude – click ✦ Link Claude at the top" : "Claude isn't available in this view"); return; }
  if (!plan.site.bg && !(plan.site.cad && CADS[plan.site.cad.id])) { toast("Import the site layout first (picture or drawing)"); return; }
  const box = which === "view" ? saViewBox() : saLiftBox(); if (!box) { toast("Place the crane and load first – or use 'what's on screen'"); return; }
  SA.busy = true; SA.box = box; SA.cand = null; saOverlay(); saPanel("Claude is reading the site round the lift… (30–90 s)");
  try {
    const cr = await saCrop(box); if (!cr) throw new Error("no picture to read");
    const res = await CAP.sample.json(SA_PROMPT(cr.wm, cr.hm, saHave(cr, box)), { images: [cr.blob], modelTier: "complex" });
    const objs = saToObjects(res, cr);
    SA.busy = false;
    if (!objs.length) { SA.box = null; saOverlay(); saPanel("Nothing new found in that area" + (res && res.notes ? " – " + escH(res.notes) : "")); return; }
    SA.cand = objs; saOverlay(); saPanel(); if (res && res.notes) toast("Claude: " + String(res.notes).slice(0, 160));
  } catch (e) { console.warn(e); SA.busy = false; SA.box = null; saOverlay(); saPanel("Couldn't rebuild the area (" + escH(e.message || String(e)) + ")"); }
}
{ const _rs = renderSite; renderSite = function (...a) { const r = _rs.apply(this, a); try { saOverlay(); } catch (e) { } return r; }; }
(() => { const svg = $("site"); if (!svg) return;
  (svg.parentNode || svg).addEventListener("pointerdown", e => { if (!SA.cand || e.button !== 0 || !svg.contains(e.target)) return; const w = toWorld(e), tol = 6 / view.s;
    const hit = SA.cand.find(o => { if (o.kind === "circle") return Math.hypot(w[0] - o.x, w[1] - o.y) <= (o.r || 1) + tol; const P = obsPts(o); if (o.kind === "line") return P.some((q, k) => k < P.length - 1 && segDist(w, q, P[k + 1]) < tol); return shpInside(w, P); });
    if (!hit) return; hit._skip = !hit._skip; e.stopImmediatePropagation(); e.preventDefault(); saOverlay(); saPanel(); }, true); })();
// the buttons: in the layout tools (picture or drawing) and next to the site items
{ const _rl = renderLayoutTools; renderLayoutTools = function (...a) { const r = _rl.apply(this, a);
    try { const box = $("ltBoxUI"); if (box && !box.hidden && !box.querySelector("#saGo")) { const row = document.createElement("div"); row.className = "ltrow";
        row.innerHTML = `<button id="saGo" class="pri" title="Claude reads the picture round the lift and rebuilds it as site items – roads, fences, buildings, racks, tanks…">✦ Rebuild the site round the lift</button><button id="saView" title="Same, for the area on screen">… what's on screen</button>`;
        box.appendChild(row); $("saGo").onclick = () => saRebuild("lift"); $("saView").onclick = () => saRebuild("view"); } } catch (e) { console.warn(e); }
    return r; }; }
// ---- a site-items file (built from the picture outside the app): its items are added to the open plan for review.
// The file says which picture it was read from; if this plan's copy of that picture sits elsewhere, the items follow it.
function saFromFile(d) {
  if ($("dStart") && $("dStart").open) { toast("Open the lift plan first, then import the site items file"); return; }
  const bg = plan.site.bg, ref = d.bgRef || null;
  // through the picture's own pixels: the file's position on its copy of the picture → this plan's copy (moved, scaled or turned)
  let map = (x, y) => [x, y];
  if (ref && bg && +bg.mpp > 0 && Math.abs((+bg.w || 0) - (+ref.w || 0)) < 2) {
    const W = bg.w * bg.mpp, H = bg.h * bg.mpp, C = [bg.x + W / 2, bg.y - H / 2], a = (+bg.rot || 0) * D2R, c = Math.cos(a), s2 = Math.sin(a);
    map = (x, y) => { const px = (x - ref.x) / ref.mpp, py = (ref.y - y) / ref.mpp, u = bg.x + px * bg.mpp - C[0], v = bg.y - py * bg.mpp - C[1]; return [C[0] + u * c - v * s2, C[1] + u * s2 + v * c]; };
  } else if (ref && !bg) toast("This plan has no site picture – the items are placed at the file's own site positions");
  const cr = { wm: 1, toW: (x, y) => map(x, y).map(v => Math.round(v * 100) / 100) };
  const objs = saToObjects({ objects: (d.objects || []).map(o => ({ ...o, r: o.r != null ? o.r * k : o.r })) }, cr);
  objs.forEach(o => { o.label = o.label.replace(/ ~ ~$/, " ~"); });
  if (!objs.length) { toast("No site items in that file"); return; }
  SA.cand = objs; SA.box = null; saOverlay(); saPanel(); toast(`${objs.length} site items read from the file – check them on the plan, then Add`);
  const P = objs.flatMap(o => obsPts(o)); if (P.length) { const xs = P.map(p => p[0]), ys = P.map(p => p[1]); view.cx = (Math.min(...xs) + Math.max(...xs)) / 2; view.cy = (Math.min(...ys) + Math.max(...ys)) / 2; renderSite(); }
}
{ const inp = $("restoreFile"); if (inp) { const _ch = inp.onchange; inp.onchange = async e => {
    const f = e.target.files && e.target.files[0]; if (f && /json/i.test(f.type + f.name)) { try { const d = JSON.parse(await f.text()); if (d && d.liftplanSiteItems) { e.target.value = ""; saFromFile(d); return; } } catch (err) { } }
    return _ch && _ch.call(inp, e); }; } }
