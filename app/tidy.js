// ================= Tidy layout: grouped site-items list and one "View" menu =================
// Site items fold into groups (Ground & shore, Structures, Tanks, Marine, Transport, Zones & areas, Measurements, Other)
// that open and close, with a search box once the list is long. The view switches (panels, drawing, CAD style, names)
// live in one View ▾ menu instead of a row of buttons. Nothing is removed – every switch is still one click away.
(() => {
  const GROUPS = [
    ["ground", "Ground & shore", o => ["deck", "quay", "rock", "road", "laydown", "area", "water", "wall", "fence"].includes(o.type) && !o.zone],
    ["struct", "Buildings & structures", o => ["building", "warehouse", "cabin", "stack", "pipes", "mast", "powerline"].includes(o.type)],
    ["tanks", "Tanks", o => o.type === "tank"],
    ["marine", "Marine", o => (typeof isVessel === "function" && isVessel(o)) || ["jetty", "dolphin", "bollard", "fender"].includes(o.type)],
    ["trans", "Transport & plant", o => (typeof isTransport === "function" && isTransport(o)) || ["truck", "trailer", "forklift", "telehandler", "mewp", "person"].includes(o.type)],
    ["zones", "Zones", o => !!o.zone],
    ["dims", "Measurements", o => o.kind === "dim"],
    ["other", "Other", () => true]
  ];
  const KEY = "lps_objgroups";
  let open = {}; try { open = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { }
  const saveOpen = () => { try { localStorage.setItem(KEY, JSON.stringify(open)); } catch (e) { } };
  let filt = "";
  const css = document.createElement("style");
  css.textContent = `.ogrp{border:1px solid var(--line2);border-radius:6px;margin:0 0 6px;background:var(--surface)}.ogrp>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:6px 9px;font-size:12.5px;font-weight:600;color:var(--ink)}.ogrp>summary::-webkit-details-marker{display:none}.ogrp>summary:before{content:"▸";font-size:10px;color:var(--muted);transition:transform .15s}.ogrp[open]>summary:before{transform:rotate(90deg)}.ogrp>summary .n{margin-left:auto;font-weight:400;color:var(--muted);font-size:11.5px}.ogrp>.list{padding:0 6px 6px}#objFilt{width:100%;margin:0 0 6px;font-size:13px}
#vwMenu{position:relative;display:inline-flex}#vwPop{position:absolute;top:calc(100% + 4px);left:0;z-index:40;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.18);padding:6px 4px;min-width:250px;display:none}#vwPop.on{display:block}
#vwPop .vi{display:flex!important;flex-direction:row!important;margin:0;font-weight:400;align-items:center;gap:9px;padding:6px 10px;border-radius:5px;cursor:pointer;font-size:13px;white-space:nowrap}#vwPop .vi:hover{background:var(--sunk)}#vwPop .vi input{width:auto;margin:0}#vwPop .vi kbd{margin-left:auto;font:11px var(--mono);color:var(--muted)}#vwPop hr{border:0;border-top:1px solid var(--line2);margin:4px 6px}#vwPop .vh{font-size:11px;color:var(--muted);padding:4px 10px 2px;text-transform:uppercase;letter-spacing:.04em}`;
  document.head.append(css);
  // ---------- grouped list ----------
  function group() {
    const list = $("obsList"); if (!list) return;
    const rows = [...list.querySelectorAll(':scope > [data-sel^="obs:"]')]; if (!rows.length) return;
    const byId = new Map(plan.obstacles.map(o => [o.id, o])), buckets = new Map(GROUPS.map(g => [g[0], []]));
    for (const r of rows) { const o = byId.get(r.dataset.sel.slice(4)); if (!o) continue; const g = GROUPS.find(g => g[2](o)); buckets.get(g[0]).push(r); }
    const many = rows.length > 10, q = filt.trim().toLowerCase();
    const frag = document.createDocumentFragment();
    if (many) { const inp = document.createElement("input"); inp.id = "objFilt"; inp.type = "search"; inp.placeholder = `Find a site item (${rows.filter(r => !r.hidden).length})…`; inp.value = filt;
      inp.oninput = () => { filt = inp.value; const pos = inp.selectionStart; renderLists(); const n = $("objFilt"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } }; frag.append(inp); }
    for (const [k, name] of GROUPS) {
      let rs = buckets.get(k).filter(r => !r.hidden); if (!rs.length) continue;
      const hidden = buckets.get(k).filter(r => r.hidden);
      if (q) rs = rs.filter(r => (r.textContent || "").toLowerCase().includes(q)); if (!rs.length) continue;
      const hasSel = rs.some(r => r.classList.contains("sel"));
      const d = document.createElement("details"); d.className = "ogrp"; d.dataset.g = k;
      d.open = !!q || hasSel || (open[k] ?? (!many));
      d.innerHTML = `<summary>${name}<span class="n">${rs.length}</span></summary>`;
      const inner = document.createElement("div"); inner.className = "list"; rs.forEach(r => inner.append(r)); hidden.forEach(r => inner.append(r)); d.append(inner);
      d.addEventListener("toggle", () => { if (!q) { open[k] = d.open; saveOpen(); } });
      frag.append(d);
    }
    list.innerHTML = ""; list.append(frag);
  }
  { const _rl = renderLists; renderLists = function (...a) { const r = _rl.apply(this, a); try { group(); } catch (e) { console.warn(e); } return r; }; }
  // ---------- one View menu ----------
  const bar = document.querySelector(".toolbar"); if (!bar) return;
  const items = [
    ["pnL", "Left panel (cranes, loads, site)", "["], ["pnR", "Checks panel", "]"], null,
    ["pnD", "Site drawing under the plan", "D"], ["psBtn", "CAD style – white, outlines", ""], null
  ];
  const segOf = id => $(id)?.closest(".seg");
  const w = document.createElement("span"); w.id = "vwMenu";
  w.innerHTML = `<button id="vwBtn" title="Panels, site drawing, plan style and names">View ▾</button><div id="vwPop" role="menu"></div>`;
  const pres = $("pnP");
  // the Present button stays on its own; everything else moves into the menu
  if (pres) { const ps = document.createElement("span"); ps.className = "seg"; pres.parentNode.removeChild(pres); ps.append(pres); bar.insertBefore(ps, $("cursorXY")); bar.insertBefore(w, ps); }
  else bar.insertBefore(w, $("cursorXY"));
  for (const id of ["pnL", "psBtn", "nmBtn"]) { const s = segOf(id) || $(id)?.parentNode; if (s && s !== w) s.style.display = "none"; }
  const pop = $("vwPop");
  const pressed = id => $(id)?.getAttribute("aria-pressed") === "true";
  function fill() {
    const names = (typeof NAMES_KEYS !== "undefined" ? NAMES_KEYS : []);
    pop.innerHTML = items.map(it => it ? `<label class="vi"${$(it[0])?.disabled ? ' style="opacity:.5"' : ""}><input type="checkbox" data-vb="${it[0]}" ${pressed(it[0]) ? "checked" : ""} ${$(it[0])?.disabled ? "disabled" : ""}> ${it[1]}${it[2] ? `<kbd>${it[2]}</kbd>` : ""}</label>` : "<hr>").join("")
      + (names.length ? `<div class="vh">Names on the plan <kbd style="float:right">N</kbd></div>` + names.map(([k, t]) => `<label class="vi"><input type="checkbox" data-vn="${k}" ${namesOn(k) ? "checked" : ""}> ${t}</label>`).join("") : "");
    pop.querySelectorAll("[data-vb]").forEach(el => el.onchange = () => { $(el.dataset.vb)?.click(); setTimeout(fill, 30); });
    pop.querySelectorAll("[data-vn]").forEach(el => el.onchange = () => { plan.site.names = { ...(plan.site.names || {}), [el.dataset.vn]: el.checked }; markDirty(); if (typeof GL !== "undefined") GL.sig = ""; renderAll(); if (typeof V3 !== "undefined" && V3.mode !== "top") render3D(); });
  }
  $("vwBtn").onclick = e => { e.stopPropagation(); fill(); pop.classList.toggle("on"); };
  document.addEventListener("click", e => { if (!w.contains(e.target)) pop.classList.remove("on"); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") pop.classList.remove("on"); });
})();
