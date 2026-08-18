'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, LogOut, Search } from 'lucide-react'
import Image from '@/compat/next-image'
import Link from '@/compat/next-link'
import { usePathname, useRouter } from '@/compat/next-navigation'
import { cn } from '@/lib/utils'
import {
  etiquetaDeGrupo,
  getNavItemsForRoles,
  ORDEN_GRUPOS,
  soloEsEstudiante,
  type GrupoNav,
  type NavItem,
} from '@/lib/navigation'
import { useAuth } from '@/lib/auth'
import { usePreferences } from '@/lib/preferences'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type SidebarNavProps = {
  collapsed?: boolean
  onNavigate?: () => void
}

/** Qué grupos deja abiertos el usuario, entre visitas. */
const CLAVE_GRUPOS = 'nova_grupos_nav'

function esRutaActiva(href: string, pathname: string): boolean {
  return href === '/'
    ? pathname === '/'
    : pathname === href || pathname.startsWith(`${href}/`)
}

/** Sin tildes y en minúsculas: quien filtra escribe «auditoria», no «auditoría». */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function EntradaNav({
  item,
  activa,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  activa: boolean
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon

  const enlace = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={activa ? 'page' : undefined}
      className={cn(
        'sidebar-nav-item group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium',
        'transition-all duration-150',
        collapsed && 'justify-center px-2',
        activa
          ? 'sidebar-nav-item--active font-semibold'
          : 'text-foreground/80 hover:bg-secondary/70 hover:text-foreground',
      )}
    >
      {/* Lucide no tiene `weight`. El ítem activo ya se distingue por el fondo
          teñido y el color del texto, así que el icono solo cambia de tono:
          rellenarlo además sería marcar dos veces lo mismo. */}
      <Icon
        className="size-4 shrink-0 transition-transform duration-150 group-hover:scale-105"
        strokeWidth={activa ? 2.25 : 2}
        style={{ color: `var(--mod-${item.tono})` }}
      />
      {!collapsed && <span className="truncate tracking-tight">{item.title}</span>}
    </Link>
  )

  if (!collapsed) return enlace
  return (
    <Tooltip>
      <TooltipTrigger render={enlace} />
      <TooltipContent side="right">{item.title}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Panel lateral de navegación.
 *
 * La estructura es la del CRM de Zoho: unas pocas pantallas transversales
 * sueltas arriba, y debajo los módulos repartidos en grupos que se pliegan.
 * Con quince entradas, la lista plana obligaba a recorrerla entera cada vez
 * porque nada indicaba dónde mirar; plegada, lo normal es tener cinco o seis a
 * la vista y el grupo con el que se está trabajando abierto.
 *
 * El buscador de arriba filtra la lista. No es un lujo: cuando lo que buscas
 * está dentro de un grupo cerrado, la alternativa es abrir grupos hasta dar con
 * él. Mientras hay texto escrito los acordeones se ignoran y se enseña todo lo
 * que coincide, que es lo que se espera de un filtro.
 */
export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { locale, t } = usePreferences()

  const navItems = getNavItemsForRoles(user?.roles, locale)
  const displayRol = user?.roles?.[0] ?? 'ADMIN'
  const displayEmail = user?.email ?? ''
  const displayIniciales = user?.iniciales ?? 'AD'
  const esEstudiante = soloEsEstudiante(user?.roles)

  const [filtro, setFiltro] = useState('')
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})

  // El grupo que contiene la pantalla abierta empieza desplegado: al entrar por
  // una URL pegada, el menú tiene que enseñar dónde estás sin tener que buscarlo.
  const grupoActivo = navItems.find((item) => esRutaActiva(item.href, pathname))?.grupo

  useEffect(() => {
    let guardados: Record<string, boolean> = {}
    try {
      guardados = JSON.parse(localStorage.getItem(CLAVE_GRUPOS) ?? '{}')
    } catch {
      /* Preferencia de presentación: si el valor guardado no sirve, se ignora. */
    }
    setAbiertos({ operacion: true, ...guardados })
  }, [])

  const alternarGrupo = (grupo: GrupoNav) => {
    setAbiertos((previos) => {
      const siguientes = { ...previos, [grupo]: !(previos[grupo] ?? false) }
      try {
        localStorage.setItem(CLAVE_GRUPOS, JSON.stringify(siguientes))
      } catch {
        /* Sin almacenamiento el menú sigue funcionando; solo no recuerda. */
      }
      return siguientes
    })
  }

  const buscando = filtro.trim().length > 0
  const coincide = useMemo(() => {
    const aguja = normalizar(filtro.trim())
    return (item: NavItem) => !aguja || normalizar(item.title).includes(aguja)
  }, [filtro])

  const sueltos = navItems.filter((item) => !item.grupo && coincide(item))
  const grupos = ORDEN_GRUPOS.map((grupo) => ({
    grupo,
    items: navItems.filter((item) => item.grupo === grupo && coincide(item)),
  })).filter((seccion) => seccion.items.length > 0)

  const sinResultados = buscando && sueltos.length === 0 && grupos.length === 0

  return (
    <div className="glass-chrome relative flex h-full flex-col overflow-hidden border-r border-sidebar-border text-sidebar-foreground">
      {/* Marca */}
      <div
        className={cn(
          'relative z-10 flex h-13 items-center gap-2.5 border-b border-border/50 px-3',
          collapsed && 'justify-center px-2',
        )}
      >
        <div className="relative flex size-8.5 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-white p-1 shadow-sm">
          <Image
            src="/brand/cac-logo.png"
            alt="Logo CAC Academic"
            width={28}
            height={28}
            priority
            className="h-full w-full object-contain"
          />
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              CAC Academic
            </span>
            <span className="truncate text-[11px] font-medium text-muted-foreground">
              {esEstudiante ? t('studentPortal') : t('adminPanel')}
            </span>
          </div>
        )}
      </div>

      {/* Buscador de módulos. Sin sitio para él cuando está plegado. */}
      {!collapsed && (
        <div className="relative z-10 px-2 pt-2">
          <div className="flex h-8.5 items-center gap-2 rounded-xl border border-input/60 bg-card/70 px-2.5 shadow-xs transition-colors focus-within:border-primary/50">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={filtro}
              onChange={(event) => setFiltro(event.target.value)}
              placeholder={locale === 'en' ? 'Search' : 'Buscar'}
              aria-label={locale === 'en' ? 'Filter modules' : 'Filtrar módulos'}
              className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[13px] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            />
          </div>
        </div>
      )}

      <nav className="relative z-10 flex-1 overflow-y-auto px-2 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [::-webkit-scrollbar]:hidden">
        <ul className="flex flex-col gap-0.5">
          {sueltos.map((item) => (
            <li key={item.href}>
              <EntradaNav
                item={item}
                activa={esRutaActiva(item.href, pathname)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>

        {grupos.map(({ grupo, items }) => {
          // Al filtrar mandan las coincidencias, no lo que el usuario dejó
          // plegado: un resultado escondido dentro de un grupo cerrado es
          // exactamente lo que el buscador viene a evitar.
          const desplegado = buscando || (abiertos[grupo] ?? grupo === grupoActivo)
          return (
            <div key={grupo} className="mt-2">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => alternarGrupo(grupo)}
                  aria-expanded={desplegado}
                  className="sidebar-grupo"
                >
                  <ChevronRight
                    className={cn(
                      'size-3 shrink-0 transition-transform duration-150',
                      desplegado && 'rotate-90',
                    )}
                  />
                  {etiquetaDeGrupo(grupo, locale)}
                </button>
              )}
              {(desplegado || collapsed) && (
                <ul className="flex flex-col gap-0.5">
                  {items.map((item) => (
                    <li key={item.href}>
                      <EntradaNav
                        item={item}
                        activa={esRutaActiva(item.href, pathname)}
                        collapsed={collapsed}
                        onNavigate={onNavigate}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}

        {sinResultados && (
          <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
            {locale === 'en' ? 'No modules match' : 'Ningún módulo coincide'}
          </p>
        )}
      </nav>

      {/* Perfil */}
      <div className="relative z-10 border-t border-border/50 p-2">
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-xl p-2 transition-colors duration-150 hover:bg-secondary/70',
            collapsed && 'justify-center p-0',
          )}
        >
          <span className="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-xs">
            {displayIniciales}
          </span>
          {!collapsed && (
            <>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-semibold text-foreground">
                  {displayEmail || t('administrator')}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {displayRol}
                </span>
              </div>
              <button
                onClick={() => {
                  logout()
                  router.push('/login')
                }}
                title={t('signOut')}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
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
