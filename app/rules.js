// ================= Rules & limits – the numbers the checks use, as data you can see and change =================
// Every limit the app checks against lives here with where it comes from. Change a value (and say why / from what)
// and every check, sheet and calculation follows. Values are kept with your libraries (master data / backups).
// A plan can still set its own value where the plan has a field for it (e.g. DAF, crane utilisation, vehicle gap).
// Equipment-specific rules (e.g. a spreader maker's angle limits and load table) live on the item in the rigging library.
const RULES = [
  { id: "rig.green", group: "Rigging", label: "Rigging items are kept in the green up to", value: 80, unit: "% of their rating", min: 1, max: 100, step: 1 },
  { id: "rig.daf", group: "Rigging", label: "Dynamic factor (DAF) – used unless the plan or load sets its own", value: 1.1, unit: "×", min: 1, max: 3, step: 0.05 },
  { id: "rig.legMax", group: "Rigging", label: "Sling legs – largest angle from vertical", value: 45, unit: "°", min: 0, max: 89, step: 1 },
  { id: "rig.legHard", group: "Rigging", label: "Sling legs – never more than (longer slings or a spreader)", value: 60, unit: "°", min: 0, max: 89, step: 1 },
  { id: "rig.dropMax", group: "Rigging", label: "Drops under a spreader – largest angle from vertical", value: 30, unit: "°", min: 0, max: 89, step: 1 },
  { id: "tt.top", group: "Tandem lifts", label: "Top and tail – the top crane is checked for at least", value: 100, unit: "% of the load (+ rigging)", min: 0, max: 100, step: 5 },
  { id: "tt.tail", group: "Tandem lifts", label: "Top and tail – the tailing crane is checked for at least", value: 75, unit: "% of the load (+ rigging)", min: 0, max: 100, step: 5 },
  { id: "crane.util", group: "Cranes", label: "Crane utilisation limit – used unless the plan sets its own", value: 100, unit: "% of chart capacity", min: 1, max: 100, step: 1 },
  { id: "ground.manhole", group: "Ground", label: "Outrigger pads / tracks – keep clear of manholes and pits by", value: 1.0, unit: "m", min: 0, max: 20, step: 0.1 },
  { id: "ground.drain", group: "Ground", label: "Outrigger pads / tracks – warn within this distance of an underground drain", value: 1.5, unit: "m", min: 0, max: 20, step: 0.1 },
  { id: "ground.edge", group: "Ground", label: "Outrigger pads / tracks – keep back from a quay or deck edge by", value: 2.0, unit: "m", min: 0, max: 20, step: 0.1 },
  { id: "mats.short", group: "Ground", label: "Mats may fall short of the track's ground contact by up to", value: 0.15, unit: "m", min: 0, max: 5, step: 0.05 },
  { id: "wind.amber", group: "Wind", label: "Warn when the forecast wind reaches", value: 80, unit: "% of the lift's wind limit", min: 1, max: 100, step: 1 },
  { id: "spmt.capLine", group: "Transport", label: "SPMT axle line rating – used when the SPMT has no rating of its own", value: 40, unit: "t per axle line", min: 1, max: 200, step: 1 },
  { id: "site.minClear", group: "Site", label: "Gap between the crane and vehicles – used unless the plan sets its own", value: 0.6, unit: "m", min: 0, max: 10, step: 0.1 }
];
const RULE_DEF_SRC = "LiftPlan Studio default";
let ruleOver = {}, ruleLocalAt = {};   // id → { value, src, updated } · when each was last changed here
const ruleDef = id => RULES.find(r => r.id === id);
function rule(id) { const o = ruleOver[id], d = ruleDef(id); return o && isFinite(+o.value) && o.value !== "" ? +o.value : d ? d.value : null; }
function ruleSrc(id) { const o = ruleOver[id]; return o && o.value !== "" && o.value != null ? (o.src || "set by you") : RULE_DEF_SRC; }
// stored with the libraries
const RULES_LS = "liftplan-rules";
function rulesLoadLocal() { try { return JSON.parse(localStorage.getItem(RULES_LS) || "{}") || {}; } catch (e) { return {}; } }
ruleOver = rulesLoadLocal();
if (typeof CAP !== "undefined" && CAP.db) { try { CAP.db.collection("rules").onSnapshot(s => { const o = {}; s.docs.forEach(d => o[d.id] = d.data());
      for (const [id, t] of Object.entries(ruleLocalAt)) if (Date.now() - t < 5000) { if (ruleOver[id]) o[id] = ruleOver[id]; else delete o[id]; }   // a change just made here wins over an older copy still arriving
      ruleOver = o; try { localStorage.setItem(RULES_LS, JSON.stringify(o)); } catch (e) { } if ($("dRules")?.open) renderRules(); try { renderAll(true); } catch (e) { } }, e => console.warn(e)); } catch (e) { console.warn(e); } }
async function ruleSet(id, value, src) {
  ruleLocalAt[id] = Date.now();
  const doc = { value: value === "" || value == null ? "" : +value, src: String(src || "").trim(), updated: Date.now() };
  if (doc.value === "") { delete ruleOver[id]; try { if (CAP.db) await CAP.db.doc("rules/" + id).delete(); } catch (e) { } }
  else { ruleOver[id] = doc; try { if (CAP.db) await CAP.db.doc("rules/" + id).set(doc); } catch (e) { console.warn(e); } }
  try { localStorage.setItem(RULES_LS, JSON.stringify(ruleOver)); } catch (e) { }
  try { renderAll(true); } catch (e) { }
}
// ---------- the window ----------
(() => {
  if ($("dRules")) return;
  const d = document.createElement("dialog"); d.id = "dRules";
  d.innerHTML = `<div class="dh"><b>Rules & limits</b><button data-close>Close</button></div><div class="db"><p class="small">The limits every check in the app uses. Change a value and say where it comes from – the checks, sheets and calculations follow straight away. Clear a value to go back to the default. Limits that belong to one piece of equipment (a spreader's load table, its angle limits) are on that item in the rigging library.</p><div id="rulesBody"></div></div>`;
  document.body.append(d); d.querySelector("[data-close]").onclick = () => d.close();
})();
function renderRules() {
  const groups = [...new Set(RULES.map(r => r.group))];
  $("rulesBody").innerHTML = groups.map(g => `<div class="bsub" style="margin-top:10px">${escH(g)}</div><table class="rctab" style="width:100%"><tr><th>Rule</th><th class="n">Value</th><th>Where it comes from</th><th></th></tr>${RULES.filter(r => r.group === g).map(r => { const o = ruleOver[r.id], set = o && o.value !== "";
    return `<tr data-rule="${r.id}"><td>${escH(r.label)}<div class="small">default ${fx(r.value, r.step < 1 ? 2 : 0)} ${escH(r.unit)}</div></td>
      <td class="n" style="white-space:nowrap"><input type="number" data-rv min="${r.min}" max="${r.max}" step="${r.step}" style="width:84px" value="${set ? o.value : ""}" placeholder="${r.value}"> ${escH(r.unit)}</td>
      <td><input type="text" data-rs style="width:100%" value="${escH(set ? o.src || "" : "")}" placeholder="${set ? "e.g. client procedure, maker's letter" : RULE_DEF_SRC}"></td>
      <td>${set ? `<button data-rclr>Reset</button>` : ""}</td></tr>`; }).join("")}</table>`).join("");
  $("rulesBody").querySelectorAll("[data-rule]").forEach(tr => { const id = tr.dataset.rule, v = tr.querySelector("[data-rv]"), s = tr.querySelector("[data-rs]");
    const save = () => ruleSet(id, v.value, s.value).then(renderRules);
    v.onchange = save; s.onchange = () => { if (v.value !== "") save(); };
    const c = tr.querySelector("[data-rclr]"); if (c) c.onclick = () => ruleSet(id, "", "").then(renderRules); });
}
function openRules() { renderRules(); $("dRules").showModal(); }
// where to find it: next to Master data in the Lift plans window
{ const row = $("bBackup")?.parentElement; if (row && !$("bRules")) { row.insertAdjacentHTML("beforeend", `<button id="bRules">Rules & limits…</button>`); $("bRules").onclick = () => { $("dPlans").close(); openRules(); }; } }
if (typeof MD_NAMES !== "undefined") MD_NAMES.rules = "rules & limits";
// carried with master data and backups
{ const _md = masterData; masterData = function (...a) { const d = _md.apply(this, a); try { d.rules = Object.entries(ruleOver).map(([id, o]) => ({ id, ...o })); } catch (e) { } return d; }; }
{ const _im = importMaster; importMaster = async function (d, ...a) { const n = await _im.call(this, d, ...a);
    try { let k = 0; for (const r of d?.rules || []) if (r && r.id && ruleDef(r.id)) { await ruleSet(r.id, r.value, r.src); k++; } if (n && k) n.rules = k; } catch (e) { console.warn(e); }
    return n; }; }
