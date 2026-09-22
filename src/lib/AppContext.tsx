import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Config } from './types'

interface Ctx {
  session: Session | null
  config: Config | null
  aliquotaAtual: number
  rbt12Atual: number
  reloadConfig: () => Promise<void>
}
const AppCtx = createContext<Ctx>({ session: null, config: null, aliquotaAtual: 0.04, rbt12Atual: 0, reloadConfig: async () => {} })

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [config, setConfig] = useState<Config | null>(null)
  const [aliquotaAtual, setAliquota] = useState(0.04)
  const [rbt12Atual, setRbt12] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const reloadConfig = useCallback(async () => {
    if (!session) return
    let { data } = await supabase.from('configuracoes').select('*').maybeSingle()
    if (!data) {
      const ins = await supabase.from('configuracoes').insert({}).select('*').single()
      data = ins.data
    }
    setConfig(data as Config)
    const [a, r] = await Promise.all([supabase.rpc('aliquota_efetiva'), supabase.rpc('rbt12')])
    if (a.data != null) setAliquota(Number(a.data))
    if (r.data != null) setRbt12(Number(r.data))
  }, [session])

  useEffect(() => { reloadConfig() }, [reloadConfig])

  if (!ready) return null
  return <AppCtx.Provider value={{ session, config, aliquotaAtual, rbt12Atual, reloadConfig }}>{children}</AppCtx.Provider>
}

export const useApp = () => useContext(AppCtx)
