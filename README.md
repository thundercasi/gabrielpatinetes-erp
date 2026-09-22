# GabrielPatinetes ERP

Sistema de compra, importação e revenda de elétricos (patinetes, bikes, drones, motos, acessórios) para empresa no Simples Nacional.
React + TypeScript + Vite + Tailwind + Supabase.

## Módulos

| Tela | O que faz |
|---|---|
| **Painel** | Faturamento, lucro, Simples, despesas e resultado do mês; gráfico de 6 meses; encomendas a entregar, importações a caminho, contas a vencer |
| **Vendas** | Mesma lógica da planilha: `Custo = USD × Dólar × (1 + Freteiro)`, `Lucro = Venda − Custo − (Despesas + Quebras + Frete BR) − Simples`. Item pode ser **sob encomenda** (custo digitado em USD) ou **do estoque** (custo médio). Cliente novo é criado ao digitar o nome. |
| **Compras / Importação** | Pedido ao fornecedor com moeda, câmbio, % freteiro e custos extras (rateados). Status pedido → pago → em trânsito → alfândega → recebido. Pode gerar a conta a pagar. |
| **Estoque** | Saldo = compras recebidas − vendas "do estoque" ± ajustes; custo médio; a caminho; estoque mínimo |
| **Financeiro** | Contas a pagar/receber, despesas fixas mensais, parcelamentos (1/N), DAS do mês, DRE simplificada do mês |
| **Cadastros** | Produtos (categoria, marca, custo ref. USD, preço), Clientes (cidade/UF), Fornecedores (país, moeda) |
| **Configurações** | Dólar e freteiro padrão; Simples automático pelo RBT12 (Anexo I) ou alíquota fixa do contador |

## Instalação

1. **Crie um projeto novo no Supabase** (separado do LaserToolsERP).
2. No **SQL Editor**, rode `supabase/migrations/20260922000000_schema.sql`.
3. Copie `.env.example` para `.env` e preencha com a URL e a chave *anon/publishable* (Project Settings → API).
4. `npm install` e `npm run dev` → abra http://localhost:5173
5. Clique em **Criar conta**. (Para não precisar confirmar e-mail: Authentication → Providers → Email → desative "Confirm email".)
6. **Importar a planilha de setembro** (opcional): no SQL Editor rode `supabase/seed_setembro_2026.sql` (o e-mail do usuário está no topo do arquivo).
7. Em **Configurações**, informe o faturamento dos 12 meses anteriores e o mês em que começou a usar o sistema, para o cálculo do Simples.

### Publicar
Vercel ou Netlify: build `npm run build`, pasta `dist`, variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. (`vercel.json` e `public/_redirects` já tratam as rotas.)

## Regras de cálculo

- **Custo landed da compra**: `qtd × valor × câmbio × (1 + freteiro%) + extras rateados pelo valor`.
- **Simples (Anexo I – Comércio)**: alíquota efetiva `(RBT12 × nominal − parcela a deduzir) / RBT12`, gravada em cada venda no momento do lançamento (dá para editar). Confirme com seu contador: produtos com ICMS-ST/monofásicos reduzem o DAS.
- **Resultado do mês** = lucro das vendas − despesas do financeiro (exceto as ligadas a uma compra e a categoria Imposto, que já estão no lucro das vendas) + outras receitas.
- Todos os cálculos ficam em views no banco (`vw_vendas`, `vw_compras`, `vw_estoque`, `vw_resumo_mensal`) e são espelhados em `src/lib/calc.ts` para a pré-visualização nos formulários.
- Segurança: RLS em todas as tabelas — cada usuário só vê os próprios dados.

## Estrutura
```
supabase/migrations/   schema, views, RLS, funções do Simples
supabase/seed_*.sql     importação da planilha
scripts/gerar_seed.py   gera o seed a partir de um .xlsx no mesmo formato
src/lib/                cliente Supabase, tipos, cálculos, formatação
src/pages/              telas
```
