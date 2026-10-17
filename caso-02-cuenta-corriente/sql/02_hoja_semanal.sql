/* =====================================================================================
   Caso 02 · 02 Hoja de trabajo semanal (SQL Server)
   Misma lógica que 02_codigo/hoja.py y que el tablero. En producción corre el lunes a las 7:00
   (Programador de tareas) con los datos hasta el domingo; durante la semana se vuelve a correr
   solo para medir cómo va cada cuenta. Los parámetros acordados están en la CTE «par».

   Foco (el primero que cumple, en este orden):
     0 deuda   vencido a más de {dias} días ≥ piso
     1 visita  saldo ≥ piso y sin visita del reparto hace más de {sin_visita} días (o nunca)
     2 ritmo   días sin pagar > factor × su intervalo habitual (y > 14), con saldo ≥ piso
     3 nc      notas de crédito de los últimos 30 días ≥ piso_nc y > pct_nc × su facturación mensual habitual
   Estado al cierre (sábado, o al corte si la semana está en curso):
     0 resuelta · 1 en parte · 2 pendiente · 3 salió sola (ver reglas-de-negocio.md)
   ===================================================================================== */
WITH par AS (
    SELECT CAST('2025-10-06' AS DATE) AS lunes,      -- lunes de la hoja
           CAST('2025-10-09' AS DATE) AS corte,      -- último día con datos
           45      AS dias,                          -- vencido a más de (30, 45, 60 o 90)
           15000   AS piso,
           2.0     AS factor,
           14      AS sin_visita,
           20000   AS piso_nc,
           0.5     AS pct_nc
),
fechas AS (
    SELECT p.lunes, p.corte, p.dias, p.piso, p.factor, p.sin_visita, p.piso_nc, p.pct_nc,
           DATEADD(day, -1, p.lunes) AS domingo,
           CASE WHEN DATEADD(day, 5, p.lunes) < p.corte THEN DATEADD(day, 5, p.lunes) ELSE p.corte END AS fin
    FROM par p
),
cortes AS (                     -- todo se mide dos veces: al domingo (arma la hoja) y al cierre (cómo terminó)
    SELECT 'L' AS momento, domingo AS t FROM fechas
    UNION ALL
    SELECT 'C' AS momento, fin AS t FROM fechas
),
alcance AS (                    -- fuera: cuentas internas y clientes de repartos que no venden
    SELECT c.id_cliente
    FROM dim_cliente c
    JOIN dim_reparto r ON r.id_reparto = c.id_reparto
    WHERE c.cuenta_interna = 0 AND r.tipo_reparto = 'Comercial'
),
debitos AS (
    SELECT fecha, id_cliente, importe FROM fact_venta
    UNION ALL
    SELECT fecha, id_cliente, importe FROM fact_movimiento WHERE tipo IN ('Saldo inicial', 'Reversa de pago')
),
creditos AS (
    SELECT fecha, id_cliente, importe FROM fact_pago
    UNION ALL
    SELECT fecha, id_cliente, importe FROM fact_movimiento WHERE tipo IN ('Nota de crédito', 'Incobrable')
),
cred_t AS (
    SELECT k.momento, a.id_cliente, COALESCE(SUM(cr.importe), 0) AS cred
    FROM cortes k
    CROSS JOIN alcance a
    LEFT JOIN creditos cr ON cr.id_cliente = a.id_cliente AND cr.fecha <= k.t
    GROUP BY k.momento, a.id_cliente
),
deb_t AS (                      -- FIFO: lo cobrado cancela primero el cargo más viejo
    SELECT k.momento, d.id_cliente, d.importe,
           DATEDIFF(day, d.fecha, k.t) AS edad,
           SUM(d.importe) OVER (PARTITION BY k.momento, d.id_cliente ORDER BY d.fecha ROWS UNBOUNDED PRECEDING) AS acum
    FROM cortes k
    JOIN debitos d ON d.fecha <= k.t
    JOIN alcance a ON a.id_cliente = d.id_cliente
),
antig AS (                      -- saldo y lo vencido a más de {dias} días que sigue sin cancelar
    SELECT c.momento, c.id_cliente,
           COALESCE(SUM(d.importe), 0) - c.cred AS saldo,
           COALESCE(SUM(CASE WHEN d.edad > f.dias THEN
                             CASE WHEN d.acum - c.cred <= 0 THEN 0
                                  WHEN d.acum - c.cred < d.importe THEN d.acum - c.cred
                                  ELSE d.importe END
                        END), 0) AS vencido
    FROM cred_t c
    CROSS JOIN fechas f
    LEFT JOIN deb_t d ON d.momento = c.momento AND d.id_cliente = c.id_cliente
    GROUP BY c.momento, c.id_cliente, c.cred
),
ultimos AS (                    -- último pago y última visita efectiva a cada corte
    SELECT k.momento, a.id_cliente,
           (SELECT MAX(p.fecha) FROM fact_pago p WHERE p.id_cliente = a.id_cliente AND p.fecha <= k.t) AS ult_pago,
           (SELECT MAX(v.fecha) FROM fact_visita v WHERE v.id_cliente = a.id_cliente AND v.visito = 1 AND v.fecha <= k.t) AS ult_visita
    FROM cortes k
    CROSS JOIN alcance a
),
ventana AS (                    -- pagos de los 180 días previos al lunes, con el intervalo contra el pago anterior
    SELECT p.id_cliente, p.importe,
           DATEDIFF(day, LAG(p.fecha) OVER (PARTITION BY p.id_cliente ORDER BY p.fecha), p.fecha) AS intervalo
    FROM fact_pago p
    CROSS JOIN fechas f
    WHERE p.fecha > DATEADD(day, -180, f.domingo) AND p.fecha <= f.domingo
),
med_intervalo AS (              -- mediana del intervalo entre pagos (hace falta al menos 3 pagos)
    SELECT id_cliente, FLOOR(AVG(1.0 * intervalo)) AS imed
    FROM (SELECT id_cliente, intervalo,
                 ROW_NUMBER() OVER (PARTITION BY id_cliente ORDER BY intervalo) AS rn,
                 COUNT(*) OVER (PARTITION BY id_cliente) AS n
          FROM ventana WHERE intervalo IS NOT NULL) s
    WHERE n >= 2 AND rn IN (FLOOR((n + 1) / 2.0), FLOOR((n + 2) / 2.0))
    GROUP BY id_cliente
),
med_pago AS (                   -- pago mediano en la misma ventana
    SELECT id_cliente, ROUND(AVG(1.0 * importe), 0) AS pmed
    FROM (SELECT id_cliente, importe,
                 ROW_NUMBER() OVER (PARTITION BY id_cliente ORDER BY importe) AS rn,
                 COUNT(*) OVER (PARTITION BY id_cliente) AS n
          FROM ventana) s
    WHERE rn IN (FLOOR((n + 1) / 2.0), FLOOR((n + 2) / 2.0))
    GROUP BY id_cliente
),
sumas AS (
    SELECT a.id_cliente,
           (SELECT COALESCE(SUM(m.importe), 0) FROM fact_movimiento m WHERE m.id_cliente = a.id_cliente AND m.tipo = 'Nota de crédito'
                AND m.fecha > DATEADD(day, -30, f.domingo) AND m.fecha <= f.domingo)                       AS nc30,
           (SELECT COALESCE(SUM(m.importe), 0) FROM fact_movimiento m WHERE m.id_cliente = a.id_cliente AND m.tipo = 'Nota de crédito'
                AND m.fecha > DATEADD(day, -30, f.fin) AND m.fecha <= f.fin)                               AS e_nc30,
           (SELECT ROUND(COALESCE(SUM(v.importe), 0) / 6.0, 0) FROM fact_venta v WHERE v.id_cliente = a.id_cliente
                AND v.fecha > DATEADD(day, -180, f.domingo) AND v.fecha <= f.domingo)                      AS fac6,
           (SELECT COALESCE(SUM(p.importe), 0) FROM fact_pago p WHERE p.id_cliente = a.id_cliente
                AND p.fecha > f.domingo AND p.fecha <= f.fin)                                              AS pag,
           (SELECT COUNT(*) FROM fact_visita v WHERE v.id_cliente = a.id_cliente AND v.visito = 1
                AND v.fecha >= f.lunes AND v.fecha <= f.fin)                                               AS visitas,
           (SELECT COUNT(*) FROM fact_gestion g WHERE g.id_cliente = a.id_cliente AND g.tipo = 'Revisión de nota de crédito'
                AND g.fecha >= f.lunes AND g.fecha <= f.fin)                                               AS revisiones,
           (SELECT COUNT(*) FROM fact_gestion g WHERE g.id_cliente = a.id_cliente AND g.tipo = 'Llamado'
                AND g.fecha >= f.lunes AND g.fecha <= f.fin)                                               AS llamados
    FROM alcance a
    CROSS JOIN fechas f
),
rasgos AS (
    SELECT a.id_cliente,
           l.saldo,
           CASE WHEN l.saldo > 0 THEN l.vencido ELSE 0 END                        AS vd,
           CASE WHEN ul.ult_pago   IS NULL THEN -1 ELSE DATEDIFF(day, ul.ult_pago,   f.domingo) END AS dup,
           CASE WHEN ul.ult_visita IS NULL THEN -1 ELSE DATEDIFF(day, ul.ult_visita, f.domingo) END AS duv,
           COALESCE(mi.imed, -1) AS imed,
           COALESCE(mp.pmed, 0)  AS pmed,
           s.nc30, s.fac6, s.pag, s.visitas, s.revisiones, s.llamados,
           c.saldo                                                                 AS e_saldo,
           CASE WHEN c.saldo > 0 THEN c.vencido ELSE 0 END                         AS e_vd,
           CASE WHEN uc.ult_pago   IS NULL THEN -1 ELSE DATEDIFF(day, uc.ult_pago,   f.fin) END AS e_dup,
           CASE WHEN uc.ult_visita IS NULL THEN -1 ELSE DATEDIFF(day, uc.ult_visita, f.fin) END AS e_duv,
           s.e_nc30,
           f.piso, f.factor, f.sin_visita, f.piso_nc, f.pct_nc
    FROM alcance a
    CROSS JOIN fechas f
    JOIN antig l    ON l.id_cliente  = a.id_cliente AND l.momento  = 'L'
    JOIN antig c    ON c.id_cliente  = a.id_cliente AND c.momento  = 'C'
    JOIN ultimos ul ON ul.id_cliente = a.id_cliente AND ul.momento = 'L'
    JOIN ultimos uc ON uc.id_cliente = a.id_cliente AND uc.momento = 'C'
    JOIN sumas s    ON s.id_cliente  = a.id_cliente
    LEFT JOIN med_intervalo mi ON mi.id_cliente = a.id_cliente
    LEFT JOIN med_pago mp      ON mp.id_cliente = a.id_cliente
),
foco AS (
    SELECT r.*,
           CASE WHEN vd >= piso THEN 0
                WHEN saldo >= piso AND (duv > sin_visita OR duv < 0) THEN 1
                WHEN imed > 0 AND dup > CASE WHEN factor * imed > 14 THEN factor * imed ELSE 14 END AND saldo >= piso THEN 2
                WHEN nc30 >= piso_nc AND nc30 > pct_nc * fac6 THEN 3
           END AS foco
    FROM rasgos r
)
SELECT f.id_cliente,
       f.foco,
       CASE f.foco WHEN 0 THEN 'Deuda vencida' WHEN 1 THEN 'Sin visita del reparto'
                   WHEN 2 THEN 'Ritmo de pago atrasado' WHEN 3 THEN 'NC fuera de lo normal' END AS foco_texto,
       CASE
           WHEN f.foco = 0 AND f.pag >= f.vd                       THEN 0
           WHEN f.foco = 0 AND f.pag > 0                           THEN 1
           WHEN f.foco = 0 AND f.e_vd < f.piso                     THEN 3
           WHEN f.foco = 1 AND f.visitas > 0 AND f.pag > 0         THEN 0
           WHEN f.foco = 1 AND f.visitas > 0                       THEN 1
           WHEN f.foco = 1 AND f.e_saldo < f.piso                  THEN 3
           WHEN f.foco = 2 AND f.pag >= 0.8 * f.pmed               THEN 0
           WHEN f.foco = 2 AND f.pag > 0                           THEN 1
           WHEN f.foco = 3 AND f.revisiones > 0                    THEN 0
           WHEN f.foco IS NOT NULL                                 THEN 2
       END AS estado,               -- 0 resuelta · 1 en parte · 2 pendiente · 3 salió sola
       CASE WHEN f.foco IS NULL AND (
                 f.e_vd >= f.piso
              OR (f.imed > 0 AND f.e_dup > CASE WHEN f.factor * f.imed > 14 THEN f.factor * f.imed ELSE 14 END AND f.e_saldo >= f.piso)
              OR (f.e_saldo >= f.piso AND (f.e_duv > f.sin_visita OR f.e_duv < 0))
              OR (f.e_nc30 >= f.piso_nc AND f.e_nc30 > f.pct_nc * f.fac6))
            THEN 1 ELSE 0 END AS nueva,     -- no estaba el lunes y al cierre cumple alguna condición
       f.saldo, f.vd AS vencido, f.dup AS dias_sin_pago, f.imed AS intervalo_habitual, f.duv AS dias_sin_visita,
       f.nc30, f.fac6, f.pag AS pagado_semana, f.visitas, f.llamados
FROM foco f
WHERE f.foco IS NOT NULL
   OR f.e_vd >= f.piso OR f.e_saldo >= f.piso OR f.e_nc30 >= f.piso_nc       -- candidatas a nueva
ORDER BY f.foco, f.vd DESC;
