# Reglas de negocio · Caso 02

Lo que no está en la base y define cada número del tablero. Mismo criterio en `02_codigo/hoja.py`, en el tablero (`app.js`) y en las consultas de `sql/`; `sql/verificar_sql.py` comprueba que los tres den lo mismo.

## Qué cuentas entran
| Regla | Por qué |
|---|---|
| Fuera las **cuentas internas** (`cuenta_interna = 1`) | Son consumos de la propia empresa: tienen saldo pero nadie las cobra. Si entran, inflan la deuda y la hoja. |
| Fuera los clientes de **repartos no comerciales** (técnicos y administración) | No venden: atienden instalaciones, retiros y trámites. Sus movimientos no miden la gestión de cobranza. |
| Se mide por el **reparto del cliente** | La deuda al cierre se asigna al reparto que lo atiende hoy, no al que hizo cada venta. |

El tablero muestra cuántas quedan afuera (`meta.fuera`) para que nadie las busque.

## Qué es deuda
- **Débitos:** ventas con cargo, saldo inicial al 31/12/2024 y **reversas de pago** (pago que el cliente desconoce y la plataforma devuelve).
- **Créditos:** pagos, notas de crédito e incobrables.
- **Ventas con cargo y sin cargo:** las unidades sin cargo de la promo 2×1 se registran en `unidades_sin_cargo` y no suman importe. Si se mezclaran, la venta crecería sin plata detrás y los días calle se verían mejor de lo que son.
- **Antigüedad FIFO:** lo cobrado cancela primero el cargo más viejo. «Vencido a más de 45 días» es lo que queda sin cancelar de cargos con más de 45 días. Si el saldo es cero o a favor, no hay vencido.

## La hoja de la semana
Se arma el **lunes a las 7:00 con los datos hasta el domingo** y no cambia en la semana. Cada cuenta entra por **un solo foco**, el primero que cumple:

| # | Foco | Condición (parámetros acordados) |
|---|---|---|
| 1 | Deuda vencida | Vencido a más de 45 días ≥ $ 15.000 |
| 2 | Sin visita del reparto | Saldo ≥ $ 15.000 y el reparto no pasa hace más de 14 días (o nunca pasó) |
| 3 | Ritmo de pago atrasado | Días sin pagar > 2 × su intervalo habitual entre pagos (y más de 14), con saldo ≥ $ 15.000. El intervalo habitual es la mediana de los últimos 180 días; hacen falta al menos 3 pagos |
| 4 | NC fuera de lo normal | Notas de crédito de los últimos 30 días ≥ $ 20.000 y más de la mitad de lo que factura en un mes habitual |

El orden importa: una cuenta con deuda vencida y sin visita se gestiona por la deuda, y el «qué hacer» lo dice.

### Cómo terminó cada cuenta (de lunes a sábado)
| Foco | Resuelta | En parte | Salió sola |
|---|---|---|---|
| Deuda vencida | Pagó todo lo vencido | Pagó algo | Sin pago, pero lo vencido bajó del piso (por ejemplo, una NC) |
| Sin visita | El reparto pasó y cobró | Pasó sin cobrar | El saldo bajó del piso sin visita |
| Ritmo atrasado | Pagó al menos el 80% de su pago habitual | Pagó menos | — |
| NC fuera de lo normal | Administración la revisó | — | — |

Lo demás queda **pendiente** y vuelve a entrar el lunes siguiente si sigue cumpliendo.

- **Con resultado** = resueltas + en parte, sobre las cuentas de la hoja del lunes. Objetivo acordado: 45% al sábado.
- **Salió sola** no cuenta como resultado: nadie la gestionó.
- **Nuevas** = no estaban el lunes y al cierre cumplen alguna condición. No cambian la resolución de esta semana; entran a la hoja del lunes que viene.
- **Semana en curso:** la resolución se muestra pero no se juzga contra el objetivo hasta el sábado.

## Días calle y cobranza
- **Días calle** = deuda al cierre del mes ÷ (venta del mes ÷ días de reparto). Días de reparto: lunes a sábado; octubre se corta el 09/10.
- **Deuda al cierre:** suma de los saldos positivos de cada cuenta al último día del mes. Los saldos a favor no restan: no compensan la deuda de otro cliente.
- **Mix de cobranza:** efectivo, billetera virtual, link de pago, débito automático y transferencia.
- **Costo de plataformas:** lo cobrado por cada medio × su comisión vigente, sin IVA (`dim_medio_pago`).

## Control de notas de crédito
- Una NC entra al control cuando supera **$ 50.000** y es más de **2 veces la facturación mensual habitual** del cliente (venta de los 180 días anteriores ÷ 6). Un cliente sin facturación previa con una NC grande entra siempre.
- **No es el motivo, es el monto.** El motivo cargado suele ser «bonificación comercial» o «devolución de producto»; lo que delata el caso es la proporción contra lo que el cliente compra.
- **Revisión:** la primera gestión «Revisión de nota de crédito» de administración dentro de las 3 semanas. Resultados: justificada, mal cargada (se corrige) o sin respaldo (se informa a supervisión). La revisión arrancó junto con la hoja: el porcentaje de revisadas se mide desde julio.
- **Patrón por reparto:** NC + incobrables de los últimos 3 meses cerrados sobre la venta del reparto. Se marca cuando supera el 4% y el triple de la mediana de los repartos. Un caso aislado se revisa; un patrón se habla con el supervisor.

## Gestiones
- **Llamados** de supervisión con resultado (promete pago, no atiende, pide plan de pago, reclama una NC, reclamo por el servicio, pagará al repartidor). Una promesa de pago cambia el «qué hacer» de la cuenta a «seguir la promesa del llamado».
- **Pagos desconocidos por el cliente:** la plataforma revierte el pago y la deuda vuelve. Se registran como «Reversa de pago» para que el saldo no quede mal.

## Parámetros
Los cortes se pueden probar en la pestaña Parámetros del tablero (se guardan solo en esa computadora). Cuando un criterio queda acordado con gerencia, administración y comercial, se cambia en `hoja.py`, en la CTE `par` de los SQL y en `DEF` de `app.js`, para que todos vean lo mismo.
