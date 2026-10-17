"""Caso 04 · arma ../01_datos/dashboard_data.json con la base unificada (Excel limpio + formulario).
El tablero hace las cuentas en el navegador con los mismos criterios que indicadores.py y las vistas de Supabase."""
import os, json
import pandas as pd
import indicadores as I

c, v, p, cl = I.cargar()
P = pd.read_csv(os.path.join(I.BASE, "problemas_excel.csv"))
res = dict(l.strip().split("=") for l in open(os.path.join(I.BASE, "resumen_limpieza.txt"), encoding="utf-8") if "=" in l)
d = lambda x: None if pd.isna(x) else pd.Timestamp(x).strftime("%Y-%m-%d")
nz = lambda x: None if pd.isna(x) else int(x)
ejemplos = (P[P.problema.isin(["Monto como texto", "Fecha como texto", "Local escrito distinto", "Cliente escrito distinto", "Monto ilegible", "Saldo mal arrastrado"])]
            .groupby("problema").head(3)[["problema", "detalle", "que_se_hizo"]].values.tolist())
out = {
    "meta": {"empresa": "Pastas Don Aldo", "corte": d(I.CORTE), "form_desde": d(I.FORM), "tol": I.TOL, "comision": I.COMISION},
    "cierres": [[d(r.fecha), r.local, r.responsable if isinstance(r.responsable, str) else None, nz(r.efectivo), int(r.debito), int(r.credito), int(r.billetera),
                 int(r.transferencia), nz(r.tickets), int(r.gasto), r.concepto_gasto if isinstance(r.concepto_gasto, str) else "", int(r.retiro), nz(r.fondo),
                 nz(r.efectivo_contado), r.fuente, bool(r.incompleta), r.cargado[11:16] if isinstance(r.cargado, str) else None] for r in c.itertuples()],
    "clientes": [[int(r.id_cliente), r.nombre, r.condicion] for r in cl.itertuples()],
    "ventas": [[d(r.fecha), int(r.id_cliente), int(r.importe), r.condicion, r.fuente] for r in v.itertuples()],
    "cobros": [[d(r.fecha), int(r.id_cliente), int(r.importe), r.medio, r.fuente] for r in p.itertuples()],
    "limpieza": {"tipos": P.groupby("problema").size().sort_values(ascending=False).reset_index().values.tolist(),
                 "ejemplos": ejemplos, **{k: float(x) for k, x in res.items()}},
}
path = os.path.join(I.D, "..", "01_datos", "dashboard_data.json")
with open(path, "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
print("ok ·", os.path.getsize(path) // 1024, "KB")
