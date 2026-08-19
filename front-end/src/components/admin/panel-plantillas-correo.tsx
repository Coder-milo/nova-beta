'use client'

/**
 * Catálogo y Editor Unificado de Plantillas de Correo (NOVA-CRM).
 *
 * Unifica la gestión de:
 * 1. Correos del Sistema (Transaccionales): Activación, Recuperación, Citación de Entrevista, Asignación de Vacante, Anuncios, Recordatorios HV.
 * 2. Convocatorias y Comunicaciones Masivas para participantes.
 *
 * Características principales:
 * - Filtros por pestañas (Todas, Sistema, Masivas).
 * - Editor enriquecido (`EditorTexto`) con inserción de variables categorizadas y bloques modulares HTML.
 * - Previsualización interactiva responsive (`PanelVistaPreviaEmail`) con alternador 600px / 375px y perfiles de simulación.
 * - Restablecimiento de valores iniciales de fábrica para plantillas del sistema.
 * - Despacho de correos de prueba directos (`ModalEnvioPrueba`).
 * - Simulación de seguridad y envío masivo a cohortes de estudiantes.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CircleAlert as WarningCircle,
  Eye,
  History,
  Layers,
  LayoutTemplate,
  LoaderCircle as CircleNotch,
  Mail as EnvelopeSimple,
  Plus,
  RotateCcw,
  Send as PaperPlaneTilt,
  ShieldCheck,
  Sparkles,
  Trash2 as Trash,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EditorTexto } from '@/components/ui/editor-texto'
import { PanelVistaPreviaEmail } from '@/components/admin/panel-vista-previa-email'
import { ModalEnvioPrueba } from '@/components/admin/modal-envio-prueba'
import { SelectorAudiencia, type AudienciaSeleccionada } from '@/components/admin/selector-audiencia'
import { plantillasCorreoApi, programasApi, mensajeDeError } from '@/lib/api'
import { useAvisos } from '@/components/ui/avisos'
import { useConfirmar } from '@/components/ui/confirmar'
import { useAuth } from '@/lib/auth'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'
import { cn } from '@/lib/utils'
import type {
  CategoriaPlantilla,
  PlantillaCorreo,
  PlantillaCorreoRequest,
  PlantillaDefecto,
  PrevisualizacionCorreo,
  ProgramaResponse,
  ResumenEnvioCorreo,
  VariableDisponible,
} from '@/lib/types'

type TabCatalogo = 'todas' | 'sistema' | 'masivo'
type TabEditor = 'editor' | 'previa'

const vacia: PlantillaCorreoRequest = {
  nombre: '',
  descripcion: '',
  asunto: '',
  cuerpo: '',
  botonTexto: '',
  botonUrl: '',
  activa: true,
  categoria: 'MASIVO',
  tipo: null,
}

/** Textos propios de esta pantalla, en los dos idiomas. */
function textos(english: boolean) {
  return english
    ? {
        titulo: 'Email Template Hub & Preview',
        descripcion: 'Manage transactional system emails and broadcast campaigns with rich visual editing, modular blocks, responsive previews, and test dispatch.',
        todasLasPlantillas: 'All Templates',
        correosDelSistema: 'System Transactional',
        convocatoriasYMasivos: 'Broadcast Campaigns',
        nuevaPlantilla: 'New Template',
        sinPlantillas: 'No templates registered in this category.',
        nombre: 'Template Name',
        descripcionCampo: 'Description / Purpose',
        asunto: 'Subject',
        cuerpo: 'Email Body',
        botonTexto: 'Button Text (CTA)',
        botonUrl: 'Button Link (URL)',
        activa: 'Active',
        categoria: 'Category',
        tipoTransaccional: 'System Email Type',
        variablesDisponibles: 'Dynamic variables available',
        insertarEnAsunto: 'Insert variable into subject',
        previsualizar: 'Responsive Preview',
        vistaPrevia: 'Live Preview',
        pestañaEditor: 'Template Editor',
        pestañaPrevia: 'Interactive Preview (600px / 375px)',
        avisosPrevios: 'Pre-send warnings',
        simular: 'Dry Run Simulation',
        enviarDeVerdad: 'Confirm & Send Broadcast',
        enviarPruebaDirecta: 'Send Test Email',
        restablecerDefecto: 'Factory Reset',
        confirmarRestablecer: 'Restore Factory Defaults?',
        confirmarRestablecerDetalle: (n: string) => `Subject, body and buttons of “${n}” will be replaced with institutional system defaults.`,
        confirmarEnvio: 'Confirm email broadcast?',
        confirmarEnvioDetalle: (n: number) => `Email will be delivered to ${n} participant(s). This action cannot be undone.`,
        resultadoEnvio: 'Broadcast Results',
        destinatarios: 'Recipients',
        enviados: 'Sent',
        bloqueados: 'Filtered by whitelist',
        fallidos: 'Failed',
        sinCorreo: 'Missing email',
        fueSimulacion: 'Simulation completed: zero emails were sent.',
        listaDePruebas: 'Test filter active: only authorized addresses received emails.',
        canal: 'Channel',
        elNombreEs: 'Template name, subject and body are required.',
        noSePudoCargar: 'The templates could not be loaded.',
        noSePudoGuardar: 'The template could not be saved.',
        noSePudoPrevisualizar: 'The preview could not be generated.',
        noSePudoEnviar: 'The email could not be sent.',
        noSePudoEliminar: 'The template could not be deleted.',
        noSePudoRestablecer: 'Could not restore default template.',
        eliminarPlantilla: 'Delete template',
        seEliminara: (n: string) => `Template “${n}” will be deleted. This action cannot be undone.`,
        plantillaGuardada: 'Template saved.',
        plantillaRestablecida: 'Template restored to factory default.',
        simulaPrimero: 'Run a simulation first to inspect recipient count before broadcast.',
        guardaAntesDeEnviar: 'Save changes before broadcasting.',
        previaDeLoNoGuardado: 'Showing unsaved draft preview. Save changes before final send.',
        sistemaBadge: 'SYSTEM',
        masivoBadge: 'CAMPAIGN',
        personalizarPorDefecto: 'Customize System Email',
      }
    : {
        titulo: 'Gestión y Editor de Plantillas de Correo',
        descripcion: 'Diseña, personaliza y previsualiza correos transaccionales del sistema y comunicados masivos con bloques modulares y vista responsive.',
        todasLasPlantillas: 'Todas las plantillas',
        correosDelSistema: 'Correos del Sistema (Transaccionales)',
        convocatoriasYMasivos: 'Convocatorias y Masivos',
        nuevaPlantilla: 'Nueva plantilla',
        sinPlantillas: 'No hay plantillas registradas en esta categoría.',
        nombre: 'Nombre de la plantilla',
        descripcionCampo: 'Descripción del propósito',
        asunto: 'Asunto del correo',
        cuerpo: 'Cuerpo del mensaje',
        botonTexto: 'Texto del botón (CTA)',
        botonUrl: 'Enlace del botón (URL)',
        activa: 'Activa',
        categoria: 'Categoría',
        tipoTransaccional: 'Tipo de correo del sistema',
        variablesDisponibles: 'Variables dinámicas disponibles',
        insertarEnAsunto: 'Insertar variable en asunto',
        previsualizar: 'Vista Previa Responsive',
        vistaPrevia: 'Vista previa en tiempo real',
        pestañaEditor: 'Editor de plantilla',
        pestañaPrevia: 'Vista previa interactiva (600px / 375px)',
        avisosPrevios: 'Avisos antes de enviar',
        simular: 'Simular envío',
        enviarDeVerdad: 'Confirmar y enviar',
        enviarPruebaDirecta: 'Enviar correo de prueba',
        restablecerDefecto: 'Restablecer valores iniciales',
        confirmarRestablecer: '¿Restablecer valores iniciales del sistema?',
        confirmarRestablecerDetalle: (n: string) => `El asunto, cuerpo y botón de «${n}» se reemplazarán por el formato predeterminado del sistema.`,
        confirmarEnvio: '¿Confirmar el envío masivo de correos?',
        confirmarEnvioDetalle: (n: number) => `Se enviará el correo a ${n} participante(s). Esta acción no se puede deshacer.`,
        resultadoEnvio: 'Resultado del envío',
        destinatarios: 'Destinatarios',
        enviados: 'Enviados',
        bloqueados: 'Bloqueados por filtro de pruebas',
        fallidos: 'Fallidos',
        sinCorreo: 'Sin correo en la ficha',
        fueSimulacion: 'Simulación completada: ningún correo fue enviado.',
        listaDePruebas: 'Filtro de pruebas activo: los correos se envían exclusivamente a destinatarios autorizados.',
        canal: 'Canal',
        elNombreEs: 'El nombre, el asunto y el cuerpo son obligatorios.',
        noSePudoCargar: 'No se pudieron cargar las plantillas.',
        noSePudoGuardar: 'No se pudo guardar la plantilla.',
        noSePudoPrevisualizar: 'No se pudo generar la vista previa.',
        noSePudoEnviar: 'No se pudo enviar el correo.',
        noSePudoEliminar: 'No se pudo eliminar la plantilla.',
        noSePudoRestablecer: 'No se pudo restablecer la plantilla a sus valores por defecto.',
        eliminarPlantilla: 'Eliminar plantilla',
        seEliminara: (n: string) => `Se eliminará la plantilla «${n}». Esta acción no se puede deshacer.`,
        plantillaGuardada: 'Plantilla guardada.',
        plantillaRestablecida: 'Plantilla restablecida a sus valores de fábrica.',
        simulaPrimero: 'Realiza una simulación para verificar los destinatarios antes del envío.',
        guardaAntesDeEnviar: 'Guarda los cambios para que se reflejen en el envío masivo.',
        previaDeLoNoGuardado: 'Esta vista previa muestra la edición actual. Guarda los cambios antes de enviar.',
        sistemaBadge: 'SISTEMA',
        masivoBadge: 'MASIVO',
        personalizarPorDefecto: 'Personalizar correo del sistema',
      }
}

export function PanelPlantillasCorreo() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const { mostrarError, avisos } = useAvisos()
  const { user } = useAuth()
  const puedeEliminar = user?.roles?.includes('ADMIN') ?? false
  const { confirmar, dialogo } = useConfirmar()

  const [tabActiva, setTabActiva] = useState<TabCatalogo>('todas')
  const [tabEditorActiva, setTabEditorActiva] = useState<TabEditor>('editor')

  const [plantillas, setPlantillas] = useState<PlantillaCorreo[]>([])
  const [defaultsSistema, setDefaultsSistema] = useState<PlantillaDefecto[]>([])
  const [variables, setVariables] = useState<VariableDisponible[]>([])
  const [programas, setProgramas] = useState<ProgramaResponse[]>([])
  const [audienciaEnvio, setAudienciaEnvio] = useState<AudienciaSeleccionada>({
    tipo: 'TODOS',
    estudianteIds: [],
    estudiantes: [],
  })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<PlantillaCorreoRequest>(vacia)
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [restableciendo, setRestableciendo] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [previaServidor, setPreviaServidor] = useState<PrevisualizacionCorreo | null>(null)
  const [previsualizando, setPrevisualizando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resumen, setResumen] = useState<ResumenEnvioCorreo | null>(null)
  const [simuladoPara, setSimuladoPara] = useState<string | null>(null)
  const [guardado, setGuardado] = useState<string>('')

  const [modalPruebaAbierto, setModalPruebaAbierto] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [lista, vars, defaults, progs] = await Promise.all([
        plantillasCorreoApi.listar(),
        plantillasCorreoApi.variables(),
        plantillasCorreoApi.obtenerDefaults().catch(() => []),
        programasApi.listar().catch(() => []),
      ])
      setPlantillas(lista)
      setVariables(vars)
      setDefaultsSistema(defaults)
      setProgramas(progs)
    } catch (e) {
      setError(mensajeDeError(e, T.noSePudoCargar))
    } finally {
      setCargando(false)
    }
  }, [T.noSePudoCargar])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Plantillas filtradas por tab
  const plantillasFiltradas = useMemo(() => {
    if (tabActiva === 'sistema') {
      return plantillas.filter(
        (p) => p.categoria === 'SISTEMA' || p.esSistema || !!p.tipo || defaultsSistema.some((d) => d.nombre === p.nombre),
      )
    }
    if (tabActiva === 'masivo') {
      return plantillas.filter(
        (p) => p.categoria !== 'SISTEMA' && !p.esSistema && !p.tipo && !defaultsSistema.some((d) => d.nombre === p.nombre),
      )
    }
    return plantillas
  }, [plantillas, tabActiva, defaultsSistema])

  // Plantillas del sistema no configuradas aún
  const defaultsNoCreados = useMemo(() => {
    if (tabActiva === 'masivo') return []
    return defaultsSistema.filter(
      (def) => !plantillas.some((p) => p.nombre.toLowerCase() === def.nombre.toLowerCase() || p.tipo === def.tipo),
    )
  }, [defaultsSistema, plantillas, tabActiva])

  const abrirNueva = (categoria: CategoriaPlantilla = 'MASIVO') => {
    setEditandoId(null)
    const nueva = { ...vacia, categoria }
    setForm(nueva)
    setFormError(null)
    setGuardado(JSON.stringify(nueva))
    setPreviaServidor(null)
    setResumen(null)
    setSimuladoPara(null)
    setTabEditorActiva('editor')
    setAbierto(true)
  }

  const abrirDesdeDefault = (def: PlantillaDefecto) => {
    setEditandoId(null)
    const cargado: PlantillaCorreoRequest = {
      nombre: def.nombre,
      descripcion: def.descripcion,
      asunto: def.asunto,
      cuerpo: def.cuerpo,
      botonTexto: def.botonTexto || '',
      botonUrl: def.botonUrl || '',
      activa: true,
      categoria: 'SISTEMA',
      tipo: def.tipo,
    }
    setForm(cargado)
    setFormError(null)
    setGuardado(JSON.stringify(cargado))
    setPreviaServidor(null)
    setResumen(null)
    setSimuladoPara(null)
    setTabEditorActiva('editor')
    setAbierto(true)
  }

  const abrirEdicion = (p: PlantillaCorreo) => {
    setEditandoId(p.id)
    const esDeSistema =
      p.categoria === 'SISTEMA' || p.esSistema || !!p.tipo || defaultsSistema.some((d) => d.nombre === p.nombre)
    const cargado: PlantillaCorreoRequest = {
      programaId: p.programaId,
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      asunto: p.asunto,
      cuerpo: p.cuerpo,
      botonTexto: p.botonTexto ?? '',
      botonUrl: p.botonUrl ?? '',
      rolMinimo: p.rolMinimo,
      activa: p.activa,
      categoria: esDeSistema ? 'SISTEMA' : 'MASIVO',
      tipo: p.tipo ?? (defaultsSistema.find((d) => d.nombre === p.nombre)?.tipo || null),
    }
    setForm(cargado)
    setGuardado(JSON.stringify(cargado))
    setFormError(null)
    setPreviaServidor(null)
    setResumen(null)
    setSimuladoPara(null)
    setTabEditorActiva('editor')
    setAbierto(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim() || !form.asunto.trim() || !form.cuerpo.trim()) {
      setFormError(T.elNombreEs)
      return
    }
    setGuardando(true)
    setFormError(null)
    try {
      const guardada = editandoId
        ? await plantillasCorreoApi.actualizar(editandoId, form)
        : await plantillasCorreoApi.crear(form)
      setEditandoId(guardada.id)
      setGuardado(JSON.stringify(form))
      setSimuladoPara(null)
      await cargar()
    } catch (e) {
      setFormError(mensajeDeError(e, T.noSePudoGuardar))
    } finally {
      setGuardando(false)
    }
  }

  const restablecerValoresFabrica = async () => {
    if (!form.nombre) return
    const confirmado = await confirmar({
      titulo: T.confirmarRestablecer,
      descripcion: T.confirmarRestablecerDetalle(form.nombre),
      textoConfirmar: T.restablecerDefecto,
      destructivo: true,
    })
    if (!confirmado) return

    setRestableciendo(true)
    try {
      if (editandoId) {
        const restaurada = await plantillasCorreoApi.restaurarDefecto(editandoId, form.tipo ?? undefined)
        abrirEdicion(restaurada)
      } else {
        // Si no está guardada aún, buscar en defaultsSistema
        const def = defaultsSistema.find((d) => d.tipo === form.tipo || d.nombre === form.nombre)
        if (def) {
          setForm((f) => ({
            ...f,
            asunto: def.asunto,
            cuerpo: def.cuerpo,
            botonTexto: def.botonTexto || '',
            botonUrl: def.botonUrl || '',
          }))
        }
      }
    } catch (e) {
      mostrarError(mensajeDeError(e, T.noSePudoRestablecer))
    } finally {
      setRestableciendo(false)
    }
  }

  const previsualizarServidor = async () => {
    setPrevisualizando(true)
    try {
      setPreviaServidor(await plantillasCorreoApi.previsualizar(form))
      setTabEditorActiva('previa')
    } catch (e) {
      mostrarError(mensajeDeError(e, T.noSePudoPrevisualizar))
    } finally {
      setPrevisualizando(false)
    }
  }

  const hayCambiosSinGuardar = JSON.stringify(form) !== guardado
  const esPlantillaSistema = form.categoria === 'SISTEMA' || !!form.tipo

  const enviarMasivo = async (simulacion: boolean) => {
    if (hayCambiosSinGuardar) return
    if (!editandoId) return
    if (!simulacion) {
      if (simuladoPara !== editandoId || !resumen) return
      if (
        !(await confirmar({
          titulo: T.confirmarEnvio,
          descripcion: T.confirmarEnvioDetalle(resumen.destinatarios),
          textoConfirmar: T.enviarDeVerdad,
          destructivo: true,
        }))
      )
        return
    }
    setEnviando(true)
    try {
      const nuevo = await plantillasCorreoApi.enviar(editandoId, {
        simulacion,
        programaId: audienciaEnvio.programaId,
        cohorte: audienciaEnvio.cohorte,
        estudianteIds: audienciaEnvio.estudianteIds.length > 0 ? audienciaEnvio.estudianteIds : undefined,
      })
      setResumen(nuevo)
      setSimuladoPara(simulacion ? editandoId : null)
    } catch (e) {
      mostrarError(mensajeDeError(e, T.noSePudoEnviar))
    } finally {
      setEnviando(false)
    }
  }

  const eliminar = async (p: PlantillaCorreo) => {
    if (
      !(await confirmar({
        titulo: T.eliminarPlantilla,
        descripcion: T.seEliminara(p.nombre),
        textoConfirmar: C.eliminar,
        destructivo: true,
      }))
    )
      return
    try {
      await plantillasCorreoApi.eliminar(p.id)
      if (editandoId === p.id) {
        setAbierto(false)
        setEditandoId(null)
      }
      await cargar()
    } catch (e) {
      mostrarError(mensajeDeError(e, T.noSePudoEliminar))
    }
  }

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <EnvelopeSimple className="size-4 text-primary" /> {T.titulo}
        </CardTitle>
        <CardDescription>{T.descripcion}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Pestañas de filtrado del catálogo */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setTabActiva('todas')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                tabActiva === 'todas'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {T.todasLasPlantillas} ({plantillas.length})
            </button>
            <button
              type="button"
              onClick={() => setTabActiva('sistema')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                tabActiva === 'sistema'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <ShieldCheck className="size-3.5 text-primary" />
              {T.correosDelSistema}
            </button>
            <button
              type="button"
              onClick={() => setTabActiva('masivo')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                tabActiva === 'masivo'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Layers className="size-3.5 text-muted-foreground" />
              {T.convocatoriasYMasivos}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => abrirNueva('MASIVO')} disabled={cargando} className="cursor-pointer">
              <Plus className="size-4" /> {T.nuevaPlantilla}
            </Button>
          </div>
        </div>

        {/* Listado de Plantillas */}
        {!cargando && plantillasFiltradas.length === 0 && defaultsNoCreados.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {T.sinPlantillas}
          </p>
        )}

        {(plantillasFiltradas.length > 0 || defaultsNoCreados.length > 0) && (
          <div className="divide-y divide-border rounded-xl border border-border">
            {/* Plantillas Guardadas */}
            {plantillasFiltradas.map((p) => {
              const esSistemaItem =
                p.categoria === 'SISTEMA' ||
                p.esSistema ||
                !!p.tipo ||
                defaultsSistema.some((d) => d.nombre === p.nombre)
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-muted/10 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{p.nombre}</p>
                      {esSistemaItem ? (
                        <Badge variant="secondary" className="text-[10px] font-semibold text-primary">
                          {T.sistemaBadge}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          {T.masivoBadge}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{p.asunto}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!p.activa && <Badge variant="outline" className="text-[10px]">{C.inactivo}</Badge>}
                    <Button variant="outline" size="sm" onClick={() => abrirEdicion(p)} className="cursor-pointer">
                      {C.editar}
                    </Button>
                    {puedeEliminar && !esSistemaItem && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void eliminar(p)}
                        aria-label={`${C.eliminar} ${p.nombre}`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                      >
                        <Trash className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Plantillas del Sistema Disponibles por Defecto (aún no guardadas en BD) */}
            {defaultsNoCreados.map((def) => (
              <div
                key={def.tipo}
                className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/15 hover:bg-muted/25 transition-colors border-l-4 border-l-primary/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{def.nombre}</p>
                    <Badge variant="secondary" className="text-[10px] font-semibold text-primary">
                      {T.sistemaBadge}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] text-muted-foreground font-mono">
                      Fábrica
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{def.descripcion || def.asunto}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => abrirDesdeDefault(def)}
                  className="text-primary hover:bg-primary/10 cursor-pointer"
                >
                  <Sparkles className="size-3.5 mr-1" />
                  {T.personalizarPorDefecto}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Sección de Edición y Vista Previa */}
        {abierto && (
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            {formError && <p className="text-sm text-destructive">{formError}</p>}

            {/* Selector de sub-pestañas: Editor vs Vista Previa */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setTabEditorActiva('editor')}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                    tabEditorActiva === 'editor'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {T.pestañaEditor}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTabEditorActiva('previa')
                  }}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                    tabEditorActiva === 'previa'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Eye className="size-3.5 text-primary" />
                  {T.pestañaPrevia}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Botón Restablecer Fábrica (solo para plantillas del sistema) */}
                {esPlantillaSistema && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void restablecerValoresFabrica()}
                    disabled={restableciendo}
                    className="text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                    title={T.restablecerDefecto}
                  >
                    <RotateCcw className={cn('size-3.5 mr-1', restableciendo && 'animate-spin')} />
                    {T.restablecerDefecto}
                  </Button>
                )}

                {/* Botón Envío de Prueba Directo */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalPruebaAbierto(true)}
                  className="cursor-pointer"
                >
                  <PaperPlaneTilt className="size-3.5 mr-1" />
                  {T.enviarPruebaDirecta}
                </Button>
              </div>
            </div>

            {/* Modo 1: Editor Visual Enriquecido */}
            {tabEditorActiva === 'editor' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-foreground">{T.nombre}</span>
                  <Input
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-foreground">{T.descripcionCampo}</span>
                  <Input
                    value={form.descripcion ?? ''}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  />
                </label>

                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{T.asunto}</span>
                    {/* Botones rápidos de variables en asunto */}
                    {variables.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">{T.insertarEnAsunto}:</span>
                        {variables.slice(0, 4).map((v) => (
                          <button
                            key={v.clave}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, asunto: `${f.asunto} ${v.marca}`.trim() }))}
                            className="font-mono text-[10px] text-primary hover:underline"
                          >
                            {v.marca}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input
                    value={form.asunto}
                    onChange={(e) => setForm({ ...form, asunto: e.target.value })}
                    maxLength={160}
                  />
                </div>

                {/* Editor Enriquecido Quill con Caret Insertion y Bloques Modulares */}
                <div className="space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-medium text-foreground">{T.cuerpo}</span>
                  <EditorTexto
                    value={form.cuerpo}
                    onChange={(cuerpo) => setForm({ ...form, cuerpo })}
                    variables={variables}
                    mostrarBloques={true}
                    minHeight="16rem"
                  />
                </div>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-foreground">{T.botonTexto}</span>
                  <Input
                    value={form.botonTexto ?? ''}
                    onChange={(e) => setForm({ ...form, botonTexto: e.target.value })}
                    placeholder="ej. Confirmar Asistencia"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-foreground">{T.botonUrl}</span>
                  <Input
                    type="url"
                    value={form.botonUrl ?? ''}
                    onChange={(e) => setForm({ ...form, botonUrl: e.target.value })}
                    placeholder="https://…"
                  />
                </label>

                <label className="flex items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border"
                    checked={form.activa ?? true}
                    onChange={(e) => setForm({ ...form, activa: e.target.checked })}
                  />
                  <span className="text-xs font-medium text-foreground">{T.activa}</span>
                </label>

                {/* Selección de Audiencia de Envío */}
                {!esPlantillaSistema && (
                  <div className="sm:col-span-2 pt-2 border-t border-border">
                    <span className="text-xs font-semibold text-foreground mb-2 block">
                      Audiencia de Destino para Envío / Simulación Masiva
                    </span>
                    <SelectorAudiencia
                      programas={programas}
                      valorInicial={audienciaEnvio}
                      onChange={setAudienciaEnvio}
                      mostrarCohortes={true}
                    />
                  </div>
                )}
              </div>
            ) : (
              // Modo 2: Vista Previa Responsive Interactiva
              <PanelVistaPreviaEmail
                asunto={form.asunto}
                cuerpo={form.cuerpo}
                botonTexto={form.botonTexto}
                botonUrl={form.botonUrl}
                programaId={form.programaId}
                htmlServidor={previaServidor?.html}
                avisos={previaServidor?.avisos}
              />
            )}

            {/* Barra de Acciones y Envío */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void guardar()} disabled={guardando} className="cursor-pointer">
                  {guardando ? <CircleNotch className="size-4 animate-spin" /> : null} {C.guardar}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void previsualizarServidor()}
                  disabled={previsualizando}
                  className="cursor-pointer"
                >
                  <Eye className="size-3.5" /> {T.previsualizar}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void enviarMasivo(true)}
                  disabled={enviando || !editandoId || hayCambiosSinGuardar}
                  title={hayCambiosSinGuardar ? T.guardaAntesDeEnviar : undefined}
                  className="cursor-pointer"
                >
                  <PaperPlaneTilt className="size-3.5" /> {T.simular}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void enviarMasivo(false)}
                  disabled={enviando || hayCambiosSinGuardar || simuladoPara !== editandoId}
                  title={
                    hayCambiosSinGuardar
                      ? T.guardaAntesDeEnviar
                      : simuladoPara === editandoId
                        ? undefined
                        : T.simulaPrimero
                  }
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                >
                  <PaperPlaneTilt className="size-3.5" /> {T.enviarDeVerdad}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAbierto(false)} className="cursor-pointer">
                  {C.cerrar}
                </Button>
              </div>
            </div>

            {/* Telemetría y Resultado del Envío Masivo */}
            {resumen && (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
                <p className="text-xs font-semibold text-foreground">{T.resultadoEnvio}</p>
                {resumen.simulacion && (
                  <p className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-[11px] font-medium text-primary">
                    {T.fueSimulacion}
                  </p>
                )}
                {resumen.destinatariosPermitidos && resumen.destinatariosPermitidos.length > 0 && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-400">
                    {T.listaDePruebas} {resumen.destinatariosPermitidos.join(', ')}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                  {(
                    [
                      [T.destinatarios, resumen.destinatarios],
                      [T.enviados, resumen.enviados],
                      [T.bloqueados, resumen.bloqueadosPorLista],
                      [T.fallidos, resumen.fallidos],
                      [T.sinCorreo, resumen.sinCorreo],
                    ] as const
                  ).map(([rotulo, valor]) => (
                    <div key={rotulo} className="rounded-lg border border-border p-2">
                      <p className="text-base font-semibold tabular-nums text-foreground">{valor}</p>
                      <p className="text-[10px] text-muted-foreground">{rotulo}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {T.canal}: {resumen.canalDeCorreo}
                </p>
              </div>
            )}
          </section>
        )}

        {/* Modal de Envío de Prueba Directo */}
        {modalPruebaAbierto && (
          <ModalEnvioPrueba
            abierto={modalPruebaAbierto}
            onCerrar={() => setModalPruebaAbierto(false)}
            asunto={form.asunto}
            cuerpo={form.cuerpo}
            botonTexto={form.botonTexto}
            botonUrl={form.botonUrl}
            programaId={form.programaId}
          />
        )}
      </CardContent>
      {dialogo}
      {avisos}
    </Card>
  )
}
