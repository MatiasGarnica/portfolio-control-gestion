"""Caso 02 · genera la base ficticia de «Reparto Federal S.A.» (distribuidora con reparto propio y 3 sucursales).

Uso:  python generate_case.py            → reescribe ../01_datos/*.csv (semilla fija: siempre los mismos datos)

Tablas (modelo estrella, igual que en SQL Server: ver ../sql/01_esquema.sql)
  dim_sucursal, dim_supervisor, dim_reparto, dim_cliente
  fact_venta       una fila por entrega (con cargo y unidades sin cargo de promo 2x1)
  fact_pago        una fila por pago, con el medio de cobro
  fact_movimiento  notas de crédito, ajustes, incobrables y reversas de pago (pago desconocido por el cliente)
  fact_visita      una fila por visita programada: si el reparto pasó o no
  fact_gestion     llamados y revisiones registrados por supervisión y administración

Todo es inventado: nombres, montos, coordenadas y comportamientos. Los patrones (un reparto que no visita,
notas de crédito concentradas, clientes morosos) están puestos a propósito para que las reglas tengan qué detectar.
"""
import os
import numpy as np
import pandas as pd

RNG = np.random.default_rng(20251009)
D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(D, "..", "01_datos"))
os.makedirs(OUT, exist_ok=True)

INICIO = pd.Timestamp("2025-01-06")          # lunes
CORTE = pd.Timestamp("2025-10-09")           # jueves: datos hasta este día inclusive
INICIO_HOJA = pd.Timestamp("2025-07-28")     # lunes de la semana 31: primera hoja de trabajo

# ---------------------------------------------------------------- dimensiones
SUC = pd.DataFrame([
    ("S1", "Norte", -31.360, -64.215),
    ("S2", "Centro", -31.418, -64.188),
    ("S3", "Sur", -31.472, -64.182),
], columns=["id_sucursal", "sucursal", "lat", "lng"])

SUP = pd.DataFrame([
    ("SP1", "M. Paz", "S1", 1.10), ("SP2", "L. Ruiz", "S1", 1.05),
    ("SP3", "C. Medina", "S2", 1.03), ("SP4", "A. Álvarez", "S2", 0.92),
    ("SP5", "J. Ortiz", "S3", 0.97), ("SP6", "R. Ledesma", "S3", 0.80),
], columns=["id_supervisor", "supervisor", "id_sucursal", "gestion"])

rep_rows = []
n = 1
for _, s in SUP.iterrows():
    for k in range(5):
        rid = f"R-{n:02d}"
        # calidad de visita: la mayoría visita bien; tres repartos se saltean visitas
        salteo = {"R-12": 0.16, "R-27": 0.14, "R-28": 0.18}.get(rid, RNG.uniform(0.02, 0.05))
        rep_rows.append((rid, f"Reparto {n:02d}", s.id_supervisor, s.id_sucursal, "Comercial", salteo))
        n += 1
for rid, nom, tipo in [("T-91", "Técnico norte", "Técnico"), ("T-92", "Técnico sur", "Técnico"),
                       ("A-99", "Administración", "Administración")]:
    rep_rows.append((rid, nom, None, "S2", tipo, 0.0))
REP = pd.DataFrame(rep_rows, columns=["id_reparto", "reparto", "id_supervisor", "id_sucursal", "tipo_reparto", "prob_salteo"])
COM = REP[REP.tipo_reparto == "Comercial"].reset_index(drop=True)

# ---------------------------------------------------------------- clientes
N_COM, N_NOCOM, N_INT = 2400, 60, 15
tipos = RNG.choice(["Hogar", "Comercio", "Empresa"], size=N_COM, p=[0.70, 0.24, 0.06])
rep_idx = RNG.integers(0, len(COM), size=N_COM)
perfil = RNG.choice(["contado", "cuenta", "irregular", "moroso"], size=N_COM, p=[0.48, 0.24, 0.18, 0.10])
# los repartos 27 y 28 concentran más morosos
for i in range(N_COM):
    if COM.id_reparto[rep_idx[i]] in ("R-27", "R-28") and RNG.random() < 0.18:
        perfil[i] = "moroso"
cli = pd.DataFrame({
    "id_cliente": np.arange(10001, 10001 + N_COM),
    "tipo_cliente": tipos,
    "id_reparto": COM.id_reparto.values[rep_idx],
    "perfil_pago": perfil,
})
nocom = pd.DataFrame({
    "id_cliente": np.arange(20001, 20001 + N_NOCOM),
    "tipo_cliente": RNG.choice(["Hogar", "Comercio"], size=N_NOCOM, p=[0.6, 0.4]),
    "id_reparto": RNG.choice(["T-91", "T-92", "A-99"], size=N_NOCOM, p=[0.4, 0.4, 0.2]),
    "perfil_pago": RNG.choice(["contado", "irregular", "moroso"], size=N_NOCOM, p=[0.4, 0.3, 0.3]),
})
inter = pd.DataFrame({
    "id_cliente": np.arange(30001, 30001 + N_INT), "tipo_cliente": "Interna",
    "id_reparto": RNG.choice(COM.id_reparto.values, size=N_INT), "perfil_pago": "cuenta",
})
CLI = pd.concat([cli, nocom, inter], ignore_index=True)
CLI["cuenta_interna"] = (CLI.tipo_cliente == "Interna").astype(int)
CLI = CLI.merge(REP[["id_reparto", "id_sucursal"]], on="id_reparto", how="left").merge(SUC[["id_sucursal", "lat", "lng"]], on="id_sucursal")
CLI["lat"] = (CLI.lat + RNG.normal(0, 0.018, len(CLI))).round(5)
CLI["lng"] = (CLI.lng + RNG.normal(0, 0.022, len(CLI))).round(5)
CLI["dia_visita"] = RNG.integers(0, 6, len(CLI))                    # 0 = lunes … 5 = sábado
CLI["frecuencia"] = np.where((CLI.tipo_cliente == "Empresa") & (RNG.random(len(CLI)) < 0.5), "Quincenal", "Semanal")
CLI["semana_cobro"] = RNG.integers(2, 5, len(CLI))                  # perfil «cuenta»: paga cada 2, 3 o 4 semanas
alta = INICIO - pd.to_timedelta(RNG.integers(30, 1500, len(CLI)), unit="D")
nuevas = RNG.random(len(CLI)) < 0.10                                  # 10% se dio de alta durante 2025
alta = alta.where(~nuevas, INICIO + pd.to_timedelta(RNG.integers(0, 230, len(CLI)), unit="D"))
CLI["fecha_alta"] = alta.normalize()
CLI["condicion"] = np.where(CLI.perfil_pago == "contado", "Contado", "Cuenta corriente")
digital = RNG.random(len(CLI))
CLI["medio_habitual"] = np.select([digital < 0.10, digital < 0.20, digital < 0.28, digital < 0.34],
                                  ["Débito automático", "Billetera virtual", "Link de pago", "Transferencia"], "Efectivo")
CLI["nombre"] = [f"{t} {i}" for t, i in zip(CLI.tipo_cliente, CLI.id_cliente)]

TICKET = {"Hogar": (9000, 18000), "Comercio": (35000, 90000), "Empresa": (120000, 350000), "Interna": (8000, 15000)}
COMISION = {"Efectivo": 0.0, "Billetera virtual": 0.032, "Link de pago": 0.044, "Débito automático": 0.015, "Transferencia": 0.0}

# ---------------------------------------------------------------- simulación semana a semana
def indice_precio(fecha):                     # ~2,3% mensual
    meses = (fecha.year - 2025) * 12 + fecha.month - 1
    return 1.023 ** meses

sup_gestion = dict(zip(SUP.id_supervisor, SUP.gestion))
rep_sup = {r: (s if isinstance(s, str) else None) for r, s in zip(REP.id_reparto, REP.id_supervisor)}
rep_salteo = dict(zip(REP.id_reparto, REP.prob_salteo))

ventas, pagos, movs, visitas, gestiones, atipicas = [], [], [], [], [], []
saldo = dict.fromkeys(CLI.id_cliente, 0.0)
ult_pago = {}
salteo_dia = {}
semana = INICIO
n_sem = 0
cli_rows = CLI.to_dict("records")
for c in cli_rows:
    c["t0"], c["t1"] = TICKET[c["tipo_cliente"]]
    c["base"] = RNG.uniform(c["t0"], c["t1"])
    saldo[c["id_cliente"]] = RNG.uniform(0, c["base"] * (3 if c["perfil_pago"] in ("irregular", "moroso") else 0.5))

while semana <= CORTE:
    en_hoja = semana >= INICIO_HOJA
    avance = max(0, (semana - INICIO_HOJA).days // 7)            # la gestión mejora semana a semana
    mes_digital = min(1.0, (semana - INICIO).days / 280)            # el cobro digital crece en el año
    # zonas sin visita: cada reparto puede saltearse un día entero de su recorrido; en los repartos flojos pasa seguido
    # y suele repetirse la semana siguiente (por eso aparecen cuentas «con deuda y sin visita»)
    previo = salteo_dia if n_sem else {}
    salteo_dia = {}
    for rid, pr in rep_salteo.items():
        for dd in range(6):
            base = pr * 0.9
            if previo.get((rid, dd)):
                base = min(0.85, base * 3.5)
            salteo_dia[(rid, dd)] = RNG.random() < base
    for c in cli_rows:
        cid = c["id_cliente"]
        if c["fecha_alta"] > semana + pd.Timedelta(days=6):
            continue
        if c["frecuencia"] == "Quincenal" and n_sem % 2 == 1:
            continue
        fecha = semana + pd.Timedelta(days=int(c["dia_visita"]))
        if fecha > CORTE:
            continue
        com = c["id_reparto"] in rep_sup and rep_sup[c["id_reparto"]] is not None
        salteo = rep_salteo.get(c["id_reparto"], 0.03)
        visito = (RNG.random() > 0.02) and not salteo_dia.get((c["id_reparto"], int(c["dia_visita"])), False)
        visitas.append((fecha, cid, c["id_reparto"], int(visito)))
        idx = indice_precio(fecha)
        if visito and RNG.random() < 0.93:
            imp = round(c["base"] * idx * RNG.uniform(0.7, 1.3), -1)
            sc = int(RNG.random() < 0.08) * int(RNG.integers(1, 3))        # unidades sin cargo (promo 2x1)
            ventas.append((fecha, cid, c["id_reparto"], imp, sc))
            saldo[cid] += imp
            # pago en la visita según el perfil; la hoja de trabajo empuja a cobrar lo atrasado
            p = {"contado": 0.95, "cuenta": 0.0, "irregular": 0.30, "moroso": 0.10}[c["perfil_pago"]]
            if c["perfil_pago"] == "cuenta" and n_sem % c["semana_cobro"] == 0:
                p = 0.90
            g = sup_gestion.get(rep_sup.get(c["id_reparto"]), 0.9)
            atrasado = saldo[cid] > c["base"] * idx * 1.5
            if en_hoja and atrasado and com:
                p = min(0.97, p + (0.14 + 0.04 * avance) * g)
            p *= g if c["perfil_pago"] in ("irregular", "moroso") else 1
            if RNG.random() < p and saldo[cid] > 0:
                frac = 1.0 if c["perfil_pago"] in ("contado", "cuenta") else RNG.uniform(0.35, 1.0)
                monto = round(min(saldo[cid], saldo[cid] * frac), -1)
                medio = c["medio_habitual"]
                if medio == "Efectivo" and RNG.random() < 0.10 + 0.12 * mes_digital:
                    medio = RNG.choice(["Billetera virtual", "Link de pago", "Transferencia"], p=[0.5, 0.3, 0.2])
                if medio == "Efectivo" or medio == "Débito automático":
                    fpago = fecha
                else:
                    fpago = min(CORTE, fecha + pd.Timedelta(days=int(RNG.integers(0, 3))))
                if monto > 0:
                    pagos.append((fpago, cid, c["id_reparto"], monto, medio))
                    saldo[cid] -= monto
                    ult_pago[cid] = fpago
                    # pago desconocido por el cliente (lo cargó el repartidor y el cliente lo niega): poco frecuente
                    if medio == "Efectivo" and RNG.random() < (0.012 if c["id_reparto"] in ("R-27", "R-28") else 0.0012):
                        movs.append((min(CORTE, fpago + pd.Timedelta(days=int(RNG.integers(3, 20)))), cid, c["id_reparto"],
                                     "Reversa de pago", monto, "Pago desconocido por el cliente"))
                        saldo[cid] += monto
        # pagos digitales sin visita (débito, transferencia) para clientes de cuenta corriente
        if c["medio_habitual"] in ("Débito automático", "Transferencia") and not visito and saldo[cid] > 0 and RNG.random() < 0.5:
            fpago = semana + pd.Timedelta(days=int(RNG.integers(0, 5)))
            if fpago <= CORTE:
                monto = round(saldo[cid], -1)
                pagos.append((fpago, cid, c["id_reparto"], monto, c["medio_habitual"]))
                saldo[cid] -= monto
                ult_pago[cid] = fpago
        # notas de crédito y ajustes
        if visito and RNG.random() < 0.03:
            motivo = RNG.choice(["Devolución de producto", "Corrección de precio", "Bonificación comercial"], p=[0.5, 0.3, 0.2])
            nc = round(c["base"] * idx * RNG.uniform(0.05, 0.25), -1)
            movs.append((fecha, cid, c["id_reparto"], "Nota de crédito", nc, motivo))
            saldo[cid] -= nc
    # notas de crédito desproporcionadas, concentradas en dos repartos (patrón a detectar)
    if True:
        for _ in range(RNG.poisson(1.8)):
            rid = RNG.choice(["R-28", "R-12", "R-28", "R-12"] + list(COM.id_reparto.values[:4]))
            cand = [c for c in cli_rows if c["id_reparto"] == rid and c["tipo_cliente"] != "Interna"]
            c = cand[RNG.integers(0, len(cand))]
            f = semana + pd.Timedelta(days=int(RNG.integers(0, 6)))
            if f <= CORTE:
                nc = round(c["base"] * indice_precio(f) * RNG.uniform(5, 26), -1)
                # el motivo cargado parece normal: lo que delata el caso es el monto contra lo que el cliente factura
                mot = RNG.choice(["Bonificación comercial", "Devolución de producto", "Corrección de precio"], p=[0.5, 0.35, 0.15])
                movs.append((f, c["id_cliente"], rid, "Nota de crédito", nc, mot))
                atipicas.append((f, c["id_cliente"], rid))
                saldo[c["id_cliente"]] -= nc
    # incobrables a fin de mes: morosos con saldo alto
    fin_mes = (semana + pd.offsets.MonthEnd(0))
    if semana <= fin_mes < semana + pd.Timedelta(days=7) and fin_mes <= CORTE:
        for c in cli_rows:
            cid = c["id_cliente"]
            if c["perfil_pago"] == "moroso" and saldo[cid] > c["base"] * 9 and RNG.random() < (0.30 if c["id_reparto"] in ("R-27", "R-28") else 0.08):
                imp = round(saldo[cid] * RNG.uniform(0.5, 1.0), -1)
                movs.append((fin_mes, cid, c["id_reparto"], "Incobrable", imp, RNG.choice(["Cliente se mudó", "Cerró el comercio", "Deuda prescripta", "Sin datos de contacto"])))
                saldo[cid] -= imp
    semana += pd.Timedelta(days=7)
    n_sem += 1

V = pd.DataFrame(ventas, columns=["fecha", "id_cliente", "id_reparto", "importe", "unidades_sin_cargo"])
P = pd.DataFrame(pagos, columns=["fecha", "id_cliente", "id_reparto", "importe", "medio"])
M = pd.DataFrame(movs, columns=["fecha", "id_cliente", "id_reparto", "tipo", "importe", "motivo"])
VI = pd.DataFrame(visitas, columns=["fecha", "id_cliente", "id_reparto", "visito"])

# saldo inicial (deuda anterior a 2025) como un cargo el 2024-12-31
ini = pd.DataFrame({"fecha": pd.Timestamp("2024-12-31"), "id_cliente": [c["id_cliente"] for c in cli_rows],
                    "id_reparto": [c["id_reparto"] for c in cli_rows], "tipo": "Saldo inicial",
                    "importe": [round(max(0.0, 0.0), -1) for c in cli_rows], "motivo": "Deuda al 31/12/2024"})
# (el saldo inicial se reconstruye para que los saldos cierren: saldo_final = inicial + ventas + reversas − pagos − NC − incobrables)
fin = pd.Series(saldo)
mov_sum = M.assign(s=np.where(M.tipo == "Reversa de pago", 1, -1) * M.importe).groupby("id_cliente").s.sum()
calc = V.groupby("id_cliente").importe.sum().reindex(fin.index, fill_value=0) - P.groupby("id_cliente").importe.sum().reindex(fin.index, fill_value=0) + mov_sum.reindex(fin.index, fill_value=0)
ini["importe"] = (fin - calc).reindex(ini.id_cliente).round(-1).clip(lower=0).values
ini = ini[ini.importe > 0]
M = pd.concat([ini, M], ignore_index=True)

# ---------------------------------------------------------------- gestiones (llamados y revisiones)
# se registran sobre cuentas atrasadas desde que existe la hoja; los mejores supervisores registran más
G = []
gest_cli = P.groupby("id_cliente").fecha.max()
atr = pd.DataFrame(atipicas, columns=["fecha", "id_cliente", "id_reparto"])
atr = atr[atr.fecha >= INICIO_HOJA - pd.Timedelta(days=30)]
for _, r in atr.iterrows():                             # revisión de NC fuera de lo normal
    s = rep_sup.get(r.id_reparto)
    if RNG.random() < 0.62 * sup_gestion.get(s, 0.9):
        f = r.fecha + pd.Timedelta(days=int(RNG.integers(3, 12)))
        if f <= CORTE:
            G.append((f, r.id_cliente, "Administración", "Revisión de nota de crédito",
                      RNG.choice(["NC justificada: devolución documentada", "NC mal cargada: se corrige", "NC sin respaldo: se informa a supervisión"], p=[0.45, 0.3, 0.25])))
deudores = CLI[(CLI.perfil_pago.isin(["irregular", "moroso"])) & (CLI.cuenta_interna == 0)].id_cliente.values
sem = INICIO_HOJA
while sem <= CORTE:
    for cid in RNG.choice(deudores, size=min(len(deudores), 160), replace=False):
        rid = CLI.loc[CLI.id_cliente == cid, "id_reparto"].iat[0]
        s = rep_sup.get(rid)
        if s and RNG.random() < 0.55 * sup_gestion[s]:
            f = sem + pd.Timedelta(days=int(RNG.integers(0, 5)))
            if f <= CORTE:
                G.append((f, cid, "Supervisión", "Llamado",
                          RNG.choice(["Promete pago", "No atiende", "Pide plan de pago", "Reclama una nota de crédito", "Reclamo por el servicio", "Pagará al repartidor"],
                                     p=[0.32, 0.25, 0.12, 0.10, 0.09, 0.12])))
    sem += pd.Timedelta(days=7)
GE = pd.DataFrame(G, columns=["fecha", "id_cliente", "area", "tipo", "resultado"])

# ---------------------------------------------------------------- escritura
for df in (V, P, M, VI, GE):
    df["fecha"] = pd.to_datetime(df.fecha).dt.strftime("%Y-%m-%d")
for col in ("importe",):
    for df in (V, P, M):
        df[col] = df[col].round(0).astype("int64")
SUC.to_csv(f"{OUT}/dim_sucursal.csv", index=False)
SUP.drop(columns="gestion").to_csv(f"{OUT}/dim_supervisor.csv", index=False)
REP.drop(columns="prob_salteo").to_csv(f"{OUT}/dim_reparto.csv", index=False)
CLI[["id_cliente", "nombre", "tipo_cliente", "id_reparto", "id_sucursal", "condicion", "medio_habitual", "frecuencia",
     "dia_visita", "fecha_alta", "cuenta_interna", "lat", "lng"]].assign(fecha_alta=lambda d: d.fecha_alta.dt.strftime("%Y-%m-%d")).to_csv(f"{OUT}/dim_cliente.csv", index=False)
V.sort_values(["fecha", "id_cliente"]).to_csv(f"{OUT}/fact_venta.csv", index=False)
P.sort_values(["fecha", "id_cliente"]).to_csv(f"{OUT}/fact_pago.csv", index=False)
M.sort_values(["fecha", "id_cliente"]).to_csv(f"{OUT}/fact_movimiento.csv", index=False)
VI.sort_values(["fecha", "id_cliente"]).to_csv(f"{OUT}/fact_visita.csv", index=False)
GE.sort_values(["fecha", "id_cliente"]).to_csv(f"{OUT}/fact_gestion.csv", index=False)
pd.DataFrame({"medio": list(COMISION), "comision": list(COMISION.values())}).to_csv(f"{OUT}/dim_medio_pago.csv", index=False)
print("ventas", len(V), "pagos", len(P), "movimientos", len(M), "visitas", len(VI), "gestiones", len(GE), "clientes", len(CLI))
