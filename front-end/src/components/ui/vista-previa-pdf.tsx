'use client'

/**
 * Visor de un PDF que llega por una llamada autenticada.
 *
 * <p>No se puede apuntar un `<iframe src="/api/…">` directamente: la petición
 * del iframe no lleva las cabeceras del cliente de API y, cuando la sesión
 * caduca, el navegador enseña el JSON del error dentro del marco en vez del
 * documento. Se descarga el blob con `fetch`, se crea una URL de objeto y se
 * revoca al desmontar; sin revocar, cada previsualización deja el PDF entero
 * retenido en memoria hasta recargar la página.
 */

import { useCallback, useEffect, useState } from 'react'
import { ArrowsClockwiseIcon as ArrowsClockwise, CircleNotchIcon as CircleNotch, DownloadSimpleIcon as DownloadSimple, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
import { ApiCallError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePreferences } from '@/lib/preferences'

export interface VistaPreviaPdfProps {
  /** Trae el PDF. Debe ser estable (`useCallback`) o el visor se recargaría solo. */
  cargar: () => Promise<Blob>
  /** Se llama al pulsar «Descargar». Sin esto no se pinta el botón. */
  onDescargar?: () => void | Promise<void>
  titulo?: string
  descripcion?: string
  altura?: string
  className?: string
}

/** Textos propios de este componente, en los dos idiomas. */
function textos(english: boolean) {
  return english
    ? {
        sinPermiso: 'Your session cannot view this document.',
        sinDatos: 'There is not enough information to generate the résumé yet.',
        sinConexion: 'Could not reach the server.',
        generandoVistaPrevia: 'Generating the preview…',
        vistaPrevia: 'Preview',
      }
    : {
        sinPermiso: 'Tu sesión no tiene permiso para ver este documento.',
        sinDatos: 'Todavía no hay información suficiente para generar la hoja de vida.',
        sinConexion: 'No se pudo conectar con el servidor.',
        generandoVistaPrevia: 'Generando la vista previa…',
        vistaPrevia: 'Vista previa',
      }
}

/** No es un componente: no puede leer el idioma, se lo pasan. */
function mensajeDe(error: unknown, T: ReturnType<typeof textos>): string {
  if (error instanceof ApiCallError) {
    if (error.status === 401 || error.status === 403) return T.sinPermiso
    if (error.status === 404) return T.sinDatos
    return error.body.message ?? `Error ${error.status}.`
  }
  return T.sinConexion
}

export function VistaPreviaPdf({
  cargar,
  onDescargar,
  titulo,
  descripcion,
  altura = '32rem',
  className,
}: VistaPreviaPdfProps) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const rotulo = titulo ?? T.vistaPrevia
  const [url, setUrl] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [descargando, setDescargando] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    let creada: string | null = null
    setCargando(true)
    setError(null)

    cargar()
      .then((blob) => {
        if (!vivo) return
        creada = URL.createObjectURL(blob)
        setUrl(creada)
      })
      .catch((e) => {
        if (vivo) setError(mensajeDe(e, T))
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })

    return () => {
      vivo = false
      if (creada) URL.revokeObjectURL(creada)
      setUrl(null)
    }
  }, [cargar, intento])

  const descargar = useCallback(async () => {
    if (!onDescargar) return
    setDescargando(true)
    setError(null)
    try {
      await onDescargar()
    } catch (e) {
      setError(mensajeDe(e, T))
    } finally {
      setDescargando(false)
    }
  }, [onDescargar])

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{rotulo}</p>
          {descripcion && <p className="text-xs text-muted-foreground">{descripcion}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setIntento((n) => n + 1)} disabled={cargando}>
            <ArrowsClockwise className={cn('size-3.5', cargando && 'animate-spin')} />
            Actualizar
          </Button>
          {onDescargar && (
            <Button size="sm" onClick={descargar} disabled={descargando}>
              {descargando ? <CircleNotch className="size-3.5 animate-spin" /> : <DownloadSimple className="size-3.5" />}
              Descargar PDF
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-8 text-center">
          <WarningCircle className="size-7 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </Button>
        </div>
      ) : cargando || !url ? (
        <div
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/30 text-sm text-muted-foreground"
          style={{ height: altura }}
        >
          <CircleNotch className="size-5 animate-spin" />{T.generandoVistaPrevia}</div>
      ) : (
        <iframe
          // `title` es lo que anuncia un lector de pantalla al llegar al marco;
          // sin él solo dice «marco».
          title={rotulo}
          src={url}
          className="w-full rounded-xl border border-border bg-white"
          style={{ height: altura }}
        />
      )}
    </div>
  )
}
