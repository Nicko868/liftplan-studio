// ================= Rigging workbench – on the drawing =================
// The rigging is worked on where you see it: the front and end views of the load and its rigging, live.
//   · drag the end of a leg onto a lifting point, a junction or a spreader's top padeye to connect it – drop it in
//     empty space to disconnect it;
//   · drag the ＋ under the hook, a junction or a spreader padeye to a point to add a leg;
//   · drag the hook, a junction or a spreader up or down – the slings below it are lengthened / shortened to suit
//     (in the sling length steps of this plan);
//   · drag a spreader's padeyes along it to set their spacing;
//   · drag a part from the bar above the drawing onto a leg (or onto the hook / a junction) to add it – a master link
//     dropped on a leg puts a junction there, a spreader dropped on a leg puts a spreader there;
//   · click a leg, a node or a card for its parts: each item list is in order of what suits it best, with its use.
// Everything is solved by the workbench solver (rigtree.js) – the forces, angles, use and checks follow every change.
const WBX = { ld: null, hist: [], sel: null, drag: null, same: true };
(() => {
  if ($("dWb")) return;
  const d = document.createElement("dialog"); d.id = "dWb"; d.style.cssText = "width:min(1440px,98vw)";
  d.innerHTML = `<div class="dh"><b>Rigging workbench</b><span class="small" id="wbxSub" style="margin-left:8px"></span><span style="flex:1"></span><button id="wbxUndo">↶ Undo</button><button id="wbxList">List view</button><button id="wbxCancel">Cancel</button><button class="pri" id="wbxSave">Save rigging</button></div><div class="db" id="wbxBody"></div>`;
  document.body.append(d);
  const st = document.createElement("style"); st.textContent = `
#dWb .db{padding:10px}#dWb .eng{margin:0}
.wbxpal{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px}.wbxpal .engk{margin-right:4px}
.wbxchip{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:14px;border:1px solid #2c4d70;background:rgba(111,168,220,.1);color:#dce8f5;font-size:12px;cursor:grab;user-select:none}
.wbxchip:hover{border-color:#d9661f}.wbxchip i{width:9px;height:9px;border-radius:50%;display:inline-block}
.wbxwrap{position:relative;width:100%}.wbxwrap>svg.engsvg{display:block}.wbxov{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
.wbxov .hit{stroke:transparent;fill:none;cursor:pointer}.wbxov .hit:hover,.wbxov .hit.sel{stroke:rgba(255,166,77,.45)}
.wbxov .h{cursor:grab}.wbxov .h:hover{filter:drop-shadow(0 0 3px #ffb547)}.wbxov .tg{fill:rgba(61,220,151,.15);stroke:#3ddc97}.wbxov .tg.on{fill:rgba(61,220,151,.55)}
.wbxpanel{background:rgba(111,168,220,.06);border:1px solid #1f3a57;border-radius:8px;padding:10px;color:#dce8f5;display:flex;flex-direction:column;gap:6px;max-height:640px;overflow:auto}
.wbxpanel select,.wbxpanel input{background:#0d1b2a;color:#dce8f5;border:1px solid #2c4d70;border-radius:5px;padding:3px 6px;font-size:12.5px}
.wbxpanel .rowp{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto auto;gap:4px;align-items:center}.wbxpanel .rowp select{width:100%;min-width:0}
.wbxpanel .lenp{display:flex;align-items:center;gap:3px;font-size:11px;color:#8fb3d6}.wbxpanel .lenp input{width:58px}
.wbxpanel .use{font-size:11px;padding:1px 6px;border-radius:9px;white-space:nowrap;background:rgba(61,220,151,.15);color:#3ddc97}.wbxpanel .use.warn{background:rgba(255,181,71,.15);color:#ffb547}.wbxpanel .use.bad{background:rgba(255,93,93,.18);color:#ff8a8a}
.wbxpanel button{background:rgba(111,168,220,.12);color:#dce8f5;border:1px solid #2c4d70;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:12px}.wbxpanel button:hover{border-color:#d9661f}
.wbxpanel h4{margin:0;font-size:13px;color:#fff}.wbxpanel .wbxh{font-size:11.5px;color:#8fb3d6}.wbxpanel label{display:flex;flex-direction:column;gap:2px;font-size:11.5px;color:#8fb3d6}
#dWb label.wbxchk{display:flex;flex-direction:row;align-items:center;gap:6px;margin:0}#dWb label.wbxchk input{width:auto;margin:0}
.wbxpanel .grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px}.wbxchk{color:#a9c6e3;font-size:12px}.wbxchk .chkr{color:#8fb3d6}`;
  document.head.append(st);
})();
// ---------- open / save ----------
function openWorkbench() {
  if (!RB.work) return; const ld = clone(RB.work);
  if (!wbIsTree(ld)) { try { if (typeof stdToBuild === "function") stdToBuild(ld); } catch (e) { } const t = wbFromRig(ld); if (!t) { toast("The workbench is for one crane – a tandem lift stays in the list"); return; } delete ld.rig?.q; ld.rig = t; }
  WBX.ld = ld; WBX.hist = []; WBX.sel = null; WBX.drag = null; $("wbxSub").textContent = ld.name || ""; wbxRender(); $("dWb").showModal();
}
$("wbxCancel").onclick = () => $("dWb").close();
const wbxClean = R => JSON.parse(JSON.stringify(R, (k, v) => k[0] === "_" ? undefined : v));
$("wbxSave").onclick = () => { if (!WBX.ld || !RB.work) return; RB.work.rig = wbxClean(WBX.ld.rig); $("dWb").close(); if (typeof QB !== "undefined") QB.detail = true; $("rbSave").click(); };
$("wbxList").onclick = () => { if (!WBX.ld || !RB.work) return; RB.work.rig = wbxClean(WBX.ld.rig); $("dWb").close(); if (typeof QB !== "undefined") QB.detail = true; renderRB(); };
$("wbxUndo").onclick = () => { const s = WBX.hist.pop(); if (!s) { toast("Nothing to undo"); return; } WBX.ld.rig = JSON.parse(s); WBX.sel = null; wbxRender(); };
const wbxPush = () => { WBX.hist.push(JSON.stringify(WBX.ld.rig)); if (WBX.hist.length > 60) WBX.hist.shift(); };
const wbxT = () => WBX.ld.rig.tree, wbxN = id => wbNode(wbxT(), id);
// ---------- editing helpers (also used by drag and drop) ----------
function wbxFreePt(ld) { const T = ld.rig.tree, used = new Set(T.nodes.flatMap(m => (m.legs || []).filter(x => x.to?.pt).map(x => x.to.pt))); return allPts(ld).find(p => p.k !== "C" && !used.has(p.k)) || null; }
function wbxInsertJoin(ld, n, L) { const T = ld.rig.tree, J = { id: wbId(), kind: "join", parts: [wbNew("masterlink", ld)], legs: [] }, old = L.to;
  J.legs.push({ id: wbId(), parts: [wbNew("sling_round", ld), wbNew("shackle", ld)], to: old?.pt || old?.node ? clone(old) : (wbxFreePt(ld) ? { pt: wbxFreePt(ld).k } : {}) }); T.nodes.push(J); L.to = { node: J.id }; return J; }
function wbxInsertBeam(ld, n, L, ax) {   // a spreader under this node: it takes over the legs that went from here to lifting points
  const T = ld.rig.tree, u = ax ? [0, 1] : [1, 0], P = new Map(allPts(ld).map(p => [p.k, p]));
  let pl = (n.legs || []).filter(x => x.to?.pt && P.get(x.to.pt)); if (!pl.includes(L) && L.to?.pt) pl = [L, ...pl]; if (!pl.length && L.to?.pt) pl = [L];
  const at = x => { const p = P.get(x.to.pt); return p.x * u[0] + (p.y || 0) * u[1]; }; pl.sort((x, y) => at(x) - at(y));
  const sp = pl.length > 1 ? Math.max(0.5, Math.round((at(pl[pl.length - 1]) - at(pl[0])) * 100) / 100) : (ax ? (+ld.spanY || 4) : (+ld.span || 4)), r0 = solveRig(ld);
  const Vb = ((r0?.rows || []).find(x => (x.entries || []).includes((L.parts || [])[0]))?.load || (+ld.weight || 5) / 2) * Math.max(1, pl.length);
  const B = { id: wbId(), kind: "beam", beam: null, axis: ax, top: [-sp / 2, sp / 2], bot: pl.length > 1 ? pl.map(x => +(at(x) - (at(pl[0]) + at(pl[pl.length - 1])) / 2).toFixed(3)) : [-sp / 2, sp / 2], legs: [] };
  { const need = Vb * (typeof rcDaf === "function" ? rcDaf(ld) : 1.1) / (RIG_GREEN / 100), c = rigLibrary().filter(i => i.type === "spreader" && !i.pad && ((+i.len || 0) >= sp - 0.01 || i.table || i.adjust) && +i.swl >= need).sort((x, y) => (+x.len || 99) - (+y.len || 99) || x.swl - y.swl), it = c[0] || pickItem("spreader", Vb);
    B.beam = rigEntry(it); B.beam.len = it?.table || it?.adjust ? sp : Math.max(+B.beam.len || 0, sp); }
  const lugShk = (L.parts || []).filter(e => e.snap.type === "shackle").slice(-1)[0];
  (pl.length ? pl : [L]).forEach((x, k) => B.legs.push({ id: wbId(), from: Math.min(k, B.bot.length - 1), parts: [wbNew("shackle", ld, Vb / 2), Object.assign(wbNew("sling_round", ld, Vb / 2), { len: 3 }), ...(lugShk ? [clone(lugShk)] : [wbNew("shackle", ld, Vb / 2)])], to: x.to?.pt ? { pt: x.to.pt } : clone(x.to || {}) }));
  T.nodes.push(B); const keep = (n.legs || []).filter(x => !pl.includes(x) && x !== L), parts = clone(L.parts || []);
  n.legs = [...keep, { id: wbId(), parts, to: { node: B.id, pad: 0 } }, { id: wbId(), parts: clone(parts), to: { node: B.id, pad: 1 } }]; return B;
}
// a change to the parts of one leg goes to every leg with the same parts (unless switched off)
function wbxTwins(list) { if (!WBX.same) return [list]; const sig = l => (l || []).map(e => e.id + "/" + (+e.len || "")).join(","), s = sig(list), out = [];
  for (const n of wbxT().nodes) { if (n.parts && n.parts !== list && sig(n.parts) === s && n.parts.length && list === n.parts) out.push(n.parts); for (const L of n.legs || []) if (sig(L.parts) === s) out.push(L.parts); }
  if (!out.includes(list)) out.push(list); return out; }
// ---------- drawing ----------
function wbxGeom(ld, res) {
  const d = loadDims(ld), gap = Math.max(d.x, d.y) * 0.6 + 3, endOx = d.x / 2 + gap + d.y / 2, T = ld.rig.tree;
  const views = [["side", 0], ["end", endOx]].map(([v, ox]) => ({ v, ox, U: p => ox + (v === "end" ? p[1] : p[0]), Y: p => -p[2] }));
  const all = allPts(ld), corners = all.some(p => /^[AB][12]$/.test(p.k)), P = all.filter(p => p.k !== "C" && !(corners && /^[AB]$/.test(p.k))), lz = liftPointZ(ld), TT = tiltFn(ld, ld.rig), pts = P.map(p => ({ k: p.k, name: p.name, p: TT([p.x, p.y || 0, p.wrap ? d.z : (p.z ?? lz)]) }));
  const legs = [], nodes = [], targets = [];
  for (const n of T.nodes) {
    for (const e of n._ends || []) legs.push({ n, L: e.L, a: e.a, b: e.b });
    for (const L of n.legs || []) if (!(n._ends || []).some(e => e.L === L)) { const a = n.kind === "beam" && n._xy ? [n._xy[0] + n._u[0] * ((n._bot || [0])[+L.from || 0] || 0), n._xy[1] + n._u[1] * ((n._bot || [0])[+L.from || 0] || 0), n._zb] : n._J; if (a) legs.push({ n, L, a, b: [a[0], a[1], a[2] - 1.6], loose: true }); }
    if (n.kind === "beam" && n._xy) { const pos = o => [n._xy[0] + n._u[0] * o, n._xy[1] + n._u[1] * o];
      nodes.push({ n, p: [...n._xy, n._zb + WB_H / 2], beam: true, top: (n._top || []).map((o, k) => ({ k, o, p: [...pos(o), n._zb + WB_H] })), bot: (n._bot || []).map((o, k) => ({ k, o, p: [...pos(o), n._zb] })) });
      (n._top || []).forEach((o, k) => targets.push({ key: `bm:${n.id}:${k}`, p: [...pos(o), n._zb + WB_H], name: `${n.beam?.snap?.name || "Spreader"} – top padeye ${k + 1}` })); }
    else if (n._J) { nodes.push({ n, p: n._J, top: n._top }); if (n.id !== T.root) targets.push({ key: `jn:${n.id}`, p: n._top, name: n.parts?.[0]?.snap?.name || "Junction" }); }
  }
  pts.forEach(q => targets.push({ key: "pt:" + q.k, p: q.p, name: q.name, pt: true }));
  return { views, legs, nodes, targets, d, s: Math.max(d.x, d.z, res?.hookZ || 1) };
}
function wbxOverlay(ld, res, G, vb) {
  const r = G.s * 0.015, w = G.s * 0.008, selL = WBX.sel?.leg, selN = WBX.sel?.node; let h = "";
  for (const V of G.views) {
    for (const q of G.targets) h += `<circle class="tg" data-tgt="${q.key}" data-view="${V.v}" cx="${V.U(q.p)}" cy="${V.Y(q.p)}" r="${r * 1.1}" stroke-width="${w * 0.4}" opacity="${WBX.drag ? 1 : (q.pt ? 0.55 : 0)}"/>`;
    for (const g of G.legs) { const id = `${g.n.id}:${g.L.id}`, on = selL === id;
      h += `<line class="hit ${on ? "sel" : ""}" data-leg="${id}" x1="${V.U(g.a)}" y1="${V.Y(g.a)}" x2="${V.U(g.b)}" y2="${V.Y(g.b)}" stroke-width="${w * 3.5}"/>`;
      if (g.loose) h += `<line x1="${V.U(g.a)}" y1="${V.Y(g.a)}" x2="${V.U(g.b)}" y2="${V.Y(g.b)}" stroke="#ff5d5d" stroke-width="${w * 0.6}" stroke-dasharray="${w * 2} ${w * 1.5}" pointer-events="none"/>`;
      h += `<circle class="h" data-legend="${id}" data-view="${V.v}" cx="${V.U(g.b)}" cy="${V.Y(g.b)}" r="${r * 0.7}" fill="${g.loose ? "#ff5d5d" : on ? "#ffb547" : "#d9661f"}" stroke="#0b1522" stroke-width="${w * 0.4}"/>`; }
    for (const q of G.nodes) { const on = selN === q.n.id;
      if (q.beam) { const a = q.bot[0]?.p || q.p, b = q.bot[q.bot.length - 1]?.p || q.p;
        h += `<line class="hit h ${on ? "sel" : ""}" data-node="${q.n.id}" data-view="${V.v}" x1="${V.U(a) - (Math.abs(V.U(a) - V.U(b)) < 0.01 ? r : 0)}" y1="${V.Y(q.p)}" x2="${V.U(b) + (Math.abs(V.U(a) - V.U(b)) < 0.01 ? r : 0)}" y2="${V.Y(q.p)}" stroke-width="${w * 5}"/>`;
        const alongView = (V.v === "side") === !q.n.axis;
        if (alongView) { for (const t of q.top) h += `<rect class="h" data-pad="${q.n.id}:top:${t.k}" data-view="${V.v}" x="${V.U(t.p) - r * 0.55}" y="${V.Y(t.p) - r * 1.2}" width="${r * 1.1}" height="${r * 1.1}" fill="#6fa8dc" stroke="#0b1522" stroke-width="${w * 0.3}"/>`;
          for (const t of q.bot) { h += `<rect class="h" data-pad="${q.n.id}:bot:${t.k}" data-view="${V.v}" x="${V.U(t.p) - r * 0.55}" y="${V.Y(t.p) + r * 0.1}" width="${r * 1.1}" height="${r * 1.1}" fill="#f2c200" stroke="#0b1522" stroke-width="${w * 0.3}"/>`;
            h += `<g class="h" data-newleg="${q.n.id}:${t.k}" data-view="${V.v}"><circle cx="${V.U(t.p)}" cy="${V.Y(t.p) + r * 2.6}" r="${r * 0.75}" fill="#1e7a3c" stroke="#0b1522" stroke-width="${w * 0.3}"/><text x="${V.U(t.p)}" y="${V.Y(t.p) + r * 3.05}" font-size="${r * 1.3}" text-anchor="middle" fill="#fff" pointer-events="none">+</text></g>`; } } }
      else { h += `<circle class="h ${on ? "sel" : ""}" data-node="${q.n.id}" data-view="${V.v}" cx="${V.U(q.p)}" cy="${V.Y(q.p)}" r="${r * 0.95}" fill="${q.n.kind === "hook" ? "#6fa8dc" : "#b8860b"}" fill-opacity=".85" stroke="${on ? "#ffb547" : "#0b1522"}" stroke-width="${w * 0.5}"/>`;
        h += `<g class="h" data-newleg="${q.n.id}:0" data-view="${V.v}"><circle cx="${V.U(q.p) + r * 2}" cy="${V.Y(q.p) + r * 1.6}" r="${r * 0.75}" fill="#1e7a3c" stroke="#0b1522" stroke-width="${w * 0.3}"/><text x="${V.U(q.p) + r * 2}" y="${V.Y(q.p) + r * 2.05}" font-size="${r * 1.3}" text-anchor="middle" fill="#fff" pointer-events="none">+</text></g>`; } }
  }
  return `<svg class="wbxov" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg"><g id="wbxDyn"></g>${h}</svg>`;
}
// ---------- the window ----------
function wbxRender() {
  const ld = WBX.ld, res = solveRig(ld), G = wbxGeom(ld, res), d = loadDims(ld), daf = typeof rcDaf === "function" ? rcDaf(ld) : 1.1;
  const sc = rigPreviewScene(ld, res), base = toSVG(sc, { pad: 0.8, noSize: true, lw: 0.05 }), vb = (base.match(/viewBox="([^"]+)"/) || [])[1] || "0 0 10 10";
  const maxU = Math.max(0, ...(res?.rows || []).map(r => r.util || 0)), tot = (+ld.weight || 0) + (res?.weight || 0), col = u => u == null ? "#7f8c8d" : u > 100 ? "#ff5d5d" : u > RIG_GREEN ? "#ffb547" : "#3ddc97";
  const chips = [["sling_round", "Round sling", "#e0701f"], ["sling_wire", "Wire rope sling", "#8a9199"], ["sling_chain", "Chain sling", "#c0c4c8"], ["shackle", "Shackle", "#6b7278"], ["masterlink", "Master link → junction", "#b8860b"], ["hook", "Hook", "#3a3e42"], ["loadcell", "Load cell", "#6fa8dc"], ["beam0", "Spreader along", "#f2c200"], ["beam90", "Spreader across", "#f2c200"]];
  $("wbxBody").innerHTML = `<div class="eng">
    <div class="wbxpal"><span class="engk">Drag onto a leg →</span>${chips.map(([k, n, c]) => `<span class="wbxchip" draggable="true" data-chip="${k}"><i style="background:${c}"></i>${n}</span>`).join("")}
      <label class="wbxchk" style="margin-left:auto"><input type="checkbox" id="wbxSame" ${WBX.same ? "checked" : ""}> changes go to every leg with the same parts</label></div>
    <div class="engkpis">
      <div class="kpi"><div class="engk">Below the hook</div><div class="kv">${fmtT(tot)}<small> t</small></div><div class="engs">load ${fmtT(+ld.weight)} + rigging ${fmtT(res?.weight || 0)}</div></div>
      <div class="kpi"><div class="engk">Highest use (× DAF ${fx(daf, 2)})</div><div class="kv" style="color:${col(maxU * daf)}">${maxU ? (maxU * daf).toFixed(0) : "–"}<small>%</small></div><div class="engbar"><i style="width:${Math.min(100, maxU * daf)}%;background:${col(maxU * daf)}"></i></div></div>
      <div class="kpi"><div class="engk">Hook above load</div><div class="kv">${res ? fx(res.hookZ - d.z, 2) : "–"}<small> m</small></div><div class="engs">hook ${res ? fx(res.hookZ, 2) : "–"} m above load bottom</div></div>
      <div class="kpi"><div class="engk">Checks</div><div class="kv" style="color:${res?.warn.length ? "#ff5d5d" : "#3ddc97"}">${res?.warn.length ? res.warn.length + " ⚠" : "OK"}</div><div class="engs">${res?.warn.length ? "listed under the drawing" : "no rigging warnings"}</div></div></div>
    <div class="engbody"><div class="engdraw"><div class="wbxwrap">${base.replace(/^<svg /, '<svg class="engsvg" ')}${wbxOverlay(ld, res, G, vb)}</div></div>
      <div class="wbxpanel" id="wbxPanel">${wbxPanelHTML(ld, res, daf)}</div></div>
    ${res?.warn.length ? `<div class="engnotes">${res.warn.map(w => `<div class="engw wbxchk">⚠ ${typeof chkHTML === "function" ? chkHTML(w) : escH(w)}</div>`).join("")}</div>` : ""}
    <p class="engs" style="margin:8px 0 0">Drag the orange end of a leg onto a lifting point, a junction or a top padeye (green rings) to connect it – into empty space to disconnect it · drag ＋ to a point for a new leg · drag the hook, a junction or a spreader up / down to change the sling lengths below it · drag the padeye squares along a spreader · click anything to change its parts.</p></div>`;
  wbxWire(ld, res, G);
}
function wbxUseChip(r, daf) { if (!r || r.util == null) return ""; const u = r.load * daf / r.swl * 100; return `<span class="use ${u > 100 ? "bad" : u > RIG_GREEN ? "warn" : ""}" title="load share ${fx(r.load, 2)} t × DAF ${fx(daf, 2)} on ${fx(r.swl, 1)} t">${fx(r.load, 1)} t · ${fx(u, 0)}%</span>`; }
function wbxPartRows(list, res, daf, key) {
  const rowOf = e => res?.rows.find(r => (r.entries || [r.entry]).includes(e));
  return (list || []).map((e, k) => { const r = rowOf(e), sl = !!RIG_TYPES[e.snap.type]?.sling, ch = wbChoices(e, r?.load || 0, daf).slice(0, 40);
    return `<div class="rowp" data-plist="${key}" data-k="${k}"><select data-pitem>${rigItem(e.id) ? "" : `<option selected>${escH(e.snap.name)} (saved)</option>`}${ch.map(c => `<option value="${escH(c.i.id)}" ${c.i.id === e.id ? "selected" : ""}>${escH(c.i.name)}${r ? ` – ${fx(c.use, 0)}%${c.use > 100 ? " ✕" : c.use > RIG_GREEN ? " !" : ""}` : ""}</option>`).join("")}</select>
      ${sl ? `<span class="lenp"><input type="number" step="0.5" min="0.5" data-plen value="${+e.len || 0}"> m</span>` : "<span></span>"}${wbxUseChip(r, daf)}<button data-pup ${k ? "" : "disabled"} title="Move up">▲</button><button data-pdel title="Remove">×</button></div>`; }).join("") +
    `<label style="flex-direction:row;align-items:center;gap:6px">+ <select data-padd="${key}"><option value="">add a part…</option>${[["sling_round", "Round sling"], ["sling_wire", "Wire rope sling"], ["sling_chain", "Chain sling"], ["sling_web", "Webbing sling"], ["shackle", "Shackle"], ["masterlink", "Master link"], ["hook", "Hook"], ["loadcell", "Load cell"], ["swivel", "Swivel"]].map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></label>`;
}
function wbxPanelHTML(ld, res, daf) {
  const T = ld.rig.tree, sel = WBX.sel;
  if (sel?.leg) { const [nid, lid] = sel.leg.split(":"), n = wbxN(nid), L = (n?.legs || []).find(x => x.id === lid); if (L) {
      const from = n.kind === "hook" ? "the crane hook" : n.kind === "beam" ? `${n.beam?.snap?.name || "spreader"} – bottom padeye ${(+L.from || 0) + 1}` : (n.parts?.[0]?.snap?.name || "junction");
      const tn = L.to?.node ? wbxN(L.to.node) : null, to = L.to?.pt ? `lifting point ${L.to.pt}` : tn ? (tn.kind === "beam" ? `${tn.beam?.snap?.name || "spreader"} – top padeye ${(+L.to.pad || 0) + 1}` : (tn.parts?.[0]?.snap?.name || "junction")) : "nothing – drag its end to connect it";
      const ang = L._beta != null ? `${fx(L._beta, 1)}° from vertical · ${fx(L._T || 0, 2)} t in the leg` : "";
      return `<h4>Leg – from ${escH(from)}</h4><div class="wbxh">to ${escH(to)}${ang ? " · " + ang : ""}</div>
        <div class="wbxh" style="margin-top:4px">Parts, top → bottom (each list: best choice first, with its use):</div>${wbxPartRows(L.parts, res, daf, "leg:" + sel.leg)}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button data-lcopy>Another leg like this</button><button data-ljoin>Put a junction at its bottom</button><button data-lbeam="0">Spreader along here</button><button data-lbeam="90">Spreader across here</button><button data-ldel>Remove the leg</button><button data-desel>Done</button></div>`; } }
  if (sel?.node) { const n = wbxN(sel.node); if (n) {
      if (n.kind === "beam") { const br = res?.rows.find(r => (r.entries || [r.entry]).includes(n.beam)), Tb = typeof tableOf === "function" && n.beam ? tableOf(n.beam) : null, need = (br?.load || 0) * daf;
        const opts = rigLibrary().filter(i => i.type === "spreader").map(i => ({ i, u: i.swl ? need / i.swl * 100 : 999 })).sort((a, b) => ((a.u > RIG_GREEN) - (b.u > RIG_GREEN)) || (a.u <= RIG_GREEN && b.u <= RIG_GREEN ? a.i.swl - b.i.swl : a.u - b.u));
        return `<h4>Spreader</h4><select data-bitem>${rigItem(n.beam?.id) ? "" : `<option selected>${escH(n.beam?.snap?.name || "")} (saved)</option>`}${opts.map(o => `<option value="${escH(o.i.id)}" ${o.i.id === n.beam?.id ? "selected" : ""}>${escH(o.i.name)} – ${fx(o.u, 0)}%</option>`).join("")}</select>${wbxUseChip(br, daf)}
          <div class="grid2"><label>Turned<select data-baxis><option value="0" ${!n.axis ? "selected" : ""}>along the load</option><option value="90" ${n.axis ? "selected" : ""}>across the load</option></select></label><span></span>
          <label>Top padeyes (m from centre)<input type="text" data-btop value="${escH((n.top || []).join(", "))}"></label><label>Bottom padeyes (m from centre)<input type="text" data-bbot value="${escH((n.bot || []).join(", "))}"></label></div>
          ${Tb ? `<div class="wbxh">Maker's table: built to ${escH(tSpanTxt(Math.max(...(n.bot || [1]).map(Math.abs)) * 2, Tb))} span – the padeyes follow it.</div>` : ""}
          <div style="display:flex;gap:6px;flex-wrap:wrap"><button data-ndel>Remove the spreader</button><button data-desel>Done</button></div>`; }
      return `<h4>${n.kind === "hook" ? "On the crane hook" : "Junction"}</h4><div class="wbxh">${n.kind === "hook" ? "Parts on the hook, top → bottom (e.g. master links). The legs hang from the last one." : "Parts where the legs meet, top → bottom (e.g. a master link). The leg above ends on the first, the legs below hang from the last."}</div>
        ${wbxPartRows(n.parts || (n.parts = []), res, daf, "node:" + n.id)}<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${n.id !== T.root ? "<button data-ndel>Remove the junction</button>" : ""}<button data-desel>Done</button></div>`; } }
  // nothing picked: every item, as on the rigging list – click one to find it on the rigging
  const col = u => u == null ? "#7f8c8d" : u > 100 ? "#ff5d5d" : u > RIG_GREEN ? "#ffb547" : "#3ddc97";
  return `<div class="wbxh">Click a leg, the hook, a junction or a spreader on the drawing – or an item below – to change it.</div>` + (res?.rows || []).map(r => { const u = r.swl ? r.load * daf / r.swl * 100 : null;
    return `<button class="engcard" data-row="${r.no}" style="display:grid;grid-template-columns:34px 1fr;gap:8px;text-align:left"><div class="engno">${r.no}</div><div class="engmain"><div class="engname">${escH(r.name)} <span class="engq">× ${r.qty}</span></div>
      <div class="engnums"><span>SWL <b>${fmtT(r.swl)}</b> t</span><span>load <b>${fmtT(r.load)}</b> t</span><span style="color:${col(u)}"><b>${u == null ? "–" : u.toFixed(0) + "%"}</b> with DAF</span></div><div class="engbar"><i style="width:${Math.min(100, u || 0)}%;background:${col(u)}"></i></div>
      ${r.where ? `<div class="engwhere">${escH(r.where)}</div>` : ""}</div></button>`; }).join("");
}
// ---------- interactions ----------
function wbxWire(ld, res, G) {
  const T = ld.rig.tree, ov = $("wbxBody").querySelector(".wbxov"), panel = $("wbxPanel"), redo = () => { WBX.ld.rig.tree = T; wbxRender(); };
  $("wbxSame").onchange = e => { WBX.same = e.target.checked; };
  const toW = ev => { const pt = ov.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const q = pt.matrixTransform(ov.getScreenCTM().inverse()); return [q.x, q.y]; };
  const viewOf = x => G.views.reduce((b, V) => !b || Math.abs(x - V.ox) < Math.abs(x - b.ox) ? V : b, null);
  // the target under the pointer; where points line up in this view (front: both sides of the load, end: both ends) the one
  // nobody uses yet, then the one on the same side / end as the leg's top
  const used = new Set(T.nodes.flatMap(m => (m.legs || []).filter(x => x.to?.pt).map(x => "pt:" + x.to.pt)));
  const nearTarget = (s, V, from, self) => { const R = G.s * 0.05, c = G.targets.map(q => ({ q, dd: Math.hypot(V.U(q.p) - s[0], V.Y(q.p) - s[1]) })).filter(x => x.dd < R); if (!c.length) return null;
    const d0 = Math.min(...c.map(x => x.dd)), same = c.filter(x => x.dd < d0 + G.s * 0.004), other = q => from ? Math.abs((V.v === "side" ? q.p[1] - from[1] : q.p[0] - from[0])) : 0;
    same.sort((a, b) => ((used.has(a.q.key) && a.q.key !== self) - (used.has(b.q.key) && b.q.key !== self)) || other(a.q) - other(b.q)); return same[0].q; };
  const legOf = id => { const [nid, lid] = id.split(":"), n = wbxN(nid); return { n, L: (n?.legs || []).find(x => x.id === lid) }; };
  const setTo = (L, key) => { if (key.startsWith("pt:")) L.to = { pt: key.slice(3) }; else if (key.startsWith("bm:")) { const [, id, k] = key.split(":"); L.to = { node: id, pad: +k }; } else if (key.startsWith("jn:")) L.to = { node: key.slice(3) }; };
  const dyn = ov.querySelector("#wbxDyn"), r = G.s * 0.015;
  ov.querySelectorAll("[data-legend],[data-node],[data-pad],[data-newleg]").forEach(el => el.addEventListener("pointerdown", ev => {
    ev.preventDefault(); ev.stopPropagation(); ov.setPointerCapture(ev.pointerId); const s0 = toW(ev), V = viewOf(s0[0]);
    WBX.drag = { el, s0, V, kind: el.dataset.legend ? "leg" : el.dataset.newleg ? "new" : el.dataset.pad ? "pad" : "node", moved: false };
    ov.querySelectorAll(".tg").forEach(t => t.setAttribute("opacity", t.dataset.view === V.v ? 1 : 0.25)); }));
  ov.addEventListener("pointermove", ev => { const D = WBX.drag; if (!D) return; const s = toW(ev), dx = s[0] - D.s0[0], dy = s[1] - D.s0[1]; if (Math.hypot(dx, dy) > G.s * 0.006) D.moved = true; if (!D.moved) return;
    let g = "";
    if (D.kind === "leg" || D.kind === "new") { const id = D.kind === "leg" ? D.el.dataset.legend : null, lg = id ? G.legs.find(x => `${x.n.id}:${x.L.id}` === id) : null;
      const from = lg ? lg.a : (() => { const [nid, k] = D.el.dataset.newleg.split(":"), q = G.nodes.find(x => x.n.id === nid); return q ? (q.beam ? q.bot[+k]?.p || q.p : q.p) : null; })();
      const t = nearTarget(s, D.V, from, lg?.L?.to?.pt ? "pt:" + lg.L.to.pt : null); ov.querySelectorAll(".tg").forEach(c => c.classList.toggle("on", !!t && c.dataset.tgt === t.key && c.dataset.view === D.V.v)); D.tgt = t;
      if (from) g += `<line x1="${D.V.U(from)}" y1="${D.V.Y(from)}" x2="${t ? D.V.U(t.p) : s[0]}" y2="${t ? D.V.Y(t.p) : s[1]}" stroke="${t ? "#3ddc97" : "#ff5d5d"}" stroke-width="${r * 0.35}" stroke-dasharray="${r * 0.8} ${r * 0.5}"/>`;
      g += `<text x="${s[0] + r * 1.5}" y="${s[1] - r}" font-size="${r * 1.6}" fill="${t ? "#3ddc97" : "#ff8a8a"}">${escH(t ? t.name : D.kind === "leg" ? "let go here to disconnect" : "drop on a point")}</text>`; }
    else if (D.kind === "node") { g += `<line x1="${D.s0[0] - r * 4}" y1="${s[1]}" x2="${D.s0[0] + r * 4}" y2="${s[1]}" stroke="#ffb547" stroke-width="${r * 0.4}"/><text x="${D.s0[0] + r * 5}" y="${s[1]}" font-size="${r * 1.6}" fill="#ffb547">${dy < 0 ? "up" : "down"} ${fx(Math.abs(dy), 2)} m${(() => { const n = wbxN(D.el.dataset.node), e = (n?._ends || [])[0], sl = e && (e.L.parts || []).filter(x => RIG_TYPES[x.snap.type]?.sling).pop(); if (!sl) return ""; const st = typeof slStep === "function" ? slStep() : 0.5, dxy = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]), now = Math.hypot(dxy, e.a[2] - e.b[2]), want = Math.hypot(dxy, Math.max(0.05, e.a[2] - dy - e.b[2])); return ` → slings ${fx(Math.max(st, Math.round((+sl.len + want - now) / st) * st), 1)} m`; })()}</text>`; D.dz = -dy; }
    else if (D.kind === "pad") { const [nid] = D.el.dataset.pad.split(":"), n = wbxN(nid), along = (D.V.v === "side") === !n.axis ? dx : 0; D.dx = Math.round(along * 20) / 20; g += `<text x="${s[0] + r}" y="${s[1] - r}" font-size="${r * 1.6}" fill="#6fa8dc">${D.dx >= 0 ? "+" : ""}${fx(D.dx, 2)} m</text>`; D.el.setAttribute("transform", `translate(${along} 0)`); }
    dyn.innerHTML = g; });
  ov.addEventListener("pointerup", ev => { const D = WBX.drag; WBX.drag = null; if (!D) return; dyn.innerHTML = "";
    if (!D.moved) { if (D.kind === "leg") WBX.sel = { leg: D.el.dataset.legend }; else if (D.kind === "node") WBX.sel = { node: D.el.dataset.node }; else if (D.kind === "pad") WBX.sel = { node: D.el.dataset.pad.split(":")[0] }; wbxRender(); return; }
    wbxPush();
    if (D.kind === "leg") { const { L } = legOf(D.el.dataset.legend); if (L) { if (D.tgt) setTo(L, D.tgt.key); else L.to = {}; } }
    else if (D.kind === "new" && D.tgt) { const [nid, k] = D.el.dataset.newleg.split(":"), n = wbxN(nid); if (n) { const sib = (n.legs || []).find(x => n.kind !== "beam" || +x.from === +k) || (n.legs || [])[0];
        const L = { id: wbId(), from: +k, parts: sib ? clone(sib.parts) : [wbNew("sling_round", ld), wbNew("shackle", ld)], to: {} }; setTo(L, D.tgt.key); (n.legs = n.legs || []).push(L); WBX.sel = { leg: `${n.id}:${L.id}` }; } }
    else if (D.kind === "node" && Math.abs(D.dz || 0) > 0.02) { const n = wbxN(D.el.dataset.node), step = typeof slStep === "function" ? slStep() : 0.5; let n0 = 0;
      for (const e of n?._ends || []) { const list = e.L.parts || [], sls = list.filter(x => RIG_TYPES[x.snap.type]?.sling); if (!sls.length) continue; const sl = sls[sls.length - 1];
        const dxy = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]), now = Math.hypot(dxy, e.a[2] - e.b[2]), want = Math.hypot(dxy, Math.max(0.05, e.a[2] + D.dz - e.b[2]));
        sl.len = Math.max(step, Math.round((+sl.len + want - now) / step) * step); n0++; }
      if (!n0) toast("No sling below it to lengthen or shorten"); }
    else if (D.kind === "pad" && Math.abs(D.dx || 0) > 0.001) { const [nid, side, k] = D.el.dataset.pad.split(":"), n = wbxN(nid), arr = side === "top" ? n.top : n.bot; arr[+k] = Math.round((+arr[+k] + D.dx) * 100) / 100; }
    else { WBX.hist.pop(); }
    wbPrune(T); redo(); });
  ov.addEventListener("click", ev => { const l = ev.target.closest("[data-leg]"); if (l && !WBX.drag) { WBX.sel = { leg: l.dataset.leg }; wbxRender(); } });
  // parts dropped from the bar
  $("wbxBody").querySelectorAll("[data-chip]").forEach(c => c.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/plain", c.dataset.chip); ev.dataTransfer.effectAllowed = "copy"; }));
  ov.addEventListener("dragover", ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = "copy"; });
  ov.addEventListener("drop", ev => { ev.preventDefault(); const kind = ev.dataTransfer.getData("text/plain"); if (!kind) return; const s = toW(ev), V = viewOf(s[0]);
    // what it was dropped on: the nearest leg (or the hook / a junction)
    let best = null, bd = G.s * 0.04; const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2; t = Math.max(0, Math.min(1, t)); return { d: Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy), t }; };
    for (const g of G.legs) { const q = segD(s, [V.U(g.a), V.Y(g.a)], [V.U(g.b), V.Y(g.b)]); if (q.d < bd) { bd = q.d; best = { leg: g, t: q.t }; } }
    for (const q of G.nodes) if (!q.beam) { const dd = Math.hypot(V.U(q.p) - s[0], V.Y(q.p) - s[1]); if (dd < bd) { bd = dd; best = { node: q.n }; } }
    if (!best) { toast("Drop it on a leg, the hook or a junction"); return; }
    wbxPush();
    if (best.node) { if (/^beam/.test(kind)) { WBX.hist.pop(); toast("Drop a spreader on a leg – it goes in at that leg"); return; } (best.node.parts = best.node.parts || []).push(wbNew(kind, ld)); WBX.sel = { node: best.node.id }; }
    else { const n = best.leg.n, L = best.leg.L;
      if (kind === "masterlink") { wbxInsertJoin(ld, n, L); WBX.sel = null; }
      else if (/^beam/.test(kind)) { wbxInsertBeam(ld, n, L, +kind.slice(4) || 0); WBX.sel = null; }
      else { const e = wbNew(kind, ld, L._V || (+ld.weight || 5) / 2), list = L.parts || (L.parts = []), at = best.t < 0.5 ? 0 : list.length; for (const Ls of wbxTwins(list)) Ls.splice(at, 0, clone(e)); WBX.sel = { leg: `${n.id}:${L.id}` }; } }
    wbPrune(T); redo(); });
  // the side panel
  const listOf = key => { if (key.startsWith("leg:")) return legOf(key.slice(4)).L?.parts; if (key.startsWith("node:")) { const n = wbxN(key.slice(5)); return n ? (n.parts = n.parts || []) : null; } return null; };
  panel.querySelectorAll("[data-plist]").forEach(row => { const list = listOf(row.dataset.plist), k = +row.dataset.k, e = list?.[k]; if (!e) return;
    row.querySelector("[data-pitem]").onchange = ev => { const it = rigItem(ev.target.value); if (!it) return; wbxPush(); for (const Ls of wbxTwins(list)) { const x = Ls[k]; if (!x) continue; const n2 = rigEntry(it); x.id = n2.id; x.snap = n2.snap; if (!RIG_TYPES[it.type]?.sling) x.len = n2.len; else if (!(+x.len > 0)) x.len = 3; } redo(); };
    const ln = row.querySelector("[data-plen]"); if (ln) ln.onchange = () => { const v = +ln.value; if (!(v > 0)) return; wbxPush(); for (const Ls of wbxTwins(list)) if (Ls[k]) Ls[k].len = v; redo(); };
    row.querySelector("[data-pdel]").onclick = () => { wbxPush(); for (const Ls of wbxTwins(list)) Ls.splice(k, 1); redo(); };
    const up = row.querySelector("[data-pup]"); if (up) up.onclick = () => { if (!k) return; wbxPush(); for (const Ls of wbxTwins(list)) { const t = Ls[k - 1]; Ls[k - 1] = Ls[k]; Ls[k] = t; } redo(); }; });
  panel.querySelectorAll("[data-padd]").forEach(s => s.onchange = () => { const kind = s.value; if (!kind) return; const list = listOf(s.dataset.padd); if (!list) return; wbxPush(); for (const Ls of wbxTwins(list)) Ls.push(wbNew(kind, ld)); redo(); });
  const L0 = WBX.sel?.leg ? legOf(WBX.sel.leg) : null;
  const on = (sel, f) => { const b = panel.querySelector(sel); if (b) b.onclick = f; };
  on("[data-desel]", () => { WBX.sel = null; redo(); });
  on("[data-lcopy]", () => { const { n, L } = L0; wbxPush(); const f = wbxFreePt(ld), L2 = { id: wbId(), from: L.from, parts: clone(L.parts || []), to: L.to?.pt && f ? { pt: f.k } : clone(L.to || {}) }; n.legs.push(L2); WBX.sel = { leg: `${n.id}:${L2.id}` }; redo(); });
  on("[data-ljoin]", () => { const { n, L } = L0; wbxPush(); wbxInsertJoin(ld, n, L); WBX.sel = null; redo(); });
  panel.querySelectorAll("[data-lbeam]").forEach(b => b.onclick = () => { const { n, L } = L0; wbxPush(); wbxInsertBeam(ld, n, L, +b.dataset.lbeam); WBX.sel = null; wbPrune(T); redo(); });
  on("[data-ldel]", () => { const { n, L } = L0; wbxPush(); n.legs = n.legs.filter(x => x !== L); WBX.sel = null; wbPrune(T); redo(); });
  on("[data-ndel]", () => { const n = wbxN(WBX.sel.node); if (!n) return; wbxPush(); for (const m of T.nodes) m.legs = (m.legs || []).filter(x => x.to?.node !== n.id); T.nodes = T.nodes.filter(m => m !== n); WBX.sel = null; wbPrune(T); redo(); });
  const nB = WBX.sel?.node ? wbxN(WBX.sel.node) : null, nums = v => String(v).split(/[,;\s]+/).filter(Boolean).map(Number).filter(x => isFinite(x));
  if (nB && nB.kind === "beam") {
    const bi = panel.querySelector("[data-bitem]"); if (bi) bi.onchange = () => { const it = rigItem(bi.value); if (!it) return; wbxPush(); const n2 = rigEntry(it); nB.beam = { ...n2, len: it.table || it.adjust ? Math.max(...(nB.bot || [1]).map(Math.abs)) * 2 : Math.max(+it.len || 0, ...(nB.bot || [0]).map(x => Math.abs(x) * 2)) }; redo(); };
    const ax = panel.querySelector("[data-baxis]"); if (ax) ax.onchange = () => { wbxPush(); nB.axis = +ax.value; redo(); };
    const tp = panel.querySelector("[data-btop]"); if (tp) tp.onchange = () => { const v = nums(tp.value); if (!v.length) return; wbxPush(); nB.top = v; redo(); };
    const bt = panel.querySelector("[data-bbot]"); if (bt) bt.onchange = () => { const v = nums(bt.value); if (!v.length) return; wbxPush(); nB.bot = v; for (const L of nB.legs || []) if (+L.from >= v.length) L.from = v.length - 1; redo(); };
  }
  panel.querySelectorAll("[data-row]").forEach(b => b.onclick = () => { const r = res?.rows.find(x => x.no === +b.dataset.row); if (!r) return; const es = r.entries || [r.entry];
    for (const n of T.nodes) { if (n.beam && es.includes(n.beam)) { WBX.sel = { node: n.id }; return wbxRender(); } if ((n.parts || []).some(e => es.includes(e))) { WBX.sel = { node: n.id }; return wbxRender(); }
      for (const L of n.legs || []) if ((L.parts || []).some(e => es.includes(e))) { WBX.sel = { leg: `${n.id}:${L.id}` }; return wbxRender(); } } });
}
// ---------- the way in ----------
// the rigging window's "Open it on the workbench" (and the rigging list) open this window
document.addEventListener("click", e => { const b = e.target.closest('#rbLeft [data-arr="tree"], #rbLeft [data-wbx]'); if (!b || !RB.work) return; e.preventDefault(); e.stopImmediatePropagation(); openWorkbench(); }, true);
{ const _rb = renderRB; renderRB = function (...a) { const r = _rb.apply(this, a);
    try { const left = $("rbLeft"), w = left?.querySelector(".wb .wbhd"); if (w && !w.querySelector("[data-wbx]")) w.insertAdjacentHTML("afterbegin", `<button class="pri" data-wbx>Open the workbench on the drawing</button>`); } catch (e) { }
    return r; }; }
{ const _rf = rigFullHTML; rigFullHTML = function (E, ...a) { return _rf.call(this, E, ...a).replace(/(<button class="engbtn" data-engedit="">Edit rigging…<\/button>)/, `<span style="display:flex;gap:6px"><button class="engbtn" data-engwb="" style="background:#1e7a3c">Workbench…</button>$1</span>`); }; }
$("rlFull").addEventListener("click", e => { if (!e.target.closest("[data-engwb]")) return; const E = RLV.list[RLV.i]; if (!E) return; e.stopPropagation(); rigEditFromList(E, 0); setTimeout(openWorkbench, 50); }, true);
