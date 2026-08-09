'use client'

import {
  ArrowsClockwiseIcon as ArrowsClockwise,
  ChatCircleIcon as ChatCircle,
  ClockIcon as Clock,
  MagnifyingGlassIcon as MagnifyingGlass,
  PlusIcon as Plus,
  UserIcon as User,
  UserPlusIcon as UserPlus,
  WarningCircleIcon as WarningCircle,
  XIcon as X,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from '@/compat/next-link'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { estudiantesApi, mensajeDeError, tableroApi } from '@/lib/api'
import { useAvisos } from '@/components/ui/avisos'
import { useSearchParams } from '@/compat/next-navigation'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'
import type { EstadoContacto, EstudianteResponse, EtapaEmpleabilidad, Tablero, TarjetaTablero } from '@/lib/types'

/** El orden de las columnas es el del recorrido, no alfabético. */
const ESTADOS: EstadoContacto[] = ['SIN_CONTACTO', 'EN_PROCESO', 'ENTREVISTA', 'COLOCADO', 'CERRADO']

/** El color no depende del idioma; la etiqueta sí, y sale del diccionario. */
const COLOR_ESTADO: Record<EstadoContacto, string> = {
  SIN_CONTACTO: 'bg-muted-foreground/40',
  EN_PROCESO: 'bg-navy-400',
  ENTREVISTA: 'bg-warning',
  COLOCADO: 'bg-success',
  CERRADO: 'bg-red-600',
}

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Follow-up board',
        descripcion: 'Where each student stands in the conversation, with the stage the system infers next to it. Drag columns horizontally, drop cards between stages, or search students to add them.',
        cargando: 'Loading the board…',
        noSePudoCargar: 'The board could not be loaded.',
        noSePudoMover: 'The student could not be moved.',
        sinEstudiantes: 'No students on the board.',
        columnaVacia: 'Nobody here.',
        moverA: 'Move to…',
        necesitanAtencion: (n: number) => `${n} need attention`,
        sinContactoNunca: 'Never contacted',
        diasSinContacto: (n: number) => `${n} days without contact`,
        contactadoHoy: 'Contacted today',
        postulacionesX: (n: number) => `${n} applications`,
        accionesX: (n: number) => `${n} follow-up actions`,
        proximaAccion: 'Next action',
        totalEstudiantes: (n: number) => `${n} students on the board`,
        buscarEnTablero: 'Search student in board…',
        agregarEstudiante: 'Add student',
        modalTitulo: 'Add student to board',
        modalSubtitulo: 'Search for any student in the system and assign their contact status.',
        buscarEstudianteInput: 'Search by name, email or document…',
        buscando: 'Searching students…',
        sinResultados: 'No students found matching your search.',
        seleccionarEstado: 'Target stage',
        asignar: 'Assign to stage',
        asignando: 'Assigning…',
        sinContacto: 'No contact',
        enProceso: 'In conversation',
        entrevista: 'Interviewing',
        colocado: 'Placed',
        cerrado: 'Closed',
        sinPerfil: 'No profile',
        perfilListo: 'Profile ready',
        preparado: 'Ready',
        postulando: 'Applying',
      }
    : {
        titulo: 'Tablero de seguimiento',
        descripcion: 'En qué punto de la conversación está cada estudiante. Arrastra el tablero con clic para desplazarte, mueve tarjetas entre columnas o busca un estudiante para agregarlo.',
        cargando: 'Cargando el tablero…',
        noSePudoCargar: 'No se pudo cargar el tablero.',
        noSePudoMover: 'No se pudo mover al estudiante.',
        sinEstudiantes: 'No hay estudiantes en el tablero.',
        columnaVacia: 'Nadie aquí. Arrastra tarjetas o agrega un estudiante.',
        moverA: 'Mover a…',
        necesitanAtencion: (n: number) => `${n} necesitan atención`,
        sinContactoNunca: 'Nunca contactado',
        diasSinContacto: (n: number) => `${n} días sin contacto`,
        contactadoHoy: 'Contactado hoy',
        postulacionesX: (n: number) => `${n} postulaciones`,
        accionesX: (n: number) => `${n} acciones de seguimiento`,
        proximaAccion: 'Próxima acción',
        totalEstudiantes: (n: number) => `${n} estudiantes en el tablero`,
        buscarEnTablero: 'Buscar estudiante en el tablero…',
        agregarEstudiante: 'Agregar estudiante',
        modalTitulo: 'Agregar estudiante al tablero',
        modalSubtitulo: 'Busca a cualquier estudiante del sistema y asígnale su estado de seguimiento.',
        buscarEstudianteInput: 'Buscar por nombre, correo o documento…',
        buscando: 'Buscando estudiantes…',
        sinResultados: 'No encontramos estudiantes con esa búsqueda.',
        seleccionarEstado: 'Estado de seguimiento',
        asignar: 'Asignar a columna',
        asignando: 'Asignando…',
        sinContacto: 'Sin contacto',
        enProceso: 'En conversación',
        entrevista: 'En entrevistas',
        colocado: 'Colocado',
        cerrado: 'Cerrado',
        sinPerfil: 'Sin perfil',
        perfilListo: 'Perfil listo',
        preparado: 'Preparado',
        postulando: 'Postulando',
      }
}

function etiquetaEstado(T: ReturnType<typeof textos>, estado: EstadoContacto): string {
  return {
    SIN_CONTACTO: T.sinContacto, EN_PROCESO: T.enProceso, ENTREVISTA: T.entrevista,
    COLOCADO: T.colocado, CERRADO: T.cerrado,
  }[estado] ?? estado
}

function etiquetaEtapa(T: ReturnType<typeof textos>, etapa: EtapaEmpleabilidad): string {
  return {
    SIN_PERFIL: T.sinPerfil, PERFIL_LISTO: T.perfilListo, PREPARADO: T.preparado,
    POSTULANDO: T.postulando, COLOCADO: T.colocado,
  }[etapa] ?? etapa
}

const DIAS_PARA_ALERTAR = 14

export default function SeguimientoPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const { mostrarError, avisos } = useAvisos()
  const [tablero, setTablero] = useState<Tablero | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moviendo, setMoviendo] = useState<string | null>(null)
  const [filtroTablero, setFiltroTablero] = useState('')

  /**
   * La columna que se pidió al llegar, si se llegó desde otra pantalla.
   *
   * El asistente enlaza aquí con `?estado=ENTREVISTA` cuando alguien le pide
   * mover a un estudiante. Sin leerlo, esa tarjeta prometía abrir el tablero
   * «con esa columna a la vista» y dejaba al usuario buscándola entre cinco.
   * Se valida contra la lista: un valor inventado en la URL no debe pintar
   * nada raro, sólo ignorarse.
   */
  const parametros = useSearchParams()
  const estadoPedido = ESTADOS.find((e) => e === parametros.get('estado')) ?? null
  const columnaDestacada = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!estadoPedido || cargando) return
    columnaDestacada.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [estadoPedido, cargando])

  // Mouse Panning ultrarrápido con inercia cinemática (fuerza de arrastre)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isMouseDownRef = useRef(false)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const scrollLeftRef = useRef(0)
  const scrollTopRef = useRef(0)
  const lastXRef = useRef(0)
  const lastYRef = useRef(0)
  const lastTimeRef = useRef(0)
  const velocityXRef = useRef(0)
  const velocityYRef = useRef(0)
  const animFrameRef = useRef<number | null>(null)
  const [isDraggingBoard, setIsDraggingBoard] = useState(false)

  // Drag and drop de tarjetas entre columnas
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null)
  const [dragOverEstado, setDragOverEstado] = useState<EstadoContacto | null>(null)

  // Modal para agregar estudiante
  const [modalAgregarOpen, setModalAgregarOpen] = useState(false)
  const [queryModal, setQueryModal] = useState('')
  const [estudiantesResultados, setEstudiantesResultados] = useState<EstudianteResponse[]>([])
  const [cargandoResultados, setCargandoResultados] = useState(false)
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<EstudianteResponse | null>(null)
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<EstadoContacto>('SIN_CONTACTO')
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      setTablero(await tableroApi.obtener())
    } catch (e) {
      setError(mensajeDeError(e, T.noSePudoCargar))
    } finally { setCargando(false) }
  }, [T.noSePudoCargar])

  useEffect(() => { void cargar() }, [cargar])

  const mover = async (estudianteId: string, estado: EstadoContacto, estadoActual?: EstadoContacto) => {
    if (estadoActual && estado === estadoActual) return
    setMoviendo(estudianteId)

    // Actualización optimista del estado local para respuesta instantánea sin refresco visual
    setTablero((prev) => {
      if (!prev) return prev
      let tarjetaTarget: TarjetaTablero | undefined
      for (const col of prev.columnas) {
        const encontrada = col.tarjetas.find((t) => t.estudianteId === estudianteId)
        if (encontrada) {
          tarjetaTarget = { ...encontrada, estadoContacto: estado }
          break
        }
      }
      if (!tarjetaTarget) return prev
      const nuevasColumnas = prev.columnas.map((col) => {
        const filtradas = col.tarjetas.filter((t) => t.estudianteId !== estudianteId)
        if (col.estado === estado) {
          filtradas.push(tarjetaTarget!)
        }
        return { ...col, tarjetas: filtradas, total: filtradas.length }
      })
      return { ...prev, columnas: nuevasColumnas }
    })

    try {
      await tableroApi.mover(estudianteId, estado)
      const actualizado = await tableroApi.obtener()
      setTablero(actualizado)
    } catch (e) {
      mostrarError(mensajeDeError(e, T.noSePudoMover))
      void cargar()
    } finally { setMoviendo(null) }
  }

  // Función para aplicar inercia de desaceleración (fuerza de arrastre)
  const iniciarInercia = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    const friccion = 0.93 // Factor de desaceleración suave
    const stepInercia = () => {
      if (Math.abs(velocityXRef.current) < 0.05 && Math.abs(velocityYRef.current) < 0.05) {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
        return
      }

      if (scrollRef.current) {
        scrollRef.current.scrollLeft -= velocityXRef.current * 12
      }
      const mainElem = scrollRef.current?.closest('main')
      if (mainElem) {
        mainElem.scrollTop -= velocityYRef.current * 12
      }

      velocityXRef.current *= friccion
      velocityYRef.current *= friccion

      animFrameRef.current = requestAnimationFrame(stepInercia)
    }
    if (Math.abs(velocityXRef.current) > 0.1 || Math.abs(velocityYRef.current) > 0.1) {
      animFrameRef.current = requestAnimationFrame(stepInercia)
    }
  }

  // Listeners globales para garantizar liberación limpia e iniciar inercia
  useEffect(() => {
    const handleGlobalRelease = () => {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false
        setIsDraggingBoard(false)
        iniciarInercia()
      }
    }
    window.addEventListener('mouseup', handleGlobalRelease)
    window.addEventListener('dragend', handleGlobalRelease)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('mouseup', handleGlobalRelease)
      window.removeEventListener('dragend', handleGlobalRelease)
    }
  }, [])

  // Mouse Panning ultrarrápido a 60fps/120fps sin delay ni lag
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return
    const target = e.target as HTMLElement
    if (
      ['SELECT', 'BUTTON', 'A', 'INPUT', 'OPTION', 'TEXTAREA', 'ARTICLE'].includes(target.tagName) ||
      target.closest('select, button, a, input, option, article')
    ) {
      return
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    const mainElem = scrollRef.current.closest('main')
    isMouseDownRef.current = true
    setIsDraggingBoard(true)
    startXRef.current = e.clientX
    startYRef.current = e.clientY
    lastXRef.current = e.clientX
    lastYRef.current = e.clientY
    lastTimeRef.current = performance.now()
    velocityXRef.current = 0
    velocityYRef.current = 0
    scrollLeftRef.current = scrollRef.current.scrollLeft
    scrollTopRef.current = mainElem ? mainElem.scrollTop : 0
  }

  const handleMouseLeave = () => {
    if (isMouseDownRef.current) {
      isMouseDownRef.current = false
      setIsDraggingBoard(false)
      iniciarInercia()
    }
  }

  const handleMouseUp = () => {
    if (isMouseDownRef.current) {
      isMouseDownRef.current = false
      setIsDraggingBoard(false)
      iniciarInercia()
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDownRef.current || !scrollRef.current) return
    const now = performance.now()
    const dt = now - lastTimeRef.current
    if (dt > 0) {
      const deltaX = e.clientX - lastXRef.current
      const deltaY = e.clientY - lastYRef.current
      velocityXRef.current = deltaX / dt
      velocityYRef.current = deltaY / dt
      lastXRef.current = e.clientX
      lastYRef.current = e.clientY
      lastTimeRef.current = now
    }

    const walkX = e.clientX - startXRef.current
    const walkY = e.clientY - startYRef.current
    scrollRef.current.scrollLeft = scrollLeftRef.current - walkX
    const mainElem = scrollRef.current.closest('main')
    if (mainElem) {
      mainElem.scrollTop = scrollTopRef.current - walkY
    }
  }

  // Buscar estudiantes para agregar al tablero desde el modal
  useEffect(() => {
    if (!modalAgregarOpen || queryModal.trim().length < 2) {
      setEstudiantesResultados([])
      setCargandoResultados(false)
      return
    }
    let active = true
    setCargandoResultados(true)
    const timer = window.setTimeout(() => {
      void estudiantesApi.buscarAvanzado({ q: queryModal.trim(), size: 8 })
        .then((data) => { if (active) setEstudiantesResultados(data.content) })
        .catch(() => { if (active) setEstudiantesResultados([]) })
        .finally(() => { if (active) setCargandoResultados(false) })
    }, 220)
    return () => { active = false; window.clearTimeout(timer) }
  }, [modalAgregarOpen, queryModal])

  const agregarEstudianteSeleccionado = async () => {
    if (!estudianteSeleccionado) return
    setGuardandoAsignacion(true)
    try {
      await tableroApi.mover(estudianteSeleccionado.id, estadoSeleccionado)
      await cargar()
      setModalAgregarOpen(false)
      setEstudianteSeleccionado(null)
      setQueryModal('')
    } catch (e) {
      mostrarError(mensajeDeError(e, T.noSePudoMover))
    } finally {
      setGuardandoAsignacion(false)
    }
  }

  const columnaDe = (estado: EstadoContacto) =>
    tablero?.columnas.find((c) => c.estado === estado)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{T.titulo}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{T.descripcion}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={() => setModalAgregarOpen(true)} className="gap-1.5 shadow-sm">
            <UserPlus className="size-4" /> {T.agregarEstudiante}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void cargar()} disabled={cargando}>
            <ArrowsClockwise className="size-3.5" /> {C.refrescar}
          </Button>
        </div>
      </div>

      {!cargando && !error && tablero && tablero.totalEstudiantes > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">{T.totalEstudiantes(tablero.totalEstudiantes)}</p>
          <div className="relative w-full max-w-xs">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filtroTablero}
              onChange={(e) => setFiltroTablero(e.target.value)}
              placeholder={T.buscarEnTablero}
              className="h-8 rounded-xl bg-background pl-8 text-xs shadow-none"
            />
            {filtroTablero && (
              <button
                type="button"
                onClick={() => setFiltroTablero('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {cargando && (
        <div className="flex items-center justify-center py-20">
          <PageSpinner />
          <span className="ml-2 text-sm text-muted-foreground">{T.cargando}</span>
        </div>
      )}

      {error && !cargando && (
        <div className="flex flex-col items-center gap-3 py-12">
          <WarningCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void cargar()}>
            <ArrowsClockwise className="size-4" /> {C.reintentar}
          </Button>
        </div>
      )}

      {!cargando && !error && tablero && (
        tablero.totalEstudiantes === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex flex-col items-center py-14 text-center">
              <p className="text-sm text-muted-foreground">{T.sinEstudiantes}</p>
              <Button variant="outline" size="sm" onClick={() => setModalAgregarOpen(true)} className="mt-4 gap-1.5">
                <UserPlus className="size-4 text-primary" /> {T.agregarEstudiante}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className={`flex gap-4 overflow-x-auto pb-6 pt-1 select-none ${
              isDraggingBoard ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {ESTADOS.map((estado) => {
              const columna = columnaDe(estado)
              let tarjetas = columna?.tarjetas ?? []
              if (filtroTablero.trim()) {
                const q = filtroTablero.trim().toLowerCase()
                tarjetas = tarjetas.filter((t) => t.nombre.toLowerCase().includes(q))
              }
              const isOver = dragOverEstado === estado

              return (
                <section
                  key={estado}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDragEnter={() => setDragOverEstado(estado)}
                  onDragLeave={() => setDragOverEstado(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOverEstado(null)
                    const id = e.dataTransfer.getData('text/plain') || draggedStudentId
                    if (id) void mover(id, estado)
                    setDraggedStudentId(null)
                  }}
                  ref={estado === estadoPedido ? columnaDestacada : undefined}
                  className={`flex w-72 shrink-0 flex-col gap-3 rounded-2xl border p-2 transition-all ${
                    isOver
                      ? 'border-primary/50 bg-primary/[0.04] ring-2 ring-primary/30'
                      : estado === estadoPedido
                        ? 'border-primary/40 bg-primary/[0.03]'
                        : 'border-transparent bg-secondary/10 dark:bg-secondary/5'
                  }`}
                >
                  <header className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
                    <span className={`size-2 shrink-0 rounded-full ${COLOR_ESTADO[estado]}`} />
                    <span className="text-sm font-semibold text-foreground">{etiquetaEstado(T, estado)}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">{columna?.total ?? 0}</span>
                  </header>

                  {(columna?.necesitanAtencion ?? 0) > 0 && (
                    <p className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      <Clock className="size-3" /> {T.necesitanAtencion(columna!.necesitanAtencion)}
                    </p>
                  )}

                  {tarjetas.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border/80 px-3 py-8 text-center text-xs text-muted-foreground">
                      {T.columnaVacia}
                    </p>
                  ) : tarjetas.map((tarjeta) => {
                    const alerta = tarjeta.diasSinContacto == null || tarjeta.diasSinContacto >= DIAS_PARA_ALERTAR
                    const isBeingDragged = draggedStudentId === tarjeta.estudianteId

                    return (
                      <article
                        key={tarjeta.estudianteId}
                        draggable={moviendo === null}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', tarjeta.estudianteId)
                          e.dataTransfer.effectAllowed = 'move'
                          setDraggedStudentId(tarjeta.estudianteId)
                        }}
                        onDragEnd={() => setDraggedStudentId(null)}
                        className={`flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md ${
                          alerta ? 'border-amber-500/40' : 'border-border'
                        } ${moviendo === tarjeta.estudianteId || isBeingDragged ? 'opacity-40 scale-95' : 'opacity-100'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/estudiantes/${tarjeta.estudianteId}`}
                            className="text-sm font-semibold text-foreground hover:text-primary hover:underline"
                          >
                            {tarjeta.nombre}
                          </Link>
                          <span className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground" title="Arrastrar tarjeta">
                            ⋮⋮
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">{etiquetaEtapa(T, tarjeta.etapa)}</Badge>
                          <span className="text-[10px] tabular-nums text-muted-foreground">{tarjeta.porcentajeAvance}%</span>
                        </div>

                        <p className={`flex items-center gap-1.5 text-[11px] ${alerta ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                          <Clock className="size-3 shrink-0" />
                          {tarjeta.diasSinContacto == null
                            ? T.sinContactoNunca
                            : tarjeta.diasSinContacto === 0
                              ? T.contactadoHoy
                              : T.diasSinContacto(tarjeta.diasSinContacto)}
                        </p>

                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><User className="size-3" />{T.postulacionesX(tarjeta.postulaciones)}</span>
                          <span className="flex items-center gap-1"><ChatCircle className="size-3" />{T.accionesX(tarjeta.accionesSeguimiento)}</span>
                        </p>

                        {tarjeta.proximaAccion && (
                          <p className="text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">{T.proximaAccion}: </span>
                            {tarjeta.proximaAccion}
                          </p>
                        )}

                        <label className="mt-1">
                          <span className="sr-only">{T.moverA}</span>
                          <select
                            aria-label={T.moverA}
                            value={tarjeta.estadoContacto}
                            disabled={moviendo !== null}
                            onChange={(e) => void mover(tarjeta.estudianteId, e.target.value as EstadoContacto, tarjeta.estadoContacto)}
                            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs transition-colors hover:border-primary/40 focus:border-primary"
                          >
                            {ESTADOS.map((e) => (
                              <option key={e} value={e}>{etiquetaEstado(T, e)}</option>
                            ))}
                          </select>
                        </label>
                      </article>
                    )
                  })}
                </section>
              )
            })}
          </div>
        )
      )}

      {/* Modal para Agregar/Buscar Estudiante al Tablero */}
      {modalAgregarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-popover p-6 shadow-2xl dark:bg-[#0c1714]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">{T.modalTitulo}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{T.modalSubtitulo}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalAgregarOpen(false)
                  setEstudianteSeleccionado(null)
                  setQueryModal('')
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="relative">
                <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={queryModal}
                  onChange={(e) => setQueryModal(e.target.value)}
                  placeholder={T.buscarEstudianteInput}
                  className="pl-9 text-xs"
                />
              </div>

              {queryModal.trim().length >= 2 && (
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 p-1">
                  {cargandoResultados ? (
                    <p className="p-3 text-center text-xs text-muted-foreground">{T.buscando}</p>
                  ) : estudiantesResultados.length === 0 ? (
                    <p className="p-3 text-center text-xs text-muted-foreground">{T.sinResultados}</p>
                  ) : (
                    estudiantesResultados.map((est) => {
                      const seleccionado = estudianteSeleccionado?.id === est.id
                      return (
                        <button
                          key={est.id}
                          type="button"
                          onClick={() => setEstudianteSeleccionado(est)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                            seleccionado
                              ? 'border border-primary/40 bg-primary/10 text-primary font-medium'
                              : 'hover:bg-muted/50 text-foreground'
                          }`}
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {`${est.nombre[0] ?? ''}${est.apellido[0] ?? ''}`.toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold">{est.nombre} {est.apellido}</p>
                            <p className="truncate text-[11px] opacity-75">{est.email}</p>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}

              {estudianteSeleccionado && (
                <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs font-medium text-foreground">
                    Estudiante seleccionado: <span className="font-bold">{estudianteSeleccionado.nombre} {estudianteSeleccionado.apellido}</span>
                  </p>
                  <div>
                    <label htmlFor="select-estado-modal" className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      {T.seleccionarEstado}
                    </label>
                    <select
                      id="select-estado-modal"
                      value={estadoSeleccionado}
                      onChange={(e) => setEstadoSeleccionado(e.target.value as EstadoContacto)}
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs"
                    >
                      {ESTADOS.map((e) => (
                        <option key={e} value={e}>{etiquetaEstado(T, e)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setModalAgregarOpen(false)
                  setEstudianteSeleccionado(null)
                  setQueryModal('')
                }}
              >
                {C.cancelar}
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={!estudianteSeleccionado || guardandoAsignacion}
                onClick={() => void agregarEstudianteSeleccionado()}
              >
                {guardandoAsignacion ? T.asignando : T.asignar}
              </Button>
            </div>
          </div>
        </div>
      )}

      {avisos}
    </div>
  )
}

