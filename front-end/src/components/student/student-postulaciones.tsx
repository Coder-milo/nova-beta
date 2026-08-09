'use client'

import { useEffect, useState } from 'react'
import { ArrowRightIcon as ArrowRight, ArrowSquareOutIcon as ArrowSquareOut, BriefcaseIcon as Briefcase, BuildingIcon as Building, CalendarBlankIcon as Calendar, CheckCircleIcon as CheckCircle, CircleNotchIcon as CircleNotch, ClockIcon as Clock, CurrencyDollarIcon as CurrencyDollar, GraduationCapIcon as GraduationCap, LaptopIcon as Laptop, MapPinIcon as MapPin, SparkleIcon as Sparkle, TranslateIcon as Translate, TrashIcon as Trash, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
import type { ComponentType } from 'react'
import { ApiCallError, matchesApi, mensajeDeError, postulacionesApi } from '@/lib/api'
import { hoyLocal } from '@/lib/utils'
import { usePreferences } from '@/lib/preferences'
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
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  if (!razones || razones.length === 0) return null

  const etiqueta = (ratio: number) =>
    ratio >= 0.85 ? T.cumple : ratio >= 0.5 ? T.parcial : T.bajo
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
        <p className="text-xs text-muted-foreground">{T.pocaEvidencia}</p>
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
/**
 * Los textos de esta pantalla, en los dos idiomas.
 *
 * Junto al componente y no en el diccionario global, igual que en la pantalla
 * de documentos: `preferences` guarda lo que se repite en toda la aplicacion,
 * no las cadenas de una sola vista.
 */
function textos(english: boolean) {
  return english
    ? {
        cumple: 'meets',
        parcial: 'partial',
        bajo: 'low',
        registrando: 'Logging…',
        pocaEvidencia: 'This advert gives little information, so the match score is only indicative.',
        registrarProceso: 'Log the process',
        postulacionRegistrada: 'Application logged',
        pago: 'Pay', ciudad: 'City', modalidad: 'Work mode', jornada: 'Schedule',
        contrato: 'Contract', ingles: 'English', experiencia: 'Experience',
        aplicaAntes: 'Apply before', sinExperiencia: 'No previous experience',
        anio: 'year', anios: 'years',
        requisitos: 'Requirements', descripcionOferta: 'Job description',
        verOriginal: 'View original posting', sinEnlace: 'This posting has no direct link.',
        fuente: 'Source',
        seguimiento: 'My application tracker', misPostulaciones: 'My applications',
        oportunidades: 'Recommended opportunities', compatibilidad: 'Match:',
        verOferta: 'View posting', postularme: 'Apply', postulando: 'Applying…',
        registrar: 'Log an application',
        registrarPie: 'Include processes that did not come from the portal.',
        vacioHistorial: 'Log your own application or apply from a recommended opportunity.',
        vacioSinVacantes: 'There are no openings matching your profile yet. The system looks for opportunities automatically.',
        vacioTodasHechas: 'You have applied to every available opportunity. Well done!',
        empresa: 'Company *', cargo: 'Role you applied for *',
        canal: 'Channel (LinkedIn, Computrabajo…)', urlOferta: 'Posting URL (optional)',
        observaciones: 'Notes',
        eliminarPostulacion: 'Delete application', eliminar: 'Delete',
        cerrarAviso: 'Close notification',
        estados: { ENVIADA: 'Sent', EN_PROCESO: 'In progress', ENTREVISTA_AGENDADA: 'Interview scheduled', ENTREVISTA_REALIZADA: 'Interview done', RECHAZADO: 'Did not continue', CONTRATADO: 'Hired' },
        errorCargar: 'Opportunities could not be loaded.',
        errorPostular: 'The application could not be logged.',
        laOfertaSigueAbierta: 'The posting is still open in the other tab: apply there and tell your coordinator, or try again here.',
        postulacionRegistradaConEnlace: (t: string) => `Application to “${t}” logged. We opened the posting in another tab so you can finish applying.`,
        postulacionRegistradaSinEnlace: (t: string, donde: string) => `Application to “${t}” logged. This posting has no direct link; look for it as “${donde}”.`,
        seEliminaraSeguimiento: (cargo: string, empresa: string) => `The follow-up for “${cargo}” at ${empresa} will be deleted. This cannot be undone.`,
        errorEliminar: 'The application could not be deleted.',
        errorEstado: 'The status could not be updated.',
        okPostulada: 'Application logged.', okEliminada: 'Application deleted.',
        okEstado: 'Status updated.',
        confirmarEliminar: 'This application will be removed from your tracker. This cannot be undone.',
      }
    : {
        cumple: 'cumple',
        parcial: 'parcial',
        bajo: 'bajo',
        registrando: 'Registrando…',
        pocaEvidencia: 'Esta oferta da poca información, así que la compatibilidad es orientativa.',
        registrarProceso: 'Registrar proceso',
        postulacionRegistrada: 'Postulación registrada',
        pago: 'Pago', ciudad: 'Ciudad', modalidad: 'Modalidad', jornada: 'Jornada',
        contrato: 'Contrato', ingles: 'Inglés', experiencia: 'Experiencia',
        aplicaAntes: 'Aplica antes de', sinExperiencia: 'Sin experiencia previa',
        anio: 'año', anios: 'años',
        requisitos: 'Requisitos', descripcionOferta: 'Descripción de la oferta',
        verOriginal: 'Ver oferta original', sinEnlace: 'Esta oferta no trae enlace directo.',
        fuente: 'Fuente',
        seguimiento: 'Seguimiento de mis postulaciones', misPostulaciones: 'Mis postulaciones',
        oportunidades: 'Oportunidades recomendadas', compatibilidad: 'Compatibilidad:',
        verOferta: 'Ver oferta', postularme: 'Postularme', postulando: 'Postulando…',
        registrar: 'Registrar postulación',
        registrarPie: 'Incluye procesos que no salieron del portal.',
        vacioHistorial: 'Registra una postulación propia o postúlate desde una oportunidad recomendada.',
        vacioSinVacantes: 'Aún no hay vacantes compatibles con tu perfil. El sistema busca oportunidades automáticamente.',
        vacioTodasHechas: 'Ya te postulaste a todas las oportunidades disponibles. ¡Bien hecho!',
        empresa: 'Empresa *', cargo: 'Cargo al que aplicaste *',
        canal: 'Canal (LinkedIn, Computrabajo...)', urlOferta: 'URL de la oferta (opcional)',
        observaciones: 'Observaciones o notas',
        eliminarPostulacion: 'Eliminar postulación', eliminar: 'Eliminar',
        cerrarAviso: 'Cerrar notificación',
        estados: { ENVIADA: 'Enviada', EN_PROCESO: 'En proceso', ENTREVISTA_AGENDADA: 'Entrevista agendada', ENTREVISTA_REALIZADA: 'Entrevista realizada', RECHAZADO: 'No continuó', CONTRATADO: 'Contratado' },
        errorCargar: 'No se pudieron cargar las oportunidades.',
        errorPostular: 'No se pudo registrar la postulación.',
        laOfertaSigueAbierta: 'La oferta sigue abierta en la otra pestaña: postúlate allí y avísale a tu coordinador, o vuelve a intentarlo aquí.',
        postulacionRegistradaConEnlace: (t: string) => `Postulación a «${t}» registrada. Abrimos la oferta en otra pestaña para que completes la aplicación.`,
        postulacionRegistradaSinEnlace: (t: string, donde: string) => `Postulación a «${t}» registrada. Esta oferta no trae enlace directo; búscala como «${donde}».`,
        seEliminaraSeguimiento: (cargo: string, empresa: string) => `Se eliminará el seguimiento de «${cargo}» en ${empresa}. Esta acción no se puede deshacer.`,
        errorEliminar: 'No se pudo eliminar la postulación.',
        errorEstado: 'No se pudo actualizar el estado.',
        okPostulada: 'Postulación registrada exitosamente.', okEliminada: 'Postulación eliminada.',
        okEstado: 'Estado actualizado.',
        confirmarEliminar: 'Esta postulación se quitará de tu seguimiento. No se puede deshacer.',
      }
}

export type TextosPostulaciones = ReturnType<typeof textos>

function DetalleVacante({ m, T }: { m: MatchResponse; T: TextosPostulaciones }) {
  const ciudad = m.vacanteCiudad || m.vacanteUbicacion
  const experiencia =
    m.vacanteAniosExperienciaRequeridos == null
      ? null
      : m.vacanteAniosExperienciaRequeridos === 0
        ? T.sinExperiencia
        : `${m.vacanteAniosExperienciaRequeridos} ${m.vacanteAniosExperienciaRequeridos === 1 ? T.anio : T.anios}`
  const expira = m.vacanteFechaExpiracion
    // Con el idioma de la aplicacion y no el del navegador: si no, la fecha
    // limite salia en el formato del sistema dentro de una pantalla traducida.
    ? new Date(m.vacanteFechaExpiracion).toLocaleDateString(T.anio === 'year' ? 'en-US' : 'es-CO')
    : null

  const hechos = [
    m.vacanteRangoSalarial && { icon: CurrencyDollar, etiqueta: T.pago, valor: m.vacanteRangoSalarial },
    ciudad && { icon: MapPin, etiqueta: T.ciudad, valor: ciudad },
    m.vacanteModalidadTrabajo && { icon: Laptop, etiqueta: T.modalidad, valor: m.vacanteModalidadTrabajo },
    m.vacanteJornada && { icon: Clock, etiqueta: T.jornada, valor: m.vacanteJornada },
    m.vacanteTipoContrato && { icon: Briefcase, etiqueta: T.contrato, valor: m.vacanteTipoContrato },
    m.vacanteNivelInglesRequerido && { icon: Translate, etiqueta: T.ingles, valor: m.vacanteNivelInglesRequerido },
    experiencia && { icon: GraduationCap, etiqueta: T.experiencia, valor: experiencia },
    expira && { icon: Calendar, etiqueta: T.aplicaAntes, valor: expira },
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
            {T.requisitos}
          </summary>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{requisitos}</p>
        </details>
      )}
      {descripcion && (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            {T.descripcionOferta}
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
            {T.verOriginal}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">{T.sinEnlace}</span>
        )}
        {m.vacanteFuente && (
          <span className="text-[11px] text-muted-foreground">{T.fuente}: {m.vacanteFuente}</span>
        )}
      </div>
    </div>
  )
}

export function StudentPostulaciones() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
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
            : T.errorCargar,
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
      mostrarNotificacion('error', mensajeDeError(e, T.errorPostular))
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
      mostrarNotificacion('exito', T.okPostulada)
    } catch (e) {
      mostrarNotificacion('error', mensajeDeError(e, T.errorPostular))
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
      mostrarNotificacion('exito', T.okEliminada)
    } catch (e) {
      mostrarNotificacion('error', mensajeDeError(e, T.errorEliminar))
      throw e
    }
  }

  const actualizarEstado = async (id: string, estado: string) => {
    try {
      const actualizada = await postulacionesApi.actualizar(id, { estado })
      setHistorial((items) => items.map((item) => item.id === id ? actualizada : item))
      mostrarNotificacion('exito', T.okEstado)
    } catch (e) {
      mostrarNotificacion('error', mensajeDeError(e, T.errorEstado))
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
            aria-label={T.cerrarAviso}
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
            {T.seguimiento} ({historial.length})
          </h2>
          {historial.length === 0 ? (
            <Card className="border-dashed shadow-none">
              <CardContent className="p-5 text-sm text-muted-foreground">{T.vacioHistorial}</CardContent>
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
                      {T.verOferta}
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
                    <option value="ENVIADA">{T.estados.ENVIADA}</option>
                    <option value="EN_PROCESO">{T.estados.EN_PROCESO}</option>
                    <option value="ENTREVISTA_AGENDADA">{T.estados.ENTREVISTA_AGENDADA}</option>
                    <option value="ENTREVISTA_REALIZADA">{T.estados.ENTREVISTA_REALIZADA}</option>
                    <option value="RECHAZADO">{T.estados.RECHAZADO}</option>
                    <option value="CONTRATADO">{T.estados.CONTRATADO}</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setPorEliminar(postulacion)}
                    title={T.eliminarPostulacion}
                  >
                    <Trash className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="h-fit shadow-none">
          <CardHeader><CardTitle className="text-base">{T.registrar}</CardTitle><CardDescription>{T.registrarPie}</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={registrarManual}>
              <Input required placeholder={T.empresa} value={empresaManual} onChange={(event) => setEmpresaManual(event.target.value)} />
              <Input required placeholder={T.cargo} value={cargoManual} onChange={(event) => setCargoManual(event.target.value)} />
              <Input placeholder={T.canal} value={canalManual} onChange={(event) => setCanalManual(event.target.value)} />
              <Input placeholder={T.urlOferta} value={urlOfertaManual} onChange={(event) => setUrlOfertaManual(event.target.value)} />
              <Input placeholder={T.observaciones} value={observacionesManual} onChange={(event) => setObservacionesManual(event.target.value)} />
              <Button type="submit" className="w-full" disabled={registrando}>{registrando ? T.registrando : T.registrarProceso}</Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* ── Mis postulaciones ── */}
      {postuladas.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {T.misPostulaciones} ({postuladas.length})
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
                  <DetalleVacante m={m} T={T} />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkle className="size-3.5 text-primary" />
                      <span className="text-xs text-muted-foreground">{T.compatibilidad}</span>
                      <MatchScore score={m.puntaje} />
                    </div>
                    <RazonesDelMatch razones={m.razones} cobertura={m.cobertura} />
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                    <CheckCircle className="size-4" />
                    {T.postulacionRegistrada}
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
          {T.oportunidades} ({disponibles.length})
        </h2>

        {disponibles.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
                <Briefcase className="size-5" />
              </span>
              <p className="max-w-md text-sm">
                {matches.length === 0
                  ? T.vacioSinVacantes
                  : T.vacioTodasHechas}
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
                  <DetalleVacante m={m} T={T} />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkle className="size-3.5 text-primary" />
                      <span className="text-xs text-muted-foreground">{T.compatibilidad}</span>
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
                        {T.postulando}
                      </>
                    ) : (
                      <>
                        {T.postularme}
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
        titulo={T.eliminarPostulacion}
        descripcion={
          porEliminar
            ? T.seEliminaraSeguimiento(porEliminar.cargo, porEliminar.empresaNombre)
            : undefined
        }
        textoConfirmar={T.eliminar}
        onConfirmar={eliminarPostulacion}
      />
    </div>
  )
}
