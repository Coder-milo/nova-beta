'use client'

import { ArrowSquareOutIcon as ArrowSquareOut, ArrowsClockwiseIcon as ArrowsClockwise, BriefcaseIcon as Briefcase, BuildingsIcon as Buildings, CalendarBlankIcon as CalendarBlank, CaretLeftIcon as CaretLeft, CaretRightIcon as CaretRight, CheckCircleIcon as CheckCircle, CircleNotchIcon as CircleNotch, CurrencyDollarIcon as CurrencyDollar, GlobeIcon as Globe, LinkSimpleIcon as LinkSimple, MagnifyingGlassIcon as MagnifyingGlass, MapPinIcon as MapPin, PlusIcon as Plus, TranslateIcon as Translate, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
/**
 * Página de Vacantes y Matching.
 *
 * Consume:
 *   GET  /api/v1/vacantes?page=&size=  → lista paginada de vacantes activas
 *   GET  /api/v1/vacantes/{id}         → detalle de vacante
 *   POST /api/v1/vacantes/scraping     → escaneo de portales bajo demanda
 *   POST /api/v1/matches/ejecutar      → matching estudiantes ↔ vacantes
 */

import { useState, useEffect, useCallback } from 'react'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { vacantesApi, matchesApi, ApiCallError, mensajeDeError } from '@/lib/api'
import type { VacanteRequest, VacanteResponse, Page } from '@/lib/types'
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
        filtrarPorFuente: 'Filter by source',
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
        laRegistroUn: 'A participant added this one. It is not recommended to anyone until someone on the team confirms it is real. Check the company and the link before approving it.',
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
        filtrarPorFuente: 'Filtrar por fuente',
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
        laRegistroUn: 'La registró un participante. No se le recomienda a nadie hasta que alguien del equipo compruebe que es real. Revisa la empresa y el enlace antes de validarla.',
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
        manual: 'Manual', opcional: 'opcional',
      }
}

export default function VacantesPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [page, setPage]               = useState<Page<VacanteResponse> | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  /**
   * Fuente seleccionada. Con varias fuentes activas —empleo local desde el
   * portal de los empleadores, remoto en inglés, migración— el listado las
   * mezcla y no hay forma de mirar sólo lo que sirve a quien vive aquí.
   */
  const [fuenteFiltro, setFuenteFiltro] = useState('TODAS')
  const [selected, setSelected]       = useState<VacanteResponse | null>(null)
  const [matching, setMatching]       = useState(false)
  const [matchingMsg, setMatchingMsg] = useState<string | null>(null)
  const [creando, setCreando]         = useState(false)
  const [guardando, setGuardando]     = useState(false)
  const [formError, setFormError]     = useState<string | null>(null)
  const [formVacante, setFormVacante] = useState<VacanteForm>(formularioVacio)
  const [revisando, setRevisando]     = useState(false)
  const [revisarError, setRevisarError] = useState<string | null>(null)

  const actualizarFormulario = (campo: keyof VacanteForm, valor: string) => {
    setFormVacante((anterior) => ({ ...anterior, [campo]: valor }))
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
      fechaExpiracion: formVacante.fechaExpiracion || undefined,
      descripcion: formVacante.descripcion.trim() || undefined,
      requisitos: formVacante.requisitos.trim() || undefined,
    }
    try {
      await vacantesApi.crear(datos)
      setCreando(false)
      setFormVacante(formularioVacio)
      setMatchingMsg(T.vacanteCreadaCorrectamente)
      setCurrentPage(0)
      await load(0)
    } catch (err) {
      setFormError(err instanceof ApiCallError
        ? (err.body.message ?? T.noSePudoCrear(err.status))
        : T.noSePudo)
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

  /** Flujo de un solo paso: escanea los portales y luego ejecuta el matching. */
  const runScanAndMatch = async () => {
    setMatching(true); setMatchingMsg(T.escaneandoPortalesDe)
    try {
      const scan = await vacantesApi.escanear()
      setMatchingMsg(T.vacantesNuevasEncontradas(scan.vacantesNuevas))
      const res = await matchesApi.ejecutarMatching()
      setMatchingMsg(
        T.escaneoCompletado(scan.vacantesNuevas, res.matchesCreados)
        + (res.matchesCreados > 0 ? ` ${T.revisalosEnLa}` : ''))
      load(0); setCurrentPage(0)
    } catch (err) {
      setMatchingMsg(err instanceof ApiCallError
        ? (err.status === 401 || err.status === 403 ? T.sinPermisosParaX : T.errorDelServidor(err.status))
        : C.errorConexion)
    } finally { setMatching(false) }
  }

  const load = useCallback(async (pg: number) => {
    setLoading(true); setError(null)
    try {
      setPage(await vacantesApi.listar(pg, 20))
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.status === 401 || err.status === 403
          ? T.sinPermisosInicia
          : `Error al cargar vacantes (HTTP ${err.status}).`)
      } else { setError(C.errorConexion) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(0) }, [load])

  /**
   * Da por buena una oferta sugerida por un participante.
   *
   * Se actualiza la tarjeta en la lista y el panel abierto con lo que
   * devuelve el servidor, en vez de recargar la página entera: recargar
   * cerraría el panel y quien está revisando varias perdería el sitio.
   */
  const validarOferta = async (id: string) => {
    setRevisando(true); setRevisarError(null)
    try {
      const actualizada = await vacantesApi.revisar(id)
      setPage((actual) => actual && {
        ...actual,
        content: actual.content.map((v) => (v.id === id ? actualizada : v)),
      })
      setSelected((actual) => (actual?.id === id ? actualizada : actual))
    } catch (err) {
      setRevisarError(mensajeDeError(err, T.noSePudoX))
    } finally { setRevisando(false) }
  }

  /** Las fuentes que de verdad hay en lo cargado; no una lista fija. */
  const fuentesDisponibles = Array.from(
    new Set((page?.content ?? []).map((v) => v.fuente).filter((f): f is string => !!f)),
  ).sort()

  const filtered = (page?.content ?? []).filter((v) => {
    if (fuenteFiltro !== 'TODAS' && v.fuente !== fuenteFiltro) return false
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return v.titulo.toLowerCase().includes(q) ||
      (v.empresaNombre?.toLowerCase().includes(q)) ||
      (v.ubicacion?.toLowerCase().includes(q)) ||
      (v.descripcion?.toLowerCase().includes(q))
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex justify-end gap-4">
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => { setFormError(null); setCreando(true) }}>
            <Plus className="size-3.5" /> {T.nuevaVacante}
          </Button>
          <Button variant="outline" size="sm" onClick={() => load(currentPage)}>
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

      {/* Búsqueda y filtro por fuente */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,28rem)_auto]">
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" placeholder={T.buscarPorTitulo} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-secondary/40" />
        </div>
        {/* Sólo con más de una fuente: un desplegable de un elemento es ruido. */}
        {fuentesDisponibles.length > 1 && (
          <div className="flex items-center gap-2">
            <Globe className="size-3.5 shrink-0 text-muted-foreground" />
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-56"
              value={fuenteFiltro}
              onChange={(e) => setFuenteFiltro(e.target.value)}
              aria-label={T.filtrarPorFuente}
            >
              <option value="TODAS">Todas las fuentes ({page?.content.length ?? 0})</option>
              {fuentesDisponibles.map((f) => (
                <option key={f} value={f}>
                  {f} ({(page?.content ?? []).filter((v) => v.fuente === f).length})
                </option>
              ))}
            </select>
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
          <Button variant="outline" onClick={() => load(currentPage)}><ArrowsClockwise className="size-4" /> Reintentar</Button>
        </div>
      )}

      {/* Listado */}
      {!loading && !error && page && (
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
                {filtered.map((v) => (
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
              {page.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">Página {page.number + 1} de {page.totalPages} · {page.totalElements} vacantes</span>
                  <div className="flex gap-1">
                    <button type="button" disabled={page.number === 0}
                      onClick={() => { const p = currentPage - 1; setCurrentPage(p); load(p) }}
                      className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40">
                      <CaretLeft className="size-4" />
                    </button>
                    <button type="button" disabled={page.number >= page.totalPages - 1}
                      onClick={() => { const p = currentPage + 1; setCurrentPage(p); load(p) }}
                      className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40">
                      <CaretRight className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Creación manual */}
      <Sheet open={creando} onOpenChange={(open) => { if (!open && !guardando) setCreando(false) }}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-border bg-muted/25 p-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Briefcase className="size-5" /></div>
            <SheetTitle className="mt-3 text-lg">{T.registrarVacante}</SheetTitle>
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
                <label className="space-y-1.5"><span className="text-xs font-medium">{T.tipoDeContrato}</span><Input value={formVacante.tipoContrato} onChange={(e) => actualizarFormulario('tipoContrato', e.target.value)} placeholder={T.terminoIndefinidoPrestacion} disabled={guardando} /></label>
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
              <div className="ml-auto flex gap-2"><Button type="button" variant="outline" onClick={() => setCreando(false)} disabled={guardando}>{C.cancelar}</Button><Button type="submit" disabled={guardando}>{guardando ? <><CircleNotch className="size-4 animate-spin" /> Publicando…</> : <><CheckCircle className="size-4" /> Publicar vacante</>}</Button></div>
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
                        <p className="text-muted-foreground">{T.laRegistroUn}</p>
                      </div>
                    </div>
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

                {/* Info principal */}
                <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">{T.informacionGeneral}</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">{T.rangoSalarial}</span>
                      <span className="font-medium">{selected.rangoSalarial ?? T.noEspecificado}</span>
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
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">{T.fuente}</span>
                      <span className="font-medium">{selected.fuente ?? T.manual}</span>
                    </div>
                  </div>
                </section>

                {selected.descripcion && (
                  <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">{T.descripcion}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{selected.descripcion}</p>
                  </section>
                )}

                {selected.requisitos && (
                  <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">{T.requisitos}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{selected.requisitos}</p>
                  </section>
                )}
              </div>

              <div className="p-4 border-t border-border shrink-0 flex justify-end gap-2">
                {selected.urlAplicar && (
                  <Button
                    variant="default"
                    size="sm"
                    render={<a href={selected.urlAplicar} target="_blank" rel="noopener noreferrer" />}
                  >
                    <ArrowSquareOut className="size-4" /> Aplicar
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
    </div>
  )
}
