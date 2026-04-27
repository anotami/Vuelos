import type { MultiStopCombo } from '@/lib/supabase'
import { formatUSD } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

type Props = {
  combo: MultiStopCombo
}

const WARNING_LABELS: Record<string, string> = {
  separate_tickets: 'Tickets separados',
  requires_us_visa: 'Requiere visa USA',
  stopover_available: 'Stopover disponible',
}

function getWarningLabel(w: string): string {
  return WARNING_LABELS[w] ?? w
}

export default function MultiStopBadge({ combo }: Props) {
  return (
    <div className="bg-slate-800/60 border border-purple-500/30 rounded-xl p-4 space-y-3">
      {/* Hub header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-full px-2.5 py-0.5">
          Via {combo.hub}
        </span>
        {combo.layover_hours !== null && (
          <span className="text-xs text-slate-400">
            {combo.layover_hours}h escala
          </span>
        )}
      </div>

      {/* Leg breakdown */}
      <div className="text-sm font-mono space-y-1">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="text-slate-500">Leg 1</span>
          <span>→ {combo.hub}</span>
          {combo.leg1_airline && (
            <span className="text-xs text-slate-500">({combo.leg1_airline})</span>
          )}
          <span className="ml-auto text-slate-100">{formatUSD(combo.leg1_price)}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <span className="text-slate-500">Leg 2</span>
          <span>{combo.hub} →</span>
          {combo.leg2_airline && (
            <span className="text-xs text-slate-500">({combo.leg2_airline})</span>
          )}
          <span className="ml-auto text-slate-100">{formatUSD(combo.leg2_price)}</span>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-700 pt-1 font-semibold">
          <span className="text-slate-400">Total</span>
          <span className="ml-auto text-emerald-400">{formatUSD(combo.total_price)}</span>
        </div>
      </div>

      {/* Savings vs direct */}
      {combo.direct_price !== null && combo.savings_pct !== null && (
        <div className="text-xs text-slate-400">
          Directo: <span className="font-mono text-slate-300">{formatUSD(combo.direct_price)}</span>
          {' '}→ ahorras{' '}
          <span className="font-mono text-emerald-400 font-semibold">
            {combo.savings_pct.toFixed(0)}%
          </span>
          {' '}({formatUSD(combo.direct_price - combo.total_price)})
        </div>
      )}

      {/* Warnings */}
      {combo.warnings && combo.warnings.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {combo.warnings.map((w) => (
            <span
              key={w}
              className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5"
            >
              <AlertTriangle size={10} />
              {getWarningLabel(w)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
