import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ErrorBox, Field, Modal, NumInput } from './ui'
import type { CategoriaProduto, Produto } from '../lib/types'

type Form = Partial<Produto>

/** Cadastro/edição de produto em janela – usado na tela Produtos e dentro da venda. */
export default function ProdutoModal({ produtoId, nomeInicial, onClose, onSaved }: {
  produtoId: string | null            // null = novo
  nomeInicial?: string
  onClose: () => void
  onSaved: (p: Produto) => void
}) {
  const [f, setF] = useState<Form | null>(null)
  const [cats, setCats] = useState<CategoriaProduto[]>([])
  const [novaCat, setNovaCat] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function carregarCats() {
    const { data } = await supabase.from('categorias').select('*').order('nome')
    setCats((data ?? []) as CategoriaProduto[])
  }
  useEffect(() => {
    carregarCats()
    if (produtoId) supabase.from('produtos').select('*').eq('id', produtoId).single().then(({ data }) => setF(data as Produto))
    else setF({ nome: nomeInicial ?? '', ativo: true, estoque_minimo: 0, categoria_id: null })
  }, [produtoId, nomeInicial])

  const set = (patch: Form) => setF((x) => ({ ...(x ?? {}), ...patch }))

  async function criarCategoria() {
    const nome = (novaCat ?? '').trim()
    if (!nome) return
    const { data, error } = await supabase.from('categorias').insert({ nome }).select('*').single()
    if (error) return setErro(error.code === '23505' ? 'Já existe uma categoria com esse nome.' : error.message)
    await carregarCats(); set({ categoria_id: data.id }); setNovaCat(null)
  }

  async function salvar() {
    if (!f) return
    setErro(null)
    if (!f.nome?.trim()) return setErro('Informe o nome do produto.')
    setBusy(true)
    const payload = {
      nome: f.nome.trim(), categoria_id: f.categoria_id || null, marca: f.marca || null, modelo: f.modelo || null, sku: f.sku || null,
      custo_ref_moeda: f.custo_ref_moeda ?? null, preco_venda: f.preco_venda ?? null, estoque_minimo: f.estoque_minimo ?? 0,
      ativo: f.ativo ?? true, observacoes: f.observacoes || null,
    }
    const r = produtoId
      ? await supabase.from('produtos').update(payload).eq('id', produtoId).select('*').single()
      : await supabase.from('produtos').insert(payload).select('*').single()
    setBusy(false)
    if (r.error) return setErro(r.error.message)
    onSaved(r.data as Produto)
  }

  return (
    <Modal open onClose={onClose} title={produtoId ? 'Editar produto' : 'Novo produto'}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || !f} onClick={salvar}>Salvar produto</button></>}>
      <ErrorBox msg={erro} />
      {f && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome *" className="col-span-2"><input className="input" autoFocus value={f.nome ?? ''} onChange={(e) => set({ nome: e.target.value })} /></Field>
          <Field label="Categoria" className="col-span-2 sm:col-span-1">
            {novaCat === null ? (
              <div className="flex gap-2">
                <select className="input" value={f.categoria_id ?? ''} onChange={(e) => set({ categoria_id: e.target.value || null })}>
                  <option value="">— sem categoria —</option>
                  {cats.filter((c) => c.ativo || c.id === f.categoria_id).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <button type="button" className="btn-ghost shrink-0 px-2" title="Nova categoria" onClick={() => setNovaCat('')}><Plus size={16} /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input className="input" autoFocus placeholder="Nome da nova categoria" value={novaCat}
                  onChange={(e) => setNovaCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && criarCategoria()} />
                <button type="button" className="btn-primary shrink-0 px-3" onClick={criarCategoria}>Criar</button>
                <button type="button" className="btn-ghost shrink-0 px-2" onClick={() => setNovaCat(null)}>✕</button>
              </div>
            )}
          </Field>
          <Field label="Marca" className="col-span-2 sm:col-span-1"><input className="input" value={f.marca ?? ''} onChange={(e) => set({ marca: e.target.value })} /></Field>
          <Field label="Modelo" className="col-span-2 sm:col-span-1"><input className="input" value={f.modelo ?? ''} onChange={(e) => set({ modelo: e.target.value })} /></Field>
          <Field label="SKU / código" className="col-span-2 sm:col-span-1"><input className="input" value={f.sku ?? ''} onChange={(e) => set({ sku: e.target.value })} /></Field>
          <Field label="Custo de referência (USD)" className="col-span-2 sm:col-span-1"><NumInput value={f.custo_ref_moeda} onChange={(n) => set({ custo_ref_moeda: n || null })} /></Field>
          <Field label="Preço de venda (R$)" className="col-span-2 sm:col-span-1"><NumInput value={f.preco_venda} onChange={(n) => set({ preco_venda: n || null })} /></Field>
          <Field label="Estoque mínimo" className="col-span-2 sm:col-span-1"><NumInput step="1" value={f.estoque_minimo} onChange={(n) => set({ estoque_minimo: Math.round(n) })} /></Field>
          <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-sm sm:col-span-1">
            <input type="checkbox" checked={f.ativo ?? true} onChange={(e) => set({ ativo: e.target.checked })} /> Ativo
          </label>
          <Field label="Observações" className="col-span-2"><textarea rows={2} className="input" value={f.observacoes ?? ''} onChange={(e) => set({ observacoes: e.target.value })} /></Field>
        </div>
      )}
    </Modal>
  )
}
