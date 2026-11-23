// ================= LiftPlan Studio =================
const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = o => JSON.parse(JSON.stringify(o));
const fx = (v, d = 1) => (v == null || isNaN(v)) ? "–" : (+v).toFixed(d);
const escH = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
function toast(msg, ms = 2600) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, ms); }
const COLORS = ["#1f5fa8", "#b0272b", "#1d7a4f", "#7a2bc2", "#b86a00"];

// ---------- capabilities ----------
const CAP = { db: null, assets: null, sample: null, downloads: null, sampleImages: null };
async function initCaps() {
  const use = n => (window.claude && window.claude.use) ? window.claude.use(n).catch(() => null) : Promise.resolve(null);
  if (typeof LOCAL !== "undefined" && LOCAL) { CAP.local = true; CAP.shared = typeof CLOUD !== "undefined" && !!CLOUD; CAP.db = LOCAL.db; CAP.assets = LOCAL.assets; CAP.downloads = LOCAL.downloads; CAP.sample = null; }
  else [CAP.db, CAP.assets, CAP.sample, CAP.downloads] = await Promise.all([use("db"), use("assets"), use("sample"), use("downloads")]);
  if (CAP.sample) { try { CAP.sampleImages = (await CAP.sample.limits()).images || null; } catch (e) { CAP.sampleImages = null; } }
  $("bgUpload").disabled = false;
  if (CAP.db) subscribeLibrary();
  refreshSaveState();
}

// ---------- registry ----------
const REG = { cranes: {}, charts: {} };   // charts: id -> chart {id, craneId, label, or, cw, slew, cols, builtin}
function rebuildRegistry(custom = [], dbCharts = []) {
  REG.cranes = {};
  for (const [k, c] of Object.entries(BUILTIN_CRANES)) REG.cranes[k] = c;
  for (const d of custom) { try { REG.cranes[d.id] = modelFromSpec({ ...d.spec, id: d.id }); } catch (e) { console.warn(e); } }
  REG.charts = {};
  for (const [cid, list] of Object.entries(BUILTIN_CHARTS)) list.forEach(ch => REG.charts[ch.id] = { ...ch, craneId: cid, builtin: true });
  for (const ch of dbCharts) REG.charts[ch.id] = ch;
}
const chartsFor = craneId => Object.values(REG.charts).filter(c => c.craneId === craneId);
let customCranes = [], customCharts = [];
function subscribeLibrary() {
  CAP.db.collection("cranes").onSnapshot(s => { customCranes = s.docs.map(d => ({ id: d.id, ...d.data() })); rebuildRegistry(customCranes, customCharts); renderAll(); if ($("dCranes").open) renderCraneTable(); }, e => console.warn(e));
  CAP.db.collection("charts").onSnapshot(s => { customCharts = s.docs.map(d => ({ id: d.id, ...d.data() })); rebuildRegistry(customCranes, customCharts); renderAll(); if ($("dCranes").open) renderCraneTable(); }, e => console.warn(e));
  CAP.db.collection("rigTemplates").onSnapshot(s => { rigTemplates = s.docs.map(d => ({ id: d.id, ...d.data() })); if ($("dRig").open) renderRB(); }, e => console.warn(e));
  CAP.db.collection("rigging").onSnapshot(s => { rigCustom = s.docs.map(d => ({ id: d.id, ...d.data() })); if ($("dRigLib").open) renderRL(); if ($("dRig").open) renderRB(); }, e => console.warn(e));
  CAP.db.collection("loadTemplates").onSnapshot(s => { loadTemplates = s.docs.map(d => ({ id: d.id, ...d.data() })); if ($("dLoad").open) renderLB(); }, e => console.warn(e));
  CAP.db.collection("plans").onSnapshot(s => { planIndex = s.docs.map(d => ({ id: d.id, ...d.data() })); if ($("dPlans").open) renderPlans(); }, e => console.warn(e));
}

// ---------- plan state ----------
function blankPlan() {
  const cranes = [], loads = [];
  return { id: uid(), name: "New lift plan", meta: { project: "", lift: "", date: new Date().toLocaleDateString("en-GB"), by: "", chk: "", notes: "" }, site: { bg: null, gbc: "", grid: true, ulim: 100 }, cranes, loads, lifts: [{ id: uid(), name: "Lift 1", cranes, loads }], al: 0, obstacles: [], phase: "pick", updated: Date.now() };
}
// ---------- multiple lifts ----------
// plan.cranes / plan.loads are always the ACTIVE lift's arrays; plan.lifts[plan.al] mirrors them.
let allMode = false;   // "All lifts" overview
function normalizePlan(p) {
  p.id = p.id || uid(); p.cranes = p.cranes || []; p.loads = p.loads || []; p.obstacles = p.obstacles || [];
  if (!Array.isArray(p.lifts) || !p.lifts.length) p.lifts = [{ id: uid(), name: (p.meta && p.meta.lift) || "Lift 1", cranes: p.cranes, loads: p.loads }];
  p.al = Math.max(0, Math.min(p.lifts.length - 1, +p.al || 0));
  p.lifts.forEach((L, i) => { L.id = L.id || uid(); L.name = L.name || "Lift " + (i + 1); L.cranes = L.cranes || []; L.loads = L.loads || []; });
  p.lifts[p.al].cranes = p.cranes; p.lifts[p.al].loads = p.loads;
  return p;
}
function syncLift() { if (!plan.lifts || !plan.lifts.length) normalizePlan(plan); const L = plan.lifts[plan.al]; L.cranes = plan.cranes; L.loads = plan.loads; }
function withLift(i, fn) { syncLift(); const pc = plan.cranes, pl = plan.loads, L = plan.lifts[i]; plan.cranes = L.cranes; plan.loads = L.loads; try { return fn(L); } finally { plan.cranes = pc; plan.loads = pl; } }
function withAll(fn) { syncLift(); const pc = plan.cranes, pl = plan.loads; plan.cranes = plan.lifts.flatMap(L => L.cranes); plan.loads = plan.lifts.flatMap(L => L.loads); try { return fn(); } finally { plan.cranes = pc; plan.loads = pl; } }
function liftOf(id) { syncLift(); return plan.lifts.findIndex(L => L.cranes.some(c => c.id === id) || L.loads.some(l => l.id === id)); }
function liftNo(i) { const L = plan.lifts[i]; return plan.lifts.length === 1 ? (plan.meta.lift || L.name) : L.name; }
// "Lift 1" tags on the combined plan: one badge per lift, placed clear of the others; drag to move (double-click resets)
let LBL_ALL = null, lastLblClick = null;   // all-lifts: one label per load position ("reel · Lift 2 SET / Lift 3 PICK") instead of stacked copies
function buildLblMap(phaseMode) {
  // every load label that will be drawn, then group the ones sitting on (nearly) the same spot – whatever the loads are called
  const E = [];
  plan.lifts.forEach(L => L.loads.forEach(ld => {
    const same = ld.set && Math.hypot(ld.set.x - ld.pick.x, ld.set.y - ld.pick.y) < 0.05;
    for (const ph of phaseMode !== "both" ? [phaseMode] : same ? ["pick"] : ["pick", "set"]) E.push({ id: ld.id, ph, lift: L.name, name: ld.name, x: ld[ph].x, y: ld[ph].y, r: loadExtent(ld), tag: same && phaseMode === "both" ? "" : ph.toUpperCase() });
  }));
  const M = new Map(), groups = [];
  for (const e of E) {
    let g = groups.find(g => g.some(q => Math.hypot(q.x - e.x, q.y - e.y) < Math.max(2, Math.min(q.r, e.r) * 0.6)));
    if (!g) { g = []; g.drawn = false; groups.push(g); }
    g.push(e); M.set(e.id + ":" + e.ph, g);
  }
  return M;
}
function loadLabelText(ld, phase, showPhase) {
  const def = showPhase ? `${ld.name} · ${phase.toUpperCase()}` : ld.name;
  if (!LBL_ALL) return def;
  const g = LBL_ALL.get(ld.id + ":" + phase); if (!g) return def;
  if (g.drawn) return null; g.drawn = true;
  if (g.length < 2) return def;
  const names = [...new Set(g.map(e => e.name))], who = e => `${e.lift}${e.tag ? " " + e.tag : ""}`;
  return names.length === 1 ? `${names[0]} · ${g.map(who).join(" / ")}` : g.map(e => `${who(e)}: ${e.name}`).join("\n");
}
function liftTagPos(L, placed) {
  if (L.lblPos) return [L.lblPos.x, L.lblPos.y];
  const ld = L.loads[0], cr = L.cranes;
  if (!ld && !cr.length) return null;
  const c = cr.length ? [cr.reduce((a, q) => a + q.x, 0) / cr.length, cr.reduce((a, q) => a + q.y, 0) / cr.length] : null;
  const base = ld ? [ld.pick.x, ld.pick.y] : [c[0], c[1] - 4];
  // push the tag away from the crane(s), beyond the load outline, then step round until it is clear of other tags
  let dir = ld && c ? [base[0] - c[0], base[1] - c[1]] : [0, -1]; const n = Math.hypot(...dir) || 1; dir = [dir[0] / n, dir[1] / n];
  const r0 = ld ? loadExtent(ld) + 3 : 2;
  for (let k = 0; k < 24; k++) {
    const a = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5, r = r0 + Math.floor(k / 8) * 2.5;
    const d = [dir[0] * Math.cos(a) - dir[1] * Math.sin(a), dir[0] * Math.sin(a) + dir[1] * Math.cos(a)], q = [base[0] + d[0] * r, base[1] + d[1] * r];
    if (!placed.some(p => Math.abs(p[0] - q[0]) < 6 && Math.abs(p[1] - q[1]) < 2.4)) return q;
  }
  return [base[0] + dir[0] * r0, base[1] + dir[1] * r0];
}
function liftLabelParts() {
  const out = [], placed = [];
  // keep lift tags off the load name labels (drawn just under each load) – those spots count as taken
  plan.lifts.forEach(L => L.loads.forEach(ld => { for (const ph of ["pick", "set"]) if (ld[ph]) for (let k = 0; k < 2; k++) placed.push([ld[ph].x, ld[ph].y - loadExtent(ld) - 1.1 - k * 0.95]); }));
  const nFixed = placed.length;
  plan.lifts.forEach((L, i) => {
    const q = liftTagPos(L, placed); if (!q) return; placed.push(q);
    const s = new Scene(), t = L.name, w = Math.max(3, t.length * 0.62 + 1.2), h = 1.7;
    s.rect("DIMS", q[0] - w / 2, q[1] - h / 2, q[0] + w / 2, q[1] + h / 2, { fill: "#ffffff", color: "#0b5cad", w: 1.4 });
    s.text("DIMS", [q[0], q[1] - 0.33], t, 0.95, { bold: true, color: "#0b5cad" });
    out.push({ key: "liftlbl:" + L.id, scene: s });
  });
  return out;
}
function allSiteParts(phaseMode) {
  return withAll(() => { LBL_ALL = buildLblMap(phaseMode); try { return [...siteParts(phaseMode, false), ...liftLabelParts()]; } finally { LBL_ALL = null; } });
}
let plan = blankPlan(), dirty = false, sel = null, planIndex = [];
let elevPhase = "pick";

// ---------- boom configuration ----------
function ensureBoom(cr, C) {
  C = C || REG.cranes[cr.model]; if (!C) return;
  const kind = C.boom.kind;
  const ok = cr.boomCfg && (kind === "tele" ? Array.isArray(cr.boomCfg.ext) && cr.boomCfg.ext.length === teleInfo(C).n : Array.isArray(cr.boomCfg.inserts));
  if (!ok) cr.boomCfg = defaultCfgFor(C, cr.chartId, +cr.L || C.boom.Lmin);
  cr.L = boomLength(C, cr.boomCfg);
}
// config for a target length, preferring a telescoping code the chart actually has
function defaultCfgFor(C, chartId, L) {
  const ch = REG.charts[chartId];
  if (C.boom.kind === "tele" && ch) {
    const cands = ch.cols.filter(c => Math.abs(c.L - L) < 0.06).map(c => ((c.note || "").match(/mode\s*(\d+)/) || [])[1]).filter(Boolean);
    for (const code of cands) { const cfg = cfgFromCode(C, code); if (cfg) return cfg; }
  }
  return boomCfgFor(C, L);
}
// ---- hooking on: when a crane is hooked on to its load, moving the hook carries the load with it
function carrying(cr, ph) {
  const ld = plan.loads.find(l => l.id === cr.attach?.load);
  return ld && cr.carry !== false && !(cr.tip && cr.tip[ph] && cr.tip[ph].free) ? ld : null;
}
function moveHook(cr, ph, x, y) {
  const dx = x - cr.x, dy = y - cr.y, ld = carrying(cr, ph);
  if (!ld) { cr.tip = cr.tip || {}; cr.tip[ph] = { free: true, R: Math.round(Math.hypot(dx, dy) * 100) / 100, brg: Math.round(bearingDeg(dx, dy) * 10) / 10 }; return; }
  const pos = ld[ph], ev = evalCrane(cr, ph), nb = bearingDeg(dx, dy);
  if (cr.rotWith !== false && ev.hook) { let r = (pos.rot || 0) + (nb - ev.bearing); r = ((r % 360) + 540) % 360 - 180; pos.rot = Math.round(r * 10) / 10; }
  const pt = cr.attach.point || "C", sp = +ld.span || 0, off = pt === "A" ? -sp / 2 : pt === "B" ? sp / 2 : (+ld.cog || 0);
  const v = rot2([off, 0], -(pos.rot || 0));
  pos.x = Math.round((x - v[0]) * 100) / 100; pos.y = Math.round((y - v[1]) * 100) / 100;
}
function setHookRB(cr, ph, R, brg) { moveHook(cr, ph, cr.x + R * Math.sin(brg * D2R), cr.y + R * Math.cos(brg * D2R)); }
function crPaint(cr) { return cr.paint || null; }
function setPaint(cr, hex) { cr.paint = hex; cr.color = inkFor(hex); }
function nextPaint() { const used = plan.cranes.map(c => c.paint); return (PAINTS.find(p => !used.includes(p.hex)) || PAINTS[plan.cranes.length % PAINTS.length]).hex; }
function cfgDraw(cr, C) { return C.boom.kind === "tele" ? { ext: cr.boomCfg?.ext } : { joints: boomJoints(C, cr.boomCfg) }; }

// ---------- evaluation ----------
function evalCrane(cr, phase) {
  const C = REG.cranes[cr.model];
  const out = { cr, C, phase, warn: [] };
  if (!C) { out.warn.push("Crane model not found"); return out; }
  ensureBoom(cr, C);
  const load = plan.loads.find(l => l.id === cr.attach?.load);
  if (load) normLoad(load);
  out.load = load;
  const chart = REG.charts[cr.chartId] && REG.charts[cr.chartId].craneId === cr.model ? REG.charts[cr.chartId] : null;
  out.chart = chart;
  // superlift follows the chart: an SSL chart sets the SL radius, an SH chart means no superlift
  if (C.type === "cr" && chart && chartsFor(cr.model).some(ch => ch.slR != null)) cr.sl = chart.slR != null ? +chart.slR : 0;
  const tip = cr.tip && cr.tip[phase];
  if (load) {
    const att = plan.cranes.filter(c => c.attach?.load === load.id).map(c => ({ id: c.id, point: c.attach.point || "C" }));
    const shares = loadShares(load, att);
    out.share = shares[att.findIndex(a => a.id === cr.id)] || 0;
    out.tandem = att.length > 1;
  } else { out.share = 0; }
  if (tip && tip.free) {
    out.free = true;
    out.R = Math.max(0.5, +tip.R || 10); out.bearing = ((+tip.brg || 0) % 360 + 360) % 360;
    out.hook = [cr.x + out.R * Math.sin(out.bearing * D2R), cr.y + out.R * Math.cos(out.bearing * D2R)];
    if (load && cr.carry !== false) { const h = liftPointWorld(load, cr.attach.point || "C", phase), Rl = Math.hypot(h[0] - cr.x, h[1] - cr.y);
      if (Math.abs(Rl - out.R) > 0.3 || Math.hypot(h[0] - out.hook[0], h[1] - out.hook[1]) > 0.5) out.warn.push(`${phase === "pick" ? "Pick" : "Set"} hook has been moved off the load (hook R ${fx(out.R)} m, load at R ${fx(Rl)} m) – the chart check uses the hook. Put the hook back on the load in the crane panel (${phase === "pick" ? "Pick" : "Set"} – hook) or move the load.`); }
  } else if (load) {
    out.hook = liftPointWorld(load, cr.attach.point || "C", phase);
    const dx = out.hook[0] - cr.x, dy = out.hook[1] - cr.y;
    out.R = Math.hypot(dx, dy);
    out.bearing = bearingDeg(dx, dy);
  } else { out.R = 10; out.bearing = cr.heading; out.warn.push("Not attached to a load"); }
  out.slewRel = ((out.bearing - cr.heading) % 360 + 360) % 360;
  out.hookLoad = out.share + (+cr.hookBlock || 0) + (+cr.extra || 0);
  out.ba = boomAngle(C, cr.L, out.R);
  if (!out.ba.ok) out.warn.push(out.ba.why);
  if (chart) {
    const lk = craneCapacity(C, cr, chart, out.R);
    out.cap = lk.cap; out.rUsed = lk.rUsed; out.colUsed = lk.col; out.capNote = lk.note; out.code = lk.code;
    if (lk.cap == null) out.warn.push(lk.why || "No capacity");
    if (lk.note) out.warn.push(lk.note);
  } else out.warn.push(C.chartHint ? "No load chart loaded. " + C.chartHint : "No load chart selected");
  out.util = out.cap ? out.hookLoad / out.cap * 100 : null;
  const cwMass = chart && chart.cw != null ? chart.cw : (C.mass?.cw || 0);
  out.gp = groundPressure(C, { ...cr, cwMass }, out.R, out.slewRel, out.hookLoad);
  const gbc = gbcFor(cr);
  out.gpMax = out.gp.items.length ? Math.max(...out.gp.items.map(i => i.pressure)) : 0;
  out.gpOk = gbc ? out.gpMax <= gbc : null;
  if (out.gp.items.some(i => i.lift)) out.warn.push("A pad / track edge unloads – check stability with the manufacturer's software");
  const lim = +plan.site.ulim || (rule("crane.util") ?? 100);
  out.status = out.util == null ? "na" : out.util > 100 ? "bad" : out.util > lim ? "amber" : "ok";
  if (out.gpOk === false && out.status !== "bad") out.status = "bad";
  return out;
}

// plain-language TW breakdown for the checks panel: where every tonne comes from
function twBreak(cr, S) {
  const ld = plan.loads.find(l => l.id === cr.attach?.load), blk = +cr.hookBlock || 0, ex = +cr.extra || 0;
  if (!ld) return "block" + (ex ? " + extra" : "");
  const lw = +ld.weight || 0, rw = rigW(ld), tot = lw + rw, sh = S.ph.pick.share ?? tot, f = tot ? sh / tot : 1;
  const parts = [ld.wInclRig ? `${fx(lw * f, 2)} load incl. rigging` : `${fx(lw * f, 2)} load + ${fx(rw * f, 2)} rigging`, `${fx(blk, 2)} block`]; if (ex) parts.push(`${fx(ex, 2)} extra`);
  return (S.ph.pick.tandem ? `${fx(f * 100, 0)}% share: ` : "") + parts.join(" + ");
}
// Whole-lift check per crane (Nicko's method):
//  Utilisation = TW ÷ capacity at maximum radius × 100
//  GBP = Gross Applied Weight × 0.75 ÷ area of 1 mat, GAW = crane weight + counterweight (+ superlift ballast) + gross lift weight
// allowed ground bearing where this crane stands: its own value (an area of the site with its own limit) or the site's
const gbcFor = cr => (cr && +cr.gbc > 0 ? +cr.gbc : +plan.site.gbc || 0);
function craneSummary(cr) {
  const ph = { pick: evalCrane(cr, "pick"), set: evalCrane(cr, "set") };
  const C = ph.pick.C, chart = ph.pick.chart;
  const out = { cr, C, chart, ph, warn: [] };
  if (!C) { out.status = "na"; out.warn.push("Crane model not found"); return out; }
  const extraR = +cr.rMax || 0;
  out.maxR = Math.max(ph.pick.R || 0, ph.set.R || 0, extraR);
  out.maxRFrom = extraR >= out.maxR - 1e-9 && extraR ? "manual" : (ph.set.R > ph.pick.R ? "set" : "pick");
  out.TW = Math.max(ph.pick.hookLoad || 0, ph.set.hookLoad || 0);
  out.ba = boomAngle(C, cr.L, out.maxR);
  if (chart) {
    const lk = craneCapacity(C, cr, chart, out.maxR);
    out.cap = lk.cap; out.rUsed = lk.rUsed;
    if (lk.cap == null) out.warn.push("Max radius: " + (lk.why || "no capacity"));
    // the chart is read at the next row UP from the radius – say so, and say when a tiny move gets the better row
    else if (lk.rUsed != null && lk.rUsed > out.maxR + 0.05) {
      const lo = craneCapacity(C, cr, chart, out.maxR - 0.5), prevRow = lo && lo.cap != null && lo.rUsed != null && lo.rUsed < lk.rUsed ? lo : null;
      out.rowNote = `Max radius ${fx(out.maxR, 2)} m (${out.maxRFrom}) sits between chart rows – capacity read at the ${fx(lk.rUsed)} m row: ${fx(lk.cap)} t`;
      if (prevRow && out.maxR - prevRow.rUsed <= 0.5) out.rowNote += `. Bring the ${out.maxRFrom} radius in to ${fx(prevRow.rUsed)} m (${fx(out.maxR - prevRow.rUsed, 2)} m closer) to use the ${fx(prevRow.rUsed)} m row: ${fx(prevRow.cap)} t`;
    }
  }
  // capacity typed in by the planner overrides the chart (kept visible on the sheet as "manual")
  // it only holds for the chart row it was typed for: move the radius into another row (or add / change the chart) and it is no longer used
  if (+cr.capManual > 0) {
    const band = r => { if (chart) { const k = craneCapacity(C, cr, chart, r); if (k.rUsed != null) return +k.rUsed; } return Math.ceil(r - 1e-6); };
    if (cr.capManualR == null) { cr.capManualR = Math.round(out.maxR * 100) / 100; cr.capManualChart = chart ? cr.chartId : null; }   // older plans: typed for the radius they have now
    const chartNow = chart ? cr.chartId : null, sameChart = (cr.capManualChart || null) === (chartNow || null), sameRow = band(out.maxR) === band(+cr.capManualR);
    if (sameChart && sameRow) { out.capChart = out.cap ?? null; out.cap = +cr.capManual; out.capManual = true; out.warn = out.warn.filter(w => !/^Max radius: /.test(w)); }
    else { out.capStale = { cap: +cr.capManual, R: +cr.capManualR, why: !sameChart ? (chartNow ? "a load chart is now selected – the chart is used" : "the load chart was changed") : `the max radius is now ${fx(out.maxR, 2)} m – outside that chart row` };
      const msg = `${cr.label}: typed capacity ${fx(+cr.capManual)} t (R ${fx(+cr.capManualR, 2)} m) reset – ${out.capStale.why}${out.cap == null ? ". Type the capacity for this radius." : "."}`;
      delete cr.capManual; delete cr.capManualR; delete cr.capManualChart;                 // reset: never assess with a capacity for another radius / chart
      if (typeof toast === "function") setTimeout(() => toast(msg, 4200), 0);
      if (out.cap == null) out.warn.push(msg); }
  }
  out.util = out.cap ? out.TW / out.cap * 100 : null;
  if (out.rowNote && !out.capManual && out.util > (+plan.site.ulim || (rule("crane.util") ?? 100))) out.warn.push(out.rowNote);
  out.craneWt = cr.wCrane !== "" && cr.wCrane != null && !isNaN(+cr.wCrane) ? +cr.wCrane : (+C.mass?.base || 0);
  const chartCw = chart && chart.cw != null ? +chart.cw : (+C.mass?.cw || 0);
  out.cwWt = cr.wCw !== "" && cr.wCw != null && !isNaN(+cr.wCw) ? +cr.wCw : chartCw;
  out.sl = slOf(cr, C); out.slWt = out.sl ? out.sl.T : 0;
  out.GAW = out.craneWt + out.cwWt + out.TW + out.slWt;
  if (typeof craneMassTbc === "function" && craneMassTbc(cr, C)) out.warn.push(`Crane base mass ${fx(out.craneWt, 1)} t is not confirmed (TBC) – enter the manufacturer's figure in the crane panel; GAW and ground bearing use it`);
  out.mat = matInfo(cr, C); out.matA = out.mat.area;
  // manufacturer's maximum outrigger (or track) reaction for this set-up, when entered, replaces the 0.75 × GAW estimate
  out.react = C.type !== "ped" && +cr.oReact > 0 ? +cr.oReact : null; out.gbpBasis = out.react ? "mfr" : "est";
  out.gbpLoad = out.react || out.GAW * 0.75;
  out.gbp = out.matA > 0 && C.type !== "ped" ? out.gbpLoad / out.matA : null;
  const gbc = gbcFor(cr);
  out.gbpOk = gbc && out.gbp != null ? out.gbp <= gbc : null;
  const lim = +plan.site.ulim || (rule("crane.util") ?? 100);
  out.status = out.util == null ? "na" : out.util > 100 ? "bad" : out.util > lim ? "amber" : "ok";
  if (out.gbpOk === false) out.status = "bad";
  const bdS = blockDims(cr, C);
  // an overloaded hook block or rope is as much a stop as an overloaded chart
  if (+cr.linePull > 0 && out.TW / bdS.parts > +cr.linePull) { out.warn.push(`Line pull ${fx(out.TW / bdS.parts, 2)} t per fall exceeds ${fx(cr.linePull)} t – add parts of line`); out.status = "bad"; }
  if (+bdS.cap > 0 && out.TW > bdS.cap) { out.warn.push(`Hook load ${fx(out.TW, 1)} t exceeds the ${fx(bdS.cap)} t hook block`); out.status = "bad"; }
  const wp = ph.pick.warn, wsx = ph.set.warn;
  for (const w of new Set([...wp, ...wsx])) {
    out.warn.push(wp.includes(w) && wsx.includes(w) ? w : `${wp.includes(w) ? "pick" : "set"}: ${w}`);
  }
  if (chart && (ph.pick.cap == null || ph.set.cap == null)) { out.status = "bad"; out.warn.unshift(`No chart capacity at the ${ph.pick.cap == null ? "pick" : "set"} radius with this boom – change the boom or radius`); }
  out.warn = [...new Set(out.warn)];
  return out;
}

// ---------- travel path from pick to set ----------
// single crane: the load swings round the crane (slew) while the radius changes; tandem or free: straight line
function travelPath(ld) {
  const cranes = plan.cranes.filter(c => c.attach?.load === ld.id && REG.cranes[c.model]);
  const P0 = [ld.pick.x, ld.pick.y], P1 = [ld.set.x, ld.set.y];
  const wrap = a => ((a % 360) + 540) % 360 - 180;
  const r0 = +ld.pick.rot || 0; let dr = wrap((+ld.set.rot || 0) - r0);
  // a load that is the same end-for-end (tank, box, reel, beam…) never needs more than a 90° turn: set at 180° from its
  // pick heading it is already lined up – no half-turn over the landing point
  if (!ld.oneWay && Math.abs(dr) > 90) dr = dr > 0 ? dr - 180 : dr + 180;
  // how the riggers do it: the load keeps its pick heading through the move (tag lines hold it) and is turned
  // to its set heading over the last quarter, just short of the set-down, so it is lined up before it is lowered
  const turn = t => { const u = Math.max(0, Math.min(1, (t - 0.75) / 0.25)); return u * u * (3 - 2 * u); };
  if (cranes.length === 1) {
    // the load travels with the hook over it – a hook moved away from the load (free tip) is not where the load goes
    const onLoad = ph => { const e = evalCrane(c, ph); if (!e.free || !e.load) return e; const h = liftPointWorld(e.load, c.attach.point || "C", ph), dx = h[0] - c.x, dy = h[1] - c.y; return { ...e, hook: h, R: Math.hypot(dx, dy), bearing: bearingDeg(dx, dy) }; };
    const c = cranes[0], e0 = onLoad("pick"), e1 = onLoad("set");
    if (e0.hook && e1.hook) {
      const b0 = e0.bearing, raw = wrap(e1.bearing - b0), dir = ld.travelDir || "short";
      const delta = dir === "cw" ? (raw < 0 ? raw + 360 : raw) : dir === "ccw" ? (raw > 0 ? raw - 360 : raw) : raw;
      const n = Math.max(12, Math.ceil(Math.abs(delta) / 3)), pts = [], hooks = [], rots = [];
      const v0 = [P0[0] - e0.hook[0], P0[1] - e0.hook[1]], v1 = [P1[0] - e1.hook[0], P1[1] - e1.hook[1]];
      for (let i = 0; i <= n; i++) {
        const t = i / n, b = b0 + delta * t, R = e0.R + (e1.R - e0.R) * t, h = [c.x + R * Math.sin(b * D2R), c.y + R * Math.cos(b * D2R)];
        const rt = dr * turn(t), va = rot2(v0, -rt), vb = rot2(v1, dr - rt), v = [va[0] * (1 - t) + vb[0] * t, va[1] * (1 - t) + vb[1] * t];
        hooks.push(h); pts.push([h[0] + v[0], h[1] + v[1]]); rots.push(r0 + rt);
      }
      return { pts, hooks, rots, slew: delta, R0: e0.R, R1: e1.R, crane: c, curved: Math.abs(delta) > 1 };
    }
  }
  const n = 12, pts = [], rots = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t]); rots.push(r0 + dr * turn(t)); }
  return Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) > 0.5 || Math.abs(dr) > 1 ? { pts, hooks: null, rots, slew: 0 } : null;
}
// zone types: "work" = lift exclusion zone (barricaded work area – the lift must stay INSIDE), "nogo" = the load must not pass over it
const zoneType = o => o.zone ? (o.zt || "work") : null;
const obsColor = o => o.color || (o.zone ? "#c0392b" : "#34393f");
const rgbaOf = (hex, a) => `rgba(${hexRgb(hex).join(",")},${a})`;
function inPolyPt(p, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if ((P[i][1] > p[1]) !== (P[j][1] > p[1]) && p[0] < (P[j][0] - P[i][0]) * (p[1] - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; } return c; }
function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
// is a disc of radius rr (centre p) completely inside zone o?
function insideZone(p, rr, o) {
  if (o.kind === "circle") return Math.hypot(p[0] - o.x, p[1] - o.y) + rr <= (o.r || 1);
  const P = obsPts(o); return inPolyPt(p, P) && P.every((q, k) => segDist(p, q, P[(k + 1) % P.length]) >= rr);
}
function workZones() { return plan.obstacles.filter(o => zoneType(o) === "work" && o.kind !== "dim"); }
// Travel check. The load (its real outline, at the heading it has at that point of the move) is checked against every
// site item it passes over. Anything can be lifted over – a plinth or a pipe rack alike – as long as the crane has the hook
// height there: load bottom ≥ item top + TRAVEL_CLEAR, with the hook block kept TRAVEL_A2B under the boom head (the
// anti-two-block cuts out before the block reaches the head). Only no-go areas and power lines are never lifted over.
const TRAVEL_CLEAR = 1.0, TRAVEL_A2B = 1.5, TRAVEL_SIDE = 1.0;   // over an item / under the boom head / beside an item
// grow a convex outline (local, centred) outward by d on every side
function growOutline(P, d) {
  const n = P.length; if (n < 3 || !(d > 0)) return P;
  let ar = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; ar += a[0] * b[1] - b[0] * a[1]; } const sg = ar >= 0 ? 1 : -1;
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [sg * dy / L, -sg * dx / L]; };
  return P.map((v, i) => { const n1 = nrm(P[(i - 1 + n) % n], v), n2 = nrm(v, P[(i + 1) % n]); let bx = n1[0] + n2[0], by = n1[1] + n2[1]; const L = Math.hypot(bx, by);
    if (L < 1e-6) return [v[0] + n1[0] * d, v[1] + n1[1] * d]; bx /= L; by /= L; const k = d / Math.max(0.3, bx * n1[0] + by * n1[1]); return [v[0] + bx * k, v[1] + by * k]; });
}
function travelHookMax(cr, R) {   // highest the hook may go at radius R with this boom (block TRAVEL_A2B under the head sheaves)
  const C = REG.cranes[cr.model]; if (!C) return null; const ba = boomAngle(C, cr.L, R); if (!ba.ok) return null;
  return hookMaxZ(cr, { C, ba });
}
function obstacleHits(ld, tp, ctx) {
  const hits = new Set(), idx = [], WZ = workZones(), outIdx = [], over = new Map(), short = new Map();
  // what the load stands on at the pick or set (plinths, supports, a stand) is not in its way
  const sup = new Set(), d0 = loadDims(ld);
  for (const ph of ["pick", "set"]) { const q = ld[ph]; if (!q) continue; const F = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const r = rot2([a * d0.x / 2 + 0.3 * a, b * d0.y / 2 + 0.3 * b], -(q.rot || 0)); return [q.x + r[0], q.y + r[1]]; });
    for (const o of plan.obstacles) if (itemInLift(o) && o.kind !== "line" && o.kind !== "dim" && !o.zone && (+o.hgt || 0) <= (+q.h || 0) + 0.05) { const c = o.kind === "circle" ? [o.x, o.y] : centroid(obsPts(o)); if (inPolyPt(c, F)) sup.add(o); } }
  const cranes = plan.cranes.filter(c => c.attach?.load === ld.id && REG.cranes[c.model]), tandem = cranes.length > 1;
  const rigH = ctx?.rigH ?? loadRigHeight(ld, tandem), out0 = loadOutline(ld), outG = growOutline(out0, TRAVEL_SIDE), ends = ctx?.ends || [tp.pts[0], tp.pts[tp.pts.length - 1]], rr = loadExtent(ld) * 0.85;
  const shapes = typeof hitShapes === "function" ? hitShapes() : plan.obstacles;
  const polyOf = o => o.kind === "circle" ? Array.from({ length: 16 }, (_, k) => [o.x + (+o.r || 1) * Math.cos(k * Math.PI / 8), o.y + (+o.r || 1) * Math.sin(k * Math.PI / 8)]) : obsPts(o);
  const segX = (p, q, r, s) => { const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return d(p, q, r) * d(p, q, s) < 0 && d(r, s, p) * d(r, s, q) < 0; };
  const touch = (A, B, closed) => { if (closed && B.length > 2 && A.some(p => inPolyPt(p, B))) return true; if (B.some(p => inPolyPt(p, A))) return true;
    const nB = closed ? B.length : B.length - 1; for (let j = 0; j < nB; j++) for (let k = 0; k < A.length; k++) if (segX(A[k], A[(k + 1) % A.length], B[j], B[(j + 1) % B.length])) return true; return false; };
  tp.pts.forEach((p, i) => {
    // 1 m clear beside items during the move; not at the pick and set themselves (the load is lifted straight off / set straight down there)
    const away = ends.every(e => Math.hypot(p[0] - e[0], p[1] - e[1]) > 1.5);
    const rot = tp.rots ? tp.rots[i] : 0, T = (away ? outG : out0).map(q => { const r = rot2(q, -rot); return [p[0] + r[0], p[1] + r[1]]; });
    const hk = tp.hooks ? tp.hooks[i] : p; let avail; const Rs = [];
    const hookAvail = () => { if (avail !== undefined) return avail; avail = Infinity;
      for (const c of cranes) { const R = Math.hypot(hk[0] - c.x, hk[1] - c.y), m = travelHookMax(c, R); Rs.push(R); if (m == null) { avail = null; return avail; } avail = Math.min(avail, m); }
      if (avail === Infinity) avail = null; return avail; };
    for (const o of shapes) {
      if (o.kind === "dim" || zoneType(o) === "work" || sup.has(o)) continue;
      const hit = o.kind === "line" ? touch(T, o.pts || [], false) || (o.pts || []).some((q, k, P) => k < P.length - 1 && segDist(p, q, P[k + 1]) < 0.3) : touch(T, polyOf(o), true);
      if (!hit) continue;
      const nm = o.label || (o.zone ? "No-go area" : "Site item");
      if (o.zone || o.type === "powerline") { hits.add(nm); idx.push(i); continue; }
      const top = +o.hgt || 0, need = top + TRAVEL_CLEAR + rigH, a = hookAvail();
      if (a == null) continue;   // out of reach here – the radius checks report that
      const m = a - need, R = Math.max(...Rs);
      if (m >= 0) { const v = over.get(nm); if (!v || m < v.clear) over.set(nm, { top, clear: m, R }); }
      else { const v = short.get(nm); if (!v || m < -v.short) short.set(nm, { top, short: -m, R }); idx.push(i); }
    }
    if (WZ.length && !WZ.some(o => insideZone(p, rr, o))) { outIdx.push(i); idx.push(i); }
  });
  for (const [nm, v] of short) { hits.add(`${nm} (${fx(v.top, 1)} m high – ${fx(v.short, 1)} m short of hook height at R ${fx(v.R, 1)} m)`); over.delete(nm); }
  const low = [...over.keys()], lowTop = Math.max(0, ...[...over.values()].map(v => v.top));
  return { names: [...hits], idx: new Set(idx), outside: outIdx.length ? WZ.map(o => o.label || "Exclusion zone") : [], bad: hits.size > 0 || outIdx.length > 0, low, lowTop, over, short, rigH };
}
const TRAVEL_LOW = 1.5;   // kept for older code paths – the travel check now uses hook height
function clashText(hit) {
  const a = [];
  if (hit.names.length) a.push(`can't be lifted over ${hit.names.join(", ")}`);
  if (hit.outside.length) a.push(`goes outside the ${hit.outside.join(" / ")}`);
  return a.join(" and ");
}
// plan outline of a load (local axes, centred): round loads a circle, tanks / pipes with their heads, the rest a rectangle
function loadOutline(ld) {
  const d = loadDims(ld), k = ld.kind, o = ld.orient, hx = d.x / 2, hy = d.y / 2;
  const round = (k === "reel" && o === "flat") || (k === "silo" && o !== "horizontal") || (k === "cyl" && o === "vertical");
  if (round) return Array.from({ length: 32 }, (_, i) => [hx * Math.cos(i * Math.PI / 16), hy * Math.sin(i * Math.PI / 16)]);
  const r = k === "tank" ? Math.min(hy, (+ld.D || d.y) / 4, hx) : 0;
  if (!r) return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]];
  const P = []; for (const s of [1, -1]) for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + Math.PI * i / 12; P.push([s * (hx - r + r * Math.cos(a)), s * hy * Math.sin(a)]); }
  return P;
}
function travelScene(ld, tp) {
  const s = new Scene(), col = "#d9661f", hit = obstacleHits(ld, tp), bad = "#b42318";
  // ghost footprints along the way (every ~quarter)
  const lp = loadPlan(ld), step = Math.max(1, Math.round((tp.pts.length - 1) / 4));
  // the load's outline only, turned with the load – no lugs, centre lines or labels
  for (let i = step; i < tp.pts.length - 1; i += step) { const g = new Scene(); g.poly("LOAD", loadOutline(ld), { closed: true, dash: [0.5, 0.35], w: 0.6, color: hit.idx.has(i) ? bad : "#b9a38a" }); s.add(g, -tp.rots[i], tp.pts[i][0], tp.pts[i][1]); }
  // path of the load centre
  for (let i = 0; i < tp.pts.length - 1; i++) s.poly("DIMS", [tp.pts[i], tp.pts[i + 1]], { w: 1.4, dash: [0.5, 0.3], color: hit.idx.has(i) || hit.idx.has(i + 1) ? bad : col });
  if (tp.hooks) for (let i = 0; i < tp.hooks.length - 1; i += 2) s.poly("DIMS", [tp.hooks[i], tp.hooks[Math.min(i + 1, tp.hooks.length - 1)]], { w: 0.8, color: col });
  // arrow head at the set end
  const n = tp.pts.length, e = tp.pts[n - 1], q = tp.pts[n - 2], L = Math.hypot(e[0] - q[0], e[1] - q[1]) || 1, d = [(e[0] - q[0]) / L, (e[1] - q[1]) / L], nn = [-d[1], d[0]];
  s.poly("DIMS", [[e[0] - d[0] * 0.9 + nn[0] * 0.5, e[1] - d[1] * 0.9 + nn[1] * 0.5], e, [e[0] - d[0] * 0.9 - nn[0] * 0.5, e[1] - d[1] * 0.9 - nn[1] * 0.5]], { w: 1.4, color: col });
  const m = tp.pts[Math.floor(n / 2)], len = tp.pts.reduce((a, p, i) => i ? a + Math.hypot(p[0] - tp.pts[i - 1][0], p[1] - tp.pts[i - 1][1]) : 0, 0);
  const lab = tp.hooks ? `slew ${fx(Math.abs(tp.slew), 0)}° ${tp.slew >= 0 ? "clockwise" : "anticlockwise"} · R ${fx(tp.R0)} → ${fx(tp.R1)} m` : `move ${fx(len)} m`;
  // the label sits on the travel line itself, at its middle, turned along it (outside the arc, away from the crane)
  const mi = Math.floor((n - 1) / 2), mA = tp.pts[mi], mB = tp.pts[Math.min(n - 1, mi + 1)], tl = Math.hypot(mB[0] - mA[0], mB[1] - mA[1]) || 1, tg = [(mB[0] - mA[0]) / tl, (mB[1] - mA[1]) / tl];
  let nv = [-tg[1], tg[0]];
  const crs = plan.cranes.filter(c => c.attach?.load === ld.id);
  if (crs.length) { const cx = crs.reduce((a, c) => a + c.x, 0) / crs.length, cy = crs.reduce((a, c) => a + c.y, 0) / crs.length; if ((mA[0] - cx) * nv[0] + (mA[1] - cy) * nv[1] < 0) nv = [-nv[0], -nv[1]]; }
  let ang = Math.atan2(tg[1], tg[0]) / D2R; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  const lines = [[lab, 0.62, hit.names.length ? bad : col], ...(hit.names.length ? [[`clashes with ${hit.names.join(", ")}`, 0.55, bad]] : [])];
  lines.forEach(([t, sz, c], k) => { const off = 0.55 + k * 0.8; s.text("DIMS", [mA[0] + nv[0] * off, mA[1] + nv[1] * off], t, sz, { bold: true, color: c, rot: ang }); });
  return s;
}

// ---------- site scene ----------
const HPX = 7;                                   // handle radius in screen px
const hR = () => HPX / view.s;
function ghostify(sc) { sc.items.forEach(it => { if (it.t !== "text") { it.dash = it.dash || [0.4, 0.25]; if (it.fill && it.fill !== "none") it.fill = "none"; } }); return sc; }
function handleScene(p, color, kind) {
  const s = new Scene(), r = hR();
  if (kind === "rot") { s.circle("DIMS", p, r, { fill: "#ffffff", color, w: 1.6 }); s.circle("DIMS", p, r * 0.45, { fill: color, color }); }
  else if (kind === "add") { s.circle("DIMS", p, r * 0.7, { fill: "#ffffff", color, w: 1.2, dash: [r * 0.3, r * 0.2] }); }
  else s.rect("DIMS", p[0] - r * 0.8, p[1] - r * 0.8, p[0] + r * 0.8, p[1] + r * 0.8, { fill: "#ffffff", color, w: 1.6 });
  return s;
}
function craneCarrierScene(cr, C) {
  const s = new Scene();
  s.add(paintScene(carrierPlan(C, cr.orMode, null), crPaint(cr)), -cr.heading, cr.x, cr.y);
  s.circle("RADIUS", [cr.x, cr.y], C.up.tail, { dash: [0.5, 0.3], w: 0.8 });
  s.circle("REF", [cr.x, cr.y], 0.4, { fill: "#ffffff", w: 1.2 });
  const rr = -((C.type === "cr" ? C.car.len / 2 : -C.car.rear) + Math.max(1.6, C.up.tail - (C.type === "cr" ? C.car.len / 2 : -C.car.rear) + 1.4));
  s.text("TEXT", [cr.x + rr * Math.sin(cr.heading * D2R), cr.y + rr * Math.cos(cr.heading * D2R)], `${cr.label} · ${C.short}`, 0.9, { bold: true, color: cr.color });
  return s;
}
function hookLine(s, cr, ev, dashed) {
  if (!ev.hook) return;
  s.poly("DIMS", [[cr.x, cr.y], ev.hook], { w: dashed ? 1.0 : 1.6, dash: dashed ? [0.6, 0.35] : null, color: cr.color });
  const m = [(cr.x + ev.hook[0]) / 2, (cr.y + ev.hook[1]) / 2];
  let ang = 90 - ev.bearing; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  s.text("DIMS", [m[0], m[1] + 0.8], `${ev.phase === "pick" ? "PICK" : "SET"}${ev.free ? " (tip moved)" : ""} R ${fx(ev.R)} m`, 0.7, { rot: ang, bold: true, color: cr.color });
}
function tipScene(cr, ev, dashed, onScreen) {
  const s = new Scene(), r = Math.min(0.9, Math.max(0.45, hR() * 1.2));
  if (dashed) hookLine(s, cr, ev, true);
  if (!onScreen) return s;                 // sheets / exports: no hook target marker over the load
  s.circle("DIMS", ev.hook, r, { fill: ev.free ? cr.color : "#ffffff", color: cr.color, w: 1.5 });
  s.poly("DIMS", [[ev.hook[0] - r * 1.6, ev.hook[1]], [ev.hook[0] + r * 1.6, ev.hook[1]]], { w: 1, color: cr.color });
  s.poly("DIMS", [[ev.hook[0], ev.hook[1] - r * 1.6], [ev.hook[0], ev.hook[1] + r * 1.6]], { w: 1, color: cr.color });
  return s;
}
function loadScene(ld, phase, ghost, showPhase) {
  const s = new Scene(), pos = ld[phase];
  const lp = loadPlan(ld);
  if (ghost) ghostify(lp);
  s.add(lp, -(pos.rot || 0), pos.x, pos.y);
  // the name: along the load's long side, inside it when it fits (big loads), otherwise just clear of its outline
  { const lt = loadLabelText(ld, phase, showPhase);
    if (lt) {
      const L = lt.split("\n"), d = loadDims(ld), a = (pos.rot || 0) * D2R, n = Math.max(...L.map(t => t.length)), lng = Math.max(d.x, d.y), sht = Math.min(d.x, d.y);
      const fit = Math.min(0.7, lng * 0.8 / Math.max(1, n * 0.6));
      if (fit >= 0.45 && L.length * fit * 1.4 <= sht * 0.75) {
        let ang = -(pos.rot || 0) + (d.x >= d.y ? 0 : 90); ang = ((ang + 180) % 360 + 360) % 360 - 180; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        const r = ang * D2R, nx = -Math.sin(r), ny = Math.cos(r), off = sht * 0.22;      // a little off the centre line (lifting points and CoG sit on it)
        L.forEach((t, k) => { const o = -off - k * fit * 1.35; s.text("TEXT", [pos.x + nx * o, pos.y + ny * o], t, fit, { bold: true, rot: ang }); });
      } else {
        const hy = (d.x * Math.abs(Math.sin(a)) + d.y * Math.abs(Math.cos(a))) / 2 + 0.9;
        const overlap = phase === "set" && ld.pick && Math.hypot(ld.pick.x - pos.x, ld.pick.y - pos.y) < 2 * loadExtent(ld) + 1.5, ly = overlap ? pos.y + hy + 0.3 : pos.y - hy;
        L.forEach((t, k) => s.text("TEXT", [pos.x, overlap ? ly + (L.length - 1 - k) * 0.95 : ly - k * 0.95], t, 0.7, { bold: true }));
      }
    } }
  if (ld.span) for (const p of ["A", "B"]) { const w = liftPointWorld(ld, p, phase); s.text("RIGGING", [w[0], w[1] + 0.8], p, 0.6, { bold: true }); }
  return s;
}
function obsPts(o) {
  if (o.kind === "poly" || o.kind === "dim" || o.kind === "line") return o.pts || [];
  const hw = (o.w || 2) / 2, hh = (o.h || 2) / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(p => { const r = rot2(p, -(o.rot || 0)); return [r[0] + o.x, r[1] + o.y]; });
}
function centroid(P) { return P.length ? [P.reduce((a, p) => a + p[0], 0) / P.length, P.reduce((a, p) => a + p[1], 0) / P.length] : [0, 0]; }
function obsScene(o) {
  const s = new Scene();
  if (o.kind === "dim") {
    const [a, b] = o.pts, L = Math.hypot(b[0] - a[0], b[1] - a[1]), d = L ? [(b[0] - a[0]) / L, (b[1] - a[1]) / L] : [1, 0], n = [-d[1], d[0]], t = 0.45;
    s.poly("DIMS", [a, b], { w: 1.1, color: "#16202a" });
    for (const p of [a, b]) s.poly("DIMS", [[p[0] - n[0] * t, p[1] - n[1] * t], [p[0] + n[0] * t, p[1] + n[1] * t]], { w: 1.1, color: "#16202a" });
    let ang = Math.atan2(d[1], d[0]) / D2R; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    const m = [(a[0] + b[0]) / 2 + n[0] * 0.6, (a[1] + b[1]) / 2 + n[1] * 0.6];
    s.text("DIMS", m, `${o.label ? o.label + " " : ""}${fx(L, 2)} m`, 0.65, { rot: ang, bold: true, color: "#16202a" });
    return s;
  }
  const os = typeof objScene === "function" ? objScene(o) : null; if (os) return os;
  const zt = zoneType(o), col = obsColor(o), fill = zt === "work" ? rgbaOf(col, 0.06) : zt === "nogo" ? rgbaOf(col, 0.22) : o.color ? rgbaOf(col, 0.18) : "#e9ecef";
  let labelAt;
  if (o.kind === "circle") { s.circle("LOAD", [o.x, o.y], o.r || 1, { fill, color: col, dash: o.zone ? [0.5, 0.3] : null, w: 1.2 }); labelAt = [o.x, o.y + (o.r || 1) + 0.7]; }
  else {
    const P = obsPts(o);
    s.poly("LOAD", P, { closed: true, fill, color: col, dash: o.zone ? [0.5, 0.3] : null, w: 1.2 });
    if (isMat(o)) { const n = Math.max(2, Math.round((+o.h || 1) / 0.4)); for (let k = 1; k < n; k++) { const f = k / n; s.poly("LOAD", [[P[0][0] + (P[3][0] - P[0][0]) * f, P[0][1] + (P[3][1] - P[0][1]) * f], [P[1][0] + (P[2][0] - P[1][0]) * f, P[1][1] + (P[2][1] - P[1][1]) * f]], { w: 0.25, color: rgbaOf(col, 0.45) }); } s.poly("LOAD", P, { closed: true, color: shade(col, 0.6), w: 1.8 }); }
    else if (!o.zone && o.kind === "rect") { s.poly("LOAD", [P[0], P[2]], { w: 0.5, color: col }); s.poly("LOAD", [P[1], P[3]], { w: 0.5, color: col }); }
    if (zt === "nogo") { const xs = P.map(q => q[0]), ys = P.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);   // hatch = no-go
      for (let t = x0 - (y1 - y0); t < x1; t += 1.2) { const a = [t, y0], b = [t + (y1 - y0), y1], seg = []; for (let k = 0; k <= 40; k++) { const q = [a[0] + (b[0] - a[0]) * k / 40, a[1] + (b[1] - a[1]) * k / 40]; seg.push(inPolyPt(q, P) ? q : null); }
        let run = []; for (const q of [...seg, null]) { if (q) run.push(q); else { if (run.length > 1) s.poly("LOAD", [run[0], run[run.length - 1]], { w: 0.4, color: col }); run = []; } } } }
    labelAt = zt === "work" ? (() => { const top = P.reduce((m, q) => q[1] > m[1] ? q : m, P[0]); return [top[0], top[1] + 0.8]; })() : o.kind === "poly" ? centroid(P) : [o.x, o.y + (o.h || 2) / 2 + 0.7];
  }
  if (o.kind === "circle" && zt === "work") labelAt = [o.x, o.y + (o.r || 1) + 0.8];
  if (typeof objDecor === "function") objDecor(s, o);
  if (!isMat(o)) s.text("TEXT", labelAt, o.label || (zt === "work" ? "Exclusion zone" : zt === "nogo" ? "No-go area" : (typeof OBJ_TYPES !== "undefined" && OBJ_TYPES[o.type]?.name) || "Object"), 0.6, { color: col, bold: true });
  return s;
}
// capacity reach rings for a crane (max radius within the utilisation limit and at 100 %)
function reachRings(cr) {
  const S = craneSummary(cr); if (!S.C || !S.chart || !(S.TW > 0)) return null;
  const lim = (+plan.site.ulim || (rule("crane.util") ?? 100)) / 100;
  let rLim = null, r100 = null;
  for (let R = 1; R <= 150; R += 0.25) {
    const lk = craneCapacity(S.C, cr, S.chart, R);
    if (lk.cap == null) { if (R > 20 && lk.why && /beyond/.test(lk.why)) break; continue; }
    if (lk.cap * lim >= S.TW) rLim = R;
    if (lk.cap >= S.TW) r100 = R;
  }
  return { rLim, r100, TW: S.TW };
}
function siteParts(phaseMode, ui, noObs) {
  // returns [{key, scene, ui?, nohit?}] in draw order
  const parts = [];
  const phases = phaseMode === "both" ? ["pick", "set"] : [phaseMode];
  if (!noObs) { const MS = shownMatIds(); for (const o of obsDrawOrder(plan.obstacles)) if (!matHidden(o, MS)) parts.push({ key: "obs:" + o.id, scene: obsScene(o) }); }
  for (const ld of plan.loads) {
    normLoad(ld);
    if (phaseMode === "both") {
      const same = Math.hypot(ld.set.x - ld.pick.x, ld.set.y - ld.pick.y) < 0.05 && Math.abs((ld.set.rot || 0) - (ld.pick.rot || 0)) < 0.5;
      if (!same) {
        parts.push({ key: `load:${ld.id}:set`, scene: loadScene(ld, "set", true, true) });
      }
      parts.push({ key: `load:${ld.id}:pick`, scene: loadScene(ld, "pick", false, !same) });
      if (!same) { const tp = travelPath(ld); if (tp) parts.push({ key: "travel:" + ld.id, scene: travelScene(ld, tp), nohit: true }); }
    } else parts.push({ key: `load:${ld.id}:${phaseMode}`, scene: loadScene(ld, phaseMode, false, false) });
    if (ui && sel?.kind === "load" && sel.id === ld.id) {
      const ph = phases[0] === "set" || (phaseMode === "both" && sel.ph === "set") ? "set" : phases[0], pos = ld[ph];
      const v = rot2([loadExtent(ld) + 1.4, 0], -(pos.rot || 0));
      parts.push({ key: `lrot:${ld.id}:${ph}`, scene: handleScene([pos.x + v[0], pos.y + v[1]], "#d9661f", "rot"), ui: true });
    }
  }
  for (const cr of plan.cranes) {
    const C = REG.cranes[cr.model]; if (!C) continue;
    const ev = evalCrane(cr, phases[0]);
    parts.push({ key: "crane:" + cr.id, scene: craneCarrierScene(cr, C) });
    const bs = new Scene();
    bs.add(paintScene(upperPlan(C, cr.L, ev.ba.theta, slOf(cr, C)?.R || 0, cfgDraw(cr, C), slOf(cr, C)), crPaint(cr)), -ev.bearing, cr.x, cr.y);
    hookLine(bs, cr, ev, false);
    parts.push({ key: `boom:${cr.id}:${phases[0]}`, scene: bs });
    for (const ph of phases) { const e = ph === phases[0] ? ev : evalCrane(cr, ph); if (e.hook) parts.push({ key: `tip:${cr.id}:${ph}`, scene: tipScene(cr, e, ph !== phases[0], ui) }); }
    if (ui && sel?.kind === "crane" && sel.id === cr.id) {
      const rr = reachRings(cr);
      if (rr) {
        const rs = new Scene();
        if (rr.rLim) { rs.circle("DIMS", [cr.x, cr.y], rr.rLim, { dash: [0.8, 0.4], w: 1.2, color: "#1d7a4f" }); rs.text("DIMS", [cr.x, cr.y + rr.rLim + 0.6], `max radius for this load R ${fx(rr.rLim)} m`, 0.6, { bold: true, color: "#1d7a4f" }); }
        if (rr.r100 && rr.r100 !== rr.rLim) { rs.circle("DIMS", [cr.x, cr.y], rr.r100, { dash: [0.3, 0.3], w: 1.0, color: "#b42318" }); rs.text("DIMS", [cr.x, cr.y - rr.r100 - 0.6], `100% at R ${fx(rr.r100)} m`, 0.6, { bold: true, color: "#b42318" }); }
        parts.push({ key: "ring:" + cr.id, scene: rs, ui: true, nohit: true });
      }
      const fr = (C.type === "cr" ? C.car.len / 2 : C.car.front) + 3.6;
      parts.push({ key: `hrot:${cr.id}`, scene: handleScene([cr.x + fr * Math.sin(cr.heading * D2R), cr.y + fr * Math.cos(cr.heading * D2R)], cr.color, "rot"), ui: true });
    }
  }
  if (ui && sel?.kind === "obs") {
    const o = plan.obstacles.find(x => x.id === sel.id);
    if (o) {
      if (o.kind === "circle") parts.push({ key: `hsz:${o.id}`, scene: handleScene([o.x + (o.r || 1), o.y], obsColor(o)), ui: true });
      else if (o.kind === "rect") {
        const c = rot2([(o.w || 2) / 2, (o.h || 2) / 2], -(o.rot || 0)), t = rot2([0, (o.h || 2) / 2 + 1.4], -(o.rot || 0));
        parts.push({ key: `hsz:${o.id}`, scene: handleScene([o.x + c[0], o.y + c[1]], obsColor(o)), ui: true });
        parts.push({ key: `hrot:${o.id}`, scene: handleScene([o.x + t[0], o.y + t[1]], obsColor(o), "rot"), ui: true });
      } else {
        const P = o.pts;
        if (o.kind === "poly" || o.kind === "line") P.forEach((p, i) => { if (o.kind === "line" && i === P.length - 1) return; const q = P[(i + 1) % P.length]; parts.push({ key: `hmid:${o.id}:${i}`, scene: handleScene([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], obsColor(o), "add"), ui: true }); });
        P.forEach((p, i) => parts.push({ key: `hv:${o.id}:${i}`, scene: handleScene(p, o.kind === "dim" ? "#16202a" : obsColor(o)), ui: true }));
      }
    }
  }
  const out = typeof styleTexts === "function" ? styleTexts(parts) : parts;
  // dimension labels (slew, radii, lengths) always sit on top – never hidden under a crane, boom or load drawn later
  const lab = new Scene();
  for (const p of out) { if (p.ui || !p.scene?.items) continue; const keep = [];
    for (const it of p.scene.items) { if ((it.L === "DIMS" && (it.t === "text" || it.lbl)) || (it.L === "TEXT" && it.t === "text" && /^(crane|load|boom|tip|travel)/.test(p.key))) lab.items.push(it); else keep.push(it); }
    if (keep.length !== p.scene.items.length) p.scene.items = keep; }
  if (lab.items.length) out.push({ key: "dimlabels", scene: lab, nohit: true });
  return out;
}
function gridMarkup(b) {
  if (!plan.site.grid) return "";
  const x0 = Math.floor(b[0] / 5) * 5, x1 = Math.ceil(b[2] / 5) * 5, y0 = Math.floor(b[1] / 5) * 5, y1 = Math.ceil(b[3] / 5) * 5;
  let d = "";
  for (let x = x0; x <= x1; x += 5) d += `M${x} ${-y1}L${x} ${-y0}`;
  for (let y = y0; y <= y1; y += 5) d += `M${x0} ${-y}L${x1} ${-y}`;
  return `<path d="${d}" stroke="#d9dee4" stroke-width="0.04" fill="none"/>`;
}
function bgMarkup(url) {
  const bg = plan.site.bg; if (!bg) return "";
  const W = bg.w * bg.mpp, H = bg.h * bg.mpp;
  return `<image href="${url || bg.url || ("/_blob/" + bg.asset)}" x="${bg.x}" y="${-bg.y}" width="${W}" height="${H}" preserveAspectRatio="none" opacity="${bg.opacity ?? 0.85}"/>`;
}
function worldBounds(parts) {
  let b = [1e9, 1e9, -1e9, -1e9];
  for (const p of parts) { const q = p.scene.bounds(); b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])]; }
  if (plan.site.bg) { const bg = plan.site.bg; b = [Math.min(b[0], bg.x), Math.min(b[1], bg.y - bg.h * bg.mpp), Math.max(b[2], bg.x + bg.w * bg.mpp), Math.max(b[3], bg.y)]; }
  if (b[0] > b[2]) b = [-20, -20, 20, 20];
  return b;
}

// ---------- site view (interactive) ----------
const view = { cx: 0, cy: 0, s: 12 };  // s = px per metre
let lastParts = [];
function fitView() {
  const b = worldBounds((allMode ? withAll(() => siteParts(plan.phase)) : siteParts(plan.phase)).filter(p => !p.ui));
  const r = $("site").getBoundingClientRect();
  view.cx = (b[0] + b[2]) / 2; view.cy = (b[1] + b[3]) / 2;
  view.s = Math.max(2, Math.min((r.width - 40) / (b[2] - b[0] + 4), (r.height - 40) / (b[3] - b[1] + 4)));
  renderSite();
}
function renderSite() {
  if (drag && drag.op && drag.op.crane) autoBoom(drag.op.crane); else if (drag && drag.key && drag.key.startsWith("crane:")) { const c = plan.cranes.find(x => "crane:" + x.id === drag.key); if (c) autoBoom(c); }
  if (typeof V3 !== "undefined" && V3.mode !== "top") { render3D(); return; }
  const empty = !allMode && !plan.site.bg && !plan.site.cad && !plan.cranes.length && !plan.loads.length && !plan.obstacles.length && !(plan.lifts || []).some(L => L.cranes.length || L.loads.length);
  $("welcome").hidden = !empty || tool.mode !== null || calib.active;
  if (!calib.active && !tool.mode) $("hint").textContent = empty ? "" : allMode ? "All lifts overview · click any crane or load to open its lift for editing · drag a blue lift tag to move it (double-click puts it back)" : "Drag the crane body to move it · drag the boom or its tip to swing it (drops snap onto lifting points) · round handles rotate · Delete removes · Ctrl+Z undoes";
  $("hint").hidden = !$("hint").textContent;
  const svg = $("site"), r = svg.getBoundingClientRect();
  const W = r.width / view.s, H = r.height / view.s;
  svg.setAttribute("viewBox", `${view.cx - W / 2} ${-view.cy - H / 2} ${W} ${H}`);
  const parts = allMode ? allSiteParts(plan.phase) : siteParts(plan.phase, true); lastParts = parts;
  const b = [view.cx - W / 2, view.cy - H / 2, view.cx + W / 2, view.cy + H / 2];
  let m = bgMarkup() + gridMarkup(b) + (typeof vesselImgsMarkup === "function" ? vesselImgsMarkup() : "");
  // the other lifts, faded, for context
  if (!allMode && plan.lifts && plan.lifts.length > 1) plan.lifts.forEach((L, i) => { if (i === plan.al) return; const op = withLift(i, () => siteParts(plan.phase, false, true)); m += `<g opacity=".22" pointer-events="none">${op.map(p => sceneMarkup(p.scene, 0.05)).join("")}</g>`; });
  let selBox = null;
  for (const p of parts) {
    const [k, id] = p.key.split(":");
    const isSel = !allMode && sel && id === sel.id && ((sel.kind === "crane" && (k === "crane" || k === "boom")) || (sel.kind === k && (k !== "load" || !sel.ph || p.key.endsWith(":" + (sel.ph || "")) || plan.phase !== "both")));
    if (isSel) { const q = p.scene.bounds(); selBox = selBox ? [Math.min(selBox[0], q[0]), Math.min(selBox[1], q[1]), Math.max(selBox[2], q[2]), Math.max(selBox[3], q[3])] : q; }
    const cur = p.nohit ? "" : k === "boom" || k === "tip" ? "crosshair" : k.startsWith("h") || k === "lrot" ? "pointer" : "move";
    // thin site items (fences, walls, quay edges, outlines): an invisible 14 px band along every edge so a tap on the line selects it
    const grab = !p.nohit && k === "obs" ? p.scene.items.filter(it => it.t === "poly" && it.pts.length > 1).map(it => `<path d="${it.pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(2) + " " + (-q[1]).toFixed(2)).join("")}${it.closed ? "Z" : ""}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="14" vector-effect="non-scaling-stroke" pointer-events="stroke"/>`).join("") : "";
    m += `<g data-key="${p.key}"${p.nohit ? ' pointer-events="none"' : ` style="cursor:${cur}"`}>${sceneMarkup(p.scene, 0.05)}${grab}</g>`;
  }
  if (selBox) { const pad = 0.6; m = m.replace(/(<g data-key)/, `<rect x="${selBox[0] - pad}" y="${-selBox[3] - pad}" width="${selBox[2] - selBox[0] + 2 * pad}" height="${selBox[3] - selBox[1] + 2 * pad}" fill="none" stroke="#d9661f" stroke-width="${1.2 / view.s}" stroke-dasharray="${6 / view.s} ${4 / view.s}" pointer-events="none"/>$1`); }
  // snap target / tool previews
  if (drag && drag.snapPt) m += `<circle cx="${drag.snapPt[0]}" cy="${-drag.snapPt[1]}" r="${12 / view.s}" fill="none" stroke="#1d7a4f" stroke-width="${2.5 / view.s}"/>`;
  if (drag && drag.targets) for (const t of drag.targets) m += `<circle cx="${t.p[0]}" cy="${-t.p[1]}" r="${5 / view.s}" fill="#1d7a4f" opacity=".55" pointer-events="none"/>`;
  if (tool.mode) {
    const P = [...tool.pts, ...(tool.hover ? [tool.hover] : [])];
    if (P.length > 1) m += `<polyline points="${P.map(p => `${p[0]},${-p[1]}`).join(" ")}" fill="${tool.mode === "zone" ? "rgba(192,57,43,.12)" : tool.mode === "obj" && OBJ_TYPES[tool.objType]?.kind === "poly" ? "rgba(120,130,140,.15)" : "none"}" stroke="${tool.mode === "zone" ? "#c0392b" : tool.mode === "obj" ? (OBJ_TYPES[tool.objType]?.color || "#16202a") : "#16202a"}" stroke-width="${1.6 / view.s}" stroke-dasharray="${5 / view.s} ${3 / view.s}"/>`;
    for (const p of tool.pts) m += `<circle cx="${p[0]}" cy="${-p[1]}" r="${4 / view.s}" fill="#c0392b"/>`;
    if (tool.snap) m += `<circle cx="${tool.snap[0]}" cy="${-tool.snap[1]}" r="${9 / view.s}" fill="none" stroke="#1d7a4f" stroke-width="${2 / view.s}"/>`;
  }
  // scale bar
  const nice = [1, 2, 5, 10, 20, 50, 100].find(v => v * view.s >= 70) || 100, sx = b[0] + 16 / view.s, sy = b[1] + 18 / view.s;
  m += `<g pointer-events="none"><path d="M${sx} ${-sy}h${nice}" stroke="#16202a" stroke-width="${3 / view.s}"/><text x="${sx + nice / 2}" y="${-sy - 6 / view.s}" font-size="${11 / view.s}" text-anchor="middle" fill="#16202a">${nice} m</text></g>`;
  if (calib.active) for (const p of calib.pts) m += `<circle cx="${p[0]}" cy="${-p[1]}" r="${6 / view.s}" fill="#d9661f"/>`;
  svg.innerHTML = m;
}
function toWorld(ev) {
  const svg = $("site"), r = svg.getBoundingClientRect();
  return [view.cx + (ev.clientX - r.left - r.width / 2) / view.s, view.cy - (ev.clientY - r.top - r.height / 2) / view.s];
}
let drag = null;
const tool = { mode: null, pts: [], hover: null, snap: null };
// snapping candidates: lifting points of loads for a phase
function liftTargets(phase) {
  const T = [];
  for (const ld of plan.loads) {
    normLoad(ld);
    const pts = ld.span > 0 ? ["A", "B", "C"] : ["C"];
    for (const p of pts) T.push({ load: ld.id, point: p, p: liftPointWorld(ld, p, phase), name: `${ld.name} ${p === "C" ? "centre" : "point " + p}` });
  }
  return T;
}
function snapPoints() {
  const P = [];
  for (const c of plan.cranes) P.push([c.x, c.y]);
  for (const ld of plan.loads) for (const ph of ["pick", "set"]) { P.push([ld[ph].x, ld[ph].y]); if (ld.span) for (const q of ["A", "B"]) P.push(liftPointWorld(ld, q, ph)); }
  for (const o of plan.obstacles) { if (o.kind !== "dim") { P.push(...(o.kind === "circle" ? [[o.x, o.y]] : obsPts(o))); } }
  return P;
}
function nearest(P, w, maxPx) { let best = null, bd = maxPx / view.s; for (const p of P) { const d = Math.hypot(p[0] - w[0], p[1] - w[1]); if (d <= bd) { bd = d; best = p; } } return best; }
function objPos(key) {
  const [kind, id, ph] = key.split(":");
  const crane = plan.cranes.find(c => c.id === id), obs = plan.obstacles.find(o => o.id === id), load = plan.loads.find(l => l.id === id);
  if (kind === "crane") { if (!crane) return null; const carry = matsToCarry(crane); return { get: () => [crane.x, crane.y], set: (x, y) => { const dx = x - crane.x, dy = y - crane.y; crane.x = x; crane.y = y; carry.forEach(m => { m.x = Math.round((m.x + dx) * 100) / 100; m.y = Math.round((m.y + dy) * 100) / 100; }); } }; }
  if (kind === "load") { const p = load && load[ph]; return p && { get: () => [p.x, p.y], set: (x, y) => { p.x = x; p.y = y; } }; }
  if (kind === "tip" || kind === "boom") {
    if (!crane) return null;
    return { boom: true, crane, phase: ph, get: () => { const e = evalCrane(crane, ph); return e.hook ? [...e.hook] : [crane.x, crane.y + 10]; },
      carry: !!carrying(crane, ph), set: (x, y) => moveHook(crane, ph, x, y) };
  }
  if (kind === "hrot" && crane) { const carry = matsToCarry(crane); return { abs: true, set: (x, y) => { const h0 = +crane.heading || 0; crane.heading = Math.round(bearingDeg(x - crane.x, y - crane.y)) % 360; const d = crane.heading - h0; if (d) carry.forEach(m => { const r = rot2([m.x - crane.x, m.y - crane.y], -d); m.x = Math.round((crane.x + r[0]) * 100) / 100; m.y = Math.round((crane.y + r[1]) * 100) / 100; m.rot = ((+m.rot || 0) + d) % 360; }); }, info: () => `Heading ${crane.heading}°` }; }
  if (kind === "hrot" && obs) return { abs: true, set: (x, y) => { obs.rot = Math.round(bearingDeg(x - obs.x, y - obs.y)) % 360; }, info: () => `Rotation ${obs.rot}°` };
  if (kind === "lrot" && load) return { abs: true, set: (x, y) => { let r = Math.round(bearingDeg(x - load[ph].x, y - load[ph].y) - 90); load[ph].rot = ((r % 360) + 540) % 360 - 180; }, info: () => `Load rotation ${load[ph].rot}°` };
  if (kind === "hsz" && obs) {
    if (obs.kind === "circle") return { abs: true, set: (x, y) => { obs.r = Math.max(0.3, Math.round(Math.hypot(x - obs.x, y - obs.y) * 10) / 10); }, info: () => `Radius ${fx(obs.r)} m` };
    return { abs: true, set: (x, y) => { const l = rot2([x - obs.x, y - obs.y], obs.rot || 0); obs.w = Math.max(0.3, Math.round(Math.abs(l[0]) * 20) / 10); obs.h = Math.max(0.3, Math.round(Math.abs(l[1]) * 20) / 10); }, info: () => `${fx(obs.w)} × ${fx(obs.h)} m` };
  }
  if (kind === "hv" && obs) { const i = +ph; return { abs: true, snap: true, set: (x, y) => { obs.pts[i] = [x, y]; }, info: () => obs.kind === "dim" ? `${fx(Math.hypot(obs.pts[1][0] - obs.pts[0][0], obs.pts[1][1] - obs.pts[0][1]), 2)} m` : `Point ${i + 1}` }; }
  if (kind === "hmid" && obs) { const i = +ph; return { abs: true, insert: i, set: (x, y) => { obs.pts[i + 1] = [x, y]; }, info: () => `New point` }; }
  if (kind === "obs" && obs && isMat(obs)) { const cr = plan.cranes.find(c => matsToCarry(c).includes(obs));
    if (cr) { const mv = objPos("crane:" + cr.id); return { get: () => [obs.x, obs.y], set: (x, y) => mv.set(cr.x + (x - obs.x), cr.y + (y - obs.y)), info: () => `${cr.label} and its mats` }; } }
  if (kind === "obs" && obs) {
    if (obs.pts) return { get: () => centroid(obs.pts), set: (x, y) => { const c = centroid(obs.pts), dx = x - c[0], dy = y - c[1]; obs.pts = obs.pts.map(p => [p[0] + dx, p[1] + dy]); } };
    return { get: () => [obs.x, obs.y], set: (x, y) => { obs.x = x; obs.y = y; } };
  }
  return null;
}
function dragInfo(txt, e) {
  const el = $("dragInfo"); if (!txt) { el.hidden = true; return; }
  const r = $("site").getBoundingClientRect(), c = el.parentElement.getBoundingClientRect();
  el.innerHTML = txt; el.hidden = false;
  el.style.left = Math.min(e.clientX - c.left + 16, c.width - el.offsetWidth - 8) + "px"; el.style.top = Math.max(4, e.clientY - c.top - 44) + "px";
}
function boomInfo(cr, ph, snapName) {
  const e = evalCrane(cr, ph), S = craneSummary(cr);
  return `<b>${escH(cr.label)}</b> · R ${fx(e.R, 2)} m · slew ${fx(e.bearing, 0)}°<br>cap ${e.cap != null ? fx(e.cap) + " t" : "–"} · util ${S.util != null ? fx(S.util, 1) + "%" : "–"}${snapName ? `<br><span style="color:#6fd39b">↘ drop to hook onto ${escH(snapName)}</span>` : ""}`;
}
function finishTool() {
  if (tool.mode === "zone" && tool.pts.length >= 3) { const o = { id: uid(), kind: "poly", label: "Exclusion zone", zone: true, pts: tool.pts.map(p => [...p]) }; plan.obstacles.push(o); sel = { kind: "obs", id: o.id }; markDirty(); }
  if (tool.mode === "obj" && tool.objType) { const T = OBJ_TYPES[tool.objType]; if (tool.pts.length >= (T.kind === "line" ? 2 : 3)) { const o = makeObject(tool.objType, null, tool.pts); plan.obstacles.push(o); sel = { kind: "obs", id: o.id }; markDirty(); } }
  if (tool.mode === "dim" && tool.pts.length === 2) { const o = { id: uid(), kind: "dim", label: "", pts: tool.pts.map(p => [...p]) }; plan.obstacles.push(o); sel = { kind: "obs", id: o.id }; markDirty(); }
  setTool(null); renderAll();
}
function setTool(mode) {
  tool.mode = mode; tool.pts = []; tool.hover = null; tool.snap = null;
  $("tZone").setAttribute("aria-pressed", mode === "zone"); $("tDim").setAttribute("aria-pressed", mode === "dim");
  $("site").style.cursor = mode ? "crosshair" : "";
  $("hint").textContent = mode === "zone" ? "Click to place the zone corners · click the first point, double-click or press Enter to finish · Esc cancels" : mode === "dim" ? "Click two points to dimension (snaps to cranes, loads and corners) · Esc cancels" : "";
  $("hint").hidden = !mode && !$("hint").textContent; if (mode) $("welcome").hidden = true;
  renderSite();
}
function setupSiteEvents() {
  const svg = $("site");
  svg.addEventListener("pointerdown", e => {
    const w = toWorld(e);
    if (calib.active) { calibClick(w); return; }
    if (tool.mode) {
      const p = tool.snap || w;
      // double-click to finish (the SVG is redrawn between clicks, so detect it here)
      const now = performance.now(), lp = tool._last;
      tool._last = { t: now, x: e.clientX, y: e.clientY };
      if ((tool.mode === "zone" || tool.mode === "obj") && lp && now - lp.t < 380 && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) < 8) { finishTool(); return; }
      if ((tool.mode === "zone" || (tool.mode === "obj" && OBJ_TYPES[tool.objType]?.kind === "poly")) && tool.pts.length >= 3 && Math.hypot(p[0] - tool.pts[0][0], p[1] - tool.pts[0][1]) < 10 / view.s) { finishTool(); return; }
      tool.pts.push([Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]);
      if (tool.mode === "dim" && tool.pts.length === 2) finishTool(); else renderSite();
      return;
    }
    const g = e.target.closest("g[data-key]");
    if (allMode && g && g.dataset.key.startsWith("liftlbl:")) {
      const i = plan.lifts.findIndex(L => "liftlbl:" + L.id === g.dataset.key), q = liftTagPos(plan.lifts[i], []);
      const cur = lastParts.find(p => p.key === g.dataset.key)?.scene.bounds(), c = cur ? [(cur[0] + cur[2]) / 2, (cur[1] + cur[3]) / 2] : q;
      const now = performance.now(), lk = lastLblClick; lastLblClick = { t: now, key: g.dataset.key };
      if (lk && lk.key === g.dataset.key && now - lk.t < 400) { const L = plan.lifts[i]; if (L.lblPos) { delete L.lblPos; markDirty(); renderSite(); toast("Lift tag back to its automatic position"); } return; }
      svg.setPointerCapture(e.pointerId); drag = { mode: "lbl", i, off: [w[0] - c[0], w[1] - c[1]], moved: false }; return;
    }
    if (allMode && g) { const id = g.dataset.key.split(":")[1], i = liftOf(id); if (i >= 0) { const kind = plan.lifts[i].cranes.some(c => c.id === id) ? "crane" : "load"; switchLift(i); sel = { kind, id }; renderAll(); } return; }
    svg.setPointerCapture(e.pointerId);
    if (g) {
      const key = g.dataset.key, op = objPos(key); if (!op) return;
      const [kind, id, ph] = key.split(":");
      const selKind = ["crane", "boom", "tip"].includes(kind) || (kind === "hrot" && plan.cranes.some(c => c.id === id)) ? "crane" : kind === "load" || kind === "lrot" ? "load" : "obs";
      const prevSel = sel && sel.id === id;
      sel = { kind: selKind, id, ph: kind === "load" || kind === "lrot" ? ph : undefined };
      if ((kind === "boom" || kind === "tip") && plan.phase !== "both") plan.phase = ph;
      if (op.insert != null) { const o = plan.obstacles.find(x => x.id === id); o.pts.splice(op.insert + 1, 0, [...w]); }
      drag = { mode: "obj", key, op, start: w, o0: op.get ? op.get() : null, moved: false, targets: op.boom && !op.carry ? liftTargets(ph) : null };
      if (!prevSel) { renderLists(); renderProps(); }
      renderSite();
    } else {
      if (sel) { sel = null; renderPanels(); renderSite(); }
      drag = { mode: "pan", sx: e.clientX, sy: e.clientY, c0: [view.cx, view.cy] }; svg.classList.add("drag");
    }
  });
  svg.addEventListener("pointermove", e => {
    const w = toWorld(e); $("cursorXY").textContent = `E ${fx(w[0], 2)}  N ${fx(w[1], 2)} m`;
    if (tool.mode) { tool.snap = e.shiftKey ? null : nearest(snapPoints(), w, 12); tool.hover = tool.snap || w; if (tool.mode === "dim" && tool.pts.length === 1) dragInfo(`${fx(Math.hypot(tool.hover[0] - tool.pts[0][0], tool.hover[1] - tool.pts[0][1]), 2)} m`, e); renderSite(); return; }
    if (!drag) return;
    if (drag.mode === "lbl") { const L = plan.lifts[drag.i]; L.lblPos = { x: Math.round((w[0] - drag.off[0]) * 10) / 10, y: Math.round((w[1] - drag.off[1]) * 10) / 10 }; drag.moved = true; renderSite(); return; }
    if (drag.mode === "pan") { view.cx = drag.c0[0] - (e.clientX - drag.sx) / view.s; view.cy = drag.c0[1] + (e.clientY - drag.sy) / view.s; renderSite(); return; }
    const snap = v => e.shiftKey ? v : Math.round(v * 10) / 10;
    const op = drag.op;
    if (op.abs) {
      let p = w;
      if (op.snap && !e.shiftKey) p = nearest(snapPoints(), w, 12) || [snap(w[0]), snap(w[1])];
      op.set(p[0], p[1]); drag.moved = true; dragInfo(op.info ? op.info() : "", e);
    } else {
      const dx = w[0] - drag.start[0], dy = w[1] - drag.start[1];
      let tx = drag.o0[0] + dx, ty = drag.o0[1] + dy;
      drag.snapPt = null; drag.snapTarget = null;
      if (op.boom && !e.shiftKey) {
        let best = null, bd = 16 / view.s;
        for (const t of drag.targets || []) { const d = Math.hypot(t.p[0] - tx, t.p[1] - ty); if (d < bd) { bd = d; best = t; } }
        if (best) { drag.snapPt = best.p; drag.snapTarget = best; tx = best.p[0]; ty = best.p[1]; }
      }
      op.set(op.boom && drag.snapPt ? tx : snap(tx), op.boom && drag.snapPt ? ty : snap(ty)); drag.moved = true;
      if (op.boom) dragInfo(boomInfo(op.crane, op.phase, drag.snapTarget?.name), e);
      else dragInfo(`E ${fx(op.get()[0], 1)} · N ${fx(op.get()[1], 1)}`, e);
    }
    renderSite(); scheduleSide();
  });
  svg.addEventListener("dblclick", e => {
    if (tool.mode === "zone" || tool.mode === "obj") { const min = tool.mode === "obj" && OBJ_TYPES[tool.objType]?.kind === "line" ? 2 : 3; if (tool.pts.length > min) tool.pts.pop(); finishTool(); return; }
    const g = e.target.closest("g[data-key]"); if (!g) return;
    const [kind, id, i] = g.dataset.key.split(":");
    if (kind === "hv") { const o = plan.obstacles.find(x => x.id === id); if (o && ((o.kind === "poly" && o.pts.length > 3) || (o.kind === "line" && o.pts.length > 2))) { o.pts.splice(+i, 1); markDirty(); renderAll(); } }
  });
  const end = () => {
    if (drag && drag.mode === "lbl") { const i = drag.i, mv = drag.moved; drag = null; if (mv) { markDirty(); renderSite(); } return; }
    if (drag && drag.moved) {
      if (drag.op.boom && drag.snapTarget) { const c = drag.op.crane; c.attach = { load: drag.snapTarget.load, point: drag.snapTarget.point }; if (c.tip) c.tip[drag.op.phase] = null; toast(`${c.label} hooked onto ${drag.snapTarget.name}`); }
      markDirty(); renderAll();
    }
    drag = null; svg.classList.remove("drag"); $("dragInfo").hidden = true; renderSite();
  };
  svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
  svg.addEventListener("wheel", e => { e.preventDefault(); const w = toWorld(e); const f = Math.exp(-e.deltaY * 0.0015); view.s = Math.max(1, Math.min(200, view.s * f)); const w2 = toWorld(e); view.cx += w[0] - w2[0]; view.cy += w[1] - w2[1]; renderSite(); }, { passive: false });
  $("zFit").onclick = () => { if (V3.mode !== "top") { V3.zoom = 1; V3.pan = [0, 0]; render3D(); } else fitView(); }; $("zIn").onclick = () => { view.s *= 1.25; renderSite(); }; $("zOut").onclick = () => { view.s /= 1.25; renderSite(); };
  $("tZone").onclick = () => setTool(tool.mode === "zone" ? null : "zone");
  $("tDim").onclick = () => setTool(tool.mode === "dim" ? null : "dim");
  $("tUndo").onclick = undo; $("tRedo").onclick = redo;
  window.addEventListener("resize", () => renderSite());
}
let sideTimer = null;
function scheduleSide() { clearTimeout(sideTimer); sideTimer = setTimeout(() => { renderChecks(); renderElev(); }, 60); }

// ---------- panels ----------
function markDirty(live) { syncLift(); dirty = true; plan.updated = Date.now(); refreshSaveState(); clearTimeout(hist.t); if (live) hist.t = setTimeout(pushHistory, 400); else pushHistory(); }
function refreshSaveState() { $("saveState").textContent = !CAP.db ? "Saving unavailable here" : dirty ? "Unsaved changes" : "Saved"; }
// ---------- undo / redo ----------
const hist = { stack: [], i: -1, t: null };
function pushHistory() {
  clearTimeout(hist.t); hist.t = null;
  const snap = JSON.stringify(plan);
  if (hist.stack[hist.i] === snap) return;
  hist.stack = hist.stack.slice(0, hist.i + 1); hist.stack.push(snap);
  if (hist.stack.length > 120) hist.stack.shift();
  hist.i = hist.stack.length - 1; refreshUndo();
}
function resetHistory() { hist.stack = [JSON.stringify(plan)]; hist.i = 0; refreshUndo(); }
function refreshUndo() { if ($("tUndo")) { $("tUndo").disabled = hist.i <= 0; $("tRedo").disabled = hist.i >= hist.stack.length - 1; } }
function restoreHist(i) {
  hist.i = i; plan = normalizePlan(JSON.parse(hist.stack[i]));
  if (sel && !(plan.cranes.some(c => c.id === sel.id) || plan.loads.some(l => l.id === sel.id) || plan.obstacles.some(o => o.id === sel.id))) sel = null;
  dirty = true; refreshSaveState(); refreshUndo(); renderMeta(); renderAll();
}
function undo() { if (hist.t) pushHistory(); if (hist.i > 0) restoreHist(hist.i - 1); }
function redo() { if (hist.i < hist.stack.length - 1) restoreHist(hist.i + 1); }
// load a plan into the editor
function openPlan(p, isDirty) { plan = normalizePlan(p); migrateMats(plan); allMode = false; plan.loads.forEach(normLoad); sel = null; dirty = !!isDirty; setTool(null); renderMeta(); renderAll(); fitView(); refreshSaveState(); resetHistory(); if (typeof renderLiftBar === "function") renderLiftBar(); }
// remove a crane / load / site item (Ctrl+Z or the toast brings it back)
function removeItem(kind, id) {
  let name = "";
  if (kind === "crane") { const c = plan.cranes.find(x => x.id === id); name = c?.label; plan.cranes = plan.cranes.filter(x => x.id !== id); }
  else if (kind === "load") { const l = plan.loads.find(x => x.id === id); name = l?.name; plan.loads = plan.loads.filter(x => x.id !== id); plan.cranes.forEach(c => { if (c.attach?.load === id) c.attach.load = ""; }); }
  else { const o = plan.obstacles.find(x => x.id === id); name = o?.label || (o?.kind === "dim" ? "Dimension" : "Site item"); plan.obstacles = plan.obstacles.filter(x => x.id !== id); }
  if (sel && sel.id === id) sel = null;
  markDirty(); pushHistory(); renderAll();
  const t = $("toast"); t.innerHTML = `${escH(name || "Item")} removed <button id="undoRm" style="margin-left:10px">Undo</button>`; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 7000);
  $("undoRm").onclick = () => { undo(); t.hidden = true; };
}
document.addEventListener("keydown", e => {
  const typing = e.target.closest("input,textarea,select,[contenteditable]"), dlg = document.querySelector("dialog[open]");
  if (dlg) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); savePlan(); return; }
  if (typing) return;
  if (e.key === "Escape") { if (tool.mode) setTool(null); else if (sel) { sel = null; renderPanels(); renderSite(); } return; }
  if (e.key === "Enter" && (tool.mode === "zone" || tool.mode === "obj")) { finishTool(); return; }
  if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); removeItem(sel.kind, sel.id); return; }
  if (sel && e.key.startsWith("Arrow")) {
    e.preventDefault();
    const st = e.shiftKey ? 1 : 0.1, d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
    const key = sel.kind === "load" ? `load:${sel.id}:${sel.ph || (plan.phase === "set" ? "set" : "pick")}` : `${sel.kind}:${sel.id}`;
    const op = objPos(key); if (op && op.get) { const p = op.get(); op.set(Math.round((p[0] + d[0]) * 100) / 100, Math.round((p[1] + d[1]) * 100) / 100); markDirty(); renderAll(true); }
  }
});
function renderLists() {
  const cl = $("craneList");
  cl.innerHTML = plan.cranes.map(c => {
    const ev = craneSummary(c), C = REG.cranes[c.model];
    return `<div class="item ${sel?.kind === "crane" && sel.id === c.id ? "sel" : ""}" data-sel="crane:${c.id}"><span class="dot" style="background:${c.paint || c.color};box-shadow:0 0 0 1px ${c.color}"></span><span class="t">${escH(c.label)} · ${escH(C ? C.short : c.model)}</span><span class="pill ${ev.status}">${ev.util == null ? "–" : fx(ev.util, 0) + "%"}</span><button class="rm" title="Remove" data-rm="crane:${c.id}">×</button></div>`;
  }).join("") || `<p class="small">No cranes yet.</p>`;
  $("loadList").innerHTML = plan.loads.map(l => `<div class="item ${sel?.kind === "load" && sel.id === l.id ? "sel" : ""}" data-sel="load:${l.id}"><span class="dot" style="background:#34393f"></span><span class="t">${escH(l.name)}</span><span class="s">${fx(l.weight)} t</span><button class="rm" title="Remove" data-rm="load:${l.id}">×</button></div>`).join("") || `<p class="small">No loads yet.</p>`;
  $("obsList").innerHTML = plan.obstacles.filter(o => !isMat(o)).map(o => `<div class="item ${sel?.kind === "obs" && sel.id === o.id ? "sel" : ""}" data-sel="obs:${o.id}"><span class="dot" style="background:${o.kind === "dim" ? "#16202a" : o.color || (o.zone ? "#c0392b" : "#8a8f94")}"></span><span class="t">${o.kind === "dim" ? `${escH(o.label || "Dimension")} · ${fx(Math.hypot(o.pts[1][0] - o.pts[0][0], o.pts[1][1] - o.pts[0][1]), 2)} m` : escH(o.label || (o.zone ? "Zone" : (typeof OBJ_TYPES !== "undefined" && OBJ_TYPES[o.type]?.name) || "Object"))}</span><button class="rm" title="Remove" data-rm="obs:${o.id}">×</button></div>`).join("") || `<p class="small">Add buildings, light towers, quay edges or exclusion zones.</p>`;
  document.querySelectorAll("button.rm[data-rm]").forEach(b => b.onclick = e => { e.stopPropagation(); const [k, id] = b.dataset.rm.split(":"); removeItem(k, id); });
  document.querySelectorAll("[data-sel]").forEach(el => el.onclick = () => { const [k, id] = el.dataset.sel.split(":"); sel = { kind: k, id }; renderPanels(); renderSite(); });
}
function field(label, id, val, type = "number", attrs = "") { return `<label>${label}<input type="${type}" id="${id}" value="${escH(val)}" ${attrs}></label>`; }
// ---- one crane used in several lifts: its machine settings are kept the same in every lift
// (position, radius, slew, hook and the load it is on stay per lift)
const CRANE_SHARED = ["matLock", "label", "model", "paint", "color", "orMode", "sl", "chartId", "col", "L", "boomCfg", "autoBoom", "hookBlock", "hbWSet", "blockCap", "blockCapOther", "blockType", "btSet", "parts", "partsSet", "linePull", "extra", "capManual", "capManualR", "capManualChart", "wCrane", "wCw", "matOri", "matLen", "matWid"];
function craneShared(c) { const o = {}; for (const k of CRANE_SHARED) o[k] = JSON.stringify(c[k]); return o; }
function craneTwins(c) {
  syncLift(); const u = c.unit || c.id, out = [];
  for (const L of plan.lifts) for (const x of L.cranes) if (x !== c && ((x.unit || x.id) === u || (!x.unit && !c.unit && x.label === c.label && x.model === c.model))) out.push(x);
  if (out.length) { c.unit = u; out.forEach(x => x.unit = u); }
  return out;
}
function syncCraneAcrossLifts(c, before) {
  const now = craneShared(c), changed = CRANE_SHARED.filter(k => now[k] !== before[k]); if (!changed.length) return 0;
  // twins are found with the OLD label/model so a rename or model change still reaches them
  const probe = { ...c, label: JSON.parse(before.label ?? "null") ?? c.label, model: JSON.parse(before.model ?? "null") ?? c.model };
  const tw = craneTwins(probe); if (probe.unit) c.unit = probe.unit;
  // a typed capacity only holds at its radius: copy it only to lifts where this crane works at the same max radius
  let rSrc = null, skipped = 0;
  if (changed.includes("capManual")) rSrc = craneSummary(c).maxR;
  for (const x of tw) {
    let ks = changed;
    if (rSrc != null) {
      const i = plan.lifts.findIndex(L => L.cranes.includes(x)), rx = i >= 0 ? withLift(i, () => craneSummary(x).maxR) : null;
      if (rx == null || Math.abs(rx - rSrc) > 0.05) { ks = changed.filter(k => !/^capManual/.test(k)); skipped++; }
    }
    for (const k of ks) { if (c[k] === undefined) delete x[k]; else x[k] = clone(c[k]); }
  }
  if (skipped) setTimeout(() => toast(`Capacity copied only where ${c.label} works at the same radius (${fx(rSrc, 2)} m) – ${skipped} lift${skipped > 1 ? "s" : ""} left as they were`, 3200), 1900);
  return tw.length;
}
// ---- the same load moved in several lifts: its weight, CoG and the load-bottom heights follow it into every lift
// (where it is picked / set and how it is turned stay per lift)
const LOAD_SHARED = ["weight", "wInclRig", "cog", "pick.h", "set.h"];
const lget = (o, k) => k.includes(".") ? (o[k.split(".")[0]] || {})[k.split(".")[1]] : o[k];
function loadShared(l) { const o = {}; for (const k of LOAD_SHARED) o[k] = JSON.stringify(lget(l, k)); o._sig = loadLook(l); return o; }
function loadLook(l) { return JSON.stringify([l.kind, l.orient, ...["D", "W", "FW", "L", "H"].map(k => Math.round((+l[k] || 0) * 1000))]); }
function loadTwins(l, look) {
  syncLift(); const u = l.unit || l.id, out = [];
  for (const L of plan.lifts) for (const x of L.loads) if (x !== l && ((x.unit || x.id) === u || (!x.unit && !l.unit && loadLook(x) === look))) out.push(x);
  if (out.length) { l.unit = u; out.forEach(x => x.unit = u); }
  return out;
}
function syncLoadAcrossLifts(l, before) {
  const now = loadShared(l), changed = LOAD_SHARED.filter(k => now[k] !== before[k]); if (!changed.length) return 0;
  const tw = loadTwins(l, before._sig), done = new Set(tw);
  for (const x of tw) for (const k of changed) { const v = lget(l, k); if (k.includes(".")) { const [a, b2] = k.split("."); x[a] = x[a] || {}; x[a][b2] = v; } else x[k] = v; normLoad(x); }
  // load-bottom heights: also every load a crane lifts in the other lifts that still has the same old height
  // (so a plan whose lifts were built separately still follows along) – loads set to a different height are left alone
  for (const k of changed.filter(k => k === "pick.h" || k === "set.h")) {
    const [a, b2] = k.split("."), old = +(JSON.parse(before[k] ?? "0") || 0), v = lget(l, k);
    plan.lifts.forEach(L => { for (const x of L.loads) { if (x === l || done.has(x) || !L.cranes.some(c => c.attach?.load === x.id)) continue;
      if (Math.abs((+(x[a] || {})[b2] || 0) - old) < 1e-6) { x[a] = x[a] || {}; x[a][b2] = v; done.add(x); } } });
  }
  return done.size;
}
function renderProps() {
  const p = $("props");
  if (!sel) { p.innerHTML = `<h3>Selected</h3><p class="small">Click a crane, load or site item on the plan or in the lists above.</p>`; return; }
  const up = (fn, full) => {
    const cr0 = sel.kind === "crane" ? plan.cranes.find(x => x.id === sel.id) : null, before = cr0 ? craneShared(cr0) : null;
    const ld0 = sel.kind === "load" ? plan.loads.find(x => x.id === sel.id) : null, lbefore = ld0 ? loadShared(ld0) : null;
    fn();
    if (cr0) { const n = syncCraneAcrossLifts(cr0, before); if (n) toast(`Also updated ${cr0.label} in ${n} other lift${n > 1 ? "s" : ""}`, 1800); }
    if (ld0) { const n = syncLoadAcrossLifts(ld0, lbefore); if (n) toast(`Also updated ${ld0.name} in ${n} other lift${n > 1 ? "s" : ""}`, 1800); }
    markDirty(); renderAll(!full); if (full) renderProps();
  };
  if (sel.kind === "crane") {
    const c = plan.cranes.find(x => x.id === sel.id); if (!c) { sel = null; return renderProps(); }
    const C = REG.cranes[c.model];
    if (C) ensureBoom(c, C);
    const charts = chartsFor(c.model), chart = REG.charts[c.chartId];
    const hbList = C?.hookblocks || [], hbCap = C ? blockCapOf(c, C) : +c.blockCap || 0, hbRef = hbList.find(h => Math.abs(h[0] - hbCap) < 1e-6);
    const hbKnown = !!hbRef && !c.blockCapOther;
    const hbOpts = hbList.map(([cap]) => `<option value="${cap}" ${hbKnown && Math.abs(cap - hbCap) < 1e-6 ? "selected" : ""}>${cap} t block</option>`).join("");
    const tipRow = ph => { const t = (c.tip || {})[ph], fr = t && t.free; return `<div class="row"><label>${ph === "pick" ? "Pick" : "Set"} – hook<select id="pTip_${ph}"><option value="load" ${fr ? "" : "selected"}>On the load</option><option value="free" ${fr ? "selected" : ""}>Moved off load</option></select></label>
        ${fr ? `<div class="row" style="gap:6px">${field("Radius", "pTR_" + ph, t.R, "number", 'step="0.1"')}${field("Slew °", "pTB_" + ph, t.brg, "number", 'step="1"')}</div>` : `<span></span>`}</div>`; };
    p.innerHTML = `<h3>${escH(c.label)} <button id="pDel" class="danger">Remove crane</button></h3>
      <h4>Crane</h4>
      <div class="row"><label>Label<input type="text" id="pLabel" value="${escH(c.label)}"></label>
      <label>Crane<select id="pModel" ${C && C.type === "ped" ? "disabled" : ""}>${Object.values(REG.cranes).filter(m => m.type !== "ped" || m.id === c.model).map(m => `<option value="${m.id}" ${m.id === c.model ? "selected" : ""}>${escH(m.name)}</option>`).join("")}</select></label></div>
      ${C && C.type === "ped" ? pedPropsHTML(c, C) : ""}
      <h4>Position &amp; colour</h4>
      <div class="row" ${C && C.type === "ped" ? "hidden" : ""}>${field("East (m)", "pX", c.x, "number", 'step="0.1"')}${field("North (m)", "pY", c.y, "number", 'step="0.1"')}</div>
      <label ${C && C.type === "ped" ? "hidden" : ""}>Carrier heading (° from north)<span style="display:grid;grid-template-columns:1fr 78px;gap:8px;align-items:center"><input type="range" id="pHr" min="0" max="359" step="1" value="${c.heading}"><input type="number" id="pH" min="0" max="359" step="0.5" value="${c.heading}"></span></label>
      <label>Crane colour<span class="swatches">${PAINTS.map(pt => `<button class="sw" data-paint="${pt.hex}" title="${pt.name}" aria-pressed="${(c.paint || "").toLowerCase() === pt.hex}" style="background:${pt.hex}"></button>`).join("")}<input type="color" id="pPaint" value="${c.paint || "#e8b90f"}" title="Any colour"></span></label>
      <h4>Set-up &amp; load chart</h4>
      ${C && C.or ? `<label>Outriggers<select id="pOr">${Object.keys(C.or.modes).map(m => `<option ${m === c.orMode ? "selected" : ""}>${escH(m)}</option>`).join("")}</select></label>` : ""}
      ${C && C.type === "cr" ? (() => { const S = slOf(c, C), hasSl = charts.some(ch => ch.slR != null);
        if (hasSl) return `<p class="small" style="margin:2px 0 6px"><b>Superlift:</b> ${S ? `SL ballast ${fx(S.T)} t hanging at ${fx(S.R)} m behind the crane (30 m SL mast) – from the chart. Swings through a ${fx(S.R + S.tray[0] / 2, 1)} m radius behind the crane.` : "none – this is an SH chart. Pick an SSL chart below for superlift."}</p>`;
        return `<div class="row"><label>Superlift radius<select id="pSl">${[0, ...((C.sl && C.sl.radii) || [11, 13, 15])].map(v => `<option value="${v}" ${+c.sl === v ? "selected" : ""}>${v ? "SL " + v + " m" : "None"}</option>`).join("")}</select></label>${+c.sl ? `<label>SL ballast (t)<input type="number" id="pSlT" step="10" min="0" value="${+c.slT || 0}"></label>` : ""}</div>`; })() : ""}
      <label>${C && C.type === "ped" ? "Load chart (harbour / offshore)" : "Load chart (outriggers · counterweight)"}<select id="pChart"><option value="">— none —</option>${charts.map(ch => `<option value="${ch.id}" ${ch.id === c.chartId ? "selected" : ""}>${escH(ch.label)}</option>`).join("")}</select></label>
      ${C ? `<div class="btnrow" style="margin-top:-2px"><button id="pChartEd">${chart ? "Check / correct this chart" : "Add a load chart"}</button></div>` : ""}
      ${!charts.length ? `<p class="small">${escH(C?.chartHint || "No load charts for this crane yet.")} Add them in Crane library.</p>` : ""}
      ${C && C.type === "ped" ? "" : `<h4>Boom &amp; capacity</h4>
      ${C ? boomPanel(c, C, chart) : ""}`}
      <h4>Load &amp; rigging</h4>
      <div class="row"><label>Load<select id="pLoad"><option value="">— none —</option>${plan.loads.map(l => `<option value="${l.id}" ${l.id === c.attach?.load ? "selected" : ""}>${escH(l.name)}</option>`).join("")}</select></label>
      <label>Lifting point<select id="pPt">${[["C", "Centre / single"], ["A", "Point A"], ["B", "Point B"]].map(([v, t]) => `<option value="${v}" ${c.attach?.point === v ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>
      ${(() => { const ld = plan.loads.find(l => l.id === c.attach?.load); if (!ld) return ""; const pr = ld.rig ? (RIG_PRESETS.find(p => p.id === ld.rig.preset)?.name || RIG_ARR[ld.rig.arr]?.name) : null;
        return `<div class="rigline"><span>Rigging: <b>${escH(pr || "none")}</b>${ld.rig?.auto ? ` <span class="tag">set by the app</span>` : ""}</span><button data-rig="${ld.id}">Rigging…</button></div>`; })()}
      <h4>Hook block</h4>
      <div class="row"><label>Block capacity<select id="pHb">${hbOpts}<option value="custom" ${hbKnown ? "" : "selected"}>Other…</option></select></label>
      ${hbKnown ? `<span></span>` : field("Block capacity (t)", "pHbC", c.blockCap ?? "", "number", 'step="1"')}</div>
      <div class="row">${field("Block weight (t) – from its certificate", "pHbW", c.hbWSet || !hbRef ? c.hookBlock : "", "number", `step="0.01" placeholder="${hbRef ? hbRef[1] + " t (crane data)" : "enter weight"}"`)}${field("Extra at hook (t)", "pEx", c.extra, "number", 'step="0.1"')}</div>
      <p class="small" style="margin-top:0;margin-bottom:0">${c.hbWSet ? `Block weight entered: <b>${fx(c.hookBlock, 2)} t</b> – added to the hook load.` : hbRef ? `Using the crane data value <b>${hbRef[1]} t</b> until you enter the weight from the block's certificate.` : "Enter the block weight – it is added to the hook load."}</p>
      ${(() => { const bd = C ? blockDims(c, C) : null; if (!bd) return ""; const S0 = craneSummary(c), perFall = S0.TW / bd.parts;
        return `<div class="btypes">${Object.entries(BLOCK_TYPES).map(([k, n]) => `<button class="btype" data-bt="${k}" aria-pressed="${bd.type === k}">${blockIcon(k)}<span>${n}</span></button>`).join("")}</div>
        <div class="row"><label>Parts of line (falls)<select id="pParts">${Array.from({ length: 16 }, (_, i) => i + 1).map(n => `<option ${n === bd.parts ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        ${field("Max line pull (t) – optional", "pLp", c.linePull ?? "", "number", 'step="0.1" placeholder="from the chart"')}</div>
        <p class="small">${bd.sheaves} sheave${bd.sheaves > 1 ? "s" : ""} in the head · ${fx(perFall, 2)} t per fall${+c.linePull > 0 ? (perFall > +c.linePull ? ` · <b style="color:var(--bad)">over the ${fx(c.linePull)} t line pull – add parts of line</b>` : ` · within ${fx(c.linePull)} t line pull`) : ""}</p>`; })()}
      <h4>Hook position &amp; radius</h4>
      ${(() => { const ph = plan.phase === "set" ? "set" : "pick", ev = evalCrane(c, ph), ld = carrying(c, ph);
        return `<label class="chk"><input type="checkbox" id="pCarry" ${c.carry !== false ? "checked" : ""}> Hooked on – the load moves with the hook</label>
        <label>Hook radius – ${ph} (m)<span style="display:grid;grid-template-columns:1fr 78px;gap:8px;align-items:center"><input type="range" id="pRr" min="${Math.max(1, Math.floor(C?.boom.pivot[0] + 2 || 3))}" max="${Math.ceil(C ? C.boom.Lmax + 2 : 60)}" step="0.1" value="${fx(ev.R, 1)}"><input type="number" id="pRn" step="0.1" value="${fx(ev.R, 2)}"></span></label>
        <div class="row">${field("Slew bearing – " + ph + " (°)", "pSlew", fx(ev.bearing, 1), "number", 'step="0.5"')}<p class="small" style="align-self:end;margin:0 0 6px">${ld ? `Moves ${escH(ld.name)} with the hook` : ev.free ? "Hook is off the load" : "Not on a load"}</p></div>`; })()}
      ${tipRow("pick")}${tipRow("set")}
      ${field("Max radius during the lift (m) – optional", "pRmax", c.rMax ?? "", "number", 'step="0.1" placeholder="auto: largest of pick / set"')}
      ${C && C.type === "ped" ? `<p class="small" style="margin-top:8px">Vessel crane – no ground bearing check. Pedestal and deck loads are covered by the vessel's crane certificate; check the sea state / harbour-lift chart you selected.</p>` : ""}
      ${C && C.type === "ped" ? "<div hidden>" : "<h4>Ground bearing</h4><div>"}
      <div class="row">${field("Crane weight (t)", "pWc", c.wCrane ?? "", "number", `step="0.1" placeholder="${C ? fx(C.mass?.base || 0) : ""} (model)"`)}${field("Counterweight (t)", "pWcw", c.wCw ?? "", "number", `step="0.1" placeholder="${chart && chart.cw != null ? fx(chart.cw) + " (chart)" : C ? fx(C.mass?.cw || 0) + " (model)" : ""}"`)}</div>
      </div>${C && C.type === "ped" ? "" : (() => { const M = matInfo(c, C), crw = C && C.type === "cr", m0 = M.mats[0], dL = crw ? (+c.matLen || (m0 ? matLW(m0)[0] : 6.0)) : m0 ? matLW(m0)[0] : 2.5, dW = crw ? (+c.matWid || (m0 ? matLW(m0)[1] : 1.2)) : m0 ? matLW(m0)[1] : 2.5;
        const nL = craneTwins(c).length, allTxt = nL ? ` Applies to this crane in all ${nL + 1} lifts.` : "";
        const presets = Object.values(OBJ_TYPES).filter(T => T.mat && !/custom/i.test(T.name) && (crw || !/Crawler/.test(T.name)));
        const psel = `<label>Mat size<select id="pMatP"><option value="">Custom – type length × width</option>${presets.map(T => `<option value="${T.w}x${T.h}" ${Math.abs(T.w - dL) < 1e-6 && Math.abs(T.h - dW) < 1e-6 ? "selected" : ""}>${escH(T.name)} ${fx(T.w, 1)} × ${fx(T.h, 1)} m</option>`).join("")}</select></label>
      <div class="row">${field("Mat length (m)", "pMatL", fx(dL, 2), "number", 'step="0.1" min="0.3"')}${field("Mat width (m)", "pMatW", fx(dW, 2), "number", 'step="0.1" min="0.3"')}</div>`;
        const head = `<p class="small" style="margin:0 0 6px;color:${M.on ? "var(--ink)" : "#b42318"}">${M.on ? "✓ " : "⚠ "}${escH(M.text)}<br>GBP uses ${M.basis === "mat" ? "1 mat" : M.basis === "matrow" ? "the mats under one track" : M.basis === "track" ? "one track" : "one pad"}: <b>${fx(M.area, 2)} m²</b></p>`;
        const lockC = M.mats.length ? `<label class="chk" style="margin:0 0 6px"><input type="checkbox" id="pMatLock" ${c.matLock !== false ? "checked" : ""}> Mats move with the crane – drag the crane or a mat and both go together. Untick to move the crane on its own.</label>` : "";
        if (!crw) return `<h4>Outrigger mats</h4><div>${head}${lockC}${psel}
      <div class="btnrow" style="margin-top:4px">${(() => { const bareHere = !M.mats.length || M.partial, bareElse = craneTwins(c).some(x => { const mi = matInfo(x, C); return !mi.mats.length || mi.partial; }); return bareHere || bareElse ? `<button class="pri" id="pMatAdd">${!M.mats.length ? "Place the 4 mats" : bareHere ? "Add mats to the empty pads" : "Add the mats in the other lifts"}</button>` : ""; })()}${M.mats.length ? `<button id="pMatDel">Remove mats</button>` : ""}</div>
      <p class="small" style="margin:6px 0 0">One mat under each of the 4 pads – changing the size resizes all 4. They move with the crane and follow the outrigger setting.${allTxt}</p></div>`;
        const ori = c.matOri || "perp";
        return `<h4>Crawler mats</h4><div>${head}${lockC}
      <label>Mat direction<select id="pMatO"><option value="perp" ${ori === "perp" ? "selected" : ""}>Across the tracks (opposite)</option><option value="par" ${ori === "par" || ori === "one" ? "selected" : ""}>Along the tracks (same way)</option></select></label>
      <label>How many under each track<input type="number" id="pMatN" min="1" step="1" value="${+c.matN > 0 ? c.matN : ori === "one" ? 1 : ""}" placeholder="blank = enough to cover the track"></label>${psel}
      <div class="btnrow" style="margin-top:4px"><button class="pri" id="pMatLay">${M.mats.length ? `Re-lay mats (replaces the ${M.mats.length})` : "Lay mats under the tracks"}</button><button id="pMatOne" title="Put one mat of this size next to the crane – drag it where you want it and resize it on the plan">+ Add one mat</button>${M.mats.length ? `<button id="pMatDel">Remove mats</button>` : ""}</div>
      <p class="small" style="margin:6px 0 0">One long mat, two, three or twenty small timbers – set how many and their size. Across: length runs across the track. Along: length runs along it. Changing these re-lays the mats. They stay put when the crane moves; click a mat on the plan to nudge or resize just that one.${allTxt}</p></div>`; })()}`;
    $("pDel").onclick = () => removeItem("crane", c.id);
    $("pLabel").onchange = e => up(() => c.label = e.target.value);
    $("pModel").onchange = e => up(() => {
      c.model = e.target.value; const M = REG.cranes[c.model]; c.orMode = M.or ? Object.keys(M.or.modes)[0] : "";
      const ch = chartsFor(c.model)[0]; c.chartId = ch ? ch.id : ""; c.col = null;
      const S0 = craneSummary(c); c.boomCfg = bestBoomFor(M, ch, S0.maxR || 10, S0.TW); c.L = boomLength(M, c.boomCfg);
      const hbs = [...(M.hookblocks || [])].sort((a, b) => a[0] - b[0]); c.hookBlock = (hbs[Math.floor(hbs.length / 2)] || [0, 1])[1];
    }, true);
    if ($("pOr")) $("pOr").onchange = e => up(() => { const pads0 = cranePads(c, C), carry = matsToCarry(c).map(m => ({ m, k: pads0.findIndex(pd => inPolyPt(pd.w, obsPts(m))) })); c.orMode = e.target.value; const pads1 = cranePads(c, C); carry.forEach(({ m, k }) => { if (k >= 0 && pads1[k]) { m.x = Math.round(pads1[k].w[0] * 100) / 100; m.y = Math.round(pads1[k].w[1] * 100) / 100; } }); });
    if ($("pSl")) $("pSl").onchange = e => up(() => c.sl = +e.target.value, true);
    if ($("pSlT")) $("pSlT").onchange = e => up(() => c.slT = Math.max(0, +e.target.value || 0));
    $("pChart").onchange = e => up(() => { c.chartId = e.target.value; }, true);
    if ($("pChartEd")) $("pChartEd").onclick = () => { const C2 = REG.cranes[c.model]; if (C2 && C2.type === "ped") { const o = plan.obstacles.find(v => v.id === c.vessel); if (o && typeof openVesselDialog === "function") openVesselDialog(o, "crane"); return; } ED.focusChart = c.chartId || null; openEditor(c.model); };
    // typed position / heading: the crane's mats go with it, exactly as when dragging
    const moveTo = (x, y) => { const carry = matsToCarry(c), dx = x - c.x, dy = y - c.y; c.x = x; c.y = y; carry.forEach(m => { m.x = Math.round((m.x + dx) * 100) / 100; m.y = Math.round((m.y + dy) * 100) / 100; }); };
    const turnTo = h => { const carry = matsToCarry(c), d = h - (+c.heading || 0); c.heading = h; if (d) carry.forEach(m => { const r = rot2([m.x - c.x, m.y - c.y], -d); m.x = Math.round((c.x + r[0]) * 100) / 100; m.y = Math.round((c.y + r[1]) * 100) / 100; m.rot = ((+m.rot || 0) + d) % 360; }); };
    $("pX").onchange = e => up(() => moveTo(+e.target.value, c.y)); $("pY").onchange = e => up(() => moveTo(c.x, +e.target.value));
    $("pH").onchange = e => up(() => turnTo(((+e.target.value % 360) + 360) % 360));
    $("pHr").oninput = e => { turnTo(+e.target.value); $("pH").value = c.heading; markDirty(true); renderSite(); scheduleSide(); };
    $("pHr").onchange = () => up(() => { });
    p.querySelectorAll("[data-paint]").forEach(b => b.onclick = () => up(() => setPaint(c, b.dataset.paint), true));
    $("pPaint").oninput = e => { setPaint(c, e.target.value); markDirty(true); renderSite(); renderLists(); scheduleSide(); };
    $("pPaint").onchange = () => up(() => { }, true);
    $("pLoad").onchange = e => up(() => c.attach = { ...(c.attach || {}), load: e.target.value });
    $("pPt").onchange = e => up(() => c.attach = { ...(c.attach || {}), point: e.target.value });
    $("pHb").onchange = e => up(() => {
      if (e.target.value === "custom") { c.blockCapOther = true; return; }
      delete c.blockCapOther; const cap = +e.target.value, hb = (C?.hookblocks || []).find(h => Math.abs(h[0] - cap) < 1e-6);
      c.blockCap = cap; if (!c.hbWSet && hb) c.hookBlock = hb[1];          // the weight you typed is kept – only the crane-data value follows the block
      if (!c.partsSet) c.parts = defaultParts(cap); if (!c.btSet) c.blockType = cap >= 100 ? "ramshorn" : "single";
    }, true);
    if ($("pHbC")) $("pHbC").onchange = e => up(() => c.blockCap = +e.target.value, true);
    p.querySelectorAll("[data-bt]").forEach(b => b.onclick = () => up(() => { c.blockType = b.dataset.bt; c.btSet = true; }, true));
    if ($("pParts")) $("pParts").onchange = e => up(() => { c.parts = +e.target.value; c.partsSet = true; }, true);
    if ($("pLp")) $("pLp").onchange = e => up(() => c.linePull = e.target.value === "" ? "" : +e.target.value, true);
    if ($("pHbW")) $("pHbW").onchange = e => up(() => { const v = e.target.value; if (v === "") { delete c.hbWSet; const hb = (C?.hookblocks || []).find(h => Math.abs(h[0] - blockCapOf(c, C)) < 1e-6); if (hb) c.hookBlock = hb[1]; } else { if (!(+c.blockCap > 0)) c.blockCap = blockCapOf(c, C); c.hookBlock = Math.max(0, +v); c.hbWSet = true; } }, true);
    $("pEx").onchange = e => up(() => c.extra = +e.target.value);
    { const gv = id => Math.max(0.3, +$(id).value || 0);
      // every mat action is done for this crane in every lift it appears in (at that lift's position)
      const eachLift = fn => { fn(c); for (const x of craneTwins(c)) { const i = plan.lifts.findIndex(L => L.cranes.includes(x)); if (i >= 0) withLift(i, () => fn(x)); } };
      const clearMats = x => { const ids = new Set(matsUnderCrane(x).map(m => m.id)); plan.obstacles = plan.obstacles.filter(o => !ids.has(o.id)); };
      if ($("pMatP")) $("pMatP").onchange = e => { if (!e.target.value) return; const [L, W] = e.target.value.split("x"); $("pMatL").value = L; $("pMatW").value = W; $("pMatL").onchange(); };
      if (C && C.type !== "cr" && C.type !== "ped") {
        if ($("pMatAdd")) $("pMatAdd").onclick = () => { let n = 0; eachLift(x => { n += placeMats(x, gv("pMatL"), gv("pMatW")); }); markDirty(); renderAll(); toast(n ? `${n} mats placed${craneTwins(c).length ? " (all lifts)" : ""}` : "Every pad already has a mat"); };
        const resize = () => { const L = gv("pMatL"), W = gv("pMatW"); up(() => eachLift(x => matsUnderCrane(x).forEach(m => { m.w = W; m.h = L; })), true); };
        $("pMatL").onchange = resize; $("pMatW").onchange = resize;
      }
      if (C && C.type === "cr") {
        const relay = force => { c.matOri = $("pMatO").value; c.matLen = gv("pMatL"); c.matWid = gv("pMatW"); const nn = Math.round(+$("pMatN").value || 0); if (nn > 0) c.matN = nn; else delete c.matN; let n = 0;
          eachLift(x => { x.matOri = c.matOri; x.matLen = c.matLen; x.matWid = c.matWid; if (c.matN) x.matN = c.matN; else delete x.matN; if (!force && !matsUnderCrane(x).length) return; clearMats(x); n += layCrawlerMats(x, c.matLen, c.matWid, c.matOri, c.matN); }); return n; };
        // with no mats down yet, typing a value only remembers it (no redraw), so the Lay button still takes the click
        const soft = () => { if (!matsUnderCrane(c).length) { c.matOri = $("pMatO").value; c.matLen = gv("pMatL"); c.matWid = gv("pMatW"); const nn = Math.round(+$("pMatN").value || 0); if (nn > 0) c.matN = nn; else delete c.matN; markDirty(true); return; } up(() => relay(false), true); };
        $("pMatN").onchange = soft;
        $("pMatO").onchange = soft;
        $("pMatOne").onclick = () => { let o0 = null; eachLift(x => { const o = addCrawlerMat(x, gv("pMatL"), gv("pMatW"), $("pMatO").value === "perp" ? "perp" : "par"); if (x === c) o0 = o; }); sel = { kind: "obs", id: o0.id }; markDirty(); renderAll(); toast(`Mat added beside the crane${craneTwins(c).length ? " in every lift" : ""} – drag it into place and resize it`); };
        $("pMatL").onchange = soft;
        $("pMatW").onchange = soft;
        $("pMatLay").onclick = () => { const n = relay(true); markDirty(); renderAll(); toast(`${n} mats laid ${c.matOri === "par" ? "along" : "across"} the tracks${craneTwins(c).length ? " (all lifts)" : ""}`); };
      }
      if ($("pMatLock")) $("pMatLock").onchange = e => up(() => { eachLift(x => { if (e.target.checked) delete x.matLock; else x.matLock = false; }); }, true);
      if ($("pMatDel")) $("pMatDel").onclick = () => { eachLift(clearMats); markDirty(); renderAll(); toast("Mats removed" + (craneTwins(c).length ? " in all lifts" : "")); };
    }
    for (const ph of ["pick", "set"]) {
      $("pTip_" + ph).onchange = e => up(() => { c.tip = c.tip || {}; if (e.target.value === "free") { const ev = evalCrane(c, ph); c.tip[ph] = { free: true, R: Math.round(ev.R * 100) / 100, brg: Math.round(ev.bearing * 10) / 10 }; } else c.tip[ph] = null; }, true);
      if ($("pTR_" + ph)) $("pTR_" + ph).onchange = e => up(() => c.tip[ph].R = Math.max(0.5, +e.target.value));
      if ($("pTB_" + ph)) $("pTB_" + ph).onchange = e => up(() => c.tip[ph].brg = +e.target.value);
    }
    { const ph = plan.phase === "set" ? "set" : "pick";
      $("pCarry").onchange = e => up(() => { c.carry = e.target.checked; }, true);
      const liveR = R => { const ev = evalCrane(c, ph); setHookRB(c, ph, Math.max(0.5, R), ev.bearing); $("pRn").value = fx(R, 2); markDirty(true); renderSite(); scheduleSide(); };
      $("pRr").oninput = e => liveR(+e.target.value); $("pRr").onchange = () => up(() => { }, true);
      $("pRn").onchange = e => up(() => { const ev = evalCrane(c, ph); setHookRB(c, ph, Math.max(0.5, +e.target.value), ev.bearing); }, true);
      $("pSlew").onchange = e => up(() => { const ev = evalCrane(c, ph); setHookRB(c, ph, ev.R, +e.target.value); }, true);
    }
    const optNum = v => v === "" ? "" : +v;
    $("pRmax").onchange = e => up(() => c.rMax = optNum(e.target.value));
    $("pWc").onchange = e => up(() => c.wCrane = optNum(e.target.value));
    $("pWcw").onchange = e => up(() => c.wCw = optNum(e.target.value));
    if (C && C.type !== "ped") wireBoomPanel(c, C, chart, fn => up(fn, true));
    if (C && C.type === "ped") wirePedProps(c, C, up);
  } else if (sel.kind === "load") {
    const l = plan.loads.find(x => x.id === sel.id); if (!l) { sel = null; return renderProps(); }
    normLoad(l);
    const d = loadDims(l);
    const ph = pp => `<div class="row3">${field(pp === "pick" ? "Pick E" : "Set E", `l_${pp}x`, l[pp].x, "number", 'step="0.1"')}${field("N", `l_${pp}y`, l[pp].y, "number", 'step="0.1"')}${field("Rotation °", `l_${pp}r`, l[pp].rot, "number", 'step="1"')}</div>${field(pp === "pick" ? "Load bottom at pick – m above ground (0 = on the ground)" : "Load bottom at set – m above ground (0 = on the ground)", `l_${pp}h`, l[pp].h, "number", 'step="0.1"')}`;
    p.innerHTML = `<h3>${escH(l.name)} <button id="lDel" class="danger">Remove load</button></h3>
      <h4>Load</h4>
      <div class="small" style="color:var(--ink)">${escH(LOAD_TYPES[l.kind]?.name || l.kind)} · ${escH(LOAD_TYPES[l.kind]?.orients[l.orient] || "")}<br>${fx(d.x, 2)} × ${fx(d.y, 2)} × ${fx(d.z, 2)} m${l.span ? ` · A–B ${fx(l.span, 2)} m` : ""}</div>
      ${l.photoUrl ? `<img src="${escH(l.photoUrl)}" alt="" style="width:100%;max-height:140px;object-fit:cover;border-radius:4px;border:1px solid var(--line)">` : ""}
      <div class="btnrow"><button id="lEdit">Edit shape &amp; size…</button><button id="lRig" class="pri">Rigging…</button></div>
      ${(() => { const rr = l.rig?.arr ? solveRig(l) : null; return rr ? `<div class="small" style="color:var(--ink)">${escH(rigName(l.rig))} · ${rr.rows.length} items · rigging ${fx(rr.weight, 3)} t${rr.warn.length ? ` · <b style="color:var(--bad)">${rr.warn.length} warning${rr.warn.length > 1 ? "s" : ""}</b>` : ""}</div>` : ""; })()}
      ${(() => { const hooked = plan.cranes.filter(c => c.attach?.load === l.id), others = plan.cranes.filter(c => c.attach?.load && c.attach.load !== l.id);
        const dup = plan.loads.filter(x => x !== l && Math.hypot(x.pick.x - l.pick.x, x.pick.y - l.pick.y) < 1.5);
        if (hooked.length) return `<p class="small" style="margin:6px 0 0">Hooked by <b>${hooked.map(c => escH(c.label)).join(", ")}</b> – the elevations and checks use this load.</p>${dup.length ? `<p class="small" style="color:var(--amber);margin:4px 0 0">Another load (${dup.map(x => escH(x.name)).join(", ")}) sits in the same spot in this lift – it is not used by any crane. <button data-dupdel="${dup.map(x => x.id).join(",")}">Remove it</button></p>` : ""}`;
        return `<p class="small" style="color:var(--amber);margin:6px 0 0"><b>No crane is hooked to this load</b>${others.length ? ` – ${others.map(c => `${escH(c.label)} is on “${escH(plan.loads.find(x => x.id === c.attach.load)?.name || "?")}”`).join(", ")}` : ""}. Changes here won't show in the elevations until a crane is hooked to it.</p>${plan.cranes.length ? `<div class="btnrow" style="margin-top:4px">${plan.cranes.map(c => `<button data-hookto="${c.id}">Hook ${escH(c.label)} to this load</button>`).join("")}</div>` : ""}${dup.length ? `<p class="small" style="margin:4px 0 0">Stacked on top of: ${dup.map(x => escH(x.name)).join(", ")}. <button data-dupdel="${l.id}">Remove this duplicate</button></p>` : ""}`; })()}
      <h4>Name &amp; weight</h4>
      <label>Name<input type="text" id="lName" value="${escH(l.name)}"></label>
      <div class="row">${field(l.wInclRig ? "Weight incl. rigging (t)" : "Load weight (t)", "lWt", l.weight, "number", 'step="0.1"')}<label>Rigging from rigging list (t)<input type="number" value="${fx(l.rigWeight || 0, 3)}" disabled></label></div>
      <label class="chk"><input type="checkbox" id="lInclRig" ${l.wInclRig ? "checked" : ""}> Weight already includes the rigging (don't add it again)</label>
      <p class="small" style="margin:2px 0 0">Adds to the lift: <b>${fx((+l.weight || 0) + rigW(l), 2)} t</b>${l.wInclRig ? " (rigging included in the weight)" : ` = ${fx(+l.weight || 0, 2)} load + ${fx(+l.rigWeight || 0, 2)} rigging`}. Each crane then adds its own hook block.</p>
      <h4>Pick &amp; set position</h4>
      ${["pick", "set"].filter(pp => l[pp]?.hDeck).map(pp => `<p class="small" style="color:var(--amber);margin:0">${pp === "pick" ? "Pick" : "Set"} is on a vessel deck – its height follows the deck (${fx(+l[pp].h || 0, 2)} m). Type a height below to override it.</p>`).join("")}
      ${ph("pick")}${ph("set")}
      ${(() => { const tp = travelPath(l); if (!tp) return ""; const hit = obstacleHits(l, tp); return `<div class="row"><label>Travel from pick to set<select id="lTrav"><option value="short" ${(l.travelDir || "short") === "short" ? "selected" : ""}>Shortest slew</option><option value="cw" ${l.travelDir === "cw" ? "selected" : ""}>Slew clockwise</option><option value="ccw" ${l.travelDir === "ccw" ? "selected" : ""}>Slew anticlockwise</option></select></label><p class="small" style="align-self:end;margin:0 0 6px">${tp.hooks ? `slew ${fx(Math.abs(tp.slew), 0)}°` : "straight move (tandem)"}${hit.bad ? ` · <b style="color:var(--bad)">${escH(clashText(hit))}</b>` : ""}</p></div>`; })()}
      <p class="small">Switch the plan to <b>Set</b> and drag the load to where it lands. Drag the round handle to rotate it.</p>`;
    $("lDel").onclick = () => removeItem("load", l.id);
    $("lEdit").onclick = () => openLoadBuilder(l);
    if ($("lTrav")) $("lTrav").onchange = e => up(() => l.travelDir = e.target.value);
    $("lRig").onclick = () => openRigBuilder(l);
    $("lName").onchange = e => up(() => l.name = e.target.value);
    p.querySelectorAll("[data-hookto]").forEach(bt => bt.onclick = () => up(() => { const c = plan.cranes.find(x => x.id === bt.dataset.hookto); if (c) { c.attach = { ...(c.attach || {}), load: l.id, point: c.attach?.point || "C" }; if (c.tip) { c.tip.pick = null; c.tip.set = null; } } }, true));
    p.querySelectorAll("[data-dupdel]").forEach(bt => bt.onclick = () => { const ids = bt.dataset.dupdel.split(","); for (const id of ids) removeItem("load", id); });
    $("lWt").onchange = e => up(() => l.weight = +e.target.value);
    $("lInclRig").onchange = e => up(() => l.wInclRig = e.target.checked, true);
    for (const pp of ["pick", "set"]) for (const [s2, k] of [["x", "x"], ["y", "y"], ["r", "rot"], ["h", "h"]]) $(`l_${pp}${s2}`).onchange = e => up(() => { l[pp][k] = +e.target.value; if (k === "h") delete l[pp].hDeck; });   // a typed height wins over a vessel deck height
  } else {
    const o = plan.obstacles.find(x => x.id === sel.id); if (!o) { sel = null; return renderProps(); }
    if (o.kind === "dim") {
      const L = Math.hypot(o.pts[1][0] - o.pts[0][0], o.pts[1][1] - o.pts[0][1]);
      p.innerHTML = `<h3>Dimension <button id="oDel" class="danger">Remove</button></h3>
        <div class="small" style="color:var(--ink)">Length <b>${fx(L, 2)} m</b></div>
        <label>Label (optional)<input type="text" id="oLab" value="${escH(o.label || "")}" placeholder="e.g. Clearance to light tower"></label>
        <p class="small">Drag the square ends to move them – they snap to cranes, loads and corners.</p>`;
      $("oDel").onclick = () => removeItem("obs", o.id);
      $("oLab").onchange = e => up(() => o.label = e.target.value);
      return;
    }
    const shapeSel = `<select id="oKind"><option value="rect" ${o.kind === "rect" ? "selected" : ""}>Rectangle</option><option value="circle" ${o.kind === "circle" ? "selected" : ""}>Circle</option><option value="poly" ${o.kind === "poly" ? "selected" : ""}>Free shape</option></select>`;
    let geo = "";
    if (o.kind === "circle") geo = `<div class="row3">${field("Centre E", "oX", o.x, "number", 'step="0.1"')}${field("Centre N", "oY", o.y, "number", 'step="0.1"')}${field("Radius (m)", "oR", o.r || 1, "number", 'step="0.1"')}</div><p class="small">Drag the square handle to change the radius.</p>`;
    else if (o.kind === "rect") geo = (isMat(o) ? `<label>Mat size<select id="oMatP"><option value="">Custom – type length × width below</option>${Object.values(OBJ_TYPES).filter(T => T.mat && T.w !== 2 || T.mat && T.h !== 1).map(T => `<option value="${T.w}x${T.h}" ${Math.abs(Math.max(o.w, o.h) - T.w) < 1e-6 && Math.abs(Math.min(o.w, o.h) - T.h) < 1e-6 ? "selected" : ""}>${escH(T.name)} ${fx(T.w, 1)} × ${fx(T.h, 1)} m</option>`).join("")}</select></label>` : "") + `<div class="row">${field("Centre E", "oX", o.x, "number", 'step="0.1"')}${field("Centre N", "oY", o.y, "number", 'step="0.1"')}</div><div class="row3">${field(isVessel(o) || isMat(o) ? "Length (m)" : "Width", "oW", o.w, "number", 'step="0.1"')}${field(isVessel(o) ? "Beam (m)" : isMat(o) ? "Width (m)" : "Depth", "oH", o.h, "number", 'step="0.1"')}${field("Rotation °", "oRot", o.rot || 0, "number", 'step="1"')}</div><p class="small">Drag the square corner to resize, the round handle to rotate.</p>`;
    else geo = `<p class="small">${o.pts.length} ${o.kind === "line" ? "points" : "corners"}. Drag a square to move a ${o.kind === "line" ? "point" : "corner"}, drag a dashed circle to add one, double-click one to delete it.</p>`;
    p.innerHTML = `<h3>${escH(o.label || (o.zone ? "Exclusion zone" : "Site item"))} <button id="oDel" class="danger">Remove</button></h3>
      <h4>Item</h4>
      <label>Label<input type="text" id="oLab" value="${escH(o.label || "")}"></label>
      ${o.kind === "line" || isVessel(o) ? `<input type="checkbox" id="oZone" hidden><select id="oKind" hidden></select>` : `<div class="row"><label>Shape${shapeSel}</label><label class="chk" style="margin-top:18px"><input type="checkbox" id="oZone" ${o.zone ? "checked" : ""}> Exclusion zone</label></div>`}
      ${typeof objPropsHTML === "function" ? objPropsHTML(o) : ""}
      ${o.zone ? `<label>Zone type<select id="oZt"><option value="work" ${zoneType(o) === "work" ? "selected" : ""}>Lift exclusion zone – barricaded work area (lift stays inside)</option><option value="nogo" ${zoneType(o) === "nogo" ? "selected" : ""}>No-go area – load must not pass over</option></select></label>
      <p class="small" style="margin:0">${zoneType(o) === "work" ? "Draw it around the whole working area plus your margin. The load's travel from pick to set (including its size) must stay inside, and the crane must be set up inside." : "Use for live plant, pipework, roads or anything the load must never be carried over. The travel path is checked against it."}</p>` : ""}
      <h4>Colour</h4>
      <label>Colour<span class="swrow" style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">${["#c0392b", "#e67e22", "#d4a017", "#2e8b57", "#12867f", "#2c6fbb", "#6c3fb5", "#b0306f", "#34393f", "#7f8c8d"].map(c => `<button class="sw" data-ocol="${c}" title="${c}" style="width:24px;height:24px;padding:0;border-radius:50%;background:${c};border:2px solid ${obsColor(o) === c ? "var(--ink)" : "transparent"};box-shadow:0 0 0 1px var(--line)"></button>`).join("")}<input type="color" id="oCol" value="${obsColor(o)}" title="Any colour" style="width:34px;height:26px;padding:1px"></span></label>
      ${o.zone ? `<button id="oColAll" style="align-self:flex-start">Use this colour for all zones</button>` : ""}
      <h4>Size &amp; position</h4>
      ${geo}
      <div ${isVessel(o) || o.type === "powerline" ? "hidden" : ""}>${field(o.zone ? "Barrier height for 3D / side views (m)" : isMat(o) ? "Mat thickness (m)" : o.type === "water" ? "Water level below quay (m, negative)" : "Height (m) – shown in 3D / side views", "oHgt", o.hgt ?? (o.zone ? 1.1 : 3), "number", `step="0.1" ${o.type === "water" ? "" : 'min="0"'}`)}</div>`;
    $("oHgt").onchange = e => up(() => o.hgt = +e.target.value);
    $("oDel").onclick = () => removeItem("obs", o.id);
    $("oLab").onchange = e => up(() => o.label = e.target.value);
    $("oZone").onchange = e => up(() => o.zone = e.target.checked);
    $("props").querySelectorAll("[data-ocol]").forEach(b => b.onclick = () => up(() => o.color = b.dataset.ocol, true));
    $("oCol").onchange = e => up(() => o.color = e.target.value, true);
    $("oCol").oninput = e => { o.color = e.target.value; renderSite(); };
    if ($("oColAll")) $("oColAll").onclick = () => up(() => plan.obstacles.forEach(z => { if (z.zone) z.color = obsColor(o); }), true);
    if ($("oZt")) $("oZt").onchange = e => up(() => { if (!o.label || o.label === "Exclusion zone" || o.label === "No-go area") o.label = e.target.value === "work" ? "Exclusion zone" : "No-go area"; o.zt = e.target.value; }, true);
    $("oKind").onchange = e => up(() => {
      const to = e.target.value, P = o.kind === "circle" ? Array.from({ length: 12 }, (_, i) => [o.x + (o.r || 1) * Math.cos(i * Math.PI / 6), o.y + (o.r || 1) * Math.sin(i * Math.PI / 6)]) : obsPts(o);
      if (to === "poly") { o.pts = P.map(q => [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]); }
      else { const xs = P.map(q => q[0]), ys = P.map(q => q[1]), c = centroid(P); o.x = Math.round(c[0] * 10) / 10; o.y = Math.round(c[1] * 10) / 10; o.w = Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10 || 2; o.h = Math.round((Math.max(...ys) - Math.min(...ys)) * 10) / 10 || 2; o.r = Math.max(o.w, o.h) / 2; o.rot = 0; delete o.pts; }
      o.kind = to;
    }, true);
    for (const [id, k] of [["oX", "x"], ["oY", "y"], ["oR", "r"], ["oW", "w"], ["oH", "h"], ["oRot", "rot"]]) if ($(id)) $(id).onchange = e => up(() => { if ((k === "w" || k === "h") && isMat(o) && mobileOwner()) { const n = sizeAll(k === "w" ? +e.target.value : +o.w, k === "h" ? +e.target.value : +o.h); if (n > 1) toast(`All ${n} mats under ${mobileOwner()?.label || "the crane"} resized`); } else o[k] = +e.target.value; });
    // a mobile crane stands on 4 identical mats: resizing one resizes all 4 (and the same crane's mats in the other lifts)
    const mobileOwner = () => isMat(o) ? plan.cranes.find(cr => { const C = REG.cranes[cr.model]; return C && C.type !== "cr" && C.type !== "ped" && matsUnderCrane(cr, C).includes(o); }) : null;
    const sizeAll = (w, h) => { const cr = mobileOwner(); if (!cr) { o.w = w; o.h = h; return 1; }
      const L = Math.max(w, h), W = Math.min(w, h), set = list => list.forEach(m => { const along = (+m.w || 0) >= (+m.h || 0); m.w = along ? L : W; m.h = along ? W : L; });
      const mine = matsUnderCrane(cr); set(mine); o.w = w; o.h = h;
      for (const x of (typeof craneTwins === "function" ? craneTwins(cr) : [])) { const i = plan.lifts.findIndex(Lf => Lf.cranes.includes(x)); if (i >= 0) withLift(i, () => set(matsUnderCrane(x))); }
      return mine.length; };
    if ($("oMatP")) $("oMatP").onchange = e => { if (!e.target.value) return; const [L, W] = e.target.value.split("x").map(Number); up(() => { const along = (+o.w || 0) >= (+o.h || 0); const n = sizeAll(along ? L : W, along ? W : L); if (n > 1) toast(`All ${n} mats under ${mobileOwner()?.label || "the crane"} resized`); }, true); };
    if (typeof wireObjProps === "function") wireObjProps(o, up);
    if (isVessel(o)) { $("props").insertAdjacentHTML("beforeend", vesselPropsHTML(o)); wireVesselProps(o, up); }
  }
}
function renderChecks() {
  if (allMode) { $("checks").innerHTML = liftsSummaryHTML(); return; }
  const phases = ["pick", "set"];
  let h = "";
  for (const cr of plan.cranes) {
    const S = craneSummary(cr), rows = phases.map(ph => S.ph[ph]);
    const C = S.C;
    const pill = (st, t) => `<span class="pill ${st}">${t}</span>`;
    h += `<div class="card" style="margin-bottom:10px"><div class="ch"><b style="color:${cr.color}">${escH(cr.label)} · ${escH(C ? C.short : cr.model)}</b><span class="small">${S.chart ? escH(S.chart.label) : "no chart"}</span></div>
      <table><tr><th></th><th class="n">Pick</th><th class="n">Set</th></tr>
      <tr><td>Radius</td>${rows.map(r => `<td class="n">${fx(r.R)} m${r.free ? " *" : ""}</td>`).join("")}</tr>
      <tr><td>Boom / angle</td>${rows.map(r => `<td class="n">${fx(cr.L)} m / ${fx(r.ba?.theta)}°</td>`).join("")}</tr>
      <tr><td>Capacity at radius</td>${rows.map(r => `<td class="n">${r.cap != null ? fx(r.cap) + " t" : "–"}</td>`).join("")}</tr>
      </table>
      <table style="margin-top:4px">
      <tr><td>Max radius${S.maxRFrom === "manual" ? " (entered)" : ` (${S.maxRFrom})`}</td><td class="n"><b>${fx(S.maxR)} m</b></td></tr>
      <tr><td>Capacity at max radius${S.rUsed != null ? ` <span class="small">(chart ${fx(S.rUsed)} m)</span>` : ""}</td><td class="n"><b>${S.cap != null ? fx(S.cap) + " t" : "–"}</b></td></tr>
      <tr><td>TW to be lifted${rows[0].tandem ? " (share)" : ""} <span class="small">${twBreak(cr, S)}</span></td><td class="n"><b>${fx(S.TW, 2)} t</b></td></tr>
      <tr><td>Utilisation <span class="small">TW ÷ cap @ max R × 100</span></td><td class="n">${pill(S.status === "bad" && S.util != null && S.util <= 100 ? (S.util > (+plan.site.ulim || (rule("crane.util") ?? 100)) ? "amber" : "ok") : S.status, S.util == null ? "–" : fx(S.util, 1) + "%")}</td></tr>
${C && C.type === "ped" ? `<tr><td colspan="2" class="small">Vessel crane on ${escH(pedVesselName(cr))} – no ground bearing check</td></tr>` : `      <tr><td>Gross applied weight <span class="small">${fx(S.craneWt)} crane + ${fx(S.cwWt)} CW + ${S.slWt ? fx(S.slWt) + " SL ballast + " : ""}${fx(S.TW, 2)} lift</span></td><td class="n">${fx(S.GAW, 2)} t</td></tr>
      <tr><td>GBP <span class="small">${S.react ? `max ${C.type === "cr" ? "track" : "outrigger"} reaction ${fx(S.react, 1)} t (manufacturer${cr.oSrc ? " – " + escH(cr.oSrc) : ""})` : "GAW × 0.75"} ÷ ${S.mat ? escH(S.mat.short) : fx(S.matA, 2) + " m² mat"} · allowed ${gbcFor(cr) ? `<b>${fx(gbcFor(cr), 1)} t/m²</b>${+cr.gbc > 0 ? " (this crane)" : ""}` : `<button class="lnk" data-setgbc="${cr.id}" title="Enter the allowed ground bearing pressure">set allowed GBP…</button>`}</span></td><td class="n">${pill(S.gbpOk === false ? "bad" : S.gbpOk ? "ok" : "na", S.gbp == null ? "–" : fx(S.gbp, 1) + " t/m²")}</td></tr>`}
      ${S.wind ? `<tr><td>Wind <span class="small">${escH(S.wind.txt)}</span></td><td class="n">${pill(S.wind.lvl, S.wind.now ? fx(S.wind.now, 1) + " / " + fx(S.wind.lim, 1) + " m/s" : "≤ " + fx(S.wind.lim, 1) + " m/s")}</td></tr>` : ""}
      </table>
      ${rows.some(r => r.free) ? `<p class="small" style="padding:0 10px;margin:2px 0">* hook moved away from the load – the filled dot on the plan, joined to the crane by a dashed radius line${cr.attach?.load ? rows.filter(r => r.free).map(r => ` <button class="small" data-hookback="${cr.id}:${r.phase}">Put the ${r.phase} hook back on the load</button>`).join("") : ""}</p>` : ""}
      ${C && C.type === "ped" ? "" : `<details style="padding:6px 10px"><summary class="small">Detailed ${rows[0].gp.kind === "track" ? "track" : "outrigger"} distribution (reference only)</summary>
      <table><tr><th></th>${rows[0].gp.items.map(i => `<th class="n">${i.name}</th>`).join("")}</tr>
      ${rows.map(r => `<tr><td>${r.phase}</td>${r.gp.items.map(i => `<td class="n">${fx(i.load)} t<br><span class="small">${fx(i.pressure)} t/m²</span></td>`).join("")}</tr>`).join("")}</table>
      <p class="small">Rigid-base estimate. ${S.react ? "The GBP check above uses the manufacturer's maximum reaction ÷ mat area." : "The GBP check above uses 0.75 × GAW ÷ mat area – enter the manufacturer's maximum reaction in the crane panel to use that instead."}</p></details>`}
      ${S.warn.map(w => `<p class="small" style="color:var(--bad);padding:0 10px 6px;margin:0">${escH(w)}</p>`).join("")}
      ${workZones().length && !workZones().some(o => insideZone([cr.x, cr.y], 0, o)) ? `<p class="small" style="color:var(--bad);padding:0 10px 6px;margin:0">Crane is set up outside the exclusion zone</p>` : ""}
      </div>`;
  }
  for (const ld of plan.loads) {
    const tp = travelPath(ld), hit = tp ? obstacleHits(ld, tp) : null;
    if (hit && hit.low && hit.low.length) h += `<div class="card" style="margin-bottom:10px"><div class="ch"><b>Lift over · ${escH(ld.name)}</b></div><p class="small" style="padding:6px 10px 2px;margin:0">Load bottom ${fx(TRAVEL_CLEAR, 1)} m above each item, ${fx(TRAVEL_SIDE, 1)} m clear beside, hook block ${fx(TRAVEL_A2B, 1)} m under the boom head:</p><table>${[...hit.over].sort((x, y) => x[1].clear - y[1].clear).map(([n, v]) => `<tr><td>${escH(n)} <span class="small">${fx(v.top, 1)} m high · bottom of load ≥ ${fx(v.top + TRAVEL_CLEAR, 1)} m</span></td><td class="n"><span class="pill ${v.clear < 1 ? "amber" : "ok"}">${fx(v.clear, 1)} m spare</span></td></tr>`).join("")}</table></div>`;
    if (hit && hit.bad) h += `<div class="card" style="margin-bottom:10px;border-color:var(--bad)"><div class="ch"><b style="color:var(--bad)">Travel path · ${escH(ld.name)}</b></div><p class="small" style="padding:6px 10px;margin:0;color:var(--bad)">Between pick and set the load ${escH(clashText(hit))}${hit.outside.length ? " – enlarge the zone or move the pick / set" : ""}${hit.names.length && tp.hooks ? " – try slewing the other way (Load → Travel), a longer boom or less rigging height" : ""}.</p></div>`;
    const rr = ld.rig?.arr ? solveRig(ld) : null; if (!rr) continue;
    const worst = rr.rows.reduce((m, r) => r.util != null && r.util > (m?.util || 0) ? r : m, null);
    h += `<div class="card" style="margin-bottom:10px"><div class="ch"><b>Rigging · ${escH(ld.name)}</b><button data-rig="${ld.id}">Open</button></div>
      ${plan.cranes.filter(c => c.attach?.load === ld.id).length > 1 && ld.rig.arr !== "tandem" ? `<p class="small" style="color:var(--bad);padding:6px 10px 0;margin:0">Tandem lift but the rigging is for one hook – open and choose "Tandem – one leg per crane".</p>` : ""}
      ${ld.rig.arr === "tandem" && plan.cranes.filter(c => c.attach?.load === ld.id).length < 2 ? `<p class="small" style="color:var(--amber);padding:6px 10px 0;margin:0">Tandem rigging but only one crane is hooked on.</p>` : ""}
      ${ld.rig.auto ? `<p class="small" style="color:var(--amber);padding:6px 10px 0;margin:0">Rigging set up and sized by the app for this load – open to check or change it.</p>` : ""}
      <table><tr><td>${escH((RIG_PRESETS.find(p => p.id === ld.rig.preset)?.name) || rigName(ld.rig))} · ${rr.rows.length} items</td><td class="n">${fx(rr.weight, 3)} t</td></tr>
      ${worst ? `<tr><td>Highest use: ${escH(worst.name)}</td><td class="n"><span class="pill ${worst.util > 100 ? "bad" : worst.util > 80 ? "amber" : "ok"}">${worst.util.toFixed(0)}%</span></td></tr>` : ""}</table>
      ${rr.warn.map(w => `<p class="small" style="color:var(--bad);padding:0 10px 6px;margin:0">${escH(w)}</p>`).join("")}</div>`;
  }
  $("checks").innerHTML = h || `<p class="small">Add a crane to see capacity, utilisation and ground pressure.</p>`;
  $("checks").querySelectorAll("[data-hookback]").forEach(b => b.onclick = () => { const [id, ph] = b.dataset.hookback.split(":"), c = plan.cranes.find(x => x.id === id); if (!c || !c.tip) return; c.tip[ph] = null; markDirty(); renderAll(); if (typeof renderProps === "function") renderProps(); toast(`${c.label}: ${ph} hook back on the load`); });
}
document.addEventListener("click", e => { const b = e.target.closest("[data-rig]"); if (b) { const l = plan.loads.find(x => x.id === b.dataset.rig); if (l) openRigBuilder(l); } });
function elevScene(cr, phase) {
  const ev = evalCrane(cr, phase); if (!ev.C || !ev.load) return null;
  const ld = ev.load, pos = ld[phase];
  const st = { L: cr.L, R: ev.R, slew: ev.slewRel, orMode: cr.orMode, sl: cr.sl, S: slOf(cr, ev.C), hL: +pos.h || 0, loadRot: ((pos.rot || 0) - ev.bearing), tandem: ev.tandem, point: cr.attach?.point, cfg: cfgDraw(cr, ev.C), bd: blockDims(cr, ev.C), paintStroke: cr.paint ? paintSet(cr.paint).stroke : null, paintFill: cr.paint ? paintSet(cr.paint).boom : null };
  const e = elevationView(ev.C, st, ld);
  paintScene(e.scene, crPaint(cr)); e.bd = st.bd;
  e.scene.text("TEXT", [0, e.tip[1] + 2.4 * Math.max(1, e.tip[1] / 20)], `${cr.label} · ${ev.C.name} · ${phase.toUpperCase()}`, 1.1 * Math.max(1, e.tip[1] / 20), { bold: true, color: cr.color });
  return { ...e, ev };
}
function renderElev() {
  const sel2 = $("elevCrane");
  const cur = sel2.value;
  sel2.innerHTML = plan.cranes.map(c => `<option value="${c.id}">${escH(c.label)}</option>`).join("");
  if (sel?.kind === "crane" && plan.cranes.some(c => c.id === sel.id)) sel2.value = sel.id;
  else if (plan.cranes.some(c => c.id === cur)) sel2.value = cur;
  const cr = plan.cranes.find(c => c.id === sel2.value);
  if (!cr) { $("elevWrap").innerHTML = ""; return; }
  const e = elevScene(cr, elevPhase);
  const eld = e ? evalCrane(cr, elevPhase).load : null;
  $("elevWrap").innerHTML = e ? toSVG(e.scene, { lw: 0.06, noSize: true }).replace("<svg ", '<svg id="elev" ') + (eld ? `<p class="small" style="margin:2px 0">On <b>${escH(eld.name)}</b> – load bottom at ${elevPhase} ${fx(+(eld[elevPhase] || {}).h || 0, 2)} m. <a href="#" data-selload="${eld.id}">Select this load</a></p>` : "") + `<p class="small">Head ${fx(e.tip[1])} m · hook ${fx(e.hookY)} m · head-to-block <b style="color:${e.clearance < 1 ? "var(--bad)" : "inherit"}">${fx(e.clearance)} m</b> · ${e.bd.parts} part${e.bd.parts > 1 ? "s" : ""} of line · carrier ${e.carrierMode}</p>${e.clearance < 1 ? `<p class="small" style="color:var(--bad)">Block is too close to the boom head – lengthen the boom, reduce the lift height or shorten the rigging.</p>` : ""}` : `<p class="small">Attach the crane to a load to see its elevation.</p>`;
}
function renderMeta() {
  $("planName").value = plan.name;
  $("gbc").value = plan.site.gbc; if ($("ulim")) $("ulim").value = plan.site.ulim; $("showGrid").checked = plan.site.grid;
  if (typeof renderTxtBox === "function") renderTxtBox();
  $("mClient").value = plan.meta.client || ""; $("mCompany").value = plan.meta.company || ""; $("mRev").value = plan.meta.rev || ""; $("mRevDesc").value = plan.meta.revDesc || ""; if (typeof renderLogoRows === "function") renderLogoRows(); $("mDisc").value = plan.meta.disclaimer ?? (typeof SS_DISC !== "undefined" ? SS_DISC : ""); $("mProj").value = plan.meta.project || ""; $("mLift").value = plan.meta.lift || ""; $("mDate").value = plan.meta.date || ""; $("mBy").value = plan.meta.by || ""; $("mNotes").value = plan.meta.notes || "";
  const bg = plan.site.bg;
  $("bgInfo").textContent = bg ? `Background ${bg.w} × ${bg.h} px at ${fx(bg.mpp * 1000, 1)} mm/px (${fx(bg.w * bg.mpp)} × ${fx(bg.h * bg.mpp)} m).` : "No background. Upload a site photo, drawing screenshot or map and set its scale by clicking two points a known distance apart.";
  for (const [b, v] of [["phPick", "pick"], ["phSet", "set"], ["phBoth", "both"]]) $(b).setAttribute("aria-pressed", plan.phase === v);
}
function renderPanels() { renderLists(); renderProps(); renderChecks(); renderElev(); }
function renderAll(keepProps) { autoBoomAll(); renderLists(); if (!keepProps || !document.activeElement || !$("props").contains(document.activeElement)) renderProps(); renderChecks(); renderElev(); renderSite(); }

// ---------- add objects ----------
$("addCrane").onclick = () => openCranePicker();
$("addLoad").onclick = () => openLoadBuilder(null);
$("wLoad").onclick = () => openLoadBuilder(null); $("wCrane").onclick = () => openCranePicker(); $("wOpen").onclick = () => $("bPlans").click();
$("addObs").onclick = () => { const o = { id: uid(), kind: "rect", label: "Object", x: view.cx, y: view.cy + 6, w: 4, h: 3, rot: 0, zone: false }; plan.obstacles.push(o); sel = { kind: "obs", id: o.id }; markDirty(); renderAll(); };
$("addZone").onclick = () => { const o = { id: uid(), kind: "circle", label: "Exclusion zone", x: view.cx, y: view.cy, r: 6, zone: true }; plan.obstacles.push(o); sel = { kind: "obs", id: o.id }; markDirty(); renderAll(); };
for (const [b, v] of [["phPick", "pick"], ["phSet", "set"], ["phBoth", "both"]]) $(b).onclick = () => { plan.phase = v; renderMeta(); renderSite(); };
for (const [b, v] of [["evPick", "pick"], ["evSet", "set"]]) $(b).onclick = () => { elevPhase = v; $("evPick").setAttribute("aria-pressed", v === "pick"); $("evSet").setAttribute("aria-pressed", v === "set"); renderElev(); };
$("elevCrane").onchange = renderElev;
$("planName").onchange = e => { plan.name = e.target.value; markDirty(); };
$("gbc").onchange = e => { plan.site.gbc = +e.target.value; markDirty(); renderAll(true); };
if ($("ulim")) $("ulim").onchange = e => { plan.site.ulim = +e.target.value; markDirty(); renderAll(true); };
$("showGrid").onchange = e => { plan.site.grid = e.target.checked; markDirty(); renderSite(); };
for (const [id, k] of [["mCompany", "company"], ["mRev", "rev"], ["mRevDesc", "revDesc"], ["mDisc", "disclaimer"], ["mClient", "client"], ["mProj", "project"], ["mLift", "lift"], ["mDate", "date"], ["mBy", "by"], ["mNotes", "notes"]]) $(id).onchange = e => { plan.meta[k] = e.target.value; markDirty(); };

// ---------- background ----------
const calib = { active: false, pts: [] };
$("bgUpload").onclick = () => $("bgFile").click();
$("bgFile").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
  let bg = { w: img.naturalWidth, h: img.naturalHeight, mpp: 0.05, x: view.cx - img.naturalWidth * 0.025, y: view.cy + img.naturalHeight * 0.025, opacity: 0.85 };
  if (CAP.assets) {
    try { const r = await CAP.assets.upload(f); bg.asset = r.id; bg.url = r.url; toast("Background uploaded – now set its scale"); }
    catch (err) { toast("Couldn't upload the image (" + (err.code || err) + "). It will show until you reload."); bg.url = img.src; }
  } else { bg.url = img.src; toast("Image shown for this session only (saving images isn't available here)."); }
  plan.site.bg = bg; markDirty(); renderMeta(); fitView(); startCalib();
};
$("bgClear").onclick = () => { plan.site.bg = null; markDirty(); renderMeta(); renderSite(); };
$("bgCal").onclick = () => { if (!plan.site.bg && !plan.site.cad) { toast("Upload a site drawing, photo or PDF first"); return; } startCalib(); };
function startCalib() { calib.active = true; calib.pts = []; $("hint").textContent = "Set scale: click the first of two points a known distance apart."; }
function calibClick(w) {
  calib.pts.push(w); renderSite();
  if (calib.pts.length === 1) { $("hint").textContent = "Now click the second point."; return; }
  calib.active = false;
  const d = Math.hypot(calib.pts[1][0] - calib.pts[0][0], calib.pts[1][1] - calib.pts[0][1]);
  let box = $("calBox"); if (!box) { box = document.createElement("div"); box.id = "calBox"; box.style.cssText = "position:absolute;left:50%;top:70px;transform:translateX(-50%);z-index:30;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:10px 12px;display:flex;gap:8px;align-items:end"; $("site").parentElement.appendChild(box); }
  box.hidden = false;
  box.innerHTML = `<label>Real distance between the two points (m)<input type="number" id="calD" step="0.01" value="${fx(d, 2)}"></label><button id="calOk" class="pri">Apply scale</button><button id="calX">Cancel</button>`;
  $("calD").focus(); $("calD").select();
  $("calX").onclick = () => { box.hidden = true; calib.pts = []; renderSite(); };
  $("calD").onkeydown = e => { if (e.key === "Enter") $("calOk").click(); };
  $("calOk").onclick = () => {
    const real = +$("calD").value; if (!(real > 0)) return;
    const bg = plan.site.bg, k = real / d, c = calib.pts[0];
    box.hidden = true;
    if (bg) { bg.mpp *= k; bg.x = c[0] + (bg.x - c[0]) * k; bg.y = c[1] + (bg.y - c[1]) * k; }
    if (typeof cadRescale === "function") cadRescale(c, k);
    calib.pts = []; $("hint").textContent = "Drag cranes, loads and site items. Scroll to zoom, drag empty space to pan."; markDirty(); renderMeta(); fitView();
  };
}

// ---------- save / plans ----------
async function savePlan() {
  if (!CAP.db) { toast("Saving isn't available in this view – export JSON instead."); return; }
  syncLift(); const doc = clone(plan); if (doc.site.bg && !CAP.local) delete doc.site.bg.url;
  try { await CAP.db.doc("plans/" + plan.id).set(doc); dirty = false; refreshSaveState(); toast("Lift plan saved"); }
  catch (e) { toast(e.code === "quota_exceeded" ? "Storage full – delete old plans first." : "Couldn't save (" + (e.code || e) + ")"); }
}
$("bSave").onclick = savePlan;
$("bNew").onclick = () => { if (dirty && plan.cranes.length + plan.loads.length && !$("bNew").dataset.armed) { $("bNew").dataset.armed = "1"; $("bNew").textContent = "Discard changes?"; setTimeout(() => { delete $("bNew").dataset.armed; $("bNew").textContent = "New"; }, 3000); return; } delete $("bNew").dataset.armed; $("bNew").textContent = "New"; openPlan(blankPlan()); view.cx = 0; view.cy = 0; view.s = 12; renderSite(); };
$("bPlans").onclick = () => { renderPlans(); $("dPlans").showModal(); };
function renderPlans() {
  $("plansNote").textContent = CAP.shared ? "Plans are saved in the team's shared database – everyone who is signed in sees them, and a colleague's save shows up without refreshing. Back up keeps a copy as a file." : CAP.local ? "Plans are saved in this browser on this computer. Use Back up to keep a copy or move plans to another computer or person." : CAP.db ? "Saved lift plans are shared with everyone who can open this app." : "Saved plans aren't available in this view.";
  const list = [...planIndex].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  $("plansGrid").innerHTML = list.map(p => `<div class="pcard"><b>${escH(p.name)}</b><span class="small">${escH(p.meta?.project || "")} · ${(p.cranes || []).length} crane(s) · ${new Date(p.updated || 0).toLocaleString("en-GB")}</span>
    <div class="btnrow"><button data-open="${p.id}" class="pri">Open</button><button data-copy="${p.id}">Duplicate</button><button data-del="${p.id}">Delete</button></div></div>`).join("") || `<p class="small">No saved plans yet. Press Save to store the current plan.</p>`;
  $("plansGrid").querySelectorAll("[data-open]").forEach(b => b.onclick = () => { const p = planIndex.find(x => x.id === b.dataset.open); const q = clone(p); if (q.site.bg && q.site.bg.asset && !CAP.local) q.site.bg.url = "/_blob/" + q.site.bg.asset; $("dPlans").close(); openPlan(q); });
  $("plansGrid").querySelectorAll("[data-copy]").forEach(b => b.onclick = () => { const p = clone(planIndex.find(x => x.id === b.dataset.copy)); p.id = uid(); p.name += " (copy)"; if (p.site.bg?.asset && !CAP.local) p.site.bg.url = "/_blob/" + p.site.bg.asset; $("dPlans").close(); openPlan(p, true); });
  $("plansGrid").querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Confirm delete"; return; }
    try { await CAP.db.doc("plans/" + b.dataset.del).delete(); toast("Plan deleted"); } catch (e) { toast("Couldn't delete"); }
  });
}
// ---------- backup / restore ----------
$("bBackup").onclick = async () => {
  const strip = p => { const d = clone(p); if (d.site?.bg && !CAP.local) delete d.site.bg.url; return d; };
  const data = { liftplanBackup: 1, saved: new Date().toISOString(), plans: planIndex.map(strip), cranes: customCranes, charts: customCharts };
  if (!CAP.downloads) { toast("Saving files isn't available in this view."); return; }
  try { await CAP.downloads.save({ filename: "LiftPlan_backup_" + new Date().toISOString().slice(0, 10) + ".json", data: JSON.stringify(data), mimeType: "application/json" }); toast("Backup saved"); }
  catch (e) { toast("Couldn't save the backup"); }
};
$("bRestore").onclick = () => $("restoreFile").click();
$("restoreFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  let d; try { d = JSON.parse(await f.text()); } catch (err) { toast("That file isn't a LiftPlan file"); return; }
  if (d && d.liftplanBackup) {
    if (!CAP.db) { toast("Saving isn't available in this view."); return; }
    let n = 0;
    try {
      for (const c of d.cranes || []) { const { id, ...rest } = c; await CAP.db.doc("cranes/" + id).set(rest); n++; }
      for (const c of d.charts || []) { await CAP.db.doc("charts/" + c.id).set(c); n++; }
      for (const p of d.plans || []) { const { ...rest } = p; await CAP.db.doc("plans/" + p.id).set(rest); n++; }
      toast(`Imported ${(d.plans || []).length} plan(s) and ${(d.cranes || []).length} crane(s)`);
    } catch (err) { toast("Import stopped (" + (err.code || err) + ")"); }
    return;
  }
  if (d && Array.isArray(d.cranes) && Array.isArray(d.loads)) {
    if (!d.id) d.id = uid(); d.site = d.site || { gbc: "", grid: true }; d.site.ulim = 100; d.meta = d.meta || {};
    $("dPlans").close(); openPlan(d, true); toast("Plan opened – press Save to keep it");
    return;
  }
  toast("That file isn't a LiftPlan file");
};
document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => b.closest("dialog").close());

// ---- company / client logos for the title block: a small PNG kept with the plan; no logo = the space stays blank
function renderLogoRows() {
  document.querySelectorAll(".logoRow[data-logo]").forEach(row => { const k = row.dataset.logo, v = plan.meta[k];
    row.innerHTML = `${v ? `<img src="${escH(v)}" alt="">` : `<span class="small">No logo – the space stays blank</span>`}<label class="btn small" style="cursor:pointer;margin:0">${v ? "Change logo" : "Add logo"}<input type="file" accept="image/*" hidden></label>${v ? `<button class="small" data-rm="1">Remove</button>` : ""}`;
    row.querySelector("input").onchange = async e => { const f = e.target.files[0]; if (!f) return; const u = await logoData(f); if (!u) { toast("Couldn't read that picture"); return; } plan.meta[k] = u; if (k === "companyLogo") rememberCompany(); markDirty(); renderLogoRows(); };
    const rm = row.querySelector("[data-rm]"); if (rm) rm.onclick = () => { delete plan.meta[k]; if (k === "companyLogo") rememberCompany(); markDirty(); renderLogoRows(); };
  });
}
async function logoData(file) {
  try { const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    const k = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c.toDataURL("image/png"); } catch (e) { return null; }
}
// the company is usually the same from plan to plan – a new plan starts with the last one used (this browser only)
function rememberCompany() { try { localStorage.setItem("lp_company", JSON.stringify({ company: plan.meta.company || "", logo: plan.meta.companyLogo || "" })); } catch (e) { } }
$("mCompany").addEventListener("change", rememberCompany);

// ground surfaces (deck, roads, hard standing, laydown, water…) are drawn first, so nothing standing on them – an SPMT,
// a truck, mats, a building – is ever hidden under one that was added later
const OBS_GROUND = new Set(["deck", "rock", "water", "area", "laydown", "road"]);
function obsDrawOrder(list) { const g = [], r = []; for (const o of list || []) ((OBS_GROUND.has(o.type) || (!o.type && o.pass && !(+o.hgt > 0.05))) && !o.zone ? g : r).push(o); return g.concat(r); }
