/* Caso 03 · Alertas y auditoría continua · Reparto Federal S.A. (datos ficticios)
   Las alertas se recalculan en el navegador con los mismos criterios que alertas.py y que los SQL, así los parámetros se prueban en vivo. */
'use strict';
const DATA = JSON.parse(document.getElementById('data').textContent);
const $ = id => document.getElementById(id);
const MES_N = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const _nf = {};
const nf = d => (_nf[d] ??= new Intl.NumberFormat('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const CMP = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });
const MINUS = '−';
const fmt = {
  int: v => nf(0).format(v),
  ars: v => (v < 0 ? MINUS : '') + '$ ' + (Math.abs(v) >= 1e4 ? CMP.format(Math.abs(v)) : nf(0).format(Math.abs(Math.round(v)))),
  arsF: v => (v < -0.5 ? MINUS : '') + '$ ' + nf(0).format(Math.abs(Math.round(v))),
  pct: r => { const x = Math.round(r * 1000) / 10; return x === 0 ? '0%' : (x < 0 ? MINUS : '') + nf(Math.abs(x) >= 100 ? 0 : 1).format(Math.abs(x)) + '%'; },
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
};
/* fechas como número de día (UTC) para comparar igual que pandas */
const day = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const iso = n => new Date(n * 864e5).toISOString().slice(0, 10);
const fdl = s => { const [y, m, d] = (typeof s === 'number' ? iso(s) : s).split('-'); return `${d}/${m}/${y}`; };
const fd = s => fdl(s).slice(0, 5);
const DC = day(DATA.meta.corte);
const halfEven = x => { const f = Math.floor(x), r = x - f; return r > 0.5 ? f + 1 : r < 0.5 ? f : (f % 2 === 0 ? f : f + 1); };

/* ---------- maestros ---------- */
const SUC = Object.fromEntries(DATA.suc.map(s => [s[0], s[1]]));
const SUP = Object.fromEntries(DATA.sup.map(s => [s[0], { nom: s[1], suc: s[2] }]));
const REP = Object.fromEntries(DATA.rep.map(r => [r[0], { nom: r[1], sup: r[2], suc: r[3], tipo: r[4] }]));
const CLI = Object.fromEntries(DATA.cli.map(c => [c[0], { id: c[0], nom: c[1], tipo: c[2], rep: c[3], cond: c[4], medio: c[5], inc: c[6] }]));
const repLbl = r => REP[r] ? (REP[r].tipo === 'Comercial' ? r : REP[r].nom) : r;
const ORDEN = DATA.meta.reglas.map(r => r[0]);
const RG = Object.fromEntries(DATA.meta.reglas.map(r => [r[0], { nom: r[1], resp: r[2] }]));
const TXT = {
  equipo_sin_abono: { corto: 'Sin abono', que: 'Equipos con abono mensual instalados hace más del plazo de tolerancia a los que no se les facturó el último mes.', por: 'Es facturación que se pierde todos los meses. Pasa cuando el técnico instala y nadie da de alta el abono, o cuando un cambio de domicilio lo da de baja.', cuenta: 'Por equipo' },
  equipo_sin_consumo: { corto: 'Sin consumo', que: 'Equipos en comodato por consumo en clientes que no compran con cargo hace más de los días indicados.', por: 'El equipo es de la empresa y se presta a cambio de consumo. Sin compras, es un activo inmovilizado en la calle (y a veces en un cliente dado de baja).', cuenta: 'Por equipo' },
  solo_sin_cargo: { corto: 'Solo sin cargo', que: 'Clientes que compraban con cargo y en la ventana recibieron solo entregas sin cargo (promo 2×1 o bonificación).', por: 'La venta no aparece pero el producto sale. Si nadie lo autorizó, puede ser producto entregado y cobrado por fuera.', cuenta: 'Por cliente' },
  incobrables: { corto: 'Incobrables', que: 'Repartos con incobrables muy por encima de la mediana, o con incobrables a clientes que siguieron comprando después.', por: 'Un incobrable baja la deuda de golpe. Si el cliente sigue comprando, no era incobrable: la deuda se borró en lugar de cobrarse.', cuenta: 'Por reparto' },
  cobro_sin_visita: { corto: 'Cobro sin visita', que: 'Repartos que cargan cobros en efectivo en días en que no visitaron a ese cliente. El efectivo pagado en la sucursal no cuenta.', por: 'Cobrar y cargar días después es tener la plata del cliente fuera de la caja (jineteo). También puede ser una visita mal cargada.', cuenta: 'Por reparto' },
  nc_fuera_patron: { corto: 'NC fuera de patrón', que: 'Notas de crédito que superan el piso y son varias veces lo que el cliente factura en un mes habitual.', por: 'Una NC desproporcionada baja la deuda sin que entre plata. El motivo cargado suele parecer normal: lo que la delata es el monto.', cuenta: 'Por nota de crédito' },
  cambio_ruta: { corto: 'Cambio de ruta', que: 'Clientes pasados a una ruta que no vende (técnica o administración) con deuda.', por: 'Esa deuda sale de la gestión de cobranza y de los días calle del reparto de origen: el indicador mejora sin cobrar.', cuenta: 'Por cliente' },
};
const PDEF = DATA.meta.params;
const OPTS = {
  abono_tol: [[30, 45, 60, 90], 'Tolerancia desde la instalación', x => x + ' días', 'equipo_sin_abono'],
  consumo_dias: [[30, 45, 60, 90], 'Sin compras con cargo hace más de', x => x + ' días', 'equipo_sin_consumo'],
  consumo_antig: [[30, 60, 90], 'Equipo instalado hace más de', x => x + ' días', 'equipo_sin_consumo'],
  sc_ventana: [[21, 28, 42], 'Ventana', x => x + ' días', 'solo_sin_cargo'],
  sc_min: [[2, 3], 'Entregas sin cargo, como mínimo', x => String(x), 'solo_sin_cargo'],
  inc_ventana: [[90, 180, 365], 'Ventana', x => x + ' días', 'incobrables'],
  inc_min: [[2, 3, 4], 'Incobrables, como mínimo', x => String(x), 'incobrables'],
  inc_veces: [[2, 3, 4, 5], 'Veces la mediana de los repartos', x => nf(0).format(x) + '×', 'incobrables'],
  inc_sigue: [[1, 2, 3], 'A clientes que siguen comprando', x => String(x), 'incobrables'],
  csv_ventana: [[30, 60, 90], 'Ventana', x => x + ' días', 'cobro_sin_visita'],
  csv_min: [[2, 3, 5], 'Casos por reparto, como mínimo', x => String(x), 'cobro_sin_visita'],
  nc_ventana: [[30, 60, 90, 180], 'Ventana', x => x + ' días', 'nc_fuera_patron'],
  nc_piso: [[20000, 50000, 100000], 'Piso', x => fmt.ars(x), 'nc_fuera_patron'],
  nc_veces: [[1.5, 2, 3], 'Veces la facturación mensual habitual', x => nf(1).format(x) + '×', 'nc_fuera_patron'],
  ruta_piso: [[20000, 50000, 100000], 'Saldo al cambiar de ruta, como mínimo', x => fmt.ars(x), 'cambio_ruta'],
};
const ESTADOS = ['Sin revisar', 'En revisión', 'Justificada', 'Confirmada'];

/* ---------- estado ---------- */
const S = { tab: 'res', regla: ORDEN[0], suc: '', sup: '', rep: '', q: '', todas: false };
let P = Object.assign({}, PDEF, store.get('rf3_params', {}));
let REV = store.get('rf3_rev', {});

/* ---------- motor (mismo criterio que alertas.py) ---------- */
const CAND = DATA.cand;
let CACHE = { key: '', val: null };
function evaluar(p = P) {
  const key = JSON.stringify(p);
  if (CACHE.key === key) return CACHE.val;
  const out = [];
  const push = (regla, clave, cli, rep, fecha, impacto, ctx) => out.push({ regla, clave: String(clave), cli, rep, fecha, impacto, ctx });
  // A1
  for (const [eq, cli, tipo, inst, abono, meses, desde] of CAND.equipo_sin_abono) {
    if (day(inst) <= DC - p.abono_tol) push('equipo_sin_abono', eq, cli, null, Math.max(day(inst) + p.abono_tol, day(desde)), abono * meses, { eq, tipo, inst, abono, meses, desde });
  }
  // A2
  for (const [eq, cli, tipo, inst, valor, ult, dias] of CAND.equipo_sin_consumo) {
    if (day(inst) <= DC - p.consumo_antig && dias > p.consumo_dias) push('equipo_sin_consumo', eq, cli, null, day(ult) + p.consumo_dias + 1, valor, { eq, tipo, inst, ult, dias });
  }
  // A3
  const W = p.sc_ventana, H = p.sc_hist;
  for (const [c, ent] of Object.entries(CAND.solo_sin_cargo)) {
    const w = ent.filter(e => day(e[0]) > DC - W);
    const h = ent.filter(e => day(e[0]) <= DC - W && day(e[0]) > DC - W - H && e[1] > 0);
    const imp = w.reduce((a, e) => a + e[1], 0), sc = w.reduce((a, e) => a + e[2], 0);
    if (w.length >= p.sc_min && imp === 0 && sc > 0 && h.length >= p.sc_hist_min) {
      const prom = halfEven(h.reduce((a, e) => a + e[1], 0) / h.length);
      const bon = CAND.bonificaciones.find(b => b[0] === +c && day(b[1]) <= day(w[0][0]) && day(b[1]) >= day(w[0][0]) - 30);
      push('solo_sin_cargo', c, +c, null, day(w[p.sc_min - 1][0]), prom * w.length, { n: w.length, sc, prom, desde: w[0][0], bon });
    }
  }
  // A4
  const inc = CAND.incobrables.filter(x => day(x[0]) > DC - p.inc_ventana);
  const venta = CAND.venta_reparto[String(p.inc_ventana)];
  const por = {};
  for (const x of inc) (por[x[2]] ??= []).push(x);
  const ratio = Object.fromEntries(Object.keys(venta).map(r => [r, venta[r] > 0 ? (por[r] || []).reduce((a, x) => a + x[3], 0) / venta[r] : 0]));
  const rs = Object.values(ratio).sort((a, b) => a - b), med = rs[Math.floor(rs.length / 2)];
  for (const [r, g] of Object.entries(por)) {
    const conc = g.length >= p.inc_min && ratio[r] > p.inc_veces * med;
    const sig = g.filter(x => x[5] === 1);
    if (conc || sig.length >= p.inc_sigue) {
      const f = Math.min(conc ? day(g[p.inc_min - 1][0]) : Infinity, sig.length >= p.inc_sigue ? day(sig[p.inc_sigue - 1][0]) : Infinity);
      push('incobrables', r, 0, r, f, g.reduce((a, x) => a + x[3], 0), { casos: g, ratio: ratio[r], med, conc, sigue: sig.length });
    }
  }
  // A5
  const cs = CAND.cobro_sin_visita.filter(x => day(x[0]) > DC - p.csv_ventana), pr = {};
  for (const x of cs) (pr[x[2]] ??= []).push(x);
  for (const [r, g] of Object.entries(pr)) {
    if (g.length >= p.csv_min) push('cobro_sin_visita', r, 0, r, day(g[p.csv_min - 1][0]), g.reduce((a, x) => a + x[3], 0), { casos: g, dias: g.reduce((a, x) => a + Math.max(0, x[4]), 0) / g.length });
  }
  // A6
  for (const [f, cli, rep, imp, fac6, motivo, rev] of CAND.nc_fuera_patron) {
    if (day(f) > DC - p.nc_ventana && imp >= p.nc_piso && (fac6 <= 0 || imp > p.nc_veces * fac6)) push('nc_fuera_patron', `${cli}|${f}`, cli, null, day(f), imp, { f, rep, fac6, motivo, rev });
  }
  // A7
  for (const [f, cli, ori, des, motivo, saldo, com, efecto] of CAND.cambio_ruta) {
    if (!com && saldo >= p.ruta_piso) push('cambio_ruta', cli, cli, ori, day(f), saldo, { f, ori, des, motivo, efecto });
  }
  for (const a of out) {
    a.repEf = a.rep || (CLI[a.cli] ? CLI[a.cli].rep : null);
    a.id = a.regla + ':' + a.clave;
    a.estado = REV[a.id] || estadoDato(a);
  }
  CACHE = { key, val: out };
  return out;
}
function estadoDato(a) {
  if (a.regla === 'nc_fuera_patron') { const r = a.ctx.rev || ''; return !r ? 'Sin revisar' : /justificada/i.test(r) ? 'Justificada' : 'Confirmada'; }
  if (a.regla === 'solo_sin_cargo' && a.ctx.bon) return 'Justificada';
  return 'Sin revisar';
}
const abierta = a => a.estado !== 'Justificada';
const enFiltro = a => { const r = REP[a.repEf]; if (!r) return !S.suc && !S.sup && !S.rep; return (!S.suc || r.suc === S.suc) && (!S.sup || r.sup === S.sup) && (!S.rep || a.repEf === S.rep); };
const alertas = (p = P) => evaluar(p).filter(enFiltro);

/* ---------- textos de cada alerta: qué pasó, por qué importa, qué hacer, cómo se mide ---------- */
const cliLbl = id => CLI[id] ? `${CLI[id].tipo} ${id}` : `Cliente ${id}`;
function texto(a) {
  const c = a.ctx, cl = cliLbl(a.cli);
  switch (a.regla) {
    case 'equipo_sin_abono': return {
      tit: `${c.tipo} ${c.eq} en ${cl}: ${c.meses === 1 ? '1 mes' : c.meses + ' meses'} sin abono`,
      que: `Instalado el ${fdl(c.inst)}. El abono no se facturó desde ${MES_N[+c.desde.slice(5, 7) - 1]}-${c.desde.slice(2, 4)}.`,
      por: `${fmt.arsF(a.impacto)} sin facturar (${fmt.arsF(c.abono)} por mes) y sigue sumando.`,
      hacer: 'Administración: dar de alta el abono y facturar los meses pendientes.', medir: 'El abono aparece en la facturación del mes que viene.' };
    case 'equipo_sin_consumo': return {
      tit: `${c.tipo} ${c.eq} en ${cl}: ${c.dias} días sin compras`,
      que: `Última compra con cargo el ${fdl(c.ult)}${CLI[a.cli] && CLI[a.cli].inc ? ' · el cliente fue pasado a incobrable' : ''}${CLI[a.cli] && REP[CLI[a.cli].rep] && REP[CLI[a.cli].rep].tipo !== 'Comercial' ? ' · el cliente está en una ruta que no vende' : ''}.`,
      por: `Equipo de ${fmt.arsF(a.impacto)} prestado a cambio de un consumo que no está pasando.`,
      hacer: CLI[a.cli] && CLI[a.cli].inc ? 'Comercial: retirar el equipo (el cliente ya no se atiende).' : 'Comercial: visitar al cliente y decidir reactivación o retiro del equipo.', medir: 'Una compra con cargo o el retiro registrado por el técnico.' };
    case 'solo_sin_cargo': return {
      tit: `${cl}: ${c.n} entregas seguidas sin cargo`,
      que: `Desde el ${fdl(c.desde)} recibió ${c.sc} unidades sin cargo y ninguna con cargo. Antes compraba ${fmt.arsF(c.prom)} por entrega.`,
      por: c.bon ? `Tiene una bonificación autorizada el ${fdl(c.bon[1])} («${c.bon[2]}»): queda justificada si coincide.` : `${fmt.arsF(a.impacto)} que se dejaron de facturar en la ventana.`,
      hacer: c.bon ? 'Supervisión: confirmar que la bonificación cubre estas entregas y su fecha de fin.' : `Supervisión: hablar con el cliente sobre lo que recibió y pagó; revisar las entregas del reparto ${CLI[a.cli] ? CLI[a.cli].rep : ''}.`,
      medir: 'Las próximas entregas vuelven a tener cargo.' };
    case 'incobrables': return {
      tit: `${a.clave}: ${c.casos.length} incobrables en ${P.inc_ventana} días`,
      que: `${fmt.pct(c.ratio)} de su venta pasó a incobrable (mediana de los repartos ${fmt.pct(c.med)}).${c.sigue ? ` ${c.sigue} ${c.sigue === 1 ? 'cliente siguió' : 'clientes siguieron'} comprando después.` : ''}`,
      por: `${fmt.arsF(a.impacto)} dados de baja como pérdida.`,
      hacer: 'Gerencia de cobranzas: revisar cada baja con el supervisor. Un cliente que sigue comprando no es incobrable: revertir y gestionar la deuda.',
      medir: 'Sin incobrables nuevos a clientes activos; el porcentaje vuelve cerca de la mediana.' };
    case 'cobro_sin_visita': return {
      tit: `${a.clave}: ${c.casos.length} cobros en efectivo en días sin visita`,
      que: `En los últimos ${P.csv_ventana} días. En promedio, cargados ${nf(1).format(c.dias)} días después de la última visita al cliente.`,
      por: `${fmt.arsF(a.impacto)} cobrados que estuvieron fuera de la caja hasta la carga.`,
      hacer: 'Supervisión: controlar la rendición diaria del reparto y pedir los comprobantes al cliente.', medir: 'Los cobros en efectivo se cargan el mismo día de la visita.' };
    case 'nc_fuera_patron': return {
      tit: `NC de ${fmt.arsF(a.impacto)} a ${cl}`,
      que: `${fdl(c.f)} · ${c.fac6 > 0 ? nf(1).format(a.impacto / c.fac6) + ' veces lo que factura en un mes habitual' : 'sin facturación en los 6 meses anteriores'} · motivo cargado: ${c.motivo.toLowerCase()}.`,
      por: c.rev ? `Revisión de administración: ${c.rev.toLowerCase()}.` : 'Bajó la deuda sin que entre plata y todavía no tiene revisión.',
      hacer: c.rev && /justificada/i.test(c.rev) ? 'Nada: quedó justificada.' : 'Administración: pedir el respaldo (remito de devolución o autorización comercial) y corregir si no lo hay.', medir: 'Revisión registrada con resultado.' };
    case 'cambio_ruta': return {
      tit: `${cl} pasó de ${c.ori} a ${repLbl(c.des)} con deuda`,
      que: `${fdl(c.f)} · motivo cargado: ${c.motivo.toLowerCase()}.`,
      por: `${fmt.arsF(a.impacto)} salieron de la gestión de cobranza${c.efecto ? ` y le bajaron ${nf(1).format(c.efecto)} días calle a ${c.ori} ese mes` : ''}.`,
      hacer: 'Gerencia de cobranzas: devolver la cuenta a una ruta comercial o gestionarla desde cobranzas, y revisar quién autorizó el cambio.', medir: `Días calle de ${c.ori} recalculados con la cuenta incluida.` };
  }
}

/* ---------- gráficos ---------- */
const CH = {};
function chart(id, opt, onClick) {
  const el = $(id); if (!el) return;
  if (!window.echarts) { el.innerHTML = '<p class="err">No se pudo cargar la librería de gráficos. Los números y las tablas están completos.</p>'; return; }
  CH[id]?.dispose();
  const ch = echarts.init(el, null, { renderer: 'svg' });
  ch.setOption(Object.assign({ textStyle: { fontFamily: cssv('--f'), color: cssv('--ink-2') }, animationDuration: 250,
    tooltip: { backgroundColor: cssv('--surface'), borderColor: cssv('--line'), textStyle: { color: cssv('--ink') } } }, opt));
  if (onClick) ch.on('click', onClick);
  CH[id] = ch;
}
const axisCat = (data, extra = {}) => Object.assign({ type: 'category', data, axisLine: { lineStyle: { color: cssv('--line-strong') } }, axisTick: { show: false }, axisLabel: { color: cssv('--ink-3') } }, extra);
const axisVal = (f, extra = {}) => Object.assign({ type: 'value', splitLine: { lineStyle: { color: cssv('--grid') } }, axisLabel: { color: cssv('--ink-3'), formatter: f } }, extra);
window.addEventListener('resize', () => Object.values(CH).forEach(c => c.resize()));

/* ---------- encabezado y filtros ---------- */
function initHeader() {
  $('selSuc').innerHTML = '<option value="">Todas</option>' + Object.entries(SUC).map(([k, s]) => `<option value="${k}">${esc(s)}</option>`).join('');
  $('selSuc').onchange = e => { S.suc = e.target.value; S.sup = ''; S.rep = ''; fillSup(); render(); };
  fillSup();
  $('selSup').onchange = e => { S.sup = e.target.value; S.rep = ''; render(); };
  const t = store.get('rf_theme', null);
  if (t) document.documentElement.setAttribute('data-theme', t);
  themeBtn();
  $('btnTheme').onclick = () => { const dk = isDark(); document.documentElement.setAttribute('data-theme', dk ? 'light' : 'dark'); store.set('rf_theme', dk ? 'light' : 'dark'); themeBtn(); render(); };
  $('tabList').querySelectorAll('.tab').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; location.hash = S.tab === 'reg' ? 'reg-' + S.regla : S.tab; render(); window.scrollTo({ top: 0 }); });
  leerHash();
}
function leerHash() {
  const h = location.hash.slice(1);
  if (h.startsWith('reg-') && ORDEN.includes(h.slice(4))) { S.tab = 'reg'; S.regla = h.slice(4); }
  else if (['res', 'reg', 'cli', 'param', 'inf'].includes(h)) S.tab = h;
}
const isDark = () => { const a = document.documentElement.getAttribute('data-theme'); return a ? a === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
const themeBtn = () => { $('btnTheme').textContent = isDark() ? 'Modo claro' : 'Modo oscuro'; };
function fillSup() {
  const ops = Object.entries(SUP).filter(([k, s]) => !S.suc || s.suc === S.suc);
  $('selSup').innerHTML = '<option value="">Todos</option>' + ops.map(([k, s]) => `<option value="${k}">${esc(s.nom)} · ${esc(SUC[s.suc])}</option>`).join('');
  $('selSup').value = S.sup;
}
function chips() {
  const ch = [];
  if (S.suc) ch.push(`<span class="chip">Sucursal <b>${esc(SUC[S.suc])}</b><button aria-label="Quitar sucursal" data-x="suc">×</button></span>`);
  if (S.sup) ch.push(`<span class="chip">Supervisor <b>${esc(SUP[S.sup].nom)}</b><button aria-label="Quitar supervisor" data-x="sup">×</button></span>`);
  if (S.rep) ch.push(`<span class="chip">Reparto <b>${esc(repLbl(S.rep))}</b><button aria-label="Quitar reparto" data-x="rep">×</button></span>`);
  const ed = Object.keys(PDEF).filter(k => P[k] !== PDEF[k]);
  if (ed.length) ch.push(`<span class="chip">Parámetros propios <b>${ed.length}</b><button aria-label="Volver a los parámetros acordados" data-x="param">×</button></span>`);
  return `<div class="chips">${ch.length ? 'Filtros: ' + ch.join('') + ' <button class="link" data-x="all">Limpiar</button>' : '<span>Sin filtros: toda la empresa.</span>'}</div>`;
}
function bindChips() {
  document.querySelectorAll('[data-x]').forEach(b => b.onclick = () => {
    const x = b.dataset.x;
    if (x === 'suc' || x === 'all') { S.suc = ''; S.sup = ''; S.rep = ''; $('selSuc').value = ''; fillSup(); }
    if (x === 'sup') { S.sup = ''; S.rep = ''; fillSup(); }
    if (x === 'rep') S.rep = '';
    if (x === 'param') { P = Object.assign({}, PDEF); store.set('rf3_params', {}); }
    render();
  });
}
function stamp() { $('stamp').textContent = `Corrida diaria del ${fdl(DC + 1)} a las ${DATA.meta.hora} · datos al ${fdl(DC)} · ${DATA.cli.length} clientes con algún caso posible`; }

/* ---------- piezas comunes ---------- */
const chipEst = (c, t) => `<span class="status ${c}"><i></i>${esc(t)}</span>`;
const estCls = e => ({ 'Sin revisar': 'crit', 'En revisión': 'warn', 'Justificada': 'good', 'Confirmada': 'crit' }[e]);
function tarjetaAlerta(a) {
  const t = texto(a), cls = a.estado === 'Justificada' ? 'just' : a.estado === 'En revisión' ? 'rev' : '';
  const nueva = a.fecha > DC - 7 ? '<span class="tag">Nueva</span>' : '';
  return `<article class="al ${cls}" data-id="${esc(a.id)}"><div><span class="tag">${esc(TXT[a.regla].corto)}</span>${nueva}<h4 style="display:inline">${esc(t.tit)}</h4></div>
    <div class="amt">${fmt.ars(a.impacto)}<small>en juego</small></div>
    <dl><dt>Qué pasó</dt><dd>${esc(t.que)}</dd><dt>Por qué importa</dt><dd>${esc(t.por)}</dd><dt>Qué hacer</dt><dd>${esc(t.hacer)}</dd><dt>Cómo se mide</dt><dd>${esc(t.medir)}</dd></dl>
    <div class="acts">${a.cli ? `<button class="btn" data-ficha="${a.cli}" type="button">Ver la ficha del cliente</button>` : `<button class="btn" data-casos="${esc(a.id)}" type="button">Ver los ${a.ctx.casos.length} casos</button>`}
      <label class="muted" style="font-size:12.5px">Estado <select data-rev="${esc(a.id)}" aria-label="Estado de revisión">${ESTADOS.map(e => `<option ${e === a.estado ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
      <span class="muted" style="font-size:12.5px">Se disparó el ${fdl(a.fecha)} · ${esc(RG[a.regla].resp)}</span></div></article>`;
}
function bindAlertas(root) {
  root.querySelectorAll('tr[data-al]').forEach(t => t.onclick = () => alertaDrawer(t.dataset.al));
  root.querySelectorAll('[data-ficha]').forEach(b => b.onclick = () => ficha(+b.dataset.ficha));
  root.querySelectorAll('[data-casos]').forEach(b => b.onclick = () => casosDrawer(b.dataset.casos));
  root.querySelectorAll('[data-rev]').forEach(s => s.onchange = () => {
    REV[s.dataset.rev] = s.value; store.set('rf3_rev', REV); CACHE.key = ''; toast('Estado guardado en esta computadora');
    const enDrawer = !$('drawer').hidden && $('dBody').contains(s); render(); if (enDrawer) alertaDrawer(s.dataset.rev);
  });
}

/* ================================================================ ALERTAS DEL DÍA */
function renderRes(v) {
  const A = alertas(), ab = A.filter(abierta);
  const nuevas = ab.filter(a => a.fecha > DC - 7);
  const plata = ab.reduce((s, a) => s + a.impacto, 0);
  const clientes = new Set(ab.filter(a => a.cli).map(a => a.cli));
  const porRep = {};
  for (const a of ab) if (a.repEf) (porRep[a.repEf] ??= new Set()).add(a.regla);
  const rep2 = Object.entries(porRep).filter(([r, s]) => s.size >= 3).sort((a, b) => b[1].size - a[1].size || ab.filter(x => x.repEf === b[0]).length - ab.filter(x => x.repEf === a[0]).length);
  const porRegla = ORDEN.map(r => { const x = ab.filter(a => a.regla === r); return { r, n: x.length, nuevas: x.filter(a => a.fecha > DC - 7).length, plata: x.reduce((s, a) => s + a.impacto, 0), just: A.filter(a => a.regla === r && !abierta(a)).length }; });
  const top = porRegla.slice().sort((a, b) => b.plata - a.plata)[0];
  const know = [`Hay <b>${fmt.int(ab.length)} alertas abiertas</b> con <b>${fmt.ars(plata)}</b> en juego; ${fmt.int(nuevas.length)} se dispararon en los últimos 7 días.`];
  if (top && top.plata) know.push(`La regla con más plata en juego es <b>${esc(RG[top.r].nom.toLowerCase())}</b>: ${fmt.ars(top.plata)} (${fmt.pct(top.plata / plata)} del total).`);
  if (rep2.length) know.push(`${rep2.slice(0, 3).map(([r, s]) => `<b>${esc(repLbl(r))}</b> aparece en ${s.size} reglas`).join('; ')}: mirar esos repartos completos, no alerta por alerta.`);
  const ord = ab.slice().sort((a, b) => b.impacto - a.impacto);
  v.innerHTML = chips() + `
  <p class="eyb">Lo que hay que saber</p><ul class="know">${know.map(k => `<li><span>${k}</span></li>`).join('')}</ul>
  <div class="cards" id="cardsBox">
    <button class="card" data-go="lista"><div class="lbl">Alertas abiertas</div><div class="v">${fmt.int(ab.length)}</div><div class="cl">${fmt.int(A.length - ab.length)} justificadas no cuentan</div><p class="phrase">Casos que cumplen una regla y nadie justificó todavía.</p><span class="go">Ver la lista →</span></button>
    <button class="card" data-go="lista"><div class="lbl">Plata en juego</div><div class="v">${fmt.ars(plata)}</div><div class="cl">Suma de las alertas abiertas</div><p class="phrase">Abonos, equipos, venta sin cargo, incobrables, efectivo, NC y deuda movida.</p><span class="go">Ver por regla →</span></button>
    <button class="card" data-go="nuevas"><div class="lbl">Nuevas en 7 días</div><div class="v">${fmt.int(nuevas.length)}</div><div class="cl">${fmt.ars(nuevas.reduce((s, a) => s + a.impacto, 0))} en juego</div><p class="phrase">Se dispararon desde el ${fd(DC - 6)}.</p><span class="go">Ver las nuevas →</span></button>
    <button class="card" data-go="cli"><div class="lbl">Clientes con alerta</div><div class="v">${fmt.int(clientes.size)}</div><div class="cl">Cada uno con su ficha completa</div><p class="phrase">Venta, deuda, pagos, equipos, NC, visitas y llamados en una sola vista.</p><span class="go">Ver los clientes →</span></button>
    <button class="card" data-go="mapa"><div class="lbl">Repartos en 3 o más reglas</div><div class="v">${fmt.int(rep2.length)}</div><div class="cl">${rep2.slice(0, 4).map(([r]) => `<span class="nw">${esc(repLbl(r))}</span>`).join(' · ') || 'ninguno'}</div><p class="phrase">Cuando un reparto suma reglas distintas, el problema es del reparto.</p><span class="go">Ver dónde →</span></button>
  </div>
  <div class="grid">
    <section class="panel s7" id="reglasPanel"><div class="ph"><div><h3>${top && top.plata ? `${esc(RG[top.r].nom)} es la regla con más plata en juego` : 'Alertas por regla'}</h3><p>Alertas abiertas por regla · tocá una fila para ver la regla</p></div></div>
      <div class="tw"><table><thead><tr><th>Regla</th><th>Abiertas</th><th class="hide-m">Nuevas 7 d</th><th>En juego</th><th class="l hide-m">Responsable</th></tr></thead><tbody>
      ${porRegla.map(x => `<tr class="click" data-r="${x.r}"><td class="wr">${esc(RG[x.r].nom)}${x.just ? ` <span class="muted">(+${x.just} justif.)</span>` : ''}</td><td>${fmt.int(x.n)}</td><td class="hide-m">${x.nuevas ? fmt.int(x.nuevas) : '—'}</td><td>${fmt.ars(x.plata)}</td><td class="l hide-m">${esc(RG[x.r].resp)}</td></tr>`).join('')}
      <tr class="tot"><td>Total</td><td>${fmt.int(ab.length)}</td><td class="hide-m">${fmt.int(nuevas.length)}</td><td>${fmt.ars(plata)}</td><td class="hide-m"></td></tr></tbody></table></div>
      <div class="ph" style="margin:20px 0 4px"><div><h3 style="font-size:15px">${tituloEdad(ab)}</h3><p>Alertas abiertas según cuántos días pasaron desde que se dispararon</p></div></div><div class="chart short" id="chEdad"></div></section>
    <section class="panel s5" id="mapaPanel"><div class="ph"><div><h3>${rep2.length ? `${esc(repLbl(rep2[0][0]))} suma alertas en ${rep2[0][1].size} reglas` : 'Dónde se concentran'}</h3><p>Alertas abiertas por reparto y regla · tocá una celda para filtrar</p></div></div><div class="chart tall" id="chHeat"></div></section>
  </div>
  <section class="panel" id="listaPanel"><div class="ph"><div><h3>Prioridad del día: las de más plata en juego</h3><p>Cada alerta con qué pasó, por qué importa, qué hacer y cómo se mide · el estado se guarda en esta computadora</p></div><span class="muted">${fmt.int(ord.length)} abiertas</span></div>
    <div class="alist" id="alist">${ord.slice(0, 5).map(tarjetaAlerta).join('') || '<p class="muted">No hay alertas abiertas con este filtro.</p>'}</div>
    ${ord.length > 5 ? `<div class="more"><button class="btn" id="btnTodas" type="button" aria-expanded="${S.todas}">${S.todas ? 'Ocultar las demás' : `Ver las ${fmt.int(ord.length - 5)} restantes`}</button></div>${S.todas ? tablaAlertas(ord.slice(5)) : ''}` : ''}</section>`;
  v.querySelectorAll('#cardsBox .card').forEach(b => b.onclick = () => {
    const g = b.dataset.go;
    if (g === 'cli') { S.tab = 'cli'; render(); return; }
    if (g === 'nuevas') { S.tab = 'cli'; S.q = ''; S.soloNuevas = true; render(); return; }
    $(g === 'mapa' ? 'mapaPanel' : g === 'lista' ? 'reglasPanel' : 'listaPanel').scrollIntoView({ behavior: 'smooth' });
  });
  v.querySelectorAll('tr[data-r]').forEach(t => t.onclick = () => { S.tab = 'reg'; S.regla = t.dataset.r; location.hash = 'reg-' + S.regla; render(); window.scrollTo({ top: 0 }); });
  if ($('btnTodas')) $('btnTodas').onclick = () => { S.todas = !S.todas; render(); if (S.todas) $('listaPanel').scrollIntoView(); };
  bindAlertas(v);
  heat(ab);
  edad(ab);
}
const EDAD = [[0, 7, 'Hasta 7 días'], [8, 30, '8 a 30'], [31, 60, '31 a 60'], [61, 90, '61 a 90'], [91, 1e9, 'Más de 90']];
function tituloEdad(ab) {
  if (!ab.length) return 'Sin alertas abiertas';
  const v = ab.filter(a => DC - a.fecha > 30).length;
  return `${fmt.pct(v / ab.length)} de las alertas abiertas lleva más de 30 días sin resolverse`;
}
function edad(ab) {
  const n = EDAD.map(([a, b]) => ab.filter(x => DC - x.fecha >= a && DC - x.fecha <= b).length);
  chart('chEdad', {
    grid: { left: 36, right: 10, top: 18, bottom: 26 },
    tooltip: { trigger: 'axis', valueFormatter: x => fmt.int(x) + ' alertas' },
    xAxis: axisCat(EDAD.map(e => e[2])), yAxis: axisVal(x => fmt.int(x), { minInterval: 1 }),
    series: [{ type: 'bar', data: n, barMaxWidth: 34, itemStyle: { color: cssv('--real'), borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', color: cssv('--ink-2'), formatter: p => p.value || '' } }],
  });
}
function tablaAlertas(X, conRegla = true) {
  if (!X.length) return '<p class="muted">No hay alertas con estos parámetros y filtros.</p>';
  return `<div class="tw" style="margin-top:12px"><table><thead><tr><th class="l">Estado</th>${conRegla ? '<th class="l">Regla</th>' : ''}<th class="l">Qué pasó</th><th class="l hide-m">Reparto</th><th class="hide-m">Se disparó</th><th>En juego</th></tr></thead><tbody>
    ${X.map(a => `<tr class="click" data-al="${esc(a.id)}"><td class="l">${chipEst(estCls(a.estado), a.estado)}</td>${conRegla ? `<td class="l">${esc(TXT[a.regla].corto)}</td>` : ''}<td class="l wr">${a.fecha > DC - 7 ? '<span class="tag">Nueva</span> ' : ''}${esc(texto(a).tit)}</td><td class="l hide-m">${esc(repLbl(a.repEf || ''))}</td><td class="hide-m">${fdl(a.fecha)}</td><td>${fmt.ars(a.impacto)}</td></tr>`).join('')}
    </tbody></table></div>`;
}
function alertaDrawer(id) {
  lastFocus = document.activeElement;
  const a = evaluar().find(x => x.id === id); if (!a) return;
  $('dEyebrow').textContent = `${RG[a.regla].nom} · ${RG[a.regla].resp}`;
  $('dTitle').textContent = texto(a).tit;
  $('dSub').textContent = `Se disparó el ${fdl(a.fecha)} · ${fmt.arsF(a.impacto)} en juego`;
  $('dBody').innerHTML = `<div class="alist">${tarjetaAlerta(a)}</div>`;
  $('scrim').hidden = false; $('drawer').hidden = false; $('dClose').focus();
  bindAlertas($('dBody'));
}
function heat(ab) {
  const reps = Object.keys(REP).filter(r => ab.some(a => a.repEf === r)).sort();
  const data = [];
  let mx = 1;
  reps.forEach((r, i) => ORDEN.forEach((g, j) => { const n = ab.filter(a => a.repEf === r && a.regla === g).length; if (n) { data.push([j, i, n]); mx = Math.max(mx, n); } }));
  chart('chHeat', {
    grid: { left: 92, right: 10, top: 8, bottom: 78 },
    tooltip: { formatter: p => `${esc(repLbl(reps[p.value[1]]))} · ${esc(RG[ORDEN[p.value[0]]].nom)}<br><b>${p.value[2]}</b> ${p.value[2] === 1 ? 'alerta' : 'alertas'}` },
    xAxis: axisCat(ORDEN.map(r => TXT[r].corto), { axisLabel: { color: cssv('--ink-3'), rotate: 40, interval: 0, fontSize: 11 }, splitArea: { show: false } }),
    yAxis: axisCat(reps.map(repLbl), { inverse: true, axisLabel: { color: cssv('--ink-3'), fontSize: 11, interval: 0 } }),
    visualMap: { show: false, min: 1, max: mx, inRange: { color: isDark() ? ['#1d3a5f', '#3987e5', '#a9cbf5'] : ['#d6e6fa', '#5f9ce6', '#13294b'] } },
    series: [{ type: 'heatmap', data, itemStyle: { borderColor: cssv('--surface'), borderWidth: 2, borderRadius: 3 }, label: { show: true, color: '#fff', fontSize: 11, formatter: p => p.value[2] > 1 ? p.value[2] : '' }, emphasis: { itemStyle: { borderColor: cssv('--ink'), borderWidth: 2 } } }],
  }, p => { S.rep = reps[p.value[1]]; S.regla = ORDEN[p.value[0]]; S.tab = 'reg'; location.hash = 'reg-' + S.regla; render(); window.scrollTo({ top: 0 }); });
  const el = $('chHeat'); if (el) el.style.height = Math.max(300, reps.length * 22 + 100) + 'px';
  CH.chHeat?.resize();
}

/* ================================================================ POR REGLA */
function renderReg(v) {
  const A = alertas(), r = S.regla, X = A.filter(a => a.regla === r), ab = X.filter(abierta);
  const plata = ab.reduce((s, a) => s + a.impacto, 0);
  const por = {};
  for (const a of ab) por[a.repEf || '—'] = (por[a.repEf || '—'] || 0) + a.impacto;
  const reps = Object.entries(por).sort((a, b) => b[1] - a[1]);
  const extra = cardExtra(r, ab);
  v.innerHTML = chips() + `
  <div class="rulebar" role="group" aria-label="Regla">${ORDEN.map(g => `<button type="button" data-g="${g}" aria-pressed="${g === r}">${esc(TXT[g].corto)}<b>${A.filter(a => a.regla === g && abierta(a)).length}</b></button>`).join('')}</div>
  <div class="explain"><div><b>Qué busca</b><p>${esc(TXT[r].que)}</p></div><div><b>Por qué importa</b><p>${esc(TXT[r].por)}</p></div><div><b>Responsable</b><p>${esc(RG[r].resp)} · ${esc(TXT[r].cuenta.toLowerCase())}</p></div></div>
  <div class="pgrid">${Object.entries(OPTS).filter(([k, o]) => o[3] === r).map(([k, o]) => `<label>${esc(o[1])}<select data-p="${k}" class="${P[k] !== PDEF[k] ? 'ed' : ''}">${o[0].map(x => `<option value="${x}" ${P[k] === x ? 'selected' : ''}>${esc(o[2](x))}${x === PDEF[k] ? ' (acordado)' : ''}</option>`).join('')}</select></label>`).join('')}
    <span class="muted" style="font-size:12.5px">Cambiar un corte recalcula todo el tablero y queda guardado en esta computadora.</span></div>
  <div class="cards">
    <div class="card" style="cursor:default"><div class="lbl">Alertas abiertas</div><div class="v">${fmt.int(ab.length)}</div><div class="cl">${fmt.int(X.length - ab.length)} justificadas</div></div>
    <div class="card" style="cursor:default"><div class="lbl">Plata en juego</div><div class="v">${fmt.ars(plata)}</div><div class="cl">${ab.length ? fmt.ars(plata / ab.length) + ' por alerta' : '—'}</div></div>
    <div class="card" style="cursor:default"><div class="lbl">Nuevas en 7 días</div><div class="v">${fmt.int(ab.filter(a => a.fecha > DC - 7).length)}</div><div class="cl">Se dispararon desde el ${fd(DC - 6)}</div></div>
    ${extra}
  </div>
  <div class="grid">
    <section class="panel s5"><div class="ph"><div><h3>${reps.length ? `${esc(repLbl(reps[0][0]))} concentra el ${fmt.pct(reps[0][1] / Math.max(plata, 1))} de la plata en juego` : 'Sin alertas abiertas'}</h3><p>Plata en juego por reparto · tocá una barra para filtrar</p></div></div><div class="chart" id="chRep"></div></section>
    <section class="panel s7"><div class="ph"><div><h3>${tituloSem(ab)}</h3><p>Alertas abiertas por semana en que se dispararon</p></div></div><div class="chart" id="chSem"></div></section>
  </div>
  <section class="panel" id="tablaRegla"><div class="ph"><div><h3>Las alertas, de más a menos plata en juego</h3><p>${esc(TXT[r].cuenta)} · tocá una fila para ver qué pasó, qué hacer y marcar su estado</p></div><span class="muted">${fmt.int(X.length)} en total</span></div>
    ${tablaAlertas(X.slice().sort((a, b) => b.impacto - a.impacto), false)}</section>`;
  v.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { S.regla = b.dataset.g; location.hash = 'reg-' + S.regla; render(); });
  v.querySelectorAll('select[data-p]').forEach(s => s.onchange = () => { P[s.dataset.p] = +s.value; store.set('rf3_params', P); render(); });
  bindAlertas(v);
  const top = reps.slice(0, 12).reverse();
  chart('chRep', {
    grid: { left: 92, right: 54, top: 8, bottom: 24 },
    tooltip: { trigger: 'item', formatter: p => `${esc(p.name)}<br><b>${fmt.arsF(p.value)}</b>` },
    xAxis: axisVal(v => fmt.ars(v), { axisLabel: { show: false } }), yAxis: axisCat(top.map(x => repLbl(x[0])), { axisLabel: { color: cssv('--ink-2'), interval: 0 } }),
    series: [{ type: 'bar', data: top.map(x => x[1]), barMaxWidth: 18, itemStyle: { color: cssv('--real'), borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: cssv('--ink-2'), formatter: p => fmt.ars(p.value) } }],
  }, p => { const rr = top[p.dataIndex][0]; if (REP[rr]) { S.rep = rr; render(); } });
  const el = $('chRep'); if (el) el.style.height = Math.max(200, top.length * 28 + 40) + 'px';
  CH.chRep?.resize();
  const k0 = Math.floor((DC - day(DATA.meta.lunes0)) / 7) - 15, lab = [], val = [];
  for (let k = k0; k <= k0 + 15; k++) { const d0 = day(DATA.meta.lunes0) + 7 * k; lab.push(fd(d0)); val.push(ab.filter(a => a.fecha >= d0 && a.fecha < d0 + 7).length); }
  const antes = ab.filter(a => a.fecha < day(DATA.meta.lunes0) + 7 * k0).length;
  chart('chSem', {
    grid: { left: 36, right: 10, top: 18, bottom: 26 },
    tooltip: { trigger: 'axis', formatter: p => `Semana del ${p[0].name}<br><b>${p[0].value}</b> alertas` },
    xAxis: axisCat(lab), yAxis: axisVal(x => fmt.int(x), { minInterval: 1 }),
    series: [{ type: 'bar', data: val, barMaxWidth: 22, itemStyle: { color: cssv('--real'), borderRadius: [4, 4, 0, 0] } }],
  });
  if (antes) $('chSem').insertAdjacentHTML('afterend', `<p class="note">Y ${fmt.int(antes)} ${antes === 1 ? 'se disparó' : 'se dispararon'} antes del ${fd(day(DATA.meta.lunes0) + 7 * k0)}.</p>`);
}
function tituloSem(ab) {
  if (!ab.length) return 'Sin alertas abiertas';
  const ult = ab.filter(a => a.fecha > DC - 28).length;
  return ult ? `${fmt.int(ult)} de ${fmt.int(ab.length)} se dispararon en las últimas 4 semanas` : 'Ninguna se disparó en las últimas 4 semanas';
}
function cardExtra(r, ab) {
  const c = (lbl, v, cl) => `<div class="card" style="cursor:default"><div class="lbl">${lbl}</div><div class="v">${v}</div><div class="cl">${cl}</div></div>`;
  if (r === 'equipo_sin_abono') return c('Meses sin facturar', fmt.int(ab.reduce((s, a) => s + a.ctx.meses, 0)), `${fmt.int(ab.filter(a => a.ctx.inst >= '2025-06-01').length)} equipos instalados desde junio`);
  if (r === 'equipo_sin_consumo') { const i = ab.filter(a => CLI[a.cli] && CLI[a.cli].inc).length; return c('En clientes dados de baja', fmt.int(i), 'Pasados a incobrable: hay que retirar el equipo'); }
  if (r === 'solo_sin_cargo') return c('Unidades sin cargo', fmt.int(ab.reduce((s, a) => s + a.ctx.sc, 0)), 'Entregadas en la ventana a estos clientes');
  if (r === 'incobrables') return c('A clientes que siguen comprando', fmt.int(ab.reduce((s, a) => s + a.ctx.sigue, 0)), 'Incobrables que no deberían serlo');
  if (r === 'cobro_sin_visita') return c('Cobros fuera de día', fmt.int(ab.reduce((s, a) => s + a.ctx.casos.length, 0)), 'Efectivo cargado sin visita ese día');
  if (r === 'nc_fuera_patron') return c('Sin revisión', fmt.int(ab.filter(a => !a.ctx.rev).length), 'Todavía sin resultado de administración');
  if (r === 'cambio_ruta') { const e = {}; ab.forEach(a => e[a.ctx.ori] = (e[a.ctx.ori] || 0) + a.ctx.efecto); const t = Object.entries(e).sort((a, b) => b[1] - a[1])[0]; return c('Días calle que «mejoraron»', t ? nf(1).format(t[1]) : '0', t ? `en ${t[0]} el mes del cambio` : '—'); }
  return '';
}

/* ================================================================ CLIENTES */
function renderCli(v) {
  const A = alertas(), q = S.q.trim().toLowerCase();
  const por = {};
  for (const a of A) if (a.cli) (por[a.cli] ??= []).push(a);
  for (const a of A) if (!a.cli) for (const x of a.ctx.casos) (por[x[1]] ??= []).push(a);
  let ids = Object.keys(por).map(Number);
  if (S.soloNuevas) ids = ids.filter(c => por[c].some(a => a.fecha > DC - 7 && abierta(a)));
  if (q) ids = Object.keys(DATA.ficha).map(Number).filter(c => String(c).includes(q) || (CLI[c] && (CLI[c].rep.toLowerCase().includes(q) || CLI[c].tipo.toLowerCase().includes(q))));
  ids = ids.filter(c => { const r = REP[CLI[c]?.rep]; return !r || ((!S.suc || r.suc === S.suc) && (!S.sup || r.sup === S.sup) && (!S.rep || CLI[c].rep === S.rep)); });
  const monto = c => (por[c] || []).filter(a => a.cli === c && abierta(a)).reduce((s, a) => s + a.impacto, 0);
  ids.sort((a, b) => monto(b) - monto(a) || (por[b]?.length || 0) - (por[a]?.length || 0));
  v.innerHTML = chips() + `
  <p class="eyb">La ficha de cada cliente</p>
  <ul class="know"><li><span>Todo lo del cliente en una sola vista: venta con y sin cargo, pagos por medio y canal, notas de crédito e incobrables, visitas, equipos, cambios de ruta, llamados y las alertas en las que aparece.</span></li></ul>
  <div class="toolbar"><input type="search" id="q" placeholder="Buscar cliente, reparto o tipo" value="${esc(S.q)}" aria-label="Buscar cliente">
    ${S.soloNuevas ? '<span class="chip"><b>Solo con alertas nuevas</b><button aria-label="Quitar" id="xNuevas">×</button></span>' : ''}
    <span class="muted">${fmt.int(ids.length)} clientes</span></div>
  <div class="tw"><table><thead><tr><th>Cliente</th><th class="l">Reparto</th><th class="l">Alertas</th><th>En juego</th><th class="l hide-m">Condición</th></tr></thead><tbody>
  ${ids.slice(0, 150).map(c => { const cl = CLI[c]; const rs = [...new Set((por[c] || []).map(a => a.regla))]; return `<tr class="click" data-c="${c}"><td>${c} · ${esc(cl ? cl.tipo : '')}${cl && cl.inc ? ' <span class="tag">Incobrable</span>' : ''}</td><td class="l">${esc(cl ? repLbl(cl.rep) : '')}</td><td class="l">${rs.map(r => `<span class="tag">${esc(TXT[r].corto)}</span>`).join(' ') || '<span class="muted">sin alertas con estos cortes</span>'}</td><td>${monto(c) ? fmt.ars(monto(c)) : '—'}</td><td class="l hide-m">${esc(cl ? cl.cond : '')}</td></tr>`; }).join('') || '<tr><td colspan="5" class="l muted">No hay clientes con este filtro.</td></tr>'}
  </tbody></table></div>${ids.length > 150 ? '<p class="note">Se muestran los primeros 150: usá la búsqueda para encontrar otro.</p>' : ''}`;
  $('q').oninput = e => { S.q = e.target.value; const pos = e.target.selectionStart; renderCli(v); bindChips(); const i = $('q'); i.focus(); i.setSelectionRange(pos, pos); };
  if ($('xNuevas')) $('xNuevas').onclick = () => { S.soloNuevas = false; render(); };
  v.querySelectorAll('tr[data-c]').forEach(t => t.onclick = () => ficha(+t.dataset.c));
}

/* ---------- ficha 360 ---------- */
let lastFocus = null;
const SEMS = Array.from({ length: DATA.meta.semanas }, (_, k) => day(DATA.meta.lunes0) + 7 * k);
function ficha(c) {
  lastFocus = document.activeElement;
  const cl = CLI[c], f = DATA.ficha[c];
  if (!f) return;
  const rep = REP[cl.rep];
  $('dEyebrow').textContent = `${cl.tipo} · ${repLbl(cl.rep)}${rep && rep.sup ? ' · ' + SUP[rep.sup].nom : ''} · ${rep ? SUC[rep.suc] : ''}`;
  $('dTitle').textContent = `Cliente ${c}`;
  $('dSub').textContent = `${cl.cond} · paga habitualmente con ${cl.medio.toLowerCase()}${cl.inc ? ' · pasado a incobrable' : ''}`;
  const A = evaluar().filter(a => a.cli === c || (!a.cli && a.ctx.casos.some(x => x[1] === c)));
  const tb = (head, rows, empty) => rows.length ? `<div class="tw"><table><thead><tr>${head.map((h, i) => `<th class="${i ? 'l' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : `<p class="muted" style="margin:0">${empty}</p>`;
  $('dBody').innerHTML = `
    <div class="kv"><div><span>Saldo hoy</span><b>${fmt.arsF(f.saldo)}</b></div><div><span>Última compra con cargo</span><b>${f.ult[0] ? fdl(f.ult[0]) : 'nunca'}</b></div>
      <div><span>Último pago</span><b>${f.ult[1] ? fdl(f.ult[1]) : 'nunca'}</b></div><div><span>Última visita efectiva</span><b>${f.ult[2] ? fdl(f.ult[2]) : 'nunca'}</b></div></div>
    <div><h4>Alertas en las que aparece</h4>${A.length ? A.map(a => { const t = texto(a); return `<p style="margin:0 0 6px">${chipEst(estCls(a.estado), a.estado)} <b>${esc(RG[a.regla].nom)}</b> · ${esc(t.tit)} · ${fmt.ars(a.impacto)}</p>`; }).join('') : '<p class="muted" style="margin:0">Ninguna con los parámetros vigentes.</p>'}</div>
    <div><h4>Venta, pagos y ajustes por semana, 2025</h4><div class="chart short" id="chF1"></div></div>
    <div><h4>Visitas y entregas sin cargo por semana</h4><div class="chart short" id="chF2"></div></div>
    <div><h4>Equipos en comodato</h4>${tb(['Equipo', 'Tipo', 'Modalidad', 'Instalado', 'Retirado', 'Abonos 2025'], f.eq.map(e => `<tr><td>${e[0]}</td><td class="l">${esc(e[1])}</td><td class="l">${esc(e[2])}${e[8] ? ' · ' + fmt.arsF(e[8]) : ''}</td><td class="l">${fdl(e[3])}</td><td class="l">${e[4] ? fdl(e[4]) : '—'}</td><td class="l">${e[2] === 'Abono mensual' ? `${e[5]}${e[6] ? ' · último ' + fdl(e[6]) : ''}` : '—'}</td></tr>`), 'No tiene equipos.')}</div>
    <div><h4>Cambios de ruta</h4>${tb(['Fecha', 'De', 'A', 'Motivo'], f.cr.map(x => `<tr><td>${fdl(x[0])}</td><td class="l">${esc(repLbl(x[1]))}</td><td class="l">${esc(repLbl(x[2]))}</td><td class="l">${esc(x[3])}</td></tr>`), 'Siempre estuvo en la misma ruta.')}</div>
    <div><h4>Últimos movimientos</h4>${tb(['Fecha', 'Tipo', 'Importe', 'Detalle'], f.mv.map(m => `<tr><td>${fdl(m[0])}</td><td class="l">${esc(m[1])}</td><td class="l">${m[2] ? fmt.arsF(m[2]) : '—'}</td><td class="l">${esc(m[3])}</td></tr>`), 'Sin movimientos.')}</div>
    <div><h4>Gestiones</h4>${tb(['Fecha', 'Área', 'Qué', 'Resultado'], f.g.map(g => `<tr><td>${fdl(g[0])}</td><td class="l">${esc(g[1])}</td><td class="l">${esc(g[2])}</td><td class="l">${esc(g[3])}</td></tr>`), 'Sin llamados ni revisiones.')}</div>`;
  $('scrim').hidden = false; $('drawer').hidden = false; $('dClose').focus();
  const lbl = SEMS.map(d => fd(d));
  chart('chF1', {
    grid: { left: 54, right: 10, top: 28, bottom: 26 },
    legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: cssv('--ink-2') } },
    tooltip: { trigger: 'axis', valueFormatter: x => fmt.arsF(x) },
    xAxis: axisCat(lbl), yAxis: axisVal(x => fmt.ars(x)),
    series: [['Venta con cargo', f.sv, '--s1'], ['Pagos', f.sp, '--s2'], ['NC e incobrables', f.snc, '--s4']].map(([n, d, col]) => ({ name: n, type: 'bar', data: d, barMaxWidth: 6, barGap: '20%', itemStyle: { color: cssv(col), borderRadius: [2, 2, 0, 0] } })),
  });
  chart('chF2', {
    grid: { left: 40, right: 10, top: 28, bottom: 26 },
    legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: cssv('--ink-2') } },
    tooltip: { trigger: 'axis' },
    xAxis: axisCat(lbl), yAxis: axisVal(x => nf(0).format(x), { minInterval: 1 }),
    series: [['Visitas programadas', f.svp, '--neutral'], ['Visitas efectivas', f.svi, '--s1'], ['Unidades sin cargo', f.ssc, '--s5']].map(([n, d, col]) => ({ name: n, type: 'bar', data: d, barMaxWidth: 6, barGap: '20%', itemStyle: { color: cssv(col), borderRadius: [2, 2, 0, 0] } })),
  });
}
function casosDrawer(id) {
  lastFocus = document.activeElement;
  const a = evaluar().find(x => x.id === id); if (!a) return;
  const inc = a.regla === 'incobrables';
  $('dEyebrow').textContent = `${RG[a.regla].nom} · ${RG[a.regla].resp}`;
  $('dTitle').textContent = `${repLbl(a.clave)} · ${a.ctx.casos.length} casos`;
  $('dSub').textContent = `${REP[a.clave] && REP[a.clave].sup ? SUP[REP[a.clave].sup].nom + ' · ' : ''}${fmt.arsF(a.impacto)} en juego`;
  const t = texto(a);
  $('dBody').innerHTML = `<div><h4>Qué pasó</h4><p style="margin:0">${esc(t.que)}</p><p class="note">${esc(t.hacer)}</p></div>
    <div><h4>Caso por caso</h4><div class="tw"><table><thead><tr><th>Fecha</th><th class="l">Cliente</th><th>Importe</th><th class="l">${inc ? 'Motivo' : 'Última visita'}</th><th class="l">${inc ? 'Después' : ''}</th></tr></thead><tbody>
    ${a.ctx.casos.slice().reverse().map(x => `<tr class="click" data-c="${x[1]}"><td>${fdl(x[0])}</td><td class="l">${esc(cliLbl(x[1]))}</td><td>${fmt.arsF(x[3])}</td><td class="l">${inc ? esc(x[4]) : x[4] < 0 ? 'nunca' : `hace ${x[4]} días`}</td><td class="l">${inc ? (x[5] ? '<span class="status crit"><i></i>Siguió comprando</span>' : 'Dejó de comprar') : ''}</td></tr>`).join('')}</tbody></table></div><p class="note">Tocá un caso para abrir la ficha del cliente.</p></div>`;
  $('scrim').hidden = false; $('drawer').hidden = false; $('dClose').focus();
  $('dBody').querySelectorAll('tr[data-c]').forEach(r => r.onclick = () => ficha(+r.dataset.c));
}
function cerrar() { $('scrim').hidden = true; $('drawer').hidden = true; ['chF1', 'chF2'].forEach(k => { CH[k]?.dispose(); delete CH[k]; }); lastFocus?.focus?.(); }

/* ================================================================ PARÁMETROS */
function renderParam(v) {
  const ed = Object.keys(PDEF).filter(k => P[k] !== PDEF[k]);
  const a = evaluar(P).filter(enFiltro), b = evaluar(PDEF).filter(enFiltro);
  evaluar(P);
  v.innerHTML = chips() + `
  <p class="eyb">Calibrar las reglas</p>
  <ul class="know"><li><span>Una regla demasiado estricta no encuentra nada; una demasiado amplia llena la lista de falsos positivos y nadie la mira. Probá cortes acá: se guardan solo en esta computadora. Cuando un corte queda acordado, se fija en <b>alertas.py</b> y en los SQL.</span></li></ul>
  <div class="params">${Object.entries(OPTS).map(([k, o]) => `<label><b>${esc(RG[o[3]].nom)} · ${esc(o[1].toLowerCase())}</b><select data-p="${k}" class="${P[k] !== PDEF[k] ? 'ed' : ''}">${o[0].map(x => `<option value="${x}" ${P[k] === x ? 'selected' : ''}>${esc(o[2](x))}</option>`).join('')}</select><small>Acordado: ${esc(o[2](PDEF[k]))}.</small></label>`).join('')}</div>
  <p style="margin-top:16px"><button class="btn" id="btnDef" type="button">Volver a los acordados</button></p>
  <section class="panel" style="margin-top:18px"><div class="ph"><div><h3>${ed.length ? `Con tus cortes hay ${fmt.int(a.length)} alertas (${a.length - b.length >= 0 ? '+' : MINUS}${fmt.int(Math.abs(a.length - b.length))} contra los acordados)` : 'Estás con los cortes acordados'}</h3><p>Alertas por regla con cada juego de parámetros</p></div></div>
  <div class="tw"><table><thead><tr><th>Regla</th><th>Acordados</th><th>Tus cortes</th><th>En juego con tus cortes</th></tr></thead><tbody>
  ${ORDEN.map(r => `<tr><td>${esc(RG[r].nom)}</td><td>${fmt.int(b.filter(x => x.regla === r).length)}</td><td>${fmt.int(a.filter(x => x.regla === r).length)}</td><td>${fmt.ars(a.filter(x => x.regla === r).reduce((s, x) => s + x.impacto, 0))}</td></tr>`).join('')}
  </tbody></table></div></section>`;
  v.querySelectorAll('select[data-p]').forEach(s => s.onchange = () => { P[s.dataset.p] = +s.value; store.set('rf3_params', P); render(); });
  $('btnDef').onclick = () => { P = Object.assign({}, PDEF); store.set('rf3_params', {}); render(); };
}

/* ================================================================ INFORMES */
function renderInf(v) {
  v.innerHTML = `<p class="eyb">Informes y descargas</p>
  <div class="rep">
    <div><h5>Informe semanal de control para gerencia</h5><p>Las alertas abiertas por regla y por reparto, las 10 de más plata en juego y los repartos que suman reglas. Para la reunión de gestión.</p><a class="btn primary" href="../04_informes/informe-control-gerencia.html">Abrir el informe</a></div>
    <div><h5>Alertas en Excel (CSV)</h5><p>Todas las alertas con los parámetros y filtros que tengas puestos, con qué pasó, qué hacer y su estado.</p><button class="btn" id="btnCsv" type="button">Bajar a Excel (CSV)</button></div>
    <div><h5>Base completa</h5><p>Clientes, equipos, abonos, ventas, pagos, visitas, cambios de ruta y las alertas del día con su impacto calculado por fórmula.</p><a class="btn" href="../01_datos/Base-alertas.xlsx">Bajar la base</a></div>
    <div><h5>Reglas, SQL y validación</h5><p>Cómo está definida cada regla, las consultas de SQL Server y cuántos casos sembrados encuentra cada una.</p><a class="btn" href="https://github.com/MatiasGarnica/portfolio-control-gestion/tree/main/caso-03-alertas">Ver en GitHub</a></div>
  </div>`;
  $('btnCsv').onclick = csv;
}
function csv() {
  const A = alertas();
  const head = ['Regla', 'Responsable', 'Clave', 'Cliente', 'Reparto', 'Se disparó', 'En juego', 'Estado', 'Qué pasó', 'Por qué importa', 'Qué hacer'];
  const rows = [head, ...A.map(a => { const t = texto(a); return [RG[a.regla].nom, RG[a.regla].resp, a.clave, a.cli || '', a.repEf || '', fdl(a.fecha), Math.round(a.impacto), a.estado, t.tit + '. ' + t.que, t.por, t.hacer]; })];
  const txt = '﻿' + rows.map(l => l.map(x => { const s = String(x); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
  const el = document.createElement('a');
  el.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  el.download = `alertas_${DATA.meta.corte}.csv`;
  document.body.appendChild(el); el.click(); el.remove();
  toast(`Se descargaron ${fmt.int(A.length)} alertas`);
}

/* ================================================================ recorrido */
const TOUR = [
  ['#stamp', 'Las alertas se calculan todos los días a las 6:00 con los datos del día anterior. No hace falta pedirlas: llegan.'],
  ['#selSuc', 'Filtrá por sucursal o supervisor: todas las pestañas se recalculan.'],
  ['#cardsBox', 'Lo primero: cuántas alertas hay abiertas, cuánta plata está en juego y cuántas son nuevas. Cada tarjeta abre su detalle.'],
  ['#reglasPanel', 'Las siete reglas, con la plata en juego y quién tiene que actuar. Tocá una para verla completa y calibrar sus cortes.'],
  ['#mapaPanel', 'Dónde se concentran: un reparto que aparece en varias reglas es un problema del reparto, no de un cliente.'],
  ['#listaPanel', 'Cada alerta dice qué pasó, por qué importa, qué hacer y cómo se mide. Marcá su estado a medida que la revisás.'],
  ['[data-tab="cli"]', 'La ficha de cada cliente: venta, pagos, equipos, NC, visitas, cambios de ruta y llamados en una sola vista.'],
];
let tourI = 0;
function tour(i) {
  if (S.tab !== 'res') { S.tab = 'res'; render(); }
  tourI = Math.max(0, Math.min(TOUR.length - 1, i));
  const [sel, txt] = TOUR[tourI], el = document.querySelector(sel);
  if (!el) return endTour();
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect(), sx = window.scrollX, sy = window.scrollY;
  $('tourLayer').hidden = false;
  Object.assign($('tourSpot').style, { left: r.left + sx - 6 + 'px', top: r.top + sy - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
  $('tourN').textContent = `Paso ${tourI + 1} de ${TOUR.length}`; $('tourTxt').textContent = txt;
  const tip = $('tourTip'), below = r.bottom + 190 < window.innerHeight;
  tip.style.left = Math.max(12, Math.min(r.left + sx, sx + window.innerWidth - tip.offsetWidth - 12)) + 'px';
  tip.style.top = (below ? r.bottom + sy + 14 : Math.max(sy + 12, r.top + sy - tip.offsetHeight - 14)) + 'px';
  $('tourPrev').disabled = tourI === 0; $('tourNext').textContent = tourI === TOUR.length - 1 ? 'Terminar' : 'Siguiente';
  $('tourNext').focus();
}
const endTour = () => { $('tourLayer').hidden = true; $('btnTour').focus(); };

/* ================================================================ render */
function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }
function render() {
  stamp();
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)));
  Object.keys(CH).forEach(k => { if (!['chF1', 'chF2'].includes(k)) { CH[k].dispose(); delete CH[k]; } });
  if (S.tab !== 'cli') S.soloNuevas = false;
  ({ res: renderRes, reg: renderReg, cli: renderCli, param: renderParam, inf: renderInf })[S.tab]($('view'));
  bindChips();
}
initHeader();
$('dClose').onclick = cerrar; $('scrim').onclick = cerrar;
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('drawer').hidden) cerrar(); else if (!$('tourLayer').hidden) endTour(); } });
$('btnTour').onclick = () => tour(0);
$('tourNext').onclick = () => tourI === TOUR.length - 1 ? endTour() : tour(tourI + 1);
$('tourPrev').onclick = () => tour(tourI - 1);
$('tourEnd').onclick = endTour;
window.addEventListener('hashchange', () => { leerHash(); render(); });
render();
