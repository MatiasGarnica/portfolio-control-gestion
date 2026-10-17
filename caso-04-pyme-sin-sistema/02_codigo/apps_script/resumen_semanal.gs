/**
 * Caso 04 · Resumen del lunes: cada lunes a las 8:00 (activador por tiempo) le manda al dueño la semana de martes a domingo.
 * Lee las vistas de supabase/02_vistas.sql con la misma clave del script. La copia del portfolio
 * (04_informes/resumen-semanal.html) la arma build_informe.py con los mismos datos y las mismas reglas.
 */
function resumenDelLunes() {
  const tz = 'America/Argentina/Cordoba';
  const ahora = new Date();
  const dom = new Date(ahora.getTime() - 864e5);                    // corre el lunes: la semana terminó ayer
  const mar = new Date(dom.getTime() - 5 * 864e5);
  const f = d => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  const leer = (vista, consulta) => JSON.parse(UrlFetchApp.fetch(prop_('SUPABASE_URL') + '/rest/v1/' + vista + '?' + consulta,
    { headers: { apikey: prop_('SUPABASE_SERVICE'), Authorization: 'Bearer ' + prop_('SUPABASE_SERVICE') } }).getContentText());
  const rango = 'fecha=gte.' + f(mar) + '&fecha=lte.' + f(dom);
  const cierres = leer('v_cierre_diario', 'select=fecha,local,responsable,venta_total,diferencia,estado_caja&' + rango);
  const faltan = leer('v_cierres_faltantes', rango);
  const fiado = leer('v_saldo_mayoristas', 'select=id_cliente,saldo,paga_menos&saldo=gt.0');
  const clientes = leer('v_estado_clientes', 'select=id_cliente,nombre,estado,ultima&estado=neq.Activo');

  const pesos = n => '$ ' + Math.round(n).toLocaleString('es-AR');
  const venta = cierres.reduce((a, c) => a + c.venta_total, 0);
  const arqueados = cierres.filter(c => c.estado_caja);
  const cuadran = arqueados.filter(c => c.estado_caja === 'Cuadra').length;
  const falto = cierres.filter(c => c.diferencia < -TOLERANCIA).reduce((a, c) => a - c.diferencia, 0);
  const debe = fiado.reduce((a, c) => a + c.saldo, 0);
  const nombre = id => (clientes.find(c => c.id_cliente === id) || {}).nombre || 'Cliente ' + id;
  const llamar = clientes.map(c => '<li><b>' + c.nombre + '</b>: ' + c.estado.toLowerCase() + ' (última compra ' + c.ultima + ')</li>')
    .concat(fiado.filter(c => c.paga_menos).map(c => '<li><b>' + nombre(c.id_cliente) + '</b>: paga menos de lo que compra; debe ' + pesos(c.saldo) + '</li>'));
  const difs = cierres.filter(c => c.estado_caja && c.estado_caja !== 'Cuadra')
    .map(c => '<li>' + c.fecha + ' · ' + c.local + ' · ' + c.responsable + ': ' + (c.diferencia < 0 ? 'faltaron ' : 'sobraron ') + pesos(Math.abs(c.diferencia)) + '</li>');

  const html = '<div style="font-family:Arial,sans-serif;max-width:620px">'
    + '<div style="background:#7c2d1b;color:#fff;padding:16px 18px;border-bottom:5px solid #e3a530"><b style="font-size:20px">Tu semana, del ' + f(mar) + ' al ' + f(dom) + '</b></div>'
    + '<ul><li>Vendiste <b>' + pesos(venta) + '</b>.</li>'
    + '<li>La caja cuadró <b>' + cuadran + ' de ' + arqueados.length + '</b> cierres; faltaron ' + pesos(falto) + '.</li>'
    + (faltan.length ? '<li><b>No se cargó el cierre</b> de: ' + faltan.map(x => x.fecha + ' ' + x.local).join(', ') + '.</li>' : '<li>Se cargaron todos los cierres.</li>')
    + '<li>Los restaurantes deben <b>' + pesos(debe) + '</b>.</li></ul>'
    + (difs.length ? '<h3>Cierres con diferencia</h3><ul>' + difs.join('') + '</ul>' : '')
    + (llamar.length ? '<h3>A quién llamar</h3><ul>' + llamar.join('') + '</ul>' : '')
    + '</div>';
  MailApp.sendEmail({ to: prop_('MAIL_DUENO'), subject: 'Tu semana: ' + pesos(venta) + ' · caja ' + cuadran + ' de ' + arqueados.length, htmlBody: html });
}
