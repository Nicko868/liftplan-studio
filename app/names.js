// ================= Names on the plan: loads, site items, cranes – each on / off =================
// Saved with the plan (plan.site.names), so the Top view, 3D and the sheets all follow it.
const NAMES_KEYS = [["loads", "Load names"], ["items", "Site item names"], ["cranes", "Crane names"]];
const namesOn = k => !(plan.site && plan.site.names && plan.site.names[k] === false);
const dropNames = sc => { if (sc && sc.items) sc.items = sc.items.filter(it => !(it.t === "text" && it.L === "TEXT")); return sc; };
{ const _ls = loadScene; loadScene = function (...a) { const s = _ls.apply(this, a); return namesOn("loads") ? s : dropNames(s); }; }
{ const _os = obsScene; obsScene = function (o, ...a) { const s = _os.call(this, o, ...a); return namesOn("items") || o.kind === "dim" ? s : dropNames(s); }; }
{ const _cs = craneCarrierScene; craneCarrierScene = function (...a) { const s = _cs.apply(this, a); return namesOn("cranes") ? s : dropNames(s); }; }
// 3D: labels carry what they name
let MESH_LBL = "items";
{ const _l = Mesh.prototype.label; Mesh.prototype.label = function (...a) { _l.apply(this, a); this.labels[this.labels.length - 1].kind = MESH_LBL; }; }
{ const _c3 = crane3D; crane3D = function (...a) { const k = MESH_LBL; MESH_LBL = "cranes"; try { return _c3.apply(this, a); } finally { MESH_LBL = k; } }; }
{ const _l3 = load3D; load3D = function (...a) { const k = MESH_LBL; MESH_LBL = "loads"; try { return _l3.apply(this, a); } finally { MESH_LBL = k; } }; }
{ const _bm = buildMesh; buildMesh = function (...a) { MESH_LBL = "items"; const M = _bm.apply(this, a); M.labels = M.labels.filter(l => namesOn(l.kind || "items")); return M; }; }
// toolbar: "Aa Names" with a tick list
(() => {
  const css = document.createElement("style");
  css.textContent = `#nmWrap{position:relative;display:inline-flex}#nmPop{position:absolute;top:calc(100% + 4px);left:0;z-index:40;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.18);padding:8px 12px;min-width:190px;display:none}#nmPop.on{display:block}#nmPop label{display:flex!important;flex-direction:row!important;align-items:center;gap:8px;font-size:13px;font-weight:400;margin:4px 0;white-space:nowrap}#nmPop input{width:auto;margin:0}`;
  document.head.append(css);
  const bar = document.querySelector(".toolbar"), anchor = $("cursorXY");
  const w = document.createElement("span"); w.id = "nmWrap"; w.className = "seg";
  w.innerHTML = `<button id="nmBtn" title="Show / hide names on the plan, in 3D and on the sheets ( N )">Aa Names ▾</button><div id="nmPop" role="dialog" aria-label="Names"></div>`;
  bar.insertBefore(w, anchor);
  const pop = $("nmPop");
  const fill = () => { pop.innerHTML = NAMES_KEYS.map(([k, t]) => `<label><input type="checkbox" data-nm="${k}" ${namesOn(k) ? "checked" : ""}> ${t}</label>`).join("");
    pop.querySelectorAll("[data-nm]").forEach(el => el.onchange = () => set(el.dataset.nm, el.checked)); };
  const any = () => NAMES_KEYS.some(([k]) => namesOn(k));
  const mark = () => $("nmBtn").setAttribute("aria-pressed", String(any()));
  function set(k, on) { plan.site.names = { ...(plan.site.names || {}), [k]: on }; markDirty(); if (typeof GL !== "undefined") GL.sig = ""; renderAll(); if (typeof V3 !== "undefined" && V3.mode !== "top") render3D(); mark(); }
  $("nmBtn").onclick = e => { e.stopPropagation(); fill(); pop.classList.toggle("on"); };
  document.addEventListener("click", e => { if (!w.contains(e.target)) pop.classList.remove("on"); });
  document.addEventListener("keydown", e => {
    const t = e.target; if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) || document.querySelector("dialog[open]")) return;
    if (e.key === "n" || e.key === "N") { const on = !any(); plan.site.names = Object.fromEntries(NAMES_KEYS.map(([k]) => [k, on])); markDirty(); if (typeof GL !== "undefined") GL.sig = ""; renderAll(); if (typeof V3 !== "undefined" && V3.mode !== "top") render3D(); mark(); if (pop.classList.contains("on")) fill(); e.preventDefault(); }
  });
  { const _ra = renderAll; renderAll = function (...a) { const r = _ra.apply(this, a); try { mark(); } catch (e) { } return r; }; }
})();
