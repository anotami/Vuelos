'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Route } from '@/lib/supabase'
import RouteForm from '@/components/RouteForm'
import { formatDate, cn } from '@/lib/utils'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Map,
  X,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

type ModalMode = 'create' | 'edit'

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('create')
  const [editingRoute, setEditingRoute] = useState<Route | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [triggeringId, setTriggeringId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchRoutes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/routes')
      if (res.ok) {
        const data = await res.json()
        setRoutes(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoutes()
  }, [fetchRoutes])

  function openCreate() {
    setEditingRoute(null)
    setModalMode('create')
    setModalOpen(true)
  }

  function openEdit(route: Route) {
    setEditingRoute(route)
    setModalMode('edit')
    setModalOpen(true)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/routes?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRoutes((prev) => prev.filter((r) => r.id !== id))
        setDeleteConfirmId(null)
      }
    } finally {
      setDeletingId(null)
    }
  }

  async function handleToggle(route: Route) {
    setTogglingId(route.id)
    try {
      const res = await fetch('/api/routes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: route.id, enabled: !route.enabled }),
      })
      if (res.ok) {
        const updated = await res.json()
        setRoutes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      }
    } finally {
      setTogglingId(null)
    }
  }

  async function handleTrigger(routeId: string) {
    setTriggeringId(routeId)
    try {
      await fetch('/api/trigger-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId }),
      })
    } finally {
      setTriggeringId(null)
    }
  }

  function handleFormSuccess() {
    setModalOpen(false)
    fetchRoutes()
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 flex items-center gap-2">
            <Map size={22} className="text-emerald-400" />
            Rutas
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {routes.filter((r) => r.enabled).length} activas de {routes.length} rutas
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Nueva ruta
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-emerald-400" />
        </div>
      ) : routes.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
          <Map size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 font-medium">No hay rutas configuradas</p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Plus size={14} />
            Agregar primera ruta
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Ruta</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">Etiqueta</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">Umbral</th>
                <th className="text-left px-5 py-3 hidden lg:table-cell">Días flex.</th>
                <th className="text-left px-5 py-3 hidden lg:table-cell">Creado</th>
                <th className="text-center px-5 py-3">Activo</th>
                <th className="text-right px-5 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {routes.map((route) => (
                <tr
                  key={route.id}
                  className={cn(
                    'hover:bg-slate-800/40 transition-colors',
                    !route.enabled && 'opacity-50'
                  )}
                >
                  {/* Route */}
                  <td className="px-5 py-4">
                    <span className="font-mono font-semibold text-slate-100">
                      {route.origin} → {route.destination}
                    </span>
                  </td>

                  {/* Label */}
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <span className="text-sm text-slate-400">
                      {route.label ?? '—'}
                    </span>
                  </td>

                  {/* Threshold */}
                  <td className="px-5 py-4 hidden md:table-cell">
                    <span className="text-sm font-mono text-slate-300">
                      {route.absolute_threshold != null
                        ? `$${route.absolute_threshold}`
                        : '—'}
                    </span>
                  </td>

                  {/* Flexible days */}
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <span className="text-sm text-slate-300">
                      {route.flexible_days}d
                    </span>
                  </td>

                  {/* Created */}
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <span className="text-xs text-slate-400">
                      {formatDate(route.created_at)}
                    </span>
                  </td>

                  {/* Toggle enabled */}
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => handleToggle(route)}
                      disabled={togglingId === route.id}
                      className="text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                      title={route.enabled ? 'Desactivar' : 'Activar'}
                    >
                      {togglingId === route.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : route.enabled ? (
                        <ToggleRight size={22} className="text-emerald-400" />
                      ) : (
                        <ToggleLeft size={22} />
                      )}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Trigger search */}
                      <button
                        onClick={() => handleTrigger(route.id)}
                        disabled={triggeringId === route.id}
                        title="Buscar ahora"
                        className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {triggeringId === route.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Search size={12} />
                        )}
                        <span className="hidden sm:inline">Buscar</span>
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => openEdit(route)}
                        title="Editar"
                        className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>

                      {/* Delete */}
                      {deleteConfirmId === route.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-rose-400">¿Seguro?</span>
                          <button
                            onClick={() => handleDelete(route.id)}
                            disabled={deletingId === route.id}
                            className="text-xs bg-rose-500 hover:bg-rose-400 text-white px-2 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            {deletingId === route.id ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              'Sí'
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(route.id)}
                          title="Eliminar"
                          className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />

          {/* Modal content */}
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-100">
                {modalMode === 'create' ? 'Nueva ruta' : 'Editar ruta'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <RouteForm
              onSuccess={handleFormSuccess}
              initialValues={editingRoute ?? undefined}
              routeId={editingRoute?.id}
            />
          </div>
        </div>
      )}
    </div>
  )
}
