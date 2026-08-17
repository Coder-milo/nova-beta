'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Link2,
  MapPin,
  Phone,
  TriangleAlert,
} from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'
import { FormularioCita } from '@/components/admin/formulario-cita'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { postulacionesApi } from '@/lib/api'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import type { PostulacionResponse } from '@/lib/types'

/** Lunes de la semana a la que pertenece una fecha. */
function lunesDe(fecha: Date): Date {
  const d = new Date(fecha)
  // `getDay()` da 0 el domingo; se corrige para que la semana empiece el lunes,
  // que es como el equipo la cuenta.
  const desplazamiento = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - desplazamiento)
  d.setHours(0, 0, 0, 0)
  return d
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function esHoy(d: Date): boolean {
  const hoy = new Date()
  return d.getFullYear() === hoy.getFullYear()
    && d.getMonth() === hoy.getMonth()
    && d.getDate() === hoy.getDate()
}

const ICONO_MODALIDAD = { PRESENCIAL: MapPin, VIRTUAL: Link2, TELEFONICA: Phone } as const

/**
 * Agenda de entrevistas de la semana.
 *
 * <p>Lo que hace útil a esta pantalla no es el calendario, es la cola de arriba:
 * las citas cuya hora ya pasó y siguen figurando como agendadas. O la entrevista
 * se hizo y nadie anotó el resultado, o la persona no se presentó — en los dos
 * casos hay algo que hacer, y sin sacarlas aparte se quedan enterradas en el
 * pasado del calendario, donde nadie vuelve a mirar.
 */
export default function AgendaPage() {
  const { locale } = usePreferences()
  const en = locale === 'en'

  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [citas, setCitas] = useState<PostulacionResponse[] | null>(null)
  const [vencidas, setVencidas] = useState<PostulacionResponse[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<PostulacionResponse | null>(null)

  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes)
      d.setDate(lunes.getDate() + i)
      return d
    }),
    [lunes],
  )

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const domingo = new Date(lunes)
      domingo.setDate(lunes.getDate() + 6)
      const [semana, sinCerrar] = await Promise.all([
        postulacionesApi.agenda(iso(lunes), iso(domingo)),
        postulacionesApi.agendaSinCerrar(),
      ])
      setCitas(semana)
      setVencidas(sinCerrar)
    } catch (e) {
      setCitas([])
      setError(errorDe(e, en ? 'Could not load the agenda.' : 'No se pudo cargar la agenda.'))
    }
  }, [lunes, en])

  useEffect(() => { void cargar() }, [cargar])

  const porDia = useMemo(() => {
    const mapa = new Map<string, PostulacionResponse[]>()
    for (const c of citas ?? []) {
      if (!c.fechaHoraEntrevista) continue
      const clave = c.fechaHoraEntrevista.slice(0, 10)
      const lista = mapa.get(clave) ?? []
      lista.push(c)
      mapa.set(clave, lista)
    }
    return mapa
  }, [citas])

  const moverSemana = (semanas: number) => {
    const siguiente = new Date(lunes)
    siguiente.setDate(lunes.getDate() + semanas * 7)
    setLunes(siguiente)
  }

  const hora = (isoTexto: string | null) =>
    isoTexto
      ? new Date(isoTexto).toLocaleTimeString(en ? 'en-GB' : 'es-CO',
          { hour: '2-digit', minute: '2-digit' })
      : ''

  if (citas === null) {
    return <PageSpinner label={en ? 'Loading agenda…' : 'Cargando agenda…'} />
  }

  const rotuloSemana = `${dias[0].toLocaleDateString(en ? 'en-GB' : 'es-CO', { day: 'numeric', month: 'short' })} – ${dias[6].toLocaleDateString(en ? 'en-GB' : 'es-CO', { day: 'numeric', month: 'short' })}`

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        antetitulo={en ? 'Follow-up' : 'Seguimiento'}
        titulo={en ? 'Interview agenda' : 'Agenda de entrevistas'}
        icono={CalendarDays}
        campos={[
          { etiqueta: en ? 'Week' : 'Semana', valor: rotuloSemana },
          { etiqueta: en ? 'Scheduled' : 'Agendadas', valor: String(citas.length) },
        ]}
        acciones={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label={en ? 'Previous week' : 'Semana anterior'}
                    onClick={() => moverSemana(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLunes(lunesDe(new Date()))}>
              {en ? 'This week' : 'Esta semana'}
            </Button>
            <Button variant="outline" size="icon-sm" aria-label={en ? 'Next week' : 'Semana siguiente'}
                    onClick={() => moverSemana(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}

      {/* La cola que da sentido a la pantalla. Va arriba y no al final: es lo
          único de aquí que exige una acción hoy. */}
      {vencidas.length > 0 && (
        <Card className="gap-0 border-[color-mix(in_srgb,var(--panel-negativo)_35%,transparent)] shadow-none">
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <TriangleAlert className="size-4 shrink-0 text-[var(--panel-negativo)]" />
              <span className="text-[13px] font-semibold text-foreground">
                {en
                  ? `${vencidas.length} interview(s) with no outcome recorded`
                  : `${vencidas.length} entrevista(s) sin resultado anotado`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {en
                ? 'The time has passed and they are still marked as scheduled. Either it happened and nobody wrote it down, or the person did not show up.'
                : 'Ya pasó la hora y siguen marcadas como agendadas. O se hizo y nadie lo anotó, o la persona no se presentó.'}
            </p>
            <ul className="divide-y divide-[var(--panel-borde)]">
              {vencidas.slice(0, 6).map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setEditando(v)}
                    className="flex w-full items-center gap-2 py-1.5 text-left hover:bg-[var(--panel-superficie-tenue)]"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {v.estudianteNombre} · {v.empresaNombre}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {v.fechaHoraEntrevista
                        ? new Date(v.fechaHoraEntrevista).toLocaleDateString(en ? 'en-GB' : 'es-CO',
                            { day: 'numeric', month: 'short' })
                        : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {vencidas.length > 6 && (
              <p className="text-[11px] text-muted-foreground">
                {en ? `and ${vencidas.length - 6} more` : `y ${vencidas.length - 6} más`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Siete columnas en escritorio; apiladas por debajo. Un calendario de
          siete columnas en un móvil son celdas de 50 px donde no cabe un
          nombre. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {dias.map((dia) => {
          const delDia = porDia.get(iso(dia)) ?? []
          return (
            <Card key={iso(dia)} className={cn('gap-0 shadow-none', esHoy(dia) && 'border-primary/50')}>
              <CardContent className="flex min-h-24 flex-col gap-1.5 p-2.5">
                <div className="flex items-baseline justify-between gap-1">
                  <span className={cn(
                    'text-[11px] font-semibold uppercase',
                    esHoy(dia) ? 'text-primary' : 'text-muted-foreground',
                  )}>
                    {dia.toLocaleDateString(en ? 'en-GB' : 'es-CO', { weekday: 'short' })}
                  </span>
                  <span className={cn(
                    'text-sm font-semibold tabular-nums',
                    esHoy(dia) ? 'text-primary' : 'text-foreground',
                  )}>
                    {dia.getDate()}
                  </span>
                </div>

                {delDia.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground/60">—</span>
                ) : (
                  delDia.map((c) => {
                    const Icono = c.modalidadEntrevista
                      ? ICONO_MODALIDAD[c.modalidadEntrevista]
                      : CalendarDays
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setEditando(c)}
                        className="flex flex-col gap-0.5 rounded-(--radius) border border-[var(--panel-borde)] bg-[var(--panel-superficie-tenue)] p-1.5 text-left transition-colors hover:border-primary/40"
                      >
                        <span className="flex items-center gap-1 text-[11px] font-semibold tabular-nums text-primary">
                          <Icono className="size-3 shrink-0" />
                          {hora(c.fechaHoraEntrevista)}
                        </span>
                        <span className="truncate text-[11px] font-medium text-foreground">
                          {c.estudianteNombre}
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {c.empresaNombre}
                        </span>
                      </button>
                    )
                  })
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Sheet open={editando !== null} onOpenChange={(abierta) => { if (!abierta) setEditando(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {en ? 'Interview' : 'Entrevista'}
              {editando && (
                <span className="block text-xs font-normal text-muted-foreground">
                  {editando.estudianteNombre} · {editando.empresaNombre}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="p-4">
            {editando && (
              <FormularioCita
                valores={editando}
                guardar={async (cambios) => {
                  await postulacionesApi.actualizar(editando.id, cambios)
                  await cargar()
                }}
                onCerrar={() => setEditando(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
