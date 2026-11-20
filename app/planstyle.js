// ================= Plan drawing style: CAD outline (default) or shaded =================
// Outline: white background, site items as lines only (no grey fills), weights by importance –
// thin grey for the background drawing, medium black for structures and edges, the lift itself (cranes, boom, swing,
// load, travel path, superlift, mats, transport) keeps its colours so it stands out. Same on screen and on the sheets.
// The 3D view is not affected. plan.site.style = "outline" | "shaded".
const siteStyle = () => (plan.site && plan.site.style) || "outline";
const PS_FLAT = new Set(["deck", "road", "laydown", "area", "rock", "quay", "water"]);
function psOutline(s, o) {
  if (!s || !s.items) return s;
  if (o.zone || o.kind === "dim" || (typeof isMat === "function" && isMat(o)) || (typeof isTransport === "function" && isTransport(o)) || o.type === "powerline" || o.type === "person") return s;
  const ves = typeof isVessel === "function" && isVessel(o);
  const flat = PS_FLAT.has(o.type) || ((typeof objPass === "function" ? objPass(o) : o.pass) && (+o.hgt || 0) <= 0.05);
  const edge = o.type === "deck" || o.type === "quay";
  const col = ves ? "#1f4e79" : edge ? "#1f262d" : flat ? "#5b6570" : "#1f262d", wMax = edge ? 1.8 : flat ? 0.9 : 1.3;
  for (const it of s.items) {
    if (it.t === "text") { if (it.L === "TEXT" && !ves) it.color = "#3b444d"; continue; }
    if (it.t === "image") continue;
    // keep an invisible fill (not "none") so the inside of an area can still be clicked to select it
    if (it.fill && it.fill !== "none") it.fill = o.type === "water" ? "rgba(58,134,200,.07)" : "rgba(255,255,255,0.003)";
    it.color = col; if (it.w != null) it.w = Math.min(+it.w || wMax, wMax); else it.w = wMax;
  }
  return s;
}
{ const _os = obsScene; obsScene = function (o, ...a) { const s = _os.call(this, o, ...a); return siteStyle() === "outline" ? psOutline(s, o) : s; }; }
// white paper, a lighter grid and the background drawing in thin grey under the objects
{ const _gm = gridMarkup; gridMarkup = function (b) { const m = _gm(b); return siteStyle() === "outline" ? m.replace('stroke="#d9dee4"', 'stroke="#eceff2"') : m; }; }
{ const _cm = cadMarkup; cadMarkup = function (...a) {
    const c = plan.site.cad, D = c && typeof CADS !== "undefined" && CADS[c.id]; if (!D || siteStyle() !== "outline") return _cm.apply(this, a);
    const keep = c.col; c.col = D.traced ? "#8a939c" : (keep || "#7b8590"); try { return _cm.apply(this, a); } finally { c.col = keep; }
  }; }
function psPaper() { const on = siteStyle() === "outline"; document.body.classList.toggle("cadstyle", on); const L = $("cadLayer"); if (L) L.style.background = on ? "#ffffff" : "#f7f8f9"; const b = $("psBtn"); if (b) { b.setAttribute("aria-pressed", String(on)); b.textContent = on ? "◻ CAD style" : "▩ Shaded"; } }
{ const _ra = renderAll; renderAll = function (...a) { try { psPaper(); } catch (e) { } return _ra.apply(this, a); }; }
(() => {
  const css = document.createElement("style"); css.textContent = `body.cadstyle #site{background:#ffffff}`; document.head.append(css);
  const anchor = $("nmWrap") || $("cursorXY"), seg = document.createElement("span"); seg.className = "seg";
  seg.innerHTML = `<button id="psBtn" aria-pressed="true" title="Plan style: CAD outline on white (as printed) or the shaded style">◻ CAD style</button>`;
  anchor.parentNode.insertBefore(seg, anchor);
  $("psBtn").onclick = () => { plan.site.style = siteStyle() === "outline" ? "shaded" : "outline"; markDirty(); renderAll(); };
  psPaper();
})();
