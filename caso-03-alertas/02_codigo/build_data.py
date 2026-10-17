"""Caso 03 · arma ../01_datos/dashboard_data.json: los candidatos de cada regla (el tablero aplica los parámetros en vivo)
y la ficha de cada cliente que aparece en alguna regla."""
import os, json
import numpy as np
import pandas as pd
from alertas import cargar, candidatos, evaluar, PARAMS, REGLAS, CORTE, DIA, DAT

b = cargar()
C = candidatos(b)
A = evaluar(C)
cli = b["dim_cliente"].set_index("id_cliente")
rep = b["dim_reparto"]
V, P, M, VI, GE = b["fact_venta"], b["fact_pago"], b["fact_movimiento"], b["fact_visita"], b["fact_gestion"]
d = lambda x: None if pd.isna(x) else pd.Timestamp(x).strftime("%Y-%m-%d")

# ---------------------------------------------------------------- candidatos
cand = {
    "equipo_sin_abono": [[r.id_equipo, int(r.id_cliente), r.tipo_equipo, d(r.instalacion), int(r.abono), int(r.meses_sin), d(r.desde)]
                         for r in C["equipo_sin_abono"].itertuples()],
    "equipo_sin_consumo": [[r.id_equipo, int(r.id_cliente), r.tipo_equipo, d(r.instalacion), int(r.valor), d(r.ult_compra), int(r.dias_sin)]
                           for r in C["equipo_sin_consumo"].itertuples()],
    "solo_sin_cargo": {str(c): [[d(x.fecha), int(x.importe), int(x.unidades_sin_cargo)] for x in g.itertuples()]
                       for c, g in C["solo_sin_cargo"].groupby("id_cliente")},
    "bonificaciones": [[int(r.id_cliente), d(r.fecha), r.resultado] for r in C["bonificaciones"].itertuples()],
    "incobrables": [[d(r.fecha), int(r.id_cliente), r.id_reparto, int(r.importe), r.motivo, int(r.sigue_comprando)] for r in C["incobrables"].itertuples()],
    "venta_reparto": {str(w): {k: int(v) for k, v in x.items()} for w, x in C["venta_reparto"].items()},
    "cobro_sin_visita": [[d(r.fecha), int(r.id_cliente), r.id_reparto, int(r.importe), int(r.dias_desde_visita)] for r in C["cobro_sin_visita"].itertuples()],
    "nc_fuera_patron": [[d(r.fecha), int(r.id_cliente), r.id_reparto, int(r.importe), int(r.fac6), r.motivo, r.revision] for r in C["nc_fuera_patron"].itertuples()],
}
# A7: además, cuántos días calle le «sacó» el cambio al reparto de origen (saldo ÷ venta diaria del reparto en ese mes)
va = V[V.id_cliente.isin(b["alcance"])].assign(mes=lambda x: x.fecha.dt.to_period("M"))
vm = va.groupby(["id_reparto", "mes"]).importe.sum()
cal = pd.date_range("2025-01-01", CORTE, freq="D")
dias_mes = pd.Series(cal.dayofweek < 6, index=cal).groupby(cal.to_period("M")).sum()
rows = []
for r in C["cambio_ruta"].itertuples():
    m = r.fecha.to_period("M")
    venta = vm.get((r.reparto_origen, m), 0)
    efecto = round(r.saldo / (venta / dias_mes[m]), 2) if venta > 0 and r.saldo > 0 else 0
    rows.append([d(r.fecha), int(r.id_cliente), r.reparto_origen, r.reparto_destino, r.motivo, int(r.saldo), int(r.destino_comercial), efecto])
cand["cambio_ruta"] = rows

# ---------------------------------------------------------------- clientes que aparecen en alguna regla y su ficha
ids = set(C["equipo_sin_abono"].id_cliente) | set(C["equipo_sin_consumo"].id_cliente) | set(C["solo_sin_cargo"].id_cliente) \
    | set(C["incobrables"].id_cliente) | set(C["cobro_sin_visita"].id_cliente) | set(C["nc_fuera_patron"].id_cliente) | set(C["cambio_ruta"].id_cliente)
ids = sorted(int(i) for i in ids)
LUNES = pd.date_range("2025-01-06", CORTE, freq="W-MON")
inst = b["fact_equipo"]
deq = b["dim_equipo"].set_index("id_equipo")
ab = b["fact_abono"]
cr = b["fact_cambio_reparto"]
ficha = {}
Vg, Pg, Mg, VIg, Gg = (x.groupby("id_cliente") for x in (V, P, M, VI, GE))
gx = lambda g, c: g.get_group(c) if c in g.groups else None
for c in ids:
    v, p, m, vi, g = (gx(x, c) for x in (Vg, Pg, Mg, VIg, Gg))
    E = lambda x: x if x is not None else pd.DataFrame(columns=["fecha", "importe", "unidades_sin_cargo", "visito", "tipo"])
    v, p, m, vi = E(v), E(p), E(m), E(vi)
    deb = v.importe.sum() + m[m.tipo.isin(["Saldo inicial", "Reversa de pago"])].importe.sum()
    cre = p.importe.sum() + m[m.tipo.isin(["Nota de crédito", "Incobrable"])].importe.sum()
    wk = lambda df, col, cond=None: [int(x) for x in (df[cond(df)] if cond else df).assign(k=lambda z: (z.fecha - LUNES[0]).dt.days // 7)
                                     .groupby("k")[col].sum().reindex(range(len(LUNES)), fill_value=0).values] if len(df) else [0] * len(LUNES)
    movs = [[d(x.fecha), "Venta" if x.importe > 0 else "Entrega sin cargo", int(x.importe), f"{int(x.unidades_sin_cargo)} sin cargo" if x.unidades_sin_cargo else ""] for x in v.itertuples()] \
        + [[d(x.fecha), "Pago", int(x.importe), f"{x.medio} · {x.canal}"] for x in p.itertuples()] \
        + [[d(x.fecha), x.tipo, int(x.importe), x.motivo] for x in m[m.tipo != "Saldo inicial"].itertuples()]
    movs.sort(key=lambda x: x[0], reverse=True)
    eqs = []
    for e in inst[(inst.id_cliente == c) & (inst.tipo == "Instalación")].id_equipo:
        rr = inst[(inst.id_equipo == e) & (inst.tipo == "Retiro")]
        a = ab[ab.id_equipo == e]
        eqs.append([e, deq.loc[e, "tipo_equipo"], deq.loc[e, "modalidad"], d(inst[(inst.id_equipo == e) & (inst.tipo == "Instalación")].fecha.iat[0]),
                    d(rr.fecha.iat[0]) if len(rr) else None, int(len(a)), d(a.fecha.max()) if len(a) else None, int(deq.loc[e, "valor_reposicion"]), int(deq.loc[e, "abono_mensual"])])
    vis_ef = vi[vi.visito == 1].fecha.max() if len(vi) else pd.NaT
    ficha[str(c)] = {
        "saldo": int(round(deb - cre)),
        "ult": [d(v[v.importe > 0].fecha.max()) if len(v) else None, d(p.fecha.max()) if len(p) else None, d(vis_ef)],
        "sv": wk(v, "importe"), "ssc": wk(v, "unidades_sin_cargo"), "sp": wk(p, "importe"),
        "snc": wk(m, "importe", lambda z: z.tipo.isin(["Nota de crédito", "Incobrable"])),
        "svi": wk(vi, "visito"), "svp": [int(x) for x in (vi.assign(k=lambda z: (z.fecha - LUNES[0]).dt.days // 7).groupby("k").size().reindex(range(len(LUNES)), fill_value=0).values)] if len(vi) else [0] * len(LUNES),
        "mv": movs[:12],
        "eq": eqs,
        "cr": [[d(x.fecha), x.reparto_origen, x.reparto_destino, x.motivo] for x in cr[cr.id_cliente == c].itertuples()],
        "g": [[d(x.fecha), x.area, x.tipo, x.resultado] for x in (g.sort_values("fecha").tail(6).itertuples() if g is not None else [])][::-1],
    }
inc_cli = set(M[M.tipo == "Incobrable"].id_cliente)
out = {
    "meta": {"empresa": "Reparto Federal S.A.", "corte": d(CORTE), "hora": "06:00", "params": PARAMS, "lunes0": d(LUNES[0]), "semanas": len(LUNES),
             "reglas": [[k, v[0], v[1]] for k, v in REGLAS.items()]},
    "suc": b["dim_sucursal"][["id_sucursal", "sucursal"]].values.tolist(),
    "sup": b["dim_supervisor"][["id_supervisor", "supervisor", "id_sucursal"]].values.tolist(),
    "rep": [[r.id_reparto, r.reparto, r.id_supervisor if isinstance(r.id_supervisor, str) else None, r.id_sucursal, r.tipo_reparto] for r in rep.itertuples()],
    "cli": [[c, cli.loc[c, "nombre"], cli.loc[c, "tipo_cliente"], cli.loc[c, "id_reparto"], cli.loc[c, "condicion"], cli.loc[c, "medio_habitual"],
             int(c in inc_cli)] for c in ids],
    "cand": cand,
    "ficha": ficha,
}
path = os.path.join(DAT, "dashboard_data.json")
with open(path, "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
print(f"ok · {len(ids)} clientes con ficha · {len(A)} alertas con los parámetros acordados · {os.path.getsize(path) // 1024} KB")
