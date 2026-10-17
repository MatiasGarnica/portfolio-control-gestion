"""Verifica los SQL del Caso 03: traduce el T-SQL a DuckDB con sqlglot, lo corre sobre los CSV y compara cada alerta
(regla, clave, fecha e impacto) con el motor en Python (02_codigo/alertas.py).
Uso: pip install duckdb sqlglot && python verificar_sql.py"""
import os, sys
import duckdb, sqlglot
import pandas as pd

BASE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
C02 = os.path.join(BASE, "..", "caso-02-cuenta-corriente", "sql", "01_esquema.sql")
sys.path.insert(0, os.path.join(BASE, "02_codigo"))
from alertas import cargar, candidatos, evaluar, REGLAS

DAT, SQL = os.path.join(BASE, "01_datos"), os.path.join(BASE, "sql")
tr = lambda s: sqlglot.transpile(s, read="tsql", write="duckdb")
con = duckdb.connect()
for f in (C02, os.path.join(SQL, "01_esquema_adicional.sql")):
    for st in tr(open(f, encoding="utf-8").read()):
        con.execute(st)
orden = ["dim_sucursal", "dim_supervisor", "dim_reparto", "dim_cliente", "dim_medio_pago", "dim_equipo", "fact_venta", "fact_pago",
         "fact_movimiento", "fact_visita", "fact_gestion", "fact_equipo", "fact_abono", "fact_cambio_reparto"]
for t in orden:
    con.execute(f"INSERT INTO {t} BY NAME SELECT * FROM read_csv('{DAT}/{t}.csv', header=true, nullstr='')")
print("esquema y datos ok")

sql = pd.concat([con.execute(st).df() for st in tr(open(os.path.join(SQL, "02_alertas.sql"), encoding="utf-8").read())], ignore_index=True)
sql["fecha"] = pd.to_datetime(sql.fecha).dt.normalize()
py = evaluar(candidatos(cargar()))
todo_ok = True
for regla, (nombre, _) in REGLAS.items():
    a = py[py.regla == regla].set_index("clave")
    b = sql[sql.regla == regla].set_index("clave")
    mismas = set(a.index) == set(b.index)
    dif_f = [k for k in a.index if k in b.index and a.loc[k, "fecha"] != b.loc[k, "fecha"]]
    dif_i = [k for k in a.index if k in b.index and abs(float(a.loc[k, "impacto"]) - float(b.loc[k, "impacto"])) > 10]
    ok = mismas and not dif_f and not dif_i
    todo_ok &= ok
    print(f"{nombre:<34} Python {len(a):>3} · SQL {len(b):>3} · {'igual' if ok else 'DISTINTO'}")
    if not ok:
        print("   solo Python", sorted(set(a.index) - set(b.index))[:5], "solo SQL", sorted(set(b.index) - set(a.index))[:5],
              "fecha", dif_f[:3], "impacto", dif_i[:3])
print("TODO OK" if todo_ok else "REVISAR")
