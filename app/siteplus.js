// ================= Marine structures and shaped ground =================
// Real sites are built from objects you can move, resize or delete: jetty / trestle decks on piles, mooring and breasting
// dolphins, rock slopes (breakwater / revetment) that run from the platform edge down under the water, and roads drawn
// along their centre line.
OBJ_TYPES.jetty = { name: "Jetty / trestle deck on piles", cat: "Marine", kind: "rect", w: 40, h: 8, hgt: 2.5, pass: true, color: "#a3a8ad" };
OBJ_TYPES.dolphin = { name: "Mooring / breasting dolphin", cat: "Marine", kind: "rect", w: 8, h: 6, hgt: 2.5, color: "#8d939a" };
OBJ_TYPES.rock = { name: "Rock slope / breakwater (draw)", cat: "Marine", kind: "poly", draw: true, hgt: 0, pass: true, color: "#837c70" };

// a road (or any band) as an outline round a centre line, width w
function bandPoly(C, w) {
  const h = w / 2, L = [], R = [];
  for (let i = 0; i < C.length; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(C.length - 1, i + 1)], d = [b[0] - a[0], b[1] - a[1]], n0 = Math.hypot(...d) || 1;
    let nx = -d[1] / n0, ny = d[0] / n0, k = 1;
    if (i > 0 && i < C.length - 1) { const d1 = [C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]], l1 = Math.hypot(...d1) || 1, c = (d1[0] * d[0] + d1[1] * d[1]) / (l1 * n0); k = 1 / Math.max(0.5, Math.sqrt((1 + c) / 2)); }
    L.push([C[i][0] + nx * h * k, C[i][1] + ny * h * k]); R.push([C[i][0] - nx * h * k, C[i][1] - ny * h * k]);
  }
  return [...L, ...R.reverse()];
}
// a chain resampled to n points evenly along its length (for slopes: toe and crest get matching points)
function resampleChain(P, n) {
  const seg = [], acc = [0]; for (let i = 0; i < P.length - 1; i++) { seg.push(Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1])); acc.push(acc[i] + seg[i]); }
  const T = acc[acc.length - 1] || 1, out = [];
  for (let k = 0; k < n; k++) { const s = T * k / (n - 1); let i = 0; while (i < seg.length - 1 && acc[i + 1] < s) i++; const t = seg[i] ? (s - acc[i]) / seg[i] : 0; out.push([P[i][0] + (P[i + 1][0] - P[i][0]) * t, P[i][1] + (P[i + 1][1] - P[i][1]) * t]); }
  return out;
}
// rock slope between a top edge (crest, z top) and a toe (z toe, usually the sea bed): stored as top chain + toe chain reversed
// mid: optional break in the slope { f: fraction of the way out, z } – e.g. the low-water line of a breakwater
function makeSlope(top, toe, zTop, zToe, label, mid) {
  const n = Math.max(top.length, toe.length, Math.ceil(Math.max(...[top, toe].map(P => P.reduce((a, p, i) => i ? a + Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]) : 0, 0))) / 6));
  const A = resampleChain(top, n), B = resampleChain(toe, n);
  const o = makeObject("rock", null, [...A, ...B.reverse()]); o.label = label || "Rock slope"; o.slope = { n, zTop, zToe, ...(mid ? { mid } : {}) }; return o;
}
{ const _o3 = obj3D; obj3D = function (M, o, P2) {
    const col = obsColor(o), h = +o.hgt || 0;
    if (o.type === "jetty" && o.kind === "rect") {
      const w = +o.w || 10, d = +o.h || 6, loc = (x, y, z) => { const r = rot2([x, y], -(o.rot || 0)); return [o.x + r[0], o.y + r[1], z]; }, wl = siteWaterLevel();
      M.prism(P2, h - 1.1, h, col, { tex: "yard" });
      const nx = Math.max(1, Math.round(w / 7)), rows = d > 5 ? [-d / 2 + 0.9, d / 2 - 0.9] : [0];
      for (let i = 0; i <= nx; i++) { const x = -w / 2 + 0.8 + (w - 1.6) * i / nx; for (const y of rows) M.cyl(loc(x, y, wl - 4), loc(x, y, h - 1.1), 0.42, "#6f757b", { n: 10 }); }
      for (const y of [-d / 2 + 0.1, d / 2 - 0.1]) M.line(loc(-w / 2, y, h + 1.1), loc(w / 2, y, h + 1.1), "#e0b400", 1);   // handrails
      return true;
    }
    if (o.type === "dolphin" && o.kind === "rect") {
      const w = +o.w || 8, d = +o.h || 6, loc = (x, y, z) => { const r = rot2([x, y], -(o.rot || 0)); return [o.x + r[0], o.y + r[1], z]; }, wl = siteWaterLevel();
      M.prism(P2, h - 1.8, h, col);
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.cyl(loc(sx * (w / 2 - 1), sy * (d / 2 - 1), wl - 4), loc(sx * (w / 2 - 1), sy * (d / 2 - 1), h - 1.8), 0.55, "#6f757b", { n: 10 });
      M.cyl(loc(0, 0, h), loc(0, 0, h + 0.8), 0.35, "#2f3439", { n: 10 });     // quick-release hook / bollard
      return true;
    }
    if (o.type === "rock" && o.slope && (o.pts || []).length === 2 * o.slope.n) {
      const n = o.slope.n, P = o.pts, A = P.slice(0, n), B = P.slice(n).reverse(), z0 = +o.slope.zTop || 0, z1 = +o.slope.zToe || -8;
      const md = o.slope.mid, f = md ? Math.max(0.05, Math.min(0.95, +md.f || 0.5)) : null, zm = md ? +md.z : null;
      const Cm = md ? A.map((a, i) => [a[0] + (B[i][0] - a[0]) * f, a[1] + (B[i][1] - a[1]) * f]) : null;
      const strip = (P, Q, za, zb, k) => { for (let i = 0; i < n - 1; i++) M.face([[P[i][0], P[i][1], za], [P[i + 1][0], P[i + 1][1], za], [Q[i + 1][0], Q[i + 1][1], zb], [Q[i][0], Q[i][1], zb]], (i + k) % 3 ? col : shade(col, 0.92), { two: true }); };
      if (md) { strip(A, Cm, z0, zm, 0); strip(Cm, B, zm, z1, 1); } else strip(A, B, z0, z1, 0);
      return true;
    }
    return _o3(M, o, P2);
  }; }
