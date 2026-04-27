// ── Utility functions ──────────────────────────────────────────────────────

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''))
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''))
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

export function calcDiscountPct(current: number, baseline: number): number {
  if (baseline === 0) return 0
  return ((baseline - current) / baseline) * 100
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'high':
      return 'text-rose-400 border-rose-500 bg-rose-500/10'
    case 'medium':
      return 'text-amber-400 border-amber-500 bg-amber-500/10'
    case 'low':
    default:
      return 'text-emerald-400 border-emerald-500 bg-emerald-500/10'
  }
}

export function getSeverityBorderColor(severity: string): string {
  switch (severity) {
    case 'high':
      return 'border-rose-500'
    case 'medium':
      return 'border-amber-500'
    case 'low':
    default:
      return 'border-emerald-500'
  }
}

export function durationToHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
