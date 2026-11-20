// ================= Team use: who created / last saved each plan, and a warning before overwriting someone else's newer save =================
const TEAM = { me: null, user: null, names: {} };
(async () => { try { if (typeof LOCAL !== "undefined" && LOCAL) return; const u = await claude.use("user"); if (!u) return; TEAM.user = u; const me = await u.me(); TEAM.me = me && me.id ? me.id : null; if (TEAM.me && me.name) TEAM.names[TEAM.me] = me.name; } catch (e) { console.warn(e); } })();
async function teamResolve(ids) {
  ids = [...new Set(ids.filter(Boolean))].filter(id => !(id in TEAM.names)); if (!ids.length || !TEAM.user) return;
  try { const ps = await TEAM.user.profiles(ids); for (const id of ids) TEAM.names[id] = (ps[id] && ps[id].name) || ""; } catch (e) { console.warn(e); }
}
const teamName = id => !id ? "" : id === TEAM.me ? (TEAM.names[id] || "you") : (TEAM.names[id] || "a colleague");
const teamWhen = t => t ? new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
function teamLine(p = plan) {
  const bits = [];
  if (p.createdBy || p.createdAt) bits.push(`Created${p.createdBy ? " by " + teamName(p.createdBy) : ""}${p.createdAt ? " " + teamWhen(p.createdAt) : ""}`);
  if (p.savedBy || p.savedAt) bits.push(`Last saved${p.savedBy ? " by " + teamName(p.savedBy) : ""}${p.savedAt ? " " + teamWhen(p.savedAt) : ""}`);
  return bits.join(" · ");
}
function ago(t) { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : teamWhen(t); }

// save with a check: if the stored plan has moved on since you opened / last saved it, ask first
async function writePlan(asCopy) {
  syncLift(); const doc = clone(plan); if (doc.site.bg && !CAP.local) delete doc.site.bg.url;
  const now = Date.now();
  if (asCopy) { doc.id = uid(); doc.name = (doc.name || "Lift plan") + " (copy)"; doc.createdBy = TEAM.me; doc.createdAt = now; doc.rev = 0; }
  const cur = asCopy ? null : await CAP.db.doc("plans/" + doc.id).get().then(s => s.exists ? s.data() : null).catch(() => null);
  doc.rev = ((cur && +cur.rev) || +doc.rev || 0) + 1;
  doc.createdBy = (cur && cur.createdBy) || doc.createdBy || TEAM.me || null; doc.createdAt = (cur && cur.createdAt) || doc.createdAt || now;
  doc.savedBy = TEAM.me || null; doc.savedAt = now;
  await CAP.db.doc("plans/" + doc.id).set(doc);
  if (asCopy) { const q = clone(doc); if (q.site.bg?.asset && !CAP.local) q.site.bg.url = "/_blob/" + q.site.bg.asset; openPlan(q); }
  else { plan.rev = doc.rev; plan.createdBy = doc.createdBy; plan.createdAt = doc.createdAt; plan.savedBy = doc.savedBy; plan.savedAt = doc.savedAt; dirty = false; refreshSaveState(); }
  toast(asCopy ? "Saved as a copy – you are now working on the copy" : "Lift plan saved");
}
savePlan = async function () {
  if (!CAP.db) { toast("Saving isn't available in this view – export JSON instead."); return; }
  try {
    const cur = await CAP.db.doc("plans/" + plan.id).get().then(s => s.exists ? s.data() : null).catch(() => null);
    const mine = +plan.rev || 0, theirs = cur ? +cur.rev || 0 : 0;
    if (cur && theirs > mine) {
      await teamResolve([cur.savedBy]);
      const who = cur.savedBy ? teamName(cur.savedBy) : "Someone"; $("cfText").textContent = `${who.charAt(0).toUpperCase() + who.slice(1)}${cur.savedBy && cur.savedBy === TEAM.me ? " (you, in another window)" : ""} saved this plan ${cur.savedAt ? ago(cur.savedAt) : "since you opened it"}. Saving now would overwrite their changes.`;
      TEAM.pending = cur; $("dConflict").showModal(); return;
    }
    await writePlan(false);
  } catch (e) { toast(e.code === "quota_exceeded" ? "Storage full – delete old plans first." : "Couldn't save (" + (e.code || e) + ")"); }
};
$("bSave").onclick = savePlan;
$("cfLoad").onclick = () => { const cur = TEAM.pending; $("dConflict").close(); if (!cur) return; const q = clone(cur); if (q.site.bg?.asset && !CAP.local) q.site.bg.url = "/_blob/" + q.site.bg.asset; openPlan(q); toast("Their latest version is open – your unsaved changes were dropped", 3000); };
$("cfCopy").onclick = async () => { $("dConflict").close(); try { await writePlan(true); } catch (e) { toast("Couldn't save (" + (e.code || e) + ")"); } };
$("cfOver").onclick = async () => { $("dConflict").close(); try { await writePlan(false); } catch (e) { toast("Couldn't save (" + (e.code || e) + ")"); } };

// plans list: who created it and who saved it last
{ const _rp = renderPlans; renderPlans = function (...a) {
    const r = _rp.apply(this, a);
    const ids = planIndex.flatMap(p => [p.createdBy, p.savedBy]);
    const fill = () => $("plansGrid").querySelectorAll("[data-open]").forEach(b => { const p = planIndex.find(x => x.id === b.dataset.open); const card = b.closest(".pcard"); if (!p || !card) return;
      let el = card.querySelector(".pwho"); if (!el) { el = document.createElement("span"); el.className = "small pwho"; card.insertBefore(el, card.querySelector(".btnrow")); }
      el.textContent = [p.createdBy || p.createdAt ? `Created${p.createdBy ? " by " + teamName(p.createdBy) : ""}${p.createdAt ? " · " + teamWhen(p.createdAt) : ""}` : "", p.savedBy || p.savedAt ? `Last saved${p.savedBy ? " by " + teamName(p.savedBy) : ""} · ${ago(p.savedAt || p.updated)}` : ""].filter(Boolean).join("  ·  "); });
    fill(); teamResolve(ids).then(fill);
    return r; }; }
// someone else saves the plan you have open: say so straight away (your copy is not touched)
{ let lastWarned = 0; setInterval(() => {
    const p = planIndex.find(x => x.id === plan.id); if (!p) return;
    if ((+p.rev || 0) > (+plan.rev || 0) && p.savedBy !== TEAM.me && p.rev !== lastWarned) { lastWarned = p.rev; teamResolve([p.savedBy]).then(() => toast(`${(n => n.charAt(0).toUpperCase() + n.slice(1))(teamName(p.savedBy))} just saved a newer version of this plan – you'll be asked before your save overwrites it`, 4500)); }
  }, 4000); }
// resolve names used on the sheets before exporting
{ const _bs = buildSheets; buildSheets = async function (...a) { await teamResolve([plan.createdBy, plan.savedBy]); return _bs.apply(this, a); }; }

// ---- Home: close the plan and go back to the start screen (asks to save first)
function goHome() { planStarted = false; plan = normalizePlan(blankPlan()); allMode = false; sel = null; dirty = false; resetHistory(); renderMeta(); renderAll(); refreshSaveState(); if (typeof renderLiftBar === "function") renderLiftBar(); openStart(); }
function askHome() {
  const has = plan.cranes.length + plan.loads.length + plan.obstacles.length + (plan.lifts || []).reduce((a, L) => a + L.cranes.length + L.loads.length, 0);
  if (!dirty || !has) { goHome(); return; }
  $("hmText").textContent = `“${plan.name || "This plan"}” has unsaved changes.`; $("hmSave").hidden = !CAP.db; $("dHome").showModal();
}
$("bHome").onclick = askHome;
document.querySelector(".brand") && (document.querySelector(".brand").style.cursor = "pointer", document.querySelector(".brand").title = "Home", document.querySelector(".brand").onclick = askHome);
$("hmDrop").onclick = () => { $("dHome").close(); goHome(); };
$("hmSave").onclick = async () => { $("dHome").close(); await savePlan(); if (!dirty) goHome(); };   // a save that stops at the overwrite warning keeps you in the plan
// ---- Share: where the control is
if ($("bShare")) $("bShare").onclick = () => {
  $("shBody").innerHTML = CAP.local
    ? `<p>This is the <b>offline copy</b> saved on this computer – it can't be shared from here.</p><p class="small">To work as a team, open LiftPlan Studio from its claude.ai link and share it there. To move your plans across: here, <b>Lift plans → Back up</b>; in the online app, <b>Lift plans → Restore</b>.</p>`
    : `<ol style="margin:0 0 8px 18px;padding:0;line-height:1.6">
        <li>Use the <b>Share</b> button in the <b>claude.ai bar around this app</b> – top right, outside the app's dark header. (In the Claude desktop app, open the artifact from your gallery first if you don't see the bar.)</li>
        <li>Add colleagues by name or email, or open it to your organisation.</li>
        <li>Give anyone who <b>saves plans or adds cranes / rigging</b> access that lets them <b>interact or edit</b>. View-only people can open plans and export PDFs but can't save.</li></ol>
       <p class="small">Everyone works from the same plans and libraries. Names show against plans once people save, and you're warned before overwriting someone else's newer save.</p>`;
  $("dShare").showModal();
};
