'use client'

/**
 * Registro técnico de las corridas de actualización de vacantes.
 *
 * La tabla existía desde hacía tiempo y solo se leía para sacar una cifra —«12
 * ofertas nuevas»—. El resto quedaba escrito y sin mirar, así que la pregunta
 * que de verdad se hace el equipo cuando dejan de entrar ofertas no tenía
 * respuesta: **¿desde cuándo?**
 *
 * Importa porque un portal que se rompe no falla. Cuando le cambian el HTML,
 * sigue respondiendo 200 y devolviendo cero resultados: la corrida sale
 * «correcta» y con 0 nuevas, exactamente igual que un martes flojo. Así estuvo
 * Elempleo muerto sin que nadie se enterara. La única forma de distinguirlo es
 * ver la serie —cero, cero, cero, cero— en vez de la última fila.
 *
 * Por eso esto vive en la consola de desarrollador y no en la operación diaria
 * de Vacantes: el dato que delata el problema es la repetición, no el valor de
 * hoy.
 */

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clock, RefreshCw } from 'lucide-react'
import { desarrolladorApi } from '@/lib/api'
import type { EjecucionDeScraping } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Vacancy synchronization log',
        descripcion:
          'History and execution status of automatic and manual synchronizations across integrated employment portals.',
        sinCorridas: 'No synchronization jobs have run yet.',
        actualizar: 'Refresh',
        nuevas: 'new',
        sinIngles: 'filtered out (bilingual requirement not met)',
        cerradas: 'closed',
        portales: 'Portals synchronized',
        porPortal: 'Vacancies retrieved by portal',
        sinRegistro: 'No records in this execution',
        enCero: '0 vacancies retrieved',
        errores: 'Errors',
        programada: 'Scheduled',
        manual: 'Manual',
        enCurso: 'In progress',
        correcta: 'Successful',
        parcial: 'Partial',
        fallida: 'Failed',
        cargando: 'Loading execution log…',
      }
    : {
        titulo: 'Registro de sincronizaciones',
        descripcion:
          'Historial y estado de las sincronizaciones automáticas y manuales con portales de empleo.',
        sinCorridas: 'No se ha ejecutado ninguna sincronización aún.',
        actualizar: 'Actualizar',
        nuevas: 'nuevas',
        sinIngles: 'descartadas por no requerir inglés',
        cerradas: 'cerradas',
        portales: 'Portales consultados',
        porPortal: 'Vacantes recuperadas por portal',
        sinRegistro: 'Sin registro en esta corrida',
        enCero: '0 vacantes encontradas',
        errores: 'Errores',
        programada: 'Programada',
        manual: 'Manual',
        enCurso: 'En curso',
        correcta: 'Correcta',
        parcial: 'Parcial',
        fallida: 'Fallida',
        cargando: 'Cargando registro de ejecuciones…',
      }
}

/** Fecha y hora cortas: en una lista de veinte filas el año sobra. */
function cuando(iso: string, locale: string) {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return fecha.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function duracion(segundos: number | null) {
  if (segundos === null) return null
  if (segundos < 60) return `${segundos}s`
  return `${Math.floor(segundos / 60)}m ${segundos % 60}s`
}

export function RegistroDeScraping() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')

  const [corridas, setCorridas] = useState<EjecucionDeScraping[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setCorridas(await desarrolladorApi.ejecucionesDeVacantes())
    } catch (e) {
      setError(errorDe(e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  /**
   * El color dice qué hacer, no qué pasó.
   *
   * «Parcial» va en ámbar y no en verde a propósito: entraron ofertas, pero un
   * portal se cayó y eso hay que mirarlo. Pintarla como correcta porque el
   * número total salió bien es como se dejan de ver las caídas parciales.
   */
  const tono = (estado: EjecucionDeScraping['estado']) =>
    estado === 'FALLIDA'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : estado === 'PARCIAL'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
        : estado === 'EN_CURSO'
          ? 'border-border bg-secondary text-muted-foreground'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'

  const etiqueta = (estado: EjecucionDeScraping['estado']) =>
    estado === 'FALLIDA' ? T.fallida
      : estado === 'PARCIAL' ? T.parcial
        : estado === 'EN_CURSO' ? T.enCurso
          : T.correcta

  return (
    <Card className="rounded-lg border-border shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4 text-primary" strokeWidth={2} />
            {T.titulo}
          </CardTitle>
          <CardDescription className="max-w-2xl">{T.descripcion}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void cargar()} disabled={cargando}>
          <RefreshCw className={`size-3.5 ${cargando ? 'animate-spin' : ''}`} strokeWidth={2} />
          {T.actualizar}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertTriangle className="size-4 shrink-0" strokeWidth={2} />
            {error}
          </div>
        )}

        {corridas === null && !error && (
          <p className="py-4 text-center text-xs text-muted-foreground">{T.cargando}</p>
        )}

        {corridas?.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">{T.sinCorridas}</p>
        )}

        {corridas?.map((c) => {
          const desplegada = abierta === c.id
          const hayDetalle = c.errores.length > 0 || c.portales.length > 0
                            || c.ofertasPorPortal.length > 0
          return (
            <div key={c.id} className="rounded-md border border-border">
              <button
                type="button"
                onClick={() => setAbierta(desplegada ? null : c.id)}
                disabled={!hayDetalle}
                aria-expanded={desplegada}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs hover:bg-secondary/50 disabled:cursor-default disabled:hover:bg-transparent"
              >
                {hayDetalle
                  ? desplegada
                    ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                    : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                  : <span className="size-3.5 shrink-0" />}

                <span className="w-28 shrink-0 tabular-nums text-muted-foreground">
                  {cuando(c.inicio, locale)}
                </span>

                <Badge variant="outline" className={`shrink-0 ${tono(c.estado)}`}>
                  {c.estado === 'CORRECTA' && <CheckCircle2 className="size-3" strokeWidth={2.5} />}
                  {(c.estado === 'FALLIDA' || c.estado === 'PARCIAL') && (
                    <AlertTriangle className="size-3" strokeWidth={2.5} />
                  )}
                  {etiqueta(c.estado)}
                </Badge>

                <span className="shrink-0 text-muted-foreground">
                  {c.origen === 'MANUAL' ? T.manual : T.programada}
                </span>

                <span className="tabular-nums">
                  <strong className="text-foreground">{c.vacantesNuevas}</strong>{' '}
                  <span className="text-muted-foreground">{T.nuevas}</span>
                  {c.vacantesCerradas > 0 && (
                    <span className="text-muted-foreground">
                      {' · '}{c.vacantesCerradas} {T.cerradas}
                    </span>
                  )}
                  {/* Va en la fila cerrada junto a las nuevas: una corrida de
                      «0 nuevas» con cuarenta descartadas es un portal sano
                      trayendo plazas monolingües, y una de «0 nuevas» sin
                      descartes es un portal que dejó de responder. Sin este
                      número los dos casos se leen igual. */}
                  {c.descartadasPorIdioma > 0 && (
                    <span className="text-muted-foreground">
                      {' · '}{c.descartadasPorIdioma} {T.sinIngles}
                    </span>
                  )}
                </span>

                {/* En la fila cerrada, no solo al desplegar: la racha se lee
                    recorriendo la columna con la vista. Si hubiera que abrir
                    las veinte para verlo, no se vería. */}
                {c.portalesEnCero.length > 0 && (
                  <span
                    className="shrink-0 text-amber-700 dark:text-amber-400"
                    title={`${c.portalesEnCero.join(', ')} ${T.enCero}`}
                  >
                    {c.portalesEnCero.join(' · ')} {T.enCero}
                  </span>
                )}

                {duracion(c.duracionSegundos) && (
                  <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                    {duracion(c.duracionSegundos)}
                  </span>
                )}
              </button>

              {desplegada && (
                <div className="space-y-2 border-t border-border px-3 py-2 pl-9 text-xs">
                  {/* El desglose por portal es lo que responde la pregunta que
                      trae aquí a alguien. Un portal en cero una vez no dice
                      nada; el mismo en cero varias corridas es un scraper
                      muerto, y por eso se marca en ámbar y no se esconde. */}
                  {c.ofertasPorPortal.length > 0 ? (
                    <div>
                      <p className="mb-1 text-muted-foreground">{T.porPortal}</p>
                      <div className="flex flex-wrap gap-1">
                        {c.ofertasPorPortal.map(({ portal, ofertas }) => (
                          <Badge
                            key={portal}
                            variant="outline"
                            className={`font-normal tabular-nums ${
                              ofertas === 0
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                : 'border-border'
                            }`}
                            title={ofertas === 0 ? `${portal} ${T.enCero}` : undefined}
                          >
                            {portal} <strong className="ml-1">{ofertas}</strong>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : c.portales.length > 0 && (
                    <div>
                      <p className="mb-1 text-muted-foreground">{T.portales}</p>
                      <div className="flex flex-wrap gap-1">
                        {c.portales.map((p) => (
                          <Badge key={p} variant="secondary" className="font-normal">{p}</Badge>
                        ))}
                      </div>
                      {/* Corrida anterior a que se guardara el desglose. Se dice
                          en vez de pintar ceros: «no se registró» y «trajo
                          cero» son afirmaciones distintas. */}
                      <p className="mt-1 text-[11px] italic text-muted-foreground">{T.sinRegistro}</p>
                    </div>
                  )}
                  {c.errores.length > 0 && (
                    <div>
                      <p className="mb-1 text-muted-foreground">{T.errores}</p>
                      {/* Uno por renglón: el backend los guarda unidos por «; »
                          en una sola columna, y leerlos así obliga a buscar los
                          separadores dentro de un párrafo. */}
                      <ul className="space-y-0.5">
                        {c.errores.map((e, i) => (
                          <li key={i} className="text-destructive">· {e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
