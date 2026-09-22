"""Gera supabase/seed_setembro_2026.sql a partir da planilha de controle (aba 'Vendas Setembro 2026')."""
import sys, datetime, openpyxl
src = sys.argv[1]; out = sys.argv[2]
ws = openpyxl.load_workbook(src, data_only=True).active

def d(v):
    if isinstance(v, (int, float)): return datetime.date(1899, 12, 30) + datetime.timedelta(days=int(v))
    if isinstance(v, datetime.datetime): return v.date()
    s = str(v).replace('//', '/'); dd, mm, yy = s.split('/'); return datetime.date(int(yy), int(mm), int(dd))
def q(s): return "null" if s is None else "'" + str(s).replace("'", "''").strip() + "'"
def n(v): return "0" if v in (None, '') else repr(float(v))

# nome na planilha -> (produto normalizado, categoria, previsão)
PROD = {
 'Xiaomi Ultra 6': ('Xiaomi Ultra 6','patinete','Xiaomi',None),
 'Dualtron Rovoron R7 PRO Novembro': ('Dualtron Rovoron R7 PRO','patinete','Dualtron','Novembro'),
 'Dualtron Rovoron S7 Novembro': ('Dualtron Rovoron S7','patinete','Dualtron','Novembro'),
 'Foston S09': ('Foston S09','outro','Foston',None),
 'Isian Wheel Gt4 Dual': ('Isian Wheel GT4 Dual','outro','Isian Wheel',None),
 'Xiaomi Max 6': ('Xiaomi Max 6','patinete','Xiaomi',None),
 'Foston S13 Seminovo': ('Foston S13 (seminovo)','outro','Foston',None),
 'Rovoron R7': ('Dualtron Rovoron R7','patinete','Dualtron',None),
 'Carregador Turbo 60v': ('Carregador Turbo 60V','acessorio',None,None),
}
UF = {'MT':'MT','PE':'PE','SP':'SP','RIO':'RJ','MS':'MS','PB':'PB'}
CIDADE = {'Alphaville':'Barueri','Recife':'Recife','Santo':'Santo André','Pernambuco':None}

rows = []
for r in ws.iter_rows(min_row=8, values_only=True):
    if r[2] is None or r[3] is None: continue
    rows.append(r)

L = []
L.append("-- Importação da planilha 'Vendas Setembro 2026' (gerado por scripts/gerar_seed.py)")
L.append("-- 1) Crie seu usuário no app (tela de login) 2) troque o e-mail abaixo 3) rode no SQL Editor do Supabase")
L.append("do $seed$\ndeclare\n  uid uuid := (select id from auth.users where email = 'cassiano.colombo@outlook.com');\n  vid uuid;\nbegin")
L.append("  if uid is null then raise exception 'Usuário não encontrado – cadastre-se no app primeiro'; end if;")
L.append("  insert into public.configuracoes(user_id, cambio_padrao, freteiro_pct_padrao, modo_aliquota, aliquota_fixa)\n    values (uid, 5.30, 0.40, 'auto', 0.04) on conflict (user_id) do nothing;")
L.append("  insert into public.fornecedores(user_id, nome, pais, moeda) values (uid, 'Fornecedor China (a definir)', 'China', 'USD');")
for k,(nome,cat,marca,_) in {v[0]:v for v in PROD.values()}.items():
    L.append(f"  insert into public.produtos(user_id, nome, categoria, marca) values (uid, {q(nome)}, {q(cat)}, {q(marca)});")

clientes = {}
for r in rows:
    nome = r[2].strip()
    if nome.startswith('Prejuizo'): continue
    toks = nome.split(); uf = None; cid = None
    for t in toks:
        if t.upper() in UF: uf = UF[t.upper()]
        if t in CIDADE: cid = CIDADE[t]
    if 'Recife' in nome or 'Pernambuco' in nome: uf = 'PE'
    if 'Santo Andre' in nome: uf, cid = 'SP', 'Santo André'
    clientes[nome] = (uf, cid)
for nome,(uf,cid) in clientes.items():
    L.append(f"  insert into public.clientes(user_id, nome, uf, cidade) values (uid, {q(nome)}, {q(uf)}, {q(cid)});")

for r in rows:
    dia, mes, nome, prod, qtd, usd, dolar, compra, fret, fret2, custo, venda, desp, queb, frete, _, lucro, _, nota = r
    data = d(dia)
    nome = nome.strip(); prod = prod.strip()
    if nome.startswith('Prejuizo'):
        # linha de ajuste do mês anterior: vira venda de ajuste + despesa no financeiro
        L.append(f"  insert into public.vendas(user_id, data, status, aliquota_imposto, observacoes) values (uid, '2026-09-01', 'pago', 0, 'Ajuste: {nome} – {prod} (linha 1 da planilha)') returning id into vid;")
        L.append(f"  insert into public.venda_itens(user_id, venda_id, descricao, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl) values (uid, vid, {q(prod)}, {int(qtd)}, {n(venda)}, 'manual', {n(usd)}, {n(dolar)}, {n(fret)}, round({n(usd)}*{n(dolar)}*(1+{n(fret)}),2));")
        L.append(f"  insert into public.lancamentos(user_id, tipo, categoria, descricao, valor, vencimento, pago_em) values (uid, 'despesa', 'fornecedor', 'Prejuízo agosto – pagamentos a fornecedores', {n(desp)}, '2026-09-01', '2026-09-01');")
        continue
    pnome, _, _, prev = PROD[prod]
    status = 'encomenda' if prev else 'entregue'
    L.append(f"  insert into public.vendas(user_id, cliente_id, data, status, previsao_entrega, despesas, quebras, frete_br, aliquota_imposto, observacoes)\n"
             f"    values (uid, (select id from public.clientes where user_id=uid and nome={q(nome)}), '{data}', '{status}', {q(prev)}, {n(desp)}, {n(queb)}, {n(frete)}, 0, 'Importado da planilha') returning id into vid;")
    L.append(f"  insert into public.venda_itens(user_id, venda_id, produto_id, quantidade, preco_unit, origem_custo, custo_unit_moeda, cambio, freteiro_pct, custo_unit_brl)\n"
             f"    values (uid, vid, (select id from public.produtos where user_id=uid and nome={q(pnome)}), {int(qtd)}, round({n(venda)}/{int(qtd)},2), 'manual', {n(usd)}, {n(dolar)}, {n(fret)}, round({n(usd)}*{n(dolar)}*(1+{n(fret)}),2));")

# parcelas/compromissos anotados na coluna "Prejuízo do mês"
for desc in ['Alfredo (5-3) – Produtos', 'Cassiano (1-10) – Sorento', 'Andre Xiaomi (1-6) – Produtos', 'Produtos e Processos']:
    L.append(f"  insert into public.lancamentos(user_id, tipo, categoria, descricao, valor, vencimento, observacoes) values (uid, 'despesa', 'parcelamento', {q(desc)}, 5000, '2026-09-30', 'Da coluna \"Prejuízo do mês\" da planilha – confira');")
L.append("end\n$seed$;")
open(out, 'w').write("\n".join(L) + "\n")
print(len(rows), 'linhas')
