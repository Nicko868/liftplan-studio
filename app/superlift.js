// ================= Superlift (SSL) for crawler cranes =================
// The SL ballast pallet hangs off a 30 m SL mast behind the crane. It is drawn in plan, side and 3D, counts in the
// ground pressure and gross applied weight (calc.js / app.js), and is checked here for:
//  • what it swings into between the pick and set slew (site items, other cranes) – it hangs only ≈0.5 m off the ground
//  • the ground under it when it is set down (it lands on the ground whenever the hook is unloaded)

// world footprint of the pallet for a boom bearing (deg, clockwise from north)
function slTrayPoly(cr, S, bearing) {
  const back = (bearing + 180) * D2R, u = [Math.sin(back), Math.cos(back)], l = [Math.cos(back), -Math.sin(back)];
  const c = [cr.x + u[0] * S.R, cr.y + u[1] * S.R], a = S.tray[0] / 2, b = S.tray[1] / 2;
  return [[-a, -b], [a, -b], [a, b], [-a, b]].map(([r, q]) => [c[0] + u[0] * r + l[0] * q, c[1] + u[1] * r + l[1] * q]);
}
function slSegX(p, q, r, s) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return d(p, q, r) * d(p, q, s) < 0 && d(r, s, p) * d(r, s, q) < 0;
}
function slPolyHit(A, B, closedB = true) {
  if (!A.length || !B.length) return false;
  if (closedB && B.length > 2 && A.some(p => inPolyPt(p, B))) return true;
  if (B.some(p => inPolyPt(p, A))) return true;
  const eA = A.map((p, i) => [p, A[(i + 1) % A.length]]), nB = closedB ? B.length : B.length - 1;
  for (let j = 0; j < nB; j++) for (const [p, q] of eA) if (slSegX(p, q, B[j], B[(j + 1) % B.length])) return true;
  return false;
}
function slObstaclePoly(o) {
  if (o.kind === "circle") { const P = []; for (let i = 0; i < 16; i++) { const a = i / 16 * 2 * Math.PI; P.push([o.x + (+o.r || 1) * Math.cos(a), o.y + (+o.r || 1) * Math.sin(a)]); } return P; }
  return obsPts(o);
}
// what the pallet would hit while the crane slews from the pick to the set bearing (shorter way round)
function slSwingClash(cr, S, b0, b1) {
  let d = ((b1 - b0) % 360 + 540) % 360 - 180; const n = Math.max(2, Math.ceil(Math.abs(d) / 3)), hits = new Map();
  const top = S.hang + slStackH(S);
  const items = plan.obstacles.filter(o => !o.zone && !(typeof isMat === "function" && isMat(o)) && o.type !== "deck" && o.kind !== "dim"
    && !(typeof isVessel === "function" && isVessel(o)) && (o.type === "powerline" ? (+o.hgt || 0) - (+o.clear || 6) < top : (+o.hgt || 0) > S.hang));
  const others = plan.cranes.filter(c => c.id !== cr.id && REG.cranes[c.model]);
  for (let k = 0; k <= n; k++) {
    const T = slTrayPoly(cr, S, b0 + d * k / n);
    for (const o of items) if (!hits.has(o.id) && slPolyHit(T, slObstaclePoly(o), o.kind !== "line")) hits.set(o.id, o.label || o.type || "site item");
    for (const c of others) {
      const C2 = REG.cranes[c.model], rr = C2.type === "cr" ? Math.hypot(C2.car.len / 2, C2.car.gauge / 2 + C2.car.shoe / 2) : Math.max(C2.up?.tail || 4, 4);
      if (!hits.has(c.id) && T.some(p => Math.hypot(p[0] - c.x, p[1] - c.y) < Math.max(rr, C2.up?.tail || 0))) hits.set(c.id, c.label);
      const S2 = slOf(c, C2); if (S2 && !hits.has(c.id + "sl")) { const e2 = evalCrane(c, "pick"); if (e2.bearing != null && slPolyHit(T, slTrayPoly(c, S2, e2.bearing))) hits.set(c.id + "sl", `${c.label}'s SL ballast`); }
    }
  }
  return [...hits.values()];
}
{ const _cs = craneSummary; craneSummary = function (cr) {
    const out = _cs(cr), C = out.C, S = C && slOf(cr, C);
    if (!S) return out;
    out.sl = S;
    const b0 = out.ph?.pick?.bearing, b1 = out.ph?.set?.bearing;
    if (b0 != null && b1 != null) { const hit = slSwingClash(cr, S, b0, b1); if (hit.length) { out.warn.push(`SL ballast (${fx(S.R)} m behind the crane, ${fx(S.hang, 1)} m off the ground) hits ${hit.join(", ")} while slewing from pick to set – move the crane or clear the swing`); if (out.status !== "bad") out.status = "amber"; } }
    const gbc = gbcFor(cr), q = S.T / (S.tray[0] * S.tray[1]);
    if (S.T > 0) { out.slGround = q; if (gbc && q > gbc) out.warn.push(`SL ballast set down: ${fx(S.T)} t on a ${fx(S.tray[0], 1)} × ${fx(S.tray[1], 1)} m pallet = ${fx(q, 1)} t/m², over the ${fx(gbc)} t/m² allowed – put mats where it lands (it sits on the ground whenever the hook is unloaded)`); }
    return out;
  }; }

// ---------- 3D: SL mast (lattice), pendants and the ballast pallet with its plates ----------
{ const _c3 = crane3D; crane3D = function (M, cr, ev) {
    const r = _c3(M, cr, ev), C = ev.C, S = C && slOf(cr, C);
    if (!r || !S) return r;
    const P = paintSet(cr.paint || "#e8b90f"), body = cr.paint || "#e8b90f", UF = r.UF, g = slGeom(C, S);
    const W = (x, along, z) => [cr.x + UF.x[0] * x + UF.y[0] * along, cr.y + UF.x[1] * x + UF.y[1] * along, z];
    const foot = W(0, g.foot[0], g.foot[1]), head = W(0, g.head[0], g.head[1]);
    // lattice mast: four chords tapering to the head, lacing between them
    const ax = vsub(head, foot), Lm = Math.hypot(...ax), my = vmul(ax, 1 / Lm), mx = UF.x, mz = vcross(mx, my);
    const MP = (x, s, z) => vadd(foot, vadd(vmul(mx, x), vadd(vmul(my, s), vmul(mz, z))));
    const half = s => { const t = Math.min(1, s / 4, (Lm - s) / 4); return 0.9 * (0.4 + 0.6 * Math.max(0, t)); };
    const st = []; for (let s = 0; s < Lm - 0.6; s += 2) st.push(s); st.push(Lm - 0.6);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (let i = 0; i < st.length - 1; i++) M.cyl(MP(sx * half(st[i]), st[i], sz * half(st[i]) * 0.8), MP(sx * half(st[i + 1]), st[i + 1], sz * half(st[i + 1]) * 0.8), 0.07, body, { n: 6, open: true });
    for (let i = 0; i < st.length - 1; i++) { const f = i % 2 ? 1 : -1, h0 = half(st[i]), h1 = half(st[i + 1]);
      for (const sx of [-1, 1]) M.line(MP(sx * h0, st[i], f * h0 * 0.8), MP(sx * h1, st[i + 1], -f * h1 * 0.8), P.stroke, 0.8);
      for (const sz of [-1, 1]) M.line(MP(f * h0, st[i], sz * h0 * 0.8), MP(-f * h1, st[i + 1], sz * h1 * 0.8), P.stroke, 0.8); }
    M.cyl(MP(-0.6, Lm - 0.3, 0), MP(0.6, Lm - 0.3, 0), 0.35, "#e2e5e8", { n: 14 });        // mast head sheaves
    // pendants: mast head → boom head (two), luffing tackle from the A-frame, and down to the pallet (four)
    for (const sx of [-0.45, 0.45]) M.line(vadd(head, vmul(mx, sx)), vadd(r.tip, vmul(mx, sx)), "#2b2f33", 1.3);
    M.line(W(0, -1.5, C.up.baseH + 7), head, "#2b2f33", 1.1);
    const ta = S.tray[0] / 2, tb = S.tray[1] / 2, z0 = S.hang, zt = z0 + slStackH(S);
    const TF = { o: W(0, -S.R, 0), x: UF.x, y: UF.y, z: [0, 0, 1] };
    for (const [qx, qy] of [[-tb, -ta], [tb, -ta], [tb, ta], [-tb, ta]]) M.line(head, W(qx * 0.85, -S.R + qy * 0.85, zt), "#2b2f33", 1.1);
    // pallet: steel frame, plates in four stacks (2 radial × 2 across), hanging just off the ground
    M.box(TF, -tb, tb, -ta, ta, z0, z0 + 0.45, "#3d4246");
    const n = Math.round(S.T / S.plate), per = [0, 0, 0, 0]; for (let i = 0; i < n; i++) per[i % 4]++;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy], k) => { for (let j = 0; j < per[k]; j++) { const zz = z0 + 0.45 + j * 0.4;
      M.box(TF, sx > 0 ? 0.03 : -tb + 0.02, sx > 0 ? tb - 0.02 : -0.03, sy > 0 ? 0.03 : -ta + 0.02, sy > 0 ? ta - 0.02 : -0.03, zz, zz + 0.38, j % 2 ? P.cw : shade(P.cw, 0.9)); } });
    M.label(W(0, -S.R, zt + 1.2), `SL ballast ${fx(S.T)} t · ${fx(S.R)} m`, cr.color || "#34393f", 11);
    return r;
  }; }
