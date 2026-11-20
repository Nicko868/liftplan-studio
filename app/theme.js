// ================= Light / dark screen =================
// The button flips the screen; the choice is remembered on this computer. Until you choose, it follows the computer's setting.
function curTheme() { const t = document.documentElement.dataset.theme; return t || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }
function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem("lps_theme", t); } catch (e) {} themeBtn(); }
function themeBtn() { const d = curTheme() === "dark"; for (const id of ["bTheme", "stTheme"]) { const b = document.getElementById(id); if (!b) continue; b.textContent = d ? "☀ Light" : "☾ Dark"; b.title = d ? "Switch to a light screen" : "Switch to a dark screen"; } }
(function () { let t = null; try { t = localStorage.getItem("lps_theme"); } catch (e) {} if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
  for (const id of ["bTheme", "stTheme"]) { const b = document.getElementById(id); if (b) b.onclick = () => setTheme(curTheme() === "dark" ? "light" : "dark"); } themeBtn();
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeBtn); } catch (e) {} })();
