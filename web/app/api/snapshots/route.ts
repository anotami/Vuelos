import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const routeId = searchParams.get('routeId')
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)
  const days = parseInt(searchParams.get('days') ?? '90', 10)

  if (!routeId) {
    return NextResponse.json({ error: 'Missing routeId' }, { status: 400 })
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const { data, error } = await supabase
    .from('price_snapshots')
    .select('*')
    .eq('route_id', routeId)
    .gte('search_date', since)
    .order('search_date', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
