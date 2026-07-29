'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Bell,
  Briefcase,
  CalendarBlank,
  CircleNotch,
  FileText,
  Sparkle,
  UserCheck,
  WarningCircle,
} from '@phosphor-icons/react'
import Link from '@/compat/next-link'
import {
  documentosApi,
  estudiantesApi,
  matchesApi,
  notificacionesApi,
  seguimientosApi,
} from '@/lib/api'
import type { EstudianteResponse, SeguimientoResponse } from '@/lib/types'
import { useBranding } from '@/lib/branding'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function InicioEstudiantePage() {
  const { branding, refrescar } = useBranding()
  const [perfil, setPerfil] = useState<EstudianteResponse | null>(null)
  const [vacantes, setVacantes] = useState(0)
  const [postulaciones, setPostulaciones] = useState(0)
  const [documentos, setDocumentos] = useState(0)
  const [seguimientos, setSeguimientos] = useState<SeguimientoResponse[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const p = await estudiantesApi.obtenerMiPerfil()
        const [matches, proceso, misDocumentos, notificaciones] = await Promise.allSettled([
          matchesApi.obtenerMisMatches(0, 100),
          seguimientosApi.mio(),
          documentosApi.mios({ size: 1 }),
          notificacionesApi.contarNoLeidas(p.id),
        ])
        if (!active) return
        setPerfil(p)
        if (matches.status === 'fulfilled') {
          setVacantes(matches.value.totalElements)
          setPostulaciones(matches.value.content.filter((item) => item.postulado).length)
        }
        if (proceso.status === 'fulfilled') setSeguimientos(proceso.value)
        if (misDocumentos.status === 'fulfilled') setDocumentos(misDocumentos.value.totalElements)
        if (notificaciones.status === 'fulfilled') setNoLeidas(notificaciones.value)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  // La campana del encabezado consulta el total real de no leídas. Al abrir una
  // notificación, ambos indicadores se actualizan en el mismo instante.
  useEffect(() => {
    const actualizarContador = (event: Event) => {
      const count = (event as CustomEvent<number>).detail
      if (typeof count === 'number' && Number.isFinite(count)) setNoLeidas(Math.max(0, count))
    }
    window.addEventListener('nova:notifications-updated', actualizarContador)
    return () => window.removeEventListener('nova:notifications-updated', actualizarContador)
  }, [])

  // Al volver al inicio se consulta la identidad más reciente. Así una imagen
  // publicada por el administrador se refleja sin depender del estado que
  // quedó montado antes de que se guardara el proyecto.
  useEffect(() => { refrescar() }, [refrescar])

  const bannerUrl = branding?.bannerPanelUrl
  const ultimo = seguimientos[0]
  const alertas = useMemo(() => {
    if (!perfil) return []
    const pendientes: Array<{ id: string; titulo: string; detalle: string; href: string; externa?: boolean }> = []
    if (perfil.porcentajeCompletitud < 100) {
      pendientes.push({ id: 'perfil', titulo: 'Completa tu perfil', detalle: `Tu perfil está al ${perfil.porcentajeCompletitud}%. Completarlo mejora las oportunidades que recibe tu equipo.`, href: '/configuracion-estudiante' })
    }
    if (perfil.hitoLinkedinCreado !== 'SI') {
      pendientes.push({ id: 'linkedin-enlace', titulo: 'Registra tu perfil de LinkedIn', detalle: 'Agrega el enlace de tu perfil para incorporarlo a tu ruta de empleabilidad.', href: '/configuracion-estudiante' })
    } else if (perfil.hitoLinkedinOptimizado !== 'SI') {
      pendientes.push({ id: 'linkedin-optimizar', titulo: 'Optimiza tu perfil de LinkedIn', detalle: 'Revisa tu titular, extracto, experiencia y palabras clave antes de solicitar validación.', href: perfil.linkedinUrl || '/configuracion-estudiante', externa: Boolean(perfil.linkedinUrl) })
    }
    if (perfil.hitoPerfilOcupacional !== 'SI') {
      pendientes.push({ id: 'perfil-ocupacional', titulo: 'Define tu perfil ocupacional', detalle: 'Completa tu cargo objetivo y perfil profesional para recibir recomendaciones más precisas.', href: '/configuracion-estudiante' })
    }
    if (documentos === 0) {
      pendientes.push({ id: 'documentos', titulo: 'Sube un documento de respaldo', detalle: 'Mantén tu hoja de vida y certificados disponibles para el acompañamiento.', href: '/mis-documentos' })
    }
    return pendientes.slice(0, 3)
  }, [documentos, perfil])

  if (loading) {
    return <div className="flex min-h-96 items-center justify-center gap-2 text-sm text-muted-foreground"><CircleNotch className="size-5 animate-spin" />Preparando tu panel…</div>
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {bannerUrl && (
          <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        )}
        {!bannerUrl && <div className="absolute inset-0 bg-primary/[0.035]" />}
        <div className="relative p-6 md:p-8">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.14em] text-emerald-800">{branding?.subtituloHeader || 'Portal del estudiante'}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">Hola, {perfil?.nombre}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-700">Aquí tienes un resumen de tu proceso y los próximos pasos que requieren tu atención.</p>
          </div>
        </div>
      </section>

      {alertas.length > 0 && <section className="rounded-3xl border border-primary/25 bg-card p-5 shadow-none sm:p-6">
        <div className="flex items-start gap-3"><span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><WarningCircle className="size-5" weight="duotone" /></span><div><h2 className="font-semibold text-foreground">Alertas para avanzar</h2><p className="mt-1 text-sm text-muted-foreground">Acciones concretas para completar tu proceso de empleabilidad.</p></div></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">{alertas.map((alerta) => alerta.externa ? <a key={alerta.id} href={alerta.href} target="_blank" rel="noreferrer" className="group rounded-2xl border border-border/80 bg-background p-4 transition hover:border-primary/45 hover:bg-muted/50"><p className="text-sm font-semibold text-foreground">{alerta.titulo}</p><p className="mt-1.5 min-h-10 text-xs leading-5 text-muted-foreground">{alerta.detalle}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Ir a LinkedIn <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span></a> : <Link key={alerta.id} href={alerta.href} className="group rounded-2xl border border-border/80 bg-background p-4 transition hover:border-primary/45 hover:bg-muted/50"><p className="text-sm font-semibold text-foreground">{alerta.titulo}</p><p className="mt-1.5 min-h-10 text-xs leading-5 text-muted-foreground">{alerta.detalle}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Resolver ahora <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span></Link>)}</div>
      </section>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Oportunidades', vacantes, <Briefcase />, '/mis-postulaciones'],
          ['Postulaciones', postulaciones, <UserCheck />, '/mis-postulaciones'],
          ['Documentos', documentos, <FileText />, '/mis-documentos'],
          ['Notificaciones nuevas', noLeidas, <Bell />, '/portal-estudiante'],
        ].map(([label, value, icon, href]) => (
          <Link href={String(href)} key={String(label)}><Card className="h-full shadow-none transition-colors hover:border-primary/50"><CardContent className="flex items-center gap-4 p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span><div><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card></Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Estado de mi proceso</CardTitle></CardHeader><CardContent>{ultimo ? <div className="space-y-3"><div className="flex flex-wrap items-center gap-2"><Badge>{ultimo.estado}</Badge><strong>{ultimo.tipo}</strong><span className="text-xs text-muted-foreground">{ultimo.fecha}</span></div>{ultimo.observacion && <p className="text-sm text-muted-foreground">{ultimo.observacion}</p>}{ultimo.proximaAccion && <p className="rounded-lg bg-secondary/50 p-3 text-sm"><b>Próximo paso:</b> {ultimo.proximaAccion}</p>}<Link href="/mi-proceso" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Ver proceso completo <ArrowRight /></Link></div> : <p className="text-sm text-muted-foreground">Aún no hay actualizaciones de seguimiento.</p>}</CardContent></Card>
        <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Accesos rápidos</CardTitle></CardHeader><CardContent className="space-y-2">{[[<FileText key="profile" />, 'Completar mi perfil', '/configuracion-estudiante'], [<Sparkle key="process" />, 'Consultar mi proceso', '/mi-proceso'], [<CalendarBlank key="calendar" />, 'Ver calendario', '/mi-calendario']].map(([icon, label, href]) => <Link key={String(href)} href={String(href)} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm font-medium hover:bg-secondary/50"><span className="flex items-center gap-2">{icon}{label}</span><ArrowRight /></Link>)}</CardContent></Card>
      </div>
    </div>
  )
}
