/**
 * Caso 04 · Pastas Don Aldo · Crea los dos formularios con sus validaciones y la planilla de respuestas.
 * Se corre una sola vez desde script.google.com (Ejecutar › crearFormularios). Datos ficticios.
 *
 * Por qué un formulario y no el Excel compartido:
 *   - cada campo tiene un tipo y un rango: no se puede escribir «ver cuaderno» en un monto;
 *   - el local y el responsable se eligen de una lista: no hay «centro», «CENTRO » ni «B° Jardín»;
 *   - se carga desde el celular al cerrar, con la hora de carga registrada;
 *   - cada respuesta pasa por enviar_a_supabase.gs, que controla la caja y avisa si algo no cierra.
 */
const LOCALES = ['Centro', 'Jardín'];
const RESPONSABLES = ['Sofía', 'Marcos', 'Diego', 'Lucía'];
const CLIENTES = [ // la lista la mantiene el dueño en la pestaña «Clientes» de la planilla; acá va la carga inicial
  'Restaurante La Esquina', 'Rotisería El Buen Gusto', 'Almacén Doña Rosa', 'Bodegón Los Abuelos', 'Cantina del Puerto',
  'Rotisería Sabores', 'Restaurante Il Forno', 'Almacén San Martín', 'Club Atlético Villa Sur', 'Parrilla El Fogón',
  'Bar La Plaza', 'Rotisería La Nonna', 'Restaurante Mediterráneo', 'Almacén El Trébol', 'Comedor Escolar Norte',
  'Trattoria Bella Vista', 'Rotisería Don Pepe', 'Restaurante Las Tinajas', 'Bar del Centro', 'Almacén Los Pinos',
  'Restaurante Tierra Nuestra', 'Rotisería La Familia', 'Hotel Cerro Azul', 'Restaurante El Molino'];

function crearFormularios() {
  const planilla = SpreadsheetApp.create('Pastas Don Aldo · respuestas');
  const caja = crearCierreDeCaja_(planilla);
  const mayoristas = crearMayoristas_(planilla);
  ScriptApp.newTrigger('alEnviarCierre').forForm(caja).onFormSubmit().create();
  ScriptApp.newTrigger('alEnviarMayorista').forForm(mayoristas).onFormSubmit().create();
  ScriptApp.newTrigger('recordarCierresFaltantes').timeBased().everyDays(1).atHour(22).create();
  Logger.log('Cierre de caja: ' + caja.getPublishedUrl());
  Logger.log('Pedidos y cobros: ' + mayoristas.getPublishedUrl());
  Logger.log('Planilla: ' + planilla.getUrl());
}

function numero_(form, titulo, ayuda, obligatorio, minimo) {
  const v = FormApp.createTextValidation()
    .setHelpText('Solo números, sin puntos ni signo $.')
    .requireWholeNumber().build();
  const it = form.addTextItem().setTitle(titulo).setHelpText(ayuda).setRequired(obligatorio).setValidation(v);
  if (minimo !== undefined) {
    it.setValidation(FormApp.createTextValidation().setHelpText('Tiene que ser ' + minimo + ' o más.')
      .requireNumberGreaterThanOrEqualTo(minimo).build());
  }
  return it;
}

function crearCierreDeCaja_(planilla) {
  const f = FormApp.create('Cierre de caja · Pastas Don Aldo')
    .setDescription('Uno por local, todos los días al cerrar. Los importes salen del cierre del posnet y de la billetera; ' +
                    'el efectivo se cuenta con el fondo de $ 20.000 adentro.')
    .setCollectEmail(false).setLimitOneResponsePerUser(false).setProgressBar(false);
  f.addDateItem().setTitle('Fecha del cierre').setRequired(true);
  f.addListItem().setTitle('Local').setChoiceValues(LOCALES).setRequired(true);
  f.addListItem().setTitle('Responsable').setChoiceValues(RESPONSABLES).setRequired(true);
  f.addSectionHeaderItem().setTitle('Ventas del día por medio de pago');
  numero_(f, 'Ventas en efectivo', 'Total de ventas cobradas en efectivo.', true, 0);
  numero_(f, 'Ventas con débito', 'Del cierre del posnet.', true, 0);
  numero_(f, 'Ventas con crédito', 'Del cierre del posnet.', true, 0);
  numero_(f, 'Ventas con billetera virtual', 'Del resumen de la billetera.', true, 0);
  numero_(f, 'Ventas por transferencia', 'Transferencias recibidas en el local.', true, 0);
  numero_(f, 'Cantidad de tickets', 'Cuántas ventas se hicieron (lo dice el posnet o la libreta).', true, 1);
  f.addSectionHeaderItem().setTitle('Caja');
  numero_(f, 'Gastos pagados con la caja', 'Si no hubo, poner 0.', true, 0);
  f.addListItem().setTitle('Concepto del gasto').setChoiceValues(['Verdulería', 'Limpieza', 'Delivery', 'Envases', 'Otro']).setRequired(false);
  numero_(f, 'Retiro del dueño', 'Efectivo que retiró Aldo. Si no hubo, poner 0.', true, 0);
  numero_(f, 'Efectivo contado al cierre', 'Todo el efectivo de la caja, con el fondo incluido.', true, 0);
  f.addParagraphTextItem().setTitle('Observaciones').setRequired(false);
  f.setDestination(FormApp.DestinationType.SPREADSHEET, planilla.getId());
  return f;
}

function crearMayoristas_(planilla) {
  const f = FormApp.create('Pedidos y cobros de restaurantes · Pastas Don Aldo')
    .setDescription('Cada pedido entregado y cada cobro recibido de un cliente mayorista.');
  f.addDateItem().setTitle('Fecha').setRequired(true);
  f.addListItem().setTitle('Cliente').setChoiceValues(CLIENTES).setRequired(true);
  const tipo = f.addMultipleChoiceItem().setTitle('¿Qué se registra?').setRequired(true);
  const pedido = f.addPageBreakItem().setTitle('Pedido');
  numero_(f, 'Importe del pedido', 'Según el remito.', true, 1);
  f.addMultipleChoiceItem().setTitle('Condición').setChoiceValues(['Contado', 'Cuenta corriente']).setRequired(true);
  const cobro = f.addPageBreakItem().setTitle('Cobro').setGoToPage(FormApp.PageNavigationType.SUBMIT);
  numero_(f, 'Importe cobrado', 'Lo que pagó el cliente.', true, 1);
  f.addListItem().setTitle('Medio').setChoiceValues(['Efectivo', 'Transferencia', 'Cheque']).setRequired(true);
  pedido.setGoToPage(FormApp.PageNavigationType.SUBMIT);
  tipo.setChoices([tipo.createChoice('Un pedido', pedido), tipo.createChoice('Un cobro', cobro)]);
  f.setDestination(FormApp.DestinationType.SPREADSHEET, planilla.getId());
  return f;
}
