// ================= One way for every check: what is wrong, the rule and where it comes from, and a fix =================
// Checks are still written by the part of the app that knows about them (crane, rigging, ground, vehicles …). This file
// gives every one of them the same shape wherever it is shown:
//   · the RULE it was checked against and where that rule comes from (Rules & limits, the plan, the maker's table, the
//     item's rating, the load data) – worked out from the check itself, so every check gets it, old and new;
//   · a FIX the app can make in one click when it knows the answer (move the vehicle out, size the item up, use the
//     maker's minimum sling …) – the part that raises the check registers it with chkFix(text, label, run).
// A fix is an ordinary change to the plan: Undo takes it back.
const CHK_FIX = new Map();   // check text → { label, run }
function chkFix(text, label, run, opt = {}) { if (text && typeof run === "function") CHK_FIX.set(text, { label, run, nav: !!opt.nav }); return text; }   // nav: only takes you to the place to change it
const chkRuleTxt = (id, planVal, planWhere) => planVal ? `this plan's own value (${planWhere})` : `${ruleDef(id)?.label} ${fx(rule(id), (ruleDef(id)?.step || 1) < 1 ? 2 : 0)} ${ruleDef(id)?.unit || ""} – ${ruleSrc(id)}`;
// which rule a check was made against, from its wording
const CHK_RULES = [
  [/utilisation .*(over the crane's capacity|over capacity)|over capacity$|no chart capacity|no capacity/i, () => "The crane's load chart (crane panel → load chart)"],
  [/utilisation|over the \d+% limit/i, () => chkRuleTxt("crane.util", +plan.site?.ulim > 0, "Site limits")],
  [/too close to the crane|clash with the crane/i, () => chkRuleTxt("site.minClear", +plan.site?.minClear > 0, "Site limits → min. clearance")],
  [/SL ballast .* hits|hits .* while slewing/i, () => "The superlift ballast swing from the crane set-up (radius and height off the ground) against the site items"],
  [/superlift swing/i, () => "Superlift radius from the crane set-up, plus 1.5 m"],
  [/ground bearing .* allowed|t\/m².* allowed|over the .* t\/m² allowed/i, () => `Allowed ground bearing ${fx(+plan.site?.gbc || 0, 1)} t/m² – this plan (Site limits, or the crane's own value)${plan.site?.gbcTbc ? " · not confirmed yet (TBC)" : ""}`],
  [/manhole|pit \(/i, () => chkRuleTxt("ground.manhole")],
  [/underground drain/i, () => chkRuleTxt("ground.drain")],
  [/edge/i, () => chkRuleTxt("ground.edge")],
  [/mats cover only/i, () => chkRuleTxt("mats.short")],
  [/forecast wind .*close to/i, () => `${chkRuleTxt("wind.amber")} · limit from the crane's chart wind speed (crane panel → Wind)`],
  [/forecast wind/i, () => "The crane's chart wind speed, reduced for the load's wind area (crane panel → Wind)"],
  [/per axle line/i, () => `The SPMT's axle line rating – or, if it has none, ${chkRuleTxt("spmt.capLine")}`],
  [/payload – overloaded/i, () => "The vehicle's payload (its settings)"],
  [/drops spread .* across, but/i, () => "The load's lifting points across (load data)"],
  [/not yet marked as checked/i, () => "Every load chart is checked against the manufacturer's data sheet before the plan is used"],
  [/base mass .* not confirmed/i, () => "Crane mass from the manufacturer – needed for ground bearing and GAW"],
  [/× DAF .* go up a size/i, x => `DAF ${fx(+((x.match(/DAF ([\d.]+)/) || [])[1] || 0), 2)} – ${+plan.site?.rigDaf > 0 ? "this plan's value (rigging calculation)" : ruleSrc("rig.daf")} · the item's rated WLL (rigging library)`],
  [/is over its [\d.]+ t SWL/i, () => "The item's rated WLL (rigging library / its certificate)"],
  [/drops .*from vertical – over|drops [\d.]+° from vertical/i, () => chkRuleTxt("rig.dropMax")],
  [/never|longer slings or a spreader/i, () => chkRuleTxt("rig.legHard")],
  [/from vertical – over \d+°|° from vertical is over|keep within \d+°/i, () => chkRuleTxt("rig.legMax")]
];
// a maker's table check: named after the table's model
function chkTableRule(t) {
  try { for (const it of rigLibrary()) { const T = it.table || (typeof tableOf === "function" ? tableOf({ id: it.id }) : null); if (!T) continue; const nm = tName(T);
      if (t.startsWith(nm + ":") || t.startsWith(nm + " (")) return `${nm} – maker's table${T.src ? ": " + T.src : ""} (rigging library → this item → Maker's load table)`; } } catch (e) { }
  return null;
}
function chkInfo(t) {
  const fix = CHK_FIX.get(t) || null; let rule = chkTableRule(t);
  if (!rule) for (const [re, f] of CHK_RULES) if (re.test(t)) { try { rule = f(t); } catch (e) { rule = null; } break; }
  return { rule, fix };
}
function chkHTML(t) {
  const i = chkInfo(t);
  return `${escH(t)}${i.rule ? `<div class="chkr">Rule: ${escH(i.rule)}</div>` : ""}${i.fix ? `<button class="chkfix" data-chkfix="${escH(t)}">${escH(i.fix.label)}</button>` : ""}`;
}
// one click: the fix, then everything recalculated (Undo takes it back)
document.addEventListener("click", e => {
  const b = e.target.closest("[data-chkfix]"); if (!b) return; e.preventDefault(); e.stopPropagation();
  const f = CHK_FIX.get(b.dataset.chkfix); if (!f) { toast("That check has changed – look again"); return; }
  try { f.run(); if (f.nav) return; CHK_FIX.delete(b.dataset.chkfix); markDirty(); renderAll(); if ($("dRig")?.open && typeof renderRB === "function") renderRB(); toast("Done: " + f.label + " (Undo takes it back)"); } catch (err) { console.warn(err); toast("Couldn't do that (" + (err.message || err) + ")"); }
}, true);
{ const st = document.createElement("style"); st.textContent = `.chkr{font-size:11px;color:var(--muted);margin:1px 0 0}.chkfix{margin:3px 0 2px;padding:2px 8px;font-size:11.5px;border-radius:6px;border:1px solid var(--accent,#d9661f);background:transparent;color:var(--accent,#d9661f);cursor:pointer}.chkfix:hover{background:var(--accent,#d9661f);color:#fff}`; document.head.append(st); }
// every list of checks in the app shows the rule and the fix
warnBlock = function (list) {
  const L = [...new Set((list || []).filter(Boolean))]; if (!L.length) return "";
  const g = { bad: [], check: [], info: [] }; L.forEach(t => g[sevOf(t)].push(t));
  const li = (a, col) => a.map(t => `<li style="color:${col}">${chkHTML(t)}</li>`).join("");
  return `<div class="sevw">${g.bad.length ? `<div class="sevh bad">Must fix (${g.bad.length})</div><ul>${li(g.bad, "var(--bad)")}</ul>` : ""}
    ${g.check.length ? `<details ${g.bad.length ? "" : "open"}><summary class="sevh amber">Check (${g.check.length})</summary><ul>${li(g.check, "var(--ink)")}</ul></details>` : ""}
    ${g.info.length ? `<details><summary class="sevh info">Info (${g.info.length})</summary><ul>${li(g.info, "var(--muted)")}</ul></details>` : ""}</div>`;
};
// the rigging windows show their checks the same way
{ const _rr = typeof renderRB === "function" ? renderRB : null; if (_rr) renderRB = function (...a) { const r = _rr.apply(this, a);
    try { document.querySelectorAll('#dRig p.small[style*="var(--bad)"], #dRig .engw').forEach(p => { if (p.dataset.chk) return; const t = p.textContent.replace(/^⚠\s*/, ""); if (!chkInfo(t).rule && !CHK_FIX.has(t)) return; p.dataset.chk = 1; p.innerHTML = (p.classList.contains("engw") ? "⚠ " : "") + chkHTML(t); }); } catch (e) { }
    return r; }; }

// ---------------- the fixes the app can make ----------------
// rigging: an item over its rating, or over it once the DAF is on → the smallest item of the same kind that keeps it in the green
{ const _sr = solveRig; solveRig = function (ld, ...a) {
    const r = _sr.call(this, ld, ...a);
    try { if (!r || !r.rows || !(r.warn || []).length) return r; const daf = rcDaf(ld), lib = rigLibrary();
      for (const w of r.warn) { if (!/is over its [\d.]+ t SWL|go up a size/.test(w)) continue;
        const x = r.rows.find(q => q.name && w.startsWith(q.name)); if (!x || !x.entry || x.type === "spreader") continue;
        const hf = x.swl && x.baseSwl ? x.swl / x.baseSwl : 1, need = x.load * daf / (RIG_GREEN / 100), fam = typeof rigFamily === "function" ? rigFamily(x.entry.snap?.name || x.name) : null;
        const c0 = lib.filter(i => i.type === x.type && (+i.swl || 0) * hf >= need - 1e-9).sort((a, b) => a.swl - b.swl), it = (fam ? c0.find(i => rigFamily(i.name) === fam) : null) || c0[0];
        if (!it || it.id === x.entry.id) continue; const e = x.entry;
        chkFix(w, `Change to ${it.name} (${fx(it.swl * hf, 1)} t)`, () => { for (const e2 of x.entries || [e]) { const n = rigEntry(it); e2.id = n.id; e2.snap = n.snap; if (!RIG_TYPES[it.type]?.sling) e2.len = n.len; } });
      }
      // a maker's table: the top sling shorter than the maker's minimum → the next sling length up from the minimum
      for (const w of r.warn) { const m = w.match(/top sling ([\d.]+) m is too short – the maker's minimum .* is ([\d.]+) m/); if (!m) continue;
        const R = ld.rig, C = R.chain || [], iB = C.findIndex(e => e?.snap?.type === "spreader"), want = +m[2], step = typeof slStep === "function" ? slStep() : 0.5, L = Math.ceil(want / step - 1e-9) * step;
        const above = (w.includes("(cross spreader)") || w.includes("(lower beam)")) ? C.slice(0, C.indexOf(R.beam2)) : (iB >= 0 ? C.slice(0, iB) : [].concat(R.top || [], R.leg || []));
        const ts = above.filter(e => RIG_TYPES[e?.snap?.type]?.sling && Math.abs(+e.len - +m[1]) < 0.06).pop(); if (ts) chkFix(w, `Use ${fx(L, 1)} m slings`, () => { ts.len = L; }); }
      // the beam's own drop spread doesn't match the load → follow the load's lifting points
      for (const w of r.warn) { if (!/drops spread .* across, but the load's lifting points/.test(w)) continue; const R = ld.rig;
        chkFix(w, "Follow the load's lifting points", () => { for (const e of [R.beam, R.beam2, ...(R.chain || [])]) if (e?.cfg && "dropY" in e.cfg) e.cfg.dropY = ""; if (!(R.chain || []).length) R.dropY = ""; }); }
    } catch (e) { console.warn(e); }
    return r; }; }
// cranes: vehicles moved clear, the chart marked as checked, straight to the field that needs a value
{ const _cs = craneSummary; craneSummary = function (cr, ...a) {
    const S = _cs.call(this, cr, ...a);
    try { if (!S || !S.warn) return S; const goCrane = (focusId) => () => { sel = { kind: "crane", id: cr.id }; renderPanels(); renderSite(); if (focusId) setTimeout(() => { const el = $(focusId); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.focus(); } }, 80); };
      for (const w of S.warn) {
        const mv = w.match(/^(.+?): (too close to the crane|clash with the crane).*move it ~([\d.]+) m out/);
        if (mv && typeof vcGaps === "function") { const v = plan.obstacles.find(o => vcIsVehicle(o) && (o.label || OBJ_TYPES[o.type]?.name || "Vehicle") === mv[1] && (typeof itemInLift !== "function" || itemInLift(o))); if (v) {
            // straight out from the crane until every part of it is the minimum gap away (tracks, mats, pads, counterweight swing)
            const c = centroid(obsPts(v)), L = Math.hypot(c[0] - cr.x, c[1] - cr.y) || 1, ux = (c[0] - cr.x) / L, uy = (c[1] - cr.y) / L, x0 = v.x, y0 = v.y, m = vcMin();
            const ok = () => (vcGaps(v, cr) || []).filter(g => g.kind !== "sl").every(g => g.d >= m - 1e-6);
            let t = null; try { for (let k = 1; k <= 800; k++) { v.x = x0 + ux * k * 0.05; v.y = y0 + uy * k * 0.05; if (ok()) { t = k * 0.05; break; } } } finally { v.x = x0; v.y = y0; }
            if (t != null) chkFix(w, `Move ${mv[1]} ${fx(t, 2)} m straight out from the crane`, () => { v.x = x0 + ux * t; v.y = y0 + uy * t; if (typeof trSaveAt === "function") trSaveAt(); }); } }
        if (/not yet marked as checked/.test(w) && S.chart) chkFix(w, "I've checked it against the data sheet – mark as checked", () => { plan.site.chartOk = plan.site.chartOk || {}; plan.site.chartOk[S.chart.id] = true; });
        if (/ground bearing .* allowed/.test(w)) chkFix(w, "Show the crane's ground bearing", goCrane("pGbc"), { nav: true });
        if (/base mass .* not confirmed/.test(w)) chkFix(w, "Enter the crane mass", goCrane(null), { nav: true });
        if (/mats cover only/.test(w)) chkFix(w, "Show the crane's mats", goCrane(null), { nav: true });
      }
    } catch (e) { console.warn(e); }
    return S; }; }
