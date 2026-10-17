# Reglas · Caso 04

Las cuentas son las mismas en `02_codigo/indicadores.py`, en las vistas de Supabase (`02_codigo/supabase/02_vistas.sql`) y en el tablero (`app.js`). `verificar_vistas.py` y la prueba del tablero comprueban que coincidan.

## Caja
| Concepto | Regla |
|---|---|
| Venta del día | Efectivo + débito + crédito + billetera virtual + transferencia. |
| Efectivo esperado | Fondo de caja ($ 20.000) + ventas en efectivo − gastos pagados con la caja − retiro del dueño. |
| Diferencia | Efectivo contado − efectivo esperado. |
| Cuadra | La diferencia es de $ 500 o menos, para arriba o para abajo. Si falta más, es **faltante**; si sobra más, **sobrante**. |
| Objetivo | 8 de cada 10 cierres cuadran, por responsable y por mes. |
| Cierre sin cargar | Día abierto (martes a domingo) sin cierre de ese local, desde el 1 de junio. Antes, en el Excel, no se podía saber. |
| Ticket promedio | Venta ÷ cantidad de tickets. Solo desde junio: el Excel no tenía tickets. |
| Costo de plataformas | Débito 1,5%, crédito 3,5%, billetera 0,8% de lo cobrado por cada medio, sin IVA. Efectivo y transferencia no pagan comisión. |

Los meses del Excel no tienen efectivo contado ni responsable: muestran venta y mix, pero no arqueo.

## Restaurantes y fiado
| Concepto | Regla |
|---|---|
| Fiado | Lo comprado en cuenta corriente − lo cobrado. Lo cobrado cancela primero lo más viejo; «debe desde» es la compra más vieja que sigue sin pagar. |
| Ritmo habitual | Mediana de los días entre compras de los últimos 180 días; hacen falta al menos 3 compras. Sin ritmo, se usan 7 días. |
| Nuevo | Su primera compra fue hace menos de 90 días. |
| Dejó de comprar | Lleva más de 4 veces su ritmo sin comprar (y más de 30 días). |
| En riesgo | Lleva más de 2 veces su ritmo sin comprar (y más de 10 días). |
| Compra menos seguido | En las últimas 6 semanas hizo menos del 70% de las compras que le tocaban por su ritmo. Detecta al que sigue comprando pero espaciado, que las dos reglas anteriores no ven. |
| Paga menos de lo que compra | En los últimos 90 días pagó menos del 70% de lo que compró a cuenta. |

«A quién llamar» ordena por la plata en juego: lo que debe y lo que compra por mes.

## Limpieza del Excel (enero a mayo)
| Problema | Qué se hizo |
|---|---|
| Fechas como texto («5/1», «05-01-25», «Jue 2/1») | Se convierten a fecha de 2025. Una fecha que no se puede leer descarta la fila (no hubo ninguna). |
| Montos como texto («$ 35.160», «12.500,00», «4800.-») | Se convierten a número. Esto es lo que la columna Total del Excel no sumaba. |
| Monto ilegible («ver cuaderno») | Queda sin dato y la fila se marca como incompleta. |
| Local escrito distinto («jardin», «B° Jardín», «CENTRO ») | Se unifica. |
| Filas «TOTAL SEMANA» y «TOTAL MES» | Se descartan. |
| Filas pegadas dos veces | Se deja una. |
| Billetera y transferencia juntas hasta marzo | Todo queda como transferencia: no se puede separar. |
| Cliente del fiado escrito a mano («Rest. Il Forno», «DOÑA ROSA») | Se busca contra la lista de clientes, sin el rubro y sin tildes; si no coincide exacto, por parecido. |
| Saldo del fiado arrastrado a mano | Se recalcula desde los pedidos y los pagos; cada quiebre queda anotado. |

## Formulario y base
- **Validaciones del formulario:** fecha con calendario; local, responsable, cliente y concepto de una lista; montos enteros y no negativos; tickets 1 o más; campos obligatorios.
- **Base (Supabase):**
  - Un cierre por local y día (`unique`).
  - Montos ≥ 0 (`check`).
  - Los cierres del formulario deben traer responsable, tickets y efectivo contado.
  - Con seguridad por fila, solo el script (clave de servicio) escribe. El tablero lee con un usuario.
- **Avisos por mail al dueño:**
  - Faltan más de $ 2.000 en la caja.
  - El ticket promedio da menos de $ 2.000 o más de $ 60.000.
  - Hay un gasto sin concepto.
  - La fecha es posterior a hoy.
  - El cierre está repetido.
  - A las 22:00, un local no cargó el cierre (los lunes no abre).
- **Respaldo:** cada envío queda en la planilla de Google. Si la base no responde, la fila se marca y se reintenta a la noche.
