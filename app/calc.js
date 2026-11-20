// ===== Calculations: geometry, chart lookup, hook load, tandem share, ground pressure
const G = 9.81;

function rot2(p, deg) { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
function bearingDeg(dx, dy) { let b = Math.atan2(dx, dy) * 180 / Math.PI; return (b + 360) % 360; }

// hook point for a crane attached to a load lifting point at a phase ('pick' | 'set')
function liftPointWorld(load, point, phase) {
  const pos = load[phase] || load.pick;
  const span = tandemSpan(load);
  const off = point === "A" ? -span / 2 : point === "B" ? span / 2 : (+load.cog || 0);
  // load local x axis along the lifting-point line; rotation is compass-style (clockwise)
  const v = rot2([off, 0], -(pos.rot || 0));
  return [pos.x + v[0], pos.y + v[1]];
}

// conservative chart lookup
function chartColumns(chart, L) { return chart.cols.map((c, i) => ({ ...c, i })).filter(c => Math.abs(c.L - L) < 0.05); }
function capAt(col, R) {
  const caps = [...col.caps].sort((a, b) => a[0] - b[0]);
  if (!caps.length) return { cap: null, why: "empty column" };
  R = Math.round(R * 10) / 10;   // radius is read to 0.1 m, as on the plan and the crane's display – 18.04 m is the 18 m row
  if (R < caps[0][0] - 1e-6) return { cap: null, why: `radius below chart minimum ${caps[0][0]} m`, rUsed: caps[0][0] };
  for (const [r, v] of caps) if (r >= R - 1e-6) return { cap: v, rUsed: r };
  return { cap: null, why: `radius beyond chart maximum ${caps[caps.length - 1][0]} m`, rUsed: null };
}
function lookupCapacity(chart, colIndex, L, R) {
  if (!chart) return { cap: null, why: "no load chart selected" };
  let cols = chartColumns(chart, L);
  if (!cols.length) return { cap: null, why: `boom length ${L} m is not a column in this chart` };
  if (colIndex != null) { const c = cols.find(c => c.i === colIndex); if (c) cols = [c]; }
  let best = null;
  for (const c of cols) { const r = capAt(c, R); if (r.cap != null && (!best || r.cap > best.cap)) best = { ...r, col: c }; }
  if (best) return best;
  return { ...capAt(cols[0], R), col: cols[0] };
}
function chartLengths(chart) { return [...new Set(chart.cols.map(c => c.L))].sort((a, b) => a - b); }

// load shares for a tandem (two cranes on A/B) or single lift
// rigging weight actually added to the lift – none when the entered weight already includes the rigging
function rigW(l) { return l && l.wInclRig ? 0 : (+(l && l.rigWeight) || 0); }
function loadShares(load, attachments) {
  const W = (+load.weight || 0) + rigW(load);
  const pts = attachments.map(a => a.point);
  if (attachments.length === 2 && pts.includes("A") && pts.includes("B")) {
    const span = tandemSpan(load) || 1, cog = +load.cog || 0; // cog offset from centre toward B (m)
    const xA = -span / 2, xB = span / 2;
    const sA = W * (xB - cog) / (xB - xA), sB = W - sA;
    return attachments.map(a => a.point === "A" ? sA : sB);
  }
  return attachments.map(() => W / Math.max(1, attachments.length));
}

// superlift of a crawler crane: radius and ballast from the SSL chart in use (or set by hand for a crane without SL charts)
function slOf(cr, C) {
  if (!cr || !C || C.type !== "cr") return null;
  const ch = REG.charts[cr.chartId] && REG.charts[cr.chartId].craneId === cr.model ? REG.charts[cr.chartId] : null;
  const R = ch && ch.slR != null ? +ch.slR : +cr.sl || 0; if (!(R > 0)) return null;
  const S = C.sl || {}, T = ch && ch.sl != null ? +ch.sl : +cr.slT || 0;
  return { R, T, mast: +S.mast || 30, tray: S.tray || [3.6, 4.8], plate: +S.plate || 10, hang: S.hang ?? 0.5, fromChart: !!(ch && ch.slR != null) };
}
const slStackH = S => 0.45 + Math.ceil(Math.round(S.T / S.plate) / 4) * 0.4;     // pallet + plates in four stacks
// ground pressure estimate (all-terrain on 4 pads, crawler on 2 tracks)
function groundPressure(C, crane, R, slewRel, hookLoad) {
  if (C.type === "ped") return { N: 0, ex: 0, ey: 0, items: [], kind: "vessel" };
  const u = C.up, mass = C.mass || {};
  const Wbase = +mass.base || 0, Wcw = +crane.cwMass || +mass.cw || 0;
  const rcw = u.tail - u.cwD / 2;
  // boom direction in carrier frame (x right, y front)
  const d = [Math.sin(slewRel * Math.PI / 180), Math.cos(slewRel * Math.PI / 180)];
  // resultant moment about slew centre from hook load (at +R) and counterweight (at -rcw)
  // superlift ballast hanging off the SL mast: it is carried by the crane, behind the slew centre at the SL radius
  const SL = typeof slOf === "function" ? slOf(crane, C) : null, Wsl = SL ? SL.T : 0, rsl = SL ? SL.R : 0;
  const mx = hookLoad * R * d[0] - Wcw * rcw * d[0] - Wsl * rsl * d[0], my = hookLoad * R * d[1] - Wcw * rcw * d[1] - Wsl * rsl * d[1];
  const N = Wbase + Wcw + hookLoad + Wsl;
  const ex = mx / N, ey = my / N; // resultant position (m) in carrier frame
  if (C.type === "cr") {
    const k = C.car, B = k.shoe, L = typeof trackContact === "function" ? trackContact(crane, C) : k.len * 0.9; // ground contact length (idler to sprocket)
    const half = k.gauge / 2;
    const out = [];
    for (const sx of [-1, 1]) {
      const Nt = N * (0.5 + sx * ex / (2 * half));
      const e = ey;
      let qmax;
      if (Math.abs(e) <= L / 6) qmax = Nt / (B * L) * (1 + 6 * Math.abs(e) / L);
      else qmax = 2 * Nt / (3 * B * (L / 2 - Math.abs(e)));
      out.push({ name: sx < 0 ? "Left track" : "Right track", load: Nt, area: B * L, pressure: qmax, lift: Nt <= 0 || Math.abs(e) >= L / 2 });
    }
    return { N, ex, ey, items: out, kind: "track" };
  }
  const om = C.or.modes[crane.orMode] || Object.values(C.or.modes)[0];
  const P = om.pads.map(([sx, y]) => [sx * om.spread / 2, y]);
  const cx = P.reduce((a, p) => a + p[0], 0) / 4, cy = P.reduce((a, p) => a + p[1], 0) / 4;
  const Q = P.map(p => [p[0] - cx, p[1] - cy]);
  const sxx = Q.reduce((a, q) => a + q[0] * q[0], 0), syy = Q.reduce((a, q) => a + q[1] * q[1], 0);
  const Mx = N * (ex - cx), My = N * (ey - cy);
  const area = (typeof matInfo === "function" ? matInfo(crane).area : 0) || (+crane.matW || 2.5) * (+crane.matL || 2.5);
  const items = Q.map((q, i) => {
    const F = N / 4 + Mx * q[0] / sxx + My * q[1] / syy;
    return { name: "P" + (i + 1), load: F, area, pressure: F / area, lift: F <= 0 };
  });
  return { N, ex, ey, items, kind: "pad" };
}

// capacity for a crane's actual boom configuration (telescoping code / lattice length)
function craneCapacity(C, cr, chart, R) {
  if (!chart) return { cap: null, why: "no load chart selected" };
  const L = +cr.L, withI = chart.cols.map((c, i) => ({ ...c, i }));
  const modeOf = c => ((c.note || "").match(/mode\s*(\d+)/) || [])[1] || null;
  const hasCodes = C.boom.kind === "tele" && withI.some(modeOf);
  const code = hasCodes ? teleCode(C, cr.boomCfg) : null;
  let cols = hasCodes ? (code ? withI.filter(c => modeOf(c) === code) : []) : withI.filter(c => Math.abs(c.L - L) < 0.05);
  let note = "", conservative = false;
  if (!cols.length) {
    const L2 = chartLengths(chart).find(x => x >= L - 0.05);
    if (L2 == null) return { cap: null, why: `boom ${fx(L)} m is longer than any column in this chart`, code };
    cols = withI.filter(c => Math.abs(c.L - L2) < 0.05); conservative = true;
    note = hasCodes ? `Telescoping ${code || "set-up"} is not in this chart – lowest capacity of all modes at ${L2} m used` : `No chart column for ${fx(L, 2)} m – next longer boom ${L2} m used`;
  }
  let best = null, firstWhy = null;
  for (const c of cols) { const r = capAt(c, R); if (r.cap == null) { firstWhy = firstWhy || r; continue; } if (!best || r.cap < best.cap) best = { ...r, col: c }; }
  if (!best) return { cap: null, why: firstWhy ? firstWhy.why : "no capacity", rUsed: firstWhy?.rUsed, code, note };
  return { ...best, code, note, conservative, Lchart: best.col.L };
}

// distance between the two crane hooks in a tandem (spreader beam span when each crane takes one end of a beam)
function tandemSpan(load) {
  const R = load.rig;
  if (R && R.arr === "tandem" && R.tmode === "spreader" && R.beam) return +R.beam.len || +R.beam.snap?.len || +load.span || 0;
  return +load.span || 0;
}
