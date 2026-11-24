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
- Golden-output test (for any clean-up / refactor): `node tests/golden.js <old build.html> /tmp/g_before`, then
  `node tests/golden.js out/LiftPlan_Studio.html /tmp/g_after /tmp/g_before` – must say 0 differences (step numbers, crane
  checks, every sheet's text and picture, 3D model at pick / set and Play frames). Build the old version from git HEAD in a copy.
  Real plans: push the new build as `next.html` first, compare in the browser panel with the live index.html, then replace.
- Diagnostics: `NODE_PATH=<global node_modules> node tests/diag.js` (Playwright + Chromium) – must stay all PASS
  (96/96 since the visual-check fixes, scenario 17). Add a diagnostic scenario for every new feature, not only regressions. The diagnostic opens
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
- Real client / site drawings used by the diagnostics live in `tests/fixtures-private/` (git-ignored) or the folder in
  `LP_PRIVATE_FIXTURES` – never in the repo (the SSB Dakar survey was purged from the history on 22 Nov 2026; Nicko's copy is in
  his OneDrive Apps folder, inside liftplan-studio.bundle / LiftPlan_source.zip). Without it, check 6b is skipped.
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

## Lift sequence feature
- Files (build order): `liftsteps.js` engine (steps, checks, crane checks along the steps) → `liftstepsui.js` checks panel /
  steps dialog → `liftstepsdraw.js` step drawings, stage sheets, sheet text cleaner (LS_DRAW, LS_SET declared here) →
  `liftset.js` load at set + the single load3D / rig3D / loadRigHeight / evalCrane wrappers → `liftstepsplay.js` Play.
- One wrapper per function per file group: add to the existing wrapper, don't stack a second one. Drawing state is
  LS_DRAW (a step being drawn / played) and LS_SET {plan, foot, el, ph, rel, guard} (load at set) – no new globals.
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
  of the move drawn like the plan sheet's slew (Nicko's 600 t LNG plan is the reference): the load's path round the carrying
  crane on its slew arc at the hook radius, ghosts along it, before dashed / now solid, "slew N°" placed clear of the cranes,
  and a small arc for any turn ON THE HOOK (rotation beyond what the slew gives – `lsHookTurn`), beside a narrower front view.
  Vertical-only stages keep the full-width front view.
- Front views look from the side away from the cranes, decided from the PICK position for upends (so the load is always in
  front of the cranes, wherever the set point is).
- Play lift (liftplay.js) plays a lift with steps step by step (wrappers installed on window "load"): interpolates between
  steps (`lsLerpStep`), draws through `lsEnter` (hooks at the step's R/slew, load tilted, forklift moved); caption = the
  step's per-machine instructions + live numbers. The plan is left exactly as it was.
  Play builds the still scenery once per lift into `LP.still` (plan.obstacles except a forklift on the lift; mats chosen with
  the real cranes – shownMatIds is pinned) and each frame rebuilds the cranes with hooks / ropes, loads, rigging and the forklift
  (glBuild(M, {movingOnly:true}) skips the ground). The caption is a footer bar across the bottom of the 3D view (`lpFitBox` pins the
  overlay to #view3d's rectangle each frame, any window size); controls top right; the camera is lifted clear of the footer. Slews follow the load's "Travel from pick to set" (ld.travelDir,
  `lsSlewDelta`) in the steps, top view and Play.
- LS_CACHE results are only reused for the same load / crane objects (`lsCacheOk`): a reopened plan or a switched lift has
  new objects with the same ids – reusing an old result drew / played the old objects and nothing on screen moved.
- Load at set after an upend: `ld.set.tilt` (°; unset = automatic – top and tail sets it down at the upend angle, else level),
  load panel "Load at set". With it turned up: liftPointWorld(set) = the lift steps' final hooks (same radius as the step
  sheets), the tail crane is off the hook at set (share 0, hook where it let go, "SET – OFF THE HOOK"), plan footprint upright
  (round for round loads), travel ghosts and clash checks use that footprint, set elevations and 3D show it upright.
- A crane on a lift with steps is checked through the lift along the steps (`liftSequence` wrapped in liftsteps.js: every
  step plus ¼ ½ ¾ along each plan move) – not the plain pick→set straight line with the load level.
- Sheets: a last pass (`lsSheetText`, buildSheets wrapper) drops "SSB " / "(SSB …)" from printed text; the user's own numbers
  ("SSB-004") stay. Built-in rigging names carry no company mark. Global names must be unique across app/*.js – a clashing
  top-level const stops the whole file loading (it happened with sheetClean; the full diagnostic run catches it).
- Crane set-ups (groundcheck.js, `craneClashWarnings`): two cranes on a lift whose carrier / outriggers / mats overlap = stop;
  a tail swing (data `up.tail`) reaching the other carrier, or two tails that can meet = warning. A hook block or rope
  overloaded makes the crane a stop (craneSummary).
- Top and tail with a forklift: `ld.set` = where the column STANDS (same meaning as for two cranes). lsAddForklift puts it where
  the top end was (hook stays over the top lug); the steps only carry it further if the set is somewhere else. No bridle at
  pick (loadRigHeight / loadSideRig treat it like a tandem hook on the top lug); no travel line when the hook doesn't move.
- Rigging sheet, load on two cranes: each hook block called out with its own crane; parts at the left-hand end are called
  out in the left margin (numbers facing the drawing) when they fit. End-on lifting points at one spot get one label "P1 · P2".
  Vertical dimension text that doesn't fit goes on the outer side; `fitOnly` dims are left off (the level marks give them).
- Elevations: level marks stand just clear of what is drawn (scene bounds), never "-0.0".
- Samples carry a version (SAMPLE_VER): an unedited copy in the list (rev 1) is refreshed when its version goes up.
- Rigging sheet left-margin callouts fall back to the right-hand column on any error (a sheet must always build).
- Real-plan check (with Nicko signed in in the Claude browser panel): open each plan read-only, every lift: checks, steps,
  buildSheets, script errors – no saving.
- Not yet checked on the real plans: the 23 Nov visual-check fixes went live 24 Nov without the browser panel (Nicko said go
  ahead) – run the real-plan check next time the panel is connected.
- Known gaps: LTM 1230 / LTM 1130 charts not in the crane library yet (need the chart for the actual crane / counterweight /
  outrigger set-up – import through Master data; the only public manual found is the US imperial edition); H16XD6
  capacity plate for the actual truck; vessels have no hold model; a callout can still cross a sling line.
