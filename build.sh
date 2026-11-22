#!/bin/bash
# Builds out/LiftPlan_Studio.html from the sources. First time: (cd libs && npm install)
ROOT="$(cd "$(dirname "$0")" && pwd)"; L="$ROOT/libs/node_modules"; mkdir -p "$ROOT/out"
cd "$ROOT/app"
python3 - "$L" "$ROOT/out/LiftPlan_Studio.html" <<'PY'
import sys
L, OUT = sys.argv[1], sys.argv[2]
sh=open('shell.html').read()
libs={'jszip/3.10.1/jszip.min.js':L+'/jszip/dist/jszip.min.js','jspdf/2.5.1/jspdf.umd.min.js':L+'/jspdf/dist/jspdf.umd.min.js','pdf.js/3.11.174/pdf.min.js':L+'/pdfjs-dist/build/pdf.min.js','pdf.js/3.11.174/pdf.worker.min.js':L+'/pdfjs-dist/build/pdf.worker.min.js','three.js/r128/three.min.js':L+'/three/build/three.min.js'}
libs['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js']=L+'/@supabase/supabase-js/dist/umd/supabase.js'
for k,v in libs.items():
    tag='<script src="%s"></script>'%(k if k.startswith('https://') else 'https://cdnjs.cloudflare.com/ajax/libs/'+k)
    assert tag in sh, k
    sh=sh.replace(tag,'<script>'+open(v).read().replace('</script','<\\/script')+'\n</script>')
body=sh.replace('<title>LiftPlan Studio</title>','',1)
for f in ["local.js","cloud.js","draw.js","build.js","rigging.js","loads.js","loadlib.js","calc.js","data.js","mats.js","../app_charts.js","cc2800_charts.js","app.js","ui.js","riglib.js","riggingui.js","view3d.js","app2.js","lifts.js","textstyle.js","tandemfix.js","vessel.js","siteobj.js","siteimport.js","start.js","samples.js","panels.js","riglist.js","rigbuild.js","chain.js","rigtree.js","rigwb.js","fittings.js","masterdata.js","team.js","theme.js","layouttools.js","sitetemplates.js","sitebuild.js","dwgobj.js","siteshapes.js","pictrace.js","sitearea.js","siteai.js","importhub.js","claudelink.js","datasync.js","rules.js","groundcheck.js","placement.js","rigquick.js","autoplan.js","matfx.js","transport.js","superlift.js","siteplus.js","present.js","names.js","groundwind.js","liftcheck.js","vehclear.js","travelluff.js","cranespec.js","forklift.js","liftsteps.js","liftstepsui.js","liftstepsdraw.js","liftset.js","liftstepsplay.js","sheetset.js","rigcalc.js","modulift.js","checks.js","gbcalc.js","calcs.js","cadsheet.js","planstyle.js","clipboard.js","sheetpreview.js","tidy.js","gl3d.js","liftplay.js"]:
    body+='<script>\n'+open(f).read()+'\n</script>\n'
out='<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LiftPlan Studio</title></head><body>\n'+body+'</body></html>\n'
import datetime
out=out.replace('__LP_BUILD__', datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'))
open(OUT,'w').write(out); print(OUT, len(out))
PY
