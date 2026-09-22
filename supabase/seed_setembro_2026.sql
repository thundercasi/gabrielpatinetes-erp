-- Importação da planilha 'Vendas Setembro 2026' (gerado por scripts/gerar_seed.py)
-- 1) Crie seu usuário no app (tela de login) 2) troque o e-mail abaixo 3) rode no SQL Editor do Supabase
do $seed$
declare
  uid uuid := (select id from auth.users where email = 'cassiano.colombo@outlook.com');
  vid uuid;
begin
  if uid is null then raise exception 'Usuário não encontrado – cadastre-se no app primeiro'; end if;
  insert into public.configuracoes(user_id, cambio_padrao, freteiro_pct_padrao, modo_aliquota, aliquota_fixa)
    values (uid, 5.30, 0.40, 'auto', 0.04) on conflict (user_id) do nothing;
  insert into public.fornecedores(user_id, nome, pais, moeda) values (uid, 'Fornecedor China (a definir)', 'China', 'USD');
  insert into public.produtos(user_id, nome, categoria, marca) values (uid, 'Xiaomi Ultra 6', 'patinete', 'Xiaomi');
  insert into public.produtos(user_id, nome, categoria, marca) values (uid, 'Dualtron Rovoron R7 PRO', 'patinete', 'Dualtron');
  insert into public.produtos(user_id, nome, categoria, marca) values (uid, 'Dualtron Rovoron S7', 'patinete', 'Dualtron');
  insert into public.produtos(user_id, nome, categoria, marca) values (uid, 'Foston S09', 'outro', 'Foston');
  insert into public.produtos(user_id, nome, categoria, marca) values (uid, 'Isian Wheel GT4 Dual', 'outro', 'Isian Wheel');
  insert into public.produtos(user_id, nome, categoria, marca) values (uid, 'Xiaomi Max 6', 'patinete', 'Xiaomi');
  insert into public.produtos(user_id, nome, categoria, marca) values (uid, 'Foston S13 (seminovo)', 'outro', 'Foston');
  insert into public.produtos(user_id, nome, categoria, marca) values (uid, 'Dualtron Rovoron R7', 'patinete', 'Dualtron');
  insert into public.produtos(user_id, nome, categoria, marca) values (uid, 'Carregador Turbo 60V', 'acessorio', null);
  insert into public.clientes(user_id, nome, uf, cidade) values (uid, 'Denilson MT', 'MT', null);
  insert into public.clientes(user_id, nome, uf, cidade) values (uid, 'Wallyta Pernambuco PE', 'PE', null);
  insert into public.clientes(user_id, nome, uf, cidade) values (uid, 'Lucas C.S', null, null);
  insert into public.clientes(user_id, nome, uf, cidade) values (uid, 'Mariano SP Alphaville', 'SP', 'Barueri');
  insert into public.clientes(user_id, nome, uf, cidade) values (uid, 'Renato Tukler RIO', 'RJ', null);
  insert into public.clientes(user_id, nome, uf, cidade) values (uid, 'Claudinei MS', 'MS', null);
  insert into public.clientes(user_id, nome, uf, cidade) values (uid, 'Leo Amigo Andre Tecnico', null, null);
  insert into public.clientes(user_id, nome, uf, cidade) values (uid, 'Gabriel Santo Andre', 'SP', 'Santo André');
  insert into public.clientes(user_id, nome, uf, cidade) values (uid, 'Caique SP', 'SP', null);
  insert into public.clientes(user_id, nome, uf, cidade) values (uid, 'Danielle Saraiva', null, null);
  insert into public.clientes(user_id, nome, uf, cidade) values (uid, 'Namma PB', 'PB', null);
  insert into public.clientes(user_id, nome, uf, cidade) values (uid, 'Elder Passos Recife', 'PE', 'Recife');
  insert into public.vendas(user_id, data, status, aliquota_imposto, observacoes) values (uid, '2026-09-01', 'pago', 0, 'Ajuste: Prejuizo Agosto – Pagamentos Fornecedores (linha 1 da planilha)') returning id into vid;
  insert into public.venda_itens(user_id, venda_id, descricao, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl) values (uid, vid, 'Pagamentos Fornecedores', 1, 7500.0, 'manual', 1000.0, 5.6, 0.4, round(1000.0*5.6*(1+0.4),2));
  insert into public.lancamentos(user_id, tipo, categoria, descricao, valor, vencimento, pago_em) values (uid, 'despesa', 'fornecedor', 'Prejuízo agosto – pagamentos a fornecedores', 48000.0, '2026-09-01', '2026-09-01');
  insert into public.vendas(user_id, cliente_id, data, status, previsao_entrega, despesas, quebras, frete_br, aliquota_imposto, observacoes)
    values (uid, (select id from public.clientes where user_id=uid and nome='Denilson MT'), '2026-09-01', 'entregue', null, 2000.0, 700.0, 700.0, 0, 'Importado da planilha') returning id into vid;
  insert into public.venda_itens(user_id, venda_id, produto_id, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl)
    values (uid, vid, (select id from public.produtos where user_id=uid and nome='Xiaomi Ultra 6'), 1, round(7900.0/1,2), 'manual', 695.0, 5.3, 0.4, round(695.0*5.3*(1+0.4),2));
  insert into public.vendas(user_id, cliente_id, data, status, previsao_entrega, despesas, quebras, frete_br, aliquota_imposto, observacoes)
    values (uid, (select id from public.clientes where user_id=uid and nome='Wallyta Pernambuco PE'), '2026-09-01', 'encomenda', 'Novembro', 60.0, 0, 0, 0, 'Importado da planilha') returning id into vid;
  insert into public.venda_itens(user_id, venda_id, produto_id, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl)
    values (uid, vid, (select id from public.produtos where user_id=uid and nome='Dualtron Rovoron R7 PRO'), 1, round(17900.0/1,2), 'manual', 2000.0, 5.3, 0.4, round(2000.0*5.3*(1+0.4),2));
  insert into public.vendas(user_id, cliente_id, data, status, previsao_entrega, despesas, quebras, frete_br, aliquota_imposto, observacoes)
    values (uid, (select id from public.clientes where user_id=uid and nome='Lucas C.S'), '2026-09-04', 'encomenda', 'Novembro', 0, 640.0, 0, 0, 'Importado da planilha') returning id into vid;
  insert into public.venda_itens(user_id, venda_id, produto_id, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl)
    values (uid, vid, (select id from public.produtos where user_id=uid and nome='Dualtron Rovoron S7'), 1, round(27900.0/1,2), 'manual', 3000.0, 5.3, 0.4, round(3000.0*5.3*(1+0.4),2));
  insert into public.vendas(user_id, cliente_id, data, status, previsao_entrega, despesas, quebras, frete_br, aliquota_imposto, observacoes)
    values (uid, (select id from public.clientes where user_id=uid and nome='Mariano SP Alphaville'), '2026-09-05', 'entregue', null, 0, 0, 0, 0, 'Importado da planilha') returning id into vid;
  insert into public.venda_itens(user_id, venda_id, produto_id, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl)
    values (uid, vid, (select id from public.produtos where user_id=uid and nome='Foston S09'), 2, round(4500.0/2,2), 'manual', 228.0, 5.3, 0.4, round(228.0*5.3*(1+0.4),2));
  insert into public.vendas(user_id, cliente_id, data, status, previsao_entrega, despesas, quebras, frete_br, aliquota_imposto, observacoes)
    values (uid, (select id from public.clientes where user_id=uid and nome='Renato Tukler RIO'), '2026-09-09', 'entregue', null, 0, 600.0, 0, 0, 'Importado da planilha') returning id into vid;
  insert into public.venda_itens(user_id, venda_id, produto_id, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl)
    values (uid, vid, (select id from public.produtos where user_id=uid and nome='Isian Wheel GT4 Dual'), 1, round(7900.0/1,2), 'manual', 800.0, 5.3, 0.4, round(800.0*5.3*(1+0.4),2));
  insert into public.vendas(user_id, cliente_id, data, status, previsao_entrega, despesas, quebras, frete_br, aliquota_imposto, observacoes)
    values (uid, (select id from public.clientes where user_id=uid and nome='Claudinei MS'), '2026-09-12', 'entregue', null, 0, 0, 0, 0, 'Importado da planilha') returning id into vid;
  insert into public.venda_itens(user_id, venda_id, produto_id, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl)
    values (uid, vid, (select id from public.produtos where user_id=uid and nome='Xiaomi Max 6'), 1, round(5900.0/1,2), 'manual', 525.0, 5.3, 0.4, round(525.0*5.3*(1+0.4),2));
  insert into public.vendas(user_id, cliente_id, data, status, previsao_entrega, despesas, quebras, frete_br, aliquota_imposto, observacoes)
    values (uid, (select id from public.clientes where user_id=uid and nome='Leo Amigo Andre Tecnico'), '2026-09-12', 'entregue', null, 0, 1500.0, 0, 0, 'Importado da planilha') returning id into vid;
  insert into public.venda_itens(user_id, venda_id, produto_id, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl)
    values (uid, vid, (select id from public.produtos where user_id=uid and nome='Foston S13 (seminovo)'), 1, round(4500.0/1,2), 'manual', 200.0, 5.3, 0.4, round(200.0*5.3*(1+0.4),2));
  insert into public.vendas(user_id, cliente_id, data, status, previsao_entrega, despesas, quebras, frete_br, aliquota_imposto, observacoes)
    values (uid, (select id from public.clientes where user_id=uid and nome='Gabriel Santo Andre'), '2026-09-14', 'entregue', null, 0, 100.0, 0, 0, 'Importado da planilha') returning id into vid;
  insert into public.venda_itens(user_id, venda_id, produto_id, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl)
    values (uid, vid, (select id from public.produtos where user_id=uid and nome='Dualtron Rovoron R7'), 1, round(15900.0/1,2), 'manual', 1860.0, 5.3, 0.4, round(1860.0*5.3*(1+0.4),2));
  insert into public.vendas(user_id, cliente_id, data, status, previsao_entrega, despesas, quebras, frete_br, aliquota_imposto, observacoes)
    values (uid, (select id from public.clientes where user_id=uid and nome='Caique SP'), '2026-09-17', 'entregue', null, 0, 100.0, 0, 0, 'Importado da planilha') returning id into vid;
  insert into public.venda_itens(user_id, venda_id, produto_id, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl)
    values (uid, vid, (select id from public.produtos where user_id=uid and nome='Carregador Turbo 60V'), 1, round(2225.0/1,2), 'manual', 99.0, 5.3, 0.4, round(99.0*5.3*(1+0.4),2));
  insert into public.vendas(user_id, cliente_id, data, status, previsao_entrega, despesas, quebras, frete_br, aliquota_imposto, observacoes)
    values (uid, (select id from public.clientes where user_id=uid and nome='Danielle Saraiva'), '2026-09-18', 'entregue', null, 0, 0, 0, 0, 'Importado da planilha') returning id into vid;
  insert into public.venda_itens(user_id, venda_id, produto_id, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl)
    values (uid, vid, (select id from public.produtos where user_id=uid and nome='Foston S09'), 6, round(12900.0/6,2), 'manual', 235.0, 5.3, 0.4, round(235.0*5.3*(1+0.4),2));
  insert into public.vendas(user_id, cliente_id, data, status, previsao_entrega, despesas, quebras, frete_br, aliquota_imposto, observacoes)
    values (uid, (select id from public.clientes where user_id=uid and nome='Namma PB'), '2026-09-18', 'entregue', null, 0, 0, 0, 0, 'Importado da planilha') returning id into vid;
  insert into public.venda_itens(user_id, venda_id, produto_id, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl)
    values (uid, vid, (select id from public.produtos where user_id=uid and nome='Dualtron Rovoron R7'), 1, round(16900.0/1,2), 'manual', 1860.0, 5.3, 0.4, round(1860.0*5.3*(1+0.4),2));
  insert into public.vendas(user_id, cliente_id, data, status, previsao_entrega, despesas, quebras, frete_br, aliquota_imposto, observacoes)
    values (uid, (select id from public.clientes where user_id=uid and nome='Elder Passos Recife'), '2026-09-19', 'encomenda', 'Novembro', 0, 0, 0, 0, 'Importado da planilha') returning id into vid;
  insert into public.venda_itens(user_id, venda_id, produto_id, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl)
    values (uid, vid, (select id from public.produtos where user_id=uid and nome='Dualtron Rovoron R7 PRO'), 1, round(16900.0/1,2), 'manual', 1860.0, 5.3, 0.4, round(1860.0*5.3*(1+0.4),2));
  insert into public.lancamentos(user_id, tipo, categoria, descricao, valor, vencimento, observacoes) values (uid, 'despesa', 'parcelamento', 'Alfredo (5-3) – Produtos', 5000, '2026-09-30', 'Da coluna "Prejuízo do mês" da planilha – confira');
  insert into public.lancamentos(user_id, tipo, categoria, descricao, valor, vencimento, observacoes) values (uid, 'despesa', 'parcelamento', 'Cassiano (1-10) – Sorento', 5000, '2026-09-30', 'Da coluna "Prejuízo do mês" da planilha – confira');
  insert into public.lancamentos(user_id, tipo, categoria, descricao, valor, vencimento, observacoes) values (uid, 'despesa', 'parcelamento', 'Andre Xiaomi (1-6) – Produtos', 5000, '2026-09-30', 'Da coluna "Prejuízo do mês" da planilha – confira');
  insert into public.lancamentos(user_id, tipo, categoria, descricao, valor, vencimento, observacoes) values (uid, 'despesa', 'parcelamento', 'Produtos e Processos', 5000, '2026-09-30', 'Da coluna "Prejuízo do mês" da planilha – confira');
end
$seed$;
