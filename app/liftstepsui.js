
// ---------------- the steps on the checks panel ----------------
function lsTableHTML(L, opt = {}) {
  const lim = L.lim, cls = u => u == null ? "" : u > 100 ? "bad" : u > lim ? "bad" : u > lim * 0.9 ? "amber" : "ok";
  return `<table class="lst"><tr><th>Step</th>${(L.units || L.cranes).map(c => `<th class="n" colspan="2">${escH(c.label || REG.cranes[c.model]?.short || "Crane")}</th>`).join("")}</tr>
    ${L.steps.map(s => `<tr class="${s.ok ? "" : "lsbad"}"><td>${s.no}. ${escH(s.name)}${s.tilt ? ` <span class="small">· ${fx(s.tilt, 0)}°</span>` : ""}${opt.full ? `<div class="small">load ${fx(s.h, 1)} m up${s.under ? ` · ${s.clear >= 0 ? fx(s.clear, 2) + " m over" : "runs into"} ${escH(s.under.name)}` : ""}</div>` : ""}</td>
      ${s.per.map(q => q.rel ? `<td class="n small" colspan="2">${q.fork ? "clear" : "off the hook"}</td>` : q.fork ? `<td class="n small">forks ${fx(q.forkH, 2)} m<br>${fx(q.used, 1)} t${q.design > q.geom + 0.01 ? "*" : ""}</td><td class="n"><span class="pill ${cls(q.util)}">${fx(q.util, 0)}%</span></td>` : `<td class="n small">R ${fx(q.R, 1)} m<br>${fx(q.used, 1)} t${q.design > q.geom + 0.01 ? "*" : ""}</td><td class="n"><span class="pill ${cls(q.util)}">${q.util != null ? fx(q.util, 0) + "%" : "–"}</span></td>`).join("")}</tr>`).join("")}</table>
    ${L.up ? `<p class="small" style="margin:2px 0 0">* checked for the design share: top crane ${rule("tt.top") ?? 100}%, ${L.ft ? `tailing forklift ${rule("tt.fork") ?? 75}%` : `tail crane ${rule("tt.tail") ?? 75}%`} of the load while both are on (Rules & limits).${L.ft ? ` Forklift capacity at the load centre is ~ (rated load carried by the load moment about the front axle – check the truck's plate).` : ""}</p>` : ""}`;
}
{ const st = document.createElement("style"); st.textContent = `table.lst{width:100%;font-size:11.5px;border-collapse:collapse}table.lst td,table.lst th{padding:2px 4px;border-bottom:1px solid var(--line)}table.lst th{text-align:left;font-weight:600}table.lst .n{text-align:right}table.lst tr.lsbad td:first-child{color:var(--bad)}`; document.head.append(st); }
{ const _rc = renderChecks; renderChecks = function (...a) { const r = _rc.apply(this, a);
    try { const box = $("checks"); if (!box || allMode) return r;
      for (const ld of plan.loads) {
        if (lsCranes(ld).length === 1 && !lsFork(ld) && loadDims(ld).x >= 6 && typeof FORKLIFTS !== "undefined") box.insertAdjacentHTML("beforeend", `<div class="card" style="margin-bottom:10px"><div class="ch"><b>Top and tail · ${escH(ld.name)}</b><button data-lsfork="${ld.id}">Tail with a forklift…</button></div><p class="small" style="padding:4px 10px 8px;margin:0">One crane on a long load: upend it with the crane on the top and a forklift holding the tail, checked step by step.</p></div>`);
        if (!lsTwo(ld) && !(Array.isArray(ld.steps) && ld.steps.length)) continue; const L = liftSteps(ld); if (!L) continue; const bad = L.steps.filter(s => !s.ok).length;
        box.insertAdjacentHTML("beforeend", `<div class="card" style="margin-bottom:10px${bad ? ";border-color:var(--bad)" : ""}"><div class="ch"><b>Lift steps · ${escH(ld.name)}</b><button data-lsedit="${ld.id}">Steps…</button></div>
          <p class="small" style="padding:4px 10px 0;margin:0">${L.ft ? "Top and tail upend – crane and forklift" : L.up ? "Top and tail upend" : L.cranes.length > 1 ? "Tandem lift" : "Lift"} in ${L.steps.length} steps${L.auto ? " (worked out by the app – change them under Steps…)" : ""}${bad ? ` · <b style="color:var(--bad)">${bad} step${bad > 1 ? "s" : ""} not OK</b>` : " · every step OK"}</p>
          <div style="padding:4px 10px 8px">${lsTableHTML(L)}</div></div>`); } } catch (e) { console.warn(e); }
    return r; }; }
document.addEventListener("click", e => { const b = e.target.closest("[data-lsedit]"); if (!b) return; e.preventDefault(); openLiftSteps(plan.loads.find(l => l.id === b.dataset.lsedit)); });
document.addEventListener("click", e => { const b = e.target.closest("[data-lsfork]"); if (!b) return; e.preventDefault(); const ld = plan.loads.find(l => l.id === b.dataset.lsfork); if (!ld) return;
  if (!lsAddForklift(ld)) return; delete ld.steps; markDirty(); renderAll(); openLiftSteps(ld); toast("Forklift placed at the tail – set how it holds the tail and its load centre in the Steps window", 5000); });

// ---------------- the steps window: change them, see each one ----------------
const LSV = { ld: null, sel: 0 };
(() => {
  if ($("dLs")) return; const d = document.createElement("dialog"); d.id = "dLs"; d.style.cssText = "width:min(1250px,97vw)";
  d.innerHTML = `<div class="dh"><b>Lift steps</b><span class="small" id="lsSub" style="margin-left:8px"></span><span style="flex:1"></span><label class="small" style="display:flex;align-items:center;gap:6px;margin-right:8px">Stage drawings<select id="lsStyle" style="width:auto"><option value="cad">CAD front elevation</option><option value="real">Realistic 3D</option></select></label><button id="lsAuto">Back to the app's steps</button><button data-close>Close</button></div><div class="db" id="lsBody"></div>`;
  document.body.append(d); d.querySelector("[data-close]").onclick = () => { d.close(); renderAll(); };
  $("lsAuto").onclick = () => { if (!LSV.ld) return; delete LSV.ld.steps; markDirty(); renderLs(); };
})();
function openLiftSteps(ld) { if (!ld) return; LSV.ld = ld; LSV.sel = 0; $("lsStyle").value = plan.meta.seqStyle || "cad"; $("lsStyle").onchange = () => { plan.meta.seqStyle = $("lsStyle").value; markDirty(); }; $("lsSub").textContent = ld.name || ""; renderLs(); $("dLs").showModal(); }
function renderLs() {
  const ld = LSV.ld, L = liftSteps(ld); if (!L) { $("lsBody").innerHTML = `<p class="small">Hook a crane on to this load first.</p>`; return; }
  const S = lsSteps(ld), s = L.steps[Math.min(LSV.sel, L.steps.length - 1)], two = L.cranes.length > 1 || !!L.ft;
  const hOpt = v => [["pick", "at the pick height"], ["lift", "1 m up"], ["carry", `carry height (${fx(L.carry.H, 1)} m)`], ["set", "at the set height"]].map(([k, n]) => `<option value="${k}" ${v === k ? "selected" : ""}>${n}</option>`).join("") + `<option value="num" ${typeof v === "number" ? "selected" : ""}>height…</option>`;
  const rows = S.map((x, i) => `<tr data-lsi="${i}" class="${i === LSV.sel ? "lssel" : ""}"><td>${i + 1}</td><td style="white-space:normal;min-width:140px"><input type="text" data-lsf="name" value="${escH(x.name || "")}"></td>
      <td><input type="number" data-lsf="t" min="0" max="100" step="5" value="${Math.round((+x.t || 0) * 100)}" style="width:62px"> %</td>
      <td><select data-lsf="h">${hOpt(x.h)}</select>${typeof x.h === "number" ? `<input type="number" data-lsf="hn" step="0.1" value="${x.h}" style="width:62px"> m` : ""}</td>
      <td><input type="number" data-lsf="tilt" step="5" value="${+x.tilt || 0}" style="width:58px">°</td>
      ${two ? `<td><select data-lsf="release"><option value="">both on</option>${(L.units || L.cranes).map(c => `<option value="${c.attach?.point || "C"}" ${x.release === (c.attach?.point || "C") ? "selected" : ""}>${escH(c.label || "crane")} off</option>`).join("")}</select></td>` : ""}
      <td style="white-space:nowrap"><button class="rmv" data-lsup ${i ? "" : "disabled"}>▲</button><button class="rmv" data-lsdel>×</button></td></tr>`).join("");
  $("lsBody").innerHTML = `<div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:12px">
    <div><p class="small" style="margin:0 0 6px">Each step: where along the way from pick to set (0 % = at the pick, 100 % = over the set position), how high the load is, how far it is turned up (upending) and which crane is off the hook. ${L.auto ? "These are the app's steps for this lift – change any and they become yours." : "Your steps – “Back to the app's steps” starts again."}</p>
      <table class="lse"><tr><th>#</th><th>Step</th><th>Along</th><th>Height</th><th>Turned up</th>${two ? "<th>Cranes</th>" : ""}<th></th></tr>${rows}</table>
      <div class="btnrow" style="margin-top:6px"><button id="lsAdd">+ Add a step after the one picked</button>${two && lsBuild2(ld) ? `<label class="chk" style="display:flex;flex-direction:row;gap:6px;align-items:center;margin-left:8px"><input type="checkbox" id="lsUp" ${L.up ? "checked" : ""} style="width:auto;margin:0"> top and tail upend</label>` : ""}</div>
      <div style="margin-top:10px">${lsTableHTML(L, { full: true })}</div>${L.ft ? lsForkPanel(L) : ""}</div>
    <div><div class="small" style="margin-bottom:4px"><b>Step ${s.no} – ${escH(s.name)}</b></div><div id="lsDraw" style="min-height:330px;border:1px solid var(--line);border-radius:6px;background:#fff"><p class="small" style="padding:10px">Drawing step…</p></div>
      <table class="lst" style="margin-top:6px"><tr><th></th>${s.per.map(q => `<th class="n">${escH(q.c.label || "Crane")}</th>`).join("")}</tr>
        ${[["Radius", q => fx(q.R, 2) + " m"], ["Slew (bearing)", q => fx(q.brg, 0) + "°"], ["Boom angle", q => q.ba.ok ? fx(q.ba.theta, 1) + "°" : "–"], ["Hook height / most", q => `${fx(q.z, 1)} / ${q.hMax != null ? fx(q.hMax, 1) : "–"} m`],
           ["Share from the rigging", q => q.rel ? "off" : fx(q.geom, 2) + " t"], ["Design share", q => q.design ? `${fx(q.design, 2)} t (${q.dWhy})` : "–"], ["Hook load (+ block)", q => q.rel ? "–" : fx(q.hookLoad, 2) + " t"],
           ["Chart capacity", q => q.cap != null ? fx(q.cap, 1) + " t" + (q.rUsed ? ` (row ${fx(q.rUsed, 1)} m)` : "") : "–"], ["From the last step", q => escH((lsMoves(L.steps[s.no - 2], s).find(m => m.q === q) || {}).txt || "")], ["Use", q => q.rel ? "–" : q.util != null ? `<b style="color:${q.util > L.lim ? "var(--bad)" : "inherit"}">${fx(q.util, 0)}%</b>` : "–"]].map(([n, f]) => `<tr><td>${n}</td>${s.per.map(q => `<td class="n">${q.fork ? lsForkCell(n, q, L, s) : f(q)}</td>`).join("")}</tr>`).join("")}</table>
      <p class="small">${s.under ? (s.clear >= 0 ? `The load is ${fx(s.clear, 2)} m over ${escH(s.under.name)} (${fx(s.under.top, 1)} m high).` : `<b style="color:var(--bad)">The load runs into ${escH(s.under.name)} (${fx(s.under.top, 1)} m high).</b>`) : "Nothing under the load at this step."}</p></div></div>`;
  const st = document.getElementById("lsCss") || Object.assign(document.createElement("style"), { id: "lsCss" }); st.textContent = `table.lse{width:100%;font-size:12px;border-collapse:collapse}table.lse td,table.lse th{white-space:nowrap;padding:2px 3px;border-bottom:1px solid var(--line);text-align:left}table.lse input[type=text]{width:100%}table.lse select{width:auto;max-width:128px}table.lse input[type=number]{padding:4px}table.lse tr.lssel{background:rgba(217,102,31,.08)}table.lse tr{cursor:pointer}`; document.head.append(st);
  { const tok = LSV.tok = (LSV.tok || 0) + 1; setTimeout(async () => { try { if (tok !== LSV.tok) return; const pl = await lsPlanSVG(L, s, 14); if (tok !== LSV.tok) return;
      if (L.ft) { const W = 1100, H = 700, pic = await lsCadFront(L, s, W, H); if (tok !== LSV.tok || !$("lsDraw")) return;
        $("lsDraw").innerHTML = `<div style="border-bottom:1px solid var(--line)">${pl.replace(/^<svg /, '<svg style="width:100%;height:auto;display:block" ')}</div><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">${pic.svg}${lsCallouts([...lsStageLabels(L, s, pic.proj), ...(pic.extra || [])], pic.occ, 0, 0, W, H, escH)}</svg>`; return; }
      const el = await lsElevSVGs(L, s, 14); if (tok !== LSV.tok || !$("lsDraw")) return;
      const fit = v => v.replace(/^<svg /, '<svg style="width:100%;height:auto;display:block" ');
      $("lsDraw").innerHTML = `<div style="border-bottom:1px solid var(--line)">${fit(pl)}</div><div style="display:grid;grid-template-columns:repeat(${el.length},minmax(0,1fr))">${el.map(E => E ? `<div style="border-left:1px solid var(--line)">${fit(E.svg)}</div>` : "<div></div>").join("")}</div>`;
      } catch (e) { console.warn(e); } }, 0); }
  const own = () => { if (!(Array.isArray(ld.steps) && ld.steps.length)) ld.steps = clone(lsAutoSteps(ld)); return ld.steps; };
  $("lsBody").querySelectorAll("tr[data-lsi]").forEach(tr => { const i = +tr.dataset.lsi;
    tr.addEventListener("click", e => { if (e.target.closest("input,select,button")) return; LSV.sel = i; renderLs(); });
    tr.querySelectorAll("[data-lsf]").forEach(el => el.onchange = () => { const st = own(), x = st[i], f = el.dataset.lsf;
      if (f === "name") x.name = el.value; else if (f === "t") x.t = Math.max(0, Math.min(100, +el.value || 0)) / 100; else if (f === "tilt") x.tilt = +el.value || 0;
      else if (f === "h") x.h = el.value === "num" ? (+liftSteps(ld)?.steps[i]?.h || 1) : el.value; else if (f === "hn") x.h = +el.value || 0; else if (f === "release") { if (el.value) x.release = el.value; else delete x.release; }
      LSV.sel = i; markDirty(); renderLs(); });
    const up = tr.querySelector("[data-lsup]"); if (up) up.onclick = () => { const st = own(); if (!i) return; [st[i - 1], st[i]] = [st[i], st[i - 1]]; LSV.sel = i - 1; markDirty(); renderLs(); };
    tr.querySelector("[data-lsdel]").onclick = () => { const st = own(); st.splice(i, 1); LSV.sel = Math.max(0, i - 1); markDirty(); renderLs(); }; });
  $("lsAdd").onclick = () => { const st = own(), cur = st[LSV.sel] || st[st.length - 1]; st.splice(LSV.sel + 1, 0, { ...clone(cur), name: "New step" }); LSV.sel++; markDirty(); renderLs(); };
  const u = $("lsUp"); if (u) u.onchange = () => { ld.upend = u.checked ? { to: 90 } : false; delete ld.steps; markDirty(); renderLs(); };
  if (L.ft) lsForkPanelWire(L);
}
// the forklift's numbers in the step table, and its settings
function lsForkCell(n, q, L, s) {
  if (q.rel) return /From the last/.test(n) ? escH((lsMoves(L.steps[s.no - 2], s).find(m => m.q === q) || {}).txt || "") : "–";
  const m = { "Radius": `load centre ${fx(q.cl * 1000, 0)} mm`, "Slew (bearing)": "–", "Boom angle": "–", "Hook height / most": `forks ${fx(q.forkH, 2)} / ${fx(q.h3, 2)} m`, "Share from the rigging": fx(q.geom, 2) + " t",
    "Design share": q.design ? `${fx(q.design, 2)} t (${q.dWhy})` : "–", "Hook load (+ block)": `${fx(q.hookLoad, 2)} t on the forks`, "Chart capacity": `~${fx(q.cap, 1)} t at ${fx(q.cl * 1000, 0)} mm`,
    "From the last step": escH((lsMoves(L.steps[s.no - 2], s).find(x => x.q === q) || {}).txt || ""), "Use": `<b style="color:${q.util > L.flim || q.axles[1] <= 0 ? "var(--bad)" : "inherit"}">${fx(q.util, 0)}%</b><div class="small">axles ${fx(q.axles[0], 1)} / ${fx(q.axles[1], 1)} t</div>` };
  return m[n] ?? "–";
}
function lsForkPanel(L) {
  const o = L.fork, f = o.fl, F = L.F;
  return `<div class="card" style="margin-top:10px;padding:8px 10px"><b>Tailing forklift</b> <span class="small">– ${escH(F.src)}</span>
    <div class="btnrow" style="flex-wrap:wrap;gap:8px;margin-top:6px;align-items:end">
      <label class="small">Forklift<select id="lfModel">${Object.values(FORKLIFTS).map(m => `<option value="${m.id}" ${m.id === f.model ? "selected" : ""}>${escH(m.name)} (${fx(m.Q, 1)} t @ ${fx(m.c0 * 1000, 0)} mm)</option>`).join("")}</select></label>
      <label class="small">Holds the tail<select id="lfHow"><option value="forks" ${f.how !== "hook" ? "selected" : ""}>on the forks (cradle)</option><option value="hook" ${f.how === "hook" ? "selected" : ""}>fork-mounted lifting hook</option></select></label>
      <label class="small">Load centre (mm)<input type="number" id="lfC" step="50" min="${F.c0 * 1000}" value="${Math.round((+f.c || F.c0) * 1000)}" style="width:90px"></label>
      <label class="small">Attachment / cradle (t)<input type="number" id="lfAtt" step="0.05" min="0" value="${+f.attW || 0}" style="width:80px"></label>
      <button id="lfDel" class="rmv" title="Take the forklift off this lift">Remove forklift</button></div>
    <p class="small" style="margin:6px 0 0">Rated ${fx(F.Q, 1)} t at ${fx(F.c0 * 1000, 0)} mm; at ${fx((+f.c || F.c0) * 1000, 0)} mm ~${fx(flCap(F, +f.c || F.c0, f.mast), 1)} t. Checked for at least ${rule("tt.fork") ?? 75}% of the load while it holds the tail (Rules & limits), with the rear axle kept loaded.</p></div>`;
}
function lsForkPanelWire(L) {
  const o = L.fork, f = o.fl, upd = () => { markDirty(); renderAll(); renderLs(); };
  $("lfModel").onchange = () => { f.model = $("lfModel").value; const F = FORKLIFTS[f.model]; o.w = F.l2; o.h = F.b; o.hgt = F.h6; o.label = `Forklift – ${F.name}`; upd(); };
  $("lfHow").onchange = () => { f.how = $("lfHow").value; upd(); };
  $("lfC").onchange = () => { f.c = Math.max(L.F.c0, (+$("lfC").value || 0) / 1000); upd(); };
  $("lfAtt").onchange = () => { f.attW = Math.max(0, +$("lfAtt").value || 0); upd(); };
  $("lfDel").onclick = () => { plan.obstacles = plan.obstacles.filter(x => x !== o); delete L.ld.steps; markDirty(); renderAll(); renderLs(); };
}
