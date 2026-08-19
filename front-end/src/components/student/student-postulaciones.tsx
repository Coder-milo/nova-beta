'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Briefcase, Building, Calendar, CheckCircle2 as CheckCircle, ChevronRight, CircleAlert as WarningCircle, Clock, DollarSign as CurrencyDollar, ExternalLink as ArrowSquareOut, GraduationCap, Languages as Translate, Laptop, LoaderCircle as CircleNotch, MapPin, RotateCcw, Search, Sparkles as Sparkle, Trash2 as Trash } from 'lucide-react'
import type { ComponentType } from 'react'
import { ApiCallError, matchesApi, mensajeDeError, postulacionesApi } from '@/lib/api'
import { hoyLocal } from '@/lib/utils'
import { usePreferences } from '@/lib/preferences'
import type { MatchResponse, MiPostulacion, RazonDeMatch } from '@/lib/types'
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
 * Sintetiza el texto de una vacante en un pitch conciso de 2-3 líneas
 * y extrae los 3 a 5 puntos clave de requisitos o tareas.
 */
function sintetizarTexto(texto?: string | null): { pitch: string; puntos: string[] } {
  if (!texto || !texto.trim()) return { pitch: '', puntos: [] }

  const limpio = texto
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const lineas = limpio.split('\n').map((l) => l.trim()).filter(Boolean)
  const pitch = lineas.slice(0, 2).join(' ')

  const puntos: string[] = []
  for (const linea of lineas) {
    if (/^[•\-\*–]\s*/.test(linea) || /^\d+[\.\)]\s*/.test(linea)) {
      const limpioLinea = linea.replace(/^[•\-\*–\d\.\)]\s*/, '').trim()
      if (limpioLinea.length > 5 && limpioLinea.length < 200 && !puntos.includes(limpioLinea)) {
        puntos.push(limpioLinea)
        if (puntos.length >= 5) break
      }
    }
  }

  if (puntos.length === 0 && lineas.length > 2) {
    for (let i = 2; i < Math.min(lineas.length, 6); i++) {
      if (lineas[i].length > 10 && lineas[i].length < 180 && !puntos.includes(lineas[i])) {
        puntos.push(lineas[i])
      }
    }
  }

  return { pitch, puntos }
}

/**
 * Los textos de esta pantalla, en los dos idiomas.
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
        requisitosClave: 'Key requirements and tasks',
        verDescripcionCompleta: 'View full original description',
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
        confirmarPostulacion: 'Confirm application',
        seguroPostular: 'Do you want to apply to this opening?',
        abrirYConfirmar: 'Open posting & confirm application',
        confirmarSolo: 'Confirm application',
        desistirPostulacion: 'Withdraw application',
        cancelarPostulacionTitulo: 'Withdraw application?',
        cancelarPostulacionDesc: 'The opening will become available again in your recommended opportunities list.',
        cancelar: 'Cancel',
        ordenarPor: 'Sort by',
        masRecientes: 'Most recent',
        mayorAfinidad: 'Highest match',
        todas: 'All',
        nuevas: 'New',
        postuladas: 'Applied',
        buscarVacante: 'Search by role or company…',
        postulacionRevertida: 'Application withdrawn. The opening is available again.',
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
        requisitosClave: 'Puntos clave y requisitos',
        verDescripcionCompleta: 'Ver descripción completa original',
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
        confirmarPostulacion: 'Confirmar postulación',
        seguroPostular: '¿Deseas postularte a esta oportunidad?',
        abrirYConfirmar: 'Abrir oferta y confirmar postulación',
        confirmarSolo: 'Confirmar postulación',
        desistirPostulacion: 'Desistir de postulación',
        cancelarPostulacionTitulo: '¿Desistir de esta postulación?',
        cancelarPostulacionDesc: 'La vacante volverá a estar disponible en tu lista de oportunidades recomendadas.',
        cancelar: 'Cancelar',
        ordenarPor: 'Ordenar por',
        masRecientes: 'Más recientes',
        mayorAfinidad: 'Mayor afinidad',
        todas: 'Todas',
        nuevas: 'Nuevas',
        postuladas: 'Postuladas',
        buscarVacante: 'Buscar por cargo o empresa…',
        postulacionRevertida: 'Postulación cancelada. La vacante vuelve a estar disponible.',
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
    ? new Date(m.vacanteFechaExpiracion).toLocaleDateString(T.anio === 'year' ? 'en-US' : 'es-CO')
    : null

  const esRemoto =
    (m.vacanteModalidadTrabajo && m.vacanteModalidadTrabajo.toLowerCase().includes('remot')) ||
    (m.vacanteUbicacion && m.vacanteUbicacion.toLowerCase().includes('remot')) ||
    (m.vacanteDescripcion && m.vacanteDescripcion.toLowerCase().includes('teletrabajo'))

  const hechos = [
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

  const { pitch, puntos } = sintetizarTexto(descripcion || requisitos)

  if (hechos.length === 0 && !descripcion && !requisitos && !urlAbsoluta && !m.vacanteRangoSalarial) return null

  return (
    <div className="space-y-3.5 rounded-xl border border-border bg-card/60 p-4 shadow-xs">
      {/* Destacado de Salario y Modalidad */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
        {m.vacanteRangoSalarial ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-primary">
            <CurrencyDollar className="size-4 shrink-0 font-bold" />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-primary/80">{T.pago}</p>
              <p className="text-xs font-semibold tabular-nums text-foreground">{m.vacanteRangoSalarial}</p>
            </div>
          </div>
        ) : (
          <Badge variant="outline" className="text-[11px] text-muted-foreground">
            {T.pago}: {T.anio === 'year' ? 'Competitive / To be agreed' : 'A convenir / Competitivo'}
          </Badge>
        )}

        <div className="flex items-center gap-1.5">
          {esRemoto ? (
            <Badge variant="secondary" className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium text-xs">
              <Laptop className="size-3.5" />
              {T.anio === 'year' ? '100% Remote' : '100% Remoto'}
            </Badge>
          ) : ciudad ? (
            <Badge variant="outline" className="gap-1 text-xs font-medium">
              <MapPin className="size-3 text-primary" />
              {ciudad}
            </Badge>
          ) : null}
          {m.vacanteNivelInglesRequerido && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Translate className="size-3 text-primary" />
              {m.vacanteNivelInglesRequerido}
            </Badge>
          )}
        </div>
      </div>

      {/* Cuadrícula de Condiciones */}
      {hechos.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          {hechos.map((h) => (
            <Hecho key={h.etiqueta} icon={h.icon} etiqueta={h.etiqueta} valor={h.valor} />
          ))}
        </div>
      )}

      {/* Resumen conciso / pitch (sin muros de texto) */}
      {pitch && (
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
          {pitch}
        </p>
      )}

      {/* Puntos clave y requisitos estructurados */}
      {puntos.length > 0 && (
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkle className="size-3.5 text-primary" /> {T.requisitosClave}
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {puntos.map((pt, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary/70" />
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detalle original completo plegable */}
      {(descripcion || requisitos) && (
        <details className="group rounded-lg border border-border/60 bg-muted/10 p-2.5">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground list-none flex items-center justify-between">
            <span className="flex items-center gap-1">
              <ChevronRight className="size-3.5 transition-transform group-open:rotate-90 text-primary" />
              {T.verDescripcionCompleta}
            </span>
          </summary>
          <div className="mt-2 space-y-2 border-t border-border/40 pt-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {descripcion && <p>{descripcion}</p>}
            {requisitos && (
              <div className="pt-1">
                <p className="font-semibold text-foreground">{T.requisitos}:</p>
                <p>{requisitos}</p>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Pie con Enlace y Fuente */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2.5">
        {urlAbsoluta ? (
          <a
            href={urlAbsoluta}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-2"
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
  const [historial, setHistorial] = useState<MiPostulacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [postulando, setPostulando] = useState<string | null>(null)
  const [matchPorPostular, setMatchPorPostular] = useState<MatchResponse | null>(null)
  const [matchPorDesistir, setMatchPorDesistir] = useState<MatchResponse | null>(null)
  const [registrando, setRegistrando] = useState(false)
  const [notificacion, setNotificacion] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)
  const [porEliminar, setPorEliminar] = useState<MiPostulacion | null>(null)
  const [empresaManual, setEmpresaManual] = useState('')
  const [cargoManual, setCargoManual] = useState('')
  const [canalManual, setCanalManual] = useState('')
  const [urlOfertaManual, setUrlOfertaManual] = useState('')
  const [observacionesManual, setObservacionesManual] = useState('')

  // Filtros y ordenación de oportunidades
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todas' | 'disponibles' | 'postuladas'>('todas')
  const [orden, setOrden] = useState<'afinidad' | 'recientes'>('afinidad')

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

  const confirmarPostulacion = async () => {
    const match = matchPorPostular
    if (!match || postulando) return

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
          ? T.postulacionRegistradaConEnlace(match.vacanteTitulo)
          : T.postulacionRegistradaSinEnlace(match.vacanteTitulo, match.vacanteEmpresa || 'el portal'),
      )
    } catch (e) {
      mostrarNotificacion('error', mensajeDeError(e, T.errorPostular))
    } finally {
      setPostulando(null)
      setMatchPorPostular(null)
    }
  }

  const desistirPostulacion = async () => {
    const match = matchPorDesistir
    if (!match) return
    try {
      await matchesApi.cancelarPostulacion(match.id)
      setMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, postulado: false } : m)),
      )
      await refrescarHistorial()
      mostrarNotificacion('exito', T.postulacionRevertida)
    } catch (e) {
      mostrarNotificacion('error', mensajeDeError(e, T.errorEliminar))
    } finally {
      setMatchPorDesistir(null)
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
      const actualizada = await postulacionesApi.actualizarPropia(id, { estado })
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

  const disponiblesCount = matches.filter((m) => !m.postulado).length
  const postuladasCount = matches.filter((m) => m.postulado).length

  // Filtrado y ordenación dinámicos
  const matchesFiltrados = matches.filter((m) => {
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim()
      const matchTitulo = m.vacanteTitulo?.toLowerCase().includes(q)
      const matchEmpresa = m.vacanteEmpresa?.toLowerCase().includes(q)
      const matchUbicacion = m.vacanteUbicacion?.toLowerCase().includes(q)
      if (!matchTitulo && !matchEmpresa && !matchUbicacion) return false
    }
    if (filtroEstado === 'disponibles') return !m.postulado
    if (filtroEstado === 'postuladas') return m.postulado
    return true
  }).sort((a, b) => {
    if (orden === 'recientes') {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return dateB - dateA
    }
    return b.puntaje - a.puntaje
  })

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
          ) : (
            historial.map((postulacion) => (
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
                        className="mt-0.5 inline-block text-xs text-primary underline truncate max-w-xs font-medium"
                      >
                        {T.verOferta}
                      </a>
                    )}
                    {postulacion.observaciones && (
                      <p className="mt-1 text-xs text-muted-foreground italic">{postulacion.observaciones}</p>
                    )}
                    {postulacion.fechaHoraEntrevista && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary">
                        <Calendar className="size-3.5 shrink-0" />
                        {new Date(postulacion.fechaHoraEntrevista).toLocaleString(
                          locale === 'en' ? 'en-GB' : 'es-CO',
                          { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' },
                        )}
                        {postulacion.modalidadEtiqueta ? ` · ${postulacion.modalidadEtiqueta}` : ''}
                      </p>
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
            ))
          )}
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

      {/* ── Sección de Oportunidades y Descubrimiento ── */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {T.oportunidades} ({matches.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Explora y postúlate a las vacantes analizadas y recomendadas para tu perfil.
            </p>
          </div>

          {/* Barra de herramientas: Filtros, Búsqueda y Orden */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={T.buscarVacante}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="h-8 w-48 pl-8 text-xs sm:w-60"
              />
            </div>

            <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFiltroEstado('todas')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  filtroEstado === 'todas' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {T.todas} ({matches.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('disponibles')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  filtroEstado === 'disponibles' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {T.nuevas} ({disponiblesCount})
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstado('postuladas')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  filtroEstado === 'postuladas' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {T.postuladas} ({postuladasCount})
              </button>
            </div>

            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as 'afinidad' | 'recientes')}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
              aria-label={T.ordenarPor}
            >
              <option value="afinidad">{T.mayorAfinidad}</option>
              <option value="recientes">{T.masRecientes}</option>
            </select>
          </div>
        </div>

        {matchesFiltrados.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
                <Briefcase className="size-5" />
              </span>
              <p className="max-w-md text-sm">
                {busqueda
                  ? 'No se encontraron vacantes con el término de búsqueda ingresado.'
                  : matches.length === 0
                    ? T.vacioSinVacantes
                    : 'No hay vacantes para el filtro seleccionado.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {matchesFiltrados.map((m) => (
              <Card key={m.id} className={`shadow-none transition-all ${m.postulado ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base leading-snug">{m.vacanteTitulo}</CardTitle>
                    {m.postulado ? (
                      <Badge className="shrink-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">
                        Postulado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0">
                        {Math.round(m.puntaje)}% match
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-1">
                    <Building className="size-3.5" />
                    {m.vacanteEmpresa || 'Empresa confidencial'}
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

                  {m.postulado ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="size-4" />
                        {T.postulacionRegistrada}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
                        onClick={() => setMatchPorDesistir(m)}
                      >
                        <RotateCcw className="size-3.5" />
                        {T.desistirPostulacion}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full gap-1.5"
                      disabled={postulando === m.id}
                      onClick={() => setMatchPorPostular(m)}
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
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Modal de Confirmación de Postulación */}
      <Confirmar
        open={matchPorPostular !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setMatchPorPostular(null)
        }}
        titulo={T.confirmarPostulacion}
        destructivo={false}
        textoConfirmar={
          matchPorPostular && urlDeOferta(matchPorPostular)
            ? T.abrirYConfirmar
            : T.confirmarSolo
        }
        textoCancelar={T.cancelar}
        onConfirmar={confirmarPostulacion}
        descripcion={
          matchPorPostular ? (
            <div className="space-y-3 pt-1 text-xs text-muted-foreground">
              <p>{T.seguroPostular}</p>
              <div className="rounded-lg border border-border bg-card p-3 space-y-1.5 text-foreground">
                <p className="font-semibold text-sm">{matchPorPostular.vacanteTitulo}</p>
                <p className="text-muted-foreground">{matchPorPostular.vacanteEmpresa || 'Empresa confidencial'}</p>
                {matchPorPostular.vacanteRangoSalarial && (
                  <p className="font-medium text-primary">{matchPorPostular.vacanteRangoSalarial}</p>
                )}
              </div>
              {urlDeOferta(matchPorPostular) ? (
                <p className="text-[11px] leading-relaxed">
                  Al confirmar, se abrirá la oferta original en una nueva pestaña para que completes los datos que solicite la empresa y quedará registrada en tu seguimiento.
                </p>
              ) : (
                <p className="text-[11px] leading-relaxed">
                  Esta vacante no incluye enlace externo directo. Se registrará la postulación en tu panel para coordinar con tu equipo de empleabilidad.
                </p>
              )}
            </div>
          ) : undefined
        }
      />

      {/* Modal de Confirmación de Cancelación / Desistir */}
      <Confirmar
        open={matchPorDesistir !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setMatchPorDesistir(null)
        }}
        titulo={T.cancelarPostulacionTitulo}
        destructivo={true}
        textoConfirmar={T.desistirPostulacion}
        textoCancelar={T.cancelar}
        onConfirmar={desistirPostulacion}
        descripcion={
          matchPorDesistir ? (
            <div className="space-y-2 pt-1 text-xs text-muted-foreground">
              <p>{T.cancelarPostulacionDesc}</p>
              <p className="font-medium text-foreground">
                {matchPorDesistir.vacanteTitulo} · {matchPorDesistir.vacanteEmpresa}
              </p>
            </div>
          ) : undefined
        }
      />

      {/* Modal de Eliminación de Postulación Manual */}
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
