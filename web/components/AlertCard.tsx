'use client'

import type { Alert, Route, PriceSnapshot, MultiStopCombo } from '@/lib/supabase'
import {
  formatUSD,
  formatDate,
  getSeverityBorderColor,
  cn,
} from '@/lib/utils'
import { ExternalLink, X, Archive } from 'lucide-react'
import { useState } from 'react'
import MultiStopBadge from './MultiStopBadge'

type Props = {
  alert: Alert & { route?: Route; snapshot?: PriceSnapshot; combo?: MultiStopCombo }
  onDismiss?: (id: number) => void
  compact?: boolean
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  baseline: 'Baseline',
  absolute: 'Threshold',
  multi_stop: 'Multi-stop',
}

const SEVERITY_BADGE: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  high: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
}

const SEVERITY_ICON: Record<string, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🔴',
}

const TYPE_BADGE: Record<string, string> = {
  baseline: 'bg-slate-800 text-slate-300 border-slate-700',
  absolute: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  multi_stop: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
}

export default function AlertCard({ alert, onDismiss, compact = false }: Props) {
  const [showCombo, setShowCombo] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)

  if (dismissed) return null

  const borderColor = getSeverityBorderColor(alert.severity)

  async function handleDismiss() {
    setLoading(true)
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alert.id, action: 'dismiss' }),
      })
      setDismissed(true)
      onDismiss?.(alert.id)
    } finally {
      setLoading(false)
    }
  }

  async function handleArchive() {
    setLoading(true)
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alert.id, action: 'archive' }),
      })
      setDismissed(true)
    } finally {
      setLoading(false)
    }
  }

  const routeLabel = alert.route
    ? `${alert.route.origin} → ${alert.route.destination}`
    : alert.route_id

  if (compact) {
    return (
      <div
        className={cn(
          'bg-slate-900 border border-slate-800 rounded-xl p-4 border-l-4',
          borderColor
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base">{SEVERITY_ICON[alert.severity]}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-slate-100">
                  {routeLabel}
                </span>
                <span
                  className={cn(
                    'text-xs border rounded-full px-2 py-0.5',
                    ALERT_TYPE_LABELS[alert.alert_type]
                      ? TYPE_BADGE[alert.alert_type]
                      : 'bg-slate-800 text-slate-300'
                  )}
                >
                  {ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {formatDate(alert.created_at)}
                {alert.baseline_p25 !== null && alert.discount_pct !== null && (
                  <> · P25: {formatUSD(alert.baseline_p25)} → -{alert.discount_pct.toFixed(0)}% ahorro</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono text-xl font-bold text-emerald-400">
              {formatUSD(alert.triggered_price)}
            </span>
            <button
              onClick={handleDismiss}
              disabled={loading}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-slate-900 border border-slate-800 rounded-xl p-5 border-l-4',
        borderColor
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3">
          <span className="text-lg mt-0.5">{SEVERITY_ICON[alert.severity]}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-base font-semibold text-slate-100">
                {routeLabel}
              </span>
              {alert.route?.label && (
                <span className="text-xs text-slate-400">{alert.route.label}</span>
              )}
              <span
                className={cn(
                  'text-xs border rounded-full px-2 py-0.5',
                  TYPE_BADGE[alert.alert_type]
                )}
              >
                {ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
              </span>
              <span
                className={cn(
                  'text-xs border rounded-full px-2 py-0.5',
                  SEVERITY_BADGE[alert.severity]
                )}
              >
                {alert.severity}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Detectado: {formatDate(alert.created_at)}
            </p>
          </div>
        </div>

        {/* Price */}
        <div className="text-right shrink-0">
          <span className="font-mono text-3xl font-bold text-emerald-400">
            {formatUSD(alert.triggered_price)}
          </span>
          {alert.discount_pct !== null && (
            <p className="text-sm text-emerald-400 font-mono">
              -{alert.discount_pct.toFixed(0)}% ahorro
            </p>
          )}
        </div>
      </div>

      {/* Baseline info */}
      {alert.baseline_p25 !== null && (
        <div className="bg-slate-800/50 rounded-lg px-3 py-2 mb-3 text-sm">
          <span className="text-slate-400">P25 baseline: </span>
          <span className="font-mono text-emerald-400">{formatUSD(alert.baseline_p25)}</span>
          {alert.discount_pct !== null && (
            <span className="text-slate-400">
              {' '}→ ahorro del{' '}
              <span className="text-emerald-400 font-mono">{alert.discount_pct.toFixed(1)}%</span>
            </span>
          )}
        </div>
      )}

      {/* Snapshot info */}
      {alert.snapshot && (
        <div className="text-xs text-slate-400 mb-3 space-y-0.5">
          <p>
            <span className="text-slate-500">Vuelo: </span>
            <span className="font-mono">{formatDate(alert.snapshot.departure_date)}</span>
            {alert.snapshot.airline && (
              <>
                {' · '}
                <span>{alert.snapshot.airline}</span>
              </>
            )}
            {' · '}
            <span>
              {alert.snapshot.stops === 0 ? 'directo' : `${alert.snapshot.stops} escala(s)`}
            </span>
          </p>
        </div>
      )}

      {/* Multi-stop combo */}
      {alert.combo && (
        <div className="mb-3">
          <button
            onClick={() => setShowCombo(!showCombo)}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            {showCombo ? '▲ Ocultar desglose' : '▼ Ver desglose multi-stop'}
          </button>
          {showCombo && (
            <div className="mt-2">
              <MultiStopBadge combo={alert.combo} />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
        {alert.snapshot?.booking_link && (
          <a
            href={alert.snapshot.booking_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            <ExternalLink size={12} />
            Ver vuelo
          </a>
        )}
        <button
          onClick={handleDismiss}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <X size={12} />
          Dismiss
        </button>
        <button
          onClick={handleArchive}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <Archive size={12} />
          Archivar
        </button>
      </div>
    </div>
  )
}
