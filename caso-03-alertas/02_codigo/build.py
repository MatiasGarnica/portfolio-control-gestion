"""Arma el tablero: plantilla + app.js + datos -> 03_tableros/alertas.html (un solo archivo, abre sin internet).
Orden completo:  python generate_alertas.py && python build_data.py && python build.py && python build_informe.py && python build_excel.py"""
import os
D = os.path.dirname(os.path.abspath(__file__))
DAT = os.path.join(D, "..", "01_datos")
OUT = os.path.join(D, "..", "03_tableros")
CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.1/echarts.min.js"></script>'
ECH = os.path.join(D, "..", "..", "caso-01-fpa-bpo", "02_codigo", "echarts.local.js")   # misma copia de ECharts 5.5.1 que el Caso 01

tpl = open(os.path.join(D, "dashboard_template.html"), encoding="utf-8").read()
app = open(os.path.join(D, "app.js"), encoding="utf-8").read()
data = open(os.path.join(DAT, "dashboard_data.json"), encoding="utf-8").read().replace("</", "<\\/")
assert "</script" not in app.lower() and CDN in tpl
html = tpl.replace("/*__DATA__*/", data).replace("/*__APP__*/", app)
ech = open(ECH, encoding="utf-8").read().replace("</script", "<\\/script")
html = html.replace(CDN, "<script>" + ech + "</script>")
os.makedirs(OUT, exist_ok=True)
path = os.path.join(OUT, "alertas.html")
with open(path, "w", encoding="utf-8") as fh:
    fh.write(html)
print("ok ->", os.path.relpath(path, D), os.path.getsize(path) // 1024, "KB")
