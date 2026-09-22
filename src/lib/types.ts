export type Categoria = 'patinete' | 'bicicleta' | 'moto' | 'drone' | 'monociclo' | 'skate' | 'acessorio' | 'peca' | 'outro'
export const CATEGORIAS: Record<Categoria, string> = {
  patinete: 'Patinete', bicicleta: 'Bicicleta', moto: 'Moto', drone: 'Drone', monociclo: 'Monociclo',
  skate: 'Skate', acessorio: 'Acessório', peca: 'Peça', outro: 'Outro',
}

export type StatusVenda = 'orcamento' | 'encomenda' | 'pago' | 'enviado' | 'entregue' | 'cancelado'
export const STATUS_VENDA: Record<StatusVenda, { label: string; cor: string }> = {
  orcamento: { label: 'Orçamento', cor: 'bg-slate-100 text-slate-600' },
  encomenda: { label: 'Encomenda', cor: 'bg-amber-100 text-amber-800' },
  pago: { label: 'Pago', cor: 'bg-sky-100 text-sky-800' },
  enviado: { label: 'Enviado', cor: 'bg-indigo-100 text-indigo-800' },
  entregue: { label: 'Entregue', cor: 'bg-emerald-100 text-emerald-800' },
  cancelado: { label: 'Cancelado', cor: 'bg-red-100 text-red-700' },
}

export type StatusCompra = 'pedido' | 'pago' | 'em_transito' | 'alfandega' | 'recebido' | 'cancelado'
export const STATUS_COMPRA: Record<StatusCompra, { label: string; cor: string }> = {
  pedido: { label: 'Pedido', cor: 'bg-slate-100 text-slate-700' },
  pago: { label: 'Pago', cor: 'bg-sky-100 text-sky-800' },
  em_transito: { label: 'Em trânsito', cor: 'bg-indigo-100 text-indigo-800' },
  alfandega: { label: 'Alfândega', cor: 'bg-amber-100 text-amber-800' },
  recebido: { label: 'Recebido', cor: 'bg-emerald-100 text-emerald-800' },
  cancelado: { label: 'Cancelado', cor: 'bg-red-100 text-red-700' },
}

export const CATEGORIAS_LANC: Record<string, string> = {
  fornecedor: 'Fornecedor', fixa: 'Despesa fixa', pro_labore: 'Pró-labore', marketing: 'Marketing', frete: 'Frete',
  imposto: 'Imposto (DAS – já no lucro)', emprestimo: 'Empréstimo', parcelamento: 'Parcelamento', outros: 'Outros',
}

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export interface Cliente { id: string; nome: string; cpf_cnpj: string | null; telefone: string | null; email: string | null; cidade: string | null; uf: string | null; endereco: string | null; observacoes: string | null }
export interface Fornecedor { id: string; nome: string; pais: string | null; moeda: string; contato: string | null; telefone: string | null; email: string | null; observacoes: string | null }
export interface Produto { id: string; nome: string; categoria: Categoria; marca: string | null; modelo: string | null; sku: string | null; custo_ref_moeda: number | null; preco_venda: number | null; estoque_minimo: number; ativo: boolean; observacoes: string | null }

export interface Config {
  user_id: string; nome_empresa: string | null; cnpj: string | null
  cambio_padrao: number; freteiro_pct_padrao: number
  modo_aliquota: 'auto' | 'fixa'; aliquota_fixa: number; rbt12_inicial: number; rbt12_inicial_ref: string | null
}

export interface Venda {
  id: string; cliente_id: string | null; data: string; status: StatusVenda; previsao_entrega: string | null
  forma_pagamento: string | null; despesas: number; quebras: number; frete_br: number; desconto: number
  aliquota_imposto: number; observacoes: string | null
}
export interface VendaView extends Venda {
  cliente_nome: string | null; cliente_cidade: string | null; cliente_uf: string | null; itens_qtd: number; produtos: string
  receita: number; custo_total: number; despesas_total: number; imposto: number; lucro_liquido: number; margem: number | null
}
export interface VendaItem {
  id?: string; venda_id?: string; produto_id: string | null; descricao: string | null; quantidade: number; preco_unit: number
  origem_custo: 'manual' | 'estoque'; custo_unit_moeda: number | null; cambio: number | null; freteiro_pct: number | null; custo_unit_brl: number
}

export interface Compra {
  id: string; fornecedor_id: string | null; data: string; tipo: 'importacao' | 'nacional'; moeda: string; cambio: number
  freteiro_pct: number; custos_extras_brl: number; status: StatusCompra; previsao_chegada: string | null; recebido_em: string | null
  rastreio: string | null; observacoes: string | null
}
export interface CompraView extends Compra { fornecedor_nome: string | null; itens_qtd: number; total_moeda: number; compra_brl: number; freteiro_brl: number; custo_total_brl: number }
export interface CompraItem { id?: string; compra_id?: string; produto_id: string | null; descricao: string | null; quantidade: number; valor_unit_moeda: number }

export interface EstoqueView {
  produto_id: string; nome: string; categoria: Categoria; marca: string | null; modelo: string | null; sku: string | null; preco_venda: number | null
  estoque_minimo: number; ativo: boolean; recebido: number; a_caminho: number; vendido: number; ajustes: number; saldo: number; custo_medio: number | null
}

export interface Lancamento {
  id: string; tipo: 'despesa' | 'receita'; categoria: string; descricao: string; valor: number; vencimento: string; pago_em: string | null
  parcela: number | null; parcelas: number | null; grupo_id: string | null; venda_id: string | null; compra_id: string | null; observacoes: string | null
}

export interface ResumoMensal {
  mes: string; vendas: number; receita: number; custo: number; despesas_vendas: number; imposto: number; lucro_vendas: number
  despesas_gerais: number; receitas_gerais: number; resultado: number
}
