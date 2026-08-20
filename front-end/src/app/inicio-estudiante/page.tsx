'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Bell, Briefcase, Calendar as CalendarBlank, CircleAlert as WarningCircle, ExternalLink as ArrowSquareOut, FileText, Link as LinkSimple, LoaderCircle as CircleNotch, Sparkles as Sparkle, UserCheck } from 'lucide-react'
import { WhatsappLogo } from '@/components/ui/iconos-de-marca'
import Link from '@/compat/next-link'
import {
  documentosApi,
  copilotoApi,
  estudiantesApi,
  matchesApi,
  notificacionesApi,
  plataformasApi,
  seguimientosApi,
  whatsappApi,
} from '@/lib/api'
import type { EstudianteResponse, PlataformaResponse, RespuestaCopiloto, SeguimientoDelEstudianteResponse } from '@/lib/types'
import { useBranding } from '@/lib/branding'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProximasCitas } from '@/components/student/proximas-citas'
import { MiRuta } from '@/components/student/mi-ruta'
import { Badge } from '@/components/ui/badge'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'
import { MiSiguientePaso } from '@/components/student/mi-siguiente-paso'

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        revisaTuTitular: 'Check your headline, summary, experience and keywords before asking for validation.',
        completaTuCargo: 'Fill in your target role and professional summary to get sharper recommendations.',
        aquiTienesUn: 'Here is a summary of your process and the next steps that need your attention.',
        agregaElEnlace: 'Add the link to your profile so it joins your employability path.',
        accedeALas: 'Access the learning and assessment platforms enabled for you.',
        mantenTuHoja: 'Keep your résumé and certificates available for the support team.',
        accionesConcretasPara: 'Concrete steps to complete your employability process.',
        aunNoHay: 'No follow-up updates yet.',
        registraTuPerfil: 'Add your LinkedIn profile',
        optimizaTuPerfil: 'Improve your LinkedIn profile',
        subeUnDocumento: 'Upload a supporting document',
        escribenosPorWhatsapp: 'Message us on WhatsApp',
        escribirPorWhatsapp: 'Message on WhatsApp',
        notificacionesNuevas: 'New notifications',
        estadoDeMi: 'My process status',
        verProcesoCompleto: 'View the full process',
        alertasParaAvanzar: 'Alerts to move forward',
        portalDelEstudiante: 'Student portal',
        accesosRapidos: 'Quick links',
        verCalendario: 'View calendar',
        tusPlataformas: 'Your platforms',
        oportunidades: 'Opportunities',
        postulaciones: 'Applications',
        documentos: 'Documents',
        proximoPaso: 'Next step:',
        terminaTuHoja: 'Finish your résumé',
        esLoPrimero: 'It is what a company reads first, and it is worth 15% of your score.',
        hojaEnIngles: 'Résumé in English',
        esElDiferenciador: 'It sets this programme apart and is worth as much as the Spanish one.',
      }
    : {
        revisaTuTitular: 'Revisa tu titular, extracto, experiencia y palabras clave antes de solicitar validación.',
        completaTuCargo: 'Completa tu cargo objetivo y perfil profesional para recibir recomendaciones más precisas.',
        aquiTienesUn: 'Aquí tienes un resumen de tu proceso y los próximos pasos que requieren tu atención.',
        agregaElEnlace: 'Agrega el enlace de tu perfil para incorporarlo a tu ruta de empleabilidad.',
        accedeALas: 'Accede a las plataformas de aprendizaje y evaluación habilitadas para ti.',
        mantenTuHoja: 'Mantén tu hoja de vida y certificados disponibles para el acompañamiento.',
        accionesConcretasPara: 'Acciones concretas para completar tu proceso de empleabilidad.',
        aunNoHay: 'Aún no hay actualizaciones de seguimiento.',
        registraTuPerfil: 'Registra tu perfil de LinkedIn',
        optimizaTuPerfil: 'Optimiza tu perfil de LinkedIn',
        subeUnDocumento: 'Sube un documento de respaldo',
        escribenosPorWhatsapp: 'Escríbenos por WhatsApp',
        escribirPorWhatsapp: 'Escribir por WhatsApp',
        notificacionesNuevas: 'Notificaciones nuevas',
        estadoDeMi: 'Estado de mi proceso',
        verProcesoCompleto: 'Ver proceso completo',
        alertasParaAvanzar: 'Alertas para avanzar',
        portalDelEstudiante: 'Portal del estudiante',
        accesosRapidos: 'Accesos rápidos',
        verCalendario: 'Ver calendario',
        tusPlataformas: 'Tus plataformas',
        oportunidades: 'Oportunidades',
        postulaciones: 'Postulaciones',
        documentos: 'Documentos',
        proximoPaso: 'Próximo paso:',
        terminaTuHoja: 'Termina tu hoja de vida',
        esLoPrimero: 'Es lo primero que lee una empresa, y vale el 15% de tu puntaje.',
        hojaEnIngles: 'Hoja de vida en inglés',
        esElDiferenciador: 'Es el diferenciador del programa y vale lo mismo que la de español.',
      }
}

export default function InicioEstudiantePage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const { branding, refrescar } = useBranding()
  const [perfil, setPerfil] = useState<EstudianteResponse | null>(null)
  const [vacantes, setVacantes] = useState(0)
  const [postulaciones, setPostulaciones] = useState(0)
  const [documentos, setDocumentos] = useState(0)
  const [seguimientos, setSeguimientos] = useState<SeguimientoDelEstudianteResponse[]>([])
  const [plataformas, setPlataformas] = useState<PlataformaResponse[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [whatsapp, setWhatsapp] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiloto, setCopiloto] = useState<RespuestaCopiloto | null>(null)
  const [errorCopiloto, setErrorCopiloto] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const p = await estudiantesApi.obtenerMiPerfil()
        const [matches, proceso, misDocumentos, notificaciones, canal, misPlataformas, siguientePaso] = await Promise.allSettled([
          matchesApi.obtenerMisMatches(0, 100),
          seguimientosApi.mio(),
          documentosApi.mios({ size: 1 }),
          notificacionesApi.misNoLeidas(),
          whatsappApi.mio(),
          plataformasApi.mias(),
          copilotoApi.mio(),
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
        if (misPlataformas.status === 'fulfilled') setPlataformas(misPlataformas.value)
        if (siguientePaso.status === 'fulfilled') setCopiloto(siguientePaso.value)
        else setErrorCopiloto(true)
        if (
          canal.status === 'fulfilled' &&
          canal.value.configurado &&
          canal.value.activo &&
          canal.value.numeroWhatsapp
        ) {
          setWhatsapp(canal.value.numeroWhatsapp)
        }
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
      pendientes.push({ id: 'linkedin-enlace', titulo: T.registraTuPerfil, detalle: T.agregaElEnlace, href: '/configuracion-estudiante' })
    } else if (perfil.hitoLinkedinOptimizado !== 'SI') {
      pendientes.push({ id: 'linkedin-optimizar', titulo: T.optimizaTuPerfil, detalle: T.revisaTuTitular, href: perfil.linkedinUrl || '/configuracion-estudiante', externa: Boolean(perfil.linkedinUrl) })
    }
    if (perfil.hitoPerfilOcupacional !== 'SI') {
      pendientes.push({ id: 'perfil-ocupacional', titulo: 'Define tu perfil ocupacional', detalle: T.completaTuCargo, href: '/configuracion-estudiante' })
    }
    // Los dos hitos de la hoja de vida faltaban en esta lista, y son el 30% del
    // puntaje: el artefacto central de un programa de empleabilidad no aparecía
    // en «qué me toca ahora». Van después del perfil ocupacional porque la hoja
    // se escribe en función del cargo al que se apunta.
    if (perfil.hitoCvListo !== 'SI') {
      pendientes.push({ id: 'cv', titulo: T.terminaTuHoja, detalle: T.esLoPrimero, href: '/mi-hoja-de-vida' })
    } else if (perfil.hitoCvIngles !== 'SI') {
      pendientes.push({ id: 'cv-ingles', titulo: T.hojaEnIngles, detalle: T.esElDiferenciador, href: '/mi-hoja-de-vida' })
    }
    if (documentos === 0) {
      pendientes.push({ id: 'documentos', titulo: T.subeUnDocumento, detalle: T.mantenTuHoja, href: '/mis-documentos' })
    }
    return pendientes.slice(0, 3)
  }, [documentos, perfil])

  if (loading) {
    return <div className="flex min-h-96 items-center justify-center gap-2 text-sm text-muted-foreground"><CircleNotch className="size-5 animate-spin" />Preparando tu panel…</div>
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noreferrer"
          aria-label={T.escribirPorWhatsapp}
          title={T.escribenosPorWhatsapp}
          className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-110"
          style={{ backgroundColor: '#25D366' }}
        >
          <WhatsappLogo className="size-7" />
        </a>
      )}
      <section className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {bannerUrl && (
          <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        )}
        {bannerUrl && (
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
        )}
        {!bannerUrl && <div className="absolute inset-0 bg-primary/[0.035]" />}
        <div className="relative p-6 md:p-8">
          <div>
            <p className={`mb-2 text-xs font-semibold uppercase tracking-[.14em] ${bannerUrl ? 'text-emerald-200 drop-shadow-md' : 'text-emerald-800 dark:text-emerald-300'}`}>{branding?.subtituloHeader || T.portalDelEstudiante}</p>
            <h1 className={`text-2xl font-semibold tracking-tight md:text-3xl ${bannerUrl ? 'text-white [text-shadow:0_2px_8px_rgb(0_0_0/0.8)]' : 'text-foreground'}`}>Hola, {perfil?.nombre}</h1>
            <p className={`mt-2 max-w-xl text-sm leading-6 ${bannerUrl ? 'text-white/90 [text-shadow:0_1px_5px_rgb(0_0_0/0.8)]' : 'text-muted-foreground'}`}>{T.aquiTienesUn}</p>
          </div>
        </div>
      </section>

      {/* Por encima de las alertas: una entrevista tiene hora de caducidad y
          «completa tu perfil de LinkedIn» no. Si no hay citas no pinta nada. */}
      <ProximasCitas />

      <MiSiguientePaso respuesta={copiloto} cargando={false} error={errorCopiloto} english={locale === 'en'} />

      {/* Dónde estoy y qué sigue. Va antes que las alertas porque las
          alertas son un extracto de esto: tres pendientes sueltos sin el
          recorrido que les da sentido. */}
      {perfil && <MiRuta perfil={perfil} />}

      {alertas.length > 0 && <section className="rounded-xl border border-primary/25 bg-card p-5 shadow-none sm:p-6">
        <div className="flex items-start gap-3"><span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><WarningCircle className="size-5" /></span><div><h2 className="font-semibold text-foreground">{T.alertasParaAvanzar}</h2><p className="mt-1 text-sm text-muted-foreground">{T.accionesConcretasPara}</p></div></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">{alertas.map((alerta) => alerta.externa ? <a key={alerta.id} href={alerta.href} target="_blank" rel="noreferrer" className="group rounded-lg border border-border/80 bg-background p-4 transition hover:border-primary/45 hover:bg-muted/50"><p className="text-sm font-semibold text-foreground">{alerta.titulo}</p><p className="mt-1.5 min-h-10 text-xs leading-5 text-muted-foreground">{alerta.detalle}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Ir a LinkedIn <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span></a> : <Link key={alerta.id} href={alerta.href} className="group rounded-lg border border-border/80 bg-background p-4 transition hover:border-primary/45 hover:bg-muted/50"><p className="text-sm font-semibold text-foreground">{alerta.titulo}</p><p className="mt-1.5 min-h-10 text-xs leading-5 text-muted-foreground">{alerta.detalle}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Resolver ahora <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span></Link>)}</div>
      </section>}

      {plataformas.length > 0 && <section className="rounded-xl border border-border bg-card p-5 shadow-none sm:p-6">
        <div className="mb-5 flex items-start gap-3"><span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><LinkSimple className="size-5" /></span><div><h2 className="font-semibold text-foreground">{T.tusPlataformas}</h2><p className="mt-1 text-sm text-muted-foreground">{T.accedeALas}</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{plataformas.map((p) => <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-lg border border-border/80 bg-background p-4 transition hover:border-primary/45 hover:bg-muted/50"><span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">{p.iconoUrl ? <img src={p.iconoUrl} alt="" className="size-full p-1.5 object-contain" /> : <LinkSimple className="size-5 text-primary" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{p.nombre}</span><span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">{p.url.replace(/^https?:\/\//, '').split('/')[0]} <ArrowSquareOut className="size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span></span></a>)}</div>
      </section>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [T.oportunidades, vacantes, <Briefcase />, '/mis-postulaciones'],
          [T.postulaciones, postulaciones, <UserCheck />, '/mis-postulaciones'],
          [T.documentos, documentos, <FileText />, '/mis-documentos'],
          [T.notificacionesNuevas, noLeidas, <Bell />, '/mis-notificaciones'],
        ].map(([label, value, icon, href]) => (
          <Link href={String(href)} key={String(label)}><Card className="h-full shadow-none transition-colors hover:border-primary/50"><CardContent className="flex items-center gap-4 p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span><div><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card></Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="shadow-none"><CardHeader><CardTitle className="text-base">{T.estadoDeMi}</CardTitle></CardHeader><CardContent>{ultimo ? <div className="space-y-3"><div className="flex flex-wrap items-center gap-2"><Badge>{ultimo.estado}</Badge><strong>{ultimo.tipo}</strong><span className="text-xs text-muted-foreground">{ultimo.fecha}</span></div>{ultimo.observacion && <p className="text-sm text-muted-foreground">{ultimo.observacion}</p>}{ultimo.proximaAccion && <p className="rounded-lg bg-secondary/50 p-3 text-sm"><b>{T.proximoPaso}</b> {ultimo.proximaAccion}</p>}<Link href="/mi-proceso" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">{T.verProcesoCompleto} <ArrowRight /></Link></div> : <p className="text-sm text-muted-foreground">{T.aunNoHay}</p>}</CardContent></Card>
        <Card className="shadow-none"><CardHeader><CardTitle className="text-base">{T.accesosRapidos}</CardTitle></CardHeader><CardContent className="space-y-2">{[[<FileText key="profile" />, 'Completar mi perfil', '/configuracion-estudiante'], [<Sparkle key="process" />, 'Consultar mi proceso', '/mi-proceso'], [<CalendarBlank key="calendar" />, T.verCalendario, '/mi-calendario']].map(([icon, label, href]) => <Link key={String(href)} href={String(href)} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm font-medium hover:bg-secondary/50"><span className="flex items-center gap-2">{icon}{label}</span><ArrowRight /></Link>)}</CardContent></Card>
      </div>
    </div>
  )
}
