// ================= Realistic 3D (WebGL) =================
// The 3D view draws the same model as before (cranes, loads, rigging, site objects, vessels – built once in buildMesh)
// with a real-time renderer: perspective camera, sunlight with soft shadows, sky and haze, reflections on steel and
// water, smooth round parts, concrete yard or sea round a quay, and the site drawing / photo on the ground.
// Side elevations and the printed sheets stay as engineering drawings (SVG). No WebGL → the old 3D drawing is used.
// surfaces that get a real texture in the 3D view (deck concrete, road asphalt): the option rides on the face
{ const _f = Mesh.prototype.face; Mesh.prototype.face = function (pts, fill, o = {}) { _f.call(this, pts, fill, o); if (o.tex) this.faces[this.faces.length - 1].tex = o.tex; }; }
{ const _d = obj3DDeck; obj3DDeck = function (M, o, P2) { M.prism(P2, -1.6, 0, obsColor(o), { bias: -1e5, tex: "yard" }); return true; }; }
{ const _o3 = obj3D; obj3D = function (M, o, P2) { if (o.type === "road" && !(+o.hgt > 0.05)) { M.prism(P2, 0, 0.03, "#5b5f63", { tex: "asphalt" }); return true; } return _o3(M, o, P2); }; }
// surface finish from the colour a part is drawn in: glossy paint, rubber, bare steel, glass, matt everything else
const GL_MATS = { paint: [0.38, 0.12, 0.85], rubber: [0.92, 0, 0.2], steel: [0.32, 0.75, 1], glass: [0.08, 0.35, 1.2], std: [0.66, 0.04, 0.55] };
const GL_STEEL = new Set(["#8a9199", "#c9ced3", "#a7aeb5", "#7d858c", "#6b7278", "#c3c9cf", "#5f666d", "#6b737b", "#8f979e", "#9aa1a8"]);
function glClass(hex) {
  const h = String(hex || "").toLowerCase(); if (GL_STEEL.has(h)) return "steel"; if (h === "#4c6377" || h === "#3d5366") return "glass";
  const c = new THREE.Color(); try { c.setStyle(h); } catch (e) { return "std"; } const hsl = {}; c.getHSL(hsl);
  if (hsl.l < 0.17) return "rubber"; if (hsl.s > 0.45 && hsl.l > 0.2 && hsl.l < 0.8) return "paint"; return "std";
}
const GL = { ok: null, sig: "", R: null, scene: null, cam: null, root: null, lines: [], inst: null, focus: null, sun: null, labels: [], tex: {}, fov: 34 };
function glAvailable() {
  if (GL.ok != null) return GL.ok;
  try { const c = document.createElement("canvas"); GL.ok = !!(window.THREE && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { GL.ok = false; }
  return GL.ok;
}
const glCol = hex => { const c = new THREE.Color(); try { c.setStyle(hex || "#9aa3ad"); } catch (e) { c.set(0x9aa3ad); } return c.convertSRGBToLinear(); };
// ---------- one-off set-up: renderer, sky, light, ground ----------
function glInit() {
  const R = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: false });
  R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.92;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.domElement.className = "gl3d";
  const S = new THREE.Scene(), cam = new THREE.PerspectiveCamera(GL.fov, 1.6, 0.5, 20000); cam.up.set(0, 0, 1);
  // sky dome: haze at the horizon, blue overhead (also the reflections on steel and water)
  const sky = glSky(); S.add(sky);
  const pm = new THREE.PMREMGenerator(R), envScene = new THREE.Scene(); envScene.add(glSky());
  { const g = new THREE.Mesh(new THREE.CircleGeometry(4000, 24), new THREE.MeshBasicMaterial({ color: 0x8c8a82 })); g.position.z = -2; envScene.add(g); }
  S.environment = pm.fromScene(envScene, 0.02).texture;
  S.fog = new THREE.Fog(0xdfe7ee, 350, 2400);
  const hemi = new THREE.HemisphereLight(0xd8e8f7, 0x8a8576, 0.5); hemi.position.set(0, 0, 1); S.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e2, 1.55); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 2.5;
  S.add(sun); S.add(sun.target);
  const root = new THREE.Group(); S.add(root);
  Object.assign(GL, { R, scene: S, cam, root, sun, sky });
}
function glSky() {
  const geo = new THREE.SphereGeometry(9000, 32, 16), col = [], p = geo.attributes.position;
  const hor = new THREE.Color(0xe4ebf0).convertSRGBToLinear(), mid = new THREE.Color(0xa9c6e2).convertSRGBToLinear(), top = new THREE.Color(0x5d8fc6).convertSRGBToLinear(), gnd = new THREE.Color(0xc9cdc9).convertSRGBToLinear();
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i) / 9000, c = z < 0 ? gnd.clone().lerp(hor, Math.max(0, 1 + z * 8)) : z < 0.25 ? hor.clone().lerp(mid, z / 0.25) : mid.clone().lerp(top, (z - 0.25) / 0.75); col.push(c.r, c.g, c.b); }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.rotateX(Math.PI / 2);    // the sphere's poles on z (z is up here)
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); m.renderOrder = -10;
  return m;
}
// procedural ground textures: concrete yard (with a faint 5 m grid for scale) and sea
function glGroundTex(kind) {
  if (GL.tex[kind]) return GL.tex[kind];
  const n = 512, c = document.createElement("canvas"); c.width = c.height = n; const g = c.getContext("2d");
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  if (kind === "asphalt") {
    g.fillStyle = "#4a4d50"; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 30000; i++) { const v = 50 + rnd() * 60 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},${0.25 + rnd() * 0.3})`; g.fillRect(rnd() * n, rnd() * n, 1 + rnd() * 1.6, 1 + rnd() * 1.6); }
  } else if (kind === "sea") {
    g.fillStyle = "#3f6f8c"; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) { const x = rnd() * n, y = rnd() * n, w = 6 + rnd() * 26, a = 0.04 + rnd() * 0.08; g.strokeStyle = rnd() > 0.5 ? `rgba(220,235,245,${a})` : `rgba(20,45,65,${a})`; g.lineWidth = 1 + rnd() * 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 2 - rnd() * 2, x + w, y); g.stroke(); }
  } else {
    g.fillStyle = "#a4a49f"; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 26000; i++) { const x = rnd() * n, y = rnd() * n, v = 150 + rnd() * 70 | 0; g.fillStyle = `rgba(${v},${v - 2},${v - 8},${0.18 + rnd() * 0.2})`; g.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2); }
    for (let i = 0; i < 40; i++) { const x = rnd() * n, y = rnd() * n, r = 10 + rnd() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(90,88,80,${0.05 + rnd() * 0.06})`); gr.addColorStop(1, "rgba(90,88,80,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    g.strokeStyle = "rgba(70,72,70,.32)"; g.lineWidth = 2; g.strokeRect(0, 0, n, n); g.strokeStyle = "rgba(70,72,70,.14)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(n / 2, 0); g.lineTo(n / 2, n); g.moveTo(0, n / 2); g.lineTo(n, n / 2); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
  return (GL.tex[kind] = t);
}
// ---------- the model: Mesh faces → a few merged buffers (flat, smooth, see-through) ----------
function glTriangulate(P, n) {
  if (P.length === 3) return [[0, 1, 2]];
  let convex = true;
  for (let i = 0; i < P.length && convex; i++) { const a = P[i], b = P[(i + 1) % P.length], c = P[(i + 2) % P.length]; if (vdot(vcross(vsub(b, a), vsub(c, b)), n) < -1e-9) convex = false; }
  if (convex) { const T = []; for (let i = 1; i < P.length - 1; i++) T.push([0, i, i + 1]); return T; }
  const ax = Math.abs(n[0]) > Math.abs(n[1]) ? (Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2) : (Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2), i0 = (ax + 1) % 3, i1 = (ax + 2) % 3;
  const c2 = P.map(p => new THREE.Vector2(p[i0], p[i1]));
  try { return THREE.ShapeUtils.triangulateShape(c2, []); } catch (e) { const T = []; for (let i = 1; i < P.length - 1; i++) T.push([0, i, i + 1]); return T; }
}
function glBuild(M, opt = {}) {
  const root = GL.root, keepBounds = GL.bounds;
  for (const ch of [...root.children]) { root.remove(ch); ch.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material._keep) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }); }
  const flats = {}, glass = new Map(), smooth = new Map();
  const flatOf = k => flats[k] || (flats[k] = { p: [], n: [], c: [] });
  let bx0 = 1e9, by0 = 1e9, bz0 = 1e9, bx1 = -1e9, by1 = -1e9, bz1 = -1e9;
  for (const f of M.faces) {
    const P = f.pts; if (!P || P.length < 3) continue;
    let n = newell(P); const nl = Math.hypot(...n); if (nl < 1e-12) continue; n = [n[0] / nl, n[1] / nl, n[2] / nl];
    const col = glCol(f.fill), T = glTriangulate(P, n);
    for (const p of P) { if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0]; if (p[1] < by0) by0 = p[1]; if (p[1] > by1) by1 = p[1]; if (p[2] < bz0) bz0 = p[2]; if (p[2] > bz1) bz1 = p[2]; }
    if (f.tex) {
      if (!glass.has("tex:" + f.tex)) glass.set("tex:" + f.tex, { p: [], n: [], c: [], uv: [] }); const B = glass.get("tex:" + f.tex), rep = f.tex === "yard" ? 10 : 8, horiz = Math.abs(n[2]) > 0.7;
      const tint = f.tex === "yard" ? glCol("#dddcd8") : new THREE.Color(1, 1, 1);
      for (const t of T) { const a = P[t[0]], b = P[t[1]], c = P[t[2]]; if (vdot(vcross(vsub(b, a), vsub(c, a)), n) < 0) t.reverse(); for (const i of t) { const p = P[i]; B.p.push(...p); B.n.push(...n); B.c.push(tint.r, tint.g, tint.b); B.uv.push(horiz ? p[0] / rep : (p[0] * Math.abs(n[1]) + p[1] * Math.abs(n[0])) / rep, horiz ? p[1] / rep : p[2] / rep); } }
      continue;
    }
    if (f.alpha < 1) {
      const k = Math.round(f.alpha * 20) / 20; if (!glass.has(k)) glass.set(k, { p: [], n: [], c: [] }); const B = glass.get(k);
      for (const t of T) for (const i of t) { B.p.push(...P[i]); B.n.push(...n); B.c.push(col.r, col.g, col.b); }
      continue;
    }
    if (f.soft) {   // round parts: shared vertices, averaged normals → smooth shading
      for (const t of T) { const a = P[t[0]], b = P[t[1]], c = P[t[2]]; let tn = vcross(vsub(b, a), vsub(c, a)); if (vdot(tn, n) < 0) t.reverse();
        for (const i of t) { const p = P[i], key = `${p[0].toFixed(3)},${p[1].toFixed(3)},${p[2].toFixed(3)},${f.fill}`; let v = smooth.get(key); if (!v) { v = { p, n: [0, 0, 0], c: col, idx: [] }; smooth.set(key, v); } v.n = vadd(v.n, n); v.idx.push(1); }
        smooth._tris = smooth._tris || []; smooth._tris.push(t.map(i => `${P[i][0].toFixed(3)},${P[i][1].toFixed(3)},${P[i][2].toFixed(3)},${f.fill}`)); }
      continue;
    }
    const flat = flatOf(glClass(f.fill)); for (const t of T) { const a = P[t[0]], b = P[t[1]], c = P[t[2]]; if (vdot(vcross(vsub(b, a), vsub(c, a)), n) < 0) t.reverse(); for (const i of t) { flat.p.push(...P[i]); flat.n.push(...n); flat.c.push(col.r, col.g, col.b); } }
  }

  const mk = (B, m, shadow = true) => { if (!B.p.length) return; const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(B.n, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(B.c, 3)); const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = true; root.add(o); return o; };
  for (const [k, B] of Object.entries(flats)) { const q = GL_MATS[k] || GL_MATS.std; mk(B, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: q[0], metalness: q[1], side: THREE.DoubleSide, envMapIntensity: q[2] })); }
  if (smooth._tris) {
    const keys = [...smooth.keys()], ix = new Map(keys.map((k, i) => [k, i])), B = { p: [], n: [], c: [] };
    for (const k of keys) { const v = smooth.get(k), l = Math.hypot(...v.n) || 1; B.p.push(...v.p); B.n.push(v.n[0] / l, v.n[1] / l, v.n[2] / l); B.c.push(v.c.r, v.c.g, v.c.b); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(B.n, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(B.c, 3));
    g.setIndex(smooth._tris.flat().map(k => ix.get(k)));
    const o = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide, envMapIntensity: 0.8 })); o.castShadow = true; o.receiveShadow = true; root.add(o);
  }
  for (const [a, B] of glass) {
    if (typeof a === "string") { const kind = a.slice(4); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(B.n, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(B.c, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(B.uv, 2));
      const t = glGroundTex(kind); const o = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: kind === "asphalt" ? 0.85 : 0.9, metalness: 0, envMapIntensity: 0.4, side: THREE.DoubleSide })); o.material._keepMap = true; o.receiveShadow = true; o.castShadow = kind !== "asphalt"; root.add(o); continue; } const o = mk(B, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0, transparent: true, opacity: Math.max(0.12, a), depthWrite: false, side: THREE.DoubleSide }), false); if (o) o.renderOrder = 2; }
  // ropes, slings and lines: real round strands (kept at least ~1.5 px thick so they read at any zoom)
  GL.lines = M.lines.filter(l => l.a && l.b && Math.hypot(...vsub(l.b, l.a)) > 1e-3);
  if (GL.lines.length) {
    const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.35, envMapIntensity: 0.6 }), GL.lines.length);
    GL.lines.forEach((l, i) => inst.setColorAt(i, glCol(l.color)));
    inst.castShadow = true; inst.receiveShadow = true; root.add(inst); GL.inst = inst;
    for (const l of GL.lines) for (const p of [l.a, l.b]) { if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0]; if (p[1] < by0) by0 = p[1]; if (p[1] > by1) by1 = p[1]; if (p[2] > bz1) bz1 = p[2]; }
  } else GL.inst = null;
  if (bx0 > bx1) { bx0 = by0 = -20; bx1 = by1 = 20; bz0 = 0; bz1 = 10; }
  GL.bounds = [bx0, by0, Math.min(0, bz0), bx1, by1, bz1];
  if (opt.movingOnly) { if (keepBounds) GL.bounds = keepBounds; GL.labels = M.labels.filter(l => l.text); return; }   // Play lift: only what moves – ground, site and the rest stay built
  // what the camera looks at: the lift (cranes, booms, loads); the whole site when there is no lift yet
  const H = (M.handles || []).map(h => h.p);
  // loads count too (with no crane yet, or Pick & Set shown together) – a big site picture must not pull the camera out to the whole drawing
  for (const ld of plan.loads || []) for (const ph of plan.phase === "both" || !(M.handles || []).length ? ["pick", "set"] : [plan.phase]) { const q = ld[ph]; if (!q) continue; const e = loadExtent(ld), z = (+q.h || 0) + loadDims(ld).z; H.push([q.x - e, q.y - e, z], [q.x + e, q.y + e, z]); }
  // vessels in the job (a load picked from / set on it, or a crane on it) are kept in view – ships just moored nearby are not
  const inJob = o => (plan.loads || []).some(l => l.pick?.onV === o.id || l.set?.onV === o.id) || (plan.cranes || []).some(c => c.vessel === o.id);
  if (H.length) for (const o of plan.obstacles) if (typeof isVessel === "function" && isVessel(o) && inJob(o)) for (const p of obsPts(o)) H.push([p[0], p[1], 0]);
  if (H.length) { const xs = H.map(p => p[0]), ys = H.map(p => p[1]), zs = H.map(p => p[2]); GL.focus = [Math.min(...xs) - 8, Math.min(...ys) - 8, 0, Math.max(...xs) + 8, Math.max(...ys) + 8, Math.max(8, ...zs)]; }
  else GL.focus = GL.bounds.slice();
  glGround();
  // names of site items far outside the lift area are left off (they crowd the view); cranes, loads and nearby items keep theirs
  { const F = GL.focus, m = Math.max(40, 0.6 * Math.hypot(F[3] - F[0], F[4] - F[1]));
    GL.labels = M.labels.filter(l => l.text && (!l.p || (l.p[0] > F[0] - m && l.p[0] < F[3] + m && l.p[1] > F[1] - m && l.p[1] < F[4] + m))); }
}
function glGround() {
  GL.land = null;
  const b = GL.bounds, cx = (b[0] + b[3]) / 2, cy = (b[1] + b[4]) / 2, span = Math.max(b[3] - b[0], b[4] - b[1]) + 20000;
  const deck = plan.obstacles.some(o => o.type === "deck" && (o.pts || []).length > 2), quays = plan.obstacles.filter(o => o.type === "quay" && (o.pts || []).length > 1);
  const sea = deck || quays.length, wl = siteWaterLevel();
  GL.land = deck ? plan.obstacles.filter(o => o.type === "deck" && (o.pts || []).length > 2).map(o => o.pts) : null;
  for (const t of GL.gTex || []) t.dispose(); GL.gTex = [];
  const texFor = (kind, rep, x0, y0) => { const t = glGroundTex(kind).clone(); t.needsUpdate = true; t.repeat.set(1 / rep, 1 / rep); if (x0 != null) t.offset.set(0, 0); GL.gTex.push(t); return t; };
  const plane = (kind, z, rough, metal, env) => { const t = texFor(kind, kind === "sea" ? 40 : 10); const g = new THREE.PlaneGeometry(span, span); const uv = g.attributes.uv, pos = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + cx, pos.getY(i) + cy);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: rough, metalness: metal, envMapIntensity: env, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })); m.position.set(cx, cy, z); m.receiveShadow = true; GL.root.add(m); };
  if (!sea) { plane("yard", -0.005, 0.92, 0, 0.4); glUnderlay(); return; }
  plane("sea", wl, 0.32, 0.02, 0.9);
  // land behind a drawn quay line (land is on the left of the line, as everywhere in the app): a slab with its quay wall
  if (!deck) for (const q of quays.slice(0, 1)) {
    const P = q.pts, a = P[0], z = P[P.length - 1], L = Math.hypot(z[0] - a[0], z[1] - a[1]) || 1, u = [(z[0] - a[0]) / L, (z[1] - a[1]) / L], nL = [-u[1], u[0]], far = span / 2;
    const poly = [[a[0] - u[0] * far, a[1] - u[1] * far], ...P, [z[0] + u[0] * far, z[1] + u[1] * far], [z[0] + u[0] * far + nL[0] * far, z[1] + u[1] * far + nL[1] * far], [a[0] - u[0] * far + nL[0] * far, a[1] - u[1] * far + nL[1] * far]];
    GL.land = [poly];
    const sh = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], p[1]))), dep = -wl + 0.6;
    const g = new THREE.ExtrudeGeometry(sh, { depth: dep, bevelEnabled: false });
    const m = new THREE.Mesh(g, [new THREE.MeshStandardMaterial({ map: texFor("yard", 10), roughness: 0.92, envMapIntensity: 0.4 }), new THREE.MeshStandardMaterial({ color: 0x8f8d86, roughness: 0.9 })]);
    m.position.z = wl - 0.6 - 0.005; m.receiveShadow = true; GL.root.add(m);
  }
  glUnderlay();
}
// a polygon clipped to a rectangle (Sutherland–Hodgman; the rectangle is convex, so any land outline works)
function clipRect(P, x0, y0, x1, y1) {
  const edge = (P, inside, cut) => { const out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], ia = inside(a), ib = inside(b); if (ia) out.push(a); if (ia !== ib) out.push(cut(a, b)); } return out; };
  const lx = (a, b, x) => [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])], ly = (a, b, y) => [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y];
  P = edge(P, p => p[0] >= x0, (a, b) => lx(a, b, x0)); if (P.length) P = edge(P, p => p[0] <= x1, (a, b) => lx(a, b, x1));
  if (P.length) P = edge(P, p => p[1] >= y0, (a, b) => ly(a, b, y0)); if (P.length) P = edge(P, p => p[1] <= y1, (a, b) => ly(a, b, y1));
  return P;
}
function glUnderlay() {
  const add = (key, url, x0, y0, x1, y1, op, land) => {
    const put = tx => {
      const mat = new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      // on a marine site the site picture lies on the land only, so the water shows as water
      if (land && land.length) { for (const P0 of land) { const P = clipRect(P0, x0, y0, x1, y1); if (P.length < 3) continue;
          const g = new THREE.ShapeGeometry(new THREE.Shape(P.map(p => new THREE.Vector2(p[0], p[1])))), pos = g.attributes.position, uv = g.attributes.uv;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - x0) / (x1 - x0), (pos.getY(i) - y0) / (y1 - y0));
          const m = new THREE.Mesh(g, mat); m.position.z = 0.04; m.renderOrder = 1; GL.root.add(m); } return; }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), mat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0.04); m.renderOrder = 1; GL.root.add(m); };
    const c = GL.tex[key]; if (c && c !== "loading") return put(c); if (c === "loading") return;
    GL.tex[key] = "loading"; const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => { const t = new THREE.Texture(im); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.needsUpdate = true; GL.tex[key] = t; GL.sig = ""; if (V3.mode === "3d") render3D(); };
    im.onerror = () => { GL.tex[key] = null; }; im.src = url;
  };
  const bg = plan.site.bg;
  if (bg && bg.show !== false && (bg.url || bg.asset)) { const W = bg.w * bg.mpp, H = bg.h * bg.mpp; add("bg:" + (bg.url || bg.asset).slice(-40) + bg.w, bg.url || ("/_blob/" + bg.asset), bg.x, bg.y - H, bg.x + W, bg.y, bg.opacity ?? 0.85, GL.land); }
  const c = plan.site.cad, D = c && CADS[c.id];
  if (D && c.show !== false && D.paths?.length) {
    if (cadPathCache.id !== c.id || cadPathCache.v !== (c.v || 0)) cadMarkup();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of D.paths) for (let i = 0; i < q.p.length; i += 2) { x0 = Math.min(x0, q.p[i]); x1 = Math.max(x1, q.p[i]); y0 = Math.min(y0, q.p[i + 1]); y1 = Math.max(y1, q.p[i + 1]); }
    const w = x1 - x0, h = y1 - y0; if (!(w > 0 && h > 0)) return;
    const px = 4096 / Math.max(w, h), sw = Math.max(0.05, 1.6 / px);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * px)}" height="${Math.round(h * px)}" viewBox="${x0} ${-y1} ${w} ${h}">${D.fill ? `<path d="${cadPathCache.d}" fill="${c.col || "#4b5560"}" fill-rule="evenodd"/>` : `<path d="${cadPathCache.d}" fill="none" stroke="${c.col || "#4b5560"}" stroke-width="${sw}" stroke-linejoin="round"/>`}</svg>`;
    add(`cad:${c.id}:${c.v || 0}`, "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), x0, y0, x1, y1, Math.min(0.85, (c.op ?? 0.9)), (D.fill || D.traced) ? GL.land : null);
  }
}
// ---------- camera, sun, strands, labels – every frame ----------
function glCamera(W, H) {
  const F = GL.focus, B = viewBasis(); B.u = vcross(B.r, B.d);
  const c = [(F[0] + F[3]) / 2, (F[1] + F[4]) / 2, Math.max(1, (F[5] || 8) * 0.35)];
  const rad = Math.max(10, Math.hypot(F[3] - F[0], F[4] - F[1], (F[5] || 8)) / 2), asp = W / H;
  const half = Math.tan(GL.fov / 2 * D2R), fit = rad / Math.min(half, half * asp);
  const dist = fit / V3.zoom * 1.22;
  const tgt = vadd(c, vadd(vmul(B.r, V3.pan[0]), vmul(B.u, V3.pan[1])));
  const pos = vsub(tgt, vmul(B.d, dist));
  const cam = GL.cam; cam.aspect = asp; cam.near = Math.max(0.05, dist / 2000); cam.far = Math.max(20000, dist * 20); cam.position.set(...pos); cam.lookAt(...tgt); cam.updateProjectionMatrix();
  GL.dist = dist; GL.tgt = tgt; GL.scene.fog.near = dist * 1.6 + 250; GL.scene.fog.far = dist * 6 + 1800;
  const s = H / (2 * dist * half);
  V3.last = { W, H, s, cx: 0, cy: 0 };
  // sun from the south-west, high – shadow box follows what you look at
  const sd = vnorm([-0.45, -0.6, 0.75]), hs = Math.max(25, Math.min(400, dist * 0.75));
  GL.sun.position.set(tgt[0] + sd[0] * 800, tgt[1] + sd[1] * 800, tgt[2] + sd[2] * 800); GL.sun.target.position.set(...tgt);
  const sc = GL.sun.shadow.camera; sc.left = -hs; sc.right = hs; sc.top = hs; sc.bottom = -hs; sc.near = 100; sc.far = 1800; sc.updateProjectionMatrix();
  // strands: true thickness, but never thinner than ~1.4 px on screen
  if (GL.inst) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), camP = cam.position;
    GL.lines.forEach((l, i) => {
      const a = new THREE.Vector3(...l.a), b = new THREE.Vector3(...l.b), mid = a.clone().add(b).multiplyScalar(0.5), d = b.clone().sub(a), L = d.length();
      const px = 2 * mid.distanceTo(camP) * half / H, r = Math.max((+l.w || 1) * 0.011, px * 0.7 * Math.max(1, (+l.w || 1) * 0.75));
      q.setFromUnitVectors(Y, d.normalize()); m.compose(mid, q, new THREE.Vector3(r, L, r)); GL.inst.setMatrixAt(i, m);
    });
    GL.inst.instanceMatrix.needsUpdate = true;
  }
}
function glLabels(host, W, H) {
  let lay = host.querySelector(".gllab"); if (!lay) { lay = document.createElement("div"); lay.className = "gllab"; host.append(lay); }
  const v = new THREE.Vector3();
  lay.innerHTML = GL.labels.map(l => { v.set(...l.p).project(GL.cam); if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return ""; return `<span style="left:${((v.x + 1) / 2 * W).toFixed(1)}px;top:${((1 - v.y) / 2 * H).toFixed(1)}px;color:${escH(l.color || "#16202a")};font-size:${l.size || 12}px;font-weight:${l.bold ? 700 : 400}">${escH(l.text)}</span>`; }).join("")
    + `<b class="gltitle">3D VIEW · ${plan.phase === "set" ? "SET" : plan.phase === "both" ? "PICK & SET" : "PICK"}</b>`;
}
function glSig() {
  const strip = (k, v) => (k === "url" || k === "_geom" || k === "src" && typeof v === "string" && v.length > 200) ? undefined : v;
  return JSON.stringify([plan.phase, allMode, plan.al, plan.cranes, plan.loads, plan.obstacles, plan.site.bg && [plan.site.bg.x, plan.site.bg.y, plan.site.bg.show, plan.site.bg.opacity, plan.site.bg.mpp], plan.site.cad && [plan.site.cad.id, plan.site.cad.v, plan.site.cad.show]], strip);
}
function glRender(host, W, H, M) {
  if (!GL.R) glInit();
  const R = GL.R;
  if (R.domElement.parentNode !== host) { host.innerHTML = ""; host.append(R.domElement); }
  const pr = R.getPixelRatio(); if (R.domElement.width !== Math.round(W * pr) || R.domElement.height !== Math.round(H * pr)) R.setSize(W, H);
  const sig = M ? "" : glSig();
  if (M || sig !== GL.sig) { glBuild(M || (allMode ? withAll(() => buildMesh(plan.phase)) : buildMesh(plan.phase))); if (allMode) GL.focus = GL.bounds.slice(); GL.sig = M ? "" : sig; }
  glCamera(W, H);
  R.render(GL.scene, GL.cam);
  glLabels(host, W, H);
}
// the 3D view uses the realistic renderer; side views (and machines without WebGL) keep the drawing
{ const _r3 = render3D; render3D = function (...a) {
    if (V3.mode !== "3d" || !glAvailable() || V3.flat) { if (GL.R && GL.R.domElement.parentNode) GL.R.domElement.remove(); $("view3d").querySelector(".gllab")?.remove(); return _r3.apply(this, a); }
    const host = $("view3d"), r = host.getBoundingClientRect();
    try { glRender(host, Math.max(300, Math.round(r.width)), Math.max(300, Math.round(r.height))); }
    catch (e) { console.warn("3D renderer failed – using the drawing", e); GL.ok = false; return _r3.apply(this, a); }
  }; }
// a picture of the realistic 3D view (for exports): rendered at the size asked, then the screen view is put back
function gl3DPng(W, H) {
  if (!glAvailable()) return null;
  if (!GL.R) glInit();
  const R = GL.R, keepPR = R.getPixelRatio(), host = R.domElement.parentNode, r = host?.getBoundingClientRect();
  R.setPixelRatio(1); R.setSize(W, H);
  const keepLast = V3.last; GL.sig = ""; glBuild(allMode ? withAll(() => buildMesh(plan.phase)) : buildMesh(plan.phase)); if (allMode) GL.focus = GL.bounds.slice();
  glCamera(W, H); R.render(GL.scene, GL.cam);
  const url = R.domElement.toDataURL("image/png");
  // labels for the picture
  const v = new THREE.Vector3(), labs = GL.labels.map(l => { v.set(...l.p).project(GL.cam); if (v.z > 1) return ""; return `<text x="${((v.x + 1) / 2 * W).toFixed(1)}" y="${((1 - v.y) / 2 * H).toFixed(1)}" font-size="${(l.size || 12) * 1.6}" font-weight="${l.bold ? 700 : 400}" text-anchor="middle" fill="${l.color || "#16202a"}" paint-order="stroke" stroke="#fff" stroke-width="4">${escH(l.text)}</text>`; }).join("");
  R.setPixelRatio(keepPR); V3.last = keepLast; GL.sig = "";
  if (host && r) { R.setSize(Math.max(300, Math.round(r.width)), Math.max(300, Math.round(r.height))); if (V3.mode === "3d") render3D(); }
  return { url, labs };
}
{ const _rm = renderMeshSVG; renderMeshSVG = function (M, W, H, opts = {}) {
    if (V3.mode === "3d" && opts.noTrack && glAvailable() && !V3.flat) {
      try { const p = gl3DPng(Math.round(W), Math.round(H)); if (p) return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="IBM Plex Sans, Arial, sans-serif"><image href="${p.url}" x="0" y="0" width="${W}" height="${H}"/>${p.labs}<text x="${W - 20}" y="34" font-size="22" font-weight="700" text-anchor="end" fill="#16202a" paint-order="stroke" stroke="#fff" stroke-width="4">3D VIEW · ${plan.phase === "set" ? "SET" : "PICK"}</text></svg>`; } catch (e) { console.warn(e); }
    }
    return _rm.call(this, M, W, H, opts);
  }; }
