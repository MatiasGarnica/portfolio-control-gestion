# Caso 03 · Alertas y auditoría continua

Misma empresa ficticia del [Caso 02](../caso-02-cuenta-corriente/), **Reparto Federal S.A.**, con la base ampliada:
- 1.303 equipos en comodato y sus abonos.
- Cambios de ruta.
- El canal de cada cobro.

**[Abrir el tablero](https://matiasgarnica.github.io/portfolio-control-gestion/caso-03-alertas/)** · [Informe de control para gerencia](https://matiasgarnica.github.io/portfolio-control-gestion/caso-03-alertas/04_informes/informe-control-gerencia.html) · [Reglas de negocio](reglas-de-negocio.md)

## La pregunta
¿Qué está pasando en la cartera que nadie vería mirando los totales?

Los totales cierran aunque un equipo no se facture, un cliente reciba solo entregas sin cargo o una deuda pase a una ruta que no cobra. Siete reglas cruzan venta, deuda, equipos, cobranza, visitas y rutas todos los días. Cada alerta dice:
- qué pasó;
- por qué importa, con la plata en juego;
- qué hacer y quién;
- cómo se mide que se resolvió.

## Qué muestra
| Pestaña | Para qué sirve |
|---|---|
| **Alertas del día** | Alertas abiertas, plata en juego, nuevas de la semana, antigüedad y un mapa de calor reparto × regla para ver dónde se concentran. Muestra las 5 de más impacto con su acción, y el resto en tabla. |
| **Por regla** | Qué busca y por qué importa cada regla, con sus cortes ajustables en vivo. Muestra la plata en juego por reparto, cuándo se dispararon y la tabla de alertas. Las de reparto abren caso por caso. |
| **Clientes** | La ficha completa de cada cliente: venta con y sin cargo, pagos por medio y canal, NC e incobrables, visitas, equipos, cambios de ruta, llamados y sus alertas. |
| **Parámetros** | Todos los cortes, comparados contra los acordados. |
| **Informes** | Informe de control para gerencia, alertas en CSV, base en Excel, SQL y reglas. |

Cada alerta se puede marcar como sin revisar, en revisión, justificada o confirmada (en el portfolio se guarda en el navegador). Las NC con revisión y las entregas sin cargo con bonificación autorizada se marcan solas según los datos.

## Lo que encuentran las reglas al 09/10/2025
- **109 alertas abiertas con $ 55,5 M en juego.** Otras 11 quedaron justificadas: 8 NC con respaldo y 3 bonificaciones autorizadas.
- **Equipo sin consumo** es la regla con más plata en juego ($ 22,9 M). Diez de esos equipos siguen instalados en clientes que ya se pasaron a incobrable.
- **R-28 aparece en 4 reglas:** equipos sin consumo, incobrables, NC fuera de patrón y cambios de ruta con deuda. Otros seis repartos aparecen en 3, entre ellos R-16 y R-27. El problema es del reparto, no de un cliente.
- **12 cuentas con deuda pasaron a Administración** entre fines de agosto y principios de septiembre, 9 de ellas de repartos de Sur. Salieron de los días calle sin cobrarse.
- **R-09 y R-22 cargan cobros en efectivo en días sin visita:** 36 cobros, en promedio unos 3 días después de pasar por el cliente.

## Validación
La base trae **casos sembrados** (`01_datos/casos_sembrados.csv`). Con los parámetros acordados:

| Regla | Sembrados encontrados | Alertas no sembradas | Qué son las no sembradas |
|---|---|---|---|
| Equipo instalado sin abono | 28 de 28 | 0 | — |
| Equipo sin consumo | 25 de 25 | 12 | 10 equipos en clientes dados de baja (hallazgo real), 1 cliente movido a Administración (también en «cambio de ruta») y 1 sin explicación |
| Pasa a recibir solo sin cargo | 14 de 14 | 3 | Las 3 bonificaciones autorizadas que se sembraron como ruido: el tablero las marca como justificadas |
| Incobrables concentrados | 3 de 3 repartos | 1 | R-18: 3 incobrables por el 2,6% de su venta, una concentración real de la base |
| Cobro en efectivo sin visita | 36 de 36 cobros (2 de 2 repartos) | 0 | Las 8 visitas mal cargadas que se sembraron como ruido quedan sueltas y no llegan al mínimo de 3 por reparto |
| Nota de crédito fuera de patrón | Sin sembrados: es la regla del Caso 02 | 20 | 8 quedaron justificadas por la revisión de administración |
| Cambio de ruta con deuda | 12 de 12 | 0 | Los 43 cambios legítimos (reordenamiento de recorridos y pase a servicio técnico sin deuda) no alertan |

Además:
- **SQL:** las siete consultas de `sql/02_alertas.sql`, traducidas a DuckDB, dan las mismas 120 alertas que Python, con la misma fecha e impacto.
- **Tablero:** el motor del tablero coincide con Python con los parámetros acordados (120 alertas) y con otro juego de cortes (126).
- **Excel:** la base comprueba con fórmulas la condición de tres reglas sobre los datos crudos: abonos de octubre = 0, visitas efectivas el día del cobro = 0 y saldo al cambio de ruta igual al del motor.

```
python generate_alertas.py && python build_data.py && python build.py && python build_informe.py && python build_excel.py
python alertas.py                 # alertas y validación contra los casos sembrados
python ../sql/verificar_sql.py    # SQL Server (vía DuckDB) contra Python
```

## Cómo está hecho
> El código (Python y JavaScript) se generó con IA a partir de las reglas de negocio y el diseño que definí. Lo mío es el criterio, el modelo de datos y la validación de cada número contra una segunda fuente.

| Capa | Archivo |
|---|---|
| Datos ficticios | `02_codigo/generate_alertas.py` parte de la base del Caso 02 y agrega equipos, abonos, cambios de ruta, canal de pago, casos sembrados y ruido |
| Reglas | [`reglas-de-negocio.md`](reglas-de-negocio.md) |
| SQL Server | [`sql/01_esquema_adicional.sql`](sql/01_esquema_adicional.sql) y [`sql/02_alertas.sql`](sql/02_alertas.sql), una consulta por regla |
| Motor | `02_codigo/alertas.py`: arma los candidatos una vez y aplica los parámetros (por eso el tablero recalcula en vivo) |
| Tablero | `02_codigo/app.js` + `dashboard_template.html` → `03_tableros/alertas.html`, un solo archivo que abre sin internet |
| Informe | `02_codigo/build_informe.py` → `04_informes/informe-control-gerencia.html` |
| Excel | `02_codigo/build_excel.py` → `01_datos/Base-alertas.xlsx` |
