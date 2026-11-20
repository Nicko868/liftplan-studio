// ================= Rigging builder – ONE list, top → bottom =================
// Everything from the crane hook down in the order it is rigged. A spreader in the list carries its own set-up:
// padeyes, slings from each padeye and bags on each sling. Everything under the spreader hangs from each padeye.
const isSling = e => !!RIG_TYPES[e?.snap?.type]?.sling, isBeam = e => e?.snap?.type === "spreader";
const chainBeams = C => C.map((e, i) => isBeam(e) ? i : -1).filter(i => i >= 0).slice(0, 2);
// first-to-last padeye left blank = spread to suit: over the bags it carries, otherwise the beam length less 0.5 m
function autoPadSpan(B, ld, isLast, blankOnly) {
  const c = B.cfg || {}; if (c.padSpan !== "" && c.padSpan != null && !blankOnly) return +c.padSpan;
  const n = Math.max(1, Math.round(+c.padN || 2));
  if (isLast && ld?.kind === "bag") return Math.round((n - 1) * (nz(ld.L) + Math.max(0, +ld.gap || 0)) * 100) / 100;
  return Math.max(0.5, (+B.len || 4) - 0.5);
}
// turn the list into the solver's tiers (hook gear, legs, beam, padeye gear, drops, lower beam …)
function compileChain(R, ld) {
  // spreaders are all kept simple: length, top padeyes spacing, bottom padeyes (number + spacing), SWL, weight – no rating-table cases
  for (const B of (R.chain || []).filter(isBeam)) if (B.snap?.pad) { B.cfg = B.cfg || {}; if (B.cfg.padSpan === "" || B.cfg.padSpan == null) B.cfg.padSpan = +B.len || ""; if (B.cfg.topSpan === "" || B.cfg.topSpan == null) B.cfg.topSpan = +B.top || ""; B.len = +B.snap.len || B.len; delete B.snap.pad; delete B.top; }
  const C = R.chain || [], S = chainBeams(C), fs = seg => seg.findIndex(isSling), bagLd = ld?.kind === "bag";
  const seg0 = S.length ? C.slice(0, S[0]) : C, i0 = fs(seg0), sl0 = i0 >= 0 ? seg0[i0] : null;
  R.top = i0 < 0 ? seg0.slice() : seg0.slice(0, i0); R.leg = i0 < 0 ? [] : seg0.slice(i0);
  R.legN = sl0 ? Math.max(1, Math.min(4, +sl0.legs || (S.length ? 2 : 1))) : 1;
  const lvl = (B, seg, isLast) => { const c = B.cfg || (B.cfg = {}), k = fs(seg);
    const pad = B.snap?.pad;
    return { padN: c.padN ?? 2, padSpan: pad ? (+B.len || pad.low[0]) : autoPadSpan(B, ld, isLast), topSpan: pad ? (+B.top || pad.top[0]) : (c.topSpan ?? ""), padX: c.padX || "", dropN: c.perPad || 1, bagsPer: Math.max(1, +c.bagsPer || 1), dropY: c.dropY ?? "",
      dropTo: isLast ? (bagLd && c.bagsPer !== 0 ? "bags" : "points") : "beam", pad: k < 0 ? seg.slice() : seg.slice(0, k), drop: k < 0 ? [] : seg.slice(k) }; };
  if (!S.length) { R.legTo = "load"; R.beam = null; R.beam2 = null; R.bagsPer = sl0 ? (sl0.bagsPer ?? 1) : 1; return R; }
  R.legTo = "beam"; R.beam = C[S[0]];
  const L0 = lvl(C[S[0]], C.slice(S[0] + 1, S.length > 1 ? S[1] : C.length), S.length === 1);
  Object.assign(R, { padN: L0.padN, padSpan: L0.padSpan, topSpan: L0.topSpan, padX: L0.padX, dropN: L0.dropN, bagsPer: L0.bagsPer, dropY: L0.dropY, dropTo: L0.dropTo, pad: L0.pad, drop: L0.drop });
  R.xbeam = S.length > 1 && !!(C[S[1]].cfg || {}).cross;
  if (S.length > 1) { const L1 = lvl(C[S[1]], C.slice(S[1] + 1), true); if (R.xbeam) { const c1 = C[S[1]].cfg || {}; if ((c1.padSpan === "" || c1.padSpan == null) && +ld?.spanY > 0) L1.padSpan = +ld.spanY; } R.beam2 = C[S[1]]; R.pad2 = L1.pad; R.drop2 = L1.drop; R.b2 = { padN: L1.padN, padSpan: L1.padSpan, topSpan: L1.topSpan, padX: L1.padX, dropN: L1.dropN, bagsPer: L1.bagsPer, dropY: L1.dropY, dropTo: L1.dropTo }; }
  else { R.beam2 = null; }
  return R;
}
// older built rigging (tiers) → one list
function chainFromFields(R, ld) {
  const C = [...(R.top || []), ...(R.leg || [])], s0 = C.find(isSling); if (s0) s0.legs = +R.legN || s0.legs || 1;
  if (R.legTo === "beam" && R.beam) {
    R.beam.cfg = { padN: +R.padN || 2, padSpan: ld?.kind === "bag" ? "" : (+R.padSpan || ""), topSpan: R.topSpan ?? "", padX: R.padX || "", perPad: +R.dropN || 1, bagsPer: +R.bagsPer || 1, dropY: R.dropY ?? "" };
    C.push(R.beam, ...(R.pad || []), ...(R.drop || []));
    if (R.dropTo === "beam" && R.beam2) { const b = R.b2 || {}; R.beam2.cfg = { padN: +b.padN || 2, padSpan: ld?.kind === "bag" ? "" : (+b.padSpan || ""), topSpan: b.topSpan ?? "", padX: b.padX || "", perPad: +b.dropN || 1, bagsPer: +b.bagsPer || 1, dropY: b.dropY ?? "" }; C.push(R.beam2, ...(R.pad2 || []), ...(R.drop2 || [])); }
  } else if (s0) s0.bagsPer = +R.bagsPer || 1;
  return C;
}
// with bulk bags the rigging says how many bags there are: padeyes × slings × bags per sling (or legs × bags per leg)
function syncBagsToChain(ld, R) {
  if (ld.kind !== "bag" || !R.chain) return;
  const per = W1(ld), C = R.chain, S = chainBeams(C), last = S.length ? C[S[S.length - 1]] : null;
  let nx, ny;
  if (last && (last.cfg || {}).bagsPer === 0) { nx = 1; ny = 1; }
  else if (last) { const c = last.cfg || {}; nx = Math.max(1, Math.round(+c.padN || 2)); ny = Math.max(1, Math.round(+c.perPad || 1)) * Math.max(1, Math.round(+c.bagsPer || 1)); }
  else { const s0 = C.find(isSling), legs = Math.max(1, +s0?.legs || 1), k = s0?.bagsPer ?? 1; if (k === 0) { nx = 1; ny = 1; } else { const n = legs * Math.max(1, k); nx = n <= 2 ? n : Math.ceil(n / 2); ny = n <= 2 ? 1 : 2; } }
  if (+ld.nx !== nx || +ld.ny !== ny) { ld.nx = nx; ld.ny = ny; ld.weight = Math.round(per * bagN(ld) * 1000) / 1000; ld.bagW = per; ld._n = bagN(ld); }
}
{ const _sb = solveBuild; solveBuild = function (ld) { if (ld.rig?.chain) compileChain(ld.rig, ld); return _sb(ld); }; }

// where "on the load" starts: the tail of the last hanging group (legs, or the drops under the last spreader).
// Default: from the last sling when there are two or more (a chain leg + hook, then a wire choked round the load),
// otherwise the fittings after the only sling (shackles to the lugs). The planner can move the line up / down.
function loadSplit(R) {
  const C = R.chain || [], S = chainBeams(C), start = S.length ? S[S.length - 1] + 1 : 0;
  if (R.loadAt != null && +R.loadAt >= start && +R.loadAt <= C.length) return +R.loadAt;
  let li = -1; for (let i = C.length - 1; i >= start; i--) if (isSling(C[i])) { li = i; break; }
  if (li < 0) return C.length;
  return (C[li].hitch || "straight") !== "straight" ? li : li + 1;     // a sling round the load belongs to the load; one pulling straight on lugs hangs from the crane
}
const loadSling = R => { const C = R.chain || [], S = chainBeams(C), start = S.length ? S[S.length - 1] + 1 : 0; for (let i = C.length - 1; i >= start; i--) if (isSling(C[i])) return C[i]; return null; };
const HITCH_UI = [["straight", "To the lifting points", "shackle or hook on each lug / padeye"], ["choke", "Choke", "round the load, through its own eye"], ["dwchoke", "Double wrap choke", "two turns, then choked – best grip on pipe"], ["basket", "Basket", "under the load, both ends on the hook"], ["dwbasket", "Double wrap basket", "a full turn, then basket"]];
function hitchIcon(k) {
  const pipe = `<circle cx="20" cy="30" r="8" fill="#d7dde3" stroke="#6b7682" stroke-width="1.5"/>`, c = "#e0701f";
  const g = { straight: `<rect x="6" y="30" width="28" height="8" fill="#d7dde3" stroke="#6b7682" stroke-width="1.5"/><path d="M20 4 L11 26 M20 4 L29 26" stroke="${c}" stroke-width="2" fill="none"/><path d="M8 26h6M26 26h6" stroke="#2e9d4a" stroke-width="3"/>`,
    choke: `${pipe}<circle cx="20" cy="30" r="10" fill="none" stroke="${c}" stroke-width="2"/><path d="M20 4 L20 20" stroke="${c}" stroke-width="2"/><circle cx="20" cy="20" r="2.4" fill="${c}"/>`,
    dwchoke: `${pipe}<circle cx="20" cy="30" r="10" fill="none" stroke="${c}" stroke-width="2"/><circle cx="20" cy="30" r="12.5" fill="none" stroke="${c}" stroke-width="2"/><path d="M20 4 L20 17.5" stroke="${c}" stroke-width="2"/><circle cx="20" cy="17.5" r="2.4" fill="${c}"/>`,
    basket: `${pipe}<path d="M10 4 L10 30 A10 10 0 0 0 30 30 L30 4" fill="none" stroke="${c}" stroke-width="2"/>`,
    dwbasket: `${pipe}<circle cx="20" cy="30" r="10" fill="none" stroke="${c}" stroke-width="2"/><path d="M7.5 4 L7.5 30 A12.5 12.5 0 0 0 32.5 30 L32.5 4" fill="none" stroke="${c}" stroke-width="2"/>` };
  return `<svg viewBox="0 0 40 44" width="34" height="38">${g[k] || ""}</svg>`;
}
// ---------- the list editor ----------
const ADD_KINDS = [["masterlink", "Master link"], ["shackle", "Shackle"], ["hook", "Hook"], ["loadcell", "Load cell / load link"], ["swivel", "Swivel"], ["sling_round", "Round sling"], ["sling_wire", "Wire rope sling"], ["sling_chain", "Chain sling"], ["sling_web", "Webbing sling"], ["spreader", "Spreader beam"]];
function newChainEntry(kind, ld) {
  const W = Math.max(1, +ld.weight || 5);
  if (kind === "loadcell") return rigEntry(rigLibrary().filter(i => /load (cell|link)/i.test(i.name)).sort((a, b) => a.swl - b.swl).find(i => i.swl >= W) || rigLibrary().find(i => /load (cell|link)/i.test(i.name)));
  if (kind === "swivel") return rigEntry(rigLibrary().filter(i => /swivel/i.test(i.name)).sort((a, b) => a.swl - b.swl).find(i => i.swl >= W) || rigLibrary().find(i => /swivel/i.test(i.name)));
  if (kind === "spreader") { const e = rigEntry(pickItem("spreader", W, i => !i.pad && !/single hook/i.test(i.name))); e.len = e.len || 4; e.cfg = { padN: 2, padSpan: "", topSpan: "", perPad: 1, bagsPer: 1 }; return e; }
  const it = pickItem(kind, kind === "shackle" ? W / 2 : W / 2, kind === "shackle" ? std : null), e = rigEntry(it); if (RIG_TYPES[kind]?.sling) e.len = 3; return e;
}
function chainPanelHTML(ld, R, res) {
  const C = R.chain || [], S = chainBeams(C), bag = ld.kind === "bag", rowOf = e => res?.rows.find(r => r.entry === e);
  const firstSl = C.findIndex(isSling), lastBeam = S.length ? S[S.length - 1] : -1;
  const segName = i => { if (i < (firstSl < 0 ? C.length : firstSl) && (S[0] === undefined || i < S[0])) return "On the crane hook"; if (S[0] === undefined || i < S[0]) return "Legs"; if (i === S[0] || i === S[1]) return null; return S[1] !== undefined && i < S[1] ? "From each padeye of the upper beam" : "From each padeye"; };
  let lastSeg = "";
  const split = loadSplit(R), minSplit0 = S.length ? S[S.length - 1] + 1 : 0, ls = loadSling(R), lsRow = ls ? rowOf(ls) : null;
  const joinChk = C[split - 1] && C[split] && typeof joinRule === "function" ? (() => { try { return joinRule(C[split - 1], C[split], {}); } catch (e) { return null; } })() : null;
  const rowsArr = C.map((e, i) => {
    const sl = isSling(e), bm = isBeam(e), r = rowOf(e), c = e.cfg || {}, head = segName(i); let cap = "";
    if (head && head !== lastSeg) { cap = `<div class="ccap">${head}</div>`; lastSeg = head; } if (bm) lastSeg = "";
    const known = rigItem(e.id), f = (k, lab, v, a = 'type="number" step="0.1"') => `<label>${lab}<input ${a} data-cf="${k}" value="${escH(v ?? "")}"></label>`;
    const sel = `<select data-cf="item">${known ? "" : `<option value="${escH(e.id)}" selected>${escH(e.snap.name)} (saved)</option>`}${itemOptions(e.id, it => (bm ? it.type === "spreader" : sl ? RIG_TYPES[it.type]?.sling : !RIG_TYPES[it.type]?.sling && it.type !== "spreader"))}</select>`;
    let fields = "";
    const pad = false, prt = pad ? padRating(pad, +e.top || pad.top[0], +e.len || pad.low[0]) : null, bagsPerSel = `<label>Bags on each sling<select data-cf="cfg.bagsPer">${[[0, "All on one bag (its loops)"], [1, "1 bag"], [2, "2 bags"], [3, "3 bags"], [4, "4 bags"]].map(([v, t]) => `<option value="${v}" ${v === (c.bagsPer ?? 1) ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
    const nBags = c.bagsPer === 0 ? 1 : (c.padN ?? 2) * (c.perPad ?? 1) * (c.bagsPer ?? 1);
    if (pad) fields = `<div class="cbeam"><label>Upper padeyes (sling span)<select data-cf="top">${pad.top.map((v, k) => `<option value="${v}" ${k === prt.iu ? "selected" : ""}>${fx(v, 3)} m – case ${escH(pad.names?.[k] || String.fromCharCode(65 + k))}</option>`).join("")}</select></label>
        <label>Lower padeyes (load span) · rated <b>${fx(prt.cap)} t</b><select data-cf="len">${pad.low.map((v, k) => `<option value="${v}" ${k === prt.il ? "selected" : ""}>${fx(v, 3)} m – ${fx(+pad.cap[prt.iu][k])} t</option>`).join("")}</select></label><span></span>
        ${f("cfg.padN", "Lower padeyes used", c.padN ?? 2, 'type="number" min="1" max="24" step="1"')}${f("cfg.perPad", "Slings from each padeye", c.perPad ?? 1, 'type="number" min="1" max="4" step="1"')}${bag && i === lastBeam ? bagsPerSel : "<span></span>"}
        <div style="grid-column:1/-1">${padTable(e)}</div>
        <p class="bnote" style="grid-column:1/-1">${c.padN ?? 2} padeye${(c.padN ?? 2) > 1 ? "s" : ""} × ${c.perPad ?? 1} sling${(c.perPad ?? 1) > 1 ? "s" : ""}${bag && i === lastBeam ? (c.bagsPer === 0 ? " – all on <b>1 bag</b>" : ` × ${c.bagsPer ?? 1} bag${(c.bagsPer ?? 1) > 1 ? "s" : ""} = <b>${nBags} bags</b>`) : ` = <b>${(c.padN ?? 2) * (c.perPad ?? 1)} slings</b> under the bar`}. Everything listed below the bar hangs from each padeye.</p></div>`;
    else if (bm) fields = `<div class="cbeam">${f("len", "Beam length (m)", e.len ?? e.snap.len)}${f("cfg.padN", "Bottom padeyes", c.padN ?? 2, 'type="number" min="1" max="24" step="1"')}${f("cfg.perPad", "Slings from each padeye", c.perPad ?? 1, 'type="number" min="1" max="4" step="1"')}${bag && i === lastBeam ? bagsPerSel : ""}
        ${f("cfg.padSpan", "Bottom padeyes – first to last (m)", c.padSpan ?? "", `type="number" step="0.05" placeholder="${i === S[1] && c.cross && +ld.spanY > 0 ? fx(+ld.spanY, 2) + " – lifting points across" : fx(autoPadSpan(e, ld, i === lastBeam, 1), 2) + " – to suit"}"`)}${f("cfg.topSpan", "Top padeyes – spacing (m)", c.topSpan ?? "", 'type="number" step="0.05" placeholder="beam length"')}
        ${i === S[1] ? `<label style="grid-column:1/-1">How it hangs<select data-cf="cfg.cross"><option value="0" ${c.cross ? "" : "selected"}>In line, under the beam above</option><option value="1" ${c.cross ? "selected" : ""}>One under each bottom padeye of the beam above, turned across the load (cross spreader)</option></select></label>${c.cross ? `<p class="bnote" style="grid-column:1/-1">One cross spreader under each bottom padeye of the beam above. What is listed between the two beams (e.g. shackle + master link, then the 2 legs) is at each padeye of the beam above; the legs go to this beam's top padeyes. Its bottom padeyes are spaced to the lifting points across the load unless set here.</p>` : ""}` : ""}
        <details class="bmore" style="grid-column:1/-1"><summary>Exact padeye positions from the drawing</summary>${f("cfg.padX", "Metres from the centre, comma-separated", c.padX || "", 'type="text" placeholder="-3.15, -2.25, -1.35, -0.45, 0.45, 1.35, 2.25, 3.15"')}</details>
        <p class="bnote" style="grid-column:1/-1">${c.padN ?? 2} padeyes × ${c.perPad ?? 1} sling${(c.perPad ?? 1) > 1 ? "s" : ""}${bag && i === lastBeam ? (c.bagsPer === 0 ? " – all on <b>1 bag</b>" : ` × ${c.bagsPer ?? 1} bag${(c.bagsPer ?? 1) > 1 ? "s" : ""} = <b>${nBags} bags</b>`) : ` = <b>${(c.padN ?? 2) * (c.perPad ?? 1)} slings</b> under this beam`}. Everything listed below the beam hangs from each padeye.</p></div>`;
    else if (sl) fields = `<div class="cf">${f("len", "Length (m)", e.len ?? 3)}
        ${i === firstSl && (S[0] === undefined || i < S[0]) ? `<label>Legs<select data-cf="legs">${[1, 2, 3, 4].filter(n => !S.length || n <= 2 || n === +e.legs).map(n => `<option ${n === (+e.legs || (S.length ? 2 : 1)) ? "selected" : ""}>${n}</option>`).join("")}</select></label>${bag && !S.length ? `<label>Each leg takes<select data-cf="bagsPer">${[[0, "Loops of one bag"], [1, "1 bag"], [2, "2 bags"], [3, "3 bags"], [4, "4 bags"]].map(([v, t]) => `<option value="${v}" ${v === (e.bagsPer ?? 1) ? "selected" : ""}>${t}</option>`).join("")}</select></label>` : ""}` : ""}</div>`;
    else fields = `<div class="cf">${segName(i) === "On the crane hook" ? `<label>Qty<select data-cf="qty">${[1, 2, 3, 4].map(n => `<option ${n === (e.qty || 1) ? "selected" : ""}>${n}</option>`).join("")}</select></label>` : ""}</div>`;
    return `${cap}<div class="crow ${bm ? "isbeam" : ""}" data-ci="${i}">
      <div class="ctop"><span class="cno">${i + 1}</span>${sel}<span class="cuse ${r && r.util > 100 ? "bad" : r && r.util > 90 ? "warn" : ""}">${r && r.util != null ? fx(r.util, 0) + "%" : ""}</span>
        <button class="rmv" data-cmv="-1" title="Move up" ${i ? "" : "disabled"}>▲</button><button class="rmv" data-cmv="1" title="Move down" ${i < C.length - 1 ? "" : "disabled"}>▼</button><button class="rmv" data-cins="${i}" title="Add below">+</button><button class="rmv" data-cdel="${i}" title="Remove">×</button>${i === split - 1 && i >= minSplit0 ? `<button class="rmv cmove" data-tosplit="${i}" title="This part goes on the load">↓ on the load</button>` : i === split ? `<button class="rmv cmove" data-tosplit="${i + 1}" title="This part hangs from the crane">↑ crane side</button>` : ""}</div>
      ${fields}
      <div class="cf csw"><label>SWL (t)<input type="number" step="0.01" data-cf="swl" value="${+e.snap.swl}"></label>${sl ? `<label>kg/m<input type="number" step="0.1" data-cf="wpm" value="${+((e.snap.wpm || 0) * 1000).toFixed(2)}"></label>` : `<label>Weight (kg)<input type="number" step="0.1" data-cf="wkg" value="${+((e.snap.weight || 0) * 1000).toFixed(1)}"></label>`}${r ? `<span class="bnote" style="align-self:end">${escH(r.where || "")}</span>` : ""}</div>
      ${RB.cins === i ? addBarHTML(i) : ""}</div>`;
  });
  const rowsCrane = rowsArr.slice(0, split).join(""), rowsLoad = rowsArr.slice(split).join("").replace(/<div class="ccap">[^<]*<\/div>/g, "");
  const nBad = (res?.checks || []).filter(c => c.lvl === "bad").length, nWarn = (res?.checks || []).filter(c => c.lvl === "warn").length, nOk = (res?.checks || []).filter(c => c.lvl === "ok").length;
  const chk = (res?.checks || []).map(c => c.head ? `<div class="bchk-h">${escH(c.head)}</div>` : `<div class="bchk ${c.lvl}"><span>${c.lvl === "ok" ? "✓" : c.lvl === "warn" ? "!" : "✕"}</span>${escH(c.text)}</div>`).join("");
  const P = allPts(ld), ptSel = (k, i, cur) => `<select data-ptsel="${k}" data-i="${i}"><option value="auto">Auto</option>${P.map(p => `<option value="${escH(p.k)}" ${cur === p.k ? "selected" : ""}>${escH(p.name)}</option>`).join("")}</select>`;
  const nCr = +R.cranes === 2 ? 2 : 1;
  return `<div class="bb bc">
    <div class="cload"><div><b>${escH(ld.name || "Load")}</b><span class="bnote"> · ${bag ? `${bagN(ld)} bag${bagN(ld) > 1 ? "s" : ""} × ${fx(W1(ld), 2)} t = ` : ""}${fx(+ld.weight || 0, 2)} t</span></div>
      ${!bag ? `<div class="cf"><label>Lifting points A–B apart (m)<input type="number" data-lp="span" step="0.05" value="${ld.span ?? 0}"></label><label>Across (m) – 4 points<input type="number" data-lp="spanY" step="0.05" value="${ld.spanY ?? 0}"></label><label>Height above load bottom (m)<input type="number" data-lp="lpZ" step="0.05" value="${fx(liftPointZ(ld), 2)}"></label><label>CoG offset → B (m)<input type="number" data-lp="cog" step="0.05" value="${ld.cog ?? 0}"></label><label>CoG height (m)<input type="number" data-lp="cogZ" step="0.05" min="0" value="${+ld.cogZ > 0 ? ld.cogZ : ""}" placeholder="half the height"></label></div>` : ""}
      ${bag ? `<div class="cf"><label>Weight of one bag (t)<input type="number" data-bk="bagW" step="0.01" value="${fx(W1(ld), 3)}"></label><label>Gap between bags (m)<input type="number" data-bk="gap" min="0" step="0.05" value="${+ld.gap || 0.1}"></label></div>` : ""}</div>
    <div class="clist"><div class="clh"><b>From the crane</b><span class="bnote">hook gear, legs${S.length ? ", spreader" : ""} – top to bottom</span></div>
      ${rowsCrane || `<p class="bnote">Nothing yet – start with what goes on the hook.</p>`}
      ${RB.cins === -2 ? addBarHTML(split - 1) : `<button class="badd" data-cins="-2">+ Add to the crane side</button>`}
      <div class="bsub">Cranes</div>        <span class="seg bseg">${[[1, "One crane"], [2, "Two cranes – tandem / top & tail"]].map(([v, t]) => `<button data-bsel="cranes" data-v="${v}" aria-pressed="${nCr === v}">${t}</button>`).join("")}</span>
              ${nCr === 2 ? crBHTML(R, res) : ""}</div>
    <div class="cjoin"><span>${C[split - 1] ? escH(C[split - 1].snap.name) : "crane hook"}</span><b>connects to</b><span>${C[split] ? escH(C[split].snap.name) : ls ? "the load – " + escH((HITCH[ls.hitch || "straight"] || {}).name || "") : "the lifting points"}</span>${joinChk ? `<i class="bchk ${joinChk.lvl}" title="${escH(joinChk.text)}">${joinChk.lvl === "ok" ? "✓" : joinChk.lvl === "warn" ? "!" : "✕"}</i>` : ""}</div>
    <div class="clist cload2"><div class="clh"><b>On the load</b><span class="bnote">how each leg holds the load</span></div>
      ${ls ? `<div class="hitchpick">${HITCH_UI.filter(([k]) => !(bag && (k === "dwchoke" || k === "dwbasket"))).map(([k, n, d]) => `<button data-hitch="${k}" aria-pressed="${(ls.hitch || "straight") === k}" title="${escH(d)}">${hitchIcon(k)}<b>${n}</b></button>`).join("")}</div>
        ${ls.hitch === "choke" || ls.hitch === "dwchoke" ? `<div class="cf"><label>Angle of choke<select data-lsf="chokeAng">${CHOKE_ANG.map(c => `<option value="${c[0]}" ${(+ls.chokeAng || 120) >= c[0] && ((+ls.chokeAng || 120) < (CHOKE_ANG[CHOKE_ANG.indexOf(c) - 1]?.[0] ?? 999)) ? "selected" : ""}>${c[2]} – × ${c[1]}</option>`).join("")}</select></label></div>` : ""}
        ${lsRow ? `<div class="hfact"><b>${escH(ls.snap.name)}</b> · SWL ${fx(+ls.snap.swl)} t${(lsRow.hitchParts || []).map(q => ` × ${q[1]} <span class="bnote">(${escH(q[0])})</span>`).join("")} = <b>${fx(lsRow.swl, 2)} t</b> · takes ${fx(lsRow.load, 2)} t <span class="${lsRow.util > 100 ? "bbad" : ""}">(${fx(lsRow.util, 0)}%)</span>${ls.hitch === "basket" || ls.hitch === "dwbasket" ? `<br><span class="bnote">Basket: each side is checked on its own, so the sling angle is included.</span>` : ""}</div>` : ""}` : `<p class="bnote">Add a sling to choose how it holds the load.</p>`}
      <details class="cwhere" ${RB.whereOpen || nCr === 2 || +R.tilt || (ld.pts || []).length ? "open" : ""}><summary><b>Where it connects on the load</b> <span class="bnote">lifting points for each leg${nCr === 2 ? " and each crane" : ""} · your own points · tilt for upending</span></summary>
        ${!S.length && firstSl >= 0 && !(bag && bagN(ld) > 1) ? `<div class="bsub">Where each leg connects</div><div class="ptgrid">${Array.from({ length: +R.legN || 1 }, (_, i) => `<label>${nCr === 2 ? "Crane A – leg" : "Leg"} ${i + 1}${ptSel("legPts", i, (R.legPts || [])[i])}</label>`).join("")}</div>` : ""}
        ${nCr === 2 && !S.length ? `<div class="ptgrid"><label>Crane B – leg to${ptSel("legPtsB", 0, (R.legPtsB || [])[0])}</label></div>` : ""}
        <div class="bsub">Your own lifting points</div>
        ${(ld.pts || []).length ? `<div class="pthead"><span></span><span>Name</span><span>Along (m)</span><span>Across (m)</span><span>Height (m)</span><span>Round</span><span></span></div>` : ""}
        ${(ld.pts || []).map((p, i) => `<div class="ptrow" data-pt="${i}"><b>${escH(p.k)}</b><input type="text" data-pf="name" value="${escH(p.name || "")}" placeholder="e.g. top lug"><input type="number" data-pf="x" step="0.05" value="${fx(p.x, 2)}"><input type="number" data-pf="y" step="0.05" value="${fx(p.y, 2)}"><input type="number" data-pf="z" step="0.05" value="${fx(p.z, 2)}"><input type="checkbox" data-pf="wrap" title="The sling goes round the load here (choke or basket)" ${p.wrap ? "checked" : ""}><button data-ptdel="${i}" title="Remove">×</button></div>`).join("")}
        <div class="btnrow"><button id="bpAdd" class="${RB.addPt ? "pri" : ""}">${RB.addPt ? "Now click the front view… (Esc to stop)" : "+ Click on the load"}</button><button id="bpAddNum">+ Type one in</button></div>
        <div class="bsub">Upending / top &amp; tail</div>
        <div class="cf"><label>Tilt (°) – + raises end A<input type="number" data-rk="tilt" step="5" value="${+R.tilt || 0}"></label></div>
      </details>
      ${rowsLoad || `<p class="bnote">Nothing here yet – add what goes on the load: the sling choked / basketed round it, or the shackles on its lugs.</p>`}
      ${RB.cins === -1 ? addBarHTML(C.length - 1) : `<button class="badd" data-cins="-1">+ Add to the load</button>`}</div>
    <details class="tier bchecks" ${nBad ? "open" : ""}><summary class="thead"><span class="tnum">✓</span><span class="ttxt"><b>Connection check</b><span>${nOk} OK${nWarn ? ` · ${nWarn} to check` : ""}${nBad ? ` · <b class="bbad">${nBad} not allowed</b>` : ""}</span></span><span class="tchev">▾</span></summary>
      <div class="tbody"><div class="bchks">${chk || `<p class="bnote">Add parts to check how they join.</p>`}</div></div></details>

    <div class="btnrow"><button id="rbSize">Size everything for this load (≤ 90% SWL)</button></div>
  </div>`;
}
function addBarHTML(i) { return `<div class="caddbar" data-at="${i}"><span class="bnote">Add below:</span>${ADD_KINDS.map(([k, n]) => `<button data-cadd="${k}">${n}</button>`).join("")}<button class="rmv" data-cins="x">Cancel</button></div>`; }
buildPanelHTML = function (ld, R, res) {
  if (!R.chain) R.chain = chainFromFields(R, ld);
  return chainPanelHTML(ld, R, res);
};
// wiring for the list
{ const _w = wireRB; wireRB = function () {
    _w();
    const R = RB.work.rig, root = $("rbLeft"); if (R?.arr !== "build" || !root.querySelector(".bc")) return;
    const ld = RB.work, C = R.chain, redo = () => { delete R.auto; compileChain(R, ld); syncBagsToChain(ld, R); renderRB(); };
    root.querySelectorAll(".crow").forEach(row => {
      const i = +row.dataset.ci, e = C[i];
      row.querySelectorAll("[data-cf]").forEach(el => el.onchange = () => {
        const f = el.dataset.cf, v = el.value;
        if (f === "item") { const it = rigItem(v); if (!it) return; const ne = rigEntry(it, { qty: e.qty, hitch: e.hitch }); if (isSling(ne)) { ne.len = isSling(e) ? e.len : 3; ne.legs = e.legs; ne.bagsPer = e.bagsPer; } if (isBeam(ne)) { ne.len = it.pad ? ne.len : (e.len || it.len); ne.cfg = e.cfg || { padN: 2, padSpan: Math.max(0.5, ne.len - 0.5), perPad: 1, bagsPer: 1 }; } C[i] = ne; }
        else if (f.startsWith("cfg.")) { const k = f.slice(4); e.cfg = e.cfg || {}; e.cfg[k] = el.type === "text" ? v : (v === "" ? "" : +v); if (k === "padN" || k === "padSpan") e.cfg.padX = e.cfg.padX && k !== "padN" ? e.cfg.padX : (k === "padN" ? "" : e.cfg.padX); }
        else if (f === "len") e.len = +v; else if (f === "top") e.top = +v; else if (f === "qty") e.qty = +v; else if (f === "legs") e.legs = +v; else if (f === "bagsPer") e.bagsPer = +v;
        else if (f === "hitch") { const [h, bf] = v.split(":"); e.hitch = h; if (bf) e.bf = +bf; else delete e.bf; }
        else if (f === "swl") e.snap.swl = +v; else if (f === "wkg") e.snap.weight = (+v || 0) / 1000; else if (f === "wpm") e.snap.wpm = (+v || 0) / 1000;
        redo();
      });
    });
    root.querySelectorAll("[data-cmv]").forEach(b => b.onclick = () => { const i = +b.closest(".crow").dataset.ci, j = i + +b.dataset.cmv; if (j < 0 || j >= C.length) return; [C[i], C[j]] = [C[j], C[i]]; redo(); });
    root.querySelectorAll("[data-cdel]").forEach(b => b.onclick = () => { const i = +b.dataset.cdel, sp = loadSplit(R); C.splice(i, 1); if (R.loadAt != null) R.loadAt = i < sp ? sp - 1 : sp; redo(); });
    root.querySelectorAll("[data-cins]").forEach(b => b.onclick = () => { const v = b.dataset.cins; RB.cins = v === "x" ? null : +v; renderRB(); });
    root.querySelectorAll("[data-tosplit]").forEach(b => b.onclick = () => { R.loadAt = +b.dataset.tosplit; renderRB(); });
    root.querySelectorAll("[data-hitch]").forEach(b => b.onclick = () => { const ls = loadSling(R); if (!ls) return; ls.hitch = b.dataset.hitch; delete ls.bf; const li = C.indexOf(ls), sp = loadSplit(R); if (ls.hitch !== "straight" && li < sp) R.loadAt = li; else if (ls.hitch === "straight" && li >= sp && R.loadAt == null) R.loadAt = li + 1; redo(); });
    root.querySelectorAll("[data-lsf]").forEach(el => el.onchange = () => { const ls = loadSling(R); if (!ls) return; ls[el.dataset.lsf] = +el.value; redo(); });
    root.querySelectorAll("[data-cadd]").forEach(b => b.onclick = () => { const at = +b.closest(".caddbar").dataset.at, ne = newChainEntry(b.dataset.cadd, ld); if (isSling(ne) && !C.some(isSling)) ne.legs = chainBeams(C).length ? 2 : 1; const sp = loadSplit(R), f0 = C.findIndex(isSling); if (isSling(ne) && f0 >= 0 && at + 1 <= f0) { ne.legs = C[f0].legs; C[f0].legs = 1; } C.splice(at + 1, 0, ne); R.loadAt = at < sp ? sp + 1 : sp; RB.cins = null; redo(); });
    const cw = root.querySelector(".cwhere"); if (cw) cw.ontoggle = () => { RB.whereOpen = cw.open; };
    if ($("rbSize")) $("rbSize").onclick = () => { sizeRig(RB.work); renderRB(); };
  }; }
// bag weight / gap edits keep the rigging-driven bag count
{ const _rb = renderRB; renderRB = function () { const R = RB.work?.rig; if (R?.arr === "build") { if (!R.chain) R.chain = chainFromFields(R, RB.work); compileChain(R, RB.work); syncBagsToChain(RB.work, R); } _rb(); }; }
// the drawing's pop-up edits parts in place; adding / removing there would bypass the list, so those buttons go
{ const _rp = renderRigPop; renderRigPop = function (svgEl, ld, res) { _rp(svgEl, ld, res); if (ld?.rig?.chain) { $("rpAddA")?.remove(); $("rpDel")?.remove(); } }; }

// a preset gives a starting list; the bag count follows it and the gear is sized once – after that nothing changes by itself
{ const _ap = applyPreset; applyPreset = function (ld, id) { const R = _ap(ld, id); if (R && R.arr === "build") { R.chain = chainFromFields(R, ld); compileChain(R, ld); syncBagsToChain(ld, R); sizeRig(ld); } return ld.rig; }; }

// every single-crane set-up is edited as the one list (hook → load); the standard set-ups are just starting lists
function stdToBuild(ld) {
  const R = ld.rig; if (!R || !["single", "bridle2", "bridle4", "spreader"].includes(R.arr)) return false;
  const legs = R.arr === "single" ? 1 : R.arr === "bridle4" ? 4 : 2, C = [...(R.top || []), ...(R.leg || [])], s0 = C.find(isSling), n = ld.kind === "bag" ? bagN(ld) : 0;
  if (s0) s0.legs = legs;
  if (R.arr === "spreader" && R.beam) {
    const B = R.beam, per = R.lower4 ? 2 : 1, grp = n > 1;
    // the standard set-ups keep the padeye span in the beam's length – in the list the beam is its real length and the span is its own field
    const span0 = +B.len || ""; if (!B.snap.pad) B.len = Math.max(+B.snap.len || 0, +span0 || 0) || B.len;
    B.cfg = { padN: grp ? Math.max(1, Math.round(+ld.nx || 2)) : 2, padSpan: B.cfg?.padSpan ?? span0, topSpan: B.cfg?.topSpan ?? (B.snap.pad ? "" : span0), perPad: grp ? Math.max(1, Math.min(4, Math.round(+ld.ny || 1))) : per, bagsPer: n === 1 ? 0 : 1, dropY: R.lower4 ? (+ld.spanY || "") : "" };
    const low = (R.lower || []).slice();
    // a sling never goes straight on a padeye: the standard set-ups list the lug shackle only, so add the padeye shackle
    if (low.length && isSling(low[0])) { const sh = low.find(e => e.snap.type === "shackle"); if (sh) low.unshift(clone(sh)); }
    C.push(B, ...low);
  } else if (s0 && n) s0.bagsPer = n === 1 ? 0 : (n % legs === 0 && n / legs <= 4 ? n / legs : 1);
  ld.rig = { arr: "build", chain: C, share4: R.share4 || 3, preset: R.preset, ...(R.auto ? { auto: true } : {}) };
  return true;
}
{ const _ap = applyPreset; applyPreset = function (ld, id) { _ap(ld, id); if (stdToBuild(ld)) { compileChain(ld.rig, ld); syncBagsToChain(ld, ld.rig); } return ld.rig; }; }
{ const _rb = renderRB; renderRB = function () { const ld = RB.work; if (ld?.rig) stdToBuild(ld); _rb(); }; }
// every redraw: bulk-bag totals follow the number of bags (weight of one bag × bags)
{ const _ra = renderAll; renderAll = function (...a) { for (const l of plan.loads || []) if (l.kind === "bag") normLoad(l); return _ra.apply(this, a); }; }

// ---------- crane B (tandem / top & tail): its own list, top → bottom, same look as crane A ----------
function chainB(R) { if (!R.chainB) R.chainB = [...(R.topB || []), ...(R.legB || [])]; return R.chainB; }
function compileB(R) { if (!R.chainB) return; const C = R.chainB, k = C.findIndex(isSling); R.topB = k < 0 ? C.slice() : C.slice(0, k); R.legB = k < 0 ? [] : C.slice(k); }
function crBHTML(R, res) {
  const C = chainB(R), k = C.findIndex(isSling), lastSl = (() => { for (let i = C.length - 1; i >= 0; i--) if (isSling(C[i])) return i; return -1; })(), rowOf = e => res?.rows.find(r => r.entry === e);
  const rows = C.map((e, i) => { const sl = isSling(e), r = rowOf(e), known = rigItem(e.id);
    const sel = `<select data-bf="item">${known ? "" : `<option value="${escH(e.id)}" selected>${escH(e.snap.name)} (saved)</option>`}${itemOptions(e.id, it => it.type !== "spreader")}</select>`;
    return `${i === 0 && k !== 0 ? `<div class="ccap">On crane B's hook</div>` : ""}${i === k ? `<div class="ccap">Crane B's leg</div>` : ""}<div class="crow" data-bi="${i}"><div class="ctop"><span class="cno">B${i + 1}</span>${sel}<span class="cuse ${r && r.util > 100 ? "bad" : r && r.util > 90 ? "warn" : ""}">${r && r.util != null ? fx(r.util, 0) + "%" : ""}</span>
      <button class="rmv" data-bmv="-1" ${i ? "" : "disabled"}>▲</button><button class="rmv" data-bmv="1" ${i < C.length - 1 ? "" : "disabled"}>▼</button><button class="rmv" data-bdel="${i}" title="Remove">×</button></div>
      <div class="cf">${sl ? `<label>Length (m)<input type="number" step="0.1" data-bf="len" value="${escH(e.len ?? 3)}"></label>${i === lastSl ? `<label>On the load<select data-bf="hitch">${hitchOptions(e)}</select></label>` : ""}` : k < 0 || i < k ? `<label>Qty<select data-bf="qty">${[1, 2, 3, 4].map(n => `<option ${n === (e.qty || 1) ? "selected" : ""}>${n}</option>`).join("")}</select></label>` : ""}
        <label>SWL (t)<input type="number" step="0.01" data-bf="swl" value="${+e.snap.swl}"></label>${sl ? `<label>kg/m<input type="number" step="0.1" data-bf="wpm" value="${+((e.snap.wpm || 0) * 1000).toFixed(2)}"></label>` : `<label>Weight (kg)<input type="number" step="0.1" data-bf="wkg" value="${+((e.snap.weight || 0) * 1000).toFixed(1)}"></label>`}${r ? `<span class="bnote" style="align-self:end">${escH(r.where || "")}</span>` : ""}</div></div>`; }).join("");
  return `<div class="bsub">Crane B – its own hook gear and leg</div><p class="bnote">The list above is crane A. Top & tail: crane A usually takes the top end, crane B the tail – pick the points under "Where it connects on the load".</p>
    ${rows || `<p class="bnote">Nothing on crane B yet.</p>`}
    <div class="caddbar" data-bat="1"><span class="bnote">Add to crane B:</span>${ADD_KINDS.filter(([k2]) => k2 !== "spreader").map(([k2, n]) => `<button data-badd="${k2}">${n}</button>`).join("")}</div>`;
}
{ const _cc = compileChain; compileChain = function (R, ld) { const r = _cc(R, ld); if (+R.cranes === 2) { chainB(R); compileB(R); } return r; }; }
{ const _w = wireRB; wireRB = function () {
    _w();
    const R = RB.work?.rig, root = $("rbLeft"); if (R?.arr !== "build" || +R.cranes !== 2 || !root || !root.querySelector(".bc")) return;
    const ld = RB.work, C = chainB(R), redo = () => { compileB(R); renderRB(); };
    root.querySelectorAll("[data-bi]").forEach(row => { const i = +row.dataset.bi, e = C[i];
      row.querySelectorAll("[data-bf]").forEach(el => el.onchange = () => { const f = el.dataset.bf, v = el.value;
        if (f === "item") { const it = rigItem(v); if (!it) return; const ne = rigEntry(it, { qty: e.qty, hitch: e.hitch }); if (isSling(ne)) ne.len = isSling(e) ? e.len : 3; C[i] = ne; }
        else if (f === "len") e.len = +v; else if (f === "qty") e.qty = +v; else if (f === "hitch") { e.hitch = v.split(":")[0]; delete e.bf; }
        else if (f === "swl") e.snap.swl = +v; else if (f === "wkg") e.snap.weight = (+v || 0) / 1000; else if (f === "wpm") e.snap.wpm = (+v || 0) / 1000;
        redo(); }); });
    root.querySelectorAll("[data-bmv]").forEach(b => b.onclick = () => { const i = +b.closest("[data-bi]").dataset.bi, j = i + +b.dataset.bmv; if (j < 0 || j >= C.length) return; [C[i], C[j]] = [C[j], C[i]]; redo(); });
    root.querySelectorAll("[data-bdel]").forEach(b => b.onclick = () => { C.splice(+b.dataset.bdel, 1); redo(); });
    root.querySelectorAll("[data-badd]").forEach(b => b.onclick = () => { C.push(newChainEntry(b.dataset.badd, ld)); redo(); });
  }; }
