// ================= Forklifts: tailing a top-and-tail upend with a forklift instead of a second crane =================
// A forklift is a site object (type "forklift") with o.fl = { model, load, how, c, attW, spread }: the load it tails,
// how it holds the tail ("forks" – in a cradle on the forks, or "hook" – a fork-mounted lifting hook), the load centre
// c (m, fork face to the support point) and the attachment's weight. The lift-steps engine moves it at every stage
// (it drives in as the crane hoists) and checks it: share on the forks, capacity at that load centre, fork height,
// axle loads and the rear axle staying loaded (tipping). Models are data – add one to FORKLIFTS from its spec sheet.
const FORKLIFTS = {
  H16XD6: {
    id: "H16XD6", name: "Hyster H16XD6", maker: "Hyster", src: "Hyster H10-16XD technical guide (H16XD6, standard pin carriage)",
    Q: 16.5, c0: 0.6,                 // rated capacity (t) at load centre c0 (m)
    x: 0.889, y: 3.3,                 // load distance: front axle centre to fork face; wheelbase (m)
    wt: 20.008, axle0: [9.908, 10.1], // service weight; axle loads without load, front / rear (t)
    axleRated: [33.853, 2.655],       // axle loads at rated load, front / rear (t) – from the spec sheet, used to check the model
    l2: 4.998, l1: 6.828, b: 2.541, h6: 3.083, h1: 4.193, h4: 6.648, h3: 5.0, freeLift: 0,
    tilt: [15, 12], fork: { s: 0.09, e: 0.2, l: 1.83 }, b3: 2.496, tread: [1.842, 2.0], tyre: { size: "12.00-20 20PR", d: 1.12, w: 0.31, front: 4, rear: 2 },
    mast: [[2.75, 16.5], [3, 16.5], [3.25, 16.5], [3.5, 16.5], [3.75, 16.5], [4, 16.5], [4.5, 16.5], [4.75, 16.5], [5, 16.5], [5.5, 16.32], [6, 16.12], [6.25, 16], [6.5, 15.88], [7, 15.6]]
  }
};
const flSpec = o => (o && o.fl && FORKLIFTS[o.fl.model]) || null;
// rated capacity (t) at load centre c (m) on a mast of lift height h3: the mast table's rating at c0, carried to c by
// the load moment about the front axle, Q·(x + c0) = Q(c)·(x + c) – the maker's chart is the authority; this is "~".
function flCap(F, c, mastH) {
  const row = (F.mast || []).find(r => r[0] >= (+mastH || F.h3) - 1e-6) || (F.mast || []).slice(-1)[0], Q0 = row ? row[1] : F.Q;
  const cc = Math.max(F.c0, +c || F.c0);
  return Q0 * (F.x + F.c0) / (F.x + cc);
}
// axle loads (t) with P tonnes on the forks at load centre c: moments about the front axle
function flAxles(F, P, c) { const a = F.x + (+c || F.c0); return [F.axle0[0] + P * (a + F.y) / F.y, F.axle0[1] - P * a / F.y]; }
const flHeading = u => -Math.atan2(u[1], u[0]) / D2R;   // obstacle rot (deg) that points the forks along u
// a forklift for the tail of a load: placed square to the load's tail end, the crane moved onto the top lifting point
function lsAddForklift(ld, model = "H16XD6") {
  const F = FORKLIFTS[model]; if (!ld || !F) return null;
  const sp = tandemSpan(ld) || loadDims(ld).x * 0.9, P = ld.pick, u = rot2([-1, 0], -(+P.rot || 0)), B = rot2([sp / 2, 0], -(+P.rot || 0));
  const c = F.c0, fc = [P.x + B[0] - u[0] * c, P.y + B[1] - u[1] * c], ctr = [fc[0] - u[0] * F.l2 / 2, fc[1] - u[1] * F.l2 / 2];
  const o = { id: uid(), type: "forklift", kind: "rect", x: ctr[0], y: ctr[1], w: F.l2, h: F.b, hgt: F.h6, rot: flHeading(u), color: "#e8b90f", label: `Forklift – ${F.name}`,
    fl: { model, load: ld.id, how: "forks", c, attW: 0, spread: 1.2 } };
  plan.obstacles.push(o);
  for (const c2 of plan.cranes) if (c2.attach?.load === ld.id) c2.attach.point = "A";
  if (ld.upend == null) ld.upend = true;
  // the set position is where the load stands: lifted in place, that is where its top end was (the hook stays over the top
  // lug while the forklift drives the tail in) – set the load there unless it already has a set position of its own
  if (Math.hypot(ld.set.x - P.x, ld.set.y - P.y) < 0.5) { const aE = tiltFn(ld, { tilt: Math.min(90, +(ld.upend?.to ?? 90) || 90) })([-sp / 2, 0, liftPointZ(ld)]), A = rot2([-sp / 2 - aE[0], -aE[1]], -(+P.rot || 0));
    ld.set = { ...ld.set, x: +(P.x + A[0]).toFixed(2), y: +(P.y + A[1]).toFixed(2), rot: +P.rot || 0 }; }
  return o;
}

// ---------- the forklift in 3D (front views, 3D view) ----------
// Built to the spec sheet's dimensions: length to fork face l2, width, wheelbase y, load distance x, overhead guard h6,
// mast lowered h1, tyres. Body and counterweight are side profiles (wheel arches, rounded counterweight, engine hood),
// cab with posts, glass and overhead guard, a two-stage mast (outer and inner channels, lift and tilt cylinders, chains),
// carriage with load backrest, tapered forks at the fork height, dual front tyres on rims under fenders.
function forklift3D(M, o) {
  const F = flSpec(o) || FORKLIFTS.H16XD6, hf = o._forkH != null ? Math.max(0.05, +o._forkH) : 0.15, X = rot2([1, 0], -(o.rot || 0)), Y = rot2([0, 1], -(o.rot || 0));
  const P = (x, y, z) => [o.x + X[0] * x + Y[0] * y, o.y + X[1] * x + Y[1] * y, z], Fr = { o: [o.x, o.y, 0], x: [X[0], X[1], 0], y: [Y[0], Y[1], 0], z: [0, 0, 1] };
  const bx = (x0, x1, y0, y1, z0, z1, c, op) => M.box(Fr, x0, x1, y0, y1, z0, z1, c, op);
  const ex = (prof, y0, y1, c, op) => M.extrude(Fr, prof, y0, y1, c, op);
  const arc = (cx, cz, r, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * D2R; return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; });
  const BODY = o.color || "#e3b505", BODY2 = shade(BODY, 0.86), DK = "#2c3136", MAST = "#3d4247", MAST2 = "#555c63", GLASS = "#a8bfcd", TYRE = "#1f2225", RIM = "#c9a40a", STEEL = "#7d858d";
  const L2 = F.l2 / 2, fa = L2 - F.x, ra = fa - F.y, R = (F.tyre?.d || 1.12) / 2, tw = F.tyre?.w || 0.315, W2 = F.b / 2, H6 = F.h6;
  // ---- wheels: dual front drive tyres, single rear steer tyres, rims and hubs
  const wheel = (x, y, side) => { const y0 = y - tw / 2, y1 = y + tw / 2, out = side > 0 ? y1 : y0;
    M.cyl(P(x, y0, R), P(x, y1, R), R, TYRE, { n: 22, cap: "#2b2f33" });
    M.cyl(P(x, out, R), P(x, out + side * 0.02, R), R * 0.6, RIM, { n: 18, cap: shade(RIM, 0.9) });
    M.cyl(P(x, out + side * 0.02, R), P(x, out + side * 0.07, R), R * 0.22, STEEL, { n: 12 }); };
  const tf = F.tread[0] / 2, tr = F.tread[1] / 2;
  for (const s of [-1, 1]) { wheel(fa, s * (tf + tw * 0.52), s); wheel(fa, s * (tf - tw * 0.52), s); wheel(ra, s * tr, s); }
  // ---- frame between the wheels and the drive axle housing
  ex([[ra - 0.55, 0.42], [fa + 0.45, 0.42], [fa + 0.6, 0.6], [fa + 0.6, 1.2], [ra - 0.7, 1.2], [ra - 0.7, 0.6]], -0.52, 0.52, DK);
  M.cyl(P(fa, -tf + tw, R), P(fa, tf - tw, R), 0.2, DK, { n: 12 });
  // ---- body: side profile with both wheel arches, front deck low for the driver's view, engine hood and rounded counterweight
  const ar = R + 0.1, zb = 0.62;
  const prof = [[-L2 + 0.12, zb], ...arc(ra, R, ar, 180, 0, 12).filter(p => p[1] >= zb - 0.01), ...arc(fa, R, ar, 180, 0, 12).filter(p => p[1] >= zb - 0.01).filter(p => p[0] < L2 - 0.3),
    [L2 - 0.3, 1.05], [L2 - 0.45, 1.3], [0.95, 1.3], [0.95, 1.36], [-0.95, 1.36], [-1.0, 1.95], [-1.15, 2.1], [-L2 + 0.55, 2.16], ...arc(-L2 + 0.55, 1.6, 0.56, 90, 180, 6).slice(1), [-L2 - 0.01, 1.2], [-L2 + 0.02, 0.85]];
  ex(prof, -W2 + 0.04, W2 - 0.04, BODY, { soft: false });
  // fenders over the front tyres (outside the body) and steps
  for (const s of [-1, 1]) { const y0 = s > 0 ? W2 - 0.04 : -W2 - 0.02, y1 = s > 0 ? W2 + 0.02 : -W2 + 0.04, fp = [...arc(fa, R, ar + 0.08, 175, 5, 14), ...arc(fa, R, ar, 5, 175, 14)];
    ex(fp, Math.min(y0, y1), Math.max(y0, y1), BODY2, { soft: true });
    bx(-0.75, -0.2, s * (W2 - 0.02) - 0.12, s * (W2 - 0.02) + 0.12, 0.62, 0.68, DK); bx(-0.75, -0.2, s * (W2 - 0.02) - 0.12, s * (W2 - 0.02) + 0.12, 0.98, 1.04, DK); }
  // counterweight band and rear light cluster
  ex([[-L2 + 0.02, 0.85], [-L2 + 0.25, 0.85], [-L2 + 0.25, 1.05], [-L2 - 0.01, 1.05]], -W2 + 0.02, W2 - 0.02, BODY2);
  for (const s of [-1, 1]) bx(-L2 - 0.03, -L2 + 0.02, s * (W2 - 0.3) - 0.1, s * (W2 - 0.3) + 0.1, 1.55, 1.72, "#b4342c");
  // engine hood grille
  for (let k = 0; k < 4; k++) bx(-L2 + 0.75 + k * 0.22, -L2 + 0.85 + k * 0.22, -W2 + 0.03, W2 - 0.03, 2.16, 2.18, DK);
  // ---- cab: posts, glass, overhead guard, seat and steering wheel inside, beacon
  const cx0 = -0.95, cx1 = 0.9, cw = 0.78, rz = H6 - 0.1;
  for (const [x, lean] of [[cx0, 0], [cx1, -0.12]]) for (const s of [-1, 1]) { const y = s * cw; M.box({ o: P(x, y, 1.36), x: vnorm([X[0] * lean, X[1] * lean, 1]), y: [X[0], X[1], 0], z: [Y[0], Y[1], 0] }, 0, rz - 1.36, -0.05, 0.05, -0.05, 0.05, DK); }
  ex([[cx0 + 0.06, 1.38], [cx1 - 0.06, 1.38], [cx1 - 0.16, rz - 0.04], [cx0 + 0.06, rz - 0.04]], -cw + 0.02, cw - 0.02, GLASS, { alpha: 0.55 });
  bx(cx0 - 0.08, cx1 + 0.06, -cw - 0.1, cw + 0.1, rz, H6, DK);                                   // overhead guard / roof
  bx(cx0 + 0.25, cx0 + 0.75, -0.25, 0.25, 1.36, 1.85, "#1d2125"); bx(cx0 + 0.25, cx0 + 0.35, -0.25, 0.25, 1.85, 2.35, "#1d2125");   // seat
  M.cyl(P(cx0 + 0.2, cw - 0.2, H6), P(cx0 + 0.2, cw - 0.2, H6 + 0.16), 0.08, "#f39c12", { n: 12 });                                 // beacon
  M.cyl(P(-L2 + 0.4, -W2 + 0.35, 2.16), P(-L2 + 0.4, -W2 + 0.35, H6 + 0.15), 0.06, "#4a4f55", { n: 10 });                            // exhaust stack
  // ---- mast: outer channels (fixed), inner channels (rise with the carriage), cross ties, lift and tilt cylinders, chains
  const mx = L2 - 0.2, ow = 0.62, iw = 0.47, cz = Math.max(0.08, hf - (F.fork?.s || 0.09)), back = cz + 1.42, inTop = Math.max(F.h1 - 0.05, back + 0.12);
  for (const s of [-1, 1]) {
    ex([[mx - 0.09, 0.32], [mx + 0.09, 0.32], [mx + 0.09, F.h1], [mx - 0.09, F.h1]], s * ow - 0.07, s * ow + 0.07, MAST);           // outer channel
    ex([[mx + 0.01, Math.max(0.42, inTop - F.h1 + 0.42)], [mx + 0.13, Math.max(0.42, inTop - F.h1 + 0.42)], [mx + 0.13, inTop], [mx + 0.01, inTop]], s * iw - 0.06, s * iw + 0.06, MAST2);   // inner channel
    M.cyl(P(mx - 0.2, s * 0.32, 0.45), P(mx - 0.2, s * 0.32, F.h1 - 0.5), 0.075, STEEL, { n: 12 });                                 // lift cylinder
    M.cyl(P(mx - 0.2, s * 0.32, F.h1 - 0.5), P(mx - 0.2, s * 0.32, Math.max(F.h1 - 0.3, inTop - 0.15)), 0.045, "#c7ccd1", { n: 10 }); // rod
    M.cyl(P(fa + 0.05, s * (ow + 0.12), 1.15), P(mx - 0.1, s * (ow + 0.12), 1.55), 0.07, STEEL, { n: 12 });                          // tilt cylinder
    M.line(P(mx + 0.07, s * 0.2, inTop - 0.1), P(mx + 0.2, s * 0.2, cz + 0.7), "#16202a", 1.4); }                                    // lift chain
  for (const z of [1.3, F.h1 - 0.18]) bx(mx - 0.08, mx + 0.08, -ow, ow, z, z + 0.16, MAST);                                          // outer cross ties
  bx(mx + 0.02, mx + 0.12, -iw, iw, inTop - 0.18, inTop, MAST2);                                                                     // inner cross head
  // ---- carriage and load backrest
  const fx0 = L2 - 0.12, b3 = F.b3 / 2;
  bx(fx0 - 0.04, fx0 + 0.02, -b3, b3, cz + 0.05, cz + 0.7, MAST2);
  for (const z of [cz + 0.05, cz + 0.55]) bx(fx0, fx0 + 0.08, -b3, b3, z, z + 0.15, DK);
  bx(fx0 - 0.02, fx0 + 0.04, -b3 + 0.05, b3 - 0.05, back - 0.06, back, DK);
  for (let k = 0; k <= 8; k++) { const y = -b3 + 0.08 + k * (2 * b3 - 0.16) / 8; bx(fx0 - 0.01, fx0 + 0.03, y - 0.025, y + 0.025, cz + 0.7, back, DK); }
  // ---- forks: shank on the carriage, blade tapering to the tip, rounded heel
  const sp = (+o.fl?.spread || 1.2) / 2, fe = (F.fork?.e || 0.2) / 2, fl = F.fork?.l || 1.83, fs = F.fork?.s || 0.09, ff = L2;
  const fork = [[ff - 0.07, cz + 0.95], [ff + 0.02, cz + 0.95], [ff + 0.02, cz + fs + 0.05], ...arc(ff + 0.07, cz + fs + 0.05, 0.05, 180, 270, 4).slice(1), [ff + fl - 0.12, cz + fs], [ff + fl, cz + 0.02], [ff + fl, cz], [ff - 0.07, cz]];
  for (const s of [-1, 1]) ex(fork, s * sp - fe, s * sp + fe, "#3a3f44", { soft: false });
  // what holds the tail: a timber cradle on the forks, or a fork-mounted hook with its beam
  const lc = +o.fl?.c || F.c0;
  if (o.fl?.how === "hook") { ex([[ff, cz + fs], [ff + lc + 0.18, cz + fs], [ff + lc + 0.18, cz + fs + 0.26], [ff, cz + fs + 0.26]], -0.16, 0.16, "#d9661f");
    M.cyl(P(ff + lc, 0, cz + fs), P(ff + lc, 0, cz + fs - 0.22), 0.05, STEEL, { n: 10 }); M.cyl(P(ff + lc, -0.05, cz + fs - 0.3), P(ff + lc, 0.05, cz + fs - 0.3), 0.09, "#3a3e42", { n: 14 }); }
  else { const c0 = Math.max(0.15, lc - 0.4), c1 = Math.min(fl - 0.05, lc + 0.4);
    ex([[ff + c0, cz + fs], [ff + c1, cz + fs], [ff + c1, cz + fs + 0.22], [ff + (c0 + c1) / 2 + 0.12, cz + fs + 0.1], [ff + (c0 + c1) / 2 - 0.12, cz + fs + 0.1], [ff + c0, cz + fs + 0.22]], -sp - 0.3, sp + 0.3, "#9a7448", { soft: false }); }
  if (o.label) M.label(P(-0.3, 0, H6 + 0.9), o.label, "#34393f", 11);
  // the crane's rope to the top lifting point, and the fork hook's rigging to the tail, at the stage being drawn
  const D = typeof LS_DRAW !== "undefined" ? LS_DRAW : null;
  if (D && D.d3 && D.L && D.L.ft && D.L.fork === o && D.s) { const lugs = lsLugsWorld(D.L, D.s), q = D.s.per.find(p => !p.fork && !p.rel);
    if (q && !(D.L.ld.rig?.arr)) { M.line([q.hook[0], q.hook[1], Math.min(q.z, q.hMax ?? q.z)], lugs[0], "#0b7a66", 2.2); M.cyl(vadd(lugs[0], [0, 0, -0.12]), vadd(lugs[0], [0, 0, 0.32]), 0.14, "#d9661f"); }
    const fq = D.s.per.find(p => p.fork); if (fq && !fq.rel && o.fl?.how === "hook") M.line(P(ff + lc, 0, cz + fs - 0.38), lugs[1], "#0b7a66", 2); }
}
// ---------- the forklift in plan: body outline, wheels, cab / overhead guard, counterweight, mast, carriage, forks to scale ----------
function forkliftPlan(s, o) {
  const F = flSpec(o) || FORKLIFTS.H16XD6, X = rot2([1, 0], -(o.rot || 0)), Y = rot2([0, 1], -(o.rot || 0)), loc = (x, y) => [o.x + X[0] * x + Y[0] * y, o.y + X[1] * x + Y[1] * y];
  const L2 = F.l2 / 2, W2 = F.b / 2, fa = L2 - F.x, ra = fa - F.y, R = (F.tyre?.d || 1.12) / 2, tw = F.tyre?.w || 0.315, col = "#34393f", poly = (pts, op) => s.poly("LOAD", pts.map(p => loc(p[0], p[1])), { closed: true, w: 0.7, color: col, ...op });
  const tf = F.tread[0] / 2, tr = F.tread[1] / 2;
  for (const sg of [-1, 1]) { for (const [x, y] of [[fa, sg * (tf + tw * 0.52)], [fa, sg * (tf - tw * 0.52)], [ra, sg * tr]]) poly([[x - R, y - tw / 2], [x + R, y - tw / 2], [x + R, y + tw / 2], [x - R, y + tw / 2]], { fill: "#2a2e33", color: "#2a2e33" }); }
  poly([[-L2 + 0.3, -W2], [L2 - 0.3, -W2], [L2 - 0.3, W2], [-L2 + 0.3, W2], [-L2, W2 - 0.35], [-L2, -W2 + 0.35]], { fill: o.color || "#e3b505", w: 0.9 });   // body (rounded rear corners)
  poly([[-L2, -W2 + 0.35], [-L2 + 0.65, -W2 + 0.05], [-L2 + 0.65, W2 - 0.05], [-L2, W2 - 0.35]], { fill: shade(o.color || "#e3b505", 0.85) });               // counterweight
  poly([[-1.03, -0.88], [0.96, -0.88], [0.96, 0.88], [-1.03, 0.88]], { fill: "#5e6872", color: "#2b2f33" });                                               // overhead guard
  s.poly("LOAD", [loc(-1.03, -0.88), loc(0.96, 0.88)], { w: 0.5, color: "#c9d1d8" }); s.poly("LOAD", [loc(-1.03, 0.88), loc(0.96, -0.88)], { w: 0.5, color: "#c9d1d8" });
  poly([[L2 - 0.29, -0.69], [L2 - 0.11, -0.69], [L2 - 0.11, 0.69], [L2 - 0.29, 0.69]], { fill: "#3d4247" });                                                 // mast
  poly([[L2 - 0.12, -F.b3 / 2], [L2, -F.b3 / 2], [L2, F.b3 / 2], [L2 - 0.12, F.b3 / 2]], { fill: "#2b2f33" });                                                // carriage
  const sp = (+o.fl?.spread || 1.2) / 2, fe = (F.fork?.e || 0.2) / 2, fl = F.fork?.l || 1.83;
  for (const sg of [-1, 1]) poly([[L2, sg * sp - fe], [L2 + fl - 0.1, sg * sp - fe], [L2 + fl, sg * sp], [L2 + fl - 0.1, sg * sp + fe], [L2, sg * sp + fe]], { fill: "#4a4f55", color: "#2b2f33" });   // forks
  if (o.fl?.c) { const c = +o.fl.c; s.poly("LOAD", [loc(L2 + c, -sp - 0.35), loc(L2 + c, sp + 0.35)], { w: 0.6, color: "#b42318", dash: [0.25, 0.15] }); }   // load centre
}
{ const _os = objScene; objScene = function (o) { if (o.type !== "forklift" || !o.fl || o.kind !== "rect") return _os.call(this, o);
    const sc = new Scene(); forkliftPlan(sc, o); if (o.label) { const F = flSpec(o) || FORKLIFTS.H16XD6, v = rot2([0, -(F.b / 2 + 0.8)], -(o.rot || 0)); sc.text("TEXT", [o.x + v[0], o.y + v[1]], o.label, 0.6, { bold: true, color: "#34393f" }); } return sc; }; }
{ const _o3 = obj3D; obj3D = function (M, o, P2) { if (o.type === "forklift" && o.fl) { forklift3D(M, o); return true; } return _o3.call(this, M, o, P2); }; }
