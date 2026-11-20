// ================= Text size & colour =================
// plan.site.txt = {size: %, color}; any crane / load / site item can override with obj.txt = {size: %, color}
function txtOwner(key) {
  const [k, id] = key.split(":");
  if (["crane", "boom", "tip"].includes(k)) return plan.cranes.find(c => c.id === id);
  if (["load", "travel"].includes(k)) return plan.loads.find(l => l.id === id);
  if (k === "obs") return plan.obstacles.find(o => o.id === id);
  return null;
}
function txtStyleOf(o) {
  const G = (plan.site && plan.site.txt) || {}, T = (o && o.txt) || {};
  return { k: (+G.size || 100) / 100 * (+T.size || 100) / 100, color: T.color || G.color || null };
}
function styleTexts(parts) {
  for (const p of parts) {
    if (p.ui) continue;
    const st = txtStyleOf(txtOwner(p.key));
    if (st.k === 1 && !st.color) continue;
    p.scene.items = p.scene.items.map(it => it.t === "text" ? { ...it, size: it.size * st.k, color: st.color || it.color } : it);
  }
  return parts;
}
// one set of controls: "Apply to" = all text, or one crane / load / site item
let txtTarget = "";   // "" = all text
function txtTargets() {
  return [["", "All text on the plan"],
    ...plan.cranes.map(c => ["crane:" + c.id, "Crane – " + (c.label || "crane")]),
    ...plan.loads.map(l => ["load:" + l.id, "Load – " + (l.name || "load")]),
    ...plan.obstacles.map(o => ["obs:" + o.id, (o.kind === "dim" ? "Dimension – " : o.zone ? "Zone – " : "Site item – ") + (o.label || (o.kind === "dim" ? "measure" : "item"))])];
}
function txtObj() { if (!txtTarget) return null; return txtOwner(txtTarget.replace(/^obs:/, "obs:")) || null; }
function renderTxtBox() {
  if (!$("txtTarget")) return;
  const T = txtTargets(); if (!T.some(t => t[0] === txtTarget)) txtTarget = "";
  $("txtTarget").innerHTML = T.map(([v, t]) => `<option value="${v}" ${v === txtTarget ? "selected" : ""}>${escH(t)}</option>`).join("");
  const o = txtObj(), st = (o ? o.txt : plan.site.txt) || {};
  $("txtSize").value = String(st.size || 100); $("txtColOn").checked = !!st.color; $("txtCol").value = st.color || "#16202a"; $("txtCol").disabled = !st.color;
  $("txtNote").textContent = o ? "Only this item's labels. It is sized on top of the all-text setting." : "Every label on the plan, 3D/side views and exports. Pick an item above to change just that one.";
}
function setTxt(patch, live) {
  const o = txtObj();
  if (o) o.txt = { ...(o.txt || {}), ...patch }; else plan.site.txt = { ...(plan.site.txt || {}), ...patch };
  markDirty(live); renderSite();
}
$("txtTarget").onchange = e => { txtTarget = e.target.value; renderTxtBox(); };
$("txtSize").onchange = e => setTxt({ size: +e.target.value });
$("txtColOn").onchange = e => { $("txtCol").disabled = !e.target.checked; setTxt({ color: e.target.checked ? $("txtCol").value : "" }); };
$("txtCol").oninput = e => { if ($("txtColOn").checked) setTxt({ color: e.target.value }, true); };
$("txtReset").onclick = () => { const o = txtObj(); if (o) delete o.txt; else delete plan.site.txt; markDirty(); renderTxtBox(); renderSite(); };
{ const _rl = renderLists; renderLists = function (...a) { _rl(...a); renderTxtBox(); }; }
renderTxtBox();
