'use client'

import { useEffect, useState } from 'react'
import {
  Bell,
  ChatCircle,
  FileText,
  FolderSimple,
  GraduationCap,
  Globe,
  List,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { usePathname, useRouter } from '@/compat/next-navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { notifications } from '@/lib/mock-data'
import { busquedaApi, estudiantesApi, mensajesApi, notificacionesApi } from '@/lib/api'
import type { BusquedaResponse, MensajeResponse, NotificacionResponse, ResultadoBusqueda } from '@/lib/types'
import { getNavItemsForRoles, soloEsEstudiante } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useBranding } from '@/lib/branding'
import { usePreferences } from '@/lib/preferences'

type HeaderProps = {
  onOpenMobile: () => void
}

const ADMIN_NOTIFICATION_DESTINATIONS: Record<string, string> = {
  n1: '/hojas-de-vida',
  n2: '/importaciones',
  n3: '/documentos',
  n4: '/proyectos',
}

const BUSQUEDA_VACIA: BusquedaResponse = {
  estudiantes: [],
  programas: [],
  documentos: [],
}

function formatNotificationTime(value: string, locale: 'es' | 'en') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return locale === 'es' ? 'Ahora' : 'Now'
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-CO' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatMessageTime(value: string, locale: 'es' | 'en') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-CO' : 'en-US', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }).format(date)
}

function IconButton({
  label,
  children,
  badge,
  onClick,
}: {
  label: string
  children: React.ReactNode
  badge?: number
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative flex size-9 items-center justify-center rounded-xl border border-border/50 bg-card/95 text-foreground shadow-sm backdrop-blur-xl transition-all duration-200 hover:border-primary/30 hover:bg-card hover:text-primary hover:scale-105 active:scale-95"
    >
      {children}
      {!!badge && (
        <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

export function Header({ onOpenMobile }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { branding } = useBranding()
  const { locale, setLocale, t } = usePreferences()
  const esEstudiante = soloEsEstudiante(user?.roles)

  const [studentNotifications, setStudentNotifications] = useState<NotificacionResponse[]>([])
  const [adminNotifications, setAdminNotifications] = useState(notifications)
  const [messages, setMessages] = useState<MensajeResponse[]>([])
  const [messageSheetOpen, setMessageSheetOpen] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<MensajeResponse | null>(null)
  const [reply, setReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [messageError, setMessageError] = useState('')

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<BusquedaResponse>(BUSQUEDA_VACIA)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        if (esEstudiante) {
          const profile = await estudiantesApi.obtenerMiPerfil()
          const response = await notificacionesApi.listarPorEstudiante(profile.id, 0, 8)
          if (active) setStudentNotifications(response.content)
        } else if (active) {
          setStudentNotifications([])
        }
      } catch {
        if (active) setStudentNotifications([])
      }
    })()
    return () => { active = false }
  }, [esEstudiante])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const data = esEstudiante ? await mensajesApi.mios() : await mensajesApi.listar()
        if (active) setMessages(data)
      } catch {
        if (active) setMessages([])
      }
    })()
    return () => { active = false }
  }, [esEstudiante])

  useEffect(() => {
    if (!searchOpen || esEstudiante || searchQuery.trim().length < 2) {
      setSearching(false)
      if (searchQuery.trim().length < 2) setSearchResults(BUSQUEDA_VACIA)
      return
    }
    let active = true
    setSearching(true)
    const timer = window.setTimeout(() => {
      void busquedaApi.buscar(searchQuery.trim())
        .then((data) => { if (active) setSearchResults(data) })
        .catch(() => { if (active) setSearchResults(BUSQUEDA_VACIA) })
        .finally(() => { if (active) setSearching(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [esEstudiante, searchOpen, searchQuery])

  const availableNavItems = getNavItemsForRoles(user?.roles, locale)
  const current = availableNavItems.find((item) => {
    const href = item.href.split('?')[0]
    return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
  }) ?? availableNavItems[0]
  // El banner del proyecto vive exclusivamente en la bienvenida del portal
  // estudiantil. La cabecera no usa imágenes de marca.
  const tituloHeader = (esEstudiante ? branding?.tituloHeader : null) || current?.title || 'NOVA CRM'
  const subtituloHeader = (esEstudiante ? branding?.subtituloHeader : null) || 'NOVA · Gestión académica'

  const notificationItems = esEstudiante
    ? studentNotifications.map((notification) => ({
        id: notification.id,
        titulo: notification.titulo,
         detalle: notification.mensaje,
         tiempo: formatNotificationTime(notification.createdAt, locale),
         leida: notification.leida,
         mediaUrl: notification.mediaUrl,
         mediaTipo: notification.mediaTipo,
      }))
    : adminNotifications
  const unreadNotifications = notificationItems.filter((notification) => !notification.leida).length
  const pendingMessages = messages.filter((message) =>
    esEstudiante ? message.estado === 'RESPONDIDO' : message.estado === 'ABIERTO',
  ).length

  const openNotification = async (id: string) => {
    if (esEstudiante) {
      const notification = studentNotifications.find((item) => item.id === id)
      if (notification && !notification.leida) {
        try {
          await notificacionesApi.marcarLeida(id)
          setStudentNotifications((items) =>
            items.map((item) => (item.id === id ? { ...item, leida: true } : item)),
          )
        } catch {
          // La bandeja permite volver a intentar la acción si falla la red.
        }
      }
      router.push('/mis-notificaciones')
      return
    }
    setAdminNotifications((items) =>
      items.map((item) => (item.id === id ? { ...item, leida: true } : item)),
    )
    router.push(ADMIN_NOTIFICATION_DESTINATIONS[id] || '/')
  }

  const abrirMensaje = (message: MensajeResponse) => {
    setSelectedMessage(message)
    setReply(message.respuesta ?? '')
    setMessageError('')
    setMessageSheetOpen(true)
  }

  const responderMensaje = async () => {
    if (!selectedMessage || !reply.trim() || esEstudiante) return
    setSendingReply(true)
    setMessageError('')
    try {
      const actualizado = await mensajesApi.responder(selectedMessage.id, reply.trim())
      setMessages((items) => items.map((item) => item.id === actualizado.id ? actualizado : item))
      setSelectedMessage(actualizado)
      setReply(actualizado.respuesta ?? '')
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'No se pudo enviar la respuesta.')
    } finally {
      setSendingReply(false)
    }
  }

  const abrirResultado = (resultado: ResultadoBusqueda) => {
    setSearchOpen(false)
    if (resultado.tipo === 'ESTUDIANTE') router.push(`/estudiantes/${resultado.id}`)
    else if (resultado.tipo === 'PROGRAMA') router.push(`/proyectos/${resultado.id}`)
    else router.push(`/documentos?q=${encodeURIComponent(resultado.titulo)}`)
  }

  const gruposBusqueda = [
    { titulo: t('students'), icon: GraduationCap, items: searchResults.estudiantes },
    { titulo: t('projects'), icon: FolderSimple, items: searchResults.programas },
    { titulo: t('documents'), icon: FileText, items: searchResults.documentos },
  ].filter((group) => group.items.length > 0)

  return (
    <>
      <header className="glass-chrome sticky top-0 z-30 flex h-18 shrink-0 items-center gap-3 overflow-hidden border-b border-border border-t-2 border-t-primary px-4 shadow-[0_8px_28px_-24px_rgba(15,23,42,0.45)] transition-all md:px-7">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label={t('openMenu')}
          className="relative z-10 flex size-9 items-center justify-center rounded-xl border border-border/50 bg-card/95 text-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-card hover:scale-105 active:scale-95 lg:hidden"
        >
          <List className="size-5" />
        </button>
        <div className="relative z-10 min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground md:text-lg">{tituloHeader}</h1>
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:text-[11px]">{subtituloHeader}</p>
        </div>

        <div className="relative z-10 ml-auto flex items-center gap-2">
          <IconButton label={t('generalSearch')} onClick={() => setSearchOpen(true)}>
            <MagnifyingGlass className="size-5" />
          </IconButton>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <IconButton label={t('notifications')} badge={unreadNotifications}>
                <Bell className="size-5" />
                </IconButton>
              }
            />
            <DropdownMenuContent align="end" className="w-80 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
              <DropdownMenuLabel className="font-semibold text-foreground">{t('notifications')}</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuGroup>
                {notificationItems.length === 0 ? (
                  <div className="px-3 py-7 text-center text-sm text-muted-foreground">{t('noNotifications')}</div>
                ) : notificationItems.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    onClick={() => void openNotification(notification.id)}
                    className="flex-col items-start gap-0.5 rounded-xl py-2.5 hover:bg-primary/10 focus:bg-primary/10"
                  >
                    <div className="flex w-full items-center gap-2">
                      <span className={cn('size-1.5 shrink-0 rounded-full', notification.leida ? 'bg-transparent' : 'bg-destructive')} />
                      <span className="text-sm font-medium text-foreground">{notification.titulo}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{notification.tiempo}</span>
                    </div>
                     <span className="pl-3.5 text-xs text-muted-foreground">{notification.detalle}</span>
                     {'mediaUrl' in notification && notification.mediaUrl && (
                       notification.mediaTipo === 'IMAGE' ? <img src={notification.mediaUrl} alt="Material del anuncio" className="mt-2 max-h-36 w-full rounded-lg border border-border/60 object-cover" />
                         : notification.mediaTipo === 'VIDEO' ? <video src={notification.mediaUrl} controls className="mt-2 max-h-36 w-full rounded-lg border border-border/60" />
                           : <a href={notification.mediaUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="mt-2 pl-3.5 text-xs font-medium text-primary hover:underline">Abrir información del anuncio</a>
                     )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              {esEstudiante && (
                <>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem onClick={() => router.push('/mis-notificaciones')} className="justify-center rounded-xl font-medium text-primary focus:bg-primary/10 focus:text-primary">
                    {t('viewAllNotifications')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <IconButton label={t('messages')} badge={pendingMessages} onClick={() => setMessageSheetOpen(true)}>
            <ChatCircle className="size-5" />
          </IconButton>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <IconButton label={locale === 'es' ? 'Cambiar idioma' : 'Change language'}>
                  <Globe className="size-5" />
                </IconButton>
              }
            />
            <DropdownMenuContent align="end" className="w-44 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">{locale === 'es' ? 'Idioma de la interfaz' : 'Interface language'}</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem onClick={() => setLocale('es')} className={cn('rounded-xl', locale === 'es' && 'bg-primary/10 text-primary')}>
                Español {locale === 'es' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocale('en')} className={cn('rounded-xl', locale === 'en' && 'bg-primary/10 text-primary')}>
                English {locale === 'en' && '✓'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="right" className="w-full border-l border-border bg-popover p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border/60 pr-12">
            <SheetTitle>{t('searchTitle')}</SheetTitle>
            <SheetDescription>{t('searchDescription')}</SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <div className="relative">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('searchPlaceholder')} className="pl-9" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
            {esEstudiante ? (
              <p className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">{t('searchAdminOnly')}</p>
            ) : searching ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('searching')}</p>
            ) : searchQuery.trim().length < 2 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('searchStart')}</p>
            ) : gruposBusqueda.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('searchEmpty', { query: searchQuery.trim() })}</p>
            ) : gruposBusqueda.map((group) => {
              const GroupIcon = group.icon
              return (
                <section key={group.titulo} className="mb-5">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><GroupIcon className="size-4" />{group.titulo}</p>
                  <div className="overflow-hidden rounded-xl border border-border/70">
                    {group.items.map((result) => (
                      <button key={result.id} type="button" onClick={() => abrirResultado(result)} className="flex w-full items-center gap-3 border-b border-border/60 px-3 py-3 text-left last:border-b-0 hover:bg-muted/50">
                        <GroupIcon className="size-4 shrink-0 text-primary" />
                        <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{result.titulo}</span>{result.subtitulo && <span className="block truncate text-xs text-muted-foreground">{result.subtitulo}</span>}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={messageSheetOpen} onOpenChange={setMessageSheetOpen}>
        <SheetContent side="right" className="w-full border-l border-border bg-popover p-0 sm:max-w-xl">
          <SheetHeader className="border-b border-border/60 pr-12">
            <SheetTitle>{esEstudiante ? 'Mis mensajes' : 'Mensajes de estudiantes'}</SheetTitle>
            <SheetDescription>{esEstudiante ? 'Consulta las respuestas del equipo de acompañamiento.' : 'Revisa y responde las solicitudes enviadas desde el portal estudiantil.'}</SheetDescription>
          </SheetHeader>
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)]">
            <div className="max-h-56 overflow-y-auto border-b border-border/60 md:max-h-none md:border-b-0 md:border-r">
              {messages.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No hay mensajes para mostrar.</p> : messages.map((message) => (
                <button key={message.id} type="button" onClick={() => abrirMensaje(message)} className={cn('w-full border-b border-border/60 px-3 py-3 text-left transition-colors hover:bg-muted/60', selectedMessage?.id === message.id && 'bg-primary/10')}>
                  <div className="flex items-center gap-2"><span className={cn('size-2 rounded-full', message.estado === 'ABIERTO' ? 'bg-primary' : 'bg-muted-foreground/30')} /><span className="truncate text-xs font-semibold text-foreground">{esEstudiante ? message.asunto : message.estudianteNombre}</span></div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{esEstudiante ? (message.respuesta ?? message.contenido) : message.asunto}</p>
                </button>
              ))}
            </div>
            <div className="min-h-0 overflow-y-auto p-4">
              {!selectedMessage ? <p className="py-12 text-center text-sm text-muted-foreground">Selecciona un mensaje para ver el detalle.</p> : (
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold text-foreground">{selectedMessage.asunto}</h2><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', selectedMessage.estado === 'ABIERTO' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{selectedMessage.estado === 'ABIERTO' ? 'Pendiente' : 'Respondido'}</span></div>
                    {!esEstudiante && <p className="text-xs text-muted-foreground">{selectedMessage.estudianteNombre} · {selectedMessage.estudianteEmail}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{formatMessageTime(selectedMessage.createdAt, locale)}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-3 text-sm leading-6 text-foreground whitespace-pre-wrap">{selectedMessage.contenido}</div>
                  {esEstudiante ? (
                    selectedMessage.respuesta ? <div className="rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="text-xs font-semibold text-primary">Respuesta del equipo</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{selectedMessage.respuesta}</p></div> : <p className="text-sm text-muted-foreground">El equipo aún está revisando este mensaje.</p>
                  ) : (
                    <div className="space-y-2"><label htmlFor="respuesta-mensaje" className="text-sm font-medium text-foreground">Respuesta para el estudiante</label><textarea id="respuesta-mensaje" value={reply} onChange={(event) => setReply(event.target.value)} rows={6} maxLength={5000} className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="Escribe una respuesta clara y útil…" />{messageError && <p className="text-xs text-destructive">{messageError}</p>}<Button type="button" onClick={() => void responderMensaje()} disabled={sendingReply || !reply.trim()}>{sendingReply ? 'Enviando…' : selectedMessage.estado === 'RESPONDIDO' ? 'Actualizar respuesta' : 'Enviar respuesta'}</Button></div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
