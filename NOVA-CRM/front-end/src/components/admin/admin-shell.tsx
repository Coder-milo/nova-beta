'use client'

import { useState, useEffect } from 'react'
import { usePathname } from '@/compat/next-navigation'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { SidebarNav } from '@/components/admin/sidebar-nav'
import { Header } from '@/components/admin/header'
import { DarkBrandBackdrop } from '@/components/admin/dark-brand-backdrop'

/**
 * Envoltorio del panel administrativo.
 * En la ruta /login, renderiza únicamente los children (sin sidebar ni header).
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // ── Barra de progreso de navegación ──────────────────────────────────────
  const [navLoading, setNavLoading] = useState(false)
  const [navWidth, setNavWidth] = useState(0)

  useEffect(() => {
    setNavLoading(true)
    setNavWidth(20)
    const t1 = setTimeout(() => setNavWidth(75), 80)
    const t2 = setTimeout(() => setNavWidth(95), 500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [pathname])

  useEffect(() => {
    if (!navLoading) return
    const t = setTimeout(() => {
      setNavWidth(100)
      setTimeout(() => { setNavLoading(false); setNavWidth(0) }, 300)
    }, 200)
    return () => clearTimeout(t)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const saved = localStorage.getItem('nova_theme') ?? 'light'
    const root = document.documentElement
    if (saved === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else if (saved === 'light') {
      root.classList.remove('dark')
      root.classList.add('light')
    } else if (saved === 'system') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
        root.classList.remove('light')
      } else {
        root.classList.remove('dark')
        root.classList.add('light')
      }
    }
  }, [])

  if (pathname === '/login' || pathname === '/recuperar-contrasena') {
    return <>{children}</>
  }

  return (
    <div className="relative flex h-svh max-h-svh w-full bg-background text-foreground overflow-hidden">
      {/* ── Barra de progreso de navegación (top) ───────────────────────── */}
      {navLoading && (
        <div
          className="pointer-events-none fixed top-0 left-0 z-[9999] h-[2.5px] transition-all ease-out"
          style={{
            width: `${navWidth}%`,
            transitionDuration: navWidth === 100 ? '200ms' : '600ms',
            background: '#141B9D',
            boxShadow: '0 0 12px 1px rgba(20,27,157,0.5)',
          }}
        />
      )}

      {/* Malla ambiente de luz y fondo con foto institucional de la Sede CAC */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0 select-none">
        <div className="ambient-mesh" />
        <DarkBrandBackdrop />
        {/* Velos translúcidos adaptables a la luz y oscuridad */}
        <div className="ambient-grid absolute inset-0 opacity-[0.035] dark:opacity-100" />
      </div>

      {/* Sidebar escritorio */}
      <aside
        className={cn(
          'relative z-20 hidden h-full shrink-0 transition-[width] duration-200 ease-in-out lg:block',
          collapsed ? 'w-[76px]' : 'w-64',
        )}
      >
        <SidebarNav collapsed={collapsed} />
      </aside>

      {/* Sidebar móvil */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="glass-chrome w-64 border-r border-black/[0.06] p-0 text-foreground"
        >
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Contenido principal */}
      <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onOpenMobile={() => setMobileOpen(true)}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
        />
        <main className="relative flex-1 overflow-y-auto px-4 pb-5 pt-3 md:px-7 md:pb-7 md:pt-4">
          <div className="relative z-10 mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
