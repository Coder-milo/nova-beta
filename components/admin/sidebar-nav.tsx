'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { GraduationCap, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navItems } from '@/lib/navigation'
import { useAuth } from '@/lib/auth'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type SidebarNavProps = {
  collapsed?: boolean
  onNavigate?: () => void
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  const displayRol = user?.roles?.[0] ?? 'ADMIN'
  const displayEmail = user?.email ?? ''
  const displayIniciales = user?.iniciales ?? 'AD'

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Marca */}
      <div
        className={cn(
          'flex h-16 items-center gap-3 border-b border-sidebar-border px-4',
          collapsed && 'justify-center px-2',
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive text-destructive-foreground">
          <GraduationCap className="size-5" />
        </span>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-white">Academia CAC</span>
            <span className="text-xs text-sidebar-foreground/70">Panel administrativo</span>
          </div>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon

            const link = (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-sidebar-accent text-white shadow-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r before:bg-destructive'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.title}</span>}
              </Link>
            )

            return (
              <li key={item.href}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger render={link} />
                    <TooltipContent side="right">{item.title}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Perfil */}
      <div className="border-t border-sidebar-border p-3">
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg bg-sidebar-accent/50 p-2',
            collapsed && 'justify-center bg-transparent p-0',
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            {displayIniciales}
          </span>
          {!collapsed && (
            <>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-medium text-white">
                  {displayRol}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {displayEmail}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout()
                  router.push('/login')
                }}
                aria-label="Cerrar sesión"
                className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-white"
              >
                <LogOut className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
