"""Verifica los SQL del Caso 02: traduce el T-SQL a DuckDB con sqlglot, lo corre sobre los CSV y lo compara con Python (hoja.py y el tablero).
Uso: pip install duckdb sqlglot && python verificar_sql.py"""
import sys, os, json, re
import duckdb, sqlglot
import numpy as np, pandas as pd
BASE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, BASE + "/02_codigo")
from hoja import armar, cargar
DAT, SQL = BASE + "/01_datos", BASE + "/sql"
tr = lambda s: sqlglot.transpile(s, read="tsql", write="duckdb")
con = duckdb.connect()
for st in tr(open(f"{SQL}/01_esquema.sql", encoding="utf-8").read()):
    con.execute(st)
for t in ["dim_sucursal", "dim_supervisor", "dim_reparto", "dim_cliente", "dim_medio_pago", "fact_venta", "fact_pago", "fact_movimiento", "fact_visita", "fact_gestion"]:
    con.execute(f"INSERT INTO {t} SELECT * FROM read_csv('{DAT}/{t}.csv', header=true, nullstr='')")
print("esquema ok ·", con.execute("select count(*) from dim_calendario").fetchone()[0], "días en el calendario")

data = cargar()
ids = [c[0] for c in data["cli"]]
q2 = open(f"{SQL}/02_hoja_semanal.sql", encoding="utf-8").read()
ok_all = True
for w, s in enumerate(data["meta"]["semanas"]):
    q = q2.replace("CAST('2025-10-06' AS DATE) AS lunes", f"CAST('{s['lunes']}' AS DATE) AS lunes")
    (st,) = tr(q)
    df = con.execute(st).df()
    foco, est, nueva, _ = armar(data, w)
    py = {(ids[i], int(foco[i]), int(est[i])) for i in range(len(ids)) if foco[i] >= 0}
    sq = {(int(r.id_cliente), int(r.foco), int(r.estado)) for r in df[df.foco.notna()].itertuples()}
    pyn = {ids[i] for i in range(len(ids)) if nueva[i]}
    sqn = set(df[df.nueva == 1].id_cliente.astype(int))
    ok = py == sq and pyn == sqn
    ok_all &= ok
    print(f"Sem {s['sem']}: hoja SQL {len(sq)} · Python {len(py)} · nuevas {len(sqn)}/{len(pyn)} · {'igual' if ok else 'DISTINTO'}")
    if not ok:
        print("  solo SQL", sorted(sq - py)[:8], "solo Py", sorted(py - sq)[:8], "nuevas dif", sorted(sqn ^ pyn)[:8])

(st,) = tr(open(f"{SQL}/03_dias_calle.sql", encoding="utf-8").read())
dc = con.execute(st).df()
ref = {(d["r"], m): d["m"][k] for d in data["dc"] for k, m in enumerate(data["meta"]["meses"])}
bad = 0
for r in dc.itertuples():
    a = ref[(r.id_reparto, r.mes)]
    if abs(r.venta - a[0]) > 1 or abs(r.deuda_cierre - a[1]) > 1 or abs(r.cobrado - sum(a[2])) > 1 or abs(r.nc - a[3]) > 1 or abs(r.incobrables - a[4]) > 1 \
       or r.dias_reparto != data["meta"]["dias_reparto"][r.mes]:
        bad += 1
        if bad < 4: print("  dif", r, a)
print(f"Días calle: {len(dc)} filas reparto-mes · diferencias {bad}")
sep = dc[dc.mes == "2025-09"]
print(f"  septiembre empresa: {sep.deuda_cierre.sum() / (sep.venta.sum() / 26):.2f} días calle")

stm = tr(open(f"{SQL}/04_control_nc.sql", encoding="utf-8").read())
casos = con.execute(stm[0]).df()
js = [n for n in data["nc"] if n[3] >= 50000 and (n[4] <= 0 or n[3] > 2 * n[4])]
a = {(n[0], n[1], int(n[3]), n[6] or "Sin revisar") for n in js}
b = {(r.fecha.strftime("%Y-%m-%d"), int(r.id_cliente), int(r.importe), r.revision) for r in casos.itertuples()}
print(f"Control NC: SQL {len(b)} casos · tablero {len(a)} · {'igual' if a == b else 'DISTINTO'}")
if a != b: print("  ", sorted(a - b)[:5], sorted(b - a)[:5])
pat = con.execute(stm[1]).df()
print("Patrón:", list(pat[pat.estado == "Patrón"].id_reparto), "mediana", round(float(pat.mediana.iloc[0]), 4))
print("TODO OK" if ok_all and bad == 0 and a == b else "REVISAR")
