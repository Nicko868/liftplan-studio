// ================= Transport: SPMTs, low-loaders, flatbeds, roll trailers =================
// Real site objects with a deck. A load picked from / set onto a deck sits at deck height (plus any dunnage), moves
// with the vehicle, and is checked against the vehicle's payload; SPMTs also show the load per axle line and the
// ground pressure under the platform.
// Typical data (check against the actual vehicle):
//   SPMT (Scheuerle / Goldhofer / Kamag type): 1.40 m per axle line, 2.43 m wide, deck 1.50 m ± 0.30 m stroke,
//   40 t gross per axle line (Goldhofer PST/SL-E 45 t), ≈ 4 t self weight per line – e.g. 6 lines = 8.4 m, 216 t payload.
//   Low-loader (3-axle lowbed): well deck ≈ 9 m at ≈ 0.90 m, 3.0 m wide, ≈ 60 t payload.
//   Flatbed semi-trailer: 13.6 m × 2.55 m deck at ≈ 1.45 m, ≈ 30 t payload.
//   MAFI roll trailer 40 ft: 12.2 m × 2.6 m deck at ≈ 0.80 m, 40–120 t payload (60 t default), towed by a terminal tractor.
const TRANSPORT = {
  spmt: { name: "SPMT – self-propelled modular transporter", short: "SPMT", deck: 1.5, color: "#e8a317" },
  lowbed: { name: "Low-loader / lowbed + tractor", short: "Low-loader", deck: 0.9, payload: 60, tare: 30, L: 21.5, W: 3.0, segs: [["bogie", 3.5, 1.15], ["deck", 9.0, 0.9], ["neck", 2.5, 1.6], ["cab", 6.5, 0]], color: "#c0392b" },
  flatbed: { name: "Flatbed semi-trailer + tractor", short: "Flatbed", deck: 1.45, payload: 30, tare: 15, L: 16.5, W: 2.55, segs: [["deck", 13.6, 1.45], ["cab", 2.9, 0]], color: "#2c6fbb" },
  mafi: { name: "MAFI roll trailer 40 ft + terminal tractor", short: "Roll trailer", deck: 0.8, payload: 60, tare: 9, L: 19.5, W: 2.6, segs: [["deck", 12.2, 0.8], ["neck", 1.8, 1.0], ["cab", 5.5, 0]], color: "#27ae60" }
};
for (const [k, T] of Object.entries(TRANSPORT)) OBJ_TYPES["tr_" + k] = { name: T.name, cat: "Transport", kind: "rect", w: k === "spmt" ? 8.4 : T.L, h: k === "spmt" ? 2.43 : T.W, hgt: Math.max(1, T.deck), pass: true, color: T.color, transport: k };
if (!OBJ_CATS.includes("Transport")) OBJ_CATS.push("Transport");
const isTransport = o => !!(o && o.tr && TRANSPORT[o.tr.kind] && o.kind === "rect");
{ const _mk = makeObject; makeObject = function (type, ...a) {
    const o = _mk(type, ...a), T = OBJ_TYPES[type];
    if (o && T?.transport) { const k = T.transport, S = TRANSPORT[k]; o.label = S.short;
      o.tr = k === "spmt" ? { kind: k, lines: 6, rows: 1, deck: S.deck, crib: 0, capLine: 40, wLine: 4 } : { kind: k, deck: S.deck, crib: 0, payload: S.payload, tare: S.tare };
      trSize(o); }
    return o;
  }; }
// an SPMT is whole modules: stretching or shrinking it on the plan (or typing its size) adds or takes away axle lines / modules
// side by side, and it snaps to 1.40 m per line × 2.43 m per module, so the wheels always sit evenly under the deck
function trSync(o) {
  if (!o?.tr || o.tr.kind !== "spmt") return;
  const t = o.tr, w = +o.w || 0, h = +o.h || 0;
  if (Math.abs(w - Math.max(1, +t.lines || 1) * 1.4) > 0.02) t.lines = Math.max(1, Math.round(w / 1.4));
  if (Math.abs(h - Math.max(1, +t.rows || 1) * 2.43) > 0.02) t.rows = Math.max(1, Math.round(h / 2.43));
  trSize(o);
}
function trSize(o) { if (o.tr.kind === "spmt") { o.w = Math.round(Math.max(1, +o.tr.lines || 1) * 1.4 * 100) / 100; o.h = Math.round(Math.max(1, +o.tr.rows || 1) * 2.43 * 100) / 100; } }
const trLoc = (o, x, y) => { const r = rot2([x, y], -(o.rot || 0)); return [o.x + r[0], o.y + r[1]]; };
// the deck a load can stand on (local x0..x1 along the length, full width) and its height
function trDeck(o) {
  const t = o.tr, w = +o.w, h = +o.h, top = (+t.deck || 0) + (+t.crib || 0);
  if (t.kind === "spmt") return { x0: -w / 2, x1: w / 2, top, deck: +t.deck };
  let x = -w / 2; for (const [k, L] of TRANSPORT[t.kind].segs) { if (k === "deck") return { x0: x, x1: x + L, top, deck: +t.deck }; x += L; }
  return { x0: -w / 2, x1: w / 2, top, deck: +t.deck };
}
const trDeckPoly = o => { const d = trDeck(o), h = +o.h; return [[d.x0, -h / 2], [d.x1, -h / 2], [d.x1, h / 2], [d.x0, h / 2]].map(p => trLoc(o, ...p)); };
function trPayload(o) { const t = o.tr; return t.kind === "spmt" ? Math.max(1, +t.lines || 1) * Math.max(1, +t.rows || 1) * ((+t.capLine || (rule("spmt.capLine") ?? 40)) - (+t.wLine || 4)) : +t.payload || 0; }
const trSelf = o => o.tr.kind === "spmt" ? Math.max(1, +o.tr.lines || 1) * Math.max(1, +o.tr.rows || 1) * (+o.tr.wLine || 4) : +o.tr.tare || 0;
// loads standing on a vehicle in a phase
const trLoadsOn = (o, ph) => plan.loads.filter(l => l[ph]?.onT === o.id);
function trCheck(o, ph) {
  trSync(o);
  const loads = trLoadsOn(o, ph), W = loads.reduce((a, l) => a + (+l.weight || 0), 0), P = trPayload(o), self = trSelf(o), out = { W, P, util: P ? W / P * 100 : null, loads, warn: [] };
  if (P && W > P) out.warn.push(`${o.label || "Transport"} (${ph}): ${fx(W, 1)} t on a ${fx(P, 1)} t payload – overloaded`);
  if (o.tr.kind === "spmt") { const n = Math.max(1, +o.tr.lines || 1) * Math.max(1, +o.tr.rows || 1); out.perLine = (W + self) / n; out.gp = (W + self) / ((+o.w) * (+o.h));
    if (out.perLine > (+o.tr.capLine || (rule("spmt.capLine") ?? 40))) out.warn.push(`${o.label || "SPMT"} (${ph}): ${fx(out.perLine, 1)} t per axle line – over its ${fx(+o.tr.capLine || (rule("spmt.capLine") ?? 40))} t rating`);
    const gbc = +plan.site.gbc || 0; if (gbc && out.gp > gbc) out.warn.push(`${o.label || "SPMT"} (${ph}): ground pressure under the platform ${fx(out.gp, 1)} t/m² is over the ${fx(gbc)} t/m² allowed`); }
  for (const l of loads) { const d0 = loadDims(l), pos = l[ph], dk = trDeck(o),
    // a tank / vessel on saddles is carried on its saddles: those must be on the deck – the shell may overhang
    d = l.kind === "tank" ? { x: Math.min(d0.x, 0.55 * (+l.L || d0.x) + 0.6), y: Math.min(d0.y, 0.85 * (+l.D || d0.y)) } : d0, c = rot2([pos.x - o.x, pos.y - o.y], (o.rot || 0)), along = (pos.rot || 0) - (o.rot || 0);
    const ca = Math.abs(Math.cos(along * D2R)), sa = Math.abs(Math.sin(along * D2R)), hx = (d.x * ca + d.y * sa) / 2, hy = (d.x * sa + d.y * ca) / 2;
    const over = Math.max(0, c[0] + hx - dk.x1, dk.x0 - (c[0] - hx)), side = Math.max(0, Math.abs(c[1]) + hy - (+o.h) / 2);
    if (over > 0.05 || side > 0.05) out.warn.push(`${l.name}${l.kind === "tank" ? "'s saddles overhang" : " overhangs"} the ${o.label || "deck"}${over > 0.05 ? ` by ${fx(over, 2)} m at the end` : ""}${side > 0.05 ? `${over > 0.05 ? " and" : " by"} ${fx(side, 2)} m at the side` : ""} – check it is supported and the route is clear`); }
  return out;
}
// a load's pick / set point on a deck: it stands at deck height and is linked to the vehicle; off the deck it goes back to the ground
function trSettle() {
  const T = plan.obstacles.filter(isTransport);
  for (const l of plan.loads) for (const ph of ["pick", "set"]) {
    const pos = l[ph]; if (!pos) continue;
    const on = T.find(o => inPolyPt([pos.x, pos.y], trDeckPoly(o)));
    if (on) { const top = trDeck(on).top; if (pos.onT !== on.id || Math.abs((+pos.h || 0) - (+pos.onH || 0)) < 1e-6) { pos.h = top; pos.onH = top; } pos.onT = on.id; }
    else if (pos.onT) { if (Math.abs((+pos.h || 0) - (+pos.onH || 0)) < 1e-6) pos.h = 0; delete pos.onT; delete pos.onH; }
  }
}
{ const _ra = renderAll; renderAll = function (...a) { try { trSettle(); } catch (e) { console.warn(e); } return _ra.apply(this, a); }; }
// moving / turning a vehicle carries the loads standing on it
{ const _op = objPos; objPos = function (key) {
    const op = _op(key); const [kind, id] = key.split(":"); const o = plan.obstacles.find(x => x.id === id);
    if (!op || !isTransport(o) || op.locked) return op;
    if (kind === "obs" && op.set) { const set0 = op.set; return { ...op, set: (x, y) => { const x0 = o.x, y0 = o.y; set0(x, y); const dx = o.x - x0, dy = o.y - y0; for (const ph of ["pick", "set"]) for (const l of trLoadsOn(o, ph)) { l[ph].x = Math.round((l[ph].x + dx) * 100) / 100; l[ph].y = Math.round((l[ph].y + dy) * 100) / 100; } } }; }
    if (kind === "hrot" && op.set) { const set0 = op.set; return { ...op, set: (x, y) => { const r0 = +o.rot || 0; set0(x, y); const d = (+o.rot || 0) - r0; if (d) for (const ph of ["pick", "set"]) for (const l of trLoadsOn(o, ph)) { const r = rot2([l[ph].x - o.x, l[ph].y - o.y], -d); l[ph].x = Math.round((o.x + r[0]) * 100) / 100; l[ph].y = Math.round((o.y + r[1]) * 100) / 100; l[ph].rot = (((+l[ph].rot || 0) + d) % 360 + 540) % 360 - 180; } } }; }
    return op;
  }; }
// the crane's checks list what is wrong with the vehicle its load comes from / goes to
{ const _cs = craneSummary; craneSummary = function (cr) {
    const S = _cs(cr);
    try { const ld = plan.loads.find(l => l.id === cr.attach?.load); if (S && ld) for (const ph of ["pick", "set"]) { const o = plan.obstacles.find(x => x.id === ld[ph]?.onT); if (!isTransport(o)) continue; const c = trCheck(o, ph); for (const w of c.warn) if (!S.warn.includes(w)) S.warn.push(w); if (c.warn.some(w => /overloaded|rating|allowed/.test(w)) && S.status === "ok") S.status = "amber"; } } catch (e) { console.warn(e); }
    return S;
  }; }
// ---------- plan view ----------
{ const _os = objScene; objScene = function (o) {
    if (!isTransport(o)) return _os(o);
    trSync(o);
    const s = new Scene(), t = o.tr, w = +o.w, h = +o.h, col = obsColor(o), L = (x, y) => trLoc(o, x, y), box = (x0, x1, y0, y1, fill, c, wd = 0.9) => s.poly("LOAD", [L(x0, y0), L(x1, y0), L(x1, y1), L(x0, y1)], { closed: true, fill, color: c || col, w: wd });
    if (t.kind === "spmt") {
      const nl = Math.max(1, Math.round(+t.lines || 1)), nr = Math.max(1, Math.round(+t.rows || 1));
      box(-w / 2, w / 2, -h / 2, h / 2, rgbaOf(col, 0.22), col, 1.4);
      const px = w / nl, py = h / nr;
      for (let i = 1; i < nl; i++) s.poly("LOAD", [L(-w / 2 + i * px, -h / 2), L(-w / 2 + i * px, h / 2)], { w: 0.35, color: col });
      for (let j = 1; j < nr; j++) s.poly("LOAD", [L(-w / 2, -h / 2 + j * py), L(w / 2, -h / 2 + j * py)], { w: 0.9, color: col });
      for (let i = 0; i < nl; i++) for (let j = 0; j < nr; j++) for (const yy of [-0.75, 0.75]) { const cx = -w / 2 + (i + 0.5) * w / nl, cy = -h / 2 + (j + 0.5) * h / nr + yy; box(cx - 0.36, cx + 0.36, cy - 0.22, cy + 0.22, "#3a3e42", "#222", 0.4); }
      box(-w / 2 - 2.6, -w / 2 - 0.1, -1.0, 1.0, shade(col, 0.75), col);   // power pack unit
      s.text("TEXT", L(-w / 2 - 1.35, 0), "PPU", 0.45, { bold: true, color: "#ffffff" });
    } else {
      let x = -w / 2;
      for (const [k, Ls] of TRANSPORT[t.kind].segs) {
        if (k === "cab") { box(x + 0.2, x + Ls, -h / 2 + 0.1, h / 2 - 0.1, shade(col, 0.85), col, 1.1); box(x + Ls - 2.2, x + Ls - 0.15, -h / 2 + 0.25, h / 2 - 0.25, "#4c6377", "#2b3a48", 0.6); }
        else if (k === "neck") box(x, x + Ls, -h / 2 + 0.3, h / 2 - 0.3, "#5f666d", "#34393e");
        else box(x, x + Ls, -h / 2, h / 2, k === "deck" ? rgbaOf(col, 0.2) : "#8a9199", k === "deck" ? col : "#5f666d", k === "deck" ? 1.3 : 0.8);
        if (k === "bogie" || (k === "deck" && t.kind !== "lowbed")) { const n = k === "bogie" ? 3 : 3, x0 = k === "bogie" ? x + 0.6 : x + 1.0; for (let i = 0; i < n; i++) for (const yy of [-h / 2 + 0.35, h / 2 - 0.35]) box(x0 + i * 1.35 - 0.5, x0 + i * 1.35 + 0.5, yy - 0.18, yy + 0.18, "#2b2f33", "#111", 0.4); }
        x += Ls;
      }
    }
    const dk = trDeck(o), c = trCheck(o, plan.phase === "set" ? "set" : "pick");
    s.text("TEXT", L(0, h / 2 + 0.9), `${o.label || TRANSPORT[t.kind].short}`, 0.6, { bold: true, color: c.warn.length ? "#b42318" : col });
    return s;
  }; }
// ---------- 3D ----------
{ const _o3 = obj3D; obj3D = function (M, o, P2) {
    if (!isTransport(o)) return _o3(M, o, P2);
    trSync(o);
    const t = o.tr, w = +o.w, h = +o.h, col = obsColor(o), X = rot2([1, 0], -(o.rot || 0)), Y = rot2([0, 1], -(o.rot || 0)), F = { o: [o.x, o.y, 0], x: [X[0], X[1], 0], y: [Y[0], Y[1], 0], z: [0, 0, 1] };
    const P = (x, y, z) => [o.x + X[0] * x + Y[0] * y, o.y + X[1] * x + Y[1] * y, z];
    const tyre = (x, y, r, wd) => M.cyl(P(x, y - wd / 2, r), P(x, y + wd / 2, r), r, "#202326", { n: 14, cap: "#3a3e42" });
    if (t.kind === "spmt") {
      const d = +t.deck || 1.5, nl = Math.max(1, Math.round(+t.lines || 1)), nr = Math.max(1, Math.round(+t.rows || 1));
      M.box(F, -w / 2, w / 2, -h / 2, h / 2, d - 0.42, d, col);
      M.box(F, -w / 2 + 0.05, w / 2 - 0.05, -h / 2 + 0.05, h / 2 - 0.05, d - 0.02, d + 0.005, shade(col, 0.82));
      for (let i = 0; i < nl; i++) for (let j = 0; j < nr; j++) for (const yy of [-0.75, 0.75]) { const cx = -w / 2 + (i + 0.5) * w / nl, cy = -h / 2 + (j + 0.5) * h / nr + yy;
        M.box(F, cx - 0.12, cx + 0.12, cy - 0.12, cy + 0.12, 0.62, d - 0.42, "#6b7278");      // suspension cylinder
        for (const dx of [-0.22, 0.22]) tyre(cx + dx, cy, 0.31, 0.26); }
      M.box(F, -w / 2 - 2.6, -w / 2 - 0.1, -1.0, 1.0, 0.45, 2.3, shade(col, 0.75)); M.box(F, -w / 2 - 2.5, -w / 2 - 0.2, -0.9, 0.9, 2.3, 2.45, "#3a3e42");
      for (const yy of [-0.7, 0.7]) tyre(-w / 2 - 1.35, yy, 0.3, 0.25);
    } else {
      let x = -w / 2;
      for (const [k, Ls, z] of TRANSPORT[t.kind].segs) {
        if (k === "deck") { const zz = +t.deck || z; M.box(F, x, x + Ls, -h / 2, h / 2, Math.max(0.15, zz - 0.25), zz, col); if (t.kind === "mafi") for (const xx of [x + 1.2, x + Ls - 1.2]) for (const yy of [-h / 2 + 0.4, h / 2 - 0.4]) tyre(xx, yy, 0.38, 0.4);
          else if (t.kind === "flatbed") { M.box(F, x + 0.5, x + Ls - 0.5, -0.5, 0.5, 0.95, zz - 0.25, "#34393e"); for (let i = 0; i < 3; i++) for (const yy of [-h / 2 + 0.35, h / 2 - 0.35]) tyre(x + 1.0 + i * 1.35, yy, 0.5, 0.5); } }
        else if (k === "bogie") { M.box(F, x, x + Ls, -h / 2, h / 2, z - 0.3, z, col); for (let i = 0; i < 3; i++) for (const yy of [-h / 2 + 0.4, h / 2 - 0.4]) tyre(x + 0.6 + i * 1.15, yy, 0.42, 0.45); }
        else if (k === "neck") M.box(F, x, x + Ls, -h / 2 + 0.3, h / 2 - 0.3, z - 0.5, z, shade(col, 0.8));
        else if (k === "cab") { M.box(F, x, x + Ls, -0.5, 0.5, 0.8, 1.25, "#34393e"); M.box(F, x + Ls - 2.3, x + Ls, -h / 2 + 0.1, h / 2 - 0.1, 1.0, 3.6, col); M.box(F, x + Ls - 0.08, x + Ls + 0.01, -h / 2 + 0.3, h / 2 - 0.3, 2.3, 3.3, "#4c6377");
          for (const xx of [x + 0.9, x + Ls - 1.3]) for (const yy of [-h / 2 + 0.35, h / 2 - 0.35]) tyre(xx, yy, 0.52, 0.45); if (Ls > 4) for (const yy of [-h / 2 + 0.35, h / 2 - 0.35]) tyre(x + 2.3, yy, 0.52, 0.45); }
        x += Ls;
      }
    }
    M.label(P(0, 0, (+t.deck || 1) + 1.2), o.label || TRANSPORT[t.kind].short, "#16202a", 11);
    return true;
  }; }
// ---------- the vehicle's own panel ----------
{ const _rp = renderProps; renderProps = function (...a) {
    const r = _rp.apply(this, a);
    try {
      const o = sel?.kind === "obs" ? plan.obstacles.find(x => x.id === sel.id) : null;
      if (isTransport(o) && $("oLab") && !$("trBox")) {
        const t = o.tr, sp = t.kind === "spmt", ph = plan.phase === "set" ? "set" : "pick", c = trCheck(o, ph), f = (lab, k, v, st = "0.01") => `<label>${lab}<input type="number" step="${st}" data-tr="${k}" value="${v ?? ""}"></label>`;
        const d = document.createElement("div"); d.id = "trBox";
        d.innerHTML = `<h4>${escH(TRANSPORT[t.kind].name)}</h4>
          ${sp ? `<div class="row3">${f("Axle lines", "lines", t.lines, "1")}${f("Modules side by side", "rows", t.rows, "1")}${f("Deck height (m)", "deck", t.deck)}</div>
            <div class="row3">${f("Rating per axle line (t)", "capLine", t.capLine, "1")}${f("Self weight per line (t)", "wLine", t.wLine, "0.1")}${f("Dunnage / cribbing (m)", "crib", t.crib)}</div>
            <p class="small" style="margin:2px 0 6px">${Math.round(+t.lines) * Math.round(+t.rows)} axle lines · ${fx(+o.w, 2)} × ${fx(+o.h, 2)} m platform · payload <b>${fx(trPayload(o), 0)} t</b>. Deck stroke is usually ±0.30 m.</p>`
          : `<div class="row3">${f("Deck height (m)", "deck", t.deck)}${f("Payload (t)", "payload", t.payload, "1")}${f("Dunnage / cribbing (m)", "crib", t.crib)}</div>`}
          <div class="${c.warn.length ? "status bad" : "status ok"}" style="margin-top:4px">${c.loads.length ? `${escH(c.loads.map(l => l.name).join(", "))} on the deck (${ph}): <b>${fx(c.W, 1)} t</b> of ${fx(c.P, 0)} t (${fx(c.util, 0)}%)${sp ? ` · ${fx(c.perLine, 1)} t per axle line · ground ${fx(c.gp, 1)} t/m²` : ""}${c.warn.length ? "<br>" + c.warn.map(escH).join("<br>") : ""}` : `Nothing on the deck in the ${ph} phase – drop a load's ${ph} position on the deck and it sits at ${fx(trDeck(o).top, 2)} m.`}</div>`;
        ($("oLab").closest("label") || $("oLab")).after(d);
        d.querySelectorAll("[data-tr]").forEach(el => el.onchange = () => { const k = el.dataset.tr; t[k] = +el.value; if (k === "lines" || k === "rows") { t[k] = Math.max(1, Math.round(+el.value || 1)); trSize(o); }
          for (const ph of ["pick", "set"]) for (const l of trLoadsOn(o, ph)) { l[ph].h = trDeck(o).top; l[ph].onH = l[ph].h; }
          markDirty(); renderAll(); });
      }
    } catch (e) { console.warn(e); }
    return r;
  }; }

// ---------- a vehicle drives between lifts: each lift keeps its own position for it ----------
// (site items are shared by every lift of a plan; SPMTs and trailers are not parked – moving one in Lift 1 leaves Lift 2 alone)
function trSaveAt() { const L = plan.lifts?.[plan.al]; if (!L) return; for (const o of plan.obstacles.filter(isTransport)) { o.at = o.at || {}; const q = { x: o.x, y: o.y, rot: +o.rot || 0 }; if (o.samePos) for (const L2 of plan.lifts) o.at[L2.id] = { ...q }; else o.at[L.id] = q; } }
function trApplyAt() { const L = plan.lifts?.[plan.al]; if (!L) return; for (const o of plan.obstacles.filter(isTransport)) { const q = o.at?.[L.id]; if (q) { o.x = q.x; o.y = q.y; o.rot = q.rot; } } }
{ const _sw = switchLift; switchLift = function (i) { trSaveAt(); const r = _sw(i); trApplyAt(); renderAll(); return r; }; }
{ const _sp = savePlan; savePlan = async function (...a) { trSaveAt(); return _sp.apply(this, a); }; }
{ const _pd = packedData; packedData = async function (...a) { trSaveAt(); return _pd.apply(this, a); }; }
{ const _op = openPlan; openPlan = function (...a) { const r = _op.apply(this, a); trApplyAt(); renderAll(); return r; }; }
{ const _dl = deleteLift; deleteLift = function (...a) { const r = _dl.apply(this, a); trApplyAt(); renderAll(); return r; }; }
// sheets: each lift's plan sheet draws its vehicles where they stand in that lift
{ const _sh = sheetSVG; sheetSVG = async function (...a) { try { trApplyAt(); } catch (e) { } return _sh.apply(this, a); }; }
{ const _bs = buildSheets; buildSheets = async function (...a) {
    try { trSaveAt(); } catch (e) { }
    const bg = plan.site.bg, keep = bg ? bg.show : undefined; if (bg) bg.show = false;   // the site picture is screen-only: it prints blurred on a sheet
    const c = plan.site.cad, tr = false, keepC = c ? c.show : undefined;   // lines traced from the picture are clean vectors – they print (thin grey) so the structures round the lift show
    try { return await _bs.apply(this, a); } finally { if (bg) bg.show = keep; if (tr) c.show = keepC; try { trApplyAt(); } catch (e) { } }
  }; }

// one vehicle, one place: an SPMT / trailer that stays put for every lift of the plan (e.g. set on it in Lift 1, picked off it in Lift 2)
{ const _rp = renderProps; renderProps = function (...a) { const r = _rp.apply(this, a);
    try { const o = sel?.kind === "obs" ? plan.obstacles.find(x => x.id === sel.id) : null, box = $("trBox");
      if (isTransport(o) && box && !$("trSame") && (plan.lifts || []).length > 1 && !o.onlyLift) { const d = document.createElement("div");
        d.innerHTML = `<label style="display:flex;gap:6px;align-items:center;margin:6px 0 2px"><input type="checkbox" id="trSame" ${o.samePos ? "checked" : ""}> Same position in every lift</label>
          <p class="small" style="margin:0 0 6px">${o.samePos ? "It stays where it is in all " + plan.lifts.length + " lifts – moving it here moves it in every lift." : "Each lift keeps its own position for it (it drives between lifts). Tick to keep it in one place for all lifts."}</p>`;
        box.appendChild(d);
        $("trSame").onchange = e => { o.samePos = e.target.checked; if (o.samePos) { o.at = {}; for (const L of plan.lifts) o.at[L.id] = { x: o.x, y: o.y, rot: +o.rot || 0 }; } markDirty(); renderAll(); }; } } catch (e) { console.warn(e); }
    return r; }; }
