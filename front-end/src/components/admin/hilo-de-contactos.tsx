'use client'

/**
 * El historial de acercamientos a una empresa.
 *
 * Antes esto era un bloque de texto: cada nota se pegaba al campo `notas` de la
 * ficha como «2026-08-16: llamé y no contestan». Parecía un hilo y no lo era —
 * sin autor por línea, imposible de corregir sin editar el bloque entero, y con
 * dos personas guardando a la vez la última pisaba la línea de la otra.
 *
 * Ahora cada acercamiento es una fila con su autor y su fecha. Lo más reciente
 * arriba, que es como se lee un historial: la pregunta al abrir una ficha es
 * «¿en qué quedamos?», no «¿cómo empezó esto?».
 */

import { useCallback, useEffect, useState } from 'react'
import { History, UserRound } from 'lucide-react'
import { empresasApi } from '@/lib/api'
import type { ContactoEmpresaResponse } from '@/lib/types'
import { usePreferences } from '@/lib/preferences'

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Contact history',
        vacio: 'No approaches logged yet. The first one you save will appear here.',
        cargando: 'Loading the history…',
        notasGenerales: 'General notes on the company',
        deLaFicha: 'From the company record and the Excel import — not part of the history.',
      }
    : {
        titulo: 'Historial de acercamientos',
        vacio: 'Todavía no hay acercamientos registrados. El primero que guardes aparece aquí.',
        cargando: 'Cargando el historial…',
        notasGenerales: 'Notas generales de la empresa',
        deLaFicha: 'Vienen de la ficha y de la importación de Excel — no son parte del historial.',
      }
}

/** Fecha y hora cortas: en un hilo de veinte, el año sobra. */
function cuando(iso: string, locale: string) {
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return iso
  return f.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function HiloDeContactos({
  empresaId,
  notasGenerales,
  recargar,
}: {
  empresaId: string
  /** El campo `notas` de la ficha. Se sigue mostrando, pero aparte y rotulado. */
  notasGenerales?: string | null
  /** Cambia cuando se guarda un acercamiento, para volver a pedir el hilo. */
  recargar?: number
}) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const [hilo, setHilo] = useState<ContactoEmpresaResponse[] | null>(null)

  const cargar = useCallback(() => {
    empresasApi.contactos(empresaId)
      .then(setHilo)
      // En silencio: es un panel de apoyo dentro de una ficha que ya tiene sus
      // propios avisos, y el historial puede estar legítimamente vacío.
      .catch(() => setHilo([]))
  }, [empresaId])

  useEffect(() => { cargar() }, [cargar, recargar])

  return (
    <div className="mt-5 space-y-4">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <History className="size-3.5" strokeWidth={2} />
          {T.titulo}
        </p>

        {hilo === null && <p className="text-xs text-muted-foreground">{T.cargando}</p>}

        {hilo?.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            {T.vacio}
          </p>
        )}

        {hilo && hilo.length > 0 && (
          <ol className="space-y-2">
            {hilo.map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-xs font-semibold text-foreground">{c.asunto}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {cuando(c.fecha, locale)}
                  </span>
                </div>
                {c.notas && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{c.notas}</p>
                )}
                {/* El autor es la mitad que faltaba: una nota que no se sabe
                    quién escribió no se puede repreguntar. */}
                {c.responsable && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <UserRound className="size-3" strokeWidth={2} />
                    {c.responsable}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Las notas de la ficha se conservan y se rotulan como lo que son. Hasta
          ahora compartían sitio con el historial, y por eso se confundían. */}
      {notasGenerales && notasGenerales.trim() && (
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">{T.notasGenerales}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{notasGenerales}</p>
          <p className="mt-1.5 text-[11px] italic text-muted-foreground">{T.deLaFicha}</p>
        </div>
      )}
    </div>
  )
}
