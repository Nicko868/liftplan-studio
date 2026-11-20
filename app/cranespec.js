// ================= Crane data sheet drawings – manufacturer-style line drawings with CAD dimensions =================
// Crawler cranes are drawn from their data-sheet dimensions (C.car, C.up, C.spec): side view of the basic crane with
// the boom foot and superlift ballast (boom cut with a break line), rear view, and top view on the same scale as the
// side view. Dimensions are in mm like the manufacturer's sheet, with extension lines and arrow-heads |◄────►|.
const CS_INK = "#1b1f23", CS_GREY = "#cfd2d5", CS_LIGHT = "#eceef0";
function csL(s, pts, w = 1, o = {}) { s.poly("CARRIER", pts, { w, color: o.color || CS_INK, closed: !!o.closed, fill: o.fill, dash: o.dash }); }
function csRect(s, x0, y0, x1, y1, w = 1, fill) { csL(s, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], w, { closed: true, fill }); }
function csCirc(s, c, r, w = 1, fill) { s.circle("CARRIER", c, r, { w, color: CS_INK, fill }); }
function csArc(c, r, a0, a1, n = 10) { const P = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * D2R; P.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } return P; }
// a dimension between points a and b, drawn 'off' to the left of a→b: extension lines, line with arrow-heads, value
function csDim(s, a, b, off, label, sz, o = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, u = [dx / L, dy / L], n = [-u[1], u[0]], sg = off >= 0 ? 1 : -1;
  const A = [a[0] + n[0] * off, a[1] + n[1] * off], B = [b[0] + n[0] * off, b[1] + n[1] * off], gap = Math.min(Math.abs(off), sz * 0.35);
  if (!o.noExt) { for (const [p, q] of [[a, A], [b, B]]) csL(s, [[p[0] + n[0] * sg * gap, p[1] + n[1] * sg * gap], [q[0] + n[0] * sg * sz * 0.45, q[1] + n[1] * sg * sz * 0.45]], 0.55, { color: "#3a3f45" }); }
  else for (const q of [A, B]) csL(s, [[q[0] - n[0] * sz * 0.45, q[1] - n[1] * sz * 0.45], [q[0] + n[0] * sz * 0.45, q[1] + n[1] * sz * 0.45]], 0.6, { color: "#3a3f45" });   // end bars |
  csL(s, [A, B], 0.7, { color: "#3a3f45" });
  const ah = sz * 0.85, aw = sz * 0.22;
  for (const [p, d] of [[A, 1], [B, -1]]) csL(s, [p, [p[0] + u[0] * ah * d + n[0] * aw, p[1] + u[1] * ah * d + n[1] * aw], [p[0] + u[0] * ah * d - n[0] * aw, p[1] + u[1] * ah * d - n[1] * aw]], 0.5, { closed: true, fill: "#3a3f45", color: "#3a3f45" });
  const ang = Math.atan2(u[1], u[0]) / D2R, mid = [(A[0] + B[0]) / 2 + n[0] * sg * sz * 0.75, (A[1] + B[1]) / 2 + n[1] * sg * sz * 0.75];
  s.text("DIMS", o.at || mid, label, sz, { rot: ang, color: CS_INK });
}
const mm = v => String(Math.round(v * 1000));

// ---------- crawler: side view of the basic crane (boom to the left, as on the data sheet) ----------
function csCrawlerSide(C, cr, th, sl, sz) {
  const s = new Scene(), k = C.car, u = C.up, sp = C.spec || {}, H = sp.trackH || k.trackH || 1.25, Lt = k.len, r = H / 2;
  const X = x => -x;   // front of the crane (boom) to the left
  const P = (x, y) => [X(x), y];
  const Hs = u.baseH || 1.95, top = (sp.base && sp.base.h) || 3.26, tail = u.tail || 8, cwD = u.cwD || 2.4, cwZ = sp.cwZ || [Hs + 0.5, Hs + 0.5 + (u.cwH || 3)];
  const pv = C.boom.pivot, pz = sp.pivotZ || pv[1];
  // ground
  csL(s, [P(Lt / 2 + 5, 0), P(-(sl ? sl.R + 4 : tail + 3), 0)], 1.3);
  // track: a stadium with sprocket / idler, rollers and the track plates
  const cx = Lt / 2 - r, stad = rr => [...csArc([cx, r], rr, -90, 90, 14), ...csArc([-cx, r], rr, 90, 270, 14)].map(p => [X(p[0]), p[1]]);
  csL(s, stad(r), 1.4, { closed: true, fill: CS_GREY });
  csL(s, stad(r - 0.13), 0.6, { closed: true, fill: "#dfe2e5" });
  for (const x of [cx, -cx]) { csCirc(s, P(x, r), r * 0.62, 0.9, "#f4f5f6"); csCirc(s, P(x, r), r * 0.22, 0.7); }
  const nR = Math.max(6, Math.round((2 * cx - 2 * r) / 0.75)); for (let i = 0; i <= nR; i++) { const x = -cx + r * 0.9 + (2 * cx - 1.8 * r) * i / nR; csCirc(s, P(x, 0.3), 0.12, 0.6, "#f4f5f6"); }
  for (let x = -cx; x <= cx + 1e-6; x += 0.36) { csL(s, [P(x, 0), P(x, 0.13)], 0.4); csL(s, [P(x, H - 0.13), P(x, H)], 0.4); }
  // carbody top and slew ring
  csRect(s, X(2.6), H - 0.02, X(-2.6), H + 0.12, 0.9, "#e4e6e8");
  csRect(s, X(1.75), H + 0.12, X(-1.75), Hs, 0.9, "#f2f3f4");
  // superstructure frame with the winch drums; box under the rear
  const xr = -(tail - cwD), xf = (u.deckFront || 2) + 0.55;
  csL(s, [P(xr, Hs), P(xr, top), P(0.9, top), P(xf - 0.25, top - 0.12), P(xf, pz + 0.25), P(xf - 0.2, Hs)], 1.2, { closed: true, fill: "#fbfbfb" });
  for (const x of [-0.3, -1.65, -3.0]) { csCirc(s, P(x, (Hs + top) / 2 + 0.15), 0.42, 0.9); }
  csRect(s, X(xr + 0.4), Hs - 0.55, X(xr + 2.6), Hs, 0.8, "#fbfbfb");
  // cab at the front
  const cab = (u.cab && u.cab.fwd) || [xf - 0.2, xf + 1.8], cabTop = sp.cabTop || Hs + ((u.cab && u.cab.h) || 1.9);
  csL(s, [P(cab[0], Hs + 0.05), P(cab[0], cabTop), P(cab[1] - 0.45, cabTop), P(cab[1], cabTop - 0.55), P(cab[1], Hs + 0.05)], 1.1, { closed: true, fill: "#fbfbfb" });
  csL(s, [P(cab[0] + 0.2, cabTop - 0.15), P(cab[1] - 0.5, cabTop - 0.15), P(cab[1] - 0.15, cabTop - 0.6), P(cab[1] - 0.15, Hs + 0.85), P(cab[0] + 0.2, Hs + 0.85)], 0.7, { closed: true, fill: "#e9eef3" });
  // counterweight stack (plates)
  const cw0 = -tail, cw1 = -tail + cwD; csRect(s, X(cw0), cwZ[0], X(cw1), cwZ[1], 1.2, "#f7f7f7");
  for (let i = 1; i < 8; i++) { const y = cwZ[0] + (cwZ[1] - cwZ[0]) * i / 8; csL(s, [P(cw0, y), P(cw1, y)], 0.6); csL(s, [P(cw0 + cwD * 0.45, y - 0.04), P(cw0 + cwD * 0.55, y - 0.04)], 0.6); }
  // boom foot (lattice), cut with a break line after ~10 m
  const a = [Math.cos(th * D2R), Math.sin(th * D2R)], nn = [-a[1], a[0]], D0 = C.boom.D0 || 2.4, Lc = Math.min(cr.L, 11);
  const ax = (sv, off) => [X(pv[0] + a[0] * sv + nn[0] * off), pz + a[1] * sv + nn[1] * off];
  const dep = sv => sv < 3 ? D0 * (0.35 + 0.65 * sv / 3) : D0;
  const st = []; for (let sv = 0; sv <= Lc; sv += 0.25) st.push(sv);
  csL(s, st.map(sv => ax(sv, dep(sv) / 2)), 1.3); csL(s, st.map(sv => ax(sv, -dep(sv) / 2)), 1.3);
  for (let sv = 0.6, f = 1; sv < Lc - 0.3; sv += D0 * 0.62, f = -f) csL(s, [ax(sv, f * dep(sv) / 2), ax(Math.min(Lc, sv + D0 * 0.62), -f * dep(Math.min(Lc, sv + D0 * 0.62)) / 2)], 0.6);
  { const q0 = ax(Lc, dep(Lc) / 2 + 0.4), q1 = ax(Lc, -dep(Lc) / 2 - 0.4), m = [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2], t = [q1[0] - q0[0], q1[1] - q0[1]];   // break line ~~
    csL(s, [q0, [m[0] - t[0] * 0.12 + a[0] * 0.35 * -1, m[1] - t[1] * 0.12 + a[1] * 0.35], [m[0] + t[0] * 0.12 - a[0] * 0.35 * -1, m[1] + t[1] * 0.12 - a[1] * 0.35], q1], 0.9); }
  csCirc(s, P(pv[0], pz), 0.2, 1, "#ffffff");
  // superlift ballast pallet hanging at its radius, with the pendant going up (cut)
  if (sl) { const tw = (sl.tray && sl.tray[0]) || 3.6, h0 = sl.hang || 0.5, hh = Math.min(3.2, 0.45 + Math.round((sl.T || 0) / (sl.plate || 10)) / 4 * 0.4);
    csRect(s, X(-sl.R - tw / 2), h0, X(-sl.R + tw / 2), h0 + 0.25, 1.1, "#e4e6e8");
    for (let i = 0; i < Math.max(1, Math.round(hh / 0.4)); i++) csRect(s, X(-sl.R - tw / 2 + 0.1), h0 + 0.25 + i * 0.4, X(-sl.R + tw / 2 - 0.1), h0 + 0.25 + (i + 1) * 0.4, 0.8, "#f7f7f7");
    csL(s, [P(-sl.R, h0 + 0.25 + hh), P(-sl.R, h0 + hh + 3.4)], 1.0); csL(s, [P(-sl.R - 0.3, h0 + hh + 3.4), P(-sl.R + 0.3, h0 + hh + 3.6)], 0.8);
    csL(s, [P(-tail, cwZ[0] + 0.3), P(-sl.R, h0 + 0.25 + hh * 0.5)], 0.7, { dash: [0.5, 0.3] }); }
  // centre line of rotation
  csL(s, [P(0, -0.8), P(0, Math.max(cwZ[1], top) + 4.6)], 0.6, { dash: [1.0, 0.35, 0.2, 0.35] });
  // ---- dimensions (mm)
  const yR = Math.max(cwZ[1], top) + 1.1;
  const rads = [[tail, `R ${mm(tail)}`]]; if (sp.mastR) rads.push([sp.mastR, `R ${mm(sp.mastR)}`]);
  if (sl) rads.push([sl.R, `R ${mm(sl.R)}${C.sl && C.sl.radii ? ` (${C.sl.radii.filter(v => Math.abs(v - sl.R) > 0.01).map(mm).join("/")})` : ""}`]);
  rads.sort((p, q) => p[0] - q[0]).forEach(([rv, lab], i) => csDim(s, P(0, yR + i * sz * 2.4), P(-rv, yR + i * sz * 2.4), 0, lab, sz, { noExt: true }));
  rads.forEach(([rv], i) => csL(s, [P(-rv, (rv === tail ? cwZ[1] : rv === (sl && sl.R) ? 4.5 : top) + 0.2), P(-rv, yR + i * sz * 2.4 + sz * 0.4)], 0.5, { color: "#3a3f45" }));
  const cont = +k.contact || Lt * 0.9;
  csDim(s, P(cont / 2, r), P(-cont / 2, r), -(r + sz * 1.6), mm(cont), sz);
  csDim(s, P(Lt / 2, 0), P(-Lt / 2, 0), -(sz * 3.6), `ca. ${mm(Lt)}`, sz);
  const xh = Lt / 2 + 1.0;   // heights at the front
  csDim(s, P(xh + sz * 2.2, 0), P(xh + sz * 2.2, cabTop), 0, mm(cabTop), sz, { noExt: true });
  csL(s, [P(cab[1] - 0.2, cabTop), P(xh + sz * 2.2 + sz * 0.4, cabTop)], 0.5, { color: "#3a3f45" });
  csDim(s, P(xh, 0), P(xh, pz), 0, mm(pz), sz, { noExt: true });
  csL(s, [P(pv[0], pz), P(xh + sz * 0.4, pz)], 0.5, { color: "#3a3f45" });
  const xc = -(tail + 0.9);   // counterweight heights at the rear
  csDim(s, P(xc, 0), P(xc, cwZ[0]), 0, mm(cwZ[0]), sz, { noExt: true });
  csDim(s, P(xc - sz * 2.2, 0), P(xc - sz * 2.2, cwZ[1]), 0, mm(cwZ[1]), sz, { noExt: true });
  csL(s, [P(cw0, cwZ[1]), P(xc - sz * 2.2 - sz * 0.4, cwZ[1])], 0.5, { color: "#3a3f45" }); csL(s, [P(cw0, cwZ[0]), P(xc - sz * 0.4, cwZ[0])], 0.5, { color: "#3a3f45" });
  return s;
}
// ---------- crawler: rear view ----------
function csCrawlerRear(C, sz) {
  const s = new Scene(), k = C.car, u = C.up, sp = C.spec || {}, H = sp.trackH || k.trackH || 1.25, g = k.gauge, sh = k.shoe, xi = g / 2 - sh / 2;
  const Hs = u.baseH || 1.95, top = (sp.base && sp.base.h) || 3.26, cwZ = sp.cwZ || [Hs + 0.5, Hs + 0.5 + (u.cwH || 3)], half = sp.cwHalf || (u.cwW || 6) / 2, sw = (sp.superW || u.deckW || 3) / 2, clr = sp.clear || 0.5;
  csL(s, [[-g / 2 - sh - 1.5, 0], [g / 2 + sh + 1.5, 0]], 1.3);
  for (const sx of [-1, 1]) { const x0 = sx * g / 2 - sh / 2, x1 = sx * g / 2 + sh / 2; csRect(s, x0, 0, x1, H, 1.3, CS_GREY); for (let y = 0.12; y < H - 0.05; y += 0.12) csL(s, [[x0, y], [x1, y]], 0.35); }
  csL(s, [[-xi, clr + 0.35], [-xi, H * 0.78], [-1.95, H], [1.95, H], [xi, H * 0.78], [xi, clr + 0.35], [xi - 0.35, clr], [-xi + 0.35, clr]], 1.1, { closed: true, fill: "#e4e6e8" });
  csRect(s, -1.6, H, 1.6, H + 0.1, 0.8, "#f2f3f4"); csRect(s, -1.75, H + 0.1, 1.75, Hs, 0.9, "#f2f3f4");
  csRect(s, -sw, Hs, sw, top, 1.1, "#fbfbfb"); for (const x of [-0.85, 0.35, 0.95]) csCirc(s, [x, Hs + 0.45], 0.16, 0.7);
  // counterweight stacks either side (nearest the viewer – drawn last)
  for (const sx of [-1, 1]) { const a = sx * half, b = sx * (sw + 0.06); csRect(s, Math.min(a, b), cwZ[0], Math.max(a, b), cwZ[1], 1.2, "#f7f7f7"); for (let i = 1; i < 8; i++) { const y = cwZ[0] + (cwZ[1] - cwZ[0]) * i / 8; csL(s, [[a, y], [b, y]], 0.6); } }
  csL(s, [[0, -0.6], [0, cwZ[1] + 1.2]], 0.6, { dash: [1.0, 0.35, 0.2, 0.35] });
  // dimensions
  csDim(s, [-g / 2, 0], [g / 2, 0], -(sz * 2.2), mm(g), sz);
  csDim(s, [-g / 2 - sh / 2, 0], [g / 2 + sh / 2, 0], -(sz * 4.6), `${mm(g + sh)}${sp.widthAlt ? ` (${mm(sp.widthAlt)})` : ""}`, sz);
  csDim(s, [-g / 2 - sh / 2, H], [-g / 2 + sh / 2, H], sz * 1.6, `${mm(sh)}${sp.shoeAlt ? ` (${mm(sp.shoeAlt)})` : ""}`, sz, { at: [-g / 2 - sh / 2 - sz * 3.2, H + sz * 1.6] });
  csDim(s, [g / 2 + sh / 2, 0], [g / 2 + sh / 2, H], -(sz * 2.2), mm(H), sz);
  if (sp.clear) csDim(s, [xi - 0.9, 0], [xi - 0.9, clr + 0.08], 0, mm(clr), sz * 0.9, { noExt: true });
  csDim(s, [-half, cwZ[1]], [0, cwZ[1]], sz * 1.8, mm(half), sz); csDim(s, [0, cwZ[1]], [half, cwZ[1]], sz * 1.8, mm(half), sz);
  csDim(s, [-sw, top], [sw, top], sz * 1.2, mm(sw * 2), sz * 0.9);
  return s;
}
// ---------- crawler: top view (same scale and direction as the side view) ----------
function csCrawlerTop(C, cr, sl, sz) {
  const s = new Scene(), k = C.car, u = C.up, sp = C.spec || {}, g = k.gauge, sh = k.shoe, Lt = k.len, tail = u.tail || 8, cwD = u.cwD || 2.4, half = sp.cwHalf || (u.cwW || 6) / 2, sw = (sp.superW || u.deckW || 3) / 2;
  const X = x => -x, P = (x, y) => [X(x), y], pv = C.boom.pivot;
  for (const sy of [-1, 1]) { const y0 = sy * g / 2 - sh / 2, y1 = sy * g / 2 + sh / 2; csRect(s, X(Lt / 2), y0, X(-Lt / 2), y1, 1.3, CS_GREY); for (let x = -Lt / 2 + 0.3; x < Lt / 2; x += 0.33) csL(s, [P(x, y0), P(x, y1)], 0.3); }
  csRect(s, X(1.7), -(g / 2 - sh / 2), X(-1.7), g / 2 - sh / 2, 1.0, "#e4e6e8");
  for (const sx of [-1, 1]) csL(s, [P(sx * 1.7, -(g / 2 - sh / 2)), P(sx * 2.9, -(g / 2 - sh / 2) + 0.9), P(sx * 2.9, g / 2 - sh / 2 - 0.9), P(sx * 1.7, g / 2 - sh / 2)], 0.8);
  csCirc(s, [0, 0], 1.75, 0.9);
  const xr = -(tail - cwD), xf = (u.deckFront || 2) + 0.55;
  csRect(s, X(xf), -sw, X(xr), sw, 1.2, "#fbfbfb");
  csRect(s, X(-tail), -half, X(xr), half, 1.2, "#f7f7f7"); for (let i = 1; i < 4; i++) csL(s, [P(-tail + cwD * i / 4, -half), P(-tail + cwD * i / 4, half)], 0.5);
  const cab = (u.cab && u.cab.fwd) || [xf - 0.2, xf + 1.8], lat = (u.cab && u.cab.lat) || [-sw - 1.5, -sw];
  csRect(s, X(cab[1]), lat[0], X(cab[0]), lat[1], 1.0, "#e9eef3");
  // boom foot in plan (cut)
  const W0 = C.boom.W0 || 2.6, Lc = 8;
  for (const sy of [-1, 1]) csL(s, [P(pv[0], sy * W0 * 0.32), P(pv[0] + 2.5, sy * W0 / 2), P(pv[0] + Lc, sy * W0 / 2)], 1.2);
  for (let x = pv[0] + 2.5, f = 1; x < pv[0] + Lc - 0.6; x += 1.6, f = -f) csL(s, [P(x, f * W0 / 2), P(x + 1.6, -f * W0 / 2)], 0.5);
  csL(s, [P(pv[0] + Lc, W0 / 2 + 0.4), P(pv[0] + Lc + 0.3, 0.2), P(pv[0] + Lc - 0.3, -0.2), P(pv[0] + Lc, -W0 / 2 - 0.4)], 0.9);
  // swing circle of the counterweight, superlift pallet
  s.circle("CARRIER", [0, 0], tail, { w: 0.6, color: "#3a3f45", dash: [0.6, 0.35] });
  if (sl) { const [ta, tb] = sl.tray || [3.6, 4.8]; csRect(s, X(-sl.R - ta / 2), -tb / 2, X(-sl.R + ta / 2), tb / 2, 1.0, "#e4e6e8"); csL(s, [P(-sl.R - ta / 2, 0), P(-sl.R + ta / 2, 0)], 0.5); csL(s, [P(-tail, 0), P(-sl.R + ta / 2, 0)], 0.6, { dash: [0.5, 0.3] }); }
  csL(s, [P(Lt / 2 + 1.2, 0), P(-(sl ? sl.R + 2.5 : tail + 1.5), 0)], 0.5, { dash: [1.0, 0.35, 0.2, 0.35] });
  csL(s, [[0, -g / 2 - sh - 0.8], [0, g / 2 + sh + 0.8]], 0.5, { dash: [1.0, 0.35, 0.2, 0.35] });
  // dimensions
  { const a = 242 * D2R, d = [Math.cos(a), Math.sin(a)], q = [tail * d[0], tail * d[1]], n = [-d[1], d[0]], ah = sz * 0.85, aw = sz * 0.22;
    csL(s, [[0, 0], q], 0.6, { color: "#3a3f45" });
    csL(s, [q, [q[0] - d[0] * ah + n[0] * aw, q[1] - d[1] * ah + n[1] * aw], [q[0] - d[0] * ah - n[0] * aw, q[1] - d[1] * ah - n[1] * aw]], 0.5, { closed: true, fill: "#3a3f45", color: "#3a3f45" });
    const o = [q[0] + d[0] * sz * 1.2, q[1] + d[1] * sz * 1.2]; csL(s, [q, o, [o[0] - sz * 5.2, o[1]]], 0.5, { color: "#3a3f45" });
    s.text("DIMS", [o[0] - sz * 2.6, o[1] + sz * 0.7], `R ${mm(tail)}`, sz, { color: CS_INK }); }
  csDim(s, P(Lt / 2, g / 2 + sh / 2), P(-Lt / 2, g / 2 + sh / 2), sz * 1.8, mm(Lt), sz);
  csDim(s, P(Lt / 2, -g / 2 - sh / 2), P(Lt / 2, g / 2 + sh / 2), sz * 2.0, mm(g + sh), sz);
  csDim(s, P(-tail, half), P(-tail, -half), sz * 1.6, mm(half * 2), sz);
  return s;
}
// put a drawing on the sheet at a fixed scale (k px per m), centred in its box; returns markup
function csPlace(scene, x, y, w, h, k, title, alignBottom) {
  const [x0, y0, x1, y1] = scene.bounds(), ox = x + (w - (x1 - x0) * k) / 2 - x0 * k, oy = alignBottom ? y + h - 10 + y0 * k - (y0 - y0) : y + 46 + (h - 56 - (y1 - y0) * k) / 2 + y1 * k;
  return `<text x="${x + 12}" y="${y + 30}" font-size="23" font-weight="700" fill="${CS_INK}">${escH(title)}</text>
<g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${k.toFixed(4)})">${sceneMarkup(scene, 1.5 / k)}</g>`;
}
function csFit(scene, w, h) { const [x0, y0, x1, y1] = scene.bounds(); return Math.min((w - 30) / Math.max(1, x1 - x0), (h - 70) / Math.max(1, y1 - y0)); }
