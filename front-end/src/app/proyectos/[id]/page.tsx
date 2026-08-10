'use client'

import { ArrowLeftIcon as ArrowLeft, ArrowsClockwiseIcon as ArrowsClockwise, CaretLeftIcon as CaretLeft, CaretRightIcon as CaretRight, CheckCircleIcon as CheckCircle, CircleNotchIcon as CircleNotch, ClipboardTextIcon as ClipboardText, ClockCounterClockwiseIcon as ClockCounterClockwise, DownloadSimpleIcon as DownloadSimple, FileTextIcon as FileText, FlagIcon as Flag, KanbanIcon as Kanban, PaletteIcon as Palette, PencilSimpleIcon as PencilSimple, PlusIcon as Plus, ReadCvLogoIcon as ReadCvLogo, RowsIcon as Rows, SquaresFourIcon as SquaresFour, TrashIcon as Trash, UploadSimpleIcon as UploadSimple, UsersIcon as Users, WarningCircleIcon as WarningCircle, XIcon as X } from '@phosphor-icons/react'
import { PanelBranding } from '@/components/admin/panel-branding'
import { PanelWhatsapp } from '@/components/admin/panel-whatsapp'
/**
 * Detalle de proyecto / programa — expediente completo con pestañas.
 *
 * Consume:
 *   GET    /api/v1/programas/{id}                → cabecera
 *   PUT    /api/v1/programas/{id}                → editar
 *   PATCH  /api/v1/programas/{id}/estado         → finalizar
 *   DELETE /api/v1/programas/{id}                → eliminar
 *   GET    /api/v1/programas/{id}/resumen        → pestaña Resumen
 *   GET    /api/v1/estudiantes?programaId=       → pestaña Estudiantes
 *   GET    /api/v1/documentos?programaId=        → pestaña Documentos
 *   POST   /api/v1/hojas-de-vida/generar-masiva  → pestaña Hojas de vida
 *   GET    /api/v1/programas/{id}/actividades    → pestaña Actividades
 *   GET    /api/v1/auditoria?registroId=         → pestaña Historial
 */

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { useParams, useRouter } from '@/compat/next-navigation'
import Link from '@/compat/next-link'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EstadoDot } from '@/components/ui/estado-dot'
import {
  programasApi, estudiantesApi, documentosApi, hvApi, actividadesApi,
  auditoriaApi, plataformasApi, ApiCallError, mensajeDeError,
} from '@/lib/api'
import { useAvisos } from '@/components/ui/avisos'
import { useConfirmar } from '@/components/ui/confirmar'
import type {
  ProgramaResponse, ProgramaRequest, ProgramaEstado, ProgramaResumenResponse,
  EstudianteResponse, DocumentoResponse, GeneracionMasivaResponse,
  ActividadResponse, AuditoriaResponse, Page, PlataformaResponse,
} from '@/lib/types'
import { Textarea } from '@/components/ui/textarea'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin, type TextosAdmin } from '@/lib/textos-admin'

// ─── Etiquetas de estado ──────────────────────────────────────────────────────

const estadoFallback = { dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' }

/** El color no depende del idioma; la etiqueta si, y se resuelve aparte. */
const estiloPrograma: Record<ProgramaEstado, { dot: string; text: string }> = {
  PLANEACION:   { dot: 'bg-navy-200', text: 'text-navy-400' },
  BORRADOR:     { dot: 'bg-navy-300', text: 'text-navy-500' },
  ACTIVO:       { dot: 'bg-success',  text: 'text-[#0F6E56]' },
  EN_EJECUCION: { dot: 'bg-success',  text: 'text-[#0F6E56]' },
  PAUSADO:      { dot: 'bg-warning',  text: 'text-amber-700' },
  FINALIZADO:   { dot: 'bg-navy-800', text: 'text-navy-800' },
  CANCELADO:    { dot: 'bg-red-600',  text: 'text-red-700' },
  ARCHIVADO:    { dot: 'bg-red-600',  text: 'text-red-700' },
}

const estiloAcademico: Record<string, { dot: string; text: string }> = {
  ACTIVO:     { dot: 'bg-navy-500', text: 'text-navy-600' },
  GRADUADO:   { dot: 'bg-navy-800', text: 'text-navy-800' },
  RETIRADO:   { dot: 'bg-red-600',  text: 'text-red-700' },
  EN_PROCESO: { dot: 'bg-navy-300', text: 'text-navy-500' },
}

function estadoAcademico(C: TextosAdmin, codigo: string) {
  const etiquetas: Record<string, string> = {
    ACTIVO: C.activo, GRADUADO: C.graduado, RETIRADO: C.retirado, EN_PROCESO: C.enProceso,
  }
  return { label: etiquetas[codigo] ?? codigo, ...(estiloAcademico[codigo] ?? estadoFallback) }
}

function estadoPrograma(T: ReturnType<typeof textos>, C: TextosAdmin, codigo: ProgramaEstado) {
  const etiquetas: Record<ProgramaEstado, string> = {
    PLANEACION: T.planeacion, BORRADOR: T.borrador, ACTIVO: C.activo,
    EN_EJECUCION: T.enEjecucion, PAUSADO: T.pausado, FINALIZADO: T.finalizado,
    CANCELADO: T.cancelado, ARCHIVADO: T.archivado,
  }
  return { label: etiquetas[codigo] ?? codigo, ...(estiloPrograma[codigo] ?? estadoFallback) }
}

// Campos extendidos del programa que aún no están en el DTO base.
type ProgramaExtra = {
  cliente?: string | null
  responsable?: string | null
  observaciones?: string | null
  porcentajeAvance?: number | null
}
type ProgramaCompleto = ProgramaResponse & ProgramaExtra
type ProgramaForm = ProgramaRequest & {
  cliente?: string
  responsable?: string
  observaciones?: string
  porcentajeAvance?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** `en-GB` y no `en-US`: el dia primero, como en el resto del sistema. */
function formatoFecha(fecha: string, english = false): string {
  try {
    return new Date(fecha).toLocaleString(english ? 'en-GB' : 'es-CO', { dateStyle: 'medium', timeStyle: 'short' })
  } catch { return fecha }
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
        borrador: 'Draft',
        pausado: 'Paused',
        finalizado: 'Finished',
        cancelado: 'Cancelled',
        archivado: 'Archived',

        completada: 'Completed',
        resumen: 'Summary',
        hojasDeVidaTab: 'Résumés',
        actividades: 'Activities',
        plataformas: 'Platforms',
        historial: 'History',

        lasPlataformasQue: "The platforms students on this project can have. They are then assigned one by one from each student's record.",
        aunNoHay: 'No platforms created yet. Add them from Settings → Platforms.',
        generaLaHoja: 'Generates the résumé of every student linked to this project.',
        noHayRegistros: 'There are no audit records for this project.',
        noHayActividades: 'No activities recorded for this project.',
        noSePudieron: "The project's students could not be loaded.",
        noSePudieronX: "The project's documents could not be loaded.",
        noSePudieronXX: "The project's activities could not be loaded.",
        noHayDocumentos: 'There are no documents attached to this project.',
        esteProyectoAun: 'This project has no students linked yet.',
        elNombreEs: 'The name is required. The other fields are optional.',
        generarHojasDe: "Generate the project's résumés",
        soloEstudiantesCon: 'Only students with complete information',
        elEstadoDel: 'The project status will change to “Finished”.',
        sinClienteNi: 'No client or person in charge assigned.',
        noSePudo: 'The project summary could not be loaded.',
        noSePudoX: 'The project history could not be loaded.',
        plataformasDelProyecto: "The project's platforms were updated.",
        noSePudieronXXX: 'The platforms could not be loaded.',
        elProyectoNo: 'The project does not exist, or was deleted.',
        noSePudoXX: 'The project could not be loaded.',
        noSePudoXXX: 'The activity could not be deleted.',
        noSePudoXXXX: 'The document could not be deleted.',
        noSePudoXXXXX: 'The document could not be downloaded.',
        errorDeConexion: 'Connection error while uploading the document.',
        noHuboEstudiantes: 'There were no students to process.',
        resultadoDeLa: 'Result of the generation',
        plataformasParaEste: 'Platforms for this project',
        hojasDeVida: 'Résumés generated',
        informacionIncompleta: 'Incomplete information',
        informacionAnterior: 'Previous data',
        informacionNueva: 'New data',
        generacionMasiva: 'Bulk generation',
        nombreDelResponsable: 'Person in charge',
        tallerDeEntrevistas: 'Interview workshop',
        laFechaEs: 'The date is required.',
        aparienciaYMarca: 'Appearance and branding',
        eliminarActividad: 'Delete activity',
        eliminarDocumento: 'Delete document',
        editarProyecto: 'Edit project',
        eliminarProyecto: 'Delete project',
        errorDeConexionX: 'Connection error.',
        sinPermisos: 'No permission.',
        deAvance: '% complete',
        enEjecucion: 'Running',
        planeacion: 'Planning',
        subidoPor: 'Uploaded by',
        sinTipo: 'No type',
        pendiente: 'Pending',
        verPerfil: 'View profile',
        version: 'Version',
        tamano: 'Size',
        activos: 'Active',
        descripcion: 'Description',
      }
    : {
        borrador: 'Borrador',
        pausado: 'Pausado',
        finalizado: 'Finalizado',
        cancelado: 'Cancelado',
        archivado: 'Archivado',

        completada: 'Completada',
        resumen: 'Resumen',
        hojasDeVidaTab: 'Hojas de vida',
        actividades: 'Actividades',
        plataformas: 'Plataformas',
        historial: 'Historial',

        lasPlataformasQue: 'Las plataformas que los estudiantes de este proyecto pueden tener. Después se asignan individualmente desde la ficha de cada estudiante.',
        aunNoHay: 'Aún no hay plataformas creadas. Agréguelas desde Configuración → Plataformas.',
        generaLaHoja: 'Genera la hoja de vida de todos los estudiantes vinculados a este proyecto.',
        noHayRegistros: 'No hay registros de auditoría para este proyecto.',
        noHayActividades: 'No hay actividades registradas para este proyecto.',
        noSePudieron: 'No se pudieron cargar los estudiantes del proyecto.',
        noSePudieronX: 'No se pudieron cargar los documentos del proyecto.',
        noSePudieronXX: 'No se pudieron cargar las actividades del proyecto.',
        noHayDocumentos: 'No hay documentos asociados a este proyecto.',
        esteProyectoAun: 'Este proyecto aún no tiene estudiantes vinculados.',
        elNombreEs: 'El nombre es obligatorio. Los demás campos son opcionales.',
        generarHojasDe: 'Generar hojas de vida del proyecto',
        soloEstudiantesCon: 'Solo estudiantes con información completa',
        elEstadoDel: 'El estado del proyecto cambiará a "Finalizado".',
        sinClienteNi: 'Sin cliente ni responsable asignados.',
        noSePudo: 'No se pudo cargar el resumen del proyecto.',
        noSePudoX: 'No se pudo cargar el historial del proyecto.',
        plataformasDelProyecto: 'Plataformas del proyecto actualizadas.',
        noSePudieronXXX: 'No se pudieron cargar las plataformas.',
        elProyectoNo: 'El proyecto no existe o fue eliminado.',
        noSePudoXX: 'No se pudo cargar el proyecto.',
        noSePudoXXX: 'No se pudo eliminar la actividad.',
        noSePudoXXXX: 'No se pudo eliminar el documento.',
        noSePudoXXXXX: 'No se pudo descargar el documento.',
        errorDeConexion: 'Error de conexión al subir el documento.',
        noHuboEstudiantes: 'No hubo estudiantes para procesar.',
        resultadoDeLa: 'Resultado de la generación',
        plataformasParaEste: 'Plataformas para este proyecto',
        hojasDeVida: 'Hojas de vida generadas',
        informacionIncompleta: 'Información incompleta',
        informacionAnterior: 'Información anterior',
        informacionNueva: 'Información nueva',
        generacionMasiva: 'Generación masiva',
        nombreDelResponsable: 'Nombre del responsable',
        tallerDeEntrevistas: 'Taller de entrevistas',
        laFechaEs: 'La fecha es obligatoria.',
        aparienciaYMarca: 'Apariencia y Marca',
        eliminarActividad: 'Eliminar actividad',
        eliminarDocumento: 'Eliminar documento',
        editarProyecto: 'Editar proyecto',
        eliminarProyecto: 'Eliminar proyecto',
        errorDeConexionX: 'Error de conexión.',
        sinPermisos: 'Sin permisos.',
        deAvance: '% de avance',
        enEjecucion: 'En ejecución',
        planeacion: 'Planeación',
        subidoPor: 'Subido por',
        sinTipo: 'Sin tipo',
        pendiente: 'Pendiente',
        verPerfil: 'Ver perfil',
        version: 'Versión',
        tamano: 'Tamaño',
        activos: 'Activos',
        descripcion: 'Descripción',
      }
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  return <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">{children}</span>
}

function EstadoCarga({ mensaje }: { mensaje: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  return (
    <div className="flex items-center justify-center py-16">
      <PageSpinner />
      <span className="ml-2 text-sm text-muted-foreground">{mensaje}</span>
    </div>
  )
}

function EstadoError({ mensaje, onRetry }: { mensaje: string; onRetry: () => void }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <WarningCircle className="size-8 text-destructive" />
      <p className="text-sm text-destructive">{mensaje}</p>
      <Button variant="outline" onClick={onRetry}><ArrowsClockwise className="size-4" /> Reintentar</Button>
    </div>
  )
}

// ─── Pestaña: Resumen ─────────────────────────────────────────────────────────

function TabResumen({ programaId }: { programaId: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [resumen, setResumen] = useState<ProgramaResumenResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setResumen(await programasApi.resumen(programaId)) }
    catch { setError(T.noSePudo) }
    finally { setLoading(false) }
  }, [programaId])

  useEffect(() => { load() }, [load])

  if (loading) return <EstadoCarga mensaje="Cargando resumen…" />
  if (error) return <EstadoError mensaje={error} onRetry={load} />
  if (!resumen) return null

  const items: { label: string; value: number }[] = [
    { label: 'Total estudiantes',        value: resumen.totalEstudiantes },
    { label: T.activos,                  value: resumen.activos },
    { label: 'Graduados',                value: resumen.graduados },
    { label: 'Retirados',                value: resumen.retirados },
    { label: 'En proceso',               value: resumen.enProceso },
    { label: T.informacionIncompleta,   value: resumen.conInformacionIncompleta },
    { label: T.hojasDeVidaTab,  value: resumen.hojasDeVidaGeneradas },
    { label: 'Documentos',               value: resumen.documentos },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="rounded-lg border-border shadow-none">
          <CardContent className="flex flex-col gap-1 py-4">
            <Etiqueta>{it.label}</Etiqueta>
            <span className="text-2xl font-semibold tabular-nums text-foreground">{it.value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Pestaña: Estudiantes ─────────────────────────────────────────────────────

function TabEstudiantes({ programaId }: { programaId: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [page, setPage]           = useState<Page<EstudianteResponse> | null>(null)
  const [currentPage, setCurrent] = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true); setError(null)
    try { setPage(await estudiantesApi.listar(programaId, p, 20)) }
    catch { setError(T.noSePudieron) }
    finally { setLoading(false) }
  }, [programaId])

  useEffect(() => { load(currentPage) }, [load, currentPage])

  if (loading) return <EstadoCarga mensaje="Cargando estudiantes…" />
  if (error) return <EstadoError mensaje={error} onRetry={() => load(currentPage)} />
  if (!page) return null

  if (page.content.length === 0) {
    return (
      <Card className="rounded-lg border-border shadow-none">
        <CardContent className="flex flex-col items-center gap-3 py-16">
          <Users className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{T.esteProyectoAun}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-lg border-border shadow-none overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estudiante</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Documento</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {page.content.map((est) => {
              const ai = estadoAcademico(C, est.estadoAcademico)
              const iniciales = `${est.nombre.charAt(0)}${est.apellido.charAt(0)}`.toUpperCase()
              return (
                <tr key={est.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground">
                        {iniciales}
                      </span>
                      <span className="font-medium text-foreground">{est.nombre} {est.apellido}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {est.tipoDocumento && est.numeroDocumento ? `${est.tipoDocumento} ${est.numeroDocumento}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{est.email}</td>
                  <td className="px-4 py-3"><EstadoDot {...ai} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/estudiantes/${est.id}`} className="text-xs font-medium text-primary hover:underline">
                      {T.verPerfil}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {page.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            Página {page.number + 1} de {page.totalPages} · {page.totalElements} estudiantes
          </span>
          <div className="flex gap-1">
            <button type="button" disabled={page.number === 0} onClick={() => setCurrent((p) => p - 1)}
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
              <CaretLeft className="size-4" />
            </button>
            <button type="button" disabled={page.number >= page.totalPages - 1} onClick={() => setCurrent((p) => p + 1)}
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
              <CaretRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Pestaña: Documentos ──────────────────────────────────────────────────────

function TabDocumentos({ programaId }: { programaId: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const { confirmar, dialogo } = useConfirmar()
  const { mostrarError, avisos } = useAvisos()
  const [page, setPage]         = useState<Page<DocumentoResponse> | null>(null)
  const [currentPage, setCurrent] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [tipos, setTipos]       = useState<string[]>([])
  const [tipoSel, setTipoSel]   = useState('')
  const [archivo, setArchivo]   = useState<File | null>(null)
  const [busy, setBusy]         = useState(false)
  const [mensaje, setMensaje]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true); setError(null)
    try { setPage(await documentosApi.buscar({ programaId, page: p, size: 20 })) }
    catch { setError(T.noSePudieronX) }
    finally { setLoading(false) }
  }, [programaId])

  useEffect(() => { load(currentPage) }, [load, currentPage])
  useEffect(() => { documentosApi.tipos().then(setTipos).catch(() => setTipos([])) }, [])

  const handleUpload = async () => {
    if (!archivo) return
    setBusy(true); setMensaje(null)
    try {
      await documentosApi.subir(archivo, { programaId, tipo: tipoSel || undefined })
      setArchivo(null); setTipoSel('')
      if (fileRef.current) fileRef.current.value = ''
      setMensaje('Documento subido correctamente.')
      load(currentPage)
    } catch (err) {
      setMensaje(err instanceof ApiCallError ? `Error al subir (HTTP ${err.status}).` : T.errorDeConexion)
    } finally { setBusy(false) }
  }

  const handleDelete = async (doc: DocumentoResponse) => {
    if (!(await confirmar({ titulo: T.eliminarDocumento, descripcion: `Se eliminará el documento "${doc.nombre}". Esta acción no se puede deshacer.`, textoConfirmar: C.eliminar }))) return
    setBusy(true)
    try { await documentosApi.eliminar(doc.id); load(currentPage) }
    catch { mostrarError(T.noSePudoXXXX) }
    finally { setBusy(false) }
  }

  const handleDownload = async (doc: DocumentoResponse) => {
    try { await documentosApi.descargar(doc.id, doc.nombre) }
    catch { mostrarError(T.noSePudoXXXXX) }
  }

  return (
    <div className="flex flex-col gap-4">
      {dialogo}
      {avisos}
      {/* Subir documento */}
      <Card className="rounded-lg border-border shadow-none">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc-archivo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Archivo</label>
            <input id="doc-archivo" ref={fileRef} type="file" disabled={busy}
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc-tipo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Tipo</label>
            <select id="doc-tipo" value={tipoSel} onChange={(e) => setTipoSel(e.target.value)} disabled={busy}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">{T.sinTipo}</option>
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={handleUpload} disabled={busy || !archivo}>
            {busy ? <CircleNotch className="size-4 animate-spin" /> : <UploadSimple className="size-4" />} Subir documento
          </Button>
          {mensaje && <span className="text-xs text-muted-foreground">{mensaje}</span>}
        </CardContent>
      </Card>

      {loading && <EstadoCarga mensaje="Cargando documentos…" />}
      {error && !loading && <EstadoError mensaje={error} onRetry={() => load(currentPage)} />}

      {!loading && !error && page && (
        page.content.length === 0 ? (
          <Card className="rounded-lg border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <FileText className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{T.noHayDocumentos}</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-lg border-border shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{T.version}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{T.tamano}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{T.subidoPor}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {page.content.map((doc) => (
                    <tr key={doc.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{doc.nombre}</td>
                      <td className="px-4 py-3 text-muted-foreground">{doc.tipo || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">v{doc.numeroVersion}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatoTamano(doc.tamano)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{doc.subidoPor ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatoFecha(doc.createdAt, locale === 'en')}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => handleDownload(doc)} title="Descargar" aria-label={`Descargar ${doc.nombre}`}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                            <DownloadSimple className="size-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(doc)} title={C.eliminar} aria-label={`Eliminar ${doc.nombre}`}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                            <Trash className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {page.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-xs text-muted-foreground tabular-nums">
                  Página {page.number + 1} de {page.totalPages} · {page.totalElements} documentos
                </span>
                <div className="flex gap-1">
                  <button type="button" disabled={page.number === 0} onClick={() => setCurrent((p) => p - 1)}
                    className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
                    <CaretLeft className="size-4" />
                  </button>
                  <button type="button" disabled={page.number >= page.totalPages - 1} onClick={() => setCurrent((p) => p + 1)}
                    className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
                    <CaretRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        )
      )}
    </div>
  )
}

// ─── Pestaña: Hojas de vida ───────────────────────────────────────────────────

function TabHojasDeVida({ programaId }: { programaId: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [soloCompletos, setSoloCompletos] = useState(false)
  const [resultado, setResultado] = useState<GeneracionMasivaResponse | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const generar = () => {
    setError(null)
    startTransition(async () => {
      try { setResultado(await hvApi.generarMasiva({ programaId, soloCompletos })) }
      catch (err) {
        setError(err instanceof ApiCallError
          ? `No se pudieron generar las hojas de vida (HTTP ${err.status}).`
          : C.errorConexion)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-lg border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{T.generacionMasiva}</CardTitle>
          <CardDescription className="text-xs">
            {T.generaLaHoja}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={soloCompletos} onChange={(e) => setSoloCompletos(e.target.checked)}
              className="size-3.5 rounded border-gray-300 accent-primary" disabled={isPending} />
            {T.soloEstudiantesCon}
          </label>
          <Button size="sm" onClick={generar} disabled={isPending}>
            {isPending ? <><CircleNotch className="size-4 animate-spin" /> Generando…</> : <><ReadCvLogo className="size-4" /> {T.generarHojasDe}</>}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {resultado && (
        <Card className="rounded-lg border-border shadow-none overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{T.resultadoDeLa}</CardTitle>
            <CardDescription className="text-xs tabular-nums">
              Solicitadas: {resultado.solicitadas} · Generadas: {resultado.generadas} · Fallidas: {resultado.fallidas}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {resultado.resultados.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">{T.noHuboEstudiantes}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estudiante</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Generada</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resultado.resultados.map((r) => (
                      <tr key={r.estudianteId} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{r.nombre}</td>
                        <td className="px-4 py-3">
                          {r.generada
                            ? <span className="flex items-center gap-1.5 text-xs font-medium text-[#0F6E56]"><CheckCircle className="size-3.5" /> Sí</span>
                            : <span className="flex items-center gap-1.5 text-xs font-medium text-red-700"><X className="size-3.5" /> No</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.error ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Pestaña: Actividades ─────────────────────────────────────────────────────

/** El color no depende del idioma; la etiqueta si, y por eso se recibe. */
const estiloActividad: Record<string, { dot: string; text: string }> = {
  PENDIENTE:  { dot: 'bg-navy-500', text: 'text-navy-600' },
  COMPLETADA: { dot: 'bg-success',  text: 'text-[#0F6E56]' },
}

function estadoActividad(T: ReturnType<typeof textos>, codigo: string) {
  const etiquetas: Record<string, string> = { PENDIENTE: T.pendiente, COMPLETADA: T.completada }
  return { label: etiquetas[codigo] ?? codigo, ...(estiloActividad[codigo] ?? estadoFallback) }
}

function TabActividades({ programaId }: { programaId: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const { confirmar, dialogo } = useConfirmar()
  const { mostrarError, avisos } = useAvisos()
  const [actividades, setActividades] = useState<ActividadResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [nombre, setNombre]   = useState('')
  const [fecha, setFecha]     = useState('')
  const [responsable, setResponsable] = useState('')
  const [formError, setFormError]     = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setActividades(await actividadesApi.porPrograma(programaId)) }
    catch { setError(T.noSePudieronXX) }
    finally { setLoading(false) }
  }, [programaId])

  useEffect(() => { load() }, [load])

  const handleCreate = (e: React.SyntheticEvent) => {
    e.preventDefault(); setFormError(null)
    if (!nombre.trim()) { setFormError(C.errorNombre); return }
    if (!fecha) { setFormError(T.laFechaEs); return }
    startTransition(async () => {
      try {
        await actividadesApi.crear(programaId, { nombre: nombre.trim(), fecha, responsable: responsable.trim() || undefined })
        setNombre(''); setFecha(''); setResponsable('')
        load()
      } catch (err) {
        setFormError(err instanceof ApiCallError ? `Error del servidor (HTTP ${err.status}).` : C.errorConexion)
      }
    })
  }

  const handleDelete = async (act: ActividadResponse) => {
    if (!(await confirmar({ titulo: T.eliminarActividad, descripcion: `Se eliminará la actividad "${act.nombre}".`, textoConfirmar: C.eliminar }))) return
    startTransition(async () => {
      try { await actividadesApi.eliminar(programaId, act.id); load() }
      catch { mostrarError(T.noSePudoXXX) }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {dialogo}
      {avisos}
      {/* Crear actividad */}
      <Card className="rounded-lg border-border shadow-none">
        <CardContent className="py-4">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="act-nombre" className="text-[11px] uppercase tracking-wider text-muted-foreground">Nombre</label>
              <Input id="act-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={T.tallerDeEntrevistas} disabled={isPending} className="w-56" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="act-fecha" className="text-[11px] uppercase tracking-wider text-muted-foreground">Fecha</label>
              <Input id="act-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={isPending} className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="act-resp" className="text-[11px] uppercase tracking-wider text-muted-foreground">Responsable</label>
              <Input id="act-resp" value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder={T.nombreDelResponsable} disabled={isPending} className="w-56" />
            </div>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? <CircleNotch className="size-4 animate-spin" /> : <Plus className="size-4" />} Agregar actividad
            </Button>
            {formError && <span className="text-xs text-destructive">{formError}</span>}
          </form>
        </CardContent>
      </Card>

      {loading && <EstadoCarga mensaje="Cargando actividades…" />}
      {error && !loading && <EstadoError mensaje={error} onRetry={load} />}

      {!loading && !error && (
        actividades.length === 0 ? (
          <Card className="rounded-lg border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <ClipboardText className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{T.noHayActividades}</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-lg border-border shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Responsable</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {actividades.map((act) => {
                    const ei = estadoActividad(T, act.estado)
                    return (
                      <tr key={act.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{act.nombre}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{act.fecha}</td>
                        <td className="px-4 py-3 text-muted-foreground">{act.responsable ?? '—'}</td>
                        <td className="px-4 py-3"><EstadoDot {...ei} /></td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => handleDelete(act)} title={C.eliminar} aria-label={`Eliminar ${act.nombre}`}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                            <Trash className="size-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}
    </div>
  )
}

// ─── Pestaña: Historial ───────────────────────────────────────────────────────

function TabHistorial({ programaId }: { programaId: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [page, setPage]       = useState<Page<AuditoriaResponse> | null>(null)
  const [currentPage, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true); setError(null)
    try { setPage(await auditoriaApi.buscar({ registroId: programaId, page: p, size: 20 })) }
    catch { setError(T.noSePudoX) }
    finally { setLoading(false) }
  }, [programaId])

  useEffect(() => { load(currentPage) }, [load, currentPage])

  if (loading) return <EstadoCarga mensaje="Cargando historial…" />
  if (error) return <EstadoError mensaje={error} onRetry={() => load(currentPage)} />
  if (!page) return null

  if (page.content.length === 0) {
    return (
      <Card className="rounded-lg border-border shadow-none">
        <CardContent className="flex flex-col items-center gap-3 py-16">
          <ClockCounterClockwise className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{T.noHayRegistros}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {page.content.map((reg) => (
        <Card key={reg.id} className="rounded-lg border-border shadow-none">
          <CardContent className="flex flex-col gap-2 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{reg.accion}</span>
                <span className="text-xs text-muted-foreground">· {reg.usuario}</span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{formatoFecha(reg.fecha, locale === 'en')}</span>
            </div>
            {(reg.datosAnteriores || reg.datosNuevos) && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-secondary/30 p-2.5">
                  <Etiqueta>{T.informacionAnterior}</Etiqueta>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-muted-foreground">{reg.datosAnteriores ?? '—'}</pre>
                </div>
                <div className="rounded-md border border-border bg-secondary/30 p-2.5">
                  <Etiqueta>{T.informacionNueva}</Etiqueta>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-muted-foreground">{reg.datosNuevos ?? '—'}</pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {page.totalPages > 1 && (
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            Página {page.number + 1} de {page.totalPages} · {page.totalElements} registros
          </span>
          <div className="flex gap-1">
            <button type="button" disabled={page.number === 0} onClick={() => setCurrent((p) => p - 1)}
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
              <CaretLeft className="size-4" />
            </button>
            <button type="button" disabled={page.number >= page.totalPages - 1} onClick={() => setCurrent((p) => p + 1)}
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
              <CaretRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pestaña: Plataformas ─────────────────────────────────────────────────────

function TabPlataformas({ programaId }: { programaId: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [catalogo, setCatalogo] = useState<PlataformaResponse[]>([])
  const [asignadas, setAsignadas] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [cat, asg] = await Promise.all([
        plataformasApi.catalogo(),
        plataformasApi.dePrograma(programaId),
      ])
      setCatalogo(cat)
      setAsignadas(new Set(asg.map((p) => p.id)))
    } catch {
      setError(T.noSePudieronXXX)
    } finally { setLoading(false) }
  }, [programaId])

  useEffect(() => { load() }, [load])

  const toggle = (id: string) =>
    setAsignadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const guardar = () => {
    setGuardando(true); setMensaje(null)
    void (async () => {
      try {
        await plataformasApi.asignarPrograma(programaId, [...asignadas])
        setMensaje(T.plataformasDelProyecto)
      } catch (err) {
        setMensaje(err instanceof ApiCallError
          ? `Error del servidor (HTTP ${err.status}).`
          : C.errorConexion)
      } finally { setGuardando(false) }
    })()
  }

  if (loading) return <EstadoCarga mensaje="Cargando plataformas…" />
  if (error) return <EstadoError mensaje={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-lg border-border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{T.plataformasParaEste}</CardTitle>
          <CardDescription className="text-xs">
            {T.lasPlataformasQue}
          </CardDescription>
        </CardHeader>
        <CardContent className="py-4">
          {catalogo.length === 0 ? (
            <p className="text-sm text-muted-foreground">{T.aunNoHay}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {catalogo.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-secondary/30">
                  <input type="checkbox" checked={asignadas.has(p.id)} onChange={() => toggle(p.id)}
                    disabled={guardando} className="size-4 rounded border-gray-300 accent-primary" />
                  {p.iconoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.iconoUrl} alt="" className="size-7 shrink-0 rounded-md border border-border bg-muted object-contain p-0.5" />
                  ) : (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">{p.nombre.charAt(0).toUpperCase()}</span>
                  )}
                  <span className="text-sm font-medium text-foreground">{p.nombre}</span>
                </label>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <Button size="sm" onClick={guardar} disabled={guardando || catalogo.length === 0}>
              {guardando ? <CircleNotch className="size-4 animate-spin" /> : <CheckCircle className="size-4" />} Guardar plataformas
            </Button>
            {mensaje && <span className="text-sm text-muted-foreground">{mensaje}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type TabId = 'resumen' | 'estudiantes' | 'documentos' | 'hv' | 'actividades' | 'plataformas' | 'identidad' | 'historial'

function pestanas(T: ReturnType<typeof textos>, C: TextosAdmin): { id: TabId; label: string; icon: typeof Users }[] {
  return [
    { id: 'resumen',     label: T.resumen,          icon: Rows },
    { id: 'estudiantes', label: C.estudiantes,      icon: Users },
    { id: 'documentos',  label: C.documentos,       icon: FileText },
    { id: 'hv',          label: T.hojasDeVida,      icon: ReadCvLogo },
    { id: 'actividades', label: T.actividades,      icon: ClipboardText },
    { id: 'plataformas', label: T.plataformas,      icon: SquaresFour },
    { id: 'identidad',   label: T.aparienciaYMarca, icon: Palette },
    { id: 'historial',   label: T.historial,        icon: ClockCounterClockwise },
  ]
}

/**
 * Igual que la ficha del estudiante: la navegación entre proyectos no recarga
 * la página, así que sin la clave el `id` cambia dentro del mismo componente y
 * las cargas del proyecto anterior escriben encima al volver.
 */
export default function ProyectoDetallePage() {
  const params = useParams<{ id: string }>()
  const id = params.id ?? ''
  return <DetalleProyecto key={id} id={id} />
}

function DetalleProyecto({ id }: { id: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const { confirmar, dialogo } = useConfirmar()
  const { mostrarError, avisos } = useAvisos()
  const router = useRouter()

  const [programa, setPrograma] = useState<ProgramaCompleto | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [tab, setTab]           = useState<TabId>('resumen')

  // Sincronizar pestaña activa con la URL (?tab=...)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const urlParams = new URLSearchParams(window.location.search)
    const urlTab = urlParams.get('tab')
    if (urlTab === 'identidad' || urlTab === 'apariencia') {
      setTab('identidad')
    } else if (urlTab && ['resumen', 'estudiantes', 'documentos', 'hv', 'actividades', 'plataformas', 'historial'].includes(urlTab)) {
      setTab(urlTab as TabId)
    }
  }, [])

  const cambiarTab = (nuevaTab: TabId) => {
    setTab(nuevaTab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', nuevaTab)
      window.history.replaceState({}, '', url.toString())
    }
  }

  const [showEdit, setShowEdit]   = useState(false)
  const [form, setForm]           = useState<ProgramaForm | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setPrograma((await programasApi.obtener(id)) as ProgramaCompleto) }
    catch (err) {
      setError(err instanceof ApiCallError && err.status === 404
        ? T.elProyectoNo
        : T.noSePudoXX)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { if (id) load() }, [id, load])

  const openEdit = () => {
    if (!programa) return
    setForm({
      nombre: programa.nombre,
      descripcion: programa.descripcion ?? '',
      duracionDias: programa.duracionDias ?? undefined,
      fechaInicio: programa.fechaInicio ?? '',
      fechaFin: programa.fechaFin ?? '',
      estado: programa.estado,
      cliente: programa.cliente ?? '',
      responsable: programa.responsable ?? '',
      observaciones: programa.observaciones ?? '',
      porcentajeAvance: programa.porcentajeAvance ?? undefined,
    })
    setFormError(null); setFormSuccess(null); setShowEdit(true)
  }

  const handleSave = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!form) return
    setFormError(null); setFormSuccess(null)
    if (!form.nombre.trim()) { setFormError(C.errorNombre); return }
    startTransition(async () => {
      try {
        await programasApi.actualizar(id, form)
        setFormSuccess('Proyecto actualizado.')
        setTimeout(() => { setShowEdit(false); load() }, 800)
      } catch (err) {
        if (err instanceof ApiCallError) {
          setFormError(err.status === 401 || err.status === 403 ? T.sinPermisos : `Error del servidor (HTTP ${err.status}).`)
        } else { setFormError(C.errorConexion) }
      }
    })
  }

  const handleFinalizar = async () => {
    if (!(await confirmar({ titulo: 'Finalizar proyecto', descripcion: T.elEstadoDel, textoConfirmar: 'Finalizar', destructivo: false }))) return
    startTransition(async () => {
      try { await programasApi.cambiarEstado(id, 'FINALIZADO'); load() }
      catch (err) {
        mostrarError(mensajeDeError(err, T.errorDeConexionX))
      }
    })
  }

  const handleEliminar = async () => {
    if (!programa) return
    if (!(await confirmar({ titulo: T.eliminarProyecto, descripcion: `Se eliminará el proyecto "${programa.nombre}". Esta acción no se puede deshacer.`, textoConfirmar: C.eliminar }))) return
    startTransition(async () => {
      try {
        await programasApi.eliminar(id)
        router.push('/proyectos')
      } catch (err) {
        mostrarError(mensajeDeError(err, T.errorDeConexionX))
      }
    })
  }

  const setF = (key: keyof ProgramaForm, val: unknown) =>
    setForm((prev) => (prev ? { ...prev, [key]: val } : prev))

  if (loading) return <EstadoCarga mensaje="Cargando proyecto…" />
  if (error) return (
    <div className="flex flex-col gap-4">
      <Link href="/proyectos" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Volver a proyectos
      </Link>
      <EstadoError mensaje={error} onRetry={load} />
    </div>
  )
  if (!programa) return null

  const si = estadoPrograma(T, C, programa.estado)
  const avance = Math.min(100, Math.max(0, programa.porcentajeAvance ?? 0))

  return (
    <div className="flex flex-col gap-6">
      {dialogo}
      {avisos}
      {/* Cabecera */}
      <div className="flex flex-col gap-4">
        <Link href="/proyectos" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Volver a proyectos
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
                <Kanban className="size-5" /> {programa.nombre}
              </h2>
              <EstadoDot {...si} />
            </div>
            <p className="text-sm text-muted-foreground">
              {[programa.cliente, programa.responsable].filter(Boolean).join(' · ') || T.sinClienteNi}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {programa.fechaInicio ?? '—'} → {programa.fechaFin ?? '—'}
              {programa.duracionDias ? ` · ${programa.duracionDias} días` : ''}
            </p>
            <div className="flex items-center gap-3 max-w-xs">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-navy-800 transition-all" style={{ width: `${avance}%` }} />
              </div>
              <span className="text-xs font-medium tabular-nums text-foreground">{avance}%</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => cambiarTab('identidad')}>
              <Palette className="size-3.5 text-primary" /> Apariencia
            </Button>
            <Button variant="outline" size="sm" onClick={openEdit} disabled={isPending}>
              <PencilSimple className="size-3.5" /> {C.editar}
            </Button>
            {programa.estado !== 'FINALIZADO' && programa.estado !== 'ARCHIVADO' && (
              <Button variant="outline" size="sm" onClick={handleFinalizar} disabled={isPending}>
                <Flag className="size-3.5" /> Finalizar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleEliminar} disabled={isPending}
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash className="size-3.5" /> {C.eliminar}
            </Button>
          </div>
        </div>
      </div>

      {/* Formulario de edición */}
      {showEdit && form && (
        <Card className="rounded-lg border-primary/30 shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>{T.editarProyecto}</CardTitle>
              <button type="button" onClick={() => setShowEdit(false)} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <CardDescription>{T.elNombreEs}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label htmlFor="pe-nombre" className="text-xs font-medium">Nombre *</label>
                <Input id="pe-nombre" required value={form.nombre} onChange={(e) => setF('nombre', e.target.value)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pe-cliente" className="text-xs font-medium">Cliente</label>
                <Input id="pe-cliente" value={form.cliente ?? ''} onChange={(e) => setF('cliente', e.target.value)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pe-responsable" className="text-xs font-medium">Responsable</label>
                <Input id="pe-responsable" value={form.responsable ?? ''} onChange={(e) => setF('responsable', e.target.value)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pe-avance" className="text-xs font-medium">{T.deAvance}</label>
                <Input id="pe-avance" type="number" min={0} max={100} value={form.porcentajeAvance ?? ''}
                  onChange={(e) => setF('porcentajeAvance', e.target.value === '' ? undefined : Math.min(100, Math.max(0, parseInt(e.target.value))))} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label htmlFor="pe-desc" className="text-xs font-medium">{T.descripcion}</label>
                <Textarea id="pe-desc" minRows={2} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.descripcion ?? ''} onChange={(e) => setF('descripcion', e.target.value)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label htmlFor="pe-obs" className="text-xs font-medium">Observaciones</label>
                <Textarea id="pe-obs" minRows={2} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.observaciones ?? ''} onChange={(e) => setF('observaciones', e.target.value)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pe-inicio" className="text-xs font-medium">Fecha inicio</label>
                <Input id="pe-inicio" type="date" value={form.fechaInicio ?? ''} onChange={(e) => setF('fechaInicio', e.target.value)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pe-fin" className="text-xs font-medium">Fecha fin</label>
                <Input id="pe-fin" type="date" value={form.fechaFin ?? ''} onChange={(e) => setF('fechaFin', e.target.value)} disabled={isPending} />
              </div>

              {formError && (
                <div role="alert" className="col-span-full flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div role="status" className="col-span-full flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle className="mt-0.5 size-4 shrink-0" /><span>{formSuccess}</span>
                </div>
              )}
              <div className="col-span-full flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowEdit(false)} disabled={isPending}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <><CircleNotch className="size-4 animate-spin" /> Guardando…</> : 'Actualizar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pestañas */}
      <div className="flex overflow-x-auto border-b border-border">
        {pestanas(T, C).map(({ id: tid, label, icon: Icon }) => (
          <button key={tid} type="button" onClick={() => cambiarTab(tid)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${tab === tid ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'resumen'     && <TabResumen programaId={id} />}
      {tab === 'estudiantes' && <TabEstudiantes programaId={id} />}
      {tab === 'documentos'  && <TabDocumentos programaId={id} />}
      {tab === 'hv'          && <TabHojasDeVida programaId={id} />}
      {tab === 'actividades' && <TabActividades programaId={id} />}
      {tab === 'plataformas' && <TabPlataformas programaId={id} />}
      {tab === 'identidad'   && (
        <>
          <PanelBranding programaIdInicial={id} />
          <PanelWhatsapp programaIdInicial={id} />
        </>
      )}
      {tab === 'historial'   && <TabHistorial programaId={id} />}
    </div>
  )
}
