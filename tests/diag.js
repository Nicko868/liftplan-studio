// LiftPlan Studio – weekly diagnostic.  Usage: node tests/diag.js <path to LiftPlan_Studio.html> <output folder>
// Needs Playwright (npm i playwright) with Chromium. Writes screenshots of every main screen + report.json, prints PASS/FAIL lines.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || 'out/LiftPlan_Studio.html'), OUT = path.resolve(process.argv[3] || 'diag_out');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  – ' + info : ''}`); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });   // WebGL for the realistic 3D view
  const fresh = async (vw = 1440, vh = 900) => { const p = await b.newPage({ viewport: { width: vw, height: vh } }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|fonts|Failed to load resource/.test(m.text())) p._errs.push(m.text().slice(0, 200)); }); await p.goto('file://' + FILE + '?local'); await p.waitForTimeout(900); return p; };
  // create a plan through the home-page form (title block is required)
  const newPlan = async (p, name = 'Diagnostic plan') => { await p.fill('#stName', name); await p.fill('#stProj', 'Diag berth'); await p.fill('#stLift', 'LP-DIAG-001'); await p.fill('#stBy', 'Diagnostic'); await p.click('#stNew'); await p.waitForTimeout(300); };
  const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png') });
  try {
    // ---------- 1. screen sweep ----------
    let p = await fresh(); await shot(p, '01_home');
    // new-plan control: can't create, Esc out or go "back" until the title block is filled in
    await p.click('#stNew', { force: true }); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    let g = await p.evaluate(() => [$('dStart').open, document.querySelectorAll('#dStart input.miss').length, $('stClose').hidden]);
    await p.fill('#stName', 'Only a title'); await p.click('#stNew', { force: true }); await p.waitForTimeout(200);
    g.push(await p.evaluate(() => $('dStart').open)); await shot(p, '01b_new_plan_check');
    check('A new plan needs its title, project, plan no., author and date', g[0] && g[1] >= 4 && g[2] && g[3], JSON.stringify(g));
    await newPlan(p); await shot(p, '02_empty');
    g = await p.evaluate(() => [plan.name, plan.meta.project, plan.meta.lift, plan.meta.by, !!plan.meta.date, $('dStart').open]);
    check('The form fills the plan title block', g[0] === 'Diagnostic plan' && g[1] === 'Diag berth' && g[2] === 'LP-DIAG-001' && g[3] === 'Diagnostic' && g[4] && !g[5], JSON.stringify(g));
    await p.evaluate(() => { const x = LOAD_LIBRARY.find(l => l.kind === 'reel') || LOAD_LIBRARY[0]; const ld = libToLoad(x); ld.id = uid(); ld.weight = 40; ld.pick = { x: 0, y: 0, h: 0, rot: 0 }; ld.set = { x: -10, y: 12, h: 0, rot: 30 }; plan.loads.push(ld);
      addCraneOf(Object.keys(REG.cranes).find(k => REG.cranes[k].type === 'at')); const c = plan.cranes[0]; c.attach = { load: ld.id, point: 'C' };
      plan.obstacles.push({ id: uid(), type: 'person', kind: 'circle', x: 4, y: -6, r: 0.5, hgt: 1.8, label: 'Banksman' }); renderAll(); fitView(); });
    await p.waitForTimeout(300); await shot(p, '03_plan');
    await p.click('text=Both'); await p.waitForTimeout(300); await shot(p, '04_both');
    for (const [v, n] of [['Side', '05_side'], ['3D', '06_3d'], ['Top', null]]) { await p.getByRole('button', { name: v, exact: true }).first().click(); await p.waitForTimeout(500); if (n) await shot(p, n); }
    await p.getByRole('button', { name: '3D', exact: true }).first().click(); await p.waitForTimeout(1500);
    g = await p.evaluate(() => { const c = document.querySelector('#view3d canvas.gl3d'); if (!c) return [glAvailable(), false]; GL.R.render(GL.scene, GL.cam); const u = c.toDataURL('image/png'), pic = gl3DPng(800, 500);
      return [glAvailable(), true, u.length, GL.lines.length, GL.root.children.length, pic ? pic.url.length : 0, document.querySelectorAll('#view3d .gllab span').length]; });
    check('Realistic 3D: WebGL scene with sky, ground, shadows, ropes and labels; a picture of it for exports', g[0] && g[1] && g[2] > 30000 && g[3] >= 4 && g[4] >= 4 && g[5] > 100000 && g[6] >= 2, JSON.stringify(g));
    await shot(p, '06b_3d_realistic');
    await p.getByRole('button', { name: 'Side', exact: true }).first().click(); await p.waitForTimeout(400);
    g = await p.evaluate(() => [!!document.querySelector('#view3d svg'), !document.querySelector('#view3d canvas.gl3d')]);
    check('Side elevation stays an engineering drawing (not the 3D renderer)', g[0] && g[1], JSON.stringify(g));
    await p.getByRole('button', { name: 'Top', exact: true }).first().click(); await p.waitForTimeout(300);
    await p.evaluate(() => openRigBuilder(plan.loads[0])); await p.waitForTimeout(400); await shot(p, '07_rigging'); await p.evaluate(() => $('dRig').close());
    await p.click('#bCranes'); await p.waitForTimeout(300); await shot(p, '08_crane_library'); await p.evaluate(() => $('dCranes').close());
    const svg = await p.evaluate(() => sheetSVG());
    await p.evaluate(s => { const d = document.createElement('div'); d.id = 'shv'; d.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:99999'; d.innerHTML = s.replace('<svg ', '<svg style="width:1440px;height:1018px" '); document.body.append(d); }, svg);
    await p.waitForTimeout(400); await shot(p, '09_sheet'); await p.evaluate(() => $('shv').remove());
    await p.setViewportSize({ width: 1100, height: 760 }); await p.waitForTimeout(300); await shot(p, '10_small_screen');
    check('No script errors while using the main screens', !p._errs.length, p._errs.slice(0, 3).join(' | '));
    await p.close();

    // ---------- 1b. new items land on a free spot, not on top of each other ----------
    p = await fresh(); await newPlan(p, 'Placement');
    await p.evaluate(() => addCraneOf(Object.keys(REG.cranes).find(k => REG.cranes[k].type === 'at'))); await p.waitForTimeout(200);
    await p.evaluate(() => { openLoadBuilder(null); const x = LOAD_LIBRARY.find(l => l.kind === 'reel'); LB.ld = normLoad({ ...clone(LB.ld), ...libToLoad(x), name: 'Reel' }); }); await p.click('#lbOk'); await p.waitForTimeout(500);
    await p.evaluate(() => { if ($('dRig').open) $('dRig').close(); placeObject('building'); addCraneOf(Object.keys(REG.cranes).find(k => REG.cranes[k].type === 'at')); }); await p.waitForTimeout(300);
    const rp = await p.evaluate(() => { const c = plan.cranes, l = plan.loads[0], o = plan.obstacles.find(x => x.type === 'building'), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      return [d([c[0].x, c[0].y], [l.pick.x, l.pick.y]), d([o.x, o.y], [l.pick.x, l.pick.y]), d([o.x, o.y], [c[0].x, c[0].y]), d([c[1].x, c[1].y], [c[0].x, c[0].y]), !(c[0].tip && c[0].tip.pick && c[0].tip.pick.free)].map(v => typeof v === 'number' ? +v.toFixed(1) : v); });
    check('New crane, load and building each land on a free spot (and the waiting crane hooks the new load)', rp[0] > 8 && rp[1] > 10 && rp[2] > 12 && rp[3] > 12 && rp[4], JSON.stringify(rp));
    await p.close();

    // ---------- 2. rigging: spreader padeyes × slings × bags ----------
    p = await fresh(); await newPlan(p);
    let r = await p.evaluate(() => { const x = LOAD_LIBRARY.find(l => l.kind === 'bag'); const ld = libToLoad(x); ld.id = uid(); ld.pick = { x: 0, y: 0, h: 0, rot: 0 }; ld.set = { x: 10, y: 0, h: 0, rot: 0 }; plan.loads.push(ld); applyPreset(ld, 'build_drops'); openRigBuilder(ld);
      const B = RB.work.rig.chain.find(e => e.snap.type === 'spreader'); B.cfg.padN = 8; B.cfg.perPad = 2; B.cfg.bagsPer = 1; renderRB(); return bagN(RB.work); });
    check('Spreader 8 padeyes × 2 slings × 1 bag = 16 bags', r === 16, 'got ' + r);
    // basket: each side checked on its own (capacity not doubled against a one-side load)
    r = await p.evaluate(() => { const x = LOAD_LIBRARY.find(l => /pipe/i.test(l.name)); const ld = libToLoad(x); ld.id = uid(); ld.weight = 20; ld.pick = { x: 0, y: 30, h: 0, rot: 0 }; ld.set = { x: 10, y: 30, h: 0, rot: 0 }; plan.loads.push(ld);
      const lib = rigLibrary(), f = re => lib.find(i => re.test(i.name)); const s = rigEntry(f(/Round sling 20 t/)); s.len = 8; s.legs = 2; s.hitch = 'basket';
      ld.rig = { arr: 'build', chain: [rigEntry(f(/Master link 25/) || f(/Master link/)), s] }; const res = solveRig(ld), row = res.rows.find(q => q.entry === s); return row ? [row.swl, +s.snap.swl, row.load] : null; });
    check('Basket hitch: each side rated at the straight SWL (not 2×)', r && Math.abs(r[0] - r[1]) < 0.01, JSON.stringify(r));
    // choke: 0.8 factor
    r = await p.evaluate(() => { const ld = plan.loads[1], s = ld.rig.chain[1]; s.hitch = 'choke'; const row = solveRig(ld).rows.find(q => q.entry === s); return row ? row.swl / +s.snap.swl : null; });
    check('Choke hitch rated at 0.8 × SWL', r && Math.abs(r - 0.8) < 0.001, String(r));
    check('No script errors in the rigging checks', !p._errs.length, p._errs.slice(0, 3).join(' | '));
    await p.close();

    // ---------- 2b. the simple rigging builder: arrangement → the app sizes the gear, Auto / Fixed, adapts to the load ----------
    p = await fresh(); await newPlan(p, 'Rigging builder');
    r = await p.evaluate(() => { const out = {}; const mk = (k, f) => { const ld = libToLoad(LOAD_LIBRARY.find(f)); ld.id = uid(); ld.pick = { x: 0, y: plan.loads.length * 15, h: 0, rot: 0 }; ld.set = { x: 6, y: plan.loads.length * 15, h: 0, rot: 0 }; plan.loads.push(ld); return ld; };
      const reel = mk('reel', l => l.kind === 'reel'); reel.weight = 80; reel.rig = null; ensureRig(reel); normLoad(reel);
      const rr = solveRig(reel), bm = reel.rig.chain.find(e => e._slot === 'bm');
      out.reel = [reel.rig.q.arr, Math.max(...rr.rows.map(x => x.util)), !rr.checks.some(c => c.lvl === 'bad'), bm && Math.abs(+bm.len - (+reel.span + 0.2)) < 0.01];
      const cc = mk('ccu', l => l.kind === 'ccu' || l.kind === 'container'); cc.rig = null; ensureRig(cc); normLoad(cc); const rc = solveRig(cc);
      out.ccu = [cc.rig.q.arr, /assembly/i.test(cc.rig.chain[0].snap.name), Math.max(...rc.rows.map(x => x.util)), !rc.checks.some(c => c.lvl === 'bad')];
      const bag = mk('bag', l => l.kind === 'bag'); bag.nx = 4; bag.ny = 2; normLoad(bag); bag.rig = null; ensureRig(bag); normLoad(bag);
      out.bag = [bag.rig.q.arr, bagN(bag), bag.nx, bag.ny, solveRig(bag).warn.length];
      return out; });
    check('Simple rigging: the app picks the arrangement and sizes every part at ≤ 90 % (reel → spreader set to the points, CCU → 4-leg on an assembly, 8 bags → spreader, bag count kept)',
      r.reel[0] === 'spread' && r.reel[1] <= 90 && r.reel[2] && r.reel[3] && r.ccu[0] === '4leg' && r.ccu[1] && r.ccu[2] <= 90 && r.ccu[3] && r.bag[0] === 'bagspread' && r.bag[1] === 8 && r.bag[2] === 4 && r.bag[3] === 2 && !r.bag[4], JSON.stringify(r));
    await p.evaluate(() => openRigBuilder(plan.loads[0])); await p.waitForTimeout(300); await shot(p, '07b_rigging_simple');
    await p.click('[data-qs="wire"]'); await p.waitForTimeout(200);
    const wOpt = await p.evaluate(() => [...document.querySelector('[data-qsel="st"]').options].map(o => o.value).find(v => /wr_64/.test(v)));
    await p.selectOption('[data-qsel="st"]', wOpt); await p.waitForTimeout(200); await p.click('#rbSave'); await p.waitForTimeout(300);
    r = await p.evaluate(() => { const ld = plan.loads[0], ml0 = ld.rig.chain[0].id; ld.weight = 30; normLoad(ld); return [ld.rig.q.fixed.st, ld.rig.chain.find(e => e._slot === 'st').id, ml0 !== ld.rig.chain[0].id, Math.max(...solveRig(ld).rows.filter(x => !ld.rig.q.fixed[x.entry._slot]).map(x => x.util))]; });
    check('Simple rigging: a part you choose stays Fixed when the load changes; the Auto parts re-size', r[0] === 'wr_64' && r[1] === 'wr_64' && r[2] && r[3] <= 90, JSON.stringify(r));
    await p.evaluate(() => openRigBuilder(plan.loads[0])); await p.waitForTimeout(200); await p.click('#qrDetail'); await p.waitForTimeout(200);
    await p.evaluate(() => { const el = document.querySelector('#rbLeft .crow input[data-cf="len"]'); el.value = '9.5'; el.onchange(); }); await p.waitForTimeout(200); await p.click('#rbSave'); await p.waitForTimeout(200);
    r = await p.evaluate(() => { const ld = plan.loads[0], ids = JSON.stringify(ld.rig.chain.map(e => e.id)); ld.weight = 60; normLoad(ld); return [!!ld.rig.q, ids === JSON.stringify(ld.rig.chain.map(e => e.id)), ld.rig.chain.some(e => +e.len === 9.5)]; });
    check('Simple rigging: a change in the detailed editor makes it your own rigging – kept exactly, never re-sized', !r[0] && r[1] && r[2], JSON.stringify(r));
    check('No script errors in the rigging builder', !p._errs.length, p._errs.slice(0, 3).join(' | '));
    await p.close();

    // ---------- 3. cranes, mats, capacity ----------
    p = await fresh(); await newPlan(p);
    r = await p.evaluate(() => { const x = LOAD_LIBRARY[0]; const ld = libToLoad(x); ld.id = uid(); ld.weight = 20; ld.pick = { x: 12, y: 0, h: 0, rot: 0 }; ld.set = { x: 12, y: 0.5, h: 0, rot: 0 }; plan.loads.push(ld);
      addCraneOf(Object.keys(REG.cranes).find(k => REG.cranes[k].type === 'at')); const c = plan.cranes[0]; c.attach = { load: ld.id, point: 'C' }; sel = { kind: 'crane', id: c.id }; renderAll(); renderProps(); return plan.obstacles.filter(isMat).length; });
    check('A mobile crane is placed on 4 mats', r === 4, 'mats ' + r);
    await p.fill('#pX', '20'); await p.press('#pX', 'Tab'); await p.waitForTimeout(200);
    r = await p.evaluate(() => { const c = plan.cranes[0]; return matsUnderCrane(c).length; });
    check('Mats move with the crane when its position is typed', r === 4, 'mats under crane ' + r);
    r = await p.evaluate(() => { const m = plan.obstacles.find(isMat); sel = { kind: 'obs', id: m.id }; renderProps(); return !!$('oW'); });
    if (r) { await p.fill('#oW', '3.2'); await p.press('#oW', 'Tab'); await p.waitForTimeout(200); }
    r = await p.evaluate(() => [...new Set(plan.obstacles.filter(isMat).map(m => Math.max(m.w, m.h)))]);
    check('Resizing one mat resizes all 4', r.length === 1 && r[0] === 3.2, JSON.stringify(r));
    r = await p.evaluate(() => { const c = plan.cranes[0], ld = plan.loads[0]; ld.pick.x = c.x - 10; ld.set.x = c.x - 10; ld.pick.y = c.y; ld.set.y = c.y + 0.5; renderAll(); const S0 = craneSummary(c); c.capManual = 150; c.capManualR = S0.maxR; c.capManualChart = c.chartId; const a = craneSummary(c).cap; ld.pick.x = c.x - 26; ld.set.x = c.x - 26; renderAll(); const S2 = craneSummary(c); return [a, S2.cap, c.capManual == null]; });
    check('A typed capacity resets when the radius moves to another chart row', r[0] === 150 && r[2], JSON.stringify(r));
    r = await p.evaluate(() => { const crk = Object.keys(REG.cranes).find(k => REG.cranes[k].type === 'cr'); addCraneOf(crk); const c = plan.cranes[plan.cranes.length - 1]; c.x = 200; c.y = 200; c.heading = 0; c.matThk = 0.15;
      layCrawlerMats(c, 6, 1.2, 'perp'); plan.site.gbc = 20; const S = craneSummary(c);
      const T = craneTracks(c, REG.cranes[crk]), n1 = matsUnderCrane(c).filter(m => T[0].pts.some(p => inPolyPt(p, obsPts(m)))).length, n2 = matsUnderCrane(c).filter(m => T[1].pts.some(p => inPolyPt(p, obsPts(m)))).length;
      const m0 = matsUnderCrane(c)[0]; plan.obstacles.push({ ...clone(m0), id: uid() }); const S2 = craneSummary(c); plan.site.gbc = '';
      return [+S.matA.toFixed(1), +(Math.min(Math.min(n1, n2) * 1.2, trackContact(c)) * 6).toFixed(1), +S2.matA.toFixed(1)]; });
    check('Crawler mats: GBP area = mats under one track, along its ground contact only, stacked mats count once', Math.abs(r[0] - r[1]) / r[1] < 0.03 && r[2] === r[0], JSON.stringify(r));
    r = await p.evaluate(() => { const sp = makeObject('tr_spmt', [0, 0]); sp.x = 300; sp.y = 300; plan.obstacles.push(sp); const lb = makeObject('tr_lowbed', [0, 0]); lb.x = 330; lb.y = 300; plan.obstacles.push(lb);
      const ld = libToLoad(LOAD_LIBRARY.find(l => l.kind === 'reel')); ld.id = uid(); ld.weight = 80; ld.pick = { x: 300, y: 300, h: 0, rot: 0 }; ld.set = { x: lb.x - 4.5, y: 300, h: 0, rot: 0 }; plan.loads.push(ld); renderAll();
      const a = [ld.pick.h, ld.set.h, trCheck(sp, 'pick').util, trCheck(lb, 'set').warn.length]; objPos('obs:' + sp.id).set(305, 302); const b = [ld.pick.x, ld.pick.y];
      ld.pick.x = 290; ld.pick.y = 290; renderAll(); const c = ld.pick.h; plan.loads = plan.loads.filter(l => l !== ld); plan.obstacles = plan.obstacles.filter(o => o !== sp && o !== lb); renderAll(); return [...a, ...b, c]; });
    check('Transport: a load on an SPMT / low-loader sits at deck height, moves with it, is checked against the payload, and drops back to the ground off the deck', r[0] === 1.5 && r[1] === 0.9 && Math.round(r[2]) === 37 && r[3] === 1 && r[4] === 305 && r[5] === 302 && r[6] === 0, JSON.stringify(r));
    r = await p.evaluate(() => { const sp = makeObject('tr_spmt', [0, 0]); sp.x = 400; sp.y = 400; plan.obstacles.push(sp); sp.w = 20.2; sp.h = 5.0; renderAll(); const a = [sp.tr.lines, sp.tr.rows, sp.w];
      addLift(); const nL = plan.al; sp.x = 420; renderAll(); switchLift(0); const b = sp.x; switchLift(nL); const c = sp.x; deleteLift(nL); switchLift(0); plan.obstacles = plan.obstacles.filter(o => o !== sp); renderAll(); return [...a, b, c]; });
    check('SPMT: stretching it adds whole axle lines / modules (wheels evenly spaced), and each lift keeps its own position for it', r[0] === 14 && r[1] === 2 && Math.abs(r[2] - 19.6) < 0.01 && r[3] === 400 && r[4] === 420, JSON.stringify(r));
    r = await p.evaluate(() => { addCraneOf('CC2800'); const c = plan.cranes[plan.cranes.length - 1]; c.x = -200; c.y = -200; c.chartId = 'cc_sh_240'; const a = craneSummary(c); c.chartId = 'cc_ssl_150_15'; const b = craneSummary(c);
      const bb = (b.ph.pick.bearing + 180) * Math.PI / 180; plan.obstacles.push({ id: 'slx', type: 'building', kind: 'rect', x: c.x + 15 * Math.sin(bb), y: c.y + 15 * Math.cos(bb), w: 4, h: 4, rot: 0, hgt: 3, label: 'SL test hut' }); const ld = plan.loads.find(l => l.id === c.attach?.load); const w = craneSummary(c).warn.some(x => /SL ballast .* hits SL test hut/.test(x)) || !ld;
      const M = buildMesh('pick'); plan.obstacles = plan.obstacles.filter(o => o.id !== 'slx'); plan.cranes = plan.cranes.filter(x => x !== c); renderAll();
      return [c.sl, +(b.GAW - a.GAW).toFixed(1), M.labels.some(l => /SL ballast 150/.test(l.text)), w]; });
    check('Superlift: an SSL chart sets the SL radius, its ballast counts in the ground load, the mast & ballast are drawn and their swing is checked', r[0] === 15 && r[1] === 150 && r[2] && r[3], JSON.stringify(r));
    check('No script errors in the crane checks', !p._errs.length, p._errs.slice(0, 3).join(' | '));
    await p.close();

    // ---------- 4. tandem, layout tools, templates, export ----------
    p = await fresh(); await newPlan(p);
    r = await p.evaluate(() => { const x = LOAD_LIBRARY.find(l => l.kind === 'silo') || LOAD_LIBRARY[0]; const ld = libToLoad(x); ld.id = uid(); ld.weight = 20; ld.pick = { x: 0, y: 0, h: 0, rot: 0 }; ld.set = { x: 10, y: 0, h: 0, rot: 0 }; plan.loads.push(ld);
      const lib = rigLibrary(), f = re => lib.find(i => re.test(i.name)); const s = rigEntry(f(/Round sling 15 t/)); s.len = 2.5; s.legs = 1;
      ld.rig = { arr: 'build', cranes: 2, chain: [rigEntry(f(/Master link 25/)), s], topB: [rigEntry(f(/Master link 25/))], legB: [rigEntry(f(/Round sling 15 t/), { len: 2.5 })] }; renderAll(); openRigBuilder(ld); QB.detail = true; QB.sig0 = JSON.stringify([RB.work.rig.chain, RB.work.rig.chainB]); renderRB();
      return [solveRig(RB.work).hookPts.length, document.querySelectorAll('[data-bi]').length]; });
    check('Tandem rigging: two hooks and crane B list shown', r[0] === 2 && r[1] >= 2, JSON.stringify(r));
    await p.evaluate(() => $('dRig').close());
    r = await p.evaluate(() => { CADS.diag = { paths: [{ p: [0, 0, 100, 0, 100, 30, 0, 30], c: true }, { p: [10, 10, 20, 10, 20, 20, 10, 20], c: true }], texts: [[15, 15, 2, 0, 'LEGEND']], bbox: [0, 0, 100, 30] }; plan.site.cad = { id: 'diag', scale: 500, show: true }; renderMeta(); renderSite();
      ltErase([5, 5], [25, 25]); const after = CADS.diag.paths.length; ltUndo(); return [after, CADS.diag.paths.length]; });
    check('Layout tools: erase an area, then undo', r[0] === 1 && r[1] === 2, JSON.stringify(r));
    r = await p.evaluate(async () => { await saveSiteTemplate('Diag site'); let t = null; for (let i = 0; i < 30 && !t; i++) { await new Promise(r => setTimeout(r, 100)); t = siteTemplates.find(x => x.name === 'Diag site'); } if (!t) return 'not saved'; plan.site.cad = null; plan.obstacles = []; await applySiteTemplate(t); const ok = !!plan.site.cad && CADS[plan.site.cad.id]?.paths.length === 2; await deleteSiteTemplate(t.id); return ok; });
    check('Site template: save, then start from it', r);
    r = await p.evaluate(async () => { addLift('dup'); const s = await buildSheets(); return s.length; });
    check('Export builds every sheet (2 lifts)', r >= 3, r + ' sheets');
    check('No script errors in tandem / layout / export checks', !p._errs.length, p._errs.slice(0, 3).join(' | '));
    await p.close();

    // ---------- 5. a CAD drawing becomes a working site ----------
    const PDF = path.join(__dirname, 'fixtures', 'jetty.pdf');
    if (fs.existsSync(PDF)) {
      p = await fresh(); await newPlan(p);
      await p.evaluate(() => openSiteImport()); await p.setInputFiles('#siFile', PDF); await p.waitForSelector('#siGo', { timeout: 15000 }); await p.click('#siGo'); await p.waitForTimeout(2500);
      r = await p.evaluate(() => { const D = CADS[plan.site.cad.id], ty = t => plan.obstacles.filter(o => o.type === t).length; return { sheet: D.sheet ? D.sheet.groups : 0, title: D.texts.some(t => /ETAT DES LIEUX|Echelle/.test(t[4])), deck: ty('deck'), bld: ty('building') + ty('warehouse') + ty('cabin'), bol: ty('bollard'), deckLocked: !!plan.obstacles.find(o => o.type === 'deck')?.locked }; });
      check('Drawing import: title block and legend taken off', r.sheet >= 2 && !r.title, JSON.stringify(r));
      check('Drawing import: quay deck, buildings and bollards built as objects', r.deck === 1 && r.bld === 2 && r.bol === 24 && r.deckLocked, JSON.stringify(r));
      r = await p.evaluate(() => { const d = plan.obstacles.find(o => o.type === 'deck'), c = centroid(d.pts); addCraneOf(Object.keys(REG.cranes).find(k => REG.cranes[k].type === 'at')); const cr = plan.cranes[0]; sel = { kind: 'crane', id: cr.id }; renderAll(); renderProps(); $('pX').value = c[0]; $('pX').dispatchEvent(new Event('change')); $('pY').value = c[1]; $('pY').dispatchEvent(new Event('change')); ltFit();
        const el = document.querySelector(`g[data-key="crane:${cr.id}"]`), b = el && el.getBoundingClientRect(), hit = b && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!(hit && (hit.closest('g[data-key]')?.dataset.key || '').includes(cr.id)); });
      check('A crane on the imported site is visible and clickable (drawing sits underneath)', r);
      await shot(p, '11_site_from_drawing');
      r = await p.evaluate(() => { const b = plan.obstacles.find(o => ['building', 'warehouse', 'cabin'].includes(o.type)); sel = { kind: 'obs', id: b.id }; renderProps(); $('bLock').click(); const c0 = centroid(b.pts); objPos('obs:' + b.id).set(c0[0] + 25, c0[1]); removeItem('obs', b.id); return [!!b.locked, Math.round(centroid(b.pts)[0] - c0[0]), plan.obstacles.includes(b), $('oDel').disabled]; });
      check('A locked object can not be moved or removed', r[0] && r[1] === 0 && r[2] && r[3], JSON.stringify(r));
      r = await p.evaluate(() => plan.site.cad.show === false);
      check('Once built, the drawing is hidden – the objects are the site (original kept to compare)', r);
      await p.evaluate(() => document.querySelector('[data-sb="orig"]').click());
      await p.click('#vw3d'); await p.waitForTimeout(800); await shot(p, '12_site_3d');
      r = await p.evaluate(async () => { for (let i = 0; i < 40 && !Object.keys(GL.tex).some(k => /^(cad|bg):/.test(k) && GL.tex[k] && GL.tex[k].isTexture); i++) await new Promise(r => setTimeout(r, 100));
        const under = GL.root.children.filter(m => m.material && m.material.map && m.material.transparent).length, M = buildMesh(plan.phase); return [under, M.faces.length, !!document.querySelector('#view3d canvas.gl3d')]; });
      await shot(p, '12_site_3d');
      check('3D view shows the drawing on the ground and the site objects', r[0] >= 1 && r[1] > 50 && r[2], JSON.stringify(r));
      check('No script errors importing the drawing', !p._errs.length, p._errs.slice(0, 3).join(' | '));
      await p.close();
    }
    // a drawing like the SSB base plan: title block of loose lines, legend standing on it, jetty root just above it
    const PDF2 = path.join(__dirname, 'fixtures', 'jetty2.pdf');
    if (fs.existsSync(PDF2)) {
      p = await fresh(); await newPlan(p);
      await p.evaluate(() => openSiteImport()); await p.setInputFiles('#siFile', PDF2); await p.waitForSelector('#siGo', { timeout: 15000 }); await p.click('#siGo'); await p.waitForTimeout(2500);
      r = await p.evaluate(() => { const D = CADS[plan.site.cad.id], ty = t => plan.obstacles.filter(o => o.type === t).length; return { left: D.texts.filter(t => /LEGENDE|ETAT DES LIEUX|Conteneurs|Note/.test(t[4])).length, deck: ty('deck'), bld: ty('building') + ty('warehouse') + ty('cabin'), bol: ty('bollard') }; });
      check('Legend on the title block and loose-line title block both taken off', r.left === 0 && r.deck === 1 && r.bld === 3 && r.bol === 20, JSON.stringify(r));
      r = await p.evaluate(() => { const D = CADS[plan.site.cad.id], b = plan.obstacles.find(o => o.label === 'MAGASIN'), c = centroid(b.pts); removeItem('obs', b.id);
        const near = D.paths.filter(q => { let x = 0, y = 0, n = q.p.length / 2; for (let i = 0; i < q.p.length; i += 2) { x += q.p[i]; y += q.p[i + 1]; } return Math.hypot(x / n - c[0], y / n - c[1]) < 3; }).length;
        return [plan.obstacles.includes(b), near, D.texts.some(t => t[4] === 'MAGASIN')]; });
      check('Deleting a building taken from the drawing leaves nothing behind', !r[0] && r[1] === 0 && !r[2], JSON.stringify(r));
      await shot(p, '13_ssb_like_drawing');
      check('No script errors on the SSB-like drawing', !p._errs.length, p._errs.slice(0, 3).join(' | '));
      await p.close();
      // with Claude available (stubbed here – the live app uses the real one): the drawing is read and the objects named / retyped / added
      p = await fresh(); await newPlan(p);
      await p.evaluate(() => { window._ai = 0; CAP.sampleImages = { maxCount: 4 }; CAP.sample = { json: async (pr, o) => { _ai++; const items = JSON.parse(pr.match(/\n(\[.*?\])\n/)[1]);
        return { items: items.map(it => it.label === 'Structure' ? { id: it.id, type: 'ignore' } : { id: it.id, type: it.now, label: it.label }), extra: [{ type: 'stack', label: 'Containers', height_m: 5.2, pts: [[0.40, 0.45], [0.44, 0.45], [0.44, 0.47], [0.40, 0.47]] }], bollards_ok: true }; } }; });
      await p.evaluate(() => openSiteImport()); await p.setInputFiles('#siFile', PDF2); await p.waitForSelector('#siGo', { timeout: 15000 }); await p.click('#siGo'); await p.waitForTimeout(3500);
      r = await p.evaluate(() => [_ai, plan.obstacles.filter(o => o.type !== 'bollard').map(o => o.type + ':' + o.label).join(',')]);
      check('PDF import asks Claude to read the drawing and applies its answer', r[0] === 1 && /stack:Containers/.test(r[1]) && !/Structure/.test(r[1]) && /warehouse:MAGASIN/.test(r[1]), JSON.stringify(r));
      const PIC = path.join(__dirname, 'fixtures', 'site_picture.png');
      await p.evaluate(() => { CAP.sample = { json: async () => ({ scale: { p1: [0.1, 0.9], p2: [0.5, 0.9], metres: 100, from: 'scale bar' }, objects: [{ type: 'deck', label: 'Jetty', pts: [[0.33, 0.84], [0.6, 0.1], [0.75, 0.2], [0.48, 0.9]] }, { type: 'warehouse', label: 'Magasin', pts: [[0.36, 0.8], [0.4, 0.8], [0.4, 0.75], [0.36, 0.75]] }] }) }; });
      await p.evaluate(() => openSiteImport()); await p.setInputFiles('#siFile', PIC); await p.waitForTimeout(3000);
      r = await p.evaluate(() => [!!plan.site.bg, Math.round(plan.site.bg.mpp * 1000) / 1000, plan.obstacles.filter(o => o.cad === 'picture').map(o => o.type + (o.locked ? '🔒' : '')).join(',')]);
      check('A picture is read by Claude and rebuilt as objects (scale + deck + building)', r[0] && r[2] === 'deck🔒,warehouse', JSON.stringify(r));
      check('No script errors in the Claude reading', !p._errs.length, p._errs.slice(0, 3).join(' | '));
      await p.close();
    }
    // ---------- 6. one import for everything + the offline copy linked to Claude (API answers stubbed) ----------
    if (fs.existsSync(PDF2)) {
      p = await fresh(); const calls = [];
      await p.route('https://api.anthropic.com/**', async route => { const req = route.request(), body = JSON.parse(req.postData()), txt = body.messages[0].content.find(c => c.type === 'text').text; calls.push(body.model);
        let ans = '{"ok": true}';
        if (/Which ONE of these/.test(txt)) ans = '{"category":"site","confidence":0.9,"what":"quay layout"}';
        else if (/built these objects/.test(txt)) { const items = JSON.parse(txt.match(/\n(\[.*?\])\n/)[1]); ans = JSON.stringify({ items: items.map(it => ({ id: it.id, type: it.now, label: it.label })), extra: [], bollards_ok: true }); }
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ content: [{ type: 'text', text: ans }] }) }); });
      await newPlan(p);
      const offline = await p.evaluate(() => !!CAP.local);
      if (offline) { await p.click('#bClaude'); await p.fill('#clKeyIn', 'sk-ant-diagnostic'); await p.click('#clSave'); await p.waitForTimeout(800); await p.evaluate(() => $('dClaude').close()); }
      await p.click('#bImport'); await p.setInputFiles('#ihFile', PDF2); await p.waitForTimeout(2500);
      r = await p.evaluate(() => IH.cat); check('Import works out that a drawing is a site layout', r === 'site', String(r));
      await p.click('#ihGo'); await p.waitForTimeout(4000);
      r = await p.evaluate(() => [!!plan.site.cad, plan.obstacles.filter(o => o.type === 'deck').length]);
      check('Import → Build it builds the site in one go', r[0] && r[1] === 1, JSON.stringify(r));
      if (offline) check('The offline copy reads with Claude once linked (classify + drawing)', calls.length >= 3 && calls.includes('claude-opus-5-5'), JSON.stringify(calls));
      await p.evaluate(() => { try { localStorage.removeItem('lps_claude_key'); } catch (e) { } });
      check('No script errors in import / Claude link', !p._errs.length, p._errs.slice(0, 3).join(' | '));
      await p.close();
    }
    // ---------- 6b. a real site survey (scale from containers, aerial photo under the lines, colour legend) ----------
    // Real drawings are never kept in the public repo: put ssb_dakar.pdf in tests/fixtures-private/ (git-ignored) or point
    // LP_PRIVATE_FIXTURES at the folder holding it. Without it these checks are skipped (and said so).
    const SSB = path.join(process.env.LP_PRIVATE_FIXTURES || path.join(__dirname, 'fixtures-private'), 'ssb_dakar.pdf');
    if (!fs.existsSync(SSB)) console.log('SKIP the real-survey import checks (6b): no private copy of ssb_dakar.pdf');
    if (fs.existsSync(SSB)) {
      p = await fresh(); await newPlan(p, 'SSB check');
      await p.evaluate(() => openSiteImport()); await p.setInputFiles('#siFile', SSB); await p.waitForSelector('#siGo', { timeout: 30000 }); await p.click('#siGo'); await p.waitForTimeout(6000);
      r = await p.evaluate(() => { const ty = t => plan.obstacles.filter(o => o.type === t).length, d = plan.obstacles.find(o => o.type === 'deck'); return { scale: plan.site.cad.scale, from: plan.site.cad.scaleFrom, deck: ty('deck'), area: d ? Math.round(areaOf(d.pts)) : 0, stack: ty('stack'), cabin: ty('cabin'), pole: ty('pole'), manhole: ty('manhole'), power: ty('powerline'), drain: ty('drain'), bollard: ty('bollard'), pic: !!plan.site.bg, legend: (CADS[plan.site.cad.id].legend || []).length }; });
      check('SSB plan: no printed scale – scale worked out from the containers (≈1:935)', Math.abs(r.scale - 935) <= 25 && /container/.test(r.from), JSON.stringify(r));
      check('SSB plan: yard boundary (open at the gate) becomes the deck', r.deck === 1 && r.area > 20000 && r.area < 28000, JSON.stringify(r));
      check('SSB plan: legend read – containers, guérites/WC, poles, manholes, MT line, sewer', r.legend >= 5 && r.stack >= 5 && r.cabin >= 5 && r.pole === 2 && r.manhole >= 8 && r.power === 1 && r.drain === 1 && r.bollard === 0, JSON.stringify(r));
      check('SSB plan: the aerial photo is kept as the original, lined up with the lines', r.pic);
      r = await p.evaluate(() => { addCraneOf(Object.keys(REG.cranes).find(k => REG.cranes[k].type === 'at')); const c = plan.cranes[0], C = REG.cranes[c.model];
        const mh = plan.obstacles.find(o => o.type === 'manhole'), m = centroid(obsPts(mh)), pd = cranePads(c, C)[0]; c.x += m[0] - pd.w[0]; c.y += m[1] - pd.w[1]; plan.obstacles = plan.obstacles.filter(o => !isMat(o)); renderAll();
        const s1 = craneSummary(c), d = plan.obstacles.find(o => o.type === 'deck'), dc = centroid(d.pts); c.x = dc[0]; c.y = dc[1]; renderAll(); const s2 = craneSummary(c);
        const v = newVessel('psv', [dc[0] - 60, dc[1]]); plan.obstacles.push(v); const ok = berthAlongside(v);
        return [s1.status, s1.warn.some(w => /on a manhole/.test(w)), s2.warn.some(w => /manhole|off the quay/.test(w)), ok]; });
      check('Ground checks: a pad on a manhole / off the deck is flagged, the middle of the yard is clear', r[0] === 'bad' && r[1] && !r[2], JSON.stringify(r));
      check('A vessel near the imported quay deck berths along its edge', r[3] === true, JSON.stringify(r));
      await shot(p, '14_ssb_real');
      check('No script errors on the SSB plan', !p._errs.length, p._errs.slice(0, 3).join(' | '));
      await p.close();
    }
    // ---------- 6c. a different kind of site drawing: a site map exported from another tool, "1:1000 (fit)", labelled areas, dimension text ----------
    const MAP = path.join(__dirname, 'fixtures', 'site_map_vector.pdf');
    if (fs.existsSync(MAP)) {
      p = await fresh(); await newPlan(p, 'Map check');
      await p.evaluate(() => openSiteImport()); await p.setInputFiles('#siFile', MAP); await p.waitForSelector('#siGo', { timeout: 30000 }); await p.click('#siGo'); await p.waitForTimeout(5000);
      r = await p.evaluate(() => { const ty = t => plan.obstacles.filter(o => o.type === t).length; return { scale: plan.site.cad.scale, from: plan.site.cad.scaleFrom, deck: ty('deck'), road: ty('road'), laydown: ty('laydown'), zone: plan.obstacles.filter(o => o.zone).length, named: plan.obstacles.filter(o => o.label && o.label !== 'Structure').length }; });
      check('Site map: true scale from the dimensions printed on it (1:1030, not the 1:1000 "fit")', Math.abs(r.scale - 1030) <= 10 && /dimensions/.test(r.from), JSON.stringify(r));
      check('Site map: labelled areas become the right objects (yard, roads/walkways, laydown, no-go zone)', r.deck === 1 && r.road >= 2 && r.laydown >= 5 && r.zone >= 1 && r.named >= 30, JSON.stringify(r));
      // plan the lift: the reel drawn at its current location goes to the new location – the app picks and places the crane
      await p.evaluate(() => { const reels = plan.obstacles.filter(o => /reel/i.test(o.label || '')).map(o => ({ c: centroid(o.pts || [[o.x, o.y]]), a: areaOf(o.pts || [[0, 0]]) })).sort((a, b) => b.a - a.a);
        const A = reels[0], B = reels.find(r => Math.hypot(r.c[0] - A.c[0], r.c[1] - A.c[1]) > 20); plan.obstacles = plan.obstacles.filter(o => !/reel/i.test(o.label || ''));
        const ld = libToLoad(LOAD_LIBRARY.find(l => l.kind === 'reel')); ld.id = uid(); ld.weight = 25; ld.pick = { x: A.c[0], y: A.c[1], h: 0, rot: 0 }; ld.set = { x: B.c[0], y: B.c[1], h: 0, rot: 0 }; plan.loads.push(ld); sel = { kind: 'load', id: ld.id }; renderAll(); });
      await p.click('#tPlan'); await p.waitForFunction(() => !AP.busy, null, { timeout: 60000 });
      r = await p.evaluate(() => ({ ok: AP.res.filter(x => x.ok).map(x => x.model + ':' + Math.round(x.E.util)), all: AP.res.length }));
      const nOk = r.ok.length; await p.click('[data-ap]'); await p.waitForTimeout(600);
      const rr = await p.evaluate(() => { const c = plan.cranes[0], S = craneSummary(c), ld = plan.loads[0]; return [plan.cranes.length, Math.round(S.util), S.status, matsUnderCrane(c).length, ld.rig?.q?.arr, Math.round(Math.max(...solveRig(ld).rows.map(x => x.util)))]; });
      check('Plan the lift: every crane tried, the working ones ranked, the chosen one placed with mats and passing its checks', nOk >= 1 && rr[0] === 1 && rr[1] <= 100 && rr[2] !== 'bad' && rr[3] >= 4, JSON.stringify([r, rr]));
      check('Plan the lift: the rigging comes from the simple builder, sized at ≤ 90 %', rr[4] === 'spread' && rr[5] <= 90, JSON.stringify(rr.slice(4)));
      await shot(p, '15_plan_the_lift');
      check('No script errors on the site map', !p._errs.length, p._errs.slice(0, 3).join(' | '));
      await p.close();
    }
    // ---------- 7. data moves between copies: backup in one, restore in a clean one (plans, site templates, drawings) ----------
    if (fs.existsSync(PDF2)) {
      let ctx = await b.newContext({ acceptDownloads: true }); p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
      await p.goto('file://' + FILE + '?local'); await p.waitForTimeout(900); await newPlan(p, 'Round trip');
      await p.evaluate(() => openSiteImport()); await p.setInputFiles('#siFile', PDF2); await p.waitForSelector('#siGo', { timeout: 15000 }); await p.click('#siGo'); await p.waitForTimeout(2500);
      await p.evaluate(async () => { await savePlan(); await saveSiteTemplate('SSB Base'); }); await p.waitForTimeout(800);
      await p.evaluate(() => $('bPlans').click()); await p.waitForTimeout(300);
      const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#bBackup')]); const bk = path.join(OUT, 'roundtrip_backup.json'); await dl.saveAs(bk);
      const e1 = p._errs.slice(); await ctx.close();
      ctx = await b.newContext(); p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
      await p.goto('file://' + FILE + '?local'); await p.waitForTimeout(900); await p.click('#stRestore'); await p.setInputFiles('#restoreFile', bk); await p.waitForTimeout(2000);
      r = await p.evaluate(async () => { const pl = planIndex.find(x => x.name === 'Round trip'); if (!pl) return null; openPlan(clone(pl)); await new Promise(r => setTimeout(r, 800)); return [!!CADS[plan.site.cad.id], plan.obstacles.length, siteTemplates.map(t => t.name).join(','), !!(await stCadJson(siteTemplates[0]))]; });
      check('Backup → restore in a clean copy keeps the plan, its drawing and the site template', r && r[0] && r[1] > 20 && r[2] === 'SSB Base' && r[3], JSON.stringify(r));
      check('No script errors moving data', !e1.length && !p._errs.length, [...e1, ...p._errs].slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- 8. tandem lifts step by step: a top-and-tail upend and a two-crane move (cranes slewing and luffing) ----------
    {
      p = await b.newPage({ viewport: { width: 1500, height: 950 } }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
      await p.goto('file://' + FILE + '?local'); await p.waitForTimeout(900); await newPlan(p, 'Tandem steps');
      r = await p.evaluate(async () => {
        const ld = { ...clone(LOAD_PRESETS.box), id: uid(), name: 'Spud leg', kind: 'cyl', orient: 'horizontal', L: 27.5, D: 1.2, weight: 30, span: 26.9, pick: { x: 0, y: 0, rot: 0, h: 0 }, set: { x: 0, y: 0, rot: 0, h: 0 } };
        plan.loads.push(ld); normLoad(ld); addCraneOf('XCA230'); addCraneOf('XCA230'); const [c1, c2] = plan.cranes;
        c1.attach = { load: ld.id, point: 'A' }; c2.attach = { load: ld.id, point: 'B' }; c1.x = 0; c1.y = -12; c2.x = 9; c2.y = 9; c1.chartId = 'xca_8.3_80'; c2.chartId = 'xca_8.3_40';
        ld.rig = buildPreset(ld, RIG_PRESETS.find(x => x.id === 'build_upend')); renderAll();
        const L = liftSteps(ld), st = L.steps, tilts = st.map(s => s.tilt), rel = st.find(s => s.release), both = st.filter(s => !s.release);
        const topOK = both.every(s => s.per[0].used >= 0.999 * (rule('tt.top') / 100) * (s.per[0].geom + s.per[1].geom)), tailOK = both.every(s => s.per[1].used >= 0.999 * (rule('tt.tail') / 100) * (s.per[0].geom + s.per[1].geom));
        const sheets = await buildSheets(), card = [...document.querySelectorAll('#checks .card')].some(c => /Lift steps/.test(c.textContent));
        const up = [L.up, [15, 30, 45, 60, 75].every(a => tilts.includes(a)), !!rel && rel.per[1].rel && rel.per[0].used > 0.99 * (L.steps[0].per[0].geom + L.steps[0].per[1].geom), topOK, tailOK, st[0].per[0].R - rel.per[0].R > 3, sheets.filter(s => /lift_sequence/.test(s.name)).length >= 4, card];
        // level tandem move from a ship's hold to a trailer: both cranes' radius and slew change step by step, the carry clears the hatch coaming
        plan.loads.length = 0; plan.cranes.length = 0;
        const w = makeObject('wall', null, [[-10, 18], [10, 18], [10, 26], [-10, 26], [-10, 18]]); w.hgt = 2; w.label = 'Hatch coaming'; plan.obstacles.push(w);
        const lo = { ...clone(LOAD_PRESETS.box), id: uid(), name: 'Locomotive', L: 12.2, W: 2.9, H: 4.2, weight: 110, span: 9, pick: { x: 0, y: 22, rot: 0, h: 0 }, set: { x: 0, y: 1, rot: 0, h: 0.8 } };
        plan.loads.push(lo); normLoad(lo); addCraneOf('GMK6400'); addCraneOf('GMK6400'); const [d1, d2] = plan.cranes;
        d1.attach = { load: lo.id, point: 'A' }; d2.attach = { load: lo.id, point: 'B' }; d1.x = -15; d1.y = 10; d2.x = 15; d2.y = 10; d1.chartId = d2.chartId = 'gmk_cw135'; for (const c of [d1, d2]) { c.autoBoom = false; c.boomCfg = defaultCfgFor(REG.cranes.GMK6400, 'gmk_cw135', 25.19); c.L = boomLength(REG.cranes.GMK6400, c.boomCfg); } lo.rig = buildPreset(lo, RIG_PRESETS.find(x => x.id === 'tandem')); renderAll();
        const M = liftSteps(lo), Rs = M.steps.map(s => s.per[0].R), Bs = M.steps.map(s => s.per[0].brg);
        const mv = [M.steps.length >= 6, Math.max(...Rs) - Math.min(...Rs) > 3, Math.max(...Bs) - Math.min(...Bs) > 20, +M.carry.H.toFixed(2) >= 3 - 0.01 ? true : M.carry.H, M.steps.every(s => s.per.every(q => q.util > 0))];
        lo.steps = clone(lsAutoSteps(lo)); lo.steps[2].h = 0.5; renderAll(); const low = liftSteps(lo).steps[2], warned = craneSummary(d1).warn.some(x => /lift step 3/.test(x));
        return { up, mv, low: [low.h, low.clear, low.under && low.under.name], warned };
      });
      check('Top and tail upend: stages 15–75°, tail lowered off at vertical, top crane then takes it all', r.up.slice(0, 3).every(Boolean), JSON.stringify(r.up));
      check('Top and tail upend: top crane checked for ≥ 100 %, tail ≥ 75 % (Rules), top crane radius comes in as it upends', r.up.slice(3, 6).every(Boolean), JSON.stringify(r.up));
      check('Lift steps show on the checks panel and as a LIFT SEQUENCE sheet', r.up[6] && r.up[7], JSON.stringify(r.up));
      check('Tandem move between positions: each crane\'s radius and slew checked step by step, carried 1 m over the coaming', r.mv.every(Boolean), JSON.stringify(r.mv));
      check('Changing a step re-checks it', r.warned, JSON.stringify(r));
      check('No script errors in the lift steps', !p._errs.length, p._errs.slice(0, 3).join(' | '));
      await p.close();
    }
    // ---------- 9. shared database (Supabase, answered by a stand-in here): sign-in, first-time password, save, reload ----------
    {
      const store = new Map(), UID = '11111111-1111-4111-8111-111111111111'; let pwSet = false, tokens = 0, pwPuts = 0, uname = '', denyWrites = false;
      const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
      const user = () => ({ id: UID, aud: 'authenticated', role: 'authenticated', email: 'diag@example.com', user_metadata: pwSet ? { pw_set: true, name: uname } : {}, app_metadata: { provider: 'email' }, created_at: '2026-01-01T00:00:00Z' });
      const session = () => { const exp = Math.floor(Date.now() / 1000) + 3600; return { access_token: b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: UID, exp, role: 'authenticated', aud: 'authenticated', email: 'diag@example.com' }) + '.sig', token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'diag-refresh', user: user() }; };
      const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.route('https://zsdacfyuongmebpdltcw.supabase.co/**', async route => {
        const req = route.request(), u = new URL(req.url()), m = req.method(), hd = req.headers();
        const json = (o, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: H, body: JSON.stringify(o) });
        if (m === 'OPTIONS') return route.fulfill({ status: 200, headers: H });
        if (u.pathname === '/auth/v1/token') { const q = req.postDataJSON() || {}; if (q.password !== undefined && q.password !== 'TempPass1!') return json({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400); tokens++; return json(session()); }
        if (u.pathname === '/auth/v1/user') { if (m === 'PUT') { const q = req.postDataJSON() || {}; if (q.data && q.data.pw_set && q.password) { pwSet = true; pwPuts++; } if (q.data && q.data.name) uname = q.data.name; } return json(user()); }
        if (u.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: H });
        if (u.pathname === '/rest/v1/liftplan_docs') {
          const eq = k => { const v = u.searchParams.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
          const one = /vnd\.pgrst\.object/.test(hd['accept'] || '');
          if (m === 'GET') {
            const coll = eq('coll'), pth = eq('path'); let rows = [...store.values()].filter(r => (coll == null || r.coll === coll) && (pth == null || r.path === pth)).sort((a, c) => a.path < c.path ? -1 : 1);
            const off = +(u.searchParams.get('offset') || 0), lim = u.searchParams.get('limit'); rows = rows.slice(off, lim ? off + +lim : undefined);
            return one ? (rows.length ? json(rows[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406)) : json(rows);
          }
          if (m === 'POST' && denyWrites) return json({ code: '42501', details: null, hint: null, message: 'permission denied for table liftplan_docs' }, 401);
          if (m === 'POST') { let q = req.postDataJSON(); const arr = Array.isArray(q) ? q : [q]; arr.forEach(r => store.set(r.path, { ...r })); return json(one ? arr[0] : arr, 201); }
          if (m === 'DELETE') { store.delete(eq('path')); return route.fulfill({ status: 204, headers: H }); }
        }
        return json({ message: 'not in the stand-in' }, 404);
      });
      p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
      await p.goto('file://' + FILE); await p.waitForTimeout(1500); await shot(p, '90_sign_in');
      g = await p.evaluate(() => { const d = $('dSignIn'), r = d.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + 30); return [d.open, !!top && d.contains(top), !$('siLogin').hidden, !!$('dStart').open]; });
      check('Shared database: the app asks staff to sign in first, on top of the start screen', g[0] && g[1] && g[2], JSON.stringify(g));
      await p.fill('#siEmail', 'diag@example.com'); await p.fill('#siPass', 'wrong'); await p.click('#siGo'); await p.waitForTimeout(600);
      const wrong = await p.evaluate(() => [$('dSignIn').open, $('siMsg').textContent]);
      await p.fill('#siPass', 'TempPass1!'); await p.click('#siGo'); await p.waitForTimeout(800); await shot(p, '91_first_password');
      g = await p.evaluate(() => [$('dSignIn').open, !$('siNew').hidden, $('siLogin').hidden, $('siTitle').textContent]);
      await p.keyboard.press('Escape'); await p.waitForTimeout(200); g.push(await p.evaluate(() => $('dSignIn').open));
      check('Wrong password is refused; first sign-in must choose an own password (no way round it)', wrong[0] && /Wrong email or password/.test(wrong[1]) && g[0] && g[1] && g[2] && /choose your own password/.test(g[3]) && g[4], JSON.stringify([wrong, g]));
      await p.fill('#siName', ''); await p.fill('#siNew1', 'MyOwnPass9'); await p.fill('#siNew2', 'MyOwnPass9'); await p.click('#siGo'); await p.waitForTimeout(300); const noName = await p.evaluate(() => [$('dSignIn').open, $('siMsg').textContent]); await p.fill('#siName', 'Diag Tester');
      await p.fill('#siNew1', 'MyOwnPass9'); await p.fill('#siNew2', 'MyOwnPassX'); await p.click('#siGo'); await p.waitForTimeout(300);
      const mism = await p.evaluate(() => $('siMsg').textContent);
      await p.fill('#siNew2', 'MyOwnPass9'); await p.click('#siGo'); await p.waitForTimeout(1200);
      g = await p.evaluate(() => [$('dSignIn').open, CAP.shared, TEAM.me, ($('bAccount') || {}).textContent]);
      check('Name and new password saved, then the app opens in shared mode with the user\'s name in the top bar', noName[0] && /Type your name/.test(noName[1]) && /aren't the same/.test(mism) && pwSet && pwPuts === 1 && !g[0] && g[1] && g[2] === UID && /Diag Tester/.test(g[3] || '') && (store.get('people/' + UID) || { data: {} }).data.name === 'Diag Tester' && /Version 20\d\d-/.test(await p.evaluate(() => $('dSignIn').textContent)), JSON.stringify([noName, mism, pwSet, g]));
      await newPlan(p, 'Shared plan'); await p.waitForTimeout(300);
      const pid = await p.evaluate(async () => { await writePlan(false); return plan.id; }); await p.waitForTimeout(400);
      const row = store.get('plans/' + pid);
      check('Saving a plan writes it to the shared database with who saved it', row && row.coll === 'plans' && row.data.name === 'Shared plan' && row.data.savedBy === UID && row.updated_by === UID, JSON.stringify(row ? { coll: row.coll, name: row.data.name, savedBy: row.data.savedBy } : null));
      // a colleague saves a newer version: the app reads it fresh (that's what the overwrite warning relies on)
      store.set('plans/' + pid, { ...row, data: { ...row.data, rev: 99, savedBy: 'someone-else' } });
      const fresh = await p.evaluate(async id => (await CAP.db.doc('plans/' + id).get()).data().rev, pid);
      const errs1 = p._errs.filter(e => !/WebSocket|realtime/i.test(e));
      const q = await ctx.newPage(); q._errs = []; q.on('pageerror', e => q._errs.push(e.message));
      await q.goto('file://' + FILE); await q.waitForTimeout(2000);
      g = await q.evaluate(id => [$('dSignIn').open, planIndex.some(x => x.id === id && x.name === 'Shared plan'), ($('bAccount') || {}).textContent, $('plansNote') ? (renderPlans(), $('plansNote').textContent) : ''], pid);
      g.push(await q.evaluate(() => !!$('bAccount2') && $('dStart').contains($('bAccount2')))); await q.click('#bAccount2'); await q.waitForTimeout(300); await shot(q, '92_account');
      check('Next visit: still signed in, no password prompt, the shared plan is listed', fresh === 99 && !g[0] && g[1] && /Diag Tester/.test(g[2] || '') && /shared database/.test(g[3]) && g[4] && tokens === 1, JSON.stringify([fresh, g, tokens]));
      denyWrites = true; const shown = await q.evaluate(async () => { let threw = false; try { await CAP.db.doc('plans/denied').set({ name: 'x' }); } catch (e) { threw = true; } return [threw, $('toast').hidden ? '' : $('toast').textContent]; }); denyWrites = false;
      check('A save the database refuses is shown to the user, not swallowed', shown[0] && /Couldn't save to the shared database.*permissions/.test(shown[1]), JSON.stringify(shown));
      const errs = errs1.concat(q._errs.filter(e => !/WebSocket|realtime/i.test(e)));
      check('No script errors in shared mode', !errs.length, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---------- 10. sample plans: each opens from the start screen and produces its full sheet set ----------
    {
      p = await b.newPage({ viewport: { width: 1500, height: 950 } }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
      await p.goto('file://' + FILE + '?local'); await p.waitForTimeout(900);
      const n = await p.evaluate(() => SAMPLE_PLANS.length), got = [];
      for (let i = 0; i < n; i++) {
        await p.evaluate(() => { if (!$('dStart').open) openStart(false); }); await p.waitForTimeout(200);
        await p.click('#stSamples'); await p.waitForTimeout(200); await p.click(`[data-smp="${i}"]`); await p.waitForTimeout(900);
        got.push(await p.evaluate(async () => { const sh = await buildSheets(), L = plan.loads.map(l => liftSteps(l)).filter(Boolean)[0];
          return { up: L && L.up, steps: L ? L.steps.length : 0, bad: L ? L.steps.filter(s => !s.ok).length : -1, sheets: sh.length, stages: sh.filter(s => /LIFT SEQUENCE/.test(s.svg)).length, ssb: sh.filter(s => /SSB/.test(s.svg)).length, saved: !dirty, open: !$('dSamples').open && !$('dStart').open }; }));
        await p.evaluate(() => goHome()); await p.waitForTimeout(300);
      }
      if (n) await shot(p, '95_samples');
      check('Sample plans: top and tail (2 with cranes, 1 with a forklift) and a moving tandem lift open from the start screen and give their full sheet sets', n >= 4 && got.filter(g => g.up).length >= 3 && got.some(g => !g.up) && got.every(g => g.steps >= 7 && g.bad === 0 && g.stages >= g.steps && g.ssb === 0 && g.saved && g.open), JSON.stringify(got));
      check('No script errors with the samples', !p._errs.length, p._errs.slice(0, 3).join(' | '));
    }
    // ---------- 11. the sample plans are in the plans list – once; a deleted sample stays deleted ----------
    {
      const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
      await p.goto('file://' + FILE + '?local'); await p.waitForTimeout(1800);
      const g1 = await p.evaluate(() => planIndex.filter(x => /^sample-/.test(x.id)).map(x => x.name));
      await p.evaluate(async () => { await CAP.db.doc('plans/sample-2').delete(); }); await p.reload(); await p.waitForTimeout(1800);
      const g2 = await p.evaluate(() => [planIndex.filter(x => /^sample-/.test(x.id)).length, planIndex.length, $('stList').textContent.includes('Sample – Top and tail')]);
      const g3 = await p.evaluate(() => { const s = planIndex.find(x => x.id === 'sample-1'); openPlan(clone(s)); const L = liftSteps(plan.loads[0]); return [plan.name, L && L.steps.length, L && L.steps.every(q => q.ok)]; });
      check('Sample plans are in Lift plans (once), a deleted one stays deleted, and they open as normal plans', g1.length === 4 && g1.every(n => /^Sample – /.test(n)) && g2[0] === 3 && g2[1] === 3 && g2[2] && g3[1] >= 7 && g3[2], JSON.stringify([g1, g2, g3]));
      await ctx.close();
    }
    // ---------- 12. top and tail with a forklift: the engine, the checks, the button and the sheets ----------
    {
      p = await b.newPage({ viewport: { width: 1500, height: 950 } }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
      await p.goto('file://' + FILE + '?local'); await p.waitForTimeout(900);
      const g = await p.evaluate(async () => {
        const F = FORKLIFTS.H16XD6, ax = flAxles(F, F.Q, F.c0), c12 = flCap(F, 1.2), out = { ax: ax.map(v => +v.toFixed(3)), c12: +c12.toFixed(2) };
        const smp = SAMPLE_PLANS.find(s => /forklift/i.test(s.title)); openPlan(clone(smp.plan)); const ld = plan.loads[0], L = liftSteps(ld), cr = plan.cranes[0];
        const hold = L.steps.filter(s => !s.per[1].rel), rel = L.steps.filter(s => s.per[1].rel), sp = tandemSpan(ld), tailW = (+ld.weight) * ((+ld.cog || 0) + sp / 2) / sp;
        const dist = hold.map(s => Math.hypot(s.per[1].ctr[0] - cr.x, s.per[1].ctr[1] - cr.y));
        out.ft = L.ft; out.n = L.steps.length; out.ok = L.steps.every(s => s.ok); out.tail = hold.every(s => Math.abs(s.per[1].geom - tailW) < 0.01); out.design = hold.every(s => Math.abs(s.per[1].design - 0.75 * ld.weight) < 0.01);
        out.drivesIn = dist.every((d, i) => !i || d <= dist[i - 1] + 1e-6) && dist[0] - dist[dist.length - 1] > 3; out.hookFixed = hold.every(s => Math.abs(s.per[0].R - hold[0].per[0].R) < 0.01);
        out.rel = rel.length >= 1 && rel[0].tilt >= 89.5 && rel.every(s => Math.abs(s.per[0].geom - (ld.weight + rigW(ld))) < 0.01);
        const sh = await buildSheets(), seq = sh.filter(s => /lift_sequence/.test(s.name)); out.sheets = seq.length; out.forkOnSheets = seq.filter(s => /Hyster H16XD6/.test(s.svg) && /FORKS /.test(s.svg)).length;
        L.fork.fl.attW = 12; LS_CACHE.clear(); out.over = craneSummary(cr).warn.some(w => /Forklift.*over the 100% limit/.test(w)); L.fork.fl.attW = 0; LS_CACHE.clear();
        // the button on a one-crane long load puts a forklift on the tail
        const q = blankPlan(); q.name = 'Fork button'; openPlan(q); const l2 = { ...clone(LOAD_PRESETS.box), id: uid(), name: 'Pipe', kind: 'cyl', orient: 'horizontal', L: 12, D: 0.6, weight: 6, span: 11.5, pick: { x: 0, y: 0, rot: 0, h: 0 }, set: { x: 0, y: 0, rot: 0, h: 0 } };
        plan.loads.push(l2); normLoad(l2); addCraneOf('XCA230'); plan.cranes[0].attach = { load: l2.id, point: 'C' }; plan.cranes[0].x = -15; plan.cranes[0].chartId = 'xca_8.3_80'; renderAll();
        const btn = document.querySelector(`[data-lsfork="${l2.id}"]`); out.btn = !!btn; if (btn) btn.click(); await new Promise(r => setTimeout(r, 400));
        out.added = lsFT(l2) && plan.cranes[0].attach.point === 'A' && $('dLs').open && !!$('lfModel'); $('dLs').close();
        return out; });
      await shot(p, '96_forklift');
      check('Forklift H16XD6: the axle-load model gives the spec sheet\'s rated axle loads; capacity carried to a 1.2 m load centre by moment', g.ax[0] === 33.853 && g.ax[1] === 2.655 && Math.abs(g.c12 - 11.76) < 0.02, JSON.stringify([g.ax, g.c12]));
      check('Top and tail with a forklift: crane hook stays over the top, forklift drives in, tail share and 75% design share at every stage, released at vertical, all OK', g.ft && g.n >= 9 && g.ok && g.tail && g.design && g.drivesIn && g.hookFixed && g.rel, JSON.stringify(g));
      check('Forklift lift sheets: summary + one page per stage, the forklift drawn and dimensioned; an overloaded forklift is flagged', g.sheets === g.n + 1 && g.forkOnSheets >= g.n - 2 && g.over, JSON.stringify([g.sheets, g.forkOnSheets, g.over]));
      check('"Tail with a forklift…" on a one-crane long load sets the lift up and opens the steps', g.btn && g.added, JSON.stringify([g.btn, g.added]));
      check('No script errors with the forklift lift', !p._errs.length, p._errs.slice(0, 3).join(' | '));
    }
    // ---------- 13. after the upend the load is turned and moved to its set point: that step gets a TOP VIEW of the move ----------
    {
      p = await b.newPage({ viewport: { width: 1500, height: 950 } }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
      await p.goto('file://' + FILE + '?local'); await p.waitForTimeout(900);
      const g = await p.evaluate(async () => {
        openPlan(clone(SAMPLE_PLANS[0].plan)); const ld = plan.loads[0]; ld.set = { ...ld.pick, rot: (+ld.pick.rot || 0) + 90, x: ld.pick.x + 3, y: ld.pick.y + 2 }; renderAll();
        const L = liftSteps(ld), mvIdx = L.steps.findIndex(s => lsPlanMove(L.steps[s.no - 2], s)), s = L.steps[mvIdx], txt = lsMoves(L.steps[s.no - 2], s).map(m => m.txt).join(' | ');
        const sh = await buildSheets(), st = sh.filter(x => /lift_sequence.*stage_/.test(x.name)), withTop = st.filter(x => /TOP VIEW/.test(x.svg)).map(x => x.name);
        return { mvName: s && s.name, upendSteps: L.steps.filter(q => q.tilt > 0 && q.tilt < 90).every(q => !lsPlanMove(L.steps[q.no - 2], q)), txt, withTop, turned: /TOP VIEW – .*slews \d+° clockwise.*load turned \d+° clockwise on the hook/.test(st[mvIdx]?.svg || '') }; });
      check('A load turned / moved to its set point after the upend: that stage gets a top view of the turn, the move and the slew, and the crane is told to turn the load', /set position/.test(g.mvName || '') && g.upendSteps && /turn the load \d+° clockwise on the hook/.test(g.txt) && g.withTop.length === 1 && g.turned, JSON.stringify(g));
      const fv = await p.evaluate(async () => { openPlan(clone(SAMPLE_PLANS[1].plan)); const ld = plan.loads[0], c = plan.cranes.find(c => c.attach?.point !== 'B'), a = -150 * D2R, dx = ld.pick.x - c.x, dy = ld.pick.y - c.y;
        ld.set = { ...ld.pick, x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a), rot: (+ld.pick.rot || 0) - 89 }; renderAll(); const L = liftSteps(ld), s = L.steps[4];
        let seen = null; const _bm2 = buildMesh; const pic = await lsCadFront(L, s, 1200, 800); const P0 = L.steps[0].pose, cx = L.cranes.reduce((q, k) => q + k.x, 0) / 2, cy = L.cranes.reduce((q, k) => q + k.y, 0) / 2;
        const n = rot2([0, 1], -(P0.rot || 0)), side = Math.sign((cx - P0.x) * n[0] + (cy - P0.y) * n[1]);
        // the projection's depth axis: a point on the cranes' side must be further away than the load
        const depthLoad = P0.x * pic.dir[0] + P0.y * pic.dir[1], depthCranes = cx * pic.dir[0] + cy * pic.dir[1]; return { ok: depthLoad < depthCranes - 0.5, side, depthLoad, depthCranes }; });
      check('Front view of a top and tail looks from the side away from the cranes even when the set point is swung far round', fv.ok, JSON.stringify(fv));
      const sd = await p.evaluate(async () => { const out = {}; for (const dir of ['cw', 'ccw']) { openPlan(clone(SAMPLE_PLANS[1].plan)); const ld = plan.loads[0], c = plan.cranes.find(c => c.attach?.point !== 'B'), a = -150 * D2R, dx = ld.pick.x - c.x, dy = ld.pick.y - c.y;
          ld.set = { ...ld.pick, x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a), rot: (+ld.pick.rot || 0) - 89 }; ld.travelDir = dir; renderAll();
          const L = liftSteps(ld), i = L.steps.findIndex(s => lsPlanMove(L.steps[s.no - 2], s)), s = L.steps[i], pv = L.steps[i - 1], q = s.per.find(x => !x.rel), pq = pv.per.find(x => x.c === q.c);
          const sh = await lsStageSheet(L, s); out[dir] = { d: Math.round(lsSlewDelta(pv, s, pq, q)), txt: lsMoves(pv, s).find(m => m.q.c === q.c).txt, head: (sh.svg.match(/TOP VIEW – [^<]*/) || [''])[0], mid: Math.round(((lsLerpStep(pv, s, 0.5).per.find(x => x.c === q.c).brg % 360) + 360) % 360) }; }
        return out; });
      check('The slew from pick to set follows the plan\'s direction (clockwise / anticlockwise) – steps, top view, Play lift', sd.cw.d > 0 && sd.ccw.d < 0 && Math.abs(sd.cw.d - sd.ccw.d) === 360 && /clockwise/.test(sd.cw.txt) && /slew \d+° anticlockwise/.test(sd.ccw.txt) && /slews \d+° anticlockwise/.test(sd.ccw.head) && sd.cw.mid !== sd.ccw.mid, JSON.stringify(sd));
      check('No script errors with the top view of a move', !p._errs.length, p._errs.slice(0, 3).join(' | '));
    }
    // ---------- 14. after a top and tail the load is set down standing up: radius / slew, the tail crane off the hook, plan, elevation, the setting ----------
    {
      p = await b.newPage({ viewport: { width: 1500, height: 950 } }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
      await p.goto('file://' + FILE + '?local'); await p.waitForTimeout(900);
      const g = await p.evaluate(async () => {
        openPlan(clone(SAMPLE_PLANS[0].plan)); const ld = plan.loads[0]; ld.set = { ...ld.pick, rot: (+ld.pick.rot || 0) + 90, x: ld.pick.x + 3, y: ld.pick.y + 2 }; renderAll();
        const L = liftSteps(ld), last = L.steps[L.steps.length - 1], [c1, c2] = plan.cranes, e1 = evalCrane(c1, 'set'), e2 = evalCrane(c2, 'set'), q1 = last.per.find(q => q.c === c1);
        const out = { auto: lsSetTilt(ld), r1: [+e1.R.toFixed(2), +q1.R.toFixed(2)], share: [+e1.share.toFixed(2), +e2.share.toFixed(2)], rel: !!e2.released };
        const el = elevScene(c1, 'set'); let lo = 1e9, hi = -1e9, x0 = 1e9, x1 = -1e9; for (const it of el.scene.items) if (it.L === 'LOAD' && it.t === 'poly') for (const pt of it.pts) { lo = Math.min(lo, pt[1]); hi = Math.max(hi, pt[1]); x0 = Math.min(x0, pt[0]); x1 = Math.max(x1, pt[0]); }
        out.upright = hi - lo > 20 && x1 - x0 < 5;
        const sc = loadScene(ld, 'set'); out.round = sc.items.some(it => it.t === 'circle' && it.L === 'LOAD');
        sel = { kind: 'load', id: ld.id }; renderProps(); out.field = !!$('l_setT');
        $('l_setT').value = '0'; $('l_setT').dispatchEvent(new Event('change')); out.level = lsSetTilt(ld) === 0 && !evalCrane(c2, 'set').released;
        delete ld.set.tilt; LS_CACHE.clear(); return out; });
      check('Top and tail: the load is set down standing up – crane radius at set from the lift steps, the tail crane off the hook (carries nothing), upright in the elevation, round in plan; "Load at set" can make it level', g.auto === 90 && Math.abs(g.r1[0] - g.r1[1]) < 0.05 && g.share[1] === 0 && g.share[0] > 30 && g.rel && g.upright && g.round && g.field && g.level, JSON.stringify(g));
      check('No script errors with the load standing at set', !p._errs.length, p._errs.slice(0, 3).join(' | '));
    }
    // ---------- 15. Play lift plays the lift steps (top and tail with cranes, with a forklift) and leaves the plan as it was ----------
    {
      p = await b.newPage({ viewport: { width: 1500, height: 950 } }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
      await p.goto('file://' + FILE + '?local'); await p.waitForTimeout(900); const res = [];
      for (const si of [0, 3]) {
        // another plan first, then this one: a reopened plan must play its own objects, not cached ones from before
        await p.evaluate(si => { if ($('dStart').open) $('dStart').close(); openPlan(clone(SAMPLE_PLANS[si].plan)); renderAll(); liftSteps(plan.loads[0]); openPlan(clone(SAMPLE_PLANS[(si + 1) % 4].plan)); renderAll(); openPlan(clone(SAMPLE_PLANS[si].plan)); renderAll(); }, si);
        await p.getByRole('button', { name: '3D', exact: true }).first().click(); await p.waitForTimeout(600);
        const before = await p.evaluate(() => JSON.stringify([plan.loads.map(l => l.pick), plan.cranes.map(c => [c.tip || null, c.L]), plan.obstacles.filter(o => o.fl).map(o => [o.x, o.y, o.rot])]));
        await p.evaluate(() => lpStart(false)); await p.waitForTimeout(300);
        const mid = await p.evaluate(async () => { const out = { seq: !!LP.steps[0].seq, n: LP.steps[0].phases.length, steps: liftSteps(plan.loads[0]).steps.length, caps: [] };
          for (const f of [0.3, 0.6, 0.95]) { LP.paused = true; LP.tPause = lpTotal() * f; LP.built = false; await new Promise(r => setTimeout(r, 500)); out.caps.push(/step|done/i.test($('lpCap').innerText) && LS_DRAW === null); }
          out.tilt = LP.seqCur ? LP.seqCur.s.tilt : null; out.own = !!LP.seqCur && LP.seqCur.L.ld === plan.loads[0] && LP.seqCur.L.cranes.every(c => plan.cranes.includes(c));
          const cap = $('lpCap').getBoundingClientRect(), v = $('view3d').getBoundingClientRect(); out.footer = Math.abs(cap.bottom - v.bottom) < 3 && cap.width > v.width * 0.9 && cap.height < v.height * 0.2; out.still = !!LP.still; return out; });
        await p.evaluate(() => lpStop()); await p.waitForTimeout(300);
        const after = await p.evaluate(() => JSON.stringify([plan.loads.map(l => l.pick), plan.cranes.map(c => [c.tip || null, c.L]), plan.obstacles.filter(o => o.fl).map(o => [o.x, o.y, o.rot])]));
        res.push({ ...mid, same: before === after }); }
      check('Play lift plays the lift steps (cranes top and tail, crane + forklift): one move per step, upright by the end, plan untouched after', res.every(r => r.seq && r.n === r.steps + 1 && r.caps.every(Boolean) && r.tilt >= 89 && r.same && r.own && r.footer && r.still), JSON.stringify(res));
      check('No script errors while playing the lift steps', !p._errs.length, p._errs.slice(0, 3).join(' | '));
    }
    // ---------- 16. the crane's check through the lift follows the lift steps; sheets never print a company mark in equipment names ----------
    {
      p = await b.newPage({ viewport: { width: 1500, height: 950 } }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
      await p.goto('file://' + FILE + '?local'); await p.waitForTimeout(900);
      const g = await p.evaluate(async () => { openPlan(clone(SAMPLE_PLANS[0].plan)); const ld = plan.loads[0]; ld.set = { h: 0, x: -3, y: -24.85, rot: 90 }; ld.travelDir = 'ccw'; renderAll();
        const S = craneSummary(plan.cranes[0]); const out = { noCap: S.warn.some(w => /no chart capacity/.test(w)), steps: !!S.seq?.steps, rows: S.seq?.rows.length || 0, way: (S.seq?.rows || []).filter(r => /on the way/.test(r.name)).length };
        // a plan whose rigging still carries the old company-marked names, numbered by the user with the company prefix
        const q = blankPlan(); q.name = 'SSB-099'; q.meta.lift = 'SSB-099 test'; openPlan(q); const l = { ...clone(LOAD_PRESETS.box), id: uid(), name: 'Box', weight: 10, pick: { x: 0, y: 0, rot: 0, h: 0 }, set: { x: 5, y: 0, rot: 0, h: 0 } }; plan.loads.push(l); normLoad(l);
        addCraneOf('XCA230'); plan.cranes[0].attach = { load: l.id, point: 'C' }; plan.cranes[0].x = -12; ensureRig(l); const e = (l.rig.top || l.rig.leg || [])[0]; if (e) { e.snap = { ...(e.snap || {}), name: 'SSB sling set leg – Ø54 mm wire' }; } renderAll();
        const sh = await buildSheets(), txt = sh.map(s => s.svg).join(' ');
        out.mark = />[^<]*\bSSB [^<]*</.test(txt); out.own = /SSB-099/.test(txt); out.lib = Object.values(REG.rigging || {}).filter(x => /^SSB /.test(x.name || '')).length; return out; });
      check('The crane\'s check through the lift follows the lift steps (each step and points along the swing) – no false "out of the chart"', !g.noCap && g.steps && g.rows >= 10 && g.way === 3, JSON.stringify(g));
      check('Sheets never print a company mark in equipment names; the user\'s own plan numbers stay', !g.mark && g.own && g.lib === 0, JSON.stringify(g));
      check('No script errors in the step-based checks', !p._errs.length, p._errs.slice(0, 3).join(' | '));
    }
    // ---------- 17. visual check fixes: cranes on each other, hook block overload, forklift set = where the column stands, rigging callouts ----------
    {
      p = await b.newPage({ viewport: { width: 1500, height: 950 } }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
      await p.goto('file://' + FILE + '?local'); await p.waitForTimeout(900);
      const g = await p.evaluate(async () => { const out = {};
        // two cranes set up on top of each other (the column sample as it was) → stop; close but clear with tails that can meet → warning
        openPlan(clone(SAMPLE_PLANS[1].plan)); renderAll(); out.clean = plan.cranes.map(c => craneSummary(c).warn.filter(w => /clash with|tail swing/.test(w)).length);
        const t = plan.cranes[1], mv = dx => { t.x += dx; for (const o of plan.obstacles) if (o.type === 'mat' && o.x > 6) o.x += dx; renderAll(); };
        mv(-1.5); const T = craneSummary(t); out.tail = T.warn.some(w => /tail swing \(R [\d.]+ m\) reaches Main crane/.test(w)) && !T.warn.some(w => /clash with/.test(w));   // the sample as it was
        mv(-3); const S = craneSummary(t); out.clash = S.status === 'bad' && S.warn.some(w => /clash with Main crane/.test(w));
        // hook block too small for the hook load → the crane is a stop, not "ok"
        openPlan(clone(SAMPLE_PLANS[1].plan)); const m = plan.cranes[0]; m.blockCap = 40; m.hookBlock = 0.45; renderAll(); const B = craneSummary(m); out.block = B.status === 'bad' && B.warn.some(w => /hook block/.test(w));
        // forklift: the steps end with the column standing at the set position, the set elevation has the hook over the top lug, no bridle at pick
        openPlan(clone(SAMPLE_PLANS[3].plan)); renderAll(); const ld = plan.loads[0], L = liftSteps(ld), e = L.steps[L.steps.length - 1];
        out.ftSet = Math.hypot(e.pose.x - ld.set.x, e.pose.y - ld.set.y) < 0.05 && !L.steps.some(s => /set position/.test(s.name));
        const ep = elevScene(plan.cranes[0], 'pick'), es = elevScene(plan.cranes[0], 'set'), txt = sc => sc.scene.items.filter(i => i.t === 'text').map(i => i.s).join('|');
        out.ftElev = /hook 2\.9 m/.test(txt(ep)) && /load bottom 0\.0 m/.test(txt(ep)) && !/-0\.0/.test(txt(ep) + txt(es));
        const tp = travelPath(ld); out.ftTravel = !tp || travelScene(ld, tp).items.length === 0;
        // a fresh forklift tail: lsAddForklift puts the set where the column will stand
        const q = clone(SAMPLE_PLANS[0].plan); openPlan(q); plan.cranes.splice(1); const l2 = plan.loads[0]; l2.set = { ...l2.pick }; lsAddForklift(l2); renderAll(); const L2 = liftSteps(l2), e2 = L2.steps[L2.steps.length - 1];
        out.ftNew = Math.hypot(e2.pose.x - l2.set.x, e2.pose.y - l2.set.y) < 0.05 && Math.hypot(l2.set.x - l2.pick.x, l2.set.y - l2.pick.y) > 5;
        // rigging sheet, load on two cranes: each hook block labelled with its own crane; left-end parts called out on the left (no leader across the load)
        openPlan(clone(SAMPLE_PLANS[0].plan)); renderAll(); const sh = await buildSheets(), r = sh.find(x => /rigging/.test(x.name)), svg = r ? r.svg : '';
        out.hooks = (svg.match(/HOOK BLOCK</g) || []).length; out.both = /Crane 1[^<]*HOOK BLOCK/.test(svg) && /Crane 2[^<]*HOOK BLOCK/.test(svg); out.leftCol = /text-anchor="end"[^>]*>(ROUND|MASTER|BOW|SHACKLE)/.test(svg);
        out.pp = /P1 · P2/.test(svg) || /P2 · P1/.test(svg);
        return out; });
      check('Two cranes set up on top of each other are a stop; tails that can meet are flagged; the samples are clear', g.clash && g.tail && g.clean.every(n => n === 0), JSON.stringify(g));
      check('A hook block or rope too small for the hook load makes the crane a stop', g.block, JSON.stringify(g));
      check('Top and tail with a forklift: set = where the column stands (steps end there, hook over the top lug, no bridle, no "slew 0°" travel)', g.ftSet && g.ftElev && g.ftTravel && g.ftNew, JSON.stringify(g));
      check('Rigging sheet for a load on two cranes: each crane\'s hook block called out, left-end parts on the left, end-on points labelled once', g.hooks === 2 && g.both && g.leftCol && g.pp, JSON.stringify(g));
      check('No script errors in the visual-check scenario', !p._errs.length, p._errs.slice(0, 3).join(' | '));
    }
  } catch (e) { check('Diagnostic run completed', false, e.message); }
  await b.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ date: new Date().toISOString(), file: FILE, results }, null, 1));
  const bad = results.filter(r => !r.ok).length; console.log(`\n${results.length - bad}/${results.length} checks passed · screenshots in ${OUT}`);
})();
