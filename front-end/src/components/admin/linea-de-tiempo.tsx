'use client'

import { useEffect, useState } from 'react'
import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Trophy,
} from 'lucide-react'
import Link from '@/compat/next-link'
import { lineaDeTiempoApi } from '@/lib/api'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import type { HitoDeLaLinea, TipoDeHito } from '@/lib/types'

/**
 * Cada tipo con su icono y su color.
 *
 * Los tonos salen de `--mod-*`, los mismos del menú: un documento se ve del
 * color de Documentos y una postulación del de Vacantes, así que el color ya
 * dice de qué módulo viene sin leer nada.
 */
const ESTILO: Record<TipoDeHito, { icono: typeof FileText; tono: string; es: string; en: string }> = {
  POSTULACION: { icono: BriefcaseBusiness, tono: 'var(--mod-naranja)', es: 'Postulación', en: 'Application' },
  ENTREVISTA:  { icono: CalendarDays,      tono: 'var(--mod-verde)',   es: 'Entrevista',  en: 'Interview' },
  SEGUIMIENTO: { icono: ClipboardCheck,    tono: 'var(--mod-cian)',    es: 'Seguimiento', en: 'Follow-up' },
  DOCUMENTO:   { icono: FileText,          tono: 'var(--mod-azul)',    es: 'Documento',   en: 'Document' },
  COLOCACION:  { icono: Trophy,            tono: 'var(--mod-morado)',  es: 'Colocación',  en: 'Placement' },
}

function cuando(iso: string | null, en: boolean): string {
  if (!iso) return en ? 'No date' : 'Sin fecha'
  const d = new Date(iso)
  // El mediodía es la hora que pone el backend a lo que solo tenía fecha:
  // enseñarla haría creer que todo pasó a las 12:00.
  const soloFecha = d.getHours() === 12 && d.getMinutes() === 0
  return d.toLocaleString(en ? 'en-GB' : 'es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(soloFecha ? {} : { hour: '2-digit', minute: '2-digit' }),
  })
}

/**
 * La historia de un estudiante, en una sola columna.
 *
 * <p>Todo lo que le pasa a una persona vive repartido en cuatro módulos, y
 * reconstruir «qué ha pasado con esta» exigía abrir cuatro pestañas y ordenar de
 * cabeza. Es la pregunta que se hace antes de cada llamada, así que es la que
 * tiene que responderse sin trabajo.
 */
export function LineaDeTiempo({ estudianteId }: { estudianteId: string }) {
  const { locale } = usePreferences()
  const en = locale === 'en'

  const [hitos, setHitos] = useState<HitoDeLaLinea[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    lineaDeTiempoApi.de(estudianteId)
      .then((h) => { if (vivo) setHitos(h) })
      .catch((e) => {
        if (!vivo) return
        setHitos([])
        setError(errorDe(e, en ? 'Could not load the history.' : 'No se pudo cargar la historia.'))
      })
    return () => { vivo = false }
  }, [estudianteId, en])

  if (hitos === null) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        {en ? 'Loading history…' : 'Cargando historia…'}
      </p>
    )
  }

  if (error) {
    return <p role="alert" className="py-4 text-[13px] text-destructive">{error}</p>
  }

  if (hitos.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        {en
          ? 'Nothing recorded yet. Applications, interviews, documents and follow-up notes will appear here.'
          : 'Todavía no hay nada. Aquí aparecerán postulaciones, entrevistas, documentos y notas de seguimiento.'}
      </p>
    )
  }

  return (
    <ol className="flex flex-col">
      {hitos.map((h, i) => {
        const estilo = ESTILO[h.tipo]
        const Icono = estilo.icono
        const ultimo = i === hitos.length - 1
        const contenido = (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[13px] font-semibold text-foreground">{h.titulo}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {cuando(h.cuando, en)}
              </span>
            </div>
            {h.detalle && (
              <p className="text-xs leading-snug text-muted-foreground">{h.detalle}</p>
            )}
            {h.responsable && (
              <p className="text-[11px] text-muted-foreground/80">{h.responsable}</p>
            )}
          </>
        )

        return (
          <li key={`${h.tipo}-${h.referenciaId}-${i}`} className="flex gap-3">
            {/* Raíl: punto del color del módulo y línea hasta el siguiente. El
                último no la lleva, o parecería que la historia sigue. */}
            <div className="flex flex-col items-center">
              <span
                className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: `color-mix(in srgb, ${estilo.tono} 15%, transparent)`, color: estilo.tono }}
              >
                <Icono className="size-3.5" />
              </span>
              {!ultimo && <span className="w-px flex-1 bg-[var(--panel-borde)]" />}
            </div>

            <div className={cn('flex min-w-0 flex-1 flex-col gap-0.5', ultimo ? 'pb-1' : 'pb-4')}>
              {/* Solo se hace pulsable lo que lleva a algún sitio: una lista
                  donde todo parece un enlace y la mitad no lo es enseña a no
                  pulsar nada. */}
              {h.ruta ? (
                <Link
                  href={h.ruta}
                  className="-mx-1.5 rounded-(--radius) px-1.5 py-0.5 transition-colors hover:bg-[var(--panel-superficie-tenue)]"
                >
                  {contenido}
                </Link>
              ) : (
                contenido
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
