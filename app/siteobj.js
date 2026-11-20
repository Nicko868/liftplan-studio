// ================= Site objects library: build the real site as the backdrop =================
// Each type makes an ordinary site object (rect / circle / poly / line) with a height, colour and a "loads can pass over" flag.
const OBJ_TYPES = {
  building: { name: "Building", cat: "Site", kind: "rect", w: 20, h: 12, hgt: 8, color: "#7f8c8d" },
  warehouse: { name: "Warehouse / shed", cat: "Site", kind: "rect", w: 40, h: 25, hgt: 12, color: "#6b7b8c" },
  cabin: { name: "Office / welfare cabin", cat: "Site", kind: "rect", w: 6.1, h: 2.5, hgt: 2.8, color: "#a0a7ae" },
  stack: { name: "Container stack", cat: "Site", kind: "rect", w: 12.2, h: 4.9, hgt: 5.2, tiers: 2, color: "#2c6fbb" },
  laydown: { name: "Laydown / storage area", cat: "Site", kind: "rect", w: 30, h: 20, hgt: 0, pass: true, color: "#b9a37a" },
  road: { name: "Road / access route", cat: "Site", kind: "rect", w: 40, h: 7, hgt: 0, pass: true, color: "#5d6166" },
  area: { name: "Area (draw any shape)", cat: "Site", kind: "poly", draw: true, hgt: 0, pass: true, color: "#95a5a6" },
  line: { name: "Line (draw)", cat: "Site", kind: "line", draw: true, hgt: 0, pass: true, color: "#3b444d" },
  wall: { name: "Wall (draw)", cat: "Site", kind: "line", draw: true, hgt: 3, color: "#6b7b8c" },
  fence: { name: "Fence / barrier (draw)", cat: "Site", kind: "line", draw: true, hgt: 2, pass: true, color: "#34393f" },
  quay: { name: "Quay edge (draw)", cat: "Marine", kind: "line", draw: true, hgt: 0, pass: true, color: "#1b2d40" },
  water: { name: "Water / dock basin", cat: "Marine", kind: "rect", w: 150, h: 45, hgt: -2.5, pass: true, color: "#3a86c8" },
  vessel: { name: "Vessel (site object) – PSV, barge, ship…", cat: "Marine", special: "vessel" },
  bollard: { name: "Bollard", cat: "Marine", kind: "circle", r: 0.45, hgt: 0.9, pass: true, color: "#34393f" },
  fender: { name: "Fender", cat: "Marine", kind: "rect", w: 3, h: 1.2, hgt: 1.5, pass: true, color: "#222222" },
  mat_12: { name: "Timber mat", cat: "Crane mats", kind: "rect", w: 1.2, h: 1.2, hgt: 0.2, pass: true, mat: true, color: "#8d7355" },
  mat_15: { name: "Timber mat", cat: "Crane mats", kind: "rect", w: 1.5, h: 1.5, hgt: 0.2, pass: true, mat: true, color: "#8d7355" },
  mat_18: { name: "Timber mat", cat: "Crane mats", kind: "rect", w: 1.8, h: 1.8, hgt: 0.2, pass: true, mat: true, color: "#8d7355" },
  mat_20: { name: "Steel mat", cat: "Crane mats", kind: "rect", w: 2.0, h: 2.0, hgt: 0.2, pass: true, mat: true, color: "#8d7355" },
  mat: { name: "Steel mat", cat: "Crane mats", kind: "rect", w: 2.5, h: 2.5, hgt: 0.2, pass: true, mat: true, color: "#8d7355" },
  mat_30: { name: "Steel mat", cat: "Crane mats", kind: "rect", w: 3.0, h: 3.0, hgt: 0.2, pass: true, mat: true, color: "#8d7355" },
  mat_24: { name: "Composite mat", cat: "Crane mats", kind: "rect", w: 2.4, h: 2.4, hgt: 0.2, pass: true, mat: true, color: "#8d7355" },
  mat_c5: { name: "Crawler mat", cat: "Crane mats", kind: "rect", w: 5.0, h: 1.2, hgt: 0.2, pass: true, mat: true, color: "#8d7355" },
  mat_c6: { name: "Crawler mat", cat: "Crane mats", kind: "rect", w: 6.0, h: 1.2, hgt: 0.2, pass: true, mat: true, color: "#8d7355" },
  mat_c7: { name: "Crawler mat", cat: "Crane mats", kind: "rect", w: 7.0, h: 1.2, hgt: 0.2, pass: true, mat: true, color: "#8d7355" },
  mat_x: { name: "Mat – custom size", cat: "Crane mats", kind: "rect", w: 2.0, h: 1.0, hgt: 0.2, pass: true, mat: true, color: "#8d7355" },
  powerline: { name: "Overhead power line (draw)", cat: "Hazards", kind: "line", draw: true, hgt: 10, clear: 6, color: "#d4a017" },
  pipes: { name: "Pipe rack / pipeline", cat: "Hazards", kind: "rect", w: 30, h: 4, hgt: 6, color: "#8e44ad" },
  mast: { name: "Light tower / mast", cat: "Hazards", kind: "circle", r: 0.8, hgt: 25, color: "#7f8c8d" },
  tank: { name: "Storage tank", cat: "Hazards", kind: "circle", r: 6, hgt: 12, color: "#95a5a6" },
  truck: { name: "Truck & trailer", cat: "Plant & people", kind: "rect", w: 16.5, h: 2.55, hgt: 4, pass: true, color: "#c0392b" },
  trailer: { name: "Flatbed / low-loader trailer", cat: "Plant & people", kind: "rect", w: 13.6, h: 2.55, hgt: 1.3, pass: true, color: "#7f8c8d" },
  forklift: { name: "Forklift", cat: "Plant & people", kind: "rect", w: 4.6, h: 2.3, hgt: 2.9, color: "#e8b90f" },
  telehandler: { name: "Telehandler", cat: "Plant & people", kind: "rect", w: 6.2, h: 2.45, hgt: 2.6, color: "#2e8b57" },
  person: { name: "Banksman / slinger position", cat: "Plant & people", kind: "circle", r: 0.5, hgt: 1.8, pass: true, color: "#e67e22" },
  mewp: { name: "MEWP / access platform", cat: "Plant & people", kind: "rect", w: 2.5, h: 1.2, hgt: 2.5, color: "#e67e22" }
};
const OBJ_CATS = [...new Set(Object.values(OBJ_TYPES).filter(t => !t.mat).map(t => t.cat))];   // mats are added from the crane panel only
const objType = o => (o && o.type && OBJ_TYPES[o.type]) || null;
const objPass = o => o.pass != null ? !!o.pass : !!objType(o)?.pass;

function makeObject(type, at, pts) {
  const T = OBJ_TYPES[type]; if (!T) return null;
  if (T.special === "vessel") return newVessel("psv", at);
  const o = { id: uid(), type, kind: T.kind, label: T.name.replace(/ \(draw.*\)$/, "").replace(/ \/.*$/, ""), hgt: T.hgt, color: T.color, zone: false };
  if (T.pass) o.pass = true;
  if (T.mat) { o.type = "mat"; o.label = "Mat"; }
  if (T.tiers) o.tiers = T.tiers; if (T.clear) o.clear = T.clear;
  if (pts) { o.pts = pts.map(p => [...p]); if (T.kind !== "line") o.kind = "poly"; }
  else if (T.kind === "circle") Object.assign(o, { x: at[0], y: at[1], r: T.r });
  else if (T.kind === "rect") Object.assign(o, { x: at[0], y: at[1], w: T.w, h: T.h, rot: 0 });
  return o;
}

// ---- plan drawing for typed objects (line kinds fully, others as decoration over the generic shape)
function objScene(o) {
  if (isVessel(o)) return vesselScene(o);
  if (o.kind !== "line") return null;
  const s = new Scene(), col = obsColor(o), P = o.pts || [], t = o.type;
  if (P.length < 2) return s;
  const segs = []; for (let i = 0; i < P.length - 1; i++) segs.push([P[i], P[i + 1]]);
  const along = (a, b, step, fn) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; for (let u = step / 2; u < L; u += step) fn([a[0] + d[0] * u, a[1] + d[1] * u], d); };
  if (t === "quay") {
    s.poly("LOAD", P, { w: 3.2, color: col });
    for (const [a, b] of segs) { along(a, b, 1.5, (p, d) => s.poly("LOAD", [p, [p[0] - d[1] * 0.9 + d[0] * 0.5, p[1] + d[0] * 0.9 + d[1] * 0.5]], { w: 0.6, color: col })); along(a, b, 15, (p, d) => s.circle("LOAD", [p[0] - d[1] * 1.4, p[1] + d[0] * 1.4], 0.4, { fill: col, color: col })); }
  } else if (t === "powerline") {
    s.poly("LOAD", P, { w: 1.6, dash: [1.2, 0.6], color: col });
    P.forEach(p => { s.rect("LOAD", p[0] - 0.6, p[1] - 0.6, p[0] + 0.6, p[1] + 0.6, { fill: col, color: "#6b5200", w: 0.8 }); });
    const m = [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2];
    s.text("TEXT", [m[0], m[1] + 1.4], `⚡ ${o.label || "Overhead line"} · ${fx(+o.hgt || 0, 1)} m high · keep ${fx(+o.clear || 6, 1)} m clear`, 0.75, { bold: true, color: "#8a6a00" });
    for (const [a, b] of segs) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = [-(b[1] - a[1]) / L * (+o.clear || 6), (b[0] - a[0]) / L * (+o.clear || 6)];
      s.poly("LOAD", [[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], { closed: true, fill: "rgba(212,160,23,.10)", dash: [0.4, 0.4], color: "rgba(160,120,0,.6)", w: 0.5 }); }
  } else if (t === "fence") {
    s.poly("LOAD", P, { w: 1.2, color: col });
    for (const [a, b] of segs) along(a, b, 2.5, (p, d) => { const n = [-d[1] * 0.35, d[0] * 0.35]; s.poly("LOAD", [[p[0] - d[0] * 0.3 - n[0], p[1] - d[1] * 0.3 - n[1]], [p[0] + d[0] * 0.3 + n[0], p[1] + d[1] * 0.3 + n[1]]], { w: 0.6, color: col }); s.poly("LOAD", [[p[0] - d[0] * 0.3 + n[0], p[1] - d[1] * 0.3 + n[1]], [p[0] + d[0] * 0.3 - n[0], p[1] + d[1] * 0.3 - n[1]]], { w: 0.6, color: col }); });
  } else { const st = lineStyle(o); s.poly("LOAD", P, { w: st.w, color: col, ...(st.dash ? { dash: st.dash } : {}) }); }
  if (t !== "powerline" && o.label) { const m = [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2]; s.text("TEXT", [m[0], m[1] + 1.2], o.label, 0.6, { bold: true, color: col }); }
  return s;
}
function objDecor(s, o) {
  const T = objType(o); if (!T) return;
  const col = obsColor(o), P = obsPts(o);
  const L = (a, b, opt) => s.poly("LOAD", [a, b], { w: 0.5, color: col, ...(opt || {}) });
  const loc = (x, y) => { const r = rot2([x, y], -(o.rot || 0)); return [o.x + r[0], o.y + r[1]]; };
  const w = +o.w || 2, h = +o.h || 2;
  if (o.type === "stack" && o.kind === "rect") {
    const nx = Math.max(1, Math.round(w / 6.1)), ny = Math.max(1, Math.round(h / 2.44));
    for (let i = 1; i < nx; i++) L(loc(-w / 2 + w * i / nx, -h / 2), loc(-w / 2 + w * i / nx, h / 2), { w: 0.8 });
    for (let j = 1; j < ny; j++) L(loc(-w / 2, -h / 2 + h * j / ny), loc(w / 2, -h / 2 + h * j / ny), { w: 0.8 });
    s.text("TEXT", loc(0, -h / 2 - 0.8), `${nx * ny} × ${o.tiers || 1} high`, 0.55, { color: col });
  } else if ((o.type === "building" || o.type === "warehouse") && o.kind === "rect") { L(loc(-w / 2, 0), loc(w / 2, 0), { dash: [0.8, 0.4] }); L(loc(-w / 2, -h / 2), loc(-w / 2 + h / 2, 0)); L(loc(-w / 2, h / 2), loc(-w / 2 + h / 2, 0)); L(loc(w / 2, -h / 2), loc(w / 2 - h / 2, 0)); L(loc(w / 2, h / 2), loc(w / 2 - h / 2, 0)); }
  else if (o.type === "road" && o.kind === "rect") { const long = w >= h; for (let u = -(long ? w : h) / 2 + 1; u < (long ? w : h) / 2 - 1; u += 4) L(long ? loc(u, 0) : loc(0, u), long ? loc(u + 2, 0) : loc(0, u + 2), { color: "#ffffff", w: 1 }); }
  else if (o.type === "water") { const xs = P.map(p => p[0]), ys = P.map(p => p[1]); for (let y = Math.min(...ys) + 2; y < Math.max(...ys) - 1; y += 4) for (let x = Math.min(...xs) + 2; x < Math.max(...xs) - 3; x += 7) { const a = [x, y], b = [x + 1.2, y + 0.5], c = [x + 2.4, y]; if (inPolyPt(b, P)) { s.poly("LOAD", [a, b, c], { w: 0.5, color: "#1f5f95" }); } } }
  else if (o.type === "truck" && o.kind === "rect") { s.poly("LOAD", [loc(w / 2 - 2.6, -h / 2), loc(w / 2, -h / 2), loc(w / 2, h / 2), loc(w / 2 - 2.6, h / 2)], { closed: true, fill: shade(col, 0.8), color: col, w: 0.8 }); L(loc(w / 2 - 3.2, -h / 2), loc(w / 2 - 3.2, h / 2)); }
  else if ((o.type === "forklift" || o.type === "telehandler") && o.kind === "rect") { s.poly("LOAD", [loc(w / 2, -h * 0.3), loc(w / 2 + 1.2, -h * 0.3)], { w: 1.4, color: "#34393f" }); s.poly("LOAD", [loc(w / 2, h * 0.3), loc(w / 2 + 1.2, h * 0.3)], { w: 1.4, color: "#34393f" }); }
  else if (o.type === "tank" && o.kind === "circle") s.circle("LOAD", [o.x, o.y], (o.r || 1) * 0.8, { w: 0.5, color: col, dash: [0.4, 0.3] });
  else if (o.type === "person") s.circle("LOAD", [o.x, o.y], (o.r || 0.5) * 0.45, { fill: col, color: col });
}
// ---- 3D
function obj3D(M, o, P2) {
  if (isVessel(o)) { vessel3D(M, o); return true; }
  if (o.type === "person") { person3D(M, o); return true; }
  const T = objType(o), col = obsColor(o), h = +o.hgt || 0;
  if (o.kind === "line") {
    const P = o.pts || [];
    if (o.type === "powerline") {
      P.forEach(p => { M.cyl([p[0], p[1], 0], [p[0], p[1], h + 1], 0.25, "#7a6a3a", { n: 8 }); M.box({ o: [p[0], p[1], 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, -1.5, 1.5, -0.12, 0.12, h + 0.6, h + 0.85, "#7a6a3a"); });
      for (let i = 0; i < P.length - 1; i++) for (const off of [-1.3, 0, 1.3]) { const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = [-(b[1] - a[1]) / L * off, (b[0] - a[0]) / L * off]; let prev = null; for (let k = 0; k <= 12; k++) { const t = k / 12, z = h + 0.6 - Math.sin(Math.PI * t) * Math.min(2, L * 0.03), q = [a[0] + (b[0] - a[0]) * t + n[0], a[1] + (b[1] - a[1]) * t + n[1], z]; if (prev) M.line(prev, q, "#3a3020", 1.1); prev = q; } }
      if (P.length) M.label([P[0][0], P[0][1], h + 3], `⚡ ${o.label || "Overhead line"} ${fx(h, 1)} m`, "#8a6a00", 11);
    } else if (o.type === "quay") { for (let i = 0; i < P.length - 1; i++) M.line([P[i][0], P[i][1], 0.05], [P[i + 1][0], P[i + 1][1], 0.05], col, 3); }
    else for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = [-(b[1] - a[1]) / L * 0.08, (b[0] - a[0]) / L * 0.08];
      M.prism([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], 0, Math.max(0.2, h), col, o.type === "fence" ? { alpha: 0.45 } : {}); }
    return true;
  }
  if (!T) return false;
  if (o.type === "water") { M.prism(P2, h - 0.05, h, "#3a86c8", { alpha: 0.5 }); return true; }
  if (objPass(o) && h <= 0.05) { M.prism(P2, 0, 0.03, col, { alpha: 0.35 }); return true; }
  if (o.type === "stack") { const tiers = Math.max(1, +o.tiers || 1), th = (h || tiers * 2.59) / tiers; for (let i = 0; i < tiers; i++) M.prism(P2, i * th + 0.02, (i + 1) * th, i % 2 ? shade(col, 0.88) : col); return true; }
  if (o.type === "truck" && o.kind === "rect") {
    const loc = (x, y) => { const r = rot2([x, y], -(o.rot || 0)); return [o.x + r[0], o.y + r[1]]; }, w = +o.w, hh = +o.h;
    M.prism([loc(-w / 2, -hh / 2), loc(w / 2 - 3.2, -hh / 2), loc(w / 2 - 3.2, hh / 2), loc(-w / 2, hh / 2)], 0.9, 1.4, "#7f8c8d");
    M.prism([loc(w / 2 - 2.6, -hh / 2), loc(w / 2, -hh / 2), loc(w / 2, hh / 2), loc(w / 2 - 2.6, hh / 2)], 0.6, Math.max(3, h), col);
    return true;
  }
  return false;
}
// ---- shapes that the load's travel path must avoid (pass-over objects are ignored, vessels only block with their accommodation)
function hitShapes() {
  const out = [];
  for (const o of plan.obstacles) {
    if (o.kind === "dim") continue;
    if (isVessel(o)) { out.push(...vesselBlockers(o)); continue; }
    if (o.zone || !objPass(o)) out.push(o);
  }
  return out;
}
// ---- overhead power lines near the boom / hook
function powerlineWarnings(cr) {
  const W = [], lines = plan.obstacles.filter(o => o.type === "powerline" && (o.pts || []).length > 1); if (!lines.length) return W;
  const segSeg = (a, b, c, d) => { const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d); if (d1 * d2 < 0 && d3 * d4 < 0) return 0; return Math.min(segDist(a, c, d), segDist(b, c, d), segDist(c, a, b), segDist(d, a, b)); };
  for (const ph of ["pick", "set"]) {
    const ev = evalCrane(cr, ph); if (!ev.hook) continue;
    const C = ev.C, tipR = C ? C.boom.pivot[0] + cr.L * Math.cos((ev.ba?.theta || 45) * D2R) : ev.R;
    const tip = [cr.x + tipR * Math.sin(ev.bearing * D2R), cr.y + tipR * Math.cos(ev.bearing * D2R)];
    for (const o of lines) for (let i = 0; i < o.pts.length - 1; i++) {
      const dist = Math.min(segSeg([cr.x, cr.y], tip, o.pts[i], o.pts[i + 1]), segSeg([cr.x, cr.y], ev.hook, o.pts[i], o.pts[i + 1]));
      if (dist < (+o.clear || 6)) { W.push(`${ph === "pick" ? "Pick" : "Set"}: boom / hook within ${fx(dist, 1)} m (plan) of ${o.label || "overhead power line"} (${fx(+o.hgt || 0, 1)} m high) – keep ${fx(+o.clear || 6, 1)} m clear or get it isolated`); break; }
    }
  }
  return [...new Set(W)];
}
{ const _cs = craneSummary; craneSummary = function (cr) { const S = _cs(cr); try { const w = powerlineWarnings(cr); if (w.length) { S.warn.push(...w); if (S.status !== "bad") S.status = "bad"; } } catch (e) { console.warn(e); } return S; }; }

// ---- type-specific fields in the properties panel
function objPropsHTML(o) {
  const T = objType(o); if (!T || isVessel(o)) return "";
  let h = `<p class="small" style="margin:0">${escH(T.name.replace(/ \(draw.*\)$/, ""))}</p>`;
  if (!o.zone) h += `<label class="chk"><input type="checkbox" id="oPass" ${objPass(o) ? "checked" : ""}> Loads can be carried over it (not checked as an obstacle)</label>`;
  if (o.type === "stack") h += field("Containers high", "oTiers", o.tiers || 1, "number", 'step="1" min="1"');
  if (o.type === "powerline") h += `<div class="row">${field("Line height (m)", "oPlH", o.hgt ?? 10, "number", 'step="0.1"')}${field("Keep clear by (m)", "oClear", o.clear ?? 6, "number", 'step="0.5"')}</div><p class="small" style="margin:0">Cranes whose boom or hook comes within this distance (in plan) are flagged. Use the distance from the line owner / your permit.</p>`;
  return h;
}
function wireObjProps(o, up) {
  if ($("oPass")) $("oPass").onchange = e => up(() => o.pass = e.target.checked);
  if ($("oTiers")) $("oTiers").onchange = e => up(() => { o.tiers = Math.max(1, Math.round(+e.target.value)); o.hgt = +(o.tiers * 2.59).toFixed(2); }, true);
  if ($("oPlH")) $("oPlH").onchange = e => up(() => o.hgt = +e.target.value);
  if ($("oClear")) $("oClear").onchange = e => up(() => o.clear = +e.target.value);
}

// ================= Object library dialog =================
document.body.insertAdjacentHTML("beforeend", `
<dialog id="dObj" style="width:min(860px,96vw)"><div class="dh"><b>Site objects</b><button data-close>Close</button></div><div class="db">
  <p class="small">Build the site around the lift – buildings, stacks, quay edge, water, vessels, hazards and plant. Click an item to drop it in the middle of the view (drag, resize and rotate it after). Items marked “draw” are drawn point by point.</p>
  <div id="objCats" class="btnrow" style="margin-bottom:8px"></div><div id="objGrid" class="libgrid"></div>
</div></dialog>`);
document.addEventListener("click", e => { const b = e.target.closest("[data-close]"); if (b && b.closest("dialog")?.open && !b.onclick) b.closest("dialog").close(); });
let objCat = OBJ_CATS[0];
function objIcon(type) {
  const T = OBJ_TYPES[type];
  if (T.special === "vessel") return toSVG(vesselScene({ ...newVessel("psv", [0, 0]), label: "", cranes: [] }), { pad: 2, noSize: true, lw: 0.2 });
  const o = makeObject(type, [0, 0], T.kind === "line" ? [[-6, 0], [6, 0]] : T.kind === "poly" ? [[-5, -3], [5, -4], [6, 3], [-4, 4]] : null);
  const s = T.kind === "line" ? objScene(o) : obsScene(o);
  return toSVG(s, { pad: T.kind === "circle" && (T.r || 1) < 1 ? 0.6 : 1.5, noSize: true, lw: T.kind === "circle" && (T.r || 1) < 1 ? 0.03 : 0.12 });
}
function renderObjLib() {
  $("objCats").innerHTML = OBJ_CATS.map(c => `<button class="chip" data-ocat="${escH(c)}" aria-pressed="${c === objCat}">${escH(c)}</button>`).join("");
  $("objGrid").innerHTML = Object.entries(OBJ_TYPES).filter(([, T]) => T.cat === objCat && !T.mat).map(([k, T]) => `<button class="libcard" data-otype="${k}">${objIcon(k)}<b>${escH(T.name)}</b><span>${T.kind === "rect" ? `${fx(T.w)} × ${fx(T.h)} m` : T.kind === "circle" ? `Ø ${fx(T.r * 2, 1)} m` : T.special ? "from a spec sheet, GA or photo" : "draw it"}${T.hgt ? ` · ${fx(T.hgt)} m ${T.mat ? "thick" : "high"}` : ""}</span></button>`).join("");
  $("objCats").querySelectorAll("[data-ocat]").forEach(b => b.onclick = () => { objCat = b.dataset.ocat; renderObjLib(); });
  $("objGrid").querySelectorAll("[data-otype]").forEach(b => b.onclick = () => placeObject(b.dataset.otype));
}
function openObjLib() { renderObjLib(); $("dObj").showModal(); }
function placeObject(type) {
  const T = OBJ_TYPES[type]; $("dObj").close();
  if (T.special === "vessel") { openVesselDialog(null); return; }
  if (T.draw) { setTool("obj"); tool.objType = type; $("hint").textContent = `Draw ${T.name.replace(/ \(draw\)$/, "").toLowerCase()}: click each point · double-click or Enter to finish · Esc cancels`; $("hint").hidden = false; return; }
  const o = makeObject(type, [Math.round(view.cx), Math.round(view.cy)]);
  plan.obstacles.push(o); sel = { kind: "obs", id: o.id }; markDirty(); renderAll();
}
$("addObs").onclick = openObjLib;
$("addObs").textContent = "+ Objects";

// ================= Site backdrop: PDF drawings + reading scale / tracing with Claude =================
async function pdfToImageFile(f) {
  const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise, pg = await pdf.getPage(1);
  const vp0 = pg.getViewport({ scale: 1 }), k = Math.min(4, 4000 / Math.max(vp0.width, vp0.height)), vp = pg.getViewport({ scale: k });
  const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvasContext: g, viewport: vp }).promise;
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  return new File([blob], f.name.replace(/\.pdf$/i, "") + ".png", { type: "image/png" });
}
{
  const inp = $("bgFile"); inp.setAttribute("accept", "image/png,image/jpeg,image/webp,application/pdf");
  const orig = inp.onchange;
  inp.onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.type !== "application/pdf") return orig(e);
    if (!window.pdfjsLib) { toast("PDF reader didn't load – export the drawing as an image"); return; }
    toast("Rendering the PDF drawing…");
    try { const img = await pdfToImageFile(f); return orig({ target: { files: [img] } }); } catch (err) { toast("Couldn't read that PDF (" + (err.message || err) + ")"); }
  };
  $("bgUpload").textContent = "Upload site drawing / photo / PDF";
  $("bgCal").insertAdjacentHTML("afterend", `<button id="bgAi" title="Claude reads the scale bar and traces buildings, quay edge, roads and stacks as editable objects">Read scale &amp; trace with Claude</button>`);
}
const TRACE_PROMPT = `The image is a site plan, drawing, map or aerial photo of a port / supply base / industrial site where a crane lift will be planned.
1) Find the scale: a scale bar, a dimension line with a value, or a grid with known spacing. Give two points ON THE IMAGE and the real distance between them.
2) Trace the main features as simple shapes.
Coordinates are fractions of the image: u = x / image width (0 = left, 1 = right), v = y / image height (0 = top, 1 = bottom). Be as precise as you can.
Return JSON only:
{"scale": {"p1": [u, v], "p2": [u, v], "metres": number, "from": "scale bar"|"dimension"|"grid"} or null,
 "north_up": true|false|null,
 "objects": [{"type": one of "deck","building","warehouse","cabin","stack","laydown","road","quay","water","fence","wall","powerline","pipes","tank","mast","vessel","area",
              "label": short name or "", "pts": [[u, v], ...] (polygon corners for areas / buildings; a polyline for quay, fence, wall, powerline; for a tank give 4 points on its outline)}],
 "notes": what you assumed}
"deck" is the quay / jetty / yard surface the cranes stand on (its full outline). Use the drawing's labels and legend to name things. Ignore the title block, legend box, north arrow, notes and dimensions – they are not objects.
Only include features you can actually see. At most 60 objects.`;
$("bgAi").onclick = async () => {
  const bg = plan.site.bg; if (!bg) { toast("Upload a site drawing, photo or PDF first"); return; }
  if (!CAP.sample || !CAP.sampleImages) { toast(CAP.local ? "Reading with Claude needs Claude – click ✦ Link Claude at the top – set the scale with two points instead." : "Reading with Claude isn't available here – set the scale with two points."); return; }
  const btn = $("bgAi"); btn.disabled = true; btn.textContent = "Reading the drawing… (20–60 s)";
  try {
    const url = bg.url || ("/_blob/" + bg.asset), blob = await (await fetch(url)).blob();
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(blob); });
    const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas"); c.width = img.naturalWidth * k; c.height = img.naturalHeight * k; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const jpg = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
    const r = await CAP.sample.json(TRACE_PROMPT, { images: [jpg], modelTier: "complex" });
    const Wpx = bg.w, Hpx = bg.h;
    if (r.scale && +r.scale.metres > 0) {
      const d = Math.hypot((r.scale.p2[0] - r.scale.p1[0]) * Wpx, (r.scale.p2[1] - r.scale.p1[1]) * Hpx);
      if (d > 5) { const mpp = +r.scale.metres / d, cx = bg.x + bg.w * bg.mpp / 2, cy = bg.y - bg.h * bg.mpp / 2; bg.mpp = mpp; bg.x = cx - bg.w * mpp / 2; bg.y = cy + bg.h * mpp / 2; }
    }
    const toW = p => [Math.round((bg.x + (+p[0]) * bg.w * bg.mpp) * 100) / 100, Math.round((bg.y - (+p[1]) * bg.h * bg.mpp) * 100) / 100];
    let n = 0;
    for (const ob of (r.objects || []).slice(0, 60)) {
      const T = OBJ_TYPES[ob.type] ? ob.type : "area", pts = (ob.pts || []).filter(p => Array.isArray(p) && p.length >= 2).map(toW);
      if (T === "vessel") { if (pts.length < 3) continue; const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const v = newVessel("psv", centroid(pts)); const L = Math.max(...xs) - Math.min(...xs), B = Math.max(...ys) - Math.min(...ys); v.w = Math.round(Math.max(L, B)); v.h = Math.round(Math.min(L, B)); v.rot = L >= B ? 0 : 90; v.label = ob.label || v.label; v.traced = true; plan.obstacles.push(v); n++; continue; }
      const kind = OBJ_TYPES[T].kind;
      let o;
      if (kind === "line") { if (pts.length < 2) continue; o = makeObject(T, null, pts); }
      else if (kind === "circle") { if (!pts.length) continue; const c0 = centroid(pts), rr = Math.max(0.5, pts.reduce((a, p) => a + Math.hypot(p[0] - c0[0], p[1] - c0[1]), 0) / pts.length); o = makeObject(T, c0); o.r = Math.round(rr * 10) / 10; }
      else { if (pts.length < 3) continue; o = makeObject(T, [0, 0]); o.kind = "poly"; o.pts = pts; delete o.x; delete o.y; delete o.w; delete o.h; }
      if (ob.label) o.label = String(ob.label).slice(0, 40);
      o.traced = true; plan.obstacles.push(o); n++;
    }
    markDirty(); renderMeta(); fitView(); renderAll();
    toast(`${r.scale ? `Scale set from the ${r.scale.from || "drawing"} (${fx(r.scale.metres)} m). ` : "No scale found – set it with two points. "}${n} object${n === 1 ? "" : "s"} traced – check them against the drawing and adjust.${r.notes ? " " + r.notes : ""}`, 9000);
  } catch (err) { toast("Couldn't read the drawing (" + (err.code || err.message || err) + ")"); }
  btn.disabled = false; btn.innerHTML = "Read scale &amp; trace with Claude";
};

// banksman / slinger: a person in coveralls, hi-vis vest and hard hat, one arm up signalling (dark skin)
function person3D(M, o) {
  const k = Math.max(0.5, (+o.hgt || 1.8) / 1.8), x = o.x, y = o.y, SKIN = "#5b3a24", SKIN2 = "#4a2e1c", SUIT = "#27364a", VEST = "#ff7a1a", REFL = "#e6e8ea", HAT = "#f4f4f2", BOOT = "#1d1f22";
  // face the nearest crane (the banksman watches the crane driver), else the object's rotation
  const cr = (plan.cranes || []).reduce((b, c) => !b || Math.hypot(c.x - x, c.y - y) < Math.hypot(b.x - x, b.y - y) ? c : b, null);
  const brg = cr ? Math.atan2(cr.x - x, cr.y - y) / D2R : (+o.rot || 0), F = frame([x, y, 0], brg + 90), X = F.x, Y = F.y;   // X across the shoulders, Y forward
  const P = (a, b, z) => [x + X[0] * a + Y[0] * b, y + X[1] * a + Y[1] * b, z * k];
  const bx = (a0, a1, b0, b1, z0, z1, c) => M.box({ o: [x, y, 0], x: X, y: Y, z: [0, 0, 1] }, a0, a1, b0, b1, z0 * k, z1 * k, c);
  for (const s of [-1, 1]) { bx(s * 0.1 - 0.055, s * 0.1 + 0.055, -0.05, 0.14, 0, 0.1, BOOT); M.cyl(P(s * 0.1, 0.02, 0.09), P(s * 0.1, 0, 0.9), 0.07 * k, SUIT, { n: 10, r1: 0.085 * k }); }
  bx(-0.19, 0.19, -0.1, 0.1, 0.86, 1.0, SUIT);                                                         // hips
  bx(-0.2, 0.2, -0.12, 0.12, 0.98, 1.44, VEST);                                                        // hi-vis vest
  for (const z of [1.1, 1.26]) bx(-0.205, 0.205, -0.125, 0.125, z, z + 0.035, REFL);                     // reflective bands
  // arms: right arm raised (signalling), left arm down
  M.cyl(P(0.24, 0, 1.4), P(0.34, 0.05, 1.72), 0.05 * k, SUIT, { n: 8 }); M.cyl(P(0.34, 0.05, 1.72), P(0.36, 0.08, 1.98), 0.045 * k, SUIT, { n: 8 }); M.cyl(P(0.36, 0.08, 1.98), P(0.37, 0.09, 2.07), 0.04 * k, SKIN, { n: 8 });
  M.cyl(P(-0.24, 0, 1.4), P(-0.27, 0.02, 1.12), 0.05 * k, SUIT, { n: 8 }); M.cyl(P(-0.27, 0.02, 1.12), P(-0.27, 0.06, 0.9), 0.045 * k, SUIT, { n: 8 }); M.cyl(P(-0.27, 0.06, 0.9), P(-0.27, 0.07, 0.82), 0.04 * k, SKIN, { n: 8 });
  M.cyl(P(0, 0, 1.44), P(0, 0, 1.52), 0.05 * k, SKIN2, { n: 10 });                                       // neck
  M.cyl(P(0, 0.005, 1.51), P(0, 0.005, 1.62), 0.085 * k, SKIN, { n: 14, r1: 0.1 * k });                 // head
  M.cyl(P(0, 0.005, 1.62), P(0, 0.005, 1.7), 0.1 * k, SKIN, { n: 14, r1: 0.07 * k });
  M.cyl(P(0, 0.01, 1.66), P(0, 0.01, 1.68), 0.135 * k, HAT, { n: 16 });                                  // hard hat brim
  M.cyl(P(0, 0.005, 1.68), P(0, 0.005, 1.8), 0.11 * k, HAT, { n: 16, r1: 0.05 * k });                    // hard hat crown
  if (o.label) { const ts = typeof txtStyleOf === "function" ? txtStyleOf(o) : { k: 1 }; M.label([x, y, 2.4 * k], o.label, ts.color || (o.color || "#e67e22"), 11 * (ts.k || 1)); }
}

// ---- line style for drawn lines (plain lines, walls, kerbs…): solid / dashed / dotted / dash-dot and a weight
const LINE_STYLES = { solid: { name: "Solid", dash: null }, dashed: { name: "Dashed", dash: [1.2, 0.6] }, dotted: { name: "Dotted", dash: [0.15, 0.45] }, dashdot: { name: "Dash-dot (centre line)", dash: [1.6, 0.4, 0.2, 0.4] } };
const LINE_WEIGHTS = { thin: { name: "Thin", w: 0.8 }, medium: { name: "Medium", w: 1.6 }, thick: { name: "Thick", w: 2.6 } };
function lineStyle(o) { const d = LINE_STYLES[o.lstyle] || LINE_STYLES.solid, w = (LINE_WEIGHTS[o.lw] || (o.type === "line" ? LINE_WEIGHTS.thin : LINE_WEIGHTS.thick)).w; return { w, dash: d.dash ? d.dash.map(v => v * Math.max(1, w)) : null }; }
const lineStylable = o => o && o.kind === "line" && !["quay", "powerline", "fence"].includes(o.type);
{ const _op = typeof objPropsHTML === "function" ? objPropsHTML : null;
  objPropsHTML = function (o) { const base = _op ? _op(o) : ""; if (!lineStylable(o)) return base;
    return base + `<div class="row"><label>Line style<select data-lst="lstyle">${Object.entries(LINE_STYLES).map(([k, v]) => `<option value="${k}" ${(o.lstyle || "solid") === k ? "selected" : ""}>${v.name}</option>`).join("")}</select></label>
      <label>Weight<select data-lst="lw">${Object.entries(LINE_WEIGHTS).map(([k, v]) => `<option value="${k}" ${(o.lw || (o.type === "line" ? "thin" : "thick")) === k ? "selected" : ""}>${v.name}</option>`).join("")}</select></label></div>`; }; }
document.addEventListener("change", e => { const el = e.target.closest && e.target.closest("[data-lst]"); if (!el || !sel || sel.kind !== "obs") return; const o = plan.obstacles.find(x => x.id === sel.id); if (!o) return; o[el.dataset.lst] = el.value; markDirty(); renderSite(); });

// ---- a site item used in one lift only (an SPMT that is only there for Lift 1, a temporary barrier…): hidden from the
// other lifts' plans, sheets, 3D and checks. Without a lift set, an item is part of the site for every lift.
function itemInLift(o) { if (!o || !o.onlyLift || (typeof allMode !== "undefined" && allMode) || (plan.lifts || []).length < 2) return true; return o.onlyLift === curLiftId(); }
{ const _hs = hitShapes; hitShapes = function (...a) { const r = _hs.apply(this, a); return Array.isArray(r) ? r.filter(o => itemInLift(o.o || o)) : r; }; }
{ const _rp = renderProps; renderProps = function (...a) { const r = _rp.apply(this, a);
    try { const o = sel?.kind === "obs" ? plan.obstacles.find(x => x.id === sel.id) : null;
      if (o && !isMat(o) && $("oLab") && !$("oInLift") && (plan.lifts || []).length > 1) { const cur = plan.lifts[plan.al], d = document.createElement("label");
        d.innerHTML = `Used in<select id="oInLift"><option value="">Every lift (part of the site)</option>${plan.lifts.map((L, i) => `<option value="${L.id}" ${o.onlyLift === L.id ? "selected" : ""}>${escH(L.name || "Lift " + (i + 1))} only</option>`).join("")}</select>`;
        ($("oLab").closest("label") || $("oLab")).after(d);
        $("oInLift").onchange = e => { if (e.target.value) { o.onlyLift = e.target.value; if (isTransport(o)) delete o.samePos; } else delete o.onlyLift; const L = plan.lifts.find(x => x.id === o.onlyLift);
          markDirty(); if (o.onlyLift && o.onlyLift !== cur.id) { sel = null; toast(`Moved to ${L ? L.name : "that lift"} – it no longer shows in this lift`); } renderAll(); }; } } catch (e) { console.warn(e); }
    return r; }; }
// the list shows which lift an item belongs to
{ const _rl = renderLists; renderLists = function (...a) { const r = _rl.apply(this, a);
    try { if ((plan.lifts || []).length > 1) for (const o of plan.obstacles) if (o.onlyLift) { const el = document.querySelector(`#obsList [data-sel="obs:${o.id}"] .t`); const L = plan.lifts.find(x => x.id === o.onlyLift); if (el && L && !el.dataset.lt) { el.dataset.lt = 1; el.insertAdjacentHTML("beforeend", ` <span class="small" style="opacity:.7">· ${escH(L.name || "")} only</span>`); if (!itemInLift(o)) el.closest(".item").style.opacity = ".5"; } } } catch (e) { }
    return r; }; }
