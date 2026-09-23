import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import type { EstoqueView } from '../lib/types'

const SEM_MARCA = 'Sem marca'
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Seleção de produto com busca por nome e lista agrupada por marca. */
export default function ProdutoPicker({ produtos, value, onChange }: {
  produtos: EstoqueView[]
  value: string | null
  onChange: (produtoId: string) => void   // '' = avulso
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [marca, setMarca] = useState('')
  const [ativo, setAtivo] = useState(0)
  const caixa = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const selecionado = produtos.find((p) => p.produto_id === value)

  const marcas = useMemo(() => {
    const s = new Set(produtos.filter((p) => p.ativo).map((p) => p.marca?.trim() || SEM_MARCA))
    return [...s].sort((a, b) => a === SEM_MARCA ? 1 : b === SEM_MARCA ? -1 : a.localeCompare(b, 'pt-BR'))
  }, [produtos])

  // grupos filtrados, marcas em ordem alfabética e "Sem marca" no fim
  const grupos = useMemo(() => {
    const termos = norm(busca).split(/\s+/).filter(Boolean)
    const m = new Map<string, EstoqueView[]>()
    for (const p of produtos) {
      if (!p.ativo && p.produto_id !== value) continue
      const g = p.marca?.trim() || SEM_MARCA
      if (marca && g !== marca) continue
      const alvo = norm([p.nome, p.marca, p.modelo, p.sku].filter(Boolean).join(' '))
      if (!termos.every((t) => alvo.includes(t))) continue
      m.set(g, [...(m.get(g) ?? []), p])
    }
    return [...m.entries()]
      .sort(([a], [b]) => a === SEM_MARCA ? 1 : b === SEM_MARCA ? -1 : a.localeCompare(b, 'pt-BR'))
      .map(([g, itens]) => [g, itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))] as const)
  }, [produtos, busca, marca, value])
  const planos = useMemo(() => grupos.flatMap(([, itens]) => itens), [grupos])

  useEffect(() => { setAtivo(0) }, [busca, marca])
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  useEffect(() => {
    lista.current?.querySelector(`[data-i="${ativo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [ativo])

  function escolher(id: string) { onChange(id); setAberto(false); setBusca('') }
  function teclas(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((i) => Math.min(i + 1, planos.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (planos[ativo]) escolher(planos[ativo].produto_id) }
    else if (e.key === 'Escape') { e.stopPropagation(); setAberto(false) }   // não fecha a janela da venda
  }

  let i = -1
  return (
    <div ref={caixa} className="relative min-w-0 flex-1">
      <button type="button" className="input flex items-center justify-between gap-2 text-left" onClick={() => setAberto((a) => !a)}>
        <span className={`truncate ${selecionado ? '' : 'text-slate-500'}`}>
          {selecionado ? <>{selecionado.marca && <span className="text-slate-400">{selecionado.marca} · </span>}{selecionado.nome}</> : '— avulso (use a descrição) —'}
        </span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>

      {aberto && (
        <div className="absolute left-0 z-30 mt-1 w-full min-w-[18rem] rounded-lg border border-slate-200 bg-white shadow-lg sm:min-w-[28rem]">
          <div className="flex gap-2 border-b border-slate-100 p-2">
            <div className="relative flex-1">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input autoFocus className="input py-1.5 pl-8 pr-7" placeholder="Filtrar pelo nome…" value={busca}
                onChange={(e) => setBusca(e.target.value)} onKeyDown={teclas} />
              {busca && <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setBusca('')} aria-label="Limpar"><X size={14} /></button>}
            </div>
            <select className="input w-40 py-1.5" value={marca} onChange={(e) => setMarca(e.target.value)} onKeyDown={teclas}>
              <option value="">Todas as marcas</option>
              {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div ref={lista} className="max-h-72 overflow-y-auto py-1 text-sm">
            <button type="button" className={`block w-full px-3 py-1.5 text-left text-slate-500 hover:bg-slate-50 ${!value ? 'font-medium' : ''}`} onClick={() => escolher('')}>
              — avulso (use a descrição) —
            </button>
            {grupos.map(([g, itens]) => (
              <div key={g}>
                <div className="sticky top-0 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{g} <span className="font-normal">({itens.length})</span></div>
                {itens.map((p) => {
                  i += 1
                  const n = i
                  return (
                    <button key={p.produto_id} type="button" data-i={n}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left ${n === ativo ? 'bg-brand-50' : 'hover:bg-slate-50'} ${p.produto_id === value ? 'font-medium text-brand-700' : ''}`}
                      onMouseEnter={() => setAtivo(n)} onClick={() => escolher(p.produto_id)}>
                      <span className="truncate">{p.nome}{!p.ativo && <span className="ml-1 text-xs text-slate-400">(inativo)</span>}</span>
                      {Number(p.saldo) !== 0 && <span className={`shrink-0 text-xs ${p.saldo < 0 ? 'text-red-600' : 'text-emerald-700'}`}>estoque {p.saldo}</span>}
                    </button>
                  )
                })}
              </div>
            ))}
            {!planos.length && <div className="px-3 py-4 text-center text-slate-400">Nenhum produto encontrado.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
