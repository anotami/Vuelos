import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { z } from 'zod'

const patchSchema = z.object({
  id: z.number(),
  action: z.enum(['dismiss', 'archive']),
})

export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const dismissed = searchParams.get('dismissed')
  const routeId = searchParams.get('routeId')
  const severity = searchParams.get('severity')
  const alertType = searchParams.get('alert_type')

  let query = supabase
    .from('alerts')
    .select('*, route:routes(*), snapshot:price_snapshots(*)')
    .order('created_at', { ascending: false })

  if (dismissed === 'false') {
    query = query.eq('is_dismissed', false).eq('is_archived', false)
  }
  if (routeId) {
    query = query.eq('route_id', routeId)
  }
  if (severity) {
    query = query.eq('severity', severity)
  }
  if (alertType) {
    query = query.eq('alert_type', alertType)
  }

  const { data, error } = await query.limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const supabase = createServerClient()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { id, action } = parsed.data
  const updates =
    action === 'dismiss'
      ? { is_dismissed: true }
      : { is_archived: true }

  const { data, error } = await supabase
    .from('alerts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
