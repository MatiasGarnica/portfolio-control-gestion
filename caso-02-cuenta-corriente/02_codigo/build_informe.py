"""Informe para supervisores (opción B): una tarjeta por supervisor y la lista de lo que le falta, para la reunión semanal.
Usa el mismo motor que el tablero (hoja.py), así los números coinciden. Sale en ../04_informes/informe-supervisores_sem{N}.html"""
import os, html
import numpy as np
import pandas as pd
from hoja import armar, cargar, PARAMS

D = os.path.dirname(os.path.abspath(__file__))
DAT = os.path.join(D, "..", "01_datos")
OUT = os.path.join(D, "..", "04_informes")
data = cargar()
W = len(data["meta"]["semanas"]) - 1
sem = data["meta"]["semanas"][W]
C = {c: i for i, c in enumerate(data["cols"])}
F = np.array(data["f"][W])
Fp = np.array(data["f"][W - 1])
foco, est, nueva, cob = armar(data, W)
foco_p, est_p, _, _ = armar(data, W - 1)
OBJ = PARAMS["objetivo"]
k = data["meta"]["umbrales"].index(PARAMS["dias"])
VD = F[:, C[["v30", "v45", "v60", "v90"][k]]]

cli = pd.DataFrame(data["cli"], columns=["id", "nombre", "tipo", "rep", "cond", "medio", "lat", "lng"])
rep = {r[0]: (r[1], r[2]) for r in data["rep"]}
sup = {s[0]: (s[1], s[2]) for s in data["sup"]}
suc = {s[0]: s[1] for s in data["suc"]}
cli["sup"] = cli.rep.map(lambda r: rep[r][0])
dim = pd.read_csv(os.path.join(DAT, "dim_cliente.csv")).set_index("id_cliente")
vis = pd.read_csv(os.path.join(DAT, "fact_visita.csv"), parse_dates=["fecha"])

# ¿todavía pasa el reparto esta semana? (corte jueves → quedan viernes y sábado)
lunes = pd.Timestamp(sem["lunes"]); corte = pd.Timestamp(data["meta"]["corte"])
dia_corte = (corte - lunes).days
prog_hace2 = set(vis[(vis.fecha >= lunes - pd.Timedelta(days=14)) & (vis.fecha < lunes - pd.Timedelta(days=7))].id_cliente)
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
def pasa(cid):
    d = dim.loc[cid]
    if d.dia_visita <= dia_corte:
        return None
    if d.frecuencia == "Quincenal" and cid not in prog_hace2:
        return None
    return DIAS[int(d.dia_visita)]
PASA = [pasa(c) for c in cli.id]          # día de visita que queda en la semana, o None

FOCO = ["deuda vencida", "sin visita", "ritmo de pago", "NC fuera de lo normal"]
def que_hacer(i):
    f, r = foco[i], F[i]
    if f == 0:
        return "seguir la promesa del llamado" if r[C["lla"]] else ("cobrar en la visita" if PASA[i] else "llamar: no tiene visita antes del lunes")
    if f == 1:
        return "confirmar que el reparto pase"
    if f == 2:
        return f"paga cada {int(r[C['imed']])} días y van {int(r[C['dup']])} sin pago"
    return "revisar la NC con administración"

fmt0 = lambda v: f"{v:,.0f}".replace(",", ".")
def ars(v):
    a = abs(v)
    s = f"{a/1e6:,.1f}\u00a0M".replace(".", ",") if a >= 1e6 else (f"{a/1e3:,.0f}\u00a0k" if a >= 1e4 else fmt0(a))
    return ("−" if v < 0 else "") + "$ " + s
pct = lambda r: f"{r*100:.1f}%".replace(".", ",")
esc = html.escape

def estado(r):
    if r >= OBJ: return "good", "En línea"
    if r >= OBJ * 0.9: return "warn", "Atención"
    return "crit", "Desvío"

hoja = foco >= 0
n = int(hoja.sum()); res = int(((est == 0) | (est == 1)).sum())
n_p = int((foco_p >= 0).sum()); res_p = int(((est_p == 0) | (est_p == 1)).sum())
pend = hoja & (est == 2)
pend_pasa = pend & np.array([x is not None for x in PASA])
filas = []
for s_id, (s_nom, s_suc) in sup.items():
    m = hoja & (cli.sup.values == s_id)
    if not m.any():
        continue
    e = [int((m & (est == x)).sum()) for x in range(4)]
    mp = (foco_p >= 0) & (cli.sup.values == s_id)
    rp = ((est_p == 0) | (est_p == 1))[mp].mean() if mp.any() else 0
    filas.append(dict(id=s_id, nom=s_nom, suc=suc[s_suc], n=int(m.sum()), e=e, r=(e[0] + e[1]) / m.sum(), rp=rp,
                      cob=float(cob[m].sum()), pend=e[2], pasan=int((m & pend_pasa).sum())))
filas.sort(key=lambda x: -x["r"])
peor = max(filas, key=lambda x: (x['pend'], -x['r']))              # el que más pendientes concentra
en_obj = sum(1 for f in filas if f["r"] >= OBJ)

def barra(e, tot):
    cols = ["var(--good)", "var(--warn)", "var(--crit)", "var(--neutral)"]
    seg = "".join(f'<i style="flex:{e[x]};background:{cols[x]}"></i>' for x in (0, 1, 2, 3) if e[x])
    return f'<div class="bar">{seg}<em style="left:{OBJ*100:.1f}%"></em></div>'

def lista(s_id, top=8):
    idx = [i for i in np.where(pend & (cli.sup.values == s_id))[0]]
    monto_i = lambda i: VD[i] if foco[i] == 0 else F[i, C["nc30"]] if foco[i] == 3 else F[i, C["saldo"]]
    idx.sort(key=lambda i: (PASA[i] is None, -monto_i(i)))
    out = []
    for i in idx[:top]:
        c = cli.iloc[i]; r = F[i]
        monto = monto_i(i)
        dup = "nunca pagó" if r[C["dup"]] < 0 else f"último pago hace {int(r[C['dup']])} d"
        out.append(f'<tr><td><b>{c.id}</b> · {esc(c.tipo)}<br><span class="m">{c.rep} · {FOCO[foco[i]]} · {dup}</span></td>'
                   f'<td>{"<span class=pasa>" + PASA[i].capitalize() + "</span>" if PASA[i] else "<span class=m>sin visita</span>"}</td>'
                   f'<td class="r"><b>{ars(monto)}</b><br><span class="m">{["vencido", "saldo", "saldo", "NC del mes"][foco[i]]}</span></td>'
                   f'<td class="q">{esc(que_hacer(i))}</td></tr>')
    resto = len(idx) - top
    return "".join(out), resto

know = [
    f"Al jueves van <b>{res} de {n} cuentas</b> con resultado ({pct(res/n)}). La semana pasada cerró en {pct(res_p/n_p)} y el objetivo al sábado es {pct(OBJ)}.",
    f"<b>{en_obj} de {len(filas)} supervisores</b> ya están en el objetivo. <b>{esc(peor['suc'])} · {esc(peor['nom'])}</b> concentra {peor['pend']} de los {int(pend.sum())} pendientes y va {pct(peor['r'])}.",
    f"Quedan <b>{int(pend.sum())} pendientes</b>; a <b>{int(pend_pasa.sum())}</b> todavía las visita el reparto el viernes o el sábado. Cada lista empieza por esas.",
]
cards = "".join(f"""
<article class="sup {estado(f['r'])[0]}"><header><h3>{esc(f['nom'])} <span>{esc(f['suc'])}</span></h3><span class="status {estado(f['r'])[0]}"><i></i>{estado(f['r'])[1]}</span></header>
<div class="big">{pct(f['r'])} <span>{f['e'][0]+f['e'][1]} de {f['n']}</span></div>{barra(f['e'], f['n'])}
<dl><dt>Cobrado de su hoja</dt><dd>{ars(f['cob'])}</dd><dt>Pendientes</dt><dd>{f['pend']}</dd><dt>Todavía pasa el reparto</dt><dd>{f['pasan']}</dd><dt>Semana pasada</dt><dd>{pct(f['rp'])}</dd></dl>
<a href="#{f['id']}">Ver su lista →</a></article>""" for f in filas)
secciones = []
for f in filas:
    body, resto = lista(f["id"])
    secciones.append(f"""<section class="lst" id="{f['id']}"><div class="lh"><h3>{esc(f['nom'])} · {esc(f['suc'])}</h3><p>{f['pend']} pendientes · primero las que todavía tienen visita, después por monto</p></div>
<table><colgroup><col style="width:38%"><col style="width:12%"><col style="width:15%"><col></colgroup><thead><tr><th>Cuenta</th><th>Visita</th><th class="r">En juego</th><th>Qué hacer</th></tr></thead><tbody>{body or '<tr><td colspan=4 class=m>No tiene pendientes.</td></tr>'}</tbody></table>
{f'<p class="m mas">Y {resto} cuentas más en el tablero (filtrar por supervisor).</p>' if resto > 0 else ''}</section>""")

CSS = """
:root{--bg:#fff;--surface:#fff;--surface-2:#f5f7fa;--line:#e1e5ea;--ink:#111a24;--ink-2:#3f4b58;--ink-3:#5d6874;--band:#13294b;--band-2:#c9d3e2;--accent:#c8102e;--link:#1f5bb5;
--good:#1d7a46;--warn:#e0a10f;--crit:#c0392b;--neutral:#9aa3ad;--good-ink:#16703f;--warn-ink:#7a5000;--crit-ink:#a82a2a;--good-bg:#e3f3e6;--warn-bg:#fcefd2;--crit-bg:#fbe6e6;--top:#13294b;
--f:"IBM Plex Sans","Helvetica Neue",Helvetica,Arial,sans-serif;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0c1117;--surface:#141a21;--surface-2:#19212a;--line:#25303b;--ink:#eef2f6;--ink-2:#b5c0cb;--ink-3:#8b97a3;--band:#0b1830;--band-2:#9fb0c8;--link:#7aaaf0;
--good-ink:#53cc7a;--warn-ink:#f2c14e;--crit-ink:#f07c7c;--good-bg:#14301f;--warn-bg:#3a2f12;--crit-bg:#3b1b1c;--top:#4d8be0;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:400 14px/1.5 var(--f);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding-inline:clamp(16px,3vw,32px)}a{color:var(--link);font-weight:700;text-decoration:none}a:hover{text-decoration:underline}
.band{background:var(--band);color:#fff;border-bottom:4px solid var(--accent)}.band .wrap{padding-block:20px 18px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:flex-end}
.brand{display:flex;gap:10px;align-items:center;font:600 11px/1.2 var(--f);letter-spacing:.08em;text-transform:uppercase;color:var(--band-2)}.logo{width:30px;height:30px;border-radius:7px;background:var(--accent);display:grid;place-items:center;color:#fff;font:700 12px var(--f)}
h1{font:700 clamp(22px,3vw,30px)/1.1 var(--f);margin:8px 0 4px;letter-spacing:-.02em}.stamp{margin:0;color:var(--band-2);font-size:13px}
.acts{display:flex;gap:8px;flex-wrap:wrap}.acts a,.acts button{all:unset;cursor:pointer;border:1px solid rgba(255,255,255,.3);border-radius:9px;padding:9px 14px;font:600 13px var(--f);color:#fff}
.acts a:focus-visible,.acts button:focus-visible{outline:2px solid #fff;outline-offset:2px}
main{padding-block:22px 40px}.eyb{font:700 11px/1.3 var(--f);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin:0 0 8px}
.know{list-style:none;margin:0 0 22px;padding:0;display:flex;flex-direction:column;gap:6px;font-size:15px}.know li{display:flex;gap:10px;align-items:baseline}
.know li::before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:var(--accent);transform:translateY(-2px)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(330px,100%),1fr));gap:14px;margin-bottom:12px}
.sup{border:1px solid var(--line);border-top:3px solid var(--top);border-radius:10px;padding:14px 16px;background:var(--surface);display:flex;flex-direction:column;gap:8px;break-inside:avoid}
.sup.warn{border-top-color:var(--warn)}.sup.crit{border-top-color:var(--crit)}
.sup header{display:flex;justify-content:space-between;gap:8px;align-items:center}.sup h3{margin:0;font:700 17px/1.2 var(--f)}.sup h3 span{font-weight:500;font-size:13px;color:var(--ink-3)}
.big{font:700 30px/1 var(--f);letter-spacing:-.02em}.big span{font:500 14px var(--f);color:var(--ink-3);letter-spacing:0}
.bar{position:relative;display:flex;gap:2px;height:12px;border-radius:3px}.bar i{display:block;height:100%}.bar i:first-child{border-radius:3px 0 0 3px}.bar i:last-of-type{border-radius:0 3px 3px 0}
.bar em{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--ink)}
dl{display:grid;grid-template-columns:1fr auto;gap:3px 12px;margin:2px 0 0;font-size:13.5px}dt{color:var(--ink-3)}dd{margin:0;font-weight:700;text-align:right}
.status{display:inline-flex;align-items:center;gap:5px;font:700 11px/1 var(--f);padding:4px 8px;border-radius:20px;white-space:nowrap}.status i{width:7px;height:7px;border-radius:50%;background:currentColor}
.status.good{color:var(--good-ink);background:var(--good-bg)}.status.warn{color:var(--warn-ink);background:var(--warn-bg)}.status.crit{color:var(--crit-ink);background:var(--crit-bg)}
.leg{display:flex;flex-wrap:wrap;gap:14px;font-size:12.5px;color:var(--ink-2);margin:4px 0 26px}.leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
h2{font:700 19px/1.25 var(--f);margin:0 0 4px}.sub{margin:0 0 14px;color:var(--ink-3);font-size:13px}
.lst{border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:14px;background:var(--surface);break-inside:avoid}
.lh{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;justify-content:space-between;margin-bottom:10px}.lh h3{margin:0;font:700 16px var(--f)}.lh p{margin:0;color:var(--ink-3);font-size:13px}
table{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}th{text-align:left;font:700 11px/1.3 var(--f);text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3);padding:6px 8px;border-bottom:2px solid var(--line)}
td{padding:8px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}.r{text-align:right;white-space:nowrap}.m{color:var(--ink-3);font-size:12.5px}.q{max-width:280px}
.pasa{display:inline-block;font:700 11px/1 var(--f);padding:4px 8px;border-radius:20px;background:var(--surface-2);border:1px solid var(--line)}.mas{margin:8px 0 0}
footer{border-top:1px solid var(--line);padding-top:16px;color:var(--ink-3);font-size:12.5px}
@media (max-width:640px){.q{max-width:none}td:nth-child(2),th:nth-child(2),col:nth-child(2){display:none}table{table-layout:auto}}
@media print{.acts{display:none}.band{-webkit-print-color-adjust:exact;print-color-adjust:exact}.lst{page-break-inside:avoid}body{font-size:12px}}
"""
lunes_s, fin_s = sem["lunes"], (lunes + pd.Timedelta(days=5)).strftime("%Y-%m-%d")
fdl = lambda s: f"{s[8:10]}/{s[5:7]}/{s[:4]}"
doc = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Informe supervisores · Semana {sem['sem']}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>{CSS}</style></head><body>
<header class="band"><div class="wrap"><div><div class="brand"><span class="logo">RF</span>Reparto Federal S.A. · Datos ficticios</div>
<h1>Informe para supervisores · Semana {sem['sem']}</h1><p class="stamp">Hoja del lunes {fdl(lunes_s)} · datos al jueves {fdl(data['meta']['corte'])} {data['meta']['hora']} · para la reunión del viernes</p></div>
<div class="acts"><a href="../03_tableros/cuenta-corriente.html">Abrir el tablero</a><button type="button" onclick="window.print()">Imprimir o guardar en PDF</button></div></div></header>
<main class="wrap">
<p class="eyb">Lo que hay que saber</p><ul class="know">{''.join(f'<li><span>{k}</span></li>' for k in know)}</ul>
<h2>{'Ningún supervisor llega todavía' if en_obj == 0 else f'{en_obj} de {len(filas)} ya llegan'} al objetivo de cierre</h2>
<p class="sub">Cuentas de su hoja con resultado al jueves · la línea negra marca el {pct(OBJ)} del cierre</p>
<div class="grid">{cards}</div>
<div class="leg"><span><i style="background:var(--good)"></i>Resueltas</span><span><i style="background:var(--warn)"></i>En parte</span><span><i style="background:var(--crit)"></i>Pendientes</span><span><i style="background:var(--neutral)"></i>Salieron solas</span></div>
<h2>Lo que falta, supervisor por supervisor</h2><p class="sub">Hasta 8 cuentas por supervisor · «En juego» es lo vencido a más de {PARAMS['dias']} días, el saldo si entró por visita o ritmo, o la NC del mes</p>
{''.join(secciones)}
<footer>Mismo criterio que el tablero (hoja.py): foco en orden deuda vencida, sin visita, ritmo de pago y NC fuera de lo normal; con resultado = resueltas + en parte. Datos 100% ficticios.</footer>
</main></body></html>"""
os.makedirs(OUT, exist_ok=True)
path = os.path.join(OUT, f"informe-supervisores_sem{sem['sem']}.html")
with open(path, "w", encoding="utf-8") as fh:
    fh.write(doc)
print("ok ->", os.path.relpath(path, D), "|", n, "cuentas,", res, "con resultado,", int(pend_pasa.sum()), "pendientes con visita")
for f in filas:
    print(f"  {f['nom']:<11} {f['suc']:<6} {pct(f['r']):>6}  {f['e']}  cobrado {ars(f['cob'])}  pasan {f['pasan']}")
