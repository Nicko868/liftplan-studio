// ================= Shared storage (Supabase): staff sign-in, plans and libraries shared live =================
// Outside claude.ai the app saves to the team's Supabase project once signed in. CLOUD.db has the same shape as
// LOCAL.db (collection / doc / onSnapshot), so the rest of the app doesn't change; pictures stay inside the documents
// as in browser mode (CAP.local). Everything sits in one table, liftplan_docs (path = "<collection>/<id>", jsonb data);
// only signed-in staff can read or write it (row level security). "?local" in the address = this browser only.
// The publishable key below is meant to be public – the protection is the sign-in plus the table rules.
const SB_CONFIG = { url: "https://zsdacfyuongmebpdltcw.supabase.co", key: "sb_publishable_ChUe-Mj-_ikynWd5ce57HA_humJSbm4", table: "liftplan_docs" };
const CLOUD = (() => {
  if (typeof LOCAL === "undefined" || !LOCAL || !window.supabase || /[?&]local\b/.test(location.search)) return null;
  const T = SB_CONFIG.table;
  const sb = supabase.createClient(SB_CONFIG.url, SB_CONFIG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const C = { sb, user: null, state: "signed out", ready: null };
  let readyRes; C.ready = new Promise(r => readyRes = r);
  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const nameOf = u => (u && (u.user_metadata?.name || (u.email || "").split("@")[0])) || "";
  const collOf = path => path.slice(0, path.lastIndexOf("/"));

  // ---------- documents: a cache per collection, kept up to date by realtime ----------
  const cache = {}, listeners = {}, loading = {};
  const docsOf = coll => [...(cache[coll] || new Map()).entries()].map(([path, r]) => ({ id: path.slice(coll.length + 1), data: () => r.data }));
  const notify = coll => (listeners[coll] || []).forEach(cb => { try { cb({ docs: docsOf(coll) }); } catch (e) { console.warn(e); } });
  async function fetchColl(coll) {
    const m = new Map();
    for (let from = 0; ; from += 500) {
      const { data, error } = await sb.from(T).select("path,data,updated_at").eq("coll", coll).order("path").range(from, from + 499);
      if (error) throw error;
      data.forEach(r => m.set(r.path, { data: r.data, at: Date.parse(r.updated_at) }));
      if (data.length < 500) break;
    }
    cache[coll] = m; return m;
  }
  const loadColl = coll => cache[coll] ? Promise.resolve(cache[coll]) : (loading[coll] = loading[coll] || fetchColl(coll).finally(() => delete loading[coll]));
  const db = {
    collection: coll => ({
      onSnapshot: (cb, err) => {
        (listeners[coll] = listeners[coll] || []).push(cb);
        C.ready.then(() => loadColl(coll)).then(() => cb({ docs: docsOf(coll) })).catch(e => err && err(e));
        return () => { listeners[coll] = (listeners[coll] || []).filter(f => f !== cb); };
      },
      get: async () => { await C.ready; await loadColl(coll); return { docs: docsOf(coll) }; }
    }),
    doc: path => {
      const coll = collOf(path);
      return {
        set: async v => {
          await C.ready; const data = JSON.parse(JSON.stringify(v));
          const { data: row, error } = await sb.from(T).upsert({ path, coll, data, updated_at: new Date().toISOString(), updated_by: C.user.id }).select("updated_at").single();
          if (error) throw error;
          if (cache[coll]) { cache[coll].set(path, { data, at: Date.parse(row.updated_at) }); notify(coll); }
        },
        delete: async () => {
          await C.ready; const { error } = await sb.from(T).delete().eq("path", path);
          if (error) throw error;
          if (cache[coll] && cache[coll].delete(path)) notify(coll);
        },
        get: async () => {   // always fresh from the database (used to spot a colleague's newer save)
          await C.ready; const { data, error } = await sb.from(T).select("data").eq("path", path).maybeSingle();
          if (error) throw error;
          return { exists: !!data, data: () => data ? data.data : undefined };
        }
      };
    }
  };
  C.db = db;

  // ---------- realtime: colleagues' saves and deletes show up without a refresh ----------
  let channel = null, subscribedOnce = false;
  async function onChange(p) {
    const path = (p.new && p.new.path) || (p.old && p.old.path); if (!path) return;
    const coll = collOf(path); if (!cache[coll]) return;
    if (p.eventType === "DELETE") { if (cache[coll].delete(path)) notify(coll); return; }
    const at = Date.parse(p.new.updated_at), cur = cache[coll].get(path);
    if (cur && cur.at === at) return;   // our own save coming back
    let data = p.new.data;
    if (data === undefined) {   // big rows arrive without their data – fetch it
      const r = await sb.from(T).select("data,updated_at").eq("path", path).maybeSingle();
      if (r.error || !r.data) return; data = r.data.data;
    }
    cache[coll].set(path, { data, at }); notify(coll);
  }
  function startRealtime() {
    if (channel) return;
    channel = sb.channel("liftplan-docs").on("postgres_changes", { event: "*", schema: "public", table: T }, p => { onChange(p).catch(e => console.warn(e)); })
      .subscribe(st => {
        if (st === "SUBSCRIBED") {
          setState("live");
          if (subscribedOnce) Object.keys(cache).forEach(coll => fetchColl(coll).then(() => notify(coll)).catch(e => console.warn(e)));   // catch up after a dropped connection
          subscribedOnce = true;
        } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") setState("reconnecting");
      });
  }

  // ---------- people: names for "created by / last saved by" ----------
  C.people = { profiles: async ids => { const out = {}; try { await loadColl("people"); } catch (e) { } const m = cache.people || new Map(); ids.forEach(id => { const r = m.get("people/" + id); out[id] = { name: r ? r.data.name : "" }; }); return out; } };
  C.myName = () => nameOf(C.user);

  // ---------- screens: sign in, choose your own password (first sign-in and reset link), account ----------
  document.body.insertAdjacentHTML("beforeend", `
<style>
#dSignIn{width:min(420px,94vw)}#dSignIn .db{gap:10px}#dSignIn label{display:flex;flex-direction:column;gap:4px;font-size:13px}
#dSignIn input{font-size:15px;padding:8px}#dSignIn .sibrand{font:700 24px var(--display)}#dSignIn .sibrand span{color:var(--accent)}
#dSignIn .silink{background:none;border:0;color:var(--accent);padding:0;text-decoration:underline;cursor:pointer;align-self:flex-start;font-size:13px}
.lpAcct{font:12px var(--mono);white-space:nowrap}.lpAcct i{font-style:normal}.lpAcct.live i{color:#3ecf8e}.lpAcct.off i{color:#e0a030}
#dAccount{width:min(440px,94vw)}
</style>
<dialog id="dSignIn"><div class="dh"><div class="sibrand">LiftPlan <span>Studio</span></div></div><div class="db">
  <p class="small" id="siTitle"></p>
  <div id="siLogin"><label>Email<input type="email" id="siEmail" autocomplete="username"></label>
    <label style="margin-top:8px">Password<input type="password" id="siPass" autocomplete="current-password"></label></div>
  <div id="siNew" hidden><label>New password<input type="password" id="siNew1" autocomplete="new-password"></label>
    <label style="margin-top:8px">Type it again<input type="password" id="siNew2" autocomplete="new-password"></label>
    <p class="small">At least 8 characters. Only you will know it.</p></div>
  <button class="pri" id="siGo"></button>
  <button class="silink" id="siForgot">Forgot your password?</button>
  <p class="status" id="siMsg" hidden></p>
</div></dialog>
<dialog id="dAccount"><div class="dh"><b>Account</b><button data-close>Close</button></div><div class="db">
  <p id="acWho"></p><p class="small" id="acState"></p>
  <p class="small">Plans, libraries and site templates are saved in the team's shared database. Everyone who is signed in sees the same data, and a colleague's save shows up without refreshing.</p>
  <div class="btnrow"><button id="acPass">Change my password</button><button id="acOut">Sign out</button></div>
</div></dialog>`);
  const $c = id => document.getElementById(id);
  const dlg = $c("dSignIn"); let mode = "login";
  dlg.addEventListener("cancel", e => e.preventDefault());   // can't be closed with Esc – the app needs a signed-in user
  let gate = false;   // true while someone must sign in / choose a password: any other window that opens goes underneath
  new MutationObserver(ms => { if (gate && ms.some(m => m.target !== dlg && m.target.tagName === "DIALOG" && m.target.open)) { if (dlg.open) dlg.close(); dlg.showModal(); } })
    .observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
  $c("dAccount").querySelector("[data-close]").onclick = () => $c("dAccount").close();
  const msg = (t, cls = "bad") => { const m = $c("siMsg"); m.hidden = !t; m.className = "status " + cls; m.textContent = t || ""; };
  function show(m) {
    mode = m; gate = true; msg("");
    $c("siLogin").hidden = m !== "login"; $c("siNew").hidden = m === "login"; $c("siForgot").hidden = m !== "login";
    $c("siTitle").textContent = m === "login" ? "Sign in with the email and password you were given."
      : m === "first" ? "Welcome" + (C.user?.email ? ", " + C.user.email : "") + ". Before you start, choose your own password to replace the temporary one."
      : "Choose a new password.";
    $c("siGo").textContent = m === "login" ? "Sign in" : "Save my password";
    if (dlg.open) dlg.close(); dlg.showModal();   // re-open so it sits on top of any other open window
    setTimeout(() => (m === "login" ? ($c("siEmail").value ? $c("siPass") : $c("siEmail")) : $c("siNew1")).focus(), 30);
  }
  async function go() {
    const b = $c("siGo"); if (b.disabled) return;
    if (mode === "login") {
      const email = $c("siEmail").value.trim(), password = $c("siPass").value;
      if (!email || !password) { msg("Type your email and password."); return; }
      b.disabled = true; msg("Signing in…", "busy");
      const { data, error } = await sb.auth.signInWithPassword({ email, password }); b.disabled = false;
      if (error) { msg(/invalid/i.test(error.message) ? "Wrong email or password." : "Couldn't sign in: " + error.message); return; }
      $c("siPass").value = ""; signedIn(data.user);
    } else {
      const p1 = $c("siNew1").value, p2 = $c("siNew2").value;
      if (p1.length < 8) { msg("Use at least 8 characters."); return; }
      if (p1 !== p2) { msg("The two passwords aren't the same."); return; }
      b.disabled = true; msg("Saving…", "busy");
      const { data, error } = await sb.auth.updateUser({ password: p1, data: { pw_set: true } }); b.disabled = false;
      if (error) { msg(/different|same/i.test(error.message) ? "Choose a password different from the temporary one." : "Couldn't save it: " + error.message); return; }
      $c("siNew1").value = $c("siNew2").value = ""; C.user = data.user; gate = false; dlg.close(); toastSafe("Password saved"); opened();
    }
  }
  $c("siGo").onclick = go;
  dlg.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); go(); } });
  $c("siForgot").onclick = async () => {
    const email = $c("siEmail").value.trim(); if (!email) { msg("Type your email first, then click this again."); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    msg(error ? "Couldn't send the email: " + error.message : "If that email has an account, a link to set a new password is on its way.", error ? "bad" : "ok");
  };
  $c("acPass").onclick = () => { $c("dAccount").close(); show("reset"); };
  $c("acOut").onclick = async () => { await sb.auth.signOut(); location.reload(); };
  const toastSafe = t => { try { toast(t); } catch (e) { } };

  // ---------- header: who is signed in + connection ----------
  function setState(s) { C.state = s; paintHeader(); }
  function paintHeader() {   // one account button in the plan's top bar and one on the start screen
    const spots = [["bAccount", "saveState", "afterend"], ["bAccount2", "stTheme", "beforebegin"]];
    const live = C.state === "live";
    for (const [id, near, where] of spots) {
      let b = $c(id);
      if (!b) { const n = $c(near); if (!n) continue; n.insertAdjacentHTML(where, `<button id="${id}" class="lpAcct${id === "bAccount2" ? " dghost" : ""}" style="${id === "bAccount2" ? "margin-right:8px" : ""}"></button>`); b = $c(id); b.onclick = openAccount; }
      b.classList.toggle("live", live); b.classList.toggle("off", !live);
      b.innerHTML = `<i>●</i> ${esc(C.myName() || "Signed out")}`; b.title = live ? "Shared database: live" : "Shared database: " + C.state;
    }
  }
  function openAccount() {
    $c("acWho").innerHTML = `Signed in as <b>${esc(C.user?.email || "")}</b>`;
    $c("acState").textContent = C.state === "live" ? "● Live – connected to the shared database." : "Connection: " + C.state + " (saves still go through; live updates resume by themselves).";
    $c("dAccount").showModal();
  }

  // ---------- session ----------
  let started = false;
  function signedIn(u) {
    C.user = u; gate = false; if (dlg.open) dlg.close();
    if (!u.user_metadata?.pw_set) { show("first"); return; }
    opened();
  }
  function opened() {
    if (!started) {
      started = true; setState("connecting"); readyRes();
      db.doc("people/" + C.user.id).set({ name: C.myName(), email: C.user.email || "", seenAt: Date.now() }).catch(e => console.warn(e));
      startRealtime();
    } else paintHeader();
  }
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === "PASSWORD_RECOVERY" && session) { C.user = session.user; setTimeout(() => show("reset"), 0); }
    else if (ev === "SIGNED_OUT" && started) { C.user = null; setState("signed out"); show("login"); }
  });
  C.boot = (async () => {
    const { data } = await sb.auth.getSession();
    if (/type=recovery/.test(location.hash)) return;   // handled by PASSWORD_RECOVERY
    if (data.session) signedIn(data.session.user);
  })();
  // the start screen opens while the scripts load; once everything is up, put the sign-in on top of it
  window.addEventListener("load", async () => { await C.boot; paintHeader(); if (!C.user) show("login"); else if (dlg.open || !C.user.user_metadata?.pw_set) show(C.user.user_metadata?.pw_set ? mode : "first"); });
  return C;
})();
if (CLOUD) LOCAL.db = CLOUD.db;   // the app reads LOCAL.db – from here on that's the shared database
