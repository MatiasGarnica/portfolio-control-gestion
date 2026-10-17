// Prueba local de enviar_a_supabase.gs con los servicios de Google simulados. Uso: node prueba_apps_script.js
const fs = require('fs');
const enviados = [], mails = [];
let codigo = 201;
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => ({ SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_SERVICE: 'x', MAIL_DUENO: 'aldo@ejemplo.com' })[k] }) };
global.UrlFetchApp = { fetch: (url, o) => { enviados.push({ url, cuerpo: o && o.payload && JSON.parse(o.payload) }); return { getResponseCode: () => codigo, getContentText: () => '[]' }; } };
global.MailApp = { sendEmail: (a, s, t) => mails.push({ a, s, t }) };
global.Utilities = { formatDate: (d, tz, f) => f.startsWith('yyyy-MM-dd\'T') ? '2025-10-09T21:40:00' : '2025-10-09' };
global.SpreadsheetApp = { openById: () => ({ getSheets: () => [{ getLastRow: () => 5, getLastColumn: () => 14, getRange: () => ({ setValue: v => mails.push({ marca: v }) }) }] }) };
global.LOCALES = ['Centro', 'Jardín'];
eval(fs.readFileSync(require('path').join(__dirname, '..', 'apps_script', 'enviar_a_supabase.gs'), 'utf8').replace(/^const /gm, 'var '));
const resp = (o) => ({ response: { getTimestamp: () => new Date(), getItemResponses: () => Object.entries(o).map(([k, v]) => ({ getItem: () => ({ getTitle: () => k }), getResponse: () => v })) }, source: { getDestinationId: () => 'p' } });
const base = { 'Fecha del cierre': '2025-10-09', 'Local': 'Centro', 'Responsable': 'Marcos', 'Ventas en efectivo': '300000', 'Ventas con débito': '50000', 'Ventas con crédito': '20000',
  'Ventas con billetera virtual': '30000', 'Ventas por transferencia': '10000', 'Cantidad de tickets': '40', 'Gastos pagados con la caja': '10000', 'Concepto del gasto': 'Verdulería', 'Retiro del dueño': '200000', 'Efectivo contado al cierre': '104500' };
alEnviarCierre(resp(base));                                   // esperado 20000+300000-10000-200000 = 110000 → faltan 5500
console.log('1) guardado:', enviados[0].url.endsWith('/cierres_caja'), '· mail:', mails[0] && mails[0].t.split('\n')[2]);
codigo = 409; mails.length = 0;
alEnviarCierre(resp(Object.assign({}, base, { 'Efectivo contado al cierre': '110000' })));
console.log('2) duplicado:', mails.find(m => m.t) && mails.find(m => m.t).t.split('\n')[2], '· planilla:', mails.find(m => m.marca).marca);
codigo = 201; mails.length = 0;
alEnviarCierre(resp(Object.assign({}, base, { 'Efectivo contado al cierre': '110200', 'Cantidad de tickets': '2' })));
console.log('3) ticket raro:', mails[0] && mails[0].t.split('\n')[2]);
codigo = 201; mails.length = 0;
alEnviarCierre(resp(Object.assign({}, base, { 'Efectivo contado al cierre': '110300' })));
console.log('4) cuadra, sin mail:', mails.length === 0);

// 5) resumen del lunes: lee las vistas y manda un mail en HTML
eval(fs.readFileSync(require('path').join(__dirname, '..', 'apps_script', 'resumen_semanal.gs'), 'utf8').replace(/^const /gm, 'var '));
const vistas = {
  v_cierre_diario: [{ fecha: '2025-10-04', local: 'Centro', responsable: 'Marcos', venta_total: 700000, diferencia: -4200, estado_caja: 'Faltante' },
                    { fecha: '2025-10-04', local: 'Jardín', responsable: 'Lucía', venta_total: 500000, diferencia: 0, estado_caja: 'Cuadra' }],
  v_cierres_faltantes: [], v_saldo_mayoristas: [{ id_cliente: 13, saldo: 201300, paga_menos: true }],
  v_estado_clientes: [{ id_cliente: 3, nombre: 'Almacén Doña Rosa', estado: 'Dejó de comprar', ultima: '2025-07-11' }],
};
global.UrlFetchApp = { fetch: url => ({ getContentText: () => JSON.stringify(vistas[url.split('/rest/v1/')[1].split('?')[0]]) }) };
mails.length = 0;
resumenDelLunes();
const m5 = mails[0] && mails[0].a;
console.log('5) resumen:', m5 && m5.subject, '· faltante:', /faltaron \$ 4[.,]200/.test(m5.htmlBody), '· llamar:', (m5.htmlBody.match(/<li><b>/g) || []).length, 'clientes');
