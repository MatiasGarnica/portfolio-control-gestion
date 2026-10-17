# Reglas de negocio · Caso 03

Misma empresa y mismas reglas de alcance que el [Caso 02](../caso-02-cuenta-corriente/reglas-de-negocio.md): las cuentas internas quedan fuera. Cada regla está escrita igual en `02_codigo/alertas.py`, en el tablero (`app.js`) y en `sql/02_alertas.sql`. `sql/verificar_sql.py` comprueba que las tres den las mismas alertas, con la misma fecha y el mismo impacto.

## Qué agrega la base al Caso 02
| Dato | Para qué |
|---|---|
| **Equipos en comodato** (`dim_equipo`, `fact_equipo`) | Dispensers y heladeras de la empresa instalados en el cliente. Tienen dos modalidades: con **abono mensual** o **a cambio de consumo**. El técnico registra instalación y retiro. |
| **Abonos** (`fact_abono`) | El abono de cada equipo se factura entre el 1 y el 3 de cada mes, desde el mes siguiente a la instalación. |
| **Cambios de ruta** (`fact_cambio_reparto`) | Cada vez que un cliente pasa de un reparto a otro, con el motivo cargado. |
| **Canal del pago** (`fact_pago.canal`) | El efectivo puede cobrarlo el reparto en la visita o pagarse en la sucursal. Solo el primero tiene que coincidir con una visita. |
| **Bonificaciones autorizadas** (`fact_gestion`) | Las registra comercial. Justifican entregas sin cargo. |
| **Clientes dados de baja** | Un cliente pasado a incobrable deja de ser atendido. Si sigue comprando, es una señal. |

## Las siete reglas
| Regla | Se dispara cuando… (parámetros acordados) | Impacto en $ | Responsable |
|---|---|---|---|
| **Equipo instalado sin abono** | Equipo con abono mensual, instalado hace más de 45 días, al que le falta el abono del último mes | Abono × meses sin facturar desde enero | Administración |
| **Equipo sin consumo** | Equipo en comodato por consumo, instalado hace más de 60 días, en un cliente sin compras con cargo hace más de 45 días | Valor de reposición del equipo | Comercial |
| **Pasa a recibir solo sin cargo** | En los últimos 28 días tuvo al menos 2 entregas, todas sin cargo, y en los 84 días anteriores compraba con cargo (al menos 4 entregas) | Entrega promedio con cargo × entregas sin cargo | Supervisión |
| **Incobrables concentrados** | Por reparto, en 180 días: al menos 3 incobrables y más de 4 veces la mediana de los repartos (incobrables sobre venta), o 2 incobrables o más a clientes que siguieron comprando | Incobrables del reparto en la ventana | Gerencia de cobranzas |
| **Cobro en efectivo sin visita** | Por reparto, en 60 días: 3 o más cobros en efectivo cargados por el reparto en un día en que no visitó a ese cliente | Efectivo de esos cobros | Supervisión |
| **Nota de crédito fuera de patrón** | En 90 días: NC de $ 50.000 o más y más de 2 veces la facturación mensual habitual del cliente (venta de los 180 días previos ÷ 6) | Importe de la NC | Administración |
| **Cambio de ruta con deuda** | Cliente pasado a un reparto que no vende (técnico o administración) con saldo de $ 20.000 o más ese día | Saldo al cambio | Gerencia de cobranzas |

### Por qué cada una
- **Sin abono:** el técnico instala y nadie da de alta el abono, o un cambio de domicilio lo da de baja. Es facturación que se pierde todos los meses y nadie la reclama.
- **Sin consumo:** el equipo es un activo de la empresa prestado a cambio de consumo. Si el cliente no compra o fue dado de baja, hay que reactivarlo o retirar el equipo.
- **Solo sin cargo:** la promo 2×1 y las bonificaciones no suman importe. Un cliente que recibe solo eso no aparece en la venta pero se lleva producto. Si no hay una bonificación autorizada, puede ser producto entregado y cobrado por fuera.
- **Incobrables:** un incobrable baja la deuda de golpe. Si el cliente sigue comprando, no era incobrable: la deuda se borró en lugar de cobrarse.
- **Cobro sin visita:** cobrar en la visita y cargarlo días después es tener la plata del cliente fuera de la caja. También puede ser una visita mal cargada. Por eso la alerta es por reparto y pide varios casos.
- **NC fuera de patrón:** el motivo cargado suele parecer normal. Lo que delata el caso es el monto contra lo que el cliente compra.
- **Cambio de ruta con deuda:** cierra un hueco del Caso 02. Las cuentas de repartos que no venden quedan fuera de los días calle. Pasar un deudor a Administración mejora el indicador del reparto de origen sin cobrar un peso.

## Estado de cada alerta
- **Sin revisar** es el estado inicial.
- **Justificada** se asigna sola en dos casos, y no cuenta como abierta:
  - NC con revisión «justificada» de administración.
  - Entregas sin cargo cubiertas por una bonificación autorizada en los 30 días anteriores.
- **Confirmada** se asigna sola cuando la revisión de la NC dio «mal cargada» o «sin respaldo».
- Lo demás lo marca quien revisa: en revisión, justificada o confirmada.
  - En el tablero de portfolio se guarda en el navegador.
  - En la versión de la empresa va a una tabla de alertas compartida.

## Fecha en que se dispara
Sirve para separar las nuevas (últimos 7 días) y medir la antigüedad:

| Regla | Fecha |
|---|---|
| Sin abono | La más tardía entre la instalación más la tolerancia y el primer mes sin abono del tramo actual |
| Sin consumo | Última compra con cargo más los días de la regla, más uno |
| Solo sin cargo | La segunda entrega sin cargo de la ventana |
| Incobrables | El incobrable que completa la condición |
| Cobro sin visita | El cobro que completa la condición |
| NC | La fecha de la NC |
| Cambio de ruta | La fecha del cambio |

## Cómo se validan
La base trae **casos sembrados** (`01_datos/casos_sembrados.csv`): situaciones puestas a propósito, con su detalle. Con eso se mide cuántos encuentra cada regla y cuántas alertas aparecen sin estar sembradas. Las alertas no sembradas no son siempre errores: pueden ser ruido o hallazgos reales. El resultado está en el [README](README.md#validación).
