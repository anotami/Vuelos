import { createServerClient } from '@/lib/supabase'
import type { Route, PriceSnapshot } from '@/lib/supabase'
import { formatUSD, formatDate, formatDateShort, durationToHours } from '@/lib/utils'
import PriceChart from '@/components/PriceChart'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingDown, TrendingUp, BarChart2, Clock, Plane } from 'lucide-react'

type Params = { routeId: string }

async function getRouteData(routeId: string) {
  const supabase = createServerClient()

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const [routeRes, snapshotsRes] = await Promise.all([
    supabase.from('routes').select('*').eq('id', routeId).single(),
    supabase
      .from('price_snapshots')
      .select('*')
      .eq('route_id', routeId)
      .gte('search_date', since)
      .order('search_date', { ascending: false })
      .limit(500),
  ])

  return {
    route: routeRes.data as Route | null,
    snapshots: (snapshotsRes.data ?? []) as PriceSnapshot[],
  }
}

function computeStats(snapshots: PriceSnapshot[]) {
  if (snapshots.length === 0) {
    return { p25: null, median: null, minEver: null, maxEver: null }
  }

  const prices = snapshots.map((s) => s.price_usd).sort((a, b) => a - b)
  const len = prices.length

  const p25Index = Math.floor(len * 0.25)
  const medIndex = Math.floor(len * 0.5)

  const p25 = prices[p25Index]
  const median = len % 2 === 0
    ? (prices[medIndex - 1] + prices[medIndex]) / 2
    : prices[medIndex]
  const minEver = prices[0]
  const maxEver = prices[len - 1]

  return { p25, median, minEver, maxEver }
}

export default async function HistoryPage({ params }: { params: Promise<Params> }) {
  const { routeId } = await params
  const { route, snapshots } = await getRouteData(routeId)

  if (!route) {
    notFound()
  }

  const { p25, median, minEver, maxEver } = computeStats(snapshots)

  // Latest price (most recent snapshot)
  const latestSnapshot = snapshots[0] ?? null
  const todayPrice = latestSnapshot?.price_usd ?? null

  // Chart data
  const chartData = snapshots.map((s) => ({
    date: s.search_date,
    price: s.price_usd,
    departure_date: s.departure_date,
  }))

  // Last 50 for table
  const tableSnapshots = snapshots.slice(0, 50)

  const statsCards = [
    {
      label: 'Precio hoy',
      value: todayPrice !== null ? formatUSD(todayPrice) : '—',
      icon: Plane,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'P25 (90 días)',
      value: p25 !== null ? formatUSD(p25) : '—',
      icon: TrendingDown,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Mediana',
      value: median !== null ? formatUSD(median) : '—',
      icon: BarChart2,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Mínimo histórico',
      value: minEver !== null ? formatUSD(minEver) : '—',
      icon: TrendingDown,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
    },
    {
      label: 'Máximo histórico',
      value: maxEver !== null ? formatUSD(maxEver) : '—',
      icon: TrendingUp,
      color: 'text-slate-400',
      bg: 'bg-slate-800',
    },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Back nav */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft size={14} />
        Volver al dashboard
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-100">
          <span className="font-mono">{route.origin} → {route.destination}</span>
          {route.label && (
            <span className="text-slate-400 font-normal text-lg ml-2">
              — {route.label}
            </span>
          )}
        </h1>
        <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
          <Clock size={13} />
          Historial de precios · últimos 90 días ·{' '}
          {snapshots.length} snapshots
          {!route.enabled && (
            <span className="text-xs bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
              inactiva
            </span>
          )}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {statsCards.map((card) => (
          <div
            key={card.label}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${card.bg}`}>
                <card.icon size={12} className={card.color} />
              </div>
              <span className="text-xs text-slate-400 leading-tight">{card.label}</span>
            </div>
            <p className={`text-lg font-semibold font-mono ${card.color}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Price chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
        <h2 className="text-base font-semibold text-slate-100 mb-4">
          Evolución de precios
        </h2>
        {snapshots.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
            Sin datos de precios en los últimos 90 días
          </div>
        ) : (
          <PriceChart
            data={chartData}
            p25={p25}
            median={median}
            minEver={minEver}
          />
        )}
      </div>

      {/* Snapshots table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">
            Últimos {tableSnapshots.length} snapshots
          </h2>
        </div>

        {tableSnapshots.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-400 text-sm">
            No hay snapshots registrados
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-800">
                  <th className="text-left px-5 py-3">Búsqueda</th>
                  <th className="text-left px-5 py-3">Viaje</th>
                  <th className="text-right px-5 py-3">Precio</th>
                  <th className="text-left px-5 py-3 hidden md:table-cell">Aerolínea</th>
                  <th className="text-center px-5 py-3 hidden sm:table-cell">Escalas</th>
                  <th className="text-right px-5 py-3 hidden lg:table-cell">Duración</th>
                  <th className="text-left px-5 py-3 hidden md:table-cell">Fuente</th>
                  <th className="text-center px-5 py-3 hidden lg:table-cell">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tableSnapshots.map((snap) => (
                  <tr
                    key={snap.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-3 font-mono text-slate-300 text-xs">
                      {formatDateShort(snap.search_date)}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-300 text-xs">
                      {formatDate(snap.departure_date)}
                      {snap.return_date && (
                        <span className="text-slate-500 ml-1">
                          → {formatDate(snap.return_date)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-mono font-semibold text-emerald-400">
                        {formatUSD(snap.price_usd)}
                      </span>
                      {snap.is_separate_tickets && (
                        <span className="ml-1.5 text-xs text-amber-400" title="Tickets separados">
                          ✂
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-400 hidden md:table-cell">
                      {snap.airline ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-center hidden sm:table-cell">
                      <span className={snap.stops === 0 ? 'text-emerald-400' : 'text-slate-400'}>
                        {snap.stops === 0 ? 'Directo' : `${snap.stops}e`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-400 hidden lg:table-cell font-mono text-xs">
                      {snap.duration_minutes !== null
                        ? durationToHours(snap.duration_minutes)
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs hidden md:table-cell">
                      {snap.source}
                    </td>
                    <td className="px-5 py-3 text-center hidden lg:table-cell">
                      {snap.booking_link ? (
                        <a
                          href={snap.booking_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors underline"
                        >
                          Ver
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
