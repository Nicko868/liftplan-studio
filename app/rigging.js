// ===== Hook blocks and reeving (parts of line), shared by the 2D elevation and the 3D view
const BLOCK_TYPES = { single: "Single hook block", ramshorn: "Ramshorn (double hook) block" };
function blockCapOf(cr, C) {
  if (+cr.blockCap > 0) return +cr.blockCap;
  const hb = (C?.hookblocks || []).find(h => Math.abs(h[1] - cr.hookBlock) < 1e-6);
  return hb ? hb[0] : Math.max(10, (+cr.hookBlock || 1) * 55);
}
function defaultParts(cap) { return Math.max(1, Math.min(16, Math.round(cap / 12.5))); }
// block geometry (m): H body height, W width in the rope plane, T thickness across, hookLen below the body
function blockDims(cr, C) {
  const cap = blockCapOf(cr, C);
  const type = cr.blockType || (cap >= 100 ? "ramshorn" : "single");
  // lines / units from the crane's own hook block table when it gives them (e.g. CC 2800-1: 400 t = double block 2 × 200 t, 2 × 14 lines)
  const hbE = (C?.hookblocks || []).find(h => Math.abs(h[1] - cr.hookBlock) < 1e-6 && h[0] === cap) || (C?.hookblocks || []).find(h => h[0] === cap), twin = hbE && +hbE[3] === 2;
  const parts = Math.max(1, Math.round(!cr.partsSet && hbE && +hbE[2] > 0 ? +hbE[2] : +cr.parts || defaultParts(cap)));
  const sheaves = Math.max(1, Math.ceil(parts / 2));
  const H = Math.max(0.55, Math.min(3.0, 0.5 + 0.0075 * cap));
  const W = type === "single" ? H * 0.62 : H * 1.0;
  const T = Math.max(0.28, sheaves * 0.15 + (type === "ramshorn" ? 0.3 : 0.14));
  const hookLen = type === "single" ? 0.3 + 0.42 * H : 0.28 + 0.38 * H;
  const rs = W * (type === "single" ? 0.36 : 0.22);
  return { cap, type, parts, sheaves, H, W, T, hookLen, rs, total: H + hookLen, twin, lines: hbE && +hbE[2] > 0 ? +hbE[2] : null };
}
// outlines in the rope plane: a = horizontal (along boom), z = up; z = 0 at the hook seat
function blockPlate(bd) {
  const z0 = bd.hookLen, z1 = bd.hookLen + bd.H, W = bd.W, H = bd.H, ch = W * 0.22;
  if (bd.type === "single") return [[-W / 2 + ch, z1], [W / 2 - ch, z1], [W / 2, z1 - ch], [W / 2, z1 - H * 0.52], [W * 0.2, z0], [-W * 0.2, z0], [-W / 2, z1 - H * 0.52], [-W / 2, z1 - ch]];
  return [[-W / 2 + W * 0.14, z1], [W / 2 - W * 0.14, z1], [W / 2, z1 - H * 0.16], [W * 0.17, z0], [-W * 0.17, z0], [-W / 2, z1 - H * 0.16]];
}
function sheaveCentres(bd) {  // [a, z] of the sheave groups in the block
  const zc = bd.hookLen + bd.H - (bd.type === "single" ? bd.W * 0.42 : bd.H * 0.3);
  return bd.type === "single" ? [[0, zc]] : [[-bd.W * 0.24, zc], [bd.W * 0.24, zc]];
}
// hook centre-line(s) with tube radius at each point
function hookCurves(bd) {
  const L = bd.hookLen, out = [];
  if (bd.type === "single") {
    const rh = Math.max(0.12, L * 0.3), tr = rh * 0.42, c = [rh * 0.15, rh + tr];
    const pts = [[0, L, tr * 0.9], [0, L - tr * 1.2, tr * 0.9], [c[0] - rh, c[1] + rh * 0.9, tr]];
    for (let a = 180; a <= 385; a += 15) pts.push([c[0] + rh * Math.cos(a * D2R), c[1] + rh * Math.sin(a * D2R), tr * (1 - 0.55 * (a - 180) / 205)]);
    out.push(pts);
  } else {
    const rh = Math.max(0.12, L * 0.27), tr = rh * 0.45;
    out.push([[0, L, tr], [0, rh * 1.05 + tr, tr * 1.15]]);
    for (const sx of [-1, 1]) {
      const pts = [[0, rh + tr, tr * 1.1]];
      for (let a = 180; a <= 400; a += 15) pts.push([sx * (rh + rh * Math.cos(a * D2R)), rh + tr + rh * Math.sin(a * D2R), tr * (1 - 0.6 * (a - 180) / 220)]);
      out.push(pts);
    }
  }
  return out;
}
// clip a convex polygon by the half plane n·p <= d
function clipHalf(P, n, d) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], da = n[0] * a[0] + n[1] * a[1] - d, db = n[0] * b[0] + n[1] * b[1] - d;
    if (da <= 0) out.push(a);
    if ((da < 0) !== (db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
// hazard stripes (single block) or chevrons (ramshorn) inside the plate outline
function plateDecals(bd) {
  const P = blockPlate(bd), out = [];
  if (bd.type === "single") {
    const sw = bd.W * 0.34, n = [Math.SQRT1_2, Math.SQRT1_2];
    const us = P.map(p => (p[0] + p[1]) * Math.SQRT1_2), u0 = Math.min(...us), u1 = Math.max(...us);
    for (let u = Math.floor(u0 / sw) * sw; u < u1; u += sw) {
      let q = clipHalf(P, n, u + sw / 2); q = clipHalf(q, [-n[0], -n[1]], -u);
      if (q.length >= 3) out.push({ pts: q, color: "#1d1f21" });
    }
  } else {
    const zc = bd.hookLen + bd.H * 0.45, w = bd.W * 0.1, h = bd.H * 0.28, t = bd.W * 0.035;
    for (const ax of [-bd.W * 0.24, bd.W * 0.24]) out.push({ pts: [[ax - w, zc + h / 2], [ax - w + t * 1.4, zc + h / 2], [ax, zc - h / 2 + t * 2.2], [ax + w - t * 1.4, zc + h / 2], [ax + w, zc + h / 2], [ax, zc - h / 2]], color: "#2a2c2e", concave: true });
  }
  return out;
}
const BLOCK_YELLOW = "#f2c200", HOOK_STEEL = "#7d858c", HOOK_DARK = "#3a3e42";

// ---- 2D (elevation) drawing: block with its hook seat at (x, y)
function block2D(s, bd, x, y) {
  const P = blockPlate(bd).map(p => [x + p[0], y + p[1]]);
  s.poly("RIGGING", P, { closed: true, fill: BLOCK_YELLOW, w: 1.1, color: "#5a4a00" });
  for (const d of plateDecals(bd)) s.poly("RIGGING", d.pts.map(p => [x + p[0], y + p[1]]), { closed: true, fill: d.color, w: 0.2, color: d.color });
  for (const [a, z] of sheaveCentres(bd)) { s.circle("RIGGING", [x + a, y + z], bd.rs, { w: 0.6, color: "#5a4a00" }); s.circle("RIGGING", [x + a, y + z], bd.rs * 0.25, { fill: "#ffffff", w: 0.6, color: "#5a4a00" }); }
  for (const c of hookCurves(bd)) s.poly("RIGGING", c.map(p => [x + p[0], y + p[1]]), { w: Math.max(2.5, c[0][2] * 34), color: bd.type === "single" ? HOOK_STEEL : HOOK_DARK });
}
// boom-head sheaves (2D): centre at (x, y)
function head2D(s, bd, x, y, thDeg, paintStroke, paintFill) {
  const r = Math.max(0.3, bd.rs * 1.15), a = thDeg * D2R;
  const d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]];
  const q = (u, v) => [x + d[0] * u + n[0] * v, y + d[1] * u + n[1] * v];
  // head cheek plates end at the sheave pin: the sheave sits at the very end of the boom and hangs out in front/below,
  // so the falls drop clear of the head (as on the real crane – no bracket sticking out past the sheave)
  s.poly("BOOM", [q(-1.7, 0.95), q(-0.45, 0.95), q(0.05, r * 0.55), q(0.05, -r * 0.35), q(-0.55, -r * 0.6), q(-1.7, -0.1)], { closed: true, fill: paintFill || "#dfe6ee", w: 1.1, color: paintStroke });
  s.circle("RIGGING", [x, y], r, { fill: "#e9ecef", w: 1, color: "#3b4148" });
  s.circle("RIGGING", [x, y], r * 0.72, { fill: "none", w: 0.5, color: "#8a9199" });
  s.circle("RIGGING", [x, y], r * 0.3, { fill: "#8a9199", w: 0.8, color: "#3b4148" });
  s.poly("RIGGING", [q(0, r * 0.3), q(-0.9, 0.7)], { w: 0.8, color: "#2b2f33" });   // hoist rope over the sheave back along the boom
  return r;
}
// the falls between the head and the block, drawn as evenly spaced vertical lines
function falls2D(s, bd, x, yTop, yBot) {
  const n = bd.parts, spread = Math.max(0.12, bd.rs * 1.6);
  for (let i = 0; i < n; i++) { const xo = n === 1 ? 0 : -spread / 2 + spread * i / (n - 1); s.poly("RIGGING", [[x + xo, yTop], [x + xo, yBot]], { w: 0.55, color: "#2b2f33" }); }
}

function blockIcon(type) {
  const bd = { type, parts: 4, sheaves: 2, H: 1.3, W: type === "single" ? 0.8 : 1.3, T: 0.5, hookLen: type === "single" ? 0.85 : 0.78, rs: type === "single" ? 0.29 : 0.29 };
  const s = new Scene(); block2D(s, bd, 0, 0);
  for (const [a, z] of sheaveCentres(bd)) for (const sx of [-1, 1]) s.poly("RIGGING", [[a + sx * bd.rs, z], [a + sx * bd.rs, bd.hookLen + bd.H + 0.5]], { w: 0.5, color: "#2b2f33" });
  return toSVG(s, { pad: 0.08, noSize: true, lw: 0.05 });
}
// the block's name as the crane data sheet gives it (a double block is two blocks working together)
const blockName = bd => (bd.type === "ramshorn" ? "Ramshorn hook block" : BLOCK_TYPES[bd.type] || "Hook block");
