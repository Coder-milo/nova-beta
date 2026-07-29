'use client'

import { SignOut } from '@phosphor-icons/react'
import Image from '@/compat/next-image'
import Link from '@/compat/next-link'
import { usePathname, useRouter } from '@/compat/next-navigation'
import { cn } from '@/lib/utils'
import { getNavItemsForRoles, soloEsEstudiante } from '@/lib/navigation'
import { useAuth } from '@/lib/auth'
import { usePreferences } from '@/lib/preferences'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type SidebarNavProps = {
  collapsed?: boolean
  onNavigate?: () => void
}

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: SidebarNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { locale, t } = usePreferences()

  // Menú según rol: el portal del estudiante ve su propia navegación.
  const navItems = getNavItemsForRoles(user?.roles, locale)
  const displayRol = user?.roles?.[0] ?? 'ADMIN'
  const displayEmail = user?.email ?? ''
  const displayIniciales = user?.iniciales ?? 'AD'
  const esEstudiante = soloEsEstudiante(user?.roles)

  return (
    <div className="glass-chrome relative flex h-full flex-col overflow-hidden border-r border-sidebar-border text-sidebar-foreground shadow-[8px_0_34px_-28px_rgba(15,23,42,0.55)] transition-all">
      {/* Marca / Encabezado */}
      <div
        className={cn(
          'relative z-10 flex h-18 items-center gap-3 border-b border-border/50 px-4.5',
          collapsed && 'justify-center px-2',
        )}
      >
        {collapsed ? (
          <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-white p-1.5 shadow-xs backdrop-blur-md">
            <Image
              src="/cac-logo.png"
              alt="Logo Academy CAC"
              width={32}
              height={32}
              priority
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <>
            <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-white p-1.5 shadow-xs backdrop-blur-md transition-transform duration-200 hover:scale-105">
              <Image
                src="/cac-logo.png"
                alt="Logo Academy CAC"
                width={32}
                height={32}
                priority
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col leading-snug">
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                Academy CAC
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                {esEstudiante ? t('studentPortal') : t('adminPanel')}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Lista de Navegación */}
      <nav className="relative z-10 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [::-webkit-scrollbar]:hidden px-3 py-4">
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
                  'sidebar-nav-item group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium',
                  'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                  'active:scale-[0.97] active:duration-100',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'sidebar-nav-item--active bg-primary text-primary-foreground font-semibold border border-primary/30 shadow-[0_8px_18px_-12px_rgba(18,104,232,0.85)]'
                    : 'text-foreground/75 border border-transparent hover:border-border/60 hover:bg-secondary/80 hover:text-foreground',
                )}
              >
                <Icon
                  weight={isActive ? 'fill' : 'regular'}
                  className={cn(
                    'size-[18px] shrink-0 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                    isActive
                      ? 'text-primary-foreground scale-105'
                      : 'text-muted-foreground group-hover:text-foreground group-hover:scale-110',
                  )}
                />
                {!collapsed && (
                  <span className="truncate tracking-tight">{item.title}</span>
                )}
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

      {/* Perfil del usuario */}
      <div className="relative z-10 border-t border-border/50 p-3">
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_4px_16px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-200 hover:border-border/60 hover:bg-card/90',
            collapsed && 'justify-center border-0 bg-transparent p-0 shadow-none',
          )}
        >
          <span className="flex size-8.5 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-xs">
            {displayIniciales}
          </span>
          {!collapsed && (
            <div className="flex flex-1 flex-col min-w-0">
              <span className="truncate text-xs font-semibold text-foreground">
                {displayEmail || t('administrator')}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {displayRol}
              </span>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => {
                logout()
                router.push('/login')
              }}
              title={t('signOut')}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/20 hover:text-red-500 transition-colors"
            >
              <SignOut className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
