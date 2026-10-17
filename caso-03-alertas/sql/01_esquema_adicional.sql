/* =====================================================================================
   Caso 03 · 01 Esquema adicional (SQL Server)
   Se corre después de ../../caso-02-cuenta-corriente/sql/01_esquema.sql: misma empresa y mismo modelo,
   más lo que necesita el control: equipos en comodato, abonos, cambios de ruta y el canal de cada pago.
   ===================================================================================== */

ALTER TABLE fact_pago ADD canal NVARCHAR(12) NULL;          -- Reparto · Sucursal · Digital · Débito

CREATE TABLE dim_equipo (
    id_equipo         VARCHAR(8)    NOT NULL PRIMARY KEY,
    tipo_equipo       NVARCHAR(40)  NOT NULL,                  -- Dispenser frío/calor · Heladera exhibidora
    modalidad         NVARCHAR(30)  NOT NULL,                  -- Abono mensual · Comodato por consumo
    valor_reposicion  DECIMAL(14,2) NOT NULL,
    abono_mensual     DECIMAL(14,2) NOT NULL                   -- 0 si es comodato por consumo
);

CREATE TABLE fact_equipo (                                    -- instalaciones y retiros (los hace el reparto técnico)
    fecha             DATE          NOT NULL,
    id_equipo         VARCHAR(8)    NOT NULL REFERENCES dim_equipo (id_equipo),
    id_cliente        INT           NOT NULL REFERENCES dim_cliente (id_cliente),
    tipo              NVARCHAR(12)  NOT NULL,                  -- Instalación · Retiro
    id_reparto        VARCHAR(6)    NOT NULL REFERENCES dim_reparto (id_reparto)
);

CREATE TABLE fact_abono (                                     -- abono mensual facturado (entre el 1 y el 3 de cada mes)
    fecha             DATE          NOT NULL,
    id_equipo         VARCHAR(8)    NOT NULL REFERENCES dim_equipo (id_equipo),
    id_cliente        INT           NOT NULL REFERENCES dim_cliente (id_cliente),
    importe           DECIMAL(14,2) NOT NULL
);

CREATE TABLE fact_cambio_reparto (
    fecha             DATE          NOT NULL,
    id_cliente        INT           NOT NULL REFERENCES dim_cliente (id_cliente),
    reparto_origen    VARCHAR(6)    NOT NULL REFERENCES dim_reparto (id_reparto),
    reparto_destino   VARCHAR(6)    NOT NULL REFERENCES dim_reparto (id_reparto),
    motivo            NVARCHAR(60)  NOT NULL
);

CREATE INDEX ix_equipo_equipo  ON fact_equipo (id_equipo, tipo, fecha);
CREATE INDEX ix_abono_equipo   ON fact_abono (id_equipo, fecha);
CREATE INDEX ix_cambio_cliente ON fact_cambio_reparto (id_cliente, fecha);
