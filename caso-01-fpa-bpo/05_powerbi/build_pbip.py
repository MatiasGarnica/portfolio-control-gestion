"""Genera el proyecto Power BI (PBIP: modelo en TMDL + informe en PBIR) del Caso 01 · versión 3 (diseño ejecutivo).

Uso:  python build_pbip.py [version] ["D:\\ruta\\a\\01_datos\\"]
Salida: CobranzasDelSur_<version>/  (abrir CobranzasDelSur.pbip con Power BI Desktop actualizado) y AAAA-MM-DD_PowerBI_CobranzasDelSur_<version>.zip

Modelo (estrella): Resultado, Drivers y KPI (hechos) → Calendario, Cartera, Cuenta, Escenario (dimensiones).
MesAnalisis, Vista y «Línea EERR» son tablas sin relación: las medidas leen la selección (período) o la línea del estado de resultados.
Las tarjetas, el encabezado y la narrativa son medidas DAX que devuelven una imagen SVG (pbip_svg.py).
"""
import os, sys, json, uuid, shutil, datetime, zipfile
import pbip_svg as SV

D = os.path.dirname(os.path.abspath(__file__))
VER = sys.argv[1] if len(sys.argv) > 1 else "v3"
CARPETA = sys.argv[2] if len(sys.argv) > 2 else os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "01_datos")) + os.sep  # ruta absoluta a 01_datos en tu PC
NAME = "CobranzasDelSur"
OUT_BASE = os.environ.get("PBIP_OUT", D)  # opcional: armar en otra carpeta (más rápido que una carpeta sincronizada)
OUT = os.path.join(OUT_BASE, f"{NAME}_{VER}")  # una carpeta por versión: Power BI carga todo lo que hay adentro, así no se mezclan visuales viejos
SM, RP = f"{NAME}.SemanticModel", f"{NAME}.Report"
uid = lambda seed: str(uuid.uuid5(uuid.NAMESPACE_URL, "cobranzas-del-sur/" + seed))
hid = lambda seed: uuid.uuid5(uuid.NAMESPACE_URL, "vis3/" + seed).hex[:20]

NAVY, RED, BLUE, GRAY, ORANGE, AA = SV.NAVY, SV.RED, SV.BLUE, SV.GRAY, SV.ORANGE, SV.AA
INK, INK2, INK3, LINE, GOOD, WARN, CRIT = SV.INK, SV.INK2, SV.INK3, SV.LINE, SV.GOOD, SV.WARN, SV.CRIT
BG, ORANGE_L = "#F3F5F8", "#F4A57E"
# formatos: sin escalado con comas (",," no funciona con la cultura es-AR); los millones se calculan con DIVIDE(x, 1e6)
MONEY, MONEY0, MM, SMM, PCT, SPCT, PP, RATIO, INT, NUM1 = r"\$ #,##0", r"\$ #,##0", "#,##0.0", "+#,##0.0;-#,##0.0;0.0", "0.0%", "+0.0%;-0.0%;0.0%", "+0.0;-0.0;0.0", "0.00%", "#,##0", "#,##0.0"

# ================================================================ tablas (Power Query M)
def csv_src(file, types, extra):
    t = ", ".join(f'{{"{c}", {ty}}}' for c, ty in types)
    return f"""let
    Origen = Csv.Document(File.Contents(CarpetaDatos & "{file}"), [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Encabezados = Table.PromoteHeaders(Origen, [PromoteAllScalars = true]),
    Tipos = Table.TransformColumnTypes(Encabezados, {{{t}}}, "en-US"){extra}
in
    Final"""

TXT, INT64, NUM = "type text", "Int64.Type", "type number"
TABLES = {}
TABLES["Calendario"] = dict(desc="Un registro por mes. indice = meses corridos desde enero del primer año; sirve para correr períodos y comparar con el año anterior.",
    m=csv_src("dim_fecha.csv", [("mes", TXT), ("anio", INT64), ("mes_num", INT64)], """,
    MinAnio = List.Min(Tipos[anio]),
    Nombres = {"ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"},
    ConFecha = Table.AddColumn(Tipos, "Fecha", each #date([anio], [mes_num], 1), type date),
    ConIndice = Table.AddColumn(ConFecha, "indice", each ([anio] - MinAnio) * 12 + [mes_num], Int64.Type),
    ConMes = Table.AddColumn(ConIndice, "Nombre mes", each Nombres{[mes_num] - 1}, type text),
    Final = Table.AddColumn(ConMes, "Mes año", each Nombres{[mes_num] - 1} & "-" & Text.End(Text.From([anio]), 2), type text)"""),
    cols=[("mes", "string", {}), ("anio", "int64", dict(fmt="0")), ("mes_num", "int64", dict(hidden=True)), ("Fecha", "dateTime", dict(fmt="mmm yyyy")),
          ("indice", "int64", dict(hidden=True)), ("Nombre mes", "string", dict(sort="mes_num")), ("Mes año", "string", dict(sort="indice"))])

TABLES["MesAnalisis"] = dict(desc="Meses con datos reales del último año, para elegir el mes de análisis con botones. No tiene relación: las medidas leen la selección.",
    m="""let
    Fechas = Csv.Document(File.Contents(CarpetaDatos & "dim_fecha.csv"), [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Meses = Table.TransformColumnTypes(Table.PromoteHeaders(Fechas, [PromoteAllScalars = true]), {{"mes", type text}, {"anio", Int64.Type}, {"mes_num", Int64.Type}}, "en-US"),
    MinAnio = List.Min(Meses[anio]),
    Hechos = Table.PromoteHeaders(Csv.Document(File.Contents(CarpetaDatos & "fact_resultado.csv"), [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]), [PromoteAllScalars = true]),
    MesesReales = List.Buffer(List.Distinct(Table.SelectRows(Hechos, each [esc] = "REAL")[mes])),
    ConReal = Table.SelectRows(Meses, each List.Contains(MesesReales, [mes])),
    UltimoAnio = List.Max(ConReal[anio]),
    DelAnio = Table.SelectRows(ConReal, each [anio] = UltimoAnio),
    Nombres = {"Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"},
    ConIndice = Table.AddColumn(DelAnio, "indice", each ([anio] - MinAnio) * 12 + [mes_num], Int64.Type),
    Final = Table.AddColumn(ConIndice, "Mes corto", each Nombres{[mes_num] - 1}, type text)
in
    Final""",
    cols=[("mes", "string", dict(hidden=True)), ("anio", "int64", dict(hidden=True)), ("mes_num", "int64", dict(hidden=True)), ("indice", "int64", dict(hidden=True)),
          ("Mes corto", "string", dict(sort="indice"))])

TABLES["Vista"] = dict(desc="Mes solo o acumulado del año hasta el mes elegido. Sin relación.",
    m="""let
    Final = #table(type table [Vista = text, Orden = Int64.Type], {{"Mes", 1}, {"Acumulado", 2}})
in
    Final""",
    cols=[("Vista", "string", dict(sort="Orden")), ("Orden", "int64", dict(hidden=True))])

TABLES["Escenario"] = dict(desc="Real, Presupuesto y Forecast.",
    m="""let
    Final = #table(type table [esc = text, Escenario = text, Orden = Int64.Type], {{"REAL", "Real", 1}, {"PPTO", "Presupuesto", 2}, {"FCST", "Forecast", 3}})
in
    Final""",
    cols=[("esc", "string", dict(hidden=True)), ("Escenario", "string", dict(sort="Orden")), ("Orden", "int64", dict(hidden=True))])

TABLES["Cartera"] = dict(desc="Carteras de clientes. EST agrupa los gastos de estructura que no son de ninguna cartera.",
    m=csv_src("dim_cartera.csv", [("code", TXT), ("nombre", TXT), ("industria", TXT), ("negocio", TXT), ("moneda", TXT)], """,
    ConEstructura = Table.InsertRows(Tipos, Table.RowCount(Tipos), {[code = "EST", nombre = "Estructura", industria = "Estructura", negocio = "Estructura", moneda = "ARS"]}),
    ConCartera = Table.AddColumn(ConEstructura, "Cartera", each [code] & " · " & [nombre], type text),
    Final = Table.AddColumn(ConCartera, "Nombre corto", each Text.BeforeDelimiter([nombre], " · "), type text)"""),
    cols=[("code", "string", {}), ("nombre", "string", {}), ("industria", "string", {}), ("negocio", "string", {}), ("moneda", "string", {}), ("Cartera", "string", {}),
          ("Nombre corto", "string", {})])

TABLES["Cuenta"] = dict(desc="Plan de cuentas de gestión en tres niveles: rubro (N1), subrubro (N2) e ítem. n1_orden define el estado de resultados: 1 ingresos, 2 costos de explotación, 3 impuestos directos, 4 estructura, 5 no operacional, 6 ganancias.",
    m=csv_src("dim_cuenta.csv", [("item_id", INT64), ("item", TXT), ("n2", TXT), ("n1", TXT), ("tipo", TXT), ("driver", TXT)], """,
    Codigo = Table.AddColumn(Tipos, "n2_orden", each let c = Text.BeforeDelimiter([n2], " ") in Number.From(Text.BeforeDelimiter(c, ".")) * 100 + Number.From(Text.AfterDelimiter(c, ".")), Int64.Type),
    Orden1 = Table.AddColumn(Codigo, "n1_orden", each Number.From(Text.BeforeDelimiter([n1], " ")), Int64.Type),
    Rubro = Table.AddColumn(Orden1, "Rubro", each Text.AfterDelimiter([n1], " "), type text),
    Subrubro = Table.AddColumn(Rubro, "Subrubro", each Text.AfterDelimiter([n2], " "), type text),
    Cortos = {"Ingresos", "Costos de explotación", "Impuestos directos", "Estructura", "No operacional", "Ganancias"},
    Final = Table.AddColumn(Subrubro, "Rubro corto", each Cortos{[n1_orden] - 1}, type text)"""),
    cols=[("item_id", "int64", dict(hidden=True)), ("item", "string", dict(sort="item_id")), ("n2", "string", dict(sort="n2_orden")), ("n1", "string", {}), ("tipo", "string", {}),
          ("driver", "string", {}), ("n2_orden", "int64", dict(hidden=True)), ("n1_orden", "int64", dict(hidden=True)),
          ("Rubro", "string", dict(sort="n1_orden")), ("Subrubro", "string", dict(sort="n2_orden")), ("Rubro corto", "string", dict(sort="n1_orden"))])

EERR_LINES = [(1, "Ingresos operativos", "rubro", 1, 1), (2, "Costos de explotación", "rubro", 2, 2), (3, "Impuestos directos", "rubro", 3, 3),
              (4, "MARGEN BRUTO", "sub", 1, 3), (5, "% margen bruto", "pct", 1, 3), (6, "Gastos de estructura", "rubro", 4, 4), (7, "MARGEN OPERATIVO", "sub", 1, 4),
              (8, "% margen operativo", "pct", 1, 4), (9, "Resultado no operacional", "rubro", 5, 5), (10, "RESULTADO ANTES DE IMPUESTOS", "sub", 1, 5),
              (11, "Impuesto a las ganancias", "rubro", 6, 6), (12, "UTILIDAD NETA", "sub", 1, 6), (13, "% margen neto", "pct", 1, 6)]
TABLES["Línea EERR"] = dict(desc="Renglones del estado de resultados ejecutivo (rubros, subtotales y márgenes). Sin relación: cada renglón suma los rubros n1_orden entre Desde y Hasta.",
    m="let\n    Final = #table(type table [Orden = Int64.Type, Línea = text, Tipo = text, Desde = Int64.Type, Hasta = Int64.Type], {\n"
      + ",\n".join(f'        {{{o}, "{l}", "{t}", {a}, {b}}}' for o, l, t, a, b in EERR_LINES) + "})\nin\n    Final",
    cols=[("Orden", "int64", dict(hidden=True)), ("Línea", "string", dict(sort="Orden")), ("Tipo", "string", dict(hidden=True)), ("Desde", "int64", dict(hidden=True)), ("Hasta", "int64", dict(hidden=True))])

TABLES["Resultado"] = dict(desc="Estado de resultados de gestión por escenario, mes, cartera e ítem. Ingresos en positivo, costos en negativo.",
    m=csv_src("fact_resultado.csv", [("esc", TXT), ("mes", TXT), ("cartera", TXT), ("item_id", INT64), ("importe_ars", NUM), ("importe_usd", NUM)], """,
    Final = Table.SelectColumns(Tipos, {"esc", "mes", "cartera", "item_id", "importe_ars", "importe_usd"})"""),
    cols=[("esc", "string", dict(hidden=True)), ("mes", "string", dict(hidden=True)), ("cartera", "string", dict(hidden=True)), ("item_id", "int64", dict(hidden=True)),
          ("importe_ars", "double", dict(hidden=True)), ("importe_usd", "double", dict(hidden=True))])

DRV = [("U", NUM), ("I", NUM), ("E", NUM), ("P", NUM), ("FX", NUM), ("ops", NUM), ("py", NUM), ("minutos", NUM), ("sms", NUM), ("mails", NUM), ("pagos", NUM), ("informes", NUM), ("wa", NUM), ("deuda", NUM), ("ingreso", NUM)]
TABLES["Drivers"] = dict(desc="Drivers por cartera y mes: deuda asignada, % de recupero (E), fee (P), tipo de cambio (FX), posiciones y volumen de canales.",
    m=csv_src("fact_drivers_cartera.csv", [("esc", TXT), ("mes", TXT), ("cartera", TXT)] + DRV, """,
    Final = Tipos"""),
    cols=[("esc", "string", dict(hidden=True)), ("mes", "string", dict(hidden=True)), ("cartera", "string", dict(hidden=True))] + [(c, "double", dict(hidden=True)) for c, _ in DRV])

KPI = [("tc", NUM), ("operadores", NUM), ("posiciones_py", NUM), ("posiciones", NUM), ("horas", NUM), ("costo_operador", NUM), ("costo_sms", NUM), ("costo_minuto", NUM), ("indice_precios", NUM), ("indice_salarial", NUM)]
TABLES["KPI"] = dict(desc="Indicadores de operación por escenario y mes: tipo de cambio, dotación, horas y costos unitarios.",
    m=csv_src("fact_kpi_operacion.csv", [("esc", TXT), ("mes", TXT)] + KPI, """,
    Final = Table.RenameColumns(Tipos, {{"posiciones", "posiciones_total"}})"""),
    cols=[("esc", "string", dict(hidden=True)), ("mes", "string", dict(hidden=True))] + [(c if c != "posiciones" else "posiciones_total", "double", dict(hidden=True)) for c, _ in KPI])

TABLES["_Medidas"] = dict(desc="Todas las medidas del modelo, ordenadas en carpetas.",
    m="""let
    Final = #table(type table [Medidas = text], {})
in
    Final""",
    cols=[("Medidas", "string", dict(hidden=True))])

RELS = [("Resultado", "mes", "Calendario", "mes"), ("Resultado", "cartera", "Cartera", "code"), ("Resultado", "item_id", "Cuenta", "item_id"), ("Resultado", "esc", "Escenario", "esc"),
        ("Drivers", "mes", "Calendario", "mes"), ("Drivers", "cartera", "Cartera", "code"), ("Drivers", "esc", "Escenario", "esc"),
        ("KPI", "mes", "Calendario", "mes"), ("KPI", "esc", "Escenario", "esc")]

# ================================================================ medidas (DAX)
M = []  # (carpeta, nombre, dax, formato, descripción, categoría)
def add(folder, name, dax, fmt, desc, cat=None): M.append((folder, name, dax, fmt, desc, cat))
F0, F1, F2, F3, F4, F5, F6, F7 = ("0. Período", "1. Base", "2. Período elegido", "3. Indicadores", "4. Series mensuales", "5. Estado de resultados",
                                  "6. Formato y colores", "7. Imágenes SVG")

add(F0, "Índice de corte", """VAR meses =
    CALCULATETABLE(VALUES(Resultado[mes]), REMOVEFILTERS(), Escenario[esc] = "REAL")
RETURN
    CALCULATE(MAX(Calendario[indice]), REMOVEFILTERS(), TREATAS(meses, Calendario[mes]))""", INT, "Último mes con datos reales (índice de Calendario), sin importar los filtros. Hoy: septiembre 2025.")
add(F0, "Índice hasta", """VAR elegido = SELECTEDVALUE(MesAnalisis[indice])
RETURN IF(ISBLANK(elegido), [Índice de corte], elegido)""", INT, "Mes de análisis: el elegido con los botones de mes o, si no hay ninguno, el último mes real.")
add(F0, "Índice desde", """VAR h = [Índice hasta]
VAR acumulado = SELECTEDVALUE(Vista[Vista], "Mes") = "Acumulado"
VAR mesDelAnio = CALCULATE(MAX(Calendario[mes_num]), REMOVEFILTERS(Calendario), Calendario[indice] = h)
RETURN IF(acumulado, h - mesDelAnio + 1, h)""", INT, "Primer mes del período: el mismo mes (vista Mes) o enero de ese año (vista Acumulado).")
add(F0, "Año de análisis", """VAR h = [Índice hasta]
RETURN CALCULATE(MAX(Calendario[anio]), REMOVEFILTERS(Calendario), Calendario[indice] = h)""", "0", "Año del mes de análisis. Las series mensuales muestran ese año.")
add(F0, "Período", """VAR h = [Índice hasta]
VAR d = [Índice desde]
VAR txtH = CALCULATE(SELECTEDVALUE(Calendario[Mes año]), REMOVEFILTERS(Calendario), Calendario[indice] = h)
VAR txtD = CALCULATE(SELECTEDVALUE(Calendario[Mes año]), REMOVEFILTERS(Calendario), Calendario[indice] = d)
RETURN IF(d = h, txtH, txtD & " a " & txtH)""", None, "Período corto (sep-25 o ene-25 a sep-25), para títulos.")
add(F0, "Período largo", """VAR h = [Índice hasta]
VAR d = [Índice desde]
VAR fh = CALCULATE(MAX(Calendario[Fecha]), REMOVEFILTERS(Calendario), Calendario[indice] = h)
VAR mesTxt = FORMAT(fh, "mmmm", "es-AR")
VAR mesCap = UPPER(LEFT(mesTxt, 1)) & MID(mesTxt, 2, 20)
RETURN IF(d = h, mesCap & " " & YEAR(fh), "Enero a " & mesTxt & " " & YEAR(fh))""", None, "Período en palabras (Septiembre 2025 o Enero a septiembre 2025), para el encabezado.")
add(F0, "Datos al", """VAR c = [Índice de corte]
VAR f = CALCULATE(MAX(Calendario[Fecha]), REMOVEFILTERS(Calendario), Calendario[indice] = c)
RETURN FORMAT(EOMONTH(f, 0), "dd/mm/yyyy", "es-AR")""", None, "Último día del último mes con datos reales.")

# ---- base (sin período: responden al contexto del visual)
add(F1, "Importe", "SUM(Resultado[importe_ars])", MONEY, "Suma del estado de resultados en pesos, en el contexto que tenga el visual.")
add(F1, "Ingresos", "CALCULATE([Importe], Cuenta[n1_orden] = 1)", MONEY, "Ingreso operacional (rubro 1).")
add(F1, "Margen bruto", "CALCULATE([Importe], Cuenta[n1_orden] <= 3)", MONEY, "Ingresos menos costos de explotación e impuestos directos. Por cartera es su margen de contribución.")
add(F1, "Margen operativo", "CALCULATE([Importe], Cuenta[n1_orden] <= 4)", MONEY, "Margen bruto menos gastos de estructura.")
add(F1, "Utilidad neta", "CALCULATE([Importe], REMOVEFILTERS(Cuenta))", MONEY, "Resultado final, después del resultado no operacional y del impuesto a las ganancias.")
add(F1, "Margen bruto %", "DIVIDE([Margen bruto], [Ingresos])", PCT, "Margen bruto sobre ingresos.")
add(F1, "Margen operativo %", "DIVIDE([Margen operativo], [Ingresos])", PCT, "Margen operativo sobre ingresos.")
add(F1, "Deuda asignada", "SUM(Drivers[deuda])", MONEY, "Deuda que el cliente asigna para gestionar.")
add(F1, "Recuperado", "SUMX(Drivers, Drivers[deuda] * Drivers[E])", MONEY, "Deuda cobrada: deuda asignada × % de recupero.")
add(F1, "% recupero", "DIVIDE([Recuperado], [Deuda asignada])", PCT, "Parte de la deuda asignada que se cobró, ponderada por deuda.")
add(F1, "Fee", "DIVIDE(SUM(Drivers[ingreso]), SUMX(Drivers, Drivers[deuda] * Drivers[E] * Drivers[FX]))", RATIO, "Comisión sobre lo recuperado, ponderada.")
add(F1, "Posiciones", "SUM(Drivers[ops]) + SUM(Drivers[py])", INT, "Operadores en Argentina más posiciones en Paraguay (suma de los meses del contexto).")
add(F1, "Posiciones promedio", "AVERAGEX(VALUES(Calendario[indice]), [Posiciones])", NUM1, "Posiciones promedio por mes.")
add(F1, "Horas de posición", "SUMX(VALUES(Calendario[indice]), [Posiciones] * 132)", INT, "Horas disponibles: posiciones de cada mes × 132 horas.")
add(F1, "Ingreso por hora", "DIVIDE([Ingresos], [Horas de posición])", MONEY0, "Ingreso por hora de posición.")

# ---- período elegido
def P(esc, mode, base):
    if mode == "ma":
        return f"""VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    IF(
        d = h,
        CALCULATE(
            {base},
            Escenario[esc] = "{esc}",
            REMOVEFILTERS(Calendario),
            Calendario[indice] = h - 1
        )
    )"""
    s = " - 12" if mode == "aa" else ""
    return f"""VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        {base},
        Escenario[esc] = "{esc}",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d{s},
        Calendario[indice] <= h{s}
    )"""

SUF = {"real": ("REAL", "per", "real del período elegido"), "presupuesto": ("PPTO", "per", "presupuestado para el período elegido"),
       "forecast": ("FCST", "per", "del forecast para el período elegido"), "mes anterior": ("REAL", "ma", "real del mes anterior (solo en vista Mes)"),
       "año anterior": ("REAL", "aa", "real de los mismos meses del año anterior")}
add(F2, "Real · período", P("REAL", "per", "[Importe]"), MONEY, "Real del período elegido. Respeta los filtros de cartera y cuenta del visual.")
add(F2, "Presupuesto · período", P("PPTO", "per", "[Importe]"), MONEY, "Presupuesto del período elegido.")
add(F2, "Forecast · período", P("FCST", "per", "[Importe]"), MONEY, "Forecast del período elegido.")
add(F2, "Año anterior · período", P("REAL", "aa", "[Importe]"), MONEY, "Real de los mismos meses del año anterior.")
add(F2, "Desvío vs presupuesto", "[Real · período] - [Presupuesto · período]", MONEY, "Real menos presupuesto. Positivo es a favor también en costos (los costos son negativos).")
add(F2, "Desvío vs presupuesto %", "DIVIDE([Real · período] - [Presupuesto · período], ABS([Presupuesto · período]))", SPCT, "Desvío sobre el valor absoluto del presupuesto: positivo es mejor que lo previsto.")
add(F2, "Variación vs año anterior %", "DIVIDE([Real · período] - [Año anterior · período], ABS([Año anterior · período]))", SPCT, "Variación contra los mismos meses del año anterior (en pesos corrientes: incluye inflación).")
for n, src in [("Real", "Real · período"), ("Presupuesto", "Presupuesto · período"), ("Forecast", "Forecast · período"), ("Año anterior", "Año anterior · período"), ("Desvío vs presupuesto", "Desvío vs presupuesto")]:
    add(F2, f"{n} · período M$", f"DIVIDE([{src}], 1000000)", SMM if n.startswith("Desvío") else MM, f"{src} en millones de pesos.")

FAM = [("Ingresos", MONEY, ["real", "presupuesto", "forecast", "mes anterior", "año anterior"]),
       ("Margen bruto", MONEY, ["real", "presupuesto"]), ("Margen bruto %", PCT, ["real", "presupuesto"]),
       ("Margen operativo", MONEY, ["real", "presupuesto"]), ("Margen operativo %", PCT, ["real", "presupuesto", "forecast", "mes anterior", "año anterior"]),
       ("Utilidad neta", MONEY, ["real", "presupuesto", "forecast", "mes anterior", "año anterior"]),
       ("Ingreso por hora", MONEY0, ["real", "presupuesto", "mes anterior", "año anterior"]),
       ("% recupero", PCT, ["real", "presupuesto", "mes anterior", "año anterior"]), ("Fee", RATIO, ["real", "presupuesto", "mes anterior", "año anterior"]),
       ("Deuda asignada", MONEY, ["real", "presupuesto", "mes anterior", "año anterior"]), ("Posiciones promedio", NUM1, ["real", "presupuesto", "mes anterior", "año anterior"])]
for base, fmt, sufs in FAM:
    for s in sufs:
        esc, mode, txt = SUF[s]
        add(F3, f"{base} · {s}", P(esc, mode, f"[{base}]"), fmt, f"{base}: {txt}.")
add(F3, "Ingresos · real M$", "DIVIDE([Ingresos · real], 1000000)", MM, "Ingresos reales del período en millones.")
add(F3, "Margen bruto · real M$", "DIVIDE([Margen bruto · real], 1000000)", MM, "Margen bruto (contribución) real del período en millones.")
add(F3, "Ingresos vs presupuesto %", "DIVIDE([Ingresos · real] - [Ingresos · presupuesto], ABS([Ingresos · presupuesto]))", SPCT, "Desvío de ingresos contra presupuesto.")
add(F3, "Ingresos vs año anterior %", "DIVIDE([Ingresos · real] - [Ingresos · año anterior], ABS([Ingresos · año anterior]))", SPCT, "Variación de ingresos contra el año anterior.")
add(F3, "Ingresos · desvío vs presupuesto M$", """VAR r = [Ingresos · real]
VAR p = [Ingresos · presupuesto]
RETURN IF(NOT(ISBLANK(r)) || NOT(ISBLANK(p)), DIVIDE(r - p, 1000000))""", SMM, "Ingresos reales menos presupuestados, en millones (vacío para Estructura).")
add(F3, "% recupero · desvío vs presupuesto (pp)", """VAR r = [% recupero · real]
VAR p = [% recupero · presupuesto]
RETURN IF(NOT(ISBLANK(r)) && NOT(ISBLANK(p)), (r - p) * 100)""", PP, "Diferencia de % de recupero real contra presupuesto, en puntos porcentuales.")
add(F3, "Cierre proyectado", """VAR corte = [Índice de corte]
VAR anio = [Año de análisis]
VAR realHastaCorte =
    CALCULATE([Utilidad neta], Escenario[esc] = "REAL", REMOVEFILTERS(Calendario), Calendario[anio] = anio, Calendario[indice] <= corte)
VAR forecastResto =
    CALCULATE([Utilidad neta], Escenario[esc] = "FCST", REMOVEFILTERS(Calendario), Calendario[anio] = anio, Calendario[indice] > corte)
RETURN realHastaCorte + forecastResto""", MONEY, "Utilidad neta del año proyectada: real de los meses cerrados más forecast de los que faltan (latest estimate).")
for n, esc, shift, d in [("Presupuesto anual", "PPTO", "", "Utilidad neta presupuestada para todo el año."), ("Forecast anual", "FCST", "", "Utilidad neta del forecast para todo el año."),
                         ("Real año anterior completo", "REAL", " - 1", "Utilidad neta real de todo el año anterior.")]:
    add(F3, n, f"""VAR anio = [Año de análisis]
RETURN CALCULATE([Utilidad neta], Escenario[esc] = "{esc}", REMOVEFILTERS(Calendario), Calendario[anio] = anio{shift})""", MONEY, d)

# ---- series mensuales (eje = Calendario[Mes año]); muestran el año de análisis
def MS(base, kind):
    pre = """VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        """
    body = {"real": f'CALCULATE({base}, Escenario[esc] = "REAL")', "presupuesto": f'CALCULATE({base}, Escenario[esc] = "PPTO")',
            "forecast": f'CALCULATE({base}, Escenario[esc] = "FCST")',
            "año anterior": f'CALCULATE({base}, Escenario[esc] = "REAL", REMOVEFILTERS(Calendario), Calendario[indice] = i - 12)',
            "proyección": f'IF(i > c, CALCULATE({base}, Escenario[esc] = "FCST"), IF(i = c, CALCULATE({base}, Escenario[esc] = "REAL")))',
            "real o forecast": f'IF(i <= c, CALCULATE({base}, Escenario[esc] = "REAL"), CALCULATE({base}, Escenario[esc] = "FCST"))'}[kind]
    return pre + body + "\n    )"
SDESC = {"real": "real", "presupuesto": "presupuestado", "forecast": "del forecast", "año anterior": "real del mismo mes del año anterior",
         "proyección": "del forecast desde el último mes real (arranca en el último real para que la línea quede unida)", "real o forecast": "real hasta el último mes cerrado y forecast después"}
SERIES = [("Ingresos", MONEY, ["real", "presupuesto", "forecast", "año anterior", "real o forecast"]), ("Margen operativo %", PCT, ["real", "presupuesto", "forecast", "proyección"]),
          ("Utilidad neta", MONEY, ["real", "presupuesto", "forecast"]), ("Ingreso por hora", MONEY0, ["real", "presupuesto", "forecast"]),
          ("% recupero", PCT, ["real", "presupuesto", "forecast", "proyección"]), ("Fee", RATIO, ["real", "presupuesto", "forecast", "proyección"]),
          ("Deuda asignada", MONEY, ["real", "presupuesto", "forecast", "proyección"]), ("Posiciones", INT, ["real", "presupuesto", "forecast", "proyección"])]
for base, fmt, kinds in SERIES:
    for k in kinds:
        add(F4, f"{base} (mes) · {k}", MS(f"[{base}]", k), fmt, f"{base} {SDESC[k]} del mes del eje (solo el año de análisis).")
for k in ["real o forecast", "presupuesto", "año anterior"]:
    add(F4, f"Ingresos (mes) M$ · {k}", f"DIVIDE([Ingresos (mes) · {k}], 1000000)", MM, f"Ingresos (mes) · {k}, en millones.")
for k in ["real", "presupuesto", "proyección"]:
    add(F4, f"Deuda asignada (mes) M$ · {k}", f"DIVIDE([Deuda asignada (mes) · {k}], 1000000)", MM, f"Deuda asignada (mes) · {k}, en millones.")

# ---- estado de resultados ejecutivo (tabla «Línea EERR»)
def EV(per):
    return f"""VAR d = SELECTEDVALUE('Línea EERR'[Desde])
VAR h = SELECTEDVALUE('Línea EERR'[Hasta])
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
VAR v = CALCULATE([{per}], Cuenta[n1_orden] >= d && Cuenta[n1_orden] <= h)
VAR ing = CALCULATE([{per}], Cuenta[n1_orden] = 1)
RETURN
    IF(NOT(ISBLANK(d)), IF(esPct, DIVIDE(v, ing), v))"""
for n, per in [("real", "Real · período"), ("presupuesto", "Presupuesto · período"), ("forecast", "Forecast · período"), ("año anterior", "Año anterior · período")]:
    add(F5, f"EERR · {n} (valor)", EV(per), None, f"Valor del renglón del estado de resultados ({n}): suma de los rubros del renglón, o margen sobre ingresos en los renglones de %.")
ESPCT = "VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = \"pct\""
TXT_VAL = lambda v: f'IF(esPct, {SV.F_PCT(v)}, SUBSTITUTE(FORMAT({v} / 1000000, "#,##0.0", "es-AR"), "-", "−"))'
for n, lbl in [("real", "Real"), ("presupuesto", "Presupuesto"), ("forecast", "Forecast"), ("año anterior", "Año anterior")]:
    add(F5, f"EERR · {lbl}", f"""VAR v = [EERR · {n} (valor)]
{ESPCT}
RETURN IF(NOT(ISBLANK(v)), {TXT_VAL("v")})""", None, f"{lbl} del renglón, como texto: millones de pesos o % según el renglón.")
add(F5, "EERR · Desvío", f"""VAR r = [EERR · real (valor)]
VAR p = [EERR · presupuesto (valor)]
{ESPCT}
RETURN
    IF(
        NOT(ISBLANK(r)) && NOT(ISBLANK(p)),
        IF(esPct, {SV.F_PP("r - p")}, SUBSTITUTE(FORMAT((r - p) / 1000000, "+#,##0.0;-#,##0.0;0.0", "es-AR"), "-", "−"))
    )""", None, "Real menos presupuesto: millones de pesos, o puntos porcentuales en los renglones de margen.")
add(F5, "EERR · Desvío %", f"""VAR r = [EERR · real (valor)]
VAR p = [EERR · presupuesto (valor)]
{ESPCT}
RETURN IF(NOT(esPct) && NOT(ISBLANK(r)) && NOT(ISBLANK(p)) && p <> 0, {SV.F_SPCT("DIVIDE(r - p, ABS(p))")})""", None, "Desvío sobre el valor absoluto del presupuesto (no aplica a los renglones de margen).")
add(F5, "EERR · Var. año anterior", f"""VAR r = [EERR · real (valor)]
VAR a = [EERR · año anterior (valor)]
{ESPCT}
RETURN
    IF(
        NOT(ISBLANK(r)) && NOT(ISBLANK(a)),
        IF(esPct, {SV.F_PP("r - a")}, IF(a <> 0, {SV.F_SPCT("DIVIDE(r - a, ABS(a))")}))
    )""", None, "Variación contra el año anterior: % en los rubros, puntos porcentuales en los márgenes.")
def COLOR_DEV(r, p, pct_expr=None):
    e = f"IF(esPct, {r} - {p}, DIVIDE({r} - {p}, ABS({p})))" if pct_expr is None else pct_expr
    return f"""IF(ISBLANK({r}) || ISBLANK({p}), "{INK3}", VAR e = {e} RETURN IF(ABS(e) < 0.005, "{INK3}", IF(e > 0, "{GOOD[0]}", "{CRIT[0]}")))"""
add(F5, "EERR · color desvío", f"""VAR r = [EERR · real (valor)]
VAR p = [EERR · presupuesto (valor)]
{ESPCT}
RETURN {COLOR_DEV("r", "p")}""", None, "Verde si el renglón está mejor que el presupuesto, rojo si está peor, gris si la diferencia es menor a 0,5%.")
add(F5, "EERR · color var. año anterior", f"""VAR r = [EERR · real (valor)]
VAR p = [EERR · año anterior (valor)]
{ESPCT}
RETURN {COLOR_DEV("r", "p")}""", None, "Verde si el renglón mejora contra el año anterior, rojo si empeora.")
add(F5, "EERR · fondo", f"""SWITCH(SELECTEDVALUE('Línea EERR'[Tipo]), "sub", "#E9EEF6", "pct", "#FAFBFD", "#FFFFFF")""", None, "Fondo del renglón: subtotales resaltados.")
add(F5, "EERR · color texto", f"""SWITCH(SELECTEDVALUE('Línea EERR'[Tipo]), "sub", "{NAVY}", "pct", "{INK3}", "{INK}")""", None, "Color del texto del renglón: subtotales en azul marino, márgenes en gris.")

# ---- colores y ejes
add(F6, "Color · desvío presupuesto", f"""VAR r = [Real · período]
VAR p = [Presupuesto · período]
VAR esPct = FALSE()
RETURN {COLOR_DEV("r", "p")}""", None, "Verde a favor, rojo en contra, gris si la diferencia es menor a 0,5% (sirve para ingresos y costos).")
add(F6, "Color · variación año anterior", f"""VAR r = [Real · período]
VAR p = [Año anterior · período]
VAR esPct = FALSE()
RETURN {COLOR_DEV("r", "p")}""", None, "Verde si mejora contra el año anterior, rojo si empeora.")
add(F6, "Color · desvío ingresos", f"""VAR r = [Ingresos · real]
VAR p = [Ingresos · presupuesto]
VAR esPct = FALSE()
RETURN {COLOR_DEV("r", "p")}""", None, "Color del desvío de ingresos contra presupuesto.")
add(F6, "Color · ingresos vs año anterior", f"""VAR r = [Ingresos · real]
VAR p = [Ingresos · año anterior]
VAR esPct = FALSE()
RETURN {COLOR_DEV("r", "p")}""", None, "Color de la variación de ingresos contra el año anterior.")
add(F6, "Color · desvío recupero", f"""VAR d = [% recupero · desvío vs presupuesto (pp)]
RETURN IF(ISBLANK(d), "{INK3}", IF(ABS(d) < 0.1, "{INK3}", IF(d > 0, "{GOOD[0]}", "{CRIT[0]}")))""", None, "Verde si el recupero supera al presupuesto, rojo si queda abajo.")
add(F6, "Color · margen bruto", f"""VAR m = [Margen bruto % · real]
RETURN IF(m >= 0.25, "{GOOD[0]}", IF(m >= 0.10, "#C98A00", "{CRIT[0]}"))""", None, "Semáforo de margen de contribución: ≥ 25% verde, 10–25% ámbar, < 10% rojo.")
add(F6, "Color · real o forecast (mes)", f"""IF(MAX(Calendario[indice]) <= [Índice de corte], "{NAVY}", "{ORANGE_L}")""", None, "Columnas del año: azul marino los meses reales, naranja claro los de forecast.")
add(F6, "Eje ingresos (máx)", """VAR a = [Año de análisis]
VAR t =
    ADDCOLUMNS(
        FILTER(ALL(Calendario[indice], Calendario[anio]), Calendario[anio] = a),
        "@m", MAX(MAX([Ingresos (mes) M$ · real o forecast], [Ingresos (mes) M$ · presupuesto]), [Ingresos (mes) M$ · año anterior])
    )
RETURN MAXX(t, [@m]) * 1.12""", MM, "Tope del eje del gráfico de ingresos: mismo máximo para columnas y líneas.")

# ---- textos de variación y títulos
F8 = "8. Textos y títulos"
for base, lbl, kind in [("Ingresos", "Ingresos", "pct"), ("Margen operativo %", "Margen operativo", "pp"), ("Utilidad neta", "Utilidad neta", "pct"), ("Ingreso por hora", "Ingreso por hora", "pct")]:
    for ref in ["presupuesto", "mes anterior", "año anterior"]:
        e = "DIVIDE(c - r, ABS(r))" if kind == "pct" else "c - r"
        num = SV.F_SPCT("e") if kind == "pct" else SV.F_PP("e")
        add(F8, f"Texto · {lbl} vs {ref}", f"""VAR c = [{base} · real]
VAR r = [{base} · {ref}]
RETURN
    IF(
        NOT(ISBLANK(c)) && NOT(ISBLANK(r)) && r <> 0,
        VAR e = {e}
        RETURN IF(e >= 0, "▲ ", "▼ ") & {num} & " vs {ref}"
    )""", None, f"{lbl} real contra {ref}, como texto con flecha (▲ arriba, ▼ abajo). Para tarjetas nativas, títulos o tooltips.")
        add(F8, f"Color texto · {lbl} vs {ref}", f"""VAR c = [{base} · real]
VAR r = [{base} · {ref}]
RETURN IF(ISBLANK(c) || ISBLANK(r), "{INK3}", IF(c >= r, "{GOOD[0]}", "{CRIT[0]}"))""", None, f"Verde si {lbl.lower()} supera al {ref}, rojo si queda abajo: para formato condicional del texto.")
add(F8, "Título · ingresos del año", '"Ingresos " & [Año de análisis] & ", mes a mes"', None, "Título del gráfico de ingresos con el año de análisis.")
add(F8, "Título · margen operativo del año", '"Margen operativo " & [Año de análisis] & ", mes a mes"', None, "Título del gráfico de margen operativo con el año de análisis.")

# ---- imágenes SVG
def svg(name, dax, desc): add(F7, name, dax, None, desc, "ImageUrl")
PAGES_T = [("Resumen", "Resumen del período"), ("Estado de resultados", "de gestión, contra presupuesto, forecast y año anterior"), ("Carteras", "rentabilidad y productividad"),
           ("Drivers", "recupero, fee, deuda y posiciones"), ("Cómo se usa", "período, modelo y control de números")]
for t, sub in PAGES_T:
    svg(f"SVG · encabezado {t}", SV.header(t, sub if t != "Resumen" else "del período")[0], f"Banda de encabezado de la página {t}, con el período y la fecha de datos.")
svg("SVG · leyenda", SV.legend()[0], "Referencia de colores: real, presupuesto, forecast y año anterior.")
LAB = ["vs presupuesto", "vs mes anterior", "vs año anterior"]
def card(base, label, fmt, kind, money, up, w=240):
    comps = [(l, f"[{base} · real]", f"[{base} · {s}]", kind, money and i == 0, up) for i, (l, s) in enumerate(zip(LAB, ["presupuesto", "mes anterior", "año anterior"]))]
    series = (f"[{base} (mes) · real]", f"[{base} (mes) · presupuesto]", f"[{base} (mes) · forecast]")
    return SV.kpi_card(label, f"[{base} · real]", fmt, comps, series=series, w=w)[0]
CARDS = [("Ingresos", "Ingresos", "money", "pct", True, True), ("Margen operativo %", "Margen operativo", "pct", "pp", False, True),
         ("Utilidad neta", "Utilidad neta", "money", "pct", True, True), ("Ingreso por hora", "Ingreso por hora", "money0", "pct", False, True)]
for base, label, fmt, kind, money, up in CARDS:
    svg(f"SVG · tarjeta {label}", card(base, label, fmt, kind, money, up), f"Tarjeta de {label.lower()}: valor del período, estado, comparación con presupuesto, mes anterior y año anterior, y tendencia del año.")
svg("SVG · tarjeta Cierre proyectado", SV.kpi_card("Cierre proyectado del año", "[Cierre proyectado]", "money",
    [("vs presupuesto anual", "[Cierre proyectado]", "[Presupuesto anual]", "pct", True, True), ("vs forecast anual", "[Cierre proyectado]", "[Forecast anual]", "pct", False, True),
     ("vs año anterior completo", "[Cierre proyectado]", "[Real año anterior completo]", "pct", False, True)],
    series=("[Utilidad neta (mes) · real]", "[Utilidad neta (mes) · presupuesto]", "[Utilidad neta (mes) · forecast]"), cum=True)[0],
    "Tarjeta del cierre proyectado: utilidad neta acumulada real, forecast hasta diciembre y presupuesto acumulado.")
DCARDS = [("% recupero", "% de recupero", "pct", "pp", False, True), ("Fee", "Fee promedio", "ratio2", "pp2", False, True),
          ("Deuda asignada", "Deuda asignada", "money", "pct", False, True), ("Posiciones", "Posiciones", "num", "int", False, None)]
for base, label, fmt, kind, money, up in DCARDS:
    b2 = "Posiciones promedio" if base == "Posiciones" else base
    comps = [(l, f"[{b2} · real]", f"[{b2} · {s}]", kind, False, up) for l, s in zip(LAB, ["presupuesto", "mes anterior", "año anterior"])]
    svg(f"SVG · tarjeta {label}", SV.kpi_card(label, f"[{b2} · real]", fmt, comps, series=(f"[{base} (mes) · real]", f"[{base} (mes) · presupuesto]", f"[{base} (mes) · forecast]"), w=249)[0],
        f"Tarjeta de {label.lower()} para la página Drivers.")
svg("SVG · lo que hay que saber", SV.narrative()[0], "Narrativa automática del período: ingresos, margen, carteras más lejos y por encima del presupuesto y cierre proyectado.")
svg("SVG · ingresos real vs presupuesto", SV.bullet_cell("[Ingresos · real]", "[Ingresos · presupuesto]", "Cartera[Cartera]")[0], "Bala para la tabla de carteras: barra real sobre la franja del presupuesto.")
svg("SVG · margen bruto", SV.pill_cell("[Margen bruto % · real]", "Cartera[Cartera]")[0], "Píldora de margen de contribución con semáforo.")

# ================================================================ control de nombres (Power BI no distingue mayúsculas)
_allcols = set()
for _t, _sp in TABLES.items():
    _low = [c.lower() for c, *_ in _sp["cols"]]
    assert len(_low) == len(set(_low)), f"columnas repetidas en {_t}: {_low}"
    _allcols |= set(_low)
_mn = [n.lower() for _, n, *_ in M]
assert len(_mn) == len(set(_mn)), "medidas repetidas: " + str([n for n in _mn if _mn.count(n) > 1])
_clash = (set(_mn) & _allcols) | (set(_mn) & {t.lower() for t in TABLES})
assert not _clash, f"medidas con nombre de columna o tabla: {_clash}"
import re as _re
_names = {n for _, n, *_ in M}
for _, n, dax, *_ in M:
    for ref in _re.findall(r"(?<![\w'\]])\[([^\]]+)\]", dax):
        if ref.startswith("@"): continue
        assert ref in _names or ref.lower() in _allcols or ref in ("v",), f"«{n}» usa [{ref}] que no existe"

# ================================================================ escritura TMDL
def q(n): return f"'{n}'" if any(ch in n for ch in " .=:'·%()$") or not n.isascii() else n
def desc_lines(text, ind): return "".join(f"{ind}/// {l}\n" for l in text.split("\n"))
def expr_block(dax, ind):
    lines = dax.split("\n")
    if len(lines) == 1: return " " + lines[0] + "\n"
    return "\n" + "".join(f"{ind}{l}\n" for l in lines)
def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w", encoding="utf-8", newline="\n").write(text)

def _rmtree(path):  # la carpeta sincronizada a veces tarda en soltar archivos: reintenta
    import time
    for k in range(6):
        try:
            if os.path.exists(path): shutil.rmtree(path)
            return
        except OSError:
            time.sleep(1 + k)
    shutil.rmtree(path)
_rmtree(OUT)
sm = os.path.join(OUT, SM)
write(os.path.join(sm, "definition.pbism"), json.dumps({"$schema": "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json", "version": "4.2", "settings": {"qnaEnabled": False}}, indent=2))
write(os.path.join(sm, ".platform"), json.dumps({"$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
    "metadata": {"type": "SemanticModel", "displayName": NAME}, "config": {"version": "2.0", "logicalId": uid("sm")}}, indent=2))
write(os.path.join(sm, "definition", "database.tmdl"), "database\n\tcompatibilityLevel: 1600\n\n")
order = ["Calendario", "MesAnalisis", "Vista", "Escenario", "Cartera", "Cuenta", "Línea EERR", "Resultado", "Drivers", "KPI", "_Medidas"]
assert set(order) == set(TABLES)
write(os.path.join(sm, "definition", "model.tmdl"), "model Model\n\tculture: es-AR\n\tdefaultPowerBIDataSourceVersion: powerBI_V3\n\tdiscourageImplicitMeasures\n\tsourceQueryCulture: es-AR\n\tdataAccessOptions\n\t\tlegacyRedirects\n\t\treturnErrorValuesAsNull\n\n"
      + "annotation __PBI_TimeIntelligenceEnabled = 0\n\n" + 'annotation PBI_QueryOrder = ["CarpetaDatos",' + ",".join(f'"{t}"' for t in order) + "]\n\n"
      + "".join(f"ref table {q(t)}\n" for t in order))
write(os.path.join(sm, "definition", "expressions.tmdl"),
      "/// Carpeta donde están los CSV del caso (01_datos). Si la moviste, cambiala en Transformar datos > Editar parámetros.\n"
      f'expression CarpetaDatos = "{CARPETA}" meta [IsParameterQuery = true, Type = "Text", IsParameterQueryRequired = true]\n\n\tannotation PBI_ResultType = Text\n\n')
for t, spec in TABLES.items():
    s = desc_lines(spec["desc"], "") + f"table {q(t)}\n"
    if t == "_Medidas":
        for folder, name, dax, fmt, d, cat in M:
            s += "\n" + desc_lines(d, "\t") + f"\tmeasure {q(name)} =" + expr_block(dax, "\t\t\t")
            if fmt: s += f"\t\tformatString: {fmt}\n"
            if cat: s += f"\t\tdataCategory: {cat}\n"
            s += f"\t\tdisplayFolder: {folder}\n"
    for c, dt, o in spec["cols"]:
        s += f"\n\tcolumn {q(c)}\n\t\tdataType: {dt}\n"
        if o.get("hidden"): s += "\t\tisHidden\n"
        if o.get("fmt"): s += f"\t\tformatString: {o['fmt']}\n"
        elif dt == "int64": s += "\t\tformatString: 0\n"
        s += f"\t\tsummarizeBy: none\n\t\tsourceColumn: {c}\n"
        if o.get("sort"): s += f"\t\tsortByColumn: {q(o['sort'])}\n"
        s += "\n\t\tannotation SummarizationSetBy = Automatic\n"
    s += f"\n\tpartition {q(t)} = m\n\t\tmode: import\n\t\tsource =" + expr_block(spec["m"], "\t\t\t\t")
    s += "\n\tannotation PBI_ResultType = Table\n\n"
    write(os.path.join(sm, "definition", "tables", f"{t}.tmdl"), s)
write(os.path.join(sm, "definition", "relationships.tmdl"),
      "".join(f"relationship {uid('rel/' + a + ca + b)}\n\tfromColumn: {q(a)}.{q(ca)}\n\ttoColumn: {q(b)}.{q(cb)}\n\n" for a, ca, b, cb in RELS))

# ================================================================ informe (PBIR)
rp = os.path.join(OUT, RP)
write(os.path.join(OUT, f"{NAME}.pbip"), json.dumps({"$schema": "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json", "version": "1.0",
    "artifacts": [{"report": {"path": RP}}], "settings": {"enableAutoRecovery": True}}, indent=2))
write(os.path.join(rp, "definition.pbir"), json.dumps({"$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
    "version": "4.0", "datasetReference": {"byPath": {"path": f"../{SM}"}}}, indent=2))
write(os.path.join(rp, ".platform"), json.dumps({"$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
    "metadata": {"type": "Report", "displayName": NAME}, "config": {"version": "2.0", "logicalId": uid("rp")}}, indent=2))

SOL = lambda c: {"solid": {"color": c}}
THEME = "CobranzasDelSur_tema.json"
theme = {"name": THEME, "dataColors": [NAVY, GRAY, ORANGE, RED, BLUE, "#1D7A46", "#E0A10F", "#4A3AA7", "#1BAF7A", "#E87BA4"],
    "foreground": INK, "foregroundNeutralSecondary": INK3, "foregroundNeutralTertiary": "#8B949E", "background": "#FFFFFF", "backgroundLight": BG, "backgroundNeutral": LINE,
    "tableAccent": NAVY, "good": GOOD[0], "neutral": "#C98A00", "bad": CRIT[0], "maximum": NAVY, "center": "#ECEAE6", "minimum": CRIT[0], "hyperlink": BLUE, "visitedHyperlink": BLUE,
    "textClasses": {"title": {"fontFace": "Segoe UI Semibold", "fontSize": 11, "color": NAVY}, "header": {"fontFace": "Segoe UI Semibold", "fontSize": 10, "color": NAVY},
                    "label": {"fontFace": "Segoe UI", "fontSize": 9, "color": INK2}, "callout": {"fontFace": "Segoe UI Semibold", "fontSize": 24, "color": INK}},
    "visualStyles": {
        "*": {"*": {"border": [{"show": True, "color": SOL(LINE), "radius": 8, "width": 1}], "dropShadow": [{"show": False}],
                    "background": [{"show": True, "color": SOL("#FFFFFF"), "transparency": 0}], "padding": [{"top": 8, "bottom": 8, "left": 12, "right": 12}],
                    "title": [{"show": True, "fontColor": SOL(NAVY), "fontSize": 11, "fontFamily": "Segoe UI Semibold", "alignment": "left"}],
                    "subTitle": [{"show": True, "fontColor": SOL(INK3), "fontSize": 9, "fontFamily": "Segoe UI", "alignment": "left"}],
                    "divider": [{"show": False}],
                    "categoryAxis": [{"labelColor": SOL(INK3), "fontSize": 9, "showAxisTitle": False, "gridlineShow": False}],
                    "valueAxis": [{"labelColor": SOL(INK3), "fontSize": 8, "showAxisTitle": False, "gridlineShow": True, "gridlineColor": SOL("#EDF0F4"), "gridlineStyle": "solid", "labelDisplayUnits": 1}],
                    "legend": [{"labelColor": SOL(INK2), "fontSize": 9}],
                    "labels": [{"color": SOL(INK2), "fontSize": 8.5}]}},
        "page": {"*": {"background": [{"color": SOL(BG), "transparency": 0}], "outspace": [{"color": SOL(BG), "transparency": 0}]}},
        "pivotTable": {"*": {"columnHeaders": [{"backColor": SOL(NAVY), "fontColor": SOL("#FFFFFF"), "fontFamily": "Segoe UI Semibold", "outlineStyle": 0}],
                             "rowHeaders": [{"fontColor": SOL(INK), "outlineStyle": 0}], "values": [{"backColorPrimary": SOL("#FFFFFF"), "backColorSecondary": SOL("#FFFFFF"), "outlineStyle": 0}],
                             "subTotals": [{"backColor": SOL("#F1F4F9"), "fontColor": SOL(NAVY)}], "rowTotal": [{"backColor": SOL("#E9EEF6"), "fontColor": SOL(NAVY)}],
                             "grid": [{"gridHorizontal": True, "gridHorizontalColor": SOL("#EEF1F5"), "gridVertical": False, "rowPadding": 3, "textSize": 9.5, "outlineColor": SOL(LINE)}]}},
        "tableEx": {"*": {"columnHeaders": [{"backColor": SOL(NAVY), "fontColor": SOL("#FFFFFF"), "fontFamily": "Segoe UI Semibold", "outlineStyle": 0}],
                          "values": [{"backColorPrimary": SOL("#FFFFFF"), "backColorSecondary": SOL("#FFFFFF"), "outlineStyle": 0}],
                          "total": [{"backColor": SOL("#E9EEF6"), "fontColor": SOL(NAVY)}],
                          "grid": [{"gridHorizontal": True, "gridHorizontalColor": SOL("#EEF1F5"), "gridVertical": False, "rowPadding": 3, "textSize": 9.5, "outlineColor": SOL(LINE)}]}},
        "textbox": {"*": {"border": [{"show": False}], "background": [{"show": False}], "title": [{"show": False}], "subTitle": [{"show": False}]}},
        "image": {"*": {"border": [{"show": False}], "background": [{"show": False}], "title": [{"show": False}], "subTitle": [{"show": False}],
                        "padding": [{"top": 0, "bottom": 0, "left": 0, "right": 0}]}},
        "advancedSlicerVisual": {"*": {"border": [{"show": False}], "title": [{"show": False}], "subTitle": [{"show": False}], "visualHeader": [{"show": False}],
                                       "background": [{"$id": "default", "show": True, "color": SOL("#FFFFFF"), "transparency": 0},
                                                      {"$id": "interaction:hover", "show": True, "color": SOL("#EEF2F8"), "transparency": 0},
                                                      {"$id": "selection:selected", "show": True, "color": SOL(NAVY), "transparency": 0}],
                                       "outline": [{"$id": "default", "show": True, "lineColor": SOL("#C9D1DC"), "weight": 1},
                                                   {"$id": "selection:selected", "show": True, "lineColor": SOL(NAVY), "weight": 1}],
                                       "value": [{"$id": "default", "fontColor": SOL(INK2), "fontSize": 10.5, "fontFamily": "Segoe UI Semibold"},
                                                 {"$id": "interaction:hover", "fontColor": SOL(NAVY)},
                                                 {"$id": "selection:selected", "fontColor": SOL("#FFFFFF"), "bold": True}]}},
        "slicer": {"*": {"subTitle": [{"show": False}]}}}}
write(os.path.join(rp, "StaticResources", "RegisteredResources", THEME), json.dumps(theme, indent=2, ensure_ascii=False))
DEF = os.path.join(rp, "definition")
write(os.path.join(DEF, "version.json"), json.dumps({"$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json", "version": "2.0.0"}, indent=2))
write(os.path.join(DEF, "report.json"), json.dumps({"$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.0.0/schema.json",
    "themeCollection": {"baseTheme": {"name": "CY24SU10", "reportVersionAtImport": {"visual": "1.8.97", "report": "2.0.97", "page": "1.3.97"}, "type": "SharedResources"},
                        "customTheme": {"name": THEME, "reportVersionAtImport": {"visual": "1.8.100", "report": "2.0.100", "page": "1.3.100"}, "type": "RegisteredResources"}},
    "resourcePackages": [{"name": "SharedResources", "type": "SharedResources", "items": [{"name": "CY24SU10", "path": "BaseThemes/CY24SU10.json", "type": "BaseTheme"}]},
                         {"name": "RegisteredResources", "type": "RegisteredResources", "items": [{"name": THEME, "path": THEME, "type": "CustomTheme"}]}],
    "settings": {"useStylableVisualContainerHeader": True, "defaultFilterActionIsDataFilter": True, "defaultDrillFilterOtherVisuals": True, "allowChangeFilterTypes": True,
                 "allowInlineExploration": True, "useEnhancedTooltips": True}}, indent=2))

# ---------------------------------------------------------------- piezas de visuales
L = lambda v: {"expr": {"Literal": {"Value": v}}}
S = lambda s: L("'" + s.replace("'", "''") + "'")
COL = lambda c: {"solid": {"color": L("'" + c + "'")}}
FONT_N, FONT_SB = "'''Segoe UI'', wf_segoe-ui_normal, helvetica, arial, sans-serif'", "'''Segoe UI Semibold'', wf_segoe-ui_semibold, helvetica, arial, sans-serif'"
WILD = {"dataViewWildcard": {"matchingOption": 1}}
MN = {name for _, name, *_ in M}
def fld(t, c=None):
    if c is None:
        assert t in MN, t
        return {"Measure": {"Expression": {"SourceRef": {"Entity": "_Medidas"}}, "Property": t}}
    assert any(c == x for x, *_ in TABLES[t]["cols"]), (t, c)
    return {"Column": {"Expression": {"SourceRef": {"Entity": t}}, "Property": c}}
QR = lambda t, c=None: f"_Medidas.{t}" if c is None else f"{t}.{c}"
MCOL = lambda m: {"solid": {"color": {"expr": fld(m)}}}
def pj(t, c=None, name=None):
    p = {"field": fld(t, c), "queryRef": QR(t, c), "nativeQueryRef": c or t}  # sin "active": solo va en jerarquías de drill; en una tabla oculta las demás columnas
    if name: p["displayName"] = name
    return p
def box(title=None, sub=None, border=None, bg=None, pad=None, header=True):
    """title: texto fijo o («fx», medida) para un título que cambia con el período."""
    ttxt = ({"text": {"expr": fld(title[1])}} if isinstance(title, tuple) else {"text": S(title)}) if title else {}
    o = {"title": [{"properties": {"show": L("true" if title else "false"), **ttxt}}],
         "subTitle": [{"properties": {"show": L("true" if sub else "false"), **({"text": S(sub)} if sub else {})}}]}
    if border is False: o["border"] = [{"properties": {"show": L("false")}}]
    if bg is False: o["background"] = [{"properties": {"show": L("false")}}]
    # con cualquier VCO Power BI deja de heredar el padding del tema: se fija siempre (por defecto 10/8/14/14)
    pads = dict(top=10, bottom=8, left=14, right=14) if pad is None else dict(top=pad, bottom=pad, left=pad, right=pad)
    o["padding"] = [{"properties": {k: L(f"{v}D") for k, v in pads.items()}}]
    if not header: o["visualHeader"] = [{"properties": {"show": L("false")}}]
    return o

VC = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.4.0/schema.json"
PAGES, INTER = [], {}
def page(pid, display, visuals):
    PAGES.append(pid)
    pdir = os.path.join(DEF, "pages", pid)
    pj_ = {"$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/1.4.0/schema.json",
           "name": pid, "displayName": display, "displayOption": "FitToPage", "height": 720, "width": 1280}
    if INTER.get(pid): pj_["visualInteractions"] = INTER[pid]
    write(os.path.join(pdir, "page.json"), json.dumps(pj_, indent=2, ensure_ascii=False))
    for k, v in enumerate(visuals):
        v["position"]["z"] = k * 1000; v["position"]["tabOrder"] = k * 1000
        write(os.path.join(pdir, "visuals", v["name"], "visual.json"), json.dumps(v, indent=2, ensure_ascii=False))
def not_est(name):
    """Filtro del visual: deja afuera la cartera EST (gastos de estructura, sin drivers)."""
    return {"filters": [{"name": hid(name + "fEST"), "field": fld("Cartera", "code"), "type": "Categorical", "howCreated": "User",
        "filter": {"Version": 2, "From": [{"Name": "c", "Entity": "Cartera", "Type": 0}],
                   "Where": [{"Condition": {"Not": {"Expression": {"In": {"Expressions": [{"Column": {"Expression": {"SourceRef": {"Source": "c"}}, "Property": "code"}}],
                                                                          "Values": [[{"Literal": {"Value": "'EST'"}}]]}}}}}]}}]}
def vis(pid, key, vtype, x, y, w, h, query=None, objects=None, vco=None, sort=None, sync=None, noest=False):
    v = {"$schema": VC, "name": hid(pid + key), "position": {"x": x, "y": y, "z": 0, "height": h, "width": w, "tabOrder": 0}, "visual": {"visualType": vtype}}
    if noest: v["filterConfig"] = not_est(pid + key)
    if query:
        v["visual"]["query"] = {"queryState": {role: {"projections": ps} for role, ps in query.items()}}
        if sort: v["visual"]["query"]["sortDefinition"] = {"sort": [{"field": f, "direction": d} for f, d in sort], "isDefaultSort": False}
    if objects: v["visual"]["objects"] = objects
    if vco: v["visual"]["visualContainerObjects"] = vco
    if sync: v["visual"]["syncGroup"] = {"groupName": sync, "fieldChanges": True, "filterChanges": True}
    v["visual"]["drillFilterOtherVisuals"] = True
    return v
def image(pid, key, x, y, w, h, measure, alt):
    obj = {"image": [{"properties": {"sourceType": S("imageData"), "sourceField": {"expr": fld(measure)}, "transparency": L("0D"), "effects": L("false")}}],
           "imageScaling": [{"properties": {"imageScalingType": S("Fit")}}]}
    vco = box(border=False, bg=False, pad=0, header=False)
    vco["general"] = [{"properties": {"altText": S(alt)}}]
    return vis(pid, key, "image", x, y, w, h, objects=obj, vco=vco)
def textbox(pid, key, x, y, w, h, runs, card=False):
    paras = [{"textRuns": [{"value": t, "textStyle": st} for t, st in para]} for para in runs]
    vco = box(border=False, bg=False, header=False)
    if card:
        vco["border"] = [{"properties": {"show": L("true"), "color": COL(LINE), "radius": L("8D")}}]
        vco["background"] = [{"properties": {"show": L("true"), "color": COL("#FFFFFF"), "transparency": L("0D")}}]
        vco["padding"] = [{"properties": {k: L(f"{v}D") for k, v in (("top", 18), ("bottom", 18), ("left", 22), ("right", 22))}}]
    return vis(pid, key, "textbox", x, y, w, h, objects={"general": [{"properties": {"paragraphs": paras}}]}, vco=vco)
def buttons(pid, key, x, y, w, h, table, col, default, ncols, group):
    ent = "m" if table == "MesAnalisis" else "v"
    obj = {"layout": [{"properties": {"rowCount": L("1L"), "columnCount": L(f"{ncols}L")}}],
           "shapeCustomRectangle": [{"properties": {"tileShape": S("rectangleRoundedByPixel"), "rectangleRoundedCurve": L("6L")}, "selector": {"id": "default"}}],
           # estados del botón (ids de Desktop, igual que el esquema de temas): fondo, borde y texto; el seleccionado queda azul marino con texto blanco
           "background": [{"properties": {"show": L("true"), "color": COL("#FFFFFF"), "transparency": L("0D")}, "selector": {"id": "default"}},
                          {"properties": {"show": L("true"), "color": COL("#EEF2F8"), "transparency": L("0D")}, "selector": {"id": "interaction:hover"}},
                          {"properties": {"show": L("true"), "color": COL(NAVY), "transparency": L("0D")}, "selector": {"id": "selection:selected"}}],
           "outline": [{"properties": {"show": L("true"), "lineColor": COL("#C9D1DC"), "weight": L("1D")}, "selector": {"id": "default"}},
                       {"properties": {"show": L("true"), "lineColor": COL(NAVY), "weight": L("1D")}, "selector": {"id": "selection:selected"}}],
           "value": [{"properties": {"fontColor": COL(INK2), "fontSize": L("10.5D"), "fontFamily": L(FONT_SB)}, "selector": {"id": "default"}},
                     {"properties": {"fontColor": COL(NAVY)}, "selector": {"id": "interaction:hover"}},
                     {"properties": {"fontColor": COL("#FFFFFF"), "bold": L("true")}, "selector": {"id": "selection:selected"}}],
           "accentBar": [{"properties": {"show": L("false")}, "selector": {"id": "default"}}],
           "selection": [{"properties": {"singleSelect": L("true"), "strictSingleSelect": L("true")}}],
           "general": [{"properties": {"filter": {"filter": {"Version": 2, "From": [{"Name": ent, "Entity": table, "Type": 0}],
               "Where": [{"Condition": {"In": {"Expressions": [{"Column": {"Expression": {"SourceRef": {"Source": ent}}, "Property": col}}], "Values": [[{"Literal": {"Value": f"'{default}'"}}]]}}}]}}}}]}
    return vis(pid, key, "advancedSlicerVisual", x, y, w, h, query={"Values": [pj(table, col)]}, objects=obj, vco=box(border=False, bg=False, pad=0, header=False), sync=group)
def buttons_list(pid, key, x, y, w, h, table, col, n, title, sub, noest=False):
    """Botones en columna (una cartera por fila). Sin selección = todas; se elige una y se vuelve a tocar para soltarla."""
    obj = {"layout": [{"properties": {"rowCount": L(f"{n}L"), "columnCount": L("1L"), "rowPadding": L("4L")}}],
           "shapeCustomRectangle": [{"properties": {"tileShape": S("rectangleRoundedByPixel"), "rectangleRoundedCurve": L("6L")}, "selector": {"id": "default"}}],
           "background": [{"properties": {"show": L("true"), "color": COL("#FFFFFF"), "transparency": L("0D")}, "selector": {"id": "default"}},
                          {"properties": {"show": L("true"), "color": COL("#EEF2F8"), "transparency": L("0D")}, "selector": {"id": "interaction:hover"}},
                          {"properties": {"show": L("true"), "color": COL(NAVY), "transparency": L("0D")}, "selector": {"id": "selection:selected"}}],
           "outline": [{"properties": {"show": L("true"), "lineColor": COL("#DDE2E8"), "weight": L("1D")}, "selector": {"id": "default"}},
                       {"properties": {"show": L("true"), "lineColor": COL(NAVY), "weight": L("1D")}, "selector": {"id": "selection:selected"}}],
           "value": [{"properties": {"fontColor": COL(INK2), "fontSize": L("10D"), "fontFamily": L(FONT_N), "horizontalAlignment": S("left")}, "selector": {"id": "default"}},
                     {"properties": {"fontColor": COL(NAVY)}, "selector": {"id": "interaction:hover"}},
                     {"properties": {"fontColor": COL("#FFFFFF"), "bold": L("true")}, "selector": {"id": "selection:selected"}}],
           "accentBar": [{"properties": {"show": L("false")}, "selector": {"id": "default"}}],
           "selection": [{"properties": {"singleSelect": L("true"), "strictSingleSelect": L("false")}}]}
    vco = box(title, sub, pad=12, header=False)
    vco["background"] = [{"properties": {"show": L("true"), "color": COL("#FFFFFF"), "transparency": L("0D")}}]
    vco["border"] = [{"properties": {"show": L("true"), "color": COL(LINE), "radius": L("8D")}}]
    return vis(pid, key, "advancedSlicerVisual", x, y, w, h, query={"Values": [pj(table, col)]}, objects=obj, vco=vco, noest=noest)
def top(pid, title):
    return [image(pid, "hdr", 0, 0, 1280, 64, f"SVG · encabezado {title}", f"Encabezado: {title}, período y fecha de datos"),
            buttons(pid, "mes", 24, 72, 612, 46, "MesAnalisis", "Mes corto", "Sep", 9, "MesAnalisis"),
            buttons(pid, "vista", 648, 72, 228, 46, "Vista", "Vista", "Mes", 2, "Vista"),
            image(pid, "ley", 900, 75, 356, 40, "SVG · leyenda", "Referencia de colores")]
def labels_obj(precision=1, size=8.5, color=INK2, extra=None):
    o = [{"properties": {"show": L("true"), "fontSize": L(f"{size}D"), "color": COL(color), "labelPrecision": L(f"{precision}L"), "labelDisplayUnits": L("1D"), "enableBackground": L("false")}}]
    return o + (extra or [])
def bar_variance(pid, key, x, y, w, h, cat, measure, name, color_m, title, sub):
    return vis(pid, key, "clusteredBarChart", x, y, w, h, query={"Category": [pj(*cat, name="Cartera")], "Y": [pj(measure, name=name)]},
               sort=[(fld(measure), "Ascending")],
               objects={"dataPoint": [{"properties": {"fill": MCOL(color_m)}, "selector": {"data": [WILD], "metadata": QR(measure)}}],
                        "labels": labels_obj(1, 9), "valueAxis": [{"properties": {"show": L("false"), "gridlineShow": L("false")}}],
                        "categoryAxis": [{"properties": {"fontSize": L("9D"), "labelColor": COL(INK2), "maxMarginFactor": L("45L"), "innerPadding": L("28L")}}],
                        "legend": [{"properties": {"show": L("false")}}]},
               vco=box(title, sub))
def lines_chart(pid, key, x, y, w, h, series, title, sub, fmt_axis=None):
    """series: [(medida, nombre, color, estilo 'solid'|'dashed'|'dotted', ancho, marcadores)]"""
    q = {"Category": [pj("Calendario", "Mes año")], "Y": [pj(m, name=n) for m, n, *_ in series]}
    ls, dp = [], []
    for m, n, c, st, wd, mk in series:
        ls.append({"properties": {"strokeWidth": L(f"{wd}D"), "lineStyle": S(st), "showMarker": L("true" if mk else "false"), **({"markerSize": L("4D"), "markerShape": S("circle")} if mk else {})},
                   "selector": {"metadata": QR(m)}})
        dp.append({"properties": {"fill": COL(c)}, "selector": {"metadata": QR(m)}})
    obj = {"lineStyles": ls, "dataPoint": dp, "legend": [{"properties": {"show": L("false")}}],
           "categoryAxis": [{"properties": {"fontSize": L("8D")}}], "valueAxis": [{"properties": {"fontSize": L("8D"), "show": L("true")}}]}
    return vis(pid, key, "lineChart", x, y, w, h, query=q, objects=obj, sort=[(fld("Calendario", "Mes año"), "Ascending")], vco=box(title, sub))

# ---------------------------------------------------------------- página Resumen
p = "resumen"
CARD_ORDER = ["Ingresos", "Margen operativo", "Utilidad neta", "Ingreso por hora", "Cierre proyectado"]
REAL_OF, PPTO_M, AA_M = "Ingresos (mes) M$ · real o forecast", "Ingresos (mes) M$ · presupuesto", "Ingresos (mes) M$ · año anterior"
combo = vis(p, "combo", "lineClusteredColumnComboChart", 24, 286, 760, 232,
    query={"Category": [pj("Calendario", "Mes año")], "Y": [pj(REAL_OF, name="Real / forecast")], "Y2": [pj(PPTO_M, name="Presupuesto"), pj(AA_M, name="Año anterior")]},
    sort=[(fld("Calendario", "Mes año"), "Ascending")],
    objects={"dataPoint": [{"properties": {"fill": MCOL("Color · real o forecast (mes)")}, "selector": {"data": [WILD], "metadata": QR(REAL_OF)}},
                           {"properties": {"fill": COL(GRAY)}, "selector": {"metadata": QR(PPTO_M)}}, {"properties": {"fill": COL("#B7BEC8")}, "selector": {"metadata": QR(AA_M)}}],
             "lineStyles": [{"properties": {"strokeWidth": L("2D"), "lineStyle": S("dashed"), "showMarker": L("false")}, "selector": {"metadata": QR(PPTO_M)}},
                            {"properties": {"strokeWidth": L("2D"), "lineStyle": S("dotted"), "showMarker": L("false")}, "selector": {"metadata": QR(AA_M)}}],
             "labels": labels_obj(0, 8, INK3, [{"properties": {"showSeries": L("false")}, "selector": {"metadata": QR(PPTO_M)}},
                                               {"properties": {"showSeries": L("false")}, "selector": {"metadata": QR(AA_M)}}]),
             "valueAxis": [{"properties": {"show": L("false"), "gridlineShow": L("false"), "start": L("0D"), "end": {"expr": fld("Eje ingresos (máx)")},
                                           "secShow": L("false"), "secStart": L("0D"), "secEnd": {"expr": fld("Eje ingresos (máx)")}}}],
             "categoryAxis": [{"properties": {"fontSize": L("9D"), "labelColor": COL(INK3)}}],
             "legend": [{"properties": {"show": L("false")}}]},
    vco=box(("fx", "Título · ingresos del año"), "Millones de $ · columnas: real (azul) y forecast (naranja) · líneas: presupuesto y año anterior"))
page(p, "Resumen", top(p, "Resumen") + [image(p, f"k{k}", 24 + k * 248, 128, 240, 150, f"SVG · tarjeta {c}", f"Tarjeta {c}") for k, c in enumerate(CARD_ORDER)] + [
    combo,
    image(p, "narr", 24, 526, 760, 178, "SVG · lo que hay que saber", "Lo que hay que saber del período"),
    bar_variance(p, "car", 796, 286, 460, 418, ("Cartera", "nombre"), "Ingresos · desvío vs presupuesto M$", "Desvío M$", "Color · desvío ingresos",
                 "Ingresos por cartera contra presupuesto", "Desvío en millones de $ · tocá una barra para ver esa cartera en toda la página")])

# ---------------------------------------------------------------- página Estado de resultados
p = "eerr"
EE = [("EERR · Real", "Real", "EERR · color texto", 70), ("EERR · Presupuesto", "Presupuesto", "EERR · color texto", 78), ("EERR · Desvío", "Desvío", "EERR · color desvío", 66),
      ("EERR · Desvío %", "Desvío %", "EERR · color desvío", 64), ("EERR · Forecast", "Forecast", "EERR · color texto", 68), ("EERR · Año anterior", "Año ant.", "EERR · color texto", 68),
      ("EERR · Var. año anterior", "Var. a.a.", "EERR · color var. año anterior", 66)]
vals = [{"properties": {"backColor": MCOL("EERR · fondo"), "fontColor": MCOL("EERR · color texto")}, "selector": {"data": [WILD], "metadata": QR("Línea EERR", "Línea")}}]
vals += [{"properties": {"backColor": MCOL("EERR · fondo"), "fontColor": MCOL(c)}, "selector": {"data": [WILD], "metadata": QR(m)}} for m, _, c, _ in EE]
pnl = vis(p, "pnl", "tableEx", 24, 128, 700, 430, query={"Values": [pj("Línea EERR", "Línea", name="Concepto")] + [pj(m, name=n) for m, n, _, _ in EE]},
    sort=[(fld("Línea EERR", "Línea"), "Ascending")],
    objects={"values": vals, "total": [{"properties": {"totals": L("false")}}],
             "columnFormatting": [{"properties": {"alignment": S("Right"), "styleHeader": L("true")}, "selector": {"metadata": QR(m)}} for m, *_ in EE],
             "columnWidth": [{"properties": {"value": L("172D")}, "selector": {"metadata": QR("Línea EERR", "Línea")}}] +
                            [{"properties": {"value": L(f"{w}D")}, "selector": {"metadata": QR(m)}} for m, _, _, w in EE],
             "grid": [{"properties": {"textSize": L("10D"), "rowPadding": L("3D")}}],
             "columnHeaders": [{"properties": {"fontSize": L("9D")}}]},
    vco=box("Estado de resultados de gestión", "Millones de $ · desvío = real − presupuesto (positivo es a favor) · márgenes en puntos porcentuales (pp)"))
mo = lines_chart(p, "mo", 24, 566, 700, 138, [("Margen operativo % (mes) · real", "Real", NAVY, "solid", 2.5, True), ("Margen operativo % (mes) · presupuesto", "Presupuesto", GRAY, "dashed", 2, False),
                 ("Margen operativo % (mes) · proyección", "Forecast", ORANGE, "dashed", 2, False)], ("fx", "Título · margen operativo del año"), None)
wf = vis(p, "wf", "waterfallChart", 736, 128, 520, 294, query={"Category": [pj("Cuenta", "Rubro corto", name="Rubro")], "Y": [pj("Desvío vs presupuesto · período M$", name="Desvío")]},
    sort=[(fld("Cuenta", "Rubro corto"), "Ascending")],
    objects={"sentimentColors": [{"properties": {"increaseFill": COL("#2E8B57"), "decreaseFill": COL(CRIT[0]), "totalFill": COL(NAVY)}}],
             "labels": labels_obj(1, 9), "valueAxis": [{"properties": {"show": L("false"), "gridlineShow": L("false")}}],
             "categoryAxis": [{"properties": {"fontSize": L("8D"), "labelColor": COL(INK2)}}], "legend": [{"properties": {"show": L("false")}}]},
    vco=box("Del presupuesto a lo real: utilidad neta", "Desvío por rubro en millones de $ · verde suma, rojo resta · última barra: total"))
DET = [("Real · período M$", "Real"), ("Presupuesto · período M$", "Presupuesto"), ("Desvío vs presupuesto · período M$", "Desvío"), ("Desvío vs presupuesto %", "Desvío %")]
det = vis(p, "det", "pivotTable", 736, 430, 520, 274, query={"Rows": [pj("Cuenta", "Rubro"), pj("Cuenta", "Subrubro"), pj("Cuenta", "item", name="Ítem")],
    "Values": [pj(m, name=n) for m, n in DET]},
    objects={"values": [{"properties": {"fontColor": MCOL("Color · desvío presupuesto")}, "selector": {"data": [WILD], "metadata": QR(m)}} for m in ("Desvío vs presupuesto · período M$", "Desvío vs presupuesto %")],
             "rowHeaders": [{"properties": {"showExpandCollapseButtons": L("true"), "stepped": L("true")}}],
             "subTotals": [{"properties": {"rowSubtotals": L("true"), "columnSubtotals": L("false")}}],
             "columnWidth": [{"properties": {"value": L("68D")}, "selector": {"metadata": QR(m)}} for m, _ in DET]},
    vco=box("Detalle por rubro, subrubro e ítem", "Millones de $ · tocá + para abrir un rubro"))
INTER["eerr"] = [{"source": wf["name"], "target": pnl["name"], "type": "NoFilter"}, {"source": wf["name"], "target": mo["name"], "type": "NoFilter"}]
page(p, "Estado de resultados", top(p, "Estado de resultados") + [pnl, mo, wf, det])

# ---------------------------------------------------------------- página Carteras
p = "carteras"
TC = [(("Cartera", "Cartera"), "Cartera", None, 176), (("Ingresos · real M$",), "Ingresos M$", None, 78), (("SVG · ingresos real vs presupuesto",), "Real vs presupuesto", None, 136),
      (("Ingresos vs presupuesto %",), "vs ppto.", "Color · desvío ingresos", 64), (("Ingresos vs año anterior %",), "vs año ant.", "Color · ingresos vs año anterior", 74),
      (("Margen bruto · real M$",), "Contribución M$", None, 92), (("SVG · margen bruto",), "Margen %", None, 74), (("Ingreso por hora · real",), "$ por hora", None, 74),
      (("% recupero · real",), "% recupero", None, 72)]
tbl = vis(p, "tbl", "tableEx", 24, 128, 872, 576, noest=True, query={"Values": [pj(*f, name=n) for f, n, _, _ in TC]}, sort=[(fld("Ingresos · real M$"), "Descending")],
    objects={"values": [{"properties": {"fontColor": MCOL(c)}, "selector": {"data": [WILD], "metadata": QR(*f)}} for f, _, c, _ in TC if c],
             "grid": [{"properties": {"imageHeight": L("22D"), "imageWidth": L("130D"), "rowPadding": L("6D"), "textSize": L("9.5D")}}],
             "columnWidth": [{"properties": {"value": L(f"{w}D")}, "selector": {"metadata": QR(*f)}} for f, _, _, w in TC],
             "columnFormatting": [{"properties": {"alignment": S("Center")}, "selector": {"metadata": QR(*f)}} for f, *_ in TC if f[0].startswith("SVG")],
             "total": [{"properties": {"totals": L("true"), "label": S("Total")}}]},
    vco=box("Carteras del período", "Millones de $ · bala: real (barra) contra presupuesto (marca) · margen de contribución: verde ≥ 25%, ámbar 10–25%, rojo < 10%"))
sc = vis(p, "sc", "scatterChart", 908, 128, 348, 284, query={"Category": [pj("Cartera", "code", name="Cartera")], "X": [pj("Ingreso por hora · real", name="Ingreso por hora")],
    "Y": [pj("Margen bruto % · real", name="Margen de contribución %")], "Size": [pj("Ingresos · real M$", name="Ingresos M$")]},
    objects={"dataPoint": [{"properties": {"fill": MCOL("Color · margen bruto")}, "selector": {"data": [WILD]}}],
             "categoryLabels": [{"properties": {"show": L("true"), "fontSize": L("8D"), "color": COL(INK2)}}],
             "bubbles": [{"properties": {"bubbleSize": L("-10L")}}], "legend": [{"properties": {"show": L("false")}}],
             "categoryAxis": [{"properties": {"showAxisTitle": L("true"), "titleText": S("Ingreso por hora ($)"), "fontSize": L("8D")}}],
             "valueAxis": [{"properties": {"showAxisTitle": L("true"), "titleText": S("Margen de contribución"), "fontSize": L("8D")}}]},
    vco=box("Productividad y rentabilidad", "Arriba a la derecha: más ingreso por hora y más margen · tamaño: ingresos"))
rec = bar_variance(p, "rec", 908, 420, 348, 284, ("Cartera", "code"), "% recupero · desvío vs presupuesto (pp)", "Δ recupero pp", "Color · desvío recupero",
                   "% de recupero contra presupuesto", "Diferencia en puntos porcentuales")
page(p, "Carteras", top(p, "Carteras") + [tbl, sc, rec])

# ---------------------------------------------------------------- página Drivers
p = "drivers"
car_sl = buttons_list(p, "car", 24, 128, 200, 576, "Cartera", "Nombre corto", 12, "Cartera", "Ninguna elegida = todas", noest=True)
DLINES = [("% recupero", "% de recupero", "% recupero (mes) · real", "% recupero (mes) · presupuesto", "% recupero (mes) · proyección"),
          ("Fee", "Fee promedio", "Fee (mes) · real", "Fee (mes) · presupuesto", "Fee (mes) · proyección"),
          ("Deuda asignada", "Deuda asignada (millones de $)", "Deuda asignada (mes) M$ · real", "Deuda asignada (mes) M$ · presupuesto", "Deuda asignada (mes) M$ · proyección"),
          ("Posiciones", "Posiciones", "Posiciones (mes) · real", "Posiciones (mes) · presupuesto", "Posiciones (mes) · proyección")]
charts = [lines_chart(p, f"l{k}", 236 + (k % 2) * 514, 286 + (k // 2) * 213, 506, 205,
                      [(r, "Real", NAVY, "solid", 2.5, True), (pp, "Presupuesto", GRAY, "dashed", 2, False), (f, "Forecast", ORANGE, "dashed", 2, False)],
                      t, "Mes a mes del año · real, presupuesto y forecast") for k, (_, t, r, pp, f) in enumerate(DLINES)]
DORDER = ["% de recupero", "Fee promedio", "Deuda asignada", "Posiciones"]
page(p, "Drivers", top(p, "Drivers") + [car_sl] + [image(p, f"k{k}", 236 + k * 257, 128, 249, 150, f"SVG · tarjeta {c}", f"Tarjeta {c}") for k, c in enumerate(DORDER)] + charts)

# ---------------------------------------------------------------- página Cómo se usa
p = "ayuda"
H = {"fontFamily": "Segoe UI Semibold", "fontSize": "12pt", "color": NAVY}; B = {"fontFamily": "Segoe UI", "fontSize": "10.5pt", "color": INK}
G = {"fontFamily": "Segoe UI", "fontSize": "10.5pt", "color": INK3}
izq = [[("Cómo se lee", H)],
       [("Los botones de arriba eligen el mes y la vista (mes solo o acumulado del año). Todas las páginas cambian juntas. El encabezado dice qué período estás viendo y hasta qué fecha hay datos reales.", B)],
       [("Las tarjetas muestran el valor del período, un estado (En línea, Atención o Desvío, contra presupuesto) y tres comparaciones: presupuesto, mes anterior y año anterior. Verde es a favor y rojo en contra, también en costos. La línea de abajo es el año: azul marino el real, gris punteado el presupuesto y naranja el forecast; el círculo marca el mes elegido.", B)],
       [("«Lo que hay que saber» se escribe solo con los números del período: no hay texto cargado a mano.", B)],
       [("Tocá una barra o una fila para ver esa cartera en toda la página; tocá de nuevo para volver al total.", B)],
       [("Qué hay en cada página", H)],
       [("Resumen: tarjetas, ingresos del año y desvío por cartera. Estado de resultados: renglones ejecutivos, puente del presupuesto a lo real y detalle abrible. Carteras: tabla con bala real contra presupuesto, margen con semáforo, productividad y recupero. Drivers: recupero, fee, deuda asignada y posiciones mes a mes, por cartera.", B)]]
der = [[("Cómo está armado", H)],
       [("Modelo estrella: Resultado, Drivers y KPI (hechos) con Calendario, Cartera, Cuenta y Escenario. MesAnalisis, Vista y Línea EERR no tienen relación: las medidas leen la selección. Así los gráficos del año siguen mostrando los doce meses aunque elijas uno solo.", B)],
       [("Las medidas están en _Medidas, en carpetas (período, base, período elegido, indicadores, series mensuales, estado de resultados, colores, imágenes y textos) y cada una tiene su descripción. Las tarjetas, el encabezado y la narrativa son medidas que devuelven una imagen SVG.", B)],
       [("Datos", H)],
       [("Si moviste la carpeta de los CSV: Transformar datos › Editar parámetros › CarpetaDatos, y Actualizar. Para usar datos de otra empresa alcanza con reemplazar los CSV respetando las columnas.", B)],
       [("Control de números", H)],
       [("Septiembre 2025, vista Mes: ingresos $ 422,6 M (−10,8% contra presupuesto), margen operativo 17,6%, utilidad neta $ 57,5 M, ingreso por hora $ 20.521 y cierre proyectado $ 554,4 M. Acumulado enero a septiembre: ingresos $ 3.384,4 M, margen operativo 14,7%, utilidad neta $ 391,8 M.", B)],
       [("Datos 100% ficticios. Mismos números que el tablero HTML del caso.", G)]]
def spaced(paras):  # una línea en blanco antes de cada título
    out = []
    for k, pa in enumerate(paras):
        if k and pa[0][1] is H: out.append([(" ", B)])
        out.append(pa)
    return out
GB = {"fontFamily": "Segoe UI Semibold", "fontSize": "10.5pt", "color": NAVY}
glos1 = [[("Glosario", H)],
         [("Presupuesto: ", GB), ("lo previsto a principio de año, mes a mes. ", B), ("Forecast: ", GB), ("la reproyección vigente; para el cierre se usa en los meses que faltan.", B)],
         [("Cierre proyectado: ", GB), ("real de los meses cerrados más forecast de los que faltan (latest estimate).", B)],
         [("Desvío: ", GB), ("real menos presupuesto. Positivo es a favor también en costos, porque los costos están en negativo. ", B), ("pp: ", GB), ("puntos porcentuales.", B)]]
glos2 = [[(" ", H)],
         [("Margen de contribución: ", GB), ("ingresos de la cartera menos sus costos directos, asignados e impuestos directos, antes de la estructura.", B)],
         [("Ingreso por hora: ", GB), ("ingresos sobre horas de posición (posiciones × 132 h por mes). ", B), ("% de recupero: ", GB), ("cobrado sobre deuda asignada. ", B),
          ("Fee: ", GB), ("comisión sobre lo cobrado.", B)]]
page(p, "Cómo se usa", [image(p, "hdr", 0, 0, 1280, 64, "SVG · encabezado Cómo se usa", "Encabezado"),
    textbox(p, "txtL", 24, 80, 610, 432, spaced(izq), card=True), textbox(p, "txtR", 646, 80, 610, 432, spaced(der), card=True),
    textbox(p, "gl1", 24, 524, 610, 180, glos1, card=True), textbox(p, "gl2", 646, 524, 610, 180, glos2, card=True)])

write(os.path.join(DEF, "pages", "pages.json"), json.dumps({"$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
    "pageOrder": PAGES, "activePageName": PAGES[0]}, indent=2))
write(os.path.join(OUT, ".gitignore"), "**/.pbi/localSettings.json\n**/.pbi/cache.abf\n")
print("ok:", OUT, "|", len(M), "medidas,", sum(1 for x in M if x[5]), "SVG,", len(TABLES), "tablas,", len(RELS), "relaciones,", len(PAGES), "páginas")

# ================================================================ documentación, datos y paquete
md = ["# Medidas DAX del modelo (Cobranzas del Sur)", "",
      "Todas viven en la tabla `_Medidas`, agrupadas en carpetas. El período lo eligen las tablas sin relación **MesAnalisis** (botones de mes) y **Vista** (mes o acumulado):",
      "las medidas leen esa selección con `[Índice desde]` e `[Índice hasta]` y filtran Calendario por su `indice` (meses corridos).",
      "Las medidas de la carpeta *7. Imágenes SVG* tienen categoría de datos **URL de imagen** y devuelven un dibujo SVG (tarjetas, encabezados, narrativa, celdas de tabla).", ""]
cur_f = None
for folder, name, dax, fmt, desc, cat in M:
    if folder != cur_f: md += [f"## {folder}", ""]; cur_f = folder
    md += [f"### {name}", desc, "", "```dax", f"{name} =", dax, "```", (f"Formato: `{fmt}`" if fmt else "") + (" · Categoría: URL de imagen" if cat else ""), ""]
write(os.path.join(D, "MEDIDAS.md"), "\n".join(md))
shutil.copy(os.path.join(D, "MEDIDAS.md"), os.path.join(OUT, "MEDIDAS.md"))
if os.path.exists(os.path.join(D, "README.md")): shutil.copy(os.path.join(D, "README.md"), os.path.join(OUT, "LEEME.md"))
dd = os.path.join(OUT, "datos"); os.makedirs(dd, exist_ok=True)
for f in ["dim_fecha.csv", "dim_cartera.csv", "dim_cuenta.csv", "fact_resultado.csv", "fact_drivers_cartera.csv", "fact_kpi_operacion.csv"]:
    shutil.copy(os.path.join(D, "..", "01_datos", f), dd)
zp = os.path.join(OUT_BASE, f"{datetime.date.today().isoformat()}_PowerBI_CobranzasDelSur_{VER}.zip")
with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(OUT):
        for f in files:
            full = os.path.join(root, f); z.write(full, os.path.relpath(full, OUT_BASE))
print("MEDIDAS.md, datos y", os.path.basename(zp), "ok")
