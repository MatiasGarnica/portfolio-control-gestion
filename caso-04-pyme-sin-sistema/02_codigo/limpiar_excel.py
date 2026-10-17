"""Caso 04 · limpia el Excel de enero a mayo y lo une con las respuestas del formulario (junio en adelante).

Uso:  python limpiar_excel.py

Lee   ../01_datos/excel_original/Caja 2025.xlsx  y  ../01_datos/formulario/*.csv
Deja  ../01_datos/base/*.csv                  las tablas tal como se cargan en Supabase (carga inicial)
      ../01_datos/base/problemas_excel.csv    cada problema encontrado en el Excel y qué se hizo
Imprime cuánto del Excel se pudo recuperar, comparado con lo que pasó de verdad (../01_datos/verdad).
"""
import os, re, unicodedata, difflib
from datetime import datetime
import pandas as pd
from openpyxl import load_workbook

D = os.path.dirname(os.path.abspath(__file__))
DAT = os.path.normpath(os.path.join(D, "..", "01_datos"))
BASE = os.path.join(DAT, "base")
os.makedirs(BASE, exist_ok=True)
MEDIOS = ["Efectivo", "Débito", "Crédito", "Billetera virtual", "Transferencia"]
MES = {"Enero": 1, "Febrero": 2, "Marzo": 3, "Abril": 4, "Mayo": 5}
problemas = []
def problema(hoja, fila, tipo, detalle, accion):
    problemas.append([hoja, fila, tipo, detalle, accion])

def sin_tildes(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn").lower().strip()

def fecha(v, mes, hoja, fila):
    if isinstance(v, datetime):
        return pd.Timestamp(v)
    s = str(v).strip()
    m = re.search(r"(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?", s)
    if not m:
        problema(hoja, fila, "Fecha ilegible", s, "Fila descartada")
        return None
    d, mm = int(m.group(1)), int(m.group(2))
    problema(hoja, fila, "Fecha como texto", s, "Convertida a fecha (año 2025)")
    if mes is not None and mm != mes:
        problema(hoja, fila, "Fecha de otro mes", s, "Se respetó la fecha escrita")
    return pd.Timestamp(2025, mm, d)

def monto(v, hoja, fila, col):
    if v is None or (isinstance(v, str) and v.strip() in ("", "-")):
        return 0
    if isinstance(v, (int, float)):
        return int(round(v))
    s = str(v).strip()
    if re.search(r"[a-zA-Z]{3,}", s.replace("$", "")):
        problema(hoja, fila, "Monto ilegible", f"{col}: {s}", "Queda sin dato; se marca la fila")
        return None
    s2 = s.replace("$", "").replace(" ", "").replace(".-", "")
    if re.fullmatch(r"\d{1,3}(\.\d{3})+(,\d+)?", s2) or re.fullmatch(r"\d+,\d+", s2):
        s2 = s2.replace(".", "").replace(",", ".")
    problema(hoja, fila, "Monto como texto", f"{col}: {s}", "Convertido a número")
    return int(round(float(s2)))

def local(v, hoja, fila):
    s = sin_tildes(v).replace("b°", "").strip()
    out = {"centro": "Centro", "jardin": "Jardín"}.get(s)
    if out and str(v) != out:
        problema(hoja, fila, "Local escrito distinto", repr(v), f"Unificado como {out}")
    return out

# ---------------------------------------------------------------- caja (una hoja por mes)
wb = load_workbook(os.path.join(DAT, "excel_original", "Caja 2025.xlsx"))
filas = []
for hoja, mes in MES.items():
    ws = wb[hoja]
    head = [sin_tildes(c.value) if c.value else "" for c in ws[1]]
    col = {"efvo": "Efectivo", "debito": "Débito", "credito": "Crédito", "mp / billetera": "Billetera virtual", "transf": "Transferencia",
           "gastos": "gasto", "detalle": "concepto_gasto", "retiro aldo": "retiro", "obs": "obs"}
    idx = {col[h]: i for i, h in enumerate(head) if h in col}
    if "Billetera virtual" not in idx:
        problema(hoja, 1, "Billetera y transferencia juntas", "La columna de billetera virtual recién aparece en abril", "Todo queda como transferencia")
    for r, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        a = row[0]
        if a is None or (isinstance(a, str) and a.upper().startswith("TOTAL")):
            if a:
                problema(hoja, r, "Fila de total en medio de los datos", a, "Fila descartada")
            continue
        f = fecha(a, mes, hoja, r)
        lo = local(row[1], hoja, r)
        if f is None or lo is None:
            continue
        reg = {"fecha": f, "local": lo, "fila": r, "hoja": hoja}
        ilegible = False
        for m in MEDIOS:
            v = monto(row[idx[m]], hoja, r, m) if m in idx else 0
            ilegible |= v is None
            reg[m] = v
        reg["total_excel"] = sum(row[idx[m]] for m in MEDIOS if m in idx and isinstance(row[idx[m]], (int, float)))   # lo que sumaba la fórmula del Excel
        reg["gasto"] = monto(row[idx["gasto"]], hoja, r, "Gastos") or 0
        reg["concepto_gasto"] = row[idx["concepto_gasto"]] or ""
        reg["retiro"] = monto(row[idx["retiro"]], hoja, r, "Retiro") or 0
        reg["obs"] = row[idx["obs"]] or ""
        reg["incompleta"] = ilegible
        filas.append(reg)
X = pd.DataFrame(filas)
dup = X.duplicated(subset=["fecha", "local"] + MEDIOS + ["gasto", "retiro"], keep="first")
for r in X[dup].itertuples():
    problema(r.hoja, r.fila, "Fila duplicada", f"{r.fecha:%d/%m} {r.local}", "Se dejó una sola")
X = X[~dup]
rep = X.duplicated(subset=["fecha", "local"], keep=False)
for r in X[rep].itertuples():
    problema(r.hoja, r.fila, "Dos cierres distintos el mismo día", f"{r.fecha:%d/%m} {r.local}", "Revisar a mano")
# el total del Excel no sumaba los montos cargados como texto
caja_excel = X.assign(responsable="", tickets=None, efectivo_contado=None, fondo=None, fuente="Excel")

# ---------------------------------------------------------------- caja desde el formulario
fo = pd.read_csv(os.path.join(DAT, "formulario", "respuestas_cierre_de_caja.csv"))
caja_form = pd.DataFrame({
    "fecha": pd.to_datetime(fo["Fecha del cierre"], format="%d/%m/%Y"), "local": fo.Local, "responsable": fo.Responsable,
    "Efectivo": fo["Ventas en efectivo"], "Débito": fo["Ventas con débito"], "Crédito": fo["Ventas con crédito"],
    "Billetera virtual": fo["Ventas con billetera virtual"], "Transferencia": fo["Ventas por transferencia"], "tickets": fo["Cantidad de tickets"],
    "gasto": fo["Gastos pagados con la caja"], "concepto_gasto": fo["Concepto del gasto"].fillna(""), "retiro": fo["Retiro del dueño"],
    "efectivo_contado": fo["Efectivo contado al cierre"], "fondo": 20000, "obs": "", "incompleta": False, "fuente": "Formulario",
    "cargado": pd.to_datetime(fo["Marca temporal"], format="%d/%m/%Y %H:%M:%S"),
})
cols = ["fecha", "local", "responsable", *MEDIOS, "tickets", "gasto", "concepto_gasto", "retiro", "fondo", "efectivo_contado", "incompleta", "fuente", "obs"]
CAJA = pd.concat([caja_excel[cols], caja_form[cols + ["cargado"]]], ignore_index=True).sort_values(["fecha", "local"])

# ---------------------------------------------------------------- mayoristas: unificar nombres del fiado contra la lista de clientes
cli = pd.read_csv(os.path.join(DAT, "verdad", "clientes_mayoristas.csv"))     # la lista de clientes la arma el dueño una vez
PREF = ["restaurante", "rotiseria", "almacen", "bodegon", "cantina", "club", "parrilla", "bar", "comedor", "trattoria", "hotel", "rest.", "rotis.", "alm."]
def nucleo(s):
    s = sin_tildes(s)
    for p in PREF:
        if s.startswith(p + " "):
            s = s[len(p) + 1:]
    return s.strip()
claves = {nucleo(n): i for i, n in zip(cli.id_cliente, cli.nombre)}
def cliente(s, r):
    k = nucleo(s)
    if k in claves:
        if s != cli.set_index("id_cliente").loc[claves[k], "nombre"]:
            problema("Fiado", r, "Cliente escrito distinto", s, f"Unificado como {cli.set_index('id_cliente').loc[claves[k], 'nombre']}")
        return claves[k]
    m = difflib.get_close_matches(k, list(claves), n=1, cutoff=0.75)
    if m:
        problema("Fiado", r, "Cliente con error de tipeo", s, f"Unificado como {cli.set_index('id_cliente').loc[claves[m[0]], 'nombre']}")
        return claves[m[0]]
    problema("Fiado", r, "Cliente desconocido", s, "Fila descartada")
    return None
ws = wb["Fiado"]
fx = []
for r, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
    f = fecha(row[0], None, "Fiado", r)
    c = cliente(row[1], r)
    if f is None or c is None:
        continue
    fx.append([f, c, monto(row[2], "Fiado", r, "Pedido") or 0, monto(row[3], "Fiado", r, "Pagó") or 0, row[4]])
FX = pd.DataFrame(fx, columns=["fecha", "id_cliente", "pedido", "pago", "saldo_manual"])
# el saldo que arrastraban a mano contra el recalculado
FX["saldo_recalc"] = (FX.pedido - FX.pago).groupby(FX.id_cliente).cumsum()
FX["dif"] = FX.saldo_manual - FX.saldo_recalc
quiebres = FX[FX.dif != FX.groupby("id_cliente").dif.shift(fill_value=0)]
for r in quiebres.itertuples():
    problema("Fiado", "", "Saldo mal arrastrado", f"{cli.set_index('id_cliente').loc[r.id_cliente, 'nombre']} {r.fecha:%d/%m}: diferencia de {'−' if r.dif < 0 else '+'}$ {abs(r.dif):,.0f}".replace(",", "."),
             "Se recalcula el saldo desde los movimientos")
ven_excel = FX[FX.pedido > 0].assign(importe=lambda x: x.pedido, condicion="Cuenta corriente", fuente="Excel")[["fecha", "id_cliente", "importe", "condicion", "fuente"]]
cob_excel = FX[FX.pago > 0].assign(importe=lambda x: x.pago, medio="Sin dato", fuente="Excel")[["fecha", "id_cliente", "importe", "medio", "fuente"]]
nom = dict(zip(cli.nombre, cli.id_cliente))
vp = pd.read_csv(os.path.join(DAT, "formulario", "respuestas_pedidos.csv"))
cp = pd.read_csv(os.path.join(DAT, "formulario", "respuestas_cobros.csv"))
ven_form = pd.DataFrame({"fecha": pd.to_datetime(vp.Fecha, format="%d/%m/%Y"), "id_cliente": vp.Cliente.map(nom), "importe": vp["Importe del pedido"], "condicion": vp["Condición"], "fuente": "Formulario"})
cob_form = pd.DataFrame({"fecha": pd.to_datetime(cp.Fecha, format="%d/%m/%Y"), "id_cliente": cp.Cliente.map(nom), "importe": cp["Importe cobrado"], "medio": cp.Medio, "fuente": "Formulario"})
VEN = pd.concat([ven_excel, ven_form], ignore_index=True).sort_values(["fecha", "id_cliente"])
COB = pd.concat([cob_excel, cob_form], ignore_index=True).sort_values(["fecha", "id_cliente"])

# ---------------------------------------------------------------- salida (lo que se carga en Supabase)
fmt = lambda df: df.assign(fecha=df.fecha.dt.strftime("%Y-%m-%d"))
SQLM = dict(zip(MEDIOS, ["efectivo", "debito", "credito", "billetera", "transferencia"]))
out = fmt(CAJA).assign(cargado=CAJA.cargado.dt.strftime("%Y-%m-%d %H:%M")).rename(columns=SQLM)
for c in ["efectivo", "debito", "credito", "billetera", "transferencia", "tickets", "gasto", "retiro", "fondo", "efectivo_contado"]:
    out[c] = out[c].astype("Int64")
out.to_csv(os.path.join(BASE, "cierres_caja.csv"), index=False)
fmt(VEN).to_csv(os.path.join(BASE, "ventas_mayoristas.csv"), index=False)
fmt(COB).to_csv(os.path.join(BASE, "cobros_mayoristas.csv"), index=False)
cli.to_csv(os.path.join(BASE, "clientes_mayoristas.csv"), index=False)
P = pd.DataFrame(problemas, columns=["hoja", "fila", "problema", "detalle", "que_se_hizo"])
P.to_csv(os.path.join(BASE, "problemas_excel.csv"), index=False)

# ---------------------------------------------------------------- cuánto se recuperó (contra lo que pasó de verdad)
V = pd.read_csv(os.path.join(DAT, "verdad", "cierres.csv"), parse_dates=["fecha"])
V = V[V.fecha < "2025-06-01"].assign(total=lambda x: x[MEDIOS].sum(axis=1))
E = caja_excel[~caja_excel.incompleta].assign(total=lambda x: x[MEDIOS].sum(axis=1))
m = V.merge(E[["fecha", "local", "total"]], on=["fecha", "local"], how="left", suffixes=("", "_x"))
ok = (m.total == m.total_x).sum()
VV = pd.read_csv(os.path.join(DAT, "verdad", "ventas_mayoristas.csv"), parse_dates=["fecha"])
VV = VV[(VV.fecha < "2025-06-01") & (VV.condicion == "Cuenta corriente")]
print(f"Problemas encontrados en el Excel: {len(P)}")
print(P.groupby("problema").size().sort_values(ascending=False).to_string())
print(f"\nCierres de enero a mayo: {len(V)} · recuperados exactos {ok} ({ok / len(V):.1%}) · incompletos {int(caja_excel.incompleta.sum())}")
print(f"Fiado: pedidos {len(ven_excel)} de {len(VV)} · importe {ven_excel.importe.sum():,.0f} contra {VV.importe.sum():,.0f}".replace(",", "."))
te, tr = X[~X.incompleta].total_excel.sum(), X[~X.incompleta][MEDIOS].sum().sum()
print(f"La columna Total del Excel sumaba $ {te:,.0f} de $ {tr:,.0f}: dejaba afuera el {1 - te / tr:.1%} por los montos cargados como texto".replace(",", "."))
with open(os.path.join(BASE, "resumen_limpieza.txt"), "w", encoding="utf-8") as fh:
    fh.write(f"problemas={len(P)}\ncierres={len(V)}\nrecuperados={ok}\nincompletos={int(caja_excel.incompleta.sum())}\ntotal_excel={te}\ntotal_real={tr}\nfiado_pedidos={len(ven_excel)}\nsaldos_mal={int((P.problema == 'Saldo mal arrastrado').sum())}\n")
print(f"Formulario: {len(caja_form)} cierres · {len(ven_form)} pedidos · {len(cob_form)} cobros")
