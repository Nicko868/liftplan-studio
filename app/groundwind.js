// ================= Site limits (allowed GBP) where you can find them, and an optional wind check =================
(() => {
  // ---- "Site limits" section near the top of the left panel: allowed ground bearing, utilisation limit, how mats count
  const gbcEl = $("gbc"), row = gbcEl?.closest(".row"), mr = $("matRule")?.closest("label"), items = $("obsList")?.closest(".sec");
  if (row && items) {
    const sec = document.createElement("div"); sec.className = "sec"; sec.id = "siteLimits";
    sec.innerHTML = `<h3>Site limits</h3><p class="small" style="margin:0 0 6px">Allowed ground bearing for the whole site – a crane standing on different ground can have its own value (crane panel → Ground bearing).</p>`;
    sec.append(row);
    const tb = document.createElement("label"); tb.className = "chk"; tb.style.cssText = "display:flex;flex-direction:row;align-items:center;gap:6px;font-weight:400;margin:2px 0 6px";
    tb.innerHTML = `<input type="checkbox" id="gbcTbc" style="width:auto;margin:0"> Value not confirmed yet – show it as TBC on the sheets`; sec.append(tb);
    const cb = tb.querySelector("input"); cb.checked = !!plan.site?.gbcTbc; cb.onchange = () => { if (cb.checked) plan.site.gbcTbc = true; else delete plan.site.gbcTbc; markDirty(); renderAll(true); };
    { const _rm = renderMeta; renderMeta = function (...a) { const r = _rm.apply(this, a); try { cb.checked = !!plan.site?.gbcTbc; } catch (e) { } return r; }; }
    if (mr) sec.append(mr);
    row.querySelector("label").firstChild.textContent = "Allowed GBP (t/m²)";
    items.parentNode.insertBefore(sec, items);
  }
  // ---- checks panel: "set allowed GBP…" right where the GBP is shown
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-setgbc]"); if (!b) return;
    if (!sel || sel.kind !== "crane") { sel = { kind: "crane", id: b.dataset.setgbc }; renderPanels(); renderSite(); }
    setTimeout(() => { const el = $("pGbc") || $("gbc"); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.focus(); } }, 60);
  });
  const css = document.createElement("style"); css.textContent = `button.lnk{background:none;border:0;padding:0;color:var(--accent,#d9661f);text-decoration:underline;cursor:pointer;font:inherit}`; document.head.append(css);
})();

// ---- wind (optional): the crane's chart wind limit, adjusted for a big load (EN 13000 / manufacturer method), against the forecast
// v_allowed = v_chart × √(1.2 m²/t × hook load ÷ wind area), never above the chart value; wind area = projected area × shape factor
function loadWindArea(ld) {
  if (!ld) return 0; if (+ld.windA > 0) return +ld.windA;
  const d = loadDims(ld), round = ["tank", "cyl", "reel", "silo"].includes(ld.kind), cw = round ? 0.8 : 1.2;
  return Math.round(Math.max(d.x * d.z, d.y * d.z) * cw * 10) / 10;
}
function windCheck(cr, S) {
  const vt = +cr.windMax || 0; if (!(vt > 0)) return null;
  const ld = plan.loads.find(l => l.id === cr.attach?.load), A = loadWindArea(ld), mH = S.TW || 0;
  const k = A > 0 && mH > 0 ? Math.min(1, Math.sqrt(1.2 * mH / A)) : 1, lim = Math.round(vt * k * 10) / 10, now = +cr.windNow || 0;
  const lvl = !now ? "na" : now > lim ? "bad" : now > (rule("wind.amber") ?? 80) / 100 * lim ? "amber" : "ok";
  const txt = `limit ${fx(lim, 1)} m/s${k < 1 ? ` (chart ${fx(vt, 1)} m/s, reduced for the ${fx(A, 0)} m² load)` : " (chart)"}${now ? ` · forecast ${fx(now, 1)} m/s` : ""}`;
  return { lim, now, lvl, txt, A, k };
}
{ const _cs = craneSummary; craneSummary = function (cr) {
    const S = _cs(cr); try { const w = windCheck(cr, S); if (w) { S.wind = w;
      if (w.lvl === "bad") S.warn.push(`${cr.label}: forecast wind ${fx(w.now, 1)} m/s is over the ${fx(w.lim, 1)} m/s limit for this lift – do not lift`);
      else if (w.lvl === "amber") S.warn.push(`${cr.label}: forecast wind ${fx(w.now, 1)} m/s is close to the ${fx(w.lim, 1)} m/s limit – monitor at the boom tip`); } } catch (e) { console.warn(e); }
    return S; }; }
// crane panel: allowed GBP for this crane, and the wind fields (all optional)
{ const _rp = renderProps; renderProps = function (...a) {
    const r = _rp.apply(this, a);
    try {
      const c = sel?.kind === "crane" ? plan.cranes.find(x => x.id === sel.id) : null, C = c && REG.cranes[c.model]; if (!c || !C) return r;
      const h = [...document.querySelectorAll("#props h4, #props details.psec > summary")].find(x => /Ground bearing/.test(x.textContent)), box = h && h.tagName === "SUMMARY" ? h.parentNode : h;
      if (h && C.type !== "ped" && !$("pGbc")) {
        const d = document.createElement("div");
        d.innerHTML = `<label>Allowed GBP here (t/m²)<input type="number" id="pGbc" step="0.5" min="0" value="${+c.gbc > 0 ? c.gbc : ""}" placeholder="${+plan.site.gbc > 0 ? fx(+plan.site.gbc, 1) + " – site value" : "not set – enter the allowed value"}"></label>`;
        const tw = C.type === "cr" ? "track" : "outrigger";
        d.innerHTML += `<label>Max ${tw} reaction from manufacturer (t)<input type="number" id="pReact" step="0.1" min="0" value="${+c.oReact > 0 ? c.oReact : ""}" placeholder="blank = 0.75 × GAW estimate"></label><label>Source<input type="text" id="pReactSrc" value="${escH(c.oSrc || "")}" placeholder="e.g. LICCON, Crane Planner 2.0, date"></label><p class="small" style="margin:0 0 6px">For this exact set-up (boom, counterweight, radius, slew range). GBP = reaction ÷ ${C.type === "cr" ? "area of the mats under one track" : "area of one mat"}.</p>`;
        h.after(d);
        const cur = () => plan.cranes.find(x => x.id === c.id) || c;
        $("pReact").onchange = e => { const v = +e.target.value, k = cur(); if (v > 0) k.oReact = v; else delete k.oReact; markDirty(); renderAll(true); };
        $("pReactSrc").onchange = e => { const v = e.target.value.trim(), k = cur(); if (v) k.oSrc = v; else delete k.oSrc; markDirty(); renderAll(true); };
        $("pGbc").onchange = e => { const v = +e.target.value; if (v > 0) c.gbc = v; else delete c.gbc; if (typeof matEffCache !== "undefined") matEffCache.clear(); markDirty(); renderAll(true); };
      }
      if (h && !$("pWind")) {
        const ld = plan.loads.find(l => l.id === c.attach?.load), w = windCheck(c, craneSummary(c));
        const det = document.createElement("details"); det.id = "pWind"; det.className = "psec"; if (+c.windMax > 0) det.open = true;
        det.innerHTML = `<summary><b>Wind</b> <span class="small">optional${w ? ` · limit ${fx(w.lim, 1)} m/s` : ""}</span></summary>
          <div class="row"><label>Chart wind limit (m/s)<input type="number" id="pWindMax" step="0.1" min="0" value="${c.windMax || ""}" placeholder="from the load chart"></label><label>Forecast / measured (m/s)<input type="number" id="pWindNow" step="0.1" min="0" value="${c.windNow || ""}" placeholder="gust at boom tip"></label></div>
          ${ld ? `<label>Load wind area (m²)<input type="number" id="pWindA" step="0.5" min="0" value="${ld.windA || ""}" placeholder="${fx(loadWindArea({ ...ld, windA: 0 }), 1)} – estimated"></label>` : ""}
          <p class="small" style="margin:2px 0 6px">${w ? escH(w.txt) + "." : "Leave blank to skip the wind check."} A large load lowers the limit: chart value × √(1.2 × hook load ÷ wind area).</p>`;
        box.parentNode.insertBefore(det, box);
        const set = (k, el, obj) => { el.onchange = () => { const v = +el.value; if (v > 0) obj[k] = v; else delete obj[k]; markDirty(); renderAll(true); }; };
        set("windMax", $("pWindMax"), c); set("windNow", $("pWindNow"), c); if ($("pWindA")) set("windA", $("pWindA"), ld);
      }
    } catch (e) { console.warn(e); }
    return r;
  }; }
// no utilisation limit: a lift is fine up to 100 % of the chart (older plans saved with 75 % are opened at 100 %)
{ const _ra = renderAll; renderAll = function (...a) { if (plan?.site && plan.site.ulim !== 100) plan.site.ulim = 100; return _ra.apply(this, a); }; }
// crawler on mats: the mats must carry the whole track. If they cover only part of the track's ground contact,
// the rest of the track sits on bare ground – say so (the GBP above only counts the mats).
function matCoverage(cr, C) {
  C = C || REG.cranes[cr.model]; if (!C || C.type !== "cr") return null;
  const mats = matsUnderCrane(cr, C); if (!mats.length) return null;
  const P = mats.map(m => obsPts(m)), tl = trackContact(cr, C), k = C.car, out = [];
  for (const sx of [-1, 1]) { let n = 0, inn = 0; for (let y = -tl / 2 + 0.05; y <= tl / 2 - 0.05; y += 0.1) { n++; const p = craneLocalToWorld(cr, [sx * k.gauge / 2, y]); if (P.some(q => inPolyPt(p, q))) inn++; }
    out.push({ side: sx < 0 ? "left" : "right", cov: n ? inn / n * tl : 0 }); }
  const w = out.reduce((a, b) => a.cov <= b.cov ? a : b); return { tl, cov: w.cov, side: w.side };
}
{ const _cs = craneSummary; craneSummary = function (cr) {
    const S = _cs(cr);
    try { const m = matCoverage(cr, S.C); if (m && m.cov < m.tl - (rule("mats.short") ?? 0.15)) { S.matShort = m; S.warn.push(`${cr.label}: the mats cover only ${fx(m.cov, 1)} m of the ${fx(m.tl, 1)} m track ground contact (${m.side} track) – the rest of the track is on bare ground. Lay mats along the full track length.`); if (S.status === "ok") S.status = "amber"; } } catch (e) { console.warn(e); }
    return S; }; }
