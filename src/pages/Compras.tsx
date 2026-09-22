import { useEffect, useState } from 'react'
import { PackageCheck, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTable } from '../lib/useData'
import { useApp } from '../lib/AppContext'
import { Badge, Empty, ErrorBox, Field, Modal, NumInput, PageHeader, PctInput } from '../components/ui'
import { STATUS_COMPRA, type Compra, type CompraItem, type CompraView, type Fornecedor, type Produto, type StatusCompra } from '../lib/types'
import { fmtBRL, fmtData, fmtMoeda, hojeISO } from '../lib/format'
import { custosCompra } from '../lib/calc'

type Form = Omit<Compra, 'id'> & { id?: string }

export default function Compras() {
  const [filtro, setFiltro] = useState<'abertas' | 'todas'>('abertas')
  const { data, error, reload } = useTable<CompraView>('vw_compras', (q) => {
    let qq = q.order('data', { ascending: false })
    if (filtro === 'abertas') qq = qq.not('status', 'in', '(recebido,cancelado)')
    return qq
  }, [filtro])
  const [form, setForm] = useState<{ compra: Form; itens: CompraItem[] } | null>(null)
  const { config } = useApp()

  function nova() {
    setForm({
      compra: { fornecedor_id: null, data: hojeISO(), tipo: 'importacao', moeda: 'USD', cambio: Number(config?.cambio_padrao ?? 5.3),
        freteiro_pct: Number(config?.freteiro_pct_padrao ?? 0.4), custos_extras_brl: 0, status: 'pedido', previsao_chegada: null,
        recebido_em: null, rastreio: null, observacoes: null },
      itens: [{ produto_id: null, descricao: null, quantidade: 1, valor_unit_moeda: 0 }],
    })
  }
  async function abrir(c: CompraView) {
    const { data: itens } = await supabase.from('compra_itens').select('*').eq('compra_id', c.id)
    const { fornecedor_nome: _f, itens_qtd: _q, total_moeda: _t, compra_brl: _c, freteiro_brl: _fr, custo_total_brl: _ct, ...compra } = c
    void _f; void _q; void _t; void _c; void _fr; void _ct
    setForm({ compra: { ...compra, cambio: Number(compra.cambio), freteiro_pct: Number(compra.freteiro_pct), custos_extras_brl: Number(compra.custos_extras_brl) },
      itens: (itens ?? []).map((i) => ({ ...i, quantidade: Number(i.quantidade), valor_unit_moeda: Number(i.valor_unit_moeda) })) })
  }
  async function receber(c: CompraView) {
    await supabase.from('compras').update({ status: 'recebido', recebido_em: hojeISO() }).eq('id', c.id); reload()
  }
  async function excluir(c: CompraView) {
    if (!confirm('Excluir esta compra e seus itens?')) return
    await supabase.from('compras').delete().eq('id', c.id); reload()
  }

  return (
    <>
      <PageHeader title="Compras / Importação" subtitle="Pedidos a fornecedores com custo em R$ já com câmbio, freteiro e extras" actions={
        <>
          <select className="input w-40" value={filtro} onChange={(e) => setFiltro(e.target.value as 'abertas' | 'todas')}>
            <option value="abertas">Em aberto</option><option value="todas">Todas</option>
          </select>
          <button className="btn-primary" onClick={nova}><Plus size={16} /> Nova compra</button>
        </>
      } />
      <ErrorBox msg={error} />
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>
            <th className="th">Data</th><th className="th">Fornecedor</th><th className="th">Status</th><th className="th">Previsão</th>
            <th className="th text-right">Itens</th><th className="th text-right">Total moeda</th><th className="th text-right">Câmbio</th>
            <th className="th text-right">Compra R$</th><th className="th text-right">Freteiro</th><th className="th text-right">Custo total</th><th className="th" />
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="td tabular-nums">{fmtData(c.data)}</td>
                <td className="td font-medium">{c.fornecedor_nome ?? '—'}<span className="ml-1 text-xs text-slate-400">{c.tipo === 'importacao' ? 'importação' : 'nacional'}</span></td>
                <td className="td"><Badge className={STATUS_COMPRA[c.status].cor}>{STATUS_COMPRA[c.status].label}</Badge></td>
                <td className="td tabular-nums">{c.status === 'recebido' ? `rec. ${fmtData(c.recebido_em)}` : fmtData(c.previsao_chegada)}</td>
                <td className="td text-right tabular-nums">{c.itens_qtd}</td>
                <td className="td text-right tabular-nums">{fmtMoeda(c.total_moeda, c.moeda)}</td>
                <td className="td text-right tabular-nums">{Number(c.cambio).toFixed(2)}</td>
                <td className="td text-right tabular-nums">{fmtBRL(c.compra_brl)}</td>
                <td className="td text-right tabular-nums">{fmtBRL(c.freteiro_brl)}</td>
                <td className="td text-right font-medium tabular-nums">{fmtBRL(c.custo_total_brl)}</td>
                <td className="td text-right">
                  {c.status !== 'recebido' && c.status !== 'cancelado' && <button className="btn-ghost p-1.5 text-emerald-700" title="Marcar como recebida (entra no estoque)" onClick={() => receber(c)}><PackageCheck size={15} /></button>}
                  <button className="btn-ghost p-1.5" title="Editar" onClick={() => abrir(c)}><Pencil size={15} /></button>
                  <button className="btn-danger p-1.5" title="Excluir" onClick={() => excluir(c)}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && <Empty>Nenhuma compra {filtro === 'abertas' ? 'em aberto' : ''}.</Empty>}
      </div>
      <p className="mt-3 text-xs text-slate-500">Só compras com status <b>Recebido</b> entram no saldo do estoque; as demais aparecem como "a caminho".</p>
      {form && <CompraForm inicial={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload() }} />}
    </>
  )
}

function CompraForm({ inicial, onClose, onSaved }: { inicial: { compra: Form; itens: CompraItem[] }; onClose: () => void; onSaved: () => void }) {
  const [c, setC] = useState<Form>(inicial.compra)
  const [itens, setItens] = useState<CompraItem[]>(inicial.itens)
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [gerarConta, setGerarConta] = useState(false)
  const [vencConta, setVencConta] = useState(hojeISO())
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('fornecedores').select('*').order('nome').then(({ data }) => setFornecedores((data ?? []) as Fornecedor[]))
    supabase.from('produtos').select('*').eq('ativo', true).order('nome').then(({ data }) => setProdutos((data ?? []) as Produto[]))
  }, [])

  const calc = custosCompra(itens, c)
  const setI = (idx: number, patch: Partial<CompraItem>) => setItens((a) => a.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  async function salvar() {
    setErro(null)
    if (!itens.length) return setErro('Adicione pelo menos um item.')
    if (itens.some((i) => !i.produto_id)) return setErro('Selecione o produto de cada item (cadastre em Produtos se necessário).')
    setBusy(true)
    try {
      const { id, ...payload } = c
      if (payload.status === 'recebido' && !payload.recebido_em) payload.recebido_em = hojeISO()
      let compraId = id
      if (id) {
        const r = await supabase.from('compras').update(payload).eq('id', id); if (r.error) throw r.error
        const r2 = await supabase.from('compra_itens').delete().eq('compra_id', id); if (r2.error) throw r2.error
      } else {
        const r = await supabase.from('compras').insert(payload).select('id').single(); if (r.error) throw r.error
        compraId = r.data.id
      }
      const r3 = await supabase.from('compra_itens').insert(itens.map(({ id: _id, ...i }) => ({ ...i, compra_id: compraId }))); if (r3.error) throw r3.error
      if (gerarConta) {
        const forn = fornecedores.find((f) => f.id === c.fornecedor_id)?.nome ?? 'fornecedor'
        const r4 = await supabase.from('lancamentos').insert({ tipo: 'despesa', categoria: 'fornecedor', descricao: `Compra ${forn} (${fmtData(c.data)})`,
          valor: calc.total.custoTotal, vencimento: vencConta, compra_id: compraId })
        if (r4.error) throw r4.error
      }
      onSaved()
    } catch (e) { setErro((e as { message?: string }).message ?? String(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open wide onClose={onClose} title={c.id ? 'Editar compra' : 'Nova compra'}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={salvar}>Salvar compra</button></>}>
      <ErrorBox msg={erro} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Field label="Fornecedor" className="col-span-2">
          <select className="input" value={c.fornecedor_id ?? ''} onChange={(e) => {
            const f = fornecedores.find((x) => x.id === e.target.value)
            setC({ ...c, fornecedor_id: e.target.value || null, ...(f ? { moeda: f.moeda, ...(f.moeda === 'BRL' ? { cambio: 1, freteiro_pct: 0, tipo: 'nacional' as const } : {}) } : {}) })
          }}>
            <option value="">—</option>{fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </Field>
        <Field label="Data"><input type="date" className="input" value={c.data} onChange={(e) => setC({ ...c, data: e.target.value })} /></Field>
        <Field label="Tipo">
          <select className="input" value={c.tipo} onChange={(e) => setC({ ...c, tipo: e.target.value as Form['tipo'] })}>
            <option value="importacao">Importação</option><option value="nacional">Nacional</option>
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={c.status} onChange={(e) => setC({ ...c, status: e.target.value as StatusCompra })}>
            {Object.entries(STATUS_COMPRA).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Previsão chegada"><input type="date" className="input" value={c.previsao_chegada ?? ''} onChange={(e) => setC({ ...c, previsao_chegada: e.target.value || null })} /></Field>
        <Field label="Moeda">
          <select className="input" value={c.moeda} onChange={(e) => setC({ ...c, moeda: e.target.value, ...(e.target.value === 'BRL' ? { cambio: 1 } : {}) })}>
            <option>USD</option><option>BRL</option><option>EUR</option><option>CNY</option>
          </select>
        </Field>
        <Field label="Câmbio (R$)"><NumInput step="0.0001" value={c.cambio} onChange={(n) => setC({ ...c, cambio: n })} /></Field>
        <Field label="Freteiro (% da compra)"><PctInput value={c.freteiro_pct} onChange={(n) => setC({ ...c, freteiro_pct: n })} /></Field>
        <Field label="Custos extras (R$)"><NumInput value={c.custos_extras_brl} onChange={(n) => setC({ ...c, custos_extras_brl: n })} /></Field>
        <Field label="Rastreio" className="col-span-2"><input className="input" value={c.rastreio ?? ''} onChange={(e) => setC({ ...c, rastreio: e.target.value || null })} /></Field>
      </div>

      <div className="mt-5 mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Itens</h3>
        <button className="btn-ghost text-brand-700" onClick={() => setItens([...itens, { produto_id: null, descricao: null, quantidade: 1, valor_unit_moeda: 0 }])}><Plus size={15} /> Item</button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>
            <th className="th">Produto</th><th className="th w-20">Qtd</th><th className="th w-32">Valor unit. ({c.moeda})</th>
            <th className="th text-right">Compra R$</th><th className="th text-right">Freteiro</th><th className="th text-right">Extras</th>
            <th className="th text-right">Custo total</th><th className="th text-right">Custo unit.</th><th className="th" />
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {itens.map((it, idx) => {
              const l = calc.linhas[idx]
              return (
                <tr key={idx}>
                  <td className="td min-w-[14rem]">
                    <select className="input" value={it.produto_id ?? ''} onChange={(e) => {
                      const p = produtos.find((x) => x.id === e.target.value)
                      setI(idx, { produto_id: e.target.value || null, ...(p?.custo_ref_moeda && !it.valor_unit_moeda ? { valor_unit_moeda: Number(p.custo_ref_moeda) } : {}) })
                    }}>
                      <option value="">— selecione —</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </td>
                  <td className="td"><NumInput step="1" value={it.quantidade} onChange={(n) => setI(idx, { quantidade: Math.max(1, Math.round(n)) })} /></td>
                  <td className="td"><NumInput value={it.valor_unit_moeda} onChange={(n) => setI(idx, { valor_unit_moeda: n })} /></td>
                  <td className="td text-right tabular-nums">{fmtBRL(l.compraBRL)}</td>
                  <td className="td text-right tabular-nums">{fmtBRL(l.freteiro)}</td>
                  <td className="td text-right tabular-nums">{fmtBRL(l.extras)}</td>
                  <td className="td text-right font-medium tabular-nums">{fmtBRL(l.custoTotal)}</td>
                  <td className="td text-right tabular-nums">{fmtBRL(l.custoUnit)}</td>
                  <td className="td"><button className="btn-danger p-1.5" onClick={() => setItens(itens.filter((_, i) => i !== idx))}><Trash2 size={15} /></button></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold"><tr>
            <td className="td" colSpan={2}>Total</td><td className="td tabular-nums">{fmtMoeda(calc.total.totalMoeda, c.moeda)}</td>
            <td className="td text-right tabular-nums">{fmtBRL(calc.total.compraBRL)}</td><td className="td text-right tabular-nums">{fmtBRL(calc.total.freteiro)}</td>
            <td className="td text-right tabular-nums">{fmtBRL(calc.total.extras)}</td><td className="td text-right tabular-nums">{fmtBRL(calc.total.custoTotal)}</td><td colSpan={2} />
          </tr></tfoot>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Field label="Observações" className="col-span-2 md:col-span-4"><textarea rows={2} className="input" value={c.observacoes ?? ''} onChange={(e) => setC({ ...c, observacoes: e.target.value || null })} /></Field>
        {!c.id && (
          <div className="col-span-2 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={gerarConta} onChange={(e) => setGerarConta(e.target.checked)} /> Lançar conta a pagar</label>
            {gerarConta && <input type="date" className="input" value={vencConta} onChange={(e) => setVencConta(e.target.value)} />}
          </div>
        )}
      </div>
    </Modal>
  )
}
