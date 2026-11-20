// ================= Exports =================
async function blobUrlToDataUrl(url) {
  try { const b = await (await fetch(url)).blob(); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); } catch (e) { return null; }
}
let sheetCtx = null;
// the LIFT NO. box shows the plan's lift number (e.g. SSB-003) on every sheet; Lift 1 / Lift 2 are only names in the sheet titles
const liftNoBox = v => String(plan?.meta?.lift || "").trim() || liftShort(v);
const liftShort = v => { const m = String(v ?? "").match(/Lift \d+/gi); return m ? [...new Set(m)].join(", ") : String(v ?? "").split(" – ")[0]; };   // {lift, sheet, title} while exporting multi-lift sheets
function siteScenesAll(phaseMode, all) { return all ? allSiteParts(phaseMode).map(p => p.scene) : siteParts(phaseMode, false).filter(p => !p.ui).map(p => p.scene); }
function mergeScenes(list) { const s = new Scene(); list.forEach(x => s.items.push(...x.items)); return s; }
async function siteSVGStatic(phaseMode, opts = {}) {
  const sc = mergeScenes(siteScenesAll(phaseMode, opts.all));
  sc.items = sc.items.filter(it => !(it.L === "RADIUS" && it.t === "circle"));
  // the counterweight OPTIONS text from the crane library ("CW 160–180 t + ZB 60 t") is not the set-up – the crane data sheet gives the actual counterweight
  { const opts = new Set(plan.cranes.map(c => REG.cranes[c.model]?.up?.cwLabel).filter(Boolean).map(t => "CW " + t)); sc.items = sc.items.filter(it => !(it.t === "text" && opts.has(String(it.s)))); }   // the full circle round the crane (tail swing) stays in the app, not on the sheets
  // labels go on top of everything on the sheets (cranes, tracks, zones would otherwise hide them)
  { const tx = sc.items.filter(it => it.t === "text"), rest = sc.items.filter(it => it.t !== "text" && !it.lbl); sc.items = [...rest, ...tx]; }   // label boxes dropped – the white halo does that job
  // …and they are nudged apart so no two labels print on top of each other
  { const placed = [], box = it => { const tw = String(it.s).length * it.size * 0.6, a = (it.rot || 0) * Math.PI / 180, ox = it.anchor === "start" ? 0 : it.anchor === "end" ? -tw : -tw / 2;
      const pts = [[ox - 0.1, -it.size * 0.68], [ox + tw + 0.1, -it.size * 0.68], [ox + tw + 0.1, it.size * 0.68], [ox - 0.1, it.size * 0.68]].map(([u, v]) => [it.p[0] + u * Math.cos(a) - v * Math.sin(a), it.p[1] + u * Math.sin(a) + v * Math.cos(a)]);
      return [Math.min(...pts.map(q => q[0])), Math.min(...pts.map(q => q[1])), Math.max(...pts.map(q => q[0])), Math.max(...pts.map(q => q[1]))]; };
    const hit = (b1, b2) => b1[0] < b2[2] && b1[2] > b2[0] && b1[1] < b2[3] && b1[3] > b2[1];
    for (const it of sc.items) { if (it.t !== "text" || !String(it.s).trim()) continue;
      const p0 = [...it.p], a = (it.rot || 0) * Math.PI / 180, nrm = [-Math.sin(a), Math.cos(a)], tan = [Math.cos(a), Math.sin(a)], step = it.size * 1.2, tw = String(it.s).length * it.size * 0.6;
      const cand = [[0, 0]]; for (let k = 1; k <= 8; k++) for (const sg of [1, -1]) cand.push([0, sg * k * step]);
      for (const sh of [0.35, -0.35, 0.7, -0.7]) for (let k = 0; k <= 4; k++) for (const sg of [1, -1]) cand.push([sh * tw, sg * k * step]);
      let ok = false;
      for (const [u, v] of cand) { it.p = [p0[0] + tan[0] * u + nrm[0] * v, p0[1] + tan[1] * u + nrm[1] * v]; const bb = box(it); if (!placed.some(q => hit(q, bb))) { placed.push(bb); ok = true; break; } }
      if (!ok) { it.p = p0; placed.push(box(it)); } } }
  { const c = plan.site.cad, D = c && c.show !== false && typeof CADS !== "undefined" && CADS[c.id]; if (D && D.bbox) { sc.text("TEXT", [D.bbox[0], D.bbox[1]], " ", 0.1); sc.text("TEXT", [D.bbox[2], D.bbox[3]], " ", 0.1); } }
  let b = sc.bounds();
  // one lift's sheet: frame the working area (cranes, their tail swing, loads, travel path) instead of the whole site
  if (opts.focus && !opts.all) { const fb = liftFocusBounds(phaseMode); if (fb) b = fb; }
  if (opts.bounds) b = opts.bounds;
  // overview: the zoomed lift area is marked with a box
  if (opts.frame) { const f = opts.frame, t = Math.max(0.8, (b[2] - b[0]) / 110); sc.rect("DIMS", f[0], f[1], f[2], f[3], { w: 2.2, dash: [t * 1.6, t], color: "#d9661f" }); }
  const bg = plan.site.bg;
  let pre = "";
  if (bg) {
    const data = opts.bgData !== undefined ? opts.bgData : await blobUrlToDataUrl(bg.url || ("/_blob/" + bg.asset));
    if (data) pre = bgMarkup(data);
  }
  if (typeof vesselImgsData === "function") pre += await vesselImgsData();
  if (typeof cadMarkup === "function") pre = cadMarkup(true) + pre;
  // scale bar
  const na = new Scene();
  { const bw = b[2] - b[0], u = bw > 150 ? 10 : bw > 70 ? 5 : 2.5, k = u / 2.5, th = 0.4 * k;
    na.rect("TEXT", b[0] - 0.6 * k, b[1] - 3.9 * k, b[0] + 4 * u + 2.2 * k, b[1] - 1.2 * k, { fill: "#ffffff", color: "#ffffff", w: 0.1 });   // white card behind the scale bar so site items never show through it
    for (let i = 0; i < 4; i++) na.rect("TEXT", b[0] + i * u, b[1] - 2.2 * k, b[0] + (i + 1) * u, b[1] - 2.2 * k + th, { fill: i % 2 ? "#ffffff" : "#111827", w: 0.5 });
    for (const [dx, t] of [[0, "0"], [2 * u, fx(2 * u, 0)], [4 * u, fx(4 * u, 0) + " m"]]) na.text("TEXT", [b[0] + dx, b[1] - 3.1 * k], t, 0.8 * k); }
  sc.items.push(...na.items);
  TEXT_HALO = true; try { return toSVG(sc, { lw: 0.05, pad: 2, pxPerM: opts.pxPerM || 24, bg: opts.bg, pre, bounds: opts.bounds ? [b[0], b[1] - 4 * Math.max(1, (b[2] - b[0]) / 150), b[2], b[3]] : opts.focus && !opts.all ? [b[0] - 2.5, b[1] - 3.5, b[2] + 0.5, b[3] + 5.5] : undefined }); } finally { TEXT_HALO = false; }
}
function liftFocusBounds(phaseMode) {
  const parts = siteParts(phaseMode, false).filter(p => !p.ui && /^(crane|boom|load|travel|tip|slew|swing|hook)/.test(p.key));
  if (!parts.length) return null;
  let b = null;
  for (const p of parts) { const q = p.scene.bounds(); if (!isFinite(q[0])) continue; b = b ? [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])] : [...q]; }
  if (!b) return null;
  // include the tail swing of every crane, then a margin so nearby site items (fences, zones, towers) still show
  for (const cr of plan.cranes) { const C = REG.cranes[cr.model]; const t = C?.up?.tail ? C.up.tail + 1 : 6; b = [Math.min(b[0], cr.x - t), Math.min(b[1], cr.y - t), Math.max(b[2], cr.x + t), Math.max(b[3], cr.y + t)]; }
  const m = Math.max(6, 0.12 * Math.max(b[2] - b[0], b[3] - b[1])); return [b[0] - m, b[1] - m, b[2] + m, b[3] + m];   // room round the lift for the structures next to it
}
function nestSVG(svg, x, y, w, h) { return svg.replace(/^<svg /, `<svg x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" `).replace(/ width="[\d.]+" height="[\d.]+" font-family/, " font-family"); }
function svgToPng(svg, scale = 1, bg = null) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    img.onload = () => { const c = document.createElement("canvas"); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale); const g = c.getContext("2d"); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); } g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => b ? res({ blob: b, canvas: c }) : rej("png"), "image/png"); };
    img.onerror = () => rej("render"); img.src = url;
  });
}
// font size so a line fits a width (Arial ≈ 0.56 em per character)
const fitFs = (t, w, fs, min = 14) => Math.max(min, Math.min(fs, w / Math.max(1, String(t).length * 0.56)));
function wrapLines(t, n) { const out = []; let cur = ""; for (const w of String(t).split(/\s+/)) { if ((cur + " " + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); } if (cur) out.push(cur); return out; }
async function sheetSVG() {
  const W = 3508, H = 2480, M = 36, e = s => escH(s);
  const planSvg = await siteSVGStatic("both", { pxPerM: 20, focus: true });
  // a lift on / beside a vessel: the whole vessel on top, the lift area zoomed in below
  let overSvg = null;
  { const fb = liftFocusBounds("both"), vs = (plan.obstacles || []).filter(o => typeof isVessel === "function" && isVessel(o));
    const near = fb ? vs.filter(o => { const P = vHull(o).map(q => vW(o, q)); const vb = [Math.min(...P.map(q => q[0])), Math.min(...P.map(q => q[1])), Math.max(...P.map(q => q[0])), Math.max(...P.map(q => q[1]))]; o._vb = vb; return vb[0] < fb[2] + 20 && vb[2] > fb[0] - 20 && vb[1] < fb[3] + 20 && vb[3] > fb[1] - 20; }) : [];
    if (near.length) { let ob = [...fb]; for (const o of near) ob = [Math.min(ob[0], o._vb[0]), Math.min(ob[1], o._vb[1]), Math.max(ob[2], o._vb[2]), Math.max(ob[3], o._vb[3])];
      const m = Math.max(4, (ob[2] - ob[0]) * 0.03); ob = [ob[0] - m, ob[1] - m, ob[2] + m, ob[3] + m];
      if ((ob[2] - ob[0]) > (fb[2] - fb[0]) * 1.4 || (ob[3] - ob[1]) > (fb[3] - fb[1]) * 1.4) overSvg = await siteSVGStatic("both", { pxPerM: 6, bounds: ob, frame: fb }); } }
  const elevs = [];
  for (const cr of plan.cranes) for (const ph of ["pick", "set"]) { const ev = elevScene(cr, ph); if (ev) ev.scene.items = ev.scene.items.filter(it => !(it.t === "text" && /^\d+(\.\d+)?$/.test(String(it.s).trim())));   // no bare section-length numbers along the boom
    if (ev) elevs.push({ cr, ph, svg: toSVG(ev.scene, { lw: 0.06, pxPerM: 20 }) }); }
  const bandY = H - 560, split = 1900;
  let g = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">
<rect width="${W}" height="${H}" fill="#fff"/><rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="none" stroke="#16202a" stroke-width="4"/>
<line x1="${split}" y1="${M}" x2="${split}" y2="${bandY}" stroke="#16202a" stroke-width="2"/><line x1="${M}" y1="${bandY}" x2="${W - M}" y2="${bandY}" stroke="#16202a" stroke-width="4"/>
${(() => { const t = (plan.lifts.length > 1 ? plan.lifts[plan.al].name.toUpperCase() + " · " : "") + "SITE PLAN – PICK (solid) / SET (dashed hook lines & load)"; return `<text x="${M + 24}" y="${M + 50}" font-size="${fitFs(t, split - M - 60, 36).toFixed(1)}" font-weight="700" fill="#16202a">${e(t)}</text>`; })()}
<text x="${split + 24}" y="${M + 50}" font-size="36" font-weight="700" fill="#16202a">ELEVATIONS</text>
${overSvg ? (() => { const top = M + 70, avail = bandY - M - 90, oh = Math.round(avail * 0.34), zy = top + oh + 24;
  return `${nestSVG(overSvg, M + 20, top, split - M - 40, oh)}<rect x="${M + 26}" y="${top + 4}" width="560" height="40" fill="#ffffff"/><text x="${M + 34}" y="${top + 32}" font-size="24" font-weight="700" fill="#16202a">KEY PLAN – lift area in the orange box</text><line x1="${M}" y1="${top + oh + 8}" x2="${split}" y2="${top + oh + 8}" stroke="#16202a" stroke-width="2"/>${nestSVG(planSvg, M + 20, zy, split - M - 40, bandY - zy - 20)}`; })() : nestSVG(planSvg, M + 20, M + 70, split - M - 40, bandY - M - 90)}`;
  // rigging breakdown for every load on this lift
  // the rigging has its own sheet – the plan sheet keeps to the lift itself, so the elevations get the full height
  const rigs = [];
  const RG = plan.lifts.length > 1 ? rigGroups() : null;
  rigs.forEach(r => { const idx = RG ? RG.get(rigSignature(r.ld)) || [] : []; r.idx = idx; r.same = idx.length && idx[0] < plan.al; });
  const rigH = Math.min(1100, rigs.reduce((a, r) => a + (r.same ? 90 : 110 + r.res.rows.length * 36), rigs.length ? 60 : 0));
  const ecols = elevs.length > 2 ? 2 : 1, erows = Math.ceil(elevs.length / ecols) || 1;
  const ew = (W - M - split - 40) / ecols, eh = (bandY - M - 90 - rigH) / erows;
  if (rigs.length) {
    let ry = bandY - rigH + 10; const rx = split + 20, rc = [60, 70, 1100, 200], rhd = ["No", "Qty", "Component", "SWL (t)"];
    g += `<line x1="${split}" y1="${bandY - rigH - 10}" x2="${W - M}" y2="${bandY - rigH - 10}" stroke="#16202a" stroke-width="2"/><text x="${rx + 4}" y="${ry + 30}" font-size="30" font-weight="700" fill="#16202a">RIGGING BREAKDOWN</text>`;
    ry += 50;
    for (const { ld, res, same, idx } of rigs) {
      if (ry > bandY - (same ? 60 : 80)) break;
      const pr = RIG_PRESETS.find(p => p.id === ld.rig.preset)?.name || rigName(ld.rig);
      if (same) { g += `<text x="${rx + 4}" y="${ry + 26}" font-size="23" font-weight="700" fill="#16202a">${e(ld.name)} – ${e(pr)} · rigging ${fx(res.weight, 3)} t</text>${(() => { const t = `Same rigging arrangement as ${plan.lifts[idx[0]].name} – one list for ${liftRangeLabel(idx)}, shown on ${plan.lifts[idx[0]].name}'s sheet and the rigging sheet.`; return `<text x="${rx + 4}" y="${ry + 58}" font-size="${fitFs(t, W - M - rx - 30, 21, 12).toFixed(1)}" fill="#3d4a57">${e(t)}</text>`; })()}`; ry += 70; continue; }
      if (idx && idx.length > 1) g += `<text x="${W - M - 20}" y="${ry + 26 + (ld.rig.auto ? 26 : 0)}" font-size="20" fill="#3d4a57" text-anchor="end">Applies to ${e(liftRangeLabel(idx))}</text>`;
      g += `<text x="${rx + 4}" y="${ry + 26}" font-size="23" font-weight="700" fill="#16202a">${e(ld.name)} – ${e(pr)} · rigging ${fx(res.weight, 3)} t</text>`;
      if (ld.rig.auto) g += `<text x="${W - M - 20}" y="${ry + 26}" font-size="21" font-weight="700" fill="#b42318" text-anchor="end">SUGGESTED – NOT CONFIRMED</text>`;
      ry += 40; let x = rx;
      rhd.forEach((h, i) => { g += `<text x="${x + 6}" y="${ry + 22}" font-size="19" font-weight="700" fill="#566476">${h}</text>`; x += rc[i]; }); ry += 32;
      for (const r of res.rows) {
        if (ry > bandY - 40) break;
        const uc = r.util == null ? "#566476" : r.util > 100 ? "#b42318" : r.util > 80 ? "#9a6200" : "#1d7a4f";
        g += `<rect x="${rx}" y="${ry}" width="${rc.reduce((a, b) => a + b, 0)}" height="36" fill="${r.no % 2 ? "#f4f6f8" : "#fff"}"/>`;
        const vals = [r.no, r.qty, r.name, fx(r.swl, 2)]; x = rx;
        vals.forEach((v, i) => { g += `<text x="${x + 6}" y="${ry + 26}" font-size="21" fill="${i === 5 ? uc : "#16202a"}"${i === 5 ? ' font-weight="700"' : ""}>${e(String(v)).slice(0, 70)}</text>`; x += rc[i]; });
        ry += 36;
      }
      ry += 20;
    }
  }
  elevs.forEach((el, i) => {
    const cx = split + 20 + (i % ecols) * ew, cy = M + 70 + Math.floor(i / ecols) * eh;
    g += nestSVG(el.svg, cx, cy, ew - 10, eh - 10);
  });
  // checks table
  const tx = M + 20, ty = bandY + 30, cw = [300, 120, 130, 130, 130, 250, 120, 150, 140, 170];
  const heads = ["Crane", "Boom (m)", "Pick R (m)", "Set R (m)", "Max R (m)", "Cap @ max R", "TW (t)", "Utilisation", "GAW (t)", "GBP (t/m²)"];
  let x = tx;
  heads.forEach((h, i) => { g += `<text x="${x + 6}" y="${ty + 26}" font-size="21" font-weight="700" fill="#566476">${h}</text>`; x += cw[i]; });
  let ry = ty + 40;
  const lim = +plan.site.ulim || 100, colOf = st => st === "bad" ? "#b42318" : st === "amber" ? "#9a6200" : st === "ok" ? "#1d7a4f" : "#566476";
  for (const cr of plan.cranes) {
    const S = craneSummary(cr);
    const uSt = S.util == null ? "na" : S.util > 100 ? "bad" : S.util > lim ? "amber" : "ok";
    const gSt = S.gbpOk === false ? "bad" : S.gbpOk ? "ok" : "na";
    const vals = [`${cr.label} ${S.C ? S.C.short : ""}`, fx(cr.L), fx(S.ph.pick.R) + (S.ph.pick.free ? "*" : ""), fx(S.ph.set.R) + (S.ph.set.free ? "*" : ""), fx(S.maxR, 2), S.cap != null ? fx(S.cap) + " t" + (S.capManual ? " (manual)" : S.rUsed != null && S.rUsed > S.maxR + 0.05 ? ` (${fx(S.rUsed)} m row)` : "") : "–", fx(S.TW, 2), S.util != null ? fx(S.util, 1) + " %" : "–", fx(S.GAW, 1), S.gbp != null ? fx(S.gbp, 1) : "–"];
    x = tx; g += `<rect x="${tx}" y="${ry}" width="${cw.reduce((a, b) => a + b, 0)}" height="44" fill="${(ry / 44) % 2 < 1 ? "#f4f6f8" : "#fff"}"/>`;
    vals.forEach((v, i) => { const c = i === 7 ? colOf(uSt) : i === 9 ? colOf(gSt) : "#16202a"; g += `<text x="${x + 6}" y="${ry + 30}" font-size="22" fill="${c}"${i === 7 || i === 9 ? ' font-weight="700"' : ""}>${e(v)}</text>`; x += cw[i]; });
    ry += 44; if (ry > H - M - 140) break;
  }
  const notes = [`Allowed GBP ${typeof gbcTxt === "function" ? gbcTxt() : (+plan.site.gbc > 0 ? plan.site.gbc + " t/m²" : "to be confirmed")}${plan.cranes.filter(c => +c.gbc > 0).map(c => ` (${c.label}: ${c.gbc} t/m²)`).join("")}${plan.cranes.filter(c => +c.windMax > 0).map(c => { const w = windCheck(c, craneSummary(c)); return w ? ` · ${c.label} wind limit ${fx(w.lim, 1)} m/s` : ""; }).join("")} · loads: ${plan.loads.map(l => (l.wInclRig ? `${l.name} ${fx(l.weight)} t incl. rigging` : (+l.rigWeight > 0 ? `${l.name} ${fx(l.weight)} t + rigging ${fx(l.rigWeight)} t` : `${l.name} ${fx(l.weight)} t`))).join("; ")}`,
    (m => m ? "Mats: " + m : "")(plan.cranes.filter(c => REG.cranes[c.model]?.type !== "ped").map(c => `${c.label} – ${matInfo(c).text}`).join("; ")),
    `Utilisation = TW ÷ rated capacity at max radius × 100 (chart, next larger radius row). ${(() => { const cs = plan.cranes.filter(c => REG.cranes[c.model] && REG.cranes[c.model].type !== "ped"), R = cs.filter(c => +c.oReact > 0), trk = cs.every(c => REG.cranes[c.model].type === "cr") ? "track" : cs.every(c => REG.cranes[c.model].type !== "cr") ? "outrigger" : "outrigger / track";
      const AREA = { matrow: "the mats under one track (along the track contact)", track: "one track's ground contact area", mat: "one outrigger mat", pad: "one outrigger pad" }, ar = [...new Set(cs.map(c => AREA[matInfo(c).basis] || "the bearing area"))], area = ar.join(" / ");
      return !cs.length ? "" : R.length === cs.length ? `GBP = manufacturer's maximum ${trk} reaction${R.map(c => ` (${c.label} ${fx(+c.oReact, 1)} t${c.oSrc ? ", " + c.oSrc : ""})`).join("")} ÷ ${area}.` : !R.length ? `GBP = (crane + CW${cs.some(c => { try { return +craneSummary(c).slWt > 0; } catch (e) { return false; } }) ? " + superlift ballast" : ""} + gross lift weight) × 0.75 ÷ ${area}.` : `GBP = bearing load ÷ ${area} – manufacturer's maximum reaction for ${R.map(c => c.label).join(", ")}, 0.75 × GAW for the others.`; })()}${plan.cranes.some(c => { try { const S = craneSummary(c); return S && S.ph && (S.ph.pick.free || S.ph.set.free); } catch (e) { return false; } }) ? " * hook moved off the load." : ""}`,
    plan.meta.notes || ""];
  { const nl = notes.filter(Boolean).flatMap(n => wrapLines(n, 225)).slice(0, 8), y0 = H - M - 56 - (nl.length - 1) * 24;
    nl.forEach((n, i) => g += `<text x="${tx}" y="${y0 + i * 24}" font-size="18" fill="#566476">${e(n)}</text>`); }
  // title block
  g += tbBlock({ W, H, M, lift: liftNoBox(sheetCtx?.lift ?? liftNo(plan.al)), sheet: sheetCtx?.sheet ?? "1", team: true });
  return g + "</svg>";
}
// sheet 0 for multi-lift plans: every lift on one plan + the lift sequence
async function overviewSheetSVG() {
  const W = 3508, H = 2480, M = 36, e = s => escH(s), split = 2000, bandY = H - 420;
  const planSvg = await siteSVGStatic("both", { pxPerM: 20, all: true });
  const lim = +plan.site.ulim || 100, colOf = st => st === "bad" ? "#b42318" : st === "amber" ? "#9a6200" : st === "ok" ? "#1d7a4f" : "#566476";
  let g = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">
<rect width="${W}" height="${H}" fill="#fff"/><rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="none" stroke="#16202a" stroke-width="4"/>
<line x1="${split}" y1="${M}" x2="${split}" y2="${bandY}" stroke="#16202a" stroke-width="2"/><line x1="${M}" y1="${bandY}" x2="${W - M}" y2="${bandY}" stroke="#16202a" stroke-width="4"/>
<text x="${M + 24}" y="${M + 50}" font-size="36" font-weight="700" fill="#16202a">ALL LIFTS – SITE OVERVIEW (${plan.lifts.length} lifts, pick solid / set dashed)</text>
<text x="${split + 24}" y="${M + 50}" font-size="36" font-weight="700" fill="#16202a">LIFT SEQUENCE</text>
${nestSVG(planSvg, M + 20, M + 70, split - M - 40, bandY - M - 90)}`;
  const tx = split + 20, cw = [60, 190, 290, 120, 330, 140, 130, 150], heads = ["No.", "Lift", "Load", "TW (t)", "Crane", "Max R (m)", "Util.", "GBP (t/m²)"];
  let x = tx, ty = M + 90;
  heads.forEach((h, i) => { g += `<text x="${x + 6}" y="${ty + 26}" font-size="21" font-weight="700" fill="#566476">${h}</text>`; x += cw[i]; });
  let ry = ty + 40;
  plan.lifts.forEach((L, i) => {
    const I = liftInfo(i), base = Math.max(1, I.cr.length, I.L.loads.length), lines = base, rh = 16 + lines * 34;
    g += `<rect x="${tx}" y="${ry}" width="${cw.reduce((a, b) => a + b, 0)}" height="${rh}" fill="${i % 2 ? "#fff" : "#f4f6f8"}"/>`;
    const cols = [[String(i + 1)], [L.name], L.loads.map(l => l.name), L.loads.map(l => fx((+l.weight || 0) + rigW(l), 2)),
      I.cr.map(c => `${c.c.label} ${c.S.C ? c.S.C.short : ""}`), I.cr.map(c => fx(c.S.maxR)), I.cr.map(c => c.S.util != null ? fx(c.S.util, 1) + " %" : "–"), I.cr.map(c => c.S.gbp != null ? fx(c.S.gbp, 1) : "–"),
    ];
    x = tx;
    cols.forEach((c, k) => { (c.length ? c : ["–"]).forEach((v, j) => { g += `<text x="${x + 6}" y="${ry + 36 + j * 34}" font-size="${k >= 4 ? 20 : 22}" fill="#16202a"${k === 1 ? ' font-weight="700"' : ""}>${e(String(v)).slice(0, k === 4 ? 26 : 22)}</text>`; }); x += cw[k]; });
    ry += rh; if (ry > bandY - 80) return;
  });
  g += `<text x="${tx}" y="${ry + 44}" font-size="20" fill="#566476">Each lift has its own site plan, elevations and rigging sheets following this one.</text>`;
  g += `<text x="${tx}" y="${ry + 74}" font-size="20" fill="#566476">Allowed GBP ${plan.site.gbc || "–"} t/m² </text>`;
  { const seen = new Map(); plan.lifts.forEach(L => (L.cranes || []).forEach(c => { if (REG.cranes[c.model]?.type === "ped" || seen.has(c.label)) return; seen.set(c.label, matInfo(c).text); }));
    const ml = [...seen].map(([k, v]) => `${k} – ${v}`).join("; "); if (ml) g += `<text x="${tx}" y="${ry + 104}" font-size="20" fill="#566476">${e("Mats: " + ml).slice(0, 150)}</text>`; }
  if (plan.meta.notes) g += `<text x="${M + 20}" y="${bandY + 60}" font-size="20" fill="#566476">${e(plan.meta.notes).slice(0, 190)}</text>`;
  g += tbBlock({ W, H, M, lift: String(plan.meta.lift || "").trim() || "ALL (" + plan.lifts.length + ")", sheet: sheetCtx?.sheet ?? "1", team: true });
  return g + "</svg>";
}
async function save(filename, data) {
  if (!CAP.downloads) { $("xMsg").textContent = "Saving files isn't available in this view."; return; }
  try { await CAP.downloads.save({ filename, data, mimeType: ({ pdf: "application/pdf", png: "image/png", zip: "application/zip", json: "application/json" })[filename.split(".").pop()] }); $("xMsg").textContent = "Saved " + filename; }
  catch (e) { $("xMsg").textContent = e && e.code === "declined" ? "Save cancelled." : "Couldn't save (" + (e && (e.code || e.message) || e) + ")"; }
}
const fbase = () => (plan.name || "liftplan").replace(/[^\w\-]+/g, "_").slice(0, 60);
$("bExport").onclick = () => { $("xMsg").textContent = ""; $("dExport").showModal(); };
// every sheet of the plan: [all-lifts overview], then per lift its plan sheet + one rigging sheet per load
// lifts that share one rigging arrangement: signature → lift indices in order; and a short label like "Lift 1 – Lift 4"
// a load's rigging is printed when a crane is hooked to it; loads nobody lifts (e.g. a stray copy stacked on the real one) are left out
function rigShown(ld, cranes) { const hooked = cranes.some(c => c.attach?.load); return hooked ? cranes.some(c => c.attach?.load === ld.id) : !!ld.rig?.arr; }
function rigGroups() {
  syncLift(); const G = new Map();
  plan.lifts.forEach((L, i) => withLift(i, () => { for (const ld of L.loads) if (rigShown(ld, L.cranes)) { ensureRig(ld); const k = rigSignature(ld); if (!G.has(k)) G.set(k, []); if (!G.get(k).includes(i)) G.get(k).push(i); } }));
  return G;
}
function liftRangeLabel(idx) {
  const n = i => liftNo(i);   // same lift number on every sheet (the one entered for a single-lift plan)
  if (idx.length === 1) return n(idx[0]);
  const runs = []; let a = idx[0], b = idx[0];
  for (const i of idx.slice(1)) { if (i === b + 1) b = i; else { runs.push([a, b]); a = b = i; } }
  runs.push([a, b]);
  return runs.map(([x, y]) => x === y ? n(x) : y === x + 1 ? `${n(x)}, ${n(y)}` : `${n(x)} – ${n(y)}`).join(", ");
}
function rigSignature(ld) {
  // lifts share one rigging sheet when they use the same gear: same arrangement, same items, sizes and quantities.
  // The sheet shows the lift where the gear works hardest; the calculation sheet has every lift's figures.
  const res = solveRig(ld); if (!res) return "none:" + ld.id;
  const r2 = v => Math.round((+v || 0) * 10) / 10;
  return JSON.stringify([ld.rig?.arr || "", ld.rig?.tmode || "", res.rows.map(r => [r.name, r.qty, r2(r.swl)]), ld.kind]);
}
// a sheet that fails to draw is replaced by a page saying so – the export never stops half way
function errSheetSVG(what, err) { return `<svg xmlns="http://www.w3.org/2000/svg" width="3508" height="2480" viewBox="0 0 3508 2480" font-family="Arial, Helvetica, sans-serif"><rect width="3508" height="2480" fill="#fff"/><text x="120" y="200" font-size="60" font-weight="700" fill="#b42318">${escH(what)} – this sheet could not be drawn</text><text x="120" y="300" font-size="36" fill="#16202a">${escH(String(err && err.message || err)).slice(0, 200)}</text></svg>`; }
async function buildSheets(onProgress) {
  syncLift();
  const pages = [], multi = plan.lifts.length > 1, keepAll = allMode, out = [];
  allMode = false;
  try {
    // (no all-lifts overview page – each lift has its own sheet)
    // a rigging sheet is only repeated when the arrangement (or the load it lifts) is different from one already shown
    const seenRig = new Map();
    // line-up: overview, then the rigging list (each arrangement once), then the lifts in order
    const rigPages = [], planPages = [];
    plan.lifts.forEach((L, i) => { planPages.push({ kind: "plan", i }); withLift(i, () => { for (const ld of L.loads) if (rigShown(ld, L.cranes)) { ensureRig(ld); const sig = rigSignature(ld), prev = seenRig.get(sig); const mu = (() => { const r = solveRig(ld); return r ? Math.max(0, ...r.rows.map(x => +x.util || 0)) : 0; })(); if (prev) { prev.lifts.push(L.name); if (!prev.idx.includes(i)) prev.idx.push(i); if (mu > prev.mu) { prev.ld = ld; prev.i = i; prev.mu = mu; } continue; } const P = { kind: "rig", i, ld, mu, lifts: [L.name], idx: [i] }; seenRig.set(sig, P); rigPages.push(P); } }); });
    pages.push(...rigPages, ...planPages);
    for (let k = 0; k < pages.length; k++) {
      const P = pages[k]; sheetCtx = { sheet: `${k + 1} of ${pages.length}`, lift: P.kind === "all" ? "ALL" : P.kind === "rig" && P.idx && P.idx.length > 1 ? liftRangeLabel(P.idx) : liftNo(P.i) };
      onProgress && onProgress(k, pages.length);
      let svg = null, name = "";
      if (P.kind === "all") { name = "00_all_lifts"; try { svg = await overviewSheetSVG(); } catch (err) { console.error("overview sheet", err); svg = errSheetSVG("All lifts", err); } }
      else {
        const pc = plan.cranes, pl = plan.loads, pa = plan.al; syncLift();
        plan.al = P.i; plan.cranes = plan.lifts[P.i].cranes; plan.loads = plan.lifts[P.i].loads;
        const ln = plan.lifts[P.i].name.replace(/[^\w\-]+/g, "_"), no = String(k + 1).padStart(2, "0");
        try {
          if (P.kind === "plan") { name = `${no}_${ln}_plan`; try { svg = await sheetSVG(); } catch (err) { console.error("plan sheet", err); svg = errSheetSVG(plan.lifts[P.i].name, err); } }
          else {
            const ld = P.ld; ld._photoData = ld.photoUrl ? (ld.photoUrl.startsWith("data:") ? ld.photoUrl : await blobUrlToDataUrl(ld.photoUrl).catch(() => null)) : null;
            try { svg = rigSheetSVG(ld); } catch (err) { console.warn("rig sheet", err); svg = null; }
            delete ld._photoData; name = `${no}_${ln}_rigging_${ld.name.replace(/[^\w\-]+/g, "_")}`;
          }
        } finally { plan.al = pa; plan.cranes = pc; plan.loads = pl; }
      }
      if (svg) out.push({ name, svg });
    }
  } finally { sheetCtx = null; allMode = keepAll; }
  return out;
}
async function sheetCanvas(svg) {
  try { return (await svgToPng(svg, 1, "#fff")).canvas; }
  catch (e) { return (await svgToPng(svg.replace(/<image [^>]*>/g, ""), 1, "#fff")).canvas; }   // a photo that won't render never drops the sheet
}
const canvasBlob = c => new Promise(r => c.toBlob(r, "image/png"));
async function savePngs(sheets, single, zipName) {
  if (sheets.length === 1 || !window.JSZip) { save(single, await canvasBlob(await sheetCanvas(sheets[0].svg))); return; }
  const z = new JSZip();
  for (const sh of sheets) z.file(`${fbase()}_${sh.name}.png`, await canvasBlob(await sheetCanvas(sh.svg)));
  save(zipName, await z.generateAsync({ type: "blob" }));
}
const progress = (k, n) => $("xMsg").textContent = `Rendering sheet ${k + 1} of ${n}…`;
$("xPdf").onclick = async () => {
  if (!window.jspdf) { $("xMsg").textContent = "PDF library didn't load – use PNG."; return; }
  $("xMsg").textContent = "Rendering…";
  const sheets = await buildSheets(progress);
  if (!sheets.length) return;
  const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  for (let k = 0; k < sheets.length; k++) {
    const c = await sheetCanvas(sheets[k].svg);
    if (k) pdf.addPage("a3", "landscape");
    pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 420, 297);
  }
  save(fbase() + ".pdf", pdf.output("blob"));
};
$("xPng").onclick = async () => { $("xMsg").textContent = "Rendering…"; const sh = await buildSheets(progress); if (sh.length) await savePngs(sh, fbase() + "_sheet.png", fbase() + "_sheets.zip"); };
$("xRigPng").onclick = async () => {
  $("xMsg").textContent = "Rendering…";
  const sheets = (await buildSheets(progress)).filter(s => s.name.includes("_rigging_"));
  if (!sheets.length) { $("xMsg").textContent = "No rigging yet – hook a crane onto a load, or open Rigging… on the load."; return; }
  await savePngs(sheets, fbase() + "_rigging.png", fbase() + "_rigging.zip");
};
// figures for documents: every lift's site plan (framed on the lift), each crane's pick / set elevation and the rigging sheet, high resolution
$("xFig").onclick = async () => {
  if (typeof JSZip === "undefined") { $("xMsg").textContent = "Zip library not loaded"; return; }
  syncLift(); const keepAll = allMode; allMode = false; const z = new JSZip(); let n = 0; const figRig = new Set();
  const cap = (svg, title) => { const m = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/); if (!m) return svg; const [x, y, w, h] = m.slice(1).map(Number), fs = Math.max(0.9, w / 55);
    return svg.replace(/viewBox="[^"]+"/, `viewBox="${x} ${y - fs * 2.2} ${w} ${h + fs * 2.2}"`).replace(/(width|height)="(\d+)"/g, (s0, k, v) => k === "height" ? `height="${Math.round(+v * (h + fs * 2.2) / h)}"` : s0)
      .replace(/(<svg[^>]*>)/, `$1<rect x="${x}" y="${y - fs * 2.2}" width="${w}" height="${h + fs * 2.2}" fill="#fff"/><text x="${x + fs * 0.6}" y="${y - fs * 0.7}" font-size="${fs}" font-weight="700" fill="#16202a">${escH(title)}</text>`); };
  const add = async (name, svg) => { try { const { blob } = await svgToPng(svg, 1, "#ffffff"); z.file(name + ".png", blob); n++; } catch (e) { console.warn(e); } };
  try {
    for (let i = 0; i < plan.lifts.length; i++) {
      const L = plan.lifts[i], pc = plan.cranes, pl = plan.loads, pa = plan.al;
      plan.al = i; plan.cranes = L.cranes; plan.loads = L.loads;
      const ln = String(i + 1).padStart(2, "0") + "_" + L.name.replace(/[^\w\-]+/g, "_"), who = plan.lifts.length > 1 ? L.name + " – " : "";
      $("xMsg").textContent = `Rendering ${L.name}…`;
      try {
        if (L.cranes.length || L.loads.length) await add(`${ln}_site_plan`, cap(await siteSVGStatic("both", { pxPerM: 45, focus: true }), `${who}SITE PLAN – pick (solid) / set (dashed)`));
        for (const cr of L.cranes) for (const ph of ["pick", "set"]) { const ev = elevScene(cr, ph); if (ev) await add(`${ln}_elevation_${cr.label.replace(/[^\w\-]+/g, "_")}_${ph}`, cap(toSVG(ev.scene, { lw: 0.06, pxPerM: 45 }), `${who}${cr.label} – ${ph.toUpperCase()} elevation`)); }
        for (const ld of L.loads) if (rigShown(ld, L.cranes)) { ensureRig(ld); const sig = rigSignature(ld); if (figRig.has(sig)) continue; figRig.add(sig); const sv = rigSheetSVG(ld); if (sv) await add(`${ln}_rigging_${ld.name.replace(/[^\w\-]+/g, "_")}`, sv); }
      } finally { plan.al = pa; plan.cranes = pc; plan.loads = pl; }
    }
    if (plan.lifts.length > 1) { allMode = true; await add("00_all_lifts_site_plan", cap(await siteSVGStatic("both", { pxPerM: 30, all: true }), "ALL LIFTS – SITE OVERVIEW")); }
  } finally { allMode = keepAll; }
  if (!n) { $("xMsg").textContent = "Nothing to export yet – add a crane and a load."; return; }
  save(fbase() + "_figures.zip", await z.generateAsync({ type: "blob" })); $("xMsg").textContent = `${n} figure${n > 1 ? "s" : ""} saved – each one ready to paste into a document.`;
};
$("xPlanPng").onclick = async () => { const { blob } = await svgToPng(await siteSVGStatic(plan.phase === "both" ? "both" : plan.phase, { pxPerM: 30, all: allMode }), 1); save(fbase() + "_site.png", blob); };
$("xViews").onclick = async () => {
  if (typeof JSZip === "undefined") { $("xMsg").textContent = "Zip library not loaded"; return; }
  const zip = new JSZip(), keep = { ...V3 };
  for (const [mode, dir, name] of [["side", "N", "looking_north"], ["side", "E", "looking_east"], ["side", "S", "looking_south"], ["side", "W", "looking_west"], ["3d", null, "3D"]]) {
    V3.mode = mode; if (dir) V3.dir = dir; V3.zoom = 1; V3.pan = [0, 0];
    const svg = renderMeshSVG(allMode ? withAll(() => buildMesh(plan.phase)) : buildMesh(plan.phase), 2400, 1500, { noTrack: true });
    const { blob } = await svgToPng(svg, 1, "#ffffff"); zip.file(`${fbase()}_${name}.png`, blob);
  }
  Object.assign(V3, keep);
  save(fbase() + "_views.zip", await zip.generateAsync({ type: "blob" }));
};
$("xElevPng").onclick = async () => {
  if (!window.JSZip) { $("xMsg").textContent = "Zip library didn't load."; return; }
  const z = new JSZip();
  for (const cr of plan.cranes) for (const ph of ["pick", "set"]) { const e = elevScene(cr, ph); if (e) { const { blob } = await svgToPng(toSVG(e.scene, { lw: 0.06, pxPerM: 28 }), 1); z.file(`${cr.label.replace(/\W+/g, "_")}_${ph}.png`, blob); } }
  save(fbase() + "_elevations.zip", await z.generateAsync({ type: "blob" }));
};
$("xDxf").onclick = async () => {
  if (!window.JSZip) { $("xMsg").textContent = "Zip library didn't load."; return; }
  const site = mergeScenes(siteScenesAll("both")); const sb = site.bounds();
  const list = [{ scene: site }]; let x = sb[2] + 10;
  const z = new JSZip();
  for (const cr of plan.cranes) for (const ph of ["pick", "set"]) { const e = elevScene(cr, ph); if (e) { const b = e.scene.bounds(); list.push({ scene: e.scene, dx: x - b[0], dy: sb[1] - b[1] }); x += b[2] - b[0] + 10; z.file(`${cr.label.replace(/\W+/g, "_")}_${ph}_elevation.dxf`, toDXF([{ scene: e.scene }])); } }
  z.file(fbase() + "_site.dxf", toDXF([{ scene: site }])); z.file(fbase() + "_all.dxf", toDXF(list));
  save(fbase() + "_dxf.zip", await z.generateAsync({ type: "blob" }));
};
$("xJson").onclick = () => { const d = clone(plan); if (d.site.bg) delete d.site.bg.url; save(fbase() + ".json", JSON.stringify(d, null, 1)); };

// ================= Crane library & editor =================
$("bCranes").onclick = () => { renderCraneTable(); $("dCranes").showModal(); };
function renderCraneTable() {
  const rows = Object.values(REG.cranes).map(c => {
    const n = chartsFor(c.id).length;
    return `<tr><td><b>${escH(c.name)}</b><br><span class="small">${escH(c.src || "")}</span></td><td>${c.type === "cr" ? "Crawler" : "All-terrain"}</td><td>${escH(c.cap || "")}</td>
      <td>${n ? n + " chart(s)" : `<span class="pill amber">no charts</span>`}</td>
      <td class="n"><button data-ed="${c.id}">${c.builtin ? "Add / check charts" : "Edit"}</button> ${c.custom ? `<button data-rm="${c.id}">Delete</button>` : ""}</td></tr>`;
  }).join("");
  $("craneTable").innerHTML = `<tr><th>Crane</th><th>Type</th><th>Capacity</th><th>Load charts</th><th></th></tr>` + rows;
  $("craneTable").querySelectorAll("[data-ed]").forEach(b => b.onclick = () => openEditor(b.dataset.ed));
  $("craneTable").querySelectorAll("[data-rm]").forEach(b => b.onclick = async () => {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Confirm"; return; }
    if (!CAP.db) return;
    try { await CAP.db.doc("cranes/" + b.dataset.rm).delete(); for (const ch of chartsFor(b.dataset.rm)) if (!ch.builtin) await CAP.db.doc("charts/" + ch.id).delete(); toast("Crane deleted"); } catch (e) { toast("Couldn't delete"); }
  });
}
$("newCrane").onclick = () => openEditor(null);

const ED = { id: null, builtin: false, spec: null, charts: [], pages: [], selected: new Set(), ctl: null, pv: "plan" };
const SPEC_DEFAULT = { type: "at", name: "", cap: "", maxAngle: 82, front: 9.5, rear: -4.0, width: 3.0, axles: "7.0, 4.4, 2.7, -0.1, -1.8", tyreD: 1.4,
  outriggers: [{ name: "100%", spread: 8.3, fl: 5.5, fr: 5.5, rl: 3.6, rr: 3.6 }], float: 0.6, tail: 5.2, cwW: 4.5, cwD: 2.0, cwH: 2.4, cwLabel: "",
  pivotX: -2.2, pivotY: 3.8, Lmin: 13, Lmax: 60, sections: 6, baseMass: 55, cwMass: 60, hookblocks: [], trackLen: 10, gauge: 7.5, shoe: 1.3, boomW: 2.4, src: "" };
function openEditor(id) {
  ED.id = id || "c_" + uid(); ED.builtin = !!(id && BUILTIN_CRANES[id]);
  const existing = id && customCranes.find(c => c.id === id);
  ED.spec = existing ? clone(existing.spec) : clone(SPEC_DEFAULT);
  // every chart can be checked and corrected – built-in ones too (a corrected built-in chart is saved to the library and used instead)
  const bIds = new Set(Object.values(BUILTIN_CHARTS).flat().map(c => c.id));
  ED.charts = chartsFor(ED.id).map(c => { const d = clone(c); if (bIds.has(d.id)) { d.fromBuiltin = true; if (!d.builtin) d.dirty = true; } delete d.builtin; return d; });
  ED.pages = []; ED.selected = new Set();
  $("edTitle").textContent = ED.builtin ? `Load charts · ${BUILTIN_CRANES[id].name}` : existing ? `Edit · ${existing.spec.name}` : "Add crane from spec sheet";
  $("edThumbs").innerHTML = ""; $("edStatus").hidden = true; $("edRead").disabled = true; $("edReadChart").disabled = true;
  $("edRead").hidden = ED.builtin;
  $("edForm").closest(".grid2").hidden = ED.builtin;
  if (!CAP.sample) { $("edFileInfo").textContent = (CAP.local ? "Automatic reading of spec sheets needs Claude – click ✦ Link Claude at the top. Here you can view the PDF pages, type the specs and paste load chart tables." : "Reading spec sheets with Claude isn't available in this view. You can still type the specs and paste load chart tables."); }
  renderSpecForm(); renderChartEditors(); renderPreview();
  $("dEdit").showModal(); $("dEdit").querySelector(".db").scrollTop = 0;
}
function specFields() {
  const s = ED.spec;
  const f = (lab, k, step = "0.01", type = "number") => `<label>${lab}<input type="${type}" data-k="${k}" value="${escH(s[k] ?? "")}" step="${step}"></label>`;
  let h = `<div class="row"><label>Type<select data-k="type"><option value="at" ${s.type === "at" ? "selected" : ""}>All-terrain / truck</option><option value="cr" ${s.type === "cr" ? "selected" : ""}>Crawler</option></select></label>${f("Max capacity (t)", "cap", "1")}</div>
    ${f("Make & model", "name", "", "text")}`;
  if (s.type === "cr") {
    h += `<div class="row3">${f("Track length (overall)", "trackLen")}${f("Track gauge c/c", "gauge")}${f("Shoe width", "shoe")}</div><div class="row3">${f("Track ground contact (idler–sprocket)", "trackContact")}</div>`;
  } else {
    h += `<div class="row3">${f("Carrier front (from slew)", "front")}${f("Carrier rear (from slew, −)", "rear")}${f("Carrier width", "width")}</div>
      <div class="row">${f("Axles from slew centre (m, comma list, + front)", "axles", "", "text")}${f("Tyre diameter", "tyreD")}</div>
      <p class="small" style="margin:0">Outrigger set-ups: spread = pad centre to centre across; positions = pad distance from slew centre along the carrier.</p>
      <div id="orRows" style="display:flex;flex-direction:column;gap:6px">${(s.outriggers || []).map((o, i) => `<div class="row3" style="grid-template-columns:1.2fr .8fr .8fr .8fr .8fr .8fr auto">
        <label>Name<input type="text" data-or="${i}" data-ok="name" value="${escH(o.name)}"></label>
        <label>Spread<input type="number" step="0.01" data-or="${i}" data-ok="spread" value="${o.spread}"></label>
        <label>Front L<input type="number" step="0.01" data-or="${i}" data-ok="fl" value="${o.fl}"></label>
        <label>Front R<input type="number" step="0.01" data-or="${i}" data-ok="fr" value="${o.fr}"></label>
        <label>Rear L<input type="number" step="0.01" data-or="${i}" data-ok="rl" value="${o.rl}"></label>
        <label>Rear R<input type="number" step="0.01" data-or="${i}" data-ok="rr" value="${o.rr}"></label>
        <button data-ordel="${i}" style="align-self:end">×</button></div>`).join("")}</div>
      <div class="btnrow"><button id="orAdd">+ Outrigger set-up</button></div>`;
  }
  h += `<div class="row3">${f("Tail swing radius", "tail")}${f("Counterweight width", "cwW")}${f("Counterweight depth", "cwD")}</div>
    <div class="row3">${f("Boom min length", "Lmin", "0.1")}${f("Boom max length", "Lmax", "0.1")}${s.type === "cr" ? f("Lattice width", "boomW") : f("Boom sections", "sections", "1")}</div>
    ${s.type === "cr" ? `<div class="row3">${f("Boom foot length (m)", "footL", "0.1")}${f("Boom head length (m)", "headL", "0.1")}${f("Insert lengths (m, comma list)", "insertsTxt", "", "text")}</div>`
      : `<label>Telescoping positions per section (m, comma list – optional, e.g. 0, 4.7, 9.4, 10.2)<input type="text" data-k="teleSteps" value="${escH(s.teleSteps ?? "")}"></label>`}
    <div class="row3">${f("Boom pivot from slew (m)", "pivotX")}${f("Boom pivot height (m)", "pivotY")}${f("Max boom angle °", "maxAngle", "1")}</div>
    <div class="row3">${f(s.type === "cr" ? "Base mass excl. CW (t)" : "Travel weight (t)", "baseMass", "0.1")}${f("Max counterweight (t)", "cwMass", "0.1")}${f("CW options text", "cwLabel", "", "text")}</div>
    <label>Hook blocks (capacity:weight t, comma list)<input type="text" data-k="hooktext" value="${escH((s.hookblocks || []).map(h => h[0] + ":" + h[1]).join(", "))}"></label>
    ${f("Source / notes", "src", "", "text")}`;
  return h;
}
function renderSpecForm() {
  $("edForm").innerHTML = specFields();
  $("edForm").querySelectorAll("[data-k]").forEach(el => el.onchange = () => {
    const k = el.dataset.k;
    if (k === "hooktext") ED.spec.hookblocks = el.value.split(",").map(t => t.split(":").map(Number)).filter(a => a.length === 2 && !isNaN(a[0]) && !isNaN(a[1]));
    else ED.spec[k] = el.type === "number" ? (el.value === "" ? "" : +el.value) : el.value;
    if (k === "type") renderSpecForm();
    renderPreview();
  });
  $("edForm").querySelectorAll("[data-or]").forEach(el => el.onchange = () => { const o = ED.spec.outriggers[+el.dataset.or]; o[el.dataset.ok] = el.type === "number" ? +el.value : el.value; renderPreview(); renderChartEditors(); });
  $("edForm").querySelectorAll("[data-ordel]").forEach(b => b.onclick = () => { ED.spec.outriggers.splice(+b.dataset.ordel, 1); renderSpecForm(); renderPreview(); });
  if ($("orAdd")) $("orAdd").onclick = () => { ED.spec.outriggers.push({ name: "Set-up " + (ED.spec.outriggers.length + 1), spread: 6, fl: 5, fr: 5, rl: 3.5, rr: 3.5 }); renderSpecForm(); renderPreview(); };
}
function edModel() { return ED.builtin ? BUILTIN_CRANES[ED.id] : modelFromSpec({ ...ED.spec, id: ED.id }); }
function renderPreview() {
  const C = edModel();
  let svg = "";
  try {
    if (ED.pv === "plan") {
      const s = new Scene(); const om = C.or ? Object.keys(C.or.modes)[0] : "";
      s.add(carrierPlan(C, om, true)); const L = C.boom.Lmin * 1.4, R = Math.max(4, L * 0.55);
      s.add(upperPlan(C, L, boomAngle(C, L, R).theta, 0), -180);
      s.circle("RADIUS", [0, 0], C.up.tail, { dash: [0.5, 0.3] });
      svg = toSVG(s, { lw: 0.05, noSize: true });
    } else {
      const L = C.boom.Lmin * 1.6, R = Math.max(5, L * 0.5);
      const e = elevationView(C, { L, R, slew: 180, orMode: C.or ? Object.keys(C.or.modes)[0] : "", sl: 0, hL: 0.5, loadRot: 0, tandem: false }, { kind: "box", L: 4, W: 3, H: 2.5, rig: 5 });
      svg = toSVG(e.scene, { lw: 0.06, noSize: true });
    }
  } catch (err) { svg = `<p class="small">Preview needs a few more values (${escH(err.message)}).</p>`; }
  $("edPreview").innerHTML = svg;
}
$("pvPlan").onclick = () => { ED.pv = "plan"; $("pvPlan").setAttribute("aria-pressed", true); $("pvElev").setAttribute("aria-pressed", false); renderPreview(); };
$("pvElev").onclick = () => { ED.pv = "elev"; $("pvPlan").setAttribute("aria-pressed", false); $("pvElev").setAttribute("aria-pressed", true); renderPreview(); };

// ---- spec sheet pages ----
$("edFileBtn").onclick = () => $("edFile").click();
$("edFile").onchange = async e => {
  ED.pages = []; ED.selected = new Set(); $("edThumbs").innerHTML = "";
  const files = [...e.target.files];
  for (const f of files) {
    if (f.type === "application/pdf") {
      const lib = window.pdfjsLib || window["pdfjs-dist/build/pdf"];
      if (!lib) { toast("PDF reader didn't load – upload page images instead."); continue; }
      try { if (!window.pdfjsWorker) lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; } catch (err) { }
      const pdf = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
      $("edFileInfo").textContent = `${f.name}: ${pdf.numPages} pages. Tick the pages to read (dimension drawings or load charts).`;
      for (let i = 1; i <= Math.min(pdf.numPages, 400); i++) {
        const page = { src: "pdf", pdf, n: i, name: `${f.name} p.${i}` };
        ED.pages.push(page); addThumb(page);
        if (i % 6 === 0) await new Promise(r => setTimeout(r, 0));
      }
    } else if (f.type.startsWith("image/")) {
      const page = { src: "img", file: f, name: f.name };
      ED.pages.push(page); addThumb(page);
    }
  }
  updateReadButtons();
};
async function pageBlob(page, scale = 1.8) {
  if (page.src === "img") return page.file;
  const p = await page.pdf.getPage(page.n); const vp = p.getViewport({ scale });
  const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
  await p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  return await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
}
function addThumb(page) {
  const d = document.createElement("div"); d.className = "thumb"; d.innerHTML = `<div style="aspect-ratio:.72;background:#f1f3f5;display:flex;align-items:center;justify-content:center">…</div><span>${escH(page.name.split(" ").pop())}</span>`;
  $("edThumbs").appendChild(d);
  const io = new IntersectionObserver(async ents => {
    if (!ents[0].isIntersecting) return; io.disconnect();
    const b = await pageBlob(page, 0.35); const u = URL.createObjectURL(b);
    d.firstChild.outerHTML = `<img src="${u}" alt="${escH(page.name)}">`;
  }, { root: null });
  io.observe(d);
  d.onclick = () => { const i = ED.pages.indexOf(page); if (ED.selected.has(i)) { ED.selected.delete(i); d.classList.remove("sel"); } else { ED.selected.add(i); d.classList.add("sel"); } updateReadButtons(); };
}
function updateReadButtons() {
  const n = ED.selected.size, max = CAP.sampleImages?.maxCount || 0;
  $("edRead").disabled = !CAP.sample || !CAP.sampleImages || !n; $("edReadChart").disabled = !CAP.sample || !CAP.sampleImages || !n;
  if (n && max && n > max) $("edFileInfo").textContent = `${n} pages selected – Claude can read ${max} at a time; the first ${max} will be sent.`;
}
function setStatus(cls, msg) { const s = $("edStatus"); s.hidden = false; s.className = "status " + cls; s.innerHTML = msg; }
async function selectedBlobs() {
  const max = CAP.sampleImages?.maxCount || 4;
  const idx = [...ED.selected].sort((a, b) => a - b).slice(0, max);
  const out = []; for (const i of idx) out.push(await pageBlob(ED.pages[i], 2.0));
  return out;
}
const DIM_PROMPT = `You are reading crane manufacturer data sheet pages (images attached) to set up a crane in a lift-planning tool.
Extract the geometry needed to draw the crane in plan and elevation. Use metres and tonnes. Distances along the carrier are measured from the SLEW CENTRE (centre of rotation), positive towards the carrier FRONT (driver's cab end), negative towards the rear. "Left/right" are as seen by the driver facing forward.
Reply with ONLY one JSON object with these keys (use null for anything not shown; do not guess):
{"name": "make and model", "type": "at" or "cr", "cap": max capacity t,
 "front": carrier front end from slew (m), "rear": carrier rear end from slew (negative m), "width": carrier width (m),
 "axles": [axle positions from slew, + front], "tyreD": tyre outside diameter (m),
 "outriggers": [{"name": e.g. "100%" or "9.19 x 8.3", "spread": pad centre-to-centre across (m), "fl": front-left pad from slew (m), "fr": front-right, "rl": rear-left (positive number = behind slew), "rr": rear-right}],
 "tail": tail swing radius (m), "cwW": counterweight width (m), "cwD": counterweight depth (m), "cwLabel": counterweight options text,
 "Lmin": shortest main boom (m), "Lmax": longest main boom (m), "sections": telescopic sections count, "pivotX": boom foot pivot from slew (m, usually negative for telescopic cranes), "pivotY": boom pivot height (m),
 "maxAngle": max boom angle (deg), "baseMass": travel weight or base weight without counterweight (t), "cwMass": max counterweight (t),
 "hookblocks": [[capacity t, weight t], ...],
 "trackLen": crawler track overall length (m), "trackContact": track ground contact / bearing length, idler to sprocket centres (m), "gauge": track gauge centre-to-centre (m), "shoe": track shoe width (m), "boomW": lattice boom width (m),
 "notes": "short list of assumptions or values you could not find"}
Dimension drawings usually give outrigger positions as distances between pads and to the slew centre line; convert mm to m.`;
const CHART_PROMPT = `You are reading crane load chart pages (images attached). Transcribe every main-boom load chart table exactly.
Reply with ONLY one JSON object: {"charts":[{"label": short description e.g. "Outriggers 9.3 x 8.3 m · CW 88 t · 360°", "outriggers": outrigger set-up text, "counterweight_t": number or null, "slew": "360" or e.g. "over rear",
 "columns":[{"boom_m": boom length, "note": extra column info (telescoping code, hook block, reeving) or "", "caps": [[radius_m, capacity_t], ...]}]}], "notes": "anything unclear"}
Rules: one chart per table (a page may hold several). Copy numbers exactly as printed (decimal comma → decimal point). Skip empty or "-" cells. Do not include jib / fly-jib tables. Do not interpolate or invent values.`;
function mapSpec(j) {
  const s = ED.spec, n = v => (v === null || v === undefined || v === "" || isNaN(+v)) ? undefined : +v;
  if (j.type === "cr" || j.type === "at") s.type = j.type;
  if (j.name) s.name = j.name;
  for (const k of ["cap", "front", "rear", "width", "tyreD", "tail", "cwW", "cwD", "Lmin", "Lmax", "sections", "pivotX", "pivotY", "maxAngle", "baseMass", "cwMass", "trackLen", "trackContact", "gauge", "shoe", "boomW"]) if (n(j[k]) !== undefined) s[k] = n(j[k]);
  if (s.rear > 0) s.rear = -s.rear;
  if (Array.isArray(j.axles) && j.axles.length) s.axles = j.axles.filter(v => v != null).join(", ");
  if (Array.isArray(j.outriggers) && j.outriggers.length) s.outriggers = j.outriggers.map((o, i) => ({ name: o.name || `Set-up ${i + 1}`, spread: n(o.spread) ?? 8, fl: n(o.fl) ?? 5, fr: n(o.fr) ?? n(o.fl) ?? 5, rl: Math.abs(n(o.rl) ?? 3.5), rr: Math.abs(n(o.rr) ?? n(o.rl) ?? 3.5) }));
  if (Array.isArray(j.hookblocks)) s.hookblocks = j.hookblocks.filter(h => Array.isArray(h) && h.length === 2).map(h => [+h[0], +h[1]]);
  if (j.cwLabel) s.cwLabel = j.cwLabel;
  s.src = (s.src ? s.src + "; " : "") + "read from spec sheet" + (j.notes ? " – " + j.notes : "");
}
async function runRead(kind) {
  if (!CAP.sample) return;
  ED.ctl = new AbortController();
  setStatus("busy", `Reading ${ED.selected.size} page(s) with Claude… this usually takes 20–90 s. <button id="edStop">Stop</button>`);
  $("edStop").onclick = () => ED.ctl.abort();
  try {
    const images = await selectedBlobs();
    const res = await CAP.sample.json(kind === "dims" ? DIM_PROMPT : CHART_PROMPT, { images, modelTier: "complex", signal: ED.ctl.signal });
    if (kind === "dims") {
      mapSpec(res || {}); renderSpecForm(); renderPreview();
      setStatus("ok", `Specs filled in from the sheet. Check every value against the drawing${res && res.notes ? " – Claude noted: " + escH(res.notes) : ""}.`);
    } else {
      const charts = (res && res.charts) || [];
      let added = 0;
      for (const c of charts) {
        const cols = (c.columns || []).map(k => ({ L: +k.boom_m, note: k.note || "", caps: (k.caps || []).filter(p => Array.isArray(p) && p.length === 2 && !isNaN(+p[0]) && !isNaN(+p[1])).map(p => [+p[0], +p[1]]) })).filter(k => k.caps.length && !isNaN(k.L));
        if (!cols.length) continue;
        const C = edModel();
        ED.charts.push({ id: "ch_" + uid(), craneId: ED.id, label: c.label || "Load chart", or: matchOr(C, c.outriggers), cw: c.counterweight_t == null ? null : +c.counterweight_t, slew: c.slew || "360", cols, fresh: true });
        added++;
      }
      renderChartEditors();
      setStatus(added ? "ok" : "bad", added ? `${added} chart(s) read. Highlighted in orange until you tick "checked against sheet". ${res.notes ? "Claude noted: " + escH(res.notes) : ""}` : "No chart tables were found on those pages.");
    }
  } catch (e) {
    const msg = { cancelled: "Stopped.", not_granted: "Claude access wasn't allowed for this app.", rate_limited: "Too many requests – wait a moment and try again.", invalid_json: "Claude's answer couldn't be read as data – try fewer pages at a time.", image_rejected: "One of the pages couldn't be sent – try fewer or smaller pages." }[e.code] || ("Couldn't read the pages (" + (e.code || e.message || e) + ").");
    setStatus("bad", msg);
  }
}
function matchOr(C, txt) {
  if (!C || !C.or) return "";
  const keys = Object.keys(C.or.modes);
  const t = String(txt || "").toLowerCase();
  return keys.find(k => t.includes(k.toLowerCase())) || keys.find(k => { const sp = String(C.or.modes[k].spread); return t.includes(sp) || t.includes(sp.replace(".", ",")); }) || keys[0];
}
$("edRead").onclick = () => runRead("dims");
$("edReadChart").onclick = () => runRead("chart");

// ---- chart editors ----
function renderChartEditors() {
  const C = edModel();
  const orOpts = C && C.or ? Object.keys(C.or.modes) : [];
  $("edCharts").innerHTML = ED.charts.map((ch, ci) => {
    const radii = [...new Set([...ch.cols.flatMap(c => c.caps.map(p => p[0])), ...(ch._rows || [])])].sort((a, b) => a - b);
    const cell = (c, r) => { const v = c.caps.find(p => Math.abs(p[0] - r) < 1e-6); return v ? v[1] : ""; };
    return `<div class="card" data-chcard="${escH(ch.id)}" style="margin-bottom:10px;${ch.fresh || ED.focusChart === ch.id ? "border-color:var(--accent)" : ""}">${ch.fromBuiltin ? `<p class="small" style="margin:6px 10px 0">${ch.dirty ? "<b>Corrected copy of the built-in chart</b> – used instead of it. Delete to go back to the built-in figures." : "Built-in chart – correct any figure below and Save; your corrected copy is then used."}</p>` : ""}<div class="ch" style="flex-wrap:wrap">
      <input type="text" data-ch="${ci}" data-f="label" value="${escH(ch.label)}" style="flex:1;min-width:200px">
      ${orOpts.length ? `<select data-ch="${ci}" data-f="or">${orOpts.map(o => `<option ${o === ch.or ? "selected" : ""}>${escH(o)}</option>`).join("")}</select>` : ""}
      <label style="flex-direction:row;align-items:center;gap:4px">CW t<input type="number" data-ch="${ci}" data-f="cw" value="${ch.cw ?? ""}" style="width:70px"></label>
      <label class="chk"><input type="checkbox" data-ch="${ci}" data-f="checked" ${ch.fresh ? "" : "checked"}> checked against sheet</label>
      <button data-chdel="${ci}">Delete chart</button></div>
      <div class="cgrid"><table><tr><th>R \\ L</th>${ch.cols.map((c, k) => `<th><input type="number" step="0.01" data-ch="${ci}" data-colL="${k}" value="${c.L}" title="${escH(c.note)}"><br><span class="small">${escH(c.note).slice(0, 16)}</span></th>`).join("")}</tr>
      ${radii.map(r => `<tr><th>${r}</th>${ch.cols.map((c, k) => `<td><input type="number" step="0.01" data-ch="${ci}" data-col="${k}" data-r="${r}" value="${cell(c, r)}"></td>`).join("")}</tr>`).join("")}</table></div>
      <div class="btnrow" style="padding:6px 10px"><input type="number" step="0.5" min="0" placeholder="radius m" data-newr="${ci}" style="width:110px"><button data-addr="${ci}">+ Add radius row</button><input type="number" step="0.1" min="0" placeholder="boom m" data-newl="${ci}" style="width:110px"><button data-addl="${ci}">+ Add boom column</button></div></div>`;
  }).join("") || `<p class="small">No charts for this crane yet. Read them from the spec sheet, or paste a table (first row boom lengths, first column radii).</p>`;
  const q = s => $("edCharts").querySelectorAll(s);
  q("[data-f]").forEach(el => el.onchange = () => { const ch = ED.charts[+el.dataset.ch], f = el.dataset.f; if (f === "checked") ch.fresh = !el.checked; else { ch[f] = f === "cw" ? (el.value === "" ? null : +el.value) : el.value; ch.dirty = true; } if (f === "checked") renderChartEditors(); });
  q("[data-chdel]").forEach(b => b.onclick = () => { ED.charts.splice(+b.dataset.chdel, 1); renderChartEditors(); });
  q("[data-colL]").forEach(el => el.onchange = () => { ED.charts[+el.dataset.ch].cols[+el.dataset.colL].L = +el.value; ED.charts[+el.dataset.ch].dirty = true; });
  q("[data-addr]").forEach(b => b.onclick = () => { const ci = +b.dataset.addr, v = +q(`[data-newr="${ci}"]`)[0].value; if (!(v > 0)) return; const ch = ED.charts[ci]; ch._rows = [...(ch._rows || []), v]; ch.dirty = true; renderChartEditors(); });
  q("[data-addl]").forEach(b => b.onclick = () => { const ci = +b.dataset.addl, v = +q(`[data-newl="${ci}"]`)[0].value; if (!(v > 0)) return; const ch = ED.charts[ci]; ch.cols.push({ L: v, note: "", caps: [] }); ch.cols.sort((a, b) => a.L - b.L); ch.dirty = true; renderChartEditors(); });
  if (ED.focusChart) { const card = $("edCharts").querySelector(`[data-chcard="${CSS.escape(ED.focusChart)}"]`); if (card) setTimeout(() => card.scrollIntoView({ block: "start" }), 50); ED.focusChart = null; }
  q("[data-col]").forEach(el => el.onchange = () => {
    const col = ED.charts[+el.dataset.ch].cols[+el.dataset.col], r = +el.dataset.r;
    col.caps = col.caps.filter(p => Math.abs(p[0] - r) > 1e-6);
    if (el.value !== "") col.caps.push([r, +el.value]); col.caps.sort((a, b) => a[0] - b[0]); ED.charts[+el.dataset.ch].dirty = true;
  });
}
$("edPaste").onclick = () => {
  const box = document.createElement("div");
  box.innerHTML = `<label>Paste a chart (from Excel or text): first row = boom lengths, first column = radius. Use "-" or blank for empty.<textarea id="pasteT" rows="8"></textarea></label><div class="btnrow"><button class="pri" id="pasteOk">Add chart</button></div>`;
  $("edCharts").prepend(box);
  $("pasteOk").onclick = () => {
    const lines = $("pasteT").value.trim().split(/\r?\n/).map(l => l.trim().split(/\t|;|\s{2,}|\s/).map(t => t.replace(",", ".")));
    if (lines.length < 2) return;
    const Ls = lines[0].filter(t => t !== "" && !isNaN(+t)).map(Number);
    const cols = Ls.map(L => ({ L, note: "", caps: [] }));
    for (const ln of lines.slice(1)) { const r = +ln[0]; if (isNaN(r)) continue; ln.slice(1).forEach((t, k) => { if (k < cols.length && t !== "" && t !== "-" && !isNaN(+t)) cols[k].caps.push([r, +t]); }); }
    const C = edModel();
    ED.charts.push({ id: "ch_" + uid(), craneId: ED.id, label: "Pasted chart", or: C.or ? Object.keys(C.or.modes)[0] : "", cw: null, slew: "360", cols: cols.filter(c => c.caps.length), fresh: true });
    renderChartEditors();
  };
};
$("edSave").onclick = async () => {
  if (!ED.builtin && !ED.spec.name) { toast("Give the crane a name first"); return; }
  if (ED.charts.some(c => c.fresh)) { toast('Tick "checked against sheet" on every chart before saving'); return; }
  const charts = ED.charts.filter(c => !c.fromBuiltin || c.dirty).map(c => { const d = clone(c); delete d.fresh; delete d.fromBuiltin; delete d.dirty; delete d._rows; d.cols = (d.cols || []).filter(k => k.caps.length); d.craneId = ED.id; return d; });
  if (!CAP.db) {
    if (!ED.builtin) customCranes = customCranes.filter(c => c.id !== ED.id).concat([{ id: ED.id, spec: clone(ED.spec) }]);
    customCharts = customCharts.filter(c => c.craneId !== ED.id).concat(charts);
    rebuildRegistry(customCranes, customCharts); renderAll(); renderCraneTable(); $("dEdit").close();
    toast("Crane added for this session (saving isn't available here)"); return;
  }
  try {
    if (!ED.builtin) await CAP.db.doc("cranes/" + ED.id).set({ spec: clone(ED.spec), name: ED.spec.name, updated: Date.now() });
    const keep = new Set(charts.map(c => c.id));
    for (const old of chartsFor(ED.id)) if (!old.builtin && !keep.has(old.id)) await CAP.db.doc("charts/" + old.id).delete();
    for (const c of charts) await CAP.db.doc("charts/" + c.id).set(c);
    $("dEdit").close(); toast("Crane saved to the library");
  } catch (e) { toast("Couldn't save (" + (e.code || e) + ")"); }
};

// ================= boot =================
rebuildRegistry();
setupSiteEvents();
setup3DEvents();
renderMeta();
requestAnimationFrame(() => { renderAll(); fitView(); });
initCaps();
resetHistory();
window.__lp = { get plan() { return plan; }, set plan(v) { plan = v; }, evalCrane, craneSummary, openPlan, sheetSVG, siteSVGStatic, elevScene, renderAll, fitView };
