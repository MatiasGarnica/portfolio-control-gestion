# Caso 01 · Control de gestión de un BPO de cobranzas (datos ficticios)

Modelo de gestión de un call center de cobranzas, «Cobranzas del Sur S.A.»: presupuesto, forecast mensual, estado de resultados de gestión, rentabilidad por cartera con asignación de costos por driver, intercompany con diferencia de cambio y cotizador de carteras.
Replica la estructura de modelos Excel que usé en un empleo anterior; los datos son 100% ficticios.

**Ver el tablero:** https://matiasgarnica.github.io/portfolio-control-gestion/caso-01-fpa-bpo/

## Del Excel original al concepto de FP&A

| Modelo original | Qué hacía | Término FP&A | Dónde está en el caso |
|---|---|---|---|
| Presupuesto anual | Estado de resultados proyectado con supuestos de inflación, tipo de cambio y paritarias; escenarios | Driver-based budget | Escenario Presupuesto y pestaña Planificador |
| Proyecciones semanales | Proyección por cartera, reversas, control de cumplimiento | Rolling forecast, forecast accuracy | Escenario Forecast, alerta de desvío, reproyección oct–dic |
| Estado de resultados de gestión (ARS y USD) | Real contra forecast, presupuesto y año anterior | Budget vs actual, variance analysis | Pestaña Estado de resultados (3 niveles) |
| Diario por centro de costo | Reclasificación del mayor, eliminaciones, devengamiento de SMS, mails y telefonía | Conciliación contable → gestión | Botón «De contable a gestión» |
| Matriz de rentabilidad | Costos compartidos asignados por driver (minutos, SMS, mails, dotación, licencias, pagos) | Activity-based costing, rentabilidad por cliente | Pestaña Rentabilidad y sankey |
| Ingreso por hora | Ingreso y costo por operador y por hora | Unit economics | Tarjeta Ingreso por hora |
| Cotizaciones de carteras | Deuda × % de recupero × fee; costo de agentes, supervisión y canales | Deal pricing, break-even | Cotizador y propuesta descargable |
| Gastos a recuperar y deuda en USD | Gastos corporativos distribuidos a los países; diferencia de cambio sobre la cuenta corriente en USD | Intercompany allocation, FX remeasurement | Pestaña Intercompany y TC |
| Remuneraciones e indicadores de RRHH | Costo por negocio, dotación, rotación, ausentismo | Headcount planning | Planificador › Dotación (remuneraciones ocultas por defecto) |
| Valor unitario de canales | Precio unitario por proveedor y canal | Unit cost tracking | Alerta de costo por SMS |

## Qué hay en cada carpeta
| Carpeta | Contenido |
|---|---|
| `01_datos` | Modelo estrella en CSV (`dim_cartera`, `dim_cuenta`, `dim_fecha`, `fact_resultado`, `fact_drivers_cartera`, `fact_kpi_operacion`, `fact_intercompany`, `fact_conciliacion`), `dashboard_data.json` (lo que lee el tablero) y `Base-control-gestion.xlsx` (respaldo) |
| `02_codigo` | `generate_case.py` (genera los datos con semilla fija), `dashboard_template.html` + `app.js` (tablero), `build_plan.py` (plantilla Excel del planificador), `build.py` (arma el HTML), `echarts.local.js` (para la versión sin internet) |
| `03_tableros` | Tablero v5: versión online y `_offline` (abre sin internet). `Planificador-2025-2026_v1.xlsx`: el planificador en Excel con fórmulas vivas |
| `04_informes` | Informes descargados desde el tablero: gerencia de un vistazo, reunión de gestión, supervisores |
| `05_powerbi` | Proyecto Power BI (PBIP: modelo en TMDL + informe en PBIR), 189 medidas DAX documentadas en `MEDIDAS.md`, generador `build_pbip.py` |
| `06_looker` | Datos planos para Google Sheets / Looker Studio y su generador |
| `07_docs` | Criterios y mapeo, guía de Power BI y Looker Studio, maquetas y prototipos de diseño |

## Regenerar (desde `02_codigo`)
> El código (Python y JavaScript) se generó con IA a partir de las reglas de negocio y el diseño que definí. Lo mío es el criterio, el modelo de datos y la validación de cada número contra una segunda fuente.

```
pip install pandas numpy openpyxl
python generate_case.py              → reescribe 01_datos
python build_plan.py v1              → plantilla del planificador y su Excel
python build.py v5                   → tablero HTML (+ _offline)
python ../05_powerbi/build_pbip.py   → proyecto Power BI
python ../06_looker/build_looker.py  → Excel para Looker Studio
```
Escenarios: REAL (ene-24 a sep-25), PPTO 2025, FCST 2025. Ingreso = deuda asignada × % de recupero × fee × tipo de cambio.

## Planificador
- **Cierre 2025** = real ene–sep + reproyección oct–dic, contra presupuesto 2025 y forecast vigente. **Presupuesto 2026** mes a mes.
- **Base**: run-rate jul–sep 2025 a precios de septiembre. Cada línea se mueve con el índice de su categoría (precios, salarial, tipo de cambio, SMS, posiciones, volumen).
- **Se carga**: inflación, tipo de cambio, paritarias por tramos y precio del SMS mes a mes, con escenarios rápidos; por cartera, volumen, % de recupero, fee y posiciones.
- **Excel con fórmulas**: el tablero completa la plantilla con lo cargado y la descarga; Excel recalcula al abrir. Tablero y Excel usan la misma lógica (240 celdas del estado de resultados verificadas, diferencia 0).
- **Escenarios**: se guardan con nombre, se comparan contra la base y se recuperan desde Excel.

## Actualización diaria (cómo funciona en una empresa)
Solo cambia `dashboard_data.json`: una tarea programada corre la consulta SQL, regenera el JSON y vuelve a ejecutar `build.py`. La plantilla y la lógica no se tocan.
