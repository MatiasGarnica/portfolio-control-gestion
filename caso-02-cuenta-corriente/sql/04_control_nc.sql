/* =====================================================================================
   Caso 02 · 04 Control de notas de crédito (SQL Server)
   Parte 1 · NC fuera de lo normal: supera el piso y es más de {veces} la facturación mensual habitual
             del cliente (promedio de los 6 meses anteriores). Trae la primera revisión de administración
             dentro de las 3 semanas siguientes.
   Parte 2 · Patrón por reparto: NC + incobrables sobre la venta de los últimos 3 meses cerrados,
             contra la mediana de los repartos.
   ===================================================================================== */

/* ---------- Parte 1 · casos ---------- */
WITH par AS (
    SELECT CAST('2025-04-01' AS DATE) AS desde,
           50000 AS piso,
           2.0   AS veces
),
alcance AS (
    SELECT c.id_cliente
    FROM dim_cliente c
    JOIN dim_reparto r ON r.id_reparto = c.id_reparto
    WHERE c.cuenta_interna = 0 AND r.tipo_reparto = 'Comercial'
),
nc AS (
    SELECT m.fecha, m.id_cliente, m.id_reparto, m.importe, m.motivo,
           (SELECT ROUND(COALESCE(SUM(v.importe), 0) / 6.0, 0)
              FROM fact_venta v
             WHERE v.id_cliente = m.id_cliente
               AND v.fecha >  DATEADD(day, -181, m.fecha)
               AND v.fecha <= DATEADD(day, -1, m.fecha)) AS facturacion_mensual
    FROM fact_movimiento m
    JOIN alcance a ON a.id_cliente = m.id_cliente
    CROSS JOIN par p
    WHERE m.tipo = 'Nota de crédito' AND m.fecha >= p.desde
),
revision AS (
    SELECT n.fecha, n.id_cliente, g.fecha AS fecha_revision, g.resultado,
           ROW_NUMBER() OVER (PARTITION BY n.fecha, n.id_cliente ORDER BY g.fecha) AS orden
    FROM nc n
    JOIN fact_gestion g ON g.id_cliente = n.id_cliente
                       AND g.tipo = 'Revisión de nota de crédito'
                       AND g.fecha >= n.fecha AND g.fecha <= DATEADD(day, 21, n.fecha)
)
SELECT n.fecha, n.id_cliente, n.id_reparto, s.supervisor, n.importe, n.facturacion_mensual,
       CASE WHEN n.facturacion_mensual > 0 THEN n.importe / n.facturacion_mensual END AS veces,
       n.motivo,
       COALESCE(r.resultado, 'Sin revisar') AS revision,
       r.fecha_revision
FROM nc n
CROSS JOIN par p
JOIN dim_reparto rp   ON rp.id_reparto = n.id_reparto
JOIN dim_supervisor s ON s.id_supervisor = rp.id_supervisor
LEFT JOIN revision r  ON r.fecha = n.fecha AND r.id_cliente = n.id_cliente AND r.orden = 1
WHERE n.importe >= p.piso
  AND (n.facturacion_mensual <= 0 OR n.importe > p.veces * n.facturacion_mensual)
ORDER BY n.fecha DESC, n.importe DESC;

/* ---------- Parte 2 · patrón por reparto ---------- */
WITH par AS (
    SELECT CAST('2025-07-01' AS DATE) AS desde,          -- últimos 3 meses cerrados: jul, ago y sep
           CAST('2025-09-30' AS DATE) AS hasta,
           0.04 AS minimo,                               -- más del 4% de la venta…
           3.0  AS veces_mediana                         -- …y más del triple de la mediana de los repartos
),
alcance AS (
    SELECT c.id_cliente
    FROM dim_cliente c
    JOIN dim_reparto r ON r.id_reparto = c.id_reparto
    WHERE c.cuenta_interna = 0 AND r.tipo_reparto = 'Comercial'
),
por_reparto AS (
    SELECT r.id_reparto,
           (SELECT COALESCE(SUM(v.importe), 0) FROM fact_venta v JOIN alcance a ON a.id_cliente = v.id_cliente
             WHERE v.id_reparto = r.id_reparto AND v.fecha >= p.desde AND v.fecha <= p.hasta) AS venta,
           (SELECT COALESCE(SUM(m.importe), 0) FROM fact_movimiento m JOIN alcance a ON a.id_cliente = m.id_cliente
             WHERE m.id_reparto = r.id_reparto AND m.tipo IN ('Nota de crédito', 'Incobrable')
               AND m.fecha >= p.desde AND m.fecha <= p.hasta) AS ajustes
    FROM dim_reparto r CROSS JOIN par p
    WHERE r.tipo_reparto = 'Comercial'
),
ratio AS (
    SELECT id_reparto, venta, ajustes, CASE WHEN venta > 0 THEN ajustes / venta ELSE 0 END AS pct,
           ROW_NUMBER() OVER (ORDER BY CASE WHEN venta > 0 THEN ajustes / venta ELSE 0 END) AS rn,
           COUNT(*) OVER () AS n
    FROM por_reparto
),
mediana AS (                    -- la mediana de arriba (como en el tablero, con cantidad par toma la de arriba)
    SELECT pct AS mediana FROM ratio WHERE rn = FLOOR(n / 2.0) + 1
)
SELECT r.id_reparto, s.supervisor, r.venta, r.ajustes, r.pct, md.mediana,
       CASE WHEN r.pct > CASE WHEN p.minimo > p.veces_mediana * md.mediana THEN p.minimo ELSE p.veces_mediana * md.mediana END
            THEN 'Patrón' ELSE 'Normal' END AS estado
FROM ratio r
CROSS JOIN mediana md
CROSS JOIN par p
JOIN dim_reparto rp   ON rp.id_reparto = r.id_reparto
JOIN dim_supervisor s ON s.id_supervisor = rp.id_supervisor
ORDER BY r.pct DESC;
