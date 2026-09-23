import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { addMeses, fimMes, fmtBRL, hojeISO, inicioMes, nomeMes } from '../lib/format'

interface Linha { data: string; receita: number }
const moedaCurta = (n: number) => Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : String(n)

/** Dois gráficos: faturamento acumulado e faturamento de cada dia, dia a dia no mês escolhido, comparado com o mês anterior. */
export default function CurvaVendasMes({ mes }: { mes: string }) {
  const [atual, setAtual] = useState<Linha[]>([])
  const [anterior, setAnterior] = useState<Linha[]>([])
  const mesAnt = addMeses(inicioMes(mes), -1).slice(0, 7)

  useEffect(() => {
    let ativo = true
    const buscar = (m: string) => supabase.from('vw_vendas').select('data, receita')
      .gte('data', inicioMes(m)).lte('data', fimMes(m)).not('status', 'in', '(cancelado,orcamento)').range(0, 4999)
    Promise.all([buscar(mes), buscar(mesAnt)]).then(([a, b]) => {
      if (!ativo) return
      setAtual((a.data ?? []) as Linha[]); setAnterior((b.data ?? []) as Linha[])
    })
    return () => { ativo = false }
  }, [mes, mesAnt])

  const { serie, total, totalAnt, noMesmoDia, diaHoje } = useMemo(() => {
    const porDia = (ls: Linha[]) => {
      const d = new Map<number, number>()
      for (const l of ls) d.set(Number(l.data.slice(8, 10)), (d.get(Number(l.data.slice(8, 10))) ?? 0) + Number(l.receita))
      return d
    }
    const dA = porDia(atual), dB = porDia(anterior)
    const diasMes = Number(fimMes(mes).slice(8, 10)), diasAnt = Number(fimMes(mesAnt).slice(8, 10))
    const hoje = hojeISO()
    // no mês corrente a curva para em hoje; meses passados vão até o fim
    const ultimoDia = hoje.slice(0, 7) === mes ? Number(hoje.slice(8, 10)) : hoje < inicioMes(mes) ? 0 : diasMes
    let accA = 0, accB = 0, noMesmoDia = 0
    const serie = Array.from({ length: Math.max(diasMes, diasAnt) }, (_, i) => {
      const dia = i + 1
      accA += dA.get(dia) ?? 0; accB += dB.get(dia) ?? 0
      if (dia === ultimoDia) noMesmoDia = accB
      return {
        dia,
        doDia: dA.get(dia) ?? 0,
        diaAtual: dia <= ultimoDia ? dA.get(dia) ?? 0 : null,
        diaAnterior: dia <= diasAnt ? dB.get(dia) ?? 0 : null,
        atual: dia <= ultimoDia ? accA : null,
        anterior: dia <= diasAnt ? accB : null,
      }
    })
    return { serie, total: accA, totalAnt: accB, noMesmoDia, diaHoje: ultimoDia }
  }, [atual, anterior, mes, mesAnt])

  const nomeAtual = nomeMes(mes), nomeAnt = nomeMes(mesAnt)
  const emAndamento = diaHoje > 0 && diaHoje < serie.length && hojeISO().slice(0, 7) === mes
  const ref = emAndamento ? noMesmoDia : totalAnt
  const variacao = ref > 0 ? total / ref - 1 : null

  return (
    <>
    <section className="card p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Curva de vendas no mês (faturamento acumulado)</h2>
        <span className="text-xs text-slate-500">
          {fmtBRL(total)}
          {variacao !== null && <> · <span className={variacao < 0 ? 'text-red-600' : 'text-emerald-700'}>{variacao >= 0 ? '+' : ''}{(variacao * 100).toFixed(0)}%</span> vs {nomeAnt}{emAndamento ? ` até o dia ${diaHoje}` : ''}</>}
        </span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serie} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={12} interval="preserveStartEnd" minTickGap={12} />
            <YAxis tickFormatter={moedaCurta} tickLine={false} axisLine={false} fontSize={12} width={56} />
            <Tooltip
              labelFormatter={(d) => `Dia ${d}`}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(val, nome, item) => {
                const acum = fmtBRL(Number(val))
                if (nome === nomeAtual) return [`${acum} (no dia: ${fmtBRL(Number(item.payload.doDia))})`, nome]
                return [acum, nome]
              }}
            />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
            <Line name={nomeAnt} dataKey="anterior" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
            <Line name={nomeAtual} dataKey="atual" stroke="#059669" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>

    <section className="card p-4">
      <h2 className="mb-2 text-sm font-semibold">Vendas por dia ({nomeAtual} × {nomeAnt})</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serie} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={12} interval="preserveStartEnd" minTickGap={12} />
            <YAxis tickFormatter={moedaCurta} tickLine={false} axisLine={false} fontSize={12} width={56} />
            <Tooltip labelFormatter={(d) => `Dia ${d}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(val, nome) => [fmtBRL(Number(val)), nome]} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
            <Line name={nomeAnt} dataKey="diaAnterior" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2, strokeDasharray: '' }} connectNulls={false} isAnimationActive={false} />
            <Line name={nomeAtual} dataKey="diaAtual" stroke="#059669" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
    </>
  )
}
