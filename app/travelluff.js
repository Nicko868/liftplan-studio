// ================= Boom up while slewing =================
// The straight pick→set path changes the radius evenly. When that path takes the load into something it can't be
// lifted over (not enough hook height) or over a no-go area, the operator booms up as he slews: a shorter radius gives
// more hook height and moves the load in, past the obstacle. Here, for each step of the slew, the smallest boom-up
// that clears everything is found; it is then eased in and out (≤ LUFF_RATE m of radius per step) so the luffing is
// gradual, and checked again. The lift sequence, the plan ghosts and the checks all use the boomed-up path.
const LUFF_STEP = 0.25, LUFF_RATE = 0.6;
const LUFF_CACHE = new Map(); let LUFF_BUSY = false;
function luffSig(ld, tp) {
  const c = tp.crane;
  return JSON.stringify([ld.id, ld.pick, ld.set, ld.travelDir, ld.rig, ld.weight, c.x, c.y, c.L, c.model, c.chartId, c.boomCfg, c.attach, c.blockCap, c.hookBlock,
    plan.obstacles.filter(o => !isMat(o)).map(o => [o.id, o.x, o.y, o.w, o.h, o.r, o.rot, o.hgt, o.pts, o.zone, o.zt, o.type])]);
}
{ const _tp = travelPath; travelPath = function (ld) {
    const tp = _tp(ld);
    try {
      if (!tp || !tp.hooks || !tp.crane || tp.hooks.length < 3) return tp;
      const key = luffSig(ld, tp); if (LUFF_CACHE.has(key)) return LUFF_CACHE.get(key);
      if (LUFF_BUSY) return tp; let out; LUFF_BUSY = true; try { out = luffPath(ld, tp) || tp; } finally { LUFF_BUSY = false; }
      if (LUFF_CACHE.size > 60) LUFF_CACHE.clear(); LUFF_CACHE.set(key, out);
      return out;
    } catch (e) { console.warn("luff", e); return tp; }
  }; }
function luffPath(ld, tp) {
  const cr = tp.crane, C = REG.cranes[cr.model]; if (!C) return null;
  const e0 = evalCrane(cr, "pick"), e1 = evalCrane(cr, "set"), chart = e0.chart, W = Math.max(e0.hookLoad || 0, e1.hookLoad || 0);   // not craneSummary – it uses this path
  const n = tp.hooks.length, br = tp.hooks.map(h => Math.atan2(h[0] - cr.x, h[1] - cr.y)), R0 = tp.hooks.map(h => Math.hypot(h[0] - cr.x, h[1] - cr.y));
  const off = tp.pts.map((p, i) => [p[0] - tp.hooks[i][0], p[1] - tp.hooks[i][1]]);
  const at = (i, R) => { const h = [cr.x + R * Math.sin(br[i]), cr.y + R * Math.cos(br[i])]; return { h, p: [h[0] + off[i][0], h[1] + off[i][1]] }; };
  const ba = R => boomAngle(C, cr.L, R);
  const capOK = R => { if (!chart) return true; const k = craneCapacity(C, cr, chart, R); return k.cap != null && k.cap >= W; };
  const ctx = { rigH: loadRigHeight(ld, plan.cranes.filter(c => c.attach?.load === ld.id).length > 1), ends: [tp.pts[0], tp.pts[tp.pts.length - 1]] };
  const hitsAt = (i, R) => { const q = at(i, R); return obstacleHits(ld, { pts: [q.p], hooks: [q.h], rots: [tp.rots[i]] }, ctx).names; };
  const stepOK = (i, R) => ba(R).ok && capOK(R) && !hitsAt(i, R).length;
  const bad = []; for (let i = 1; i < n - 1; i++) if (!stepOK(i, R0[i])) bad.push(i);
  if (!bad.length) return null;
  // try booming up (load comes in – more hook height, more capacity) and booming down (load goes out); keep what works with the least luffing
  const tryDir = sg => {
    const need = new Array(n).fill(0); let why = null;
    for (const i of bad) {
      let d = LUFF_STEP, ok = false, last = null;
      for (; d < 60; d += LUFF_STEP) { const R = R0[i] - sg * d; if (R < 1) { why = why || "the radius can't get any smaller"; break; }
        const b = ba(R); if (!b.ok) { why = why || (sg > 0 ? `the boom tops out at ${fx(C.maxAngle, 0)}° (R ${fx(R + LUFF_STEP, 1)} m)` : "the boom can't reach further"); break; }
        if (!capOK(R)) { const k = chart ? craneCapacity(C, cr, chart, R) : null; why = why || (k && k.cap == null ? `R ${fx(R, 1)} m is ${sg > 0 ? "inside the load chart's smallest" : "past the load chart's largest"} radius` : `not enough capacity at R ${fx(R, 1)} m`); break; }
        const h = hitsAt(i, R); if (!h.length) { ok = true; break; } last = h; }
      if (!ok) return { ok: false, why: why + (last && last.length ? ` – still ${last.join(", ")}` : "") };
      need[i] = d;
    }
    let D = need.map((_, i) => Math.max(...need.map((v, j) => v - LUFF_RATE * Math.abs(i - j)))); D[0] = 0; D[n - 1] = 0;
    const verify = arr => arr.every((d, i) => i === 0 || i === n - 1 || stepOK(i, R0[i] - sg * d));
    if (!verify(D)) { D = need; if (!verify(D)) return { ok: false, why: "no smooth luffing path clears everything" }; }
    return { ok: true, D, sg, max: Math.max(...D) };
  };
  const up = tryDir(1), dn = up.ok ? { ok: false, why: "not needed" } : tryDir(-1);
  // boom up whenever it works (shorter radius: more capacity, more hook height); boom down only when booming up cannot clear it
  const best = up.ok ? up : dn.ok ? dn : null;
  if (!best) return { ...tp, luffFail: `booming up: ${up.why}; booming down: ${dn.why}` };
  const hooks = [], pts = [];
  for (let i = 0; i < n; i++) { const q = at(i, R0[i] - best.sg * best.D[i]); hooks.push(q.h); pts.push(q.p); }
  const iMax = best.D.indexOf(best.max), Rx = R0[iMax] - best.sg * best.D[iMax];
  const cleared = [...new Set(bad.flatMap(i => hitsAt(i, R0[i])).map(s => s.replace(/ \(.*$/, "")))];
  return { ...tp, hooks, pts, luff: { Rmin: Rx, R0: R0[iMax], a0: ba(R0[iMax]).theta, a1: ba(Rx).theta, at: iMax / (n - 1), boom: best.max, up: best.sg > 0, names: cleared } };
}
// the travel label on the plan says so
{ const _ts = travelScene; travelScene = function (ld, tp) {
    const s = _ts(ld, tp);
    try { if (tp && tp.luff) { const i = Math.round(tp.luff.at * (tp.pts.length - 1)), p = tp.pts[i];
      s.text("DIMS", [p[0], p[1] - 1.2], `${tp.luff.up ? "boom up" : "boom down"} ${fx(tp.luff.boom, 1)} m to R ${fx(tp.luff.Rmin, 1)} m`, 0.55, { bold: true, color: "#1f6f43" }); } } catch (e) { console.warn(e); }
    return s;
  }; }
// checks panel: a line under the lift sequence / travel
{ const _rc = renderChecks; renderChecks = function (...a) {
    const r = _rc.apply(this, a);
    try {
      const box = $("checks"); if (!box) return r;
      for (const ld of plan.loads) { const tp = travelPath(ld); if (!tp || !tp.luff) continue;
        const d = document.createElement("div"); d.className = "card"; d.style.marginBottom = "10px";
        d.innerHTML = `<div class="ch"><b>${tp.luff.up ? "Boom up" : "Boom down"} while slewing · ${escH(ld.name)}</b></div><p class="small" style="padding:6px 10px;margin:0">${tp.luff.names.length ? escH(tp.luff.names.join(", ")) + " in the way – " : ""}${tp.luff.up ? "boom up" : "boom down"} ${fx(tp.luff.boom, 1)} m to R ${fx(tp.luff.Rmin, 1)} m during the slew.</p>`;
        box.prepend(d); }
    } catch (e) { console.warn(e); }
    return r;
  }; }

// when no luffing path works, say why next to the clash
{ const _ct = clashText; clashText = function (hit, ...a) { const t = _ct(hit, ...a); return hit && hit.luffFail ? `${t} (${hit.luffFail})` : t; }; }
{ const _oh = obstacleHits; obstacleHits = function (ld, tp, ...a) { const r = _oh(ld, tp, ...a); if (tp && tp.luffFail && r.names.length) r.luffFail = tp.luffFail; return r; }; }
