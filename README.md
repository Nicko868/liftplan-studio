# LiftPlan Studio – source

The app is built from the files in `app/` into one HTML file.

- Build: `(cd libs && npm install)` once, then `bash build.sh` → `out/LiftPlan_Studio.html`
- Diagnostic: `npm i playwright` (with Chromium), then `node tests/diag.js out/LiftPlan_Studio.html diag_out`
  – runs the main screens and the key checks (realistic 3D view, simple rigging builder, rigging hitches, bag counts, mats, capacity reset, tandem,
    layout tools, site templates, export), saves screenshots and `report.json`, prints PASS / FAIL.
- Published copy: https://claude.ai/artifact/NScHgQ1XcfXyyuZpUXrpyi
- Working copy: Apps\LiftPlan_Studio.html (OneDrive – Senegal Supply Base SA)

Each JS file adds a feature by wrapping functions defined earlier (`const _x = fn; fn = function () {…}`),
so the order in build.sh matters – later files build on earlier ones.

### Added (Oct 2026)
- superlift.js – SSL superlift for crawler cranes: SL mast, pendants and ballast pallet in plan / side / 3D; SL ballast in GAW and track pressure; pallet swing clash check; set-down pressure check; planner tries SSL charts after SH.
- siteplus.js – marine objects (jetty decks on piles, dolphins, rock slopes with a low-water break) and road bands, so imported sites are built from editable objects.
- transport.js – SPMTs snap to whole axle lines / modules; vehicles keep a separate position in each lift.
- present.js – fold the left / checks panels in any view ([ and ] keys), site drawing on / off (▦ Drawing, D) and a full-screen Present mode (P, Esc to leave).
- PDF / PNG sheets: CAD style, the site picture is not printed (screen only); vehicles drawn where they stand in each lift.
- tools/trace_scan_to_lines.py – traces a scanned / raster site plan into clean centre lines (CAD layer, marked traced: shown on screen and in 3D, toggled with ▦ Drawing, not printed on the sheets).
- names.js – load / site item / crane names on or off (Aa Names, N) in Top, 3D and sheets; load names sit inside big loads along their long side. Travel: items ≤ 1.5 m high are 'lift over' notes, not clashes; tanks on transport are checked on their saddles.
- sheetpreview.js – Export → PDF opens a preview of every sheet; on rigging sheets drag callout labels / points and double-click to reword (kept with the load). Rigging sheets show lift dimensions (load length, lifting-point and spreader spacing, heights to the hook, sling angle). No all-lifts overview page.
- planstyle.js – CAD outline style (white paper, site items as lines, lift in colour) by default, ◻ CAD style / ▩ Shaded toggle. clipboard.js – Ctrl+C / Ctrl+V / Ctrl+D (and ⧉ Copy / Paste buttons) for site items and loads.
- Rigging: spreader padeyes can be set apart from the lifting points ('Spreader padeyes apart'); drops then lean to the load's real lifting points, drop length covers the lean, and the side pull on the lugs / beam tension or compression is reported.
- tidy.js – site items grouped in folding groups with a search box; one View ▾ menu for panels, drawing, CAD style and names. Rigging: any part can be doubled up side by side (×2…) sharing the load.
- Ramshorn hooks: hook gear goes one on each horn (load split between them), legs start from their horn; a warning if all the gear is put on one point.
- Ramshorn: follows your hook gear – leading parts with 2 pieces go one on each horn, the next single part (e.g. one shackle through both master links) joins them; the simple builder starts with 2 master links on a ramshorn.
- groundwind.js – 'Site limits' section (allowed GBP, utilisation limit, mats rule) at the top of the left panel; allowed GBP per crane; 'set allowed GBP…' link in the checks. Optional wind check per crane (chart limit, forecast, load wind area – EN 13000 style reduction).
- liftcheck.js – lift sequence (radius, boom angle, capacity, utilisation at lift-off, ¼, ½, ¾, set), warnings grouped Must fix / Check / Info, 'chart checked against the data sheet' tick, and a calculation check sheet after each lift's plan sheet.
