// ===== Built-in crane models (metres, tonnes). Carrier frame: +y = carrier front, origin = slew centre.
const BUILTIN_CRANES = {
  GMK6400: {
    id: "GMK6400", name: "Grove GMK6400", short: "GMK6400", type: "at", cap: "400 t", maxAngle: 82, builtin: true,
    src: "Grove GMK6400 product guide",
    car: { front: 11.635, rear: -4.092, w: 3.0, axles: [8.85, 7.15, 3.65, 2.0, -0.45, -2.10], tyreR: 0.78, tyreW: 0.55, deckH: 1.95, cabLen: 2.5, cabH: 2.85, frameLow: 0.95 },
    or: { modes: { "100%": { spread: 8.5, pads: [[-1, 4.95], [1, 5.345], [-1, -3.75], [1, -3.355]] } }, float: 0.7 },
    up: { tail: 5.86, cwW: 5.48, cwD: 2.49, cwH: 3.2, cwShape: "arc", deckW: 2.9, deckFront: 2.3, baseH: 2.0, bodyH: 0.95, cab: { lat: [-2.65, -1.5], fwd: [-0.2, 2.35], h: 1.95 }, cwLabel: "15–135 t" },
    boom: { kind: "tele", pivot: [-2.4, 3.95], Lmin: 15.39, Lmax: 60.0, n: 7, D0: 1.55, W0: 1.2, cyl: [0.9, 0.4] },
    mass: { base: 72, cw: 135 },
    hookblocks: [[320, 3.5], [250, 3.0], [200, 2.4], [160, 1.8], [100, 1.3], [40, 0.85], [16, 0.45]]
  },
  LTM1250: {
    id: "LTM1250", name: "Liebherr LTM 1250-5.1", short: "LTM1250-5.1", type: "at", cap: "250 t", maxAngle: 83, builtin: true,
    src: "Liebherr LTM 1250-5.1 data sheet",
    car: { front: 9.56, rear: -4.27, w: 3.0, axles: [7.06, 4.31, 2.61, 0.155, -1.50], tyreR: 0.75, tyreW: 0.55, deckH: 1.95, cabLen: 2.3, cabH: 2.9, frameLow: 0.95 },
    or: { modes: { "100%": { spread: 8.294, pads: [[-1, 5.521], [1, 5.885], [-1, -3.807], [1, -3.423]] } }, float: 0.7 },
    up: { tail: 5.58, cwW: 6.4, cwD: 2.1, cwH: 2.6, cwShape: "arc", deckW: 2.8, deckFront: 2.4, baseH: 2.0, bodyH: 0.95, cab: { lat: [-2.55, -1.45], fwd: [0.0, 2.45], h: 1.95 }, cwLabel: "up to 88 t" },
    boom: { kind: "tele", pivot: [-1.62, 3.80], Lmin: 13.1, Lmax: 60.0, n: 7, D0: 1.45, W0: 1.1, cyl: [1.0, 0.4] },
    mass: { base: 60, cw: 88 },
    hookblocks: [[151, 2.0], [142.6, 1.7], [107.7, 1.6], [70.6, 1.45], [31.2, 0.84], [10.5, 0.5]],
    chartHint: "Import the T charts from the data sheet, pages 15–20."
  },
  XCA230: {
    id: "XCA230", name: "XCMG XCA230", short: "XCA230", type: "at", cap: "230 t", maxAngle: 82, builtin: true,
    src: "XCMG XCA230 physical information & load chart manual",
    car: { front: 9.68, rear: -4.01, w: 3.0, axles: [7.02, 4.38, 2.70, -0.11, -1.76], tyreR: 0.685, tyreW: 0.5, deckH: 1.9, cabLen: 2.4, cabH: 2.85, frameLow: 0.9 },
    or: { modes: { "Full 9.19 x 8.3": { spread: 8.3, pads: [[1, 5.87], [-1, 5.44], [1, -3.32], [-1, -3.71]] },
                   "Half 9.19 x 5.5": { spread: 5.5, pads: [[1, 5.87], [-1, 5.44], [1, -3.32], [-1, -3.71]] } }, float: 0.6 },
    up: { tail: 5.16, cwW: 3.4, cwD: 1.7, cwH: 2.0, cwShape: "rect", deckW: 2.7, deckFront: 2.4, baseH: 1.95, bodyH: 0.95, cab: { lat: [-2.5, -1.4], fwd: [-0.1, 2.3], h: 1.95 }, cwLabel: "0–80 t" },
    boom: { kind: "tele", pivot: [-2.34, 3.66], Lmin: 13.8, Lmax: 75.0, n: 7, D0: 1.4, W0: 1.05, cyl: [0.9, 0.4], steps: [0, 4.7, 9.4, 10.2], stepNames: ["0", "46%", "92%", "100%"] },
    mass: { base: 55, cw: 80 },
    hookblocks: [[160, 1.9], [85, 1.0], [40, 0.7], [12, 0.46]]
  },
  CC2800: {
    id: "CC2800", name: "Terex Demag CC 2800-1", short: "CC2800-1", type: "cr", cap: "600 t", maxAngle: 85, builtin: true,
    src: "Terex Demag CC 2800-1 data sheet (600 t abaque, pp. 4–8)",
    car: { len: 11.66, contact: 10.33, gauge: 8.4, shoe: 1.5, trackH: 1.685, carbodyH: 1.95 },
    // dimensions from the data sheet: ground clearance under the carbody, counterweight bottom / top, cab top,
    // boom pivot height, derrick (SL mast) foot radius, wider 2.0 m shoes option, transport base unit
    spec: { clear: 0.645, cwZ: [2.45, 5.52], cabTop: 3.74, pivotZ: 2.93, mastR: 9.6, superW: 3.0, cwHalf: 3.35, shoeAlt: 2.0, widthAlt: 10.4, base: { len: 7.85, lenA: 13.8, h: 3.26 } },
    or: null,
    up: { tail: 8.0, cwW: 6.7, cwD: 2.4, cwH: 3.0, cwShape: "plate", deckW: 3.0, deckFront: 2.0, baseH: 1.95, bodyH: 1.15, cab: { lat: [-3.0, -1.55], fwd: [2.2, 4.17], h: 1.9 }, cwLabel: "160–180 t + ZB 60 t" },
    boom: { kind: "lattice", pivot: [2.0, 2.93], Lmin: 24, Lmax: 84, W0: 2.97, D0: 2.79, foot: 12, head: 12, inserts: [3, 6, 12] },
    mass: { base: 200, cw: 160 },
    // superlift (SSL): 30 m SL mast (scaled from the data sheet p. 6), ballast pallet hanging at 11 / 13 / 15 m (variable SL 13–17 m),
    // 10 t plates 2.4 × 1.8 × 0.4 m in four stacks – pallet ≈ 3.6 m (radial) × 4.8 m, carried ≈ 0.5 m off the ground while lifting
    sl: { mast: 30, radii: [11, 13, 15, 17], tray: [3.6, 4.8], plate: 10, hang: 0.5 },
    hookblocks: [[600, 11.5, 44, 2], [400, 10.0, 28, 2], [160, 4.8, 11], [100, 3.6, 7], [48, 2.8, 3], [16, 0.9, 1]],
    chartHint: "Built-in: SH main boom (CW 240 t / 160 t) and SSL superlift charts from the data sheet."
  }
};

const LOAD_PRESETS = {
  reel: { kind: "reel", name: "Cable reel", weight: "", rigWeight: 0, D: 4.0, W: 3.0, FW: 2.6, span: 3.0, hookToSpreader: 4.0, spreaderToTop: 1.0, cog: 0 },
  box: { kind: "box", name: "Load", weight: "", rigWeight: 0, L: 6, W: 2.5, H: 2.6, rig: 5, span: 0, cog: 0 }
};

// ---- boom configuration helpers (telescopic sections / lattice inserts)
function teleInfo(C) {
  const b = C.boom, n = Math.max(1, (b.n || 5) - 1);
  const stroke = b.steps ? b.steps[b.steps.length - 1] : (b.Lmax - b.Lmin) / n;
  return { n, stroke, steps: b.steps || null, stepNames: b.stepNames || null, base: b.Lmin };
}
function latticeInfo(C) {
  const b = C.boom;
  const foot = b.foot != null ? +b.foot : b.Lmin / 2, head = b.head != null ? +b.head : b.Lmin - (b.foot != null ? +b.foot : b.Lmin / 2);
  return { foot, head, inserts: (b.inserts && b.inserts.length ? b.inserts : [3, 6, 12]).map(Number).sort((a, c) => a - c), Lmax: b.Lmax };
}
// default config for a target length
function boomCfgFor(C, L) {
  if (C.boom.kind === "tele") {
    const t = teleInfo(C), ext = Math.max(0, Math.min(t.n * t.stroke, L - t.base));
    return { ext: Array.from({ length: t.n }, () => Math.round(ext / t.n * 1000) / 1000) };
  }
  const li = latticeInfo(C); let rem = Math.max(0, L - li.foot - li.head); const ins = [];
  for (const len of [...li.inserts].reverse()) while (rem >= len - 1e-6) { ins.push(len); rem -= len; }
  return { inserts: ins };
}
function boomLength(C, cfg) {
  if (!cfg) return null;
  if (C.boom.kind === "tele") return Math.round((teleInfo(C).base + (cfg.ext || []).reduce((a, v) => a + (+v || 0), 0)) * 100) / 100;
  const li = latticeInfo(C); return Math.round((li.foot + li.head + (cfg.inserts || []).reduce((a, v) => a + (+v || 0), 0)) * 100) / 100;
}
// chart telescoping code (e.g. "000022") for a config, when the crane has discrete steps
function teleCode(C, cfg) {
  const t = teleInfo(C); if (!t.steps || !cfg?.ext) return null;
  let code = "";
  for (const e of cfg.ext) { const i = t.steps.findIndex(v => Math.abs(v - e) < 0.06); if (i < 0) return null; code += i; }
  return code;
}
function cfgFromCode(C, code) {
  const t = teleInfo(C); if (!t.steps) return null;
  const d = String(code).split("").map(Number); if (d.length !== t.n || d.some(x => isNaN(x) || x >= t.steps.length)) return null;
  return { ext: d.map(x => t.steps[x]) };
}
// boom joints along the boom (m from foot) for drawing
function boomJoints(C, cfg) {
  if (!cfg || C.boom.kind === "tele") return null;
  const li = latticeInfo(C), j = [li.foot]; let s = li.foot;
  for (const v of cfg.inserts || []) { s += +v; j.push(s); }
  return j;
}

// Build a full crane model from the simple spec form (used for uploaded / custom cranes)
function numList(v) { return String(v ?? "").split(/[,;\s]+/).filter(x => x.trim() !== "").map(Number).filter(x => !isNaN(x)); }
function modelFromSpec(sp) {
  const n = (v, d) => (v === "" || v == null || isNaN(+v)) ? d : +v;
  if (sp.type === "cr") {
    const tail = n(sp.tail, 7.5), cwD = n(sp.cwD, 2.4);
    return {
      id: sp.id, name: sp.name || "Custom crawler", short: sp.short || (sp.name || "CRANE").replace(/\s+/g, ""), type: "cr", cap: (sp.cap || "") + (sp.cap ? " t" : ""), maxAngle: n(sp.maxAngle, 85),
      src: sp.src || "User spec sheet", custom: true,
      car: { len: n(sp.trackLen, 10), ...(n(sp.trackContact, 0) > 0 ? { contact: n(sp.trackContact, 0) } : {}), gauge: n(sp.gauge, 7.5), shoe: n(sp.shoe, 1.3), trackH: 1.2, carbodyH: 1.9 },
      or: null,
      up: { tail, cwW: n(sp.cwW, 6), cwD, cwH: n(sp.cwH, 2.8), cwShape: "plate", deckW: 3.0, deckFront: 2.0, baseH: 1.9, bodyH: 1.1, cab: { lat: [-2.9, -1.5], fwd: [1.8, 3.8], h: 1.9 }, cwLabel: sp.cwLabel || "" },
      boom: { kind: "lattice", pivot: [n(sp.pivotX, 1.8), n(sp.pivotY, 2.9)], Lmin: n(sp.Lmin, 20), Lmax: n(sp.Lmax, 80), W0: n(sp.boomW, 2.4), D0: n(sp.boomW, 2.4),
        foot: sp.footL === "" || sp.footL == null ? null : +sp.footL, head: sp.headL === "" || sp.headL == null ? null : +sp.headL, inserts: numList(sp.insertsTxt) },
      mass: { base: n(sp.baseMass, 150), cw: n(sp.cwMass, 100) },
      hookblocks: sp.hookblocks || [], spec: sp
    };
  }
  const front = n(sp.front, 9.5), rear = n(sp.rear, -4.0);
  const axles = (Array.isArray(sp.axles) ? sp.axles : String(sp.axles || "").split(/[,;\s]+/)).filter(v => String(v).trim() !== "").map(Number).filter(v => !isNaN(v));
  const modes = {};
  (sp.outriggers || []).forEach(o => {
    const s = n(o.spread, 8), fl = n(o.fl, 5), fr = n(o.fr, fl), rl = n(o.rl, -3.5), rr = n(o.rr, rl);
    modes[o.name || `${s} m`] = { spread: s, pads: [[-1, fl], [1, fr], [-1, -Math.abs(rl)], [1, -Math.abs(rr)]] };
  });
  if (!Object.keys(modes).length) modes["100%"] = { spread: 8, pads: [[-1, 5], [1, 5], [-1, -3.5], [1, -3.5]] };
  const tail = n(sp.tail, 5.2);
  return {
    id: sp.id, name: sp.name || "Custom crane", short: sp.short || (sp.name || "CRANE").replace(/\s+/g, ""), type: "at", cap: (sp.cap || "") + (sp.cap ? " t" : ""), maxAngle: n(sp.maxAngle, 82),
    src: sp.src || "User spec sheet", custom: true,
    car: { front, rear, w: n(sp.width, 3.0), axles: axles.length ? axles : [front - 2.5, front - 4.2, 1.5, -0.2, -1.8], tyreR: n(sp.tyreD, 1.4) / 2, tyreW: 0.52, deckH: 1.9, cabLen: 2.4, cabH: 2.85, frameLow: 0.9 },
    or: { modes, float: n(sp.float, 0.6) },
    up: { tail, cwW: n(sp.cwW, 4.5), cwD: n(sp.cwD, 2.0), cwH: n(sp.cwH, 2.4), cwShape: "arc", deckW: 2.8, deckFront: 2.3, baseH: 1.95, bodyH: 0.95, cab: { lat: [-2.5, -1.4], fwd: [-0.1, 2.3], h: 1.95 }, cwLabel: sp.cwLabel || "" },
    boom: { kind: "tele", pivot: [n(sp.pivotX, -2.2), n(sp.pivotY, 3.8)], Lmin: n(sp.Lmin, 13), Lmax: n(sp.Lmax, 60), n: Math.round(n(sp.sections, 6)), D0: 1.45, W0: 1.1, cyl: [0.9, 0.4],
      steps: numList(sp.teleSteps).length > 1 ? numList(sp.teleSteps) : null },
    mass: { base: n(sp.baseMass, 60), cw: n(sp.cwMass, 60) },
    hookblocks: sp.hookblocks || [], spec: sp
  };
}
