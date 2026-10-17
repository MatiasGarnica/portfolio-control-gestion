# Control de gestión y BI · portfolio

Soy Matías Garnica, contador (UBA) y analista de control de gestión. Este repo reúne casos armados con **datos 100% ficticios** que replican trabajos reales: presupuesto y forecast, rentabilidad, cobranzas y alertas de control.

**Ver los tableros:** https://matiasgarnica.github.io/portfolio-control-gestion/

## Cómo trabajo

| Capa | Qué hago | Dónde se ve en el repo |
|---|---|---|
| Negocio | Reglas que no están en la base: qué cuenta entra, qué se excluye, cómo se lee cada número | `07_docs/criterios-y-mapeo.md` (caso 01) · `reglas-de-negocio.md` (casos 02 y 03) |
| Datos | Modelo estrella; consultas en SQL Server sobre una base ficticia | `01_datos` · `sql` (casos 02 y 03) |
| Entrega | Power BI (PBIP con DAX), tableros HTML e informes por audiencia | `03_tableros`, `04_informes`, `05_powerbi` |
| Automatización | Corrida diaria programada: consulta → datos → tablero publicado. La IA acelera el armado y trabaja solo sobre la base | `02_codigo` |
| Análisis | Desvíos, alertas y puentes de variación antes que tablas | Pestañas de resumen y alertas |

Cada número se cruza con una segunda fuente antes de publicarse.

## Casos

| # | Caso | Qué muestra | Estado |
|---|---|---|---|
| 01 | [Control de gestión de un BPO de cobranzas](caso-01-fpa-bpo/) | Presupuesto y forecast, estado de resultados de gestión, rentabilidad por cartera con costos asignados por driver, intercompany y diferencia de cambio, cotizador y planificador con escenarios. Tablero HTML, Power BI y Looker Studio | Terminado |
| 02 | [Cuenta corriente con hoja de trabajo semanal](caso-02-cuenta-corriente/) | La lista de cuentas a gestionar cada lunes y el resultado medido al cierre de la semana; días calle y mix de cobranza | En construcción |
| 03 | [Alertas y auditoría continua](caso-03-alertas/) | Reglas que detectan comportamientos fuera de lo normal en facturación, cobranza y notas de crédito, con la ficha completa del cliente | En construcción |

## Herramientas
SQL Server (T-SQL) · Power BI (DAX, Power Query, PBIP) · Excel · Python (pandas) · HTML/JavaScript (ECharts) · Looker Studio

## Sobre los datos
Ningún archivo contiene datos de empresas, clientes ni personas reales. Los datos se generan con los scripts de cada caso (semilla fija) y reproducen la estructura, no los valores, de los modelos originales.
