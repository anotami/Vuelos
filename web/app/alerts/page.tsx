'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Alert, Route, PriceSnapshot, MultiStopCombo } from '@/lib/supabase'
import AlertCard from '@/components/AlertCard'
import { Bell, Filter, ArchiveX, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type AlertWithRelations = Alert & {
  route?: Route
  snapshot?: PriceSnapshot
  combo?: MultiStopCombo
}

const SEVERITY_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'high', label: '🔴 High' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'low', label: '🟢 Low' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'baseline', label: 'Baseline' },
  { value: 'absolute', label: 'Threshold' },
  { value: 'multi_stop', label: 'Multi-stop' },
]

const selectClass =
  'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors'

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertWithRelations[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [archiveAllLoading, setArchiveAllLoading] = useState(false)

  // Filters
  const [filterRoute, setFilterRoute] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterType, setFilterType] = useState('')

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ dismissed: 'false' })
      if (filterRoute) params.set('routeId', filterRoute)
      if (filterSeverity) params.set('severity', filterSeverity)
      if (filterType) params.set('alert_type', filterType)

      const [alertsRes, routesRes] = await Promise.all([
        fetch(`/api/alerts?${params.toString()}`),
        fetch('/api/routes'),
      ])

      if (alertsRes.ok) {
        const data = await alertsRes.json()
        setAlerts(data)
      }
      if (routesRes.ok) {
        const data = await routesRes.json()
        setRoutes(data)
      }
    } finally {
      setLoading(false)
    }
  }, [filterRoute, filterSeverity, filterType])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  function handleDismiss(id: number) {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleArchiveAll() {
    if (!alerts.length) return
    setArchiveAllLoading(true)
    try {
      await Promise.all(
        alerts.map((a) =>
          fetch('/api/alerts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: a.id, action: 'archive' }),
          })
        )
      )
      setAlerts([])
    } finally {
      setArchiveAllLoading(false)
    }
  }

  const routeOptions = Array.from(
    new Map(routes.map((r) => [r.id, r])).values()
  )

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 flex items-center gap-2">
            <Bell size={22} className="text-amber-400" />
            Alertas
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {alerts.length} alerta{alerts.length !== 1 ? 's' : ''} activa{alerts.length !== 1 ? 's' : ''}
          </p>
        </div>

        {alerts.length > 0 && (
          <button
            onClick={handleArchiveAll}
            disabled={archiveAllLoading}
            className="flex items-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {archiveAllLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArchiveX size={14} />
            )}
            Archivar todas
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <Filter size={14} className="text-slate-400" />
        <span className="text-xs text-slate-400 mr-1">Filtrar:</span>

        <select
          value={filterRoute}
          onChange={(e) => setFilterRoute(e.target.value)}
          className={selectClass}
        >
          <option value="">Todas las rutas</option>
          {routeOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.origin} → {r.destination}
              {r.label ? ` (${r.label})` : ''}
            </option>
          ))}
        </select>

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className={selectClass}
        >
          {SEVERITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className={selectClass}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {(filterRoute || filterSeverity || filterType) && (
          <button
            onClick={() => {
              setFilterRoute('')
              setFilterSeverity('')
              setFilterType('')
            }}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-emerald-400" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
          <Bell size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 font-medium">Sin alertas activas</p>
          <p className="text-slate-500 text-sm mt-1">
            {filterRoute || filterSeverity || filterType
              ? 'No hay alertas con los filtros seleccionados.'
              : 'Las alertas aparecerán aquí cuando se detecten precios bajos.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts
            .sort((a, b) => {
              const discA = a.discount_pct ?? 0
              const discB = b.discount_pct ?? 0
              return discB - discA
            })
            .map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={handleDismiss}
              />
            ))}
        </div>
      )}
    </div>
  )
}
