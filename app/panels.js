// ================= Properties panel: every "h4" starts a clear, collapsible section =================
const PSEC_CLOSED = new Set((() => { try { return JSON.parse(localStorage.getItem("lp_psec") || "[]"); } catch (e) { return []; } })());
function sectionizeProps(p) {
  if (!p) return;
  const kids = [...p.childNodes]; let cur = null;
  for (const n of kids) {
    if (n.nodeType === 1 && n.tagName === "H4") {
      const t = n.textContent.trim(), d = document.createElement("details"); d.className = "psec"; d.open = !PSEC_CLOSED.has(t);
      if (n.hasAttribute("hidden")) d.hidden = true;
      const sm = document.createElement("summary"); sm.textContent = t; d.appendChild(sm);
      d.addEventListener("toggle", () => { d.open ? PSEC_CLOSED.delete(t) : PSEC_CLOSED.add(t); try { localStorage.setItem("lp_psec", JSON.stringify([...PSEC_CLOSED])); } catch (e) { } });
      n.replaceWith(d); cur = d; continue;
    }
    if (cur && !(n.nodeType === 1 && n.tagName === "H3")) cur.appendChild(n);
  }
}
{ const _rp = renderProps; renderProps = function (...a) { const r = _rp.apply(this, a); try { sectionizeProps($("props")); } catch (e) { console.warn(e); } return r; }; }
// ---- keep typing flowing: when a field commits on blur the panel is rebuilt, so remember where the user was heading
// (the field they clicked, or the next field for Tab) and put the cursor back there in the rebuilt panel
let PF = null;
document.addEventListener("pointerdown", e => { const t = e.target.closest && e.target.closest("#props input, #props select, #props textarea"); PF = t && t.id ? t.id : null; }, true);
document.addEventListener("keydown", e => {
  if (e.key !== "Tab") return; const a = document.activeElement; if (!a || !a.closest || !a.closest("#props")) return;
  const all = [...$("props").querySelectorAll("input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea, button")].filter(x => x.offsetParent !== null);
  const i = all.indexOf(a), nx = all[i + (e.shiftKey ? -1 : 1)]; PF = nx && nx.id ? nx.id : null;
}, true);
{ const _rp2 = renderProps; renderProps = function (...a) {
  const want = PF; const r = _rp2.apply(this, a);
  if (want) setTimeout(() => { const el = document.getElementById(want); if (el && document.activeElement !== el && $("props").contains(el)) { el.focus(); if (el.select && el.type !== "range") try { el.select(); } catch (e) { } } PF = null; }, 0);
  return r; }; }

document.addEventListener("click", e => { const a = e.target.closest && e.target.closest("[data-selload]"); if (!a) return; e.preventDefault(); sel = { kind: "load", id: a.dataset.selload }; renderAll(); });
