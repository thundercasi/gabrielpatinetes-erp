// Mesmas fórmulas das views SQL (vw_vendas / vw_compra_itens) – usadas para pré-visualizar nos formulários.
import type { CompraItem, VendaItem } from './types'

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** custo unitário "landed" como na planilha: USD × dólar × (1 + freteiro) */
export const custoUnitManual = (usd: number, cambio: number, freteiroPct: number) => r2(usd * cambio * (1 + freteiroPct))

export interface TotaisVenda {
  bruto: number; receita: number; custo: number; despesasTotal: number; imposto: number; lucro: number; margem: number | null
}
export function totaisVenda(
  itens: Pick<VendaItem, 'quantidade' | 'preco_unit' | 'custo_unit_brl'>[],
  v: { despesas: number; quebras: number; frete_br: number; desconto: number; aliquota_imposto: number },
): TotaisVenda {
  const bruto = itens.reduce((s, i) => s + i.quantidade * i.preco_unit, 0)
  const custo = itens.reduce((s, i) => s + i.quantidade * i.custo_unit_brl, 0)
  const receita = bruto - v.desconto
  const despesasTotal = v.despesas + v.quebras + v.frete_br
  const imposto = receita * v.aliquota_imposto
  const lucro = receita - custo - despesasTotal - imposto
  return {
    bruto: r2(bruto), receita: r2(receita), custo: r2(custo), despesasTotal: r2(despesasTotal),
    imposto: r2(imposto), lucro: r2(lucro), margem: receita > 0 ? lucro / receita : null,
  }
}

export interface LinhaCompra { compraBRL: number; freteiro: number; extras: number; custoTotal: number; custoUnit: number }
export function custosCompra(
  itens: Pick<CompraItem, 'quantidade' | 'valor_unit_moeda'>[],
  c: { cambio: number; freteiro_pct: number; custos_extras_brl: number },
): { linhas: LinhaCompra[]; total: LinhaCompra & { totalMoeda: number } } {
  const totalMoeda = itens.reduce((s, i) => s + i.quantidade * i.valor_unit_moeda, 0)
  const linhas = itens.map((i) => {
    const moeda = i.quantidade * i.valor_unit_moeda
    const compraBRL = moeda * c.cambio
    const freteiro = compraBRL * c.freteiro_pct
    const extras = totalMoeda > 0 ? (c.custos_extras_brl * moeda) / totalMoeda : 0
    const custoTotal = compraBRL + freteiro + extras
    return { compraBRL: r2(compraBRL), freteiro: r2(freteiro), extras: r2(extras), custoTotal: r2(custoTotal), custoUnit: i.quantidade ? r2(custoTotal / i.quantidade) : 0 }
  })
  const soma = (k: keyof LinhaCompra) => r2(linhas.reduce((s, l) => s + l[k], 0))
  return { linhas, total: { compraBRL: soma('compraBRL'), freteiro: soma('freteiro'), extras: soma('extras'), custoTotal: soma('custoTotal'), custoUnit: 0, totalMoeda: r2(totalMoeda) } }
}

// ---------------- Simples Nacional – Anexo I (Comércio) ----------------
export const FAIXAS_ANEXO_I = [
  { ate: 180_000, nominal: 0.04, deduzir: 0 },
  { ate: 360_000, nominal: 0.073, deduzir: 5_940 },
  { ate: 720_000, nominal: 0.095, deduzir: 13_860 },
  { ate: 1_800_000, nominal: 0.107, deduzir: 22_500 },
  { ate: 3_600_000, nominal: 0.143, deduzir: 87_300 },
  { ate: 4_800_000, nominal: 0.19, deduzir: 378_000 },
]
export function aliquotaEfetivaAnexoI(rbt12: number) {
  if (rbt12 <= 180_000) return 0.04
  const base = Math.min(rbt12, 4_800_000)
  const f = FAIXAS_ANEXO_I.find((x) => base <= x.ate) ?? FAIXAS_ANEXO_I[5]
  return (base * f.nominal - f.deduzir) / base
}
