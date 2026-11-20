// ================= Add-crane picker, boom configuration, load builder, property panels =================

// ---------- crane picker ----------
function craneThumb(C) {
  try {
    const s = new Scene(), om = C.or ? Object.keys(C.or.modes)[0] : "";
    s.add(carrierPlan(C, om, false));
    const L = C.boom.Lmin + (C.boom.Lmax - C.boom.Lmin) * 0.25, cfg = C.boom.kind === "tele" ? { ext: boomCfgFor(C, L).ext } : { joints: boomJoints(C, boomCfgFor(C, L)) };
    s.add(upperPlan(C, boomLength(C, boomCfgFor(C, L)), 55, 0, cfg), -35);
    return toSVG(s, { pad: 1, noSize: true, lw: 0.06 });
  } catch (e) { return ""; }
}
function openCranePicker() {
  const draw = () => {
    const q = $("acSearch").value.trim().toLowerCase();
    const list = Object.values(REG.cranes).filter(C => C.type !== "ped" && (!q || (C.name + " " + C.short + " " + C.cap).toLowerCase().includes(q)));
    const vcr = typeof vesselsAll === "function" ? vesselsAll().flatMap(o => (o.cranes || []).map(sp => ({ o, sp }))) : [];
    $("acGrid").innerHTML = list.map(C => {
      const n = chartsFor(C.id).length;
      return `<button class="pcrane" data-model="${escH(C.id)}"><div class="img">${craneThumb(C)}</div><b>${escH(C.name)}</b>
        <div class="tags"><span class="tag">${escH(C.cap || "")}</span><span class="tag">${C.type === "cr" ? "Crawler · lattice" : "All-terrain · telescopic"}</span><span class="tag">${fx(C.boom.Lmin)}–${fx(C.boom.Lmax)} m</span>
        ${n ? `<span class="tag good">${n} load chart${n > 1 ? "s" : ""}</span>` : `<span class="tag warn">no charts yet</span>`}${C.custom ? `<span class="tag">your crane</span>` : ""}</div></button>`;
    }).join("") + vcr.map(({ o, sp }) => `<button class="pcrane" data-vcrane="${o.id}:${sp.id}"><div class="img">${REG.cranes[pedModelId(o, sp)] ? craneThumb(REG.cranes[pedModelId(o, sp)]) : ""}</div><b>${escH(sp.name || "Vessel crane")} – ${escH(o.label || "vessel")}</b>
        <div class="tags"><span class="tag">${fx(+sp.swl || 0)} t</span><span class="tag">Vessel crane</span><span class="tag">${fx(+sp.L || 0)} m boom</span>${parseChart(sp.chart).length ? `<span class="tag good">chart</span>` : `<span class="tag warn">no chart yet</span>`}</div></button>`).join("")
      + `<button class="pcrane" id="acNew" style="justify-content:center;align-items:center;min-height:230px;border-style:dashed"><b>+ New crane</b><span class="small">From a spec sheet or by typing the dimensions</span></button>`
      + `<button class="pcrane" id="acVessel" style="justify-content:center;align-items:center;min-height:230px;border-style:dashed"><b>+ Vessel crane</b><span class="small">Lift with the ship's own crane(s) instead of a shore crane – pick the vessel, then enter each crane from its spec / load chart</span></button>`;
    $("acGrid").querySelectorAll("[data-model]").forEach(b => b.onclick = () => { $("dAddCrane").close(); addCraneOf(b.dataset.model); });
    $("acNew").onclick = () => { $("dAddCrane").close(); openEditor(null); };
    $("acVessel").onclick = () => { $("dAddCrane").close(); openVesselDialog(vesselsAll()[0] || null, "crane"); };
    $("acGrid").querySelectorAll("[data-vcrane]").forEach(b => b.onclick = () => { const [vid, sid] = b.dataset.vcrane.split(":"), o = plan.obstacles.find(x => x.id === vid), sp = o?.cranes.find(c => c.id === sid); $("dAddCrane").close(); if (o && sp) useVesselCrane(o, sp); });
  };
  $("acSearch").value = ""; $("acSearch").oninput = draw; draw();
  $("dAddCrane").showModal(); $("dAddCrane").querySelector(".db").scrollTop = 0;
}
function bestBoomFor(C, chart, R, tw, Rmin) {
  const reach = L => boomAngle(C, L, R).ok && (Rmin == null || boomAngle(C, L, Rmin).ok);
  // every chart configuration (length / telescoping code) that reaches R: prefer the shortest boom that keeps
  // utilisation within the limit, otherwise the configuration with the most capacity
  const cands = [];
  if (chart) {
    const seen = new Set();
    for (const col of chart.cols) {
      const code = ((col.note || "").match(/mode\s*(\d+)/) || [])[1];
      const cfg = (C.boom.kind === "tele" && code && cfgFromCode(C, code)) || defaultCfgFor(C, chart.id, col.L);
      const key = JSON.stringify(cfg); if (seen.has(key)) continue; seen.add(key);
      const Lc = boomLength(C, cfg); if (!reach(Lc)) continue;
      const lk = craneCapacity(C, { L: Lc, boomCfg: cfg }, chart, R);
      if (lk.cap != null && !lk.note) cands.push({ cfg, L: Lc, cap: lk.cap });
    }
  }
  const need = (+tw || 0) / ((+plan.site.ulim || 75) / 100);
  const ok = cands.filter(c => c.cap >= need).sort((a, b) => a.L - b.L || b.cap - a.cap);
  if (ok.length) return ok[0].cfg;
  if (cands.length) return cands.sort((a, b) => b.cap - a.cap)[0].cfg;
  for (let L = C.boom.Lmin; L <= C.boom.Lmax; L += 0.5) if (reach(L)) return defaultCfgFor(C, chart?.id, L);
  for (let L = C.boom.Lmin; L <= C.boom.Lmax; L += 0.5) if (boomAngle(C, L, R).ok) return defaultCfgFor(C, chart?.id, L);
  if (R > C.boom.Lmax * 0.8) return defaultCfgFor(C, chart?.id, C.boom.Lmax);
  return defaultCfgFor(C, chart?.id, C.boom.Lmin);
}
function addCraneOf(model) {
  const C = REG.cranes[model]; if (!C) return;
  const ch = chartsFor(model)[0];
  const ld = plan.loads[0];
  const k = ld ? plan.cranes.filter(c => c.attach?.load === ld.id).length : 0;
  let x = view.cx, y = view.cy, heading = 0, point = "C";
  if (ld) {
    normLoad(ld);
    const brg = [180, 0, 90, 270][k % 4], d = loadExtent(ld) + (C.type === "cr" ? C.car.len / 2 + 4 : C.car.front + 1.5);
    x = Math.round((ld.pick.x + d * Math.sin(brg * D2R)) * 10) / 10; y = Math.round((ld.pick.y + d * Math.cos(brg * D2R)) * 10) / 10;
    heading = (brg + 180) % 360;
    if (ld.span > 0 && k === 1) { const other = plan.cranes.find(c => c.attach?.load === ld.id); if (other && other.attach.point === "C") other.attach.point = "A"; point = "B"; }
  }
  const c = { id: uid(), label: "Crane " + (plan.cranes.length + 1), model, x, y, heading, orMode: C.or ? Object.keys(C.or.modes)[0] : "", chartId: ch ? ch.id : "",
    col: null, L: C.boom.Lmin, hookBlock: 0, extra: 0, sl: 0, attach: { load: ld?.id || "", point } };
  setPaint(c, nextPaint());
  // hook block: smallest that is at least the load's weight
  const tw = ld ? (+ld.weight || 0) + rigW(ld) : 0;
  const hbs = [...(C.hookblocks || [])].sort((a, b) => a[0] - b[0]);
  const hbSel = hbs.find(h => h[0] >= tw / Math.max(1, k + 1)) || hbs[hbs.length - 1] || [50, 1];
  c.hookBlock = hbSel[1]; c.blockCap = hbSel[0]; c.blockType = hbSel[0] >= 100 ? "ramshorn" : "single";
  c.parts = Math.max(defaultParts(hbSel[0]) > 1 ? 2 : 1, Math.min(defaultParts(hbSel[0]), Math.ceil((tw / Math.max(1, k + 1) + hbSel[1]) / 8)));
  if (!ld) { c.tip = { pick: { free: true, R: 10, brg: 0 }, set: { free: true, R: 10, brg: 0 } }; }
  plan.cranes.push(c);
  if (C.type !== "cr" && C.type !== "ped") placeMats(c, 2.5, 2.5);   // a mobile crane always goes on 4 mats
  const R = ld ? evalCrane(c, "pick").R : 10;
  c.boomCfg = bestBoomFor(C, ch, R, tw / Math.max(1, k + 1) + c.hookBlock); c.L = boomLength(C, c.boomCfg);
  if (ld && (!ld.rig || ld.rig.auto)) { qrApply(ld, null, true); normLoad(ld); }
  else if (ld && k >= 1 && ld.rig?.arr !== "tandem" && ld.rig?.arr !== "build") setTimeout(() => { const t = $("toast"); t.innerHTML = `Tandem lift – ${escH(ld.name)}'s rigging is set up for one hook <button id="tTan" style="margin-left:10px">Switch to tandem rigging</button>`; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 9000); $("tTan").onclick = () => { t.hidden = true; applyPreset(ld, "tandem"); normLoad(ld); markDirty(); renderAll(); openRigBuilder(ld); }; }, 60);
  sel = { kind: "crane", id: c.id }; markDirty(); renderAll(); fitView();
  if (ld && ld.rig?.auto) setTimeout(() => { const t = $("toast"); t.innerHTML = `Rigging for ${escH(ld.name)} set up and sized by the app <button id="tRig" style="margin-left:10px">Rigging…</button>`; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 8000); $("tRig").onclick = () => { t.hidden = true; openRigBuilder(ld); }; }, 50);
  if (ld && ld.span > 0 && k === 1) toast("Tandem set up: first crane on point A, this crane on point B");
}

// ---------- boom configuration panel ----------
function boomVizSVG(C, cr) {
  const s = new Scene(), b = C.boom;
  if (b.kind === "tele") {
    const cum = teleCum(b, cr.L, { ext: cr.boomCfg.ext });
    for (let i = b.n - 1; i >= 0; i--) {
      const s0 = cum[i], s1 = Math.min(cum[i] + b.Lmin - 1.0 - 0.1 * i, cr.L - 0.4), h = 1.6 * (1 - 0.08 * i);
      s.rect("BOOM", s0, -h / 2, s1, h / 2, { fill: i ? "#dbe7f5" : "#bcd3ee", w: 1 });
      s.text("DIMS", [s1 - 0.9, 0], i ? "T" + i : "B", 0.62, { bold: true });
    }
    s.poly("BOOM", [[cr.L - 0.4, -0.5], [cr.L, -0.2], [cr.L, 0.2], [cr.L - 0.4, 0.5]], { closed: true, fill: "#9fb1c4", w: 0.8 });
  } else {
    const J = boomJoints(C, cr.boomCfg), pts = [0, ...J, cr.L];
    pts.slice(0, -1).forEach((a, i) => {
      const e = pts[i + 1], first = i === 0, last = i === pts.length - 2, h = 1.6;
      const P = first ? [[a, -0.3], [e, -h / 2], [e, h / 2], [a, 0.3]] : last ? [[a, -h / 2], [e, -0.3], [e, 0.3], [a, h / 2]] : [[a, -h / 2], [e, -h / 2], [e, h / 2], [a, h / 2]];
      s.poly("BOOM", P, { closed: true, fill: first || last ? "#bcd3ee" : "#e7eff9", w: 1 });
      let f = 1; for (let x = a; x < e - 0.1; x += 1.4) { s.poly("BOOM", [[x, -f * 0.7], [Math.min(x + 1.4, e), f * 0.7]], { w: 0.35 }); f = -f; }
      s.text("DIMS", [(a + e) / 2, -1.35], `${+(e - a).toFixed(2)}`, 0.6, { bold: true });
    });
  }
  s.poly("DIMS", [[0, 1.3], [cr.L, 1.3]], { w: 0.5 });
  s.text("DIMS", [cr.L / 2, 1.9], `${fx(cr.L, 2)} m`, 0.7, { bold: true });
  return toSVG(s, { pad: 0.6, noSize: true, lw: 0.05 });
}
function boomPanel(c, C, chart) {
  const b = C.boom, phA = plan.phase === "set" ? "set" : "pick", evA = evalCrane(c, phA), ang = Math.round((evA.ba?.theta || 0) * 10) / 10;
  const S = craneSummary(c), inChart = chart ? !evA.capNote : null;
  // 1 · boom length: pick straight from the chart's boom lengths (the current one is shown selected)
  const lens = chart ? chartLengths(chart) : [];
  const onList = lens.some(L => Math.abs(L - c.L) < 0.06);
  const lenSel = lens.length ? `<select id="bcPreset">${onList ? "" : `<option value="" selected>${fx(c.L, 2)} m – not a chart length</option>`}${lens.map(L => `<option value="L${L}" ${Math.abs(L - c.L) < 0.06 ? "selected" : ""}>${fx(L, 2)} m</option>`).join("")}</select>`
    : `<input type="number" id="bcLen" step="${b.kind === "tele" ? 0.01 : 3}" min="${b.Lmin}" max="${b.Lmax}" value="${fx(c.L, 2)}">`;
  // 3 · capacity: from the chart at max radius, or typed in (manual wins until reset)
  const capAuto = S.capChart != null ? S.capChart : (S.capManual ? null : S.cap);
  let h = `<div class="boomviz">${boomVizSVG(C, c)}</div>
    <div class="row"><label>Boom length${lenSel}</label>
      <label>Boom angle – ${phA} °<input type="number" id="bcAngN" step="0.5" min="0" max="${C.maxAngle}" value="${ang}"></label></div>
    <input type="range" id="bcAng" min="0" max="${C.maxAngle}" step="0.5" value="${ang}" aria-label="Boom angle">
    <div class="small" style="display:flex;justify-content:space-between"><span id="bcAngR">Radius ${fx(evA.R, 2)} m</span><span>${!chart ? `<span class="pill na">no chart</span>` : inChart ? `<span class="pill ok">in chart</span>` : `<span class="pill amber">not in chart</span>`}</span></div>
    ${evA.ba && !evA.ba.ok ? `<p class="small" style="color:var(--bad)">${escH(evA.ba.why)}</p>` : ""}
    ${evA.capNote ? `<p class="small" style="color:var(--amber)">${escH(evA.capNote)}</p>` : ""}
    <label>Capacity at max radius (${fx(S.maxR || 0, 2)} m) – t<span style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center"><input type="number" id="bcCap" step="0.1" min="0" value="${S.capManual ? c.capManual : ""}" placeholder="${capAuto != null ? fx(capAuto) + " (from chart)" : "type the chart capacity"}">${S.capManual ? `<button id="bcCapReset" title="Use the load chart value again">Use chart</button>` : ""}</span></label>
    <p class="small">${S.capStale ? `<b style="color:var(--bad)">Typed ${fx(S.capStale.cap)} t (for R ${fx(S.capStale.R, 2)} m) no longer used</b> – ${escH(S.capStale.why)}. ` : ""}${S.capManual ? `<b style="color:var(--amber)">Manual capacity in use</b>${capAuto != null ? ` – the chart gives ${fx(capAuto)} t${S.rUsed != null ? " (" + fx(S.rUsed) + " m row)" : ""}` : ""}.` : capAuto != null ? `From the load chart${S.rUsed != null ? " – " + fx(S.rUsed) + " m row" : ""}. Type a value to override it.` : "No chart value – type the capacity from your load chart."}</p>
    <div class="btnrow"><button id="bcBest">Suggest boom for this lift</button><label class="chk" style="margin:0"><input type="checkbox" id="bcAuto" ${c.autoBoom !== false ? "checked" : ""}> Auto boom</label></div>
    <details class="bcAdv"><summary class="small">Boom sections${b.kind === "tele" ? ` · telescoping ${evA.code || ""}` : ` · ${["Foot " + latticeInfo(C).foot, ...(c.boomCfg.inserts || []), "Head " + latticeInfo(C).head].join(" + ")}`}</summary>`;
  if (b.kind === "tele") {
    const t = teleInfo(C);
    h += `<div style="display:flex;flex-direction:column;gap:4px">${c.boomCfg.ext.map((e, i) => `<div class="secrow"><b>T${i + 1}</b>${t.steps
      ? `<select data-tele="${i}">${t.steps.map((v, k) => `<option value="${v}" ${Math.abs(v - e) < 0.06 ? "selected" : ""}>${escH(t.stepNames?.[k] ?? k)} · ${fx(v, 2)} m</option>`).join("")}${t.steps.some(v => Math.abs(v - e) < 0.06) ? "" : `<option selected value="${e}">${fx(e, 2)} m (custom)</option>`}</select>`
      : `<input type="range" data-tele="${i}" min="0" max="${t.stroke}" step="0.01" value="${e}">`}<span class="small" style="text-align:right">${fx(e / t.stroke * 100, 0)}% · ${fx(e, 2)}</span></div>`).join("")}</div>
      <div class="btnrow"><button id="bcIn">All in</button><button id="bcOut">All out</button></div>`;
  } else {
    const li = latticeInfo(C);
    h += `<div class="inslist"><span class="ins fixed">Foot ${li.foot}</span>${c.boomCfg.inserts.map((v, i) => `<span class="ins">${v}<button data-insdel="${i}" title="Remove insert">×</button></span>`).join("")}<span class="ins fixed">Head ${li.head}</span></div>
      <div class="btnrow">${li.inserts.map(v => `<button data-insadd="${v}">+ ${v} m</button>`).join("")}<button id="bcClear">Clear</button></div>
      <p class="small">Check the make-up against the manufacturer's boom table.</p>`;
  }
  return h + `</details>`;
}
let BC_ADV_OPEN = false;
function wireBoomPanel(c, C, chart, up) {
  const t = C.boom.kind === "tele" ? teleInfo(C) : null;
  if ($("bcAuto")) $("bcAuto").onchange = e => up(() => { c.autoBoom = e.target.checked; c._autoKey = null; });
  if ($("bcAng")) {
    const setAng = (deg, commit) => { const ph = plan.phase === "set" ? "set" : "pick", ev = evalCrane(c, ph); const R = Math.max(0.5, C.boom.pivot[0] + c.L * Math.cos(deg * D2R));
      c.autoBoom = false; setHookRB(c, ph, Math.round(R * 100) / 100, ev.bearing);
      if (commit) up(() => { }); else { $("bcAngN").value = deg; $("bcAngR").textContent = `Radius ${fx(R, 2)} m`; markDirty(true); renderSite(); scheduleSide(); } };
    $("bcAng").oninput = e => setAng(+e.target.value, false); $("bcAng").onchange = e => setAng(+e.target.value, true);
    $("bcAngN").onchange = e => setAng(Math.max(0, Math.min(C.maxAngle, +e.target.value)), true);
  }
  if ($("bcCap")) $("bcCap").onchange = e => up(() => { const v = +e.target.value; if (v > 0) { const S2 = craneSummary(c), ch = REG.charts[c.chartId] && REG.charts[c.chartId].craneId === c.model ? c.chartId : null; c.capManual = Math.round(v * 100) / 100; c.capManualR = Math.round((S2.maxR || 0) * 100) / 100; c.capManualChart = ch; } else { delete c.capManual; delete c.capManualR; delete c.capManualChart; } });
  if ($("bcCapReset")) $("bcCapReset").onclick = () => up(() => { delete c.capManual; delete c.capManualR; delete c.capManualChart; });
  { const d = document.querySelector(".bcAdv"); if (d) { d.open = !!BC_ADV_OPEN; d.ontoggle = () => { BC_ADV_OPEN = d.open; }; } }
  if ($("bcBest")) $("bcBest").onclick = () => up(() => { c.autoBoom = true; c._autoKey = null; const S = craneSummary(c); c.boomCfg = bestBoomFor(C, chart, S.maxR || 10, S.TW); c.L = boomLength(C, c.boomCfg); });
  if ($("bcPreset")) $("bcPreset").onchange = e => up(() => {
    const v = e.target.value; if (!v) return;
    c.autoBoom = false; toast(`Boom set to ${v.startsWith("L") ? fx(+v.slice(1), 2) + " m" : v} – auto boom off`);
    if (v.startsWith("L")) c.boomCfg = defaultCfgFor(C, chart.id, +v.slice(1)); else c.boomCfg = cfgFromCode(C, v) || c.boomCfg;
    c.L = boomLength(C, c.boomCfg);
  });
  document.querySelectorAll("[data-tele]").forEach(el => {
    const f = () => { c.autoBoom = false; c.boomCfg.ext[+el.dataset.tele] = +el.value; c.L = boomLength(C, c.boomCfg); };
    if (el.tagName === "INPUT") { el.oninput = () => { f(); el.nextElementSibling.textContent = `${fx(+el.value / t.stroke * 100, 0)}% · ${fx(+el.value, 2)}`; markDirty(true); renderSite(); scheduleSide(); }; el.onchange = () => up(() => { }); }
    else el.onchange = () => up(f);
  });
  if ($("bcIn")) $("bcIn").onclick = () => up(() => { c.autoBoom = false; c.boomCfg.ext = c.boomCfg.ext.map(() => 0); c.L = boomLength(C, c.boomCfg); });
  if ($("bcOut")) $("bcOut").onclick = () => up(() => { c.autoBoom = false; c.boomCfg.ext = c.boomCfg.ext.map(() => t.stroke); c.L = boomLength(C, c.boomCfg); });
  if ($("bcLen")) $("bcLen").onchange = e => up(() => { c.autoBoom = false; c.boomCfg = boomCfgFor(C, Math.max(C.boom.Lmin, Math.min(C.boom.Lmax, +e.target.value))); c.L = boomLength(C, c.boomCfg); });
  document.querySelectorAll("[data-insadd]").forEach(b => b.onclick = () => up(() => {
    const add = +b.dataset.insadd; c.autoBoom = false; if (c.L + add > C.boom.Lmax + 1e-6) { toast(`Max boom is ${C.boom.Lmax} m`); return; }
    c.boomCfg.inserts.push(add); c.L = boomLength(C, c.boomCfg);
  }));
  document.querySelectorAll("[data-insdel]").forEach(b => b.onclick = () => up(() => { c.autoBoom = false; c.boomCfg.inserts.splice(+b.dataset.insdel, 1); c.L = boomLength(C, c.boomCfg); }));
  if ($("bcClear")) $("bcClear").onclick = () => up(() => { c.autoBoom = false; c.boomCfg.inserts = []; c.L = boomLength(C, c.boomCfg); });
}

// ---------- load builder ----------
const LB = { ld: null, editId: null };
function loadIcon(kind, orient) {
  const d = normLoad({ ...clone(LOAD_DEFAULTS[kind]), orient: orient || LOAD_DEFAULTS[kind].orient });
  const p = loadProfile(d, "side");
  return toSVG(p.s, { pad: 0.3, noSize: true, lw: 0.09 });
}
let loadTemplates = [];
function openLoadBuilder(editLoad) {
  LB.editId = editLoad ? editLoad.id : null;
  LB.ld = editLoad ? normLoad(clone(editLoad)) : normLoad(clone(LOAD_DEFAULTS.reel));
  if (!editLoad) LB.ld.name = "Load " + (plan.loads.length + 1);
  LB.showLib = !editLoad;
  $("lbTitle").textContent = editLoad ? "Edit load" : "Build a load";
  $("lbOk").textContent = editLoad ? "Save changes" : "Add to plan";
  renderLB(); $("dLoad").showModal(); $("dLoad").querySelector(".db").scrollTop = 0;
}
function renderLB() {
  const ld = LB.ld;
  $("lbTpls").innerHTML = loadTemplates.length ? `<div class="btnrow" style="align-items:center"><span class="small">Templates:</span>${loadTemplates.map(t => `<span class="ins" style="cursor:pointer" data-tpl="${t.id}">${escH(t.name)}${t.weight ? " · " + fx(t.weight) + " t" : ""}<button data-tpldel="${t.id}" title="Delete template">×</button></span>`).join("")}</div>` : "";
  $("lbTypes").innerHTML = Object.entries(LOAD_TYPES).map(([k, T]) => `<button class="ltype" data-lt="${k}" aria-pressed="${ld.kind === k}">${loadIcon(k)}${T.name}</button>`).join("");
  const f = (lab, k, step = "0.01", extra = "") => `<label>${lab}<input type="number" data-lk="${k}" value="${ld[k] ?? ""}" step="${step}" ${extra}></label>`;
  const T = LOAD_TYPES[ld.kind];
  const size = {
    reel: ld.orient === "flat" ? [f("Diameter across the flange (m)", "D"), f("Height lying flat (m)", "FW"), f("Overall incl. spindle (m)", "W")] : [f("Height = flange diameter (m)", "D"), f("Width over flanges (m)", "FW"), f("Overall width incl. spindle (m)", "W")],
    silo: [f("Diameter (m)", "D"), f(ld.orient === "horizontal" ? "Length (m)" : "Height (m)", "H"), f("Cone height (m)", "cone")],
    cyl: [f("Diameter (m)", "D"), f("Length (m)", "L")],
    tank: [f("Diameter (m)", "D"), f("Length (m)", "L"), f("Saddle height (m)", "saddle")],
    beam: [f("Length (m)", "L"), f("Depth (m)", "H"), f("Flange width (m)", "W")]
  }[ld.kind] || [f("Length (m)", "L"), f("Width (m)", "W"), f("Height (m)", "H")];
  const extra = ld.kind === "reel" ? f("Barrel / core diameter (m)", "core") + f("Trunnion / centre hub Ø (m) – slings go on this", "bore") : ld.kind === "silo" ? f("Leg height (m)", "legs") : ld.kind === "bag" ? f("Loop height above bag (m)", "loops") + f("Bags lifted together – along", "nx", "1", 'min="1"') + f("× across", "ny", "1", 'min="1"') + f("Gap between bags (m)", "gap", "0.05", 'min="0"') : "";
  const nLP = ld.nLP ?? (+ld.spanY > 0 ? 4 : +ld.span > 0 ? 2 : 1);
  const lpOpts = (LP_TYPES[ld.kind] || LP_TYPES._);
  const d0 = loadDims(ld);
  $("lbForm").innerHTML = `
    <div class="row"><label>Name<input type="text" data-lk="name" value="${escH(ld.name)}"></label>${f(ld.kind === "bag" ? "Weight to lift (t) * – all the bags together" : "Weight to lift (t) *", "weight", "0.01", 'placeholder="required"')}</div>
    ${ld.mgw ? `<p class="small">Tare ${fx(ld.tare, 1)} t · max gross ${fx(ld.mgw, 1)} t – the weight is set to max gross; change it to the actual gross weight.${+ld.weight > +ld.mgw ? ` <b style="color:var(--bad)">Over the max gross weight!</b>` : ""}</p>` : ""}
    ${ld.kind === "bag" ? `<div class="row"><label>Bag colour<span class="swatches">${["#ebe5cf", "#f2f2ee", "#d7d9db", "#e8c21a", "#1f5fa8"].map(c => `<button class="sw" data-col="${c}" aria-pressed="${ld.colour === c}" style="background:${c}"></button>`).join("")}</span></label><label>Loop colour<span class="swatches">${["#2c6fbb", "#e67e22", "#c0392b", "#2e8b57", "#6c3fb5", "#34393f"].map(c => `<button class="sw" data-lcol="${c}" aria-pressed="${ld.loopCol === c}" style="background:${c}"></button>`).join("")}</span></label></div><p class="small" style="margin:0">Check the bag's SWL label and safety factor (usually 5:1 or 6:1). Lift by all four loops unless the bag is rated for fewer.</p>` : ""}
    ${ld.kind === "container" ? `<label>Container size<select data-lk="size">${Object.keys(CONTAINER_SIZES).map(k => `<option ${ld.size === k ? "selected" : ""}>${k}</option>`).join("")}</select></label>` : ""}
    ${ld.kind === "ccu" ? `<div class="row"><label>Unit type<select data-lk="style">${Object.entries(CCU_STYLES).map(([k, n]) => `<option value="${k}" ${ld.style === k ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>Colour<span class="swatches">${["#c8331f", "#e8c21a", "#1f5fa8", "#2f6b3a", "#4a5159", "#e4e7ea"].map(c => `<button class="sw" data-col="${c}" aria-pressed="${ld.colour === c}" style="background:${c}"></button>`).join("")}</span></label></div>` : ""}
    <div class="spec"><b>Size</b><div class="row3">${size.join("")}</div>${extra ? `<div class="row3">${extra}</div>` : ""}
      ${Object.keys(T.orients).length > 1 ? `<label>Orientation<select data-lk="orient">${Object.entries(T.orients).map(([k, n]) => `<option value="${k}" ${ld.orient === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>` : ""}
      <p class="small" id="lbMsg">Overall ${fx(d0.x, 2)} × ${fx(d0.y, 2)} × ${fx(d0.z, 2)} m (length × width × height)</p></div>
    <div class="spec"><b>Lifting points</b>
      <div class="seg lpn">${[1, 2, 4].map(n => `<button data-nlp="${n}" aria-pressed="${nLP === n}">${n} point${n > 1 ? "s" : ""}</button>`).join("")}</div>
      <div class="row3">${nLP > 1 ? f("Spacing along (m)", "span") : "<span></span>"}${nLP === 4 ? f("Spacing across (m)", "spanY") : "<span></span>"}${f("CoG offset from centre (m, 0 = middle)", "cog")}</div>
      <div class="row"><label>Where they are<select data-lk="lpType">${lpOpts.map(([k, n]) => `<option value="${k}" ${(ld.lpType || "") === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>Height above bottom (m)<input type="number" data-lk="lpZ" step="0.05" value="${fx(liftPointZ(ld), 2)}"></label></div></div>
    <p class="small">Next: choose the rigging (master links, shackles, slings, spreader) – it opens as soon as you add the load.</p>`;
  const d = loadDims(ld);
  $("lbPrev").innerHTML = toSVG(loadViewsScene(ld), { pad: 1.2, noSize: true, lw: 0.05 }) + (ld.photoUrl ? `<img class="lbphoto" src="${escH(ld.photoUrl)}" alt="Load photo">` : "");
  // load library
  const cats = [...LOAD_CATS, ...(loadTemplates.length ? ["Your loads"] : [])];
  LB.cat = LB.cat && cats.includes(LB.cat) ? LB.cat : cats[0];
  const items = LB.cat === "Your loads" ? loadTemplates.map(t => ({ ...t, _tpl: true })) : LOAD_LIBRARY.filter(x => x.cat === LB.cat);
  $("lbLib").hidden = !LB.showLib;
  $("lbLibBtn").textContent = LB.showLib ? "Hide load library" : "Load library…";
  if (LB.showLib) $("lbLib").innerHTML = `<div class="btnrow">${cats.map(c => `<button class="chip" data-cat="${escH(c)}" aria-pressed="${LB.cat === c}">${escH(c)}</button>`).join("")}</div>
    <div class="libgrid">${items.map((x, i) => { const L = x._tpl ? normLoad(clone(x)) : libToLoad(x), dd = loadDims(L); return `<button class="libcard" data-li="${i}">${toSVG(loadProfile(L, "side").s, { pad: 0.2, noSize: true, lw: 0.08 })}<b>${escH(x.name)}</b><span>${fx(dd.x, 2)} × ${fx(dd.y, 2)} × ${fx(dd.z, 2)} m</span><span>${x.mgw ? `tare ${fx(x.tare, 1)} t · max ${fx(x.mgw, 1)} t` : x.weight ? fx(x.weight, 1) + " t" : ""}</span></button>`; }).join("")}</div>`;
  $("lbLib").querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { LB.cat = b.dataset.cat; renderLB(); });
  $("lbLib").querySelectorAll("[data-li]").forEach(b => b.onclick = () => {
    const x = items[+b.dataset.li];
    const L = x._tpl ? (() => { const { id, updated, _tpl, ...rest } = clone(x); return normLoad(rest); })() : libToLoad(x);
    L.id = LB.ld.id; L.pick = LB.ld.pick; L.set = LB.ld.set; L.nLP = +L.spanY > 0 ? 4 : +L.span > 0 ? 2 : 1;
    LB.ld = L; LB.showLib = false; renderLB();
  });
  $("lbForm").querySelectorAll("[data-nlp]").forEach(b => b.onclick = () => {
    const n = +b.dataset.nlp, L = LB.ld, dd = loadDims(L); L.nLP = n;
    if (n === 1) { L.span = 0; L.spanY = 0; }
    if (n >= 2 && !(+L.span > 0)) L.span = Math.round(dd.x * 0.8 * 100) / 100;
    if (n === 2) L.spanY = 0;
    if (n === 4 && !(+L.spanY > 0)) L.spanY = Math.round(dd.y * 0.8 * 100) / 100;
    renderLB();
  });
  $("lbForm").querySelectorAll("[data-col]").forEach(b => b.onclick = () => { LB.ld.colour = b.dataset.col; renderLB(); });
  $("lbForm").querySelectorAll("[data-lcol]").forEach(b => b.onclick = () => { LB.ld.loopCol = b.dataset.lcol; renderLB(); });
  $("lbTypes").querySelectorAll("[data-lt]").forEach(b => b.onclick = () => {
    const keep = { name: LB.ld.name, weight: LB.ld.weight, rigWeight: LB.ld.rigWeight };
    LB.ld = normLoad({ ...clone(LOAD_DEFAULTS[b.dataset.lt]), ...keep, id: LB.ld.id, pick: LB.ld.pick, set: LB.ld.set });
    if (!LB.editId && /^Load \d+$|^(Reel|Silo|Pipe|Box)$/.test(keep.name || "")) LB.ld.name = LOAD_DEFAULTS[b.dataset.lt].name;
    renderLB();
  });
  $("lbForm").querySelectorAll("[data-lk]").forEach(el => {
    const k = el.dataset.lk;
    const apply = () => { LB.ld[k] = el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? "" : +el.value) : el.value; };
    if (el.type === "number" || el.type === "text") el.oninput = () => { apply(); const d2 = loadDims(LB.ld); $("lbPrev").innerHTML = toSVG(loadViewsScene(LB.ld), { pad: 1.2, noSize: true, lw: 0.05 }); $("lbMsg").textContent = `Overall ${fx(d2.x, 2)} × ${fx(d2.y, 2)} × ${fx(d2.z, 2)} m (length × width × height)`; };
    el.onchange = () => { apply(); if (k === "span") LB.ld.spanSet = true; if (["W", "FW"].includes(k)) normLoad(LB.ld); if (k === "lpZ") LB.ld.lpType = "custom"; if (k === "size" && CONTAINER_SIZES[LB.ld.size]) { [LB.ld.L, LB.ld.W, LB.ld.H] = CONTAINER_SIZES[LB.ld.size]; LB.ld.span = +(LB.ld.L - 0.205).toFixed(3); LB.ld.spanY = +(LB.ld.W - 0.179).toFixed(3); LB.ld.name = LB.ld.size + " container"; } if (["orient", "spreader", "size", "style", "lpType", "lpZ"].includes(k)) renderLB(); };
  });
  $("lbTpls").querySelectorAll("[data-tpl]").forEach(el => el.onclick = e => {
    if (e.target.dataset.tpldel) return;
    const t = loadTemplates.find(x => x.id === el.dataset.tpl); if (!t) return;
    const { id, updated, ...rest } = clone(t); LB.ld = normLoad({ ...rest, id: LB.ld.id, pick: LB.ld.pick, set: LB.ld.set }); renderLB();
  });
  $("lbTpls").querySelectorAll("[data-tpldel]").forEach(b => b.onclick = async e => {
    e.stopPropagation(); if (!CAP.db) return;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "delete?"; return; }
    try { await CAP.db.doc("loadTemplates/" + b.dataset.tpldel).delete(); } catch (err) { toast("Couldn't delete"); }
  });
}
$("lbOk").onclick = () => {
  const ld = LB.ld;
  if (!(+ld.weight > 0)) { $("lbMsg").innerHTML = `<span style="color:var(--bad)">Enter the load weight.</span>`; $("lbForm").querySelector('[data-lk="weight"]').focus(); return; }
  if (LB.editId) {
    const i = plan.loads.findIndex(l => l.id === LB.editId);
    if (i >= 0) { plan.loads[i] = { ...ld, id: LB.editId, pick: plan.loads[i].pick, set: plan.loads[i].set, rig: plan.loads[i].rig }; ensureRig(plan.loads[i]); normLoad(plan.loads[i]); }
    sel = { kind: "load", id: LB.editId };
  } else {
    const at = { x: Math.round(view.cx * 10) / 10, y: Math.round(view.cy * 10) / 10, rot: 0, h: 0 };
    const nl = { ...ld, id: uid(), pick: { ...at }, set: { ...at } };
    ensureRig(nl); normLoad(nl);
    plan.loads.push(nl); sel = { kind: "load", id: nl.id };
    plan.cranes.forEach(c => { if (!c.attach?.load) c.attach = { load: nl.id, point: "C" }; });
  }
  $("dLoad").close(); markDirty(); renderAll();
  if (!LB.editId && plan.loads.length === 1) setTimeout(fitView, 30);
  if (!LB.editId) { const nl = plan.loads[plan.loads.length - 1]; setTimeout(() => openRigBuilder(nl), 60); }
};
$("lbSaveTpl").onclick = async () => {
  if (!CAP.db) { toast("Templates aren't available in this view"); return; }
  const { id, pick, set, ...rest } = clone(LB.ld);
  try { await CAP.db.doc("loadTemplates/" + uid()).set({ ...rest, updated: Date.now() }); toast("Saved as a load template"); } catch (e) { toast("Couldn't save the template"); }
};

// ---------- automatic boom: re-selects the boom as the radius changes (until the user sets it by hand) ----------
function autoBoom(cr) {
  if (cr.autoBoom === false) return;
  const C = REG.cranes[cr.model]; if (!C) return;
  const chart = REG.charts[cr.chartId] && REG.charts[cr.chartId].craneId === cr.model ? REG.charts[cr.chartId] : null;
  const a = evalCrane(cr, "pick"), b = evalCrane(cr, "set");
  const Rmax = Math.max(a.R || 0, b.R || 0, +cr.rMax || 0), Rmin = Math.min(a.R || Rmax, b.R || Rmax);
  const tw = Math.max(a.hookLoad || 0, b.hookLoad || 0);
  const key = [cr.model, cr.chartId, Rmax.toFixed(1), Rmin.toFixed(1), tw.toFixed(1), plan.site.ulim].join("|");
  if (cr._autoKey === key) return;
  // keep the current boom while it still reaches both radii within the chart and the utilisation limit
  const okNow = a.ba?.ok && b.ba?.ok && (!chart || (craneCapacity(C, cr, chart, Rmax).cap || 0) * ((+plan.site.ulim || 75) / 100) >= tw) && !(a.capNote || b.capNote) && (!chart || (a.cap != null && b.cap != null));
  cr._autoKey = key;
  if (okNow) return;
  cr.boomCfg = bestBoomFor(C, chart, Rmax, tw, Rmin); cr.L = boomLength(C, cr.boomCfg);
}
function autoBoomAll() { for (const c of plan.cranes) autoBoom(c); }

$("lbPhoto").onclick = () => $("lbFile").click();
$("lbFile").onchange = e => { const f = [...e.target.files]; e.target.value = ""; if (!f.length) return; if (CAP.sample && CAP.sampleImages) loadFromPhoto(f); else attachPhotoOnly(f); };

$("lbLibBtn").onclick = () => { LB.showLib = !LB.showLib; renderLB(); };
