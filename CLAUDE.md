# LiftPlan Studio – notes for Claude (read before any change)

Live app: https://nicko868.github.io/liftplan-studio/ (GitHub Pages, deploy from branch `main`, folder `/`).
Owner: Nicko (lift planning, Senegal Supply Base). Keep replies short and in plain words.

## How the app is built
- The live app is ONE self-contained file: `index.html` (≈4.3 MB, all libraries inlined).
- It is generated from the source in `app/*.js` + `app/shell.html` + `app_charts.js` by `build.sh`
  (first time: `cd libs && npm ci`). Output: `out/LiftPlan_Studio.html` → copy to `index.html`, then commit and push.
- Script order matters and is listed in `build.sh` (one inline `<script>` per file). Later files wrap earlier
  functions with the pattern `{ const _f = f; f = function (...a) { ... } }`. A wrapper that needs a function from a
  later file must run on `window` "load", never `setTimeout`.
- Run `node --check` on every changed `.js` file before building.
- Diagnostics: `NODE_PATH=<global node_modules> node tests/diag.js` (Playwright + Chromium) – must stay all PASS
  (71/71 since shared mode). Add a diagnostic scenario for every new feature, not only regressions. The diagnostic opens
  the file with `?local` (browser-only mode); scenario 9 tests shared mode against a stand-in for Supabase.
- Storage: all saving goes through `CAP.db` (collection / doc / onSnapshot).
  - Shared mode (default outside claude.ai): `app/cloud.js` – Supabase project `liftplan-studio`
    (https://zsdacfyuongmebpdltcw.supabase.co), one table `liftplan_docs` (path = "<collection>/<id>", coll, jsonb data,
    updated_at, updated_by), row level security = signed-in staff only, realtime on. Sign-in screen; first sign-in
    forces the user to choose their own password (user_metadata.pw_set); "Forgot your password?" sends a reset link.
    Names for "saved by" come from `people/<user id>` docs. Pictures stay inside the documents (CAP.local is true).
  - Browser-only mode: `app/local.js` (IndexedDB), used with `?local` in the address. Inside claude.ai the artifact
    runtime db is used.
  - Users are added by Nicko in Supabase → Authentication → Users → Add user (Auto Confirm, temporary password).
- Never put job data, client data or a secret key in `index.html` (the repo is public). The only key allowed in it is the
  Supabase **publishable** key (it is public by design; the protection is the sign-in + table rules). Never the
  secret / service_role key. The Anthropic key is typed in by each user.

## Standing rules from Nicko
- Act as a developer thinking across the whole app: data-driven, app-wide, no one-off code. Don't just reorganise his words.
- Don't ask permission when the need is clear. Work on one thing at a time and do it properly.
- Sheets: CAD quality, lean. "~" for approximations. Never print "SSB" on sheets; keep the neutral disclaimer.
- Say "load share". Ground bearing in t/m². No added standards references unless asked.
- No "TBC"/"placeholder" wording in item names. Calculators complement the app, they don't dominate it.
- Show the expected output (sample plans / exported sheets) when a feature is built.

## Lift sequence feature (app/liftsteps.js)
- Every load on two cranes is checked step by step (radius, slew, boom angle, hook height vs most, load share,
  design share, chart capacity, use, clearance under the load). Steps are data on the load (`ld.steps`, automatic until edited).
- Top and tail: stages 0/15/30/45/60/75/90°, tail released at vertical; design shares from Rules `tt.top` (100 %) and `tt.tail` (75 %).
- Moving tandem lifts work anywhere (not vessel-specific): pick → lift clear → ¼ ½ ¾ → over set → set down, carry height 1 m over obstacles.
- Sheets: summary (plan + table) then ONE stage per page: CAD front elevation (default, `plan.meta.seqStyle = "cad"`) or
  realistic 3D (`"real"`), callouts placed clear of cranes/load with leaders, hook-height dims, load angle arc, clearance dim,
  key plan, and per-crane move instructions + checks.
- Known gaps: LTM 1230 / LTM 1130 charts not in the crane library yet; vessels have no hold model; a callout can still cross a sling line.
