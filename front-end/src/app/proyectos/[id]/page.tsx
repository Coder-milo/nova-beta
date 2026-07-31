'use client'

import { ArrowLeft, ArrowsClockwise, CaretLeft, CaretRight, CheckCircle, CircleNotch, ClipboardText, ClockCounterClockwise, DownloadSimple, FileText, Flag, Kanban, Palette, PencilSimple, Plus, ReadCvLogo, Rows, Trash, UploadSimple, Users, WarningCircle, X } from '@phosphor-icons/react'
import { PanelBranding } from '@/components/admin/panel-branding'
/**
 * Detalle de proyecto / programa — expediente completo con pestañas.
 *
 * Consume:
 *   GET    /api/v1/programas/{id}                → cabecera
 *   PUT    /api/v1/programas/{id}                → editar
 *   PATCH  /api/v1/programas/{id}/estado         → finalizar
 *   DELETE /api/v1/programas/{id}                → eliminar
 *   GET    /api/v1/programas/{id}/resumen        → pestaña Resumen
 *   GET    /api/v1/estudiantes?programaId=       → pestaña Estudiantes
 *   GET    /api/v1/documentos?programaId=        → pestaña Documentos
 *   POST   /api/v1/hojas-de-vida/generar-masiva  → pestaña Hojas de vida
 *   GET    /api/v1/programas/{id}/actividades    → pestaña Actividades
 *   GET    /api/v1/auditoria?registroId=         → pestaña Historial
 */

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { useParams, useRouter } from '@/compat/next-navigation'
import Link from '@/compat/next-link'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EstadoDot } from '@/components/ui/estado-dot'
import {
  programasApi, estudiantesApi, documentosApi, hvApi, actividadesApi,
  auditoriaApi, ApiCallError,
} from '@/lib/api'
import type {
  ProgramaResponse, ProgramaRequest, ProgramaEstado, ProgramaResumenResponse,
  EstudianteResponse, DocumentoResponse, GeneracionMasivaResponse,
  ActividadResponse, AuditoriaResponse, Page,
} from '@/lib/types'
import { Textarea } from '@/components/ui/textarea'

// ─── Etiquetas de estado ──────────────────────────────────────────────────────

const estadoLabels: Record<ProgramaEstado, { label: string; dot: string; text: string }> = {
  PLANEACION:   { label: 'Planeación',   dot: 'bg-navy-200', text: 'text-navy-400' },
  BORRADOR:     { label: 'Borrador',     dot: 'bg-navy-300', text: 'text-navy-500' },
  ACTIVO:       { label: 'Activo',       dot: 'bg-success',  text: 'text-[#0F6E56]' },
  EN_EJECUCION: { label: 'En ejecución', dot: 'bg-success',  text: 'text-[#0F6E56]' },
  PAUSADO:      { label: 'Pausado',      dot: 'bg-warning',  text: 'text-amber-700' },
  FINALIZADO:   { label: 'Finalizado',   dot: 'bg-navy-800', text: 'text-navy-800' },
  CANCELADO:    { label: 'Cancelado',    dot: 'bg-red-600',  text: 'text-red-700' },
  ARCHIVADO:    { label: 'Archivado',    dot: 'bg-red-600',  text: 'text-red-700' },
}

const estadoAcademicoLabels: Record<string, { label: string; dot: string; text: string }> = {
  ACTIVO:     { label: 'Activo',     dot: 'bg-navy-500', text: 'text-navy-600' },
  GRADUADO:   { label: 'Graduado',   dot: 'bg-navy-800', text: 'text-navy-800' },
  RETIRADO:   { label: 'Retirado',   dot: 'bg-red-600',  text: 'text-red-700' },
  EN_PROCESO: { label: 'En proceso', dot: 'bg-navy-300', text: 'text-navy-500' },
}

const estadoFallback = { dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' }

// Campos extendidos del programa que aún no están en el DTO base.
type ProgramaExtra = {
  cliente?: string | null
  responsable?: string | null
  observaciones?: string | null
  porcentajeAvance?: number | null
}
type ProgramaCompleto = ProgramaResponse & ProgramaExtra
type ProgramaForm = ProgramaRequest & {
  cliente?: string
  responsable?: string
  observaciones?: string
  porcentajeAvance?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatoFecha(fecha: string): string {
  try {
    return new Date(fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
  } catch { return fecha }
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">{children}</span>
}

function EstadoCarga({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <PageSpinner />
      <span className="ml-2 text-sm text-muted-foreground">{mensaje}</span>
    </div>
  )
}

function EstadoError({ mensaje, onRetry }: { mensaje: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <WarningCircle className="size-8 text-destructive" />
      <p className="text-sm text-destructive">{mensaje}</p>
      <Button variant="outline" onClick={onRetry}><ArrowsClockwise className="size-4" /> Reintentar</Button>
    </div>
  )
}

// ─── Pestaña: Resumen ─────────────────────────────────────────────────────────

function TabResumen({ programaId }: { programaId: string }) {
  const [resumen, setResumen] = useState<ProgramaResumenResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setResumen(await programasApi.resumen(programaId)) }
    catch { setError('No se pudo cargar el resumen del proyecto.') }
    finally { setLoading(false) }
  }, [programaId])

  useEffect(() => { load() }, [load])

  if (loading) return <EstadoCarga mensaje="Cargando resumen…" />
  if (error) return <EstadoError mensaje={error} onRetry={load} />
  if (!resumen) return null

  const items: { label: string; value: number }[] = [
    { label: 'Total estudiantes',        value: resumen.totalEstudiantes },
    { label: 'Activos',                  value: resumen.activos },
    { label: 'Graduados',                value: resumen.graduados },
    { label: 'Retirados',                value: resumen.retirados },
    { label: 'En proceso',               value: resumen.enProceso },
    { label: 'Información incompleta',   value: resumen.conInformacionIncompleta },
    { label: 'Hojas de vida generadas',  value: resumen.hojasDeVidaGeneradas },
    { label: 'Documentos',               value: resumen.documentos },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="rounded-lg border-border shadow-none">
          <CardContent className="flex flex-col gap-1 py-4">
            <Etiqueta>{it.label}</Etiqueta>
            <span className="text-2xl font-semibold tabular-nums text-foreground">{it.value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Pestaña: Estudiantes ─────────────────────────────────────────────────────

function TabEstudiantes({ programaId }: { programaId: string }) {
  const [page, setPage]           = useState<Page<EstudianteResponse> | null>(null)
  const [currentPage, setCurrent] = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true); setError(null)
    try { setPage(await estudiantesApi.listar(programaId, p, 20)) }
    catch { setError('No se pudieron cargar los estudiantes del proyecto.') }
    finally { setLoading(false) }
  }, [programaId])

  useEffect(() => { load(currentPage) }, [load, currentPage])

  if (loading) return <EstadoCarga mensaje="Cargando estudiantes…" />
  if (error) return <EstadoError mensaje={error} onRetry={() => load(currentPage)} />
  if (!page) return null

  if (page.content.length === 0) {
    return (
      <Card className="rounded-lg border-border shadow-none">
        <CardContent className="flex flex-col items-center gap-3 py-16">
          <Users className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Este proyecto aún no tiene estudiantes vinculados.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-lg border-border shadow-none overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estudiante</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Documento</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {page.content.map((est) => {
              const ai = estadoAcademicoLabels[est.estadoAcademico] ?? { label: est.estadoAcademico, ...estadoFallback }
              const iniciales = `${est.nombre.charAt(0)}${est.apellido.charAt(0)}`.toUpperCase()
              return (
                <tr key={est.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground">
                        {iniciales}
                      </span>
                      <span className="font-medium text-foreground">{est.nombre} {est.apellido}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {est.tipoDocumento && est.numeroDocumento ? `${est.tipoDocumento} ${est.numeroDocumento}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{est.email}</td>
                  <td className="px-4 py-3"><EstadoDot {...ai} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/estudiantes/${est.id}`} className="text-xs font-medium text-primary hover:underline">
                      Ver perfil
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {page.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            Página {page.number + 1} de {page.totalPages} · {page.totalElements} estudiantes
          </span>
          <div className="flex gap-1">
            <button type="button" disabled={page.number === 0} onClick={() => setCurrent((p) => p - 1)}
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
              <CaretLeft className="size-4" />
            </button>
            <button type="button" disabled={page.number >= page.totalPages - 1} onClick={() => setCurrent((p) => p + 1)}
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
              <CaretRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Pestaña: Documentos ──────────────────────────────────────────────────────

function TabDocumentos({ programaId }: { programaId: string }) {
  const [page, setPage]         = useState<Page<DocumentoResponse> | null>(null)
  const [currentPage, setCurrent] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [tipos, setTipos]       = useState<string[]>([])
  const [tipoSel, setTipoSel]   = useState('')
  const [archivo, setArchivo]   = useState<File | null>(null)
  const [busy, setBusy]         = useState(false)
  const [mensaje, setMensaje]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true); setError(null)
    try { setPage(await documentosApi.buscar({ programaId, page: p, size: 20 })) }
    catch { setError('No se pudieron cargar los documentos del proyecto.') }
    finally { setLoading(false) }
  }, [programaId])

  useEffect(() => { load(currentPage) }, [load, currentPage])
  useEffect(() => { documentosApi.tipos().then(setTipos).catch(() => setTipos([])) }, [])

  const handleUpload = async () => {
    if (!archivo) return
    setBusy(true); setMensaje(null)
    try {
      await documentosApi.subir(archivo, { programaId, tipo: tipoSel || undefined })
      setArchivo(null); setTipoSel('')
      if (fileRef.current) fileRef.current.value = ''
      setMensaje('Documento subido correctamente.')
      load(currentPage)
    } catch (err) {
      setMensaje(err instanceof ApiCallError ? `Error al subir (HTTP ${err.status}).` : 'Error de conexión al subir el documento.')
    } finally { setBusy(false) }
  }

  const handleDelete = async (doc: DocumentoResponse) => {
    if (!confirm(`¿Eliminar el documento "${doc.nombre}"?`)) return
    setBusy(true)
    try { await documentosApi.eliminar(doc.id); load(currentPage) }
    catch { alert('No se pudo eliminar el documento.') }
    finally { setBusy(false) }
  }

  const handleDownload = async (doc: DocumentoResponse) => {
    try { await documentosApi.descargar(doc.id, doc.nombre) }
    catch { alert('No se pudo descargar el documento.') }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Subir documento */}
      <Card className="rounded-lg border-border shadow-none">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc-archivo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Archivo</label>
            <input id="doc-archivo" ref={fileRef} type="file" disabled={busy}
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc-tipo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Tipo</label>
            <select id="doc-tipo" value={tipoSel} onChange={(e) => setTipoSel(e.target.value)} disabled={busy}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Sin tipo</option>
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={handleUpload} disabled={busy || !archivo}>
            {busy ? <CircleNotch className="size-4 animate-spin" /> : <UploadSimple className="size-4" />} Subir documento
          </Button>
          {mensaje && <span className="text-xs text-muted-foreground">{mensaje}</span>}
        </CardContent>
      </Card>

      {loading && <EstadoCarga mensaje="Cargando documentos…" />}
      {error && !loading && <EstadoError mensaje={error} onRetry={() => load(currentPage)} />}

      {!loading && !error && page && (
        page.content.length === 0 ? (
          <Card className="rounded-lg border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <FileText className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No hay documentos asociados a este proyecto.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-lg border-border shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Versión</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tamaño</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Subido por</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {page.content.map((doc) => (
                    <tr key={doc.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{doc.nombre}</td>
                      <td className="px-4 py-3 text-muted-foreground">{doc.tipo || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">v{doc.numeroVersion}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatoTamano(doc.tamano)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{doc.subidoPor ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatoFecha(doc.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => handleDownload(doc)} title="Descargar" aria-label={`Descargar ${doc.nombre}`}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                            <DownloadSimple className="size-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(doc)} title="Eliminar" aria-label={`Eliminar ${doc.nombre}`}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                            <Trash className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {page.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-xs text-muted-foreground tabular-nums">
                  Página {page.number + 1} de {page.totalPages} · {page.totalElements} documentos
                </span>
                <div className="flex gap-1">
                  <button type="button" disabled={page.number === 0} onClick={() => setCurrent((p) => p - 1)}
                    className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
                    <CaretLeft className="size-4" />
                  </button>
                  <button type="button" disabled={page.number >= page.totalPages - 1} onClick={() => setCurrent((p) => p + 1)}
                    className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
                    <CaretRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        )
      )}
    </div>
  )
}

// ─── Pestaña: Hojas de vida ───────────────────────────────────────────────────

function TabHojasDeVida({ programaId }: { programaId: string }) {
  const [soloCompletos, setSoloCompletos] = useState(false)
  const [resultado, setResultado] = useState<GeneracionMasivaResponse | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const generar = () => {
    setError(null)
    startTransition(async () => {
      try { setResultado(await hvApi.generarMasiva({ programaId, soloCompletos })) }
      catch (err) {
        setError(err instanceof ApiCallError
          ? `No se pudieron generar las hojas de vida (HTTP ${err.status}).`
          : 'No se pudo conectar con el backend.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-lg border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Generación masiva</CardTitle>
          <CardDescription className="text-xs">
            Genera la hoja de vida de todos los estudiantes vinculados a este proyecto.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={soloCompletos} onChange={(e) => setSoloCompletos(e.target.checked)}
              className="size-3.5 rounded border-gray-300 accent-primary" disabled={isPending} />
            Solo estudiantes con información completa
          </label>
          <Button size="sm" onClick={generar} disabled={isPending}>
            {isPending ? <><CircleNotch className="size-4 animate-spin" /> Generando…</> : <><ReadCvLogo className="size-4" /> Generar hojas de vida del proyecto</>}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {resultado && (
        <Card className="rounded-lg border-border shadow-none overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resultado de la generación</CardTitle>
            <CardDescription className="text-xs tabular-nums">
              Solicitadas: {resultado.solicitadas} · Generadas: {resultado.generadas} · Fallidas: {resultado.fallidas}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {resultado.resultados.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No hubo estudiantes para procesar.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estudiante</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Generada</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resultado.resultados.map((r) => (
                      <tr key={r.estudianteId} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{r.nombre}</td>
                        <td className="px-4 py-3">
                          {r.generada
                            ? <span className="flex items-center gap-1.5 text-xs font-medium text-[#0F6E56]"><CheckCircle className="size-3.5" /> Sí</span>
                            : <span className="flex items-center gap-1.5 text-xs font-medium text-red-700"><X className="size-3.5" /> No</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.error ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Pestaña: Actividades ─────────────────────────────────────────────────────

const estadoActividadLabels: Record<string, { label: string; dot: string; text: string }> = {
  PENDIENTE:  { label: 'Pendiente',  dot: 'bg-navy-500', text: 'text-navy-600' },
  COMPLETADA: { label: 'Completada', dot: 'bg-success',  text: 'text-[#0F6E56]' },
}

function TabActividades({ programaId }: { programaId: string }) {
  const [actividades, setActividades] = useState<ActividadResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [nombre, setNombre]   = useState('')
  const [fecha, setFecha]     = useState('')
  const [responsable, setResponsable] = useState('')
  const [formError, setFormError]     = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setActividades(await actividadesApi.porPrograma(programaId)) }
    catch { setError('No se pudieron cargar las actividades del proyecto.') }
    finally { setLoading(false) }
  }, [programaId])

  useEffect(() => { load() }, [load])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault(); setFormError(null)
    if (!nombre.trim()) { setFormError('El nombre es obligatorio.'); return }
    if (!fecha) { setFormError('La fecha es obligatoria.'); return }
    startTransition(async () => {
      try {
        await actividadesApi.crear(programaId, { nombre: nombre.trim(), fecha, responsable: responsable.trim() || undefined })
        setNombre(''); setFecha(''); setResponsable('')
        load()
      } catch (err) {
        setFormError(err instanceof ApiCallError ? `Error del servidor (HTTP ${err.status}).` : 'No se pudo conectar con el backend.')
      }
    })
  }

  const handleDelete = (act: ActividadResponse) => {
    if (!confirm(`¿Eliminar la actividad "${act.nombre}"?`)) return
    startTransition(async () => {
      try { await actividadesApi.eliminar(programaId, act.id); load() }
      catch { alert('No se pudo eliminar la actividad.') }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Crear actividad */}
      <Card className="rounded-lg border-border shadow-none">
        <CardContent className="py-4">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="act-nombre" className="text-[11px] uppercase tracking-wider text-muted-foreground">Nombre</label>
              <Input id="act-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Taller de entrevistas" disabled={isPending} className="w-56" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="act-fecha" className="text-[11px] uppercase tracking-wider text-muted-foreground">Fecha</label>
              <Input id="act-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={isPending} className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="act-resp" className="text-[11px] uppercase tracking-wider text-muted-foreground">Responsable</label>
              <Input id="act-resp" value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Nombre del responsable" disabled={isPending} className="w-56" />
            </div>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? <CircleNotch className="size-4 animate-spin" /> : <Plus className="size-4" />} Agregar actividad
            </Button>
            {formError && <span className="text-xs text-destructive">{formError}</span>}
          </form>
        </CardContent>
      </Card>

      {loading && <EstadoCarga mensaje="Cargando actividades…" />}
      {error && !loading && <EstadoError mensaje={error} onRetry={load} />}

      {!loading && !error && (
        actividades.length === 0 ? (
          <Card className="rounded-lg border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <ClipboardText className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No hay actividades registradas para este proyecto.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-lg border-border shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Responsable</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {actividades.map((act) => {
                    const ei = estadoActividadLabels[act.estado] ?? { label: act.estado, ...estadoFallback }
                    return (
                      <tr key={act.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{act.nombre}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{act.fecha}</td>
                        <td className="px-4 py-3 text-muted-foreground">{act.responsable ?? '—'}</td>
                        <td className="px-4 py-3"><EstadoDot {...ei} /></td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => handleDelete(act)} title="Eliminar" aria-label={`Eliminar ${act.nombre}`}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                            <Trash className="size-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}
    </div>
  )
}

// ─── Pestaña: Historial ───────────────────────────────────────────────────────

function TabHistorial({ programaId }: { programaId: string }) {
  const [page, setPage]       = useState<Page<AuditoriaResponse> | null>(null)
  const [currentPage, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true); setError(null)
    try { setPage(await auditoriaApi.buscar({ registroId: programaId, page: p, size: 20 })) }
    catch { setError('No se pudo cargar el historial del proyecto.') }
    finally { setLoading(false) }
  }, [programaId])

  useEffect(() => { load(currentPage) }, [load, currentPage])

  if (loading) return <EstadoCarga mensaje="Cargando historial…" />
  if (error) return <EstadoError mensaje={error} onRetry={() => load(currentPage)} />
  if (!page) return null

  if (page.content.length === 0) {
    return (
      <Card className="rounded-lg border-border shadow-none">
        <CardContent className="flex flex-col items-center gap-3 py-16">
          <ClockCounterClockwise className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No hay registros de auditoría para este proyecto.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {page.content.map((reg) => (
        <Card key={reg.id} className="rounded-lg border-border shadow-none">
          <CardContent className="flex flex-col gap-2 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{reg.accion}</span>
                <span className="text-xs text-muted-foreground">· {reg.usuario}</span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{formatoFecha(reg.fecha)}</span>
            </div>
            {(reg.datosAnteriores || reg.datosNuevos) && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-secondary/30 p-2.5">
                  <Etiqueta>Información anterior</Etiqueta>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-muted-foreground">{reg.datosAnteriores ?? '—'}</pre>
                </div>
                <div className="rounded-md border border-border bg-secondary/30 p-2.5">
                  <Etiqueta>Información nueva</Etiqueta>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-muted-foreground">{reg.datosNuevos ?? '—'}</pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {page.totalPages > 1 && (
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            Página {page.number + 1} de {page.totalPages} · {page.totalElements} registros
          </span>
          <div className="flex gap-1">
            <button type="button" disabled={page.number === 0} onClick={() => setCurrent((p) => p - 1)}
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
              <CaretLeft className="size-4" />
            </button>
            <button type="button" disabled={page.number >= page.totalPages - 1} onClick={() => setCurrent((p) => p + 1)}
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
              <CaretRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type TabId = 'resumen' | 'estudiantes' | 'documentos' | 'hv' | 'actividades' | 'identidad' | 'historial'

const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: 'resumen',     label: 'Resumen',       icon: Rows },
  { id: 'estudiantes', label: 'Estudiantes',   icon: Users },
  { id: 'documentos',  label: 'Documentos',    icon: FileText },
  { id: 'hv',          label: 'Hojas de vida', icon: ReadCvLogo },
  { id: 'actividades', label: 'Actividades',   icon: ClipboardText },
  { id: 'identidad',   label: 'Identidad visual', icon: Palette },
  { id: 'historial',   label: 'Historial',     icon: ClockCounterClockwise },
]

export default function ProyectoDetallePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [programa, setPrograma] = useState<ProgramaCompleto | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [tab, setTab]           = useState<TabId>('resumen')

  const [showEdit, setShowEdit]   = useState(false)
  const [form, setForm]           = useState<ProgramaForm | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setPrograma((await programasApi.obtener(id)) as ProgramaCompleto) }
    catch (err) {
      setError(err instanceof ApiCallError && err.status === 404
        ? 'El proyecto no existe o fue eliminado.'
        : 'No se pudo cargar el proyecto.')
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { if (id) load() }, [id, load])

  const openEdit = () => {
    if (!programa) return
    setForm({
      nombre: programa.nombre,
      descripcion: programa.descripcion ?? '',
      duracionDias: programa.duracionDias ?? undefined,
      fechaInicio: programa.fechaInicio ?? '',
      fechaFin: programa.fechaFin ?? '',
      estado: programa.estado,
      cliente: programa.cliente ?? '',
      responsable: programa.responsable ?? '',
      observaciones: programa.observaciones ?? '',
      porcentajeAvance: programa.porcentajeAvance ?? undefined,
    })
    setFormError(null); setFormSuccess(null); setShowEdit(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    setFormError(null); setFormSuccess(null)
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio.'); return }
    startTransition(async () => {
      try {
        await programasApi.actualizar(id, form)
        setFormSuccess('Proyecto actualizado.')
        setTimeout(() => { setShowEdit(false); load() }, 800)
      } catch (err) {
        if (err instanceof ApiCallError) {
          setFormError(err.status === 401 || err.status === 403 ? 'Sin permisos.' : `Error del servidor (HTTP ${err.status}).`)
        } else { setFormError('No se pudo conectar con el backend.') }
      }
    })
  }

  const handleFinalizar = () => {
    if (!confirm('¿Finalizar este proyecto? El estado cambiará a "Finalizado".')) return
    startTransition(async () => {
      try { await programasApi.cambiarEstado(id, 'FINALIZADO'); load() }
      catch (err) {
        alert(err instanceof ApiCallError ? `Error: ${err.body.message ?? `HTTP ${err.status}`}` : 'Error de conexión.')
      }
    })
  }

  const handleEliminar = () => {
    if (!programa) return
    if (!confirm(`¿Eliminar el proyecto "${programa.nombre}"? Esta acción no se puede deshacer.`)) return
    startTransition(async () => {
      try {
        await programasApi.eliminar(id)
        router.push('/proyectos')
      } catch (err) {
        alert(err instanceof ApiCallError ? `Error: ${err.body.message ?? `HTTP ${err.status}`}` : 'Error de conexión.')
      }
    })
  }

  const setF = (key: keyof ProgramaForm, val: unknown) =>
    setForm((prev) => (prev ? { ...prev, [key]: val } : prev))

  if (loading) return <EstadoCarga mensaje="Cargando proyecto…" />
  if (error) return (
    <div className="flex flex-col gap-4">
      <Link href="/proyectos" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Volver a proyectos
      </Link>
      <EstadoError mensaje={error} onRetry={load} />
    </div>
  )
  if (!programa) return null

  const si = estadoLabels[programa.estado] ?? { label: programa.estado, ...estadoFallback }
  const avance = Math.min(100, Math.max(0, programa.porcentajeAvance ?? 0))

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-4">
        <Link href="/proyectos" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Volver a proyectos
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
                <Kanban className="size-5" /> {programa.nombre}
              </h2>
              <EstadoDot {...si} />
            </div>
            <p className="text-sm text-muted-foreground">
              {[programa.cliente, programa.responsable].filter(Boolean).join(' · ') || 'Sin cliente ni responsable asignados.'}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {programa.fechaInicio ?? '—'} → {programa.fechaFin ?? '—'}
              {programa.duracionDias ? ` · ${programa.duracionDias} días` : ''}
            </p>
            <div className="flex items-center gap-3 max-w-xs">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-navy-800 transition-all" style={{ width: `${avance}%` }} />
              </div>
              <span className="text-xs font-medium tabular-nums text-foreground">{avance}%</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={openEdit} disabled={isPending}>
              <PencilSimple className="size-3.5" /> Editar
            </Button>
            {programa.estado !== 'FINALIZADO' && programa.estado !== 'ARCHIVADO' && (
              <Button variant="outline" size="sm" onClick={handleFinalizar} disabled={isPending}>
                <Flag className="size-3.5" /> Finalizar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleEliminar} disabled={isPending}
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash className="size-3.5" /> Eliminar
            </Button>
          </div>
        </div>
      </div>

      {/* Formulario de edición */}
      {showEdit && form && (
        <Card className="rounded-lg border-primary/30 shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Editar proyecto</CardTitle>
              <button type="button" onClick={() => setShowEdit(false)} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <CardDescription>El nombre es obligatorio. Los demás campos son opcionales.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label htmlFor="pe-nombre" className="text-xs font-medium">Nombre *</label>
                <Input id="pe-nombre" required value={form.nombre} onChange={(e) => setF('nombre', e.target.value)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pe-cliente" className="text-xs font-medium">Cliente</label>
                <Input id="pe-cliente" value={form.cliente ?? ''} onChange={(e) => setF('cliente', e.target.value)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pe-responsable" className="text-xs font-medium">Responsable</label>
                <Input id="pe-responsable" value={form.responsable ?? ''} onChange={(e) => setF('responsable', e.target.value)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pe-avance" className="text-xs font-medium">% de avance</label>
                <Input id="pe-avance" type="number" min={0} max={100} value={form.porcentajeAvance ?? ''}
                  onChange={(e) => setF('porcentajeAvance', e.target.value === '' ? undefined : Math.min(100, Math.max(0, parseInt(e.target.value))))} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label htmlFor="pe-desc" className="text-xs font-medium">Descripción</label>
                <Textarea id="pe-desc" minRows={2} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.descripcion ?? ''} onChange={(e) => setF('descripcion', e.target.value)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label htmlFor="pe-obs" className="text-xs font-medium">Observaciones</label>
                <Textarea id="pe-obs" minRows={2} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.observaciones ?? ''} onChange={(e) => setF('observaciones', e.target.value)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pe-inicio" className="text-xs font-medium">Fecha inicio</label>
                <Input id="pe-inicio" type="date" value={form.fechaInicio ?? ''} onChange={(e) => setF('fechaInicio', e.target.value)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pe-fin" className="text-xs font-medium">Fecha fin</label>
                <Input id="pe-fin" type="date" value={form.fechaFin ?? ''} onChange={(e) => setF('fechaFin', e.target.value)} disabled={isPending} />
              </div>

              {formError && (
                <div role="alert" className="col-span-full flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div role="status" className="col-span-full flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle className="mt-0.5 size-4 shrink-0" /><span>{formSuccess}</span>
                </div>
              )}
              <div className="col-span-full flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowEdit(false)} disabled={isPending}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <><CircleNotch className="size-4 animate-spin" /> Guardando…</> : 'Actualizar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pestañas */}
      <div className="flex overflow-x-auto border-b border-border">
        {tabs.map(({ id: tid, label, icon: Icon }) => (
          <button key={tid} type="button" onClick={() => setTab(tid)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${tab === tid ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'resumen'     && <TabResumen programaId={id} />}
      {tab === 'estudiantes' && <TabEstudiantes programaId={id} />}
      {tab === 'documentos'  && <TabDocumentos programaId={id} />}
      {tab === 'hv'          && <TabHojasDeVida programaId={id} />}
      {tab === 'actividades' && <TabActividades programaId={id} />}
      {tab === 'identidad'   && <PanelBranding programaIdInicial={id} />}
      {tab === 'historial'   && <TabHistorial programaId={id} />}
    </div>
  )
}
