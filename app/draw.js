// ===== Geometry primitives -> SVG / DXF
const STY = {
  CARRIER: { s: "#2c3e50", f: "#e7ebef" }, TYRES: { s: "#1f262d", f: "#3a4149" }, TRACKS: { s: "#6a4a1f", f: "#d9c3a0" },
  OUTRIGGERS: { s: "#b85a12", f: "#f3c79f" }, MATS: { s: "#8a8f94", f: "none" }, UPPER: { s: "#8e1b2b", f: "#f6e3e5" },
  COUNTERWEIGHT: { s: "#8e1b2b", f: "#e9c3c8" }, BOOM: { s: "#1f5fa8", f: "#dce9f7" }, RIGGING: { s: "#0b7a66", f: "#bfe6dd" },
  LOAD: { s: "#34393f", f: "#eef0f2" }, RADIUS: { s: "#7a2bc2", f: "none" }, DIMS: { s: "#4b5563", f: "none" },
  TEXT: { s: "#111827", f: "none" }, GROUND: { s: "#2e7d4f", f: "none" }, REF: { s: "#a07800", f: "none" }
};
const DXFCOL = { CARRIER: 5, TYRES: 8, TRACKS: 30, OUTRIGGERS: 30, MATS: 8, UPPER: 1, COUNTERWEIGHT: 1, BOOM: 5,
  RIGGING: 3, LOAD: 7, RADIUS: 6, DIMS: 8, TEXT: 7, GROUND: 3, REF: 2 };

class Scene {
  constructor() { this.items = []; }
  poly(L, pts, o = {}) { this.items.push({ t: "poly", L, pts, closed: !!o.closed, fill: o.fill, dash: o.dash, w: o.w, color: o.color }); return this; }
  rect(L, x0, y0, x1, y1, o = {}) { return this.poly(L, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { ...o, closed: true }); }
  circle(L, c, r, o = {}) { this.items.push({ t: "circle", L, c, r, fill: o.fill, dash: o.dash, w: o.w, color: o.color }); return this; }
  text(L, p, s, size, o = {}) { this.items.push({ t: "text", L, p, s, size, anchor: o.anchor || "middle", rot: o.rot || 0, bold: o.bold, color: o.color }); return this; }
  // apply transform (rotate about origin by deg, then translate)
  add(other, deg = 0, dx = 0, dy = 0, mirrorX = false) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const tf = ([x, y]) => { if (mirrorX) x = -x; return [x * c - y * s + dx, x * s + y * c + dy]; };
    for (const it of other.items) {
      if (it.t === "poly") this.items.push({ ...it, pts: it.pts.map(tf) });
      else if (it.t === "circle") this.items.push({ ...it, c: tf(it.c) });
      else this.items.push({ ...it, p: tf(it.p), rot: (it.rot || 0) + (it.keepRot ? 0 : 0) });
    }
    return this;
  }
  bounds() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const up = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const it of this.items) {
      if (it.t === "poly") it.pts.forEach(p => up(p[0], p[1]));
      else if (it.t === "circle") { up(it.c[0] - it.r, it.c[1] - it.r); up(it.c[0] + it.r, it.c[1] + it.r); }
      else {
        const tw = String(it.s).length * it.size * 0.56, a = (it.rot || 0) * Math.PI / 180;
        const ox = it.anchor === "start" ? 0 : it.anchor === "end" ? -tw : -tw / 2;
        for (const t of [ox, ox + tw]) up(it.p[0] + t * Math.cos(a), it.p[1] + t * Math.sin(a));
        up(it.p[0], it.p[1] + it.size * 0.6); up(it.p[0], it.p[1] - it.size * 0.6);
      }
    }
    return [x0, y0, x1, y1];
  }
}

const f3 = v => (Math.round(v * 1000) / 1000).toString();
let TEXT_HALO = false;   // white outline behind labels (plan sheets) so lines and fills never swallow them
function sceneMarkup(scene, lw = 0.05) {
  const out = [];
  for (let it of scene.items) {
    const st = STY[it.L] || STY.TEXT;
    const sw = (it.w || 1) * lw;
    const dash = it.dash ? ` stroke-dasharray="${it.dash.map(d => f3(d)).join(" ")}"` : "";
    if (it.t === "poly") {
      const fill = it.fill === undefined ? "none" : (it.fill === true ? st.f : it.fill);
      const d = it.pts.map((p, i) => (i ? "L" : "M") + f3(p[0]) + " " + f3(-p[1])).join("") + (it.closed ? "Z" : "");
      out.push(`<path d="${d}" fill="${fill}" stroke="${it.color || st.s}" stroke-width="${f3(sw)}"${dash} stroke-linejoin="round" stroke-linecap="round"/>`);
    } else if (it.t === "circle") {
      const fill = it.fill === undefined ? "none" : (it.fill === true ? st.f : it.fill);
      out.push(`<circle cx="${f3(it.c[0])}" cy="${f3(-it.c[1])}" r="${f3(it.r)}" fill="${fill}" stroke="${it.color || st.s}" stroke-width="${f3(sw)}"${dash}/>`);
    } else {
      // text always reads left to right or bottom to top – never upside down (CAD rule)
      if (it.rot) { let r = ((+it.rot % 360) + 540) % 360 - 180; if (r > 90.5 || r <= -89.5) { r += r > 0 ? -180 : 180; it = { ...it, rot: r, anchor: it.anchor === "start" ? "end" : it.anchor === "end" ? "start" : it.anchor }; } else if (r !== it.rot) it = { ...it, rot: r }; }
      const esc = String(it.s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
      out.push(`<text x="${f3(it.p[0])}" y="${f3(-it.p[1])}" font-size="${f3(it.size)}" text-anchor="${it.anchor}" dominant-baseline="middle" fill="${it.color || st.s}"${it.bold ? ' font-weight="600"' : ""}${TEXT_HALO && it.s.trim() ? ` stroke="#ffffff" stroke-width="${f3(it.size * 0.22)}" stroke-linejoin="round" paint-order="stroke"` : ""}${it.rot ? ` transform="rotate(${f3(-it.rot)} ${f3(it.p[0])} ${f3(-it.p[1])})"` : ""}>${esc}</text>`);
    }
  }
  return out.join("");
}
function toSVG(scene, opt = {}) {
  const [bx0, by0, bx1, by1] = opt.bounds || scene.bounds();
  const pad = opt.pad ?? 1.5;
  const X0 = bx0 - pad, Y0 = by0 - pad, W = bx1 - bx0 + 2 * pad, H = by1 - by0 + 2 * pad;
  const pxPerM = opt.pxPerM || 20;
  const size = opt.noSize ? "" : ` width="${Math.round(W * pxPerM)}" height="${Math.round(H * pxPerM)}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f3(X0)} ${f3(-Y0 - H)} ${f3(W)} ${f3(H)}"${size} font-family="IBM Plex Sans, Arial, sans-serif">` +
    (opt.bg ? `<rect x="${f3(X0)}" y="${f3(-Y0 - H)}" width="${f3(W)}" height="${f3(H)}" fill="${opt.bg}"/>` : "") +
    (opt.pre || "") + sceneMarkup(scene, opt.lw || 0.05) + "</svg>";
}

function toDXF(scenes) {
  // scenes: [{scene, dx, dy}] placed side by side in one model space, metres
  const L = [];
  const g = (c, v) => L.push(String(c), String(v));
  g(0, "SECTION"); g(2, "HEADER"); g(9, "$ACADVER"); g(1, "AC1009"); g(9, "$INSUNITS"); g(70, 6); g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "TABLES");
  g(0, "TABLE"); g(2, "LTYPE"); g(70, 2);
  g(0, "LTYPE"); g(2, "CONTINUOUS"); g(70, 0); g(3, "Solid line"); g(72, 65); g(73, 0); g(40, 0.0);
  g(0, "LTYPE"); g(2, "DASHED"); g(70, 0); g(3, "Dashed"); g(72, 65); g(73, 2); g(40, 0.75); g(49, 0.5); g(49, -0.25);
  g(0, "ENDTAB");
  g(0, "TABLE"); g(2, "LAYER"); g(70, Object.keys(DXFCOL).length);
  for (const [n, c] of Object.entries(DXFCOL)) { g(0, "LAYER"); g(2, n); g(70, 0); g(62, c); g(6, "CONTINUOUS"); }
  g(0, "ENDTAB"); g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "ENTITIES");
  for (const { scene, dx = 0, dy = 0 } of scenes) {
    for (const it of scene.items) {
      const lt = it.dash ? "DASHED" : null;
      if (it.t === "poly") {
        const P = it.closed ? [...it.pts, it.pts[0]] : it.pts;
        for (let i = 0; i < P.length - 1; i++) {
          g(0, "LINE"); g(8, it.L); if (lt) g(6, lt);
          g(10, f3(P[i][0] + dx)); g(20, f3(P[i][1] + dy)); g(30, 0); g(11, f3(P[i + 1][0] + dx)); g(21, f3(P[i + 1][1] + dy)); g(31, 0);
        }
      } else if (it.t === "circle") {
        g(0, "CIRCLE"); g(8, it.L); if (lt) g(6, lt); g(10, f3(it.c[0] + dx)); g(20, f3(it.c[1] + dy)); g(30, 0); g(40, f3(it.r));
      } else {
        const h = it.size * 0.72;
        let rot = it.rot || 0, anc = it.anchor; if (rot) { rot = ((rot % 360) + 540) % 360 - 180; if (rot > 90.5 || rot <= -89.5) { rot += rot > 0 ? -180 : 180; anc = anc === "start" ? "end" : anc === "end" ? "start" : anc; } }
        const al = anc === "start" ? 0 : anc === "end" ? 2 : 1;
        g(0, "TEXT"); g(8, it.L); g(10, f3(it.p[0] + dx)); g(20, f3(it.p[1] + dy)); g(30, 0); g(40, f3(h));
        g(1, String(it.s).replace(/[^\x20-\x7E]/g, c => c === "Ø" ? "%%c" : c === "°" ? "%%d" : c === "≈" ? "~" : "-"));
        if (rot) g(50, f3(rot));
        if (al) { g(72, al); g(73, 2); g(11, f3(it.p[0] + dx)); g(21, f3(it.p[1] + dy)); g(31, 0); }
        else { g(72, 0); g(73, 2); g(11, f3(it.p[0] + dx)); g(21, f3(it.p[1] + dy)); g(31, 0); }
      }
    }
  }
  g(0, "ENDSEC"); g(0, "EOF");
  return L.join("\r\n");
}

// ===== crane paint (real-world livery colours) =====
const PAINTS = [
  { name: "Crane yellow", hex: "#e8b90f" }, { name: "Signal red", hex: "#b8252d" }, { name: "White", hex: "#e4e7ea" },
  { name: "Racing green", hex: "#2f6b3a" }, { name: "Safety orange", hex: "#d9661f" }, { name: "Steel blue", hex: "#2d5c8a" },
  { name: "Graphite", hex: "#4a5159" }
];
const hexRgb = h => { const m = String(h || "#888888").replace("#", ""); const v = m.length === 3 ? m.split("").map(c => c + c).join("") : m; return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) || 0); };
const rgbHex = c => "#" + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mixHex = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A.map((v, i) => v + (B[i] - v) * t)); };
const lum = h => { const [r, g, b] = hexRgb(h).map(v => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
// readable ink for labels / hook lines on white paper
function inkFor(paint) { const L = lum(paint); return L > 0.55 ? mixHex(paint, "#000000", L > 0.8 ? 0.62 : 0.45) : L > 0.4 ? mixHex(paint, "#000000", 0.25) : paint; }
function paintSet(paint) {
  const L = lum(paint), light = L > 0.8;
  return {
    stroke: light ? "#4b5563" : mixHex(paint, "#000000", 0.45),
    body: light ? paint : mixHex(paint, "#ffffff", 0.35),
    carrier: light ? "#f4f5f6" : mixHex(paint, "#ffffff", 0.55),
    boom: light ? "#f7f8f9" : mixHex(paint, "#ffffff", 0.2),
    boom2: light ? "#e9ecef" : mixHex(paint, "#ffffff", 0.45),
    cw: mixHex(paint, "#5b636b", 0.55)
  };
}
const KEEP_FILLS = new Set(["#ffffff", "#9fb4c7", "none", "transparent"]);
function paintScene(sc, paint) {
  if (!paint) return sc;
  const P = paintSet(paint);
  for (const it of sc.items) {
    if (it.t === "text") continue;
    const L = it.L;
    if (!["CARRIER", "UPPER", "BOOM", "COUNTERWEIGHT"].includes(L)) continue;
    it.color = P.stroke;
    if (it.fill && !KEEP_FILLS.has(String(it.fill).toLowerCase())) {
      it.fill = L === "CARRIER" ? P.carrier : L === "COUNTERWEIGHT" ? P.cw : L === "BOOM" ? (it.fill === true ? P.boom : P.boom2) : P.body;
    }
  }
  return sc;
}
