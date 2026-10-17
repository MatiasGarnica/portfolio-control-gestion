"""Arma el tablero: plantilla + app.js + datos -> 03_tableros/.
Uso: python build_plan.py v1 && python build.py v4   (build_plan.py arma la plantilla del planificador)"""
import os, sys, datetime
D = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(D, "..", "01_datos")
OUT = os.path.join(D, "..", "03_tableros")
ver = sys.argv[1] if len(sys.argv) > 1 else "dev"
stamp = datetime.date.today().isoformat()
CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.1/echarts.min.js"></script>'

tpl = open(f"{D}/dashboard_template.html", encoding="utf-8").read()
app = open(f"{D}/app.js", encoding="utf-8").read()
data = open(f"{DATA}/dashboard_data.json", encoding="utf-8").read().replace("</", "<\\/")
assert "</script" not in app.lower()
# planificador: mapa + plantilla Excel (la genera build_plan.py)
import base64
plan = open(f"{D}/plan_map.json", encoding="utf-8").read().replace("</", "<\\/")
planx = base64.b64encode(open(f"{D}/plan_template.xlsx", "rb").read()).decode()
html = tpl.replace("/*__DATA__*/", data).replace("/*__PLAN__*/", plan).replace("/*__PLANX__*/", planx).replace("/*__APP__*/", app)
online = f"{OUT}/{stamp}_control-gestion-bpo_{ver}.html"
open(online, "w", encoding="utf-8").write(html)

ech_path = f"{D}/echarts.local.js"
if os.path.exists(ech_path):  # version offline: ECharts embebido, abre sin internet
    ech = open(ech_path, encoding="utf-8").read().replace("</script", "<\\/script")
    off = html.replace(CDN, "<script>" + ech + "</script>")
    off = ('<!doctype html><html lang="es"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head>'
           '<body style="margin:0">' + off + "</body></html>")
    open(online.replace(".html", "_offline.html"), "w", encoding="utf-8").write(off)
print("ok ->", os.path.relpath(online, D), os.path.getsize(online) // 1024, "KB")
