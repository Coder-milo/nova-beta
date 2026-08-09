'use client'

/**
 * Comunicaciones — publicar un anuncio (feria de empleo, convocatoria) que le
 * llega a los estudiantes como notificación.
 *
 * El alta de cuentas de acceso vivía aquí y se movió a
 * Configuración > Usuarios & Seguridad, que es donde se gestiona quien entra
 * al panel; esto es solo para lo que se le comunica a los estudiantes.
 *
 * Consume:
 *   POST /api/v1/notificaciones/anuncio
 *   GET  /api/v1/programas
 *
 * Requiere ADMIN o COORDINADOR.
 */

import { useEffect, useState } from 'react'
import { CheckCircleIcon as CheckCircle, CalendarBlankIcon as CalendarBlank, CircleNotchIcon as CircleNotch, ImageSquareIcon as ImageSquare, LinkSimpleIcon as LinkSimple, MegaphoneIcon as Megaphone, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
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
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'
import { Textarea } from '@/components/ui/textarea'
import { errorDe } from '@/lib/errores'

// ── Anuncios ────────────────────────────────────────────────────────────────

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        destinatarios: 'Recipients',
        soloElPrograma: (n: string) => `Only the programme: ${n}`,
        avisarPorWhatsapp: 'Also send it by WhatsApp',
        requiereCanal: 'Needs an active channel on the project. The result says how many actually went out.',

        lesLlegaA: 'It reaches students in their notifications. Use it for job fairs, calls for applications or programme notices.',
        eventoProgramadoLos: 'Event scheduled. Students on the project will see it in their calendar.',
        losEventosDel: "Programme events are published automatically in the students' calendar.",
        lugarEnlaceDe: 'Venue, joining link or notes for the event.',
        adjuntaElPoster: 'Attach the poster or a video, or share the event link.',
        cuentalesDeQue: 'Tell them what it is about, where and at what time.',
        elArchivoTiene: 'The file takes priority over the link. Maximum 25 MB.',
        ejTallerDe: 'e.g. Interview preparation workshop',
        feriaDeEmpleo: 'BPO job fair — 12 August',
        todosLosEstudiantes: 'All active students',
        publicarUnAnuncio: 'Post an announcement',
        materialDelAnuncio: 'Announcement material',
        programarUnEvento: 'Schedule an event',
        tituloDelEvento: 'Event title',
        tipoDeEnlace: 'Link type',
        imagenOVideo: 'Image or video',
        titulo: 'Title',
      }
    : {
        destinatarios: 'Destinatarios',
        soloElPrograma: (n: string) => `Solo el programa: ${n}`,
        avisarPorWhatsapp: 'Avisar además por WhatsApp',
        requiereCanal: 'Requiere canal activo en el proyecto. El resultado dice cuántos salieron de verdad.',

        lesLlegaA: 'Les llega a los estudiantes en sus notificaciones. Úsalo para ferias de empleo, convocatorias o avisos del programa.',
        eventoProgramadoLos: 'Evento programado. Los estudiantes del proyecto lo verán en su calendario.',
        losEventosDel: 'Los eventos del programa se publican automáticamente en el calendario de sus estudiantes.',
        lugarEnlaceDe: 'Lugar, enlace de conexión o recomendaciones para el evento.',
        adjuntaElPoster: 'Adjunta el póster o un video, o comparte el enlace del evento.',
        cuentalesDeQue: 'Cuéntales de qué se trata, dónde y a qué hora.',
        elArchivoTiene: 'El archivo tiene prioridad sobre el enlace. Máximo 25 MB.',
        ejTallerDe: 'Ej. Taller de preparación para entrevistas',
        feriaDeEmpleo: 'Feria de empleo BPO — 12 de agosto',
        todosLosEstudiantes: 'Todos los estudiantes activos',
        publicarUnAnuncio: 'Publicar un anuncio',
        materialDelAnuncio: 'Material del anuncio',
        programarUnEvento: 'Programar un evento',
        tituloDelEvento: 'Título del evento',
        tipoDeEnlace: 'Tipo de enlace',
        imagenOVideo: 'Imagen o video',
        titulo: 'Título',
      }
}

function PanelAnuncio({ programas }: { programas: ProgramaResponse[] }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [titulo, setTitulo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [programaId, setProgramaId] = useState('')
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
      // `TipoMediaAnuncio` y no la union del selector: al subir un archivo el
      // backend puede devolver `FILE`, que el selector de enlaces externos no
      // ofrece porque un documento se adjunta, no se enlaza.
      let mediaTipo: TipoMediaAnuncio | undefined = mediaUrl ? tipoEnlace : undefined
      if (archivo) {
        const adjunto = await comunicacionesApi.subirAdjuntoAnuncio(archivo)
        mediaUrl = adjunto.url
        mediaTipo = adjunto.tipo
      }
      const r = await comunicacionesApi.publicarAnuncio({
        titulo: titulo.trim(),
        mensaje: mensaje.trim(),
        programaId: programaId || undefined,
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
      <CardHeader className="border-b border-border/70">
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-5 text-primary" weight="duotone" />
          {T.publicarUnAnuncio}
        </CardTitle>
        <CardDescription>{T.lesLlegaA}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="anuncio-titulo">
            {T.titulo}
          </label>
          <input
            id="anuncio-titulo"
            className="h-10 w-full rounded-xl border border-input bg-card/90 px-3.5 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
            placeholder={T.feriaDeEmpleo}
            maxLength={500}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>

        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2"><ImageSquare className="size-4 text-primary" /><div><p className="text-sm font-medium">{T.materialDelAnuncio} <span className="font-normal text-muted-foreground">(opcional)</span></p><p className="text-xs text-muted-foreground">{T.adjuntaElPoster}</p></div></div>
          <label className="block"><span className="mb-1.5 block text-xs font-medium">{T.imagenOVideo}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={(event) => { setArchivo(event.target.files?.[0] ?? null); setEnlace('') }} className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-xl file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary" />{archivo && <p className="mt-1 text-xs text-muted-foreground">Archivo seleccionado: {archivo.name}</p>}</label>
          {archivo && <FilePreview archivo={archivo} nombre={archivo.name} contentType={archivo.type} />}
          <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]"><select aria-label={T.tipoDeEnlace} value={tipoEnlace} disabled={!!archivo} onChange={(event) => setTipoEnlace(event.target.value as 'LINK' | 'IMAGE' | 'VIDEO')} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="LINK">Enlace externo</option><option value="IMAGE">Imagen externa</option><option value="VIDEO">Video externo</option></select><div className="relative"><LinkSimple className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><input value={enlace} disabled={!!archivo} onChange={(event) => setEnlace(event.target.value)} placeholder="https://…" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm disabled:cursor-not-allowed disabled:opacity-50" /></div></div>
          {archivo && <p className="text-[11px] text-muted-foreground">{T.elArchivoTiene}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="anuncio-mensaje">
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

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="anuncio-programa">
            {T.destinatarios}
          </label>
          <select
            id="anuncio-programa"
            className="h-10 w-full rounded-xl border border-input bg-card/90 px-3.5 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
            value={programaId}
            onChange={(e) => setProgramaId(e.target.value)}
          >
            <option value="">{T.todosLosEstudiantes}</option>
            {programas.map((p) => (
              <option key={p.id} value={p.id}>
                {T.soloElPrograma(p.nombre)}
              </option>
            ))}
          </select>
        </div>

        {/* El aviso por WhatsApp existía en el backend y ninguna pantalla lo
            pedía, así que un anuncio sólo llegaba a la campana. Va sin marcar:
            el panel es gratis, el mensaje al celular consume plantilla y llega
            a la gente fuera de la aplicación. */}
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={porWhatsapp}
            onChange={(e) => setPorWhatsapp(e.target.checked)}
          />
          <span className="text-sm">
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

        <Button onClick={publicar} disabled={!listo || enviando}>
          {enviando ? (
            <>
              <CircleNotch className="size-4 animate-spin" /> Publicando…
            </>
          ) : (
            'Publicar anuncio'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

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
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const programar = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    if (!form.nombre.trim() || !form.fecha) return
    setSaving(true); setError(null); setResult(null)
    try {
      await actividadesApi.crearAgenda({
        ...form,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion?.trim() || undefined,
        programaId: form.programaId || undefined,
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarBlank className="size-5 text-primary" weight="duotone" />{T.programarUnEvento}</CardTitle>
        <CardDescription>{T.losEventosDel}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={programar}>
          <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-medium">{T.tituloDelEvento}</span><input required value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} placeholder={T.ejTallerDe} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
          <label className="space-y-1.5"><span className="text-sm font-medium">Fecha</span><input required type="date" value={form.fecha} onChange={(event) => setForm((current) => ({ ...current, fecha: event.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
          <label className="space-y-1.5"><span className="text-sm font-medium">Hora</span><input type="time" value={form.hora ?? ''} onChange={(event) => setForm((current) => ({ ...current, hora: event.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
          <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-medium">Destinatarios</span><select value={form.programaId ?? ''} onChange={(event) => setForm((current) => ({ ...current, programaId: event.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="">{T.todosLosEstudiantes}</option>{programas.map((programa) => <option key={programa.id} value={programa.id}>{programa.nombre}</option>)}</select></label>
          <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-medium">Detalle (opcional)</span><Textarea minRows={3} value={form.descripcion ?? ''} onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))} placeholder={T.lugarEnlaceDe} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
          <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2"><div>{error && <p className="text-sm text-destructive">{error}</p>}{result && <p className="text-sm text-emerald-700 dark:text-emerald-400">{result}</p>}</div><Button type="submit" disabled={saving}>{saving ? <><CircleNotch className="size-4 animate-spin" />Guardando…</> : <><CalendarBlank className="size-4" />Programar evento</>}</Button></div>
        </form>
      </CardContent>
    </Card>
  )
}

export default function ComunicacionesPage() {
  const [programas, setProgramas] = useState<ProgramaResponse[]>([])

  useEffect(() => {
    programasApi.listar().then(setProgramas).catch(() => setProgramas([]))
  }, [])

  return (
    <div className="space-y-5">
      <PanelAnuncio programas={programas} />
      <PanelEvento programas={programas} />
      <PanelPlantillasCorreo />
    </div>
  )
}
