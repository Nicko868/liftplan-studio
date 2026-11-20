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
  return o;
}

// ---------- the forklift in 3D (front views, 3D view): chassis, counterweight, cab, mast, carriage and forks at height ----------
function forklift3D(M, o) {
  const F = flSpec(o) || FORKLIFTS.H16XD6, hf = o._forkH != null ? +o._forkH : 0.15, X = rot2([1, 0], -(o.rot || 0)), Y = rot2([0, 1], -(o.rot || 0));
  const P = (x, y, z) => [o.x + X[0] * x + Y[0] * y, o.y + X[1] * x + Y[1] * y, z], Fr = { o: [o.x, o.y, 0], x: [X[0], X[1], 0], y: [Y[0], Y[1], 0], z: [0, 0, 1] };
  const bx = (x0, x1, y0, y1, z0, z1, c) => M.box(Fr, x0, x1, y0, y1, z0, z1, c);
  const YEL = o.color || "#e8b90f", DK = "#2b2f33", GR = "#5b6168", L2 = F.l2 / 2, fa = L2 - F.x, ra = fa - F.y, R = (F.tyre?.d || 1.1) / 2, tw = F.tyre?.w || 0.3, W2 = F.b / 2;
  const tyre = (x, y) => M.cyl(P(x, y - tw / 2, R), P(x, y + tw / 2, R), R, "#202326", { n: 16, cap: "#3a3e42" });
  for (const s of [-1, 1]) { tyre(fa, s * (F.tread[0] / 2 - tw * 0.55)); tyre(fa, s * (F.tread[0] / 2 + tw * 0.55)); tyre(ra, s * F.tread[1] / 2); }
  bx(-L2, L2 - 0.45, -W2 + 0.35, W2 - 0.35, R * 0.75, R * 1.9, YEL);                                   // chassis
  bx(-L2, ra + 0.9, -W2 + 0.1, W2 - 0.1, R * 0.9, 2.25, shade(YEL, 0.92));                              // counterweight
  bx(-0.75, 0.95, -W2 + 0.25, 0.35, R * 1.9, F.h6 - 0.08, "#9fb3c2");                                    // cab glass
  bx(-0.8, 1.0, -W2 + 0.2, 0.4, F.h6 - 0.08, F.h6, DK);                                                  // cab roof / overhead guard
  const mx = L2 - 0.32, mastTop = Math.max(F.h1, F.h1 + Math.max(0, hf - (F.freeLift || 0)) * (F.h4 - F.h1) / Math.max(1, F.h3));
  for (const s of [-1, 1]) { bx(mx - 0.12, mx + 0.12, s * 0.62 - 0.1, s * 0.62 + 0.1, R * 0.6, F.h1, GR); if (mastTop > F.h1 + 0.05) bx(mx - 0.06, mx + 0.16, s * 0.48 - 0.08, s * 0.48 + 0.08, hf + 0.3, mastTop, shade(GR, 1.1)); }
  bx(mx - 0.12, mx + 0.12, -0.72, 0.72, F.h1 - 0.25, F.h1, GR);                                         // mast cross-head
  const cz = Math.max(0.1, hf - (F.fork?.s || 0.09));
  bx(L2 - 0.16, L2 - 0.02, -F.b3 / 2, F.b3 / 2, cz, cz + 1.05, DK);                                      // carriage
  const sp = (+o.fl?.spread || 1.2) / 2, fe = (F.fork?.e || 0.2) / 2, fl = F.fork?.l || 1.83, fs = F.fork?.s || 0.09;
  for (const s of [-1, 1]) { bx(L2 - 0.02, L2 + fl, s * sp - fe, s * sp + fe, cz, cz + fs, "#3a3e42"); bx(L2 - 0.06, L2 + 0.04, s * sp - fe, s * sp + fe, cz, cz + 1.0, "#3a3e42"); }
  if (o.fl?.how === "hook") { const c = +o.fl.c || F.c0; bx(L2, L2 + c + 0.15, -0.12, 0.12, cz + fs, cz + fs + 0.22, "#d9661f"); M.cyl(P(L2 + c, 0, cz + fs - 0.05), P(L2 + c, 0, cz + fs - 0.35), 0.07, "#3a3e42", { n: 10 }); }
  else bx(L2 + Math.max(0.1, (+o.fl?.c || F.c0) - 0.35), L2 + (+o.fl?.c || F.c0) + 0.35, -sp - 0.25, sp + 0.25, cz + fs, cz + fs + 0.18, "#8a6a3a");   // timber cradle on the forks
  if (o.label) M.label(P(0, 0, F.h6 + 0.9), o.label, "#34393f", 11);
  // the crane's rope to the top lifting point, and the fork hook's rigging to the tail, at the stage being drawn
  const D = typeof LS_DRAW !== "undefined" ? LS_DRAW : null;
  if (D && D.d3 && D.L && D.L.ft && D.L.fork === o && D.s) { const lugs = lsLugsWorld(D.L, D.s), q = D.s.per.find(p => !p.fork && !p.rel);
    if (q && !(D.L.ld.rig?.arr)) { M.line([q.hook[0], q.hook[1], Math.min(q.z, q.hMax ?? q.z)], lugs[0], "#0b7a66", 2.2); M.cyl(vadd(lugs[0], [0, 0, -0.12]), vadd(lugs[0], [0, 0, 0.32]), 0.14, "#d9661f"); }
    const fq = D.s.per.find(p => p.fork); if (fq && !fq.rel && o.fl?.how === "hook") M.line(P(L2 + (+o.fl.c || F.c0), 0, cz + fs - 0.35), lugs[1], "#0b7a66", 2); }
}
{ const _o3 = obj3D; obj3D = function (M, o, P2) { if (o.type === "forklift" && o.fl) { forklift3D(M, o); return true; } return _o3.call(this, M, o, P2); }; }
