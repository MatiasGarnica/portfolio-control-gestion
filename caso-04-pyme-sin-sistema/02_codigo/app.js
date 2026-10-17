/* Caso 04 · Caja y clientes · Pastas Don Aldo (datos ficticios)
   Las cuentas se hacen en el navegador con los mismos criterios que indicadores.py y las vistas de Supabase (02_vistas.sql). */
'use strict';
const DATA = JSON.parse(document.getElementById('data').textContent);
const $ = id => document.getElementById(id);
const M = DATA.meta, CORTE = M.corte, FORM = M.form_desde, TOL = M.tol;
const COM = M.comision;
const LOCALES = ['Centro', 'Jardín'];
const MEDIOS = [['efe', 'Efectivo'], ['deb', 'Débito'], ['cre', 'Crédito'], ['bil', 'Billetera virtual'], ['tra', 'Transferencia']];
const MES_N = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIA_N = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const OBJ_CUADRA = 0.8;                       // 8 de cada 10 cierres tienen que cuadrar
const VENTANA = 42, MENOS = 0.7, PAGA = 0.7;  // mismas constantes que indicadores.py

/* ---------- formato es-AR ---------- */
const _nf = {};
const nf = d => (_nf[d] ??= new Intl.NumberFormat('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const CMP = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });
const MINUS = '−';
const fmt = {
  int: v => nf(0).format(v),
  ars: v => (v < 0 ? MINUS : '') + '$ ' + (Math.abs(v) >= 1e4 ? CMP.format(Math.abs(v)) : nf(0).format(Math.abs(Math.round(v)))),
  arsF: v => (v < -0.5 ? MINUS : '') + '$ ' + nf(0).format(Math.abs(Math.round(v))),
  sgn: v => (v > 0.5 ? '+' : v < -0.5 ? MINUS : '') + '$ ' + nf(0).format(Math.abs(Math.round(v))),
  pct: (r, signed = false) => { const x = Math.round(r * 1000) / 10; if (x === 0) return '0%'; const s = nf(Math.abs(x) >= 100 ? 0 : 1).format(Math.abs(x)) + '%'; return signed ? (x > 0 ? '+' : MINUS) + s : (x < 0 ? MINUS : '') + s; },
  pp: d => { const x = Math.round(d * 1000) / 10; return x === 0 ? '0 pp' : (x > 0 ? '+' : MINUS) + nf(1).format(Math.abs(x)) + ' pp'; },
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fd = s => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const fdl = s => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const mesLbl = k => MES_N[+k.slice(5, 7) - 1] + '-' + k.slice(2, 4);
const mesLargo = k => ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][+k.slice(5, 7) - 1];
const DN = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;   // número de día
const SD = n => new Date(n * 864e5).toISOString().slice(0, 10);
const dow = s => new Date(DN(s) * 864e5).getUTCDay();                                     // 0 domingo · 1 lunes
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

/* ---------- datos ---------- */
const CI = DATA.cierres.map(r => {
  const [fecha, local, resp, efe, deb, cre, bil, tra, tk, gasto, conc, retiro, fondo, cont, fuente, inc, hora] = r;
  const venta = (efe || 0) + deb + cre + bil + tra;
  const esp = fondo != null && efe != null ? fondo + efe - gasto - retiro : null;
  const dif = cont != null && esp != null ? cont - esp : null;
  const est = cont == null ? null : Math.abs(dif) <= TOL ? 'Cuadra' : dif < 0 ? 'Faltante' : 'Sobrante';
  return { fecha, mes: fecha.slice(0, 7), local, resp, efe, deb, cre, bil, tra, tk, gasto, conc, retiro, fondo, cont, fuente, inc, hora, venta, esp, dif, est };
});
const CIX = new Map(CI.map(c => [c.fecha + '|' + c.local, c]));
const MESES = [...new Set(CI.map(c => c.mes))].sort();
const CLI = new Map(DATA.clientes.map(([id, nombre, cond]) => [id, { id, nombre, cond }]));
const VEN = DATA.ventas.map(([f, id, imp, cond, fu], k) => ({ f, id, imp, cond, fu, k }));
const COB = DATA.cobros.map(([f, id, imp, medio, fu]) => ({ f, id, imp, medio, fu }));

/* ---------- motor (mismo criterio que indicadores.py) ---------- */
function faltantes() {
  const out = [];
  for (let n = DN(FORM); n <= DN(CORTE); n++) {
    const s = SD(n);
    if (dow(s) === 1) continue;                                      // los lunes no abre
    for (const l of LOCALES) if (!CIX.has(s + '|' + l)) out.push({ fecha: s, local: l, mes: s.slice(0, 7) });
  }
  return out;
}
const FALTAN = faltantes();
function responsables(list = CI) {
  const g = new Map();
  for (const c of list) {
    if (c.fuente !== 'Formulario') continue;
    const k = c.resp + '|' + c.local;
    const o = g.get(k) || { resp: c.resp, local: c.local, cierres: 0, cuadran: 0, faltantes: 0, faltante_total: 0, sobrante_total: 0, dias: [] };
    o.cierres++; if (c.est === 'Cuadra') o.cuadran++; if (c.est === 'Faltante') o.faltantes++;
    if (c.dif < -TOL) o.faltante_total += c.dif; if (c.dif > TOL) o.sobrante_total += c.dif;
    o.dias.push(dow(c.fecha));
    g.set(k, o);
  }
  return [...g.values()];
}
function saldos() {
  const d90 = DN(CORTE) - 90, out = new Map();
  const ids = [...new Set(VEN.filter(v => v.cond === 'Cuenta corriente').map(v => v.id))];
  for (const id of ids) {
    const cc = VEN.filter(v => v.id === id && v.cond === 'Cuenta corriente').sort((a, b) => a.f < b.f ? -1 : a.f > b.f ? 1 : a.k - b.k);
    const pc = COB.filter(p => p.id === id);
    const cob = pc.reduce((a, p) => a + p.imp, 0);
    let acum = 0, desde = null;
    for (const v of cc) { acum += v.imp; if (desde == null && acum > cob) desde = v.f; }
    const vendido_90 = cc.filter(v => DN(v.f) > d90).reduce((a, v) => a + v.imp, 0);
    const cobrado_90 = pc.filter(p => DN(p.f) > d90).reduce((a, p) => a + p.imp, 0);
    out.set(id, { id, saldo: cc.reduce((a, v) => a + v.imp, 0) - cob, desde, vendido_90, cobrado_90, paga_menos: vendido_90 > 0 && cobrado_90 < PAGA * vendido_90 });
  }
  return out;
}
function estadoClientes() {
  const C = DN(CORTE), out = new Map();
  for (const c of CLI.values()) {
    const f = [...new Set(VEN.filter(v => v.id === c.id).map(v => v.f))].sort();
    if (!f.length) continue;
    const inter = [];
    for (let i = 1; i < f.length; i++) if (DN(f[i]) > C - 180) inter.push(DN(f[i]) - DN(f[i - 1]));
    const r = inter.length >= 2 ? median(inter) : null;
    const ult = f[f.length - 1], pri = f[0], dias = C - DN(ult), ri = r ?? 7;
    const n6 = f.filter(x => DN(x) > C - VENTANA && DN(x) <= C).length;
    const est = DN(pri) > C - 90 ? 'Nuevo' : dias > Math.max(4 * ri, 30) ? 'Dejó de comprar' : dias > Math.max(2 * ri, 10) ? 'En riesgo'
      : r != null && n6 < MENOS * (VENTANA / ri) ? 'Compra menos seguido' : 'Activo';
    const v180 = VEN.filter(v => v.id === c.id && DN(v.f) > C - 180).reduce((a, v) => a + v.imp, 0);
    out.set(c.id, { id: c.id, ult, pri, intervalo: r, dias, n6, esperadas: VENTANA / ri, est, mensual: v180 / 6 });
  }
  return out;
}
const SAL = saldos(), EST = estadoClientes();

/* ---------- agregados con filtros ---------- */
const S = { tab: 'caja', mes: MESES.includes('2025-09') ? '2025-09' : MESES[MESES.length - 1], loc: '', sortC: 'fecha', dirC: -1, sortM: 'saldo', dirM: -1 };
const enLoc = c => !S.loc || c.local === S.loc;
function agg(mes) {
  const L = CI.filter(c => c.mes === mes && enLoc(c));
  const o = { n: L.length, venta: 0, efe: 0, deb: 0, cre: 0, bil: 0, tra: 0, tk: 0, ventaTk: 0, arq: 0, cuadra: 0, falt: 0, faltN: 0, sobr: 0, costo: 0, gasto: 0, retiro: 0, maxFalt: 0 };
  for (const c of L) {
    o.venta += c.venta; o.efe += c.efe || 0; o.deb += c.deb; o.cre += c.cre; o.bil += c.bil; o.tra += c.tra; o.gasto += c.gasto; o.retiro += c.retiro;
    if (c.tk != null) { o.tk += c.tk; o.ventaTk += c.venta; }
    if (c.est) { o.arq++; if (c.est === 'Cuadra') o.cuadra++; }
    if (c.dif != null && c.dif < -TOL) { o.falt += -c.dif; o.faltN++; o.maxFalt = Math.max(o.maxFalt, -c.dif); }
    if (c.dif != null && c.dif > TOL) o.sobr += c.dif;
  }
  o.costo = Math.round(o.deb * COM.debito + o.cre * COM.credito + o.bil * COM.billetera);
  o.ticket = o.tk ? o.ventaTk / o.tk : null;
  o.pcuadra = o.arq ? o.cuadra / o.arq : null;
  o.pefe = o.venta ? o.efe / o.venta : 0;
  o.sinCargar = FALTAN.filter(f => f.mes === mes && (!S.loc || f.local === S.loc)).length;
  o.dias = new Set(L.map(c => c.fecha)).size;
  return o;
}
const prevMes = m => MESES[MESES.indexOf(m) - 1];

/* ---------- semáforo y pequeños componentes ---------- */
function estado(valor, meta, menosEsMejor = false) {
  const r = menosEsMejor ? meta / Math.max(valor, 1e-9) : valor / meta;
  return r >= 1 ? ['good', 'En línea'] : r >= 0.9 ? ['warn', 'Atención'] : ['crit', 'Desvío'];
}
const chip = (c, t) => `<span class="status ${c}"><i></i>${esc(t)}</span>`;
const EST_CLI = { 'Activo': ['good', 'Activo'], 'Nuevo': ['new', 'Nuevo'], 'Compra menos seguido': ['warn', 'Compra menos seguido'], 'En riesgo': ['warn', 'En riesgo'], 'Dejó de comprar': ['crit', 'Dejó de comprar'] };
const EST_CAJA = { 'Cuadra': ['good', 'Cuadra'], 'Faltante': ['crit', 'Faltante'], 'Sobrante': ['warn', 'Sobrante'] };
const varTxt = (d, menosEsMejor, f) => {
  if (d === null || !isFinite(d)) return '<span class="flat">s/d</span>';
  const cls = Math.abs(d) < 1e-9 ? 'flat' : (menosEsMejor ? d < 0 : d > 0) ? 'up' : 'dn';
  return `<b class="${cls}">${d > 0 ? '▲' : d < 0 ? '▼' : ''} ${f(d)}</b>`;
};
const rel = (a, b) => b ? (a - b) / b : null;

/* ---------- gráficos ---------- */
const CH = {};
function chart(id, opt) {
  const el = $(id); if (!el) return;
  if (!window.echarts) { el.innerHTML = '<p class="err">No se pudo cargar la librería de gráficos. Los números y las tablas están completos.</p>'; return; }
  CH[id]?.dispose();
  const ch = echarts.init(el, null, { renderer: 'svg' });
  ch.setOption(Object.assign({ textStyle: { fontFamily: 'Work Sans, sans-serif', color: cssv('--ink-2') }, animationDuration: 250,
    tooltip: { backgroundColor: cssv('--surface'), borderColor: cssv('--line'), textStyle: { color: cssv('--ink') }, confine: true } }, opt));
  CH[id] = ch;
}
const axC = (data, x = {}) => Object.assign({ type: 'category', data, axisLine: { lineStyle: { color: cssv('--line-strong') } }, axisTick: { show: false }, axisLabel: { color: cssv('--ink-3') } }, x);
const axV = (f, x = {}) => Object.assign({ type: 'value', splitLine: { lineStyle: { color: cssv('--grid') } }, axisLabel: { color: cssv('--ink-3'), formatter: f } }, x);
const leg = () => ({ top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: cssv('--ink-2') } });
const ring = () => ({ borderColor: cssv('--surface'), borderWidth: 1 });
window.addEventListener('resize', () => Object.values(CH).forEach(c => c.resize()));

/* ---------- encabezado ---------- */
function initHeader() {
  $('selMes').innerHTML = MESES.map(m => `<option value="${m}">${mesLbl(m)}${m === CORTE.slice(0, 7) ? ' (al ' + fd(CORTE) + ')' : ''}</option>`).join('');
  $('selMes').value = S.mes;
  $('selMes').onchange = e => { S.mes = e.target.value; render(); };
  $('selLoc').onchange = e => { S.loc = e.target.value; render(); };
  const t = store.get('pda_theme', null); if (t) document.documentElement.setAttribute('data-theme', t);
  themeBtn();
  $('btnTheme').onclick = () => { const d = isDark(); document.documentElement.setAttribute('data-theme', d ? 'light' : 'dark'); store.set('pda_theme', d ? 'light' : 'dark'); themeBtn(); render(); };
  $('tabList').querySelectorAll('.tab').forEach(b => b.onclick = () => go(b.dataset.tab));
  const h = location.hash.slice(1); if (TABS[h]) S.tab = h;
  const ult = CI.filter(c => c.fecha === CORTE).map(c => c.hora).filter(Boolean).sort().pop();
  $('stamp').textContent = `Datos al ${DIA_N[dow(CORTE)]} ${fdl(CORTE)}${ult ? ' · último cierre cargado a las ' + ult : ''}`;
}
const isDark = () => { const a = document.documentElement.getAttribute('data-theme'); return a ? a === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
const themeBtn = () => { $('btnTheme').textContent = isDark() ? 'Modo claro' : 'Modo oscuro'; };
function go(tab, anchor) { S.tab = tab; history.replaceState(null, '', '#' + tab); render(); if (anchor) $(anchor)?.scrollIntoView({ behavior: 'smooth' }); else window.scrollTo({ top: 0 }); }
function chips() {
  const ch = [];
  if (S.loc) ch.push(`<span class="chip">Local <b>${esc(S.loc)}</b><button aria-label="Ver los dos locales" data-x="loc">×</button></span>`);
  ch.push(`<span class="chip">Mes <b>${mesLbl(S.mes)}${S.mes === CORTE.slice(0, 7) ? ' (al ' + fd(CORTE) + ')' : ''}</b></span>`);
  return `<div class="chips">${ch.join('')}${S.loc ? ' <button class="link" data-x="loc">Limpiar</button>' : ''}</div>`;
}
function bindChips() { document.querySelectorAll('[data-x="loc"]').forEach(b => b.onclick = () => { S.loc = ''; $('selLoc').value = ''; render(); }); }

/* ================================================================ CAJA */
function renderCaja(v) {
  const a = agg(S.mes), pm = prevMes(S.mes), b = pm ? agg(pm) : null;
  const parcial = S.mes === CORTE.slice(0, 7);
  const ult = LOCALES.filter(l => !S.loc || l === S.loc).map(l => CI.filter(c => c.local === l).pop());
  const resp = responsables().sort((x, y) => x.faltante_total - y.faltante_total);
  const faltTot = resp.reduce((s, r) => s + r.faltante_total, 0);
  const peor = resp[0];
  const know = [];
  const hoyV = ult.reduce((s, c) => s + c.venta, 0);
  know.push(`El ${DIA_N[dow(ult[0].fecha)]} ${fd(ult[0].fecha)} se vendieron <b>${fmt.arsF(hoyV)}</b>${ult.length > 1 ? ' entre los dos locales' : ' en ' + esc(ult[0].local)}. ` +
    ult.map(c => `${esc(c.local)}: ${c.est === 'Cuadra' ? 'la caja cuadró' : c.est === 'Faltante' ? `<b>faltaron ${fmt.arsF(-c.dif)}</b>` : `sobraron ${fmt.arsF(c.dif)}`}`).join(' · ') + '.');
  if (a.arq) know.push(`En ${mesLargo(S.mes)} cuadraron <b>${fmt.int(a.cuadra)} de ${fmt.int(a.arq)} cierres</b> (${fmt.pct(a.pcuadra)}) y faltaron ${fmt.arsF(a.falt)} en efectivo.`);
  else know.push(`En ${mesLargo(S.mes)} el cierre se anotaba en el Excel: no había efectivo contado, así que no se puede saber si la caja cuadraba.`);
  if (peor && faltTot < 0) know.push(`Desde junio, <b>${esc(peor.resp)}</b> (${esc(peor.local)}, ${finde(peor) ? 'fines de semana' : 'días de semana'}) explica el <b>${fmt.pct(peor.faltante_total / faltTot)}</b> de la plata que faltó en la caja.`);
  const falt = FALTAN.filter(f => !S.loc || f.local === S.loc);
  if (falt.length) know.push(`Hay <b>${falt.length} cierres sin cargar</b> desde que existe el formulario: ${falt.map(f => `${DIA_N[dow(f.fecha)]} ${fd(f.fecha)} en ${f.local}`).slice(0, 5).join(', ')}.`);
  const [sc, st] = a.pcuadra == null ? ['neu', 's/d'] : estado(a.pcuadra, OBJ_CUADRA);
  v.innerHTML = chips() + `
  <p class="eyb">Lo que hay que saber</p><ul class="know">${know.map(k => `<li><span>${k}</span></li>`).join('')}</ul>
  <p class="eyb">Último cierre cargado</p>
  <div class="hoy" id="hoyBox">${ult.map(c => `<button type="button" data-f="${c.fecha}|${c.local}">
    <span><span class="t">${esc(c.local)} · ${DIA_N[dow(c.fecha)]} ${fd(c.fecha)}</span><br><span class="s">Cargó ${esc(c.resp || '—')}${c.hora ? ' a las ' + c.hora : ''} · ${fmt.int(c.tk || 0)} tickets</span></span>
    <span class="n">${fmt.arsF(c.venta)}</span>
    <span class="s">Efectivo esperado ${fmt.arsF(c.esp)} · contado ${fmt.arsF(c.cont)}</span><span>${c.est ? chip(...EST_CAJA[c.est]) : ''}</span></button>`).join('')}</div>
  <div class="cards" id="cardsBox">
    <button class="card" data-c="ventas"><div class="lbl">Venta del mes</div><div class="v">${fmt.ars(a.venta)}</div>
      <div class="cl">${parcial ? `Mes en curso: ${a.dias} días abiertos` : varTxt(b ? rel(a.venta, b.venta) : null, false, x => fmt.pct(x, true)) + ' vs ' + (pm ? mesLbl(pm) : 's/d')}</div>
      <p class="phrase">Lo que cargaron los locales, todos los medios de pago.</p><span class="go">Ver ventas →</span></button>
    <button class="card" data-c="ventas"><div class="lbl">Ticket promedio</div><div class="v">${a.ticket ? fmt.arsF(a.ticket) : 's/d'}</div>
      <div class="cl">${a.ticket && b && b.ticket ? varTxt(rel(a.ticket, b.ticket), false, x => fmt.pct(x, true)) + ' vs ' + mesLbl(pm) : a.ticket ? 'Primer mes con tickets' : 'El Excel no tenía la cantidad de tickets'}</div>
      <p class="phrase">Venta ÷ cantidad de tickets del cierre.</p><span class="go">Ver ventas →</span></button>
    <button class="card" data-c="calBox"><div class="lbl">Cierres que cuadran ${chip(sc, st)}</div><div class="v">${a.pcuadra == null ? 's/d' : fmt.pct(a.pcuadra)}</div>
      <div class="cl">${a.arq ? `${fmt.int(a.cuadra)} de ${fmt.int(a.arq)} cierres` : 'Antes de junio no se contaba el efectivo'}</div>
      <p class="phrase">Objetivo: 8 de cada 10. Cuadra si la diferencia es de $ 500 o menos.</p><span class="go">Ver el calendario →</span></button>
    <button class="card" data-c="respBox"><div class="lbl">Faltó en la caja</div><div class="v">${a.arq ? fmt.ars(a.falt) : 's/d'}</div>
      <div class="cl">${a.arq && b && b.arq ? varTxt(a.falt - b.falt, true, x => fmt.ars(Math.abs(x))) + ' vs ' + mesLbl(pm) : a.arq ? `${fmt.int(a.faltN)} cierres con faltante` : 'Sin efectivo contado'}</div>
      <p class="phrase">${a.faltN ? `${fmt.int(a.faltN)} cierres con faltante; el mayor, ${fmt.arsF(a.maxFalt)}.` : 'Menos es mejor.'}</p><span class="go">Ver por responsable →</span></button>
    <button class="card" data-c="calBox"><div class="lbl">Cierres sin cargar ${a.sinCargar ? chip('crit', 'Revisar') : S.mes >= FORM.slice(0, 7) ? chip('good', 'Completo') : ''}</div><div class="v">${S.mes >= FORM.slice(0, 7) ? fmt.int(a.sinCargar) : 's/d'}</div>
      <div class="cl">${S.mes >= FORM.slice(0, 7) ? 'Días abiertos sin el formulario' : 'En el Excel no se podía saber'}</div>
      <p class="phrase">A las 22:00 llega un mail si un local no cargó el cierre.</p><span class="go">Ver el calendario →</span></button>
    <button class="card" data-c="ventas"><div class="lbl">Cobrado en efectivo</div><div class="v">${fmt.pct(a.pefe)}</div>
      <div class="cl">${b ? `<b class="flat">${fmt.pp(a.pefe - b.pefe)}</b> vs ${mesLbl(pm)}` : ''}</div>
      <p class="phrase">El resto entra por débito, crédito, billetera o transferencia.</p><span class="go">Ver medios de pago →</span></button>
  </div>
  <section class="panel" id="calBox"><div class="ph"><div><h3>${tituloCal()}</h3><p>Cada cuadrado es un día desde que existe el formulario (los lunes no abre) · tocá uno para ver el arqueo</p></div></div>
    <div class="cal">${LOCALES.filter(l => !S.loc || l === S.loc).map(calendario).join('')}</div>
    <div class="leg"><span><i style="background:var(--good)"></i>Cuadra</span><span><i style="background:var(--crit)">−</i>Faltante</span><span><i style="background:var(--warn);color:#2b1a08">+</i>Sobrante</span><span><i style="background:repeating-linear-gradient(45deg,var(--neutral) 0 3px,transparent 3px 6px);border:1px solid var(--neutral);color:var(--ink)">×</i>Sin cargar</span></div></section>
  <div class="grid" style="margin-top:18px">
    <section class="panel s7" id="respBox"><div class="ph"><div><h3>${peor && faltTot < 0 ? `${esc(peor.resp)} concentra el ${fmt.pct(peor.faltante_total / faltTot)} de lo que faltó` : 'Cómo cierra cada responsable'}</h3><p>Desde junio, con formulario · objetivo: 8 de cada 10 cierres cuadran</p></div></div>
      <div class="tw"><table><thead><tr><th>Responsable</th><th class="l">Local</th><th class="l hide-m">Turno</th><th>Cierres</th><th>Cuadran</th><th class="l">Estado</th><th>Faltó</th><th class="hide-m">Sobró</th></tr></thead><tbody>
      ${resp.filter(r => !S.loc || r.local === S.loc).map(r => { const p = r.cuadran / r.cierres, [c, t] = estado(p, OBJ_CUADRA); return `<tr><td>${esc(r.resp)}</td><td class="l">${esc(r.local)}</td><td class="l hide-m">${finde(r) ? 'Sábado y domingo' : 'Martes a viernes'}</td><td>${fmt.int(r.cierres)}</td><td>${fmt.pct(p)}</td><td class="l">${chip(c, t)}</td><td>${fmt.arsF(-r.faltante_total)}</td><td class="hide-m">${fmt.arsF(r.sobrante_total)}</td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="note">Cuando el faltante supera $ 2.000, el dueño recibe un mail en el momento con el arqueo.</p></section>
    <section class="panel s5"><div class="ph"><div><h3>${tituloSemana()}</h3><p>Plata que faltó desde junio, por día de la semana</p></div></div><div class="chart short" id="chDia"></div></section>
  </div>
  <section class="panel" id="ciBox"></section>`;
  // día de la semana
  const orden = [2, 3, 4, 5, 6, 0];
  const porDia = orden.map(d => -CI.filter(c => c.fuente === 'Formulario' && enLoc(c) && dow(c.fecha) === d && c.dif < -TOL).reduce((s, c) => s + c.dif, 0));
  chart('chDia', { grid: { left: 58, right: 12, top: 12, bottom: 28 }, tooltip: { trigger: 'axis', valueFormatter: x => fmt.arsF(x) },
    xAxis: axC(orden.map(d => DIA_N[d].slice(0, 3))), yAxis: axV(x => fmt.ars(x)),
    series: [{ name: 'Faltó', type: 'bar', barMaxWidth: 26, data: porDia, itemStyle: { color: cssv('--crit'), borderRadius: [4, 4, 0, 0] } }] });
  tablaCierres();
  v.querySelectorAll('.calsc').forEach(x => { x.scrollLeft = x.scrollWidth; });     // en el celular se ve lo más reciente
  v.querySelectorAll('#hoyBox button, .calg button[data-f]').forEach(b => b.onclick = () => fichaCierre(b.dataset.f));
  v.querySelectorAll('#cardsBox .card').forEach(b => b.onclick = () => { const c = b.dataset.c; if (c === 'ventas') go('ventas'); else $(c).scrollIntoView({ behavior: 'smooth' }); });
}
const finde = r => r.dias.filter(d => d === 0 || d === 6).length > r.dias.length / 2;
function tituloCal() {
  const f = CI.filter(c => c.fuente === 'Formulario' && enLoc(c) && c.dif < -TOL);
  const tot = f.reduce((s, c) => s - c.dif, 0); if (!tot) return 'La caja cuadró todos los días';
  const g = {}; for (const c of f) { const k = c.local + '|' + ([0, 6].includes(dow(c.fecha)) ? 'f' : 's'); g[k] = (g[k] || 0) - c.dif; }
  const [k, x] = Object.entries(g).sort((a, b) => b[1] - a[1])[0], [l, t] = k.split('|');
  return `El ${fmt.pct(x / tot)} de lo que faltó es del ${l} ${t === 'f' ? 'los fines de semana' : 'de martes a viernes'}`;
}
function tituloSemana() {
  const f = CI.filter(c => c.fuente === 'Formulario' && enLoc(c) && c.dif < -TOL);
  const fs = f.filter(c => [0, 6].includes(dow(c.fecha))).reduce((s, c) => s - c.dif, 0), t = f.reduce((s, c) => s - c.dif, 0);
  return t ? `Sábado y domingo suman el ${fmt.pct(fs / t)} de los faltantes` : 'Sin faltantes';
}
function calendario(local) {
  const ini = DN(FORM) - ((dow(FORM) + 6) % 7), fin = DN(CORTE);                // lunes de la primera semana
  const cols = [], meses = [];
  for (let w = ini; w <= fin; w += 7) {
    const m = SD(w + 6).slice(0, 7);
    meses.push(meses.length && meses[meses.length - 1].m === m ? { m, s: '' } : { m, s: mesLbl(m).slice(0, 3) });
    for (const off of [1, 2, 3, 4, 5, 6]) {                                     // martes a domingo
      const n = w + off, s = SD(n);
      if (n < DN(FORM) || n > fin) { cols.push('<span class="d x" aria-hidden="true"></span>'); continue; }
      const c = CIX.get(s + '|' + local);
      if (!c) { cols.push(`<button class="d c3" data-f="" title="${DIA_N[dow(s)]} ${fd(s)} · sin cargar" aria-label="${DIA_N[dow(s)]} ${fd(s)}: sin cargar">×</button>`); continue; }
      const k = c.est === 'Cuadra' ? 0 : c.est === 'Faltante' ? 1 : 2;
      const t = `${DIA_N[dow(s)]} ${fd(s)} · ${c.resp} · ${c.est}${k ? ' ' + fmt.sgn(c.dif) : ''}`;
      cols.push(`<button class="d c${k}" data-f="${s}|${local}" title="${esc(t)}" aria-label="${esc(t)}">${k === 1 ? '−' : k === 2 ? '+' : ''}</button>`);
    }
  }
  return `<div class="calbox"><h4>${esc(local)}</h4><div class="calsc"><div class="calm" style="grid-template-columns:repeat(${meses.length},var(--cw,25px))">${meses.map(x => `<span>${x.s}</span>`).join('')}</div>
    <div class="calrow"><div class="dn">${['mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(d => `<span>${d}</span>`).join('')}</div><div class="calg">${cols.join('')}</div></div></div></div>`;
}
function tablaCierres() {
  const L = CI.filter(c => c.mes === S.mes && enLoc(c));
  const k = S.sortC, dir = S.dirC;
  L.sort((a, b) => dir * ((k === 'fecha' ? (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) : (a[k] ?? -1e12) - (b[k] ?? -1e12))) || (a.local < b.local ? -1 : 1));
  const th = (key, t, cls = '') => `<th class="sortable ${cls}" data-k="${key}" aria-sort="${k === key ? (dir < 0 ? 'descending' : 'ascending') : 'none'}">${t}${k === key ? (dir < 0 ? ' ↓' : ' ↑') : ''}</th>`;
  $('ciBox').innerHTML = `<div class="ph"><div><h3>Cierres de ${mesLargo(S.mes)}</h3><p>Tocá un cierre para ver el arqueo · ${L[0]?.fuente === 'Excel' ? 'meses del Excel: sin tickets ni efectivo contado' : 'cargados con el formulario'}</p></div>
    <button class="btn" id="btnCsv" type="button">Bajar a Excel (CSV)</button></div>
    <div class="tw"><table><thead><tr>${th('fecha', 'Fecha')}<th class="l">Local</th><th class="l hide-m">Responsable</th>${th('venta', 'Venta')}<th class="hide-m">Tickets</th><th class="hide-m">Efectivo esperado</th><th class="hide-m">Contado</th>${th('dif', 'Diferencia')}<th class="l">Caja</th></tr></thead><tbody>
    ${L.map(c => `<tr class="click" data-f="${c.fecha}|${c.local}"><td>${DIA_N[dow(c.fecha)].slice(0, 3)} ${fd(c.fecha)}</td><td class="l">${esc(c.local)}</td><td class="l hide-m">${esc(c.resp || '—')}</td><td>${fmt.arsF(c.venta)}</td><td class="hide-m">${c.tk ?? '—'}</td><td class="hide-m">${c.esp != null ? fmt.arsF(c.esp) : '—'}</td><td class="hide-m">${c.cont != null ? fmt.arsF(c.cont) : '—'}</td><td>${c.dif != null ? fmt.sgn(c.dif) : '—'}</td><td class="l">${c.est ? chip(...EST_CAJA[c.est]) : c.inc ? chip('crit', 'Incompleto') : '<span class="muted">Excel</span>'}</td></tr>`).join('')}
    </tbody></table></div>`;
  $('ciBox').querySelectorAll('th[data-k]').forEach(t => t.onclick = () => { const kk = t.dataset.k; if (S.sortC === kk) S.dirC *= -1; else { S.sortC = kk; S.dirC = -1; } tablaCierres(); });
  $('ciBox').querySelectorAll('tr[data-f]').forEach(t => t.onclick = () => fichaCierre(t.dataset.f));
  $('btnCsv').onclick = () => csv(`cierres_${S.mes}${S.loc ? '_' + S.loc : ''}.csv`, ['Fecha', 'Local', 'Responsable', ...MEDIOS.map(m => m[1]), 'Venta', 'Tickets', 'Gasto', 'Retiro', 'Efectivo esperado', 'Efectivo contado', 'Diferencia', 'Caja', 'Fuente'],
    L.map(c => [c.fecha, c.local, c.resp || '', c.efe ?? '', c.deb, c.cre, c.bil, c.tra, c.venta, c.tk ?? '', c.gasto, c.retiro, c.esp ?? '', c.cont ?? '', c.dif ?? '', c.est || '', c.fuente]));
}

/* ---------- panel lateral ---------- */
let lastFocus = null;
function abrir(eyebrow, title, sub, body) {
  lastFocus = document.activeElement;
  $('dEyebrow').textContent = eyebrow; $('dTitle').textContent = title; $('dSub').textContent = sub; $('dBody').innerHTML = body;
  $('scrim').hidden = false; $('drawer').hidden = false; $('dClose').focus();
}
function cerrar() { $('scrim').hidden = true; $('drawer').hidden = true; CH.chFicha?.dispose(); delete CH.chFicha; lastFocus?.focus?.(); }
function fichaCierre(key) {
  if (!key) { toast('Ese día no se cargó el cierre: a las 22:00 se mandó el aviso.'); return; }
  const c = CIX.get(key); if (!c) return;
  const arq = c.esp != null ? `<div><h4>Arqueo del efectivo</h4><div class="tw"><table><tbody>
      <tr><td>Fondo de caja</td><td>${fmt.arsF(c.fondo)}</td></tr><tr><td>+ Ventas en efectivo</td><td>${fmt.arsF(c.efe)}</td></tr>
      <tr><td>− Gastos pagados con la caja${c.conc ? ' (' + esc(c.conc) + ')' : ''}</td><td>${fmt.arsF(-c.gasto)}</td></tr><tr><td>− Retiro del dueño</td><td>${fmt.arsF(-c.retiro)}</td></tr>
      <tr class="tot"><td>Efectivo esperado</td><td>${fmt.arsF(c.esp)}</td></tr><tr><td>Efectivo contado</td><td>${fmt.arsF(c.cont)}</td></tr>
      <tr class="tot"><td>Diferencia</td><td>${fmt.sgn(c.dif)}</td></tr></tbody></table></div></div>`
    : `<p class="note" style="margin:0">Este cierre viene del Excel: no tenía fondo ni efectivo contado, así que no se puede arquear.${c.inc ? ' Además, el efectivo decía «ver cuaderno».' : ''}</p>`;
  abrir(`${c.local} · ${c.fuente === 'Excel' ? 'del Excel' : 'cargado ' + (c.hora ? 'a las ' + c.hora : '')}`, `${DIA_N[dow(c.fecha)][0].toUpperCase() + DIA_N[dow(c.fecha)].slice(1)} ${fdl(c.fecha)}`, `Responsable: ${c.resp || 'sin dato (Excel)'}`, `
    <div class="kv"><div><span>Venta del día</span><b>${fmt.arsF(c.venta)}</b></div><div><span>Tickets</span><b>${c.tk ?? 's/d'}</b></div>
      <div><span>Ticket promedio</span><b>${c.tk ? fmt.arsF(c.venta / c.tk) : 's/d'}</b></div><div><span>Caja</span><b>${c.est ? chip(...EST_CAJA[c.est]) : 's/d'}</b></div></div>
    ${arq}
    <div><h4>Ventas por medio de pago</h4><div class="tw"><table><thead><tr><th>Medio</th><th>Importe</th><th>%</th><th>Comisión</th></tr></thead><tbody>
      ${MEDIOS.map(([k, n]) => { const x = c[k] || 0, cm = { deb: COM.debito, cre: COM.credito, bil: COM.billetera }[k] || 0; return `<tr><td>${n}</td><td>${fmt.arsF(x)}</td><td>${c.venta ? fmt.pct(x / c.venta) : '—'}</td><td>${cm ? fmt.arsF(x * cm) : '—'}</td></tr>`; }).join('')}
    </tbody></table></div></div>`);
}

/* ================================================================ VENTAS */
function renderVentas(v) {
  const a = agg(S.mes), pm = prevMes(S.mes), b = pm ? agg(pm) : null, parcial = S.mes === CORTE.slice(0, 7);
  const ag = MESES.map(m => agg(m));
  const cerr = MESES.filter(m => m !== CORTE.slice(0, 7));
  const orden = [2, 3, 4, 5, 6, 0];
  const L = CI.filter(c => c.mes === S.mes && enLoc(c));
  const prom = orden.map(d => { const x = L.filter(c => dow(c.fecha) === d); const dias = new Set(x.map(c => c.fecha)).size; return dias ? x.reduce((s, c) => s + c.venta, 0) / dias : 0; });
  const mejor = Math.max(...prom), base = prom[0] || 1;
  const digital = a.deb + a.cre + a.bil;
  v.innerHTML = chips() + `
  <div class="cards">
    <div class="card static"><div class="lbl">Venta del mes</div><div class="v">${fmt.ars(a.venta)}</div><div class="cl">${parcial ? 'Mes en curso' : varTxt(b ? rel(a.venta, b.venta) : null, false, x => fmt.pct(x, true)) + (pm ? ' vs ' + mesLbl(pm) : '')}</div><p class="phrase">En pesos de cada mes, sin ajustar por inflación.</p></div>
    <div class="card static"><div class="lbl">Venta promedio por día</div><div class="v">${a.dias ? fmt.ars(a.venta / a.dias) : 's/d'}</div><div class="cl">${a.dias} días abiertos</div><p class="phrase">Sirve para comparar un mes en curso contra uno cerrado.</p></div>
    <div class="card static"><div class="lbl">Tickets</div><div class="v">${a.tk ? fmt.int(a.tk) : 's/d'}</div><div class="cl">${a.ticket ? 'Ticket promedio ' + fmt.arsF(a.ticket) : 'El Excel no los tenía'}</div><p class="phrase">Desde junio, del formulario.</p></div>
    <div class="card static"><div class="lbl">Cobrado en efectivo</div><div class="v">${fmt.pct(a.pefe)}</div><div class="cl">${b ? `<b class="flat">${fmt.pp(a.pefe - b.pefe)}</b> vs ${mesLbl(pm)}` : ''}</div><p class="phrase">Lo que no paga comisión.</p></div>
    <div class="card static"><div class="lbl">Costo de las plataformas</div><div class="v">${fmt.ars(a.costo)}</div><div class="cl">${fmt.pct(digital ? a.costo / digital : 0)} de lo cobrado con tarjeta o billetera</div><p class="phrase">Débito 1,5%, crédito 3,5%, billetera 0,8%, sin IVA.</p></div>
  </div>
  <div class="grid">
    <section class="panel s7"><div class="ph"><div><h3>${tituloVenta(ag, cerr)}</h3><p>Venta por mes y local · ${mesLbl(CORTE.slice(0, 7))} es parcial (al ${fd(CORTE)})</p></div></div><div class="chart" id="chVenta"></div></section>
    <section class="panel s5"><div class="ph"><div><h3>${prom[orden.indexOf(0)] && base ? `El domingo vende ${nf(1).format(prom[orden.indexOf(0)] / base)} veces lo que un martes` : 'Venta por día de la semana'}</h3><p>Venta promedio por día abierto · ${mesLargo(S.mes)}</p></div></div><div class="chart" id="chDow"></div></section>
  </div>
  <div class="grid">
    <section class="panel s7"><div class="ph"><div><h3>${tituloMix(ag, cerr)}</h3><p>Composición de la venta por medio de pago · hasta marzo la billetera se anotaba como transferencia</p></div></div><div class="chart" id="chMix"></div></section>
    <section class="panel s5"><div class="ph"><div><h3>${tituloCosto(ag, cerr)}</h3><p>Comisiones de débito, crédito y billetera por mes</p></div></div><div class="chart" id="chCosto"></div></section>
  </div>
  <section class="panel"><div class="ph"><div><h3>Mes a mes</h3><p>${S.loc ? esc(S.loc) : 'Los dos locales'}</p></div></div><div class="tw"><table><thead><tr><th>Mes</th><th>Venta</th><th class="hide-m">Centro</th><th class="hide-m">Jardín</th><th>Tickets</th><th>Ticket promedio</th><th>Efectivo</th><th class="hide-m">Costo plataformas</th><th class="hide-m">Faltó en caja</th></tr></thead><tbody>
    ${MESES.map((m, i) => { const x = ag[i], c = CI.filter(z => z.mes === m); return `<tr${m === S.mes ? ' class="tot"' : ''}><td>${mesLbl(m)}${m === CORTE.slice(0, 7) ? ' *' : ''}</td><td>${fmt.ars(x.venta)}</td><td class="hide-m">${fmt.ars(c.filter(z => z.local === 'Centro').reduce((s, z) => s + z.venta, 0))}</td><td class="hide-m">${fmt.ars(c.filter(z => z.local === 'Jardín').reduce((s, z) => s + z.venta, 0))}</td><td>${x.tk ? fmt.int(x.tk) : '—'}</td><td>${x.ticket ? fmt.arsF(x.ticket) : '—'}</td><td>${fmt.pct(x.pefe)}</td><td class="hide-m">${fmt.ars(x.costo)}</td><td class="hide-m">${x.arq ? fmt.ars(x.falt) : '—'}</td></tr>`; }).join('')}
    </tbody></table></div><p class="note">* ${mesLbl(CORTE.slice(0, 7))}: hasta el ${fdl(CORTE)}. Los totales de enero a mayo vienen del Excel limpio (los montos cargados como texto incluidos).</p></section>`;
  const lab = MESES.map(mesLbl);
  const locs = LOCALES.filter(l => !S.loc || l === S.loc);
  chart('chVenta', { legend: leg(), grid: { left: 58, right: 12, top: 36, bottom: 28 }, tooltip: { trigger: 'axis', valueFormatter: x => fmt.arsF(x) },
    xAxis: axC(lab), yAxis: axV(x => fmt.ars(x)),
    series: locs.map(l => ({ name: l, type: 'bar', barMaxWidth: 18, barGap: '10%', data: MESES.map(m => CI.filter(c => c.mes === m && c.local === l).reduce((s, c) => s + c.venta, 0)),
      itemStyle: { color: cssv(l === 'Centro' ? '--s1' : '--s2'), borderRadius: [4, 4, 0, 0] } })) });
  chart('chDow', { grid: { left: 58, right: 12, top: 12, bottom: 28 }, tooltip: { trigger: 'axis', valueFormatter: x => fmt.arsF(x) },
    xAxis: axC(orden.map(d => DIA_N[d].slice(0, 3))), yAxis: axV(x => fmt.ars(x)),
    series: [{ name: 'Venta promedio', type: 'bar', barMaxWidth: 28, data: prom.map(x => ({ value: Math.round(x), itemStyle: { color: cssv('--s1'), opacity: x === mejor ? 1 : 0.55, borderRadius: [4, 4, 0, 0] } })) }] });
  const mcol = ['--s1', '--s2', '--s3', '--s4', '--s5'].map(cssv);
  chart('chMix', { legend: leg(), grid: { left: 44, right: 12, top: 36, bottom: 28 }, tooltip: { trigger: 'axis', valueFormatter: x => nf(1).format(x) + '%' },
    xAxis: axC(lab), yAxis: axV(x => x + '%', { max: 100 }),
    series: MEDIOS.map(([k, n], i) => ({ name: n, type: 'bar', stack: 'm', barMaxWidth: 26, data: ag.map(x => x.venta ? +(x[k] / x.venta * 100).toFixed(1) : 0), itemStyle: Object.assign({ color: mcol[i] }, ring()) })) });
  chart('chCosto', { grid: { left: 58, right: 12, top: 12, bottom: 28 }, tooltip: { trigger: 'axis', valueFormatter: x => fmt.arsF(x) },
    xAxis: axC(lab), yAxis: axV(x => fmt.ars(x)),
    series: [{ name: 'Costo de plataformas', type: 'bar', barMaxWidth: 22, data: ag.map(x => x.costo), itemStyle: { color: cssv('--s4'), borderRadius: [4, 4, 0, 0] } }] });
}
function tituloVenta(ag, cerr) {
  const i0 = 0, i1 = MESES.indexOf(cerr[cerr.length - 1]);
  const d = rel(ag[i1].venta, ag[i0].venta);
  return `La venta de ${mesLbl(MESES[i1])} fue ${fmt.pct(d)} más alta que la de ${mesLbl(MESES[i0])}, en pesos de cada mes`;
}
function tituloMix(ag, cerr) {
  const a = ag[0], b = ag[MESES.indexOf(cerr[cerr.length - 1])];
  return `El efectivo pasó de ${fmt.pct(a.pefe)} a ${fmt.pct(b.pefe)} de la venta`;
}
function tituloCosto(ag, cerr) {
  const b = ag[MESES.indexOf(cerr[cerr.length - 1])];
  return `Las plataformas costaron ${fmt.ars(b.costo)} en ${mesLbl(cerr[cerr.length - 1])}: ${fmt.pct(b.venta ? b.costo / b.venta : 0)} de la venta`;
}

/* ================================================================ RESTAURANTES Y FIADO */
function filasClientes() {
  return [...CLI.values()].map(c => {
    const e = EST.get(c.id), s = SAL.get(c.id);
    return { c, e, s, saldo: s ? s.saldo : 0, dias: e ? e.dias : 9999 };
  }).filter(x => x.e);
}
function alertasClientes() {
  const out = [];
  for (const x of filasClientes()) {
    const { c, e, s } = x, nom = esc(c.nombre), debe = s && s.saldo > 0 ? s.saldo : 0;
    const ritmo = e.intervalo ? `compraba cada ${nf(0).format(e.intervalo)} días` : 'sin ritmo';
    if (e.est === 'Dejó de comprar') out.push({ id: c.id, cls: '', t: `${nom} dejó de comprar`, m: debe, mm: debe ? 'debe ' + fmt.arsF(debe) : '',
      p: `<b>Qué pasó:</b> no compra desde el ${fd(e.ult)} (hace ${e.dias} días; ${ritmo}). <b>Por qué importa:</b> compraba unos ${fmt.ars(e.mensual)} por mes${debe ? ' y quedó debiendo ' + fmt.arsF(debe) : ''}. <b>Qué hacer:</b> llamar para saber por qué dejó${debe ? ' y acordar el pago del saldo' : ''}.`, imp: debe + e.mensual });
    else if (e.est === 'En riesgo') out.push({ id: c.id, cls: 'warn', t: `${nom} no compra hace ${e.dias} días`, m: e.mensual, mm: fmt.ars(e.mensual) + ' por mes',
      p: `<b>Qué pasó:</b> ${ritmo} y la última compra fue el ${fd(e.ult)}. <b>Qué hacer:</b> llamar esta semana, antes de que pase a «dejó de comprar».`, imp: e.mensual + debe });
    else if (e.est === 'Compra menos seguido') out.push({ id: c.id, cls: 'warn', t: `${nom} compra menos seguido`, m: e.mensual, mm: fmt.ars(e.mensual) + ' por mes',
      p: `<b>Qué pasó:</b> en las últimas 6 semanas compró ${e.n6} veces; por su ritmo le tocaban unas ${nf(0).format(e.esperadas)}. <b>Qué hacer:</b> preguntar si compra en otro lado o si bajó su demanda.`, imp: e.mensual * 0.5 + debe });
    if (s && s.paga_menos) out.push({ id: c.id, cls: '', t: `${nom} paga menos de lo que compra`, m: s.saldo, mm: 'debe ' + fmt.arsF(s.saldo),
      p: `<b>Qué pasó:</b> en 90 días compró ${fmt.arsF(s.vendido_90)} a cuenta y pagó ${fmt.arsF(s.cobrado_90)} (${fmt.pct(s.cobrado_90 / s.vendido_90)}). <b>Qué hacer:</b> pasarlo a contado hasta que baje el saldo.`, imp: s.saldo * 1.5 });
    if (e.est === 'Nuevo') out.push({ id: c.id, cls: 'new', t: `${nom} es cliente nuevo`, m: debe, mm: debe ? 'debe ' + fmt.arsF(debe) : '',
      p: `<b>Qué pasó:</b> compra desde el ${fd(e.pri)}, ${ritmo}. <b>Qué hacer:</b> confirmar cada cuántos días paga antes de ampliarle el fiado.`, imp: debe * 0.3 });
  }
  return out.sort((a, b) => b.imp - a.imp);
}
function renderMay(v) {
  const rows = filasClientes(), fiado = [...SAL.values()].filter(s => s.saldo > 0);
  const tot = fiado.reduce((a, s) => a + s.saldo, 0);
  const dej = rows.filter(x => x.e.est === 'Dejó de comprar'), debenDej = dej.reduce((a, x) => a + Math.max(0, x.saldo), 0);
  const al = alertasClientes();
  const mV = VEN.filter(x => x.f.slice(0, 7) === S.mes), mC = COB.filter(x => x.f.slice(0, 7) === S.mes);
  const pm = prevMes(S.mes), pV = pm ? VEN.filter(x => x.f.slice(0, 7) === pm).reduce((a, x) => a + x.imp, 0) : null;
  const vm = mV.reduce((a, x) => a + x.imp, 0), cm = mC.reduce((a, x) => a + x.imp, 0);
  const viejo = fiado.filter(s => s.desde).sort((a, b) => a.desde < b.desde ? -1 : 1)[0];
  const top = fiado.sort((a, b) => b.saldo - a.saldo);
  v.innerHTML = `<div class="chips"><span class="chip">Mes <b>${mesLbl(S.mes)}</b></span><span class="muted">Los restaurantes compran a la fábrica: el filtro de local no aplica.</span></div>
  <p class="eyb">Lo que hay que saber</p><ul class="know">
    <li><span>Los restaurantes deben <b>${fmt.arsF(tot)}</b> entre ${fiado.length} cuentas; ${esc(CLI.get(top[0].id).nombre)} sola es el ${fmt.pct(top[0].saldo / tot)}.</span></li>
    ${dej.length ? `<li><span><b>${dej.length} clientes dejaron de comprar</b> (${dej.map(x => esc(x.c.nombre)).join(', ')}) y quedaron debiendo ${fmt.arsF(debenDej)}.</span></li>` : ''}
    ${al.filter(a => a.t.includes('paga menos')).map(a => `<li><span>${a.t}: ${a.p.split('<b>Qué hacer:</b>')[0].replace('<b>Qué pasó:</b> ', '')}</span></li>`).join('')}
  </ul>
  <div class="cards">
    <div class="card static"><div class="lbl">Fiado total</div><div class="v">${fmt.ars(tot)}</div><div class="cl">${fiado.length} restaurantes con saldo</div><p class="phrase">Lo comprado a cuenta que todavía no pagaron.</p></div>
    <div class="card static"><div class="lbl">Compraron en el mes</div><div class="v">${fmt.ars(vm)}</div><div class="cl">${pV != null && S.mes !== CORTE.slice(0, 7) ? varTxt(rel(vm, pV), false, x => fmt.pct(x, true)) + ' vs ' + mesLbl(pm) : 'Mes en curso'}</div><p class="phrase">${new Set(mV.map(x => x.id)).size} restaurantes compraron.</p></div>
    <div class="card static"><div class="lbl">Cobrado en el mes</div><div class="v">${fmt.ars(cm)}</div><div class="cl">${fmt.pct(vm ? cm / vm : 0)} de lo que compraron</div><p class="phrase">Contado y pagos del fiado.</p></div>
    <div class="card static"><div class="lbl">Deuda más vieja ${viejo ? chip(DN(CORTE) - DN(viejo.desde) > 30 ? 'crit' : 'good', DN(CORTE) - DN(viejo.desde) > 30 ? 'Más de 30 días' : 'Al día') : ''}</div><div class="v">${viejo ? fmt.int(DN(CORTE) - DN(viejo.desde)) + ' días' : '—'}</div><div class="cl">${viejo ? esc(CLI.get(viejo.id).nombre) : ''}</div><p class="phrase">Compra más vieja que sigue sin pagar.</p></div>
    <div class="card static"><div class="lbl">Clientes a mirar</div><div class="v">${new Set(al.map(a => a.id)).size}</div><div class="cl">${dej.length} dejaron · ${rows.filter(x => ['En riesgo', 'Compra menos seguido'].includes(x.e.est)).length} se espacian · ${(n => n + (n === 1 ? ' paga' : ' pagan') + ' menos')([...SAL.values()].filter(s => s.paga_menos).length)}</div><p class="phrase">La lista de abajo dice qué hacer con cada uno.</p></div>
  </div>
  <div class="grid">
    <section class="panel s7"><div class="ph"><div><h3>A quién llamar esta semana</h3><p>Ordenado por la plata en juego · tocá uno para ver su cuenta</p></div></div><div class="alerts">
      ${al.map(a => `<div class="al ${a.cls}" role="button" tabindex="0" data-id="${a.id}"><h5>${a.t}</h5><span class="m">${a.mm}</span><p>${a.p}</p></div>`).join('') || '<p class="muted">Nadie para llamar.</p>'}</div></section>
    <section class="panel s5"><div class="ph"><div><h3>${esc(CLI.get(top[0].id).nombre)} concentra el ${fmt.pct(top[0].saldo / tot)} del fiado</h3><p>Saldo por restaurante al ${fd(CORTE)}</p></div></div><div class="chart tall" id="chFiado"></div></section>
  </div>
  <section class="panel" id="cliBox"></section>`;
  const t = top.slice(0, 12).reverse();
  chart('chFiado', { grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true }, tooltip: { trigger: 'item', formatter: p => `${esc(p.name)}<br>${fmt.arsF(p.value)} · debe desde el ${fd(SAL.get(t[p.dataIndex].id).desde)}` },
    xAxis: { type: 'value', show: false }, yAxis: axC(t.map(s => CLI.get(s.id).nombre), { axisLabel: { color: cssv('--ink-2'), width: 150, overflow: 'truncate' } }),
    series: [{ type: 'bar', barMaxWidth: 16, data: t.map(s => ({ value: s.saldo, itemStyle: { color: cssv(s.paga_menos ? '--crit' : '--s1'), borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', color: cssv('--ink-2'), formatter: p => fmt.ars(p.value) } }] });
  CH.chFiado?.on('click', p => fichaCliente(t[p.dataIndex].id));
  v.querySelectorAll('.al[data-id]').forEach(b => { b.onclick = () => fichaCliente(+b.dataset.id); b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fichaCliente(+b.dataset.id); } }; });
  tablaClientes();
}
function tablaClientes() {
  const R = filasClientes(), k = S.sortM, dir = S.dirM;
  R.sort((a, b) => dir * ((a[k] ?? 0) - (b[k] ?? 0)) || a.c.nombre.localeCompare(b.c.nombre));
  const th = (key, t, cls = '') => `<th class="sortable ${cls}" data-k="${key}" aria-sort="${k === key ? (dir < 0 ? 'descending' : 'ascending') : 'none'}">${t}${k === key ? (dir < 0 ? ' ↓' : ' ↑') : ''}</th>`;
  $('cliBox').innerHTML = `<div class="ph"><div><h3>Todos los restaurantes</h3><p>Tocá uno para ver sus compras y pagos</p></div><span class="muted">${R.length} clientes</span></div>
  <div class="tw"><table><thead><tr><th>Cliente</th><th class="l hide-m">Condición</th><th class="l">Estado</th>${th('dias', 'Última compra')}<th class="hide-m">Compra cada</th><th class="hide-m">Compras en 6 semanas</th>${th('saldo', 'Saldo')}<th class="hide-m">Debe desde</th><th class="hide-m" title="Pagó de lo comprado a cuenta en los últimos 90 días">Pagó (90 d)</th></tr></thead><tbody>
  ${R.map(({ c, e, s }) => `<tr class="click" data-id="${c.id}"><td>${esc(c.nombre)}</td><td class="l hide-m">${esc(c.cond)}</td><td class="l">${chip(...EST_CLI[e.est])}${s && s.paga_menos ? ' ' + chip('crit', 'Paga menos') : ''}</td><td>hace ${e.dias} d</td><td class="hide-m">${e.intervalo ? nf(0).format(e.intervalo) + ' días' : '—'}</td><td class="hide-m">${e.n6}</td><td>${s ? fmt.arsF(s.saldo) : '—'}</td><td class="hide-m">${s && s.desde ? fd(s.desde) : '—'}</td><td class="hide-m">${s && s.vendido_90 ? fmt.pct(s.cobrado_90 / s.vendido_90) : '—'}</td></tr>`).join('')}
  </tbody></table></div>`;
  $('cliBox').querySelectorAll('th[data-k]').forEach(t => t.onclick = () => { const kk = t.dataset.k; if (S.sortM === kk) S.dirM *= -1; else { S.sortM = kk; S.dirM = -1; } tablaClientes(); });
  $('cliBox').querySelectorAll('tr[data-id]').forEach(t => t.onclick = () => fichaCliente(+t.dataset.id));
}
function fichaCliente(id) {
  const c = CLI.get(id), e = EST.get(id), s = SAL.get(id);
  const mov = [...VEN.filter(x => x.id === id).map(x => [x.f, 'Compra', x.imp, x.cond]), ...COB.filter(x => x.id === id).map(x => [x.f, 'Pago', x.imp, x.medio])].sort((a, b) => a[0] < b[0] ? 1 : -1);
  const fin = DN(CORTE), ini = fin - 7 * 16 + 1, wk = Array.from({ length: 16 }, (_, k) => SD(ini + 7 * k));
  const ser = (L) => wk.map(w => L.filter(x => DN(x.f) >= DN(w) && DN(x.f) < DN(w) + 7).reduce((a, x) => a + x.imp, 0));
  abrir(`${c.cond}${e ? ' · ' + e.est : ''}`, c.nombre, e ? `Última compra el ${fdl(e.ult)}${e.intervalo ? ' · compra cada ' + nf(0).format(e.intervalo) + ' días' : ''}` : '', `
    <div class="kv"><div><span>Saldo</span><b>${s ? fmt.arsF(s.saldo) : 'Paga al contado'}</b></div><div><span>Debe desde</span><b>${s && s.desde ? fdl(s.desde) : '—'}</b></div>
      <div><span>Compra por mes</span><b>${e ? fmt.ars(e.mensual) : '—'}</b></div><div><span>Pagó de lo comprado (90 d)</span><b>${s && s.vendido_90 ? fmt.pct(s.cobrado_90 / s.vendido_90) : '—'}</b></div></div>
    <div><h4>Compras y pagos, últimas 16 semanas</h4><div class="chart short" id="chFicha"></div></div>
    <div><h4>Últimos movimientos</h4><div class="tw"><table><thead><tr><th>Fecha</th><th class="l">Qué</th><th>Importe</th><th class="l">Detalle</th></tr></thead><tbody>
      ${mov.slice(0, 14).map(m => `<tr><td>${fdl(m[0])}</td><td class="l">${m[1]}</td><td class="${m[1] === 'Pago' ? 'up' : ''}">${m[1] === 'Pago' ? MINUS : ''}${fmt.arsF(m[2])}</td><td class="l">${esc(m[3])}</td></tr>`).join('')}
    </tbody></table></div></div>`);
  chart('chFicha', { legend: Object.assign(leg(), { right: 0, left: 'auto' }), grid: { left: 54, right: 8, top: 28, bottom: 26 }, tooltip: { trigger: 'axis', valueFormatter: x => fmt.arsF(x) },
    xAxis: axC(wk.map(fd)), yAxis: axV(x => fmt.ars(x)),
    series: [{ name: 'Compras', type: 'bar', barMaxWidth: 10, data: ser(VEN.filter(x => x.id === id)), itemStyle: { color: cssv('--s1'), borderRadius: [3, 3, 0, 0] } },
      { name: 'Pagos', type: 'bar', barMaxWidth: 10, data: ser(COB.filter(x => x.id === id)), itemStyle: { color: cssv('--s2'), borderRadius: [3, 3, 0, 0] } }] });
}

/* ================================================================ DEL EXCEL AL FORMULARIO */
function renderExcel(v) {
  const Lp = DATA.limpieza;
  const dejaba = 1 - Lp.total_excel / Lp.total_real;
  v.innerHTML = `<p class="eyb">Qué cambió</p><ul class="know">
    <li><span>Hasta mayo, la caja de los dos locales y el fiado de los restaurantes se anotaban en <b>un Excel compartido</b>. Desde el 1 de junio, cada local carga el cierre en <b>un formulario desde el celular</b> y los pedidos y cobros de los restaurantes en otro.</span></li>
    <li><span>Las respuestas se controlan solas y se guardan en una base (Supabase). Este tablero y el resumen del lunes leen de ahí: nadie arma planillas.</span></li></ul>
  <div class="cards">
    <div class="card static"><div class="lbl">Problemas en el Excel</div><div class="v">${fmt.int(Lp.problemas)}</div><div class="cl">en 5 hojas de caja y la del fiado</div><p class="phrase">Cada uno queda anotado con lo que se hizo.</p></div>
    <div class="card static"><div class="lbl">La columna Total dejaba afuera ${chip('crit', 'Error')}</div><div class="v">${fmt.pct(dejaba)}</div><div class="cl">${fmt.ars(Lp.total_excel)} de ${fmt.ars(Lp.total_real)}</div><p class="phrase">La fórmula SUMA ignora los montos escritos como texto.</p></div>
    <div class="card static"><div class="lbl">Cierres recuperados</div><div class="v">${fmt.int(Lp.recuperados)} de ${fmt.int(Lp.cierres)}</div><div class="cl">${fmt.int(Lp.incompletos)} quedó incompleto («ver cuaderno»)</div><p class="phrase">Comparado contra lo que pasó de verdad.</p></div>
    <div class="card static"><div class="lbl">Saldos de fiado mal arrastrados</div><div class="v">${fmt.int(Lp.saldos_mal)}</div><div class="cl">${fmt.int(Lp.fiado_pedidos)} pedidos recuperados</div><p class="phrase">El saldo se recalcula desde los movimientos.</p></div>
  </div>
  <div class="vs"><div class="antes"><h4>Antes · Excel compartido</h4><ul>
    <li>Fechas escritas de cuatro formas («5/1», «05-01-25», «Jue 2/1») y locales escritos distinto («jardin», «B° Jardín»).</li>
    <li>Montos como texto («$ 35.160», «12.500,00», «4800.-») que la fórmula del total no sumaba.</li>
    <li>Filas de «TOTAL SEMANA» en medio de los datos y filas pegadas dos veces.</li>
    <li>Hasta marzo la billetera virtual se anotaba como transferencia.</li>
    <li>El fiado con el nombre del cliente escrito a mano y un saldo que se arrastraba a mano.</li>
    <li>Sin efectivo contado: no se sabía si la caja cuadraba ni quién cerró.</li></ul></div>
    <div class="ahora"><h4>Ahora · formulario + base</h4><ul>
    <li>Fecha con calendario, local, responsable y cliente de una lista: no se pueden escribir distinto.</li>
    <li>Montos solo números enteros, sin negativos; tickets 1 o más.</li>
    <li>Un cierre por local y día: la base rechaza el segundo.</li>
    <li>El efectivo contado es obligatorio y el arqueo se calcula solo.</li>
    <li>Mail al dueño si falta plata (más de $ 2.000), si el ticket promedio da raro o si a las 22:00 un local no cargó.</li>
    <li>La planilla de Google queda de respaldo: si la base no responde, se reintenta a la noche.</li></ul></div></div>
  <div class="grid">
    <section class="panel s6"><div class="ph"><div><h3>${tituloProblemas(Lp)}</h3><p>Problemas encontrados en el Excel, por tipo</p></div></div><div class="chart" id="chProb"></div></section>
    <section class="panel s6"><div class="ph"><div><h3>Algunos casos y qué se hizo</h3><p>Del registro de limpieza (problemas_excel.csv)</p></div></div>
      <div class="tw" style="max-height:290px;overflow:auto"><table><thead><tr><th>Problema</th><th class="l">Lo que decía</th><th class="l">Qué se hizo</th></tr></thead><tbody>
      ${Lp.ejemplos.map(x => `<tr><td class="wr" style="min-width:120px">${esc(x[0])}</td><td class="l wr" style="min-width:140px">${esc(x[1])}</td><td class="l wr" style="min-width:150px">${esc(x[2])}</td></tr>`).join('')}</tbody></table></div></section>
  </div>
  <h2 class="sec">Cómo viaja un cierre</h2>
  <div class="flowd">
    <div class="st"><em>1 · En el local</em><b>Formulario de Google</b><span>El responsable carga el cierre desde el celular. Validaciones: listas, números enteros, campos obligatorios.</span></div><span class="ar" aria-hidden="true">→</span>
    <div class="st"><em>2 · Respaldo</em><b>Planilla de respuestas</b><span>Cada envío queda en Google Sheets, aunque la base falle.</span></div><span class="ar" aria-hidden="true">→</span>
    <div class="st"><em>3 · Control</em><b>Apps Script</b><span>Calcula el arqueo, revisa el ticket promedio y avisa por mail si algo no cierra.</span></div><span class="ar" aria-hidden="true">→</span>
    <div class="st"><em>4 · Base</em><b>Supabase</b><span>PostgreSQL con reglas: un cierre por local y día, montos ≥ 0. Solo lectura para el tablero.</span></div><span class="ar" aria-hidden="true">→</span>
    <div class="st"><em>5 · Uso</em><b>Tablero y mail del lunes</b><span>Caja, ventas y a quién llamar, sin armar planillas.</span></div>
  </div>
  <h2 class="sec" id="demoTit">Probá el formulario</h2>
  <p class="note" style="margin:-4px 0 14px">Está precargado con el cierre que faltó del domingo 28/09 en el Jardín. Cambiá los números y mirá qué controla. No se guarda nada.</p>
  <div class="demo"><form class="phone" id="demoForm" novalidate>
    <div class="fh"><b>Cierre de caja · Pastas Don Aldo</b><span>Un envío por local y por día. * obligatorio</span></div>
    <div class="two"><label>Fecha del cierre *<input type="date" name="fecha" value="2025-09-28" max="2026-12-31"></label>
      <label>Local *<select name="local"><option>Centro</option><option selected>Jardín</option></select></label></div>
    <label>Responsable *<select name="resp"><option>Sofía</option><option>Marcos</option><option>Diego</option><option selected>Lucía</option></select></label>
    <div class="two"><label>Efectivo *<input inputmode="numeric" name="efe" value="512400"></label><label>Débito *<input inputmode="numeric" name="deb" value="98300"></label>
      <label>Crédito *<input inputmode="numeric" name="cre" value="41200"></label><label>Billetera *<input inputmode="numeric" name="bil" value="88600"></label></div>
    <div class="two"><label>Transferencia *<input inputmode="numeric" name="tra" value="27500"></label><label>Tickets *<input inputmode="numeric" name="tk" value="74"></label></div>
    <div class="two"><label>Gastos con la caja<input inputmode="numeric" name="gasto" value="14300"></label><label>Concepto<select name="conc"><option value="">—</option><option selected>Verdulería</option><option>Limpieza</option><option>Delivery</option><option>Envases</option><option>Otro</option></select></label></div>
    <div class="two"><label>Retiro del dueño<input inputmode="numeric" name="retiro" value="300000"></label><label>Efectivo contado *<input inputmode="numeric" name="cont" value="218100"></label></div>
    <button class="send" type="submit">Enviar</button>
  </form><div class="res" id="demoRes" aria-live="polite"></div></div>`;
  const t = Lp.tipos.slice().reverse();
  chart('chProb', { grid: { left: 8, right: 52, top: 8, bottom: 8, containLabel: true }, tooltip: { trigger: 'item', formatter: p => `${esc(p.name)}: ${fmt.int(p.value)}` },
    xAxis: { type: 'value', show: false }, yAxis: axC(t.map(x => x[0]), { axisLabel: { color: cssv('--ink-2'), width: 210, overflow: 'truncate' } }),
    series: [{ type: 'bar', barMaxWidth: 16, data: t.map(x => x[1]), itemStyle: { color: cssv('--s1'), borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: cssv('--ink-2'), formatter: p => fmt.int(p.value) } }] });
  const f = $('demoForm');
  f.oninput = () => demo(false); f.onsubmit = e => { e.preventDefault(); demo(true); };
  demo(false);
}
function tituloProblemas(Lp) {
  const [a, n] = Lp.tipos[0];
  return `El ${fmt.pct(n / Lp.problemas)} de los problemas son «${a.toLowerCase()}»`;
}
function demo(enviar) {
  const f = $('demoForm'), g = n => f.elements[n].value.trim();
  const num = ['efe', 'deb', 'cre', 'bil', 'tra', 'tk', 'gasto', 'retiro', 'cont'], req = ['efe', 'deb', 'cre', 'bil', 'tra', 'tk', 'cont'];
  const val = {}, err = {};
  for (const k of num) {
    const s = g(k).replace(/\./g, '');
    if (s === '') { if (req.includes(k)) err[k] = 'Obligatorio.'; val[k] = 0; continue; }
    if (!/^\d+$/.test(s)) { err[k] = 'Solo números enteros, sin $ ni comas.'; val[k] = 0; continue; }
    val[k] = +s;
  }
  if (!err.tk && val.tk < 1) err.tk = 'Tiene que ser 1 o más.';
  f.querySelectorAll('label').forEach(l => { l.classList.remove('bad'); l.querySelector('.msg')?.remove(); });
  for (const [k, m] of Object.entries(err)) { const l = f.elements[k].closest('label'); l.classList.add('bad'); l.insertAdjacentHTML('beforeend', `<span class="msg">${m}</span>`); }
  const fecha = g('fecha'), local = g('local');
  const venta = val.efe + val.deb + val.cre + val.bil + val.tra, esp = 20000 + val.efe - val.gasto - val.retiro, dif = val.cont - esp;
  const avisos = [];
  if (fecha > CORTE) avisos.push(`La fecha es posterior a hoy (${fdl(CORTE)}).`);
  const tick = venta / Math.max(val.tk, 1);
  if (tick < 2000 || tick > 60000) avisos.push(`El ticket promedio da ${fmt.arsF(tick)}: revisar la cantidad de tickets.`);
  if (dif < -2000) avisos.push(`Faltan ${fmt.arsF(-dif)} en la caja.`);
  if (val.gasto > 0 && !g('conc')) avisos.push('Hay un gasto sin concepto.');
  const dup = CIX.has(fecha + '|' + local);
  const estadoC = Math.abs(dif) <= TOL ? ['good', 'Cuadra'] : dif < 0 ? ['crit', 'Faltante'] : ['warn', 'Sobrante'];
  let res;
  if (Object.keys(err).length) res = `<p class="err">El formulario no deja enviar: ${Object.keys(err).length} ${Object.keys(err).length > 1 ? 'campos con error' : 'campo con error'}.</p>`;
  else if (!enviar) res = `<p class="note" style="margin:10px 0 0">Tocá <b>Enviar</b> para ver qué pasa con el cierre.</p>`;
  else if (dup) res = `<ul><li><b>No se guarda:</b> ya hay un cierre del ${local} el ${fdl(fecha)} (la base acepta uno por local y día).</li><li>Queda en la planilla como «pendiente de subir» y le llega un mail al dueño.</li></ul>`;
  else res = `<ul><li><b>Se guarda</b> en la base y aparece en el tablero.</li>${avisos.length ? `<li><b>Mail al dueño</b> «Cierre ${local} ${fd(fecha)} · revisar»:<ul>${avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></li>` : '<li>Todo en orden: no se manda ningún mail.</li>'}</ul>`;
  $('demoRes').innerHTML = `<h4>Arqueo que hace el script</h4><div class="arq">
    <span>Fondo de caja</span><b>${fmt.arsF(20000)}</b><span>+ Ventas en efectivo</span><b>${fmt.arsF(val.efe)}</b><span>− Gastos con la caja</span><b>${fmt.arsF(-val.gasto)}</b><span>− Retiro del dueño</span><b>${fmt.arsF(-val.retiro)}</b>
    <span class="tt">Efectivo esperado</span><b class="tt">${fmt.arsF(esp)}</b><span>Efectivo contado</span><b>${fmt.arsF(val.cont)}</b><span class="tt">Diferencia</span><b class="tt">${fmt.sgn(dif)} ${chip(...estadoC)}</b>
    <span>Venta del día</span><b>${fmt.arsF(venta)}</b><span>Ticket promedio</span><b>${fmt.arsF(tick)}</b></div>${dup && !enviar ? `<p class="note">Ojo: ya hay un cierre del ${local} el ${fdl(fecha)}.</p>` : ''}${res}`;
}

/* ================================================================ INFORMES */
function renderInf(v) {
  v.innerHTML = `<p class="eyb">Informes y descargas</p><div class="rep">
    <div><h5>Resumen del lunes</h5><p>El mail que le llega al dueño cada lunes a las 8:00: venta de la semana, cómo cerró la caja y a qué restaurantes llamar.</p><a class="btn primary" href="../04_informes/resumen-semanal.html">Ver el resumen</a></div>
    <div><h5>Cierres del mes en Excel</h5><p>Los cierres del mes y local elegidos, con el arqueo de cada día.</p><button class="btn" id="btnCsv2" type="button">Bajar a Excel (CSV)</button></div>
    <div><h5>Base completa</h5><p>Cierres, pedidos y cobros unificados (Excel limpio + formulario), el registro de limpieza y el arqueo y el fiado recalculados con fórmulas.</p><a class="btn" href="../01_datos/Base-pastas-don-aldo.xlsx">Bajar la base</a></div>
    <div><h5>Formularios, Apps Script y Supabase</h5><p>El script que crea los formularios, el que controla y guarda cada envío, y el esquema y las vistas de la base.</p><a class="btn" href="https://github.com/MatiasGarnica/portfolio-control-gestion/tree/main/caso-04-pyme-sin-sistema">Ver en GitHub</a></div>
  </div>`;
  $('btnCsv2').onclick = () => { const L = CI.filter(c => c.mes === S.mes && enLoc(c)); csv(`cierres_${S.mes}${S.loc ? '_' + S.loc : ''}.csv`, ['Fecha', 'Local', 'Responsable', 'Venta', 'Efectivo esperado', 'Efectivo contado', 'Diferencia', 'Caja'], L.map(c => [c.fecha, c.local, c.resp || '', c.venta, c.esp ?? '', c.cont ?? '', c.dif ?? '', c.est || ''])); };
}
function csv(nombre, head, rows) {
  const txt = '﻿' + [head, ...rows].map(l => l.map(x => { const t = String(x); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove(); toast(`Se descargó ${nombre} (${rows.length} filas)`);
}

/* ================================================================ recorrido */
const TOUR = [
  ['caja', '#selMes', 'Elegí el mes. Las tarjetas comparan contra el mes anterior.'],
  ['caja', '#selLoc', 'Mirá un local o los dos juntos.'],
  ['caja', '#hoyBox', 'El último cierre de cada local: venta, tickets y si la caja cuadró. Tocalo para ver el arqueo.'],
  ['caja', '#cardsBox', 'Los números del mes. Tocá una tarjeta para ir al detalle.'],
  ['caja', '#calBox', 'Cada día desde que existe el formulario: verde cuadra, rojo falta plata, rayado no se cargó.'],
  ['may', '#chFiado', 'Cuánto debe cada restaurante. A la izquierda, a quién llamar esta semana y por qué.'],
  ['excel', '#demoTit', 'Cómo se pasó del Excel al formulario, y un formulario de prueba para ver los controles.'],
];
let tourI = 0;
function tour(i) {
  tourI = Math.max(0, Math.min(TOUR.length - 1, i));
  const [tab, sel, txt] = TOUR[tourI];
  if (S.tab !== tab) { S.tab = tab; render(); }
  const el = document.querySelector(sel); if (!el) return endTour();
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect(), sx = scrollX, sy = scrollY;
  $('tourLayer').hidden = false;
  Object.assign($('tourSpot').style, { left: r.left + sx - 6 + 'px', top: r.top + sy - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
  $('tourN').textContent = `Paso ${tourI + 1} de ${TOUR.length}`; $('tourTxt').textContent = txt;
  const tip = $('tourTip'), below = r.bottom + 190 < innerHeight;
  tip.style.left = Math.max(12, Math.min(r.left + sx, sx + innerWidth - tip.offsetWidth - 12)) + 'px';
  tip.style.top = (below ? r.bottom + sy + 14 : Math.max(sy + 12, r.top + sy - tip.offsetHeight - 14)) + 'px';
  $('tourPrev').disabled = tourI === 0; $('tourNext').textContent = tourI === TOUR.length - 1 ? 'Terminar' : 'Siguiente'; $('tourNext').focus();
}
const endTour = () => { $('tourLayer').hidden = true; $('btnTour').focus(); };

/* ================================================================ render */
const TABS = { caja: renderCaja, ventas: renderVentas, may: renderMay, excel: renderExcel, inf: renderInf };
function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2800); }
function render() {
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)));
  Object.keys(CH).forEach(k => { if (k !== 'chFicha') { CH[k].dispose(); delete CH[k]; } });
  TABS[S.tab]($('view'));
  bindChips();
}
initHeader();
$('dClose').onclick = cerrar; $('scrim').onclick = cerrar;
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('drawer').hidden) cerrar(); else if (!$('tourLayer').hidden) endTour(); } });
$('btnTour').onclick = () => tour(0);
$('tourNext').onclick = () => tourI === TOUR.length - 1 ? endTour() : tour(tourI + 1);
$('tourPrev').onclick = () => tour(tourI - 1);
$('tourEnd').onclick = endTour;
addEventListener('hashchange', () => { const h = location.hash.slice(1); if (TABS[h] && h !== S.tab) { S.tab = h; render(); } });
render();
