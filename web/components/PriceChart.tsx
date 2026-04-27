'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { formatUSD, formatDateShort } from '@/lib/utils'

type Props = {
  data: Array<{ date: string; price: number; departure_date: string }>
  p25: number | null
  median: number | null
  minEver: number | null
}

type GroupedPoint = {
  date: string
  price: number
}

type TooltipPayloadEntry = {
  value: number
  name: string
}

type CustomTooltipProps = {
  active?: boolean
  label?: string
  payload?: TooltipPayloadEntry[]
}

function CustomTooltip({ active, label, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-mono text-emerald-400 font-semibold">
        {formatUSD(payload[0].value)}
      </p>
    </div>
  )
}

export default function PriceChart({ data, p25, median, minEver }: Props) {
  // Group by date — average price per day
  const grouped = data.reduce<Record<string, { sum: number; count: number }>>(
    (acc, point) => {
      if (!acc[point.date]) {
        acc[point.date] = { sum: 0, count: 0 }
      }
      acc[point.date].sum += point.price
      acc[point.date].count += 1
      return acc
    },
    {}
  )

  const chartData: GroupedPoint[] = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      date: formatDateShort(date),
      price: Math.round(sum / count),
    }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        Sin datos suficientes para mostrar el gráfico
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={chartData}
        margin={{ top: 10, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${v}`}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#10b981' }}
        />
        {p25 !== null && (
          <ReferenceLine
            y={p25}
            stroke="#10b981"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{
              value: `P25 ${formatUSD(p25)}`,
              fill: '#10b981',
              fontSize: 10,
              position: 'insideTopRight',
            }}
          />
        )}
        {median !== null && (
          <ReferenceLine
            y={median}
            stroke="#f59e0b"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{
              value: `Med ${formatUSD(median)}`,
              fill: '#f59e0b',
              fontSize: 10,
              position: 'insideTopRight',
            }}
          />
        )}
        {minEver !== null && (
          <ReferenceLine
            y={minEver}
            stroke="#f43f5e"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{
              value: `Min ${formatUSD(minEver)}`,
              fill: '#f43f5e',
              fontSize: 10,
              position: 'insideBottomRight',
            }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
