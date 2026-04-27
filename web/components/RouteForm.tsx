'use client'

import { useState } from 'react'
import { z } from 'zod'
import type { Route } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const routeSchema = z.object({
  origin: z.string().length(3, 'Debe tener 3 letras').toUpperCase(),
  destination: z.string().length(3, 'Debe tener 3 letras').toUpperCase(),
  label: z.string().optional(),
  absolute_threshold: z.number().positive('Debe ser positivo').optional(),
  flexible_days: z.number().min(0).max(7).default(0),
  enabled: z.boolean().default(true),
})

type RouteFormData = z.infer<typeof routeSchema>

type Props = {
  onSuccess?: () => void
  initialValues?: Partial<Route>
  routeId?: string
}

const inputClass =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors'

const labelClass = 'block text-xs text-slate-400 mb-1.5 font-medium'

const errorClass = 'text-xs text-rose-400 mt-1'

export default function RouteForm({ onSuccess, initialValues, routeId }: Props) {
  const [formData, setFormData] = useState<{
    origin: string
    destination: string
    label: string
    absolute_threshold: string
    flexible_days: number
    enabled: boolean
  }>({
    origin: initialValues?.origin ?? '',
    destination: initialValues?.destination ?? '',
    label: initialValues?.label ?? '',
    absolute_threshold:
      initialValues?.absolute_threshold != null
        ? String(initialValues.absolute_threshold)
        : '',
    flexible_days: initialValues?.flexible_days ?? 0,
    enabled: initialValues?.enabled ?? true,
  })

  const [errors, setErrors] = useState<Partial<Record<keyof RouteFormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  function validate(): RouteFormData | null {
    const rawData = {
      origin: formData.origin.trim().toUpperCase(),
      destination: formData.destination.trim().toUpperCase(),
      label: formData.label.trim() || undefined,
      absolute_threshold: formData.absolute_threshold
        ? parseFloat(formData.absolute_threshold)
        : undefined,
      flexible_days: formData.flexible_days,
      enabled: formData.enabled,
    }

    const result = routeSchema.safeParse(rawData)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof RouteFormData, string>> = {}
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof RouteFormData
        fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return null
    }
    setErrors({})
    return result.data
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = validate()
    if (!parsed) return

    setLoading(true)
    setServerError(null)

    try {
      const isEdit = !!routeId
      const res = await fetch('/api/routes', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: routeId, ...parsed } : parsed),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setServerError(data.error ?? 'Error al guardar la ruta')
        return
      }

      onSuccess?.()
    } catch {
      setServerError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 text-sm text-rose-400">
          {serverError}
        </div>
      )}

      {/* Origin / Destination row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Origen (IATA)</label>
          <input
            type="text"
            maxLength={3}
            placeholder="LIM"
            value={formData.origin}
            onChange={(e) =>
              setFormData((p) => ({ ...p, origin: e.target.value.toUpperCase() }))
            }
            className={cn(inputClass, 'font-mono uppercase', errors.origin && 'border-rose-500')}
          />
          {errors.origin && <p className={errorClass}>{errors.origin}</p>}
        </div>
        <div>
          <label className={labelClass}>Destino (IATA)</label>
          <input
            type="text"
            maxLength={3}
            placeholder="MAD"
            value={formData.destination}
            onChange={(e) =>
              setFormData((p) => ({ ...p, destination: e.target.value.toUpperCase() }))
            }
            className={cn(inputClass, 'font-mono uppercase', errors.destination && 'border-rose-500')}
          />
          {errors.destination && <p className={errorClass}>{errors.destination}</p>}
        </div>
      </div>

      {/* Label */}
      <div>
        <label className={labelClass}>Etiqueta (opcional)</label>
        <input
          type="text"
          placeholder="Lima → Madrid ida/vuelta"
          value={formData.label}
          onChange={(e) => setFormData((p) => ({ ...p, label: e.target.value }))}
          className={inputClass}
        />
      </div>

      {/* Threshold / Flexible days row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Umbral precio (USD)</label>
          <input
            type="number"
            min={0}
            step={1}
            placeholder="800"
            value={formData.absolute_threshold}
            onChange={(e) =>
              setFormData((p) => ({ ...p, absolute_threshold: e.target.value }))
            }
            className={cn(inputClass, 'font-mono', errors.absolute_threshold && 'border-rose-500')}
          />
          {errors.absolute_threshold && (
            <p className={errorClass}>{errors.absolute_threshold}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Días flexibles (0–7)</label>
          <input
            type="number"
            min={0}
            max={7}
            value={formData.flexible_days}
            onChange={(e) =>
              setFormData((p) => ({ ...p, flexible_days: parseInt(e.target.value) || 0 }))
            }
            className={cn(inputClass, errors.flexible_days && 'border-rose-500')}
          />
          {errors.flexible_days && (
            <p className={errorClass}>{errors.flexible_days}</p>
          )}
        </div>
      </div>

      {/* Enabled */}
      <div className="flex items-center gap-3">
        <input
          id="enabled"
          type="checkbox"
          checked={formData.enabled}
          onChange={(e) => setFormData((p) => ({ ...p, enabled: e.target.checked }))}
          className="w-4 h-4 accent-emerald-500 cursor-pointer"
        />
        <label htmlFor="enabled" className="text-sm text-slate-300 cursor-pointer">
          Monitoreo activo
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {routeId ? 'Guardar cambios' : 'Crear ruta'}
      </button>
    </form>
  )
}
