// ================= Rigging builder, rigging library, photo reading and the rigging arrangement sheet =================
const RB = { ldId: null, work: null };
const fmtT = v => v == null || isNaN(v) ? "–" : (+v).toFixed(v >= 10 ? 1 : 2);
function autoArr(ld) { if (["box", "container", "frame"].includes(ld.kind) && +ld.spanY > 0) return "bridle4"; return +ld.span > 0 ? "bridle2" : "single"; }
function suggestPreset(ld) {
  const cr = plan.cranes.find(c => c.attach?.load === ld.id), C = cr ? REG.cranes[cr.model] : null, rh = cr && C ? blockDims(cr, C).type === "ramshorn" : false;
  if (plan.cranes.filter(c => c.attach?.load === ld.id).length > 1) return "tandem";
  const n = ld.nLP ?? (+ld.spanY > 0 ? 4 : +ld.span > 0 ? 2 : 1);
  if (n === 4) return rh ? "rh_ccu" : "hb_ccu";
  if (n === 1) return "hb_single";
  if (["cyl", "beam", "box"].includes(ld.kind)) return rh ? "rh_tub" : "hb_tub";
  if (ld.kind === "reel") return "sb";
  return "rs2";
}
function applyPreset(ld, id) {
  const pr = RIG_PRESETS.find(p => p.id === id) || RIG_PRESETS[0];
  if ((pr.arr === "bridle4" || pr.tmode === "bridle") && !(+ld.spanY > 0)) { const d = loadDims(ld); ld.span = +ld.span > 0 ? ld.span : Math.round(d.x * 0.9 * 100) / 100; ld.spanY = Math.round(d.y * 0.9 * 100) / 100; if (!ld.lpType) ld.lpType = "corners"; }
  if (pr.arr !== "single" && !(+ld.span > 0)) ld.span = Math.round(loadDims(ld).x * 0.7 * 100) / 100;
  ld.rig = buildPreset(ld, pr); if (!pr.build) sizeRig(ld);
  const r = solveRig(ld); if (r?.fix) { r.fix.entry.len = r.fix.len; }
  return ld.rig;
}
function ensureRig(ld) { if (!ld.rig || !ld.rig.arr) { applyPreset(ld, suggestPreset(ld)); ld.rig.auto = true; } return ld.rig; }
let rigTemplates = [];

function itemOptions(sel, filter) {
  const lib = rigLibrary(), groups = {};
  for (const it of lib) { if (filter && !filter(it)) continue; (groups[RIG_TYPES[it.type]?.name || it.type] = groups[RIG_TYPES[it.type]?.name || it.type] || []).push(it); }
  return Object.entries(groups).map(([g, list]) => `<optgroup label="${escH(g)}">${list.sort((a, b) => a.swl - b.swl).map(it => `<option value="${escH(it.id)}" ${it.id === sel ? "selected" : ""}>${escH(it.name)}${it.builtin ? "" : " ★"}</option>`).join("")}</optgroup>`).join("");
}
// basket: the sling's soft eyes go on a shackle at the TOP (beam / hook) – move any shackle listed under the sling above it
function basketShackleUp(list, sl) {
  if (!list || !sl || sl.hitch !== "basket") return;
  const si = list.indexOf(sl); if (si < 0) return;
  const below = list.slice(si + 1).filter(e => e.snap.type === "shackle"); if (!below.length) return;
  for (const e of below) list.splice(list.indexOf(e), 1);
  list.splice(list.indexOf(sl), 0, ...below);
  toast(`Basket: shackle moved above the sling – it now sits at the top where both soft eyes go on it (drag it back if you want it elsewhere)`, 4200);
}
// hitch choices – basket is 2 × the vertical SWL; the reduced factors are there for jobs whose procedure asks for them
function hitchOptions(e) {
  const cur = (e.hitch || "straight") + (e.hitch === "basket" && +e.bf && +e.bf !== 2 ? ":" + (+e.bf) : "");
  return [["straight", "Straight"], ["choke", "Choke hitch"], ["dwchoke", "Double wrap choke"], ["basket", "Basket hitch"], ["dwbasket", "Double wrap basket"]]
    .map(([v, n]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${n}</option>`).join("");
}
function entryRow(list, i, key) {
  const e = list[i], sl = RIG_TYPES[e.snap.type]?.sling;
  const known = rigItem(e.id);
  const mod = known && (Math.abs((+known.swl || 0) - (+e.snap.swl || 0)) > 1e-9 || (!sl && Math.abs((+known.weight || 0) - (+e.snap.weight || 0)) > 1e-9));
  return `<div class="rrow" data-list="${key}" data-i="${i}">
    <div class="rsel" style="display:flex;gap:4px;align-items:center">${key !== "beam" ? `<span class="rgrip" draggable="true" title="Drag up or down to change the order (top of the list = nearest the hook)">⠿</span>` : ""}<select data-f="item" style="flex:1;min-width:0">${known ? "" : `<option value="${escH(e.id)}" selected>${escH(e.snap.name)} (saved)</option>`}${itemOptions(e.id)}</select>${key !== "beam" ? `<button class="rmv" data-mv="-1" title="Move up" ${i ? "" : "disabled"}>▲</button><button class="rmv" data-mv="1" title="Move down" ${i < list.length - 1 ? "" : "disabled"}>▼</button>` : ""}</div>
    ${sl ? `<label>Length m<input type="number" data-f="len" step="0.1" min="0.2" value="${e.len ?? 3}"></label><label>Hitch<select data-f="hitch">${hitchOptions(e)}</select></label>`
      : key === "beam" ? `<label>Span m<input type="number" data-f="len" step="0.1" value="${e.len ?? e.snap.len ?? 4}"></label><span></span>`
      : `<label>Qty${key === "top" ? "" : " (per leg)"}<select data-f="qty" ${key === "top" ? "" : "disabled"}>${[1, 2, 3, 4].map(n => `<option ${n === (e.qty || 1) ? "selected" : ""}>${n}</option>`).join("")}</select></label><span></span>`}
    <label title="Change to match your certificate">SWL t${mod ? " ✎" : ""}<input type="number" data-f="swl" step="0.01" value="${+e.snap.swl}"></label>
    ${sl ? `<label>kg/m<input type="number" data-f="wpm" step="0.1" value="${+((e.snap.wpm || 0) * 1000).toFixed(2)}"></label>` : `<label>Wt kg<input type="number" data-f="wkg" step="0.1" value="${+((e.snap.weight || 0) * 1000).toFixed(1)}"></label>`}
    ${key === "beam" ? "<span></span>" : `<button data-f="del" title="Remove">×</button>`}</div>`;
}
const LP_TYPES = {
  reel: [["axis", "Trunnion / centre hub – slings on the trunnion (straight or basket)"], ["top", "Lugs on top of the flanges"], ["custom", "Custom height"]],
  cyl: [["top", "Lugs on top"], ["axis", "Trunnions at the axis"], ["wrap", "Basket / choke round the pipe"], ["custom", "Custom height"]],
  tank: [["top", "Lifting lugs on top"], ["axis", "Trunnions at the axis"], ["wrap", "Basket slings round the shell"], ["custom", "Custom height"]],
  silo: [["top", "Lifting lugs on top"], ["axis", "Trunnions at mid height"], ["custom", "Custom height"]],
  bag: [["corners", "Four corner loops"], ["top", "Single top loop / sleeve"], ["custom", "Custom height"]],
  container: [["corners", "Top corner castings"], ["bottom", "Bottom corner castings"], ["custom", "Custom height"]],
  _: [["top", "Lifting lugs / points on top"], ["corners", "Top corners"], ["bottom", "Bottom / underside points"], ["wrap", "Basket / choke round the load"], ["custom", "Custom height"]]
};
function openRigBuilder(ld) {
  RB.edit = null; RB.ldId = ld.id; RB.work = clone(ld); normLoad(RB.work); ensureRig(RB.work);
  $("rbTitle").textContent = "Rigging – " + ld.name; renderRB(); $("dRig").showModal(); $("dRig").querySelector(".db").scrollTop = 0;
}
function rigArrIcon(arr) {
  const s = new Scene(), L = (a, b, c = "#3b4148") => s.poly("RIGGING", [a, b], { w: 2, color: c });
  s.rect("LOAD", -1.6, 0, 1.6, 1, { fill: "#dfe4e9", w: 1 });
  if (arr === "single") L([0, 3], [0, 1]);
  else if (arr === "bridle2") { L([0, 3], [-1.2, 1]); L([0, 3], [1.2, 1]); }
  else if (arr === "bridle4") { L([0, 3], [-1.2, 1]); L([0, 3], [1.2, 1]); L([0, 3], [-0.6, 1], "#8a9199"); L([0, 3], [0.6, 1], "#8a9199"); }
  else if (arr === "spreader") { L([0, 3.4], [-1.2, 2.2]); L([0, 3.4], [1.2, 2.2]); s.rect("RIGGING", -1.35, 2, 1.35, 2.2, { fill: "#f2c200", w: 1 }); L([-1.2, 2], [-1.2, 1]); L([1.2, 2], [1.2, 1]); }
  else { L([-1.2, 3], [-1.2, 1]); L([1.2, 3], [1.2, 1]); }
  return toSVG(s, { pad: 0.2, noSize: true, lw: 0.05 });
}
function renderRB() {
  const ld = RB.work, R = ld.rig, res = solveRig(ld);
  const blk = (title, key, list, hint) => `<div class="rblk"><div class="rh"><b>${title}</b>${hint ? `<span class="small">${hint}</span>` : ""}</div>${list.map((_, i) => entryRow(list, i, key)).join("")}<button data-add="${key}">+ Add component</button></div>`;
  const hasBeam = R.arr === "spreader" || (R.arr === "tandem" && R.tmode === "spreader");
  const is4 = R.arr === "bridle4" || (hasBeam && R.lower4) || (R.arr === "tandem" && R.tmode === "bridle");
  const cranesOn = plan.cranes.filter(c => c.attach?.load === RB.ldId), nCr = cranesOn.length;
  const allCards = [...RIG_PRESETS.map(p => ({ id: p.id, name: p.name, desc: p.desc, mine: false, tandem: p.arr === "tandem" })), ...rigTemplates.map(t => ({ id: "tpl:" + t.id, name: t.name, desc: "Your saved set-up", mine: true, tandem: t.rig?.arr === "tandem" }))];
  const presetCards = allCards.filter(p => nCr >= 2 ? p.tandem : !p.tandem), otherCards = allCards.filter(p => !presetCards.includes(p));
  $("rbLeft").innerHTML = `
    ${nCr >= 2 && R.arr !== "tandem" && !(R.arr === "build" && +R.cranes === 2) ? `<div class="status bad">${nCr} cranes are hooked on, but this rigging joins at one hook. <button id="rbToTandem">Switch to tandem rigging</button></div>` : ""}
    ${nCr < 2 && (R.arr === "tandem" || (R.arr === "build" && +R.cranes === 2)) ? `<div class="status busy">Tandem rigging, but only ${nCr || "no"} crane${nCr === 1 ? " is" : "s are"} hooked on to this load.</div>` : ""}
    ${R.auto ? `<div class="status busy">No rigging chosen yet – this is a suggested set-up. Pick a standard set-up below or build your own, then Save.</div>` : ""}
    <div class="rblk"><div class="rh"><b>Start from a set-up</b><button id="rbSaveTpl">Save as my set-up</button></div>
      ${nCr >= 2 ? `<p class="small" style="margin:0">${nCr} cranes are hooked on – tandem set-ups (each crane's slings go to its own end of the load or spreader).</p>` : ""}
      <div class="presets">${presetCards.map(p => `<button class="preset" data-preset="${escH(p.id)}" aria-pressed="${R.preset === p.id}" title="${escH(p.desc)}"><b>${escH(p.name)}</b><span>${escH(p.desc)}</span>${p.mine ? `<i data-tdel="${escH(p.id.slice(4))}" title="Delete">×</i>` : ""}</button>`).join("")}</div>
      ${otherCards.length ? `<details><summary class="small">${nCr >= 2 ? "Single-hook set-ups (for one crane)" : "Tandem set-ups (for two cranes)"}</summary><div class="presets" style="margin-top:6px">${otherCards.map(p => `<button class="preset" data-preset="${escH(p.id)}" aria-pressed="${R.preset === p.id}"><b>${escH(p.name)}</b><span>${escH(p.desc)}</span></button>`).join("")}</div></details>` : ""}</div>
    <div class="rarr">${Object.entries(RIG_ARR).map(([k, a]) => `<button class="ltype" data-arr="${k}" aria-pressed="${R.arr === k}">${rigArrIcon(k)}${a.name}</button>`).join("")}</div>
    <div class="rblk"><div class="rh"><b>Where it connects on the load</b><span class="small">or click on the front view to place the lifting points</span></div>
      <div class="row"><label>Lifting points<select id="rbLpType">${(LP_TYPES[ld.kind] || LP_TYPES._).map(([k, n]) => `<option value="${k}" ${(ld.lpType || (ld.kind === "reel" && ld.orient !== "flat" ? "axis" : ld.kind === "container" ? "corners" : "top")) === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>Height above load bottom (m)<input type="number" data-lp="lpZ" step="0.05" value="${fx(liftPointZ(ld), 2)}"></label></div>
      <div class="row3"><label>Spacing A–B (m)<input type="number" data-lp="span" step="0.05" value="${ld.span ?? 0}"></label>
      <label>Across spacing (m)${is4 ? "" : " – 4 points"}<input type="number" data-lp="spanY" step="0.05" value="${ld.spanY ?? 0}"></label>
      <label>CoG offset → B (m)<input type="number" data-lp="cog" step="0.05" value="${ld.cog ?? 0}"></label></div></div>
    ${blk(R.arr === "tandem" ? "On each crane's hook" : "On the crane hook", "top", R.top, R.arr === "tandem" ? "the same parts go on both cranes – tap a crane's block in the drawing to change its hook" : "e.g. 2 master links straight onto the hook")}
    ${R.arr === "tandem" ? `<div class="rblk"><div class="rh"><b>Tandem – how each crane connects</b></div><div class="seg">${[["direct", "Straight down to its end of the load"], ["bridle", "2-leg bridle at its end"], ["spreader", "To its end of a spreader beam"]].map(([k, n]) => `<button data-tmode="${k}" aria-pressed="${(R.tmode || "direct") === k}">${n}</button>`).join("")}</div></div>` : ""}
    ${blk(R.arr === "spreader" ? "Top legs – hook to spreader (each leg, top → bottom)" : R.arr === "tandem" ? (R.tmode === "bridle" ? "Each crane's 2 legs (each leg, top → bottom)" : R.tmode === "spreader" ? "Each crane's leg to its end of the spreader (top → bottom)" : "Each crane's leg (top → bottom)") : "Legs – each leg, top → bottom", "leg", R.leg)}
    ${hasBeam ? `<div class="rblk"><div class="rh"><b>Spreader beam${R.arr === "tandem" ? " – between the two cranes" : ""}</b></div><div class="rrow" data-list="beam" data-i="0"><select data-f="item">${itemOptions(R.beam?.id, it => it.type === "spreader")}</select>${padSelects(R.beam) || `<label>Span m<input type="number" data-f="len" step="0.1" value="${R.beam?.len ?? 4}"></label><span></span>`}<span></span></div>${padTable(R.beam)}</div>
      ${blk("Lower legs – spreader to load (each leg)", "lower", R.lower || [])}
      ${ld.kind === "reel" && ld.orient !== "flat" ? "" : `<label class="chk"><input type="checkbox" id="rbLow4" ${R.lower4 ? "checked" : ""}> 4 lower legs (to 4 lifting points)</label>`}` : ""}
    <div class="btnrow"><button id="rbSize">Size components for this load (≤ 90% SWL)</button></div>
    ${is4 ? `<label>4 legs – load assumed shared by<select id="rbShare">${[2, 3, 4].map(n => `<option value="${n}" ${+(R.share4 || 3) === n ? "selected" : ""}>${n} legs${n === 3 ? " (usual)" : n === 2 ? " (most conservative)" : ""}</option>`).join("")}</select></label>` : ""}`;
  // preview + schedule
  RB.craneHits = [];
  const sc = rigPreviewScene(ld, res);
  const pb = sc.bounds();
  $("rbPrev").innerHTML = toSVG(sc, { bounds: pb, pad: 0.6, noSize: true, lw: 0.05 });
  const svgEl = $("rbPrev").querySelector("svg");
  if (svgEl && res) addRigHits(svgEl, ld, res);
  renderRigPop(svgEl, ld, res);
  if (svgEl) { svgEl.style.cursor = "crosshair"; svgEl.onclick = ev => {
    if (ev.target.closest("[data-part]") || ev.target.closest("[data-drag]") || RB.suppressClick) return;
    if (RB.edit) { RB.edit = null; renderRB(); return; }
    const pt = svgEl.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const q = pt.matrixTransform(svgEl.getScreenCTM().inverse());
    const x = q.x, z = -q.y, d = loadDims(RB.work);
    if (Math.abs(x) > d.x / 2 + 1.5 || z < -0.5 || z > d.z + 1) return;       // only clicks on/near the front view of the load
    RB.work.lpType = "custom"; RB.work.lpZ = Math.round(Math.max(0, Math.min(d.z, z)) * 100) / 100;
    if (Math.abs(x) > 0.15) { RB.work.span = Math.round(Math.abs(x) * 2 * 100) / 100; RB.work.spanSet = true; }
    renderRB(); toast(`Lifting points set: ${fx(RB.work.span, 2)} m apart at ${fx(RB.work.lpZ, 2)} m above the bottom`);
  }; }
  $("rbTable").innerHTML = res ? rigTableHTML(ld, res) : "";
  wireRB();
  if ($("rbFixLen")) $("rbFixLen").onclick = () => { const r = solveRig(RB.work); if (r?.fix) { r.fix.entry.len = r.fix.len; delete RB.work.rig.auto; renderRB(); } };
  $("rbTable").querySelectorAll(".rtr").forEach(tr => tr.onclick = ev => { const pt = rigParts(RB.work, solveRig(RB.work)).find(p => p.row === +tr.dataset.rowno); if (pt) { const r = $("rbPrev").getBoundingClientRect(); RB.edit = { key: pt.key, i: pt.i, x: r.left + r.width * 0.55, y: r.top + 60 }; renderRB(); } });
}
function rigPreviewScene(ld, res) {
  const s = new Scene(); if (!res) return s;
  const d = loadDims(ld), gap = Math.max(d.x, d.y) * 0.6 + 3, ts = Math.max(0.18, Math.max(d.x, d.z, res.hookZ) * 0.035);
  for (const [view, ox] of [["side", 0], ["end", d.x / 2 + gap + d.y / 2]]) {
    s.add(loadProfile(ld, view).s, 0, ox, 0);
    const co = rig2D(s, ld, res, view, ox, 0, { callouts: view === "side", ts: ts * 0.9 });
    if (view === "side") RB.hits = { co, ox, endOx: d.x / 2 + gap + d.y / 2 };
    const cranesOn = plan.cranes.filter(c => c.attach?.load === ld.id);
    const two = res.hookPts.length > 1, crOf = hi => two ? (cranesOn.find(c => c.attach.point === (hi ? "B" : "A")) || cranesOn.filter(c => !["A", "B"].includes(c.attach.point))[hi] || null) : cranesOn[0];
    const tag = hi => two ? (hi ? "CRANE B" : "CRANE A") : "";
    res.hookPts.forEach((hp, hi) => {
      // end view: in a tandem along the load the two hooks are one behind the other – one hook drawn, both cranes named
      if (view === "end" && hi && Math.abs(hp[1] - res.hookPts[0][1]) < 0.3) return;
      const u = ox + (view === "end" ? hp[1] : hp[0]), cr = crOf(hi), C = cr ? REG.cranes[cr.model] : null;
      const name = (c, k) => c ? `${tag(k) ? tag(k) + " · " : ""}${upUnits(c.label)}${REG.cranes[c.model] ? " · " + REG.cranes[c.model].short : ""}` : two ? `${tag(k)} · not hooked on yet` : "CRANE HOOK";
      const both = view === "end" && two && Math.abs(res.hookPts[1][1] - hp[1]) < 0.3;
      const lab = both ? name(crOf(0), 0) : name(cr, hi);
      // two hooks side by side: crane A's name reads to the left of its hook, crane B's to the right – never on top of each other
      const anch = two && !both ? (hi ? "start" : "end") : "middle", du = anch === "end" ? 0.15 : anch === "start" ? -0.15 : 0;
      const put = (z, col) => { s.text("TEXT", [u + du, z + (both ? ts * 1.4 : 0)], lab, ts, { bold: true, color: col, anchor: anch }); if (both) s.text("TEXT", [u, z], "+ " + name(crOf(1), 1), ts, { bold: true, color: crOf(1)?.color || "#9a6200" }); };
      if (cr && C) {
        const bd = blockDims(cr, C), sc = sheaveCentres(bd)[0];
        block2D(s, bd, u, hp[2]); falls2D(s, bd, u, hp[2] + bd.total + 1.6, hp[2] + sc[1]);
        put(hp[2] + bd.total + 1.6 + ts * 1.2, cr.color);
        (RB.craneHits = RB.craneHits || []).push({ id: cr.id, x0: u - Math.max(bd.W, 0.8) / 2 - 0.2, x1: u + Math.max(bd.W, 0.8) / 2 + 0.2, z0: hp[2] - 0.1, z1: hp[2] + bd.total + 1.6 });
      } else {
        // no crane hooked on (yet): a plain hook block, same size as a real one, so both ends of a tandem read the same
        const h = 0.9, w = 0.5, z = hp[2];
        s.poly("RIGGING", [[u, z + h + 1.2], [u, z + h]], { w: 1, color: "#3a3e42" });
        s.rect("RIGGING", u - w / 2, z + 0.35, u + w / 2, z + h, { fill: "#f2c200", w: 1, color: "#3a3e42" });
        for (let k = 0; k < 3; k++) s.poly("RIGGING", [[u - w / 2, z + 0.45 + k * 0.17], [u + w / 2, z + 0.6 + k * 0.17]], { w: 2, color: "#22262a" });
        s.poly("RIGGING", [[u, z + 0.35], [u, z + 0.18], [u - 0.08, z + 0.05], [u + 0.06, z - 0.02], [u + 0.14, z + 0.08]], { w: 2.2, color: "#3a3e42" });
        put(z + h + 1.2 + ts * 1.2, two ? "#9a6200" : "#16202a");
      }
    });
    s.poly("GROUND", [[ox - (view === "end" ? d.y : d.x) / 2 - 0.5, 0], [ox + (view === "end" ? d.y : d.x) / 2 + 0.5, 0]], { w: 0.8 });
    s.text("TEXT", [ox, -ts * 2.2], view === "side" ? "FRONT VIEW" : "END VIEW", ts * 1.2, { bold: true });
  }
  return s;
}
function rigTableHTML(ld, res) {
  const tot = (+ld.weight || 0) + res.weight;
  return `<table class="rtab"><tr><th>No</th><th class="n">Qty</th><th>Component</th><th class="n">SWL t</th><th class="n">Load t</th><th class="n">Use</th><th class="n">Wt kg</th></tr>
    ${res.rows.map(r => `<tr class="rtr" data-rowno="${r.no}"><td>${r.no}</td><td class="n">${r.qty}</td><td>${escH(r.name)}<div class="small">${escH(r.where || "")}</div></td><td class="n">${fmtT(r.swl)}</td><td class="n">${fmtT(r.load)}</td><td class="n"><span class="pill ${r.util == null ? "na" : r.util > 100 ? "bad" : r.util > 80 ? "amber" : "ok"}">${r.util == null ? "–" : r.util.toFixed(0) + "%"}</span></td><td class="n">${fx(r.weight * 1000, 0)}</td></tr>`).join("")}
    <tr><td></td><td></td><td><b>Rigging total</b></td><td></td><td></td><td></td><td class="n"><b>${fx(res.weight * 1000, 0)}</b></td></tr></table>
    <p class="small" style="margin-top:6px">Load ${fmtT(+ld.weight)} t + rigging ${fmtT(res.weight)} t = <b>${fmtT(tot)} t below the hook</b> · hook ${fx(res.hookZ - loadDims(ld).z, 2)} m above the top of the load</p>
    ${res.notes.map(n => `<p class="small">${escH(n)}</p>`).join("")}
    ${res.fix ? `<div class="status bad" style="margin:6px 0">The ${escH(res.fix.entry.snap.name)} is too short${res.fix.basket ? " once it is doubled in the basket" : ""} – the spreader would sit in the load.${RB.work.kind === "reel" && RB.work.lpType === "wrap" ? ` <b>The lifting points are set to go round the outside of the whole reel – if the slings go on the trunnion, change “Lifting points” to Trunnion / centre hub.</b>` : ""} <button id="rbFixLen" class="pri">Use a ${fx(res.fix.len, 1)} m sling</button> <span class="small">(${res.fix.basket ? `${fx(res.fix.len, 1)} m doubled = about ${fx(res.fix.eff, 1)} m each side` : `${fx(res.fix.eff, 1)} m leg`}, beam ≈ 1 m above the load)</span></div>` : ""}
    ${res.warn.map(w => `<p class="small" style="color:var(--bad)">${escH(w)}</p>`).join("")}`;
}
function wireRB() {
  const R = RB.work.rig, root = $("rbLeft");
  const listOf = k => k === "beam" || !k ? null : (R[k] = R[k] || []);
  root.querySelectorAll("[data-arr]").forEach(b => b.onclick = () => {
    const keepTop = R.top;
    if (b.dataset.arr === "bridle4" && !(+RB.work.spanY > 0)) RB.work.spanY = Math.round(loadDims(RB.work).y * 0.8 * 100) / 100;
    if ((b.dataset.arr === "bridle2" || b.dataset.arr === "spreader" || b.dataset.arr === "tandem") && !(+RB.work.span > 0)) RB.work.span = Math.round(loadDims(RB.work).x * 0.7 * 100) / 100;
    RB.work.rig = defaultRig(RB.work, b.dataset.arr); if (keepTop?.length) RB.work.rig.top = keepTop; sizeRig(RB.work);
    renderRB();
  });
  root.querySelectorAll("[data-preset]").forEach(b => b.onclick = async e => {
    const id = b.dataset.preset;
    if (e.target.dataset.tdel) { if (!CAP.db) return; if (e.target.dataset.armed !== "1") { e.target.dataset.armed = "1"; e.target.textContent = "delete?"; return; } try { await CAP.db.doc("rigTemplates/" + e.target.dataset.tdel).delete(); } catch (err) { } return; }
    if (id.startsWith("tpl:")) { const t = rigTemplates.find(x => x.id === id.slice(4)); if (t) { RB.work.rig = clone(t.rig); RB.work.rig.preset = id; delete RB.work.rig.auto; } }
    else { applyPreset(RB.work, id); }
    renderRB();
  });
  $("rbSaveTpl").onclick = async () => {
    if (!CAP.db) { toast("Saving set-ups isn't available in this view"); return; }
    const name = prompt("Name for this rigging set-up", RIG_ARR[R.arr].name + " – " + (R.top[0]?.snap.name || "")); if (!name) return;
    const rig = clone(R); delete rig.auto; delete rig._geom;
    try { await CAP.db.doc("rigTemplates/" + uid()).set({ name, rig, updated: Date.now() }); toast("Rigging set-up saved"); } catch (err) { toast("Couldn't save"); }
  };
  if ($("rbToTandem")) $("rbToTandem").onclick = () => { applyPreset(RB.work, "tandem"); renderRB(); };
  root.querySelectorAll("[data-tmode]").forEach(b => b.onclick = () => { applyPreset(RB.work, { direct: "tandem", bridle: "tandem_br", spreader: "tandem_sb" }[b.dataset.tmode]); renderRB(); });
  root.querySelectorAll("[data-lp]").forEach(el => el.onchange = () => { RB.work[el.dataset.lp] = +el.value; if (el.dataset.lp === "span") RB.work.spanSet = true; if (el.dataset.lp === "lpZ") RB.work.lpType = "custom"; renderRB(); });
  $("rbLpType").onchange = e => { RB.work.lpType = e.target.value; if (e.target.value === "corners" && RB.work.kind === "container") { RB.work.span = +(RB.work.L - 0.205).toFixed(3); RB.work.spanY = +(RB.work.W - 0.179).toFixed(3); } if (e.target.value === "custom") RB.work.lpZ = liftPointZ({ ...RB.work, lpType: undefined }); renderRB(); };
  root.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { const l = listOf(b.dataset.add); const def = b.dataset.add === "top" ? rigLibrary().find(i => i.type === "masterlink") : rigLibrary().find(i => i.type === "shackle"); l.push(rigEntry(def)); renderRB(); });
  // reorder: ▲▼ buttons, or drag the grip onto another row (also between the top / leg / lower lists)
  const moveEntry = (fk, fi, tk, ti) => {
    const F = listOf(fk), T = listOf(tk); if (!F || !T) return;
    const [e] = F.splice(fi, 1); if (F === T && ti > fi) ti--; T.splice(Math.max(0, Math.min(T.length, ti)), 0, e); delete R.auto; renderRB();
  };
  root.querySelectorAll(".rrow").forEach(row => {
    const key = row.dataset.list, i = +row.dataset.i; if (key === "beam") return;
    row.querySelectorAll("[data-mv]").forEach(bt => bt.onclick = ev => { ev.preventDefault(); const d = +bt.dataset.mv; moveEntry(key, i, key, d > 0 ? i + 2 : i - 1); });
    const grip = row.querySelector(".rgrip");
    if (grip) grip.ondragstart = ev => { RB.dragFrom = { key, i }; ev.dataTransfer.effectAllowed = "move"; try { ev.dataTransfer.setData("text/plain", key + ":" + i); ev.dataTransfer.setDragImage(row, 20, 20); } catch (e) { } row.classList.add("rdrag"); };
    if (grip) grip.ondragend = () => { RB.dragFrom = null; root.querySelectorAll(".rdrop,.rdropB,.rdrag").forEach(x => x.classList.remove("rdrop", "rdropB", "rdrag")); };
    row.ondragover = ev => { if (!RB.dragFrom) return; ev.preventDefault(); const r = row.getBoundingClientRect(), below = ev.clientY > r.top + r.height / 2; row.classList.toggle("rdropB", below); row.classList.toggle("rdrop", !below); };
    row.ondragleave = () => row.classList.remove("rdrop", "rdropB");
    row.ondrop = ev => { ev.preventDefault(); const f = RB.dragFrom; if (!f) return; const r = row.getBoundingClientRect(), below = ev.clientY > r.top + r.height / 2; RB.dragFrom = null; moveEntry(f.key, f.i, key, i + (below ? 1 : 0)); };
  });
  root.querySelectorAll(".rrow").forEach(row => {
    const key = row.dataset.list, i = +row.dataset.i;
    const get = () => key === "beam" ? R.beam : listOf(key)[i];
    row.querySelectorAll("[data-f]").forEach(el => {
      const f = el.dataset.f;
      if (f === "del") { el.onclick = () => { listOf(key).splice(i, 1); renderRB(); }; return; }
      el.onchange = () => {
        const e = get();
        if (f === "item") { const it = rigItem(el.value); if (!it) return; const ne = rigEntry(it, { qty: e?.qty || 1, hitch: e?.hitch }); if (RIG_TYPES[it.type]?.sling) ne.len = e && RIG_TYPES[e.snap.type]?.sling ? e.len : 3; if (key === "beam") { if (!it.pad) ne.len = it.len; R.beam = ne; } else listOf(key)[i] = ne; }
        else if (f === "len") e.len = +el.value; else if (f === "top") e.top = +el.value; else if (f === "qty") e.qty = +el.value; else if (f === "hitch") { const [h, bf] = el.value.split(":"); e.hitch = h; if (bf) e.bf = +bf; else delete e.bf; basketShackleUp(listOf(key), e); }
        else if (f === "swl") e.snap.swl = +el.value; else if (f === "wkg") e.snap.weight = (+el.value || 0) / 1000; else if (f === "wpm") e.snap.wpm = (+el.value || 0) / 1000;
        delete R.auto; renderRB();
      };
    });
  });
  if ($("rbLow4")) $("rbLow4").onchange = e => { R.lower4 = e.target.checked; if (R.lower4 && !(+RB.work.spanY > 0)) RB.work.spanY = Math.round(loadDims(RB.work).y * 0.8 * 100) / 100; renderRB(); };
  $("rbSize").onclick = () => { sizeRig(RB.work); renderRB(); };
  if ($("rbShare")) $("rbShare").onchange = e => { R.share4 = +e.target.value; renderRB(); };
}
$("rbSave").onclick = () => {
  const i = plan.loads.findIndex(l => l.id === RB.ldId); if (i < 0) { $("dRig").close(); return; }
  const w = RB.work, l = plan.loads[i];
  delete w.rig.auto; l.rig = w.rig; l.span = w.span; l.spanSet = w.spanSet; l.spanY = w.spanY; l.cog = w.cog; l.lpType = w.lpType; l.lpZ = w.lpZ; normLoad(l);
  $("dRig").close(); markDirty(); renderAll();
  toast("Rigging saved – rigging weight " + fmtT(l.rigWeight) + " t added to the lift");
};
$("rbLib").onclick = () => openRigLib();

// ---------- rigging library ----------
const RL = { filter: "", edit: null };
function openRigLib() { RL.edit = null; renderRL(); $("dRigLib").showModal(); }
function renderRL() {
  const lib = rigLibrary().filter(i => !RL.filter || i.type === RL.filter);
  $("rlChips").innerHTML = [["", "All"], ...Object.entries(RIG_TYPES).map(([k, t]) => [k, t.name])].map(([k, n]) => `<button class="chip" data-t="${k}" aria-pressed="${RL.filter === k}">${escH(n)}</button>`).join("");
  $("rlTable").innerHTML = `<table><tr><th>Item</th><th>Type</th><th class="n">SWL t</th><th class="n">Weight</th><th class="n">Length</th><th></th></tr>${lib.sort((a, b) => a.type.localeCompare(b.type) || a.swl - b.swl).map(it => `<tr><td>${escH(it.name)}${it.builtin ? ` <span class="tag">${it.pad || /^ssb_|^gp4163/.test(it.id) ? "library" : "generic"}</span>` : rigIsBuiltinId(it.id) ? ` <span class="tag warn">generic · edited</span>` : ` <span class="tag good">yours</span>`}${it.pad ? ` <span class="tag">${it.pad.top.length} padeye cases</span>` : ""}${it.drawing ? ` <a class="small" href="${escH(it.drawing)}" target="_blank" rel="noopener">drawing</a>` : ""}${it.cert ? `<div class="small">Cert ${escH(it.cert)}</div>` : ""}</td><td class="small">${escH(RIG_TYPES[it.type]?.name || it.type)}</td><td class="n">${fmtT(it.swl)}</td><td class="n">${RIG_TYPES[it.type]?.sling ? fx((it.wpm || 0) * 1000, 1) + " kg/m" : fx((it.weight || 0) * 1000, 1) + " kg"}</td><td class="n">${it.len ? fx(it.len, 2) + " m" : "–"}</td><td class="n"><button data-edit="${escH(it.id)}">Edit</button> <button data-copy="${escH(it.id)}">Copy</button>${it.builtin ? "" : rigIsBuiltinId(it.id) ? ` <button data-del="${escH(it.id)}" title="Remove your changes and go back to the generic values">Reset</button>` : ` <button data-del="${escH(it.id)}">Delete</button>`}</td></tr>`).join("")}</table>`;
  $("rlChips").querySelectorAll("[data-t]").forEach(b => b.onclick = () => { RL.filter = b.dataset.t; renderRL(); });
  $("rlTable").querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { RL.edit = clone(rigItem(b.dataset.edit)); renderRLForm(); });
  $("rlTable").querySelectorAll("[data-copy]").forEach(b => b.onclick = () => { const it = clone(rigItem(b.dataset.copy)); delete it.builtin; it.id = "r_" + uid(); it.name = it.name + " (copy)"; RL.edit = it; renderRLForm(); });
  $("rlTable").querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Confirm"; return; }
    if (!CAP.db) return; try { await CAP.db.doc("rigging/" + b.dataset.del).delete(); const g = RIG_BUILTIN.find(i => i.id === b.dataset.del); if (g) rigRefreshSnaps(g.id, g); toast(g ? "Reset to the generic values" : "Item deleted"); } catch (e) { toast("Couldn't delete"); }
  });
  renderRLForm();
}
// an edited library item: refresh its stored copy in every rig of the open plan, so the sheets and checks use the new values
function rigRefreshSnaps(id, it) {
  if (!plan || !it) return 0; let n = 0; const seen = new Set();
  const walk = o => { if (!o || typeof o !== "object" || seen.has(o)) return; seen.add(o);
    if (o.id === id && o.snap && typeof o.snap === "object") { const s = o.snap; for (const k of ["name", "type", "swl", "weight", "wpm", "len", "colour", "pad", "drawing", "style", "dia"]) if (it[k] !== undefined) s[k] = clone(it[k]); n++; }
    for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v); };
  walk(plan.loads); (plan.lifts || []).forEach(L => walk(L.loads));
  if (n) { try { markDirty(); if (typeof renderAll === "function") renderAll(); } catch (e) { console.warn(e); } }
  return n;
}
function renderRLForm() {
  const it = RL.edit;
  $("rlNew").hidden = !!it; $("rlForm").hidden = !it; if (!it) return;
  const sl = RIG_TYPES[it.type]?.sling;
  $("rlForm").innerHTML = `<div class="rh"><b>${rigItem(it.id) ? (rigIsBuiltinId(it.id) ? "Edit generic item" : "Edit item") : "New item"}</b>${rigIsBuiltinId(it.id) ? ` <span class="small">– saving keeps the same item, so plans using it pick up your values. Reset brings back the generic values.</span>` : ""}</div>
    <div class="row"><label>Type<select id="rfType">${Object.entries(RIG_TYPES).map(([k, t]) => `<option value="${k}" ${it.type === k ? "selected" : ""}>${t.name}</option>`).join("")}</select></label><label>Name / description<input type="text" id="rfName" value="${escH(it.name || "")}" placeholder="e.g. 2 OFF 200 t GN H14 wide body shackle"></label></div>
    <div class="row3"><label>SWL / WLL (t)<input type="number" id="rfSwl" step="0.01" value="${it.swl ?? ""}"></label>
      ${sl ? `<label>Weight per metre (kg/m)<input type="number" id="rfWpm" step="0.01" value="${it.wpm ? +(it.wpm * 1000).toFixed(3) : ""}"></label>` : `<label>Weight (kg)<input type="number" id="rfW" step="0.1" value="${it.weight ? +(it.weight * 1000).toFixed(2) : ""}"></label>`}
      ${sl ? (["sling_round", "sling_web"].includes(it.type) ? `<label>Colour<select id="rfCol">${Object.keys(SLING_COLOURS).map(c => `<option ${it.colour === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>` : "<span></span>") : `<label>${it.type === "spreader" ? "Length / span (m)" : "Length / inside length (m)"}<input type="number" id="rfLen" step="0.01" value="${it.len ?? ""}"></label>`}</div>
    <div class="row"><label>Certificate / ID no.<input type="text" id="rfCert" value="${escH(it.cert || "")}"></label><label>Manufacturer / notes<input type="text" id="rfNotes" value="${escH(it.notes || "")}"></label></div>
    ${it.type === "spreader" ? `<div class="spec"><b>Padeye positions &amp; ratings</b> <span class="small">(leave empty for a simple beam)</span>
      <div class="row"><label>Upper padeye spacings (m)<input type="text" id="rfPadTop" placeholder="2.5, 4, 5.5, 6.515" value="${escH((it.pad?.top || []).join(", "))}"></label><label>Lower padeye spacings (m)<input type="text" id="rfPadLow" placeholder="2.5, 4, 5.5, 7" value="${escH((it.pad?.low || []).join(", "))}"></label></div>
      <label>Rated load (t) – one line per upper spacing, one value per lower spacing<textarea id="rfPadCap" rows="4" placeholder="50 10 6 4&#10;10 50 10 6&#10;6 10 50 15&#10;4 6 10 50">${escH((it.pad?.cap || []).map(r => r.join(" ")).join("\n"))}</textarea></label>
      <div class="row"><label>Case names<input type="text" id="rfPadNames" placeholder="A, B, C, D" value="${escH((it.pad?.names || []).join(", "))}"></label><label>Max sling angle (°)<input type="number" id="rfPadAng" value="${it.pad?.maxAngle ?? ""}"></label></div></div>` : ""}
    ${it.drawing ? `<p class="small"><a href="${escH(it.drawing)}" target="_blank" rel="noopener">View the attached drawing</a></p>` : ""}
    <div class="btnrow"><button class="pri" id="rfSave">Save to library</button><button id="rfCancel">Cancel</button></div>`;
  $("rfType").onchange = e => { RL.edit.type = e.target.value; renderRLForm(); };
  $("rfCancel").onclick = () => { RL.edit = null; renderRLForm(); };
  $("rfSave").onclick = async () => {
    const t = RL.edit.type, sl2 = RIG_TYPES[t]?.sling, base = clone(RL.edit); delete base.builtin; delete base.id; const doc = { ...base, type: t, name: $("rfName").value.trim(), swl: +$("rfSwl").value, cert: $("rfCert").value.trim(), notes: $("rfNotes").value.trim(), updated: Date.now() };
    if (sl2) { doc.wpm = (+$("rfWpm").value || 0) / 1000; if ($("rfCol")) doc.colour = $("rfCol").value; doc.weight = 0; doc.len = 0; } else { doc.weight = (+$("rfW").value || 0) / 1000; doc.len = +$("rfLen").value || 0; }
    if (RL.edit.drawing) doc.drawing = RL.edit.drawing;
    if (t === "spreader" && $("rfPadTop")) {
      const nums = v => String(v).split(/[\s,;]+/).filter(Boolean).map(Number).filter(x => x > 0);
      const top = nums($("rfPadTop").value), low = nums($("rfPadLow").value);
      if (top.length && low.length) {
        const rows = $("rfPadCap").value.split(/\n+/).map(l => nums(l)).filter(r => r.length);
        const cap = top.map((_, i) => low.map((_, j) => (rows[i] || [])[j] || doc.swl));
        const nm = $("rfPadNames").value.split(/[\s,;]+/).filter(Boolean);
        doc.pad = { names: nm.length === top.length ? nm : top.map((_, i) => String.fromCharCode(65 + i)), top, low, cap, maxAngle: +$("rfPadAng").value || null, topShk: RL.edit.pad?.topShk || [], lowShk: RL.edit.pad?.lowShk || "" };
        if (!doc.len) doc.len = Math.max(...low);
      }
    }
    if (!doc.name || !(doc.swl > 0)) { toast("Give the item a name and SWL"); return; }
    if (!CAP.db) { toast("Saving isn't available in this view"); return; }
    try { const rid = RL.edit.id || "r_" + uid(); await CAP.db.doc("rigging/" + rid).set(doc); RL.edit = null; const n = rigRefreshSnaps(rid, doc); toast("Saved to the rigging library" + (n ? ` – ${n} use${n > 1 ? "s" : ""} in this plan updated` : "")); } catch (e) { toast("Couldn't save (" + (e.code || e) + ")"); }
  };
}
$("rlAdd").onclick = () => { RL.edit = { id: "r_" + uid(), type: RL.filter || "shackle", name: "", swl: "", weight: "", len: "" }; renderRLForm(); };
$("rlPhoto").onclick = () => $("rlFile").click();
$("rlFile").onchange = async e => {
  const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
  const st = $("rlStatus"); st.hidden = false; st.className = "status busy"; st.textContent = CAP.sample && CAP.sampleImages ? "Reading with Claude… (10–60 s)" : "Attaching the drawing…";
  if (!CAP.sample || !CAP.sampleImages) {
    try { const images = await toImages(files); const drawing = images.length ? await keepDrawing(images[0]) : null;
      RL.edit = { id: "r_" + uid(), type: RL.filter || "spreader", name: files[0].name.replace(/\.[^.]+$/, ""), swl: "", weight: "", len: "", drawing }; renderRLForm();
      st.className = "status"; st.textContent = (CAP.local ? "Automatic reading needs Claude (✦ Link Claude at the top) – " : "Reading isn't available here – ") + "the drawing is attached. Type the SWL, weight" + (RL.edit.type === "spreader" ? ", padeye spacings and ratings" : "") + " below and save.";
    } catch (err) { st.className = "status bad"; st.textContent = "Couldn't open that file (" + (err.message || err) + ")"; }
    return;
  }
  try {
    const images = await toImages(files);
    const res = await CAP.sample.json(RIG_ITEM_PROMPT, { images, modelTier: "complex" });
    const items = (res && res.items) || [];
    if (!items.length) throw { message: "no items found" };
    const drawing = await keepDrawing(images[0]);
    let n = 0;
    for (const x of items) {
      const type = RIG_TYPES[x.type] ? x.type : "other", sl = RIG_TYPES[type]?.sling;
      const doc = { type, name: String(x.name || RIG_TYPES[type].name).slice(0, 120), swl: +x.swl_t || 0, weight: sl ? 0 : (+x.weight_kg || 0) / 1000, wpm: sl ? (+x.weight_kg_per_m || 0) / 1000 : 0, len: +x.length_m || 0, cert: String(x.certificate || ""), notes: String(x.manufacturer || ""), colour: x.colour || "", updated: Date.now(), fromPhoto: true };
      if (drawing) doc.drawing = drawing;
      const pd = x.padeyes; if (type === "spreader" && pd && (pd.upper_spans_m || []).length && (pd.lower_spans_m || []).length) {
        const top = pd.upper_spans_m.map(Number), low = pd.lower_spans_m.map(Number);
        const cap = top.map((_, i) => low.map((_, j) => +((pd.capacity_t || [])[i] || [])[j] || doc.swl));
        doc.pad = { names: (pd.names || []).length === top.length ? pd.names.map(String) : top.map((_, i) => String.fromCharCode(65 + i)), top, low, cap, maxAngle: +pd.max_sling_angle_deg || null, topShk: (pd.upper_shackles || []).map(String), lowShk: String(pd.lower_shackles || "") };
        if (!doc.len) doc.len = Math.max(...low);
      }
      if (type === "spreader" && x.table && typeof tableFromAI === "function") { const T = tableFromAI(x.table); if (T) { doc.table = T; if (!(doc.swl > 0)) doc.swl = Math.max(...Object.values(T.wll).flat()); } }
      if (!(doc.swl > 0)) continue;
      if (items.length === 1) { RL.edit = { id: "r_" + uid(), ...doc }; renderRLForm(); n = 1; break; }
      await CAP.db.doc("rigging/r_" + uid()).set(doc); n++;
    }
    st.className = "status ok"; st.textContent = items.length === 1 ? "Read – check the values below, then Save to library." : `${n} item(s) added to your library – check each one.${res.notes ? " Claude noted: " + res.notes : ""}`;
  } catch (err) { st.className = "status bad"; st.textContent = err.code === "not_granted" ? "Claude access wasn't allowed for this app." : "Couldn't read that (" + (err.code || err.message || err) + ")."; }
};
const RIG_ITEM_PROMPT = `The images show lifting equipment: a certificate, a catalogue page, a tag, a photo, or a fabrication / general arrangement drawing (possibly several sheets) of a shackle, sling, sling set, master link, hook, lifting beam or spreader bar.
If it is a drawing of a spreader bar / lifting beam, return the beam itself as one item AND each separate rigging item shown with it (sling set, master link / quad assembly, shackles) as further items.
For a MODULAR / adjustable spreader whose instructions give a load-v-span table add "table": {"maker": "...", "model": "...", "source": "document title and date", "unit": "m" or "ft" (how the spans are written),
 "step_m": span step it is built in (m), "min_span_m": n, "max_span_m": n, "rows": [{"span_m": span in metres, "wll_t": {"20": WLL with top legs up to 20° from vertical, "30": ..., "45": ...},
 "min_top_sling_m": {"20": n, "30": n, "45": n}, "make_up": ["each strut between the end units, e.g. \"6 ft\""]}], "end_units_and_drop_links_kg": weight of both end units + both drop links,
 "part_weights_kg": {"strut label as in make_up": kg}, "end_label": "EU", "top_sling_max_deg": largest top-leg angle from vertical allowed, "lower_sling_max_deg_along_beam": n or null,
 "lower_sling_max_deg_across_beam": n or null, "notes": "shackle sizes and other rules"}. Angles are measured FROM VERTICAL: a base-to-sling angle α is 90 − α (60° BSA = 30°, 45° BSA = 45°, 70° BSA = 20°).
 Put every row of the table; convert feet / inches and lbs to metres and kg.
For a spreader bar with several padeye positions add "padeyes": {"names": ["A","B",...], "upper_spans_m": [centre-to-centre spacing of each upper padeye pair], "lower_spans_m": [spacing of each lower padeye pair],
 "capacity_t": [[rated load for upper pair i with lower pair j, ...] one row per upper pair] (from a rigging-configuration / load-case table if given, otherwise the bar SWL everywhere),
 "max_sling_angle_deg": n or null, "upper_shackles": ["shackle for each upper pair"], "lower_shackles": "shackle for the lower padeyes"}.
Return JSON only: {"items":[{"type": one of "shackle","masterlink","hook","sling_wire","sling_round","sling_web","sling_chain","spreader","other",
"name": short description as a rigger would write it (e.g. "Bow shackle 25 t 1-3/4\\"", "Wire rope sling Ø40 mm 6x36 IWRC"), "swl_t": working load limit in tonnes (number),
"weight_kg": item weight in kg if shown (null otherwise), "weight_kg_per_m": for slings, weight per metre if shown, "length_m": inside length for shackles/links/hooks, span for beams, effective length for slings (null if not shown),
"colour": for round/webbing slings, "certificate": certificate, drawing or ID number if shown, "manufacturer": maker, material, notes from the drawing, "padeyes": only for spreader bars as above}], "notes": "anything uncertain"}
Use only values you can read or that are standard for that exact item. Convert lb to kg and short tons to tonnes where needed.`;

// ---------- load from a photo or drawing ----------
async function toImages(files) {
  const out = [];
  for (const f of files) {
    if (f.type === "application/pdf" && window.pdfjsLib) {
      const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
      for (let i = 1; i <= Math.min(pdf.numPages, Math.max(3, CAP.sampleImages?.maxCount || 4)); i++) { const pg = await pdf.getPage(i), vp = pg.getViewport({ scale: 2 }), c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise; out.push(await new Promise(r => c.toBlob(r, "image/jpeg", 0.9))); }
    } else if (f.type.startsWith("image/")) {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
      const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas"); c.width = img.naturalWidth * k; c.height = img.naturalHeight * k;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); out.push(await new Promise(r => c.toBlob(r, "image/jpeg", 0.9)));
    }
  }
  return out.slice(0, CAP.sampleImages?.maxCount || 4);
}
const LOAD_PROMPT = () => `The images show a load to be lifted by crane – a photo, a general arrangement drawing or a lifting arrangement drawing.
Identify the load and return JSON only:
{"kind": one of "reel","silo","cyl","box","container","ccu","tank","beam","frame","bag" ("bag" = bulk bag / FIBC / big bag with lifting loops; "ccu" = offshore cargo carrying unit: half height, open top, cargo basket, mini container, tank in a frame, gas rack…),
 "style": for ccu one of "closed","open","half","basket","tankframe","rack", "colour": main paint colour as #rrggbb,
 "library_match": the closest of these standard items if it clearly is one, else null: ${LOAD_LIBRARY.map(x => x.name).join(" | ")},
 "lifting_points": number of lifting points / pad eyes (1, 2 or 4),
 "orient": reel "upright"|"flat"; silo "upright"|"horizontal"; cyl "horizontal"|"vertical"; beam "flat"|"side"; others "flat" (tank "horizontal"),
 "name": short name, "weight_t": weight in tonnes if stated (null otherwise),
 "dims": metres – reel {"D" flange diameter,"FW" width over flanges,"W" overall width incl. spindle,"core" barrel diameter}; silo {"D","H" overall height/length,"cone","legs"}; cyl {"D","L"}; box/frame/bag {"L","W","H"}; container {"size": "10ft"|"20ft"|"20ft HC"|"40ft"|"40ft HC"}; tank {"D","L","saddle" height of saddles}; beam {"L","H" depth,"W" flange width},
 "span_m": spacing between the two lifting points along the load (null if not shown), "spanY_m": across spacing for 4-point lifts (null if none), "cog_offset_m": CoG offset from centre (0 if central),
 "rigging": short text describing any rigging shown (slings, shackles, spreader beam, sizes and SWL) or "",
 "notes": what you assumed or could not read}.
Read dimensions from the drawing (convert mm to m). For photos estimate from known features and say so in notes.`;
async function loadFromPhoto(files) {
  const st = $("lbAi"); st.hidden = false; st.className = "status busy"; st.textContent = "Reading the load with Claude… (10–40 s)";
  try {
    const images = await toImages(files); if (!images.length) throw { message: "unsupported file" };
    const photo = await keepPhoto(images[0]);
    const r = await CAP.sample.json(LOAD_PROMPT(), { images, modelTier: "complex" });
    const kind = LOAD_DEFAULTS[r.kind] ? r.kind : "box";
    const libHit = r.library_match ? LOAD_LIBRARY.find(x => x.name.toLowerCase() === String(r.library_match).toLowerCase()) : null;
    const ld = libHit ? libToLoad(libHit) : normLoad({ ...clone(LOAD_DEFAULTS[kind]), id: LB.ld.id, pick: LB.ld.pick, set: LB.ld.set });
    ld.id = LB.ld.id; ld.pick = LB.ld.pick; ld.set = LB.ld.set; Object.assign(ld, photo);
    if (kind === "ccu") { if (CCU_STYLES[r.style]) ld.style = r.style; if (/^#[0-9a-f]{6}$/i.test(r.colour || "")) ld.colour = r.colour; }
    if (+r.lifting_points > 0) ld.nLP = +r.lifting_points >= 4 ? 4 : +r.lifting_points >= 2 ? 2 : 1;
    if (r.orient && LOAD_TYPES[kind].orients[r.orient]) ld.orient = r.orient;
    if (r.name) ld.name = String(r.name).slice(0, 80);
    if (r.weight_t > 0) ld.weight = +r.weight_t;
    const d = r.dims || {};
    if (kind === "container" && CONTAINER_SIZES[d.size]) { ld.size = d.size; [ld.L, ld.W, ld.H] = CONTAINER_SIZES[d.size]; }
    for (const k of ["D", "FW", "W", "core", "H", "cone", "legs", "L", "saddle"]) if (+d[k] > 0) ld[k] = +d[k];
    if (!libHit || r.dims_from_image) for (const k of ["L", "W", "H"]) if (+(r.dims || {})[k] > 0) ld[k] = +r.dims[k];
    if (+r.span_m > 0) ld.span = +r.span_m; if (+r.spanY_m > 0) ld.spanY = +r.spanY_m; if (r.cog_offset_m != null && !isNaN(+r.cog_offset_m)) ld.cog = +r.cog_offset_m;
    ld.aiNotes = [r.rigging ? "Rigging shown: " + r.rigging : "", r.notes || ""].filter(Boolean).join(" · ");
    LB.ld = ld; renderLB();
    const st2 = $("lbAi"); st2.hidden = false; st2.className = "status ok"; st2.textContent = `Read as ${LOAD_TYPES[kind].name}. Check every dimension and the weight before adding.${ld.aiNotes ? " " + ld.aiNotes : ""}`;
  } catch (err) { st.className = "status bad"; st.textContent = err.code === "not_granted" ? "Claude access wasn't allowed for this app." : "Couldn't read that (" + (err.code || err.message || err) + ")."; }
}

// ---------- rigging arrangement sheet (page 2 of the PDF) ----------
// β – the leg angle to the vertical (UK / LEEA), drawn at the upper end of the leg: a short vertical reference line,
// the arc between it and the sling, the value written just outside the sling
function rsBeta(map, hi, lo, r = 130, val = null) {
  const [hx, hy] = map(hi[0], hi[1]), [lx, ly] = map(lo[0], lo[1]), a1 = Math.atan2(ly - hy, lx - hx), a0 = Math.PI / 2, b = Math.abs(a1 - a0) / D2R;
  const Ls = Math.hypot(lx - hx, ly - hy); if (b < 0.5 || Ls < 45) return ""; r = Math.min(r, Ls * 0.55);   // a short leg on a small view still gets its angle
  const out = lx >= hx ? 1 : -1, d = r + 34, px = hx + d * Math.cos(a1) + out * 14, py = hy + d * Math.sin(a1) + 6;
  return cadL(hx, hy, hx, hy + r + 30, CAD.px(CAD.lw.thin), "8 6") + cadArc(hx, hy, r, Math.min(a0, a1), Math.max(a0, a1), "") + cadT(px, py, `${fx(val != null ? val : b, 1)}°`, { a: out > 0 ? "start" : "end" });
}
function rigSheetSVG(ld) {
  const W = 3508, H = 2480, M = 36, e = s => escH(s), res = solveRig(ld); if (!res) return null;
  const d = loadDims(ld), cranes = plan.cranes.filter(c => c.attach?.load === ld.id);
  const bandY = H - 560;
  // views in metres → sheet px
  const views = [];
  const addView = (view, x0, y0, w, h) => {
    const s = new Scene();
    s.add(loadProfile(ld, view).s);
    rig2D(s, ld, res, view, 0, 0, { cad: true });
    const cr = cranes[0], C = cr ? REG.cranes[cr.model] : null, bd = cr && C ? blockDims(cr, C) : null;
    const hps = view === "end" ? [res.hookPts[0]] : res.hookPts;
    for (const [hi, hp] of hps.entries()) {
      const u = view === "end" ? hp[1] : hp[0];
      const crh = hps.length > 1 ? (cranes.find(c => c.attach.point === (hi ? "B" : "A")) || cranes[hi] || cr) : cr, Ch = crh ? REG.cranes[crh.model] : null, bd = crh && Ch ? blockDims(crh, Ch) : null;
      if (bd) cadBlock2D(s, bd, u, hp[2], view, hp[2] + bd.total + 2.2);
      else s.poly("RIGGING", [[u, hp[2]], [u, hp[2] + 2]], { w: 2, color: "#3a3e42" });
    }
    cadGround(s, -(view === "end" ? d.y : d.x) / 2 - 1, (view === "end" ? d.y : d.x) / 2 + 1);
    const b = s.bounds(), pad = 0.8, k = Math.min(w / (b[2] - b[0] + 2 * pad), h / (b[3] - b[1] + 2 * pad));
    cadify(s, k, 0.06);
    const cx = x0 + w / 2 - ((b[0] + b[2]) / 2) * k, cy = y0 + h / 2 + ((b[1] + b[3]) / 2) * k;
    const map = (u, z) => [cx + u * k, cy - z * k];
    const svg = toSVG(s, { bounds: b, pad, noSize: true, lw: 0.06, pre: cadHatchDefs("cadH", 0.12) });
    views.push({ view, svg, x0, y0, w, h, map, k, bd, cr, b, pad });
  };
  const vw = 1000, vh = bandY - M - 200;
  addView("side", M + 470, M + 110, vw - 400, vh);   // room on the left for the height dimensions
  addView("end", M + 40 + vw + 720, M + 110, W - M - 40 - (M + 40 + vw + 720) - 260, vh);
  let g = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif" data-ld="${ld.id}">
<rect width="${W}" height="${H}" fill="#fff"/><rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" fill="none" stroke="#16202a" stroke-width="4"/>
<line x1="${M}" y1="${bandY}" x2="${W - M}" y2="${bandY}" stroke="#16202a" stroke-width="4"/>`;
  for (const v of views) {
    const bw = (v.b[2] - v.b[0] + 2 * v.pad) * v.k, bh = (v.b[3] - v.b[1] + 2 * v.pad) * v.k;
    g += `<text x="${v.x0 + v.w / 2}" y="${M + 70}" font-size="34" font-weight="700" text-anchor="middle" fill="#16202a">${v.view === "side" ? "FRONT VIEW" : "END VIEW"}</text>`;
    g += nestSVG(v.svg, v.x0 + (v.w - bw) / 2, v.y0 + (v.h - bh) / 2, bw, bh);
  }
  // callouts with leader lines (front view), stacked in the margin right of the view
  const fv = views[0], ev = views[1];
  const anchors = [];
  const U = p => p[0], Z = p => p[2];
  const mid = gg => [(gg.a[0] + gg.b[0]) / 2, 0, (gg.a[2] + gg.b[2]) / 2];
  const partsAt = rigParts(ld, res);
  for (const r of res.rows) {
    let p = partsAt.find(q => q.entry === r.entry)?.p;   // where the rigging list puts it
    // gear listed below the last sling is at the load's lifting lugs – point at the lug, not at the beam
    { const rn = res.rows.filter(x => x.name), iLast = rn.map(x => !!RIG_TYPES[x.type]?.sling).lastIndexOf(true), ir = rn.indexOf(r);
      if (iLast >= 0 && ir > iLast && (res.lpPts || []).length) { const lp = res.lpPts.reduce((m, q) => q[0] > m[0] ? q : m, res.lpPts[0]); p = [lp[0], lp[1], lp[2] + 0.12]; } }
    if (p && U(p) < -0.05 && Math.abs(+ld.cog || 0) < 0.5 && (res.lpPts || []).some(q => q[0] > 0.05)) p = [-p[0], p[1], p[2]];   // symmetric rig: point at the right-hand twin
    if (p) { anchors.push({ r, px: fv.map(U(p), Z(p))[0], py: fv.map(U(p), Z(p))[1] }); continue; }
    if (r.type === "masterlink" || (r.where || "").includes("hook")) p = res.links[0];
    else if (r.type === "shackle") p = (r.where || "").startsWith("top") ? res.shk[1] : res.shk[res.shk.length - 1];
    else if (r.type === "spreader" && res.beam) p = [res.beam.b[0] * 0.6, 0, res.beam.a[2] + res.beam.h / 2];
    else { const segs = (r.where || "").startsWith("lower") ? res.seg.slice(-1) : res.seg.slice(res.seg.length > 2 && res.beam ? 1 : 0); p = segs.length ? mid(segs[0]) : res.links[0]; }
    if (!p) p = (res.lpPts && res.lpPts[0]) || (res.shk && res.shk[0]) || res.hookPts[0];   // every item gets a callout
    const [px, py] = fv.map(U(p), Z(p));
    anchors.push({ r, px, py });
  }
  // the hook block of each crane on the load, at its own hook (A = first hook, B = second)
  res.hookPts.forEach((hp, hi) => { const crh = res.hookPts.length > 1 ? (cranes.find(c => c.attach.point === (hi ? "B" : "A")) || cranes[hi]) : cranes[0], Ch = crh ? REG.cranes[crh.model] : null, bd = crh && Ch ? blockDims(crh, Ch) : null;
    if (!bd) return; const [px, py] = fv.map(hp[0] + bd.W * 0.3, hp[2] + bd.hookLen + bd.H * 0.6); anchors.unshift({ crane: true, cr: crh, bd, hi, px, py }); });
  const colX = fv.x0 + fv.w + 30;
  const coLines0 = (r, ch) => { const L = wrapLines(upUnits(r.name), ch), q = `  –  QTY ${r.qty}`; if ((L[L.length - 1] + q).length <= ch) L[L.length - 1] += q; else L.push(q.trim()); return L; };
  // a symmetric rig: every leader goes to the right-hand twin of its part, so no leader crosses the drawing
  { const [xc0] = fv.map(+ld.cog || 0, 0), sym = Math.abs(+ld.cog || 0) < 0.5 && (res.hookPts || []).length === 1; if (sym) for (const a of anchors) if (!a.crane && a.px < xc0 - 2) a.px = 2 * xc0 - a.px; }
  anchors.sort((a, b) => a.py - b.py);
  // two hooks (a load on two cranes): the parts at the left-hand end are called out in a column in the left margin, above
  // the level marks, numbers facing the drawing – so no leader runs across the load to the right-hand column. Only when
  // they all fit there; otherwise everything stays in the right-hand column.
  let colL = null;
  if (res.hookPts.length > 1) { const [xc0] = fv.map(+ld.cog || 0, 0), [xEnd] = fv.map(-d.x / 2, 0), edge = Math.min(fv.x0 - 30, xEnd - 180), chars = Math.floor((edge - 44 - (M + 30)) / 10.5);
    const yTop = fv.map(0, Math.max(...res.hookPts.map(h => h[2])))[1] - 60, left = anchors.filter(a => a.px < xc0);
    if (chars >= 18 && left.length) { const c = { x: edge, chars, right: true }, need = left.reduce((n, a) => n + 96 + (a.crane ? 48 : Math.max(0, coLines0(a.r, chars).length) * 24), 0);
      if (M + 130 + need <= yTop) { colL = c; left.forEach(a => a.col = c); } } }
  // your own adjustments from the sheet preview: label moved (dx, dy), point moved (ax, ay), wording changed (text)
  const OV = (ld.sheetEdits && ld.sheetEdits.co) || {};
  // every callout gets a slot: stacked down the column, and if the column would run past the drawing area
  // (onto the parts list) it is pushed back up and, if needed, the spacing is tightened – no item is ever left off
  const coChars = Math.max(24, Math.floor(((ev ? ev.x0 - 56 : W - M - 20) - (colX + 44)) / 10.5));
  const coLines = (r, ch = coChars) => coLines0(r, ch);
  for (const a of anchors) a.ex = a.crane ? 24 : Math.max(0, coLines(a.r, a.col ? a.col.chars : coChars).length - 1) * 24;   // extra height of a wrapped label
  { const yMax = bandY - 70, yMin = M + 110, R = anchors.filter(a => !a.col), Lf = anchors.filter(a => a.col); let gap = 96;
    const stack = () => { let last = -1e9, ex = 0; for (const a of R) { a.ty = Math.max(a.py, last + gap + ex); last = a.ty; ex = a.ex; }
      let next = yMax + gap; for (let i = R.length - 1; i >= 0; i--) { R[i].ty = Math.min(R[i].ty, next - gap - R[i].ex); next = R[i].ty; } };
    stack(); while (R.length && R[0].ty < yMin && gap > 52) { gap -= 6; stack(); }
    let y = yMin + 20; for (const a of Lf) { a.ty = y; y += 96 + a.ex; } }   // left margin column: top down, in the order of the parts' heights
  // callout text wraps before it reaches the detail boxes (or the sheet edge)
  for (const a of anchors) {
    const ty = a.ty;
    const id = a.crane ? (a.hi === res.hookPts.length - 1 ? "hook" : "hook" + a.hi) : "r" + a.r.no, o = OV[id] || {};
    const auto = a.crane
      ? [`${a.cr.label} HOOK BLOCK`, `${blockName(a.bd)} SWL ${fx(a.bd.cap, 0)} t`, `${a.bd.parts} part${a.bd.parts > 1 ? "s" : ""} of line`]
      : [...coLines(a.r, a.col ? a.col.chars : coChars), `SWL ${fmtT(a.r.swl)} t`];
    const lines = o.text != null ? String(o.text).split("\n") : auto;
    const lx = (a.col ? a.col.x : colX) + (+o.dx || 0), ly = ty + (+o.dy || 0), ax = a.px + (+o.ax || 0), ay = a.py + (+o.ay || 0), rt = !!(a.col && a.col.right), sg = rt ? -1 : 1;
    g += `<g data-co="${id}" data-kind="lead"><polyline points="${ax},${ay} ${lx - sg * 24},${ly} ${lx - sg * 2},${ly}" fill="none" stroke="#111" stroke-width="${CAD.px(CAD.lw.thin).toFixed(2)}"/></g><circle data-co="${id}" data-kind="anchor" cx="${ax}" cy="${ay}" r="4.5" fill="#111"/>`;
    g += `<g data-co="${id}" data-kind="label" data-auto="${e(auto.join("\n"))}">`;
    if (!a.crane) g += `<circle cx="${lx + sg * 17}" cy="${ly}" r="18" fill="#fff" stroke="#111" stroke-width="${CAD.px(CAD.lw.mid).toFixed(2)}"/><text x="${lx + sg * 17}" y="${ly + 7}" font-size="20" font-weight="700" text-anchor="middle" fill="#16202a">${a.r.no}</text>`;
    lines.filter(Boolean).forEach((t, i) => g += `<text x="${lx + sg * (a.crane ? 0 : 44)}" y="${ly + 7 + i * 24}" font-size="${i ? 19 : 21}" font-weight="${i ? 400 : 700}" fill="${i ? "#3d4a57" : "#16202a"}"${rt ? ` text-anchor="end"` : ""}>${e(t)}</text>`);
    g += `</g>`;
  }
  // CAD dimensions – front view: lengths below the ground, a chain of heights on the left, sling angles as arcs, the CoG centre line
  { const hp = res.hookPts[0], LP = (res.lpPts && res.lpPts.length ? res.lpPts : res.seg.map(q => q.b)), xsL = LP.map(q => q[0]), lowX = LP.length ? Math.max(...xsL) : 0, lowXm = LP.length ? Math.min(...xsL) : 0;
    const [, yG] = fv.map(0, 0), lpz = liftPointZ(ld);
    g += `<g data-dims="1">`;
    // centre line through the CoG and the hook
    // centre line through the CoG and the hook, and the CoG mark (as stencilled on the load) on the load
    { const [xc, yTop] = fv.map(+ld.cog || 0, hp[2] + 1.2), [, yC] = fv.map(0, +ld.cogZ > 0 ? +ld.cogZ : d.z / 2); g += cadCL(xc, yG + 30, xc, yTop) + cadCoG(xc, yC); }
    // horizontal: load length, lifting points
    const [xl0] = fv.map(-d.x / 2, 0), [xl1] = fv.map(d.x / 2, 0);
    g += cadDim([xl0, yG], [xl1, yG], yG + 60, `${fx(d.x, 2)} m load length`);
    if (lowX - lowXm > 0.3) { const [a0, ay] = fv.map(lowXm, lpz), [a1] = fv.map(lowX, lpz); g += cadDim([a0, ay], [a1, ay], yG + 118, `${ld.approx?.span ? "~" : ""}${fx(lowX - lowXm, 2)} m between lifting points`); }
    // (spreader padeye spacing is dimensioned in detail B)
        // heights: chain at the left from the ground to the hook, overall height further out, level marks
    const lvl = [[0, "GROUND / LOAD BOTTOM"], [lpz, ld.approx?.lpZ ? "LIFTING POINTS (~)" : "LIFTING POINTS"], [d.z, "TOP OF LOAD"]];
    if (res.beam) { lvl.push([res.beam.a[2], "SPREADER UNDERSIDE"]); lvl.push([res.beam.a[2] + res.beam.h, "TOP PADEYES"]); }
    lvl.push([hp[2], "HOOK"]);
    lvl.sort((a, b) => a[0] - b[0]);
    const xF = Math.min(xl0, fv.map(Math.min(...res.seg.flatMap(q => [q.a[0], q.b[0]])), 0)[0]) - 30, xC = xF - 50, xO = xC - 70;
    const ys = lvl.map(([z]) => fv.map(0, z)[1]);
    for (let i = 1; i < lvl.length; i++) { const hgt = lvl[i][0] - lvl[i - 1][0]; if (hgt < 0.05) continue; g += cadDim([xF, ys[i - 1]], [xF, ys[i]], xC, `${fx(hgt, 2)}`, false); }
    g += cadDim([xF, ys[0]], [xF, ys[ys.length - 1]], xO, `${fx(hp[2], 2)} m to the hook`, false, { fitOnly: true });   // the HOOK level mark gives it too
    let prev = 1e9; lvl.forEach(([z, n], i) => { const yy = Math.min(ys[i], prev - 26); prev = yy; g += cadLevel(xO - 22, yy, z, n); });
    // sling angles to the vertical (β – UK / LEEA practice) as arcs at the lower end of each leg
    const zTopBeam = res.beam ? res.beam.a[2] + res.beam.h : null;
    const right = q => Math.max(q.a[0], q.b[0]);
    const betaOf = q => Math.atan2(Math.hypot(q.a[0] - q.b[0], q.a[1] - q.b[1]), Math.abs(q.a[2] - q.b[2]));   // the worst (largest β) top leg is the one dimensioned
    const topLeg = res.beam ? res.seg.filter(q => Math.min(q.a[2], q.b[2]) >= zTopBeam - 0.05).sort((a, b) => betaOf(b) - betaOf(a) || right(b) - right(a))[0] : null;
    const drop = res.seg.filter(q => !res.beam || Math.max(q.a[2], q.b[2]) <= res.beam.a[2] + 0.05).sort((a, b) => right(b) - right(a))[0];
    for (const q of [topLeg, drop].filter(Boolean)) { const lo = q.a[2] < q.b[2] ? q.a : q.b, hi = lo === q.a ? q.b : q.a, ang = Math.atan2(hi[2] - lo[2], Math.hypot(hi[0] - lo[0], hi[1] - lo[1])) / D2R;
      if (ang > 89.5 || Math.abs(hi[1] - lo[1]) > 0.05 * Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])) continue;   // only where the view shows the true angle
      g += rsBeta(fv.map, [hi[0], hi[2]], [lo[0], lo[2]], q === topLeg ? 150 : 90); }
    if (res.beam) { const tops = res.seg.filter(q => Math.min(q.a[2], q.b[2]) >= zTopBeam - 0.05), hiOf = q => q.a[2] > q.b[2] ? q.a : q.b, loOf = q => q.a[2] > q.b[2] ? q.b : q.a;
      const L = tops.filter(q => loOf(q)[0] < 0).sort((a, b) => loOf(a)[0] - loOf(b)[0])[0], Rt = tops.filter(q => loOf(q)[0] > 0).sort((a, b) => loOf(b)[0] - loOf(a)[0])[0];
      if (L && Rt) {
        const pt = (res.pads || []).filter(p => p[3] === "top").map(p => p[0]);
      } }
    g += `</g>`; }
  // CAD dimensions – end view: heights on the right, lifting points across
  { const hp = res.hookPts[0], [xR] = ev.map(ev.b[2], 0), [, yb] = ev.map(0, 0), [, y0] = ev.map(0, d.z), [, yh] = ev.map(0, hp[2]);
    const xd = xR + 30; g += `<g data-dims="1">` + cadDim([xR, yb], [xR, y0], xd, `${fx(d.z, 2)}`, false) + cadDim([xR, y0], [xR, yh], xd, `${fx(hp[2] - d.z, 2)}`, false) + cadDim([xR, yb], [xR, yh], xd + 70, `${fx(hp[2], 2)} m to the hook`, false);
    const LP = res.lpPts || [], ysL = LP.map(q => q[1]);
    if (LP.length > 1 && Math.max(...ysL) - Math.min(...ysL) > 0.3) { const z = LP[0][2], [a0, ay] = ev.map(Math.min(...ysL), z), [a1] = ev.map(Math.max(...ysL), z); g += cadDim([a0, ay], [a1, ay], yb + 60, `${ld.approx?.spanY ? "~" : ""}${fx(Math.max(...ysL) - Math.min(...ysL), 2)} m across`); }
    { const [xc, yt] = ev.map(0, hp[2] + 1.2), [, yC] = ev.map(0, +ld.cogZ > 0 ? +ld.cogZ : d.z / 2); g += cadCL(xc, yb + 30, xc, yt) + cadCoG(xc, yC); }
    // sling angles that are true in this view (legs leaning across the load) – β to the vertical
    for (const q of [...res.seg].sort((a, b) => Math.max(b.a[1], b.b[1]) - Math.max(a.a[1], a.b[1]))) { const lo = q.a[2] < q.b[2] ? q.a : q.b, hi = lo === q.a ? q.b : q.a, Lq = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
      if (Math.abs(hi[1] - lo[1]) < 0.1 || Math.abs(hi[0] - lo[0]) > Math.abs(hi[1] - lo[1])) continue;   // a leg that leans mainly across the load
      const bTrue = Math.atan2(Math.hypot(hi[0] - lo[0], hi[1] - lo[1]), hi[2] - lo[2]) / D2R;   // its true angle (it may also lean a little along the load)
      const m = rsBeta(ev.map, [hi[1], hi[2]], [lo[1], lo[2]], 110, bTrue); if (m) { g += m; break; } }
    g += `</g>`; }
  // DETAIL A – where the rigging joins the crane hook
  { const cr = fv.cr, C = cr ? REG.cranes[cr.model] : null, bd = fv.bd;
    const ds = new Scene(), hp = res.hookPts[0];
    if (bd) cadBlock2D(ds, bd, 0, 0, "side", bd.total + 1.0);
    const topR = res.rows.filter(r => (r.where || "").includes("hook") || (r.where || "").includes("each crane hook"));
    // links hung on the horns drawn as CAD rings (the horn passes through each link); other gear from the fittings library
    const mlE = (ld.rig.top || [])[0], ringOnHorns = res.hornX && !res.hornJoin && bd && mlE && mlE.snap.type === "masterlink";
    let tl, hornLow = [];
    if (ringOnHorns) { const Lh = bd.hookLen, rh = Math.max(0.12, Lh * 0.27), tr = rh * 0.45, len = Math.max(0.25, eLen(mlE)), bar = len * 0.11, ztop = tr * 1.75 + bar;
      for (const sx of [-1, 1]) { const cx = sx * rh, cz = ztop - len / 2, ring = (ra, rb) => Array.from({ length: 32 }, (_, i) => [cx + ra * Math.cos(i / 32 * 2 * Math.PI), cz + rb * Math.sin(i / 32 * 2 * Math.PI)]);
        ds.poly("RIGGING", ring(len * 0.3, len / 2), { closed: true, fill: "#c3c8cd", color: CAD.ink, _cad: "mid" }); ds.poly("RIGGING", ring(len * 0.3 - bar, len / 2 - bar), { closed: true, fill: "#ffffff", color: CAD.ink, _cad: "thin" }); hornLow.push([cx, ztop - len + bar * 0.6]); }
      tl = 0; }
    else if (res.hornX && !(ld.rig.top || []).length && bd) { const rh = Math.max(0.12, bd.hookLen * 0.27), tr = rh * 0.45; hornLow = [[-rh, tr * 1.4], [rh, tr * 1.4]]; tl = 0; }   // sling eyes straight on the horns
    else tl = Math.max(0.25, (res.hornX ? topStackHorns(ds, ld.rig.top || [], 0, 0, res.hornX, res.hornN, "side") : topStack2D(ds, ld.rig.top || [], 0, 0, "side")) || res.topLen || 0.3);
    const segs = res.seg.filter(gg => Math.abs(gg.a[2] - (hp[2] - res.topLen)) < 0.05).slice(0, 4);
    for (const gg of segs) { const dx = gg.b[0] - gg.a[0], dz = gg.b[2] - gg.a[2], L = Math.hypot(dx, dz) || 1, hl = hornLow.length ? hornLow[dx < 0 ? 0 : 1] : null, x0 = hl ? hl[0] : res.hornX && !res.hornJoin ? (dx < 0 ? -res.hornX : res.hornX) : 0; const t0 = hl ? hl[1] : -tl; const sn = gg.e?.snap, wS = Math.min(0.32, Math.max(0.06, 0.05 + 0.0011 * (+sn?.swl || 10))), ux = dx / L, uz = dz / L, nx = -uz * wS / 2, nz = ux * wS / 2, x1 = x0 + ux * 1.3, z1 = t0 + uz * 1.3; ds.poly("RIGGING", [[x0 + nx, t0 + nz], [x1 + nx, z1 + nz], [x1 - nx, z1 - nz], [x0 - nx, t0 - nz]], { closed: true, fill: cadMix(slingColour(sn), 0.35), color: CAD.ink, _cad: "mid" }); }
    const db = ds.bounds(), bw = 470, bh = 520, bx0 = ev.x0 - 40, by0 = M + 100;
    const k2 = Math.min(bw / (db[2] - db[0] + 0.6), (bh - 60) / (db[3] - db[1] + 0.6));
    cadify(ds, k2, 0.02);
    const dsvg = toSVG(ds, { bounds: db, pad: 0.3, noSize: true, lw: 0.02, pre: cadHatchDefs("cadH", 0.12) });
    g += `<rect x="${bx0}" y="${by0}" width="${bw}" height="${bh}" fill="#fff" stroke="#16202a" stroke-width="2" stroke-dasharray="14 8"/><text x="${bx0 + 14}" y="${by0 + 34}" font-size="24" font-weight="700" fill="#16202a">DETAIL A – HOOK CONNECTION</text>`;
    g += nestSVG(dsvg, bx0 + 10, by0 + 50, bw - 20, bh - 60);
    const lines = [bd ? `${cr.label ? cr.label + ": " : ""}${blockName(bd)} SWL ${fx(bd.cap, 0)} t, ${bd.parts} falls` : "Crane hook", ...(res.hornX && !(ld.rig.top || []).length ? ["Top sling eyes straight on the hook – one on each horn"] : res.hornX ? [res.hornJoin ? "One master link on each horn, joined below by one shackle" : "One master link on each horn – none in the middle"] : []), ...topR.map(r => `(${r.no}) ${r.name} × ${r.qty} – SWL ${fmtT(r.swl)} t`)];
    { const wl = lines.flatMap(t => wrapLines(t, Math.floor((bw - 24) / 10))); lines.length = 0; lines.push(...wl); }
    lines.forEach((t, i) => g += `<text x="${bx0 + 14}" y="${by0 + bh + 30 + i * 24}" font-size="19" fill="#16202a">${e(t)}</text>`);
    // DETAIL B – the lifting lug on the load (when the vendor's lug data is in the load)
    if (+ld.lugHole > 0 && typeof cadLugDetail === "function") g += cadLugDetail(ld, res, bx0, by0 + bh + 40 + lines.length * 24 + 30, bw, 390);
    // mark detail on the front view
    const [hx, hy] = fv.map(hp[0], hp[2]); g += `<circle cx="${hx}" cy="${hy}" r="70" fill="none" stroke="#16202a" stroke-width="2" stroke-dasharray="10 6"/><text x="${hx - 90}" y="${hy - 50}" font-size="26" font-weight="700" fill="#16202a">A</text>`;
  }
  if (ld._photoData) g += `<rect x="${W - M - 470}" y="${bandY - 380}" width="440" height="340" fill="#fff" stroke="#16202a" stroke-width="2"/><image href="${ld._photoData}" x="${W - M - 465}" y="${bandY - 375}" width="430" height="300" preserveAspectRatio="xMidYMid meet"/><text x="${W - M - 460}" y="${bandY - 52}" font-size="18" fill="#566476">PHOTO / REFERENCE (not to scale)</text>`;
  // schedule table
  // parts list – a gridded CAD schedule matching the balloon numbers
  const tx = M + 20, ty0 = bandY + 24, cw = [70, 80, 900, 170, 190], heads = ["ITEM", "QTY", "DESCRIPTION", "WLL (t)", "UNIT WT (~kg)"], TW = cw.reduce((a, b) => a + b, 0);
  const rowsT = res.rows.filter(r => r.name), rh = Math.max(24, Math.min(36, Math.floor((H - M - 70 - ty0) / (rowsT.length + 1)))), shown = rowsT;   // every item listed – rows get tighter if needed
  g += `<rect x="${tx}" y="${ty0}" width="${TW}" height="${rh}" fill="#e9edf1"/>`;
  let x = tx; heads.forEach((h, i) => { g += `<text x="${i >= 3 ? x + cw[i] - 10 : i < 2 ? x + cw[i] / 2 : x + 8}" y="${ty0 + 25}" font-size="18" font-weight="700" fill="#111" text-anchor="${i >= 3 ? "end" : i < 2 ? "middle" : "start"}">${h}</text>`; x += cw[i]; });
  let ry = ty0 + rh;
  for (const r of shown) {
    const vals = [r.no, r.qty, r.name, fmtT(r.swl), r.unitW ? fx(r.unitW * 1000, 0) : "–"];
    x = tx; vals.forEach((v, i) => { g += `<text x="${i < 2 ? x + cw[i] / 2 : i >= 3 ? x + cw[i] - 10 : x + 8}" y="${ry + 25}" font-size="19" fill="#111" text-anchor="${i < 2 ? "middle" : i >= 3 ? "end" : "start"}">${e(String(v)).slice(0, 80)}</text>`; x += cw[i]; });
    ry += rh;
  }
  { const sw = CAD.px(CAD.lw.thin).toFixed(2); g += `<rect x="${tx}" y="${ty0}" width="${TW}" height="${ry - ty0}" fill="none" stroke="#111" stroke-width="${CAD.px(CAD.lw.mid).toFixed(2)}"/>`;
    for (let yy = ty0 + rh; yy < ry; yy += rh) g += `<line x1="${tx}" y1="${yy}" x2="${tx + TW}" y2="${yy}" stroke="#111" stroke-width="${sw}"/>`;
    let xx = tx; cw.slice(0, -1).forEach(c => { xx += c; g += `<line x1="${xx}" y1="${ty0}" x2="${xx}" y2="${ry}" stroke="#111" stroke-width="${sw}"/>`; }); }
  const tot = (+ld.weight || 0) + res.weight;
  const notes = [...(ld.approx && Object.keys(ld.approx).length ? [`~ = APPROXIMATE: ${upUnits(Object.entries(ld.approx).map(([k, v]) => `${({ span: "lifting points along", spanY: "lifting points across", lpZ: "lifting point height" })[k] || k} – ${v}`).join("; "))}`] : []), `LOAD ${fmtT(+ld.weight)} t + RIGGING ~${fmtT(res.weight)} t (catalogue weights) = ~${fmtT(tot)} t BELOW THE HOOK`, ...cranes.map(c => { const C = REG.cranes[c.model], bd = C ? blockDims(c, C) : null; return bd ? `${c.label ? c.label + ": " : ""}${C.short} · ${blockName(bd)} SWL ${fx(bd.cap, 0)} t (${fx(+c.hookBlock, 2)} t) · ${bd.parts} falls` : ""; }), ...res.warn.map(w => "CHECK: " + w)].filter(Boolean);
  // notes beside the parts list (clear of it however many items there are)
  { let ny = ty0 + 24; const nx = tx + TW + 30; for (const n of notes.slice(0, 6)) for (const l of wrapLines(n, 80)) { if (ny > H - M - 20) break; g += `<text x="${nx}" y="${ny}" font-size="19" fill="${n.startsWith("CHECK") ? "#b42318" : "#566476"}">${e(l)}</text>`; ny += 25; } }
  // title block
  g += tbBlock({ W, H, M, lift: liftNoBox(sheetCtx?.lift ?? liftNo(plan.al)), sheet: sheetCtx?.sheet ?? "2", team: true });

  return g + "</svg>";
}

// keep the uploaded picture with the load (asset store in Claude, a small data URL elsewhere)
async function keepPhoto(blob) {
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(blob); });
    const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas"); c.width = img.naturalWidth * k; c.height = img.naturalHeight * k; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const small = await new Promise(r => c.toBlob(r, "image/jpeg", 0.82));
    if (CAP.assets && !CAP.local) { const a = await CAP.assets.upload(new File([small], "load-photo.jpg", { type: "image/jpeg" })); return { photoAsset: a.id, photoUrl: "/_blob/" + a.id }; }
    return { photoUrl: c.toDataURL("image/jpeg", 0.8) };
  } catch (e) { return {}; }
}
async function attachPhotoOnly(files) {
  const images = await toImages(files); if (!images.length) return;
  Object.assign(LB.ld, await keepPhoto(images[0])); renderLB();
  const st = $("lbAi"); st.hidden = false; st.className = "status ok"; st.textContent = "Picture attached to the load. Reading it automatically needs Claude (✦ Link Claude at the top) – enter the size and weight from the picture.";
}

// ---- tap a component in the preview to edit it
const partKey = pt => `${pt.key}:${pt.i}`;
function addRigHits(svgEl, ld, res) {
  const R = ld.rig, H = RB.hits || {}, NS = "http://www.w3.org/2000/svg", g = document.createElementNS(NS, "g");
  const sel = RB.edit ? `${RB.edit.key}:${RB.edit.i}` : null, ts = Math.max(0.18, Math.max(loadDims(ld).x, loadDims(ld).z, res.hookZ) * 0.035);
  const add = (tag, attrs, key) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); el.setAttribute("data-part", key); el.style.cursor = "pointer"; g.appendChild(el); return el; };
  const hl = key => ({ stroke: "transparent" });
  const mark = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); el.setAttribute("pointer-events", "none"); g.appendChild(el); };
  // slings: whole segment is touchable, in both views
  const segList = gg => (R.leg || []).includes(gg.e) ? "leg" : (R.lower || []).includes(gg.e) ? "lower" : null;
  for (const [ox, view] of [[H.ox || 0, "side"], [H.endOx || 0, "end"]]) {
    for (const gg of res.seg) {
      const key0 = segList(gg); if (!key0) continue; const list = R[key0], i = list.indexOf(gg.e), key = `${key0}:${i}`;
      const U = p => ox + (view === "end" ? p[1] : p[0]);
      if (key === sel) mark("line", { x1: U(gg.a), y1: -gg.a[2], x2: U(gg.b), y2: -gg.b[2], "stroke-width": ts * 0.45, stroke: "#d9661f", "stroke-opacity": "0.6", "stroke-linecap": "round" });
      add("line", { x1: U(gg.a), y1: -gg.a[2], x2: U(gg.b), y2: -gg.b[2], "stroke-width": ts * 1.6, "stroke-linecap": "round", fill: "none", ...hl(key) }, key);
    }
    if (res.beam && R.beam) { const U = p => ox + (view === "end" ? p[1] : p[0]); const x0 = Math.min(U(res.beam.a), U(res.beam.b)) - 0.2, x1 = Math.max(U(res.beam.a), U(res.beam.b)) + 0.2; if (sel === "beam:0") mark("rect", { x: x0, y: -(res.beam.a[2] + res.beam.h + 0.15), width: x1 - x0, height: res.beam.h + 0.3, fill: "none", stroke: "#d9661f", "stroke-width": ts * 0.25 }); add("rect", { x: x0, y: -(res.beam.a[2] + res.beam.h + 0.15), width: x1 - x0, height: res.beam.h + 0.3, fill: "transparent", "stroke-width": ts * 0.5, ...hl("beam:0") }, "beam:0"); }
  }
  for (const pt of rigParts(ld, res)) {
    const key = partKey(pt), ox = H.ox || 0;
    if (pt.entry && !RIG_TYPES[pt.entry.snap.type]?.sling && pt.key !== "beam") { if (key === sel) mark("circle", { cx: ox + pt.p[0], cy: -pt.p[2], r: ts * 0.7, fill: "none", stroke: "#d9661f", "stroke-width": ts * 0.2 }); add("circle", { cx: ox + pt.p[0], cy: -pt.p[2], r: ts * 0.9, fill: "transparent", "stroke-width": ts * 0.4, ...hl(key) }, key); }
  }
  for (const ch of RB.craneHits || []) { const key = "crane:" + ch.id; if (RB.edit?.key === "crane" && RB.edit.id === ch.id) mark("rect", { x: ch.x0, y: -ch.z1, width: ch.x1 - ch.x0, height: ch.z1 - ch.z0, fill: "none", stroke: "#d9661f", "stroke-width": ts * 0.2, rx: ts * 0.3 }); add("rect", { x: ch.x0, y: -ch.z1, width: ch.x1 - ch.x0, height: ch.z1 - ch.z0, fill: "transparent", "stroke-width": ts * 0.3, stroke: "transparent" }, key); }
  for (const c of H.co || []) add("circle", { cx: c.cx, cy: -c.cz, r: RB.edit && partKey(c) === sel ? ts * 1.05 : ts * 0.95, fill: partKey(c) === sel ? "rgba(217,102,31,.25)" : "transparent", "stroke-width": ts * 0.3, stroke: partKey(c) === sel ? "#d9661f" : "transparent" }, partKey(c));
  // drag handles: where the rigging connects to the load, and the spreader beam ends
  const dh = (x, z, kind, idx) => { const el = document.createElementNS(NS, "circle"); const r = ts * 0.5; Object.entries({ cx: x, cy: -z, r, fill: "rgba(255,255,255,0.01)", stroke: "#d9661f", "stroke-width": ts * 0.16, "stroke-dasharray": `${ts * 0.3} ${ts * 0.2}` }).forEach(([k, v]) => el.setAttribute(k, v)); el.setAttribute("data-drag", kind); el.setAttribute("data-idx", idx); el.style.cursor = "move"; g.appendChild(el); };
  const onLoad = res.lpPts || res.shk.slice(res.nTop || 0);
  onLoad.forEach((p, i) => { dh((H.ox || 0) + p[0], p[2], "lp", i); if (+ld.spanY > 0 && Math.abs(p[1]) > 0.01 && p[0] > 0) dh((H.endOx || 0) + p[1], p[2], "lpy", i); });
  if (res.beam) for (const q of [res.beam.a, res.beam.b]) dh((H.ox || 0) + q[0], q[2] + res.beam.h / 2, "beamend", 0);
  const tip = document.createElementNS(NS, "text"); tip.setAttribute("font-size", ts * 1.1); tip.setAttribute("font-weight", "700"); tip.setAttribute("fill", "#d9661f"); tip.setAttribute("pointer-events", "none"); g.appendChild(tip);
  let dragEl = null;
  const toW = ev => { const pt = svgEl.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const q = pt.matrixTransform(svgEl.getScreenCTM().inverse()); return [q.x, -q.y]; };
  const dz = loadDims(ld), cog = +ld.cog || 0;
  const valFor = (kind, w) => {
    if (kind === "lp") { const x = w[0] - (H.ox || 0); return { span: Math.round(Math.max(0, 2 * Math.abs(x - (R.arr === "single" ? x : 0))) * 20) / 20, lpZ: Math.round(Math.max(0, Math.min(dz.z, w[1])) * 20) / 20 }; }
    if (kind === "lpy") return { spanY: Math.round(Math.max(0.1, 2 * Math.abs(w[0] - (H.endOx || 0))) * 20) / 20 };
    return { beam: Math.round(Math.max(0.5, 2 * Math.abs(w[0] - (H.ox || 0) - cog)) * 20) / 20 };
  };
  g.addEventListener("pointerdown", ev => { const el = ev.target.closest("[data-drag]"); if (!el) return; ev.stopPropagation(); ev.preventDefault(); dragEl = el; svgEl.setPointerCapture(ev.pointerId); });
  svgEl.addEventListener("pointermove", ev => {
    if (!dragEl) return; const w = toW(ev), r = ts * 0.55, kind = dragEl.dataset.drag;
    dragEl.setAttribute("x", w[0] - r); dragEl.setAttribute("y", -w[1] - r);
    const v = valFor(kind, w); tip.setAttribute("x", w[0] + ts); tip.setAttribute("y", -w[1] - ts);
    tip.textContent = kind === "lp" ? (R.arr === "single" ? `height ${fx(v.lpZ, 2)} m` : `A–B ${fx(v.span, 2)} m · height ${fx(v.lpZ, 2)} m`) : kind === "lpy" ? `across ${fx(v.spanY, 2)} m` : `beam span ${fx(v.beam, 2)} m`;
  });
  svgEl.addEventListener("pointerup", ev => {
    if (!dragEl) return; const kind = dragEl.dataset.drag, v = valFor(kind, toW(ev)); dragEl = null;
    if (kind === "lp") { if (R.arr !== "single" && R.arr !== "tandem" || R.arr === "tandem") { if (R.arr !== "single") { RB.work.span = v.span; RB.work.spanSet = true; } } RB.work.lpType = "custom"; RB.work.lpZ = v.lpZ; }
    else if (kind === "lpy") RB.work.spanY = v.spanY;
    else if (R.beam) R.beam.len = R.beam.snap.pad ? R.beam.snap.pad.low[nearIdx(R.beam.snap.pad.low, v.beam)] : v.beam;
    delete R.auto; RB.suppressClick = true; setTimeout(() => RB.suppressClick = false, 50); renderRB();
  });
  svgEl.appendChild(g);
  g.addEventListener("click", ev => { const el = ev.target.closest("[data-part]"); if (!el) return; ev.stopPropagation(); const [key, i] = el.dataset.part.split(":"); RB.edit = key === "crane" ? { key, id: i, x: ev.clientX, y: ev.clientY } : { key, i: +i, x: ev.clientX, y: ev.clientY }; renderRB(); });
}
function renderRigPop(svgEl, ld, res) {
  const host = $("rbPrev"); let pop = $("rbPop");
  if (!RB.edit) { if (pop) pop.remove(); return; }
  if (RB.edit.key === "crane") return craneHookPop(host, pop, ld);
  const R = ld.rig, list = RB.edit.key === "beam" ? null : R[RB.edit.key], e = RB.edit.key === "beam" ? R.beam : list?.[RB.edit.i];
  if (!e) { RB.edit = null; if (pop) pop.remove(); return; }
  if (!pop) { pop = document.createElement("div"); pop.id = "rbPop"; host.appendChild(pop); }
  const sl = RIG_TYPES[e.snap.type]?.sling, row = res?.rows.find(r => r.entry === e);
  const fam = t => RIG_TYPES[t]?.sling ? "sling" : t;
  const filter = it => RB.edit.key === "beam" ? it.type === "spreader" : fam(it.type) === fam(e.snap.type) || RB.edit.key !== "beam";
  const where = { top: "On the crane hook", leg: R.arr === "spreader" ? "Top legs" : R.arr === "tandem" ? "Each crane's rigging" : "Legs", lower: "Lower legs", beam: "Spreader beam", pad: "At each bottom padeye", drop: "Drops" }[RB.edit.key];
  pop.innerHTML = `<div class="ph"><b>${row ? row.no + ". " : ""}${escH(RIG_TYPES[e.snap.type]?.name || "Component")}</b><span class="small">${where}</span><button id="rpX" title="Close">×</button></div>
    <label>Item<select id="rpItem">${rigItem(e.id) ? "" : `<option selected>${escH(e.snap.name)}</option>`}${itemOptions(e.id, filter)}</select></label>
    ${RB.edit.key === "beam" && e.snap.pad ? `<div class="row">${padSelects(e, "rp")}</div>${padTable(e)}` : ""}
    <div class="row" ${RB.edit.key === "beam" && e.snap.pad ? "hidden" : ""}>${sl || RB.edit.key === "beam" ? `<label>${RB.edit.key === "beam" ? "Span" : "Length"} (m)<input type="number" id="rpLen" step="0.1" value="${e.len ?? e.snap.len ?? 3}"></label>` : `<label>Qty${RB.edit.key === "top" ? "" : " (per leg)"}<select id="rpQty" ${RB.edit.key === "top" ? "" : "disabled"}>${[1, 2, 3, 4].map(n => `<option ${n === (e.qty || 1) ? "selected" : ""}>${n}</option>`).join("")}</select></label>`}
      ${sl ? `<label>Hitch<select id="rpHitch">${hitchOptions(e)}</select></label>` : "<span></span>"}</div>
    ${sl && ((e.hitch || e._hitchAuto) === "basket") && (RB.edit.key === "lower" || (RB.edit.key === "leg" && RB.work.rig.arr !== "spreader")) ? `<label>Basket goes round<select id="rpBOn"><option value="">Auto – ${e._bOnAuto === "outside" ? "the whole load" : "the trunnion"}</option><option value="trunnion" ${e.bOn === "trunnion" ? "selected" : ""}>The trunnion / centre hub (mid-height)</option><option value="outside" ${e.bOn === "outside" ? "selected" : ""}>The OUTSIDE of the whole load</option></select></label>` : ""}
    <div class="row"><label>SWL (t)<input type="number" id="rpSwl" step="0.01" value="${+e.snap.swl}"></label>${sl ? `<label>Weight (kg/m)<input type="number" id="rpWpm" step="0.1" value="${+((e.snap.wpm || 0) * 1000).toFixed(2)}"></label>` : `<label>Weight (kg)<input type="number" id="rpW" step="0.1" value="${+((e.snap.weight || 0) * 1000).toFixed(1)}"></label>`}</div>
    ${row ? `<p class="small">Load ${fmtT(row.load)} t · <span class="pill ${row.util > 100 ? "bad" : row.util > 80 ? "amber" : "ok"}">${row.util == null ? "–" : row.util.toFixed(0) + "% of SWL"}</span>${row.where ? " · " + escH(row.where) : ""}</p>` : ""}
    <div class="btnrow">${RB.edit.key === "beam" ? "" : `<button id="rpAddA">+ Add below</button><button id="rpDel" class="danger">Remove</button>`}<button id="rpSize">Size to suit</button></div>`;
  // place next to the tapped point
  const hr = host.getBoundingClientRect(), px = (RB.edit.x ?? hr.left + hr.width / 2) - hr.left, py = (RB.edit.y ?? hr.top + 40) - hr.top;
  pop.style.left = Math.max(6, Math.min(hr.width - 290, px + 14)) + "px"; pop.style.top = Math.max(6, Math.min(hr.height - pop.offsetHeight - 6, py - 30)) + "px";
  const done = () => { delete R.auto; renderRB(); };
  $("rpX").onclick = () => { RB.edit = null; renderRB(); };
  $("rpItem").onchange = ev => { const it = rigItem(ev.target.value); if (!it) return; const ne = rigEntry(it, { qty: e.qty, hitch: e.hitch }); ne.len = RIG_TYPES[it.type]?.sling ? (sl ? e.len : 3) : (it.type === "spreader" ? (it.pad ? ne.len : (e.len || it.len)) : it.len); if (RB.edit.key === "beam") R.beam = ne; else list[RB.edit.i] = ne; done(); };
  if ($("rpLen")) $("rpLen").onchange = ev => { e.len = +ev.target.value; done(); };
  if ($("rpPadTop")) $("rpPadTop").onchange = ev => { e.top = +ev.target.value; done(); };
  if ($("rpPadLow")) $("rpPadLow").onchange = ev => { e.len = +ev.target.value; done(); };
  if ($("rpQty")) $("rpQty").onchange = ev => { e.qty = +ev.target.value; done(); };
  if ($("rpHitch")) $("rpHitch").onchange = ev => { const [h, bf] = ev.target.value.split(":"); e.hitch = h; if (bf) e.bf = +bf; else delete e.bf; basketShackleUp(list, e); done(); };
  if ($("rpBOn")) $("rpBOn").onchange = ev => { if (ev.target.value) e.bOn = ev.target.value; else delete e.bOn; done(); };
  if ($("rpBf")) $("rpBf").onchange = ev => { if (ev.target.value) e.bf = +ev.target.value; else delete e.bf; done(); };
  $("rpSwl").onchange = ev => { e.snap.swl = +ev.target.value; done(); };
  if ($("rpW")) $("rpW").onchange = ev => { e.snap.weight = (+ev.target.value || 0) / 1000; done(); };
  if ($("rpWpm")) $("rpWpm").onchange = ev => { e.snap.wpm = (+ev.target.value || 0) / 1000; done(); };
  if ($("rpDel")) $("rpDel").onclick = () => { list.splice(RB.edit.i, 1); RB.edit = null; done(); };
  if ($("rpAddA")) $("rpAddA").onclick = () => { const it = pickItem("shackle", row ? row.load : 5, std); list.splice(RB.edit.i + 1, 0, rigEntry(it)); RB.edit = { ...RB.edit, i: RB.edit.i + 1 }; done(); };
  $("rpSize").onclick = () => { const need = (row ? row.load : 1) / 0.9 / (sl ? (HITCH[e.hitch || "straight"]?.f || 1) : 1); const it = rigLibrary().filter(x => x.type === e.snap.type && x.swl >= need).sort((a, b) => a.swl - b.swl)[0]; if (it) { const ne = rigEntry(it, { qty: e.qty, hitch: e.hitch, len: sl || e.snap.type === "spreader" ? e.len : it.len }); if (RB.edit.key === "beam") R.beam = ne; else list[RB.edit.i] = ne; } done(); };
}

// ---- the crane side of the connection: hook block type, block size, parts of line, which end in a tandem
function craneHookPop(host, pop, ld) {
  const cr = plan.cranes.find(c => c.id === RB.edit.id), C = cr ? REG.cranes[cr.model] : null;
  if (!cr || !C) { RB.edit = null; if (pop) pop.remove(); return; }
  if (!pop) { pop = document.createElement("div"); pop.id = "rbPop"; host.appendChild(pop); }
  const bd = blockDims(cr, C), others = plan.cranes.filter(c => c.attach?.load === ld.id && c.id !== cr.id);
  const hbs = C.hookblocks || [], S = craneSummary(cr);
  pop.innerHTML = `<div class="ph"><b>${escH(cr.label)} hook block</b><span class="small">${escH(C.short)}</span><button id="rpX" title="Close">×</button></div>
    <div class="btypes">${Object.entries(BLOCK_TYPES).map(([k, n]) => `<button class="btype" data-cbt="${k}" aria-pressed="${bd.type === k}">${blockIcon(k)}<span>${n}</span></button>`).join("")}</div>
    <label>Hook block<select id="cpHb">${hbs.map(([cap, w]) => `<option value="${w}" ${Math.abs(w - cr.hookBlock) < 1e-6 ? "selected" : ""}>${cap} t block · ${w} t</option>`).join("")}</select></label>
    <div class="row"><label>Parts of line<select id="cpParts">${Array.from({ length: 16 }, (_, i) => i + 1).map(n => `<option ${n === bd.parts ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    <label>Max line pull (t)<input type="number" id="cpLp" step="0.1" value="${cr.linePull ?? ""}" placeholder="optional"></label></div>
    <p class="small">${fx(S.TW, 2)} t at the hook · ${fx(S.TW / bd.parts, 2)} t per fall${S.TW > bd.cap ? ` · <b style="color:var(--bad)">over the ${fx(bd.cap)} t block</b>` : ""}</p>
    ${others.length ? `<div class="btnrow"><button id="cpSwap">Swap ends with ${escH(others[0].label)}</button></div><p class="small">Now on ${cr.attach.point === "B" ? "end B" : "end A"}.</p>` : ""}`;
  const hr = host.getBoundingClientRect(), px = (RB.edit.x ?? hr.left + 60) - hr.left, py = (RB.edit.y ?? hr.top + 40) - hr.top;
  pop.style.left = Math.max(6, Math.min(hr.width - 290, px + 14)) + "px"; pop.style.top = Math.max(6, Math.min(hr.height - pop.offsetHeight - 6, py - 30)) + "px";
  const apply = fn => { fn(); markDirty(); renderAll(true); renderRB(); };
  $("rpX").onclick = () => { RB.edit = null; renderRB(); };
  pop.querySelectorAll("[data-cbt]").forEach(b => b.onclick = () => apply(() => { cr.blockType = b.dataset.cbt; cr.btSet = true; }));
  $("cpHb").onchange = e => apply(() => { cr.hookBlock = +e.target.value; const hb = hbs.find(h => Math.abs(h[1] - cr.hookBlock) < 1e-6); if (hb) { cr.blockCap = hb[0]; if (!cr.partsSet) cr.parts = defaultParts(hb[0]); if (!cr.btSet) cr.blockType = hb[0] >= 100 ? "ramshorn" : "single"; } });
  $("cpParts").onchange = e => apply(() => { cr.parts = +e.target.value; cr.partsSet = true; });
  $("cpLp").onchange = e => apply(() => { cr.linePull = e.target.value === "" ? "" : +e.target.value; });
  if ($("cpSwap")) $("cpSwap").onclick = () => apply(() => { const o = others[0], a = cr.attach.point; cr.attach.point = o.attach.point; o.attach.point = a; });
}

// ---------- spreader bars with several padeye positions ----------
function padSelects(e, pfx) {
  const pad = e?.snap?.pad; if (!pad) return "";
  const pr = padRating(pad, +e.top || pad.top[0], +e.len || pad.low[0]);
  const idT = pfx ? ` id="${pfx}PadTop"` : ` data-f="top"`, idL = pfx ? ` id="${pfx}PadLow"` : ` data-f="len"`;
  return `<label>Upper padeyes (sling span)<select${idT}>${pad.top.map((v, i) => `<option value="${v}" ${i === pr.iu ? "selected" : ""}>${fx(v, 3)} m – case ${escH(pad.names?.[i] || String.fromCharCode(65 + i))}</option>`).join("")}</select></label>
    <label>Lower padeyes (load span) · rated <b>${fx(pr.cap)} t</b><select${idL}>${pad.low.map((v, i) => `<option value="${v}" ${i === pr.il ? "selected" : ""}>${fx(v, 3)} m – ${fx(+pad.cap[pr.iu][i])} t</option>`).join("")}</select></label>`;
}
function padTable(e) {
  const pad = e?.snap?.pad; if (!pad) return "";
  const pr = padRating(pad, +e.top || pad.top[0], +e.len || pad.low[0]);
  return `<details class="small" style="margin-top:4px"><summary>Rating table – upper padeyes × lower padeyes (t)</summary><table class="rtab" style="margin-top:4px"><tr><th>Case / upper</th>${pad.low.map(v => `<th class="n">low ${fx(v, 3)} m</th>`).join("")}</tr>
    ${pad.top.map((t, i) => `<tr><td>${escH(pad.names?.[i] || String.fromCharCode(65 + i))} · ${fx(t, 3)} m</td>${pad.low.map((l, j) => `<td class="n" style="${i === pr.iu && j === pr.il ? "font-weight:700;background:var(--okbg)" : ""}">${fx(+pad.cap[i][j])}</td>`).join("")}</tr>`).join("")}</table>
    ${pad.maxAngle ? `<p style="margin:4px 0 0">Max sling angle ${pad.maxAngle}° from vertical.${pad.topShk ? " Upper shackles: " + escH(pad.topShk[pr.iu] || "") + "; lower: " + escH(pad.lowShk || "") : ""}</p>` : ""}${e.snap.drawing ? `<p style="margin:4px 0 0"><a href="${escH(e.snap.drawing)}" target="_blank" rel="noopener">View the drawing</a></p>` : ""}</details>`;
}

async function keepDrawing(blob) {
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(blob); });
    const k = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas"); c.width = img.naturalWidth * k; c.height = img.naturalHeight * k; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
    if (CAP.assets && !CAP.local) { const a = await CAP.assets.upload(new File([b], "rigging-drawing.jpg", { type: "image/jpeg" })); return "/_blob/" + a.id; }
    return c.toDataURL("image/jpeg", 0.8);
  } catch (e) { return null; }
}
