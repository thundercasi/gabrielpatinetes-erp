import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { useTable } from '../lib/useData'
import { useApp } from '../lib/AppContext'
import { Badge, Empty, MonthPicker, PageHeader, Stat } from '../components/ui'
import { STATUS_COMPRA, STATUS_VENDA, type CompraView, type EstoqueView, type Lancamento, type ResumoMensal, type VendaView } from '../lib/types'
import { addMeses, fimMes, fmtBRL, fmtData, fmtPct, hojeISO, inicioMes, mesAtual, nomeMes } from '../lib/format'

const moedaCurta = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : String(v))

export default function Dashboard() {
  const [mes, setMes] = useState(mesAtual())
  const { aliquotaAtual, rbt12Atual } = useApp()
  const vendas = useTable<VendaView>('vw_vendas', (q) => q.gte('data', inicioMes(mes)).lte('data', fimMes(mes)).not('status', 'in', '(cancelado,orcamento)'), [mes])
  const resumo = useTable<ResumoMensal>('vw_resumo_mensal', (q) => q.gte('mes', addMeses(inicioMes(mes), -5)).lte('mes', inicioMes(mes)).order('mes'), [mes])
  const [encomendas, setEncomendas] = useState<VendaView[]>([])
  const [compras, setCompras] = useState<CompraView[]>([])
  const [baixos, setBaixos] = useState<EstoqueView[]>([])
  const [contas, setContas] = useState<Lancamento[]>([])

  useEffect(() => {
    supabase.from('vw_vendas').select('*').eq('status', 'encomenda').order('data').then(({ data }) => setEncomendas((data ?? []) as VendaView[]))
    supabase.from('vw_compras').select('*').not('status', 'in', '(recebido,cancelado)').order('previsao_chegada').then(({ data }) => setCompras((data ?? []) as CompraView[]))
    supabase.from('vw_estoque').select('*').eq('ativo', true).gt('estoque_minimo', 0).then(({ data }) => setBaixos(((data ?? []) as EstoqueView[]).filter((e) => e.saldo <= e.estoque_minimo)))
    supabase.from('lancamentos').select('*').is('pago_em', null).eq('tipo', 'despesa').lte('vencimento', fimMes(mesAtual())).order('vencimento').limit(8)
      .then(({ data }) => setContas((data ?? []) as Lancamento[]))
  }, [])

  const r = resumo.data.find((x) => x.mes === inicioMes(mes))
  const v = vendas.data
  const receita = v.reduce((s, x) => s + Number(x.receita), 0)
  const lucroVendas = v.reduce((s, x) => s + Number(x.lucro_liquido), 0)
  const ticket = v.length ? receita / v.length : 0

  const serie = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const m = addMeses(inicioMes(mes), i - 5)
    const x = resumo.data.find((y) => y.mes === m)
    return { mes: nomeMes(m.slice(0, 7)).slice(0, 3), Faturamento: Number(x?.receita ?? 0), Lucro: Number(x?.lucro_vendas ?? 0), Resultado: Number(x?.resultado ?? 0) }
  }), [resumo.data, mes])

  const topProdutos = useMemo(() => {
    const m = new Map<string, { receita: number; lucro: number; n: number }>()
    for (const x of v) {
      const k = x.produtos || '—'
      const a = m.get(k) ?? { receita: 0, lucro: 0, n: 0 }
      a.receita += Number(x.receita); a.lucro += Number(x.lucro_liquido); a.n += 1
      m.set(k, a)
    }
    return [...m.entries()].sort((a, b) => b[1].lucro - a[1].lucro).slice(0, 6)
  }, [v])

  return (
    <>
      <PageHeader title="Painel" subtitle={`Visão de ${nomeMes(mes)}`} actions={<MonthPicker value={mes} onChange={setMes} />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Faturamento" value={fmtBRL(receita)} hint={`${v.length} vendas · ticket ${fmtBRL(ticket)}`} />
        <Stat label="Lucro das vendas" value={fmtBRL(lucroVendas)} tone={lucroVendas < 0 ? 'neg' : 'pos'} hint={`margem ${fmtPct(receita ? lucroVendas / receita : null)}`} />
        <Stat label="Simples do mês" value={fmtBRL(r?.imposto)} hint={`alíquota atual ${fmtPct(aliquotaAtual, 2)}`} />
        <Stat label="Despesas gerais" value={fmtBRL(r?.despesas_gerais)} hint="fixas, parcelas, pró-labore" />
        <Stat label="Resultado do mês" value={fmtBRL(r?.resultado)} tone={Number(r?.resultado ?? 0) < 0 ? 'neg' : 'pos'} hint={`RBT12 ${fmtBRL(rbt12Atual)}`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold">Últimos 6 meses</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={moedaCurta} tickLine={false} axisLine={false} fontSize={12} width={56} />
                <Tooltip formatter={(val) => fmtBRL(Number(val))} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="Faturamento" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Lucro" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Resultado" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-semibold">Mais lucrativos no mês</h2>
          {topProdutos.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {topProdutos.map(([nome, a]) => (
                <li key={nome} className="flex items-center justify-between gap-2 py-2">
                  <span className="truncate" title={nome}>{nome}<span className="ml-1 text-xs text-slate-400">×{a.n}</span></span>
                  <span className={`shrink-0 tabular-nums ${a.lucro < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmtBRL(a.lucro)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>Sem vendas no mês.</Empty>}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Painel titulo="Encomendas a entregar" link="/vendas" vazio="Nenhuma encomenda pendente.">
          {encomendas.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0"><div className="truncate font-medium">{e.cliente_nome ?? '—'}</div><div className="truncate text-xs text-slate-500">{e.produtos}</div></div>
              <Badge className={STATUS_VENDA.encomenda.cor}>{e.previsao_entrega ?? fmtData(e.data)}</Badge>
            </li>
          ))}
        </Painel>
        <Painel titulo="Importações a caminho" link="/compras" vazio="Nenhuma compra em aberto.">
          {compras.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0"><div className="truncate font-medium">{c.fornecedor_nome ?? 'Compra'} · {c.itens_qtd} itens</div><div className="text-xs text-slate-500">prev. {fmtData(c.previsao_chegada)} · {fmtBRL(c.custo_total_brl)}</div></div>
              <Badge className={STATUS_COMPRA[c.status].cor}>{STATUS_COMPRA[c.status].label}</Badge>
            </li>
          ))}
        </Painel>
        <Painel titulo="Contas a pagar (até fim do mês)" link="/financeiro" vazio="Nada em aberto.">
          {contas.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0"><div className="truncate font-medium">{l.descricao}</div><div className={`text-xs ${l.vencimento < hojeISO() ? 'text-red-600' : 'text-slate-500'}`}>vence {fmtData(l.vencimento)}</div></div>
              <span className="shrink-0 tabular-nums">{fmtBRL(l.valor)}</span>
            </li>
          ))}
          {baixos.map((b) => (
            <li key={b.produto_id} className="flex items-center justify-between gap-2 py-2">
              <span className="truncate">Estoque baixo: {b.nome}</span><Badge className="bg-amber-100 text-amber-800">{b.saldo}</Badge>
            </li>
          ))}
        </Painel>
      </div>
    </>
  )
}

function Painel({ titulo, link, vazio, children }: { titulo: string; link: string; vazio: string; children: ReactNode[] }) {
  const itens = children.flat().filter(Boolean)
  return (
    <section className="card p-4">
      <div className="mb-1 flex items-center justify-between"><h2 className="text-sm font-semibold">{titulo}</h2><Link to={link} className="text-xs text-brand-700 hover:underline">ver tudo</Link></div>
      {itens.length ? <ul className="divide-y divide-slate-100 text-sm">{children}</ul> : <Empty>{vazio}</Empty>}
    </section>
  )
}
