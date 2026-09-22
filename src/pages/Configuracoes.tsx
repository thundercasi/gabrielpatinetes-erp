import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/AppContext'
import { ErrorBox, Field, NumInput, PageHeader, PctInput } from '../components/ui'
import type { Config } from '../lib/types'
import { FAIXAS_ANEXO_I, aliquotaEfetivaAnexoI } from '../lib/calc'
import { fmtBRL, fmtPct, mesAtual } from '../lib/format'

export default function Configuracoes() {
  const { config, reloadConfig, rbt12Atual, aliquotaAtual } = useApp()
  const [c, setC] = useState<Config | null>(config)
  const [ok, setOk] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [simular, setSimular] = useState(0)
  useEffect(() => setC(config), [config])
  if (!c) return null

  async function salvar() {
    if (!c) return
    setErro(null); setOk(false)
    const { user_id, ...rest } = c
    const { error } = await supabase.from('configuracoes').update({ ...rest, updated_at: new Date().toISOString() }).eq('user_id', user_id)
    if (error) return setErro(error.message)
    await reloadConfig(); setOk(true)
  }

  return (
    <>
      <PageHeader title="Configurações" subtitle="Padrões de importação e Simples Nacional" actions={<button className="btn-primary" onClick={salvar}>Salvar</button>} />
      <ErrorBox msg={erro} />
      {ok && <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Configurações salvas.</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Empresa e importação</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome da empresa" className="col-span-2"><input className="input" value={c.nome_empresa ?? ''} onChange={(e) => setC({ ...c, nome_empresa: e.target.value || null })} /></Field>
            <Field label="CNPJ" className="col-span-2"><input className="input" value={c.cnpj ?? ''} onChange={(e) => setC({ ...c, cnpj: e.target.value || null })} /></Field>
            <Field label="Dólar padrão (R$)"><NumInput step="0.0001" value={c.cambio_padrao} onChange={(n) => setC({ ...c, cambio_padrao: n })} /></Field>
            <Field label="Freteiro padrão (% da compra)"><PctInput value={Number(c.freteiro_pct_padrao)} onChange={(n) => setC({ ...c, freteiro_pct_padrao: n })} /></Field>
          </div>
          <p className="mt-3 text-xs text-slate-500">Esses valores vêm preenchidos em cada nova compra e venda "sob encomenda", e podem ser alterados item a item.</p>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Simples Nacional (Anexo I – Comércio)</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cálculo da alíquota" className="col-span-2">
              <select className="input" value={c.modo_aliquota} onChange={(e) => setC({ ...c, modo_aliquota: e.target.value as Config['modo_aliquota'] })}>
                <option value="auto">Automático pelo faturamento dos últimos 12 meses (RBT12)</option>
                <option value="fixa">Alíquota fixa (informada pelo contador)</option>
              </select>
            </Field>
            {c.modo_aliquota === 'fixa' ? (
              <Field label="Alíquota efetiva"><PctInput value={Number(c.aliquota_fixa)} onChange={(n) => setC({ ...c, aliquota_fixa: n })} /></Field>
            ) : (
              <>
                <Field label="Faturamento 12 meses antes do sistema (R$)"><NumInput value={c.rbt12_inicial} onChange={(n) => setC({ ...c, rbt12_inicial: n })} /></Field>
                <Field label="Mês em que começou a usar o sistema">
                  <input type="month" className="input" value={(c.rbt12_inicial_ref ?? '').slice(0, 7)} onChange={(e) => setC({ ...c, rbt12_inicial_ref: e.target.value ? `${e.target.value}-01` : null })} placeholder={mesAtual()} />
                </Field>
              </>
            )}
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
            RBT12 hoje: <b>{fmtBRL(rbt12Atual)}</b> → alíquota aplicada nas novas vendas: <b>{fmtPct(aliquotaAtual, 2)}</b>
          </div>
          <p className="mt-2 text-xs text-slate-500">O valor inicial sai da conta 1/12 por mês, enquanto as vendas lançadas no sistema entram. Confirme sempre com seu contador — produtos com ICMS-ST ou monofásicos podem ter alíquota menor.</p>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Tabela Anexo I e simulador</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <table className="min-w-full text-sm">
              <thead><tr><th className="th">Receita 12 meses até</th><th className="th text-right">Nominal</th><th className="th text-right">Parcela a deduzir</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {FAIXAS_ANEXO_I.map((f) => <tr key={f.ate}><td className="td">{fmtBRL(f.ate)}</td><td className="td text-right">{fmtPct(f.nominal, 2)}</td><td className="td text-right">{fmtBRL(f.deduzir)}</td></tr>)}
              </tbody>
            </table>
            <div>
              <Field label="Simular RBT12 (R$)"><NumInput value={simular} onChange={setSimular} /></Field>
              <p className="mt-2 text-sm">Alíquota efetiva: <b>{fmtPct(aliquotaEfetivaAnexoI(simular), 2)}</b></p>
              <p className="mt-1 text-xs text-slate-500">Fórmula: (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
