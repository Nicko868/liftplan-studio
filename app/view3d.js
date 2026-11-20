// ================= Side elevations and 3D view of the whole site =================
// World: x = East, y = North, z = up (metres). Orthographic projection, painter's algorithm, flat shading.
const V3 = { mode: "top", dir: "N", az: 215, el: 28, zoom: 1, pan: [0, 0] };

const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vmul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const newell = P => { let x = 0, y = 0, z = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); } const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const vnorm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

class Mesh {
  constructor() { this.faces = []; this.lines = []; this.labels = []; }
  face(pts, fill, o = {}) { this.faces.push({ pts, fill, alpha: o.alpha ?? 1, stroke: o.stroke, two: o.two, soft: o.soft, bias: o.bias || 0, flat: o.flat }); }
  // face whose normal is turned to point away from an interior point
  faceO(pts, fill, inside, o = {}) {
    const n = newell(pts), c = pts.reduce((a, p) => vadd(a, p), [0, 0, 0]).map(v => v / pts.length);
    this.face(vdot(n, vsub(c, inside)) < 0 ? [...pts].reverse() : pts, fill, o);
  }
  // prism along frame y (s0 → s1) with a cross-section polygon given in frame (x, z)
  extrude(F, prof, s0, s1, fill, o = {}) {
    const P = (x, y, z) => vadd(F.o, vadd(vmul(F.x, x), vadd(vmul(F.y, y), vmul(F.z, z))));
    const cx = prof.reduce((a, p) => a + p[0], 0) / prof.length, cz = prof.reduce((a, p) => a + p[1], 0) / prof.length;
    const inside = P(cx, (s0 + s1) / 2, cz);
    for (let i = 0; i < prof.length; i++) { const a = prof[i], b = prof[(i + 1) % prof.length]; this.faceO([P(a[0], s0, a[1]), P(b[0], s0, b[1]), P(b[0], s1, b[1]), P(a[0], s1, a[1])], o.sideFill || fill, inside, { ...o, soft: o.soft ?? prof.length > 8 }); }
    if (!o.open) { this.faceO(prof.map(p => P(p[0], s0, p[1])), o.capFill || fill, inside, o); this.faceO(prof.map(p => P(p[0], s1, p[1])), o.capFill || fill, inside, o); }
  }
  line(a, b, color, w = 1.2, dash) { this.lines.push({ a, b, color, w, dash }); }
  label(p, text, color, size = 12, bold = true) { this.labels.push({ p, text, color, size, bold }); }
  // oriented box: frame {o, x, y, z} (unit axes), extents in the frame
  box(F, x0, x1, y0, y1, z0, z1, fill, o = {}) {
    const P = (x, y, z) => vadd(F.o, vadd(vmul(F.x, x), vadd(vmul(F.y, y), vmul(F.z, z))));
    const c = [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
    for (const q of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) this.face(q.map(i => c[i]), fill, o);
  }
  // cylinder / frustum between world points a and b
  cyl(a, b, r0, fill, o = {}) {
    const r1 = o.r1 ?? r0, n = o.n || 18, ax = vnorm(vsub(b, a));
    const t = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], u = vnorm(vcross(ax, t)), v = vcross(ax, u);
    const ring = (c, r) => Array.from({ length: n }, (_, i) => { const q = i / n * Math.PI * 2; return vadd(c, vadd(vmul(u, r * Math.cos(q)), vmul(v, r * Math.sin(q)))); });
    const A = ring(a, r0), B = ring(b, r1);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.face([A[i], A[j], B[j], B[i]], fill, { ...o, soft: true }); }
    if (!o.open) { this.face([...A].reverse(), o.cap || fill, o); this.face(B, o.cap || fill, o); }
  }
  prism(P2, z0, z1, fill, o = {}) {
    // make polygon counter-clockwise
    let area = 0; for (let i = 0; i < P2.length; i++) { const a = P2[i], b = P2[(i + 1) % P2.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const P = area < 0 ? [...P2].reverse() : P2;
    this.face(P.map(p => [p[0], p[1], z1]), fill, o);
    this.face([...P].reverse().map(p => [p[0], p[1], z0]), fill, o);
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; this.face([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], fill, o); }
  }
}
const frame = (o, headingDeg) => { const h = headingDeg * D2R; return { o, x: [Math.cos(h), -Math.sin(h), 0], y: [Math.sin(h), Math.cos(h), 0], z: [0, 0, 1] }; };

// ---------- crane in 3D ----------
const FP = F => (x, y, z) => vadd(F.o, vadd(vmul(F.x, x), vadd(vmul(F.y, y), vmul(F.z, z))));
function ovalProfile(W, D, n = 7) {       // telescopic boom section: flat top, rounded (oval) belly
  const c = Math.min(W, D) * 0.12, P = [[-W / 2 + c, D / 2], [W / 2 - c, D / 2], [W / 2, D / 2 - c], [W / 2, 0]];
  for (let i = 1; i < n; i++) { const a = -Math.PI * i / n; P.push([W / 2 * Math.cos(a), D / 2 * Math.sin(a)]); }
  P.push([-W / 2, 0], [-W / 2, D / 2 - c]);
  return P;
}
function tube(M, pts3, color, n = 10) { for (let i = 0; i < pts3.length - 1; i++) M.cyl(pts3[i].p, pts3[i + 1].p, pts3[i].r, color, { r1: pts3[i + 1].r, n, open: i > 0 && i < pts3.length - 2 }); }
function stripes(M, F, y, x0, x1, z0, z1, n, inside) {   // red/white warning stripes on a face at frame-y = y
  const P = FP(F), w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) M.faceO([P(x0 + i * w, y, z0), P(x0 + (i + 1) * w, y, z0), P(x0 + (i + 1) * w, y, z1), P(x0 + i * w, y, z1)], i % 2 ? "#ffffff" : "#c8102e", inside, { bias: 0.03 });
}
function sheavePack(M, S, a, l, bd, r, color) {   // sheaves side by side across l, centred at S
  const ns = bd.sheaves, gap = 0.15;
  for (let i = 0; i < ns; i++) {
    const o = (i - (ns - 1) / 2) * gap, c = vadd(S, vmul(l, o));
    M.cyl(vadd(c, vmul(l, -0.055)), vadd(c, vmul(l, 0.055)), r, color, { n: 18, cap: shade(color, 0.93) });
    M.cyl(vadd(c, vmul(l, -0.065)), vadd(c, vmul(l, 0.065)), r * 0.28, "#6b7278", { n: 10 });
  }
}
function block3D(M, bd, hk, a, l) {
  // hk = hook seat point; a = horizontal rope-plane direction; l = across
  const F = { o: hk, x: a, y: l, z: [0, 0, 1] }, P = FP(F);
  const plate = blockPlate(bd), inside = vadd(hk, [0, 0, bd.hookLen + bd.H / 2]);
  const plates = bd.type === "single" ? [-bd.T / 2, bd.T / 2] : [-bd.T / 2, 0, bd.T / 2];
  const t = 0.05;
  for (const ly of plates) {
    const face = (yy) => plate.map(p => P(p[0], yy, p[1]));
    const outer = ly === 0 ? null : ly + Math.sign(ly) * t;
    // plate slab
    const pin = P(0, ly, bd.hookLen + bd.H * 0.6);
    M.faceO(face(ly - t), BLOCK_YELLOW, pin); M.faceO(face(ly + t), BLOCK_YELLOW, pin);
    for (let i = 0; i < plate.length; i++) { const p = plate[i], q = plate[(i + 1) % plate.length]; M.faceO([P(p[0], ly - t, p[1]), P(q[0], ly - t, q[1]), P(q[0], ly + t, q[1]), P(p[0], ly + t, p[1])], shade(BLOCK_YELLOW, 0.85), pin); }
    if (outer != null) for (const d of plateDecals(bd)) M.faceO(d.pts.map(p => P(p[0], outer + Math.sign(ly) * 0.004, p[1])), d.color, inside, { bias: 0.02 });
  }
  // sheaves visible between the plates
  const cs = sheaveCentres(bd);
  cs.forEach(([ca, cz], gi) => {
    const grp = bd.type === "single" ? bd : { ...bd, sheaves: Math.max(1, Math.ceil(bd.sheaves / 2)) };
    const off = bd.type === "single" ? 0 : (gi ? 1 : -1) * bd.T / 4;
    sheavePack(M, P(ca, off, cz), a, l, grp, bd.rs, "#3d4247");
  });
  // bottom crosshead and hook
  M.box(F, -bd.W * 0.2, bd.W * 0.2, -bd.T / 2, bd.T / 2, bd.hookLen - 0.08, bd.hookLen + 0.12, shade(BLOCK_YELLOW, 0.8));
  for (const c of hookCurves(bd)) tube(M, c.map(p => ({ p: P(p[0], 0, p[1]), r: p[2] })), bd.type === "single" ? HOOK_STEEL : HOOK_DARK, 10);
  return cs.map(([ca, cz]) => P(ca, 0, cz));
}
function crane3D(M, cr, ev) {
  const C = ev.C; if (!C) return;
  const P = paintSet(cr.paint || "#e8b90f"), body = cr.paint || "#e8b90f";
  const base = [cr.x, cr.y, 0], CF = frame(base, cr.heading), CP = FP(CF);
  const dark = "#2b2f33", steel = "#8a9199", glass = "#4c6377", chrome = "#c9ced3";
  if (C.type === "ped") pedCarrier3D(M, cr, C, P);
  else if (C.type === "cr") {
    const k = C.car, r = k.trackH / 2;
    const stad = []; for (let i = 0; i <= 8; i++) { const q = Math.PI / 2 + Math.PI * i / 8; stad.push([-k.len / 2 + r + r * Math.cos(q), r + r * Math.sin(q)]); } for (let i = 0; i <= 8; i++) { const q = -Math.PI / 2 + Math.PI * i / 8; stad.push([k.len / 2 - r + r * Math.cos(q), r + r * Math.sin(q)]); }
    for (const sx of [-1, 1]) {
      const TF = { o: vadd(base, vmul(CF.x, sx * k.gauge / 2 - k.shoe / 2)), x: CF.y, y: CF.x, z: [0, 0, 1] };
      M.extrude(TF, stad, 0, k.shoe, "#3e4348");
      M.extrude({ ...TF, o: vadd(TF.o, vmul(CF.x, 0.2)) }, stad.map(p => [p[0] * 0.93, r + (p[1] - r) * 0.7]), -0.01, k.shoe - 0.4, P.carrier, { open: false });
    }
    M.box(CF, -k.gauge / 2 + k.shoe / 2, k.gauge / 2 - k.shoe / 2, -1.7, 1.7, 0.45, k.carbodyH - 0.1, P.carrier);
    M.box(CF, -1.7, 1.7, -3.0, 3.0, 0.45, k.carbodyH - 0.1, P.carrier);
  } else {
    const k = C.car, w = k.w, om = C.or.modes[cr.orMode] || Object.values(C.or.modes)[0];
    om.pads.forEach(([sx, y]) => {
      const px = sx * om.spread / 2;
      M.box(CF, Math.min(sx * (w / 2 - 0.2), px), Math.max(sx * (w / 2 - 0.2), px), y - 0.24, y + 0.24, k.frameLow + 0.05, k.frameLow + 0.55, P.carrier);
      M.box(CF, Math.min(sx * (w / 2 - 0.2), px - sx * 0.9), Math.max(sx * (w / 2 - 0.2), px - sx * 0.9), y - 0.26, y + 0.26, k.frameLow + 0.02, k.frameLow + 0.58, body);
      const jp = CP(px, y, 0);
      M.cyl([jp[0], jp[1], 0.32], [jp[0], jp[1], k.frameLow + 0.1], 0.13, chrome, { n: 10 });
      M.cyl([jp[0], jp[1], k.frameLow + 0.1], [jp[0], jp[1], k.frameLow + 0.9], 0.2, body, { n: 12 });
      M.cyl([jp[0], jp[1], 0.2], [jp[0], jp[1], 0.32], C.or.float / 2, dark, { n: 16 });
    });
    const lift = 0.2;
    for (const ay of k.axles) for (const sx of [-1, 1]) {
      const xo = sx * (w / 2 - 0.02), xi = sx * (w / 2 - k.tyreW);
      const c0 = CP(xi, ay, k.tyreR + lift), c1 = CP(xo, ay, k.tyreR + lift);
      M.cyl(c0, c1, k.tyreR, "#202326", { n: 18, cap: "#2e3236" });
      M.cyl(c1, vadd(c1, vmul(CF.x, sx * 0.02)), k.tyreR * 0.55, "#a7aeb5", { n: 14 });
      M.cyl(vadd(c1, vmul(CF.x, sx * 0.02)), vadd(c1, vmul(CF.x, sx * 0.06)), k.tyreR * 0.18, "#5f666d", { n: 8 });
    }
    // chassis, fenders and decks
    M.box(CF, -w / 2 + 0.35, w / 2 - 0.35, k.rear + 0.2, k.front - k.cabLen, k.frameLow - 0.25, k.frameLow + 0.45, "#34393e");
    const groups = []; [...k.axles].sort((a, b) => b - a).forEach(y => { const g = groups[groups.length - 1]; if (g && g[1] - y < k.tyreR * 2.6) g[1] = y; else groups.push([y, y]); });
    for (const [ya, yb] of groups) for (const sx of [-1, 1]) M.box(CF, Math.min(sx * w / 2, sx * (w / 2 - k.tyreW - 0.05)), Math.max(sx * w / 2, sx * (w / 2 - k.tyreW - 0.05)), yb - k.tyreR - 0.15, ya + k.tyreR + 0.15, k.tyreR * 2 + lift + 0.05, k.deckH - 0.05, P.carrier);
    M.box(CF, -w / 2, w / 2, k.rear, k.front - k.cabLen, k.deckH - 0.25, k.deckH, P.carrier);
    M.box(CF, -w / 2, w / 2, k.rear, k.rear + 0.35, k.frameLow - 0.2, k.deckH - 0.25, P.carrier);
    stripes(M, CF, k.rear - 0.001, -w / 2 + 0.1, w / 2 - 0.1, k.frameLow - 0.1, k.frameLow + 0.35, 8, CP(0, k.rear + 1, 1.5));
    // driver cab with raked windscreen
    const y0 = k.front - k.cabLen, y1 = k.front, zc0 = k.frameLow - 0.1, zc1 = k.cabH;
    const cabF = { o: CP(-w / 2 + 0.05, 0, 0), x: CF.y, y: CF.x, z: [0, 0, 1] };
    M.extrude(cabF, [[y0, zc0], [y1, zc0], [y1, zc1 - 1.05], [y1 - 0.45, zc1], [y0, zc1]], 0, w - 0.1, body);
    const gF = FP(cabF);
    M.faceO([gF(y1 + 0.01, 0.15, zc1 - 1.0), gF(y1 + 0.01, w - 0.25, zc1 - 1.0), gF(y1 - 0.41, w - 0.25, zc1 - 0.06), gF(y1 - 0.41, 0.15, zc1 - 0.06)], glass, CP(0, y0, zc0 + 0.5), { bias: 0.03 });
    for (const sx of [-1, 1]) { const xx = sx * (w / 2 - 0.05 + 0.006); M.faceO([CP(xx, y0 + 0.2, zc1 - 0.95), CP(xx, y1 - 0.55, zc1 - 0.95), CP(xx, y1 - 0.55, zc1 - 0.2), CP(xx, y0 + 0.2, zc1 - 0.2)], glass, CP(0, (y0 + y1) / 2, 2), { bias: 0.03 }); }
    stripes(M, CF, y1 + 0.001, -w / 2 + 0.1, w / 2 - 0.1, zc0 + 0.05, zc0 + 0.4, 8, CP(0, y0, 1.5));
  }
  // superstructure, rotated to the boom bearing
  const u = C.up, b = C.boom, UF = frame(base, ev.bearing), UP = FP(UF), th = (ev.ba?.theta || 45) * D2R;
  const zb = C.type === "cr" ? C.car.carbodyH : C.car.deckH;
  M.cyl([cr.x, cr.y, zb - 0.1], [cr.x, cr.y, u.baseH + 0.05], Math.min(1.35, u.deckW / 2), "#50565c", { n: 22 });
  const yR = -(u.tail - u.cwD), yF = u.deckFront, zb0 = u.baseH, zb1 = u.baseH + u.bodyH;
  const upF = { o: UP(-u.deckW / 2, 0, 0), x: UF.y, y: UF.x, z: [0, 0, 1] };
  M.extrude(upF, [[yR, zb0], [yF, zb0], [yF, zb1 - 0.25], [yF - 0.3, zb1], [yR + 0.2, zb1], [yR, zb1 - 0.2]], 0, u.deckW, body);
  // engine / winch housing at the rear
  M.box(UF, -u.deckW / 2 + 0.1, u.deckW * 0.1, yR + 0.1, yR + Math.min(2.4, (yF - yR) * 0.45), zb1, zb1 + 0.7, P.carrier);
  // hoist winch drum
  const drY = yR + 0.6 + Math.min(1.4, (yF - yR) * 0.3), drZ = zb1 + 0.45;
  M.cyl(UP(-0.55, drY, drZ), UP(0.55, drY, drZ), 0.42, "#3a3f44", { n: 16, cap: "#6b7278" });
  // counterweight slabs
  const nSl = C.type === "cr" ? 4 : C.type === "ped" ? 2 : 3, slabH = (u.cwH - 0.1) / nSl;
  for (let i = 0; i < nSl; i++) {
    const z0 = zb0 + 0.1 + i * slabH, sh = [[-u.cwW / 2 + 0.25, -u.tail], [u.cwW / 2 - 0.25, -u.tail], [u.cwW / 2, -u.tail + 0.35], [u.cwW / 2, -u.tail + u.cwD], [-u.cwW / 2, -u.tail + u.cwD], [-u.cwW / 2, -u.tail + 0.35]];
    M.extrude({ o: UP(0, 0, 0), x: UF.x, y: [0, 0, 1], z: UF.y }, sh.map(p => [p[0], p[1]]), z0, z0 + slabH - 0.05, i % 2 ? P.cw : shade(P.cw, 0.92));
  }
  // operator cab with raked glazing
  const cx0 = u.cab.lat[0], cx1 = u.cab.lat[1], cf0 = u.cab.fwd[0], cf1 = u.cab.fwd[1], ch0 = zb0 + 0.1, ch1 = zb0 + u.cab.h;
  const ocF = { o: UP(cx0, 0, 0), x: UF.y, y: UF.x, z: [0, 0, 1] }, OC = FP(ocF);
  M.extrude(ocF, [[cf0, ch0], [cf1, ch0], [cf1 + 0.1, ch0 + (ch1 - ch0) * 0.45], [cf1 - 0.3, ch1], [cf0, ch1]], 0, cx1 - cx0, P.carrier);
  M.faceO([OC(cf1 + 0.1 + 0.01, 0.1, ch0 + (ch1 - ch0) * 0.48), OC(cf1 + 0.01 + 0.1, cx1 - cx0 - 0.1, ch0 + (ch1 - ch0) * 0.48), OC(cf1 - 0.28, cx1 - cx0 - 0.1, ch1 - 0.05), OC(cf1 - 0.28, 0.1, ch1 - 0.05)], glass, UP((cx0 + cx1) / 2, cf0, ch0 + 0.3), { bias: 0.03 });
  const sideX = cx0 < 0 ? cx0 - 0.006 : cx1 + 0.006;
  M.faceO([UP(sideX, cf0 + 0.25, ch0 + (ch1 - ch0) * 0.45), UP(sideX, cf1 - 0.2, ch0 + (ch1 - ch0) * 0.45), UP(sideX, cf1 - 0.35, ch1 - 0.15), UP(sideX, cf0 + 0.25, ch1 - 0.15)], glass, UP((cx0 + cx1) / 2, (cf0 + cf1) / 2, ch0 + 0.5), { bias: 0.03 });
  // boom frame: y along the boom, z normal to it
  const pvz = b.pivot[1] + (C.type === "cr" || C.type === "ped" ? 0 : DZ);
  const bo = vadd(base, vadd(vmul(UF.y, b.pivot[0]), [0, 0, pvz]));
  const by = vadd(vmul(UF.y, Math.cos(th)), [0, 0, Math.sin(th)]), bz = vadd(vmul(UF.y, -Math.sin(th)), [0, 0, Math.cos(th)]);
  const BF = { o: bo, x: UF.x, y: by, z: bz }, BP = FP(BF);
  // boom foot brackets
  for (const sx of [-1, 1]) { const xx = sx * (b.W0 / 2 + 0.08); M.faceO([UP(xx, b.pivot[0] - 0.8, zb1 - 0.05), UP(xx, b.pivot[0] + 1.2, zb1 - 0.05), UP(xx, b.pivot[0] + 0.1, pvz + 0.5)], P.stroke, UP(0, b.pivot[0], pvz), { flat: true }); }
  const L = cr.L, bd = blockDims(cr, C);
  let headTop;
  if (b.kind === "tele") {
    const cum = teleCum(b, L, { ext: cr.boomCfg?.ext });
    for (let i = 0; i < b.n; i++) {
      const s0 = cum[i], s1 = Math.min(cum[i] + b.Lmin - 1.0 - 0.1 * i, L - 0.95), W = b.W0 * (1 - 0.07 * i), D = b.D0 * (1 - 0.075 * i), zo = -(b.D0 - D) * 0.35;
      if (s1 <= s0) continue;
      M.extrude({ ...BF, o: BP(0, 0, zo) }, ovalProfile(W, D), s0, s1, body);
      M.extrude({ ...BF, o: BP(0, 0, zo) }, ovalProfile(W + 0.06, D + 0.06), s1 - 0.28, s1, P.stroke);   // section collar / guide
    }
    // luffing cylinder: barrel + chrome rod
    const cb = UP(0, b.cyl[0], u.baseH + b.cyl[1]), ct = vadd(bo, vadd(vmul(by, 0.42 * b.Lmin), vmul(bz, -b.D0 * 0.35)));
    const mid = vadd(cb, vmul(vsub(ct, cb), 0.55));
    M.cyl(cb, mid, 0.3, "#3f454b", { n: 14 }); M.cyl(mid, ct, 0.17, chrome, { n: 12 });
    headTop = b.D0 * 0.3;
  } else {
    const J = [0, ...(boomJoints(C, cr.boomCfg) || []), L];
    const half = sv => { const t = Math.min(1, sv / 6, (L - sv) / 6); return [b.W0 / 2 * (0.45 + 0.55 * Math.max(0, t)), b.D0 / 2 * (0.45 + 0.55 * Math.max(0, t))]; };
    const stations = []; for (let sv = 0; sv < L - 1.2; sv += 2.2) stations.push(sv); stations.push(L - 1.2);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (let i = 0; i < stations.length - 1; i++) {
      const a0 = stations[i], a1 = stations[i + 1], h0 = half(a0), h1 = half(a1);
      M.cyl(BP(sx * h0[0], a0, sz * h0[1]), BP(sx * h1[0], a1, sz * h1[1]), 0.09, body, { n: 6, open: true });
    }
    for (let i = 0; i < stations.length - 1; i++) {
      const a0 = stations[i], a1 = stations[i + 1], h0 = half(a0), h1 = half(a1), f = i % 2 ? 1 : -1;
      for (const sx of [-1, 1]) M.line(BP(sx * h0[0], a0, f * h0[1]), BP(sx * h1[0], a1, -f * h1[1]), P.stroke, 0.9);
      for (const sz of [-1, 1]) M.line(BP(f * h0[0], a0, sz * h0[1]), BP(-f * h1[0], a1, sz * h1[1]), P.stroke, 0.9);
    }
    for (const sv of J.slice(1, -1)) { const h = half(sv), R4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; R4.forEach((q, i) => { const n = R4[(i + 1) % 4]; M.line(BP(q[0] * h[0], sv, q[1] * h[1]), BP(n[0] * h[0], sv, n[1] * h[1]), P.stroke, 3.5); }); }
    const af = UP(0, -1.5, u.baseH + 7);
    for (const sx of [-1, 1]) M.cyl(UP(sx * 0.9, -0.5, zb1), vadd(af, vmul(UF.x, sx * 0.9)), 0.12, P.stroke, { n: 6 });
    M.line(af, BP(0, L - 0.8, 0.6), "#3b4148", 1.2);
    headTop = 0.6;
  }
  // boom head: side plates wrapped round the sheave pack (sheaves = half the parts of line)
  const lastW = b.kind === "tele" ? b.W0 * (1 - 0.07 * (b.n - 1)) : b.W0 * 0.45;
  const rH = Math.max(0.38, Math.min(0.75, bd.rs * 1.2 + 0.12)), hw = Math.max(lastW / 2 - 0.02, bd.sheaves * 0.15 / 2 + 0.1);
  const Sy = L - 0.15, Sz = b.kind === "tele" ? headTop - rH * 0.95 : -0.1;
  const S = BP(0, Sy, Sz);
  const hT = b.kind === "tele" ? headTop : 0.55, hB = b.kind === "tele" ? -Math.max(0.35, headTop * 0.9) : -0.55;
  const headOut = [[L - 1.05, hT], [Sy - 0.1, hT], [Sy + rH * 0.62, Sz + rH * 0.5], [Sy + rH * 0.7, Sz - rH * 0.15], [Sy + rH * 0.25, Sz - rH * 0.72], [L - 1.05, Math.min(hB, Sz - rH * 0.72)]];
  for (const sx of [-1, 1]) {
    const hF = { o: BP(sx * hw, 0, 0), x: by, y: UF.x, z: bz };
    M.extrude(hF, headOut, sx > 0 ? 0 : -0.05, sx > 0 ? 0.05 : 0, body, { sideFill: P.stroke });
  }
  M.extrude({ o: BP(0, 0, 0), x: UF.x, y: by, z: bz }, [[-hw, hT], [hw, hT], [hw, hT - 0.12], [-hw, hT - 0.12]], L - 1.05, Sy - 0.2, P.stroke);
  sheavePack(M, S, by, UF.x, bd, rH, "#e2e5e8");
  // anti-two-block switch weight hanging on the falls
  const a2b = vadd(S, [0, 0, -rH - 1.2]);
  M.line(vadd(S, vmul(UF.x, hw + 0.05)), vadd(a2b, vmul(UF.x, hw * 0.3)), "#5b6167", 0.8);
  M.cyl(vadd(a2b, vadd(vmul(UF.x, hw * 0.3), [0, 0, -0.18])), vadd(a2b, vadd(vmul(UF.x, hw * 0.3), [0, 0, 0.05])), 0.09, "#4a5056", { n: 8 });
  const tip = vadd(S, [0, 0, rH]);
  ev.tip3 = tip;
  // hoist rope from the winch drum along the boom to the head
  const ropeTop = b.kind === "tele" ? headTop + 0.05 : 0.7;
  M.line(UP(0, drY, drZ + 0.42), BP(0, 0.5, ropeTop), "#2b2f33", 1);
  M.line(BP(0, 0.5, ropeTop), BP(0, L - 0.2, ropeTop), "#2b2f33", 1);
  { const ts = txtStyleOf(cr); M.label(vadd(tip, [0, 0, 1.8]), `${cr.label} · ${C.short}`, ts.color || cr.color, 12 * ts.k); }
  return { tip, S, rH, UF, bd, a: [UF.y[0], UF.y[1], 0], l: UF.x };
}

// ---------- load in 3D (bottom at z = h) ----------
function load3D(M, ld, pos, ghost) {
  normLoad(ld);
  const o = ghost ? { alpha: 0.28 } : {};
  const F = frame([pos.x, pos.y, +pos.h || 0], (pos.rot || 0) + 90); // local x (A→B) points along the load's lifting line
  // frame() maps local y to "forward"; we want local x along A→B: use axes swap
  const X = F.y, Y = vmul(F.x, -1), Z = [0, 0, 1], O = F.o;
  const LF = { o: O, x: X, y: Y, z: Z };
  const P = (x, y, z) => vadd(O, vadd(vmul(X, x), vadd(vmul(Y, y), vmul(Z, z))));
  const grey = "#b9c0c7", dark = "#6c757d", k = ld.kind, d = loadDims(ld);
  if (k === "reel") {
    const R = ld.D / 2, FW = +ld.FW || 1, W = Math.max(+ld.W || 0, FW);
    if (ld.orient === "flat") { M.cyl(P(0, 0, 0), P(0, 0, 0.25), R, grey, o); M.cyl(P(0, 0, 0.25), P(0, 0, FW - 0.25), R * 0.93, dark, o); M.cyl(P(0, 0, FW - 0.25), P(0, 0, FW), R, grey, o); }
    else {
      M.cyl(P(-FW / 2, 0, R), P(-FW / 2 + 0.25, 0, R), R, grey, o); M.cyl(P(-FW / 2 + 0.25, 0, R), P(FW / 2 - 0.25, 0, R), R * 0.93, dark, o); M.cyl(P(FW / 2 - 0.25, 0, R), P(FW / 2, 0, R), R, grey, o);
      if (W > FW) M.cyl(P(-W / 2, 0, R), P(W / 2, 0, R), 0.2, "#4b5259", { ...o, n: 10 });
    }
  } else if (k === "silo") {
    const D = +ld.D, R = D / 2, H = +ld.H, cone = +ld.cone || 0, legs = +ld.legs || 0;
    if (ld.orient === "horizontal") {
      const se = H / 2 - cone - legs;
      M.cyl(P(-H / 2, 0, R), P(se, 0, R), R, "#d6dbe0", o); M.cyl(P(se, 0, R), P(se + cone, 0, R), R, "#c3c9cf", { ...o, r1: R * 0.15 });
      if (legs) for (const sy of [-1, 1]) for (const sz of [0.2, 1.8]) M.line(P(se, sy * R * 0.8, R * sz), P(H / 2, sy * R * 0.9, R * sz), dark, 2);
    } else {
      M.cyl(P(0, 0, legs + cone), P(0, 0, H), R, "#d6dbe0", o); M.cyl(P(0, 0, legs + cone), P(0, 0, legs), R, "#c3c9cf", { ...o, r1: R * 0.15 });
      if (legs) for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; M.box(LF, R * 0.85 * Math.cos(a) - 0.12, R * 0.85 * Math.cos(a) + 0.12, R * 0.85 * Math.sin(a) - 0.12, R * 0.85 * Math.sin(a) + 0.12, 0, legs + cone * 0.5, dark, o); }
    }
  } else if (k === "cyl") {
    if (ld.orient === "vertical") M.cyl(P(0, 0, 0), P(0, 0, +ld.L), ld.D / 2, "#9aa6b2", o);
    else M.cyl(P(-ld.L / 2, 0, ld.D / 2), P(ld.L / 2, 0, ld.D / 2), ld.D / 2, "#9aa6b2", o);
  } else if (k === "ccu") {
    const col = ld.colour || "#c8331f", st = ld.style || "closed", t = 0.1, dk = mixHex(col, "#000000", 0.3);
    if (st === "closed") M.box(LF, -d.x / 2, d.x / 2, -d.y / 2, d.y / 2, 0, d.z, col, o);
    else if (st === "open" || st === "half" || st === "basket") {
      M.box(LF, -d.x / 2, d.x / 2, -d.y / 2, d.y / 2, 0, 0.15, dk, o);
      for (const sy of [-1, 1]) M.box(LF, -d.x / 2, d.x / 2, sy > 0 ? d.y / 2 - t : -d.y / 2, sy > 0 ? d.y / 2 : -d.y / 2 + t, 0, d.z, col, o);
      for (const sx of [-1, 1]) M.box(LF, sx > 0 ? d.x / 2 - t : -d.x / 2, sx > 0 ? d.x / 2 : -d.x / 2 + t, -d.y / 2 + t, d.y / 2 - t, 0, d.z, col, o);
    } else {
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) M.box(LF, sx * d.x / 2 - (sx > 0 ? t : 0), sx * d.x / 2 + (sx < 0 ? t : 0), sy * d.y / 2 - (sy > 0 ? t : 0), sy * d.y / 2 + (sy < 0 ? t : 0), 0, d.z, col, o);
      for (const z of [0, d.z / 2, d.z - t]) { for (const sy of [-1, 1]) M.box(LF, -d.x / 2, d.x / 2, sy * d.y / 2 - (sy > 0 ? t : 0), sy * d.y / 2 + (sy < 0 ? t : 0), z, z + t, col, o); for (const sx of [-1, 1]) M.box(LF, sx * d.x / 2 - (sx > 0 ? t : 0), sx * d.x / 2 + (sx < 0 ? t : 0), -d.y / 2, d.y / 2, z, z + t, col, o); }
      if (st === "tankframe") { const R = Math.min(d.y, d.z) * 0.42; M.cyl(P(-d.x / 2 + 0.25, 0, d.z / 2), P(d.x / 2 - 0.25, 0, d.z / 2), R, "#dfe3e7", { ...o, n: 18 }); }
      else { const n = Math.max(2, Math.round(d.x / 0.3)), m = Math.max(2, Math.round(d.y / 0.3)); for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const x = -d.x / 2 + (i + 0.5) * d.x / n, y = -d.y / 2 + (j + 0.5) * d.y / m; M.cyl(P(x, y, 0.12), P(x, y, d.z - 0.35), Math.min(d.x / n, d.y / m) * 0.38, "#b9c0c7", { ...o, n: 8 }); } }
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) M.box(LF, sx * d.x / 2 - (sx > 0 ? 0.14 : 0), sx * d.x / 2 + (sx < 0 ? 0.14 : 0), sy * d.y / 2 - (sy > 0 ? 0.14 : 0), sy * d.y / 2 + (sy < 0 ? 0.14 : 0), d.z - 0.12, d.z + 0.02, dk, o);
  } else if (k === "container") {
    M.box(LF, -d.x / 2, d.x / 2, -d.y / 2, d.y / 2, 0, d.z, "#5d7fa3", o);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const z of [0, d.z - 0.12]) M.box(LF, sx > 0 ? d.x / 2 - 0.18 : -d.x / 2 - 0.01, sx > 0 ? d.x / 2 + 0.01 : -d.x / 2 + 0.18, sy > 0 ? d.y / 2 - 0.16 : -d.y / 2 - 0.01, sy > 0 ? d.y / 2 + 0.01 : -d.y / 2 + 0.16, z, z + 0.12, "#3e4a57", o);
  } else if (k === "tank") {
    const R = ld.D / 2, L = +ld.L, sad = +ld.saddle || 0, hd = Math.min(R * 0.5, L * 0.15);
    M.cyl(P(-L / 2 + hd, 0, sad + R), P(L / 2 - hd, 0, sad + R), R, "#d6dbe0", { ...o, open: true });
    M.cyl(P(L / 2 - hd, 0, sad + R), P(L / 2, 0, sad + R), R, "#c9cfd5", { ...o, r1: R * 0.35 }); M.cyl(P(-L / 2 + hd, 0, sad + R), P(-L / 2, 0, sad + R), R, "#c9cfd5", { ...o, r1: R * 0.35 });
    for (const sx of [-1, 1]) M.box(LF, sx * L * 0.3 - 0.25, sx * L * 0.3 + 0.25, -R * 0.9, R * 0.9, 0, sad + R * 0.35, "#7d858c", o);
  } else if (k === "beam") {
    const side = ld.orient === "side", Hh = side ? d.y : d.z, Ww = side ? d.z : d.y, fl = Math.max(0.03, Hh * 0.08), tw = Math.max(0.02, Ww * 0.08);
    const prof = [[-Ww / 2, 0], [Ww / 2, 0], [Ww / 2, fl], [tw / 2, fl], [tw / 2, Hh - fl], [Ww / 2, Hh - fl], [Ww / 2, Hh], [-Ww / 2, Hh], [-Ww / 2, Hh - fl], [-tw / 2, Hh - fl], [-tw / 2, fl], [-Ww / 2, fl]];
    const BFm = side ? { o: vadd(O, [0, 0, d.z / 2]), x: [0, 0, 1], y: X, z: vmul(Y, -1) } : { o: O, x: Y, y: X, z: Z };
    M.extrude(BFm, side ? prof.map(p => [p[1] - Hh / 2, p[0]]) : prof, -d.x / 2, d.x / 2, "#8e6a4b", o);
  } else if (k === "bag") {
    const col = ld.colour || "#ebe5cf", lc = ld.loopCol || "#2c6fbb", W2 = P2 => P2.map(q => { const w = P(q[0], q[1], 0); return [w[0], w[1]]; }), z0 = +pos.h || 0;
    M.prism(W2(bagOutline(d.x / 2, d.y / 2)), z0, z0 + 0.15, shade(col, 0.9), o);
    M.prism(W2(bagOutline(d.x / 2 * 1.05, d.y / 2 * 1.05)), z0 + 0.15, z0 + d.z * 0.75, col, o);
    M.prism(W2(bagOutline(d.x / 2 * 0.98, d.y / 2 * 0.98)), z0 + d.z * 0.75, z0 + d.z - 0.05, shade(col, 1.03), o);
    M.prism(W2(bagOutline(d.x / 2 * 0.8, d.y / 2 * 0.8)), z0 + d.z - 0.05, z0 + d.z, shade(col, 0.95), o);
    M.cyl(P(0, 0, d.z), P(0, 0, d.z + 0.1), Math.min(d.x, d.y) * 0.14, "#d9d2b8", { ...o, n: 12 });
    const lh = ld.loops != null && ld.loops !== "" ? +ld.loops : 0.3;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const cx = sx * d.x * 0.43, cy = sy * d.y * 0.43, r = 0.08; let prev = null; for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8, q = P(cx + r * Math.cos(a) * sx, cy - r * Math.cos(a) * sy, d.z - 0.1 + (lh + 0.1) * Math.sin(a)); if (prev) M.line(prev, q, lc, 3); prev = q; } }
  } else if (k === "frame") {
    const t = 0.2, E = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) M.box(LF, sx * d.x / 2 - (sx > 0 ? t : 0), sx * d.x / 2 + (sx < 0 ? t : 0), sy * d.y / 2 - (sy > 0 ? t : 0), sy * d.y / 2 + (sy < 0 ? t : 0), 0, d.z, "#8a9199", o);
    for (const z of [0, d.z - t]) { for (const sy of [-1, 1]) M.box(LF, -d.x / 2, d.x / 2, sy * d.y / 2 - (sy > 0 ? t : 0), sy * d.y / 2 + (sy < 0 ? t : 0), z, z + t, "#8a9199", o); for (const sx of [-1, 1]) M.box(LF, sx * d.x / 2 - (sx > 0 ? t : 0), sx * d.x / 2 + (sx < 0 ? t : 0), -d.y / 2, d.y / 2, z, z + t, "#8a9199", o); }
    M.box(LF, -d.x / 2, d.x / 2, -d.y / 2, d.y / 2, 0.02, t, "#b9c0c7", o);
  } else M.box(LF, -d.x / 2, d.x / 2, -d.y / 2, d.y / 2, 0, d.z, "#c9b28f", o);
  return { LF, P, d };
}

// ---------- scene assembly ----------
function buildMesh(phase) {
  const M = new Mesh();
  const MS = shownMatIds();
  for (const o of plan.obstacles) {
    if (o.kind === "dim" || matHidden(o, MS)) continue;
    const P2 = o.kind === "circle" ? Array.from({ length: 24 }, (_, i) => [o.x + (o.r || 1) * Math.cos(i * Math.PI / 12), o.y + (o.r || 1) * Math.sin(i * Math.PI / 12)]) : obsPts(o);
    if (typeof obj3D === "function" && obj3D(M, o, P2)) continue;
    if (o.zone) { M.prism(P2, 0, 0.03, obsColor(o), { alpha: 0.18 }); M.prism(P2, 0.03, +o.hgt || 1.1, obsColor(o), { alpha: 0.12 }); }
    else M.prism(P2, 0, +o.hgt || 3, o.color || "#9aa3ad");
    if (!isMat(o) && (!o.zone || o.label)) { const ts = txtStyleOf(o); M.label([centroid(P2)[0], centroid(P2)[1], (+o.hgt || (o.zone ? 1.1 : 3)) + 0.8], o.label || "", ts.color || (o.color || (o.zone ? "#b42318" : "#34393f")), 11 * ts.k); }
  }
  const phases = phase === "both" ? ["pick", "set"] : [phase];
  for (const ld of plan.loads) {
    if (!(phase === "both")) (M.handles = M.handles || []).push({ kind: "load", id: ld.id, p: [ld[phases[0]].x, ld[phases[0]].y, (+ld[phases[0]].h || 0) + loadDims(ld).z / 2], color: "#34393f" });
    const hooksFor = ph => plan.cranes.filter(c => c.attach?.load === ld.id && REG.cranes[c.model]).map(c => { const e = evalCrane(c, ph); return e.hook && !e.free ? [e.hook[0], e.hook[1], Math.min((+ld[ph].h || 0) + loadRigHeight(ld, e.tandem), hookMaxZ(c, e))] : null; }).filter(Boolean);
    for (const ph of phases) { load3D(M, ld, ld[ph], phase === "both" && ph === "set"); if (ld.rig?.arr && !(phase === "both" && ph === "set")) { const rr = solveRig(ld); if (rr) rig3D(M, ld, ld[ph], rr, hooksFor(ph)); } }
  }
  const ph0 = phases[0];
  for (const cr of plan.cranes) {
    const ev = evalCrane(cr, ph0); if (!ev.C) continue;
    const K = crane3D(M, cr, ev);
    (M.handles = M.handles || []).push({ kind: "crane", id: cr.id, p: [cr.x, cr.y, 1.0], color: cr.color }, { kind: "tip", id: cr.id, p: K.S, color: cr.color });
    if (!ev.hook) continue;
    // reeving: parts of line from the head sheaves down to the block, then the block and hook
    const ld = ev.load, hh = ld ? Math.min((+ld[ph0].h || 0) + loadRigHeight(ld, ev.tandem), K.S[2] - K.rH - 0.5 - K.bd.total) : Math.max(2, K.tip[2] - 8 - K.bd.total);
    const hk = [ev.hook[0], ev.hook[1], hh];
    const bsc = block3D(M, K.bd, hk, K.a, K.l);
    (M.handles = M.handles || []).push({ kind: "hook", id: cr.id, p: [hk[0], hk[1], hh + K.bd.total * 0.5], color: cr.color });
    const nsh = K.bd.sheaves, gap = 0.15, rope = "#2b2f33";
    for (let k = 0; k < K.bd.parts; k++) {
      const sh = Math.floor(k / 2), side = k % 2 ? 1 : -1, lo = (sh - (nsh - 1) / 2) * gap;
      const top = vadd(vadd(K.S, vmul(K.a, side * K.rH * 0.85)), vmul(K.l, lo));
      const bc = K.bd.type === "single" ? bsc[0] : bsc[k % 4 < 2 ? 0 : 1];
      const botPt = K.bd.type === "single" ? vadd(vadd(bc, vmul(K.a, side * K.bd.rs * 0.95)), vmul(K.l, lo)) : vadd(vadd(bc, vmul(K.a, side * K.bd.rs * 0.95)), vmul(K.l, lo * 0.6));
      M.line(top, botPt, rope, 1.05);
    }
    if (ld && !ev.free && !ld.rig?.arr) {
      const pos = ld[ph0], lpz = (+pos.h || 0) + liftPointZ(ld);
      const LP = p => { const w = liftPointWorld(ld, p, ph0); return [w[0], w[1], lpz]; };
      if (ev.tandem) M.line([hk[0], hk[1], hh], LP(cr.attach.point || "C"), "#0b7a66", 1.4);
      else if (ld.span > 0) {
        if (ld.spreader) {
          const ys = hh - (+ld.hookToSpreader || 0), A = LP("A"), B = LP("B");
          M.line([hk[0], hk[1], hh], [A[0], A[1], ys], "#0b7a66", 1.3); M.line([hk[0], hk[1], hh], [B[0], B[1], ys], "#0b7a66", 1.3);
          M.line([A[0], A[1], ys], [B[0], B[1], ys], "#0b7a66", 4);
          M.line([A[0], A[1], ys], A, "#0b7a66", 1.2); M.line([B[0], B[1], ys], B, "#0b7a66", 1.2);
        } else { M.line([hk[0], hk[1], hh], LP("A"), "#0b7a66", 1.3); M.line([hk[0], hk[1], hh], LP("B"), "#0b7a66", 1.3); }
      } else M.line([hk[0], hk[1], hh], LP("C"), "#0b7a66", 1.3);
    }
  }
  return M;
}
function viewBasis() {
  if (V3.mode === "side") {
    const az = { N: 0, E: 90, S: 180, W: 270 }[V3.dir] ?? 0, a = az * D2R;
    return { r: [Math.cos(a), -Math.sin(a), 0], u: [0, 0, 1], d: [Math.sin(a), Math.cos(a), 0] };
  }
  const a = V3.az * D2R, e = V3.el * D2R;
  return { r: [Math.cos(a), -Math.sin(a), 0], u: [-Math.sin(a) * Math.sin(e), -Math.cos(a) * Math.sin(e), Math.cos(e)].map(v => v), d: [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), -Math.sin(e)] };
}
function shade(hex, k) { const c = hexRgb(hex); return rgbHex(c.map(v => v * k)); }
function renderMeshSVG(M, W, H, opts = {}) {
  const B = viewBasis();
  // fix: 'u' must be perpendicular to d and r for the 3D view
  B.u = vcross(B.r, B.d);
  const proj = p => [vdot(p, B.r), vdot(p, B.u), vdot(p, B.d)];
  const light = vnorm([-0.45, -0.6, 0.75]);
  const items = [];
  for (const f of M.faces) {
    const q = f.pts.map(proj);
    const n = newell(f.pts);
    const facing = vdot(n, B.d);
    if (facing > 1e-6 && f.alpha >= 1 && !f.flat) continue;          // back face of a solid
    const lit = 0.58 + 0.42 * Math.max(0, vdot(n, light) * (facing > 0 ? -1 : 1));
    items.push({ z: q.reduce((a, p) => a + p[2], 0) / q.length - f.bias, pts: q, fill: shade(f.fill, lit), alpha: f.alpha, soft: f.soft });
  }
  for (const l of M.lines) { const a = proj(l.a), b = proj(l.b); items.push({ z: (a[2] + b[2]) / 2 - 0.05, line: [a, b], color: l.color, w: l.w }); }
  // ground grid extent
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const it of items) for (const p of it.pts || it.line) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (const lb of M.labels) { const p = proj(lb.p); y1 = Math.max(y1, p[1] + 1.5); }
  if (x0 > x1) { x0 = -20; x1 = 20; y0 = -5; y1 = 20; }
  items.sort((a, b) => b.z - a.z);
  const pad = opts.pad ?? 3, sw = x1 - x0 + 2 * pad, shh = y1 - y0 + 2 * pad;
  const s = Math.min(W / sw, H / shh) * V3.zoom;
  const cx = (x0 + x1) / 2 + V3.pan[0], cy = (y0 + y1) / 2 + V3.pan[1];
  if (!opts.noTrack) V3.last = { W, H, s, cx, cy };
  const X = p => (W / 2 + (p[0] - cx) * s).toFixed(1), Y = p => (H / 2 - (p[1] - cy) * s).toFixed(1);
  let g = "";
  // ground
  if (V3.mode === "side") { const gy = Y([0, 0]); g += `<rect x="0" y="${gy}" width="${W}" height="${Math.max(0, H - gy)}" fill="#e9eee8"/><line x1="0" x2="${W}" y1="${gy}" y2="${gy}" stroke="#4f7a4f" stroke-width="1.5"/>`; }
  else {
    const gs = 5, b = worldBounds(siteParts(plan.phase === "both" ? "both" : plan.phase, false).filter(p => !p.ui));
    const gx0 = Math.floor((b[0] - 10) / gs) * gs, gx1 = Math.ceil((b[2] + 10) / gs) * gs, gy0 = Math.floor((b[1] - 10) / gs) * gs, gy1 = Math.ceil((b[3] + 10) / gs) * gs;
    const corners = [[gx0, gy0, 0], [gx1, gy0, 0], [gx1, gy1, 0], [gx0, gy1, 0]].map(proj);
    const mar = typeof siteIsMarine === "function" && siteIsMarine(), gl = mar ? "#c3d7e8" : "#d6ded3";   // water round a quay / jetty
    g += `<polygon points="${corners.map(p => X(p) + "," + Y(p)).join(" ")}" fill="${mar ? "#d7e6f1" : "#eef2ec"}" stroke="${mar ? "#b3cbe0" : "#c9d3c6"}"/>`;
    for (let x = gx0; x <= gx1; x += gs) { const a = proj([x, gy0, 0]), c = proj([x, gy1, 0]); g += `<line x1="${X(a)}" y1="${Y(a)}" x2="${X(c)}" y2="${Y(c)}" stroke="${gl}" stroke-width="0.8"/>`; }
    for (let y = gy0; y <= gy1; y += gs) { const a = proj([gx0, y, 0]), c = proj([gx1, y, 0]); g += `<line x1="${X(a)}" y1="${Y(a)}" x2="${X(c)}" y2="${Y(c)}" stroke="${gl}" stroke-width="0.8"/>`; }

  }
  // the drawing / picture lies on the ground: drawn after the deck slab, before everything standing on it
  if (V3.mode !== "side" && typeof site3DUnderlay === "function") { const u = site3DUnderlay(B, s, cx, cy, W, H); if (u) { let i = items.findIndex(it => it.z < 5e4); if (i < 0) i = items.length; items.splice(i, 0, { z: 5e4, raw: u }); } }
  for (const it of items) {
    if (it.raw) { g += it.raw; continue; }
    if (it.line) g += `<line x1="${X(it.line[0])}" y1="${Y(it.line[0])}" x2="${X(it.line[1])}" y2="${Y(it.line[1])}" stroke="${it.color}" stroke-width="${it.w}" stroke-linecap="round"/>`;
    else g += `<polygon points="${it.pts.map(p => X(p) + "," + Y(p)).join(" ")}" fill="${it.fill}" fill-opacity="${it.alpha}" stroke="${it.alpha < 1 ? it.fill : shade(it.fill, 0.72)}" stroke-width="${it.soft ? 0.25 : 0.6}" stroke-linejoin="round"${it.alpha < 1 ? ' stroke-opacity="0.6"' : ""}/>`;
  }
  if (V3.mode === "side" && !opts.noTrack) for (const hd of M.handles || []) {
    const p = proj(hd.p), x = +X(p), y = +Y(p), c = hd.color || "#d9661f", at = `data-h="${hd.kind}" data-id="${hd.id}" style="cursor:grab"`;
    if (hd.kind === "hook") g += `<circle ${at} cx="${x}" cy="${y}" r="15" fill="rgba(217,102,31,.14)" stroke="${c}" stroke-width="2.5"/>`;
    else if (hd.kind === "tip") g += `<path ${at} d="M${x} ${y - 13}L${x + 13} ${y}L${x} ${y + 13}L${x - 13} ${y}Z" fill="rgba(255,255,255,.75)" stroke="${c}" stroke-width="2.5"/><text x="${x}" y="${y - 18}" font-size="10" text-anchor="middle" fill="${c}" pointer-events="none">luff</text>`;
    else if (hd.kind === "crane") g += `<rect ${at} x="${x - 13}" y="${y - 13}" width="26" height="26" rx="4" fill="rgba(255,255,255,.75)" stroke="${c}" stroke-width="2.5"/><path d="M${x - 7} ${y}H${x + 7}M${x - 7} ${y}l4 -4M${x - 7} ${y}l4 4M${x + 7} ${y}l-4 -4M${x + 7} ${y}l-4 4" stroke="${c}" stroke-width="1.6" fill="none" pointer-events="none"/>`;
    else g += `<rect ${at} x="${x - 12}" y="${y - 12}" width="24" height="24" rx="12" fill="rgba(255,255,255,.75)" stroke="#16202a" stroke-width="2" stroke-dasharray="4 3"/><path d="M${x} ${y - 7}V${y + 7}M${x - 7} ${y}H${x + 7}" stroke="#16202a" stroke-width="1.6" pointer-events="none"/>`;
  }
  for (const lb of M.labels) { if (!lb.text) continue; const p = proj(lb.p); g += `<text x="${X(p)}" y="${Y(p)}" font-size="${lb.size}" font-weight="${lb.bold ? 700 : 400}" text-anchor="middle" fill="${lb.color}" paint-order="stroke" stroke="#ffffff" stroke-width="3">${escH(lb.text)}</text>`; }
  // height scale in side view
  if (V3.mode === "side") {
    const top = Math.ceil(y1 / 5) * 5, gx = 18;
    for (let z = 0; z <= top; z += 5) { const yy = Y([0, z]); g += `<line x1="${gx}" x2="${gx + 6}" y1="${yy}" y2="${yy}" stroke="#56657a"/><text x="${gx + 9}" y="${+yy + 4}" font-size="10" fill="#56657a">${z} m</text>`; }
    g += `<line x1="${gx}" x2="${gx}" y1="${Y([0, 0])}" y2="${Y([0, top])}" stroke="#56657a"/>`;
  }
  const title = V3.mode === "side" ? `SIDE ELEVATION – looking ${({ N: "north", E: "east", S: "south", W: "west" })[V3.dir]}` : "3D VIEW";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="IBM Plex Sans, Arial, sans-serif"${opts.id ? ` id="${opts.id}"` : ""}>
    <defs><marker id="ar" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#16202a"/></marker></defs>
    <rect width="${W}" height="${H}" fill="${V3.mode === "side" ? "#f7f9fb" : "#f4f7f9"}"/>${g}
    <text x="${W - 14}" y="22" font-size="12" font-weight="700" text-anchor="end" fill="#16202a">${title} · ${plan.phase === "set" ? "SET" : "PICK"}</text></svg>`;
}
function render3D() {
  const host = $("view3d"), r = host.getBoundingClientRect();
  const M = allMode ? withAll(() => buildMesh(plan.phase)) : buildMesh(plan.phase); if (allMode) M.handles = [];
  host.innerHTML = renderMeshSVG(M, Math.max(300, r.width), Math.max(300, r.height));
}
function setViewMode(mode, dir) {
  V3.mode = mode; if (dir) V3.dir = dir;
  const top = mode === "top";
  $("site").toggleAttribute("hidden", !top); $("view3d").hidden = top;
  $("vwSideDir").hidden = mode !== "side";
  for (const [id, m] of [["vwTop", "top"], ["vwSide", "side"], ["vw3d", "3d"]]) $(id).setAttribute("aria-pressed", mode === m);
  for (const id of ["tZone", "tDim", "zIn", "zOut"]) $(id).disabled = !top;
  if (!top) { setTool(null); $("welcome").hidden = true; $("hint").textContent = mode === "3d" ? "Drag to orbit · scroll to zoom · right-drag or Shift-drag to pan · switch to Top to edit" : "Drag: ○ hook – radius & hoist · ◇ boom head – luff up/down · □ crane – move · ⊕ load – move & lift height · drag empty space to pan · scroll to zoom"; $("hint").hidden = false; V3.zoom = 1; V3.pan = [0, 0]; render3D(); }
  else renderSite();
}
function setup3DEvents() {
  const host = $("view3d"); let dr = null;
  host.addEventListener("pointerdown", e => {
    const hd = e.target.closest && e.target.closest("[data-h]");
    if (hd && V3.mode === "side" && !allMode) {
      const kind = hd.dataset.h, id = hd.dataset.id, ph = plan.phase === "set" ? "set" : "pick", B = viewBasis();
      host.setPointerCapture(e.pointerId);
      const base = { edit: kind, ph, x: e.clientX, y: e.clientY, r: B.r, s: V3.last?.s || 10 };
      if (kind === "load") { const ld = plan.loads.find(l => l.id === id); if (!ld) return; sel = { kind: "load", id, ph }; dr = { ...base, ld, p0: [ld[ph].x, ld[ph].y], z0: +ld[ph].h || 0 }; }
      else {
        const cr = plan.cranes.find(c => c.id === id); if (!cr) return; sel = { kind: "crane", id };
        const ev = evalCrane(cr, ph), ld = carrying(cr, ph), C = REG.cranes[cr.model];
        dr = { ...base, cr, C, ld, h0: ev.hook ? [...ev.hook] : [cr.x, cr.y], z0: ld ? +ld[ph].h || 0 : 0, c0: [cr.x, cr.y], th0: ev.ba?.theta || 45, brg: ev.bearing };
      }
      renderPanels();
      return;
    }
    host.setPointerCapture(e.pointerId); dr = { x: e.clientX, y: e.clientY, az: V3.az, el: V3.el, pan: [...V3.pan], panMode: V3.mode === "side" || e.shiftKey || e.button === 2 }; });
  host.addEventListener("contextmenu", e => e.preventDefault());
  host.addEventListener("pointermove", e => {
    if (!dr) return;
    const dx = e.clientX - dr.x, dy = e.clientY - dr.y;
    if (dr.edit && dr.edit !== "hook") {
      const dxm = dx / dr.s, dzm = -dy / dr.s, snap = v => e.shiftKey ? v : Math.round(v * 10) / 10;
      let info = "";
      if ((dr.edit === "load" && dr.ld.locked) || (dr.edit === "crane" && dr.cr.locked)) { if (typeof lockToast === "function") lockToast(dr.ld || dr.cr); return; }
      if (dr.edit === "load") {
        const pos = dr.ld[dr.ph]; pos.x = snap(dr.p0[0] + dr.r[0] * dxm); pos.y = snap(dr.p0[1] + dr.r[1] * dxm); pos.h = Math.max(0, snap(dr.z0 + dzm));
        plan.cranes.filter(c => c.attach?.load === dr.ld.id).forEach(c => autoBoom(c));
        info = `<b>${escH(dr.ld.name)}</b> · E ${fx(pos.x, 1)} N ${fx(pos.y, 1)} · bottom at ${fx(pos.h, 2)} m`;
      } else if (dr.edit === "crane") {
        const cr = dr.cr; cr.x = snap(dr.c0[0] + dr.r[0] * dxm); cr.y = snap(dr.c0[1] + dr.r[1] * dxm); autoBoom(cr);
        const ev = evalCrane(cr, dr.ph); info = `<b>${escH(cr.label)}</b> moved · R ${fx(ev.R, 2)} m`;
      } else if (dr.edit === "tip") {
        const cr = dr.cr, C = dr.C, L = cr.L, pz = C.boom.pivot[1];
        const z0 = pz + L * Math.sin(dr.th0 * D2R), z = z0 + dzm, th = Math.asin(Math.max(0, Math.min(1, (z - pz) / L))) / D2R;
        const thc = Math.max(0, Math.min(C.maxAngle, th)), R = Math.max(0.5, C.boom.pivot[0] + L * Math.cos(thc * D2R));
        cr.autoBoom = false; setHookRB(cr, dr.ph, Math.round(R * 100) / 100, dr.brg);
        info = `<b>${escH(cr.label)}</b> luffing · boom ${fx(L, 1)} m @ ${fx(thc, 1)}° · R ${fx(R, 2)} m`;
      }
      dr.moved = true; render3D(); scheduleSide();
      if (dr.cr) { const S = craneSummary(dr.cr); info += ` · util ${S.util != null ? fx(S.util, 1) + "%" : "–"}`; }
      dragInfo(info, e);
      return;
    }
    if (dr.edit === "hook") {
      const dxm = dx / dr.s, dzm = -dy / dr.s, snap = v => e.shiftKey ? v : Math.round(v * 10) / 10;
      moveHook(dr.cr, dr.ph, snap(dr.h0[0] + dr.r[0] * dxm), snap(dr.h0[1] + dr.r[1] * dxm));
      if (dr.ld) dr.ld[dr.ph].h = Math.max(0, snap(dr.z0 + dzm));
      dr.moved = true; autoBoom(dr.cr); render3D(); scheduleSide();
      const ev = evalCrane(dr.cr, dr.ph), S = craneSummary(dr.cr);
      dragInfo(`<b>${escH(dr.cr.label)}</b> · R ${fx(ev.R, 2)} m · boom ${fx(dr.cr.L, 1)} m @ ${fx(ev.ba?.theta, 1)}°${dr.ld ? `<br>${escH(dr.ld.name)} bottom at ${fx(dr.ld[dr.ph].h, 2)} m` : ""} · util ${S.util != null ? fx(S.util, 1) + "%" : "–"}`, e);
      return;
    }
    if (dr.panMode) { const k = 1 / (V3.last?.s || 10); V3.pan = [dr.pan[0] - dx * k, dr.pan[1] + dy * k]; }
    else { V3.az = (dr.az - dx * 0.4 + 360) % 360; V3.el = Math.max(5, Math.min(85, dr.el + dy * 0.3)); }
    render3D();
  });
  const end = () => { if (dr && dr.edit && dr.moved) { markDirty(); renderAll(); } dr = null; $("dragInfo").hidden = true; };
  host.addEventListener("pointerup", end); host.addEventListener("pointercancel", end);
  host.addEventListener("wheel", e => {
    e.preventDefault();
    const f0 = V3.zoom, f1 = Math.max(0.3, Math.min(40, V3.zoom * Math.exp(-e.deltaY * 0.0015))), Lz = V3.last;
    if (Lz) {
      const r = host.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, s1 = Lz.s * f1 / f0;
      const px = Lz.cx + (mx - Lz.W / 2) / Lz.s, py = Lz.cy - (my - Lz.H / 2) / Lz.s;
      V3.pan[0] += (px - (mx - Lz.W / 2) / s1) - Lz.cx; V3.pan[1] += (py + (my - Lz.H / 2) / s1) - Lz.cy;
    }
    V3.zoom = f1; render3D();
  }, { passive: false });
  $("vwTop").onclick = () => setViewMode("top");
  $("vwSide").onclick = () => setViewMode("side");
  $("vw3d").onclick = () => setViewMode("3d");
  $("vwSideDir").onchange = e => setViewMode("side", e.target.value);
  window.addEventListener("resize", () => { if (V3.mode !== "top") render3D(); });
}

// highest the hook (bottom of the hook) can go: under the boom head, less the block and 0.5 m anti-two-block clearance
function hookMaxZ(cr, ev) {
  const C = ev.C || REG.cranes[cr.model]; if (!C) return 1e9;
  const th = (ev.ba?.theta || 45) * D2R, pvz = C.boom.pivot[1] + (C.type === "cr" || C.type === "ped" ? 0 : DZ);
  const bd = blockDims(cr, C), rH = Math.max(0.38, Math.min(0.75, bd.rs * 1.2 + 0.12));
  return pvz + cr.L * Math.sin(th) - rH - (typeof TRAVEL_A2B !== "undefined" ? TRAVEL_A2B : 1.5) - bd.total - (C.boom.kind === "tele" ? 0.2 : 0.1);
}
