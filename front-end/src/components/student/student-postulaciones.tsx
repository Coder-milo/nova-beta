'use client'

import { useEffect, useState } from 'react'
import { ArrowRightIcon as ArrowRight, ArrowSquareOutIcon as ArrowSquareOut, BriefcaseIcon as Briefcase, BuildingIcon as Building, CalendarBlankIcon as Calendar, CheckCircleIcon as CheckCircle, CircleNotchIcon as CircleNotch, ClockIcon as Clock, CurrencyDollarIcon as CurrencyDollar, GraduationCapIcon as GraduationCap, LaptopIcon as Laptop, MapPinIcon as MapPin, SparkleIcon as Sparkle, TranslateIcon as Translate, TrashIcon as Trash, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
import type { ComponentType } from 'react'
import { ApiCallError, matchesApi, mensajeDeError, postulacionesApi } from '@/lib/api'
import { hoyLocal } from '@/lib/utils'
import type { MatchResponse, PostulacionResponse, RazonDeMatch } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Confirmar } from '@/components/ui/confirmar'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Enlace absoluto para postularse, o null si la oferta no trae ninguno.
 *
 * Se prefiere el de aplicar directo; si no, el de origen. Muchas ofertas de
 * portal no traen ninguno: en ese caso no hay a dónde llevar a la persona y
 * hay que decírselo, no fingir que sí.
 */
function urlDeOferta(m: MatchResponse): string | null {
  const url = m.vacanteUrlAplicar || m.vacanteUrlOrigen
  if (!url) return null
  return url.startsWith('http') ? url : `https://${url}`
}

function MatchScore({ score }: { score: number }) {
  const pct = Math.round(score)
  const color =
    pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-muted-foreground/40'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums">{pct}%</span>
    </div>
  )
}

/**
 * Por qué se recomendó esta vacante.
 *
 * Hasta ahora se mostraba el porcentaje solo, sin una razón detrás: un número
 * sin explicación no ayuda a decidir si vale la pena postularse. Los criterios
 * que no se pudieron evaluar no aparecen —no entraron en el puntaje, y
 * mostrarlos en cero sería mentir—.
 */
function RazonesDelMatch({
  razones,
  cobertura,
}: {
  razones: RazonDeMatch[]
  cobertura: number | null
}) {
  if (!razones || razones.length === 0) return null

  const etiqueta = (ratio: number) =>
    ratio >= 0.85 ? 'cumple' : ratio >= 0.5 ? 'parcial' : 'bajo'
  const tono = (ratio: number) =>
    ratio >= 0.85
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : ratio >= 0.5
        ? 'bg-amber-400/10 text-amber-700 dark:text-amber-400'
        : 'bg-muted text-muted-foreground'

  // Por debajo de la mitad del peso, el porcentaje se apoya en poca evidencia y
  // conviene decirlo en vez de presentarlo como si fuera igual de firme.
  const pocaEvidencia = cobertura !== null && cobertura < 0.5

  return (
    <div className="space-y-1.5">
      <ul className="flex flex-wrap gap-1.5">
        {razones.map((r) => (
          <li
            key={r.criterio}
            className={`rounded-full px-2 py-0.5 text-xs ${tono(r.ratio)}`}
          >
            {r.criterio}: {etiqueta(r.ratio)}
          </li>
        ))}
      </ul>
      {pocaEvidencia && (
        <p className="text-xs text-muted-foreground">
          Esta oferta da poca información, así que la compatibilidad es
          orientativa.
        </p>
      )}
    </div>
  )
}

/** Un dato de la oferta con su ícono. */
function Hecho({
  icon: Icon,
  etiqueta,
  valor,
}: {
  icon: ComponentType<{ className?: string }>
  etiqueta: string
  valor: string
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{etiqueta}:</span>
      <span className="font-medium text-foreground">{valor}</span>
    </div>
  )
}

/**
 * Detalle de la oferta para decidir antes de postularse.
 *
 * Empresa, cargo, pago, ciudad, modalidad, jornada, contrato, inglés,
 * experiencia y vencimiento —lo que hace falta para saber si vale la pena—.
 * Solo se muestra lo que la oferta trae; una vacante de portal rara vez lo
 * trae todo, y mostrar campos vacíos sería ruido. El enlace a la oferta
 * original es un ancla real: funciona siempre, aunque el navegador bloquee la
 * apertura automática al postularse.
 */
function DetalleVacante({ m }: { m: MatchResponse }) {
  const ciudad = m.vacanteCiudad || m.vacanteUbicacion
  const experiencia =
    m.vacanteAniosExperienciaRequeridos == null
      ? null
      : m.vacanteAniosExperienciaRequeridos === 0
        ? 'Sin experiencia previa'
        : `${m.vacanteAniosExperienciaRequeridos} año${m.vacanteAniosExperienciaRequeridos === 1 ? '' : 's'}`
  const expira = m.vacanteFechaExpiracion
    ? new Date(m.vacanteFechaExpiracion).toLocaleDateString()
    : null

  const hechos = [
    m.vacanteRangoSalarial && { icon: CurrencyDollar, etiqueta: 'Pago', valor: m.vacanteRangoSalarial },
    ciudad && { icon: MapPin, etiqueta: 'Ciudad', valor: ciudad },
    m.vacanteModalidadTrabajo && { icon: Laptop, etiqueta: 'Modalidad', valor: m.vacanteModalidadTrabajo },
    m.vacanteJornada && { icon: Clock, etiqueta: 'Jornada', valor: m.vacanteJornada },
    m.vacanteTipoContrato && { icon: Briefcase, etiqueta: 'Contrato', valor: m.vacanteTipoContrato },
    m.vacanteNivelInglesRequerido && { icon: Translate, etiqueta: 'Inglés', valor: m.vacanteNivelInglesRequerido },
    experiencia && { icon: GraduationCap, etiqueta: 'Experiencia', valor: experiencia },
    expira && { icon: Calendar, etiqueta: 'Aplica antes de', valor: expira },
  ].filter(Boolean) as { icon: ComponentType<{ className?: string }>; etiqueta: string; valor: string }[]

  const descripcion = m.vacanteDescripcion?.trim()
  const requisitos = m.vacanteRequisitos?.trim()
  const urlAbsoluta = urlDeOferta(m)

  if (hechos.length === 0 && !descripcion && !requisitos && !urlAbsoluta) return null

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      {hechos.length > 0 && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {hechos.map((h) => (
            <Hecho key={h.etiqueta} icon={h.icon} etiqueta={h.etiqueta} valor={h.valor} />
          ))}
        </div>
      )}
      {requisitos && (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            Requisitos
          </summary>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{requisitos}</p>
        </details>
      )}
      {descripcion && (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            Descripción de la oferta
          </summary>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{descripcion}</p>
        </details>
      )}
      <div className="flex items-center justify-between gap-2">
        {urlAbsoluta ? (
          <a
            href={urlAbsoluta}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2"
          >
            <ArrowSquareOut className="size-3.5" />
            Ver oferta original
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Esta oferta no trae enlace directo.</span>
        )}
        {m.vacanteFuente && (
          <span className="text-[11px] text-muted-foreground">Fuente: {m.vacanteFuente}</span>
        )}
      </div>
    </div>
  )
}

export function StudentPostulaciones() {
  const [matches, setMatches] = useState<MatchResponse[]>([])
  const [historial, setHistorial] = useState<PostulacionResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [postulando, setPostulando] = useState<string | null>(null)
  const [registrando, setRegistrando] = useState(false)
  const [notificacion, setNotificacion] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)
  const [porEliminar, setPorEliminar] = useState<PostulacionResponse | null>(null)
  const [empresaManual, setEmpresaManual] = useState('')
  const [cargoManual, setCargoManual] = useState('')
  const [canalManual, setCanalManual] = useState('')
  const [urlOfertaManual, setUrlOfertaManual] = useState('')
  const [observacionesManual, setObservacionesManual] = useState('')

  const mostrarNotificacion = (tipo: 'exito' | 'error', mensaje: string) => {
    setNotificacion({ tipo, mensaje })
    setTimeout(() => {
      setNotificacion((curr) => (curr?.mensaje === mensaje ? null : curr))
    }, 6000)
  }

  useEffect(() => {
    ;(async () => {
      try {
        const page = await matchesApi.obtenerMisMatches(0, 100)
        setMatches(page.content)
        // La bandeja nueva se activa al desplegar el backend con el módulo de
        // postulaciones; las recomendaciones no quedan bloqueadas antes.
        try {
          setHistorial(await postulacionesApi.mias())
        } catch {
          setHistorial([])
        }
      } catch (e) {
        setError(
          e instanceof ApiCallError
            ? (e.body.message ?? `Error ${e.status}`)
            : 'No se pudieron cargar las oportunidades.',
        )
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const refrescarHistorial = async () => {
    try {
      setHistorial(await postulacionesApi.mias())
    } catch {
      // Ignorar
    }
  }

  const postular = async (match: MatchResponse) => {
    if (match.postulado || postulando) return

    // La oferta se abre de forma síncrona, dentro del gesto del click. Si se
    // abriera después del await de la API el navegador lo trataría como popup
    // emergente y lo bloquearía: la persona haría click y "no pasaría nada".
    // Abrir aquí es la forma fiable; nada de pestañas en blanco intermedias.
    const targetUrl = urlDeOferta(match)
    if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer')

    setPostulando(match.id)
    setNotificacion(null)
    try {
      await matchesApi.marcarPostulado(match.id)
      setMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, postulado: true } : m)),
      )
      await refrescarHistorial()
      mostrarNotificacion(
        'exito',
        targetUrl
          ? `Postulación a "${match.vacanteTitulo}" registrada. Abrimos la oferta en otra pestaña para que completes la aplicación.`
          : `Postulación a "${match.vacanteTitulo}" registrada. Esta oferta no trae enlace directo; búscala como "${match.vacanteEmpresa}" en el portal o consulta a tu coordinador.`,
      )
    } catch (e) {
      mostrarNotificacion('error', mensajeDeError(e, 'No se pudo registrar la postulación.'))
    } finally {
      setPostulando(null)
    }
  }

  const registrarManual = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    if (!empresaManual.trim() || !cargoManual.trim() || registrando) return
    setRegistrando(true)
    setNotificacion(null)
    try {
      const nueva = await postulacionesApi.registrarPropia({
        empresaNombre: empresaManual.trim(),
        cargo: cargoManual.trim(),
        canal: canalManual.trim() || undefined,
        urlOferta: urlOfertaManual.trim() || undefined,
        observaciones: observacionesManual.trim() || undefined,
        fechaPostulacion: hoyLocal(),
        estado: 'ENVIADA',
      })
      setHistorial((items) => [nueva, ...items])
      setEmpresaManual('')
      setCargoManual('')
      setCanalManual('')
      setUrlOfertaManual('')
      setObservacionesManual('')
      mostrarNotificacion('exito', 'Postulación registrada exitosamente.')
    } catch (e) {
      mostrarNotificacion('error', mensajeDeError(e, 'No se pudo registrar la postulación.'))
    } finally {
      setRegistrando(false)
    }
  }

  // El diálogo de confirmación (in-app, no el confirm() del navegador) llama a
  // esto sobre la postulación en `porEliminar`. Si falla, se relanza para que el
  // diálogo no se cierre como si hubiera funcionado; el aviso se muestra igual.
  const eliminarPostulacion = async () => {
    const objetivo = porEliminar
    if (!objetivo) return
    try {
      await postulacionesApi.eliminar(objetivo.id)
      setHistorial((items) => items.filter((item) => item.id !== objetivo.id))
      mostrarNotificacion('exito', 'Postulación eliminada.')
    } catch (e) {
      mostrarNotificacion('error', mensajeDeError(e, 'No se pudo eliminar la postulación.'))
      throw e
    }
  }

  const actualizarEstado = async (id: string, estado: string) => {
    try {
      const actualizada = await postulacionesApi.actualizar(id, { estado })
      setHistorial((items) => items.map((item) => item.id === id ? actualizada : item))
      mostrarNotificacion('exito', 'Estado actualizado.')
    } catch (e) {
      mostrarNotificacion('error', mensajeDeError(e, 'No se pudo actualizar el estado.'))
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-60 items-center justify-center gap-2 text-sm text-muted-foreground">
        <CircleNotch className="size-5 animate-spin" />
        Cargando oportunidades…
      </div>
    )
  }

  const disponibles = matches.filter((m) => !m.postulado)
  const postuladas = matches.filter((m) => m.postulado)

  return (
    <div className="space-y-8">
      {notificacion && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-sm shadow-sm transition-all ${
            notificacion.tipo === 'exito'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notificacion.tipo === 'exito' ? (
              <CheckCircle className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <WarningCircle className="size-5 shrink-0 text-destructive" />
            )}
            <span className="font-medium">{notificacion.mensaje}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotificacion(null)}
            className="rounded-md p-1 opacity-70 hover:opacity-100"
            aria-label="Cerrar notificación"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="flex gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <WarningCircle className="size-5 shrink-0" />
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Seguimiento de mis postulaciones ({historial.length})
          </h2>
          {historial.length === 0 ? (
            <Card className="border-dashed shadow-none">
              <CardContent className="p-5 text-sm text-muted-foreground">Registra una postulación propia o postúlate desde una oportunidad recomendada.</CardContent>
            </Card>
          ) : historial.map((postulacion) => (
            <Card key={postulacion.id} className="shadow-none">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{postulacion.cargo}</p>
                  <p className="text-sm text-muted-foreground">
                    {postulacion.empresaNombre} · {postulacion.fechaPostulacion}
                    {postulacion.canal ? ` · ${postulacion.canal}` : ''}
                  </p>
                  {postulacion.urlOferta && (
                    <a
                      href={postulacion.urlOferta.startsWith('http') ? postulacion.urlOferta : `https://${postulacion.urlOferta}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-block text-xs text-primary underline truncate max-w-xs"
                    >
                      Ver oferta
                    </a>
                  )}
                  {postulacion.observaciones && (
                    <p className="mt-1 text-xs text-muted-foreground italic">{postulacion.observaciones}</p>
                  )}
                  {postulacion.diasEsperando != null && <p className="mt-1 text-xs text-muted-foreground">{postulacion.diasEsperando} días esperando respuesta</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={postulacion.estadoFinal ? 'secondary' : 'default'}>{postulacion.estadoEtiqueta}</Badge>
                  <select
                    aria-label={`Actualizar estado de ${postulacion.cargo}`}
                    value={postulacion.estado}
                    onChange={(event) => void actualizarEstado(postulacion.id, event.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="ENVIADA">Enviada</option>
                    <option value="EN_PROCESO">En proceso</option>
                    <option value="ENTREVISTA_AGENDADA">Entrevista agendada</option>
                    <option value="ENTREVISTA_REALIZADA">Entrevista realizada</option>
                    <option value="RECHAZADO">No continuó</option>
                    <option value="CONTRATADO">Contratado</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setPorEliminar(postulacion)}
                    title="Eliminar postulación"
                  >
                    <Trash className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="h-fit shadow-none">
          <CardHeader><CardTitle className="text-base">Registrar postulación</CardTitle><CardDescription>Incluye procesos que no salieron del portal.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={registrarManual}>
              <Input required placeholder="Empresa *" value={empresaManual} onChange={(event) => setEmpresaManual(event.target.value)} />
              <Input required placeholder="Cargo al que aplicaste *" value={cargoManual} onChange={(event) => setCargoManual(event.target.value)} />
              <Input placeholder="Canal (LinkedIn, Computrabajo...)" value={canalManual} onChange={(event) => setCanalManual(event.target.value)} />
              <Input placeholder="URL de la oferta (opcional)" value={urlOfertaManual} onChange={(event) => setUrlOfertaManual(event.target.value)} />
              <Input placeholder="Observaciones o notas" value={observacionesManual} onChange={(event) => setObservacionesManual(event.target.value)} />
              <Button type="submit" className="w-full" disabled={registrando}>{registrando ? 'Registrando…' : 'Registrar proceso'}</Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* ── Mis postulaciones ── */}
      {postuladas.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Mis postulaciones ({postuladas.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {postuladas.map((m) => (
              <Card key={m.id} className="shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base leading-snug">{m.vacanteTitulo}</CardTitle>
                    <Badge className="shrink-0 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                      Postulado
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1">
                    <Building className="size-3.5" />
                    {m.vacanteEmpresa}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <DetalleVacante m={m} />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkle className="size-3.5 text-primary" />
                      <span className="text-xs text-muted-foreground">Compatibilidad:</span>
                      <MatchScore score={m.puntaje} />
                    </div>
                    <RazonesDelMatch razones={m.razones} cobertura={m.cobertura} />
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                    <CheckCircle className="size-4" />
                    Postulación registrada
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── Oportunidades disponibles ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Oportunidades recomendadas ({disponibles.length})
        </h2>

        {disponibles.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
                <Briefcase className="size-5" />
              </span>
              <p className="max-w-md text-sm">
                {matches.length === 0
                  ? 'Aún no hay vacantes compatibles con tu perfil. El sistema busca oportunidades automáticamente.'
                  : 'Ya te postulaste a todas las oportunidades disponibles. ¡Bien hecho!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {disponibles.map((m) => (
              <Card key={m.id} className="shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base leading-snug">{m.vacanteTitulo}</CardTitle>
                    <Badge variant="outline" className="shrink-0">
                      {Math.round(m.puntaje)}% match
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1">
                    <Building className="size-3.5" />
                    {m.vacanteEmpresa}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DetalleVacante m={m} />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkle className="size-3.5 text-primary" />
                      <span className="text-xs text-muted-foreground">Compatibilidad:</span>
                      <MatchScore score={m.puntaje} />
                    </div>
                    <RazonesDelMatch razones={m.razones} cobertura={m.cobertura} />
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={postulando === m.id}
                    onClick={() => postular(m)}
                  >
                    {postulando === m.id ? (
                      <>
                        <CircleNotch className="size-4 animate-spin" />
                        Registrando…
                      </>
                    ) : (
                      <>
                        Postularme
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Confirmar
        open={porEliminar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setPorEliminar(null)
        }}
        titulo="Eliminar postulación"
        descripcion={
          porEliminar
            ? `Se eliminará el seguimiento de "${porEliminar.cargo}" en ${porEliminar.empresaNombre}. Esta acción no se puede deshacer.`
            : undefined
        }
        textoConfirmar="Eliminar"
        onConfirmar={eliminarPostulacion}
      />
    </div>
  )
}
