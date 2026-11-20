// ================= Site from the drawing: a working site, not a picture =================
// On import the drawing is (1) cleaned of sheet items – frame, title block, legend, north arrow, notes – and
// (2) turned into real site objects: quay / jetty deck, buildings, bollards, tanks… that you can select, move,
// resize, lock and see in Side / 3D. The leftover linework stays underneath as a faint reference you can hide.

// ---------- 1. sheet items ----------
function sheetClean(D) {
  const SB = D.sheetBox; if (!SB || !D.paths.length) return null;
  const sw = SB[2] - SB[0], sh = SB[3] - SB[1], diag = Math.hypot(sw, sh);
  const NP = D.paths.length, NT = D.texts.length;
  const out = new Uint8Array(NP + NT);
  // frame lines: long straight lines hugging the sheet edge (a frame drawn as 4 separate lines)
  D.paths.forEach((q, j) => {
    const p = q.p; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
    const w = x1 - x0, h = y1 - y0, nearX = Math.min(x0 - SB[0], SB[2] - x1) < sw * 0.1, nearY = Math.min(y0 - SB[1], SB[3] - y1) < sh * 0.1;
    if ((w > sw * 0.6 && h < sh * 0.01 && nearY) || (h > sh * 0.6 && w < sw * 0.01 && nearX) || (w > sw * 0.8 && h > sh * 0.8)) out[j] = 1;
  });
  // title blocks and legends are boxes: find the axis-aligned rectangles with several labels in them near the sheet edge
  let nBoxes = 0; const boxes = sheetBoxes(D, SB);
  // a legend box tells what each colour means – read it before it comes off the drawing
  for (const R of boxes) { const L = readLegend(D, R); if (L.length >= 2 || (L.length && D.texts.some(t => /l[ée]gende|legend|\bkey\b/i.test(t[4]) && t[0] >= R[0] && t[0] <= R[2] && t[1] >= R[1] && t[1] <= R[3]))) D.legend = [...(D.legend || []), ...L]; }
  for (const R of boxes) {
    nBoxes++; const t = 0.3, inR = (x, y) => x >= R[0] - t && x <= R[2] + t && y >= R[1] - t && y <= R[3] + t;
    D.paths.forEach((q, j) => { if (out[j]) return; for (let i = 0; i < q.p.length; i += 2) if (!inR(q.p[i], q.p[i + 1])) return; out[j] = 1; });
    D.texts.forEach((x, j) => { if (inR(x[0], x[1])) out[NP + j] = 1; });
  }
  // group everything that touches into clusters (north arrow, notes, scale bar stand on their own)
  let g = Math.max(0.4, diag * 0.005), total = 0;
  for (const q of D.paths) for (let i = 2; i < q.p.length; i += 2) total += Math.hypot(q.p[i] - q.p[i - 2], q.p[i + 1] - q.p[i - 1]);
  if (total / (g / 2) > 300000) g = total / 150000;
  const par = new Int32Array(NP + NT); for (let i = 0; i < par.length; i++) par[i] = i;
  const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  const cells = new Map(), put = (x, y, i) => { const k = Math.floor(x / g) + "," + Math.floor(y / g), c = cells.get(k); if (c == null) cells.set(k, i); else uni(c, i); };
  const segs = q => { const p = q.p, n = p.length / 2, S = []; for (let i = 1; i < n; i++) S.push([p[2 * i - 2], p[2 * i - 1], p[2 * i], p[2 * i + 1]]); if (q.c && n > 2) S.push([p[2 * n - 2], p[2 * n - 1], p[0], p[1]]); return S; };
  D.paths.forEach((q, j) => { if (out[j]) return; put(q.p[0], q.p[1], j); for (const [ax, ay, bx, by] of segs(q)) { const L = Math.hypot(bx - ax, by - ay), m = Math.max(1, Math.ceil(L / (g / 2))); for (let k = 1; k <= m; k++) put(ax + (bx - ax) * k / m, ay + (by - ay) * k / m, j); } });
  D.texts.forEach((t, j) => { if (out[NP + j]) return; const i = NP + j, L = Math.max(t[2], (t[4] || "").length * t[2] * 0.55), a = (+t[3] || 0) * D2R; put(t[0], t[1], i); put(t[0] + Math.cos(a) * L, t[1] + Math.sin(a) * L, i); put(t[0] + Math.cos(a) * L / 2, t[1] + Math.sin(a) * L / 2, i); });
  for (const [k, i] of cells) { const [cx, cy] = k.split(",").map(Number); for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { const n = cells.get((cx + dx) + "," + (cy + dy)); if (n != null) uni(i, n); } }
  // describe each cluster
  const CL = new Map(), cl = r => { if (!CL.has(r)) CL.set(r, { b: [1e9, 1e9, -1e9, -1e9], len: 0, ax: 0, nT: 0, nP: 0, ids: [] }); return CL.get(r); };
  const grow = (C, x, y) => { C.b[0] = Math.min(C.b[0], x); C.b[1] = Math.min(C.b[1], y); C.b[2] = Math.max(C.b[2], x); C.b[3] = Math.max(C.b[3], y); };
  D.paths.forEach((q, j) => { if (out[j]) return; const C = cl(find(j)); C.ids.push(j); C.nP++; for (const [ax, ay, bx, by] of segs(q)) { const L = Math.hypot(bx - ax, by - ay); C.len += L; if (Math.abs(bx - ax) < L * 0.01 || Math.abs(by - ay) < L * 0.01) C.ax += L; grow(C, ax, ay); grow(C, bx, by); } if (q.p.length === 2) grow(C, q.p[0], q.p[1]); });
  D.texts.forEach((t, j) => { if (out[NP + j]) return; const C = cl(find(NP + j)); C.ids.push(NP + j); C.nT++; grow(C, t[0], t[1]); });
  const area = b => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]), dg = b => Math.hypot(b[2] - b[0], b[3] - b[1]);
  const inBand = b => b[0] - SB[0] < sw * 0.2 || SB[2] - b[2] < sw * 0.2 || b[1] - SB[1] < sh * 0.2 || SB[3] - b[3] < sh * 0.2;
  const all = [...CL.values()];
  for (const C of all) C.boxy = C.nP > 0 && C.len > 0 && C.ax / C.len >= 0.85 && C.nT >= 1 && area(C.b) < sw * sh * 0.35 && inBand(C.b);
  const main = all.filter(C => C.nP && !C.boxy).sort((a, b) => area(b.b) - area(a.b))[0];
  if (!main && !nBoxes) return null;
  const mb = main ? main.b : SB, inside = b => { const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; return cx >= mb[0] && cx <= mb[2] && cy >= mb[1] && cy <= mb[3]; };
  let nGroups = nBoxes;
  for (const C of all) {
    if (C === main) continue;
    const near = boxes.some(R => C.b[0] <= R[2] + 2 * g && C.b[2] >= R[0] - 2 * g && C.b[1] <= R[3] + 2 * g && C.b[3] >= R[1] - 2 * g);   // drawn against the title block / legend
    const furn = C.boxy || (!inside(C.b) && (dg(C.b) < diag * 0.08 || C.nP === 0 || (near && C.ax / (C.len || 1) > 0.8)));
    if (furn) { nGroups++; for (const i of C.ids) out[i] = 1; }
  }
  const sheet = { paths: D.paths.filter((_, j) => out[j]), texts: D.texts.filter((_, j) => out[NP + j]) };
  if (!sheet.paths.length && !sheet.texts.length) return null;
  D.paths = D.paths.filter((_, j) => !out[j]); D.texts = D.texts.filter((_, j) => !out[NP + j]);
  D.sheet = { paths: [...(D.sheet?.paths || []), ...sheet.paths], texts: [...(D.sheet?.texts || []), ...sheet.texts], groups: (D.sheet?.groups || 0) + nGroups };
  return D.sheet;
}
// ---------- legends: each row = a coloured symbol + its meaning ----------
const isGreyish = c => { if (!c || c.length < 7) return true; const v = [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16)); return Math.max(...v) - Math.min(...v) < 30; };
function readLegend(D, R) {
  const inR = (x, y) => x >= R[0] && x <= R[2] && y >= R[1] && y <= R[3];
  const rows = D.texts.filter(t => inR(t[0], t[1]) && /[a-z]{2}/i.test(t[4]) && !/l[ée]gende|legend|\bkey\b/i.test(t[4]));
  const out = [];
  for (const t of rows) {
    const h = Math.max(0.3, t[2]), cy = t[1] + h * 0.35, fills = new Set(), strokes = new Set(); let line = false, sym = 0;
    for (const q of D.paths) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < q.p.length; i += 2) { x0 = Math.min(x0, q.p[i]); x1 = Math.max(x1, q.p[i]); y0 = Math.min(y0, q.p[i + 1]); y1 = Math.max(y1, q.p[i + 1]); }
      if (!inR(x0, y0) || !inR(x1, y1) || x1 > t[0] + h * 0.2 || x0 < t[0] - h * 8 || Math.abs((y0 + y1) / 2 - cy) > h * 0.9) continue;
      if (x1 - x0 > (R[2] - R[0]) * 0.6) continue;             // the box border
      if (q.f && !isGreyish(q.f)) fills.add(q.f); if (q.s && !isGreyish(q.s)) strokes.add(q.s);
      if (!q.c && q.p.length <= 6) line = true; sym++;
    }
    if (!sym || (!fills.size && !strokes.size)) continue;
    out.push({ label: t[4].replace(/^[-–•·\s]+/, "").trim(), fills: [...fills], strokes: [...strokes], line });
  }
  return out;
}
// what a legend label means for lift planning
function legendType(label, closed) {
  const s = String(label || "");
  if (/conteneur|container/i.test(s)) return "stack";
  if (/r[ée]s[ea]+ux?|us[ée]es|eaux|assainissement|drain|sewer|[ée]gout|canalisation|pluvial/i.test(s)) return closed ? "manhole" : "drain";
  if (/fosse|regard|puisard|manhole|\bpit\b|chambre|trappe/i.test(s)) return "manhole";
  if (/poteau|pyl[ôo]ne|\bpole\b|lampadaire|m[âa]t\b|light ?tower|[ée]clairage/i.test(s) || /ligne|\bline\b|c[âa]ble|\bm\.?t\.?\b|\bb\.?t\.?\b|\bh\.?t\.?\b/i.test(s)) return closed ? "pole" : "powerline";
  if (/gu[ée]rite|poste de garde|gate ?house|cabin|bureau|office|\bwc\b|toilet|sanitaire|vestiaire|r[ée]fectoire|container office/i.test(s)) return "cabin";
  if (/magasin|hangar|entrep[oô]t|warehouse|shed/i.test(s)) return "warehouse";
  if (/b[âa]timent|building|atelier|workshop/i.test(s)) return "building";
  if (/citerne|cuve|r[ée]servoir|tank|silo/i.test(s)) return "tank";
  if (/cl[ôo]ture|fence|grillage/i.test(s)) return "fence";
  if (/\bmur\b|\bwall\b/i.test(s)) return "wall";
  if (/bollard|bitte|bollard/i.test(s)) return "bollard";
  if (/route|road|voie|chauss[ée]e/i.test(s)) return closed ? "road" : null;
  if (/parking|stockage|laydown|aire/i.test(s)) return "laydown";
  return null;
}
// dashed lines (power lines, drains…) come as many short dashes: chain the dashes of one colour into polylines
function chainDashes(D, colours, skip) {
  const segs = [];
  D.paths.forEach((q, j) => { if (skip.has(j) || q.c || !colours.has(q.s)) return; for (let i = 2; i < q.p.length; i += 2) segs.push({ a: [q.p[i - 2], q.p[i - 1]], b: [q.p[i], q.p[i + 1]], j }); });
  if (segs.length < 2) return [];
  const Ls = segs.map(s => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])).sort((a, b) => a - b), med = Ls[Ls.length >> 1] || 1, gapTol = Math.max(1.5, med * 3);
  const par = segs.map((_, i) => i), find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const dir = s => Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]), adiff = (x, y) => { let d = Math.abs(x - y) % Math.PI; return Math.min(d, Math.PI - d); };
  const cell = gapTol, grid = new Map(), key = p => Math.floor(p[0] / cell) + "," + Math.floor(p[1] / cell);
  segs.forEach((s, i) => { for (const p of [s.a, s.b]) { const k = key(p); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); } });
  segs.forEach((s, i) => { for (const p of [s.a, s.b]) { const [cx, cy] = key(p).split(",").map(Number); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of grid.get((cx + dx) + "," + (cy + dy)) || []) {
    if (j <= i) continue; const t = segs[j], d = Math.min(...[[s.a, t.a], [s.a, t.b], [s.b, t.a], [s.b, t.b]].map(([u, v]) => Math.hypot(u[0] - v[0], u[1] - v[1])));
    if (d <= gapTol && adiff(dir(s), dir(t)) < 0.35) par[find(i)] = find(j); } } });
  const groups = new Map(); segs.forEach((s, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(s); });
  const out = [];
  for (const G of groups.values()) {
    const pts = G.flatMap(s => [s.a, s.b]); let len = G.reduce((a, s) => a + Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), 0); if (len < 8 || G.length < 3) continue;
    // order along the main direction, then keep the corners
    const c = centroid(pts); let sxx = 0, sxy = 0, syy = 0; for (const p of pts) { const x = p[0] - c[0], y = p[1] - c[1]; sxx += x * x; sxy += x * y; syy += y * y; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), u = [Math.cos(ang), Math.sin(ang)];
    const ord = pts.slice().sort((p, q) => (p[0] * u[0] + p[1] * u[1]) - (q[0] * u[0] + q[1] * u[1]));
    const rdp = (P, eps) => { if (P.length < 3) return P; let id = 0, dm = 0; for (let i = 1; i < P.length - 1; i++) { const d = segDist(P[i], P[0], P[P.length - 1]); if (d > dm) { dm = d; id = i; } } return dm > eps ? [...rdp(P.slice(0, id + 1), eps).slice(0, -1), ...rdp(P.slice(id), eps)] : [P[0], P[P.length - 1]]; };
    out.push({ pts: rdp(ord, 1.0).map(p => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]), src: [...new Set(G.map(s => s.j))] });
  }
  return out;
}
// axis-aligned rectangles (drawn as one path or as separate lines) holding 3+ labels, near the sheet edge – the biggest ones only
function sheetBoxes(D, SB) {
  const sw = SB[2] - SB[0], sh = SB[3] - SB[1], minL = Math.min(sw, sh) * 0.04, tol = Math.max(0.05, Math.hypot(sw, sh) * 0.0008);
  let H = [], V = [];
  for (const q of D.paths) { const p = q.p, n = p.length / 2; for (let i = 1; i <= (q.c ? n : n - 1); i++) { const ax = p[2 * i - 2], ay = p[2 * i - 1], bx = p[(2 * i) % (2 * n)], by = p[(2 * i + 1) % (2 * n)], L = Math.hypot(bx - ax, by - ay); if (L < minL) continue;
    if (Math.abs(by - ay) < L * 0.003) H.push([Math.min(ax, bx), Math.max(ax, bx), (ay + by) / 2]); else if (Math.abs(bx - ax) < L * 0.003) V.push([Math.min(ay, by), Math.max(ay, by), (ax + bx) / 2]); } }
  const merge = A => { A.sort((a, b) => a[2] - b[2] || a[0] - b[0]); const M = []; for (const s of A) { const m = M[M.length - 1]; if (m && Math.abs(m[2] - s[2]) < tol && s[0] <= m[1] + tol) m[1] = Math.max(m[1], s[1]); else M.push(s.slice()); } return M.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, 300); };
  H = merge(H); V = merge(V);
  const band = R => R[0] - SB[0] < sw * 0.25 || SB[2] - R[2] < sw * 0.25 || R[1] - SB[1] < sh * 0.25 || SB[3] - R[3] < sh * 0.25;
  const nText = R => D.texts.reduce((n, t) => n + (t[0] >= R[0] && t[0] <= R[2] && t[1] >= R[1] && t[1] <= R[3] ? 1 : 0), 0);
  const R = [];
  for (let i = 0; i < H.length; i++) for (let j = 0; j < H.length; j++) {
    const a = H[i], b = H[j]; if (b[2] - a[2] < minL * 0.5) continue;
    const x0 = Math.max(a[0], b[0]), x1 = Math.min(a[1], b[1]); if (x1 - x0 < minL) continue;
    const vs = V.filter(v => v[2] >= x0 - tol && v[2] <= x1 + tol && v[0] <= a[2] + tol && v[1] >= b[2] - tol); if (vs.length < 2) continue;
    const xl = Math.min(...vs.map(v => v[2])), xr = Math.max(...vs.map(v => v[2])); if (xr - xl < minL) continue;
    const r = [xl, a[2], xr, b[2]], A = (xr - xl) * (b[2] - a[2]);
    if (A > sw * sh * 0.35 || (xr - xl) > sw * 0.95 && (b[2] - a[2]) > sh * 0.5 || !band(r) || nText(r) < 3) continue;
    R.push(r);
  }
  // keep the outermost boxes
  const inside = (r, o) => r !== o && r[0] >= o[0] - tol && r[1] >= o[1] - tol && r[2] <= o[2] + tol && r[3] <= o[3] + tol;
  return R.filter(r => !R.some(o => inside(r, o)));
}
function sheetRestore() {
  const k = ltCad(); if (!k || !k.D.sheet) return;
  ltSnap("put sheet items back");
  k.D.paths.push(...k.D.sheet.paths); k.D.texts.push(...k.D.sheet.texts); delete k.D.sheet;
  ltRecalcBBox(k.D); ltSaveCad(); markDirty(); renderAll(); renderMeta(); toast("Title block, legend and notes put back on the drawing");
}
function sheetRemoveAgain() {
  const k = ltCad(); if (!k) return;
  ltSnap("remove sheet items");
  if (!k.D.sheetBox) k.D.sheetBox = k.D.bbox.slice();
  const r = sheetClean(k.D); if (!r) { LT.undo.pop(); toast("No title block, legend or notes found – use Erase area"); return; }
  ltRecalcBBox(k.D); ltSaveCad(); markDirty(); renderAll(); renderMeta(); ltFit(); toast(`Removed ${r.groups} sheet item${r.groups === 1 ? "" : "s"} (title block, legend, north arrow, notes)`);
}

// ---------- 2. objects ----------
OBJ_TYPES.deck = { name: "Quay / jetty deck (draw)", cat: "Marine", kind: "poly", draw: true, hgt: 0, pass: true, color: "#b8bdb6" };
OBJ_TYPES.pole = { name: "Electric / light pole", cat: "Hazards", kind: "circle", r: 0.25, hgt: 10, color: "#7a6a3a" };
OBJ_TYPES.manhole = { name: "Manhole / pit – keep pads off", cat: "Hazards", kind: "rect", w: 1, h: 1, hgt: 0, pass: true, color: "#1f5fa8" };
OBJ_TYPES.drain = { name: "Underground drain / service (draw)", cat: "Hazards", kind: "line", draw: true, hgt: 0, pass: true, color: "#1f5fa8" };
const SB_TYPES = { quay: "deck", warehouse: "warehouse", cabin: "cabin", building: "building", tank: "tank", road: "road", laydown: "laydown", stack: "stack", water: "water", pipes: "pipes" };
function siteFromCad(D, cadId) {
  const { closed, closedSrc } = cadShapes(D);
  const bbA = (D.bbox[2] - D.bbox[0]) * (D.bbox[3] - D.bbox[1]);
  const typeFor = s => (KEYWORDS.find(([re]) => re.test(s)) || [])[1] || "";
  let lastLab = -1;
  const labelIn = P => { let best = -1; D.texts.forEach((t, i) => { if (inPolyPt([t[0], t[1]], P) && /[a-z]{3}/i.test(t[4]) && (best < 0 || t[2] > D.texts[best][2])) best = i; }); lastLab = best; return best >= 0 ? D.texts[best][4] : ""; };
  const r2 = v => Math.round(v * 100) / 100;
  // unique shapes (a filled + stroked outline comes through twice)
  const seen = new Map(), S = [];
  closed.forEach((P, i) => { const A = areaOf(P); if (A < 0.05) return; const c = centroid(P), k = Math.round(c[0] * 5) + ":" + Math.round(c[1] * 5) + ":" + Math.round(Math.sqrt(A) * 5); if (seen.has(k)) { seen.get(k).src.push(...closedSrc[i]); return; } const s = { P, A, c, src: closedSrc[i].slice() }; seen.set(k, s); S.push(s); });
  S.sort((a, b) => b.A - a.A);
  // each object carries the drawing lines (and label) it was made from: those come off the drawing, so deleting the object really removes it
  let cur = null;
  const objs = [], tag = o => { o.src = "drawing"; o.cad = cadId; o.imported = true; Object.defineProperty(o, "_from", { value: { paths: cur.src, text: lastLab }, enumerable: false }); objs.push(o); return o; };
  // the deck: the biggest outline that covers a good part of the site
  let deck = null;
  if (S.length && S[0].A >= Math.max(400, bbA * 0.12) && S[0].A <= bbA * 0.98) {
    deck = S.shift(); cur = deck; const lab = labelIn(deck.P), o = makeObject("deck", null, simplify(deck.P));
    o.label = lab && typeFor(lab) === "quay" ? lab.slice(0, 40) : "Quay deck"; o.locked = true; tag(o);   // the ground everything stands on – locked so a drag pans instead of moving it
  }
  let nB = 0, nBl = 0;
  // the legend decides what a coloured shape is (fill colour first – it's the specific one; a stroke only when one entry uses it)
  const LEG = (D.legend || []).map(e => ({ ...e, closedType: legendType(e.label, true), lineType: legendType(e.label, false) }));
  const strokeOwners = {}; for (const e of LEG) for (const c of e.strokes) strokeOwners[c] = (strokeOwners[c] || 0) + 1;
  const legendFor = src => { const F = new Set(), St = new Set(); for (const j of src) { const q = D.paths[j]; if (!q) continue; if (q.f && !isGreyish(q.f)) F.add(q.f); if (q.s && !isGreyish(q.s)) St.add(q.s); }
    return LEG.find(e => e.fills.some(c => F.has(c))) || LEG.find(e => e.strokes.some(c => St.has(c) && strokeOwners[c] === 1)) || null; };
  const levelNear = (c, r) => D.texts.some(t => /^[+-]?\d+[.,]\d{2,3}$/.test(t[4].trim()) && Math.hypot(t[0] - c[0], t[1] - c[1]) < r + 3);
  const deckSrc = new Set(deck ? deck.src : []);
  for (const s of S) {
    cur = s; lastLab = -1;
    const c = s.c, rr = s.P.map(p => Math.hypot(p[0] - c[0], p[1] - c[1])), mx = Math.max(...rr), mn = Math.min(...rr);
    const round = s.P.length >= 8 && mn > 0 && mx / mn < 1.3, R = (mx + mn) / 2;
    const L = LEG.length ? legendFor(s.src) : null, lt = L && L.closedType;
    if (L && lt && s.A < 20000) {                      // typed by the drawing's own legend
      const P = simplify(s.P); let o;
      if (lt === "pole" || lt === "tank" || lt === "bollard") { o = makeObject(lt, c); o.r = Math.max(lt === "pole" ? 0.2 : 0.3, r2(Math.min(R, lt === "pole" ? 0.6 : R))); }
      else if (lt === "manhole") { o = makeObject("manhole", null, P); }
      else if (lt === "stack") { o = makeObject("stack", null, P); o.tiers = 1; o.hgt = 2.6; const sides = P.map((p, i) => Math.hypot(P[(i + 1) % P.length][0] - p[0], P[(i + 1) % P.length][1] - p[1])), Lm = Math.max(...sides); const A = areaOf(P); o.label = A > 40 ? `Container stack (≈${Math.max(2, Math.round(A / 29.7))} × 40 ft footprint)` : Lm > 10 ? "40 ft container" : Lm > 4.5 ? "20 ft container" : L.label; }
      else { o = makeObject(lt, null, P); if (lt === "cabin") o.hgt = /wc|toilet/i.test(L.label) ? 2.5 : 2.8; }
      if (lt !== "stack" || !o.label) o.label = L.label.slice(0, 40);
      if (lt === "pole") o.hgt = 10;
      if (lt === "pole" || lt === "manhole") { o.note = L.label; o.label = ""; }
      o.byLegend = true; lastLab = -1; tag(o); nB++; continue;
    }
    if (round && R >= 0.22 && R <= 1.0) {
      if (LEG.length || levelNear(c, R)) continue;       // a survey point (level beside it) or a symbol the legend doesn't explain – not a bollard
      if (nBl++ < 400) { const o = makeObject("bollard", c); o.r = Math.max(0.2, r2(R)); o.label = ""; lastLab = -1; tag(o); } continue; }
    if (s.A < 6 || s.A > 6000) continue;
    const lab = labelIn(s.P), ty = SB_TYPES[typeFor(lab)] || "", P = simplify(s.P);
    if (typeFor(lab) === "zone") { const z = { id: uid(), kind: "poly", zone: true, zt: "nogo", label: lab.slice(0, 40), pts: P, color: "#c0392b", hgt: 1.1 }; tag(z); nB++; continue; }   // restricted / controlled areas → no-go zones the load path is checked against
    if (round && (ty === "tank" || (!ty && R > 1.5))) { const o = makeObject("tank", c); o.r = r2(R); o.label = lab ? lab.slice(0, 40) : "Tank / silo"; tag(o); nB++; continue; }
    if (ty === "deck") continue;
    if (nB >= 150) continue;
    const o = makeObject(ty || "building", null, P); o.label = lab ? lab.slice(0, 40) : "Structure"; if (!ty) o.hgt = 4; tag(o); nB++;
  }
  // legend lines: dashed / solid lines in a legend colour → power lines, drains, fences…
  for (const e of LEG) {
    const lt = e.lineType; if (!lt || !["powerline", "drain", "fence", "wall"].includes(lt) || !e.strokes.length) continue;
    const cols = new Set(e.strokes.filter(c => strokeOwners[c] === 1 || e.line)), used = new Set([...deckSrc, ...objs.flatMap(o => o._from.paths)]);
    for (const ch of chainDashes(D, cols, used)) { cur = { src: ch.src }; lastLab = -1; const o = makeObject(lt, null, ch.pts); o.label = e.label.slice(0, 40); o.byLegend = true; if (lt === "powerline") { o.hgt = 9; o.clear = 5; } tag(o); }
  }
  return objs;
}
// drop near-collinear points so a traced outline stays editable
function simplify(P, tol = 0.05) {
  if (P.length <= 4) return P.map(p => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]);
  const keep = [];
  for (let i = 0; i < P.length; i++) { const a = P[(i - 1 + P.length) % P.length], b = P[i], c = P[(i + 1) % P.length]; if (segDist(b, a, c) > tol) keep.push(b); }
  const R = keep.length >= 3 ? keep : P;
  return (R.length > 80 ? R.filter((_, i) => i % Math.ceil(R.length / 80) === 0) : R).map(p => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]);
}
const fromDrawing = o => o.src === "drawing";
function buildSiteObjects(quiet) {
  const k = ltCad(); if (!k) return 0;
  ltSnap("site build");
  if (k.D.used) { k.D.paths.push(...k.D.used.paths); k.D.texts.push(...k.D.used.texts); delete k.D.used; }
  plan.obstacles = plan.obstacles.filter(o => !(fromDrawing(o) && o.cad === k.c.id && !o.locked));
  const have = new Set(plan.obstacles.filter(o => fromDrawing(o)).map(o => o.type + ":" + Math.round(centroid(o.pts || [[o.x, o.y]])[0]) + ":" + Math.round(centroid(o.pts || [[o.x, o.y]])[1])));
  const all = siteFromCad(k.D, k.c.id);
  const objs = all.filter(o => !have.has(o.type + ":" + Math.round(centroid(o.pts || [[o.x, o.y]])[0]) + ":" + Math.round(centroid(o.pts || [[o.x, o.y]])[1])));
  plan.obstacles.unshift(...objs);
  // the lines and labels now living as objects come off the drawing (kept aside, so "Show all drawing lines" can put them back)
  const P = new Set(), T = new Set(); for (const o of all) { o._from.paths.forEach(j => P.add(j)); if (o._from.text >= 0) T.add(o._from.text); }
  if (P.size || T.size) {
    const used = k.D.used || (k.D.used = { paths: [], texts: [] });
    used.paths.push(...k.D.paths.filter((_, j) => P.has(j))); used.texts.push(...k.D.texts.filter((_, j) => T.has(j)));
    k.D.paths = k.D.paths.filter((_, j) => !P.has(j)); k.D.texts = k.D.texts.filter((_, j) => !T.has(j));
    ltSaveCad();
  }
  if (objs.length) k.c.op = Math.min(k.c.op ?? 0.9, 0.6);
  k.c.built = Date.now(); k.c.v = (k.c.v || 0) + 1;
  markDirty(); renderAll(); renderMeta();
  if (!quiet) toast(objs.length ? `Site built: ${sbSummary(objs)}` : "No shapes on the drawing could be turned into objects – draw them with + Objects");
  return objs.length;
}
function sbSummary(objs) {
  const grp = { deck: "deck", bollard: "bollard", tank: "tank", stack: "container", building: "building", warehouse: "building", cabin: "cabin", road: "road", laydown: "laydown area", water: "water area", pole: "pole", manhole: "manhole / pit", drain: "drain line", powerline: "power line", fence: "fence", wall: "wall" };
  const n = {}; for (const o of objs) { const nm = o.zone ? "no-go zone" : grp[o.type] || "other item"; n[nm] = (n[nm] || 0) + 1; }
  return Object.entries(n).map(([k, v]) => `${v} ${k}${v === 1 ? "" : "s"}`).join(" · ") || "nothing";
}
// called by the PDF import once the lines are in
function siteFromDrawing() {
  const k = ltCad(); if (!k) return;
  LT.undo = [];
  const n = buildSiteObjects(true), sh = k.D.sheet;
  // the objects are the site only when the main outline (deck) was found – otherwise the drawing stays on screen
  const hasDeck = plan.obstacles.some(o => o.type === "deck" && fromDrawing(o) && o.cad === k.c.id);
  const bg = plan.site.bg, pic = bg && bg.fromPdf === k.c.id;
  if (pic) k.c.show = false;                                    // the page picture already shows the lines – no need to draw them twice
  if (n && hasDeck) { k.c.show = false; if (pic) bg.show = false; }
  else if (pic) bg.show = true;
  else k.c.show = true;
  fitView(); renderAll(); renderMeta(); setTimeout(ltFit, 30);
  const objs = plan.obstacles.filter(o => fromDrawing(o) && o.cad === k.c.id);
  toast(`${n ? "Site built from the drawing: " + sbSummary(objs) + "." : "Drawing imported."}${sh ? ` Title block, legend and notes removed.` : ""} Check the scale with Set scale, then lock the site.`, 9000);
}

// ---------- 3. the site in Side / 3D ----------
// the sea in Side / 3D: at the moored vessels' waterline (deck height − freeboard), so a quay high above the water shows its full face
function siteWaterLevel() {
  const vs = plan.obstacles.filter(o => typeof isVessel === "function" && isVessel(o)).map(o => (+o.deckH || 0) - (+o.fb || 2.5)).sort((a, c) => a - c);
  return Math.max(-12, Math.min(-0.3, vs.length ? vs[vs.length >> 1] : -1.25));
}
function obj3DDeck(M, o, P2) { M.prism(P2, Math.min(-1.6, siteWaterLevel() - 0.6), 0, obsColor(o), { bias: -1e5 }); return true; }   // always drawn first: it is the ground everything stands on
{ const _os = objScene; objScene = function (o) {
    if (o.type !== "deck" || !o.pts) return _os(o);
    const s = new Scene(), P = o.pts;
    const drw = (plan.site.bg && plan.site.bg.show !== false && (plan.site.bg.url || plan.site.bg.asset)) || (plan.site.cad && plan.site.cad.show !== false);
    s.poly("LOAD", P, { closed: true, fill: drw ? "rgba(190,194,188,.12)" : "rgba(190,194,188,.55)", color: "#4d5863", w: 2.2 });   // see-through over the drawing
    if (o.label) { const c = centroid(P); s.text("TEXT", c, o.label, 1.4, { bold: true, color: "#5c6670" }); }
    return s;
  }; }
{ const _o3 = obj3D; obj3D = function (M, o, P2) { if (o.type === "deck") return obj3DDeck(M, o, P2); return _o3(M, o, P2); }; }
const siteIsMarine = () => plan.obstacles.some(o => o.type === "deck" || o.type === "quay" || o.type === "water") || plan.obstacles.some(o => typeof isVessel === "function" && isVessel(o));
// the drawing lines / site picture on the ground of the 3D view (an orthographic view keeps the ground plane affine)
function site3DUnderlay(B, s, cx, cy, W, H) {
  if (V3.mode !== "3d") return "";
  const m = `matrix(${s * B.r[0]} ${-s * B.u[0]} ${-s * B.r[1]} ${s * B.u[1]} ${W / 2 - cx * s} ${H / 2 + cy * s})`;
  let g = "";
  const bg = plan.site.bg;
  if (bg && bg.show !== false) { try { g += `<g transform="${m}" opacity="0.9">${bgMarkup()}</g>`; } catch (e) { } }
  const c = plan.site.cad, D = c && CADS[c.id];
  if (D && c.show !== false) {
    if (cadPathCache.id !== c.id || cadPathCache.v !== (c.v || 0)) cadMarkup();
    g += `<g transform="${m}" opacity="${Math.min(0.8, (c.op ?? 0.9) + 0.15)}"><path d="${cadPathCache.d}" fill="none" stroke="#56606b" stroke-width="0.7" vector-effect="non-scaling-stroke"/></g>`;
  }
  return g;
}

// ---------- 4. locks ----------
const LOCK_KINDS = new Set(["crane", "load", "obs", "hrot", "hsz", "hv", "hmid", "lrot"]);
function lockedTarget(key) {
  const [kind, id] = key.split(":"); if (!LOCK_KINDS.has(kind)) return null;
  const t = plan.cranes.find(c => c.id === id) || plan.loads.find(l => l.id === id) || plan.obstacles.find(o => o.id === id);
  return t && t.locked ? t : null;
}
let _lockToastT = 0;
const lockToast = t => { const n = performance.now(); if (n - _lockToastT > 2500) { _lockToastT = n; toast(`🔒 ${t.label || t.name || "This item"} is locked – unlock it in the panel to move or change it`); } };
{ const _op = objPos; objPos = function (key) {
    const op = _op(key); if (!op) return op;
    const t = lockedTarget(key); if (!t) return op;
    return { get: op.get, set: () => lockToast(t), locked: true, info: () => "🔒 Locked" };
  }; }
{ const _rm = removeItem; removeItem = function (kind, id) {
    const t = (kind === "crane" ? plan.cranes : kind === "load" ? plan.loads : plan.obstacles).find(x => x.id === id);
    if (t && t.locked) { lockToast(t); return; }
    return _rm(kind, id);
  }; }
// handles (resize / rotate / corners) are not drawn on a locked item, and it gets a lock badge
{ const _sp = siteParts; siteParts = function (...a) {
    let parts = _sp(...a);
    const lockedIds = new Set([...plan.obstacles, ...plan.cranes, ...plan.loads].filter(x => x.locked).map(x => x.id));
    if (!lockedIds.size) return parts;
    parts = parts.filter(p => !(p.ui && /^(hsz|hv|hmid|hrot):/.test(p.key || "") && lockedIds.has(p.key.split(":")[1])));
    if (sel && lockedIds.has(sel.id) && a[1]) {
      const t = [...plan.obstacles, ...plan.cranes, ...plan.loads].find(x => x.id === sel.id);
      const at = sel.kind === "obs" ? (t.pts ? centroid(t.pts) : [t.x, t.y]) : sel.kind === "load" ? [t[sel.ph || (plan.phase === "set" ? "set" : "pick")].x, t[sel.ph || (plan.phase === "set" ? "set" : "pick")].y] : [t.x, t.y];
      const s = new Scene(), r = 11 / view.s;
      s.circle("TEXT", [at[0], at[1]], r, { fill: "rgba(22,32,42,.85)", color: "#fff", w: 1 });
      s.text("TEXT", [at[0], at[1] - r * 0.35], "🔒", r * 1.1, { color: "#fff" });
      parts.push({ key: "lockbadge", scene: s, ui: true, nohit: true });
    }
    return parts;
  }; }
// the panels: a lock button beside Remove, and the position / size fields read-only while locked
const LOCK_FIELDS = { crane: ["pX", "pY", "pH", "pHr"], obs: ["oX", "oY", "oW", "oH", "oR", "oRot", "oKind", "oMatP"], load: ["l_pickx", "l_picky", "l_pickr", "l_setx", "l_sety", "l_setr"] };
{ const _rp = renderProps; renderProps = function (...a) {
    const r = _rp(...a);
    try {
      if (!sel) return r;
      const t = (sel.kind === "crane" ? plan.cranes : sel.kind === "load" ? plan.loads : plan.obstacles).find(x => x.id === sel.id); if (!t || t.kind === "dim") return r;
      const del = $(sel.kind === "crane" ? "pDel" : sel.kind === "load" ? "lDel" : "oDel"); if (!del) return r;
      const b = document.createElement("button"); b.id = "bLock"; b.className = "lockbtn" + (t.locked ? " on" : "");
      b.textContent = t.locked ? "🔒 Locked" : "🔓 Lock"; b.title = t.locked ? "Click to unlock – then it can be moved, resized or removed" : "Lock it in place so it can't be moved, resized or removed by accident";
      b.onclick = () => { t.locked = !t.locked; if (!t.locked) delete t.locked; markDirty(); renderAll(); renderMeta(); toast(t.locked ? `🔒 ${t.label || t.name || "Item"} locked` : `🔓 ${t.label || t.name || "Item"} unlocked`); };
      del.before(b);
      if (t.locked) { del.disabled = true; del.title = "Unlock it first"; for (const id of LOCK_FIELDS[sel.kind] || []) if ($(id)) { $(id).disabled = true; $(id).title = "Locked"; } }
    } catch (e) { console.warn(e); }
    return r;
  }; }
function lockSite(on) {
  const site = plan.obstacles.filter(o => !isMat(o) && o.kind !== "dim");
  for (const o of site) if (on) o.locked = true; else delete o.locked;
  markDirty(); renderAll(); renderMeta(); toast(on ? `🔒 ${site.length} site item${site.length === 1 ? "" : "s"} locked – cranes, loads and mats stay movable` : "🔓 Site items unlocked");
}
// the site-items list: bollards from the drawing shown as one row, locked items marked
{ const _rl = renderLists; renderLists = function (...a) { const r = _rl(...a); try { document.querySelectorAll('#obsList [data-sel^="obs:"]').forEach(el => { const o = plan.obstacles.find(x => "obs:" + x.id === el.dataset.sel); if (o && o.locked) { el.querySelector(".t")?.insertAdjacentHTML("afterbegin", '<span title="Locked">🔒 </span>'); const rm = el.querySelector("button.rm"); if (rm) rm.hidden = true; } });
      // repeated small items from the drawing show as one row each: bollards, manholes, poles, containers
      for (const [ty, many] of [["bollard", "bollards"], ["manhole", "manholes / pits"], ["pole", "poles"], ["stack", "containers / stacks"]]) {
        const bl = plan.obstacles.filter(o => o.type === ty && fromDrawing(o)); if (bl.length < 3) continue;
        const rows = bl.map(o => document.querySelector(`#obsList [data-sel="obs:${o.id}"]`)).filter(Boolean);
        rows.slice(1).forEach(r => r.hidden = true);
        const r0 = rows[0]; if (!r0) continue; const t = r0.querySelector(".t"); if (t) t.textContent = `${bl.length} ${many} (from the drawing)`;
        const rm = r0.querySelector("button.rm"); if (rm) { rm.hidden = bl.some(o => o.locked); rm.title = `Remove all these ${many}`; rm.onclick = e => { e.stopPropagation(); plan.obstacles = plan.obstacles.filter(o => !(o.type === ty && fromDrawing(o) && !o.locked)); markDirty(); renderAll(); toast(`${many[0].toUpperCase() + many.slice(1)} removed – Ctrl+Z brings them back`); }; }
      }
    } catch (e) { console.warn(e); } return r; }; }

// ---------- 5. the "Site" box at the top of the layout tools ----------
function renderSiteBuildBox() {
  let box = $("sbBox");
  const anchor = $("ltBoxUI"); if (!anchor) return;
  if (!box) { box = document.createElement("div"); box.id = "sbBox"; box.className = "ltools"; anchor.before(box); }
  const k = ltCad(), bg = plan.site.bg;
  if (!k && !bg) { box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;
  const mine = plan.obstacles.filter(o => fromDrawing(o) && (k ? o.cad === k.c.id : o.cad === "picture"));
  const site = plan.obstacles.filter(o => !isMat(o) && o.kind !== "dim"), nLocked = site.filter(o => o.locked).length, allLocked = site.length && nLocked === site.length;
  box.innerHTML = `<div class="lth"><b>Site objects</b><span class="small">${site.length} item${site.length === 1 ? "" : "s"}${nLocked ? ` · ${nLocked} locked` : ""}</span></div>
    ${k ? `<p class="small" style="margin:0">${mine.length ? `Built from the drawing: <b>${sbSummary(mine)}</b>. Select any of them to move, resize, change type or height.` : "Nothing built from the drawing yet."}</p>
      <div class="ltrow"><button data-sb="build" class="${mine.length ? "" : "pri"}" title="Turn the drawing's outlines into objects (unlocked ones built before are replaced)">${mine.length ? "↻ Rebuild from drawing" : "Build the site from the drawing"}</button><button data-sb="pick" title="Choose more outlines from the drawing to turn into objects">Pick shapes…</button></div>
      ${k.D.sheet ? `<p class="small" style="margin:0">Title block, legend and notes taken off the drawing. <button data-sb="sheetback" class="linkish">Put back</button></p>` : `<div class="ltrow"><button data-sb="sheet" title="Find the frame, title block, legend, north arrow and notes and take them off">Remove title block &amp; legend</button></div>`}`
      : `<p class="small" style="margin:0">${mine.length ? `Built from the picture: <b>${sbSummary(mine)}</b>. Check them against the picture and adjust.` : `Trace the quay, buildings and stacks${CAP.sample && CAP.sampleImages ? " – or let Claude read the picture –" : ""} so they become objects you can work with.`}</p>
      <div class="ltrow">${CAP.sample && CAP.sampleImages ? `<button data-sb="ai" class="${mine.length ? "" : "pri"}">${mine.length ? "Read again with Claude" : "Build the site with Claude"}</button>` : ""}<button data-sb="pick">Trace by hand…</button></div>`}
    ${(() => { const pic = bg && (!k || bg.fromPdf === k.c.id), shown = pic ? bg.show !== false : k.c.show !== false, np = k ? k.D.paths.length : 0, nt = k ? k.D.texts.length : 0;
      return `<div class="ltrow"><button data-sb="orig" aria-pressed="${shown}" title="Show the ${k ? "drawing" : "picture"} you imported under the objects, to check them against it">${shown ? "Hide the original" : "👁 Compare with the original"}</button></div>
      ${k && (np || nt) && mine.length ? `<p class="small" style="margin:0">${np ? `${np} line${np === 1 ? "" : "s"}` : ""}${np && nt ? " and " : ""}${nt ? `${nt} label${nt === 1 ? "" : "s"}` : ""} on the drawing aren't objects (text, levels, markings) – they show only with the original. <button data-sb="left" class="linkish">Remove them</button></p>` : ""}`; })()}
    <div class="ltrow"><button data-sb="lock" class="${allLocked ? "on" : ""}" ${site.length ? "" : "disabled"}>${allLocked ? "🔒 Site locked – unlock" : "🔒 Lock the site"}</button><span class="small">cranes, loads and mats stay free</span></div>`;
  box.querySelectorAll("[data-sb]").forEach(el => el.onclick = () => {
    const a = el.dataset.sb;
    if (a === "build") { if (mine.length && el.dataset.armed !== "1") { el.dataset.armed = "1"; el.textContent = "Replace the unlocked ones?"; return; } buildSiteObjects(); }
    else if (a === "pick") { if (k) { REV.src = "cad"; REV.cands = cadCandidates(k.D); } else { REV.src = "pic"; REV.cands = []; } openReview(); }
    else if (a === "sheet") sheetRemoveAgain();
    else if (a === "sheetback") sheetRestore();
    else if (a === "ai") $("bgAi").click();
    else if (a === "lock") lockSite(!allLocked);
    else if (a === "orig") { if (bg && (!k || bg.fromPdf === k.c.id)) bg.show = bg.show === false; else k.c.show = k.c.show === false; markDirty(); renderSite(); }
    else if (a === "left") { ltSnap("remove leftover lines"); const L = k.D.left || (k.D.left = { paths: [], texts: [] }); L.paths.push(...k.D.paths); L.texts.push(...k.D.texts); k.D.paths = []; k.D.texts = []; ltSaveCad(); markDirty(); renderSite(); toast("Leftover lines and labels removed – Undo in the drawing tools brings them back"); }
    renderSiteBuildBox(); renderLayoutTools();
  });
}
{ const _rm = renderMeta; renderMeta = function (...a) { const r = _rm(...a); try { renderSiteBuildBox(); } catch (e) { console.warn(e); } return r; }; }
{ const _rl = renderLayoutTools; renderLayoutTools = function (...a) { const r = _rl(...a); try { renderSiteBuildBox(); const b = $("ltBoxUI"); if (b) { const s = b.querySelector('[data-lt="show"]'); if (s) s.textContent = s.textContent === "Hide" ? "Hide lines" : s.textContent === "Show" ? "Show lines" : s.textContent; } } catch (e) { console.warn(e); } return r; }; }
// an undo of a layout edit refreshes the box too
{ const _u = ltUndo; ltUndo = function (...a) { const r = _u(...a); try { renderSiteBuildBox(); } catch (e) { } return r; }; }

// a locked item can't be dragged – pressing on it selects it and drags the view instead (a locked deck covers the whole site)
{
  const svg = $("site");
  svg.addEventListener("pointerdown", e => {
    if (calib.active || tool.mode || allMode || e.button !== 0) return;
    const g = e.target.closest && e.target.closest("g[data-key]"); if (!g) return;
    const [kind, id] = g.dataset.key.split(":"); if (!["obs", "crane", "load"].includes(kind)) return;
    const t = lockedTarget(g.dataset.key); if (!t) return;
    e.stopImmediatePropagation();
    const was = sel && sel.id === id; sel = { kind, id, ph: kind === "load" ? g.dataset.key.split(":")[2] : undefined };
    svg.setPointerCapture(e.pointerId); drag = { mode: "pan", sx: e.clientX, sy: e.clientY, c0: [view.cx, view.cy] }; svg.classList.add("drag");
    if (!was) { renderLists(); renderProps(); } renderSite();
  }, true);
}
// the drawing tools fold away once the site is built – they're only needed to tidy the drawing
{ const _rl = renderLayoutTools; let open = null; renderLayoutTools = function (...a) {
    const r = _rl(...a);
    try {
      const box = $("ltBoxUI"), k = ltCad(); if (!box || box.hidden) return r;
      const built = plan.obstacles.some(o => fromDrawing(o) && (k ? o.cad === k.c.id : o.cad === "picture"));
      const isOpen = open ?? !built, busy = /^lt/.test(tool.mode || "");
      const h = box.querySelector(".lth"); if (!h) return r;
      h.style.cursor = "pointer"; h.title = isOpen ? "Fold the drawing tools away" : "Rotate, straighten, erase, crop, fade or remove the drawing";
      h.querySelector("b").textContent = (isOpen || busy ? "▾ " : "▸ ") + (k ? "Drawing tools" : "Picture tools");
      if (!isOpen && !busy) [...box.children].forEach(c => { if (c !== h) c.hidden = true; });
      const last = box.lastElementChild; if (last && last.tagName === "P" && !busy && /Rotate everything together/.test(last.textContent)) last.remove();
      h.onclick = () => { open = !(open ?? !built); renderLayoutTools(); };
    } catch (e) { console.warn(e); }
    return r;
  }; }
// the Site objects counts follow every add / delete
{ const _rl = renderLists; renderLists = function (...a) { const r = _rl(...a); try { if ($("sbBox") && !$("sbBox").hidden) renderSiteBuildBox(); } catch (e) { } return r; }; }

// the import reads pictures with Claude by itself; the Site objects box has "Read again" – no separate button needed
if ($("bgAi")) $("bgAi").hidden = true;
