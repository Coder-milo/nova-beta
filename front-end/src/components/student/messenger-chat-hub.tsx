'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, CheckCheck as Checks, ChevronLeft as CaretLeft, CornerUpLeft as ArrowBendUpLeft, Download as DownloadSimple, FileText, Heart, Image, Info, LoaderCircle as CircleNotch, LogOut as SignOut, MessageCircleMore as ChatCircleDots, Mic as Microphone, Pencil as PencilSimple, Search as MagnifyingGlass, Send as PaperPlaneTilt, Share2 as ShareFat, Smile as Smiley, Trash2 as Trash, UserPlus, Users as UsersThree, X } from 'lucide-react'
import { chatsApi, gruposApi, mensajesApi, mensajeDeError } from '@/lib/api'
import type {
  ChatContactoResponse,
  ChatConversacionResponse,
  ChatDirectoMensajeResponse,
  ChatGrupoResponse,
  ChatGrupoMensajeResponse,
  ChatGrupoMiembroResponse,
  MensajeResponse,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { Conversacion } from '@/components/ui/conversacion'
import { EmojiPickerPopover } from '@/components/ui/emoji-picker-popover'
import { VoiceNoteRecorder } from '@/components/ui/voice-note-recorder'
import { useConfirmar } from '@/components/ui/confirmar'

type TabType = 'todos' | 'no_leidos' | 'grupos' | 'soporte'

/**
 * Los textos de la bandeja, en los dos idiomas.
 *
 * Media pantalla estaba en español fijo —pestañas, buscador, modales, panel de
 * la derecha—, así que poner la aplicación en inglés dejaba el chat a medias.
 */
function textosChat(english: boolean) {
  return english
    ? {
        chats: 'Chats', todos: 'All', noLeidos: 'Unread', grupos: 'Groups', soporte: 'Support',
        buscar: 'Search chats', nuevoGrupo: 'New group',
        sinConversaciones: 'You have no conversations yet. Search for a classmate to start one.',
        sinNoLeidos: 'Nothing unread.',
        sinGrupos: 'You do not belong to any group yet.',
        sinSoporte: 'You have not written to the support team yet.',
        eligeChat: 'Pick a conversation', eligeChatPie: 'Choose someone on the left, or search for a classmate.',
        miembros: 'members', grupoDeEstudio: 'Study group', companero: 'Classmate on your programme',
        soporteCac: 'CAC Academic', detalles: 'Chat details', volverALista: 'Back to chats',
        cargandoMensajes: 'Loading messages…', sinMensajes: 'No messages yet. Say hello.',
        escribe: 'Write a message', bloqueado: 'You blocked this person.',
        notaDeVoz: 'Voice note', adjuntar: 'Attach a file', emojis: 'Emoji search',
        enviarEmoji: 'Click to send, right-click to change the quick emoji',
        reenviado: 'Forwarded', editar: 'Edit', borrar: 'Delete', responder: 'Reply', reenviar: 'Forward',
        personalizar: 'Chat background', privacidad: 'Privacy and help',
        bloquear: 'Block this person', desbloquear: 'Unblock this person',
        reportar: 'Report conversation',
        privada: 'Private conversation. Reports reach the team.',
        miembrosDelGrupo: 'Group members', agregarMiembros: 'Add members', salirDelGrupo: 'Leave group',
        salirTitulo: 'Leave this group?', salirTexto: 'You will stop receiving its messages. Someone can add you back later.',
        salir: 'Leave', admin: 'Admin', agregar: 'Add', cerrar: 'Close', cancelar: 'Cancel',
        crearGrupo: 'Create group', nombreGrupo: 'Group name', descripcionGrupo: 'Description (optional)',
        reenviarA: 'Forward to…', reportarTitulo: 'Report this conversation',
        reportarPie: 'Tell us what happened. The team receives a copy of the latest messages so that deleting them does not erase the evidence.',
        motivo: 'What happened?', enviarReporte: 'Send report',
        reporteEnviado: 'Report sent. The team will review it.',
        reporteVacio: 'Explain briefly what happened.',
        grupoSinArchivos: 'Groups do not support attachments yet.',
        grupoSinAudio: 'Voice notes are only available in direct chats for now.',
        errorEnviar: 'The message could not be sent.',
        errorAudio: 'The voice note could not be sent.',
        errorBorrar: 'The message could not be deleted.',
        errorReenviar: 'The message could not be forwarded.',
        errorBloqueo: 'The block could not be changed.',
        errorGrupo: 'The group could not be created.',
        errorMiembros: 'Members could not be loaded.',
        errorReportar: 'The report could not be sent.',
        bloqueadoOk: 'Person blocked.', desbloqueadoOk: 'Person unblocked.',
        reenviadoOk: 'Message forwarded.', miembrosOk: 'Members added.',
        salidoOk: 'You left the group.', tu: 'You: ',
        conversacion: {
          escribir: 'Write your question…', enviar: 'Send', adjuntar: 'Attach a file',
          responder: 'Reply to this message', reaccionar: 'React', cancelar: 'Remove',
          vacio: 'No messages in this conversation yet.', cargando: 'Loading conversation…',
          respondiendoA: 'Replying to', maxArchivos: 'Up to 5 files',
          errorCargar: 'The conversation could not be loaded.',
          errorEnviar: 'The message could not be sent.',
          errorReaccionar: 'The reaction could not be saved.',
        },
      }
    : {
        chats: 'Chats', todos: 'Todos', noLeidos: 'No leídos', grupos: 'Grupos', soporte: 'Soporte',
        buscar: 'Buscar conversaciones', nuevoGrupo: 'Nuevo grupo',
        sinConversaciones: 'Todavía no tienes conversaciones. Busca a un compañero para empezar una.',
        sinNoLeidos: 'No tienes mensajes sin leer.',
        sinGrupos: 'Todavía no perteneces a ningún grupo.',
        sinSoporte: 'Aún no has escrito al equipo de acompañamiento.',
        eligeChat: 'Elige una conversación', eligeChatPie: 'Selecciona a alguien de la izquierda, o busca a un compañero.',
        miembros: 'miembros', grupoDeEstudio: 'Grupo de estudio', companero: 'Compañero de tu programa',
        soporteCac: 'CAC Academic', detalles: 'Detalles del chat', volverALista: 'Volver a los chats',
        cargandoMensajes: 'Cargando mensajes…', sinMensajes: 'Todavía no hay mensajes. Saluda tú.',
        escribe: 'Escribe un mensaje', bloqueado: 'Bloqueaste a esta persona.',
        notaDeVoz: 'Nota de voz', adjuntar: 'Adjuntar un archivo', emojis: 'Buscador de emojis',
        enviarEmoji: 'Clic para enviar, clic derecho para cambiar el icono',
        reenviado: 'Reenviado', editar: 'Editar', borrar: 'Eliminar', responder: 'Responder', reenviar: 'Reenviar',
        personalizar: 'Fondo del chat', privacidad: 'Privacidad y ayuda',
        bloquear: 'Bloquear a esta persona', desbloquear: 'Desbloquear a esta persona',
        reportar: 'Reportar conversación',
        privada: 'Conversación privada. Lo que reportes llega al equipo.',
        miembrosDelGrupo: 'Miembros del grupo', agregarMiembros: 'Agregar miembros', salirDelGrupo: 'Salir del grupo',
        salirTitulo: '¿Salir de este grupo?', salirTexto: 'Dejarás de recibir sus mensajes. Alguien puede volver a añadirte más adelante.',
        salir: 'Salir', admin: 'Admin', agregar: 'Agregar', cerrar: 'Cerrar', cancelar: 'Cancelar',
        crearGrupo: 'Crear grupo', nombreGrupo: 'Nombre del grupo', descripcionGrupo: 'Descripción (opcional)',
        reenviarA: 'Reenviar a…', reportarTitulo: 'Reportar esta conversación',
        reportarPie: 'Cuéntanos qué pasó. El equipo recibe una copia de los últimos mensajes para que borrarlos no borre la prueba.',
        motivo: '¿Qué ocurrió?', enviarReporte: 'Enviar reporte',
        reporteEnviado: 'Reporte enviado. El equipo lo va a revisar.',
        reporteVacio: 'Explica brevemente qué ocurrió.',
        grupoSinArchivos: 'Los grupos todavía no admiten archivos.',
        grupoSinAudio: 'Las notas de voz solo están disponibles en los chats directos por ahora.',
        errorEnviar: 'No se pudo enviar el mensaje.',
        errorAudio: 'No se pudo enviar la nota de voz.',
        errorBorrar: 'No se pudo eliminar el mensaje.',
        errorReenviar: 'No se pudo reenviar el mensaje.',
        errorBloqueo: 'No se pudo cambiar el bloqueo.',
        errorGrupo: 'No se pudo crear el grupo.',
        errorMiembros: 'No se pudieron cargar los miembros.',
        errorReportar: 'No se pudo enviar el reporte.',
        bloqueadoOk: 'Persona bloqueada.', desbloqueadoOk: 'Persona desbloqueada.',
        reenviadoOk: 'Mensaje reenviado.', miembrosOk: 'Miembros agregados.',
        salidoOk: 'Saliste del grupo.', tu: 'Tú: ',
        conversacion: {
          escribir: 'Escribe tu consulta…', enviar: 'Enviar', adjuntar: 'Adjuntar un archivo',
          responder: 'Responder a este mensaje', reaccionar: 'Reaccionar', cancelar: 'Quitar',
          vacio: 'Todavía no hay mensajes en esta conversación.', cargando: 'Cargando conversación…',
          respondiendoA: 'Respondiendo a', maxArchivos: 'Hasta 5 archivos',
          errorCargar: 'No se pudo cargar la conversación.',
          errorEnviar: 'No se pudo enviar el mensaje.',
          errorReaccionar: 'No se pudo reaccionar.',
        },
      }
}

interface Props {
  locale?: 'es' | 'en'
}

export function MessengerChatHub({ locale = 'es' }: Props) {
  const english = locale === 'en'
  const T = textosChat(english)
  const { confirmar, dialogo } = useConfirmar()

  const [activeTab, setActiveTab] = useState<TabType>('todos')
  const [conversaciones, setConversaciones] = useState<ChatConversacionResponse[]>([])
  const [grupos, setGrupos] = useState<ChatGrupoResponse[]>([])
  const [soporteHilos, setSoporteHilos] = useState<MensajeResponse[]>([])

  const [selectedContactoId, setSelectedContactoId] = useState<string | null>(null)
  const [selectedContactoNombre, setSelectedContactoNombre] = useState<string>('')
  const [selectedContactoFoto, setSelectedContactoFoto] = useState<string | null>(null)

  const [selectedGrupoId, setSelectedGrupoId] = useState<string | null>(null)
  const [selectedGrupoNombre, setSelectedGrupoNombre] = useState<string>('')
  const [selectedGrupoFoto, setSelectedGrupoFoto] = useState<string | null>(null)

  const [selectedSoporteId, setSelectedSoporteId] = useState<string | null>(null)

  const [mensajesDirectos, setMensajesDirectos] = useState<ChatDirectoMensajeResponse[]>([])
  const [mensajesGrupo, setMensajesGrupo] = useState<ChatGrupoMensajeResponse[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [busquedaResultados, setBusquedaResultados] = useState<ChatContactoResponse[]>([])
  const [cargando, setCargando] = useState(false)
  const [cargandoMensajes, setCargandoMensajes] = useState(false)

  // Input & Rich Tools
  const [borrador, setBorrador] = useState('')
  const [archivosAdjuntos, setArchivosAdjuntos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)

  // Popovers & Grabador
  const [mostrarEmojiPicker, setMostrarEmojiPicker] = useState(false)
  const [grabandoAudio, setGrabandoAudio] = useState(false)
  const [mostrarSidebarInfo, setMostrarSidebarInfo] = useState(true)
  const [temaChatFondo, setTemaChatFondo] = useState<'predeterminado' | 'patron_rojo' | 'mar' | 'esmeralda'>('predeterminado')

  // Acciones en mensaje
  const [editandoMensajeId, setEditandoMensajeId] = useState<string | null>(null)
  const [citandoMensaje, setCitandoMensaje] = useState<{ id: string; texto: string; autor: string } | null>(null)
  const [bloqueados, setBloqueados] = useState<string[]>([])

  // Modales
  const [modalCrearGrupo, setModalCrearGrupo] = useState(false)
  const [nombreNuevoGrupo, setNombreNuevoGrupo] = useState('')
  const [descNuevoGrupo, setDescNuevoGrupo] = useState('')
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState<string[]>([])
  const [contactosParaGrupo, setContactosParaGrupo] = useState<ChatContactoResponse[]>([])

  const [modalMiembros, setModalMiembros] = useState(false)
  const [miembrosGrupo, setMiembrosGrupo] = useState<ChatGrupoMiembroResponse[]>([])
  const [cargandoMiembros, setCargandoMiembros] = useState(false)
  const [mostrarAgregarMiembros, setMostrarAgregarMiembros] = useState(false)
  const [nuevosMiembrosSeleccionados, setNuevosMiembrosSeleccionados] = useState<string[]>([])

  const [modalReenviar, setModalReenviar] = useState(false)
  const [mensajeAReenviarId, setMensajeAReenviarId] = useState<string | null>(null)

  const [modalReportar, setModalReportar] = useState(false)
  const [motivoReporte, setMotivoReporte] = useState('')
  const [reportando, setReportando] = useState(false)

  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fotoDe = (contactoId?: string | null, clave?: string | null) => {
    if (!clave || !contactoId) return undefined
    if (clave.startsWith('http') || clave.includes('/api/')) return clave
    return `/api/v1/chats/directos/${contactoId}/foto`
  }

  const fotoDeGrupo = (grupoId?: string | null, clave?: string | null) => {
    if (!clave || !grupoId) return undefined
    if (clave.startsWith('http') || clave.includes('/api/')) return clave
    return `/api/v1/chats/grupos/${grupoId}/foto`
  }

  /**
   * Trae las cuatro bandejas.
   *
   * Sin dependencias a propósito. Antes llevaba `activeTab` y
   * `selectedContactoId`, así que abrir un chat o cambiar de pestaña rehacía la
   * función, el efecto de abajo volvía a dispararse y se pedían otra vez las
   * cuatro listas enteras —conversaciones, grupos, soporte y bloqueados— solo
   * por haber pulsado en un nombre. La preselección usa la forma funcional del
   * estado, que es lo único que necesitaba de esas dependencias.
   */
  const cargarBandejas = useCallback(async () => {
    setCargando(true)
    try {
      const [convs, grps, sop, blqs] = await Promise.all([
        chatsApi.conversaciones().catch(() => []),
        gruposApi.misGrupos().catch(() => []),
        mensajesApi.mios().catch(() => []),
        chatsApi.bloqueados().catch(() => []),
      ])
      setConversaciones(convs)
      setGrupos(grps)
      setSoporteHilos(sop)
      setBloqueados(blqs)
      if (convs.length > 0) {
        setSelectedContactoId((actual) => {
          if (actual) return actual
          setSelectedContactoNombre(convs[0].nombre)
          setSelectedContactoFoto(convs[0].fotoUrl)
          return convs[0].contactoId
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargarBandejas()
  }, [cargarBandejas])

  // Cargar directo
  useEffect(() => {
    if (!selectedContactoId || (activeTab !== 'todos' && activeTab !== 'no_leidos')) return
    let active = true
    setCargandoMensajes(true)
    chatsApi.conversacion(selectedContactoId)
      .then((msgs) => {
        if (!active) return
        setMensajesDirectos(msgs)
        // Abrir la conversación la marca como leída en el servidor. Sin releer
        // la bandeja, el globo de «sin leer» seguía ahí y la pestaña «No
        // leídos» seguía listando un chat que acabas de leer.
        void cargarBandejas()
      })
      .catch(() => undefined)
      .finally(() => { if (active) setCargandoMensajes(false) })
    return () => { active = false }
  }, [selectedContactoId, activeTab, cargarBandejas])

  // Cargar grupo
  useEffect(() => {
    if (!selectedGrupoId || activeTab !== 'grupos') return
    let active = true
    setCargandoMensajes(true)
    gruposApi.mensajes(selectedGrupoId)
      .then((msgs) => { if (active) setMensajesGrupo(msgs) })
      .catch(() => undefined)
      .finally(() => { if (active) setCargandoMensajes(false) })
    return () => { active = false }
  }, [selectedGrupoId, activeTab])

  // Buscador de contactos
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setBusquedaResultados([])
      return
    }
    let active = true
    chatsApi.contactos(searchQuery.trim())
      .then((res) => { if (active) setBusquedaResultados(res) })
      .catch(() => undefined)
    return () => { active = false }
  }, [searchQuery])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajesDirectos.length, mensajesGrupo.length])

  // Enviar mensaje
  const handleEnviar = async (textoOverride?: string) => {
    const texto = (textoOverride ?? borrador).trim()
    if ((!texto && archivosAdjuntos.length === 0) || enviando) return
    setEnviando(true)

    try {
      if (editandoMensajeId) {
        const actualizado = await chatsApi.editar(editandoMensajeId, texto)
        setMensajesDirectos((prev) => prev.map((m) => (m.id === editandoMensajeId ? actualizado : m)))
        setEditandoMensajeId(null)
      } else if (selectedContactoId && (activeTab === 'todos' || activeTab === 'no_leidos')) {
        // Con archivos va por la ruta multipart. Antes se mandaba solo el
        // texto y los adjuntos se limpiaban abajo, asi que la imagen que
        // alguien acababa de elegir desaparecia sin decir nada.
        const nuevo = archivosAdjuntos.length > 0
          ? await chatsApi.enviarConArchivos(selectedContactoId, texto, archivosAdjuntos)
          : await chatsApi.enviar(selectedContactoId, texto)
        setMensajesDirectos((prev) => [...prev, nuevo])
      } else if (selectedGrupoId && activeTab === 'grupos') {
        if (archivosAdjuntos.length > 0) {
          // Los grupos todavia no guardan adjuntos: la tabla cuelga del
          // mensaje directo. Se dice, en vez de tragarselos. El boton de
          // adjuntar ya no se pinta en la pestana de grupos, asi que esto solo
          // salta si quedaban archivos elegidos desde un chat directo.
          setAviso({ tipo: 'error', texto: T.grupoSinArchivos })
          setEnviando(false)
          return
        }
        const nuevo = await gruposApi.enviar(selectedGrupoId, texto, citandoMensaje?.id)
        setMensajesGrupo((prev) => [...prev, nuevo])
      }
      setBorrador('')
      setArchivosAdjuntos([])
      setCitandoMensaje(null)
      setMostrarEmojiPicker(false)
      void cargarBandejas()
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, T.errorEnviar) })
    } finally {
      setEnviando(false)
    }
  }

  // Enviar audio grabado
  /**
   * Manda la nota de voz.
   *
   * Antes dejaba el audio en el estado y llamaba a `handleEnviar` con el texto
   * «🎤 Nota de voz (12s)». Como el envio mandaba solo texto, eso era lo unico
   * que llegaba: quien la grababa creia haberla mandado y al otro lado no habia
   * ningun audio. Ahora sube el archivo y espera al envio, en vez de fiarse de
   * que el estado se haya actualizado a tiempo.
   */
  const handleSendAudioNote = async (blob: Blob, durationSec: number) => {
    setGrabandoAudio(false)
    if (!selectedContactoId || activeTab === 'grupos') {
      setAviso({ tipo: 'error', texto: T.grupoSinAudio })
      return
    }
    if (enviando) return
    setEnviando(true)
    try {
      const archivo = new File([blob], `nota-de-voz-${Date.now()}.webm`, {
        type: blob.type || 'audio/webm',
      })
      const nuevo = await chatsApi.enviarConArchivos(selectedContactoId, '', [archivo], durationSec)
      setMensajesDirectos((prev) => [...prev, nuevo])
      void cargarBandejas()
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, T.errorAudio) })
    } finally {
      setEnviando(false)
    }
  }

  const OPCIONES_QUICK_EMOJI = ['❤️', '👍', '🔥', '🎉', '👏', '⚡', '😊', '🚀', '😍', '💯'] as const
  const [quickEmoji, setQuickEmoji] = useState('❤️')
  const [mostrarSelectorQuickEmoji, setMostrarSelectorQuickEmoji] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && selectedContactoId) {
      const guardado = localStorage.getItem(`quick_emoji_${selectedContactoId}`)
      if (guardado) setQuickEmoji(guardado)
      else setQuickEmoji('❤️')
    }
  }, [selectedContactoId])

  const seleccionarQuickEmoji = (emoji: string) => {
    setQuickEmoji(emoji)
    if (typeof window !== 'undefined' && selectedContactoId) {
      localStorage.setItem(`quick_emoji_${selectedContactoId}`, emoji)
    }
    setMostrarSelectorQuickEmoji(false)
  }

  const handleSendQuickEmoji = () => {
    void handleEnviar(quickEmoji)
  }

  // Borrar mensaje
  const handleBorrar = async (id: string) => {
    try {
      await chatsApi.borrar(id)
      setMensajesDirectos((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, T.errorBorrar) })
    }
  }

  // Reenviar mensaje
  const handleReenviar = async (destinoId: string) => {
    if (!mensajeAReenviarId) return
    try {
      await chatsApi.reenviar(mensajeAReenviarId, destinoId)
      setModalReenviar(false)
      setMensajeAReenviarId(null)
      setAviso({ tipo: 'ok', texto: T.reenviadoOk })
      void cargarBandejas()
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, T.errorReenviar) })
    }
  }

  // Bloquear / Desbloquear
  const handleBloqueo = async () => {
    if (!selectedContactoId) return
    const idContacto = selectedContactoId
    const bloqueadoAhora = bloqueados.includes(idContacto)
    try {
      if (bloqueadoAhora) {
        await chatsApi.desbloquear(idContacto)
        setBloqueados((prev) => prev.filter((id) => id !== idContacto))
        setAviso({ tipo: 'ok', texto: T.desbloqueadoOk })
      } else {
        await chatsApi.bloquear(idContacto)
        setBloqueados((prev) => [...prev, idContacto])
        setAviso({ tipo: 'ok', texto: T.bloqueadoOk })
      }
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, T.errorBloqueo) })
    }
  }

  /**
   * Envía el reporte de una conversación.
   *
   * El botón «Reportar conversación» existía desde hace tiempo y solo encendía
   * un estado: no había ningún modal que lo pintara, así que pulsarlo no hacía
   * nada. Quien intentaba reportar acoso se quedaba sin manera de hacerlo y sin
   * saber por qué. El endpoint ya estaba y guarda copia de los últimos mensajes.
   */
  const handleReportar = async () => {
    if (!selectedContactoId) return
    if (!motivoReporte.trim()) {
      setAviso({ tipo: 'error', texto: T.reporteVacio })
      return
    }
    setReportando(true)
    try {
      await chatsApi.reportar(selectedContactoId, motivoReporte.trim())
      setModalReportar(false)
      setMotivoReporte('')
      setAviso({ tipo: 'ok', texto: T.reporteEnviado })
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, T.errorReportar) })
    } finally {
      setReportando(false)
    }
  }

  /** Suma gente al grupo. El endpoint existía y no había forma de llamarlo. */
  const handleAgregarMiembros = async () => {
    if (!selectedGrupoId || nuevosMiembrosSeleccionados.length === 0) return
    try {
      await gruposApi.agregarMiembros(selectedGrupoId, nuevosMiembrosSeleccionados)
      setNuevosMiembrosSeleccionados([])
      setMostrarAgregarMiembros(false)
      setMiembrosGrupo(await gruposApi.miembros(selectedGrupoId))
      setAviso({ tipo: 'ok', texto: T.miembrosOk })
      void cargarBandejas()
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, T.errorMiembros) })
    }
  }

  /** Salir del grupo. Se pregunta antes: no hay forma de volver a entrar solo. */
  const handleSalirDelGrupo = async () => {
    if (!selectedGrupoId) return
    if (!(await confirmar({
      titulo: T.salirTitulo,
      descripcion: T.salirTexto,
      textoConfirmar: T.salir,
      destructivo: true,
    }))) return
    try {
      await gruposApi.salir(selectedGrupoId)
      setModalMiembros(false)
      setSelectedGrupoId(null)
      setSelectedGrupoNombre('')
      setSelectedGrupoFoto(null)
      setMensajesGrupo([])
      setAviso({ tipo: 'ok', texto: T.salidoOk })
      void cargarBandejas()
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, T.errorMiembros) })
    }
  }

  // Crear grupo
  const handleCrearGrupo = async () => {
    if (!nombreNuevoGrupo.trim()) return
    try {
      const nuevo = await gruposApi.crear({
        nombre: nombreNuevoGrupo.trim(),
        descripcion: descNuevoGrupo.trim(),
        miembroIds: miembrosSeleccionados,
      })
      setModalCrearGrupo(false)
      setNombreNuevoGrupo('')
      setDescNuevoGrupo('')
      setMiembrosSeleccionados([])
      void cargarBandejas()
      setSelectedGrupoId(nuevo.id)
      setSelectedGrupoNombre(nuevo.nombre)
      setSelectedGrupoFoto(nuevo.fotoUrl)
      setActiveTab('grupos')
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, T.errorGrupo) })
    }
  }

  // Abrir miembros de grupo
  const abrirMiembros = async () => {
    if (!selectedGrupoId) return
    setModalMiembros(true)
    setMostrarAgregarMiembros(false)
    setNuevosMiembrosSeleccionados([])
    setCargandoMiembros(true)
    try {
      const lista = await gruposApi.miembros(selectedGrupoId)
      setMiembrosGrupo(lista)
      const contactos = await chatsApi.contactos('')
      setContactosParaGrupo(contactos)
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, T.errorMiembros) })
    } finally {
      setCargandoMiembros(false)
    }
  }

  const contactoBloqueado = selectedContactoId ? bloqueados.includes(selectedContactoId) : false
  const enGrupos = activeTab === 'grupos'
  const enDirectos = activeTab === 'todos' || activeTab === 'no_leidos'
  /** Cierra lo que esté abierto, sea del tipo que sea. Para volver a la lista. */
  const cerrarChatAbierto = () => {
    setSelectedContactoId(null)
    setSelectedGrupoId(null)
    setSelectedSoporteId(null)
    setMensajesDirectos([])
    setMensajesGrupo([])
  }
  /** Si no hay nada abierto, el lienzo no debe fingir una conversación vacía. */
  const hayChatAbierto =
    (enDirectos && Boolean(selectedContactoId)) ||
    (enGrupos && Boolean(selectedGrupoId)) ||
    (activeTab === 'soporte' && Boolean(selectedSoporteId))
  const tituloChat = enGrupos
    ? selectedGrupoNombre
    : activeTab === 'soporte'
      ? T.soporteCac
      : selectedContactoNombre
  const fotoChat = enGrupos
    ? fotoDeGrupo(selectedGrupoId, selectedGrupoFoto)
    : fotoDe(selectedContactoId, selectedContactoFoto)

  return (
    <>
    <div className="flex h-[calc(100dvh-9.5rem)] min-h-[26rem] w-full overflow-hidden rounded-2xl border border-border/70 bg-card/95 text-card-foreground shadow-xl backdrop-blur-xl transition-all sm:min-h-[32rem]">
      {/* ── COLUMNA 1: BANDEJA IZQUIERDA ──────────────────────────────────────── */}
      {/* Debajo de `md` esto es la pantalla entera y se aparta cuando hay un
          chat abierto. Las dos columnas eran fijas —288 px de bandeja más el
          lienzo—, así que en un teléfono de 375 px la conversación quedaba
          reducida a una tira lateral con los globos partidos en vertical. */}
      <aside className={cn(
        'w-full shrink-0 flex-col border-r border-border/60 bg-muted/30 md:flex md:w-72',
        hayChatAbierto ? 'hidden md:flex' : 'flex',
      )}>
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-xl font-extrabold text-foreground">{T.chats}</h2>
          <button
            type="button"
            onClick={() => {
              setModalCrearGrupo(true)
              void chatsApi.contactos('').then(setContactosParaGrupo).catch(() => undefined)
            }}
            className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-muted/80"
            title={T.nuevoGrupo}
          >
            <PencilSimple className="size-5" />
          </button>
        </div>

        {/* Buscador de compañeros */}
        <div className="px-3 py-2">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={T.buscar}
              className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Pestañas de filtro */}
        <div className="flex items-center gap-1 border-b border-border/40 px-3 py-1.5">
          {([
            ['todos', T.todos],
            ['no_leidos', T.noLeidos],
            ['grupos', T.grupos],
            ['soporte', T.soporte],
          ] as const).map(([clave, etiqueta]) => (
            <button
              key={clave}
              type="button"
              onClick={() => setActiveTab(clave)}
              aria-pressed={activeTab === clave}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-bold transition',
                activeTab === clave
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted/80',
              )}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        {/* Resultados de búsqueda */}
        {searchQuery.trim().length >= 2 && (
          <div className="space-y-1 border-b border-border/40 bg-card p-2">
            {busquedaResultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedContactoId(c.id)
                  setSelectedContactoNombre(c.nombre)
                  setSelectedContactoFoto(c.fotoUrl)
                  setSearchQuery('')
                  setActiveTab('todos')
                }}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted"
              >
                {c.fotoUrl ? (
                  <img src={fotoDe(c.id, c.fotoUrl)} alt="" className="size-10 rounded-full object-cover" />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                    {c.nombre[0]}
                  </div>
                )}
                <span className="truncate text-xs font-bold text-foreground">{c.nombre}</span>
              </button>
            ))}
          </div>
        )}

        {/* Lista de conversaciones */}
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {cargando && (
            <p className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <CircleNotch className="size-4 animate-spin text-primary" />
            </p>
          )}

          {!cargando && enDirectos && (() => {
            const lista = conversaciones.filter((c) => (activeTab === 'no_leidos' ? c.sinLeer > 0 : true))
            if (lista.length === 0) {
              return (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                  {activeTab === 'no_leidos' ? T.sinNoLeidos : T.sinConversaciones}
                </p>
              )
            }
            return lista.map((conv) => (
              <button
                key={conv.contactoId}
                type="button"
                onClick={() => {
                  setSelectedContactoId(conv.contactoId)
                  setSelectedContactoNombre(conv.nombre)
                  setSelectedContactoFoto(conv.fotoUrl)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition',
                  selectedContactoId === conv.contactoId
                    ? 'border-l-4 border-primary bg-muted/80 font-bold'
                    : 'hover:bg-muted/50',
                )}
              >
                {conv.fotoUrl ? (
                  <img src={fotoDe(conv.contactoId, conv.fotoUrl)} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                    {conv.nombre[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-foreground">{conv.nombre}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {conv.mioElUltimo ? T.tu : ''}{conv.ultimoMensaje}
                  </p>
                </div>
                {/* El contador de no leídos. Existía en la respuesta y no se
                    pintaba en ningún sitio, así que la pestaña «No leídos»
                    filtraba por un número que nadie veía. */}
                {conv.sinLeer > 0 && (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {conv.sinLeer > 9 ? '9+' : conv.sinLeer}
                  </span>
                )}
              </button>
            ))
          })()}

          {!cargando && enGrupos && (grupos.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">{T.sinGrupos}</p>
          ) : grupos.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setSelectedGrupoId(g.id)
                setSelectedGrupoNombre(g.nombre)
                setSelectedGrupoFoto(g.fotoUrl)
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition',
                selectedGrupoId === g.id ? 'bg-muted' : 'hover:bg-muted/60',
              )}
            >
              {g.fotoUrl ? (
                <img src={fotoDeGrupo(g.id, g.fotoUrl)} alt="" className="size-12 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <UsersThree className="size-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground">{g.nombre}</p>
                <p className="text-[11px] text-muted-foreground">{g.totalMiembros} {T.miembros}</p>
              </div>
            </button>
          )))}

          {!cargando && activeTab === 'soporte' && (soporteHilos.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">{T.sinSoporte}</p>
          ) : soporteHilos.map((hilo) => (
            <button
              key={hilo.id}
              type="button"
              onClick={() => setSelectedSoporteId(hilo.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition',
                selectedSoporteId === hilo.id ? 'bg-muted' : 'hover:bg-muted/60',
              )}
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-lg">
                🎧
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground">{T.soporteCac}</p>
                <p className="truncate text-[11px] text-muted-foreground">{hilo.asunto}</p>
              </div>
            </button>
          )))}
        </div>
      </aside>

      {/* ── COLUMNA 2: LIENZO CENTRAL ─────────────────────────────────────────── */}
      {/* `relative`: el buscador de emojis se coloca contra este contenedor. Sin
          esto se anclaba al primer antepasado posicionado, que estaba fuera de
          la tarjeta, y el panel salía en mitad de la pantalla. */}
      <main className={cn(
        'relative min-w-0 flex-1 flex-col overflow-hidden bg-background',
        hayChatAbierto ? 'flex' : 'hidden md:flex',
      )}>
        {hayChatAbierto && (
          <header className="flex items-center justify-between border-b border-border/60 bg-card px-3 py-2.5 shadow-xs sm:px-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {/* La única salida en un teléfono: con la bandeja apartada, sin
                  esto no había forma de volver a la lista de chats. */}
              <button
                type="button"
                onClick={cerrarChatAbierto}
                aria-label={T.volverALista}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted md:hidden"
              >
                <CaretLeft className="size-4" />
              </button>
              {fotoChat ? (
                <img src={fotoChat} alt="" className="size-10 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                  {enGrupos ? <UsersThree className="size-5" /> : (tituloChat[0] ?? '?')}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-foreground">{tituloChat}</h3>
                {/* Sin «Activo(a) ahora» ni punto verde: no hay presencia en el
                    sistema, y decirle a alguien que su compañero está conectado
                    cuando no se sabe es hacerle esperar una respuesta que quizá
                    no llegue hoy. */}
                <p className="text-[10px] font-semibold text-muted-foreground">
                  {enGrupos ? T.grupoDeEstudio : activeTab === 'soporte' ? T.soporteCac : T.companero}
                </p>
              </div>
            </div>

            {/* Sin llamada ni videollamada: no hay nada detrás de esos botones,
                y un botón que no hace nada gasta la confianza de quien lo pulsa. */}
            <button
              type="button"
              onClick={() => setMostrarSidebarInfo((prev) => !prev)}
              aria-pressed={mostrarSidebarInfo}
              className={cn(
                'hidden size-8 shrink-0 items-center justify-center rounded-full transition lg:flex',
                mostrarSidebarInfo ? 'bg-primary text-primary-foreground' : 'text-primary hover:bg-muted',
              )}
              title={T.detalles}
            >
              <Info className="size-5" />
            </button>
          </header>
        )}

        {aviso && (
          <div
            role={aviso.tipo === 'error' ? 'alert' : 'status'}
            className={cn(
              'flex items-center justify-between px-4 py-2 text-xs font-semibold',
              aviso.tipo === 'ok'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-destructive/15 text-destructive',
            )}
          >
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label={T.cerrar}>
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div
          className={cn(
            'flex-1 space-y-4 overflow-y-auto p-4 transition-all',
            // Los fondos se tiñen sobre el color de fondo del tema, no son
            // grises fijos: escritos con los valores de Messenger dejaban el
            // lienzo negro en modo claro, que es donde trabaja el equipo.
            temaChatFondo === 'predeterminado' && 'bg-background',
            temaChatFondo === 'patron_rojo'
              && 'bg-background bg-[radial-gradient(theme(colors.rose.500/35%)_1px,transparent_1px)] [background-size:16px_16px]',
            temaChatFondo === 'mar' && 'bg-gradient-to-b from-sky-500/10 to-background',
            temaChatFondo === 'esmeralda' && 'bg-gradient-to-b from-emerald-500/10 to-background',
          )}
        >
          {!hayChatAbierto && !cargando && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
                <ChatCircleDots className="size-7" />
              </span>
              <p className="text-sm font-semibold text-foreground">{T.eligeChat}</p>
              <p className="max-w-xs text-xs">{T.eligeChatPie}</p>
            </div>
          )}

          {hayChatAbierto && cargandoMensajes && (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              <CircleNotch className="mr-2 size-4 animate-spin text-primary" />
              {T.cargandoMensajes}
            </div>
          )}

          {/* Mensajes directos */}
          {hayChatAbierto && !cargandoMensajes && enDirectos && mensajesDirectos.length === 0 && (
            <p className="py-12 text-center text-xs text-muted-foreground">{T.sinMensajes}</p>
          )}

          {!cargandoMensajes && enDirectos &&
            mensajesDirectos.map((m) => (
              <div key={m.id} className={cn('group flex flex-col', m.enviadoPorMi ? 'items-end' : 'items-start')}>
                <div className="relative max-w-[70%]">
                  <div
                    className={cn(
                      'absolute -top-3 z-10 hidden items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-md group-hover:flex',
                      m.enviadoPorMi ? 'right-0' : 'left-0',
                    )}
                  >
                    {m.enviadoPorMi && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoMensajeId(m.id)
                            setBorrador(m.contenido)
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-foreground"
                          title={T.editar}
                        >
                          <PencilSimple className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleBorrar(m.id)}
                          className="rounded p-1 text-destructive hover:bg-destructive/10"
                          title={T.borrar}
                        >
                          <Trash className="size-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setCitandoMensaje({ id: m.id, texto: m.contenido, autor: m.remitenteNombre })}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                      title={T.responder}
                    >
                      <ArrowBendUpLeft className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMensajeAReenviarId(m.id)
                        setModalReenviar(true)
                      }}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                      title={T.reenviar}
                    >
                      <ShareFat className="size-3.5" />
                    </button>
                  </div>

                  <div
                    className={cn(
                      'whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-xs leading-relaxed shadow-xs',
                      m.enviadoPorMi
                        ? 'rounded-br-xs bg-primary text-primary-foreground'
                        : 'rounded-bl-xs border border-border/40 bg-muted/80 text-foreground',
                    )}
                  >
                    {m.reenviado && <p className="mb-1 text-[10px] font-bold opacity-75">↪ {T.reenviado}</p>}
                    {m.contenido && <p>{m.contenido}</p>}

                    {/* Los adjuntos. Una nota de voz se reproduce en la propia
                        burbuja: obligar a descargar un audio de ocho segundos
                        para oírlo es no haberlo mandado. */}
                    {m.adjuntos?.map((a) => {
                      const esImagen = a.contentType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(a.nombre)
                      const esAudio = a.esAudio || a.contentType?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm|aac)$/i.test(a.nombre)

                      if (esAudio) {
                        return (
                          <div key={a.id} className={cn('flex flex-col gap-1', m.contenido && 'mt-2')}>
                            <audio controls preload="metadata" src={chatsApi.urlAdjunto(a.id)} className="h-9 w-56 max-w-full" />
                            {a.duracionSegundos != null && (
                              <span className="text-[9px] opacity-75">
                                {Math.floor(a.duracionSegundos / 60)}:
                                {String(a.duracionSegundos % 60).padStart(2, '0')}
                              </span>
                            )}
                          </div>
                        )
                      }

                      if (esImagen) {
                        return (
                          <div key={a.id} className={cn('mt-2', !m.contenido && 'mt-0')}>
                            <a href={chatsApi.urlAdjunto(a.id)} target="_blank" rel="noreferrer">
                              <img
                                src={chatsApi.urlAdjunto(a.id)}
                                alt={a.nombre}
                                className="max-h-56 max-w-full rounded-xl object-cover transition-opacity hover:opacity-90"
                              />
                            </a>
                          </div>
                        )
                      }

                      return (
                        <div key={a.id} className={cn('mt-2', !m.contenido && 'mt-0')}>
                          <a
                            href={chatsApi.urlAdjunto(a.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2.5 rounded-xl border border-white/20 bg-black/10 p-2.5 text-xs transition hover:bg-black/20"
                          >
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
                              <FileText className="size-4" />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate font-semibold">{a.nombre}</span>
                              {a.tamano != null && <span className="text-[10px] opacity-75">{(a.tamano / 1024).toFixed(1)} KB</span>}
                            </div>
                            <DownloadSimple className="size-4 shrink-0 opacity-80" />
                          </a>
                        </div>
                      )
                    })}

                    <div className="mt-1 flex items-center justify-end gap-1 text-[9px] opacity-75">
                      {m.editado && <span className="mr-0.5 italic">{english ? 'edited' : 'editado'}</span>}
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {m.enviadoPorMi && (m.leidoAt ? <Checks className="size-3" /> : <Check className="size-3" />)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* Mensajes de grupo */}
          {hayChatAbierto && !cargandoMensajes && enGrupos && mensajesGrupo.length === 0 && (
            <p className="py-12 text-center text-xs text-muted-foreground">{T.sinMensajes}</p>
          )}

          {!cargandoMensajes && enGrupos &&
            mensajesGrupo.map((m) => (
              <div key={m.id} className={cn('flex flex-col', m.enviadoPorMi ? 'items-end' : 'items-start')}>
                <div className="max-w-[70%]">
                  {!m.enviadoPorMi && <p className="mb-1 text-[10px] font-bold text-primary">{m.remitenteNombre}</p>}
                  <div
                    className={cn(
                      'whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-xs leading-relaxed shadow-xs',
                      m.enviadoPorMi
                        ? 'rounded-br-xs bg-primary text-primary-foreground'
                        : 'rounded-bl-xs border border-border/40 bg-muted/80 text-foreground',
                    )}
                  >
                    <p>{m.contenido}</p>
                    {/* La hora también en los grupos: sin ella no se sabe si lo
                        que se lee es de hace un minuto o de la semana pasada. */}
                    <div className="mt-1 flex justify-end text-[9px] opacity-75">
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* Hilo de soporte */}
          {activeTab === 'soporte' && selectedSoporteId && (
            <Conversacion
              mensajeId={selectedSoporteId}
              soyEstudiante
              locale={locale}
              textos={T.conversacion}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Cita activa */}
        {citandoMensaje && (
          <div className="flex items-center justify-between border-t border-border/40 bg-muted/40 px-4 py-1.5 text-xs">
            <div className="truncate border-l-2 border-primary pl-2 text-muted-foreground">
              <span className="font-bold text-primary">{citandoMensaje.autor}: </span>
              <span>{citandoMensaje.texto}</span>
            </div>
            <button type="button" onClick={() => setCitandoMensaje(null)} aria-label={T.cancelar}>
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Buscador de emojis */}
        {mostrarEmojiPicker && (
          <div className="absolute bottom-16 right-4 z-50">
            <EmojiPickerPopover
              onSelectEmoji={(emoji) => setBorrador((prev) => prev + emoji)}
              onClose={() => setMostrarEmojiPicker(false)}
            />
          </div>
        )}

        {/* Grabador de notas de voz */}
        {grabandoAudio ? (
          <div className="border-t border-border/60 bg-muted/40 p-3">
            <VoiceNoteRecorder
              onSendAudio={(blob, sec) => void handleSendAudioNote(blob, sec)}
              onCancel={() => setGrabandoAudio(false)}
            />
          </div>
        ) : (
          // El hilo de soporte trae su propio campo de escritura dentro de
          // `Conversacion`; sin chat abierto no hay a quién escribir.
          hayChatAbierto && activeTab !== 'soporte' && (
            <footer className="border-t border-border/60 bg-card p-3">
              {archivosAdjuntos.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {archivosAdjuntos.map((archivo, indice) => (
                    <li
                      key={`${archivo.name}-${indice}`}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 py-1 pl-2.5 pr-1 text-[11px]"
                    >
                      <span className="max-w-40 truncate">{archivo.name}</span>
                      <button
                        type="button"
                        onClick={() => setArchivosAdjuntos((previos) => previos.filter((_, i) => i !== indice))}
                        className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={T.cancelar}
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleEnviar()
                }}
                className="flex items-center gap-2"
              >
                {/* Micrófono y adjuntos solo en directos: los grupos todavía no
                    guardan adjuntos, y ofrecer el botón para después decir que
                    no se puede es peor que no ofrecerlo. */}
                {enDirectos && (
                  <>
                    <button
                      type="button"
                      onClick={() => setGrabandoAudio(true)}
                      disabled={contactoBloqueado}
                      className="flex size-8 items-center justify-center rounded-full text-primary hover:bg-muted disabled:opacity-40"
                      title={T.notaDeVoz}
                    >
                      <Microphone className="size-5" />
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        setArchivosAdjuntos((prev) => [...prev, ...Array.from(e.target.files ?? [])])
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={contactoBloqueado}
                      className="flex size-8 items-center justify-center rounded-full text-primary hover:bg-muted disabled:opacity-40"
                      title={T.adjuntar}
                    >
                      <Image className="size-5" />
                    </button>
                  </>
                )}

                <div className="relative min-w-0 flex-1">
                  <input
                    type="text"
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    disabled={contactoBloqueado}
                    maxLength={5000}
                    placeholder={contactoBloqueado ? T.bloqueado : T.escribe}
                    className="w-full rounded-full border border-input bg-muted/50 py-2 pl-4 pr-10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarEmojiPicker((prev) => !prev)}
                    disabled={contactoBloqueado}
                    className="absolute right-2 top-2 flex size-6 items-center justify-center text-primary hover:scale-110 disabled:opacity-40"
                    title={T.emojis}
                  >
                    <Smiley className="size-4" />
                  </button>
                </div>

                {borrador.trim() || archivosAdjuntos.length > 0 ? (
                  <button
                    type="submit"
                    disabled={enviando || contactoBloqueado}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:brightness-110 disabled:opacity-50"
                    aria-label={T.conversacion.enviar}
                  >
                    {enviando ? <CircleNotch className="size-4 animate-spin" /> : <PaperPlaneTilt className="size-4" />}
                  </button>
                ) : (
                  <div className="relative flex shrink-0 items-center">
                    {mostrarSelectorQuickEmoji && (
                      <div className="absolute bottom-11 right-0 z-50 flex items-center gap-1 rounded-full border border-border/80 bg-card/95 p-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                        {OPCIONES_QUICK_EMOJI.map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => seleccionarQuickEmoji(e)}
                            className="flex size-7 items-center justify-center text-base transition-transform hover:scale-130 active:scale-95"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleSendQuickEmoji}
                      disabled={contactoBloqueado}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setMostrarSelectorQuickEmoji((prev) => !prev)
                      }}
                      className="flex size-9 items-center justify-center text-xl transition-transform hover:scale-125 active:scale-95 disabled:opacity-40"
                      title={T.enviarEmoji}
                    >
                      {quickEmoji === '❤️' ? (
                        <Heart className="size-6 text-rose-500" fill="currentColor" />
                      ) : (
                        <span>{quickEmoji}</span>
                      )}
                    </button>
                  </div>
                )}
              </form>
            </footer>
          )
        )}
      </main>

      {/* ── COLUMNA 3: PANEL DERECHO DE DETALLES ─────────────────────────────── */}
      {mostrarSidebarInfo && hayChatAbierto && activeTab !== 'soporte' && (
        <aside className="hidden w-72 shrink-0 flex-col space-y-5 overflow-y-auto border-l border-border/60 bg-muted/30 p-4 lg:flex">
          <div className="flex flex-col items-center space-y-2 border-b border-border/40 pb-4 text-center">
            {fotoChat ? (
              <img src={fotoChat} alt="" className="size-20 rounded-full object-cover shadow-lg" />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
                {enGrupos ? <UsersThree className="size-8" /> : (tituloChat[0] ?? '?')}
              </div>
            )}
            <h4 className="text-sm font-bold text-foreground">{tituloChat}</h4>
            {/* No decimos «cifrado de extremo a extremo»: no lo es. Los
                mensajes se guardan en la base del programa y lo que alguien
                reporta llega al equipo con una copia. Prometer un cifrado que
                no existe puede hacer que alguien cuente aquí algo que no
                contaría, y eso es peor que no decir nada. */}
            <span className="rounded-full bg-muted px-3 py-0.5 text-center text-[10px] font-semibold text-muted-foreground">
              {T.privada}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-2 border-b border-border/40 pb-3">
              <p className="font-bold text-foreground">{T.personalizar}</p>
              <div className="flex items-center gap-2 pt-1">
                {([
                  ['predeterminado', 'bg-card'],
                  ['patron_rojo', 'bg-rose-600'],
                  ['mar', 'bg-blue-600'],
                  ['esmeralda', 'bg-emerald-600'],
                ] as const).map(([clave, color]) => (
                  <button
                    key={clave}
                    type="button"
                    onClick={() => setTemaChatFondo(clave)}
                    aria-pressed={temaChatFondo === clave}
                    className={cn('size-6 rounded-full border-2', color, temaChatFondo === clave ? 'border-primary' : 'border-border')}
                  />
                ))}
              </div>
            </div>

            {enGrupos && (
              <div className="space-y-2 border-b border-border/40 pb-3">
                <button
                  type="button"
                  onClick={() => void abrirMiembros()}
                  className="flex w-full items-center justify-between font-bold text-foreground hover:text-primary"
                >
                  <span>{T.miembrosDelGrupo}</span>
                  <UsersThree className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleSalirDelGrupo()}
                  className="flex w-full items-center justify-between font-semibold text-destructive hover:underline"
                >
                  <span>{T.salirDelGrupo}</span>
                  <SignOut className="size-4" />
                </button>
              </div>
            )}

            {enDirectos && selectedContactoId && (
              <div className="space-y-2 pt-1">
                <p className="font-bold text-foreground">{T.privacidad}</p>
                <button
                  type="button"
                  onClick={() => void handleBloqueo()}
                  className="block w-full text-left font-semibold text-destructive hover:underline"
                >
                  {contactoBloqueado ? T.desbloquear : T.bloquear}
                </button>
                <button
                  type="button"
                  onClick={() => setModalReportar(true)}
                  className="block w-full text-left font-semibold text-muted-foreground hover:text-foreground"
                >
                  {T.reportar}
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── MODALES ──────────────────────────────────────────────────────────── */}
      {modalCrearGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-bold text-foreground">{T.crearGrupo}</h3>
              <button type="button" onClick={() => setModalCrearGrupo(false)} aria-label={T.cerrar}>
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={nombreNuevoGrupo}
                onChange={(e) => setNombreNuevoGrupo(e.target.value)}
                maxLength={120}
                placeholder={T.nombreGrupo}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                type="text"
                value={descNuevoGrupo}
                onChange={(e) => setDescNuevoGrupo(e.target.value)}
                maxLength={255}
                placeholder={T.descripcionGrupo}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-2">
                {contactosParaGrupo.map((c) => {
                  const sel = miembrosSeleccionados.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setMiembrosSeleccionados((prev) => (sel ? prev.filter((i) => i !== c.id) : [...prev, c.id]))}
                      className={cn('flex w-full items-center justify-between rounded-lg p-1.5 text-xs', sel ? 'bg-primary/20 text-primary' : 'hover:bg-muted')}
                    >
                      <span>{c.nombre}</span>
                      {sel && <Check className="size-4 text-primary" />}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleCrearGrupo()}
                disabled={!nombreNuevoGrupo.trim()}
                className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground shadow disabled:opacity-50"
              >
                {T.crearGrupo}
              </button>
              <button
                type="button"
                onClick={() => setModalCrearGrupo(false)}
                className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground"
              >
                {T.cancelar}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Miembros del grupo, con alta de gente y salida */}
      {modalMiembros && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-bold text-foreground">
                {T.miembrosDelGrupo} ({miembrosGrupo.length})
              </h3>
              <button type="button" onClick={() => setModalMiembros(false)} aria-label={T.cerrar}>
                <X className="size-4" />
              </button>
            </div>

            {cargandoMiembros ? (
              <p className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <CircleNotch className="size-4 animate-spin text-primary" />
              </p>
            ) : (
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-background p-2">
                {miembrosGrupo.map((m) => (
                  <div key={m.estudianteId} className="flex items-center justify-between p-1.5 text-xs">
                    <span className="font-semibold text-foreground">{m.nombre}</span>
                    {m.esAdmin && (
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">{T.admin}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Aquí no había nada: los contactos se cargaban al abrir este
                modal y no se pintaban, y el estado de «agregar miembros» estaba
                declarado sin usarse. El endpoint existía desde el principio. */}
            {mostrarAgregarMiembros ? (
              <div className="space-y-2">
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-2">
                  {contactosParaGrupo
                    .filter((c) => !miembrosGrupo.some((m) => m.estudianteId === c.id))
                    .map((c) => {
                      const sel = nuevosMiembrosSeleccionados.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setNuevosMiembrosSeleccionados((prev) =>
                              sel ? prev.filter((i) => i !== c.id) : [...prev, c.id],
                            )
                          }
                          className={cn('flex w-full items-center justify-between rounded-lg p-1.5 text-xs', sel ? 'bg-primary/20 text-primary' : 'hover:bg-muted')}
                        >
                          <span>{c.nombre}</span>
                          {sel && <Check className="size-4 text-primary" />}
                        </button>
                      )
                    })}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleAgregarMiembros()}
                    disabled={nuevosMiembrosSeleccionados.length === 0}
                    className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {T.agregar} ({nuevosMiembrosSeleccionados.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarAgregarMiembros(false)
                      setNuevosMiembrosSeleccionados([])
                    }}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground"
                  >
                    {T.cancelar}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMostrarAgregarMiembros(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-bold text-primary hover:bg-muted"
              >
                <UserPlus className="size-4" /> {T.agregarMiembros}
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleSalirDelGrupo()}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold text-destructive hover:bg-destructive/10"
            >
              <SignOut className="size-4" /> {T.salirDelGrupo}
            </button>
          </div>
        </div>
      )}

      {/* Reenviar */}
      {modalReenviar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-bold text-foreground">{T.reenviarA}</h3>
              <button type="button" onClick={() => setModalReenviar(false)} aria-label={T.cerrar}>
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {conversaciones.map((c) => (
                <button
                  key={c.contactoId}
                  type="button"
                  onClick={() => void handleReenviar(c.contactoId)}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted"
                >
                  <span className="truncate text-xs font-semibold text-foreground">{c.nombre}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reportar conversación */}
      {modalReportar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-bold text-foreground">{T.reportarTitulo}</h3>
              <button type="button" onClick={() => setModalReportar(false)} aria-label={T.cerrar}>
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{T.reportarPie}</p>
            <textarea
              value={motivoReporte}
              onChange={(e) => setMotivoReporte(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder={T.motivo}
              className="w-full resize-none rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleReportar()}
                disabled={reportando || !motivoReporte.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {reportando && <CircleNotch className="size-4 animate-spin" />}
                {T.enviarReporte}
              </button>
              <button
                type="button"
                onClick={() => setModalReportar(false)}
                className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground"
              >
                {T.cancelar}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    {dialogo}
    </>
  )
}
