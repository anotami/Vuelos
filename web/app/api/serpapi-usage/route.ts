import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const revalidate = 300

export async function GET() {
  const db = createServerClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data, error } = await db
    .from('serpapi_call_log')
    .select('provider')
    .gte('called_at', monthStart)
    .eq('success', true)

  if (error) {
    return NextResponse.json({ total: null, byProvider: {}, error: error.message }, { status: 500 })
  }

  const byProvider: Record<string, number> = {}
  for (const row of data ?? []) {
    byProvider[row.provider] = (byProvider[row.provider] ?? 0) + 1
  }

  return NextResponse.json({ total: data?.length ?? 0, byProvider })
}
