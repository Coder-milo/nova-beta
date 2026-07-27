'use client'

import { Bell, CaretDown, List, Sidebar } from '@phosphor-icons/react'
import { usePathname, useRouter } from '@/compat/next-navigation'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { notifications } from '@/lib/mock-data'
import { getNavItemsForRoles } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useBranding } from '@/lib/branding'

type HeaderProps = {
  onOpenMobile: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function Header({ onOpenMobile, collapsed, onToggleCollapsed }: HeaderProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, logout } = useAuth()
  const { branding } = useBranding()

  const availableNavItems = getNavItemsForRoles(user?.roles)
  const current = availableNavItems.find((item) => {
    const href = item.href.split('?')[0]
    return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
  }) ?? availableNavItems[0]

  // Datos del usuario: preferir los del backend (AuthProvider), con fallback a mock.
  const displayName    = user?.nombre    ?? 'Administrador'
  const displayRol     = user?.roles?.[0] ?? 'ADMIN'
  const displayEmail   = user?.email     ?? ''
  const displayIniciales = user?.iniciales ?? 'AD'

  function handleLogout() {
    logout()
    router.push('/login')
  }

  const bannerUrl = branding?.bannerPanelUrl || branding?.correoHeaderUrl
  const tituloHeader = branding?.tituloHeader || current?.title || 'NOVA CRM'
  const subtituloHeader = branding?.subtituloHeader || 'NOVA · Gestión académica'

  return (
    <header className="glass-chrome sticky top-0 z-30 flex h-18 shrink-0 items-center gap-3 border-b border-border border-t-2 border-t-primary px-4 shadow-[0_8px_28px_-24px_rgba(15,23,42,0.45)] transition-all md:px-7 relative overflow-hidden">
      {/* Fondo adaptativo del banner en el header */}
      {bannerUrl && (
        <div className="absolute inset-0 pointer-events-none z-0 opacity-10 dark:opacity-20 transition-opacity duration-500">
          {/* Centrado y no `object-right`: en pantallas estrechas el recorte
              por la derecha se comia el logo, que en casi todos los banners
              esta a la izquierda. */}
          <img
            src={bannerUrl}
            alt=""
            className="h-full w-full object-cover object-center"
          />
        </div>
      )}

      {/* Botón menú móvil */}
      <button
        type="button"
        onClick={onOpenMobile}
        aria-label="Abrir menú"
        className="relative z-10 flex size-9 items-center justify-center rounded-xl border border-border/50 bg-card/95 text-foreground shadow-sm backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-primary/30 hover:bg-card hover:scale-105 active:scale-95 active:duration-100 lg:hidden"
      >
        <List className="size-5" />
      </button>

      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
        title={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
        className="relative z-10 hidden size-9 shrink-0 items-center justify-center rounded-xl border border-border/55 bg-card/95 text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-card hover:text-primary active:scale-95 lg:flex"
      >
        <Sidebar className="size-5" />
      </button>

      {/* El banner va solo de fondo (arriba). Tenerlo ademas en un recuadro
          repetia la misma imagen dos veces en la misma barra y le robaba el
          sitio al titulo del proyecto, que es lo que hay que leer. */}

      <div className="relative z-10 min-w-0">
        <h1 className="truncate text-base font-semibold tracking-tight text-foreground md:text-lg">
          {tituloHeader}
        </h1>
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:text-[11px]">
          {subtituloHeader}
        </p>
      </div>

      {/* Notificaciones */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Notificaciones"
          className="relative ml-auto flex size-9 items-center justify-center rounded-xl border border-border/50 bg-card/95 text-foreground shadow-sm backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-primary/30 hover:bg-card hover:scale-105 active:scale-95 active:duration-100"
        >
          <Bell className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 rounded-2xl border border-border bg-popover p-2 backdrop-blur-2xl text-popover-foreground shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
          <DropdownMenuLabel className="text-foreground font-semibold">Notificaciones</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/50" />
          <DropdownMenuGroup>
            {notifications.map((n) => (
              <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 rounded-xl py-2.5 transition-colors duration-200 hover:bg-primary/10 focus:bg-primary/10">
                <div className="flex w-full items-center gap-2">
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      n.leida ? 'bg-transparent' : 'bg-destructive',
                    )}
                  />
                  <span className="text-sm font-medium text-foreground">{n.titulo}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{n.tiempo}</span>
                </div>
                <span className="pl-3.5 text-xs text-muted-foreground">{n.detalle}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="hidden h-6 bg-border/50 sm:block" />

      {/* Perfil */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/95 px-2.5 py-1.5 shadow-sm backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-primary/30 hover:bg-card active:scale-[0.98] active:duration-100">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-xs">
            {displayIniciales}
          </span>
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-semibold text-foreground">{displayName}</span>
            <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">{displayRol}</span>
          </span>
          <CaretDown className="hidden size-4 text-muted-foreground md:block" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-2xl border border-border bg-popover p-2 backdrop-blur-2xl text-popover-foreground shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
          <DropdownMenuLabel>
            <span className="block text-sm font-semibold text-foreground">{displayName}</span>
            <span className="block text-xs font-normal text-muted-foreground">
              {displayEmail}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/50" />
          <DropdownMenuItem
            onClick={handleLogout}
            className="rounded-xl text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
