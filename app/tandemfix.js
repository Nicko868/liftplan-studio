// ================= Two cranes on one load = tandem rigging (and back) =================
// Second crane hooked on  -> switch to the matching tandem set-up (each crane to its own end), keeping the one-crane rigging.
// Back down to one crane  -> put the one-crane rigging back (keeping the tandem one in case the second crane comes back).
const TANDEM_TO_SINGLE = { tandem_sb: "sb" };
function fixTandems() {
  const msgs = [];
  for (const ld of plan.loads) {
    const on = plan.cranes.filter(c => c.attach?.load === ld.id && REG.cranes[c.model]);
    const n = on.length, prev = ld.nCr ?? n; ld.nCr = n;
    if (n >= 2) {
      if (ld.rig?.arr === "build" && +ld.rig.cranes !== 2) { const R = ld.rig; ld.rigSingle = clone(R); R.cranes = 2; if (!R.topB) R.topB = clone(R.top || []); if (!R.legB) R.legB = clone(R.leg || []); if (!R.legNB) R.legNB = 1; msgs.push(`${ld.name}: 2 cranes hooked on – your built rigging is now a tandem (crane A / crane B). Open Rigging… to set where each crane connects.`); }
      else if (ld.rig?.arr !== "tandem" && !(ld.rig?.arr === "build" && +ld.rig.cranes === 2)) {
        if (ld.rig?.arr) ld.rigSingle = clone(ld.rig);
        if (ld.rigTandem?.arr === "tandem") { ld.rig = clone(ld.rigTandem); msgs.push(`${ld.name}: 2 cranes hooked on – your tandem rigging is back.`); }
        else {
          const had = ld.rig?.arr, id = had && (ld.rig.beam || had === "spreader") ? "tandem_sb" : (had === "bridle4" || (+ld.spanY > 0 && had === "bridle2")) ? "tandem_br" : "tandem";
          applyPreset(ld, id); ld.rig.auto = true;
          msgs.push(`${ld.name}: 2 cranes hooked on – rigging switched to "${RIG_PRESETS.find(p => p.id === id).name}". Open Rigging… to confirm.`);
        }
      }
      // each crane on its own end
      const pts = on.slice(0, 2).map(c => c.attach.point || "C");
      if (pts[0] === pts[1] || pts.includes("C")) {
        const A = liftPointWorld(ld, "A", "pick"), B = liftPointWorld(ld, "B", "pick"), d = (c, p) => Math.hypot(c.x - p[0], c.y - p[1]), [c1, c2] = on;
        if (d(c1, A) + d(c2, B) <= d(c1, B) + d(c2, A)) { c1.attach.point = "A"; c2.attach.point = "B"; } else { c1.attach.point = "B"; c2.attach.point = "A"; }
      }
    } else if (prev >= 2 && ld.rig?.arr === "build" && +ld.rig.cranes === 2) {
      ld.rig.cranes = 1; msgs.push(`${ld.name}: one crane now – the built rigging is back to one hook (crane A's side).`);
      for (const c of on) c.attach.point = "C";
    } else if (prev >= 2 && ld.rig?.arr === "tandem") {
      // a crane came off: revert to one-crane rigging
      ld.rigTandem = clone(ld.rig);
      if (ld.rigSingle?.arr && ld.rigSingle.arr !== "tandem") { ld.rig = clone(ld.rigSingle); msgs.push(`${ld.name}: one crane now – rigging reverted to "${rigName(ld.rig)}".`); }
      else {
        const id = TANDEM_TO_SINGLE[ld.rig.preset] || (ld.rig.tmode === "spreader" ? "sb" : null);
        const fb = suggestPreset(ld);   // with one crane this gives the normal single-hook set-up
        applyPreset(ld, id && RIG_PRESETS.some(p => p.id === id) ? id : fb); ld.rig.auto = true;
        msgs.push(`${ld.name}: one crane now – rigging changed to "${rigName(ld.rig)}". Open Rigging… to confirm.`);
      }
      for (const c of on) c.attach.point = "C";   // single hook over the centre of gravity
    }
  }
  if (msgs.length) {
    toast(msgs.join(" "), 5000); dirty = true; refreshSaveState();
    // fold the rigging change into the step that caused it, so one Ctrl+Z undoes both
    if (hist.stack.length && hist.i >= 0) hist.stack[hist.i] = JSON.stringify(plan); else pushHistory();
  }
}
{ const _ra = renderAll; renderAll = function (k) { try { fixTandems(); } catch (e) { console.warn(e); } _ra(k); }; }

// hook height: can the crane actually lift the load + rigging this high under its boom head?
{ const _cs = craneSummary; craneSummary = function (cr) { const S = _cs(cr);
  try { for (const ph of ["pick", "set"]) { const ev = S.ph?.[ph] || evalCrane(cr, ph); const ld = ev.load; if (!ld || ev.free || !ev.C || !ev.ba) continue;
    const need = (+ld[ph].h || 0) + loadRigHeight(ld, ev.tandem), max = hookMaxZ(cr, ev);
    if (need > max + 0.01) { S.warn.push(`${ph === "pick" ? "Pick" : "Set"}: not enough hook height – the hook needs to be at ${fx(need, 1)} m but under this boom it can only reach ${fx(max, 1)} m with the block ${fx(TRAVEL_A2B, 1)} m under the head for the anti-two-block (${fx(need - max, 1)} m short). Lengthen the boom, raise the luffing angle, or shorten the rigging.`); S.status = "bad"; } } } catch (e) { console.warn(e); }
  return S; }; }
