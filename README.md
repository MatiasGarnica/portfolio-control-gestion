# Control de gestión y BI · portfolio

Soy Matías Garnica, contador (UBA) y analista de control de gestión. Este repo reúne casos armados con **datos 100% ficticios** que replican trabajos reales: presupuesto y forecast, rentabilidad, cobranzas y alertas de control.

**Ver los tableros:** https://matiasgarnica.github.io/portfolio-control-gestion/

## Cómo trabajo

| Capa | Qué hago | Dónde se ve en el repo |
|---|---|---|
| Negocio | Reglas que no están en la base: qué cuenta entra, qué se excluye, cómo se lee cada número | `07_docs/criterios-y-mapeo.md` (caso 01) · `reglas-de-negocio.md` (casos 02 y 03) |
| Datos | Modelo estrella; consultas en SQL Server sobre una base ficticia | `01_datos` · `sql` (casos 02 y 03) |
| Entrega | Power BI (PBIP con DAX), tableros HTML e informes por audiencia | `03_tableros`, `04_informes`, `05_powerbi` |
| Herramienta y automatización | Corrida diaria programada: consulta → datos → tablero publicado. Elijo la herramienta que pide cada caso: Power BI, Looker Studio, un tablero HTML o un formulario con base en la nube. La IA escribe el código de apoyo a partir de mis reglas; yo diseño la solución y valido cada número | `02_codigo` |
| Análisis | Una sola vista con lo que antes estaba en varios informes (ventas, deuda, pagos, notas de crédito, llamados) para detectar desvíos y alertas con su acción | Pestañas de resumen y alertas |

Cada número se cruza con una segunda fuente antes de publicarse.

## Casos

| # | Caso | Qué muestra | Estado |
|---|---|---|---|
| 01 | [Control de gestión de un BPO de cobranzas](caso-01-fpa-bpo/) | Presupuesto y forecast, estado de resultados de gestión, rentabilidad por cartera con costos asignados por driver, intercompany y diferencia de cambio, cotizador y planificador con escenarios. Tablero HTML, Power BI y Looker Studio | Terminado |
| 02 | [Cuenta corriente con hoja de trabajo semanal](caso-02-cuenta-corriente/) | La lista de cuentas a gestionar cada lunes y el resultado medido al cierre de la semana; días calle, mix de cobranza y control de notas de crédito. Tablero HTML, informe para supervisores, SQL Server verificado contra un cálculo independiente y base en Excel | Terminado |
| 03 | [Alertas y auditoría continua](caso-03-alertas/) | Siete reglas diarias que cruzan venta, deuda, equipos, cobranza, visitas y rutas; cada alerta con qué pasó, por qué importa, qué hacer y cómo se mide, y la ficha completa del cliente. Validadas contra casos sembrados; SQL verificado contra un cálculo independiente | Terminado |
| 04 | [Pyme sin sistema: del Excel compartido al formulario](caso-04-pyme-sin-sistema/) | Una pyme con dos locales que pasa del Excel compartido a un formulario de Google con validaciones, control automático de cada cierre y base en Supabase (PostgreSQL). Limpieza del Excel con registro de cada problema, arqueo de caja, mix de medios de pago y fiado de los restaurantes. Tablero para el celular y mail del lunes | Terminado |

## Herramientas
- **En el trabajo diario:** SQL Server (T-SQL) · Power BI (DAX, Power Query) · Excel
- **También en estos casos:** Looker Studio · PostgreSQL (Supabase) · Google Forms y Sheets
- **Código de apoyo generado con IA y revisado por mí:** Python (datos ficticios, armado y verificaciones) · HTML/JavaScript (tableros web) · Apps Script (caso 04)

## Sobre los datos
Ningún archivo contiene datos de empresas, clientes ni personas reales. Los datos se generan con los scripts de cada caso (semilla fija) y reproducen la estructura, no los valores, de los modelos originales.
