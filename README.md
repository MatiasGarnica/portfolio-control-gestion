# Caso 03 · Alertas y auditoría continua (en construcción)

Misma empresa y base ficticia del caso 02.

**La pregunta:** ¿qué está pasando en la cartera que nadie vería mirando los totales?

## Alertas previstas
| Alerta | Qué detecta |
|---|---|
| Equipo instalado sin facturación | Cliente con equipo en comodato al que no se le factura el abono |
| Equipo sin consumo | Equipo instalado sin compras en la ventana definida |
| Pasa a recibir solo sin cargo | Cliente que compraba con cargo y empieza a recibir solo entregas sin cargo |
| Incobrables concentrados | Un mismo repartidor con varios incobrables, contra lo normal de la empresa |
| Cobros que no coinciden con las visitas | Pagos registrados en días sin visita, o visitas con deuda y sin cobro |
| Notas de crédito fuera de patrón | Movimientos desproporcionados contra la facturación habitual del cliente |
| Cambio de ruta con deuda | Cuentas pasadas a rutas que no venden, con deuda pendiente |

Cada alerta incluye por qué entró, la ficha del cliente (venta, deuda, pagos por medio, incobrables, notas de crédito y llamados) y parámetros ajustables para calibrarla.
