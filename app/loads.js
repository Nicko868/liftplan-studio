// ===== Load builder geometry: reels, silos / vessels, cylinders / pipes, boxes / skids
// Local axes: x = along the lifting line (A → B), y = across, z = up from the load bottom.
const LOAD_TYPES = {
  reel: { name: "Reel / drum", orients: { upright: "Standing on flanges (axis horizontal)", flat: "Lying flat (axis vertical)" } },
  silo: { name: "Silo / vessel", orients: { upright: "Upright", horizontal: "Lying horizontal" } },
  cyl: { name: "Cylinder / pipe / pile", orients: { horizontal: "Axis horizontal", vertical: "Axis vertical" } },
  box: { name: "Box / skid / crate", orients: { flat: "As placed" } },
  container: { name: "ISO container", orients: { flat: "As placed" } },
  ccu: { name: "Offshore cargo unit", orients: { flat: "As placed" } },
  tank: { name: "Tank on saddles", orients: { horizontal: "Horizontal on saddles" } },
  beam: { name: "Beam / girder", orients: { flat: "Upright (web vertical)", side: "On its side" } },
  frame: { name: "Open frame / module", orients: { flat: "As placed" } },
  bag: { name: "Bulk bag (FIBC)", orients: { flat: "Standing" } }
};
const CCU_STYLES = { closed: "Closed container", open: "Open top", half: "Half height", basket: "Cargo basket", tankframe: "Tank in frame", rack: "Gas / cylinder rack" };
const CONTAINER_SIZES = { "10ft": [2.991, 2.438, 2.591], "20ft": [6.058, 2.438, 2.591], "20ft HC": [6.058, 2.438, 2.896], "40ft": [12.192, 2.438, 2.591], "40ft HC": [12.192, 2.438, 2.896] };
const LOAD_DEFAULTS = {
  reel: { kind: "reel", orient: "upright", name: "Reel", weight: "", rigWeight: 0, D: 4.0, W: 3.2, FW: 2.6, core: 1.8, span: 3.0, cog: 0, hookToTop: 5.0, spreader: true, hookToSpreader: 4.0, tandemRig: 2.0 },
  silo: { kind: "silo", orient: "upright", name: "Silo", weight: "", rigWeight: 0, D: 3.0, H: 12.0, cone: 2.5, legs: 2.0, span: 2.6, cog: 0, hookToTop: 4.0, spreader: false, hookToSpreader: 2.5, tandemRig: 2.0 },
  cyl: { kind: "cyl", orient: "horizontal", name: "Pipe", weight: "", rigWeight: 0, D: 1.2, L: 12.0, span: 6.0, cog: 0, hookToTop: 5.0, spreader: false, hookToSpreader: 3.0, tandemRig: 2.0 },
  box: { kind: "box", orient: "flat", name: "Box", weight: "", rigWeight: 0, L: 6.0, W: 2.5, H: 2.6, span: 5.0, spanY: 2.0, cog: 0, hookToTop: 5.0, spreader: false, hookToSpreader: 3.0, tandemRig: 2.0 },
  container: { kind: "container", orient: "flat", name: "20ft container", size: "20ft", weight: "", rigWeight: 0, L: 6.058, W: 2.438, H: 2.591, span: 5.853, spanY: 2.259, cog: 0, hookToTop: 6.0, spreader: false, hookToSpreader: 3.0, tandemRig: 2.0 },
  ccu: { kind: "ccu", style: "closed", colour: "#c8331f", orient: "flat", name: "Cargo unit", weight: "", rigWeight: 0, L: 2.99, W: 2.44, H: 2.59, span: 2.79, spanY: 2.24, lpType: "corners", cog: 0, hookToTop: 5.0, spreader: false, hookToSpreader: 3.0, tandemRig: 2.0 },
  tank: { kind: "tank", orient: "horizontal", name: "Tank", weight: "", rigWeight: 0, D: 3.0, L: 10.0, saddle: 0.8, span: 6.0, cog: 0, hookToTop: 5.0, spreader: false, hookToSpreader: 3.0, tandemRig: 2.0 },
  beam: { kind: "beam", orient: "flat", name: "Beam", weight: "", rigWeight: 0, L: 15.0, H: 1.2, W: 0.5, span: 10.0, cog: 0, hookToTop: 6.0, spreader: false, hookToSpreader: 3.0, tandemRig: 2.0 },
  bag: { kind: "bag", orient: "flat", name: "Bulk bag 1 t", colour: "#ebe5cf", loopCol: "#2c6fbb", weight: 1.0, rigWeight: 0, L: 0.95, W: 0.95, H: 1.1, loops: 0.3, span: 0.85, spanY: 0.85, nLP: 4, lpType: "corners", cog: 0, hookToTop: 2.5, spreader: false, hookToSpreader: 2.0, tandemRig: 1.0 },
  frame: { kind: "frame", orient: "flat", name: "Module", weight: "", rigWeight: 0, L: 8.0, W: 4.0, H: 3.5, span: 7.0, spanY: 3.5, cog: 0, hookToTop: 6.0, spreader: false, hookToSpreader: 3.0, tandemRig: 2.0 }
};
// upgrade loads saved by older versions
function normLoad(ld) {
  // bulk bags: the weight is one bag × the number of bags – changing the count keeps each bag's weight
  if (ld.kind === "bag" && typeof bagN === "function") {
    const n = bagN(ld);
    if (ld.bagW == null) {
      let w1 = (+ld.weight || 0) / n;
      const lib = ld.libName && typeof LOAD_LIBRARY !== "undefined" ? LOAD_LIBRARY.find(x => x.kind === "bag" && x.name === ld.libName) : null, lw = +lib?.weight || 0;
      // older plans: the total was left at the weight of fewer bags when more were added
      if (lw > 0 && w1 < lw * 0.9 && Math.abs((+ld.weight || 0) / lw - Math.round((+ld.weight || 0) / lw)) < 1e-6) w1 = lw;
      ld.bagW = Math.round(w1 * 1000) / 1000; ld._n = n; ld.weight = Math.round(ld.bagW * n * 1000) / 1000;
    } else if (ld._n !== n) { ld._n = n; ld.weight = Math.round(+ld.bagW * n * 1000) / 1000; }
    else if (Math.abs((+ld.weight || 0) - ld.bagW * n) > 1e-6) ld.bagW = Math.round((+ld.weight || 0) / n * 10000) / 10000;
  }
  if (!ld.orient) ld.orient = Object.keys(LOAD_TYPES[ld.kind]?.orients || { flat: 1 })[0];
  if (ld.hookToTop == null) {
    if (ld.hookToSpreader != null && ld.spreaderToTop != null) { ld.hookToTop = +ld.hookToSpreader + +ld.spreaderToTop; ld.spreader = true; }
    else ld.hookToTop = ld.rig != null ? +ld.rig : 5;
  }
  if (ld.kind === "reel" && ld.core == null) ld.core = Math.round(ld.D * 0.45 * 10) / 10;
  if (ld.tandemRig == null) ld.tandemRig = ld.kind === "reel" ? 1.0 : 2.0;
  if (ld.spreader == null) ld.spreader = false;
  if (ld.lpType === "bore" || (ld.kind === "reel" && ld.orient !== "flat" && ld.lpType === "wrap")) ld.lpType = "axis";   // reel baskets go on the trunnion; round-the-outside is a per-sling choice
  if (ld.kind === "reel" && ld.orient !== "flat" && ["axis", "bore", "", undefined].includes(ld.lpType) && !ld.spanSet) { const w = Math.max(+ld.W || 0, +ld.FW || 0); if (w > 0) ld.span = Math.round(w * 1000) / 1000; }
  if (ld.rig && ld.rig.arr && typeof solveRig === "function") { try { const r = solveRig(ld); if (r) ld.rigWeight = Math.round(r.weight * 1000) / 1000; } catch (e) { console.warn(e); } }
  return ld;
}
const nz = v => +v || 0;
// overall dimensions in local axes
function loadDims(ld) {
  const k = ld.kind, o = ld.orient;
  if (k === "reel") return o === "flat" ? { x: nz(ld.D), y: nz(ld.D), z: nz(ld.FW) } : { x: Math.max(nz(ld.W), nz(ld.FW)), y: nz(ld.D), z: nz(ld.D) };
  if (k === "silo") return o === "horizontal" ? { x: nz(ld.H), y: nz(ld.D), z: nz(ld.D) } : { x: nz(ld.D), y: nz(ld.D), z: nz(ld.H) };
  if (k === "cyl") return o === "vertical" ? { x: nz(ld.D), y: nz(ld.D), z: nz(ld.L) } : { x: nz(ld.L), y: nz(ld.D), z: nz(ld.D) };
  if (k === "tank") return { x: nz(ld.L), y: nz(ld.D) * 1.05, z: nz(ld.D) + nz(ld.saddle) };
  if (k === "beam") return o === "side" ? { x: nz(ld.L), y: nz(ld.H), z: nz(ld.W) } : { x: nz(ld.L), y: nz(ld.W), z: nz(ld.H) };
  return { x: nz(ld.L), y: nz(ld.W), z: nz(ld.H) };
}
function loadExtent(ld) { const d = loadDims(ld); return Math.max(d.x, d.y) / 2; }
// lifting-point height (z) above the load bottom
function liftPointZ(ld) {
  const d = loadDims(ld);
  if (ld.kind === "bag" && (!ld.lpType || ld.lpType === "corners" || ld.lpType === "top")) return d.z + (ld.loops != null && ld.loops !== "" ? +ld.loops : 0.3);   // top of the lifting loops
  if (ld.lpType === "axis" || ld.lpType === "bore") return d.z / 2;
  if (ld.lpType === "top" || ld.lpType === "corners" || ld.lpType === "wrap") return d.z;
  if (ld.lpType === "bottom") return 0.1;
  if (ld.lpType === "custom" && ld.lpZ !== "" && ld.lpZ != null) return Math.max(0, Math.min(d.z, +ld.lpZ));
  if (ld.kind === "reel" && ld.orient !== "flat") return d.z / 2;  // spindle / axis
  return d.z;
}

// ---- TOP view (plan), centred on the load centre
function loadPlan(ld) {
  normLoad(ld);
  const s = new Scene(), k = ld.kind, o = ld.orient, d = loadDims(ld);
  const circ = (r, opt) => s.circle("LOAD", [0, 0], r, opt);
  if (k === "reel") {
    if (o === "flat") { circ(ld.D / 2, { fill: true, w: 1.2 }); circ(nz(ld.core) / 2, { w: 0.6, dash: [0.3, 0.15] }); circ(0.35, { fill: "#ffffff", w: 0.8 }); }
    else {
      const R = ld.D / 2, FW = nz(ld.FW), W = Math.max(nz(ld.W), FW);
      s.rect("LOAD", -FW / 2, -R, FW / 2, R, { fill: true, w: 1.2 });
      for (const sx of [-1, 1]) {
        s.rect("LOAD", sx > 0 ? FW / 2 - 0.25 : -FW / 2, -R, sx > 0 ? FW / 2 : -FW / 2 + 0.25, R, { fill: "#c9ced4" });
        if (W > FW) s.rect("LOAD", sx > 0 ? FW / 2 : -W / 2, -0.2, sx > 0 ? W / 2 : -FW / 2, 0.2, { w: 0.6, fill: "#9aa3ad" });
      }
      for (const y of [-0.72 * R, -0.45 * R, 0.45 * R, 0.72 * R]) s.poly("LOAD", [[-FW / 2 + 0.3, y], [FW / 2 - 0.3, y]], { dash: [0.3, 0.15], w: 0.5 });
    }
  } else if (k === "silo") {
    if (o === "horizontal") {
      const L = nz(ld.H), R = ld.D / 2, cone = nz(ld.cone), legs = nz(ld.legs), shellEnd = L / 2 - cone - legs;
      s.rect("LOAD", -L / 2, -R, shellEnd, R, { fill: true, w: 1.2 });
      s.poly("LOAD", [[shellEnd, -R], [shellEnd + cone, -R * 0.15], [shellEnd + cone, R * 0.15], [shellEnd, R]], { closed: true, fill: true, w: 1.1 });
      if (legs > 0) for (const sy of [-1, 1]) s.poly("LOAD", [[shellEnd, sy * R * 0.8], [L / 2, sy * R * 0.9]], { w: 1.1 });
    } else {
      circ(ld.D / 2, { fill: true, w: 1.2 }); circ(ld.D * 0.15 / 2 + 0.1, { w: 0.6, dash: [0.25, 0.15] });
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; s.rect("LOAD", ld.D / 2 * 0.85 * Math.cos(a) - 0.15, ld.D / 2 * 0.85 * Math.sin(a) - 0.15, ld.D / 2 * 0.85 * Math.cos(a) + 0.15, ld.D / 2 * 0.85 * Math.sin(a) + 0.15, { fill: "#9aa3ad", w: 0.6 }); }
    }
  } else if (k === "cyl") {
    if (o === "vertical") { circ(ld.D / 2, { fill: true, w: 1.2 }); circ(Math.max(0.05, ld.D / 2 - 0.12), { w: 0.5 }); }
    else { s.rect("LOAD", -d.x / 2, -d.y / 2, d.x / 2, d.y / 2, { fill: true, w: 1.2 }); s.poly("LOAD", [[-d.x / 2, 0], [d.x / 2, 0]], { dash: [0.4, 0.2], w: 0.4 }); }
  } else if (k === "container") {
    s.rect("LOAD", -d.x / 2, -d.y / 2, d.x / 2, d.y / 2, { fill: "#c9d6e3", w: 1.2 });
    for (let x = -d.x / 2 + 0.3; x < d.x / 2 - 0.2; x += 0.3) s.poly("LOAD", [[x, -d.y / 2 + 0.05], [x, d.y / 2 - 0.05]], { w: 0.25 });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) s.rect("LOAD", sx * d.x / 2 - (sx > 0 ? 0.18 : 0), sy * d.y / 2 - (sy > 0 ? 0.16 : 0), sx * d.x / 2 + (sx < 0 ? 0.18 : 0), sy * d.y / 2 + (sy < 0 ? 0.16 : 0), { fill: "#5b636b", w: 0.4 });
  } else if (k === "ccu") {
    const col = ld.colour || "#c8331f", st = ld.style || "closed", tint = mixHex(col, "#ffffff", 0.55);
    s.rect("LOAD", -d.x / 2, -d.y / 2, d.x / 2, d.y / 2, { fill: st === "closed" ? tint : "#eef0f2", w: 1.3, color: mixHex(col, "#000000", 0.35) });
    const t = 0.12;
    if (st !== "closed") s.rect("LOAD", -d.x / 2 + t, -d.y / 2 + t, d.x / 2 - t, d.y / 2 - t, { w: 0.6, color: mixHex(col, "#000000", 0.35) });
    else for (let x = -d.x / 2 + 0.35; x < d.x / 2 - 0.2; x += 0.35) s.poly("LOAD", [[x, -d.y / 2 + 0.06], [x, d.y / 2 - 0.06]], { w: 0.25 });
    if (st === "tankframe") { const R = Math.min(d.y, d.z) * 0.42; s.rect("LOAD", -d.x / 2 + 0.2, -R, d.x / 2 - 0.2, R, { fill: "#dfe3e7", w: 0.8 }); }
    if (st === "rack") { const n = Math.max(2, Math.round(d.x / 0.3)), m = Math.max(2, Math.round(d.y / 0.3)); for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) s.circle("LOAD", [-d.x / 2 + (i + 0.5) * d.x / n, -d.y / 2 + (j + 0.5) * d.y / m], Math.min(d.x / n, d.y / m) * 0.4, { fill: "#b9c0c7", w: 0.3 }); }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) s.rect("LOAD", sx * d.x / 2 - (sx > 0 ? 0.14 : 0), sy * d.y / 2 - (sy > 0 ? 0.14 : 0), sx * d.x / 2 + (sx < 0 ? 0.14 : 0), sy * d.y / 2 + (sy < 0 ? 0.14 : 0), { fill: mixHex(col, "#000000", 0.3), w: 0.3 });
  } else if (k === "tank") {
    const R = ld.D / 2, L = +ld.L, hd = Math.min(R * 0.5, L * 0.15), P = [];
    for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + Math.PI * i / 10; P.push([L / 2 - hd + hd * Math.cos(a), R * Math.sin(a)]); }
    for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + Math.PI * i / 10; P.push([-L / 2 + hd + hd * Math.cos(a), R * Math.sin(a)]); }
    s.poly("LOAD", P, { closed: true, fill: true, w: 1.2 });
    for (const sx of [-1, 1]) s.rect("LOAD", sx * L * 0.3 - 0.2, -R * 1.02, sx * L * 0.3 + 0.2, R * 1.02, { dash: [0.25, 0.15], w: 0.6 });
    s.poly("LOAD", [[-L / 2 + hd, 0], [L / 2 - hd, 0]], { dash: [0.4, 0.2], w: 0.4 });
  } else if (k === "beam") {
    s.rect("LOAD", -d.x / 2, -d.y / 2, d.x / 2, d.y / 2, { fill: true, w: 1.2 });
    if (o !== "side") s.poly("LOAD", [[-d.x / 2, 0], [d.x / 2, 0]], { w: 0.6, dash: [0.5, 0.25] });
    else for (const y of [-d.y / 2 + 0.06, d.y / 2 - 0.06]) s.poly("LOAD", [[-d.x / 2, y], [d.x / 2, y]], { w: 0.5 });
  } else if (k === "bag") {
    const col = ld.colour || "#ebe5cf", lc = ld.loopCol || "#2c6fbb", P = bagOutline(d.x / 2 * 1.04, d.y / 2 * 1.04);
    s.poly("LOAD", P, { closed: true, fill: col, w: 1.2, color: "#8a7f5c" });
    s.poly("LOAD", bagOutline(d.x / 2 * 0.86, d.y / 2 * 0.86), { closed: true, w: 0.4, dash: [0.12, 0.08], color: "#8a7f5c" });
    s.circle("LOAD", [0, 0], Math.min(d.x, d.y) * 0.16, { fill: "#d9d2b8", w: 0.6, color: "#8a7f5c" });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) s.circle("LOAD", [sx * d.x * 0.42, sy * d.y * 0.42], Math.min(d.x, d.y) * 0.09, { fill: lc, w: 0.5, color: lc });
  } else if (k === "frame") {
    s.rect("LOAD", -d.x / 2, -d.y / 2, d.x / 2, d.y / 2, { fill: "rgba(200,205,210,.35)", w: 1.6 });
    s.rect("LOAD", -d.x / 2 + 0.25, -d.y / 2 + 0.25, d.x / 2 - 0.25, d.y / 2 - 0.25, { w: 0.5 });
    const nb = Math.max(1, Math.round(d.x / 3)); for (let i = 1; i < nb; i++) { const x = -d.x / 2 + d.x * i / nb; s.poly("LOAD", [[x, -d.y / 2], [x, d.y / 2]], { w: 0.8 }); }
    s.poly("LOAD", [[-d.x / 2, -d.y / 2], [d.x / 2, d.y / 2]], { w: 0.4, dash: [0.3, 0.2] });
  } else {
    s.rect("LOAD", -d.x / 2, -d.y / 2, d.x / 2, d.y / 2, { fill: true, w: 1.2 });
    s.poly("LOAD", [[-d.x / 2, -d.y / 2], [d.x / 2, d.y / 2]], { w: 0.4 });
    s.poly("LOAD", [[-d.x / 2, d.y / 2], [d.x / 2, -d.y / 2]], { w: 0.4 });
  }
  // lifting points / spreader
  const n4 = ld.rig && (ld.rig.arr === "bridle4" || (ld.rig.arr === "spreader" && ld.rig.lower4));
  if (n4) for (const p of rigLiftPoints(ld, 4)) s.circle("RIGGING", p, 0.24, { fill: true });
  else if (ld.span > 0) {
    if (ld.spreader) s.rect("RIGGING", -ld.span / 2, -0.16, ld.span / 2, 0.16, { fill: true });
    for (const sx of [-1, 1]) s.circle("RIGGING", [sx * ld.span / 2, 0], 0.24, { fill: true });
  }
  const cg = nz(ld.cog);
  s.circle("RIGGING", [cg, 0], 0.35, { fill: "#ffffff", w: 1.2 });
  s.poly("RIGGING", [[cg - 0.5, 0], [cg + 0.5, 0]], { w: 0.6 }); s.poly("RIGGING", [[cg, -0.5], [cg, 0.5]], { w: 0.6 });
  return s;
}

// ---- SIDE / END profile: view "side" looks along local y (horizontal axis = x), "end" looks along local x (horizontal = y).
// Returns scene with horizontal u centred on load centre and z = 0 at the load bottom.
function loadProfile(ld, view) {
  normLoad(ld);
  const s = new Scene(), k = ld.kind, o = ld.orient, d = loadDims(ld);
  const w = view === "end" ? d.y : d.x, h = d.z;
  const circleEnd = () => {
    const R = h / 2;
    s.circle("LOAD", [0, R], R, { fill: true, w: 1.3 });
    if (k === "reel") {
      s.circle("LOAD", [0, R], R - 0.2, { w: 0.6 }); const cr = nz(ld.core) / 2;
      s.circle("LOAD", [0, R], cr, { w: 0.8 }); s.circle("LOAD", [0, R], Math.max(0.2, (typeof trunnionD === "function" ? trunnionD(ld) : cr) / 2), { fill: "#dfe3e7", w: 1.1 });
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; s.poly("LOAD", [[cr * Math.cos(a), R + cr * Math.sin(a)], [(R - 0.25) * Math.cos(a), R + (R - 0.25) * Math.sin(a)]], { w: 0.4 }); }
    } else if (k === "cyl") s.circle("LOAD", [0, R], Math.max(0.05, R - 0.12), { w: 0.5 });
  };
  if (k === "reel") {
    if (o === "flat") { s.rect("LOAD", -w / 2, 0, w / 2, h, { fill: true, w: 1.3 }); for (const z of [0.25, h - 0.25]) s.poly("LOAD", [[-w / 2, z], [w / 2, z]], { w: 0.5 }); }
    else if (view === "end") circleEnd();
    else {
      const FW = nz(ld.FW), W = Math.max(nz(ld.W), FW), R = h / 2;
      s.rect("LOAD", -FW / 2, 0, FW / 2, h, { fill: true, w: 1.3 });
      for (const sx of [-1, 1]) s.rect("LOAD", sx > 0 ? FW / 2 - 0.25 : -FW / 2, 0, sx > 0 ? FW / 2 : -FW / 2 + 0.25, h, { fill: "#c9ced4" });
      if (W > FW) for (const sx of [-1, 1]) s.rect("LOAD", sx > 0 ? FW / 2 : -W / 2, R - 0.2, sx > 0 ? W / 2 : -FW / 2, R + 0.2, { fill: "#9aa3ad", w: 0.6 });
      for (const z of [0.28, 0.55, 1.45, 1.72]) s.poly("LOAD", [[-FW / 2 + 0.3, z * R], [FW / 2 - 0.3, z * R]], { dash: [0.3, 0.15], w: 0.5 });
    }
  } else if (k === "silo") {
    const cone = nz(ld.cone), legs = nz(ld.legs), D = nz(ld.D);
    if (o === "horizontal") {
      if (view === "end") circleEnd();
      else {
        const L = nz(ld.H), R = D / 2, shellEnd = L / 2 - cone - legs;
        s.rect("LOAD", -L / 2, 0, shellEnd, D, { fill: true, w: 1.3 });
        s.poly("LOAD", [[shellEnd, 0], [shellEnd + cone, R - D * 0.075], [shellEnd + cone, R + D * 0.075], [shellEnd, D]], { closed: true, fill: true, w: 1.1 });
        if (legs > 0) for (const z of [0.1 * D, 0.9 * D]) s.poly("LOAD", [[shellEnd, z], [L / 2, z]], { w: 1.2 });
        s.poly("LOAD", [[-L / 2 + 0.3, 0], [-L / 2 + 0.3, D]], { w: 0.5 });
      }
    } else {
      const H = nz(ld.H), top = H, shellBot = legs + cone;
      s.rect("LOAD", -D / 2, shellBot, D / 2, top, { fill: true, w: 1.3 });
      s.poly("LOAD", [[-D / 2, shellBot], [-D * 0.075, legs], [D * 0.075, legs], [D / 2, shellBot]], { closed: true, fill: true, w: 1.1 });
      if (legs > 0) for (const sx of [-1, 1]) { s.poly("LOAD", [[sx * D * 0.42, shellBot], [sx * D * 0.48, 0]], { w: 1.4 }); }
      if (legs > 0) s.poly("LOAD", [[-D * 0.45, legs * 0.35], [D * 0.45, legs * 0.35]], { w: 0.5 });
      s.poly("LOAD", [[-D / 2 + 0.1, top - 0.3], [D / 2 - 0.1, top - 0.3]], { w: 0.5 });
    }
  } else if (k === "cyl") {
    if (o === "vertical") s.rect("LOAD", -w / 2, 0, w / 2, h, { fill: true, w: 1.3 });
    else if (view === "end") circleEnd();
    else s.rect("LOAD", -w / 2, 0, w / 2, h, { fill: true, w: 1.3 });
  } else if (k === "container") {
    s.rect("LOAD", -w / 2, 0, w / 2, h, { fill: "#c9d6e3", w: 1.3 });
    if (view === "side") for (let x = -w / 2 + 0.3; x < w / 2 - 0.2; x += 0.3) s.poly("LOAD", [[x, 0.15], [x, h - 0.15]], { w: 0.25 });
    else { s.poly("LOAD", [[0, 0.1], [0, h - 0.1]], { w: 0.6 }); for (const x of [-w / 4, w / 4]) s.poly("LOAD", [[x, 0.25], [x, h - 0.25]], { w: 0.5 }); }
    for (const sx of [-1, 1]) for (const z of [0, h - 0.12]) s.rect("LOAD", sx * w / 2 - (sx > 0 ? 0.18 : 0), z, sx * w / 2 + (sx < 0 ? 0.18 : 0), z + 0.12, { fill: "#5b636b", w: 0.4 });
    s.rect("LOAD", -w / 2, h - 0.15, w / 2, h, { w: 0.5 }); s.rect("LOAD", -w / 2, 0, w / 2, 0.15, { w: 0.5 });
  } else if (k === "ccu") {
    const col = ld.colour || "#c8331f", st = ld.style || "closed", dk = mixHex(col, "#000000", 0.35), t = 0.12;
    if (st === "closed" || st === "open" || st === "half" || st === "basket") {
      s.rect("LOAD", -w / 2, 0, w / 2, h, { fill: col, w: 1.2, color: dk });
      for (let x = -w / 2 + 0.3; x < w / 2 - 0.2; x += 0.3) s.poly("LOAD", [[x, t], [x, h - t]], { w: 0.25, color: dk });
      s.rect("LOAD", -w / 2, h - t, w / 2, h, { fill: dk, w: 0.3, color: dk }); s.rect("LOAD", -w / 2, 0, w / 2, t, { fill: dk, w: 0.3, color: dk });
      if (st === "closed" && view === "end") { s.poly("LOAD", [[0, t], [0, h - t]], { w: 0.8, color: dk }); for (const x of [-w / 4, w / 4]) s.poly("LOAD", [[x, t + 0.2], [x, h - t - 0.2]], { w: 0.6, color: dk }); }
      if (st !== "closed") s.poly("LOAD", [[-w / 2 + 0.2, h - 0.35], [w / 2 - 0.2, h - 0.35]], { w: 0.5, color: "#ffffff" });
      for (const sx of [-1, 1]) s.rect("LOAD", sx > 0 ? w / 2 - t : -w / 2, 0, sx > 0 ? w / 2 : -w / 2 + t, h, { fill: dk, w: 0.3, color: dk });
    } else {
      // open frame (tank frame / gas rack) with posts, rails and the contents
      if (st === "tankframe") { const R = Math.min(view === "end" ? w : h, h) * 0.42, zc = h / 2; if (view === "end") s.circle("LOAD", [0, zc], R, { fill: "#dfe3e7", w: 1 }); else { s.rect("LOAD", -w / 2 + 0.25, zc - R, w / 2 - 0.25, zc + R, { fill: "#dfe3e7", w: 1 }); } }
      else { const n = Math.max(2, Math.round(w / 0.3)); for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; s.rect("LOAD", x - w / n * 0.38, t, x + w / n * 0.38, h - 0.35, { fill: "#b9c0c7", w: 0.4 }); s.circle("LOAD", [x, h - 0.3], w / n * 0.2, { fill: "#8a9199", w: 0.3 }); } }
      for (const [a, b, c2, d2] of [[-w / 2, 0, w / 2, t], [-w / 2, h - t, w / 2, h], [-w / 2, 0, -w / 2 + t, h], [w / 2 - t, 0, w / 2, h], [-w / 2, h * 0.5 - t / 2, w / 2, h * 0.5 + t / 2]]) s.rect("LOAD", a, b, c2, d2, { fill: col, w: 0.4, color: dk });
      s.poly("LOAD", [[-w / 2 + t, t], [0, h * 0.5 - t / 2]], { w: 1.2, color: col }); s.poly("LOAD", [[w / 2 - t, t], [0, h * 0.5 - t / 2]], { w: 1.2, color: col });
    }
    for (const sx of [-1, 1]) s.poly("LOAD", [[sx * (w / 2 - 0.1), h], [sx * (w / 2 - 0.1), h + 0.15]], { w: 2, color: dk });
  } else if (k === "tank") {
    const D = +ld.D, R = D / 2, sad = +ld.saddle || 0, L = +ld.L, hd = Math.min(R * 0.5, L * 0.15);
    if (view === "end") { s.circle("LOAD", [0, sad + R], R, { fill: true, w: 1.3 }); s.poly("LOAD", [[-R * 0.9, 0], [R * 0.9, 0], [R * 0.7, sad + R * 0.3], [-R * 0.7, sad + R * 0.3]], { closed: true, fill: "#9aa3ad", w: 0.9 }); }
    else {
      const P = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + Math.PI * i / 10; P.push([L / 2 - hd + hd * Math.cos(a), sad + R + R * Math.sin(a)]); }
      for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + Math.PI * i / 10; P.push([-L / 2 + hd + hd * Math.cos(a), sad + R + R * Math.sin(a)]); }
      s.poly("LOAD", P, { closed: true, fill: true, w: 1.3 });
      for (const x of [-L / 2 + hd, L / 2 - hd]) s.poly("LOAD", [[x, sad], [x, sad + D]], { w: 0.4, dash: [0.3, 0.2] });
      for (const sx of [-1, 1]) s.poly("LOAD", [[sx * L * 0.3 - 0.45, 0], [sx * L * 0.3 + 0.45, 0], [sx * L * 0.3 + 0.25, sad + R * 0.35], [sx * L * 0.3 - 0.25, sad + R * 0.35]], { closed: true, fill: "#9aa3ad", w: 0.9 });
    }
  } else if (k === "beam") {
    const fl = Math.max(0.03, (o === "side" ? +ld.W : +ld.H) * 0.08), side = o === "side";
    if ((view === "side") !== side) { s.rect("LOAD", -w / 2, 0, w / 2, h, { fill: true, w: 1.3 }); if (!side || view === "side") for (const z of [fl, h - fl]) s.poly("LOAD", [[-w / 2, z], [w / 2, z]], { w: 0.5 }); for (let x = -w / 2 + 1.5; x < w / 2 - 1; x += 3) s.poly("LOAD", [[x, fl], [x, h - fl]], { w: 0.4 }); }
    else if (view === "end") { const W = w, H = h, tw = Math.max(0.02, W * 0.08); s.poly("LOAD", side ? [[0, 0], [H * 0 + fl, 0], [fl, H / 2 - tw / 2], [W, H / 2 - tw / 2], [W, H / 2 + tw / 2], [fl, H / 2 + tw / 2], [fl, H], [0, H]].map(p => [p[0] - W / 2, p[1]]) : [[-W / 2, 0], [W / 2, 0], [W / 2, fl], [tw / 2, fl], [tw / 2, H - fl], [W / 2, H - fl], [W / 2, H], [-W / 2, H], [-W / 2, H - fl], [-tw / 2, H - fl], [-tw / 2, fl], [-W / 2, fl]], { closed: true, fill: true, w: 1.2 }); }
    else { s.rect("LOAD", -w / 2, 0, w / 2, h, { fill: true, w: 1.3 }); for (const y of [fl, h - fl]) s.poly("LOAD", [[-w / 2, y], [w / 2, y]], { w: 0.5 }); }
  } else if (k === "bag") {
    const col = ld.colour || "#ebe5cf", lc = ld.loopCol || "#2c6fbb", b = w * 0.05, P = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; P.push([-w / 2 - b * Math.sin(Math.PI * t) - (t < 0.1 ? 0 : 0), h * t]); }
    const R = P.map(p => [-p[0], p[1]]).reverse();
    s.poly("LOAD", [...P.map(p => [p[0] + (p[1] < 0.08 ? 0.04 : 0), p[1]]), ...R], { closed: true, fill: col, w: 1.2, color: "#8a7f5c" });
    for (const z of [h * 0.33, h * 0.66]) s.poly("LOAD", [[-w / 2 + 0.05, z], [w / 2 - 0.05, z]], { w: 0.3, dash: [0.08, 0.06], color: "#8a7f5c" });
    s.rect("LOAD", -w * 0.1, h, w * 0.1, h + 0.08, { fill: "#d9d2b8", w: 0.5, color: "#8a7f5c" });
    const lh = ld.loops != null && ld.loops !== "" ? +ld.loops : 0.3;
    for (const sx of [-1, 1]) { const x0 = sx * w * 0.46, x1 = sx * w * 0.3, A = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; A.push([(x0 + x1) / 2 + (x0 - x1) / 2 * Math.cos(a), h + lh * Math.sin(a)]); } s.poly("LOAD", A, { w: 2.2, color: lc }); }
  } else if (k === "frame") {
    const t = 0.22;
    s.rect("LOAD", -w / 2, 0, w / 2, h, { fill: "rgba(200,205,210,.25)", w: 0.5 });
    for (const [a, b, c, dd] of [[-w / 2, 0, w / 2, t], [-w / 2, h - t, w / 2, h], [-w / 2, 0, -w / 2 + t, h], [w / 2 - t, 0, w / 2, h]]) s.rect("LOAD", a, b, c, dd, { fill: "#8a9199", w: 0.8 });
    const nb = Math.max(1, Math.round(w / 3)); for (let i = 1; i < nb; i++) { const x = -w / 2 + w * i / nb; s.rect("LOAD", x - t / 2, t, x + t / 2, h - t, { fill: "#8a9199", w: 0.6 }); }
    s.poly("LOAD", [[-w / 2 + t, t], [-w / 2 + w / nb - t / 2, h - t]], { w: 1.2, color: "#6b7278" });
  } else {
    s.rect("LOAD", -w / 2, 0, w / 2, h, { fill: true, w: 1.3 });
    s.poly("LOAD", [[-w / 2, 0], [w / 2, h]], { w: 0.35 }); s.poly("LOAD", [[-w / 2, h], [w / 2, 0]], { w: 0.35 });
  }
  return { s, w, h };
}

// ---- elevation of load + rigging hanging from the hook (hook bottom at hookY, hook at horizontal R)
function loadRigHeight(ld, tandem) {
  normLoad(ld);
  const rr = ld.rig && ld.rig.arr ? solveRig(ld) : null;
  if (rr) return rr.hookZ;
  return tandem ? nz(ld.tandemRig) + liftPointZ(ld) : nz(ld.hookToTop) + loadDims(ld).z;
}
function loadSideRig(ld, hookY, R, view, tandem, side, point) {
  normLoad(ld);
  const s = new Scene(), d = loadDims(ld), zl = liftPointZ(ld);
  const rr = ld.rig && ld.rig.arr ? solveRig(ld) : null;
  if (rr) {
    const hp = rr.hookPts.length > 1 ? rr.hookPts[point === "B" ? 1 : 0] : rr.hookPts[0];
    const bottom = hookY - rr.hookZ, ox = R - (view === "end" ? hp[1] : hp[0]);
    s.add(loadProfile(ld, view).s, 0, ox, bottom);
    rig2D(s, ld, rr, view, ox, bottom);
    return { s, bottom };
  }
  const along = view === "side";
  if (tandem) {
    // hook directly over one lifting point; load extends away from the crane in side view
    const off = along && ld.span ? (side || 1) * ld.span / 2 : 0;
    const zLP = hookY - nz(ld.tandemRig), bottom = zLP - zl;
    s.poly("RIGGING", [[R, hookY], [R, zLP]], { w: 1.2 });
    s.circle("RIGGING", [R, zLP], 0.18, { fill: true });
    s.add(loadProfile(ld, view).s, 0, R + off, bottom);
    return { s, bottom };
  }
  const zTop = hookY - nz(ld.hookToTop), bottom = zTop - d.z, zLP = bottom + zl;
  const half = along ? (ld.span || 0) / 2 : 0;
  if (ld.spreader && ld.span > 0) {
    const ySp = hookY - nz(ld.hookToSpreader);
    if (along) {
      for (const sx of [-1, 1]) { s.poly("RIGGING", [[R, hookY], [R + sx * half, ySp + 0.2]], { w: 1.2 }); s.poly("RIGGING", [[R + sx * half, ySp - 0.2], [R + sx * half, zLP]], { w: 0.9 }); s.circle("RIGGING", [R + sx * half, zLP], 0.15, { fill: true }); }
      s.rect("RIGGING", R - half - 0.2, ySp - 0.2, R + half + 0.2, ySp + 0.2, { fill: true, w: 1.2 });
    } else {
      s.poly("RIGGING", [[R, hookY], [R, ySp + 0.2]], { w: 1.2 }); s.rect("RIGGING", R - 0.2, ySp - 0.2, R + 0.2, ySp + 0.2, { fill: true });
      s.poly("RIGGING", [[R, ySp - 0.2], [R, zLP]], { w: 0.9 });
    }
  } else if (half > 0) {
    for (const sx of [-1, 1]) { s.poly("RIGGING", [[R, hookY], [R + sx * half, zLP]], { w: 1.1 }); s.circle("RIGGING", [R + sx * half, zLP], 0.15, { fill: true }); }
  } else {
    const hw = Math.min((along ? d.x : d.y) / 2, 3);
    if (zl < d.z - 1e-6) s.poly("RIGGING", [[R, hookY], [R, zLP]], { w: 1.1 });
    else for (const sx of [-1, 1]) s.poly("RIGGING", [[R, hookY], [R + sx * hw * 0.9, zLP]], { w: 1.1 });
  }
  s.add(loadProfile(ld, view).s, 0, R, bottom);
  return { s, bottom };
}

// ---- builder preview: top, side and end views with dimensions
function loadViewsScene(ld) {
  normLoad(ld);
  const d = loadDims(ld), gap = 3;
  const s = new Scene();
  const top = loadPlan(ld), side = loadProfile(ld, "side"), end = loadProfile(ld, "end");
  const dim = (x0, y0, x1, y1, txt, vertical) => {
    s.poly("DIMS", [[x0, y0], [x1, y1]], { w: 0.6 });
    if (vertical) { s.poly("DIMS", [[x0 - 0.2, y0], [x0 + 0.2, y0]], { w: 0.6 }); s.poly("DIMS", [[x1 - 0.2, y1], [x1 + 0.2, y1]], { w: 0.6 }); s.text("DIMS", [x0 - 0.35, (y0 + y1) / 2], txt, 0.42, { rot: 90 }); }
    else { s.poly("DIMS", [[x0, y0 - 0.2], [x0, y0 + 0.2]], { w: 0.6 }); s.poly("DIMS", [[x1, y1 - 0.2], [x1, y1 + 0.2]], { w: 0.6 }); s.text("DIMS", [(x0 + x1) / 2, y0 - 0.55], txt, 0.42); }
  };
  // side view at origin (bottom z=0), end view to the right, top view below side
  s.add(side.s, 0, 0, 0);
  s.poly("GROUND", [[-d.x / 2 - 0.6, 0], [d.x / 2 + 0.6, 0]], { w: 0.8 });
  dim(-d.x / 2, -0.9, d.x / 2, -0.9, `${fx(d.x, 2)} m`);
  dim(-d.x / 2 - 0.9, 0, -d.x / 2 - 0.9, d.z, `${fx(d.z, 2)} m`, true);
  s.text("TEXT", [0, d.z + 0.9], "SIDE", 0.55, { bold: true });
  const ex = d.x / 2 + gap + d.y / 2 + 1;
  s.add(end.s, 0, ex, 0);
  s.poly("GROUND", [[ex - d.y / 2 - 0.6, 0], [ex + d.y / 2 + 0.6, 0]], { w: 0.8 });
  dim(ex - d.y / 2, -0.9, ex + d.y / 2, -0.9, `${fx(d.y, 2)} m`);
  s.text("TEXT", [ex, d.z + 0.9], "END", 0.55, { bold: true });
  const ty = -d.y / 2 - gap - 0.6;
  s.add(top, 0, 0, ty);
  s.text("TEXT", [0, ty - d.y / 2 - 1.0], "TOP", 0.55, { bold: true });
  if (ld.span > 0) dim(-ld.span / 2, ty + d.y / 2 + 0.7, ld.span / 2, ty + d.y / 2 + 0.7, `A–B ${fx(ld.span, 2)} m`);
  s.text("RIGGING", [-(ld.span || 0) / 2, ty - 0.7], ld.span > 0 ? "A" : "", 0.45, { bold: true });
  s.text("RIGGING", [(ld.span || 0) / 2, ty - 0.7], ld.span > 0 ? "B" : "", 0.45, { bold: true });
  return s;
}

// rounded-square outline of a filled bulk bag
function bagOutline(a, b, n = 28) { const P = []; for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n, c = Math.cos(t), sn = Math.sin(t); P.push([a * Math.sign(c) * Math.pow(Math.abs(c), 0.35), b * Math.sign(sn) * Math.pow(Math.abs(sn), 0.35)]); } return P; }
