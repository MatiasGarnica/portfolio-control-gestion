/**
 * Caso 04 · Cada respuesta del formulario se controla y se guarda en Supabase. Si algo no cierra, avisa por mail.
 *
 * Configuración (una vez): Proyecto › Configuración › Propiedades del script
 *   SUPABASE_URL      https://<proyecto>.supabase.co
 *   SUPABASE_SERVICE  clave de servicio (nunca va en el código ni en el tablero)
 *   MAIL_DUENO        mail de Aldo
 * La planilla de Google queda como respaldo: si Supabase no responde, la fila se marca y se reintenta a la noche.
 */
const FONDO = 20000;
const TOLERANCIA = 500;          // diferencia de caja que se considera «cuadra»
const AVISO_FALTANTE = 2000;     // desde este faltante, mail en el momento

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function supabase_(tabla, metodo, cuerpo, consulta) {
  const url = prop_('SUPABASE_URL') + '/rest/v1/' + tabla + (consulta ? '?' + consulta : '');
  const r = UrlFetchApp.fetch(url, {
    method: metodo, contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: prop_('SUPABASE_SERVICE'), Authorization: 'Bearer ' + prop_('SUPABASE_SERVICE'), Prefer: 'return=minimal' },
    payload: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { ok: r.getResponseCode() < 300, codigo: r.getResponseCode(), texto: r.getContentText() };
}

function respuestas_(e) {
  const out = {};
  e.response.getItemResponses().forEach(ir => out[ir.getItem().getTitle()] = ir.getResponse());
  return out;
}
const n_ = v => (v === undefined || v === '' ? 0 : Number(v));

function alEnviarCierre(e) {
  const r = respuestas_(e);
  const fila = {
    fecha: r['Fecha del cierre'], local: r['Local'], responsable: r['Responsable'],
    efectivo: n_(r['Ventas en efectivo']), debito: n_(r['Ventas con débito']), credito: n_(r['Ventas con crédito']),
    billetera: n_(r['Ventas con billetera virtual']), transferencia: n_(r['Ventas por transferencia']),
    tickets: n_(r['Cantidad de tickets']), gasto: n_(r['Gastos pagados con la caja']), concepto_gasto: r['Concepto del gasto'] || null,
    retiro: n_(r['Retiro del dueño']), fondo: FONDO, efectivo_contado: n_(r['Efectivo contado al cierre']),
    obs: r['Observaciones'] || null, fuente: 'Formulario',
    cargado: Utilities.formatDate(e.response.getTimestamp(), 'America/Argentina/Cordoba', "yyyy-MM-dd'T'HH:mm:ss"),
  };
  // controles que el formulario no puede hacer solo
  const avisos = [];
  const hoy = Utilities.formatDate(new Date(), 'America/Argentina/Cordoba', 'yyyy-MM-dd');
  if (fila.fecha > hoy) avisos.push('La fecha del cierre es posterior a hoy.');
  const venta = fila.efectivo + fila.debito + fila.credito + fila.billetera + fila.transferencia;
  const ticket = venta / Math.max(fila.tickets, 1);
  if (ticket < 2000 || ticket > 60000) avisos.push('El ticket promedio da $ ' + Math.round(ticket) + ': revisar la cantidad de tickets.');
  const esperado = FONDO + fila.efectivo - fila.gasto - fila.retiro;
  const dif = fila.efectivo_contado - esperado;
  if (dif < -AVISO_FALTANTE) avisos.push('Faltan $ ' + Math.abs(dif) + ' en la caja (esperado $ ' + esperado + ', contado $ ' + fila.efectivo_contado + ').');
  if (fila.gasto > 0 && !fila.concepto_gasto) avisos.push('Hay un gasto sin concepto.');

  const res = supabase_('cierres_caja', 'post', fila);
  if (!res.ok) {
    // 409: ya hay un cierre de ese local ese día (restricción unique en la base)
    avisos.push(res.codigo === 409 ? 'Ya había un cierre cargado para ' + fila.local + ' el ' + fila.fecha + ': no se guardó el segundo.'
                                   : 'No se pudo guardar en la base (' + res.codigo + '). Queda en la planilla y se reintenta a la noche.');
    marcarPendiente_(e, res.codigo);
  }
  if (avisos.length) {
    MailApp.sendEmail(prop_('MAIL_DUENO'), 'Cierre ' + fila.local + ' ' + fila.fecha + ' · revisar',
      'Cargó: ' + fila.responsable + '\n\n- ' + avisos.join('\n- ') + '\n\nVenta del día: $ ' + venta + '.');
  }
}

function alEnviarMayorista(e) {
  const r = respuestas_(e);
  const id = buscarCliente_(r['Cliente']);
  if (r['¿Qué se registra?'] === 'Un pedido') {
    supabase_('ventas_mayoristas', 'post', { fecha: r['Fecha'], id_cliente: id, importe: n_(r['Importe del pedido']), condicion: r['Condición'], fuente: 'Formulario' });
  } else {
    supabase_('cobros_mayoristas', 'post', { fecha: r['Fecha'], id_cliente: id, importe: n_(r['Importe cobrado']), medio: r['Medio'], fuente: 'Formulario' });
  }
}

function buscarCliente_(nombre) {
  const r = UrlFetchApp.fetch(prop_('SUPABASE_URL') + '/rest/v1/clientes_mayoristas?select=id_cliente&nombre=eq.' + encodeURIComponent(nombre),
    { headers: { apikey: prop_('SUPABASE_SERVICE'), Authorization: 'Bearer ' + prop_('SUPABASE_SERVICE') } });
  return JSON.parse(r.getContentText())[0].id_cliente;
}

function marcarPendiente_(e, codigo) {
  const hoja = SpreadsheetApp.openById(e.source.getDestinationId()).getSheets()[0];
  hoja.getRange(hoja.getLastRow(), hoja.getLastColumn() + 1).setValue('Pendiente de subir (' + codigo + ')');
}

/** Todas las noches: qué local no cargó el cierre de hoy (los lunes no se abre). */
function recordarCierresFaltantes() {
  const ahora = new Date();
  if (ahora.getDay() === 1) return;
  const hoy = Utilities.formatDate(ahora, 'America/Argentina/Cordoba', 'yyyy-MM-dd');
  const r = UrlFetchApp.fetch(prop_('SUPABASE_URL') + '/rest/v1/cierres_caja?select=local&fecha=eq.' + hoy,
    { headers: { apikey: prop_('SUPABASE_SERVICE'), Authorization: 'Bearer ' + prop_('SUPABASE_SERVICE') } });
  const cargados = JSON.parse(r.getContentText()).map(x => x.local);
  const faltan = LOCALES.filter(l => !cargados.includes(l));
  if (faltan.length) {
    MailApp.sendEmail(prop_('MAIL_DUENO'), 'Falta el cierre de hoy: ' + faltan.join(' y '),
      'A las 22:00 no estaba cargado el cierre de ' + faltan.join(' y ') + ' del ' + hoy + '.');
  }
}
