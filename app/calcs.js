// ================= Quick calculators beside the plan: sling loads, crane capacity at radius =================
// Like the ground bearing calculator: opened from where the figure already is (the rigging card, the utilisation row),
// starting from the plan's own numbers, worked in the plan's own units and rules (DAF, green limit, utilisation limit,
// the crane's chart). A picture, the result against its limit, one plain sentence, and the working in grey.
const QC = { kind: null, v: null };
(() => {
  if ($("dQc")) return;
  const d = document.createElement("dialog"); d.id = "dQc"; d.style.cssText = "width:min(780px,96vw)";
  d.innerHTML = `<div class="dh"><b id="qcTitle"></b><span class="small" id="qcSub" style="margin-left:8px"></span><span style="flex:1"></span><button data-close>Close</button></div><div class="db" id="qcBody"></div>`;
  document.body.append(d); d.querySelector("[data-close]").onclick = () => d.close();
  const st = document.createElement("style"); st.textContent = `#qcBody .qrow{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}#qcBody .qres{display:grid;grid-template-columns:1fr 1.2fr;gap:12px;align-items:center;margin:10px 0}
#qcBody .qbig{font-size:32px;font-weight:700;font-variant-numeric:tabular-nums}#qcBody .qbig small{font-size:14px;font-weight:400;color:var(--muted)}
#qcBody .qbar{position:relative;height:10px;border-radius:5px;background:var(--line,#dde3e8);margin:8px 0 2px}#qcBody .qbar i{display:block;height:100%;border-radius:5px}#qcBody .qbar b{position:absolute;top:-4px;width:2px;height:18px;background:var(--ink)}
#qcBody .qsay{font-weight:600;margin:6px 0 2px}#qcBody .qf{color:var(--muted);font-size:12px;font-family:ui-monospace,monospace}#qcBody table.qt{width:100%;font-size:12.5px;border-collapse:collapse;margin-top:6px}#qcBody table.qt td,#qcBody table.qt th{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right}#qcBody table.qt td:first-child,#qcBody table.qt th:first-child{text-align:left}`;
  document.head.append(st);
})();
const qcIn = (k, lab, val, step = 0.1, ext = "") => `<label>${lab}<input type="number" data-qc="${k}" step="${step}" min="0" value="${val ?? ""}" ${ext}></label>`;
const qcCol = (u, lim) => u == null ? "var(--muted)" : u > 100 ? "var(--bad,#b42318)" : u > lim ? "var(--amber,#b26a00)" : "var(--ok,#1e7a3c)";
function qcBar(u, lim, label) { return `<div class="qbar"><i style="width:${Math.min(100, (u || 0) / 2)}%;background:${qcCol(u, lim)}"></i><b style="left:50%"></b></div><div class="small" style="display:flex;justify-content:space-between"><span>0</span><span>${label}</span><span>${u > 200 ? `off scale × ${fx(u / 100, 1)}` : "200%"}</span></div>`; }
function qcWire() { $("qcBody").querySelectorAll("[data-qc]").forEach(el => el.onchange = () => { const k = el.dataset.qc, x = +el.value; if (isFinite(x)) QC.v[k] = x; qcRender(); }); $("qcBody").querySelectorAll("[data-qcsel]").forEach(el => el.onchange = () => { QC.v[el.dataset.qcsel] = isNaN(+el.value) ? el.value : +el.value; if (el.dataset.qcsel === "cr") qcCraneFrom(); qcRender(); }); }
function qcRender() { if (QC.kind === "sling") qcSling(); else if (QC.kind === "crane") qcCrane(); qcWire(); }

// ---------------- sling loads: the angle, the load in each leg, the rating it needs, what to use ----------------
function openSlingCalc(ld) {
  const R = ld?.rig, res = ld && R ? solveRig(ld) : null, beam = !!res?.beam;
  const legs = R?.arr === "tree" ? (R.tree.nodes.find(n => n.id === R.tree.root)?.legs || []) : null;
  const sl = (res?.rows || []).find(r => RIG_TYPES[r.type]?.sling), n0 = legs ? Math.min(4, Math.max(1, legs.filter(L => L.to?.pt).length || 2)) : (+ld?.spanY > 0 && !beam ? 4 : 2);
  QC.kind = "sling"; QC.v = { W: +ld?.weight || 10, cog: +ld?.cog || 0, n: n0, span: +ld?.span || 4, spanY: +ld?.spanY || 0, L: +(sl?.entry?.len || sl?.len) || Math.max(2, Math.round((+ld?.span || 4) * 0.8)), daf: ld ? rcDaf(ld) : (rule("rig.daf") ?? 1.1), share4: +R?.share4 || 3, type: "sling_round" };
  $("qcTitle").textContent = "Sling loads"; $("qcSub").textContent = ld ? ld.name + (beam ? " – a quick check of a bridle, not of the spreader rigging" : "") : "quick check"; qcRender(); $("dQc").showModal();
}
function qcSling() {
  const v = QC.v, n = Math.max(1, Math.min(4, Math.round(v.n))), W = v.W, half = v.span / 2, cog = v.n === 1 ? 0 : Math.max(-half, Math.min(half, v.cog)), green = RIG_GREEN, legHard = rule("rig.legHard") ?? 60, legMax = rule("rig.legMax") ?? 45;
  // the hook sits over the CoG: each end's share by moments, split between the points at that end
  const ends = n === 1 ? [{ k: "single leg", x: 0, V: W, m: 1 }] : [{ k: "end A", x: -half - cog, V: W * (half - cog) / (2 * half || 1), m: n === 4 ? 2 : 1 }, { k: "end B", x: half - cog, V: W * (half + cog) / (2 * half || 1), m: n === 4 ? 2 : 1 }];
  const f4 = n === 4 ? 4 / Math.max(2, Math.min(4, v.share4)) : 1;
  const rows = ends.map(e => { const dy = n === 4 ? v.spanY / 2 : 0, d = Math.hypot(e.x, dy), vv = v.L * v.L - d * d, ok = vv > 1e-6, H = ok ? Math.sqrt(vv) : 0, b = ok ? Math.atan2(d, H) / D2R : 90, Vl = e.V / e.m * f4, T = ok ? Vl / Math.cos(b * D2R) : null;
    return { ...e, d, H, b, Vl, T, req: T != null ? T * v.daf : null }; });
  const worst = rows.reduce((m, r) => !m || (r.T ?? 1e9) > (m.T ?? 1e9) ? r : m, null), bmax = Math.max(...rows.map(r => r.b)), reach = rows.every(r => r.T != null);
  const greenNeed = worst?.req != null ? worst.req / (green / 100) : null;
  const fam = t => RIG_TYPES[t]?.sling ? "sling" : t, lib = rigLibrary().filter(i => i.type === v.type && +i.swl > 0).sort((a, b) => a.swl - b.swl);
  const pick = greenNeed ? lib.filter(i => i.swl >= greenNeed - 1e-9).slice(0, 3) : [];
  const dmax = Math.max(...rows.map(r => r.d)), Lfor = a => dmax / Math.sin(a * D2R);
  const say = !reach ? `The ${fx(v.L, 1)} m legs can't reach the lifting points (${fx(dmax, 2)} m out from the hook) – they need to be longer than ${fx(dmax, 2)} m.`
    : bmax > legHard ? `${fx(bmax, 0)}° from vertical is over the ${legHard}° the app allows – use legs at least ${fx(Lfor(legMax), 1)} m long (≤ ${legMax}°) or a spreader.`
    : `Each leg to ${worst.k} carries ${fx(worst.T, 1)} t at ${fx(worst.b, 0)}° from vertical – it needs a rating of at least ${fx(worst.req, 1)} t with the DAF${greenNeed ? `, ${fx(greenNeed, 1)} t to stay in the green` : ""}.`;
  const col = qcCol(bmax > legHard ? 150 : bmax > legMax ? 90 : 50, 80);
  const pic = (() => { const w = 320, h = 190, sc = Math.min(110 / Math.max(1, half + Math.abs(cog)), 150 / Math.max(1, worst?.H || v.L)), gy = 150, hx = w / 2, hy = gy - (reach ? Math.max(...rows.map(r => r.H)) * sc : 80);
    let s = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:360px"><rect x="${hx - (half + cog) * sc - 20}" y="${gy}" width="${(2 * half) * sc + 40}" height="26" fill="#dfe4e9" stroke="#6b7682"/>`;
    rows.forEach(r => { const px = hx + r.x * sc; s += `<line x1="${hx}" y1="${hy}" x2="${px}" y2="${gy}" stroke="#e0701f" stroke-width="2.4"/><circle cx="${px}" cy="${gy}" r="3.5" fill="#1e7a3c"/><text x="${px}" y="${gy + 40}" font-size="11" text-anchor="middle" fill="currentColor">${fx(r.T ?? 0, 1)} t</text>`; });
    s += `<circle cx="${hx}" cy="${hy}" r="4" fill="#3a3e42"/><line x1="${hx}" y1="${hy}" x2="${hx}" y2="${gy}" stroke="#6b7682" stroke-dasharray="4 3"/><text x="${hx + 6}" y="${hy + 26}" font-size="12" fill="${col}">${fx(bmax, 0)}°</text><text x="${hx}" y="${hy - 8}" font-size="11" text-anchor="middle" fill="currentColor">W = ${fx(W, 1)} t</text>`;
    return s + `</svg>`; })();
  $("qcBody").innerHTML = `<div class="qrow">${qcIn("W", "Load (t)", v.W)}<label>Legs<select data-qcsel="n">${[1, 2, 4].map(k => `<option ${k === n ? "selected" : ""}>${k}</option>`).join("")}</select></label>${qcIn("span", "Lifting points A–B apart (m)", v.span, 0.05)}${n === 4 ? qcIn("spanY", "… across (m)", v.spanY, 0.05) : "<span></span>"}
      ${qcIn("cog", "CoG off the middle → B (m)", v.cog, 0.05)}${qcIn("L", "Leg length – hook to point (m)", v.L, 0.5)}${qcIn("daf", "DAF", v.daf, 0.05)}${n === 4 ? `<label>4 legs – load carried by<select data-qcsel="share4">${[2, 3, 4].map(k => `<option value="${k}" ${k === +v.share4 ? "selected" : ""}>${k} legs</option>`).join("")}</select></label>` : "<span></span>"}</div>
    <div class="qres"><div><div class="qbig" style="color:${col}">${reach ? fx(worst.T, 1) : "–"} <small>t in the leg</small></div>${reach ? `<div class="small">${fx(bmax, 1)}° from vertical · angle factor 1 ÷ cos β = ${fx(1 / Math.cos(bmax * D2R), 3)}${n > 1 ? ` · included angle ${fx(2 * bmax, 0)}°` : ""}</div>` : ""}
        <div class="qsay">${say}</div></div><div>${pic}</div></div>
    ${reach ? `<table class="qt"><tr><th>Leg</th><th>Out from the hook</th><th>Angle β</th><th>Vertical share</th><th>Load in the leg</th><th>Needs (× DAF ${fx(v.daf, 2)})</th></tr>${rows.map(r => `<tr><td>${r.k}${r.m > 1 ? ` (${r.m} legs)` : ""}</td><td>${fx(r.d, 2)} m</td><td>${fx(r.b, 1)}°</td><td>${fx(r.Vl, 2)} t</td><td><b>${fx(r.T, 2)} t</b></td><td>${fx(r.req, 2)} t</td></tr>`).join("")}</table>
    <div class="qf" style="margin-top:6px">share of each end = load × (CoG to the other end) ÷ (A to B)${n === 4 ? ` · split between its 2 legs${f4 !== 1 ? ` · × 4 ÷ ${v.share4} (load carried by ${v.share4} of the 4 legs)` : ""}` : ""}<br>β = asin(out ÷ leg length) · load in the leg = vertical share ÷ cos β · needs = load × DAF · green: ≤ ${green}% of the rating</div>` : ""}
    <div style="margin-top:8px"><b>What to use</b> <select data-qcsel="type">${Object.entries(RIG_TYPES).filter(([k, t]) => t.sling).map(([k, t]) => `<option value="${k}" ${k === v.type ? "selected" : ""}>${t.name}</option>`).join("")}</select>
      <span class="small">${greenNeed ? (pick.length ? pick.map(i => `${escH(i.name)} – ${fx(worst.req / i.swl * 100, 0)}%`).join(" · ") : "nothing in your library is big enough") : ""}</span></div>
    ${reach ? `<p class="small" style="margin:6px 0 0">Legs at least <b>${fx(Lfor(legMax), 1)} m</b> keep them within ${legMax}° · <b>${fx(Lfor(30), 1)} m</b> within 30° (less load in each leg).</p>` : ""}`;
}

// ---------------- crane capacity at a radius ----------------
function openCraneCalc(cr) {
  QC.kind = "crane"; QC.v = { cr: cr?.id || plan.cranes[0]?.id }; qcCraneFrom(true);
  $("qcTitle").textContent = "Crane capacity at radius"; $("qcSub").textContent = ""; qcRender(); $("dQc").showModal();
}
function qcCraneFrom(first) { const cr = plan.cranes.find(c => c.id === QC.v.cr); if (!cr) return; const S = craneSummary(cr); Object.assign(QC.v, { R: +fx(S.maxR || 10, 2), TW: +fx(S.TW || 0, 2), L: +cr.L || 0 }); }
function qcCrane() {
  const v = QC.v, cr = plan.cranes.find(c => c.id === v.cr); if (!cr) { $("qcBody").innerHTML = `<p class="small">Add a crane to the plan first.</p>`; return; }
  const C = REG.cranes[cr.model], S = craneSummary(cr), chart = S.chart, lim = +plan.site.ulim || (rule("crane.util") ?? 100), crL = { ...cr, L: v.L };
  const k = chart ? craneCapacity(C, crL, chart, v.R) : { cap: null, why: "no load chart selected for this crane" }, cap = k.cap, u = cap ? v.TW / cap * 100 : null, ba = boomAngle(C, v.L, v.R);
  // the furthest radius this hook load can go to (within the limit), and the most it can lift at this radius
  let rMax = null; if (chart && v.TW > 0) for (let R = 2; R <= 150; R += 0.25) { const c2 = craneCapacity(C, crL, chart, R).cap; if (c2 != null && v.TW <= c2 * lim / 100 + 1e-9) rMax = R; else if (rMax != null && c2 != null) break; }
  const say = cap == null ? `No capacity from the chart at ${fx(v.R, 1)} m with ${fx(v.L, 1)} m of boom${k.why ? " – " + k.why : ""}.`
    : u <= lim ? `${fx(v.TW, 1)} t at ${fx(v.R, 1)} m is ${fx(u, 0)}% of the ${fx(cap, 1)} t the chart allows – within the ${lim}% limit.`
    : `${fx(v.TW, 1)} t at ${fx(v.R, 1)} m is ${fx(u, 0)}% of the ${fx(cap, 1)} t the chart allows – over the ${lim}% limit${rMax != null ? `; it can go out to ${fx(rMax, 2)} m at most` : ""}.`;
  const pic = (() => { const w = 320, h = 190, gx = 50, gy = 160, sc = 230 / Math.max(10, v.R * 1.15, rMax || 0), th = ba.ok ? ba.theta * D2R : Math.PI / 4, bl = Math.min(150, (v.R / Math.max(0.1, Math.cos(th))) * sc);
    const tx = gx + Math.cos(th) * bl, ty = gy - 20 - Math.sin(th) * bl, rx = gx + v.R * sc;
    let s = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:360px"><line x1="0" y1="${gy}" x2="${w}" y2="${gy}" stroke="#8a7a5a"/><rect x="${gx - 22}" y="${gy - 22}" width="44" height="22" fill="#6b7682"/>`;
    s += `<line x1="${gx}" y1="${gy - 20}" x2="${tx}" y2="${ty}" stroke="#f2c200" stroke-width="5"/><line x1="${tx}" y1="${ty}" x2="${rx}" y2="${gy - 30}" stroke="#3a3e42"/><rect x="${rx - 9}" y="${gy - 30}" width="18" height="14" fill="#dfe4e9" stroke="#6b7682"/>`;
    s += `<line x1="${gx}" y1="${gy + 12}" x2="${rx}" y2="${gy + 12}" stroke="currentColor"/><text x="${(gx + rx) / 2}" y="${gy + 26}" font-size="11" text-anchor="middle" fill="currentColor">R ${fx(v.R, 1)} m</text>`;
    if (rMax != null) s += `<line x1="${gx + rMax * sc}" y1="${gy - 4}" x2="${gx + rMax * sc}" y2="${gy + 18}" stroke="#1e7a3c" stroke-dasharray="3 2"/><text x="${gx + rMax * sc}" y="${gy - 8}" font-size="10" text-anchor="middle" fill="#1e7a3c">max ${fx(rMax, 1)}</text>`;
    return s + `</svg>`; })();
  $("qcBody").innerHTML = `<div class="qrow"><label>Crane<select data-qcsel="cr">${plan.cranes.map(c => `<option value="${c.id}" ${c.id === v.cr ? "selected" : ""}>${escH(c.label || REG.cranes[c.model]?.short || "Crane")}</option>`).join("")}</select></label>${qcIn("TW", "Hook load (t)", v.TW, 0.1)}${qcIn("R", "Radius (m)", v.R, 0.25)}${qcIn("L", "Boom length (m)", v.L, 0.5)}</div>
    <p class="small" style="margin:4px 0 0">Hook load = load + rigging + hook block – the plan's figure for this crane. Chart: ${escH(chart?.label || "none selected")}.</p>
    <div class="qres"><div><div class="qbig" style="color:${qcCol(u, lim)}">${u != null ? fx(u, 0) : "–"} <small>% of the chart</small></div>${u != null ? qcBar(u, lim, `limit ${lim}%`) : ""}
      <div class="qsay">${say}</div>
      <div class="qf">capacity at ${fx(v.R, 2)} m = ${cap != null ? fx(cap, 1) + " t" : "–"}${k.rUsed ? ` (chart row ${fx(k.rUsed, 1)} m – the next one up)` : ""}<br>use = hook load ÷ capacity = ${fx(v.TW, 2)} ÷ ${cap != null ? fx(cap, 1) : "–"}${u != null ? " = " + fx(u, 1) + "%" : ""}${ba.ok ? `<br>boom angle ${fx(ba.theta, 1)}°` : ""}${cap != null ? `<br>most at this radius within ${lim}%: ${fx(cap * lim / 100, 1)} t` : ""}</div></div>
      <div>${pic}</div></div>`;
}
// ---------------- where you meet these in the app ----------------
{ const _rc = renderChecks; renderChecks = function (...a) { const r = _rc.apply(this, a);
    try { const box = $("checks"); if (!box) return r;
      box.querySelectorAll("[data-rig]").forEach(b => { if (b.parentNode.querySelector("[data-slcalc]")) return; b.insertAdjacentHTML("beforebegin", `<button class="lnk" data-slcalc="${b.dataset.rig}" style="margin-right:8px">sling loads…</button>`); });
      const cards = [...box.querySelectorAll(":scope > .card")]; plan.cranes.forEach((cr, i) => { const card = cards[i]; if (!card) return; const td = [...card.querySelectorAll("td")].find(t => /^Utilisation/.test(t.textContent.trim())); if (td && !td.querySelector("[data-crcalc]")) td.insertAdjacentHTML("beforeend", ` <button class="lnk" data-crcalc="${cr.id}">work it out…</button>`); });
    } catch (e) { }
    return r; }; }
document.addEventListener("click", e => {
  const s = e.target.closest("[data-slcalc]"); if (s) { e.preventDefault(); e.stopPropagation(); const ld = plan.loads.find(l => l.id === s.dataset.slcalc); openSlingCalc(ld || null); return; }
  const c = e.target.closest("[data-crcalc]"); if (c) { e.preventDefault(); e.stopPropagation(); openCraneCalc(plan.cranes.find(x => x.id === c.dataset.crcalc)); } }, true);
// a crane over its limit offers the calculator as its fix
{ const _cs = craneSummary; craneSummary = function (cr, ...a) { const S = _cs.call(this, cr, ...a);
    try { for (const w of S?.warn || []) if (/utilisation .*(over|above)/.test(w) && typeof chkFix === "function" && !CHK_FIX.has(w)) chkFix(w, "Work out how far it can go", () => openCraneCalc(cr), { nav: true }); } catch (e) { }
    return S; }; }
