'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Bell, Menu, PanelLeft, ChevronDown } from 'lucide-react'
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
import { navItems } from '@/lib/navigation'
import { notifications } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

type HeaderProps = {
  onToggleSidebar: () => void
  onOpenMobile: () => void
}

export function Header({ onToggleSidebar, onOpenMobile }: HeaderProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, logout } = useAuth()

  const current =
    navItems.find((item) =>
      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
    ) ?? navItems[0]

  // Datos del usuario: preferir los del backend (AuthProvider), con fallback a mock.
  const displayName    = user?.nombre    ?? 'Administrador'
  const displayRol     = user?.roles?.[0] ?? 'ADMIN'
  const displayEmail   = user?.email     ?? ''
  const displayIniciales = user?.iniciales ?? 'AD'

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
      {/* Botón menú móvil */}
      <button
        type="button"
        onClick={onOpenMobile}
        aria-label="Abrir menú"
        className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {/* Botón colapsar (escritorio) */}
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Colapsar menú lateral"
        className="hidden size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:flex"
      >
        <PanelLeft className="size-5" />
      </button>

      <h1 className="text-lg font-semibold text-foreground">{current.title}</h1>

      {/* Notificaciones (mock hasta implementar el módulo) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Notificaciones"
          className="relative ml-auto flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Bell className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {notifications.map((n) => (
              <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 py-2.5">
                <div className="flex w-full items-center gap-2">
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      n.leida ? 'bg-transparent' : 'bg-primary',
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

      <Separator orientation="vertical" className="hidden h-6 sm:block" />

      {/* Perfil — datos reales del JWT */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-accent">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {displayIniciales}
          </span>
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-medium text-foreground">{displayName}</span>
            <span className="block text-xs text-muted-foreground">{displayRol}</span>
          </span>
          <ChevronDown className="hidden size-4 text-muted-foreground md:block" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <span className="block text-sm font-medium">{displayName}</span>
            <span className="block text-xs font-normal text-muted-foreground">
              {displayEmail}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>Mi perfil</DropdownMenuItem>
            <DropdownMenuItem>Configuración</DropdownMenuItem>
            <DropdownMenuItem>Ayuda y soporte</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={handleLogout}>
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
