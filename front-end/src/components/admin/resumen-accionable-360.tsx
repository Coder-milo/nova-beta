'use client'

import {
  AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2,
  CircleAlert, ClipboardCheck, FileUser, LoaderCircle, Target, UserRoundCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { calcularResumenAccionable360, type CargasResumen360 } from '@/lib/resumen-360'
import type {
  EstudianteResponse, HojaDeVidaResponse, PipelineEmpleabilidadResponse,
  PostulacionResponse, RecomendacionCopiloto, RespuestaCopiloto,
  SeguimientoResponse, TipoAccionCopiloto,
} from '@/lib/types'

interface Props {
  estudiante: EstudianteResponse
  seguimientos: SeguimientoResponse[]
  hojasDeVida: HojaDeVidaResponse[]
  postulaciones: PostulacionResponse[]
  pipeline: PipelineEmpleabilidadResponse | null
  cargas: CargasResumen360
  copiloto: RespuestaCopiloto | null
  cargandoCopiloto: boolean
  errorCopiloto?: boolean
  english?: boolean
  onRegistrarSeguimiento: () => void
  onRevisarHojaDeVida: () => void
  onNuevaPostulacion: () => void
  onGestionarPostulaciones: () => void
  onRevisarPreparacion: () => void
}

function formatearFecha(valor: string | null | undefined, english: boolean, conHora = false): string {
  if (!valor) return '—'
  const esSoloFecha = /^\d{4}-\d{2}-\d{2}$/.test(valor)
  const fecha = new Date(esSoloFecha ? `${valor}T12:00:00` : valor)
  if (Number.isNaN(fecha.getTime())) return valor
  return new Intl.DateTimeFormat(english ? 'en-GB' : 'es-CO', {
    day: 'numeric', month: 'short',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(fecha)
}

function textos(english: boolean) {
  return english ? {
    titulo: 'Copilot: next best action',
    descripcion: 'Prioritised recommendations based on verifiable information from this process.',
    atenciones: 'What to do now',
    sinAlertas: 'No action requiring attention was detected with the available data.',
    evaluando: 'Analysing the student’s process…',
    error: 'The process could not be analysed. The existing records remain available below.',
    porQue: 'Why it matters', evidencia: 'Evidence used', responsable: 'Case owner',
    sinResponsable: 'Unassigned', ultimoSeguimiento: 'Last follow-up', sinSeguimiento: 'No follow-ups',
    haceDias: (dias: number) => `${dias} day${dias === 1 ? '' : 's'} ago`,
    proximoCompromiso: 'Next commitment', sinCompromiso: 'No scheduled action',
    cvVigente: 'Current résumé', sinCv: 'No current version',
    postulacionesActivas: 'Active applications', empleabilidad: 'Employability preparation',
    etapaSinCalcular: 'Stage not calculated', registrarSeguimiento: 'Add follow-up',
    nuevaPostulacion: 'Add application', revisarHv: 'Review résumé',
    revisarPreparacion: 'Review preparation',
  } : {
    titulo: 'Copiloto: siguiente mejor acción',
    descripcion: 'Recomendaciones priorizadas a partir de información verificable del proceso.',
    atenciones: 'Qué conviene hacer ahora',
    sinAlertas: 'No se detectó una acción que requiera atención con los datos disponibles.',
    evaluando: 'Analizando el proceso del estudiante…',
    error: 'No se pudo analizar el proceso. Los registros existentes siguen disponibles debajo.',
    porQue: 'Por qué importa', evidencia: 'Datos utilizados', responsable: 'Responsable del caso',
    sinResponsable: 'Sin asignar', ultimoSeguimiento: 'Último seguimiento', sinSeguimiento: 'Sin seguimientos',
    haceDias: (dias: number) => `Hace ${dias} día${dias === 1 ? '' : 's'}`,
    proximoCompromiso: 'Próximo compromiso', sinCompromiso: 'Sin acción programada',
    cvVigente: 'Hoja de vida vigente', sinCv: 'Sin versión vigente',
    postulacionesActivas: 'Postulaciones activas', empleabilidad: 'Preparación laboral',
    etapaSinCalcular: 'Etapa sin calcular', registrarSeguimiento: 'Registrar seguimiento',
    nuevaPostulacion: 'Nueva postulación', revisarHv: 'Revisar hoja de vida',
    revisarPreparacion: 'Revisar preparación',
  }
}

function estilo(prioridad: RecomendacionCopiloto['prioridad']) {
  if (prioridad === 'ALTA') return {
    contenedor: 'border-destructive/25 bg-destructive/[0.045]', icono: 'text-destructive', Icono: CircleAlert,
  }
  if (prioridad === 'MEDIA') return {
    contenedor: 'border-warning/25 bg-warning/[0.055]', icono: 'text-warning', Icono: AlertTriangle,
  }
  return {
    contenedor: 'border-primary/20 bg-primary/[0.045]', icono: 'text-primary', Icono: CalendarClock,
  }
}

function Dato360({ icono: Icono, etiqueta, valor, detalle }: {
  icono: typeof UserRoundCheck
  etiqueta: string
  valor: string
  detalle?: string | null
}) {
  return <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
    <div className="flex items-center gap-2 text-muted-foreground"><Icono className="size-3.5" /><span className="text-[11px] font-medium uppercase tracking-wide">{etiqueta}</span></div>
    <p className="mt-2 text-sm font-semibold text-foreground">{valor}</p>
    {detalle && <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>}
  </div>
}

export function ResumenAccionable360({
  estudiante, seguimientos, hojasDeVida, postulaciones, pipeline, cargas,
  copiloto, cargandoCopiloto, errorCopiloto = false, english = false,
  onRegistrarSeguimiento, onRevisarHojaDeVida, onNuevaPostulacion,
  onGestionarPostulaciones, onRevisarPreparacion,
}: Props) {
  const T = textos(english)
  const resumen = calcularResumenAccionable360({
    estudiante, seguimientos, hojasDeVida, postulaciones, pipeline, cargas,
  })
  const recomendaciones = copiloto?.recomendaciones ?? []

  const ejecutar = (accion: TipoAccionCopiloto) => {
    if (accion === 'SEGUIMIENTO') onRegistrarSeguimiento()
    if (accion === 'HOJA_DE_VIDA') onRevisarHojaDeVida()
    if (accion === 'OPORTUNIDADES') onNuevaPostulacion()
    if (accion === 'POSTULACIONES') onGestionarPostulaciones()
    if (accion === 'PREPARACION') onRevisarPreparacion()
  }

  return <Card className="rounded-2xl border-border shadow-sm">
    <CardHeader className="border-b border-border/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><CardTitle className="flex items-center gap-2"><Target className="size-4 text-primary" />{T.titulo}</CardTitle><CardDescription className="mt-1">{T.descripcion}</CardDescription></div>
        <Badge variant={recomendaciones.some((item) => item.prioridad === 'ALTA') ? 'destructive' : 'outline'}>{recomendaciones.length} {english ? 'recommendation(s)' : 'recomendación(es)'}</Badge>
      </div>
    </CardHeader>

    <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
      <section aria-labelledby="atenciones-360">
        <h3 id="atenciones-360" className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{T.atenciones}</h3>
        <div className="space-y-2">
          {recomendaciones.map((item) => {
            const aspecto = estilo(item.prioridad)
            const Icono = aspecto.Icono
            const titulo = english ? item.texto.tituloEn : item.texto.tituloEs
            const detectado = english ? item.texto.queDetectoEn : item.texto.queDetectoEs
            const importancia = english ? item.texto.porQueImportaEn : item.texto.porQueImportaEs
            const etiquetaAccion = english ? item.accion.etiquetaEn : item.accion.etiquetaEs
            return <button key={item.codigo} type="button" onClick={() => ejecutar(item.accion.tipo)} className={`group w-full rounded-xl border p-3 text-left transition-colors hover:border-primary/35 ${aspecto.contenedor}`}>
              <span className="flex items-start gap-3">
                <Icono className={`mt-0.5 size-4 shrink-0 ${aspecto.icono}`} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{titulo}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{detectado}</span><span className="mt-2 block text-xs text-foreground/80"><b>{T.porQue}:</b> {importancia}</span></span>
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary"><span className="hidden sm:inline">{etiquetaAccion}</span><ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
              </span>
              {item.evidencia.length > 0 && <span className="mt-3 block border-t border-current/10 pt-2"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{T.evidencia}</span><span className="flex flex-wrap gap-1.5">{item.evidencia.map((e) => <Badge key={e.codigo} variant="outline" className="bg-background/60 text-[10px] font-normal">{english ? e.etiquetaEn : e.etiquetaEs}</Badge>)}</span></span>}
            </button>
          })}

          {recomendaciones.length === 0 && <div className={`flex items-start gap-3 rounded-xl border p-4 ${errorCopiloto ? 'border-destructive/20 bg-destructive/[0.04]' : 'border-success/20 bg-success/[0.045]'}`}>
            {cargandoCopiloto ? <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-primary" /> : errorCopiloto ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />}
            <p className="text-sm text-muted-foreground">{cargandoCopiloto ? T.evaluando : errorCopiloto ? T.error : T.sinAlertas}</p>
          </div>}
        </div>
      </section>

      <section className="grid content-start gap-2 sm:grid-cols-2 lg:grid-cols-2">
        <Dato360 icono={UserRoundCheck} etiqueta={T.responsable} valor={resumen.responsable ?? T.sinResponsable} />
        <Dato360 icono={ClipboardCheck} etiqueta={T.ultimoSeguimiento} valor={cargas.seguimientos ? T.evaluando : resumen.ultimoSeguimiento ? formatearFecha(resumen.ultimoSeguimiento.fecha, english) : T.sinSeguimiento} detalle={resumen.diasSinSeguimiento == null ? null : T.haceDias(resumen.diasSinSeguimiento)} />
        <Dato360 icono={CalendarClock} etiqueta={T.proximoCompromiso} valor={cargas.seguimientos ? T.evaluando : resumen.proximoCompromiso?.proximaAccion || T.sinCompromiso} detalle={resumen.proximoCompromiso?.fechaProxima ? formatearFecha(resumen.proximoCompromiso.fechaProxima, english) : null} />
        <Dato360 icono={FileUser} etiqueta={T.cvVigente} valor={cargas.hojasDeVida ? T.evaluando : resumen.hojaDeVidaVigente ? `v${resumen.hojaDeVidaVigente.numeroVersion}` : T.sinCv} detalle={resumen.hojaDeVidaVigente ? formatearFecha(resumen.hojaDeVidaVigente.createdAt, english) : null} />
        <Dato360 icono={BriefcaseBusiness} etiqueta={T.postulacionesActivas} valor={cargas.empleabilidad ? T.evaluando : String(resumen.postulacionesActivas ?? 0)} detalle={resumen.entrevistaProxima ? `${formatearFecha(resumen.entrevistaProxima.fechaHoraEntrevista, english, true)} · ${resumen.entrevistaProxima.cargo}` : null} />
        <Dato360 icono={Target} etiqueta={T.empleabilidad} valor={`${estudiante.porcentajeEmpleabilidad ?? 0}%`} detalle={resumen.etapa?.replaceAll('_', ' ') ?? T.etapaSinCalcular} />
      </section>
    </CardContent>

    <div className="flex flex-wrap gap-2 border-t border-border/70 px-5 pt-4">
      <Button size="sm" onClick={onRegistrarSeguimiento}><ClipboardCheck /> {T.registrarSeguimiento}</Button>
      <Button size="sm" variant="outline" onClick={onNuevaPostulacion}><BriefcaseBusiness /> {T.nuevaPostulacion}</Button>
      <Button size="sm" variant="outline" onClick={onRevisarHojaDeVida}><FileUser /> {T.revisarHv}</Button>
      <Button size="sm" variant="outline" onClick={onRevisarPreparacion}><Target /> {T.revisarPreparacion}</Button>
    </div>
  </Card>
}
