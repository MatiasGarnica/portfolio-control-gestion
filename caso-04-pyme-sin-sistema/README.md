# Caso 04 · Pyme sin sistema: del Excel compartido al formulario con base en la nube

Empresa ficticia: **Pastas Don Aldo**, fábrica de pastas frescas con dos locales (Centro y Jardín) que además vende a 24 restaurantes, rotiserías y almacenes.

**[Abrir el tablero](https://matiasgarnica.github.io/portfolio-control-gestion/caso-04-pyme-sin-sistema/)** · [Resumen del lunes (mail)](https://matiasgarnica.github.io/portfolio-control-gestion/caso-04-pyme-sin-sistema/04_informes/resumen-semanal.html) · [Reglas](reglas-de-negocio.md)

## La pregunta
¿Cerró bien la caja, cuánto entra por cada medio de pago y qué restaurantes dejaron de comprar o no pagan?

Hasta mayo, todo se anotaba en un Excel compartido: una hoja por mes para la caja y otra para el fiado. Desde el 1 de junio, cada local carga el cierre en un **formulario de Google desde el celular**. Un **Apps Script** controla cada envío y lo guarda en **Supabase** (PostgreSQL). El tablero y el mail del lunes leen de ahí. Sin sistema de gestión y sin costo de licencias.

## Qué muestra
| Pestaña | Para qué sirve |
|---|---|
| **Caja** | El último cierre de cada local, los números del mes y un calendario con cada día: cuadra, faltante, sobrante o sin cargar. Muestra cómo cierra cada responsable y abre el arqueo de cualquier día. |
| **Ventas** | Venta por mes y local, venta por día de la semana, el mix por medio de pago y lo que cuestan las plataformas. |
| **Restaurantes y fiado** | Lo que debe cada restaurante y a quién llamar esta semana: dejó de comprar, compra menos seguido, paga menos de lo que compra o es nuevo. Cada cuenta abre sus compras y pagos. |
| **Del Excel al formulario** | Los 1.212 problemas que tenía el Excel y qué se hizo con cada uno, cómo viaja un cierre y un formulario de prueba que muestra los controles. |
| **Informes** | El mail del lunes, los cierres en CSV, la base en Excel y el código. |

Pensado para el dueño, que lo mira en el celular: primero el último cierre, después el mes.

## Lo que cuentan los datos (al 09/10/2025)
- **La columna Total del Excel dejaba afuera el 32,4% de la venta** ($ 78,8 M de $ 116,5 M de enero a mayo). La fórmula SUMA ignoraba los montos escritos como texto («$ 35.160», «12.500,00»). La limpieza recuperó 257 de 258 cierres exactos; el que falta decía «ver cuaderno».
- **Desde junio, Marcos explica el 91% de la plata que faltó en la caja:** 29 faltantes en 37 cierres, siempre en el Centro los fines de semana. Los otros tres responsables cuadran más de 8 de cada 10 cierres.
- **5 cierres nunca se cargaron,** todos domingos del Jardín. El script manda un mail a las 22:00 cuando un local no cargó el cierre.
- **El efectivo bajó de 79% a 67% de la venta.** Débito, crédito y billetera costaron $ 122 mil en septiembre.
- **Los restaurantes deben $ 2,7 M.** Tres dejaron de comprar y quedaron debiendo $ 338 mil. Restaurante Mediterráneo pagó el 63% de lo que compró a cuenta en 90 días.

## Cómo está hecho
> El código (Python, JavaScript y Apps Script) se generó con IA a partir de las reglas de negocio y el diseño que definí. Lo mío es el criterio, el modelo de datos y la validación de cada número contra una segunda fuente.

| Capa | Archivo |
|---|---|
| Datos ficticios | `02_codigo/generate_pyme.py`: el Excel original con sus problemas, las respuestas del formulario y, aparte, «lo que pasó de verdad» (`01_datos/verdad`) para medir la limpieza |
| Limpieza | `02_codigo/limpiar_excel.py`: fechas en cuatro formatos, montos como texto, locales y clientes escritos distinto, totales en medio de los datos, filas duplicadas y saldos arrastrados a mano. Cada arreglo queda en `01_datos/base/problemas_excel.csv` |
| Formularios | `02_codigo/apps_script/crear_formularios.gs`: crea los dos formularios con listas, números enteros y campos obligatorios |
| Control y carga | `02_codigo/apps_script/enviar_a_supabase.gs`: arqueo, ticket promedio fuera de rango, gasto sin concepto, cierre duplicado (la base lo rechaza), mail al dueño y aviso de cierres faltantes a las 22:00 |
| Base | `02_codigo/supabase/01_esquema.sql` (tablas con reglas y seguridad por fila) y `02_vistas.sql` (las cuentas del tablero) |
| Tablero | `02_codigo/app.js` + `dashboard_template.html` → `03_tableros/caja-y-clientes.html`. Un solo archivo que abre sin internet; en el portfolio lee una copia de los datos en lugar de conectarse a Supabase |
| Mail del lunes | `02_codigo/apps_script/resumen_semanal.gs` lo manda cada lunes a las 8:00 con las vistas de Supabase; la copia del portfolio la arma `02_codigo/build_informe.py` → `04_informes/resumen-semanal.html` |
| Excel | `02_codigo/build_excel.py` → `01_datos/Base-pastas-don-aldo.xlsx`: arqueo, resumen mensual y fiado con fórmulas |

## Verificación
- **Limpieza contra lo que pasó de verdad:** 257 de 258 cierres de caja y los 301 pedidos del fiado ($ 27,96 M) recuperados exactos.
- **Casos sembrados** (`01_datos/verdad/casos_de_la_historia.csv`): el tablero los encuentra todos.
  - Los 3 restaurantes que dejaron de comprar.
  - Los 2 que espaciaron las compras: uno «en riesgo» y otro «compra menos seguido».
  - El que paga la mitad de lo que compra.
  - El cliente nuevo.
  - Los faltantes de un responsable.
  - Los 5 cierres no cargados.

  Ningún otro restaurante aparece en la lista de a quién llamar.
- **Vistas de Supabase:** `verificar_vistas.py` corre el esquema y las seis vistas en DuckDB (traducidas con sqlglot) y dan lo mismo que `indicadores.py`.
- **Tablero:** el motor del tablero da lo mismo que Python en responsables, cierres sin cargar, saldos, estado de cada cliente y venta por mes.
- **Apps Script:** `pruebas/prueba_apps_script.js` simula los servicios de Google y prueba cinco casos: faltante con mail, cierre duplicado, ticket raro, cierre que cuadra sin mail y el resumen del lunes.
- **Excel:** las fórmulas, recalculadas, cuadran con Python en las 20 filas del resumen mensual, los 15 saldos del fiado y el estado de los 219 cierres arqueados.

```
python generate_pyme.py && python limpiar_excel.py && python build_data.py && python build.py && python build_informe.py && python build_excel.py
python verificar_vistas.py && node pruebas/prueba_apps_script.js
```
