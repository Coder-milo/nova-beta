'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowBendDownLeftIcon as ArrowBendDownLeft, ArrowsClockwiseIcon as ArrowsClockwise, BellIcon as Bell, ChatCircleIcon as ChatCircle, CheckCircleIcon as CheckCircle, ClockIcon as Clock, EnvelopeSimpleIcon as EnvelopeSimple, FileTextIcon as FileText, FolderSimpleIcon as FolderSimple, GraduationCapIcon as GraduationCap, GlobeIcon as Globe, ListIcon as List, MagnifyingGlassIcon as MagnifyingGlass, PaperclipIcon as Paperclip, PaperPlaneTiltIcon as PaperPlaneTilt, UserCircleIcon as UserCircle, WarningCircleIcon as WarningCircle, XIcon as X } from '@phosphor-icons/react'
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
import { busquedaApi, chatsApi, dashboardApi, estudiantesApi, mensajesApi, notificacionesApi } from '@/lib/api'
import type { AlertaResponse, BusquedaResponse, ChatContactoResponse, ChatDirectoMensajeResponse, EstudianteResponse, MensajeResponse, NotificacionResponse, ResultadoBusqueda } from '@/lib/types'
import { getNavItemsForRoles, soloEsEstudiante } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useBranding } from '@/lib/branding'
import { usePreferences } from '@/lib/preferences'
// Renombrado: en este archivo ya hay un `type Conversacion` para los
// grupos de la bandeja, y dos cosas distintas con el mismo nombre en el
// mismo fichero se prestan a confusion aunque el compilador las tolere.
import { Conversacion as HiloConversacion } from '@/components/ui/conversacion'
import { Textarea } from '@/components/ui/textarea'

type HeaderProps = {
  onOpenMobile: () => void
}

const BUSQUEDA_VACIA: BusquedaResponse = {
  estudiantes: [],
  programas: [],
  documentos: [],
}

function formatNotificationTime(value: string, locale: 'es' | 'en') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return locale === 'es' ? 'Ahora' : 'Now'
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return locale === 'es' ? 'Hace un momento' : 'Just now'
  if (diffMins < 60) return locale === 'es' ? `Hace ${diffMins}m` : `${diffMins}m ago`
  if (diffHours < 24) return locale === 'es' ? `Hace ${diffHours}h` : `${diffHours}h ago`
  if (diffDays < 7) return locale === 'es' ? `Hace ${diffDays}d` : `${diffDays}d ago`

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

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
type HeaderNotification = {
  id: string
  titulo: string
  detalle: string
  tiempo: string
  leida: boolean
  mediaUrl?: string | null
  mediaTipo?: string | null
  /** A donde se va para resolverlo. Solo lo traen los avisos del equipo. */
  ruta?: string | null
}

/** Los envíos antiguos usaban "Seguimiento:" en cada respuesta. Al quitar
 * todos esos prefijos, una conversación conserva el mismo hilo incluso si se
 * creó antes de que existiera la bandeja tipo chat. */
function asuntoConversacion(asunto: string, respaldo: string): string {
  let limpio = asunto.trim()
  const prefijo = /^(seguimiento|follow-up)\s*:\s*/i
  while (prefijo.test(limpio)) limpio = limpio.replace(prefijo, '').trim()
  return limpio || respaldo
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
  const { user, cargando: cargandoSesion } = useAuth()
  const { branding } = useBranding()
  const { locale, setLocale, t } = usePreferences()
  /** Avisos sueltos del encabezado. */
  const avisos = locale === 'es'
    ? {
        consultaAlEquipo: 'Consulta al equipo de acompañamiento',
        noSePudoAbrir: 'No se pudo abrir la conversación.',
        noSePudieronCargar: 'No se pudieron cargar los mensajes.',
        noSePudoEnviarRespuesta: 'No se pudo enviar la respuesta.',
        noSePudoEnviarMensaje: 'No se pudo enviar el mensaje.',
        subtituloPorDefecto: 'NOVA · Gestión académica',
        materialDelAnuncio: 'Material del anuncio',
        abrirInformacion: 'Abrir información del anuncio',
        marcarTodasLeidas: 'Marcar todas como leídas',
        enviado: 'Enviado',
        visto: 'Visto',
      }
    : {
        consultaAlEquipo: 'Question for the support team',
        noSePudoAbrir: 'The conversation could not be opened.',
        noSePudieronCargar: 'The messages could not be loaded.',
        noSePudoEnviarRespuesta: 'The reply could not be sent.',
        noSePudoEnviarMensaje: 'The message could not be sent.',
        subtituloPorDefecto: 'NOVA · Academic management',
        materialDelAnuncio: 'Announcement material',
        abrirInformacion: 'Open announcement details',
        marcarTodasLeidas: 'Mark all as read',
        enviado: 'Sent',
        visto: 'Seen',
      }

  const esEstudiante = soloEsEstudiante(user?.roles)
  /**
   * Solo entonces `esEstudiante` significa algo. Antes de que la sesión se
   * lea, un estudiante todavía no tiene roles y pasa por gestor: llamar aquí
   * a un endpoint de administración le devuelve un 403 legítimo.
   */
  const sesionLista = !cargandoSesion && user !== null

  /** Avisos del equipo. Vacio para el estudiante, que tiene los suyos. */
  const [alertas, setAlertas] = useState<AlertaResponse[]>([])
  const [studentNotifications, setStudentNotifications] = useState<NotificacionResponse[]>([])
  const [studentUnreadNotifications, setStudentUnreadNotifications] = useState(0)
  // Se guarda al cargar las notificaciones: marcarlas todas necesita el id, y
  // pedir el perfil otra vez sólo para eso sería una llamada de más.
  const [messages, setMessages] = useState<MensajeResponse[]>([])
  const [pendientesServidor, setPendientesServidor] = useState<number | null>(null)
  const [messageSheetOpen, setMessageSheetOpen] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<MensajeResponse | null>(null)
  const [filtroNotificacion, setFiltroNotificacion] = useState<'todas' | 'no_leidas'>('todas')
  const [reply, setReply] = useState('')
  const [replyAttachments, setReplyAttachments] = useState<File[]>([])
  const [sendingReply, setSendingReply] = useState(false)
  const [messageError, setMessageError] = useState('')
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [adminStudentQuery, setAdminStudentQuery] = useState('')
  const [adminStudentResults, setAdminStudentResults] = useState<EstudianteResponse[]>([])
  const [adminStudentsLoading, setAdminStudentsLoading] = useState(false)
  const [adminTarget, setAdminTarget] = useState<EstudianteResponse | null>(null)
  const [studentBody, setStudentBody] = useState('')
  const [studentAttachments, setStudentAttachments] = useState<File[]>([])
  const [sendingStudentMessage, setSendingStudentMessage] = useState(false)
  const [directContact, setDirectContact] = useState<ChatContactoResponse | null>(null)
  const [directMessages, setDirectMessages] = useState<ChatDirectoMensajeResponse[]>([])
  const [directLoading, setDirectLoading] = useState(false)
  const [contactQuery, setContactQuery] = useState('')
  const [contactResults, setContactResults] = useState<ChatContactoResponse[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const studentFileInputRef = useRef<HTMLInputElement>(null)
  const replyFileInputRef = useRef<HTMLInputElement>(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<BusquedaResponse>(BUSQUEDA_VACIA)

  /**
   * Un hilo por mensaje, del mas reciente al mas antiguo.
   *
   * La bandeja agrupaba por estudiante y mostraba una entrada por persona; con
   * el modelo de turnos, la conversacion es el asunto y sus intervenciones, asi
   * que la lista los enumera directamente.
   */
  /**
   * Cuándo se movió el hilo por última vez.
   *
   * `createdAt` es cuando se abrió, no cuando ocurrió lo último. Una bandeja
   * ordenada por eso deja abajo la conversación que se acaba de responder y
   * arriba una de hace un mes, y la fecha que enseña cada fila no corresponde
   * a lo que se lee justo al lado.
   */
  const ultimaActividad = (m: MensajeResponse) => {
    const abierto = new Date(m.createdAt).getTime()
    const respondido = m.respondidoAt ? new Date(m.respondidoAt).getTime() : 0
    return Math.max(abierto, respondido)
  }

  const hilos = useMemo(
    () => [...messages].sort((a, b) => ultimaActividad(b) - ultimaActividad(a)),
    [messages],
  )



  // Los avisos del equipo se refrescan con la misma cadencia que el resto de
  // la cabecera. Un estudiante no los pide: el endpoint es de gestion y le
  // devolveria un 403.
  useEffect(() => {
    if (!sesionLista || esEstudiante) return
    let activo = true
    const cargarAlertas = () => {
      void dashboardApi.alerts()
        .then((data) => { if (activo) setAlertas(data) })
        .catch(() => { if (activo) setAlertas([]) })
    }
    cargarAlertas()
    const id = window.setInterval(cargarAlertas, 60_000)
    return () => { activo = false; window.clearInterval(id) }
  }, [sesionLista, esEstudiante])

  useEffect(() => {
    if (!sesionLista) return
    let active = true
    const cargarNotificaciones = async () => {
      try {
        if (esEstudiante) {
          // Sin el id: el servidor sabe quién pregunta. Antes este bloque
          // pedía la ficha entera del estudiante sólo para sacarlo.
          const [response, unread] = await Promise.all([
            notificacionesApi.mias(0, 8),
            notificacionesApi.misNoLeidas(),
          ])
          if (active) {
            setStudentNotifications(response.content)
            setStudentUnreadNotifications(unread)
            window.dispatchEvent(new CustomEvent('nova:notifications-updated', { detail: unread }))
          }
        } else if (active) {
          setStudentNotifications([])
          setStudentUnreadNotifications(0)
        }
      } catch {
        if (active) {
          setStudentNotifications([])
          setStudentUnreadNotifications(0)
        }
      }
    }
    void cargarNotificaciones()
    const refreshId = window.setInterval(() => { void cargarNotificaciones() }, 45_000)
    return () => { active = false; window.clearInterval(refreshId) }
  }, [sesionLista, esEstudiante])

  useEffect(() => {
    if (!esEstudiante) return
    const sincronizarContador = (event: Event) => {
      const total = Number((event as CustomEvent<number>).detail)
      if (Number.isFinite(total) && total >= 0) setStudentUnreadNotifications(total)
    }
    window.addEventListener('nova:notifications-updated', sincronizarContador)
    return () => window.removeEventListener('nova:notifications-updated', sincronizarContador)
  }, [esEstudiante])

  useEffect(() => {
    if (!esEstudiante || contactQuery.trim().length < 2) {
      setContactResults([])
      setContactsLoading(false)
      return
    }
    let active = true
    setContactsLoading(true)
    const timer = window.setTimeout(() => {
      void chatsApi.contactos(contactQuery.trim())
        .then((data) => { if (active) setContactResults(data) })
        .catch(() => { if (active) setContactResults([]) })
        .finally(() => { if (active) setContactsLoading(false) })
    }, 220)
    return () => { active = false; window.clearTimeout(timer) }
  }, [contactQuery, esEstudiante])

  useEffect(() => {
    if (esEstudiante || adminStudentQuery.trim().length < 2) {
      setAdminStudentResults([])
      setAdminStudentsLoading(false)
      return
    }
    let active = true
    setAdminStudentsLoading(true)
    const timer = window.setTimeout(() => {
      void estudiantesApi.buscarAvanzado({ q: adminStudentQuery.trim(), size: 8 })
        .then((data) => { if (active) setAdminStudentResults(data.content) })
        .catch(() => { if (active) setAdminStudentResults([]) })
        .finally(() => { if (active) setAdminStudentsLoading(false) })
    }, 220)
    return () => { active = false; window.clearTimeout(timer) }
  }, [adminStudentQuery, esEstudiante])

  useEffect(() => {
    if (!directContact || !esEstudiante) return
    let active = true
    setDirectLoading(true)
    setMessageError('')
    void chatsApi.conversacion(directContact.id)
      .then((data) => {
        if (!active) return
        setDirectMessages(data)
        // El nombre real sale de la propia conversación. Al abrirla desde un
        // aviso sólo se conoce el id, y ponerlo a mano recortando el título del
        // aviso ataría la pantalla a cómo está redactado ese texto.
        const suyo = data.find((mensaje) => !mensaje.enviadoPorMi)
        if (suyo && suyo.remitenteNombre) {
          setDirectContact((actual) =>
            actual && actual.nombre !== suyo.remitenteNombre
              ? { ...actual, nombre: suyo.remitenteNombre }
              : actual)
        }
      })
      .catch((error) => {
        if (active) {
          setDirectMessages([])
          setMessageError(error instanceof Error ? error.message : avisos.noSePudoAbrir)
        }
      })
      .finally(() => { if (active) setDirectLoading(false) })
    return () => { active = false }
  }, [directContact, esEstudiante])

  const cargarMensajes = useCallback(async () => {
    if (!sesionLista) return
    setMessagesLoading(true)
    setMessageError('')
    try {
      const data = esEstudiante ? await mensajesApi.mios() : await mensajesApi.listar()
      setMessages(data)
      setReplyAttachments([])
      setSelectedMessage((actual) => {
        const siguiente = data.find((item) => item.id === actual?.id) ?? data[0] ?? null
        setReply(siguiente?.respuesta ?? '')
        return siguiente
      })
    } catch (error) {
      setMessages([])
      setSelectedMessage(null)
      setMessageError(error instanceof Error ? error.message : avisos.noSePudieronCargar)
    } finally { setMessagesLoading(false) }
  }, [sesionLista, esEstudiante])

  useEffect(() => { void cargarMensajes() }, [cargarMensajes])
  useEffect(() => { if (messageSheetOpen) void cargarMensajes() }, [messageSheetOpen, cargarMensajes])
  /**
   * El contador de la campana, por su cuenta.
   *
   * Antes este intervalo recargaba la bandeja entera cada 45 segundos sólo
   * para que el número estuviera al día: cada coordinador con la aplicación
   * abierta pedía todos los hilos que existen, con sus adjuntos, un millar de
   * veces al día. La lista completa se carga al abrir la bandeja, que es
   * cuando alguien va a leerla.
   */
  useEffect(() => {
    if (!sesionLista) return
    let activo = true
    const contar = () => {
      void mensajesApi.pendientes()
        .then((n) => { if (activo) setPendientesServidor(n) })
        .catch(() => undefined)
    }
    contar()
    const refreshId = window.setInterval(contar, 45_000)
    return () => { activo = false; window.clearInterval(refreshId) }
  }, [sesionLista])
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
  const subtituloHeader = (esEstudiante ? branding?.subtituloHeader : null) || avisos.subtituloPorDefecto

  /**
   * Lo que el equipo tiene pendiente de verdad.
   *
   * Antes esta lista se fabricaba a partir de los mensajes abiertos, con
   * `leida: false` fijo: el contador nunca bajaba —no habia nada que marcar— y
   * repetia el dato del icono de mensajes, que ya esta al lado.
   *
   * Ahora sale de `/dashboard/alerts`, que existia desde antes y nadie
   * consumia desde aqui: estudiantes sin datos de contacto, programas por
   * finalizar, seguimientos vencidos y ofertas sin validar. Cada aviso trae la
   * ruta donde se resuelve, y desaparece solo cuando el trabajo esta hecho,
   * que es lo que un pendiente deberia hacer.
   */
  const adminNotificationItems = useMemo<HeaderNotification[]>(() => alertas.map((alerta, indice) => ({
    id: `${alerta.tipo}-${alerta.referenciaId ?? indice}`,
    titulo: alerta.titulo,
    detalle: alerta.detalle,
    tiempo: alerta.severidad === 'ALTA' ? (locale === 'es' ? 'Prioritario' : 'High priority') : '',
    // No se marcan como leidos: se resuelven. Mientras el aviso siga ahi, el
    // trabajo sigue sin hacer.
    leida: false,
    ruta: alerta.ruta,
  })), [alertas, locale])
  const notificationItems: HeaderNotification[] = esEstudiante
    ? studentNotifications.map((notification) => ({
        id: notification.id,
        titulo: notification.titulo,
         detalle: notification.mensaje,
         tiempo: formatNotificationTime(notification.createdAt, locale),
         leida: notification.leida,
         mediaUrl: notification.mediaUrl,
         mediaTipo: notification.mediaTipo,
      }))
    : adminNotificationItems
  const unreadNotifications = esEstudiante
    ? studentUnreadNotifications
    : notificationItems.filter((notification) => !notification.leida).length
  // Por hilo y no por estudiante: dos asuntos abiertos de la misma persona son
  // dos cosas que atender, y agrupados contaban como una.
  // El servidor lo cuenta. Antes salía de `hilos`, que es lo cargado: si algún
  // día se acota esa lista, el número dejaría de ser el total sin avisar.
  const pendingMessages = pendientesServidor ?? hilos.filter((hilo) =>
    esEstudiante ? hilo.estado === 'RESPONDIDO' : hilo.estado === 'ABIERTO',
  ).length

  /**
   * Deja el contador a cero de una vez.
   *
   * Sólo para el estudiante: lo que ve el equipo en la campana son alertas
   * calculadas del panel, no filas de `notificacion`, y no hay nada que marcar.
   */
  const marcarTodasLeidas = async () => {
    if (!esEstudiante || studentUnreadNotifications === 0) return
    try {
      await notificacionesApi.marcarMisLeidas()
      setStudentNotifications((items) => items.map((item) => ({ ...item, leida: true })))
      setStudentUnreadNotifications(0)
      window.dispatchEvent(new CustomEvent('nova:notifications-updated', { detail: 0 }))
    } catch {
      // Si falla la red el contador se queda como estaba y se puede reintentar.
    }
  }

  const openNotification = async (id: string) => {
    if (esEstudiante) {
      const notification = studentNotifications.find((item) => item.id === id)
      if (notification && !notification.leida) {
        try {
          await notificacionesApi.marcarLeida(id)
          setStudentNotifications((items) =>
            items.map((item) => (item.id === id ? { ...item, leida: true } : item)),
          )
          setStudentUnreadNotifications((count) => {
            const updatedCount = Math.max(0, count - 1)
            window.dispatchEvent(new CustomEvent('nova:notifications-updated', { detail: updatedCount }))
            return updatedCount
          })
        } catch {
          // La bandeja permite volver a intentar la acción si falla la red.
        }
      }
      // Un aviso de chat abre esa conversación, no la lista de avisos. La
      // referencia es quien escribió, que es lo único que hace falta para
      // llegar; el nombre sale del propio título. Sin esto el aviso decía
      // «Mensaje de María» y llevaba a una lista donde había que volver a
      // buscar a María.
      if (notification?.tipo === 'CHAT' && notification.referenciaId) {
        // El nombre se corrige solo al cargar la conversación, que lo trae en
        // cada mensaje; el título del aviso sólo sirve de rótulo mientras tanto.
        abrirChatDirecto({ id: notification.referenciaId, nombre: notification.titulo, fotoUrl: null })
        return
      }
      router.push('/mis-notificaciones')
      return
    }
    const alerta = adminNotificationItems.find((item) => item.id === id)
    if (alerta?.ruta) router.push(alerta.ruta)
  }

  const abrirMensaje = (message: MensajeResponse) => {
    setDirectContact(null)
    setDirectMessages([])
    setAdminTarget(null)
    setStudentAttachments([])
    setSelectedMessage(message)
    setReply('')
    setReplyAttachments([])
    setMessageError('')
    setMessageSheetOpen(true)
  }

  const abrirChatDirecto = (contacto: ChatContactoResponse) => {
    setDirectContact(contacto)
    setDirectMessages([])
    setSelectedMessage(null)
    setStudentAttachments([])
    setStudentBody('')
    setContactQuery('')
    setContactResults([])
    setMessageError('')
    setMessageSheetOpen(true)
  }

  const abrirChatConEstudiante = (estudiante: EstudianteResponse) => {
    const existente = hilos.find((hilo) => hilo.estudianteId === estudiante.id)
    if (existente) {
      abrirMensaje(existente)
      return
    }
    setDirectContact(null)
    setDirectMessages([])
    setSelectedMessage(null)
    setAdminTarget(estudiante)
    setReply('')
    setReplyAttachments([])
    setAdminStudentQuery('')
    setAdminStudentResults([])
    setMessageError('')
    setMessageSheetOpen(true)
  }

  /** Textos del hilo. El componente no traduce por su cuenta. */
  const textosConversacion = locale === 'es'
    ? {
        escribir: 'Escribe un mensaje…', enviar: 'Enviar', adjuntar: 'Adjuntar un archivo',
        responder: 'Responder a este mensaje', reaccionar: 'Reaccionar', cancelar: 'Quitar',
        vacio: 'Todavía no hay mensajes en esta conversación.', cargando: 'Cargando conversación…',
        respondiendoA: 'Respondiendo a', maxArchivos: 'Hasta 5 archivos',
        errorCargar: 'No se pudo cargar la conversación.',
        errorEnviar: 'No se pudo enviar el mensaje.',
        errorReaccionar: 'No se pudo reaccionar.',
      }
    : {
        escribir: 'Write a message…', enviar: 'Send', adjuntar: 'Attach a file',
        responder: 'Reply to this message', reaccionar: 'React', cancelar: 'Remove',
        vacio: 'No messages in this conversation yet.', cargando: 'Loading conversation…',
        respondiendoA: 'Replying to', maxArchivos: 'Up to 5 files',
        errorCargar: 'The conversation could not be loaded.',
        errorEnviar: 'The message could not be sent.',
        errorReaccionar: 'The reaction could not be saved.',
      }

  const messageCopy = locale === 'es'
    ? {
        title: esEstudiante ? 'Mis mensajes' : 'Mensajes de estudiantes',
        subtitle: esEstudiante ? 'Consulta las respuestas del equipo de acompañamiento.' : 'Revisa, prioriza y responde las solicitudes recibidas desde el portal estudiantil.',
        inbox: 'Bandeja', pending: 'pendientes', all: 'Todos', empty: 'No hay mensajes para mostrar.',
        select: 'Selecciona un mensaje para ver la conversación.', sent: 'Mensaje recibido', response: 'Respuesta del equipo',
        reply: 'Mensaje para el estudiante', replyPlaceholder: 'Escribe un mensaje claro, útil y respetuoso…',
        send: 'Enviar', sending: 'Enviando…', waiting: 'El equipo está revisando este mensaje.',
        open: 'Pendiente', answered: 'Respondido', refresh: 'Actualizar bandeja', from: 'De', to: 'Para',
      }
    : {
        title: esEstudiante ? 'My messages' : 'Student messages',
        subtitle: esEstudiante ? 'Check the answers from the support team.' : 'Review, prioritize, and respond to requests from the student portal.',
        inbox: 'Inbox', pending: 'pending', all: 'All', empty: 'No messages to show.',
        select: 'Select a message to view the conversation.', sent: 'Message received', response: 'Team response',
        reply: 'Message to student', replyPlaceholder: 'Write a clear, helpful, and respectful message…',
        send: 'Send', sending: 'Sending…', waiting: 'The team is reviewing this message.',
        open: 'Open', answered: 'Answered', refresh: 'Refresh inbox', from: 'From', to: 'To',
      }

  const responderMensaje = async () => {
    const estudianteId = selectedMessage?.estudianteId ?? adminTarget?.id
    if (!estudianteId || (!reply.trim() && replyAttachments.length === 0) || esEstudiante) return
    setSendingReply(true)
    setMessageError('')
    try {
      const actualizado = await mensajesApi.enviarAEstudiante(estudianteId, reply.trim(), replyAttachments)
      setMessages((items) => [
        actualizado,
        ...items.map((item) => item.estudianteId === estudianteId && item.estado === 'ABIERTO'
          ? { ...item, estado: 'RESPONDIDO' as const }
          : item),
      ])
      setSelectedMessage(actualizado)
      setAdminTarget(null)
      setReply('')
      setReplyAttachments([])
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : avisos.noSePudoEnviarRespuesta)
    } finally {
      setSendingReply(false)
    }
  }

  const enviarMensajeEstudiante = async () => {
    if (directContact ? !studentBody.trim() : (!studentBody.trim() && studentAttachments.length === 0)) return
    setSendingStudentMessage(true); setMessageError('')
    try {
      if (directContact) {
        if (!studentBody.trim()) return
        const nuevo = await chatsApi.enviar(directContact.id, studentBody.trim())
        setDirectMessages((actual) => [...actual, nuevo])
        setStudentBody('')
        return
      }
      const asunto = 'CAC Academic'
      const nuevo = await mensajesApi.enviar({ asunto, contenido: studentBody.trim(), archivos: studentAttachments })
      setMessages((actual) => [nuevo, ...actual])
      setSelectedMessage(nuevo); setReply('')
      setStudentBody('')
      setStudentAttachments([])
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : avisos.noSePudoEnviarMensaje)
    } finally { setSendingStudentMessage(false) }
  }

  const agregarAdjuntosEstudiante = (archivos: File[]) => {
    const candidatos = archivos.filter((archivo) => archivo.size > 0)
    const demasiadoGrandes = candidatos.filter((archivo) => archivo.size > 10 * 1024 * 1024)
    if (demasiadoGrandes.length > 0) {
      setMessageError(locale === 'es' ? 'Cada archivo puede pesar hasta 10 MB.' : 'Each file can be up to 10 MB.')
      return
    }
    const disponibles = Math.max(0, 5 - studentAttachments.length)
    if (candidatos.length > disponibles) {
      setMessageError(locale === 'es' ? 'Puedes adjuntar hasta 5 archivos por mensaje.' : 'You can attach up to 5 files per message.')
    } else {
      setMessageError('')
    }
    if (disponibles > 0) setStudentAttachments((actual) => [...actual, ...candidatos.slice(0, disponibles)])
  }

  const quitarAdjuntoEstudiante = (indice: number) => {
    setStudentAttachments((actual) => actual.filter((_, actualIndice) => actualIndice !== indice))
  }

  const agregarAdjuntosRespuesta = (archivos: File[]) => {
    const candidatos = archivos.filter((archivo) => archivo.size > 0)
    if (candidatos.some((archivo) => archivo.size > 10 * 1024 * 1024)) {
      setMessageError(locale === 'es' ? 'Cada archivo puede pesar hasta 10 MB.' : 'Each file can be up to 10 MB.')
      return
    }
    const disponibles = Math.max(0, 5 - replyAttachments.length)
    if (candidatos.length > disponibles) {
      setMessageError(locale === 'es' ? 'Puedes adjuntar hasta 5 archivos por respuesta.' : 'You can attach up to 5 files per reply.')
    } else {
      setMessageError('')
    }
    if (disponibles > 0) setReplyAttachments((actual) => [...actual, ...candidatos.slice(0, disponibles)])
  }

  const quitarAdjuntoRespuesta = (indice: number) => {
    setReplyAttachments((actual) => actual.filter((_, actualIndice) => actualIndice !== indice))
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
  // La cabecera describe el hilo abierto. Para el equipo, de quien es; para el
  // estudiante, siempre el equipo. El asunto va debajo, que es lo que ahora
  // distingue una conversacion de otra del mismo estudiante.
  const nombreChatActivo = esEstudiante
    ? 'CAC Academy'
    : (selectedMessage?.estudianteNombre ?? adminTarget?.nombre ?? '')
  const correoChatActivo = !esEstudiante
    ? (selectedMessage?.estudianteEmail ?? adminTarget?.email ?? '')
    : ''

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
          {/* La búsqueda general es de gestión: el endpoint sólo responde a
              COORDINADOR y ADMIN. Se pintaba para todos, así que un estudiante
              abría el panel, escribía y no ocurría nada nunca —el efecto que
              consulta sale antes por su rol—. Un botón que no hace nada es peor
              que uno que no está. */}
          {!esEstudiante && (
            <IconButton label={t('generalSearch')} onClick={() => setSearchOpen(true)}>
              <MagnifyingGlass className="size-5" />
            </IconButton>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <IconButton label={t('notifications')} badge={unreadNotifications}>
                  <Bell className="size-5" />
                </IconButton>
              }
            />
            <DropdownMenuContent align="end" className="w-[min(92vw,24rem)] rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-[0_20px_50px_rgba(0,0,0,0.25)] dark:bg-[#0c1714]">
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-sm font-bold text-foreground">{t('notifications')}</span>
                {esEstudiante && studentUnreadNotifications > 0 && (
                  <button
                    type="button"
                    onClick={(event) => { event.preventDefault(); void marcarTodasLeidas() }}
                    className="text-[11px] font-semibold text-primary transition hover:underline"
                  >
                    {avisos.marcarTodasLeidas}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 pb-1.5">
                <button
                  type="button"
                  onClick={() => setFiltroNotificacion('todas')}
                  className={cn(
                    'rounded-lg px-3 py-1 text-xs font-semibold transition',
                    filtroNotificacion === 'todas'
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  {locale === 'es' ? 'Todas' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroNotificacion('no_leidas')}
                  className={cn(
                    'rounded-lg px-3 py-1 text-xs font-semibold transition',
                    filtroNotificacion === 'no_leidas'
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  {locale === 'es' ? 'No leídas' : 'Unread'} ({unreadNotifications})
                </button>
              </div>

              <DropdownMenuSeparator className="my-1 bg-border/50" />

              <div className="max-h-80 space-y-1 overflow-y-auto py-1">
                {(filtroNotificacion === 'no_leidas'
                  ? notificationItems.filter((n) => !n.leida)
                  : notificationItems
                ).length === 0 ? (
                  <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                    {filtroNotificacion === 'no_leidas'
                      ? (locale === 'es' ? 'No tienes notificaciones sin leer.' : 'No unread notifications.')
                      : t('noNotifications')}
                  </div>
                ) : (
                  (filtroNotificacion === 'no_leidas'
                    ? notificationItems.filter((n) => !n.leida)
                    : notificationItems
                  ).map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      onClick={() => void openNotification(notification.id)}
                      className={cn(
                        'flex items-start gap-3 rounded-xl p-2.5 transition cursor-pointer',
                        !notification.leida
                          ? 'bg-primary/[0.08] dark:bg-primary/15 border-l-2 border-primary'
                          : 'hover:bg-muted/50',
                      )}
                    >
                      <span className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs transition',
                        !notification.leida
                          ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                          : 'bg-muted text-muted-foreground',
                      )}>
                        <Bell className="size-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn('text-xs leading-4 truncate', !notification.leida ? 'font-bold text-foreground' : 'font-medium text-foreground/80')}>
                            {notification.titulo}
                          </span>
                          <span className="text-[10px] shrink-0 text-muted-foreground font-medium">{notification.tiempo}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground line-clamp-2">{notification.detalle}</p>
                        {notification.mediaUrl && (
                          notification.mediaTipo === 'IMAGE' ? <img src={notification.mediaUrl} alt={avisos.materialDelAnuncio} className="mt-2 max-h-36 w-full rounded-lg border border-border/60 object-cover" />
                            : notification.mediaTipo === 'VIDEO' ? <video src={notification.mediaUrl} controls className="mt-2 max-h-36 w-full rounded-lg border border-border/60" />
                              : <span className="mt-1 block text-xs font-medium text-primary hover:underline">{avisos.abrirInformacion}</span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </div>

              {esEstudiante && (
                <>
                  <DropdownMenuSeparator className="my-1 bg-border/50" />
                  <DropdownMenuItem onClick={() => router.push('/mis-notificaciones')} className="justify-center rounded-xl font-semibold text-xs text-primary focus:bg-primary/10 focus:text-primary">
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
        <SheetContent side="right" className="h-dvh w-full max-w-none gap-0 border-l border-border bg-popover p-0 dark:bg-[#0c1714] sm:w-[min(92vw,840px)] sm:!max-w-none">
          <SheetHeader className="shrink-0 border-b border-border/60 bg-[linear-gradient(115deg,color-mix(in_srgb,var(--primary)_17%,transparent),transparent_58%)] pr-14 dark:bg-[#13221d]">
            <SheetTitle>{messageCopy.title}</SheetTitle>
            <SheetDescription>{messageCopy.subtitle}</SheetDescription>
          </SheetHeader>
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(190px,0.68fr)_minmax(0,1.9fr)]">
            <div className="max-h-56 overflow-y-auto border-b border-border/60 bg-muted/[0.18] p-2 dark:bg-[#101d19] lg:max-h-none lg:border-b-0 lg:border-r">
              {!esEstudiante && (
                <div className="mb-2 border-b border-border/60 pb-2">
                  <div className="relative">
                    <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={adminStudentQuery} onChange={(event) => setAdminStudentQuery(event.target.value)} placeholder={locale === 'es' ? 'Buscar estudiante…' : 'Search student…'} className="h-9 rounded-xl bg-background pl-9 text-xs dark:bg-[#0a1512]" />
                  </div>
                  {adminStudentQuery.trim().length >= 2 && (
                    <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                      {adminStudentsLoading ? <p className="px-2 py-2 text-xs text-muted-foreground">{locale === 'es' ? 'Buscando estudiantes…' : 'Searching students…'}</p>
                        : adminStudentResults.length === 0 ? <p className="px-2 py-2 text-xs text-muted-foreground">{locale === 'es' ? 'No encontramos estudiantes.' : 'No students found.'}</p>
                          : adminStudentResults.map((estudiante) => (
                            <button key={estudiante.id} type="button" onClick={() => abrirChatConEstudiante(estudiante)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-background">
                              {estudiante.fotoUrl ? <img src={estudiante.fotoUrl} alt="" className="size-7 rounded-full object-cover" /> : <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{`${estudiante.nombre[0] ?? ''}${estudiante.apellido[0] ?? ''}`.toUpperCase()}</span>}
                              <span className="min-w-0"><span className="block truncate text-xs font-semibold text-foreground">{estudiante.nombre} {estudiante.apellido}</span><span className="block truncate text-[10px] text-muted-foreground">{estudiante.email}</span></span>
                            </button>
                          ))}
                    </div>
                  )}
                </div>
              )}
              {esEstudiante && (
                <div className="mb-2 border-b border-border/60 pb-2">
                  <div className="relative">
                    <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} placeholder={locale === 'es' ? 'Buscar compañeros…' : 'Search classmates…'} className="h-9 rounded-xl bg-background pl-9 text-xs dark:bg-[#0a1512]" />
                  </div>
                  {contactQuery.trim().length >= 2 && (
                    <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                      {contactsLoading ? <p className="px-2 py-2 text-xs text-muted-foreground">{locale === 'es' ? 'Buscando compañeros…' : 'Searching classmates…'}</p>
                        : contactResults.length === 0 ? <p className="px-2 py-2 text-xs text-muted-foreground">{locale === 'es' ? 'No hay compañeros con ese nombre.' : 'No classmates found.'}</p>
                          : contactResults.map((contacto) => (
                            <button key={contacto.id} type="button" onClick={() => abrirChatDirecto(contacto)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-background">
                              {contacto.fotoUrl ? <img src={contacto.fotoUrl} alt="" className="size-7 rounded-full object-cover" /> : <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{contacto.nombre.slice(0, 2).toUpperCase()}</span>}
                              <span className="min-w-0"><span className="block truncate text-xs font-semibold text-foreground">{contacto.nombre}</span><span className="block text-[10px] text-muted-foreground">{locale === 'es' ? 'Iniciar chat' : 'Start chat'}</span></span>
                            </button>
                          ))}
                    </div>
                  )}
                </div>
              )}
              {directContact && esEstudiante && (
                <button type="button" onClick={() => abrirChatDirecto(directContact)} className="mb-1 flex w-full items-center gap-2.5 rounded-xl border border-primary/20 bg-background px-3 py-3 text-left shadow-sm dark:bg-[#13221d]">
                  {directContact.fotoUrl ? <img src={directContact.fotoUrl} alt="" className="size-8 rounded-full object-cover" /> : <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{directContact.nombre.slice(0, 2).toUpperCase()}</span>}
                  <span className="min-w-0"><span className="block truncate text-xs font-semibold text-foreground">{directContact.nombre}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{directMessages[directMessages.length - 1]?.contenido || (locale === 'es' ? 'Conversación nueva' : 'New conversation')}</span></span>
                </button>
              )}
              {adminTarget && !esEstudiante && (
                <button type="button" onClick={() => abrirChatConEstudiante(adminTarget)} className="mb-1 flex w-full items-center gap-2 rounded-xl border border-primary/20 bg-background px-2.5 py-2.5 text-left shadow-sm dark:bg-[#13221d]">
                  {adminTarget.fotoUrl ? <img src={adminTarget.fotoUrl} alt="" className="size-7 rounded-full object-cover" /> : <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{`${adminTarget.nombre[0] ?? ''}${adminTarget.apellido[0] ?? ''}`.toUpperCase()}</span>}
                  <span className="min-w-0"><span className="block truncate text-xs font-semibold text-foreground">{adminTarget.nombre} {adminTarget.apellido}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{locale === 'es' ? 'Conversación nueva' : 'New conversation'}</span></span>
                </button>
              )}
              {/* Un hilo por asunto. Antes la lista fundia todos los mensajes de un
                  mismo estudiante en una sola entrada, asi que abrirla solo
                  ensenaba el ultimo asunto y los anteriores quedaban fuera de
                  alcance. Ahora cada asunto es su propia conversacion, que es
                  lo que el modelo de turnos guarda de verdad. */}
              {hilos.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{messageCopy.empty}</p> : hilos.map((hilo) => (
                <button key={hilo.id} type="button" onClick={() => abrirMensaje(hilo)} className={cn('mb-0.5 w-full rounded-xl border border-transparent px-2.5 py-2 text-left transition-all hover:border-primary/15 hover:bg-background dark:hover:bg-[#13221d]', selectedMessage?.id === hilo.id && 'border-primary/20 bg-background shadow-sm dark:bg-[#13221d]')}>
                  <div className="flex items-start gap-2">
                    <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', hilo.estado === 'ABIERTO' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
                      {(esEstudiante ? 'AC' : hilo.estudianteNombre || 'E').slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-foreground">{esEstudiante ? asuntoConversacion(hilo.asunto, avisos.consultaAlEquipo) : hilo.estudianteNombre}</span>
                        {hilo.estado === 'ABIERTO' && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                      </span>
                      {/* Para el equipo el asunto es la segunda linea: primero de
                          quien es, luego sobre que. */}
                      {!esEstudiante && <span className="mt-0.5 block truncate text-[11px] font-medium text-foreground/80">{asuntoConversacion(hilo.asunto, avisos.consultaAlEquipo)}</span>}
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{hilo.respuesta || hilo.contenido || ((hilo.adjuntos?.length ?? 0) > 0 ? '📎' : '')}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">{formatMessageTime(new Date(ultimaActividad(hilo)).toISOString(), locale)}</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex min-h-0 min-w-0 flex-col bg-muted/[0.12] dark:bg-[#0d1815]">
              <div className="min-h-0 flex-1 overflow-y-auto p-3.5 sm:p-4">
                {directContact ? (
                  <div className="mx-auto flex h-full max-w-xl flex-col">
                    <div className="mb-5 shrink-0 border-b border-border/60 pb-4">
                      <h2 className="text-base font-semibold text-foreground">{directContact.nombre}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{locale === 'es' ? 'Chat privado entre compañeros del mismo proyecto.' : 'Private chat between classmates in the same project.'}</p>
                    </div>
                    <div className="min-h-0 flex-1 space-y-3">
                      {directLoading ? <p className="py-10 text-center text-sm text-muted-foreground">{locale === 'es' ? 'Cargando conversación…' : 'Loading conversation…'}</p>
                        : directMessages.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{locale === 'es' ? ('Aún no hay mensajes con ' + directContact.nombre + '.') : ('There are no messages with ' + directContact.nombre + ' yet.')}</p>
                          : directMessages.map((mensaje) => (
                            <div key={mensaje.id} className={cn('flex', mensaje.enviadoPorMi ? 'justify-end' : 'justify-start')}>
                              <div className={cn('w-fit max-w-[68%] break-words rounded-2xl px-3 py-2 text-[13px] leading-5 shadow-sm whitespace-pre-wrap sm:max-w-[64%]', mensaje.enviadoPorMi ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-tl-md border border-border/70 bg-background text-foreground dark:bg-[#13221d]')}>
                                {!mensaje.enviadoPorMi && <p className="mb-1 text-[10px] font-semibold text-muted-foreground">{mensaje.remitenteNombre}</p>}
                                <p>{mensaje.contenido}</p>
                                <p className={cn('mt-1 flex items-center gap-1 text-[10px]', mensaje.enviadoPorMi ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                                  {formatMessageTime(mensaje.createdAt, locale)}
                                  {/* Sólo en los propios: si el otro leyó lo que le
                                      escribí es información mía. Al revés no aporta
                                      nada, porque quien lo lee ya sabe que lo leyó. */}
                                  {mensaje.enviadoPorMi && (
                                    <span title={mensaje.leidoAt ? avisos.visto : avisos.enviado}>
                                      {mensaje.leidoAt ? '✓✓' : '✓'}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                    </div>
                  </div>
                ) : !selectedMessage && !adminTarget ? <p className="py-12 text-center text-sm text-muted-foreground">{messageCopy.select}</p> : (
                  <div className="mx-auto max-w-xl space-y-4">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold text-foreground">{nombreChatActivo}</h2>{selectedMessage && <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', selectedMessage.estado === 'ABIERTO' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{selectedMessage.estado === 'ABIERTO' ? messageCopy.open : messageCopy.answered}</span>}</div>
                    {selectedMessage && <p className="text-sm font-medium text-foreground">{asuntoConversacion(selectedMessage.asunto, avisos.consultaAlEquipo)}</p>}
                    {!esEstudiante && <p className="text-xs text-muted-foreground">{correoChatActivo}</p>}
                    {selectedMessage && <p className="mt-1 text-xs text-muted-foreground">{formatMessageTime(selectedMessage.createdAt, locale)}</p>}
                  </div>
                  <div className="space-y-3">
                    {selectedMessage ? (
                      /* El hilo completo: turnos, citas, adjuntos y reacciones.
                         Sustituye al par pregunta/respuesta, que solo sabia
                         pintar un intercambio por mensaje. */
                      <div className="h-[30rem] overflow-hidden rounded-2xl border border-border/70 bg-background dark:bg-[#13221d]">
                        <HiloConversacion
                          mensajeId={selectedMessage.id}
                          soyEstudiante={esEstudiante}
                          locale={locale}
                          textos={textosConversacion}
                          onTurnoNuevo={() => { void cargarMensajes() }}
                        />
                      </div>
                    ) : <div className="rounded-2xl border border-dashed border-border/80 bg-background/70 px-4 py-8 text-center text-sm text-muted-foreground">{locale === 'es' ? 'Escribe el primer mensaje para iniciar la conversación.' : 'Write the first message to start the conversation.'}</div>}
                  </div>
                  {!esEstudiante && !selectedMessage && (
                    <div className="space-y-2 rounded-2xl border border-border/70 bg-background p-3 dark:bg-[#13221d]">
                      <label htmlFor="respuesta-mensaje" className="text-sm font-medium text-foreground">{messageCopy.reply}</label>
                      {replyAttachments.length > 0 && <div className="flex flex-wrap gap-2">{replyAttachments.map((archivo, indice) => (
                        <span key={`${archivo.name}-${archivo.lastModified}-${indice}`} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-1.5 text-xs text-foreground"><Paperclip className="size-3.5 shrink-0 text-primary" /><span className="max-w-40 truncate font-medium">{archivo.name}</span><span className="text-muted-foreground">{formatFileSize(archivo.size)}</span><button type="button" onClick={() => quitarAdjuntoRespuesta(indice)} aria-label={`${locale === 'es' ? 'Quitar' : 'Remove'} ${archivo.name}`} className="rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button></span>
                      ))}</div>}
                      <input ref={replyFileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx" className="sr-only" onChange={(event) => { agregarAdjuntosRespuesta(Array.from(event.target.files ?? [])); event.target.value = '' }} />
                      <div className="flex items-end gap-2">
                        <button type="button" onClick={() => replyFileInputRef.current?.click()} disabled={sendingReply} aria-label={locale === 'es' ? 'Adjuntar archivo' : 'Attach file'} title={locale === 'es' ? 'Adjuntar archivo o imagen' : 'Attach a file or image'} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-input bg-background text-muted-foreground transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"><Paperclip className="size-5" /></button>
                        <Textarea id="respuesta-mensaje" value={reply} onChange={(event) => setReply(event.target.value)} onPaste={(event) => { const imagenes = Array.from(event.clipboardData.files).filter((archivo) => archivo.type.startsWith('image/')); if (imagenes.length > 0) { event.preventDefault(); agregarAdjuntosRespuesta(imagenes) } }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void responderMensaje() } }} minRows={1} maxRows={4} maxLength={5000} className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm leading-5 outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15" placeholder={messageCopy.replyPlaceholder} />
                        <Button type="button" className="h-11 shrink-0 rounded-xl" onClick={() => void responderMensaje()} disabled={sendingReply || (!reply.trim() && replyAttachments.length === 0)}>{sendingReply ? <ArrowsClockwise className="size-4 animate-spin" /> : <PaperPlaneTilt className="size-4" weight="fill" />}<span className="hidden sm:inline">{sendingReply ? messageCopy.sending : messageCopy.send}</span></Button>
                      </div>
                      {messageError && <p className="text-xs text-destructive">{messageError}</p>}
                    </div>
                  )}
                  </div>
                )}
              </div>
              {esEstudiante && !selectedMessage && (
                <div className="shrink-0 border-t border-border/60 bg-card px-4 py-3 dark:bg-[#13221d] sm:px-5">
                  <div className="mx-auto max-w-xl">
                    {!directContact && studentAttachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {studentAttachments.map((archivo, indice) => (
                          <span key={`${archivo.name}-${archivo.lastModified}-${indice}`} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/70 bg-background px-2.5 py-1.5 text-xs text-foreground shadow-sm">
                            <Paperclip className="size-3.5 shrink-0 text-primary" />
                            <span className="max-w-40 truncate font-medium">{archivo.name}</span>
                            <span className="text-muted-foreground">{formatFileSize(archivo.size)}</span>
                            <button type="button" onClick={() => quitarAdjuntoEstudiante(indice)} aria-label={`${locale === 'es' ? 'Quitar' : 'Remove'} ${archivo.name}`} className="rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                    {messageError && <p className="mb-2 text-xs text-destructive">{messageError}</p>}
                    <div className="flex items-end gap-2">
                      {!directContact && <><input
                        ref={studentFileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
                        className="sr-only"
                        onChange={(event) => {
                          agregarAdjuntosEstudiante(Array.from(event.target.files ?? []))
                          event.target.value = ''
                        }}
                      />
                      <button type="button" onClick={() => studentFileInputRef.current?.click()} disabled={sendingStudentMessage} aria-label={locale === 'es' ? 'Adjuntar archivo' : 'Attach file'} title={locale === 'es' ? 'Adjuntar archivo o imagen' : 'Attach a file or image'} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-input bg-background text-muted-foreground transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"><Paperclip className="size-5" /></button></>}
                      <Textarea
                        value={studentBody}
                        onChange={(event) => setStudentBody(event.target.value)}
                        onPaste={(event) => {
                          if (directContact) return
                          const imagenes = Array.from(event.clipboardData.files).filter((archivo) => archivo.type.startsWith('image/'))
                          if (imagenes.length > 0) {
                            event.preventDefault()
                            agregarAdjuntosEstudiante(imagenes)
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            void enviarMensajeEstudiante()
                          }
                        }}
                        minRows={1}
                        maxRows={4}
                        maxLength={5000}
                        placeholder={directContact ? (locale === 'es' ? ('Escribe a ' + directContact.nombre + '…') : ('Write to ' + directContact.nombre + '…')) : (locale === 'es' ? 'Escribe un mensaje o pega una imagen…' : 'Write a message or paste an image…')}
                        className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm leading-5 outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
                      />
                      <Button className="h-11 shrink-0 rounded-xl" onClick={() => void enviarMensajeEstudiante()} disabled={sendingStudentMessage || (directContact ? !studentBody.trim() : (!studentBody.trim() && studentAttachments.length === 0))}>
                        {sendingStudentMessage ? <ArrowsClockwise className="size-4 animate-spin" /> : <PaperPlaneTilt className="size-4" weight="fill" />}
                        <span className="hidden sm:inline">{locale === 'es' ? 'Enviar' : 'Send'}</span>
                      </Button>
                    </div>
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
