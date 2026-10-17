"""Caso 02 · reglas de la hoja de trabajo semanal (misma lógica que el tablero, en Python).

Uso:  python hoja.py          → imprime el resumen de cada semana con los parámetros por defecto
      from hoja import armar   → para el informe de supervisores y las verificaciones

Foco de cada cuenta el lunes (se asigna el primero que cumple, en este orden):
  1 deuda   vencido a más de {dias} días ≥ piso
  2 visita  saldo ≥ piso y sin visita del reparto hace más de {sin_visita} días
  3 ritmo   días desde el último pago > factor × su intervalo habitual entre pagos (y al menos 14), con saldo ≥ piso
  4 nc      notas de crédito del último mes ≥ piso_nc y > pct_nc de su facturación mensual habitual
Cómo terminó la semana (lunes a sábado, o al corte si la semana está en curso):
  deuda   pagó todo lo vencido → resuelta · pagó algo → en parte · sin pago pero lo vencido bajó del piso → salió sola
  visita  hubo visita y pago → resuelta · hubo visita sin pago → en parte · el saldo bajó del piso → salió sola
  ritmo   pagó al menos el 80% de su pago habitual → resuelta · pagó menos → en parte
  nc      administración revisó la nota de crédito → resuelta
  resto   pendiente: pasa a la hoja del lunes siguiente si sigue cumpliendo
Nuevas: no estaban el lunes y al cierre de la semana cumplen alguna condición.
"""
import os, json
import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
PARAMS = {"dias": 45, "piso": 15000, "factor": 2.0, "sin_visita": 14, "piso_nc": 20000, "pct_nc": 0.5, "objetivo": 0.45}
FOCOS = ["deuda", "visita", "ritmo", "nc"]
ESTADOS = ["resuelta", "parte", "pendiente", "sola"]


def cargar():
    with open(os.path.join(D, "..", "01_datos", "dashboard_data.json"), encoding="utf-8") as fh:
        return json.load(fh)


def armar(data, w, p=PARAMS):
    """Hoja de la semana w (índice en meta.semanas). Devuelve listas por cuenta: foco (o None), estado, nueva, cobrado."""
    C = {c: i for i, c in enumerate(data["cols"])}
    F = np.array(data["f"][w])
    k = data["meta"]["umbrales"].index(p["dias"])
    g = lambda n: F[:, C[n]]
    vd, saldo, dup, imed, duv = g(["v30", "v45", "v60", "v90"][k]), g("saldo"), g("dup"), g("imed"), g("duv")
    c_deuda = vd >= p["piso"]
    c_ritmo = (imed > 0) & (dup > np.maximum(p["factor"] * imed, 14)) & (saldo >= p["piso"])
    c_visita = (saldo >= p["piso"]) & ((duv > p["sin_visita"]) | (duv < 0))
    c_nc = (g("nc30") >= p["piso_nc"]) & (g("nc30") > p["pct_nc"] * g("fac6"))
    foco = np.select([c_deuda, c_visita, c_ritmo, c_nc], [0, 1, 2, 3], -1)
    pag, vis, rev = g("pag"), g("vis"), g("rev")
    e_vd = g(["e_v30", "e_v45", "e_v60", "e_v90"][k])
    est = np.full(len(F), 2)                                                  # pendiente
    m = foco == 0
    est[m & (pag >= vd)] = 0
    est[m & (pag > 0) & (pag < vd)] = 1
    est[m & (pag == 0) & (e_vd < p["piso"])] = 3
    m = foco == 1
    est[m & (vis == 1) & (pag > 0)] = 0
    est[m & (vis == 1) & (pag == 0)] = 1
    est[m & (vis == 0) & (g("e_saldo") < p["piso"])] = 3
    m = foco == 2
    est[m & (pag >= 0.8 * g("pmed"))] = 0
    est[m & (pag > 0) & (pag < 0.8 * g("pmed"))] = 1
    m = foco == 3
    est[m & (rev == 1)] = 0
    est[foco < 0] = -1
    e_saldo, e_dup, e_duv = g("e_saldo"), g("e_dup"), g("e_duv")
    nueva = (foco < 0) & ((e_vd >= p["piso"])
                          | ((imed > 0) & (e_dup > np.maximum(p["factor"] * imed, 14)) & (e_saldo >= p["piso"]))
                          | ((e_saldo >= p["piso"]) & ((e_duv > p["sin_visita"]) | (e_duv < 0)))
                          | ((g("e_nc30") >= p["piso_nc"]) & (g("e_nc30") > p["pct_nc"] * g("fac6"))))
    cobrado = np.where(foco >= 0, pag, 0)
    return foco, est, nueva, cobrado


if __name__ == "__main__":
    data = cargar()
    for w, s in enumerate(data["meta"]["semanas"]):
        foco, est, nueva, cob = armar(data, w)
        n = int((foco >= 0).sum())
        res = int(((est == 0) | (est == 1)).sum())
        print(f"Sem {s['sem']} {'(en curso)' if s['en_curso'] else '          '} hoja {n:5d} · resueltas {int((est==0).sum()):4d} · en parte {int((est==1).sum()):4d} · "
              f"pendientes {int((est==2).sum()):4d} · solas {int((est==3).sum()):4d} · nuevas {int(nueva.sum()):4d} · "
              f"con resultado {res / max(n,1):.1%} · cobrado $ {cob.sum()/1e6:,.1f} M · por foco {[int((foco==i).sum()) for i in range(4)]}")
