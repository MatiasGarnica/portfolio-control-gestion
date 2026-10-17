"""Medidas SVG (DAX que devuelve una imagen) para el informe Power BI del Caso 01.

Cada plantilla se escribe una sola vez como lista de segmentos (texto fijo o variable DAX). Con eso:
  (a) .dax()     arma la expresión DAX que va al modelo, y
  (b) .render()  dibuja el mismo SVG con números calculados en Python, para revisarlo antes de abrir Power BI.
Reglas: atributos SVG con comillas simples, colores hex con # (sin %23), coordenadas con FORMAT(..., "en-US")
(punto decimal) y textos con FORMAT(..., "es-AR") (coma decimal); signo menos tipográfico (−).
"""
import math

NAVY, RED, BLUE, GRAY, ORANGE, AA = "#13294B", "#C8102E", "#1F5BB5", "#98A2AE", "#EB6834", "#C5CBD3"
INK, INK2, INK3, LINE = "#111A24", "#3F4B58", "#6B7682", "#E1E5EA"
GOOD, WARN, CRIT = ("#16703F", "#E3F3E6"), ("#8A5A00", "#FCEFD2"), ("#B42318", "#FDE8E7")
FONT = "Segoe UI"
SVG0 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' "


class Seg:
    """Plantilla SVG: segmentos de texto fijo ('l') o variables DAX ('v')."""
    def __init__(self): self.p = []
    def l(self, s): self.p.append(("l", s)); return self
    def v(self, name): self.p.append(("v", name)); return self
    def dax(self):
        out = []
        for k, x in self.p:
            if k == "l" and out and out[-1][0] == "l": out[-1] = ("l", out[-1][1] + x)
            else: out.append((k, x))
        return " & ".join('"' + x.replace('"', '""') + '"' if k == "l" else x for k, x in out)
    def render(self, vals): return "".join(x if k == "l" else str(vals[x]) for k, x in self.p)


def T(x, y, size, color, weight=400, anchor=None, extra=""):
    a = f" text-anchor='{anchor}'" if anchor else ""
    w = f" font-weight='{weight}'" if weight != 400 else ""
    return f"<text x='{x}' y='{y}'{a} font-family='{FONT}' font-size='{size}'{w} fill='{color}'{extra}>"


# ---------------------------------------------------------------- formato: DAX y su espejo en Python
def F_MONEY(x): return f'"$ " & FORMAT({x} / 1000000, "#,##0.0", "es-AR") & " M"'
def F_SMONEY(x): return f'IF({x} < 0, "−", "+") & "$ " & FORMAT(ABS({x}) / 1000000, "#,##0.0", "es-AR") & " M"'
def F_PCT(x): return f'SUBSTITUTE(FORMAT({x}, "0.0%", "es-AR"), "-", "−")'
def F_SPCT(x): return f'SUBSTITUTE(FORMAT({x}, "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−")'
def F_PP(x): return f'SUBSTITUTE(FORMAT(({x}) * 100, "+0.0;-0.0;0.0", "es-AR"), "-", "−") & " pp"'
def F_PP2(x): return f'SUBSTITUTE(FORMAT(({x}) * 100, "+0.00;-0.00;0.00", "es-AR"), "-", "−") & " pp"'
def F_SINT(x): return f'SUBSTITUTE(FORMAT({x}, "+#,##0;-#,##0;0", "es-AR"), "-", "−")'
def F_NUM(x): return f'FORMAT({x}, "0.0", "en-US")'
VALFMT = {"money": F_MONEY, "pct": F_PCT, "money0": lambda x: f'"$ " & FORMAT({x}, "#,##0", "es-AR")',
          "ratio2": lambda x: f'FORMAT({x}, "0.00%", "es-AR")', "int": lambda x: f'FORMAT({x}, "#,##0", "es-AR")',
          "num": lambda x: f'IF({x} = INT({x}), FORMAT({x}, "#,##0", "es-AR"), FORMAT({x}, "#,##0.0", "es-AR"))'}


def es(v, d=1):
    s = f"{abs(v):,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("-" if v < 0 and round(abs(v), d) != 0 else "") + s
def p_money(x): return "$ " + es(x / 1e6) + " M"
def p_smoney(x): return ("−" if x < 0 else "+") + "$ " + es(abs(x) / 1e6) + " M"
def p_pct(x): return es(x * 100).replace("-", "−") + "%"
def p_signed(v, d, suf=""):
    if round(v, d) == 0: return es(0, d) + suf
    return ("+" if v > 0 else "−") + es(abs(v), d) + suf
def p_spct(x): return p_signed(x * 100, 1, "%")
def p_pp(x): return p_signed(x * 100, 1) + " pp"
def p_pp2(x): return p_signed(x * 100, 2) + " pp"
def p_sint(x): return p_signed(x, 0)
P_VALFMT = {"money": p_money, "pct": p_pct, "money0": lambda x: "$ " + es(x, 0), "ratio2": lambda x: es(x * 100, 2) + "%",
            "int": lambda x: es(x, 0), "num": lambda x: es(x, 0) if x == int(x) else es(x, 1)}
P_CMP = {"pct": lambda c, r, m: p_spct((c - r) / abs(r)) + ((" · " + p_smoney(c - r)) if m else ""), "pp": lambda c, r, m: p_pp(c - r),
         "pp2": lambda c, r, m: p_pp2(c - r), "int": lambda c, r, m: p_sint(c - r)}
# diferencia que, redondeada, se ve como cero: va en gris (ni verde ni rojo)
NEUTRO = {"pct": 0.0005, "pp": 0.0005, "pp2": 0.00005, "int": 0.5}


# ---------------------------------------------------------------- tarjeta KPI
def _status_thr(kind): return {"pct": -0.05, "pp": -0.01, "pp2": -0.002, "int": -2}[kind]


def kpi_card(label, value, fmt, comps, series=None, cum=False, w=240, h=150):
    """Tarjeta KPI: filete de marca, etiqueta, estado, valor, 3 comparaciones con color y tendencia del año.
    comps: [(texto, actual, referencia, tipo 'pct'|'pp'|'int', con_monto, sube_es_bueno True|False|None)]
    series: (real_mes, presupuesto_mes, forecast_mes) medidas mensuales; cum=True las acumula (cierre del año)."""
    V = ["VAR _v = " + value]
    for k, (lbl, cur, ref, kind, absm, up) in enumerate(comps):
        V += [f"VAR _c{k} = {cur}", f"VAR _r{k} = {ref}", f"VAR _d{k} = _c{k} - _r{k}"]
        if kind == "pct":
            txt = f'IF(ISBLANK(_r{k}) || _r{k} = 0 || ISBLANK(_c{k}), "—", {F_SPCT(f"DIVIDE(_d{k}, ABS(_r{k}))")}' + (f' & " · " & {F_SMONEY(f"_d{k}")}' if absm else "") + ")"
        elif kind == "pp": txt = f'IF(ISBLANK(_r{k}) || ISBLANK(_c{k}), "—", {F_PP(f"_d{k}")})'
        elif kind == "pp2": txt = f'IF(ISBLANK(_r{k}) || ISBLANK(_c{k}), "—", {F_PP2(f"_d{k}")})'
        else: txt = f'IF(ISBLANK(_r{k}) || ISBLANK(_c{k}), "—", {F_SINT(f"_d{k}")})'
        mag = f"ABS(DIVIDE(_d{k}, ABS(_r{k})))" if kind == "pct" else f"ABS(_d{k})"
        if up is None: col = f'"{INK2}"'
        else: col = (f'IF(ISBLANK(_r{k}) || ISBLANK(_c{k}), "{INK3}", IF({mag} < {NEUTRO[kind]}, "{INK3}", '
                     f'IF({"" if up else "-1 * "}_d{k} >= 0, "{GOOD[0]}", "{CRIT[0]}")))')
        V += [f"VAR _t{k} = {txt}", f"VAR _k{k} = {col}"]
    lbl0, cur0, ref0, kind0, absm0, up0 = comps[0]
    if up0 is None: V += ["VAR _st = 0"]
    else:
        e = f"DIVIDE(_d0, ABS(_r0))" if kind0 == "pct" else "_d0"
        V += [f"VAR _e = {'' if up0 else '-1 * '}{e}", f"VAR _st = IF(ISBLANK(_r0) || ISBLANK(_c0), 0, IF(_e >= 0, 1, IF(_e >= {_status_thr(kind0)}, 2, 3)))"]
    V += ['VAR _stT = SWITCH(_st, 1, "En línea", 2, "Atención", 3, "Desvío", "")',
          f'VAR _stF = SWITCH(_st, 1, "{GOOD[1]}", 2, "{WARN[1]}", 3, "{CRIT[1]}", "#FFFFFF")',
          f'VAR _stK = SWITCH(_st, 1, "{GOOD[0]}", 2, "{WARN[0]}", 3, "{CRIT[0]}", "#FFFFFF")',
          "VAR _stW = LEN(_stT) * 5.4 + 16", f"VAR _stX = {F_NUM(f'{w - 12} - _stW')}", f"VAR _stTX = {F_NUM(f'{w - 12} - _stW / 2')}", f"VAR _stWW = {F_NUM('_stW')}",
          f"VAR _val = IF(ISBLANK(_v), \"—\", {VALFMT[fmt]('_v')})"]
    g = Seg()
    g.l(SVG0 + f"viewBox='0 0 {w} {h}' width='{w}' height='{h}'>")
    g.l(f"<rect x='0.5' y='0.5' width='{w - 1}' height='{h - 1}' rx='8' fill='#FFFFFF' stroke='{LINE}'/>")
    g.l(f"<path d='M0.5 8.5 Q0.5 0.5 8.5 0.5 H{w - 8.5} Q{w - 0.5} 0.5 {w - 0.5} 8.5 V3.5 H0.5 Z' fill='{NAVY}'/>")
    g.l(T(14, 26, 11.5, INK2, 600) + f"{label}</text>")
    g.l("<rect x='").v("_stX").l("' y='13' width='").v("_stWW").l("' height='17' rx='8.5' fill='").v("_stF").l("'/>")
    g.l("<text x='").v("_stTX").l(f"' y='25' text-anchor='middle' font-family='{FONT}' font-size='9.5' font-weight='600' fill='").v("_stK").l("'>").v("_stT").l("</text>")
    g.l(T(14, 57, 25, INK, 700)).v("_val").l("</text>")
    y0, dy = 77, 14
    for k, c in enumerate(comps):
        y = y0 + k * dy
        g.l(T(14, y, 10.5, INK3) + f"{c[0]}</text>")
        g.l(f"<text x='{w - 14}' y='{y}' text-anchor='end' font-family='{FONT}' font-size='10.5' font-weight='600' fill='").v(f"_k{k}").l("'>").v(f"_t{k}").l("</text>")
    if series:
        top = y0 + (len(comps) - 1) * dy + 9
        V += spark_vars(series, cum, x0=14, wpx=w - 28, y0=top, hpx=h - 9 - top)
        g.l(f"<line x1='14' y1='{h - 9}' x2='{w - 14}' y2='{h - 9}' stroke='{LINE}' stroke-width='1'/>")
        g.l("<polyline points='").v("_ptsP").l(f"' fill='none' stroke='{GRAY}' stroke-width='1.3' stroke-dasharray='3 2.5'/>")
        g.l("<polyline points='").v("_ptsF").l(f"' fill='none' stroke='{ORANGE}' stroke-width='1.5' stroke-dasharray='4 2.5'/>")
        g.l("<polyline points='").v("_ptsR").l(f"' fill='none' stroke='{NAVY}' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/>")
        g.l("<circle cx='").v("_cx").l("' cy='").v("_cy").l(f"' r='3.2' fill='#FFFFFF' stroke='{NAVY}' stroke-width='2'/>")
    g.l("</svg>")
    return "\n".join(V) + "\nRETURN\n    " + g.dax(), g


def spark_vars(series, cum, x0, wpx, y0, hpx):
    """Tendencia del año de análisis: real hasta el corte, forecast desde el último real, presupuesto todo el año.
    El punto marca el mes elegido (o el cierre de diciembre si es acumulada)."""
    R, P, F = series
    V = ["VAR _corte = [Índice de corte]", "VAR _hsel = [Índice hasta]", "VAR _anio = [Año de análisis]",
         f'VAR _g0 = ADDCOLUMNS(FILTER(ALL(Calendario[indice], Calendario[anio]), Calendario[anio] = _anio), "@r0", {R}, "@p0", {P}, "@f0", {F or "BLANK()"})']
    if cum:
        V += ['VAR _g = ADDCOLUMNS(_g0,',
              '    "@r", VAR i = Calendario[indice] RETURN IF(i <= _corte, SUMX(FILTER(_g0, Calendario[indice] <= i), [@r0])),',
              '    "@p", VAR i = Calendario[indice] RETURN SUMX(FILTER(_g0, Calendario[indice] <= i), [@p0]),',
              '    "@f", VAR i = Calendario[indice] RETURN IF(i > _corte, SUMX(FILTER(_g0, Calendario[indice] <= _corte), [@r0]) + SUMX(FILTER(_g0, Calendario[indice] > _corte && Calendario[indice] <= i), [@f0])))']
    else:
        V += ['VAR _g = ADDCOLUMNS(_g0, "@r", IF(Calendario[indice] <= _corte, [@r0]), "@p", [@p0], "@f", IF(Calendario[indice] > _corte, [@f0]))']
    X = lambda i: f"{x0} + ({i} - _gi0) * {wpx} / 11"
    Y = lambda v: f"{y0 + hpx} - ({v} - _gmn) / _grg * {hpx}"
    V += ["VAR _gi0 = MINX(_g, Calendario[indice])",
          "VAR _gr = FILTER(_g, NOT(ISBLANK([@r])))", "VAR _gp = FILTER(_g, NOT(ISBLANK([@p])))",
          "VAR _grc = MAXX(_gr, Calendario[indice])", "VAR _gvc = MAXX(FILTER(_gr, Calendario[indice] = _grc), [@r])",
          'VAR _gf = ADDCOLUMNS(FILTER(_g, Calendario[indice] = _grc || (Calendario[indice] > _grc && NOT(ISBLANK([@f])))), "@v", IF(Calendario[indice] = _grc, _gvc, [@f]))',
          'VAR _gall = FILTER(UNION(SELECTCOLUMNS(_gr, "v", [@r]), SELECTCOLUMNS(_gp, "v", [@p]), SELECTCOLUMNS(_gf, "v", [@v])), NOT(ISBLANK([v])))',
          "VAR _gmn = MINX(_gall, [v])", "VAR _gmx = MAXX(_gall, [v])", "VAR _grg = IF(_gmx - _gmn = 0, 1, _gmx - _gmn)",
          f'VAR _ptsR = CONCATENATEX(_gr, {F_NUM(X("Calendario[indice]"))} & "," & {F_NUM(Y("[@r]"))}, " ", Calendario[indice], ASC)',
          f'VAR _ptsP = CONCATENATEX(_gp, {F_NUM(X("Calendario[indice]"))} & "," & {F_NUM(Y("[@p]"))}, " ", Calendario[indice], ASC)',
          f'VAR _ptsF = IF(COUNTROWS(_gf) > 1, CONCATENATEX(_gf, {F_NUM(X("Calendario[indice]"))} & "," & {F_NUM(Y("[@v]"))}, " ", Calendario[indice], ASC), "")']
    if cum:
        V += ["VAR _di = IF(COUNTROWS(_gf) > 1, MAXX(_gf, Calendario[indice]), _grc)",
              "VAR _dv = IF(COUNTROWS(_gf) > 1, MAXX(FILTER(_gf, Calendario[indice] = _di), [@v]), _gvc)"]
    else:
        V += ["VAR _di = IF(_hsel <= _grc, _hsel, _grc)", "VAR _dv = MAXX(FILTER(_gr, Calendario[indice] = _di), [@r])"]
    V += [f"VAR _cx = {F_NUM(X('_di'))}", f"VAR _cy = {F_NUM(Y('_dv'))}"]
    return V


def card_preview(value, fmt, comps, series=None, cum=False, corte=9, hsel=9, w=240, h=150):
    """Mismo cálculo que kpi_card, en Python. comps: [(actual, referencia, tipo, con_monto, sube_es_bueno)].
    series: (lista real 12 meses con None, presupuesto 12, forecast 12 o None)."""
    o = {}
    for k, (c, r, kind, m, up) in enumerate(comps):
        bad = r is None or c is None or (kind == "pct" and r == 0)
        o[f"_t{k}"] = "—" if bad else P_CMP[kind](c, r, m)
        mag = None if bad else (abs((c - r) / abs(r)) if kind == "pct" else abs(c - r))
        o[f"_k{k}"] = INK2 if up is None else (INK3 if bad or mag < NEUTRO[kind] else (GOOD[0] if (c - r) * (1 if up else -1) >= 0 else CRIT[0]))
    c, r, kind, m, up = comps[0]
    st = 0
    if up is not None and r is not None and c is not None:
        e = ((c - r) / abs(r) if kind == "pct" else c - r) * (1 if up else -1)
        st = 1 if e >= 0 else (2 if e >= _status_thr(kind) else 3)
    o["_stT"] = {1: "En línea", 2: "Atención", 3: "Desvío"}.get(st, "")
    o["_stF"] = {1: GOOD[1], 2: WARN[1], 3: CRIT[1]}.get(st, "#FFFFFF"); o["_stK"] = {1: GOOD[0], 2: WARN[0], 3: CRIT[0]}.get(st, "#FFFFFF")
    sw = len(o["_stT"]) * 5.4 + 16
    o["_stX"], o["_stTX"], o["_stWW"] = f"{w - 12 - sw:.1f}", f"{w - 12 - sw / 2:.1f}", f"{sw:.1f}"
    o["_val"] = "—" if value is None else P_VALFMT[fmt](value)
    if series:
        R, Pp, F = series
        F = F or [None] * 12
        if cum:
            rr = [sum(R[:i + 1]) if i < corte else None for i in range(12)]
            pp = [sum(Pp[:i + 1]) for i in range(12)]
            ff = [sum(R[:corte]) + sum(F[corte:i + 1]) if i >= corte else None for i in range(12)]
        else:
            rr = [R[i] if i < corte else None for i in range(12)]; pp = list(Pp); ff = [F[i] if i >= corte else None for i in range(12)]
        rc = max(i for i in range(12) if rr[i] is not None); vc = rr[rc]
        tf = [(rc, vc)] + [(i, ff[i]) for i in range(rc + 1, 12) if ff[i] is not None]
        allv = [v for v in rr if v is not None] + pp + [v for _, v in tf]
        mn, mx = min(allv), max(allv); rg = (mx - mn) or 1
        top = 77 + (len(comps) - 1) * 14 + 9; hp = h - 9 - top; x0, wp = 14, w - 28
        X = lambda i: x0 + i * wp / 11; Y = lambda v: top + hp - (v - mn) / rg * hp
        pts = lambda L: " ".join(f"{X(i):.1f},{Y(v):.1f}" for i, v in L)
        o["_ptsR"] = pts([(i, v) for i, v in enumerate(rr) if v is not None]); o["_ptsP"] = pts(list(enumerate(pp)))
        o["_ptsF"] = pts(tf) if len(tf) > 1 else ""
        di, dv = (tf[-1] if (cum and len(tf) > 1) else ((hsel - 1, rr[hsel - 1]) if hsel - 1 <= rc else (rc, vc)))
        o["_cx"], o["_cy"] = f"{X(di):.1f}", f"{Y(dv):.1f}"
    return o


# ---------------------------------------------------------------- encabezado de página
def header(title, sub):
    V = ["VAR _per = [Período largo]", "VAR _al = [Datos al]", 'VAR _vista = IF([Índice desde] = [Índice hasta], "Vista mensual", "Acumulado del año")']
    g = Seg()
    g.l(SVG0 + "viewBox='0 0 1280 64' width='1280' height='64'>")
    g.l(f"<rect width='1280' height='60' fill='{NAVY}'/><rect y='60' width='1280' height='4' fill='{RED}'/>")
    g.l(f"<rect x='24' y='14' width='32' height='32' rx='7' fill='{RED}'/>" + T(40, 35, 13, "#FFFFFF", 700, "middle") + "CS</text>")
    g.l(T(70, 25, 10, "#B9C6DA", 600, extra=" letter-spacing='1.3'") + "COBRANZAS DEL SUR S.A.  ·  CONTROL DE GESTIÓN  ·  DATOS FICTICIOS</text>")
    g.l(T(70, 48, 20, "#FFFFFF", 700) + title + f"<tspan font-size='12.5' font-weight='400' fill='#B9C6DA' dx='12'>{sub}</tspan></text>")
    g.l(T(1256, 30, 16, "#FFFFFF", 700, "end")).v("_per").l("</text>")
    g.l(T(1256, 48, 11, "#B9C6DA", 400, "end")).v("_vista").l(" · datos al ").v("_al").l(" · cifras en millones de pesos</text>")
    g.l("</svg>")
    return "\n".join(V) + "\nRETURN\n    " + g.dax(), g


def legend(w=356, h=40):
    g = Seg()
    g.l(SVG0 + f"viewBox='0 0 {w} {h}' width='{w}' height='{h}'>")
    x = 4
    items = [("bar", NAVY, "Real"), ("dash", GRAY, "Presupuesto"), ("dash", ORANGE, "Forecast"), ("dot", AA, "Año anterior")]
    for kind, col, txt in items:
        if kind == "bar": g.l(f"<rect x='{x}' y='14' width='12' height='12' rx='2' fill='{col}'/>")
        elif kind == "dash": g.l(f"<line x1='{x}' y1='20' x2='{x + 16}' y2='20' stroke='{col}' stroke-width='2.2' stroke-dasharray='4 2.5'/>")
        else: g.l(f"<line x1='{x}' y1='20' x2='{x + 16}' y2='20' stroke='{col}' stroke-width='2.2' stroke-dasharray='1.5 2.5' stroke-linecap='round'/>")
        tx = x + (17 if kind == "bar" else 21)
        g.l(T(tx, 24, 11, INK2) + txt + "</text>")
        x = tx + len(txt) * 6.1 + 16
    g.l("</svg>")
    return g.dax(), g


# ---------------------------------------------------------------- narrativa
def narrative(w=760, h=178):
    V = ["VAR _ing = [Ingresos · real]", "VAR _ip = [Ingresos · presupuesto]", "VAR _if = [Ingresos · forecast]", "VAR _iaa = [Ingresos · año anterior]",
         "VAR _mo = [Margen operativo % · real]", "VAR _mop = [Margen operativo % · presupuesto]", "VAR _un = [Utilidad neta · real]", "VAR _unp = [Utilidad neta · presupuesto]",
         "VAR _ci = [Cierre proyectado]", "VAR _pa = [Presupuesto anual]",
         'VAR _tab = ADDCOLUMNS(FILTER(VALUES(Cartera[code]), Cartera[code] <> "EST"), "@d", [Ingresos · real] - [Ingresos · presupuesto])',
         "VAR _neg = TOPN(3, FILTER(_tab, [@d] < 0), [@d], ASC)", "VAR _pos = TOPN(2, FILTER(_tab, [@d] > 0), [@d], DESC)",
         f'VAR _negT = IF(COUNTROWS(_neg) = 0, "ninguna", CONCATENATEX(_neg, Cartera[code] & " " & {F_SMONEY("[@d]")}, ", ", [@d], ASC))',
         f'VAR _posT = IF(COUNTROWS(_pos) = 0, "ninguna", CONCATENATEX(_pos, Cartera[code] & " " & {F_SMONEY("[@d]")}, ", ", [@d], DESC))',
         f"VAR _l1a = {F_MONEY('_ing')}", f"VAR _l1b = {F_SPCT('DIVIDE(_ing - _ip, _ip)')}", f"VAR _l1c = {F_SPCT('DIVIDE(_ing - _if, _if)')}",
         f"VAR _l1d = IF(ISBLANK(_iaa), \"—\", {F_SPCT('DIVIDE(_ing - _iaa, _iaa)')})",
         f"VAR _l2a = {F_PCT('_mo')}", f"VAR _l2b = {F_PP('_mo - _mop')}", f"VAR _l2c = {F_MONEY('_un')}", f"VAR _l2d = {F_SMONEY('_un - _unp')}",
         f"VAR _l5a = {F_MONEY('_ci')}", f"VAR _l5b = {F_SPCT('DIVIDE(_ci - _pa, ABS(_pa))')}",
         f'VAR _k1 = IF(_ing >= _ip, "{GOOD[0]}", "{CRIT[0]}")', f'VAR _k2 = IF(_mo >= _mop, "{GOOD[0]}", "{CRIT[0]}")', f'VAR _k5 = IF(_ci >= _pa, "{GOOD[0]}", "{CRIT[0]}")']
    g = Seg()
    g.l(SVG0 + f"viewBox='0 0 {w} {h}' width='{w}' height='{h}'>")
    g.l(f"<rect x='0.5' y='0.5' width='{w - 1}' height='{h - 1}' rx='8' fill='#FFFFFF' stroke='{LINE}'/>")
    g.l(f"<rect x='0.5' y='8' width='3.5' height='{h - 16}' fill='{RED}'/>")
    g.l(T(18, 26, 12.5, NAVY, 700) + "Lo que hay que saber</text>")
    B = lambda var: ("b", var)
    lines = [("_k1", [("t", "Ingresos "), B("_l1a"), ("t", ": "), ("c", "_l1b"), ("t", " contra presupuesto, "), ("v", "_l1c"), ("t", " contra forecast y "), ("v", "_l1d"), ("t", " contra el año anterior.")]),
             ("_k2", [("t", "Margen operativo "), B("_l2a"), ("t", " ("), ("c", "_l2b"), ("t", " contra presupuesto); utilidad neta "), B("_l2c"), ("t", " ("), ("v", "_l2d"), ("t", ").")]),
             (CRIT[0], [("t", "Carteras más lejos del presupuesto: "), B("_negT"), ("t", ".")]),
             (GOOD[0], [("t", "Carteras por encima del presupuesto: "), B("_posT"), ("t", ".")]),
             ("_k5", [("t", "Cierre proyectado del año (real + forecast): utilidad "), B("_l5a"), ("t", ", "), ("c", "_l5b"), ("t", " contra el presupuesto anual.")])]
    for k, (dot, ln) in enumerate(lines):
        y = 54 + k * 25
        g.l(f"<circle cx='22' cy='{y - 4}' r='3.5' fill='")
        g.v(dot) if dot.startswith("_") else g.l(dot)
        g.l("'/>" + T(34, y, 12.5, INK))
        for kind, x in ln:
            if kind == "t": g.l(x)
            elif kind == "b": g.l(f"<tspan font-weight='700'>").v(x).l("</tspan>")
            elif kind == "c": g.l(f"<tspan font-weight='700' fill='").v(dot).l("'>").v(x).l("</tspan>")
            else: g.v(x)
        g.l("</text>")
    g.l("</svg>")
    return "\n".join(V) + "\nRETURN\n    " + g.dax(), g


# ---------------------------------------------------------------- celdas de tabla
def bullet_cell(actual, target, group, w=150, h=22):
    """Bala para tabla: barra real (azul marino) sobre la franja del presupuesto, con marca vertical en el presupuesto."""
    V = [f"VAR _a = {actual}", f"VAR _p = {target}",
         f"VAR _mx = MAXX(ALLSELECTED({group}), MAX({actual}, {target})) * 1.05",
         f"VAR _wa = {F_NUM(f'MAX(0, DIVIDE(_a, _mx)) * {w - 4}')}", f"VAR _wp = {F_NUM(f'MAX(0, DIVIDE(_p, _mx)) * {w - 4}')}",
         f"VAR _xp = {F_NUM(f'MAX(0, DIVIDE(_p, _mx)) * {w - 4} + 1')}",
         f'VAR _k = IF(_a >= _p, "{NAVY}", "{CRIT[0]}")', 'VAR _sort = FORMAT(_a, "000000000000")']
    g = Seg()
    g.l(SVG0 + f"viewBox='0 0 {w} {h}' width='{w}' height='{h}'><desc>").v("_sort").l("</desc>")
    g.l(f"<rect x='1' y='5' width='").v("_wp").l(f"' height='12' fill='#DDE2E8'/>")
    g.l(f"<rect x='1' y='8' width='").v("_wa").l("' height='6' fill='").v("_k").l("'/>")
    g.l("<rect x='").v("_xp").l(f"' y='3' width='2' height='16' fill='{INK}'/></svg>")
    return "\n".join(V) + f"\nRETURN\n    IF(HASONEVALUE({group}) && NOT(ISBLANK(_a)), " + g.dax() + ")", g


def pill_cell(value, group, w=64, h=20):
    V = [f"VAR _m = {value}", "VAR _k = IF(_m >= 0.25, 1, IF(_m >= 0.10, 2, 3))",
         f'VAR _f = SWITCH(_k, 1, "{GOOD[1]}", 2, "{WARN[1]}", "{CRIT[1]}")', f'VAR _c = SWITCH(_k, 1, "{GOOD[0]}", 2, "{WARN[0]}", "{CRIT[0]}")',
         f"VAR _t = {F_PCT('_m')}", 'VAR _sort = FORMAT(_m * 1000 + 100000, "000000000")']
    g = Seg()
    g.l(SVG0 + f"viewBox='0 0 {w} {h}' width='{w}' height='{h}'><desc>").v("_sort").l("</desc>")
    g.l(f"<rect x='1' y='2' width='{w - 2}' height='{h - 4}' rx='{(h - 4) / 2}' fill='").v("_f").l("'/>")
    g.l(f"<text x='{w / 2}' y='{h / 2 + 4}' text-anchor='middle' font-family='{FONT}' font-size='10.5' font-weight='700' fill='").v("_c").l("'>").v("_t").l("</text></svg>")
    return "\n".join(V) + f"\nRETURN\n    IF(HASONEVALUE({group}) && NOT(ISBLANK(_m)), " + g.dax() + ")", g
