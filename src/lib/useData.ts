import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/** Carrega uma tabela/view com filtros opcionais. `deps` refaz a busca. */
export function useTable<T>(
  table: string,
  build?: (q: any) => any,
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    setLoading(true)
    let q: any = supabase.from(table).select('*')
    if (build) q = build(q)
    const { data, error } = await q
    if (error) setError(error.message)
    else { setError(null); setData((data ?? []) as T[]) }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { reload() }, [reload])
  return { data, loading, error, reload, setData }
}

export function erroMsg(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message)
  return String(e)
}
