"""Resumen del lunes: el mail que le llega al dueño cada lunes a las 8:00 con la semana de martes a domingo.
Mismas cuentas que el tablero (indicadores.py), cortadas al domingo. Sale en ../04_informes/resumen-semanal.html"""
import os, html
import pandas as pd
import indicadores as I

OUT = os.path.join(I.D, "..", "04_informes")
DOM = pd.Timestamp("2025-10-05")                       # domingo que cierra la semana del mail
MAR = DOM - pd.Timedelta(days=5)
c, v, p, cl = I.cargar()
c, v, p = c[c.fecha <= DOM], v[v.fecha <= DOM], p[p.fecha <= DOM]
I.CORTE = DOM                                          # las reglas de clientes se miden al domingo
x = I.cierre_diario(c)
sem = x[(x.fecha >= MAR) & (x.fecha <= DOM)]
ant = x[(x.fecha >= MAR - pd.Timedelta(days=7)) & (x.fecha <= DOM - pd.Timedelta(days=7))]
falt = [(d, l) for d, l in I.faltantes(c) if MAR <= d <= DOM]
sal = I.saldo_mayoristas(v, p).merge(cl[["id_cliente", "nombre"]], on="id_cliente")
est = I.estado_clientes(v, cl).set_index("id_cliente")

esc = html.escape
num = lambda n: f"{n:,.0f}".replace(",", ".")
ars = lambda n: ("−" if n < 0 else "") + "$ " + num(abs(n))
pct = lambda r: f"{r * 100:.1f}%".replace(".", ",")
DIA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
fd = lambda f: f"{DIA[f.dayofweek]} {f:%d/%m}"
venta, venta_a = sem.venta_total.sum(), ant.venta_total.sum()
cuadran, arq = int((sem.estado_caja == "Cuadra").sum()), int(sem.estado_caja.notna().sum())
faltante = -sem.diferencia[sem.diferencia < -I.TOL].sum()
fiado = sal[sal.saldo > 0].saldo.sum()
var = (venta - venta_a) / venta_a

# a quién llamar (mismas reglas que la pestaña Restaurantes y fiado)
llamar = []
for r in sal.itertuples():
    e = est.loc[r.id_cliente]
    if r.paga_menos:
        llamar.append((r.saldo * 1.5, r.nombre, "Paga menos de lo que compra", f"En 90 días compró {ars(r.vendido_90)} a cuenta y pagó {ars(r.cobrado_90)}. Pasarlo a contado hasta que baje el saldo de {ars(r.saldo)}."))
for i, e in est.iterrows():
    nom = cl.set_index("id_cliente").loc[i, "nombre"]
    s = sal.set_index("id_cliente").saldo.get(i, 0)
    if e.estado == "Dejó de comprar":
        llamar.append((max(s, 0) + 1e5, nom, "Dejó de comprar", f"No compra desde el {e.ultima:%d/%m} (compraba cada {e.intervalo:.0f} días)." + (f" Debe {ars(s)}." if s > 0 else "")))
    elif e.estado in ("En riesgo", "Compra menos seguido"):
        llamar.append((5e4, nom, e.estado, f"Última compra el {e.ultima:%d/%m}; compraba cada {e.intervalo:.0f} días." if e.estado == "En riesgo"
                       else f"En 6 semanas compró {e.compras_6sem} veces; por su ritmo le tocaban unas {42 / e.intervalo:.0f}."))
llamar.sort(key=lambda t: -t[0])

locales = []
for l in ("Centro", "Jardín"):
    s = sem[sem.local == l]
    locales.append(f"<tr><td>{l}</td><td>{ars(s.venta_total.sum())}</td><td class='h'>{num(s.tickets.sum())}</td><td class='h'>{ars(s.venta_total.sum() / s.tickets.sum())}</td>"
                   f"<td>{int((s.estado_caja == 'Cuadra').sum())} de {len(s)}</td><td>{ars(-s.diferencia[s.diferencia < -I.TOL].sum())}</td></tr>")
difs = sem[sem.estado_caja.isin(["Faltante", "Sobrante"])].sort_values("diferencia")
CSS = """
:root{--bg:#f6f1ea;--surface:#fff;--line:#ebe3d8;--ink:#1f1712;--ink-2:#4b3f35;--ink-3:#6e6155;--band:#7c2d1b;--accent:#e3a530;--link:#1d6a72;
--good-ink:#16703f;--good-bg:#e3f3e6;--warn-ink:#7a5000;--warn-bg:#fcefd2;--crit-ink:#a82a2a;--crit-bg:#fbe6e6;--top:#7c2d1b;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#14100d;--surface:#1c1713;--line:#342b24;--ink:#f4ede5;--ink-2:#cdbfb1;--ink-3:#a09284;--band:#4d1c10;--link:#6cc3cc;
--good-ink:#53cc7a;--good-bg:#14301f;--warn-ink:#f2c14e;--warn-bg:#3a2f12;--crit-ink:#f07c7c;--crit-bg:#3b1b1c;--top:#e9b04a;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:400 15px/1.5 "Work Sans",Arial,sans-serif;font-variant-numeric:tabular-nums}
.mail{max-width:660px;margin:0 auto;padding:16px}
.meta{font-size:12.5px;color:var(--ink-3);margin:4px 2px 10px}
.top{background:var(--band);color:#fff;border-radius:14px 14px 0 0;padding:18px 20px 16px;border-bottom:5px solid var(--accent)}
.brand{display:flex;gap:10px;align-items:center;font:600 11.5px/1.2 "Work Sans",Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#f2d8c6}
.logo{width:30px;height:30px;border-radius:50%;background:var(--accent);color:#2b1a08;display:inline-grid;place-items:center;font:700 13px/1 "Fraunces",Georgia,serif}
h1{font:700 24px/1.15 "Fraunces",Georgia,serif;margin:10px 0 2px}.top p{margin:0;color:#f2d8c6;font-size:13.5px}
.body{background:var(--surface);border:1px solid var(--line);border-top:0;border-radius:0 0 14px 14px;padding:18px 20px 22px}
h2{font:700 18px/1.25 "Fraunces",Georgia,serif;margin:22px 0 8px}
ul.k{margin:0 0 6px;padding-left:18px;display:flex;flex-direction:column;gap:5px}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0 4px}
.card{border:1px solid var(--line);border-top:3px solid var(--top);border-radius:10px;padding:10px 12px;min-width:0}
.card>span{display:block;font-size:12.5px;color:var(--ink-3);font-weight:600}.card b{display:block;font:700 21px/1.2 "Fraunces",Georgia,serif;white-space:nowrap}
.card small{font-size:12px;color:var(--ink-2)}
table{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px;border:1px solid var(--line);border-radius:10px;overflow:hidden}
th{background:var(--band);color:#fff;font:700 11px/1.3 "Work Sans",Arial,sans-serif;text-transform:uppercase;letter-spacing:.05em;padding:8px;text-align:right}
td{padding:8px;border-top:1px solid var(--line);text-align:right}th:first-child,td:first-child{text-align:left}td.l{text-align:left}
.st{display:inline-block;font:700 11px/1 "Work Sans",Arial,sans-serif;padding:4px 8px;border-radius:20px}.crit{color:var(--crit-ink);background:var(--crit-bg)}.warn{color:var(--warn-ink);background:var(--warn-bg)}.good{color:var(--good-ink);background:var(--good-bg)}
.al{border:1px solid var(--line);border-left:5px solid #c0392b;border-radius:10px;padding:10px 12px;margin-bottom:8px}.al b{font:700 15px/1.3 "Fraunces",Georgia,serif}.al p{margin:2px 0 0;font-size:13.5px;color:var(--ink-2)}
.btn{display:inline-block;background:var(--band);color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:9px;margin-top:16px}
.foot{font-size:12px;color:var(--ink-3);margin:12px 4px}
@media (max-width:520px){.mail{padding:10px}.body{padding:14px 12px 18px}.cards{grid-template-columns:1fr 1fr}td.h,th.h{display:none}th,td{padding:7px 5px;font-size:12.5px}}
"""
doc = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Resumen del lunes · Pastas Don Aldo</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Work+Sans:wght@400;600;700&display=swap">
<style>{CSS}</style></head><body><div class="mail">
<p class="meta">Así llega el mail del lunes 06/10 a las 8:00 (apps_script/resumen_semanal.gs, con las vistas de Supabase). Esta copia la arma build_informe.py con los mismos datos · datos ficticios</p>
<div class="top"><div class="brand"><span class="logo">DA</span>Pastas Don Aldo</div><h1>Tu semana, del martes {MAR:%d/%m} al domingo {DOM:%d/%m}</h1><p>Los dos locales y los restaurantes, en un minuto.</p></div>
<div class="body">
<ul class="k">
<li>Vendiste <b>{ars(venta)}</b>, {pct(abs(var))} {'más' if var >= 0 else 'menos'} que la semana anterior.</li>
<li>La caja cuadró <b>{cuadran} de {arq} cierres</b>; faltaron {ars(faltante)}{f"; el mayor faltante, {ars(-difs.iloc[0].diferencia)}, fue en el {difs.iloc[0].local} el {fd(difs.iloc[0].fecha)} ({esc(difs.iloc[0].responsable)})" if len(difs) and difs.iloc[0].diferencia < -2000 else ""}.</li>
<li>{f"<b>No se cargó el cierre</b> del {', '.join(f'{fd(d)} en {l}' for d, l in falt)}." if falt else "Se cargaron todos los cierres."}</li>
<li>Los restaurantes te deben <b>{ars(fiado)}</b>. Abajo, a quién llamar.</li></ul>
<div class="cards"><div class="card"><span>Venta de la semana</span><b>{ars(venta)}</b><small>{'+' if var >= 0 else '−'}{pct(abs(var))} vs semana anterior</small></div>
<div class="card"><span>Caja que cuadró</span><b>{cuadran} de {arq}</b><small><span class="st {'good' if cuadran / arq >= 0.8 else 'crit'}">{'En línea' if cuadran / arq >= 0.8 else 'Desvío'}</span> objetivo 8 de 10</small></div>
<div class="card"><span>Fiado</span><b>{ars(fiado)}</b><small>{int((sal.saldo > 0).sum())} restaurantes</small></div></div>
<h2>Por local</h2><table><thead><tr><th>Local</th><th>Venta</th><th class="h">Tickets</th><th class="h">Ticket prom.</th><th>Caja cuadró</th><th>Faltó</th></tr></thead><tbody>{''.join(locales)}</tbody></table>
<h2>Cierres con diferencia</h2>{'<table><thead><tr><th>Día</th><th class="h">Local</th><th>Responsable</th><th>Diferencia</th></tr></thead><tbody>' + ''.join(f"<tr><td>{fd(r.fecha)}</td><td class='h'>{r.local}</td><td>{esc(r.responsable)}</td><td><span class='st {'crit' if r.diferencia < 0 else 'warn'}'>{'−' if r.diferencia < 0 else '+'}$ {num(abs(r.diferencia))}</span></td></tr>" for r in difs.itertuples()) + '</tbody></table>' if len(difs) else '<p>Todas las cajas cuadraron.</p>'}
<h2>A quién llamar</h2>{''.join(f'<div class="al"><b>{esc(n)}</b> · <span class="st {"crit" if t in ("Dejó de comprar", "Paga menos de lo que compra") else "warn"}">{t}</span><p>{esc(d)}</p></div>' for _, n, t, d in llamar[:5])}
<a class="btn" href="../03_tableros/caja-y-clientes.html">Abrir el tablero</a>
</div><p class="foot">Mismas cuentas que el tablero: la caja cuadra si la diferencia es de $ 500 o menos; el fiado descuenta lo cobrado de lo más viejo.</p></div></body></html>"""
os.makedirs(OUT, exist_ok=True)
path = os.path.join(OUT, "resumen-semanal.html")
with open(path, "w", encoding="utf-8") as fh:
    fh.write(doc)
print(f"ok -> {os.path.relpath(path, I.D)} · venta {ars(venta)} ({var:+.1%}) · caja {cuadran}/{arq} · faltó {ars(faltante)} · sin cargar {falt} · llamar {[t[1] + ' · ' + t[2] for t in llamar[:5]]}")
