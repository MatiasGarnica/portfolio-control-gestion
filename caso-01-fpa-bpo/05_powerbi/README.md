# Power BI · Caso 01 (proyecto PBIP, versión 3)

Versión Power BI del tablero de control de gestión de Cobranzas del Sur S.A. (datos 100% ficticios). Es un **proyecto de Power BI en texto** (PBIP): el modelo está en TMDL y el informe en PBIR. Se abre con Power BI Desktop como un .pbix y, por ser texto, se puede versionar en GitHub.

## Cómo abrirlo
1. **Power BI Desktop actualizado.** Las tarjetas usan el visual de imagen enlazado a una medida (imagen desde datos). Si lo instalaste desde Microsoft Store se actualiza solo; si las tarjetas aparecen vacías, actualizá Desktop.
2. **Abrir** `CobranzasDelSur_v3\CobranzasDelSur.pbip` y tocar **Actualizar**. Hasta que se cargan los datos los visuales aparecen vacíos.
3. **Datos.** El modelo lee los CSV de la carpeta `01_datos` del caso. Después de clonar o descargar el repo: Inicio › Transformar datos › Editar parámetros › **CarpetaDatos** (terminado en `\`) y Actualizar.
4. **Controlar** con septiembre y vista Mes: ingresos $ 422,6 M (−10,8% contra presupuesto), margen operativo 17,6%, utilidad neta $ 57,5 M, ingreso por hora $ 20.521, cierre proyectado $ 554,4 M. Acumulado enero a septiembre: ingresos $ 3.384,4 M, margen operativo 14,7%, utilidad neta $ 391,8 M.
5. **Guardar.** Ctrl+S guarda el proyecto en la misma carpeta. Para mandarlo como un solo archivo: Archivo › Guardar como › .pbix.


## Qué tiene
| Página | Qué muestra |
|---|---|
| Resumen | Cinco tarjetas (ingresos, margen operativo, utilidad neta, ingreso por hora, cierre proyectado): valor, estado (En línea, Atención, Desvío), variación contra presupuesto, mes anterior y año anterior, y tendencia del año. Ingresos mes a mes (real y forecast contra presupuesto y año anterior), «Lo que hay que saber» escrito con los números del período y desvío de ingresos por cartera |
| Estado de resultados | Renglones ejecutivos (rubros, margen bruto, margen operativo, resultado antes de impuestos, utilidad neta y sus %) con real, presupuesto, desvío, forecast y año anterior en colores; puente del presupuesto a lo real; margen operativo mes a mes; detalle rubro › subrubro › ítem |
| Carteras | Tabla con bala real contra presupuesto, desvíos en colores, margen de contribución con semáforo, ingreso por hora y recupero; productividad contra rentabilidad; recupero contra presupuesto |
| Drivers | Botones de cartera (ninguna = todas): tarjetas de recupero, fee, deuda asignada y posiciones, y su evolución mes a mes con presupuesto y forecast |
| Cómo se usa | Cómo se lee, cómo está armado, control de números y glosario |

**Período:** botones de mes y de vista (mes o acumulado), sincronizados en todas las páginas. Son tablas sin relación: las medidas leen la selección, así los gráficos del año siguen mostrando los doce meses.

**Modelo (estrella):** Resultado, Drivers y KPI (hechos) con Calendario, Cartera, Cuenta y Escenario (dimensiones), más MesAnalisis, Vista y Línea EERR sin relación. 189 medidas en `_Medidas`, en carpetas y con descripción: 18 devuelven una imagen SVG (tarjetas, encabezados, narrativa y celdas de tabla) y la carpeta *8. Textos y títulos* tiene las variaciones como texto («▲ +4,8% vs mes anterior») y su color, listas para usar en tarjetas nativas, títulos o tooltips. El DAX de cada una está en `MEDIDAS.md`.

## Qué cambió contra la versión 2
- **Formatos:** sin el escalado `,,` (no funciona con la configuración regional es-AR y mostraba «mill. M»). Los millones se calculan en la medida y los ejes no usan unidades automáticas.
- **Tablas:** la tabla de carteras mostraba solo la primera columna (la proyección estaba marcada como nivel de una jerarquía). Corregido.
- **Segmentadores:** botones de mes, vista y cartera en lugar de listas desplegables cortadas.
- **Tarjetas y textos:** valor, estado y tres variaciones con color; narrativa automática; títulos con el año.
- **Validación:** informe validado con el validador oficial de Microsoft para PBIR (`powerbi-report-author validate`, 0 errores) y tema validado contra el esquema de temas de Power BI Desktop.

## Archivos
| Archivo | Qué es |
|---|---|
| `CobranzasDelSur_v3\` | Proyecto PBIP: `.pbip`, `CobranzasDelSur.SemanticModel\` (TMDL), `CobranzasDelSur.Report\` (PBIR y tema de colores) |
| `AAAA-MM-DD_PowerBI_CobranzasDelSur_v3.zip` | El mismo proyecto en un zip, con copia de los CSV en `datos\` |
| `MEDIDAS.md` | Las medidas con su DAX y explicación |
| `build_pbip.py` · `pbip_svg.py` | Generan el proyecto desde cero: `python build_pbip.py v3 ["ruta\a\01_datos\"]` |

## Para usarlo con datos de otra empresa
Reemplazar los CSV respetando las columnas (ver `01_datos`) y actualizar. Las medidas no dependen de los nombres de las carteras ni de las cuentas, salvo el número de rubro al principio de `n1` (1 ingresos, 2 costos de explotación, 3 impuestos directos, 4 estructura, 5 no operacional, 6 ganancias), que arma el estado de resultados.
