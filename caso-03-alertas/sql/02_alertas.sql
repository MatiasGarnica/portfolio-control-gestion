/* =====================================================================================
   Caso 03 · 02 Alertas (SQL Server)
   Siete consultas, una por regla. Misma lógica que 02_codigo/alertas.py y que el tablero.
   En producción corren todos los días a las 6:00 (Programador de tareas) y dejan el resultado en una
   tabla de alertas; acá cada una tiene sus parámetros en la CTE «par».
   Todas devuelven: regla, clave, id_cliente, id_reparto, fecha (cuándo se disparó) e impacto en $.
   ===================================================================================== */

/* ---------- A1 · Equipo instalado sin abono ----------
   Equipo con abono mensual, instalado hace más de {tol} días, al que le falta el abono del último mes.
   Impacto: abono × meses sin facturar desde enero. */
WITH par AS (SELECT CAST('2025-10-09' AS DATE) AS corte, 45 AS tol),
activos AS (
    SELECT i.id_equipo, i.id_cliente, i.fecha AS instalacion, eq.abono_mensual
    FROM fact_equipo i
    JOIN dim_equipo eq ON eq.id_equipo = i.id_equipo
    CROSS JOIN par p
    WHERE i.tipo = 'Instalación' AND eq.modalidad = 'Abono mensual' AND i.fecha <= p.corte
      AND NOT EXISTS (SELECT 1 FROM fact_equipo r WHERE r.id_equipo = i.id_equipo AND r.tipo = 'Retiro' AND r.fecha <= p.corte)
),
esperados AS (                  -- el 1° de cada mes posterior a la instalación (desde enero de 2025)
    SELECT a.id_equipo, k.fecha AS mes,
           CASE WHEN EXISTS (SELECT 1 FROM fact_abono f WHERE f.id_equipo = a.id_equipo
                             AND f.fecha >= k.fecha AND f.fecha < DATEADD(month, 1, k.fecha)) THEN 1 ELSE 0 END AS facturado
    FROM activos a
    CROSS JOIN par p
    JOIN dim_calendario k ON DAY(k.fecha) = 1 AND k.fecha > a.instalacion
                         AND k.fecha >= CAST('2025-01-01' AS DATE) AND k.fecha <= p.corte
),
resumen AS (
    SELECT id_equipo,
           MAX(mes)                                         AS ultimo_esperado,
           MIN(mes)                                         AS primer_esperado,
           MAX(CASE WHEN facturado = 1 THEN mes END)        AS ultimo_facturado,
           SUM(1 - facturado)                               AS meses_sin
    FROM esperados
    GROUP BY id_equipo
)
SELECT 'equipo_sin_abono' AS regla, a.id_equipo AS clave, a.id_cliente, CAST(NULL AS VARCHAR(6)) AS id_reparto,
       CASE WHEN DATEADD(day, p.tol, a.instalacion) > COALESCE(DATEADD(month, 1, r.ultimo_facturado), r.primer_esperado)
            THEN DATEADD(day, p.tol, a.instalacion)
            ELSE COALESCE(DATEADD(month, 1, r.ultimo_facturado), r.primer_esperado) END AS fecha,
       r.meses_sin * a.abono_mensual AS impacto
FROM activos a
JOIN resumen r ON r.id_equipo = a.id_equipo
CROSS JOIN par p
WHERE (r.ultimo_facturado IS NULL OR r.ultimo_facturado < r.ultimo_esperado)
  AND a.instalacion <= DATEADD(day, -p.tol, p.corte);

/* ---------- A2 · Equipo sin consumo ----------
   Equipo en comodato por consumo instalado hace más de {antig} días, en un cliente que no compra con cargo hace más de {dias}.
   Impacto: valor de reposición del equipo. */
WITH par AS (SELECT CAST('2025-10-09' AS DATE) AS corte, 45 AS dias, 60 AS antig),
activos AS (
    SELECT i.id_equipo, i.id_cliente, i.fecha AS instalacion, eq.valor_reposicion
    FROM fact_equipo i
    JOIN dim_equipo eq ON eq.id_equipo = i.id_equipo
    CROSS JOIN par p
    WHERE i.tipo = 'Instalación' AND eq.modalidad = 'Comodato por consumo' AND i.fecha <= p.corte
      AND NOT EXISTS (SELECT 1 FROM fact_equipo r WHERE r.id_equipo = i.id_equipo AND r.tipo = 'Retiro' AND r.fecha <= p.corte)
),
base AS (
    SELECT a.*,
           (SELECT MAX(v.fecha) FROM fact_venta v WHERE v.id_cliente = a.id_cliente AND v.importe > 0) AS ult_compra
    FROM activos a
),
calc AS (
    SELECT b.*, CASE WHEN b.ult_compra >= b.instalacion THEN b.ult_compra ELSE b.instalacion END AS desde
    FROM base b
)
SELECT 'equipo_sin_consumo' AS regla, c.id_equipo AS clave, c.id_cliente, CAST(NULL AS VARCHAR(6)) AS id_reparto,
       DATEADD(day, p.dias + 1, c.desde) AS fecha, c.valor_reposicion AS impacto
FROM calc c
CROSS JOIN par p
WHERE DATEDIFF(day, c.desde, p.corte) > p.dias
  AND c.instalacion <= DATEADD(day, -p.antig, p.corte);

/* ---------- A3 · Pasa a recibir solo sin cargo ----------
   En los últimos {ventana} días tuvo al menos {minimo} entregas y todas fueron sin cargo, y en los {hist} días
   anteriores compraba con cargo (al menos {hist_min} entregas). Impacto: su entrega promedio × entregas sin cargo. */
WITH par AS (SELECT CAST('2025-10-09' AS DATE) AS corte, 28 AS ventana, 2 AS minimo, 84 AS hist, 4 AS hist_min),
alcance AS (SELECT id_cliente FROM dim_cliente WHERE cuenta_interna = 0),
ventana AS (
    SELECT v.id_cliente, v.fecha, v.importe, v.unidades_sin_cargo,
           ROW_NUMBER() OVER (PARTITION BY v.id_cliente ORDER BY v.fecha) AS orden
    FROM fact_venta v
    JOIN alcance a ON a.id_cliente = v.id_cliente
    CROSS JOIN par p
    WHERE v.fecha > DATEADD(day, -p.ventana, p.corte) AND v.fecha <= p.corte
),
w AS (
    SELECT id_cliente, COUNT(*) AS entregas, SUM(importe) AS importe, SUM(unidades_sin_cargo) AS sin_cargo
    FROM ventana GROUP BY id_cliente
),
h AS (
    SELECT v.id_cliente, COUNT(*) AS entregas, ROUND(AVG(1.0 * v.importe), 0) AS promedio
    FROM fact_venta v
    CROSS JOIN par p
    WHERE v.importe > 0
      AND v.fecha >  DATEADD(day, -(p.ventana + p.hist), p.corte)
      AND v.fecha <= DATEADD(day, -p.ventana, p.corte)
    GROUP BY v.id_cliente
)
SELECT 'solo_sin_cargo' AS regla, CAST(w.id_cliente AS VARCHAR(12)) AS clave, w.id_cliente, CAST(NULL AS VARCHAR(6)) AS id_reparto,
       x.fecha, h.promedio * w.entregas AS impacto
FROM w
JOIN h ON h.id_cliente = w.id_cliente
CROSS JOIN par p
JOIN ventana x ON x.id_cliente = w.id_cliente AND x.orden = p.minimo
WHERE w.entregas >= p.minimo AND w.importe = 0 AND w.sin_cargo > 0 AND h.entregas >= p.hist_min;

/* ---------- A4 · Incobrables concentrados ----------
   Por reparto, en los últimos {ventana} días: al menos {minimo} incobrables y más de {veces} veces la mediana de los
   repartos (incobrables sobre venta), o {sigue} o más incobrables a clientes que siguieron comprando después. */
WITH par AS (SELECT CAST('2025-10-09' AS DATE) AS corte, 180 AS ventana, 3 AS minimo, 4.0 AS veces, 2 AS sigue),
alcance AS (SELECT id_cliente FROM dim_cliente WHERE cuenta_interna = 0),
comerciales AS (SELECT id_reparto FROM dim_reparto WHERE tipo_reparto = 'Comercial'),
inc AS (
    SELECT m.fecha, m.id_cliente, m.id_reparto, m.importe,
           CASE WHEN EXISTS (SELECT 1 FROM fact_venta v WHERE v.id_cliente = m.id_cliente AND v.importe > 0 AND v.fecha > m.fecha)
                THEN 1 ELSE 0 END AS sigue_comprando
    FROM fact_movimiento m
    JOIN alcance a ON a.id_cliente = m.id_cliente
    JOIN comerciales c ON c.id_reparto = m.id_reparto
    CROSS JOIN par p
    WHERE m.tipo = 'Incobrable' AND m.fecha > DATEADD(day, -p.ventana, p.corte) AND m.fecha <= p.corte
),
inc_n AS (
    SELECT i.*,
           ROW_NUMBER() OVER (PARTITION BY i.id_reparto ORDER BY i.fecha) AS orden,
           SUM(i.sigue_comprando) OVER (PARTITION BY i.id_reparto ORDER BY i.fecha ROWS UNBOUNDED PRECEDING) AS sigue_acum
    FROM inc i
),
venta AS (
    SELECT c.id_reparto,
           (SELECT COALESCE(SUM(v.importe), 0) FROM fact_venta v JOIN alcance a ON a.id_cliente = v.id_cliente
             WHERE v.id_reparto = c.id_reparto AND v.fecha > DATEADD(day, -p.ventana, p.corte) AND v.fecha <= p.corte) AS venta
    FROM comerciales c CROSS JOIN par p
),
por AS (
    SELECT v.id_reparto, v.venta,
           COUNT(i.fecha) AS cantidad, COALESCE(SUM(i.importe), 0) AS importe, COALESCE(SUM(i.sigue_comprando), 0) AS siguen,
           CASE WHEN v.venta > 0 THEN COALESCE(SUM(i.importe), 0) / v.venta ELSE 0 END AS ratio
    FROM venta v LEFT JOIN inc i ON i.id_reparto = v.id_reparto
    GROUP BY v.id_reparto, v.venta
),
orden AS (
    SELECT ratio, ROW_NUMBER() OVER (ORDER BY ratio) AS rn, COUNT(*) OVER () AS n FROM por
),
mediana AS (SELECT ratio AS mediana FROM orden WHERE rn = FLOOR(n / 2.0) + 1),
marca AS (
    SELECT r.*,
           CASE WHEN r.cantidad >= p.minimo AND r.ratio > p.veces * md.mediana THEN 1 ELSE 0 END AS concentra,
           CASE WHEN r.siguen >= p.sigue THEN 1 ELSE 0 END AS siguen_comprando
    FROM por r CROSS JOIN mediana md CROSS JOIN par p
)
SELECT 'incobrables' AS regla, m.id_reparto AS clave, 0 AS id_cliente, m.id_reparto,
       CASE WHEN m.concentra = 1 AND (m.siguen_comprando = 0 OR f1.fecha <= f2.fecha) THEN f1.fecha ELSE f2.fecha END AS fecha,
       m.importe AS impacto
FROM marca m
CROSS JOIN par p
LEFT JOIN inc_n f1 ON f1.id_reparto = m.id_reparto AND f1.orden = p.minimo
LEFT JOIN (SELECT id_reparto, MIN(fecha) AS fecha FROM inc_n i CROSS JOIN par p2
           WHERE i.sigue_comprando = 1 AND i.sigue_acum = p2.sigue GROUP BY id_reparto) f2 ON f2.id_reparto = m.id_reparto
WHERE m.concentra = 1 OR m.siguen_comprando = 1;

/* ---------- A5 · Cobro en efectivo sin visita ----------
   Pagos en efectivo cargados por el reparto en un día en que no visitó a ese cliente. Alerta por reparto con
   {minimo} casos o más en los últimos {ventana} días. El efectivo pagado en la sucursal no cuenta. */
WITH par AS (SELECT CAST('2025-10-09' AS DATE) AS corte, 60 AS ventana, 3 AS minimo),
casos AS (
    SELECT p.fecha, p.id_cliente, p.id_reparto, p.importe,
           ROW_NUMBER() OVER (PARTITION BY p.id_reparto ORDER BY p.fecha) AS orden
    FROM fact_pago p
    JOIN dim_cliente c ON c.id_cliente = p.id_cliente AND c.cuenta_interna = 0
    CROSS JOIN par x
    WHERE p.canal = 'Reparto' AND p.fecha > DATEADD(day, -x.ventana, x.corte) AND p.fecha <= x.corte
      AND NOT EXISTS (SELECT 1 FROM fact_visita v WHERE v.id_cliente = p.id_cliente AND v.fecha = p.fecha AND v.visito = 1)
)
SELECT 'cobro_sin_visita' AS regla, c.id_reparto AS clave, 0 AS id_cliente, c.id_reparto,
       MIN(CASE WHEN c.orden = x.minimo THEN c.fecha END) AS fecha, SUM(c.importe) AS impacto
FROM casos c
CROSS JOIN par x
GROUP BY c.id_reparto, x.minimo
HAVING COUNT(*) >= x.minimo;

/* ---------- A6 · Nota de crédito fuera de patrón ----------
   Igual que el control del Caso 02: supera el piso y es más de {veces} la facturación mensual habitual del cliente. */
WITH par AS (SELECT CAST('2025-10-09' AS DATE) AS corte, 90 AS ventana, 50000 AS piso, 2.0 AS veces),
nc AS (
    SELECT m.fecha, m.id_cliente, m.importe,
           (SELECT ROUND(COALESCE(SUM(v.importe), 0) / 6.0, 0) FROM fact_venta v
             WHERE v.id_cliente = m.id_cliente AND v.fecha > DATEADD(day, -181, m.fecha) AND v.fecha <= DATEADD(day, -1, m.fecha)) AS fac6
    FROM fact_movimiento m
    JOIN dim_cliente c ON c.id_cliente = m.id_cliente AND c.cuenta_interna = 0
    CROSS JOIN par p
    WHERE m.tipo = 'Nota de crédito' AND m.fecha > DATEADD(day, -p.ventana, p.corte) AND m.fecha <= p.corte
)
SELECT 'nc_fuera_patron' AS regla, CONCAT(CAST(n.id_cliente AS VARCHAR(12)), '|', FORMAT(n.fecha, 'yyyy-MM-dd')) AS clave,
       n.id_cliente, CAST(NULL AS VARCHAR(6)) AS id_reparto, n.fecha, n.importe AS impacto
FROM nc n
CROSS JOIN par p
WHERE n.importe >= p.piso AND (n.fac6 <= 0 OR n.importe > p.veces * n.fac6);

/* ---------- A7 · Cambio de ruta con deuda ----------
   Cliente pasado a un reparto que no vende (técnico o administración) con saldo de al menos {piso}:
   su deuda sale de la gestión de cobranza y de los días calle del reparto de origen. */
WITH par AS (SELECT 20000 AS piso),
movs AS (
    SELECT fecha, id_cliente, importe FROM fact_venta
    UNION ALL SELECT fecha, id_cliente, importe FROM fact_movimiento WHERE tipo IN ('Saldo inicial', 'Reversa de pago')
    UNION ALL SELECT fecha, id_cliente, -importe FROM fact_pago
    UNION ALL SELECT fecha, id_cliente, -importe FROM fact_movimiento WHERE tipo IN ('Nota de crédito', 'Incobrable')
),
cambios AS (
    SELECT c.*, r.tipo_reparto AS tipo_destino,
           (SELECT COALESCE(SUM(m.importe), 0) FROM movs m WHERE m.id_cliente = c.id_cliente AND m.fecha <= c.fecha) AS saldo
    FROM fact_cambio_reparto c
    JOIN dim_reparto r ON r.id_reparto = c.reparto_destino
)
SELECT 'cambio_ruta' AS regla, CAST(c.id_cliente AS VARCHAR(12)) AS clave, c.id_cliente, c.reparto_origen AS id_reparto,
       c.fecha, c.saldo AS impacto
FROM cambios c
CROSS JOIN par p
WHERE c.tipo_destino <> 'Comercial' AND c.saldo >= p.piso;
