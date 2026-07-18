'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { SidebarNav } from '@/components/admin/sidebar-nav'
import { Header } from '@/components/admin/header'

/**
 * Envoltorio del panel administrativo.
 * En la ruta /login, renderiza únicamente los children (sin sidebar ni header).
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Cierra el menú móvil al cambiar de ruta.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // La página de login no necesita el shell administrativo.
  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-svh bg-background">
      {/* Sidebar escritorio */}
      <aside
        className={cn(
          'sticky top-0 hidden h-svh shrink-0 transition-[width] duration-200 ease-in-out lg:block',
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
          className="w-64 border-0 bg-sidebar p-0"
        >
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onToggleSidebar={() => setCollapsed((v) => !v)}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
