// ================= The sheet set: crane data sheet(s), rigging sheet(s), one calculation sheet, then the lift plans =================
// Lean: nothing repeated. One crane data sheet per crane (every lift it does is a row in its table), one rigging sheet
// per set of gear (rigSignature), one calculation sheet for all lifts (a column per lift), then each lift's plan sheet.
const SS_W = 3508, SS_H = 2480, SS_M = 36;
// text the planner can reword in the PDF preview (double-click): stored in plan.meta.sheetText[key]; "App's text" puts it back
const ssT = (key, auto) => { const o = plan.meta?.sheetText?.[key]; return o != null ? String(o) : String(auto ?? ""); };
const ssEd = (key, auto) => ` data-ed="${escH(key)}" data-auto="${escH(auto ?? "")}"`;
// wording that follows each crane's own type and set-up (no crawler terms for a mobile crane, no superlift if none is used)
const SS_AREA = { matrow: "mats under one track (along the track contact)", track: "one track's ground contact area", mat: "one outrigger mat", pad: "one outrigger pad" };
const ssAreaTerms = cs => [...new Set(cs.filter(c => REG.cranes[c.model]?.type !== "ped").map(c => { try { return SS_AREA[matInfo(c).basis] || "the bearing area"; } catch (e) { return "the bearing area"; } }))];
const ssGawTerms = Ss => ["crane", "counterweight", ...(Ss.some(S => +S.slWt > 0) ? ["superlift ballast"] : []), "TW"].join(" + ");
// the confidentiality line along the foot of every sheet (wording in the plan details; neutral by default)
const SS_DISC = "CONFIDENTIAL – This document and its contents are confidential. Unauthorised copying, reproduction, distribution, disclosure or use, in whole or in part, is strictly prohibited without prior written authorisation.";
const SS_DISC_OLD = ["CONFIDENTIAL – This document and the information in it are provided for the planned lift only. It must not be copied, distributed or used for any other purpose without permission."];
function ssDisc(svg) {
  if (!svg || /data-disc="1"/.test(svg)) return svg; const t0 = plan.meta?.disclaimer ?? SS_DISC, t = SS_DISC_OLD.includes(t0) ? SS_DISC : t0; if (!String(t).trim()) return svg;
  return String(svg).replace(/<\/svg>\s*$/, `<text data-disc="1" x="56" y="2432" font-size="15" fill="#7a8591">${escH(t)}</text></svg>`);
}
// every other line of text on every sheet can be reworded too: each is keyed by its sheet, its own words and which
// occurrence it is, so a change sticks across saves (if the plan changes those words, the app's new words show again)
const ssDec = t => String(t).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
function ssAllEd(svg, base) {
  if (!svg) return svg; const seen = new Map(), T = plan.meta?.sheetText || {};
  return String(svg).replace(/<text([^>]*)>([^<]*)<\/text>/g, (m, at, body) => {
    if (/\sdata-ed=|\sdata-noed=/.test(at) || !body.trim()) return m;
    const txt = ssDec(body), n = (seen.get(txt) || 0) + 1; seen.set(txt, n);
    const key = `t:${base}:${n}:${txt}`, o = T[key];
    return `<text${at} data-ed="${escH(key)}" data-auto="${escH(txt)}">${o != null ? escH(o).replace(/>/g, "&gt;") : body}</text>`; });
}
// allowed ground bearing – shown as TO BE CONFIRMED when it is not known
const gbcTxt = cr => { const v = gbcFor(cr); return !v ? "TO BE CONFIRMED" : `${fx(v, 1)} t/m²${plan.site?.gbcTbc && !(+cr?.gbc > 0) ? " (TBC)" : ""}`; };
const gbcKnown = cr => !!gbcFor(cr) && !(plan.site?.gbcTbc && !(+cr?.gbc > 0));
// ---- title block – the same on every sheet: COMPANY (who issues the plan) and CLIENT, each with its logo when one is
// uploaded (the space stays blank otherwise), the revision line, the plan title, project, lift no., sheet and rev.
function tbBlock(o) {
  const { W, H, M } = o, w = 1060, x0 = W - M - 20 - w, hC = 112, hR = 72, hT = 96, hN = 64, y0 = H - M - 20 - (hC + hR + hT + hN), e = s => escH(String(s ?? ""));
  const m = plan.meta || {}, ink = "#16202a", lab = "#566476", sw = 2, fit = (v, wd, f) => (typeof fitFs === "function" ? fitFs(String(v ?? ""), wd, f) : f).toFixed(1);
  const box = (x, y, bw, bh) => `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="none" stroke="${ink}" stroke-width="${sw}"/>`;
  const label = (x, y, t) => `<text x="${x + 10}" y="${y + 22}" font-size="16" fill="${lab}">${t}</text>`;
  const val = (x, y, bw, v, f, dy) => `<text x="${x + 10}" y="${y + dy}" font-size="${fit(v, bw - 20, f)}" font-weight="700" fill="${ink}">${e(v)}</text>`;
  let g = `<g data-tb="1">`;
  // company / client – logo on the right of each box when there is one
  const party = (x, t, name, logo) => { let s = box(x, y0, w / 2, hC) + label(x, y0, t); const lw = logo ? 170 : 0;
    if (logo) s += `<image href="${e(logo)}" x="${x + w / 2 - lw - 10}" y="${y0 + 12}" width="${lw}" height="${hC - 24}" preserveAspectRatio="xMidYMid meet"/>`;
    return s + val(x, y0, w / 2 - lw - 10, name || "", 28, 76); };
  g += party(x0, "COMPANY", m.company, m.companyLogo) + party(x0 + w / 2, "CLIENT", m.client, m.clientLogo);
  // revision line
  { const y = y0 + hC, cw = [90, 200, 560, 210], hd = ["REV.", "DATE", "DESCRIPTION", "BY"], v = [m.rev || "A", m.date || "", m.revDesc || "Issued for approval", m.by || ""];
    let x = x0; cw.forEach((c, i) => { g += box(x, y, c, hR) + label(x, y, hd[i]) + val(x, y, c, v[i], 22, 58); x += c; }); }
  // title
  { const y = y0 + hC + hR; g += box(x0, y, w, hT) + label(x0, y, "LIFT PLAN") + val(x0, y, w, plan.name || "", 36, 76); }
  // project / lift no. / sheet / rev
  { const y = y0 + hC + hR + hT, cw = [420, 290, 230, 120], hd = ["PROJECT / LOCATION", "LIFT NO.", "SHEET", "REV."], v = [m.project || "", o.lift ?? "", o.sheet ?? "–", m.rev || "A"];
    let x = x0; cw.forEach((c, i) => { g += box(x, y, c, hN) + `<text x="${x + 10}" y="${y + 20}" font-size="15" fill="${lab}">${hd[i]}</text><text x="${x + 10}" y="${y + 52}" font-size="${fit(v[i], c - 20, 24)}" font-weight="700" fill="${ink}">${e(v[i])}</text>`; x += c; }); }
  { const T = typeof teamLine === "function" && o.team ? teamLine() : ""; if (T) g += `<text x="${x0}" y="${y0 - 12}" font-size="16" fill="${lab}">${e(T)}</text>`; }
  return g + `</g>`;
}
// the working under the bearing area: what it is made of, in numbers
function ssAreaWork(cr, S) {
  try { const C = REG.cranes[cr.model], mi = matInfo(cr, C), A = +S.matA || mi.area;
    if (mi.basis === "track") { const tl = trackContact(cr, C); return `${fx(tl, 2)} m track contact × ${fx(C.car.shoe, 2)} m shoe`; }
    if (mi.basis === "matrow") { const tl = trackContact(cr, C); return `${fx(tl, 2)} m track contact × ${fx(A / tl, 2)} m of mat`; }
    if (mi.basis === "mat") return `${fx(mi.L, 2)} × ${fx(mi.W, 2)} m mat`;
    if (mi.basis === "pad") { const d = (C.or && C.or.float) || 0.6; return `π × ${fx(d, 2)}² ÷ 4 (pad)`; }
  } catch (e) { }
  return ""; }
// a crane mass is confirmed when it was typed in for this crane, or the library entry names its source
function craneMassTbc(cr, C) { if (!C || C.type === "ped") return false; if (cr && cr.wCrane !== "" && cr.wCrane != null && !isNaN(+cr.wCrane)) return false; return !(C.mass && C.mass.src); }
function ssFrame(title, liftLabel) {
  const W = SS_W, H = SS_H, M = SS_M, bandY = H - 420, e = s => escH(String(s ?? ""));
  let g = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">
<rect width="${W}" height="${H}" fill="#fff"/><rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="none" stroke="#16202a" stroke-width="4"/>
<line x1="${M}" y1="${bandY}" x2="${W - M}" y2="${bandY}" stroke="#16202a" stroke-width="4"/>`;
  g += `<text x="${M + 24}" y="${M + 56}" font-size="36" font-weight="700" fill="#16202a">${e(title)}</text>`;
  const close = () => {
    let t = "";
    const sx = M + 30, sy = bandY + 30, x = sx;
    // (prepared-by / signature box left off – not needed for now)
    t += tbBlock({ W, H, M, lift: typeof liftNoBox === "function" ? liftNoBox(liftLabel) : liftLabel, sheet: "–" });
    return g + t + "</svg>";
  };
  return { W, H, M, bandY, e, add: s => { g += s; }, close };
}
// a drawing (Scene, metres) fitted into a box on the sheet, CAD line weights
function ssScene(scene, x, y, w, h, title) {
  const [x0, y0, x1, y1] = scene.bounds(), sw = Math.max(1, x1 - x0), sh = Math.max(1, y1 - y0);
  const k = Math.min((w - 40) / sw, (h - 80) / sh), ox = x + (w - sw * k) / 2 - x0 * k, oy = y + 50 + (h - 80 - sh * k) / 2 + y1 * k;
  return `<text x="${x + w / 2}" y="${y + 30}" font-size="24" font-weight="700" text-anchor="middle" fill="#16202a" text-decoration="underline">${escH(title)}</text>
${cadHatchDefs("cadHs", 0.35)}<g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${k.toFixed(4)})">${sceneMarkup(typeof cadMono === "function" ? cadMono(scene) : scene, 1.9 / k)}</g>`;
}
// dimension lines (horizontal / vertical) with ticks and the value
function ssDimH(s, xa, xb, y, label, sz) { csDim(s, [xa, y], [xb, y], 0, label, sz, { noExt: true }); }
function ssDimV(s, x, ya, yb, label, sz, left) { if (left) csDim(s, [x, yb], [x, ya], 0, label, sz, { noExt: true }); else csDim(s, [x, ya], [x, yb], 0, label, sz, { noExt: true }); }
function ssExt(s, a, b) { s.poly("DIMS", [a, b], { w: 0.5, dash: [0.3, 0.2] }); }

// ---------- which cranes: one group per crane (the same crane in several lifts is one group) ----------
function ssCraneGroups() {
  syncLift(); const G = new Map();
  plan.lifts.forEach((L, i) => (L.cranes || []).forEach(c => { if (!REG.cranes[c.model]) return; const k = c.label + "|" + c.model; if (!G.has(k)) G.set(k, []); G.get(k).push({ i, c }); }));
  return [...G.values()];
}
function ssRow(i, c) {
  return withLift(i, () => { const S = craneSummary(c), ev = S.ph || {}; const rr = (() => { const ld = plan.loads.find(l => l.id === c.attach?.load); const r = ld && ld.rig?.arr ? solveRig(ld) : null; if (!r) return null; if (typeof rigCalc === "function") { const k = rigCalc(ld); if (k && k.items.length) { const w = k.items.reduce((m, x) => (+x.use || 0) > (+m?.use || -1) ? x : m, null); return w ? { ...w, util: w.use } : null; } }   // same figure as the rigging calculation (with the DAF)
      const w = r.rows.reduce((m, x) => (+x.util || 0) > (+m?.util || -1) ? x : m, null); return w; })();
    const ld = plan.loads.find(l => l.id === c.attach?.load), tp = ld ? travelPath(ld) : null;
    return { i, c, S, ld, rr, tp, lift: plan.lifts[i].name, warn: S.warn.slice() }; });
}

// ---------- crane data sheet ----------
function craneSpecSheetSVG(group) {
  const rows = group.map(g => ssRow(g.i, g.c)), r0 = rows.reduce((m, r) => (r.S.maxR || 0) > (m.S.maxR || 0) ? r : m, rows[0]);
  const cr = r0.c, C = REG.cranes[cr.model], S0 = r0.S, k = C.car || {}, u = C.up || {}, crw = C.type === "cr";
  const idx = [...new Set(rows.map(r => r.i))], lab = typeof liftRangeLabel === "function" ? liftRangeLabel(idx) : rows.map(r => r.lift).join(", ");
  const F = ssFrame(`CRANE DATA – ${C.name}${String(cr.label || "").trim() ? ` (${cr.label})` : ""}`, typeof liftShort === "function" ? liftShort(lab) : lab), e = F.e;
  const om = C.or ? (C.or.modes[cr.orMode] || Object.values(C.or.modes)[0]) : null;
  const ev = S0.ph.pick, th = ev.ba?.theta || 60, sl = withLift(r0.i, () => slOf(cr, C)), slR = sl ? sl.R : 0, cfg = cfgDraw(cr, C);
  const vx = F.M + 30, vy = F.M + 90, tblH = 110 + rows.length * 46, vh = F.bandY - vy - tblH - 50;
  const BOX = crw && C.spec && typeof csCrawlerSide === "function" ? { side: [750, vh * 0.44], top: [900, vh * 0.55], rear: [900, vh * 0.45] } : { side: [1350, vh], top: [900, vh * 0.55], rear: [900, vh * 0.45] };
  const pxSize = (sc, box, px) => { const [a, b, c, d] = sc.bounds(); const kk = Math.min((box[0] - 40) / Math.max(1, c - a), (box[1] - 80) / Math.max(1, d - b)) * 0.8; return px / kk; };
  // side elevation: the crane in its set-up for the lift at the longest radius
  const side = new Scene(); side.add(carrierSide(C, om));
  const up = upperSide(C, cr.L, th, ev.R || 10, crw ? slR : 0, cfg, sl); side.add(up.s);
  const tip = up.tip, pv = C.boom.pivot, pz = pv[1] + (crw ? 0 : (typeof DZ !== "undefined" ? DZ : 0)), gx0 = Math.min(-(u.tail || 5) - (slR ? slR + 3 : 2), crw ? -k.len / 2 : k.rear) - 1;
  if (typeof cadGround === "function") cadGround(side, gx0, Math.max(tip[0], ev.R || 0) + 3); else side.poly("GROUND", [[gx0, 0], [Math.max(tip[0], ev.R || 0) + 3, 0]], { w: 1.4 });
  side.poly("REF", [[0, -1.5], [0, tip[1] + 2]], { dash: [1.6, 0.4, 0.25, 0.4], w: 0.7 });   // slew centre line
  const zs = pxSize(side, BOX.side, 22);
  ssDimV(side, Math.max(tip[0], ev.R || 0) + 2, 0, tip[1], `${fx(tip[1], 1)} m`, zs);
  ssDimH(side, -(u.tail || 0), 0, -zs * 1.6, `tail ${fx(u.tail, 2)} m`, zs);
  ssDimH(side, 0, ev.R || 0, -zs * 3.4, `radius ${fx(ev.R, 1)} m`, zs);
  // (boom length and angle are in the view title – no label along the boom)
  ssDimV(side, gx0 + 0.5, 0, pz, `pivot ${fx(pz, 2)} m`, zs * 0.8, true);
  // rear view
  const rear = new Scene(); rear.add(carrierEnd(C, om));
  const bh = u.baseH || 2, cwW = u.cwW || 3, cwH = u.cwH || 2.5; rear.rect("COUNTERWEIGHT", -cwW / 2, bh, cwW / 2, bh + cwH, { fill: true, w: 1.1 });
  const ow = crw ? k.gauge + k.shoe : (om ? om.spread : k.w || 3), rs = pxSize(rear, BOX.rear, 22);
  rear.poly("GROUND", [[-ow / 2 - 1, 0], [ow / 2 + 1, 0]], { w: 1.4 });
  if (crw) { ssDimH(rear, -k.gauge / 2, k.gauge / 2, -rs * 1.6, `gauge ${fx(k.gauge, 2)} m`, rs); ssDimH(rear, -ow / 2, ow / 2, -rs * 3.4, `overall ${fx(ow, 2)} m`, rs); }
  else { ssDimH(rear, -(k.w || 3) / 2, (k.w || 3) / 2, -rs * 1.6, `carrier ${fx(k.w, 2)} m`, rs); if (om) ssDimH(rear, -om.spread / 2, om.spread / 2, -rs * 3.4, `outriggers ${fx(om.spread, 2)} m`, rs); }
  ssDimH(rear, -cwW / 2, cwW / 2, bh + cwH + rs * 1.2, `CW ${fx(cwW, 2)} m`, rs * 0.85);
  ssDimV(rear, ow / 2 + rs * 1.5, 0, bh + cwH, `${fx(bh + cwH, 2)} m`, rs);
  // top view (front of the carrier to the right, boom over the front as in the lift)
  const top = new Scene(), tl = new Scene(); tl.add(carrierPlan(C, cr.orMode)); tl.add(upperPlan(C, cr.L, th, crw ? slR : 0, cfg, sl));
  top.add(tl, -90);
  const ts = pxSize(top, BOX.top, 20);
  top.circle("DIMS", [0, 0], u.tail || 5, { dash: [0.6, 0.4], w: 0.7 });
  { const t = u.tail || 5, a = 135 * D2R, q = [t * Math.cos(a), t * Math.sin(a)]; top.poly("DIMS", [[0, 0], q], { w: 0.8 }); top.poly("DIMS", [q, [q[0] - ts * 4, q[1] + ts * 0.9]], { w: 0.6 });
    top.text("DIMS", [q[0] - ts * 4, q[1] + ts * 1.6], `tail radius ${fx(t, 2)} m`, ts, { bold: true, color: "#16202a" }); }
  if (crw) { ssDimH(top, -k.len / 2, k.len / 2, -(k.gauge + k.shoe) / 2 - ts * 3.2, `track ${fx(k.len, 2)} m (contact ${fx(trackContact(cr, C), 2)} m)`, ts); }
  else { ssDimH(top, k.rear, k.front, -(om ? om.spread : 3) / 2 - ts * 3.2, `carrier ${fx(k.front - k.rear, 2)} m`, ts); }
  if (slR) top.text("DIMS", [-slR, (k.gauge || 6) / 2 + ts * 1.2], `SL radius ${fx(slR, 1)} m`, ts, { bold: true, color: "#16202a" });
  if (crw && typeof csCrawlerSide === "function" && C.spec) {
    // manufacturer-style views: side and top on one scale (aligned), rear view, and the set-up for the lift
    const wL = 1500, hS = vh * 0.56, hT = vh - hS, wR = 2270 - wL - 20;
    let kk = 40; for (let it = 0; it < 2; it++) { const z = 22 / kk; kk = Math.min(csFit(csCrawlerSide(C, cr, th, sl, z), wL, hS), csFit(csCrawlerTop(C, cr, sl, z), wL, hT)); }
    const z = 22 / kk, sideB = csCrawlerSide(C, cr, th, sl, z), topB = csCrawlerTop(C, cr, sl, z);
    kk = Math.min(csFit(sideB, wL, hS), csFit(topB, wL, hT));
    // side and top share their horizontal position (slew centre on the same vertical line)
    const place = (sc, y, h, title) => { const [, y0, , y1] = sc.bounds(), cxp = vx + wL * 0.5, sb = sideB.bounds(), ox = cxp - ((sb[0] + sb[2]) / 2) * kk, oy = y + 46 + (h - 56 - (y1 - y0) * kk) / 2 + y1 * kk;
      return `<text x="${vx + 12}" y="${y + 30}" font-size="23" font-weight="700" fill="${CS_INK}">${escH(title)}</text><g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${kk.toFixed(4)})">${sceneMarkup(sc, 1.5 / kk)}</g>`; };
    F.add(place(sideB, vy, hS, "SIDE VIEW – BASIC CRANE" + (sl ? " WITH SUPERLIFT" : "")));
    F.add(place(topB, vy + hS, hT, "TOP VIEW"));
    let kr = 40; for (let it = 0; it < 2; it++) kr = csFit(csCrawlerRear(C, 22 / kr), wR, hS);
    F.add(csPlace(csCrawlerRear(C, 22 / kr), vx + wL + 20, vy, wR, hS, kr, "REAR VIEW"));
    F.add(ssScene(side, vx + wL + 20, vy + hS, wR, hT, `SET-UP · boom ${fx(cr.L, 1)} m at ${fx(th, 1)}° · R ${fx(ev.R, 1)} m`).replace(/text-anchor="middle" fill="#16202a" text-decoration="underline"/, 'text-anchor="middle" fill="#16202a"'));
    F.add(`<text x="${vx + 12}" y="${F.bandY - tblH - 34}" font-size="18" fill="#566476">Dimensions in mm, from ${escH(C.src || "the crane data sheet")}. The set-up drawing is to the lift's boom, angle and radius.</text>`);
  } else {
  F.add(ssScene(side, vx, vy, 1350, vh, "SIDE ELEVATION (SET-UP FOR THE LONGEST RADIUS)"));
  F.add(ssScene(top, vx + 1370, vy, 900, vh * 0.55, "TOP VIEW"));
  F.add(ssScene(rear, vx + 1370, vy + vh * 0.55, 900, vh * 0.45, "REAR VIEW"));
  }
  // data column
  const dx = vx + 2300, dw = F.W - F.M - 30 - dx; let dy = vy;
  // only print what has a value: blank / unknown items stay in the app, not on the sheet
  const table = (title, items) => { items = items.filter(r => r && r[1] != null && String(r[1]).trim() !== "" && r[1] !== "–"); if (!items.length) return; F.add(`<text x="${dx}" y="${dy + 28}" font-size="24" font-weight="700" fill="#16202a">${e(title)}</text>`); dy += 42;
    items.forEach(([a, b], n) => { F.add(`${n % 2 ? "" : `<rect x="${dx}" y="${dy}" width="${dw}" height="36" fill="#f4f6f8"/>`}<text x="${dx + 8}" y="${dy + 25}" font-size="18" fill="#566476">${e(a)}</text><text x="${dx + dw - 8}" y="${dy + 25}" font-size="${fitFs(ssT(`crane:${cr.label}:${a}`, b), dw * 0.58, 19, 12).toFixed(1)}" text-anchor="end" font-weight="700" fill="#16202a"${ssEd(`crane:${cr.label}:${a}`, b)}>${e(ssT(`crane:${cr.label}:${a}`, b))}</text>`); dy += 36; });
    dy += 22; };
  const hb = typeof blockDims === "function" ? blockDims(cr, C) : null;
  table("CRANE", [["Make / model", C.name], ["Type", crw ? "Crawler crane" : C.type === "ped" ? "Pedestal crane" : "Mobile (all-terrain) crane"], ["Class", C.cap || "–"], ["Data from", C.src || ""]]);
  table("DIMENSIONS", crw ? [["Track length", `${fx(k.len, 2)} m`], ["Track ground contact", `${fx(trackContact(cr, C), 2)} m`], ["Track gauge (c/c)", `${fx(k.gauge, 2)} m`], ["Shoe width", `${fx(k.shoe, 2)} m`], ["Overall width", `${fx(k.gauge + k.shoe, 2)} m`], ["Tail swing radius", `${fx(u.tail, 2)} m`], ["Boom pivot (from centre / height)", `${fx(pv[0], 2)} / ${fx(pz, 2)} m`]]
    : [["Carrier length", `${fx(k.front - k.rear, 2)} m`], ["Carrier width", `${fx(k.w, 2)} m`], ["Outrigger spread", om ? `${fx(om.spread, 2)} m (${cr.orMode || "set"})` : "–"], ["Tail swing radius", `${fx(u.tail, 2)} m`], ["Boom pivot (from centre / height)", `${fx(pv[0], 2)} / ${fx(pz, 2)} m`]]);
  table("SET-UP", [["Boom", `${fx(cr.L, 1)} m`], ["Max boom angle", `${fx(C.maxAngle, 0)}°`], ["Counterweight", `${fx(S0.cwWt, 1)} t`], ...(sl ? [["Superlift", `${fx(sl.T, 1)} t at ${fx(sl.R, 1)} m`]] : []), ["Crane mass (base)", `${fx(S0.craneWt, 1)} t${craneMassTbc(cr, C) ? " (TBC)" : ""}`],
    ["Hook block", hb ? blockName(hb) : ""], ["Hook block SWL", hb && hb.cap ? `${fx(hb.cap, 0)} t` : ""], ["Hook block weight", +cr.hookBlock > 0 ? `${fx(+cr.hookBlock, 2)} t` : ""], ["Falls (parts of line)", hb && hb.parts ? String(hb.parts) : ""], ...(+cr.linePull > 0 ? [["Line pull", `${fx(cr.linePull, 1)} t per fall`]] : []), ["Load chart", S0.chart ? S0.chart.label : "–"]]);
  // mats the crane stands on – size, material, how many and how they are laid
  { let ms = []; try { ms = matsUnderCrane(cr, C) || []; } catch (e) { }
    if (C.type !== "ped") { const seen = new Set(), flat = ms.filter(m => { const k = [m.x, m.y, m.w, m.h].map(v => (+v || 0).toFixed(2)).join(); if (seen.has(k)) return false; seen.add(k); return true; });
      const kinds = {}; for (const m of flat) { const [L, W] = matLW(m), t = +m.hgt || 0, k = `${fx(L, 1)} × ${fx(W, 1)} m`; kinds[k] = (kinds[k] || 0) + 1; }
      let laid = ""; if (flat.length && crw) { const m0 = flat[0], matAx = (+m0.rot || 0) + (+m0.h >= +m0.w ? 90 : 0), trkAx = (+cr.heading || 0) + 90, a = (((matAx - trkAx) % 180) + 180) % 180; laid = a < 30 || a > 150 ? "along the tracks" : a > 60 && a < 120 ? "across the tracks" : ""; }   // tracks run along the crane's local y
      table("MATS", flat.length ? [["Mats", `${flat.length}${ms.length > flat.length ? ` (${ms.length} incl. stacked)` : ""}`], ...Object.entries(kinds).map(([k, n]) => ["Size per mat (L × W)", k])]
        : [["Mats", crw ? "none – on the tracks" : "none – on the outrigger pads"]]); } }
  // (ground bearing is worked on the calculation and plan sheets – this sheet keeps to the crane data)
  // per-lift table
  const ty = F.bandY - tblH - 20, tx = vx, tw = F.W - 2 * F.M - 60;
  const head = ["Lift", "Boom", "Angle pick / set", "Radius pick / set", "Max R / chart row", "Rated capacity", "Total load (TW)", "Utilisation"], wd = [0.2, 0.09, 0.14, 0.14, 0.14, 0.1, 0.1, 0.09];
  F.add(`<text x="${tx}" y="${ty + 28}" font-size="24" font-weight="700" fill="#16202a">LIFTS DONE WITH THIS CRANE</text>`);
  let yy = ty + 44; const rowM = (vals, bold, fill, cols) => { let x = tx; if (fill) F.add(`<rect x="${tx}" y="${yy}" width="${tw}" height="44" fill="${fill}"/>`); vals.forEach((v, n) => { const w = wd[n] * tw; F.add(`<text x="${n ? x + w - 10 : x + 10}" y="${yy + 30}" font-size="${fitFs(v, w - 20, 21, 12).toFixed(1)}" text-anchor="${n ? "end" : "start"}" fill="${(cols && cols[n]) || "#16202a"}"${bold ? ' font-weight="700"' : ""}>${e(v)}</text>`); x += w; }); yy += 44; };
  rowM(head, true, "#e9edf1");
  const colS = st => st === "bad" ? "#b42318" : st === "amber" ? "#a15c00" : "#1e7a3c";
  rows.forEach((r, n) => { const S = r.S, st = S.status === "bad" ? "bad" : S.status === "amber" ? "amber" : "ok";
    rowM([r.lift, `${fx(r.c.L, 1)} m`, `${fx(S.ph.pick.ba?.theta, 1)}° / ${fx(S.ph.set.ba?.theta, 1)}°`, `${fx(S.ph.pick.R, 1)} / ${fx(S.ph.set.R, 1)} m`, `${fx(S.maxR, 1)} / ${S.rUsed != null ? fx(S.rUsed, 1) : "–"} m`, S.cap != null ? `${fx(S.cap, 1)} t` : "–", `${fx(S.TW, 2)} t`, S.util != null ? `${fx(S.util, 1)} %` : "–"], false, n % 2 ? "#f7f9fa" : null, [null, null, null, null, null, null, null, colS(S.util > 100 ? "bad" : "ok")]); });
  return F.close();
}

// ---------- one calculation sheet for all lifts (a column per lift and crane) ----------
function calcSheetsSVG() {
  syncLift(); const cols = [];
  plan.lifts.forEach((L, i) => (L.cranes || []).forEach(c => { if (REG.cranes[c.model] && c.attach?.load) cols.push(ssRow(i, c)); }));
  if (!cols.length) return [];
  const per = 6, out = [];
  for (let p = 0; p < cols.length; p += per) out.push(calcSheetSVG(cols.slice(p, p + per), cols.length > per ? ` (${p / per + 1} of ${Math.ceil(cols.length / per)})` : ""));
  return out;
}
function calcSheetSVG(cols, part) {
  const idx = [...new Set(cols.map(c => c.i))], lab = typeof liftRangeLabel === "function" ? liftRangeLabel(idx) : "";
  const F = ssFrame(`CALCULATION CHECK – ALL LIFTS${part}`, typeof liftShort === "function" ? liftShort(lab) : lab), e = F.e;
  const x0 = F.M + 30, wL = 820, wC = Math.min(470, (F.W - 2 * F.M - 60 - wL) / cols.length), wTot = wL + wC * cols.length, rh = 52;
  let y = F.M + 90;
  const multiCr = cols.some(r => plan.lifts[r.i].cranes.filter(c => c.attach?.load).length > 1);
  const colS = st => st === "bad" ? "#b42318" : st === "amber" ? "#a15c00" : st === "ok" ? "#1e7a3c" : "#16202a";
  const head = () => { F.add(`<rect x="${x0}" y="${y}" width="${wTot}" height="${rh + 10}" fill="#e9edf1"/><text x="${x0 + 10}" y="${y + 38}" font-size="22" font-weight="700" fill="#16202a">Check · method</text>`);
    cols.forEach((r, n) => { const t = multiCr ? `${r.lift} · ${r.c.label}` : r.lift; F.add(`<text x="${x0 + wL + wC * (n + 1) - 12}" y="${y + 38}" font-size="${fitFs(t, wC - 24, 22, 13).toFixed(1)}" text-anchor="end" font-weight="700" fill="#16202a">${e(t)}</text>`); }); y += rh + 10; };
  const sec = t => { F.add(`<text x="${x0 + 10}" y="${y + 34}" font-size="21" font-weight="700" fill="#1f4e79">${e(upUnits(t))}</text><line x1="${x0}" y1="${y + 46}" x2="${x0 + wTot}" y2="${y + 46}" stroke="#1f4e79" stroke-width="1.5"/>`); y += 50; };
  let zebra = 0;
  const row = (label, method, fn) => {
    if (zebra++ % 2) F.add(`<rect x="${x0}" y="${y}" width="${wTot}" height="${rh}" fill="#f6f8f9"/>`);
    F.add(`<text x="${x0 + 10}" y="${y + 22}" font-size="20" font-weight="700" fill="#16202a">${e(label)}</text>${method ? `<text x="${x0 + 10}" y="${y + 44}" font-size="${fitFs(method, wL - 20, 16, 11).toFixed(1)}" fill="#566476">${e(method)}</text>` : ""}`);
    cols.forEach((r, n) => { let v; try { v = fn(r); } catch (err) { v = ["–"]; } const [a, b, st] = Array.isArray(v) ? v : [v]; const xr = x0 + wL + wC * (n + 1) - 12;
      const key = `calc:${r.i}:${r.c.label}:${label}`, at = ssT(key, a);
      F.add(`<text x="${xr}" y="${y + (b ? 22 : 32)}" font-size="${fitFs(at, wC - 24, 21, 12).toFixed(1)}" text-anchor="end" font-weight="700" fill="${at !== String(a) ? "#16202a" : colS(st)}"${ssEd(key, a)}>${e(at)}</text>${b ? `<text x="${xr}" y="${y + 44}" font-size="${fitFs(b, wC - 24, 15, 10).toFixed(1)}" text-anchor="end" fill="#566476">${e(b)}</text>` : ""}`); });
    y += rh;
  };
  head();
  sec("Load");
  row("Load", "", r => [r.ld ? r.ld.name : "–"]);
  row("Load weight", "entered / load library", r => [`${fx(+r.ld?.weight || 0, 2)} t`, r.ld?.wInclRig ? "incl. rigging" : ""]);
  row("Rigging weight", "sum of the rigging schedule", r => [`${fx(rigW(r.ld), 3)} t`]);
  row("Hook block + other", "crane block, extra entered", r => [`${fx((+r.c.hookBlock || 0) + (+r.c.extra || 0), 2)} t`]);
  row("Total load on the hook (TW)", ((plan.lifts || []).some(L => (L.cranes || []).filter(c => c.attach?.load).length > 1) ? "load + rigging + block (share in a tandem)" : "load + rigging + hook block"), r => [`${fx(r.S.TW, 2)} t`]);
  sec("Crane");
  row("Crane / load chart", "", r => [`${r.c.label} · ${REG.cranes[r.c.model].short}`, r.S.chart ? r.S.chart.label : "no chart"]);
  row("Boom", "length · angle at pick / set", r => [`${fx(r.c.L, 1)} m`, `${fx(r.S.ph.pick.ba?.theta, 1)}° / ${fx(r.S.ph.set.ba?.theta, 1)}°`]);
  row("Pick radius", "crane centre to the load's CoG at the pick", r => `${fx(r.S.ph.pick.R, 1)} m`);
  row("Set radius", "crane centre to the load's CoG at the set", r => `${fx(r.S.ph.set.R, 1)} m`);
  row("Max radius", "the largest radius in the lift – the load chart is read here", r => `${fx(r.S.maxR, 1)} m`);
  row("Rated capacity", "chart, next row up from the max radius", r => [r.S.cap != null ? `${fx(r.S.cap, 1)} t` : "–", r.S.rUsed != null ? `row ${fx(r.S.rUsed, 1)} m${r.S.capManual ? " · typed" : ""}` : ""]);
  row("Utilisation", "TW ÷ rated capacity × 100", r => [r.S.util != null ? `${fx(r.S.util, 1)} %` : "–", r.S.cap != null ? `${fx(r.S.TW, 2)} ÷ ${fx(r.S.cap, 1)}` : "", r.S.util == null ? "" : r.S.util > 100 ? "bad" : "ok"]);
  row("Through the lift", "highest utilisation during the slew / travel", r => r.S.seq ? [`${fx(r.S.seq.mx.util, 1)} %`, `${r.S.seq.mx.name} · R ${fx(r.S.seq.mx.R, 1)} m`, r.S.seq.mx.util > 100 ? "bad" : "ok"] : ["–"]);
  row("Slew, pick → set", "slew angle and direction (seen from above); boom angle change needed to clear anything in the way", r => r.tp && r.tp.hooks ? [Math.abs(r.tp.slew) < 0.5 ? "no slew" : `${fx(Math.abs(r.tp.slew), 0)}° ${r.tp.slew >= 0 ? "clockwise" : "anticlockwise"}`, r.tp.luff ? `${r.tp.luff.up ? "boom up" : "boom down"} to R ${fx(r.tp.luff.Rmin, 1)} m to clear` : "boom angle unchanged"] : ["–"]);
  sec("Ground");
  row("Gross applied weight (GAW)", ssGawTerms(cols.map(r => r.S)), r => r.S.C.type === "ped" ? ["vessel crane"] : [`${fx(r.S.GAW, 1)} t${craneMassTbc(r.c, r.S.C) ? " (TBC)" : ""}`, `${fx(r.S.craneWt, 1)}${craneMassTbc(r.c, r.S.C) ? " (TBC)" : ""} + ${fx(r.S.cwWt, 1)}${r.S.slWt ? " + " + fx(r.S.slWt, 1) : ""} + ${fx(r.S.TW, 2)}`]);
  const allR = cols.every(r => r.S.react), noneR = cols.every(r => !r.S.react), trk = cols.every(r => r.S.C.type === "cr") ? "track" : cols.every(r => r.S.C.type !== "cr") ? "outrigger" : "outrigger / track";
  row("Bearing load", allR ? `max ${trk} reaction from the manufacturer` : noneR ? "0.75 × GAW" : "per lift – as noted", r => r.S.C.type === "ped" ? ["–"] : [`${fx(r.S.gbpLoad ?? r.S.GAW * 0.75, 1)} t`, r.S.react ? `max ${r.S.C.type === "cr" ? "track" : "outrigger"} reaction${r.c.oSrc ? " · " + r.c.oSrc : ""}` : `0.75 × ${fx(r.S.GAW, 1)}`]);
  row("Bearing area", ssAreaTerms(cols.map(r => r.c)).join(" / ") || "–", r => r.S.C.type === "ped" ? ["–"] : [`${fx(r.S.matA, 2)} m²`, ssAreaWork(r.c, r.S)]);
  row("Ground bearing pressure", "bearing load ÷ area · against the allowed value", r => r.S.gbp == null ? ["–"] : [`${fx(r.S.gbp, 1)} t/m²`, `${fx(r.S.gbpLoad ?? r.S.GAW * 0.75, 1)} ÷ ${fx(r.S.matA, 2)} · allowed ${gbcTxt(r.c)}`, gbcKnown(r.c) ? (r.S.gbpOk === false ? "bad" : r.S.gbpOk ? "ok" : "") : ""]);
  if (cols.some(r => r.S.wind)) { sec("Wind"); row("Wind", "chart limit × √(1.2 × TW ÷ wind area)", r => r.S.wind ? [`≤ ${fx(r.S.wind.lim, 1)} m/s`, r.S.wind.now ? `forecast ${fx(r.S.wind.now, 1)} m/s` : "", r.S.wind.lvl === "bad" ? "bad" : r.S.wind.lvl === "amber" ? "amber" : "ok"] : ["–"]); }
  sec("Rigging");
  row("Highest-loaded item", "required WLL (load share × DAF) ÷ selected WLL – full list on the rigging calculation", r => r.rr ? [`${fx(r.rr.util, 0)} %`, r.rr.name, r.rr.util > 100 ? "bad" : r.rr.util > 90 ? "amber" : "ok"] : ["–"]);
  for (let n = 0; n <= cols.length; n++) F.add(`<line x1="${x0 + wL + wC * n}" y1="${F.M + 90}" x2="${x0 + wL + wC * n}" y2="${y}" stroke="#c9d0d7" stroke-width="1.5"/>`);
  F.add(`<rect x="${x0}" y="${F.M + 90}" width="${wTot}" height="${y - F.M - 90}" fill="none" stroke="#16202a" stroke-width="2"/>`);
  // notes column beside the table: the basis of every figure (and the planner's own notes)
  { const nx = x0 + wTot + 60, nw = F.W - F.M - 30 - nx;
    if (nw > 500) { const notes = [
      "Rated capacity is read from the manufacturer's load chart named for each lift. The radius is read to 0.1 m; between chart rows the next larger radius is used (no interpolation).",
      `Total load on the hook (TW) = load + rigging + hook block + any extra entered.${(plan.lifts || []).some(L => (L.cranes || []).filter(c => c.attach?.load).length > 1) ? " In a tandem lift each crane carries its share of the load." : ""}`,
      "Utilisation = TW ÷ rated capacity × 100. It is also checked at lift-off, through the slew / travel and at set-down.",
      (() => { const R = cols.filter(r => r.S.react), cr = cols.some(r => r.S.C.type === "cr"), mob = cols.some(r => r.S.C.type !== "cr" && r.S.C.type !== "ped"), area = `Bearing area = ${ssAreaTerms(cols.map(r => r.c)).join(" or ") || "the bearing area"}.`;
        return R.length === cols.length ? `Ground bearing pressure = the manufacturer's maximum ${cr && !mob ? "track" : !cr ? "outrigger" : "outrigger / track"} reaction for the set-up ÷ bearing area. ${area}`
          : !R.length ? `Ground bearing pressure = 0.75 × gross applied weight (GAW = ${ssGawTerms(cols.map(r => r.S))}) ÷ bearing area. ${area}`
          : `Ground bearing pressure = bearing load ÷ bearing area – the manufacturer's maximum reaction for ${R.map(r => r.lift).join(", ")}, 0.75 × GAW for the others. ${area}`; })(),
      `Travel clearances: load bottom at least ${fx(TRAVEL_CLEAR, 1)} m over items, ${fx(TRAVEL_SIDE, 1)} m clear beside them; hook block kept ${fx(TRAVEL_A2B, 1)} m below the boom head (anti-two-block).`,
      ...(cols.some(r => r.S.wind) ? ["Wind: the chart wind speed limit is reduced for a large load: v = v(chart) × √(1.2 × TW ÷ wind area), never above the chart value."] : []),
      ...String(plan.meta.notes || "").split(/\n+/).map(t => t.trim()).filter(Boolean)];
      let ny = F.M + 90; F.add(`<rect x="${nx}" y="${ny}" width="${nw}" height="${rh + 10}" fill="#e9edf1"/><text x="${nx + 14}" y="${ny + 38}" font-size="22" font-weight="700" fill="#16202a">NOTES</text>`); ny += rh + 30;
      const chars = Math.floor((nw - 70) / (19 * 0.5));
      notes.forEach((t0, n) => { const key = `calcnote:${n + 1}`, t = ssT(key, t0); if (!t.trim()) return; const L = wrapLines(t, chars); F.add(`<g${ssEd(key, t0)}><text x="${nx + 14}" y="${ny}" font-size="19" font-weight="700" fill="#16202a" data-noed="1">${n + 1}.</text>`); L.forEach((l, j) => F.add(`<text x="${nx + 54}" y="${ny + j * 28}" font-size="19" fill="#16202a" data-noed="1">${e(l)}</text>`)); F.add(`</g>`); ny += L.length * 28 + 16; });
      F.add(`<rect x="${nx}" y="${F.M + 90}" width="${nw}" height="${ny - F.M - 96}" fill="none" stroke="#16202a" stroke-width="2"/>`); } }
  return F.close();
}

// ---------- the set: crane data → rigging → calculation → lift plans, renumbered ----------
{ const _bs = buildSheets; buildSheets = async function (...a) {
    plan.meta = plan.meta || {}; const noChk = !!plan.meta.noChk; plan.meta.noChk = true;   // no per-lift check sheets – one calculation sheet instead
    let out; try { out = await _bs.apply(this, a); } finally { if (noChk) plan.meta.noChk = true; else delete plan.meta.noChk; }
    const keepAll = allMode; allMode = false;
    try {
      const rig = out.filter(s => /_rigging_/.test(s.name)), plans = out.filter(s => !/_rigging_/.test(s.name)), crane = [], calc = [];
      for (const G of ssCraneGroups()) { try { crane.push({ name: `crane_${G[0].c.label.replace(/[^\w\-]+/g, "_")}_data`, svg: craneSpecSheetSVG(G), regen: () => craneSpecSheetSVG(G) }); } catch (err) { console.warn("crane sheet", err); crane.push({ name: "crane_data", svg: errSheetSVG("Crane data", err) }); } }
      if (!noChk) { try { calcSheetsSVG().forEach((svg, k) => calc.push({ name: `calculation_${k + 1}_check`, svg, regen: () => calcSheetsSVG()[k] })); } catch (err) { console.warn("calc sheet", err); calc.push({ name: "calculation_check", svg: errSheetSVG("Calculation check", err) }); } }
      // a rigging calculation sheet after each rigging sheet (same grouping: one per set of gear, the hardest-worked lift)
      const rigAll = [];
      // the rigging calculation sheet goes in only when ticked in the export window (the full working always stays in the app)
      if (plan.meta?.rigCalcSheet && typeof rigCalcSheetSVG === "function") {
        const groups = new Map();
        plan.lifts.forEach((L, i) => withLift(i, () => { for (const ld of L.loads) if (rigShown(ld, L.cranes)) { ensureRig(ld); const sig = rigSignature(ld), c = rigCalc(ld), mu = c ? Math.max(0, ...c.items.map(x => x.use || 0)) : 0;
          const g = groups.get(sig); if (!g) groups.set(sig, { i, ld, mu, idx: [i] }); else { if (!g.idx.includes(i)) g.idx.push(i); if (mu > g.mu) Object.assign(g, { i, ld, mu }); } } }));
        const G = [...groups.values()];
        rig.forEach((s, k) => { rigAll.push(s); const g = G[k]; if (!g) return; try { const svg = withLift(g.i, () => rigCalcSheetSVG(g.ld, liftShort(liftRangeLabel(g.idx)))); if (svg) rigAll.push({ name: s.name.replace(/_rigging_/, "_rigcalc_"), svg, regen: () => withLift(g.i, () => rigCalcSheetSVG(g.ld, liftShort(liftRangeLabel(g.idx)))) }); } catch (err) { console.warn("rig calc sheet", err); } });
      } else rigAll.push(...rig);
      const all = [...crane, ...rigAll, ...calc, ...plans], N = all.length;
      const num = (svg, k) => svg.replace(/(>SHEET<\/text><text [^>]*>)[^<]*(<\/text>)/, `$1${k + 1} of ${N}$2`);
      return all.map((s, k) => { const base = s.name.replace(/^\d+_/, ""), raw = ssDisc(num(s.svg, k));
        return { ...s, base, name: `${String(k + 1).padStart(2, "0")}_${base}`, svg: ssAllEd(raw, base), regen: () => ssAllEd(s.regen ? ssDisc(num(s.regen(), k)) : raw, base) }; });
    } finally { allMode = keepAll; }
  }; }

// ---------- elevations: show what the load stands on (foundations / plinths, trailer, stand) – only what matters to the lift ----------
function elevSupports(cr, phase) {
  const ev = evalCrane(cr, phase); if (!ev.C || !ev.load) return [];
  const ld = ev.load, pos = ld[phase], d = loadDims(ld), h = +pos.h || 0;
  const F = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const r = rot2([a * d.x / 2, b * d.y / 2], -(pos.rot || 0)); return [pos.x + r[0], pos.y + r[1]]; });
  const out = [];
  for (const o of plan.obstacles) {
    if (o.zone || o.kind === "dim" || o.kind === "line" || (typeof isMat === "function" && isMat(o)) || (typeof isVessel === "function" && isVessel(o))) continue;
    const top = +o.hgt || 0, onT = pos.onT && pos.onT === o.id;
    if (!onT && (top < 0.05 || top > h + 0.1 || h - top > 0.6)) continue;   // it must be what the load rests on
    const P = o.kind === "circle" ? Array.from({ length: 12 }, (_, k) => [o.x + (+o.r || 1) * Math.cos(k * Math.PI / 6), o.y + (+o.r || 1) * Math.sin(k * Math.PI / 6)]) : obsPts(o);
    const touch = onT || P.some(p => inPolyPt(p, F)) || F.some(p => inPolyPt(p, P)) || inPolyPt(centroid(P), F);
    if (touch) out.push({ o, P, top: onT ? Math.max(top, h) : top });
  }
  return out;
}
{ const _es = elevScene; elevScene = function (cr, phase, ...a) {
    const e = _es.call(this, cr, phase, ...a);
    try {
      if (!e) return e;
      const ev = evalCrane(cr, phase), u = [Math.sin(ev.bearing * D2R), Math.cos(ev.bearing * D2R)], tk = Math.max(1, e.tip[1] / 20);
      const labs = new Map(), back = new Scene();
      // only the part of a support under / next to the load is drawn (a big slab or deck must not run across the labels)
      const ld = ev.load, pos = ld[phase], d0 = loadDims(ld), lc = (pos.x - cr.x) * u[0] + (pos.y - cr.y) * u[1], lr = Math.max(d0.x, d0.y) / 2 + 1.0;
      for (const { o, P, top } of elevSupports(cr, phase)) {
        const xs = P.map(p => (p[0] - cr.x) * u[0] + (p[1] - cr.y) * u[1]), x0 = Math.max(Math.min(...xs), lc - lr), x1 = Math.min(Math.max(...xs), lc + lr); if (x1 - x0 < 0.05) continue;
        const transport = typeof isTransport === "function" && isTransport(o);
        back.rect("CARRIER", x0, 0, x1, top, { fill: transport ? "#eef0f2" : "#e4e1db", w: 1.1, color: "#3b444d" });
        if (!transport) for (let x = x0 + 0.25; x < x1; x += 0.35) back.poly("CARRIER", [[x, 0.05], [Math.min(x1, x + top * 0.35), Math.min(top - 0.05, top * 0.95)]], { w: 0.4, color: "#8a8f94" });   // concrete hatch
        const nm = upUnits(o.label || (transport ? "Trailer" : "Foundation")), L = labs.get(nm) || { n: 0, x: [], top }; L.n++; L.x.push(x0, x1); labs.set(nm, L);
      }
      e.scene.items.unshift(...back.items);   // behind everything else, so no label is covered
      // one label per kind, under the radius dimension, with thin leaders up to each support
      let k = 0;
      for (const [nm, L] of labs) { const xm = (Math.min(...L.x) + Math.max(...L.x)) / 2, y = -1.6 - 2.5 * tk - k * 0.9 * tk;
        e.scene.text("DIMS", [xm, y], `${nm}${L.n > 1 ? " × " + L.n : ""} – top ${fx(L.top, 2)} m`, 0.6 * tk, { bold: true, color: "#3b444d" });
        for (let j = 0; j < L.x.length; j += 2) { const xc = (L.x[j] + L.x[j + 1]) / 2; e.scene.poly("DIMS", [[xc, y + 0.4 * tk], [xc, -0.1]], { w: 0.4, dash: [0.3, 0.2] }); }
        k++; }
    } catch (err) { console.warn("elevation supports", err); }
    return e;
  }; }
