'use client'

import { Briefcase, Building2 as Buildings, Calendar as CalendarBlank, CheckCircle2 as CheckCircle, ChevronLeft as CaretLeft, ChevronRight as CaretRight, CircleAlert as WarningCircle, CircleX as XCircle, DollarSign as CurrencyDollar, ExternalLink as ArrowSquareOut, Globe, Languages as Translate, Link as LinkSimple, LoaderCircle as CircleNotch, MapPin, Pencil as PencilSimple, Plus, RefreshCw as ArrowsClockwise, RotateCcw as ArrowCounterClockwise, Search as MagnifyingGlass, Trash2 as Trash } from 'lucide-react'
/**
 * Página de Vacantes y Matching.
 *
 * Consume:
 *   GET  /api/v1/vacantes?page=&size=  → lista paginada de vacantes activas
 *   GET  /api/v1/vacantes/{id}         → detalle de vacante
 *   POST /api/v1/vacantes/scraping     → escaneo de portales bajo demanda
 *   GET  /api/v1/vacantes/scraping/ejecuciones → registro de corridas
 *   POST /api/v1/matches/ejecutar      → matching estudiantes ↔ vacantes
 */

import { useState, useEffect, useCallback } from 'react'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VistasGuardadas } from '@/components/admin/vistas-guardadas'
import { PanelConectoresScraping } from '@/components/admin/panel-conectores-scraping'
import { RegistroDeScraping } from '@/components/admin/registro-de-scraping'
import { Badge } from '@/components/ui/badge'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { vacantesApi, matchesApi, ApiCallError, mensajeDeError } from '@/lib/api'
import type { VacanteRequest, VacanteResponse, MotivoCierre, Page } from '@/lib/types'
import { useAvisos } from '@/components/ui/avisos'
import { useConfirmar } from '@/components/ui/confirmar'
import { Textarea } from '@/components/ui/textarea'

type VacanteForm = {
  titulo: string
  empresaNombre: string
  ubicacion: string
  modalidadTrabajo: string
  tipoContrato: string
  jornada: string
  rangoSalarial: string
  nivelInglesRequerido: string
  aniosExperienciaRequeridos: string
  urlAplicar: string
  url: string
  fechaExpiracion: string
  descripcion: string
  requisitos: string
}

const formularioVacio: VacanteForm = {
  titulo: '', empresaNombre: '', ubicacion: '', modalidadTrabajo: 'Híbrido',
  tipoContrato: '', jornada: 'Tiempo completo', rangoSalarial: '', nivelInglesRequerido: '',
  aniosExperienciaRequeridos: '', urlAplicar: '', url: '', fechaExpiracion: '',
  descripcion: '', requisitos: '',
}

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        buscarPorTitulo: 'Search by title, company or location…',
        cargandoVacantes: 'Loading vacancies…',
        noHayVacantes: 'No vacancies recorded.',
        registrarVacante: 'Log a vacancy',
        escaneandoPortalesDe: 'Scanning job boards…',
        indicaElTitulo: 'Give the vacancy a title so it can be published.',
        noSePudo: 'Could not reach the backend to create the vacancy.',
        noSePudoX: 'The posting could not be validated.',
        sinPermisosPara: 'No permission to run matching.',
        sinPermisosParaX: 'No permission to scan vacancies.',
        sinPermisosInicia: 'No permission. Please sign in.',
        estaOfertaEsta: 'This posting has not been reviewed',
        sinRevisar: 'Not reviewed',
        filtrarPorFuente: 'Source',
        filtrarPorConvocatoria: 'Call / Segment',
        todasLasConvocatorias: 'Convocatorias: Todas',
        convocatoriasLocales: '📍 Locales (Atlántico)',
        convocatoriasRemotas: '🌐 Remotas (Inglés)',
        convocatoriasMigracion: '✈️ Con Visa',
        filtrarPorModalidad: 'Work mode',
        todasLasModalidades: 'Modalidad: Todas',
        todasLasFuentesLabel: 'Fuentes: Todas',
        filtrarPorRevision: 'Review status',
        todasLasRevisiones: 'Revisión: Todas',
        soloRevisadas: 'Verificadas',
        soloPendientes: 'Por revisar',
        limpiarFiltros: 'Clear filters',
        informacionPrincipal: 'Main details',
        informacionGeneral: 'General information',
        condicionesDeLa: 'Job conditions',
        descripcionYPublicacion: 'Description and posting',
        losDatosQue: 'What students will see when they find the opportunity.',
        estaInformacionHace: 'This information makes matching more accurate.',
        anadeDetallesPara: 'Add detail so the student understands the profile required.',
        losCamposSin: 'Fields without an asterisk are optional.',
        tituloDeLa: 'Vacancy title',
        nombreDeLa: 'Company name',
        empresaNoEspecificada: 'Company not specified',
        ciudadOUbicacion: 'City or location',
        rangoSalarial: 'Salary range',
        tipoDeContrato: 'Contract type',
        experienciaMinimaAnos: 'Minimum experience (years)',
        inglesRequerido: 'English required',
        nivelDeIngles: 'English level',
        enlaceDeReferencia: 'Reference link',
        fechaDeCierre: 'Closing date',
        vacanteCreadaCorrectamente: 'Vacancy created. It is now available for student matching.',
        matchingSinNuevos: 'Matching done: no new matches (pairs already scored are not repeated).',
        revisalosEnLa: 'Review them on each student’s Matches tab.',
        nuevaVacante: 'New vacancy',
        escanearYHacer: 'Scan and run matching',
        completaLosDatos: 'Fill in the essentials. The opportunity will be ready for matching and applications.',
        enlaceParaPostularse: 'Link to apply',
        laRegistroUn: 'It is not recommended to anyone until someone on the team confirms it is real. Check the company and the link before approving it.',
        origenParticipante: 'Added by a participant.',
        origenEmpresa: 'Published by the company from its portal.',
        origenPublico: 'Sent from the public form by someone with no account.',
        quienLaMando: 'Who sent it (unverified)',
        elContacto: 'Contact', elCorreo: 'Email',
        empresaSinVerificar: 'Company name as declared — it is not linked to any company in the CRM until someone links it.',
        darPorBuena: 'Approve it',
        verFuente: 'View source',
        noSePudoCrear: (s: number) => `The vacancy could not be created (HTTP ${s}).`,
        errorDelServidor: (s: number) => `Server error (HTTP ${s}).`,
        matchingCompletado: (n: number) => `Matching done: ${n} new match(es).`,
        vacantesNuevasEncontradas: (n: number) => `${n} new vacancy(ies) found. Running matching…`,
        escaneoCompletado: (v: number, m: number) => `Scan done: ${v} new vacancy(ies) · ${m} new match(es).`,
        aniosX: (n: number) => `${n} years`,
        noEspecificado: 'Not specified',
        ej2000: 'e.g. $2,000,000 - $2,500,000',
        ejAnalistaDe: 'e.g. Technical support analyst',
        noRequeridoB1: 'Not required, B1, B2…',
        terminoIndefinidoPrestacion: 'Permanent, services contract…',
        conocimientosHerramientasEstudios: 'Knowledge, tools, studies or certifications required…',
        responsabilidadesObjetivoDel: 'Responsibilities, purpose of the role and context…',
        tiempoCompleto: 'Full time',
        medioTiempo: 'Part time',
        porHoras: 'Hourly',
        practica: 'Internship',
        presencial: 'On site',
        remoto: 'Remote',
        hibrido: 'Hybrid',
        requisitos: 'Requirements',
        descripcion: 'Description',
        experiencia: 'Experience',
        jornada: 'Schedule',
        modalidad: 'Work mode',
        ubicacion: 'Location',
        fuente: 'Source',
        aplicar: 'Apply',
        vacanteActualizada: 'Vacancy updated.',
        corregirVacante: 'Correct the vacancy',
        guardarCambios: 'Save changes',
        cerrarOferta: 'Close it',
        reabrirOferta: 'Reopen it',
        eliminarVacante: 'Delete vacancy',
        motivoDelCierre: 'Reason for closing',
        yaCubierta: 'Already filled',
        expirada: 'Expired',
        retirada: 'Withdrawn',
        fueraDePerfil: 'No English required',
        ofertaCerrada: 'Closed',
        gestionDeLa: 'Posting management',
        cerrarLaConserva: 'Closing keeps its history; deleting removes it entirely. Close what was filled or expired; delete only what should never have been logged.',
        noSePudoCerrar: 'Could not close the vacancy.',
        noSePudoReabrir: 'The vacancy could not be reopened.',
        noSePudoEliminar: 'The vacancy could not be deleted.',
        seEliminaraVacante: (t: string) => `Vacancy “${t}” will be deleted. This cannot be undone.`,
        manual: 'Manual', opcional: 'optional',
      }
    : {
        buscarPorTitulo: 'Buscar por título, empresa o ubicación…',
        cargandoVacantes: 'Cargando vacantes…',
        noHayVacantes: 'No hay vacantes registradas.',
        registrarVacante: 'Registrar vacante',
        escaneandoPortalesDe: 'Escaneando portales de empleo…',
        indicaElTitulo: 'Indica el título de la vacante para poder publicarla.',
        noSePudo: 'No se pudo conectar con el backend para crear la vacante.',
        noSePudoX: 'No se pudo validar la oferta.',
        sinPermisosPara: 'Sin permisos para ejecutar el matching.',
        sinPermisosParaX: 'Sin permisos para escanear vacantes.',
        sinPermisosInicia: 'Sin permisos. Inicia sesión.',
        estaOfertaEsta: 'Esta oferta está sin revisar',
        sinRevisar: 'Sin revisar',
        filtrarPorFuente: 'Fuente',
        filtrarPorConvocatoria: 'Convocatoria',
        todasLasConvocatorias: 'Convocatorias: Todas',
        convocatoriasLocales: '📍 Locales (Atlántico)',
        convocatoriasRemotas: '🌐 Remotas (Inglés)',
        convocatoriasMigracion: '✈️ Con Visa',
        filtrarPorModalidad: 'Modalidad',
        todasLasModalidades: 'Modalidad: Todas',
        todasLasFuentesLabel: 'Fuentes: Todas',
        filtrarPorRevision: 'Revisión',
        todasLasRevisiones: 'Revisión: Todas',
        soloRevisadas: 'Solo verificadas',
        soloPendientes: 'Pendientes',
        limpiarFiltros: 'Limpiar filtros',
        informacionPrincipal: 'Información principal',
        informacionGeneral: 'Información General',
        condicionesDeLa: 'Condiciones de la oportunidad',
        descripcionYPublicacion: 'Descripción y publicación',
        losDatosQue: 'Los datos que verán los estudiantes al encontrar la oportunidad.',
        estaInformacionHace: 'Esta información hace más preciso el matching.',
        anadeDetallesPara: 'Añade detalles para que el estudiante entienda el perfil solicitado.',
        losCamposSin: 'Los campos sin asterisco son opcionales.',
        tituloDeLa: 'Título de la vacante',
        nombreDeLa: 'Nombre de la empresa',
        empresaNoEspecificada: 'Empresa no especificada',
        ciudadOUbicacion: 'Ciudad o ubicación',
        rangoSalarial: 'Rango salarial',
        tipoDeContrato: 'Tipo de contrato',
        experienciaMinimaAnos: 'Experiencia mínima (años)',
        inglesRequerido: 'Inglés requerido',
        nivelDeIngles: 'Nivel de inglés',
        enlaceDeReferencia: 'Enlace de referencia',
        fechaDeCierre: 'Fecha de cierre',
        vacanteCreadaCorrectamente: 'Vacante creada correctamente. Ya está disponible para el matching de estudiantes.',
        matchingSinNuevos: 'Matching completado: sin matches nuevos (los pares ya evaluados no se repiten).',
        revisalosEnLa: 'Revísalos en la pestaña Matches de cada estudiante.',
        nuevaVacante: 'Nueva vacante',
        escanearYHacer: 'Escanear y hacer matching',
        completaLosDatos: 'Completa los datos esenciales. La oportunidad quedará lista para el matching y las postulaciones.',
        enlaceParaPostularse: 'Enlace para postularse',
        laRegistroUn: 'No se le recomienda a nadie hasta que alguien del equipo compruebe que es real. Revisa la empresa y el enlace antes de validarla.',
        origenParticipante: 'La registró un participante.',
        origenEmpresa: 'La publicó la empresa desde su portal.',
        origenPublico: 'Llegó por el formulario público, de alguien sin cuenta.',
        quienLaMando: 'Quién la mandó (sin verificar)',
        elContacto: 'Contacto', elCorreo: 'Correo',
        empresaSinVerificar: 'El nombre es el que escribió quien la mandó. No está enlazada con ninguna empresa del CRM hasta que alguien la enlace.',
        darPorBuena: 'Dar por buena',
        verFuente: 'Ver fuente',
        noSePudoCrear: (s: number) => `No se pudo crear la vacante (HTTP ${s}).`,
        errorDelServidor: (s: number) => `Error del servidor (HTTP ${s}).`,
        matchingCompletado: (n: number) => `Matching completado: ${n} match(es) nuevos.`,
        vacantesNuevasEncontradas: (n: number) => `${n} vacante(s) nuevas encontradas. Ejecutando matching…`,
        escaneoCompletado: (v: number, m: number) => `Escaneo completado: ${v} vacante(s) nuevas · ${m} match(es) nuevos.`,
        aniosX: (n: number) => `${n} años`,
        noEspecificado: 'No especificado',
        ej2000: 'Ej. $2.000.000 - $2.500.000',
        ejAnalistaDe: 'Ej. Analista de soporte técnico',
        noRequeridoB1: 'No requerido, B1, B2…',
        terminoIndefinidoPrestacion: 'Término indefinido, prestación…',
        conocimientosHerramientasEstudios: 'Conocimientos, herramientas, estudios o certificaciones requeridas…',
        responsabilidadesObjetivoDel: 'Responsabilidades, objetivo del cargo y contexto de la oportunidad…',
        tiempoCompleto: 'Tiempo completo',
        medioTiempo: 'Medio tiempo',
        porHoras: 'Por horas',
        practica: 'Práctica',
        presencial: 'Presencial',
        remoto: 'Remoto',
        hibrido: 'Híbrido',
        requisitos: 'Requisitos',
        descripcion: 'Descripción',
        experiencia: 'Experiencia',
        jornada: 'Jornada',
        modalidad: 'Modalidad',
        ubicacion: 'Ubicación',
        fuente: 'Fuente',
        aplicar: 'Aplicar',
        vacanteActualizada: 'Vacante actualizada.',
        corregirVacante: 'Corregir la vacante',
        guardarCambios: 'Guardar cambios',
        cerrarOferta: 'Cerrar la oferta',
        reabrirOferta: 'Reabrir la oferta',
        eliminarVacante: 'Eliminar vacante',
        motivoDelCierre: 'Motivo del cierre',
        yaCubierta: 'Ya cubierta',
        expirada: 'Expirada',
        retirada: 'Retirada',
        fueraDePerfil: 'No exige inglés',
        ofertaCerrada: 'Cerrada',
        gestionDeLa: 'Gestión de la oferta',
        cerrarLaConserva: 'Cerrarla la conserva con su historial; eliminarla la borra del todo. Cierra lo que se cubrió o venció; elimina solo lo que nunca debió registrarse.',
        noSePudoCerrar: 'No se pudo cerrar la vacante.',
        noSePudoReabrir: 'No se pudo reabrir la vacante.',
        noSePudoEliminar: 'No se pudo eliminar la vacante.',
        seEliminaraVacante: (t: string) => `Se eliminará la vacante «${t}». Esta acción no se puede deshacer.`,
        manual: 'Manual', opcional: 'opcional',
      }
}

/** El motivo llega como codigo del backend; la etiqueta es interfaz. */
function etiquetaMotivo(T: ReturnType<typeof textos>, motivo: MotivoCierre): string {
  return {
    CUBIERTA: T.yaCubierta,
    EXPIRADA: T.expirada,
    RETIRADA: T.retirada,
    FUERA_DE_PERFIL: T.fueraDePerfil,
  }[motivo] ?? motivo
}

export default function VacantesPage() {
  const { confirmar, dialogo } = useConfirmar()
  const { mostrarError, avisos } = useAvisos()
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [todasVacantes, setTodasVacantes] = useState<VacanteResponse[]>([])
  const [currentPage, setCurrentPage]     = useState(0)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [searchQuery, setSearchQuery]     = useState('')
  const [fuenteFiltro, setFuenteFiltro]   = useState('TODAS')
  const [segmentoFiltro, setSegmentoFiltro] = useState('TODOS')
  const [modalidadFiltro, setModalidadFiltro] = useState('TODAS')
  const [revisionFiltro, setRevisionFiltro] = useState('TODAS')
  const [selected, setSelected]           = useState<VacanteResponse | null>(null)
  const [matching, setMatching]           = useState(false)
  const [matchingMsg, setMatchingMsg]     = useState<string | null>(null)
  const [creando, setCreando]             = useState(false)
  const [guardando, setGuardando]         = useState(false)
  const [formError, setFormError]         = useState<string | null>(null)
  const [formVacante, setFormVacante]     = useState<VacanteForm>(formularioVacio)
  const [editandoId, setEditandoId]       = useState<string | null>(null)
  const [gestionando, setGestionando]     = useState(false)
  const [revisando, setRevisando]         = useState(false)
  const [revisarError, setRevisarError]   = useState<string | null>(null)

  const PAGE_SIZE = 18

  const actualizarFormulario = (campo: keyof VacanteForm, valor: string) => {
    setFormVacante((anterior) => ({ ...anterior, [campo]: valor }))
  }

  const abrirCreacion = () => {
    setFormError(null); setEditandoId(null)
    setFormVacante(formularioVacio)
    setCreando(true)
  }

  /**
   * El mismo panel sirve para corregir.
   */
  const abrirEdicion = (v: VacanteResponse) => {
    setFormError(null); setEditandoId(v.id)
    setFormVacante({
      titulo: v.titulo ?? '',
      empresaNombre: v.empresaNombre ?? '',
      ubicacion: v.ubicacion ?? '',
      modalidadTrabajo: v.modalidadTrabajo ?? '',
      tipoContrato: v.tipoContrato ?? '',
      jornada: v.jornada ?? '',
      rangoSalarial: v.rangoSalarial ?? '',
      nivelInglesRequerido: v.nivelInglesRequerido ?? '',
      aniosExperienciaRequeridos: v.aniosExperienciaRequeridos != null ? String(v.aniosExperienciaRequeridos) : '',
      urlAplicar: v.urlAplicar ?? '',
      url: v.urlOrigen ?? '',
      fechaExpiracion: v.fechaExpiracion ? v.fechaExpiracion.slice(0, 16) : '',
      descripcion: v.descripcion ?? '',
      requisitos: v.requisitos ?? '',
    })
    setSelected(null)
    setCreando(true)
  }

  const crearVacante = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formVacante.titulo.trim()) {
      setFormError(T.indicaElTitulo)
      return
    }
    setGuardando(true); setFormError(null)
    const datos: VacanteRequest = {
      titulo: formVacante.titulo.trim(),
      empresaNombre: formVacante.empresaNombre.trim() || undefined,
      ubicacion: formVacante.ubicacion.trim() || undefined,
      modalidadTrabajo: formVacante.modalidadTrabajo || undefined,
      tipoContrato: formVacante.tipoContrato || undefined,
      jornada: formVacante.jornada || undefined,
      rangoSalarial: formVacante.rangoSalarial.trim() || undefined,
      nivelInglesRequerido: formVacante.nivelInglesRequerido || undefined,
      aniosExperienciaRequeridos: formVacante.aniosExperienciaRequeridos ? Number(formVacante.aniosExperienciaRequeridos) : undefined,
      urlAplicar: formVacante.urlAplicar.trim() || undefined,
      url: formVacante.url.trim() || undefined,
      fechaExpiracion: formVacante.fechaExpiracion ? `${formVacante.fechaExpiracion}:00Z` : undefined,
      descripcion: formVacante.descripcion.trim() || undefined,
      requisitos: formVacante.requisitos.trim() || undefined,
    }
    try {
      if (editandoId) {
        const corregida = await vacantesApi.actualizar(editandoId, datos)
        setTodasVacantes((prev) => prev.map((v) => (v.id === editandoId ? corregida : v)))
        setSelected(corregida)
        setCreando(false)
        mostrarError(T.vacanteActualizada)
      } else {
        await vacantesApi.crear(datos)
        setCreando(false)
        await load()
        mostrarError(T.vacanteCreadaCorrectamente)
      }
    } catch (err) {
      if (err instanceof ApiCallError) {
        setFormError(err.status === 400 ? T.noSePudoX : T.noSePudoCrear(err.status))
      } else { setFormError(T.noSePudo) }
    } finally { setGuardando(false) }
  }

  const runMatching = async () => {
    setMatching(true); setMatchingMsg(null)
    try {
      const res = await matchesApi.ejecutarMatching()
      setMatchingMsg(res.matchesCreados > 0
        ? `${T.matchingCompletado(res.matchesCreados)} ${T.revisalosEnLa}`
        : T.matchingSinNuevos)
    } catch (err) {
      setMatchingMsg(err instanceof ApiCallError
        ? (err.status === 401 || err.status === 403 ? T.sinPermisosPara : T.errorDelServidor(err.status))
        : C.errorConexion)
    } finally { setMatching(false) }
  }

  const runScanAndMatch = async () => {
    setMatching(true); setMatchingMsg(T.escaneandoPortalesDe)
    try {
      const scan = await vacantesApi.escanear()
      setMatchingMsg(T.vacantesNuevasEncontradas(scan.vacantesNuevas))
      const res = await matchesApi.ejecutarMatching()
      setMatchingMsg(
        T.escaneoCompletado(scan.vacantesNuevas, res.matchesCreados)
        + (res.matchesCreados > 0 ? ` ${T.revisalosEnLa}` : ''))
      await load()
      setCurrentPage(0)
    } catch (err) {
      setMatchingMsg(err instanceof ApiCallError
        ? (err.status === 401 || err.status === 403 ? T.sinPermisosParaX : T.errorDelServidor(err.status))
        : C.errorConexion)
    } finally { setMatching(false) }
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await vacantesApi.listar(0, 1000)
      setTodasVacantes(data.content)
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.status === 401 || err.status === 403
          ? T.sinPermisosInicia
          : `Error al cargar vacantes (HTTP ${err.status}).`)
      } else { setError(C.errorConexion) }
    } finally { setLoading(false) }
  }, [C.errorConexion, T.sinPermisosInicia])

  useEffect(() => { void load() }, [load])

  const validarOferta = async (id: string) => {
    setRevisando(true); setRevisarError(null)
    try {
      const actualizada = await vacantesApi.revisar(id)
      setTodasVacantes((prev) => prev.map((v) => (v.id === id ? actualizada : v)))
      setSelected((actual) => (actual?.id === id ? actualizada : actual))
    } catch (err) {
      setRevisarError(mensajeDeError(err, T.noSePudoX))
    } finally { setRevisando(false) }
  }

  const cerrarOferta = async (id: string, motivo: MotivoCierre) => {
    setGestionando(true)
    try {
      const cerrada = await vacantesApi.cerrar(id, motivo)
      setTodasVacantes((prev) => prev.map((v) => (v.id === id ? cerrada : v)))
      setSelected((actual) => (actual?.id === id ? cerrada : actual))
    } catch (err) {
      mostrarError(mensajeDeError(err, T.noSePudoCerrar))
    } finally { setGestionando(false) }
  }

  const reabrirOferta = async (id: string) => {
    setGestionando(true)
    try {
      const abierta = await vacantesApi.reabrir(id)
      setTodasVacantes((prev) => prev.map((v) => (v.id === id ? abierta : v)))
      setSelected((actual) => (actual?.id === id ? abierta : actual))
    } catch (err) {
      mostrarError(mensajeDeError(err, T.noSePudoReabrir))
    } finally { setGestionando(false) }
  }

  const eliminarOferta = async (v: VacanteResponse) => {
    if (!(await confirmar({
      titulo: T.eliminarVacante,
      descripcion: T.seEliminaraVacante(v.titulo),
      textoConfirmar: C.eliminar,
      destructivo: true,
    }))) return
    setGestionando(true)
    try {
      await vacantesApi.eliminar(v.id)
      setTodasVacantes((prev) => prev.filter((item) => item.id !== v.id))
      setSelected(null)
    } catch (err) {
      mostrarError(mensajeDeError(err, T.noSePudoEliminar))
    } finally { setGestionando(false) }
  }

  const fuentesFijas = [
    'LINKEDIN',
    'COMPUTRABAJO',
    'ELEMPLEO',
    'JSEARCH',
    'SMARTRECRUITERS',
    'REMOTIVE',
    'ARBEITNOW',
    'MANUAL',
  ]
  const fuentesEncontradas = Array.from(
    new Set(todasVacantes.map((v) => v.fuente).filter((f): f is string => !!f)),
  )
  const todasLasFuentes = Array.from(new Set([...fuentesFijas, ...fuentesEncontradas])).sort()

  const hayFiltrosActivos =
    fuenteFiltro !== 'TODAS' ||
    segmentoFiltro !== 'TODOS' ||
    modalidadFiltro !== 'TODAS' ||
    revisionFiltro !== 'TODAS' ||
    searchQuery.trim() !== ''

  const filtered = todasVacantes.filter((v) => {
    if (fuenteFiltro !== 'TODAS' && v.fuente?.toUpperCase() !== fuenteFiltro.toUpperCase()) return false
    if (segmentoFiltro !== 'TODOS' && v.segmento !== segmentoFiltro) return false
    if (modalidadFiltro !== 'TODAS' && v.modalidadTrabajo?.toUpperCase() !== modalidadFiltro.toUpperCase()) return false
    if (revisionFiltro === 'REVISADAS' && v.revisada === false) return false
    if (revisionFiltro === 'PENDIENTES' && v.revisada !== false) return false

    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      v.titulo.toLowerCase().includes(q) ||
      (v.empresaNombre?.toLowerCase().includes(q) ?? false) ||
      (v.ubicacion?.toLowerCase().includes(q) ?? false) ||
      (v.descripcion?.toLowerCase().includes(q) ?? false)
    )
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1
  const paginaActual = Math.min(currentPage, totalPages - 1)
  const vacantesVisibles = filtered.slice(paginaActual * PAGE_SIZE, (paginaActual + 1) * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex justify-end gap-4">
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={abrirCreacion}>
            <Plus className="size-3.5" /> {T.nuevaVacante}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <ArrowsClockwise className="size-3.5" /> Refrescar
          </Button>
          <Button variant="outline" size="sm" onClick={runMatching} disabled={matching}>
            Solo matching
          </Button>
          <Button size="sm" onClick={runScanAndMatch} disabled={matching}>
            {matching
              ? <><CircleNotch className="size-3.5 animate-spin" /> Procesando…</>
              : <><MagnifyingGlass className="size-3.5" /> {T.escanearYHacer}</>}
          </Button>
        </div>
      </div>

      {matchingMsg && (
        <div role="status" className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
          {matchingMsg}
        </div>
      )}

      <VistasGuardadas
        modulo="VACANTES"
        hayFiltros={hayFiltrosActivos}
        filtrosActuales={{
          fuente: fuenteFiltro,
          segmento: segmentoFiltro,
          modalidad: modalidadFiltro,
          revision: revisionFiltro,
          q: searchQuery.trim(),
        }}
        onAplicar={(f) => {
          setFuenteFiltro(typeof f.fuente === 'string' ? f.fuente : 'TODAS')
          setSegmentoFiltro(typeof f.segmento === 'string' ? f.segmento : 'TODOS')
          setModalidadFiltro(typeof f.modalidad === 'string' ? f.modalidad : 'TODAS')
          setRevisionFiltro(typeof f.revision === 'string' ? f.revision : 'TODAS')
          setSearchQuery(typeof f.q === 'string' ? f.q : '')
          setCurrentPage(0)
        }}
      />

      {/* Barra de Búsqueda y Filtros Compactos */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Búsqueda por texto */}
          <div className="relative min-w-[200px] flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={T.buscarPorTitulo}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(0)
              }}
              className="pl-9 bg-secondary/40 h-9 text-xs"
            />
          </div>

          {/* Filtro por Convocatoria / Segmento */}
          <div className="w-full sm:w-auto min-w-[150px]">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={segmentoFiltro}
              onChange={(e) => {
                setSegmentoFiltro(e.target.value)
                setCurrentPage(0)
              }}
              aria-label={T.filtrarPorConvocatoria}
            >
              <option value="TODOS">{T.todasLasConvocatorias}</option>
              <option value="LOCAL_COLOMBIA">{T.convocatoriasLocales}</option>
              <option value="REMOTO_INGLES">{T.convocatoriasRemotas}</option>
              <option value="MIGRACION">{T.convocatoriasMigracion}</option>
            </select>
          </div>

          {/* Filtro por Fuente / Portal */}
          <div className="w-full sm:w-auto min-w-[140px]">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={fuenteFiltro}
              onChange={(e) => {
                setFuenteFiltro(e.target.value)
                setCurrentPage(0)
              }}
              aria-label={T.filtrarPorFuente}
            >
              <option value="TODAS">{T.todasLasFuentesLabel} ({todasVacantes.length})</option>
              {todasLasFuentes.map((f) => {
                const totalFuente = todasVacantes.filter((v) => v.fuente?.toUpperCase() === f.toUpperCase()).length
                return (
                  <option key={f} value={f}>
                    {f} ({totalFuente})
                  </option>
                )
              })}
            </select>
          </div>

          {/* Filtro por Modalidad */}
          <div className="w-full sm:w-auto min-w-[130px]">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={modalidadFiltro}
              onChange={(e) => {
                setModalidadFiltro(e.target.value)
                setCurrentPage(0)
              }}
              aria-label={T.filtrarPorModalidad}
            >
              <option value="TODAS">{T.todasLasModalidades}</option>
              <option value="PRESENCIAL">Presencial</option>
              <option value="REMOTO">Remoto</option>
              <option value="HÍBRIDO">Híbrido</option>
            </select>
          </div>

          {/* Filtro por Estado de Revisión */}
          <div className="w-full sm:w-auto min-w-[125px]">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={revisionFiltro}
              onChange={(e) => {
                setRevisionFiltro(e.target.value)
                setCurrentPage(0)
              }}
              aria-label={T.filtrarPorRevision}
            >
              <option value="TODAS">{T.todasLasRevisiones}</option>
              <option value="REVISADAS">{T.soloRevisadas}</option>
              <option value="PENDIENTES">{T.soloPendientes}</option>
            </select>
          </div>
        </div>

        {/* Resumen de Filtros Activos y Botón Limpiar */}
        {hayFiltrosActivos && (
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border mt-1">
            <span>
              Filtros activos: <strong>{filtered.length}</strong> de <strong>{todasVacantes.length}</strong> vacantes encontradas
            </span>
            <button
              type="button"
              onClick={() => {
                setFuenteFiltro('TODAS')
                setSegmentoFiltro('TODOS')
                setModalidadFiltro('TODAS')
                setRevisionFiltro('TODAS')
                setSearchQuery('')
                setCurrentPage(0)
              }}
              className="text-primary hover:underline font-semibold"
            >
              {T.limpiarFiltros}
            </button>
          </div>
        )}
      </div>

      {/* Estados */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <PageSpinner label={T.cargandoVacantes} />
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <WarningCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void load()}><ArrowsClockwise className="size-4" /> Reintentar</Button>
        </div>
      )}

      {/* Listado */}
      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 py-16">
                <Briefcase className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{T.noHayVacantes}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vacantesVisibles.map((v) => (
                  <Card key={v.id} onClick={() => setSelected(v)} className="rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">{v.titulo}</CardTitle>
                        {v.urlAplicar && (
                          <a href={v.urlAplicar} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-primary shrink-0">
                            <ArrowSquareOut className="size-4" />
                          </a>
                        )}
                      </div>
                      <CardDescription className="flex items-center gap-1.5 text-xs">
                        <Buildings className="size-3 shrink-0" />
                        {v.empresaNombre ?? T.empresaNoEspecificada}
                      </CardDescription>
                      {/* La sugerida por un estudiante se ve pero no se
                          recomienda a nadie hasta que alguien la valide. Sin
                          este aviso quedaba indistinguible del resto y no había
                          forma de saber que estaba esperando. */}
                      {!v.revisada && (
                        <Badge variant="outline" className="mt-1 w-fit gap-1 border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] text-amber-700 dark:text-amber-400">
                          <WarningCircle className="size-2.5" />{T.sinRevisar}
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 pt-0">
                      <div className="flex flex-wrap gap-1.5">
                        {v.ubicacion && (
                          <Badge variant="outline" className="text-[10px] gap-1 px-1.5">
                            <MapPin className="size-2.5" />{v.ubicacion}
                          </Badge>
                        )}
                        {v.tipoContrato && (
                          <Badge variant="secondary" className="text-[10px] gap-1 px-1.5">
                            <Briefcase className="size-2.5" />{v.tipoContrato}
                          </Badge>
                        )}
                        {v.modalidadTrabajo && (
                          <Badge variant="secondary" className="text-[10px] gap-1 px-1.5">
                            <Globe className="size-2.5" />{v.modalidadTrabajo}
                          </Badge>
                        )}
                        {v.nivelInglesRequerido && (
                          <Badge variant="outline" className="text-[10px] gap-1 px-1.5">
                            <Translate className="size-2.5" />{v.nivelInglesRequerido}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {v.rangoSalarial && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <CurrencyDollar className="size-3 shrink-0" />{v.rangoSalarial}
                          </div>
                        )}
                        {v.aniosExperienciaRequeridos != null && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Briefcase className="size-3 shrink-0" />{v.aniosExperienciaRequeridos} años exp.
                          </div>
                        )}
                        {v.fuente && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Globe className="size-3 shrink-0" />{v.fuente}
                          </div>
                        )}
                        {v.fechaPublicacion && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <CalendarBlank className="size-3 shrink-0" />{v.fechaPublicacion}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    Página {paginaActual + 1} de {totalPages} · {filtered.length} vacantes
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={paginaActual === 0}
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
                    >
                      <CaretLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={paginaActual >= totalPages - 1}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                      className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
                    >
                      <CaretRight className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Panel en vivo de conectores y fuentes de empleo (ATS & Portales) */}
      <PanelConectoresScraping onActualizacionTerminada={() => void load()} />

      {/* Registro de corridas.
          Va al final y no arriba porque es diagnóstico: se consulta cuando algo
          parece raro, no cada vez que se abre la pantalla. Arriba empujaría la
          lista de ofertas, que es a lo que se entra aquí. */}
      <RegistroDeScraping />

      {/* Creación manual */}
      <Sheet open={creando} onOpenChange={(open) => { if (!open && !guardando) setCreando(false) }}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-border bg-muted/25 p-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Briefcase className="size-5" /></div>
            <SheetTitle className="mt-3 text-lg">{editandoId ? T.corregirVacante : T.registrarVacante}</SheetTitle>
            <SheetDescription>{T.completaLosDatos}</SheetDescription>
          </SheetHeader>
          <form onSubmit={crearVacante} className="space-y-6 p-6">
            {formError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><WarningCircle className="mt-0.5 size-4 shrink-0" />{formError}</div>}

            <section className="space-y-4">
              <div><p className="text-sm font-semibold">{T.informacionPrincipal}</p><p className="text-xs text-muted-foreground">{T.losDatosQue}</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-medium text-foreground">{T.tituloDeLa} <span className="text-destructive">*</span></span><Input autoFocus value={formVacante.titulo} onChange={(e) => actualizarFormulario('titulo', e.target.value)} placeholder={T.ejAnalistaDe} disabled={guardando} /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium text-foreground">{C.empresa}</span><Input value={formVacante.empresaNombre} onChange={(e) => actualizarFormulario('empresaNombre', e.target.value)} placeholder={T.nombreDeLa} disabled={guardando} /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium text-foreground">{T.ubicacion}</span><Input value={formVacante.ubicacion} onChange={(e) => actualizarFormulario('ubicacion', e.target.value)} placeholder={T.ciudadOUbicacion} disabled={guardando} /></label>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-muted/20 p-4 space-y-4">
              <div><p className="text-sm font-semibold">{T.condicionesDeLa}</p><p className="text-xs text-muted-foreground">{T.estaInformacionHace}</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5"><span className="text-xs font-medium">{T.modalidad}</span><select value={formVacante.modalidadTrabajo} onChange={(e) => actualizarFormulario('modalidadTrabajo', e.target.value)} disabled={guardando} className="h-10 w-full rounded-xl border border-input bg-card/90 px-3.5 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"><option>{T.presencial}</option><option>{T.hibrido}</option><option>{T.remoto}</option></select></label>
                <label className="space-y-1.5"><span className="text-xs font-medium">{T.tipoDeContrato}</span><Input value={formVacante.tipoContrato} onChange={(e) => actualizarFormulario('tipoContrato', e.target.value)} placeholder={T.terminoIndefinidoPrestacion} disabled={guardando} maxLength={60} /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium">{T.jornada}</span><select value={formVacante.jornada} onChange={(e) => actualizarFormulario('jornada', e.target.value)} disabled={guardando} className="h-10 w-full rounded-xl border border-input bg-card/90 px-3.5 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"><option>{T.tiempoCompleto}</option><option>{T.medioTiempo}</option><option>{T.porHoras}</option><option>{T.practica}</option></select></label>
                <label className="space-y-1.5"><span className="text-xs font-medium">{T.rangoSalarial}</span><Input value={formVacante.rangoSalarial} onChange={(e) => actualizarFormulario('rangoSalarial', e.target.value)} placeholder={T.ej2000} disabled={guardando} /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium">{T.nivelDeIngles}</span><Input value={formVacante.nivelInglesRequerido} onChange={(e) => actualizarFormulario('nivelInglesRequerido', e.target.value)} placeholder={T.noRequeridoB1} disabled={guardando} /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium">{T.experienciaMinimaAnos}</span><Input type="number" min="0" max="50" value={formVacante.aniosExperienciaRequeridos} onChange={(e) => actualizarFormulario('aniosExperienciaRequeridos', e.target.value)} placeholder="0" disabled={guardando} /></label>
              </div>
            </section>

            <section className="space-y-4">
              <div><p className="text-sm font-semibold">{T.descripcionYPublicacion}</p><p className="text-xs text-muted-foreground">{T.anadeDetallesPara}</p></div>
              <label className="block space-y-1.5"><span className="text-xs font-medium">{T.descripcion}</span><Textarea minRows={4} value={formVacante.descripcion} onChange={(e) => actualizarFormulario('descripcion', e.target.value)} placeholder={T.responsabilidadesObjetivoDel} disabled={guardando} className="w-full resize-y rounded-xl border border-input bg-card/90 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15" /></label>
              <label className="block space-y-1.5"><span className="text-xs font-medium">{T.requisitos}</span><Textarea minRows={3} value={formVacante.requisitos} onChange={(e) => actualizarFormulario('requisitos', e.target.value)} placeholder={T.conocimientosHerramientasEstudios} disabled={guardando} className="w-full resize-y rounded-xl border border-input bg-card/90 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5"><span className="flex items-center gap-1 text-xs font-medium"><LinkSimple className="size-3" /> {T.enlaceParaPostularse}</span><Input type="url" value={formVacante.urlAplicar} onChange={(e) => actualizarFormulario('urlAplicar', e.target.value)} placeholder="https://…" disabled={guardando} /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium">{T.fechaDeCierre}</span><Input type="datetime-local" value={formVacante.fechaExpiracion} onChange={(e) => actualizarFormulario('fechaExpiracion', e.target.value)} disabled={guardando} /></label>
                <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-medium">{T.enlaceDeReferencia} <span className="text-muted-foreground">({T.opcional})</span></span><Input type="url" value={formVacante.url} onChange={(e) => actualizarFormulario('url', e.target.value)} placeholder="https://sitio-de-la-empresa.com/vacante" disabled={guardando} /></label>
              </div>
            </section>

            <div className="sticky bottom-0 -mx-6 flex items-center justify-between border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
              <p className="hidden text-xs text-muted-foreground sm:block">{T.losCamposSin}</p>
              <div className="ml-auto flex gap-2"><Button type="button" variant="outline" onClick={() => setCreando(false)} disabled={guardando}>{C.cancelar}</Button><Button type="submit" disabled={guardando}>{guardando
                ? <><CircleNotch className="size-4 animate-spin" /> {C.guardando}</>
                : <><CheckCircle className="size-4" /> {editandoId ? T.guardarCambios : T.registrarVacante}</>}</Button></div>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Drawer de detalle */}
      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          {selected && (
            <>
              <SheetHeader className="p-6 border-b border-border shrink-0">
                <SheetTitle className="text-base leading-tight">{selected.titulo}</SheetTitle>
                <SheetDescription className="flex items-center gap-1.5 text-xs">
                  <Buildings className="size-3" /> {selected.empresaNombre ?? T.empresaNoEspecificada}
                  {selected.fechaPublicacion && <> · <CalendarBlank className="size-3" /> {selected.fechaPublicacion}</>}
                </SheetDescription>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selected.ubicacion && <Badge variant="outline" className="gap-1"><MapPin className="size-3" />{selected.ubicacion}</Badge>}
                  {selected.tipoContrato && <Badge variant="secondary" className="gap-1"><Briefcase className="size-3" />{selected.tipoContrato}</Badge>}
                  {selected.modalidadTrabajo && <Badge variant="secondary" className="gap-1"><Globe className="size-3" />{selected.modalidadTrabajo}</Badge>}
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                {/* Validación de una oferta sugerida por un estudiante.
                    Mientras no se valide, el matching la excluye: es la barrera
                    que impide que una estafa de empleo llegue a toda la cohorte
                    en una sola corrida. El endpoint existía desde el principio;
                    lo que faltaba era poder llegar a él desde aquí. */}
                {!selected.revisada && (
                  <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-2">
                      <WarningCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div className="text-xs leading-5">
                        <p className="font-semibold text-foreground">{T.estaOfertaEsta}</p>
                        <p className="text-muted-foreground">
                          {selected.fuente === 'PORTAL_EMPRESA'
                            ? T.origenEmpresa
                            : selected.fuente === 'FORMULARIO_PUBLICO'
                              ? T.origenPublico
                              : T.origenParticipante}{' '}
                          {T.laRegistroUn}
                        </p>
                      </div>
                    </div>

                    {/* Lo que declaró quien la mandó. Va aquí dentro y no en la
                        ficha de la oferta porque no es del anuncio: es lo único
                        con lo que se puede comprobar si esto es real y a quién
                        se le contesta. Sin esto, la única acción posible sobre
                        una oferta pública es aprobarla a ciegas o descartarla. */}
                    {selected.empresaDeclarada && (
                      <div className="rounded-lg border border-border bg-background/60 p-3 text-xs">
                        <p className="mb-1.5 font-semibold text-foreground">{T.quienLaMando}</p>
                        <dl className="grid gap-1 sm:grid-cols-2">
                          <div>
                            <dt className="text-muted-foreground">{C.empresa}</dt>
                            <dd className="font-medium">{selected.empresaDeclarada}</dd>
                          </div>
                          {selected.contactoDeclarado && (
                            <div>
                              <dt className="text-muted-foreground">{T.elContacto}</dt>
                              <dd className="font-medium">{selected.contactoDeclarado}</dd>
                            </div>
                          )}
                          {selected.emailDeclarado && (
                            <div>
                              <dt className="text-muted-foreground">{T.elCorreo}</dt>
                              <dd className="font-medium break-all">
                                <a href={`mailto:${selected.emailDeclarado}`} className="hover:underline">
                                  {selected.emailDeclarado}
                                </a>
                              </dd>
                            </div>
                          )}
                          {selected.telefonoDeclarado && (
                            <div>
                              <dt className="text-muted-foreground">{C.telefono}</dt>
                              <dd className="font-medium">{selected.telefonoDeclarado}</dd>
                            </div>
                          )}
                        </dl>
                        <p className="mt-2 text-muted-foreground">{T.empresaSinVerificar}</p>
                      </div>
                    )}
                    {revisarError && (
                      <p className="text-xs text-destructive">{revisarError}</p>
                    )}
                    <Button
                      size="sm"
                      onClick={() => void validarOferta(selected.id)}
                      disabled={revisando}
                      className="w-fit"
                    >
                      {revisando
                        ? <><CircleNotch className="size-3.5 animate-spin" /> Validando…</>
                        : <><CheckCircle className="size-3.5" /> {T.darPorBuena}</>}
                    </Button>
                  </section>
                )}

                {/* Info principal y Salario */}
                <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">{T.informacionGeneral}</h4>
                    {selected.modalidadTrabajo && (
                      <Badge
                        variant={selected.modalidadTrabajo.toLowerCase().includes('remot') ? 'secondary' : 'outline'}
                        className={
                          selected.modalidadTrabajo.toLowerCase().includes('remot')
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium text-xs gap-1'
                            : 'text-xs gap-1'
                        }
                      >
                        <Globe className="size-3" /> {selected.modalidadTrabajo}
                      </Badge>
                    )}
                  </div>

                  {selected.rangoSalarial ? (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 p-2.5 text-primary">
                      <CurrencyDollar className="size-5 shrink-0 font-bold" />
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-primary/80">{T.rangoSalarial}</p>
                        <p className="text-sm font-semibold tabular-nums text-foreground">{selected.rangoSalarial}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">{T.ubicacion}</span>
                      <span className="font-medium">{selected.ciudad || selected.ubicacion || T.noEspecificado}</span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">{T.jornada}</span>
                      <span className="font-medium">{selected.jornada || T.noEspecificado}</span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">{T.experiencia}</span>
                      <span className="font-medium">{selected.aniosExperienciaRequeridos != null ? T.aniosX(selected.aniosExperienciaRequeridos) : T.noEspecificado}</span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">{T.inglesRequerido}</span>
                      <span className="font-medium">{selected.nivelInglesRequerido ?? T.noEspecificado}</span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">{T.tipoDeContrato}</span>
                      <span className="font-medium">{selected.tipoContrato ?? T.noEspecificado}</span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">{T.fuente}</span>
                      <span className="font-medium">{selected.fuente ?? T.manual}</span>
                    </div>
                  </div>
                </section>

                {selected.requisitos && (
                  <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1 flex items-center gap-1.5">
                      <CheckCircle className="size-3.5" /> {T.requisitos}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{selected.requisitos}</p>
                  </section>
                )}

                {selected.descripcion && (
                  <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1 flex items-center gap-1.5">
                      <Briefcase className="size-3.5" /> {T.descripcion}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{selected.descripcion}</p>
                  </section>
                )}

                {/* Gestión de la oferta.
                    Los cuatro endpoints existían desde el principio, probados y
                    con su control de rol; lo que faltaba era poder llegar a
                    ellos. Sin esto el equipo podía crear una vacante pero no
                    corregir una errata, ni cerrarla cuando la empresa ya había
                    contratado, ni borrar una que el scraping leyó mal. */}
                <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">{T.gestionDeLa}</h4>
                  <p className="text-[11px] leading-5 text-muted-foreground">{T.cerrarLaConserva}</p>

                  {selected.activa === false && (
                    <p className="text-xs font-medium text-muted-foreground">
                      {T.ofertaCerrada}{selected.motivoCierre ? ` · ${etiquetaMotivo(T, selected.motivoCierre)}` : ''}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled={gestionando} onClick={() => abrirEdicion(selected)}>
                      <PencilSimple className="size-3.5" /> {C.editar}
                    </Button>

                    {selected.activa === false ? (
                      <Button variant="outline" size="sm" disabled={gestionando} onClick={() => void reabrirOferta(selected.id)}>
                        <ArrowCounterClockwise className="size-3.5" /> {T.reabrirOferta}
                      </Button>
                    ) : (
                      <label className="inline-flex items-center gap-2">
                        <span className="sr-only">{T.motivoDelCierre}</span>
                        <select
                          aria-label={T.motivoDelCierre}
                          disabled={gestionando}
                          defaultValue=""
                          onChange={(e) => {
                            const motivo = e.target.value as MotivoCierre
                            e.target.value = ''
                            if (motivo) void cerrarOferta(selected.id, motivo)
                          }}
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="">{T.cerrarOferta}…</option>
                          <option value="CUBIERTA">{T.yaCubierta}</option>
                          <option value="EXPIRADA">{T.expirada}</option>
                          <option value="RETIRADA">{T.retirada}</option>
                        </select>
                        <XCircle className="size-3.5 text-muted-foreground" />
                      </label>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={gestionando}
                      onClick={() => void eliminarOferta(selected)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash className="size-3.5" /> {C.eliminar}
                    </Button>
                  </div>
                </section>
              </div>

              <div className="p-4 border-t border-border shrink-0 flex justify-end gap-2">
                {selected.urlAplicar && (
                  <Button
                    variant="default"
                    size="sm"
                    render={<a href={selected.urlAplicar} target="_blank" rel="noopener noreferrer" />}
                  >
                    <ArrowSquareOut className="size-4" /> {T.aplicar}
                  </Button>
                )}
                {selected.urlOrigen && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<a href={selected.urlOrigen} target="_blank" rel="noopener noreferrer" />}
                  >
                    <Globe className="size-4" /> {T.verFuente}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setSelected(null)}>{C.cerrar}</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      {dialogo}
      {avisos}
    </div>
  )
}
