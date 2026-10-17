"""Caso 04 · corre el esquema y las vistas de Supabase (PostgreSQL) en DuckDB, con sqlglot, y las compara con indicadores.py.
Las sentencias de seguridad (RLS y políticas) son propias de Supabase y se saltean acá.
Uso: pip install duckdb sqlglot && python verificar_vistas.py"""
import os, re
import duckdb, sqlglot
import pandas as pd
import indicadores as I

SQL = os.path.join(I.D, "supabase")
import logging
logging.getLogger("sqlglot").setLevel(logging.ERROR)
con = duckdb.connect()
con.execute("CREATE SEQUENCE seq_id")
def correr(path):
    txt = open(path, encoding="utf-8").read()
    # DuckDB no tiene identity: se reemplaza por una secuencia (mismo orden de carga)
    txt = txt.replace("bigint generated always as identity primary key", "bigint primary key default nextval('seq_id')")
    for st in sqlglot.parse(txt, read="postgres"):
        s = st.sql(dialect="postgres")
        if re.search(r"(?i)(ENABLE ROW LEVEL SECURITY|CREATE POLICY)", s):
            continue
        con.execute(sqlglot.transpile(s, read="postgres", write="duckdb")[0])
correr(os.path.join(SQL, "01_esquema.sql"))
B = I.BASE
con.execute(f"INSERT INTO cierres_caja BY NAME SELECT * FROM read_csv('{B}/cierres_caja.csv', header=true)")
con.execute(f"INSERT INTO clientes_mayoristas BY NAME SELECT * FROM read_csv('{B}/clientes_mayoristas.csv', header=true)")
con.execute(f"INSERT INTO ventas_mayoristas (fecha, id_cliente, importe, condicion, fuente) SELECT fecha, id_cliente, importe, condicion, fuente FROM read_csv('{B}/ventas_mayoristas.csv', header=true)")
con.execute(f"INSERT INTO cobros_mayoristas (fecha, id_cliente, importe, medio, fuente) SELECT fecha, id_cliente, importe, medio, fuente FROM read_csv('{B}/cobros_mayoristas.csv', header=true)")
correr(os.path.join(SQL, "02_vistas.sql"))
print("esquema, carga y vistas ok")

c, v, p, cl = I.cargar()
ok = True
def chk(nombre, a, b):
    global ok
    ok &= a == b
    print(f"{nombre:<22} {'igual' if a == b else 'DISTINTO'}")
    if a != b:
        print("   ", sorted(set(a) ^ set(b))[:4] if isinstance(a, set) else (a, b))

q = lambda s: con.execute(s).df()
x = I.cierre_diario(c)
d = q("select fecha, local, diferencia, estado_caja from v_cierre_diario where efectivo_contado is not null")
chk("v_cierre_diario", {(r.fecha.strftime('%F'), r.local, int(r.diferencia), r.estado_caja) for r in d.itertuples()},
    {(r.fecha.strftime('%F'), r.local, int(r.diferencia), r.estado_caja) for r in x[x.efectivo_contado.notna()].itertuples()})
chk("v_cierres_faltantes", {(pd.Timestamp(r.fecha).strftime('%F'), r.local) for r in q("select * from v_cierres_faltantes").itertuples()},
    {(f.strftime('%F'), l) for f, l in I.faltantes(c)})
r1 = q("select * from v_responsables")
r2 = I.responsables(c)
chk("v_responsables", {(r.responsable, int(r.cierres), int(r.cuadran), int(r.faltantes), int(r.faltante_total), int(r.sobrante_total)) for r in r1.itertuples()},
    {(r.responsable, int(r.cierres), int(r.cuadran), int(r.faltantes), int(r.faltante_total), int(r.sobrante_total)) for r in r2.itertuples()})
m = q("select mes, sum(venta_total) as v, sum(costo_medios) as k from v_ventas_mes group by mes")
mm = x.assign(mes=x.fecha.dt.strftime("%Y-%m")).groupby("mes").venta_total.sum()
chk("v_ventas_mes", {(r.mes, int(r.v)) for r in m.itertuples()}, {(k, int(val)) for k, val in mm.items()})
s1 = q("select * from v_saldo_mayoristas")
s2 = I.saldo_mayoristas(v, p)
chk("v_saldo_mayoristas", {(int(r.id_cliente), int(r.saldo), str(pd.Timestamp(r.deuda_desde).date()) if pd.notna(r.deuda_desde) else None, int(r.cobrado_90), bool(r.paga_menos)) for r in s1.itertuples()},
    {(int(r.id_cliente), int(r.saldo), str(r.deuda_desde.date()) if pd.notna(r.deuda_desde) else None, int(r.cobrado_90), bool(r.paga_menos)) for r in s2.itertuples()})
e1 = q("select id_cliente, estado, dias_sin_comprar from v_estado_clientes")
e2 = I.estado_clientes(v, cl)
chk("v_estado_clientes", {(int(r.id_cliente), r.estado, int(r.dias_sin_comprar)) for r in e1.itertuples()}, {(int(r.id_cliente), r.estado, int(r.dias_sin_comprar)) for r in e2.itertuples()})
print("TODO OK" if ok else "REVISAR")
