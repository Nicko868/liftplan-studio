// ================= Copy & paste site items and loads =================
// Ctrl+C copies the selected site item (or load), Ctrl+V pastes a copy where the mouse is on the plan
// (or a few metres off the original), Ctrl+D duplicates in place. Also the ⧉ Copy / Paste buttons in the toolbar.
(() => {
  const CB = { item: null, kind: null, n: 0, mouse: null, mouseT: 0 };
  const site = $("site");
  if (site) site.addEventListener("mousemove", e => { try { CB.mouse = toWorld(e); CB.mouseT = Date.now(); } catch (err) { } });
  const centre = o => o.kind === "poly" || o.kind === "line" || o.kind === "dim" ? centroid(o.pts || []) : [+o.x || 0, +o.y || 0];
  const moveObj = (o, dx, dy) => { if (o.pts) o.pts = o.pts.map(p => [+(p[0] + dx).toFixed(3), +(p[1] + dy).toFixed(3)]); if (o.x != null) { o.x = +(o.x + dx).toFixed(3); o.y = +(o.y + dy).toFixed(3); } };
  function current() {
    if (!sel) return null;
    if (sel.kind === "obs") { const o = plan.obstacles.find(x => x.id === sel.id); return o && !o.locked ? { kind: "obs", item: clone(o) } : null; }
    if (sel.kind === "load") { const l = plan.loads.find(x => x.id === sel.id); return l ? { kind: "load", item: clone(l) } : null; }
    return null;
  }
  function copy() { const c = current(); if (!c) { toast("Select a site item or a load to copy"); return false; } CB.item = c.item; CB.kind = c.kind; CB.n = 0; toast(`Copied “${c.item.label || c.item.name || "item"}” – Ctrl+V to paste`, 2200); refresh(); return true; }
  function paste(inPlace) {
    if (!CB.item) { toast("Nothing copied yet – select an item and press Ctrl+C"); return; }
    CB.n++;
    const src = CB.item, atMouse = !inPlace && CB.mouse && Date.now() - CB.mouseT < 20000;
    if (CB.kind === "obs") {
      const o = clone(src); o.id = uid(); delete o.at; delete o.locked; if (o.cranes) o.cranes = []; if (isMat(o)) { if ((plan.lifts || []).length > 1) o.lift = curLiftId(); else delete o.lift; }
      const c = centre(o), t = atMouse ? [CB.mouse[0] - c[0], CB.mouse[1] - c[1]] : [3 * CB.n, -3 * CB.n];
      moveObj(o, t[0], t[1]); plan.obstacles.push(o); sel = { kind: "obs", id: o.id };
    } else {
      const l = clone(src); l.id = uid(); delete l.sheetEdits;
      const t = atMouse ? [CB.mouse[0] - l.pick.x, CB.mouse[1] - l.pick.y] : [3 * CB.n, -3 * CB.n];
      for (const ph of ["pick", "set"]) if (l[ph]) { l[ph] = { x: +(l[ph].x + t[0]).toFixed(3), y: +(l[ph].y + t[1]).toFixed(3), h: l[ph].h || 0, rot: l[ph].rot || 0 }; }
      ensureRig(l); normLoad(l); plan.loads.push(l); sel = { kind: "load", id: l.id };
    }
    markDirty(); renderAll();
  }
  function dup() { if (copy()) paste(true); }
  // toolbar buttons next to undo / redo
  const undo = $("tUndo")?.parentNode;
  if (undo) { const seg = document.createElement("span"); seg.className = "seg";
    seg.innerHTML = `<button id="cbCopy" title="Copy the selected site item or load (Ctrl+C)">⧉ Copy</button><button id="cbPaste" title="Paste a copy where the mouse is (Ctrl+V) – Ctrl+D duplicates in place" disabled>Paste</button>`;
    undo.parentNode.insertBefore(seg, undo.nextSibling);
    $("cbCopy").onclick = copy; $("cbPaste").onclick = () => paste(false); }
  function refresh() { if ($("cbPaste")) $("cbPaste").disabled = !CB.item; if ($("cbCopy")) $("cbCopy").disabled = !current(); }
  { const _ra = renderAll; renderAll = function (...a) { const r = _ra.apply(this, a); try { refresh(); } catch (e) { } return r; }; }
  document.addEventListener("keydown", e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const t = e.target; if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
    if (document.querySelector("dialog[open]")) return;
    if (String(window.getSelection?.() || "").trim()) return;   // copying text on the page works as normal
    const k = e.key.toLowerCase();
    if (k === "c") { if (current()) { copy(); e.preventDefault(); } }
    else if (k === "v") { if (CB.item) { paste(false); e.preventDefault(); } }
    else if (k === "d") { if (current()) { dup(); e.preventDefault(); } }
  });
  refresh();
})();
