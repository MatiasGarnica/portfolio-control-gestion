"""Caso 02 · arma dashboard_data.json (lo que lee el tablero) a partir de ../01_datos/*.csv.

Uso:  python build_data.py

Qué calcula
  1. Antigüedad de la deuda por cliente (FIFO: los pagos y créditos cancelan primero los cargos más viejos)
     en cada lunes de la hoja (foto de las 7:00, con datos hasta el domingo) y al cierre de cada semana.
  2. Rasgos por cliente y semana que usan las reglas de la hoja: vencido por tramo, días desde el último pago,
     intervalo habitual entre pagos, días sin visita, notas de crédito del último mes contra la facturación habitual,
     y lo que pasó en la semana (pagos, visita, revisión).
  3. Días calle y cobranza por medio, mes a mes y por reparto.
  4. Notas de crédito con su tamaño relativo a la facturación del cliente (control).
  5. Ficha de cada cliente: últimos movimientos, gestiones y serie de 12 semanas.
La hoja en sí (qué cuentas entran y cómo terminó cada una) la calcula hoja.py con estos rasgos y los parámetros;
el tablero repite el mismo cálculo en el navegador para que los parámetros se puedan cambiar en vivo.
"""
import os, json
import numpy as np
import pandas as pd

D = os.path.dirname(os.path.abspath(__file__))
DAT = os.path.normpath(os.path.join(D, "..", "01_datos"))
CORTE = pd.Timestamp("2025-10-09")
LUNES = pd.date_range("2025-07-28", "2025-10-06", freq="7D")          # semanas 31 a 41
UMBRALES = [30, 45, 60, 90]

rd = lambda f, **k: pd.read_csv(os.path.join(DAT, f), **k)
SUC, SUP, REP, CLI = rd("dim_sucursal.csv"), rd("dim_supervisor.csv"), rd("dim_reparto.csv"), rd("dim_cliente.csv")
V = rd("fact_venta.csv", parse_dates=["fecha"])
P = rd("fact_pago.csv", parse_dates=["fecha"])
M = rd("fact_movimiento.csv", parse_dates=["fecha"])
VI = rd("fact_visita.csv", parse_dates=["fecha"])
GE = rd("fact_gestion.csv", parse_dates=["fecha"])
MED = rd("dim_medio_pago.csv")

# ---------------------------------------------------------------- reglas de alcance (ver reglas-de-negocio.md)
com = REP[REP.tipo_reparto == "Comercial"].id_reparto
CLI["en_alcance"] = (CLI.cuenta_interna == 0) & CLI.id_reparto.isin(com)
fuera = {"internas": int((CLI.cuenta_interna == 1).sum()),
         "no_comerciales": int(((CLI.cuenta_interna == 0) & ~CLI.id_reparto.isin(com)).sum())}
ALC = CLI[CLI.en_alcance].reset_index(drop=True)
ids = ALC.id_cliente.values
pos = {c: i for i, c in enumerate(ids)}

# débitos (aumentan la deuda) y créditos (la cancelan)
deb = pd.concat([V[["fecha", "id_cliente", "importe"]],
                 M[M.tipo.isin(["Saldo inicial", "Reversa de pago"])][["fecha", "id_cliente", "importe"]]])
cre = pd.concat([P[["fecha", "id_cliente", "importe"]],
                 M[M.tipo.isin(["Nota de crédito", "Incobrable"])][["fecha", "id_cliente", "importe"]]])
deb = deb[deb.id_cliente.isin(ids)].sort_values(["id_cliente", "fecha"])
cre = cre[cre.id_cliente.isin(ids)].sort_values(["id_cliente", "fecha"])
DEB = {c: (g.fecha.values.astype("datetime64[D]"), g.importe.values.astype(float)) for c, g in deb.groupby("id_cliente")}
CRE = {c: (g.fecha.values.astype("datetime64[D]"), g.importe.values.astype(float)) for c, g in cre.groupby("id_cliente")}
PAG = {c: (g.fecha.values.astype("datetime64[D]"), g.importe.values.astype(float)) for c, g in P[P.id_cliente.isin(ids)].sort_values("fecha").groupby("id_cliente")}
VIS = {c: g.fecha.values.astype("datetime64[D]") for c, g in VI[(VI.visito == 1) & VI.id_cliente.isin(ids)].sort_values("fecha").groupby("id_cliente")}
NC = M[(M.tipo == "Nota de crédito") & M.id_cliente.isin(ids)]
NCD = {c: (g.fecha.values.astype("datetime64[D]"), g.importe.values.astype(float)) for c, g in NC.groupby("id_cliente")}
VEN = {c: (g.fecha.values.astype("datetime64[D]"), g.importe.values.astype(float)) for c, g in V[V.id_cliente.isin(ids)].groupby("id_cliente")}
REV = GE[GE.tipo == "Revisión de nota de crédito"]
REVD = {c: g.fecha.values.astype("datetime64[D]") for c, g in REV.groupby("id_cliente")}
LLA = GE[GE.tipo == "Llamado"]
LLAD = {c: g.fecha.values.astype("datetime64[D]") for c, g in LLA.groupby("id_cliente")}
E = (np.array([], dtype="datetime64[D]"), np.array([], dtype=float))
DIA = np.timedelta64(1, "D")


def suma_hasta(par, t, desde=None):
    """suma de importes con fecha <= t (y > desde si se indica)"""
    f, v = par
    hi = np.searchsorted(f, t, side="right")
    lo = 0 if desde is None else np.searchsorted(f, desde, side="right")
    return float(v[lo:hi].sum())


def antiguedad(c, t):
    """deuda por antigüedad al día t (inclusive): FIFO. Devuelve saldo y [vencido > 30, 45, 60, 90 días]."""
    fd, vd = DEB.get(c, E)
    k = np.searchsorted(fd, t, side="right")
    fd, vd = fd[:k], vd[:k]
    cred = suma_hasta(CRE.get(c, E), t)
    saldo = vd.sum() - cred
    if saldo <= 0 or k == 0:
        return round(saldo), [0, 0, 0, 0]
    acum = np.cumsum(vd)
    impago = np.minimum(vd, np.maximum(0, acum - cred))       # lo que queda sin cancelar de cada cargo
    edad = (np.datetime64(t, "D") - fd).astype(int)
    return round(saldo), [round(impago[edad > u].sum()) for u in UMBRALES]


def ultimo(fechas, t):
    """días desde el último evento con fecha <= t (o -1 si nunca)"""
    if fechas is None or len(fechas) == 0:
        return -1
    k = np.searchsorted(fechas, t, side="right")
    return -1 if k == 0 else int((np.datetime64(t, "D") - fechas[k - 1]).astype(int))


def ritmo(c, t):
    """intervalo mediano entre pagos (días) y pago mediano, mirando 180 días hasta t"""
    f, v = PAG.get(c, E)
    lo, hi = np.searchsorted(f, np.datetime64(t, "D") - 180 * DIA, side="right"), np.searchsorted(f, t, side="right")
    f, v = f[lo:hi], v[lo:hi]
    if len(f) < 3:
        return -1, round(float(np.median(v))) if len(v) else 0
    return int(np.median(np.diff(f).astype(int))), round(float(np.median(v)))


def cuenta_en(fechas, a, b):
    if fechas is None or len(fechas) == 0:
        return 0
    return int(np.searchsorted(fechas, b, side="right") - np.searchsorted(fechas, a, side="left"))


# ---------------------------------------------------------------- rasgos por semana
COLS = ["saldo", "v30", "v45", "v60", "v90", "dup", "imed", "pmed", "duv", "nc30", "fac6",
        "pag", "vis", "rev", "lla",
        "e_saldo", "e_v30", "e_v45", "e_v60", "e_v90", "e_dup", "e_duv", "e_nc30"]
semanas, feats = [], []
for lun in LUNES:
    dom = (lun - pd.Timedelta(days=1)).to_datetime64().astype("datetime64[D]")
    fin = min(lun + pd.Timedelta(days=5), CORTE)
    fin64 = fin.to_datetime64().astype("datetime64[D]")
    lun64 = lun.to_datetime64().astype("datetime64[D]")
    semanas.append({"sem": int(lun.isocalendar().week), "lunes": lun.strftime("%Y-%m-%d"), "fin": fin.strftime("%Y-%m-%d"),
                    "en_curso": bool(fin < lun + pd.Timedelta(days=5))})
    F = np.zeros((len(ids), len(COLS)), dtype=np.int64)
    for i, c in enumerate(ids):
        s, v = antiguedad(c, dom)
        imed, pmed = ritmo(c, dom)
        fac6 = suma_hasta(VEN.get(c, E), dom, dom - 180 * DIA) / 6
        nc30 = suma_hasta(NCD.get(c, E), dom, dom - 30 * DIA)
        pag = suma_hasta(PAG.get(c, E), fin64, dom)
        vis = int(cuenta_en(VIS.get(c), lun64, fin64) > 0)
        rev = int(cuenta_en(REVD.get(c), lun64, fin64) > 0)
        lla = cuenta_en(LLAD.get(c), lun64, fin64)
        es, ev = antiguedad(c, fin64)
        F[i] = [s, *v, ultimo(PAG.get(c, E)[0], dom), imed, pmed, ultimo(VIS.get(c), dom), round(nc30), round(fac6),
                round(pag), vis, rev, lla,
                es, *ev, ultimo(PAG.get(c, E)[0], fin64), ultimo(VIS.get(c), fin64), round(suma_hasta(NCD.get(c, E), fin64, fin64 - 30 * DIA))]
    feats.append(F)
FE = np.stack(feats)                                       # semana × cliente × rasgo
activos = np.where((FE[:, :, COLS.index("saldo")] > 0).any(0) | (FE[:, :, COLS.index("e_saldo")] > 0).any(0)
                   | (FE[:, :, COLS.index("nc30")] > 0).any(0))[0]
FE = FE[:, activos, :]
cuentas = ALC.iloc[activos].reset_index(drop=True)

# ---------------------------------------------------------------- días calle y cobranza por mes y reparto
meses = pd.period_range("2025-01", "2025-10", freq="M")
V["mes"], P["mes"], M["mes"] = V.fecha.dt.to_period("M"), P.fecha.dt.to_period("M"), M.fecha.dt.to_period("M")
VA = V[V.id_cliente.isin(ids)]
PA = P[P.id_cliente.isin(ids)]
MA = M[M.id_cliente.isin(ids)]
venta_m = VA.groupby(["id_reparto", "mes"]).importe.sum()
cobro_m = PA.groupby(["id_reparto", "mes", "medio"]).importe.sum()
ncinc_m = MA[MA.tipo.isin(["Nota de crédito", "Incobrable"])].groupby(["id_reparto", "mes", "tipo"]).importe.sum()
# deuda al cierre de cada mes (o al corte): saldo positivo de cada cliente, asignado a su reparto
cli_rep = dict(zip(ALC.id_cliente, ALC.id_reparto))
deuda_m = {}
for m in meses:
    t = min(m.end_time.normalize(), CORTE).to_datetime64().astype("datetime64[D]")
    acc = {}
    for c in ids:
        fd, vd = DEB.get(c, E)
        s = suma_hasta((fd, vd), t) - suma_hasta(CRE.get(c, E), t)
        if s > 0:
            acc[cli_rep[c]] = acc.get(cli_rep[c], 0) + s
    deuda_m[str(m)] = acc
dias_rep = {}
for m in meses:
    rng = pd.date_range(m.start_time, min(m.end_time, CORTE), freq="D")
    dias_rep[str(m)] = int((rng.dayofweek < 6).sum())              # lunes a sábado
medios = list(MED.medio)
dc = []
for r in sorted(com):
    fila = {"r": r, "m": []}
    for m in meses:
        k = str(m)
        fila["m"].append([round(venta_m.get((r, m), 0)), round(deuda_m[k].get(r, 0)),
                          [round(cobro_m.get((r, m, md), 0)) for md in medios],
                          round(ncinc_m.get((r, m, "Nota de crédito"), 0)), round(ncinc_m.get((r, m, "Incobrable"), 0))])
    dc.append(fila)

# ---------------------------------------------------------------- control de notas de crédito
ncl = NC[NC.fecha >= "2025-04-01"].copy()
fac6 = []
for _, r in ncl.iterrows():
    t = r.fecha.to_datetime64().astype("datetime64[D]")
    fac6.append(suma_hasta(VEN.get(r.id_cliente, E), t - DIA, t - 181 * DIA) / 6)
ncl["fac6"] = np.round(fac6)
rev_last = REV.sort_values("fecha").groupby("id_cliente").last()
def estado_rev(r):
    g = REV[(REV.id_cliente == r.id_cliente) & (REV.fecha >= r.fecha) & (REV.fecha <= r.fecha + pd.Timedelta(days=21))]
    return g.resultado.iloc[0] if len(g) else ""
ncl["revision"] = [estado_rev(r) for _, r in ncl.iterrows()]
ncl = ncl.merge(ALC[["id_cliente", "nombre", "tipo_cliente"]], on="id_cliente")
nclist = [[r.fecha.strftime("%Y-%m-%d"), int(r.id_cliente), r.id_reparto, int(r.importe), int(r.fac6), r.motivo, r.revision]
          for r in ncl.sort_values("fecha").itertuples()]

# ---------------------------------------------------------------- ficha por cliente
ficha = {}
gest_all = GE.sort_values("fecha")
sem_ini = LUNES[0] - pd.Timedelta(days=7)
for c in cuentas.id_cliente:
    movs = []
    for f, v in zip(*VEN.get(c, E)):
        movs.append((f, "Venta", v, ""))
    pp = P[P.id_cliente == c]
    for r in pp.itertuples():
        movs.append((np.datetime64(r.fecha, "D"), "Pago", r.importe, r.medio))
    for r in M[(M.id_cliente == c) & (M.tipo != "Saldo inicial")].itertuples():
        movs.append((np.datetime64(r.fecha, "D"), r.tipo, r.importe, r.motivo))
    movs.sort(key=lambda x: x[0], reverse=True)
    g = gest_all[gest_all.id_cliente == c].tail(4)
    serie_v, serie_p = [], []
    for k in range(12):
        a = (sem_ini + pd.Timedelta(days=7 * k)).to_datetime64().astype("datetime64[D]")
        b = a + 6 * DIA
        serie_v.append(round(suma_hasta(VEN.get(c, E), b, a - DIA)))
        serie_p.append(round(suma_hasta(PAG.get(c, E), b, a - DIA)))
    ficha[int(c)] = {"mv": [[str(m[0]), m[1], int(m[2]), m[3]] for m in movs[:10]],
                     "g": [[r.fecha.strftime("%Y-%m-%d"), r.area, r.tipo, r.resultado] for r in g.itertuples()][::-1],
                     "sv": serie_v, "sp": serie_p}

# ---------------------------------------------------------------- salida
rep_info = REP[REP.tipo_reparto == "Comercial"].merge(SUP, on=["id_supervisor", "id_sucursal"]).merge(SUC[["id_sucursal", "sucursal"]], on="id_sucursal")
out = {
    "meta": {"empresa": "Reparto Federal S.A.", "nota": "Datos 100% ficticios", "corte": CORTE.strftime("%Y-%m-%d"),
             "hora": "18:00", "semanas": semanas, "meses": [str(m) for m in meses], "dias_reparto": dias_rep,
             "parcial": str(meses[-1]), "fuera": fuera, "umbrales": UMBRALES},
    "medios": [[m, float(c)] for m, c in zip(MED.medio, MED.comision)],
    "suc": SUC[["id_sucursal", "sucursal", "lat", "lng"]].values.tolist(),
    "sup": SUP[["id_supervisor", "supervisor", "id_sucursal"]].values.tolist(),
    "rep": rep_info[["id_reparto", "id_supervisor", "id_sucursal"]].values.tolist(),
    "cols": COLS,
    "cli": [[int(r.id_cliente), r.nombre, r.tipo_cliente, r.id_reparto, r.condicion, r.medio_habitual, r.lat, r.lng]
            for r in cuentas.itertuples()],
    "f": FE.tolist(),
    "dc": dc,
    "nc": nclist,
    "ficha": ficha,
}
path = os.path.join(DAT, "dashboard_data.json")
with open(path, "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
print("cuentas con actividad", len(cuentas), "de", len(ids), "| semanas", len(semanas), "| tamaño", os.path.getsize(path) // 1024, "KB")
