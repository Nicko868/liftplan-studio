// ================= Plan the lift: the app proposes the crane, set-up and position =================
// Works backwards from the job: the load, where it's picked and where it's set, on whatever site is loaded.
// Every crane in the library (any make) is tried at the positions it could stand – clear of buildings, loads,
// hazards, on the deck when there is one – with each of its load-chart set-ups; the ones that do the lift
// within the utilisation limit are ranked, most economical first. You pick one and it's placed, mats and all.
const AP = { busy: false, res: [], ld: null };
function apFootprint(C) {
  if (C.type === "cr") return Math.max(C.car.len, C.car.gauge + 1.5) / 2 + 0.5;
  const spread = C.or ? Math.max(...Object.values(C.or.modes).map(m => m.spread || 0)) : 0;
  return Math.max(C.car.front || 6, spread / 2 + 1.3, C.up?.tail || 4);
}
// positions round the pick and set points, best (shortest working radius) first
function apPositions(ld, C, others) {
  const P = liftPointWorld(ld, "C", "pick"), S = liftPointWorld(ld, "C", "set"), M = [(P[0] + S[0]) / 2, (P[1] + S[1]) / 2];
  const reach = (C.boom.Lmax || 40) * 0.92 + (C.boom.pivot?.[0] || 0), rc = apFootprint(C), ext = loadExtent(ld);
  const decks = plan.obstacles.filter(o => o.type === "deck" && (o.pts || []).length > 2);
  const occ = itemCircles(ld.id).filter(c => c.P || !others.some(o => Math.hypot(o.x - c.x, o.y - c.y) < 0.2));
  for (const ph of ["pick", "set"]) occ.push({ x: ld[ph].x, y: ld[ph].y, r: ext + 0.5 });
  const zones = plan.obstacles.filter(o => o.zone && zoneType(o) === "nogo" || o.type === "water");
  const minR = Math.max(rc * 0.55, ext + 2.5);
  const out = [];
  for (let r = 2; r <= reach; r += 1.5) for (let k = 0; k < 40; k++) {
    const a = k * Math.PI / 20, p = [M[0] + r * Math.cos(a), M[1] + r * Math.sin(a)];
    const Rp = Math.hypot(p[0] - P[0], p[1] - P[1]), Rs = Math.hypot(p[0] - S[0], p[1] - S[1]);
    if (Rp > reach || Rs > reach || Math.min(Rp, Rs) < minR) continue;
    if (decks.length && !decks.some(d => inPolyPt(p, d.pts))) continue;
    if (zones.some(z => inPolyPt(p, obsPts(z)))) continue;
    if (!occ.every(c => clearOf(c, p, rc, 0.5))) continue;
    out.push({ x: Math.round(p[0] * 10) / 10, y: Math.round(p[1] * 10) / 10, Rp, Rs, g: Math.max(Rp, Rs) + 0.25 * Math.min(Rp, Rs) });
  }
  out.sort((a, b) => a.g - b.g);
  const pick = []; for (const q of out) { if (pick.every(s => Math.hypot(s.x - q.x, s.y - q.y) > 5)) pick.push(q); if (pick.length >= 7) break; }
  return { list: pick, M };
}
const apSetupW = ch => (+ch.cw || 0) + (+ch.sl || 0) + (ch.slR != null ? 0.5 : 0);
// a crane object set up like "Add crane" does it, for a model / chart / position
function apMakeCrane(model, chart, pos, ld, M) {
  const C = REG.cranes[model];
  const c = { id: uid(), label: "Crane " + (plan.cranes.length + 1), model, x: pos.x, y: pos.y, heading: Math.round(bearingDeg(M[0] - pos.x, M[1] - pos.y)) % 360,
    orMode: C.or ? (C.or.modes[chart.or] ? chart.or : Object.keys(C.or.modes)[0]) : "", chartId: chart.id, col: null, L: C.boom.Lmin, hookBlock: 0, extra: 0, sl: chart.slR || 0, attach: { load: ld.id, point: "C" } };
  const tw = (+ld.weight || 0) + rigW(ld), hbs = [...(C.hookblocks || [])].sort((a, b) => a[0] - b[0]), hb = hbs.find(h => h[0] >= tw) || hbs[hbs.length - 1] || [50, 1];
  c.hookBlock = hb[1]; c.blockCap = hb[0]; c.blockType = hb[0] >= 100 ? "ramshorn" : "single";
  c.parts = Math.max(defaultParts(hb[0]) > 1 ? 2 : 1, Math.min(defaultParts(hb[0]), Math.ceil((tw + hb[1]) / 8)));
  c.boomCfg = bestBoomFor(C, chart, Math.max(pos.Rp, pos.Rs), tw + c.hookBlock, Math.min(pos.Rp, pos.Rs)); c.L = boomLength(C, c.boomCfg);
  return c;
}
// the chart's boom configurations that reach both radii with enough capacity, shortest first (a longer one may be needed for hook height)
function apBoomOptions(C, chart, Rmax, Rmin, need) {
  const reach = L => boomAngle(C, L, Rmax).ok && boomAngle(C, L, Rmin).ok, seen = new Set(), out = [];
  for (const col of chart.cols || []) {
    const code = ((col.note || "").match(/mode\s*(\d+)/) || [])[1];
    const cfg = (C.boom.kind === "tele" && code && cfgFromCode(C, code)) || defaultCfgFor(C, chart.id, col.L);
    const key = JSON.stringify(cfg); if (seen.has(key)) continue; seen.add(key);
    const L = boomLength(C, cfg); if (!reach(L)) continue;
    const lk = craneCapacity(C, { L, boomCfg: cfg }, chart, Rmax); if (lk.cap == null || lk.note || lk.cap < need) continue;
    out.push({ cfg, L });
  }
  return out.sort((a, b) => a.L - b.L);
}
// evaluate one option on its own (other cranes on this load set aside, temporary mats laid and taken away again)
function apEvaluate(c) {
  const keepC = plan.cranes, keepO = plan.obstacles.slice();
  plan.cranes = [c];
  try {
    if (!["ped", "cr"].includes(REG.cranes[c.model].type)) placeMats(c, 2.5, 2.5);   // crawler mats: the planner lays them
    const S = craneSummary(c);
    return { util: S.util, status: S.status, gbp: S.gbp, warn: S.warn.slice(), ground: S.ground || null, cap: S.cap, Rmax: Math.max(S.ph.pick.R || 0, S.ph.set.R || 0) };
  } catch (e) { return { util: null, status: "bad", warn: [String(e.message || e)] }; }
  finally { plan.cranes = keepC; plan.obstacles = keepO; }
}
async function planTheLift(ld) {
  if (AP.busy) return; AP.busy = true; AP.ld = ld; AP.res = []; renderAP("Working through every crane in the library…");
  // the rigging is part of the lift (weight and height under the hook): set up the suggested one first if there is none yet
  if (!ld.rig || (ld.rig.auto && !ld.rig.q)) { try { qrApply(ld, null, true); normLoad(ld); } catch (e) { console.warn(e); } }
  const lim = +plan.site.ulim || 75, others = plan.cranes.filter(c => c.attach?.load === ld.id);
  const models = Object.keys(REG.cranes).filter(k => REG.cranes[k].type !== "ped" && chartsFor(k).length);
  const res = [];
  for (const model of models) {
    await new Promise(r => setTimeout(r, 0));
    const C = REG.cranes[model], { list, M } = apPositions(ld, C, others);
    const name = C.name || C.short || model;
    if (!list.length) { res.push({ model, name, ok: false, why: "No clear spot within reach of both the pick and the set" }); continue; }
    // SH first, then superlift with the least SL ballast that works (all ballast counts towards the set-up weight)
    const charts = chartsFor(model).sort((a, b) => apSetupW(a) - apSetupW(b));
    let best = null, closest = null;
    for (const pos of list) for (const ch of charts) {
      const c = apMakeCrane(model, ch, pos, ld, M); let E = apEvaluate(c);
      // not enough hook height (tall load, long rigging): try the longer booms of this set-up
      if (E.warn.some(w => /hook height/.test(w))) for (const o of apBoomOptions(REG.cranes[model], ch, Math.max(pos.Rp, pos.Rs), Math.min(pos.Rp, pos.Rs), ((+ld.weight || 0) + rigW(ld) + c.hookBlock) / (lim / 100))) {
        if (o.L <= c.L) continue; c.boomCfg = o.cfg; c.L = o.L; E = apEvaluate(c); if (!E.warn.some(w => /hook height/.test(w))) break;
      }
      const okUtil = E.util != null && E.util <= lim, okAll = okUtil && E.status !== "bad" && !E.warn.some(w => /hook height|No chart capacity/.test(w));
      const cand = { model, name, chart: ch, pos, crane: c, E, ok: okAll };
      if (okAll) { if (!best || apSetupW(ch) < apSetupW(best.chart) || (apSetupW(ch) === apSetupW(best.chart) && E.util < best.E.util)) best = cand; break; }   // lightest set-up that works here
      if (E.util != null && (!closest || E.util < closest.E.util)) closest = cand;
    }
    if (best) res.push(best);
    else res.push({ model, name, ok: false, why: closest ? `Best it can do: ${fx(closest.E.util, 0)} % utilisation at ${fx(closest.E.Rmax, 1)} m${closest.E.ground?.bad?.length ? " · ground problem under a pad" : ""}` : "Can't reach both points with any set-up" });
  }
  // most economical first: the smallest crane that does it, then the lighter set-up, then the lower utilisation
  const size = r => (REG.cranes[r.model].mass?.base || 0) + (r.chart ? apSetupW(r.chart) : 0);
  res.sort((a, b) => (b.ok - a.ok) || (a.ok ? size(a) - size(b) || a.E.util - b.E.util : 0));
  AP.res = res; AP.busy = false; renderAP();
}
function apApply(i) {
  const r = AP.res[i], ld = AP.ld; if (!r || !r.ok) return;
  ltSnapPlan("plan the lift");
  // the cranes already on this load (unlocked) make way for the chosen one
  const old = plan.cranes.filter(c => c.attach?.load === ld.id && !c.locked);
  for (const c of old) { const ms = matsUnderCrane(c); plan.obstacles = plan.obstacles.filter(o => !ms.includes(o)); }
  plan.cranes.splice(0, plan.cranes.length, ...plan.cranes.filter(c => !old.includes(c)));
  const c = { ...r.crane, id: uid(), label: "Crane " + (plan.cranes.length + 1) }; setPaint(c, nextPaint());
  plan.cranes.push(c);
  if (!["ped", "cr"].includes(REG.cranes[c.model].type)) placeMats(c, 2.5, 2.5);   // crawler mats: the planner lays them
  sel = { kind: "crane", id: c.id }; $("dAuto").close(); markDirty(); renderAll(); fitView();
  toast(`${r.name} placed – ${r.chart.label || r.chart.id}, ${fx(r.E.util, 0)} % utilisation. Ctrl+Z to undo.`, 7000);
}
const ltSnapPlan = () => { try { syncLift(); } catch (e) { } };   // markDirty() records the undo step
document.body.insertAdjacentHTML("beforeend", `<dialog id="dAuto" style="width:min(900px,96vw)"><div class="dh"><div><b>Plan the lift</b><div class="small" id="apSub"></div></div><button data-close>Close</button></div><div class="db" id="apBody"></div></dialog>`);
function renderAP(busy) {
  const ld = AP.ld, lim = +plan.site.ulim || 75;
  const P = ld && ld.pick, S = ld && ld.set, same = P && S && Math.hypot(P.x - S.x, P.y - S.y) < 0.5;
  $("apSub").textContent = ld ? `${ld.name} · ${fx(+ld.weight || 0, 2)} t + rigging · every crane in your library, any make` : "";
  if (busy) { $("apBody").innerHTML = `<p class="status busy">${escH(busy)}</p>`; return; }
  const ok = AP.res.filter(r => r.ok), no = AP.res.filter(r => !r.ok);
  $("apBody").innerHTML = `${same ? `<p class="status" style="margin:0 0 10px">The set position is the same as the pick – switch to <b>Set</b> and drag the load to where it goes, then plan again for the whole lift.</p>` : ""}
    ${ok.length ? `<div class="aplist">${ok.map((r, i) => `<div class="aprow ${i === 0 ? "best" : ""}">
        <div class="apmain"><b>${escH(r.name)}</b>${i === 0 ? ` <span class="pill ok">Recommended</span>` : ""}<div class="small">${escH(r.chart.label || r.chart.id)}${r.chart.cw != null ? ` · counterweight ${fx(+r.chart.cw, 0)} t` : ""} · radius pick ${fx(r.pos.Rp, 1)} m / set ${fx(r.pos.Rs, 1)} m · boom ${fx(r.crane.L, 1)} m</div>
        ${r.E.warn.filter(w => !/unloads/.test(w)).length ? `<div class="small" style="color:var(--amber)">${r.E.warn.filter(w => !/unloads/.test(w)).slice(0, 2).map(escH).join(" · ")}</div>` : ""}</div>
        <div class="apnums"><span class="pill ${r.E.util > lim ? "bad" : r.E.util > lim * 0.85 ? "amber" : "ok"}">${fx(r.E.util, 0)} %</span>${r.E.gbp != null ? `<span class="small">${fx(r.E.gbp, 1)} t/m² on 2.5 m mats</span>` : ""}</div>
        <button class="${i === 0 ? "pri" : ""}" data-ap="${AP.res.indexOf(r)}">Use this crane</button></div>`).join("")}</div>`
      : `<p class="status bad">No crane in your library can do this lift within ${lim} % from a clear spot. Add a bigger crane to the library, move the pick or set point, or clear space on the site.</p>`}
    ${no.length ? `<details style="margin-top:10px"><summary class="small">${no.length} crane${no.length === 1 ? "" : "s"} that can't do it</summary>${no.map(r => `<div class="small" style="padding:3px 0"><b>${escH(r.name)}</b> – ${escH(r.why)}</div>`).join("")}</details>` : ""}
    <p class="small" style="margin:10px 0 0">Each crane is tried at the positions where it can reach both points without standing on a load, building or hazard${plan.obstacles.some(o => o.type === "deck") ? ", on the deck" : ""}, with every set-up in its load charts (lightest counterweight first). Using one replaces the crane on this load; the plan, mats and checks update and Ctrl+Z undoes it.</p>`;
  $("apBody").querySelectorAll("[data-ap]").forEach(b => b.onclick = () => apApply(+b.dataset.ap));
}
function openPlanLift(ld) {
  ld = ld || (sel?.kind === "load" && plan.loads.find(l => l.id === sel.id)) || plan.loads[0];
  if (!ld) { toast("Add the load first – then the app can choose and place the crane"); return; }
  AP.ld = ld; $("dAuto").showModal(); planTheLift(ld);
}
// entry points: the toolbar, and the load's panel
{ const t = $("tDim"); if (t) { t.insertAdjacentHTML("afterend", `<button id="tPlan" title="Let the app choose and place the crane for the selected load">✦ Plan lift</button>`); $("tPlan").onclick = () => openPlanLift(); } }
{ const _rp = renderProps; renderProps = function (...a) { const r = _rp(...a); try { if (sel?.kind === "load" && $("lDel") && !$("lPlan")) { const ld = plan.loads.find(l => l.id === sel.id); const b = document.createElement("button"); b.id = "lPlan"; b.className = "pri"; b.textContent = "✦ Plan the lift"; b.title = "Choose and place the crane for this load"; b.onclick = () => openPlanLift(ld); $("lDel").before(b); } } catch (e) { } return r; }; }
// the automatic boom choice everywhere in the app also checks hook height: if the shortest boom can't lift the load
// high enough over its rigging, step up to the next boom length of the same set-up
{ const _ab = autoBoom; autoBoom = function (cr) {
    const k0 = cr._autoKey, r = _ab(cr);
    if (cr._autoKey === k0 || cr.autoBoom === false) return r;
    try {
      const C = REG.cranes[cr.model], chart = REG.charts[cr.chartId]; if (!C || !chart) return r;
      const hh = () => craneSummary(cr).warn.some(w => /hook height/.test(w));
      if (!hh()) return r;
      const a = evalCrane(cr, "pick"), b = evalCrane(cr, "set"), Rmax = Math.max(a.R || 0, b.R || 0), Rmin = Math.min(a.R || Rmax, b.R || Rmax), tw = Math.max(a.hookLoad || 0, b.hookLoad || 0);
      const keep = { cfg: cr.boomCfg, L: cr.L };
      for (const o of apBoomOptions(C, chart, Rmax, Rmin, tw / ((+plan.site.ulim || 75) / 100))) { if (o.L <= keep.L) continue; cr.boomCfg = o.cfg; cr.L = o.L; if (!hh()) return r; }
      cr.boomCfg = keep.cfg; cr.L = keep.L;      // nothing better in this set-up – keep the warning visible
    } catch (e) { console.warn(e); }
    return r;
  }; }
