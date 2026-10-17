"""Caso 03 · motor de alertas. Misma lógica que el tablero (app.js) y que ../sql/02_alertas.sql.

Uso:  python alertas.py        → imprime las alertas con los parámetros acordados y cuántos casos sembrados encuentra cada regla
      from alertas import candidatos, evaluar, PARAMS

Dos pasos, como en el tablero:
  candidatos(base)  arma, una vez por corrida, los casos posibles de cada regla con los cortes más amplios que ofrece el tablero
  evaluar(cand, p)  aplica los parámetros y devuelve las alertas (por eso el tablero puede recalcular en vivo)
"""
import os
import numpy as np
import pandas as pd

D = os.path.dirname(os.path.abspath(__file__))
DAT = os.path.join(D, "..", "01_datos")
CORTE = pd.Timestamp("2025-10-09")
DIA = pd.Timedelta(days=1)

PARAMS = {
    "abono_tol": 45,                    # A1 días desde la instalación antes de exigir el abono
    "consumo_dias": 45,                 # A2 sin compras con cargo hace más de…
    "consumo_antig": 60,                # A2 …en equipos instalados hace más de
    "sc_ventana": 28,                   # A3 días mirados
    "sc_min": 2,                        # A3 entregas mínimas en la ventana, todas sin cargo
    "sc_hist": 84, "sc_hist_min": 4,    # A3 antes compraba con cargo: al menos 4 entregas en los 84 días previos
    "inc_ventana": 180, "inc_min": 3, "inc_veces": 4.0,   # A4 incobrables por reparto: concentración contra la mediana…
    "inc_sigue": 2,                                       # …o varios a clientes que siguen comprando después
    "csv_ventana": 60, "csv_min": 3,    # A5 cobros en efectivo sin visita: casos por reparto
    "nc_ventana": 90, "nc_piso": 50000, "nc_veces": 2.0,  # A6 notas de crédito
    "ruta_piso": 20000,                 # A7 saldo al pasar a una ruta que no vende
}
REGLAS = {
    "equipo_sin_abono":   ("Equipo instalado sin abono", "Administración"),
    "equipo_sin_consumo": ("Equipo sin consumo", "Comercial"),
    "solo_sin_cargo":     ("Pasa a recibir solo sin cargo", "Supervisión"),
    "incobrables":        ("Incobrables concentrados", "Gerencia de cobranzas"),
    "cobro_sin_visita":   ("Cobro en efectivo sin visita", "Supervisión"),
    "nc_fuera_patron":    ("Nota de crédito fuera de patrón", "Administración"),
    "cambio_ruta":        ("Cambio de ruta con deuda", "Gerencia de cobranzas"),
}


def cargar():
    rd = lambda f, **k: pd.read_csv(os.path.join(DAT, f), **k)
    b = {k: rd(f"{k}.csv") for k in ["dim_sucursal", "dim_supervisor", "dim_reparto", "dim_cliente", "dim_medio_pago", "dim_equipo"]}
    for k in ["fact_venta", "fact_pago", "fact_movimiento", "fact_visita", "fact_gestion", "fact_equipo", "fact_abono", "fact_cambio_reparto"]:
        b[k] = rd(f"{k}.csv", parse_dates=["fecha"])
    com = set(b["dim_reparto"][b["dim_reparto"].tipo_reparto == "Comercial"].id_reparto)
    b["com"] = com
    # alcance: sin cuentas internas. El reparto actual puede no ser comercial (justamente lo que mira la regla de cambio de ruta)
    b["alcance"] = set(b["dim_cliente"][b["dim_cliente"].cuenta_interna == 0].id_cliente)
    return b


def saldo_a(b, fecha_por_cliente):
    """saldo de cada cliente al final del día indicado: {id_cliente: fecha} -> {id_cliente: saldo}"""
    V, P, M = b["fact_venta"], b["fact_pago"], b["fact_movimiento"]
    deb = pd.concat([V[["fecha", "id_cliente", "importe"]], M[M.tipo.isin(["Saldo inicial", "Reversa de pago"])][["fecha", "id_cliente", "importe"]]])
    cre = pd.concat([P[["fecha", "id_cliente", "importe"]], M[M.tipo.isin(["Nota de crédito", "Incobrable"])][["fecha", "id_cliente", "importe"]]])
    mov = pd.concat([deb, cre.assign(importe=-cre.importe)])
    mov = mov[mov.id_cliente.isin(fecha_por_cliente.keys())]
    lim = mov.id_cliente.map(fecha_por_cliente)
    return mov[mov.fecha <= lim].groupby("id_cliente").importe.sum().reindex(list(fecha_por_cliente.keys()), fill_value=0).to_dict()


def candidatos(b):
    C = {}
    cli = b["dim_cliente"].set_index("id_cliente")
    eq = b["dim_equipo"].set_index("id_equipo")
    fe = b["fact_equipo"]
    inst = fe[fe.tipo == "Instalación"].set_index("id_equipo")
    ret = fe[fe.tipo == "Retiro"].set_index("id_equipo").fecha
    activos = [e for e in inst.index if not (e in ret.index and ret[e] <= CORTE) and inst.loc[e, "fecha"] <= CORTE]
    V = b["fact_venta"]

    # A1 · abono: meses esperados (1° de cada mes posterior a la instalación) contra meses facturados
    ab = b["fact_abono"].assign(mes=lambda x: x.fecha.dt.to_period("M"))
    fact = ab.groupby("id_equipo").mes.apply(set).to_dict()
    meses = pd.period_range("2025-01", CORTE.to_period("M"), freq="M")
    rows = []
    for e in activos:
        if eq.loc[e, "modalidad"] != "Abono mensual":
            continue
        i = inst.loc[e, "fecha"]
        esperados = [m for m in meses if m.start_time > i]
        falt = [m for m in esperados if m not in fact.get(e, set())]
        if not esperados or esperados[-1] not in falt:
            continue
        k = len(esperados) - 1                                    # primer mes del tramo final sin facturar
        while k > 0 and esperados[k - 1] in falt:
            k -= 1
        rows.append([e, int(inst.loc[e, "id_cliente"]), eq.loc[e, "tipo_equipo"], i, int(eq.loc[e, "abono_mensual"]), len(falt), esperados[k].start_time])
    C["equipo_sin_abono"] = pd.DataFrame(rows, columns=["id_equipo", "id_cliente", "tipo_equipo", "instalacion", "abono", "meses_sin", "desde"])

    # A2 · comodato por consumo: días desde la última compra con cargo
    ult = V[V.importe > 0].groupby("id_cliente").fecha.max()
    rows = []
    for e in activos:
        if eq.loc[e, "modalidad"] != "Comodato por consumo":
            continue
        c, i = int(inst.loc[e, "id_cliente"]), inst.loc[e, "fecha"]
        u = ult.get(c, pd.NaT)
        base = u if pd.notna(u) and u >= i else i                 # si nunca compró desde la instalación, cuenta desde la instalación
        dias = (CORTE - base).days
        if dias >= 30 and (CORTE - i).days >= 30:
            rows.append([e, c, eq.loc[e, "tipo_equipo"], i, int(eq.loc[e, "valor_reposicion"]), base, dias])
    C["equipo_sin_consumo"] = pd.DataFrame(rows, columns=["id_equipo", "id_cliente", "tipo_equipo", "instalacion", "valor", "ult_compra", "dias_sin"])

    # A3 · entregas de los últimos 126 días de clientes con alguna entrega sin cargo en los últimos 42
    v = V[V.id_cliente.isin(b["alcance"]) & (V.fecha > CORTE - 126 * DIA)]
    ids = v[(v.fecha > CORTE - 42 * DIA) & (v.importe == 0)].id_cliente.unique()
    C["solo_sin_cargo"] = v[v.id_cliente.isin(ids)][["id_cliente", "fecha", "importe", "unidades_sin_cargo"]].sort_values(["id_cliente", "fecha"]).reset_index(drop=True)
    g = b["fact_gestion"]
    C["bonificaciones"] = g[g.tipo == "Bonificación autorizada"][["id_cliente", "fecha", "resultado"]].reset_index(drop=True)

    # A4 · incobrables del último año (con el reparto del movimiento) y venta por reparto para cada ventana posible
    M = b["fact_movimiento"]
    inc = M[(M.tipo == "Incobrable") & M.id_cliente.isin(b["alcance"]) & (M.fecha > CORTE - 365 * DIA) & M.id_reparto.isin(b["com"])].copy()
    post = V[V.importe > 0].groupby("id_cliente").fecha.apply(lambda s: s.values)
    inc["sigue_comprando"] = [int(any(f > r.fecha for f in post.get(r.id_cliente, []))) for r in inc.itertuples()]
    C["incobrables"] = inc[["fecha", "id_cliente", "id_reparto", "importe", "motivo", "sigue_comprando"]].sort_values("fecha").reset_index(drop=True)
    va = V[V.id_cliente.isin(b["alcance"]) & V.id_reparto.isin(b["com"])]
    C["venta_reparto"] = {w: va[va.fecha > CORTE - w * DIA].groupby("id_reparto").importe.sum().reindex(sorted(b["com"]), fill_value=0).to_dict() for w in (90, 180, 365)}

    # A5 · efectivo cobrado por el reparto en un día sin visita efectiva a ese cliente
    P, VI = b["fact_pago"], b["fact_visita"]
    pe = P[(P.canal == "Reparto") & (P.fecha > CORTE - 120 * DIA) & P.id_cliente.isin(b["alcance"])]
    vis = VI[VI.visito == 1]
    clave = set(zip(vis.id_cliente, vis.fecha))
    sin = pe[[(c, f) not in clave for c, f in zip(pe.id_cliente, pe.fecha)]].copy()
    vv = vis.groupby("id_cliente").fecha.apply(lambda s: np.sort(s.values))
    def dias_desde(c, f):
        arr = vv.get(c, np.array([], dtype="datetime64[ns]"))
        k = np.searchsorted(arr, np.datetime64(f), side="left")
        return -1 if k == 0 else int((np.datetime64(f) - arr[k - 1]) / np.timedelta64(1, "D"))
    sin["dias_desde_visita"] = [dias_desde(c, f) for c, f in zip(sin.id_cliente, sin.fecha)]
    C["cobro_sin_visita"] = sin[["fecha", "id_cliente", "id_reparto", "importe", "dias_desde_visita"]].sort_values("fecha").reset_index(drop=True)

    # A6 · notas de crédito de los últimos 180 días con la facturación mensual habitual y la primera revisión
    nc = M[(M.tipo == "Nota de crédito") & M.id_cliente.isin(b["alcance"]) & (M.fecha > CORTE - 180 * DIA)].copy()
    vt = V.groupby("id_cliente")
    def fac6(c, t):
        if c not in vt.groups:
            return 0
        s = vt.get_group(c)
        return round(s[(s.fecha > t - 181 * DIA) & (s.fecha <= t - DIA)].importe.sum() / 6)
    nc["fac6"] = [fac6(c, t) for c, t in zip(nc.id_cliente, nc.fecha)]
    nc = nc[nc.importe >= 20000]                                   # el piso más bajo que ofrece el tablero
    rv = g[g.tipo == "Revisión de nota de crédito"].sort_values("fecha")
    def revision(c, t):
        x = rv[(rv.id_cliente == c) & (rv.fecha >= t) & (rv.fecha <= t + 21 * DIA)]
        return x.resultado.iloc[0] if len(x) else ""
    nc["revision"] = [revision(c, t) for c, t in zip(nc.id_cliente, nc.fecha)]
    C["nc_fuera_patron"] = nc[["fecha", "id_cliente", "id_reparto", "importe", "fac6", "motivo", "revision"]].sort_values("fecha").reset_index(drop=True)

    # A7 · cambios de ruta con el saldo del cliente el día del cambio
    cr = b["fact_cambio_reparto"].copy()
    s = {}
    for r in cr.itertuples():
        s[(r.id_cliente, r.fecha)] = saldo_a(b, {r.id_cliente: r.fecha})[r.id_cliente]
    cr["saldo"] = [round(s[(c, f)]) for c, f in zip(cr.id_cliente, cr.fecha)]
    cr["destino_comercial"] = cr.reparto_destino.isin(b["com"]).astype(int)
    C["cambio_ruta"] = cr.sort_values("fecha").reset_index(drop=True)
    return C


def evaluar(C, p=PARAMS):
    """Devuelve las alertas: una fila por alerta con regla, clave, cliente, reparto, fecha en que se disparó e impacto en $."""
    out = []
    # A1
    for r in C["equipo_sin_abono"].itertuples():
        if r.instalacion <= CORTE - p["abono_tol"] * DIA:
            f = max(r.instalacion + p["abono_tol"] * DIA, r.desde)
            out.append(("equipo_sin_abono", r.id_equipo, r.id_cliente, None, f, r.abono * r.meses_sin))
    # A2
    for r in C["equipo_sin_consumo"].itertuples():
        if r.instalacion <= CORTE - p["consumo_antig"] * DIA and r.dias_sin > p["consumo_dias"]:
            out.append(("equipo_sin_consumo", r.id_equipo, r.id_cliente, None, r.ult_compra + (p["consumo_dias"] + 1) * DIA, r.valor))
    # A3
    W, H = p["sc_ventana"], p["sc_hist"]
    bon = C["bonificaciones"]
    for c, g in C["solo_sin_cargo"].groupby("id_cliente"):
        w = g[g.fecha > CORTE - W * DIA]
        h = g[(g.fecha <= CORTE - W * DIA) & (g.fecha > CORTE - (W + H) * DIA) & (g.importe > 0)]
        if len(w) >= p["sc_min"] and w.importe.sum() == 0 and w.unidades_sin_cargo.sum() > 0 and len(h) >= p["sc_hist_min"]:
            out.append(("solo_sin_cargo", str(c), int(c), None, w.fecha.iloc[p["sc_min"] - 1], round(h.importe.mean()) * len(w)))
    # A4
    inc = C["incobrables"]
    w = inc[inc.fecha > CORTE - p["inc_ventana"] * DIA]
    venta = C["venta_reparto"][p["inc_ventana"]]
    por = w.groupby("id_reparto").importe.agg(["count", "sum"])
    ratio = {r: (por["sum"].get(r, 0) / venta[r] if venta[r] > 0 else 0) for r in venta}
    med = sorted(ratio.values())[len(ratio) // 2]
    for r, x in por.iterrows():
        g = w[w.id_reparto == r]
        conc = x["count"] >= p["inc_min"] and ratio[r] > p["inc_veces"] * med
        sigue = g[g.sigue_comprando == 1]
        if conc or len(sigue) >= p["inc_sigue"]:
            f = min(g.fecha.iloc[p["inc_min"] - 1] if conc else pd.Timestamp.max, sigue.fecha.iloc[p["inc_sigue"] - 1] if len(sigue) >= p["inc_sigue"] else pd.Timestamp.max)
            out.append(("incobrables", r, 0, r, f, int(x["sum"])))
    # A5
    cs = C["cobro_sin_visita"]
    w = cs[cs.fecha > CORTE - p["csv_ventana"] * DIA]
    for r, g in w.groupby("id_reparto"):
        if len(g) >= p["csv_min"]:
            out.append(("cobro_sin_visita", r, 0, r, g.fecha.iloc[p["csv_min"] - 1], int(g.importe.sum())))
    # A6
    nc = C["nc_fuera_patron"]
    for r in nc.itertuples():
        if r.fecha > CORTE - p["nc_ventana"] * DIA and r.importe >= p["nc_piso"] and (r.fac6 <= 0 or r.importe > p["nc_veces"] * r.fac6):
            out.append(("nc_fuera_patron", f"{r.id_cliente}|{r.fecha:%Y-%m-%d}", int(r.id_cliente), None, r.fecha, int(r.importe)))
    # A7
    for r in C["cambio_ruta"].itertuples():
        if not r.destino_comercial and r.saldo >= p["ruta_piso"]:
            out.append(("cambio_ruta", str(r.id_cliente), int(r.id_cliente), r.reparto_origen, r.fecha, int(r.saldo)))
    A = pd.DataFrame(out, columns=["regla", "clave", "id_cliente", "id_reparto", "fecha", "impacto"])
    return A


def validar(A, C, truth):
    """Cuántos casos sembrados encuentra cada regla y cuántas alertas no estaban sembradas."""
    res = {}
    for regla in REGLAS:
        t = truth[truth.regla == regla]
        a = A[A.regla == regla]
        if regla == "cobro_sin_visita":                         # la alerta es por reparto; los casos son pagos
            w = C["cobro_sin_visita"]
            w = w[w.id_reparto.isin(a.clave)]
            w = w[w.fecha > CORTE - PARAMS["csv_ventana"] * DIA]
            casos = {f"{c}|{f:%Y-%m-%d}" for c, f in zip(w.id_cliente, w.fecha)}
            sem = {k for k in t.clave if pd.Timestamp(k.split("|")[1]) > CORTE - PARAMS["csv_ventana"] * DIA}
            res[regla] = dict(sembrados=len(sem), encontrados=len(sem & casos), alertas=len(a), sin_sembrar=len(casos - sem),
                              unidades=sorted(a.clave), nota="por pago, dentro de la ventana")
            continue
        claves = set(t.clave.astype(str))
        if regla == "incobrables":
            claves = set(t.clave)
        got = set(a.clave.astype(str))
        res[regla] = dict(sembrados=len(claves), encontrados=len(claves & got), alertas=len(got), sin_sembrar=len(got - claves))
    return res


if __name__ == "__main__":
    b = cargar()
    C = candidatos(b)
    A = evaluar(C)
    truth = pd.read_csv(os.path.join(DAT, "casos_sembrados.csv"), dtype={"clave": str})
    print(f"Alertas al {CORTE:%d/%m/%Y}: {len(A)} · impacto $ {A.impacto.sum():,.0f}".replace(",", "."))
    for regla, (nombre, resp) in REGLAS.items():
        a = A[A.regla == regla]
        print(f"  {nombre:<34} {len(a):>4} alertas · $ {a.impacto.sum():>14,.0f} · {resp}".replace(",", "."))
    print("\nValidación contra los casos sembrados (parámetros acordados):")
    for regla, r in validar(A, C, truth).items():
        extra = f" · unidades {r['unidades']}" if "unidades" in r else ""
        print(f"  {regla:<20} encontró {r['encontrados']} de {r['sembrados']} · alertas {r['alertas']} · no sembradas {r['sin_sembrar']}{extra}")
