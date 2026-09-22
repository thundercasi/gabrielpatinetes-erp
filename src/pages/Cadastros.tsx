import { useMemo, useState, type ReactNode } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTable, erroMsg } from '../lib/useData'
import { Empty, ErrorBox, Field, Modal, PageHeader } from '../components/ui'
import { UFS, type CategoriaProduto, type Cliente, type Fornecedor, type Produto } from '../lib/types'
import { Link } from 'react-router-dom'
import ProdutoModal from '../components/ProdutoModal'
import { fmtBRL, fmtMoeda } from '../lib/format'

type Tipo = 'text' | 'number' | 'textarea' | 'select' | 'checkbox'
interface Campo { key: string; label: string; tipo?: Tipo; options?: Record<string, string> | string[]; span?: 1 | 2; required?: boolean }
interface Coluna<T> { label: string; render: (r: T) => ReactNode; className?: string }

function CrudPage<T extends { id: string }>({ title, subtitle, table, campos, colunas, busca, novo }: {
  title: string; subtitle: string; table: string; campos: Campo[]; colunas: Coluna<T>[]
  busca: (r: T) => string; novo: Partial<T>
}) {
  const { data, error, reload } = useTable<T>(table, (q) => q.order('nome'))
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Partial<T> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? data.filter((r) => busca(r).toLowerCase().includes(t)) : data
  }, [data, q, busca])

  async function salvar() {
    if (!edit) return
    setBusy(true); setErro(null)
    const payload: Record<string, unknown> = {}
    for (const c of campos) {
      const v = (edit as Record<string, unknown>)[c.key]
      payload[c.key] = v === '' ? null : v
    }
    const r = edit.id
      ? await supabase.from(table).update(payload).eq('id', edit.id)
      : await supabase.from(table).insert(payload)
    setBusy(false)
    if (r.error) return setErro(r.error.message)
    setEdit(null); reload()
  }

  async function excluir(r: T) {
    if (!confirm('Excluir este registro?')) return
    const { error } = await supabase.from(table).delete().eq('id', r.id)
    if (error) alert(error.code === '23503' ? 'Não é possível excluir: existem compras/vendas ligadas a este registro.' : erroMsg(error))
    else reload()
  }

  const set = (k: string, v: unknown) => setEdit((e) => ({ ...(e as object), [k]: v }) as Partial<T>)

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={
        <>
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input className="input w-56 pl-8" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => { setErro(null); setEdit({ ...novo }) }}><Plus size={16} /> Novo</button>
        </>
      } />
      <ErrorBox msg={error} />
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>{colunas.map((c) => <th key={c.label} className={`th ${c.className ?? ''}`}>{c.label}</th>)}<th className="th w-20" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                {colunas.map((c) => <td key={c.label} className={`td ${c.className ?? ''}`}>{c.render(r)}</td>)}
                <td className="td text-right">
                  <button className="btn-ghost p-1.5" onClick={() => { setErro(null); setEdit({ ...r }) }} aria-label="Editar"><Pencil size={15} /></button>
                  <button className="btn-danger p-1.5" onClick={() => excluir(r)} aria-label="Excluir"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!lista.length && <Empty>Nenhum registro.</Empty>}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Editar ${title.toLowerCase().replace(/s$/, '')}` : `Novo em ${title.toLowerCase()}`}
        footer={<><button className="btn-ghost" onClick={() => setEdit(null)}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={salvar}>Salvar</button></>}>
        <ErrorBox msg={erro} />
        <div className="grid grid-cols-2 gap-3">
          {campos.map((c) => {
            const v = (edit as Record<string, unknown> | null)?.[c.key]
            const span = c.span === 1 ? 'col-span-2 sm:col-span-1' : 'col-span-2'
            if (c.tipo === 'checkbox') return (
              <label key={c.key} className={`${span} flex items-center gap-2 text-sm`}>
                <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(c.key, e.target.checked)} /> {c.label}
              </label>
            )
            return (
              <Field key={c.key} label={c.label + (c.required ? ' *' : '')} className={span}>
                {c.tipo === 'textarea' ? <textarea className="input" rows={2} value={(v as string) ?? ''} onChange={(e) => set(c.key, e.target.value)} />
                  : c.tipo === 'select' ? (
                    <select className="input" value={(v as string) ?? ''} onChange={(e) => set(c.key, e.target.value)}>
                      <option value="">—</option>
                      {Array.isArray(c.options)
                        ? c.options.map((o) => <option key={o} value={o}>{o}</option>)
                        : Object.entries(c.options ?? {}).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>)
                  : c.tipo === 'number' ? <input type="number" step="0.01" className="input" value={(v as number) ?? ''} onChange={(e) => set(c.key, e.target.value === '' ? null : Number(e.target.value))} />
                  : <input className="input" value={(v as string) ?? ''} onChange={(e) => set(c.key, e.target.value)} />}
              </Field>
            )
          })}
        </div>
      </Modal>
    </>
  )
}

export function Clientes() {
  return <CrudPage<Cliente> title="Clientes" subtitle="Quem compra de você" table="clientes"
    novo={{ nome: '' }}
    busca={(r) => `${r.nome} ${r.cidade ?? ''} ${r.uf ?? ''} ${r.telefone ?? ''} ${r.cpf_cnpj ?? ''}`}
    campos={[
      { key: 'nome', label: 'Nome', required: true },
      { key: 'cpf_cnpj', label: 'CPF / CNPJ', span: 1 }, { key: 'telefone', label: 'Telefone / WhatsApp', span: 1 },
      { key: 'email', label: 'E-mail' },
      { key: 'cidade', label: 'Cidade', span: 1 }, { key: 'uf', label: 'UF', tipo: 'select', options: UFS, span: 1 },
      { key: 'endereco', label: 'Endereço' }, { key: 'observacoes', label: 'Observações', tipo: 'textarea' },
    ]}
    colunas={[
      { label: 'Nome', render: (r) => <span className="font-medium">{r.nome}</span> },
      { label: 'Cidade / UF', render: (r) => [r.cidade, r.uf].filter(Boolean).join(' / ') || '—' },
      { label: 'Telefone', render: (r) => r.telefone ?? '—' },
      { label: 'CPF/CNPJ', render: (r) => r.cpf_cnpj ?? '—' },
    ]} />
}

export function Fornecedores() {
  return <CrudPage<Fornecedor> title="Fornecedores" subtitle="Fábricas, distribuidores e revendas" table="fornecedores"
    novo={{ nome: '', pais: 'China', moeda: 'USD' }}
    busca={(r) => `${r.nome} ${r.pais ?? ''} ${r.contato ?? ''}`}
    campos={[
      { key: 'nome', label: 'Nome', required: true },
      { key: 'pais', label: 'País', span: 1 }, { key: 'moeda', label: 'Moeda', tipo: 'select', options: { USD: 'Dólar (USD)', BRL: 'Real (BRL)', EUR: 'Euro (EUR)', CNY: 'Yuan (CNY)' }, span: 1 },
      { key: 'contato', label: 'Contato', span: 1 }, { key: 'telefone', label: 'Telefone / WhatsApp', span: 1 },
      { key: 'email', label: 'E-mail' }, { key: 'observacoes', label: 'Observações', tipo: 'textarea' },
    ]}
    colunas={[
      { label: 'Nome', render: (r) => <span className="font-medium">{r.nome}</span> },
      { label: 'País', render: (r) => r.pais ?? '—' },
      { label: 'Moeda', render: (r) => r.moeda },
      { label: 'Contato', render: (r) => [r.contato, r.telefone].filter(Boolean).join(' · ') || '—' },
    ]} />
}

export function Categorias() {
  return <CrudPage<CategoriaProduto> title="Categorias" subtitle="Grupos de produtos (patinete, bike, peça…). Excluir uma categoria deixa os produtos dela sem categoria." table="categorias"
    novo={{ nome: '', ativo: true }}
    busca={(r) => r.nome}
    campos={[
      { key: 'nome', label: 'Nome', required: true },
      { key: 'ativo', label: 'Ativa (aparece na lista ao cadastrar produto)', tipo: 'checkbox' },
    ]}
    colunas={[
      { label: 'Categoria', render: (r) => <span className={`font-medium ${r.ativo ? '' : 'text-slate-400 line-through'}`}>{r.nome}</span> },
    ]} />
}

export function Produtos() {
  const { data, error, reload } = useTable<Produto>('produtos', (q) => q.order('nome'))
  const cats = useTable<CategoriaProduto>('categorias', (q) => q.order('nome'))
  const catNome = useMemo(() => Object.fromEntries(cats.data.map((c) => [c.id, c.nome])), [cats.data])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [edit, setEdit] = useState<{ id: string | null } | null>(null)

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.filter((r) => (!cat || (cat === '_sem' ? !r.categoria_id : r.categoria_id === cat)) &&
      (!t || `${r.nome} ${r.marca ?? ''} ${r.modelo ?? ''} ${r.sku ?? ''} ${catNome[r.categoria_id ?? ''] ?? ''}`.toLowerCase().includes(t)))
  }, [data, q, cat, catNome])

  async function excluir(r: Produto) {
    if (!confirm(`Excluir o produto ${r.nome}?`)) return
    const { error } = await supabase.from('produtos').delete().eq('id', r.id)
    if (error) alert(error.code === '23503' ? 'Não é possível excluir: o produto tem vendas ou compras. Desmarque "Ativo" para escondê-lo.' : erroMsg(error))
    else reload()
  }

  return (
    <>
      <PageHeader title="Produtos" subtitle="Catálogo de patinetes, bikes, drones, motos e acessórios" actions={
        <>
          <select className="input w-44" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas categorias</option><option value="_sem">Sem categoria</option>
            {cats.data.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input className="input w-56 pl-8" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Link to="/categorias" className="btn-ghost">Categorias</Link>
          <button className="btn-primary" onClick={() => setEdit({ id: null })}><Plus size={16} /> Novo</button>
        </>
      } />
      <ErrorBox msg={error} />
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>
            <th className="th">Produto</th><th className="th">Categoria</th><th className="th">Marca</th>
            <th className="th text-right">Custo ref.</th><th className="th text-right">Preço venda</th><th className="th w-20" />
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setEdit({ id: r.id })}>
                <td className={`td font-medium ${r.ativo ? '' : 'text-slate-400 line-through'}`}>{r.nome}</td>
                <td className="td">{catNome[r.categoria_id ?? ''] ?? <span className="text-slate-400">—</span>}</td>
                <td className="td">{r.marca ?? '—'}</td>
                <td className="td text-right tabular-nums">{r.custo_ref_moeda != null ? fmtMoeda(r.custo_ref_moeda) : '—'}</td>
                <td className="td text-right tabular-nums">{r.preco_venda != null ? fmtBRL(r.preco_venda) : '—'}</td>
                <td className="td text-right" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-ghost p-1.5" onClick={() => setEdit({ id: r.id })} aria-label="Editar"><Pencil size={15} /></button>
                  <button className="btn-danger p-1.5" onClick={() => excluir(r)} aria-label="Excluir"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!lista.length && <Empty>Nenhum produto.</Empty>}
      </div>
      {edit && <ProdutoModal produtoId={edit.id} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); cats.reload() }} />}
    </>
  )
}
