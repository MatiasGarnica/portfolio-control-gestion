"""Caso 03 · base de alertas: parte de la base del Caso 02 (misma empresa) y le suma lo que el control necesita.

Uso:  python generate_alertas.py     → escribe ../01_datos/*.csv (semilla fija)

Qué agrega a la base del Caso 02
  dim_equipo           equipos en comodato: dispensers y heladeras, con su modalidad (abono mensual o comodato por consumo)
  fact_equipo          instalaciones y retiros (los hace el reparto técnico)
  fact_abono           abono mensual facturado por equipo
  fact_cambio_reparto  cambios de ruta de cada cliente
  fact_pago.canal      Reparto · Sucursal · Digital · Débito (el efectivo puede pagarse en la sucursal, sin visita)

Casos sembrados (para medir si las reglas los encuentran; el tablero no lee este archivo)
  equipo sin abono       equipos instalados a los que nunca se les dio de alta el abono, o se les cortó
  equipo sin consumo     clientes con equipo en comodato que dejan de comprar
  solo sin cargo         clientes que pasan a recibir solo entregas sin cargo (dos repartos)
  cobro sin visita       pagos en efectivo registrados días después de la visita (dos repartos)
  incobrables            un reparto que pasa a incobrable a clientes que siguen comprando
  cambio de ruta         cuentas con deuda pasadas a rutas que no venden (salen de los días calle)
También hay ruido a propósito: bonificaciones autorizadas, visitas mal cargadas, cambios de ruta legítimos.
"""
import os
import numpy as np
import pandas as pd

RNG = np.random.default_rng(20251010)
D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(D, "..", "..", "caso-02-cuenta-corriente", "01_datos"))
OUT = os.path.normpath(os.path.join(D, "..", "01_datos"))
os.makedirs(OUT, exist_ok=True)
CORTE = pd.Timestamp("2025-10-09")
rd = lambda f, **k: pd.read_csv(os.path.join(SRC, f), **k)
SUC, SUP, REP, CLI, MED = rd("dim_sucursal.csv"), rd("dim_supervisor.csv"), rd("dim_reparto.csv"), rd("dim_cliente.csv", parse_dates=["fecha_alta"]), rd("dim_medio_pago.csv")
V = rd("fact_venta.csv", parse_dates=["fecha"])
P = rd("fact_pago.csv", parse_dates=["fecha"])
M = rd("fact_movimiento.csv", parse_dates=["fecha"])
VI = rd("fact_visita.csv", parse_dates=["fecha"])
GE = rd("fact_gestion.csv", parse_dates=["fecha"])
COM = set(REP[REP.tipo_reparto == "Comercial"].id_reparto)
truth = []                                                     # casos sembrados: (regla, clave, id_cliente, detalle)

def indice(f):
    return 1.023 ** ((f.year - 2025) * 12 + f.month - 1)

# ---------------------------------------------------------------- clientes pasados a incobrable: dejan de ser atendidos
# (en la base del Caso 02 seguían comprando; acá se corrige para que «sigue comprando después del incobrable» sea una señal)
baja = M[M.tipo == "Incobrable"].groupby("id_cliente").fecha.min()
for df_name in ("V", "P", "VI"):
    df = globals()[df_name]
    lim = df.id_cliente.map(baja)
    globals()[df_name] = df[~(lim.notna() & (df.fecha > lim))].copy()

# ---------------------------------------------------------------- canal de pago
P["canal"] = P.medio.map({"Efectivo": "Reparto", "Débito automático": "Débito"}).fillna("Digital")
# una parte del efectivo se paga en la sucursal (legítimo, sin visita): se corre a otro día hábil
suc = P.index[(P.medio == "Efectivo") & (RNG.random(len(P)) < 0.05)]
P.loc[suc, "canal"] = "Sucursal"
P.loc[suc, "fecha"] = (P.loc[suc, "fecha"] + pd.to_timedelta(RNG.integers(1, 4, len(suc)), unit="D")).clip(upper=CORTE)

activos = CLI[(CLI.cuenta_interna == 0) & CLI.id_reparto.isin(COM)]
ult_venta = V.groupby("id_cliente").fecha.max()
regulares = activos[activos.id_cliente.map(ult_venta).ge(CORTE - pd.Timedelta(days=12))]

# ---------------------------------------------------------------- equipos en comodato
EQ, MOV, ABO = [], [], []
n_eq = 1
tec = {"S1": "T-91", "S2": "T-91", "S3": "T-92"}
for c in activos.itertuples():
    if c.tipo_cliente == "Hogar":
        lista = [("Dispenser frío/calor", "Abono mensual" if RNG.random() < 0.6 else "Comodato por consumo")] if RNG.random() < 0.35 else []
    elif c.tipo_cliente == "Comercio":
        lista = ([("Heladera exhibidora", "Comodato por consumo")] if RNG.random() < 0.6 else []) + \
                ([("Dispenser frío/calor", "Abono mensual")] if RNG.random() < 0.2 else [])
    else:
        lista = [("Dispenser frío/calor", "Abono mensual")] * (int(RNG.integers(1, 4)) if RNG.random() < 0.8 else 0)
    for tipo, modo in lista:
        ini = max(c.fecha_alta, pd.Timestamp("2021-01-01"))
        dias = (pd.Timestamp("2025-09-20") - ini).days
        inst = ini + pd.Timedelta(days=int(RNG.integers(0, max(dias, 1)))) if RNG.random() < 0.3 else ini + pd.Timedelta(days=int(RNG.integers(0, 20)))
        inst = min(inst, pd.Timestamp("2025-09-20"))
        valor = 950000 if tipo == "Heladera exhibidora" else 185000
        abono = 0 if modo != "Abono mensual" else (8900 if c.tipo_cliente == "Empresa" else 6900)
        eid = f"EQ-{n_eq:04d}"; n_eq += 1
        EQ.append((eid, tipo, modo, valor, abono))
        MOV.append((inst.normalize(), eid, c.id_cliente, "Instalación", tec[c.id_sucursal]))
        if RNG.random() < 0.04:                                              # retiros normales
            ret = inst + pd.Timedelta(days=int(RNG.integers(60, 500)))
            if ret <= pd.Timestamp("2025-09-30"):
                MOV.append((ret.normalize(), eid, c.id_cliente, "Retiro", tec[c.id_sucursal]))
DEQ = pd.DataFrame(EQ, columns=["id_equipo", "tipo_equipo", "modalidad", "valor_reposicion", "abono_mensual"])
FEQ = pd.DataFrame(MOV, columns=["fecha", "id_equipo", "id_cliente", "tipo", "id_reparto"])

inst = FEQ[FEQ.tipo == "Instalación"].set_index("id_equipo")
ret = FEQ[FEQ.tipo == "Retiro"].set_index("id_equipo").fecha
abono_eq = DEQ[DEQ.modalidad == "Abono mensual"].id_equipo.values
# A1 sembrado: 22 equipos instalados entre junio y agosto a los que no se les dio de alta el abono, y 6 a los que se les cortó en agosto
nuevos = RNG.choice([e for e in abono_eq if e not in ret.index], size=22, replace=False)
for e in nuevos:
    f = pd.Timestamp("2025-06-02") + pd.Timedelta(days=int(RNG.integers(0, 85)))
    FEQ.loc[(FEQ.id_equipo == e) & (FEQ.tipo == "Instalación"), "fecha"] = f
    truth.append(("equipo_sin_abono", e, int(inst.loc[e, "id_cliente"]), f"Instalado el {f:%d/%m/%Y}: el abono nunca se dio de alta"))
inst = FEQ[FEQ.tipo == "Instalación"].set_index("id_equipo")
viejos = [e for e in abono_eq if e not in ret.index and e not in nuevos and inst.loc[e, "fecha"] < pd.Timestamp("2025-01-01")]
cortados = set(RNG.choice(viejos, size=6, replace=False))
for e in cortados:
    truth.append(("equipo_sin_abono", e, int(inst.loc[e, "id_cliente"]), "El abono dejó de facturarse en agosto (cambio de domicilio mal cargado)"))
for e in abono_eq:
    i = inst.loc[e, "fecha"]
    if e in nuevos:
        continue
    imp = int(DEQ.loc[DEQ.id_equipo == e, "abono_mensual"].iat[0])
    for m in pd.date_range("2025-01-01", CORTE, freq="MS"):
        if m <= i or (e in ret.index and m > ret[e]) or (e in cortados and m >= pd.Timestamp("2025-08-01")):
            continue
        dia = m + pd.Timedelta(days=int(RNG.integers(0, 3)))                  # se factura entre el 1 y el 3
        ABO.append((dia, e, int(inst.loc[e, "id_cliente"]), round(imp * 1.07 ** ((m.month - 1) // 3))))
FAB = pd.DataFrame(ABO, columns=["fecha", "id_equipo", "id_cliente", "importe"])

# ---------------------------------------------------------------- A2 sembrado: clientes con equipo en comodato que dejan de comprar
comodato = DEQ[DEQ.modalidad == "Comodato por consumo"].id_equipo
cand = inst.loc[inst.index.isin(comodato) & ~inst.index.isin(ret.index) & (inst.fecha < pd.Timestamp("2025-05-01"))]
cand = cand[cand.id_cliente.isin(regulares.id_cliente)]
sin_consumo = RNG.choice(cand.id_cliente.unique(), size=25, replace=False)
for cid in sin_consumo:
    stop = pd.Timestamp("2025-07-10") + pd.Timedelta(days=int(RNG.integers(0, 42)))
    V = V[~((V.id_cliente == cid) & (V.fecha >= stop))]
    P = P[~((P.id_cliente == cid) & (P.fecha >= stop))]
    for e in cand.index[cand.id_cliente == cid]:
        truth.append(("equipo_sin_consumo", e, int(cid), f"Deja de comprar el {stop:%d/%m/%Y} y el equipo sigue instalado"))
usados = set(sin_consumo)

# ---------------------------------------------------------------- A3 sembrado: pasan a recibir solo sin cargo
def elegir(rep, n):
    pool = regulares[(regulares.id_reparto == rep) & regulares.tipo_cliente.isin(["Hogar", "Comercio"]) & ~regulares.id_cliente.isin(usados)].id_cliente.values
    sel = RNG.choice(pool, size=n, replace=False)
    usados.update(sel)
    return sel
solo_sc = list(elegir("R-05", 8)) + list(elegir("R-16", 4)) + list(elegir("R-21", 1)) + list(elegir("R-08", 1))
for cid in solo_sc:
    ini = pd.Timestamp("2025-08-25") + pd.Timedelta(days=int(RNG.integers(0, 22)))
    m = (V.id_cliente == cid) & (V.fecha >= ini)
    tipo = CLI.loc[CLI.id_cliente == cid, "tipo_cliente"].iat[0]
    V.loc[m, "importe"] = 0
    V.loc[m, "unidades_sin_cargo"] = RNG.integers(2, 5, m.sum()) * (2 if tipo == "Comercio" else 1)
    P = P[~((P.id_cliente == cid) & (P.fecha >= ini))]
    truth.append(("solo_sin_cargo", str(cid), int(cid), f"Desde el {ini:%d/%m/%Y} recibe solo entregas sin cargo"))
# ruido: tres bonificaciones autorizadas por comercial (un mes sin cargo por un reclamo)
bonif = list(elegir("R-03", 1)) + list(elegir("R-19", 1)) + list(elegir("R-24", 1))
GX = []
for cid in bonif:
    ini = pd.Timestamp("2025-09-10") + pd.Timedelta(days=int(RNG.integers(0, 4)))
    m = (V.id_cliente == cid) & (V.fecha >= ini)
    V.loc[m, "importe"] = 0
    V.loc[m, "unidades_sin_cargo"] = 2
    P = P[~((P.id_cliente == cid) & (P.fecha >= ini))]
    GX.append((ini - pd.Timedelta(days=2), cid, "Comercial", "Bonificación autorizada", "Un mes sin cargo por reclamo del servicio"))

# ---------------------------------------------------------------- A5 sembrado: efectivo registrado días después de la visita (R-09 y R-22)
pe = P[(P.canal == "Reparto") & P.id_reparto.isin(["R-09", "R-22"]) & (P.fecha >= pd.Timestamp("2025-08-01")) & (P.fecha <= CORTE - pd.Timedelta(days=6))
       & ~P.id_cliente.isin(usados)]
tard = RNG.choice(pe.index, size=36, replace=False)
for ix in tard:
    d = int(RNG.integers(2, 6))
    P.loc[ix, "fecha"] = P.loc[ix, "fecha"] + pd.Timedelta(days=d)
    truth.append(("cobro_sin_visita", f"{int(P.loc[ix, 'id_cliente'])}|{P.loc[ix, 'fecha']:%Y-%m-%d}", int(P.loc[ix, "id_cliente"]),
                  f"Cobrado en la visita y registrado {d} días después ({P.loc[ix, 'id_reparto']})"))
# ruido: visitas mal cargadas como «no pasó» en días con cobro en efectivo (8 casos sueltos en otros repartos)
pr = P[(P.canal == "Reparto") & ~P.id_reparto.isin(["R-09", "R-22"]) & (P.fecha >= pd.Timestamp("2025-08-01"))]
for ix in RNG.choice(pr.index, size=8, replace=False):
    m = (VI.id_cliente == P.loc[ix, "id_cliente"]) & (VI.fecha == P.loc[ix, "fecha"])
    VI.loc[m, "visito"] = 0

# ---------------------------------------------------------------- A4 sembrado: incobrables a clientes que siguen comprando (R-14)
def saldo_al(cid, t):
    deb = V[(V.id_cliente == cid) & (V.fecha <= t)].importe.sum() + M[(M.id_cliente == cid) & (M.fecha <= t) & M.tipo.isin(["Saldo inicial", "Reversa de pago"])].importe.sum()
    cre = P[(P.id_cliente == cid) & (P.fecha <= t)].importe.sum() + M[(M.id_cliente == cid) & (M.fecha <= t) & M.tipo.isin(["Nota de crédito", "Incobrable"])].importe.sum()
    return deb - cre
r14 = regulares[(regulares.id_reparto == "R-14") & ~regulares.id_cliente.isin(usados)].id_cliente.values
nuevos_inc = []
for cid in RNG.permutation(r14):
    f = pd.Timestamp("2025-09-01") + pd.Timedelta(days=int(RNG.integers(0, 26)))
    s = saldo_al(cid, f)
    if s >= 20000:
        nuevos_inc.append((f, cid, "R-14", "Incobrable", round(s, -1), RNG.choice(["Sin datos de contacto", "Cliente se mudó"])))
        truth.append(("incobrables", "R-14", int(cid), f"Pasado a incobrable el {f:%d/%m/%Y} y sigue comprando"))
        usados.add(cid)
    if len(nuevos_inc) == 5:
        break
M = pd.concat([M, pd.DataFrame(nuevos_inc, columns=M.columns)], ignore_index=True)
for r in ("R-27", "R-28"):
    truth.append(("incobrables", r, 0, "Reparto con más morosos e incobrables desde el Caso 02"))

# ---------------------------------------------------------------- A7 sembrado: cuentas con deuda pasadas a rutas que no venden
CR = []
def mover(cid, f, destino, motivo):
    origen = CLI.loc[CLI.id_cliente == cid, "id_reparto"].iat[0]
    CR.append((f, cid, origen, destino, motivo))
    CLI.loc[CLI.id_cliente == cid, "id_reparto"] = destino
    if destino not in COM:          # deja de tener visitas comerciales y ventas
        global V, P, VI
        V = V[~((V.id_cliente == cid) & (V.fecha > f))]
        P = P[~((P.id_cliente == cid) & (P.fecha > f) & (P.canal == "Reparto"))]
        VI = VI[~((VI.id_cliente == cid) & (VI.fecha > f))]
    else:
        for df in (V, P, VI):
            df.loc[(df.id_cliente == cid) & (df.fecha > f), "id_reparto"] = destino
    return origen
deudores = activos[activos.id_reparto.isin(["R-26", "R-27", "R-28", "R-29", "R-30", "R-11", "R-17"]) & ~activos.id_cliente.isin(usados)]
plan = {"R-26": 1, "R-27": 3, "R-28": 4, "R-29": 1, "R-11": 2, "R-17": 1}
for rep, n in plan.items():
    hechos = 0
    for cid in RNG.permutation(deudores[deudores.id_reparto == rep].id_cliente.values):
        f = pd.Timestamp("2025-08-25") + pd.Timedelta(days=int(RNG.integers(0, 12)))
        s = saldo_al(cid, f)
        if s >= 60000:
            mover(cid, f, "A-99", "Reasignación administrativa")
            truth.append(("cambio_ruta", str(cid), int(cid), f"Pasado de {rep} a Administración el {f:%d/%m/%Y} con $ {s:,.0f} de deuda".replace(",", ".")))
            usados.add(cid); hechos += 1
        if hechos == n:
            break
# ruido: cambios legítimos entre repartos comerciales y clientes que pasan a solo servicio técnico sin deuda
for cid in RNG.choice(activos[~activos.id_cliente.isin(usados)].id_cliente.values, size=40, replace=False):
    f = pd.Timestamp("2025-03-03") + pd.Timedelta(days=int(RNG.integers(0, 200)))
    suc = CLI.loc[CLI.id_cliente == cid, "id_sucursal"].iat[0]
    destino = RNG.choice(REP[(REP.id_sucursal == suc) & REP.id_reparto.isin(COM)].id_reparto.values)
    if destino != CLI.loc[CLI.id_cliente == cid, "id_reparto"].iat[0]:
        mover(cid, f, destino, "Reordenamiento de recorridos")
    usados.add(cid)
tecnicos = 0
for cid in RNG.permutation(activos[~activos.id_cliente.isin(usados)].id_cliente.values):
    f = pd.Timestamp("2025-05-05") + pd.Timedelta(days=int(RNG.integers(0, 120)))
    if abs(saldo_al(cid, f)) < 1:
        mover(cid, f, "T-91" if CLI.loc[CLI.id_cliente == cid, "id_sucursal"].iat[0] != "S3" else "T-92", "Pasa a solo servicio técnico")
        usados.add(cid); tecnicos += 1
    if tecnicos == 6:
        break
FCR = pd.DataFrame(CR, columns=["fecha", "id_cliente", "reparto_origen", "reparto_destino", "motivo"])

# ---------------------------------------------------------------- escritura
GE = pd.concat([GE, pd.DataFrame(GX, columns=GE.columns)], ignore_index=True).sort_values("fecha")
CLI = CLI.copy()
for df in (V, P, M, VI, GE, FEQ, FAB, FCR):
    df["fecha"] = pd.to_datetime(df.fecha).dt.strftime("%Y-%m-%d")
CLI["fecha_alta"] = CLI.fecha_alta.dt.strftime("%Y-%m-%d")
for name, df in [("dim_sucursal", SUC), ("dim_supervisor", SUP), ("dim_reparto", REP), ("dim_cliente", CLI), ("dim_medio_pago", MED),
                 ("dim_equipo", DEQ), ("fact_venta", V.sort_values(["fecha", "id_cliente"])),
                 ("fact_pago", P.sort_values(["fecha", "id_cliente"])[["fecha", "id_cliente", "id_reparto", "importe", "medio", "canal"]]),
                 ("fact_movimiento", M.sort_values(["fecha", "id_cliente"])), ("fact_visita", VI.sort_values(["fecha", "id_cliente"])),
                 ("fact_gestion", GE), ("fact_equipo", FEQ.sort_values(["fecha", "id_equipo"])), ("fact_abono", FAB.sort_values(["fecha", "id_equipo"])),
                 ("fact_cambio_reparto", FCR.sort_values("fecha"))]:
    df.to_csv(os.path.join(OUT, f"{name}.csv"), index=False)
T = pd.DataFrame(truth, columns=["regla", "clave", "id_cliente", "detalle"])
T.to_csv(os.path.join(OUT, "casos_sembrados.csv"), index=False)
print(f"equipos {len(DEQ)} · instalaciones {int((FEQ.tipo == 'Instalación').sum())} · abonos {len(FAB)} · cambios de ruta {len(FCR)} · pagos {len(P)}")
print(T.groupby("regla").size().to_dict())
