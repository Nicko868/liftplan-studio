// ================= Load library: standard cargo, containers, reels, tanks, tubulars, structural and plant =================
// Dimensions are typical – always check the unit's data plate / certificate. weight = max gross (t) used as the planning weight.
const CCU = (name, style, L, W, H, tare, mgw, colour, extra = {}) => ({ cat: "Offshore cargo units", kind: "ccu", style, name, L, W, H, tare, mgw, weight: mgw, colour, lpType: "corners", span: +(L - 0.2).toFixed(2), spanY: +(W - 0.2).toFixed(2), ...extra });
const BAG = (name, L, W, H, swl, colour, loopCol, extra = {}) => ({ cat: "Bulk bags (FIBC)", kind: "bag", name, L, W, H, weight: swl, mgw: swl, tare: 0.003, loops: 0.3, colour, loopCol, lpType: "corners", nLP: 4, span: +(L * 0.86).toFixed(2), spanY: +(W * 0.86).toFixed(2), ...extra });
const LOAD_LIBRARY = [
  BAG("Bulk bag 500 kg (0.5 m³)", 0.9, 0.9, 0.8, 0.5, "#ebe5cf", "#2c6fbb"),
  BAG("Bulk bag 1 t (1 m³)", 0.95, 0.95, 1.1, 1.0, "#ebe5cf", "#2c6fbb"),
  BAG("Bulk bag 1.5 t (1.5 m³)", 1.0, 1.0, 1.5, 1.5, "#ebe5cf", "#e67e22"),
  BAG("Bulk bag 2 t (2 m³)", 1.1, 1.1, 1.6, 2.0, "#ebe5cf", "#c0392b"),
  BAG("Cement bag 1.5 t", 0.95, 0.95, 1.25, 1.5, "#d7d9db", "#2e8b57"),
  BAG("Barite / bentonite bag 1.5 t", 0.95, 0.95, 1.2, 1.5, "#ebe5cf", "#6c3fb5"),
  BAG("Sand / aggregate bag 1 t", 0.9, 0.9, 1.0, 1.0, "#f2f2ee", "#2c6fbb"),
  CCU("10' half height", "half", 2.99, 2.44, 1.30, 1.4, 10, "#c8331f"),
  CCU("20' half height", "half", 6.06, 2.44, 1.30, 2.6, 20, "#c8331f"),
  CCU("Cargo basket 6 m", "basket", 6.0, 2.5, 1.1, 2.0, 10, "#c8331f"),
  CCU("Cargo basket 8 m", "basket", 8.0, 2.5, 1.1, 2.6, 10, "#c8331f"),
  CCU("Cargo basket 12 m", "basket", 12.0, 2.5, 1.1, 4.0, 12, "#c8331f"),
  CCU("10' open top", "open", 2.99, 2.44, 2.59, 1.8, 10, "#c8331f"),
  CCU("20' open top", "open", 6.06, 2.44, 2.59, 2.8, 20, "#c8331f"),
  CCU("Mini container", "closed", 2.0, 1.6, 2.2, 0.9, 5, "#c8331f"),
  CCU("10' offshore container", "closed", 2.99, 2.44, 2.59, 2.0, 10, "#c8331f"),
  CCU("20' offshore container", "closed", 6.06, 2.44, 2.59, 3.4, 20, "#c8331f"),
  CCU("Tool box / workshop 8'", "closed", 2.44, 2.0, 2.3, 1.5, 5, "#c8331f"),
  CCU("Waste skip", "half", 2.0, 1.6, 1.3, 0.9, 5, "#c8331f"),
  CCU("Tank (framed)", "tankframe", 2.44, 2.44, 2.44, 2.5, 10, "#1f5fa8"),
  CCU("Offshore tank", "tankframe", 3.0, 2.44, 2.6, 3.8, 15, "#c8331f"),
  CCU("Heli fuel tank", "tankframe", 2.44, 2.44, 2.6, 3.1, 6.4, "#e8c21a"),
  CCU("Gas rack", "rack", 1.25, 1.25, 2.2, 0.7, 2.5, "#4a5159"),
  CCU("Gas rack – 16 cylinders", "rack", 2.0, 1.25, 2.2, 1.0, 4.0, "#4a5159"),
  ...Object.entries({ "10ft": [1.3, 10.16], "20ft": [2.2, 30.48], "20ft HC": [2.3, 30.48], "40ft": [3.75, 30.48], "40ft HC": [3.9, 30.48] }).map(([size, [tare, mgw]]) => {
    const [L, W, H] = CONTAINER_SIZES[size]; return { cat: "ISO containers", kind: "container", size, name: `${size} ISO container`, L, W, H, tare, mgw, weight: mgw, lpType: "corners", span: +(L - 0.205).toFixed(3), spanY: +(W - 0.179).toFixed(3) };
  }),
  { cat: "Reels & drums", kind: "reel", orient: "upright", name: "Cable drum Ø1.6 m", D: 1.6, FW: 1.1, W: 1.3, core: 0.8, weight: 2.5, span: 1.2, lpType: "axis" },
  { cat: "Reels & drums", kind: "reel", orient: "upright", name: "Cable reel Ø3 m", D: 3.0, FW: 2.0, W: 2.3, core: 1.4, weight: 12, span: 2.2, lpType: "axis" },
  { cat: "Reels & drums", kind: "reel", orient: "upright", name: "Cable reel Ø4 m", D: 4.0, FW: 2.6, W: 3.0, core: 1.8, weight: 25, span: 2.8, lpType: "axis" },
  { cat: "Reels & drums", kind: "reel", orient: "upright", name: "Cable reel Ø5 m", D: 5.0, FW: 3.2, W: 3.6, core: 2.2, weight: 45, span: 3.4, lpType: "axis" },
  { cat: "Reels & drums", kind: "reel", orient: "upright", name: "Large cable reel Ø6 m", D: 6.0, FW: 4.0, W: 4.5, core: 2.6, weight: 80, span: 4.2, lpType: "axis" },
  { cat: "Reels & drums", kind: "reel", orient: "flat", name: "Hose / cable reel lying flat Ø3 m", D: 3.0, FW: 1.8, W: 1.8, core: 1.2, weight: 8, span: 2.4, lpType: "top" },
  { cat: "Tanks & vessels", kind: "tank", orient: "horizontal", name: "Horizontal tank 20 m³", D: 2.4, L: 5.5, saddle: 0.6, weight: 6, span: 3.5, lpType: "top" },
  { cat: "Tanks & vessels", kind: "tank", orient: "horizontal", name: "Horizontal tank 50 m³", D: 3.0, L: 8.0, saddle: 0.7, weight: 12, span: 5.0, lpType: "top" },
  { cat: "Tanks & vessels", kind: "tank", orient: "horizontal", name: "Pressure vessel Ø2 × 8 m", D: 2.0, L: 8.0, saddle: 0.6, weight: 18, span: 5.0, lpType: "top" },
  // Elton LNG (Dakar) – POS H025-POS-CON-001 fig. 6: outer shell ID 6800 × 12, 17.82 m tan–tan, 2:1 heads (≈20.74 m over the heads, ≈23 m with the
  // front piping), saddles 11.42 m c/c, CoG 8.86 m from the front T.L., ≈160 t. Four lugs on the shell sides, two at each end, ≈12.18 m apart.
  { cat: "Tanks & vessels", kind: "tank", orient: "horizontal", name: "LNG storage tank 160 t – Ø6.8 × 20.7 m, 4 side lugs", D: 6.824, L: 20.742, saddle: 0.30, weight: 159.55, span: 12.4, spanY: 5.04, approx: { span: "scaled from vendor drawing H-107 rev A – vendor to confirm", spanY: "worked out from the lug angle", lpZ: "worked out from the lug angle" }, nLP: 4, lpType: "custom", lpZ: 6.23, cog: 0.05, cogZ: 3.712, lugHole: 0.100, lugThk: 0.040, lugW: 0.600, lugH: 0.300, lugR: 0.075, lugHoleZ: 0.150, lugPad: 0.750, lugAng: 45, src: "vendor GA drawing + transport drawing 1072522008-H-107 rev A", hookToTop: 8 },
  { cat: "Tanks & vessels", kind: "silo", orient: "upright", name: "Silo 30 m³ (upright)", D: 3.0, H: 10.0, cone: 2.2, legs: 2.0, weight: 6, span: 2.6, lpType: "top" },
  { cat: "Tanks & vessels", kind: "silo", orient: "horizontal", name: "Silo 30 m³ (lying down)", D: 3.0, H: 10.0, cone: 2.2, legs: 2.0, weight: 6, span: 5.0, lpType: "top" },
  { cat: "Pipes & tubulars", kind: "cyl", orient: "horizontal", name: "Pipe 20\" × 12 m", D: 0.508, L: 12.2, weight: 1.9, span: 7.0, lpType: "wrap" },
  { cat: "Pipes & tubulars", kind: "cyl", orient: "horizontal", name: "Casing 13-3/8\" × 12 m", D: 0.34, L: 12.2, weight: 1.2, span: 7.0, lpType: "wrap" },
  { cat: "Pipes & tubulars", kind: "cyl", orient: "horizontal", name: "Pipe 36\" × 12 m", D: 0.914, L: 12.2, weight: 5.4, span: 7.0, lpType: "wrap" },
  { cat: "Pipes & tubulars", kind: "box", name: "Pipe bundle (12 m)", L: 12.2, W: 1.2, H: 0.8, weight: 10, span: 7.0, spanY: 0, lpType: "wrap" },
  { cat: "Pipes & tubulars", kind: "cyl", orient: "horizontal", name: "Pile Ø1.5 × 30 m", D: 1.5, L: 30, weight: 45, span: 18, lpType: "top" },
  { cat: "Pipes & tubulars", kind: "cyl", orient: "vertical", name: "Pile Ø1.5 × 30 m (upending)", D: 1.5, L: 30, weight: 45, span: 0, lpType: "top" },
  { cat: "Structural", kind: "beam", orient: "flat", name: "Universal beam 610 × 12 m", L: 12, H: 0.61, W: 0.23, weight: 1.5, span: 7.0, lpType: "top" },
  { cat: "Structural", kind: "beam", orient: "flat", name: "Plate girder 1.5 m × 20 m", L: 20, H: 1.5, W: 0.5, weight: 12, span: 12, lpType: "top" },
  { cat: "Structural", kind: "frame", name: "Skid / module 6 × 3 × 3 m", L: 6, W: 3, H: 3, weight: 15, span: 5.6, spanY: 2.6, lpType: "corners" },
  { cat: "Structural", kind: "frame", name: "Pipe-rack module 12 × 4 × 4 m", L: 12, W: 4, H: 4, weight: 40, span: 11, spanY: 3.6, lpType: "corners" },
  { cat: "Structural", kind: "box", name: "Precast concrete panel 6 × 3 m", L: 6, W: 0.25, H: 3, weight: 11, span: 3.6, spanY: 0, lpType: "top" },
  { cat: "Plant & equipment", kind: "container", size: "20ft", name: "Generator set (20ft enclosure)", L: 6.058, W: 2.438, H: 2.896, weight: 18, lpType: "corners", span: 5.853, spanY: 2.259 },
  { cat: "Plant & equipment", kind: "box", name: "Transformer 45 t", L: 4.0, W: 2.5, H: 3.5, weight: 45, span: 3.2, spanY: 2.0, lpType: "top" },
  { cat: "Plant & equipment", kind: "frame", name: "Compressor skid", L: 4.0, W: 2.0, H: 2.2, weight: 6, span: 3.6, spanY: 1.6, lpType: "corners" },
  { cat: "Plant & equipment", kind: "box", name: "Switchroom / E-house 9 × 3.5 m", L: 9, W: 3.5, H: 3.6, weight: 30, span: 8, spanY: 3, lpType: "top" },
  { cat: "Plant & equipment", kind: "box", name: "Workboat 8 m", L: 8, W: 2.8, H: 2.5, weight: 7, span: 4.5, spanY: 0, lpType: "top" }
];
const LOAD_CATS = [...new Set(LOAD_LIBRARY.map(x => x.cat))];
function libToLoad(x) {
  const base = clone(LOAD_DEFAULTS[x.kind] || LOAD_DEFAULTS.box);
  const { cat, ...rest } = x;
  return normLoad({ ...base, ...rest, orient: x.orient || base.orient, libName: x.name });
}
// plans saved before the vendor drawing came in: a load picked from the library keeps its own copy of the old figures.
// Bring it up to date – new fields (lug, CoG height) are filled in, and figures still at the OLD library value are
// replaced with the vendor's; anything the planner changed by hand is left alone.
const LIB_UPDATES = { "LNG storage tank 160 t – Ø6.8 × 20.7 m, 4 side lugs": { old: { saddle: 0.38, weight: 160, spanY: 4.6, lpZ: 6.3, span: [12.18, 12.1], src: "vendor GA drawing" } } };
{ const _nl = normLoad; normLoad = function (ld, ...a) {
    const r = _nl.call(this, ld, ...a);
    try { const u = ld && LIB_UPDATES[ld.libName || ld.name], lib = u && LOAD_LIBRARY.find(x => x.name === (ld.libName || ld.name));
      if (u && lib && (ld._libRev || 0) < 3) { for (const k of ["approx", "cogZ", "lugHole", "lugThk", "lugW", "lugH", "lugR", "lugHoleZ", "lugPad", "lugAng", "src"]) if (ld[k] == null && lib[k] != null) ld[k] = lib[k];
        // a value still at an earlier library figure (not one the user typed) moves to the current one
        for (const [k, v] of Object.entries(u.old)) if ([].concat(v).some(o => typeof o === "string" ? ld[k] === o : Math.abs((+ld[k] || 0) - o) < 1e-9)) { ld[k] = lib[k]; if (k === "span" && ld.approx && lib.approx) ld.approx = clone(lib.approx); }
        ld._libRev = 3; } } catch (e) { }
    return r; }; }
