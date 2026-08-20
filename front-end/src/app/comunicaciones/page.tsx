'use client'

/**
 * Comunicaciones — Hub unificado de difusión institucional para NOVA-CRM:
 * 1. Anuncios y Avisos (notificaciones en tiempo real al portal y WhatsApp).
 * 2. Cronograma y Agenda de Eventos (talleres, ferias, citaciones).
 * 3. Centro de Correos y Plantillas (editor visual, variables dinámicas y envíos masivos/segmentados).
 *
 * Requiere ADMIN o COORDINADOR.
 */

import { useEffect, useState } from 'react'
import {
  Calendar as CalendarBlank,
  CheckCircle2 as CheckCircle,
  CircleAlert as WarningCircle,
  Image as ImageSquare,
  Link as LinkSimple,
  LoaderCircle as CircleNotch,
  Mail as EnvelopeSimple,
  Megaphone,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FilePreview } from '@/components/ui/file-preview'
import { EditorTexto } from '@/components/ui/editor-texto'
import { actividadesApi, comunicacionesApi, programasApi } from '@/lib/api'
import { hoyLocal } from '@/lib/utils'
import type { TipoMediaAnuncio } from '@/lib/api'
import type { ActividadRequest, ProgramaResponse } from '@/lib/types'
import { PanelPlantillasCorreo } from '@/components/admin/panel-plantillas-correo'
import { SelectorAudiencia, type AudienciaSeleccionada } from '@/components/admin/selector-audiencia'
import { usePreferences } from '@/lib/preferences'
import { Textarea } from '@/components/ui/textarea'
import { errorDe } from '@/lib/errores'
import { cn } from '@/lib/utils'

type TabComunicaciones = 'anuncios' | 'cronograma' | 'correos'

/** Textos propios de esta pantalla. */
function textos(english: boolean) {
  return english
    ? {
        pestanaAnuncios: 'Announcements & Broadcasts',
        pestanaCronograma: 'Event Schedule',
        pestanaCorreos: 'Emails & Templates',
        destinatarios: 'Target Recipients',
        soloElPrograma: (n: string) => `Only project: ${n}`,
        avisarPorWhatsapp: 'Send via WhatsApp notification',
        requiereCanal: 'Requires an active WhatsApp channel configured for the project. A delivery report will be generated.',
        lesLlegaA: 'Broadcasts notifications directly to student portal dashboards for job fairs, webinars or institutional notices.',
        eventoProgramadoLos: 'Event successfully scheduled. Participants in the selected audience will see it in their calendar.',
        losEventosDel: 'Programme events are published automatically in participants’ calendars and portals.',
        lugarEnlaceDe: 'Location, connection link, or recommendations for the event.',
        adjuntaElPoster: 'Attach flyer, promotional material, or event link.',
        cuentalesDeQue: 'Describe event agenda, date, venue, and schedule.',
        elArchivoTiene: 'Attached file takes precedence over external link. Maximum size: 25 MB.',
        ejTallerDe: 'e.g. Bilingual Interview Workshop',
        feriaDeEmpleo: 'BPO Job Fair — August 12',
        publicarUnAnuncio: 'Publish Announcement',
        materialDelAnuncio: 'Announcement Attachments',
        programarUnEvento: 'Schedule Calendar Event',
        tituloDelEvento: 'Event Title',
        tipoDeEnlace: 'Link Type',
        imagenOVideo: 'Image or Video',
        titulo: 'Title',
      }
    : {
        pestanaAnuncios: 'Anuncios y Avisos',
        pestanaCronograma: 'Cronograma de Eventos',
        pestanaCorreos: 'Correos y Plantillas',
        destinatarios: 'Destinatarios y Alcance',
        soloElPrograma: (n: string) => `Solo el proyecto: ${n}`,
        avisarPorWhatsapp: 'Notificar adicionalmente por WhatsApp',
        requiereCanal: 'Requiere un canal de WhatsApp activo en el proyecto. Se generará un reporte de entrega.',
        lesLlegaA: 'Envía notificaciones al portal de los estudiantes para convocatorias, ferias laborales o avisos institucionales.',
        eventoProgramadoLos: 'Evento programado exitosamente. La audiencia seleccionada lo verá reflejado en su calendario.',
        losEventosDel: 'Los eventos y talleres se publican automáticamente en el calendario de los estudiantes según su proyecto o grupo.',
        lugarEnlaceDe: 'Lugar, enlace de conexión o recomendaciones para el evento.',
        adjuntaElPoster: 'Adjunta el póster o material informativo, o comparte el enlace del evento.',
        cuentalesDeQue: 'Describe los detalles del evento, agenda, lugar y horario.',
        elArchivoTiene: 'El archivo adjunto tiene prioridad sobre el enlace. Tamaño máximo: 25 MB.',
        ejTallerDe: 'Ej. Taller de preparación para entrevistas bilingües',
        feriaDeEmpleo: 'Feria de empleo BPO — 12 de agosto',
        publicarUnAnuncio: 'Publicar Anuncio',
        materialDelAnuncio: 'Material del Anuncio',
        programarUnEvento: 'Programar Evento',
        tituloDelEvento: 'Título del Evento',
        tipoDeEnlace: 'Tipo de Enlace',
        imagenOVideo: 'Imagen o Video',
        titulo: 'Título',
      }
}

// ── Panel de Anuncios y Avisos ──────────────────────────────────────────────

function PanelAnuncio({ programas }: { programas: ProgramaResponse[] }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const [titulo, setTitulo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [audiencia, setAudiencia] = useState<AudienciaSeleccionada>({
    tipo: 'TODOS',
    estudianteIds: [],
    estudiantes: [],
  })
  const [porWhatsapp, setPorWhatsapp] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [enlace, setEnlace] = useState('')
  const [tipoEnlace, setTipoEnlace] = useState<'LINK' | 'IMAGE' | 'VIDEO'>('LINK')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const publicar = async () => {
    setEnviando(true)
    setError(null)
    setResultado(null)
    try {
      let mediaUrl = enlace.trim() || undefined
      let mediaTipo: TipoMediaAnuncio | undefined = mediaUrl ? tipoEnlace : undefined
      if (archivo) {
        const adjunto = await comunicacionesApi.subirAdjuntoAnuncio(archivo)
        mediaUrl = adjunto.url
        mediaTipo = adjunto.tipo
      }
      const r = await comunicacionesApi.publicarAnuncio({
        titulo: titulo.trim(),
        mensaje: mensaje.trim(),
        programaId: audiencia.programaId,
        mediaUrl,
        mediaTipo,
        porWhatsapp,
      })
      setResultado(r.mensaje)
      setTitulo('')
      setMensaje('')
      setArchivo(null)
      setEnlace('')
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setEnviando(false)
    }
  }

  const listo = titulo.trim().length > 0 && mensaje.trim().length > 0

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="border-b border-border/70 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Megaphone className="size-5 text-primary" />
          {T.publicarUnAnuncio}
        </CardTitle>
        <CardDescription>{T.lesLlegaA}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="anuncio-titulo">
            {T.titulo}
          </label>
          <input
            id="anuncio-titulo"
            className="h-10 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder={T.feriaDeEmpleo}
            maxLength={500}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>

        {/* Selector de audiencia segmentada */}
        <SelectorAudiencia
          programas={programas}
          onChange={setAudiencia}
          mostrarCohortes={false}
        />

        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ImageSquare className="size-4 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {T.materialDelAnuncio} <span className="font-normal text-muted-foreground">(opcional)</span>
              </p>
              <p className="text-xs text-muted-foreground">{T.adjuntaElPoster}</p>
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">{T.imagenOVideo}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              onChange={(event) => {
                setArchivo(event.target.files?.[0] ?? null)
                setEnlace('')
              }}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-xl file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary cursor-pointer"
            />
            {archivo && <p className="mt-1 text-xs text-muted-foreground">Archivo seleccionado: {archivo.name}</p>}
          </label>
          {archivo && <FilePreview archivo={archivo} nombre={archivo.name} contentType={archivo.type} />}
          <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
            <select
              aria-label={T.tipoDeEnlace}
              value={tipoEnlace}
              disabled={!!archivo}
              onChange={(event) => setTipoEnlace(event.target.value as 'LINK' | 'IMAGE' | 'VIDEO')}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="LINK">Enlace externo</option>
              <option value="IMAGE">Imagen externa</option>
              <option value="VIDEO">Video externo</option>
            </select>
            <div className="relative">
              <LinkSimple className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                value={enlace}
                disabled={!!archivo}
                onChange={(event) => setEnlace(event.target.value)}
                placeholder="https://…"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          {archivo && <p className="text-[11px] text-muted-foreground">{T.elArchivoTiene}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="anuncio-mensaje">
            Mensaje
          </label>
          <EditorTexto
            id="anuncio-mensaje"
            value={mensaje}
            onChange={setMensaje}
            placeholder={T.cuentalesDeQue}
            onSubirArchivo={async (f) => {
              const adjunto = await comunicacionesApi.subirAdjuntoAnuncio(f)
              return { url: adjunto.url, nombre: f.name, tipo: adjunto.tipo }
            }}
          />
        </div>

        {/* Aviso por WhatsApp */}
        <label className="flex items-start gap-2 pt-1 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-border"
            checked={porWhatsapp}
            onChange={(e) => setPorWhatsapp(e.target.checked)}
          />
          <span className="text-sm text-foreground">
            {T.avisarPorWhatsapp}
            <span className="block text-xs text-muted-foreground">{T.requiereCanal}</span>
          </span>
        </label>

        {error && (
          <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <WarningCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
        {resultado && (
          <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="mt-0.5 size-4 shrink-0" />
            {resultado}
          </p>
        )}

        <div className="pt-2">
          <Button onClick={publicar} disabled={!listo || enviando} className="cursor-pointer">
            {enviando ? (
              <>
                <CircleNotch className="size-4 animate-spin mr-1.5" /> Publicando…
              </>
            ) : (
              'Publicar Anuncio'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Panel de Cronograma y Eventos ───────────────────────────────────────────

function PanelEvento({ programas }: { programas: ProgramaResponse[] }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const [form, setForm] = useState<ActividadRequest>({
    nombre: '',
    fecha: hoyLocal(),
    hora: '09:00',
    descripcion: '',
    categoria: 'GENERAL',
    programaId: '',
  })
  const [audiencia, setAudiencia] = useState<AudienciaSeleccionada>({
    tipo: 'TODOS',
    estudianteIds: [],
    estudiantes: [],
  })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const programar = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    if (!form.nombre.trim() || !form.fecha) return
    setSaving(true)
    setError(null)
    setResult(null)
    try {
      await actividadesApi.crearAgenda({
        ...form,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion?.trim() || undefined,
        programaId: audiencia.programaId || undefined,
      })
      setResult(T.eventoProgramadoLos)
      setForm((current) => ({ ...current, nombre: '', descripcion: '' }))
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="border-b border-border/70 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CalendarBlank className="size-5 text-primary" />
          {T.programarUnEvento}
        </CardTitle>
        <CardDescription>{T.losEventosDel}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={programar}>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-foreground">{T.tituloDelEvento}</span>
            <input
              required
              value={form.nombre}
              onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
              placeholder={T.ejTallerDe}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Fecha</span>
            <input
              required
              type="date"
              value={form.fecha}
              onChange={(event) => setForm((current) => ({ ...current, fecha: event.target.value }))}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Hora</span>
            <input
              type="time"
              value={form.hora ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, hora: event.target.value }))}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <div className="md:col-span-2">
            <SelectorAudiencia
              programas={programas}
              onChange={setAudiencia}
              mostrarCohortes={true}
            />
          </div>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Detalle o Enlace (opcional)</span>
            <Textarea
              minRows={3}
              value={form.descripcion ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))}
              placeholder={T.lugarEnlaceDe}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2 text-sm text-foreground"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2 pt-2">
            <div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {result && <p className="text-sm text-emerald-700 dark:text-emerald-400">{result}</p>}
            </div>
            <Button type="submit" disabled={saving} className="cursor-pointer">
              {saving ? (
                <>
                  <CircleNotch className="size-4 animate-spin mr-1.5" /> Guardando…
                </>
              ) : (
                <>
                  <CalendarBlank className="size-4 mr-1.5" /> Programar Evento
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Página Principal con Pestañas Ejecutivas ────────────────────────────────

export default function ComunicacionesPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const [tabActiva, setTabActiva] = useState<TabComunicaciones>('anuncios')
  const [programas, setProgramas] = useState<ProgramaResponse[]>([])

  useEffect(() => {
    programasApi.listar().then(setProgramas).catch(() => setProgramas([]))
  }, [])

  return (
    <div className="space-y-5">
      {/* Navegación por pestañas ejecutivas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center rounded-xl border border-border bg-muted/40 p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setTabActiva('anuncios')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer',
              tabActiva === 'anuncios'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Megaphone className="size-4 text-primary" />
            <span>{T.pestanaAnuncios}</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('cronograma')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer',
              tabActiva === 'cronograma'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <CalendarBlank className="size-4 text-primary" />
            <span>{T.pestanaCronograma}</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('correos')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer',
              tabActiva === 'correos'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <EnvelopeSimple className="size-4 text-primary" />
            <span>{T.pestanaCorreos}</span>
          </button>
        </div>
      </div>

      {/* Contenido de la pestaña activa */}
      {tabActiva === 'anuncios' && <PanelAnuncio programas={programas} />}
      {tabActiva === 'cronograma' && <PanelEvento programas={programas} />}
      {tabActiva === 'correos' && <PanelPlantillasCorreo />}
    </div>
  )
}
