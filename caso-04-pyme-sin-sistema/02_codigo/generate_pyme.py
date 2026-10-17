"""Caso 04 · Pastas Don Aldo (ficticia): fábrica de pastas frescas con dos locales y venta a restaurantes.

Uso:  python generate_pyme.py   (semilla fija)

Escribe:
  ../01_datos/verdad/*.csv                         lo que pasó de verdad (solo para comprobar la limpieza; el tablero no lo lee)
  ../01_datos/excel_original/Caja 2025.xlsx        el Excel que llevaban de enero a mayo, con los problemas de siempre
  ../01_datos/formulario/*.csv                     las respuestas del formulario desde junio (como salen de Google Sheets)

Historia: hasta mayo, la caja y el fiado de los restaurantes se anotaban en un Excel compartido. Desde el 1 de junio,
cada local carga el cierre de caja en un formulario desde el celular, y los pedidos mayoristas se cargan en otro.
"""
import os
import numpy as np
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

RNG = np.random.default_rng(20251011)
D = os.path.dirname(os.path.abspath(__file__))
DAT = os.path.normpath(os.path.join(D, "..", "01_datos"))
for sub in ("verdad", "excel_original", "formulario"):
    os.makedirs(os.path.join(DAT, sub), exist_ok=True)
INICIO, CORTE, FORM = pd.Timestamp("2025-01-02"), pd.Timestamp("2025-10-09"), pd.Timestamp("2025-06-01")
MEDIOS = ["Efectivo", "Débito", "Crédito", "Billetera virtual", "Transferencia"]
infl = lambda f: 1.023 ** ((f.year - 2025) * 12 + f.month - 1)

# ---------------------------------------------------------------- cierres de caja por local y día (cerrado los lunes)
LOCALES = {"Centro": 380000, "Jardín": 290000}
RESP = {("Centro", False): "Sofía", ("Centro", True): "Marcos", ("Jardín", False): "Diego", ("Jardín", True): "Lucía"}
FONDO = 20000
cierres = []
for f in pd.date_range(INICIO, CORTE):
    if f.dayofweek == 0:
        continue
    avance = (f - INICIO).days / (CORTE - INICIO).days
    mix = np.array([0.80 - 0.14 * avance, 0.10 + 0.04 * avance, 0.04 + 0.02 * avance, 0.04 + 0.06 * avance, 0.02 + 0.02 * avance])
    estac = {1: 0.85, 2: 0.88, 6: 1.15, 7: 1.18, 8: 1.12}.get(f.month, 1.0)
    dia = {5: 1.6, 6: 2.6}.get(f.dayofweek, 1.0)
    for loc, base in LOCALES.items():
        finde = f.dayofweek >= 5
        resp = RESP[(loc, finde)]
        venta = base * infl(f) * estac * dia * RNG.uniform(0.88, 1.12)
        m = mix * RNG.uniform(0.9, 1.1, 5); m /= m.sum()
        por = np.round(venta * m, -1)
        tickets = int(round(venta / (9000 * infl(f) * RNG.uniform(0.92, 1.08))))
        gasto, concepto = 0, ""
        if RNG.random() < 0.4:
            concepto = RNG.choice(["Verdulería", "Limpieza", "Delivery", "Envases"], p=[0.45, 0.2, 0.2, 0.15])
            gasto = round(RNG.uniform(*{"Verdulería": (8000, 25000), "Limpieza": (3000, 9000), "Delivery": (2000, 6000), "Envases": (5000, 15000)}[concepto]) * infl(f), -1)
        esperado_sin_retiro = FONDO + por[0] - gasto
        retiro = round(esperado_sin_retiro * RNG.uniform(0.5, 0.85), -3) if RNG.random() < (0.6 if finde else 0.25) else 0
        esperado = esperado_sin_retiro - retiro
        u = RNG.random()
        dif = 0 if u < 0.70 else round(RNG.uniform(-800, 800), -1) if u < 0.95 else round(RNG.uniform(-3000, 3000), -1)
        if resp == "Marcos" and f >= FORM and RNG.random() < 0.7:          # faltantes concentrados en un responsable
            dif = -round(RNG.uniform(2000, 9000) * infl(f), -2)
        hora = f"{21 if not finde else 14}:{int(RNG.integers(5, 55)):02d}"
        cierres.append([f, loc, resp, *por, tickets, gasto, concepto, retiro, FONDO, esperado + dif, hora])
CI = pd.DataFrame(cierres, columns=["fecha", "local", "responsable", *MEDIOS, "tickets", "gasto", "concepto_gasto", "retiro", "fondo", "efectivo_contado", "hora"])
for c in MEDIOS + ["gasto", "retiro", "efectivo_contado"]:
    CI[c] = CI[c].astype(int)
# cinco cierres del formulario que nunca se cargaron (Jardín, domingos de agosto y septiembre)
olvidos = CI[(CI.local == "Jardín") & (CI.fecha >= "2025-08-01") & (CI.fecha.dt.dayofweek == 6)].sample(5, random_state=7).index
CI_TRUE = CI.copy()
CI_FORM = CI[(CI.fecha >= FORM) & ~CI.index.isin(olvidos)].copy()

# ---------------------------------------------------------------- mayoristas: pedidos y cobros
NOMBRES = ["Restaurante La Esquina", "Rotisería El Buen Gusto", "Almacén Doña Rosa", "Bodegón Los Abuelos", "Cantina del Puerto",
           "Rotisería Sabores", "Restaurante Il Forno", "Almacén San Martín", "Club Atlético Villa Sur", "Parrilla El Fogón",
           "Bar La Plaza", "Rotisería La Nonna", "Restaurante Mediterráneo", "Almacén El Trébol", "Comedor Escolar Norte",
           "Trattoria Bella Vista", "Rotisería Don Pepe", "Restaurante Las Tinajas", "Bar del Centro", "Almacén Los Pinos",
           "Restaurante Tierra Nuestra", "Rotisería La Familia", "Hotel Cerro Azul", "Restaurante El Molino"]
cli = []
for i, n in enumerate(NOMBRES, 1):
    cli.append(dict(id_cliente=i, nombre=n, intervalo=int(RNG.integers(3, 9)), ticket=RNG.uniform(35000, 160000),
                    condicion="Cuenta corriente" if RNG.random() < 0.65 else "Contado", cada=int(RNG.integers(14, 29)), alta=INICIO))
CL = pd.DataFrame(cli)
# casos de la historia
dejan = {3: "2025-07-12", 10: "2025-08-02", 17: "2025-08-20"}           # dejan de comprar
riesgo = {6: "2025-09-08", 21: "2025-09-12"}                             # espacian las compras
fiado = 13                                                               # paga la mitad desde julio: el fiado crece
nuevo = 24                                                               # cliente nuevo desde agosto
CL.loc[CL.id_cliente == nuevo, "alta"] = pd.Timestamp("2025-08-05")
CL.loc[CL.id_cliente.isin([fiado, 3, 10, 17, 6, 21, 1]), "condicion"] = "Cuenta corriente"
VEN, COB = [], []
for c in CL.itertuples():
    f = c.alta + pd.Timedelta(days=int(RNG.integers(0, 4)))
    saldo, ult_cobro = 0.0, f
    while f <= CORTE:
        if c.id_cliente in dejan and f >= pd.Timestamp(dejan[c.id_cliente]):
            break
        if f.dayofweek != 0:
            imp = round(c.ticket * infl(f) * RNG.uniform(0.75, 1.25), -2)
            VEN.append([f, c.id_cliente, imp, c.condicion])
            if c.condicion == "Contado":
                COB.append([f, c.id_cliente, imp, RNG.choice(["Efectivo", "Transferencia"], p=[0.6, 0.4])])
            else:
                saldo += imp
        if c.condicion == "Cuenta corriente" and (f - ult_cobro).days >= c.cada and saldo > 0:
            pago = saldo * (0.5 if c.id_cliente == fiado and f >= pd.Timestamp("2025-07-01") else RNG.uniform(0.85, 1.0))
            pago = round(pago, -2)
            COB.append([f, c.id_cliente, pago, RNG.choice(["Transferencia", "Efectivo", "Cheque"], p=[0.7, 0.2, 0.1])])
            saldo -= pago
            ult_cobro = f
        paso = c.intervalo * (3 if c.id_cliente in riesgo and f >= pd.Timestamp(riesgo[c.id_cliente]) else 1)
        f += pd.Timedelta(days=int(max(1, paso + RNG.integers(-1, 2))))
VE = pd.DataFrame(VEN, columns=["fecha", "id_cliente", "importe", "condicion"])
CO = pd.DataFrame(COB, columns=["fecha", "id_cliente", "importe", "medio"])
for df in (VE, CO):
    df["importe"] = df.importe.astype(int)

# ---------------------------------------------------------------- verdad
CL_OUT = CL[["id_cliente", "nombre", "condicion"]].assign(alta=CL.alta.dt.strftime("%Y-%m-%d"))
CL_OUT.to_csv(os.path.join(DAT, "verdad", "clientes_mayoristas.csv"), index=False)
CI_TRUE.assign(fecha=CI_TRUE.fecha.dt.strftime("%Y-%m-%d")).to_csv(os.path.join(DAT, "verdad", "cierres.csv"), index=False)
VE.assign(fecha=VE.fecha.dt.strftime("%Y-%m-%d")).to_csv(os.path.join(DAT, "verdad", "ventas_mayoristas.csv"), index=False)
CO.assign(fecha=CO.fecha.dt.strftime("%Y-%m-%d")).to_csv(os.path.join(DAT, "verdad", "cobros_mayoristas.csv"), index=False)
pd.DataFrame([["dejó de comprar", k, v] for k, v in dejan.items()] + [["espacia las compras", k, v] for k, v in riesgo.items()]
             + [["el fiado crece (paga la mitad)", fiado, "2025-07-01"], ["cliente nuevo", nuevo, "2025-08-05"],
                ["faltantes de caja", "Marcos", "2025-06-01"]] + [["cierre no cargado", "Jardín", CI.loc[i, "fecha"].strftime("%Y-%m-%d")] for i in olvidos],
             columns=["caso", "quien", "desde"]).to_csv(os.path.join(DAT, "verdad", "casos_de_la_historia.csv"), index=False)

# ---------------------------------------------------------------- formulario (desde junio): así salen de Google Sheets
marca = lambda f, h: f"{f:%d/%m/%Y} {h}:{int(RNG.integers(0, 59)):02d}"
fo = CI_FORM.copy()
fo.insert(0, "Marca temporal", [marca(f, h) for f, h in zip(fo.fecha, fo.hora)])
fo = fo.drop(columns=["hora", "fondo"])
fo.columns = ["Marca temporal", "Fecha del cierre", "Local", "Responsable", "Ventas en efectivo", "Ventas con débito", "Ventas con crédito",
              "Ventas con billetera virtual", "Ventas por transferencia", "Cantidad de tickets", "Gastos pagados con la caja", "Concepto del gasto",
              "Retiro del dueño", "Efectivo contado al cierre"]
fo["Fecha del cierre"] = fo["Fecha del cierre"].dt.strftime("%d/%m/%Y")
fo.to_csv(os.path.join(DAT, "formulario", "respuestas_cierre_de_caja.csv"), index=False)
vf = VE[VE.fecha >= FORM].merge(CL[["id_cliente", "nombre"]], on="id_cliente")
pd.DataFrame({"Marca temporal": [marca(f, "18") for f in vf.fecha], "Fecha": vf.fecha.dt.strftime("%d/%m/%Y"), "Cliente": vf.nombre,
              "Importe del pedido": vf.importe, "Condición": vf.condicion}).to_csv(os.path.join(DAT, "formulario", "respuestas_pedidos.csv"), index=False)
cf = CO[CO.fecha >= FORM].merge(CL[["id_cliente", "nombre"]], on="id_cliente")
pd.DataFrame({"Marca temporal": [marca(f, "19") for f in cf.fecha], "Fecha": cf.fecha.dt.strftime("%d/%m/%Y"), "Cliente": cf.nombre,
              "Importe cobrado": cf.importe, "Medio": cf.medio}).to_csv(os.path.join(DAT, "formulario", "respuestas_cobros.csv"), index=False)

# ---------------------------------------------------------------- Excel original (enero a mayo), con los problemas de siempre
MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo"]
DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]
def fecha_sucia(f):
    u = RNG.random()
    if u < 0.70: return f.to_pydatetime()
    if u < 0.82: return f"{f.day}/{f.month}"
    if u < 0.92: return f"{f:%d-%m-%y}"
    return f"{DIAS[f.dayofweek].capitalize()} {f.day}/{f.month}"
def local_sucio(l):
    return RNG.choice({"Centro": ["Centro", "centro", "CENTRO ", "Centro"], "Jardín": ["Jardin", "Jardín", "B° Jardín", "jardin"]}[l])
def monto_sucio(v):
    if v == 0: return RNG.choice([None, "-", 0])
    u = RNG.random()
    if u < 0.72: return int(v)
    if u < 0.86: return f"$ {v:,.0f}".replace(",", ".")
    if u < 0.94: return f"{v:,.0f}".replace(",", ".") + ",00"
    return f"{int(v)}.-"
wb = Workbook(); wb.remove(wb.active)
ilegibles = 0
HEAD = {False: ["Fecha", "Local", "Efvo", "Debito", "Credito", "Transf", "Gastos", "Detalle", "Retiro Aldo", "Total", "Obs"],
        True: ["Fecha", "Local", "Efvo", "Debito", "Credito", "MP / Billetera", "Transf", "Gastos", "Detalle", "Retiro Aldo", "Total", "Obs"]}
for k, mes in enumerate(MESES, 1):
    ws = wb.create_sheet(mes)
    bill = k >= 4                                          # la columna de billetera aparece en abril
    ws.append(HEAD[bill])
    for c in ws[1]:
        c.font, c.fill = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor="7F7F7F")
    sem = None
    for r in CI_TRUE[(CI_TRUE.fecha.dt.month == k)].itertuples():
        s = r.fecha.isocalendar().week
        if sem is not None and s != sem and RNG.random() < 0.8:
            ws.append(["TOTAL SEMANA", None, None]); ws.cell(ws.max_row, 1).font = Font(bold=True)
        sem = s
        trans = r.Transferencia if bill else r.Transferencia + r._7                   # hasta marzo la billetera se anotaba como transferencia
        vals = [r.Efectivo, r.Débito, r.Crédito] + ([r._7] if bill else []) + [trans]
        fila = [fecha_sucia(r.fecha), local_sucio(r.local)] + [monto_sucio(v) for v in vals] + [monto_sucio(r.gasto), r.concepto_gasto or None, monto_sucio(r.retiro)]
        fila += [f"=SUM(C{ws.max_row + 1}:{'G' if bill else 'F'}{ws.max_row + 1})", None]
        if RNG.random() < 0.012:                                                      # no se pasó el dato del cuaderno
            fila[2] = "ver cuaderno"; fila[-1] = "falta pasar"; ilegibles += 1
        if RNG.random() < 0.03:
            fila[-1] = RNG.choice(["posnet caído a la tarde", "faltó cambio", "pagó proveedor con caja", "lluvia, poca gente"])
        ws.append(fila)
        if RNG.random() < 0.02:                                                       # pegado dos veces
            ws.append(list(fila))
    ws.append([]); ws.append(["TOTAL MES", None, f"=SUM(C2:C{ws.max_row - 1})"])
    ws.cell(ws.max_row, 1).font = Font(bold=True)
    for col, w in zip("ABCDEFGHIJKL", [14, 12, 12, 12, 12, 14, 12, 10, 14, 12, 12, 24]):
        ws.column_dimensions[col].width = w
# el fiado de los restaurantes, en otra pestaña: nombres escritos a mano y un saldo que se arrastraba a mano
ws = wb.create_sheet("Fiado")
ws.append(["Fecha", "Cliente", "Pedido $", "Pagó $", "Saldo", "Obs"])
apodos = {}
for c in CL.itertuples():
    base = c.nombre
    corto = base.split(" ", 1)[1] if " " in base else base
    apodos[c.id_cliente] = [base, corto, corto.lower(), corto.upper(), base.replace("Restaurante", "Rest.").replace("Rotisería", "Rotis.").replace("Almacén", "Alm.")]
mov = pd.concat([VE[(VE.fecha < FORM) & (VE.condicion == "Cuenta corriente")].assign(tipo="p"), CO[(CO.fecha < FORM) & CO.id_cliente.isin(CL[CL.condicion == "Cuenta corriente"].id_cliente)].assign(tipo="c")])
mov = mov.sort_values(["fecha", "tipo"])
saldo_manual = {}
for r in mov.itertuples():
    s = saldo_manual.get(r.id_cliente, 0)
    s = s + r.importe if r.tipo == "p" else s - r.importe
    if RNG.random() < 0.04:                                                           # error de arrastre del saldo
        s += RNG.choice([-1, 1]) * round(RNG.uniform(5000, 40000), -3)
    saldo_manual[r.id_cliente] = s
    nombre = RNG.choice(apodos[r.id_cliente])
    ws.append([fecha_sucia(r.fecha), nombre, monto_sucio(r.importe) if r.tipo == "p" else None, monto_sucio(r.importe) if r.tipo == "c" else None, int(s), None])
for col, w in zip("ABCDEF", [14, 30, 12, 12, 12, 20]):
    ws.column_dimensions[col].width = w
wb.save(os.path.join(DAT, "excel_original", "Caja 2025.xlsx"))
print(f"cierres {len(CI_TRUE)} (formulario {len(CI_FORM)}, sin cargar {len(olvidos)}) · pedidos {len(VE)} · cobros {len(CO)} · filas ilegibles en el Excel {ilegibles}")
