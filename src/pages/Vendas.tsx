import { useEffect, useMemo, useState } from 'react'
import { Copy, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import ProdutoModal from '../components/ProdutoModal'
import ProdutoPicker from '../components/ProdutoPicker'
import { supabase } from '../lib/supabase'
import { useTable } from '../lib/useData'
import { useApp } from '../lib/AppContext'
import { Badge, Empty, ErrorBox, Field, Modal, MonthPicker, NumInput, PageHeader, PctInput } from '../components/ui'
import { STATUS_VENDA, type Cliente, type EstoqueView, type StatusVenda, type Venda, type VendaItem, type VendaView } from '../lib/types'
import { fimMes, fmtBRL, fmtData, fmtPct, hojeISO, inicioMes, mesAtual } from '../lib/format'
import { custoUnitManual, totaisVenda } from '../lib/calc'

type Form = Omit<Venda, 'id'> & { id?: string; cliente_nome: string }

export default function Vendas() {
  const [mes, setMes] = useState(mesAtual())
  const [status, setStatus] = useState<string>('')
  const [q, setQ] = useState('')
  const { data, error, reload } = useTable<VendaView>('vw_vendas',
    (qq) => qq.gte('data', inicioMes(mes)).lte('data', fimMes(mes)).order('data').order('created_at'), [mes])
  const [form, setForm] = useState<{ venda: Form; itens: VendaItem[] } | null>(null)
  const { config, aliquotaAtual } = useApp()

  const lista = useMemo(() => data.filter((v) =>
    (!status || v.status === status) &&
    (!q || `${v.cliente_nome ?? ''} ${v.produtos} ${v.observacoes ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [data, status, q])

  const validas = lista.filter((v) => v.status !== 'cancelado' && v.status !== 'orcamento')
  const tot = validas.reduce((s, v) => ({
    receita: s.receita + Number(v.receita), custo: s.custo + Number(v.custo_total), desp: s.desp + Number(v.despesas_total),
    imp: s.imp + Number(v.imposto), lucro: s.lucro + Number(v.lucro_liquido),
  }), { receita: 0, custo: 0, desp: 0, imp: 0, lucro: 0 })

  function itemNovo(): VendaItem {
    return { produto_id: null, descricao: null, quantidade: 1, preco_unit: 0, origem_custo: 'manual', custo_unit_moeda: 0,
      cambio: Number(config?.cambio_padrao ?? 5.3), freteiro_pct: Number(config?.freteiro_pct_padrao ?? 0.4), custo_unit_brl: 0 }
  }
  function nova() {
    setForm({
      venda: { cliente_id: null, cliente_nome: '', data: hojeISO(), status: 'pago', previsao_entrega: null, forma_pagamento: null,
        despesas: 0, quebras: 0, frete_br: 0, desconto: 0, aliquota_imposto: aliquotaAtual, observacoes: null, emitir_nf: true, nf_numero: null },
      itens: [itemNovo()],
    })
  }
  async function abrir(v: VendaView, duplicar = false) {
    const { data: itens } = await supabase.from('venda_itens').select('*').eq('venda_id', v.id)
    const venda: Form = {
      id: duplicar ? undefined : v.id, cliente_id: v.cliente_id, cliente_nome: v.cliente_nome ?? '', data: duplicar ? hojeISO() : v.data,
      status: duplicar ? 'pago' : v.status, previsao_entrega: v.previsao_entrega, forma_pagamento: v.forma_pagamento,
      despesas: Number(v.despesas), quebras: Number(v.quebras), frete_br: Number(v.frete_br), desconto: Number(v.desconto),
      aliquota_imposto: duplicar ? (v.emitir_nf === false ? 0 : aliquotaAtual) : Number(v.aliquota_imposto), observacoes: v.observacoes,
      emitir_nf: v.emitir_nf, nf_numero: duplicar ? null : v.nf_numero,
    }
    setForm({ venda, itens: (itens ?? []).map((i) => ({ ...i, id: duplicar ? undefined : i.id, quantidade: Number(i.quantidade), preco_unit: Number(i.preco_unit),
      custo_unit_moeda: i.custo_unit_moeda == null ? null : Number(i.custo_unit_moeda), cambio: i.cambio == null ? null : Number(i.cambio),
      freteiro_pct: i.freteiro_pct == null ? null : Number(i.freteiro_pct), custo_unit_brl: Number(i.custo_unit_brl) })) })
  }
  async function excluir(v: VendaView) {
    if (!confirm(`Excluir a venda de ${v.cliente_nome ?? 'sem cliente'} (${fmtBRL(v.receita)})?`)) return
    await supabase.from('vendas').delete().eq('id', v.id); reload()
  }

  return (
    <>
      <PageHeader title="Vendas" subtitle="Cada venda com custo, despesas, imposto e lucro líquido" actions={
        <>
          <MonthPicker value={mes} onChange={setMes} />
          <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos status</option>
            {Object.entries(STATUS_VENDA).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
          <div className="relative"><Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input className="input w-48 pl-8" placeholder="Cliente, produto…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <button className="btn-primary" onClick={nova}><Plus size={16} /> Nova venda</button>
        </>
      } />
      <ErrorBox msg={error} />
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>
            <th className="th">Data</th><th className="th">Cliente</th><th className="th">Produto</th><th className="th">Status</th><th className="th">NF</th>
            <th className="th text-right">Venda</th><th className="th text-right">Custo</th><th className="th text-right">Despesas</th>
            <th className="th text-right">Imposto</th><th className="th text-right">Lucro líq.</th><th className="th text-right">Margem</th><th className="th" />
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((v) => (
              <tr key={v.id} className={`hover:bg-slate-50 ${v.status === 'cancelado' ? 'opacity-50' : ''}`}>
                <td className="td tabular-nums">{fmtData(v.data)}</td>
                <td className="td max-w-[10rem] truncate font-medium">{v.cliente_nome ?? <span className="text-slate-400">—</span>}{v.cliente_uf && <span className="ml-1 text-xs text-slate-400">{v.cliente_uf}</span>}</td>
                <td className="td max-w-[13rem] truncate" title={v.produtos}>{v.produtos || v.observacoes}</td>
                <td className="td" title={v.previsao_entrega ? `Previsão: ${v.previsao_entrega}` : undefined}><Badge className={STATUS_VENDA[v.status].cor}>{STATUS_VENDA[v.status].label}{v.previsao_entrega ? ` · ${v.previsao_entrega.slice(0, 3)}` : ''}</Badge></td>
                <td className="td">{v.emitir_nf === true ? <Badge className="bg-sky-100 text-sky-800">{v.nf_numero ? `NF ${v.nf_numero}` : 'Com NF'}</Badge>
                  : v.emitir_nf === false ? <Badge className="bg-slate-100 text-slate-600">Sem NF</Badge> : <span className="text-xs text-slate-400">—</span>}</td>
                <td className="td text-right tabular-nums">{fmtBRL(v.receita)}</td>
                <td className="td text-right tabular-nums text-slate-600">{fmtBRL(v.custo_total)}</td>
                <td className="td text-right tabular-nums text-slate-600">{fmtBRL(v.despesas_total)}</td>
                <td className="td text-right tabular-nums text-slate-600">{fmtBRL(v.imposto)}</td>
                <td className={`td text-right font-medium tabular-nums ${v.lucro_liquido < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmtBRL(v.lucro_liquido)}</td>
                <td className="td text-right tabular-nums">{fmtPct(v.margem)}</td>
                <td className="td text-right">
                  <button className="btn-ghost p-1.5" title="Editar" onClick={() => abrir(v)}><Pencil size={15} /></button>
                  <button className="btn-ghost p-1.5" title="Duplicar" onClick={() => abrir(v, true)}><Copy size={15} /></button>
                  <button className="btn-danger p-1.5" title="Excluir" onClick={() => excluir(v)}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
          {validas.length > 0 && (
            <tfoot className="bg-slate-50 font-semibold"><tr>
              <td className="td" colSpan={5}>Total ({validas.length} vendas, sem orçamentos/canceladas)</td>
              <td className="td text-right tabular-nums">{fmtBRL(tot.receita)}</td>
              <td className="td text-right tabular-nums">{fmtBRL(tot.custo)}</td>
              <td className="td text-right tabular-nums">{fmtBRL(tot.desp)}</td>
              <td className="td text-right tabular-nums">{fmtBRL(tot.imp)}</td>
              <td className={`td text-right tabular-nums ${tot.lucro < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmtBRL(tot.lucro)}</td>
              <td className="td text-right tabular-nums">{fmtPct(tot.receita ? tot.lucro / tot.receita : null)}</td><td />
            </tr></tfoot>
          )}
        </table>
        {!lista.length && <Empty>Nenhuma venda neste mês.</Empty>}
      </div>
      {form && <VendaForm inicial={form} novoItem={itemNovo} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload() }} />}
    </>
  )
}

function VendaForm({ inicial, novoItem, onClose, onSaved }: {
  inicial: { venda: Form; itens: VendaItem[] }; novoItem: () => VendaItem; onClose: () => void; onSaved: () => void
}) {
  const [v, setV] = useState<Form>(inicial.venda)
  const [itens, setItens] = useState<VendaItem[]>(inicial.itens)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [estoque, setEstoque] = useState<EstoqueView[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [prodModal, setProdModal] = useState<{ idx: number; id: string | null } | null>(null)
  const { aliquotaAtual } = useApp()

  function carregarEstoque() {
    return supabase.from('vw_estoque').select('*').order('nome').range(0, 4999).then(({ data }) => {
      const lista = (data ?? []) as EstoqueView[]
      setEstoque(lista)
      return lista
    })
  }

  useEffect(() => {
    supabase.from('clientes').select('*').order('nome').then(({ data }) => setClientes((data ?? []) as Cliente[]))
    carregarEstoque()
  }, [])

  const t = totaisVenda(itens, v)
  const setI = (idx: number, patch: Partial<VendaItem>) => setItens((arr) => arr.map((it, i) => {
    if (i !== idx) return it
    const n = { ...it, ...patch }
    if (n.origem_custo === 'manual') n.custo_unit_brl = custoUnitManual(n.custo_unit_moeda ?? 0, n.cambio ?? 0, n.freteiro_pct ?? 0)
    return n
  }))
  function escolherProduto(idx: number, produto_id: string) {
    const p = estoque.find((e) => e.produto_id === produto_id)
    const atual = itens[idx]
    const patch: Partial<VendaItem> = { produto_id: produto_id || null }
    if (p?.preco_venda && !atual.preco_unit) patch.preco_unit = Number(p.preco_venda)
    if (atual.origem_custo === 'estoque') patch.custo_unit_brl = Number(p?.custo_medio ?? 0)
    setI(idx, patch)
  }
  function trocarOrigem(idx: number, origem: 'manual' | 'estoque') {
    const p = estoque.find((e) => e.produto_id === itens[idx].produto_id)
    setI(idx, origem === 'estoque' ? { origem_custo: origem, custo_unit_brl: Number(p?.custo_medio ?? 0) } : { origem_custo: origem })
  }

  async function salvar() {
    setErro(null)
    if (!itens.length) return setErro('Adicione pelo menos um item.')
    if (itens.some((i) => !i.produto_id && !i.descricao)) return setErro('Cada item precisa de um produto ou descrição.')
    setBusy(true)
    try {
      // cliente: usa existente pelo nome ou cria
      let cliente_id = v.cliente_id
      const nome = v.cliente_nome.trim()
      if (nome) {
        const achado = clientes.find((c) => c.nome.toLowerCase() === nome.toLowerCase())
        if (achado) cliente_id = achado.id
        else {
          const { data, error } = await supabase.from('clientes').insert({ nome }).select('id').single()
          if (error) throw error
          cliente_id = data.id
        }
      } else cliente_id = null

      const { cliente_nome: _ignora, id, ...resto } = v
      void _ignora
      const payload = { ...resto, cliente_id }
      let vendaId = id
      if (id) {
        const { error } = await supabase.from('vendas').update(payload).eq('id', id); if (error) throw error
        const { error: e2 } = await supabase.from('venda_itens').delete().eq('venda_id', id); if (e2) throw e2
      } else {
        const { data, error } = await supabase.from('vendas').insert(payload).select('id').single(); if (error) throw error
        vendaId = data.id
      }
      const rows = itens.map(({ id: _id, ...i }) => ({ ...i, venda_id: vendaId }))
      const { error: e3 } = await supabase.from('venda_itens').insert(rows); if (e3) throw e3
      onSaved()
    } catch (e) {
      setErro((e as { message?: string }).message ?? String(e))
    } finally { setBusy(false) }
  }

  return (
    <Modal open wide onClose={onClose} title={v.id ? 'Editar venda' : 'Nova venda'}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={salvar}>Salvar venda</button></>}>
      <ErrorBox msg={erro} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Field label="Cliente (digite para buscar ou criar)" className="col-span-2 md:col-span-3">
          <input className="input" list="lista-clientes" value={v.cliente_nome} onChange={(e) => setV({ ...v, cliente_nome: e.target.value, cliente_id: null })} placeholder="Nome do cliente" />
          <datalist id="lista-clientes">{clientes.map((c) => <option key={c.id} value={c.nome}>{[c.cidade, c.uf].filter(Boolean).join(' / ')}</option>)}</datalist>
        </Field>
        <Field label="Data" className="md:col-span-1"><input type="date" className="input" value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} /></Field>
        <Field label="Status" className="md:col-span-1">
          <select className="input" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as StatusVenda })}>
            {Object.entries(STATUS_VENDA).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Previsão entrega" className="md:col-span-1"><input className="input" placeholder="ex.: Novembro" value={v.previsao_entrega ?? ''} onChange={(e) => setV({ ...v, previsao_entrega: e.target.value || null })} /></Field>
        <div className="col-span-2 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 px-3 py-2 md:col-span-6">
          <span className="flex items-center gap-1.5 pb-2 text-sm font-medium text-slate-700"><FileText size={15} /> Nota fiscal:</span>
          <label className="flex items-center gap-1.5 pb-2 text-sm">
            <input type="radio" name="nf" checked={v.emitir_nf !== false} onChange={() => setV({ ...v, emitir_nf: true, aliquota_imposto: v.aliquota_imposto || aliquotaAtual })} /> Emitir NF
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-sm">
            <input type="radio" name="nf" checked={v.emitir_nf === false} onChange={() => setV({ ...v, emitir_nf: false, nf_numero: null, aliquota_imposto: 0 })} /> Sem NF
          </label>
          {v.emitir_nf !== false && (
            <Field label="Nº da NF (opcional)" className="w-40"><input className="input" value={v.nf_numero ?? ''} onChange={(e) => setV({ ...v, nf_numero: e.target.value || null })} /></Field>
          )}
          <span className="pb-2 text-xs text-slate-500">{v.emitir_nf === false ? 'Sem NF: o Simples desta venda fica zerado e ela não entra no RBT12.' : `Simples aplicado: ${fmtPct(v.aliquota_imposto, 2)}`}</span>
        </div>
      </div>

      <div className="mt-5 mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Itens</h3>
        <button className="btn-ghost text-brand-700" onClick={() => setItens([...itens, novoItem()])}><Plus size={15} /> Item</button>
      </div>
      <div className="space-y-3">
        {itens.map((it, idx) => {
          const p = estoque.find((e) => e.produto_id === it.produto_id)
          return (
            <div key={idx} className="rounded-lg border border-slate-200 p-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-12">
                <div className="col-span-2 md:col-span-5"><span className="label">Produto</span>
                  <div className="flex gap-1">
                    <ProdutoPicker produtos={estoque} value={it.produto_id} onChange={(id) => escolherProduto(idx, id)} />
                    {it.produto_id && <button type="button" className="btn-ghost shrink-0 px-2" title="Abrir cadastro do produto" onClick={() => setProdModal({ idx, id: it.produto_id })}><Pencil size={15} /></button>}
                    <button type="button" className="btn-ghost shrink-0 px-2 text-brand-700" title="Cadastrar novo produto" onClick={() => setProdModal({ idx, id: null })}><Plus size={16} /></button>
                  </div>
                  {p?.categoria && <span className="mt-0.5 block text-[11px] text-slate-400">{p.categoria}</span>}
                </div>
                <Field label="Descrição / obs." className="col-span-2 md:col-span-3"><input className="input" value={it.descricao ?? ''} onChange={(e) => setI(idx, { descricao: e.target.value || null })} /></Field>
                <Field label="Qtd" className="md:col-span-1"><NumInput step="1" value={it.quantidade} onChange={(n) => setI(idx, { quantidade: Math.max(1, Math.round(n)) })} /></Field>
                <Field label="Preço unit. (R$)" className="md:col-span-2"><NumInput value={it.preco_unit} onChange={(n) => setI(idx, { preco_unit: n })} /></Field>
                <div className="flex items-end justify-end md:col-span-1">
                  <button className="btn-danger p-2" title="Remover item" onClick={() => setItens(itens.filter((_, i) => i !== idx))}><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 items-end gap-2 md:grid-cols-12">
                <Field label="Custo" className="col-span-2 md:col-span-3">
                  <select className="input" value={it.origem_custo} onChange={(e) => trocarOrigem(idx, e.target.value as 'manual' | 'estoque')}>
                    <option value="manual">Sob encomenda (USD × dólar + freteiro)</option>
                    <option value="estoque" disabled={!it.produto_id}>Do estoque (custo médio)</option>
                  </select>
                </Field>
                {it.origem_custo === 'manual' ? (
                  <>
                    <Field label="Valor unit. (USD)" className="md:col-span-2"><NumInput value={it.custo_unit_moeda} onChange={(n) => setI(idx, { custo_unit_moeda: n })} /></Field>
                    <Field label="Dólar" className="md:col-span-2"><NumInput step="0.0001" value={it.cambio} onChange={(n) => setI(idx, { cambio: n })} /></Field>
                    <Field label="Freteiro" className="md:col-span-2"><PctInput value={it.freteiro_pct ?? 0} onChange={(n) => setI(idx, { freteiro_pct: n })} /></Field>
                  </>
                ) : (
                  <Field label={`Custo unit. (R$)${p?.custo_medio ? ' – médio ' + fmtBRL(p.custo_medio) : ''}`} className="col-span-2 md:col-span-6">
                    <NumInput value={it.custo_unit_brl} onChange={(n) => setI(idx, { custo_unit_brl: n })} />
                  </Field>
                )}
                <div className="col-span-2 text-right text-sm md:col-span-3">
                  <div className="text-xs text-slate-500">Custo total do item</div>
                  <div className="font-semibold tabular-nums">{fmtBRL(it.quantidade * it.custo_unit_brl)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Field label="Despesas (R$)"><NumInput value={v.despesas} onChange={(n) => setV({ ...v, despesas: n })} /></Field>
        <Field label="Quebras (R$)"><NumInput value={v.quebras} onChange={(n) => setV({ ...v, quebras: n })} /></Field>
        <Field label="Frete BR (R$)"><NumInput value={v.frete_br} onChange={(n) => setV({ ...v, frete_br: n })} /></Field>
        <Field label="Desconto (R$)"><NumInput value={v.desconto} onChange={(n) => setV({ ...v, desconto: n })} /></Field>
        <Field label="Simples (alíquota)"><PctInput value={v.aliquota_imposto} onChange={(n) => setV({ ...v, aliquota_imposto: n })} /></Field>
        <Field label="Forma de pagamento"><input className="input" list="formas-pgto" value={v.forma_pagamento ?? ''} onChange={(e) => setV({ ...v, forma_pagamento: e.target.value || null })} />
          <datalist id="formas-pgto"><option value="PIX" /><option value="Cartão de crédito" /><option value="Boleto" /><option value="Transferência" /><option value="Dinheiro" /></datalist>
        </Field>
        <Field label="Observações" className="col-span-2 md:col-span-6"><textarea rows={2} className="input" value={v.observacoes ?? ''} onChange={(e) => setV({ ...v, observacoes: e.target.value || null })} /></Field>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3 md:grid-cols-6">
        <Resumo l="Venda" v={fmtBRL(t.receita)} />
        <Resumo l="Custo total" v={fmtBRL(t.custo)} />
        <Resumo l="Despesas total" v={fmtBRL(t.despesasTotal)} />
        <Resumo l={`Imposto (${fmtPct(v.aliquota_imposto, 2)})`} v={fmtBRL(t.imposto)} />
        <Resumo l="Lucro líquido" v={fmtBRL(t.lucro)} tone={t.lucro < 0 ? 'neg' : 'pos'} />
        <Resumo l="Margem" v={fmtPct(t.margem)} tone={t.lucro < 0 ? 'neg' : 'pos'} />
      </div>
      {prodModal && (
        <ProdutoModal produtoId={prodModal.id} nomeInicial={prodModal.id ? undefined : itens[prodModal.idx]?.descricao ?? ''}
          onClose={() => setProdModal(null)}
          onSaved={async (prod) => {
            const idx = prodModal.idx
            setProdModal(null)
            const lista = await carregarEstoque()
            const e = lista.find((x) => x.produto_id === prod.id)
            const atual = itens[idx]
            const patch: Partial<VendaItem> = { produto_id: prod.id }
            if (e?.preco_venda && !atual.preco_unit) patch.preco_unit = Number(e.preco_venda)
            setI(idx, patch)
          }} />
      )}
    </Modal>
  )
}

function Resumo({ l, v, tone }: { l: string; v: string; tone?: 'pos' | 'neg' }) {
  return <div><div className="text-xs text-slate-500">{l}</div><div className={`font-semibold tabular-nums ${tone === 'neg' ? 'text-red-600' : tone === 'pos' ? 'text-emerald-700' : ''}`}>{v}</div></div>
}
