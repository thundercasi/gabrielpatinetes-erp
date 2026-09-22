import { useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTable } from '../lib/useData'
import { Badge, Empty, ErrorBox, Field, Modal, NumInput, PageHeader, Stat } from '../components/ui'
import type { EstoqueView } from '../lib/types'
import { fmtBRL, hojeISO } from '../lib/format'

export default function Estoque() {
  const { data, error, reload } = useTable<EstoqueView>('vw_estoque', (q) => q.eq('ativo', true).order('nome'))
  const [cat, setCat] = useState('')
  const [aj, setAj] = useState<{ p: EstoqueView; qtd: number; motivo: string; obs: string; data: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const lista = useMemo(() => data.filter((d) => !cat || d.categoria === cat), [data, cat])
  const categorias = useMemo(() => [...new Set(data.map((d) => d.categoria).filter(Boolean))].sort() as string[], [data])
  const valorEstoque = lista.reduce((s, d) => s + Math.max(0, d.saldo) * Number(d.custo_medio ?? 0), 0)
  const unidades = lista.reduce((s, d) => s + Math.max(0, d.saldo), 0)
  const caminho = lista.reduce((s, d) => s + Number(d.a_caminho), 0)
  const baixos = lista.filter((d) => d.estoque_minimo > 0 && d.saldo <= d.estoque_minimo).length

  async function salvarAjuste() {
    if (!aj || !aj.qtd) return
    setErro(null)
    const { error } = await supabase.from('estoque_ajustes').insert({ produto_id: aj.p.produto_id, quantidade: aj.qtd, motivo: aj.motivo, observacoes: aj.obs || null, data: aj.data })
    if (error) return setErro(error.message)
    setAj(null); reload()
  }

  return (
    <>
      <PageHeader title="Estoque" subtitle="Saldo = compras recebidas − vendas 'do estoque' ± ajustes" actions={
        <select className="input w-44" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas categorias</option>{categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      } />
      <ErrorBox msg={error} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Unidades em estoque" value={unidades} />
        <Stat label="Valor a custo" value={fmtBRL(valorEstoque)} />
        <Stat label="A caminho" value={caminho} hint="compras não recebidas" />
        <Stat label="Abaixo do mínimo" value={baixos} tone={baixos ? 'neg' : 'default'} />
      </div>
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>
            <th className="th">Produto</th><th className="th">Categoria</th><th className="th text-right">Recebido</th><th className="th text-right">Vendido</th>
            <th className="th text-right">Ajustes</th><th className="th text-right">Saldo</th><th className="th text-right">A caminho</th>
            <th className="th text-right">Custo médio</th><th className="th text-right">Preço venda</th><th className="th" />
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((d) => (
              <tr key={d.produto_id} className="hover:bg-slate-50">
                <td className="td font-medium">{d.nome}</td>
                <td className="td">{d.categoria ?? '—'}</td>
                <td className="td text-right tabular-nums">{d.recebido}</td>
                <td className="td text-right tabular-nums">{d.vendido}</td>
                <td className="td text-right tabular-nums">{d.ajustes}</td>
                <td className="td text-right tabular-nums">
                  <Badge className={d.saldo < 0 ? 'bg-red-100 text-red-700' : d.estoque_minimo > 0 && d.saldo <= d.estoque_minimo ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>{d.saldo}</Badge>
                </td>
                <td className="td text-right tabular-nums">{d.a_caminho || '—'}</td>
                <td className="td text-right tabular-nums">{d.custo_medio != null ? fmtBRL(d.custo_medio) : '—'}</td>
                <td className="td text-right tabular-nums">{d.preco_venda != null ? fmtBRL(d.preco_venda) : '—'}</td>
                <td className="td text-right"><button className="btn-ghost p-1.5" title="Ajustar estoque" onClick={() => setAj({ p: d, qtd: 0, motivo: 'ajuste', obs: '', data: hojeISO() })}><SlidersHorizontal size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!lista.length && <Empty>Nenhum produto ativo.</Empty>}
      </div>
      <p className="mt-3 text-xs text-slate-500">Vendas "sob encomenda" (custo digitado em USD) não baixam o estoque — são itens comprados especificamente para o cliente. Para baixar, escolha "Do estoque" no item da venda.</p>

      <Modal open={!!aj} onClose={() => setAj(null)} title={`Ajustar estoque – ${aj?.p.nome ?? ''}`}
        footer={<><button className="btn-ghost" onClick={() => setAj(null)}>Cancelar</button><button className="btn-primary" onClick={salvarAjuste}>Salvar ajuste</button></>}>
        <ErrorBox msg={erro} />
        {aj && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade (+ entra / − sai)"><NumInput step="1" value={aj.qtd} onChange={(n) => setAj({ ...aj, qtd: Math.round(n) })} /></Field>
            <Field label="Motivo">
              <select className="input" value={aj.motivo} onChange={(e) => setAj({ ...aj, motivo: e.target.value })}>
                <option value="ajuste">Ajuste</option><option value="inventario">Inventário</option><option value="quebra">Quebra</option>
                <option value="avaria">Avaria</option><option value="devolucao">Devolução</option><option value="brinde">Brinde</option>
              </select>
            </Field>
            <Field label="Data"><input type="date" className="input" value={aj.data} onChange={(e) => setAj({ ...aj, data: e.target.value })} /></Field>
            <Field label="Saldo atual → novo"><div className="py-2 text-sm tabular-nums">{aj.p.saldo} → <b>{aj.p.saldo + aj.qtd}</b></div></Field>
            <Field label="Observações" className="col-span-2"><input className="input" value={aj.obs} onChange={(e) => setAj({ ...aj, obs: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </>
  )
}
