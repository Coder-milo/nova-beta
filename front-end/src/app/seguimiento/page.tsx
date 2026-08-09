'use client'

import { ArrowsClockwiseIcon as ArrowsClockwise, ChatCircleIcon as ChatCircle, ClockIcon as Clock, UserIcon as User, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
/**
 * Tablero de seguimiento.
 *
 * Consume:
 *   GET /api/v1/seguimiento/tablero        → columnas por estado de contacto
 *   PUT /api/v1/seguimiento/tablero/{id}   → mover a otra columna
 *
 * El backend llevaba tiempo sirviendo esto y ninguna pantalla lo pedía.
 *
 * <p>Se mueve con un desplegable y no arrastrando. Arrastrar se ve mejor en una
 * demostración, pero deja fuera a quien navega con teclado o lector de pantalla,
 * y en un móvil compite con el gesto de desplazar la página. El desplegable
 * funciona en los tres casos y no necesita ninguna librería.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from '@/compat/next-link'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { tableroApi, mensajeDeError } from '@/lib/api'
import { useAvisos } from '@/components/ui/avisos'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'
import type { EstadoContacto, EtapaEmpleabilidad, Tablero, TarjetaTablero } from '@/lib/types'

/** El orden de las columnas es el del recorrido, no alfabético. */
const ESTADOS: EstadoContacto[] = ['SIN_CONTACTO', 'EN_PROCESO', 'ENTREVISTA', 'COLOCADO', 'CERRADO']

/** El color no depende del idioma; la etiqueta sí, y sale del diccionario. */
const COLOR_ESTADO: Record<EstadoContacto, string> = {
  SIN_CONTACTO: 'bg-muted-foreground/40',
  EN_PROCESO: 'bg-navy-400',
  ENTREVISTA: 'bg-warning',
  COLOCADO: 'bg-success',
  CERRADO: 'bg-red-600',
}

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        titulo: 'Follow-up board',
        descripcion: 'Where each student stands in the conversation, with the stage the system infers next to it. Moving a card records a follow-up action in their history.',
        cargando: 'Loading the board…',
        noSePudoCargar: 'The board could not be loaded.',
        noSePudoMover: 'The student could not be moved.',
        sinEstudiantes: 'No students on the board.',
        columnaVacia: 'Nobody here.',
        moverA: 'Move to…',
        necesitanAtencion: (n: number) => `${n} need attention`,
        sinContactoNunca: 'Never contacted',
        diasSinContacto: (n: number) => `${n} days without contact`,
        contactadoHoy: 'Contacted today',
        postulacionesX: (n: number) => `${n} applications`,
        accionesX: (n: number) => `${n} follow-up actions`,
        proximaAccion: 'Next action',
        totalEstudiantes: (n: number) => `${n} students on the board`,
        // Estados de contacto
        sinContacto: 'No contact',
        enProceso: 'In conversation',
        entrevista: 'Interviewing',
        colocado: 'Placed',
        cerrado: 'Closed',
        // Etapas que deduce el sistema
        sinPerfil: 'No profile',
        perfilListo: 'Profile ready',
        preparado: 'Ready',
        postulando: 'Applying',
      }
    : {
        titulo: 'Tablero de seguimiento',
        descripcion: 'En qué punto de la conversación está cada estudiante, con la etapa que deduce el sistema al lado. Mover una tarjeta deja registrada la acción en su historial.',
        cargando: 'Cargando el tablero…',
        noSePudoCargar: 'No se pudo cargar el tablero.',
        noSePudoMover: 'No se pudo mover al estudiante.',
        sinEstudiantes: 'No hay estudiantes en el tablero.',
        columnaVacia: 'Nadie aquí.',
        moverA: 'Mover a…',
        necesitanAtencion: (n: number) => `${n} necesitan atención`,
        sinContactoNunca: 'Nunca contactado',
        diasSinContacto: (n: number) => `${n} días sin contacto`,
        contactadoHoy: 'Contactado hoy',
        postulacionesX: (n: number) => `${n} postulaciones`,
        accionesX: (n: number) => `${n} acciones de seguimiento`,
        proximaAccion: 'Próxima acción',
        totalEstudiantes: (n: number) => `${n} estudiantes en el tablero`,
        sinContacto: 'Sin contacto',
        enProceso: 'En conversación',
        entrevista: 'En entrevistas',
        colocado: 'Colocado',
        cerrado: 'Cerrado',
        sinPerfil: 'Sin perfil',
        perfilListo: 'Perfil listo',
        preparado: 'Preparado',
        postulando: 'Postulando',
      }
}

function etiquetaEstado(T: ReturnType<typeof textos>, estado: EstadoContacto): string {
  return {
    SIN_CONTACTO: T.sinContacto, EN_PROCESO: T.enProceso, ENTREVISTA: T.entrevista,
    COLOCADO: T.colocado, CERRADO: T.cerrado,
  }[estado] ?? estado
}

function etiquetaEtapa(T: ReturnType<typeof textos>, etapa: EtapaEmpleabilidad): string {
  return {
    SIN_PERFIL: T.sinPerfil, PERFIL_LISTO: T.perfilListo, PREPARADO: T.preparado,
    POSTULANDO: T.postulando, COLOCADO: T.colocado,
  }[etapa] ?? etapa
}

/**
 * A partir de cuántos días sin noticias conviene mirar una tarjeta.
 *
 * Dos semanas, el mismo umbral que usa el backend para contar las que
 * necesitan atención. Duplicar el número aquí sería otra copia que puede
 * desviarse, pero el servidor no lo publica: si algún día lo hace, este
 * literal es lo que hay que cambiar por su valor.
 */
const DIAS_PARA_ALERTAR = 14

export default function SeguimientoPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const { mostrarError, avisos } = useAvisos()
  const [tablero, setTablero] = useState<Tablero | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moviendo, setMoviendo] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      setTablero(await tableroApi.obtener())
    } catch (e) {
      setError(mensajeDeError(e, T.noSePudoCargar))
    } finally { setCargando(false) }
  }, [T.noSePudoCargar])

  useEffect(() => { void cargar() }, [cargar])

  /**
   * Mueve la tarjeta y recarga.
   *
   * Se recarga entero en vez de mover la tarjeta en memoria porque los
   * contadores de cabecera —el total y cuántas necesitan atención— los calcula
   * el servidor, y recalcularlos aquí sería una segunda implementación de la
   * misma regla, lista para desviarse de la primera.
   */
  const mover = async (tarjeta: TarjetaTablero, estado: EstadoContacto) => {
    if (estado === tarjeta.estadoContacto) return
    setMoviendo(tarjeta.estudianteId)
    try {
      await tableroApi.mover(tarjeta.estudianteId, estado)
      await cargar()
    } catch (e) {
      mostrarError(mensajeDeError(e, T.noSePudoMover))
    } finally { setMoviendo(null) }
  }

  const columnaDe = (estado: EstadoContacto) =>
    tablero?.columnas.find((c) => c.estado === estado)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{T.titulo}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{T.descripcion}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void cargar()} disabled={cargando}>
          <ArrowsClockwise className="size-3.5" /> {C.refrescar}
        </Button>
      </div>

      {cargando && (
        <div className="flex items-center justify-center py-20">
          <PageSpinner />
          <span className="ml-2 text-sm text-muted-foreground">{T.cargando}</span>
        </div>
      )}

      {error && !cargando && (
        <div className="flex flex-col items-center gap-3 py-12">
          <WarningCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void cargar()}>
            <ArrowsClockwise className="size-4" /> {C.reintentar}
          </Button>
        </div>
      )}

      {!cargando && !error && tablero && (
        tablero.totalEstudiantes === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="py-14 text-center text-sm text-muted-foreground">{T.sinEstudiantes}</CardContent>
          </Card>
        ) : (
          <>
            <p className="text-xs text-muted-foreground tabular-nums">{T.totalEstudiantes(tablero.totalEstudiantes)}</p>

            {/* Una columna por estado, con desplazamiento horizontal: con cinco
                columnas y tarjetas de varias líneas, apilarlas en vertical en una
                pantalla estrecha haría perder de vista la comparación, que es
                justo para lo que sirve el tablero. */}
            <div className="flex gap-4 overflow-x-auto pb-4">
              {ESTADOS.map((estado) => {
                const columna = columnaDe(estado)
                const tarjetas = columna?.tarjetas ?? []
                return (
                  <section key={estado} className="flex w-72 shrink-0 flex-col gap-3">
                    <header className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
                      <span className={`size-2 shrink-0 rounded-full ${COLOR_ESTADO[estado]}`} />
                      <span className="text-sm font-semibold text-foreground">{etiquetaEstado(T, estado)}</span>
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">{columna?.total ?? 0}</span>
                    </header>

                    {(columna?.necesitanAtencion ?? 0) > 0 && (
                      <p className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        <Clock className="size-3" /> {T.necesitanAtencion(columna!.necesitanAtencion)}
                      </p>
                    )}

                    {tarjetas.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                        {T.columnaVacia}
                      </p>
                    ) : tarjetas.map((tarjeta) => {
                      const alerta = tarjeta.diasSinContacto == null || tarjeta.diasSinContacto >= DIAS_PARA_ALERTAR
                      return (
                        <article
                          key={tarjeta.estudianteId}
                          className={`flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-none transition-opacity ${
                            alerta ? 'border-amber-500/40' : 'border-border'
                          } ${moviendo === tarjeta.estudianteId ? 'opacity-50' : ''}`}
                        >
                          <Link
                            href={`/estudiantes/${tarjeta.estudianteId}`}
                            className="text-sm font-semibold text-foreground hover:text-primary hover:underline"
                          >
                            {tarjeta.nombre}
                          </Link>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">{etiquetaEtapa(T, tarjeta.etapa)}</Badge>
                            <span className="text-[10px] tabular-nums text-muted-foreground">{tarjeta.porcentajeAvance}%</span>
                          </div>

                          <p className={`flex items-center gap-1.5 text-[11px] ${alerta ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                            <Clock className="size-3 shrink-0" />
                            {tarjeta.diasSinContacto == null
                              ? T.sinContactoNunca
                              : tarjeta.diasSinContacto === 0
                                ? T.contactadoHoy
                                : T.diasSinContacto(tarjeta.diasSinContacto)}
                          </p>

                          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><User className="size-3" />{T.postulacionesX(tarjeta.postulaciones)}</span>
                            <span className="flex items-center gap-1"><ChatCircle className="size-3" />{T.accionesX(tarjeta.accionesSeguimiento)}</span>
                          </p>

                          {tarjeta.proximaAccion && (
                            <p className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">{T.proximaAccion}: </span>
                              {tarjeta.proximaAccion}
                            </p>
                          )}

                          <label className="mt-1">
                            <span className="sr-only">{T.moverA}</span>
                            <select
                              aria-label={T.moverA}
                              value={tarjeta.estadoContacto}
                              disabled={moviendo !== null}
                              onChange={(e) => void mover(tarjeta, e.target.value as EstadoContacto)}
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                            >
                              {ESTADOS.map((e) => (
                                <option key={e} value={e}>{etiquetaEstado(T, e)}</option>
                              ))}
                            </select>
                          </label>
                        </article>
                      )
                    })}
                  </section>
                )
              })}
            </div>
          </>
        )
      )}
      {avisos}
    </div>
  )
}
