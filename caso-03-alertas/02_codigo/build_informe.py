"""Informe semanal de control para gerencia: alertas abiertas por regla y por reparto, los repartos que suman reglas
y las 10 alertas de más plata en juego. Mismo motor que el tablero. Sale en ../04_informes/informe-control-gerencia.html"""
import os, html
import pandas as pd
from alertas import cargar, candidatos, evaluar, PARAMS, REGLAS, CORTE, DIA

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, "..", "04_informes")
b = cargar()
C = candidatos(b)
A = evaluar(C)
cli = b["dim_cliente"].set_index("id_cliente")
rep = b["dim_reparto"].set_index("id_reparto")
sup = b["dim_supervisor"].set_index("id_supervisor")
eq = b["dim_equipo"].set_index("id_equipo")
inc_cli = set(b["fact_movimiento"].query("tipo == 'Incobrable'").id_cliente)
esc = html.escape
fmt0 = lambda v: f"{v:,.0f}".replace(",", ".")
def ars(v):
    a = abs(v)
    s = f"{a/1e6:,.1f} M".replace(".", ",") if a >= 1e6 else (f"{a/1e3:,.0f} k" if a >= 1e4 else fmt0(a))
    return ("−" if v < 0 else "") + "$ " + s
pct = lambda r: f"{r*100:.1f}%".replace(".", ",")
fdl = lambda t: t.strftime("%d/%m/%Y")
lbl = lambda c: f"{cli.loc[c, 'tipo_cliente']} {c}"
repl = lambda r: r if not isinstance(r, str) or rep.loc[r, "tipo_reparto"] == "Comercial" else rep.loc[r, "reparto"]

# reparto de cada alerta (para las de cliente, el reparto actual) y estado según los datos (igual que el tablero)
A["rep"] = [r if isinstance(r, str) else cli.loc[c, "id_reparto"] for r, c in zip(A.id_reparto, A.id_cliente)]
nc = C["nc_fuera_patron"].assign(clave=lambda x: x.id_cliente.astype(str) + "|" + x.fecha.dt.strftime("%Y-%m-%d")).set_index("clave")
bon = C["bonificaciones"]
def estado(a):
    if a.regla == "nc_fuera_patron":
        r = nc.loc[a.clave, "revision"]
        return "Sin revisar" if not r else ("Justificada" if "justificada" in r.lower() else "Confirmada")
    if a.regla == "solo_sin_cargo":
        g = C["solo_sin_cargo"]; g = g[(g.id_cliente == a.id_cliente) & (g.fecha > CORTE - PARAMS["sc_ventana"] * DIA)]
        f0 = g.fecha.iloc[0]
        if ((bon.id_cliente == a.id_cliente) & (bon.fecha <= f0) & (bon.fecha >= f0 - 30 * DIA)).any():
            return "Justificada"
    return "Sin revisar"
A["estado"] = [estado(a) for a in A.itertuples()]
AB = A[A.estado != "Justificada"].copy()

def titulo(a):
    if a.regla == "equipo_sin_abono":
        r = C["equipo_sin_abono"].set_index("id_equipo").loc[a.clave]
        return f"{r.tipo_equipo} {a.clave} en {lbl(a.id_cliente)}: {int(r.meses_sin)} meses sin abono", "Administración: dar de alta el abono y facturar los meses pendientes."
    if a.regla == "equipo_sin_consumo":
        r = C["equipo_sin_consumo"].set_index("id_equipo").loc[a.clave]
        baja = a.id_cliente in inc_cli
        return f"{r.tipo_equipo} {a.clave} en {lbl(a.id_cliente)}: {int(r.dias_sin)} días sin compras", \
            "Comercial: retirar el equipo (cliente dado de baja)." if baja else "Comercial: visitar y decidir reactivación o retiro."
    if a.regla == "solo_sin_cargo":
        return f"{lbl(a.id_cliente)}: entregas solo sin cargo", "Supervisión: verificar con el cliente qué recibió y qué pagó."
    if a.regla == "incobrables":
        n = ((C["incobrables"].id_reparto == a.clave) & (C["incobrables"].fecha > CORTE - PARAMS["inc_ventana"] * DIA)).sum()
        return f"{a.clave}: {n} incobrables en {PARAMS['inc_ventana']} días", "Gerencia de cobranzas: revisar cada baja con el supervisor."
    if a.regla == "cobro_sin_visita":
        w = C["cobro_sin_visita"]; n = ((w.id_reparto == a.clave) & (w.fecha > CORTE - PARAMS["csv_ventana"] * DIA)).sum()
        return f"{a.clave}: {n} cobros en efectivo en días sin visita", "Supervisión: controlar la rendición diaria del reparto."
    if a.regla == "nc_fuera_patron":
        r = nc.loc[a.clave]
        return f"NC de {ars(a.impacto)} a {lbl(a.id_cliente)} ({fdl(r.fecha)})", "Administración: pedir el respaldo y corregir si no lo hay."
    r = C["cambio_ruta"].set_index("id_cliente").loc[a.id_cliente]
    r = r.iloc[-1] if isinstance(r, pd.DataFrame) else r
    return f"{lbl(a.id_cliente)} pasó de {r.reparto_origen} a {repl(r.reparto_destino)} con deuda", "Gerencia de cobranzas: devolver la cuenta a una ruta comercial."

plata = AB.impacto.sum()
nuevas = AB[AB.fecha > CORTE - 7 * DIA]
por_regla = [(k, v[0], v[1], (AB.regla == k).sum(), AB[AB.regla == k].impacto.sum(), ((A.regla == k) & (A.estado == "Justificada")).sum()) for k, v in REGLAS.items()]
top_r = max(por_regla, key=lambda x: x[4])
reps = AB.groupby("rep").agg(reglas=("regla", "nunique"), alertas=("regla", "size"), plata=("impacto", "sum")).sort_values(["reglas", "alertas"], ascending=False)
reps3 = reps[reps.reglas >= 3]
viejas = (CORTE - AB.fecha).dt.days.gt(30).mean()
know = [
    f"Hay <b>{len(AB)} alertas abiertas</b> con <b>{ars(plata)}</b> en juego; {len(nuevas)} se dispararon en los últimos 7 días.",
    f"La regla con más plata en juego es <b>{esc(top_r[1].lower())}</b>: {ars(top_r[4])} ({pct(top_r[4] / plata)} del total).",
    "; ".join(f"<b>{esc(repl(r))}</b> aparece en {int(x.reglas)} reglas" for r, x in reps3.head(3).iterrows()) + ": conviene revisar esos repartos completos con su supervisor.",
    f"{pct(viejas)} de las alertas abiertas lleva más de 30 días sin resolverse.",
]
def sup_de(r):
    s = rep.loc[r, "id_supervisor"] if r in rep.index else None
    return sup.loc[s, "supervisor"] if isinstance(s, str) else "—"
filas_regla = "".join(f"<tr><td>{esc(n)}{f' <span class=m>(+{j} justificadas)</span>' if j else ''}</td><td class=r>{c}</td><td class=r>{ars(p)}</td><td>{esc(resp)}</td></tr>"
                      for k, n, resp, c, p, j in por_regla)
filas_rep = "".join(f"<tr><td><b>{esc(repl(r))}</b></td><td>{esc(sup_de(r))}</td><td>{', '.join(esc(REGLAS[g][0]) for g in AB[AB.rep == r].regla.unique())}</td><td class=r>{int(x.alertas)}</td><td class=r>{ars(x.plata)}</td></tr>"
                    for r, x in reps3.iterrows())
top10 = AB.sort_values("impacto", ascending=False).head(10)
filas_top = "".join(f"<tr><td>{i}</td><td><b>{esc(titulo(a)[0])}</b><br><span class=m>{esc(REGLAS[a.regla][0])} · se disparó el {fdl(a.fecha)}</span></td><td>{esc(titulo(a)[1])}</td><td class=r><b>{ars(a.impacto)}</b></td></tr>"
                    for i, a in enumerate(top10.itertuples(), 1))
CSS = open(os.path.join(D, "..", "..", "caso-02-cuenta-corriente", "02_codigo", "build_informe.py"), encoding="utf-8").read().split('CSS = """')[1].split('"""')[0]
doc = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Informe de control · gerencia</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>{CSS}
.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:12px;margin-bottom:24px}}
.cards div{{border:1px solid var(--line);border-top:3px solid var(--top);border-radius:10px;padding:12px 14px;background:var(--surface)}}
.cards span{{display:block;font:600 12.5px var(--f);color:var(--ink-2)}}.cards b{{display:block;font:700 26px/1.15 var(--f);margin:4px 0 2px}}.cards small{{color:var(--ink-3);font-size:12.5px}}
.blk{{border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:16px;background:var(--surface);break-inside:avoid}}
.blk table{{table-layout:auto}}.blk td:first-child{{width:auto}}
</style></head><body>
<header class="band"><div class="wrap"><div><div class="brand"><span class="logo">RF</span>Reparto Federal S.A. · Datos ficticios</div>
<h1>Informe de control · gerencia</h1><p class="stamp">Alertas al {fdl(CORTE)} · corrida diaria de las 6:00 · para la reunión semanal de gestión</p></div>
<div class="acts"><a href="../03_tableros/alertas.html">Abrir el tablero</a><button type="button" onclick="window.print()">Imprimir o guardar en PDF</button></div></div></header>
<main class="wrap">
<p class="eyb">Lo que hay que saber</p><ul class="know">{''.join(f'<li><span>{k}</span></li>' for k in know)}</ul>
<div class="cards"><div><span>Alertas abiertas</span><b>{len(AB)}</b><small>{(A.estado == 'Justificada').sum()} justificadas no cuentan</small></div>
<div><span>Plata en juego</span><b>{ars(plata)}</b><small>Suma de las alertas abiertas</small></div>
<div><span>Nuevas en 7 días</span><b>{len(nuevas)}</b><small>{ars(nuevas.impacto.sum())} en juego</small></div>
<div><span>Repartos en 3 o más reglas</span><b>{len(reps3)}</b><small>{' · '.join(esc(repl(r)) for r in reps3.index[:4])}</small></div></div>
<section class="blk"><h2>{esc(top_r[1])} es la regla con más plata en juego</h2><p class="sub">Alertas abiertas por regla y quién tiene que actuar</p>
<table><thead><tr><th>Regla</th><th class=r>Abiertas</th><th class=r>En juego</th><th>Responsable</th></tr></thead><tbody>{filas_regla}
<tr><td><b>Total</b></td><td class=r><b>{len(AB)}</b></td><td class=r><b>{ars(plata)}</b></td><td></td></tr></tbody></table></section>
<section class="blk"><h2>Repartos que suman tres reglas o más</h2><p class="sub">Cuando un reparto aparece en reglas distintas, el problema es del reparto: se revisa completo con su supervisor</p>
<table><thead><tr><th>Reparto</th><th>Supervisor</th><th>Reglas</th><th class=r>Alertas</th><th class=r>En juego</th></tr></thead><tbody>{filas_rep}</tbody></table></section>
<section class="blk"><h2>Las 10 alertas de más plata en juego</h2><p class="sub">Con la acción que se pide a cada área</p>
<table><thead><tr><th>#</th><th>Qué pasó</th><th>Qué hacer</th><th class=r>En juego</th></tr></thead><tbody>{filas_top}</tbody></table></section>
<footer>Mismo criterio que el tablero (alertas.py y los SQL de la carpeta sql). Parámetros acordados; las justificadas (bonificaciones autorizadas y NC con respaldo) no cuentan como abiertas. Datos 100% ficticios.</footer>
</main></body></html>"""
os.makedirs(OUT, exist_ok=True)
path = os.path.join(OUT, "informe-control-gerencia.html")
with open(path, "w", encoding="utf-8") as fh:
    fh.write(doc)
print("ok ->", os.path.relpath(path, D), "|", len(AB), "abiertas,", ars(plata), "| repartos 3+:", list(reps3.index))
