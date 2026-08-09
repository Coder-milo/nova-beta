'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowCounterClockwiseIcon as ArrowCounterClockwise, CheckCircleIcon as CheckCircle, CircleNotchIcon as CircleNotch, CloudArrowUpIcon as CloudArrowUp, DownloadSimpleIcon as DownloadSimple, EyeIcon as Eye, FileIcon as File, FilePdfIcon as FilePdf, FileTextIcon as FileText, TrashIcon as Trash, WarningCircleIcon as WarningCircle, XCircleIcon as XCircle } from '@phosphor-icons/react'
import { ApiCallError, documentosApi, estudiantesApi, mensajeDeError } from '@/lib/api'
import type { DocumentoResponse } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAvisos } from '@/components/ui/avisos'
import { useConfirmar } from '@/components/ui/confirmar'
import { useAuth } from '@/lib/auth'
import { usePreferences } from '@/lib/preferences'
import { FilePreview, FilePreviewSheet } from '@/components/ui/file-preview'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string, locale: 'es' | 'en'): string {
  try {
    // El idioma decide tambien el formato de la fecha: dejarlo fijo en es-CO
    // dejaba "12 sept 2026" dentro de una pantalla por lo demas en ingles.
    return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function FileIcon({ contentType }: { contentType: string | null }) {
  if (contentType?.includes('pdf'))
    return <FilePdf className="size-5 text-red-500" />
  if (contentType?.includes('image'))
    return <File className="size-5 text-blue-500" />
  return <FileText className="size-5 text-muted-foreground" />
}

/**
 * Los textos de esta pantalla, en los dos idiomas.
 *
 * Van junto al componente y no en el diccionario global de `preferences`:
 * ese guarda los términos que se repiten por toda la aplicación —la
 * navegación, los estados—, y meter aquí treinta cadenas que sólo usa esta
 * pantalla lo convertiría en un cajón. Es el mismo patrón que ya sigue el
 * chat del estudiante.
 */
function textos(english: boolean) {
  return english
    ? {
        versionActual: 'Current version',
        hvTitulo: 'CAC résumé',
        hvDescripcion: 'Your official résumé is generated from the up-to-date information in your profile.',
        hvDescargar: 'Download résumé', hvPreparando: 'Preparing…',
        subirTitulo: 'Upload a document',
        subirFormatos: 'Accepted formats: PDF, DOCX, PNG, JPG. Maximum size: 10 MB.',
        tipo: 'Document type', sinCategoria: 'No category',
        soltar: 'Drag a file here or click to choose one',
        soltarPie: 'PDF, DOCX, PNG, JPG · Max. 10 MB',
        subido: 'Document uploaded.', subiendo: 'Uploading…', subir: 'Upload document',
        mis: 'My documents', reintentar: 'Retry',
        vacio: 'You have not uploaded any documents yet. The files you upload will be reviewed and validated by your coordinator.',
        vistaPrevia: 'Preview', descargar: 'Download', eliminar: 'Delete',
        errorCargar: 'Documents could not be loaded.',
        errorSinArchivo: 'Choose a file first.',
        errorSubir: 'The file could not be uploaded.',
        errorDescargar: 'The file could not be downloaded.',
        errorEliminar: 'The document could not be deleted.',
        errorHv: 'Your résumé could not be prepared.',
        confirmarTitulo: 'Delete document',
        confirmarDescripcion: 'This document will be removed from your record. This cannot be undone.',
      }
    : {
        versionActual: 'Versión actual',
        hvTitulo: 'Hoja de vida CAC',
        hvDescripcion: 'Tu hoja de vida oficial se genera con la información actualizada de tu perfil.',
        hvDescargar: 'Descargar hoja de vida', hvPreparando: 'Preparando…',
        subirTitulo: 'Subir documento',
        subirFormatos: 'Formatos admitidos: PDF, DOCX, PNG, JPG. Tamaño máximo: 10 MB.',
        tipo: 'Tipo de documento', sinCategoria: 'Sin categoría',
        soltar: 'Arrastra aquí o haz clic para seleccionar',
        soltarPie: 'PDF, DOCX, PNG, JPG · Máx. 10 MB',
        subido: 'Documento subido correctamente.', subiendo: 'Subiendo…', subir: 'Subir documento',
        mis: 'Mis documentos', reintentar: 'Reintentar',
        vacio: 'Aún no has subido ningún documento. Los archivos que subas serán revisados y validados por tu coordinador.',
        vistaPrevia: 'Vista previa', descargar: 'Descargar', eliminar: 'Eliminar',
        errorCargar: 'No se pudieron cargar los documentos.',
        errorSinArchivo: 'Selecciona un archivo primero.',
        errorSubir: 'No se pudo subir el archivo.',
        errorDescargar: 'No se pudo descargar el archivo.',
        errorEliminar: 'No se pudo eliminar el documento.',
        errorHv: 'No se pudo preparar tu hoja de vida.',
        confirmarTitulo: 'Eliminar documento',
        confirmarDescripcion: 'Este documento se quitará de tu expediente. No se puede deshacer.',
      }
}

export function StudentDocumentos() {
  const { user } = useAuth()
  const { confirmar, dialogo } = useConfirmar()
  const { mostrarError, avisos } = useAvisos()
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const [documentos, setDocumentos] = useState<DocumentoResponse[]>([])
  const [tipos, setTipos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [selectedTipo, setSelectedTipo] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DocumentoResponse | null>(null)
  const [downloadingCv, setDownloadingCv] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cargar = async () => {
    setLoading(true)
    setError(null)
    try {
      const [page, tiposData] = await Promise.all([
        documentosApi.mios({ size: 100 }),
        documentosApi.tipos(),
      ])
      setDocumentos(page.content)
      setTipos(tiposData)
    } catch (e) {
      setError(
        e instanceof ApiCallError
          ? (e.body.message ?? `Error ${e.status}`)
          : T.errorCargar,
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setUploadError(null)
    setUploadSuccess(false)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError(T.errorSinArchivo)
      return
    }
    setUploading(true)
    setUploadError(null)
    setUploadSuccess(false)
    try {
      const doc = await documentosApi.subirMio(selectedFile, selectedTipo || undefined)
      setDocumentos((prev) => [doc, ...prev])
      setSelectedFile(null)
      setSelectedTipo('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)
    } catch (e) {
      setUploadError(
        e instanceof ApiCallError
          ? (e.body.message ?? `Error ${e.status}`)
          : T.errorSubir,
      )
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (doc: DocumentoResponse) => {
    try {
      await documentosApi.descargarMio(doc.id, doc.nombre)
    } catch {
      mostrarError(T.errorDescargar)
    }
  }

  const handleDelete = async (doc: DocumentoResponse) => {
    if (
      !(await confirmar({
        titulo: T.confirmarTitulo,
        descripcion: `${T.confirmarDescripcion} · ${doc.nombre}`,
        textoConfirmar: T.eliminar,
      }))
    )
      return
    try {
      await documentosApi.eliminarMio(doc.id)
      setDocumentos((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (e) {
      mostrarError(mensajeDeError(e, T.errorEliminar))
    }
  }

  const handleDownloadCv = async () => {
    setDownloadingCv(true)
    try {
      await estudiantesApi.descargarMiHvPdf()
    } catch {
      mostrarError(T.errorHv)
    } finally { setDownloadingCv(false) }
  }

  if (loading) {
    return (
      <div className="flex min-h-60 items-center justify-center gap-2 text-sm text-muted-foreground">
        <CircleNotch className="size-5 animate-spin" />
        Cargando documentos…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <WarningCircle className="mt-0.5 size-4 shrink-0" />
          {error}
          <button
            onClick={cargar}
            className="ml-auto flex items-center gap-1 text-xs underline"
          >
            <ArrowCounterClockwise className="size-3" /> {T.reintentar}
          </button>
        </div>
      )}

      <Card className="border-primary/20 bg-primary/[0.03] shadow-none">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-primary/10"><FilePdf className="size-5 text-primary" /></span><div><p className="text-sm font-semibold">{T.hvTitulo}</p><p className="mt-0.5 text-xs text-muted-foreground">{T.hvDescripcion}</p></div></div>
          <Button variant="outline" size="sm" onClick={() => void handleDownloadCv()} disabled={downloadingCv}>{downloadingCv ? <CircleNotch className="size-4 animate-spin" /> : <DownloadSimple className="size-4" />}{downloadingCv ? T.hvPreparando : T.hvDescargar}</Button>
        </CardContent>
      </Card>

      {/* ── Upload zone ────────────────────────────────────── */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">{T.subirTitulo}</CardTitle>
          <CardDescription>
            {T.subirFormatos}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Tipo */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {T.tipo}
              </label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedTipo}
                onChange={(e) => setSelectedTipo(e.target.value)}
              >
                <option value="">{T.sinCategoria}</option>
                {tipos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Drop zone */}
            <label
              htmlFor="doc-upload"
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                selectedFile
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-secondary/40'
              }`}
            >
              <CloudArrowUp
                className={`size-9 ${selectedFile ? 'text-primary' : 'text-muted-foreground'}`}
              />
              {selectedFile ? (
                <div>
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(selectedFile.size)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">
                    {T.soltar}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {T.soltarPie}
                  </p>
                </div>
              )}
              <input
                id="doc-upload"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>

            {selectedFile && <FilePreview archivo={selectedFile} nombre={selectedFile.name} contentType={selectedFile.type} />}

            {uploadError && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <XCircle className="size-4" /> {uploadError}
              </p>
            )}
            {uploadSuccess && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle className="size-4" /> {T.subido}
              </p>
            )}

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="w-full sm:w-auto"
            >
              {uploading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" /> {T.subiendo}
                </>
              ) : (
                <>
                  <CloudArrowUp className="size-4" /> {T.subir}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Lista de documentos ────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {T.mis} ({documentos.length})
        </h2>

        {documentos.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
                <FileText className="size-5" />
              </span>
              <p className="max-w-sm text-sm">
                {T.vacio}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {documentos.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <FileIcon contentType={doc.contentType} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.nombre}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {doc.tipo && (
                      <Badge variant="outline" className="text-xs">
                        {doc.tipo}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(doc.tamano)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(doc.createdAt, locale)}
                    </span>
                    {doc.actual && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle className="size-3" /> {T.versionActual}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title={T.vistaPrevia}
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <Eye className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={T.descargar}
                    onClick={() => handleDownload(doc)}
                  >
                    <DownloadSimple className="size-4" />
                  </Button>
                  {doc.subidoPor?.toLocaleLowerCase() === user?.email?.toLocaleLowerCase() && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title={T.eliminar}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDelete(doc)}
                    >
                      <Trash className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {previewDoc && <FilePreviewSheet
        open={Boolean(previewDoc)}
        onOpenChange={(open) => { if (!open) setPreviewDoc(null) }}
        endpoint={`/api/v1/documentos/${previewDoc.id}/mi-descarga`}
        nombre={previewDoc.nombre}
        contentType={previewDoc.contentType}
        onDownload={() => handleDownload(previewDoc)}
      />}
      {dialogo}
      {avisos}
    </div>
  )
}
