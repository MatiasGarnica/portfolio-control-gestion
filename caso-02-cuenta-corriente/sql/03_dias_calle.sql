/* =====================================================================================
   Caso 02 · 03 Días calle y cobranza por reparto y mes (SQL Server)
   Días calle = deuda al cierre ÷ (venta del mes ÷ días de reparto de lunes a sábado).
   La deuda al cierre es el saldo positivo de cada cuenta al último día del mes (o al corte),
   sumado en el reparto del cliente. Solo cuentas en alcance (sin internas ni repartos no comerciales).
   ===================================================================================== */
WITH par AS (
    SELECT CAST('2025-10-09' AS DATE) AS corte
),
alcance AS (
    SELECT c.id_cliente, c.id_reparto
    FROM dim_cliente c
    JOIN dim_reparto r ON r.id_reparto = c.id_reparto
    WHERE c.cuenta_interna = 0 AND r.tipo_reparto = 'Comercial'
),
meses AS (                      -- un registro por mes con su fecha de cierre (o el corte) y sus días de reparto
    SELECT FORMAT(k.fecha, 'yyyy-MM') AS mes,
           MAX(k.fecha)               AS cierre,
           SUM(k.es_dia_reparto)      AS dias_reparto
    FROM dim_calendario k
    CROSS JOIN par p
    WHERE k.fecha >= CAST('2025-01-01' AS DATE) AND k.fecha <= p.corte
    GROUP BY FORMAT(k.fecha, 'yyyy-MM')
),
movs AS (                       -- débitos en positivo, créditos en negativo
    SELECT fecha, id_cliente, importe FROM fact_venta
    UNION ALL
    SELECT fecha, id_cliente, importe FROM fact_movimiento WHERE tipo IN ('Saldo inicial', 'Reversa de pago')
    UNION ALL
    SELECT fecha, id_cliente, -importe FROM fact_pago
    UNION ALL
    SELECT fecha, id_cliente, -importe FROM fact_movimiento WHERE tipo IN ('Nota de crédito', 'Incobrable')
),
saldo_cierre AS (
    SELECT m.mes, a.id_reparto, a.id_cliente, SUM(x.importe) AS saldo
    FROM meses m
    CROSS JOIN alcance a
    JOIN movs x ON x.id_cliente = a.id_cliente AND x.fecha <= m.cierre
    GROUP BY m.mes, a.id_reparto, a.id_cliente
),
deuda AS (
    SELECT mes, id_reparto, SUM(saldo) AS deuda
    FROM saldo_cierre
    WHERE saldo > 0
    GROUP BY mes, id_reparto
),
venta AS (
    SELECT FORMAT(v.fecha, 'yyyy-MM') AS mes, v.id_reparto, SUM(v.importe) AS venta
    FROM fact_venta v JOIN alcance a ON a.id_cliente = v.id_cliente
    GROUP BY FORMAT(v.fecha, 'yyyy-MM'), v.id_reparto
),
cobro AS (
    SELECT FORMAT(p.fecha, 'yyyy-MM') AS mes, p.id_reparto,
           SUM(p.importe)                                                    AS cobrado,
           SUM(CASE WHEN p.medio = 'Efectivo' THEN p.importe ELSE 0 END)     AS efectivo,
           SUM(p.importe * mp.comision)                                      AS costo_plataformas
    FROM fact_pago p
    JOIN alcance a ON a.id_cliente = p.id_cliente
    JOIN dim_medio_pago mp ON mp.medio = p.medio
    GROUP BY FORMAT(p.fecha, 'yyyy-MM'), p.id_reparto
),
ajustes AS (
    SELECT FORMAT(m.fecha, 'yyyy-MM') AS mes, m.id_reparto,
           SUM(CASE WHEN m.tipo = 'Nota de crédito' THEN m.importe ELSE 0 END) AS nc,
           SUM(CASE WHEN m.tipo = 'Incobrable'      THEN m.importe ELSE 0 END) AS incobrables
    FROM fact_movimiento m JOIN alcance a ON a.id_cliente = m.id_cliente
    WHERE m.tipo IN ('Nota de crédito', 'Incobrable')
    GROUP BY FORMAT(m.fecha, 'yyyy-MM'), m.id_reparto
)
SELECT r.id_reparto, s.supervisor, su.sucursal, m.mes, m.dias_reparto,
       COALESCE(v.venta, 0)                    AS venta,
       COALESCE(d.deuda, 0)                    AS deuda_cierre,
       CASE WHEN COALESCE(v.venta, 0) > 0
            THEN COALESCE(d.deuda, 0) / (v.venta / m.dias_reparto) END            AS dias_calle,
       COALESCE(c.cobrado, 0)                  AS cobrado,
       CASE WHEN COALESCE(c.cobrado, 0) > 0 THEN c.efectivo / c.cobrado END     AS pct_efectivo,
       COALESCE(c.costo_plataformas, 0)        AS costo_plataformas,
       COALESCE(aj.nc, 0)                      AS nc,
       COALESCE(aj.incobrables, 0)             AS incobrables
FROM dim_reparto r
JOIN dim_supervisor s ON s.id_supervisor = r.id_supervisor
JOIN dim_sucursal su  ON su.id_sucursal  = r.id_sucursal
CROSS JOIN meses m
LEFT JOIN venta v    ON v.id_reparto  = r.id_reparto AND v.mes  = m.mes
LEFT JOIN deuda d    ON d.id_reparto  = r.id_reparto AND d.mes  = m.mes
LEFT JOIN cobro c    ON c.id_reparto  = r.id_reparto AND c.mes  = m.mes
LEFT JOIN ajustes aj ON aj.id_reparto = r.id_reparto AND aj.mes = m.mes
WHERE r.tipo_reparto = 'Comercial'
ORDER BY r.id_reparto, m.mes;
