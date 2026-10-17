"""
Caso sintético: Control de Gestión de un BPO de cobranzas (inspirado en la
estructura de modelos de gestión reales; TODOS los datos son ficticios).

Genera un modelo estrella reutilizable (CSV) + un JSON compacto para el dashboard.
Escenarios: REAL (ene-24..sep-25), PPTO (2025), FCST (2025, rolling mensual).
"""
import json, math, os
import numpy as np
import pandas as pd

rng = np.random.default_rng(20251003)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "01_datos")
os.makedirs(OUT, exist_ok=True)

M24 = pd.date_range("2024-01-01", "2024-12-01", freq="MS")
M25 = pd.date_range("2025-01-01", "2025-12-01", freq="MS")
MESES = M24.append(M25)
CORTE = pd.Timestamp("2025-09-01")
MK = [d.strftime("%Y-%m") for d in MESES]
IDX = {k: i for i, k in enumerate(MK)}
HORAS_POS = 132  # 6 h x 22 días

# ---------------------------------------------------------------- macro
infl_real = [0.206,0.132,0.110,0.088,0.042,0.046,0.040,0.042,0.035,0.027,0.024,0.027,
             0.022,0.024,0.037,0.028,0.015,0.016,0.019,0.019,0.021,0.023,0.023,0.022]
parit_real = [0.15,0.12,0.10,0.10,0.06,0.05,0.045,0.04,0.035,0.03,0.025,0.025,
              0.025,0.02,0.02,0.025,0.015,0.015,0.02,0.02,0.02,0.02,0.02,0.02]
tc_real = [818,833,850,866,882,898,915,932,950,967,985,1003,
           1046,1062,1074,1155,1158,1189,1265,1318,1365,1410,1440,1465]
tc_ppto = [1050,1070,1090,1110,1130,1150,1170,1200,1225,1250,1275,1300]
SEAS_E = [0.96,0.97,1.03,1.01,1.00,0.99,1.00,1.01,1.02,1.01,1.00,0.97]

def cum_index(rates, base_pos):
    idx = np.ones(len(rates))
    for i in range(1, len(rates)):
        idx[i] = idx[i-1] * (1 + rates[i])
    return idx / idx[base_pos]

J25 = IDX["2025-01"]
I_real = cum_index(infl_real, J25)
P_real = cum_index(parit_real, J25)
# Ppto (armado oct-24): inflación y paritaria 3% mensual desde dic-24
I_ppto = np.array([I_real[IDX["2024-12"]] * 1.03 ** (k + 1) for k in range(12)])
P_ppto = np.array([P_real[IDX["2024-12"]] * 1.03 ** (k + 1) for k in range(12)])

# ---------------------------------------------------------------- carteras (ficticias)
C = [
 # code, nombre, industria, negocio, moneda, rev_ene25 (ARS M / USD k), rec, fee, ops, py, min/op(k), sms(k), mails(k), pagos(k), informes, wa
 ("TMV","Telco Móvil · Temprana","Comunicaciones","Cobranzas","ARS",98,0.33,0.072,22,8,24,140,900,9.0,600,1),
 ("TFP","Tarjeta Federal · Prelegal","Financiera","Cobranzas","ARS",67,0.18,0.140,18,22,26,90,500,4.5,1400,1),
 ("RSM","Retail Sur · Temprana","Retail","Cobranzas","ARS",48,0.38,0.060,12,18,22,110,700,7.0,500,1),
 ("FPG","Fintech Pago · Temprana","Financiera","Cobranzas","ARS",25,0.41,0.065,9,0,20,60,600,3.5,300,1),
 ("GNM","Gas Natural · Masiva","Servicios","Cobranzas","ARS",30,0.29,0.055,6,0,18,160,1100,8.0,0,0),
 ("CFM","Cable & Fibra · Masiva","Servicios","Cobranzas","ARS",22,0.27,0.060,6,0,18,120,800,5.5,0,0),
 ("PUY","Préstamos Uruguay · Temprana","Financiera","Cobranzas","USD",12.5,0.36,0.090,4,0,16,0,150,0.0,200,1),
 ("TUY","Telco Uruguay · Temprana","Comunicaciones","Cobranzas","USD",5.5,0.31,0.080,2,0,16,0,90,0.0,0,0),
 ("BNP","Banco Norte · Prelegal","Financiera","Cobranzas","ARS",18,0.15,0.160,7,3,24,40,250,1.8,900,0),
 ("POA","Pool Argentina · Multicedente","Financiera","Cobranzas","ARS",12.5,0.22,0.110,5,4,24,30,200,1.5,500,0),
 ("POC","Pool Judicial · Servicios","Servicios","Cobranzas","ARS",3.5,0.09,0.180,4,0,20,5,60,0.3,400,0),
 ("TKV","Telemarketing · Seguros","Seguros","Telemarketing","ARS",16,0.045,0.250,14,0,30,0,0,0.0,0,0),
]
CAR = pd.DataFrame(C, columns=["code","nombre","industria","negocio","moneda","rev0","rec","fee","ops","py",
                               "min_op","sms","mails","pagos","informes","wa"])
NC = len(CAR)

# trayectorias de volumen (deuda a precios constantes) y eficiencia — REAL
def vol_path(code):
    f = np.ones(len(MESES))
    for i, d in enumerate(MESES):
        t = i - J25
        if code == "TMV": f[i] = 1 + 0.010 * max(t, 0) - 0.004 * max(-t, 0)
        if code == "RSM": f[i] = 1.0 if d < pd.Timestamp("2025-06-01") else 0.80
        if code == "CFM": f[i] = 1 - 0.005 * t
        if code == "POC": f[i] = 1 - 0.012 * t
        if code == "BNP": f[i] = 1 + 0.006 * t
        if code == "GNM": f[i] = 1 + 0.003 * t
        if code == "FPG":
            ramp = {"2025-04":0.5,"2025-05":0.75,"2025-06":0.9}
            k = MK[i]
            f[i] = 0.0 if d < pd.Timestamp("2025-04-01") else ramp.get(k, 1.0)
        if code == "TKV": f[i] = 1 + 0.06 * math.sin(2 * math.pi * (d.month - 3) / 12)
    return f * (1 + rng.normal(0, 0.018, len(MESES)))

def eff_path(code):
    f = np.array([SEAS_E[d.month-1] for d in MESES]) * (1 + rng.normal(0, 0.022, len(MESES)))
    for i, d in enumerate(MESES):
        if code == "TFP" and d >= pd.Timestamp("2025-07-01"): f[i] *= 0.86
        if code == "PUY" and d >= pd.Timestamp("2025-06-01"): f[i] *= 1.15
        if code == "POA" and d >= pd.Timestamp("2025-05-01"): f[i] *= 0.93
    return f

def fee_path(code, base):
    f = np.full(len(MESES), base)
    if code == "TMV":
        for i, d in enumerate(MESES):
            if d >= pd.Timestamp("2025-05-01"): f[i] = 0.068
    return f

rows_drv = []  # escenario, mes, cartera, U, I, E, P, FX, ops, py, minutos, sms, mails, pagos, informes, wa
for _, c in CAR.iterrows():
    usd = c.moneda == "USD"
    V0 = (c.rev0 * (1e3 if usd else 1e6)) / (c.rec * c.fee)  # deuda base ene-25
    vp, ep, fp = vol_path(c.code), eff_path(c.code), fee_path(c.code, c.fee)
    for i, d in enumerate(MESES):
        if d > CORTE: break
        U = V0 * vp[i]
        I = 1.0 if usd else I_real[i]
        E = c.rec * ep[i]
        act = vp[i] > 0
        scale = max(vp[i], 0.0)
        ops = int(round(c.ops * (0.75 + 0.25 * scale))) if act else 0
        if c.code == "RSM" and d >= pd.Timestamp("2025-07-01"): ops = 9
        py = int(round(c.py * (0.7 + 0.3 * scale))) if act else 0
        if c.code == "RSM" and d >= pd.Timestamp("2025-07-01"): py = 13
        n = lambda x: max(0.0, x * scale * (1 + rng.normal(0, 0.05)))
        rows_drv.append(["REAL", MK[i], c.code, U, I, E, fp[i], tc_real[i] if usd else 1.0,
                         ops, py, (ops + py) * c.min_op * 1e3 * (1 + rng.normal(0, 0.04)) if act else 0,
                         n(c.sms * 1e3), n(c.mails * 1e3), n(c.pagos * 1e3), n(c.informes), c.wa if act else 0])
    # PPTO 2025: deuda proyectada desde sep-24 real con 3% mensual y crecimientos planeados
    for k, d in enumerate(M25):
        i = IDX[d.strftime("%Y-%m")]
        plan = {"TMV": 1 + 0.005 * k, "RSM": 1.05, "BNP": 1 + 0.004 * k, "CFM": 1.0, "POC": 0.9}.get(c.code, 1.0)
        if c.code == "FPG": plan = 0.0 if d < pd.Timestamp("2025-03-01") else (0.6 if d == pd.Timestamp("2025-03-01") else 1.0)
        U = V0 * plan
        I = 1.0 if usd else I_ppto[k]
        E = c.rec * SEAS_E[d.month-1]
        act = plan > 0
        ops = int(round(c.ops * (0.8 + 0.2 * plan))) if act else 0
        py = int(round(c.py * (0.8 + 0.2 * plan))) if act else 0
        rows_drv.append(["PPTO", MK[i], c.code, U, I, E, c.fee, tc_ppto[k] if usd else 1.0, ops, py,
                         (ops + py) * c.min_op * 1e3 if act else 0, c.sms * 1e3 * plan, c.mails * 1e3 * plan,
                         c.pagos * 1e3 * plan, c.informes * plan, c.wa if act else 0])

DRV = pd.DataFrame(rows_drv, columns=["esc","mes","cartera","U","I","E","P","FX","ops","py","minutos","sms","mails","pagos","informes","wa"])

# FCST 2025: ene-sep = forecast del mes (sesgo optimista en eficiencia, sin anticipar renegociaciones);
# oct-dic = proyección desde la base de sep (Real ene-sep + Fcst oct-dic = cierre proyectado)
real25 = DRV[(DRV.esc == "REAL") & (DRV.mes >= "2025-01")].copy()
fc = []
for _, r in real25.iterrows():
    x = r.copy(); x["esc"] = "FCST"
    x["U"] *= 1 + rng.normal(0.008, 0.02)
    x["E"] *= 1 + rng.normal(0.015, 0.025)
    if r.cartera == "TMV" and r.mes == "2025-05": x["P"] = 0.072
    if r.cartera == "TFP" and r.mes == "2025-07": x["E"] = r.E / 0.86 * 0.97
    if r.FX != 1.0: x["FX"] = tc_real[IDX[r.mes] - 1] * 1.015
    if r.I != 1.0: x["I"] = I_real[IDX[r.mes] - 1] * (1 + infl_real[IDX[r.mes] - 1])
    fc.append(x)
infl_fc = {"2025-10": 0.023, "2025-11": 0.023, "2025-12": 0.022}
tc_fc = {"2025-10": 1410, "2025-11": 1440, "2025-12": 1465}
sep = real25[real25.mes == "2025-09"].set_index("cartera")
q3 = real25[real25.mes.isin(["2025-07","2025-08","2025-09"])].groupby("cartera")
for mm in ["2025-10","2025-11","2025-12"]:
    mth = int(mm[-2:])
    k = list(infl_fc).index(mm) + 1
    for code, r in sep.iterrows():
        x = r.copy(); x["esc"] = "FCST"; x["mes"] = mm; x["cartera"] = code
        if r.I != 1.0:
            x["I"] = r.I * np.prod([1 + infl_fc[z] for z in list(infl_fc)[:k]])
        e_base = (q3.get_group(code).E / [SEAS_E[6], SEAS_E[7], SEAS_E[8]]).mean()
        x["E"] = e_base * SEAS_E[mth-1]
        if r.FX != 1.0: x["FX"] = tc_fc[mm]
        x["U"] = r.U * (1.01 ** k if code == "TMV" else 1.0)
        fc.append(x)
DRV = pd.concat([DRV, pd.DataFrame(fc)], ignore_index=True)
DRV["deuda"] = DRV.U * DRV.I
DRV["ingreso"] = DRV.deuda * DRV.E * DRV.P * DRV.FX

# ---------------------------------------------------------------- costos unitarios / macro por escenario
def macro(esc, mk):
    i = IDX[mk]
    if esc == "PPTO":
        k = i - J25
        I, P, tc = I_ppto[k], P_ppto[k], tc_ppto[k]
        sms_step = 1.0; min_step = 1.0
    else:
        I, P, tc = I_real[i], P_real[i], tc_real[i]
        if esc == "FCST" and mk in tc_fc:
            k = list(tc_fc).index(mk) + 1
            I = I_real[IDX["2025-09"]] * np.prod([1 + infl_fc[z] for z in list(infl_fc)[:k]])
            P = P_real[IDX["2025-09"]] * 1.02 ** k
            tc = tc_fc[mk]
        sms_step = 1.25 if mk >= "2025-05" else 1.0       # salto de lista de precios SMS
        min_step = 1.10 if mk >= "2025-08" else 1.0       # ajuste tarifario telefonía
        if esc == "FCST" and "2025-01" <= mk <= "2025-09":
            I = I_real[i-1] * (1 + infl_real[i-1]); P = P_real[i-1] * (1 + parit_real[i-1]); tc = round(tc_real[i-1] * 1.015)
            sms_step = 1.25 if mk > "2025-05" else 1.0; min_step = 1.10 if mk > "2025-08" else 1.0
    return dict(I=I, P=P, tc=tc,
        costo_op=760_000 * P, costo_sup=1_550_000 * P, sup_ratio=13,
        apoyo={"Calidad": 4 * 1_100_000 * P, "Back Office": 3 * 1_000_000 * P,
               "Ejecutivos de cuenta": 3 * 1_900_000 * P, "Gerencia de Operaciones": 2 * 3_200_000 * P},
        py_usd=650 if mk >= "2025-01" else 620,
        cmin=1.45 * I * min_step, csms=9.0 * I * sms_step, mail_usd=0.00048, lic_usd=45,
        wa_fijo=97, wa_var=14, cpago=110 * I, cinf=320 * I, iibb=0.03,
        staff={"0100 Gerencia General": 9e6 * P, "0200 Administración y Finanzas": 16e6 * P,
               "0300 Legales": 7e6 * P, "0400 RRHH": 8e6 * P, "0700 Tecnología": 20e6 * P,
               "0900 Comercial": 12e6 * P},
        honor=4.5e6 * I, mant=6e6 * I,
        alq=5e6 * (I_real[IDX["2025-01"]] if mk < "2025-07" else I_real[IDX["2025-07"]]) if esc != "PPTO" else 5e6 * I,
        otros=3e6 * I, ti_usd=4000, amort=2.5e6, bancos_rate=0.012, intereses=6e6 * I)

# ---------------------------------------------------------------- plan de cuentas (gestión)
ITEMS = [  # item, n2, n1, tipo, driver
 ("Ingreso por recupero", "1.1 Ingreso Cobranzas", "1 Ingreso Operacional", "Directo", "Deuda × recupero × fee"),
 ("Comisiones por venta", "1.3 Ingreso Ventas", "1 Ingreso Operacional", "Directo", "Base × conversión × comisión"),
 ("Operadores", "2.1 Remuneraciones", "2 Costos de Explotación", "Directo", "Dotación de la cartera"),
 ("Supervisión", "2.1 Remuneraciones", "2 Costos de Explotación", "Asignado", "Posiciones (op. + PY)"),
 ("Calidad", "2.1 Remuneraciones", "2 Costos de Explotación", "Asignado", "Posiciones (op. + PY)"),
 ("Back Office", "2.1 Remuneraciones", "2 Costos de Explotación", "Asignado", "Posiciones (op. + PY)"),
 ("Ejecutivos de cuenta", "2.1 Remuneraciones", "2 Costos de Explotación", "Asignado", "Posiciones (op. + PY)"),
 ("Gerencia de Operaciones", "2.1 Remuneraciones", "2 Costos de Explotación", "Asignado", "Posiciones (op. + PY)"),
 ("Indemnizaciones", "2.1 Remuneraciones", "2 Costos de Explotación", "Asignado", "Posiciones (op. + PY)"),
 ("Posiciones Paraguay", "2.2 Servicios de Terceros", "2 Costos de Explotación", "Directo", "Posiciones PY × USD"),
 ("Licencias discador/CRM", "2.3 Licencias", "2 Costos de Explotación", "Asignado", "Posiciones (licencias)"),
 ("Telefonía celular", "2.5 Telefonía", "2 Costos de Explotación", "Asignado", "Minutos hablados"),
 ("Telefonía LDN", "2.5 Telefonía", "2 Costos de Explotación", "Asignado", "Minutos hablados"),
 ("Telefonía local y 0800", "2.5 Telefonía", "2 Costos de Explotación", "Asignado", "Minutos hablados"),
 ("SMS", "2.6 SMS", "2 Costos de Explotación", "Asignado", "Mensajes enviados"),
 ("Bocas de cobranza", "2.7 Bocas de Cobranza", "2 Costos de Explotación", "Asignado", "Cantidad de pagos"),
 ("Mailing", "2.8 Mailing", "2 Costos de Explotación", "Asignado", "Mails enviados"),
 ("Informes comerciales", "2.9 Informes Comerciales", "2 Costos de Explotación", "Asignado", "Consultas"),
 ("WhatsApp", "2.12 WhatsApp", "2 Costos de Explotación", "Asignado", "Líneas + agentes"),
 ("Ingresos Brutos", "3.1 Ingresos Brutos", "3 Impuestos Directos", "Directo", "3% ingreso local"),
 ("Remuneraciones staff", "4.1 Remuneraciones Staff", "4 Gastos de Estructura", "Estructura", "% ingresos"),
 ("Honorarios", "4.2 Honorarios", "4 Gastos de Estructura", "Estructura", "% ingresos"),
 ("Mantenimiento y servicios", "4.3 Mantenimiento de Oficina", "4 Gastos de Estructura", "Estructura", "% ingresos"),
 ("Alquileres", "4.4 Alquileres", "4 Gastos de Estructura", "Estructura", "% ingresos"),
 ("Infraestructura TI (USD)", "4.6 Otros Gastos", "4 Gastos de Estructura", "Estructura", "% ingresos"),
 ("Otros gastos", "4.6 Otros Gastos", "4 Gastos de Estructura", "Estructura", "% ingresos"),
 ("Amortizaciones", "5.1 Amortizaciones", "5 Resultado No Operacional", "No operacional", ""),
 ("Gastos bancarios e intereses", "5.2 Resultados Financieros", "5 Resultado No Operacional", "No operacional", ""),
 ("Diferencia de cambio", "5.2 Resultados Financieros", "5 Resultado No Operacional", "No operacional", "Saldo cta. cte. USD × ΔTC"),
 ("Recupero gastos intercompany", "5.3 Recupero Intercompany", "5 Resultado No Operacional", "No operacional", "TI por dotación · Corporativo partes iguales"),
 ("Impuesto a las ganancias", "6.1 Impuesto a las Ganancias", "6 Impuestos", "No operacional", "35% s/ resultado"),
]
IT = pd.DataFrame(ITEMS, columns=["item","n2","n1","tipo","driver"])
II = {r["item"]: i for i, r in IT.iterrows()}

# ---------------------------------------------------------------- intercompany (países)
def ic_drivers(esc, mk, rev_arg_usd, dot_arg):
    i = IDX[mk]; t = i - J25
    g = (lambda a: a) if esc == "PPTO" else (lambda a: a * (1 + rng.normal(0, 0.02)))
    return {"dot": {"ARG": dot_arg, "CM": round(g(140 + 0.6 * t)), "CA": round(g(95 + 0.3 * t)), "PY": round(g(70))},
            "ing": {"ARG": rev_arg_usd, "CM": g(450e3 * (1 + 0.004 * t)), "CA": g(120e3), "PY": g(45e3)}}

def shares(method, ic):
    paises = ["ARG", "CM", "CA", "PY"]
    if method == "iguales": return {p: 0.25 for p in paises}
    base = ic["dot"] if method == "dotacion" else ic["ing"]
    tot = sum(base.values()); return {p: base[p] / tot for p in paises}

STAFF_COUNT = 48
res, ic_rows, kpi_rows = [], [], []
saldo = {"REAL": 40_000.0, "PPTO": None, "FCST": None}
tc_prev = {}
for esc in ["REAL", "PPTO", "FCST"]:
    meses = [m for m in MK if (esc == "REAL" and m <= "2025-09") or (esc != "REAL" and m >= "2025-01")]
    for mk in meses:
        mc = macro(esc, mk)
        d = DRV[(DRV.esc == esc) & (DRV.mes == mk)].set_index("cartera").reindex(CAR.code).fillna(0)
        pos = d.ops + d.py
        tpos = pos.sum()
        add = lambda c, item, v: res.append([esc, mk, c, II[item], -abs(v) if IT.loc[II[item], "n1"][0] in "234" else v])
        for code, r in d.iterrows():
            neg = CAR.set_index("code").loc[code, "negocio"]
            add(code, "Ingreso por recupero" if neg == "Cobranzas" else "Comisiones por venta", r.ingreso)
            add(code, "Operadores", r.ops * mc["costo_op"] * (1 + rng.normal(0, 0.015) if esc != "PPTO" else 1))
            add(code, "Posiciones Paraguay", r.py * mc["py_usd"] * mc["tc"])
            fx = CAR.set_index("code").loc[code, "moneda"] == "USD"
            add(code, "Ingresos Brutos", 0 if fx else r.ingreso * mc["iibb"])
        # pools asignados por driver
        sup_pool = math.ceil(tpos / mc["sup_ratio"]) * mc["costo_sup"]
        ind = 1.2e6 * mc["P"] * (1 + rng.normal(0, 0.3)) if esc != "PPTO" else 2.0e6 * mc["P"]
        if esc == "REAL" and mk == "2024-03": ind += 10e6
        pools = {"Supervisión": (sup_pool, pos)}
        for k, v in mc["apoyo"].items(): pools[k] = (v, pos)
        pools["Indemnizaciones"] = (ind, pos)
        pools["Licencias discador/CRM"] = (tpos * mc["lic_usd"] * mc["tc"], pos)
        tmin = d.minutos.sum() * mc["cmin"] + 1.5e6 * mc["I"]
        pools["Telefonía celular"] = (tmin * 0.70, d.minutos)
        pools["Telefonía LDN"] = (tmin * 0.18, d.minutos)
        pools["Telefonía local y 0800"] = (tmin * 0.12, d.minutos)
        pools["SMS"] = (d.sms.sum() * mc["csms"], d.sms)
        pools["Bocas de cobranza"] = (d.pagos.sum() * mc["cpago"], d.pagos)
        pools["Mailing"] = (d.mails.sum() * mc["mail_usd"] * mc["tc"], d.mails)
        pools["Informes comerciales"] = (d.informes.sum() * mc["cinf"], d.informes)
        wa_lines = d.wa.sum()
        pools["WhatsApp"] = ((wa_lines * mc["wa_fijo"] + (d.ops * (d.wa > 0)).sum() * mc["wa_var"]) * mc["tc"],
                             d.wa * mc["wa_fijo"] + d.ops * (d.wa > 0) * mc["wa_var"])
        for item, (tot, drv) in pools.items():
            s = drv.sum()
            if s <= 0 or tot == 0: continue
            if item == "Indemnizaciones" and esc == "REAL" and mk == "2025-07":
                add("RSM", item, 18e6)  # reestructuración por baja de volumen en Retail Sur
            for code in CAR.code:
                if drv[code] > 0: add(code, item, tot * drv[code] / s)
        # estructura
        staff = mc["staff"]
        for ceco, v in staff.items(): add("EST", "Remuneraciones staff", v)
        add("EST", "Honorarios", mc["honor"]); add("EST", "Mantenimiento y servicios", mc["mant"])
        add("EST", "Alquileres", mc["alq"]); add("EST", "Otros gastos", mc["otros"])
        ti_infra = mc["ti_usd"] * mc["tc"]; add("EST", "Infraestructura TI (USD)", ti_infra)
        rev = d.ingreso.sum()
        add("EST", "Amortizaciones", -mc["amort"])
        add("EST", "Gastos bancarios e intereses", -(rev * mc["bancos_rate"] + mc["intereses"]))
        # intercompany: TI (rem + infra) por dotación; Gerencia General partes iguales
        pool_ti = staff["0700 Tecnología"] + ti_infra
        pool_corp = staff["0100 Gerencia General"]
        icd = ic_drivers(esc, mk, rev / mc["tc"], int(tpos - d.py.sum() + STAFF_COUNT + math.ceil(tpos / mc["sup_ratio"]) + 12))
        sh_ti, sh_cp = shares("dotacion", icd), shares("iguales", icd)
        rec = pool_ti * (1 - sh_ti["ARG"]) + pool_corp * (1 - sh_cp["ARG"])
        add("EST", "Recupero gastos intercompany", rec)
        # cta cte USD y diferencia de cambio
        if saldo.get(esc) is None:
            saldo[esc] = saldo_dic24  # PPTO/FCST arrancan del saldo real a dic-24
            tc_prev[esc] = tc_real[IDX["2024-12"]]
        if esc not in tc_prev: tc_prev[esc] = mc["tc"]
        difc = saldo[esc] * (mc["tc"] - tc_prev[esc])
        add("EST", "Diferencia de cambio", difc)
        facturado = rec / mc["tc"]
        cobro = 0.8 * (saldo[esc] + facturado) if mk[-2:] in ("03","06","09","12") else 0.0
        ic_rows.append([esc, mk, pool_ti, pool_corp, mc["tc"], saldo[esc], facturado, cobro, difc,
                        *[icd["dot"][p] for p in ["ARG","CM","CA","PY"]], *[icd["ing"][p] for p in ["ARG","CM","CA","PY"]]])
        saldo[esc] = saldo[esc] + facturado - cobro
        tc_prev[esc] = mc["tc"]
        if esc == "REAL" and mk == "2024-12": saldo_dic24 = saldo["REAL"]
        kpi_rows.append([esc, mk, mc["tc"], int(d.ops.sum()), int(d.py.sum()), int(tpos), tpos * HORAS_POS,
                         mc["costo_op"], mc["csms"], mc["cmin"], mc["I"], mc["P"]])

RES = pd.DataFrame(res, columns=["esc","mes","cartera","item_id","importe"])
# impuesto a las ganancias (35% del resultado antes de impuestos, mensual simplificado)
uai = RES.groupby(["esc","mes"]).importe.sum()
tax = [[e, m, "EST", II["Impuesto a las ganancias"], -0.35 * v if v > 0 else 0.0] for (e, m), v in uai.items()]
RES = pd.concat([RES, pd.DataFrame(tax, columns=RES.columns)], ignore_index=True)
RES = RES.merge(IT.reset_index().rename(columns={"index": "item_id"}), on="item_id")
KPI = pd.DataFrame(kpi_rows, columns=["esc","mes","tc","operadores","posiciones_py","posiciones","horas",
                                      "costo_operador","costo_sms","costo_minuto","indice_precios","indice_salarial"])
IC = pd.DataFrame(ic_rows, columns=["esc","mes","pool_ti","pool_corp","tc","saldo_ini_usd","facturado_usd","cobro_usd",
                                    "dif_cambio","dot_ARG","dot_CM","dot_CA","dot_PY","ing_ARG","ing_CM","ing_CA","ing_PY"])

# ---------------------------------------------------------------- conciliación contable -> gestión (REAL 2025)
conc = []
RR = RES[RES.esc == "REAL"]
def tot(mk, items): return -RR[(RR.mes == mk) & (RR.item.isin(items))].importe.sum()  # costo positivo
rec_m = RR[RR.item == "Recupero gastos intercompany"].set_index("mes").importe
for mk in [m for m in MK if "2025-01" <= m <= "2025-09"]:
    prev = MK[IDX[mk] - 1]
    sms_prev = tot(prev, ["SMS"])
    conc.append([mk, "SMS: factura vs. provisión del mes anterior", -sms_prev * rng.normal(0.05, 0.04)])
    fx_items = ["Mailing", "Telefonía celular", "Telefonía LDN", "Telefonía local y 0800"]
    conc.append([mk, "Mailing y telefonía: facturas del mes anterior", tot(prev, fx_items) - tot(mk, fx_items)])
    conc.append([mk, "Eliminación bonificación a cedentes", 2.1e6 * I_real[IDX[mk]]])
    conc.append([mk, "Eliminación honorarios cedentes PY", -1.4e6 * I_real[IDX[mk]]])
    q = {"03": ["2025-01","2025-02","2025-03"], "06": ["2025-04","2025-05","2025-06"], "09": ["2025-07","2025-08","2025-09"]}
    booked = rec_m.loc[q[mk[-2:]]].sum() if mk[-2:] in q else 0.0
    conc.append([mk, "Recupero intercompany devengado mensual", rec_m.loc[mk] - booked])
    conc.append([mk, "Reclasificación indemnizaciones (sin efecto)", 0.0])
CONC = pd.DataFrame(conc, columns=["mes","concepto","ajuste_ars"])
CONC.to_csv(f"{OUT}/fact_conciliacion.csv", index=False, float_format="%.2f")

# ---------------------------------------------------------------- export CSV (modelo estrella)
TCMAP = KPI.set_index(["esc","mes"]).tc
RES["importe_usd"] = RES.importe / RES.set_index(["esc","mes"]).index.map(TCMAP)
RES = RES.rename(columns={"importe": "importe_ars"})
RES.to_csv(f"{OUT}/fact_resultado.csv", index=False, float_format="%.2f")
DRV.to_csv(f"{OUT}/fact_drivers_cartera.csv", index=False, float_format="%.6f")
KPI.to_csv(f"{OUT}/fact_kpi_operacion.csv", index=False, float_format="%.4f")
IC.to_csv(f"{OUT}/fact_intercompany.csv", index=False, float_format="%.2f")
CAR[["code","nombre","industria","negocio","moneda"]].to_csv(f"{OUT}/dim_cartera.csv", index=False)
IT.to_csv(f"{OUT}/dim_cuenta.csv", index_label="item_id")
pd.DataFrame({"mes": MK, "anio": [m[:4] for m in MK], "mes_num": [int(m[-2:]) for m in MK]}).to_csv(f"{OUT}/dim_fecha.csv", index=False)

# ---------------------------------------------------------------- JSON compacto para el dashboard
ESC = ["REAL","PPTO","FCST"]
CI = {c: i for i, c in enumerate(CAR.code)}; CI["EST"] = -1
r = RES[RES.importe_ars.abs() > 0.5]
J = {
 "meta": {"empresa": "Cobranzas del Sur S.A.", "nota": "Datos 100% ficticios", "corte": "2025-09",
          "moneda": "ARS", "horas_pos": HORAS_POS},
 "meses": MK, "esc": ESC,
 "carteras": CAR[["code","nombre","industria","negocio","moneda"]].to_dict("records"),
 "items": IT.to_dict("records"),
 "res": {"e": [ESC.index(x) for x in r.esc], "m": [IDX[x] for x in r.mes], "c": [CI[x] for x in r.cartera],
         "i": r.item_id.astype(int).tolist(), "v": [round(x) for x in r.importe_ars]},
 "drv": [[ESC.index(x.esc), IDX[x.mes], CI[x.cartera], round(x.U), round(x.I, 5), round(x.E, 5), round(x.P, 5),
          round(x.FX, 2), int(x.ops), int(x.py), round(x.minutos), round(x.sms), round(x.mails), round(x.pagos),
          round(x.informes)] for x in DRV.itertuples()],
 "kpi": [[ESC.index(x.esc), IDX[x.mes], x.tc, x.operadores, x.posiciones_py, x.posiciones, x.horas,
          round(x.costo_operador), round(x.costo_sms, 2), round(x.costo_minuto, 3),
          round(x.indice_precios, 6), round(x.indice_salarial, 6)] for x in KPI.itertuples()],
 "conc": [[IDX[x.mes], x.concepto, round(x.ajuste_ars)] for x in CONC.itertuples()],
 "ic": [[ESC.index(x.esc), IDX[x.mes], round(x.pool_ti), round(x.pool_corp), x.tc, round(x.saldo_ini_usd),
         round(x.facturado_usd), round(x.cobro_usd), round(x.dif_cambio), x.dot_ARG, x.dot_CM, x.dot_CA, x.dot_PY,
         round(x.ing_ARG), round(x.ing_CM), round(x.ing_CA), round(x.ing_PY)] for x in IC.itertuples()],
}
with open(f"{OUT}/dashboard_data.json", "w") as f:
    json.dump(J, f, ensure_ascii=False, separators=(",", ":"))
print("ok", len(RES), "filas resultado;", os.path.getsize(f"{OUT}/dashboard_data.json") // 1024, "KB json")
