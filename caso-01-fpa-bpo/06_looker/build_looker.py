"""Arma el Excel para Looker Studio: dos tablas planas (resultado y drivers) listas para subir a Google Sheets.

Uso: python build_looker.py  →  AAAA-MM-DD_Looker_CobranzasDelSur_datos.xlsx
Looker Studio trabaja mejor con tablas planas (sin relaciones): cada fila trae ya el escenario, el mes, la cartera y la cuenta.
"""
import os, datetime
import pandas as pd

D = os.path.dirname(os.path.abspath(__file__)); SRC = os.path.join(D, "..", "01_datos")
ESC = {"REAL": "Real", "PPTO": "Presupuesto", "FCST": "Forecast"}
car = pd.read_csv(os.path.join(SRC, "dim_cartera.csv"))
car = pd.concat([car, pd.DataFrame([dict(code="EST", nombre="Estructura", industria="Estructura", negocio="Estructura", moneda="ARS")])], ignore_index=True)
car["Cartera"] = car.code + " · " + car.nombre

def base(df):
    df = df.copy()
    df["Escenario"] = df.esc.map(ESC)
    df["Mes"] = pd.to_datetime(df.mes + "-01")
    df["Anio"] = df.Mes.dt.year; df["Mes_num"] = df.Mes.dt.month
    return df.merge(car[["code", "Cartera", "industria", "moneda"]].rename(columns={"code": "cartera", "industria": "Industria", "moneda": "Moneda"}), on="cartera", how="left")

r = base(pd.read_csv(os.path.join(SRC, "fact_resultado.csv"), keep_default_na=False))
res = r.rename(columns={"cartera": "Codigo", "n1": "Rubro", "n2": "Subrubro", "item": "Item", "tipo": "Tipo", "importe_ars": "Importe_ARS", "importe_usd": "Importe_USD"})[
    ["Escenario", "Mes", "Anio", "Mes_num", "Codigo", "Cartera", "Industria", "Moneda", "Rubro", "Subrubro", "Item", "Tipo", "Importe_ARS", "Importe_USD"]]

d = base(pd.read_csv(os.path.join(SRC, "fact_drivers_cartera.csv")))
d["Recuperado"] = d.deuda * d.E; d["Base_fee"] = d.deuda * d.E * d.FX; d["Posiciones"] = d.ops + d.py; d["Horas"] = d.Posiciones * 132
drv = d.rename(columns={"cartera": "Codigo", "deuda": "Deuda_asignada", "ingreso": "Ingreso", "minutos": "Minutos", "sms": "SMS", "mails": "Mails", "pagos": "Pagos"})[
    ["Escenario", "Mes", "Anio", "Mes_num", "Codigo", "Cartera", "Industria", "Moneda", "Deuda_asignada", "Recuperado", "Base_fee", "Ingreso", "Posiciones", "Horas", "Minutos", "SMS", "Mails", "Pagos"]]
for c in ["Deuda_asignada", "Recuperado", "Base_fee", "Ingreso", "Minutos", "SMS", "Mails", "Pagos"]: drv[c] = drv[c].round(2)

out = os.path.join(D, f"{datetime.date.today().isoformat()}_Looker_CobranzasDelSur_datos.xlsx")
with pd.ExcelWriter(out, engine="openpyxl", datetime_format="yyyy-mm-dd", date_format="yyyy-mm-dd") as xw:
    res.to_excel(xw, sheet_name="resultado", index=False)
    drv.to_excel(xw, sheet_name="drivers", index=False)
    pd.DataFrame({"Hoja": ["resultado", "drivers"], "Qué tiene": [
        "Estado de resultados por escenario (Real, Presupuesto, Forecast), mes, cartera y cuenta. Importes en pesos y en dólares; costos en negativo.",
        "Drivers por escenario, mes y cartera: deuda asignada, recuperado, base del fee, ingreso, posiciones y horas."]}).to_excel(xw, sheet_name="leeme", index=False)
from openpyxl import load_workbook
wb = load_workbook(out)
for ws in wb.worksheets:
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = min(42, max(10, max(len(str(c.value or "")) for c in col[:200]) + 2))
    ws.freeze_panes = "A2"
wb.save(out)
print("ok", os.path.basename(out), len(res), "filas resultado,", len(drv), "filas drivers")
