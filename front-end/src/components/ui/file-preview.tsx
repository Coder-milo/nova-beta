'use client'

import { useEffect, useMemo, useState } from 'react'
import { CircleAlert as WarningCircle, CirclePlay as PlayCircle, Download as DownloadSimple, File, FileText, FileText as FilePdf, Image as ImageSquare, LoaderCircle as CircleNotch } from 'lucide-react'
import { ApiCallError, apiBlob } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { usePreferences } from '@/lib/preferences'

type ArchivoPrevisualizable = File | Blob | null | undefined

function tipoDeArchivo(nombre: string, tipo?: string | null) {
  const contenido = (tipo ?? '').toLowerCase()
  const extension = nombre.split('.').pop()?.toLowerCase() ?? ''
  if (contenido.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) return 'imagen'
  if (contenido.includes('pdf') || extension === 'pdf') return 'pdf'
  if (contenido.includes('video') || ['mp4', 'webm', 'mov'].includes(extension)) return 'video'
  if (contenido.includes('audio') || ['mp3', 'wav', 'ogg', 'm4a'].includes(extension)) return 'audio'
  return 'archivo'
}

function formatoTamano(bytes?: number) {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Vista segura para los archivos antes de subirlos o tras cargarlos desde el servidor. */
/** Textos propios de este componente, en los dos idiomas. */
function textos(english: boolean) {
  return english
    ? {
        archivoListo: 'File ready to upload',
        esteFormatoSe: 'This format is kept intact and can be downloaded after uploading.',
        noSePudoCargar: 'The file preview could not be loaded.',
        vistaPreviaDe: (n: string) => `Preview of ${n}`,
      }
    : {
        archivoListo: 'Archivo listo para subir',
        esteFormatoSe: 'Este formato se conserva intacto y se puede descargar después de subirlo.',
        noSePudoCargar: 'No se pudo cargar la vista previa del archivo.',
        vistaPreviaDe: (n: string) => `Vista previa de ${n}`,
      }
}

export function FilePreview({ archivo, nombre, contentType, className = '' }: {
  archivo: ArchivoPrevisualizable
  nombre: string
  contentType?: string | null
  className?: string
}) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const [url, setUrl] = useState<string | null>(null)
  const tipo = useMemo(() => tipoDeArchivo(nombre, contentType ?? (archivo instanceof File ? archivo.type : archivo?.type)), [archivo, contentType, nombre])

  useEffect(() => {
    if (!archivo) { setUrl(null); return }
    const objectUrl = URL.createObjectURL(archivo)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [archivo])

  if (!archivo || !url) return null

  if (tipo === 'imagen') return <div className={`overflow-hidden rounded-xl border border-border bg-muted/30 ${className}`}><img src={url} alt={T.vistaPreviaDe(nombre)} className="max-h-72 w-full object-contain" /></div>
  if (tipo === 'pdf') return <iframe src={url} title={T.vistaPreviaDe(nombre)} className={`h-[28rem] w-full rounded-xl border border-border bg-white ${className}`} />
  if (tipo === 'video') return <video controls src={url} className={`max-h-80 w-full rounded-xl border border-border bg-black ${className}`} />
  if (tipo === 'audio') return <div className={`rounded-xl border border-border bg-muted/20 p-4 ${className}`}><audio controls src={url} className="w-full" /></div>

  return <div className={`flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 ${className}`}><span className="flex size-10 items-center justify-center rounded-lg bg-background"><FileText className="size-5 text-muted-foreground" /></span><div><p className="text-sm font-medium">{T.archivoListo}</p><p className="text-xs text-muted-foreground">{T.esteFormatoSe}</p></div></div>
}

/** Hoja de previsualización autenticada para documentos ya almacenados en el CRM. */
export function FilePreviewSheet({
  open, onOpenChange, endpoint, nombre, contentType, onDownload,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  endpoint: string | null
  nombre: string
  contentType?: string | null
  onDownload?: () => void
}) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const [archivo, setArchivo] = useState<Blob | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !endpoint) return
    let cancelado = false
    setArchivo(null); setError(null); setCargando(true)
    apiBlob(endpoint)
      .then((resultado) => { if (!cancelado) setArchivo(resultado) })
      .catch((err) => {
        if (!cancelado) setError(err instanceof ApiCallError
          ? (err.body.message ?? `Error ${err.status}.`)
          : T.noSePudoCargar)
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [open, endpoint])

  const tipo = tipoDeArchivo(nombre, contentType)
  const Icono = tipo === 'pdf' ? FilePdf : tipo === 'imagen' ? ImageSquare : tipo === 'video' ? PlayCircle : File

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full p-0 sm:max-w-3xl">
      <SheetHeader className="border-b border-border bg-muted/20 p-6">
        <div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icono className="size-5" /></span><div className="min-w-0"><SheetTitle className="truncate">Vista previa</SheetTitle><SheetDescription className="mt-1 truncate">{nombre}</SheetDescription></div></div>
      </SheetHeader>
      <div className="flex h-[calc(100dvh-8.5rem)] flex-col gap-4 overflow-y-auto p-6">
        {cargando && <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"><CircleNotch className="size-5 animate-spin" />Cargando archivo…</div>}
        {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"><WarningCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}
        {archivo && <FilePreview archivo={archivo} nombre={nombre} contentType={contentType ?? archivo.type} className="flex-1" />}
        {archivo && formatoTamano(archivo.size) && <p className="text-xs text-muted-foreground">Tamaño del archivo: {formatoTamano(archivo.size)}</p>}
        {onDownload && <div className="mt-auto flex justify-end border-t border-border pt-4"><Button variant="outline" onClick={onDownload}><DownloadSimple className="size-4" /> Descargar archivo</Button></div>}
      </div>
    </SheetContent>
  </Sheet>
}
