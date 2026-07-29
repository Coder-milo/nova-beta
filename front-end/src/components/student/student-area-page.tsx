'use client'
import { useEffect, useState } from 'react'
import Link from '@/compat/next-link'
import {
  Bell,
  CaretLeft,
  CaretRight,
  CalendarBlank,
  ChatCircle,
  CircleNotch,
  DownloadSimple,
  Globe,
  Info,
  Moon,
  PaperPlaneTilt,
  Sun,
  WarningCircle,
} from '@phosphor-icons/react'
import {
  actividadesApi,
  estudiantesApi,
  colocacionesApi,
  mensajesApi,
  notificacionesApi,
  pipelineApi,
  seguimientosApi,
} from '@/lib/api'
import type {
  ActividadResponse,
  EstudianteResponse,
  NotificacionResponse,
  MensajeResponse,
  PipelineEmpleabilidadResponse,
  ColocacionResponse,
  SeguimientoResponse,
} from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StudentPerfil } from './student-perfil'
import { StudentDocumentos } from './student-documentos'
import { StudentPostulaciones } from './student-postulaciones'
import { usePreferences } from '@/lib/preferences'

export type StudentArea =
  | 'proceso'
  | 'actividades'
  | 'documentos'
  | 'hv'
  | 'postulaciones'
  | 'calendario'
  | 'mensajes'
  | 'notificaciones'
  | 'ayuda'
  | 'configuracion'

function estadoHito(valor: string | null | undefined) {
  if (valor === 'SI') return { texto: 'Completado', clase: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700' }
  if (valor === 'EN_PROCESO') return { texto: 'En proceso', clase: 'border-amber-500/25 bg-amber-500/10 text-amber-700' }
  return { texto: 'Pendiente', clase: 'border-border bg-muted/50 text-muted-foreground' }
}

export function StudentAreaPage({ area }: { area: StudentArea }) {
  const [perfil, setPerfil] = useState<EstudianteResponse | null>(null)
  const [seguimientos, setSeguimientos] = useState<SeguimientoResponse[]>([])
  const [pipeline, setPipeline] = useState<PipelineEmpleabilidadResponse | null>(null)
  const [colocaciones, setColocaciones] = useState<ColocacionResponse[]>([])
  const [actividades, setActividades] = useState<ActividadResponse[]>([])
  const [notificaciones, setNotificaciones] = useState<NotificacionResponse[]>([])
  const [mensajes, setMensajes] = useState<MensajeResponse[]>([])
  const [asuntoMensaje, setAsuntoMensaje] = useState('')
  const [contenidoMensaje, setContenidoMensaje] = useState('')
  const [enviandoMensaje, setEnviandoMensaje] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const p = await estudiantesApi.obtenerMiPerfil()
        setPerfil(p)
        if (area === 'proceso') {
          setSeguimientos(await seguimientosApi.mio())
          // Mientras se actualiza un entorno con un backend anterior, el
          // historial sigue funcionando aunque aún no exista el pipeline.
          try {
            setPipeline(await pipelineApi.mio())
          } catch {
            setPipeline(null)
          }
          try {
            setColocaciones(await colocacionesApi.mia())
          } catch {
            setColocaciones([])
          }
        }

        if (area === 'actividades' || area === 'calendario')
          setActividades(await actividadesApi.mias())
        if (area === 'notificaciones')
          setNotificaciones(
            (await notificacionesApi.listarPorEstudiante(p.id, 0, 100)).content,
          )
        if (area === 'mensajes') setMensajes(await mensajesApi.mios())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No fue posible cargar esta sección')
      } finally {
        setLoading(false)
      }
    })()
  }, [area])

  const marcarLeida = async (n: NotificacionResponse) => {
    if (n.leida) return
    await notificacionesApi.marcarLeida(n.id)
    setNotificaciones((v) => v.map((x) => (x.id === n.id ? { ...x, leida: true } : x)))
  }

  const descargar = () =>
    estudiantesApi.descargarMiHvPdf(`HV-${perfil?.nombre || 'estudiante'}.pdf`)

  const enviarMensaje = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!asuntoMensaje.trim() || !contenidoMensaje.trim()) return
    setEnviandoMensaje(true)
    setError('')
    setMensajeExito('')
    try {
      const nuevo = await mensajesApi.enviar({
        asunto: asuntoMensaje.trim(),
        contenido: contenidoMensaje.trim(),
      })
      setMensajes((items) => [nuevo, ...items])
      setAsuntoMensaje('')
      setContenidoMensaje('')
      setMensajeExito('Tu mensaje fue enviado al equipo de acompañamiento.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible enviar el mensaje.')
    } finally {
      setEnviandoMensaje(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-muted-foreground">
        <CircleNotch className="size-5 animate-spin" />
        Cargando información…
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      {error && (
        <div className="flex gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <WarningCircle className="size-5" />
          {error}
        </div>
      )}

      {/* ── Perfil ────────────────────────────────────────────── */}
      {/* ── Mi proceso ────────────────────────────────────────── */}
      {area === 'proceso' && (
        <div className="space-y-4">
          {pipeline && (
            <Card className="border-primary/20 shadow-none">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Ruta de empleabilidad</p>
                    <p className="mt-1 text-lg font-semibold">{pipeline.etapa.replaceAll('_', ' ')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{pipeline.proximaAccion || 'Tu proceso está actualizado.'}</p>
                  </div>
                  <Badge>{pipeline.porcentajeAvance}% de avance</Badge>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pipeline.porcentajeAvance}%` }} />
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <span>HV: {pipeline.hvGenerada ? 'Lista' : 'Pendiente'}</span>
                  <span>Postulaciones: {pipeline.postulacionesEnviadas}</span>
                  <span>Empresas: {pipeline.empresasContactadas}</span>
                </div>
                {pipeline.pendientes.length > 0 && (
                  <p className="text-xs text-muted-foreground">Pendientes: {pipeline.pendientes.join(' · ')}</p>
                )}
              </CardContent>
            </Card>
          )}
          {perfil && <Card className="shadow-none">
            <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Preparación para la empleabilidad</CardTitle><CardDescription>Así va tu perfil antes de postularte a oportunidades.</CardDescription></div><Badge variant="outline">{perfil.hitosCumplidos}/5 hitos</Badge></div></CardHeader>
            <CardContent className="space-y-4"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{[
              ['CV listo', perfil.hitoCvListo], ['CV en inglés', perfil.hitoCvIngles], ['LinkedIn creado', perfil.hitoLinkedinCreado], ['LinkedIn optimizado', perfil.hitoLinkedinOptimizado], ['Perfil ocupacional', perfil.hitoPerfilOcupacional],
            ].map(([nombre, estado]) => {
              const hito = estadoHito(estado)
              const pendiente = estado !== 'SI'
              const esLinkedin = nombre === 'LinkedIn optimizado' || nombre === 'LinkedIn creado'
              const abrirLinkedin = esLinkedin && Boolean(perfil.linkedinUrl)
              const etiquetaAccion = nombre === 'LinkedIn optimizado'
                ? (abrirLinkedin ? 'Optimizar en LinkedIn' : 'Agregar enlace de LinkedIn')
                : nombre === 'LinkedIn creado'
                  ? (abrirLinkedin ? 'Ver perfil de LinkedIn' : 'Registrar LinkedIn')
                  : nombre === 'Perfil ocupacional'
                    ? 'Completar perfil'
                    : 'Ver cómo completarlo'
              return <div key={nombre} className={`rounded-xl border p-3 ${hito.clase}`}><p className="text-[11px] font-medium uppercase tracking-wide">{nombre}</p><p className="mt-1 text-sm font-semibold">{hito.texto}</p>{pendiente && (abrirLinkedin ? <a href={perfil.linkedinUrl!} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline">{etiquetaAccion} ↗</a> : <Link href={nombre.startsWith('CV') ? '/mis-documentos' : '/configuracion-estudiante'} className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline">{etiquetaAccion} →</Link>)}</div>
            })}</div>
              <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-xl border border-border/70 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cargos a los que puedes aplicar</p><p className="mt-2 whitespace-pre-line text-sm leading-6">{perfil.cargoObjetivo || 'Tu equipo aún no ha definido cargos sugeridos.'}</p></div><div className="rounded-xl border border-border/70 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sector objetivo</p><p className="mt-2 text-sm">{perfil.sectorObjetivo || perfil.sectorExperiencia || 'Por definir'}</p>{perfil.competencias && <p className="mt-2 whitespace-pre-line text-xs leading-5 text-muted-foreground">{perfil.competencias}</p>}</div></div>
              {perfil.pendientesPreparacion.length > 0 && <p className="text-xs text-muted-foreground">Próximos pendientes: {perfil.pendientesPreparacion.join(' · ')}</p>}
            </CardContent>
          </Card>}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Estado actual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{perfil?.estadoEmpleabilidad || 'SIN INFORMACIÓN'}</Badge>
                <span className="text-sm text-muted-foreground">
                  {seguimientos.length} actualizaciones registradas
                </span>
              </div>
            </CardContent>
          </Card>

          {(perfil?.carpetaUrl || perfil?.linkedinUrl) && (
            <Card className="shadow-none">
              <CardHeader><CardTitle>Mis enlaces de trabajo</CardTitle><CardDescription>Accesos asociados a tu proceso de empleabilidad.</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap gap-3 text-sm">
                {perfil.carpetaUrl && <a href={perfil.carpetaUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 font-medium text-primary hover:bg-primary/5">Carpeta de documentos</a>}
                {perfil.linkedinUrl && <a href={perfil.linkedinUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 font-medium text-primary hover:bg-primary/5">Perfil de LinkedIn</a>}
              </CardContent>
            </Card>
          )}

          {colocaciones.length > 0 && (
            <Card className="border-emerald-500/20 shadow-none">
              <CardHeader>
                <CardTitle>Tu vinculación laboral</CardTitle>
                <CardDescription>Información verificada por el equipo de empleabilidad.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {colocaciones.map((colocacion) => (
                  <div key={colocacion.id} className="rounded-xl border border-border/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{colocacion.empresaNombre}</p><p className="mt-1 text-sm text-muted-foreground">{colocacion.cargo || 'Cargo pendiente de registrar'} · {colocacion.fechaInicio || 'Fecha por confirmar'}</p></div><Badge variant="outline">{colocacion.tipoVinculacionEtiqueta}</Badge></div>
                    <p className="mt-2 text-xs text-muted-foreground">{colocacion.canalConsecucionEtiqueta || 'Canal sin registrar'} · Checklist de ingreso: {colocacion.checklistVerificados}/{colocacion.checklistTotal}</p>
                    {colocacion.observaciones && <p className="mt-2 text-sm text-muted-foreground">{colocacion.observaciones}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {seguimientos.length === 0 ? (
            <Empty icon={<Info />} text="Tu coordinador aún no ha registrado actualizaciones de seguimiento." />
          ) : (
            seguimientos.map((s) => (
              <Card key={s.id} className="shadow-none">
                <CardContent className="flex gap-4 p-5">
                  <span className="mt-1 size-3 shrink-0 rounded-full bg-primary" />
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <strong>{s.tipo}</strong>
                      <Badge variant="outline">{s.estado}</Badge>
                      <span className="text-sm text-muted-foreground">{s.fecha}</span>
                    </div>
                    {s.observacion && (
                      <p className="mt-2 text-sm text-muted-foreground">{s.observacion}</p>
                    )}
                    {s.proximaAccion && (
                      <p className="mt-2 text-sm">
                        <b>Próximo paso:</b> {s.proximaAccion}
                      </p>
                    )}
                    {s.fechaProxima && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Fecha: {s.fechaProxima}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Actividades / Calendario ───────────────────────────── */}
      {area === 'calendario' && <CalendarioEstudiante actividades={actividades} />}

      {/* ── Documentos ─────────────────────────────────────────── */}
      {area === 'documentos' && (
        <StudentDocumentos />
      )}

      {/* ── Hoja de vida ───────────────────────────────────────── */}
      {area === 'hv' && (
        <Card className="max-w-2xl shadow-none">
          <CardHeader>
            <CardTitle>Tu hoja de vida profesional</CardTitle>
            <CardDescription>
              La información se genera con los datos actualizados de tu perfil.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border bg-secondary/40 p-4 text-sm space-y-2">
              <p>
                <b>Nombre:</b> {perfil?.nombre} {perfil?.apellido}
              </p>
              <p>
                <b>Cargo objetivo:</b>{' '}
                {perfil?.cargoObjetivo || (
                  <span className="italic text-muted-foreground">Pendiente — edita tu perfil</span>
                )}
              </p>
              <p>
                <b>Perfil profesional:</b>{' '}
                {perfil?.perfilProfesional || (
                  <span className="italic text-muted-foreground">Pendiente de completar</span>
                )}
              </p>
              {perfil?.competencias && (
                <p>
                  <b>Competencias:</b> {perfil.competencias}
                </p>
              )}
              {perfil?.nivelIngles && (
                <p>
                  <b>Inglés:</b> {perfil.nivelIngles}
                </p>
              )}
            </div>
            {(!perfil?.cargoObjetivo || !perfil?.perfilProfesional) && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <WarningCircle className="size-4" />
                Completa tu perfil antes de descargar para obtener una mejor HV.
              </p>
            )}
            <Button onClick={descargar}>
              <DownloadSimple /> Descargar CV en PDF
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Postulaciones ──────────────────────────────────────── */}
      {area === 'postulaciones' && <StudentPostulaciones />}

      {/* ── Notificaciones ─────────────────────────────────────── */}
      {area === 'notificaciones' && (
        <div className="space-y-3">
          {notificaciones.length ? (
            notificaciones.map((n) => (
              <button
                key={n.id}
                onClick={() => marcarLeida(n)}
                className="flex w-full gap-4 rounded-xl border border-border bg-card p-4 text-left hover:bg-secondary/40"
              >
                <span
                  className={`mt-1 size-2.5 shrink-0 rounded-full ${n.leida ? 'bg-border' : 'bg-primary'}`}
                />
                <div>
                  <strong className="text-sm">{n.titulo}</strong>
                  <p className="mt-1 text-sm text-muted-foreground">{n.mensaje}</p>
                  {n.mediaUrl && (n.mediaTipo === 'IMAGE' ? <img src={n.mediaUrl} alt={`Material de ${n.titulo}`} className="mt-3 max-h-72 w-full rounded-lg border border-border object-cover" /> : n.mediaTipo === 'VIDEO' ? <video src={n.mediaUrl} controls className="mt-3 max-h-72 w-full rounded-lg border border-border" /> : <a href={n.mediaUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">Abrir información del anuncio</a>)}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString('es-CO')}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <Empty icon={<Bell />} text="No tienes notificaciones." />
          )}
        </div>
      )}

      {/* ── Mensajes ───────────────────────────────────────────── */}
      {area === 'mensajes' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-3">
            {mensajes.length ? mensajes.map((mensaje) => (
              <Card key={mensaje.id} className="shadow-none">
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{mensaje.asunto}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Enviado {new Date(mensaje.createdAt).toLocaleString('es-CO')}
                      </p>
                    </div>
                    <Badge variant={mensaje.estado === 'RESPONDIDO' ? 'default' : 'secondary'}>
                      {mensaje.estado === 'RESPONDIDO' ? 'Respondido' : 'En seguimiento'}
                    </Badge>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{mensaje.contenido}</p>
                  {mensaje.respuesta && (
                    <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
                      <p className="text-sm font-semibold text-primary">
                        Respuesta del equipo{mensaje.respondidoPor ? ` · ${mensaje.respondidoPor}` : ''}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{mensaje.respuesta}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )) : (
              <Empty icon={<ChatCircle />} text="Aún no has enviado mensajes al equipo de acompañamiento." />
            )}
          </section>

          <Card className="h-fit shadow-none lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle>Escribir un mensaje</CardTitle>
              <CardDescription>Tu solicitud llegará al equipo de acompañamiento.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={enviarMensaje}>
                <input
                  value={asuntoMensaje}
                  onChange={(event) => setAsuntoMensaje(event.target.value)}
                  maxLength={160}
                  required
                  placeholder="Asunto"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <textarea
                  value={contenidoMensaje}
                  onChange={(event) => setContenidoMensaje(event.target.value)}
                  maxLength={5000}
                  required
                  rows={7}
                  placeholder="Cuéntanos en qué necesitas ayuda..."
                  className="flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {mensajeExito && <p className="text-sm text-emerald-600">{mensajeExito}</p>}
                <Button className="w-full" type="submit" disabled={enviandoMensaje}>
                  {enviandoMensaje ? <CircleNotch className="animate-spin" /> : <PaperPlaneTilt />}
                  {enviandoMensaje ? 'Enviando...' : 'Enviar mensaje'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Ayuda ──────────────────────────────────────────────── */}
      {area === 'ayuda' && (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            'Cómo funciona mi proceso',
            'Documentos requeridos',
            'Preparación para entrevistas',
            'Cómo mejorar mi hoja de vida',
            'Canales de atención',
            'Preguntas frecuentes',
          ].map((x) => (
            <Card key={x} className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">{x}</CardTitle>
                <CardDescription>
                  Consulta información y recomendaciones de Academy CAC.
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* ── Configuración ──────────────────────────────────────── */}
      {area === 'configuracion' && (
        <Settings perfil={perfil} onUpdate={setPerfil} />
      )}
    </div>
  )
}

function CalendarioEstudiante({ actividades }: { actividades: ActividadResponse[] }) {
  const hoy = new Date()
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => hoy.toISOString().slice(0, 10))
  const anio = mes.getFullYear()
  const indiceMes = mes.getMonth()
  const primerDia = (new Date(anio, indiceMes, 1).getDay() + 6) % 7
  const diasMes = new Date(anio, indiceMes + 1, 0).getDate()
  const etiquetaMes = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(mes)
  const eventosDia = actividades.filter((actividad) => actividad.fecha === diaSeleccionado)
  const eventosProximos = actividades
    .filter((actividad) => actividad.fecha >= hoy.toISOString().slice(0, 10))
    .slice(0, 6)

  const cambiarMes = (delta: number) => {
    const siguiente = new Date(anio, indiceMes + delta, 1)
    setMes(siguiente)
    setDiaSeleccionado(siguiente.toISOString().slice(0, 10))
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div><CardTitle>Mi calendario</CardTitle><CardDescription>Eventos y actividades programados para tu proyecto.</CardDescription></div>
          <div className="flex items-center gap-1"><button type="button" onClick={() => cambiarMes(-1)} aria-label="Mes anterior" className="rounded-lg border border-border p-2 hover:bg-secondary"><CaretLeft className="size-4" /></button><button type="button" onClick={() => cambiarMes(1)} aria-label="Mes siguiente" className="rounded-lg border border-border p-2 hover:bg-secondary"><CaretRight className="size-4" /></button></div>
        </CardHeader>
        <CardContent>
          <h2 className="mb-4 text-center text-base font-semibold capitalize">{etiquetaMes}</h2>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {Array.from({ length: primerDia }).map((_, index) => <span key={`blank-${index}`} className="aspect-square" />)}
            {Array.from({ length: diasMes }, (_, index) => {
              const dia = index + 1
              const fecha = `${anio}-${String(indiceMes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
              const hayEventos = actividades.some((actividad) => actividad.fecha === fecha)
              const esSeleccionado = fecha === diaSeleccionado
              const esHoy = fecha === hoy.toISOString().slice(0, 10)
              return <button key={fecha} type="button" onClick={() => setDiaSeleccionado(fecha)} className={`relative aspect-square rounded-xl text-sm transition-colors ${esSeleccionado ? 'bg-primary font-semibold text-primary-foreground' : esHoy ? 'border border-primary text-primary' : 'hover:bg-secondary'}`}><span>{dia}</span>{hayEventos && <span className={`absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${esSeleccionado ? 'bg-primary-foreground' : 'bg-primary'}`} />}</button>
            })}
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-none"><CardHeader><CardTitle className="text-base">{new Date(`${diaSeleccionado}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</CardTitle><CardDescription>{eventosDia.length ? `${eventosDia.length} evento${eventosDia.length === 1 ? '' : 's'} programado${eventosDia.length === 1 ? '' : 's'}` : 'No hay eventos para esta fecha.'}</CardDescription></CardHeader><CardContent className="space-y-3">{eventosDia.length ? eventosDia.map((actividad) => <div key={actividad.id} className="rounded-xl border border-border p-3"><p className="font-semibold">{actividad.nombre}</p><p className="mt-1 text-xs text-muted-foreground">{actividad.hora ? `${actividad.hora} · ` : ''}{actividad.categoria}{actividad.responsable ? ` · ${actividad.responsable}` : ''}</p>{actividad.descripcion && <p className="mt-2 text-sm text-muted-foreground">{actividad.descripcion}</p>}</div>) : <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground"><CalendarBlank className="mx-auto mb-2 size-5" />Selecciona otro día para consultar los eventos.</div>}</CardContent></Card>
      <Card className="shadow-none xl:col-span-2"><CardHeader><CardTitle className="text-base">Próximos eventos</CardTitle></CardHeader><CardContent>{eventosProximos.length ? <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">{eventosProximos.map((actividad) => <button key={actividad.id} type="button" onClick={() => { const [year, month] = actividad.fecha.split('-').map(Number); setMes(new Date(year, month - 1, 1)); setDiaSeleccionado(actividad.fecha) }} className="rounded-xl border border-border p-3 text-left hover:border-primary/40 hover:bg-primary/[0.03]"><p className="font-semibold">{actividad.nombre}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(`${actividad.fecha}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}{actividad.hora ? ` · ${actividad.hora}` : ''}</p></button>)}</div> : <p className="text-sm text-muted-foreground">El equipo aún no ha programado eventos para tu proyecto.</p>}</CardContent></Card>
    </div>
  )
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
          {icon}
        </span>
        <p className="max-w-md text-sm">{text}</p>
      </CardContent>
    </Card>
  )
}

function Settings({
  perfil,
  onUpdate,
}: {
  perfil: EstudianteResponse | null
  onUpdate: (perfil: EstudianteResponse) => void
}) {
  const { theme, setTheme, locale, setLocale, t } = usePreferences()
  return (
    <div className="space-y-5">
      {perfil && <StudentPerfil perfil={perfil} onUpdate={onUpdate} />}
      <Card className="max-w-2xl shadow-none">
      <CardHeader>
        <CardTitle>{t('appearance')}</CardTitle>
        <CardDescription>{t('appearanceDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ['light', t('light'), <Sun key="sun" />],
            ['dark', t('dark'), <Moon key="moon" />],
            ['system', t('system'), <CircleNotch key="sys" />],
          ] as const
        ).map(([v, l, i]) => (
          <button
            key={v}
            onClick={() => setTheme(v)}
            className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-medium ${
              theme === v ? 'border-primary bg-primary/10 text-primary' : 'border-border'
            }`}
          >
            {i}
            {l}
          </button>
        ))}
      </CardContent>
      </Card>
      <Card className="max-w-2xl shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="size-5 text-primary" />{t('language')}</CardTitle>
          <CardDescription>{t('languageDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {([
            ['es', t('spanish')],
            ['en', t('english')],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setLocale(value)}
              className={`rounded-xl border p-4 text-left text-sm font-medium transition-colors ${
                locale === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {label}
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
