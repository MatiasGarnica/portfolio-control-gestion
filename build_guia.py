"""Guía en HTML (se abre en Chrome): abrir el Power BI y armar el Looker Studio del Caso 01."""
import os, html, datetime
D = os.path.dirname(os.path.abspath(__file__))
E = html.escape
code_id = [0]
def code(txt, label=None):
    code_id[0] += 1; i = f"c{code_id[0]}"
    return f'<div class="code">{f"<span>{E(label)}</span>" if label else ""}<button data-c="{i}">Copiar</button><pre id="{i}">{E(txt)}</pre></div>'
def steps(items): return '<ol class="steps">' + "".join(f"<li>{x}</li>" for x in items) + "</ol>"
def table(head, rows): return '<div class="tw"><table><thead><tr>' + "".join(f"<th>{h}</th>" for h in head) + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows) + "</tbody></table></div>"
def kv(items): return '<div class="kv">' + "".join(f"<div><span>{a}</span><b>{b}</b></div>" for a, b in items) + "</div>"

PER = 'CASE\n  WHEN p_vista = "Mes" AND Anio = CAST(SUBSTR(p_mes, 1, 4) AS NUMBER) AND Mes_num = CAST(SUBSTR(p_mes, 6, 2) AS NUMBER) THEN 1\n  WHEN p_vista = "Acumulado del año" AND Anio = CAST(SUBSTR(p_mes, 1, 4) AS NUMBER) AND Mes_num <= CAST(SUBSTR(p_mes, 6, 2) AS NUMBER) THEN 1\n  ELSE 0\nEND'
def S(esc, cond="", col="Importe_ARS", per=True):
    c = f'Escenario = "{esc}"' + (" AND En período = 1" if per else "") + (f" AND {cond}" if cond else "")
    return f"SUM(CASE WHEN {c} THEN {col} ELSE 0 END)"
ING = 'Rubro = "1 Ingreso Operacional"'
MO = 'SUBSTR(Rubro, 1, 1) IN ("1", "2", "3", "4")'
MC = 'SUBSTR(Rubro, 1, 1) IN ("1", "2", "3")'
RES = [("En período", "Dimensión (1 = el mes está en el período elegido)", PER),
       ("Real período", "Real del período", S("Real")), ("Presupuesto período", "Presupuesto del período", S("Presupuesto")), ("Forecast período", "Forecast del período", S("Forecast")),
       ("Desvío vs presupuesto", "Real menos presupuesto", "Real período - Presupuesto período"),
       ("Desvío vs presupuesto %", "Positivo = mejor que lo previsto, en ingresos y en costos", "(Real período - Presupuesto período) / ABS(Presupuesto período)"),
       ("Ingresos período", "Ingreso operacional real", S("Real", ING)), ("Ingresos presupuesto período", "Ingreso operacional presupuestado", S("Presupuesto", ING)),
       ("Ingresos vs presupuesto %", "", "(Ingresos período - Ingresos presupuesto período) / Ingresos presupuesto período"),
       ("Margen operativo período", "Ingresos menos explotación, impuestos directos y estructura", S("Real", MO)), ("Margen operativo %", "", "Margen operativo período / Ingresos período"),
       ("Margen de contribución período", "Antes de estructura: para comparar carteras", S("Real", MC)), ("Margen de contribución %", "", "Margen de contribución período / Ingresos período"),
       ("Utilidad neta período", "Resultado final", S("Real")), ("Utilidad neta presupuesto período", "", S("Presupuesto")),
       ("Utilidad neta vs presupuesto %", "", "(Utilidad neta período - Utilidad neta presupuesto período) / ABS(Utilidad neta presupuesto período)"),
       ("Cierre proyectado 2025", "Real hasta septiembre + forecast oct–dic (cambiá el 9 cuando cierre otro mes)", 'SUM(CASE WHEN Anio = 2025 AND ((Escenario = "Real" AND Mes_num <= 9) OR (Escenario = "Forecast" AND Mes_num > 9)) THEN Importe_ARS ELSE 0 END)'),
       ("Ingresos real (mes)", "Para la serie mensual", S("Real", ING, per=False)), ("Ingresos presupuesto (mes)", "", S("Presupuesto", ING, per=False)), ("Ingresos forecast (mes)", "", S("Forecast", ING, per=False))]
DRV = [("En período", "La misma fórmula que en resultado", PER),
       ("% recupero período", "Recuperado sobre deuda asignada", f'{S("Real", col="Recuperado")} / {S("Real", col="Deuda_asignada")}'),
       ("% recupero presupuesto período", "", f'{S("Presupuesto", col="Recuperado")} / {S("Presupuesto", col="Deuda_asignada")}'),
       ("Fee período", "Ingreso sobre lo recuperado (en la moneda de la cartera)", f'{S("Real", col="Ingreso")} / {S("Real", col="Base_fee")}'),
       ("Posiciones período", "Promedio mensual", f'{S("Real", col="Posiciones")} / COUNT_DISTINCT(CASE WHEN Escenario = "Real" AND En período = 1 THEN Mes ELSE NULL END)'),
       ("Ingreso por hora período", "Ingreso por recupero por hora de posición", f'{S("Real", col="Ingreso")} / {S("Real", col="Horas")}'),
       ("% recupero real (mes)", "Para las series mensuales", f'{S("Real", col="Recuperado", per=False)} / {S("Real", col="Deuda_asignada", per=False)}'),
       ("% recupero presupuesto (mes)", "", f'{S("Presupuesto", col="Recuperado", per=False)} / {S("Presupuesto", col="Deuda_asignada", per=False)}'),
       ("Fee real (mes)", "", f'{S("Real", col="Ingreso", per=False)} / {S("Real", col="Base_fee", per=False)}'),
       ("Fee presupuesto (mes)", "", f'{S("Presupuesto", col="Ingreso", per=False)} / {S("Presupuesto", col="Base_fee", per=False)}')]
def fields(lst): return "".join(f'<div class="fld"><h4>{E(n)}</h4>{f"<p>{E(d)}</p>" if d else ""}{code(f)}</div>' for n, d, f in lst)

ARQ = """<svg viewBox="0 0 960 230" role="img" aria-label="Una sola base de datos alimenta las tres salidas">
<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#5d6874"/></marker></defs>
<g font-family="inherit" font-size="13">
<rect x="10" y="20" width="236" height="190" rx="12" fill="#f5f7fa" stroke="#d5dbe3"/><text x="128" y="46" text-anchor="middle" font-weight="700" fill="#13294b">Fuentes de la empresa</text>
<text x="26" y="80" fill="#3f4b58">Sistema contable (mayor)</text><text x="26" y="106" fill="#3f4b58">Discador / CRM</text><text x="26" y="132" fill="#3f4b58">Liquidación de sueldos</text><text x="26" y="158" fill="#3f4b58">Proveedores (SMS, mails)</text><text x="26" y="184" fill="#3f4b58">Presupuesto y forecast</text>
<rect x="290" y="50" width="330" height="130" rx="12" fill="#fff" stroke="#13294b" stroke-width="2"/><path d="M290 84V62a12 12 0 0 1 12-12h306a12 12 0 0 1 12 12v22z" fill="#13294b"/>
<text x="455" y="72" text-anchor="middle" font-weight="700" fill="#fff">Base estándar (contrato de datos)</text>
<text x="306" y="110" fill="#111a24">resultado: escenario · mes · cartera · cuenta</text><text x="306" y="134" fill="#111a24">drivers: deuda · recupero · fee · posiciones</text><text x="306" y="158" fill="#111a24">dimensiones: carteras · cuentas · meses</text>
<rect x="700" y="20" width="250" height="52" rx="10" fill="#fff" stroke="#c8102e"/><text x="825" y="51" text-anchor="middle" font-weight="700" fill="#111a24">Tablero HTML + Planificador</text>
<rect x="700" y="89" width="250" height="52" rx="10" fill="#fff" stroke="#c8102e"/><text x="825" y="120" text-anchor="middle" font-weight="700" fill="#111a24">Power BI (diario)</text>
<rect x="700" y="158" width="250" height="52" rx="10" fill="#fff" stroke="#c8102e"/><text x="825" y="189" text-anchor="middle" font-weight="700" fill="#111a24">Looker Studio (compartir gratis)</text>
<path d="M248 115H284" stroke="#5d6874" stroke-width="2" marker-end="url(#ar)"/><path d="M622 100L694 50" stroke="#5d6874" stroke-width="2" fill="none" marker-end="url(#ar)"/><path d="M622 115H694" stroke="#5d6874" stroke-width="2" fill="none" marker-end="url(#ar)"/><path d="M622 130L694 182" stroke="#5d6874" stroke-width="2" fill="none" marker-end="url(#ar)"/>
</g></svg>"""

pbi = f"""<p>Te paso <b>2026-10-04_PowerBI_CobranzasDelSur_v2.zip</b>: es un proyecto de Power BI en texto (PBIP). Se abre con Power BI Desktop igual que un .pbix y, por ser texto, se puede subir a GitHub con historial de cambios.</p>
{steps(["<b>Descomprimí</b> el zip en <code>caso-01-fpa-bpo\\05_powerbi\\</code> (queda la carpeta <code>CobranzasDelSur</code>).",
        "<b>Actualizá Power BI Desktop</b> (si lo instalaste desde Microsoft Store se actualiza solo). Si una versión vieja no lo abre: Archivo › Opciones › Características en versión preliminar › activá «Opción de guardar proyecto de Power BI (.pbip)», «Almacenar modelo semántico con formato TMDL» y «Almacenar informes con formato de metadatos mejorado (PBIR)» y reiniciá.",
        "<b>Abrí</b> <code>CobranzasDelSur\\CobranzasDelSur.pbip</code> y tocá <b>Actualizar</b>. La primera vez los visuales están vacíos hasta que carga los datos.",
        "Si avisa que no encuentra los archivos: Inicio › Transformar datos › <b>Editar parámetros</b> › CarpetaDatos → poné la ruta de la carpeta <code>datos</code> que viene adentro del zip (terminada en <code>\\</code>) y Actualizar.",
        "<b>Controlá</b> los números de abajo. Ctrl+S guarda el proyecto; para mandarlo como un solo archivo, Archivo › Guardar como › .pbix.",
        "Si algo no abre, mandame una captura del mensaje de error y lo corrijo."])}
<h3>Qué tiene</h3>
{table(["Página", "Qué muestra"], [["Resumen", "Seis indicadores del período, ingresos mensuales 2025 (real, presupuesto, forecast y año anterior) e ingresos por cartera contra presupuesto"],
    ["Estado de resultados", "Matriz rubro › subrubro › ítem: real, forecast, presupuesto, desvío y año anterior"], ["Carteras", "Ingresos, margen de contribución, posiciones, ingreso por hora, recupero y fee"],
    ["Drivers", "Recupero, fee, deuda asignada y posiciones mes a mes contra presupuesto, por cartera"], ["Cómo se usa", "Período, modelo y control de números"]])}
<p class="note">Período: «Mes de análisis» (vacío = último mes real) y «Vista» (mes o acumulado del año) son tablas sin relación; las medidas leen la selección, igual que el tablero HTML. Modelo estrella con 52 medidas DAX en carpetas y con descripción (detalle en <code>MEDIDAS.md</code>).</p>"""

ctrl = kv([("Ingresos sep-25", "$ 422,6 M"), ("vs presupuesto", "−10,8%"), ("Margen operativo", "17,6%"), ("Utilidad neta", "$ 57,5 M"),
           ("Cierre proyectado 2025", "$ 554,4 M"), ("Acumulado ene–sep · ingresos", "$ 3.384,4 M"), ("Acumulado · margen operativo", "14,7%"), ("Ingreso por hora sep-25", "$ 20.521")])

looker = f"""<p>Looker Studio es gratis y se comparte con un link. Usá tu <b>cuenta de Google personal</b>, nunca la de la empresa: el informe queda privado hasta que lo compartas, y estos datos son ficticios.</p>
<h3>1. Datos</h3>
{steps(["Subí <b>2026-10-04_Looker_CobranzasDelSur_datos.xlsx</b> a Google Drive.", "Abrilo con Hojas de cálculo de Google y hacé Archivo › <b>Guardar como Hojas de cálculo de Google</b>. Tiene dos hojas: <code>resultado</code> (9.871 filas) y <code>drivers</code> (540 filas).",
        "Entrá a <b>lookerstudio.google.com</b> › Crear › Informe › Hojas de cálculo de Google › elegí el archivo y la hoja <code>resultado</code> (con «Usar la primera fila como encabezados») › Agregar.",
        "Recurso › Administrar fuentes de datos › Agregar fuente: la misma planilla, hoja <code>drivers</code>.",
        "En cada fuente revisá los tipos: <code>Mes</code> = Fecha; <code>Anio</code> y <code>Mes_num</code> = Número con agregación «Ninguna»; importes y drivers = Número con agregación «Suma»."])}
<h3>2. Parámetros (crealos en las dos fuentes, con el mismo nombre)</h3>
{table(["Nombre", "Tipo", "Valores permitidos", "Predeterminado"], [["<code>p_mes</code>", "Texto", "Lista de valores: 2025-01 … 2025-09 (etiquetas ene-25 … sep-25)", "2025-09"], ["<code>p_vista</code>", "Texto", "Lista de valores: Mes, Acumulado del año", "Mes"]])}
<p class="note">En la fuente: Agregar un parámetro. En el informe se manejan con un control «Lista desplegable» que use el parámetro como campo de control. Es el mismo criterio de período que el HTML y el Power BI.</p>
<h3>3. Campos calculados · fuente <code>resultado</code></h3><p class="note">Agregar un campo › pegá el nombre y la fórmula. Formato: importes como Número con «Abreviatura compacta»; porcentajes como Porcentaje.</p>
<div class="flds">{fields(RES)}</div>
<h3>4. Campos calculados · fuente <code>drivers</code></h3><div class="flds">{fields(DRV)}</div>
<h3>5. Estilo (para que se vea como el tablero)</h3>
{table(["Elemento", "Cómo"], [["Lienzo", "Archivo › Configuración del informe › 1280 × 720, fondo #FFFFFF"], ["Banda superior", "Rectángulo de 1280 × 60 color #13294B con texto blanco «Cobranzas del Sur S.A. · Control de Gestión»; debajo, una línea de 4 px #C8102E"],
    ["Colores de series", "Real #1F5BB5 · Presupuesto #7D868F · Forecast #EB6834"], ["Tarjetas (scorecards)", "Borde #E1E5EA, radio 10; un rectángulo #13294B de 3 px arriba de cada una para el filete"],
    ["Tablas", "Estilo › Encabezado: fondo #13294B y texto blanco; filas alternas #F8FAFC; números con separador de miles"], ["Tipografía", "Theme and layout › fuente «IBM Plex Sans» (o Roboto)"]])}
<h3>6. Páginas</h3>
{table(["Página", "Visual", "Configuración"], [
    ["Resumen", "2 listas desplegables", "<code>p_mes</code> y <code>p_vista</code>"], ["", "6 tarjetas", "Ingresos período · Ingresos vs presupuesto % · Margen operativo % · Utilidad neta período · Utilidad neta vs presupuesto % · Cierre proyectado 2025"],
    ["", "Serie temporal", "Dimensión Mes (Año y mes); métricas Ingresos real/presupuesto/forecast (mes); filtro Anio = 2025"], ["", "Barras", "Dimensión Cartera; métricas Ingresos período e Ingresos presupuesto período; filtro Codigo ≠ EST; orden descendente"],
    ["Estado de resultados", "Tabla dinámica", "Filas Rubro y Subrubro; métricas Real período, Presupuesto período, Desvío vs presupuesto, Desvío vs presupuesto %, Forecast período"],
    ["Carteras", "Tabla (fuente resultado)", "Cartera; Ingresos período, Ingresos vs presupuesto %, Margen de contribución período y %; filtro Codigo ≠ EST"], ["", "Tabla (fuente drivers)", "Cartera; % recupero período y presupuesto, Fee período, Posiciones período, Ingreso por hora período"],
    ["Drivers", "Lista desplegable + 4 series", "Control por Cartera (fuente drivers); series de % recupero real/presupuesto (mes), Fee real/presupuesto (mes) y las que quieras sumar"]])}
<h3>7. Control</h3><p>Con p_mes = 2025-09 y Mes tenés que ver los mismos números que en el HTML y en Power BI (abajo). Para mostrarlo en el portfolio: Compartir › Administrar acceso › «Cualquier persona con el vínculo puede ver». Solo con datos ficticios.</p>"""

arq = f"""<p>Los tres tableros leen la misma base. Para que otra empresa llegue a los mismos resultados no hace falta copiar fórmulas ni pantallas: alcanza con que arme <b>esa base</b> con sus datos, respetando las columnas.</p>{ARQ}
{table(["Tabla", "Una fila por", "Columnas mínimas", "De dónde sale"], [["resultado", "escenario · mes · cartera · cuenta", "escenario, mes, cartera, cuenta, importe", "Mayor contable reclasificado a gestión + presupuesto + forecast"],
    ["drivers", "escenario · mes · cartera", "deuda asignada, % recupero, fee, posiciones, minutos, SMS, mails", "Discador/CRM, liquidación de sueldos, facturas de proveedores"],
    ["carteras / cuentas / meses", "cartera · cuenta · mes", "códigos, nombres, rubro N1/N2, moneda", "Se definen una vez"]])}
<p class="note">Con eso, el HTML se regenera con un script, Power BI y Looker se actualizan solos, y el Planificador arranca del run-rate real. Lo que cambia entre empresas es la consulta que arma la base, no los tableros.</p>"""

page = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guía Power BI y Looker Studio</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>:root{{--band:#13294b;--accent:#c8102e;--ff:"IBM Plex Sans","Helvetica Neue",Arial,sans-serif}}*{{box-sizing:border-box}}body{{margin:0;background:#fff;color:#111a24;font:15px/1.6 var(--ff)}}
.hd{{background:var(--band);color:#fff;padding:26px 0 22px}}.acc{{height:4px;background:var(--accent)}}.in{{max-width:1040px;margin:0 auto;padding:0 32px}}
.bl{{display:flex;align-items:center;gap:10px;font:600 11px/1 var(--ff);letter-spacing:.08em;text-transform:uppercase;color:#c9d3e2}}.logo{{width:28px;height:28px;border-radius:7px;background:var(--accent);display:inline-grid;place-items:center;color:#fff;font:700 11.5px var(--ff)}}
h1{{font:700 30px/1.15 var(--ff);margin:10px 0 6px}}.hd p{{margin:0;color:#dbe3ee}}nav{{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}}nav a{{color:#fff;text-decoration:none;font:600 12.5px var(--ff);border:1px solid rgba(255,255,255,.3);border-radius:20px;padding:5px 11px}}nav a:hover{{background:rgba(255,255,255,.12)}}
section{{border:1px solid #dfe4ea;border-radius:12px;padding:4px 24px 22px;margin:20px 0 0;box-shadow:0 1px 2px rgba(17,26,36,.04)}}
h2{{font:700 13px/1.3 var(--ff);letter-spacing:.07em;text-transform:uppercase;color:var(--band);margin:18px 0 12px;display:flex;align-items:center;gap:9px}}h2::before{{content:"";width:4px;height:15px;border-radius:2px;background:var(--accent)}}
h3{{font:700 16px/1.3 var(--ff);margin:22px 0 8px}}h4{{font:700 14px/1.3 var(--ff);margin:0 0 2px}}code{{font:500 13px "IBM Plex Mono",Consolas,monospace;background:#eef2f7;border-radius:5px;padding:1px 5px}}
.steps{{padding-left:22px}}.steps li{{margin:6px 0}}.note{{font-size:13px;color:#5d6874}}
.kv{{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}}.kv div{{border:1px solid #dfe4ea;border-top:3px solid var(--band);border-radius:10px;padding:9px 12px;box-shadow:0 1px 2px rgba(17,26,36,.06)}}.kv span{{display:block;font:600 12px var(--ff);color:#5d6874}}.kv b{{font:700 19px var(--ff)}}
.tw{{overflow-x:auto;border:1px solid #d5dbe3;border-radius:10px;margin:8px 0}}table{{border-collapse:collapse;width:100%;font-size:13.5px}}th,td{{padding:8px 10px;border-bottom:1px solid #e6e9ed;text-align:left;vertical-align:top}}th{{background:var(--band);color:#fff;font:700 11px var(--ff);letter-spacing:.06em;text-transform:uppercase}}tbody tr:nth-child(even) td{{background:#f8fafc}}tbody tr:last-child td{{border-bottom:0}}
.flds{{display:grid;grid-template-columns:1fr;gap:12px}}.fld{{border:1px solid #e1e5ea;border-radius:10px;padding:12px 14px}}.fld p{{margin:0 0 6px;font-size:13px;color:#5d6874}}
.code{{position:relative;background:#0f1b2e;border-radius:8px;margin-top:6px}}.code pre{{margin:0;padding:12px 14px;color:#e6edf6;font:13px/1.55 "IBM Plex Mono",Consolas,monospace;white-space:pre-wrap;word-break:break-word}}.code button{{position:absolute;top:8px;right:8px;border:1px solid rgba(255,255,255,.3);background:transparent;color:#fff;border-radius:6px;font:600 12px var(--ff);padding:3px 9px;cursor:pointer}}.code button:hover{{background:rgba(255,255,255,.12)}}
svg{{width:100%;height:auto;display:block;margin:10px 0}}.ft{{margin:30px 0 40px;font-size:12px;color:#5d6874}}@media(max-width:700px){{.kv{{grid-template-columns:repeat(2,1fr)}}.in{{padding:0 16px}}section{{padding:4px 14px 16px}}}}</style></head><body>
<header class="hd"><div class="in"><div class="bl"><span class="logo">CS</span>Cobranzas del Sur S.A. · Datos ficticios</div><h1>Power BI y Looker Studio · Caso 01</h1><p>Cómo abrir el proyecto Power BI y cómo armar el tablero en Looker Studio con tu cuenta personal.</p>
<nav><a href="#pbi">Power BI</a><a href="#looker">Looker Studio</a><a href="#control">Control de números</a><a href="#arq">Para otra empresa</a></nav></div></header><div class="acc"></div>
<main class="in"><section id="pbi"><h2>Power BI · abrir el proyecto</h2>{pbi}</section>
<section id="looker"><h2>Looker Studio · armarlo paso a paso</h2>{looker}</section>
<section id="control"><h2>Control de números (septiembre 2025)</h2>{ctrl}<p class="note">Los tres tableros (HTML, Power BI y Looker) tienen que dar lo mismo.</p></section>
<section id="arq"><h2>Para otra empresa: la arquitectura de datos</h2>{arq}</section>
<p class="ft">Generado el {datetime.date.today().strftime('%d/%m/%Y')} · Datos 100% ficticios.</p></main>
<script>document.querySelectorAll('.code button').forEach(b=>b.onclick=async()=>{{const t=document.getElementById(b.dataset.c).innerText;try{{await navigator.clipboard.writeText(t);b.textContent='Copiado'}}catch(e){{const r=document.createRange();r.selectNodeContents(document.getElementById(b.dataset.c));const s=getSelection();s.removeAllRanges();s.addRange(r);b.textContent='Ctrl+C'}}setTimeout(()=>b.textContent='Copiar',1600)}});</script></body></html>"""
out = os.path.join(D, f"{datetime.date.today().isoformat()}_guia-powerbi-looker.html")
open(out, "w", encoding="utf-8").write(page)
print("ok", out)
