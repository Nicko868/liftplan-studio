// ================= The drawing as objects (not a backdrop) =================
// An imported site drawing (CAD / PDF / traced) is turned into real drawing objects: every outline becomes an AREA,
// every line (joined end to end) a LINE and every text a TEXT object. Each one can be selected, moved, deleted,
// hidden, locked, or turned into a site object (building, fence, wall, road…) with a height, which then counts in the
// travel / clash checks and shows in Side and 3D. "Show / Hide lines" shows or hides all of them. The sheets print the
// same objects as CAD linework. A scanned drawing traced as filled ink stays as it is (its outlines are ink, not lines).
const DWG = { sel: new Set(), undo: [], grid: null, gridKey: "", drag: null };
const dwgCur = () => { const c = plan.site?.cad, D = c && typeof CADS !== "undefined" && CADS[c.id]; return D ? { c, D } : null; };
function dwgSimplify(P, e = 0.03) {
  if (P.length < 3) return P;
  let dm = 0, im = 0; const a = P[0], b = P[P.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
  for (let i = 1; i < P.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - P[i][1]) - (a[0] - P[i][0]) * (b[1] - a[1])) / L; if (d > dm) { dm = d; im = i; } }
  return dm > e ? dwgSimplify(P.slice(0, im + 1), e).slice(0, -1).concat(dwgSimplify(P.slice(im), e)) : [a, b];
}
const dwgR2 = v => Math.round(v * 100) / 100;
// build the objects once per drawing (and again if the drawing's own lines change before anything was edited)
function dwgEnsure(D) {
  if (!D || D.fill) return null;
  if (D.objs && (D.objsEdited || D.objsFrom === D.paths.length + ":" + D.texts.length)) return D.objs;
  const { closed, open } = cadShapes(D), objs = []; let n = 0;
  for (const P of closed) { const Q = dwgSimplify(P); if (Q.length >= 3) objs.push({ id: "d" + n++, k: "a", pts: Q.map(p => [dwgR2(p[0]), dwgR2(p[1])]) }); }
  for (const P of open) { if (lenOf(P) < 0.3) continue; const Q = dwgSimplify(P); objs.push({ id: "d" + n++, k: "l", pts: Q.map(p => [dwgR2(p[0]), dwgR2(p[1])]) }); }
  for (const t of D.texts || []) if (String(t[4] || "").trim()) objs.push({ id: "d" + n++, k: "t", p: [t[0], t[1]], s: t[2], r: t[3] || 0, str: t[4] });
  D.objs = objs; D.objsFrom = D.paths.length + ":" + D.texts.length; D.objsEdited = false;
  dwgSave(); return objs;
}
let _dwgSaveT = 0;
function dwgSave() { clearTimeout(_dwgSaveT); _dwgSaveT = setTimeout(() => { const k = dwgCur(); if (k && typeof saveCad === "function") saveCad(k.c.id, k.D); }, 800); }
function dwgChanged(edited = true) { const k = dwgCur(); if (!k) return; if (edited) k.D.objsEdited = true; k.c.v = (k.c.v || 0) + 1; DWG.gridKey = ""; dwgSave(); markDirty(); renderSite(); }
// the linework the rest of the app draws (site view, sheets, 3D ground) comes from the objects once they exist
{ const _cm = cadMarkup; cadMarkup = function (forExport) {
    const k = dwgCur(); const objs = k && dwgEnsure(k.D);
    if (objs && (cadPathCache.id !== k.c.id || cadPathCache.v !== (k.c.v || 0) || !cadPathCache.objs)) {
      let d = "", t = "";
      for (const o of objs) { if (o.hide) continue;
        if (o.k === "t") { t += `<text x="${o.p[0]}" y="${-o.p[1]}" font-size="${Math.max(0.05, o.s)}" ${o.r ? `transform="rotate(${-o.r} ${o.p[0]} ${-o.p[1]})"` : ""}>${escH(o.str)}</text>`; continue; }
        const P = o.pts; d += `M${P[0][0]} ${-P[0][1]}`; for (let i = 1; i < P.length; i++) d += `L${P[i][0]} ${-P[i][1]}`; if (o.k === "a") d += "Z"; }
      cadPathCache = { id: k.c.id, v: k.c.v || 0, d, t, objs: true };
    }
    return _cm.call(this, forExport);
  }; }
// ---------- picking ----------
function dwgGrid(objs) {
  const k = dwgCur(), key = k ? k.c.id + ":" + (k.c.v || 0) : ""; if (DWG.grid && DWG.gridKey === key) return DWG.grid;
  const G = new Map(), C = 6, add = (x, y, i) => { const kk = Math.floor(x / C) + "," + Math.floor(y / C); (G.get(kk) || G.set(kk, new Set()).get(kk)).add(i); };
  objs.forEach((o, i) => { if (o.hide) return; if (o.k === "t") { add(o.p[0], o.p[1], i); return; }
    const P = o.k === "a" ? [...o.pts, o.pts[0]] : o.pts;
    for (let j = 1; j < P.length; j++) { const a = P[j - 1], b = P[j], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / C)); for (let s = 0; s <= n; s++) add(a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n, i); } });
  DWG.grid = { G, C }; DWG.gridKey = key; return DWG.grid;
}
const dwgSegD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-12, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
function dwgPick(w, tolM) {
  const k = dwgCur(), objs = k && dwgEnsure(k.D); if (!objs) return null;
  const { G, C } = dwgGrid(objs), cand = new Set(); const gx = Math.floor(w[0] / C), gy = Math.floor(w[1] / C), rr = Math.ceil(tolM / C);
  for (let x = gx - rr; x <= gx + rr; x++) for (let y = gy - rr; y <= gy + rr; y++) for (const i of G.get(x + "," + y) || []) cand.add(i);
  let best = null, bd = tolM;
  for (const i of cand) { const o = objs[i]; let d;
    if (o.k === "t") d = Math.hypot(w[0] - o.p[0], w[1] - o.p[1]) - Math.max(0.3, o.s);
    else { const P = o.k === "a" ? [...o.pts, o.pts[0]] : o.pts; d = 1e9; for (let j = 1; j < P.length; j++) d = Math.min(d, dwgSegD(w, P[j - 1], P[j])); }
    if (d <= bd) { bd = d; best = o; } }
  return best;
}
// ---------- selection, moving, the action bar ----------
const dwgSelObjs = () => { const k = dwgCur(), objs = k && k.D.objs; return objs ? objs.filter(o => DWG.sel.has(o.id)) : []; };
function dwgSnap() { const k = dwgCur(); if (k && k.D.objs) { DWG.undo.push(JSON.stringify(k.D.objs)); if (DWG.undo.length > 30) DWG.undo.shift(); } }
function dwgOverlay() {
  const svg = $("site"); let g = svg.querySelector("#dwgSel"); if (!g) { g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.id = "dwgSel"; g.setAttribute("pointer-events", "none"); }
  svg.appendChild(g);
  const sel = dwgSelObjs(); let h = "";
  for (const o of sel) { if (o.k === "t") { h += `<circle cx="${o.p[0]}" cy="${-o.p[1]}" r="${Math.max(0.4, o.s)}" fill="none" stroke="#e8590c" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`; continue; }
    const P = o.pts; h += `<path d="M${P.map(p => `${p[0]} ${-p[1]}`).join(" L")}${o.k === "a" ? "Z" : ""}" fill="${o.k === "a" ? "rgba(232,89,12,.08)" : "none"}" stroke="#e8590c" stroke-width="3" vector-effect="non-scaling-stroke"/>`; }
  g.innerHTML = h; dwgBar();
}
function dwgBar() {
  let b = $("dwgBar"); const cur = dwgSelObjs();
  if (!cur.length) { if (b) b.hidden = true; return; }
  if (!b) { b = document.createElement("div"); b.id = "dwgBar"; b.style.cssText = "position:absolute;left:50%;bottom:44px;transform:translateX(-50%);z-index:30;background:var(--surface,#fff);border:1px solid var(--line,#ccd);border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.18);padding:6px 8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:13px;max-width:92%";
    $("site").parentElement.appendChild(b); }
  const nA = cur.filter(o => o.k === "a").length, nL = cur.filter(o => o.k === "l").length, nT = cur.filter(o => o.k === "t").length, locked = cur.every(o => o.lock);
  const types = Object.entries(OBJ_TYPES).filter(([, T]) => !T.special && !T.mat && (nA && !nL ? T.kind !== "line" && T.kind !== "circle" : nL && !nA ? T.kind === "line" : false));
  b.hidden = false;
  b.innerHTML = `<b>${cur.length === 1 ? (nA ? "Drawing area" : nL ? "Drawing line" : "Drawing text") : `${cur.length} drawing objects`}</b>${cur.length === 1 && nA ? ` <span class="small">${fx(areaOf(cur[0].pts), 1)} m²</span>` : cur.length === 1 && nL ? ` <span class="small">${fx(lenOf(cur[0].pts), 2)} m</span>` : ""}
    ${types.length && !nT ? `<select id="dwgType" title="Turn it into a site object"><option value="">Make site object…</option>${types.map(([k, T]) => `<option value="${k}">${escH(T.name)}</option>`).join("")}</select><label class="small" style="display:flex;align-items:center;gap:4px">height<input id="dwgH" type="number" step="0.1" min="0" style="width:64px" placeholder="m"></label><button id="dwgMake" class="pri">Make</button>` : ""}
    <button id="dwgLock">${locked ? "Unlock" : "Lock"}</button><button id="dwgHide">Hide</button><button id="dwgDel">Delete</button><button id="dwgUndo" ${DWG.undo.length ? "" : "disabled"}>Undo</button><button id="dwgDone">Done</button>`;
  const ids = new Set(DWG.sel), act = f => { dwgSnap(); f(); dwgChanged(); dwgOverlay(); };
  $("dwgDel").onclick = () => act(() => { const k = dwgCur(); k.D.objs = k.D.objs.filter(o => !ids.has(o.id)); DWG.sel.clear(); });
  $("dwgHide").onclick = () => act(() => { for (const o of cur) o.hide = true; DWG.sel.clear(); });
  $("dwgLock").onclick = () => act(() => { for (const o of cur) o.lock = !locked; });
  $("dwgUndo").onclick = () => { const k = dwgCur(), s = DWG.undo.pop(); if (k && s) { k.D.objs = JSON.parse(s); DWG.sel.clear(); dwgChanged(); dwgOverlay(); } };
  $("dwgDone").onclick = () => { DWG.sel.clear(); dwgOverlay(); };
  if ($("dwgMake")) $("dwgMake").onclick = () => {
    const ty = $("dwgType").value; if (!ty) { toast("Pick what it is first (building, fence, wall, area…)"); return; }
    const h = $("dwgH").value === "" ? null : +$("dwgH").value;
    dwgSnap(); const made = [];
    for (const o of cur) { if (o.k === "t") continue; const ob = makeObject(ty, o.pts[0], o.pts); if (!ob) continue; if (h != null && h >= 0) ob.hgt = h; ob.fromDwg = true; plan.obstacles.push(ob); made.push(ob); }
    const k = dwgCur(); k.D.objs = k.D.objs.filter(o => !ids.has(o.id) || o.k === "t"); DWG.sel.clear();
    dwgChanged(); if (made.length === 1) sel = { kind: "obs", id: made[0].id }; renderAll(); dwgOverlay();
    toast(`${made.length} site object${made.length > 1 ? "s" : ""} made – ${made.some(o => (+o.hgt || 0) > 0) ? "counted in the travel / clash checks" : "give it a height to count it in the clash checks"}`);
  };
}
{ const svg = $("site");
  svg.addEventListener("pointerdown", e => {
    const k = dwgCur(); if (!k || k.c.show === false || tool.mode || allMode || (typeof V3 !== "undefined" && V3.mode !== "top") || e.button !== 0) return;
    if (e.target.closest && e.target.closest("g[data-key]")) { if (DWG.sel.size) { DWG.sel.clear(); dwgOverlay(); } return; }
    const w = toWorld(e), o = dwgPick(w, 7 / view.s);
    if (!o) { if (DWG.sel.size && !e.shiftKey) { DWG.sel.clear(); dwgOverlay(); } return; }
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.shiftKey) { DWG.sel.has(o.id) ? DWG.sel.delete(o.id) : DWG.sel.add(o.id); }
    else if (!DWG.sel.has(o.id)) { DWG.sel.clear(); DWG.sel.add(o.id); }
    if (typeof sel !== "undefined" && sel) { sel = null; renderPanels(); renderSite(); }
    const moving = dwgSelObjs().filter(x => !x.lock);
    DWG.drag = moving.length ? { w0: w, objs: moving, base: moving.map(x => JSON.stringify(x)), moved: false } : null;
    svg.setPointerCapture(e.pointerId); dwgOverlay();
  }, true);
  svg.addEventListener("pointermove", e => {
    const d = DWG.drag; if (!d) return; const w = toWorld(e), dx = w[0] - d.w0[0], dy = w[1] - d.w0[1];
    if (!d.moved && Math.hypot(dx, dy) * view.s < 4) return;
    if (!d.moved) { dwgSnap(); d.moved = true; }
    d.objs.forEach((o, i) => { const b = JSON.parse(d.base[i]); if (o.k === "t") o.p = [dwgR2(b.p[0] + dx), dwgR2(b.p[1] + dy)]; else o.pts = b.pts.map(p => [dwgR2(p[0] + dx), dwgR2(p[1] + dy)]); });
    e.stopImmediatePropagation();
    const k = dwgCur(); k.c.v = (k.c.v || 0) + 1; renderSite();
  }, true);
  const up = e => { const d = DWG.drag; if (!d) return; DWG.drag = null; if (d.moved) { dwgChanged(); e.stopImmediatePropagation(); } dwgOverlay(); };
  svg.addEventListener("pointerup", up, true); svg.addEventListener("pointercancel", up, true);
  document.addEventListener("keydown", e => {
    if (!DWG.sel.size || /input|textarea|select/i.test(document.activeElement?.tagName || "")) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); $("dwgDel")?.click(); }
    else if (e.key === "Escape") { DWG.sel.clear(); dwgOverlay(); }
  }, true);
}
{ const _rs = renderSite; renderSite = function (...a) { const r = _rs.apply(this, a); try { if (DWG.sel.size) dwgOverlay(); else { const b = $("dwgBar"); if (b) b.hidden = true; const g = $("site").querySelector("#dwgSel"); if (g) g.innerHTML = ""; } } catch (e) { } return r; }; }
// "Show all hidden drawing objects" – one click to bring back anything hidden
function dwgUnhideAll() { const k = dwgCur(); if (!k || !k.D.objs) return 0; let n = 0; dwgSnap(); for (const o of k.D.objs) if (o.hide) { delete o.hide; n++; } if (n) dwgChanged(); return n; }
{ const _rl = renderLayoutTools; renderLayoutTools = function (...a) { const r = _rl.apply(this, a);
    try { const k = dwgCur(), n = k && k.D.objs ? k.D.objs.filter(o => o.hide).length : 0, box = $("ltBoxUI"); if (box && n && !box.querySelector("#dwgUnhide")) { const bt = document.createElement("button"); bt.id = "dwgUnhide"; bt.textContent = `Show hidden lines (${n})`; bt.onclick = () => { const m = dwgUnhideAll(); toast(`${m} drawing object${m === 1 ? "" : "s"} shown again`); renderLayoutTools(); }; box.appendChild(bt); } } catch (e) { }
    return r; }; }
