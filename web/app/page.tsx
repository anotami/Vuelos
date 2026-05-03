export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase'
import type { Alert, RouteSummary } from '@/lib/supabase'
import { formatUSD, formatDate, calcDiscountPct } from '@/lib/utils'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Route, Bell, TrendingDown, Clock } from 'lucide-react'
import AlertCard from '@/components/AlertCard'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function getPriceColorClass(
  price: number | null,
  p25: number | null,
  median: number | null
): string {
  if (price === null) return 'text-slate-100'
  if (p25 !== null && price < p25) return 'text-emerald-400'
  if (median !== null && price < median) return 'text-amber-400'
  return 'text-slate-100'
}

export default async function DashboardPage() {
  const supabase = createServerClient()

  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const [summaryRes, alertsRes] = await Promise.all([
    supabase.from('route_summary').select('*').order('origin'),
    supabase
      .from('alerts')
      .select('*, route:routes(*)')
      .eq('is_dismissed', false)
      .eq('is_archived', false)
      .gte('created_at', today)
      .order('discount_pct', { ascending: false })
      .limit(5),
  ])

  const routes: RouteSummary[] = summaryRes.data ?? []
  const alerts = (alertsRes.data ?? []) as (Alert & { route?: import('@/lib/supabase').Route })[]

  const activeRoutes = routes.filter((r) => r.enabled).length

  // min price this week across all routes
  let weekMinPrice: number | null = null
  if (routes.length > 0) {
    const pricesRes = await supabase
      .from('price_snapshots')
      .select('price_usd')
      .gte('search_date', weekAgo)
      .order('price_usd', { ascending: true })
      .limit(1)
    if (pricesRes.data && pricesRes.data.length > 0) {
      weekMinPrice = pricesRes.data[0].price_usd
    }
  }

  const lastSearched = routes
    .map((r) => r.last_searched)
    .filter(Boolean)
    .sort()
    .at(-1)

  const statsCards = [
    {
      label: 'Rutas activas',
      value: String(activeRoutes),
      icon: Route,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Alertas activas hoy',
      value: String(alerts.length),
      icon: Bell,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Precio más bajo (semana)',
      value: weekMinPrice !== null ? formatUSD(weekMinPrice) : '—',
      icon: TrendingDown,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
    },
    {
      label: 'Último escaneo',
      value: lastSearched ? formatDate(lastSearched) : '—',
      icon: Clock,
      color: 'text-slate-400',
      bg: 'bg-slate-800',
    },
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-100">
          {getGreeting()}, Gabo 👋
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          {formatDate(new Date().toISOString())}
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statsCards.map((card) => (
          <div
            key={card.label}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', card.bg)}>
                <card.icon size={16} className={card.color} />
              </div>
              <span className="text-xs text-slate-400">{card.label}</span>
            </div>
            <p className={cn('text-2xl font-semibold font-mono', card.color)}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100">
              🔥 Ofertas detectadas
            </h2>
            <Link
              href="/alerts"
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Ver todas →
            </Link>
          </div>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} compact />
            ))}
          </div>
        </section>
      )}

      {/* Route grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Rutas monitoreadas</h2>
          <Link
            href="/routes"
            className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Gestionar →
          </Link>
        </div>

        {routes.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <p className="text-slate-400">No hay rutas configuradas.</p>
            <Link
              href="/routes"
              className="mt-4 inline-block text-sm text-emerald-400 hover:text-emerald-300"
            >
              Agregar primera ruta →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {routes.map((route) => {
              const discountVsP25 =
                route.latest_price !== null && route.p25_overall !== null
                  ? calcDiscountPct(route.latest_price, route.p25_overall)
                  : null

              const priceColor = getPriceColorClass(
                route.latest_price,
                route.p25_overall,
                route.median
              )

              return (
                <Link
                  key={route.id}
                  href={`/history/${route.id}`}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-colors block group"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="font-mono text-lg font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">
                        {route.origin} → {route.destination}
                      </span>
                      {route.label && (
                        <p className="text-xs text-slate-400 mt-0.5">{route.label}</p>
                      )}
                    </div>
                    {!route.enabled && (
                      <span className="text-xs bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
                        inactiva
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-end gap-2 mb-3">
                    <span className={cn('text-3xl font-mono font-bold', priceColor)}>
                      {route.latest_price !== null
                        ? formatUSD(route.latest_price)
                        : '—'}
                    </span>
                    {discountVsP25 !== null && discountVsP25 > 0 && (
                      <span className="text-sm text-emerald-400 font-mono mb-1">
                        -{discountVsP25.toFixed(0)}% vs P25
                      </span>
                    )}
                    {discountVsP25 !== null && discountVsP25 < 0 && (
                      <span className="text-sm text-slate-500 font-mono mb-1">
                        +{Math.abs(discountVsP25).toFixed(0)}% vs P25
                      </span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-xs font-mono mb-3">
                    <div>
                      <span className="text-slate-500">Mín </span>
                      <span className="text-rose-400">
                        {route.min_price_ever !== null
                          ? formatUSD(route.min_price_ever)
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">P25 </span>
                      <span className="text-emerald-400">
                        {route.p25_overall !== null
                          ? formatUSD(route.p25_overall)
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Med </span>
                      <span className="text-amber-400">
                        {route.median !== null
                          ? formatUSD(route.median)
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <p className="text-xs text-slate-500">
                    {route.snapshot_count} snapshots
                    {route.last_searched && (
                      <> · último escaneo: {formatDate(route.last_searched)}</>
                    )}
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
