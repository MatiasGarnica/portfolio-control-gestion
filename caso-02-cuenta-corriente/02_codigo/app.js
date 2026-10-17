/* Caso 02 · Cuenta corriente · Reparto Federal S.A. (datos ficticios)
   La hoja se arma en el navegador con los mismos criterios que hoja.py, así los parámetros se cambian en vivo. */
'use strict';
const DATA = JSON.parse(document.getElementById('data').textContent);
const $ = id => document.getElementById(id);
const C = Object.fromEntries(DATA.cols.map((c, i) => [c, i]));
const SEM = DATA.meta.semanas;
const FOCO = ['Deuda vencida', 'Sin visita del reparto', 'Ritmo de pago atrasado', 'NC fuera de lo normal'];
const FOCO_C = ['deuda vencida', 'sin visita del reparto', 'ritmo de pago atrasado', 'NC fuera de lo normal'];
const EST = ['Resuelta', 'En parte', 'Pendiente', 'Salió sola'];
const EST_CLS = ['good', 'warn', 'crit', 'neu'];
const EST_VAR = ['--good', '--warn', '--crit', '--neutral'];
const DEF = { dias: 45, piso: 15000, factor: 2, sin_visita: 14, piso_nc: 20000, pct_nc: 0.5, objetivo: 0.45, dc_obj: 6 };
const MES_N = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/* ---------- formato es-AR ---------- */
const _nf = {};
const nf = d => (_nf[d] ??= new Intl.NumberFormat('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const CMP = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });
const MINUS = '−';
const fmt = {
  int: v => nf(0).format(v),
  ars: v => (v < 0 ? MINUS : '') + '$\u00a0' + (Math.abs(v) >= 1e4 ? CMP.format(Math.abs(v)) : nf(0).format(Math.abs(Math.round(v)))),
  arsF: v => (v < -0.5 ? MINUS : '') + '$\u00a0' + nf(0).format(Math.abs(Math.round(v))),
  pct: (r, signed = false) => { const x = Math.round(r * 1000) / 10; if (x === 0) return '0%'; const s = nf(Math.abs(x) >= 100 ? 0 : 1).format(Math.abs(x)) + '%'; return signed ? (x > 0 ? '+' : MINUS) + s : (x < 0 ? MINUS : '') + s; },
  pp: d => { const x = Math.round(d * 1000) / 10; return x === 0 ? '0 pp' : (x > 0 ? '+' : MINUS) + nf(1).format(Math.abs(x)) + ' pp'; },
  dias: v => nf(1).format(v) + ' días',
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fd = s => { const [y, m, d] = s.split('-'); return `${d}/${m}`; };
const fdl = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const mesLbl = k => { const [y, m] = k.split('-'); return MES_N[+m - 1] + '-' + y.slice(2); };
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
};

/* ---------- maestros ---------- */
const SUC = Object.fromEntries(DATA.suc.map(s => [s[0], { nom: s[1], lat: s[2], lng: s[3] }]));
const SUP = Object.fromEntries(DATA.sup.map(s => [s[0], { nom: s[1], suc: s[2] }]));
const REP = Object.fromEntries(DATA.rep.map(r => [r[0], { sup: r[1], suc: r[2] }]));
const CLI = DATA.cli.map(c => ({ id: c[0], nom: c[1], tipo: c[2], rep: c[3], cond: c[4], medio: c[5], lat: c[6], lng: c[7], sup: REP[c[3]].sup, suc: REP[c[3]].suc }));
const N = CLI.length;

/* ---------- estado ---------- */
const S = { tab: 'hoja', w: SEM.length - 1, suc: '', sup: '', foco: -1, est: -1, nuevas: false, q: '', sort: 'vd', dir: -1, page: 50,
  mes: DATA.meta.meses[DATA.meta.meses.length - 2], ncK: 2, ncPiso: 50000, open: {} };
let P = Object.assign({}, DEF, store.get('rf_params', {}));

/* ---------- motor de la hoja (mismo criterio que hoja.py) ---------- */
const CACHE = new Map();
function armar(w, p = P) {
  const key = w + JSON.stringify(p);
  if (CACHE.has(key)) return CACHE.get(key);
  const F = DATA.f[w], k = DATA.meta.umbrales.indexOf(p.dias);
  const vk = ['v30', 'v45', 'v60', 'v90'][k], ek = ['e_v30', 'e_v45', 'e_v60', 'e_v90'][k];
  const foco = new Int8Array(N), est = new Int8Array(N), nueva = new Uint8Array(N), vd = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const r = F[i];
    const v = r[C[vk]], saldo = r[C.saldo], dup = r[C.dup], imed = r[C.imed], duv = r[C.duv];
    const nc30 = r[C.nc30], fac6 = r[C.fac6];
    vd[i] = v;
    let f = -1;
    if (v >= p.piso) f = 0;
    else if (saldo >= p.piso && (duv > p.sin_visita || duv < 0)) f = 1;
    else if (imed > 0 && dup > Math.max(p.factor * imed, 14) && saldo >= p.piso) f = 2;
    else if (nc30 >= p.piso_nc && nc30 > p.pct_nc * fac6) f = 3;
    foco[i] = f;
    const pag = r[C.pag], vis = r[C.vis];
    let e = 2;
    if (f === 0) { if (pag >= v) e = 0; else if (pag > 0) e = 1; else if (r[C[ek]] < p.piso) e = 3; }
    else if (f === 1) { if (vis && pag > 0) e = 0; else if (vis) e = 1; else if (r[C.e_saldo] < p.piso) e = 3; }
    else if (f === 2) { if (pag >= 0.8 * r[C.pmed]) e = 0; else if (pag > 0) e = 1; }
    else if (f === 3) { if (r[C.rev]) e = 0; }
    else e = -1;
    est[i] = e;
    if (f < 0) {
      const es = r[C.e_saldo];
      nueva[i] = (r[C[ek]] >= p.piso) || (imed > 0 && r[C.e_dup] > Math.max(p.factor * imed, 14) && es >= p.piso)
        || (es >= p.piso && (r[C.e_duv] > p.sin_visita || r[C.e_duv] < 0)) || (r[C.e_nc30] >= p.piso_nc && r[C.e_nc30] > p.pct_nc * fac6) ? 1 : 0;
    }
  }
  const out = { foco, est, nueva, vd };
  CACHE.set(key, out);
  return out;
}
const enFiltro = i => (!S.suc || CLI[i].suc === S.suc) && (!S.sup || CLI[i].sup === S.sup);
function resumen(w) {
  const R = armar(w), F = DATA.f[w];
  const o = { n: 0, est: [0, 0, 0, 0], foco: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]], cob: [0, 0, 0, 0], nuevas: 0, cobrado: 0, sup: {} };
  for (let i = 0; i < N; i++) {
    if (!enFiltro(i)) continue;
    if (R.nueva[i]) o.nuevas++;
    const f = R.foco[i];
    if (f < 0) continue;
    const e = R.est[i], pag = F[i][C.pag];
    o.n++; o.est[e]++; o.foco[f][e]++; o.foco[f][4]++; o.cobrado += pag; o.cob[f] += pag;
    const s = CLI[i].sup;
    const q = (o.sup[s] ??= { n: 0, est: [0, 0, 0, 0], cob: 0 });
    q.n++; q.est[e]++; q.cob += pag;
  }
  o.res = o.n ? (o.est[0] + o.est[1]) / o.n : 0;
  return o;
}
const conRes = o => o.n ? (o.est[0] + o.est[1]) / o.n : 0;

/* ---------- semáforo ---------- */
function estado(valor, meta, menosEsMejor = false) {
  const r = menosEsMejor ? meta / Math.max(valor, 1e-9) : valor / meta;
  if (r >= 1) return ['good', 'En línea'];
  if (r >= 0.9) return ['warn', 'Atención'];
  return ['crit', 'Desvío'];
}
const chipEst = (c, t) => `<span class="status ${c}"><i></i>${esc(t)}</span>`;
const varTxt = (d, menosEsMejor, fmtF) => {
  if (d === null || !isFinite(d)) return '<span class="flat">s/d</span>';
  const bueno = menosEsMejor ? d < 0 : d > 0;
  const cls = Math.abs(d) < 1e-9 ? 'flat' : bueno ? 'up' : 'dn';
  const flecha = d > 0 ? '▲' : d < 0 ? '▼' : '';
  return `<b class="${cls}">${flecha} ${fmtF(d)}</b>`;
};

/* ---------- gráficos ---------- */
const CH = {};
function chart(id, opt) {
  const el = $(id); if (!el) return;
  if (!window.echarts) { el.innerHTML = '<p class="err">No se pudo cargar la librería de gráficos. Los números y las tablas están completos.</p>'; return; }
  CH[id]?.dispose();
  const ch = echarts.init(el, null, { renderer: 'svg' });
  const base = { textStyle: { fontFamily: cssv('--f') || 'IBM Plex Sans', color: cssv('--ink-2') }, animationDuration: 250,
    tooltip: { backgroundColor: cssv('--surface'), borderColor: cssv('--line'), textStyle: { color: cssv('--ink') } } };
  ch.setOption(Object.assign(base, opt));
  CH[id] = ch;
}
const axisCat = (data, extra = {}) => Object.assign({ type: 'category', data, axisLine: { lineStyle: { color: cssv('--line-strong') } }, axisTick: { show: false }, axisLabel: { color: cssv('--ink-3') } }, extra);
const axisVal = (fmtF, extra = {}) => Object.assign({ type: 'value', splitLine: { lineStyle: { color: cssv('--grid') } }, axisLabel: { color: cssv('--ink-3'), formatter: fmtF } }, extra);
window.addEventListener('resize', () => Object.values(CH).forEach(c => c.resize()));

/* ---------- encabezado y filtros ---------- */
function initHeader() {
  $('selSem').innerHTML = SEM.map((s, i) => `<option value="${i}">Sem ${s.sem} · ${fd(s.lunes)}${s.en_curso ? ' · en curso' : ''}</option>`).join('');
  $('selSem').value = S.w;
  $('selSem').onchange = e => { S.w = +e.target.value; S.page = 50; render(); };
  $('selSuc').innerHTML = '<option value="">Todas</option>' + Object.entries(SUC).map(([k, s]) => `<option value="${k}">${esc(s.nom)}</option>`).join('');
  $('selSuc').onchange = e => { S.suc = e.target.value; S.sup = ''; fillSup(); render(); };
  fillSup();
  $('selSup').onchange = e => { S.sup = e.target.value; render(); };
  const t = store.get('rf_theme', null);
  if (t) document.documentElement.setAttribute('data-theme', t);
  themeBtn();
  $('btnTheme').onclick = () => {
    const dark = isDark();
    document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
    store.set('rf_theme', dark ? 'light' : 'dark'); themeBtn(); render();
  };
  $('tabList').querySelectorAll('.tab').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; location.hash = S.tab; render(); window.scrollTo({ top: 0 }); });
  const h = location.hash.slice(1); if (['hoja', 'calle', 'nc', 'param', 'inf'].includes(h)) S.tab = h;
}
const isDark = () => { const a = document.documentElement.getAttribute('data-theme'); return a ? a === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
const themeBtn = () => { $('btnTheme').textContent = isDark() ? 'Modo claro' : 'Modo oscuro'; };
function fillSup() {
  const ops = Object.entries(SUP).filter(([k, s]) => !S.suc || s.suc === S.suc);
  $('selSup').innerHTML = '<option value="">Todos</option>' + ops.map(([k, s]) => `<option value="${k}">${esc(s.nom)} · ${esc(SUC[s.suc].nom)}</option>`).join('');
  $('selSup').value = S.sup;
}
function stamp() {
  const s = SEM[S.w];
  const fin = s.en_curso ? `datos al ${fdl(DATA.meta.corte)} ${DATA.meta.hora}` : `semana cerrada`;
  $('stamp').textContent = `Semana ${s.sem} · lunes ${fd(s.lunes)} al sábado ${fd(addDays(s.lunes, 5))} · ${fin}`;
}
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
function chipsFiltro() {
  const ch = [];
  if (S.suc) ch.push(`<span class="chip">Sucursal <b>${esc(SUC[S.suc].nom)}</b><button aria-label="Quitar sucursal" data-x="suc">×</button></span>`);
  if (S.sup) ch.push(`<span class="chip">Supervisor <b>${esc(SUP[S.sup].nom)}</b><button aria-label="Quitar supervisor" data-x="sup">×</button></span>`);
  if (S.tab === 'hoja') {
    if (S.foco >= 0) ch.push(`<span class="chip">Foco <b>${FOCO[S.foco]}</b><button aria-label="Quitar foco" data-x="foco">×</button></span>`);
    if (S.est >= 0) ch.push(`<span class="chip">Estado <b>${EST[S.est]}</b><button aria-label="Quitar estado" data-x="est">×</button></span>`);
    if (S.nuevas) ch.push(`<span class="chip"><b>Nuevas de la semana</b><button aria-label="Quitar nuevas" data-x="nuevas">×</button></span>`);
  }
  const editados = Object.keys(DEF).filter(k => P[k] !== DEF[k]);
  if (editados.length) ch.push(`<span class="chip">Parámetros propios <b>${editados.length}</b><button aria-label="Volver a los parámetros acordados" data-x="param">×</button></span>`);
  return `<div class="chips">${ch.length ? 'Filtros: ' + ch.join('') + ' <button class="link" data-x="all">Limpiar</button>' : '<span>Sin filtros: toda la empresa.</span>'}</div>`;
}
function bindChips() {
  document.querySelectorAll('[data-x]').forEach(b => b.onclick = () => {
    const x = b.dataset.x;
    if (x === 'suc') { S.suc = ''; S.sup = ''; fillSup(); $('selSuc').value = ''; }
    if (x === 'sup') { S.sup = ''; $('selSup').value = ''; }
    if (x === 'foco') S.foco = -1;
    if (x === 'est') S.est = -1;
    if (x === 'nuevas') S.nuevas = false;
    if (x === 'param') { P = Object.assign({}, DEF); store.set('rf_params', {}); CACHE.clear(); }
    if (x === 'all') { S.suc = ''; S.sup = ''; S.foco = -1; S.est = -1; S.nuevas = false; S.q = ''; fillSup(); $('selSuc').value = ''; }
    render();
  });
}

/* ================================================================ HOJA DE LA SEMANA */
function renderHoja(v) {
  const w = S.w, s = SEM[w], o = resumen(w), prev = w > 0 ? resumen(w - 1) : null;
  const tr = SEM.map((_, i) => resumen(i));
  const obj = P.objetivo;
  // lo que hay que saber
  const know = [];
  const verbo = s.en_curso ? 'Van' : 'Terminaron';
  know.push(`${verbo} <b>${fmt.int(o.est[0] + o.est[1])} de ${fmt.int(o.n)} cuentas</b> con resultado (${fmt.pct(o.res)})` +
    (prev ? `, ${s.en_curso ? `y la semana pasada cerró en ${fmt.pct(prev.res)}` : `<b>${fmt.pp(o.res - prev.res).replace('pp', 'puntos')}</b> contra la semana anterior`}` : '') + '.');
  const fx = [0, 1, 2, 3].filter(f => o.foco[f][4] >= 5).sort((a, b) => conRes2(o.foco[a]) - conRes2(o.foco[b]))[0];
  if (fx !== undefined) know.push(`El foco más atrasado es <b>${FOCO_C[fx]}</b> (${fmt.pct(conRes2(o.foco[fx]))}): quedan ${fmt.int(o.foco[fx][2])} pendientes.`);
  const sups = Object.entries(o.sup).sort((a, b) => b[1].est[2] - a[1].est[2] || conRes(a[1]) - conRes(b[1]));
  if (sups.length > 1 && o.est[2]) { const [k, q] = sups[0]; know.push(`<b>${esc(SUC[SUP[k].suc].nom)} · ${esc(SUP[k].nom)}</b> concentra ${fmt.int(q.est[2])} de los ${fmt.int(o.est[2])} pendientes (${fmt.pct(q.est[2] / o.est[2])}) y su hoja va ${fmt.pct(conRes(q))}: es el supervisor a mirar.`); }
  const [sc, st] = s.en_curso ? ['neu', 'En curso'] : estado(o.res, obj);
  const dN = prev && prev.n ? (o.n - prev.n) / prev.n : null;
  const dCob = prev && prev.cobrado ? (o.cobrado - prev.cobrado) / prev.cobrado : null;
  v.innerHTML = chipsFiltro() + `
  <p class="eyb">Lo que hay que saber</p><ul class="know">${know.map(k => `<li><span>${k}</span></li>`).join('')}</ul>
  <div class="cards" id="cardsBox">
    <button class="card" data-c="all"><div class="lbl">Cuentas en la hoja del lunes</div><div class="v">${fmt.int(o.n)}</div>
      <div class="cl">${varTxt(dN, true, x => fmt.pct(x, true))} vs la semana anterior (${prev ? fmt.int(prev.n) : 's/d'})</div>
      <p class="phrase">Cuentas con un problema abierto al empezar la semana. Menos es mejor.</p><span class="go">Ver la lista →</span></button>
    <button class="card" data-c="res"><div class="lbl">Con resultado ${chipEst(sc, st)}</div><div class="v">${fmt.int(o.est[0] + o.est[1])} · ${fmt.pct(o.res)}</div>
      <div class="cl">${!prev ? '' : s.en_curso ? `La semana pasada cerró en <b>${fmt.pct(prev.res)}</b>` : `<b class="${o.res >= prev.res ? 'up' : 'dn'}">${fmt.pp(o.res - prev.res)}</b> vs la semana anterior`}</div>
      <p class="phrase">${s.en_curso ? 'Semana en curso: el número sube hasta el sábado. ' : ''}Objetivo al cierre: ${fmt.pct(obj)}.</p><span class="go">Ver por foco →</span></button>
    <button class="card" data-c="cob"><div class="lbl">Cobrado de la hoja</div><div class="v">${fmt.ars(o.cobrado)}</div>
      <div class="cl">${s.en_curso ? `La semana pasada se cobraron <b>${prev ? fmt.ars(prev.cobrado) : 's/d'}</b>` : varTxt(dCob, false, x => fmt.pct(x, true)) + ' vs la semana anterior'}</div>
      <p class="phrase">${fmt.ars(o.cob[0])} vinieron de cuentas con deuda vencida a más de ${P.dias} días.</p><span class="go">Ver los pagos →</span></button>
    <button class="card" data-c="pend"><div class="lbl">Pendientes</div><div class="v">${fmt.int(o.est[2])}</div>
      <div class="cl">${fmt.pct(o.n ? o.est[2] / o.n : 0)} de la hoja</div>
      <p class="phrase">Si no se resuelven, pasan a la hoja del lunes siguiente.</p><span class="go">Ver lo que falta →</span></button>
    <button class="card" data-c="nue"><div class="lbl">Nuevas en la semana</div><div class="v">${fmt.int(o.nuevas)}</div>
      <div class="cl">No estaban el lunes y hoy cumplen alguna condición</div>
      <p class="phrase">No cuentan en la resolución: entran a la hoja del lunes que viene.</p><span class="go">Ver las nuevas →</span></button>
  </div>
  <div class="grid">
    <section class="panel s7" id="flowPanel">
      <div class="ph"><div><h3>De las ${fmt.int(o.n)} cuentas del lunes, ${fmt.int(o.est[0] + o.est[1] + o.est[3])} ya no están pendientes</h3><p>Estado de cada cuenta de la hoja ${s.en_curso ? `al ${fdl(DATA.meta.corte)} ${DATA.meta.hora}` : 'al cierre del sábado'} · tocá un tramo para filtrar</p></div></div>
      ${flowBar(o)}
      <h4 style="font:700 14px/1.3 var(--f);margin:20px 0 10px">Por foco</h4>
      <div class="tw"><table><thead><tr><th>Foco</th><th>Cuentas</th><th>Con resultado</th><th>%</th><th class="l hide-m">Contra ${fmt.pct(obj)}</th><th>Cobrado</th></tr></thead><tbody>
      ${[0, 1, 2, 3].map(f => { const q = o.foco[f], r = conRes2(q); return `<tr class="click" data-f="${f}"><td>${FOCO[f]}</td><td>${fmt.int(q[4])}</td><td>${fmt.int(q[0] + q[1])}</td><td>${q[4] ? fmt.pct(r) : '—'}</td><td class="l hide-m">${miniBar(r, obj)}</td><td>${fmt.ars(o.cob[f])}</td></tr>`; }).join('')}
      <tr class="tot"><td>Total</td><td>${fmt.int(o.n)}</td><td>${fmt.int(o.est[0] + o.est[1])}</td><td>${fmt.pct(o.res)}</td><td class="l hide-m">${miniBar(o.res, obj)}</td><td>${fmt.ars(o.cobrado)}</td></tr>
      </tbody></table></div>
    </section>
    <section class="panel s5">
      <div class="ph"><div><h3>${tituloTendencia(tr, obj)}</h3><p>% de cuentas con resultado al cierre de cada semana</p></div></div>
      <div class="chart short" id="chTrend"></div>
      <div class="ph" style="margin:14px 0 4px"><div><h3 style="font-size:15px">${tituloHoja(tr)}</h3><p>Cuentas en la hoja de cada lunes</p></div></div>
      <div class="chart short" id="chHoja"></div>
    </section>
  </div>
  <div class="grid">
    <section class="panel s7">
      <div class="ph"><div><h3>Por supervisor</h3><p>Tocá una fila para ver solo su hoja</p></div></div>
      <div class="tw"><table><thead><tr><th>Supervisor</th><th class="l">Sucursal</th><th>Cuentas</th><th>Con resultado</th><th class="l">Estado</th><th>Pendientes</th><th>Cobrado</th></tr></thead><tbody>
      ${Object.entries(o.sup).sort((a, b) => conRes(b[1]) - conRes(a[1])).map(([k, q]) => { const r = conRes(q), [c2, t2] = estado(r, obj); return `<tr class="click" data-s="${k}"><td>${esc(SUP[k].nom)}</td><td class="l">${esc(SUC[SUP[k].suc].nom)}</td><td>${fmt.int(q.n)}</td><td>${fmt.pct(r)}</td><td class="l">${chipEst(c2, t2)}</td><td>${fmt.int(q.est[2])}</td><td>${fmt.ars(q.cob)}</td></tr>`; }).join('') || '<tr><td colspan="7" class="l muted">Sin cuentas para este filtro.</td></tr>'}
      </tbody></table></div>
    </section>
    <section class="panel s5">
      <div class="ph"><div><h3>Dónde están las pendientes</h3><p>Cada punto es una cuenta de la hoja; los triángulos son las sucursales</p></div></div>
      <div class="chart" id="chMapa"></div>
    </section>
  </div>
  <section class="panel s12" id="casosPanel"></section>`;
  // gráficos
  const labels = SEM.map(x => 'Sem ' + x.sem);
  const rates = tr.map(x => x.n ? +(x.res * 100).toFixed(1) : null);
  chart('chTrend', {
    grid: { left: 44, right: 16, top: 16, bottom: 28 },
    tooltip: { trigger: 'axis', valueFormatter: v => v == null ? 's/d' : nf(1).format(v) + '%' },
    xAxis: axisCat(labels), yAxis: axisVal(v => v + '%', { min: v => Math.max(0, Math.floor(v.min / 10) * 10 - 10), max: v => Math.min(100, Math.ceil(Math.max(v.max, obj * 100) / 10) * 10) }),
    series: [{ name: 'Con resultado', type: 'line', data: rates.map((r, i) => ({ value: r, symbol: SEM[i].en_curso ? 'emptyCircle' : 'circle' })), symbolSize: 8, lineStyle: { width: 2, color: cssv('--real') }, itemStyle: { color: cssv('--real'), borderColor: cssv('--surface'), borderWidth: 2 },
      markLine: { symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: cssv('--ink-3') }, label: { formatter: 'Objetivo ' + fmt.pct(obj), color: cssv('--ink-3'), position: 'insideStartTop' }, data: [{ yAxis: obj * 100 }] } }],
  });
  chart('chHoja', {
    grid: { left: 44, right: 16, top: 16, bottom: 28 },
    tooltip: { trigger: 'axis', valueFormatter: v => fmt.int(v) + ' cuentas' },
    xAxis: axisCat(labels), yAxis: axisVal(v => fmt.int(v)),
    series: [{ name: 'Cuentas en la hoja', type: 'bar', barMaxWidth: 22, data: tr.map(x => x.n), itemStyle: { color: cssv('--real'), borderRadius: [4, 4, 0, 0] } }],
  });
  mapa(w);
  // interacción
  v.querySelectorAll('#cardsBox .card').forEach(b => b.onclick = () => {
    const c = b.dataset.c;
    S.foco = -1; S.est = -1; S.nuevas = false;
    if (c === 'pend') S.est = 2;
    if (c === 'nue') S.nuevas = true;
    if (c === 'res') { document.getElementById('flowPanel').scrollIntoView({ behavior: 'smooth' }); return; }
    if (c === 'cob') S.sort = 'pag';
    S.page = 50; casos(); bindChips(); $('casosPanel').scrollIntoView({ behavior: 'smooth' });
  });
  v.querySelectorAll('tr[data-f]').forEach(t => t.onclick = () => { S.foco = +t.dataset.f; S.est = -1; S.nuevas = false; S.page = 50; render(); $('casosPanel').scrollIntoView({ behavior: 'smooth' }); });
  v.querySelectorAll('tr[data-s]').forEach(t => t.onclick = () => { S.sup = t.dataset.s; S.suc = SUP[S.sup].suc; $('selSuc').value = S.suc; fillSup(); render(); });
  v.querySelectorAll('.flow div[data-e]').forEach(t => t.onclick = () => { S.est = +t.dataset.e; S.nuevas = false; S.page = 50; casos(); bindChips(); $('casosPanel').scrollIntoView({ behavior: 'smooth' }); });
  casos();
}
const conRes2 = q => q[4] ? (q[0] + q[1]) / q[4] : 0;
function tituloTendencia(tr, obj) {
  const cerr = tr.filter((x, i) => !SEM[i].en_curso && x.n);
  let k = 0; for (let i = cerr.length - 1; i >= 0 && cerr[i].res >= obj; i--) k++;
  if (k >= 2) return `Cierra arriba del objetivo hace ${k} semanas`;
  const a = cerr.slice(0, 3), b = cerr.slice(-3);
  const ma = a.reduce((s, x) => s + x.res, 0) / Math.max(a.length, 1), mb = b.reduce((s, x) => s + x.res, 0) / Math.max(b.length, 1);
  return mb > ma + 0.02 ? `La resolución subió de ${fmt.pct(ma)} a ${fmt.pct(mb)} en promedio` : mb < ma - 0.02 ? `La resolución bajó de ${fmt.pct(ma)} a ${fmt.pct(mb)} en promedio` : 'La resolución se mantiene estable';
}
function tituloHoja(tr) {
  const a = tr[0].n, b = tr[tr.length - 1].n;
  if (!a) return 'Cuentas en la hoja';
  const d = (b - a) / a;
  return d < -0.1 ? `La hoja se achicó ${fmt.pct(-d)} desde la semana ${SEM[0].sem}` : d > 0.1 ? `La hoja creció ${fmt.pct(d)} desde la semana ${SEM[0].sem}` : 'La hoja tiene un tamaño parecido';
}
function flowBar(o) {
  const lab = ['Pagaron lo que se pedía', 'Pagaron algo', 'Sin pago ni resultado', 'Ya no cumplen la condición'];
  const segs = [0, 1, 2, 3].filter(e => o.est[e] > 0);
  if (!o.n) return '<p class="muted">No hay cuentas en la hoja para este filtro.</p>';
  return `<div class="flow">${segs.map(e => `<div data-e="${e}" title="${EST[e]}: ${fmt.int(o.est[e])}" style="flex:${o.est[e]};background:var(${EST_VAR[e]});color:${e === 1 || e === 3 ? 'var(--ink)' : '#fff'}">${o.est[e] / o.n > 0.06 ? fmt.int(o.est[e]) : ''}</div>`).join('')}</div>
  <div class="flowlab">${segs.map(e => `<div style="flex:${Math.max(o.est[e], o.n * 0.12)}"><b>${EST[e]} ${fmt.pct(o.est[e] / o.n)}</b>${lab[e]}</div>`).join('')}</div>`;
}
const miniBar = (r, obj) => `<span class="minibar" title="${fmt.pct(r)} contra ${fmt.pct(obj)}"><span style="width:${Math.min(100, r * 100)}%"></span><em style="left:${obj * 100}%"></em></span>`;
function mapa(w) {
  const R = armar(w);
  const pts = [[], [], [], []];
  for (let i = 0; i < N; i++) if (R.foco[i] >= 0 && enFiltro(i)) pts[R.est[i]].push([CLI[i].lng, CLI[i].lat, i]);
  const sucs = Object.entries(SUC).map(([k, s]) => ({ value: [s.lng, s.lat], name: 'Sucursal ' + s.nom }));
  chart('chMapa', {
    grid: { left: 8, right: 8, top: 8, bottom: 30 },
    legend: { bottom: 0, textStyle: { color: cssv('--ink-2') }, itemWidth: 10, itemHeight: 10 },
    tooltip: { trigger: 'item', formatter: p => p.seriesName.startsWith('Sucursal') ? esc(p.name) : `${esc(CLI[p.value[2]].nom)}<br>${p.seriesName}` },
    xAxis: { type: 'value', scale: true, show: false }, yAxis: { type: 'value', scale: true, show: false },
    series: [...[2, 1, 0, 3].map(e => ({ name: EST[e], type: 'scatter', symbolSize: 8, data: pts[e], itemStyle: { color: cssv(EST_VAR[e]), borderColor: cssv('--surface'), borderWidth: 1 } })),
      { name: 'Sucursales', type: 'scatter', symbol: 'triangle', symbolSize: 16, data: sucs, itemStyle: { color: cssv('--ink') }, label: { show: true, formatter: p => p.name.replace('Sucursal ', ''), position: 'right', color: cssv('--ink'), fontWeight: 700, backgroundColor: cssv('--surface'), padding: [2, 5], borderRadius: 4 } }],
  });
  CH.chMapa?.on('click', p => { if (p.value && p.value[2] !== undefined && p.seriesName !== 'Sucursales') ficha(p.value[2]); });
}
function queHacer(f, e, i) {
  const r = DATA.f[S.w][i];
  if (e === 0) return '—';
  if (e === 1) return f === 1 ? 'Volver a pasar y cobrar' : 'Acordar fecha para el saldo';
  if (e === 3) return 'Ver por qué bajó (NC o ajuste)';
  if (f === 0) return r[C.lla] ? 'Seguir la promesa del llamado' : 'Cobrar lo vencido en la visita';
  if (f === 1) return 'Confirmar que el reparto pase';
  if (f === 2) return 'Llamar: dejó de pagar en su ritmo';
  return 'Revisar la NC con administración';
}
function filasCasos() {
  const R = armar(S.w), F = DATA.f[S.w], q = S.q.trim().toLowerCase();
  const rows = [];
  for (let i = 0; i < N; i++) {
    if (!enFiltro(i)) continue;
    const f = R.foco[i], e = R.est[i];
    if (S.nuevas) { if (!R.nueva[i]) continue; }
    else { if (f < 0) continue; if (S.foco >= 0 && f !== S.foco) continue; if (S.est >= 0 && e !== S.est) continue; }
    const c = CLI[i];
    if (q && !(String(c.id).includes(q) || c.nom.toLowerCase().includes(q) || c.rep.toLowerCase().includes(q))) continue;
    rows.push({ i, f, e, vd: R.vd[i], saldo: F[i][C.saldo], dup: F[i][C.dup], pag: F[i][C.pag] });
  }
  rows.sort((a, b) => S.dir * ((a[S.sort] ?? 0) - (b[S.sort] ?? 0)) || b.vd - a.vd);
  return rows;
}
function casos() {
  const rows = filasCasos(), el = $('casosPanel');
  const th = (k, t, cls = '') => `<th class="sortable ${cls}" data-k="${k}" aria-sort="${S.sort === k ? (S.dir < 0 ? 'descending' : 'ascending') : 'none'}">${t}${S.sort === k ? (S.dir < 0 ? ' ↓' : ' ↑') : ''}</th>`;
  el.innerHTML = `<div class="ph"><div><h3>Caso por caso</h3><p>${S.nuevas ? 'Cuentas nuevas de la semana: entran a la hoja del lunes que viene.' : 'Ordenado por deuda vencida · tocá una cuenta para ver su ficha (pagos, visitas, notas de crédito y llamados)'}</p></div>
    <span class="muted" style="font-size:13px">${fmt.int(rows.length)} cuentas</span></div>
    ${chipsFiltro()}
    <div class="toolbar"><input type="search" id="q" placeholder="Buscar cuenta o reparto" value="${esc(S.q)}" aria-label="Buscar cuenta o reparto">
      <div class="seg" role="group" aria-label="Estado">${['Todas', ...EST].map((t, k) => `<button type="button" data-est="${k - 1}" aria-pressed="${!S.nuevas && S.est === k - 1}">${t}</button>`).join('')}<button type="button" data-est="n" aria-pressed="${S.nuevas}">Nuevas</button></div>
      <button class="btn" id="btnCsv" type="button">Bajar a Excel (CSV)</button></div>
    <div class="tw"><table><thead><tr><th>Cuenta</th><th class="l">Foco</th><th class="l">Estado</th>${th('vd', `Vencido +${P.dias} d`)}${th('saldo', 'Saldo')}${th('dup', 'Último pago')}${th('pag', 'Pagó en la semana')}<th class="l hide-m">Reparto</th><th class="l hide-m">Supervisor</th><th class="l">Qué hacer</th></tr></thead><tbody>
    ${rows.slice(0, S.page).map(r => { const c = CLI[r.i]; return `<tr class="click" data-i="${r.i}"><td>${c.id} · ${esc(c.tipo)}</td><td class="l">${S.nuevas ? '—' : FOCO[r.f]}</td><td class="l">${S.nuevas ? chipEst('new', 'Nueva') : chipEst(EST_CLS[r.e], EST[r.e])}</td><td>${r.vd ? fmt.arsF(r.vd) : '—'}</td><td>${fmt.arsF(r.saldo)}</td><td>${r.dup < 0 ? 'nunca' : 'hace ' + fmt.int(r.dup) + ' d'}</td><td>${r.pag ? fmt.arsF(r.pag) : '—'}</td><td class="l hide-m">${c.rep}</td><td class="l hide-m">${esc(SUP[c.sup].nom)}</td><td class="l wr">${S.nuevas ? 'Revisar el lunes' : queHacer(r.f, r.e, r.i)}</td></tr>`; }).join('') || '<tr><td colspan="10" class="l muted">No hay cuentas con este filtro.</td></tr>'}
    </tbody></table></div>
    ${rows.length > S.page ? `<div class="more"><button class="btn" id="btnMore" type="button">Mostrar ${fmt.int(Math.min(50, rows.length - S.page))} más</button></div>` : ''}`;
  $('q').oninput = e => { S.q = e.target.value; S.page = 50; const pos = e.target.selectionStart; casos(); bindChips(); const q = $('q'); q.focus(); q.setSelectionRange(pos, pos); };
  el.querySelectorAll('[data-est]').forEach(b => b.onclick = () => { const x = b.dataset.est; if (x === 'n') { S.nuevas = true; S.est = -1; } else { S.nuevas = false; S.est = +x; } S.page = 50; casos(); bindChips(); });
  el.querySelectorAll('th[data-k]').forEach(t => t.onclick = () => { const k = t.dataset.k; if (S.sort === k) S.dir *= -1; else { S.sort = k; S.dir = -1; } casos(); bindChips(); });
  el.querySelectorAll('tr[data-i]').forEach(t => t.onclick = () => ficha(+t.dataset.i));
  if ($('btnMore')) $('btnMore').onclick = () => { S.page += 50; casos(); bindChips(); };
  $('btnCsv').onclick = () => csv(rows);
}
function csv(rows) {
  const s = SEM[S.w];
  const head = ['Cuenta', 'Tipo', 'Foco', 'Estado', `Vencido más de ${P.dias} días`, 'Saldo', 'Días desde el último pago', 'Pagó en la semana', 'Reparto', 'Supervisor', 'Sucursal', 'Qué hacer'];
  const lines = [head, ...rows.map(r => { const c = CLI[r.i]; return [c.id, c.tipo, S.nuevas ? 'Nueva' : FOCO[r.f], S.nuevas ? 'Nueva' : EST[r.e], Math.round(r.vd), Math.round(r.saldo), r.dup, Math.round(r.pag), c.rep, SUP[c.sup].nom, SUC[c.suc].nom, S.nuevas ? 'Revisar el lunes' : queHacer(r.f, r.e, r.i)]; })];
  const txt = '﻿' + lines.map(l => l.map(x => { const t = String(x); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  a.download = `hoja-cuenta-corriente_sem${s.sem}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  toast('Se descargó la lista (' + fmt.int(rows.length) + ' cuentas)');
}

/* ---------- ficha del cliente ---------- */
let lastFocus = null;
function ficha(i) {
  lastFocus = document.activeElement;
  const c = CLI[i], f = DATA.ficha[c.id] || { mv: [], g: [], sv: [], sp: [] };
  const R = armar(S.w), r = DATA.f[S.w][i], last = DATA.f[SEM.length - 1][i];
  $('dEyebrow').textContent = `${c.tipo} · ${c.rep} · ${SUP[c.sup].nom} · ${SUC[c.suc].nom}`;
  $('dTitle').textContent = `Cuenta ${c.id}`;
  $('dSub').textContent = `${c.cond} · paga habitualmente con ${c.medio.toLowerCase()}`;
  const k = DATA.meta.umbrales.indexOf(P.dias);
  const sem = SEM[S.w];
  $('dBody').innerHTML = `
    <div class="kv"><div><span>Saldo al ${fdl(DATA.meta.corte)}</span><b>${fmt.arsF(last[C.e_saldo])}</b></div>
      <div><span>Vencido a más de ${P.dias} días</span><b>${fmt.arsF(last[C[['e_v30', 'e_v45', 'e_v60', 'e_v90'][k]]])}</b></div>
      <div><span>Último pago</span><b>${last[C.e_dup] < 0 ? 'nunca' : 'hace ' + fmt.int(last[C.e_dup]) + ' d'}</b></div>
      <div><span>Pago habitual</span><b>${r[C.imed] > 0 ? 'cada ' + fmt.int(r[C.imed]) + ' d' : 'sin ritmo'}</b></div></div>
    <div><h4>En la hoja de la semana ${sem.sem}</h4><p style="margin:0">${R.foco[i] >= 0 ? `Entró por <b>${FOCO_C[R.foco[i]]}</b> · ${chipEst(EST_CLS[R.est[i]], EST[R.est[i]])} · ${queHacer(R.foco[i], R.est[i], i)}` : R.nueva[i] ? 'No estaba el lunes; entra a la hoja del lunes que viene.' : 'No está en la hoja de esta semana.'}</p>
      <p class="note">Antigüedad al lunes: más de 30 días ${fmt.arsF(r[C.v30])} · más de 45 ${fmt.arsF(r[C.v45])} · más de 60 ${fmt.arsF(r[C.v60])} · más de 90 ${fmt.arsF(r[C.v90])}. En la semana pagó ${fmt.arsF(r[C.pag])}${r[C.vis] ? ' y el reparto pasó' : ' y el reparto no pasó'}.</p></div>
    <div><h4>Venta y pagos, últimas 12 semanas</h4><div class="chart short" id="chFicha"></div></div>
    <div><h4>Últimos movimientos</h4><div class="tw"><table><thead><tr><th>Fecha</th><th class="l">Tipo</th><th>Importe</th><th class="l">Detalle</th></tr></thead><tbody>
      ${f.mv.map(m => `<tr><td>${fdl(m[0])}</td><td class="l">${esc(m[1])}</td><td class="${m[1] === 'Venta' || m[1] === 'Reversa de pago' ? '' : 'up'}">${m[1] === 'Venta' || m[1] === 'Reversa de pago' ? '' : MINUS}${fmt.arsF(m[2])}</td><td class="l">${esc(m[3])}</td></tr>`).join('') || '<tr><td colspan="4" class="l muted">Sin movimientos.</td></tr>'}
    </tbody></table></div></div>
    <div><h4>Gestiones registradas</h4>${f.g.length ? `<div class="tw"><table><thead><tr><th>Fecha</th><th class="l">Quién</th><th class="l">Qué</th><th class="l">Resultado</th></tr></thead><tbody>${f.g.map(g => `<tr><td>${fdl(g[0])}</td><td class="l">${esc(g[1])}</td><td class="l">${esc(g[2])}</td><td class="l">${esc(g[3])}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted" style="margin:0">Sin llamados ni revisiones registrados.</p>'}</div>`;
  $('scrim').hidden = false; $('drawer').hidden = false; $('dClose').focus();
  const lbl = Array.from({ length: 12 }, (_, k) => 'Sem ' + (SEM[0].sem - 1 + k));
  chart('chFicha', {
    grid: { left: 54, right: 10, top: 26, bottom: 26 },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: cssv('--ink-2') } },
    tooltip: { trigger: 'axis', valueFormatter: v => fmt.arsF(v) },
    xAxis: axisCat(lbl), yAxis: axisVal(v => fmt.ars(v)),
    series: [{ name: 'Venta', type: 'bar', data: f.sv, barMaxWidth: 12, itemStyle: { color: cssv('--s1'), borderRadius: [3, 3, 0, 0] } },
      { name: 'Pagos', type: 'bar', data: f.sp, barMaxWidth: 12, itemStyle: { color: cssv('--s2'), borderRadius: [3, 3, 0, 0] } }],
  });
}
function cerrarFicha() { $('scrim').hidden = true; $('drawer').hidden = true; CH.chFicha?.dispose(); delete CH.chFicha; lastFocus?.focus?.(); }

/* ================================================================ DÍAS CALLE Y COBRANZA */
const MEDIOS = DATA.medios.map(m => m[0]);
const repsFiltro = () => DATA.dc.filter(d => (!S.suc || REP[d.r].suc === S.suc) && (!S.sup || REP[d.r].sup === S.sup));
function aggMes(list, mi) {
  const o = { venta: 0, deuda: 0, cob: MEDIOS.map(() => 0), nc: 0, inc: 0 };
  for (const d of list) { const m = d.m[mi]; o.venta += m[0]; o.deuda += m[1]; m[2].forEach((v, k) => o.cob[k] += v); o.nc += m[3]; o.inc += m[4]; }
  const dias = DATA.meta.dias_reparto[DATA.meta.meses[mi]];
  o.dc = o.venta ? o.deuda / (o.venta / dias) : null;
  o.tot = o.cob.reduce((a, b) => a + b, 0);
  o.efe = o.tot ? o.cob[0] / o.tot : 0;
  o.costo = o.cob.reduce((a, v, k) => a + v * DATA.medios[k][1], 0);
  o.digital = o.tot - o.cob[0];
  o.ncp = o.venta ? (o.nc + o.inc) / o.venta : 0;
  return o;
}
function renderCalle(v) {
  const meses = DATA.meta.meses, mi = meses.indexOf(S.mes), list = repsFiltro();
  const a = aggMes(list, mi), b = mi > 0 ? aggMes(list, mi - 1) : null;
  const obj = P.dc_obj, [sc, st] = a.dc != null ? estado(a.dc, obj, true) : ['neu', 's/d'];
  const parcial = S.mes === DATA.meta.parcial;
  v.innerHTML = chipsFiltro() + `
  <div class="toolbar"><span class="muted">Mes:</span><div class="seg" role="group" aria-label="Mes">${meses.slice(-6).map(m => `<button type="button" data-m="${m}" aria-pressed="${S.mes === m}">${mesLbl(m)}${m === DATA.meta.parcial ? ' (al ' + fd(DATA.meta.corte) + ')' : ''}</button>`).join('')}</div></div>
  ${parcial ? `<p class="note" style="margin:0 0 14px">Mes en curso: la venta y los días de reparto son hasta el ${fdl(DATA.meta.corte)}; los días calle se comparan contra un mes cerrado con cuidado.</p>` : ''}
  <div class="cards">
    <div class="card" style="cursor:default"><div class="lbl">Días calle ${chipEst(sc, st)}</div><div class="v">${a.dc != null ? fmt.dias(a.dc) : 's/d'}</div>
      <div class="cl">${b && b.dc != null && a.dc != null ? `${varTxt(a.dc - b.dc, true, x => nf(1).format(Math.abs(x)) + ' días')} vs ${mesLbl(meses[mi - 1])}` : ''}</div>
      <p class="phrase">Objetivo: ${nf(0).format(obj)} días o menos. Menos es mejor.</p></div>
    <div class="card" style="cursor:default"><div class="lbl">Deuda al cierre</div><div class="v">${fmt.ars(a.deuda)}</div>
      <div class="cl">${b ? varTxt(b.deuda ? (a.deuda - b.deuda) / b.deuda : null, true, x => fmt.pct(x, true)) + ' vs el mes anterior' : ''}</div>
      <p class="phrase">Saldo positivo de las cuentas al ${parcial ? fdl(DATA.meta.corte) : 'último día del mes'}.</p></div>
    <div class="card" style="cursor:default"><div class="lbl">Venta del mes</div><div class="v">${fmt.ars(a.venta)}</div>
      <div class="cl">${b && !parcial ? varTxt(b.venta ? (a.venta - b.venta) / b.venta : null, false, x => fmt.pct(x, true)) + ' vs el mes anterior' : parcial ? 'Mes en curso' : ''}</div>
      <p class="phrase">Solo con cargo: las unidades sin cargo de la promo 2×1 no suman.</p></div>
    <div class="card" style="cursor:default"><div class="lbl">Cobrado en efectivo</div><div class="v">${fmt.pct(a.efe)}</div>
      <div class="cl">${b ? `<b class="flat">${fmt.pp(a.efe - b.efe)}</b> vs el mes anterior` : ''}</div>
      <p class="phrase">El resto entra por billetera, link de pago, débito o transferencia.</p></div>
    <div class="card" style="cursor:default"><div class="lbl">Costo de plataformas</div><div class="v">${fmt.ars(a.costo)}</div>
      <div class="cl">${fmt.pct(a.digital ? a.costo / a.digital : 0)} de lo cobrado por medios digitales</div>
      <p class="phrase">Comisión vigente de cada medio, sin IVA.</p></div>
  </div>
  <div class="grid">
    <section class="panel s7"><div class="ph"><div><h3>${tituloDC(list, mi, obj)}</h3><p>Sucursal → supervisor → reparto · tocá una fila para abrirla · ${mesLbl(S.mes)}</p></div></div>
      <div class="tw"><table><thead><tr><th>Unidad</th><th>Venta</th><th>Deuda</th><th>Días calle</th><th class="l">Estado</th><th class="hide-m">Var. mes</th><th class="hide-m">% efect.</th><th class="hide-m" title="Notas de crédito más incobrables, sobre la venta">NC + incob.</th></tr></thead><tbody id="dcBody"></tbody></table></div></section>
    <section class="panel s5"><div class="ph"><div><h3>${tituloDCmes(list)}</h3><p>${S.suc ? 'Por supervisor de ' + esc(SUC[S.suc].nom) : 'Por sucursal'} · la línea punteada es el objetivo</p></div></div><div class="chart" id="chDC"></div></section>
  </div>
  <section class="panel"><div class="ph"><div><h3>${tituloMix(list)}</h3><p>Composición de lo cobrado por medio, mes a mes</p></div></div><div class="chart" id="chMix"></div></section>`;
  v.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { S.mes = b.dataset.m; render(); });
  dcTabla(list, mi, obj);
  // gráfico días calle
  const grupos = S.suc ? Object.entries(SUP).filter(([k, s]) => s.suc === S.suc).map(([k, s]) => [s.nom, d => REP[d.r].sup === k]) : Object.entries(SUC).map(([k, s]) => [s.nom, d => REP[d.r].suc === k]);
  const colors = [cssv('--s1'), cssv('--s2'), cssv('--s3')];
  chart('chDC', {
    grid: { left: 40, right: 18, top: 30, bottom: 28 },
    legend: { top: 0, left: 0, itemWidth: 14, itemHeight: 3, textStyle: { color: cssv('--ink-2') } },
    tooltip: { trigger: 'axis', valueFormatter: v => v == null ? 's/d' : nf(1).format(v) + ' días' },
    xAxis: axisCat(meses.map(mesLbl)), yAxis: axisVal(v => nf(0).format(v)),
    series: grupos.map(([nom, fn], k) => ({ name: nom, type: 'line', symbolSize: 7, data: meses.map((m, i) => { const x = aggMes(DATA.dc.filter(fn), i); return x.dc != null ? +x.dc.toFixed(1) : null; }),
      lineStyle: { width: 2, color: colors[k % 3] }, itemStyle: { color: colors[k % 3], borderColor: cssv('--surface'), borderWidth: 2 },
      ...(k === 0 ? { markLine: { symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: cssv('--ink-3') }, label: { formatter: 'Objetivo', color: cssv('--ink-3'), position: 'insideEndTop' }, data: [{ yAxis: obj }] } } : {}) })),
  });
  const mcol = [cssv('--s1'), cssv('--s2'), cssv('--s3'), cssv('--s4'), cssv('--s5')];
  const ag = meses.map((m, i) => aggMes(list, i));
  chart('chMix', {
    grid: { left: 44, right: 16, top: 36, bottom: 28 },
    legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: cssv('--ink-2') } },
    tooltip: { trigger: 'axis', valueFormatter: v => nf(1).format(v) + '%' },
    xAxis: axisCat(meses.map(mesLbl)), yAxis: axisVal(v => v + '%', { max: 100 }),
    series: MEDIOS.map((md, k) => ({ name: md, type: 'bar', stack: 'mix', barMaxWidth: 26, data: ag.map(x => x.tot ? +(x.cob[k] / x.tot * 100).toFixed(1) : 0),
      itemStyle: { color: mcol[k], borderColor: cssv('--surface'), borderWidth: 1 } })),
  });
}
function tituloDC(list, mi, obj) {
  const rows = list.map(d => [d.r, aggMes([d], mi)]).filter(x => x[1].dc != null);
  const fuera = rows.filter(x => x[1].dc > obj);
  return fuera.length ? `${fuera.length} de ${rows.length} repartos están por encima de ${nf(0).format(obj)} días calle` : `Todos los repartos están en ${nf(0).format(obj)} días calle o menos`;
}
function tituloDCmes(list) {
  const meses = DATA.meta.meses, ini = meses.indexOf(DATA.meta.semanas[0].lunes.slice(0, 7)), fin = meses.length - 2;
  const a = aggMes(list, ini), b = aggMes(list, fin);
  if (a.dc == null || b.dc == null) return 'Días calle mes a mes';
  return b.dc < a.dc - 0.5 ? `Con la hoja semanal, los días calle bajaron de ${nf(1).format(a.dc)} a ${nf(1).format(b.dc)}` : `Días calle: ${nf(1).format(a.dc)} en ${mesLbl(meses[ini])} y ${nf(1).format(b.dc)} en ${mesLbl(meses[fin])}`;
}
function tituloMix(list) {
  const meses = DATA.meta.meses, a = aggMes(list, 0), b = aggMes(list, meses.length - 2);
  return `El efectivo pasó de ${fmt.pct(a.efe)} a ${fmt.pct(b.efe)} de lo cobrado entre ${mesLbl(meses[0])} y ${mesLbl(meses[meses.length - 2])}`;
}
function dcTabla(list, mi, obj) {
  const fila = (cls, label, lst, key, open) => {
    const a = aggMes(lst, mi), b = mi > 0 ? aggMes(lst, mi - 1) : null, [c, t] = a.dc != null ? estado(a.dc, obj, true) : ['neu', 's/d'];
    const d = b && b.dc != null && a.dc != null ? a.dc - b.dc : null;
    return `<tr class="${cls}${key ? ' click' : ''}${open ? ' open' : ''}" ${key ? `data-k="${key}"` : ''}><td>${key ? '<span class="chev">›</span> ' : ''}${esc(label)}</td><td>${fmt.ars(a.venta)}</td><td>${fmt.ars(a.deuda)}</td><td>${a.dc != null ? nf(1).format(a.dc) : '—'}</td><td class="l">${chipEst(c, t)}</td><td class="hide-m">${d == null ? '—' : varTxt(d, true, x => nf(1).format(Math.abs(x)))}</td><td class="hide-m">${fmt.pct(a.efe)}</td><td class="hide-m">${fmt.pct(a.ncp)}</td></tr>`;
  };
  let h = '';
  for (const [sk, s] of Object.entries(SUC)) {
    const ls = list.filter(d => REP[d.r].suc === sk); if (!ls.length) continue;
    const ko = 'suc' + sk; h += fila('n1', s.nom, ls, ko, S.open[ko]);
    if (!S.open[ko]) continue;
    for (const [pk, p] of Object.entries(SUP).filter(([k, p]) => p.suc === sk)) {
      const lp = ls.filter(d => REP[d.r].sup === pk); if (!lp.length) continue;
      const kp = 'sup' + pk; h += fila('n2', p.nom, lp, kp, S.open[kp]);
      if (!S.open[kp]) continue;
      for (const d of lp) h += fila('n3', d.r, [d], null, false);
    }
  }
  h += fila('tot', 'Total', list, null, false);
  $('dcBody').innerHTML = h;
  $('dcBody').querySelectorAll('tr[data-k]').forEach(t => t.onclick = () => { S.open[t.dataset.k] = !S.open[t.dataset.k]; dcTabla(list, mi, obj); });
}

/* ================================================================ CONTROL DE NC */
const REV_EST = r => !r ? ['crit', 'Sin revisar'] : /justificada/i.test(r) ? ['good', 'Justificada'] : /mal cargada/i.test(r) ? ['warn', 'Mal cargada: se corrige'] : ['crit', 'Sin respaldo'];
function renderNC(v) {
  const all = DATA.nc.filter(n => (!S.suc || REP[n[2]].suc === S.suc) && (!S.sup || REP[n[2]].sup === S.sup));
  const marca = n => n[3] >= S.ncPiso && (n[4] <= 0 || n[3] > S.ncK * n[4]);
  const m = all.filter(marca), rev = m.filter(n => n[6]);
  const totM = m.reduce((a, n) => a + n[3], 0), sinRev = m.filter(n => !n[6]).reduce((a, n) => a + n[3], 0);
  const meses = DATA.meta.meses.filter(x => x >= '2025-04');
  const porMes = meses.map(mm => { const l = all.filter(n => n[0].slice(0, 7) === mm); return [l.filter(marca).reduce((a, n) => a + n[3], 0), l.filter(n => !marca(n)).reduce((a, n) => a + n[3], 0)]; });
  // patrón por reparto: NC + incobrables sobre la venta, últimos 3 meses cerrados
  const mi = DATA.meta.meses.length - 2, idx = [mi - 2, mi - 1, mi];
  const pat = repsFiltro().map(d => { const ag = aggMes([d], idx[0]), a2 = aggMes([d], idx[1]), a3 = aggMes([d], idx[2]); const venta = ag.venta + a2.venta + a3.venta, x = ag.nc + ag.inc + a2.nc + a2.inc + a3.nc + a3.inc; return [d.r, venta ? x / venta : 0, x]; }).sort((a, b) => b[1] - a[1]);
  const med = pat.length ? pat.map(p => p[1]).sort((a, b) => a - b)[Math.floor(pat.length / 2)] : 0;
  const conPat = pat.filter(p => p[1] > Math.max(0.04, med * 3));
  const desde = DATA.meta.semanas[0].lunes.slice(0, 8) + '01', mc = m.filter(n => n[0] >= desde), rc = mc.filter(n => n[6]);
  const sinRevC = mc.filter(n => !n[6]).reduce((a, n) => a + n[3], 0), tasa = mc.length ? rc.length / mc.length : 1;
  v.innerHTML = chipsFiltro() + `
  <p class="eyb">Qué es «fuera de lo normal»</p>
  <ul class="know"><li><span>Una nota de crédito entra al control cuando supera <b>${fmt.arsF(S.ncPiso)}</b> y es más de <b>${nf(1).format(S.ncK)} veces</b> lo que el cliente factura en un mes habitual (promedio de los 6 meses anteriores). No es un monto grande: es un monto desproporcionado para ese cliente.</span></li>
  <li><span>Un reparto muestra un <b>patrón</b> cuando sus notas de crédito e incobrables superan el 4% de su venta y el triple de la mediana de los repartos.</span></li>
  <li><span>La revisión de administración arrancó junto con la hoja: se mide desde <b>${mesLbl(desde.slice(0, 7))}</b>. Lo anterior queda como antecedente.</span></li></ul>
  <div class="toolbar"><span class="muted">Veces la facturación habitual:</span><div class="seg" role="group" aria-label="Veces">${[1.5, 2, 3, 4].map(k => `<button type="button" data-k="${k}" aria-pressed="${S.ncK === k}">${nf(1).format(k)}×</button>`).join('')}</div>
    <span class="muted">Piso:</span><div class="seg" role="group" aria-label="Piso">${[20000, 50000, 100000].map(k => `<button type="button" data-p="${k}" aria-pressed="${S.ncPiso === k}">${fmt.ars(k)}</button>`).join('')}</div></div>
  <div class="cards">
    <div class="card" style="cursor:default"><div class="lbl">NC fuera de lo normal</div><div class="v">${fmt.int(m.length)}</div><div class="cl">${fmt.ars(totM)} desde abr-25</div><p class="phrase">De ${fmt.int(all.length)} notas de crédito en el período.</p></div>
    <div class="card" style="cursor:default"><div class="lbl">Revisadas desde ${mesLbl(desde.slice(0, 7))} ${chipEst(...estado(tasa, 0.8))}</div><div class="v">${fmt.pct(tasa)}</div><div class="cl">${fmt.int(rc.length)} de ${fmt.int(mc.length)} con resultado de administración</div><p class="phrase">Objetivo: 8 de cada 10 revisadas dentro de las 3 semanas.</p></div>
    <div class="card" style="cursor:default"><div class="lbl">Sin revisar desde ${mesLbl(desde.slice(0, 7))}</div><div class="v">${fmt.ars(sinRevC)}</div><div class="cl">${fmt.int(mc.length - rc.length)} notas de crédito · ${fmt.ars(sinRev)} contando las anteriores</div><p class="phrase">Plata que salió de la cuenta corriente sin explicación todavía.</p></div>
    <div class="card" style="cursor:default"><div class="lbl">Repartos con patrón</div><div class="v">${fmt.int(conPat.length)}</div><div class="cl">${conPat.slice(0, 3).map(p => p[0]).join(' · ') || 'ninguno'}</div><p class="phrase">NC e incobrables por encima de lo normal en los últimos 3 meses cerrados.</p></div>
  </div>
  <div class="grid">
    <section class="panel s7"><div class="ph"><div><h3>${m.length ? `Las NC fuera de lo normal suman ${fmt.ars(totM)} desde abril` : 'No hay notas de crédito fuera de lo normal con estos cortes'}</h3><p>Importe de notas de crédito por mes</p></div></div><div class="chart" id="chNC"></div></section>
    <section class="panel s5"><div class="ph"><div><h3>${conPat.length ? `${conPat[0][0]} concentra el patrón` : 'Ningún reparto muestra un patrón'}</h3><p>NC + incobrables sobre la venta, ${mesLbl(DATA.meta.meses[idx[0]])} a ${mesLbl(DATA.meta.meses[idx[2]])} · mediana de los repartos ${fmt.pct(med)}</p></div></div>
      <div class="tw"><table><thead><tr><th>Reparto</th><th class="l">Supervisor</th><th>% de la venta</th><th>Importe</th><th class="l">Estado</th></tr></thead><tbody>
      ${pat.slice(0, 8).map(p => `<tr><td>${p[0]}</td><td class="l">${esc(SUP[REP[p[0]].sup].nom)}</td><td>${fmt.pct(p[1])}</td><td>${fmt.ars(p[2])}</td><td class="l">${conPat.includes(p) ? chipEst('crit', 'Patrón') : chipEst('good', 'Normal')}</td></tr>`).join('')}
      </tbody></table></div></section>
  </div>
  <section class="panel"><div class="ph"><div><h3>Caso por caso</h3><p>Notas de crédito marcadas, de la más reciente a la más vieja · las anteriores a ${mesLbl(desde.slice(0, 7))} no pasaban por revisión · tocá una para ver la ficha</p></div><span class="muted">${fmt.int(m.length)} casos</span></div>
    <div class="tw"><table><thead><tr><th>Fecha</th><th>Cuenta</th><th class="l">Reparto</th><th class="l hide-m">Supervisor</th><th>NC</th><th>Facturación mensual habitual</th><th>Veces</th><th class="l hide-m">Motivo cargado</th><th class="l">Revisión</th></tr></thead><tbody>
    ${m.slice().reverse().map(n => { const [c, t] = REV_EST(n[6]); const i = CLI.findIndex(x => x.id === n[1]); return `<tr class="${i >= 0 ? 'click' : ''}" data-i="${i}"><td>${fdl(n[0])}</td><td>${n[1]}</td><td class="l">${n[2]}</td><td class="l hide-m">${esc(SUP[REP[n[2]].sup].nom)}</td><td>${fmt.arsF(n[3])}</td><td>${n[4] > 0 ? fmt.arsF(n[4]) : 'sin facturación'}</td><td>${n[4] > 0 ? nf(1).format(n[3] / n[4]) + '×' : '—'}</td><td class="l hide-m">${esc(n[5])}</td><td class="l">${chipEst(c, t)}</td></tr>`; }).join('') || '<tr><td colspan="9" class="l muted">No hay casos con estos cortes.</td></tr>'}
    </tbody></table></div></section>`;
  v.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { S.ncK = +b.dataset.k; render(); });
  v.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { S.ncPiso = +b.dataset.p; render(); });
  v.querySelectorAll('tr[data-i]').forEach(t => { if (+t.dataset.i >= 0) t.onclick = () => ficha(+t.dataset.i); });
  chart('chNC', {
    grid: { left: 54, right: 16, top: 34, bottom: 28 },
    legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: cssv('--ink-2') } },
    tooltip: { trigger: 'axis', valueFormatter: v => fmt.arsF(v) },
    xAxis: axisCat(meses.map(mesLbl)), yAxis: axisVal(v => fmt.ars(v)),
    series: [{ name: 'Fuera de lo normal', type: 'bar', stack: 'nc', barMaxWidth: 26, data: porMes.map(x => x[0]), itemStyle: { color: cssv('--crit'), borderColor: cssv('--surface'), borderWidth: 1 } },
      { name: 'Resto', type: 'bar', stack: 'nc', barMaxWidth: 26, data: porMes.map(x => x[1]), itemStyle: { color: cssv('--neutral'), borderColor: cssv('--surface'), borderWidth: 1, borderRadius: [4, 4, 0, 0] } }],
  });
}

/* ================================================================ PARÁMETROS */
function renderParam(v) {
  const campos = [
    ['dias', 'Deuda vencida a más de', 'select', DATA.meta.umbrales, x => x + ' días', 'Antigüedad del cargo sin cancelar más viejo que cuenta como vencido.'],
    ['piso', 'Piso de deuda ($)', 'number', 1000, null, 'Por debajo de este monto la cuenta no entra a la hoja (ni por deuda, ni por visita, ni por ritmo).'],
    ['sin_visita', 'Sin visita hace más de (días)', 'number', 1, null, 'Para cuentas con saldo: cuántos días sin que el reparto pase se toleran.'],
    ['factor', 'Ritmo atrasado: veces su intervalo habitual', 'number', 0.5, null, 'Si paga cada 7 días y el factor es 2, entra a los 15 días sin pagar (nunca antes de 14).'],
    ['piso_nc', 'Piso de nota de crédito del mes ($)', 'number', 1000, null, 'Notas de crédito del último mes que suman al menos este monto.'],
    ['pct_nc', 'NC sobre la facturación mensual habitual', 'number', 0.05, null, 'Proporción (0,5 = la mitad de lo que factura en un mes normal).'],
    ['objetivo', 'Objetivo de cuentas con resultado', 'number', 0.05, null, 'Proporción de la hoja que tiene que terminar resuelta o en parte al sábado.'],
    ['dc_obj', 'Objetivo de días calle', 'number', 0.5, null, 'Días de venta en la calle sin cobrar, como máximo.'],
  ];
  v.innerHTML = chipsFiltro() + `
  <p class="eyb">Acá se ajusta qué entra a la hoja</p>
  <ul class="know"><li><span>Los cambios se ven al instante en todas las pestañas y se guardan <b>solo en esta compu</b>, para probar. Cuando un criterio queda acordado, se fija en el código para que todos vean lo mismo.</span></li></ul>
  <div class="params">${campos.map(([k, t, tipo, x, fx, help]) => `<label><b>${t}</b>${tipo === 'select'
    ? `<select data-p="${k}" class="${P[k] !== DEF[k] ? 'ed' : ''}">${x.map(o => `<option value="${o}" ${P[k] === o ? 'selected' : ''}>${fx(o)}</option>`).join('')}</select>`
    : `<input type="number" step="${x}" data-p="${k}" value="${P[k]}" class="${P[k] !== DEF[k] ? 'ed' : ''}">`}<small>${help} Acordado: ${k === 'dias' ? DEF[k] + ' días' : k.startsWith('piso') ? fmt.arsF(DEF[k]) : nf(Number.isInteger(DEF[k]) ? 0 : 2).format(DEF[k])}.</small></label>`).join('')}</div>
  <p style="margin-top:16px"><button class="btn" id="btnDef" type="button">Volver a los acordados</button></p>
  ${hojaComparada()}`;
  v.querySelectorAll('[data-p]').forEach(el => el.onchange = () => { const k = el.dataset.p, val = +el.value; if (!isFinite(val)) return; P[k] = val; store.set('rf_params', P); CACHE.clear(); render(); });
  $('btnDef').onclick = () => { P = Object.assign({}, DEF); store.set('rf_params', {}); CACHE.clear(); render(); };
}
function hojaComparada() {
  const ed = Object.keys(DEF).filter(k => P[k] !== DEF[k]);
  if (!ed.length) return '';
  const a = resumen(S.w), keep = P; P = Object.assign({}, DEF); const b = resumen(S.w); P = keep;
  return `<section class="panel" style="margin-top:18px"><div class="ph"><div><h3>Con tus parámetros la hoja tiene ${fmt.int(a.n)} cuentas (${a.n - b.n >= 0 ? '+' : MINUS}${fmt.int(Math.abs(a.n - b.n))} contra los acordados)</h3><p>Semana ${SEM[S.w].sem}</p></div></div>
  <div class="tw"><table><thead><tr><th>Indicador</th><th>Acordados</th><th>Tus parámetros</th></tr></thead><tbody>
  <tr><td>Cuentas en la hoja</td><td>${fmt.int(b.n)}</td><td>${fmt.int(a.n)}</td></tr>
  <tr><td>Con resultado</td><td>${fmt.pct(b.res)}</td><td>${fmt.pct(a.res)}</td></tr>
  <tr><td>Cobrado de la hoja</td><td>${fmt.ars(b.cobrado)}</td><td>${fmt.ars(a.cobrado)}</td></tr>
  ${[0, 1, 2, 3].map(f => `<tr><td>${FOCO[f]}</td><td>${fmt.int(b.foco[f][4])}</td><td>${fmt.int(a.foco[f][4])}</td></tr>`).join('')}
  </tbody></table></div></section>`;
}

/* ================================================================ INFORMES */
function renderInf(v) {
  const s = SEM[SEM.length - 1];
  v.innerHTML = `<p class="eyb">Informes y descargas</p>
  <div class="rep">
    <div><h5>Informe para supervisores · semana ${s.sem}</h5><p>Una tarjeta por supervisor con su resolución contra el objetivo y la lista de lo que falta, ordenada por lo que está en juego. Pensado para la reunión semanal.</p><a class="btn primary" href="../04_informes/informe-supervisores_sem${s.sem}.html">Abrir el informe</a></div>
    <div><h5>Hoja de la semana en Excel</h5><p>La lista de cuentas con su foco, estado y qué hacer, con los filtros y parámetros que tengas puestos.</p><button class="btn" id="btnCsv2" type="button">Bajar a Excel (CSV)</button></div>
    <div><h5>Base completa</h5><p>Clientes, ventas, pagos, visitas, notas de crédito y gestiones en un Excel, para auditar cualquier número del tablero.</p><a class="btn" href="../01_datos/Base-cuenta-corriente.xlsx">Bajar la base</a></div>
    <div><h5>Reglas de negocio y consultas SQL</h5><p>Qué entra y qué no, cómo se calcula cada indicador y las consultas de SQL Server que arman la hoja.</p><a class="btn" href="https://github.com/MatiasGarnica/portfolio-control-gestion/tree/main/caso-02-cuenta-corriente">Ver en GitHub</a></div>
  </div>`;
  $('btnCsv2').onclick = () => { const k = S.tab; S.tab = 'hoja'; const r = filasCasos(); S.tab = k; csv(r); };
}

/* ================================================================ recorrido */
const TOUR = [
  ['#selSem', 'Elegí la semana. La hoja se arma cada lunes a las 7:00 y no cambia durante la semana: lo que se mide es qué pasó con cada cuenta.'],
  ['#selSuc', 'Filtrá por sucursal o supervisor: todas las pestañas se recalculan.'],
  ['#cardsBox', 'Lo que hay que mirar: cuentas en la hoja, cuántas tuvieron resultado contra el objetivo, cuánto se cobró, lo pendiente y lo nuevo. Tocá una tarjeta para ver la lista.'],
  ['#flowPanel', 'Cómo terminó la hoja del lunes, por estado y por foco. Tocá un tramo o una fila para filtrar el caso por caso.'],
  ['#casosPanel', 'Caso por caso, con qué hacer en cada cuenta. Tocá una fila para ver su ficha: movimientos, gestiones y la serie de 12 semanas.'],
  ['[data-tab="calle"]', 'Días calle y cobranza: cuántos días de venta están sin cobrar y por qué medio entra la plata.'],
  ['[data-tab="param"]', 'Parámetros: cambiá los cortes (días de vencido, pisos, objetivo) y mirá cómo cambia la hoja. Se guardan solo en tu compu.'],
];
let tourI = 0;
function tour(i) {
  if (S.tab !== 'hoja') { S.tab = 'hoja'; render(); }
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
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }
function render() {
  stamp();
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)));
  Object.keys(CH).forEach(k => { if (k !== 'chFicha') { CH[k].dispose(); delete CH[k]; } });
  const v = $('view');
  ({ hoja: renderHoja, calle: renderCalle, nc: renderNC, param: renderParam, inf: renderInf })[S.tab](v);
  bindChips();
}
initHeader();
$('dClose').onclick = cerrarFicha; $('scrim').onclick = cerrarFicha;
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('drawer').hidden) cerrarFicha(); else if (!$('tourLayer').hidden) endTour(); } });
$('btnTour').onclick = () => tour(0);
$('tourNext').onclick = () => tourI === TOUR.length - 1 ? endTour() : tour(tourI + 1);
$('tourPrev').onclick = () => tour(tourI - 1);
$('tourEnd').onclick = endTour;
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== S.tab && ['hoja', 'calle', 'nc', 'param', 'inf'].includes(h)) { S.tab = h; render(); } });
render();
