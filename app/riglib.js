// ================= Rigging library, rigging arrangements and the rigging solver =================
// Units: tonnes, metres. wpm = sling weight per metre (t/m).
const RIG_TYPES = {
  masterlink: { name: "Master link", group: "Links & hooks", len: true },
  shackle: { name: "Shackle", group: "Shackles", len: true },
  hook: { name: "Hook (sling / eye hook)", group: "Links & hooks", len: true },
  sling_wire: { name: "Wire rope sling", group: "Slings", sling: true },
  sling_round: { name: "Round sling", group: "Slings", sling: true },
  sling_web: { name: "Webbing sling", group: "Slings", sling: true },
  sling_chain: { name: "Chain sling leg", group: "Slings", sling: true },
  spreader: { name: "Spreader beam / bar", group: "Beams", len: true },
  other: { name: "Other (swivel, turnbuckle, clamp…)", group: "Other", len: true }
};
// generic starter items – typical catalogue ratings; replace with your own certified equipment
const RG = (id, type, name, swl, weight, len, extra = {}) => ({ id, type, name, swl, weight, len, builtin: true, ...extra });
const RIG_BUILTIN = [
  ...[[2, 0.36, 0.048, '1/2"'], [3.25, 0.76, 0.060, '5/8"'], [4.75, 1.23, 0.071, '3/4"'], [6.5, 1.79, 0.084, '7/8"'], [8.5, 2.57, 0.095, '1"'], [9.5, 3.75, 0.108, '1-1/8"'], [12, 5.31, 0.119, '1-1/4"'], [13.5, 7.18, 0.133, '1-3/8"'], [17, 9.43, 0.146, '1-1/2"'], [25, 15.4, 0.178, '1-3/4"'], [35, 23.9, 0.197, '2"'], [55, 44.7, 0.267, '2-1/2"'], [85, 69.9, 0.330, '3"']]
    .map(([swl, kg, len, sz]) => RG(`shk_${swl}`, "shackle", `Bow shackle ${swl} t (${sz})`, swl, kg / 1000, len)),
  ...[[120, 136, 0.42], [150, 179, 0.46], [200, 254, 0.52], [300, 459, 0.65]].map(([swl, kg, len]) => RG(`shk_${swl}`, "shackle", `Heavy bow shackle ${swl} t`, swl, kg / 1000, len)),
  ...[[5.3, 0.9, 0.11], [8, 1.7, 0.14], [12.5, 3.2, 0.16], [17, 4.9, 0.19], [25, 8.5, 0.23], [34, 13.5, 0.27], [50, 24, 0.32], [70, 38, 0.37], [100, 62, 0.43], [150, 105, 0.52], [200, 150, 0.6], [250, 190, 0.65], [300, 240, 0.7], [400, 330, 0.8], [500, 420, 0.9]]
    .map(([swl, kg, len]) => RG(`ml_${swl}`, "masterlink", `Master link ${swl} t`, swl, kg / 1000, len)),
  ...[[1, "violet"], [2, "green"], [3, "yellow"], [4, "grey"], [5, "red"], [6, "brown"], [8, "blue"], [10, "orange"], [15, "orange"], [20, "orange"], [30, "orange"], [50, "orange"]]
    .map(([swl, col]) => RG(`rs_${swl}`, "sling_round", `Round sling ${swl} t (${col})`, swl, 0, 0, { wpm: (0.25 + swl * 0.09) / 1000, colour: col })),
  ...[[1, "violet"], [2, "green"], [3, "yellow"], [4, "grey"], [5, "red"], [6, "brown"], [8, "blue"], [10, "orange"]]
    .map(([swl, col]) => RG(`ws_${swl}`, "sling_web", `Webbing sling ${swl} t (${col})`, swl, 0, 0, { wpm: (0.15 + swl * 0.08) / 1000, colour: col })),
  ...[[16, 2.7], [20, 4.2], [24, 6.0], [28, 8.2], [32, 10.7], [36, 13.5], [40, 16.7], [44, 20.2], [48, 24.0], [52, 28.1], [56, 32.7], [64, 42.6], [72, 53.9]]
    .map(([d, swl]) => RG(`wr_${d}`, "sling_wire", `Wire rope sling Ø${d} mm – ${swl} t`, swl, 0, 0, { wpm: d * d * 0.0040 / 1000 })),
  ...[[8, 2.0, 1.4], [10, 3.15, 2.2], [13, 5.3, 3.8], [16, 8.0, 5.7], [20, 12.5, 9.0], [22, 15.0, 10.9], [26, 21.2, 15.0], [32, 31.5, 22.7]]
    .map(([d, swl, kgm]) => RG(`ch_${d}`, "sling_chain", `Chain leg G80 ${d} mm – ${swl} t`, swl, 0, 0, { wpm: kgm / 1000 })),
  ...[[8, 0.8, 0.14], [11.2, 1.6, 0.17], [15, 2.9, 0.2], [22, 5.3, 0.24], [31.5, 9.5, 0.3]].map(([swl, kg, len]) => RG(`hk_${swl}`, "hook", `Eye sling hook G80 ${swl} t`, swl, kg / 1000, len)),
  ...[[10, 3, 0.25], [25, 6, 0.9], [50, 8, 1.8], [100, 10, 3.6], [200, 12, 7.5]].map(([swl, len, w]) => RG(`sb_${swl}_${len}`, "spreader", `Spreader beam ${swl} t × ${len} m`, swl, w, len)),
  // ---- SSB spreader bar SWL 50 t (ORSEN drawing ANX0077-000-STR-DRW-001 rev 03) and its rigging
  RG("ssb_sb50", "spreader", "Spreader bar SWL 50 t – 7.0 m (ANX0077-000-STR-DRW-001 rev 03)", 50, 1.483, 7.0, {
    cert: "ANX0077-000-STR-DRW-001", notes: "ORSEN / SSB. CHS 273×12.5 S355, overall 7.0 m. Upper padeyes at 2.5 / 4.0 / 5.5 m (35 t WLL) and 6.515 m (50 t WLL, 55 t shackles); lower padeyes at 2.5 / 4.0 / 5.5 m (35 t) and 7.0 m ends (50 t). Sling angle max 30° from vertical. Bar + 6 shackles 1638 kg; bar alone ≈ 1483 kg. Forklift pockets for empty handling only. Painted yellow." }),
  RG("ssb_ss54", "sling_wire", "Sling set leg – Ø54 mm wire Gr.1960 (set WLL 52.68 t, checked at 26.34 t per leg)", 26.34, 0, 0, { wpm: 0.0117, cert: "ANX0077-000-STR-DRW-001 item 14", notes: "2-leg sling set to NF EN 13414-1 & 13414-1/A1, set WLL 52.68 t. Checked here at half the set WLL per leg (conservative). Leg 5.739 m (6.446 m incl. quad assembly). Max 30° to vertical." }),
  RG("ssb_quad67", "masterlink", "Quad master link assembly WLL 67 t (for the Ø54 mm sling set)", 67, 0.1, 0.482, { notes: "Top of the SSB Ø54 sling set – 482 mm assembly. Weight estimated – check the certificate." }),
  RG("gp4163_55", "shackle", "Green Pin G-4163 bow shackle 55 t", 55, 0.0396, 0.3, { notes: "Upper end padeyes of the SSB 50 t spreader bar (case D)." }),
  RG("gp4163_35", "shackle", "Green Pin G-4163 bow shackle 35 t", 35, 0.0188, 0.24, { notes: "Upper padeyes cases A–C and all lower padeyes of the SSB 50 t spreader bar." }),
  // ---- extended catalogue
  ...[[4.75, 1.1, 0.064, '3/4"'], [6.5, 1.7, 0.076, '7/8"'], [8.5, 2.4, 0.089, '1"'], [12, 4.9, 0.108, '1-1/4"'], [17, 8.8, 0.13, '1-1/2"'], [25, 14.5, 0.162, '1-3/4"'], [35, 22.5, 0.178, '2"'], [55, 41, 0.232, '2-1/2"']]
    .map(([swl, kg, len, sz]) => RG(`dshk_${swl}`, "shackle", `Dee shackle ${swl} t (${sz})`, swl, kg / 1000, len)),
  ...[[55, 30, 0.33], [85, 55, 0.4], [130, 95, 0.48], [175, 140, 0.55], [200, 170, 0.6], [300, 290, 0.72], [400, 450, 0.85], [500, 610, 0.95], [600, 800, 1.05], [800, 1250, 1.2], [1000, 1700, 1.35]]
    .map(([swl, kg, len]) => RG(`wbs_${swl}`, "shackle", `Wide body shackle ${swl} t`, swl, kg / 1000, len)),
  ...[[8, 4.2, 0.3], [12.5, 7.5, 0.35], [17, 11, 0.4], [25, 19, 0.46], [34, 30, 0.54], [50, 52, 0.62]]
    .map(([swl, kg, len]) => RG(`mla_${swl}`, "masterlink", `Master link assembly ${swl} t (4-leg, with sub-links)`, swl, kg / 1000, len)),
  ...[[40, 1.8], [50, 2.1], [60, 2.5], [80, 3.2], [100, 3.9], [150, 5.6], [200, 7.4], [250, 9.0], [300, 10.8]]
    .map(([swl, kgm]) => RG(`hrs_${swl}`, "sling_round", `High-capacity round sling ${swl} t`, swl, 0, 0, { wpm: kgm / 1000, colour: "orange" })),
  ...[[50, 12.5, 34], [100, 25, 48], [200, 50, 68], [300, 75, 84], [500, 125, 108], [750, 190, 132]]
    .map(([swl, kgm, d]) => RG(`gr_${swl}`, "sling_wire", `Wire rope grommet ${swl} t (Ø${d} mm)`, swl, 0, 0, { wpm: kgm / 1000 })),
  ...[[76, 70.2], [90, 93.5], [102, 118], [114, 152], [127, 187]].map(([d, swl]) => RG(`wr_${d}`, "sling_wire", `Wire rope sling Ø${d} mm – ${swl} t`, swl, 0, 0, { wpm: d * d * 0.0040 / 1000 })),
  // certified top slings in use with the site's 250 t spreader (Usha Martin, 06.12.2024, cert R13327, ID 228459-1 / -2)
  RG("wr114_180_10", "sling_wire", "Top sling Ø114 mm 6×52 IWRC soft eyes – 180 t (ID 228459)", 180, 0, 10, { wpm: 114 * 114 * 0.0040 / 1000, fixedLen: 10, eye: "soft", cert: "R13327", maker: "Usha Martin" }),
  ...[[2, 2, 0.1], [5, 4, 0.18], [10, 6, 0.4], [20, 8, 0.9], [30, 10, 1.7]].map(([swl, len, w]) => RG(`lb_${swl}_${len}`, "spreader", `Lifting beam (single hook) ${swl} t × ${len} m`, swl, w, len)),
  ...[[35, 4], [55, 6], [85, 8], [110, 10], [150, 12], [250, 12], [250, 14], [400, 16], [600, 20]].map(([swl, len]) => RG(`msb_${swl}_${len}`, "spreader", `Modular spreader ${swl} t × ${len} m`, swl, +(swl * len * 0.0028 + 0.2).toFixed(2), len)),
  ...[[5.3, 1.1, 0.16], [8, 2.3, 0.2], [11.2, 3.7, 0.23], [15, 6, 0.27], [22.4, 10, 0.32]].map(([swl, kg, len]) => RG(`slh_${swl}`, "hook", `Self-locking hook G80 ${swl} t`, swl, kg / 1000, len)),
  ...[[8, 3.5, 0.3], [15, 7, 0.38], [30, 16, 0.48], [50, 34, 0.6]].map(([swl, kg, len]) => RG(`swh_${swl}`, "hook", `Swivel hook ${swl} t`, swl, kg / 1000, len)),
  // ---- Crosby hooks (catalogue data). WLL in t; weight kg; length = top of eye to bottom of hook (m)
  // S-320 / L-320 eye hook with latch – table WLL in US tons (× 0.907 = t), weight lb, overall length (in, the longer catalogue dimension – conservative for hook height)
  ...[["D", 0.75, 0.61, 3.34], ["F", 1, 0.89, 3.81], ["G", 1.5, 1.44, 4.14], ["H", 2, 2.07, 4.69], ["I", 3, 4.30, 5.77], ["J", 5, 8.30, 7.37], ["K", 7.5, 15.0, 9.07], ["L", 10, 20.77, 10.08], ["N", 15, 39.5, 12.53], ["O", 20, 60.0, 14.06], ["P", 25, 105, 18.19], ["S", 30, 148, 20.12], ["T", 40, 228, 23.72]]
    .map(([code, tons, lb, D]) => RG(`cr320_${code}`, "hook", `Crosby S-320 eye hook with latch ${Math.round(tons * 0.907185 * 100) / 100} t (${tons} US ton, ID ${code})`, Math.round(tons * 0.907185 * 100) / 100, Math.round(lb * 0.4536 * 100) / 100 / 1000, Math.round(D * 0.0254 * 1000) / 1000, { style: "eyehook" })),
  // S-1326 SHUR-LOC swivel self-locking hook, Grade 100 – WLL 4:1 (t), weight kg, overall length C (mm)
  ...[["6 mm", 1.45, 0.57, 157], ["7–8 mm", 2.6, 1.18, 192], ["10 mm", 4.0, 2.13, 226], ["13 mm", 6.8, 3.92, 282], ["16 mm", 10.3, 7.71, 328], ["18–20 mm", 16.0, 10.9, 358], ["22 mm", 20.0, 13.2, 417]]
    .map(([ch, t, kg, C]) => RG(`cr1326_${t}`, "hook", `Crosby S-1326 SHUR-LOC swivel self-locking hook ${t} t (${ch} chain)`, t, kg / 1000, C / 1000, { style: "slswivel" })),
  ...[[10, 6, 0.28], [30, 20, 0.4], [50, 36, 0.5], [100, 90, 0.65]].map(([swl, kg, len]) => RG(`sw_${swl}`, "other", `Eye–eye swivel ${swl} t`, swl, kg / 1000, len)),
  ...[[25, 12, 0.45], [50, 22, 0.55], [100, 45, 0.7], [200, 95, 0.9], [300, 150, 1.05]].map(([swl, kg, len]) => RG(`lc_${swl}`, "other", `Load link / load cell ${swl} t`, swl, kg / 1000, len)),
  ...[[3.2, 4, 0.45], [5, 7, 0.55], [10, 14, 0.7], [20, 30, 0.9]].map(([swl, kg, len]) => RG(`tb_${swl}`, "other", `Turnbuckle / rigging screw ${swl} t`, swl, kg / 1000, len)),
  ...[[1, 6, 0.3], [2, 10, 0.36], [3, 16, 0.42], [6, 34, 0.55]].map(([swl, kg, len]) => RG(`pc_${swl}`, "other", `Plate clamp ${swl} t`, swl, kg / 1000, len))
];
const SLING_COLOURS = { violet: "#7b3fa0", green: "#2e8b3a", yellow: "#e2b400", grey: "#8a9199", red: "#c0392b", brown: "#7a4a24", blue: "#1f5fa8", orange: "#e0701f" };
let rigCustom = [];
function rigLibrary() { const m = new Map(); for (const it of RIG_BUILTIN) m.set(it.id, it); for (const it of rigCustom) m.set(it.id, it); return [...m.values()]; }
function rigIsBuiltinId(id) { return RIG_BUILTIN.some(i => i.id === id); }
function rigItem(id) { return rigLibrary().find(i => i.id === id) || null; }
function slingColour(it) { if (!it) return "#3b4148"; if (it.type === "sling_wire") return "#3b4148"; if (it.type === "sling_chain") return "#6b6f73"; return SLING_COLOURS[it.colour] || (it.swl >= 10 ? SLING_COLOURS.orange : "#2e8b3a"); }

const HITCH = { straight: { name: "Straight", f: 1 }, choke: { name: "Choke hitch", f: 0.8 }, dwchoke: { name: "Double wrap choke", f: 0.8 }, basket: { name: "Basket hitch", f: 2 }, dwbasket: { name: "Double wrap basket", f: 2 } };
const RIG_ARR = {
  single: { name: "Single leg", legs: 1 },
  bridle2: { name: "2-leg bridle", legs: 2 },
  bridle4: { name: "4-leg bridle", legs: 4 },
  spreader: { name: "Spreader beam", legs: 2 },
  tandem: { name: "Tandem – one leg per crane", legs: 1 }
};
// entry = { id: libraryId, qty, len, snap: {name, type, swl, weight, wpm, len, colour} }
function rigEntry(item, extra = {}) { return { id: item.id, qty: 1, len: RIG_TYPES[item.type]?.sling ? 3 : item.len, snap: { name: item.name, type: item.type, swl: item.swl, weight: item.weight, wpm: item.wpm || 0, len: item.len, colour: item.colour, ...(item.pad ? { pad: item.pad } : {}), ...(item.drawing ? { drawing: item.drawing } : {}), ...(item.style ? { style: item.style } : {}) }, ...(item.pad ? padDefault(item.pad) : {}), ...extra }; }
// spreader bars with several padeye positions: rating for an upper / lower spacing pair
function padDefault(pad) { return { len: pad.low[0], top: pad.top[0] }; }
const nearIdx = (arr, v) => arr.reduce((b, x, i) => Math.abs(x - v) < Math.abs(arr[b] - v) ? i : b, 0);
function padRating(pad, top, low) {
  const iu = nearIdx(pad.top, top), il = nearIdx(pad.low, low), ok = Math.abs(pad.top[iu] - top) < 0.06 && Math.abs(pad.low[il] - low) < 0.06;
  return { iu, il, ok, cap: ok ? +pad.cap[iu][il] : Math.min(...pad.cap.flat().map(Number)), name: pad.names?.[iu] || String.fromCharCode(65 + iu) };
}
const eLen = e => RIG_TYPES[e.snap.type]?.sling ? (+e.len || 0) : (+e.len || +e.snap.len || 0);
const eWeight = e => (RIG_TYPES[e.snap.type]?.sling ? (+e.snap.wpm || 0) * eLen(e) : (+e.snap.weight || 0));

// sensible starting arrangement for a load and weight
function defaultRig(ld, arr) {
  const W = Math.max(1, +ld.weight || 10), pick = (type, need) => rigLibrary().filter(i => i.type === type).sort((a, b) => a.swl - b.swl).find(i => i.swl >= need) || rigLibrary().filter(i => i.type === type).sort((a, b) => b.swl - a.swl)[0];
  const legs = RIG_ARR[arr]?.legs || 2, per = arr === "tandem" ? W * 0.6 : W / Math.max(1, legs === 4 ? 3 : legs) * 1.25;
  const d = loadDims(ld), sling = pick("sling_round", per), shk = pick("shackle", per), ml = pick("masterlink", arr === "tandem" ? W * 0.6 : W);
  const r = { arr, share4: 3, top: [rigEntry(ml)], leg: [rigEntry(sling, { len: Math.max(2, Math.round((Math.max(d.x, d.y) * 0.8) * 2) / 2) }), rigEntry(shk)] };
  if (arr === "spreader") { const sb = pick("spreader", W); r.beam = rigEntry(sb, { len: +ld.span > 0 ? +ld.span : sb.len }); r.lower = [rigEntry(sling, { len: 3 }), rigEntry(shk)]; r.leg = [rigEntry(pick("sling_round", W * 0.6), { len: Math.max(3, sb.len * 0.8) }), rigEntry(pick("shackle", W * 0.6))]; }
  if (arr === "tandem") r.leg = [rigEntry(pick("sling_round", W * 0.6), { len: 2 }), rigEntry(pick("shackle", W * 0.6))];
  return r;
}
// lifting points on the load (local x along A–B, y across)
function rigLiftPoints(ld, n) {
  const s = +ld.span || 0, sy = +ld.spanY || 0;
  if (n >= 4) { const sx = s || loadDims(ld).x * 0.8, syy = sy || loadDims(ld).y * 0.8; return [[-sx / 2, -syy / 2], [-sx / 2, syy / 2], [sx / 2, -syy / 2], [sx / 2, syy / 2]]; }
  if (n === 2 || n === "AB") return [[-s / 2, 0], [s / 2, 0]];
  return [[+ld.cog || 0, 0]];
}

// EN 13414-1 mode factor for a single sling in basket: parallel legs 2.0, legs up to 45° 1.4, up to 60° 1.0
function basketFactor(beta) { return beta <= 6 ? 2 : beta <= 45 ? 1.4 : beta <= 60 ? 1 : 0.7; }
// ---- basket / choke hitch: the sling passes round the load, so its useful length is shorter and it forms a U underneath
function trunnionD(ld) { return +ld.bore > 0 ? +ld.bore : Math.max(0.3, Math.round((+ld.D || 2) * 0.3 * 20) / 20); }
function roundSection(ld) { const k = ld.kind, o = ld.orient; return (k === "reel" && o !== "flat") || (k === "cyl" && o !== "vertical") || k === "tank" || (k === "silo" && o === "horizontal"); }
function basketGeom(ld, list) {
  const sl = (list || []).find(e => RIG_TYPES[e.snap.type]?.sling); if (!sl) return null;
  const lp = ld.lpType || (ld.kind === "reel" && ld.orient !== "flat" ? "axis" : "");
  const h = sl.hitch && sl.hitch !== "straight" ? sl.hitch : (lp === "wrap" || lp === "bore" ? "basket" : "straight");
  if (h === "straight") { delete sl._hitchAuto; return null; }
  if (!sl.hitch || sl.hitch === "straight") sl._hitchAuto = h; else delete sl._hitchAuto;
  // where the basket goes: the sling's own choice (bOn), else a reel always on its trunnion unless the lifting point says "wrap"
  const hollow = ["reel", "cyl", "tank", "silo"].includes(ld.kind);
  const on = sl.bOn || ((ld.kind === "reel" && ld.orient !== "flat") || (hollow && ["axis", "bore"].includes(lp)) ? "trunnion" : "outside");
  sl._bOnAuto = on;
  const d = loadDims(ld), bore = on === "trunnion" && hollow;
  const round = bore || roundSection(ld);
  const r = bore ? trunnionD(ld) / 2 + 0.03 : round ? d.y / 2 / (ld.kind === "tank" ? 1.05 : 1) + 0.03 : 0;
  const zc = bore ? d.z / 2 : round ? d.z - r + 0.03 : 0, hw = round ? r : d.y / 2 + 0.03;
  const L = eLen(sl), rest = list.reduce((a, e) => e === sl ? a : a + eLen(e), 0);
  if (h === "basket") {
    const wrap = round ? Math.PI * r : d.y + 2 * d.z, eff = (L - wrap) / 2;
    const U = x => { const P = []; if (round) for (let i = 0; i <= 16; i++) { const t = Math.PI + Math.PI * i / 16; P.push([x, r * Math.cos(t) * -1 * -1, zc + r * Math.sin(t)]); } else P.push([x, -hw, d.z], [x, -hw, -0.02], [x, hw, -0.02], [x, hw, d.z]);
      if (round) P.forEach((p, i) => p[1] = r * Math.cos(Math.PI + Math.PI * i / 16));
      const S = []; for (let i = 0; i < P.length - 1; i++) S.push({ a: P[i], b: P[i + 1], u: true }); return S; };
    return { kind: "basket", sl, L, wrap, eff, rest, legLen: rest + Math.max(0.05, eff), hw, z: round ? zc : d.z, U, short: eff < 0.3, bore, where: bore ? `round the trunnion (Ø${fx(trunnionD(ld), 2)} m)` : ld.kind === "reel" ? "round the OUTSIDE of the whole reel" : "round the load" };
  }
  const per = round ? 2 * Math.PI * r : 2 * (d.y + d.z), eff = L - per;
  const U = x => { const P = []; if (round) for (let i = 0; i <= 24; i++) { const t = Math.PI / 2 + 2 * Math.PI * i / 24; P.push([x, r * Math.cos(t), zc + r * Math.sin(t)]); } else P.push([x, 0, d.z], [x, -hw, d.z], [x, -hw, -0.02], [x, hw, -0.02], [x, hw, d.z], [x, 0, d.z]);
    const S = []; for (let i = 0; i < P.length - 1; i++) S.push({ a: P[i], b: P[i + 1], u: true }); return S; };
  return { kind: "choke", sl, L, wrap: per, eff, rest, legLen: rest + Math.max(0.05, eff), hw: 0, z: bore ? zc + r : d.z, U, short: eff < 0.3, bore, where: bore ? "round the spindle" : "round the load" };
}

// ---- solver: geometry (for drawing) + forces on every component
function solveRig(ld) {
  const R = ld.rig; if (!R || !R.arr) return null;
  const W = +ld.weight || 0, cog = +ld.cog || 0, lz = liftPointZ(ld), warn = [], rows = [], seg = [], shk = [], links = [], hooks = [];
  let no = 0, bkDone = false, fix = null;
  const row = (e, qty, load, where) => { if (!e) return; const sl = RIG_TYPES[e.snap.type]?.sling, hk = e.hitch && e.hitch !== "straight" ? e.hitch : (e._hitchAuto || "straight"), hf = HITCH[hk] || HITCH.straight;
    const f = !sl ? 1 : hk === "basket" ? (+e.bf || 2) : hf.f;   // basket = 2 × the vertical SWL unless a factor is set on the sling
    const r = { no: ++no, name: e.snap.name + (sl && e.len ? ` × ${(+e.len).toFixed(1)} m` : "") + (sl && hk !== "straight" ? ` (${hf.name.toLowerCase()} × ${f})` : ""), type: e.snap.type, qty, swl: (+e.snap.swl || 0) * f, baseSwl: +e.snap.swl || 0, load, len: eLen(e), unitW: eWeight(e), weight: eWeight(e) * qty, where: where + (sl && hk === "basket" ? ` · basket: ${fx(+e.snap.swl || 0, 1)} t vertical × ${f}${+e.bf ? " (set on the sling)" : ""} = ${fx((+e.snap.swl || 0) * f, 1)} t` : ""), entry: e };
    r.util = r.swl ? load / r.swl * 100 : null; rows.push(r); return r; };
  // a sling in basket through a shackle / padeye / hook is doubled: half its length reaches down
  const chainLen = list => (list || []).reduce((a, e) => a + (RIG_TYPES[e.snap.type]?.sling && e.hitch === "basket" ? eLen(e) / 2 : eLen(e)), 0);
  // shackles sit where the rigging list puts them: listed ABOVE the sling = at the top end (beam / hook), BELOW it = at the load
  const lpPts = [], shkNote = new Set();
  const chainShk = (list, top, bot, basket) => {
    const L = list || [], si = L.findIndex(e => RIG_TYPES[e.snap.type]?.sling); let t = false, b = false;
    L.forEach((e, i) => { if (e.snap.type !== "shackle") return; if (si >= 0 && i < si) t = true; else b = true; });
    if (t && top) shk.push(top);
    if (b && bot && !basket) shk.push(bot);
    if (b && basket) shkNote.add("A basket sling has no shackle at the load end – drag the shackle ABOVE the sling in the list (it then sits under the beam / hook) or remove it");
  };
  const slingOf = list => (list || []).find(e => RIG_TYPES[e.snap.type]?.sling);
  const topList = R.top || [], legList = R.leg || [];
  const topLen = chainLen(topList), legLen = chainLen(legList);
  const angleCheck = (a, label) => { if (a > (rule("rig.legHard") ?? 60)) warn.push(`${label} angle ${a.toFixed(0)}° from vertical is over ${(rule("rig.legHard") ?? 60)}° – use longer slings or a spreader beam`); else if (a > (rule("rig.legMax") ?? 45)) warn.push(`${label} angle ${a.toFixed(0)}° from vertical is over ${(rule("rig.legMax") ?? 45)}° – check the reduced sling capacity`); };
  const legTensions = (pts, top, len, Wv, share4, label) => {
    // vertical shares by lever arms along x; 4 legs: shared by 'share4' legs
    const out = [];
    const xs = pts.map(p => p[0]), xmin = Math.min(...xs), xmax = Math.max(...xs);
    for (const p of pts) {
      let V;
      if (pts.length === 1) V = Wv;
      else if (xmax - xmin < 1e-6) V = Wv / (pts.length === 4 ? share4 : pts.length);
      else { const side = p[0] > (xmin + xmax) / 2 ? (Wv * (cog - xmin) / (xmax - xmin)) : (Wv * (xmax - cog) / (xmax - xmin)); V = pts.length === 4 ? side / (share4 / 2) : side; }
      const d = Math.hypot(p[0] - top[0], p[1] - top[1]);
      let v = len * len - d * d;
      if (v <= 0.0001) { warn.push(`${label}: sling is shorter than the distance to the lifting point (${d.toFixed(2)} m)`); v = 0.0001; }
      v = Math.sqrt(v);
      const a = Math.atan2(d, v) / D2R;
      out.push({ p, V, v, a, T: V / Math.cos(a * D2R) });
    }
    return out;
  };
  let hookZ, hookPts = [], res_nTop = 0;
  const arr = R.arr;
  if (arr === "tandem") {
    // each crane has its own rigging to its own end of the load (or its own end of a spreader beam)
    const mode = R.tmode || "direct", low = R.lower || [], lowLen = chainLen(low), hb = 0.45;
    const beam = mode === "spreader" ? R.beam : null, Sp = beam ? (+beam.len || +beam.snap.len || 4) : 0;
    const s = mode === "spreader" ? Sp : (+ld.span || 1), xA = -s / 2, xB = s / 2;
    const lowW = low.reduce((a, e) => a + eWeight(e), 0) * (ld.spanY > 0 && R.lower4 ? 4 : 2), beamW = beam ? eWeight(beam) : 0;
    const Wb = W + lowW + beamW;
    const VA = Wb * (xB - cog) / (xB - xA), VB = Wb - VA, Vmax = Math.max(VA, VB);
    let zb, legT = Vmax, legA = 0, nLeg = 2;
    if (mode === "spreader") {
      const pts = rigLiftPoints(ld, ld.spanY > 0 && R.lower4 ? 4 : 2), E = [[xA, 0], [xB, 0]];
      const lt = legTensions(pts, [cog, 0], 1e6, W, R.share4 || 3, "Lower leg"), vlow = [];
      pts.forEach((p, i) => { const e = p[0] < 0 ? E[0] : E[1]; const d = Math.hypot(p[0] - e[0], p[1] - e[1]); let v = lowLen * lowLen - d * d; if (v <= 0.0001) { warn.push("Lower leg is shorter than the offset to the lifting point"); v = 0.0001; } v = Math.sqrt(v); const a = Math.atan2(d, v) / D2R; vlow.push({ p, e, v, a, T: lt[i].V / Math.cos(a * D2R) }); });
      const zS = lz + vlow.reduce((a, q) => a + q.v, 0) / vlow.length;
      zb = zS + hb + legLen;
      E.forEach(e => { seg.push({ a: [e[0], 0, zb], b: [e[0], 0, zS + hb], e: slingOf(legList) }); chainShk(legList, [e[0], 0, zb], [e[0], 0, zS + hb]); });
      vlow.forEach(q => { seg.push({ a: [q.e[0], 0, zS], b: [q.p[0], q.p[1], lz], e: slingOf(low) }); chainShk(low, [q.e[0], 0, zS], [q.p[0], q.p[1], lz]); lpPts.push([q.p[0], q.p[1], lz]); });
      R._geom = { beam: { a: [xA, 0, zS], b: [xB, 0, zS], h: hb } };
      var lowRow = () => { const Tl = Math.max(...vlow.map(q => q.T)), al = Math.max(...vlow.map(q => q.a)); low.forEach(e => row(e, vlow.length, Tl, `lower legs, ${al.toFixed(0)}° from vertical`)); if (al > 5) angleCheck(al, "Lower leg"); };
      res_nTop = 2;
    } else if (mode === "bridle") {
      const sy = +ld.spanY > 0 ? +ld.spanY : loadDims(ld).y * 0.8, d = sy / 2;
      let v = legLen * legLen - d * d; if (v <= 0.0001) { warn.push("Legs are shorter than the distance to the lifting points"); v = 0.0001; } v = Math.sqrt(v);
      legA = Math.atan2(d, v) / D2R; legT = Vmax / 2 / Math.cos(legA * D2R); nLeg = 4; zb = lz + v;
      for (const x of [xA, xB]) for (const sgn of [-1, 1]) { seg.push({ a: [x, 0, zb], b: [x, sgn * d, lz], e: slingOf(legList) }); chainShk(legList, [x, 0, zb], [x, sgn * d, lz]); lpPts.push([x, sgn * d, lz]); }
      angleCheck(legA, "Leg"); R._geom = {}; res_nTop = 0;
    } else {
      zb = lz + legLen;
      for (const x of [xA, xB]) { seg.push({ a: [x, 0, zb], b: [x, 0, lz], e: slingOf(legList) }); chainShk(legList, [x, 0, zb], [x, 0, lz]); lpPts.push([x, 0, lz]); }
      R._geom = {}; res_nTop = 0;
    }
    const zh = zb + topLen; hookZ = zh;
    for (const x of [xA, xB]) { hookPts.push([x, 0, zh]); links.push([x, 0, zb + topLen / 2]); }
    topList.forEach(e => row(e, (e.qty || 1) * 2, Vmax / (e.qty || 1), "each crane hook (×2 cranes)"));
    legList.forEach(e => row(e, nLeg, legT, mode === "bridle" ? `2 legs per crane, ${legA.toFixed(0)}° from vertical` : mode === "spreader" ? "each crane to its end of the spreader" : "each crane leg, vertical"));
    if (beam) row(beam, 1, W + lowW, `between the cranes – span ${Sp.toFixed(2)} m (beam in bending: check it is rated for tandem use)`);
    if (mode === "spreader") lowRow();
    rows.push({ note: `Tandem: crane on A ${VA.toFixed(2)} t · crane on B ${VB.toFixed(2)} t (largest used for the rigging)` });
  } else if (arr === "spreader") {
    const beam = R.beam, Sp = beam ? (+beam.len || +beam.snap.len || 4) : 4, hb = 0.45, low = R.lower || [];
    const lowLen = chainLen(low);
    const pts = rigLiftPoints(ld, ld.spanY > 0 && R.lower4 && !(ld.kind === "reel" && ld.orient !== "flat") ? 4 : 2);
    // the beam hangs centred over the lifting points (not the CoG): with the span matched the lower legs hang vertical;
    // an off-centre CoG shows up as unequal top legs under the hook, which sits over the CoG
    const mid = pts.reduce((a, q) => a + q[0], 0) / pts.length;
    const E = [[mid - Sp / 2, 0], [mid + Sp / 2, 0]];
    // vertical shares on lower legs from lever arms
    const lt = legTensions(pts, [cog, 0], 1e6, W, R.share4 || 3, "Lower leg");
    const vlow = [], bkL = basketGeom(ld, low);
    if (bkL) { bkDone = true; if (bkL.short) warn.push(`${bkL.sl.snap.name}: ${fx(bkL.L, 1)} m is too short for a ${bkL.kind} round this load`); }
    const lowL = bkL ? (bkL.kind === "basket" ? Math.sqrt(Math.max(0.0025, bkL.legLen * bkL.legLen - bkL.hw * bkL.hw)) : bkL.legLen) : lowLen, lzL = bkL ? bkL.z : lz;
    pts.forEach((p, i) => { const e = p[0] < mid ? E[0] : E[1]; const d = Math.hypot(p[0] - e[0], p[1] - e[1]); let v = lowL * lowL - d * d; if (v <= 0.0001) { warn.push(`Lower leg is shorter than the offset to the lifting point`); v = 0.0001; } v = Math.sqrt(v); const a = Math.atan2(d, v) / D2R; vlow.push({ p, e, v, a, T: lt[i].V / Math.cos(a * D2R) }); });
    const zS = lzL + vlow.reduce((a, q) => a + q.v, 0) / vlow.length;
    const siW = low.findIndex(e => RIG_TYPES[e.snap.type]?.sling);
    const lowW = low.reduce((a, e, k) => a + eWeight(e) * (pts.length === 4 && e.snap.type === "shackle" && siW >= 0 && k < siW ? 2 : pts.length), 0), beamW = beam ? eWeight(beam) : 0;
    const Vtop = (W + lowW + beamW) / 2;
    const pad = beam?.snap?.pad, Tsp = beam && +beam.top > 0 ? +beam.top : Sp;
    const tA = mid - Tsp / 2, tB = mid + Tsp / 2, dA = Math.abs(cog - tA), dB = Math.abs(tB - cog);
    const vOf = d => { let v = legLen * legLen - d * d; if (v <= 0.0001) { warn.push("Top slings are too short for the spreader span"); v = 0.0001; } return Math.sqrt(v); };
    const vA = vOf(dA), vB = vOf(dB), v = (vA + vB) / 2, aA = Math.atan2(dA, vA) / D2R, aB = Math.atan2(dB, vB) / D2R;
    const VtA = 2 * Vtop * Math.max(0, Math.min(1, (tB - cog) / (tB - tA))), VtB = 2 * Vtop - VtA;
    const aTop = Math.max(aA, aB), Ttop = Math.max(VtA / Math.cos(aA * D2R), VtB / Math.cos(aB * D2R));
    if (Math.abs(cog - mid) > 0.05) {
      rows.push({ note: `CoG ${fx(cog - mid, 2)} m off the middle of the lifting points: the hook sits over the CoG, so the top legs differ – ${fx(aA, 0)}° / ${fx(aB, 0)}°, taking ${fx(VtA, 1)} t / ${fx(VtB, 1)} t vertical` });
      if (cog < tA || cog > tB) warn.push(`CoG is outside the spreader's upper padeyes – the load will tip`);
    }
    angleCheck(aTop, "Top leg");
    if (pad && pad.maxAngle && aTop > pad.maxAngle + 0.05) warn.push(`Top legs ${aTop.toFixed(1)}° from vertical – this spreader bar allows max ${pad.maxAngle}°: use longer slings or closer padeyes`);
    const zH = zS + hb + v + topLen;
    hookZ = zH; hookPts = [[cog, 0, zH]];
    const zb = zH - topLen;
    [[tA, 0], [tB, 0]].forEach(e => { seg.push({ a: [cog, 0, zb], b: [e[0], 0, zS + hb], e: slingOf(legList) }); chainShk(legList, [cog, 0, zb], [e[0], 0, zS + hb]); });
    vlow.forEach(q => {
      if (bkL && bkL.kind === "basket") { for (const sy of [-1, 1]) seg.push({ a: [q.e[0], 0, zS], b: [q.p[0], q.p[1] + sy * bkL.hw, bkL.z], e: bkL.sl }); bkL.U(q.p[0]).forEach(s => seg.push({ ...s, e: bkL.sl })); chainShk(low, [q.e[0], 0, zS], null, true); lpPts.push([q.p[0], q.p[1], bkL.z]); }
      else if (bkL) { seg.push({ a: [q.e[0], 0, zS], b: [q.p[0], q.p[1], bkL.z], e: bkL.sl }); bkL.U(q.p[0]).forEach(s => seg.push({ ...s, e: bkL.sl })); chainShk(low, [q.e[0], 0, zS], null, true); lpPts.push([q.p[0], q.p[1], bkL.z]); }
      else { seg.push({ a: [q.e[0], 0, zS], b: [q.p[0], q.p[1], lz], e: slingOf(low) }); chainShk(low, [q.e[0], 0, zS], [q.p[0], q.p[1], lz]); lpPts.push([q.p[0], q.p[1], lz]); }
    });
    links.push([cog, 0, zb + topLen / 2]);
    const Wtot = W + lowW + beamW + legList.reduce((a, e) => a + eWeight(e), 0) * 2;
    topList.forEach(e => { const q = e.qty || 1, wf = q === 2 && VtA + VtB > 0 ? Math.max(VtA, VtB) / (VtA + VtB) : 1 / q; row(e, q, Wtot * wf, q === 2 ? `on the crane hook – one per top leg, the heavier side ${fx(Wtot, 2)} × ${fx(wf * 100, 1)} %` : `on the crane hook – total below the hook ${fx(Wtot, 2)} t${q > 1 ? " ÷ " + q : ""}`); });
    legList.forEach(e => row(e, 2, Ttop, Math.abs(cog - mid) > 0.05 ? `top legs, ${aA.toFixed(0)}° / ${aB.toFixed(0)}° from vertical · worst leg takes ${fx(Ttop, 1)} t (off-centre CoG)` : `top legs, ${aTop.toFixed(0)}° from vertical · each takes ${fx(Ttop, 1)} t (half the load, plus angle)`));
    if (beam) { const r = row(beam, 1, W + lowW, `span ${Sp.toFixed(2)} m, compression ${(Ttop * Math.sin(aTop * D2R)).toFixed(2)} t`);
      if (pad && r) {
        const pr = padRating(pad, Tsp, Sp);
        r.swl = pr.cap; r.util = pr.cap ? r.load / pr.cap * 100 : null;
        r.where = `case ${pr.name}: upper padeyes ${fx(pad.top[pr.iu], 3)} m · lower ${fx(pad.low[pr.il], 3)} m – rated ${fx(pr.cap)} t`;
        if (!pr.ok) warn.push(`Spreader bar: ${fx(Tsp, 2)} m upper / ${fx(Sp, 2)} m lower is not a rated padeye pair – lowest rating (${fx(pr.cap)} t) used`);
        if (pad.topShk && pad.topShk[pr.iu]) rows.push({ note: `Upper padeyes (case ${pr.name}): ${pad.topShk[pr.iu]} shackles · lower padeyes: ${pad.lowShk || "per drawing"}` });
      }
    }
    const Tl = Math.max(...vlow.map(q => q.T)), al = Math.max(...vlow.map(q => q.a));
    if (bkL && bkL.kind === "basket") { const ba = Math.max(al, Math.atan2(bkL.hw, Math.max(0.01, zS - bkL.z)) / D2R); bkL.sl._bfAuto = basketFactor(ba); bkL.sl._bAng = ba; }
    // a shackle listed ABOVE the lower sling sits in the beam's padeye: with two legs to each end (4 lifting points) it is
    // ONE shackle per beam end taking both slings – 2 shackles, each carrying that end's load – not one per leg
    const siL = low.findIndex(e => RIG_TYPES[e.snap.type]?.sling), pairEnds = pts.length === 4;
    low.forEach((e, k) => { if (pairEnds && e.snap.type === "shackle" && siL >= 0 && k < siL) { const Tend = 2 * Tl * Math.cos(al * D2R); row(e, 2, Tend, `in the beam's lower padeye – one each end, both slings of that end in it · takes ${fx(Tend, 1)} t`); return; }
      row(e, pts.length, Tl, `lower legs, ${al.toFixed(0)}° from vertical · each takes ${fx(Tl, 1)} t of the ${fx(W + lowW, 1)} t` + (bkL && e === bkL.sl ? ` · ${bkL.kind} ${bkL.where}: ${fx(bkL.wrap, 1)} m round, ${fx(Math.max(0, bkL.eff), 2)} m ${bkL.kind === "basket" ? "each side" : "left"} up to the beam` : "")); });
    if (al > 5) angleCheck(al, "Lower leg");
    // spreader lift standard: beam stays above the load, lower legs hang (near) vertical, top legs within 45°
    const dd = loadDims(ld), clear = zS - dd.z;
    { // the lower sling length that keeps the beam 1 m above the load (straight: that length; basket: doubled + the wrap)
      const lsl = bkL ? bkL.sl : slingOf(low);
      if (lsl && clear < 0.3) {
        const other = low.reduce((a, e) => e === lsl ? a : a + eLen(e), 0), off = Math.max(...vlow.map(q => Math.hypot(q.p[0] - q.e[0], q.p[1] - q.e[1])));
        const vNeed = dd.z + 1.0 - (bkL ? bkL.z : lz), legNeed = Math.hypot(vNeed, off, bkL && bkL.kind === "basket" ? bkL.hw : 0) - other;
        const Lneed = bkL ? (bkL.kind === "basket" ? 2 * legNeed + bkL.wrap : legNeed + bkL.wrap) : legNeed;
        fix = { entry: lsl, len: Math.ceil(Lneed / (typeof slStep === "function" ? slStep() : 1) - 1e-9) * (typeof slStep === "function" ? slStep() : 1), eff: legNeed, basket: bkL?.kind === "basket" };
      }
    }
    if (clear < 0.3) warn.push(clear < 0 ? `Spreader beam would sit ${fx(-clear, 2)} m BELOW the top of the load – the lower slings are too short; the beam must stay above the load` : `Spreader beam only ${fx(clear, 2)} m above the top of the load – use longer lower slings (keep it clear of the load)`);
    // lower legs under a spreader: within 6° of vertical ALONG the beam; across it the padeye shackle's own limit (45° each leg)
    { const lean = (x, ax) => Math.atan2(Math.abs(ax ? x.p[0] - x.e[0] : x.p[1] - x.e[1]), x.v) / D2R;
      const aAl = Math.max(0, ...vlow.map(x => lean(x, 1))), aX = Math.max(0, ...vlow.map(x => lean(x, 0)));
      if (aAl > 6) warn.push(`Lower legs ${fx(aAl, 0)}° from vertical along the beam – keep within 6°: the beam ends are off the lifting points – make the spreader span (now ${fx(Sp, 2)} m) match the lifting-point spacing (${fx(+ld.span || 0, 2)} m)`);
      if (aX > 45) warn.push(`Lower legs ${fx(aX, 0)}° from vertical across the beam – over the 45° limit for the padeye shackle: increase the leg length`); }
    if (aTop > (rule("rig.legMax") ?? 45)) warn.push(`Top legs ${fx(aTop, 0)}° from vertical – keep within ${(rule("rig.legMax") ?? 45)}° (longer top slings or shorter spreader span)`);
    R._geom = { beam: { a: [E[0][0], 0, zS], b: [E[1][0], 0, zS], h: hb } }; res_nTop = 2;
  } else {
    const n = RIG_ARR[arr].legs, pts = rigLiftPoints(ld, n), bk = basketGeom(ld, legList);
    if (bk) { bkDone = true; if (bk.short) warn.push(`${bk.sl.snap.name}: ${fx(bk.L, 1)} m is too short for a ${bk.kind} round this load (needs more than ${fx(bk.wrap, 1)} m round it)`); }
    const lzL = bk ? bk.z : lz, Leg = bk ? (bk.kind === "basket" ? Math.sqrt(Math.max(0.0025, bk.legLen * bk.legLen - bk.hw * bk.hw)) : bk.legLen) : legLen;
    const legs = legTensions(pts, [cog, 0], Leg, W, R.share4 || 3, "Leg");
    const zb = lzL + legs.reduce((a, q) => a + q.v, 0) / legs.length;
    if (Math.max(...legs.map(q => q.v)) - Math.min(...legs.map(q => q.v)) > 0.1) warn.push("Legs reach different heights – the shorter legs will carry more load; check sling lengths");
    const zH = zb + topLen; hookZ = zH; hookPts = [[cog, 0, zH]];
    legs.forEach(q => {
      if (bk && bk.kind === "basket") { for (const sy of [-1, 1]) seg.push({ a: [cog, 0, zb], b: [q.p[0], q.p[1] + sy * bk.hw, bk.z], e: bk.sl }); bk.U(q.p[0]).forEach(s => seg.push({ ...s, e: bk.sl })); chainShk(legList, [cog, 0, zb], null, true); lpPts.push([q.p[0], q.p[1], bk.z]); }
      else if (bk) { seg.push({ a: [cog, 0, zb], b: [q.p[0], q.p[1], bk.z], e: bk.sl }); bk.U(q.p[0]).forEach(s => seg.push({ ...s, e: bk.sl })); chainShk(legList, [cog, 0, zb], null, true); lpPts.push([q.p[0], q.p[1], bk.z]); }
      else { seg.push({ a: [cog, 0, zb], b: [q.p[0], q.p[1], lz], e: slingOf(legList) }); chainShk(legList, [cog, 0, zb], [q.p[0], q.p[1], lz]); lpPts.push([q.p[0], q.p[1], lz]); }
    });
    links.push([cog, 0, zb + topLen / 2]);
    if (bk && bk.kind === "basket") { const ba = Math.atan2(bk.hw, Math.max(0.01, zb - bk.z)) / D2R; bk.sl._bfAuto = basketFactor(ba); bk.sl._bAng = ba; }
    const legW = legList.reduce((a, e) => a + eWeight(e), 0) * legs.length;
    const T = Math.max(...legs.map(q => q.T)), a = Math.max(...legs.map(q => q.a));
    topList.forEach(e => row(e, e.qty || 1, (W + legW) / (e.qty || 1), "on the crane hook"));
    legList.forEach(e => row(e, legs.length, T, (n > 1 ? `each leg, ${a.toFixed(0)}° from vertical${n === 4 ? ` (load shared by ${R.share4 || 3} legs)` : ""}` : "vertical") + (bk && e === bk.sl ? ` · ${bk.kind} round the load – ${fx(bk.wrap, 1)} m goes round it, ${fx(Math.max(0, bk.kind === "basket" ? bk.eff : bk.eff), 2)} m ${bk.kind === "basket" ? "each side" : "left"} to the hook` : "")));
    if (bk && bk.kind === "basket") { const across = Math.atan2(bk.hw, Math.max(0.01, zb - bk.z)) / D2R; if (across > 60) warn.push(`Basket sling opens ${fx(across * 2, 0)}° round the load – too wide; use a longer sling`); }
    if (n > 1) angleCheck(a, "Leg");
    R._geom = {};
  }
  for (const r of rows) if (r.util != null && r.util > 100) warn.push(`${r.name}: ${r.load.toFixed(2)} t is over its ${r.swl} t SWL`);
  const weight = rows.reduce((a, r) => a + (r.weight || 0), 0);
  shkNote.forEach(t => warn.push(t));
  return { nTop: res_nTop, lpPts, wrap: ld.lpType === "wrap" && !bkDone, fix, rows: rows.filter(r => !r.note), notes: rows.filter(r => r.note).map(r => r.note), warn, weight, hookZ, hookPts, seg, shk, links, beam: R._geom?.beam || null, topLen };
}

// ---- 2D drawing of the solved rigging in an elevation (view "side": u = x; "end": u = y); ox, oy = where the load centre-bottom is
function rig2D(s, ld, res, view, ox, oy, opts = {}) {
  if (opts.cad && typeof rig2DCad === "function") return rig2DCad(s, ld, res, view, ox, oy);
  const U = p => ox + (view === "end" ? p[1] : p[0]), Z = p => oy + p[2];
  for (const g of res.seg) s.poly("RIGGING", [[U(g.a), Z(g.a)], [U(g.b), Z(g.b)]], { w: g.e && g.e.snap.type !== "sling_wire" ? 1.8 : 1.2, color: slingColour(g.e ? g.e.snap : null) });
  if (res.wrap) {
    const d = loadDims(ld), col = slingColour(res.seg[0]?.e?.snap);
    for (const p of res.lpPts || res.shk) {
      if (view === "end") { const w = d.y / 2, P = [[ox - w, oy + p[2]]]; for (let i = 0; i <= 12; i++) { const a = Math.PI + Math.PI * i / 12; P.push([ox + w * Math.cos(a), oy + d.z / 2 + (d.z / 2) * Math.sin(a) * 1.02]); } P.push([ox + w, oy + p[2]]); s.poly("RIGGING", P, { w: 1.6, color: col }); break; }
      else s.poly("RIGGING", [[U(p), Z(p)], [U(p), oy]], { w: 1.4, color: col, dash: [0.3, 0.15] });
    }
  }
  if (res.beam) { const b = res.beam, bad = b.a[2] < loadDims(ld).z + 0.05; s.rect("RIGGING", Math.min(U(b.a), U(b.b)) - 0.1, Z(b.a), Math.max(U(b.a), U(b.b)) + 0.1, Z(b.a) + b.h, { fill: bad ? "#e74c3c" : "#f2c200", w: 1, color: bad ? "#7a1a12" : "#5a4a00" }); if (bad) s.text("DIMS", [ox, Z(b.a) + b.h + 0.5], "BEAM CLASHES WITH THE LOAD", 0.45, { bold: true, color: "#b42318" }); }
  for (const p of (res.wrap ? [] : res.shk)) { const x = U(p), z = Z(p); s.poly("RIGGING", [[x - 0.09, z + 0.02], [x - 0.09, z + 0.14], [x, z + 0.2], [x + 0.09, z + 0.14], [x + 0.09, z + 0.02]], { w: 1.2, color: "#6b7278" }); s.poly("RIGGING", [[x - 0.12, z], [x + 0.12, z]], { w: 1.4, color: "#c0392b" }); }
  for (const p of res.links) { const x = U(p), z = Z(p), h = Math.max(0.12, res.topLen / 2); s.poly("RIGGING", Array.from({ length: 16 }, (_, i) => [x + 0.09 * Math.cos(i / 16 * Math.PI * 2), z + h * Math.sin(i / 16 * Math.PI * 2)]), { closed: true, w: 1.4, color: "#b8860b" }); }
  if (opts.callouts) {
    // numbered callouts stacked in a column to the right, with leader lines to each component
    const parts = rigParts(ld, res), ts = opts.ts || 0.3;
    const xs = [loadDims(ld).x / 2, ...res.hookPts.map(h => Math.abs(h[0])), ...(res.beam ? [Math.abs(res.beam.a[0]), Math.abs(res.beam.b[0])] : [])];
    const colX = ox + Math.max(...xs) + 1.2 + ts;
    let lastZ = 1e9; const gap = ts * 2.3;
    const out = [];
    for (const pt of [...parts].sort((a, b) => b.p[2] - a.p[2])) {
      if (!pt.row) continue;
      const z = Math.min(Z(pt.p), lastZ - gap); lastZ = z;
      s.poly("DIMS", [[U(pt.p), Z(pt.p)], [colX - ts, z]], { w: 0.5, color: "#16202a" });
      s.circle("DIMS", [colX, z], ts, { fill: "#ffffff", w: 0.8, color: "#16202a" });
      s.text("DIMS", [colX, z - ts * 0.42], String(pt.row), ts * 1.1, { bold: true, color: "#16202a" });
      out.push({ ...pt, cx: colX, cz: z, ax: U(pt.p), az: Z(pt.p) });
    }
    return out;
  }
  return [];
}

// ---- 3D rigging for a load at its position (local → world)
function rig3D(M, ld, pos, res, hooks) {
  const F = frame([pos.x, pos.y, +pos.h || 0], (pos.rot || 0) + 90), X = F.y, Y = vmul(F.x, -1), O = F.o;
  const W0 = p => vadd(O, vadd(vmul(X, p[0]), vadd(vmul(Y, p[1]), [0, 0, p[2]])));
  let W = W0;
  // flexible top: each rigging top follows the real crane hook it hangs from. Points at the load (or on the spreader) stay put,
  // the legs stretch/lean up to the hook, and everything above the leg junction moves with the hook.
  if (hooks && hooks.length && res.hookPts && res.hookPts.length) {
    const HL = res.hookPts.map(h => ({ l: h, w: W0(h) })), used = new Set();
    const D = HL.map(h => { let bi = -1, bd = 1e9; hooks.forEach((k, i) => { if (used.has(i) && hooks.length >= HL.length) return; const d = Math.hypot(k[0] - h.w[0], k[1] - h.w[1]); if (d < bd) { bd = d; bi = i; } }); if (bi < 0) return [0, 0, 0]; used.add(bi); return vsub(hooks[bi], h.w); });
    const zb = res.beam ? res.beam.a[2] + res.beam.h : liftPointZ(ld);
    W = p => {
      let i = 0, bd = 1e9; HL.forEach((h, k) => { const d = Math.abs(p[0] - h.l[0]) + Math.abs(p[1] - h.l[1]) * 0.3; if (d < bd) { bd = d; i = k; } });
      const top = HL[i].l[2], t = Math.max(0, Math.min(1, (p[2] - zb) / ((top - zb) || 1)));
      return vadd(W0(p), vmul(D[i], t));
    };
  }
  for (const g of res.seg) M.cyl(W(g.a), W(g.b), g.e && g.e.snap.type === "sling_wire" ? 0.045 : 0.06, slingColour(g.e ? g.e.snap : null), { n: 6, open: true });
  if (res.beam) { const b = res.beam, a = W(b.a), c = W(b.b); M.cyl(vadd(a, [0, 0, b.h / 2]), vadd(c, [0, 0, b.h / 2]), b.h / 2, "#f2c200", { n: 10 }); }
  for (const p of res.shk) { const w = W(p); M.box({ o: w, x: X, y: Y, z: [0, 0, 1] }, -0.08, 0.08, -0.05, 0.05, 0, 0.22, "#8a9199"); M.box({ o: w, x: X, y: Y, z: [0, 0, 1] }, -0.11, 0.11, -0.03, 0.03, -0.03, 0.03, "#c0392b"); }
  for (const p of res.links) { const w = W(p), h = Math.max(0.12, res.topLen / 2); M.box({ o: w, x: X, y: Y, z: [0, 0, 1] }, -0.1, 0.1, -0.035, 0.035, -h, h, "#b8860b"); }
}

// upsize every component that would be over 'limit' % of its SWL (keeps lengths, hitches and quantities)
// the rating needed includes the dynamic factor (DAF), and every item is kept in the green (≤ 80 % of its rating)
Object.defineProperty(globalThis, "RIG_GREEN", { get: () => (typeof rule === "function" ? rule("rig.green") : null) ?? 80, configurable: true });   // Rules & limits
// the item's make / style: its name without the rating and size ("Wide body shackle 55 t" → "Wide body shackle")
const rigFamily = n => String(n || "").replace(/\s*\(.*$/, "").replace(/\s*[\d.,]+\s*(t|te|tonnes?)\b.*$/i, "").trim().toLowerCase();
function sizeRig(ld, limit = RIG_GREEN) {
  const daf = typeof rcDaf === "function" ? rcDaf(ld) : 1;
  for (let it = 0; it < 6; it++) {
    const res = solveRig(ld); if (!res) return;
    let changed = false;
    for (const r of res.rows) {
      if (r.util == null || r.util * daf <= limit + 1e-9 || !r.entry || r.entry.snap.pad) continue;
      const e = r.entry, hf = r.hitchF != null ? r.hitchF : RIG_TYPES[e.snap.type]?.sling ? (HITCH[e.hitch || "straight"]?.f || 1) : 1;
      const need = r.load * daf / (limit / 100) / hf;
      const all = rigLibrary().filter(i => i.type === e.snap.type && i.swl >= need).sort((a, b) => a.swl - b.swl), cand = all.find(i => rigFamily(i.name) === rigFamily(e.snap.name)) || all[0];
      if (!cand || cand.id === e.id) continue;
      const ne = rigEntry(cand, { qty: e.qty, hitch: e.hitch, len: RIG_TYPES[cand.type]?.sling ? e.len : (e.snap.type === "spreader" ? e.len : cand.len) });
      const keep = { cfg: e.cfg, legs: e.legs, bagsPer: e.bagsPer }; Object.keys(e).forEach(k => delete e[k]); Object.assign(e, ne); for (const k in keep) if (keep[k] !== undefined) e[k] = keep[k]; changed = true;
    }
    if (!changed) return;
  }
}

// ---- standard rigging set-ups (templates). Sizes are picked to suit the load, then checked by sizeRig().
function pickItem(type, need, prefer) {
  const list = rigLibrary().filter(i => i.type === type && (!prefer || prefer(i))).sort((a, b) => a.swl - b.swl);
  return list.find(i => i.swl >= need) || list[list.length - 1] || rigLibrary().filter(i => i.type === type).sort((a, b) => b.swl - a.swl)[0];
}
const std = i => /^Bow shackle|^Heavy bow|^Wide body/.test(i.name);
const RIG_PRESETS = [
  { id: "hb_ccu", name: "Hook block – 4-leg sling set", block: "single", desc: "Master link · shackle · load link · shackle · 4-leg chain sling with self-locking hooks (containers, CCUs, skids)", arr: "bridle4",
    top: W => [["masterlink", W], ["shackle", W, std], ["other", W, i => /Load link/.test(i.name)], ["shackle", W, std]], leg: W => [["sling_chain", W / 3 * 1.2, null, 3], ["hook", W / 3 * 1.2, i => /Self-locking/.test(i.name)]] },
  { id: "hb_single", name: "Hook block – single leg", block: "single", desc: "Master link · shackle · load link · shackle · single chain leg with self-locking hook", arr: "single",
    top: W => [["masterlink", W], ["shackle", W, std], ["other", W, i => /Load link/.test(i.name)], ["shackle", W, std]], leg: W => [["sling_chain", W, null, 2], ["hook", W, i => /Self-locking/.test(i.name)]] },
  { id: "hb_tub", name: "Hook block – tubulars / heavy (2-leg chain)", block: "single", desc: "Master link · shackle · load link · shackle · 2-leg chain sling – for tubulars or heavy loads", arr: "bridle2",
    top: W => [["masterlink", W], ["shackle", W, std], ["other", W, i => /Load link/.test(i.name)], ["shackle", W, std]], leg: W => [["sling_chain", W / 2 * 1.3, null, 4], ["hook", W / 2 * 1.3, i => /Self-locking/.test(i.name)]] },
  { id: "rh_ccu", name: "Ramshorn – 4-leg sling set", block: "ramshorn", desc: "2 master links on the ramshorn · 2 shackles · load link · shackle · 4-leg chain sling", arr: "bridle4",
    top: W => [["masterlink", W / 2, null, 0, 2], ["shackle", W / 2, std, 0, 2], ["other", W, i => /Load link/.test(i.name)], ["shackle", W, std]], leg: W => [["sling_chain", W / 3 * 1.2, null, 3], ["hook", W / 3 * 1.2, i => /Self-locking/.test(i.name)]] },
  { id: "rh_tub", name: "Ramshorn – tubulars / heavy (2-leg)", block: "ramshorn", desc: "2 master links · 2 shackles · load link · shackle · 2-leg chain sling – tubulars or heavy loads", arr: "bridle2",
    top: W => [["masterlink", W / 2, null, 0, 2], ["shackle", W / 2, std, 0, 2], ["other", W, i => /Load link/.test(i.name)], ["shackle", W, std]], leg: W => [["sling_chain", W / 2 * 1.3, null, 4], ["hook", W / 2 * 1.3, i => /Self-locking/.test(i.name)]] },
  { id: "sb", name: "Spreader beam – 2 + 2 slings", block: "any", desc: "Master link · top slings · spreader beam · lower slings · shackles", arr: "spreader" },
  { id: "ssb50", name: "50 t spreader bar set (ANX0077)", block: "any", desc: "Quad assembly 67 t · Ø54 mm wire 2-leg set 5.739 m · G-4163 shackles · 7 m spreader bar SWL 50 t – set the padeye spacings in the list", arr: "spreader",
    build: ld => {
      const bar = rigItem("ssb_sb50"), W = Math.max(1, +ld.weight || 10), lowSl = pickItem("sling_wire", W / 2 * 1.25);
      return { arr: "spreader", share4: 3, top: [rigEntry(rigItem("ssb_quad67"))], leg: [rigEntry(rigItem("ssb_ss54"), { len: 5.739 }), rigEntry(rigItem("gp4163_35"))],
        beam: rigEntry(bar, { len: 7.0, cfg: { padN: 2, padSpan: 2.5, topSpan: 2.5, perPad: 1, bagsPer: 1 } }), lower: [rigEntry(rigItem("gp4163_35")), rigEntry(lowSl, { len: 3 })] };
    } },
  { id: "rs2", name: "Round sling 2-leg bridle", block: "any", desc: "Master link · 2 round slings · shackles to the lifting lugs", arr: "bridle2" },
  { id: "tandem", name: "Tandem – one leg per crane", block: "any", desc: "Each crane: master link · sling · shackle straight down to its end of the load", arr: "tandem", tmode: "direct" },
  { id: "tandem_br", name: "Tandem – 2-leg bridle per crane", block: "any", desc: "Each crane: master link · 2-leg sling to the two lifting points at its end", arr: "tandem", tmode: "bridle" },
  { id: "tandem_sb", name: "Tandem – spreader beam, each crane to one end", block: "any", desc: "Each crane: master link · sling · shackle to its end of the spreader · lower slings to the load", arr: "tandem", tmode: "spreader" }
];
function buildPreset(ld, pr) {
  const W = Math.max(1, +ld.weight || 10);
  if (pr.build) { const r = pr.build(ld); r.preset = pr.id; return r; }
  if (!pr.top) {
    const r = defaultRig(ld, pr.arr); r.preset = pr.id;
    if (pr.tmode) { r.tmode = pr.tmode; const W2 = Math.max(1, +ld.weight || 10) * 0.6;
      if (pr.tmode === "spreader") { const sb = pickItem("spreader", Math.max(1, +ld.weight || 10)); r.beam = rigEntry(sb, { len: +ld.span > 0 ? Math.max(+ld.span, 2) : sb.len }); r.lower = [rigEntry(pickItem("sling_round", W2 * 0.9), { len: 3 }), rigEntry(pickItem("shackle", W2 * 0.9, std))]; r.leg = [rigEntry(pickItem("sling_round", W2), { len: 3 }), rigEntry(pickItem("shackle", W2, std))]; }
      if (pr.tmode === "bridle") { r.leg = [rigEntry(pickItem("sling_round", W2 * 0.7), { len: Math.max(2.5, Math.ceil(((+ld.spanY || loadDims(ld).y * 0.8) / 2) / Math.sin(40 * D2R) * 2) / 2) }), rigEntry(pickItem("shackle", W2 * 0.7, std))]; }
    }
    return r;
  }
  const mk = ([type, need, pref, len, qty]) => { const it = pickItem(type, need, pref); if (!it) return null; const e = rigEntry(it); if (len) e.len = len; if (qty) e.qty = qty; return e; };
  const r = { arr: pr.arr, share4: 3, preset: pr.id, top: pr.top(W).map(mk).filter(Boolean), leg: pr.leg(W).map(mk).filter(Boolean) };
  const d = loadDims(ld), n = RIG_ARR[pr.arr].legs, sl = r.leg.find(e => RIG_TYPES[e.snap.type]?.sling);
  if (sl) { const reach = n === 1 ? 2 : Math.hypot((+ld.span || d.x * 0.8) / 2, n === 4 ? (+ld.spanY || d.y * 0.8) / 2 : 0); sl.len = Math.max(1.5, Math.ceil(reach / Math.sin(40 * D2R) * 2) / 2); }
  return r;
}

// every rigging component with the list it belongs to, its table row number and a drawing anchor (local x, y, z)
function rigParts(ld, res) {
  const R = ld.rig, out = []; if (!R || !res) return out;
  const rowOf = e => (res.rows.find(r => r.entry === e) || {}).no;
  const hp = res.hookPts[res.hookPts.length - 1];
  let z = hp[2];
  (R.top || []).forEach((e, i) => { const L = Math.max(0.15, eLen(e)); out.push({ key: "top", i, entry: e, row: rowOf(e), p: [hp[0], hp[1], z - L / 2] }); z -= L; });
  const isSp = !!res.nTop;
  const legSegs = (isSp ? res.seg.slice(0, res.nTop) : res.seg).filter(q => !q.u), lowSegs = (isSp ? res.seg.slice(res.nTop) : []).filter(q => !q.u);
  const along = (list, segs, key) => {
    if (!list || !segs.length) return;
    const g = segs.reduce((m, q) => (q.b[0] > m.b[0] ? q : m), segs[0]);
    const L = Math.hypot(g.a[0] - g.b[0], g.a[1] - g.b[1], g.a[2] - g.b[2]) || 1, u = [(g.a[0] - g.b[0]) / L, (g.a[1] - g.b[1]) / L, (g.a[2] - g.b[2]) / L];
    const si = list.findIndex(e => RIG_TYPES[e.snap.type]?.sling);
    list.forEach((e, i) => {
      let p;
      if (i === si) p = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2, (g.a[2] + g.b[2]) / 2];
      else if (si < 0 || i > si) { let off = 0; for (let j = list.length - 1; j > i; j--) off += Math.max(0.12, eLen(list[j])); off += Math.max(0.12, eLen(e)) / 2; p = [g.b[0] + u[0] * off, g.b[1] + u[1] * off, g.b[2] + u[2] * off]; }
      else { let off = 0; for (let j = 0; j < i; j++) off += Math.max(0.12, eLen(list[j])); off += Math.max(0.12, eLen(e)) / 2; p = [g.a[0] - u[0] * off, g.a[1] - u[1] * off, g.a[2] - u[2] * off]; }
      out.push({ key, i, entry: e, row: rowOf(e), p });
    });
  };
  along(R.leg, legSegs, "leg");
  if (R.beam && res.beam) out.push({ key: "beam", i: 0, entry: R.beam, row: rowOf(R.beam), p: [(res.beam.a[0] + res.beam.b[0]) / 2 + (res.beam.b[0] - res.beam.a[0]) * 0.25, 0, res.beam.a[2] + res.beam.h / 2] });
  along(R.lower, lowSegs, "lower");
  return out;
}

function rigName(R) { if (!R) return "none"; const pr = RIG_PRESETS.find(p => p.id === R.preset); if (pr && (!pr.tmode || pr.tmode === (R.tmode || "direct"))) return pr.name; if (R.arr === "tandem") return { direct: "Tandem – one leg per crane", bridle: "Tandem – 2-leg bridle per crane", spreader: "Tandem – spreader beam, each crane to one end" }[R.tmode || "direct"]; return RIG_ARR[R.arr]?.name || R.arr; }
