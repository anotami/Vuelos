import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const revalidate = 300

export async function GET() {
  const db = createServerClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { count, error } = await db
    .from('serpapi_call_log')
    .select('*', { count: 'exact', head: true })
    .gte('called_at', monthStart)

  if (error) {
    return NextResponse.json({ count: null, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: count ?? 0 })
}
