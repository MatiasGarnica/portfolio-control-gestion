(() => {
'use strict';
const D = JSON.parse(document.getElementById('data').textContent);
const E = { REAL: 0, PPTO: 1, FCST: 2 };
const NI = D.items.length, NC = D.carteras.length;
const CORTE = D.meses.indexOf(D.meta.corte), Y25 = D.meses.indexOf('2025-01'), DIC = D.meses.indexOf('2025-12');
const MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const mlab = i => { const [y, m] = D.meses[i].split('-'); return MES[+m - 1] + '-' + y.slice(2); };
const range = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, k) => a + k);
const SEAS = [0.96,0.97,1.03,1.01,1.00,0.99,1.00,1.01,1.02,1.01,1.00,0.97];

/* ---------- cubo ---------- */
const cube = [[], [], []];
for (let k = 0; k < D.res.v.length; k++) {
  const e = D.res.e[k], m = D.res.m[k];
  let a = cube[e][m]; if (!a) a = cube[e][m] = new Float64Array((NC + 1) * NI);
  a[(D.res.c[k] + 1) * NI + D.res.i[k]] += D.res.v[k];
}
const KP = {}; D.kpi.forEach(r => KP[r[0] * 100 + r[1]] = { tc: r[2], ops: r[3], py: r[4], pos: r[5], horas: r[6], cop: r[7], csms: r[8], cmin: r[9], I: r[10], P: r[11] });
const kp = (e, m) => KP[e * 100 + m];
const DR = {}; D.drv.forEach(r => DR[r[0] * 10000 + r[1] * 100 + r[2]] = r);
const dr = (e, m, c) => DR[e * 10000 + m * 100 + c];
const IT = D.items;
const ITEM = Object.fromEntries(IT.map((x, i) => [x.item, i]));
const IND = ITEM['Indemnizaciones'];
const N1 = [...new Set(IT.map(x => x.n1))];
const N2 = [...new Set(IT.map(x => x.n2))];
const IN1 = Object.fromEntries(N1.map(n => [n, IT.flatMap((x, i) => x.n1 === n ? [i] : [])]));
const IN2 = Object.fromEntries(N2.map(n => [n, IT.flatMap((x, i) => x.n2 === n ? [i] : [])]));
const N2OF = Object.fromEntries(N1.map(n => [n, N2.filter(z => IT.find(x => x.n2 === z).n1 === n)]));
const ING = IN1[N1[0]];
const DIR = IT.flatMap((x, i) => x.tipo === 'Directo' && /^[23]/.test(x.n1) ? [i] : []);
const ASG = IT.flatMap((x, i) => x.tipo === 'Asignado' ? [i] : []);
const EST = IN1[N1[3]];
const TAXI = ITEM['Impuesto a las ganancias'];
const strip = s => s.replace(/^[\d.]+\s/, '');
const isUSDc = ci => ci >= 0 && D.carteras[ci].moneda === 'USD';
const GRP = (() => { const g = {}; const set = (l, k) => l.forEach(n => g[ITEM[n]] = k);
  set(['Ingreso por recupero', 'Comisiones por venta'], 'rev'); set(['Ingresos Brutos'], 'iibb');
  set(['Operadores', 'Supervisión', 'Calidad', 'Back Office', 'Ejecutivos de cuenta', 'Gerencia de Operaciones', 'Indemnizaciones', 'Remuneraciones staff'], 'rem');
  set(['Posiciones Paraguay', 'Licencias discador/CRM', 'Mailing', 'WhatsApp', 'Infraestructura TI (USD)'], 'usd');
  set(['Amortizaciones'], 'fix'); set(['Diferencia de cambio'], 'difc'); set(['Recupero gastos intercompany'], 'ic'); set(['Impuesto a las ganancias'], 'tax');
  return IT.map((_, i) => g[i] || 'inf'); })();

/* ---------- estado ---------- */
const S = { tab: 'resumen', m: CORTE, vista: 'mes', moneda: 'ARS', sinInd: false, ref: 'PPTO', metric: 'ing', estructura: false, ic: 'mixto',
  open: { [N1[1]]: true }, open2: {}, alertsAll: false, allCols: false, brand: 'rojoazul', det: 'page', more: false, allCar: false };
const TABS = ['resumen', 'eerr', 'carteras', 'sim', 'ppto', 'intercompany', 'cotizador', 'informes'];
try { const t = localStorage.getItem('cg-tab'); if (TABS.includes(t)) S.tab = t; const b = localStorage.getItem('cg-brand'); if (b) S.brand = b; const dm = localStorage.getItem('cg-det'); if (dm === 'page' || dm === 'panel') S.det = dm; } catch (e) {}
try { const h0 = location.hash.replace('#', ''); if (TABS.includes(h0)) S.tab = h0; } catch (e) {}
/* tema (claro por defecto) y tipografía */
const FONTS = { plex: ['IBM Plex Sans', 'IBM+Plex+Sans:wght@400;500;600;700'], source: ['Source Sans 3', 'Source+Sans+3:wght@400;500;600;700;800'], archivo: ['Archivo', 'Archivo:wght@400;500;600;700;800'] };
S.theme = 'light'; S.font = 'plex';
try { const th = localStorage.getItem('cg-theme'); if (th === 'dark' || th === 'light') S.theme = th; const fo = localStorage.getItem('cg-font'); if (FONTS[fo]) S.font = fo; } catch (e) {}
document.documentElement.dataset.theme = S.theme;
const fam = () => `"${FONTS[S.font][0]}","Helvetica Neue",Arial,sans-serif`;
function applyFont() { const st = document.documentElement.style, f = fam(); ['--f-display', '--f-body', '--f-mono'].forEach(k => st.setProperty(k, f)); }
function setTheme(v) { S.theme = v; try { localStorage.setItem('cg-theme', v); } catch (e) {} document.documentElement.dataset.theme = v; }

/* ---------- formato es-AR ---------- */
const _nf = {}; const nf = d => (_nf[d] ??= new Intl.NumberFormat('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const MINUS = '−';
const fixMinus = s => s.replace('-', MINUS);
const cur = () => S.moneda === 'USD' ? 'US$ ' : '$ ';
function money(v, { signed = false, full = false, pre = null } = {}) {
  const a = Math.abs(v); let s;
  if (full) s = nf(0).format(a);
  else if (a < 100 && Math.round(a) !== a) s = nf(2).format(a);
  else if (a >= 1e9) s = nf(0).format(a / 1e6) + ' M';
  else if (a >= 1e6) s = nf(1).format(a / 1e6) + ' M';
  else if (a >= 1e4) s = nf(1).format(a / 1e3) + ' mil';
  else s = nf(0).format(a);
  const sg = v > 0 ? (signed ? '+' : '') : v < 0 ? MINUS : '';
  return (a < 0.005 ? '' : sg) + (pre ?? cur()) + s;
}
const pct = (r, signed = true) => {
  if (!isFinite(r)) return 's/d';
  const x = Math.round(r * 1000) / 10; if (x === 0) return '0%';
  const s = nf(Math.abs(x) >= 100 ? 0 : 1).format(Math.abs(x)) + '%';
  return signed ? (x > 0 ? '+' : MINUS) + s : (x < 0 ? MINUS : '') + s;
};
const pp = d => { const x = Math.round(d * 1000) / 10; return x === 0 ? '0 pp' : (x > 0 ? '+' : MINUS) + nf(1).format(Math.abs(x)) + ' pp'; };
const SCALE = () => S.moneda === 'USD' ? 1e3 : 1e6;
const UNIT = () => S.moneda === 'USD' ? 'MU$S' : 'M$';
const tv = v => fixMinus(nf(1).format(v / SCALE()));
const cls = v => v > 0.0005 ? 'up' : v < -0.0005 ? 'dn' : 'flat';
const arrow = v => v > 0.0005 ? '▲' : v < -0.0005 ? '▼' : '•';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const smart = x => fixMinus(nf(Math.abs(x - Math.round(x)) > 0.01 ? 1 : 0).format(x));
const axFmt = v => smart(v / SCALE());
const pctAx = v => { const x = v * 100; return fixMinus(nf(Math.abs(x - Math.round(x)) > 0.05 ? 1 : 0).format(x)) + '%'; };
const today = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

/* ---------- cálculo ---------- */
function val(e, ms, items, c = null) {
  let s = 0; const U = S.moneda === 'USD';
  for (const m of ms) {
    const a = cube[e][m]; if (!a) continue; const f = U ? 1 / kp(e, m).tc : 1;
    const c0 = c === null ? 0 : c + 1, c1 = c === null ? NC + 1 : c + 2;
    for (let cc = c0; cc < c1; cc++) { const b = cc * NI; for (const i of items) { if (S.sinInd && i === IND) continue; s += a[b + i] * f; } }
  }
  return s;
}
function fromItems(it) {
  const o = { it, n1: {}, n2: {} };
  for (const n of N1) o.n1[n] = IN1[n].reduce((s, i) => s + it[i], 0);
  for (const n of N2) o.n2[n] = IN2[n].reduce((s, i) => s + it[i], 0);
  o.ing = o.n1[N1[0]]; o.mb = o.ing + o.n1[N1[1]] + o.n1[N1[2]]; o.mo = o.mb + o.n1[N1[3]]; o.uai = o.mo + o.n1[N1[4]]; o.un = o.uai + o.n1[N1[5]];
  return o;
}
function pnl(e, ms, c = null) {
  const it = new Float64Array(NI), U = S.moneda === 'USD';
  for (const m of ms) {
    const a = cube[e][m]; if (!a) continue; const f = U ? 1 / kp(e, m).tc : 1;
    const c0 = c === null ? 0 : c + 1, c1 = c === null ? NC + 1 : c + 2;
    for (let cc = c0; cc < c1; cc++) { const b = cc * NI; for (let i = 0; i < NI; i++) it[i] += a[b + i] * f; }
  }
  if (S.sinInd) it[IND] = 0;
  return fromItems(it);
}
const months = () => S.vista === 'mes' ? [S.m] : range(Y25, S.m + 1);
const shift = (ms, k) => ms.map(m => m + k);
const perLbl = () => S.vista === 'mes' ? mlab(S.m) : 'ene–' + mlab(S.m);
const horas = (e, ms) => ms.reduce((s, m) => s + (kp(e, m)?.horas || 0), 0);
const posM = (e, ms, c) => ms.reduce((s, m) => { const r = dr(e, m, c); return s + (r ? r[8] + r[9] : 0); }, 0);
const LE = () => { const r = range(Y25, CORTE + 1), f = range(CORTE + 1, DIC + 1); const a = pnl(E.REAL, r), b = pnl(E.FCST, f); return { un: a.un + b.un, ing: a.ing + b.ing, mo: a.mo + b.mo }; };

const EFF = { vol: 'Volumen asignado', inf: 'Inflación de la deuda', ef: 'Eficiencia de recupero', fee: 'Fee', fx: 'Tipo de cambio', mix: 'Altas y bajas de carteras' };
function bridge(ref, ms) {
  const U = S.moneda === 'USD', eff = { vol: 0, inf: 0, ef: 0, fee: 0, fx: 0, mix: 0 }, byC = {}, keys = ['vol', 'inf', 'ef', 'fee', 'fx'];
  let s0 = 0, s1 = 0;
  for (const m of ms) for (let c = 0; c < NC; c++) {
    const r = dr(E.REAL, m, c), p = dr(ref, m, c);
    const fr = r ? [r[3], r[4], r[5], r[6], r[7] / (U ? kp(E.REAL, m).tc : 1)] : null;
    const fp = p ? [p[3], p[4], p[5], p[6], p[7] / (U ? kp(ref, m).tc : 1)] : null;
    const Rr = fr ? fr.reduce((a, b) => a * b, 1) : 0, Rp = fp ? fp.reduce((a, b) => a * b, 1) : 0;
    s0 += Rp; s1 += Rr;
    const bc = byC[c] ??= { vol: 0, inf: 0, ef: 0, fee: 0, fx: 0, mix: 0, rr: 0, rp: 0 };
    bc.rr += Rr; bc.rp += Rp;
    if (!Rr || !Rp) { eff.mix += Rr - Rp; bc.mix += Rr - Rp; continue; }
    for (let k = 0; k < 5; k++) { let v = 1; for (let j = 0; j < 5; j++) v *= j < k ? fr[j] : j > k ? fp[j] : (fr[k] - fp[k]); eff[keys[k]] += v; bc[keys[k]] += v; }
  }
  const ing = val(E.REAL, ms, ING), ingp = val(ref, ms, ING);
  eff.vol += (ing - s1) - (ingp - s0);
  return { start: ingp, end: ing, eff, byC };
}
function rentab(ms) {
  const totIng = val(E.REAL, ms, ING), struct = val(E.REAL, ms, EST);
  return D.carteras.map((c, ci) => {
    const ing = val(E.REAL, ms, ING, ci), dir = val(E.REAL, ms, DIR, ci), asg = val(E.REAL, ms, ASG, ci);
    const est = S.estructura && totIng ? struct * ing / totIng : 0;
    const mgn = ing + dir + asg + est, pm = posM(E.REAL, ms, ci);
    return { ci, ...c, ing, dir, asg, est, mgn, mgnp: ing ? mgn / ing : NaN, pm, pos: Math.round(pm / ms.length), ingPos: pm ? ing / pm : 0, costPos: pm ? -(dir + asg + est) / pm : 0 };
  }).filter(x => x.ing > 0 || x.pm > 0);
}

/* ---------- marca y tema ---------- */
const BRANDS = {
  rojoazul: { l: { band: '#13294b', bandInk2: '#b9c6da', accent: '#c8102e', weak: '#fbe9ec', real: '#1f5bb5' }, d: { band: '#0b1830', bandInk2: '#9fb0c8', accent: '#ff5a6e', weak: '#3a1a20', real: '#4d8be0' } },
  azul: { l: { band: '#0f3d6e', bandInk2: '#b6cbe3', accent: '#1c5fa6', weak: '#e3edf8', real: '#2a78d6' }, d: { band: '#0b223d', bandInk2: '#9db4cf', accent: '#5b9de8', weak: '#18283a', real: '#3987e5' } },
  petroleo: { l: { band: '#0b3b39', bandInk2: '#a9cdc9', accent: '#0d7a72', weak: '#ddf0ee', real: '#12867e' }, d: { band: '#092826', bandInk2: '#8fbab5', accent: '#3cb8ae', weak: '#10302d', real: '#2aa197' } },
  grafito: { l: { band: '#20262b', bandInk2: '#b8c0c7', accent: '#b26a00', weak: '#fbf0de', real: '#356c96' }, d: { band: '#161a1e', bandInk2: '#9aa3ab', accent: '#f0a13a', weak: '#3a2c14', real: '#5b93c2' } } };
const isDark = () => { const t = document.documentElement.dataset.theme; return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); };
function brandTok(dark) { const b = (BRANDS[S.brand] || BRANDS.rojoazul)[dark ? 'd' : 'l']; return { '--band': b.band, '--band-ink-2': b.bandInk2, '--accent': b.accent, '--accent-weak': b.weak, '--real': b.real, '--div-pos': b.real }; }
function applyBrand() { const t = brandTok(isDark()), st = document.documentElement.style; Object.entries(t).forEach(([k, v]) => st.setProperty(k, v)); }
const LIGHT = { '--surface': '#ffffff', '--surface-2': '#f5f7fa', '--line': '#e1e5ea', '--line-strong': '#c6ccd4', '--ink': '#111a24', '--ink-2': '#3f4b58', '--ink-3': '#5d6874',
  '--fcst': '#eb6834', '--ppto': '#7d868f', '--aa': '#bcc3ca', '--good': '#1d7a46', '--crit': '#c0392b', '--serious': '#ec835a', '--div-neg': '#c0392b', '--div-mid': '#eceae6' };
let TOV = null;
const T = n => (TOV && TOV[n]) || getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const withLight = fn => { TOV = { ...LIGHT, ...brandTok(false), '--f-body': fam(), '--f-mono': fam() }; try { return fn(); } finally { TOV = null; } };

/* ---------- gráficos ---------- */
const charts = new Set();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function mk(el, opt) {
  if (!el) return null;
  try {
    opt.animationDuration = reduced ? 0 : 420; opt.animationDurationUpdate = reduced ? 0 : 250;
    if (opt._wf) { const per = el.clientWidth / opt._wf; if (per < 70) Object.assign(opt.xAxis.axisLabel, { rotate: 38, width: 96, overflow: 'truncate', lineHeight: 12 }); delete opt._wf; }
    const c = echarts.init(el, null, { renderer: 'svg' }); c.setOption(opt); charts.add(c); return c;
  } catch (e) { el.innerHTML = `<p class="err">No se pudo dibujar este gráfico: ${esc(e.message)}</p>`; return null; }
}
function ssr(opt, w = 760, h = 300) {
  try {
    if (opt._wf) { if (w / opt._wf < 70) Object.assign(opt.xAxis.axisLabel, { rotate: 38, width: 96, overflow: 'truncate' }); delete opt._wf; }
    opt.animation = false; delete opt.tooltip; const c = echarts.init(null, null, { renderer: 'svg', ssr: true, width: w, height: h }); c.setOption(opt); const s = c.renderToSVGString(); c.dispose(); return s;
  } catch (e) { return `<p class="note">Gráfico no disponible: ${esc(e.message)}</p>`; }
}
function disposeIn(root) { for (const c of [...charts]) { if (c.isDisposed() || root.contains(c.getDom())) { if (!c.isDisposed()) c.dispose(); charts.delete(c); } } }
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => charts.forEach(c => !c.isDisposed() && c.resize()), 120); });
const tip = (extra = {}) => ({ trigger: 'axis', backgroundColor: T('--surface'), borderColor: T('--line-strong'), borderWidth: 1, padding: [8, 10],
  textStyle: { color: T('--ink'), fontSize: 12, fontFamily: T('--f-body') }, extraCssText: 'box-shadow:0 8px 24px -10px rgba(0,0,0,.3);border-radius:8px', ...extra });
const axisCat = (data, extra = {}) => ({ type: 'category', data, axisTick: { show: false }, axisLine: { lineStyle: { color: T('--line-strong') } },
  axisLabel: { color: T('--ink-3'), fontSize: 11, fontFamily: T('--f-body') }, ...extra });
const axisVal = (fmt, extra = {}) => ({ type: 'value', splitLine: { lineStyle: { color: T('--line'), type: [3, 4] } }, axisLine: { show: false },
  axisLabel: { color: T('--ink-3'), fontSize: 11, formatter: fmt, fontFamily: T('--f-body') }, ...extra });
const legend = () => ({ top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 3, itemGap: 16, textStyle: { color: T('--ink-2'), fontSize: 12, fontFamily: T('--f-body') } });
const SER = () => ({
  REAL: { name: 'Real', color: T('--real'), lineStyle: { width: 2.25 }, symbol: 'circle', symbolSize: 6 },
  FCST: { name: 'Forecast', color: T('--fcst'), lineStyle: { width: 1.75, type: [5, 4] }, symbol: 'none' },
  PPTO: { name: 'Presupuesto', color: T('--ppto'), lineStyle: { width: 1.75, type: [2, 3] }, symbol: 'none' },
  AA: { name: 'Año anterior', color: T('--aa'), lineStyle: { width: 1.5 }, symbol: 'none' },
  SIM: { name: 'Simulado', color: T('--accent'), lineStyle: { width: 2.5 }, symbol: 'circle', symbolSize: 6 } });

function waterfall(steps, { startLabel, endLabel, start, end, startColor, scale, pre }) {
  const sc = scale ?? SCALE(), pr = pre ?? cur(), fv = v => fixMinus(nf(1).format(v / sc));
  const items = [{ name: startLabel, lo: 0, hi: start, kind: 'tot', v: start }];
  let run = start;
  for (const s of steps) { items.push({ name: s.name, lo: Math.min(run, run + s.v), hi: Math.max(run, run + s.v), kind: s.v >= 0 ? 'up' : 'dn', v: s.v }); run += s.v; }
  items.push({ name: endLabel, lo: 0, hi: end, kind: 'tot2', v: end });
  const lows = items.map(i => i.kind.startsWith('tot') ? i.hi : i.lo), his = items.map(i => i.hi);
  const mn = Math.min(...lows), mx = Math.max(...his);
  let floor = 0;
  if (mn > 0 && mn > mx * 0.55) { const step = Math.pow(10, Math.floor(Math.log10(mx - mn + 1))); floor = Math.floor((mn - (mx - mn) * 0.35) / step) * step; }
  if (mn < 0) floor = undefined;
  items.forEach(i => { if (i.kind.startsWith('tot') && floor !== undefined) i.lo = Math.min(floor, i.hi); });
  const col = { tot: startColor || T('--ppto'), tot2: T('--real'), up: T('--good'), dn: T('--crit') }, lblCol = T('--ink-2'), font = T('--f-body');
  return { _wf: items.length,
    grid: { left: 8, right: 12, top: 22, bottom: 8, containLabel: true },
    tooltip: tip({ trigger: 'item', formatter: p => { const it = items[p.dataIndex]; return `<b>${esc(it.name)}</b><br>${it.kind.startsWith('tot') ? money(it.v, { pre: pr }) : money(it.v, { signed: true, pre: pr })}`; } }),
    xAxis: axisCat(items.map(i => i.name), { axisLabel: { color: T('--ink-3'), fontSize: 10.5, interval: 0, width: 74, overflow: 'break', lineHeight: 13, fontFamily: font } }),
    yAxis: axisVal(v => smart(v / sc), { min: floor === undefined ? null : floor, scale: floor === undefined }),
    series: [{ type: 'custom', data: items.map((it, i) => [i, it.lo, it.hi]), encode: { x: 0, y: [1, 2] },
      renderItem: (p, api) => {
        const i = api.value(0), it = items[i];
        const a = api.coord([i, api.value(1)]), b = api.coord([i, api.value(2)]);
        const w = api.size([1, 0])[0] * 0.58, y = Math.min(a[1], b[1]), h = Math.max(1.5, Math.abs(a[1] - b[1]));
        const txt = it.kind.startsWith('tot') ? fv(it.v) : (it.v >= 0 ? '+' : MINUS) + nf(1).format(Math.abs(it.v) / sc);
        return { type: 'group', children: [
          { type: 'rect', shape: { x: a[0] - w / 2, y, width: w, height: h, r: 3 }, style: { fill: col[it.kind] } },
          { type: 'text', style: { text: txt, x: a[0], y: y - 4, fill: lblCol, font: `600 11px ${font}`, align: 'center', verticalAlign: 'bottom' } }] };
      } }] };
}
function lineOpt(cats, series, { yFmt = axFmt, pctAxis = false, tipFmt } = {}) {
  return { grid: { left: 6, right: 14, top: series.length > 1 ? 34 : 12, bottom: 6, containLabel: true }, legend: series.length > 1 ? legend() : { show: false },
    tooltip: tip({ valueFormatter: v => v == null ? '–' : tipFmt ? tipFmt(v) : pctAxis ? pct(v, false) : money(v) }),
    xAxis: axisCat(cats, { boundaryGap: false }), yAxis: axisVal(pctAxis ? pctAx : yFmt, { scale: true }),
    series: series.map(s => ({ type: 'line', connectNulls: false, emphasis: { focus: 'series' }, ...s, itemStyle: { color: s.color }, lineStyle: { color: s.color, ...(s.lineStyle || {}) } })) };
}
function barsH(labels, values, { colors, fmt = tv, axis = axFmt } = {}) {
  return { grid: { left: 6, right: 54, top: 4, bottom: 4, containLabel: true }, tooltip: tip({ trigger: 'item', formatter: q => `${esc(q.name)}<br><b>${fmt(q.value)}</b>` }),
    xAxis: axisVal(axis), yAxis: axisCat(labels, { axisLabel: { color: T('--ink-2'), fontSize: 11, fontFamily: T('--f-body') } }),
    series: [{ type: 'bar', barWidth: '62%', data: values.map((v, i) => ({ value: v, name: labels[i], itemStyle: { color: colors ? colors[i] : T('--real'), borderRadius: v < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', fontSize: 10.5, color: T('--ink-2'), formatter: q => fmt(q.value) } }] };
}
function spark(vals, ref, fc) {
  const all = [...vals, ...ref, ...(fc || [])].filter(v => v != null && isFinite(v));
  const mn = Math.min(...all), mx = Math.max(...all), W = 200, H = 40, n = ref.length;
  const x = i => 2 + i * (W - 4) / (n - 1), y = v => H - 3 - (v - mn) / ((mx - mn) || 1) * (H - 8);
  const path = arr => arr.map((v, i) => v == null || !isFinite(v) ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean).join(' ');
  let last = vals.length - 1; while (last > 0 && vals[last] == null) last--;
  const area = `${x(0)},${H} ${path(vals)} ${x(last)},${H}`;
  const fcl = fc ? `<polyline points="${path(fc)}" fill="none" stroke="${T('--fcst')}" stroke-width="1.4" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"/>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Tendencia 2025: real, presupuesto${fc ? ' y forecast' : ''}"><polyline points="${path(ref)}" fill="none" stroke="${T('--ppto')}" stroke-width="1.4" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>${fcl}
    <polygon points="${area}" fill="${T('--real')}" opacity=".10"/><polyline points="${path(vals)}" fill="none" stroke="${T('--real')}" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    <circle cx="${x(last)}" cy="${y(vals[last])}" r="2.8" fill="${T('--real')}"/></svg>`;
}

/* ---------- detalle: página completa o panel lateral, con historial ---------- */
const $ = id => document.getElementById(id);
const TABN = { resumen: 'Resumen', eerr: 'Estado de resultados', carteras: 'Rentabilidad por cartera', sim: 'Simulador de cierre', ppto: 'Planificador', intercompany: 'Intercompany y TC', cotizador: 'Cotizador de carteras', informes: 'Informes' };
const stack = []; let lastFocus = null, replaying = false, nextRb = null;
const detOpen = () => !$('page').hidden || !$('drawer').hidden;
function openDrawer(spec, push = false) {
  const rb = nextRb; nextRb = null;
  if (!replaying && (!push || !detOpen())) { stack.length = 0; lastFocus = document.activeElement; }
  spec.rb = rb; stack.push(spec); if (!replaying) showTop();
}
function hideDet() {
  disposeIn($('pBody')); disposeIn($('dBody')); $('pBody').innerHTML = ''; $('dBody').innerHTML = '';
  $('page').hidden = true; $('drawer').hidden = true; $('scrim').hidden = true; $('view').hidden = false;
}
function showTop() {
  const spec = stack[stack.length - 1]; if (!spec) { closeDrawer(); return; }
  const after = body => requestAnimationFrame(() => { try { spec.after && spec.after(body); } catch (e) { body.insertAdjacentHTML('afterbegin', `<p class="err">${esc(e.message)}</p>`); } });
  if (S.det === 'page') {
    const body = $('pBody'); disposeIn(body); disposeIn($('dBody')); $('drawer').hidden = true; $('scrim').hidden = true;
    $('pEyebrow').textContent = spec.eyebrow || ''; $('pTitle').textContent = spec.title; $('pSub').textContent = spec.sub || '';
    $('pCrumbs').innerHTML = `<button data-cr="-1">${esc(TABN[S.tab])}</button>` + stack.map((s, i) => `<span class="sep" aria-hidden="true">›</span>` +
      (i === stack.length - 1 ? `<span class="cur" aria-current="page">${esc(s.title)}</span>` : `<button data-cr="${i}">${esc(s.title)}</button>`)).join('');
    $('pCrumbs').querySelectorAll('[data-cr]').forEach(b => b.onclick = () => { const i = +b.dataset.cr; if (i < 0) closeDrawer(); else { stack.length = i + 1; showTop(); } });
    $('pBack').textContent = '‹ Volver a ' + (stack.length > 1 ? stack[stack.length - 2].title : TABN[S.tab]);
    const dl = $('pDl'); dl.hidden = !spec.report; dl.onclick = spec.report || null;
    body.innerHTML = spec.html; $('view').hidden = true; $('page').hidden = false;
    // armado en dos columnas: los bloques angostos se emparejan; si uno queda solo, ocupa todo el ancho
    const kids = [...body.children], isFull = el => el.matches('.kv,.wide,.rep') || !!el.querySelector(':scope > .tw, :scope > .minis');
    for (let i = 0; i < kids.length;) { if (isFull(kids[i])) { kids[i].classList.add('full'); i++; } else if (i + 1 < kids.length && !isFull(kids[i + 1])) i += 2; else { kids[i].classList.add('full'); i++; } }
    try { window.scrollTo({ top: 0 }); } catch (e) {}
    after(body); return;
  }
  const body = $('dBody'); disposeIn(body); disposeIn($('pBody')); $('page').hidden = true; $('view').hidden = false;
  $('dEyebrow').textContent = spec.eyebrow || ''; $('dTitle').textContent = spec.title; $('dSub').textContent = spec.sub || '';
  const back = $('dBack'); back.hidden = stack.length < 2; if (stack.length > 1) back.textContent = '‹ Volver a ' + stack[stack.length - 2].title;
  const dl = $('dDl'); dl.hidden = !spec.report; dl.onclick = spec.report || null;
  body.innerHTML = spec.html; $('drawer').hidden = false; $('scrim').hidden = false; body.scrollTop = 0;
  after(body); requestAnimationFrame(() => $('dClose').focus());
}
function closeDrawer() {
  const wasPage = !$('page').hidden; hideDet(); stack.length = 0;
  if (wasPage) charts.forEach(c => !c.isDisposed() && c.resize());
  try { lastFocus && lastFocus.focus && document.contains(lastFocus) && lastFocus.focus(); } catch (e) {}
}
function replay() {
  const rbs = stack.map(s => s.rb); if (!rbs.length || rbs.some(r => !r)) return;
  stack.length = 0; replaying = true;
  try { rbs.forEach((rb, i) => rb(i > 0)); } finally { replaying = false; }
  if (stack.length) showTop(); else closeDrawer();
}
function switchDet(mode) {
  if (S.det === mode) return;
  const st = [...stack], was = st.length && detOpen();
  if (was) hideDet();
  S.det = mode; try { localStorage.setItem('cg-det', mode); } catch (e) {}
  syncSeg(document.querySelector('.band'));
  if (was) { stack.length = 0; st.forEach(s => stack.push(s)); showTop(); }
}
$('dBack').onclick = () => { stack.pop(); showTop(); };
$('dClose').onclick = closeDrawer; $('scrim').onclick = closeDrawer;
$('pBack').onclick = () => { if (stack.length > 1) { stack.pop(); showTop(); } else closeDrawer(); };
$('pPanel').onclick = () => switchDet('panel');
$('dPage').onclick = () => switchDet('page');
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (tourI >= 0) tourEnd(); else if (detOpen()) closeDrawer(); else if ($('adj').open) $('adj').open = false; });
const kvHtml = (arr, cl = '') => `<div class="kv ${cl}">${arr.map(([l, v, c]) => `<div><span>${l}</span><b class="${c || ''}">${v}</b></div>`).join('')}</div>`;
const wireRows = (root, fn) => root.querySelectorAll('tr.click').forEach(tr => { const go = () => fn(tr); tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter') go(); }; });

/* ---------- descargas ---------- */
let DL = null;
(async () => { try { if (window.claude && window.claude.use) DL = await window.claude.use('downloads'); } catch (e) { DL = null; } })();
let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3200); }
async function saveFile(filename, data, mime) {
  if (DL) {
    try { await DL.save({ filename, data }); toast('Archivo guardado'); }
    catch (e) { if (e && e.code === 'declined') return; toast(e && e.code === 'rate_limited' ? 'Ya hay una descarga esperando confirmación' : 'No se pudo guardar: ' + (e && e.message || 'error')); }
    return;
  }
  if (!window.claude) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime }); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast('Descarga iniciada'); return;
  }
  toast('Las descargas no están habilitadas en esta vista. Abrí la versión HTML del tablero para descargar.');
}
let xlsxP = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return xlsxP ??= new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => res(window.XLSX); s.onerror = () => { xlsxP = null; rej(new Error('No se pudo cargar el generador de Excel (requiere conexión)')); }; document.head.appendChild(s); });
}
async function saveWorkbook(filename, sheets) {
  let out;
  try { const X = await loadXLSX(); const wb = X.utils.book_new();
    sheets.forEach(s => { const ws = X.utils.aoa_to_sheet(s.rows); if (s.cols) ws['!cols'] = s.cols.map(w => ({ wch: w })); X.utils.book_append_sheet(wb, ws, s.name.slice(0, 31)); });
    out = X.write(wb, { bookType: 'xlsx', type: 'array' });
  } catch (e) {
    const s = sheets[0], csv = s.rows.map(r => r.map(v => typeof v === 'string' && /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(';')).join('\n');
    toast(e.message + '. Te bajo un CSV.'); await saveFile(filename.replace(/\.xlsx$/, '.csv'), '﻿' + csv, 'text/csv'); return;
  }
  await saveFile(filename, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/* ---------- controles ---------- */
const sel = $('selMes');
sel.innerHTML = range(Y25, CORTE + 1).reverse().map(m => `<option value="${m}">${mlab(m)}</option>`).join('');
sel.onchange = () => { S.m = +sel.value; render(); };
const segVal = v => v === 'true' ? true : v === 'false' ? false : v;
document.querySelectorAll('.band .seg').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  if (g.dataset.k === 'det') { switchDet(b.dataset.v); return; } if (g.dataset.k === 'theme') { setTheme(b.dataset.v); return; } S[g.dataset.k] = segVal(b.dataset.v); render(); }));
$('chkInd').onchange = e => { S.sinInd = e.target.checked; render(); };
$('selBrand').value = BRANDS[S.brand] ? S.brand : 'rojoazul';
$('selFont').value = S.font;
$('selFont').onchange = e => { S.font = e.target.value; try { localStorage.setItem('cg-font', S.font); } catch (x) {} applyFont(); render(); };
$('selBrand').onchange = e => { S.brand = e.target.value; try { localStorage.setItem('cg-brand', S.brand); } catch (x) {} applyBrand(); render(); };
$('btnRep').onclick = () => goTab('informes');
$('btnTour').onclick = () => tourStart();
document.addEventListener('click', e => { const a = $('adj'); if (a.open && !a.contains(e.target)) a.open = false; });
function goTab(t) { if (detOpen()) { hideDet(); stack.length = 0; } S.tab = t; render(); try { localStorage.setItem('cg-tab', t); } catch (e) {} try { history.replaceState(null, '', '#' + t); } catch (e) {} try { window.scrollTo({ top: 0 }); } catch (e) {} }
document.querySelectorAll('.tab').forEach(t => t.onclick = () => goTab(t.dataset.tab));
const syncSeg = root => root.querySelectorAll('.seg[data-k]').forEach(g => g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(String(S[g.dataset.k]) === b.dataset.v))));

/* ---------- render ---------- */
const view = $('view');
function render() {
  disposeIn(view);
  sel.value = S.m; $('chkInd').checked = S.sinInd; syncSeg(document.querySelector('.band'));
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === S.tab)));
  $('stamp').textContent = `Datos al 30/09/2025 · ${perLbl()} · ${S.moneda === 'USD' ? 'en dólares, cada escenario a su tipo de cambio' : 'pesos corrientes'}`;
  try { ({ resumen: vResumen, eerr: vEerr, carteras: vCarteras, sim: vSim, ppto: vPpto, intercompany: vIC, cotizador: vCot, informes: vInformes })[S.tab](); }
  catch (e) { view.innerHTML = `<div class="panel"><p class="err">No se pudo mostrar esta sección: ${esc(e.message)}</p></div>`; console.error(e); }
  syncSeg(view);
  view.querySelectorAll('.seg[data-k]').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S[g.dataset.k] = segVal(b.dataset.v); render(); }));
  if (stack.length && detOpen()) { try { replay(); } catch (e) { console.error(e); } }
}

/* ===== RESUMEN ===== */
function statusOf(r, kind) {
  if (kind === 'pp') return r >= 0 ? ['good', 'En línea'] : r >= -0.02 ? ['warn', 'Atención'] : ['crit', 'Desvío'];
  return r >= 1 ? ['good', 'En línea'] : r >= 0.9 ? ['warn', 'Atención'] : ['crit', 'Desvío'];
}
function cardsData() {
  const ms = months(), R = pnl(E.REAL, ms), F = pnl(E.FCST, ms), P = pnl(E.PPTO, ms), A = pnl(E.REAL, shift(ms, -12));
  const yr = range(Y25, DIC + 1), realYr = range(Y25, CORTE + 1);
  const serie = (fn, e) => yr.map(m => (e === E.REAL && m > CORTE) || !cube[e][m] ? null : fn(pnl(e, [m]), m, e));
  const sp3 = fn => [serie(fn, E.REAL), serie(fn, E.PPTO), serie(fn, E.FCST)];
  const le = LE(), pY = pnl(E.PPTO, yr), hR = horas(E.REAL, ms), hP = horas(E.PPTO, ms), hF = horas(E.FCST, ms);
  const C = {
    ing: { k: 'ing', lbl: 'Ingresos', v: money(R.ing), cmp: [['vs presupuesto', (R.ing - P.ing) / Math.abs(P.ing)], ['vs forecast', (R.ing - F.ing) / Math.abs(F.ing)]],
      st: statusOf(R.ing / P.ing), phrase: `${pct((R.ing - A.ing) / A.ing)} contra el año anterior.`, sp: sp3(o => o.ing) },
    mo: { k: 'mo', lbl: 'Margen operativo', v: pct(R.mo / R.ing, false), cmp: [['vs presupuesto', R.mo / R.ing - P.mo / P.ing, 'pp'], ['vs forecast', R.mo / R.ing - F.mo / F.ing, 'pp']],
      st: statusOf(R.mo / R.ing - P.mo / P.ing, 'pp'), phrase: `${money(R.mo)} después de la estructura${S.sinInd ? ', sin indemnizaciones' : ''}.`, sp: sp3(o => o.mo / o.ing) },
    un: { k: 'un', lbl: 'Utilidad neta', v: money(R.un), cmp: [['vs presupuesto', (R.un - P.un) / Math.abs(P.un)], ['vs forecast', (R.un - F.un) / Math.abs(F.un)]],
      st: statusOf(R.un / P.un), phrase: `${pct(R.un / R.ing, false)} de los ingresos.`, sp: sp3(o => o.un) },
    iph: { k: 'iph', lbl: 'Ingreso por hora', v: money(R.ing / hR, { full: S.moneda !== 'USD' }), cmp: [['vs presupuesto', (R.ing / hR) / (P.ing / hP) - 1], ['vs forecast', (R.ing / hR) / (F.ing / hF) - 1]],
      st: statusOf((R.ing / hR) / (P.ing / hP)), phrase: `Por hora de posición; ${nf(0).format(hR / ms.length / 132)} posiciones en promedio.`,
      sp: [serie((o, m, e) => o.ing / horas(e, [m]), E.REAL), serie((o, m, e) => o.ing / horas(e, [m]), E.PPTO), serie((o, m, e) => o.ing / horas(e, [m]), E.FCST)] },
    le: { k: 'le', lbl: 'Cierre proyectado 2025', v: money(le.un), cmp: [['vs presupuesto anual', (le.un - pY.un) / Math.abs(pY.un)]],
      st: statusOf(le.un / pY.un), phrase: 'Utilidad neta del año: real ene–sep más forecast oct–dic.',
      sp: [yr.map(m => m <= CORTE ? pnl(E.REAL, range(Y25, m + 1)).un : pnl(E.REAL, realYr).un + pnl(E.FCST, range(CORTE + 1, m + 1)).un), yr.map(m => pnl(E.PPTO, range(Y25, m + 1)).un), null] },
    mb: { k: 'mb', lbl: 'Margen bruto', v: pct(R.mb / R.ing, false), cmp: [['vs presupuesto', R.mb / R.ing - P.mb / P.ing, 'pp'], ['vs forecast', R.mb / R.ing - F.mb / F.ing, 'pp']],
      st: statusOf(R.mb / R.ing - P.mb / P.ing, 'pp'), phrase: `Quedan ${money(R.mb)} después de operar las carteras.`, sp: sp3(o => o.mb / o.ing) } };
  return ['ing', 'mo', 'un', 'iph', 'le', ...(S.more ? ['mb'] : [])].map(k => C[k]);
}
function cardHtml(c) {
  const cmp = c.cmp.map(([l, v, t]) => `<span class="cl"><b class="${cls(v)}">${t === 'pp' ? pp(v) : pct(v)}</b> ${l}</span>`).join('');
  return `<button class="card" data-card="${c.k}" aria-label="${esc(c.lbl)}: ${esc(c.v)}. Ver apertura"><span class="lbl">${esc(c.lbl)}<span class="status ${c.st[0]}"><i></i>${c.st[1]}</span></span>
    <span class="v">${c.v}</span>${cmp}<p class="phrase">${esc(c.phrase)}</p>${spark(c.sp[0], c.sp[1], c.sp[2])}<span class="go">Ver apertura ›</span></button>`;
}
function topMovers(byC, n = 2, dir = -1) { return Object.entries(byC).map(([c, b]) => [D.carteras[c].code, b.rr - b.rp]).sort((a, b) => dir * (b[1] - a[1])).slice(0, n).filter(x => Math.abs(x[1]) > 1); }
function buildAlerts(ms = months()) {
  const R = pnl(E.REAL, ms), F = pnl(E.FCST, ms), A = [];
  const dF = R.ing - F.ing, dFp = dF / Math.abs(F.ing);
  if (Math.abs(dFp) >= 0.02) { const b = bridge(E.FCST, ms), t = topMovers(b.byC, 2, dF < 0 ? -1 : 1);
    A.push({ sev: dF < 0 ? 'crit' : 'good', impact: Math.abs(dF), title: `Ingresos ${dF < 0 ? 'debajo' : 'arriba'} del forecast`, sub: `${pct(dFp)} contra lo proyectado`,
      what: `Se facturaron ${money(R.ing)} contra ${money(F.ing)} proyectados.`, why: `El desvío se concentra en ${t.map(x => `${x[0]} (${money(x[1], { signed: true })})`).join(' y ')}.`,
      todo: 'Revisar con cada responsable de cartera la proyección semanal y las reversas del mes.', measure: 'Desvío del forecast mensual dentro de ±2%.', go: () => cardDrawer('ing') }); }
  rentab(ms).filter(x => x.mgn < 0).forEach(x => A.push({ sev: 'crit', impact: Math.abs(x.mgn), title: `${x.nombre} pierde plata`, sub: `Margen ${pct(x.mgnp, false)}`,
    what: `Margen de contribución de ${money(x.mgn)} con ${x.pos} posiciones.`, why: `Cada posición genera ${money(x.ingPos)} por mes y cuesta ${money(x.costPos)}.`,
    todo: 'Renegociar fee o pasar posiciones a otra cartera; si no cierra en dos meses, evaluar la salida (se puede probar en el Planificador).', measure: 'Margen de contribución mayor a cero.', go: () => carteraDrawer(x.ci) }));
  const bP = bridge(E.PPTO, ms), lm = ms[ms.length - 1];
  Object.entries(bP.byC).forEach(([c, b]) => {
    const cc = D.carteras[c], r = dr(E.REAL, lm, +c), p = dr(E.PPTO, lm, +c);
    if (!(r && p && r[5] && p[5])) return;
    const er = r[5] / p[5] - 1;
    if (er <= -0.08 && b.ef < 0) A.push({ sev: 'crit', impact: Math.abs(b.ef), title: `Cae la eficiencia de ${cc.code}`, sub: `Recupero ${pct(er)} contra presupuesto`,
      what: `${cc.nombre} recupera ${pct(r[5], false)} de la deuda contra ${pct(p[5], false)} presupuestado.`, why: `Cuesta ${money(b.ef)} de ingresos en ${perLbl()}.`,
      todo: 'Plan de mejora con el supervisor: mix de canales, horarios de contacto y acuerdos de pago.', measure: '% de recupero semanal de vuelta en el nivel presupuestado.', go: () => carteraDrawer(+c) });
    if (er >= 0.08 && b.ef > 0) A.push({ sev: 'good', impact: Math.abs(b.ef), title: `${cc.code} recupera por encima del plan`, sub: `Recupero ${pct(er)} contra presupuesto`,
      what: `${cc.nombre} recupera ${pct(r[5], false)} contra ${pct(p[5], false)} presupuestado.`, why: `Aporta ${money(b.ef, { signed: true })} de ingresos.`,
      todo: 'Documentar qué cambió y replicarlo en carteras del mismo tipo.', measure: 'Mismo nivel de recupero en las carteras donde se replique.', go: () => carteraDrawer(+c) });
    if (b.fee < -1 && r[6] < p[6]) A.push({ sev: 'warn', impact: Math.abs(b.fee), title: `Fee renegociado en ${cc.code}`, sub: `${pct(p[6], false)} → ${pct(r[6], false)}`,
      what: `El cliente bajó la comisión de ${pct(p[6], false)} a ${pct(r[6], false)}.`, why: `Resta ${money(b.fee)} de ingresos contra presupuesto en ${perLbl()}.`,
      todo: 'Compensar con más volumen asignado o mejor recupero; revisar la cláusula de ajuste del contrato.', measure: 'Ingreso de la cartera igual o mayor al presupuestado.', go: () => carteraDrawer(+c) });
  });
  const k0 = kp(E.REAL, lm), k3 = kp(E.REAL, lm - 3);
  if (k3 && k0.csms / k3.csms - 1 >= 0.1) { const q = range(0, NC).reduce((s, c) => s + (dr(E.REAL, lm, c)?.[11] || 0), 0), d = (k0.csms - k3.csms) * q / (S.moneda === 'USD' ? k0.tc : 1);
    A.push({ sev: 'warn', impact: d, title: 'Subió el costo por SMS', sub: `${pct(k0.csms / k3.csms - 1)} en tres meses`,
      what: `Cada SMS cuesta $ ${nf(2).format(k0.csms)} contra $ ${nf(2).format(k3.csms)} en ${mlab(lm - 3)}.`, why: `Son ${money(d)} más por mes con el volumen actual.`,
      todo: 'Renegociar con el proveedor y pasar envíos masivos a mail o WhatsApp donde convenga.', measure: 'Costo por SMS y costo de contacto efectivo por cartera.', go: () => n2Drawer('2.6 SMS') }); }
  const le = LE(), pY = pnl(E.PPTO, range(Y25, DIC + 1)), gap = le.un - pY.un;
  if (gap / Math.abs(pY.un) <= -0.05) A.push({ sev: 'crit', impact: Math.abs(gap), title: 'El cierre del año queda debajo del presupuesto', sub: `${pct(gap / Math.abs(pY.un))} en utilidad neta`,
    what: `Cierre proyectado ${money(le.un)} contra ${money(pY.un)} presupuestado.`, why: `Faltan ${money(-gap)} para cumplir el plan anual.`,
    todo: 'Plan de acción para el último trimestre con dueños por cartera y por línea de costo. Probá escenarios en el Simulador de cierre.', measure: 'Brecha del cierre proyectado, revisada cada mes.', go: () => goTab('sim'), goLbl: 'Abrir simulador ›' });
  if (ms.length === 1) { const prev = range(lm - 3, lm), now = rentab([lm]), pv = Object.fromEntries(rentab(prev).map(x => [x.ci, x]));
    now.forEach(x => { const p0 = pv[x.ci]; if (p0 && isFinite(p0.mgnp) && x.mgn >= 0 && x.mgnp - p0.mgnp <= -0.08) A.push({ sev: 'warn', impact: Math.abs((x.mgnp - p0.mgnp) * x.ing),
      title: `Se achica el margen de ${x.code}`, sub: `${pp(x.mgnp - p0.mgnp)} contra los 3 meses previos`, what: `${x.nombre}: margen ${pct(x.mgnp, false)} contra ${pct(p0.mgnp, false)} promedio de ${mlab(lm - 3)} a ${mlab(lm - 1)}.`,
      why: `Equivale a ${money((x.mgnp - p0.mgnp) * x.ing)} por mes.`, todo: 'Revisar dotación contra volumen asignado y costos asignados del mes.', measure: 'Margen de vuelta en el promedio trimestral.', go: () => carteraDrawer(x.ci) }); }); }
  return A.sort((a, b) => b.impact - a.impact);
}
let ALERTS = [];
const SEVL = { crit: 'Desvío', warn: 'Atención', good: 'Oportunidad' };
function alertsHtml(A) {
  const N = 6, vis = S.alertsAll ? A : A.slice(0, N), more = A.length - N;
  return `<ul class="alerts">${vis.map((a, i) => `<li class="al ${a.sev}"><button aria-expanded="false"><span class="status ${a.sev}"><i></i>${SEVL[a.sev]}</span>
    <span class="t">${esc(a.title)}<small>${esc(a.sub)}</small></span><span class="imp">${money(a.impact)}<small>impacto</small></span></button>
    <div class="body" hidden><dl><dt>Qué pasó</dt><dd>${esc(a.what)}</dd><dt>Por qué importa</dt><dd>${esc(a.why)}</dd><dt>Qué hacer</dt><dd>${esc(a.todo)}</dd><dt>Cómo se mide</dt><dd>${esc(a.measure)}</dd></dl>
    ${a.go ? `<button class="link" data-go="${i}">${a.goLbl || 'Ver detalle ›'}</button>` : ''}</div></li>`).join('')}</ul>
    ${more > 0 ? `<button class="link" id="moreAl">${S.alertsAll ? 'Ver menos' : `Ver ${more} ${more === 1 ? 'alerta' : 'alertas'} más`}</button>` : ''}${A.length === 0 ? '<p class="note">Sin alertas para este período.</p>' : ''}`;
}
function wireAlerts() {
  view.querySelectorAll('.al>button').forEach(b => b.onclick = () => { const d = b.nextElementSibling; d.hidden = !d.hidden; b.setAttribute('aria-expanded', String(!d.hidden)); });
  view.querySelectorAll('[data-go]').forEach(b => b.onclick = () => ALERTS[+b.dataset.go].go());
  const mo = $('moreAl'); if (mo) mo.onclick = () => { S.alertsAll = !S.alertsAll; $('alBox').innerHTML = alertsHtml(ALERTS); wireAlerts(); };
}
function narrative(ms = months()) {
  const R = pnl(E.REAL, ms), F = pnl(E.FCST, ms), P = pnl(E.PPTO, ms), b = bridge(E.PPTO, ms);
  const [ek, ev] = Object.entries(b.eff).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1]))[0];
  const costs = N2.filter(n => /^[234]/.test(n)).map(n => [n, R.n2[n] - P.n2[n]]).sort((a, c) => c[1] - a[1]);
  const best = costs[0], worst = costs[costs.length - 1], le = LE(), pY = pnl(E.PPTO, range(Y25, DIC + 1));
  return [
    `<b>Ingresos de ${money(R.ing)}</b>: ${pct((R.ing - F.ing) / F.ing)} contra el forecast y ${pct((R.ing - P.ing) / P.ing)} contra el presupuesto. La mayor diferencia con el plan viene de <b>${EFF[ek].toLowerCase()}</b> (${money(ev, { signed: true })}).`,
    `<b>Margen operativo de ${pct(R.mo / R.ing, false)}</b>, ${pp(R.mo / R.ing - P.mo / P.ing)} contra el presupuesto. ${strip(best[0])} ${best[1] >= 0 ? 'ahorra' : 'cuesta'} ${money(Math.abs(best[1]))}${best[1] >= 0 ? '' : ' más'}; ${strip(worst[0])} ${worst[1] < 0 ? 'cuesta' : 'ahorra'} ${money(Math.abs(worst[1]))}${worst[1] < 0 ? ' más' : ''} de lo previsto.`,
    `<b>Cierre proyectado 2025</b>: utilidad neta de ${money(le.un)}, ${pct((le.un - pY.un) / Math.abs(pY.un))} contra el presupuesto anual de ${money(pY.un)}.` ];
}
function miniTable(ms = months()) {
  const R = pnl(E.REAL, ms), F = pnl(E.FCST, ms), P = pnl(E.PPTO, ms);
  const row = (l, f, isPct) => { const r = f(R), fc = f(F), p = f(P), d = isPct ? r - p : (r - p) / Math.abs(p);
    return `<tr><td>${l}</td><td>${isPct ? pct(r, false) : tv(r)}</td><td>${isPct ? pct(fc, false) : tv(fc)}</td><td>${isPct ? pct(p, false) : tv(p)}</td><td class="${cls(d)}">${isPct ? pp(d) : pct(d)}</td></tr>`; };
  return `<div class="tw" style="margin-top:16px"><table><thead><tr><th>${UNIT()}</th><th>Real</th><th>Fcst</th><th>Ppto</th><th>vs Ppto</th></tr></thead><tbody>
    ${row('Ingresos', o => o.ing)}${row('Margen bruto', o => o.mb / o.ing, true)}${row('Margen operativo', o => o.mo / o.ing, true)}${row('Utilidad neta', o => o.un)}</tbody></table></div>`;
}
const BLOCKS = [['Ingresos', 0], ['Costos op.', 1], ['IIBB', 2], ['Estructura', 3], ['No oper.', 4], ['Ganancias', 5]];
function resBridgeOpt(R, Pr, refLbl) { return waterfall(BLOCKS.map(([l, k]) => ({ name: l, v: R.n1[N1[k]] - Pr.n1[N1[k]] })), { startLabel: refLbl, endLabel: 'Real', start: Pr.un, end: R.un }); }
function ingBridgeOpt(b, refLbl) { return waterfall(Object.entries(b.eff).filter(([, v]) => Math.abs(v) > 1).map(([k, v]) => ({ name: EFF[k], v })), { startLabel: refLbl, endLabel: 'Real', start: b.start, end: b.end }); }
function trendOpt(metric) {
  const yr = range(Y25, DIC + 1), sr = SER(), f = metric === 'ing' ? (o => o.ing) : metric === 'mo' ? (o => o.mo / o.ing) : (o => o.un);
  const sv = (e, ms2) => ms2.map(m => cube[e][m] ? f(pnl(e, [m])) : null);
  return lineOpt(yr.map(mlab), [{ ...sr.AA, data: sv(E.REAL, shift(yr, -12)) }, { ...sr.PPTO, data: sv(E.PPTO, yr) }, { ...sr.FCST, data: sv(E.FCST, yr) },
    { ...sr.REAL, data: yr.map(m => m <= CORTE ? f(pnl(E.REAL, [m])) : null) }], { pctAxis: metric === 'mo' });
}
function brxRows(b, refE, ms) {
  const lm = ms[ms.length - 1], refN = refE === E.PPTO ? 'presupuesto' : 'forecast';
  const top = k => Object.entries(b.byC).map(([c, x]) => [+c, x[k]]).sort((a, z) => Math.abs(z[1]) - Math.abs(a[1]))[0] || [0, 0];
  const rc = (e, c, i) => { const q = dr(e, lm, c); return q && q[3] ? pct(q[i], false) : '–'; };
  const ex = {
    vol: v => { const [c, x] = top('vol'); return `Los clientes asignaron ${v < 0 ? 'menos' : 'más'} deuda para gestionar que lo previsto. Mayor efecto: ${D.carteras[c].nombre} (${money(x, { signed: true })}).`; },
    inf: () => { if (refE !== E.PPTO) return 'La inflación real fue distinta a la que usó el forecast; la deuda que se cobra se ajusta con la inflación.';
      const n = lm - Y25 + 1, b0 = kp(E.REAL, Y25 - 1).I, ip = Math.pow(kp(E.PPTO, lm).I / b0, 1 / n) - 1, ir = Math.pow(kp(E.REAL, lm).I / b0, 1 / n) - 1;
      return `El presupuesto suponía ${pct(ip, false)} de inflación mensual y la real promedió ${pct(ir, false)} en 2025. La deuda que se cobra se ajusta con la inflación: con menos inflación, el ingreso crece menos de lo planeado.`; },
    ef: v => { const [c] = top('ef'); return `Se cobró una parte ${v < 0 ? 'menor' : 'mayor'} de la deuda asignada. Mayor efecto: ${D.carteras[c].nombre}, recupero ${rc(E.REAL, c, 5)} contra ${rc(refE, c, 5)} en ${mlab(lm)}.`; },
    fee: () => { const [c] = top('fee'); return `Cambió la comisión acordada con el cliente: ${D.carteras[c].nombre} cobra ${rc(E.REAL, c, 6)} de fee contra ${rc(refE, c, 6)} del ${refN}.`; },
    fx: () => `Las carteras de Uruguay facturan en dólares: dólar real de $ ${nf(0).format(kp(E.REAL, lm).tc)} contra $ ${nf(0).format(kp(refE, lm).tc)} del ${refN} en ${mlab(lm)}.`,
    mix: () => { const [c, x] = top('mix'); return `Carteras que empezaron o terminaron en otra fecha que la prevista. Mayor efecto: ${D.carteras[c].nombre} (${money(x, { signed: true })}).`; } };
  const rows = Object.entries(b.eff).filter(([, v]) => Math.abs(v) >= SCALE() * 0.05), mx = Math.max(1, ...rows.map(([, v]) => Math.abs(v)));
  return rows.map(([k, v]) => `<div class="r"><div class="h"><strong>${EFF[k]}</strong><b class="${cls(v)}">${money(v, { signed: true })}</b></div>
    <div class="bar" aria-hidden="true"><div><span class="n" style="width:${v < 0 ? (Math.abs(v) / mx * 100).toFixed(1) : 0}%"></span></div><div><span class="p" style="width:${v > 0 ? (v / mx * 100).toFixed(1) : 0}%"></span></div></div>
    <p>${esc(ex[k](v))}</p></div>`).join('') || '<p class="note">Sin diferencias relevantes en el período.</p>';
}
function vResumen() {
  const ms = months(), C = cardsData(), refE = E[S.ref], b = bridge(refE, ms), refN = S.ref === 'PPTO' ? 'presupuesto' : 'forecast';
  ALERTS = buildAlerts(ms);
  const rt = Object.fromEntries(rentab(ms).map(x => [x.ci, x]));
  const cars = Object.entries(b.byC).filter(([, x]) => x.rr || x.rp).map(([c, x]) => ({ ci: +c, c: D.carteras[c], r: x.rr, p: x.rp, d: x.rr - x.rp })).sort((a, z) => a.d - z.d);
  const shown = S.allCar ? cars : cars.slice(0, 6);
  view.innerHTML = `
  <section class="sec" id="tKnow"><p class="eyb">Lo que hay que saber · ${perLbl()}</p><ul class="know">${narrative(ms).map(t => `<li><span>${t}</span></li>`).join('')}</ul></section>
  <section class="sec" id="tCards"><div class="sech"><p class="eyb">Indicadores clave · ${perLbl()}</p><button class="link" id="more" aria-expanded="${S.more}">${S.more ? 'Ver menos indicadores' : 'Ver un indicador más'}</button></div>
    <div class="cards">${C.map(cardHtml).join('')}</div>
    <div class="sparkleg" aria-hidden="true"><span><i></i>Real 2025</span><span><i class="p"></i>Presupuesto</span><span><i class="f"></i>Forecast</span></div></section>
  <section class="sec" id="tAlerts"><p class="eyb">Alertas y oportunidades · ordenadas por impacto</p><div id="alBox">${alertsHtml(ALERTS)}</div></section>
  <section class="grid">
    <div class="panel s6" id="tBridge"><div class="ph"><div><h3>${b.end < b.start ? 'Por qué los ingresos no llegaron al ' : 'Por qué los ingresos superaron el '}${refN}</h3><p>${money(b.start)} ${refN} → ${money(b.end)} real · ${perLbl()}</p></div>
      <div class="seg" data-k="ref"><button data-v="PPTO">vs Presupuesto</button><button data-v="FCST">vs Forecast</button></div></div>
      <div class="brx">${brxRows(b, refE, ms)}</div><button class="link" id="toIng">Ver el puente completo y por cartera ›</button></div>
    <div class="panel s6" id="tCar"><div class="ph"><div><h3>Carteras: real contra ${refN}</h3><p>Ingresos en ${UNIT()} · ordenadas por desvío · tocá una para abrirla</p></div></div>
      <div class="tw"><table><thead><tr><th>Cartera</th><th>Real</th><th>${S.ref === 'PPTO' ? 'Presup.' : 'Forecast'}</th><th>Desvío</th><th>Margen</th></tr></thead><tbody>
      ${shown.map(x => { const q = rt[x.ci]; return `<tr class="click" data-ci="${x.ci}" tabindex="0"><td><span class="code">${x.c.code}</span>${esc(x.c.nombre)} <span class="go-r">›</span></td><td>${tv(x.r)}</td><td class="flat">${tv(x.p)}</td>
        <td class="${cls(x.d)}"><b>${x.d > 0 ? '+' : ''}${tv(x.d)}</b></td><td class="${q && q.mgn < 0 ? 'dn' : ''}">${q && isFinite(q.mgnp) ? pct(q.mgnp, false) : '–'}</td></tr>`; }).join('')}</tbody></table></div>
      <button class="link" id="allCar" aria-expanded="${S.allCar}">${S.allCar ? 'Ver solo las 6 con más desvío' : `Ver las ${cars.length} carteras`}</button></div>
    <div class="panel s12"><div class="ph"><div><h3>${S.metric === 'ing' ? 'Ingresos mensuales 2025' : S.metric === 'mo' ? 'Margen operativo mensual 2025' : 'Utilidad neta mensual 2025'}</h3><p>Real hasta ${mlab(CORTE)}; forecast y presupuesto hasta diciembre; gris claro: 2024.</p></div>
      <div class="seg" data-k="metric"><button data-v="ing">Ingresos</button><button data-v="mo">Margen operativo %</button><button data-v="un">Utilidad neta</button></div></div><div class="chart" id="cTrend"></div></div>
  </section>`;
  mk($('cTrend'), trendOpt(S.metric));
  view.querySelectorAll('.card').forEach(c => c.onclick = () => cardDrawer(c.dataset.card));
  $('more').onclick = () => { S.more = !S.more; render(); };
  $('allCar').onclick = () => { S.allCar = !S.allCar; render(); };
  $('toIng').onclick = () => cardDrawer('ing');
  wireRows($('tCar'), tr => carteraDrawer(+tr.dataset.ci));
  wireAlerts();
}
function cardDrawer(k) {
  nextRb = () => cardDrawer(k);
  const ms = months(), R = pnl(E.REAL, ms), F = pnl(E.FCST, ms), P = pnl(E.PPTO, ms), yr = range(Y25, DIC + 1), cats = yr.map(mlab), sr = SER();
  if (k === 'ing') {
    const b = bridge(E.PPTO, ms), bf = bridge(E.FCST, ms);
    const rows = Object.entries(b.byC).filter(([, x]) => x.rr || x.rp).map(([c, x]) => ({ ci: +c, c: D.carteras[c], r: x.rr, p: x.rp, f: bf.byC[c].rp })).sort((a, z) => z.r - a.r);
    const byInd = {}; rows.forEach(x => { byInd[x.c.industria] = (byInd[x.c.industria] || 0) + x.r; });
    openDrawer({ eyebrow: perLbl(), title: 'Ingresos', sub: 'Apertura por driver, por cartera y por industria. Tocá una cartera para ver su detalle.', report: () => dlReport('ingresos'),
      html: `${kvHtml([['Real', money(R.ing)], ['Forecast', money(F.ing)], ['Presupuesto', money(P.ing)], ['vs presupuesto', pct((R.ing - P.ing) / P.ing), cls(R.ing - P.ing)]], 'kv4')}
      <div><h4>Puente contra presupuesto</h4><div class="chart" id="d1"></div></div>
      <div><h4>Por cartera (${UNIT()})</h4><div class="tw"><table><thead><tr><th>Cartera</th><th>Real</th><th>Forecast</th><th>Presup.</th><th>Desvío</th><th>Volumen</th><th>Eficiencia</th><th>Fee</th></tr></thead><tbody>
      ${rows.map(x => { const bc = b.byC[x.ci], d = x.p ? (x.r - x.p) / x.p : NaN; return `<tr class="click" data-ci="${x.ci}" tabindex="0"><td><span class="code">${x.c.code}</span>${esc(x.c.nombre)} <span style="color:var(--accent)">›</span></td><td>${tv(x.r)}</td><td>${tv(x.f)}</td><td>${tv(x.p)}</td>
        <td class="${cls(d)}">${x.p ? arrow(d) + ' ' + pct(d) : 'nueva'}</td><td class="${cls(bc.vol + bc.inf + bc.mix)}">${tv(bc.vol + bc.inf + bc.mix)}</td><td class="${cls(bc.ef)}">${tv(bc.ef)}</td><td class="${cls(bc.fee)}">${tv(bc.fee)}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="note">Volumen incluye inflación de la deuda y altas o bajas de carteras. Efectos en ${UNIT()} contra presupuesto, por descomposición secuencial.</p></div>
      <div><h4>Por industria</h4><div class="chart short" id="d2"></div></div>
      <div><h4>Evolución mensual</h4><div class="chart short" id="d3"></div></div>`,
      after: body => { mk($('d1'), ingBridgeOpt(b, 'Presupuesto')); const ind = Object.entries(byInd).sort((a, z) => a[1] - z[1]); mk($('d2'), barsH(ind.map(x => x[0]), ind.map(x => x[1]))); mk($('d3'), trendOpt('ing'));
        wireRows(body, tr => carteraDrawer(+tr.dataset.ci, true)); } });
  } else if (k === 'mb' || k === 'mo' || k === 'un') {
    const f = o => k === 'un' ? o.un : o[k] / o.ing, sv = (e, ms2) => ms2.map(m => cube[e][m] ? f(pnl(e, [m])) : null);
    const devs = N2.filter(n => k === 'mb' ? /^[123]/.test(n) : k === 'mo' ? /^[1234]/.test(n) : true).map(n => [n, R.n2[n] - P.n2[n], R.n2[n], P.n2[n]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 8);
    openDrawer({ eyebrow: perLbl(), title: { mb: 'Margen bruto', mo: 'Margen operativo', un: 'Utilidad neta' }[k], sub: 'Evolución y líneas que más mueven el resultado contra el presupuesto. Tocá una línea para abrirla.', report: () => dlReport('gestion'),
      html: `${kvHtml(k === 'un' ? [['Real', money(R.un)], ['Forecast', money(F.un)], ['Presupuesto', money(P.un)]] : [['Real', pct(R[k] / R.ing, false)], ['Forecast', pct(F[k] / F.ing, false)], ['Presupuesto', pct(P[k] / P.ing, false)]])}
      <div><h4>Evolución 2025</h4><div class="chart short" id="d1"></div></div>
      ${k === 'un' ? `<div><h4>De la utilidad presupuestada a la real</h4><div class="chart" id="d2"></div></div>` : ''}
      <div><h4>Mayores desvíos contra presupuesto (${UNIT()})</h4><div class="tw"><table><thead><tr><th>Línea</th><th>Real</th><th>Presup.</th><th>Desvío</th></tr></thead><tbody>
      ${devs.map(([n, d, r, p]) => `<tr class="click" data-n2="${esc(n)}" tabindex="0"><td>${esc(n)} <span style="color:var(--accent)">›</span></td><td>${tv(r)}</td><td>${tv(p)}</td><td class="${cls(d)}">${arrow(d)} ${tv(d)}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Desvío positivo mejora el resultado (más ingreso o menos costo).</p></div>`,
      after: body => { mk($('d1'), lineOpt(cats, [{ ...sr.AA, data: sv(E.REAL, shift(yr, -12)) }, { ...sr.PPTO, data: sv(E.PPTO, yr) }, { ...sr.FCST, data: sv(E.FCST, yr) }, { ...sr.REAL, data: yr.map(m => m <= CORTE ? f(pnl(E.REAL, [m])) : null) }], { pctAxis: k !== 'un' }));
        if (k === 'un') mk($('d2'), resBridgeOpt(R, P, 'Presup.'));
        wireRows(body, tr => n2Drawer(tr.dataset.n2, true)); } });
  } else if (k === 'iph') {
    const f = (e, m) => cube[e][m] ? pnl(e, [m]).ing / horas(e, [m]) : null;
    const rows = range(Y25, CORTE + 1).map(m => { const a = kp(E.REAL, m), p = kp(E.PPTO, m), U = S.moneda === 'USD'; return `<tr><td>${mlab(m)}</td><td>${a.ops}</td><td>${a.py}</td><td>${p.pos}</td><td>${money(a.cop / (U ? a.tc : 1), { full: !U })}</td><td>${money(p.cop / (U ? p.tc : 1), { full: !U })}</td><td>${money(f(E.REAL, m), { full: !U })}</td></tr>`; }).join('');
    openDrawer({ eyebrow: perLbl(), title: 'Productividad de la operación', sub: 'Ingreso por hora de posición, dotación y costo por operador.',
      html: `<div><h4>Ingreso por hora</h4><div class="chart short" id="d1"></div></div>
      <div><h4>Dotación y costo por operador</h4><div class="tw"><table><thead><tr><th>Mes</th><th>Operadores</th><th>Posiciones PY</th><th>Posiciones presup.</th><th>Costo operador</th><th>Costo presup.</th><th>Ingreso / hora</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">Hora de posición: 6 horas × 22 días = 132 horas por mes. El costo del operador incluye cargas sociales, SAC y vacaciones.</p></div>`,
      after: () => mk($('d1'), lineOpt(cats, [{ ...sr.PPTO, data: yr.map(m => f(E.PPTO, m)) }, { ...sr.FCST, data: yr.map(m => f(E.FCST, m)) }, { ...sr.REAL, data: yr.map(m => m <= CORTE ? f(E.REAL, m) : null) }], { yFmt: v => nf(0).format(v) })) });
  } else if (k === 'le') {
    const realYr = range(Y25, CORTE + 1), acum = yr.map(m => m <= CORTE ? pnl(E.REAL, range(Y25, m + 1)).un : pnl(E.REAL, realYr).un + pnl(E.FCST, range(CORTE + 1, m + 1)).un);
    const pa = yr.map(m => pnl(E.PPTO, range(Y25, m + 1)).un), le = LE(), pY = pnl(E.PPTO, yr);
    openDrawer({ eyebrow: 'Año 2025', title: 'Cierre proyectado del año', sub: 'Real de enero a septiembre más el forecast de octubre a diciembre.',
      html: `${kvHtml([['Cierre proyectado', money(le.un)], ['Presupuesto anual', money(pY.un)], ['Brecha', money(le.un - pY.un, { signed: true }), cls(le.un - pY.un)]])}
      <div><h4>Utilidad neta acumulada</h4><div class="chart" id="d1"></div></div>
      <p class="note">Ingresos del año: ${money(le.ing)} proyectados contra ${money(pY.ing)} presupuestados (${pct((le.ing - pY.ing) / pY.ing)}). Buena parte de la brecha viene de una inflación menor a la supuesta en el presupuesto (3% mensual), que achica la deuda asignada en pesos.</p>
      <div><button class="btn primary" id="toSim">Probar escenarios en el simulador</button></div>`,
      after: () => { mk($('d1'), lineOpt(cats, [{ ...sr.PPTO, data: pa }, { ...sr.FCST, data: acum.map((v, i) => yr[i] >= CORTE ? v : null) }, { ...sr.REAL, data: acum.map((v, i) => yr[i] <= CORTE ? v : null) }])); $('toSim').onclick = () => { closeDrawer(); goTab('sim'); }; } });
  }
}

/* ===== ESTADO DE RESULTADOS ===== */
function vEerr() {
  const ms = months(), aa = shift(ms, -12), P = { R: pnl(E.REAL, ms), F: pnl(E.FCST, ms), P: pnl(E.PPTO, ms), A: pnl(E.REAL, aa) };
  const cells = (get, pctRow = false) => {
    const r = get(P.R), f = get(P.F), p = get(P.P), a = get(P.A);
    if (pctRow) return `<td>${pct(r, false)}</td><td class="opt">${pct(f, false)}</td><td class="d opt ${cls(r - f)}">${pp(r - f)}</td><td>${pct(p, false)}</td><td class="d ${cls(r - p)}">${pp(r - p)}</td><td class="opt">${pct(a, false)}</td><td class="d opt ${cls(r - a)}">${pp(r - a)}</td>`;
    const d = (x, y) => y ? (x - y) / Math.abs(y) : NaN;
    const dc = (x, y, o) => `<td class="d ${o} ${cls(x - y)}">${Math.abs(x - y) < SCALE() * 0.05 ? '–' : arrow(x - y) + ' ' + tv(x - y)}</td>`;
    return `<td>${tv(r)}</td><td class="opt">${tv(f)}</td>${dc(r, f, 'opt')}<td>${tv(p)}</td>${dc(r, p, '')}<td class="opt">${tv(a)}</td><td class="d opt ${cls(d(r, a))}">${isFinite(d(r, a)) ? pct(d(r, a)) : '–'}</td>`;
  };
  const sfx = S.sinInd ? ' (sin indemn.)' : ''; let rows = '';
  const n1row = n => {
    const open = !!S.open[n];
    rows += `<tr class="n1 ${open ? 'open' : ''}"><td><button data-n1="${esc(n)}" aria-expanded="${open}"><span class="chev">▸</span>${esc(n.replace(/^(\d) /, '$1 · '))}</button></td>${cells(o => o.n1[n])}</tr>`;
    if (!open) return;
    N2OF[n].forEach(z => {
      const its = IN2[z], multi = its.length > 1, o2 = multi && !!S.open2[z];
      rows += `<tr class="n2 ${o2 ? 'open' : ''}" data-n2="${esc(z)}" tabindex="0"><td>${multi ? `<button class="tg" data-n2t="${esc(z)}" aria-expanded="${o2}" aria-label="Ver ítems de ${esc(z)}"><span class="chev">▸</span></button>` : ''}<span class="code">${z.split(' ')[0]}</span>${esc(strip(z))}<span class="det">›</span></td>${cells(o => o.n2[z])}</tr>`;
      if (o2) its.forEach(i => { rows += `<tr class="n3"><td>${esc(IT[i].item)}${S.sinInd && i === IND ? ' <span class="code">excluido</span>' : ''}</td>${cells(o => o.it[i])}</tr>`; });
    });
  };
  const calc = (lbl, f) => { rows += `<tr class="calc"><td>${lbl}${sfx}</td>${cells(f)}</tr>`; };
  const pc = (lbl, f) => { rows += `<tr class="pct"><td>${lbl}</td>${cells(f, true)}</tr>`; };
  n1row(N1[0]); n1row(N1[1]); n1row(N1[2]); calc('Margen bruto', o => o.mb); pc('% sobre ingresos', o => o.mb / o.ing);
  n1row(N1[3]); calc('Margen operativo', o => o.mo); pc('% sobre ingresos', o => o.mo / o.ing);
  n1row(N1[4]); calc('Resultado antes de impuestos', o => o.uai);
  n1row(N1[5]); calc('Utilidad neta', o => o.un); pc('% sobre ingresos', o => o.un / o.ing);
  const allOpen = N1.every(n => S.open[n]);
  view.innerHTML = `<section class="grid"><div class="panel s12">
    <div class="ph"><div><h3>Estado de resultados de gestión · ${perLbl()} (${UNIT()})</h3><p>▸ de un bloque abre sus cuentas; ▸ de una cuenta abre sus ítems; tocá la fila para ver evolución, carteras y drivers. Desvío positivo mejora el resultado.</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn only-m" id="allCols">${S.allCols ? 'Menos columnas' : 'Todas las columnas'}</button><button class="btn" id="expAll">${allOpen ? 'Cerrar todo' : 'Abrir todo'}</button><button class="btn" id="dlEerr">Descargar Excel</button><button class="btn primary" id="conc">De contable a gestión</button></div></div>
    <div class="tw"><table class="eerr ${S.allCols ? 'all' : ''}"><thead><tr><th>Cuenta</th><th>Real</th><th class="opt">Forecast</th><th class="opt">Desvío</th><th>Presupuesto</th><th>Desvío</th><th class="opt">Año ant.</th><th class="opt">Var. a.a.</th></tr></thead><tbody>${rows}</tbody></table></div>
  </div></section>`;
  view.querySelectorAll('[data-n1]').forEach(b => b.onclick = () => { S.open[b.dataset.n1] = !S.open[b.dataset.n1]; render(); });
  view.querySelectorAll('[data-n2t]').forEach(b => b.onclick = e => { e.stopPropagation(); S.open2[b.dataset.n2t] = !S.open2[b.dataset.n2t]; render(); });
  view.querySelectorAll('tr.n2').forEach(tr => { const go = () => n2Drawer(tr.dataset.n2); tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter' && e.target === tr) go(); }; });
  $('expAll').onclick = () => { N1.forEach(n => S.open[n] = !allOpen); if (allOpen) S.open2 = {}; render(); };
  $('allCols').onclick = () => { S.allCols = !S.allCols; render(); };
  $('conc').onclick = concDrawer;
  $('dlEerr').onclick = () => exportEerr();
}
function n2Drawer(n2, push = false) {
  nextRb = p => n2Drawer(n2, p);
  const ms = months(), yr = range(Y25, DIC + 1), cats = yr.map(mlab), sr = SER(), its = IN2[n2], n1 = IT[its[0]].n1;
  const r = val(E.REAL, ms, its), f = val(E.FCST, ms, its), p = val(E.PPTO, ms, its), a = val(E.REAL, shift(ms, -12), its);
  const sv = (e, ms2) => ms2.map(m => cube[e][m] ? val(e, [m], its) : null);
  const isRev = /^1/.test(n1), isEst = /^4/.test(n1), isNoOp = /^[56]/.test(n1);
  let byC = [];
  if (!isNoOp) {
    const totIng = val(E.REAL, ms, ING);
    byC = D.carteras.map((c, ci) => { const rr = isEst ? r * val(E.REAL, ms, ING, ci) / totIng : val(E.REAL, ms, its, ci), pr = isEst ? null : val(E.PPTO, ms, its, ci); return { ci, c, r: rr, p: pr }; }).filter(x => Math.abs(x.r) > 0.5 || (x.p && Math.abs(x.p) > 0.5)).sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  }
  const tot = byC.reduce((s, x) => s + Math.abs(x.r), 0) || 1, mx = Math.max(1, ...byC.map(x => Math.abs(x.r)));
  const drv = [...new Set(its.map(i => IT[i].driver).filter(Boolean))].join(' · ');
  let extra = '';
  if (n2 === '2.1 Remuneraciones') {
    const U = S.moneda === 'USD'; let dDot = 0, dCu = 0;
    ms.forEach(m => { const ka = kp(E.REAL, m), kpp = kp(E.PPTO, m), fa = U ? ka.tc : 1, fp = U ? kpp.tc : 1; dDot -= (ka.ops - kpp.ops) * kpp.cop / fp; dCu -= ka.ops * (ka.cop / fa - kpp.cop / fp); });
    const opR = val(E.REAL, ms, [ITEM['Operadores']]), opP = val(E.PPTO, ms, [ITEM['Operadores']]);
    extra = `<div><h4>Operadores: dotación contra costo unitario</h4>${kvHtml([['Efecto dotación', money(dDot, { signed: true }), cls(dDot)], ['Efecto paritarias y costo', money(dCu, { signed: true }), cls(dCu)], ['Otros', money(opR - opP - dDot - dCu, { signed: true })]])}
      <p class="note">Costo de operadores = dotación × costo por operador. Signo positivo = menos costo que el presupuesto.</p></div>`;
  }
  if (isRev) extra = `<div><h4>Puente contra presupuesto</h4><div class="chart" id="d3"></div></div>`;
  const itemRows = its.length > 1 ? `<div><h4>Ítems (${UNIT()})</h4><div class="tw"><table><thead><tr><th>Ítem</th><th>Real</th><th>Forecast</th><th>Presup.</th><th>Desvío</th></tr></thead><tbody>${its.map(i => { const x = val(E.REAL, ms, [i]), y = val(E.FCST, ms, [i]), z = val(E.PPTO, ms, [i]); return `<tr><td>${esc(IT[i].item)}</td><td>${tv(x)}</td><td>${tv(y)}</td><td>${tv(z)}</td><td class="${cls(x - z)}">${arrow(x - z)} ${tv(x - z)}</td></tr>`; }).join('')}</tbody></table></div></div>` : '';
  const carterasHtml = byC.length ? `<div><h4>${isEst ? 'Por cartera, asignado por % de ingresos' : 'Por cartera'} (${UNIT()})</h4><div class="tw"><table><thead><tr><th>Cartera</th><th>Real</th>${isEst ? '' : '<th>Presup.</th><th>Desvío</th>'}<th>% del total</th></tr></thead><tbody>
    ${byC.map(x => `<tr class="click" data-ci="${x.ci}" tabindex="0"><td><span class="code">${x.c.code}</span>${esc(x.c.nombre)} <span style="color:var(--accent)">›</span></td><td>${tv(x.r)}<span class="bar-in" style="width:${Math.round(36 * Math.abs(x.r) / mx)}px"></span></td>${isEst ? '' : `<td>${tv(x.p)}</td><td class="${cls(x.r - x.p)}">${arrow(x.r - x.p)} ${tv(x.r - x.p)}</td>`}<td>${pct(Math.abs(x.r) / tot, false)}</td></tr>`).join('')}</tbody></table></div>
    ${isEst ? '<p class="note">Gasto de estructura: no depende de cada cartera; se reparte por participación en los ingresos solo para medir rentabilidad.</p>' : ''}</div>` : '';
  openDrawer({ eyebrow: `${perLbl()} · ${UNIT()}`, title: n2, sub: drv ? `Driver: ${drv}` : 'Cuenta no operacional: no se asigna a carteras', report: isRev ? () => dlReport('ingresos') : null,
    html: `${kvHtml([['Real', money(r)], ['Forecast', money(f)], ['Presupuesto', money(p)], ['Año anterior', money(a)]], 'kv4')}
    <div><h4>Evolución mensual 2025</h4><div class="chart short" id="d1"></div></div>${extra}${carterasHtml}${itemRows}`,
    after: body => { mk($('d1'), lineOpt(cats, [{ ...sr.AA, data: sv(E.REAL, shift(yr, -12)) }, { ...sr.PPTO, data: sv(E.PPTO, yr) }, { ...sr.FCST, data: sv(E.FCST, yr) }, { ...sr.REAL, data: yr.map(m => m <= CORTE ? val(E.REAL, [m], its) : null) }]));
      if (isRev) mk($('d3'), ingBridgeOpt(bridge(E.PPTO, ms), 'Presupuesto'));
      wireRows(body, tr => carteraDrawer(+tr.dataset.ci, true)); } }, push);
}
function concDrawer() {
  nextRb = () => concDrawer();
  const ms = months(), U = S.moneda === 'USD', by = {};
  D.conc.forEach(([m, c, v]) => { if (ms.includes(m)) by[c] = (by[c] || 0) + v / (U ? kp(E.REAL, m).tc : 1); });
  const g = pnl(E.REAL, ms).uai, tot = Object.values(by).reduce((a, b) => a + b, 0), cont = g - tot;
  const steps = Object.entries(by).filter(([, v]) => Math.abs(v) > 1).map(([name, v]) => ({ name: name.split(':')[0].replace('Recupero intercompany devengado mensual', 'Recupero IC devengado'), v }));
  openDrawer({ eyebrow: perLbl(), title: 'De contable a gestión', sub: 'Ajustes que llevan el resultado contable al de gestión, antes de impuestos.',
    html: `${kvHtml([['Resultado contable', money(cont)], ['Ajustes', money(tot, { signed: true })], ['Resultado de gestión', money(g)]])}
    <div><h4>Puente de ajustes (${UNIT()})</h4><div class="chart" id="d1"></div></div>
    <div><h4>Criterios aplicados</h4><div class="tw"><table><thead><tr><th>Ajuste</th><th>${UNIT()}</th></tr></thead><tbody>${Object.entries(by).map(([c, v]) => `<tr><td style="white-space:normal">${esc(c)}</td><td class="${cls(v)}">${tv(v)}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">SMS: se provisionan; se elimina la desprovisión y la factura del mes anterior y queda solo la provisión del mes. Mailing y telefonía: la factura llega con un mes de atraso; se reemplaza por el consumo del mes. Bonificaciones y honorarios con cedentes de Paraguay se eliminan por ser intragrupo. El recupero intercompany se devenga todos los meses aunque se facture por trimestre. Las indemnizaciones se reclasifican desde sueldos a su propia línea, sin efecto en el total.</p></div>`,
    after: () => mk($('d1'), waterfall(steps, { startLabel: 'Contable', endLabel: 'Gestión', start: cont, end: g, startColor: T('--ppto') })) });
}

/* ===== RENTABILIDAD ===== */
const SK_GROUPS = [['Supervisión y apoyo', ['Supervisión', 'Calidad', 'Back Office', 'Ejecutivos de cuenta', 'Gerencia de Operaciones']], ['Telefonía', ['Telefonía celular', 'Telefonía LDN', 'Telefonía local y 0800']],
  ['Licencias', ['Licencias discador/CRM']], ['SMS', ['SMS']], ['Mailing y WhatsApp', ['Mailing', 'WhatsApp']], ['Bocas e informes', ['Bocas de cobranza', 'Informes comerciales']], ['Indemnizaciones', ['Indemnizaciones']]];
const CAT_L = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'], CAT_D = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'];
function sankeyOpt(ms, rows) {
  const cat = isDark() && !TOV ? CAT_D : CAT_L, links = [], gtot = {};
  SK_GROUPS.forEach(([g, list]) => { const ids = list.map(n => ITEM[n]); rows.forEach(x => { const v = -val(E.REAL, ms, ids, x.ci); if (v > 0.5) { links.push({ source: g, target: x.code, value: v }); gtot[g] = (gtot[g] || 0) + v; } }); });
  const ctot = {}; links.forEach(l => ctot[l.target] = (ctot[l.target] || 0) + l.value);
  const nodes = SK_GROUPS.filter(([g]) => gtot[g]).map(([g]) => ({ name: g, itemStyle: { color: cat[SK_GROUPS.findIndex(x => x[0] === g)], borderWidth: 0 } }))
    .concat(Object.entries(ctot).sort((a, b) => b[1] - a[1]).map(([c]) => ({ name: c, itemStyle: { color: T('--ppto'), borderWidth: 0 } })));
  return { tooltip: tip({ trigger: 'item', formatter: p => p.dataType === 'edge' ? `${esc(p.data.source)} → <b>${esc(p.data.target)}</b><br>${money(p.data.value)}` : `<b>${esc(p.name)}</b><br>${money(p.value)}` }),
    series: [{ type: 'sankey', left: 4, right: 60, top: 8, bottom: 8, nodeWidth: 12, nodeGap: 10, layoutIterations: 0, emphasis: { focus: 'adjacency' }, data: nodes, links,
      lineStyle: { color: 'source', opacity: .38, curveness: .5 }, label: { color: T('--ink-2'), fontSize: 11, fontFamily: T('--f-body') } }] };
}
function marginBarsOpt(rows) {
  const sorted = [...rows].sort((a, b) => a.mgnp - b.mgnp), avg = rows.reduce((s, x) => s + x.mgn, 0) / rows.reduce((s, x) => s + x.ing, 0);
  return { grid: { left: 6, right: 54, top: 24, bottom: 6, containLabel: true },
    tooltip: tip({ trigger: 'item', formatter: p => { const x = sorted[p.dataIndex]; return `<b>${esc(x.nombre)}</b><br>Margen ${pct(x.mgnp, false)} · ${money(x.mgn)}<br>Ingreso ${money(x.ing)}`; } }),
    xAxis: axisVal(pctAx), yAxis: axisCat(sorted.map(x => x.code), { axisLabel: { color: T('--ink-2'), fontFamily: T('--f-mono'), fontSize: 11 } }),
    series: [{ type: 'bar', barWidth: '58%', data: sorted.map(x => ({ value: x.mgnp, itemStyle: { color: x.mgnp < 0 ? T('--crit') : x.mgnp < 0.15 ? T('--serious') : T('--real'), borderRadius: x.mgnp < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', color: T('--ink-2'), fontSize: 11, formatter: p => pct(p.value, false) },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: T('--ink-3'), type: [3, 3] }, label: { show: true, position: 'end', formatter: () => 'Promedio ' + pct(avg, false), color: T('--ink-3'), fontSize: 10.5 }, data: [{ xAxis: avg }] } }] };
}
function vCarteras() {
  const ms = months(), rows = rentab(ms).sort((a, b) => b.mgn - a.mgn);
  const tot = rows.reduce((s, x) => s + x.mgn, 0), pos = rows.filter(x => x.mgn > 0), top3 = pos.slice(0, 3).reduce((s, x) => s + x.mgn, 0), neg = rows.filter(x => x.mgn < 0);
  const prev = ms.length === 1 ? Object.fromEntries(rentab(range(S.m - 3, S.m)).map(x => [x.ci, x])) : null, maxIng = Math.max(...rows.map(x => x.ing));
  const title = `3 carteras explican el ${pct(top3 / Math.max(1, pos.reduce((s, x) => s + x.mgn, 0)), false)} del margen positivo${neg.length ? `; ${neg.map(x => x.code).join(', ')} ${neg.length > 1 ? 'pierden' : 'pierde'} ${money(-neg.reduce((s, x) => s + x.mgn, 0))}` : ''}`;
  view.innerHTML = `<div class="formula"><span>Margen de cartera =</span><b>ingreso</b><span>− costos directos (operadores, posiciones PY, IIBB)</span><span>− costos compartidos asignados por driver</span>${S.estructura ? '<span>− estructura por % de ingresos</span>' : ''}</div>
  <section class="grid">
    <div class="panel s7"><div class="ph"><div><h3>${title}</h3><p>Margen ${S.estructura ? 'después de estructura' : 'de contribución'} sobre ingresos · ${perLbl()}</p></div>
      <div class="seg" data-k="estructura"><button data-v="false">Contribución</button><button data-v="true">Con estructura</button></div></div><div class="chart tall" id="cMgn"></div></div>
    <div class="panel s5"><div class="ph"><div><h3>Debajo de la diagonal la cartera gana; arriba, pierde</h3><p>Ingreso contra costo por posición y mes. Tamaño = posiciones.</p></div></div><div class="chart tall" id="cSc"></div></div>
    <div class="panel s12"><div class="ph"><div><h3>Detalle por cartera (${UNIT()})</h3><p>Tocá una fila para ver ingresos, drivers, proyección y costos de la cartera; desde ahí se descarga el informe para el supervisor.</p></div><button class="btn" id="dlCart">Descargar Excel</button></div>
    <div class="tw"><table><thead><tr><th>Cartera</th><th>Industria</th><th>Ingreso</th><th>Costo directo</th><th>Costo asignado</th>${S.estructura ? '<th>Estructura</th>' : ''}<th>Margen</th><th>Margen %</th>${prev ? '<th>vs 3 meses</th>' : ''}<th>Posiciones</th><th>Ingreso / pos.</th><th>Costo / pos.</th></tr></thead><tbody>
    ${rows.map(x => { const p0 = prev && prev[x.ci], dpp = p0 && isFinite(p0.mgnp) ? x.mgnp - p0.mgnp : NaN; return `<tr class="click" data-ci="${x.ci}" tabindex="0"><td><span class="code">${x.code}</span>${esc(x.nombre)} <span style="color:var(--accent)">›</span></td><td>${esc(x.industria)}</td>
      <td>${tv(x.ing)}<span class="bar-in" style="width:${Math.round(40 * x.ing / maxIng)}px"></span></td><td>${tv(x.dir)}</td><td>${tv(x.asg)}</td>${S.estructura ? `<td>${tv(x.est)}</td>` : ''}
      <td class="${cls(x.mgn)}"><b>${tv(x.mgn)}</b></td><td class="${x.mgnp < 0 ? 'dn' : ''}">${pct(x.mgnp, false)}</td>${prev ? `<td class="${cls(dpp)}">${isFinite(dpp) ? pp(dpp) : '–'}</td>` : ''}<td>${x.pos}</td><td>${money(x.ingPos)}</td><td>${money(x.costPos)}</td></tr>`; }).join('')}
    <tr class="calc"><td>Total carteras</td><td></td><td>${tv(rows.reduce((s, x) => s + x.ing, 0))}</td><td>${tv(rows.reduce((s, x) => s + x.dir, 0))}</td><td>${tv(rows.reduce((s, x) => s + x.asg, 0))}</td>${S.estructura ? `<td>${tv(rows.reduce((s, x) => s + x.est, 0))}</td>` : ''}<td>${tv(tot)}</td><td>${pct(tot / rows.reduce((s, x) => s + x.ing, 0), false)}</td>${prev ? '<td></td>' : ''}<td>${rows.reduce((s, x) => s + x.pos, 0)}</td><td></td><td></td></tr>
    </tbody></table></div></div>
    <div class="panel s12"><div class="ph"><div><h3>Cómo se reparten los costos compartidos</h3><p>Cada costo va a las carteras según su driver: posiciones, minutos, mensajes, mails o pagos · ${perLbl()} · ${money(rows.reduce((s, x) => s - x.asg, 0))} asignados. Tocá una cartera para abrirla.</p></div></div><div class="chart" id="cSk" style="height:500px"></div></div>
  </section>`;
  mk($('cMgn'), marginBarsOpt(rows));
  const mxX = Math.max(...rows.map(x => x.ingPos)) * 1.12, mxY = Math.max(...rows.map(x => x.costPos)) * 1.3, maxPos = Math.max(...rows.map(x => x.pos));
  mk($('cSc'), { grid: { left: 6, right: 18, top: 24, bottom: 26, containLabel: true },
    tooltip: tip({ trigger: 'item', formatter: p => { if (p.seriesType !== 'scatter') return ''; const x = rows[p.dataIndex]; return `<b>${esc(x.nombre)}</b><br>Ingreso por posición ${money(x.ingPos)}<br>Costo por posición ${money(x.costPos)}<br>${x.pos} posiciones · margen ${pct(x.mgnp, false)}`; } }),
    xAxis: axisVal(v => money(v).replace(cur(), ''), { min: 0, max: mxX, name: 'Ingreso por posición', nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: T('--ink-3'), fontSize: 11 } }),
    yAxis: axisVal(v => money(v).replace(cur(), ''), { min: 0, max: mxY, name: 'Costo por posición', nameTextStyle: { color: T('--ink-3'), fontSize: 11, align: 'left' } }),
    series: [{ type: 'line', data: [[0, 0], [Math.min(mxX, mxY), Math.min(mxX, mxY)]], symbol: 'none', silent: true, lineStyle: { color: T('--ink-3'), type: [4, 4], width: 1 } },
      { type: 'scatter', data: rows.map(x => [x.ingPos, x.costPos]), symbolSize: (v, p) => 8 + 26 * Math.sqrt(rows[p.dataIndex].pos / maxPos),
        itemStyle: { color: p => rows[p.dataIndex].mgn < 0 ? T('--crit') : T('--real'), opacity: .85, borderColor: T('--surface'), borderWidth: 2 },
        label: { show: true, position: 'right', formatter: p => rows[p.dataIndex].code, color: T('--ink-2'), fontSize: 10.5, fontFamily: T('--f-mono') }, labelLayout: { hideOverlap: true } }] });
  const sc = mk($('cSk'), sankeyOpt(ms, rows));
  if (sc) sc.on('click', p => { if (p.dataType === 'node') { const r = rows.find(x => x.code === p.name); if (r) carteraDrawer(r.ci); } });
  wireRows(view, tr => carteraDrawer(+tr.dataset.ci));
  $('dlCart').onclick = () => exportCarteras(rows);
}
function carteraData(ci, ms) {
  const c = D.carteras[ci], x = rentab(ms).find(r => r.ci === ci), yr = range(Y25, DIC + 1), lm = ms[ms.length - 1];
  const r = dr(E.REAL, lm, ci), p = dr(E.PPTO, lm, ci), b = bridge(E.PPTO, ms).byC[ci];
  const comp = IT.map((it, i) => [it.item, -val(E.REAL, ms, [i], ci)]).filter(([, v]) => v > 0.5).sort((a, z) => z[1] - a[1]);
  const totK = k => range(0, NC).reduce((s, cc) => s + (dr(E.REAL, lm, cc)?.[k] || 0), 0);
  const share = k => r && totK(k) ? r[k] / totK(k) : NaN;
  const mg = yr.map(m => { if (m > CORTE) return null; const q = rentab([m]).find(z => z.ci === ci); return q && q.ing ? q.mgnp : null; });
  const fa = range(Y25, CORTE + 1).map(m => ({ m, r: val(E.REAL, [m], ING, ci), f: val(E.FCST, [m], ING, ci), p: val(E.PPTO, [m], ING, ci) })).filter(z => z.r || z.f || z.p);
  const drvSer = idx => ({ real: yr.map(m => { if (m > CORTE) return null; const q = dr(E.REAL, m, ci); return q && q[3] ? (idx === 'deuda' ? q[3] * q[4] : q[idx]) : null; }), ppto: yr.map(m => { const q = dr(E.PPTO, m, ci); return q && q[3] ? (idx === 'deuda' ? q[3] * q[4] : q[idx]) : null; }) });
  const prev = rentab(range(lm - 3, lm)).find(z => z.ci === ci);
  const topics = [];
  if (r && p && p[5]) { const er = r[5] / p[5] - 1; topics.push(`Recupero de ${pct(r[5], false)} contra ${pct(p[5], false)} presupuestado (${pct(er)}): ${er < -0.05 ? 'revisar plan de contacto y acuerdos de pago.' : er > 0.05 ? 'qué funcionó para sostenerlo.' : 'en línea con el plan.'}`); }
  if (r && p && Math.abs(r[6] - p[6]) > 1e-6) topics.push(`Fee de ${pct(r[6], false)} contra ${pct(p[6], false)} presupuestado: efecto ${money(b ? b.fee : 0, { signed: true })}.`);
  if (prev && x && isFinite(prev.mgnp)) topics.push(`Margen ${pct(x.mgnp, false)} contra ${pct(prev.mgnp, false)} de los tres meses previos (${pp(x.mgnp - prev.mgnp)}).`);
  const lastFa = fa[fa.length - 1]; if (lastFa && lastFa.f) topics.push(`Proyección de ${mlab(lastFa.m)}: ${money(lastFa.f)} contra ${money(lastFa.r)} real (${pct((lastFa.r - lastFa.f) / lastFa.f)}).`);
  if (comp[0]) topics.push(`Mayor costo: ${comp[0][0]} (${money(comp[0][1])}); posiciones: ${x ? x.pos : '–'}.`);
  return { c, x, r, p, b, comp, share, mg, fa, drvSer, topics, lm };
}
function carteraDrawer(ci, push = false) {
  nextRb = p => carteraDrawer(ci, p);
  const ms = months(), d = carteraData(ci, ms), { c, x, b } = d, yr = range(Y25, DIC + 1), cats = yr.map(mlab), sr = SER();
  if (!x) { nextRb = null; toast('La cartera no tuvo actividad en el período'); return; }
  const preC = c.moneda === 'USD' ? 'US$ ' : '$ ';
  openDrawer({ eyebrow: `${c.code} · ${c.industria} · ${perLbl()}`, title: c.nombre, sub: `Facturación en ${c.moneda === 'USD' ? 'dólares' : 'pesos'} · ${c.negocio}`, report: () => dlReport('cartera', ci),
    html: `${kvHtml([['Ingreso', money(x.ing)], ['Margen', money(x.mgn), cls(x.mgn)], ['Margen %', pct(x.mgnp, false)], ['Posiciones', x.pos]], 'kv4')}
    <div><h4>Temas para la reunión con el supervisor</h4><ul class="read">${d.topics.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
    <div><h4>De dónde viene el ingreso: deuda × recupero × fee</h4><div class="minis">
      <div><h5>Deuda asignada</h5><div class="chart mini" id="m1"></div></div><div><h5>% de recupero</h5><div class="chart mini" id="m2"></div></div><div><h5>Fee</h5><div class="chart mini" id="m3"></div></div></div>
      <p class="note">Línea llena: real 2025. Punteada: presupuesto.</p></div>
    ${b && b.rp ? `<div><h4>Ingreso contra presupuesto</h4><div class="chart short" id="d0"></div></div>` : ''}
    <div><h4>Cómo fue la proyección (${UNIT()})</h4><div class="tw"><table><thead><tr><th>Mes</th><th>Real</th><th>Forecast</th><th>Desvío</th><th>Presup.</th></tr></thead><tbody>
      ${d.fa.map(z => `<tr><td>${mlab(z.m)}</td><td>${tv(z.r)}</td><td>${tv(z.f)}</td><td class="${cls(z.r - z.f)}">${z.f ? pct((z.r - z.f) / z.f) : '–'}</td><td>${tv(z.p)}</td></tr>`).join('')}</tbody></table></div></div>
    <div><h4>Margen mensual 2025</h4><div class="chart short" id="d1"></div></div>
    <div><h4>Composición de costos (${UNIT()})</h4><div class="chart" id="d2" style="height:${Math.max(180, d.comp.length * 26 + 30)}px"></div><p class="note">Color de marca: costos directos de la cartera. Gris: compartidos asignados por driver.</p></div>
    <div><h4>Participación en los drivers (${mlab(d.lm)})</h4>${kvHtml([['Minutos', pct(d.share(10), false)], ['SMS', pct(d.share(11), false)], ['Mails', pct(d.share(12), false)], ['Pagos', pct(d.share(13), false)], ['Consultas', pct(d.share(14), false)]])}
      <p class="note">Cada costo compartido se reparte en proporción a estos drivers: si la cartera usa el ${pct(d.share(11), false)} de los SMS, absorbe esa parte de la factura.</p></div>`,
    after: () => {
      const mini = (id, s, fmt) => mk($(id), { grid: { left: 4, right: 8, top: 8, bottom: 4, containLabel: true }, tooltip: tip({ valueFormatter: v => v == null ? '–' : fmt(v) }),
        xAxis: axisCat(cats, { boundaryGap: false, axisLabel: { show: false } }), yAxis: axisVal(fmt, { scale: true, splitNumber: 3, axisLabel: { color: T('--ink-3'), fontSize: 10, formatter: fmt } }),
        series: [{ type: 'line', name: 'Presupuesto', data: s.ppto, symbol: 'none', lineStyle: { color: T('--ppto'), type: [2, 3], width: 1.5 }, itemStyle: { color: T('--ppto') } }, { type: 'line', name: 'Real', data: s.real, symbol: 'none', lineStyle: { color: T('--real'), width: 2 }, itemStyle: { color: T('--real') } }] });
      mini('m1', d.drvSer('deuda'), v => money(v, { pre: preC })); mini('m2', d.drvSer(5), v => pct(v, false)); mini('m3', d.drvSer(6), v => pct(v, false));
      if (b && b.rp) mk($('d0'), waterfall(['vol', 'inf', 'ef', 'fee', 'fx', 'mix'].filter(k => Math.abs(b[k]) > 1).map(k => ({ name: EFF[k], v: b[k] })), { startLabel: 'Presupuesto', endLabel: 'Real', start: b.rp, end: b.rr }));
      mk($('d1'), lineOpt(cats, [{ ...sr.REAL, name: 'Margen %', data: d.mg }], { pctAxis: true }));
      const comp = [...d.comp].reverse(); mk($('d2'), barsH(comp.map(z => z[0]), comp.map(z => z[1]), { colors: comp.map(z => IT[ITEM[z[0]]].tipo === 'Directo' ? T('--real') : T('--ppto')) }));
    } }, push);
}

/* ===== SIMULADOR DE CIERRE ===== */
const FCM = range(CORTE + 1, DIC + 1);
const SIM0 = { infl: 0.023, parit: 0.02, tc: kp(E.FCST, DIC).tc, de: 0, dv: 0 };
S.sim = { ...SIM0 };
function simModel(p) {
  const r0 = kp(E.REAL, CORTE); let Is = r0.I, Ps = r0.P, tps = r0.tc, tpf = r0.tc; const out = [];
  FCM.forEach((m, k) => {
    const f = kp(E.FCST, m); Is *= 1 + p.infl; Ps *= 1 + p.parit;
    const iR = Is / f.I, pR = Ps / f.P, tcS = r0.tc + (p.tc - r0.tc) * (k + 1) / FCM.length, tR = tcS / f.tc, dS = tcS - tps, dF = f.tc - tpf; tps = tcS; tpf = f.tc;
    const a = cube[E.FCST][m], it = new Float64Array(NI);
    for (let cc = 0; cc <= NC; cc++) { const ci = cc - 1, revF = (isUSDc(ci) ? tR : iR) * (1 + p.dv) * (1 + p.de);
      for (let i = 0; i < NI; i++) { const v = a[cc * NI + i]; if (!v || (S.sinInd && i === IND)) continue; const g = GRP[i];
        it[i] += v * (g === 'rev' || g === 'iibb' ? revF : g === 'rem' || g === 'ic' ? pR : g === 'usd' ? tR : g === 'fix' ? 1 : g === 'difc' ? (Math.abs(dF) > 1e-9 ? dS / dF : 1) : g === 'tax' ? 0 : iR); } }
    const o = fromItems(it), tax = o.uai > 0 ? -0.35 * o.uai : 0; o.un = o.uai + tax; o.tc = tcS; out.push(o);
  });
  return out;
}
function simResult(p) {
  const U = S.moneda === 'USD', m0 = simModel(SIM0), m1 = simModel(p);
  return FCM.map((m, k) => { const base = pnl(E.FCST, [m]), d = x => U ? m1[k][x] / m1[k].tc - m0[k][x] / m0[k].tc : m1[k][x] - m0[k][x];
    return { m, ing: base.ing + d('ing'), mo: base.mo + d('mo'), un: base.un + d('un') }; });
}
const SIMIN = [['infl', 'Inflación mensual oct–dic', 0, 0.08, 0.001, '%'], ['parit', 'Paritaria mensual', 0, 0.08, 0.001, '%'], ['tc', 'Tipo de cambio a diciembre', 1200, 2400, 5, 'n'],
  ['de', 'Recupero contra forecast', -0.2, 0.2, 0.01, '±'], ['dv', 'Volumen asignado contra forecast', -0.2, 0.2, 0.01, '±']];
const SIMPRE = { base: { ...SIM0 }, infla: { ...SIM0, infl: 0.04, parit: 0.035 }, deva: { ...SIM0, tc: 1800, infl: 0.035 }, rec: { ...SIM0, de: 0.05 }, vol: { ...SIM0, dv: -0.1 } };
const fmtS = (v, t) => t === '%' ? nf(1).format(v * 100) + '%' : t === '±' ? pct(v) : nf(0).format(v);
function vSim() {
  const yr = range(Y25, DIC + 1);
  view.innerHTML = `<div class="two"><div>
    <div class="presets" role="group" aria-label="Escenarios"><button class="btn" data-sp="base">Base</button><button class="btn" data-sp="infla">Inflación 4%</button><button class="btn" data-sp="deva">Devaluación</button><button class="btn" data-sp="rec">Recupero +5%</button><button class="btn" data-sp="vol">Volumen −10%</button></div>
    <fieldset><legend>Supuestos de octubre a diciembre</legend>${SIMIN.map(([id, lab, mn, mx, st, t]) => `<div class="in"><label for="s-${id}">${lab}</label><output id="so-${id}">${fmtS(S.sim[id], t)}</output><input type="range" id="s-${id}" min="${mn}" max="${mx}" step="${st}" value="${S.sim[id]}" data-id="${id}" data-t="${t}"></div>`).join('')}</fieldset>
    <p class="note">Cómo reacciona cada costo: sueldos con la paritaria; posiciones en Paraguay, licencias, mailing, WhatsApp e infraestructura con el dólar; telefonía, SMS, alquileres y servicios con la inflación; amortizaciones fijas. Los ingresos en pesos siguen a la inflación de la deuda; los de Uruguay, al dólar. Ganancias al 35%.</p>
  </div><div class="grid" style="align-content:start">
    <div class="panel s12"><div class="ph"><div><h3>Cierre 2025 simulado</h3><p>Real enero–septiembre más octubre–diciembre recalculado con los supuestos.</p></div></div><div id="simKv"></div></div>
    <div class="panel s12"><div class="ph"><div><h3>Utilidad neta mensual 2025</h3><p>Real, forecast actual, simulado y presupuesto.</p></div></div><div class="chart" id="cSim"></div></div>
    <div class="panel s6"><div class="ph"><div><h3>Cuánto mueve cada palanca</h3><p>Efecto en la utilidad neta del año, una palanca a la vez.</p></div></div><div id="simLev"></div></div>
    <div class="panel s6"><div class="ph"><div><h3>Inflación: real contra lo presupuestado</h3><p>Variación mensual del índice de precios del modelo.</p></div></div><div class="chart short" id="cInf"></div></div>
    <div class="panel s12"><div class="ph"><div><h3>Tipo de cambio: real contra lo presupuestado</h3><p>Promedio mensual en pesos por dólar.</p></div></div><div class="chart short" id="cTc"></div></div>
  </div></div>`;
  const sr = SER(), cats = yr.map(mlab);
  const infl = (e, m) => { const a = kp(e, m), b = (e === E.PPTO && m === Y25) || (e === E.FCST && m === CORTE + 1) ? kp(E.REAL, m - 1) : kp(e, m - 1); return a && b ? a.I / b.I - 1 : null; };
  mk($('cInf'), { grid: { left: 6, right: 14, top: 34, bottom: 6, containLabel: true }, legend: legend(), tooltip: tip({ valueFormatter: v => v == null ? '–' : pct(v, false) }), xAxis: axisCat(cats), yAxis: axisVal(pctAx),
    series: [{ type: 'bar', name: 'Real y forecast', data: yr.map(m => m <= CORTE ? infl(E.REAL, m) : infl(E.FCST, m)), barWidth: '55%', itemStyle: { color: p => yr[p.dataIndex] <= CORTE ? T('--real') : T('--fcst'), borderRadius: [3, 3, 0, 0] } },
      { type: 'line', name: 'Presupuesto', data: yr.map(m => infl(E.PPTO, m)), symbol: 'none', lineStyle: { color: T('--ppto'), type: [2, 3], width: 1.75 }, itemStyle: { color: T('--ppto') } }] });
  mk($('cTc'), lineOpt(cats, [{ ...sr.PPTO, data: yr.map(m => kp(E.PPTO, m).tc) }, { ...sr.FCST, data: yr.map(m => m >= CORTE ? kp(m === CORTE ? E.REAL : E.FCST, m).tc : null) }, { ...sr.REAL, data: yr.map(m => m <= CORTE ? kp(E.REAL, m).tc : null) }], { yFmt: v => nf(0).format(v), tipFmt: v => '$ ' + nf(0).format(v) }));
  view.querySelectorAll('input[type=range]').forEach(inp => inp.addEventListener('input', () => { S.sim[inp.dataset.id] = +inp.value; $('so-' + inp.dataset.id).textContent = fmtS(+inp.value, inp.dataset.t); simUpdate(); }));
  view.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { S.sim = { ...SIMPRE[b.dataset.sp] }; render(); });
  simUpdate(true);
}
let simChart = null;
function simUpdate(first) {
  const yr = range(Y25, DIC + 1), realYr = range(Y25, CORTE + 1), sim = simResult(S.sim), R = pnl(E.REAL, realYr), le = LE(), pY = pnl(E.PPTO, yr);
  const unS = R.un + sim.reduce((s, x) => s + x.un, 0), ingS = R.ing + sim.reduce((s, x) => s + x.ing, 0), q4mo = sim.reduce((s, x) => s + x.mo, 0) / sim.reduce((s, x) => s + x.ing, 0);
  $('simKv').innerHTML = kvHtml([['Utilidad neta 2025', money(unS)], ['vs cierre proyectado', money(unS - le.un, { signed: true }), cls(unS - le.un)], ['vs presupuesto', pct((unS - pY.un) / Math.abs(pY.un)), cls(unS - pY.un)], ['Ingresos 2025', money(ingS)],
    ['Margen operativo oct–dic', pct(q4mo, false)], ['Ingresos oct–dic', money(sim.reduce((s, x) => s + x.ing, 0))], ['Utilidad oct–dic', money(sim.reduce((s, x) => s + x.un, 0))], ['Presupuesto anual', money(pY.un)]], 'kv4');
  const lev = [['Inflación', { infl: S.sim.infl }], ['Paritaria', { parit: S.sim.parit }], ['Tipo de cambio', { tc: S.sim.tc }], ['Recupero', { de: S.sim.de }], ['Volumen', { dv: S.sim.dv }]].map(([l, ch]) => [l, R.un + simResult({ ...SIM0, ...ch }).reduce((s, x) => s + x.un, 0) - le.un]);
  $('simLev').innerHTML = `<div class="tw"><table><thead><tr><th>Palanca</th><th>Supuesto</th><th>Efecto en utilidad</th></tr></thead><tbody>${lev.map(([l, v], i) => { const [id, , , , , t] = SIMIN[i]; return `<tr><td>${l}</td><td>${fmtS(S.sim[id], t)}</td><td class="${cls(v)}">${money(v, { signed: true })}</td></tr>`; }).join('')}
    <tr class="calc"><td>Combinado</td><td></td><td>${money(unS - le.un, { signed: true })}</td></tr></tbody></table></div><p class="note">La suma de palancas sueltas no da exacto el combinado: los efectos se multiplican entre sí.</p>`;
  const sr = SER(), opt = lineOpt(yr.map(mlab), [{ ...sr.PPTO, data: yr.map(m => pnl(E.PPTO, [m]).un) }, { ...sr.FCST, data: yr.map(m => m >= CORTE ? pnl(m === CORTE ? E.REAL : E.FCST, [m]).un : null) },
    { ...sr.SIM, data: yr.map(m => m === CORTE ? pnl(E.REAL, [m]).un : m > CORTE ? sim[m - CORTE - 1].un : null) }, { ...sr.REAL, data: yr.map(m => m <= CORTE ? pnl(E.REAL, [m]).un : null) }]);
  if (first || !simChart || simChart.isDisposed()) simChart = mk($('cSim'), opt); else simChart.setOption(opt, true);
}

/* ===== PLANIFICADOR: cierre 2025 (real + reproyección) y presupuesto 2026 =====
   Misma lógica que el Excel (build_plan.py): base run-rate jul–sep a precios de sep-25, cada línea se mueve con el índice de su categoría. */
const PM = JSON.parse(document.getElementById('plan').textContent);
const PT = PM.months.length, PQ = 3, P26 = range(PQ, PT);
const PCAR = PM.car, PK = {}; PCAR.forEach((c, k) => PK[c.ci] = k);
const r6 = v => Math.round(v * 1e6) / 1e6;
const plDefault = () => ({ name: 'Base', infl: [...PM.defaults.infl], tc: [...PM.defaults.tc], par: [...PM.defaults.par], sms: [...PM.defaults.sms], saldo: PM.saldo, tasa: PM.tasa,
  pre: { infl: 'base', par: 'trim', tc: 'base', sms: 'infl' },
  car: PCAR.map(c => ({ vol: Array(PT).fill(100), rec: Array(PT).fill(c.recB), fee: Array(PT).fill(c.feeB), pos: Array(PT).fill(c.posB) })) });
const PD = plDefault();
const plOk = a => Array.isArray(a) && a.length === PT && a.every(v => typeof v === 'number' && isFinite(v));
const plValid = x => !!x && ['infl', 'tc', 'par', 'sms'].every(k => plOk(x[k])) && Array.isArray(x.car) && x.car.length === PCAR.length && x.car.every(c => c && ['vol', 'rec', 'fee', 'pos'].every(k => plOk(c[k])));
const plFix = x => ({ ...plDefault(), ...x, name: typeof x.name === 'string' && x.name.trim() ? x.name.trim().slice(0, 60) : 'Base', pre: { ...PD.pre, ...(x.pre || {}) } });
const plClone = p => JSON.parse(JSON.stringify(p));
let PL = (() => { try { const x = JSON.parse(localStorage.getItem('cg-plan1') || 'null'); if (plValid(x)) return plFix(x); } catch (e) {} return plDefault(); })();
const plSave = () => { try { localStorage.setItem('cg-plan1', JSON.stringify(PL)); } catch (e) {} };
/* escenarios guardados: cada uno es una foto completa de supuestos y drivers */
let PLS = (() => { try { const a = JSON.parse(localStorage.getItem('cg-plan-esc1') || '[]'); return Array.isArray(a) ? a.filter(x => x && typeof x.name === 'string' && plValid(x.data)).map(x => ({ ...x, data: plFix(x.data) })) : []; } catch (e) { return []; } })();
const plsSave = () => { try { localStorage.setItem('cg-plan-esc1', JSON.stringify(PLS)); return true; } catch (e) { toast('No se pudo guardar en este navegador: bajá el Excel para conservarlo'); return false; } };
const plSig = p => JSON.stringify(['infl', 'tc', 'par', 'sms', 'saldo', 'tasa', 'car'].map(k => p[k]));
const plState = () => { const sv = PLS.find(x => x.name === PL.name), ref = sv ? sv.data : PL.name === 'Base' ? PD : null;
  return { saved: !!sv, dirty: !ref || plSig(ref) !== plSig(PL), base: PL.name === 'Base' && plSig(PD) === plSig(PL) }; };
const slugN = n => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'escenario';
Object.assign(S, { plv: 'sup', plm: 'ing', plc: 0, plProp: true, plRem: false, plOpen: {} });

/* escenarios rápidos (índices de mes: 0 = oct-25 … 3 = ene-26 … 14 = dic-26) */
const PLPRE = {
  infl: { baja: ['Baja 1,5%', t => t < PQ ? 0.02 : 0.015], base: ['Base 1,9%', t => PM.defaults.infl[t]], alta: ['Alta 2,8%', () => 0.028] },
  par: { trim: ['Trimestral 5,5%', t => t < PQ ? PL.par[t] : [3, 6, 9, 12].includes(t) ? 0.055 : 0], bim: ['Bimestral 3,6%', t => t < PQ ? PL.par[t] : [3, 5, 7, 9, 11, 13].includes(t) ? 0.036 : 0],
    men: ['Mensual 1,8%', t => t < PQ ? PL.par[t] : 0.018] },
  tc: { atraso: ['Atraso 1.550', 1550], base: ['Base 1.750', 1750], deva: ['Devaluación 2.200', 2200] },
  sms: { infl: ['Igual a la inflación', 0], infl1: ['Inflación + 1 pp', 0.01] } };
function plPreset(kind, key) {
  const P = PLPRE[kind][key];
  if (kind === 'tc') { const a = PL.tc[PQ - 1]; P26.forEach(t => PL.tc[t] = Math.round(a + (P[1] - a) * (t - PQ + 1) / 12)); }
  else if (kind === 'sms') PL.sms = PL.infl.map(v => r6(v + P[1]));
  else { PL[kind] = range(0, PT).map(P[1]); if (kind === 'infl' && PL.pre.sms) PL.sms = PL.infl.map(v => r6(v + PLPRE.sms[PL.pre.sms][1])); }
  PL.pre[kind] = key;
}

/* cálculo */
function plCalc(p = PL) {
  const I = [], Sx = [], Sm = [], tR = []; let a = 1, b = 1, c = 1;
  for (let t = 0; t < PT; t++) { a *= 1 + p.infl[t]; b *= 1 + p.par[t]; c *= 1 + p.sms[t]; I.push(a); Sx.push(b); Sm.push(c); tR.push(p.tc[t] / PM.tcSep); }
  const its = Array.from({ length: PT }, () => new Float64Array(NI)), car = PCAR.map(() => ({ ing: new Float64Array(PT), mgn: new Float64Array(PT), rem: new Float64Array(PT) })), rem = new Float64Array(PT);
  for (const r of PM.rows) {
    const k = r.ci >= 0 ? PK[r.ci] : -1, d = k >= 0 ? p.car[k] : null, cb = k >= 0 ? PCAR[k] : null, g = r.base;
    for (let t = 0; t < PT; t++) {
      const V = d ? d.vol[t] / 100 : 1, P = d ? (cb.posB ? d.pos[t] / cb.posB : 0) : 1; let v;
      switch (r.cat) {
        case 'rev': case 'iibb': v = g * (r.mon === 'USD' ? tR[t] : I[t]) * V * (cb.recB ? d.rec[t] / cb.recB : 0) * (cb.feeB ? d.fee[t] / cb.feeB : 0) * PM.seas[t]; break;
        case 'pos_sal': v = g * Sx[t] * P; break;
        case 'pos_usd': v = g * tR[t] * P; break;
        case 'pos_inf': v = g * I[t] * P; break;
        case 'vol_usd': v = g * tR[t] * V; break;
        case 'vol_inf': v = g * I[t] * V; break;
        case 'sms': v = g * Sm[t] * V; break;
        case 'sal': case 'ic': v = g * Sx[t]; break;
        case 'usd': v = g * tR[t]; break;
        case 'inf': v = g * I[t]; break;
        case 'fix': v = g; break;
        case 'difc': v = p.saldo * (p.tc[t] - (t ? p.tc[t - 1] : PM.tcSep)); break;
        default: v = 0;
      }
      its[t][r.i] += v;
      if (k >= 0) { car[k].mgn[t] += v; if (r.cat === 'rev') car[k].ing[t] += v; if (r.cat === 'pos_sal') { car[k].rem[t] += v; rem[t] += v; } }
    }
  }
  const months = its.map(it => { let pre = 0; for (let i = 0; i < NI; i++) pre += it[i]; it[TAXI] = pre > 0 ? -p.tasa * pre : 0; return fromItems(it); });
  return { months, car, rem, pos: range(0, PT).map(t => p.car.reduce((s, d) => s + d.pos[t], 0)), I, Sx, Sm, tR, tc: p.tc };
}
const plCv = (t, tc = PL.tc) => S.moneda === 'USD' ? 1 / tc[t] : 1;
function plSumIt(R, ts) { const it = new Float64Array(NI); ts.forEach(t => { const a = R.months[t].it, f = plCv(t, R.tc); for (let i = 0; i < NI; i++) it[i] += a[i] * f; }); return it; }
const addIt = (a, b) => { const o = new Float64Array(NI); for (let i = 0; i < NI; i++) o[i] = a[i] + b[i]; return o; };
function plAgg(R) {
  const r9 = pnl(E.REAL, range(Y25, CORTE + 1)), q4 = plSumIt(R, range(0, PQ));
  return { r9, q4: fromItems(q4), cierre: fromItems(addIt(r9.it, q4)), p25: pnl(E.PPTO, range(Y25, DIC + 1)), fv: fromItems(addIt(r9.it, pnl(E.FCST, range(CORTE + 1, DIC + 1)).it)), y26: fromItems(plSumIt(R, P26)) };
}
const prod26 = a => P26.reduce((s, t) => s * (1 + a[t]), 1) - 1;
const carIng25 = (R, k) => val(E.REAL, range(Y25, CORTE + 1), ING, PCAR[k].ci) + range(0, PQ).reduce((s, t) => s + R.car[k].ing[t] * plCv(t, R.tc), 0);
const sigue = (k, p = PL) => P26.some(t => p.car[k].vol[t] > 0 || p.car[k].pos[t] > 0);

/* entradas: formato es-AR, validación, propagación */
const _nr = {}; const nfr = (a, b) => (_nr[a + '-' + b] ??= new Intl.NumberFormat('es-AR', { minimumFractionDigits: a, maximumFractionDigits: b }));
const PF = { p: v => fixMinus(nfr(1, 2).format(v * 100)), p2: v => nf(2).format(v * 100), n0: v => nf(0).format(v), n1: v => nf(1).format(v) };
const PKEY = { infl: ['p', -0.05, 0.5], par: ['p', 0, 0.5], sms: ['p', -0.1, 0.5], tc: ['n0', 100, 1e5], vol: ['n1', 0, 1000], rec: ['p2', 0, 1], fee: ['p2', 0, 1], pos: ['n0', 0, 5000], saldo: ['n0', 0, 1e8], tasa: ['p', 0, 0.6] };
const pkey = p => { const a = p.split(':'); return a[0] === 'car' ? a[2] : a[0]; };
const pathGet = (o, p) => { const a = p.split(':'); return a[0] === 'car' ? o.car[+a[1]][a[2]][+a[3]] : a.length === 1 ? o[a[0]] : o[a[0]][+a[1]]; };
const isEd = p => Math.abs(pathGet(PL, p) - pathGet(PD, p)) > 1e-9;
const plIn = (p, label) => `<input type="text" inputmode="decimal" autocomplete="off" data-p="${p}" value="${PF[PKEY[pkey(p)][0]](pathGet(PL, p))}" aria-label="${esc(label)}"${isEd(p) ? ' class="ed"' : ''}>`;
function parseIn(s) {
  s = String(s).trim().replace(/[%$\s]/g, '').replace(MINUS, '-');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s); return s !== '' && isFinite(n) ? n : null;
}
function plCommit(inp) {
  const p = inp.dataset.p, k = pkey(p), [f, lo, hi] = PKEY[k], cur0 = pathGet(PL, p); let n = parseIn(inp.value);
  if (n === null) { inp.value = PF[f](cur0); toast('Ese valor no es un número'); return; }
  if (f === 'p' || f === 'p2') n /= 100;
  if (n < lo || n > hi) toast('Ajustado al rango permitido');
  n = Math.round(Math.min(hi, Math.max(lo, n)) * 1e8) / 1e8;
  if (Math.abs(n - cur0) < 1e-12) { inp.value = PF[f](n); return; }
  const a = p.split(':'), t = +a[a.length - 1], prop = S.plProp && (a[0] === 'car' || k === 'infl' || k === 'sms');
  if (a[0] === 'car') { const arr = PL.car[+a[1]][a[2]]; for (let j = t; j < (prop ? PT : t + 1); j++) arr[j] = n; }
  else if (a.length === 1) PL[k] = n;
  else { for (let j = t; j < (prop ? PT : t + 1); j++) PL[k][j] = n; PL.pre[k] = null;
    if (k === 'infl' && PL.pre.sms) PL.sms = PL.infl.map(v => r6(v + PLPRE.sms[PL.pre.sms][1])); }
  plSave(); plRefresh();
  $('plBody').querySelectorAll('.seg[data-pre]').forEach(g => g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(PL.pre[g.dataset.pre] === b.dataset.v))));
}
function plWire(root) {
  root.querySelectorAll('input[data-p]').forEach(inp => {
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('change', () => plCommit(inp));
    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') { inp.value = PF[PKEY[pkey(inp.dataset.p)][0]](pathGet(PL, inp.dataset.p)); inp.blur(); return; }
      if (e.key !== 'Enter') return; e.preventDefault(); plCommit(inp);
      const all = [...inp.closest('tr, .plbar').querySelectorAll('input[data-p]')], nx = all[all.indexOf(inp) + 1]; if (nx) nx.focus(); else inp.blur(); });
  });
  const pr = root.querySelector('#plProp'); if (pr) { pr.checked = S.plProp; pr.onchange = () => S.plProp = pr.checked; }
}
function plSync(root) {
  root.querySelectorAll('input[data-p]').forEach(inp => { const p = inp.dataset.p; if (inp !== document.activeElement) inp.value = PF[PKEY[pkey(p)][0]](pathGet(PL, p)); inp.classList.toggle('ed', isEd(p)); });
}

/* vista */
let PR = null, plChart = null;
const PLVN = { sup: ['Supuestos mes a mes', 'Elegí un escenario o cargá cada mes. Las celdas con fondo amarillo son las que cambiaste.'],
  car: ['Carteras · lo que proyecta cada supervisor', 'Tocá una cartera para cargar sus drivers mes a mes: volumen, recupero, fee y posiciones.'],
  eerr: ['Estado de resultados mensual', 'Real ene–sep, reproyección oct–dic, cierre contra presupuesto y forecast vigente, y presupuesto 2026. Tocá un rubro para abrirlo.'],
  dot: ['Dotación y remuneraciones', 'Posiciones por cartera y costo del personal operativo. Las posiciones se cargan en Carteras.'],
  esc: ['Escenarios guardados', 'Cada escenario es una foto de supuestos y drivers. Abrilo para seguir trabajando, bajá su Excel o comparalo contra la base.'] };
const PLM = { ing: 'Ingresos', mo: 'Margen operativo', un: 'Utilidad neta' };
function vPpto() {
  PR = plCalc();
  view.innerHTML = `<div class="formula"><b>Real ene–sep 2025</b><span>+</span><b>reproyección oct–dic</b><span>=</span><b>cierre 2025</b><span>·</span><b>presupuesto 2026</b><span>mes a mes, desde la operación real de jul–sep a precios de septiembre, movida por los supuestos y por lo que proyecta cada supervisor.</span></div>
  <section class="grid">
    <div class="panel s12"><div class="ph"><div><h3>Cierre 2025 y presupuesto 2026</h3><p>Se recalcula con cada cambio. Lo que cargues queda guardado en este navegador.</p></div>
      <div class="plh"><button class="btn primary" id="plXls"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>Excel con fórmulas</button><button class="btn" id="plRep">Informe para Directorio</button><button class="btn" id="plReset">Volver a la base</button></div></div>
      <div class="esc" id="plEsc"><span class="eyb">Escenario en pantalla</span><b id="plEscN"></b><span class="tag" id="plEscS"></span><span class="sp"></span>
        <input type="text" id="plEscIn" maxlength="60" autocomplete="off" placeholder="Nombre, ej.: Propuesta fee TMV 7%" aria-label="Nombre del escenario"><button class="btn" id="plEscSave">Guardar escenario</button>
        <label class="btn" tabindex="0" id="plXinL">Cargar desde Excel<input type="file" id="plXin" accept=".xlsx" hidden></label><button class="btn" id="plEscGo"></button></div>
      <div id="plKv"></div></div>
    <div class="panel s12"><div class="ph"><div><h3>${PLM[S.plm]} mes a mes · 2025 y 2026</h3><p>2025: real hasta septiembre y reproyección contra presupuesto y forecast vigente. 2026: presupuesto.</p></div>
      <div class="seg" data-k="plm"><button data-v="ing">Ingresos</button><button data-v="mo">Margen operativo</button><button data-v="un">Utilidad neta</button></div></div><div class="chart" id="cPl"></div></div>
    <div class="panel s12"><div class="ph"><div><h3>${PLVN[S.plv][0]}</h3><p>${PLVN[S.plv][1]}</p></div>
      <div class="seg" data-k="plv"><button data-v="sup">Supuestos</button><button data-v="car">Carteras</button><button data-v="eerr">Estado de resultados</button><button data-v="dot">Dotación</button><button data-v="esc">Escenarios</button></div></div><div id="plBody"></div></div>
  </section>`;
  $('plXls').onclick = () => plExcel(PL); $('plRep').onclick = () => dlReport('ppto');
  $('plEscIn').value = PL.name === 'Base' ? '' : PL.name;
  $('plEscSave').onclick = () => plEscSave($('plEscIn').value);
  $('plEscIn').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); plEscSave($('plEscIn').value); } };
  $('plEscGo').onclick = () => { S.plv = 'esc'; render(); try { $('plBody').scrollIntoView({ block: 'start' }); } catch (e) {} };
  $('plXinL').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('plXin').click(); } };
  $('plXin').onchange = async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) await plLoadFile(f); };
  let armed = 0; $('plReset').onclick = e => { const b = e.currentTarget;
    if (Date.now() - armed > 4000) { armed = Date.now(); b.textContent = '¿Borrar todo lo cargado? Tocá de nuevo'; setTimeout(() => { if (b.isConnected) b.textContent = 'Volver a la base'; }, 4000); return; }
    PL = plDefault(); plSave(); render(); toast('Planificador en la base'); };
  plBodyRender(); plRefresh(false);
}
function plBodyRender() { const b = $('plBody'); b.innerHTML = PLV[S.plv].html(); PLV[S.plv].wire?.(b); plWire(b); }
function plRefresh(recalc = true) {
  if (recalc) PR = plCalc();
  const A = plAgg(PR); $('plKv').innerHTML = plKpis(A, PR); plEscBar();
  const opt = plChartOpt(PR, S.plm); if (!plChart || plChart.isDisposed() || !$('cPl').contains(plChart.getDom())) plChart = mk($('cPl'), opt); else plChart.setOption(opt, true);
  const b = $('plBody'); PLV[S.plv].dyn?.(b, A); plSync(b);
}
function plKpis(A, R) {
  const c = A.cierre, y = A.y26, d = (a, b) => (a - b) / Math.abs(b), posAvg = P26.reduce((s, t) => s + R.pos[t], 0) / 12, posSep = PCAR.reduce((s, x) => s + x.posB, 0);
  const box = (l, v, sub, cl = '') => `<div><span>${l}</span><b class="${cl}">${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const vs = (r, lbl, isPP) => `<b class="${cls(r)}">${isPP ? pp(r) : pct(r)}</b> ${lbl}`;
  return `<p class="eyb">Cierre 2025 · real ene–sep + reproyección oct–dic</p><div class="plk">
    ${box('Ingresos', money(c.ing), vs(d(c.ing, A.p25.ing), 'vs presupuesto'))}
    ${box('Margen operativo', pct(c.mo / c.ing, false), vs(c.mo / c.ing - A.p25.mo / A.p25.ing, 'vs presupuesto', true))}
    ${box('Utilidad neta', money(c.un), vs(d(c.un, A.p25.un), 'vs presupuesto'))}
    ${box('Reproyección contra forecast vigente', money(c.un - A.fv.un, { signed: true }), `Utilidad neta. Forecast cargado: ${money(A.fv.un)}`, cls(c.un - A.fv.un))}</div>
  <p class="eyb" style="margin-top:14px">Presupuesto 2026</p><div class="plk">
    ${box('Ingresos', money(y.ing), vs(d(y.ing, c.ing), 'vs cierre 2025'))}
    ${box('Margen operativo', pct(y.mo / y.ing, false), vs(y.mo / y.ing - c.mo / c.ing, 'vs cierre 2025', true))}
    ${box('Utilidad neta', money(y.un), vs(d(y.un, c.un), 'vs cierre 2025'))}
    ${box('Posiciones promedio', nf(0).format(posAvg), `${nf(0).format(posSep)} en septiembre · inflación ${pct(prod26(PL.infl), false)} · dólar a dic ${nf(0).format(PL.tc[PT - 1])}`)}</div>`;
}
function plChartOpt(R, met) {
  const yr = range(Y25, DIC + 1), cats = [...yr.map(mlab), ...PM.months.slice(PQ)], f = o => o[met], plv = t => f(R.months[t]) * plCv(t), sr = SER(), nul = P26.map(() => null);
  const real = m => f(pnl(E.REAL, [m]));
  const opt = lineOpt(cats, [
    { ...sr.PPTO, name: 'Presupuesto 2025', data: [...yr.map(m => f(pnl(E.PPTO, [m]))), ...nul] },
    { ...sr.FCST, name: 'Forecast vigente', data: [...yr.map(m => m === CORTE ? real(m) : m > CORTE ? f(pnl(E.FCST, [m])) : null), ...nul] },
    { ...sr.SIM, name: 'Reproyección y presupuesto 2026', symbolSize: 5, data: [...yr.map(m => m === CORTE ? real(m) : m > CORTE ? plv(m - CORTE - 1) : null), ...P26.map(plv)],
      markArea: { silent: true, itemStyle: { color: T('--surface-2') }, label: { show: true, position: 'insideTop', color: T('--ink-3'), fontSize: 11, fontFamily: T('--f-body'), formatter: 'Presupuesto 2026' }, data: [[{ xAxis: cats[yr.length] }, { xAxis: cats[cats.length - 1] }]] } },
    { ...sr.REAL, data: [...yr.map(m => m <= CORTE ? real(m) : null), ...nul] }]);
  opt.xAxis.axisLabel.interval = 'auto';
  return opt;
}

const thM = (cl = '') => PM.months.map((m, t) => `<th class="${t === PQ ? 'y26 ' : ''}${cl}">${m}</th>`).join('');
const y26c = t => t === PQ ? ' class="y26"' : '';
const PLV = {
  sup: {
    html: () => {
      const pre = (kind, lbl) => `<div><span>${lbl}</span><div class="seg" data-pre="${kind}">${Object.entries(PLPRE[kind]).map(([k, v]) => `<button data-v="${k}" aria-pressed="${PL.pre[kind] === k}">${v[0]}</button>`).join('')}</div></div>`;
      const inRow = (k, lbl, unit, base) => `<tr><td>${lbl} <span class="u">${unit}</span></td><td>${base}</td>${PM.months.map((m, t) => `<td${y26c(t)}>${plIn(k + ':' + t, lbl + ' ' + m)}</td>`).join('')}<td class="tot" data-a="${k}"></td></tr>`;
      const dvRow = (k, lbl) => `<tr class="dv"><td>${lbl}</td><td>1,000</td>${PM.months.map((m, t) => `<td${y26c(t)} data-d="${k}:${t}"></td>`).join('')}<td class="tot"></td></tr>`;
      return `<div class="plpre">${pre('infl', 'Inflación mensual 2026')}${pre('par', 'Paritaria 2026')}${pre('tc', 'Dólar a diciembre 2026')}${pre('sms', 'Precio del SMS')}</div>
      <div class="tw pg"><table><thead><tr><th>Supuesto</th><th>Sep-25</th>${thM()}<th class="tot">Año 2026</th></tr></thead><tbody>
        ${inRow('infl', 'Inflación mensual', '%', '–')}${dvRow('I', 'Índice de precios')}
        ${inRow('tc', 'Tipo de cambio promedio', '$/US$', nf(0).format(PM.tcSep))}${dvRow('tR', 'Índice de tipo de cambio')}
        ${inRow('par', 'Aumento salarial del mes', '%', '–')}${dvRow('Sx', 'Índice salarial')}
        ${inRow('sms', 'Aumento del precio del SMS', '%', '–')}${dvRow('Sm', 'Índice de precio del SMS')}
        <tr class="dv"><td>Estacionalidad de ingresos</td><td>–</td>${PM.seas.map((v, t) => `<td${y26c(t)}>${nf(2).format(v)}</td>`).join('')}<td class="tot"></td></tr></tbody></table></div>
      <div class="plbar"><label class="pin">Saldo a cobrar intercompany (US$) ${plIn('saldo', 'Saldo intercompany en dólares')}</label><label class="pin">Tasa de ganancias (%) ${plIn('tasa', 'Tasa de impuesto a las ganancias')}</label>
        <label class="chk"><input type="checkbox" id="plProp"> Al cambiar un mes, copiar a los siguientes (inflación y SMS)</label></div>
      <p class="note">Enter pasa al mes siguiente; Esc deshace. La paritaria se carga en el mes de cada tramo. El saldo intercompany genera diferencia de cambio cada vez que sube el dólar. Índices: septiembre 2025 = 1.</p>`;
    },
    wire: b => b.querySelectorAll('.seg[data-pre]').forEach(g => g.onclick = e => { const x = e.target.closest('button'); if (!x) return; plPreset(g.dataset.pre, x.dataset.v); plSave(); plBodyRender(); plRefresh(); }),
    dyn: b => {
      b.querySelectorAll('[data-d]').forEach(td => { const [k, t] = td.dataset.d.split(':'); td.textContent = nf(3).format(PR[k][+t]); });
      b.querySelectorAll('[data-a]').forEach(td => { const k = td.dataset.a; td.textContent = k === 'tc' ? pct(PL.tc[PT - 1] / PL.tc[PQ - 1] - 1) : pct(prod26(PL[k]), false); });
    } },
  car: {
    html: () => {
      const k = Math.min(S.plc, PCAR.length - 1), c = PCAR[k];
      const DRV = [['vol', 'Volumen asignado', 'índice', nf(1).format(100)], ['rec', '% de recupero', '%', PF.p2(c.recB)], ['fee', 'Fee', '%', PF.p2(c.feeB)], ['pos', 'Posiciones', 'n.º', nf(0).format(c.posB)]];
      return `<div class="tw"><table class="plov"><thead><tr><th>Cartera</th><th>Sigue en 2026</th><th>Volumen dic&#8209;26</th><th>Recupero 2026</th><th>Fee 2026</th><th>Posiciones 2026</th><th>Ingresos oct–dic</th><th>Ingresos 2026</th><th>vs 2025</th><th>Margen 2026</th><th>Margen %</th></tr></thead><tbody id="plCarB"></tbody></table></div>
      <div class="plbar"><h4><span class="code">${c.code}</span>${esc(c.nombre)} <span class="u">${c.mon === 'USD' ? 'factura en dólares' : 'factura en pesos'}</span></h4>
        <label class="chk"><input type="checkbox" id="plProp"> Al cambiar un mes, copiar a los siguientes</label><button class="btn" id="plCarReset">Volver a la base esta cartera</button></div>
      <div class="tw pg"><table><thead><tr><th>Driver</th><th>Base sep-25</th>${thM()}</tr></thead><tbody>
        ${DRV.map(([key, lbl, u, base]) => `<tr><td>${lbl} <span class="u">${u}</span></td><td>${base}</td>${PM.months.map((m, t) => `<td${y26c(t)}>${plIn(`car:${k}:${key}:${t}`, `${lbl} ${c.code} ${m}`)}</td>`).join('')}</tr>`).join('')}</tbody>
        <tbody id="plDrvR"></tbody></table></div>
      <p class="note">Volumen: deuda asignada en términos reales (100 = septiembre; 110 = 10% más de cartera). Recupero y fee mueven el ingreso; las posiciones mueven sueldos, licencias y telefonía; el volumen mueve SMS, mailing y bocas de cobranza. Para dar de baja una cartera, destildá «Sigue en 2026».</p>`;
    },
    wire: b => {
      const tb = $('plCarB'), pick = tr => { S.plc = +tr.dataset.k; plBodyRender(); plRefresh(false); };
      tb.onclick = e => { const tr = e.target.closest('tr[data-k]'); if (!tr || e.target.closest('input,label')) return; pick(tr); };
      tb.onkeydown = e => { const tr = e.target.closest('tr[data-k]'); if (tr && e.key === 'Enter' && !e.target.closest('input')) pick(tr); };
      tb.onchange = e => { const cb = e.target.closest('input[data-sigue]'); if (!cb) return; const k = +cb.dataset.sigue, d = PL.car[k];
        P26.forEach(t => { if (cb.checked) { if (!d.vol[t]) d.vol[t] = 100; if (!d.pos[t]) d.pos[t] = PCAR[k].posB; } else { d.vol[t] = 0; d.pos[t] = 0; } }); plSave(); plRefresh(); };
      $('plCarReset').onclick = () => { const k = S.plc; PL.car[k] = JSON.parse(JSON.stringify(PD.car[k])); plSave(); plRefresh(); };
    },
    dyn: () => {
      const R = PR, cv = plCv, sum = (arr, ts) => ts.reduce((s, t) => s + arr[t] * cv(t), 0), avg = arr => P26.reduce((s, t) => s + arr[t], 0) / 12;
      let T = { q4: 0, i26: 0, i25: 0, m26: 0, pos: 0 };
      const rows = PCAR.map((c, k) => { const d = PL.car[k], x = R.car[k], q4 = sum(x.ing, range(0, PQ)), i26 = sum(x.ing, P26), m26 = sum(x.mgn, P26), i25 = carIng25(R, k), on = sigue(k), ps = avg(d.pos);
        T.q4 += q4; T.i26 += i26; T.i25 += i25; T.m26 += m26; T.pos += ps;
        const pc = i26 ? m26 / i26 : NaN;
        return `<tr class="click${k === S.plc ? ' sel' : ''}${on ? '' : ' off'}" data-k="${k}" tabindex="0"><td><span class="code">${c.code}</span>${esc(c.nombre)}</td>
          <td><input type="checkbox" data-sigue="${k}" ${on ? 'checked' : ''} aria-label="${esc(c.nombre)} sigue en 2026"></td><td>${nf(1).format(d.vol[PT - 1])}</td><td>${PF.p2(avg(d.rec))}%</td><td>${PF.p2(avg(d.fee))}%</td><td>${nf(1).format(ps)}</td>
          <td>${tv(q4)}</td><td>${tv(i26)}</td><td class="${cls(i26 - i25)}">${i25 ? pct((i26 - i25) / i25) : '–'}</td><td class="${cls(m26)}">${tv(m26)}</td><td class="${isFinite(pc) ? cls(pc) : ''}">${isFinite(pc) ? pct(pc, false) : '–'}</td></tr>`; });
      $('plCarB').innerHTML = rows.join('') + `<tr class="calc"><td>Total carteras (${UNIT()})</td><td>${PCAR.filter((c, k) => sigue(k)).length} de ${PCAR.length}</td><td></td><td></td><td></td><td>${nf(1).format(T.pos)}</td><td>${tv(T.q4)}</td><td>${tv(T.i26)}</td><td class="${cls(T.i26 - T.i25)}">${pct((T.i26 - T.i25) / T.i25)}</td><td>${tv(T.m26)}</td><td>${pct(T.m26 / T.i26, false)}</td></tr>`;
      const k = S.plc, x = R.car[k], r = (lbl, f, c = '') => `<tr class="dv ${c}"><td>${lbl}</td><td></td>${PM.months.map((m, t) => `<td${y26c(t)}>${f(t)}</td>`).join('')}</tr>`;
      $('plDrvR').innerHTML = r(`Ingresos (${UNIT()})`, t => tv(x.ing[t] * cv(t))) + r(`Margen de contribución (${UNIT()})`, t => tv(x.mgn[t] * cv(t))) + r('Margen %', t => x.ing[t] ? pct(x.mgn[t] / x.ing[t], false) : '–');
    } },
  eerr: {
    html: () => `<div class="tw"><table id="plEe"></table></div><p class="note">${UNIT()}. Cierre 2025 = real ene–sep + reproyección. Forecast vigente = real ene–sep + el forecast cargado antes de este ejercicio. «vs cierre» compara el total 2026 contra el cierre 2025.</p>`,
    wire: b => b.querySelector('#plEe').onclick = e => { const x = e.target.closest('button[data-n1]'); if (!x) return; S.plOpen[x.dataset.n1] = !S.plOpen[x.dataset.n1]; PLV.eerr.dyn(b, plAgg(PR)); },
    dyn: (b, A) => {
      const R = PR, cv = plCv, out = [];
      const cols = f => { const c = f(A.cierre), p = f(A.p25), y = f(A.y26); return [f(A.r9), ...range(0, PQ).map(t => f(R.months[t]) * cv(t)), c, p, c - p, f(A.fv), ...P26.map(t => f(R.months[t]) * cv(t)), y, c ? (y - c) / Math.abs(c) : NaN]; };
      const cells = v => v.map((x, j) => { const cl = [j === 4 || j === 20 ? 'tot' : '', j === 8 ? 'y26' : '', j === 6 ? cls(x) : ''].filter(Boolean).join(' ');
        return `<td${cl ? ` class="${cl}"` : ''}>${j === 21 ? (isFinite(x) ? pct(x) : '–') : tv(x)}</td>`; }).join('');
      const line = (lbl, f, c = '') => out.push(`<tr class="${c}"><td>${lbl}</td>${cells(cols(f))}</tr>`);
      const pctL = (lbl, f) => { const a = cols(f), g = cols(o => o.ing); out.push(`<tr class="pct"><td>${lbl}</td>${a.map((x, j) => `<td${j === 4 || j === 20 ? ' class="tot"' : j === 8 ? ' class="y26"' : ''}>${j === 6 || j === 21 || !g[j] ? '' : pct(x / g[j], false)}</td>`).join('')}</tr>`); };
      N1.forEach((n, k) => {
        const op = !!S.plOpen[n];
        out.push(`<tr class="n1"><td><button data-n1="${esc(n)}" aria-expanded="${op}">${op ? '▾' : '▸'} ${esc(strip(n))}</button></td>${cells(cols(o => o.n1[n]))}</tr>`);
        if (op) N2OF[n].forEach(z => out.push(`<tr class="n2"><td>${esc(strip(z))}</td>${cells(cols(o => o.n2[z]))}</tr>`));
        if (k === 2) line('Margen bruto', o => o.mb, 'calc');
        if (k === 3) { line('Margen operativo', o => o.mo, 'calc'); pctL('% sobre ingresos', o => o.mo); }
        if (k === 4) line('Resultado antes de impuestos', o => o.uai, 'calc');
      });
      line('Utilidad neta', o => o.un, 'calc'); pctL('% sobre ingresos', o => o.un);
      b.querySelector('#plEe').innerHTML = `<thead><tr><th>Cuenta</th><th>Real ene–sep</th>${PM.months.slice(0, PQ).map(m => `<th>${m}</th>`).join('')}<th class="tot">Cierre 2025</th><th>Presup. 2025</th><th>Desvío</th><th>Forecast vigente</th>${PM.months.slice(PQ).map((m, j) => `<th${j ? '' : ' class="y26"'}>${m}</th>`).join('')}<th class="tot">Total 2026</th><th>vs cierre</th></tr></thead><tbody>${out.join('')}</tbody>`;
    } },
  dot: {
    html: () => `<div class="sens"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
      <span>Información sensible: los montos de remuneraciones son solo para RRHH, Gerencia y Control de Gestión. Si compartís pantalla, dejalos ocultos.</span></div>
      <label class="chk"><input type="checkbox" id="plRem"${S.plRem ? ' checked' : ''}> Mostrar montos de remuneraciones</label>
      <div class="tw"><table id="plDot"></table></div>`,
    wire: b => b.querySelector('#plRem').onchange = e => { S.plRem = e.target.checked; PLV.dot.dyn(b); },
    dyn: b => {
      const R = PR, cv = plCv, row = (lbl, base, f, c = '', av = '') => `<tr class="${c}"><td>${lbl}</td><td>${base}</td>${PM.months.map((m, t) => `<td${y26c(t)}>${f(t)}</td>`).join('')}<td class="tot">${av}</td></tr>`;
      const avg = f => P26.reduce((s, t) => s + f(t), 0) / 12, pre = S.moneda === 'USD' ? 'US$ ' : '$ ';
      let h = PCAR.map((c, k) => row(`<span class="code">${c.code}</span>${esc(c.nombre)}`, nf(0).format(c.posB), t => nf(0).format(PL.car[k].pos[t]), sigue(k) ? '' : 'off', nf(1).format(avg(t => PL.car[k].pos[t])))).join('');
      h += row('Total posiciones', nf(0).format(PCAR.reduce((s, c) => s + c.posB, 0)), t => nf(0).format(R.pos[t]), 'calc', nf(1).format(avg(t => R.pos[t])));
      if (S.plRem) h += row(`Remuneraciones operativas (${UNIT()})`, '', t => tv(-R.rem[t] * cv(t)), 'dv', tv(P26.reduce((s, t) => s - R.rem[t] * cv(t), 0)))
        + row('Costo mensual por posición', '', t => R.pos[t] ? pre + nf(0).format(-R.rem[t] * cv(t) / R.pos[t] / 1e3) + ' mil' : '–', 'dv')
        + row('Índice salarial (sep-25 = 1)', '1,000', t => nf(3).format(R.Sx[t]), 'dv');
      else h += `<tr class="dv"><td colspan="${PT + 3}">Remuneraciones ocultas. Activá «Mostrar montos de remuneraciones» para verlas.</td></tr>`;
      b.querySelector('#plDot').innerHTML = `<thead><tr><th>Cartera · posiciones</th><th>Sep-25</th>${thM()}<th class="tot">Prom. 2026</th></tr></thead><tbody>${h}</tbody>`;
    } },
  esc: {
    html: () => `<div class="tw"><table class="plov" id="plEscT"></table></div><div class="chart short" id="cEsc"></div>
      <p class="note">Los escenarios quedan guardados en este navegador. Para conservarlos en otro lado o pasárselos a alguien, bajá el Excel de cada uno: con «Cargar desde Excel» vuelve a abrirse tal cual, aunque lo hayas modificado en Excel.</p>`,
    wire: b => b.querySelector('#plEscT').onclick = e => {
      const x = e.target.closest('button[data-a]'); if (!x) return; const i = +x.dataset.i, a = x.dataset.a, rec = i === -1 ? { name: 'Base', data: PD } : i === -2 ? { name: PL.name, data: PL } : PLS[i];
      if (a === 'open') { plOpen(rec.data); toast(`Escenario «${rec.name === 'Base' ? 'Base' : rec.name}» en pantalla`); }
      else if (a === 'xls') plExcel(rec.data);
      else if (a === 'del') { if (x.dataset.armed !== '1') { x.dataset.armed = '1'; x.textContent = '¿Borrar? Tocá de nuevo'; setTimeout(() => { if (x.isConnected) { x.dataset.armed = ''; x.textContent = 'Borrar'; } }, 4000); return; }
        PLS.splice(i, 1); plsSave(); PLV.esc.dyn(b); plEscBar(); toast(`Escenario «${rec.name}» borrado`); } },
    dyn: b => {
      const st = plState(), list = [{ label: 'Base · septiembre 2025', i: -1, data: PD, base: true }];
      if (!st.saved || st.dirty) if (!st.base) list.push({ label: `En pantalla · ${PL.name === 'Base' ? 'base modificada' : PL.name}`, i: -2, data: PL, cur: true, note: st.saved ? 'cambios sin guardar' : 'sin guardar' });
      PLS.forEach((x, i) => list.push({ label: x.name, i, data: x.data, date: x.date, saved: true, cur: x.name === PL.name && !st.dirty }));
      if (st.base) list[0].cur = true;
      const res = list.map(x => { const Rx = plCalc(x.data), A = plAgg(Rx); return { ...x, A }; }), B = res[0].A;
      const chg = d => PCAR.reduce((n, c, k) => n + (['vol', 'rec', 'fee', 'pos'].some(key => plSig({ car: [d.car[k][key]] }) !== plSig({ car: [PD.car[k][key]] })) ? 1 : 0), 0);
      const rows = res.map(x => { const y = x.A.y26, c = x.A.cierre, d = x.data, nb = PCAR.filter((_, k) => !sigue(k, d)).length, nc = chg(d);
        return `<tr class="${x.cur ? 'sel' : ''}"><td><b>${esc(x.label)}</b>${x.note ? ` <span class="u">${x.note}</span>` : x.cur ? ' <span class="u">en pantalla</span>' : ''}</td><td>${x.date || '–'}</td>
          <td>${tv(y.ing)}</td><td>${pct(y.mo / y.ing, false)}</td><td>${tv(y.un)}</td><td class="${x.base ? '' : cls(y.un - B.y26.un)}">${x.base ? '–' : pct((y.un - B.y26.un) / Math.abs(B.y26.un))}</td><td>${tv(c.un)}</td>
          <td>${pct(prod26(d.infl), false)}</td><td>${nf(0).format(d.tc[PT - 1])}</td><td>${pct(prod26(d.par), false)}</td><td>${nc ? nc + ' con cambios' : 'sin cambios'}${nb ? ` · ${nb} de baja` : ''}</td>
          <td class="acts">${x.cur ? '' : `<button class="btn sm" data-a="open" data-i="${x.i}">Abrir</button>`}<button class="btn sm" data-a="xls" data-i="${x.i}">Excel</button>${x.saved ? `<button class="btn sm" data-a="del" data-i="${x.i}">Borrar</button>` : ''}</td></tr>`; });
      b.querySelector('#plEscT').innerHTML = `<thead><tr><th>Escenario</th><th>Guardado</th><th>Ingresos 2026</th><th>Margen op. 2026</th><th>Utilidad neta 2026</th><th>vs base</th><th>Cierre 2025 · utilidad</th><th>Inflación 2026</th><th>Dólar dic&#8209;26</th><th>Paritaria 2026</th><th>Carteras</th><th></th></tr></thead><tbody>${rows.join('')}</tbody>`;
      const el = $('cEsc'), lab = res.map(x => x.base ? 'Base' : x.cur && x.i === -2 ? 'En pantalla' : x.label), opt = barsH(lab, res.map(x => x.A.y26.un), { colors: res.map(x => x.base ? T('--ppto') : x.cur ? T('--accent') : T('--real')) });
      opt.title = { text: `Utilidad neta 2026 por escenario (${UNIT()})`, left: 0, top: 0, textStyle: { fontSize: 12, fontWeight: 600, color: T('--ink-2'), fontFamily: T('--f-body') } }; opt.grid.top = 28;
      el.style.height = Math.max(150, res.length * 34 + 50) + 'px';
      const ch = echarts.getInstanceByDom(el); if (ch) { ch.resize(); ch.setOption(opt, true); } else mk(el, opt);
    } } };


/* Excel con fórmulas: se completa la plantilla embebida con lo cargado (sin librerías externas) */
const XMIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CRCT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRCT[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const viaStream = async (u, ts) => new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(ts)).arrayBuffer());
function unzipRaw(u) {
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength); let e = u.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('no es un archivo de Excel (.xlsx)');
  const n = dv.getUint16(e + 10, true), td = new TextDecoder(), out = []; let p = dv.getUint32(e + 16, true);
  for (let k = 0; k < n; k++) {
    const nl = dv.getUint16(p + 28, true), lo = dv.getUint32(p + 42, true), cs = dv.getUint32(p + 20, true), ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    out.push({ name: td.decode(u.subarray(p + 46, p + 46 + nl)), meth: dv.getUint16(p + 10, true), time: dv.getUint16(p + 12, true), date: dv.getUint16(p + 14, true), crc: dv.getUint32(p + 16, true), cs, us: dv.getUint32(p + 24, true), data: u.subarray(ds, ds + cs) });
    p += 46 + nl + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return out;
}
function zipRaw(files) {
  const te = new TextEncoder(), parts = [], cen = []; let off = 0;
  for (const f of files) {
    const nm = te.encode(f.name), h = new Uint8Array(30 + nm.length), v = new DataView(h.buffer), c = new Uint8Array(46 + nm.length), w = new DataView(c.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(8, f.meth, true); v.setUint16(10, f.time, true); v.setUint16(12, f.date, true); v.setUint32(14, f.crc, true); v.setUint32(18, f.cs, true); v.setUint32(22, f.us, true); v.setUint16(26, nm.length, true); h.set(nm, 30);
    w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint16(10, f.meth, true); w.setUint16(12, f.time, true); w.setUint16(14, f.date, true); w.setUint32(16, f.crc, true); w.setUint32(20, f.cs, true); w.setUint32(24, f.us, true); w.setUint16(28, nm.length, true); w.setUint32(42, off, true); c.set(nm, 46);
    parts.push(h, f.data); cen.push(c); off += h.length + f.data.length;
  }
  const size = cen.reduce((s, c) => s + c.length, 0), e = new Uint8Array(22), v = new DataView(e.buffer);
  v.setUint32(0, 0x06054b50, true); v.setUint16(8, files.length, true); v.setUint16(10, files.length, true); v.setUint32(12, size, true); v.setUint32(16, off, true);
  return new Blob([...parts, ...cen, e], { type: XMIME });
}
async function plBuildXlsx(P = PL) {
  const b64 = (document.getElementById('planx')?.textContent || '').trim();
  if (!b64 || typeof DecompressionStream === 'undefined' || typeof CompressionStream === 'undefined') throw new Error('este navegador no puede armarlo; probá con Chrome o Edge actualizados');
  const bin = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)), files = unzipRaw(bin), te = new TextEncoder(), td = new TextDecoder();
  const C = PM.cells, num = v => String(Math.round(v * 1e9) / 1e9), sup = {}, drv = {};
  ['infl', 'tc', 'par', 'sms'].forEach(k => C.monthCols.forEach((col, t) => sup[col + C.sup[k]] = num(P[k][t])));
  sup[C.saldo] = num(P.saldo); sup[C.tasa] = num(P.tasa);
  PCAR.forEach((c, k) => ['vol', 'rec', 'fee', 'pos'].forEach(key => C.monthCols.forEach((col, t) => drv[col + c.rows[key]] = num(P.car[k][key][t]))));
  const put = { [C.sheets.Supuestos]: sup, [C.sheets.Drivers]: drv }, leeme = C.sheets.Leeme;
  for (const f of files) {
    const map = put[f.name]; if (!map && f.name !== leeme) continue;
    let xml = td.decode(f.meth === 8 ? await viaStream(f.data, new DecompressionStream('deflate-raw')) : f.data), hit = 0;
    if (map) { xml = xml.replace(/<c r="([A-Z]+[0-9]+)"([^>]*)><v>[^<]*<\/v><\/c>/g, (m, ref, at) => ref in map ? (hit++, `<c r="${ref}"${at}><v>${map[ref]}</v></c>`) : m);
      if (hit !== Object.keys(map).length) throw new Error('la plantilla no coincide con el tablero'); }
    else xml = xml.replace(/(<c r="A2"[^>]*><is><t>)[^<]*/, `$1Cobranzas del Sur S.A. · datos 100% ficticios · escenario «${esc(P.name)}» · exportado del tablero el ${today}`);
    const raw = te.encode(xml), dz = await viaStream(raw, new CompressionStream('deflate-raw'));
    Object.assign(f, { meth: 8, crc: crc32(raw), us: raw.length, cs: dz.length, data: dz });
  }
  return zipRaw(files);
}
async function plExcel(P = PL) {
  let blob; try { blob = await plBuildXlsx(P); } catch (e) { console.error(e); toast('No se pudo armar el Excel: ' + e.message); return; }
  await saveFile(`Planificador-${slugN(P.name)}.xlsx`, blob, XMIME);
}

/* escenarios: guardar, abrir, borrar, leer un Excel del planificador */
function plEscBar() {
  const st = plState(), n = $('plEscN'); if (!n) return;
  n.textContent = PL.name === 'Base' ? 'Base (septiembre 2025)' : PL.name;
  const tg = $('plEscS'); tg.className = 'tag ' + (st.base ? '' : st.dirty ? 'warn' : 'ok'); tg.textContent = st.base ? 'sin cambios' : st.dirty ? (st.saved || PL.name === 'Base' ? 'con cambios sin guardar' : 'sin guardar') : 'guardado';
  $('plEscGo').textContent = `Escenarios guardados (${PLS.length})`;
}
function plEscSave(raw) {
  const name = String(raw || '').trim().slice(0, 60);
  if (!name) { toast('Poné un nombre para el escenario'); $('plEscIn').focus(); return; }
  if (/^base$/i.test(name)) { toast('«Base» queda reservado para los valores de septiembre'); return; }
  const i = PLS.findIndex(x => x.name === name), rec = { name, date: today, data: plClone({ ...PL, name }) };
  if (i >= 0) PLS[i] = rec; else PLS.push(rec);
  if (!plsSave()) return; PL.name = name; plSave(); plEscBar(); if (S.plv === 'esc') PLV.esc.dyn($('plBody'));
  toast(i >= 0 ? `Escenario «${name}» actualizado` : `Escenario «${name}» guardado`);
}
function plOpen(p) { PL = plFix(plClone(p)); plSave(); render(); }
async function plReadXlsx(buf) {
  if (typeof DecompressionStream === 'undefined') throw new Error('este navegador no puede leerlo; probá con Chrome o Edge actualizados');
  const files = unzipRaw(new Uint8Array(buf)), td = new TextDecoder();
  const get = async n => { const f = files.find(x => x.name === n); return f ? td.decode(f.meth === 8 ? await viaStream(f.data, new DecompressionStream('deflate-raw')) : f.data) : null; };
  const wbx = await get('xl/workbook.xml'), rels = await get('xl/_rels/workbook.xml.rels'); if (!wbx || !rels) throw new Error('no es un archivo de Excel');
  const attr = (tag, a) => { const m = tag.match(new RegExp('\\s' + a + '="([^"]*)"')); return m ? m[1] : null; };
  const path = name => { const tag = (wbx.match(/<sheet\b[^>]*>/g) || []).find(t => attr(t, 'name') === name); if (!tag) return null;
    const rel = (rels.match(/<Relationship\b[^>]*>/g) || []).find(t => attr(t, 'Id') === attr(tag, 'r:id')); if (!rel) return null;
    const tg = attr(rel, 'Target'); return tg.startsWith('/') ? tg.slice(1) : 'xl/' + tg.replace(/^\.\//, ''); };
  const ssx = await get('xl/sharedStrings.xml'), ss = ssx ? (ssx.match(/<si>[\s\S]*?<\/si>/g) || []).map(x => (x.match(/<t[^>]*>([^<]*)<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('')) : [];
  const cells = async name => { const p = path(name); const x = p && await get(p); if (!x) throw new Error(`no tiene la hoja ${name}`); const out = {};
    for (const m of x.matchAll(/<c r="([A-Z]+[0-9]+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) { const t = attr(' ' + m[2], 't'), body = m[3] || '', v = (body.match(/<v>([^<]*)<\/v>/) || [])[1];
      out[m[1]] = t === 's' ? { s: ss[+v] || '' } : t === 'inlineStr' ? { s: (body.match(/<t[^>]*>([^<]*)<\/t>/) || [])[1] || '' } : t === 'str' ? { s: v || '' } : { n: v == null ? NaN : parseFloat(v) }; }
    return out; };
  const sup = await cells('Supuestos'), drv = await cells('Drivers'), C = PM.cells;
  if (!/Inflaci/.test((sup.A5 || {}).s || '')) throw new Error('no parece un Excel del planificador');
  const num = (o, ref) => { const c = o[ref]; if (!c || !isFinite(c.n)) throw new Error(`falta el valor de ${ref}`); return c.n; };
  const P = plDefault();
  ['infl', 'tc', 'par', 'sms'].forEach(k => C.monthCols.forEach((col, t) => P[k][t] = num(sup, col + C.sup[k])));
  P.saldo = num(sup, C.saldo); P.tasa = num(sup, C.tasa);
  PCAR.forEach((c, k) => { const hdr = (drv['A' + (c.rows.vol - 1)] || {}).s || ''; if (!hdr.startsWith(c.code)) throw new Error(`la hoja Drivers no coincide (esperaba ${c.code})`);
    ['vol', 'rec', 'fee', 'pos'].forEach(key => C.monthCols.forEach((col, t) => P.car[k][key][t] = num(drv, col + c.rows[key]))); });
  P.pre = { infl: null, par: null, tc: null, sms: null };
  return P;
}
async function plLoadFile(f) {
  try { const P = await plReadXlsx(await f.arrayBuffer()); P.name = f.name.replace(/\.xlsx$/i, '').replace(/^\d{4}-\d{2}-\d{2}[_ -]?/, '').replace(/^Planificador[-_ ]?/i, '').replace(/[-_]+/g, ' ').trim().slice(0, 60) || 'Desde Excel';
    if (/^base$/i.test(P.name)) P.name = 'Desde Excel';
    PL = P; plSave(); render(); toast(`Cargado: «${P.name}». Guardalo como escenario si querés conservarlo.`);
  } catch (e) { console.error(e); toast('No se pudo leer el Excel: ' + e.message); }
}

/* informe para Directorio */
function plDiffs() {
  const out = [], K = { vol: ['volumen', v => nf(1).format(v)], rec: ['recupero', v => PF.p2(v) + '%'], fee: ['fee', v => PF.p2(v) + '%'], pos: ['posiciones', v => nf(0).format(v)] };
  PCAR.forEach((c, k) => { const parts = [];
    if (!sigue(k)) { out.push(`<li><b>${c.code}</b>: sale del presupuesto 2026.</li>`); return; }
    Object.entries(K).forEach(([key, [lbl, fm]]) => { const a = PL.car[k][key], b = PD.car[k][key], t0 = a.findIndex((v, t) => Math.abs(v - b[t]) > 1e-9); if (t0 < 0) return;
      const flat = a.slice(t0).every(v => Math.abs(v - a[t0]) < 1e-9); parts.push(`${lbl} ${fm(a[t0])} ${flat ? 'desde ' + PM.months[t0] : 'en ' + PM.months[t0] + ' (varía después)'} (base ${fm(b[t0])})`); });
    if (parts.length) out.push(`<li><b>${c.code}</b>: ${parts.join('; ')}.</li>`); });
  return out.length ? `<ul>${out.join('')}</ul>` : '<p>Sin cambios: todas las carteras con los drivers de septiembre 2025.</p>';
}
function plReport() {
  const R = plCalc(), A = plAgg(R), c = A.cierre, y = A.y26, d = (a, b) => (a - b) / Math.abs(b), sr = SER();
  const tramos = PL.par.map((v, t) => v > 0 ? `${PM.months[t]} ${pct(v, false)}` : '').filter(Boolean).join(' · ') || 'sin aumentos';
  const qs = [[3, 6], [6, 9], [9, 12], [12, 15]], qf = (f, [a, b]) => range(a, b).reduce((s, t) => s + f(R.months[t]) * plCv(t), 0);
  const lines = [[N1[0], o => o.n1[N1[0]]], [N1[1], o => o.n1[N1[1]]], [N1[2], o => o.n1[N1[2]]], ['Margen bruto', o => o.mb, 'calc'], [N1[3], o => o.n1[N1[3]]], ['Margen operativo', o => o.mo, 'calc'],
    [N1[4], o => o.n1[N1[4]]], [N1[5], o => o.n1[N1[5]]], ['Utilidad neta', o => o.un, 'calc']];
  const eerr = lines.map(([l, f, cl = '']) => { const cc = f(c), p = f(A.p25), yy = f(y); return `<tr class="${cl}"><td>${esc(strip(l))}</td><td>${tv(f(A.r9))}</td><td>${tv(f(A.q4))}</td><td><b>${tv(cc)}</b></td><td>${tv(p)}</td><td class="${cls(cc - p)}">${tv(cc - p)}</td>${qs.map(q => `<td>${tv(qf(f, q))}</td>`).join('')}<td><b>${tv(yy)}</b></td><td>${cc ? pct((yy - cc) / Math.abs(cc)) : '–'}</td></tr>`; });
  const car = PCAR.map((x, k) => { const z = R.car[k], i26 = P26.reduce((s, t) => s + z.ing[t] * plCv(t), 0), m26 = P26.reduce((s, t) => s + z.mgn[t] * plCv(t), 0), i25 = carIng25(R, k);
    return `<tr><td>${x.code} · ${esc(x.nombre)}</td><td>${sigue(k) ? 'Sí' : 'No'}</td><td>${tv(i26)}</td><td class="${cls(i26 - i25)}">${i25 ? pct((i26 - i25) / i25) : '–'}</td><td class="${cls(m26)}">${tv(m26)}</td><td>${i26 ? pct(m26 / i26, false) : '–'}</td><td>${nf(1).format(P26.reduce((s, t) => s + PL.car[k].pos[t], 0) / 12)}</td></tr>`; });
  return [`Cierre-2025-y-presupuesto-2026-${slugN(PL.name)}.html`, reportDoc('Cierre 2025 y presupuesto 2026', `Escenario «${PL.name === 'Base' ? 'Base' : PL.name}» · real ene–sep + reproyección oct–dic, y presupuesto 2026 mes a mes desde la operación real de jul–sep 2025`, 'Directorio y Gerencia General', [
    { h: 'Resumen', html: kvR([['Cierre 2025 · utilidad neta', money(c.un)], ['vs presupuesto 2025', pct(d(c.un, A.p25.un)), cls(c.un - A.p25.un)], ['vs forecast vigente', pct(d(c.un, A.fv.un)), cls(c.un - A.fv.un)], ['Margen operativo 2025', pct(c.mo / c.ing, false)],
      ['Ingresos 2026', money(y.ing)], ['vs cierre 2025', pct(d(y.ing, c.ing)), cls(y.ing - c.ing)], ['Utilidad neta 2026', money(y.un)], ['Margen operativo 2026', pct(y.mo / y.ing, false)]]) },
    { h: 'Supuestos', html: `<ul><li>Inflación: ${pct(PL.infl.slice(0, PQ).reduce((s, v) => s + v, 0) / PQ, false)} mensual promedio en oct–dic; ${pct(prod26(PL.infl), false)} acumulada en 2026.</li>
      <li>Dólar promedio: ${nf(0).format(PL.tc[PQ - 1])} en diciembre 2025 y ${nf(0).format(PL.tc[PT - 1])} en diciembre 2026 (${pct(PL.tc[PT - 1] / PL.tc[PQ - 1] - 1)}).</li>
      <li>Paritarias: ${tramos}. Acumulado 2026: ${pct(prod26(PL.par), false)}.</li><li>Precio del SMS: ${pct(prod26(PL.sms), false)} en 2026. Impuesto a las ganancias: ${pct(PL.tasa, false)} del resultado.</li>
      <li>Base: operación real de julio a septiembre 2025 a precios de septiembre; ingresos con estacionalidad mensual.</li></ul>` },
    { h: 'Lo que cargaron los supervisores', html: plDiffs() },
    { h: 'Ingresos mes a mes: 2025 y 2026', html: ssr(plChartOpt(R, 'ing'), 820, 280) },
    { h: `Estado de resultados (${UNIT()})`, html: '<div class="fit">' + tbl(['Cuenta', 'Real ene–sep', 'Reproy. oct–dic', 'Cierre 2025', 'Presup. 2025', 'Desvío', '1T-26', '2T-26', '3T-26', '4T-26', 'Total 2026', 'vs cierre'], eerr) + '</div>' },
    { h: `Por cartera 2026 (${UNIT()})`, html: tbl(['Cartera', 'Sigue', 'Ingresos', 'vs 2025', 'Margen', 'Margen %', 'Posiciones'], car) + '<p class="note">Margen de contribución: ingresos menos costos directos y asignados de la cartera, antes de la estructura. Las remuneraciones no se detallan en este informe.</p>' }], { freq: 'Anual', css: '.fit table{font-size:11.5px}.fit th{white-space:normal;line-height:1.25;vertical-align:bottom}.fit th,.fit td{padding:6px 5px}' })];
}

/* ===== INTERCOMPANY ===== */
const PAISES = ['ARG', 'CM', 'CA', 'PY'], PNOM = { ARG: 'Argentina', CM: 'Casa matriz', CA: 'Centroamérica', PY: 'Paraguay' };
const ICM = { mixto: 'TI por dotación · Gerencia General partes iguales', iguales: 'Partes iguales', dotacion: 'Dotación', ingresos: 'Ingresos en USD' };
const ICR = {}; D.ic.forEach(r => ICR[r[0] * 100 + r[1]] = r);
function icShares(r, basis) { if (basis === 'iguales') return { ARG: .25, CM: .25, CA: .25, PY: .25 }; const v = basis === 'dotacion' ? r.slice(9, 13) : r.slice(13, 17), t = v.reduce((a, b) => a + b, 0); return Object.fromEntries(PAISES.map((p, i) => [p, v[i] / t])); }
function icMethod(r, method) { return { ti: icShares(r, method === 'mixto' ? 'dotacion' : method), cp: icShares(r, method === 'mixto' ? 'iguales' : method) }; }
function icSeries(method) {
  let saldo = 40000, tcPrev = null; const out = {};
  for (let m = 0; m <= CORTE; m++) { const r = ICR[E.REAL * 100 + m]; if (!r) continue; const sh = icMethod(r, method);
    const rec = r[2] * (1 - sh.ti.ARG) + r[3] * (1 - sh.cp.ARG), tc = r[4], difc = tcPrev === null ? 0 : saldo * (tc - tcPrev), fact = rec / tc, cobro = [2, 5, 8, 11].includes(m % 12) ? 0.8 * (saldo + fact) : 0;
    out[m] = { rec, difc, saldo0: saldo, fact, cobro, tc, sh }; saldo = saldo + fact - cobro; tcPrev = tc; out[m].saldo1 = saldo; }
  return out;
}
function vIC() {
  const ms = months(), U = S.moneda === 'USD', cv = (v, m) => U ? v / kp(E.REAL, m).tc : v, sel = icSeries(S.ic), base = icSeries('mixto');
  const agg = { ti: 0, cp: 0, rec: 0, recB: 0, dif: 0, difB: 0, byP: Object.fromEntries(PAISES.map(p => [p, { ti: 0, cp: 0 }])) };
  ms.forEach(m => { const r = ICR[m], s = sel[m]; agg.ti += cv(r[2], m); agg.cp += cv(r[3], m); agg.rec += cv(s.rec, m); agg.recB += cv(base[m].rec, m); agg.dif += cv(s.difc, m); agg.difB += cv(base[m].difc, m);
    PAISES.forEach(p => { agg.byP[p].ti += cv(r[2] * s.sh.ti[p], m); agg.byP[p].cp += cv(r[3] * s.sh.cp[p], m); }); });
  const lm = ms[ms.length - 1], rl = ICR[lm], sl = sel[lm], impact = (agg.rec - agg.recB) + (agg.dif - agg.difB), m24 = range(0, CORTE + 1);
  view.innerHTML = `<div class="formula"><span>Argentina paga</span><b>TI regional</b><span>y</span><b>Gerencia General</b><span>→ cada país reembolsa su parte en USD → el saldo a cobrar en USD genera</span><b>diferencia de cambio</b></div>
  <section class="grid">
    <div class="panel s12"><div class="ph"><div><h3>Criterio de distribución</h3><p>Probá otro criterio: cambia cuánto recupera Argentina y cuánto gasto queda en su resultado.</p></div>
      <div class="seg" data-k="ic"><button data-v="mixto">Vigente (mixto)</button><button data-v="iguales">Partes iguales</button><button data-v="dotacion">Dotación</button><button data-v="ingresos">Ingresos USD</button></div></div>
      ${kvHtml([['Gastos a distribuir', money(agg.ti + agg.cp)], ['Recupero de otros países', money(agg.rec)], ['Queda en Argentina', money(agg.ti + agg.cp - agg.rec)], ['Diferencia de cambio', money(agg.dif, { signed: true }), cls(agg.dif)], ['Efecto vs vigente', S.ic === 'mixto' ? '–' : money(impact, { signed: true }), cls(impact)]])}
      <p class="note">Criterio: ${ICM[S.ic]}. ${perLbl()}. El efecto se mide antes del impuesto a las ganancias.</p></div>
    <div class="panel s7"><div class="ph"><div><h3>Cuánto absorbe cada país</h3><p>Gasto de TI y de Gerencia General asignado · ${perLbl()} · ${UNIT()}</p></div></div><div class="chart" id="cIC"></div></div>
    <div class="panel s5"><div class="ph"><div><h3>Bases de distribución (${mlab(lm)})</h3><p>Lo que pesa cada país según cada criterio.</p></div></div>
      <div class="tw"><table class="plov"><thead><tr><th>País</th><th>Dotación</th><th>Ingresos USD</th><th>% TI</th><th>% Gcia. Gral.</th></tr></thead><tbody>
      ${PAISES.map((p, i) => `<tr><td>${PNOM[p]}</td><td>${rl[9 + i]}</td><td>${money(rl[13 + i], { pre: 'US$ ' })}</td><td>${pct(sl.sh.ti[p], false)}</td><td>${pct(sl.sh.cp[p], false)}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Con este criterio Argentina se queda con el ${pct(sl.sh.ti.ARG, false)} del gasto de TI y el ${pct(sl.sh.cp.ARG, false)} de Gerencia General. El resto se factura en dólares y se cobra al cierre de cada trimestre (80% del saldo).</p>
      <p class="note">Partes iguales favorece a Argentina cuando es el país más grande; ingresos en USD la perjudica cuando el peso se aprecia y su facturación en dólares cae.</p></div>
    <div class="panel s6"><div class="ph"><div><h3>Cuenta corriente en dólares: qué se factura, qué se cobra y qué queda</h3><p>Cada mes se factura a los otros países (azul); al cierre de cada trimestre pagan el 80% (gris). La línea es lo que queda por cobrar: sobre ese saldo se calcula la diferencia de cambio.</p></div></div><div class="chart short" id="cSaldo"></div></div>
    <div class="panel s6"><div class="ph"><div><h3>La suba del dólar convierte el saldo en ganancia</h3><p>Diferencia de cambio mensual = saldo en USD × variación del TC (${UNIT()}).</p></div></div><div class="chart short" id="cDif"></div></div>
  </section>`;
  const pc = ['CM', 'CA', 'PY', 'ARG'];
  mk($('cIC'), { grid: { left: 6, right: 16, top: 34, bottom: 6, containLabel: true }, legend: { ...legend(), data: ['TI regional', 'Gerencia General'] }, tooltip: tip({ trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => money(v) }),
    xAxis: axisVal(axFmt), yAxis: axisCat(pc.map(p => PNOM[p]), { axisLabel: { color: T('--ink-2'), fontSize: 11.5 } }),
    series: [{ name: 'TI regional', type: 'bar', stack: 'a', barWidth: '52%', data: pc.map(p => agg.byP[p].ti), itemStyle: { color: T('--real') } },
      { name: 'Gerencia General', type: 'bar', stack: 'a', data: pc.map(p => agg.byP[p].cp), itemStyle: { color: T('--fcst'), borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: T('--ink-2'), fontSize: 11, formatter: q => tv(agg.byP[pc[q.dataIndex]].ti + agg.byP[pc[q.dataIndex]].cp) } }] });
  mk($('cSaldo'), { grid: { left: 6, right: 14, top: 34, bottom: 6, containLabel: true }, legend: { ...legend(), data: ['Facturado', 'Cobrado', 'Saldo a cobrar'] },
    tooltip: tip({ trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => v == null ? '–' : (v < 0 ? MINUS : '') + 'US$ ' + nf(0).format(Math.abs(v)) }), xAxis: axisCat(m24.map(mlab)), yAxis: axisVal(v => smart(v / 1e3) + ' mil'),
    series: [{ type: 'bar', name: 'Facturado', stack: 'mov', barWidth: '58%', data: m24.map(m => sel[m].fact), itemStyle: { color: T('--real'), borderRadius: [3, 3, 0, 0] } },
      { type: 'bar', name: 'Cobrado', stack: 'mov', data: m24.map(m => sel[m].cobro ? -sel[m].cobro : null), itemStyle: { color: T('--ppto'), borderRadius: [0, 0, 3, 3] } },
      { type: 'line', name: 'Saldo a cobrar', data: m24.map(m => sel[m].saldo1), symbol: 'circle', symbolSize: 5, lineStyle: { color: T('--accent'), width: 2.25 }, itemStyle: { color: T('--accent') } }] });
  mk($('cDif'), { grid: { left: 6, right: 14, top: 14, bottom: 6, containLabel: true }, tooltip: tip({ trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => money(v, { signed: true }) }), xAxis: axisCat(m24.map(mlab)), yAxis: axisVal(axFmt),
    series: [{ type: 'bar', name: 'Diferencia de cambio', barWidth: '62%', data: m24.map(m => ({ value: cv(sel[m].difc, m), itemStyle: { color: sel[m].difc >= 0 ? T('--real') : T('--crit'), borderRadius: sel[m].difc >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3], opacity: ms.includes(m) ? 1 : .45 } })) }] });
}

/* ===== COTIZADOR ===== */
const kSep = kp(E.REAL, CORTE);
const apoyoPos = (() => { const ids = ['Calidad', 'Back Office', 'Ejecutivos de cuenta', 'Gerencia de Operaciones'].map(n => ITEM[n]), c = cube[E.REAL][CORTE]; let s = 0; for (let cc = 0; cc <= NC; cc++) ids.forEach(i => s -= c[cc * NI + i]); return s / kSep.pos; })();
const estPct = (() => { const o = pnl(E.REAL, [CORTE]); return -o.n1[N1[3]] / o.ing; })();
const CIN = [
  ['Ingresos', [['deuda', 'Deuda asignada por mes', 200e6, 6000e6, 50e6, 2000e6, 'M'], ['rec', '% de recupero esperado', .03, .6, .005, .35, '%'], ['fee', 'Fee sobre lo recuperado', .02, .25, .0025, .065, '%']]],
  ['Operación', [['ops', 'Operadores en Argentina', 0, 80, 1, 20, 'n'], ['py', 'Posiciones en Paraguay', 0, 60, 1, 0, 'n'], ['cop', 'Costo mensual por operador', 400e3, 2e6, 10e3, Math.round(kSep.cop / 1e4) * 1e4, '$'],
    ['sup', 'Posiciones por supervisor', 6, 20, 1, 13, 'n'], ['csup', 'Costo mensual por supervisor', 1e6, 4e6, 50e3, Math.round(kSep.cop * 2.04 / 5e4) * 5e4, '$'], ['apoyo', 'Apoyo operativo por posición', 50e3, 400e3, 5e3, Math.round(apoyoPos / 5e3) * 5e3, '$'],
    ['minop', 'Minutos por posición (miles)', 5, 40, 1, 24, 'n'], ['cmin', 'Costo por minuto', .5, 5, .05, Math.round(kSep.cmin * 20) / 20, '$2'], ['lic', 'Licencia por posición (USD)', 10, 120, 1, 45, 'u'], ['pyusd', 'Costo posición Paraguay (USD)', 400, 1200, 10, 650, 'u']]],
  ['Canales digitales', [['ctas', 'Cuentas gestionadas', 0, 400e3, 5e3, 60e3, 'n'], ['smsc', 'SMS por cuenta al mes', 0, 10, .5, 3, 'n1'], ['csms', 'Costo por SMS', 2, 40, .5, Math.round(kSep.csms * 2) / 2, '$2'],
    ['mailc', 'Mails por cuenta al mes', 0, 20, 1, 8, 'n'], ['cmail', 'Costo cada 1.000 mails (USD)', .2, 2, .02, .48, 'u2']]],
  ['Supuestos', [['tc', 'Tipo de cambio', 900, 2200, 5, kSep.tc, 'n'], ['iibb', 'Ingresos Brutos', 0, .05, .0025, .03, '%'], ['est', 'Estructura (% del ingreso)', 0, .4, .005, Math.round(estPct * 200) / 200, '%'], ['obj', 'Margen objetivo', 0, .4, .01, .15, '%']]] ];
const PRE = { temprana: { deuda: 2000e6, rec: .35, fee: .065, ops: 20, py: 0, ctas: 60e3, smsc: 3, mailc: 8, minop: 24 }, prelegal: { deuda: 1800e6, rec: .16, fee: .15, ops: 14, py: 6, ctas: 25e3, smsc: 2, mailc: 4, minop: 26 },
  masiva: { deuda: 3500e6, rec: .28, fee: .055, ops: 8, py: 0, ctas: 200e3, smsc: 4, mailc: 10, minop: 18 } };
S.cot = Object.fromEntries(CIN.flatMap(([, l]) => l.map(x => [x[0], x[5]])));
const fmtIn = (v, t) => t === 'M' ? '$ ' + nf(0).format(v / 1e6) + ' M' : t === '%' ? nf(v < 0.1 ? 2 : 1).format(v * 100) + '%' : t === '$' ? '$ ' + nf(0).format(v) : t === '$2' ? '$ ' + nf(2).format(v) : t === 'u' ? 'US$ ' + nf(0).format(v) : t === 'u2' ? 'US$ ' + nf(2).format(v) : t === 'n1' ? nf(1).format(v) : nf(0).format(v);
const Mm = v => (v < -5e4 ? MINUS : '') + '$ ' + nf(1).format(Math.abs(v) / 1e6) + ' M';
function cotCalc(x) {
  const pos = x.ops + x.py, ing = x.deuda * x.rec * x.fee;
  const c = { 'Operadores': x.ops * x.cop, 'Posiciones Paraguay': x.py * x.pyusd * x.tc, 'Supervisión': Math.ceil(pos / x.sup) * x.csup, 'Apoyo operativo': pos * x.apoyo,
    'Telefonía': pos * x.minop * 1e3 * x.cmin, 'SMS': x.ctas * x.smsc * x.csms, 'Mailing': x.ctas * x.mailc * x.cmail / 1e3 * x.tc, 'Licencias': pos * x.lic * x.tc };
  const fijo = Object.values(c).reduce((a, b) => a + b, 0), iibb = ing * x.iibb, cont = ing - fijo - iibb, est = ing * x.est, neto = cont - est, k = 1 - x.iibb - x.est, base = x.deuda * x.rec;
  return { ing, c, fijo, iibb, cont, est, neto, pos, mgn: ing ? neto / ing : NaN, cmgn: ing ? cont / ing : NaN, iph: pos ? ing / (pos * 132) : 0, cph: pos ? (fijo + iibb) / (pos * 132) : 0,
    feeBE: base ? fijo / (k * base) : NaN, feeObj: base && k - x.obj > 0 ? fijo / ((k - x.obj) * base) : NaN, recBE: x.deuda * x.fee ? fijo / (k * x.deuda * x.fee) : NaN };
}
function cotWaterfall(r) { const w = Object.entries(r.c).filter(([, v]) => v > 0).map(([n, v]) => ({ name: n, v: -v })).concat([{ name: 'Ingresos Brutos', v: -r.iibb }, { name: 'Estructura', v: -r.est }]);
  return waterfall(w.filter(s => Math.abs(s.v) > 1), { startLabel: 'Ingreso', endLabel: 'Margen', start: r.ing, end: r.neto, startColor: T('--real'), scale: 1e6, pre: '$ ' }); }
function cotHeat(x) {
  const fees = range(-3, 4).map(k => x.fee * (1 + k * .1)), recs = range(-3, 4).map(k => x.rec * (1 + k * .1)), hd = [];
  fees.forEach((f, i) => recs.forEach((rc, j) => { const q = cotCalc({ ...x, fee: f, rec: rc }), me = i === 3 && j === 3;
    hd.push({ value: [j, i, isFinite(q.mgn) ? q.mgn : 0], itemStyle: me ? { borderColor: T('--ink'), borderWidth: 3 } : {}, label: me ? { fontWeight: 800 } : {} }); }));
  return { grid: { left: 6, right: 10, top: 8, bottom: 34, containLabel: true },
    tooltip: tip({ trigger: 'item', formatter: p => `Fee ${pct(fees[p.value[1]], false)} · recupero ${pct(recs[p.value[0]], false)}<br><b>${p.value[2] >= 0 ? 'Gana' : 'Pierde'}: margen ${pct(p.value[2], false)}</b>${p.value[0] === 3 && p.value[1] === 3 ? '<br>Lo que cargaste' : ''}` }),
    xAxis: axisCat(recs.map((v, j) => pct(v, false) + (j === 3 ? ' ◆' : '')), { name: '% de recupero: cuánto se cobra de la deuda →', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: T('--ink-3'), fontSize: 11 } }),
    yAxis: axisCat(fees.map((v, i) => pct(v, false) + (i === 3 ? ' ◆' : '')), { name: 'Fee ↑', nameTextStyle: { color: T('--ink-3'), fontSize: 11 } }),
    visualMap: { show: false, min: -.3, max: .3, dimension: 2, inRange: { color: [T('--crit'), T('--div-mid'), T('--good')] } },
    series: [{ type: 'heatmap', data: hd, itemStyle: { borderColor: T('--surface'), borderWidth: 2, borderRadius: 3 }, label: { show: true, formatter: p => pct(p.value[2], false), fontSize: 11.5, color: T('--ink') } }] };
}
function cotHeatNote(x) {
  const r = cotCalc(x), lo = cotCalc({ ...x, rec: x.rec * .9 });
  return `Cómo leerlo: cada casillero es el margen (después de estructura) que dejaría la cartera con ese fee y ese recupero; ◆ marca lo que cargaste. Hacia arriba o a la derecha mejora. `
    + (isFinite(r.feeBE) ? `Con un recupero del <b>${pct(x.rec, false)}</b>, el fee mínimo para no perder plata es <b>${pct(r.feeBE, false)}</b>${isFinite(lo.feeBE) ? `; si el recupero cae 10% (a ${pct(x.rec * .9, false)}), hace falta <b>${pct(lo.feeBE, false)}</b>` : ''}.` : '');
}
function propText(x, r) { return `Con una deuda asignada de <b>${Mm(x.deuda)}</b> por mes y un recupero esperado del <b>${pct(x.rec, false)}</b>, proponemos un fee del <b>${pct(x.fee, false)}</b> sobre lo recuperado. La cartera se atiende con <b>${r.pos} posiciones</b> y gestión digital sobre ${nf(0).format(x.ctas)} cuentas. El ingreso estimado es de <b>${Mm(r.ing)}</b> por mes, con un margen después de estructura de <b>${pct(r.mgn, false)}</b>. ${isFinite(r.feeObj) ? `Para un margen del ${pct(x.obj, false)} el fee mínimo es ${pct(r.feeObj, false)}; ` : ''}por debajo de un fee de ${pct(r.feeBE, false)} la cartera no cubre sus costos.`; }
function vCot() {
  view.innerHTML = `<div class="two"><div>
    <div class="presets" role="group" aria-label="Tipos de cartera"><button class="btn" data-pre="temprana">Mora temprana</button><button class="btn" data-pre="prelegal">Prelegal</button><button class="btn" data-pre="masiva">Masiva digital</button></div>
    ${CIN.map(([g, l]) => `<fieldset><legend>${g}</legend>${l.map(([id, lab, mn, mx, st, , t]) => `<div class="in"><label for="in-${id}">${lab}</label><output id="o-${id}">${fmtIn(S.cot[id], t)}</output><input type="range" id="in-${id}" min="${mn}" max="${mx}" step="${st}" value="${S.cot[id]}" data-id="${id}" data-t="${t}"></div>`).join('')}</fieldset>`).join('')}
    <p class="note">Costos unitarios precargados con los valores reales de ${mlab(CORTE)}. Montos mensuales en pesos.</p></div>
    <div class="grid" style="align-content:start">
      <div class="panel s12"><div class="ph"><div><h3>Resultado mensual de la cartera cotizada</h3><p id="cotSub"></p></div></div><div id="cotKv"></div></div>
      <div class="panel s7"><div class="ph"><div><h3>Del ingreso al margen</h3><p>Costos mensuales en millones de pesos.</p></div></div><div class="chart" id="cW"></div></div>
      <div class="panel s5"><div class="ph"><div><h3>Escenarios</h3><p>Pesimista: −15% recupero y −10% deuda. Optimista: +10% y +5%.</p></div></div><div id="cEsc"></div></div>
      <div class="panel s12"><div class="ph"><div><h3>¿Con qué fee y qué recupero gana plata la cartera?</h3><p>Filas: fee. Columnas: % de recupero. Verde gana, gris queda cerca del equilibrio, rojo pierde.</p></div></div><div class="chart tall" id="cH"></div><p class="note" id="cHn"></p></div>
      <div class="panel s12"><div class="ph"><div><h3>Propuesta para el cliente</h3><p>Texto para el mail de cotización, o una propuesta de una página para adjuntar.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="copyProp">Copiar texto</button><button class="btn primary" id="dlProp">Descargar propuesta</button></div></div><p class="prop" id="prop"></p></div>
    </div></div>`;
  view.querySelectorAll('input[type=range]').forEach(inp => inp.addEventListener('input', () => { S.cot[inp.dataset.id] = +inp.value; $('o-' + inp.dataset.id).textContent = fmtIn(+inp.value, inp.dataset.t); cotUpdate(); }));
  view.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => { Object.assign(S.cot, PRE[b.dataset.pre]); render(); });
  $('copyProp').onclick = async () => { const t = $('prop').innerText, b = $('copyProp'); try { await navigator.clipboard.writeText(t); b.textContent = 'Copiado'; } catch (e) { const r = document.createRange(); r.selectNodeContents($('prop')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Texto seleccionado'; } setTimeout(() => b.textContent = 'Copiar texto', 1600); };
  $('dlProp').onclick = () => dlReport('cotizacion');
  cotUpdate(true);
}
const cotCharts = {};
function cotUpdate(first) {
  const x = S.cot, r = cotCalc(x);
  const st = isFinite(r.mgn) ? (r.mgn >= x.obj ? ['good', 'Cumple objetivo'] : r.mgn >= 0 ? ['warn', 'Debajo del objetivo'] : ['crit', 'Pierde']) : ['warn', 'Sin datos'];
  $('cotSub').innerHTML = `<span class="status ${st[0]}"><i></i>${st[1]}</span> &nbsp;${r.pos} posiciones · ${nf(0).format(x.ctas)} cuentas`;
  $('cotKv').innerHTML = kvHtml([['Ingreso', Mm(r.ing)], ['Margen de contribución', `${Mm(r.cont)} · ${pct(r.cmgn, false)}`, cls(r.cont)], ['Margen con estructura', `${Mm(r.neto)} · ${pct(r.mgn, false)}`, cls(r.neto)], ['Ingreso por hora', '$ ' + nf(0).format(r.iph)],
    ['Costo por hora', '$ ' + nf(0).format(r.cph)], ['Fee de equilibrio', isFinite(r.feeBE) ? pct(r.feeBE, false) : '–'], [`Fee para ${pct(x.obj, false)} de margen`, isFinite(r.feeObj) ? pct(r.feeObj, false) : '–'], ['Recupero de equilibrio', isFinite(r.recBE) ? pct(r.recBE, false) : '–']], 'kv4');
  const esc3 = [['Pesimista', .85, .9], ['Base', 1, 1], ['Optimista', 1.1, 1.05]].map(([n, fr, fd]) => [n, cotCalc({ ...x, rec: x.rec * fr, deuda: x.deuda * fd })]);
  $('cEsc').innerHTML = `<div class="tw"><table><thead><tr><th>Escenario</th><th>Ingreso</th><th>Margen</th><th>Margen %</th></tr></thead><tbody>${esc3.map(([n, q]) => `<tr><td>${n}</td><td>${Mm(q.ing)}</td><td class="${cls(q.neto)}">${Mm(q.neto)}</td><td class="${q.mgn < 0 ? 'dn' : ''}">${pct(q.mgn, false)}</td></tr>`).join('')}</tbody></table></div>
    <h4 style="margin:16px 0 6px;font:700 13.5px var(--f-display)">Cuánto mueve cada palanca</h4><div class="tw"><table><tbody>
      <tr><td>+1 punto de recupero</td><td class="up">${Mm(cotCalc({ ...x, rec: x.rec + .01 }).neto - r.neto)}</td></tr><tr><td>+0,5 punto de fee</td><td class="up">${Mm(cotCalc({ ...x, fee: x.fee + .005 }).neto - r.neto)}</td></tr>
      <tr><td>+1 operador</td><td class="dn">${Mm(cotCalc({ ...x, ops: x.ops + 1 }).neto - r.neto)}</td></tr><tr><td>+1 SMS por cuenta</td><td class="dn">${Mm(cotCalc({ ...x, smsc: x.smsc + 1 }).neto - r.neto)}</td></tr></tbody></table></div>
    <p class="note">Margen mensual después de estructura, con el resto de los supuestos fijos.</p>`;
  $('prop').innerHTML = propText(x, r);
  const ow = cotWaterfall(r), oh = cotHeat(x); if ($('cHn')) $('cHn').innerHTML = cotHeatNote(x);
  if (first || !cotCharts.w || cotCharts.w.isDisposed()) { cotCharts.w = mk($('cW'), ow); cotCharts.h = mk($('cH'), oh); } else { delete ow._wf; cotCharts.w.setOption(ow, true); cotCharts.h.setOption(oh, true); }
}

/* ===== INFORMES DESCARGABLES ===== */
function reportDoc(title, sub, audience, sections, { css = '', script = '', freq = '', swap = false, fonts = '' } = {}) {
  const b = brandTok(false), band = swap ? b['--accent'] : b['--band'], acc = swap ? b['--band'] : b['--accent'];
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${FONTS[S.font][1]}${fonts}&display=swap">
<style>:root{--band:${band};--accent:${acc};--real:${b['--real']};--ff:${fam()}}*{box-sizing:border-box}body{margin:0;background:#fff;color:#111a24;font:14px/1.55 var(--ff);font-variant-numeric:tabular-nums}
.hd{background:var(--band);color:#fff;padding:24px 0 20px}.acc{height:4px;background:var(--accent)}.in{max-width:1000px;margin:0 auto;padding:0 32px}
.bl{display:flex;align-items:center;gap:10px;font:600 11px/1 var(--ff);letter-spacing:.08em;text-transform:uppercase;color:#c9d3e2}.logo{width:28px;height:28px;border-radius:7px;background:var(--accent);display:inline-grid;place-items:center;color:#fff;font:700 11.5px var(--ff);letter-spacing:0}
h1{font:700 30px/1.1 var(--ff);margin:10px 0 6px;letter-spacing:-.015em}.hd p{margin:0;color:#dbe3ee}.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.tags span{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);color:#fff;font:600 11px/1 var(--ff);padding:5px 9px;border-radius:20px}
main{padding:8px 0 40px}section{border:1px solid #dfe4ea;border-radius:12px;padding:2px 20px 20px;margin:18px 0 0;background:#fff;box-shadow:0 1px 2px rgba(17,26,36,.04)}
h2{font:700 12.5px/1.3 var(--ff);letter-spacing:.07em;text-transform:uppercase;color:var(--band);margin:16px 0 12px;display:flex;align-items:center;gap:9px}h2::before{content:"";width:4px;height:14px;border-radius:2px;background:var(--accent);flex:none}
.kv{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kv div{background:#fff;border:1px solid #dfe4ea;border-top:3px solid var(--band);border-radius:10px;padding:9px 12px 10px;box-shadow:0 1px 2px rgba(17,26,36,.06)}.kv span{display:block;font:600 11.5px/1.3 var(--ff);color:#5d6874}.kv b{font:700 19px/1.3 var(--ff)}
.tw{overflow-x:auto;border:1px solid #d5dbe3;border-radius:10px}table{border-collapse:collapse;width:100%;font-size:12.5px}th,td{padding:7px 9px;border-bottom:1px solid #e6e9ed;text-align:right;white-space:nowrap}th{font:700 10.5px var(--ff);letter-spacing:.06em;text-transform:uppercase;color:#fff;background:var(--band);border-bottom:0}th:first-child,td:first-child{text-align:left}tbody tr:last-child td{border-bottom:0}tbody tr:nth-child(even) td{background:#f8fafc}
tr.calc td{font-weight:700;background:#e9eef5!important;border-top:1px solid #c6ccd4}.up{color:#16703f}.dn{color:#a82a2a}ul{padding-left:18px}li{margin:4px 0}.note{font-size:12px;color:#5d6874}svg{max-width:100%;height:auto;display:block}
.al{border:1px solid #e1e5ea;border-left:4px solid #c0392b;border-radius:8px;padding:8px 12px;margin:8px 0}.al.warn{border-left-color:#e0a10f}.al.good{border-left-color:#1d7a46}.al b{display:block}
.ft{border-top:1px solid #e1e5ea;margin-top:30px;padding-top:12px;font-size:11.5px;color:#5d6874}@media(max-width:640px){.kv{grid-template-columns:repeat(2,1fr)}.in{padding:0 18px}section{padding:2px 14px 14px}}
@media print{.hd,.acc,th,.kv div,h2::before{-webkit-print-color-adjust:exact;print-color-adjust:exact}h2{break-after:avoid}section{break-inside:avoid}}${css}</style></head><body>
<header class="hd"><div class="in"><div class="bl"><span class="logo">CS</span>Cobranzas del Sur S.A. · Datos ficticios</div><h1>${esc(title)}</h1><p>${esc(sub)}</p><div class="tags"><span>Para: ${esc(audience)}</span>${freq ? `<span>${esc(freq)}</span>` : ''}</div></div></header><div class="acc"></div>
<main><div class="in">${sections.map(s => `<section><h2>${esc(s.h)}</h2>${s.html}</section>`).join('')}
<div class="ft">Generado desde el tablero de Control de Gestión el ${today}. Montos en ${S.moneda === 'USD' ? 'dólares' : 'pesos'}; tablas en ${UNIT()}. Datos 100% ficticios.</div></div></main>${script ? `<script>${script}<\/script>` : ''}</body></html>`;
}
const tbl = (head, rows) => `<div class="tw"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const kvR = arr => `<div class="kv">${arr.map(([l, v, c]) => `<div><span>${l}</span><b class="${c || ''}">${v}</b></div>`).join('')}</div>`;
function eerrRows(ms) {
  const R = pnl(E.REAL, ms), F = pnl(E.FCST, ms), P = pnl(E.PPTO, ms), A = pnl(E.REAL, shift(ms, -12)), out = [];
  const line = (l, f, c = '') => { const r = f(R), p = f(P); out.push(`<tr class="${c}"><td>${l}</td><td>${tv(r)}</td><td>${tv(f(F))}</td><td>${tv(p)}</td><td class="${cls(r - p)}">${tv(r - p)}</td><td>${tv(f(A))}</td></tr>`); };
  N1.forEach((n, k) => { line(n, o => o.n1[n]); if (k === 2) line('Margen bruto', o => o.mb, 'calc'); if (k === 3) line('Margen operativo', o => o.mo, 'calc'); if (k === 4) line('Resultado antes de impuestos', o => o.uai, 'calc'); });
  line('Utilidad neta', o => o.un, 'calc'); return tbl(['Cuenta', 'Real', 'Forecast', 'Presup.', 'Desvío', 'Año ant.'], out);
}
function buildReport(kind, ci) {
  const ms = months(), per = perLbl(), R = pnl(E.REAL, ms), F = pnl(E.FCST, ms), P = pnl(E.PPTO, ms), stamp = D.meses[S.m];
  return withLight(() => {
    if (kind === 'gestion') {
      const A = buildAlerts(ms).slice(0, 6), le = LE(), pY = pnl(E.PPTO, range(Y25, DIC + 1));
      return [`Reunion-gestion-${stamp}.html`, reportDoc('Reunión de gestión', `Resultados de ${per} contra forecast y presupuesto`, 'Gerencia General', [
        { h: 'Números del período', html: kvR([['Ingresos', money(R.ing)], ['Margen bruto', pct(R.mb / R.ing, false)], ['Margen operativo', pct(R.mo / R.ing, false)], ['Utilidad neta', money(R.un)], ['vs presupuesto', pct((R.un - P.un) / Math.abs(P.un)), cls(R.un - P.un)], ['vs forecast', pct((R.un - F.un) / Math.abs(F.un)), cls(R.un - F.un)], ['Cierre proyectado 2025', money(le.un)], ['Presupuesto anual', money(pY.un)]]) },
        { h: 'Lectura', html: `<ul>${narrative(ms).map(t => `<li>${t}</li>`).join('')}</ul>` },
        { h: 'Alertas y qué hacer', html: A.map(a => `<div class="al ${a.sev}"><b>${esc(a.title)} · ${money(a.impact)}</b>${esc(a.what)} ${esc(a.why)}<br><i>Qué hacer:</i> ${esc(a.todo)}</div>`).join('') },
        { h: 'De la utilidad presupuestada a la real', html: ssr(resBridgeOpt(R, P, 'Presup.'), 820, 300) },
        { h: `Estado de resultados de gestión (${UNIT()})`, html: eerrRows(ms) },
        { h: 'Margen operativo mensual 2025', html: ssr(trendOpt('mo'), 820, 260) }])];
    }
    if (kind === 'ingresos') {
      const b = bridge(E.PPTO, ms), bf = bridge(E.FCST, ms);
      const fa = range(Y25, CORTE + 1).map(m => { const r = val(E.REAL, [m], ING), f = val(E.FCST, [m], ING), p = val(E.PPTO, [m], ING); return `<tr><td>${mlab(m)}</td><td>${tv(r)}</td><td>${tv(f)}</td><td class="${cls(r - f)}">${pct((r - f) / f)}</td><td>${tv(p)}</td><td class="${cls(r - p)}">${pct((r - p) / p)}</td></tr>`; });
      const rows = Object.entries(b.byC).filter(([, x]) => x.rr || x.rp).sort((a, z) => z[1].rr - a[1].rr).map(([c, x]) => `<tr><td>${D.carteras[c].code} · ${esc(D.carteras[c].nombre)}</td><td>${tv(x.rr)}</td><td>${tv(bf.byC[c].rp)}</td><td>${tv(x.rp)}</td><td class="${cls(x.rr - x.rp)}">${x.rp ? pct((x.rr - x.rp) / x.rp) : 'nueva'}</td><td>${tv(x.vol + x.inf + x.mix)}</td><td>${tv(x.ef)}</td><td>${tv(x.fee)}</td></tr>`);
      return [`Reunion-ingresos-${stamp}.html`, reportDoc('Reunión de ingresos', `Ingresos de ${per}: drivers, carteras y calidad del forecast`, 'Gerencia Comercial y de Operaciones', [
        { h: 'Números del período', html: kvR([['Real', money(R.ing)], ['Forecast', money(F.ing)], ['Presupuesto', money(P.ing)], ['vs presupuesto', pct((R.ing - P.ing) / P.ing), cls(R.ing - P.ing)]]) },
        { h: 'Por qué difiere del presupuesto', html: ssr(ingBridgeOpt(b, 'Presupuesto'), 820, 300) + '<p class="note">Ingreso = deuda asignada × % de recupero × fee × tipo de cambio. Descomposición secuencial.</p>' },
        { h: `Por cartera (${UNIT()})`, html: tbl(['Cartera', 'Real', 'Forecast', 'Presup.', 'Desvío', 'Volumen', 'Eficiencia', 'Fee'], rows) },
        { h: `Calidad del forecast mes a mes (${UNIT()})`, html: tbl(['Mes', 'Real', 'Forecast', 'Desvío', 'Presup.', 'Desvío'], fa) },
        { h: 'Evolución mensual', html: ssr(trendOpt('ing'), 820, 260) }])];
    }
    if (kind === 'rentab') {
      const rows = rentab(ms).sort((a, z) => z.mgn - a.mgn);
      return [`Reunion-rentabilidad-${stamp}.html`, reportDoc('Reunión de rentabilidad', `Margen por cartera en ${per}, con asignación de costos compartidos por driver`, 'Gerencia General y Finanzas', [
        { h: 'Margen por cartera', html: ssr(marginBarsOpt(rows), 820, 380) },
        { h: `Detalle (${UNIT()})`, html: tbl(['Cartera', 'Ingreso', 'Directo', 'Asignado', 'Margen', 'Margen %', 'Posiciones'], rows.map(x => `<tr><td>${x.code} · ${esc(x.nombre)}</td><td>${tv(x.ing)}</td><td>${tv(x.dir)}</td><td>${tv(x.asg)}</td><td class="${cls(x.mgn)}">${tv(x.mgn)}</td><td>${pct(x.mgnp, false)}</td><td>${x.pos}</td></tr>`)) },
        { h: 'Cómo se reparten los costos compartidos', html: ssr(sankeyOpt(ms, rows), 820, 460) },
        { h: 'Para decidir', html: `<ul>${rows.filter(x => x.mgnp < 0.15).map(x => `<li><b>${x.code}</b>: margen ${pct(x.mgnp, false)} con ${x.pos} posiciones. Revisar fee, dotación o continuidad.</li>`).join('') || '<li>Todas las carteras superan el 15% de margen.</li>'}</ul>` }])];
    }
    if (kind === 'cartera') {
      const d = carteraData(ci, ms), { c, x, b } = d; if (!x) return null;
      const preC = c.moneda === 'USD' ? 'US$ ' : '$ ', cats = range(Y25, DIC + 1).map(mlab), sr = SER();
      const drvT = range(Y25, CORTE + 1).map(m => { const q = dr(E.REAL, m, ci), p = dr(E.PPTO, m, ci); return q && q[3] ? `<tr><td>${mlab(m)}</td><td>${money(q[3] * q[4], { pre: preC })}</td><td>${pct(q[5], false)}</td><td>${p && p[3] ? pct(p[5], false) : '–'}</td><td>${pct(q[6], false)}</td><td>${q[8] + q[9]}</td></tr>` : ''; });
      const comp = [...d.comp].reverse();
      return [`Semanal-${c.code}-${stamp}.html`, reportDoc(`Semanal · ${c.nombre}`, `Números de la cartera en ${per}: ingresos, drivers, proyección y costos`, `Supervisor de ${c.code}`, [
        { h: 'Números del período', html: kvR([['Ingreso', money(x.ing)], ['Margen', money(x.mgn), cls(x.mgn)], ['Margen %', pct(x.mgnp, false)], ['Posiciones', x.pos]]) },
        { h: 'Temas para la charla', html: `<ul>${d.topics.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` },
        ...(b && b.rp ? [{ h: 'Ingreso contra presupuesto', html: ssr(waterfall(['vol', 'inf', 'ef', 'fee', 'fx', 'mix'].filter(k => Math.abs(b[k]) > 1).map(k => ({ name: EFF[k], v: b[k] })), { startLabel: 'Presupuesto', endLabel: 'Real', start: b.rp, end: b.rr }), 820, 280) }] : []),
        { h: 'Drivers mes a mes', html: tbl(['Mes', 'Deuda asignada', '% recupero', 'Recupero presup.', 'Fee', 'Posiciones'], drvT) },
        { h: `Cómo fue la proyección (${UNIT()})`, html: tbl(['Mes', 'Real', 'Forecast', 'Desvío', 'Presup.'], d.fa.map(z => `<tr><td>${mlab(z.m)}</td><td>${tv(z.r)}</td><td>${tv(z.f)}</td><td class="${cls(z.r - z.f)}">${z.f ? pct((z.r - z.f) / z.f) : '–'}</td><td>${tv(z.p)}</td></tr>`)) },
        { h: 'Margen mensual', html: ssr(lineOpt(cats, [{ ...sr.REAL, name: 'Margen %', data: d.mg }], { pctAxis: true }), 820, 220) },
        { h: `Composición de costos (${UNIT()})`, html: ssr(barsH(comp.map(z => z[0]), comp.map(z => z[1]), { colors: comp.map(z => IT[ITEM[z[0]]].tipo === 'Directo' ? T('--real') : T('--ppto')) }), 820, Math.max(200, comp.length * 24 + 30)) }])];
    }
    if (kind === 'ppto') return plReport();
    if (kind === 'cotizacion') {
      const x = S.cot, r = cotCalc(x);
      return ['Propuesta-cotizacion.html', reportDoc('Propuesta de gestión de cartera', 'Cotización mensual con escenarios y condiciones de equilibrio', 'Cliente (revisar antes de enviar)', [
        { h: 'Propuesta', html: `<p>${propText(x, r)}</p>` },
        { h: 'Resultado estimado por mes', html: kvR([['Ingreso', Mm(r.ing)], ['Margen con estructura', pct(r.mgn, false)], ['Fee de equilibrio', pct(r.feeBE, false)], ['Posiciones', r.pos]]) },
        { h: 'Del ingreso al margen', html: ssr(cotWaterfall(r), 820, 300) },
        { h: 'Escenarios', html: tbl(['Escenario', 'Ingreso', 'Margen', 'Margen %'], [['Pesimista', .85, .9], ['Base', 1, 1], ['Optimista', 1.1, 1.05]].map(([n, fr, fd]) => { const q = cotCalc({ ...x, rec: x.rec * fr, deuda: x.deuda * fd }); return `<tr><td>${n}</td><td>${Mm(q.ing)}</td><td>${Mm(q.neto)}</td><td>${pct(q.mgn, false)}</td></tr>`; })) },
        { h: '¿Con qué fee y qué recupero gana plata la cartera?', html: ssr(cotHeat(x), 820, 360) + `<p class="note">${cotHeatNote(x)}</p>` }])];
    }
    return null;
  });
}
function dlReport(kind, ci) {
  let out; try { out = kind === 'vistazo' ? vistazoReport() : kind === 'sup' ? supReport(ci) : buildReport(kind, ci); } catch (e) { console.error(e); toast('No se pudo armar el informe: ' + e.message); return; }
  if (!out) { toast('No hay datos para ese informe en el período'); return; }
  saveFile(out[0], out[1], 'text/html');
}

/* ===== EXCEL ===== */
const r2 = v => Math.round(v * 100) / 100;
function exportEerr() {
  const ms = months(), R = pnl(E.REAL, ms), F = pnl(E.FCST, ms), P = pnl(E.PPTO, ms), A = pnl(E.REAL, shift(ms, -12)), sc = SCALE();
  const rows = [[`Estado de resultados de gestión · ${perLbl()} · ${UNIT()}`], [], ['Nivel', 'Cuenta', 'Real', 'Forecast', 'Presupuesto', 'Año anterior', 'Desvío vs presup.']];
  const add = (lvl, l, f) => rows.push([lvl, l, r2(f(R) / sc), r2(f(F) / sc), r2(f(P) / sc), r2(f(A) / sc), r2((f(R) - f(P)) / sc)]);
  N1.forEach((n, k) => { add('N1', n, o => o.n1[n]); N2OF[n].forEach(z => { add('N2', z, o => o.n2[z]); IN2[z].forEach(i => add('Ítem', IT[i].item, o => o.it[i])); });
    if (k === 2) add('Total', 'Margen bruto', o => o.mb); if (k === 3) add('Total', 'Margen operativo', o => o.mo); if (k === 4) add('Total', 'Resultado antes de impuestos', o => o.uai); });
  add('Total', 'Utilidad neta', o => o.un);
  saveWorkbook(`EERR-gestion-${D.meses[S.m]}.xlsx`, [{ name: 'EERR', rows, cols: [8, 34, 12, 12, 12, 12, 14] }]);
}
function exportCarteras(rows) {
  const sc = SCALE(), out = [[`Rentabilidad por cartera · ${perLbl()} · ${UNIT()}`], [], ['Código', 'Cartera', 'Industria', 'Ingreso', 'Costo directo', 'Costo asignado', 'Estructura', 'Margen', 'Margen %', 'Posiciones']];
  rows.forEach(x => out.push([x.code, x.nombre, x.industria, r2(x.ing / sc), r2(x.dir / sc), r2(x.asg / sc), r2(x.est / sc), r2(x.mgn / sc), r2(x.mgnp * 100), x.pos]));
  saveWorkbook(`Rentabilidad-carteras-${D.meses[S.m]}.xlsx`, [{ name: 'Carteras', rows: out, cols: [8, 32, 16, 12, 12, 12, 12, 12, 10, 10] }]);
}
function exportBase() {
  const esN = ['Real', 'Presupuesto', 'Forecast'], res = [['Escenario', 'Mes', 'Cartera', 'N1', 'N2', 'Ítem', 'Tipo', 'Driver', 'Importe ARS', 'Importe USD']];
  for (let k = 0; k < D.res.v.length; k++) { const e = D.res.e[k], m = D.res.m[k], c = D.res.c[k], it = IT[D.res.i[k]], v = D.res.v[k]; res.push([esN[e], D.meses[m], c < 0 ? 'Estructura' : D.carteras[c].code, it.n1, it.n2, it.item, it.tipo, it.driver, v, r2(v / kp(e, m).tc)]); }
  const drv = [['Escenario', 'Mes', 'Cartera', 'Deuda (precios ene-25)', 'Índice', '% recupero', 'Fee', 'TC (USD)', 'Operadores', 'Posiciones PY', 'Minutos', 'SMS', 'Mails', 'Pagos', 'Consultas']];
  D.drv.forEach(r => drv.push([esN[r[0]], D.meses[r[1]], D.carteras[r[2]].code, ...r.slice(3)]));
  const kpi = [['Escenario', 'Mes', 'TC', 'Operadores', 'Posiciones PY', 'Posiciones', 'Horas', 'Costo operador', 'Costo SMS', 'Costo minuto', 'Índice precios', 'Índice salarial']]; D.kpi.forEach(r => kpi.push([esN[r[0]], D.meses[r[1]], ...r.slice(2)]));
  const car = [['Código', 'Cartera', 'Industria', 'Negocio', 'Moneda']]; D.carteras.forEach(c => car.push([c.code, c.nombre, c.industria, c.negocio, c.moneda]));
  const cta = [['N1', 'N2', 'Ítem', 'Tipo', 'Driver']]; IT.forEach(x => cta.push([x.n1, x.n2, x.item, x.tipo, x.driver]));
  const ic = [['Escenario', 'Mes', 'Pool TI', 'Pool Gerencia', 'TC', 'Saldo inicial USD', 'Facturado USD', 'Cobro USD', 'Dif. cambio', 'Dot ARG', 'Dot CM', 'Dot CA', 'Dot PY', 'Ing ARG', 'Ing CM', 'Ing CA', 'Ing PY']]; D.ic.forEach(r => ic.push([esN[r[0]], D.meses[r[1]], ...r.slice(2)]));
  const conc = [['Mes', 'Ajuste', 'Importe ARS']]; D.conc.forEach(r => conc.push([D.meses[r[0]], r[1], r[2]]));
  saveWorkbook('Base-control-gestion.xlsx', [{ name: 'Resultado', rows: res, cols: [12, 9, 11, 26, 28, 28, 12, 26, 14, 12] }, { name: 'Drivers', rows: drv }, { name: 'KPI operación', rows: kpi }, { name: 'Carteras', rows: car }, { name: 'Cuentas', rows: cta }, { name: 'Intercompany', rows: ic }, { name: 'Conciliación', rows: conc }]);
}
/* ===== INFORMES (pestaña) ===== */
function vInformes() {
  const opts = D.carteras.map((c, i) => `<option value="${i}">${c.code} · ${esc(c.nombre)}</option>`).join('');
  const card = (title, tags, desc, acts) => `<div><h5>${title}${tags.map(t => `<span class="tag">${t}</span>`).join('')}</h5><p>${desc}</p><div class="acts">${acts}</div></div>`;
  view.innerHTML = `<div class="formula"><b>Período:</b><span>${perLbl()} · ${S.moneda === 'USD' ? 'dólares' : 'pesos'}.</span><span>Cada informe es un archivo HTML: se abre en cualquier navegador, se adjunta a un mail o se imprime a PDF.</span></div>
  <section class="sec"><p class="eyb">Para reuniones</p><div class="rep">
    ${card('Gerencia · de un vistazo', ['Mensual', 'Gerencia General'], 'Una página: cinco indicadores con estado y tendencia, lo que hay que saber, alertas que se abren con un clic y por qué los ingresos se alejan del presupuesto.', '<button class="btn primary" data-r="vistazo">Descargar</button>')}
    ${card('Reunión de gestión completa', ['Mensual', 'Gerencia General'], 'Indicadores, lectura, alertas con acción, puente de resultado, estado de resultados y margen mensual.', '<button class="btn primary" data-r="gestion">Descargar</button><button class="btn" data-x="eerr">Excel del estado de resultados</button>')}
    ${card('Ingresos', ['Mensual', 'Comercial y Operaciones'], 'Puente por driver, carteras y calidad del forecast mes a mes.', '<button class="btn primary" data-r="ingresos">Descargar</button>')}
    ${card('Rentabilidad', ['Mensual', 'Gerencia y Finanzas'], 'Margen por cartera, reparto de costos compartidos y carteras a revisar.', '<button class="btn primary" data-r="rentab">Descargar</button><button class="btn" data-x="car">Excel de carteras</button>')}
  </div></section>
  <section class="sec"><p class="eyb">Para supervisores</p><div class="rep">
    ${card('Supervisores · tarjetas por cartera', ['Semanal', 'Supervisores', 'Sin sueldos'], `Una tarjeta por cartera con color de estado y lenguaje sin porcentajes («de cada $ 100…»): las tres palancas, los últimos seis meses, temas para la charla y un simulador «¿Y si…?». Mes: ${mlab(S.m)}.`, `<select id="supCi" aria-label="Cartera"><option value="all">Todas las carteras</option>${opts}</select><button class="btn primary" data-r="sup">Descargar</button>`)}
    ${card('Semanal en tablas por cartera', ['Semanal', 'Supervisor y jefe de área'], 'Temas para la charla, drivers mes a mes, proyección contra real, margen y composición de costos. Incluye costos de personal: solo para jefaturas.', `<select id="repCi" aria-label="Cartera">${opts}</select><button class="btn primary" data-r="cartera">Descargar</button>`)}
  </div></section>
  <section class="sec"><p class="eyb">Planificación y datos</p><div class="rep">
    ${card('Cierre 2025 y presupuesto 2026', ['Anual', 'Directorio'], 'Cierre con la reproyección de oct–dic y presupuesto 2026 mes a mes, con los supuestos y drivers del Planificador. El Excel trae las fórmulas vivas para seguir trabajando.', '<button class="btn primary" data-r="ppto">Informe</button><button class="btn" data-x="ppto">Excel con fórmulas</button>')}
    ${card('Propuesta de cotización', ['A pedido', 'Cliente'], 'Cotización de una cartera nueva con escenarios y condiciones de equilibrio, con los valores del Cotizador.', '<button class="btn primary" data-r="cotizacion">Descargar</button>')}
    ${card('Base de datos completa', ['Respaldo', 'Control de gestión'], 'Excel con resultado por escenario, mes, cartera e ítem; drivers; KPI; intercompany y conciliación.', '<button class="btn primary" data-x="base">Excel</button>')}
  </div></section>
  <p class="note">En el visor de Claude cada descarga pide confirmación. Si abrís el tablero como archivo HTML, se descargan directo. El Excel necesita conexión la primera vez.</p>`;
  view.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const k = b.dataset.r; dlReport(k, k === 'cartera' ? +$('repCi').value : k === 'sup' ? $('supCi').value : undefined); });
  const X = { base: exportBase, ppto: plExcel, eerr: exportEerr, car: () => exportCarteras(rentab(months()).sort((a, z) => z.mgn - a.mgn)) };
  view.querySelectorAll('[data-x]').forEach(b => b.onclick = () => X[b.dataset.x]());
}

/* ----- informe: gerencia de un vistazo ----- */
const VCSS = `.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.card{border:1px solid #e1e5ea;border-top:3px solid var(--band);border-radius:10px;padding:12px 13px;display:flex;flex-direction:column;gap:4px}
.card .l{display:flex;justify-content:space-between;align-items:flex-start;gap:6px;font:600 12px/1.3 var(--ff);color:#3f4b58}.card .v{font:800 23px/1.15 var(--ff);letter-spacing:-.02em;white-space:nowrap}.card .c{font-size:11.5px;color:#3f4b58}.card p{margin:0;font-size:11.5px;color:#5d6874}.card svg{height:34px;width:100%}
.st{display:inline-flex;align-items:center;gap:4px;font:700 10px/1 var(--ff);padding:3px 7px;border-radius:20px;white-space:nowrap}.st i{width:6px;height:6px;border-radius:50%;background:currentColor}.st.crit{background:#fbe6e6;color:#a82a2a}.st.warn{background:#fcefd2;color:#7a5000}.st.good{background:#e3f3e6;color:#16703f}
.know{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;font-size:14.5px}.know li::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-right:9px;vertical-align:2px}
.alx{border:1px solid #e1e5ea;border-radius:10px;margin:0 0 8px}.alx summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:10px 12px}.alx summary::-webkit-details-marker{display:none}.alx .t{font-weight:600}.alx .t small{display:block;font-weight:400;font-size:12px;color:#5d6874}
.alx dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;margin:0;padding:10px 14px 12px;border-top:1px solid #e1e5ea;font-size:13px}.alx dt{font:700 10px/1.9 var(--ff);letter-spacing:.07em;text-transform:uppercase;color:#5d6874}.alx dd{margin:0}
.brx .r{padding:9px 0;border-bottom:1px solid #eef1f4}.brx .r:last-child{border-bottom:0}.brx .h{display:flex;justify-content:space-between;gap:10px;font-size:13.5px}.brx .bar{display:grid;grid-template-columns:1fr 1fr;height:9px;margin:5px 0}.brx .bar>div:first-child{display:flex;justify-content:flex-end;border-right:1px solid #9aa3ad}.brx .bar span{display:block;height:9px}.brx .n{background:#c0392b;border-radius:3px 0 0 3px}.brx .p{background:#1d7a46;border-radius:0 3px 3px 0}.brx p{margin:0;font-size:12.5px;color:#3f4b58}
@media(max-width:820px){.cards{grid-template-columns:repeat(2,1fr)}}@media print{details{break-inside:avoid}}`;
function vistazoReport() {
  const ms = months(), per = perLbl(), stamp = D.meses[S.m];
  return withLight(() => {
    const C = cardsData().filter(c => c.k !== 'mb'), b = bridge(E.PPTO, ms), A = buildAlerts(ms).slice(0, 5);
    const cards = `<div class="cards">${C.map(c => `<div class="card"><div class="l">${esc(c.lbl)}<span class="st ${c.st[0]}"><i></i>${c.st[1]}</span></div><div class="v">${c.v}</div>${c.cmp.map(([l, v, t]) => `<div class="c"><b class="${cls(v)}">${t === 'pp' ? pp(v) : pct(v)}</b> ${l}</div>`).join('')}${spark(c.sp[0], c.sp[1], c.sp[2])}<p>${esc(c.phrase)}</p></div>`).join('')}</div>
      <p class="note">En cada tarjeta: línea azul = real 2025; punteada gris = presupuesto; rayada naranja = forecast.</p>`;
    const al = A.map(a => `<details class="alx"><summary><span class="st ${a.sev}"><i></i>${SEVL[a.sev]}</span><span class="t">${esc(a.title)}<small>${esc(a.sub)}</small></span><b>${money(a.impact)}</b></summary><dl><dt>Qué pasó</dt><dd>${esc(a.what)}</dd><dt>Por qué importa</dt><dd>${esc(a.why)}</dd><dt>Qué hacer</dt><dd>${esc(a.todo)}</dd></dl></details>`).join('');
    return [`Gerencia-vistazo-${stamp}.html`, reportDoc('Gerencia · de un vistazo', `Resultados de ${per} contra presupuesto y forecast`, 'Gerencia General', [
      { h: `Indicadores clave · ${per}`, html: cards },
      { h: 'Lo que hay que saber', html: `<ul class="know">${narrative(ms).map(t => `<li>${t}</li>`).join('')}</ul>` },
      { h: 'Alertas y oportunidades · tocá cada una para abrirla', html: al || '<p class="note">Sin alertas para el período.</p>' },
      { h: 'Por qué los ingresos se alejan del presupuesto', html: `<div class="brx">${brxRows(b, E.PPTO, ms)}</div>` }], { css: VCSS, freq: 'Mensual' })];
  });
}

/* ----- informe: supervisores (tarjetas de estado, interactivo) ----- */
const SUPCSS = `section{border:0;box-shadow:none;padding:0;margin:14px 0 0}h2::before{display:none}body{font-family:Figtree,Archivo,Arial,sans-serif}h1{font-family:"Bricolage Grotesque",Archivo,sans-serif}
.sum{display:flex;flex-direction:column;gap:8px;border:1px solid #e1e5ea;border-radius:16px;padding:14px 16px;margin:0 0 14px;max-width:540px}.sum b{font:800 22px "Bricolage Grotesque",Archivo,sans-serif}
.pb{display:block;height:12px;background:#eceef1;border-radius:6px;overflow:hidden;border:1px solid transparent}.pb>span{display:block;height:100%;border-radius:6px}
.tools{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;margin-bottom:14px}.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips button{display:flex;align-items:center;gap:7px;border:1.5px solid #d5dae0;background:#fff;color:#14202b;border-radius:999px;padding:8px 14px;min-height:42px;font:600 14px Figtree,Archivo,sans-serif;cursor:pointer}.chips button[aria-pressed=true]{background:#14202b;color:#fff;border-color:#14202b}.chips i{width:9px;height:9px;border-radius:50%}
.sorts{display:flex;gap:4px;background:#f2f4f6;border-radius:12px;padding:4px}.sorts button{border:0;background:transparent;color:#14202b;border-radius:9px;padding:8px 12px;min-height:40px;font:600 13.5px Figtree,Archivo,sans-serif;cursor:pointer}.sorts button[aria-pressed=true]{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(270px,100%),1fr));grid-auto-flow:dense;gap:14px}
.cd{text-align:left;border:1px solid;border-radius:18px;padding:16px 18px;display:flex;flex-direction:column;gap:10px;cursor:pointer;font:15px Figtree,Archivo,sans-serif;color:#14202b;box-shadow:0 10px 24px -18px rgba(0,0,0,.28)}
.top{display:flex;justify-content:space-between;align-items:center;gap:8px}.top small{display:block;font:700 12px Figtree,sans-serif;letter-spacing:.06em;color:#5b6672}.top b{font-weight:600}
.chip{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:#fff;border:1px solid;font:700 12.5px Figtree,Archivo,sans-serif;white-space:nowrap}.chip svg{flex:none;width:14px;height:14px}.top>span:first-child{min-width:0}
.big{font:800 32px/1 "Bricolage Grotesque",Archivo,sans-serif;letter-spacing:-.02em}.big small{font:400 14px Figtree,sans-serif;color:#46525e;letter-spacing:0}
.cd .pb{background:#fff;border:1px solid;height:10px}.go{font-weight:700;color:var(--accent)}
.op{grid-column:1/-1;border:1px solid;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 18px 40px -24px rgba(0,0,0,.35)}.oh{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 20px;border-bottom:1px solid}
.oh small{font:700 12px Figtree,sans-serif;letter-spacing:.06em;color:#5b6672}.oh h3{margin:2px 0;font:800 24px/1.15 "Bricolage Grotesque",Archivo,sans-serif}.oh p{margin:0}.oh p b{font:800 20px "Bricolage Grotesque",Archivo,sans-serif}
.cl{border:1px solid #d5dae0;background:#fff;color:#14202b;border-radius:12px;padding:10px 14px;min-height:44px;font:600 14px Figtree,sans-serif;cursor:pointer}
.ob{display:flex;flex-wrap:wrap;gap:22px;padding:18px 20px 20px}.lv{flex:2 1 420px;min-width:0}.sim{flex:1 1 280px;min-width:0;background:#f4f6f8;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px}
h4{margin:16px 0 8px;font:700 15px Figtree,Archivo,sans-serif}.lv h4:first-child{margin-top:0}.sim h4{margin:0;font:800 20px "Bricolage Grotesque",Archivo,sans-serif}
.lvs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.lvs div{border:1px solid;border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:3px;font-size:13px;color:#46525e}.lvs b{font:800 24px/1.05 "Bricolage Grotesque",Archivo,sans-serif;color:#14202b}
.main{background:#f4f6f8;border-radius:12px;padding:10px 14px;margin:12px 0 0;font-size:15px}
.lg{font:400 12px Figtree,sans-serif;color:#46525e;margin-left:8px}.lg i{display:inline-block;width:11px;height:9px;background:var(--real);margin:0 4px 0 8px}.lg i.m{background:none;border:1.5px solid #7d868f}
.bars{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.bx{position:relative;height:100px;border-bottom:1px solid #9aa3ad}.bx span{position:absolute;bottom:0;width:40%;border-radius:5px 5px 0 0}.bx .m{left:8%;border:1.5px solid #7d868f;border-bottom:0;box-sizing:border-box}.bx .r{left:52%;background:var(--real)}.bars small{display:block;text-align:center;font-size:12px;color:#5b6672;margin-top:4px}
.sim label{font-size:14.5px}.sim input{width:100%;accent-color:var(--accent);height:30px}.sc{display:flex;justify-content:space-between;font-size:12px;color:#5b6672}.res{background:#fff;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:3px}.res b{font:800 28px/1.05 "Bricolage Grotesque",Archivo,sans-serif}.sim p{margin:0;font-size:14px}
@media print{.tools,.cl{display:none}}`;
function supApp(DATA, CUR, MES, SINGLE) {
  const nf = d => new Intl.NumberFormat('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const MINUS = '−';
  const money = v => { const a = Math.abs(v) / 1e6; return (v < 0 ? MINUS : '') + CUR + nf(a >= 1000 ? 0 : 1).format(a) + ' M'; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ST = { crit: ['Lejos', '#a82a2a', '#fdf2f2', '#f1c9c9'], warn: ['Cerca', '#7a5000', '#fdf6e6', '#efd9a6'], good: ['En meta', '#16703f', '#eff8f1', '#c3e3cc'] };
  const SV = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  const ICO = { crit: SV + '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17.5h.01"/></svg>', warn: SV + '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>', good: SV + '<path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' };
  const stOf = r => r >= 1 ? 'good' : r >= 0.95 ? 'warn' : 'crit';
  const d100 = v => nf(1).format(v * 100);
  const all = DATA.map(c => { const r = c.ingP ? c.ing / c.ingP : 1; return Object.assign({}, c, { ratio: r, st: stOf(r) }); });
  const S = { filt: 'all', sort: 'gap', open: SINGLE ? all[0].c : null, sim: 0 };
  const root = document.getElementById('app');
  const gap = c => c.ing >= c.ingP ? 'Superó la meta por ' + money(c.ing - c.ingP) : 'Faltan ' + money(c.ingP - c.ing) + ' para la meta';
  const chip = st => '<span class="chip" style="color:' + ST[st][1] + ';border-color:' + ST[st][3] + '">' + ICO[st] + ST[st][0] + '</span>';
  function simTxt(c) {
    const ns = c.deu * (c.rec + S.sim / 100) * c.fee, nst = stOf(c.ingP ? ns / c.ingP : 1), need = c.deu * c.fee ? c.ingP / (c.deu * c.fee) : 0;
    return { delta: S.sim === 0 ? 'lo mismo que hoy' : '$ ' + nf(1).format(Math.abs(S.sim)) + (S.sim > 0 ? ' más' : ' menos'), r: money(ns), ink: ST[nst][1],
      txt: ns >= c.ingP ? 'Superaríamos la meta por ' + money(ns - c.ingP) : 'Faltarían ' + money(c.ingP - ns),
      need: need <= c.rec ? 'Hoy ya cobramos lo necesario para la meta: $ ' + d100(c.rec) + ' de cada $ 100.' : 'Para llegar a la meta hay que cobrar $ ' + d100(need) + ' de cada $ 100 de deuda (hoy: $ ' + d100(c.rec) + ').' };
  }
  function card(c) {
    const s = ST[c.st], w = Math.min(c.ratio, 1) * 100;
    if (S.open !== c.c) return '<button class="cd" data-open="' + c.c + '" aria-expanded="false" style="background:' + s[2] + ';border-color:' + s[3] + '"><span class="top"><span><small>' + c.c + '</small><b>' + esc(c.n) + '</b></span>' + chip(c.st) + '</span>' +
      '<span class="big">' + money(c.ing) + ' <small>de ' + money(c.ingP) + '</small></span><span class="pb" style="border-color:' + s[3] + '"><span style="width:' + w.toFixed(1) + '%;background:' + s[1] + '"></span></span><span>' + gap(c) + '</span><span class="go">Ver qué pasó ›</span></button>';
    const L = [['Deuda que nos asignaron', money(c.deu), money(c.deuP), c.deuP ? c.deu / c.deuP : 1], ['Cobramos de cada $ 100 de deuda', '$ ' + d100(c.rec), '$ ' + d100(c.recP), c.recP ? c.rec / c.recP : 1], ['Nos quedamos de cada $ 100 cobrados', '$ ' + d100(c.fee), '$ ' + d100(c.feeP), c.feeP ? c.fee / c.feeP : 1]];
    const worst = L.reduce((a, x, i) => x[3] < L[a][3] ? i : a, 0);
    const WHY = ['el cliente nos asignó menos deuda que la prevista.', 'estamos cobrando menos de cada $ 100 de deuda.', 'el cliente nos paga menos comisión por lo cobrado.'];
    const main = L[worst][3] >= 0.995 ? 'Las tres palancas están en meta o por encima.' : 'Lo que más pesa: ' + WHY[worst];
    const mx = Math.max.apply(null, c.h.concat(c.hp, [1])), sim = simTxt(c);
    const lv = L.map(x => { const st = stOf(x[3]); return '<div style="background:' + ST[st][2] + ';border-color:' + ST[st][3] + '"><span>' + x[0] + '</span><b>' + x[1] + '</b><span>Meta: ' + x[2] + '</span><strong style="color:' + ST[st][1] + '">' + (st === 'good' ? 'Bien' : st === 'warn' ? 'Un poco abajo' : 'Abajo de la meta') + '</strong></div>'; }).join('');
    const bars = c.h.map((v, i) => '<div title="' + c.hm[i] + ': entró ' + money(v) + ' · meta ' + money(c.hp[i]) + '"><div class="bx"><span class="m" style="height:' + (c.hp[i] / mx * 100).toFixed(1) + '%"></span><span class="r" style="height:' + (v / mx * 100).toFixed(1) + '%"></span></div><small>' + c.hm[i] + '</small></div>').join('');
    return '<div class="op" style="border-color:' + s[3] + '"><div class="oh" style="background:' + s[2] + ';border-color:' + s[3] + '"><div><small>' + c.c + ' · ' + esc(c.ind) + '</small><h3>' + esc(c.n) + '</h3><p><b>' + money(c.ing) + '</b> de ' + money(c.ingP) + ' esperados · ' + gap(c) + '</p></div>' + (SINGLE ? chip(c.st) : '<button class="cl" data-open="">Cerrar</button>') + '</div>' +
      '<div class="ob"><div class="lv"><h4>Las tres palancas del mes</h4><div class="lvs">' + lv + '</div><p class="main">' + main + '</p>' +
      '<h4>Últimos 6 meses <span class="lg"><i></i>Entró<i class="m"></i>Meta</span></h4><div class="bars">' + bars + '</div>' +
      (c.topics.length ? '<h4>Temas para la charla</h4><ul>' + c.topics.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '') + '</div>' +
      '<div class="sim"><h4>¿Y si…?</h4><label for="rg">Si de cada $ 100 de deuda cobramos <b id="sd">' + sim.delta + '</b></label><input id="rg" type="range" min="-2" max="4" step="0.5" value="' + S.sim + '"><div class="sc"><span>−$ 2</span><span>sin cambio</span><span>+$ 4</span></div>' +
      '<div class="res"><span>Llegaríamos a</span><b id="sr">' + sim.r + '</b><strong id="st" style="color:' + sim.ink + '">' + sim.txt + '</strong></div><p id="sn">' + sim.need + '</p></div></div></div>';
  }
  function render() {
    const counts = { crit: 0, warn: 0, good: 0 }; all.forEach(c => counts[c.st]++);
    const list = all.filter(c => S.filt === 'all' || c.st === S.filt);
    list.sort(S.sort === 'gap' ? (a, b) => a.ratio - b.ratio : S.sort === 'size' ? (a, b) => b.ingP - a.ingP : (a, b) => a.c.localeCompare(b.c));
    const tr = all.reduce((s, c) => s + c.ing, 0), tp = all.reduce((s, c) => s + c.ingP, 0), ts = stOf(tp ? tr / tp : 1);
    const head = '<div class="sum"><span>Entraron <b>' + money(tr) + '</b> de ' + money(tp) + ' esperados en ' + MES + '</span><span class="pb"><span style="width:' + (Math.min(tp ? tr / tp : 1, 1) * 100).toFixed(1) + '%;background:' + ST[ts][1] + '"></span></span><span>De cada $ 100 esperados entraron <b style="color:' + ST[ts][1] + '">$ ' + nf(0).format(tp ? tr / tp * 100 : 0) + '</b></span></div>';
    const tools = '<div class="tools"><div class="chips" role="group" aria-label="Filtrar por estado">' + [['all', 'Todas', all.length, '#14202b'], ['crit', 'Lejos de la meta', counts.crit, ST.crit[1]], ['warn', 'Cerca', counts.warn, ST.warn[1]], ['good', 'En meta', counts.good, ST.good[1]]].map(x => '<button data-f="' + x[0] + '" aria-pressed="' + (S.filt === x[0]) + '"><i style="background:' + x[3] + '"></i>' + x[1] + ' <b>' + x[2] + '</b></button>').join('') + '</div>' +
      '<div class="sorts" role="group" aria-label="Ordenar">' + [['gap', 'Más lejos de la meta'], ['size', 'Más grandes'], ['az', 'A–Z']].map(x => '<button data-s="' + x[0] + '" aria-pressed="' + (S.sort === x[0]) + '">' + x[1] + '</button>').join('') + '</div></div>';
    root.innerHTML = SINGLE ? card(all[0]) : head + tools + '<div class="grid">' + list.map(card).join('') + '</div>';
    root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { S.filt = b.dataset.f; render(); });
    root.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { S.sort = b.dataset.s; render(); });
    root.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { S.open = b.dataset.open || null; S.sim = 0; render(); const o = root.querySelector('.op'); if (o && o.scrollIntoView) o.scrollIntoView({ block: 'nearest' }); });
    const rg = document.getElementById('rg');
    if (rg) rg.oninput = () => { S.sim = parseFloat(rg.value); const t = simTxt(all.find(x => x.c === S.open)); document.getElementById('sd').textContent = t.delta; document.getElementById('sr').textContent = t.r; const st = document.getElementById('st'); st.textContent = t.txt; st.style.color = t.ink; document.getElementById('sn').textContent = t.need; };
  }
  render();
}
function supReport(which) {
  const m = S.m, ms = [m], U = S.moneda === 'USD', h6 = range(m - 5, m + 1), stamp = D.meses[m];
  const data = (which === 'all' ? D.carteras.map((_, i) => i) : [+which]).map(ci => {
    const c = D.carteras[ci], r = dr(E.REAL, m, ci), p = dr(E.PPTO, m, ci); if (!r || !r[3]) return null;
    const fr = U ? kp(E.REAL, m).tc : 1, fp = U ? kp(E.PPTO, m).tc : 1, d = carteraData(ci, ms);
    return { c: c.code, n: c.nombre, ind: c.industria, ing: val(E.REAL, ms, ING, ci), ingP: val(E.PPTO, ms, ING, ci), deu: r[3] * r[4] * r[7] / fr, deuP: p && p[3] ? p[3] * p[4] * p[7] / fp : 0,
      rec: r[5], recP: p ? p[5] : 0, fee: r[6], feeP: p ? p[6] : 0, h: h6.map(k => val(E.REAL, [k], ING, ci)), hp: h6.map(k => val(E.PPTO, [k], ING, ci)),
      hm: h6.map(k => MES[+D.meses[k].slice(5) - 1]), topics: d.topics.filter(t => !/^Mayor costo/.test(t)) };
  }).filter(Boolean);
  if (!data.length) return null;
  const single = which !== 'all', one = data[0];
  const js = `(${supApp.toString()})(${JSON.stringify(data).replace(/</g, '\\u003c')}, ${JSON.stringify(cur())}, ${JSON.stringify(mlab(m))}, ${single});`;
  return [single ? `Supervisor-${one.c}-${stamp}.html` : `Supervisores-${stamp}.html`,
    reportDoc(single ? one.n : 'Tus carteras del mes', `Ingresos de ${mlab(m)} contra la meta del presupuesto, palancas y temas para la charla`, single ? `Supervisor de ${one.c}` : 'Supervisores',
      [{ h: single ? `Cartera ${one.c} · ${mlab(m)}` : `Carteras · ${mlab(m)} · tocá una tarjeta para abrirla`, html: '<div id="app"></div><noscript>Este informe necesita JavaScript para mostrarse.</noscript>' }],
      { css: SUPCSS, script: js, freq: 'Semanal', swap: true, fonts: '&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@400;600;700' })];
}

/* ---------- recorrido "Cómo se usa" ---------- */
const TOUR = [
  ['ctlBox', 'Elegí el mes, si querés ver el mes o el acumulado del año, y la moneda. Todo el tablero se recalcula. En «Ajustes» elegís si el detalle se abre en página completa o en un panel lateral.'],
  ['tabList', 'Cada pestaña responde una pregunta: estado de resultados, rentabilidad por cartera, simulador de cierre, planificador de cierre y presupuesto, intercompany, cotizador e informes.'],
  ['tKnow', 'Empezá por acá: tres frases con lo que pasó en el período y por qué.'],
  ['tCards', 'Cinco indicadores con su estado y su tendencia contra presupuesto y forecast. Tocá uno para abrir el detalle.'],
  ['tAlerts', 'Lo que hay que mirar, ordenado por impacto en pesos. Tocá una alerta para ver qué pasó, por qué importa y qué hacer.'],
  ['tBridge', 'Por qué los ingresos se alejan del presupuesto, factor por factor y con su explicación.'],
  ['btnRep', 'Informes para cada reunión (gerencia, ingresos, rentabilidad, supervisores) y descargas en Excel.']];
let tourI = -1;
function tourStart() { $('adj').open = false; if (detOpen()) { hideDet(); stack.length = 0; } if (S.tab !== 'resumen') goTab('resumen'); tourI = 0; $('tourLayer').hidden = false; tourShow(); }
function tourEnd() { tourI = -1; $('tourLayer').hidden = true; }
function tourShow() {
  const [id, txt] = TOUR[tourI], el = $(id); if (!el) { tourEnd(); return; }
  $('tourN').textContent = `Paso ${tourI + 1} de ${TOUR.length}`; $('tourTxt').textContent = txt;
  $('tourPrev').hidden = tourI === 0; $('tourNext').textContent = tourI === TOUR.length - 1 ? 'Terminar' : 'Siguiente';
  const r = el.getBoundingClientRect(); if (r.top < 70 || r.bottom > innerHeight - 220) window.scrollTo({ top: Math.max(0, scrollY + r.top - 110) });
  tourPlace(); $('tourNext').focus();
}
function tourPlace() {
  if (tourI < 0) return;
  const el = $(TOUR[tourI][0]), r = el.getBoundingClientRect(), pad = 8, sx = scrollX, sy = scrollY, tip = $('tourTip');
  Object.assign($('tourSpot').style, { left: r.left + sx - pad + 'px', top: r.top + sy - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
  const tw = tip.offsetWidth, th = tip.offsetHeight, left = Math.min(Math.max(12, r.left), innerWidth - tw - 12) + sx;
  let top = r.bottom + 18; if (top + th > innerHeight - 8 && r.top - th - 18 > 8) top = r.top - th - 18; if (top + th > innerHeight - 8) top = Math.max(8, innerHeight - th - 8);
  Object.assign(tip.style, { left: left + 'px', top: top + sy + 'px' });
}
$('tourNext').onclick = () => { if (tourI >= TOUR.length - 1) tourEnd(); else { tourI++; tourShow(); } };
$('tourPrev').onclick = () => { if (tourI > 0) { tourI--; tourShow(); } };
$('tourEnd').onclick = tourEnd;
window.addEventListener('resize', () => tourPlace());
window.addEventListener('scroll', () => tourPlace(), { passive: true });

/* ---------- tema: re-render al cambiar ---------- */
const rerender = () => { applyBrand(); if (detOpen()) closeDrawer(); render(); };
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rerender);
new MutationObserver(rerender).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
applyBrand(); applyFont();
render();
})();
