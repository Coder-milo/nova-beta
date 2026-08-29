'use client'

import { useState, useEffect } from 'react'
import { usePathname } from '@/compat/next-navigation'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { SidebarNav } from '@/components/admin/sidebar-nav'
import { BarraUtilidades } from '@/components/admin/barra-utilidades'
import { Header } from '@/components/admin/header'
import { StudentHelpChat } from '@/components/student/student-help-chat'
import { AdminAssistantChat } from '@/components/admin/admin-assistant-chat'
import { useAuth } from '@/lib/auth'
import { soloEsDesarrollador, soloEsEstudiante } from '@/lib/navigation'
import { usePreferences } from '@/lib/preferences'

import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Si el usuario dejó el menú plegado, sigue plegado la próxima vez. */
const CLAVE_COLAPSADO = 'nova_menu_plegado'

/**
 * Envoltorio del panel administrativo.
 * En la ruta /login, renderiza únicamente los children (sin cabecera ni menú).
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { locale } = usePreferences()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarColapsado, setSidebarColapsado] = useState(false)
  const pathname = usePathname()

  // Se lee en un efecto y no al inicializar el estado: en el primer render el
  // servidor no tiene `localStorage`, y sembrar el estado desde ahí haría que
  // el marcado del cliente no coincidiera con el que llegó del servidor.
  useEffect(() => {
    try {
      setSidebarColapsado(localStorage.getItem(CLAVE_COLAPSADO) === '1')
    } catch {
      /* Sin almacenamiento arranca desplegado, que es el valor por defecto. */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_COLAPSADO, sidebarColapsado ? '1' : '0')
    } catch {
      /* Preferencia de presentación: si no se puede guardar, no pasa nada. */
    }
  }, [sidebarColapsado])
  const { user } = useAuth()
  const esEstudiante = soloEsEstudiante(user?.roles)
  const esDesarrollador = soloEsDesarrollador(user?.roles)

  useEffect(() => {
    if (pathname === '/login') {
      document.title = locale === 'en'
        ? 'CAC Academic · Sign in'
        : 'CAC Academic · Iniciar sesión'
      return
    }
    document.title = esEstudiante
      ? `CAC Academic · ${locale === 'en' ? 'Student portal' : 'Portal del estudiante'}`
      : esDesarrollador
        ? `CAC Academic · ${locale === 'en' ? 'Developer console' : 'Panel de desarrollador'}`
        : `CAC Academic · ${locale === 'en' ? 'Admin panel' : 'Panel administrativo'}`
  }, [esEstudiante, esDesarrollador, locale, pathname])

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

  // Las pantallas a las que se llega sin sesion se pintan solas. El menú
  // lateral es de quien ya entró: en el formulario público lo verían empresas
  // de fuera, y enseña la estructura interna del panel a quien no es de casa.
  if (pathname === '/login' || pathname === '/recuperar-contrasena'
      || pathname === '/publicar-vacante') {
    return <>{children}</>
  }

  return (
      <div className={cn(
      'relative flex h-svh max-h-svh w-full bg-background text-foreground overflow-hidden',
      esEstudiante ? 'student-project-shell' : 'admin-project-shell',
      )}>
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
        {/* Velos translúcidos adaptables a la luz y oscuridad */}
        <div className="ambient-grid absolute inset-0 opacity-[0.035] dark:opacity-100" />
      </div>

      {/* Panel lateral de escritorio, plegable a solo iconos. */}
      <aside
        className={cn(
          'relative z-20 hidden h-full shrink-0 transition-[width] duration-200 lg:block',
          sidebarColapsado ? 'w-14' : 'w-60',
        )}
      >
        <SidebarNav collapsed={sidebarColapsado} />

        <button
          type="button"
          onClick={() => setSidebarColapsado((previo) => !previo)}
          aria-expanded={!sidebarColapsado}
          className="absolute -right-3 top-3.5 z-30 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
          title={
            sidebarColapsado
              ? locale === 'en' ? 'Expand menu' : 'Expandir menú'
              : locale === 'en' ? 'Collapse menu' : 'Plegar menú'
          }
        >
          {sidebarColapsado ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </button>
      </aside>

      {/* Menú móvil */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="glass-chrome w-64 border-r border-black/[0.06] p-0 text-foreground"
        >
          <SheetTitle className="sr-only">{locale === 'en' ? 'Navigation menu' : 'Menú de navegación'}</SheetTitle>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Contenido principal */}
      <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenMobile={() => setMobileOpen(true)} />
        {/* El lienzo también se aprieta: 12 px de margen en vez de 28. Con
            tarjetas planas el contenido ya no necesita aire alrededor para
            despegarse del fondo, que era lo que justificaba el margen ancho. */}
        <main className="relative flex-1 overflow-y-auto px-3 pb-4 pt-3 md:px-4 md:pb-5">
          <div className="relative z-10 mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
        {!esEstudiante && !esDesarrollador && <BarraUtilidades />}
      </div>
      {esEstudiante ? <StudentHelpChat /> : !esDesarrollador && <AdminAssistantChat />}
    </div>
  )
}
