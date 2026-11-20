// ================= Claude in the offline file =================
// The offline LiftPlan_Studio.html is the same app as the Claude version. Linking it to Claude with an API key gives it the same
// reading: site drawings, loads, vessels, crane load charts and rigging certificates are read and built by Claude, exactly as online.
// The key stays in this browser on this computer (localStorage) and is sent only to api.anthropic.com.
const CL = { KEY: "lps_claude_key", MODEL: "lps_claude_model" };
const clKey = () => { try { return (localStorage.getItem(CL.KEY) || "").replace(/\s+/g, ""); } catch (e) { return ""; } };   // stray spaces / line breaks from a paste are dropped
const blobB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(b); });
function clParse(t) {
  t = String(t || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(t); } catch (e) { }
  const i = Math.min(...["{", "["].map(c => t.indexOf(c)).filter(i => i >= 0)), j = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (isFinite(i) && j > i) return JSON.parse(t.slice(i, j + 1));
  throw { code: "bad_json", message: "Claude's answer wasn't readable – try again" };
}
const CLAUDE_LINK = {
  limits: async () => ({ images: { maxCount: 8 } }),
  json: async (prompt, opts = {}) => {
    const key = clKey(); if (!key) throw { code: "no_key", message: "Claude isn't linked – add your API key under ✦ Claude" };
    const content = [];
    for (const img of (opts.images || []).slice(0, 8)) content.push({ type: "image", source: { type: "base64", media_type: /png|webp|gif/.test(img.type) ? img.type : "image/jpeg", data: await blobB64(img) } });
    content.push({ type: "text", text: prompt });
    const model = opts.modelTier === "complex" ? "claude-opus-5-5" : "claude-sonnet-5-5";
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: opts.signal, headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model, max_tokens: 16000, system: "You are part of LiftPlan Studio, a crane lift planning app. Reply with a single JSON value only – no prose, no code fences.", messages: [{ role: "user", content }] }) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) throw { code: 401, message: "your Claude API key was refused – it may be mistyped, revoked or expired. Click ✦ Link Claude at the top and paste a current key (console.anthropic.com → API Keys)" };
    if (r.status === 403) throw { code: 403, message: "your Claude API key isn't allowed to use this model or the account has no credit – check it at console.anthropic.com" };
    if (!r.ok) throw { code: r.status, message: d.error?.message || ("HTTP " + r.status) };
    return clParse((d.content || []).filter(c => c.type === "text").map(c => c.text).join(""));
  }
};
function clApply() { if (!CAP.local) return; const on = !!clKey(); CAP.sample = on ? CLAUDE_LINK : null; CAP.sampleImages = on ? { maxCount: 8 } : null; clButton(); try { renderMeta(); } catch (e) { } }
function clButton() {
  if (!CAP.local) return;
  let b = $("bClaude"); if (!b) { b = document.createElement("button"); b.id = "bClaude"; $("bImport") ? $("bImport").before(b) : $("bSave").before(b); b.onclick = openClaudeLink; }
  const on = !!clKey(); b.textContent = on ? "✦ Claude linked" : "✦ Link Claude"; b.className = on ? "cl-on" : ""; b.title = on ? "This offline copy reads drawings, photos and charts with Claude" : "Link this offline copy to Claude so it reads drawings, photos and charts like the online app";
}
document.body.insertAdjacentHTML("beforeend", `<dialog id="dClaude" style="width:min(560px,94vw)"><div class="dh"><b>Link this offline copy to Claude</b><button data-close>Close</button></div><div class="db" style="display:flex;flex-direction:column;gap:10px">
  <p class="small" style="margin:0">The online app reads drawings, photos, load charts and certificates with Claude. This file can do the same: paste an Anthropic API key and it works identically – same import, same site building, same load and vessel reading.</p>
  <label>Anthropic API key<input type="password" id="clKeyIn" placeholder="sk-ant-…" autocomplete="off"></label>
  <p class="small" style="margin:0">Get one at console.anthropic.com (an organisation account is best). API use is billed to that account, separately from a Claude subscription. The key is kept only in this browser on this computer and sent only to Anthropic.</p>
  <div class="btnrow"><button class="pri" id="clSave">Link and test</button><button id="clForget">Unlink</button></div>
  <p class="status" id="clStatus" hidden></p>
</div></dialog>`);
function openClaudeLink() { $("clKeyIn").value = clKey() ? "••••••••" + clKey().slice(-4) : ""; $("clStatus").hidden = true; $("dClaude").showModal(); }
$("clSave").onclick = async () => {
  const v = $("clKeyIn").value.trim(), st = $("clStatus");
  if (v && !v.startsWith("••")) { try { localStorage.setItem(CL.KEY, v); } catch (e) { st.hidden = false; st.className = "status bad"; st.textContent = "This browser won't store the key (private window?)."; return; } }
  if (!clKey()) { st.hidden = false; st.className = "status bad"; st.textContent = "Paste the key first."; return; }
  st.hidden = false; st.className = "status busy"; st.textContent = "Testing the link…";
  try { const r = await CLAUDE_LINK.json('Return {"ok": true}', { modelTier: "fast" }); if (!r || r.ok !== true) throw { message: "unexpected answer" }; clApply(); st.className = "status ok"; st.textContent = "Linked – imports are now read by Claude, as in the online app."; }
  catch (e) { st.className = "status bad"; st.textContent = `Couldn't reach Claude: ${e.message || e.code || e}${e.code === 401 ? " – check the key" : ""}`; }
};
$("clForget").onclick = () => { try { localStorage.removeItem(CL.KEY); } catch (e) { } clApply(); $("clKeyIn").value = ""; const st = $("clStatus"); st.hidden = false; st.className = "status"; st.textContent = "Unlinked – this copy no longer calls Claude."; };
clApply(); window.addEventListener("load", clApply);
