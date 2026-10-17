# Medidas DAX del modelo (Cobranzas del Sur)

Todas viven en la tabla `_Medidas`, agrupadas en carpetas. El período lo eligen las tablas sin relación **MesAnalisis** (botones de mes) y **Vista** (mes o acumulado):
las medidas leen esa selección con `[Índice desde]` e `[Índice hasta]` y filtran Calendario por su `indice` (meses corridos).
Las medidas de la carpeta *7. Imágenes SVG* tienen categoría de datos **URL de imagen** y devuelven un dibujo SVG (tarjetas, encabezados, narrativa, celdas de tabla).

## 0. Período

### Índice de corte
Último mes con datos reales (índice de Calendario), sin importar los filtros. Hoy: septiembre 2025.

```dax
Índice de corte =
VAR meses =
    CALCULATETABLE(VALUES(Resultado[mes]), REMOVEFILTERS(), Escenario[esc] = "REAL")
RETURN
    CALCULATE(MAX(Calendario[indice]), REMOVEFILTERS(), TREATAS(meses, Calendario[mes]))
```
Formato: `#,##0`

### Índice hasta
Mes de análisis: el elegido con los botones de mes o, si no hay ninguno, el último mes real.

```dax
Índice hasta =
VAR elegido = SELECTEDVALUE(MesAnalisis[indice])
RETURN IF(ISBLANK(elegido), [Índice de corte], elegido)
```
Formato: `#,##0`

### Índice desde
Primer mes del período: el mismo mes (vista Mes) o enero de ese año (vista Acumulado).

```dax
Índice desde =
VAR h = [Índice hasta]
VAR acumulado = SELECTEDVALUE(Vista[Vista], "Mes") = "Acumulado"
VAR mesDelAnio = CALCULATE(MAX(Calendario[mes_num]), REMOVEFILTERS(Calendario), Calendario[indice] = h)
RETURN IF(acumulado, h - mesDelAnio + 1, h)
```
Formato: `#,##0`

### Año de análisis
Año del mes de análisis. Las series mensuales muestran ese año.

```dax
Año de análisis =
VAR h = [Índice hasta]
RETURN CALCULATE(MAX(Calendario[anio]), REMOVEFILTERS(Calendario), Calendario[indice] = h)
```
Formato: `0`

### Período
Período corto (sep-25 o ene-25 a sep-25), para títulos.

```dax
Período =
VAR h = [Índice hasta]
VAR d = [Índice desde]
VAR txtH = CALCULATE(SELECTEDVALUE(Calendario[Mes año]), REMOVEFILTERS(Calendario), Calendario[indice] = h)
VAR txtD = CALCULATE(SELECTEDVALUE(Calendario[Mes año]), REMOVEFILTERS(Calendario), Calendario[indice] = d)
RETURN IF(d = h, txtH, txtD & " a " & txtH)
```


### Período largo
Período en palabras (Septiembre 2025 o Enero a septiembre 2025), para el encabezado.

```dax
Período largo =
VAR h = [Índice hasta]
VAR d = [Índice desde]
VAR fh = CALCULATE(MAX(Calendario[Fecha]), REMOVEFILTERS(Calendario), Calendario[indice] = h)
VAR mesTxt = FORMAT(fh, "mmmm", "es-AR")
VAR mesCap = UPPER(LEFT(mesTxt, 1)) & MID(mesTxt, 2, 20)
RETURN IF(d = h, mesCap & " " & YEAR(fh), "Enero a " & mesTxt & " " & YEAR(fh))
```


### Datos al
Último día del último mes con datos reales.

```dax
Datos al =
VAR c = [Índice de corte]
VAR f = CALCULATE(MAX(Calendario[Fecha]), REMOVEFILTERS(Calendario), Calendario[indice] = c)
RETURN FORMAT(EOMONTH(f, 0), "dd/mm/yyyy", "es-AR")
```


## 1. Base

### Importe
Suma del estado de resultados en pesos, en el contexto que tenga el visual.

```dax
Importe =
SUM(Resultado[importe_ars])
```
Formato: `\$ #,##0`

### Ingresos
Ingreso operacional (rubro 1).

```dax
Ingresos =
CALCULATE([Importe], Cuenta[n1_orden] = 1)
```
Formato: `\$ #,##0`

### Margen bruto
Ingresos menos costos de explotación e impuestos directos. Por cartera es su margen de contribución.

```dax
Margen bruto =
CALCULATE([Importe], Cuenta[n1_orden] <= 3)
```
Formato: `\$ #,##0`

### Margen operativo
Margen bruto menos gastos de estructura.

```dax
Margen operativo =
CALCULATE([Importe], Cuenta[n1_orden] <= 4)
```
Formato: `\$ #,##0`

### Utilidad neta
Resultado final, después del resultado no operacional y del impuesto a las ganancias.

```dax
Utilidad neta =
CALCULATE([Importe], REMOVEFILTERS(Cuenta))
```
Formato: `\$ #,##0`

### Margen bruto %
Margen bruto sobre ingresos.

```dax
Margen bruto % =
DIVIDE([Margen bruto], [Ingresos])
```
Formato: `0.0%`

### Margen operativo %
Margen operativo sobre ingresos.

```dax
Margen operativo % =
DIVIDE([Margen operativo], [Ingresos])
```
Formato: `0.0%`

### Deuda asignada
Deuda que el cliente asigna para gestionar.

```dax
Deuda asignada =
SUM(Drivers[deuda])
```
Formato: `\$ #,##0`

### Recuperado
Deuda cobrada: deuda asignada × % de recupero.

```dax
Recuperado =
SUMX(Drivers, Drivers[deuda] * Drivers[E])
```
Formato: `\$ #,##0`

### % recupero
Parte de la deuda asignada que se cobró, ponderada por deuda.

```dax
% recupero =
DIVIDE([Recuperado], [Deuda asignada])
```
Formato: `0.0%`

### Fee
Comisión sobre lo recuperado, ponderada.

```dax
Fee =
DIVIDE(SUM(Drivers[ingreso]), SUMX(Drivers, Drivers[deuda] * Drivers[E] * Drivers[FX]))
```
Formato: `0.00%`

### Posiciones
Operadores en Argentina más posiciones en Paraguay (suma de los meses del contexto).

```dax
Posiciones =
SUM(Drivers[ops]) + SUM(Drivers[py])
```
Formato: `#,##0`

### Posiciones promedio
Posiciones promedio por mes.

```dax
Posiciones promedio =
AVERAGEX(VALUES(Calendario[indice]), [Posiciones])
```
Formato: `#,##0.0`

### Horas de posición
Horas disponibles: posiciones de cada mes × 132 horas.

```dax
Horas de posición =
SUMX(VALUES(Calendario[indice]), [Posiciones] * 132)
```
Formato: `#,##0`

### Ingreso por hora
Ingreso por hora de posición.

```dax
Ingreso por hora =
DIVIDE([Ingresos], [Horas de posición])
```
Formato: `\$ #,##0`

## 2. Período elegido

### Real · período
Real del período elegido. Respeta los filtros de cartera y cuenta del visual.

```dax
Real · período =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Importe],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Presupuesto · período
Presupuesto del período elegido.

```dax
Presupuesto · período =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Importe],
        Escenario[esc] = "PPTO",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Forecast · período
Forecast del período elegido.

```dax
Forecast · período =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Importe],
        Escenario[esc] = "FCST",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Año anterior · período
Real de los mismos meses del año anterior.

```dax
Año anterior · período =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Importe],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d - 12,
        Calendario[indice] <= h - 12
    )
```
Formato: `\$ #,##0`

### Desvío vs presupuesto
Real menos presupuesto. Positivo es a favor también en costos (los costos son negativos).

```dax
Desvío vs presupuesto =
[Real · período] - [Presupuesto · período]
```
Formato: `\$ #,##0`

### Desvío vs presupuesto %
Desvío sobre el valor absoluto del presupuesto: positivo es mejor que lo previsto.

```dax
Desvío vs presupuesto % =
DIVIDE([Real · período] - [Presupuesto · período], ABS([Presupuesto · período]))
```
Formato: `+0.0%;-0.0%;0.0%`

### Variación vs año anterior %
Variación contra los mismos meses del año anterior (en pesos corrientes: incluye inflación).

```dax
Variación vs año anterior % =
DIVIDE([Real · período] - [Año anterior · período], ABS([Año anterior · período]))
```
Formato: `+0.0%;-0.0%;0.0%`

### Real · período M$
Real · período en millones de pesos.

```dax
Real · período M$ =
DIVIDE([Real · período], 1000000)
```
Formato: `#,##0.0`

### Presupuesto · período M$
Presupuesto · período en millones de pesos.

```dax
Presupuesto · período M$ =
DIVIDE([Presupuesto · período], 1000000)
```
Formato: `#,##0.0`

### Forecast · período M$
Forecast · período en millones de pesos.

```dax
Forecast · período M$ =
DIVIDE([Forecast · período], 1000000)
```
Formato: `#,##0.0`

### Año anterior · período M$
Año anterior · período en millones de pesos.

```dax
Año anterior · período M$ =
DIVIDE([Año anterior · período], 1000000)
```
Formato: `#,##0.0`

### Desvío vs presupuesto · período M$
Desvío vs presupuesto en millones de pesos.

```dax
Desvío vs presupuesto · período M$ =
DIVIDE([Desvío vs presupuesto], 1000000)
```
Formato: `+#,##0.0;-#,##0.0;0.0`

## 3. Indicadores

### Ingresos · real
Ingresos: real del período elegido.

```dax
Ingresos · real =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Ingresos],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Ingresos · presupuesto
Ingresos: presupuestado para el período elegido.

```dax
Ingresos · presupuesto =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Ingresos],
        Escenario[esc] = "PPTO",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Ingresos · forecast
Ingresos: del forecast para el período elegido.

```dax
Ingresos · forecast =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Ingresos],
        Escenario[esc] = "FCST",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Ingresos · mes anterior
Ingresos: real del mes anterior (solo en vista Mes).

```dax
Ingresos · mes anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    IF(
        d = h,
        CALCULATE(
            [Ingresos],
            Escenario[esc] = "REAL",
            REMOVEFILTERS(Calendario),
            Calendario[indice] = h - 1
        )
    )
```
Formato: `\$ #,##0`

### Ingresos · año anterior
Ingresos: real de los mismos meses del año anterior.

```dax
Ingresos · año anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Ingresos],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d - 12,
        Calendario[indice] <= h - 12
    )
```
Formato: `\$ #,##0`

### Margen bruto · real
Margen bruto: real del período elegido.

```dax
Margen bruto · real =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Margen bruto],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Margen bruto · presupuesto
Margen bruto: presupuestado para el período elegido.

```dax
Margen bruto · presupuesto =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Margen bruto],
        Escenario[esc] = "PPTO",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Margen bruto % · real
Margen bruto %: real del período elegido.

```dax
Margen bruto % · real =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Margen bruto %],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `0.0%`

### Margen bruto % · presupuesto
Margen bruto %: presupuestado para el período elegido.

```dax
Margen bruto % · presupuesto =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Margen bruto %],
        Escenario[esc] = "PPTO",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `0.0%`

### Margen operativo · real
Margen operativo: real del período elegido.

```dax
Margen operativo · real =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Margen operativo],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Margen operativo · presupuesto
Margen operativo: presupuestado para el período elegido.

```dax
Margen operativo · presupuesto =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Margen operativo],
        Escenario[esc] = "PPTO",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Margen operativo % · real
Margen operativo %: real del período elegido.

```dax
Margen operativo % · real =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Margen operativo %],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `0.0%`

### Margen operativo % · presupuesto
Margen operativo %: presupuestado para el período elegido.

```dax
Margen operativo % · presupuesto =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Margen operativo %],
        Escenario[esc] = "PPTO",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `0.0%`

### Margen operativo % · forecast
Margen operativo %: del forecast para el período elegido.

```dax
Margen operativo % · forecast =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Margen operativo %],
        Escenario[esc] = "FCST",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `0.0%`

### Margen operativo % · mes anterior
Margen operativo %: real del mes anterior (solo en vista Mes).

```dax
Margen operativo % · mes anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    IF(
        d = h,
        CALCULATE(
            [Margen operativo %],
            Escenario[esc] = "REAL",
            REMOVEFILTERS(Calendario),
            Calendario[indice] = h - 1
        )
    )
```
Formato: `0.0%`

### Margen operativo % · año anterior
Margen operativo %: real de los mismos meses del año anterior.

```dax
Margen operativo % · año anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Margen operativo %],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d - 12,
        Calendario[indice] <= h - 12
    )
```
Formato: `0.0%`

### Utilidad neta · real
Utilidad neta: real del período elegido.

```dax
Utilidad neta · real =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Utilidad neta],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Utilidad neta · presupuesto
Utilidad neta: presupuestado para el período elegido.

```dax
Utilidad neta · presupuesto =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Utilidad neta],
        Escenario[esc] = "PPTO",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Utilidad neta · forecast
Utilidad neta: del forecast para el período elegido.

```dax
Utilidad neta · forecast =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Utilidad neta],
        Escenario[esc] = "FCST",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Utilidad neta · mes anterior
Utilidad neta: real del mes anterior (solo en vista Mes).

```dax
Utilidad neta · mes anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    IF(
        d = h,
        CALCULATE(
            [Utilidad neta],
            Escenario[esc] = "REAL",
            REMOVEFILTERS(Calendario),
            Calendario[indice] = h - 1
        )
    )
```
Formato: `\$ #,##0`

### Utilidad neta · año anterior
Utilidad neta: real de los mismos meses del año anterior.

```dax
Utilidad neta · año anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Utilidad neta],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d - 12,
        Calendario[indice] <= h - 12
    )
```
Formato: `\$ #,##0`

### Ingreso por hora · real
Ingreso por hora: real del período elegido.

```dax
Ingreso por hora · real =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Ingreso por hora],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Ingreso por hora · presupuesto
Ingreso por hora: presupuestado para el período elegido.

```dax
Ingreso por hora · presupuesto =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Ingreso por hora],
        Escenario[esc] = "PPTO",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Ingreso por hora · mes anterior
Ingreso por hora: real del mes anterior (solo en vista Mes).

```dax
Ingreso por hora · mes anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    IF(
        d = h,
        CALCULATE(
            [Ingreso por hora],
            Escenario[esc] = "REAL",
            REMOVEFILTERS(Calendario),
            Calendario[indice] = h - 1
        )
    )
```
Formato: `\$ #,##0`

### Ingreso por hora · año anterior
Ingreso por hora: real de los mismos meses del año anterior.

```dax
Ingreso por hora · año anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Ingreso por hora],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d - 12,
        Calendario[indice] <= h - 12
    )
```
Formato: `\$ #,##0`

### % recupero · real
% recupero: real del período elegido.

```dax
% recupero · real =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [% recupero],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `0.0%`

### % recupero · presupuesto
% recupero: presupuestado para el período elegido.

```dax
% recupero · presupuesto =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [% recupero],
        Escenario[esc] = "PPTO",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `0.0%`

### % recupero · mes anterior
% recupero: real del mes anterior (solo en vista Mes).

```dax
% recupero · mes anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    IF(
        d = h,
        CALCULATE(
            [% recupero],
            Escenario[esc] = "REAL",
            REMOVEFILTERS(Calendario),
            Calendario[indice] = h - 1
        )
    )
```
Formato: `0.0%`

### % recupero · año anterior
% recupero: real de los mismos meses del año anterior.

```dax
% recupero · año anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [% recupero],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d - 12,
        Calendario[indice] <= h - 12
    )
```
Formato: `0.0%`

### Fee · real
Fee: real del período elegido.

```dax
Fee · real =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Fee],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `0.00%`

### Fee · presupuesto
Fee: presupuestado para el período elegido.

```dax
Fee · presupuesto =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Fee],
        Escenario[esc] = "PPTO",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `0.00%`

### Fee · mes anterior
Fee: real del mes anterior (solo en vista Mes).

```dax
Fee · mes anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    IF(
        d = h,
        CALCULATE(
            [Fee],
            Escenario[esc] = "REAL",
            REMOVEFILTERS(Calendario),
            Calendario[indice] = h - 1
        )
    )
```
Formato: `0.00%`

### Fee · año anterior
Fee: real de los mismos meses del año anterior.

```dax
Fee · año anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Fee],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d - 12,
        Calendario[indice] <= h - 12
    )
```
Formato: `0.00%`

### Deuda asignada · real
Deuda asignada: real del período elegido.

```dax
Deuda asignada · real =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Deuda asignada],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Deuda asignada · presupuesto
Deuda asignada: presupuestado para el período elegido.

```dax
Deuda asignada · presupuesto =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Deuda asignada],
        Escenario[esc] = "PPTO",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `\$ #,##0`

### Deuda asignada · mes anterior
Deuda asignada: real del mes anterior (solo en vista Mes).

```dax
Deuda asignada · mes anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    IF(
        d = h,
        CALCULATE(
            [Deuda asignada],
            Escenario[esc] = "REAL",
            REMOVEFILTERS(Calendario),
            Calendario[indice] = h - 1
        )
    )
```
Formato: `\$ #,##0`

### Deuda asignada · año anterior
Deuda asignada: real de los mismos meses del año anterior.

```dax
Deuda asignada · año anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Deuda asignada],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d - 12,
        Calendario[indice] <= h - 12
    )
```
Formato: `\$ #,##0`

### Posiciones promedio · real
Posiciones promedio: real del período elegido.

```dax
Posiciones promedio · real =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Posiciones promedio],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `#,##0.0`

### Posiciones promedio · presupuesto
Posiciones promedio: presupuestado para el período elegido.

```dax
Posiciones promedio · presupuesto =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Posiciones promedio],
        Escenario[esc] = "PPTO",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d,
        Calendario[indice] <= h
    )
```
Formato: `#,##0.0`

### Posiciones promedio · mes anterior
Posiciones promedio: real del mes anterior (solo en vista Mes).

```dax
Posiciones promedio · mes anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    IF(
        d = h,
        CALCULATE(
            [Posiciones promedio],
            Escenario[esc] = "REAL",
            REMOVEFILTERS(Calendario),
            Calendario[indice] = h - 1
        )
    )
```
Formato: `#,##0.0`

### Posiciones promedio · año anterior
Posiciones promedio: real de los mismos meses del año anterior.

```dax
Posiciones promedio · año anterior =
VAR d = [Índice desde]
VAR h = [Índice hasta]
RETURN
    CALCULATE(
        [Posiciones promedio],
        Escenario[esc] = "REAL",
        REMOVEFILTERS(Calendario),
        Calendario[indice] >= d - 12,
        Calendario[indice] <= h - 12
    )
```
Formato: `#,##0.0`

### Ingresos · real M$
Ingresos reales del período en millones.

```dax
Ingresos · real M$ =
DIVIDE([Ingresos · real], 1000000)
```
Formato: `#,##0.0`

### Margen bruto · real M$
Margen bruto (contribución) real del período en millones.

```dax
Margen bruto · real M$ =
DIVIDE([Margen bruto · real], 1000000)
```
Formato: `#,##0.0`

### Ingresos vs presupuesto %
Desvío de ingresos contra presupuesto.

```dax
Ingresos vs presupuesto % =
DIVIDE([Ingresos · real] - [Ingresos · presupuesto], ABS([Ingresos · presupuesto]))
```
Formato: `+0.0%;-0.0%;0.0%`

### Ingresos vs año anterior %
Variación de ingresos contra el año anterior.

```dax
Ingresos vs año anterior % =
DIVIDE([Ingresos · real] - [Ingresos · año anterior], ABS([Ingresos · año anterior]))
```
Formato: `+0.0%;-0.0%;0.0%`

### Ingresos · desvío vs presupuesto M$
Ingresos reales menos presupuestados, en millones (vacío para Estructura).

```dax
Ingresos · desvío vs presupuesto M$ =
VAR r = [Ingresos · real]
VAR p = [Ingresos · presupuesto]
RETURN IF(NOT(ISBLANK(r)) || NOT(ISBLANK(p)), DIVIDE(r - p, 1000000))
```
Formato: `+#,##0.0;-#,##0.0;0.0`

### % recupero · desvío vs presupuesto (pp)
Diferencia de % de recupero real contra presupuesto, en puntos porcentuales.

```dax
% recupero · desvío vs presupuesto (pp) =
VAR r = [% recupero · real]
VAR p = [% recupero · presupuesto]
RETURN IF(NOT(ISBLANK(r)) && NOT(ISBLANK(p)), (r - p) * 100)
```
Formato: `+0.0;-0.0;0.0`

### Cierre proyectado
Utilidad neta del año proyectada: real de los meses cerrados más forecast de los que faltan (latest estimate).

```dax
Cierre proyectado =
VAR corte = [Índice de corte]
VAR anio = [Año de análisis]
VAR realHastaCorte =
    CALCULATE([Utilidad neta], Escenario[esc] = "REAL", REMOVEFILTERS(Calendario), Calendario[anio] = anio, Calendario[indice] <= corte)
VAR forecastResto =
    CALCULATE([Utilidad neta], Escenario[esc] = "FCST", REMOVEFILTERS(Calendario), Calendario[anio] = anio, Calendario[indice] > corte)
RETURN realHastaCorte + forecastResto
```
Formato: `\$ #,##0`

### Presupuesto anual
Utilidad neta presupuestada para todo el año.

```dax
Presupuesto anual =
VAR anio = [Año de análisis]
RETURN CALCULATE([Utilidad neta], Escenario[esc] = "PPTO", REMOVEFILTERS(Calendario), Calendario[anio] = anio)
```
Formato: `\$ #,##0`

### Forecast anual
Utilidad neta del forecast para todo el año.

```dax
Forecast anual =
VAR anio = [Año de análisis]
RETURN CALCULATE([Utilidad neta], Escenario[esc] = "FCST", REMOVEFILTERS(Calendario), Calendario[anio] = anio)
```
Formato: `\$ #,##0`

### Real año anterior completo
Utilidad neta real de todo el año anterior.

```dax
Real año anterior completo =
VAR anio = [Año de análisis]
RETURN CALCULATE([Utilidad neta], Escenario[esc] = "REAL", REMOVEFILTERS(Calendario), Calendario[anio] = anio - 1)
```
Formato: `\$ #,##0`

## 4. Series mensuales

### Ingresos (mes) · real
Ingresos real del mes del eje (solo el año de análisis).

```dax
Ingresos (mes) · real =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Ingresos], Escenario[esc] = "REAL")
    )
```
Formato: `\$ #,##0`

### Ingresos (mes) · presupuesto
Ingresos presupuestado del mes del eje (solo el año de análisis).

```dax
Ingresos (mes) · presupuesto =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Ingresos], Escenario[esc] = "PPTO")
    )
```
Formato: `\$ #,##0`

### Ingresos (mes) · forecast
Ingresos del forecast del mes del eje (solo el año de análisis).

```dax
Ingresos (mes) · forecast =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Ingresos], Escenario[esc] = "FCST")
    )
```
Formato: `\$ #,##0`

### Ingresos (mes) · año anterior
Ingresos real del mismo mes del año anterior del mes del eje (solo el año de análisis).

```dax
Ingresos (mes) · año anterior =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Ingresos], Escenario[esc] = "REAL", REMOVEFILTERS(Calendario), Calendario[indice] = i - 12)
    )
```
Formato: `\$ #,##0`

### Ingresos (mes) · real o forecast
Ingresos real hasta el último mes cerrado y forecast después del mes del eje (solo el año de análisis).

```dax
Ingresos (mes) · real o forecast =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        IF(i <= c, CALCULATE([Ingresos], Escenario[esc] = "REAL"), CALCULATE([Ingresos], Escenario[esc] = "FCST"))
    )
```
Formato: `\$ #,##0`

### Margen operativo % (mes) · real
Margen operativo % real del mes del eje (solo el año de análisis).

```dax
Margen operativo % (mes) · real =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Margen operativo %], Escenario[esc] = "REAL")
    )
```
Formato: `0.0%`

### Margen operativo % (mes) · presupuesto
Margen operativo % presupuestado del mes del eje (solo el año de análisis).

```dax
Margen operativo % (mes) · presupuesto =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Margen operativo %], Escenario[esc] = "PPTO")
    )
```
Formato: `0.0%`

### Margen operativo % (mes) · forecast
Margen operativo % del forecast del mes del eje (solo el año de análisis).

```dax
Margen operativo % (mes) · forecast =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Margen operativo %], Escenario[esc] = "FCST")
    )
```
Formato: `0.0%`

### Margen operativo % (mes) · proyección
Margen operativo % del forecast desde el último mes real (arranca en el último real para que la línea quede unida) del mes del eje (solo el año de análisis).

```dax
Margen operativo % (mes) · proyección =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        IF(i > c, CALCULATE([Margen operativo %], Escenario[esc] = "FCST"), IF(i = c, CALCULATE([Margen operativo %], Escenario[esc] = "REAL")))
    )
```
Formato: `0.0%`

### Utilidad neta (mes) · real
Utilidad neta real del mes del eje (solo el año de análisis).

```dax
Utilidad neta (mes) · real =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Utilidad neta], Escenario[esc] = "REAL")
    )
```
Formato: `\$ #,##0`

### Utilidad neta (mes) · presupuesto
Utilidad neta presupuestado del mes del eje (solo el año de análisis).

```dax
Utilidad neta (mes) · presupuesto =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Utilidad neta], Escenario[esc] = "PPTO")
    )
```
Formato: `\$ #,##0`

### Utilidad neta (mes) · forecast
Utilidad neta del forecast del mes del eje (solo el año de análisis).

```dax
Utilidad neta (mes) · forecast =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Utilidad neta], Escenario[esc] = "FCST")
    )
```
Formato: `\$ #,##0`

### Ingreso por hora (mes) · real
Ingreso por hora real del mes del eje (solo el año de análisis).

```dax
Ingreso por hora (mes) · real =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Ingreso por hora], Escenario[esc] = "REAL")
    )
```
Formato: `\$ #,##0`

### Ingreso por hora (mes) · presupuesto
Ingreso por hora presupuestado del mes del eje (solo el año de análisis).

```dax
Ingreso por hora (mes) · presupuesto =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Ingreso por hora], Escenario[esc] = "PPTO")
    )
```
Formato: `\$ #,##0`

### Ingreso por hora (mes) · forecast
Ingreso por hora del forecast del mes del eje (solo el año de análisis).

```dax
Ingreso por hora (mes) · forecast =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Ingreso por hora], Escenario[esc] = "FCST")
    )
```
Formato: `\$ #,##0`

### % recupero (mes) · real
% recupero real del mes del eje (solo el año de análisis).

```dax
% recupero (mes) · real =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([% recupero], Escenario[esc] = "REAL")
    )
```
Formato: `0.0%`

### % recupero (mes) · presupuesto
% recupero presupuestado del mes del eje (solo el año de análisis).

```dax
% recupero (mes) · presupuesto =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([% recupero], Escenario[esc] = "PPTO")
    )
```
Formato: `0.0%`

### % recupero (mes) · forecast
% recupero del forecast del mes del eje (solo el año de análisis).

```dax
% recupero (mes) · forecast =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([% recupero], Escenario[esc] = "FCST")
    )
```
Formato: `0.0%`

### % recupero (mes) · proyección
% recupero del forecast desde el último mes real (arranca en el último real para que la línea quede unida) del mes del eje (solo el año de análisis).

```dax
% recupero (mes) · proyección =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        IF(i > c, CALCULATE([% recupero], Escenario[esc] = "FCST"), IF(i = c, CALCULATE([% recupero], Escenario[esc] = "REAL")))
    )
```
Formato: `0.0%`

### Fee (mes) · real
Fee real del mes del eje (solo el año de análisis).

```dax
Fee (mes) · real =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Fee], Escenario[esc] = "REAL")
    )
```
Formato: `0.00%`

### Fee (mes) · presupuesto
Fee presupuestado del mes del eje (solo el año de análisis).

```dax
Fee (mes) · presupuesto =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Fee], Escenario[esc] = "PPTO")
    )
```
Formato: `0.00%`

### Fee (mes) · forecast
Fee del forecast del mes del eje (solo el año de análisis).

```dax
Fee (mes) · forecast =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Fee], Escenario[esc] = "FCST")
    )
```
Formato: `0.00%`

### Fee (mes) · proyección
Fee del forecast desde el último mes real (arranca en el último real para que la línea quede unida) del mes del eje (solo el año de análisis).

```dax
Fee (mes) · proyección =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        IF(i > c, CALCULATE([Fee], Escenario[esc] = "FCST"), IF(i = c, CALCULATE([Fee], Escenario[esc] = "REAL")))
    )
```
Formato: `0.00%`

### Deuda asignada (mes) · real
Deuda asignada real del mes del eje (solo el año de análisis).

```dax
Deuda asignada (mes) · real =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Deuda asignada], Escenario[esc] = "REAL")
    )
```
Formato: `\$ #,##0`

### Deuda asignada (mes) · presupuesto
Deuda asignada presupuestado del mes del eje (solo el año de análisis).

```dax
Deuda asignada (mes) · presupuesto =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Deuda asignada], Escenario[esc] = "PPTO")
    )
```
Formato: `\$ #,##0`

### Deuda asignada (mes) · forecast
Deuda asignada del forecast del mes del eje (solo el año de análisis).

```dax
Deuda asignada (mes) · forecast =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Deuda asignada], Escenario[esc] = "FCST")
    )
```
Formato: `\$ #,##0`

### Deuda asignada (mes) · proyección
Deuda asignada del forecast desde el último mes real (arranca en el último real para que la línea quede unida) del mes del eje (solo el año de análisis).

```dax
Deuda asignada (mes) · proyección =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        IF(i > c, CALCULATE([Deuda asignada], Escenario[esc] = "FCST"), IF(i = c, CALCULATE([Deuda asignada], Escenario[esc] = "REAL")))
    )
```
Formato: `\$ #,##0`

### Posiciones (mes) · real
Posiciones real del mes del eje (solo el año de análisis).

```dax
Posiciones (mes) · real =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Posiciones], Escenario[esc] = "REAL")
    )
```
Formato: `#,##0`

### Posiciones (mes) · presupuesto
Posiciones presupuestado del mes del eje (solo el año de análisis).

```dax
Posiciones (mes) · presupuesto =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Posiciones], Escenario[esc] = "PPTO")
    )
```
Formato: `#,##0`

### Posiciones (mes) · forecast
Posiciones del forecast del mes del eje (solo el año de análisis).

```dax
Posiciones (mes) · forecast =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        CALCULATE([Posiciones], Escenario[esc] = "FCST")
    )
```
Formato: `#,##0`

### Posiciones (mes) · proyección
Posiciones del forecast desde el último mes real (arranca en el último real para que la línea quede unida) del mes del eje (solo el año de análisis).

```dax
Posiciones (mes) · proyección =
VAR i = MAX(Calendario[indice])
VAR c = [Índice de corte]
VAR a = [Año de análisis]
RETURN
    IF(
        HASONEVALUE(Calendario[indice]) && MAX(Calendario[anio]) = a,
        IF(i > c, CALCULATE([Posiciones], Escenario[esc] = "FCST"), IF(i = c, CALCULATE([Posiciones], Escenario[esc] = "REAL")))
    )
```
Formato: `#,##0`

### Ingresos (mes) M$ · real o forecast
Ingresos (mes) · real o forecast, en millones.

```dax
Ingresos (mes) M$ · real o forecast =
DIVIDE([Ingresos (mes) · real o forecast], 1000000)
```
Formato: `#,##0.0`

### Ingresos (mes) M$ · presupuesto
Ingresos (mes) · presupuesto, en millones.

```dax
Ingresos (mes) M$ · presupuesto =
DIVIDE([Ingresos (mes) · presupuesto], 1000000)
```
Formato: `#,##0.0`

### Ingresos (mes) M$ · año anterior
Ingresos (mes) · año anterior, en millones.

```dax
Ingresos (mes) M$ · año anterior =
DIVIDE([Ingresos (mes) · año anterior], 1000000)
```
Formato: `#,##0.0`

### Deuda asignada (mes) M$ · real
Deuda asignada (mes) · real, en millones.

```dax
Deuda asignada (mes) M$ · real =
DIVIDE([Deuda asignada (mes) · real], 1000000)
```
Formato: `#,##0.0`

### Deuda asignada (mes) M$ · presupuesto
Deuda asignada (mes) · presupuesto, en millones.

```dax
Deuda asignada (mes) M$ · presupuesto =
DIVIDE([Deuda asignada (mes) · presupuesto], 1000000)
```
Formato: `#,##0.0`

### Deuda asignada (mes) M$ · proyección
Deuda asignada (mes) · proyección, en millones.

```dax
Deuda asignada (mes) M$ · proyección =
DIVIDE([Deuda asignada (mes) · proyección], 1000000)
```
Formato: `#,##0.0`

## 5. Estado de resultados

### EERR · real (valor)
Valor del renglón del estado de resultados (real): suma de los rubros del renglón, o margen sobre ingresos en los renglones de %.

```dax
EERR · real (valor) =
VAR d = SELECTEDVALUE('Línea EERR'[Desde])
VAR h = SELECTEDVALUE('Línea EERR'[Hasta])
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
VAR v = CALCULATE([Real · período], Cuenta[n1_orden] >= d && Cuenta[n1_orden] <= h)
VAR ing = CALCULATE([Real · período], Cuenta[n1_orden] = 1)
RETURN
    IF(NOT(ISBLANK(d)), IF(esPct, DIVIDE(v, ing), v))
```


### EERR · presupuesto (valor)
Valor del renglón del estado de resultados (presupuesto): suma de los rubros del renglón, o margen sobre ingresos en los renglones de %.

```dax
EERR · presupuesto (valor) =
VAR d = SELECTEDVALUE('Línea EERR'[Desde])
VAR h = SELECTEDVALUE('Línea EERR'[Hasta])
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
VAR v = CALCULATE([Presupuesto · período], Cuenta[n1_orden] >= d && Cuenta[n1_orden] <= h)
VAR ing = CALCULATE([Presupuesto · período], Cuenta[n1_orden] = 1)
RETURN
    IF(NOT(ISBLANK(d)), IF(esPct, DIVIDE(v, ing), v))
```


### EERR · forecast (valor)
Valor del renglón del estado de resultados (forecast): suma de los rubros del renglón, o margen sobre ingresos en los renglones de %.

```dax
EERR · forecast (valor) =
VAR d = SELECTEDVALUE('Línea EERR'[Desde])
VAR h = SELECTEDVALUE('Línea EERR'[Hasta])
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
VAR v = CALCULATE([Forecast · período], Cuenta[n1_orden] >= d && Cuenta[n1_orden] <= h)
VAR ing = CALCULATE([Forecast · período], Cuenta[n1_orden] = 1)
RETURN
    IF(NOT(ISBLANK(d)), IF(esPct, DIVIDE(v, ing), v))
```


### EERR · año anterior (valor)
Valor del renglón del estado de resultados (año anterior): suma de los rubros del renglón, o margen sobre ingresos en los renglones de %.

```dax
EERR · año anterior (valor) =
VAR d = SELECTEDVALUE('Línea EERR'[Desde])
VAR h = SELECTEDVALUE('Línea EERR'[Hasta])
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
VAR v = CALCULATE([Año anterior · período], Cuenta[n1_orden] >= d && Cuenta[n1_orden] <= h)
VAR ing = CALCULATE([Año anterior · período], Cuenta[n1_orden] = 1)
RETURN
    IF(NOT(ISBLANK(d)), IF(esPct, DIVIDE(v, ing), v))
```


### EERR · Real
Real del renglón, como texto: millones de pesos o % según el renglón.

```dax
EERR · Real =
VAR v = [EERR · real (valor)]
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
RETURN IF(NOT(ISBLANK(v)), IF(esPct, SUBSTITUTE(FORMAT(v, "0.0%", "es-AR"), "-", "−"), SUBSTITUTE(FORMAT(v / 1000000, "#,##0.0", "es-AR"), "-", "−")))
```


### EERR · Presupuesto
Presupuesto del renglón, como texto: millones de pesos o % según el renglón.

```dax
EERR · Presupuesto =
VAR v = [EERR · presupuesto (valor)]
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
RETURN IF(NOT(ISBLANK(v)), IF(esPct, SUBSTITUTE(FORMAT(v, "0.0%", "es-AR"), "-", "−"), SUBSTITUTE(FORMAT(v / 1000000, "#,##0.0", "es-AR"), "-", "−")))
```


### EERR · Forecast
Forecast del renglón, como texto: millones de pesos o % según el renglón.

```dax
EERR · Forecast =
VAR v = [EERR · forecast (valor)]
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
RETURN IF(NOT(ISBLANK(v)), IF(esPct, SUBSTITUTE(FORMAT(v, "0.0%", "es-AR"), "-", "−"), SUBSTITUTE(FORMAT(v / 1000000, "#,##0.0", "es-AR"), "-", "−")))
```


### EERR · Año anterior
Año anterior del renglón, como texto: millones de pesos o % según el renglón.

```dax
EERR · Año anterior =
VAR v = [EERR · año anterior (valor)]
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
RETURN IF(NOT(ISBLANK(v)), IF(esPct, SUBSTITUTE(FORMAT(v, "0.0%", "es-AR"), "-", "−"), SUBSTITUTE(FORMAT(v / 1000000, "#,##0.0", "es-AR"), "-", "−")))
```


### EERR · Desvío
Real menos presupuesto: millones de pesos, o puntos porcentuales en los renglones de margen.

```dax
EERR · Desvío =
VAR r = [EERR · real (valor)]
VAR p = [EERR · presupuesto (valor)]
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
RETURN
    IF(
        NOT(ISBLANK(r)) && NOT(ISBLANK(p)),
        IF(esPct, SUBSTITUTE(FORMAT((r - p) * 100, "+0.0;-0.0;0.0", "es-AR"), "-", "−") & " pp", SUBSTITUTE(FORMAT((r - p) / 1000000, "+#,##0.0;-#,##0.0;0.0", "es-AR"), "-", "−"))
    )
```


### EERR · Desvío %
Desvío sobre el valor absoluto del presupuesto (no aplica a los renglones de margen).

```dax
EERR · Desvío % =
VAR r = [EERR · real (valor)]
VAR p = [EERR · presupuesto (valor)]
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
RETURN IF(NOT(esPct) && NOT(ISBLANK(r)) && NOT(ISBLANK(p)) && p <> 0, SUBSTITUTE(FORMAT(DIVIDE(r - p, ABS(p)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
```


### EERR · Var. año anterior
Variación contra el año anterior: % en los rubros, puntos porcentuales en los márgenes.

```dax
EERR · Var. año anterior =
VAR r = [EERR · real (valor)]
VAR a = [EERR · año anterior (valor)]
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
RETURN
    IF(
        NOT(ISBLANK(r)) && NOT(ISBLANK(a)),
        IF(esPct, SUBSTITUTE(FORMAT((r - a) * 100, "+0.0;-0.0;0.0", "es-AR"), "-", "−") & " pp", IF(a <> 0, SUBSTITUTE(FORMAT(DIVIDE(r - a, ABS(a)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−")))
    )
```


### EERR · color desvío
Verde si el renglón está mejor que el presupuesto, rojo si está peor, gris si la diferencia es menor a 0,5%.

```dax
EERR · color desvío =
VAR r = [EERR · real (valor)]
VAR p = [EERR · presupuesto (valor)]
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
RETURN IF(ISBLANK(r) || ISBLANK(p), "#6B7682", VAR e = IF(esPct, r - p, DIVIDE(r - p, ABS(p))) RETURN IF(ABS(e) < 0.005, "#6B7682", IF(e > 0, "#16703F", "#B42318")))
```


### EERR · color var. año anterior
Verde si el renglón mejora contra el año anterior, rojo si empeora.

```dax
EERR · color var. año anterior =
VAR r = [EERR · real (valor)]
VAR p = [EERR · año anterior (valor)]
VAR esPct = SELECTEDVALUE('Línea EERR'[Tipo]) = "pct"
RETURN IF(ISBLANK(r) || ISBLANK(p), "#6B7682", VAR e = IF(esPct, r - p, DIVIDE(r - p, ABS(p))) RETURN IF(ABS(e) < 0.005, "#6B7682", IF(e > 0, "#16703F", "#B42318")))
```


### EERR · fondo
Fondo del renglón: subtotales resaltados.

```dax
EERR · fondo =
SWITCH(SELECTEDVALUE('Línea EERR'[Tipo]), "sub", "#E9EEF6", "pct", "#FAFBFD", "#FFFFFF")
```


### EERR · color texto
Color del texto del renglón: subtotales en azul marino, márgenes en gris.

```dax
EERR · color texto =
SWITCH(SELECTEDVALUE('Línea EERR'[Tipo]), "sub", "#13294B", "pct", "#6B7682", "#111A24")
```


## 6. Formato y colores

### Color · desvío presupuesto
Verde a favor, rojo en contra, gris si la diferencia es menor a 0,5% (sirve para ingresos y costos).

```dax
Color · desvío presupuesto =
VAR r = [Real · período]
VAR p = [Presupuesto · período]
VAR esPct = FALSE()
RETURN IF(ISBLANK(r) || ISBLANK(p), "#6B7682", VAR e = IF(esPct, r - p, DIVIDE(r - p, ABS(p))) RETURN IF(ABS(e) < 0.005, "#6B7682", IF(e > 0, "#16703F", "#B42318")))
```


### Color · variación año anterior
Verde si mejora contra el año anterior, rojo si empeora.

```dax
Color · variación año anterior =
VAR r = [Real · período]
VAR p = [Año anterior · período]
VAR esPct = FALSE()
RETURN IF(ISBLANK(r) || ISBLANK(p), "#6B7682", VAR e = IF(esPct, r - p, DIVIDE(r - p, ABS(p))) RETURN IF(ABS(e) < 0.005, "#6B7682", IF(e > 0, "#16703F", "#B42318")))
```


### Color · desvío ingresos
Color del desvío de ingresos contra presupuesto.

```dax
Color · desvío ingresos =
VAR r = [Ingresos · real]
VAR p = [Ingresos · presupuesto]
VAR esPct = FALSE()
RETURN IF(ISBLANK(r) || ISBLANK(p), "#6B7682", VAR e = IF(esPct, r - p, DIVIDE(r - p, ABS(p))) RETURN IF(ABS(e) < 0.005, "#6B7682", IF(e > 0, "#16703F", "#B42318")))
```


### Color · ingresos vs año anterior
Color de la variación de ingresos contra el año anterior.

```dax
Color · ingresos vs año anterior =
VAR r = [Ingresos · real]
VAR p = [Ingresos · año anterior]
VAR esPct = FALSE()
RETURN IF(ISBLANK(r) || ISBLANK(p), "#6B7682", VAR e = IF(esPct, r - p, DIVIDE(r - p, ABS(p))) RETURN IF(ABS(e) < 0.005, "#6B7682", IF(e > 0, "#16703F", "#B42318")))
```


### Color · desvío recupero
Verde si el recupero supera al presupuesto, rojo si queda abajo.

```dax
Color · desvío recupero =
VAR d = [% recupero · desvío vs presupuesto (pp)]
RETURN IF(ISBLANK(d), "#6B7682", IF(ABS(d) < 0.1, "#6B7682", IF(d > 0, "#16703F", "#B42318")))
```


### Color · margen bruto
Semáforo de margen de contribución: ≥ 25% verde, 10–25% ámbar, < 10% rojo.

```dax
Color · margen bruto =
VAR m = [Margen bruto % · real]
RETURN IF(m >= 0.25, "#16703F", IF(m >= 0.10, "#C98A00", "#B42318"))
```


### Color · real o forecast (mes)
Columnas del año: azul marino los meses reales, naranja claro los de forecast.

```dax
Color · real o forecast (mes) =
IF(MAX(Calendario[indice]) <= [Índice de corte], "#13294B", "#F4A57E")
```


### Eje ingresos (máx)
Tope del eje del gráfico de ingresos: mismo máximo para columnas y líneas.

```dax
Eje ingresos (máx) =
VAR a = [Año de análisis]
VAR t =
    ADDCOLUMNS(
        FILTER(ALL(Calendario[indice], Calendario[anio]), Calendario[anio] = a),
        "@m", MAX(MAX([Ingresos (mes) M$ · real o forecast], [Ingresos (mes) M$ · presupuesto]), [Ingresos (mes) M$ · año anterior])
    )
RETURN MAXX(t, [@m]) * 1.12
```
Formato: `#,##0.0`

## 8. Textos y títulos

### Texto · Ingresos vs presupuesto
Ingresos real contra presupuesto, como texto con flecha (▲ arriba, ▼ abajo). Para tarjetas nativas, títulos o tooltips.

```dax
Texto · Ingresos vs presupuesto =
VAR c = [Ingresos · real]
VAR r = [Ingresos · presupuesto]
RETURN
    IF(
        NOT(ISBLANK(c)) && NOT(ISBLANK(r)) && r <> 0,
        VAR e = DIVIDE(c - r, ABS(r))
        RETURN IF(e >= 0, "▲ ", "▼ ") & SUBSTITUTE(FORMAT(e, "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−") & " vs presupuesto"
    )
```


### Color texto · Ingresos vs presupuesto
Verde si ingresos supera al presupuesto, rojo si queda abajo: para formato condicional del texto.

```dax
Color texto · Ingresos vs presupuesto =
VAR c = [Ingresos · real]
VAR r = [Ingresos · presupuesto]
RETURN IF(ISBLANK(c) || ISBLANK(r), "#6B7682", IF(c >= r, "#16703F", "#B42318"))
```


### Texto · Ingresos vs mes anterior
Ingresos real contra mes anterior, como texto con flecha (▲ arriba, ▼ abajo). Para tarjetas nativas, títulos o tooltips.

```dax
Texto · Ingresos vs mes anterior =
VAR c = [Ingresos · real]
VAR r = [Ingresos · mes anterior]
RETURN
    IF(
        NOT(ISBLANK(c)) && NOT(ISBLANK(r)) && r <> 0,
        VAR e = DIVIDE(c - r, ABS(r))
        RETURN IF(e >= 0, "▲ ", "▼ ") & SUBSTITUTE(FORMAT(e, "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−") & " vs mes anterior"
    )
```


### Color texto · Ingresos vs mes anterior
Verde si ingresos supera al mes anterior, rojo si queda abajo: para formato condicional del texto.

```dax
Color texto · Ingresos vs mes anterior =
VAR c = [Ingresos · real]
VAR r = [Ingresos · mes anterior]
RETURN IF(ISBLANK(c) || ISBLANK(r), "#6B7682", IF(c >= r, "#16703F", "#B42318"))
```


### Texto · Ingresos vs año anterior
Ingresos real contra año anterior, como texto con flecha (▲ arriba, ▼ abajo). Para tarjetas nativas, títulos o tooltips.

```dax
Texto · Ingresos vs año anterior =
VAR c = [Ingresos · real]
VAR r = [Ingresos · año anterior]
RETURN
    IF(
        NOT(ISBLANK(c)) && NOT(ISBLANK(r)) && r <> 0,
        VAR e = DIVIDE(c - r, ABS(r))
        RETURN IF(e >= 0, "▲ ", "▼ ") & SUBSTITUTE(FORMAT(e, "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−") & " vs año anterior"
    )
```


### Color texto · Ingresos vs año anterior
Verde si ingresos supera al año anterior, rojo si queda abajo: para formato condicional del texto.

```dax
Color texto · Ingresos vs año anterior =
VAR c = [Ingresos · real]
VAR r = [Ingresos · año anterior]
RETURN IF(ISBLANK(c) || ISBLANK(r), "#6B7682", IF(c >= r, "#16703F", "#B42318"))
```


### Texto · Margen operativo vs presupuesto
Margen operativo real contra presupuesto, como texto con flecha (▲ arriba, ▼ abajo). Para tarjetas nativas, títulos o tooltips.

```dax
Texto · Margen operativo vs presupuesto =
VAR c = [Margen operativo % · real]
VAR r = [Margen operativo % · presupuesto]
RETURN
    IF(
        NOT(ISBLANK(c)) && NOT(ISBLANK(r)) && r <> 0,
        VAR e = c - r
        RETURN IF(e >= 0, "▲ ", "▼ ") & SUBSTITUTE(FORMAT((e) * 100, "+0.0;-0.0;0.0", "es-AR"), "-", "−") & " pp" & " vs presupuesto"
    )
```


### Color texto · Margen operativo vs presupuesto
Verde si margen operativo supera al presupuesto, rojo si queda abajo: para formato condicional del texto.

```dax
Color texto · Margen operativo vs presupuesto =
VAR c = [Margen operativo % · real]
VAR r = [Margen operativo % · presupuesto]
RETURN IF(ISBLANK(c) || ISBLANK(r), "#6B7682", IF(c >= r, "#16703F", "#B42318"))
```


### Texto · Margen operativo vs mes anterior
Margen operativo real contra mes anterior, como texto con flecha (▲ arriba, ▼ abajo). Para tarjetas nativas, títulos o tooltips.

```dax
Texto · Margen operativo vs mes anterior =
VAR c = [Margen operativo % · real]
VAR r = [Margen operativo % · mes anterior]
RETURN
    IF(
        NOT(ISBLANK(c)) && NOT(ISBLANK(r)) && r <> 0,
        VAR e = c - r
        RETURN IF(e >= 0, "▲ ", "▼ ") & SUBSTITUTE(FORMAT((e) * 100, "+0.0;-0.0;0.0", "es-AR"), "-", "−") & " pp" & " vs mes anterior"
    )
```


### Color texto · Margen operativo vs mes anterior
Verde si margen operativo supera al mes anterior, rojo si queda abajo: para formato condicional del texto.

```dax
Color texto · Margen operativo vs mes anterior =
VAR c = [Margen operativo % · real]
VAR r = [Margen operativo % · mes anterior]
RETURN IF(ISBLANK(c) || ISBLANK(r), "#6B7682", IF(c >= r, "#16703F", "#B42318"))
```


### Texto · Margen operativo vs año anterior
Margen operativo real contra año anterior, como texto con flecha (▲ arriba, ▼ abajo). Para tarjetas nativas, títulos o tooltips.

```dax
Texto · Margen operativo vs año anterior =
VAR c = [Margen operativo % · real]
VAR r = [Margen operativo % · año anterior]
RETURN
    IF(
        NOT(ISBLANK(c)) && NOT(ISBLANK(r)) && r <> 0,
        VAR e = c - r
        RETURN IF(e >= 0, "▲ ", "▼ ") & SUBSTITUTE(FORMAT((e) * 100, "+0.0;-0.0;0.0", "es-AR"), "-", "−") & " pp" & " vs año anterior"
    )
```


### Color texto · Margen operativo vs año anterior
Verde si margen operativo supera al año anterior, rojo si queda abajo: para formato condicional del texto.

```dax
Color texto · Margen operativo vs año anterior =
VAR c = [Margen operativo % · real]
VAR r = [Margen operativo % · año anterior]
RETURN IF(ISBLANK(c) || ISBLANK(r), "#6B7682", IF(c >= r, "#16703F", "#B42318"))
```


### Texto · Utilidad neta vs presupuesto
Utilidad neta real contra presupuesto, como texto con flecha (▲ arriba, ▼ abajo). Para tarjetas nativas, títulos o tooltips.

```dax
Texto · Utilidad neta vs presupuesto =
VAR c = [Utilidad neta · real]
VAR r = [Utilidad neta · presupuesto]
RETURN
    IF(
        NOT(ISBLANK(c)) && NOT(ISBLANK(r)) && r <> 0,
        VAR e = DIVIDE(c - r, ABS(r))
        RETURN IF(e >= 0, "▲ ", "▼ ") & SUBSTITUTE(FORMAT(e, "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−") & " vs presupuesto"
    )
```


### Color texto · Utilidad neta vs presupuesto
Verde si utilidad neta supera al presupuesto, rojo si queda abajo: para formato condicional del texto.

```dax
Color texto · Utilidad neta vs presupuesto =
VAR c = [Utilidad neta · real]
VAR r = [Utilidad neta · presupuesto]
RETURN IF(ISBLANK(c) || ISBLANK(r), "#6B7682", IF(c >= r, "#16703F", "#B42318"))
```


### Texto · Utilidad neta vs mes anterior
Utilidad neta real contra mes anterior, como texto con flecha (▲ arriba, ▼ abajo). Para tarjetas nativas, títulos o tooltips.

```dax
Texto · Utilidad neta vs mes anterior =
VAR c = [Utilidad neta · real]
VAR r = [Utilidad neta · mes anterior]
RETURN
    IF(
        NOT(ISBLANK(c)) && NOT(ISBLANK(r)) && r <> 0,
        VAR e = DIVIDE(c - r, ABS(r))
        RETURN IF(e >= 0, "▲ ", "▼ ") & SUBSTITUTE(FORMAT(e, "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−") & " vs mes anterior"
    )
```


### Color texto · Utilidad neta vs mes anterior
Verde si utilidad neta supera al mes anterior, rojo si queda abajo: para formato condicional del texto.

```dax
Color texto · Utilidad neta vs mes anterior =
VAR c = [Utilidad neta · real]
VAR r = [Utilidad neta · mes anterior]
RETURN IF(ISBLANK(c) || ISBLANK(r), "#6B7682", IF(c >= r, "#16703F", "#B42318"))
```


### Texto · Utilidad neta vs año anterior
Utilidad neta real contra año anterior, como texto con flecha (▲ arriba, ▼ abajo). Para tarjetas nativas, títulos o tooltips.

```dax
Texto · Utilidad neta vs año anterior =
VAR c = [Utilidad neta · real]
VAR r = [Utilidad neta · año anterior]
RETURN
    IF(
        NOT(ISBLANK(c)) && NOT(ISBLANK(r)) && r <> 0,
        VAR e = DIVIDE(c - r, ABS(r))
        RETURN IF(e >= 0, "▲ ", "▼ ") & SUBSTITUTE(FORMAT(e, "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−") & " vs año anterior"
    )
```


### Color texto · Utilidad neta vs año anterior
Verde si utilidad neta supera al año anterior, rojo si queda abajo: para formato condicional del texto.

```dax
Color texto · Utilidad neta vs año anterior =
VAR c = [Utilidad neta · real]
VAR r = [Utilidad neta · año anterior]
RETURN IF(ISBLANK(c) || ISBLANK(r), "#6B7682", IF(c >= r, "#16703F", "#B42318"))
```


### Texto · Ingreso por hora vs presupuesto
Ingreso por hora real contra presupuesto, como texto con flecha (▲ arriba, ▼ abajo). Para tarjetas nativas, títulos o tooltips.

```dax
Texto · Ingreso por hora vs presupuesto =
VAR c = [Ingreso por hora · real]
VAR r = [Ingreso por hora · presupuesto]
RETURN
    IF(
        NOT(ISBLANK(c)) && NOT(ISBLANK(r)) && r <> 0,
        VAR e = DIVIDE(c - r, ABS(r))
        RETURN IF(e >= 0, "▲ ", "▼ ") & SUBSTITUTE(FORMAT(e, "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−") & " vs presupuesto"
    )
```


### Color texto · Ingreso por hora vs presupuesto
Verde si ingreso por hora supera al presupuesto, rojo si queda abajo: para formato condicional del texto.

```dax
Color texto · Ingreso por hora vs presupuesto =
VAR c = [Ingreso por hora · real]
VAR r = [Ingreso por hora · presupuesto]
RETURN IF(ISBLANK(c) || ISBLANK(r), "#6B7682", IF(c >= r, "#16703F", "#B42318"))
```


### Texto · Ingreso por hora vs mes anterior
Ingreso por hora real contra mes anterior, como texto con flecha (▲ arriba, ▼ abajo). Para tarjetas nativas, títulos o tooltips.

```dax
Texto · Ingreso por hora vs mes anterior =
VAR c = [Ingreso por hora · real]
VAR r = [Ingreso por hora · mes anterior]
RETURN
    IF(
        NOT(ISBLANK(c)) && NOT(ISBLANK(r)) && r <> 0,
        VAR e = DIVIDE(c - r, ABS(r))
        RETURN IF(e >= 0, "▲ ", "▼ ") & SUBSTITUTE(FORMAT(e, "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−") & " vs mes anterior"
    )
```


### Color texto · Ingreso por hora vs mes anterior
Verde si ingreso por hora supera al mes anterior, rojo si queda abajo: para formato condicional del texto.

```dax
Color texto · Ingreso por hora vs mes anterior =
VAR c = [Ingreso por hora · real]
VAR r = [Ingreso por hora · mes anterior]
RETURN IF(ISBLANK(c) || ISBLANK(r), "#6B7682", IF(c >= r, "#16703F", "#B42318"))
```


### Texto · Ingreso por hora vs año anterior
Ingreso por hora real contra año anterior, como texto con flecha (▲ arriba, ▼ abajo). Para tarjetas nativas, títulos o tooltips.

```dax
Texto · Ingreso por hora vs año anterior =
VAR c = [Ingreso por hora · real]
VAR r = [Ingreso por hora · año anterior]
RETURN
    IF(
        NOT(ISBLANK(c)) && NOT(ISBLANK(r)) && r <> 0,
        VAR e = DIVIDE(c - r, ABS(r))
        RETURN IF(e >= 0, "▲ ", "▼ ") & SUBSTITUTE(FORMAT(e, "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−") & " vs año anterior"
    )
```


### Color texto · Ingreso por hora vs año anterior
Verde si ingreso por hora supera al año anterior, rojo si queda abajo: para formato condicional del texto.

```dax
Color texto · Ingreso por hora vs año anterior =
VAR c = [Ingreso por hora · real]
VAR r = [Ingreso por hora · año anterior]
RETURN IF(ISBLANK(c) || ISBLANK(r), "#6B7682", IF(c >= r, "#16703F", "#B42318"))
```


### Título · ingresos del año
Título del gráfico de ingresos con el año de análisis.

```dax
Título · ingresos del año =
"Ingresos " & [Año de análisis] & ", mes a mes"
```


### Título · margen operativo del año
Título del gráfico de margen operativo con el año de análisis.

```dax
Título · margen operativo del año =
"Margen operativo " & [Año de análisis] & ", mes a mes"
```


## 7. Imágenes SVG

### SVG · encabezado Resumen
Banda de encabezado de la página Resumen, con el período y la fecha de datos.

```dax
SVG · encabezado Resumen =
VAR _per = [Período largo]
VAR _al = [Datos al]
VAR _vista = IF([Índice desde] = [Índice hasta], "Vista mensual", "Acumulado del año")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 64' width='1280' height='64'><rect width='1280' height='60' fill='#13294B'/><rect y='60' width='1280' height='4' fill='#C8102E'/><rect x='24' y='14' width='32' height='32' rx='7' fill='#C8102E'/><text x='40' y='35' text-anchor='middle' font-family='Segoe UI' font-size='13' font-weight='700' fill='#FFFFFF'>CS</text><text x='70' y='25' font-family='Segoe UI' font-size='10' font-weight='600' fill='#B9C6DA' letter-spacing='1.3'>COBRANZAS DEL SUR S.A.  ·  CONTROL DE GESTIÓN  ·  DATOS FICTICIOS</text><text x='70' y='48' font-family='Segoe UI' font-size='20' font-weight='700' fill='#FFFFFF'>Resumen<tspan font-size='12.5' font-weight='400' fill='#B9C6DA' dx='12'>del período</tspan></text><text x='1256' y='30' text-anchor='end' font-family='Segoe UI' font-size='16' font-weight='700' fill='#FFFFFF'>" & _per & "</text><text x='1256' y='48' text-anchor='end' font-family='Segoe UI' font-size='11' fill='#B9C6DA'>" & _vista & " · datos al " & _al & " · cifras en millones de pesos</text></svg>"
```
 · Categoría: URL de imagen

### SVG · encabezado Estado de resultados
Banda de encabezado de la página Estado de resultados, con el período y la fecha de datos.

```dax
SVG · encabezado Estado de resultados =
VAR _per = [Período largo]
VAR _al = [Datos al]
VAR _vista = IF([Índice desde] = [Índice hasta], "Vista mensual", "Acumulado del año")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 64' width='1280' height='64'><rect width='1280' height='60' fill='#13294B'/><rect y='60' width='1280' height='4' fill='#C8102E'/><rect x='24' y='14' width='32' height='32' rx='7' fill='#C8102E'/><text x='40' y='35' text-anchor='middle' font-family='Segoe UI' font-size='13' font-weight='700' fill='#FFFFFF'>CS</text><text x='70' y='25' font-family='Segoe UI' font-size='10' font-weight='600' fill='#B9C6DA' letter-spacing='1.3'>COBRANZAS DEL SUR S.A.  ·  CONTROL DE GESTIÓN  ·  DATOS FICTICIOS</text><text x='70' y='48' font-family='Segoe UI' font-size='20' font-weight='700' fill='#FFFFFF'>Estado de resultados<tspan font-size='12.5' font-weight='400' fill='#B9C6DA' dx='12'>de gestión, contra presupuesto, forecast y año anterior</tspan></text><text x='1256' y='30' text-anchor='end' font-family='Segoe UI' font-size='16' font-weight='700' fill='#FFFFFF'>" & _per & "</text><text x='1256' y='48' text-anchor='end' font-family='Segoe UI' font-size='11' fill='#B9C6DA'>" & _vista & " · datos al " & _al & " · cifras en millones de pesos</text></svg>"
```
 · Categoría: URL de imagen

### SVG · encabezado Carteras
Banda de encabezado de la página Carteras, con el período y la fecha de datos.

```dax
SVG · encabezado Carteras =
VAR _per = [Período largo]
VAR _al = [Datos al]
VAR _vista = IF([Índice desde] = [Índice hasta], "Vista mensual", "Acumulado del año")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 64' width='1280' height='64'><rect width='1280' height='60' fill='#13294B'/><rect y='60' width='1280' height='4' fill='#C8102E'/><rect x='24' y='14' width='32' height='32' rx='7' fill='#C8102E'/><text x='40' y='35' text-anchor='middle' font-family='Segoe UI' font-size='13' font-weight='700' fill='#FFFFFF'>CS</text><text x='70' y='25' font-family='Segoe UI' font-size='10' font-weight='600' fill='#B9C6DA' letter-spacing='1.3'>COBRANZAS DEL SUR S.A.  ·  CONTROL DE GESTIÓN  ·  DATOS FICTICIOS</text><text x='70' y='48' font-family='Segoe UI' font-size='20' font-weight='700' fill='#FFFFFF'>Carteras<tspan font-size='12.5' font-weight='400' fill='#B9C6DA' dx='12'>rentabilidad y productividad</tspan></text><text x='1256' y='30' text-anchor='end' font-family='Segoe UI' font-size='16' font-weight='700' fill='#FFFFFF'>" & _per & "</text><text x='1256' y='48' text-anchor='end' font-family='Segoe UI' font-size='11' fill='#B9C6DA'>" & _vista & " · datos al " & _al & " · cifras en millones de pesos</text></svg>"
```
 · Categoría: URL de imagen

### SVG · encabezado Drivers
Banda de encabezado de la página Drivers, con el período y la fecha de datos.

```dax
SVG · encabezado Drivers =
VAR _per = [Período largo]
VAR _al = [Datos al]
VAR _vista = IF([Índice desde] = [Índice hasta], "Vista mensual", "Acumulado del año")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 64' width='1280' height='64'><rect width='1280' height='60' fill='#13294B'/><rect y='60' width='1280' height='4' fill='#C8102E'/><rect x='24' y='14' width='32' height='32' rx='7' fill='#C8102E'/><text x='40' y='35' text-anchor='middle' font-family='Segoe UI' font-size='13' font-weight='700' fill='#FFFFFF'>CS</text><text x='70' y='25' font-family='Segoe UI' font-size='10' font-weight='600' fill='#B9C6DA' letter-spacing='1.3'>COBRANZAS DEL SUR S.A.  ·  CONTROL DE GESTIÓN  ·  DATOS FICTICIOS</text><text x='70' y='48' font-family='Segoe UI' font-size='20' font-weight='700' fill='#FFFFFF'>Drivers<tspan font-size='12.5' font-weight='400' fill='#B9C6DA' dx='12'>recupero, fee, deuda y posiciones</tspan></text><text x='1256' y='30' text-anchor='end' font-family='Segoe UI' font-size='16' font-weight='700' fill='#FFFFFF'>" & _per & "</text><text x='1256' y='48' text-anchor='end' font-family='Segoe UI' font-size='11' fill='#B9C6DA'>" & _vista & " · datos al " & _al & " · cifras en millones de pesos</text></svg>"
```
 · Categoría: URL de imagen

### SVG · encabezado Cómo se usa
Banda de encabezado de la página Cómo se usa, con el período y la fecha de datos.

```dax
SVG · encabezado Cómo se usa =
VAR _per = [Período largo]
VAR _al = [Datos al]
VAR _vista = IF([Índice desde] = [Índice hasta], "Vista mensual", "Acumulado del año")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 64' width='1280' height='64'><rect width='1280' height='60' fill='#13294B'/><rect y='60' width='1280' height='4' fill='#C8102E'/><rect x='24' y='14' width='32' height='32' rx='7' fill='#C8102E'/><text x='40' y='35' text-anchor='middle' font-family='Segoe UI' font-size='13' font-weight='700' fill='#FFFFFF'>CS</text><text x='70' y='25' font-family='Segoe UI' font-size='10' font-weight='600' fill='#B9C6DA' letter-spacing='1.3'>COBRANZAS DEL SUR S.A.  ·  CONTROL DE GESTIÓN  ·  DATOS FICTICIOS</text><text x='70' y='48' font-family='Segoe UI' font-size='20' font-weight='700' fill='#FFFFFF'>Cómo se usa<tspan font-size='12.5' font-weight='400' fill='#B9C6DA' dx='12'>período, modelo y control de números</tspan></text><text x='1256' y='30' text-anchor='end' font-family='Segoe UI' font-size='16' font-weight='700' fill='#FFFFFF'>" & _per & "</text><text x='1256' y='48' text-anchor='end' font-family='Segoe UI' font-size='11' fill='#B9C6DA'>" & _vista & " · datos al " & _al & " · cifras en millones de pesos</text></svg>"
```
 · Categoría: URL de imagen

### SVG · leyenda
Referencia de colores: real, presupuesto, forecast y año anterior.

```dax
SVG · leyenda =
"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 356 40' width='356' height='40'><rect x='4' y='14' width='12' height='12' rx='2' fill='#13294B'/><text x='21' y='24' font-family='Segoe UI' font-size='11' fill='#3F4B58'>Real</text><line x1='61.4' y1='20' x2='77.4' y2='20' stroke='#98A2AE' stroke-width='2.2' stroke-dasharray='4 2.5'/><text x='82.4' y='24' font-family='Segoe UI' font-size='11' fill='#3F4B58'>Presupuesto</text><line x1='165.5' y1='20' x2='181.5' y2='20' stroke='#EB6834' stroke-width='2.2' stroke-dasharray='4 2.5'/><text x='186.5' y='24' font-family='Segoe UI' font-size='11' fill='#3F4B58'>Forecast</text><line x1='251.3' y1='20' x2='267.3' y2='20' stroke='#C5CBD3' stroke-width='2.2' stroke-dasharray='1.5 2.5' stroke-linecap='round'/><text x='272.3' y='24' font-family='Segoe UI' font-size='11' fill='#3F4B58'>Año anterior</text></svg>"
```
 · Categoría: URL de imagen

### SVG · tarjeta Ingresos
Tarjeta de ingresos: valor del período, estado, comparación con presupuesto, mes anterior y año anterior, y tendencia del año.

```dax
SVG · tarjeta Ingresos =
VAR _v = [Ingresos · real]
VAR _c0 = [Ingresos · real]
VAR _r0 = [Ingresos · presupuesto]
VAR _d0 = _c0 - _r0
VAR _t0 = IF(ISBLANK(_r0) || _r0 = 0 || ISBLANK(_c0), "—", SUBSTITUTE(FORMAT(DIVIDE(_d0, ABS(_r0)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−") & " · " & IF(_d0 < 0, "−", "+") & "$ " & FORMAT(ABS(_d0) / 1000000, "#,##0.0", "es-AR") & " M")
VAR _k0 = IF(ISBLANK(_r0) || ISBLANK(_c0), "#6B7682", IF(ABS(DIVIDE(_d0, ABS(_r0))) < 0.0005, "#6B7682", IF(_d0 >= 0, "#16703F", "#B42318")))
VAR _c1 = [Ingresos · real]
VAR _r1 = [Ingresos · mes anterior]
VAR _d1 = _c1 - _r1
VAR _t1 = IF(ISBLANK(_r1) || _r1 = 0 || ISBLANK(_c1), "—", SUBSTITUTE(FORMAT(DIVIDE(_d1, ABS(_r1)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
VAR _k1 = IF(ISBLANK(_r1) || ISBLANK(_c1), "#6B7682", IF(ABS(DIVIDE(_d1, ABS(_r1))) < 0.0005, "#6B7682", IF(_d1 >= 0, "#16703F", "#B42318")))
VAR _c2 = [Ingresos · real]
VAR _r2 = [Ingresos · año anterior]
VAR _d2 = _c2 - _r2
VAR _t2 = IF(ISBLANK(_r2) || _r2 = 0 || ISBLANK(_c2), "—", SUBSTITUTE(FORMAT(DIVIDE(_d2, ABS(_r2)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
VAR _k2 = IF(ISBLANK(_r2) || ISBLANK(_c2), "#6B7682", IF(ABS(DIVIDE(_d2, ABS(_r2))) < 0.0005, "#6B7682", IF(_d2 >= 0, "#16703F", "#B42318")))
VAR _e = DIVIDE(_d0, ABS(_r0))
VAR _st = IF(ISBLANK(_r0) || ISBLANK(_c0), 0, IF(_e >= 0, 1, IF(_e >= -0.05, 2, 3)))
VAR _stT = SWITCH(_st, 1, "En línea", 2, "Atención", 3, "Desvío", "")
VAR _stF = SWITCH(_st, 1, "#E3F3E6", 2, "#FCEFD2", 3, "#FDE8E7", "#FFFFFF")
VAR _stK = SWITCH(_st, 1, "#16703F", 2, "#8A5A00", 3, "#B42318", "#FFFFFF")
VAR _stW = LEN(_stT) * 5.4 + 16
VAR _stX = FORMAT(228 - _stW, "0.0", "en-US")
VAR _stTX = FORMAT(228 - _stW / 2, "0.0", "en-US")
VAR _stWW = FORMAT(_stW, "0.0", "en-US")
VAR _val = IF(ISBLANK(_v), "—", "$ " & FORMAT(_v / 1000000, "#,##0.0", "es-AR") & " M")
VAR _corte = [Índice de corte]
VAR _hsel = [Índice hasta]
VAR _anio = [Año de análisis]
VAR _g0 = ADDCOLUMNS(FILTER(ALL(Calendario[indice], Calendario[anio]), Calendario[anio] = _anio), "@r0", [Ingresos (mes) · real], "@p0", [Ingresos (mes) · presupuesto], "@f0", [Ingresos (mes) · forecast])
VAR _g = ADDCOLUMNS(_g0, "@r", IF(Calendario[indice] <= _corte, [@r0]), "@p", [@p0], "@f", IF(Calendario[indice] > _corte, [@f0]))
VAR _gi0 = MINX(_g, Calendario[indice])
VAR _gr = FILTER(_g, NOT(ISBLANK([@r])))
VAR _gp = FILTER(_g, NOT(ISBLANK([@p])))
VAR _grc = MAXX(_gr, Calendario[indice])
VAR _gvc = MAXX(FILTER(_gr, Calendario[indice] = _grc), [@r])
VAR _gf = ADDCOLUMNS(FILTER(_g, Calendario[indice] = _grc || (Calendario[indice] > _grc && NOT(ISBLANK([@f])))), "@v", IF(Calendario[indice] = _grc, _gvc, [@f]))
VAR _gall = FILTER(UNION(SELECTCOLUMNS(_gr, "v", [@r]), SELECTCOLUMNS(_gp, "v", [@p]), SELECTCOLUMNS(_gf, "v", [@v])), NOT(ISBLANK([v])))
VAR _gmn = MINX(_gall, [v])
VAR _gmx = MAXX(_gall, [v])
VAR _grg = IF(_gmx - _gmn = 0, 1, _gmx - _gmn)
VAR _ptsR = CONCATENATEX(_gr, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@r] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsP = CONCATENATEX(_gp, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@p] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsF = IF(COUNTROWS(_gf) > 1, CONCATENATEX(_gf, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@v] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC), "")
VAR _di = IF(_hsel <= _grc, _hsel, _grc)
VAR _dv = MAXX(FILTER(_gr, Calendario[indice] = _di), [@r])
VAR _cx = FORMAT(14 + (_di - _gi0) * 212 / 11, "0.0", "en-US")
VAR _cy = FORMAT(141 - (_dv - _gmn) / _grg * 27, "0.0", "en-US")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 150' width='240' height='150'><rect x='0.5' y='0.5' width='239' height='149' rx='8' fill='#FFFFFF' stroke='#E1E5EA'/><path d='M0.5 8.5 Q0.5 0.5 8.5 0.5 H231.5 Q239.5 0.5 239.5 8.5 V3.5 H0.5 Z' fill='#13294B'/><text x='14' y='26' font-family='Segoe UI' font-size='11.5' font-weight='600' fill='#3F4B58'>Ingresos</text><rect x='" & _stX & "' y='13' width='" & _stWW & "' height='17' rx='8.5' fill='" & _stF & "'/><text x='" & _stTX & "' y='25' text-anchor='middle' font-family='Segoe UI' font-size='9.5' font-weight='600' fill='" & _stK & "'>" & _stT & "</text><text x='14' y='57' font-family='Segoe UI' font-size='25' font-weight='700' fill='#111A24'>" & _val & "</text><text x='14' y='77' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs presupuesto</text><text x='226' y='77' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k0 & "'>" & _t0 & "</text><text x='14' y='91' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs mes anterior</text><text x='226' y='91' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k1 & "'>" & _t1 & "</text><text x='14' y='105' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs año anterior</text><text x='226' y='105' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k2 & "'>" & _t2 & "</text><line x1='14' y1='141' x2='226' y2='141' stroke='#E1E5EA' stroke-width='1'/><polyline points='" & _ptsP & "' fill='none' stroke='#98A2AE' stroke-width='1.3' stroke-dasharray='3 2.5'/><polyline points='" & _ptsF & "' fill='none' stroke='#EB6834' stroke-width='1.5' stroke-dasharray='4 2.5'/><polyline points='" & _ptsR & "' fill='none' stroke='#13294B' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/><circle cx='" & _cx & "' cy='" & _cy & "' r='3.2' fill='#FFFFFF' stroke='#13294B' stroke-width='2'/></svg>"
```
 · Categoría: URL de imagen

### SVG · tarjeta Margen operativo
Tarjeta de margen operativo: valor del período, estado, comparación con presupuesto, mes anterior y año anterior, y tendencia del año.

```dax
SVG · tarjeta Margen operativo =
VAR _v = [Margen operativo % · real]
VAR _c0 = [Margen operativo % · real]
VAR _r0 = [Margen operativo % · presupuesto]
VAR _d0 = _c0 - _r0
VAR _t0 = IF(ISBLANK(_r0) || ISBLANK(_c0), "—", SUBSTITUTE(FORMAT((_d0) * 100, "+0.0;-0.0;0.0", "es-AR"), "-", "−") & " pp")
VAR _k0 = IF(ISBLANK(_r0) || ISBLANK(_c0), "#6B7682", IF(ABS(_d0) < 0.0005, "#6B7682", IF(_d0 >= 0, "#16703F", "#B42318")))
VAR _c1 = [Margen operativo % · real]
VAR _r1 = [Margen operativo % · mes anterior]
VAR _d1 = _c1 - _r1
VAR _t1 = IF(ISBLANK(_r1) || ISBLANK(_c1), "—", SUBSTITUTE(FORMAT((_d1) * 100, "+0.0;-0.0;0.0", "es-AR"), "-", "−") & " pp")
VAR _k1 = IF(ISBLANK(_r1) || ISBLANK(_c1), "#6B7682", IF(ABS(_d1) < 0.0005, "#6B7682", IF(_d1 >= 0, "#16703F", "#B42318")))
VAR _c2 = [Margen operativo % · real]
VAR _r2 = [Margen operativo % · año anterior]
VAR _d2 = _c2 - _r2
VAR _t2 = IF(ISBLANK(_r2) || ISBLANK(_c2), "—", SUBSTITUTE(FORMAT((_d2) * 100, "+0.0;-0.0;0.0", "es-AR"), "-", "−") & " pp")
VAR _k2 = IF(ISBLANK(_r2) || ISBLANK(_c2), "#6B7682", IF(ABS(_d2) < 0.0005, "#6B7682", IF(_d2 >= 0, "#16703F", "#B42318")))
VAR _e = _d0
VAR _st = IF(ISBLANK(_r0) || ISBLANK(_c0), 0, IF(_e >= 0, 1, IF(_e >= -0.01, 2, 3)))
VAR _stT = SWITCH(_st, 1, "En línea", 2, "Atención", 3, "Desvío", "")
VAR _stF = SWITCH(_st, 1, "#E3F3E6", 2, "#FCEFD2", 3, "#FDE8E7", "#FFFFFF")
VAR _stK = SWITCH(_st, 1, "#16703F", 2, "#8A5A00", 3, "#B42318", "#FFFFFF")
VAR _stW = LEN(_stT) * 5.4 + 16
VAR _stX = FORMAT(228 - _stW, "0.0", "en-US")
VAR _stTX = FORMAT(228 - _stW / 2, "0.0", "en-US")
VAR _stWW = FORMAT(_stW, "0.0", "en-US")
VAR _val = IF(ISBLANK(_v), "—", SUBSTITUTE(FORMAT(_v, "0.0%", "es-AR"), "-", "−"))
VAR _corte = [Índice de corte]
VAR _hsel = [Índice hasta]
VAR _anio = [Año de análisis]
VAR _g0 = ADDCOLUMNS(FILTER(ALL(Calendario[indice], Calendario[anio]), Calendario[anio] = _anio), "@r0", [Margen operativo % (mes) · real], "@p0", [Margen operativo % (mes) · presupuesto], "@f0", [Margen operativo % (mes) · forecast])
VAR _g = ADDCOLUMNS(_g0, "@r", IF(Calendario[indice] <= _corte, [@r0]), "@p", [@p0], "@f", IF(Calendario[indice] > _corte, [@f0]))
VAR _gi0 = MINX(_g, Calendario[indice])
VAR _gr = FILTER(_g, NOT(ISBLANK([@r])))
VAR _gp = FILTER(_g, NOT(ISBLANK([@p])))
VAR _grc = MAXX(_gr, Calendario[indice])
VAR _gvc = MAXX(FILTER(_gr, Calendario[indice] = _grc), [@r])
VAR _gf = ADDCOLUMNS(FILTER(_g, Calendario[indice] = _grc || (Calendario[indice] > _grc && NOT(ISBLANK([@f])))), "@v", IF(Calendario[indice] = _grc, _gvc, [@f]))
VAR _gall = FILTER(UNION(SELECTCOLUMNS(_gr, "v", [@r]), SELECTCOLUMNS(_gp, "v", [@p]), SELECTCOLUMNS(_gf, "v", [@v])), NOT(ISBLANK([v])))
VAR _gmn = MINX(_gall, [v])
VAR _gmx = MAXX(_gall, [v])
VAR _grg = IF(_gmx - _gmn = 0, 1, _gmx - _gmn)
VAR _ptsR = CONCATENATEX(_gr, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@r] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsP = CONCATENATEX(_gp, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@p] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsF = IF(COUNTROWS(_gf) > 1, CONCATENATEX(_gf, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@v] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC), "")
VAR _di = IF(_hsel <= _grc, _hsel, _grc)
VAR _dv = MAXX(FILTER(_gr, Calendario[indice] = _di), [@r])
VAR _cx = FORMAT(14 + (_di - _gi0) * 212 / 11, "0.0", "en-US")
VAR _cy = FORMAT(141 - (_dv - _gmn) / _grg * 27, "0.0", "en-US")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 150' width='240' height='150'><rect x='0.5' y='0.5' width='239' height='149' rx='8' fill='#FFFFFF' stroke='#E1E5EA'/><path d='M0.5 8.5 Q0.5 0.5 8.5 0.5 H231.5 Q239.5 0.5 239.5 8.5 V3.5 H0.5 Z' fill='#13294B'/><text x='14' y='26' font-family='Segoe UI' font-size='11.5' font-weight='600' fill='#3F4B58'>Margen operativo</text><rect x='" & _stX & "' y='13' width='" & _stWW & "' height='17' rx='8.5' fill='" & _stF & "'/><text x='" & _stTX & "' y='25' text-anchor='middle' font-family='Segoe UI' font-size='9.5' font-weight='600' fill='" & _stK & "'>" & _stT & "</text><text x='14' y='57' font-family='Segoe UI' font-size='25' font-weight='700' fill='#111A24'>" & _val & "</text><text x='14' y='77' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs presupuesto</text><text x='226' y='77' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k0 & "'>" & _t0 & "</text><text x='14' y='91' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs mes anterior</text><text x='226' y='91' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k1 & "'>" & _t1 & "</text><text x='14' y='105' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs año anterior</text><text x='226' y='105' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k2 & "'>" & _t2 & "</text><line x1='14' y1='141' x2='226' y2='141' stroke='#E1E5EA' stroke-width='1'/><polyline points='" & _ptsP & "' fill='none' stroke='#98A2AE' stroke-width='1.3' stroke-dasharray='3 2.5'/><polyline points='" & _ptsF & "' fill='none' stroke='#EB6834' stroke-width='1.5' stroke-dasharray='4 2.5'/><polyline points='" & _ptsR & "' fill='none' stroke='#13294B' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/><circle cx='" & _cx & "' cy='" & _cy & "' r='3.2' fill='#FFFFFF' stroke='#13294B' stroke-width='2'/></svg>"
```
 · Categoría: URL de imagen

### SVG · tarjeta Utilidad neta
Tarjeta de utilidad neta: valor del período, estado, comparación con presupuesto, mes anterior y año anterior, y tendencia del año.

```dax
SVG · tarjeta Utilidad neta =
VAR _v = [Utilidad neta · real]
VAR _c0 = [Utilidad neta · real]
VAR _r0 = [Utilidad neta · presupuesto]
VAR _d0 = _c0 - _r0
VAR _t0 = IF(ISBLANK(_r0) || _r0 = 0 || ISBLANK(_c0), "—", SUBSTITUTE(FORMAT(DIVIDE(_d0, ABS(_r0)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−") & " · " & IF(_d0 < 0, "−", "+") & "$ " & FORMAT(ABS(_d0) / 1000000, "#,##0.0", "es-AR") & " M")
VAR _k0 = IF(ISBLANK(_r0) || ISBLANK(_c0), "#6B7682", IF(ABS(DIVIDE(_d0, ABS(_r0))) < 0.0005, "#6B7682", IF(_d0 >= 0, "#16703F", "#B42318")))
VAR _c1 = [Utilidad neta · real]
VAR _r1 = [Utilidad neta · mes anterior]
VAR _d1 = _c1 - _r1
VAR _t1 = IF(ISBLANK(_r1) || _r1 = 0 || ISBLANK(_c1), "—", SUBSTITUTE(FORMAT(DIVIDE(_d1, ABS(_r1)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
VAR _k1 = IF(ISBLANK(_r1) || ISBLANK(_c1), "#6B7682", IF(ABS(DIVIDE(_d1, ABS(_r1))) < 0.0005, "#6B7682", IF(_d1 >= 0, "#16703F", "#B42318")))
VAR _c2 = [Utilidad neta · real]
VAR _r2 = [Utilidad neta · año anterior]
VAR _d2 = _c2 - _r2
VAR _t2 = IF(ISBLANK(_r2) || _r2 = 0 || ISBLANK(_c2), "—", SUBSTITUTE(FORMAT(DIVIDE(_d2, ABS(_r2)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
VAR _k2 = IF(ISBLANK(_r2) || ISBLANK(_c2), "#6B7682", IF(ABS(DIVIDE(_d2, ABS(_r2))) < 0.0005, "#6B7682", IF(_d2 >= 0, "#16703F", "#B42318")))
VAR _e = DIVIDE(_d0, ABS(_r0))
VAR _st = IF(ISBLANK(_r0) || ISBLANK(_c0), 0, IF(_e >= 0, 1, IF(_e >= -0.05, 2, 3)))
VAR _stT = SWITCH(_st, 1, "En línea", 2, "Atención", 3, "Desvío", "")
VAR _stF = SWITCH(_st, 1, "#E3F3E6", 2, "#FCEFD2", 3, "#FDE8E7", "#FFFFFF")
VAR _stK = SWITCH(_st, 1, "#16703F", 2, "#8A5A00", 3, "#B42318", "#FFFFFF")
VAR _stW = LEN(_stT) * 5.4 + 16
VAR _stX = FORMAT(228 - _stW, "0.0", "en-US")
VAR _stTX = FORMAT(228 - _stW / 2, "0.0", "en-US")
VAR _stWW = FORMAT(_stW, "0.0", "en-US")
VAR _val = IF(ISBLANK(_v), "—", "$ " & FORMAT(_v / 1000000, "#,##0.0", "es-AR") & " M")
VAR _corte = [Índice de corte]
VAR _hsel = [Índice hasta]
VAR _anio = [Año de análisis]
VAR _g0 = ADDCOLUMNS(FILTER(ALL(Calendario[indice], Calendario[anio]), Calendario[anio] = _anio), "@r0", [Utilidad neta (mes) · real], "@p0", [Utilidad neta (mes) · presupuesto], "@f0", [Utilidad neta (mes) · forecast])
VAR _g = ADDCOLUMNS(_g0, "@r", IF(Calendario[indice] <= _corte, [@r0]), "@p", [@p0], "@f", IF(Calendario[indice] > _corte, [@f0]))
VAR _gi0 = MINX(_g, Calendario[indice])
VAR _gr = FILTER(_g, NOT(ISBLANK([@r])))
VAR _gp = FILTER(_g, NOT(ISBLANK([@p])))
VAR _grc = MAXX(_gr, Calendario[indice])
VAR _gvc = MAXX(FILTER(_gr, Calendario[indice] = _grc), [@r])
VAR _gf = ADDCOLUMNS(FILTER(_g, Calendario[indice] = _grc || (Calendario[indice] > _grc && NOT(ISBLANK([@f])))), "@v", IF(Calendario[indice] = _grc, _gvc, [@f]))
VAR _gall = FILTER(UNION(SELECTCOLUMNS(_gr, "v", [@r]), SELECTCOLUMNS(_gp, "v", [@p]), SELECTCOLUMNS(_gf, "v", [@v])), NOT(ISBLANK([v])))
VAR _gmn = MINX(_gall, [v])
VAR _gmx = MAXX(_gall, [v])
VAR _grg = IF(_gmx - _gmn = 0, 1, _gmx - _gmn)
VAR _ptsR = CONCATENATEX(_gr, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@r] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsP = CONCATENATEX(_gp, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@p] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsF = IF(COUNTROWS(_gf) > 1, CONCATENATEX(_gf, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@v] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC), "")
VAR _di = IF(_hsel <= _grc, _hsel, _grc)
VAR _dv = MAXX(FILTER(_gr, Calendario[indice] = _di), [@r])
VAR _cx = FORMAT(14 + (_di - _gi0) * 212 / 11, "0.0", "en-US")
VAR _cy = FORMAT(141 - (_dv - _gmn) / _grg * 27, "0.0", "en-US")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 150' width='240' height='150'><rect x='0.5' y='0.5' width='239' height='149' rx='8' fill='#FFFFFF' stroke='#E1E5EA'/><path d='M0.5 8.5 Q0.5 0.5 8.5 0.5 H231.5 Q239.5 0.5 239.5 8.5 V3.5 H0.5 Z' fill='#13294B'/><text x='14' y='26' font-family='Segoe UI' font-size='11.5' font-weight='600' fill='#3F4B58'>Utilidad neta</text><rect x='" & _stX & "' y='13' width='" & _stWW & "' height='17' rx='8.5' fill='" & _stF & "'/><text x='" & _stTX & "' y='25' text-anchor='middle' font-family='Segoe UI' font-size='9.5' font-weight='600' fill='" & _stK & "'>" & _stT & "</text><text x='14' y='57' font-family='Segoe UI' font-size='25' font-weight='700' fill='#111A24'>" & _val & "</text><text x='14' y='77' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs presupuesto</text><text x='226' y='77' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k0 & "'>" & _t0 & "</text><text x='14' y='91' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs mes anterior</text><text x='226' y='91' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k1 & "'>" & _t1 & "</text><text x='14' y='105' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs año anterior</text><text x='226' y='105' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k2 & "'>" & _t2 & "</text><line x1='14' y1='141' x2='226' y2='141' stroke='#E1E5EA' stroke-width='1'/><polyline points='" & _ptsP & "' fill='none' stroke='#98A2AE' stroke-width='1.3' stroke-dasharray='3 2.5'/><polyline points='" & _ptsF & "' fill='none' stroke='#EB6834' stroke-width='1.5' stroke-dasharray='4 2.5'/><polyline points='" & _ptsR & "' fill='none' stroke='#13294B' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/><circle cx='" & _cx & "' cy='" & _cy & "' r='3.2' fill='#FFFFFF' stroke='#13294B' stroke-width='2'/></svg>"
```
 · Categoría: URL de imagen

### SVG · tarjeta Ingreso por hora
Tarjeta de ingreso por hora: valor del período, estado, comparación con presupuesto, mes anterior y año anterior, y tendencia del año.

```dax
SVG · tarjeta Ingreso por hora =
VAR _v = [Ingreso por hora · real]
VAR _c0 = [Ingreso por hora · real]
VAR _r0 = [Ingreso por hora · presupuesto]
VAR _d0 = _c0 - _r0
VAR _t0 = IF(ISBLANK(_r0) || _r0 = 0 || ISBLANK(_c0), "—", SUBSTITUTE(FORMAT(DIVIDE(_d0, ABS(_r0)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
VAR _k0 = IF(ISBLANK(_r0) || ISBLANK(_c0), "#6B7682", IF(ABS(DIVIDE(_d0, ABS(_r0))) < 0.0005, "#6B7682", IF(_d0 >= 0, "#16703F", "#B42318")))
VAR _c1 = [Ingreso por hora · real]
VAR _r1 = [Ingreso por hora · mes anterior]
VAR _d1 = _c1 - _r1
VAR _t1 = IF(ISBLANK(_r1) || _r1 = 0 || ISBLANK(_c1), "—", SUBSTITUTE(FORMAT(DIVIDE(_d1, ABS(_r1)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
VAR _k1 = IF(ISBLANK(_r1) || ISBLANK(_c1), "#6B7682", IF(ABS(DIVIDE(_d1, ABS(_r1))) < 0.0005, "#6B7682", IF(_d1 >= 0, "#16703F", "#B42318")))
VAR _c2 = [Ingreso por hora · real]
VAR _r2 = [Ingreso por hora · año anterior]
VAR _d2 = _c2 - _r2
VAR _t2 = IF(ISBLANK(_r2) || _r2 = 0 || ISBLANK(_c2), "—", SUBSTITUTE(FORMAT(DIVIDE(_d2, ABS(_r2)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
VAR _k2 = IF(ISBLANK(_r2) || ISBLANK(_c2), "#6B7682", IF(ABS(DIVIDE(_d2, ABS(_r2))) < 0.0005, "#6B7682", IF(_d2 >= 0, "#16703F", "#B42318")))
VAR _e = DIVIDE(_d0, ABS(_r0))
VAR _st = IF(ISBLANK(_r0) || ISBLANK(_c0), 0, IF(_e >= 0, 1, IF(_e >= -0.05, 2, 3)))
VAR _stT = SWITCH(_st, 1, "En línea", 2, "Atención", 3, "Desvío", "")
VAR _stF = SWITCH(_st, 1, "#E3F3E6", 2, "#FCEFD2", 3, "#FDE8E7", "#FFFFFF")
VAR _stK = SWITCH(_st, 1, "#16703F", 2, "#8A5A00", 3, "#B42318", "#FFFFFF")
VAR _stW = LEN(_stT) * 5.4 + 16
VAR _stX = FORMAT(228 - _stW, "0.0", "en-US")
VAR _stTX = FORMAT(228 - _stW / 2, "0.0", "en-US")
VAR _stWW = FORMAT(_stW, "0.0", "en-US")
VAR _val = IF(ISBLANK(_v), "—", "$ " & FORMAT(_v, "#,##0", "es-AR"))
VAR _corte = [Índice de corte]
VAR _hsel = [Índice hasta]
VAR _anio = [Año de análisis]
VAR _g0 = ADDCOLUMNS(FILTER(ALL(Calendario[indice], Calendario[anio]), Calendario[anio] = _anio), "@r0", [Ingreso por hora (mes) · real], "@p0", [Ingreso por hora (mes) · presupuesto], "@f0", [Ingreso por hora (mes) · forecast])
VAR _g = ADDCOLUMNS(_g0, "@r", IF(Calendario[indice] <= _corte, [@r0]), "@p", [@p0], "@f", IF(Calendario[indice] > _corte, [@f0]))
VAR _gi0 = MINX(_g, Calendario[indice])
VAR _gr = FILTER(_g, NOT(ISBLANK([@r])))
VAR _gp = FILTER(_g, NOT(ISBLANK([@p])))
VAR _grc = MAXX(_gr, Calendario[indice])
VAR _gvc = MAXX(FILTER(_gr, Calendario[indice] = _grc), [@r])
VAR _gf = ADDCOLUMNS(FILTER(_g, Calendario[indice] = _grc || (Calendario[indice] > _grc && NOT(ISBLANK([@f])))), "@v", IF(Calendario[indice] = _grc, _gvc, [@f]))
VAR _gall = FILTER(UNION(SELECTCOLUMNS(_gr, "v", [@r]), SELECTCOLUMNS(_gp, "v", [@p]), SELECTCOLUMNS(_gf, "v", [@v])), NOT(ISBLANK([v])))
VAR _gmn = MINX(_gall, [v])
VAR _gmx = MAXX(_gall, [v])
VAR _grg = IF(_gmx - _gmn = 0, 1, _gmx - _gmn)
VAR _ptsR = CONCATENATEX(_gr, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@r] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsP = CONCATENATEX(_gp, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@p] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsF = IF(COUNTROWS(_gf) > 1, CONCATENATEX(_gf, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@v] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC), "")
VAR _di = IF(_hsel <= _grc, _hsel, _grc)
VAR _dv = MAXX(FILTER(_gr, Calendario[indice] = _di), [@r])
VAR _cx = FORMAT(14 + (_di - _gi0) * 212 / 11, "0.0", "en-US")
VAR _cy = FORMAT(141 - (_dv - _gmn) / _grg * 27, "0.0", "en-US")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 150' width='240' height='150'><rect x='0.5' y='0.5' width='239' height='149' rx='8' fill='#FFFFFF' stroke='#E1E5EA'/><path d='M0.5 8.5 Q0.5 0.5 8.5 0.5 H231.5 Q239.5 0.5 239.5 8.5 V3.5 H0.5 Z' fill='#13294B'/><text x='14' y='26' font-family='Segoe UI' font-size='11.5' font-weight='600' fill='#3F4B58'>Ingreso por hora</text><rect x='" & _stX & "' y='13' width='" & _stWW & "' height='17' rx='8.5' fill='" & _stF & "'/><text x='" & _stTX & "' y='25' text-anchor='middle' font-family='Segoe UI' font-size='9.5' font-weight='600' fill='" & _stK & "'>" & _stT & "</text><text x='14' y='57' font-family='Segoe UI' font-size='25' font-weight='700' fill='#111A24'>" & _val & "</text><text x='14' y='77' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs presupuesto</text><text x='226' y='77' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k0 & "'>" & _t0 & "</text><text x='14' y='91' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs mes anterior</text><text x='226' y='91' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k1 & "'>" & _t1 & "</text><text x='14' y='105' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs año anterior</text><text x='226' y='105' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k2 & "'>" & _t2 & "</text><line x1='14' y1='141' x2='226' y2='141' stroke='#E1E5EA' stroke-width='1'/><polyline points='" & _ptsP & "' fill='none' stroke='#98A2AE' stroke-width='1.3' stroke-dasharray='3 2.5'/><polyline points='" & _ptsF & "' fill='none' stroke='#EB6834' stroke-width='1.5' stroke-dasharray='4 2.5'/><polyline points='" & _ptsR & "' fill='none' stroke='#13294B' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/><circle cx='" & _cx & "' cy='" & _cy & "' r='3.2' fill='#FFFFFF' stroke='#13294B' stroke-width='2'/></svg>"
```
 · Categoría: URL de imagen

### SVG · tarjeta Cierre proyectado
Tarjeta del cierre proyectado: utilidad neta acumulada real, forecast hasta diciembre y presupuesto acumulado.

```dax
SVG · tarjeta Cierre proyectado =
VAR _v = [Cierre proyectado]
VAR _c0 = [Cierre proyectado]
VAR _r0 = [Presupuesto anual]
VAR _d0 = _c0 - _r0
VAR _t0 = IF(ISBLANK(_r0) || _r0 = 0 || ISBLANK(_c0), "—", SUBSTITUTE(FORMAT(DIVIDE(_d0, ABS(_r0)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−") & " · " & IF(_d0 < 0, "−", "+") & "$ " & FORMAT(ABS(_d0) / 1000000, "#,##0.0", "es-AR") & " M")
VAR _k0 = IF(ISBLANK(_r0) || ISBLANK(_c0), "#6B7682", IF(ABS(DIVIDE(_d0, ABS(_r0))) < 0.0005, "#6B7682", IF(_d0 >= 0, "#16703F", "#B42318")))
VAR _c1 = [Cierre proyectado]
VAR _r1 = [Forecast anual]
VAR _d1 = _c1 - _r1
VAR _t1 = IF(ISBLANK(_r1) || _r1 = 0 || ISBLANK(_c1), "—", SUBSTITUTE(FORMAT(DIVIDE(_d1, ABS(_r1)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
VAR _k1 = IF(ISBLANK(_r1) || ISBLANK(_c1), "#6B7682", IF(ABS(DIVIDE(_d1, ABS(_r1))) < 0.0005, "#6B7682", IF(_d1 >= 0, "#16703F", "#B42318")))
VAR _c2 = [Cierre proyectado]
VAR _r2 = [Real año anterior completo]
VAR _d2 = _c2 - _r2
VAR _t2 = IF(ISBLANK(_r2) || _r2 = 0 || ISBLANK(_c2), "—", SUBSTITUTE(FORMAT(DIVIDE(_d2, ABS(_r2)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
VAR _k2 = IF(ISBLANK(_r2) || ISBLANK(_c2), "#6B7682", IF(ABS(DIVIDE(_d2, ABS(_r2))) < 0.0005, "#6B7682", IF(_d2 >= 0, "#16703F", "#B42318")))
VAR _e = DIVIDE(_d0, ABS(_r0))
VAR _st = IF(ISBLANK(_r0) || ISBLANK(_c0), 0, IF(_e >= 0, 1, IF(_e >= -0.05, 2, 3)))
VAR _stT = SWITCH(_st, 1, "En línea", 2, "Atención", 3, "Desvío", "")
VAR _stF = SWITCH(_st, 1, "#E3F3E6", 2, "#FCEFD2", 3, "#FDE8E7", "#FFFFFF")
VAR _stK = SWITCH(_st, 1, "#16703F", 2, "#8A5A00", 3, "#B42318", "#FFFFFF")
VAR _stW = LEN(_stT) * 5.4 + 16
VAR _stX = FORMAT(228 - _stW, "0.0", "en-US")
VAR _stTX = FORMAT(228 - _stW / 2, "0.0", "en-US")
VAR _stWW = FORMAT(_stW, "0.0", "en-US")
VAR _val = IF(ISBLANK(_v), "—", "$ " & FORMAT(_v / 1000000, "#,##0.0", "es-AR") & " M")
VAR _corte = [Índice de corte]
VAR _hsel = [Índice hasta]
VAR _anio = [Año de análisis]
VAR _g0 = ADDCOLUMNS(FILTER(ALL(Calendario[indice], Calendario[anio]), Calendario[anio] = _anio), "@r0", [Utilidad neta (mes) · real], "@p0", [Utilidad neta (mes) · presupuesto], "@f0", [Utilidad neta (mes) · forecast])
VAR _g = ADDCOLUMNS(_g0,
    "@r", VAR i = Calendario[indice] RETURN IF(i <= _corte, SUMX(FILTER(_g0, Calendario[indice] <= i), [@r0])),
    "@p", VAR i = Calendario[indice] RETURN SUMX(FILTER(_g0, Calendario[indice] <= i), [@p0]),
    "@f", VAR i = Calendario[indice] RETURN IF(i > _corte, SUMX(FILTER(_g0, Calendario[indice] <= _corte), [@r0]) + SUMX(FILTER(_g0, Calendario[indice] > _corte && Calendario[indice] <= i), [@f0])))
VAR _gi0 = MINX(_g, Calendario[indice])
VAR _gr = FILTER(_g, NOT(ISBLANK([@r])))
VAR _gp = FILTER(_g, NOT(ISBLANK([@p])))
VAR _grc = MAXX(_gr, Calendario[indice])
VAR _gvc = MAXX(FILTER(_gr, Calendario[indice] = _grc), [@r])
VAR _gf = ADDCOLUMNS(FILTER(_g, Calendario[indice] = _grc || (Calendario[indice] > _grc && NOT(ISBLANK([@f])))), "@v", IF(Calendario[indice] = _grc, _gvc, [@f]))
VAR _gall = FILTER(UNION(SELECTCOLUMNS(_gr, "v", [@r]), SELECTCOLUMNS(_gp, "v", [@p]), SELECTCOLUMNS(_gf, "v", [@v])), NOT(ISBLANK([v])))
VAR _gmn = MINX(_gall, [v])
VAR _gmx = MAXX(_gall, [v])
VAR _grg = IF(_gmx - _gmn = 0, 1, _gmx - _gmn)
VAR _ptsR = CONCATENATEX(_gr, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@r] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsP = CONCATENATEX(_gp, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@p] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsF = IF(COUNTROWS(_gf) > 1, CONCATENATEX(_gf, FORMAT(14 + (Calendario[indice] - _gi0) * 212 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@v] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC), "")
VAR _di = IF(COUNTROWS(_gf) > 1, MAXX(_gf, Calendario[indice]), _grc)
VAR _dv = IF(COUNTROWS(_gf) > 1, MAXX(FILTER(_gf, Calendario[indice] = _di), [@v]), _gvc)
VAR _cx = FORMAT(14 + (_di - _gi0) * 212 / 11, "0.0", "en-US")
VAR _cy = FORMAT(141 - (_dv - _gmn) / _grg * 27, "0.0", "en-US")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 150' width='240' height='150'><rect x='0.5' y='0.5' width='239' height='149' rx='8' fill='#FFFFFF' stroke='#E1E5EA'/><path d='M0.5 8.5 Q0.5 0.5 8.5 0.5 H231.5 Q239.5 0.5 239.5 8.5 V3.5 H0.5 Z' fill='#13294B'/><text x='14' y='26' font-family='Segoe UI' font-size='11.5' font-weight='600' fill='#3F4B58'>Cierre proyectado del año</text><rect x='" & _stX & "' y='13' width='" & _stWW & "' height='17' rx='8.5' fill='" & _stF & "'/><text x='" & _stTX & "' y='25' text-anchor='middle' font-family='Segoe UI' font-size='9.5' font-weight='600' fill='" & _stK & "'>" & _stT & "</text><text x='14' y='57' font-family='Segoe UI' font-size='25' font-weight='700' fill='#111A24'>" & _val & "</text><text x='14' y='77' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs presupuesto anual</text><text x='226' y='77' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k0 & "'>" & _t0 & "</text><text x='14' y='91' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs forecast anual</text><text x='226' y='91' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k1 & "'>" & _t1 & "</text><text x='14' y='105' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs año anterior completo</text><text x='226' y='105' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k2 & "'>" & _t2 & "</text><line x1='14' y1='141' x2='226' y2='141' stroke='#E1E5EA' stroke-width='1'/><polyline points='" & _ptsP & "' fill='none' stroke='#98A2AE' stroke-width='1.3' stroke-dasharray='3 2.5'/><polyline points='" & _ptsF & "' fill='none' stroke='#EB6834' stroke-width='1.5' stroke-dasharray='4 2.5'/><polyline points='" & _ptsR & "' fill='none' stroke='#13294B' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/><circle cx='" & _cx & "' cy='" & _cy & "' r='3.2' fill='#FFFFFF' stroke='#13294B' stroke-width='2'/></svg>"
```
 · Categoría: URL de imagen

### SVG · tarjeta % de recupero
Tarjeta de % de recupero para la página Drivers.

```dax
SVG · tarjeta % de recupero =
VAR _v = [% recupero · real]
VAR _c0 = [% recupero · real]
VAR _r0 = [% recupero · presupuesto]
VAR _d0 = _c0 - _r0
VAR _t0 = IF(ISBLANK(_r0) || ISBLANK(_c0), "—", SUBSTITUTE(FORMAT((_d0) * 100, "+0.0;-0.0;0.0", "es-AR"), "-", "−") & " pp")
VAR _k0 = IF(ISBLANK(_r0) || ISBLANK(_c0), "#6B7682", IF(ABS(_d0) < 0.0005, "#6B7682", IF(_d0 >= 0, "#16703F", "#B42318")))
VAR _c1 = [% recupero · real]
VAR _r1 = [% recupero · mes anterior]
VAR _d1 = _c1 - _r1
VAR _t1 = IF(ISBLANK(_r1) || ISBLANK(_c1), "—", SUBSTITUTE(FORMAT((_d1) * 100, "+0.0;-0.0;0.0", "es-AR"), "-", "−") & " pp")
VAR _k1 = IF(ISBLANK(_r1) || ISBLANK(_c1), "#6B7682", IF(ABS(_d1) < 0.0005, "#6B7682", IF(_d1 >= 0, "#16703F", "#B42318")))
VAR _c2 = [% recupero · real]
VAR _r2 = [% recupero · año anterior]
VAR _d2 = _c2 - _r2
VAR _t2 = IF(ISBLANK(_r2) || ISBLANK(_c2), "—", SUBSTITUTE(FORMAT((_d2) * 100, "+0.0;-0.0;0.0", "es-AR"), "-", "−") & " pp")
VAR _k2 = IF(ISBLANK(_r2) || ISBLANK(_c2), "#6B7682", IF(ABS(_d2) < 0.0005, "#6B7682", IF(_d2 >= 0, "#16703F", "#B42318")))
VAR _e = _d0
VAR _st = IF(ISBLANK(_r0) || ISBLANK(_c0), 0, IF(_e >= 0, 1, IF(_e >= -0.01, 2, 3)))
VAR _stT = SWITCH(_st, 1, "En línea", 2, "Atención", 3, "Desvío", "")
VAR _stF = SWITCH(_st, 1, "#E3F3E6", 2, "#FCEFD2", 3, "#FDE8E7", "#FFFFFF")
VAR _stK = SWITCH(_st, 1, "#16703F", 2, "#8A5A00", 3, "#B42318", "#FFFFFF")
VAR _stW = LEN(_stT) * 5.4 + 16
VAR _stX = FORMAT(237 - _stW, "0.0", "en-US")
VAR _stTX = FORMAT(237 - _stW / 2, "0.0", "en-US")
VAR _stWW = FORMAT(_stW, "0.0", "en-US")
VAR _val = IF(ISBLANK(_v), "—", SUBSTITUTE(FORMAT(_v, "0.0%", "es-AR"), "-", "−"))
VAR _corte = [Índice de corte]
VAR _hsel = [Índice hasta]
VAR _anio = [Año de análisis]
VAR _g0 = ADDCOLUMNS(FILTER(ALL(Calendario[indice], Calendario[anio]), Calendario[anio] = _anio), "@r0", [% recupero (mes) · real], "@p0", [% recupero (mes) · presupuesto], "@f0", [% recupero (mes) · forecast])
VAR _g = ADDCOLUMNS(_g0, "@r", IF(Calendario[indice] <= _corte, [@r0]), "@p", [@p0], "@f", IF(Calendario[indice] > _corte, [@f0]))
VAR _gi0 = MINX(_g, Calendario[indice])
VAR _gr = FILTER(_g, NOT(ISBLANK([@r])))
VAR _gp = FILTER(_g, NOT(ISBLANK([@p])))
VAR _grc = MAXX(_gr, Calendario[indice])
VAR _gvc = MAXX(FILTER(_gr, Calendario[indice] = _grc), [@r])
VAR _gf = ADDCOLUMNS(FILTER(_g, Calendario[indice] = _grc || (Calendario[indice] > _grc && NOT(ISBLANK([@f])))), "@v", IF(Calendario[indice] = _grc, _gvc, [@f]))
VAR _gall = FILTER(UNION(SELECTCOLUMNS(_gr, "v", [@r]), SELECTCOLUMNS(_gp, "v", [@p]), SELECTCOLUMNS(_gf, "v", [@v])), NOT(ISBLANK([v])))
VAR _gmn = MINX(_gall, [v])
VAR _gmx = MAXX(_gall, [v])
VAR _grg = IF(_gmx - _gmn = 0, 1, _gmx - _gmn)
VAR _ptsR = CONCATENATEX(_gr, FORMAT(14 + (Calendario[indice] - _gi0) * 221 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@r] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsP = CONCATENATEX(_gp, FORMAT(14 + (Calendario[indice] - _gi0) * 221 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@p] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsF = IF(COUNTROWS(_gf) > 1, CONCATENATEX(_gf, FORMAT(14 + (Calendario[indice] - _gi0) * 221 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@v] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC), "")
VAR _di = IF(_hsel <= _grc, _hsel, _grc)
VAR _dv = MAXX(FILTER(_gr, Calendario[indice] = _di), [@r])
VAR _cx = FORMAT(14 + (_di - _gi0) * 221 / 11, "0.0", "en-US")
VAR _cy = FORMAT(141 - (_dv - _gmn) / _grg * 27, "0.0", "en-US")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 249 150' width='249' height='150'><rect x='0.5' y='0.5' width='248' height='149' rx='8' fill='#FFFFFF' stroke='#E1E5EA'/><path d='M0.5 8.5 Q0.5 0.5 8.5 0.5 H240.5 Q248.5 0.5 248.5 8.5 V3.5 H0.5 Z' fill='#13294B'/><text x='14' y='26' font-family='Segoe UI' font-size='11.5' font-weight='600' fill='#3F4B58'>% de recupero</text><rect x='" & _stX & "' y='13' width='" & _stWW & "' height='17' rx='8.5' fill='" & _stF & "'/><text x='" & _stTX & "' y='25' text-anchor='middle' font-family='Segoe UI' font-size='9.5' font-weight='600' fill='" & _stK & "'>" & _stT & "</text><text x='14' y='57' font-family='Segoe UI' font-size='25' font-weight='700' fill='#111A24'>" & _val & "</text><text x='14' y='77' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs presupuesto</text><text x='235' y='77' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k0 & "'>" & _t0 & "</text><text x='14' y='91' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs mes anterior</text><text x='235' y='91' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k1 & "'>" & _t1 & "</text><text x='14' y='105' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs año anterior</text><text x='235' y='105' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k2 & "'>" & _t2 & "</text><line x1='14' y1='141' x2='235' y2='141' stroke='#E1E5EA' stroke-width='1'/><polyline points='" & _ptsP & "' fill='none' stroke='#98A2AE' stroke-width='1.3' stroke-dasharray='3 2.5'/><polyline points='" & _ptsF & "' fill='none' stroke='#EB6834' stroke-width='1.5' stroke-dasharray='4 2.5'/><polyline points='" & _ptsR & "' fill='none' stroke='#13294B' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/><circle cx='" & _cx & "' cy='" & _cy & "' r='3.2' fill='#FFFFFF' stroke='#13294B' stroke-width='2'/></svg>"
```
 · Categoría: URL de imagen

### SVG · tarjeta Fee promedio
Tarjeta de fee promedio para la página Drivers.

```dax
SVG · tarjeta Fee promedio =
VAR _v = [Fee · real]
VAR _c0 = [Fee · real]
VAR _r0 = [Fee · presupuesto]
VAR _d0 = _c0 - _r0
VAR _t0 = IF(ISBLANK(_r0) || ISBLANK(_c0), "—", SUBSTITUTE(FORMAT((_d0) * 100, "+0.00;-0.00;0.00", "es-AR"), "-", "−") & " pp")
VAR _k0 = IF(ISBLANK(_r0) || ISBLANK(_c0), "#6B7682", IF(ABS(_d0) < 5e-05, "#6B7682", IF(_d0 >= 0, "#16703F", "#B42318")))
VAR _c1 = [Fee · real]
VAR _r1 = [Fee · mes anterior]
VAR _d1 = _c1 - _r1
VAR _t1 = IF(ISBLANK(_r1) || ISBLANK(_c1), "—", SUBSTITUTE(FORMAT((_d1) * 100, "+0.00;-0.00;0.00", "es-AR"), "-", "−") & " pp")
VAR _k1 = IF(ISBLANK(_r1) || ISBLANK(_c1), "#6B7682", IF(ABS(_d1) < 5e-05, "#6B7682", IF(_d1 >= 0, "#16703F", "#B42318")))
VAR _c2 = [Fee · real]
VAR _r2 = [Fee · año anterior]
VAR _d2 = _c2 - _r2
VAR _t2 = IF(ISBLANK(_r2) || ISBLANK(_c2), "—", SUBSTITUTE(FORMAT((_d2) * 100, "+0.00;-0.00;0.00", "es-AR"), "-", "−") & " pp")
VAR _k2 = IF(ISBLANK(_r2) || ISBLANK(_c2), "#6B7682", IF(ABS(_d2) < 5e-05, "#6B7682", IF(_d2 >= 0, "#16703F", "#B42318")))
VAR _e = _d0
VAR _st = IF(ISBLANK(_r0) || ISBLANK(_c0), 0, IF(_e >= 0, 1, IF(_e >= -0.002, 2, 3)))
VAR _stT = SWITCH(_st, 1, "En línea", 2, "Atención", 3, "Desvío", "")
VAR _stF = SWITCH(_st, 1, "#E3F3E6", 2, "#FCEFD2", 3, "#FDE8E7", "#FFFFFF")
VAR _stK = SWITCH(_st, 1, "#16703F", 2, "#8A5A00", 3, "#B42318", "#FFFFFF")
VAR _stW = LEN(_stT) * 5.4 + 16
VAR _stX = FORMAT(237 - _stW, "0.0", "en-US")
VAR _stTX = FORMAT(237 - _stW / 2, "0.0", "en-US")
VAR _stWW = FORMAT(_stW, "0.0", "en-US")
VAR _val = IF(ISBLANK(_v), "—", FORMAT(_v, "0.00%", "es-AR"))
VAR _corte = [Índice de corte]
VAR _hsel = [Índice hasta]
VAR _anio = [Año de análisis]
VAR _g0 = ADDCOLUMNS(FILTER(ALL(Calendario[indice], Calendario[anio]), Calendario[anio] = _anio), "@r0", [Fee (mes) · real], "@p0", [Fee (mes) · presupuesto], "@f0", [Fee (mes) · forecast])
VAR _g = ADDCOLUMNS(_g0, "@r", IF(Calendario[indice] <= _corte, [@r0]), "@p", [@p0], "@f", IF(Calendario[indice] > _corte, [@f0]))
VAR _gi0 = MINX(_g, Calendario[indice])
VAR _gr = FILTER(_g, NOT(ISBLANK([@r])))
VAR _gp = FILTER(_g, NOT(ISBLANK([@p])))
VAR _grc = MAXX(_gr, Calendario[indice])
VAR _gvc = MAXX(FILTER(_gr, Calendario[indice] = _grc), [@r])
VAR _gf = ADDCOLUMNS(FILTER(_g, Calendario[indice] = _grc || (Calendario[indice] > _grc && NOT(ISBLANK([@f])))), "@v", IF(Calendario[indice] = _grc, _gvc, [@f]))
VAR _gall = FILTER(UNION(SELECTCOLUMNS(_gr, "v", [@r]), SELECTCOLUMNS(_gp, "v", [@p]), SELECTCOLUMNS(_gf, "v", [@v])), NOT(ISBLANK([v])))
VAR _gmn = MINX(_gall, [v])
VAR _gmx = MAXX(_gall, [v])
VAR _grg = IF(_gmx - _gmn = 0, 1, _gmx - _gmn)
VAR _ptsR = CONCATENATEX(_gr, FORMAT(14 + (Calendario[indice] - _gi0) * 221 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@r] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsP = CONCATENATEX(_gp, FORMAT(14 + (Calendario[indice] - _gi0) * 221 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@p] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsF = IF(COUNTROWS(_gf) > 1, CONCATENATEX(_gf, FORMAT(14 + (Calendario[indice] - _gi0) * 221 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@v] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC), "")
VAR _di = IF(_hsel <= _grc, _hsel, _grc)
VAR _dv = MAXX(FILTER(_gr, Calendario[indice] = _di), [@r])
VAR _cx = FORMAT(14 + (_di - _gi0) * 221 / 11, "0.0", "en-US")
VAR _cy = FORMAT(141 - (_dv - _gmn) / _grg * 27, "0.0", "en-US")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 249 150' width='249' height='150'><rect x='0.5' y='0.5' width='248' height='149' rx='8' fill='#FFFFFF' stroke='#E1E5EA'/><path d='M0.5 8.5 Q0.5 0.5 8.5 0.5 H240.5 Q248.5 0.5 248.5 8.5 V3.5 H0.5 Z' fill='#13294B'/><text x='14' y='26' font-family='Segoe UI' font-size='11.5' font-weight='600' fill='#3F4B58'>Fee promedio</text><rect x='" & _stX & "' y='13' width='" & _stWW & "' height='17' rx='8.5' fill='" & _stF & "'/><text x='" & _stTX & "' y='25' text-anchor='middle' font-family='Segoe UI' font-size='9.5' font-weight='600' fill='" & _stK & "'>" & _stT & "</text><text x='14' y='57' font-family='Segoe UI' font-size='25' font-weight='700' fill='#111A24'>" & _val & "</text><text x='14' y='77' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs presupuesto</text><text x='235' y='77' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k0 & "'>" & _t0 & "</text><text x='14' y='91' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs mes anterior</text><text x='235' y='91' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k1 & "'>" & _t1 & "</text><text x='14' y='105' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs año anterior</text><text x='235' y='105' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k2 & "'>" & _t2 & "</text><line x1='14' y1='141' x2='235' y2='141' stroke='#E1E5EA' stroke-width='1'/><polyline points='" & _ptsP & "' fill='none' stroke='#98A2AE' stroke-width='1.3' stroke-dasharray='3 2.5'/><polyline points='" & _ptsF & "' fill='none' stroke='#EB6834' stroke-width='1.5' stroke-dasharray='4 2.5'/><polyline points='" & _ptsR & "' fill='none' stroke='#13294B' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/><circle cx='" & _cx & "' cy='" & _cy & "' r='3.2' fill='#FFFFFF' stroke='#13294B' stroke-width='2'/></svg>"
```
 · Categoría: URL de imagen

### SVG · tarjeta Deuda asignada
Tarjeta de deuda asignada para la página Drivers.

```dax
SVG · tarjeta Deuda asignada =
VAR _v = [Deuda asignada · real]
VAR _c0 = [Deuda asignada · real]
VAR _r0 = [Deuda asignada · presupuesto]
VAR _d0 = _c0 - _r0
VAR _t0 = IF(ISBLANK(_r0) || _r0 = 0 || ISBLANK(_c0), "—", SUBSTITUTE(FORMAT(DIVIDE(_d0, ABS(_r0)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
VAR _k0 = IF(ISBLANK(_r0) || ISBLANK(_c0), "#6B7682", IF(ABS(DIVIDE(_d0, ABS(_r0))) < 0.0005, "#6B7682", IF(_d0 >= 0, "#16703F", "#B42318")))
VAR _c1 = [Deuda asignada · real]
VAR _r1 = [Deuda asignada · mes anterior]
VAR _d1 = _c1 - _r1
VAR _t1 = IF(ISBLANK(_r1) || _r1 = 0 || ISBLANK(_c1), "—", SUBSTITUTE(FORMAT(DIVIDE(_d1, ABS(_r1)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
VAR _k1 = IF(ISBLANK(_r1) || ISBLANK(_c1), "#6B7682", IF(ABS(DIVIDE(_d1, ABS(_r1))) < 0.0005, "#6B7682", IF(_d1 >= 0, "#16703F", "#B42318")))
VAR _c2 = [Deuda asignada · real]
VAR _r2 = [Deuda asignada · año anterior]
VAR _d2 = _c2 - _r2
VAR _t2 = IF(ISBLANK(_r2) || _r2 = 0 || ISBLANK(_c2), "—", SUBSTITUTE(FORMAT(DIVIDE(_d2, ABS(_r2)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
VAR _k2 = IF(ISBLANK(_r2) || ISBLANK(_c2), "#6B7682", IF(ABS(DIVIDE(_d2, ABS(_r2))) < 0.0005, "#6B7682", IF(_d2 >= 0, "#16703F", "#B42318")))
VAR _e = DIVIDE(_d0, ABS(_r0))
VAR _st = IF(ISBLANK(_r0) || ISBLANK(_c0), 0, IF(_e >= 0, 1, IF(_e >= -0.05, 2, 3)))
VAR _stT = SWITCH(_st, 1, "En línea", 2, "Atención", 3, "Desvío", "")
VAR _stF = SWITCH(_st, 1, "#E3F3E6", 2, "#FCEFD2", 3, "#FDE8E7", "#FFFFFF")
VAR _stK = SWITCH(_st, 1, "#16703F", 2, "#8A5A00", 3, "#B42318", "#FFFFFF")
VAR _stW = LEN(_stT) * 5.4 + 16
VAR _stX = FORMAT(237 - _stW, "0.0", "en-US")
VAR _stTX = FORMAT(237 - _stW / 2, "0.0", "en-US")
VAR _stWW = FORMAT(_stW, "0.0", "en-US")
VAR _val = IF(ISBLANK(_v), "—", "$ " & FORMAT(_v / 1000000, "#,##0.0", "es-AR") & " M")
VAR _corte = [Índice de corte]
VAR _hsel = [Índice hasta]
VAR _anio = [Año de análisis]
VAR _g0 = ADDCOLUMNS(FILTER(ALL(Calendario[indice], Calendario[anio]), Calendario[anio] = _anio), "@r0", [Deuda asignada (mes) · real], "@p0", [Deuda asignada (mes) · presupuesto], "@f0", [Deuda asignada (mes) · forecast])
VAR _g = ADDCOLUMNS(_g0, "@r", IF(Calendario[indice] <= _corte, [@r0]), "@p", [@p0], "@f", IF(Calendario[indice] > _corte, [@f0]))
VAR _gi0 = MINX(_g, Calendario[indice])
VAR _gr = FILTER(_g, NOT(ISBLANK([@r])))
VAR _gp = FILTER(_g, NOT(ISBLANK([@p])))
VAR _grc = MAXX(_gr, Calendario[indice])
VAR _gvc = MAXX(FILTER(_gr, Calendario[indice] = _grc), [@r])
VAR _gf = ADDCOLUMNS(FILTER(_g, Calendario[indice] = _grc || (Calendario[indice] > _grc && NOT(ISBLANK([@f])))), "@v", IF(Calendario[indice] = _grc, _gvc, [@f]))
VAR _gall = FILTER(UNION(SELECTCOLUMNS(_gr, "v", [@r]), SELECTCOLUMNS(_gp, "v", [@p]), SELECTCOLUMNS(_gf, "v", [@v])), NOT(ISBLANK([v])))
VAR _gmn = MINX(_gall, [v])
VAR _gmx = MAXX(_gall, [v])
VAR _grg = IF(_gmx - _gmn = 0, 1, _gmx - _gmn)
VAR _ptsR = CONCATENATEX(_gr, FORMAT(14 + (Calendario[indice] - _gi0) * 221 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@r] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsP = CONCATENATEX(_gp, FORMAT(14 + (Calendario[indice] - _gi0) * 221 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@p] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsF = IF(COUNTROWS(_gf) > 1, CONCATENATEX(_gf, FORMAT(14 + (Calendario[indice] - _gi0) * 221 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@v] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC), "")
VAR _di = IF(_hsel <= _grc, _hsel, _grc)
VAR _dv = MAXX(FILTER(_gr, Calendario[indice] = _di), [@r])
VAR _cx = FORMAT(14 + (_di - _gi0) * 221 / 11, "0.0", "en-US")
VAR _cy = FORMAT(141 - (_dv - _gmn) / _grg * 27, "0.0", "en-US")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 249 150' width='249' height='150'><rect x='0.5' y='0.5' width='248' height='149' rx='8' fill='#FFFFFF' stroke='#E1E5EA'/><path d='M0.5 8.5 Q0.5 0.5 8.5 0.5 H240.5 Q248.5 0.5 248.5 8.5 V3.5 H0.5 Z' fill='#13294B'/><text x='14' y='26' font-family='Segoe UI' font-size='11.5' font-weight='600' fill='#3F4B58'>Deuda asignada</text><rect x='" & _stX & "' y='13' width='" & _stWW & "' height='17' rx='8.5' fill='" & _stF & "'/><text x='" & _stTX & "' y='25' text-anchor='middle' font-family='Segoe UI' font-size='9.5' font-weight='600' fill='" & _stK & "'>" & _stT & "</text><text x='14' y='57' font-family='Segoe UI' font-size='25' font-weight='700' fill='#111A24'>" & _val & "</text><text x='14' y='77' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs presupuesto</text><text x='235' y='77' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k0 & "'>" & _t0 & "</text><text x='14' y='91' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs mes anterior</text><text x='235' y='91' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k1 & "'>" & _t1 & "</text><text x='14' y='105' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs año anterior</text><text x='235' y='105' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k2 & "'>" & _t2 & "</text><line x1='14' y1='141' x2='235' y2='141' stroke='#E1E5EA' stroke-width='1'/><polyline points='" & _ptsP & "' fill='none' stroke='#98A2AE' stroke-width='1.3' stroke-dasharray='3 2.5'/><polyline points='" & _ptsF & "' fill='none' stroke='#EB6834' stroke-width='1.5' stroke-dasharray='4 2.5'/><polyline points='" & _ptsR & "' fill='none' stroke='#13294B' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/><circle cx='" & _cx & "' cy='" & _cy & "' r='3.2' fill='#FFFFFF' stroke='#13294B' stroke-width='2'/></svg>"
```
 · Categoría: URL de imagen

### SVG · tarjeta Posiciones
Tarjeta de posiciones para la página Drivers.

```dax
SVG · tarjeta Posiciones =
VAR _v = [Posiciones promedio · real]
VAR _c0 = [Posiciones promedio · real]
VAR _r0 = [Posiciones promedio · presupuesto]
VAR _d0 = _c0 - _r0
VAR _t0 = IF(ISBLANK(_r0) || ISBLANK(_c0), "—", SUBSTITUTE(FORMAT(_d0, "+#,##0;-#,##0;0", "es-AR"), "-", "−"))
VAR _k0 = "#3F4B58"
VAR _c1 = [Posiciones promedio · real]
VAR _r1 = [Posiciones promedio · mes anterior]
VAR _d1 = _c1 - _r1
VAR _t1 = IF(ISBLANK(_r1) || ISBLANK(_c1), "—", SUBSTITUTE(FORMAT(_d1, "+#,##0;-#,##0;0", "es-AR"), "-", "−"))
VAR _k1 = "#3F4B58"
VAR _c2 = [Posiciones promedio · real]
VAR _r2 = [Posiciones promedio · año anterior]
VAR _d2 = _c2 - _r2
VAR _t2 = IF(ISBLANK(_r2) || ISBLANK(_c2), "—", SUBSTITUTE(FORMAT(_d2, "+#,##0;-#,##0;0", "es-AR"), "-", "−"))
VAR _k2 = "#3F4B58"
VAR _st = 0
VAR _stT = SWITCH(_st, 1, "En línea", 2, "Atención", 3, "Desvío", "")
VAR _stF = SWITCH(_st, 1, "#E3F3E6", 2, "#FCEFD2", 3, "#FDE8E7", "#FFFFFF")
VAR _stK = SWITCH(_st, 1, "#16703F", 2, "#8A5A00", 3, "#B42318", "#FFFFFF")
VAR _stW = LEN(_stT) * 5.4 + 16
VAR _stX = FORMAT(237 - _stW, "0.0", "en-US")
VAR _stTX = FORMAT(237 - _stW / 2, "0.0", "en-US")
VAR _stWW = FORMAT(_stW, "0.0", "en-US")
VAR _val = IF(ISBLANK(_v), "—", IF(_v = INT(_v), FORMAT(_v, "#,##0", "es-AR"), FORMAT(_v, "#,##0.0", "es-AR")))
VAR _corte = [Índice de corte]
VAR _hsel = [Índice hasta]
VAR _anio = [Año de análisis]
VAR _g0 = ADDCOLUMNS(FILTER(ALL(Calendario[indice], Calendario[anio]), Calendario[anio] = _anio), "@r0", [Posiciones (mes) · real], "@p0", [Posiciones (mes) · presupuesto], "@f0", [Posiciones (mes) · forecast])
VAR _g = ADDCOLUMNS(_g0, "@r", IF(Calendario[indice] <= _corte, [@r0]), "@p", [@p0], "@f", IF(Calendario[indice] > _corte, [@f0]))
VAR _gi0 = MINX(_g, Calendario[indice])
VAR _gr = FILTER(_g, NOT(ISBLANK([@r])))
VAR _gp = FILTER(_g, NOT(ISBLANK([@p])))
VAR _grc = MAXX(_gr, Calendario[indice])
VAR _gvc = MAXX(FILTER(_gr, Calendario[indice] = _grc), [@r])
VAR _gf = ADDCOLUMNS(FILTER(_g, Calendario[indice] = _grc || (Calendario[indice] > _grc && NOT(ISBLANK([@f])))), "@v", IF(Calendario[indice] = _grc, _gvc, [@f]))
VAR _gall = FILTER(UNION(SELECTCOLUMNS(_gr, "v", [@r]), SELECTCOLUMNS(_gp, "v", [@p]), SELECTCOLUMNS(_gf, "v", [@v])), NOT(ISBLANK([v])))
VAR _gmn = MINX(_gall, [v])
VAR _gmx = MAXX(_gall, [v])
VAR _grg = IF(_gmx - _gmn = 0, 1, _gmx - _gmn)
VAR _ptsR = CONCATENATEX(_gr, FORMAT(14 + (Calendario[indice] - _gi0) * 221 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@r] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsP = CONCATENATEX(_gp, FORMAT(14 + (Calendario[indice] - _gi0) * 221 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@p] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC)
VAR _ptsF = IF(COUNTROWS(_gf) > 1, CONCATENATEX(_gf, FORMAT(14 + (Calendario[indice] - _gi0) * 221 / 11, "0.0", "en-US") & "," & FORMAT(141 - ([@v] - _gmn) / _grg * 27, "0.0", "en-US"), " ", Calendario[indice], ASC), "")
VAR _di = IF(_hsel <= _grc, _hsel, _grc)
VAR _dv = MAXX(FILTER(_gr, Calendario[indice] = _di), [@r])
VAR _cx = FORMAT(14 + (_di - _gi0) * 221 / 11, "0.0", "en-US")
VAR _cy = FORMAT(141 - (_dv - _gmn) / _grg * 27, "0.0", "en-US")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 249 150' width='249' height='150'><rect x='0.5' y='0.5' width='248' height='149' rx='8' fill='#FFFFFF' stroke='#E1E5EA'/><path d='M0.5 8.5 Q0.5 0.5 8.5 0.5 H240.5 Q248.5 0.5 248.5 8.5 V3.5 H0.5 Z' fill='#13294B'/><text x='14' y='26' font-family='Segoe UI' font-size='11.5' font-weight='600' fill='#3F4B58'>Posiciones</text><rect x='" & _stX & "' y='13' width='" & _stWW & "' height='17' rx='8.5' fill='" & _stF & "'/><text x='" & _stTX & "' y='25' text-anchor='middle' font-family='Segoe UI' font-size='9.5' font-weight='600' fill='" & _stK & "'>" & _stT & "</text><text x='14' y='57' font-family='Segoe UI' font-size='25' font-weight='700' fill='#111A24'>" & _val & "</text><text x='14' y='77' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs presupuesto</text><text x='235' y='77' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k0 & "'>" & _t0 & "</text><text x='14' y='91' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs mes anterior</text><text x='235' y='91' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k1 & "'>" & _t1 & "</text><text x='14' y='105' font-family='Segoe UI' font-size='10.5' fill='#6B7682'>vs año anterior</text><text x='235' y='105' text-anchor='end' font-family='Segoe UI' font-size='10.5' font-weight='600' fill='" & _k2 & "'>" & _t2 & "</text><line x1='14' y1='141' x2='235' y2='141' stroke='#E1E5EA' stroke-width='1'/><polyline points='" & _ptsP & "' fill='none' stroke='#98A2AE' stroke-width='1.3' stroke-dasharray='3 2.5'/><polyline points='" & _ptsF & "' fill='none' stroke='#EB6834' stroke-width='1.5' stroke-dasharray='4 2.5'/><polyline points='" & _ptsR & "' fill='none' stroke='#13294B' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/><circle cx='" & _cx & "' cy='" & _cy & "' r='3.2' fill='#FFFFFF' stroke='#13294B' stroke-width='2'/></svg>"
```
 · Categoría: URL de imagen

### SVG · lo que hay que saber
Narrativa automática del período: ingresos, margen, carteras más lejos y por encima del presupuesto y cierre proyectado.

```dax
SVG · lo que hay que saber =
VAR _ing = [Ingresos · real]
VAR _ip = [Ingresos · presupuesto]
VAR _if = [Ingresos · forecast]
VAR _iaa = [Ingresos · año anterior]
VAR _mo = [Margen operativo % · real]
VAR _mop = [Margen operativo % · presupuesto]
VAR _un = [Utilidad neta · real]
VAR _unp = [Utilidad neta · presupuesto]
VAR _ci = [Cierre proyectado]
VAR _pa = [Presupuesto anual]
VAR _tab = ADDCOLUMNS(FILTER(VALUES(Cartera[code]), Cartera[code] <> "EST"), "@d", [Ingresos · real] - [Ingresos · presupuesto])
VAR _neg = TOPN(3, FILTER(_tab, [@d] < 0), [@d], ASC)
VAR _pos = TOPN(2, FILTER(_tab, [@d] > 0), [@d], DESC)
VAR _negT = IF(COUNTROWS(_neg) = 0, "ninguna", CONCATENATEX(_neg, Cartera[code] & " " & IF([@d] < 0, "−", "+") & "$ " & FORMAT(ABS([@d]) / 1000000, "#,##0.0", "es-AR") & " M", ", ", [@d], ASC))
VAR _posT = IF(COUNTROWS(_pos) = 0, "ninguna", CONCATENATEX(_pos, Cartera[code] & " " & IF([@d] < 0, "−", "+") & "$ " & FORMAT(ABS([@d]) / 1000000, "#,##0.0", "es-AR") & " M", ", ", [@d], DESC))
VAR _l1a = "$ " & FORMAT(_ing / 1000000, "#,##0.0", "es-AR") & " M"
VAR _l1b = SUBSTITUTE(FORMAT(DIVIDE(_ing - _ip, _ip), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−")
VAR _l1c = SUBSTITUTE(FORMAT(DIVIDE(_ing - _if, _if), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−")
VAR _l1d = IF(ISBLANK(_iaa), "—", SUBSTITUTE(FORMAT(DIVIDE(_ing - _iaa, _iaa), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−"))
VAR _l2a = SUBSTITUTE(FORMAT(_mo, "0.0%", "es-AR"), "-", "−")
VAR _l2b = SUBSTITUTE(FORMAT((_mo - _mop) * 100, "+0.0;-0.0;0.0", "es-AR"), "-", "−") & " pp"
VAR _l2c = "$ " & FORMAT(_un / 1000000, "#,##0.0", "es-AR") & " M"
VAR _l2d = IF(_un - _unp < 0, "−", "+") & "$ " & FORMAT(ABS(_un - _unp) / 1000000, "#,##0.0", "es-AR") & " M"
VAR _l5a = "$ " & FORMAT(_ci / 1000000, "#,##0.0", "es-AR") & " M"
VAR _l5b = SUBSTITUTE(FORMAT(DIVIDE(_ci - _pa, ABS(_pa)), "+0.0%;-0.0%;0.0%", "es-AR"), "-", "−")
VAR _k1 = IF(_ing >= _ip, "#16703F", "#B42318")
VAR _k2 = IF(_mo >= _mop, "#16703F", "#B42318")
VAR _k5 = IF(_ci >= _pa, "#16703F", "#B42318")
RETURN
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 760 178' width='760' height='178'><rect x='0.5' y='0.5' width='759' height='177' rx='8' fill='#FFFFFF' stroke='#E1E5EA'/><rect x='0.5' y='8' width='3.5' height='162' fill='#C8102E'/><text x='18' y='26' font-family='Segoe UI' font-size='12.5' font-weight='700' fill='#13294B'>Lo que hay que saber</text><circle cx='22' cy='50' r='3.5' fill='" & _k1 & "'/><text x='34' y='54' font-family='Segoe UI' font-size='12.5' fill='#111A24'>Ingresos <tspan font-weight='700'>" & _l1a & "</tspan>: <tspan font-weight='700' fill='" & _k1 & "'>" & _l1b & "</tspan> contra presupuesto, " & _l1c & " contra forecast y " & _l1d & " contra el año anterior.</text><circle cx='22' cy='75' r='3.5' fill='" & _k2 & "'/><text x='34' y='79' font-family='Segoe UI' font-size='12.5' fill='#111A24'>Margen operativo <tspan font-weight='700'>" & _l2a & "</tspan> (<tspan font-weight='700' fill='" & _k2 & "'>" & _l2b & "</tspan> contra presupuesto); utilidad neta <tspan font-weight='700'>" & _l2c & "</tspan> (" & _l2d & ").</text><circle cx='22' cy='100' r='3.5' fill='#B42318'/><text x='34' y='104' font-family='Segoe UI' font-size='12.5' fill='#111A24'>Carteras más lejos del presupuesto: <tspan font-weight='700'>" & _negT & "</tspan>.</text><circle cx='22' cy='125' r='3.5' fill='#16703F'/><text x='34' y='129' font-family='Segoe UI' font-size='12.5' fill='#111A24'>Carteras por encima del presupuesto: <tspan font-weight='700'>" & _posT & "</tspan>.</text><circle cx='22' cy='150' r='3.5' fill='" & _k5 & "'/><text x='34' y='154' font-family='Segoe UI' font-size='12.5' fill='#111A24'>Cierre proyectado del año (real + forecast): utilidad <tspan font-weight='700'>" & _l5a & "</tspan>, <tspan font-weight='700' fill='" & _k5 & "'>" & _l5b & "</tspan> contra el presupuesto anual.</text></svg>"
```
 · Categoría: URL de imagen

### SVG · ingresos real vs presupuesto
Bala para la tabla de carteras: barra real sobre la franja del presupuesto.

```dax
SVG · ingresos real vs presupuesto =
VAR _a = [Ingresos · real]
VAR _p = [Ingresos · presupuesto]
VAR _mx = MAXX(ALLSELECTED(Cartera[Cartera]), MAX([Ingresos · real], [Ingresos · presupuesto])) * 1.05
VAR _wa = FORMAT(MAX(0, DIVIDE(_a, _mx)) * 146, "0.0", "en-US")
VAR _wp = FORMAT(MAX(0, DIVIDE(_p, _mx)) * 146, "0.0", "en-US")
VAR _xp = FORMAT(MAX(0, DIVIDE(_p, _mx)) * 146 + 1, "0.0", "en-US")
VAR _k = IF(_a >= _p, "#13294B", "#B42318")
VAR _sort = FORMAT(_a, "000000000000")
RETURN
    IF(HASONEVALUE(Cartera[Cartera]) && NOT(ISBLANK(_a)), "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 22' width='150' height='22'><desc>" & _sort & "</desc><rect x='1' y='5' width='" & _wp & "' height='12' fill='#DDE2E8'/><rect x='1' y='8' width='" & _wa & "' height='6' fill='" & _k & "'/><rect x='" & _xp & "' y='3' width='2' height='16' fill='#111A24'/></svg>")
```
 · Categoría: URL de imagen

### SVG · margen bruto
Píldora de margen de contribución con semáforo.

```dax
SVG · margen bruto =
VAR _m = [Margen bruto % · real]
VAR _k = IF(_m >= 0.25, 1, IF(_m >= 0.10, 2, 3))
VAR _f = SWITCH(_k, 1, "#E3F3E6", 2, "#FCEFD2", "#FDE8E7")
VAR _c = SWITCH(_k, 1, "#16703F", 2, "#8A5A00", "#B42318")
VAR _t = SUBSTITUTE(FORMAT(_m, "0.0%", "es-AR"), "-", "−")
VAR _sort = FORMAT(_m * 1000 + 100000, "000000000")
RETURN
    IF(HASONEVALUE(Cartera[Cartera]) && NOT(ISBLANK(_m)), "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 20' width='64' height='20'><desc>" & _sort & "</desc><rect x='1' y='2' width='62' height='16' rx='8.0' fill='" & _f & "'/><text x='32.0' y='14.0' text-anchor='middle' font-family='Segoe UI' font-size='10.5' font-weight='700' fill='" & _c & "'>" & _t & "</text></svg>")
```
 · Categoría: URL de imagen
