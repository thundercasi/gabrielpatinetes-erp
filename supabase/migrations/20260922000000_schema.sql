-- =====================================================================
-- GabrielPatinetes ERP – compra, importação e revenda de elétricos
-- Schema inicial (Supabase / Postgres 15+)
-- Cada registro pertence ao usuário logado (user_id = auth.uid()).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Helper: user_id padrão = usuário logado
-- ---------------------------------------------------------------------
create or replace function public.current_uid() returns uuid
language sql stable set search_path = '' as $$ select auth.uid() $$;

-- ---------------------------------------------------------------------
-- Configurações (1 linha por usuário)
-- ---------------------------------------------------------------------
create table public.configuracoes (
  user_id              uuid primary key default public.current_uid() references auth.users(id) on delete cascade,
  nome_empresa         text,
  cnpj                 text,
  cambio_padrao        numeric(10,4) not null default 5.30,
  freteiro_pct_padrao  numeric(6,4)  not null default 0.40,   -- 0.40 = 40% sobre a compra em R$
  -- Simples Nacional
  modo_aliquota        text not null default 'auto' check (modo_aliquota in ('auto','fixa')),
  aliquota_fixa        numeric(6,4) not null default 0.04,     -- usada quando modo = 'fixa'
  rbt12_inicial        numeric(14,2) not null default 0,       -- faturamento dos 12 meses anteriores ao uso do sistema
  rbt12_inicial_ref    date,                                   -- mês em que começou a usar o sistema (o valor inicial sai da janela 1/12 por mês)
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Cadastros
-- ---------------------------------------------------------------------
create table public.clientes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default public.current_uid() references auth.users(id) on delete cascade,
  nome        text not null,
  cpf_cnpj    text,
  telefone    text,
  email       text,
  cidade      text,
  uf          char(2),
  endereco    text,
  observacoes text,
  created_at  timestamptz not null default now()
);

create table public.fornecedores (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default public.current_uid() references auth.users(id) on delete cascade,
  nome        text not null,
  pais        text default 'China',
  moeda       text not null default 'USD' check (moeda in ('USD','BRL','EUR','CNY')),
  contato     text,
  telefone    text,
  email       text,
  observacoes text,
  created_at  timestamptz not null default now()
);

create table public.produtos (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default public.current_uid() references auth.users(id) on delete cascade,
  nome                 text not null,
  categoria            text not null default 'patinete'
                       check (categoria in ('patinete','bicicleta','moto','drone','monociclo','skate','acessorio','peca','outro')),
  marca                text,
  modelo               text,
  sku                  text,
  custo_ref_moeda      numeric(12,2),     -- preço de referência no fornecedor (USD)
  preco_venda          numeric(12,2),     -- preço de venda sugerido (R$)
  estoque_minimo       integer not null default 0,
  ativo                boolean not null default true,
  observacoes          text,
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Compras / importações
-- ---------------------------------------------------------------------
create table public.compras (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default public.current_uid() references auth.users(id) on delete cascade,
  fornecedor_id      uuid references public.fornecedores(id) on delete set null,
  data               date not null default current_date,
  tipo               text not null default 'importacao' check (tipo in ('importacao','nacional')),
  moeda              text not null default 'USD' check (moeda in ('USD','BRL','EUR','CNY')),
  cambio             numeric(10,4) not null default 5.30,    -- 1 se BRL
  freteiro_pct       numeric(6,4)  not null default 0.40,    -- % sobre a compra em R$
  custos_extras_brl  numeric(12,2) not null default 0,       -- frete fixo, taxas, despachante… (rateado por valor)
  status             text not null default 'pedido'
                     check (status in ('pedido','pago','em_transito','alfandega','recebido','cancelado')),
  previsao_chegada   date,
  recebido_em        date,
  rastreio           text,
  observacoes        text,
  created_at         timestamptz not null default now()
);

create table public.compra_itens (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default public.current_uid() references auth.users(id) on delete cascade,
  compra_id        uuid not null references public.compras(id) on delete cascade,
  produto_id       uuid references public.produtos(id) on delete restrict,
  descricao        text,
  quantidade       integer not null check (quantidade > 0),
  valor_unit_moeda numeric(12,2) not null check (valor_unit_moeda >= 0)
);

-- ---------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------
create table public.vendas (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default public.current_uid() references auth.users(id) on delete cascade,
  cliente_id        uuid references public.clientes(id) on delete set null,
  data              date not null default current_date,
  status            text not null default 'pago'
                    check (status in ('orcamento','encomenda','pago','enviado','entregue','cancelado')),
  previsao_entrega  text,               -- ex.: "Novembro"
  forma_pagamento   text,
  despesas          numeric(12,2) not null default 0,
  quebras           numeric(12,2) not null default 0,
  frete_br          numeric(12,2) not null default 0,
  desconto          numeric(12,2) not null default 0,
  aliquota_imposto  numeric(6,4)  not null default 0,        -- alíquota efetiva do Simples no momento da venda
  observacoes       text,
  created_at        timestamptz not null default now()
);

-- custo por item: vem do estoque (custo médio) ou digitado como na planilha (USD × dólar × (1+freteiro))
create table public.venda_itens (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default public.current_uid() references auth.users(id) on delete cascade,
  venda_id          uuid not null references public.vendas(id) on delete cascade,
  produto_id        uuid references public.produtos(id) on delete restrict,
  descricao         text,
  quantidade        integer not null check (quantidade > 0),
  preco_unit        numeric(12,2) not null check (preco_unit >= 0),       -- R$
  origem_custo      text not null default 'manual' check (origem_custo in ('manual','estoque')),
  custo_unit_moeda  numeric(12,2),     -- USD (manual)
  cambio            numeric(10,4),
  freteiro_pct      numeric(6,4),
  custo_unit_brl    numeric(12,2) not null default 0             -- custo final unitário em R$ (landed)
);

-- ---------------------------------------------------------------------
-- Ajustes de estoque (inventário, quebra, avaria, brinde…)
-- ---------------------------------------------------------------------
create table public.estoque_ajustes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default public.current_uid() references auth.users(id) on delete cascade,
  produto_id  uuid not null references public.produtos(id) on delete cascade,
  data        date not null default current_date,
  quantidade  integer not null,          -- + entra / - sai
  motivo      text not null default 'ajuste' check (motivo in ('ajuste','quebra','avaria','devolucao','brinde','inventario')),
  observacoes text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Financeiro: contas a pagar / receber e despesas fixas
-- ---------------------------------------------------------------------
create table public.lancamentos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default public.current_uid() references auth.users(id) on delete cascade,
  tipo         text not null check (tipo in ('despesa','receita')),
  categoria    text not null default 'outros'
               check (categoria in ('fornecedor','fixa','pro_labore','marketing','frete','imposto','emprestimo','parcelamento','outros')),
  descricao    text not null,
  valor        numeric(12,2) not null check (valor >= 0),
  vencimento   date not null,
  pago_em      date,
  parcela      integer,
  parcelas     integer,
  grupo_id     uuid,                       -- agrupa parcelas geradas juntas
  venda_id     uuid references public.vendas(id) on delete set null,
  compra_id    uuid references public.compras(id) on delete set null,
  observacoes  text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
create index on public.clientes(user_id);
create index on public.fornecedores(user_id);
create index on public.produtos(user_id);
create index on public.compras(user_id, data);
create index on public.compra_itens(compra_id);
create index on public.compra_itens(produto_id);
create index on public.vendas(user_id, data);
create index on public.vendas(cliente_id);
create index on public.venda_itens(venda_id);
create index on public.venda_itens(produto_id);
create index on public.estoque_ajustes(produto_id);
create index on public.lancamentos(user_id, vencimento);

-- ---------------------------------------------------------------------
-- RLS: cada usuário só vê os próprios dados
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['configuracoes','clientes','fornecedores','produtos','compras','compra_itens',
                           'vendas','venda_itens','estoque_ajustes','lancamentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "dono_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "dono_insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "dono_update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "dono_delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- =====================================================================
-- VIEWS de cálculo (security_invoker => respeitam RLS)
-- =====================================================================

-- Custo "landed" de cada item de compra:
--   compra_brl = qtd × valor × câmbio
--   freteiro   = compra_brl × freteiro_pct
--   extras     = custos_extras_brl rateado pelo valor do item
create or replace view public.vw_compra_itens with (security_invoker = true) as
with base as (
  select ci.*, c.cambio, c.freteiro_pct, c.custos_extras_brl, c.status, c.data, c.fornecedor_id,
         (ci.quantidade * ci.valor_unit_moeda * c.cambio)::numeric as compra_brl,
         sum(ci.quantidade * ci.valor_unit_moeda) over (partition by ci.compra_id) as total_moeda_compra
  from public.compra_itens ci
  join public.compras c on c.id = ci.compra_id
)
select b.id, b.user_id, b.compra_id, b.produto_id, b.descricao, b.quantidade, b.valor_unit_moeda,
       b.cambio, b.freteiro_pct, b.status, b.data, b.fornecedor_id,
       round(b.compra_brl, 2)                                           as compra_brl,
       round(b.compra_brl * b.freteiro_pct, 2)                          as freteiro_brl,
       round(case when b.total_moeda_compra > 0
                  then b.custos_extras_brl * (b.quantidade * b.valor_unit_moeda) / b.total_moeda_compra
                  else 0 end, 2)                                         as extras_brl,
       round(b.compra_brl * (1 + b.freteiro_pct)
             + case when b.total_moeda_compra > 0
                    then b.custos_extras_brl * (b.quantidade * b.valor_unit_moeda) / b.total_moeda_compra
                    else 0 end, 2)                                       as custo_total_brl
from base b;

create or replace view public.vw_compras with (security_invoker = true) as
select c.*,
       f.nome as fornecedor_nome,
       coalesce(sum(i.quantidade), 0)        as itens_qtd,
       coalesce(sum(i.quantidade * i.valor_unit_moeda), 0) as total_moeda,
       coalesce(sum(i.compra_brl), 0)        as compra_brl,
       coalesce(sum(i.freteiro_brl), 0)      as freteiro_brl,
       coalesce(sum(i.custo_total_brl), 0)   as custo_total_brl
from public.compras c
left join public.fornecedores f on f.id = c.fornecedor_id
left join public.vw_compra_itens i on i.compra_id = c.id
group by c.id, f.nome;

-- Totais da venda – mesma lógica da planilha + imposto do Simples
--   custo_total    = Σ qtd × custo_unit_brl
--   receita        = Σ qtd × preco_unit − desconto
--   despesas_total = despesas + quebras + frete_br
--   imposto        = receita × aliquota_imposto
--   lucro_liquido  = receita − custo_total − despesas_total − imposto
create or replace view public.vw_vendas with (security_invoker = true) as
with it as (
  select venda_id,
         sum(quantidade)                      as itens_qtd,
         sum(quantidade * preco_unit)         as bruto,
         sum(quantidade * custo_unit_brl)     as custo_total,
         string_agg(coalesce(p.nome, vi.descricao, '?') ||
                    case when quantidade > 1 then ' ×' || quantidade else '' end, ', ') as produtos
  from public.venda_itens vi
  left join public.produtos p on p.id = vi.produto_id
  group by venda_id
)
select v.*,
       cl.nome as cliente_nome, cl.cidade as cliente_cidade, cl.uf as cliente_uf,
       coalesce(it.itens_qtd, 0)                                  as itens_qtd,
       coalesce(it.produtos, '')                                  as produtos,
       round(coalesce(it.bruto, 0) - v.desconto, 2)               as receita,
       round(coalesce(it.custo_total, 0), 2)                      as custo_total,
       round(v.despesas + v.quebras + v.frete_br, 2)              as despesas_total,
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

-- Estoque por produto
--   recebido  = compras com status 'recebido'
--   a_caminho = compras pagas / em trânsito / alfândega / pedido
--   vendido   = itens de venda com origem_custo = 'estoque' (vendas não canceladas / não orçamento)
--               vendas "sob encomenda" (custo manual, compradas para o cliente) não mexem no estoque
--   saldo     = recebido − vendido + ajustes   (negativo = vendido em encomenda, ainda não chegou)
create or replace view public.vw_estoque with (security_invoker = true) as
with ent as (
  select produto_id,
         sum(quantidade) filter (where status = 'recebido')                                   as recebido,
         sum(quantidade) filter (where status in ('pedido','pago','em_transito','alfandega')) as a_caminho,
         sum(custo_total_brl) filter (where status <> 'cancelado')                            as custo_soma,
         sum(quantidade)      filter (where status <> 'cancelado')                            as custo_qtd
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
select p.id as produto_id, p.user_id, p.nome, p.categoria, p.marca, p.modelo, p.sku, p.preco_venda,
       p.estoque_minimo, p.ativo,
       coalesce(ent.recebido, 0)  as recebido,
       coalesce(ent.a_caminho, 0) as a_caminho,
       coalesce(sai.vendido, 0)   as vendido,
       coalesce(aj.ajustes, 0)    as ajustes,
       coalesce(ent.recebido, 0) - coalesce(sai.vendido, 0) + coalesce(aj.ajustes, 0) as saldo,
       case when coalesce(ent.custo_qtd, 0) > 0 then round(ent.custo_soma / ent.custo_qtd, 2) end as custo_medio
from public.produtos p
left join ent on ent.produto_id = p.id
left join sai on sai.produto_id = p.id
left join aj  on aj.produto_id  = p.id;

-- Resumo mensal: lucro das vendas − despesas do financeiro não ligadas a venda/compra (e fora a categoria imposto)
create or replace view public.vw_resumo_mensal with (security_invoker = true) as
with v as (
  select user_id, date_trunc('month', data)::date as mes,
         count(*) as vendas, sum(receita) as receita, sum(custo_total) as custo,
         sum(despesas_total) as despesas_vendas, sum(imposto) as imposto, sum(lucro_liquido) as lucro_vendas
  from public.vw_vendas where status not in ('cancelado','orcamento')
  group by 1, 2
), l as (
  select user_id, date_trunc('month', vencimento)::date as mes,
         sum(valor) filter (where tipo = 'despesa') as despesas_gerais,
         sum(valor) filter (where tipo = 'receita') as receitas_gerais
  from public.lancamentos
  where venda_id is null and compra_id is null
    and categoria <> 'imposto'   -- o DAS já é descontado venda a venda (vw_vendas.imposto)
  group by 1, 2
)
select coalesce(v.user_id, l.user_id) as user_id,
       coalesce(v.mes, l.mes)         as mes,
       coalesce(v.vendas, 0)          as vendas,
       coalesce(v.receita, 0)         as receita,
       coalesce(v.custo, 0)           as custo,
       coalesce(v.despesas_vendas, 0) as despesas_vendas,
       coalesce(v.imposto, 0)         as imposto,
       coalesce(v.lucro_vendas, 0)    as lucro_vendas,
       coalesce(l.despesas_gerais, 0) as despesas_gerais,
       coalesce(l.receitas_gerais, 0) as receitas_gerais,
       coalesce(v.lucro_vendas, 0) - coalesce(l.despesas_gerais, 0) + coalesce(l.receitas_gerais, 0) as resultado
from v full join l on l.user_id = v.user_id and l.mes = v.mes;

-- =====================================================================
-- Simples Nacional – Anexo I (Comércio), LC 123/2006 (redação LC 155/2016)
-- alíquota efetiva = (RBT12 × nominal − parcela a deduzir) / RBT12
-- =====================================================================
create or replace function public.aliquota_simples_anexo1(rbt12 numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case
    when rbt12 <= 0          then 0.04
    when rbt12 <= 180000     then 0.04
    when rbt12 <= 360000     then (rbt12 * 0.073 -   5940) / rbt12
    when rbt12 <= 720000     then (rbt12 * 0.095 -  13860) / rbt12
    when rbt12 <= 1800000    then (rbt12 * 0.107 -  22500) / rbt12
    when rbt12 <= 3600000    then (rbt12 * 0.143 -  87300) / rbt12
    else                          (least(rbt12, 4800000) * 0.19 - 378000) / least(rbt12, 4800000)
  end
$$;

-- RBT12 do mês informado = receita dos 12 meses anteriores (vendas no sistema + valor inicial informado)
create or replace function public.rbt12(p_mes date default current_date)
returns numeric language sql stable security invoker set search_path = '' as $$
  select coalesce((
           select sum(receita) from public.vw_vendas
           where status not in ('cancelado','orcamento')
             and data >= (date_trunc('month', p_mes) - interval '12 months')
             and data <  date_trunc('month', p_mes)
         ), 0)
       + coalesce((
           select case
                    when c.rbt12_inicial_ref is null then 0
                    -- o valor inicial vai "saindo" da janela de 12 meses proporcionalmente
                    else c.rbt12_inicial * greatest(0, 12 - (
                           (extract(year from date_trunc('month', p_mes)) - extract(year from date_trunc('month', c.rbt12_inicial_ref))) * 12
                         + (extract(month from date_trunc('month', p_mes)) - extract(month from date_trunc('month', c.rbt12_inicial_ref)))
                         ))::numeric / 12
                  end
           from public.configuracoes c where c.user_id = auth.uid()
         ), 0)
$$;

create or replace function public.aliquota_efetiva(p_mes date default current_date)
returns numeric language sql stable security invoker set search_path = '' as $$
  select case
    when c.modo_aliquota = 'fixa' then c.aliquota_fixa
    else round(public.aliquota_simples_anexo1(public.rbt12(p_mes)), 4)
  end
  from public.configuracoes c where c.user_id = auth.uid()
$$;

grant execute on function public.aliquota_simples_anexo1(numeric) to authenticated;
grant execute on function public.rbt12(date) to authenticated;
grant execute on function public.aliquota_efetiva(date) to authenticated;
