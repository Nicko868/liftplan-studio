// ================= Trace a site picture into clean lines =================
// A site layout that came in as a picture (scan, screenshot, PDF figure) is turned into CAD linework: the ink is
// found, thinned to its centre line, followed into polylines, cleaned (specks, spurs, tiny gaps) and simplified.
// The lines then become drawing objects (select / hide / delete / make a site object) and the picture is switched off
// – the lines stand in for it. Accuracy follows the picture: a coarse picture gives approximate lines.
async function ptLoadImage(bg) {
  const src = bg.url && !/^\/_blob\//.test(bg.url) ? bg.url : bg.asset ? "/_blob/" + bg.asset : bg.url;
  return await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
const ptTick = () => new Promise(r => setTimeout(r, 0));
async function ptTrace(img, opt = {}) {
  const K = opt.K || Math.max(1, Math.min(2, 5200 / Math.max(img.naturalWidth, img.naturalHeight)));
  const W = Math.round(img.naturalWidth * K), H = Math.round(img.naturalHeight * K);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.fillStyle = "#fff"; cx.fillRect(0, 0, W, H); cx.imageSmoothingQuality = "high"; cx.drawImage(img, 0, 0, W, H);
  const px = cx.getImageData(0, 0, W, H).data, N = W * H, gray = new Uint8Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) gray[i] = (px[j] * 299 + px[j + 1] * 587 + px[j + 2] * 114) / 1000;
  // ink threshold (Otsu), never lighter than a mid grey so a pale background stays out
  const hist = new Float64Array(256); for (let i = 0; i < N; i++) hist[gray[i]]++;
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t]; let sB = 0, wB = 0, best = 0, T = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = N - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; T = t; } }
  T = Math.min(T, opt.T || 190);
  let ink = new Uint8Array(N); for (let i = 0; i < N; i++) ink[i] = gray[i] < T ? 1 : 0;
  await ptTick();
  // close pin-holes (3×3 dilate then erode)
  const morph = (a, dil) => { const b = new Uint8Array(N); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; let v = dil ? 0 : 1;
      for (let dy = -1; dy <= 1 && (dil ? !v : v); dy++) for (let dx = -1; dx <= 1; dx++) { const q = a[i + dy * W + dx]; if (dil && q) { v = 1; break; } if (!dil && !q) { v = 0; break; } } b[i] = v; } return b; };
  ink = morph(morph(morph(morph(ink, true), true), false), false); await ptTick();   // 5×5 close: pin-holes and hairline breaks
  // specks off: connected pieces smaller than a few pixels
  { const lab = new Int32Array(N), st = []; let n = 0; const MIN = opt.minc || Math.round(5 * K);
    for (let i = 0; i < N; i++) { if (!ink[i] || lab[i]) continue; n++; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; const stack = [i]; lab[i] = n; const mem = [];
      while (stack.length) { const p = stack.pop(); mem.push(p); const y = (p / W) | 0, x = p - y * W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= H || xx >= W) continue; const q = yy * W + xx; if (ink[q] && !lab[q]) { lab[q] = n; stack.push(q); } } }
      if (Math.max(x1 - x0, y1 - y0) < MIN) for (const p of mem) ink[p] = 0; } }
  await ptTick();
  // thin to the centre line (Zhang–Suen)
  { let list = []; for (let i = 0; i < N; i++) if (ink[i]) { const y = (i / W) | 0, x = i - y * W; if (x > 0 && y > 0 && x < W - 1 && y < H - 1) list.push(i); else ink[i] = 0; }
    let changed = true, it = 0;
    while (changed && it++ < 60) { changed = false;
      for (const pass of [0, 1]) { const del = [];
        for (const i of list) { if (!ink[i]) continue;
          const p2 = ink[i - W], p3 = ink[i - W + 1], p4 = ink[i + 1], p5 = ink[i + W + 1], p6 = ink[i + W], p7 = ink[i + W - 1], p8 = ink[i - 1], p9 = ink[i - W - 1];
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
          const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2); if (A !== 1) continue;
          if (pass === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue; del.push(i); }
        if (del.length) { changed = true; for (const i of del) ink[i] = 0; } }
      list = list.filter(i => ink[i]); if (it % 4 === 0) await ptTick(); } }
  // follow the centre lines into polylines
  const NB = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1], deg = new Uint8Array(N), skel = [];
  for (let i = 0; i < N; i++) if (ink[i]) { skel.push(i); let d = 0; for (const o of NB) if (ink[i + o]) d++; deg[i] = d; }
  const seen = new Set(), ek = (a, b) => a < b ? a * N + b : b * N + a, paths = [];
  const walk = (s, q) => { const L = [s, q]; seen.add(ek(s, q)); let prev = s, cur = q;
    while (deg[cur] === 2) { let nx = -1; for (const o of NB) { const r = cur + o; if (ink[r] && r !== prev && !seen.has(ek(cur, r))) { nx = r; break; } } if (nx < 0) break; seen.add(ek(cur, nx)); L.push(nx); prev = cur; cur = nx; }
    return L; };
  for (const s of skel) if (deg[s] !== 2) for (const o of NB) { const q = s + o; if (ink[q] && !seen.has(ek(s, q))) paths.push(walk(s, q)); }
  for (const s of skel) for (const o of NB) { const q = s + o; if (ink[q] && !seen.has(ek(s, q))) paths.push(walk(s, q)); }   // closed loops
  await ptTick();
  // spurs (short twigs off a junction) out, then simplify (Ramer–Douglas–Peucker) and map to the site
  const SPUR = opt.spur || 4 * K, toXY = i => { const y = (i / W) | 0; return [i - y * W, y]; }, plen = L => { let s = 0; for (let k = 1; k < L.length; k++) { const a = toXY(L[k - 1]), b = toXY(L[k]); s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; };
  const rdp = (P, e) => { if (P.length < 3) return P; let dm = 0, im = 0; const a = P[0], b = P[P.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
    for (let k = 1; k < P.length - 1; k++) { const d = Math.abs((b[0] - a[0]) * (a[1] - P[k][1]) - (a[0] - P[k][0]) * (b[1] - a[1])) / L; if (d > dm) { dm = d; im = k; } }
    return dm > e ? rdp(P.slice(0, im + 1), e).slice(0, -1).concat(rdp(P.slice(im), e)) : [a, b]; };
  const out = [];
  for (const L of paths) { const da = deg[L[0]], db = deg[L[L.length - 1]]; if (((da === 1 && db >= 3) || (db === 1 && da >= 3)) && plen(L) < SPUR) continue; if (plen(L) < 1.5 * K) continue;
    out.push(rdp(L.map(toXY), opt.eps || 0.7 * K)); }
  // bridge small breaks: two free ends close together and pointing at each other are joined into one line
  { const G = opt.gap || 5 * K, cell = G, grid = new Map(), keyOf = (x, y) => Math.floor(x / cell) + "," + Math.floor(y / cell);
    const L = out.map(P => ({ P, dead: false })), endInfo = (l, e) => { const P = l.P, a = e ? P[P.length - 1] : P[0], b = e ? P[Math.max(0, P.length - 2)] : P[Math.min(P.length - 1, 1)], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; return { p: a, dir: [(a[0] - b[0]) / d, (a[1] - b[1]) / d] }; };
    L.forEach((l, i) => [0, 1].forEach(e => { const { p } = endInfo(l, e), k = keyOf(p[0], p[1]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([i, e]); }));
    for (let i = 0; i < L.length; i++) for (const e of [1, 0]) { const l = L[i]; if (l.dead) continue; const A = endInfo(l, e); let best = null;
      const gx = Math.floor(A.p[0] / cell), gy = Math.floor(A.p[1] / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const [j, f] of grid.get((gx + dx) + "," + (gy + dy)) || []) { if (j === i || L[j].dead) continue; const B = endInfo(L[j], f), v = [B.p[0] - A.p[0], B.p[1] - A.p[1]], d = Math.hypot(v[0], v[1]); if (d > G || d < 1e-6) continue;
          const c1 = (A.dir[0] * v[0] + A.dir[1] * v[1]) / d, c2 = -(B.dir[0] * v[0] + B.dir[1] * v[1]) / d; if (c1 < 0.85 || c2 < 0.85) continue; if (!best || d < best.d) best = { j, f, d }; }
      if (!best) continue; const o2 = L[best.j]; const Pa = e ? l.P : [...l.P].reverse(), Pb = best.f ? [...o2.P].reverse() : o2.P; l.P = Pa.concat(Pb); o2.dead = true;
      // the joined line's far end keeps its grid entry; refresh this line's ends
      const { p } = endInfo(l, 1), k = keyOf(p[0], p[1]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([i, 1]); }
    return { lines: L.filter(l => !l.dead).map(l => rdp(l.P, opt.eps || 0.7 * K)), K, W, H }; }
}
// the picture → a traced drawing on the plan (replaces earlier traced lines of the same picture)
async function traceSitePicture() {
  const bg = plan.site.bg; if (!bg) { toast("There's no site picture to trace"); return; }
  if (!(+bg.mpp > 0)) { toast("Set the picture's scale first (Set scale) – the lines need it to be in metres"); return; }
  const btn = $("ptGo"); if (btn) { btn.disabled = true; btn.textContent = "Tracing… (a few seconds)"; }
  try {
    const img = await ptLoadImage(bg), t0 = performance.now(), r = await ptTrace(img);
    const s = (+bg.mpp) * ((+bg.w || img.naturalWidth) / img.naturalWidth) / r.K, X = px => Math.round((+bg.x + (px + 0.5) * s) * 100) / 100, Y = py => Math.round((+bg.y - (py + 0.5) * s) * 100) / 100;
    const paths = r.lines.map(P => { const p = []; for (const q of P) p.push(X(q[0]), Y(q[1])); return { p }; });
    if (!paths.length) { toast("No lines found in the picture"); return; }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of paths) for (let i = 0; i < q.p.length; i += 2) { x0 = Math.min(x0, q.p[i]); x1 = Math.max(x1, q.p[i]); y0 = Math.min(y0, q.p[i + 1]); y1 = Math.max(y1, q.p[i + 1]); }
    const id = "cad_" + uid(), data = { paths, texts: [], bbox: [x0, y0, x1, y1], traced: true, from: "picture" };
    CADS[id] = data; plan.site.cad = { id, name: "Traced from the site picture", show: true, op: 0.9, col: "#3f4954", n: paths.length, v: 0 };
    await saveCad(id, data);
    bg.show = false; markDirty(); renderMeta(); renderAll();
    toast(`Picture traced into ${paths.length.toLocaleString()} lines in ${((performance.now() - t0) / 1000).toFixed(1)} s – the picture is off (Layout tools → Picture to see it again)`);
  } catch (e) { console.warn(e); toast("Couldn't trace the picture (" + (e.message || e) + ")"); }
  finally { if (btn) { btn.disabled = false; btn.textContent = "✎ Trace the picture into lines"; } }
}
// traced lines stand in for the picture they came from: while they show, the picture stays off unless asked for
{ const _bm = bgMarkup; bgMarkup = function (...a) { const c = plan.site.cad, D = c && typeof CADS !== "undefined" && CADS[c.id]; if (D && D.traced && c.show !== false && plan.site.bg && !plan.site.bg.alsoShow) return ""; return _bm.apply(this, a); }; }
// buttons in the layout tools: trace the picture / show the picture under the lines
{ const _rl = renderLayoutTools; renderLayoutTools = function (...a) { const r = _rl.apply(this, a);
    try { const box = $("ltBoxUI"); if (!box || box.hidden) return r; const bg = plan.site.bg, c = plan.site.cad, D = c && CADS[c.id];
      if (bg && !box.querySelector("#ptGo")) { const row = document.createElement("div"); row.className = "ltrow";
        row.innerHTML = `<button id="ptGo" hidden></button>${D && D.traced ? `<button id="ptPic" aria-pressed="${!!bg.alsoShow}" title="Show the original picture under the traced lines">Picture</button>` : ""}`;
        box.appendChild(row); $("ptGo").onclick = traceSitePicture;
        if ($("ptPic")) $("ptPic").onclick = () => { bg.alsoShow = !bg.alsoShow; if (bg.alsoShow) bg.show = true; markDirty(); renderSite(); renderLayoutTools(); }; } } catch (e) { console.warn(e); }
    return r; }; }
