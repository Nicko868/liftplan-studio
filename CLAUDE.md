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
  (84/84 since the load stands up at set). Add a diagnostic scenario for every new feature, not only regressions. The diagnostic opens
  the file with `?local` (browser-only mode); scenario 9 tests shared mode against a stand-in for Supabase.
- Storage: all saving goes through `CAP.db` (collection / doc / onSnapshot).
  - Shared mode (default outside claude.ai): `app/cloud.js` – Supabase project `liftplan-studio`
    (https://zsdacfyuongmebpdltcw.supabase.co), one table `liftplan_docs` (path = "<collection>/<id>", coll, jsonb data,
    updated_at, updated_by), row level security = signed-in staff only, realtime on. Sign-in screen; first sign-in
    asks for the user's name and forces them to choose their own password (user_metadata.name / pw_set); "Forgot your password?" sends a reset link.
    Names for "saved by" come from `people/<user id>` docs. Pictures stay inside the documents (CAP.local is true).
  - Browser-only mode: `app/local.js` (IndexedDB), used with `?local` in the address. Inside claude.ai the artifact
    runtime db is used.
  - Users are added by Nicko in Supabase → Authentication → Users → Add user (Auto Confirm, temporary password).
    "Allow new users to sign up" must stay OFF in Supabase (the publishable key is public).
    The table needs `grant select, insert, update, delete on public.liftplan_docs to authenticated;` (new Supabase
    projects don't grant it automatically). Database errors are shown to the user (dbError in cloud.js), never swallowed.
  - Version shown on the sign-in screen and in Account: build.sh stamps the build date/time into LP_VERSION.
- Never put job data, client data or a secret key in `index.html` (the repo is public). The only key allowed in it is the
  Supabase **publishable** key (it is public by design; the protection is the sign-in + table rules). Never the
  secret / service_role key. The Anthropic key is typed in by each user.

- Sample plans: `app/samples.js` (SAMPLE_PLANS) – start screen → "Sample plans". Three top-and-tail upends (spud leg and
  steel column with two cranes; 10 t column with a crane + Hyster H16XD6 forklift) and one moving tandem lift (85 t transformer). Made-up data, built-in cranes only, no "SSB" anywhere.
  Every new lift type gets a sample here (Nicko wants to see the expected output); diagnostic scenarios 10–11 check them (12 = forklift).
  They are also put in the Lift plans list once per database (ids sample-1…, record meta/samples; a deleted one stays deleted).

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
- Top and tail with a forklift (`app/forklift.js` + `lsFTSteps` in liftsteps.js): one crane on the top lifting point (attach "A"),
  a forklift site object (type "forklift", `o.fl = {model, load, how: forks|hook, c, attW}`) on the tail. Crane hook stays over
  the top lug and hoists; the forklift drives in at fork height; released at vertical (step release "F"), backs away 2.5 m.
  Forklift checked for max(share by moments, Rules `tt.fork` 75 % of the load) + attachment, capacity at the load centre
  (~, mast table rating carried by load moment about the front axle), fork height ≤ mast lift, axle loads (rear must stay > 0),
  limit Rules `fork.util`. Models are data in FORKLIFTS (H16XD6 from Hyster's spec sheet; axle model reproduces its rated axle loads).
  "Tail with a forklift…" on the checks panel for a one-crane load ≥ 6 m long. No default bridle is made up for it (rigShown).
- A stage where the load turns / travels in plan or a crane slews (same tilt as the step before – `lsPlanMove`) gets a TOP VIEW
  of the move (load before dashed, now solid, turn arc, path, slew arcs) beside a narrower front view; the crane carrying alone
  is told to "turn the load N° … on the hook (tag lines)". Vertical-only stages keep the full-width front view.
- Load at set after an upend: `ld.set.tilt` (°; unset = automatic – top and tail sets it down at the upend angle, else level),
  load panel "Load at set". With it turned up: liftPointWorld(set) = the lift steps' final hooks (same radius as the step
  sheets), the tail crane is off the hook at set (share 0, hook where it let go, "SET – OFF THE HOOK"), plan footprint upright
  (round for round loads), travel ghosts and clash checks use that footprint, set elevations and 3D show it upright.
- Known gaps: LTM 1230 / LTM 1130 charts not in the crane library yet; vessels have no hold model; a callout can still cross a sling line.
