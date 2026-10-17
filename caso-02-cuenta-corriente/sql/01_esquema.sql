/* =====================================================================================
   Caso 02 · Cuenta corriente · 01 Esquema (SQL Server)
   Modelo estrella: dimensiones de sucursal, supervisor, reparto, cliente y medio de pago;
   hechos de venta, pago, movimiento (NC, incobrables, reversas, saldo inicial), visita y gestión.
   Los CSV de ../01_datos tienen las mismas columnas, en el mismo orden.
   ===================================================================================== */

CREATE TABLE dim_sucursal (
    id_sucursal     VARCHAR(4)    NOT NULL PRIMARY KEY,
    sucursal        NVARCHAR(40)  NOT NULL,
    lat             DECIMAL(9,6)  NOT NULL,
    lng             DECIMAL(9,6)  NOT NULL
);

CREATE TABLE dim_supervisor (
    id_supervisor   VARCHAR(4)    NOT NULL PRIMARY KEY,
    supervisor      NVARCHAR(60)  NOT NULL,
    id_sucursal     VARCHAR(4)    NOT NULL REFERENCES dim_sucursal (id_sucursal)
);

CREATE TABLE dim_reparto (
    id_reparto      VARCHAR(6)    NOT NULL PRIMARY KEY,
    reparto         NVARCHAR(40)  NOT NULL,
    id_supervisor   VARCHAR(4)    NULL,                 -- los repartos técnicos y de administración no tienen supervisor comercial
    id_sucursal     VARCHAR(4)    NOT NULL REFERENCES dim_sucursal (id_sucursal),
    tipo_reparto    NVARCHAR(20)  NOT NULL              -- Comercial · Técnico · Administración
);

CREATE TABLE dim_cliente (
    id_cliente      INT           NOT NULL PRIMARY KEY,
    nombre          NVARCHAR(80)  NOT NULL,
    tipo_cliente    NVARCHAR(20)  NOT NULL,             -- Hogar · Comercio · Empresa · Interna
    id_reparto      VARCHAR(6)    NOT NULL REFERENCES dim_reparto (id_reparto),
    id_sucursal     VARCHAR(4)    NOT NULL REFERENCES dim_sucursal (id_sucursal),
    condicion       NVARCHAR(30)  NOT NULL,             -- Contado · Cuenta corriente
    medio_habitual  NVARCHAR(30)  NOT NULL,
    frecuencia      NVARCHAR(12)  NOT NULL,             -- Semanal · Quincenal
    dia_visita      TINYINT       NOT NULL,             -- 0 = lunes … 5 = sábado
    fecha_alta      DATE          NOT NULL,
    cuenta_interna  TINYINT       NOT NULL,             -- 1 = cuenta de la propia empresa (no se gestiona)
    lat             DECIMAL(9,6)  NOT NULL,
    lng             DECIMAL(9,6)  NOT NULL
);

CREATE TABLE dim_medio_pago (
    medio           NVARCHAR(30)  NOT NULL PRIMARY KEY,
    comision        DECIMAL(6,4)  NOT NULL               -- comisión de la plataforma, sin IVA
);

CREATE TABLE fact_venta (
    fecha               DATE          NOT NULL,
    id_cliente          INT           NOT NULL REFERENCES dim_cliente (id_cliente),
    id_reparto          VARCHAR(6)    NOT NULL REFERENCES dim_reparto (id_reparto),
    importe             DECIMAL(14,2) NOT NULL,          -- solo lo vendido con cargo
    unidades_sin_cargo  INT           NOT NULL           -- promo 2x1: se informan, no suman importe
);

CREATE TABLE fact_pago (
    fecha           DATE          NOT NULL,
    id_cliente      INT           NOT NULL REFERENCES dim_cliente (id_cliente),
    id_reparto      VARCHAR(6)    NOT NULL REFERENCES dim_reparto (id_reparto),
    importe         DECIMAL(14,2) NOT NULL,
    medio           NVARCHAR(30)  NOT NULL REFERENCES dim_medio_pago (medio)
);

CREATE TABLE fact_movimiento (
    fecha           DATE          NOT NULL,
    id_cliente      INT           NOT NULL REFERENCES dim_cliente (id_cliente),
    id_reparto      VARCHAR(6)    NOT NULL REFERENCES dim_reparto (id_reparto),
    tipo            NVARCHAR(30)  NOT NULL,              -- Nota de crédito · Incobrable · Reversa de pago · Saldo inicial
    importe         DECIMAL(14,2) NOT NULL,              -- siempre positivo; el signo lo da el tipo
    motivo          NVARCHAR(60)  NOT NULL
);

CREATE TABLE fact_visita (
    fecha           DATE          NOT NULL,
    id_cliente      INT           NOT NULL REFERENCES dim_cliente (id_cliente),
    id_reparto      VARCHAR(6)    NOT NULL REFERENCES dim_reparto (id_reparto),
    visito          TINYINT       NOT NULL               -- 1 = el reparto pasó · 0 = estaba en la ruta y no pasó
);

CREATE TABLE fact_gestion (
    fecha           DATE          NOT NULL,
    id_cliente      INT           NOT NULL REFERENCES dim_cliente (id_cliente),
    area            NVARCHAR(30)  NOT NULL,              -- Supervisión · Administración
    tipo            NVARCHAR(40)  NOT NULL,              -- Llamado · Revisión de nota de crédito
    resultado       NVARCHAR(80)  NOT NULL
);

CREATE TABLE dim_calendario (
    fecha           DATE          NOT NULL PRIMARY KEY,
    dia_semana      TINYINT       NOT NULL,              -- 0 = lunes … 6 = domingo (no depende de SET DATEFIRST)
    es_dia_reparto  TINYINT       NOT NULL               -- lunes a sábado
);

/* Calendario 2025-2026 sin recursión (sirve igual en SQL Server y en otros motores) */
INSERT INTO dim_calendario (fecha, dia_semana, es_dia_reparto)
SELECT f.fecha,
       DATEDIFF(day, CAST('2024-12-30' AS DATE), f.fecha) % 7,                  -- 30/12/2024 fue lunes
       CASE WHEN DATEDIFF(day, CAST('2024-12-30' AS DATE), f.fecha) % 7 < 6 THEN 1 ELSE 0 END
FROM (
    SELECT DATEADD(day, u.d + 10 * t.d + 100 * c.d, CAST('2025-01-01' AS DATE)) AS fecha
    FROM (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) AS u (d)
    CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) AS t (d)
    CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6),(7)) AS c (d)
) AS f;

/* Índices para las consultas de la hoja (todas filtran por cliente y fecha) */
CREATE INDEX ix_venta_cli_fecha      ON fact_venta      (id_cliente, fecha);
CREATE INDEX ix_pago_cli_fecha       ON fact_pago       (id_cliente, fecha);
CREATE INDEX ix_movimiento_cli_fecha ON fact_movimiento (id_cliente, fecha);
CREATE INDEX ix_visita_cli_fecha     ON fact_visita     (id_cliente, fecha);
CREATE INDEX ix_gestion_cli_fecha    ON fact_gestion    (id_cliente, fecha);
