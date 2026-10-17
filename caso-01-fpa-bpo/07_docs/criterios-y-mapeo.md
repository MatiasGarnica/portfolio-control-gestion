# Caso 01 · Criterios y mapeo (Excel original → FP&A → tablero)

Origen: modelos Excel de un empleo anterior (2024). Contienen nombres reales de clientes, facturación por cliente, sueldos y nómina: **no se publican ni se copian a esta carpeta**. El caso replica la estructura con datos 100% ficticios ("Cobranzas del Sur S.A.").

## Mapeo

| Modelo original | Qué hacía | Término FP&A | En el caso |
|---|---|---|---|
| Presupuesto anual | EERR proyectado con supuestos de inflación, TC y paritarias; escenarios | Driver-based budget | Escenario Presupuesto + pestaña Presupuesto 2026 |
| Proyecciones semanales | Proyección semanal por cartera, reversas, control de cumplimiento | Rolling forecast, forecast accuracy | Escenario Forecast, alerta de desvío, "Cómo fue la proyección" por cartera |
| EERR de gestión (ARS y USD) | Real vs Forecast vs Ppto vs año anterior | Budget vs Actual, variance analysis | Pestaña Estado de resultados (3 niveles) |
| Diario por centro de costo | Reclasificación del mayor, eliminaciones, devengamiento de SMS, mails y telefonía | Conciliación contable → gestión | Botón "De contable a gestión" |
| Matriz de rentabilidad | Costos compartidos asignados por driver (minutos, SMS, mails, dotación, licencias, pagos) | Activity-based costing, rentabilidad por cliente | Pestaña Rentabilidad + sankey |
| Ingreso por hora | Ingreso y costo por operador y por hora | Unit economics, productividad | Tarjeta Ingreso por hora |
| Cotizaciones de carteras | Deuda × % recupero × fee; costo de agentes, supervisión y canales; escenarios | Deal pricing, break-even | Cotizador de carteras + propuesta descargable |
| Gastos a recuperar + deuda USD | Gastos corporativos (TI, Gerencia) distribuidos a países; diferencia de cambio sobre cta. cte. USD | Intercompany allocation, FX remeasurement | Pestaña Intercompany y TC |
| Remuneraciones e indicadores RRHH | Costo por negocio, dotación, rotación, ausentismo | Headcount planning | Efecto dotación vs paritaria |
| Valor unitario de canales | Precio unitario por proveedor y canal | Unit cost tracking | Alerta de costo por SMS |

## Qué contiene la v2
- Resumen: 6 tarjetas con apertura, lectura automática, alertas con "ver detalle", puente de ingresos y de resultado.
- Detalle encadenado con botón Volver: Ingresos → cartera → drivers (deuda, recupero, fee), proyección vs real, costos.
- Estado de resultados con 3 niveles (bloque → cuenta → ítem) y detalle por cartera; versión reducida en celular.
- Simulador de cierre oct–dic (inflación, paritaria, TC, recupero, volumen) con contexto macro real vs presupuesto.
- Presupuesto 2026 desde run-rate jul–sep 2025: supuestos macro + decisiones por cartera.
- Informes HTML descargables por reunión y exportaciones Excel.
- Paletas de marca; adaptable a PC, notebook y celular.

## Criterios de diseño (resumen)
- Audiencia y frecuencia definen el formato (skill `tableros-por-audiencia`).
- Explicar el desvío antes de juzgarlo: "creció pero no llegó porque el presupuesto suponía más inflación".
- Notación de escenarios estilo IBCS; formato es-AR; decimales con sentido.
- Sensibilidad: sueldos solo RRHH, gerencia y control de gestión → un archivo por audiencia.
- Metodología y fuentes se documentan acá, no dentro del tablero.

## Cómo se comparte
- Link del artifact: privado hasta compartirlo desde el menú Compartir.
- Archivo `_offline`: abre en cualquier navegador sin internet.
- GitHub Pages: link público y estático (solo datos ficticios).
