// ================= Show a lift: collapse the side panels, present full screen =================
// Left panel (cranes, loads, site) and right panel (checks) fold away in any view – Top, Side or 3D – so the drawing or
// the 3D model gets the whole width. "Present" folds both, hides the header and goes full screen; Esc or the button brings it back.
// Keys (when not typing): [ = left panel, ] = right panel, D = site drawing on / off, P = present.
(() => {
  const css = document.createElement("style");
  css.textContent = `
.main.noL{grid-template-columns:minmax(0,1fr) 380px}.main.noR{grid-template-columns:300px minmax(0,1fr)}.main.noL.noR{grid-template-columns:minmax(0,1fr)}
.main.noL #left,.main.noR #right{display:none}
@media (max-width:1250px){.main.noL{grid-template-columns:minmax(0,1fr)}}
body.presenting header.bar{display:none}
.pnbtn[aria-pressed="false"]{opacity:.6}
#presExit{position:fixed;top:10px;right:12px;z-index:50;display:none;box-shadow:0 2px 10px rgba(0,0,0,.25)}
body.presenting #presExit{display:inline-flex}`;
  document.head.append(css);
  const main = document.querySelector(".main"), bar = document.querySelector(".toolbar");
  const seg = document.createElement("span"); seg.className = "seg";
  seg.innerHTML = `<button id="pnL" class="pnbtn" aria-pressed="true" title="Show / hide the left panel – cranes, loads, site ( [ )">◧ Panel</button><button id="pnR" class="pnbtn" aria-pressed="true" title="Show / hide the checks panel ( ] )">Checks ◨</button><button id="pnD" class="pnbtn" aria-pressed="false" title="Show / hide the site drawing (plot plan, CAD lines) under the objects – in Top and 3D ( D )">▦ Drawing</button><button id="pnP" title="Present this lift: hide the panels and header, full screen ( P )">▶ Present</button>`;
  bar.insertBefore(seg, $("cursorXY"));
  const ex = document.createElement("button"); ex.id = "presExit"; ex.className = "pri"; ex.textContent = "✕ Exit presentation"; document.body.append(ex);
  const st = { L: true, R: true, P: false };
  try { const s = JSON.parse(localStorage.getItem("lps_panels") || "{}"); if (s.L === false) st.L = false; if (s.R === false) st.R = false; } catch (e) { }
  const redraw = () => requestAnimationFrame(() => { try { renderAll(); } catch (e) { } window.dispatchEvent(new Event("resize")); });
  function apply(save = true) {
    main.classList.toggle("noL", !st.L); main.classList.toggle("noR", !st.R); document.body.classList.toggle("presenting", st.P);
    $("pnL").setAttribute("aria-pressed", String(st.L)); $("pnR").setAttribute("aria-pressed", String(st.R)); $("pnP").setAttribute("aria-pressed", String(st.P));
    if (save) try { localStorage.setItem("lps_panels", JSON.stringify({ L: st.L, R: st.R })); } catch (e) { }
    redraw();
  }
  let keep = null;   // panel state before presenting
  function present(on) {
    if (on === st.P) return;
    if (on) { keep = { L: st.L, R: st.R }; st.L = st.R = false; st.P = true; try { document.documentElement.requestFullscreen?.().catch(() => { }); } catch (e) { } }
    else { st.P = false; if (keep) { st.L = keep.L; st.R = keep.R; } try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { } }
    apply(!on);
  }
  $("pnL").onclick = () => { st.L = !st.L; apply(!st.P); };
  $("pnR").onclick = () => { st.R = !st.R; apply(!st.P); };
  $("pnP").onclick = () => present(!st.P);
  // the site drawing (picture and / or CAD lines) on and off – handy to check where a crane can really go
  const hasDrw = () => !!(plan.site.bg && (plan.site.bg.url || plan.site.bg.asset)) || !!(plan.site.cad && typeof CADS !== "undefined" && CADS[plan.site.cad.id]);
  const drwOn = () => (plan.site.bg && (plan.site.bg.url || plan.site.bg.asset) && plan.site.bg.show !== false) || (plan.site.cad && plan.site.cad.show !== false && typeof CADS !== "undefined" && !!CADS[plan.site.cad.id]);
  function drwState() { const b = $("pnD"); if (!b) return; const h = hasDrw(); b.disabled = !h; b.setAttribute("aria-pressed", String(!!(h && drwOn()))); b.title = h ? b.title : "No site drawing in this plan – import one with Import site layout"; }
  function drwToggle() { if (!hasDrw()) return; const on = !drwOn(), cad = plan.site.cad && typeof CADS !== "undefined" && CADS[plan.site.cad.id];
    if (cad && cad.traced) { plan.site.cad.show = on; if (plan.site.bg) plan.site.bg.show = false; }   // the traced lines stand in for the scanned picture
    else { if (plan.site.bg) plan.site.bg.show = on; if (plan.site.cad) plan.site.cad.show = on; } markDirty(); renderAll(); if (typeof renderLayoutTools === "function") try { renderLayoutTools(); } catch (e) { } drwState(); if (typeof V3 !== "undefined" && V3.mode !== "top") render3D(); }
  $("pnD").onclick = drwToggle;
  { const _ra = renderAll; renderAll = function (...a) { const r = _ra.apply(this, a); try { drwState(); } catch (e) { } return r; }; }
  ex.onclick = () => present(false);
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && st.P) present(false); });
  document.addEventListener("keydown", e => {
    const t = e.target; if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) || document.querySelector("dialog[open]")) return;
    if (e.key === "[") { st.L = !st.L; apply(!st.P); e.preventDefault(); }
    else if (e.key === "]") { st.R = !st.R; apply(!st.P); e.preventDefault(); }
    else if (e.key === "p" || e.key === "P") { present(!st.P); e.preventDefault(); }
    else if (e.key === "d" || e.key === "D") { drwToggle(); e.preventDefault(); }
    else if (e.key === "Escape" && st.P) present(false);
  });
  apply(false);
})();
