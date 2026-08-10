'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowBendUpLeftIcon as ArrowBendUpLeft,
  ArrowRightIcon as ArrowRight,
  CheckIcon as Check,
  ChecksIcon as Checks,
  CircleNotchIcon as CircleNotch,
  DotsThreeVerticalIcon as DotsThreeVertical,
  MagnifyingGlassIcon as MagnifyingGlass,
  PaperclipIcon as Paperclip,
  PencilSimpleIcon as PencilSimple,
  PlusIcon as Plus,
  ShareFatIcon as ShareFat,
  SmileyIcon as Smiley,
  TrashIcon as Trash,
  UserPlusIcon as UserPlus,
  UsersThreeIcon as UsersThree,
  XIcon as X,
  PaperPlaneTiltIcon as PaperPlaneTilt,
  WarningCircleIcon as WarningCircle,
  SignOutIcon as SignOut,
} from '@phosphor-icons/react'
import { chatsApi, gruposApi, mensajesApi, EMOJIS_REACCION, mensajeDeError } from '@/lib/api'
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

type TabType = 'directos' | 'grupos' | 'soporte'

interface Props {
  locale?: 'es' | 'en'
}

const EMOJIS_RAPIDOS = ['😊', '👍', '❤️', '😂', '🎉', '🔥', '🚀', '👏', '💡', '🙌']

export function TelegramChatHub({ locale = 'es' }: Props) {
  const english = locale === 'en'

  const [activeTab, setActiveTab] = useState<TabType>('directos')
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

  // Input de envío y adjuntos
  const [borrador, setBorrador] = useState('')
  const [archivosAdjuntos, setArchivosAdjuntos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [mostrarEmojis, setMostrarEmojis] = useState(false)

  // Acciones en mensaje
  const [editandoMensajeId, setEditandoMensajeId] = useState<string | null>(null)
  const [citandoMensaje, setCitandoMensaje] = useState<{ id: string; texto: string; autor: string } | null>(null)
  const [bloqueados, setBloqueados] = useState<string[]>([])

  // Modal: Crear Grupo
  const [modalCrearGrupo, setModalCrearGrupo] = useState(false)
  const [nombreNuevoGrupo, setNombreNuevoGrupo] = useState('')
  const [descNuevoGrupo, setDescNuevoGrupo] = useState('')
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState<string[]>([])
  const [contactosParaGrupo, setContactosParaGrupo] = useState<ChatContactoResponse[]>([])
  const [busquedaGrupoInput, setBusquedaGrupoInput] = useState('')

  // Modal: Ver / Añadir Miembros a Grupo existente
  const [modalMiembros, setModalMiembros] = useState(false)
  const [miembrosGrupo, setMiembrosGrupo] = useState<ChatGrupoMiembroResponse[]>([])
  const [cargandoMiembros, setCargandoMiembros] = useState(false)
  const [mostrarAgregarMiembros, setMostrarAgregarMiembros] = useState(false)
  const [nuevosMiembrosSeleccionados, setNuevosMiembrosSeleccionados] = useState<string[]>([])

  // Modal: Reenviar
  const [modalReenviar, setModalReenviar] = useState(false)
  const [mensajeAReenviarId, setMensajeAReenviarId] = useState<string | null>(null)

  // Modal: Reportar
  const [modalReportar, setModalReportar] = useState(false)
  const [motivoReporte, setMotivoReporte] = useState('')
  const [reportando, setReportando] = useState(false)

  /**
   * La bandeja va sin lo archivado; lo archivado, en su propia sección.
   *
   * El servidor ya resolvió cuál es cuál: una conversación archivada en la que
   * escribieron después vuelve marcada como no archivada, así que aquí no hay
   * ninguna regla que repetir.
   */
  const conversacionesEnBandeja = conversaciones.filter((c) => !c.archivada)
  const conversacionesArchivadas = conversaciones.filter((c) => c.archivada)
  const [mostrarArchivados, setMostrarArchivados] = useState(false)
  const contactoArchivado = conversacionesArchivadas.some((c) => c.contactoId === selectedContactoId)

  // Buscar dentro de la conversación abierta
  const [buscandoEnChat, setBuscandoEnChat] = useState(false)
  const [terminoEnChat, setTerminoEnChat] = useState('')
  /**
   * `null` es «todavía no se ha buscado», y no es lo mismo que una lista vacía.
   * Sin distinguirlos, al abrir la lupa se anuncia «sin resultados» antes de
   * que nadie haya escrito nada.
   */
  const [resultadosEnChat, setResultadosEnChat] = useState<
    Array<{ id: string; contenido: string; autor: string; fecha: string }> | null
  >(null)
  const [buscandoAhora, setBuscandoAhora] = useState(false)

  /**
   * De dónde se saca la cara de un compañero.
   *
   * `fotoUrl` no es una dirección: es la clave con la que el archivo está
   * guardado en el almacenamiento. Pintarla tal cual en un `<img src>` da una
   * imagen rota siempre. La foto se pide al endpoint del chat, que la sirve
   * con la regla del chat —mismo proyecto y activo—; el de la ficha solo deja
   * ver la propia.
   *
   * Se admite una dirección completa por si algún día las fotos vienen de
   * fuera, que es lo que ya hace la pantalla de perfil.
   */
  const fotoDe = (contactoId: string, clave: string | null) => {
    if (!clave) return null
    return clave.startsWith('http') ? clave : `/api/v1/chats/directos/${contactoId}/foto`
  }

  /** Lo mismo para un grupo, que la sirve su propio endpoint. */
  const fotoDeGrupo = (grupoId: string, clave: string | null) => {
    if (!clave) return null
    return clave.startsWith('http') ? clave : `/api/v1/chats/grupos/${grupoId}/foto`
  }

  /**
   * Si puede quedar conversación por encima de lo cargado.
   *
   * Se deduce de que la ventana venga llena: el servidor trae 200 al abrir y
   * 200 por tramo, así que menos de eso significa que ya no hay más. Empieza
   * en falso para no ofrecer el botón antes de haber cargado nada.
   */
  const [hayMasArriba, setHayMasArriba] = useState(false)
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false)

  /**
   * Trae el tramo anterior y lo pone por encima de lo que ya se ve.
   *
   * Sirve para los dos: en un grupo se sube igual que en un chat de dos, y el
   * botón es el mismo. Escribirlo dos veces era la forma de que uno de los dos
   * se quedara sin el arreglo del día que haya que tocarlo.
   */
  const cargarAnteriores = async () => {
    const enGrupo = activeTab === 'grupos'
    const lista = enGrupo ? mensajesGrupo : mensajesDirectos
    const id = enGrupo ? selectedGrupoId : selectedContactoId
    if (!id || lista.length === 0) return

    setCargandoAnteriores(true)
    try {
      const masViejo = lista[0]
      if (enGrupo) {
        const tramo = await gruposApi.anteriores(id, masViejo.id)
        setMensajesGrupo((actual) => [...tramo, ...actual])
        setHayMasArriba(tramo.length >= 200)
      } else {
        const tramo = await chatsApi.anteriores(id, masViejo.id)
        setMensajesDirectos((actual) => [...tramo, ...actual])
        setHayMasArriba(tramo.length >= 200)
      }
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'Earlier messages could not be loaded.' : 'No se pudieron cargar los mensajes anteriores.') })
    } finally {
      setCargandoAnteriores(false)
    }
  }

  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cargar conversaciones iniciales
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
      if (convs.length && !selectedContactoId && activeTab === 'directos') {
        setSelectedContactoId(convs[0].contactoId)
        setSelectedContactoNombre(convs[0].nombre)
        setSelectedContactoFoto(convs[0].fotoUrl)
      }
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'The inbox could not be loaded.' : 'No se pudo cargar la bandeja.') })
    } finally {
      setCargando(false)
    }
  }, [activeTab, selectedContactoId, english])

  useEffect(() => {
    void cargarBandejas()
  }, [cargarBandejas])

  // Cargar conversación directa seleccionada
  useEffect(() => {
    if (!selectedContactoId || activeTab !== 'directos') return
    let active = true
    setCargandoMensajes(true)
    chatsApi.conversacion(selectedContactoId)
      .then((msgs) => {
        if (!active) return
        setMensajesDirectos(msgs)
        // La ventana llena es la señal de que puede haber más arriba.
        setHayMasArriba(msgs.length >= 200)
      })
      .catch(() => undefined)
      .finally(() => { if (active) setCargandoMensajes(false) })

    return () => { active = false }
  }, [selectedContactoId, activeTab])

  // Cargar grupo seleccionado
  useEffect(() => {
    if (!selectedGrupoId || activeTab !== 'grupos') return
    let active = true
    setCargandoMensajes(true)
    gruposApi.mensajes(selectedGrupoId)
      .then((msgs) => {
        if (!active) return
        setMensajesGrupo(msgs)
        setHayMasArriba(msgs.length >= 200)
      })
      .catch(() => undefined)
      .finally(() => { if (active) setCargandoMensajes(false) })

    return () => { active = false }
  }, [selectedGrupoId, activeTab])

  // Búsqueda dinámica de contactos en el sidebar
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setBusquedaResultados([])
      return
    }
    let active = true
    chatsApi.contactos(searchQuery.trim())
      .then((res) => {
        if (active) setBusquedaResultados(res)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [searchQuery])

  // Cargar contactos para modal de grupo
  const cargarContactosGrupo = useCallback(async (query: string = '') => {
    try {
      const res = await chatsApi.contactos(query.trim() || 'a')
      setContactosParaGrupo(res)
    } catch (e) {
      // Sin esto, la lista de a quién invitar sale vacía y parece que no hay
      // nadie en el proyecto, que es una respuesta creíble y falsa.
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'The contact list could not be loaded.' : 'No se pudo cargar la lista de compañeros.') })
    }
  }, [english])

  /**
   * Busca en la conversación abierta, un poco después de dejar de teclear.
   *
   * Los 300 ms no son cosmética: sin ellos cada letra es una petición, y este
   * usuario ya comparte el cupo de la API con toda su cohorte. Con menos de
   * dos caracteres no se pregunta nada, porque el resultado seria la
   * conversación entera.
   */
  useEffect(() => {
    if (!buscandoEnChat) return
    const termino = terminoEnChat.trim()
    if (termino.length < 2) {
      setResultadosEnChat(null)
      return
    }
    let vigente = true
    setBuscandoAhora(true)
    const id = window.setTimeout(() => {
      const peticion = activeTab === 'grupos' && selectedGrupoId
        ? gruposApi.buscarEnGrupo(selectedGrupoId, termino).then((msgs) =>
            msgs.map((m) => ({ id: m.id, contenido: m.contenido, autor: m.remitenteNombre, fecha: m.createdAt })))
        : selectedContactoId
          ? chatsApi.buscarEnConversacion(selectedContactoId, termino).then((msgs) =>
              msgs.map((m) => ({ id: m.id, contenido: m.contenido, autor: m.remitenteNombre, fecha: m.createdAt })))
          : Promise.resolve([])

      peticion
        .then((res) => { if (vigente) setResultadosEnChat(res) })
        .catch((e) => {
          if (!vigente) return
          setResultadosEnChat([])
          setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'The search failed.' : 'No se pudo buscar.') })
        })
        .finally(() => { if (vigente) setBuscandoAhora(false) })
    }, 300)

    return () => { vigente = false; window.clearTimeout(id) }
  }, [buscandoEnChat, terminoEnChat, activeTab, selectedContactoId, selectedGrupoId, english])

  /**
   * Al cambiar de conversación se suelta lo que estabas citando o editando.
   *
   * Las dos cosas pertenecen a la conversación en la que estabas, y se
   * limpiaban sólo al enviar con éxito.
   *
   * La cita: la señalas en un grupo, te vas a otro y escribes, y se mandaba el
   * identificador del mensaje del grupo anterior. Antes quedaba guardada una
   * respuesta a algo que no está aquí; desde que el servidor lo rechaza, sale
   * un error que quien lo lee no puede entender, porque la barra de cita
   * enseña un mensaje que ya no ve por ningún lado.
   *
   * La edición es peor, y el servidor no puede protegerte: pulsas editar en un
   * mensaje tuyo, cambias de conversación, escribes otra cosa y le das a
   * enviar. Lo que sale no es un mensaje nuevo aquí: es aquel de allí,
   * reescrito con este texto. Para el servidor todo encaja —es tu mensaje, no
   * hay bloqueo, cabe—, así que sólo se puede evitar aquí.
   */
  useEffect(() => {
    setCitandoMensaje(null)
    setEditandoMensajeId(null)
  }, [activeTab, selectedContactoId, selectedGrupoId])

  // Auto-scroll al fondo
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajesDirectos.length, mensajesGrupo.length])

  // Enviar mensaje
  const handleEnviar = async () => {
    const texto = borrador.trim()
    if ((!texto && archivosAdjuntos.length === 0) || enviando) return
    setEnviando(true)

    try {
      if (editandoMensajeId) {
        const actualizado = await chatsApi.editar(editandoMensajeId, texto)
        setMensajesDirectos((prev) => prev.map((m) => (m.id === editandoMensajeId ? actualizado : m)))
        setEditandoMensajeId(null)
      } else if (activeTab === 'directos' && selectedContactoId) {
        const nuevo = await chatsApi.enviar(selectedContactoId, texto)
        setMensajesDirectos((prev) => [...prev, nuevo])
      } else if (activeTab === 'grupos' && selectedGrupoId) {
        const nuevo = await gruposApi.enviar(selectedGrupoId, texto, citandoMensaje?.id)
        setMensajesGrupo((prev) => [...prev, nuevo])
      }
      setBorrador('')
      setArchivosAdjuntos([])
      setCitandoMensaje(null)
      setMostrarEmojis(false)
      void cargarBandejas()
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'Failed to send message.' : 'No se pudo enviar el mensaje.') })
    } finally {
      setEnviando(false)
    }
  }

  // Borrar mensaje
  const handleBorrar = async (id: string) => {
    try {
      await chatsApi.borrar(id)
      setMensajesDirectos((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'Failed to delete message.' : 'No se pudo borrar el mensaje.') })
    }
  }

  // Reenviar mensaje
  const handleReenviar = async (destinoId: string) => {
    if (!mensajeAReenviarId) return
    try {
      await chatsApi.reenviar(mensajeAReenviarId, destinoId)
      setModalReenviar(false)
      setMensajeAReenviarId(null)
      setAviso({ tipo: 'ok', texto: english ? 'Message forwarded.' : 'Mensaje reenviado correctamente.' })
      void cargarBandejas()
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'Failed to forward message.' : 'No se pudo reenviar el mensaje.') })
    }
  }

  // Reportar estudiante
  const handleEnviarReporte = async () => {
    if (!selectedContactoId) return
    setReportando(true)
    try {
      await chatsApi.reportar(selectedContactoId, motivoReporte.trim())
      setModalReportar(false)
      setMotivoReporte('')
      setAviso({ tipo: 'ok', texto: english ? 'Report sent to administrators.' : 'Reporte enviado a administración.' })
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'Failed to submit report.' : 'No se pudo enviar el reporte.') })
    } finally {
      setReportando(false)
    }
  }

  // Bloquear / Desbloquear
  /** Aparta la conversación abierta de la bandeja, o la devuelve. */
  const handleArchivar = async () => {
    if (!selectedContactoId) return
    const id = selectedContactoId
    const estaba = contactoArchivado
    try {
      if (estaba) await chatsApi.desarchivar(id)
      else await chatsApi.archivar(id)
      await cargarBandejas()
      setAviso({
        tipo: 'ok',
        texto: estaba
          ? (english ? 'Back in your inbox.' : 'Vuelve a estar en tu bandeja.')
          : (english
              ? 'Archived. It will come back if they write to you again.'
              : 'Archivada. Volverá si te vuelven a escribir.'),
      })
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'It could not be archived.' : 'No se pudo archivar.') })
    }
  }

  const handleBloqueo = async () => {
    if (!selectedContactoId) return
    const idContacto = selectedContactoId
    const bloqueadoAhora = bloqueados.includes(idContacto)
    try {
      if (bloqueadoAhora) {
        await chatsApi.desbloquear(idContacto)
        setBloqueados((prev) => prev.filter((id) => id !== idContacto))
        setAviso({ tipo: 'ok', texto: english ? 'Unblocked.' : 'Contacto desbloqueado.' })
      } else {
        await chatsApi.bloquear(idContacto)
        setBloqueados((prev) => [...prev, idContacto])
        setAviso({ tipo: 'ok', texto: english ? 'Blocked.' : 'Contacto bloqueado.' })
      }
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'Failed to change block status.' : 'No se pudo cambiar el estado de bloqueo.') })
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
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'Failed to create group.' : 'No se pudo crear el grupo.') })
    }
  }

  // Abrir modal ver/añadir miembros de grupo
  const abrirMiembros = async () => {
    if (!selectedGrupoId) return
    setModalMiembros(true)
    setCargandoMiembros(true)
    setMostrarAgregarMiembros(false)
    try {
      const lista = await gruposApi.miembros(selectedGrupoId)
      setMiembrosGrupo(lista)
      await cargarContactosGrupo()
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'Failed to load members.' : 'No se pudo cargar la lista de miembros.') })
    } finally {
      setCargandoMiembros(false)
    }
  }

  // Añadir miembros a grupo existente
  const handleAgregarNuevosMiembros = async () => {
    if (!selectedGrupoId || nuevosMiembrosSeleccionados.length === 0) return
    try {
      await gruposApi.agregarMiembros(selectedGrupoId, nuevosMiembrosSeleccionados)
      setNuevosMiembrosSeleccionados([])
      setMostrarAgregarMiembros(false)
      const lista = await gruposApi.miembros(selectedGrupoId)
      setMiembrosGrupo(lista)
      setAviso({ tipo: 'ok', texto: english ? 'Members added.' : 'Miembros añadidos con éxito.' })
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'Failed to add members.' : 'No se pudo añadir los miembros.') })
    }
  }

  // Salir de grupo
  const handleSalirGrupo = async () => {
    if (!selectedGrupoId) return
    try {
      await gruposApi.salir(selectedGrupoId)
      setModalMiembros(false)
      setSelectedGrupoId(null)
      setSelectedGrupoNombre('')
      void cargarBandejas()
      setAviso({ tipo: 'ok', texto: english ? 'You left the group.' : 'Has salido del grupo.' })
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'Failed to leave group.' : 'No se pudo salir del grupo.') })
    }
  }

  const abrirModalCrearGrupo = () => {
    setModalCrearGrupo(true)
    void cargarContactosGrupo()
  }

  const contactoBloqueado = selectedContactoId ? bloqueados.includes(selectedContactoId) : false

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[38rem] overflow-hidden rounded-2xl border border-border bg-card shadow-lg dark:bg-[#090d16]">
      {/* ── BARRA LATERAL IZQUIERDA ────────────────────────────────────────────── */}
      <aside className="flex w-80 flex-col border-r border-border bg-muted/20 dark:bg-[#0f172a]">
        {/* Pestañas Telegram */}
        <div className="flex border-b border-border p-2">
          <button
            type="button"
            onClick={() => setActiveTab('directos')}
            className={cn(
              'flex-1 rounded-xl py-2 text-xs font-semibold transition',
              activeTab === 'directos' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            💬 {english ? 'Direct' : 'Directos'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grupos')}
            className={cn(
              'flex-1 rounded-xl py-2 text-xs font-semibold transition',
              activeTab === 'grupos' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            👥 {english ? 'Groups' : 'Grupos'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('soporte')}
            className={cn(
              'flex-1 rounded-xl py-2 text-xs font-semibold transition',
              activeTab === 'soporte' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            🎧 {english ? 'Support' : 'Soporte'}
          </button>
        </div>

        {/* Buscador de contactos */}
        <div className="p-3">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={english ? 'Search classmates...' : 'Buscar compañeros...'}
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Resultados de búsqueda en vivo */}
        {searchQuery.trim().length >= 2 && (
          <div className="border-b border-border bg-background p-2">
            <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {english ? 'Search Results' : 'Resultados de Búsqueda'}
            </p>
            {busquedaResultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedContactoId(c.id)
                  setSelectedContactoNombre(c.nombre)
                  setSelectedContactoFoto(c.fotoUrl)
                  setSearchQuery('')
                  setActiveTab('directos')
                }}
                className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-muted"
              >
                {c.fotoUrl ? (
                  <img src={fotoDe(c.id, c.fotoUrl) ?? undefined} alt="" className="size-8 rounded-full object-cover" />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {c.nombre[0]}
                  </div>
                )}
                <span className="truncate text-xs font-semibold text-foreground">{c.nombre}</span>
              </button>
            ))}
          </div>
        )}

        {/* Botón "+ Crear Nuevo Grupo" */}
        {activeTab === 'grupos' && (
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={abrirModalCrearGrupo}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
            >
              <Plus className="size-4" />
              <span>{english ? 'New Group' : 'Crear Nuevo Grupo'}</span>
            </button>
          </div>
        )}

        {/* Lista de Chats / Conversaciones */}
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {activeTab === 'directos' &&
            conversacionesEnBandeja.map((conv) => (
              <button
                key={conv.contactoId}
                type="button"
                onClick={() => {
                  setSelectedContactoId(conv.contactoId)
                  setSelectedContactoNombre(conv.nombre)
                  setSelectedContactoFoto(conv.fotoUrl)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition',
                  selectedContactoId === conv.contactoId ? 'bg-primary/15 font-medium text-primary' : 'hover:bg-muted/60',
                )}
              >
                {conv.fotoUrl ? (
                  <img src={fotoDe(conv.contactoId, conv.fotoUrl) ?? undefined} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                    {conv.nombre[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs font-bold text-foreground">{conv.nombre}</p>
                    {conv.sinLeer > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {conv.sinLeer}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{conv.ultimoMensaje}</p>
                </div>
              </button>
            ))}

          {/* Archivados, plegado. Se sigue viendo cuántos hay: esconderlos del
              todo convierte «apartar» en «perder». */}
          {activeTab === 'directos' && conversacionesArchivadas.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setMostrarArchivados((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-[11px] font-semibold text-muted-foreground transition hover:bg-muted/60"
              >
                <span>{english ? 'Archived' : 'Archivados'}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                  {conversacionesArchivadas.length}
                </span>
              </button>

              {mostrarArchivados && conversacionesArchivadas.map((conv) => (
                <button
                  key={conv.contactoId}
                  type="button"
                  onClick={() => {
                    setSelectedContactoId(conv.contactoId)
                    setSelectedContactoNombre(conv.nombre)
                    setSelectedContactoFoto(conv.fotoUrl)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl p-2.5 text-left opacity-70 transition hover:opacity-100',
                    selectedContactoId === conv.contactoId ? 'bg-primary/15 font-medium text-primary' : 'hover:bg-muted/60',
                  )}
                >
                  {conv.fotoUrl ? (
                    <img src={fotoDe(conv.contactoId, conv.fotoUrl) ?? undefined} alt="" className="size-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground">
                      {conv.nombre[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-foreground">{conv.nombre}</p>
                      {/* Se puede archivar sin abrir, así que una archivada
                          puede tener mensajes sin leer. La campana los cuenta;
                          esconder el número aquí dejaba a la persona buscando
                          de dónde salía. */}
                      {conv.sinLeer > 0 && (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {conv.sinLeer}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{conv.ultimoMensaje}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'grupos' &&
            grupos.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setSelectedGrupoId(g.id)
                  setSelectedGrupoNombre(g.nombre)
                  setSelectedGrupoFoto(g.fotoUrl)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition',
                  selectedGrupoId === g.id ? 'bg-primary/15 font-medium text-primary' : 'hover:bg-muted/60',
                )}
              >
                {g.fotoUrl ? (
                  <img src={fotoDeGrupo(g.id, g.fotoUrl) ?? undefined} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-bold text-emerald-600 dark:text-emerald-400">
                    <UsersThree className="size-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-foreground">{g.nombre}</p>
                  <p className="text-[11px] text-muted-foreground">{g.totalMiembros} {english ? 'members' : 'miembros'}</p>
                </div>
              </button>
            ))}

          {activeTab === 'soporte' &&
            soporteHilos.map((hilo) => (
              <button
                key={hilo.id}
                type="button"
                onClick={() => setSelectedSoporteId(hilo.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition',
                  selectedSoporteId === hilo.id ? 'bg-primary/15 font-medium text-primary' : 'hover:bg-muted/60',
                )}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-600 dark:text-amber-400">
                  🎧
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-foreground">CAC Academic</p>
                  <p className="truncate text-[11px] text-muted-foreground">{hilo.asunto}</p>
                </div>
              </button>
            ))}
        </div>
      </aside>

      {/* ── ÁREA PRINCIPAL DE CONVERSACIÓN ────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        {/* Cabecera limpia con pr-16 para NUNCA chocar con el botón X de cerrar */}
        <header className="flex items-center justify-between border-b border-border bg-card px-5 py-3.5 pr-16 shadow-sm dark:bg-[#0f172a]">
          <div className="flex items-center gap-3">
            {activeTab === 'directos' && selectedContactoFoto ? (
              <img src={fotoDe(selectedContactoId ?? '', selectedContactoFoto) ?? undefined} alt="" className="size-9 rounded-full object-cover" />
            ) : activeTab === 'grupos' && selectedGrupoFoto ? (
              <img src={fotoDeGrupo(selectedGrupoId ?? '', selectedGrupoFoto) ?? undefined} alt="" className="size-9 rounded-full object-cover" />
            ) : (
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                {activeTab === 'directos' ? (selectedContactoNombre[0] || 'C') : activeTab === 'grupos' ? '👥' : '🎧'}
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {activeTab === 'directos'
                  ? selectedContactoNombre || 'Selecciona un contacto'
                  : activeTab === 'grupos'
                  ? selectedGrupoNombre || 'Selecciona un grupo'
                  : 'Soporte y Acompañamiento CAC'}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {activeTab === 'directos' ? (english ? 'Direct Chat' : 'Chat Directo') : activeTab === 'grupos' ? (english ? 'Group Chat' : 'Grupo de Estudio') : (english ? 'Official Support Channel' : 'Canal Oficial de Soporte')}
              </p>
            </div>
          </div>

          {/* Acciones de la cabecera (Buscar, Bloquear, Reportar, Ver Miembros) */}
          <div className="flex items-center gap-2">
            {((activeTab === 'directos' && selectedContactoId) || (activeTab === 'grupos' && selectedGrupoId)) && (
              <button
                type="button"
                onClick={() => {
                  setBuscandoEnChat((abierto) => !abierto)
                  setTerminoEnChat('')
                  setResultadosEnChat(null)
                }}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-xs font-semibold transition',
                  buscandoEnChat
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
                title={english ? 'Search in this conversation' : 'Buscar en esta conversación'}
              >
                <MagnifyingGlass className="size-4" />
              </button>
            )}

            {activeTab === 'directos' && selectedContactoId && (
              <button
                type="button"
                onClick={() => void handleArchivar()}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-xs font-semibold transition',
                  contactoArchivado
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
                title={contactoArchivado
                  ? (english ? 'Move back to the inbox' : 'Devolver a la bandeja')
                  : (english ? 'Archive this conversation' : 'Archivar esta conversación')}
              >
                {contactoArchivado
                  ? (english ? 'Unarchive' : 'Desarchivar')
                  : (english ? 'Archive' : 'Archivar')}
              </button>
            )}

            {activeTab === 'directos' && selectedContactoId && (
              <>
                <button
                  type="button"
                  onClick={() => void handleBloqueo()}
                  className={cn(
                    'rounded-xl border px-3 py-1.5 text-xs font-semibold transition',
                    contactoBloqueado
                      ? 'border-destructive/40 bg-destructive/10 text-destructive'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {contactoBloqueado ? (english ? 'Unblock' : 'Desbloquear') : (english ? 'Block' : 'Bloquear')}
                </button>

                <button
                  type="button"
                  onClick={() => setModalReportar(true)}
                  className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                >
                  {english ? 'Report' : 'Reportar'}
                </button>
              </>
            )}

            {activeTab === 'grupos' && selectedGrupoId && (
              <button
                type="button"
                onClick={() => void abrirMiembros()}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
              >
                <UsersThree className="size-4 text-primary" />
                <span>{english ? 'Members' : 'Miembros'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Notificaciones flotantes */}
        {buscandoEnChat && (
          <div className="border-b border-border bg-card/60 px-5 py-3 dark:bg-[#0f172a]/60">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                autoFocus
                value={terminoEnChat}
                onChange={(e) => setTerminoEnChat(e.target.value)}
                placeholder={english ? 'Search in this conversation…' : 'Buscar en esta conversación…'}
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>

            {buscandoAhora && (
              <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <CircleNotch className="size-3 animate-spin text-primary" />
                {english ? 'Searching…' : 'Buscando…'}
              </p>
            )}

            {/* Sólo cuando ya se buscó: `null` es «aún no», y anunciar «sin
                resultados» antes de que nadie escriba nada es decir algo falso. */}
            {!buscandoAhora && resultadosEnChat?.length === 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {english ? 'Nothing found in this conversation.' : 'No se encontró nada en esta conversación.'}
              </p>
            )}

            {!buscandoAhora && resultadosEnChat && resultadosEnChat.length > 0 && (
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {resultadosEnChat.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border/60 bg-background px-3 py-2">
                    <p className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      <span className="font-medium text-foreground">{r.autor}</span>
                      <span>{new Date(r.fecha).toLocaleString(english ? 'en-GB' : 'es-CO')}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-3 text-xs text-foreground">{r.contenido}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {aviso && (
          <div
            className={cn(
              'flex items-center justify-between px-4 py-2 text-xs font-semibold',
              aviso.tipo === 'ok' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-destructive/15 text-destructive',
            )}
          >
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} className="ml-2 hover:opacity-75">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Cuerpo del Chat */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cargandoMensajes && (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              <CircleNotch className="mr-2 size-4 animate-spin text-primary" />
              {english ? 'Loading chat...' : 'Cargando conversación...'}
            </div>
          )}

          {/* Subir por la conversación. Solo con la ventana llena: con menos
              de 200 mensajes ya se está viendo todo, y ofrecer «anteriores»
              para que no aparezca nada es prometer algo que no hay. */}
          {activeTab !== 'soporte' && !cargandoMensajes && hayMasArriba && (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                onClick={() => void cargarAnteriores()}
                disabled={cargandoAnteriores}
                className="rounded-xl border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-60"
              >
                {cargandoAnteriores
                  ? (english ? 'Loading…' : 'Cargando…')
                  : (english ? 'Load earlier messages' : 'Ver mensajes anteriores')}
              </button>
            </div>
          )}

          {/* Mensajes Directos */}
          {activeTab === 'directos' &&
            !cargandoMensajes &&
            mensajesDirectos.map((m) => (
              <div key={m.id} className={cn('group flex flex-col', m.enviadoPorMi ? 'items-end' : 'items-start')}>
                <div className="relative max-w-[80%]">
                  {/* Menú flotante de acciones (Editar, Borrar, Citar, Reenviar) */}
                  <div
                    className={cn(
                      'absolute -top-3 z-10 hidden items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-md group-hover:flex dark:bg-[#0f172a]',
                      m.enviadoPorMi ? 'right-0' : 'left-0',
                    )}
                  >
                    {m.enviadoPorMi && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoMensajeId(m.id)
                          setBorrador(m.contenido)
                        }}
                        title="Editar"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <PencilSimple className="size-3.5" />
                      </button>
                    )}
                    {m.enviadoPorMi && (
                      <button
                        type="button"
                        onClick={() => void handleBorrar(m.id)}
                        title="Borrar"
                        className="rounded p-1 text-destructive hover:bg-destructive/10"
                      >
                        <Trash className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCitandoMensaje({ id: m.id, texto: m.contenido, autor: m.remitenteNombre })}
                      title="Responder"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ArrowBendUpLeft className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMensajeAReenviarId(m.id)
                        setModalReenviar(true)
                      }}
                      title="Reenviar"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ShareFat className="size-3.5" />
                    </button>
                  </div>

                  {/* Burbuja de Mensaje */}
                  <div
                    className={cn(
                      'whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm',
                      m.enviadoPorMi
                        ? 'rounded-tr-xs bg-primary text-primary-foreground'
                        : 'rounded-tl-xs border border-border bg-card text-foreground dark:bg-[#0f172a]',
                    )}
                  >
                    {m.reenviado && (
                      <p className="mb-1 text-[10px] font-bold italic opacity-80">
                        ↪ {english ? 'Forwarded' : 'Reenviado'}
                      </p>
                    )}
                    <p>{m.contenido}</p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[9px] opacity-75">
                      {m.editado && <span>({english ? 'edited' : 'editado'})</span>}
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {m.enviadoPorMi && (
                        m.leidoAt ? <Checks className="size-3 text-emerald-400" /> : <Check className="size-3" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* Mensajes de Grupo */}
          {activeTab === 'grupos' &&
            !cargandoMensajes &&
            mensajesGrupo.map((m) => (
              <div key={m.id} className={cn('flex flex-col', m.enviadoPorMi ? 'items-end' : 'items-start')}>
                <div className="max-w-[80%]">
                  {!m.enviadoPorMi && <p className="mb-0.5 text-[10px] font-bold text-primary">{m.remitenteNombre}</p>}
                  <div
                    className={cn(
                      'whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm',
                      m.enviadoPorMi
                        ? 'rounded-tr-xs bg-primary text-primary-foreground'
                        : 'rounded-tl-xs border border-border bg-card text-foreground dark:bg-[#0f172a]',
                    )}
                  >
                    <p>{m.contenido}</p>
                    <div className="mt-1 flex items-center justify-end text-[9px] opacity-75">
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* Pestaña de Soporte Oficial */}
          {activeTab === 'soporte' && selectedSoporteId && (
            <div className="h-full">
              <Conversacion mensajeId={selectedSoporteId} soyEstudiante locale={locale} textos={{
                escribir: 'Escribe tu consulta al equipo...',
                enviar: 'Enviar',
                adjuntar: 'Adjuntar',
                responder: 'Responder',
                reaccionar: 'Reaccionar',
                cancelar: 'Cancelar',
                vacio: 'Sin mensajes.',
                cargando: 'Cargando hilo...',
                respondiendoA: 'Respondiendo a',
                maxArchivos: 'Máximo 5 archivos',
                errorCargar: 'Error al cargar',
                errorEnviar: 'Error al enviar',
                errorReaccionar: 'Error al reaccionar',
              }} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Caja de cita activa */}
        {citandoMensaje && (
          <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-1.5 text-xs">
            <div className="truncate border-l-2 border-primary pl-2 text-muted-foreground">
              <span className="font-bold text-primary">{citandoMensaje.autor}: </span>
              <span>{citandoMensaje.texto}</span>
            </div>
            <button type="button" onClick={() => setCitandoMensaje(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Archivos seleccionados para adjuntar */}
        {archivosAdjuntos.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border bg-muted/20 px-4 py-2">
            {archivosAdjuntos.map((file, idx) => (
              <div key={idx} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
                <Paperclip className="size-3.5 text-primary" />
                <span className="max-w-40 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setArchivosAdjuntos((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Selector de Emojis */}
        {mostrarEmojis && (
          <div className="flex flex-wrap gap-1.5 border-t border-border bg-card p-2 dark:bg-[#0f172a]">
            {EMOJIS_RAPIDOS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setBorrador((prev) => prev + emoji)
                }}
                className="rounded-lg p-1.5 text-base transition hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar Estilo Telegram con Adjuntos y Emojis */}
        {activeTab !== 'soporte' && (
          <footer className="border-t border-border bg-card p-3 dark:bg-[#0f172a]">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleEnviar()
              }}
              className="flex items-center gap-2"
            >
              {/* Botón Emojis */}
              <button
                type="button"
                onClick={() => setMostrarEmojis((prev) => !prev)}
                className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
                title="Emojis"
              >
                <Smiley className="size-5" />
              </button>

              {/* Botón Adjuntar Archivos */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setArchivosAdjuntos((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
                title="Adjuntar archivo"
              >
                <Paperclip className="size-5" />
              </button>

              <input
                type="text"
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                disabled={contactoBloqueado}
                placeholder={
                  contactoBloqueado
                    ? (english ? 'Contact blocked.' : 'Contacto bloqueado.')
                    : editandoMensajeId
                    ? (english ? 'Edit message...' : 'Editar mensaje...')
                    : (english ? 'Write a message...' : 'Escribe un mensaje...')
                }
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={(!borrador.trim() && archivosAdjuntos.length === 0) || enviando || contactoBloqueado}
                className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow transition hover:brightness-110 disabled:opacity-50"
              >
                <PaperPlaneTilt className="size-4" />
              </button>
            </form>
          </footer>
        )}
      </main>

      {/* ── MODAL: CREAR GRUPO ────────────────────────────────────────────────── */}
      {modalCrearGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl dark:bg-[#0f172a]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">{english ? 'Create New Group' : 'Crear Nuevo Grupo'}</h3>
              <button type="button" onClick={() => setModalCrearGrupo(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">{english ? 'Group Name' : 'Nombre del Grupo'}</label>
                <input
                  type="text"
                  value={nombreNuevoGrupo}
                  onChange={(e) => setNombreNuevoGrupo(e.target.value)}
                  placeholder="ej. Grupo de Estudio Cohorte 4"
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">{english ? 'Description' : 'Descripción (Opcional)'}</label>
                <input
                  type="text"
                  value={descNuevoGrupo}
                  onChange={(e) => setDescNuevoGrupo(e.target.value)}
                  placeholder="ej. Preparación para entrevistas de trabajo"
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">{english ? 'Add Members' : 'Añadir Miembros'}</label>
                <div className="relative mt-1 mb-2">
                  <MagnifyingGlass className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={busquedaGrupoInput}
                    onChange={(e) => {
                      setBusquedaGrupoInput(e.target.value)
                      void cargarContactosGrupo(e.target.value)
                    }}
                    placeholder="Buscar compañero..."
                    className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2.5 text-xs text-foreground focus:outline-none"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-border bg-background p-2">
                  {contactosParaGrupo.length === 0 ? (
                    <p className="p-2 text-center text-xs text-muted-foreground">{english ? 'No classmates found.' : 'No se encontraron compañeros.'}</p>
                  ) : (
                    contactosParaGrupo.map((c) => {
                      const selected = miembrosSeleccionados.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setMiembrosSeleccionados((prev) =>
                              selected ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                            )
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg p-2 text-xs transition',
                            selected ? 'bg-primary/15 text-primary font-semibold' : 'hover:bg-muted',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {c.fotoUrl ? (
                              <img src={fotoDe(c.id, c.fotoUrl) ?? undefined} alt="" className="size-6 rounded-full object-cover" />
                            ) : (
                              <div className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                                {c.nombre[0]}
                              </div>
                            )}
                            <span>{c.nombre}</span>
                          </div>
                          {selected && <Check className="size-4 text-primary" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => void handleCrearGrupo()}
                disabled={!nombreNuevoGrupo.trim()}
                className="flex-1 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground shadow transition hover:brightness-110 disabled:opacity-50"
              >
                {english ? 'Create Group' : 'Crear Grupo'}
              </button>
              <button
                type="button"
                onClick={() => setModalCrearGrupo(false)}
                className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                {english ? 'Cancel' : 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VER / AÑADIR MIEMBROS DE GRUPO ────────────────────────────── */}
      {modalMiembros && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl dark:bg-[#0f172a]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">
                {english ? 'Group Members' : 'Miembros del Grupo'} ({miembrosGrupo.length})
              </h3>
              <button type="button" onClick={() => setModalMiembros(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            {cargandoMiembros ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                <CircleNotch className="mr-2 size-4 animate-spin text-primary" />
                {english ? 'Loading members...' : 'Cargando miembros...'}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Lista de Miembros Actuales */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-background p-2">
                  {miembrosGrupo.map((m) => (
                    <div key={m.estudianteId} className="flex items-center justify-between rounded-lg p-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        {m.fotoUrl ? (
                          <img src={fotoDe(m.estudianteId, m.fotoUrl) ?? undefined} alt="" className="size-7 rounded-full object-cover" />
                        ) : (
                          <div className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                            {m.nombre[0]}
                          </div>
                        )}
                        <span className="font-semibold text-foreground">{m.nombre}</span>
                      </div>
                      {m.esAdmin && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                          Admin
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Sección para añadir nuevos miembros */}
                {!mostrarAgregarMiembros ? (
                  <button
                    type="button"
                    onClick={() => setMostrarAgregarMiembros(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
                  >
                    <UserPlus className="size-4" />
                    <span>{english ? 'Add More Members' : 'Añadir Más Miembros'}</span>
                  </button>
                ) : (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-xs font-semibold text-foreground">{english ? 'Select classmates to add:' : 'Selecciona compañeros para añadir:'}</p>
                    <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-border bg-background p-2">
                      {contactosParaGrupo
                        .filter((c) => !miembrosGrupo.some((m) => m.estudianteId === c.id))
                        .map((c) => {
                          const selected = nuevosMiembrosSeleccionados.includes(c.id)
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setNuevosMiembrosSeleccionados((prev) =>
                                  selected ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                                )
                              }}
                              className={cn(
                                'flex w-full items-center justify-between rounded-lg p-1.5 text-xs transition',
                                selected ? 'bg-primary/15 text-primary font-semibold' : 'hover:bg-muted',
                              )}
                            >
                              <span>{c.nombre}</span>
                              {selected && <Check className="size-3.5 text-primary" />}
                            </button>
                          )
                        })}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleAgregarNuevosMiembros()}
                        disabled={nuevosMiembrosSeleccionados.length === 0}
                        className="flex-1 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground shadow transition hover:brightness-110 disabled:opacity-50"
                      >
                        {english ? 'Add Selected' : 'Añadir Seleccionados'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMostrarAgregarMiembros(false)}
                        className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                      >
                        {english ? 'Cancel' : 'Cancelar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              <button
                type="button"
                onClick={() => void handleSalirGrupo()}
                className="flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline"
              >
                <SignOut className="size-4" />
                <span>{english ? 'Leave Group' : 'Salir del Grupo'}</span>
              </button>
              <button
                type="button"
                onClick={() => setModalMiembros(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                {english ? 'Close' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REPORTAR COMPAÑERO ─────────────────────────────────────────── */}
      {modalReportar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl dark:bg-[#0f172a]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">{english ? 'Report Student' : 'Reportar Compañero'}</h3>
              <button type="button" onClick={() => setModalReportar(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {english
                  ? 'Tell us why you are reporting this conversation. Administrators will review it.'
                  : 'Cuéntanos el motivo por el cual reportas a esta persona. La administración lo revisará.'}
              </p>
              <textarea
                value={motivoReporte}
                onChange={(e) => setMotivoReporte(e.target.value)}
                placeholder="ej. Comportamiento inadecuado o spam"
                rows={3}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleEnviarReporte()}
                disabled={reportando}
                className="flex-1 rounded-xl bg-destructive py-2 text-xs font-semibold text-destructive-foreground shadow transition hover:brightness-110 disabled:opacity-50"
              >
                {reportando ? (english ? 'Sending...' : 'Enviando...') : (english ? 'Submit Report' : 'Enviar Reporte')}
              </button>
              <button
                type="button"
                onClick={() => setModalReportar(false)}
                className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                {english ? 'Cancel' : 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REENVIAR MENSAJE ───────────────────────────────────────────── */}
      {modalReenviar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl dark:bg-[#0f172a]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">{english ? 'Forward Message to...' : 'Reenviar Mensaje a...'}</h3>
              <button type="button" onClick={() => setModalReenviar(false)} className="text-muted-foreground hover:text-foreground">
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
                  {c.fotoUrl ? (
                    <img src={fotoDe(c.contactoId, c.fotoUrl) ?? undefined} alt="" className="size-7 rounded-full object-cover" />
                  ) : (
                    <div className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {c.nombre[0]}
                    </div>
                  )}
                  <span className="truncate text-xs font-semibold text-foreground">{c.nombre}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
