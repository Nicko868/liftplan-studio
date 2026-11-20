// ================= Rigging list: every rigging arrangement in the plan, shown exactly as on the PDF sheet =================
const RLV = { list: [], i: 0, full: true };
function rigListEntries() {
  syncLift(); const seen = new Map(), out = [];
  plan.lifts.forEach((L, i) => withLift(i, () => { for (const ld of L.loads) { if (!rigShown(ld, L.cranes)) continue; ensureRig(ld); const k = rigSignature(ld); if (seen.has(k)) { seen.get(k).idx.push(i); continue; } const E = { i, ldId: ld.id, idx: [i], name: ld.name, rig: rigName(ld.rig) }; seen.set(k, E); out.push(E); } }));
  return out;
}
function rigListSVG(E) {
  let svg = null; const keep = sheetCtx;
  withLift(E.i, L => { const ld = L.loads.find(x => x.id === E.ldId); if (!ld) return; sheetCtx = { sheet: `${RLV.list.indexOf(E) + 1} of ${RLV.list.length}`, lift: E.idx.length > 1 ? liftRangeLabel(E.idx) : L.name };
    const pa = plan.al; plan.al = E.i; try { svg = rigSheetSVG(ld); } finally { plan.al = pa; } });
  sheetCtx = keep; return svg;
}
function renderRigList() {
  const E = RLV.list[RLV.i];
  $("rlPick").innerHTML = RLV.list.map((x, k) => `<option value="${k}" ${k === RLV.i ? "selected" : ""}>${escH((x.idx.length > 1 ? liftRangeLabel(x.idx) : plan.lifts[x.i].name) + " · " + x.name + " – " + x.rig)}</option>`).join("");
  $("rlPick").hidden = RLV.list.length < 2;
  $("rlMsg").textContent = !E ? "No rigging yet – hook a crane onto a load, then set up its rigging." : RLV.list.length > 1 ? `${RLV.list.length} different rigging arrangements in this plan – pick one above.` : plan.lifts.length > 1 ? `One rigging arrangement for ${liftRangeLabel(E.idx)}.` : "";
  if (!E) { $("rlSheet").innerHTML = ""; return; }
  $("rlVSheet").setAttribute("aria-pressed", String(!RLV.full)); $("rlVFull").setAttribute("aria-pressed", String(!!RLV.full));
  $("rlSheet").hidden = !!RLV.full; $("rlFull").hidden = !RLV.full;
  if (RLV.full) { $("rlFull").innerHTML = rigFullHTML(E); return; }
  const svg = rigListSVG(E); $("rlSheet").innerHTML = svg ? svg.replace(/^<svg /, '<svg style="width:100%;height:auto;display:block" ').replace(/ width="\d+" height="\d+"/, "") : "";
}
function openRigList() { RLV.list = rigListEntries(); RLV.i = Math.min(RLV.i, Math.max(0, RLV.list.length - 1)); renderRigList(); $("dRigList").showModal(); }
$("bRigList").onclick = openRigList;
$("rlPick").onchange = e => { RLV.i = +e.target.value; renderRigList(); };
$("rlEdit").onclick = () => { const E = RLV.list[RLV.i]; if (E) rigEditFromList(E, 0); };
$("rlPng").onclick = async () => { const E = RLV.list[RLV.i]; if (!E) return; const svg = rigListSVG(E); if (!svg) return; const { blob } = await svgToPng(svg, 1, "#ffffff"); save(`${fbase()}_rigging_${(E.idx.length > 1 ? liftRangeLabel(E.idx) : plan.lifts[E.i].name).replace(/[^\w\-]+/g, "_")}.png`, blob); };
// the rigging dialog: refresh the list if it is open behind
{ const _sv = $("rbSave").onclick; $("rbSave").onclick = function (...a) { const r = _sv.apply(this, a); if ($("dRigList").open) { RLV.list = rigListEntries(); renderRigList(); } return r; }; }

// the full engineering breakdown – app only (the PDF keeps just item, quantity and SWL). Drawn like the sheet, on a dark "blueprint" board,
// with one live card per component; click a card (or its number in the drawing) to edit that item in the rigging editor.
function rigFullHTML(E) {
  let h = "";
  const lifts = E.idx.map(i => plan.lifts[i].name);
  withLift(E.i, L => {
    const ld = L.loads.find(x => x.id === E.ldId); if (!ld) return; const res = solveRig(ld); if (!res) return;
    const sc = rigPreviewScene(ld, res), svg = toSVG(sc, { pad: 0.8, noSize: true, lw: 0.05 }).replace(/^<svg /, '<svg class="engsvg" ');
    const maxU = Math.max(0, ...res.rows.map(r => r.util || 0)), tot = (+ld.weight || 0) + res.weight, d = loadDims(ld);
    const col = u => u == null ? "#7f8c8d" : u > 100 ? "#ff5d5d" : u > 80 ? "#ffb547" : "#3ddc97";
    const parts = rigParts(ld, res);
    h += `<div class="eng">
      <div class="engtop"><div><div class="engk">Rigging arrangement</div><div class="engv">${escH(ld.name)} – ${escH(rigName(ld.rig))}</div><div class="engs">${escH(lifts.length > 1 ? liftRangeLabel(E.idx) : lifts[0])}${ld.rig.auto ? ` · <b style="color:#ffb547">suggested – not confirmed</b>` : ""}</div></div>
        <button class="engbtn" data-engedit="">Edit rigging…</button></div>
      <div class="engkpis">
        <div class="kpi"><div class="engk">Below the hook</div><div class="kv">${fmtT(tot)}<small> t</small></div><div class="engs">load ${fmtT(+ld.weight)} + rigging ${fmtT(res.weight)}</div></div>
        <div class="kpi"><div class="engk">Highest use</div><div class="kv" style="color:${col(maxU)}">${maxU ? maxU.toFixed(0) : "–"}<small>%</small></div><div class="engbar"><i style="width:${Math.min(100, maxU)}%;background:${col(maxU)}"></i></div></div>
        <div class="kpi"><div class="engk">Hook above load</div><div class="kv">${fx(res.hookZ - d.z, 2)}<small> m</small></div><div class="engs">hook ${fx(res.hookZ, 2)} m above load bottom</div></div>
        <div class="kpi"><div class="engk">Checks</div><div class="kv" style="color:${res.warn.length ? "#ff5d5d" : "#3ddc97"}">${res.warn.length ? res.warn.length + " ⚠" : "OK"}</div><div class="engs">${res.warn.length ? "see warnings below" : "no rigging warnings"}</div></div>
      </div>
      <div class="engbody"><div class="engdraw">${svg}</div>
        <div class="engcards">${res.rows.map(r => { const pt = parts.find(q => q.row === r.no), u = r.util;
          return `<button class="engcard" data-engrow="${r.no}" ${pt ? "" : "disabled"}><div class="engno">${r.no}</div><div class="engmain"><div class="engname">${escH(r.name)} <span class="engq">× ${r.qty}</span></div>
            <div class="engnums"><span>SWL <b>${fmtT(r.swl)}</b> t</span><span>load <b>${fmtT(r.load)}</b> t</span><span>${fx(r.weight * 1000, 0)} kg</span><span style="color:${col(u)}"><b>${u == null ? "–" : u.toFixed(0) + "%"}</b></span></div>
            <div class="engbar"><i style="width:${Math.min(100, u || 0)}%;background:${col(u)}"></i></div>
            ${r.where ? `<div class="engwhere">${escH(r.where)}</div>` : ""}</div><div class="engedit">edit ›</div></button>`; }).join("")}</div></div>
      ${res.notes.length || res.warn.length ? `<div class="engnotes">${res.warn.map(w => `<div class="engw">⚠ ${escH(w)}</div>`).join("")}${res.notes.map(n => `<div class="engn">ℹ ${escH(n)}</div>`).join("")}</div>` : ""}
    </div>`;
  });
  return h || `<p class="small">No rigging to show.</p>`;
}
function rigEditFromList(E, rowNo) {
  $("dRigList").close(); if (E.i !== plan.al) switchLift(E.i);
  const ld = plan.loads.find(x => x.id === E.ldId); if (!ld) return; openRigBuilder(ld);
  if (rowNo) { const pt = rigParts(RB.work, solveRig(RB.work)).find(p => p.row === rowNo); if (pt) { const r = $("rbPrev").getBoundingClientRect(); RB.edit = { key: pt.key, i: pt.i, x: r.left + r.width * 0.55, y: r.top + 60 }; renderRB(); } }
}
$("rlFull").addEventListener("click", e => {
  const E = RLV.list[RLV.i]; if (!E) return;
  const c = e.target.closest("[data-engrow]"); if (c) { rigEditFromList(E, +c.dataset.engrow); return; }
  if (e.target.closest("[data-engedit]")) rigEditFromList(E, 0);
});
$("rlVSheet").onclick = () => { RLV.full = false; renderRigList(); };
$("rlVFull").onclick = () => { RLV.full = true; renderRigList(); };

// ---- one rigging arrangement shared by several lifts: editing it updates every lift that uses it (untick to change just this lift)
const RIG_FIELDS = ["span", "spanSet", "spanY", "cog", "lpType", "lpZ"];
{ const _open = openRigBuilder;
  openRigBuilder = function (ld, ...a) {
    RB.sibs = [];
    try { syncLift(); const sig = rigSignature(ld);
      plan.lifts.forEach((L, i) => { if (i === plan.al) return; withLift(i, () => { for (const x of L.loads) if (x !== ld && rigShown(x, L.cranes) && rigSignature(x) === sig) RB.sibs.push({ i, id: x.id }); }); });
    } catch (e) { console.warn(e); }
    const r = _open.call(this, ld, ...a);
    const idx = [...new Set([plan.al, ...RB.sibs.map(s => s.i)])].sort((x, y) => x - y);
    $("rbAllWrap").hidden = !RB.sibs.length; $("rbAll").checked = true;
    if (RB.sibs.length) $("rbAllTxt").textContent = `Apply to all lifts with this rigging (${liftRangeLabel(idx)})`;
    return r;
  };
}
{ const _sv = $("rbSave").onclick;
  $("rbSave").onclick = function (...a) {
    const ldId = RB.ldId, sibs = $("rbAll").checked ? (RB.sibs || []) : [];
    const r = _sv.apply(this, a);
    if (sibs.length) {
      syncLift(); const src = plan.loads.find(x => x.id === ldId); let n = 0;
      if (src) for (const s of sibs) { const L = plan.lifts[s.i], x = L && L.loads.find(y => y.id === s.id); if (!x) continue;
        x.rig = clone(src.rig); for (const k of RIG_FIELDS) { if (src[k] === undefined) delete x[k]; else x[k] = clone(src[k]); } withLift(s.i, () => normLoad(x)); n++; }
      if (n) { markDirty(); renderAll(); toast(`Rigging saved for this lift and ${n} other lift${n > 1 ? "s" : ""} that use it`, 2600); }
      if ($("dRigList").open) { RLV.list = rigListEntries(); renderRigList(); }
    }
    RB.sibs = [];
    return r;
  };
}
