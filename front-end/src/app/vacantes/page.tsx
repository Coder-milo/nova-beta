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

export default function VacantesPage() {
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
      setFormError('Indica el título de la vacante para poder publicarla.')
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
      setMatchingMsg('Vacante creada correctamente. Ya está disponible para el matching de estudiantes.')
      setCurrentPage(0)
      await load(0)
    } catch (err) {
      setFormError(err instanceof ApiCallError
        ? (err.body.message ?? `No se pudo crear la vacante (HTTP ${err.status}).`)
        : 'No se pudo conectar con el backend para crear la vacante.')
    } finally { setGuardando(false) }
  }

  const runMatching = async () => {
    setMatching(true); setMatchingMsg(null)
    try {
      const res = await matchesApi.ejecutarMatching()
      setMatchingMsg(res.matchesCreados > 0
        ? `Matching completado: ${res.matchesCreados} match(es) nuevos. Revísalos en la pestaña Matches de cada estudiante.`
        : 'Matching completado: sin matches nuevos (los pares ya evaluados no se repiten).')
    } catch (err) {
      setMatchingMsg(err instanceof ApiCallError
        ? (err.status === 401 || err.status === 403 ? 'Sin permisos para ejecutar el matching.' : `Error del servidor (HTTP ${err.status}).`)
        : 'No se pudo conectar con el backend.')
    } finally { setMatching(false) }
  }

  /** Flujo de un solo paso: escanea los portales y luego ejecuta el matching. */
  const runScanAndMatch = async () => {
    setMatching(true); setMatchingMsg('Escaneando portales de empleo…')
    try {
      const scan = await vacantesApi.escanear()
      setMatchingMsg(`${scan.vacantesNuevas} vacante(s) nuevas encontradas. Ejecutando matching…`)
      const res = await matchesApi.ejecutarMatching()
      setMatchingMsg(
        `Escaneo completado: ${scan.vacantesNuevas} vacante(s) nuevas · ${res.matchesCreados} match(es) nuevos.`
        + (res.matchesCreados > 0 ? ' Revísalos en la pestaña Matches de cada estudiante.' : ''))
      load(0); setCurrentPage(0)
    } catch (err) {
      setMatchingMsg(err instanceof ApiCallError
        ? (err.status === 401 || err.status === 403 ? 'Sin permisos para escanear vacantes.' : `Error del servidor (HTTP ${err.status}).`)
        : 'No se pudo conectar con el backend.')
    } finally { setMatching(false) }
  }

  const load = useCallback(async (pg: number) => {
    setLoading(true); setError(null)
    try {
      setPage(await vacantesApi.listar(pg, 20))
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.status === 401 || err.status === 403
          ? 'Sin permisos. Inicia sesión.'
          : `Error al cargar vacantes (HTTP ${err.status}).`)
      } else { setError('No se pudo conectar con el backend.') }
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
      setRevisarError(mensajeDeError(err, 'No se pudo validar la oferta.'))
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
            <Plus className="size-3.5" /> Nueva vacante
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
              : <><MagnifyingGlass className="size-3.5" /> Escanear y hacer matching</>}
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
          <Input type="search" placeholder="Buscar por título, empresa o ubicación…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-secondary/40" />
        </div>
        {/* Sólo con más de una fuente: un desplegable de un elemento es ruido. */}
        {fuentesDisponibles.length > 1 && (
          <div className="flex items-center gap-2">
            <Globe className="size-3.5 shrink-0 text-muted-foreground" />
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-56"
              value={fuenteFiltro}
              onChange={(e) => setFuenteFiltro(e.target.value)}
              aria-label="Filtrar por fuente"
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
          <PageSpinner label="Cargando vacantes…" />
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
                <p className="text-sm text-muted-foreground">No hay vacantes registradas.</p>
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
                        {v.empresaNombre ?? 'Empresa no especificada'}
                      </CardDescription>
                      {/* La sugerida por un estudiante se ve pero no se
                          recomienda a nadie hasta que alguien la valide. Sin
                          este aviso quedaba indistinguible del resto y no había
                          forma de saber que estaba esperando. */}
                      {!v.revisada && (
                        <Badge variant="outline" className="mt-1 w-fit gap-1 border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] text-amber-700 dark:text-amber-400">
                          <WarningCircle className="size-2.5" />Sin revisar
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
            <SheetTitle className="mt-3 text-lg">Registrar vacante</SheetTitle>
            <SheetDescription>Completa los datos esenciales. La oportunidad quedará lista para el matching y las postulaciones.</SheetDescription>
          </SheetHeader>
          <form onSubmit={crearVacante} className="space-y-6 p-6">
            {formError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><WarningCircle className="mt-0.5 size-4 shrink-0" />{formError}</div>}

            <section className="space-y-4">
              <div><p className="text-sm font-semibold">Información principal</p><p className="text-xs text-muted-foreground">Los datos que verán los estudiantes al encontrar la oportunidad.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-medium text-foreground">Título de la vacante <span className="text-destructive">*</span></span><Input autoFocus value={formVacante.titulo} onChange={(e) => actualizarFormulario('titulo', e.target.value)} placeholder="Ej. Analista de soporte técnico" disabled={guardando} /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium text-foreground">Empresa</span><Input value={formVacante.empresaNombre} onChange={(e) => actualizarFormulario('empresaNombre', e.target.value)} placeholder="Nombre de la empresa" disabled={guardando} /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium text-foreground">Ubicación</span><Input value={formVacante.ubicacion} onChange={(e) => actualizarFormulario('ubicacion', e.target.value)} placeholder="Ciudad o ubicación" disabled={guardando} /></label>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-muted/20 p-4 space-y-4">
              <div><p className="text-sm font-semibold">Condiciones de la oportunidad</p><p className="text-xs text-muted-foreground">Esta información hace más preciso el matching.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5"><span className="text-xs font-medium">Modalidad</span><select value={formVacante.modalidadTrabajo} onChange={(e) => actualizarFormulario('modalidadTrabajo', e.target.value)} disabled={guardando} className="h-10 w-full rounded-xl border border-input bg-card/90 px-3.5 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"><option>Presencial</option><option>Híbrido</option><option>Remoto</option></select></label>
                <label className="space-y-1.5"><span className="text-xs font-medium">Tipo de contrato</span><Input value={formVacante.tipoContrato} onChange={(e) => actualizarFormulario('tipoContrato', e.target.value)} placeholder="Término indefinido, prestación…" disabled={guardando} /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium">Jornada</span><select value={formVacante.jornada} onChange={(e) => actualizarFormulario('jornada', e.target.value)} disabled={guardando} className="h-10 w-full rounded-xl border border-input bg-card/90 px-3.5 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"><option>Tiempo completo</option><option>Medio tiempo</option><option>Por horas</option><option>Práctica</option></select></label>
                <label className="space-y-1.5"><span className="text-xs font-medium">Rango salarial</span><Input value={formVacante.rangoSalarial} onChange={(e) => actualizarFormulario('rangoSalarial', e.target.value)} placeholder="Ej. $2.000.000 - $2.500.000" disabled={guardando} /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium">Nivel de inglés</span><Input value={formVacante.nivelInglesRequerido} onChange={(e) => actualizarFormulario('nivelInglesRequerido', e.target.value)} placeholder="No requerido, B1, B2…" disabled={guardando} /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium">Experiencia mínima (años)</span><Input type="number" min="0" max="50" value={formVacante.aniosExperienciaRequeridos} onChange={(e) => actualizarFormulario('aniosExperienciaRequeridos', e.target.value)} placeholder="0" disabled={guardando} /></label>
              </div>
            </section>

            <section className="space-y-4">
              <div><p className="text-sm font-semibold">Descripción y publicación</p><p className="text-xs text-muted-foreground">Añade detalles para que el estudiante entienda el perfil solicitado.</p></div>
              <label className="block space-y-1.5"><span className="text-xs font-medium">Descripción</span><Textarea minRows={4} value={formVacante.descripcion} onChange={(e) => actualizarFormulario('descripcion', e.target.value)} placeholder="Responsabilidades, objetivo del cargo y contexto de la oportunidad…" disabled={guardando} className="w-full resize-y rounded-xl border border-input bg-card/90 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15" /></label>
              <label className="block space-y-1.5"><span className="text-xs font-medium">Requisitos</span><Textarea minRows={3} value={formVacante.requisitos} onChange={(e) => actualizarFormulario('requisitos', e.target.value)} placeholder="Conocimientos, herramientas, estudios o certificaciones requeridas…" disabled={guardando} className="w-full resize-y rounded-xl border border-input bg-card/90 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5"><span className="flex items-center gap-1 text-xs font-medium"><LinkSimple className="size-3" /> Enlace para postularse</span><Input type="url" value={formVacante.urlAplicar} onChange={(e) => actualizarFormulario('urlAplicar', e.target.value)} placeholder="https://…" disabled={guardando} /></label>
                <label className="space-y-1.5"><span className="text-xs font-medium">Fecha de cierre</span><Input type="datetime-local" value={formVacante.fechaExpiracion} onChange={(e) => actualizarFormulario('fechaExpiracion', e.target.value)} disabled={guardando} /></label>
                <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-medium">Enlace de referencia <span className="text-muted-foreground">(opcional)</span></span><Input type="url" value={formVacante.url} onChange={(e) => actualizarFormulario('url', e.target.value)} placeholder="https://sitio-de-la-empresa.com/vacante" disabled={guardando} /></label>
              </div>
            </section>

            <div className="sticky bottom-0 -mx-6 flex items-center justify-between border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
              <p className="hidden text-xs text-muted-foreground sm:block">Los campos sin asterisco son opcionales.</p>
              <div className="ml-auto flex gap-2"><Button type="button" variant="outline" onClick={() => setCreando(false)} disabled={guardando}>Cancelar</Button><Button type="submit" disabled={guardando}>{guardando ? <><CircleNotch className="size-4 animate-spin" /> Publicando…</> : <><CheckCircle className="size-4" /> Publicar vacante</>}</Button></div>
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
                  <Buildings className="size-3" /> {selected.empresaNombre ?? 'Empresa no especificada'}
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
                        <p className="font-semibold text-foreground">Esta oferta está sin revisar</p>
                        <p className="text-muted-foreground">
                          La registró un participante. No se le recomienda a nadie hasta que
                          alguien del equipo compruebe que es real. Revisa la empresa y el
                          enlace antes de validarla.
                        </p>
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
                        : <><CheckCircle className="size-3.5" /> Dar por buena</>}
                    </Button>
                  </section>
                )}

                {/* Info principal */}
                <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Información General</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">Rango salarial</span>
                      <span className="font-medium">{selected.rangoSalarial ?? 'No especificado'}</span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">Experiencia</span>
                      <span className="font-medium">{selected.aniosExperienciaRequeridos != null ? `${selected.aniosExperienciaRequeridos} años` : 'No especificado'}</span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">Inglés requerido</span>
                      <span className="font-medium">{selected.nivelInglesRequerido ?? 'No especificado'}</span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">Fuente</span>
                      <span className="font-medium">{selected.fuente ?? 'Manual'}</span>
                    </div>
                  </div>
                </section>

                {selected.descripcion && (
                  <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Descripción</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{selected.descripcion}</p>
                  </section>
                )}

                {selected.requisitos && (
                  <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Requisitos</h4>
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
                    <Globe className="size-4" /> Ver fuente
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Cerrar</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
