// Golden-output check: records everything the app works out and draws for a set of lifts, so a clean-up of the code can be
// proved to change nothing. `node tests/golden.js <app.html> <outdir>` writes <outdir>/golden.json and one PNG per sheet;
// `node tests/golden.js <app.html> <outdir> <beforedir>` also compares with an earlier run and lists every difference.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [FILE, OUT, BEFORE] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
const CASES = [
  ['spud', 0, null], ['spud_swung_ccw', 0, { set: { h: 0, x: -3, y: -24.85, rot: 90 }, dir: 'ccw' }], ['spud_turned', 0, { set: 'rot+90' }],
  ['column', 1, null], ['column_swung', 1, { swing: -150, rot: -89 }], ['transformer', 2, null], ['forklift', 3, null], ['forklift_hook', 3, { hook: true }]];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + FILE + '?local'); await p.waitForTimeout(1500);
  const all = {};
  for (const [name, si, mod] of CASES) {
    const r = await p.evaluate(async ([si, mod]) => {
      if ($('dStart').open) $('dStart').close(); openPlan(clone(SAMPLE_PLANS[si].plan)); const ld = plan.loads[0];
      if (mod && mod.set === 'rot+90') ld.set = { ...ld.pick, rot: (+ld.pick.rot || 0) + 90 };
      else if (mod && mod.set) ld.set = { ...mod.set };
      if (mod && mod.swing != null) { const c = plan.cranes.find(c => c.attach?.point !== 'B'), a = mod.swing * D2R, dx = ld.pick.x - c.x, dy = ld.pick.y - c.y; ld.set = { ...ld.pick, x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a), rot: (+ld.pick.rot || 0) + mod.rot }; }
      if (mod && mod.dir) ld.travelDir = mod.dir;
      if (mod && mod.hook) { const o = plan.obstacles.find(o => o.fl); o.fl.how = 'hook'; o.fl.c = 0.9; o.fl.attW = 0.4; }
      renderAll(); const R = v => v == null ? null : Math.round(v * 100) / 100, out = {};
      const L = liftSteps(ld); out.steps = L ? L.steps.map(s => ({ n: s.name, t: R(s.tilt), h: R(s.h), pose: [R(s.pose.x), R(s.pose.y), R(s.pose.rot)], ok: s.ok, clear: R(s.clear),
        per: s.per.map(q => q.fork ? { f: 1, rel: q.rel, ctr: q.ctr && q.ctr.map(R), fh: R(q.forkH), used: R(q.used), cap: R(q.cap), util: R(q.util), ax: q.axles && q.axles.map(R) } : { rel: q.rel, R: R(q.R), brg: R(q.brg), z: R(q.z), used: R(q.used), cap: R(q.cap), util: R(q.util), ok: q.ok }) })) : null;
      out.moves = L ? L.steps.map((s, i) => lsMoves(L.steps[i - 1] || null, s).map(m => m.txt)) : null;
      out.cranes = plan.cranes.map(c => { const S = craneSummary(c), e0 = evalCrane(c, 'pick'), e1 = evalCrane(c, 'set');
        return { st: S.status, util: R(S.util), maxR: R(S.maxR), cap: R(S.cap), gbp: R(S.gbp), warn: S.warn, seq: S.seq && S.seq.rows.map(r => [r.name, R(r.R), R(r.cap)]), pick: [R(e0.R), R(e0.bearing), R(e0.share), e0.free || false], set: [R(e1.R), R(e1.bearing), R(e1.share), e1.free || false, !!e1.released] }; });
      // the 3D model at pick and at set, and while Play lift plays each step (¼ ½ ¾ between steps): a fingerprint of every face / line / label
      const fp = M => { let h = 0; const add = v => { const t = typeof v === 'number' ? String(Math.round(v * 100)) : String(v); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; };
        for (const f of M.faces) { add(f.color || f.c); for (const q of f.pts) q.forEach(add); } for (const l of M.lines) { add(l.color || l.c); l.a.forEach(add); l.b.forEach(add); } for (const l of M.labels) { add(l.text || l.s); (l.p || []).forEach(add); }
        return [M.faces.length, M.lines.length, M.labels.length, h]; };
      out.mesh = { pick: fp(buildMesh('pick')), set: fp(buildMesh('set')) };
      if (L && typeof LP !== 'undefined') { const on = LP.on, cur = LP.seqCur; out.play = [];
        try { LP.on = true; for (let i = 1; i < L.steps.length; i++) for (const u of [0.25, 0.5, 0.75]) { LP.seqCur = { L, s: lsLerpStep(L.steps[i - 1], L.steps[i], u) }; out.play.push(fp(buildMesh('pick'))); } }
        finally { LP.on = on; LP.seqCur = cur; } out.after = fp(buildMesh('pick')); }
      const sh = await buildSheets(); out.sheets = [];
      for (const s of sh) { const txt = [...s.svg.matchAll(/>([^<>]+)</g)].map(m => m[1].trim()).filter(t => t && !/\d{4}-\d\d-\d\d \d\d:\d\d UTC|^\d\d\/\d\d\/\d{4}$/.test(t));
        const c = await sheetCanvas(s.svg); out.sheets.push({ name: s.name, text: txt, png: c.toDataURL('image/png') }); }
      return out; }, [si, mod]);
    for (const s of r.sheets) { fs.writeFileSync(path.join(OUT, `${name}__${s.name}.png`), Buffer.from(s.png.split(',')[1], 'base64')); delete s.png; }
    all[name] = r; process.stdout.write(`${name}: ${r.steps ? r.steps.length : 0} steps, ${r.sheets.length} sheets\n`);
  }
  all._errors = errs; fs.writeFileSync(path.join(OUT, 'golden.json'), JSON.stringify(all, null, 1)); await b.close();
  if (!BEFORE) return;
  // ---- compare with an earlier run: numbers / texts exactly, pictures by the share of pixels that changed ----
  const A = JSON.parse(fs.readFileSync(path.join(BEFORE, 'golden.json'))), diffs = [];
  const walk = (a, b, k) => { if (JSON.stringify(a) === JSON.stringify(b)) return; if (a && b && typeof a === 'object' && typeof b === 'object') { for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], k + '.' + key); return; } diffs.push(`${k}: ${JSON.stringify(a)?.slice(0, 140)} → ${JSON.stringify(b)?.slice(0, 140)}`); };
  walk(A, all, '');
  const { PNG } = (() => { try { return require('pngjs'); } catch (e) { return {}; } })();
  let px = [];
  if (PNG) for (const f of fs.readdirSync(BEFORE).filter(f => f.endsWith('.png'))) { const g = path.join(OUT, f); if (!fs.existsSync(g)) { px.push(`${f}: missing`); continue; }
    const x = PNG.sync.read(fs.readFileSync(path.join(BEFORE, f))), y = PNG.sync.read(fs.readFileSync(g)); if (x.width !== y.width || x.height !== y.height) { px.push(`${f}: size changed`); continue; }
    let n = 0; for (let i = 0; i < x.data.length; i += 4) if (Math.abs(x.data[i] - y.data[i]) + Math.abs(x.data[i + 1] - y.data[i + 1]) + Math.abs(x.data[i + 2] - y.data[i + 2]) > 24) n++;
    const share = n / (x.width * x.height) * 100; if (share > 0.02) px.push(`${f}: ${share.toFixed(2)}% of pixels changed`); }
  console.log(`\nDIFFERENCES – numbers / texts: ${diffs.length}, pictures: ${px.length}`); diffs.slice(0, 60).forEach(d => console.log('  ' + d)); px.slice(0, 40).forEach(d => console.log('  ' + d));
})();
