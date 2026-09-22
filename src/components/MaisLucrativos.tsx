import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Empty } from './ui'
import { fmtBRL, fmtPct } from '../lib/format'

type Periodo = 'mes' | 'trimestre' | 'semestre' | 'ano'
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Período de calendário que contém o mês escolhido no Painel. */
function intervalo(ym: string, p: Periodo) {
  const [y, m] = ym.split('-').map(Number)
  const tam = p === 'mes' ? 1 : p === 'trimestre' ? 3 : p === 'semestre' ? 6 : 12
  const ini = Math.floor((m - 1) / tam) * tam + 1
  const fim = ini + tam - 1
  const ultimo = new Date(Date.UTC(y, fim, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const rotulo =
    p === 'mes' ? `${MESES[m - 1]}/${y}`
    : p === 'trimestre' ? `${ini === 1 ? 1 : ini === 4 ? 2 : ini === 7 ? 3 : 4}º trimestre ${y} (${MESES[ini - 1]}–${MESES[fim - 1]})`
    : p === 'semestre' ? `${ini === 1 ? 1 : 2}º semestre ${y} (${MESES[ini - 1]}–${MESES[fim - 1]})`
    : `ano ${y}`
  return { de: `${y}-${pad(ini)}-01`, ate: `${y}-${pad(fim)}-${pad(ultimo)}`, rotulo }
}

interface ItemRow {
  venda_id: string; quantidade: number; preco_unit: number; custo_unit_brl: number; descricao: string | null
  produtos: { nome: string } | null
  vendas: { despesas: number; quebras: number; frete_br: number; desconto: number; aliquota_imposto: number }
}
interface Linha { nome: string; qtd: number; receita: number; lucro: number }

export default function MaisLucrativos({ mes }: { mes: string }) {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const { de, ate, rotulo } = useMemo(() => intervalo(mes, periodo), [mes, periodo])

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    supabase.from('venda_itens')
      .select('venda_id, quantidade, preco_unit, custo_unit_brl, descricao, produtos(nome), vendas!inner(data, status, despesas, quebras, frete_br, desconto, aliquota_imposto)')
      .gte('vendas.data', de).lte('vendas.data', ate)
      .not('vendas.status', 'in', '(cancelado,orcamento)')
      .range(0, 9999)
      .then(({ data }) => {
        if (!ativo) return
        const itens = (data ?? []) as unknown as ItemRow[]
        // bruto de cada venda, para ratear despesas, desconto e imposto entre os itens
        const brutoVenda = new Map<string, number>()
        for (const i of itens) brutoVenda.set(i.venda_id, (brutoVenda.get(i.venda_id) ?? 0) + i.quantidade * Number(i.preco_unit))
        const porProduto = new Map<string, Linha>()
        for (const i of itens) {
          const v = i.vendas
          const bruto = i.quantidade * Number(i.preco_unit)
          const totalVenda = brutoVenda.get(i.venda_id) ?? 0
          const parte = totalVenda > 0 ? bruto / totalVenda : 0
          const receita = bruto - Number(v.desconto) * parte
          const extras = (Number(v.despesas) + Number(v.quebras) + Number(v.frete_br)) * parte
          const imposto = receita * Number(v.aliquota_imposto)
          const lucro = receita - i.quantidade * Number(i.custo_unit_brl) - extras - imposto
          const nome = i.produtos?.nome ?? i.descricao ?? '(sem produto)'
          const l = porProduto.get(nome) ?? { nome, qtd: 0, receita: 0, lucro: 0 }
          l.qtd += i.quantidade; l.receita += receita; l.lucro += lucro
          porProduto.set(nome, l)
        }
        setLinhas([...porProduto.values()].sort((a, b) => b.lucro - a.lucro).slice(0, 8))
        setCarregando(false)
      })
    return () => { ativo = false }
  }, [de, ate])

  return (
    <section className="card p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Mais lucrativos no período</h2>
        <select className="input w-32 py-1 text-xs" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
          <option value="mes">Mês</option>
          <option value="trimestre">Trimestre</option>
          <option value="semestre">Semestre</option>
          <option value="ano">Ano</option>
        </select>
      </div>
      <div className="mb-2 text-xs text-slate-500">{rotulo}</div>
      {carregando ? <Empty>Carregando…</Empty> : linhas.length ? (
        <ul className="divide-y divide-slate-100 text-sm">
          {linhas.map((l) => (
            <li key={l.nome} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="block truncate" title={l.nome}>{l.nome}</span>
                <span className="text-xs text-slate-400">{l.qtd} un · margem {fmtPct(l.receita ? l.lucro / l.receita : null)}</span>
              </span>
              <span className={`shrink-0 tabular-nums ${l.lucro < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmtBRL(l.lucro)}</span>
            </li>
          ))}
        </ul>
      ) : <Empty>Sem vendas no período.</Empty>}
    </section>
  )
}
