'use client'

import { ArrowsClockwise, CaretLeft, CaretRight, CircleNotch, ClockCounterClockwise, DownloadSimple, FileArrowUp, FileText, MagnifyingGlass, Trash, UploadSimple, WarningCircle, X } from '@phosphor-icons/react'
/**
 * Página de Documentos — módulo documental completo con versionado.
 *
 * Consume:
 *   GET    /api/v1/documentos                → búsqueda paginada con filtros
 *   GET    /api/v1/documentos/tipos          → catálogo de tipos
 *   POST   /api/v1/documentos                → subir
 *   PUT    /api/v1/documentos/{id}           → reemplazar (nueva versión)
 *   GET    /api/v1/documentos/{id}/versiones → historial de versiones
 *   GET    /api/v1/documentos/{id}/descargar → descarga
 *   DELETE /api/v1/documentos/{id}           → eliminar
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { documentosApi, programasApi, ApiCallError } from '@/lib/api'
import type { DocumentoResponse, ProgramaResponse, Page, ApiError } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = ''

/** Reemplaza el archivo de un documento (nueva versión) vía PUT multipart. */
async function reemplazarDocumento(id: string, archivo: File): Promise<void> {
  const form = new FormData()
  form.append('archivo', archivo)
  // Sin cabecera Authorization: la cookie HttpOnly viaja sola y el proxy /api
  // la traduce al Bearer que espera el backend.
  const res = await fetch(`${BASE_URL}/api/v1/documentos/${id}`, {
    method: 'PUT',
    body: form,
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!res.ok) {
    let body: ApiError = { status: res.status }
    try { body = await res.json() } catch { /* noop */ }
    throw new ApiCallError(res.status, body)
  }
}

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

// ─── Página ───────────────────────────────────────────────────────────────────

export default function DocumentosPage() {
  const [page, setPage]           = useState<Page<DocumentoResponse> | null>(null)
  const [currentPage, setCurrent] = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // Filtros
  const [q, setQ]           = useState('')
  const [qInput, setQInput] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [tipos, setTipos]   = useState<string[]>([])

  // Subida
  const [programas, setProgramas]   = useState<ProgramaResponse[]>([])
  const [archivo, setArchivo]       = useState<File | null>(null)
  const [tipoSubida, setTipoSubida] = useState('')
  const [vinculoPgm, setVinculoPgm] = useState('')
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadMsg, setUploadMsg]   = useState<string | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  // Versiones (drawer)
  const [versionesDoc, setVersionesDoc] = useState<DocumentoResponse | null>(null)
  const [versiones, setVersiones]       = useState<DocumentoResponse[]>([])
  const [versionesLoading, setVersionesLoading] = useState(false)
  const [versionesError, setVersionesError]     = useState<string | null>(null)

  // Reemplazo
  const [reemplazoId, setReemplazoId] = useState<string | null>(null)
  const reemplazoRef = useRef<HTMLInputElement>(null)

  const [rowBusy, setRowBusy] = useState(false)

  // ── Cargar ────────────────────────────────────────────────────────────────
  const load = useCallback(async (p: number, query: string, tipo: string) => {
    setLoading(true); setError(null)
    try {
      setPage(await documentosApi.buscar({ soloAdministrativos: true, q: query || undefined, tipo: tipo || undefined, page: p, size: 20 }))
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.status === 401 || err.status === 403
          ? 'Sin permisos. Inicia sesión.'
          : `Error al cargar documentos (HTTP ${err.status}).`)
      } else { setError('No se pudo conectar con el backend.') }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(currentPage, q, tipoFiltro) }, [load, currentPage, q, tipoFiltro])

  useEffect(() => {
    documentosApi.tipos().then(setTipos).catch(() => setTipos([]))
    programasApi.listar().then(setProgramas).catch(() => setProgramas([]))
  }, [])

  const aplicarBusqueda = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrent(0); setQ(qInput.trim())
  }

  const limpiarFiltros = () => {
    setQInput(''); setQ(''); setTipoFiltro(''); setCurrent(0)
  }

  // ── Subir ─────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!archivo) return
    setUploadBusy(true); setUploadMsg(null)
    try {
      await documentosApi.subir(archivo, {
        tipo: tipoSubida || undefined,
        programaId: vinculoPgm || undefined,
      })
      setArchivo(null); setTipoSubida(''); setVinculoPgm('')
      if (uploadRef.current) uploadRef.current.value = ''
      setUploadMsg('Documento subido correctamente.')
      load(currentPage, q, tipoFiltro)
    } catch (err) {
      setUploadMsg(err instanceof ApiCallError ? `Error al subir (HTTP ${err.status}).` : 'Error de conexión al subir el documento.')
    } finally { setUploadBusy(false) }
  }

  // ── Acciones de fila ──────────────────────────────────────────────────────
  const handleDownload = async (doc: DocumentoResponse) => {
    try { await documentosApi.descargar(doc.id, doc.nombre) }
    catch { alert('No se pudo descargar el documento.') }
  }

  const handleDelete = async (doc: DocumentoResponse) => {
    if (!confirm(`¿Eliminar el documento "${doc.nombre}"?`)) return
    setRowBusy(true)
    try { await documentosApi.eliminar(doc.id); load(currentPage, q, tipoFiltro) }
    catch { alert('No se pudo eliminar el documento.') }
    finally { setRowBusy(false) }
  }

  const abrirVersiones = async (doc: DocumentoResponse) => {
    setVersionesDoc(doc); setVersiones([]); setVersionesError(null); setVersionesLoading(true)
    try { setVersiones(await documentosApi.versiones(doc.id)) }
    catch { setVersionesError('No se pudieron cargar las versiones.') }
    finally { setVersionesLoading(false) }
  }

  const iniciarReemplazo = (doc: DocumentoResponse) => {
    setReemplazoId(doc.id)
    reemplazoRef.current?.click()
  }

  const handleReemplazo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !reemplazoId) { setReemplazoId(null); return }
    setRowBusy(true)
    try {
      await reemplazarDocumento(reemplazoId, file)
      load(currentPage, q, tipoFiltro)
    } catch (err) {
      alert(err instanceof ApiCallError ? `Error al reemplazar (HTTP ${err.status}).` : 'Error de conexión al reemplazar el documento.')
    } finally {
      setReemplazoId(null); setRowBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Input oculto para reemplazos */}
      <input ref={reemplazoRef} type="file" className="hidden" onChange={handleReemplazo} aria-hidden="true" tabIndex={-1} />

      {/* Cabecera */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" size="sm" onClick={() => load(currentPage, q, tipoFiltro)}>
          <ArrowsClockwise className="size-3.5" /> Refrescar
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">Repositorio interno del equipo. Los documentos personales de cada estudiante se consultan desde su ficha.</p>

      {/* Subir documento */}
      <Card className="rounded-lg border-border shadow-none">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="up-archivo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Archivo</label>
            <input id="up-archivo" ref={uploadRef} type="file" disabled={uploadBusy}
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="up-tipo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Tipo</label>
            <select id="up-tipo" value={tipoSubida} onChange={(e) => setTipoSubida(e.target.value)} disabled={uploadBusy}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Sin tipo</option>
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="up-vinculo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Vincular a</label>
            <select id="up-vinculo" value={vinculoPgm} onChange={(e) => setVinculoPgm(e.target.value)} disabled={uploadBusy}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Global (sin vínculo)</option>
              {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={handleUpload} disabled={uploadBusy || !archivo}>
            {uploadBusy ? <CircleNotch className="size-4 animate-spin" /> : <UploadSimple className="size-4" />} Subir documento
          </Button>
          {uploadMsg && <span className="text-xs text-muted-foreground">{uploadMsg}</span>}
        </CardContent>
      </Card>

      {/* Filtros */}
      <form onSubmit={aplicarBusqueda} className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Buscar por nombre…" className="w-64 pl-8" />
        </div>
        <select value={tipoFiltro} onChange={(e) => { setTipoFiltro(e.target.value); setCurrent(0) }}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Filtrar por tipo">
          <option value="">Todos los tipos</option>
          {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button type="submit" variant="outline" size="sm">Buscar</Button>
        {(q || tipoFiltro || qInput) && (
          <Button type="button" variant="ghost" size="sm" onClick={limpiarFiltros}>
            <X className="size-3.5" /> Limpiar
          </Button>
        )}
      </form>

      {/* Estados */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <PageSpinner />
          <span className="ml-2 text-sm text-muted-foreground">Cargando documentos…</span>
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <WarningCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => load(currentPage, q, tipoFiltro)}><ArrowsClockwise className="size-4" /> Reintentar</Button>
        </div>
      )}

      {/* Tabla */}
      {!loading && !error && page && (
        page.content.length === 0 ? (
          <Card className="rounded-lg border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <FileText className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {q || tipoFiltro ? 'No hay documentos que coincidan con los filtros.' : 'Aún no hay documentos en el repositorio.'}
              </p>
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
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vinculado a</th>
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
                      <td className="px-4 py-3 text-muted-foreground">{doc.estudianteNombre ?? doc.programaNombre ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">v{doc.numeroVersion}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatoTamano(doc.tamano)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{doc.subidoPor ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatoFecha(doc.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => handleDownload(doc)} disabled={rowBusy} title="Descargar" aria-label={`Descargar ${doc.nombre}`}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40">
                            <DownloadSimple className="size-4" />
                          </button>
                          <button type="button" onClick={() => abrirVersiones(doc)} disabled={rowBusy} title="Versiones" aria-label={`Ver versiones de ${doc.nombre}`}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40">
                            <ClockCounterClockwise className="size-4" />
                          </button>
                          <button type="button" onClick={() => iniciarReemplazo(doc)} disabled={rowBusy} title="Reemplazar" aria-label={`Reemplazar ${doc.nombre}`}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40">
                            <FileArrowUp className="size-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(doc)} disabled={rowBusy} title="Eliminar" aria-label={`Eliminar ${doc.nombre}`}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40">
                            <Trash className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
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

      {/* Drawer de versiones */}
      <Sheet open={versionesDoc !== null} onOpenChange={(open) => { if (!open) setVersionesDoc(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          {versionesDoc && (
            <>
              <SheetHeader className="p-6 border-b border-border shrink-0">
                <SheetTitle className="text-base">Versiones del documento</SheetTitle>
                <SheetDescription className="text-xs">{versionesDoc.nombre}</SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6">
                {versionesLoading && (
                  <div className="flex items-center justify-center py-12">
                    <PageSpinner />
                    <span className="ml-2 text-sm text-muted-foreground">Cargando versiones…</span>
                  </div>
                )}
                {versionesError && !versionesLoading && (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <WarningCircle className="size-6 text-destructive" />
                    <p className="text-sm text-destructive">{versionesError}</p>
                    <Button variant="outline" size="sm" onClick={() => abrirVersiones(versionesDoc)}>
                      <ArrowsClockwise className="size-3.5" /> Reintentar
                    </Button>
                  </div>
                )}
                {!versionesLoading && !versionesError && (
                  versiones.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No hay versiones registradas.</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                      {versiones.map((v) => (
                        <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-foreground tabular-nums">v{v.numeroVersion}{v.actual ? ' · actual' : ''}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{formatoFecha(v.createdAt)} · {formatoTamano(v.tamano)}</span>
                          </div>
                          <button type="button" onClick={() => documentosApi.descargar(v.id, v.nombre).catch(() => alert('No se pudo descargar la versión.'))}
                            title="Descargar versión" aria-label={`Descargar versión ${v.numeroVersion}`}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                            <DownloadSimple className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              <div className="p-4 border-t border-border shrink-0 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setVersionesDoc(null)}>Cerrar</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
