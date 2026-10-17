-- =====================================================================================
-- Caso 04 · Pastas Don Aldo · 01 Esquema en Supabase (PostgreSQL)
-- Las respuestas del formulario llegan por la API de Supabase (Apps Script con la clave de servicio).
-- El tablero solo lee las vistas de 02_vistas.sql con un usuario autenticado: nadie escribe desde el navegador.
-- =====================================================================================

create table locales (
    nombre      text primary key,                       -- Centro · Jardín
    fondo_caja  integer not null default 20000 check (fondo_caja >= 0)
);

create table medios_pago (
    medio       text primary key,
    comision    numeric(5,4) not null check (comision between 0 and 0.2)   -- comisión de la plataforma, sin IVA
);

create table cierres_caja (
    id                bigint generated always as identity primary key,
    fecha             date    not null check (fecha >= date '2025-01-01'),
    local             text    not null references locales (nombre),
    responsable       text,                               -- el Excel no lo tenía
    efectivo          integer check (efectivo >= 0),       -- null: el Excel decía «ver cuaderno»
    debito            integer not null default 0 check (debito >= 0),
    credito           integer not null default 0 check (credito >= 0),
    billetera         integer not null default 0 check (billetera >= 0),
    transferencia     integer not null default 0 check (transferencia >= 0),
    tickets           integer check (tickets > 0),
    gasto             integer not null default 0 check (gasto >= 0),
    concepto_gasto    text,
    retiro            integer not null default 0 check (retiro >= 0),
    fondo             integer,
    efectivo_contado  integer check (efectivo_contado >= 0),
    incompleta        boolean not null default false,
    fuente            text not null check (fuente in ('Excel', 'Formulario')),
    obs               text,
    cargado           timestamp,                          -- marca temporal del formulario
    unique (fecha, local),                                -- un cierre por local y día: el formulario no deja cargar dos
    check (fuente = 'Excel' or (responsable is not null and efectivo_contado is not null and tickets is not null))
);

create table clientes_mayoristas (
    id_cliente  integer primary key,
    nombre      text not null unique,
    condicion   text not null check (condicion in ('Contado', 'Cuenta corriente')),
    alta        date not null
);

create table ventas_mayoristas (
    id          bigint generated always as identity primary key,
    fecha       date    not null,
    id_cliente  integer not null references clientes_mayoristas (id_cliente),
    importe     integer not null check (importe > 0),
    condicion   text    not null check (condicion in ('Contado', 'Cuenta corriente')),
    fuente      text    not null check (fuente in ('Excel', 'Formulario'))
);

create table cobros_mayoristas (
    id          bigint generated always as identity primary key,
    fecha       date    not null,
    id_cliente  integer not null references clientes_mayoristas (id_cliente),
    importe     integer not null check (importe > 0),
    medio       text    not null,                         -- «Sin dato» en lo que viene del Excel
    fuente      text    not null check (fuente in ('Excel', 'Formulario'))
);

create index ix_cierres_fecha on cierres_caja (fecha);
create index ix_ventas_cliente on ventas_mayoristas (id_cliente, fecha);
create index ix_cobros_cliente on cobros_mayoristas (id_cliente, fecha);

insert into locales (nombre) values ('Centro'), ('Jardín');
insert into medios_pago values ('Efectivo', 0), ('Débito', 0.015), ('Crédito', 0.035), ('Billetera virtual', 0.008), ('Transferencia', 0);

-- ---------------------------------------------------------------- seguridad (solo Supabase)
-- Con RLS activa y sin políticas de escritura, solo la clave de servicio (Apps Script) puede insertar.
-- El dueño entra al tablero con su usuario y puede leer.
alter table locales             enable row level security;
alter table medios_pago         enable row level security;
alter table cierres_caja        enable row level security;
alter table clientes_mayoristas enable row level security;
alter table ventas_mayoristas   enable row level security;
alter table cobros_mayoristas   enable row level security;
create policy lectura on locales             for select to authenticated using (true);
create policy lectura on medios_pago         for select to authenticated using (true);
create policy lectura on cierres_caja        for select to authenticated using (true);
create policy lectura on clientes_mayoristas for select to authenticated using (true);
create policy lectura on ventas_mayoristas   for select to authenticated using (true);
create policy lectura on cobros_mayoristas   for select to authenticated using (true);
