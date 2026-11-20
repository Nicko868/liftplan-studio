// ================= Vessels: hull, cargo deck, accommodation, deck image and the vessel's own cranes =================
// A vessel is a site object {type:"vessel", kind:"rect", x, y, rot, w = LOA, h = beam}. Local frame: x along the ship
// (stern -L/2 → bow +L/2), y across (+ = port). Heights are relative to the quay / site datum (0):
// deckH = main deck height above the quay (negative when the deck is below the quay at low water), fb = freeboard.
const VESSEL_KINDS = { psv: "Platform supply vessel (PSV)", barge: "Deck barge", cargo: "General cargo / heavy-lift ship", tug: "Tug / workboat", other: "Other vessel" };
const VESSEL_PRESET = {
  psv: { w: 80, h: 18, acc: "fwd", accL: 22, accH: 12, fb: 2.5 }, barge: { w: 90, h: 27, acc: "none", accL: 0, accH: 0, fb: 2.5 },
  cargo: { w: 110, h: 18, acc: "aft", accL: 18, accH: 16, fb: 4 }, tug: { w: 32, h: 11, acc: "fwd", accL: 12, accH: 8, fb: 1.5 }, other: { w: 60, h: 15, acc: "fwd", accL: 15, accH: 10, fb: 2.5 }
};
function newVessel(kind = "psv", at) {
  const d = VESSEL_PRESET[kind] || VESSEL_PRESET.other;
  return { id: uid(), type: "vessel", kind: "rect", vkind: kind, label: VESSEL_KINDS[kind].split(" (")[0], x: at ? at[0] : view.cx, y: at ? at[1] : view.cy, rot: 0,
    w: d.w, h: d.h, deckH: 0, berth: "port", fb: d.fb, acc: d.acc, accL: d.accL, accH: d.accH, hgt: d.accH, color: "#1f4e79", pass: true, cranes: [] };
}
const isVessel = o => o && o.type === "vessel";
const vesselsAll = () => plan.obstacles.filter(isVessel);
const vW = (o, l) => { const r = rot2(l, -(o.rot || 0)); return [o.x + r[0], o.y + r[1]]; };
const vL = (o, w) => rot2([w[0] - o.x, w[1] - o.y], o.rot || 0);
const vBow = o => ((90 + (o.rot || 0)) % 360 + 360) % 360;
// hull outline in local metres
function vHull(o) {
  const L = +o.w || 60, B = +o.h || 15, k = o.vkind || "psv";
  if (k === "barge") { const c = Math.min(3, B * 0.15); return [[-L / 2, -B / 2 + c], [-L / 2 + c, -B / 2], [L / 2 - c * 2, -B / 2], [L / 2, -B / 2 + c * 1.5], [L / 2, B / 2 - c * 1.5], [L / 2 - c * 2, B / 2], [-L / 2 + c, B / 2], [-L / 2, B / 2 - c]]; }
  const bl = Math.min(B * 1.15, L * 0.24), P = [[-L / 2, -B / 2 + 0.6], [-L / 2 + 0.6, -B / 2]];
  for (let i = 0; i <= 10; i++) { const t = i / 10, a = t * Math.PI / 2; P.push([L / 2 - bl + bl * Math.sin(a), -B / 2 * Math.cos(a) * (1 - 0.15 * t)]); }
  for (let i = 9; i >= 0; i--) { const t = i / 10, a = t * Math.PI / 2; P.push([L / 2 - bl + bl * Math.sin(a), B / 2 * Math.cos(a) * (1 - 0.15 * t)]); }
  P.push([-L / 2 + 0.6, B / 2], [-L / 2, B / 2 - 0.6]);
  return P;
}
// accommodation block and open cargo deck (local x ranges)
function vAcc(o) {
  const L = +o.w || 60, B = +o.h || 15, aL = Math.min(+o.accL || 0, L * 0.7); if (o.acc === "none" || !aL) return null;
  const bl = (o.vkind || "psv") === "barge" ? 0 : Math.min(B * 1.15, L * 0.24);
  if (o.acc === "aft") return { x0: -L / 2 + 1, x1: -L / 2 + 1 + aL, y: B / 2 - 1.2 };
  const x1 = L / 2 - bl * 0.55; return { x0: x1 - aL, x1, y: B / 2 - 1.2 };
}
function vDeck(o) {
  const L = +o.w || 60, B = +o.h || 15, a = vAcc(o), bl = (o.vkind || "psv") === "barge" ? 2 : Math.min(B * 1.15, L * 0.24);
  let x0 = -L / 2 + 1.2, x1 = L / 2 - bl;
  if (a && o.acc === "fwd") x1 = a.x0 - 1.2; if (a && o.acc === "aft") x0 = a.x1 + 1.2;
  return { x0, x1, y: B / 2 - 1.0 };
}
function vesselInside(o, w, margin = 0) { const l = vL(o, w); return inPolyPt(l, vHull(o)) && (margin <= 0 || vHull(o).every((q, k, P) => segDist(l, q, P[(k + 1) % P.length]) >= margin)); }
// ---- plan drawing
function vesselScene(o) {
  const s = new Scene(), col = obsColor(o), W = P => P.map(p => vW(o, p)), img = o.img && o.imgOn !== false;
  const hull = W(vHull(o));
  s.poly("LOAD", hull, { closed: true, fill: img ? "rgba(255,255,255,0.02)" : "#dfe4e9", color: col, w: 2 });
  if (!img) s.poly("LOAD", W(vHull({ ...o, w: o.w - 1.2, h: o.h - 1.2 })), { closed: true, color: shade(col, 1.25), w: 0.6 });
  const dk = vDeck(o);
  s.poly("LOAD", W([[dk.x0, -dk.y], [dk.x1, -dk.y], [dk.x1, dk.y], [dk.x0, dk.y]]), { closed: true, fill: img ? null : "rgba(120,130,140,.18)", dash: [0.8, 0.4], color: col, w: 0.8 });
  const area = (dk.x1 - dk.x0) * dk.y * 2;
  // deck size / area is on the vessel spec sheet only – not printed on the plan
  const a = vAcc(o);
  if (a) {
    s.poly("LOAD", W([[a.x0, -a.y], [a.x1, -a.y], [a.x1, a.y], [a.x0, a.y]]), { closed: true, fill: img ? "rgba(255,255,255,.35)" : "#ffffff", color: col, w: 1.4 });
    const bx = o.acc === "aft" ? a.x1 - 3 : a.x0 + 3, wh = Math.min(6, (a.x1 - a.x0) * 0.35);
    s.poly("LOAD", W([[bx - wh / 2, -a.y + 1], [bx + wh / 2, -a.y + 1], [bx + wh / 2, a.y - 1], [bx - wh / 2, a.y - 1]]), { closed: true, fill: "#c9d6e3", color: col, w: 0.8 });
    s.text("TEXT", vW(o, [(a.x0 + a.x1) / 2, 0]), "ACCOMMODATION", Math.max(0.5, Math.min(1, o.h / 26)), { color: col, rot: -((o.rot || 0)), bold: true });
  }
  // bollards along the side, bow marker
  const L = +o.w || 60, B = +o.h || 15;
  for (let x = -L / 2 + 3; x < L / 2 - Math.min(B, L * 0.24); x += 12) for (const sy of [-1, 1]) s.circle("LOAD", vW(o, [x, sy * (B / 2 - 0.5)]), 0.3, { fill: col, color: col, w: 0.4 });
  s.poly("REF", W([[L / 2 + 1, 0], [L / 2 + 3.5, 0]]), { w: 1.2, color: col }); s.poly("REF", W([[L / 2 + 2.6, -0.7], [L / 2 + 3.5, 0], [L / 2 + 2.6, 0.7]]), { w: 1.2, color: col });
  // name / LOA go on the seaward side – away from the quay and the lift: the side the loads come from / go to off the hull, else the berth side
  { let q = 0; for (const ld of plan.loads || []) for (const ph of ["pick", "set"]) { const p = ld[ph]; if (p && !vesselInside(o, [p.x, p.y])) { const l = vL(o, [p.x, p.y]); if (Math.abs(l[0]) < L / 2 + 30) q += Math.sign(l[1]); } }
    const quay = q ? Math.sign(q) : (o.berth === "stbd" ? -1 : 1), fs = Math.max(0.7, Math.min(1.4, B / 16)), yy = -quay * (B / 2 + 1.8) - (quay < 0 ? 0 : 0);
    let tr = -((o.rot || 0)); tr = ((tr % 360) + 540) % 360 - 180; if (tr > 90) tr -= 180; if (tr < -90) tr += 180;
    s.text("TEXT", vW(o, [0, yy + (quay < 0 ? fs * 0.9 : 0)]), `${o.label || "Vessel"} · LOA ${fx(L, 1)} m × B ${fx(B, 1)} m`, fs, { bold: true, color: col, rot: tr }); }
  // crane pedestals (spec positions) that are not placed as cranes
  for (const sp of o.cranes || []) {
    const used = plan.cranes.some(c => c.vessel === o.id && c.vc === sp.id); if (used) continue;
    const p = vW(o, [+sp.lx || 0, +sp.ly || 0]);
    s.circle("LOAD", p, 1.3, { fill: "#f2c200", color: "#6b5a00", w: 1 }); s.text("TEXT", [p[0], p[1] - 2.2], `${sp.name || "Crane"} ${fx(+sp.swl || 0)} t`, 0.7, { color: "#6b5a00", bold: true });
  }
  return s;
}
// the accommodation stops loads passing over it (the open deck does not)
function vesselBlockers(o) { const a = vAcc(o); return a ? [{ kind: "poly", pts: [[a.x0, -a.y], [a.x1, -a.y], [a.x1, a.y], [a.x0, a.y]].map(p => vW(o, p)), label: (o.label || "Vessel") + " accommodation", hgt: (+o.deckH || 0) + (+o.accH || 10) }] : []; }
// deck image overlay (plan view drawing / photo, bow to the right unless rotated)
function vesselImgMarkup(o, href) {
  if (!o.img || o.imgOn === false) return "";
  const L = +o.w, B = +o.h, k = (+o.imgK || 100) / 100, r90 = (+o.imgRot || 0) % 180 !== 0;
  const w = (r90 ? B : L) * k, h = (r90 ? L : B) * k, a = (o.rot || 0) + (+o.imgRot || 0);
  const c = vW(o, [+o.imgDx || 0, +o.imgDy || 0]);
  return `<image href="${href || (o.img.asset && !CAP.local ? "/_blob/" + o.img.asset : o.img.url)}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" preserveAspectRatio="none" opacity="${o.imgOp ?? 0.85}" transform="translate(${c[0]} ${-c[1]}) rotate(${a})${o.imgFlip ? " scale(1 -1)" : ""}" pointer-events="none"/>`;
}
function vesselImgsMarkup() { return vesselsAll().map(o => vesselImgMarkup(o)).join(""); }
async function vesselImgsData() { let m = ""; for (const o of vesselsAll()) if (o.img && o.imgOn !== false) { const u = o.img.asset && !CAP.local ? "/_blob/" + o.img.asset : o.img.url, d = u.startsWith("data:") ? u : await blobUrlToDataUrl(u); if (d) m += vesselImgMarkup(o, d); } return m; }
// ---- 3D
function vessel3D(M, o) {
  const col = obsColor(o), dz = +o.deckH || 0, fb = +o.fb || 2.5, W = P => P.map(p => vW(o, p));
  const hull = W(vHull(o)), wl = dz - fb;
  M.prism(hull, wl - 0.6, dz - 0.35, col);
  M.prism(W(vHull({ ...o, w: o.w - 0.3, h: o.h - 0.3 })), dz - 0.35, dz, "#8f979e");
  M.prism(hull.map(p => p), wl - 0.62, wl - 0.6, "#2e6f9e", { alpha: 0.35 });   // waterline hint
  // bulwarks / crash rails along the cargo deck
  const dk = vDeck(o);
  for (const sy of [-1, 1]) M.prism(W([[dk.x0, sy * (o.h / 2 - 0.05)], [dk.x1 + 2, sy * (o.h / 2 - 0.05)], [dk.x1 + 2, sy * (o.h / 2 - 0.45)], [dk.x0, sy * (o.h / 2 - 0.45)]]), dz, dz + 1.1, shade(col, 1.15));
  const a = vAcc(o);
  if (a) {
    const H = +o.accH || 10, lv = Math.max(2, Math.round(H / 3));
    M.prism(W([[a.x0, -a.y], [a.x1, -a.y], [a.x1, a.y], [a.x0, a.y]]), dz, dz + H * 0.72, "#eef1f4");
    for (let i = 1; i < lv; i++) M.prism(W([[a.x0 - 0.05, -a.y - 0.05], [a.x1 + 0.05, -a.y - 0.05], [a.x1 + 0.05, a.y + 0.05], [a.x0 - 0.05, a.y + 0.05]]), dz + H * 0.72 * i / lv - 0.12, dz + H * 0.72 * i / lv, "#56606a");
    const bx0 = o.acc === "aft" ? a.x1 - Math.min(8, (a.x1 - a.x0) * 0.5) : a.x0, bx1 = o.acc === "aft" ? a.x1 : a.x0 + Math.min(8, (a.x1 - a.x0) * 0.5);
    M.prism(W([[bx0, -a.y + 0.3], [bx1, -a.y + 0.3], [bx1, a.y - 0.3], [bx0, a.y - 0.3]]), dz + H * 0.72, dz + H, "#f7f9fb");
    M.prism(W([[bx0 - 0.05, -a.y + 0.25], [bx1 + 0.05, -a.y + 0.25], [bx1 + 0.05, a.y - 0.25], [bx0 - 0.05, a.y - 0.25]]), dz + H * 0.78, dz + H * 0.92, "#34495e");
    const mx = vW(o, [(bx0 + bx1) / 2, 0]); M.cyl([mx[0], mx[1], dz + H], [mx[0], mx[1], dz + H + 5], 0.12, "#56606a", { n: 6 });
  }
  const ts = txtStyleOf(o); M.label([o.x, o.y, dz + (+o.accH || 3) + 2], o.label || "Vessel", ts.color || col, 12 * ts.k);
}

// ---- the vessel's cranes as crane models (type "ped" = pedestal crane on a vessel)
const pedModelId = (o, sp) => "V_" + o.id + "_" + sp.id;
function parseChart(txt) {
  if (Array.isArray(txt)) return txt.map(r => [+r[0], +r[1]]).filter(r => r[0] > 0 && r[1] > 0).sort((a, b) => a[0] - b[0]);
  return String(txt || "").split(/[\n;]+/).map(l => l.trim().split(/[\s,:\t=→>-]+/).filter(Boolean).map(Number)).filter(r => r.length >= 2 && r[0] > 0 && r[1] > 0).map(r => [r[0], r[1]]).sort((a, b) => a[0] - b[0]);
}
const chartText = rows => (rows || []).map(r => `${r[0]} ${r[1]}`).join("\n");
function pedModel(o, sp) {
  const L = Math.max(5, +sp.L || 20), base = +o.deckH || 0, top = base + Math.max(1, +sp.pedH || 6), pr = Math.max(0.6, +sp.pedR || 1.2);
  const lat = sp.boomType === "lattice";
  return {
    id: pedModelId(o, sp), name: `${o.label || "Vessel"} – ${sp.name || "crane"}`, short: sp.name || "Vessel crane", type: "ped", vessel: o.id, cap: (+sp.swl || 0) + " t", maxAngle: +sp.maxAngle || 78, custom: true, src: "Vessel crane",
    car: { pedR: pr, base, top, fb: +o.fb || 2.5, front: pr + 0.6, rear: -(pr + 0.6), w: pr * 2, deckH: top - 0.3, carbodyH: top - 0.3 },
    or: null,
    up: { tail: 3.4, cwW: 3.0, cwD: 1.3, cwH: 1.5, cwShape: "rect", deckW: 2.8, deckFront: 2.0, baseH: top, bodyH: 1.8, cab: { lat: [-2.3, -1.3], fwd: [0.1, 2.0], h: 2.2 }, cwLabel: "" },
    boom: lat ? { kind: "lattice", pivot: [1.1, top + 2.2], Lmin: L, Lmax: L, W0: 1.5, D0: 1.5, foot: L / 2, head: L / 2, inserts: [] }
      : { kind: "tele", pivot: [1.1, top + 1.6], Lmin: L, Lmax: L, n: 1, D0: 1.15, W0: 0.95, cyl: [0.8, 0.4] },
    mass: { base: 0, cw: 0 },
    hookblocks: [[+sp.swl || 10, +sp.hb || Math.max(0.2, Math.round((+sp.swl || 10) * 0.02 * 100) / 100)]],
    chartHint: "Enter the crane's load chart in the vessel details."
  };
}
function registerVesselCranes() {
  for (const k of Object.keys(REG.cranes)) if (REG.cranes[k].type === "ped") delete REG.cranes[k];
  for (const k of Object.keys(REG.charts)) if (REG.charts[k].vessel) delete REG.charts[k];
  for (const o of vesselsAll()) for (const sp of o.cranes || []) {
    const C = pedModel(o, sp); REG.cranes[C.id] = C;
    const hc = parseChart(sp.chart), oc = parseChart(sp.chartSea);
    if (hc.length) REG.charts[C.id + "_h"] = { id: C.id + "_h", craneId: C.id, vessel: true, label: "Harbour lift (in port)", cols: [{ L: C.boom.Lmin, caps: hc, note: "" }] };
    if (oc.length) REG.charts[C.id + "_s"] = { id: C.id + "_s", craneId: C.id, vessel: true, label: sp.seaLabel ? "Offshore – " + sp.seaLabel : "Offshore / sea state", cols: [{ L: C.boom.Lmin, caps: oc, note: "" }] };
  }
}
{ const _rr = rebuildRegistry; rebuildRegistry = function (...a) { _rr(...a); try { registerVesselCranes(); } catch (e) { console.warn(e); } }; }
function pedVesselName(cr) { const o = plan.obstacles.find(x => x.id === cr.vessel); return o ? o.label || "vessel" : "vessel"; }
// plan / side / 3D pieces for the pedestal
function pedPlan(C) {
  const s = new Scene(), r = C.car.pedR;
  s.circle("CARRIER", [0, 0], r + 0.35, { fill: "#8f979e", w: 0.8 });
  s.circle("CARRIER", [0, 0], r, { fill: true, w: 1.3 });
  s.text("TEXT", [0, -r - 0.9], "PEDESTAL", 0.4);
  return s;
}
function pedSide(C) {
  const s = new Scene(), k = C.car;
  s.rect("CARRIER", -7, k.base - Math.min(k.fb, 3), 7, k.base, { fill: "#c6ccd2", w: 0.8 });
  s.poly("GROUND", [[-7, k.base], [7, k.base]], { w: 1.2 });
  s.text("TEXT", [-6.8, k.base + 0.5], "VESSEL DECK", 0.45, { anchor: "start" });
  s.rect("CARRIER", -k.pedR, k.base, k.pedR, k.top - 0.3, { fill: true, w: 1.3 });
  s.rect("CARRIER", -k.pedR - 0.3, k.top - 0.5, k.pedR + 0.3, k.top - 0.2, { fill: "#8f979e", w: 0.8 });
  return s;
}
function pedCarrier3D(M, cr, C, P) {
  const k = C.car;
  M.cyl([cr.x, cr.y, k.base], [cr.x, cr.y, k.top - 0.5], k.pedR, P.carrier, { n: 20 });
  M.cyl([cr.x, cr.y, k.top - 0.5], [cr.x, cr.y, k.top - 0.25], k.pedR + 0.35, "#6b737b", { n: 22 });
}
// crane properties: position on the vessel
function pedPropsHTML(c, C) {
  const o = plan.obstacles.find(x => x.id === c.vessel), sp = o?.cranes?.find(s => s.id === c.vc);
  return `<div class="card" style="padding:8px 10px;margin:6px 0"><b>On ${escH(o ? o.label || "vessel" : "vessel")}</b> <span class="small">· ${sp ? `${fx(+sp.swl || 0)} t SWL · ${fx(+sp.L || 0)} m ${sp.boomType === "lattice" ? "lattice" : "box"} boom · pedestal ${fx(+sp.pedH || 0, 1)} m` : ""}</span>
    <label>Side of the vessel<span class="seg" style="display:flex">${[["p", "Port"], ["c", "Centreline"], ["s", "Starboard"]].map(([k, n]) => `<button data-pside="${k}" aria-pressed="${(Math.abs(+c.vy || 0) < 0.05 ? "c" : +c.vy > 0 ? "p" : "s") === k}">${n}</button>`).join("")}</span></label>
    <div class="row">${field("Along from midship (m, + to bow)", "pVx", fx(c.vx ?? 0, 2), "number", 'step="0.1"')}${field("Off centreline (m)", "pVy", fx(Math.abs(c.vy ?? 0), 2), "number", 'step="0.1" min="0"')}</div>
    <p class="small" style="margin:0">Moves with the vessel. Change the chart, SWL or boom in the vessel's details.</p></div>`;
}
// keep a vessel crane on the hull: along-ship within the hull ends, across within the deck edge
function vClampPos(o, lx, ly) { const hw = (+o.w || 60) / 2, hb = (+o.h || 15) / 2, ax = Math.max(-hw + 3.5, Math.min(hw - 3.5, lx)), ay = Math.max(-(hb - 2), Math.min(hb - 2, ly));
  const inside = inPolyPt([ax, ay], vHull(o)); return inside ? [Math.round(ax * 100) / 100, Math.round(ay * 100) / 100] : [Math.round(Math.max(-hw * 0.6, Math.min(hw * 0.6, ax)) * 100) / 100, Math.round(ay * 100) / 100]; }
// one position per vessel crane: the spec and every lift's copy of that crane move together
function setVCranePos(o, spId, lx, ly) {
  [lx, ly] = vClampPos(o, lx, ly);
  const sp = (o.cranes || []).find(s => s.id === spId); if (sp) { sp.lx = Math.round(lx * 100) / 100; sp.ly = Math.round(ly * 100) / 100; }
  (plan.lifts && plan.lifts.length ? plan.lifts.map((L, i) => i === plan.al ? plan.cranes : L.cranes) : [plan.cranes]).forEach(cs => cs.forEach(c => { if (c.vessel === o.id && c.vc === spId) { c.vx = Math.round(lx * 100) / 100; c.vy = Math.round(ly * 100) / 100; c._vw = null; } }));
}
// cranes on one side sit on one line along the rail: setting the off-centreline distance moves them all
function lineUpSide(o, sgn, d) { (o.cranes || []).forEach(sp => { const s2 = Math.abs(+sp.ly || 0) < 0.05 ? 0 : +sp.ly > 0 ? 1 : -1; if (s2 === sgn) setVCranePos(o, sp.id, +sp.lx || 0, sgn * d); }); }
// line every side up once (older plans could have cranes at slightly different distances off the centreline)
function lineUpAll(o) { for (const sgn of [1, -1]) { const on = (o.cranes || []).filter(sp => (Math.abs(+sp.ly || 0) >= 0.05) && Math.sign(+sp.ly) === sgn); if (on.length > 1) lineUpSide(o, sgn, Math.min(...on.map(sp => Math.abs(+sp.ly)))); } }
// spread all of a vessel's cranes evenly along the cargo deck: one side, or alternating both sides
function spreadVCranes(o, how) {
  const list = o.cranes || [], n = list.length; if (!n) return;
  const dk = vDeck(o), off = Math.max(1, (+o.h || 15) / 2 - 2), x0 = dk.x0 + 3, x1 = dk.x1 - 3;
  if (how === "both") { const per = Math.ceil(n / 2); list.forEach((sp, i) => { const k = Math.floor(i / 2), m = i % 2 ? Math.floor(n / 2) : per, t = m > 1 ? k / (m - 1) : 0.5; setVCranePos(o, sp.id, x1 - t * (x1 - x0), i % 2 ? -off : off); }); }
  else list.forEach((sp, i) => { const t = n > 1 ? i / (n - 1) : 0.5; setVCranePos(o, sp.id, x1 - t * (x1 - x0), how === "stbd" ? -off : off); });
}
function wirePedProps(c, C, up) {
  const o = plan.obstacles.find(x => x.id === c.vessel); if (!o) return;
  if ($("pVx")) $("pVx").onchange = e => up(() => setVCranePos(o, c.vc, +e.target.value, +c.vy || 0));
  if ($("pVy")) $("pVy").onchange = e => up(() => lineUpSide(o, +c.vy < 0 ? -1 : 1, Math.abs(+e.target.value)));
  $("props").querySelectorAll("[data-pside]").forEach(b => b.onclick = () => up(() => { const d = Math.abs(+c.vy || 0) || Math.max(1, (+o.h || 15) / 2 - 2), k = b.dataset.pside; setVCranePos(o, c.vc, +c.vx || 0, k === "c" ? 0 : k === "p" ? d : -d); }, true));
}
// place a vessel crane in the current lift
function useVesselCrane(o, sp) {
  registerVesselCranes();
  const C = REG.cranes[pedModelId(o, sp)]; if (!C) return;
  const ch = chartsFor(C.id)[0], ld = plan.loads[0];
  const c = { id: uid(), label: "Crane " + (plan.cranes.length + 1), model: C.id, vessel: o.id, vc: sp.id, vx: +sp.lx || 0, vy: +sp.ly || 0, x: 0, y: 0, heading: vBow(o), orMode: "", chartId: ch ? ch.id : "",
    col: null, L: C.boom.Lmin, hookBlock: C.hookblocks[0][1], blockCap: C.hookblocks[0][0], blockType: (+sp.swl || 0) >= 100 ? "ramshorn" : "single", parts: Math.max(1, Math.min(4, Math.ceil((+sp.swl || 10) / 12))),
    extra: 0, matW: 0, matL: 0, sl: 0, autoBoom: false, attach: { load: ld?.id || "", point: "C" } };
  const p = vW(o, [c.vx, c.vy]); c.x = p[0]; c.y = p[1]; c._vw = [...p];
  setPaint(c, sp.paint || "#e8b90f");
  if (!ld) c.tip = { pick: { free: true, R: Math.min(+sp.L * 0.6, 15), brg: vBow(o) }, set: { free: true, R: Math.min(+sp.L * 0.6, 15), brg: vBow(o) } };
  ensureBoom(c, C);
  plan.cranes.push(c);
  if (ld && (!ld.rig || ld.rig.auto)) { qrApply(ld, null, true); normLoad(ld); }
  sel = { kind: "crane", id: c.id }; markDirty(); renderAll();
  toast(`${c.label} (${o.label}) added to ${plan.lifts?.[plan.al]?.name || "the lift"}${ld ? " and hooked onto " + ld.name : ""}`);
}

// ---- keep cranes and deck loads riding on their vessel
const moved = (a, b) => !b || Math.abs(a[0] - b[0]) > 1e-6 || Math.abs(a[1] - b[1]) > 1e-6;
function syncVessels() {
  const V = {}; for (const o of vesselsAll()) V[o.id] = o;
  registerVesselCranes();
  syncLift && plan.lifts && syncLift();
  const lifts = plan.lifts && plan.lifts.length ? plan.lifts : [{ cranes: plan.cranes, loads: plan.loads }], dragged = [];
  for (const L of lifts) {
    // cranes whose vessel was removed go with it
    const gone = L.cranes.filter(c => c.vessel && !V[c.vessel]);
    if (gone.length) { const keep = L.cranes.filter(c => !gone.includes(c)); L.cranes.length = 0; L.cranes.push(...keep); }
    for (const c of L.cranes) {
      const o = V[c.vessel]; if (!o) continue;
      // dragging slides the crane up / down its own side of the vessel only – it can't leave the hull or change side
      if (c._vw && moved([c.x, c.y], c._vw)) { const l = vL(o, [c.x, c.y]); c.vx = Math.round(l[0] * 100) / 100; dragged.push(c); }
      { const [vx, vy] = vClampPos(o, +c.vx || 0, +c.vy || 0); c.vx = vx; c.vy = vy; }
      const p = vW(o, [+c.vx || 0, +c.vy || 0]); c.x = p[0]; c.y = p[1]; c._vw = [...p]; c.heading = vBow(o);
    }
    for (const ld of L.loads) for (const ph of ["pick", "set"]) {
      const pos = ld[ph]; if (!pos) continue;
      const o = V[pos.onV];
      if (pos.onV && !o) { delete pos.onV; continue; }
      if (o) {
        if (moved([pos.x, pos.y], pos._vw)) {                       // moved by the user / the hook
          if (!vesselInside(o, [pos.x, pos.y])) { if (pos.hDeck && Math.abs((+pos.h || 0) - (+o.deckH || 0)) < 1e-6) pos.h = 0; delete pos.onV; delete pos.vl; delete pos._vw; delete pos._vrot; delete pos.hDeck; continue; }
          pos.vl = vL(o, [pos.x, pos.y]); pos.vr = (pos.rot || 0) - (o.rot || 0);
        } else if (pos._vrot == null || Math.abs((+pos.rot || 0) - pos._vrot) > 0.05) pos.vr = (+pos.rot || 0) - (o.rot || 0);   // turned by the user (handle or typed) – keep the new rotation on the deck
        const p = vW(o, pos.vl || [0, 0]); pos.x = Math.round(p[0] * 1000) / 1000; pos.y = Math.round(p[1] * 1000) / 1000; pos._vw = [pos.x, pos.y];
        pos.rot = Math.round(((pos.vr || 0) + (o.rot || 0)) * 10) / 10; pos._vrot = pos.rot;
        if (pos.hDeck) pos.h = +o.deckH || 0;
      } else {
        const hit = Object.values(V).find(v => vesselInside(v, [pos.x, pos.y]));
        if (hit && !(drag && drag.op && drag.op.carry)) {
          pos.onV = hit.id; pos.vl = vL(hit, [pos.x, pos.y]); pos.vr = (pos.rot || 0) - (hit.rot || 0); pos._vw = [pos.x, pos.y]; pos._vrot = +pos.rot || 0;
          if (!(+pos.h > 0.5) || pos.h == null) { pos.h = +hit.deckH || 0; pos.hDeck = true; }
        }
      }
    }
  }
  // a vessel crane dragged on the plan: the spec and the same crane in the other lifts follow
  for (const c of dragged) { const o = V[c.vessel]; setVCranePos(o, c.vc, c.vx, c.vy); for (const L of lifts) for (const x of L.cranes) if (x.vessel === o.id && x.vc === c.vc) { const p = vW(o, [x.vx, x.vy]); x.x = p[0]; x.y = p[1]; x._vw = [...p]; } }
}
{ const _ra = renderAll; renderAll = function (k) { try { syncVessels(); } catch (e) { console.warn(e); } _ra(k); }; }
{ const _rs = renderSite; renderSite = function (...a) { try { syncVessels(); } catch (e) { console.warn(e); } return _rs(...a); }; }

// ================= Vessel dialogs =================
// Two separate uses, kept apart on purpose:
//  • "object" – the vessel as part of the site: hull, deck, accommodation, which side is alongside. No cranes here.
//  • "crane"  – lift with the vessel's own crane(s): choose / create the vessel, then enter each crane (its own spec + chart).
document.body.insertAdjacentHTML("beforeend", `
<dialog id="dVessel" style="width:min(980px,97vw)"><div class="dh"><div><b id="vdTitle">Add a vessel</b><div class="small" id="vdSub"></div></div><span class="btnrow"><button class="pri" id="vdOk">Add to site</button><button id="vdLib">Save to vessel library</button><button data-close>Close</button></span></div><div class="db">
  <div id="vdPick"></div>
  <div id="vdLibList"></div>
  <details id="vdSpec" open><summary id="vdSpecSum" style="cursor:pointer;font-weight:600;margin:2px 0 10px">Vessel specification</summary>
  <div class="card" style="margin-bottom:10px"><div class="ch"><b>Vessel spec sheet, GA drawing or photo</b><span class="small">PDF or images</span></div><div style="padding:10px;display:flex;flex-direction:column;gap:8px">
    <div class="btnrow"><button id="vdUp" class="pri">Upload vessel spec / GA / photo…</button><input type="file" id="vdFile" accept="application/pdf,image/*" multiple hidden>
    <label class="chk"><input type="checkbox" id="vdImgUse"> Use the first page / photo as the deck image on the plan</label></div>
    <div id="vdStatus" class="status" hidden></div><div id="vdThumb"></div>
  </div></div>
  <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px" class="vdgrid">
    <div class="card"><div class="ch"><b>Vessel</b></div><div style="padding:10px;display:flex;flex-direction:column;gap:8px" id="vdForm"></div></div>
    <div class="card"><div class="ch"><b>Preview</b><span class="small">plan · bow to the right · port side up</span></div><div id="vdPrev" style="padding:6px"></div></div>
  </div></details>
  <div class="card" id="vdCrCard" style="margin-top:12px"><div class="ch"><b>Vessel cranes</b><button id="vdAddCr">+ Add a crane</button></div>
    <p class="small" style="padding:6px 10px 0;margin:0">Enter every crane on the vessel. Upload each crane's own spec sheet / load chart to fill it in, set which side it is on, and tick the crane(s) to use for this lift.</p>
    <div id="vdCranes" style="padding:10px;display:flex;flex-direction:column;gap:10px"></div></div>
  <input type="file" id="vdCrFile" accept="application/pdf,image/*" multiple hidden>
</div></dialog>`);
const VD = { o: null, edit: false, files: [], lib: [], mode: "object", use: new Set() };
// a new crane spec goes on the SAME side as the last crane entered, 10 m aft of the last one on that side (never off the hull)
function newCraneSpec(o, i) {
  const dk = vDeck(o), list = o.cranes || [], last = list[list.length - 1], off = Math.max(1, (+o.h || 15) / 2 - 2);
  const sgn = last ? (Math.abs(+last.ly || 0) < 0.05 ? 0 : Math.sign(+last.ly)) : 1, same = list.filter(sp => (Math.abs(+sp.ly || 0) < 0.05 ? 0 : Math.sign(+sp.ly)) === sgn);
  const d = same.length ? Math.abs(+same[same.length - 1].ly || 0) : off;
  let lx = same.length ? Math.min(...same.map(sp => +sp.lx || 0)) - 10 : dk.x1 - 3; if (lx < dk.x0 + 2) lx = dk.x1 - 3 - (same.length * 5) % Math.max(5, dk.x1 - dk.x0 - 5);
  return { id: uid(), name: "Deck crane " + (i + 1), swl: 25, L: 24, boomType: "box", maxAngle: 78, lx: Math.round(lx * 10) / 10, ly: sgn * d, pedH: 6, chart: [] };
}
function openVesselDialog(o, mode = "object") {
  VD.mode = mode; VD.edit = !!o; VD.o = o ? clone(o) : newVessel("psv"); VD.files = []; VD.img0 = null; VD.imgAsset = null; VD.imgRot = null;
  VD.o.cranes = VD.o.cranes || [];
  if (!VD.o.cranes.length && (VD.o.cranesFound || []).length) { VD.o.cranes = clone(VD.o.cranesFound); delete VD.o.cranesFound; }
  VD.use = new Set();
  if (mode === "crane") {
    if (!VD.o.cranes.length) VD.o.cranes.push(newCraneSpec(VD.o, 0));
    const inUse = plan.cranes.some(c => c.vessel === VD.o.id);
    VD.use = new Set(inUse ? [] : [VD.o.cranes[0].id]);
  }
  $("vdStatus").hidden = true; $("vdThumb").innerHTML = ""; $("vdImgUse").checked = !!VD.o.img;
  $("vdSpec").open = !(mode === "crane" && VD.edit);
  renderVD(); if (!$("dVessel").open) $("dVessel").showModal();
}
function renderVD() {
  const o = VD.o, cm = VD.mode === "crane", f = (lab, k, step = "0.1", extra = "") => `<label>${lab}<input type="number" data-vk="${k}" value="${o[k] ?? ""}" step="${step}" ${extra}></label>`;
  $("vdTitle").textContent = cm ? "Lift with a vessel's crane" : VD.edit ? "Vessel – " + (o.label || "") : "Add a vessel to the site";
  $("vdSub").textContent = cm ? "Choose the vessel, then enter its crane(s) – each with its own spec / load chart." : "The vessel and its cranes – upload the spec sheet to fill both in. Tick a crane to lift with it in this lift.";
  $("vdOk").textContent = cm ? "Save & use ticked crane(s)" : VD.edit ? "Save vessel" : "Add to site";
  $("vdCrCard").hidden = false;
  const V = vesselsAll();
  $("vdPick").innerHTML = cm ? `<div class="card" style="padding:10px;margin-bottom:10px"><label>Vessel<select id="vdSel"><option value="">+ New vessel – from its spec sheet</option>${V.map(v => `<option value="${v.id}" ${v.id === o.id ? "selected" : ""}>${escH(v.label || "Vessel")} · ${fx(+v.w || 0)} × ${fx(+v.h || 0)} m</option>`).join("")}</select></label></div>` : "";
  $("vdSpecSum").textContent = cm ? `Vessel specification – ${o.label || "new vessel"} · ${fx(+o.w || 0)} × ${fx(+o.h || 0)} m (click to ${$("vdSpec").open ? "hide" : "edit"})` : "Vessel specification";
  $("vdLibList").innerHTML = VD.lib.length && !VD.edit ? `<div class="btnrow" style="align-items:center;margin-bottom:10px"><span class="small">Vessel library:</span>${VD.lib.map(v => `<span class="ins" style="cursor:pointer" data-vlib="${v.id}">${escH(v.label || v.name || "Vessel")} · ${fx(+v.w || 0)} m${(v.cranes || []).length ? ` · ${v.cranes.length} crane${v.cranes.length > 1 ? "s" : ""}` : ""}<button data-vlibdel="${v.id}" title="Delete from library">×</button></span>`).join("")}</div>` : "";
  $("vdForm").innerHTML = `
    <div class="row"><label>Name<input type="text" data-vk="label" value="${escH(o.label || "")}"></label><label>Type<select data-vk="vkind">${Object.entries(VESSEL_KINDS).map(([k, n]) => `<option value="${k}" ${o.vkind === k ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
    <div class="row3">${f("Length overall (m)", "w")}${f("Beam (m)", "h")}<label>Alongside<select data-vk="berth"><option value="port" ${o.berth !== "stbd" ? "selected" : ""}>Port side to the quay</option><option value="stbd" ${o.berth === "stbd" ? "selected" : ""}>Starboard side to the quay</option></select></label></div>
    <div class="row"><label>Accommodation<select data-vk="acc">${[["fwd", "Forward (PSV)"], ["aft", "Aft"], ["none", "None (barge)"]].map(([k, n]) => `<option value="${k}" ${o.acc === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>${f("Accommodation length (m)", "accL")}</div>
    <label>Hull colour<span class="swatches">${["#1f4e79", "#b22222", "#2e8b57", "#34393f", "#d35400", "#6c3fb5", "#e8b90f"].map(c => `<button class="sw" data-vcol="${c}" aria-pressed="${o.color === c}" style="background:${c}"></button>`).join("")}<input type="color" data-vk="color" value="${o.color || "#1f4e79"}"></span></label>
    ${o.aiNotes ? `<p class="small">${escH(o.aiNotes)}</p>` : ""}`;
  const dk = vDeck(o);
  const sc = vesselScene({ ...o, x: 0, y: 0, rot: 0, imgOn: false, cranes: o.cranes || [] });
  for (const sp of o.cranes || []) { const p = [+sp.lx || 0, +sp.ly || 0]; sc.circle("LOAD", p, 1.3, { fill: VD.use.has(sp.id) ? "#1d7a4f" : "#f2c200", color: "#333", w: 1 }); sc.text("TEXT", [p[0], p[1] + (p[1] >= 0 ? 2.2 : -2.2)], sp.name || "Crane", 0.9, { bold: true }); }
  sc.text("TEXT", [0, (+o.h || 15) / 2 + 3.2], "PORT", 1, { bold: true, color: "#b22222" }); sc.text("TEXT", [0, -(+o.h || 15) / 2 - 4.2], "STARBOARD", 1, { bold: true, color: "#1d7a4f" });
  $("vdPrev").innerHTML = toSVG(sc, { pad: 2, noSize: true, lw: 0.08 }) + `<p class="small" style="margin:4px 0 0">Open cargo deck ≈ ${fx(dk.x1 - dk.x0, 1)} × ${fx(dk.y * 2, 1)} m</p>`;
  const side = sp => Math.abs(+sp.ly || 0) < 0.05 ? "c" : +sp.ly > 0 ? "p" : "s";
  $("vdCranes").innerHTML = (o.cranes || []).length > 1 ? `<div class="btnrow" style="align-items:center"><b>${o.cranes.length} cranes on this vessel:</b>${o.cranes.map((sp, i) => `<span class="ins" style="cursor:pointer" data-vcjump="${i}">${escH(sp.name || "Crane " + (i + 1))} · ${fx(+sp.swl || 0)} t</span>`).join("")}</div>` : "";
  $("vdCranes").innerHTML += (o.cranes || []).map((sp, i) => `<div class="card" style="padding:8px 10px" data-vci="${i}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px"><label class="chk" style="font-weight:600"><input type="checkbox" data-cuse="${sp.id}" ${VD.use.has(sp.id) || plan.cranes.some(c => c.vessel === o.id && c.vc === sp.id) ? "checked" : ""} ${plan.cranes.some(c => c.vessel === o.id && c.vc === sp.id) ? "disabled" : ""}> ${plan.cranes.some(c => c.vessel === o.id && c.vc === sp.id) ? "In use in this lift" : "Use for this lift"}</label>
        <span class="btnrow"><button data-cup="${i}">Upload this crane's spec / load chart…</button><span class="small" id="vdCrSt${i}"></span></span></div>
      <div class="row"><label>Crane name<input type="text" data-ck="name" value="${escH(sp.name || "")}"></label><label>Boom<select data-ck="boomType"><option value="box" ${sp.boomType !== "lattice" ? "selected" : ""}>Box / telescopic</option><option value="lattice" ${sp.boomType === "lattice" ? "selected" : ""}>Lattice</option></select></label></div>
      <div class="row3">${["SWL (t)|swl", "Boom length (m)|L", "Max boom angle (°)|maxAngle"].map(x => { const [lab, k] = x.split("|"); return `<label>${lab}<input type="number" data-ck="${k}" step="0.1" value="${sp[k] ?? ""}"></label>`; }).join("")}</div>
      <div class="row3"><label>Side of the vessel<span class="seg" style="display:flex">${[["p", "Port"], ["c", "Centre"], ["s", "Starboard"]].map(([k, n]) => `<button data-cside="${i}:${k}" aria-pressed="${side(sp) === k}">${n}</button>`).join("")}</span></label>
        ${["Along from midship (m, + bow)|lx", "Distance off centreline (m)|lyAbs"].map(x => { const [lab, k] = x.split("|"); return `<label>${lab}<input type="number" data-ck="${k}" step="0.1" value="${k === "lyAbs" ? Math.abs(+sp.ly || 0) : sp[k] ?? ""}"></label>`; }).join("")}</div>
      <div class="row3"><label>Pedestal height above deck (m)<input type="number" data-ck="pedH" step="0.1" value="${sp.pedH ?? ""}"></label><span></span><span></span></div>
      <div class="row"><label>Harbour lift chart – radius (m) and SWL (t), one pair per line<textarea data-ck="chart" rows="5" placeholder="6 50&#10;10 35&#10;15 22&#10;20 15">${escH(chartText(parseChart(sp.chart)))}</textarea></label>
      <label>Offshore chart (optional)<input type="text" data-ck="seaLabel" placeholder="e.g. Hs 2.0 m" value="${escH(sp.seaLabel || "")}"><textarea data-ck="chartSea" rows="3" placeholder="6 30&#10;10 20">${escH(chartText(parseChart(sp.chartSea)))}</textarea></label></div>
      <div class="btnrow"><button data-cdel="${i}" class="danger">Remove this crane</button>${parseChart(sp.chart).length ? `<span class="small">${parseChart(sp.chart).length} chart points · ${fx(parseChart(sp.chart)[0][0])}–${fx(parseChart(sp.chart).slice(-1)[0][0])} m</span>` : `<span class="small" style="color:var(--amber)">No chart yet – capacity checks need it.</span>`}</div></div>`).join("");
  // wiring
  const root = $("dVessel");
  if ($("vdSel")) $("vdSel").onchange = e => { const v = vesselsAll().find(x => x.id === e.target.value); openVesselDialog(v || null, "crane"); };
  root.querySelectorAll("[data-vk]").forEach(el => el.onchange = () => {
    const k = el.dataset.vk, was = o[k]; o[k] = el.type === "number" ? (el.value === "" ? "" : +el.value) : el.value;
    if (k === "vkind") { const d = VESSEL_PRESET[o.vkind]; Object.assign(o, { acc: d.acc, accL: d.accL || o.accL, accH: d.accH || o.accH }); }
    if (k === "accH") o.hgt = o.accH;
    if (k === "berth" && was !== o[k] && VD.edit) setBerth(o, o.berth, true);
    setTimeout(renderVD, 0);
  });
  root.querySelectorAll("[data-vcol]").forEach(b => b.onclick = () => { o.color = b.dataset.vcol; renderVD(); });
  root.querySelectorAll("[data-vci]").forEach(card => {
    const sp = o.cranes[+card.dataset.vci];
    card.querySelectorAll("[data-ck]").forEach(el => el.onchange = () => {
      const k = el.dataset.ck;
      if (k === "lyAbs") { const sgn = +sp.ly < 0 ? -1 : 1; sp.ly = sgn * Math.abs(+el.value || 0); }
      else sp[k] = el.type === "number" ? (el.value === "" ? "" : +el.value) : k === "chart" || k === "chartSea" ? parseChart(el.value) : el.value;
      setTimeout(renderVD, 0);
    });
  });
  root.querySelectorAll("[data-cside]").forEach(b => b.onclick = () => { const [i, k] = b.dataset.cside.split(":"), sp = o.cranes[+i], d = Math.abs(+sp.ly || 0) || Math.max(1, (+o.h || 15) / 2 - 2); sp.ly = k === "c" ? 0 : k === "p" ? d : -d; renderVD(); });
  root.querySelectorAll("[data-cuse]").forEach(el => el.onchange = () => { if (el.checked) VD.use.add(el.dataset.cuse); else VD.use.delete(el.dataset.cuse); renderVD(); });
  root.querySelectorAll("[data-vcjump]").forEach(el => el.onclick = () => { const c = root.querySelector(`[data-vci="${el.dataset.vcjump}"]`); if (c) c.scrollIntoView({ block: "start", behavior: "smooth" }); });
  root.querySelectorAll("[data-cup]").forEach(b => b.onclick = () => { VD.crIdx = +b.dataset.cup; $("vdCrFile").click(); });
  root.querySelectorAll("[data-cdel]").forEach(b => b.onclick = () => { const sp = o.cranes.splice(+b.dataset.cdel, 1)[0]; if (sp) VD.use.delete(sp.id); renderVD(); });
  root.querySelectorAll("[data-vlib]").forEach(el => el.onclick = e => { if (e.target.closest("[data-vlibdel]")) return; const v = VD.lib.find(x => x.id === el.dataset.vlib); if (!v) return; const keep = { id: VD.o.id, x: VD.o.x, y: VD.o.y, rot: VD.o.rot }; VD.o = { ...clone(v.vessel || v), ...keep }; VD.o.cranes = (VD.o.cranes || []).map(c => ({ ...c, id: c.id || uid() })); if (VD.mode === "crane" && VD.o.cranes.length) VD.use = new Set([VD.o.cranes[0].id]); renderVD(); });
  root.querySelectorAll("[data-vlibdel]").forEach(b => b.onclick = async () => { if (!CAP.db) return; try { await CAP.db.doc("vessels/" + b.dataset.vlibdel).delete(); } catch (e) { toast("Couldn't delete"); } });
}
$("vdSpec").addEventListener("toggle", () => { if ($("dVessel").open && VD.mode === "crane") $("vdSpecSum").textContent = `Vessel specification – ${VD.o.label || "new vessel"} · ${fx(+VD.o.w || 0)} × ${fx(+VD.o.h || 0)} m (click to ${$("vdSpec").open ? "hide" : "edit"})`; });
$("vdAddCr").onclick = () => { VD.o.cranes = VD.o.cranes || []; const sp = newCraneSpec(VD.o, VD.o.cranes.length); VD.o.cranes.push(sp); renderVD(); };
$("vdUp").onclick = () => $("vdFile").click();
$("vdFile").onchange = async e => {
  const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
  VD.files = files;
  const st = $("vdStatus"); st.hidden = false; st.className = "status busy"; st.textContent = "Preparing the pages…";
  try {
    const images = await toImages(files); if (!images.length) throw { message: "unsupported file" };
    $("vdThumb").innerHTML = `<img src="${URL.createObjectURL(images[0])}" style="max-width:100%;max-height:220px;border:1px solid var(--line);border-radius:4px">`;
    VD.img0 = images[0];
    if (CAP.sample && CAP.sampleImages) {
      st.textContent = "Reading the vessel with Claude… (15–60 s)";
      const r = await CAP.sample.json(VESSEL_PROMPT, { images, modelTier: "complex" });
      applyVesselAI(r);
      st.className = "status ok"; st.textContent = "Read. Check the dimensions" + (VD.mode === "crane" ? ", crane positions and every chart value against the vessel's certificates" : "") + " before use.";
    } else {
      st.className = "status"; st.textContent = CAP.local ? "Automatic reading needs Claude – click ✦ Link Claude at the top – type the details below. The image can still be used as the deck image." : "Reading isn't available here – type the details below. The image can still be used as the deck image.";
      $("vdImgUse").checked = true;
    }
  } catch (err) { st.className = "status bad"; st.textContent = "Couldn't read that file (" + (err.code || err.message || err) + "). Type the details below."; }
};
// one crane's own spec sheet / load chart
const CRANE_SPEC_PROMPT = `The images are the specification sheet and/or load chart of ONE crane mounted on a ship (pedestal / deck crane). Return JSON only:
{"name": model or name, "swl_t": maximum safe working load, "boom_length_m": n, "boom_type": "lattice"|"box",
 "pedestal_height_m": slew ring height above deck or null, "max_boom_angle_deg": n or null, "min_radius_m": n or null, "max_radius_m": n or null,
 "chart_harbour": [[radius_m, swl_t], ...] the harbour / in-port chart (main hook), every point given,
 "chart_offshore": [[radius_m, swl_t], ...] offshore chart or [], "offshore_label": e.g. "Hs 2.5 m" or "",
 "notes": what you assumed or could not read}`;
$("vdCrFile").onchange = async e => {
  const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
  const i = VD.crIdx, sp = VD.o.cranes[i], st = $("vdCrSt" + i); if (!sp) return;
  if (!CAP.sample || !CAP.sampleImages) { if (st) st.textContent = CAP.local ? "Reading needs Claude (✦ Link Claude at the top) – type the chart in." : "Reading isn't available here – type the chart in."; return; }
  if (st) st.textContent = "Reading with Claude… (10–40 s)";
  try {
    const images = await toImages(files); const r = await CAP.sample.json(CRANE_SPEC_PROMPT, { images, modelTier: "complex" });
    if (r.name) sp.name = String(r.name).slice(0, 50); if (+r.swl_t > 0) sp.swl = +r.swl_t; if (+r.boom_length_m > 0) sp.L = +r.boom_length_m;
    if (r.boom_type) sp.boomType = r.boom_type === "lattice" ? "lattice" : "box"; if (+r.pedestal_height_m > 0) sp.pedH = +r.pedestal_height_m; if (+r.max_boom_angle_deg > 0) sp.maxAngle = +r.max_boom_angle_deg;
    const hc = parseChart(r.chart_harbour || []), oc = parseChart(r.chart_offshore || []); if (hc.length) sp.chart = hc; if (oc.length) { sp.chartSea = oc; sp.seaLabel = r.offshore_label || sp.seaLabel || ""; }
    sp.aiNotes = r.notes || ""; renderVD(); const st2 = $("vdCrSt" + i); if (st2) st2.textContent = "Read – check every chart value against the crane's certificate." + (r.notes ? " " + (Array.isArray(r.notes) ? r.notes.join("; ") : r.notes) : "");
  } catch (err) { const st2 = $("vdCrSt" + i); if (st2) st2.textContent = "Couldn't read it (" + (err.code || err.message || err) + ")"; }
};
const VESSEL_PROMPT = `The images are a vessel's specification sheet, general arrangement (GA) drawing, deck plan or photo. Read the vessel and any cranes on board. Return JSON only:
{"name": vessel name or null, "kind": "psv"|"barge"|"cargo"|"tug"|"other",
 "loa_m": length overall, "beam_m": breadth moulded, "freeboard_m": main deck height above the waterline if stated or clearly estimable (else null),
 "accommodation": "fwd"|"aft"|"none", "accommodation_length_m": number or null, "accommodation_height_m": top of the superstructure above the main deck or null,
 "cargo_deck": {"length_m": n, "width_m": n, "strength_t_m2": n or null} or null,
 "cranes": EVERY crane on board – one entry per crane (a ship with 4 cranes returns 4 entries, even if they are identical; repeat the data for each) [{"name": text, "swl_t": safe working load, "boom_length_m": n, "boom_type": "lattice"|"box",
   "along_from_midship_m": pedestal position along the ship from midship, + towards the bow, "off_centreline_m": + to port, - to starboard,
   "pedestal_height_m": slew ring height above the main deck (estimate 5 if not stated), "max_boom_angle_deg": n or null,
   "chart_harbour": [[radius_m, swl_t], ...] harbour / in-port lift chart, as many points as given,
   "chart_offshore": [[radius_m, swl_t], ...] offshore chart for the stated sea state or [], "offshore_label": e.g. "Hs 2.5 m" or ""}],
 "image_is_plan_view": true only if the FIRST image is a top / plan view of the whole vessel that could be laid over the hull outline,
 "image_bow": "right"|"left"|"up"|"down" – where the bow points in that first image,
 "notes": short list of what you assumed or could not read}`;
function applyVesselAI(r) {
  const o = VD.o;
  if (r.kind && VESSEL_KINDS[r.kind]) { o.vkind = r.kind; const d = VESSEL_PRESET[r.kind]; Object.assign(o, { acc: d.acc, accL: d.accL, accH: d.accH, fb: d.fb }); }
  if (r.name) o.label = String(r.name).slice(0, 60);
  if (+r.loa_m > 0) o.w = +r.loa_m; if (+r.beam_m > 0) o.h = +r.beam_m; if (+r.freeboard_m > 0) o.fb = +r.freeboard_m;
  if (["fwd", "aft", "none"].includes(r.accommodation)) o.acc = r.accommodation;
  if (+r.accommodation_length_m > 0) o.accL = +r.accommodation_length_m; if (+r.accommodation_height_m > 0) o.accH = o.hgt = +r.accommodation_height_m;
  if (r.cargo_deck && +r.cargo_deck.strength_t_m2 > 0) o.deckStrength = +r.cargo_deck.strength_t_m2;
  const found = (r.cranes || []).map((c, i) => ({ id: uid(), name: c.name || "Deck crane " + (i + 1), swl: +c.swl_t || "", L: +c.boom_length_m || "", boomType: c.boom_type === "lattice" ? "lattice" : "box",
    lx: +c.along_from_midship_m || 0, ly: +c.off_centreline_m || 0, pedH: +c.pedestal_height_m || 5, maxAngle: +c.max_boom_angle_deg || 78,
    chart: parseChart(c.chart_harbour || []), chartSea: parseChart(c.chart_offshore || []), seaLabel: c.offshore_label || "" }));
  if (found.length) { o.cranes = found; delete o.cranesFound; VD.use = VD.mode === "crane" ? new Set([found[0].id]) : new Set(); }
  o.aiNotes = r.notes ? "Claude's notes: " + (Array.isArray(r.notes) ? r.notes.join("; ") : r.notes) : "";
  const use = !!r.image_is_plan_view; $("vdImgUse").checked = use;
  VD.imgRot = { right: 0, left: 180, up: 90, down: 270 }[r.image_bow] ?? 0;
  renderVD();
}
async function vdImage() {
  if (!$("vdImgUse").checked) return VD.o.img && VD.edit ? VD.o.img : null;
  if (!VD.img0) return VD.o.img || null;
  let url;
  if (CAP.assets && !CAP.local) { try { const a = await CAP.assets.upload(new File([VD.img0], "vessel.jpg", { type: "image/jpeg" })); url = a.url; VD.imgAsset = a.id; } catch (e) { url = null; } }
  if (!url) url = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(VD.img0); });
  return VD.imgAsset && !CAP.local ? { url, asset: VD.imgAsset } : { url };
}
// ---- berth: port / starboard side to the quay
function nearestQuaySeg(o) {
  let best = null;
  for (const q of plan.obstacles) if (q.type === "quay" && (q.pts || []).length > 1) for (let i = 0; i < q.pts.length - 1; i++) { const d = segDist([o.x, o.y], q.pts[i], q.pts[i + 1]); if (!best || d < best.d) best = { d, a: q.pts[i], b: q.pts[i + 1] }; }
  return best;
}
function berthAlongside(o) {
  const q = nearestQuaySeg(o); if (!q) return false;
  const L = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) || 1, d = [(q.b[0] - q.a[0]) / L, (q.b[1] - q.a[1]) / L], n = [-d[1], d[0]];   // n = land side of the quay line
  const bow = o.berth === "stbd" ? [-d[0], -d[1]] : d;       // port side to: bow along the line so port (left of bow) faces the land
  o.rot = Math.round(((-Math.atan2(bow[1], bow[0]) / D2R) % 360 + 360) % 360 * 10) / 10;
  let t = ((o.x - q.a[0]) * d[0] + (o.y - q.a[1]) * d[1]); t = Math.max(0, Math.min(L, t));
  const off = (+o.h || 15) / 2 + 1.0;                        // fender gap 1 m
  o.x = Math.round((q.a[0] + d[0] * t - n[0] * off) * 100) / 100; o.y = Math.round((q.a[1] + d[1] * t - n[1] * off) * 100) / 100;
  return true;
}
function setBerth(o, side, quiet) {
  const was = o.berth || "port"; o.berth = side;
  if (!berthAlongside(o) && was !== side) o.rot = ((+o.rot || 0) + 180) % 360;   // no quay drawn: turn the vessel round
  if (!quiet) toast(`${o.label || "Vessel"}: ${side === "stbd" ? "starboard" : "port"} side to${nearestQuaySeg(o) ? " the quay" : ""}`);
}
$("vdOk").onclick = async () => {
  const o = VD.o; o.w = Math.max(5, +o.w || 60); o.h = Math.max(3, +o.h || 15); o.hgt = +o.accH || 0;
  const img = await vdImage(); if (img) { o.img = img; if (o.imgOn == null) o.imgOn = true; if (VD.imgRot != null && !VD.edit) o.imgRot = VD.imgRot; } else if (!$("vdImgUse").checked) { delete o.img; }
  (o.cranes || []).forEach(c => { c.id = c.id || uid(); c.chart = parseChart(c.chart); c.chartSea = parseChart(c.chartSea); });
  const isNew = !plan.obstacles.some(x => x.id === o.id);
  if (isNew) { plan.obstacles.push(o); berthAlongside(o); }
  else { const i = plan.obstacles.findIndex(x => x.id === o.id); plan.obstacles[i] = o; }
  // placed cranes follow their spec (side / position)
  for (const L of plan.lifts || [{ cranes: plan.cranes }]) for (const c of L.cranes) if (c.vessel === o.id) { const sp = (o.cranes || []).find(s => s.id === c.vc); if (sp) { c.vx = +sp.lx || 0; c.vy = +sp.ly || 0; c._vw = null; } }
  $("dVessel").close();
  if (VD.mode === "crane" || VD.use.size) {
    registerVesselCranes();
    const use = (o.cranes || []).filter(sp => VD.use.has(sp.id) && !plan.cranes.some(c => c.vessel === o.id && c.vc === sp.id));
    for (const sp of use) useVesselCrane(o, sp);
    if (!use.length) { sel = { kind: "obs", id: o.id }; markDirty(); renderAll(); }
    if (isNew) fitView();
    return;
  }
  sel = { kind: "obs", id: o.id }; markDirty(); renderAll(); if (isNew) fitView();
  toast(!isNew ? "Vessel updated" : `${o.label} added to the site${nearestQuaySeg(o) ? ` – berthed ${o.berth === "stbd" ? "starboard" : "port"} side to the quay` : " – drag it into position, rotate with the round handle"}`, 5000);
};
$("vdLib").onclick = async () => {
  if (!CAP.db) { toast("Saving isn't available here"); return; }
  const o = clone(VD.o); delete o.x; delete o.y; const id = o.libId || uid(); o.libId = id;
  try { await CAP.db.doc("vessels/" + id).set({ label: o.label, w: o.w, cranes: o.cranes, vessel: o, updated: Date.now() }); VD.o.libId = id; toast("Saved to the vessel library"); }
  catch (e) { toast("Couldn't save (" + (e.code || e) + ")"); }
};
function subscribeVessels() { if (!CAP.db || subscribeVessels.on) return; subscribeVessels.on = true; CAP.db.collection("vessels").onSnapshot(s => { VD.lib = s.docs.map(d => ({ id: d.id, ...d.data() })); if ($("dVessel").open) renderVD(); }, e => console.warn(e)); }
if (CAP.db) subscribeVessels(); else { const _sl = subscribeLibrary; subscribeLibrary = function (...a) { _sl(...a); subscribeVessels(); }; }

// ---- vessel section in the properties panel
function vesselPropsHTML(o) {
  const hasQ = !!nearestQuaySeg(o), side = sp => Math.abs(+sp.ly || 0) < 0.05 ? "c" : +sp.ly > 0 ? "p" : "s";
  const usedIn = sp => { const out = []; (plan.lifts || [{ cranes: plan.cranes, name: "this lift" }]).forEach((L, i) => (i === plan.al ? plan.cranes : L.cranes).forEach(c => { if (c.vessel === o.id && c.vc === sp.id) out.push({ c, L: plan.lifts && plan.lifts.length > 1 ? liftNo(i) : "" }); })); return out; };
  const list = o.cranes || [], nUnused = list.filter(sp => !usedIn(sp).length).length;
  const cr = list.map(sp => { const inUse = plan.cranes.find(c => c.vessel === o.id && c.vc === sp.id), uses = usedIn(sp), ch = parseChart(sp.chart), cs = parseChart(sp.chartSea);
    const onHull = inPolyPt([+sp.lx || 0, +sp.ly || 0], vHull(o)), sd = { p: "Port", c: "Centreline", s: "Starboard" }[side(sp)];
    const rows = [["SWL", fx(+sp.swl || 0) + " t"], ["Boom length", fx(+sp.L || 0) + " m" + (sp.boomType === "lattice" ? " lattice" : " box")], ["Max boom angle", fx(+sp.maxAngle || 78) + "°"], ["Pedestal height", fx(+sp.pedH || 6) + " m above deck"],
      ["Position", `${fx(Math.abs(+sp.lx || 0), 1)} m ${(+sp.lx || 0) >= 0 ? "fwd" : "aft"} of midship · ${fx(Math.abs(+sp.ly || 0), 1)} m ${sd.toLowerCase()}`],
      ["Harbour chart", ch.length ? `${ch.length} points · ${fx(ch[0][0])}–${fx(ch[ch.length - 1][0])} m · ${fx(ch[0][1])}–${fx(ch[ch.length - 1][1])} t` : "none – capacity checks need it"],
      ["Offshore chart", cs.length ? `${sp.seaLabel ? escH(sp.seaLabel) + " · " : ""}${cs.length} points` : "–"]];
    return `<details class="vcr"><summary><span class="vcr-t"><b>${escH(sp.name || "Crane")}</b><span class="small">${fx(+sp.swl || 0)} t · ${fx(+sp.L || 0)} m · ${sd}</span></span>
        <span class="vcr-tags">${ch.length ? "" : `<span class="tag warn">no chart</span>`}${onHull ? "" : `<span class="tag bad">off the vessel</span>`}${uses.length ? `<span class="tag good">in use${uses.length > 1 || uses[0].L ? ` · ${uses.length} lift${uses.length > 1 ? "s" : ""}` : ""}</span>` : ""}</span></summary>
      <table class="vcr-spec">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}${uses.length ? `<tr><td>Used as</td><td>${uses.map(u => escH(u.c.label) + (u.L ? " (" + escH(u.L) + ")" : "")).join(", ")}</td></tr>` : ""}</table>
      <div class="row" style="padding:0 9px">${field("Along from midship (m, + bow)", "vcx_" + sp.id, fx(+sp.lx || 0, 2), "number", 'step="0.5" data-vcx="' + sp.id + '"')}${field("Off centreline (m)", "vcy_" + sp.id, fx(Math.abs(+sp.ly || 0), 2), "number", 'step="0.1" min="0" data-vcy="' + sp.id + '"')}</div>
      <div class="btnrow" style="align-items:center"><span class="seg">${[["p", "P"], ["c", "C"], ["s", "S"]].map(([k, n]) => `<button data-vside="${sp.id}:${k}" aria-pressed="${side(sp) === k}" title="${{ p: "Port side", c: "Centreline", s: "Starboard side" }[k]}">${n}</button>`).join("")}</span>
        ${inUse ? "" : `<button data-vuse="${sp.id}">Use for this lift</button>`}<button data-vedit="${sp.id}">Edit spec…</button><button class="danger" data-vdel="${sp.id}">${uses.length ? "Remove…" : "Remove"}</button></div></details>`; }).join("");
  return `<div id="vProps" style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
    <label>Alongside<span class="seg" style="display:flex"><button id="vBerthP" aria-pressed="${o.berth !== "stbd"}">Port side to</button><button id="vBerthS" aria-pressed="${o.berth === "stbd"}">Starboard side to</button></span></label>
    ${hasQ ? `<button id="vSnap">Berth alongside the quay edge</button>` : `<p class="small" style="margin:0">Draw the quay edge (Objects → Marine) to berth the vessel against it automatically.</p>`}
    ${o.img ? `<h4>Deck image</h4>
      <div class="row"><label class="chk"><input type="checkbox" id="vImgOn" ${o.imgOn !== false ? "checked" : ""}> Show on the plan</label><label>Opacity<input type="range" id="vImgOp" min="0.2" max="1" step="0.05" value="${o.imgOp ?? 0.85}"></label></div>
      <div class="row3"><label>Rotate<select id="vImgRot">${[0, 90, 180, 270].map(a => `<option value="${a}" ${(+o.imgRot || 0) === a ? "selected" : ""}>${a}°</option>`).join("")}</select></label>${field("Scale %", "vImgK", o.imgK ?? 100, "number", 'step="1"')}<label class="chk" style="margin-top:18px"><input type="checkbox" id="vImgFlip" ${o.imgFlip ? "checked" : ""}> Mirror</label></div>
      <div class="row">${field("Shift along (m)", "vImgDx", o.imgDx ?? 0, "number", 'step="0.1"')}${field("Shift across (m)", "vImgDy", o.imgDy ?? 0, "number", 'step="0.1"')}</div>` : ""}
    <div class="btnrow"><button id="vEdit">Vessel specification…</button></div>
    <div style="border-top:1px solid var(--line2);padding-top:8px;display:flex;flex-direction:column;gap:6px">
      <h4>Lifting with this vessel's crane</h4>
      ${list.length ? `<p class="small" style="margin:0"><b>${list.length} crane${list.length > 1 ? "s" : ""}</b> on this vessel${plan.cranes.some(c => c.vessel === o.id) ? ` · ${plan.cranes.filter(c => c.vessel === o.id).length} used in this lift` : ""} – click one for its spec.</p>` : ""}
      ${list.length > 1 ? `<label>Spread the cranes evenly along the deck<span class="seg" style="display:flex"><button data-vspread="port">Port</button><button data-vspread="stbd">Starboard</button><button data-vspread="both">Both</button></span></label>` : ""}
      ${cr || `<p class="small" style="margin:0">This vessel is a site object only.${(o.cranesFound || []).length ? ` ${o.cranesFound.length} crane${o.cranesFound.length > 1 ? "s were" : " was"} found on its spec sheet.` : ""}</p>`}
      <div class="btnrow"><button class="pri" id="vCranes">${list.length ? "Add / edit vessel cranes…" : "Lift with this vessel's crane…"}</button>${nUnused && list.length > 1 ? `<button id="vDelUnused">Remove the ${nUnused} not in use</button>` : ""}</div></div></div>`;
}
function wireVesselProps(o, up) {
  const set = (id, fn, live) => { const el = $(id); if (!el) return; el[live ? "oninput" : "onchange"] = e => live ? (fn(e.target), markDirty(true), renderSite()) : up(() => fn(e.target), true); };
  set("vDeckH", el => o.deckH = +el.value);
  set("vBow", el => o.rot = ((+el.value - 90) % 360 + 360) % 360);
  set("vImgOn", el => o.imgOn = el.checked); set("vImgOp", el => o.imgOp = +el.value, true); set("vImgRot", el => o.imgRot = +el.value);
  set("vImgK", el => o.imgK = +el.value); set("vImgFlip", el => o.imgFlip = el.checked); set("vImgDx", el => o.imgDx = +el.value); set("vImgDy", el => o.imgDy = +el.value);
  if ($("vBerthP")) $("vBerthP").onclick = () => up(() => setBerth(o, "port"), true);
  if ($("vBerthS")) $("vBerthS").onclick = () => up(() => setBerth(o, "stbd"), true);
  if ($("vSnap")) $("vSnap").onclick = () => up(() => { berthAlongside(o); toast(`Berthed ${o.berth === "stbd" ? "starboard" : "port"} side to the quay`); }, true);
  $("props").querySelectorAll("[data-vside]").forEach(b => b.onclick = () => up(() => {
    const [id, k] = b.dataset.vside.split(":"), sp = o.cranes.find(s => s.id === id); if (!sp) return;
    const d = Math.abs(+sp.ly || 0) || Math.max(1, (+o.h || 15) / 2 - 2); setVCranePos(o, sp.id, +sp.lx || 0, k === "c" ? 0 : k === "p" ? d : -d);
  }, true));
  $("props").querySelectorAll("[data-vuse]").forEach(b => b.onclick = () => { const sp = o.cranes.find(s => s.id === b.dataset.vuse); if (sp) useVesselCrane(o, sp); });
  // remove a vessel crane (and, after a second click, the plan cranes that use it in every lift)
  const dropSpecs = ids => { pushHistory(); o.cranes = (o.cranes || []).filter(sp => !ids.has(sp.id)); syncLift();
    let n = 0; (plan.lifts || []).forEach((L, i) => { const keep = (i === plan.al ? plan.cranes : L.cranes).filter(c => !(c.vessel === o.id && ids.has(c.vc))); n += (i === plan.al ? plan.cranes : L.cranes).length - keep.length; if (i === plan.al) { plan.cranes = keep; L.cranes = keep; } else L.cranes = keep; });
    if (!(plan.lifts || []).length) plan.cranes = plan.cranes.filter(c => !(c.vessel === o.id && ids.has(c.vc)));
    if (sel && sel.kind === "crane" && !plan.cranes.some(c => c.id === sel.id)) sel = { kind: "obs", id: o.id };
    registerVesselCranes(); markDirty(); renderAll(); return n; };
  $("props").querySelectorAll("[data-vdel]").forEach(b => b.onclick = () => {
    const sp = o.cranes.find(s => s.id === b.dataset.vdel); if (!sp) return;
    const used = (plan.lifts || []).reduce((a, L, i) => a + (i === plan.al ? plan.cranes : L.cranes).filter(c => c.vessel === o.id && c.vc === sp.id).length, 0);
    if (used && !b.dataset.armed) { b.dataset.armed = "1"; b.textContent = `Click again – also removes it from ${used} lift${used > 1 ? "s" : ""}`; return; }
    const n = dropSpecs(new Set([sp.id])); toast(`${sp.name || "Crane"} removed from the vessel${n ? ` and ${n} lift${n > 1 ? "s" : ""}` : ""} – Undo with Ctrl+Z`);
  });
  $("props").querySelectorAll("[data-vedit]").forEach(b => b.onclick = () => { openVesselDialog(o, "crane"); const i = o.cranes.findIndex(s => s.id === b.dataset.vedit); setTimeout(() => { const el = document.querySelector(`[data-vci="${i}"]`); if (el) { el.scrollIntoView({ block: "center" }); el.style.outline = "2px solid var(--accent)"; } }, 50); });
  $("props").querySelectorAll("[data-vspread]").forEach(b => b.onclick = () => up(() => { spreadVCranes(o, b.dataset.vspread); toast("Cranes spread along the " + (b.dataset.vspread === "both" ? "deck, alternating sides" : (b.dataset.vspread === "stbd" ? "starboard" : "port") + " side") + " – fine-tune each crane's position below or drag it on the plan"); }, true));
  $("props").querySelectorAll("[data-vcx],[data-vcy]").forEach(el => el.onchange = () => up(() => { const id = el.dataset.vcx || el.dataset.vcy, sp = o.cranes.find(s => s.id === id); if (!sp) return; if (el.dataset.vcx) setVCranePos(o, id, +el.value, +sp.ly || 0); else lineUpSide(o, +sp.ly < 0 ? -1 : 1, Math.abs(+el.value)); }, true));
  if ($("vDelUnused")) $("vDelUnused").onclick = () => { const ids = new Set(o.cranes.filter(sp => !(plan.lifts || [{ cranes: plan.cranes }]).some((L, i) => (i === plan.al ? plan.cranes : L.cranes).some(c => c.vessel === o.id && c.vc === sp.id))).map(sp => sp.id)); dropSpecs(ids); toast(`${ids.size} unused crane${ids.size > 1 ? "s" : ""} removed from the vessel – Undo with Ctrl+Z`); };
  if ($("vEdit")) $("vEdit").onclick = () => openVesselDialog(o, "object");
  if ($("vCranes")) $("vCranes").onclick = () => openVesselDialog(o, "crane");
}
// once per plan: take each vessel crane's position from where it is used, then line each side up on one rail line
function migrateVCranes(p) {
  if (p.vcLine) return; p.vcLine = 1;
  const prev = plan; plan = p;
  try { for (const o of vesselsAll()) { (p.lifts || [{ cranes: p.cranes }]).forEach(L => (L.cranes || []).forEach(c => { if (c.vessel !== o.id) return; const sp = (o.cranes || []).find(s => s.id === c.vc); if (sp && c.vx != null) { sp.lx = +c.vx; sp.ly = +c.vy || 0; } }));
      for (const sp of o.cranes || []) setVCranePos(o, sp.id, +sp.lx || 0, +sp.ly || 0); lineUpAll(o); } }
  finally { plan = prev; }
}
{ const _op = openPlan; openPlan = function (p, ...a) { const r = _op(p, ...a); try { migrateVCranes(plan); renderAll(); } catch (e) { console.warn(e); } return r; }; }
