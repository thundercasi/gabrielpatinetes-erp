-- =====================================================================
-- 1) Categorias de produto editáveis (antes eram fixas no código)
-- 2) Venda com ou sem nota fiscal (emitir_nf / nf_numero)
-- =====================================================================

-- ---------- Categorias ----------
create table public.categorias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default public.current_uid() references auth.users(id) on delete cascade,
  nome        text not null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, nome)
);
create index on public.categorias(user_id);

alter table public.categorias enable row level security;
create policy "dono_select" on public.categorias for select to authenticated using (user_id = (select auth.uid()));
create policy "dono_insert" on public.categorias for insert to authenticated with check (user_id = (select auth.uid()));
create policy "dono_update" on public.categorias for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dono_delete" on public.categorias for delete to authenticated using (user_id = (select auth.uid()));

alter table public.produtos add column categoria_id uuid references public.categorias(id) on delete set null;
create index on public.produtos(categoria_id);

-- migra as categorias fixas antigas para a tabela
insert into public.categorias(user_id, nome)
select distinct p.user_id,
  case p.categoria
    when 'patinete' then 'Patinete' when 'bicicleta' then 'Bicicleta' when 'moto' then 'Moto'
    when 'drone' then 'Drone' when 'monociclo' then 'Monociclo' when 'skate' then 'Skate'
    when 'acessorio' then 'Acessório' when 'peca' then 'Peça' else 'Outro' end
from public.produtos p
on conflict (user_id, nome) do nothing;

update public.produtos p set categoria_id = c.id
from public.categorias c
where c.user_id = p.user_id and c.nome =
  case p.categoria
    when 'patinete' then 'Patinete' when 'bicicleta' then 'Bicicleta' when 'moto' then 'Moto'
    when 'drone' then 'Drone' when 'monociclo' then 'Monociclo' when 'skate' then 'Skate'
    when 'acessorio' then 'Acessório' when 'peca' then 'Peça' else 'Outro' end;

drop view if exists public.vw_estoque;
alter table public.produtos drop column categoria;

create view public.vw_estoque with (security_invoker = true) as
with ent as (
  select produto_id,
         sum(quantidade) filter (where status = 'recebido') as recebido,
         sum(quantidade) filter (where status in ('pedido','pago','em_transito','alfandega')) as a_caminho,
         sum(custo_total_brl) filter (where status <> 'cancelado') as custo_soma,
         sum(quantidade) filter (where status <> 'cancelado') as custo_qtd
  from public.vw_compra_itens
  where produto_id is not null
  group by produto_id
), sai as (
  select vi.produto_id, sum(vi.quantidade) as vendido
  from public.venda_itens vi
  join public.vendas v on v.id = vi.venda_id
  where vi.produto_id is not null and vi.origem_custo = 'estoque' and v.status not in ('cancelado','orcamento')
  group by vi.produto_id
), aj as (
  select produto_id, sum(quantidade) as ajustes
  from public.estoque_ajustes group by produto_id
)
select p.id as produto_id, p.user_id, p.nome, p.categoria_id, c.nome as categoria, p.marca, p.modelo, p.sku, p.preco_venda,
       p.estoque_minimo, p.ativo,
       coalesce(ent.recebido, 0) as recebido,
       coalesce(ent.a_caminho, 0) as a_caminho,
       coalesce(sai.vendido, 0) as vendido,
       coalesce(aj.ajustes, 0) as ajustes,
       coalesce(ent.recebido, 0) - coalesce(sai.vendido, 0) + coalesce(aj.ajustes, 0) as saldo,
       case when coalesce(ent.custo_qtd, 0) > 0 then round(ent.custo_soma / ent.custo_qtd, 2) end as custo_medio
from public.produtos p
left join public.categorias c on c.id = p.categoria_id
left join ent on ent.produto_id = p.id
left join sai on sai.produto_id = p.id
left join aj on aj.produto_id = p.id;

-- ---------- Nota fiscal na venda ----------
-- null = não informado (vendas importadas da planilha)
alter table public.vendas add column emitir_nf boolean;
alter table public.vendas add column nf_numero text;

-- as views usam v.* e precisam ser recriadas para enxergar as colunas novas
drop view if exists public.vw_resumo_mensal;
drop view if exists public.vw_vendas;

create view public.vw_vendas with (security_invoker = true) as
with it as (
  select venda_id,
         sum(quantidade) as itens_qtd,
         sum(quantidade * preco_unit) as bruto,
         sum(quantidade * custo_unit_brl) as custo_total,
         string_agg(coalesce(p.nome, vi.descricao, '?') ||
                    case when quantidade > 1 then ' ×' || quantidade else '' end, ', ') as produtos
  from public.venda_itens vi
  left join public.produtos p on p.id = vi.produto_id
  group by venda_id
)
select v.*,
       cl.nome as cliente_nome, cl.cidade as cliente_cidade, cl.uf as cliente_uf,
       coalesce(it.itens_qtd, 0) as itens_qtd,
       coalesce(it.produtos, '') as produtos,
       round(coalesce(it.bruto, 0) - v.desconto, 2) as receita,
       round(coalesce(it.custo_total, 0), 2) as custo_total,
       round(v.despesas + v.quebras + v.frete_br, 2) as despesas_total,
       round((coalesce(it.bruto, 0) - v.desconto) * v.aliquota_imposto, 2) as imposto,
       round((coalesce(it.bruto, 0) - v.desconto)
             - coalesce(it.custo_total, 0)
             - (v.despesas + v.quebras + v.frete_br)
             - (coalesce(it.bruto, 0) - v.desconto) * v.aliquota_imposto, 2) as lucro_liquido,
       case when (coalesce(it.bruto, 0) - v.desconto) > 0 then
         round(((coalesce(it.bruto, 0) - v.desconto)
                - coalesce(it.custo_total, 0)
                - (v.despesas + v.quebras + v.frete_br)
                - (coalesce(it.bruto, 0) - v.desconto) * v.aliquota_imposto)
               / (coalesce(it.bruto, 0) - v.desconto), 4)
       end as margem
from public.vendas v
left join it on it.venda_id = v.id
left join public.clientes cl on cl.id = v.cliente_id;

create view public.vw_resumo_mensal with (security_invoker = true) as
with v as (
  select user_id, date_trunc('month', data)::date as mes,
         count(*) as vendas, sum(receita) as receita, sum(custo_total) as custo,
         sum(despesas_total) as despesas_vendas, sum(imposto) as imposto, sum(lucro_liquido) as lucro_vendas,
         sum(receita) filter (where emitir_nf is distinct from false) as receita_com_nf
  from public.vw_vendas where status not in ('cancelado','orcamento')
  group by 1, 2
), l as (
  select user_id, date_trunc('month', vencimento)::date as mes,
         sum(valor) filter (where tipo = 'despesa') as despesas_gerais,
         sum(valor) filter (where tipo = 'receita') as receitas_gerais
  from public.lancamentos
  where venda_id is null and compra_id is null
    and categoria <> 'imposto'
  group by 1, 2
)
select coalesce(v.user_id, l.user_id) as user_id,
       coalesce(v.mes, l.mes) as mes,
       coalesce(v.vendas, 0) as vendas,
       coalesce(v.receita, 0) as receita,
       coalesce(v.custo, 0) as custo,
       coalesce(v.despesas_vendas, 0) as despesas_vendas,
       coalesce(v.imposto, 0) as imposto,
       coalesce(v.lucro_vendas, 0) as lucro_vendas,
       coalesce(l.despesas_gerais, 0) as despesas_gerais,
       coalesce(l.receitas_gerais, 0) as receitas_gerais,
       coalesce(v.lucro_vendas, 0) - coalesce(l.despesas_gerais, 0) + coalesce(l.receitas_gerais, 0) as resultado,
       coalesce(v.receita_com_nf, 0) as receita_com_nf
from v full join l on l.user_id = v.user_id and l.mes = v.mes;

-- RBT12 considera só a receita faturada (vendas marcadas "sem NF" ficam de fora)
create or replace function public.rbt12(p_mes date default current_date)
returns numeric language sql stable security invoker set search_path = '' as $$
  select coalesce((
           select sum(receita) from public.vw_vendas
           where status not in ('cancelado','orcamento')
             and emitir_nf is distinct from false
             and data >= (date_trunc('month', p_mes) - interval '12 months')
             and data < date_trunc('month', p_mes)
         ), 0)
       + coalesce((
           select case
                    when c.rbt12_inicial_ref is null then 0
                    else c.rbt12_inicial * greatest(0, 12 - (
                           (extract(year from date_trunc('month', p_mes)) - extract(year from date_trunc('month', c.rbt12_inicial_ref))) * 12
                         + (extract(month from date_trunc('month', p_mes)) - extract(month from date_trunc('month', c.rbt12_inicial_ref)))
                         ))::numeric / 12
                  end
           from public.configuracoes c where c.user_id = auth.uid()
         ), 0)
$$;
