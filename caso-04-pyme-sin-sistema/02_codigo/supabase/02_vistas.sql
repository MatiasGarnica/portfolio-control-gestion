-- =====================================================================================
-- Caso 04 · 02 Vistas que lee el tablero (PostgreSQL / Supabase)
-- Mismas cuentas que build_data.py; verificar_vistas.py las corre en DuckDB y compara.
-- Corte del portfolio: 09/10/2025 (en producción, current_date).
-- =====================================================================================

-- Cierre de cada día: venta total, efectivo que tendría que haber y lo que se contó
create view v_cierre_diario as
select c.fecha, c.local, c.responsable, c.fuente,
       coalesce(c.efectivo, 0) + c.debito + c.credito + c.billetera + c.transferencia as venta_total,
       c.tickets,
       c.fondo + c.efectivo - c.gasto - c.retiro as efectivo_esperado,
       c.efectivo_contado,
       c.efectivo_contado - (c.fondo + c.efectivo - c.gasto - c.retiro) as diferencia,
       case when c.efectivo_contado is null then null
            when abs(c.efectivo_contado - (c.fondo + c.efectivo - c.gasto - c.retiro)) <= 500 then 'Cuadra'
            when c.efectivo_contado - (c.fondo + c.efectivo - c.gasto - c.retiro) < 0 then 'Faltante'
            else 'Sobrante' end as estado_caja
from cierres_caja c;

-- Días en que un local abrió (martes a domingo) y no cargó el cierre, desde que existe el formulario
create view v_cierres_faltantes as
select d.fecha, l.nombre as local
from generate_series(date '2025-06-01', date '2025-10-09', interval '1 day') as d (fecha)
cross join locales l
where extract(isodow from d.fecha) <> 1
  and not exists (select 1 from cierres_caja c where c.fecha = d.fecha::date and c.local = l.nombre);

-- Venta por mes, local y medio, con tickets y lo que cuestan las plataformas
create view v_ventas_mes as
select to_char(c.fecha, 'YYYY-MM') as mes, c.local,
       sum(coalesce(c.efectivo, 0)) as efectivo, sum(c.debito) as debito, sum(c.credito) as credito,
       sum(c.billetera) as billetera, sum(c.transferencia) as transferencia,
       sum(coalesce(c.efectivo, 0) + c.debito + c.credito + c.billetera + c.transferencia) as venta_total,
       sum(c.tickets) as tickets,
       round(sum(c.debito) * 0.015 + sum(c.credito) * 0.035 + sum(c.billetera) * 0.008) as costo_medios
from cierres_caja c
group by to_char(c.fecha, 'YYYY-MM'), c.local;

-- Cómo cierra cada responsable (solo con formulario: el Excel no tenía el efectivo contado)
create view v_responsables as
select v.responsable, v.local,
       count(*)                                                        as cierres,
       sum(case when v.estado_caja = 'Cuadra' then 1 else 0 end)       as cuadran,
       sum(case when v.estado_caja = 'Faltante' then 1 else 0 end)     as faltantes,
       sum(case when v.diferencia < -500 then v.diferencia else 0 end) as faltante_total,
       sum(case when v.diferencia > 500 then v.diferencia else 0 end)  as sobrante_total
from v_cierre_diario v
where v.fuente = 'Formulario'
group by v.responsable, v.local;

-- Fiado de cada restaurante: saldo, fecha de la compra más vieja sin pagar (lo cobrado cancela primero lo más viejo)
-- y cuánto pagó de lo que compró en los últimos 90 días: menos del 70% es «paga menos de lo que compra»
create view v_saldo_mayoristas as
with cc as (
    select v.id_cliente, v.fecha, v.importe,
           sum(v.importe) over (partition by v.id_cliente order by v.fecha, v.id rows unbounded preceding) as acumulado
    from ventas_mayoristas v
    where v.condicion = 'Cuenta corriente'
),
cob as (
    select id_cliente, sum(importe) as cobrado,
           sum(case when fecha > date '2025-10-09' - 90 then importe else 0 end) as cobrado_90
    from cobros_mayoristas c
    where exists (select 1 from ventas_mayoristas v where v.id_cliente = c.id_cliente and v.condicion = 'Cuenta corriente')
    group by id_cliente
)
select cc.id_cliente,
       sum(cc.importe) - coalesce(max(cob.cobrado), 0)                              as saldo,
       min(case when cc.acumulado > coalesce(cob.cobrado, 0) then cc.fecha end)      as deuda_desde,
       sum(case when cc.fecha > date '2025-10-09' - 90 then cc.importe else 0 end)  as vendido_90,
       coalesce(max(cob.cobrado_90), 0)                                             as cobrado_90,
       sum(case when cc.fecha > date '2025-10-09' - 90 then cc.importe else 0 end) > 0
         and coalesce(max(cob.cobrado_90), 0) < 0.7 * sum(case when cc.fecha > date '2025-10-09' - 90 then cc.importe else 0 end) as paga_menos
from cc
left join cob on cob.id_cliente = cc.id_cliente
group by cc.id_cliente;

-- Quién compra y quién dejó: días sin comprar contra su intervalo habitual (mediana de los últimos 180 días).
-- «Compra menos seguido»: en las últimas 6 semanas hizo menos del 70% de las compras que le tocaban por su intervalo.
create view v_estado_clientes as
with compras as (
    select v.id_cliente, v.fecha,
           v.fecha - lag(v.fecha) over (partition by v.id_cliente order by v.fecha) as intervalo
    from (select distinct id_cliente, fecha from ventas_mayoristas) v
),
ritmo as (
    select id_cliente, percentile_cont(0.5) within group (order by intervalo) as intervalo
    from compras
    where intervalo is not null and fecha > date '2025-10-09' - 180
    group by id_cliente
    having count(*) >= 2
),
ult as (
    select id_cliente, max(fecha) as ultima, min(fecha) as primera,
           count(distinct case when fecha > date '2025-10-09' - 42 then fecha end) as compras_6sem
    from ventas_mayoristas group by id_cliente
)
select c.id_cliente, c.nombre, u.ultima, r.intervalo,
       date '2025-10-09' - u.ultima as dias_sin_comprar,
       u.compras_6sem,
       case when u.primera > date '2025-10-09' - 90 then 'Nuevo'
            when date '2025-10-09' - u.ultima > greatest(4 * coalesce(r.intervalo, 7), 30) then 'Dejó de comprar'
            when date '2025-10-09' - u.ultima > greatest(2 * coalesce(r.intervalo, 7), 10) then 'En riesgo'
            when r.intervalo is not null and u.compras_6sem < 0.7 * 42 / r.intervalo then 'Compra menos seguido'
            else 'Activo' end as estado
from clientes_mayoristas c
join ult u on u.id_cliente = c.id_cliente
left join ritmo r on r.id_cliente = c.id_cliente;
