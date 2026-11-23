// upper-case a label but keep SI units lower case (t, m, mm, kg) – units are never capitalised on the sheets
function upUnits(v) { return String(v).toUpperCase().replace(/(\d)\s?(T|M|MM|KG|KN)\b/g, (_, d, u) => `${d} ${u.toLowerCase().replace("kn", "kN")}`).replace(/Ø\s?(\d+(?:[.,]\d+)?)\s?mm/gi, "Ø$1 mm"); }
// ================= CAD drawing style for the issued sheets =================
// The app keeps its softer on-screen look; the sheets are drawn like a CAD drawing:
//  · fixed line weights (ISO 128 idea): outlines 0.5 mm, rigging 0.35 mm, dimensions / leaders / hatching 0.18 mm
//  · load drawn as an outline, supports hatched, ground hatched, centre line through the CoG
//  · rigging drawn at its size: slings as bands of their width, shackles (bow, legs, pin), master links as rings,
//    the spreader with its end units, padeyes and (modular beams) section joints
//  · dimensions with extension lines and arrowheads, angles as arcs, levels as elevation marks
const CAD = {
  ink: "#111111", ink2: "#3a3f45", yel: "#f2c200", yelDk: "#6b5600",
  mm: 3508 / 420,                      // A3 sheet: px per mm
  px: mm => mm * (3508 / 420),
  lw: { out: 0.5, mid: 0.35, thin: 0.18 }
};
const cadMix = (hex, t) => { const h = String(hex || "#888").replace("#", ""); if (h.length < 6) return hex; const n = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return "#" + n.map(v => Math.round(v + (255 - v) * t).toString(16).padStart(2, "0")).join(""); };
const cadHatchDefs = (id, step) => `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${step}" height="${step}" patternTransform="rotate(45)"><rect width="${step}" height="${step}" fill="#ffffff"/><line x1="0" y1="0" x2="0" y2="${step}" stroke="#555" stroke-width="${step * 0.12}"/></pattern></defs>`;

// a 1 m modular spreader: 0.5 m end units at each padeye, sections of 3 / 2 / 1 m between (indicative make-up)
function cadModular(span) {
  const rest = span - 1.0, secs = []; let r = Math.round(rest * 1000) / 1000;
  for (const s of [3, 2, 1]) while (r >= s - 1e-6) { secs.push(s); r = Math.round((r - s) * 1000) / 1000; }
  return { end: 0.5, secs, left: r, std: Math.abs(r) < 0.005, lo: Math.floor(span), hi: Math.ceil(span) };
}
const cadIsModular = snap => /modular/i.test(snap?.name || "");

// ---- rigging drawn at size (sheet views)
function rig2DCad(s, ld, res, view, ox, oy) {
  const U = p => ox + (view === "end" ? p[1] : p[0]), Z = p => oy + p[2], d = loadDims(ld);
  const rows = res.rows.filter(r => r.name), beam = res.beam, zB = beam ? beam.a[2] : null, hb = beam ? beam.h : 0;
  // slings: a band the width of the sling (round slings colour-coded, wire / chain grey)
  for (const g of res.seg) {
    const sn = g.e?.snap, swl = +sn?.swl || 10, t = sn?.type || "sling_round";
    const wS = t === "sling_round" ? Math.min(0.32, Math.max(0.06, 0.05 + 0.0011 * swl)) : t === "sling_wire" ? Math.min(0.12, Math.max(0.02, 0.0085 * Math.sqrt(swl))) : Math.min(0.1, Math.max(0.02, 0.007 * Math.sqrt(swl)));
    const a = [U(g.a), Z(g.a)], b = [U(g.b), Z(g.b)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = [-(b[1] - a[1]) / L * wS / 2, (b[0] - a[0]) / L * wS / 2];
    if (L < 1e-4) continue;
    const fill = t === "sling_round" ? cadMix(slingColour(sn), 0.35) : t === "sling_wire" ? "#9aa1a8" : "#b4b9be";
    s.poly("RIGGING", [[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], { closed: true, fill, color: CAD.ink, _cad: "mid" });
    if (t === "sling_chain") s.poly("RIGGING", [a, b], { color: CAD.ink2, dash: [wS * 1.4, wS * 0.8], _cad: "thin" });
  }
  // spreader beam
  if (beam) {
    const x0 = Math.min(U(beam.a), U(beam.b)), x1 = Math.max(U(beam.a), U(beam.b)), bad = zB < d.z + 0.05;
    const fill = bad ? "#f3b1aa" : CAD.yel, col = CAD.ink;
    if (view === "end") {
      const cx = U([0, 0, 0]), r = hb / 2;
      s.rect("RIGGING", cx - 0.14, zB - 0.22, cx + 0.14, zB + hb + 0.22, { fill: cadMix(CAD.yel, 0.25), color: col, _cad: "mid" });   // end unit plate behind
      s.circle("RIGGING", [cx, zB + r], r, { fill, color: col, _cad: "out" });
      s.circle("RIGGING", [cx, zB + r], r * 0.78, { color: col, _cad: "thin" });
      for (const z of [zB - 0.12, zB + hb + 0.12]) s.circle("RIGGING", [cx, z], 0.05, { fill: "#ffffff", color: col, _cad: "thin" });
    } else {
      const pads = (res.pads || []).filter(p => p[3] === "low").map(p => U(p)), tops = (res.pads || []).filter(p => p[3] === "top").map(p => U(p));
      const pA = pads.length ? Math.min(...pads) : x0, pB = pads.length ? Math.max(...pads) : x1;
      const xa = Math.min(x0, pA - 0.13), xb = Math.max(x1, pB + 0.13);
      s.rect("RIGGING", xa, zB, xb, zB + hb, { fill, color: col, _cad: "out" });
      s.poly("RIGGING", [[xa, zB + hb / 2], [xb, zB + hb / 2]], { color: CAD.ink2, dash: [0.6, 0.12, 0.08, 0.12], _cad: "thin" });   // centre line
      // end units with their padeyes (top and bottom)
      for (const px of [pA, pB]) {
        const inw = px === pA ? 1 : -1, e0 = px - inw * 0.13, e1 = px + inw * 0.37;
        s.rect("RIGGING", Math.min(e0, e1), zB - 0.2, Math.max(e0, e1), zB + hb + 0.2, { fill: cadMix(CAD.yel, 0.12), color: col, _cad: "mid" });
      }
      for (const px of pads) { s.poly("RIGGING", [[px - 0.11, zB], [px - 0.07, zB - 0.2], [px + 0.07, zB - 0.2], [px + 0.11, zB]], { closed: true, fill: cadMix(CAD.yel, 0.12), color: col, _cad: "mid" }); s.circle("RIGGING", [px, zB - 0.11], 0.045, { fill: "#ffffff", color: col, _cad: "thin" }); }
      for (const px of tops) { s.poly("RIGGING", [[px - 0.11, zB + hb], [px - 0.07, zB + hb + 0.2], [px + 0.07, zB + hb + 0.2], [px + 0.11, zB + hb]], { closed: true, fill: cadMix(CAD.yel, 0.12), color: col, _cad: "mid" }); s.circle("RIGGING", [px, zB + hb + 0.11], 0.045, { fill: "#ffffff", color: col, _cad: "thin" }); }
      // section joints (flanges) for a modular beam
      if (cadIsModular(res.beam?.snap || rows.find(r => r.type === "spreader")?.entry?.snap) && pB - pA > 1.2) {
        const m = cadModular(pB - pA); let x = pA + m.end;
        const joints = [x]; for (const sc of m.secs) { x += sc; joints.push(x); }
        for (const jx of joints) if (jx < pB - 0.01) s.rect("RIGGING", jx - 0.025, zB - 0.05, jx + 0.025, zB + hb + 0.05, { fill: CAD.yelDk, color: col, _cad: "thin" });
      }
      if (bad) s.text("DIMS", [(x0 + x1) / 2, zB + hb + 0.5], "BEAM CLASHES WITH THE LOAD", 0.45, { bold: true, color: "#b42318" });
    }
  }
  // shackles at size: pin across at the padeye / lug, legs and bow towards the sling
  const shkRows = rows.filter(r => r.type === "shackle");
  const shkFor = p => { const w = r => r.where || ""; if (beam && p[2] > zB + hb - 0.02) return shkRows.find(r => /top leg/.test(w(r))) || shkRows[0];
    if (beam && p[2] > zB - 0.8) return shkRows.find(r => /bottom padeye|padeye/.test(w(r))) || shkRows[0];
    return [...shkRows].reverse().find(r => /drop|lower|leg|lug/.test(w(r))) || shkRows[shkRows.length - 1]; };
  for (const p of (res.wrap ? [] : res.shk)) {
    const r = shkFor(p), L = Math.max(0.12, +r?.len || +r?.entry?.snap?.len || 0.3), x = U(p), z = Z(p);
    // direction: towards the far end of the sling that meets this point
    let dir = [0, 1], best = 1e9;
    for (const g of res.seg) for (const [q, f] of [[g.a, g.b], [g.b, g.a]]) { const dd = Math.hypot(U(q) - x, Z(q) - z); if (dd < best && dd < L * 2.5) { best = dd; const vx = U(f) - x, vz = Z(f) - z, l = Math.hypot(vx, vz) || 1; dir = [vx / l, vz / l]; } }
    cadShackle(s, x, z, dir, L);
  }
  // master links as rings with their bar thickness
  const ml = rows.find(r => r.type === "masterlink"), mlL = Math.max(0.2, +ml?.len || 0.4);
  for (const p of res.links) { const x = U(p), z = Z(p), a = mlL * 0.28, b = mlL / 2, t = mlL * 0.11;
    const ring = (ra, rb) => Array.from({ length: 28 }, (_, i) => [x + ra * Math.cos(i / 28 * 2 * Math.PI), z + rb * Math.sin(i / 28 * 2 * Math.PI)]);
    s.poly("RIGGING", ring(a, b), { closed: true, fill: "#c9ced3", color: CAD.ink, _cad: "mid" }); s.poly("RIGGING", ring(a - t, b - t), { closed: true, fill: "#ffffff", color: CAD.ink, _cad: "thin" }); }
  return [];
}
// a bow shackle drawn at its length L: pin at (x, z) across the direction, bow out along dir
function cadShackle(s, x, z, dir, L) {
  const n = [-dir[1], dir[0]], P = (u, v) => [x + dir[0] * v + n[0] * u, z + dir[1] * v + n[1] * u];
  const w = L * 0.3, t = L * 0.11, legH = L * 0.42;
  const out = [P(-w, 0)], inn = [P(-w + t, 0)];
  out.push(P(-w, legH)); inn.push(P(-w + t, legH));
  const R = L - legH - L * 0.0, ro = w * 1.18, ri = ro - t;
  for (let i = 0; i <= 14; i++) { const a = Math.PI - Math.PI * i / 14; out.push(P(ro * Math.cos(a) * (w / ro), legH + (L - legH) * Math.sin(a))); inn.push(P((ri) * Math.cos(a) * ((w - t) / ri), legH + (L - legH - t) * Math.sin(a))); }
  out.push(P(w, 0)); inn.push(P(w - t, 0));
  s.poly("RIGGING", [...out, ...inn.reverse()], { closed: true, fill: "#c9ced3", color: CAD.ink, _cad: "mid" });
  const pr = L * 0.075;   // the pin, with its head and nut
  s.poly("RIGGING", [P(-w - L * 0.08, -pr), P(w + L * 0.1, -pr), P(w + L * 0.1, pr), P(-w - L * 0.08, pr)], { closed: true, fill: "#8d949b", color: CAD.ink, _cad: "thin" });
  s.circle("RIGGING", P(-w - L * 0.08, 0), pr * 1.5, { fill: "#8d949b", color: CAD.ink, _cad: "thin" });
}
// line weights / fills for the whole sheet view (k = sheet px per metre, lw = toSVG lw)
function cadify(s, k, lw) {
  const W = { out: CAD.px(CAD.lw.out), mid: CAD.px(CAD.lw.mid), thin: CAD.px(CAD.lw.thin) }, toW = px => px / (k * lw);
  s.items = s.items.filter(it => !(it.L === "RIGGING" && it.closed && it.w === 0.2));   // hook-block decals
  for (const it of s.items) {
    if (it.t === "text") continue;
    if (it._cad) { it.w = toW(W[it._cad]); continue; }
    if (it.L === "LOAD") { const big = it.fill === true || (it.w || 1) >= 1.1; it.color = CAD.ink; it.w = toW(big ? W.out : W.thin);
      if (it.fill === true) it.fill = "#ffffff"; else if (typeof it.fill === "string" && it.fill !== "none") it.fill = "url(#cadH)"; }
    else if (it.L === "GROUND") { it.color = CAD.ink; it.w = toW(W.out); }
    else if (it.L === "RIGGING") { it.color = it.color === BLOCK_YELLOW ? it.color : (it.fill ? CAD.ink : it.color); it.w = toW(it.fill ? W.mid : Math.max(W.thin, Math.min(W.mid, (it.w || 1) * k * lw))); }
    else it.w = toW(W.thin);
  }
}
// ground line with hatching below (sheet view, metres)
function cadGround(s, u0, u1) {
  s.poly("GROUND", [[u0, 0], [u1, 0]], { _cad: "out", color: CAD.ink });
  for (let u = u0 + 0.15; u < u1; u += 0.35) s.poly("GROUND", [[u, 0], [u - 0.25, -0.25]], { _cad: "thin", color: CAD.ink2 });
}

// ---- dimensions in sheet px
const CADD = { c: "#111111", fs: 19, ar: 16, aw: 4.5 };
const cadT = (x, y, t, o = {}) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.fs || CADD.fs}" fill="${o.c || CADD.c}" text-anchor="${o.a || "middle"}"${o.b ? ' font-weight="700"' : ""}${o.rot ? ` transform="rotate(${o.rot} ${x.toFixed(1)} ${y.toFixed(1)})"` : ""} paint-order="stroke" stroke="#fff" stroke-width="5" stroke-linejoin="round">${escH(t)}</text>`;
const cadL = (x0, y0, x1, y1, w = CAD.px(CAD.lw.thin), dash) => `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${CADD.c}" stroke-width="${w.toFixed(2)}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
function cadArrow(x, y, ux, uy) { const a = CADD.ar, w = CADD.aw, nx = -uy, ny = ux; return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} L${(x - ux * a + nx * w).toFixed(1)} ${(y - uy * a + ny * w).toFixed(1)} L${(x - ux * a - nx * w).toFixed(1)} ${(y - uy * a - ny * w).toFixed(1)}Z" fill="${CADD.c}"/>`; }
// linear dimension between two feature points, dimension line at 'at' (y for horizontal, x for vertical)
function cadDim(p0, p1, at, text, horiz = true, o = {}) {
  let g = "", gap = 6, ov = 10;
  if (horiz) { const [x0, x1] = [Math.min(p0[0], p1[0]), Math.max(p0[0], p1[0])];
    for (const p of [p0, p1]) { const s = Math.sign(at - p[1]) || 1; g += cadL(p[0], p[1] + s * gap, p[0], at + s * ov); }
    const inside = x1 - x0 > 2 * CADD.ar + 10;
    g += cadL(inside ? x0 : x0 - 40, at, inside ? x1 : x1 + 40, at) + (inside ? cadArrow(x0, at, -1, 0) + cadArrow(x1, at, 1, 0) : cadArrow(x0, at, 1, 0) + cadArrow(x1, at, -1, 0));
    g += cadT((x0 + x1) / 2 + (o.dx || 0), at - 8, text, o); }
  else { const [y0, y1] = [Math.min(p0[1], p1[1]), Math.max(p0[1], p1[1])];
    for (const p of [p0, p1]) { const s = Math.sign(at - p[0]) || 1; g += cadL(p[0] + s * gap, p[1], at + s * ov, p[1]); }
    const inside = y1 - y0 > 2 * CADD.ar + 10;
    g += cadL(at, inside ? y0 : y0 - 40, at, inside ? y1 : y1 + 40) + (inside ? cadArrow(at, y0, 0, -1) + cadArrow(at, y1, 0, 1) : cadArrow(at, y0, 0, 1) + cadArrow(at, y1, 0, -1));
    // text along the line when it fits; otherwise level, on the outer side of the dimension (away from what it measures)
    const ty = (y0 + y1) / 2, out = Math.sign(at - p0[0]) || 1;
    if (y1 - y0 > text.length * CADD.fs * 0.55 + 20) g += cadT(at - 8, ty, text, { ...o, rot: -90 });
    else if (o.fitOnly) return "";   // a dimension that only repeats the level marks is left off rather than squeezed
    else g += cadT(at + out * 10, ty + 6, text, { ...o, a: out > 0 ? "start" : "end" }); }
  return g;
}
// angle arc at (cx, cy) from angle a0 to a1 (radians, sheet y down), with arrows and the value
function cadArc(cx, cy, r, a0, a1, text) {
  const P = a => [cx + r * Math.cos(a), cy + r * Math.sin(a)], [x0, y0] = P(a0), [x1, y1] = P(a1), big = Math.abs(a1 - a0) > Math.PI ? 1 : 0, sw = a1 > a0 ? 1 : 0;
  const t0 = [-Math.sin(a0), Math.cos(a0)], t1 = [-Math.sin(a1), Math.cos(a1)], sg = a1 > a0 ? 1 : -1, am = (a0 + a1) / 2;
  return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${big} ${sw} ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${CADD.c}" stroke-width="${CAD.px(CAD.lw.thin).toFixed(2)}"/>` +
    cadArrow(x0, y0, -t0[0] * sg, -t0[1] * sg) + cadArrow(x1, y1, t1[0] * sg, t1[1] * sg) + cadT(cx + (r + 16) * Math.cos(am), cy + (r + 16) * Math.sin(am) + 6, text, { a: Math.cos(am) >= 0 ? "start" : "end" });
}
// level mark: ▽ on the extension of a level with its value and name
function cadLevel(x, y, val, name, side = "left") {
  const t = 11, xa = side === "left" ? x - 6 : x + 6;
  return `<path d="M${(xa - t).toFixed(1)} ${(y - t * 1.6).toFixed(1)} L${(xa + t).toFixed(1)} ${(y - t * 1.6).toFixed(1)} L${xa.toFixed(1)} ${y.toFixed(1)}Z" fill="none" stroke="${CADD.c}" stroke-width="1.6"/>` +
    cadT(side === "left" ? xa - t - 8 : xa + t + 8, y - 6, `${val >= 0 ? "+" : ""}${fx(val, 2)} ${name}`, { a: side === "left" ? "end" : "start", fs: 18 });
}
// centre line (dash-dot)
const cadCL = (x0, y0, x1, y1) => cadL(x0, y0, x1, y1, CAD.px(CAD.lw.thin), "34 8 6 8");

// ---- DETAIL: spreader beam make-up (sheet px). Returns svg markup.
function cadSpreaderDetail(res, x, y, w, h, label = "B") {
  const beam = res.beam, rb = res.rows.find(r => r.type === "spreader"), snap = rb?.entry?.snap; if (!beam || !rb) return "";
  const pads = (res.pads || []).filter(p => p[3] === "low").map(p => p[0]), pA = Math.min(...pads), pB = Math.max(...pads), span = pB - pA;
  if (!(span > 0.5)) return "";
  const modular = cadIsModular(snap), m = modular ? cadModular(span) : null, over = 0.13, Ltot = span + 2 * over;
  const k = Math.min((w * 0.6 - 100) / Ltot, (h - 150) / 1.6), X = u => x + 40 + (u - (pA - over)) * k, hb = Math.max(0.45, beam.h), yc = y + 70 + 0.9 * k, yT = yc - hb / 2 * k, yBm = yc + hb / 2 * k;
  let g = `<text x="${x}" y="${y + 26}" font-size="24" font-weight="700" fill="#16202a">DETAIL ${label} – SPREADER BEAM${modular ? " MAKE-UP (indicative)" : ""}</text>`;
  const st = `stroke="${CAD.ink}" stroke-width="${CAD.px(CAD.lw.out).toFixed(2)}"`, stm = `stroke="${CAD.ink}" stroke-width="${CAD.px(CAD.lw.mid).toFixed(2)}"`;
  g += `<rect x="${X(pA - over)}" y="${yT}" width="${Ltot * k}" height="${hb * k}" fill="${CAD.yel}" ${st}/>`;
  g += cadCL(X(pA - over) - 20, yc, X(pB + over) + 20, yc);
  for (const px of [pA, pB]) { const inw = px === pA ? 1 : -1, e0 = X(px - inw * over), e1 = X(px + inw * 0.37);
    g += `<rect x="${Math.min(e0, e1)}" y="${yT - 0.2 * k}" width="${Math.abs(e1 - e0)}" height="${(hb + 0.4) * k}" fill="${cadMix(CAD.yel, 0.12)}" ${stm}/>`;
    for (const yy of [yT - 0.11 * k, yBm + 0.11 * k]) g += `<circle cx="${X(px)}" cy="${yy}" r="${Math.max(4, 0.045 * k)}" fill="#fff" ${stm}/>`; }
  let joints = [];
  if (modular) { let u = pA + m.end; joints.push(u); for (const sc of m.secs) { u += sc; joints.push(u); }
    joints = joints.filter(j => j < pB - 0.01);
    for (const j of joints) g += `<rect x="${X(j) - 3}" y="${yT - 6}" width="6" height="${hb * k + 12}" fill="${CAD.yelDk}" stroke="${CAD.ink}" stroke-width="1"/>`; }
  // dimensions: chain of the make-up below, pin-to-pin span and overall length above
  const yD1 = yBm + 0.2 * k + 46, yD2 = yD1 + 52, yU = yT - 0.2 * k - 40;
  if (modular) { const marks = [pA, ...joints, pB]; for (let i = 1; i < marks.length; i++) { const last = i === marks.length - 1, v = Math.round((marks[i] - marks[i - 1]) * 1000), odd = last && !m.std; g += cadDim([X(marks[i - 1]), yBm + 0.2 * k], [X(marks[i]), yBm + 0.2 * k], yD1, odd ? `${v} *` : String(v), true, { fs: 17, c: odd ? "#b42318" : undefined }); } }
  g += cadDim([X(pA), yBm + 0.2 * k], [X(pB), yBm + 0.2 * k], modular ? yD2 : yD1, `${Math.round(span * 1000)} padeye to padeye`, true, { fs: 18 });
  g += cadDim([X(pA - over), yT - 0.2 * k], [X(pB + over), yT - 0.2 * k], yU, `~${Math.round(Ltot * 1000)} overall`, true, { fs: 18 });
  const notes = [`${rb.name} · rated ${fmtT(rb.swl)} t · dimensions in mm`];
  if (modular) notes.push(m.std ? `Make-up: 2 end units ${m.end * 1000} + sections ${m.secs.map(s => s * 1000).join(" + ")} = ${Math.round(span * 1000)} – indicative for a 1 m modular system; confirm with the supplier's drawing.`
    : `* ${fx(span, 2)} m is not a whole-metre make-up for a 1 m modular system – nearest ${fx(m.lo, 2)} m or ${fx(m.hi, 2)} m (the drops then lean in / out). Confirm with the supplier.`);
  const nx = x + w * 0.62, nw = w * 0.38; let ny = y + 70;
  notes.forEach((t, i) => { for (const ln of wrapLines(t, Math.floor(nw / 10))) { g += `<text x="${nx}" y="${ny}" font-size="18" fill="${!modular || m.std || i === 0 ? "#3d4a57" : "#b42318"}">${escH(ln)}</text>`; ny += 24; } ny += 6; });
  return g;
}

// ---- the crane hook block drawn as a CAD part (sheets): side plates, hidden sheaves with their pin, the rope falls
// entering the top, the crosshead and a solid hook profile (ramshorn: both horns). view "end" = seen edge-on.
function cadTube(pts) {   // centre line [x, y, r] → closed outline of the solid section
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) { const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, n = [-ty / l, tx / l];
    L.push([p[0] + n[0] * p[2], p[1] + n[1] * p[2]]); R.push([p[0] - n[0] * p[2], p[1] - n[1] * p[2]]); }
  return [...L, ...R.reverse()];
}
// The standard crane block (manufacturer general-arrangement layout), sized from the block's own data:
//  view "side" (across the sheaves): sheave guard on top · sheaves side by side on one shaft · side plates · crosshead
//    (trunnion) between the plates with the thrust bearing and hook nut on it · shank · hook (ramshorn: two horns) with latches
//  view "end" (on a side plate): round sheave guard · plate tapering down to the crosshead · bolted end caps on the sheave
//    shaft and the crosshead · hook seen edge-on
function cadBlock2D(s, bd, x, y, view = "side", yTop = null) {
  const ink = CAD.ink, steel = "#c3c8cd", plate = cadMix(BLOCK_YELLOW, 0.1), H = bd.H, z0 = y + bd.hookLen, z1 = z0 + H;
  const nS = Math.max(1, bd.sheaves), hc = H * 0.16, gap = Math.max(0.03, H * 0.035);
  const rs = Math.min(bd.rs, (H - hc - 2 * gap) / 2 - H * 0.02), zc = z1 - gap - rs, rG = rs + gap;
  const tp = Math.max(0.03, bd.W * 0.035);                                     // side plate thickness
  const Wst = Math.max(0.3, view === "end" ? 2 * rG : Math.max(bd.T, nS * 0.08 + 2 * tp)), ts = (Wst - 2 * tp) / nS;
  const P = (pts, o) => s.poly("RIGGING", pts.map(p => [x + p[0], p[1]]), o), R = (a, b, c, d, o) => s.rect("RIGGING", x + a, b, x + c, d, o);
  const curves = hookCurves(bd).map(c => c.map(p => [p[0], p[1] + y, p[2]]));
  if (view === "end") {
    // falls: the two sides of the sheaves
    if (yTop != null) for (const sx of [-1, 1]) for (let i = 0; i < Math.min(3, Math.ceil(bd.parts / 2)); i++) { const xo = sx * (rs - i * 0.012); P([[xo, yTop], [xo, zc + Math.sqrt(Math.max(0, rG * rG - xo * xo))]], { color: "#2b2f33", _cad: "thin" }); }
    const wb = Math.max(rG * 0.9, 0.25), zb = z0;                              // plate: round guard on top, straight taper to the crosshead
    const t0 = Math.asin(Math.min(0.99, (rG - wb / 2) / Math.max(0.01, zc - zb - hc * 0.3))), Pp = [];
    for (let i = 0; i <= 24; i++) { const a = Math.PI + t0 - (Math.PI + 2 * t0) * i / 24; Pp.push([rG * Math.cos(a), zc + rG * Math.sin(a)]); }
    Pp.push([wb / 2, zb + hc * 1.6], [wb / 2, zb], [-wb / 2, zb], [-wb / 2, zb + hc * 1.6]);
    P(Pp, { closed: true, fill: plate, color: ink, _cad: "out" });
    s.circle("RIGGING", [x, zc], rs, { color: ink, dash: [0.06, 0.035], _cad: "thin" });   // sheave behind the plate
    const cap = (cz, w) => { R(-w / 2, cz - w / 2, w / 2, cz + w / 2, { fill: steel, color: ink, _cad: "mid" }); for (const [bx, bz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) s.circle("RIGGING", [x + bx * w * 0.32, cz + bz * w * 0.32], w * 0.06, { fill: "#ffffff", color: ink, _cad: "thin" }); s.circle("RIGGING", [x, cz], w * 0.16, { fill: "#ffffff", color: ink, _cad: "thin" }); };
    cap(zc, Math.min(rs * 0.8, wb * 0.8)); cap(zb + hc * 0.8, Math.min(hc * 1.4, wb * 0.8));
    // hook edge-on: shank, then the horn thickness tapering to the point
    const c0 = curves[0], tr = c0[0][2], zs = bd.type === "single" ? c0[1][1] : c0[c0.length - 1][1];
    R(-tr * 0.8, zs, tr * 0.8, z0, { fill: steel, color: ink, _cad: "mid" });
    P([[-tr * 1.15, zs], [tr * 1.15, zs], [tr * 0.75, y - tr * 0.2], [0, y - tr * 1.6], [-tr * 0.75, y - tr * 0.2]], { closed: true, fill: steel, color: ink, _cad: "mid" });
    s.poly("DIMS", [[x, z1 + 0.1], [x, y - tr * 2]], { color: ink, dash: [0.12, 0.04, 0.02, 0.04], _cad: "thin" });
    return;
  }
  const xL = -Wst / 2, xR = Wst / 2;
  // falls: into the sheave grooves (one sheave carries two parts)
  if (yTop != null) { const n = bd.parts; for (let i = 0; i < n; i++) { const k = Math.min(nS - 1, Math.floor(i / 2)), xo = xL + tp + ts * (k + 0.5) + (i % 2 ? ts * 0.12 : -ts * 0.12); P([[xo, yTop], [xo, z1]], { color: "#2b2f33", _cad: "thin" }); } }
  // sheave guard (cover) over the top
  P([[xL - 0.01, z1 - gap * 0.4], [xL - 0.01, z1], [xR + 0.01, z1], [xR + 0.01, z1 - gap * 0.4]], { color: ink, _cad: "mid" });
  // sheaves in section: each with its rope groove top and bottom
  for (let k = 0; k < nS; k++) { const a = xL + tp + ts * k, b = a + ts, m = (a + b) / 2, gw = ts * 0.32, gd = Math.min(ts * 0.45, rs * 0.12);
    P([[a, zc - rs], [m - gw, zc - rs], [m, zc - rs + gd], [m + gw, zc - rs], [b, zc - rs], [b, zc + rs], [m + gw, zc + rs], [m, zc + rs - gd], [m - gw, zc + rs], [a, zc + rs]], { closed: true, fill: "#e9ecef", color: ink, _cad: "thin" }); }
  // sheave shaft through all sheaves and both plates, with its end caps
  const rsh = Math.max(0.03, rs * 0.16);
  R(xL - 0.05, zc - rsh, xR + 0.05, zc + rsh, { fill: steel, color: ink, _cad: "mid" });
  // side plates from the guard down past the crosshead
  // side plates: full width round the sheaves, stepping in to the crosshead below (as on the GA)
  const zSt = zc - rs - gap, wl = Math.min(Wst, Math.max(Wst * 0.42, 0.5 * (bd.hookLen * 0.27) * 6)), lL = -wl / 2, lR = wl / 2;
  for (const [a, b] of [[xL, xL + tp], [xR - tp, xR]]) R(a, zSt, b, z1 - gap * 0.4, { fill: plate, color: ink, _cad: "out" });
  P([[xL, zSt], [lL, zSt - gap * 1.5]], { color: ink, _cad: "out" }); P([[xR, zSt], [lR, zSt - gap * 1.5]], { color: ink, _cad: "out" });
  P([[xL + tp, zSt], [lL + tp, zSt - gap * 1.5]], { color: ink, _cad: "thin" }); P([[xR - tp, zSt], [lR - tp, zSt - gap * 1.5]], { color: ink, _cad: "thin" });
  for (const [a, b] of [[lL, lL + tp], [lR - tp, lR]]) R(a, z0, b, zSt - gap * 1.5, { fill: plate, color: ink, _cad: "out" });
  // crosshead (trunnion) between the lower plates, with the trunnion ends outside the plates
  R(lL + tp, z0 + hc * 0.15, lR - tp, z0 + hc, { fill: "url(#cadH)", color: ink, _cad: "mid" });
  for (const sx of [-1, 1]) R(sx > 0 ? lR : lL - 0.05, z0 + hc * 0.25, sx > 0 ? lR + 0.05 : lL, z0 + hc * 0.9, { fill: steel, color: ink, _cad: "thin" });
  // thrust bearing and hook nut on top of the crosshead
  const c0 = curves[0], tr = c0[0][2], nw = Math.min(wl * 0.7, tr * 3.2), nh = hc * 0.55;
  R(-nw * 0.55, z0 + hc, nw * 0.55, z0 + hc + nh * 0.3, { fill: steel, color: ink, _cad: "thin" });
  R(-nw / 2, z0 + hc + nh * 0.3, nw / 2, z0 + hc + nh, { fill: "url(#cadH)", color: ink, _cad: "mid" });
  // shank and hook (solid profile) with the safety latches
  R(-tr * 0.85, bd.type === "single" ? c0[1][1] : c0[c0.length - 1][1], tr * 0.85, z0 + hc * 0.15, { fill: steel, color: ink, _cad: "mid" });
  for (const c of curves.slice(1).length ? curves.slice(1) : curves) P(cadTube(c), { closed: true, fill: steel, color: ink, _cad: "mid" });
  for (const c of (bd.type === "single" ? curves : curves.slice(1))) { const tip = c[c.length - 1], st = bd.type === "single" ? (c[2] || c[0]) : c[0];
    P([[st[0] + (tip[0] - st[0]) * 0.1, st[1] + tr * 0.4], [tip[0], tip[1] + tip[2] * 0.9]], { color: ink, _cad: "mid" }); }
  s.poly("DIMS", [[x, z1 + 0.1], [x, y - 0.15]], { color: ink, dash: [0.12, 0.04, 0.02, 0.04], _cad: "thin" });   // centre line
}

// ---- monochrome CAD rendering of a whole drawing (crane data sheet views): black lines in three weights,
// white / light grey parts, counterweight and ballast hatched, text in black. Works on a copy of the scene.
function cadMono(scene) {
  const out = new Scene(); out.items = scene.items.map(it => ({ ...it }));
  const Wpx = { out: 1.4, mid: 1.0, thin: 0.55 };   // × 1.9 px in ssScene: three line weights for a small-scale view
  const tmax = Math.max(0, ...out.items.filter(i => i.t === "text").map(i => +i.size || 0));
  out.items = out.items.filter(i => i.t !== "text" || (+i.size || 0) >= tmax * 0.4);   // no unreadable micro-labels
  for (const it of out.items) {
    if (it.t === "text") { it.color = CAD.ink; continue; }
    const w = it._cad ? Wpx[it._cad] : (it.w || 1) >= 1.3 ? Wpx.out : (it.w || 1) >= 0.8 ? Wpx.mid : Wpx.thin;
    if (it.L === "DIMS" || it.L === "REF" || it.L === "RADIUS") { it.color = CAD.ink; it.w = Wpx.thin; if (it.fill && it.fill !== "none" && it.t !== "poly") it.fill = CAD.ink; continue; }
    it.color = it.L === "GROUND" && it._cad === "thin" ? CAD.ink2 : CAD.ink; it.w = w;
    if (it.fill && it.fill !== "none") it.fill = it.L === "COUNTERWEIGHT" ? "url(#cadHs)" : it.L === "TRACKS" || it.L === "TYRES" ? "#d9dcdf" : it.L === "MATS" ? "url(#cadHs)" : "#ffffff";
  }
  return out;
}

// ---- centre of gravity mark (ISO 780 handling mark): a cross through a broken circle, with "CoG" beside it (sheet px)
function cadCoG(x, y, r = 16, label = "CoG") {
  const arc = (a0, a1) => { const p = a => [x + r * Math.cos(a), y + r * Math.sin(a)], [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  const g = Math.PI / 9, q = Math.PI / 2;   // gaps where the cross passes through the circle
  const d = [0, 1, 2, 3].map(k => arc(k * q + g, (k + 1) * q - g)).join(" ");
  return `<g><path d="${d}" fill="none" stroke="#111" stroke-width="${(r * 0.36).toFixed(1)}"/><line x1="${(x - r * 1.75).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + r * 1.75).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#111" stroke-width="${(r * 0.3).toFixed(1)}"/><line x1="${x.toFixed(1)}" y1="${(y - r * 1.9).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + r * 1.9).toFixed(1)}" stroke="#111" stroke-width="${(r * 0.3).toFixed(1)}"/>` +
    (label ? `<text x="${(x + r * 2.1).toFixed(1)}" y="${(y - r * 0.6).toFixed(1)}" font-size="19" font-weight="700" fill="#111" paint-order="stroke" stroke="#fff" stroke-width="5">${label}</text>` : "") + `</g>`;
}

// ---- DETAIL: lifting lug on the load (from the vendor's drawing), with the shackle that goes on it (sheet px)
function cadLugDetail(ld, res, x, y, w, h, label = "B") {
  const H = +ld.lugH || 0.3, Wl = +ld.lugW || 0.6, R = +ld.lugR || 0.06, D = +ld.lugHole || 0.1, Zh = +ld.lugHoleZ || H / 2, T = +ld.lugThk || 0.04, Pd = +ld.lugPad || Wl * 1.25;
  const ink = "#111", st = (wd) => `stroke="${ink}" stroke-width="${CAD.px(wd).toFixed(2)}"`, mm = v => fx(v * 1000, 0);
  let g = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#16202a" stroke-width="2" stroke-dasharray="14 8"/><text x="${x + 14}" y="${y + 34}" font-size="24" font-weight="700" fill="#16202a">DETAIL ${label} – LIFTING LUG</text>`;
  // elevation of the lug on its pad
  const ew = w * 0.64, k = (ew - 70) / Pd, ox = x + 40, base = y + 120 + H * k + 30, X = u => ox + (u + Pd / 2) * k, Y = v => base - v * k;
  g += `<rect x="${X(-Pd / 2)}" y="${Y(0)}" width="${Pd * k}" height="${Math.max(6, 0.03 * k)}" fill="#e9ecef" ${st(CAD.lw.mid)}/>`;   // pad
  const P = [[-Wl / 2, 0], [-Wl / 2, H - R]]; for (let i = 0; i <= 8; i++) { const a = Math.PI - Math.PI / 2 * i / 8; P.push([-Wl / 2 + R + R * Math.cos(a), H - R + R * Math.sin(a)]); }
  for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 - Math.PI / 2 * i / 8; P.push([Wl / 2 - R + R * Math.cos(a), H - R + R * Math.sin(a)]); } P.push([Wl / 2, 0]);
  g += `<path d="M${P.map(p => `${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(" L")}Z" fill="${cadMix(CAD.yel, 0.55)}" ${st(CAD.lw.out)}/>`;
  g += `<circle cx="${X(0)}" cy="${Y(Zh)}" r="${D / 2 * k}" fill="#fff" ${st(CAD.lw.mid)}/>` + cadCL(X(0) - D * k, Y(Zh), X(0) + D * k, Y(Zh)) + cadCL(X(0), Y(Zh) + D * k, X(0), Y(Zh) - D * k);
  g += cadDim([X(-Wl / 2), Y(0)], [X(Wl / 2), Y(0)], Y(0) + 46, mm(Wl), true, { fs: 17 });
  g += cadDim([X(-Pd / 2), Y(0)], [X(Pd / 2), Y(0)], Y(0) + 88, `${mm(Pd)} pad`, true, { fs: 17 });
  g += cadDim([X(Wl / 2), Y(0)], [X(Wl / 2), Y(H)], X(Wl / 2) + 34, mm(H), false, { fs: 17 });
  g += cadDim([X(-Wl / 2), Y(0)], [X(-Wl / 2), Y(Zh)], X(-Wl / 2) - 30, mm(Zh), false, { fs: 17 });
  g += cadT(X(0) + D / 2 * k + 8, Y(Zh) - D / 2 * k - 10, `Ø${mm(D)} hole`, { a: "start", fs: 17 });
  // side view: the plate thickness
  const sx = x + w * 0.8, sw = T * k;
  g += `<rect x="${sx - sw / 2}" y="${Y(H)}" width="${sw}" height="${H * k}" fill="${cadMix(CAD.yel, 0.55)}" ${st(CAD.lw.out)}/><rect x="${sx - 0.16 * k}" y="${Y(0)}" width="${0.32 * k}" height="${Math.max(6, 0.03 * k)}" fill="#e9ecef" ${st(CAD.lw.mid)}/>`;
  g += cadDim([sx - sw / 2, Y(H)], [sx + sw / 2, Y(H)], Y(H) - 30, `${mm(T)} thk`, true, { fs: 17 });
  g += `<text x="${sx}" y="${y + 70}" font-size="17" fill="#3d4a57" text-anchor="middle">SIDE</text><text x="${X(0)}" y="${y + 70}" font-size="17" fill="#3d4a57" text-anchor="middle">ELEVATION</text>`;
  // notes under the box
  const rn = res.rows.filter(r => r.name), iL = rn.map(r => !!RIG_TYPES[r.type]?.sling).lastIndexOf(true), shk = rn.slice(iL + 1).find(r => r.type === "shackle");
  const n = +ld.nLP || (res.lpPts || []).length || 4, LP = res.lpPts || [], ys = LP.map(q => q[1]), across = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
  const lines = [`${n} lugs${+ld.lugAng ? ` at ${fx(+ld.lugAng, 0)}° / ${fx(360 - +ld.lugAng, 0)}° from the top` : ""}${across > 0.1 ? ` · ${ld.approx?.spanY ? "~" : ""}${fx(across, 2)} m apart across` : ""}${+ld.span > 0 ? ` · ${ld.approx?.span ? "~" : ""}${fx(+ld.span, 2)} m apart along${ld.approx?.span ? " (vendor to confirm)" : ""}` : ""} · dimensions in mm, from the ${ld.src || "vendor drawing"}`,
    shk ? `(${shk.no}) ${shk.name} on each lug – pin to suit the Ø${mm(D)} hole; spacers if its jaw is much wider than the ${mm(T)} mm plate` : `Shackle on each lug – pin to suit the Ø${mm(D)} hole`,
    "Lug capacity: per the vendor – not part of this rigging check"];
  let ly = y + h + 30; for (const t of lines) { for (const l of wrapLines(t, Math.floor((w - 24) / 10))) { g += `<text x="${x + 14}" y="${ly}" font-size="19" fill="#16202a">${escH(l)}</text>`; ly += 24; } ly += 4; }
  return g;
}
