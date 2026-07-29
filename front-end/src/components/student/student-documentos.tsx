'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowCounterClockwise,
  CheckCircle,
  CircleNotch,
  CloudArrowUp,
  DownloadSimple,
  File,
  FilePdf,
  FileText,
  Trash,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react'
import { ApiCallError, documentosApi } from '@/lib/api'
import type { DocumentoResponse } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
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

export function StudentDocumentos() {
  const { user } = useAuth()
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
          : 'No se pudieron cargar los documentos.',
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
      setUploadError('Selecciona un archivo primero.')
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
          : 'No se pudo subir el archivo.',
      )
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (doc: DocumentoResponse) => {
    try {
      await documentosApi.descargarMio(doc.id, doc.nombre)
    } catch {
      alert('No se pudo descargar el archivo.')
    }
  }

  const handleDelete = async (doc: DocumentoResponse) => {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return
    try {
      await documentosApi.eliminarMio(doc.id)
      setDocumentos((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (e) {
      alert(
        e instanceof ApiCallError
          ? (e.body.message ?? 'No se pudo eliminar.')
          : 'No se pudo eliminar el documento.',
      )
    }
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
            <ArrowCounterClockwise className="size-3" /> Reintentar
          </button>
        </div>
      )}

      {/* ── Upload zone ────────────────────────────────────── */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Subir documento</CardTitle>
          <CardDescription>
            Formatos admitidos: PDF, DOCX, PNG, JPG. Tamaño máximo: 10 MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Tipo */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Tipo de documento
              </label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedTipo}
                onChange={(e) => setSelectedTipo(e.target.value)}
              >
                <option value="">Sin categoría</option>
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
                    Arrastra aquí o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, DOCX, PNG, JPG · Máx. 10 MB
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

            {uploadError && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <XCircle className="size-4" /> {uploadError}
              </p>
            )}
            {uploadSuccess && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle className="size-4" /> Documento subido correctamente.
              </p>
            )}

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="w-full sm:w-auto"
            >
              {uploading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" /> Subiendo…
                </>
              ) : (
                <>
                  <CloudArrowUp className="size-4" /> Subir documento
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Lista de documentos ────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Mis documentos ({documentos.length})
        </h2>

        {documentos.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
                <FileText className="size-5" />
              </span>
              <p className="max-w-sm text-sm">
                Aún no has subido ningún documento. Los archivos que subas
                serán revisados y validados por tu coordinador.
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
                      {formatDate(doc.createdAt)}
                    </span>
                    {doc.actual && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle className="size-3" /> Versión actual
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Descargar"
                    onClick={() => handleDownload(doc)}
                  >
                    <DownloadSimple className="size-4" />
                  </Button>
                  {doc.subidoPor?.toLocaleLowerCase() === user?.email?.toLocaleLowerCase() && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Eliminar"
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
    </div>
  )
}
