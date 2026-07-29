'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowBendDownLeft,
  ArrowsClockwise,
  Bell,
  ChatCircle,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  FileText,
  FolderSimple,
  GraduationCap,
  Globe,
  List,
  MagnifyingGlass,
  PaperPlaneTilt,
  UserCircle,
  WarningCircle,
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

type Conversacion = {
  id: string
  asunto: string
  mensajes: MensajeResponse[]
  ultimo: MensajeResponse
  pendiente: boolean
}

/** Los envíos antiguos usaban "Seguimiento:" en cada respuesta. Al quitar
 * todos esos prefijos, una conversación conserva el mismo hilo incluso si se
 * creó antes de que existiera la bandeja tipo chat. */
function asuntoConversacion(asunto: string): string {
  let limpio = asunto.trim()
  const prefijo = /^(seguimiento|follow-up)\s*:\s*/i
  while (prefijo.test(limpio)) limpio = limpio.replace(prefijo, '').trim()
  return limpio || 'Consulta al equipo de acompañamiento'
}

function agruparConversaciones(mensajes: MensajeResponse[]): Conversacion[] {
  const grupos = new Map<string, { asunto: string; mensajes: MensajeResponse[] }>()
  for (const mensaje of mensajes) {
    const asunto = asuntoConversacion(mensaje.asunto)
    const id = `${mensaje.estudianteId}:${asunto.toLocaleLowerCase()}`
    const grupo = grupos.get(id) ?? { asunto, mensajes: [] }
    grupo.mensajes.push(mensaje)
    grupos.set(id, grupo)
  }
  return Array.from(grupos.entries()).map(([id, grupo]) => {
    const mensajesOrdenados = [...grupo.mensajes].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    return {
      id,
      asunto: grupo.asunto,
      mensajes: mensajesOrdenados,
      ultimo: mensajesOrdenados[mensajesOrdenados.length - 1],
      pendiente: mensajesOrdenados.some((mensaje) => mensaje.estado === 'ABIERTO'),
    }
  }).sort((a, b) => new Date(b.ultimo.createdAt).getTime() - new Date(a.ultimo.createdAt).getTime())
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
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [studentBody, setStudentBody] = useState('')
  const [sendingStudentMessage, setSendingStudentMessage] = useState(false)

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<BusquedaResponse>(BUSQUEDA_VACIA)

  const conversaciones = useMemo(() => agruparConversaciones(messages), [messages])
  const conversacionSeleccionada = useMemo(
    () => selectedMessage
      ? conversaciones.find((conversacion) => conversacion.mensajes.some((mensaje) => mensaje.id === selectedMessage.id)) ?? null
      : null,
    [conversaciones, selectedMessage],
  )

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

  const cargarMensajes = useCallback(async () => {
    setMessagesLoading(true)
    setMessageError('')
    try {
      const data = esEstudiante ? await mensajesApi.mios() : await mensajesApi.listar()
      setMessages(data)
      setSelectedMessage((actual) => {
        const siguiente = data.find((item) => item.id === actual?.id) ?? data[0] ?? null
        setReply(siguiente?.respuesta ?? '')
        return siguiente
      })
    } catch (error) {
      setMessages([])
      setSelectedMessage(null)
      setMessageError(error instanceof Error ? error.message : 'No se pudieron cargar los mensajes.')
    } finally { setMessagesLoading(false) }
  }, [esEstudiante])

  useEffect(() => { void cargarMensajes() }, [cargarMensajes])
  useEffect(() => { if (messageSheetOpen) void cargarMensajes() }, [messageSheetOpen, cargarMensajes])
  useEffect(() => {
    const abrirBandeja = () => setMessageSheetOpen(true)
    window.addEventListener('nova:open-messages', abrirBandeja)
    return () => window.removeEventListener('nova:open-messages', abrirBandeja)
  }, [])

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
  const pendingMessages = conversaciones.filter((conversacion) =>
    esEstudiante ? conversacion.mensajes.some((mensaje) => mensaje.estado === 'RESPONDIDO') : conversacion.pendiente,
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

  const messageCopy = locale === 'es'
    ? {
        title: esEstudiante ? 'Mis mensajes' : 'Mensajes de estudiantes',
        subtitle: esEstudiante ? 'Consulta las respuestas del equipo de acompañamiento.' : 'Revisa, prioriza y responde las solicitudes recibidas desde el portal estudiantil.',
        inbox: 'Bandeja', pending: 'pendientes', all: 'Todos', empty: 'No hay mensajes para mostrar.',
        select: 'Selecciona un mensaje para ver la conversación.', sent: 'Mensaje recibido', response: 'Respuesta del equipo',
        reply: 'Responder al estudiante', replyPlaceholder: 'Escribe una respuesta clara, útil y respetuosa…',
        send: 'Enviar respuesta', update: 'Actualizar respuesta', sending: 'Enviando…', waiting: 'El equipo está revisando este mensaje.',
        open: 'Pendiente', answered: 'Respondido', refresh: 'Actualizar bandeja', from: 'De', to: 'Para',
      }
    : {
        title: esEstudiante ? 'My messages' : 'Student messages',
        subtitle: esEstudiante ? 'Check the answers from the support team.' : 'Review, prioritize, and respond to requests from the student portal.',
        inbox: 'Inbox', pending: 'pending', all: 'All', empty: 'No messages to show.',
        select: 'Select a message to view the conversation.', sent: 'Message received', response: 'Team response',
        reply: 'Reply to student', replyPlaceholder: 'Write a clear, helpful, and respectful response…',
        send: 'Send reply', update: 'Update reply', sending: 'Sending…', waiting: 'The team is reviewing this message.',
        open: 'Open', answered: 'Answered', refresh: 'Refresh inbox', from: 'From', to: 'To',
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

  const enviarMensajeEstudiante = async () => {
    if (!studentBody.trim()) return
    setSendingStudentMessage(true); setMessageError('')
    try {
      const asunto = selectedMessage
        ? asuntoConversacion(selectedMessage.asunto)
        : (locale === 'es' ? 'Consulta al equipo de acompañamiento' : 'Question for the support team')
      const nuevo = await mensajesApi.enviar({ asunto, contenido: studentBody.trim() })
      setMessages((actual) => [nuevo, ...actual])
      setSelectedMessage(nuevo); setReply('')
      setStudentBody('')
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.')
    } finally { setSendingStudentMessage(false) }
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
                     {notification.mediaUrl && (
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
        <SheetContent side="right" className="h-dvh w-full max-w-none gap-0 border-l border-border bg-popover p-0 sm:w-[min(92vw,1100px)] sm:!max-w-none">
          <SheetHeader className="shrink-0 border-b border-border/60 bg-[linear-gradient(115deg,color-mix(in_srgb,var(--primary)_17%,transparent),transparent_58%)] pr-14">
            <SheetTitle>{messageCopy.title}</SheetTitle>
            <SheetDescription>{messageCopy.subtitle}</SheetDescription>
          </SheetHeader>
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.8fr)]">
            <div className="max-h-56 overflow-y-auto border-b border-border/60 bg-muted/[0.18] p-2 lg:max-h-none lg:border-b-0 lg:border-r">
              {conversaciones.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{messageCopy.empty}</p> : conversaciones.map((conversacion) => (
                <button key={conversacion.id} type="button" onClick={() => abrirMensaje(conversacion.ultimo)} className={cn('mb-1 w-full rounded-xl border border-transparent px-3 py-3 text-left transition-all hover:border-primary/15 hover:bg-background', conversacionSeleccionada?.id === conversacion.id && 'border-primary/20 bg-background shadow-sm')}>
                  <div className="flex items-start gap-2.5"><span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', conversacion.pendiente ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>{(esEstudiante ? 'AC' : conversacion.ultimo.estudianteNombre || 'E').slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><span className="truncate text-xs font-semibold text-foreground">{esEstudiante ? conversacion.asunto : conversacion.ultimo.estudianteNombre}</span>{conversacion.pendiente && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{esEstudiante ? (conversacion.ultimo.respuesta ?? conversacion.ultimo.contenido) : conversacion.asunto}</span><span className="mt-1 block text-[10px] text-muted-foreground">{formatMessageTime(conversacion.ultimo.createdAt, locale)}</span></span></div>
                </button>
              ))}
            </div>
            <div className="flex min-h-0 min-w-0 flex-col bg-background/45">
              <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                {!conversacionSeleccionada ? <p className="py-12 text-center text-sm text-muted-foreground">{messageCopy.select}</p> : (
                  <div className="mx-auto max-w-2xl space-y-5">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold text-foreground">{conversacionSeleccionada.asunto}</h2><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', conversacionSeleccionada.pendiente ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{conversacionSeleccionada.pendiente ? messageCopy.open : messageCopy.answered}</span></div>
                    {!esEstudiante && <p className="text-xs text-muted-foreground">{conversacionSeleccionada.ultimo.estudianteNombre} · {conversacionSeleccionada.ultimo.estudianteEmail}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{formatMessageTime(conversacionSeleccionada.ultimo.createdAt, locale)}</p>
                  </div>
                  <div className="space-y-4">
                    {conversacionSeleccionada.mensajes.map((mensaje) => (
                      <div key={mensaje.id} className="space-y-2">
                        <div className={cn('flex', esEstudiante ? 'justify-end' : 'justify-start')}>
                          <div className={cn('max-w-[88%] break-words rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm whitespace-pre-wrap', esEstudiante ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-tl-md border border-border/70 bg-muted/25 text-foreground')}>
                            <p className={cn('mb-1 text-[10px] font-semibold', esEstudiante ? 'text-primary-foreground/75' : 'text-muted-foreground')}>{esEstudiante ? (locale === 'es' ? 'Tú' : 'You') : mensaje.estudianteNombre}</p>
                            {mensaje.contenido}
                            <p className={cn('mt-1 text-[10px]', esEstudiante ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{formatMessageTime(mensaje.createdAt, locale)}</p>
                          </div>
                        </div>
                        {mensaje.respuesta && <div className={cn('flex', esEstudiante ? 'justify-start' : 'justify-end')}><div className={cn('max-w-[88%] break-words rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm whitespace-pre-wrap', esEstudiante ? 'rounded-tl-md border border-primary/20 bg-primary/5 text-foreground' : 'rounded-br-md bg-primary text-primary-foreground')}><p className={cn('mb-1 text-[10px] font-semibold', esEstudiante ? 'text-primary' : 'text-primary-foreground/75')}>{messageCopy.response}</p>{mensaje.respuesta}<p className={cn('mt-1 text-[10px]', esEstudiante ? 'text-muted-foreground' : 'text-primary-foreground/70')}>{mensaje.respondidoAt ? formatMessageTime(mensaje.respondidoAt, locale) : ''}</p></div></div>}
                      </div>
                    ))}
                  </div>
                  {esEstudiante && !conversacionSeleccionada.mensajes.some((mensaje) => mensaje.respuesta) && <p className="text-sm text-muted-foreground">{messageCopy.waiting}</p>}
                  {!esEstudiante && (
                    <div className="space-y-2"><label htmlFor="respuesta-mensaje" className="text-sm font-medium text-foreground">{messageCopy.reply}</label><textarea id="respuesta-mensaje" value={reply} onChange={(event) => setReply(event.target.value)} rows={6} maxLength={5000} className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder={messageCopy.replyPlaceholder} />{messageError && <p className="text-xs text-destructive">{messageError}</p>}<Button type="button" onClick={() => void responderMensaje()} disabled={sendingReply || !reply.trim()}>{sendingReply ? messageCopy.sending : selectedMessage?.estado === 'RESPONDIDO' ? messageCopy.update : messageCopy.send}</Button></div>
                  )}
                  </div>
                )}
              </div>
              {esEstudiante && (
                <div className="shrink-0 border-t border-border/60 bg-card px-4 py-3 sm:px-5">
                  <div className="mx-auto flex max-w-2xl items-end gap-2">
                    <textarea
                      value={studentBody}
                      onChange={(event) => setStudentBody(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          void enviarMensajeEstudiante()
                        }
                      }}
                      rows={2}
                      maxLength={5000}
                      placeholder={locale === 'es' ? 'Escribe un mensaje al equipo de acompañamiento…' : 'Write a message to the support team…'}
                      className="min-h-11 min-w-0 flex-1 resize-y rounded-2xl border border-input bg-background px-4 py-2.5 text-sm leading-5 outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
                    />
                    {messageError && <p className="sr-only">{messageError}</p>}
                    <Button className="h-11 shrink-0 rounded-xl" onClick={() => void enviarMensajeEstudiante()} disabled={sendingStudentMessage || !studentBody.trim()}>
                      {sendingStudentMessage ? <ArrowsClockwise className="size-4 animate-spin" /> : <PaperPlaneTilt className="size-4" weight="fill" />}
                      <span className="hidden sm:inline">{locale === 'es' ? 'Enviar' : 'Send'}</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
