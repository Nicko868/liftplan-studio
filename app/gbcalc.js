// ================= Ground bearing calculator – a quick check beside the plan, not a separate tool =================
// Pressure on the ground = load on the ground ÷ area that carries it, against what the ground is allowed (t/m²).
// Opened from a crane (checks panel / crane panel) it starts from that crane's numbers – the same bearing load and the
// same counted mat area the lift plan uses – so it never disagrees with the plan. Change the mats to see what works,
// then put them on the crane with one click. Opened on its own it is a blank quick check (a pad, a mat, a stack of ballast).
const GBC = { cr: null };
(() => {
  if ($("dGbc")) return;
  const d = document.createElement("dialog"); d.id = "dGbc"; d.style.cssText = "width:min(760px,96vw)";
  d.innerHTML = `<div class="dh"><b>Ground bearing</b><span class="small" id="gbcSub" style="margin-left:8px"></span><span style="flex:1"></span><button data-close>Close</button></div><div class="db" id="gbcBody"></div>`;
  document.body.append(d); d.querySelector("[data-close]").onclick = () => d.close();
  const st = document.createElement("style"); st.textContent = `#gbcBody .gbrow{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}#gbcBody .gbres{display:grid;grid-template-columns:1fr 1.3fr;gap:12px;align-items:center;margin:10px 0}
#gbcBody .gbq{font-size:34px;font-weight:700;font-variant-numeric:tabular-nums}#gbcBody .gbq small{font-size:14px;font-weight:400;color:var(--muted)}
#gbcBody .gbbar{position:relative;height:10px;border-radius:5px;background:var(--line,#dde3e8);margin:8px 0 2px;overflow:visible}#gbcBody .gbbar i{display:block;height:100%;border-radius:5px}#gbcBody .gbbar b{position:absolute;top:-4px;width:2px;height:18px;background:var(--ink)}
#gbcBody .gbsay{font-weight:600;margin:6px 0 2px}#gbcBody .gbf{color:var(--muted);font-size:12px;font-family:ui-monospace,monospace}#gbcBody .gbopt{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}`;
  document.head.append(st);
})();
// what the plan says for this crane: the load it puts on the ground and the mats it stands on
function gbcFromCrane(cr) {
  const C = REG.cranes[cr.model], S = craneSummary(cr), M = S.mat || matInfo(cr, C), crw = C?.type === "cr", m0 = (M.mats || [])[0], LW = m0 ? matLW(m0) : null;
  const under = crw && M.mats?.length ? Math.max(1, Math.round(M.mats.length / 2)) : 1;
  return { mode: crw ? "track" : "pad", F: Math.round((+S.gbpLoad || 0) * 100) / 100, Fsrc: S.react ? `max ${crw ? "track" : "outrigger"} reaction from the manufacturer` : "0.75 × gross applied weight (crane, counterweight, load, rigging)",
    n: m0 ? (crw ? under : 1) : 0, L: LW ? +LW[0].toFixed(2) : (crw ? 6 : 2.5), W: LW ? +LW[1].toFixed(2) : (crw ? 1.2 : 2.5), ori: cr.matOri === "perp" ? "perp" : "par",
    contact: crw ? +trackContact(cr, C).toFixed(2) : 0, shoe: crw ? +(C.car?.shoe || 1.2) : 0, pad: !crw && C?.or ? +((C.or.float) || 0.6) : 0, q: +gbcFor(cr) || 0, appA: +S.matA || 0, appQ: S.gbp };
}
function openGbc(cr) {
  GBC.cr = cr || null; GBC.v = cr ? gbcFromCrane(cr) : { mode: "free", F: 50, Fsrc: "", n: 1, L: 2, W: 2, ori: "par", contact: 0, shoe: 0, pad: 0, q: +plan.site?.gbc || 0, appA: 0 };
  $("gbcSub").textContent = cr ? (cr.label || REG.cranes[cr.model]?.short || "crane") : "quick check"; renderGbc(); $("dGbc").showModal();
}
// the area that carries the load – counted the way the lift plan counts it
function gbcArea(v) {
  if (v.mode === "track") { if (!(v.n > 0)) return { A: v.contact * v.shoe, how: `track ${fx(v.contact, 2)} m contact × ${fx(v.shoe, 2)} m shoe (no mats)` };
    // mats end to end under the track: only the length alongside the track's ground contact counts
    const pitch = v.ori === "par" ? v.L : v.W, across = v.ori === "par" ? v.W : v.L, along = Math.min(v.n * pitch, v.contact);
    return { A: along * across, how: `${fx(along, 2)} m along the track${v.n * pitch > v.contact + 0.01 ? ` (${v.n} × ${fx(pitch, 2)} m of mat, but only the ${fx(v.contact, 2)} m track contact counts)` : ` (${v.n} × ${fx(pitch, 2)} m)`} × ${fx(across, 2)} m across` }; }
  if (v.mode === "pad" && !(v.n > 0)) { const A = Math.PI * v.pad * v.pad / 4; return { A, how: `outrigger pad Ø${fx(v.pad, 2)} m (no mat)` }; }
  return { A: Math.max(1e-6, (v.n || 1) * v.L * v.W), how: `${v.mode === "free" && (v.n || 1) > 1 ? (v.n + " × ") : ""}${fx(v.L, 2)} × ${fx(v.W, 2)} m` };
}
function renderGbc() {
  const v = GBC.v, a = gbcArea(v), q = v.F / a.A, ok = v.q > 0 ? q <= v.q + 1e-9 : null, ratio = v.q > 0 ? q / v.q : null;
  const col = ok == null ? "var(--muted)" : ok ? (ratio > 0.9 ? "var(--amber,#b26a00)" : "var(--ok,#1e7a3c)") : "var(--bad,#b42318)";
  // what would work: the area needed, and the mats that give it
  const need = v.q > 0 ? v.F / v.q : null, opts = [];
  if (need && v.mode === "track" && v.contact > 0) {   // cover the whole track contact, and make the mats wide / long enough across it
    const acrossNeed = Math.ceil(need / v.contact * 10) / 10;
    if (v.ori === "par") { const n = Math.ceil(v.contact / v.L - 1e-9); opts.push({ n, L: v.L, W: Math.max(v.W, acrossNeed), txt: `${n} × ${fx(v.L, 1)} m mat${n > 1 ? "s" : ""} along each track, ${fx(Math.max(v.W, acrossNeed), 1)} m wide` }); }
    else { const n = Math.ceil(v.contact / v.W - 1e-9); opts.push({ n, L: Math.max(v.L, acrossNeed), W: v.W, txt: `${n} × ${fx(v.W, 1)} m wide mats across each track, ${fx(Math.max(v.L, acrossNeed), 1)} m long` }); }
    if (need / v.contact > (v.ori === "par" ? v.W : v.L) + 0.01) opts.push({ ori: v.ori === "par" ? "perp" : "par", n: v.ori === "par" ? Math.ceil(v.contact / v.W - 1e-9) : Math.ceil(v.contact / Math.max(v.L, 0.5) - 1e-9), L: v.ori === "par" ? Math.max(acrossNeed, v.L) : v.L, W: v.ori === "par" ? v.W : Math.max(acrossNeed, v.W), txt: `or lay them ${v.ori === "par" ? "across" : "along"} the tracks` }); }
  else if (need) { const s = Math.ceil(Math.sqrt(need / (v.mode === "free" ? (v.n || 1) : 1)) * 10) / 10; opts.push({ n: v.mode === "free" ? (v.n || 1) : 1, L: s, W: s, txt: `${v.mode === "free" && (v.n || 1) > 1 ? v.n + " × " : ""}${fx(s, 1)} × ${fx(s, 1)} m ${v.mode === "pad" ? "mat under each pad" : "mat"}` }); }
  const say = ok == null ? `Set the allowed ground bearing to compare (from the geotechnical report or the site).`
    : ok ? `${fx(q, 1)} t/m² is within the ${fx(v.q, 1)} t/m² allowed – ${fx(ratio * 100, 0)}% of it.`
    : `${fx(q, 1)} t/m² is ${fx(ratio, 1)} × the ${fx(v.q, 1)} t/m² allowed – it needs at least ${fx(need, 2)} m² under it.`;
  const f = (k, lab, val, step = 0.1, ext = "") => `<label>${lab}<input type="number" data-gb="${k}" step="${step}" min="0" value="${val ?? ""}" ${ext}></label>`;
  // the picture: the load, what it stands on, the ground pushing back (red where it is too much)
  const pic = (() => { const w = 300, h = 150, gy = 100, mw = Math.min(250, 60 + 120 * Math.sqrt(a.A) / Math.max(1, Math.sqrt(need || a.A))), x0 = (w - mw) / 2, c2 = ok === false ? "#c0392b" : "#1e7a3c";
    let s = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:340px"><rect x="0" y="${gy}" width="${w}" height="${h - gy}" fill="#c9b48a" opacity=".55"/>`;
    s += `<rect x="${x0}" y="${gy - 10}" width="${mw}" height="10" fill="#8b6b3e" stroke="#4d3a1f"/>`;
    s += `<rect x="${w / 2 - 22}" y="${gy - 36}" width="44" height="26" fill="#6b7682" stroke="#2e3640"/>`;
    s += `<line x1="${w / 2}" y1="6" x2="${w / 2}" y2="${gy - 40}" stroke="#e0701f" stroke-width="3"/><path d="M${w / 2 - 6} ${gy - 46} L${w / 2} ${gy - 36} L${w / 2 + 6} ${gy - 46}Z" fill="#e0701f"/><text x="${w / 2 + 8}" y="20" font-size="12" fill="currentColor">F = ${fx(v.F, 1)} t</text>`;
    for (let i = 0; i <= 8; i++) { const x = x0 + mw * i / 8; s += `<line x1="${x}" y1="${gy + 4}" x2="${x}" y2="${gy + 4 + Math.min(40, 14 * Math.max(0.6, ratio || 1))}" stroke="${c2}" stroke-width="1.6"/>`; }
    s += `<text x="${w / 2}" y="${h - 4}" font-size="11" text-anchor="middle" fill="currentColor">${fx(a.A, 2)} m² carries it</text></svg>`; return s; })();
  $("gbcBody").innerHTML = `
    <div class="gbrow">${f("F", "Load on the ground (t)", v.F, 0.1)}${f("q", "Allowed (t/m²)", v.q || "", 0.5, 'placeholder="from the site"')}
      ${v.mode === "track" ? f("n", "Mats under one track", v.n, 1) : v.mode === "pad" ? f("n", "Mat under each pad (0 = none)", v.n, 1, 'max="1"') : f("n", "Number of mats", v.n || 1, 1)}
      ${v.mode === "track" ? `<label>Laid<select data-gbori><option value="par" ${v.ori === "par" ? "selected" : ""}>along the tracks</option><option value="perp" ${v.ori === "perp" ? "selected" : ""}>across the tracks</option></select></label>` : "<span></span>"}
      ${f("L", "Mat length (m)", v.L)}${f("W", "Mat width (m)", v.W)}</div>
    ${v.Fsrc ? `<p class="small" style="margin:4px 0 0">Load on the ground: ${escH(v.Fsrc)} – the same figure the lift plan uses.</p>` : ""}
    <div class="gbres"><div><div class="gbq" style="color:${col}">${fx(q, 1)} <small>t/m²</small></div>
        ${v.q > 0 ? `<div class="gbbar"><i style="width:${Math.min(100, (ratio || 0) * 50)}%;background:${col}"></i><b style="left:50%" title="allowed"></b></div><div class="small" style="display:flex;justify-content:space-between"><span>0</span><span>allowed ${fx(v.q, 1)}</span><span>${ratio > 2 ? `off scale × ${fx(ratio, 1)}` : fx(v.q * 2, 0)}</span></div>` : ""}
        <div class="gbsay">${say}</div>
        <div class="gbf">pressure = load ÷ area = ${fx(v.F, 2)} ÷ ${fx(a.A, 2)} = ${fx(q, 2)} t/m²<br>area = ${escH(a.how)}${need ? `<br>area needed = ${fx(v.F, 2)} ÷ ${fx(v.q, 1)} = ${fx(need, 2)} m²` : ""}</div></div>
      <div>${pic}</div></div>
    ${ok === false && opts.length ? `<div><b>What would work</b><div class="gbopt">${opts.map((o, i) => `<button data-gbopt="${i}">${escH(o.txt)}</button>`).join("")}</div></div>` : ""}
    ${GBC.cr && (v.mode === "track" || v.mode === "pad") ? `<div class="btnrow" style="margin-top:10px"><button class="pri" id="gbcApply">Put these mats on the crane</button><span class="small">${v.appA && Math.abs(v.appA - a.A) > 0.02 * v.appA && v.n === gbcFromCrane(GBC.cr).n && v.L === gbcFromCrane(GBC.cr).L ? `The plan counts ${fx(v.appA, 2)} m² for the mats as laid.` : ""}</span></div>` : ""}`;
  $("gbcBody").querySelectorAll("[data-gb]").forEach(el => el.onchange = () => { const k = el.dataset.gb, x = +el.value; v[k] = isFinite(x) ? Math.max(0, k === "n" ? Math.round(x) : x) : v[k]; renderGbc(); });
  const o = $("gbcBody").querySelector("[data-gbori]"); if (o) o.onchange = () => { v.ori = o.value; renderGbc(); };
  $("gbcBody").querySelectorAll("[data-gbopt]").forEach(b => b.onclick = () => { const p = opts[+b.dataset.gbopt]; Object.assign(v, { n: p.n, L: p.L, W: p.W }, p.ori ? { ori: p.ori } : {}); renderGbc(); });
  const ap = $("gbcApply"); if (ap) ap.onclick = () => {
    const cr = GBC.cr; if (!cr) return; sel = { kind: "crane", id: cr.id }; renderPanels(); renderSite();
    setTimeout(() => { const set = (id, val) => { const el = $(id); if (el) el.value = val; }; set("pMatL", v.L); set("pMatW", v.W);
      if (v.mode === "track") { set("pMatN", v.n); set("pMatO", v.ori); const b = $("pMatLay"); if (b) b.click(); }
      else { const L = $("pMatL"); if (L) L.dispatchEvent(new Event("change")); if (!(matInfo(cr).mats || []).length) toast("Lay the mats under the pads in the crane panel – the size is filled in"); }
      if (+v.q > 0 && Math.abs(+v.q - (+gbcFor(cr) || 0)) > 1e-6) toast("The allowed ground bearing here was only for the check – set it in Site limits or the crane panel if it is the site's value", 4000);
      $("dGbc").close(); }, 60); };
}
// where you meet ground bearing in the app: a small "work it out" beside it
{ const _rc = renderChecks; renderChecks = function (...a) { const r = _rc.apply(this, a);
    try { document.querySelectorAll("#checks [data-setgbc]").forEach(b => { if (b.parentNode.querySelector("[data-gbcalc]")) return; b.insertAdjacentHTML("afterend", ` · <button class="lnk" data-gbcalc="${b.dataset.setgbc}">work it out…</button>`); }); } catch (e) { }
    return r; }; }
document.addEventListener("click", e => { const b = e.target.closest("[data-gbcalc]"); if (!b) return; e.preventDefault(); const cr = plan.cranes.find(c => c.id === b.dataset.gbcalc); openGbc(cr || null); });
// a ground bearing check that fails offers the calculator as its fix
{ const _cs = craneSummary; craneSummary = function (cr, ...a) { const S = _cs.call(this, cr, ...a);
    try { for (const w of S?.warn || []) if (/ground bearing .* allowed/.test(w) && typeof chkFix === "function") chkFix(w, "Work out the mats needed", () => openGbc(cr), { nav: true }); } catch (e) { }
    return S; }; }
