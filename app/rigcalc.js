// ================= Rigging calculation – the working behind every item =================
// Method (BS 7121 / LEEA practice): the load is shared between the lifting points by moments about the centre of
// gravity; each sling's tension = its vertical share ÷ cos β (β = the leg angle to the vertical, UK / LEEA practice); every item's force is multiplied by
// a dynamic amplification factor (DAF, 1.1 onshore by default – set per plan or per load) and the item's rated
// working load (WLL / SWL, with the hitch factor for slings) must be at least that. Sling angles over 30° to the
// vertical are flagged, over 45° (90° included) are not accepted. For each item the smallest catalogue item that would pass is shown,
// so the gear can be sized from the calculation, or checked if it is the gear you already have.
const rcDaf = ld => +ld?.rigDaf > 0 ? +ld.rigDaf : +plan.site?.rigDaf > 0 ? +plan.site.rigDaf : (rule("rig.daf") ?? 1.1);
function rigCalc(ld) {
  const res = ld && ld.rig?.arr ? solveRig(ld) : null; if (!res) return null;
  const daf = rcDaf(ld), W = +ld.weight || 0, cog = +ld.cog || 0, d = loadDims(ld);
  // lifting point shares by moments along the load (the two points across one end share that end equally)
  const P = (res.lpPts || []).map(p => [p[0], p[1], p[2]]), xs = P.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
  const shares = P.map(p => { if (!P.length) return 0; if (x1 - x0 < 1e-6) return W / P.length; const nSide = P.filter(q => Math.abs(q[0] - p[0]) < 0.01).length; const side = p[0] > (x0 + x1) / 2 ? W * (cog - x0) / (x1 - x0) : W * (x1 - cog) / (x1 - x0); return side / nSide; });
  const beam = (res.beams || [])[0] || res.beam || null, zBeam = beam ? Math.min(beam.a[2], beam.b[2]) : null;
  const padLen = beam && ld.rig?.pad ? (ld.rig.pad || []).reduce((a, e) => a + (+eLen(e) || 0), 0) : 0;
  // every sling leg as drawn: its top end, the point it goes to, how far out and down, the fittings in line with it
  const legs = (res.seg || []).filter(g => g.e && RIG_TYPES[g.e.snap?.type]?.sling).map(g => {
    const hi = g.a[2] >= g.b[2] ? g.a : g.b, lo = hi === g.a ? g.b : g.a;
    const lp = P.map(q => ({ q, dd: Math.hypot(q[0] - lo[0], q[1] - lo[1], q[2] - lo[2]) })).sort((a, b) => a.dd - b.dd)[0];
    const end = lp && lp.dd < 1.0 ? lp.q : lo, H = Math.hypot(end[0] - hi[0], end[1] - hi[1]), V = hi[2] - end[2], Lt = Math.hypot(H, V);
    const role = !beam ? "leg" : hi[2] <= zBeam + 0.01 ? "drop" : "top";
    return { name: g.e.snap.name, e: g.e, hi, end, H, V, Lt, Ls: +g.e.len || 0, fromH: Math.atan2(V, Math.max(H, 1e-6)) / D2R, role, toLug: !!(lp && lp.dd < 1.0) };
  });
  const lib = typeof rigLibrary === "function" ? rigLibrary() : [];
  // hand check of the top legs (moments about the CoG at the top padeyes, each leg's own angle): if it is higher than
  // the 3D model's figure, the higher value is used for the top legs and everything in line with them
  let bumpOf = null, bumpTo = 0;
  { const rowsN = res.rows.filter(r => r.name), tops = (res.pads || []).filter(p => p[3] === "top").map(p => p[0]).sort((a, b) => a - b), tl = legs.filter(q => q.role === "top");
    const iS = tl.length ? rowsN.findIndex(r => r.name.startsWith(tl[0].name)) : -1;
    if (tops.length === 2 && iS >= 0 && tops[1] - tops[0] > 0.1) { const G = rowsN.slice(iS + 1).reduce((a, r) => a + (+r.weight || 0), 0), sp = tops[1] - tops[0];
      const VA = W * (tops[1] - cog) / sp + G / 2, VB = W * (cog - tops[0]) / sp + G / 2, mid = (tops[0] + tops[1]) / 2;
      const Fh = Math.max(...tl.map(k => (k.end[0] < mid ? VA : VB) / Math.sin(Math.atan2(k.V, Math.max(k.H, 1e-6)))));
      if (Fh > (+rowsN[iS].load || 0) + 1e-6) { bumpOf = +rowsN[iS].load; bumpTo = Fh; } } }
  const items = res.rows.filter(r => r.name).map(r => {
    const F0 = +r.load || 0, F = bumpOf != null && Math.abs(F0 - bumpOf) < 0.006 * bumpOf ? bumpTo : F0, req = F * daf, lg = (() => { const own = legs.filter(q => q.e === r.entry); return own.length ? own : legs.filter(q => r.name.startsWith(q.name)); })(), sling = !!RIG_TYPES[r.type]?.sling;
    const ang = sling && lg.length ? Math.min(...lg.map(q => q.fromH)) : null;
    const hf = r.swl && r.baseSwl ? r.swl / r.baseSwl : 1, isBeam = r.type === "spreader";
    const fam = rigFamily(r.entry?.snap?.name || r.name), c0 = lib.filter(i => i.type === r.type && (!isBeam || (+i.len || 0) >= (+r.len || 0) - 0.01)).sort((a, b) => a.swl - b.swl), cf = c0.filter(i => rigFamily(i.name) === fam);
    const cands = cf.some(i => (+i.swl || 0) * hf * RIG_GREEN / 100 >= req - 1e-9) ? cf : c0;   // same make / style first
    const nm = i => i.name + (sling && r.len ? ` × ${fx(r.len, 1)} m` : "");
    const up = cands.find(i => (+i.swl || 0) * hf >= req - 1e-9), gr = cands.find(i => (+i.swl || 0) * hf * RIG_GREEN / 100 >= req - 1e-9);
    return { ...r, F, F0, req, ang, hf, legs: lg, use: r.swl ? req / r.swl * 100 : null, ok: r.swl ? r.swl >= req - 1e-9 : false,
      roundUp: up ? { name: nm(up), wll: up.swl * hf } : null, green: gr ? { name: nm(gr), wll: gr.swl * hf, use: req / (gr.swl * hf) * 100 } : null };
  });
  const minAng = legs.length ? Math.min(...legs.map(q => q.fromH)) : null;
  return { res, daf, W, Wr: res.weight, cog, P, shares, items, legs, minAng, d, beam, zBeam, padLen, clear: zBeam != null ? zBeam - d.z : null };
}
// the app's own angle rules (as in the rigging window): drops from a spreader within 30° of vertical, legs within 45°
// (the spreader's own top-leg limit when its data gives one)
const rcLimV = (c, q) => q.role === "drop" ? (rule("rig.dropMax") ?? 30) : q.role === "top" && c.beam && c.res?.beam?.snap?.pad?.maxAngle ? +c.res.beam.snap.pad.maxAngle : (rule("rig.legMax") ?? 45);
function rcLength(c, x) {
  if (!x.legs.length || !RIG_TYPES[x.type]?.sling) return null;
  if ((x.hitch || x.entry?.hitch || "straight") !== "straight") return { skip: true };
  const q = x.legs.reduce((m, k) => k.H > m.H ? k : m, x.legs[0]), f = Math.max(0, q.Lt - q.Ls), lim = rcLimV(c, q);
  const LtAng = q.H / Math.sin(lim * D2R), out = [{ why: `β ${lim}° to the vertical at most (${2 * lim}° included)`, Lt: LtAng, work: `${fx(q.H, 2)} ÷ sin ${lim}° = ${fx(LtAng, 2)} m` }];
  if (q.role === "drop" && c.zBeam != null) { const vMin = c.d.z + 0.3 - c.padLen - q.end[2]; if (vMin > 0) { const Lc = Math.hypot(q.H, vMin); out.push({ why: "beam at least 0.30 m above the top of the load", Lt: Lc, work: `√(${fx(q.H, 2)}² + ${fx(vMin, 2)}²) = ${fx(Lc, 2)} m` }); } }
  const need = Math.max(...out.map(o => o.Lt)) - f, std = Math.ceil(need / slStep() - 1e-9) * slStep();
  return { q, f, lim, out, need, std, ok: q.Ls >= need - 0.005 };
}
// checks: an item that passes on the static load but not with the DAF is reported
{ const _sr = solveRig; solveRig = function (ld, ...a) {
    const r = _sr.call(this, ld, ...a);
    try { if (r && r.rows && !r._rc) { r._rc = true; const daf = rcDaf(ld);
      for (const x of r.rows) if (x.swl && x.load * daf > x.swl + 1e-9 && x.load <= x.swl) r.warn.push(`${x.name}: ${fx(x.load, 2)} t × DAF ${fx(daf, 2)} = ${fx(x.load * daf, 2)} t is over its ${fx(x.swl, 1)} t rating – go up a size`); } } catch (e) { }
    return r; }; }

// ---------- the calculation in the app: a dialog from the rigging card ----------
// the assumptions behind the numbers, stated from the load and rigging data (what the CoG, lifting points, spreader,
// slings and weights are taken to be) – the same list on the calculation window and the printed sheet
function rcAssumptions(ld, c) {
  const f2 = v => fx(v, 2), A = ld.approx || {}, t = k => A[k] ? "~" : "", src = k => A[k] ? ` (${A[k]})` : "", d = c.d, out = [];
  const lname = ld.kind === "tank" ? "tank" : "load";
  out.push(`Load: ${f2(c.W)} t${ld.src ? `, from the ${ld.src}` : ""} · ${f2(d.x)} m long × ${f2(d.y)} m wide × ${f2(d.z)} m high.`);
  out.push(`Centre of gravity along the ${lname}: ${Math.abs(c.cog) < 0.005 ? "at the middle" : `${t("cog")}${f2(Math.abs(c.cog))} m from the middle, towards end ${c.cog > 0 ? "B" : "A"}`}${src("cog")}.`);
  const ys = c.P.map(p => p[1]), across = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
  out.push(`Centre of gravity across the ${lname}: on its centre line${across > 0.1 ? " – the weight is shared evenly between the lifting points on either side" : ""}.`);
  out.push(`Centre of gravity height: ${+ld.cogZ > 0 ? `${t("cogZ")}${f2(+ld.cogZ)} m above the bottom of the ${lname}${src("cogZ")}` : `taken as half the height, ${f2(d.z / 2)} m above the bottom of the ${lname}`}.`);
  const xs = c.P.map(p => p[0]), along = xs.length ? Math.max(...xs) - Math.min(...xs) : 0, n = c.P.length, nEnd = n && along > 0.1 ? c.P.filter(p => Math.abs(p[0] - Math.min(...xs)) < 0.01).length : 0;
  if (n) out.push(`Lifting points: ${n}${nEnd > 1 ? ` – ${nEnd} at each end` : ""}${along > 0.1 ? `, ${t("span")}${f2(along)} m apart along the ${lname}${src("span")}` : ""}${across > 0.1 ? `, ${t("spanY")}${f2(across)} m apart across it${src("spanY")}` : ""} · ${t("lpZ")}${f2(liftPointZ(ld))} m above the bottom of the ${lname}${src("lpZ")}.`);
  out.push(c.res.tilt ? `The ${lname} is tilted ${fx(c.res.tilt, 0)}° about its CoG (upending / turning) and treated as stiff.` : `The ${lname} is stiff and hangs level, with the hook directly above the centre of gravity.`);
  for (const r of c.items.filter(x => x.type === "spreader")) {
    const b = (c.res.beams || [])[c.items.filter(x => x.type === "spreader").indexOf(r)], lowP = (c.res.pads || []).filter(p => p[3] === "low"), topP = (c.res.pads || []).filter(p => p[3] === "top");
    const sp = (P, bb) => { if (!bb) return 0; const L = Math.hypot(bb.b[0] - bb.a[0], bb.b[1] - bb.a[1]) || 1, u = [(bb.b[0] - bb.a[0]) / L, (bb.b[1] - bb.a[1]) / L], q = P.filter(p => Math.abs(p[2] - (p[3] === "top" ? bb.a[2] + bb.h : bb.a[2])) < 0.05 && Math.abs((p[0] - bb.a[0]) * u[1] - (p[1] - bb.a[1]) * u[0]) < 0.05).map(p => (p[0] - bb.a[0]) * u[0] + (p[1] - bb.a[1]) * u[1]); return q.length > 1 ? Math.max(...q) - Math.min(...q) : 0; };
    const sT = sp(topP, b), sB = sp(lowP, b);
    out.push(`Spreader: ${r.qty > 1 ? r.qty + " × " : ""}${r.name}${sT || sB ? `, ${Math.abs(sT - sB) < 0.01 ? `top and bottom padeyes ${f2(sB)} m apart` : `top padeyes ${f2(sT)} m apart, bottom padeyes ${f2(sB)} m apart`}` : ""}${b && Math.abs(b.b[1] - b.a[1]) > Math.abs(b.b[0] - b.a[0]) ? `, turned across the ${lname}` : ""}.`);
  }
  out.push(`Slings: the legs of each pair are the same length and every fitting lines up with its sling (no twist, no side load).`);
  out.push(`Rigging weights: catalogue weights, ~${f2(c.Wr)} t in all, added to the load each item carries.`);
  return out;
}
function rigCalcHTML(ld) {
  const c = rigCalc(ld); if (!c) return `<p class="small">Set up the rigging first.</p>`;
  const f2 = v => fx(v, 2), st = x => x.ok ? (x.use > RIG_GREEN ? "amber" : "ok") : "bad";
  // step 1 – lifting point shares by moments about the CoG (along the load; the two points across share equally)
  const xs = [...new Set(c.P.map(p => +p[0].toFixed(3)))].sort((a, b) => a - b), x0 = xs[0], x1 = xs[xs.length - 1], Lx = x1 - x0;
  let s1;
  if (c.P.length < 2 || Lx < 1e-6) s1 = `<p class="mono">${c.P.length || 1} point${c.P.length > 1 ? "s" : ""} at the same place: ${f2(c.W)} ÷ ${c.P.length || 1} = <b>${f2(c.W / (c.P.length || 1))} t</b> each</p>`;
  else { const n0 = c.P.filter(p => Math.abs(p[0] - x0) < 0.01).length, n1 = c.P.filter(p => Math.abs(p[0] - x1) < 0.01).length, A = c.W * (x1 - c.cog) / Lx, B = c.W - A;
    const dA = Math.abs(x0), dB = Math.abs(x1), gA = c.cog - x0, gB = x1 - c.cog;
    const cogTxt = Math.abs(c.cog) < 0.005 ? "at the middle of the load" : `${f2(Math.abs(c.cog))} m from the middle, towards end ${c.cog > 0 ? "B" : "A"}`;
    s1 = `<p class="small" style="margin:0 0 6px">All distances are measured along the length of the load, from its middle (end A and end B as in the rigging set-up).</p>
    <table class="rctab" style="margin-bottom:8px"><tr><td>Lifting points at end A</td><td class="n">${n0} point${n0 > 1 ? "s" : ""}, ${f2(dA)} m from the middle</td></tr>
    <tr><td>Lifting points at end B</td><td class="n">${n1} point${n1 > 1 ? "s" : ""}, ${f2(dB)} m from the middle</td></tr>
    <tr><td>Distance end A points → end B points</td><td class="n">${f2(dA)} + ${f2(dB)} = <b>${f2(Lx)} m</b></td></tr>
    <tr><td>Centre of gravity (CoG)</td><td class="n">${cogTxt}</td></tr>
    <tr><td>CoG → end A points</td><td class="n">${f2(gA)} m</td></tr><tr><td>CoG → end B points</td><td class="n">${f2(gB)} m</td></tr></table>
    <p class="small" style="margin:0 0 4px">Each end takes the load × the distance from the CoG to the <i>other</i> end ÷ the distance between the ends.</p>
    <p class="mono">End A: ${f2(c.W)} × ${f2(gB)} ÷ ${f2(Lx)} = <b>${f2(A)} t</b>${n0 > 1 ? ` → ÷ ${n0} points = <b>${f2(A / n0)} t</b> per point` : ""}</p>
    <p class="mono">End B: ${f2(c.W)} × ${f2(gA)} ÷ ${f2(Lx)} = <b>${f2(B)} t</b>${n1 > 1 ? ` → ÷ ${n1} points = <b>${f2(B / n1)} t</b> per point` : ""}</p>
    <p class="mono">Check: ${f2(A)} + ${f2(B)} = ${f2(A + B)} t = the load ✓</p>`; }
  // step 2 – each item: force, × DAF, the rating needed, the next size up
  const slings = c.items.filter(x => RIG_TYPES[x.type]?.sling), eq = (a, b) => Math.abs(a - b) < 0.006 * Math.max(1, b);
  const mxShare = Math.max(0, ...c.shares);
  const force = x => {
    if (x.ang != null && RIG_TYPES[x.type]?.sling) { const V = x.F * Math.sin(x.ang * D2R), lp = x.legs.some(q => q.toLug) && eq(V, mxShare);
      return `vertical load on the leg ${f2(V)} t${lp ? " (the heavier lifting point, step 1)" : ""} ÷ cos ${fx(90 - x.ang, 2)}° = <b>${f2(x.F)} t</b>`; }
    const tot = x.F * x.qty, rig = tot - c.W;
    if (/hook/.test(x.where || "") && !/horn/.test(x.where || "") && rig > -0.01) return `(load ${f2(c.W)} t + rigging below ${f2(rig)} t)${x.qty > 1 ? ` ÷ ${x.qty}` : ""} = <b>${f2(x.F)} t</b>`;
    if (x.type === "spreader" && rig > -0.01) return `load ${f2(c.W)} t + rigging hanging under the beam ${f2(x.F - c.W)} t = <b>${f2(x.F)} t</b>`;
    const s1 = slings.find(y => eq(x.F, y.F)); if (s1) return `in line with sling ${s1.no}, so it carries the same load: <b>${f2(x.F)} t</b>`;
    const s2 = slings.find(y => eq(x.F, 2 * y.F)); if (s2) return `two slings in it: 2 × ${f2(s2.F)} t = <b>${f2(x.F)} t</b> (the two loads added – on the safe side)`;
    return `${escH(x.where || "")}: <b>${f2(x.F)} t</b>`; };
  const pct = v => v != null ? fx(v, 0) + " %" : "–";
  // ---- the full working of each item's load, step by step from the load, the gear weights and the geometry
  const its = c.items, iBeam = its.findIndex(y => y.type === "spreader"), wOf = y => (+y.weight || (+y.unitW || 0) * (y.qty || 1));
  const kg = v => `${fx(v * 1000, 0)} kg`, ln = t => `<p class="mono">${t}</p>`;
  const sumBelow = (from, label) => { const rs = its.slice(from).filter(y => wOf(y) > 0); const tot = rs.reduce((a, y) => a + wOf(y), 0);
    return { tot, txt: rs.map(y => `${y.qty} × ${escH(y.name.split(" × ")[0])} ${kg(+y.unitW || wOf(y) / (y.qty || 1))}`).join(" + ") }; };
  const topPads = (c.res.pads || []).filter(p => p[3] === "top").map(p => p[0]).sort((a, b) => a - b);
  const forceWork = x => {
    const L = [], sl = !!RIG_TYPES[x.type]?.sling, i = its.indexOf(x), q = (x.legs || []).reduce((m, k) => !m || k.H > m.H ? k : m, null);
    if (sl && q) {
      const th = Math.atan2(q.V, Math.max(q.H, 1e-6)) / D2R, Vleg = x.F * Math.sin(th * D2R);
      L.push(ln(`Load share – step 1, the angle: the leg goes out ${f2(q.H)} m and down ${f2(q.V)} m`));
      L.push(ln(`          angle to the vertical β = atan(${f2(q.H)} ÷ ${f2(q.V)}) = ${fx(90 - th, 2)}°`));
      if (q.role === "top" && topPads.length === 2 && iBeam >= 0) {
        const b = sumBelow(i + 1), G = b.tot, tA = topPads[0], tB = topPads[1], sp = tB - tA, xg = c.cog;
        // the load acts at its CoG, the gear (beam, shackles, drops) is symmetric about the beam centre
        const VA = c.W * (tB - xg) / sp + G / 2, VB = c.W * (xg - tA) / sp + G / 2;
        L.splice(0, L.length);
        L.push(ln(`Load share – step 1, the vertical load at each top padeye (${f2(sp)} m apart):`));
        L.push(ln(`          the load acts at its CoG; the gear under the top padeyes (${b.txt} = ${f2(G)} t) sits evenly on both`));
        L.push(ln(`          end A: ${f2(c.W)} × ${f2(tB - xg)} ÷ ${f2(sp)} + ${f2(G)} ÷ 2 = ${f2(VA)} t`));
        L.push(ln(`          end B: ${f2(c.W)} × ${f2(xg - tA)} ÷ ${f2(sp)} + ${f2(G)} ÷ 2 = ${f2(VB)} t   (check: ${f2(VA)} + ${f2(VB)} = ${f2(VA + VB)} t)`));
        L.push(ln(`Load share – step 2, each top leg: β from how far it goes out and down, load share = vertical ÷ cos β`));
        let Fmax = 0;
        for (const k of x.legs) { const isA = k.end[0] < (tA + tB) / 2, V = isA ? VA : VB, a = Math.atan2(k.V, Math.max(k.H, 1e-6)), F = V / Math.sin(a); Fmax = Math.max(Fmax, F);
          L.push(ln(`          leg to end ${isA ? "A" : "B"}: out ${f2(k.H)} m, down ${f2(k.V)} m → β = atan(${f2(k.H)} ÷ ${f2(k.V)}) = ${fx(90 - a / D2R, 2)}° → ${f2(V)} ÷ cos ${fx(90 - a / D2R, 2)}° (${Math.sin(a).toFixed(4)}) = ${f2(F)} t`)); }
        L.push(ln(`          the heavier leg: <b>${f2(Fmax)} t</b>${Math.abs(Fmax - x.F0) > 0.005 ? ` · the app's 3D rigging model gives ${f2(x.F0)} t – the higher value, <b>${f2(x.F)} t</b>, is used` : ""}`));
        return L.join("");
      } else {
        L.push(ln(`Load share – step 2, the vertical load on this leg: the heaviest lifting point from step 1 = ${f2(Vleg)} t`));
      }
      L.push(ln(`Load share – step 3: load share in the sling = vertical load ÷ cos β = ${f2(Vleg)} ÷ cos ${fx(90 - th, 2)}° = ${f2(Vleg)} ÷ ${(Math.sin(th * D2R)).toFixed(4)} = <b>${f2(x.F)} t</b>`));
      return L.join("");
    }
    const tot = x.F * x.qty, rig = tot - c.W;
    if (x.type === "spreader") { const b = sumBelow(i + 1); L.push(ln(`Load share: the beam carries the load and all the gear hanging from it`)); L.push(ln(`          load ${f2(c.W)} t + ${b.txt || "no gear"} = <b>${f2(c.W + b.tot)} t</b>${Math.abs(c.W + b.tot - x.F) > 0.02 ? ` (the app's model: ${f2(x.F)} t)` : ""}`)); return L.join(""); }
    if (/hook/.test(x.where || "") && !/horn/.test(x.where || "")) { const b = sumBelow(i + 1); L.push(ln(`Load share: everything below the hook – load ${f2(c.W)} t + ${b.txt} = ${f2(c.W + b.tot)} t${x.qty > 1 ? ` ÷ ${x.qty}` : ""} = <b>${f2(x.F)} t</b>`)); return L.join(""); }
    const s1 = slings.find(y => eq(x.F, y.F)), s2 = slings.find(y => eq(x.F, 2 * y.F));
    if (/horn/.test(x.where || "") && s1) { L.push(ln(`Load share: one link on each hook horn, with one top leg in it – the link lines up with its leg, so it carries the leg's full load share`)); L.push(ln(`          = load share in sling ${s1.no} (worked out under item ${s1.no}) = <b>${f2(x.F)} t</b>`)); return L.join(""); }
    if (s2) { L.push(ln(`Load share: two slings in this shackle (one beam padeye, both drops of that end)`)); L.push(ln(`          2 × ${f2(s2.F)} t (sling ${s2.no}) = <b>${f2(x.F)} t</b> – the two loads added, which is on the safe side`)); return L.join(""); }
    if (s1) { L.push(ln(`Load share: in line with sling ${s1.no}, so it carries the same load = <b>${f2(x.F)} t</b> (worked out under item ${s1.no})`)); return L.join(""); }
    return ln(`Load share: ${escH(x.where || "")} = <b>${f2(x.F)} t</b>`);
  };
  const rows = c.items.map(x => `<tr><td>${x.no}. ${escH(x.name)}</td><td class="n">${x.qty}</td><td class="n">${x.ang != null ? fx(90 - x.ang, 1) + "°" : "–"}</td><td class="n">${f2(x.F)} t</td><td class="n">${f2(x.F)} × ${fx(c.daf, 2)} = <b>${f2(x.req)} t</b></td>
    <td class="small">${x.roundUp ? escH(x.roundUp.name) + ` (${fx(x.roundUp.wll, 1)} t)` : "nothing in the catalogue"}</td><td class="n">${fx(x.swl, 1)} t</td><td class="n"><span class="pill ${st(x)}">${x.ok ? "" : "TOO SMALL · "}${pct(x.use)}</span></td>
    <td class="small">${x.ok && x.use <= RIG_GREEN ? "–" : x.green ? `<b>↑ ${escH(x.green.name)}</b> → ${pct(x.green.use)}` : "nothing in the catalogue keeps it in the green"}</td></tr>`).join("");
  // sling angles – every leg, β to the vertical (UK / LEEA / NSL), the included angle of each pair and the angle factor
  const angSec = (() => { const sl = c.items.filter(x => RIG_TYPES[x.type]?.sling && (x.legs || []).length); if (!sl.length) return "";
    return sl.map(x => { const legs = x.legs.map((k, i) => { const b = Math.atan2(k.H, Math.max(k.V, 1e-6)), cb = Math.cos(b); return { k, b: b / D2R, cb, i }; });
      const lim = (() => { try { return rcLimV(c, x.legs[0]); } catch (e) { return 45; } })();
      let h = `<p class="mono"><b>${x.no}. ${escH(x.name)}</b> – ${legs.length} leg${legs.length > 1 ? "s" : ""}</p>`;
      legs.forEach(({ k, b, cb, i }) => { h += `<p class="mono">          leg ${i + 1}: out ${f2(k.H)} m, down ${f2(k.V)} m → β = atan(${f2(k.H)} ÷ ${f2(k.V)}) = ${fx(b, 2)}° · cos β = ${cb.toFixed(4)} · angle factor 1 ÷ cos β = ${(1 / cb).toFixed(3)}</p>`; });
      if (legs.length >= 2) { const s2 = [...legs].sort((a, b) => b.b - a.b), inc = s2[0].b + s2[1].b, pf = 2 * Math.cos(inc / 2 * D2R);
        h += `<p class="mono">          included angle (sling to sling) = ${fx(s2[0].b, 2)}° + ${fx(s2[1].b, 2)}° = <b>${fx(inc, 1)}°</b> · a pair of single slings at this angle = SWL of one × 2 × cos ${fx(inc / 2, 2)}° = SWL × ${pf.toFixed(2)}</p>`; }
      const worst = Math.max(...legs.map(l => l.b));
      h += `<p class="mono">          check: largest β ${fx(worst, 1)}° ≤ ${lim}° (${2 * lim}° included) → <b>${worst <= lim + 1e-6 ? "OK" : "OVER THE LIMIT"}</b></p>`;
      return h; }).join("") + `<p class="small" style="margin:4px 0 0">β = each leg's angle to the vertical; included angle = the angle between two legs (2 × β when they are equal). Load share in the sling = vertical load on the leg ÷ cos β.</p>`; })();
  // step 3 – the full working for each item (rating and, for slings, the length)
  const det = c.items.map(x => { const L = rcLength(c, x);
    let h = `<details class="rcd"><summary><b>${x.no}. ${escH(x.name)}</b> × ${x.qty} <span class="pill ${st(x)}">${x.ok ? "" : "TOO SMALL · "}${pct(x.use)}</span>${L && !L.skip ? ` <span class="pill ${L.ok ? "ok" : "bad"}">length ${L.ok ? "OK" : "too short"}</span>` : ""}</summary><div class="rcw">
      ${forceWork(x)}
      <p class="mono">Required WLL: ${f2(x.F)} × DAF ${fx(c.daf, 2)} = <b>${f2(x.req)} t</b></p>
      <p class="mono">Selected WLL: ${fx(x.baseSwl || x.swl, 1)} t${x.hf && Math.abs(x.hf - 1) > 1e-6 ? ` × ${fx(x.hf, 2)} (hitch factor) = ${fx(x.swl, 1)} t` : ""}</p>
      <p class="mono">Use = required ÷ selected: ${f2(x.req)} ÷ ${fx(x.swl, 1)} = <b>${pct(x.use)}</b>${x.use <= RIG_GREEN ? ` – in the green (≤ ${RIG_GREEN} %)` : x.ok ? " – passes, over 80 %" : " – over its rating"}</p>
      ${x.ok && x.use <= RIG_GREEN ? "" : `<p class="mono">Size up:  needs ≥ ${f2(x.req)} ÷ ${fx(RIG_GREEN / 100, 2)} = ${f2(x.req / (RIG_GREEN / 100))} t to be in the green → ${x.green ? `<b>${escH(x.green.name)}</b> (${fx(x.green.wll, 1)} t, ${pct(x.green.use)})` : "nothing in the catalogue"}</p>`}`;
    if (L && L.skip) h += `<p class="small">Length: ${escH(x.hitch || x.entry?.hitch)} hitch – the length round the load is checked in the rigging window.</p>`;
    else if (L) { const q = L.q;
      h += `<p class="mono">Length (indicative – from the set-up geometry; confirm against the actual gear and lug positions)</p><p class="mono">          the leg as set up: out ~${f2(q.H)} m, down ~${f2(q.V)} m → straight line √(${f2(q.H)}² + ${f2(q.V)}²) = ~${f2(q.Lt)} m</p>
      <p class="mono">          = sling ${f2(q.Ls)} m${L.f > 0.005 ? ` + fittings in line ${f2(L.f)} m` : ""} · β ${fx(90 - q.fromH, 1)}° to the vertical</p>
      ${L.out.map(o => `<p class="mono">Shortest line for ${escH(o.why)}: ${o.work}</p>`).join("")}
      <p class="mono">Shortest sling: ${f2(Math.max(...L.out.map(o => o.Lt)))}${L.f > 0.005 ? ` − ${f2(L.f)} fittings` : ""} = ${f2(L.need)} m → next ${slStep() === 1 ? "whole metre" : fx(slStep(), 1) + " m"}: <b>${fx(L.std, 1)} m</b> · fitted ${fx(q.Ls, 1)} m → <b>${L.ok ? "OK" : "TOO SHORT"}</b></p>`; }
    return h + `</div></details>`; }).join("");
  return `<div class="row"><label>Dynamic factor (DAF)<input type="number" id="rcDaf" step="0.05" min="1" value="${fx(c.daf, 2)}"></label><label>Applies to<select id="rcDafWho"><option value="plan" ${+ld.rigDaf > 0 ? "" : "selected"}>every load in this plan</option><option value="load" ${+ld.rigDaf > 0 ? "selected" : ""}>this load only</option></select></label></div>
  <p class="small" id="rcMsg" style="margin:4px 0 2px;font-weight:600"></p><p class="small" style="margin:4px 0 10px">Set the DAF your procedure requires. Changing it re-sizes the rigging so every item stays in the green (required ≤ ${RIG_GREEN} % of its rating). This working is for your check – it is not printed on the sheets.</p>
  <h4 style="margin:6px 0">Assumptions</h4><ul class="small" style="margin:0 0 10px;padding-left:18px">${rcAssumptions(ld, c).map(a => `<li>${escH(a)}</li>`).join("")}</ul>
  <h4 style="margin:6px 0">1 · Load on each lifting point (moments about the CoG) – load ${f2(c.W)} t</h4>${s1}
  ${angSec ? `<h4 style="margin:12px 0 6px">2 · Sling angles</h4>${angSec}` : ""}
  <h4 style="margin:12px 0 6px">${angSec ? 3 : 2} · Each item</h4>
  <p class="small" style="margin:0 0 6px">Required WLL = load share × DAF – the minimum rating the item needs. Selected WLL = the rated WLL of the item chosen, based on availability. Round up = the smallest catalogue item of that type that carries the required value. Go up to = the size that brings the use down to ${RIG_GREEN} % or less. Round up / go up to are catalogue items – indicative: confirm the item, its certificate and that it can be supplied / hired. Slings: rating includes the hitch factor; angle β is from the vertical, included angle = 2 × β.</p>
  <table class="rctab"><tr><th>Item</th><th class="n">Qty</th><th class="n">Sling angle β</th><th class="n">Load share</th><th class="n">Required WLL (× DAF)</th><th>Round up</th><th class="n">Selected WLL</th><th class="n">Use</th><th>Go up to</th></tr>${rows}</table>
  <h4 style="margin:14px 0 6px">${angSec ? 4 : 3} · Working for each item <span class="small">(click to open)</span></h4>${det}
  <p class="small" style="margin:8px 0 0">Rigging below the hook: ~${f2(c.Wr)} t (catalogue weights – indicative).${c.clear != null ? ` Spreader beam ~${f2(c.clear)} m above the top of the load.` : ""} Lifting lugs / padeyes on the load are not part of this check – their rating and the shackle pin fit come from the vendor's drawing.</p>`;
}
function openRigCalc(ld) {
  let d = $("dRigCalc");
  if (!d) { d = document.createElement("dialog"); d.id = "dRigCalc"; d.innerHTML = `<div class="dh"><b id="rcTitle">Rigging calculation</b><button data-close>Close</button></div><div class="db" id="rcBody"></div>`; document.body.append(d); d.querySelector("[data-close]").onclick = () => d.close();
    const css = document.createElement("style"); css.textContent = `#dRigCalc{width:min(1250px,97vw)}.rctab{width:100%;border-collapse:collapse;font-size:13px}.rctab th{text-align:left;background:var(--sunk);padding:5px 7px;font-weight:600}.rctab td{padding:5px 7px;border-top:1px solid var(--line2)}.rctab .n{text-align:right;white-space:nowrap}#dRigCalc .mono{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;margin:2px 0;white-space:pre-wrap}#dRigCalc .rcd{border-top:1px solid var(--line2);padding:5px 2px}#dRigCalc .rcd summary{cursor:pointer}#dRigCalc .rcw{padding:4px 0 6px 14px}`; document.head.append(css); }
  const fill = () => { $("rcTitle").textContent = `Rigging calculation · ${ld.name}`; $("rcBody").innerHTML = rigCalcHTML(ld);
    const set = () => { const v = +$("rcDaf").value, who = $("rcDafWho").value; if (!(v >= 1)) return; if (who === "load") ld.rigDaf = v; else { delete ld.rigDaf; plan.site.rigDaf = v; }
      // a new DAF re-sizes the rigging: every item that is no longer in the green goes up a size (this load, or every load in the plan)
      const sig = l => JSON.stringify((solveRig(l)?.rows || []).filter(r => r.name).map(r => r.name)), done = new Set(), msg = [];
      const resize = l => { if (!l || done.has(l)) return; done.add(l); const b = sig(l); try { sizeRig(l); } catch (e) { } if (sig(l) !== b) msg.push(l.name); };
      if (who === "load") { resize(ld); const orig = plan.loads.find(x => x.id === ld.id); if (orig && orig !== ld) { orig.rigDaf = v; resize(orig); } }
      else { resize(ld); (plan.lifts || []).forEach((L, i) => withLift(i, () => plan.loads.forEach(resize))); plan.loads.forEach(resize); }
      if (typeof RB !== "undefined" && RB.work && $("dRig")?.open) { if (who === "load") RB.work.rigDaf = v; resize(RB.work); try { renderRB(); } catch (e) { } }
      markDirty(); renderAll(true); fill();
      const n = $("rcMsg"); if (n) n.textContent = msg.length ? `Rigging re-sized for: ${[...new Set(msg)].join(", ")}.` : "No rigging needed changing – everything is still in the green."; };
    if ($("rcDaf")) { $("rcDaf").onchange = set; $("rcDafWho").onchange = set; } };
  fill(); if (!d.open) d.showModal();
}
{ const _rc = renderChecks; renderChecks = function (...a) {
    const r = _rc.apply(this, a);
    try { document.querySelectorAll("#checks [data-rig]").forEach(b => { if (b.nextElementSibling?.dataset?.rigcalc) return; const x = document.createElement("button"); x.dataset.rigcalc = b.dataset.rig; x.textContent = "Calculation"; x.title = "How each rigging item was sized – load shares, sling angles, DAF and the rating needed"; b.after(x); }); } catch (e) { }
    return r; }; }
document.addEventListener("click", e => { const b = e.target.closest("[data-rigcalc]"); if (b) { const l = plan.loads.find(x => x.id === b.dataset.rigcalc); if (l) openRigCalc(l); } });

// ---------- a rigging calculation sheet in the PDF – one per set of gear, after its rigging sheet ----------
function rigCalcSheetSVG(ld, liftLabel) {
  const c = rigCalc(ld); if (!c) return null;
  const F = ssFrame(`RIGGING CALCULATION – ${ld.name}`, liftLabel), e = F.e, x0 = F.M + 30, tw = F.W - 2 * F.M - 60;
  let y = F.M + 90;
  const txt = (t, sz = 20, b, col = "#16202a") => { F.add(`<text x="${x0 + 10}" y="${y}" font-size="${sz}"${b ? ' font-weight="700"' : ""} fill="${col}">${e(t)}</text>`); y += sz + 12; };
  txt("METHOD", 22, true, "#1f4e79");
  const lname = ld.kind === "tank" ? "tank" : "load";
  [`•  Centre of Gravity (CoG): based on the position specified in the manufacturer's drawings or load data.`,
   `•  Load Distribution: the total load is shared between the two ends of the ${lname}. The end closer to the CoG carries a greater proportion of the weight.`,
   `•  Lifting Points: equal load sharing assumed between the two lifting points at each end.`,
   `•  Sling Angle: measured from the vertical. The load in each sling increases as the angle increases.`,
   `•  Load Share per Sling: calculated as vertical load ÷ cos(sling angle).`,
   ...(() => { const T = new Set(c.items.map(x => x.type)), L = [];   // only the fittings this rig actually has
     if (T.has("shackle")) L.push(`•  Shackles: each shackle carries the load share of the sling it is connected to.`);
     if (T.has("masterlink")) L.push(`•  Master links: each master link carries the combined load share of the sling legs hanging from it.`);
     if (T.has("hook")) L.push(`•  Hooks: each hook carries the load share of the sling it holds.`);
     return L; })(),
   `•  Dynamic Amplification Factor (DAF): a factor of ${fx(c.daf, 2)} applied to account for dynamic effects during lifting.`,
   `•  Required WLL: load share × DAF – the minimum rating each item needs.`,
   `•  Selected WLL: the rated WLL of the item chosen, based on availability.`].forEach(t => txt(t, 19));
  y += 6; txt("ASSUMPTIONS", 22, true, "#1f4e79");
  for (const a of rcAssumptions(ld, c)) wrapLines(a, 200).forEach((l, i) => txt((i ? "    " : "•  ") + l, 19));
  y += 6; txt("LIMITATIONS", 22, true, "#1f4e79");
  for (const l of wrapLines(`${+ld.lugHole > 0 ? `Lifting lug capacity is excluded from this assessment. The lug shackles must suit the lugs on the ${ld.src || "vendor drawing"}: hole Ø${fx(ld.lugHole * 1000, 0)} mm${+ld.lugThk > 0 ? `, plate ${fx(ld.lugThk * 1000, 0)} mm thick` : ""} – pin diameter and jaw width to be confirmed against the shackle data sheet.` : "Lifting lug capacity is excluded from this assessment, and shackle pin compatibility could not be confirmed due to the absence of lifting lug specifications."}`, 230)) txt(l, 19);
  y += 10;
  const table = (title, head, wd, rows) => { txt(title, 22, true, "#1f4e79"); y -= 8;
    const ws = wd.map(w => w * tw); let yy = y; const row = (v, bold, fill, cols) => { let x = x0; if (fill) F.add(`<rect x="${x0}" y="${yy}" width="${tw}" height="42" fill="${fill}"/>`); v.forEach((t, i) => { const right = i > 0; F.add(`<text x="${right ? x + ws[i] - 10 : x + 10}" y="${yy + 28}" font-size="${fitFs(t, ws[i] - 20, 20, 12).toFixed(1)}" text-anchor="${right ? "end" : "start"}" fill="${(cols && cols[i]) || "#16202a"}"${bold ? ' font-weight="700"' : ""}>${e(t)}</text>`); x += ws[i]; }); yy += 42; };
    row(head, true, "#e9edf1"); rows.forEach((r, n) => row(r.v || r, false, n % 2 ? "#f7f9fa" : null, r.c));
    F.add(`<rect x="${x0}" y="${y}" width="${tw}" height="${yy - y}" fill="none" stroke="#16202a" stroke-width="2"/>`); y = yy + 30; };
  // lifting point loads, by end (end A / end B as in the rigging set-up)
  const xs = c.P.map(p => p[0]), xa = Math.min(...xs), xb = Math.max(...xs), Lx = xb - xa;
  if (c.P.length >= 2 && Lx > 1e-6) {
    const nA = c.P.filter(p => Math.abs(p[0] - xa) < 0.01).length, nB = c.P.filter(p => Math.abs(p[0] - xb) < 0.01).length, A = c.W * (xb - c.cog) / Lx, B = c.W - A;
    table(`LOAD ON THE LIFTING POINTS – load ${fx(c.W, 2)} t · CoG ${Math.abs(c.cog) < 0.005 ? "at the middle of the load" : `${fx(Math.abs(c.cog), 2)} m from the middle towards end ${c.cog > 0 ? "B" : "A"}`}`,
      ["End", "Points", "CoG to this end", "CoG to the other end", `Load on this end = load × (CoG to the other end) ÷ ${ld.approx?.span ? "~" : ""}${fx(Lx, 2)} m (end A to end B points${ld.approx?.span ? ", scaled – vendor to confirm" : ""})`, "Load per point"], [0.08, 0.07, 0.13, 0.15, 0.4, 0.17],
      [["End A", String(nA), `${fx(c.cog - xa, 2)} m${c.cog - xa < xb - c.cog ? " (closer)" : ""}`, `${fx(xb - c.cog, 2)} m`, `${fx(c.W, 2)} × ${fx(xb - c.cog, 2)} ÷ ${fx(Lx, 2)} = ${fx(A, 2)} t`, `${fx(A / nA, 2)} t`],
       ["End B", String(nB), `${fx(xb - c.cog, 2)} m${xb - c.cog < c.cog - xa ? " (closer)" : ""}`, `${fx(c.cog - xa, 2)} m`, `${fx(c.W, 2)} × ${fx(c.cog - xa, 2)} ÷ ${fx(Lx, 2)} = ${fx(B, 2)} t`, `${fx(B / nB, 2)} t`]]);
  } else table(`LOAD ON THE LIFTING POINT${c.P.length > 1 ? "S" : ""} – load ${fx(c.W, 2)} t`, ["Points", "Load per point"], [0.5, 0.5], [[String(c.P.length || 1), `${fx(c.W / (c.P.length || 1), 2)} t`]]);
  const col = x => x.ok ? (x.use > RIG_GREEN ? "#a15c00" : "#1e7a3c") : "#b42318";
  table("EACH ITEM – LOAD SHARE, DAF AND RATING", ["Item", "Qty", "Sling angle β", "Load share (t)", `Required WLL (t) (× DAF ${fx(c.daf, 2)})`, "Selected WLL (t)", "Use"], [0.38, 0.06, 0.11, 0.1, 0.16, 0.11, 0.08],
    c.items.map(x => ({ v: [`${x.no}. ${x.name}`, String(x.qty), x.ang != null ? `${fx(90 - x.ang, 1)}°` : "–", fx(x.F, 2), fx(x.req, 2), fx(x.swl, 1), x.use != null ? `${fx(x.use, 0)} %` : "–"], c: [null, null, null, null, null, null, col(x)] })));
  txt(`Rigging below the hook ~${fx(c.Wr, 2)} t (catalogue weights)${c.minAng != null ? ` · largest sling angle ${fx(90 - c.minAng, 1)}° to the vertical` : ""} · ${c.items.every(x => x.ok) ? "all items pass" : "NOT all items pass – see the red rows"} with DAF ${fx(c.daf, 2)}.`, 20, true, c.items.every(x => x.ok) ? "#1e7a3c" : "#b42318");
  return F.close();
}
// Export dialog: the rigging calculation sheet is optional (off unless ticked; saved with the plan)
(() => {
  const d = $("dExport"), row = d && d.querySelector(".btnrow"); if (!row) return;
  const lab = document.createElement("label"); lab.className = "vi"; lab.style.cssText = "display:flex;flex-direction:row;align-items:center;gap:8px;margin:0 0 8px;font-weight:400";
  lab.innerHTML = `<input type="checkbox" id="xRigCalc" style="width:auto;margin:0"> Include the rigging calculation sheet (after each rigging sheet)`;
  row.parentNode.insertBefore(lab, row);
  const cb = $("xRigCalc"), sync = () => { cb.checked = !!plan.meta?.rigCalcSheet; };
  cb.onchange = () => { plan.meta = plan.meta || {}; if (cb.checked) plan.meta.rigCalcSheet = true; else delete plan.meta.rigCalcSheet; markDirty(); };
  $("bExport")?.addEventListener("click", sync); sync();
})();
// the rigging window itself carries the sizing button, so the assistant is found where the gear is chosen
{ const _ob = openRigBuilder; openRigBuilder = function (...a) {
    const r = _ob.apply(this, a);
    try { const row = document.querySelector("#dRig .dh .btnrow"); if (row && !$("rbCalc")) { const x = document.createElement("button"); x.id = "rbCalc"; x.textContent = "Size the rigging (calculation)"; x.title = "Load share on each item, sling angles, DAF and the smallest catalogue item that passes";
        x.onclick = () => { if (typeof RB !== "undefined" && RB.work) openRigCalc(RB.work); }; row.prepend(x); } } catch (e) { }
    return r; }; }
