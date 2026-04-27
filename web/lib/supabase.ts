import { createClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────────────

export type Route = {
  id: string
  origin: string
  destination: string
  label: string | null
  enabled: boolean
  flexible_days: number
  absolute_threshold: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type PriceSnapshot = {
  id: number
  route_id: string
  search_date: string
  departure_date: string
  return_date: string | null
  price_usd: number
  currency: string
  airline: string | null
  stops: number
  duration_minutes: number | null
  booking_link: string | null
  source: string
  is_separate_tickets: boolean
  created_at: string
}

export type Alert = {
  id: number
  route_id: string
  snapshot_id: number | null
  combo_id: number | null
  alert_type: 'baseline' | 'absolute' | 'multi_stop'
  triggered_price: number
  baseline_p25: number | null
  discount_pct: number | null
  severity: 'low' | 'medium' | 'high'
  is_dismissed: boolean
  is_archived: boolean
  created_at: string
}

export type MultiStopCombo = {
  id: number
  route_id: string
  search_date: string
  departure_date: string
  hub: string
  leg1_price: number
  leg2_price: number
  total_price: number
  direct_price: number | null
  savings_pct: number | null
  layover_hours: number | null
  leg1_airline: string | null
  leg2_airline: string | null
  warnings: string[] | null
  created_at: string
}

export type RouteSummary = {
  id: string
  origin: string
  destination: string
  label: string | null
  enabled: boolean
  snapshot_count: number
  min_price_ever: number | null
  max_price_ever: number | null
  p25_overall: number | null
  median: number | null
  latest_price: number | null
  last_searched: string | null
}

// ── Clients ────────────────────────────────────────────────────────────────

export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey)
}

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_KEY!
  return createClient(url, serviceKey)
}
