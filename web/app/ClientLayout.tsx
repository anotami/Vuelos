'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Bell,
  Map,
  History,
  Plane,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/alerts', label: 'Alertas', icon: Bell },
  { href: '/routes', label: 'Rutas', icon: Map },
  { href: '/history', label: 'Historial', icon: History },
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [usage, setUsage] = useState<{ total: number; byProvider: Record<string, number> } | null>(null)

  useEffect(() => {
    fetch('/api/serpapi-usage')
      .then(r => r.json())
      .then(d => d.total != null ? setUsage({ total: d.total, byProvider: d.byProvider }) : null)
      .catch(() => {})
  }, [])

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col fixed top-0 left-0 h-screen z-30">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
            <Plane size={18} className="text-slate-950" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-slate-100 text-sm leading-tight">
              Flight Tracker <span className="text-emerald-400 font-normal">Lima</span>
            </span>
            {usage !== null && (
              <div className="mt-1 space-y-0.5">
                {Object.entries(usage.byProvider).map(([provider, count]) => (
                  <div key={provider} className="flex items-center gap-1.5">
                    <span className={cn(
                      'text-xs font-mono',
                      count >= 95 ? 'text-red-400' :
                      count >= 80 ? 'text-yellow-400' :
                      'text-slate-500'
                    )}>
                      {provider}: {count}
                    </span>
                  </div>
                ))}
                {usage.total === 0 && (
                  <span className="text-xs text-slate-600">0 consultas este mes</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">Flight Tracker Lima v1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen bg-slate-950">
        {children}
      </main>
    </div>
  )
}
