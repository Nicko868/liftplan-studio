// ================= Rigging fittings drawn as what they are (master link, shackle, load cell, swivel, hook …) =================
// The gear on the crane hook is drawn as a stack, top → bottom, each fitting at its own length – used by every rigging drawing.
function fittingKind(e) {
  const t = e?.snap?.type, n = e?.snap?.name || "";
  if (t === "masterlink") return "masterlink";
  if (t === "shackle") return "shackle";
  if (t === "hook") return e?.snap?.style === "slswivel" || /shur-?loc|self-locking|safety hook/i.test(n) ? (/swivel/i.test(n) ? "slswivel" : "slhook") : e?.snap?.style === "eyehook" || /eye hook/i.test(n) ? "eyehook" : /swivel/i.test(n) ? "swivhook" : "hook";
  if (/load ?(cell|link)|dynamometer|radiolink|loadlink/i.test(n)) return "loadcell";
  if (/swivel/i.test(n)) return "swivel";
  if (/turnbuckle|rigging screw|bottle screw/i.test(n)) return "turnbuckle";
  return "generic";
}
const FIT_COL = { link: "#f2c200", linkEdge: "#8a6d00", galv: "#c3c9cf", galvEdge: "#6f777f", pinEdge: "#1d6b33", steel: "#6b7278", pin: "#2e9d4a", cell: "#1c2a6e", cellEdge: "#0d1440", hole: "#d7dbe0", label: "#f2c200", generic: "#8a9199" };
// a solid bar of steel along a centre line (thickness t, or t(i) per point) – scales with the drawing like the real part
function fitBand(s, P, t, fill, edge) {
  const n = P.length, T = i => typeof t === "function" ? t(i, n) : t, A = [], B = [];
  for (let i = 0; i < n; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, h = T(i) / 2;
    A.push([P[i][0] + nx * h, P[i][1] + nz * h]); B.push([P[i][0] - nx * h, P[i][1] - nz * h]); }
  s.poly("RIGGING", [...A, ...B.reverse()], { closed: true, fill, w: 0.7, color: edge });
}
const ringPts = (cx, cz, rx, rz, a0 = 0, a1 = Math.PI * 2, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + rx * Math.cos(a), cz + rz * Math.sin(a)]; });
// draws one fitting with its top at (x, zTop), returns its length
function drawFitting2D(s, e, x, zTop, view, kk = 1) {
  const L = Math.max(0.15, eLen(e)) * kk, k = fittingKind(e), zb = zTop - L, mid = zTop - L / 2, side = view !== "end";
  const oval = (cx, cz, rx, rz, opt) => s.poly("RIGGING", Array.from({ length: 24 }, (_, i) => [cx + rx * Math.cos(i / 24 * Math.PI * 2), cz + rz * Math.sin(i / 24 * Math.PI * 2)]), { closed: true, ...opt });
  if (k === "masterlink") {
    // yellow forged oval, thick section, with the flat marking boss on one side
    const rx = Math.max(0.05, L * 0.3), rz = L / 2 - 0.01;
    if (side) { const t = Math.max(0.012, rx * 0.34); fitBand(s, ringPts(x, mid, rx - t / 2, rz - t / 2, 0.02, Math.PI * 2 + 0.07), t, FIT_COL.link, FIT_COL.linkEdge);
      s.poly("RIGGING", ringPts(x + rx - t / 2, mid, t * 0.75, L * 0.12), { closed: true, fill: FIT_COL.link, w: 0.7, color: FIT_COL.linkEdge }); }
    else s.rect("RIGGING", x - 0.03, zb + 0.01, x + 0.03, zTop - 0.01, { fill: FIT_COL.link, w: 0.8, color: FIT_COL.linkEdge }); }
  else if (k === "shackle") {
    // galvanised bow up, green bolt-type pin at the bottom (the pin goes through the padeye / eye below)
    const wide = /wide ?body/i.test(e.snap.name || ""), w = Math.max(0.05, L * (wide ? 0.3 : 0.2)), zp = zb + L * 0.1, ph = Math.max(0.02, L * (wide ? 0.09 : 0.07));
    if (side) {
      const U = [[x - w * (wide ? 0.78 : 1), zp]];
      for (let i = 0; i <= 24; i++) { const a = Math.PI - Math.PI * i / 24; U.push([x + w * Math.cos(a), zTop - w * (wide ? 1.05 : 1) + w * (wide ? 1.05 : 1) * Math.sin(a) - w * 0.2]); }
      U.push([x + w * (wide ? 0.78 : 1), zp]);
      fitBand(s, U, wide ? (i, n) => w * (0.34 + 0.22 * Math.sin(Math.PI * i / (n - 1))) : w * 0.32, FIT_COL.galv, FIT_COL.galvEdge);
      const e0 = w * (wide ? 0.78 : 1);
      s.rect("RIGGING", x - e0 - w * 0.25, zp - ph / 2, x + e0 + w * 0.25, zp + ph / 2, { fill: FIT_COL.pin, w: 0.6, color: FIT_COL.pinEdge });
      s.rect("RIGGING", x + e0 + w * 0.15, zp - ph * 1.1, x + e0 + w * 0.45, zp + ph * 1.1, { fill: FIT_COL.pin, w: 0.6, color: FIT_COL.pinEdge });           // hex head / green nut
      s.rect("RIGGING", x - e0 - w * 0.45, zp - ph * 1.1, x - e0 - w * 0.15, zp + ph * 1.1, { fill: wide ? FIT_COL.pin : FIT_COL.galv, w: 0.6, color: wide ? FIT_COL.pinEdge : FIT_COL.galvEdge }); // nut
      if (!wide) s.poly("RIGGING", [[x - e0 - w * 0.5, zp + ph * 1.5], [x - e0 - w * 0.62, zp - ph * 1.3]], { w: 0.9, color: FIT_COL.galvEdge }); // cotter pin
    } else { s.rect("RIGGING", x - 0.03, zp, x + 0.03, zTop - 0.01, { fill: FIT_COL.galv, w: 0.6, color: FIT_COL.galvEdge }); s.circle("RIGGING", [x, zp], wide ? 0.045 : 0.035, { fill: FIT_COL.pin, w: 0.5, color: FIT_COL.pinEdge }); }
  } else if (k === "loadcell") {
    const w = (side ? 0.34 : 0.2) * L / 2, c = Math.min(w * 0.55, L * 0.12), r = Math.min(w * 0.55, L * 0.11);
    s.poly("RIGGING", [[x - w + c, zTop], [x + w - c, zTop], [x + w, zTop - c], [x + w, zb + c], [x + w - c, zb], [x - w + c, zb], [x - w, zb + c], [x - w, zTop - c]], { closed: true, fill: FIT_COL.cell, w: 0.9, color: FIT_COL.cellEdge });
    if (side) { for (const zc of [zTop - L * 0.17, zb + L * 0.17]) s.circle("RIGGING", [x, zc], r, { fill: FIT_COL.hole, w: 0.6, color: "#9aa3ad" });
      s.rect("RIGGING", x - w * 0.62, mid - L * 0.12, x + w * 0.62, mid + L * 0.12, { fill: FIT_COL.label, w: 0.4, color: "#b8930a" }); }
    else s.rect("RIGGING", x - w * 0.5, mid - L * 0.1, x + w * 0.5, mid + L * 0.1, { fill: FIT_COL.label, w: 0.3 });
  } else if (k === "swivel") {
    const w = L * 0.16; oval(x, zTop - L * 0.18, w, L * 0.17, { w: 1.8, color: FIT_COL.steel }); oval(x, zb + L * 0.18, w, L * 0.17, { w: 1.8, color: FIT_COL.steel });
    s.rect("RIGGING", x - w * 1.1, mid - L * 0.14, x + w * 1.1, mid + L * 0.14, { fill: "#8a9199", w: 0.8, color: "#4b5157" });
  } else if (k === "turnbuckle") {
    const w = L * 0.07; oval(x, zTop - L * 0.1, w * 1.6, L * 0.09, { w: 1.6, color: FIT_COL.steel }); oval(x, zb + L * 0.1, w * 1.6, L * 0.09, { w: 1.6, color: FIT_COL.steel });
    s.poly("RIGGING", [[x - w * 2, zTop - L * 0.25], [x - w * 2, zb + L * 0.25]], { w: 1.8, color: FIT_COL.steel }); s.poly("RIGGING", [[x + w * 2, zTop - L * 0.25], [x + w * 2, zb + L * 0.25]], { w: 1.8, color: FIT_COL.steel });
    s.poly("RIGGING", [[x, zTop - L * 0.19], [x, zTop - L * 0.25]], { w: 1.6, color: FIT_COL.steel }); s.poly("RIGGING", [[x, zb + L * 0.19], [x, zb + L * 0.25]], { w: 1.6, color: FIT_COL.steel });
  } else if (/hook$|swivel$/.test(k) && k !== "swivel" && k !== "hook") {
    // eye hook with latch (Crosby 320 – red), swivel self-locking hook (Shur-Loc – grey), self-locking eye hook, swivel hook
    const red = k === "eyehook", body = red ? "#c8261e" : "#b9bfc5", edge = red ? "#6e120d" : "#5d646b", swiv = k === "slswivel" || k === "swivhook", lock = k === "slswivel" || k === "slhook";
    const R = L * 0.2, cz = zb + R + L * 0.03, th = L * 0.075;
    let zs;                                                                   // where the shank starts under the eye
    if (swiv) { const rx = L * 0.12, rz = L * 0.14, ce = zTop - rz; fitBand(s, ringPts(x, ce, rx - th * 0.35, rz - th * 0.35, -Math.PI / 2, Math.PI * 1.5 + 0.05), th * 0.7, body, edge);
      s.rect("RIGGING", x - rx * 0.5, ce - rz + th * 0.2, x + rx * 0.5, ce - rz * 0.3, { fill: "#8e969d", w: 0.7, color: edge }); zs = ce - rz;
      s.rect("RIGGING", x - th * 0.6, zs - L * 0.07, x + th * 0.6, zs + th * 0.2, { fill: body, w: 0.7, color: edge }); zs -= L * 0.07; }
    else { const re = L * 0.12, ce = zTop - re; fitBand(s, ringPts(x, ce, re - th * 0.4, re - th * 0.4, -Math.PI / 2, Math.PI * 1.5 + 0.05), th * 0.8, body, edge); zs = ce - re + th * 0.2; }
    const P = []; for (let i = 0; i <= 10; i++) { const u = i / 10, c = [x - R, cz + (zs - cz) * 0.55]; P.push([(1 - u) ** 2 * x + 2 * u * (1 - u) * c[0] + u * u * (x - R), (1 - u) ** 2 * zs + 2 * u * (1 - u) * c[1] + u * u * cz]); }
    for (let i = 1; i <= 22; i++) { const a = Math.PI + (Math.PI + 0.6) * i / 22; P.push([x + R * Math.cos(a), cz + R * Math.sin(a)]); }
    fitBand(s, P, (i, n) => th * (i < 11 ? 1 + 0.2 * i / 10 : 1.35 - 0.6 * Math.max(0, (i - 11) / (n - 12)) ** 2), body, edge);
    const tip = P[P.length - 1], piv = [x - R * 0.8, cz + (zs - cz) * 0.5];
    if (lock) { fitBand(s, [piv, [(piv[0] + tip[0]) / 2, (piv[1] + tip[1]) / 2 + L * 0.02], [tip[0] - th * 0.3, tip[1] + th * 0.3]], th * 0.85, body, edge); s.circle("RIGGING", piv, th * 0.35, { fill: "#8e969d", w: 0.6, color: edge }); }
    else { fitBand(s, [piv, [tip[0], tip[1]]], th * 0.25, "#d4ac2b", "#8a6d10"); s.circle("RIGGING", piv, th * 0.3, { fill: "#d7dbe0", w: 0.6, color: "#6f777f" }); }
  } else if (k === "hook") {
    oval(x, zTop - L * 0.12, L * 0.09, L * 0.1, { w: 1.6, color: "#3a3e42" });
    s.poly("RIGGING", [[x, zTop - L * 0.22], [x, zb + L * 0.35], [x - L * 0.05, zb + L * 0.1], [x + L * 0.1, zb], [x + L * 0.2, zb + L * 0.1], [x + L * 0.2, zb + L * 0.22]], { w: 2, color: "#3a3e42" });
  } else s.rect("RIGGING", x - L * 0.12, zb, x + L * 0.12, zTop, { fill: FIT_COL.generic, w: 0.8, color: "#4b5157" });
  return L;
}
// the gear on a hook, stacked top → bottom (qty > 1 sits side by side); returns the total length
function topStack2D(s, list, x, zTop, view, kk = 1, labels = 0) {
  let z = zTop;
  for (const e of list || []) { const q = Math.max(1, (e.qty || 1) * Math.max(1, Math.round(+e.mult || 1))), L = Math.max(0.15, eLen(e)) * kk, gap = Math.max(0.12 * kk, L * 0.45); for (let i = 0; i < q; i++) drawFitting2D(s, e, x + (i - (q - 1) / 2) * gap, z, view, kk);
    if (labels) { s.poly("DIMS", [[x + L * 0.35 + (q - 1) * gap / 2, z - L / 2], [x + L * 0.35 + (q - 1) * gap / 2 + labels * 1.2, z - L / 2]], { w: 0.4, color: "#566476" }); s.text("DIMS", [x + L * 0.35 + (q - 1) * gap / 2 + labels * 1.5, z - L / 2 - labels * 0.35], `${q > 1 ? q + " × " : ""}${e.snap.name}`, labels, { anchor: "start", color: "#16202a" }); }
    z -= L; }
  return zTop - z;
}
// ramshorn: the first nSplit parts one on each horn, the rest hang from the middle below them (lines from both horns into the joining part)
function topStackHorns(s, list, x, zTop, hornX, nSplit, view) {
  const seat = hornX * 0.45; let z = zTop + seat, zs = z;
  (list || []).slice(0, nSplit).forEach(e => { for (const dx of [-hornX, hornX]) topStack2D(s, [{ ...e, qty: 1, mult: 1 }], x + dx, zs, view); zs -= Math.max(0.15, eLen(e)); });
  const rest = (list || []).slice(nSplit); if (!rest.length) return zTop - zs;
  const zj = zs;   // the joining part sits straight under the two links – no extra lines
  const h = topStack2D(s, rest, x, zj, view);
  return zTop - (zj - h);
}
const topListFor = (ld, hi) => { const R = ld.rig || {}; return R.arr === "build" && +R.cranes === 2 && hi === 1 ? (R.topB || []) : (R.top || []); };
// every rigging drawing: the hook gear is drawn as real fittings instead of one long link
{ const _r2 = rig2D; rig2D = function (s, ld, res, view, ox, oy, opts = {}) {
    if (!res || !ld?.rig) return _r2(s, ld, res, view, ox, oy, opts);
    const out = _r2(s, ld, { ...res, links: [] }, view, ox, oy, opts);
    res.hookPts.forEach((hp, hi) => { if (view === "end" && hi) return;
      if (res.hornX && view !== "end") topStackHorns(s, topListFor(ld, hi), ox + hp[0], oy + hp[2], res.hornX, res.hornN, view);
      else topStack2D(s, res.hornX ? topListFor(ld, hi).map((e, i) => i < res.hornN ? { ...e, qty: 1, mult: 1 } : e) : topListFor(ld, hi), ox + (view === "end" ? hp[1] : hp[0]), oy + hp[2], view); });
    return out;
  }; }
{ const _r3 = rig3D; rig3D = function (M, ld, pos, res, hooks) {
    if (!res || !ld?.rig) return _r3(M, ld, pos, res, hooks);
    _r3(M, ld, pos, { ...res, links: [] }, hooks);
    const F = frame([pos.x, pos.y, +pos.h || 0], (pos.rot || 0) + 90), X = F.y, Y = vmul(F.x, -1), W0 = p => vadd(F.o, vadd(vmul(X, p[0]), vadd(vmul(Y, p[1]), [0, 0, p[2]])));
    res.hookPts.flatMap(hp => res.hornX ? [[hp[0] - res.hornX, hp[1], hp[2], 0], [hp[0] + res.hornX, hp[1], hp[2], 1], [hp[0], hp[1], hp[2], 2]] : [hp]).forEach((hp, hi0) => { const hi = res.hornX ? 0 : hi0, part = res.hornX ? hp[3] : -1;
      let top = W0(hp); if (hooks && hooks.length) { const h = hooks.reduce((b, k) => Math.hypot(k[0] - top[0], k[1] - top[1]) < Math.hypot(b[0] - top[0], b[1] - top[1]) ? k : b, hooks[0]); top = res.hornX ? [top[0], top[1], h[2]] : h; }
      let z = 0;
      for (const [ei, e] of topListFor(ld, hi).entries()) { const L = Math.max(0.15, eLen(e)), k = fittingKind(e), o = vadd(top, [0, 0, -z - L]);
        if (part >= 0 && (part === 2) !== (ei >= res.hornN)) { z += L; continue; }
        const [w, d, col] = k === "loadcell" ? [0.17 * L, 0.1 * L, FIT_COL.cell] : k === "masterlink" ? [0.28 * L, 0.04, FIT_COL.link] : k === "shackle" ? [(/wide ?body/i.test(e.snap.name || "") ? 0.32 : 0.22) * L, 0.05, FIT_COL.galv] : [0.12 * L, 0.12 * L, FIT_COL.generic];
        M.box({ o, x: X, y: Y, z: [0, 0, 1] }, -w, w, -d, d, 0, L, col);
        if (k === "shackle") M.box({ o, x: X, y: Y, z: [0, 0, 1] }, -w * 1.3, w * 1.3, -0.04, 0.04, L * 0.06, L * 0.16, FIT_COL.pin);
        if (k === "loadcell") M.box({ o, x: X, y: Y, z: [0, 0, 1] }, -w * 0.62, w * 0.62, -d - 0.01, d + 0.01, L * 0.38, L * 0.62, FIT_COL.label);
        z += L; }
    });
  }; }

// rigging screen: a close-up card of the gear on each hook, top → bottom, with names and how hard each part works
{ const _rb = renderRB; renderRB = function () {
    _rb();
    const ld = RB.work, res = ld?.rig ? solveRig(ld) : null; let card = $("rbGear");
    const lists = res ? res.hookPts.map((hp, hi) => topListFor(ld, hi)) : [];
    if (!res || !lists.some(l => l && l.length)) { if (card) card.remove(); return; }
    if (!card) { card = document.createElement("div"); card.id = "rbGear"; card.className = "gearcard"; $("rbPrev").after(card); }
    const rowOf = e => res.rows.find(r => r.entry === e);
    card.innerHTML = `<div class="gh"><b>Gear on the hook</b><span class="small">close-up, top → bottom</span></div><div class="gcols">${lists.map((l, i) => {
      const sc = new Scene();
      if (res.hornX && !i) { const hx = 0.2;   // ramshorn: a horn each side, the gear as you set it (split parts one per horn)
        sc.poly("RIGGING", [[0, 0.5], [0, 0.12]], { w: 2.4, color: "#3a3e42" });
        for (const sx of [-1, 1]) sc.poly("RIGGING", Array.from({ length: 13 }, (_, k) => { const a = Math.PI * (1 + k / 12) * (sx > 0 ? -1 : 1); return [sx * hx + Math.cos(a) * hx * sx * -1 * 0 + sx * hx * Math.cos(Math.PI * k / 12) * -1, 0.12 + 0.12 - hx * Math.sin(Math.PI * k / 12) * 0.6]; }), { w: 2.4, color: "#3a3e42" });
        topStackHorns(sc, l, 0, 0, hx, res.hornN, "side"); }
      else { sc.poly("RIGGING", [[0, 0.35], [0, 0]], { w: 2.4, color: "#3a3e42" }); sc.poly("RIGGING", [[0, 0.35], [0.12, 0.5]], { w: 2.4, color: "#3a3e42" }); topStack2D(sc, l, 0, 0, "side"); }
      return `<div class="gcol">${lists.length > 1 ? `<div class="small"><b>${i ? "Crane B" : "Crane A"}</b></div>` : ""}<div class="gsvg" style="height:${Math.round(Math.max(140, Math.min(340, 90 + 190 * (l || []).reduce((a, e) => a + Math.max(0.15, eLen(e)), 0))))}px">${toSVG(sc, { pad: 0.08, noSize: true, lw: 0.012 })}</div>
        <ol class="glist">${(l || []).map(e => { const r = rowOf(e); return `<li><span>${(e.qty || 1) > 1 ? e.qty + " × " : ""}${escH(e.snap.name)}</span><span class="small">SWL ${fmtT(+e.snap.swl)} t${r && r.util != null ? ` · <b class="${r.util > 100 ? "bbad" : ""}">${fx(r.util, 0)}%</b>` : ""}</span></li>`; }).join("")}</ol></div>`; }).join("")}</div>`;
  }; }

// rigging screen: a close-up of how the rigging holds the load (end view of the load at the lifting point)
{ const _rb = renderRB; renderRB = function () {
    _rb();
    const ld = RB.work, R = ld?.rig; let card = $("rbOnLoad");
    const ls = R && R.arr === "build" && typeof loadSling === "function" ? loadSling(R) : null;
    if (!ls) { if (card) card.remove(); return; }
    const res = solveRig(ld), row = res?.rows.find(r => r.entry === ls), d = loadDims(ld), round = typeof roundSection === "function" && roundSection(ld), hk = ls.hitch || "straight";
    if (!card) { card = document.createElement("div"); card.id = "rbOnLoad"; card.className = "gearcard"; ($("rbGear") || $("rbPrev")).after(card); }
    const sc = new Scene(), H = round ? d.z : Math.min(d.z, d.y * 1.2), Wd = round ? d.z : d.y, r = Wd / 2, col = slingColour(ls.snap), t = Math.max(0.02, Wd * 0.035), up = Wd * 1.6;
    // the load's section
    if (round) sc.circle("LOAD", [0, r], r, { fill: "#d7dde3", w: 1.2, color: "#6b7682" }); else sc.rect("LOAD", -Wd / 2, 0, Wd / 2, H, { fill: "#d7dde3", w: 1.2, color: "#6b7682" });
    sc.poly("LOAD", [[-Wd * 1.2, 0], [Wd * 1.2, 0]], { w: 1, color: "#2e7d4f" });
    const ring = (g, a0, a1) => { const P = []; for (let i = 0; i <= 48; i++) { const a = a0 + (a1 - a0) * i / 48; P.push(round ? [(r + g) * Math.cos(a), r + (r + g) * Math.sin(a)] : [Math.max(-Wd / 2 - g, Math.min(Wd / 2 + g, (Wd / 2 + g) * 1.5 * Math.cos(a))), Math.max(-g, Math.min(H + g, H / 2 + (H / 2 + g) * 1.5 * Math.sin(a)))]); } return P; };
    const topZ = (round ? 2 * r : H);
    if (hk === "straight") {
      // shackle / hook on a lug on top
      sc.rect("LOAD", -Wd * 0.06, topZ, Wd * 0.06, topZ + Wd * 0.18, { fill: "#8a9199", w: 0.8, color: "#4b5157" });
      sc.poly("RIGGING", [[0, topZ + Wd * 0.18], [0, topZ + up]], { w: 2.4, color: col });
    } else if (hk === "choke" || hk === "dwchoke") {
      const n = hk === "dwchoke" ? 2 : 1;
      for (let k = 0; k < n; k++) sc.poly("RIGGING", ring(t * (1.5 + k * 2.4), Math.PI / 2 + 0.3, Math.PI * 2.5 - 0.3), { w: 2.4, color: col });
      sc.circle("RIGGING", [0, topZ + t * (1.5 + (n - 1) * 2.4) + t], t * 1.6, { fill: "none", w: 2, color: col });   // the eye it chokes through
      sc.poly("RIGGING", [[0, topZ + t * 4], [0, topZ + up]], { w: 2.4, color: col });
    } else {
      const n = hk === "dwbasket" ? 2 : 1, g = t * (1.5 + (n - 1) * 2.4);
      if (n === 2) sc.poly("RIGGING", ring(t * 1.5, 0, Math.PI * 2), { w: 2.4, color: col });
      sc.poly("RIGGING", ring(g, Math.PI, Math.PI * 2), { w: 2.4, color: col });
      const xs = round ? r + g : Wd / 2 + g;
      sc.poly("RIGGING", [[-xs, round ? r : H / 2], [-Wd * 0.15, topZ + up]], { w: 2.4, color: col }); sc.poly("RIGGING", [[xs, round ? r : H / 2], [Wd * 0.15, topZ + up]], { w: 2.4, color: col });
    }
    const name = (HITCH[hk] || {}).name || "Straight";
    const parts = row ? (row.hitchParts || []).map(q => `${q[1]} (${q[0]})`).join(" × ") : "";
    card.innerHTML = `<div class="gh"><b>On the load – ${escH(hk === "straight" ? "to the lifting points" : name.toLowerCase())}</b><span class="small">close-up, end view</span></div>
      <div class="gcols"><div class="gcol"><div class="gsvg" style="height:180px;width:180px">${toSVG(sc, { pad: Wd * 0.25, noSize: true, lw: Wd * 0.012 })}</div>
      <div class="small" style="max-width:320px;line-height:1.5"><b>${escH(ls.snap.name)}</b><br>SWL ${fx(+ls.snap.swl)} t${parts ? " × " + escH(parts) : ""}${row ? ` = <b>${fx(row.swl, 2)} t</b><br>takes ${fx(row.load, 2)} t · <b class="${row.util > 100 ? "bbad" : ""}">${fx(row.util, 0)}%</b>` : ""}
      ${hk === "choke" || hk === "dwchoke" ? `<br><span class="bnote">A choke grips by pinching – rated at 80% of the straight SWL (EN 13414), less when the angle of choke is under 120°.${hk === "dwchoke" ? " The second turn gives more grip on smooth, round loads; the rating is the same." : ""}</span>` : hk === "basket" || hk === "dwbasket" ? `<br><span class="bnote">Both ends go to the hook: each side is checked with its own angle, so the sling carries up to 2 × SWL when vertical and less as the sides spread.${hk === "dwbasket" ? " The extra turn stops the load sliding." : ""}</span>` : `<br><span class="bnote">Straight pull on each lifting point – full SWL, the leg angle is in the load.</span>`}
      ${ls.snap.type === "sling_wire" && hk !== "straight" && round ? `<br><span class="bnote">Wire rope bent round the load: D/d ${fx(d.z / (ropeDia(ls) || 1), 1)}:1 – below 25:1 the rating drops.</span>` : ""}</div></div></div>`;
  }; }
