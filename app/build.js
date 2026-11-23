// ===== Crane drawing builders
const D2R = Math.PI / 180;
const DZ = 0.15;           // carrier raised on outriggers: tyres clear of ground
const MAT_T = 0.2;          // mat thickness

// cumulative start of each telescopic section along the boom (index 0 = base)
function teleCum(b, L, cfg) {
  const n = b.n, cum = [0];
  const ext = cfg && cfg.ext && cfg.ext.length === n - 1 ? cfg.ext.map(Number) : Array(n - 1).fill((L - b.Lmin) / (n - 1));
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + (ext[i - 1] || 0));
  return cum;
}
function boomAngle(C, L, R) {
  const pu = C.boom.pivot[0];
  const c = (R - pu) / L;
  if (c >= 1) return { ok: false, theta: 0, why: "Radius is longer than the boom can reach" };
  if (c <= 0) return { ok: false, theta: 90, why: "Radius too small for this boom length" };
  const th = Math.acos(c) / D2R;
  if (th > C.maxAngle) return { ok: false, theta: th, why: `Boom angle ${th.toFixed(1)}° exceeds max ${C.maxAngle}° — increase radius or shorten boom` };
  return { ok: true, theta: th };
}

// ---------------- PLAN: carrier (carrier frame, +y front)
function carrierPlan(C, orMode, showMats) {
  if (C.type === "ped") return pedPlan(C);
  const s = new Scene();
  if (C.type === "cr") {
    const k = C.car;
    // crawler mats: laid across each track, side by side along its length, centred on the carbody
    if (showMats && showMats.w > 0 && showMats.l > 0) {
      const per = Math.max(1, Math.ceil((showMats.qty || 2) / 2)), mw = showMats.w, ml = showMats.l, run = per * mw;
      for (const sx of [-1, 1]) { const xc = sx * k.gauge / 2;
        for (let i = 0; i < per; i++) { const y0 = -run / 2 + i * mw; s.rect("MATS", xc - ml / 2, y0, xc + ml / 2, y0 + mw, { dash: [0.35, 0.2], w: 0.8 }); } }
    }
    for (const sx of [-1, 1]) {
      const xc = sx * k.gauge / 2, x0 = xc - k.shoe / 2, x1 = xc + k.shoe / 2, r = 0.45;
      s.poly("TRACKS", [[x0 + r, -k.len / 2], [x1 - r, -k.len / 2], [x1, -k.len / 2 + r], [x1, k.len / 2 - r], [x1 - r, k.len / 2],
        [x0 + r, k.len / 2], [x0, k.len / 2 - r], [x0, -k.len / 2 + r]], { closed: true, fill: true, w: 1.4 });
      for (let y = -k.len / 2 + 0.45; y < k.len / 2 - 0.3; y += 0.45) s.poly("TRACKS", [[x0 + 0.08, y], [x1 - 0.08, y]], { w: 0.5 });
      for (const ty of [-5.165, 5.165]) s.poly("REF", [[x0 - 0.25, ty], [x1 + 0.25, ty]], { dash: [0.4, 0.2], w: 0.6 });
    }
    s.rect("CARRIER", -(k.gauge / 2 - k.shoe / 2), -1.7, k.gauge / 2 - k.shoe / 2, 1.7, { fill: true });
    s.rect("CARRIER", -1.6, -3.0, 1.6, 3.0, { fill: true });
    s.text("TEXT", [0, -2.4], "CARBODY", 0.32);
    s.poly("REF", [[0, k.len / 2 + 0.2], [0, k.len / 2 + 1.1]]);
    s.poly("REF", [[-0.3, k.len / 2 + 0.75], [0, k.len / 2 + 1.1], [0.3, k.len / 2 + 0.75]]);
    return s;
  }
  const k = C.car, w = k.w, om = C.or.modes[orMode] || Object.values(C.or.modes)[0];
  // outriggers first (under body)
  om.pads.forEach(([sx, y], i) => {
    const px = sx * om.spread / 2;
    if (showMats) { const mw = (showMats.w || 2.5) / 2, ml = (showMats.l || 2.5) / 2; s.rect("MATS", px - mw, y - ml, px + mw, y + ml, { dash: [0.35, 0.2], w: 0.8 }); }
    s.rect("OUTRIGGERS", Math.min(sx * w / 2, px), y - 0.2, Math.max(sx * w / 2, px), y + 0.2, { fill: true });
    s.rect("OUTRIGGERS", sx > 0 ? px - 0.55 : px + 0.55, y - 0.14, px, y + 0.14, { fill: "#e7a970", w: 0.6 });
    s.circle("OUTRIGGERS", [px, y], C.or.float / 2, { fill: "#c9772f" });
    s.circle("OUTRIGGERS", [px, y], 0.16, { fill: "#8a4a13" });
    s.text("TEXT", [px + sx * 1.7, y + 1.1], "P" + (i + 1), 0.65, { bold: true });
  });
  // body
  s.rect("CARRIER", -w / 2, k.rear, w / 2, k.front - k.cabLen, { fill: true, w: 1.3 });
  for (const sx of [-1, 1]) s.poly("CARRIER", [[sx * (w / 2 - 0.28), k.rear + 0.3], [sx * (w / 2 - 0.28), k.front - k.cabLen - 0.2]], { w: 0.5 });
  s.rect("CARRIER", -w / 2 + 0.55, k.rear + 0.15, w / 2 - 0.55, k.rear + 0.9, { w: 0.5 });
  // tyres
  for (const ay of k.axles) for (const sx of [-1, 1]) {
    const x0 = sx > 0 ? w / 2 - k.tyreW : -w / 2, x1 = x0 + k.tyreW;
    s.rect("TYRES", x0, ay - k.tyreR * 0.92, x1, ay + k.tyreR * 0.92, { fill: true, w: 0.6 });
  }
  // driver cab
  const y0 = k.front - k.cabLen, y1 = k.front;
  s.poly("CARRIER", [[-w / 2 + 0.05, y0], [w / 2 - 0.05, y0], [w / 2 - 0.05, y1 - 0.45], [w / 2 - 0.35, y1], [-w / 2 + 0.35, y1], [-w / 2 + 0.05, y1 - 0.45]], { closed: true, fill: "#d3dae1", w: 1.2 });
  s.poly("CARRIER", [[-w / 2 + 0.3, y1 - 0.55], [w / 2 - 0.3, y1 - 0.55]], { w: 0.6 });
  s.text("TEXT", [0, y0 + 0.9], "CAB", 0.45);
  s.poly("REF", [[0, y1 + 0.3], [0, y1 + 1.3]]); s.poly("REF", [[-0.3, y1 + 0.95], [0, y1 + 1.3], [0.3, y1 + 0.95]]);
  s.text("TEXT", [0, y1 + 1.9], "FRONT", 0.5, { bold: true });
  return s;
}

// ---------------- PLAN: upper + boom (upper frame, +y = boom)
function upperPlan(C, L, th, sl, cfg, S) {
  const s = new Scene(), u = C.up, b = C.boom;
  const cwF = -(u.tail - u.cwD);
  // superlift: the ballast pallet behind the crane, the SL mast over it, and the circle it swings through
  if (C.type === "cr" && sl) {
    const [ta, tb] = (S && S.tray) || (C.sl && C.sl.tray) || [3.6, 4.8], T = S ? S.T : 0;
    s.circle("RADIUS", [0, 0], sl + ta / 2, { dash: [0.8, 0.5], w: 0.6, color: "#8a5a00" });
    s.rect("COUNTERWEIGHT", -tb / 2, -sl - ta / 2, tb / 2, -sl + ta / 2, { fill: true, w: 1.1 });
    for (const x of [-tb / 4, tb / 4]) for (const y of [-ta / 4, ta / 4]) s.rect("COUNTERWEIGHT", x - 1.15, -sl + y - 0.85, x + 1.15, -sl + y + 0.85, { w: 0.5 });
    s.text("TEXT", [0, -sl - 0.25], `SL ${fx(T)} t · ${fx(sl)} m`, 0.5, { bold: true });
    for (const x of [-0.9, 0.9]) s.poly("BOOM", [[x, b.pivot[0]], [x * 0.6, -sl]], { w: 1.6 });      // SL mast (seen from above)
  }
  s.circle("UPPER", [0, 0], C.type === "cr" ? 1.9 : 1.15, { dash: [0.3, 0.2], w: 0.7 });
  // counterweight
  if (u.cwShape === "arc") {
    const ha = Math.asin((u.cwW / 2) / u.tail);
    const pts = [[-u.cwW / 2, cwF], [u.cwW / 2, cwF]];
    for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + ha - 2 * ha * i / 24; pts.push([u.tail * Math.cos(a), u.tail * Math.sin(a)]); }
    s.poly("COUNTERWEIGHT", pts, { closed: true, fill: true, w: 1.3 });
    s.poly("COUNTERWEIGHT", [[-u.cwW / 2 + 1.67, cwF], [-u.cwW / 2 + 1.67, -Math.sqrt(u.tail ** 2 - (u.cwW / 2 - 1.67) ** 2)]], { w: 0.6 });
    s.poly("COUNTERWEIGHT", [[u.cwW / 2 - 1.67, cwF], [u.cwW / 2 - 1.67, -Math.sqrt(u.tail ** 2 - (u.cwW / 2 - 1.67) ** 2)]], { w: 0.6 });
  } else {
    const c = u.cwShape === "plate" ? 0.3 : 0.15;
    s.poly("COUNTERWEIGHT", [[-u.cwW / 2, cwF], [u.cwW / 2, cwF], [u.cwW / 2, -u.tail + c], [u.cwW / 2 - c, -u.tail], [-u.cwW / 2 + c, -u.tail], [-u.cwW / 2, -u.tail + c]], { closed: true, fill: true, w: 1.3 });
    if (u.cwShape === "plate") for (const sx of [-1, 1]) s.rect("COUNTERWEIGHT", sx * (u.cwW / 2 - 1.8), -u.tail + 0.05, sx * (u.cwW / 2 - 0.02), cwF - 0.05, { w: 0.6 });
  }
  s.text("TEXT", [0, cwF - u.cwD / 2], "CW " + u.cwLabel, 0.42);
  // deck
  s.rect("UPPER", -u.deckW / 2, cwF, u.deckW / 2, u.deckFront, { fill: true, w: 1.2 });
  s.rect("UPPER", -u.deckW / 2 + 0.3, cwF + 0.3, -0.3, cwF + 1.9, { w: 0.5 });
  s.circle("UPPER", [0.7, cwF + 1.2], 0.45, { w: 0.5 });
  // cab
  s.rect("UPPER", u.cab.lat[0], u.cab.fwd[0], u.cab.lat[1], u.cab.fwd[1], { fill: "#f1d2d6", w: 1.1 });
  s.poly("UPPER", [[u.cab.lat[0] + 0.15, u.cab.fwd[1] - 0.35], [u.cab.lat[1] - 0.1, u.cab.fwd[1] - 0.35]], { w: 0.5 });
  // boom (plan projection)
  const pv = b.pivot[0], proj = L * Math.cos(th * D2R), tip = pv + proj;
  if (b.kind === "tele") {
    const n = b.n, cum = teleCum(b, L, cfg);
    for (let i = n - 1; i >= 0; i--) {
      const s0 = pv + cum[i] * Math.cos(th * D2R), s1 = pv + (cum[i] + b.Lmin - 1.0 - 0.1 * i) * Math.cos(th * D2R);
      const hw = b.W0 / 2 * (1 - 0.07 * i);
      s.rect("BOOM", -hw, s0, hw, Math.min(s1, tip - 0.4), { fill: true, w: i ? 0.8 : 1.3 });
    }
    s.poly("BOOM", [[-b.W0 * 0.3, tip - 0.9 * Math.cos(th * D2R)], [b.W0 * 0.3, tip - 0.9 * Math.cos(th * D2R)], [0.35, tip], [-0.35, tip]], { closed: true, fill: true });
  } else {
    const hw = b.W0 / 2, c = Math.cos(th * D2R);
    const pts = [[-0.7, pv], [0.7, pv], [hw, pv + 5 * c], [hw, tip - 5 * c], [0.5, tip], [-0.5, tip], [-hw, tip - 5 * c], [-hw, pv + 5 * c]];
    // open lattice: an invisible fill keeps the boom clickable, the two chords are painted strips, lacing in between
    s.poly("BOOM", pts, { closed: true, fill: "transparent", w: 1.1 });
    const hwAt = y => y < pv + 5 * c ? 0.7 + (hw - 0.7) * (y - pv) / (5 * c || 1) : y > tip - 5 * c ? 0.5 + (hw - 0.5) * (tip - y) / (5 * c || 1) : hw;
    const ys = [pv, pv + 5 * c, tip - 5 * c, tip], ch = 0.2;
    for (const sg of [1, -1]) s.poly("BOOM", [...ys.map(y => [sg * hwAt(y), y]), ...[...ys].reverse().map(y => [sg * (hwAt(y) - ch), y])], { closed: true, fill: true, w: 0.8 });
    let flip = 1; const pan = Math.max(0.8, 2.2 * c);
    for (let y = pv + 0.3; y < tip - 0.3; y += pan) {
      const y2 = Math.min(y + pan, tip - 0.3), a0 = hwAt(y) - ch, a1 = hwAt(y2) - ch;
      s.poly("BOOM", [[-a0 * flip, y], [a1 * flip, y2]], { w: 0.55 }); s.poly("BOOM", [[-a0, y], [a0, y]], { w: 0.35 }); flip = -flip;
    }
    s.poly("BOOM", [[0, pv], [0, tip]], { dash: [0.5, 0.25], w: 0.4 });
    const J = cfg && cfg.joints;
    if (J) for (const sv of J) if (sv > 0 && sv < L) s.poly("BOOM", [[-hw - 0.15, pv + sv * c], [hw + 0.15, pv + sv * c]], { w: 1.4 });
  }
  return s;
}

// ---------------- ELEVATION (boom plane, x = horizontal along boom from slew centre, y = height)
function carrierSide(C, om) {
  if (C.type === "ped") return pedSide(C);
  const s = new Scene();
  if (C.type === "cr") {
    const k = C.car, L = k.len, H = k.trackH, r = H / 2;
    const pts = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + Math.PI * i / 12; pts.push([-L / 2 + r + r * Math.cos(a), r + r * Math.sin(a)]); }
    for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + Math.PI * i / 12; pts.push([L / 2 - r + r * Math.cos(a), r + r * Math.sin(a)]); }
    s.poly("TRACKS", pts, { closed: true, fill: true, w: 1.4 });
    s.circle("TRACKS", [-L / 2 + r, r], r * 0.75, { fill: "#b99a6d" }); s.circle("TRACKS", [L / 2 - r, r], r * 0.75, { fill: "#b99a6d" });
    for (let x = -L / 2 + 1.6; x < L / 2 - 1.2; x += 0.95) s.circle("TRACKS", [x, 0.28], 0.13, { fill: "#8b6b3e" });
    s.rect("CARRIER", -1.6, H, 1.6, k.carbodyH, { fill: true });
    return s;
  }
  const k = C.car, dz = DZ;
  om.pads.forEach(([sx, y]) => {
    s.rect("MATS", y - 1.25, 0, y + 1.25, MAT_T, { fill: "#d8cbb3", w: 0.7 });
    s.rect("OUTRIGGERS", y - C.or.float / 2, MAT_T, y + C.or.float / 2, MAT_T + 0.12, { fill: "#c9772f" });
    s.rect("OUTRIGGERS", y - 0.14, MAT_T + 0.12, y + 0.14, k.frameLow + dz, { fill: true });
    s.rect("OUTRIGGERS", y - 0.3, k.frameLow + dz - 0.05, y + 0.3, k.frameLow + dz + 0.45, { fill: true });
  });
  s.rect("CARRIER", k.rear, k.frameLow + dz, k.front - k.cabLen, k.deckH + dz, { fill: true, w: 1.3 });
  s.rect("CARRIER", k.rear + 0.2, k.deckH + dz, k.rear + 1.3, k.deckH + dz + 0.3, { w: 0.6 });
  const x0 = k.front - k.cabLen, x1 = k.front, b = k.frameLow + dz - 0.15, t = k.cabH + dz;
  s.poly("CARRIER", [[x0, b], [x1, b + 0.1], [x1, b + 0.9], [x1 - 0.12, t - 0.9], [x1 - 0.5, t], [x0, t]], { closed: true, fill: "#d3dae1", w: 1.3 });
  s.poly("CARRIER", [[x0 + 0.5, t - 0.2], [x1 - 0.52, t - 0.2], [x1 - 0.2, t - 1.0], [x0 + 0.5, t - 1.0]], { closed: true, fill: "#9fb4c7", w: 0.6 });
  for (const ax of k.axles) {
    s.circle("TYRES", [ax, k.tyreR + dz], k.tyreR, { fill: true, w: 1 });
    s.circle("TYRES", [ax, k.tyreR + dz], k.tyreR * 0.48, { fill: "#9aa3ab", w: 0.6 });
  }
  return s;
}
function carrierEnd(C, om) {
  if (C.type === "ped") return pedSide(C);
  const s = new Scene();
  if (C.type === "cr") {
    const k = C.car;
    for (const sx of [-1, 1]) s.rect("TRACKS", sx * k.gauge / 2 - k.shoe / 2, 0, sx * k.gauge / 2 + k.shoe / 2, k.trackH, { fill: true, w: 1.3 });
    s.rect("CARRIER", -(k.gauge / 2 - k.shoe / 2), 0.35, k.gauge / 2 - k.shoe / 2, k.trackH - 0.1, { fill: true });
    s.rect("CARRIER", -1.6, k.trackH, 1.6, k.carbodyH, { fill: true });
    return s;
  }
  const k = C.car, dz = DZ, w = k.w, half = om.spread / 2;
  for (const sx of [-1, 1]) {
    const px = sx * half;
    s.rect("MATS", px - 1.25, 0, px + 1.25, MAT_T, { fill: "#d8cbb3", w: 0.7 });
    s.rect("OUTRIGGERS", px - C.or.float / 2, MAT_T, px + C.or.float / 2, MAT_T + 0.12, { fill: "#c9772f" });
    s.rect("OUTRIGGERS", px - 0.14, MAT_T + 0.12, px + 0.14, k.frameLow + dz + 0.1, { fill: true });
    s.rect("OUTRIGGERS", Math.min(px, sx * w / 2), k.frameLow + dz, Math.max(px, sx * w / 2), k.frameLow + dz + 0.42, { fill: true });
    s.rect("TYRES", sx > 0 ? w / 2 - k.tyreW : -w / 2, dz, sx > 0 ? w / 2 : -w / 2 + k.tyreW, dz + 2 * k.tyreR, { fill: true });
  }
  s.rect("CARRIER", -w / 2 + 0.3, k.frameLow + dz, w / 2 - 0.3, k.deckH + dz, { fill: true, w: 1.3 });
  return s;
}

// superlift mast: foot at the boom foot, head over the ballast at the SL radius (side-view x / z, x forward)
function slGeom(C, S) {
  const b = C.boom, foot = [b.pivot[0] - 0.8, b.pivot[1] + 0.4], dx = S.R + foot[0];
  return { foot, head: [-S.R, foot[1] + Math.sqrt(Math.max(1, S.mast * S.mast - dx * dx))] };
}
function upperSide(C, L, th, R, sl, cfg, S) {
  const s = new Scene(), u = C.up, b = C.boom, dz = C.type === "cr" || C.type === "ped" ? 0 : DZ;
  const bh = u.baseH + dz, cwF = -(u.tail - u.cwD);
  // superlift: SL mast from the boom foot to a head over the ballast, pendants to the boom head and down to the pallet
  if (C.type === "cr" && sl) {
    const S2 = S || { R: sl, T: 0, mast: (C.sl && C.sl.mast) || 30, tray: (C.sl && C.sl.tray) || [3.6, 4.8], plate: 10, hang: 0.5 };
    const g = slGeom(C, S2), ta = S2.tray[0], z0 = S2.hang, z1 = z0 + slStackH(S2);
    s.rect("COUNTERWEIGHT", -sl - ta / 2, z0, -sl + ta / 2, z0 + 0.45, { fill: true, w: 1.2 });
    for (let y = z0 + 0.45; y < z1 - 0.01; y += 0.4) s.rect("COUNTERWEIGHT", -sl - ta / 2 + 0.1, y, -sl + ta / 2 - 0.1, y + 0.4, { fill: true, w: 0.5 });
    s.text("TEXT", [-sl, z1 + 0.6], `SL ballast ${fx(S2.T)} t`, 0.55, { bold: true });
    s.poly("BOOM", [g.foot, g.head], { w: 3.2 }); s.poly("BOOM", [[g.foot[0] - 0.6, g.foot[1]], [g.head[0] + 0.3, g.head[1] - 0.6]], { w: 1.2 });
    s.poly("RIGGING", [g.head, [-sl - ta / 2 + 0.3, z1]], { w: 0.8 }); s.poly("RIGGING", [g.head, [-sl + ta / 2 - 0.3, z1]], { w: 0.8 });
    s.poly("RIGGING", [g.head, [b.pivot[0] + L * Math.cos(th * D2R), b.pivot[1] + L * Math.sin(th * D2R)]], { w: 1.0 });
  }
  s.rect("UPPER", -1.3, bh - 0.3, 1.3, bh, { fill: "#d7c3c6" });
  s.poly("UPPER", [[cwF, bh], [u.deckFront, bh], [u.deckFront, bh + u.bodyH * 0.7], [u.deckFront - 0.5, bh + u.bodyH], [cwF, bh + u.bodyH]], { closed: true, fill: true, w: 1.2 });
  // counterweight stack
  s.rect("COUNTERWEIGHT", -u.tail, bh + 0.05, cwF, bh + 0.05 + u.cwH, { fill: true, w: 1.3 });
  for (let y = bh + 0.45; y < bh + u.cwH; y += 0.42) s.poly("COUNTERWEIGHT", [[-u.tail, y], [cwF, y]], { w: 0.5 });
  // cab
  const c0 = u.cab.fwd[0], c1 = u.cab.fwd[1];
  s.poly("UPPER", [[c0, bh], [c1, bh], [c1 + 0.12, bh + u.cab.h * 0.55], [c1 - 0.25, bh + u.cab.h], [c0, bh + u.cab.h]], { closed: true, fill: "#f1d2d6", w: 1.2 });
  s.poly("UPPER", [[c0 + 0.35, bh + u.cab.h - 0.18], [c1 - 0.3, bh + u.cab.h - 0.18], [c1 - 0.02, bh + u.cab.h * 0.5], [c0 + 0.35, bh + u.cab.h * 0.5]], { closed: true, fill: "#9fb4c7", w: 0.6 });
  // boom
  const P = [b.pivot[0], b.pivot[1] + dz], d = [Math.cos(th * D2R), Math.sin(th * D2R)], n = [-d[1], d[0]];
  const at = (sv, t) => [P[0] + sv * d[0] + t * n[0], P[1] + sv * d[1] + t * n[1]];
  if (b.kind === "tele") {
    // luffing cylinder
    const cb = [b.cyl[0], bh + b.cyl[1]], ct = at(0.42 * b.Lmin, -0.1);
    const cd = [ct[0] - cb[0], ct[1] - cb[1]], cl = Math.hypot(...cd), cu = [cd[0] / cl, cd[1] / cl], cn = [-cu[1], cu[0]];
    const cr = (a, t0, t1) => [[cb[0] + cu[0] * t0 + cn[0] * a, cb[1] + cu[1] * t0 + cn[1] * a], [cb[0] + cu[0] * t1 + cn[0] * a, cb[1] + cu[1] * t1 + cn[1] * a]];
    const q = (a, t0, t1) => { const [p0, p1] = cr(a, t0, t1), [p2, p3] = cr(-a, t0, t1); return [p0, p1, p3, p2]; };
    s.poly("BOOM", q(0.13, cl * 0.45, cl), { closed: true, fill: "#c9d3dd", w: 0.8 });
    s.poly("BOOM", q(0.26, 0, cl * 0.58), { closed: true, fill: "#9fb1c4", w: 1 });
    const nn = b.n, cum = teleCum(b, L, cfg);
    for (let i = nn - 1; i >= 0; i--) {
      const s0 = cum[i], s1 = Math.min(cum[i] + b.Lmin - 1.0 - 0.1 * i, L - 0.6), D = b.D0 * (1 - 0.075 * i), c = b.D0 / 2 - 0.25;
      s.poly("BOOM", [at(s0, c - D / 2), at(s1, c - D / 2), at(s1, c + D / 2), at(s0, c + D / 2)], { closed: true, fill: true, w: i ? 0.9 : 1.4 });
    }
    const Dl = b.D0 * (1 - 0.075 * (nn - 1)), c = b.D0 / 2 - 0.25;
    s.poly("BOOM", [at(L - 1.2, c - Dl / 2), at(L, -0.35), at(L, 0.45), at(L - 1.2, c + Dl / 2)], { closed: true, fill: "#bcd3ee", w: 1.2 });
    s.circle("BOOM", at(L, 0), 0.42, { fill: "#ffffff", w: 1 });
    s.circle("BOOM", P, 0.25, { fill: "#ffffff", w: 1 });
  } else {
    const D = b.D0;
    const top = [], bot = [];
    const prof = sv => sv < 6 ? 0.9 + (D - 0.9) * sv / 6 : sv > L - 6 ? 0.9 + (D - 0.9) * (L - sv) / 6 : D;
    for (const sv of [0, 6, L - 6, L]) { top.push(at(sv, prof(sv) / 2)); bot.push(at(sv, -prof(sv) / 2)); }
    // open lattice: two chords (painted strips) with lacing between them – the gaps stay see-through
    const ch = 0.17, stn = [0, 6, L - 6, L];
    for (const sg of [1, -1]) s.poly("BOOM", [...stn.map(sv => at(sv, sg * prof(sv) / 2)), ...[...stn].reverse().map(sv => at(sv, sg * (prof(sv) / 2 - ch)))], { closed: true, fill: true, w: 0.9 });
    const pan = Math.max(1.2, D * 1.05), inner = sv => prof(sv) / 2 - ch;
    let flip = 1;
    for (let sv = 0.3; sv < L - 0.4; sv += pan) {
      const s2 = Math.min(sv + pan, L - 0.3);
      s.poly("BOOM", [at(sv, flip * inner(sv)), at(s2, -flip * inner(s2))], { w: 0.75 });
      s.poly("BOOM", [at(sv, inner(sv)), at(sv, -inner(sv))], { w: 0.45 });
      flip = -flip;
    }
    s.poly("BOOM", [at(L - 0.3, inner(L - 0.3)), at(L - 0.3, -inner(L - 0.3))], { w: 0.45 });
    const J = cfg && cfg.joints;
    if (J) { let prev = 0; for (const sv of [...J, L]) { if (sv > 0 && sv < L) s.poly("BOOM", [at(sv, -prof(sv) / 2 - 0.12), at(sv, prof(sv) / 2 + 0.12)], { w: 1.6 }); s.text("BOOM", at((prev + sv) / 2, -prof((prev + sv) / 2) / 2 - 0.55), `${+(sv - prev).toFixed(2)}`, 0.42, { rot: th }); prev = sv; } }
    s.circle("BOOM", P, 0.3, { fill: "#ffffff", w: 1 });
  }
  return { s, tip: at(L, b.kind === "tele" ? -0.42 : -0.6) };
}

function elevationView(C, st, Ld) {
  const ba = boomAngle(C, st.L, st.R), th = ba.theta;
  const s = new Scene();
  const om = C.or ? (C.or.modes[st.orMode] || Object.values(C.or.modes)[0]) : null;
  const cphi = Math.cos(st.slew * D2R);
  let carrierMode;
  if (Math.abs(cphi) >= 0.7) {
    carrierMode = cphi > 0 ? "side (boom over front)" : "side (boom over rear)";
    s.add(carrierSide(C, om), 0, 0, 0, cphi < 0);
  } else { carrierMode = "end-on (boom over side)"; s.add(carrierEnd(C, om)); }
  const { s: up, tip } = upperSide(C, st.L, th, st.R, C.type === "cr" ? (st.S ? st.S.R : st.sl) : 0, st.cfg, st.S);
  s.add(up);
  const lview = Math.abs(Math.cos(st.loadRot * D2R)) > 0.707 ? "end" : "side";
  const hookY = Math.min(st.hL + loadRigHeight(Ld, st.tandem), tip[1] - 0.9 - ((st.bd && st.bd.total) || 2.1));   // hook bottom (never above the boom head)
  const bd = st.bd || { type: "single", parts: 2, sheaves: 1, H: 1.3, W: 0.8, T: 0.4, hookLen: 0.8, rs: 0.3, total: 2.1 };
  const blockTop = hookY + bd.total;
  const hr = head2D(s, bd, tip[0], tip[1], th, st.paintStroke || "#3b4148", st.paintFill || "#dfe6ee");
  const sc = sheaveCentres(bd)[0];
  const ls = loadSideRig(Ld, hookY, st.R, lview, st.tandem, 1, st.point);
  s.add(ls.s);
  falls2D(s, bd, st.R, tip[1], hookY + sc[1]);
  block2D(s, bd, st.R, hookY);
  // ground, slew axis, dims
  const [bx0, , bx1] = s.bounds();
  s.poly("GROUND", [[Math.min(bx0, -2) - 1, 0], [Math.max(bx1, st.R + 5) + 1, 0]], { w: 1.4 });
  for (let x = Math.min(bx0, -2) - 1; x < Math.max(bx1, st.R + 5) + 1; x += 0.8) s.poly("GROUND", [[x, 0], [x - 0.4, -0.4]], { w: 0.5 });
  s.poly("REF", [[0, -0.6], [0, 5]], { dash: [0.5, 0.25], w: 0.7 });
  const dy = -1.6;
  s.poly("DIMS", [[0, dy], [st.R, dy]], { w: 0.8 }); s.poly("DIMS", [[0, dy - 0.3], [0, dy + 0.3]]); s.poly("DIMS", [[st.R, dy - 0.3], [st.R, dy + 0.3]]);
  s.poly("DIMS", [[st.R, dy], [st.R, ls.bottom - 0.2]], { dash: [0.25, 0.2], w: 0.5 });
  const tk = Math.max(1, tip[1] / 20);   // label size grows with the drawing so it stays legible when the figure is pasted into a document
  s.text("DIMS", [st.R / 2, dy - 0.9 * tk], `RADIUS ${st.R.toFixed(1)} m`, 0.95 * tk, { bold: true });
  const P = C.boom.pivot, mid = [P[0] + st.L * 0.55 * Math.cos(th * D2R), P[1] + (C.type === "cr" || C.type === "ped" ? 0 : DZ) + st.L * 0.55 * Math.sin(th * D2R)];
  // label just above the boom, clear of the lattice: half the boom width + half the text height + a gap
  const off = (C.boom.kind === "lattice" ? 1.6 : 0.8) + 0.9 * tk * 0.55 + 0.5;
  s.text("BOOM", [mid[0] - off * Math.sin(th * D2R), mid[1] + off * Math.cos(th * D2R)], `BOOM ${st.L.toFixed(1)} m @ ${th.toFixed(1)}°`, 0.9 * tk, { rot: th, bold: true });
  // the level marks stand just clear of what is drawn (boom head, hook, load as it is seen here) – not a load length away
  const hx = (() => { try { const b = s.bounds(); if (b && isFinite(b[2])) return Math.max(b[2], tip[0], st.R) + 1.2; } catch (e) { } return Math.max(tip[0], st.R) + loadExtent(Ld) + 1.2; })();
  const f1 = v => (Math.abs(v) < 0.05 ? 0 : v).toFixed(1);   // never "-0.0"
  for (const [y, lab] of [[tip[1], `head ${f1(tip[1])} m`], [hookY, `hook ${f1(hookY)} m`], [ls.bottom, ls.bottom < st.hL - 0.05 ? `load bottom ${f1(ls.bottom)} m – hook too low` : `load bottom ${f1(ls.bottom)} m`]]) {
    s.poly("DIMS", [[hx - 0.4, y], [hx + 0.4, y]], { w: 0.8 });
    s.text("DIMS", [hx + 0.6, y - 0.3 * tk], lab, 0.85 * tk, { anchor: "start", bold: true });
  }
  s.poly("DIMS", [[hx, 0], [hx, tip[1]]], { w: 0.6 });
  return { scene: s, ba, carrierMode, tip, hookY, clearance: tip[1] - hr - blockTop };
}
