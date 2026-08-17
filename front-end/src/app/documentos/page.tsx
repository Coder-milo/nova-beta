'use client'

import { ChevronLeft as CaretLeft, ChevronRight as CaretRight, CircleAlert as WarningCircle, Download as DownloadSimple, Eye, FileText, FileUp as FileArrowUp, History as ClockCounterClockwise, LoaderCircle as CircleNotch, RefreshCw as ArrowsClockwise, Search as MagnifyingGlass, Trash2 as Trash, Upload as UploadSimple, X } from 'lucide-react'
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
import { FilePreview, FilePreviewSheet } from '@/components/ui/file-preview'
import { documentosApi, programasApi, ApiCallError, mensajeDeError } from '@/lib/api'
import { useAvisos } from '@/components/ui/avisos'
import { useConfirmar } from '@/components/ui/confirmar'
import type { DocumentoResponse, ProgramaResponse, Page, ApiError } from '@/lib/types'
import { useSearchParams } from '@/compat/next-navigation'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

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

/**
 * `en-GB` y no `en-US`: el resto del sistema muestra el dia primero, y un
 * «08/09» que cambia de significado con el idioma es peor que no traducir.
 */
function formatoFecha(fecha: string, english: boolean): string {
  try {
    return new Date(fecha).toLocaleString(english ? 'en-GB' : 'es-CO', { dateStyle: 'medium', timeStyle: 'short' })
  } catch { return fecha }
}

// ─── Página ───────────────────────────────────────────────────────────────────

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        repositorioInternoDel: "Internal team repository. Each student's own documents are viewed from their record.",
        esteRepositorioEs: 'This repository is only for team files; student documents stay in their record.',
        noHayDocumentos: 'No documents match the filters.',
        aunNoHay: 'There are no documents in the repository yet.',
        errorDeConexion: 'Connection error while uploading the document.',
        errorDeConexionX: 'Connection error while replacing the document.',
        noSePudieron: 'The versions could not be loaded.',
        noSePudo: 'The document could not be downloaded.',
        noSePudoX: 'The document could not be deleted.',
        noSePudoXX: 'The version could not be downloaded.',
        noHayVersiones: 'No versions recorded.',
        documentoSubidoCorrectamente: 'Document uploaded.',
        sinPermisosInicia: 'No permission. Sign in.',
        guardarDocumentoInstitucional: 'Save an institutional document',
        versionesDelDocumento: 'Document versions',
        cargandoDocumentos: 'Loading documents…',
        cargandoVersiones: 'Loading versions…',
        buscarPorNombre: 'Search by name…',
        globalSinVinculo: 'Global (not linked)',
        eliminarDocumento: 'Delete document',
        descargarVersion: 'Download version',
        subirDocumento: 'Upload document',
        filtrarPorTipo: 'Filter by type',
        todosLosTipos: 'All types',
        vistaPrevia: 'Preview',
        vinculadoA: 'Linked to',
        subidoPor: 'Uploaded by',
        vincularA: 'Link to',
        reemplazar: 'Replace',
        versiones: 'Versions',
        version: 'Version',
        sinTipo: 'No type',
        tamano: 'Size',
        limpiar: 'Clear',
        tipo: 'Type',
        actual: ' · current',
        errorAlCargar: (s: number) => `Documents could not be loaded (HTTP ${s}).`,
        errorAlSubir: (s: number) => `Upload failed (HTTP ${s}).`,
        confirmarEliminar: (n: string) => `Document "${n}" will be deleted. This cannot be undone.`,
        previsualizarX: (n: string) => `Preview ${n}`,
        descargarX: (n: string) => `Download ${n}`,
        verVersionesX: (n: string) => `View versions of ${n}`,
        reemplazarX: (n: string) => `Replace ${n}`,
        eliminarX: (n: string) => `Delete ${n}`,
        descargarVersionX: (n: number) => `Download version ${n}`,
        paginaDe: (p: number, total: number, elementos: number) => `Page ${p} of ${total} · ${elementos} documents`,
      }
    : {
        repositorioInternoDel: 'Repositorio interno del equipo. Los documentos personales de cada estudiante se consultan desde su ficha.',
        esteRepositorioEs: 'Este repositorio es solo para archivos del equipo; los documentos del estudiante permanecen en su expediente.',
        noHayDocumentos: 'No hay documentos que coincidan con los filtros.',
        aunNoHay: 'Aún no hay documentos en el repositorio.',
        errorDeConexion: 'Error de conexión al subir el documento.',
        errorDeConexionX: 'Error de conexión al reemplazar el documento.',
        noSePudieron: 'No se pudieron cargar las versiones.',
        noSePudo: 'No se pudo descargar el documento.',
        noSePudoX: 'No se pudo eliminar el documento.',
        noSePudoXX: 'No se pudo descargar la versión.',
        noHayVersiones: 'No hay versiones registradas.',
        documentoSubidoCorrectamente: 'Documento subido correctamente.',
        sinPermisosInicia: 'Sin permisos. Inicia sesión.',
        guardarDocumentoInstitucional: 'Guardar documento institucional',
        versionesDelDocumento: 'Versiones del documento',
        cargandoDocumentos: 'Cargando documentos…',
        cargandoVersiones: 'Cargando versiones…',
        buscarPorNombre: 'Buscar por nombre…',
        globalSinVinculo: 'Global (sin vínculo)',
        eliminarDocumento: 'Eliminar documento',
        descargarVersion: 'Descargar versión',
        subirDocumento: 'Subir documento',
        filtrarPorTipo: 'Filtrar por tipo',
        todosLosTipos: 'Todos los tipos',
        vistaPrevia: 'Vista previa',
        vinculadoA: 'Vinculado a',
        subidoPor: 'Subido por',
        vincularA: 'Vincular a',
        reemplazar: 'Reemplazar',
        versiones: 'Versiones',
        version: 'Versión',
        sinTipo: 'Sin tipo',
        tamano: 'Tamaño',
        limpiar: 'Limpiar',
        tipo: 'Tipo',
        actual: ' · actual',
        errorAlCargar: (s: number) => `Error al cargar documentos (HTTP ${s}).`,
        errorAlSubir: (s: number) => `Error al subir (HTTP ${s}).`,
        confirmarEliminar: (n: string) => `Se eliminará el documento "${n}". Esta acción no se puede deshacer.`,
        previsualizarX: (n: string) => `Previsualizar ${n}`,
        descargarX: (n: string) => `Descargar ${n}`,
        verVersionesX: (n: string) => `Ver versiones de ${n}`,
        reemplazarX: (n: string) => `Reemplazar ${n}`,
        eliminarX: (n: string) => `Eliminar ${n}`,
        descargarVersionX: (n: number) => `Descargar versión ${n}`,
        paginaDe: (p: number, total: number, elementos: number) => `Página ${p} de ${total} · ${elementos} documentos`,
      }
}

export default function DocumentosPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const { confirmar, dialogo } = useConfirmar()
  const { mostrarError, avisos } = useAvisos()
  const [page, setPage]           = useState<Page<DocumentoResponse> | null>(null)
  const [currentPage, setCurrent] = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // Filtros
  /**
   * El término que trae la URL, si se llegó desde la búsqueda global.
   *
   * La cabecera enlaza a `/documentos?q=…` al pulsar un resultado, y esta
   * pantalla no lo leía: se aterrizaba en la lista completa y había que
   * volver a escribir lo que ya se había escrito arriba. Se escucha el
   * parámetro y no sólo el montaje, porque estando ya aquí la ruta no cambia
   * y el componente no se vuelve a montar.
   */
  const parametros = useSearchParams()
  const qDeLaUrl = parametros.get('q') ?? ''

  const [q, setQ]           = useState(qDeLaUrl)
  const [qInput, setQInput] = useState(qDeLaUrl)

  useEffect(() => {
    if (!qDeLaUrl) return
    setQ(qDeLaUrl)
    setQInput(qDeLaUrl)
    setCurrent(0)
  }, [qDeLaUrl])
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
  const [previewDoc, setPreviewDoc] = useState<DocumentoResponse | null>(null)

  // ── Cargar ────────────────────────────────────────────────────────────────
  const load = useCallback(async (p: number, query: string, tipo: string) => {
    setLoading(true); setError(null)
    try {
      setPage(await documentosApi.buscar({ soloAdministrativos: true, q: query || undefined, tipo: tipo || undefined, page: p, size: 20 }))
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.status === 401 || err.status === 403
          ? T.sinPermisosInicia
          : T.errorAlCargar(err.status))
      } else { setError(C.errorConexion) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(currentPage, q, tipoFiltro) }, [load, currentPage, q, tipoFiltro])

  useEffect(() => {
    documentosApi.tipos().then(setTipos).catch(() => setTipos([]))
    programasApi.listar().then(setProgramas).catch(() => setProgramas([]))
  }, [])

  const aplicarBusqueda = (e: React.SyntheticEvent) => {
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
      setUploadMsg(T.documentoSubidoCorrectamente)
      load(currentPage, q, tipoFiltro)
    } catch (err) {
      setUploadMsg(err instanceof ApiCallError ? T.errorAlSubir(err.status) : T.errorDeConexion)
    } finally { setUploadBusy(false) }
  }

  // ── Acciones de fila ──────────────────────────────────────────────────────
  const handleDownload = async (doc: DocumentoResponse) => {
    try { await documentosApi.descargar(doc.id, doc.nombre) }
    catch { mostrarError(T.noSePudo) }
  }

  const handleDelete = async (doc: DocumentoResponse) => {
    if (!(await confirmar({
      titulo: T.eliminarDocumento,
      descripcion: T.confirmarEliminar(doc.nombre),
      textoConfirmar: C.eliminar,
    }))) return
    setRowBusy(true)
    try { await documentosApi.eliminar(doc.id); load(currentPage, q, tipoFiltro) }
    catch { mostrarError(T.noSePudoX) }
    finally { setRowBusy(false) }
  }

  const abrirVersiones = async (doc: DocumentoResponse) => {
    setVersionesDoc(doc); setVersiones([]); setVersionesError(null); setVersionesLoading(true)
    try { setVersiones(await documentosApi.versiones(doc.id)) }
    catch { setVersionesError(T.noSePudieron) }
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
      mostrarError(mensajeDeError(err, T.errorDeConexionX))
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
          <ArrowsClockwise className="size-3.5" /> {C.refrescar}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{T.repositorioInternoDel}</p>

      {/* Subir documento */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="space-y-4 py-5">
          <div><p className="text-sm font-semibold text-foreground">{T.guardarDocumentoInstitucional}</p><p className="mt-1 text-xs text-muted-foreground">{T.esteRepositorioEs}</p></div>
          <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="up-archivo" className="text-[11px] uppercase tracking-wider text-muted-foreground">{C.archivo}</label>
            <input id="up-archivo" ref={uploadRef} type="file" disabled={uploadBusy}
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="text-xs text-muted-foreground file:mr-3 file:rounded-xl file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="up-tipo" className="text-[11px] uppercase tracking-wider text-muted-foreground">{T.tipo}</label>
            <select id="up-tipo" value={tipoSubida} onChange={(e) => setTipoSubida(e.target.value)} disabled={uploadBusy}
              className="h-10 rounded-xl border border-input bg-card/90 px-3 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15">
              <option value="">{T.sinTipo}</option>
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="up-vinculo" className="text-[11px] uppercase tracking-wider text-muted-foreground">{T.vincularA}</label>
            <select id="up-vinculo" value={vinculoPgm} onChange={(e) => setVinculoPgm(e.target.value)} disabled={uploadBusy}
              className="h-10 rounded-xl border border-input bg-card/90 px-3 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15">
              <option value="">{T.globalSinVinculo}</option>
              {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={handleUpload} disabled={uploadBusy || !archivo}>
            {uploadBusy ? <CircleNotch className="size-4 animate-spin" /> : <UploadSimple className="size-4" />} Subir documento
          </Button>
          {uploadMsg && <span className="text-xs text-muted-foreground">{uploadMsg}</span>}
          </div>
          {archivo && <FilePreview archivo={archivo} nombre={archivo.name} contentType={archivo.type} />}
        </CardContent>
      </Card>

      {/* Filtros */}
      <form onSubmit={aplicarBusqueda} className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={T.buscarPorNombre} className="w-64 pl-8" />
        </div>
        <select value={tipoFiltro} onChange={(e) => { setTipoFiltro(e.target.value); setCurrent(0) }}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label={T.filtrarPorTipo}>
          <option value="">{T.todosLosTipos}</option>
          {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button type="submit" variant="outline" size="sm">{C.buscar}</Button>
        {(q || tipoFiltro || qInput) && (
          <Button type="button" variant="ghost" size="sm" onClick={limpiarFiltros}>
            <X className="size-3.5" /> {T.limpiar}
          </Button>
        )}
      </form>

      {/* Estados */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <PageSpinner />
          <span className="ml-2 text-sm text-muted-foreground">{T.cargandoDocumentos}</span>
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <WarningCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => load(currentPage, q, tipoFiltro)}><ArrowsClockwise className="size-4" /> {C.reintentar}</Button>
        </div>
      )}

      {/* Tabla */}
      {!loading && !error && page && (
        page.content.length === 0 ? (
          <Card className="rounded-lg border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <FileText className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {q || tipoFiltro ? T.noHayDocumentos : T.aunNoHay}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-lg border-border shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{C.nombre}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{T.tipo}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{T.vinculadoA}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{T.version}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{T.tamano}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{T.subidoPor}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{C.fecha}</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">{C.acciones}</th>
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
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatoFecha(doc.createdAt, locale === 'en')}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => setPreviewDoc(doc)} disabled={rowBusy} title={T.vistaPrevia} aria-label={T.previsualizarX(doc.nombre)}
                            className="inline-flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40">
                            <Eye className="size-4" />
                          </button>
                          <button type="button" onClick={() => handleDownload(doc)} disabled={rowBusy} title={C.descargar} aria-label={T.descargarX(doc.nombre)}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40">
                            <DownloadSimple className="size-4" />
                          </button>
                          <button type="button" onClick={() => abrirVersiones(doc)} disabled={rowBusy} title={T.versiones} aria-label={T.verVersionesX(doc.nombre)}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40">
                            <ClockCounterClockwise className="size-4" />
                          </button>
                          <button type="button" onClick={() => iniciarReemplazo(doc)} disabled={rowBusy} title={T.reemplazar} aria-label={T.reemplazarX(doc.nombre)}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40">
                            <FileArrowUp className="size-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(doc)} disabled={rowBusy} title={C.eliminar} aria-label={T.eliminarX(doc.nombre)}
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
                  {T.paginaDe(page.number + 1, page.totalPages, page.totalElements)}
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
                <SheetTitle className="text-base">{T.versionesDelDocumento}</SheetTitle>
                <SheetDescription className="text-xs">{versionesDoc.nombre}</SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6">
                {versionesLoading && (
                  <div className="flex items-center justify-center py-12">
                    <PageSpinner />
                    <span className="ml-2 text-sm text-muted-foreground">{T.cargandoVersiones}</span>
                  </div>
                )}
                {versionesError && !versionesLoading && (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <WarningCircle className="size-6 text-destructive" />
                    <p className="text-sm text-destructive">{versionesError}</p>
                    <Button variant="outline" size="sm" onClick={() => abrirVersiones(versionesDoc)}>
                      <ArrowsClockwise className="size-3.5" /> {C.reintentar}
                    </Button>
                  </div>
                )}
                {!versionesLoading && !versionesError && (
                  versiones.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">{T.noHayVersiones}</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                      {versiones.map((v) => (
                        <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-foreground tabular-nums">v{v.numeroVersion}{v.actual ? T.actual : ''}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{formatoFecha(v.createdAt, locale === 'en')} · {formatoTamano(v.tamano)}</span>
                          </div>
                          <button type="button" onClick={() => documentosApi.descargar(v.id, v.nombre).catch(() => mostrarError(T.noSePudoXX))}
                            title={T.descargarVersion} aria-label={T.descargarVersionX(v.numeroVersion)}
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
                <Button variant="outline" size="sm" onClick={() => setVersionesDoc(null)}>{C.cerrar}</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      {previewDoc && <FilePreviewSheet
        open={Boolean(previewDoc)}
        onOpenChange={(open) => { if (!open) setPreviewDoc(null) }}
        endpoint={`/api/v1/documentos/${previewDoc.id}/descargar`}
        nombre={previewDoc.nombre}
        contentType={previewDoc.contentType}
        onDownload={() => handleDownload(previewDoc)}
      />}
      {dialogo}
      {avisos}
    </div>
  )
}
