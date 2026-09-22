import { useMemo, useState } from 'react'
import { CheckCircle2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTable } from '../lib/useData'
import { useApp } from '../lib/AppContext'
import { Badge, Empty, ErrorBox, Field, Modal, MonthPicker, NumInput, PageHeader, Stat } from '../components/ui'
import { CATEGORIAS_LANC, type Lancamento, type ResumoMensal } from '../lib/types'
import { addMeses, fimMes, fmtBRL, fmtData, fmtPct, hojeISO, inicioMes, mesAtual, nomeMes } from '../lib/format'

type Form = Partial<Lancamento> & { nParcelas: number; recorrente: boolean }

export default function Financeiro() {
  const [mes, setMes] = useState(mesAtual())
  const [filtro, setFiltro] = useState<'todos' | 'abertos' | 'pagos'>('todos')
  const { data, error, reload } = useTable<Lancamento>('lancamentos',
    (q) => q.gte('vencimento', inicioMes(mes)).lte('vencimento', fimMes(mes)).order('vencimento'), [mes])
  const resumo = useTable<ResumoMensal>('vw_resumo_mensal', (q) => q.eq('mes', inicioMes(mes)), [mes])
  const r = resumo.data[0]
  const { rbt12Atual, aliquotaAtual } = useApp()
  const [form, setForm] = useState<Form | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const hoje = hojeISO()

  const lista = useMemo(() => data.filter((l) => filtro === 'todos' || (filtro === 'pagos' ? !!l.pago_em : !l.pago_em)), [data, filtro])
  const aPagar = data.filter((l) => l.tipo === 'despesa' && !l.pago_em).reduce((s, l) => s + Number(l.valor), 0)
  const pago = data.filter((l) => l.tipo === 'despesa' && l.pago_em).reduce((s, l) => s + Number(l.valor), 0)
  const aReceber = data.filter((l) => l.tipo === 'receita' && !l.pago_em).reduce((s, l) => s + Number(l.valor), 0)

  async function salvar() {
    if (!form) return
    setErro(null)
    if (!form.descricao || !form.valor || !form.vencimento) return setErro('Preencha descrição, valor e vencimento.')
    const base = { tipo: form.tipo, categoria: form.categoria, descricao: form.descricao, valor: form.valor, observacoes: form.observacoes ?? null }
    if (form.id) {
      const { error } = await supabase.from('lancamentos').update({ ...base, vencimento: form.vencimento, pago_em: form.pago_em || null }).eq('id', form.id)
      if (error) return setErro(error.message)
    } else {
      const n = Math.max(1, form.nParcelas)
      const grupo = n > 1 ? crypto.randomUUID() : null
      const rows = Array.from({ length: n }, (_, i) => ({
        ...base, vencimento: addMeses(form.vencimento!, i), pago_em: i === 0 ? form.pago_em || null : null,
        parcela: n > 1 && !form.recorrente ? i + 1 : null, parcelas: n > 1 && !form.recorrente ? n : null, grupo_id: grupo,
        descricao: n > 1 && !form.recorrente ? `${form.descricao} (${i + 1}/${n})` : form.descricao,
      }))
      const { error } = await supabase.from('lancamentos').insert(rows)
      if (error) return setErro(error.message)
    }
    setForm(null); reload(); resumo.reload()
  }
  async function togglePago(l: Lancamento) {
    await supabase.from('lancamentos').update({ pago_em: l.pago_em ? null : hoje }).eq('id', l.id); reload()
  }
  async function excluir(l: Lancamento) {
    if (l.grupo_id && confirm('Excluir também as próximas parcelas/recorrências deste grupo? (OK = todas a partir desta, Cancelar = só esta)')) {
      await supabase.from('lancamentos').delete().eq('grupo_id', l.grupo_id).gte('vencimento', l.vencimento)
    } else {
      if (!confirm('Excluir este lançamento?')) return
      await supabase.from('lancamentos').delete().eq('id', l.id)
    }
    reload(); resumo.reload()
  }
  async function lancarDAS() {
    if (!r) return
    const venc = addMeses(`${mes}-20`, 1)
    const { error } = await supabase.from('lancamentos').insert({ tipo: 'despesa', categoria: 'imposto', descricao: `DAS Simples – ${nomeMes(mes)}`,
      valor: Number(r.imposto), vencimento: venc, observacoes: 'Calculado sobre as vendas do mês (já descontado no lucro das vendas)', venda_id: null, compra_id: null })
    if (error) alert(error.message)
    else alert(`DAS de ${fmtBRL(r.imposto)} lançado com vencimento ${fmtData(venc)} (mês ${nomeMes(addMeses(`${mes}-01`, 1).slice(0, 7))}). Ele não é somado de novo no resultado.`)
  }

  return (
    <>
      <PageHeader title="Financeiro" subtitle="Contas a pagar/receber, despesas fixas, parcelamentos e resultado do mês" actions={
        <>
          <MonthPicker value={mes} onChange={setMes} />
          <select className="input w-32" value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
            <option value="todos">Todos</option><option value="abertos">Em aberto</option><option value="pagos">Pagos</option>
          </select>
          <button className="btn-primary" onClick={() => { setErro(null); setForm({ tipo: 'despesa', categoria: 'fixa', vencimento: `${mes}-${hoje.slice(8)}` <= fimMes(mes) ? `${mes}-${hoje.slice(8)}` : fimMes(mes), valor: 0, nParcelas: 1, recorrente: false }) }}><Plus size={16} /> Lançamento</button>
        </>
      } />
      <ErrorBox msg={error} />

      <div className="card mb-4 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Resultado de {nomeMes(mes)}</h2>
          {r && Number(r.imposto) > 0 && <button className="btn-ghost text-sm" onClick={lancarDAS}>Lançar DAS do mês ({fmtBRL(r.imposto)})</button>}
        </div>
        <div className="grid gap-x-10 text-sm sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-4">
          <Linha l="Faturamento" v={r?.receita} />
          <Linha l="(−) Custo dos produtos" v={r?.custo} neg />
          <Linha l="(−) Despesas das vendas" v={r?.despesas_vendas} neg />
          <Linha l="(−) Simples Nacional" v={r?.imposto} neg />
          <Linha l="= Lucro das vendas" v={r?.lucro_vendas} forte />
          <Linha l="(−) Despesas gerais / fixas" v={r?.despesas_gerais} neg />
          <Linha l="(+) Outras receitas" v={r?.receitas_gerais} />
          <Linha l="= Resultado do mês" v={r?.resultado} forte cor />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          RBT12 atual: {fmtBRL(rbt12Atual)} · alíquota efetiva Anexo I: {fmtPct(aliquotaAtual, 2)}. Contas ligadas a uma compra e lançamentos da categoria Imposto (DAS) não entram nas "despesas gerais" — esses valores já estão no lucro das vendas.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="A pagar no mês" value={fmtBRL(aPagar)} tone={aPagar ? 'neg' : 'default'} />
        <Stat label="Pago no mês" value={fmtBRL(pago)} />
        <Stat label="A receber" value={fmtBRL(aReceber)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>
            <th className="th">Vencimento</th><th className="th">Descrição</th><th className="th">Categoria</th><th className="th">Situação</th><th className="th text-right">Valor</th><th className="th" />
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((l) => {
              const atrasado = !l.pago_em && l.vencimento < hoje
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="td tabular-nums">{fmtData(l.vencimento)}</td>
                  <td className="td font-medium">{l.descricao}{l.compra_id && <span className="ml-1 text-xs text-slate-400">compra</span>}</td>
                  <td className="td">{CATEGORIAS_LANC[l.categoria] ?? l.categoria}</td>
                  <td className="td">
                    {l.pago_em ? <Badge className="bg-emerald-100 text-emerald-800">{l.tipo === 'despesa' ? 'Pago' : 'Recebido'} {fmtData(l.pago_em)}</Badge>
                      : atrasado ? <Badge className="bg-red-100 text-red-700">Atrasado</Badge> : <Badge className="bg-amber-100 text-amber-800">Em aberto</Badge>}
                  </td>
                  <td className={`td text-right font-medium tabular-nums ${l.tipo === 'despesa' ? 'text-red-600' : 'text-emerald-700'}`}>{l.tipo === 'despesa' ? '−' : '+'}{fmtBRL(l.valor)}</td>
                  <td className="td text-right">
                    <button className="btn-ghost p-1.5" title={l.pago_em ? 'Desfazer pagamento' : 'Marcar como pago'} onClick={() => togglePago(l)}>{l.pago_em ? <RotateCcw size={15} /> : <CheckCircle2 size={15} className="text-emerald-600" />}</button>
                    <button className="btn-ghost p-1.5" title="Editar" onClick={() => { setErro(null); setForm({ ...l, nParcelas: 1, recorrente: false }) }}><Pencil size={15} /></button>
                    <button className="btn-danger p-1.5" title="Excluir" onClick={() => excluir(l)}><Trash2 size={15} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!lista.length && <Empty>Nenhum lançamento neste mês.</Empty>}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Editar lançamento' : 'Novo lançamento'}
        footer={<><button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar</button></>}>
        <ErrorBox msg={erro} />
        {form && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Lancamento['tipo'] })}>
                <option value="despesa">Despesa (a pagar)</option><option value="receita">Receita (a receber)</option>
              </select>
            </Field>
            <Field label="Categoria">
              <select className="input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {Object.entries(CATEGORIAS_LANC).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Descrição" className="col-span-2"><input className="input" value={form.descricao ?? ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="ex.: Aluguel, Alfredo – produtos" /></Field>
            <Field label={form.nParcelas > 1 && !form.recorrente ? 'Valor de cada parcela (R$)' : 'Valor (R$)'}><NumInput value={form.valor} onChange={(n) => setForm({ ...form, valor: n })} /></Field>
            <Field label={form.nParcelas > 1 ? '1º vencimento' : 'Vencimento'}><input type="date" className="input" value={form.vencimento ?? ''} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></Field>
            {!form.id && (
              <>
                <Field label="Repetir por (meses)"><NumInput step="1" value={form.nParcelas} onChange={(n) => setForm({ ...form, nParcelas: Math.max(1, Math.min(60, Math.round(n))) })} /></Field>
                <Field label="Como repetir">
                  <select className="input" value={form.recorrente ? 'rec' : 'parc'} disabled={form.nParcelas <= 1} onChange={(e) => setForm({ ...form, recorrente: e.target.value === 'rec' })}>
                    <option value="parc">Parcelado (1/N, 2/N…)</option><option value="rec">Despesa fixa mensal</option>
                  </select>
                </Field>
              </>
            )}
            <Field label="Pago / recebido em"><input type="date" className="input" value={form.pago_em ?? ''} onChange={(e) => setForm({ ...form, pago_em: e.target.value || null })} /></Field>
            <Field label="Observações" className="col-span-2"><input className="input" value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value || null })} /></Field>
          </div>
        )}
      </Modal>
    </>
  )
}

function Linha({ l, v, neg, forte, cor }: { l: string; v: number | undefined; neg?: boolean; forte?: boolean; cor?: boolean }) {
  const n = Number(v ?? 0)
  return (
    <div className={`flex justify-between gap-2 border-b border-slate-100 py-1 ${forte ? 'font-semibold' : ''}`}>
      <span className="text-slate-600">{l}</span>
      <span className={`whitespace-nowrap tabular-nums ${cor ? (n < 0 ? 'text-red-600' : 'text-emerald-700') : neg ? 'text-slate-700' : ''}`}>{fmtBRL(n)}</span>
    </div>
  )
}
