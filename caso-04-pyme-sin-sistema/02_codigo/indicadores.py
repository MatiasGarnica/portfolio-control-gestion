"""Caso 04 · las cuentas del tablero en Python (mismas que las vistas de supabase/02_vistas.sql y que app.js).

Uso:  python indicadores.py   → imprime el resumen del corte
"""
import os
import numpy as np
import pandas as pd

D = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.normpath(os.path.join(D, "..", "01_datos", "base"))
CORTE = pd.Timestamp("2025-10-09")
FORM = pd.Timestamp("2025-06-01")
COMISION = {"debito": 0.015, "credito": 0.035, "billetera": 0.008}
TOL = 500                                                    # diferencia de caja que se considera «cuadra»
MED = ["efectivo", "debito", "credito", "billetera", "transferencia"]
VENTANA, MENOS, PAGA = 42, 0.7, 0.7                                    # compra menos seguido (6 semanas) · paga menos del 70% de lo que compra (90 días)


def cargar():
    c = pd.read_csv(os.path.join(BASE, "cierres_caja.csv"), parse_dates=["fecha"])
    v = pd.read_csv(os.path.join(BASE, "ventas_mayoristas.csv"), parse_dates=["fecha"])
    p = pd.read_csv(os.path.join(BASE, "cobros_mayoristas.csv"), parse_dates=["fecha"])
    cl = pd.read_csv(os.path.join(BASE, "clientes_mayoristas.csv"), parse_dates=["alta"])
    v["id"] = range(1, len(v) + 1)
    return c, v, p, cl


def cierre_diario(c):
    x = c.copy()
    x["venta_total"] = x.efectivo.fillna(0) + x.debito + x.credito + x.billetera + x.transferencia
    x["efectivo_esperado"] = x.fondo + x.efectivo - x.gasto - x.retiro
    x["diferencia"] = x.efectivo_contado - x.efectivo_esperado
    x["estado_caja"] = np.where(x.efectivo_contado.isna(), None, np.where(x.diferencia.abs() <= TOL, "Cuadra", np.where(x.diferencia < 0, "Faltante", "Sobrante")))
    return x


def faltantes(c):
    dias = [d for d in pd.date_range(FORM, CORTE) if d.dayofweek != 0]
    hay = set(zip(c.fecha, c.local))
    return [(d, l) for d in dias for l in ("Centro", "Jardín") if (d, l) not in hay]


def responsables(c):
    x = cierre_diario(c)
    x = x[x.fuente == "Formulario"]
    g = x.groupby(["responsable", "local"])
    return pd.DataFrame({"cierres": g.size(), "cuadran": g.estado_caja.apply(lambda s: (s == "Cuadra").sum()),
                         "faltantes": g.estado_caja.apply(lambda s: (s == "Faltante").sum()),
                         "faltante_total": g.diferencia.apply(lambda s: s[s < -TOL].sum()),
                         "sobrante_total": g.diferencia.apply(lambda s: s[s > TOL].sum())}).reset_index()


def saldo_mayoristas(v, p):
    """saldo del fiado, compra más vieja sin pagar y cuánto pagó de lo que compró en los últimos 90 días («paga menos de lo que compra» < 70%)"""
    cc = v[v.condicion == "Cuenta corriente"].sort_values(["id_cliente", "fecha", "id"])
    d90 = CORTE - pd.Timedelta(days=90)
    out = []
    for c, g in cc.groupby("id_cliente"):
        pc = p[p.id_cliente == c]
        cob = pc.importe.sum()
        acum = g.importe.cumsum()
        desde = g.fecha[acum > cob].min()
        out.append([c, int(g.importe.sum() - cob), desde, int(g[g.fecha > d90].importe.sum()), int(pc[pc.fecha > d90].importe.sum())])
    x = pd.DataFrame(out, columns=["id_cliente", "saldo", "deuda_desde", "vendido_90", "cobrado_90"])
    x["paga_menos"] = (x.vendido_90 > 0) & (x.cobrado_90 < PAGA * x.vendido_90)
    return x


def estado_clientes(v, cl):
    out = []
    for c in cl.itertuples():
        f = np.sort(v[v.id_cliente == c.id_cliente].fecha.unique())
        if not len(f):
            continue
        f = pd.to_datetime(f)
        inter = [(b - a).days for a, b in zip(f[:-1], f[1:]) if b > CORTE - pd.Timedelta(days=180)]
        r = float(np.median(inter)) if len(inter) >= 2 else None
        ult, pri = f.max(), f.min()
        dias = (CORTE - ult).days
        ri = r if r is not None else 7
        n6 = int(((f > CORTE - pd.Timedelta(days=VENTANA)) & (f <= CORTE)).sum())     # compras en las últimas 6 semanas
        esperadas = VENTANA / ri
        est = ("Nuevo" if pri > CORTE - pd.Timedelta(days=90) else "Dejó de comprar" if dias > max(4 * ri, 30) else "En riesgo" if dias > max(2 * ri, 10)
               else "Compra menos seguido" if r is not None and n6 < MENOS * esperadas else "Activo")
        out.append([c.id_cliente, c.nombre, ult, r, dias, n6, est])
    return pd.DataFrame(out, columns=["id_cliente", "nombre", "ultima", "intervalo", "dias_sin_comprar", "compras_6sem", "estado"])


if __name__ == "__main__":
    c, v, p, cl = cargar()
    x = cierre_diario(c)
    f = x[x.fuente == "Formulario"]
    print(f"Cierres con formulario: {len(f)} · cuadran {(f.estado_caja == 'Cuadra').mean():.1%} · faltantes $ {f.diferencia[f.diferencia < -TOL].sum():,.0f}".replace(",", "."))
    print("Cierres sin cargar:", [(d.strftime("%d/%m"), l) for d, l in faltantes(c)])
    print(responsables(c).to_string(index=False))
    s = saldo_mayoristas(v, p).merge(cl[["id_cliente", "nombre"]])
    print(s.sort_values("saldo", ascending=False).head(6).to_string(index=False))
    e = estado_clientes(v, cl)
    print(e.estado.value_counts().to_dict())
    print(e[e.estado != "Activo"].to_string(index=False))
