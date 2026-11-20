// ================= Lift sequence, warnings by severity, chart check, and the self-check sheet =================

// ---------- severity: Must fix / Check / Info ----------
const SEV_BAD = /too close to the crane|over capacity|over the crane's capacity|over (its|the)|overload|exceeds|do not lift|no chart capacity|no capacity|inside the load|too short|hits |clash|outside the exclusion|tip|unloads|longer than any column|not found|side-loads|is over/i;
const SEV_INFO = /sits between chart rows|^tandem: crane a|shown tilted|shares worked out|^cog off the beam|set up and sized by the app/i;
const sevOf = t => SEV_BAD.test(t) && !/close to/i.test(t) ? "bad" : SEV_INFO.test(t) ? "info" : "check";
function warnBlock(list) {
  const L = [...new Set((list || []).filter(Boolean))]; if (!L.length) return "";
  const g = { bad: [], check: [], info: [] }; L.forEach(t => g[sevOf(t)].push(t));
  const li = (a, col) => a.map(t => `<li style="color:${col}">${escH(t)}</li>`).join("");
  return `<div class="sevw">${g.bad.length ? `<div class="sevh bad">Must fix (${g.bad.length})</div><ul>${li(g.bad, "var(--bad)")}</ul>` : ""}
    ${g.check.length ? `<details ${g.bad.length ? "" : "open"}><summary class="sevh amber">Check (${g.check.length})</summary><ul>${li(g.check, "var(--ink)")}</ul></details>` : ""}
    ${g.info.length ? `<details><summary class="sevh info">Info (${g.info.length})</summary><ul>${li(g.info, "var(--muted)")}</ul></details>` : ""}</div>`;
}
{ const st = document.createElement("style"); st.textContent = `.sevw{padding:2px 10px 8px;font-size:12px}.sevw ul{margin:2px 0 6px;padding-left:18px}.sevw li{margin:2px 0}.sevh{font-weight:700;font-size:12px;margin:4px 0 2px;cursor:pointer}.sevh.bad{color:var(--bad)}.sevh.amber{color:var(--amber)}.sevh.info{color:var(--muted)}.sevw summary{list-style:none}.sevw summary::-webkit-details-marker{display:none}.sevw summary:before{content:"▸ ";font-size:10px}.sevw details[open] summary:before{content:"▾ "}
.seqt{width:100%;font-size:12px;border-collapse:collapse}.seqt td,.seqt th{padding:2px 4px;text-align:right}.seqt td:first-child,.seqt th:first-child{text-align:left}.seqt tr.mx td{font-weight:700}`; document.head.append(st); }

// ---------- chart checked against the manufacturer's data sheet (kept with the plan, printed on the sheets) ----------
const chartOk = id => !!(plan.site.chartOk && plan.site.chartOk[id]);

// ---------- lift sequence: the crane's radius, boom angle, capacity and utilisation through the lift ----------
function liftSequence(cr, S) {
  const C = S.C, ld = plan.loads.find(l => l.id === cr.attach?.load); if (!C || !ld || !S.chart || C.type === "ped") return null;
  const p0 = S.ph.pick, p1 = S.ph.set; if (!p0.hook || !p1.hook) return null;
  const tp = travelPath(ld), own = tp && tp.hooks && tp.crane && tp.crane.id === cr.id;
  const hookAt = t => { if (own) { const i = Math.round(t * (tp.hooks.length - 1)); return tp.hooks[i]; } return [p0.hook[0] + (p1.hook[0] - p0.hook[0]) * t, p0.hook[1] + (p1.hook[1] - p0.hook[1]) * t]; };
  const slew = own ? Math.abs(tp.slew || 0) : 0, mid = slew > 1 ? "Slew" : "Travel";
  const st = [["Lift off (pick)", 0], [`${mid} ¼`, 0.25], [`${mid} ½`, 0.5], [`${mid} ¾`, 0.75], ["Set down", 1]];
  if (own && tp.luff) { st.push([`${tp.luff.up ? "Boomed up" : "Boomed down"} to R ${fx(tp.luff.Rmin, 1)} m${tp.luff.names.length ? " past " + tp.luff.names.join(", ") : ""}`, tp.luff.at]); st.sort((a, b) => a[1] - b[1]); }
  const W = Math.max(p0.hookLoad || 0, p1.hookLoad || 0);
  const rows = st.map(([name, t]) => {
    const h = hookAt(t), R = Math.hypot(h[0] - cr.x, h[1] - cr.y), ba = boomAngle(C, cr.L, R), k = craneCapacity(C, cr, S.chart, R);
    const cap = t === 0 && S.capManual ? S.cap : k.cap, util = cap ? W / cap * 100 : null;
    return { name, t, R, ang: ba.ok ? ba.theta : null, cap, rUsed: k.rUsed, util };
  });
  const mx = rows.reduce((m, r) => (r.util ?? -1) > (m.util ?? -1) ? r : m, rows[0]);
  return { rows, mx, W, slew };
}
{ const _cs = craneSummary; craneSummary = function (cr) {
    const S = _cs(cr);
    try {
      const lim0 = +plan.site.ulim || (rule("crane.util") ?? 100);
      if (S.util != null && S.util > 100) S.warn.unshift(`${cr.label}: utilisation ${fx(S.util, 0)}% – over the crane's capacity at ${fx(S.maxR, 1)} m (${fx(S.TW, 1)} t on ${fx(S.cap)} t)`);
      else if (S.util != null && S.util > lim0) S.warn.unshift(`${cr.label}: utilisation ${fx(S.util, 0)}% is above the ${lim0}% limit – close to capacity`);
      if (S.gbpOk === false) S.warn.unshift(`${cr.label}: ground bearing ${fx(S.gbp, 1)} t/m² is over the ${fx(gbcFor(cr), 1)} t/m² allowed – more / bigger mats or better ground`);
      if (S.chart && !chartOk(S.chart.id)) S.warn.push(`Load chart “${S.chart.label}” is not yet marked as checked against the manufacturer's data sheet (crane panel → Load chart)`);
      const q = liftSequence(cr, S); if (q) { S.seq = q;
        const m = q.mx, lim = +plan.site.ulim || (rule("crane.util") ?? 100);
        if (m.t > 0 && m.t < 1 && m.util != null && S.util != null && m.util > S.util + 0.5) {
          const t = `${cr.label}: during the lift (${m.name.toLowerCase()}) the radius is ${fx(m.R, 1)} m – larger than at pick / set: capacity ${fx(m.cap)} t, utilisation ${fx(m.util, 0)}%`;
          S.warn.push(m.util > 100 ? t + " – over capacity" : m.util > lim ? t + ` – over the ${lim}% limit` : t);
          if (m.util > 100) S.status = "bad"; else if (m.util > lim && S.status !== "bad") S.status = "amber";
        }
        if (rows_noCap(q)) S.warn.push(`${cr.label}: no chart capacity at part of the lift (radius out of the chart) – check the boom length`);
      }
    } catch (e) { console.warn(e); }
    return S;
  }; }
const rows_noCap = q => q.rows.some(r => r.cap == null);
function seqTableHTML(q) {
  return `<details style="padding:2px 10px 6px"><summary class="small"><b>Lift sequence</b> · highest ${q.mx.util != null ? fx(q.mx.util, 0) + "% at " + q.mx.name.toLowerCase() : "–"}</summary>
    <table class="seqt"><tr><th>Stage</th><th>R (m)</th><th>Boom °</th><th>Cap (t)</th><th>Use</th></tr>${q.rows.map(r => `<tr class="${r === q.mx ? "mx" : ""}"><td>${r.name}</td><td>${fx(r.R, 1)}</td><td>${r.ang != null ? fx(r.ang, 1) : "–"}</td><td>${r.cap != null ? fx(r.cap) : "–"}</td><td>${r.util != null ? fx(r.util, 0) + "%" : "–"}</td></tr>`).join("")}</table>
    <p class="small" style="margin:3px 0 0">Load on this hook ${fx(q.W, 2)} t through the lift${q.slew > 1 ? ` · slew ${fx(q.slew, 0)}°` : ""}. Capacity from the chart at each radius (next row up).</p></details>`;
}
// ---------- checks panel: warnings grouped, the sequence under each crane ----------
{ const _rc = renderChecks; renderChecks = function (...a) {
    const r = _rc.apply(this, a);
    try {
      const box = $("checks"); if (!box || allMode) return r;
      // crane cards: in the order the cranes are listed
      const cards = [...box.querySelectorAll(":scope > .card")];
      plan.cranes.forEach((cr, i) => { const card = cards[i]; if (!card) return; const S = craneSummary(cr);
        const reds = [...card.querySelectorAll(':scope > p.small[style*="var(--bad)"]')]; const texts = reds.map(p => p.textContent); reds.forEach(p => p.remove());
        if (S.seq) card.insertAdjacentHTML("beforeend", seqTableHTML(S.seq));
        card.insertAdjacentHTML("beforeend", warnBlock(texts)); });
      // rigging / travel cards: their warnings grouped too
      cards.slice(plan.cranes.length).forEach(card => { const ps = [...card.querySelectorAll(':scope > p.small[style*="var(--bad)"], :scope > p.small[style*="var(--amber)"]')]; if (ps.length < 1) return;
        if (/Travel path|Lift over/.test(card.querySelector(".ch")?.textContent || "")) return;
        const t = ps.map(p => p.textContent); ps.forEach(p => p.remove()); card.insertAdjacentHTML("beforeend", warnBlock(t)); });
    } catch (e) { console.warn(e); }
    return r;
  }; }
// ---------- crane panel: "chart checked" tick under the load chart ----------
{ const _rp = renderProps; renderProps = function (...a) {
    const r = _rp.apply(this, a);
    try {
      const c = sel?.kind === "crane" ? plan.cranes.find(x => x.id === sel.id) : null, ch = c && REG.charts[c.chartId], s = $("pChart");
      if (c && ch && s && !$("pChartOk")) {
        const ok = plan.site.chartOk?.[ch.id], d = document.createElement("label"); d.className = "chk";
        d.innerHTML = `<input type="checkbox" id="pChartOk" ${ok ? "checked" : ""}> Chart checked against the manufacturer's data sheet${ok ? ` <span class="small">(${escH(ok.by || "")} ${escH(ok.date || "")})</span>` : ""}`;
        s.closest("label").after(d);
        $("pChartOk").onchange = e => { plan.site.chartOk = { ...(plan.site.chartOk || {}) }; if (e.target.checked) plan.site.chartOk[ch.id] = { by: plan.meta.by || "", date: new Date().toLocaleDateString("en-GB") }; else delete plan.site.chartOk[ch.id]; markDirty(); renderAll(); };
      }
    } catch (e) { console.warn(e); }
    return r;
  }; }

// ---------- the self-check sheet: every figure next to how it was worked out ----------
function checkSheetSVG() {
  const W = 3508, H = 2480, M = 36, e = s => escH(String(s ?? "")), bandY = H - 420;
  let g = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">
<rect width="${W}" height="${H}" fill="#fff"/><rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="none" stroke="#16202a" stroke-width="4"/>
<line x1="${M}" y1="${bandY}" x2="${W - M}" y2="${bandY}" stroke="#16202a" stroke-width="4"/>`;
  const L = plan.lifts[plan.al];
  g += `<text x="${M + 24}" y="${M + 56}" font-size="36" font-weight="700" fill="#16202a">${e((plan.lifts.length > 1 ? L.name.toUpperCase() + " · " : "") + "CALCULATION CHECK – every figure and where it comes from")}</text>`;
  // two columns of tables
  const colW = (W - 2 * M - 90) / 2, cx = [M + 30, M + 60 + colW];
  let y = [M + 110, M + 110], ci = 0;
  const table = (title, head, rows, widths) => {
    const need = 60 + (rows.length + 1) * 38; if (y[ci] + need > bandY - 30 && ci === 0) ci = 1;
    const x0 = cx[ci]; let yy = y[ci];
    g += `<text x="${x0}" y="${yy + 30}" font-size="26" font-weight="700" fill="#16202a">${e(title)}</text>`; yy += 46;
    const ws = widths.map(w => w * colW), row = (vals, bold, fill, colr) => { let x = x0; if (fill) g += `<rect x="${x0}" y="${yy}" width="${colW}" height="38" fill="${fill}"/>`;
      vals.forEach((v, i) => { const right = widths.length > 3 ? i > 0 : i === widths.length - 1; g += `<text x="${right ? x + ws[i] - 8 : x + 8}" y="${yy + 26}" font-size="${(typeof fitFs === "function" ? fitFs(v, ws[i] - 16, 20, 12) : 20).toFixed(1)}" text-anchor="${right ? "end" : "start"}" fill="${(colr && colr[i]) || "#16202a"}"${bold ? ' font-weight="700"' : ""}>${e(v)}</text>`; x += ws[i]; }); yy += 38; };
    row(head, true, "#e9edf1"); rows.forEach((r, k) => row(r.v || r, r.b, k % 2 ? "#f7f9fa" : null, r.c));
    y[ci] = yy + 24;
  };
  const col = st => st === "bad" ? "#b42318" : st === "amber" ? "#a15c00" : st === "ok" ? "#1e7a3c" : "#16202a";
  // the load(s)
  for (const ld of plan.loads) {
    const rw = rigW(ld), cr = plan.cranes.filter(c => c.attach?.load === ld.id);
    table(`Load – ${ld.name}`, ["Item", "Value", "Source"], [
      ["Load weight", `${fx(+ld.weight || 0, 2)} t`, ld.wInclRig ? "entered (incl. rigging)" : "entered / load library"],
      ["Rigging weight", `${fx(rw, 3)} t`, "sum of the rigging schedule"],
      ...cr.map(c => ["Hook block – " + c.label, `${fx(+c.hookBlock || 0, 2)} t`, "crane block"]),
      ["Centre of gravity", `${fx(+ld.cog || 0, 2)} m towards B`, "entered"]
    ], [0.38, 0.27, 0.35]);
  }
  // each crane
  for (const cr of plan.cranes) {
    const S = craneSummary(cr), C = S.C; if (!C) continue;
    const u = S.util, ust = S.status, lim = +plan.site.ulim || (rule("crane.util") ?? 100);
    table(`${cr.label} – ${C.name}`, ["Check", "Working", "Result"], [
      ["Load chart", `${S.chart ? S.chart.label : "none"}${S.chart ? (chartOk(S.chart.id) ? " · checked" : " · NOT marked checked") : ""}`, ""],
      ["Boom", `${fx(cr.L)} m · angle ${fx(S.ph.pick.ba?.theta, 1)}° pick / ${fx(S.ph.set.ba?.theta, 1)}° set`, ""],
      ["Radius", `pick ${fx(S.ph.pick.R, 2)} m · set ${fx(S.ph.set.R, 2)} m · max ${fx(S.maxR, 2)} m (${S.maxRFrom})`, `${fx(S.maxR, 2)} m`],
      ["Capacity", `chart row ${S.rUsed != null ? fx(S.rUsed) + " m" : "–"} (next row up from ${fx(S.maxR, 2)} m)${S.capManual ? " · typed by the planner" : ""}`, S.cap != null ? `${fx(S.cap)} t` : "–"],
      ["Total weight on the hook (TW)", twBreak(cr, S), `${fx(S.TW, 2)} t`],
      { v: ["Utilisation", `TW ÷ capacity × 100 = ${fx(S.TW, 2)} ÷ ${S.cap != null ? fx(S.cap) : "–"} × 100 (limit ${lim}%)`, u == null ? "–" : `${fx(u, 1)} %`], b: true, c: [null, null, col(u == null ? "" : u > 100 ? "bad" : u > lim ? "amber" : "ok")] },
      ...(C.type === "ped" ? [] : [
        ["Gross applied weight (GAW)", `${fx(S.craneWt)} crane + ${fx(S.cwWt)} CW${S.slWt ? ` + ${fx(S.slWt)} SL ballast` : ""} + ${fx(S.TW, 2)} TW`, `${fx(S.GAW, 1)} t`],
        ["Bearing area", S.mat ? S.mat.text : `${fx(S.matA, 2)} m²`, `${fx(S.matA, 2)} m²`],
        { v: ["Ground bearing pressure", `${S.react ? `max ${S.C?.type === "cr" ? "track" : "outrigger"} reaction (manufacturer${cr.oSrc ? ", " + cr.oSrc : ""}) ÷ area = ${fx(S.react, 1)} ÷ ${fx(S.matA, 2)}` : `0.75 × GAW ÷ area = 0.75 × ${fx(S.GAW, 1)} ÷ ${fx(S.matA, 2)}`} · allowed ${typeof gbcTxt === "function" ? gbcTxt(cr) : gbcFor(cr) ? fx(gbcFor(cr), 1) + " t/m²" : "TO BE CONFIRMED"}`, S.gbp != null ? `${fx(S.gbp, 1)} t/m²` : "–"], b: true, c: [null, null, col(S.gbpOk === false ? "bad" : S.gbpOk ? "ok" : "")] }]),
      ...(S.wind ? [{ v: ["Wind", S.wind.txt, S.wind.now ? `${fx(S.wind.now, 1)} / ${fx(S.wind.lim, 1)} m/s` : `≤ ${fx(S.wind.lim, 1)} m/s`], c: [null, null, col(S.wind.lvl)] }] : [])
    ], [0.27, 0.55, 0.18]);
    if (S.seq) table(`${cr.label} – lift sequence`, ["Stage", "Radius", "Boom angle", "Capacity", "Utilisation"], S.seq.rows.map(r => ({ v: [r.name, `${fx(r.R, 2)} m`, r.ang != null ? `${fx(r.ang, 1)}°` : "–", r.cap != null ? `${fx(r.cap)} t` : "–", r.util != null ? `${fx(r.util, 1)} %` : "–"], b: r === S.seq.mx, c: [null, null, null, null, col(r.util == null ? "" : r.util > 100 ? "bad" : r.util > lim ? "amber" : "ok")] })), [0.3, 0.17, 0.17, 0.18, 0.18]);
  }
  // rigging
  for (const ld of plan.loads) {
    const rr = ld.rig?.arr ? solveRig(ld) : null; if (!rr) continue;
    table(`Rigging – ${ld.name}`, ["Part", "Qty", "Load each", "SWL", "Use"], rr.rows.map(r => ({ v: [`${r.no}. ${r.name}`, r.qty, `${fx(r.load, 2)} t`, `${fx(r.swl, 1)} t`, r.util != null ? `${fx(r.util, 0)} %` : "–"], c: [null, null, null, null, col(r.util > 100 ? "bad" : r.util > 90 ? "amber" : "ok")] })), [0.5, 0.08, 0.15, 0.14, 0.13]);
  }
  // open points
  const all = []; for (const cr of plan.cranes) all.push(...craneSummary(cr).warn); for (const ld of plan.loads) { const rr = ld.rig?.arr ? solveRig(ld) : null; if (rr) all.push(...rr.warn); }
  const sv = [...new Set(all)].map(t => [sevOf(t), t]).sort((a, b) => ["bad", "check", "info"].indexOf(a[0]) - ["bad", "check", "info"].indexOf(b[0]));
  if (sv.length) table("Open points", ["", "Note"], sv.slice(0, 14).map(([s, t]) => ({ v: [s === "bad" ? "MUST FIX" : s === "check" ? "CHECK" : "INFO", t], c: [col(s === "bad" ? "bad" : s === "check" ? "amber" : ""), null] })), [0.13, 0.87]);
  // prepared-by box and title block (checked / approved sign-off left out for now)
  const sx = M + 30, sy = bandY + 30;
  // (prepared-by / signature box left off – not needed for now)
  g += tbBlock({ W, H, M, lift: typeof liftNoBox === "function" ? liftNoBox(sheetCtx?.lift ?? liftNo(plan.al)) : liftNo(plan.al), sheet: sheetCtx?.sheet ? String(sheetCtx.sheet).replace(/^(\d+)/, "$1a") : "check" });
  return g + "</svg>";
}
// each lift's plan sheet is followed by its check sheet
let CHK_Q = null;
{ const _sh = sheetSVG; sheetSVG = async function (...a) { const svg = await _sh.apply(this, a); if (CHK_Q) { try { CHK_Q.set(plan.al, checkSheetSVG()); } catch (e) { console.warn("check sheet", e); } } return svg; }; }
{ const _bs = buildSheets; buildSheets = async function (...a) {
    CHK_Q = new Map(); let out;
    try { out = await _bs.apply(this, a); } finally { var Q = CHK_Q; CHK_Q = null; }
    if (!Q || !Q.size || plan.meta?.noChk) return out;
    const res = [];
    for (const s of out) { res.push(s); const m = /_plan$/.test(s.name) && plan.lifts.findIndex(L => s.name.includes("_" + L.name.replace(/[^\w\-]+/g, "_") + "_plan")); if (m != null && m !== false && m >= 0 && Q.has(m)) res.push({ name: s.name.replace(/_plan$/, "_check"), svg: Q.get(m) }); }
    return res;
  }; }

// Export dialog: choose whether the calculation check sheets go in (saved with the plan, on by default)
(() => {
  const d = $("dExport"), row = d && d.querySelector(".btnrow"); if (!row) return;
  const lab = document.createElement("label"); lab.className = "vi"; lab.style.cssText = "display:flex;flex-direction:row;align-items:center;gap:8px;margin:0 0 8px;font-weight:400";
  lab.innerHTML = `<input type="checkbox" id="xChk" style="width:auto;margin:0"> Include the calculation check sheet (all lifts on one sheet)`;
  row.parentNode.insertBefore(lab, row);
  const cb = $("xChk"), sync = () => { cb.checked = !plan.meta?.noChk; };
  cb.onchange = () => { plan.meta = plan.meta || {}; if (cb.checked) delete plan.meta.noChk; else plan.meta.noChk = true; markDirty(); const pc = $("pvChk"); if (pc) pc.checked = cb.checked; };
  $("bExport")?.addEventListener("click", sync); sync();
})();
