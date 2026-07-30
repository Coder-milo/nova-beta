'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowSquareOut, ArrowsClockwise, CheckCircle, CircleNotch, DownloadSimple, Eye, FileMagnifyingGlass, FileText, Globe, ListChecks, Minus, PencilSimpleLine, Plus, ReadCvLogo, Stack, Star, Trash, UploadSimple, WarningCircle, X, XCircle } from '@phosphor-icons/react'
import Link from '@/compat/next-link'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EstadoDot } from '@/components/ui/estado-dot'
import { VistaPreviaPdf } from '@/components/ui/vista-previa-pdf'
import { hvApi, programasApi, estudiantesApi, perfilApi, ApiCallError } from '@/lib/api'
import type {
  ProgramaResponse, PlantillaResponse, GeneracionMasivaResponse,
  CampoExtraido, EstudianteRequest, EstudianteResponse,
  AnalisisCompletitudResponse, SeccionCompletitud,
  DatosHvDto, ExperienciaDto, FormacionDto,
} from '@/lib/types'
import { Textarea } from '@/components/ui/textarea'

type TabId = 'generacion' | 'plantillas' | 'extraccion' | 'edicion'

/**
 * El manifiesto de la plantilla viene con los nombres en inglés, porque son los
 * marcadores del HTML. Quien ajusta una hoja de vida desde coordinación no tiene
 * por qué leer «Continuing Education & Certifications» para entender qué está
 * quitando, así que aquí se traducen. Se indexa por título y por id (y por
 * etiqueta y por marcador, más abajo) porque el analizador devuelve unos u otros
 * según de dónde salga la plantilla.
 */
const TITULOS_SECCIONES_ES: Record<string, string> = {
  Header: 'Cabecera / Encabezado',
  header: 'Cabecera / Encabezado',
  Encabezado: 'Cabecera / Encabezado',
  Contact: 'Información de Contacto',
  contact: 'Información de Contacto',
  'Professional Summary': 'Perfil Profesional',
  summary: 'Perfil Profesional',
  'Professional Experience': 'Experiencia Profesional',
  experience: 'Experiencia Profesional',
  Education: 'Educación Académica',
  education: 'Educación Académica',
  'Continuing Education & Certifications': 'Certificaciones y Formación Adicional',
  certifications: 'Certificaciones y Formación Adicional',
  Achievements: 'Logros Destacados',
  achievements: 'Logros Destacados',
  'Technical Skills': 'Habilidades Técnicas',
  skills: 'Habilidades Técnicas',
  Languages: 'Idiomas',
  languages: 'Idiomas',
}

const ETIQUETAS_CAMPOS_ES: Record<string, string> = {
  'Full Name': 'Nombre Completo',
  FULL_NAME: 'Nombre Completo',
  'Professional Title': 'Cargo / Título Profesional',
  PROFESSIONAL_TITLE: 'Cargo / Título Profesional',
  'City, Country': 'Ciudad y País',
  CITY_COUNTRY: 'Ciudad y País',
  Phone: 'Teléfono / Celular',
  PHONE: 'Teléfono / Celular',
  'LinkedIn URL': 'Perfil de LinkedIn',
  LINKEDIN_URL: 'Perfil de LinkedIn',
  'Portfolio URL': 'Portafolio Web',
  PORTFOLIO_URL: 'Portafolio Web',
  Email: 'Correo Electrónico',
  EMAIL: 'Correo Electrónico',
  'Professional Summary': 'Resumen Profesional',
  SUMMARY: 'Resumen Profesional',
  'Job Title': 'Cargo Desempeñado',
  JOB_TITLE: 'Cargo Desempeñado',
  Organization: 'Empresa / Organización',
  ORGANIZATION: 'Empresa / Organización',
  City: 'Ciudad',
  CITY: 'Ciudad',
  'Date Range': 'Rango de Fechas (Inicio - Fin)',
  DATES: 'Rango de Fechas (Inicio - Fin)',
  'Accomplishment Bullets': 'Logros y Funciones',
  BULLETS: 'Logros y Funciones',
  'Degree / Program': 'Título / Programa Académico',
  DEGREE: 'Título / Programa Académico',
  Institution: 'Institución Educativa',
  INSTITUTION: 'Institución Educativa',
  Year: 'Año de Graduación',
  YEAR: 'Año de Graduación',
  'Certification / Course': 'Certificación / Curso',
  CERTIFICATION: 'Certificación / Curso',
  Achievement: 'Logro Destacado',
  ACHIEVEMENT: 'Logro Destacado',
  Skills: 'Habilidades Técnicas y Herramientas',
  SKILLS: 'Habilidades Técnicas y Herramientas',
  Languages: 'Idiomas y Niveles',
  LANGUAGES: 'Idiomas y Niveles',
}

function errorDe(err: unknown, fallback: string): string {
  if (err instanceof ApiCallError) {
    if (err.status === 401 || err.status === 403) return 'Sin permisos para esta acción.'
    return err.body.message ?? `${fallback} (HTTP ${err.status}).`
  }
  return 'No se pudo conectar con el backend.'
}

export default function HojasDeVidaPage() {
  const [tab, setTab] = useState<TabId>('generacion')

  // Comunes
  const [programas, setProgramas]   = useState<ProgramaResponse[]>([])
  const [plantillas, setPlantillas] = useState<PlantillaResponse[]>([])
  const [loadingPlantillas, setLoadingPlantillas] = useState(true)
  const [errorPlantillas, setErrorPlantillas]     = useState<string | null>(null)

  // Generación
  const [genPrograma, setGenPrograma]   = useState('')
  const [genPlantilla, setGenPlantilla] = useState('')
  const [soloCompletos, setSoloCompletos] = useState(false)
  const [generando, setGenerando]       = useState(false)
  const [genError, setGenError]         = useState<string | null>(null)
  const [genResult, setGenResult]       = useState<GeneracionMasivaResponse | null>(null)
  const [descargandoZip, setDescargandoZip] = useState(false)

  // Plantillas: creación
  const [plNombre, setPlNombre]   = useState('')
  const [plColor, setPlColor]     = useState('#1C315E')
  const [plArchivo, setPlArchivo] = useState<File | null>(null)
  const [creandoPlantilla, setCreandoPlantilla] = useState(false)
  const [plError, setPlError]     = useState<string | null>(null)
  const [plSuccess, setPlSuccess] = useState<string | null>(null)
  const plFileRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)

  // Extracción / Conversión a Plantilla CAC
  const [extArchivo, setExtArchivo]     = useState<File | null>(null)
  const [extrayendo, setExtrayendo]     = useState(false)
  const [extError, setExtError]         = useState<string | null>(null)
  const [campos, setCampos]             = useState<CampoExtraido[]>([])
  const [datosExt, setDatosExt]         = useState<DatosHvDto | null>(null)
  const [convertiendo, setConvertiendo] = useState(false)
  const [extIdioma, setExtIdioma]       = useState<'es' | 'en'>('es')
  const extFileRef = useRef<HTMLInputElement>(null)


  // Edición
  const [editPrograma, setEditPrograma] = useState('')
  const [editEstudianteId, setEditEstudianteId] = useState('')
  const [editEstudiantes, setEditEstudiantes] = useState<{ id: string; nombre: string }[]>([])
  const [analizando, setAnalizando] = useState(false)
  const [analisis, setAnalisis] = useState<AnalisisCompletitudResponse | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<Record<string, string>>({})
  const [generandoEdit, setGenerandoEdit] = useState(false)
  const [editIdioma, setEditIdioma] = useState<'es' | 'en'>('es')
  const [seccionesExcluidas, setSeccionesExcluidas] = useState<string[]>([])
  const [camposExcluidos, setCamposExcluidos] = useState<string[]>([])

  // Vista previa de la HV del estudiante seleccionado. El contador se
  // incrementa al pulsar «volver a generar»; sin esa dependencia, cambiar los
  // datos del estudiante en otra pestaña dejaba el visor mostrando el PDF
  // anterior.
  const [revisionPreview, setRevisionPreview] = useState(0)
  const cargarPreviewEstudiante = useCallback(
    () => hvApi.vistaPreviaEstudiante(editEstudianteId, { idioma: editIdioma }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editEstudianteId, editIdioma, revisionPreview],
  )

  const toggleSeccion = (secKey: string) => {
    setSeccionesExcluidas((prev) =>
      prev.includes(secKey) ? prev.filter((s) => s !== secKey) : [...prev, secKey]
    )
  }

  const toggleCampo = (campoKey: string) => {
    setCamposExcluidos((prev) =>
      prev.includes(campoKey) ? prev.filter((c) => c !== campoKey) : [...prev, campoKey]
    )
  }

  // Mini modal para agregar nuevo registro recurrente (Experiencia / Formación / Certificación / Habilidades / Idiomas)
  const [modalAgregar, setModalAgregar] = useState<'experience' | 'education' | 'certifications' | 'skills' | 'languages' | null>(null)
  const [nuevoCargo, setNuevoCargo] = useState('')
  const [nuevaEmpresa, setNuevaEmpresa] = useState('')
  const [nuevaFechaInicio, setNuevaFechaInicio] = useState('')
  const [nuevaFechaFin, setNuevaFechaFin] = useState('')
  const [nuevasFunciones, setNuevasFunciones] = useState('')
  const [nuevoPrograma, setNuevoPrograma] = useState('')
  const [nuevaInstitucion, setNuevaInstitucion] = useState('')
  const [nuevoTipoFormacion, setNuevoTipoFormacion] = useState<string>('CERTIFICACION')
  const [nuevaSkill, setNuevaSkill] = useState('')
  const [nuevoIdioma, setNuevoIdioma] = useState('')
  const [guardandoItem, setGuardandoItem] = useState(false)

  const handleGuardarNuevoItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editEstudianteId || !modalAgregar) return
    setGuardandoItem(true)
    try {
      if (modalAgregar === 'experience') {
        if (!nuevoCargo.trim() || !nuevaEmpresa.trim()) return
        await perfilApi.crearExperiencia(editEstudianteId, {
          cargo: nuevoCargo,
          empresa: nuevaEmpresa,
          fechaInicio: nuevaFechaInicio || undefined,
          fechaFin: nuevaFechaFin || undefined,
          funciones: nuevasFunciones || undefined,
        })
      } else if (modalAgregar === 'education' || modalAgregar === 'certifications') {
        if (!nuevoPrograma.trim() || !nuevaInstitucion.trim()) return
        await perfilApi.crearFormacion(editEstudianteId, {
          tipo: modalAgregar === 'certifications' ? 'CERTIFICACION' : (nuevoTipoFormacion || 'CURSO'),
          programa: nuevoPrograma,
          institucion: nuevaInstitucion,
          fechaFin: nuevaFechaFin || undefined,
        })
      } else if (modalAgregar === 'skills') {
        if (!nuevaSkill.trim()) return
        const est = await estudiantesApi.obtener(editEstudianteId)
        const compsActuales = est.competencias?.trim()
        const nuevasComps = compsActuales ? `${compsActuales}, ${nuevaSkill.trim()}` : nuevaSkill.trim()
        await estudiantesApi.actualizar(editEstudianteId, { nombre: est.nombre, apellido: est.apellido, email: est.email, programaId: est.programaId, competencias: nuevasComps })
      } else if (modalAgregar === 'languages') {
        if (!nuevoIdioma.trim()) return
        const est = await estudiantesApi.obtener(editEstudianteId)
        const idiomasActuales = est.idiomas?.trim()
        const nuevosIdiomas = idiomasActuales ? `${idiomasActuales}, ${nuevoIdioma.trim()}` : nuevoIdioma.trim()
        await estudiantesApi.actualizar(editEstudianteId, { nombre: est.nombre, apellido: est.apellido, email: est.email, programaId: est.programaId, idiomas: nuevosIdiomas })
      }
      setModalAgregar(null)
      setNuevoCargo(''); setNuevaEmpresa(''); setNuevaFechaInicio(''); setNuevaFechaFin(''); setNuevasFunciones('')
      setNuevoPrograma(''); setNuevaInstitucion(''); setNuevaSkill(''); setNuevoIdioma('')
      const res = await hvApi.analizar(editEstudianteId)
      setAnalisis(res)
    } catch (err) {
      setEditError(errorDe(err, 'Error al guardar el nuevo registro'))
    } finally {
      setGuardandoItem(false)
    }
  }

  // ── Cargas ────────────────────────────────────────────────────────────────
  useEffect(() => {
    programasApi.listar().then((list) => {
      setProgramas(list)
      if (list.length > 0) { setGenPrograma(list[0].id); setEditPrograma(list[0].id) }
    }).catch(() => { /* el selector queda vacío */ })
  }, [])


  const loadPlantillas = useCallback(async () => {
    setLoadingPlantillas(true); setErrorPlantillas(null)
    try {
      const list = await hvApi.plantillas()
      setPlantillas(list)
      const pred = list.find((p) => p.predeterminada)
      setGenPlantilla((prev) => prev || (pred?.id ?? list[0]?.id ?? ''))
    } catch (err) {
      setErrorPlantillas(errorDe(err, 'Error al cargar las plantillas'))
    } finally { setLoadingPlantillas(false) }
  }, [])

  useEffect(() => { loadPlantillas() }, [loadPlantillas])

  // ── Edición: cargar estudiantes del programa seleccionado ─────────────
  useEffect(() => {
    if (!editPrograma) return
    estudiantesApi.listar(editPrograma, 0, 200).then((page) => {
      setEditEstudiantes(page.content.map((e) => ({ id: e.id, nombre: `${e.nombre} ${e.apellido}` })))
    }).catch(() => { setEditEstudiantes([]) })
  }, [editPrograma])

  // ── Generación masiva ─────────────────────────────────────────────────────
  const handleGenerar = async () => {
    if (!genPrograma) { setGenError('Selecciona un programa.'); return }
    setGenerando(true); setGenError(null); setGenResult(null)
    try {
      const res = await hvApi.generarMasiva({
        programaId: genPrograma,
        plantillaId: genPlantilla || undefined,
        soloCompletos,
      })
      setGenResult(res)
    } catch (err) { setGenError(errorDe(err, 'Error en la generación masiva')) }
    finally { setGenerando(false) }
  }

  const handleDescargarZip = async () => {
    if (!genResult) return
    const ids = genResult.resultados.filter((r) => r.generada).map((r) => r.estudianteId)
    if (ids.length === 0) return
    setDescargandoZip(true)
    try { await hvApi.descargarZip(ids) }
    catch (err) { setGenError(errorDe(err, 'Error al descargar el ZIP')) }
    finally { setDescargandoZip(false) }
  }

  // ── Plantillas ────────────────────────────────────────────────────────────
  const handleCrearPlantilla = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plNombre.trim()) { setPlError('El nombre es obligatorio.'); return }
    if (!plArchivo) { setPlError('Selecciona una plantilla Word (.docx) o PDF.'); return }
    const extensionOk = /\.(docx|pdf)$/i.test(plArchivo.name)
    if (!extensionOk) { setPlError('Formato no compatible. Usa un archivo .docx o .pdf.'); return }
    if (plArchivo.size > 10 * 1024 * 1024) { setPlError('El archivo supera el límite de 10 MB.'); return }
    setCreandoPlantilla(true); setPlError(null); setPlSuccess(null)
    try {
      await hvApi.crearPlantilla(plNombre.trim(), plColor, plArchivo ?? undefined)
      setPlNombre(''); setPlColor('#1C315E'); setPlArchivo(null)
      if (plFileRef.current) plFileRef.current.value = ''
      setPlSuccess('Plantilla cargada. El diseño y sus secciones están listos para usar los datos de los estudiantes.')
      await loadPlantillas()
    } catch (err) { setPlError(errorDe(err, 'Error al crear la plantilla')) }
    finally { setCreandoPlantilla(false) }
  }

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewName('')
  }

  const handleVistaPrevia = async (pl: PlantillaResponse) => {
    setPreviewLoading(pl.id); setPlError(null)
    try {
      const blob = await hvApi.vistaPreviaPlantilla(pl.id)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(blob))
      setPreviewName(pl.nombre)
    } catch (err) {
      setPlError(errorDe(err, 'No se pudo generar la vista previa'))
    } finally { setPreviewLoading(null) }
  }

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const handlePredeterminada = async (id: string) => {
    try { await hvApi.marcarPredeterminada(id); loadPlantillas() }
    catch (err) { setPlError(errorDe(err, 'Error al marcar la plantilla predeterminada')) }
  }

  const handleEliminarPlantilla = async (pl: PlantillaResponse) => {
    if (!confirm(`¿Eliminar la plantilla "${pl.nombre}"?`)) return
    try { await hvApi.eliminarPlantilla(pl.id); loadPlantillas() }
    catch (err) { setPlError(errorDe(err, 'Error al eliminar la plantilla')) }
  }

  // ── Extracción y Conversión a Plantilla CAC ─────────────────────────
  const handleExtraer = async () => {
    if (!extArchivo) { setExtError('Selecciona un archivo PDF primero.'); return }
    setExtrayendo(true); setExtError(null); setCampos([]); setDatosExt(null)
    try {
      const res = await hvApi.extraer(extArchivo)
      setCampos(res.campos ?? [])

      const mapa = new Map((res.campos ?? []).map((c) => [c.campo.toLowerCase(), c.valor]))

      const dtoCompleto: DatosHvDto = {
        nombre: res.datosEstructurados?.nombre ?? mapa.get('nombre') ?? '',
        apellido: res.datosEstructurados?.apellido ?? mapa.get('apellido') ?? '',
        cargoObjetivo: res.datosEstructurados?.cargoObjetivo ?? mapa.get('cargoobjetivo') ?? '',
        email: res.datosEstructurados?.email ?? mapa.get('email') ?? '',
        celular: res.datosEstructurados?.celular ?? mapa.get('celular') ?? '',
        ciudad: res.datosEstructurados?.ciudad ?? mapa.get('ciudad') ?? '',
        linkedinUserId: res.datosEstructurados?.linkedinUserId ?? mapa.get('linkedinuserid') ?? '',
        perfilProfesional: res.datosEstructurados?.perfilProfesional ?? mapa.get('perfilprofesional') ?? '',
        competencias: res.datosEstructurados?.competencias ?? mapa.get('competencias') ?? '',
        idiomas: res.datosEstructurados?.idiomas ?? mapa.get('idiomas') ?? '',
        titulo: res.datosEstructurados?.titulo ?? '',
        institucionEducativa: res.datosEstructurados?.institucionEducativa ?? '',
        nivelEducativo: res.datosEstructurados?.nivelEducativo ?? 'Profesional',
        experiencias: res.datosEstructurados?.experiencias ?? [],
        formaciones: res.datosEstructurados?.formaciones ?? [],
      }

      setDatosExt(dtoCompleto)
    } catch (err) { setExtError(errorDe(err, 'Error al extraer datos del PDF')) }
    finally { setExtrayendo(false) }
  }

  const handleConvertirPdf = async () => {
    if (!datosExt) return
    setConvertiendo(true); setExtError(null)
    try {
      const nom = `${datosExt.nombre ?? 'Candidato'}_${datosExt.apellido ?? ''}`.replace(/\s+/g, '_')
      await hvApi.convertirPdf(datosExt, { idioma: extIdioma }, `HV-CAC-${nom}.pdf`)
    } catch (err) {
      setExtError(errorDe(err, 'Error al generar la HV en formato CAC ATS'))
    } finally {
      setConvertiendo(false)
    }
  }

  const confianzaVisual = (c: number) => {
    if (c >= 80) return { dot: 'bg-success', text: 'text-[#0F6E56]', label: `${c}%` }
    if (c >= 60) return { dot: 'bg-navy-400', text: 'text-navy-600', label: `${c}%` }
    return { dot: 'bg-red-600', text: 'text-red-700', label: `${c}% · revisar` }
  }

  const tabs: { id: TabId; label: string; icon: typeof ReadCvLogo }[] = [
    { id: 'generacion',  label: 'Generación',             icon: ReadCvLogo },
    { id: 'plantillas',  label: 'Plantillas',             icon: Stack },
    { id: 'extraccion',  label: 'Conversión a Plantilla CAC', icon: FileMagnifyingGlass },
    { id: 'edicion',     label: 'Edición',               icon: PencilSimpleLine },
  ]


  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex border-b border-border gap-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── Generación ─────────────────────────────────────────────────────── */}
      {tab === 'generacion' && (
        <div className="flex flex-col gap-4">
          <Card className="rounded-lg border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Generación masiva</CardTitle>
              <CardDescription>Genera hojas de vida en PDF para todos los estudiantes de un programa.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="gen-programa" className="text-[11px] uppercase tracking-wider text-muted-foreground">Programa</label>
                  <select id="gen-programa" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={genPrograma} onChange={(e) => setGenPrograma(e.target.value)} disabled={generando}>
                    <option value="">Selecciona un programa</option>
                    {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="gen-plantilla" className="text-[11px] uppercase tracking-wider text-muted-foreground">Plantilla</label>
                  <select id="gen-plantilla" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={genPlantilla} onChange={(e) => setGenPlantilla(e.target.value)} disabled={generando || loadingPlantillas}>
                    <option value="">— Plantilla del sistema —</option>
                    {plantillas.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}{p.predeterminada ? ' (predeterminada)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input type="checkbox" checked={soloCompletos} onChange={(e) => setSoloCompletos(e.target.checked)} disabled={generando} className="size-4 cursor-pointer" />
                Solo estudiantes con información completa
              </label>

              {genError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{genError}</span>
                </div>
              )}

              <div>
                <Button onClick={handleGenerar} disabled={generando || !genPrograma}>
                  {generando ? <><CircleNotch className="size-4 animate-spin" /> Generando…</> : <><ReadCvLogo className="size-4" /> Generar hojas de vida</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {genResult && (
            <div className="flex flex-col gap-4">
              {/* Resumen */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="rounded-lg border-border shadow-none">
                  <CardContent className="pt-5 flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Solicitadas</span>
                    <span className="text-2xl font-semibold tabular-nums text-foreground">{genResult.solicitadas}</span>
                  </CardContent>
                </Card>
                <Card className="rounded-lg border-border shadow-none">
                  <CardContent className="pt-5 flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Generadas</span>
                    <span className="text-2xl font-semibold tabular-nums text-[#0F6E56]">{genResult.generadas}</span>
                  </CardContent>
                </Card>
                <Card className="rounded-lg border-border shadow-none">
                  <CardContent className="pt-5 flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Fallidas</span>
                    <span className="text-2xl font-semibold tabular-nums text-destructive">{genResult.fallidas}</span>
                  </CardContent>
                </Card>
              </div>

              {/* Tabla por estudiante */}
              <Card className="rounded-lg border-border shadow-none overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Estudiante</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Resultado</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {genResult.resultados.map((r) => (
                        <tr key={r.estudianteId} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{r.nombre}</td>
                          <td className="px-4 py-3">
                            {r.generada
                              ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0F6E56]"><CheckCircle className="size-3.5" /> Generada</span>
                              : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive"><XCircle className="size-3.5" /> Fallida</span>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{r.error ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {genResult.generadas > 0 && (
                <div>
                  <Button variant="outline" onClick={handleDescargarZip} disabled={descargandoZip}>
                    {descargandoZip ? <><CircleNotch className="size-4 animate-spin" /> Preparando ZIP…</> : <><DownloadSimple className="size-4" /> Descargar ZIP</>}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Plantillas ─────────────────────────────────────────────────────── */}
      {tab === 'plantillas' && (
        <div className="flex flex-col gap-4">
          <Card className="rounded-lg border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Nueva plantilla</CardTitle>
              <CardDescription>
                Sube cualquier hoja de vida en Word o PDF. El sistema conservará su estilo y reconocerá automáticamente dónde ubicar los datos de cada estudiante.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-4">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div className="flex flex-col gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">No necesitas modificar el archivo</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Puedes cargarlo tal como lo recibiste. Se detectan nombre, contacto, perfil, experiencia, educación, habilidades e idiomas a partir del contenido y los títulos del documento.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {['{{FULL_NAME}}', '{{EMAIL}}', '{{PHONE}}', '{{PROFESSIONAL_TITLE}}', '{{PROFESSIONAL_SUMMARY}}', '{{EXPERIENCE}}', '{{EDUCATION}}', '{{SKILLS}}', '{{LANGUAGES}}'].map((campo) => (
                        <code key={campo} className="rounded-md border border-border/70 bg-background/80 px-2 py-1 text-[10px] font-semibold text-primary">
                          {campo}
                        </code>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Los marcadores son opcionales y solo sirven si deseas controlar una posición exacta. También se aceptan <code>{'{{NOMBRE_COMPLETO}}'}</code>, <code>{'{{CORREO}}'}</code> y <code>{'{{EXPERIENCIA}}'}</code>. Tamaño máximo: 10 MB.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCrearPlantilla} className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_80px_minmax(260px,1.4fr)_auto] lg:items-end">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pl-nombre" className="text-[11px] uppercase tracking-wider text-muted-foreground">Nombre *</label>
                  <Input id="pl-nombre" value={plNombre} onChange={(e) => setPlNombre(e.target.value)} placeholder="Ej: Institucional azul" disabled={creandoPlantilla} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pl-color" className="text-[11px] uppercase tracking-wider text-muted-foreground">Color primario</label>
                  <input id="pl-color" type="color" value={plColor} onChange={(e) => setPlColor(e.target.value)} disabled={creandoPlantilla}
                    className="h-9 w-16 rounded-md border border-input bg-background p-1 cursor-pointer" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pl-archivo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Plantilla Word o PDF *</label>
                  <input ref={plFileRef} id="pl-archivo" type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => { setPlArchivo(e.target.files?.[0] ?? null); setPlError(null); setPlSuccess(null) }} disabled={creandoPlantilla}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium" />
                </div>
                <Button type="submit" size="sm" disabled={creandoPlantilla}>
                  {creandoPlantilla ? <><CircleNotch className="size-3.5 animate-spin" /> Creando…</> : <><Plus className="size-3.5" /> Crear plantilla</>}
                </Button>
              </form>
              {plError && (
                <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{plError}</span>
                </div>
              )}
              {plSuccess && (
                <div role="status" className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                  <CheckCircle className="mt-0.5 size-4 shrink-0" /><span>{plSuccess}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {loadingPlantillas ? (
            <div className="flex items-center justify-center py-12">
              <PageSpinner />
              <span className="ml-2 text-sm text-muted-foreground">Cargando plantillas…</span>
            </div>
          ) : errorPlantillas ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <WarningCircle className="size-8 text-destructive" />
              <p className="text-sm text-destructive">{errorPlantillas}</p>
              <Button variant="outline" onClick={loadPlantillas}><ArrowsClockwise className="size-4" /> Reintentar</Button>
            </div>
          ) : plantillas.length === 0 ? (
            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="flex flex-col items-center gap-2 py-10">
                <Stack className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No hay plantillas registradas. Crea la primera arriba.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-lg border-border shadow-none overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Nombre</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Color</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Archivo</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Fecha</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {plantillas.map((pl) => (
                      <tr key={pl.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">{pl.nombre}</span>
                          {pl.predeterminada && <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 text-[10px] py-0 px-1.5">Predeterminada</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2">
                            <span className="size-4 rounded border border-border" style={{ backgroundColor: pl.colorPrimario }} aria-hidden="true" />
                            <span className="font-mono text-xs text-muted-foreground">{pl.colorPrimario}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="w-fit rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {pl.tipoArchivo ?? 'Sin archivo'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {pl.automatica
                                ? `Mapeo automático · ${pl.camposDetectados} datos`
                                : pl.camposDetectados > 0
                                  ? `${pl.camposDetectados} campos detectados`
                                  : pl.tieneHtml ? 'Plantilla oficial CAC' : 'Vista original'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{new Date(pl.createdAt).toLocaleDateString('es-CO')}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button type="button" onClick={() => handleVistaPrevia(pl)} title="Ver plantilla con datos de ejemplo" aria-label={`Vista previa de ${pl.nombre}`}
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
                              {previewLoading === pl.id ? <CircleNotch className="size-4 animate-spin" /> : <Eye className="size-4" />}
                            </button>
                            {!pl.predeterminada && (
                              <button type="button" onClick={() => handlePredeterminada(pl.id)} title="Marcar como predeterminada" aria-label={`Marcar ${pl.nombre} como predeterminada`}
                                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                                <Star className="size-4" />
                              </button>
                            )}
                            <button type="button" onClick={() => handleEliminarPlantilla(pl)} title="Eliminar" aria-label={`Eliminar ${pl.nombre}`}
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
            </Card>
          )}

          {previewUrl && typeof document !== 'undefined' && createPortal(
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-md sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label={`Vista previa de ${previewName}`}
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) closePreview()
              }}
            >
              <div className="flex h-[min(86dvh,800px)] w-[min(94vw,980px)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-background shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
                <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">Vista previa · {previewName}</p>
                    <p className="text-xs text-muted-foreground">Documento combinado con datos ficticios</p>
                  </div>
                  <button type="button" onClick={closePreview} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Cerrar vista previa">
                    <X className="size-5" />
                  </button>
                </div>
                <iframe
                  src={`${previewUrl}#view=FitH`}
                  title={`Vista previa de ${previewName}`}
                  className="min-h-0 w-full flex-1 border-0 bg-slate-200"
                />
              </div>
            </div>,
            document.body,
          )}
        </div>
      )}

      {/* ── Extracción y Conversión a Plantilla CAC ───────────────────────── */}
      {tab === 'extraccion' && (
        <div className="flex flex-col gap-4">
          <Card className="rounded-lg border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Conversión de PDF a Plantilla CAC ATS</CardTitle>
              <CardDescription>Sube cualquier hoja de vida en PDF para extraer sus datos automáticamente y generarla en la plantilla oficial CAC ATS sin guardar estudiantes en la BD.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="ext-archivo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Archivo PDF</label>
                <input ref={extFileRef} id="ext-archivo" type="file" accept=".pdf" onChange={(e) => { setExtArchivo(e.target.files?.[0] ?? null); setCampos([]); setDatosExt(null); setExtError(null) }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium" disabled={extrayendo} />
              </div>
              <Button onClick={handleExtraer} disabled={extrayendo || !extArchivo}>
                {extrayendo ? <><CircleNotch className="size-4 animate-spin" /> Procesando PDF…</> : <><UploadSimple className="size-4" /> Extraer y Mapear a CAC</>}
              </Button>
            </CardContent>
          </Card>

          {extError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{extError}</span>
            </div>
          )}

          {datosExt && (
            <div className="flex flex-col gap-4">
              {/* Barra superior de idioma y descarga */}
              <Card className="rounded-lg border-border shadow-none bg-secondary/20">
                <CardContent className="pt-4 pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Globe className="size-4 text-primary" /> Idioma del PDF:
                    </span>
                    <div className="inline-flex rounded-lg border border-border p-0.5 bg-background gap-0.5">
                      <button
                        type="button"
                        onClick={() => setExtIdioma('es')}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          extIdioma === 'es' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        🇪🇸 Español (ES)
                      </button>
                      <button
                        type="button"
                        onClick={() => setExtIdioma('en')}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          extIdioma === 'en' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        🇬🇧 Inglés (EN)
                      </button>
                    </div>
                  </div>

                  <Button onClick={handleConvertirPdf} disabled={convertiendo}>
                    {convertiendo ? <><CircleNotch className="size-4 animate-spin" /> Generando PDF…</> : <><DownloadSimple className="size-4" /> Generar / Descargar PDF CAC ATS</>}
                  </Button>
                </CardContent>
              </Card>

              {/* Formulario editable de la Plantilla CAC */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Datos personales */}
                <Card className="rounded-lg border-border shadow-none">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">1. Datos Personales y Contacto</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-semibold">Nombre</label>
                        <Input value={datosExt.nombre ?? ''} onChange={(e) => setDatosExt({ ...datosExt, nombre: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-semibold">Apellido</label>
                        <Input value={datosExt.apellido ?? ''} onChange={(e) => setDatosExt({ ...datosExt, apellido: e.target.value })} className="h-8 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">Cargo Objetivo / Título</label>
                      <Input value={datosExt.cargoObjetivo ?? ''} onChange={(e) => setDatosExt({ ...datosExt, cargoObjetivo: e.target.value })} placeholder="Ej: Analista de Datos" className="h-8 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-semibold">Email</label>
                        <Input value={datosExt.email ?? ''} onChange={(e) => setDatosExt({ ...datosExt, email: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-semibold">Celular</label>
                        <Input value={datosExt.celular ?? ''} onChange={(e) => setDatosExt({ ...datosExt, celular: e.target.value })} className="h-8 text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-semibold">Ciudad</label>
                        <Input value={datosExt.ciudad ?? ''} onChange={(e) => setDatosExt({ ...datosExt, ciudad: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground font-semibold">LinkedIn User ID</label>
                        <Input value={datosExt.linkedinUserId ?? ''} onChange={(e) => setDatosExt({ ...datosExt, linkedinUserId: e.target.value })} placeholder="ej: usuario-linkedin" className="h-8 text-sm" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Perfil Profesional */}
                <Card className="rounded-lg border-border shadow-none">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">2. Perfil Profesional</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">Resumen del Perfil</label>
                      <Textarea
                        value={datosExt.perfilProfesional ?? ''}
                        onChange={(e) => setDatosExt({ ...datosExt, perfilProfesional: e.target.value })}
                        minRows={6}
                        className="w-full rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Descripción sintética del perfil laboral y competencias clave..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">Habilidades Técnicas / Competencias</label>
                      <Textarea
                        value={datosExt.competencias ?? ''}
                        onChange={(e) => setDatosExt({ ...datosExt, competencias: e.target.value })}
                        minRows={3}
                        className="w-full rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Tools: Excel, Python&#10;Soft skills: Liderazgo..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">Idiomas</label>
                      <Input value={datosExt.idiomas ?? ''} onChange={(e) => setDatosExt({ ...datosExt, idiomas: e.target.value })} placeholder="Ej: Español (Nativo) | Inglés B2" className="h-8 text-sm" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Experiencias Laborales */}
              <Card className="rounded-lg border-border shadow-none">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">3. Experiencia Profesional</CardTitle>
                    <CardDescription className="text-xs">Logros y puestos extraídos del PDF</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    const exps = [...(datosExt.experiencias ?? [])]
                    exps.push({ cargo: 'Nuevo Cargo', empresa: 'Nueva Empresa', fechaInicio: '2023-01-01', fechaFin: null, actual: true, funciones: '' })
                    setDatosExt({ ...datosExt, experiencias: exps })
                  }}>
                    <Plus className="size-3.5" /> Agregar experiencia
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {datosExt.experiencias?.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No se detectaron experiencias laborales automáticamente. Haz clic en "Agregar experiencia".</p>
                  ) : (
                    datosExt.experiencias?.map((exp, idx) => (
                      <div key={idx} className="flex flex-col gap-2 rounded-lg border border-border p-3 bg-secondary/10">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-primary">Experiencia #{idx + 1}</span>
                          <button type="button" onClick={() => {
                            const exps = datosExt.experiencias.filter((_, i) => i !== idx)
                            setDatosExt({ ...datosExt, experiencias: exps })
                          }} className="text-destructive hover:opacity-80">
                            <Trash className="size-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] uppercase text-muted-foreground font-semibold">Cargo</label>
                            <Input value={exp.cargo} onChange={(e) => {
                              const exps = [...datosExt.experiencias]
                              exps[idx] = { ...exps[idx], cargo: e.target.value }
                              setDatosExt({ ...datosExt, experiencias: exps })
                            }} className="h-8 text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-muted-foreground font-semibold">Empresa</label>
                            <Input value={exp.empresa} onChange={(e) => {
                              const exps = [...datosExt.experiencias]
                              exps[idx] = { ...exps[idx], empresa: e.target.value }
                              setDatosExt({ ...datosExt, experiencias: exps })
                            }} className="h-8 text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] uppercase text-muted-foreground font-semibold">Fecha Inicio</label>
                            <Input value={exp.fechaInicio ?? ''} onChange={(e) => {
                              const exps = [...datosExt.experiencias]
                              exps[idx] = { ...exps[idx], fechaInicio: e.target.value }
                              setDatosExt({ ...datosExt, experiencias: exps })
                            }} placeholder="YYYY-MM-DD" className="h-8 text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-muted-foreground font-semibold">Fecha Fin</label>
                            <Input value={exp.fechaFin ?? ''} onChange={(e) => {
                              const exps = [...datosExt.experiencias]
                              exps[idx] = { ...exps[idx], fechaFin: e.target.value, actual: !e.target.value }
                              setDatosExt({ ...datosExt, experiencias: exps })
                            }} placeholder="Presente o YYYY-MM-DD" className="h-8 text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase text-muted-foreground font-semibold">Logros / Funciones (una por línea)</label>
                          <Textarea
                            value={exp.funciones ?? ''}
                            onChange={(e) => {
                              const exps = [...datosExt.experiencias]
                              exps[idx] = { ...exps[idx], funciones: e.target.value }
                              setDatosExt({ ...datosExt, experiencias: exps })
                            }}
                            minRows={3}
                            className="w-full rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Educación y Certificaciones */}
              <Card className="rounded-lg border-border shadow-none">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">4. Educación y Certificaciones</CardTitle>
                    <CardDescription className="text-xs">Títulos académicos y cursos detectados</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    const fms = [...(datosExt.formaciones ?? [])]
                    fms.push({ tipo: 'CERTIFICACION', programa: 'Nueva Certificación / Curso', institucion: 'Institución', fechaFin: '2024' })
                    setDatosExt({ ...datosExt, formaciones: fms })
                  }}>
                    <Plus className="size-3.5" /> Agregar formación
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2 pb-2 border-b border-border">
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">Título Académico Principal</label>
                      <Input value={datosExt.titulo ?? ''} onChange={(e) => setDatosExt({ ...datosExt, titulo: e.target.value })} placeholder="Ej: Ingeniería de Sistemas" className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">Institución Principal</label>
                      <Input value={datosExt.institucionEducativa ?? ''} onChange={(e) => setDatosExt({ ...datosExt, institucionEducativa: e.target.value })} placeholder="Ej: Universidad del Norte" className="h-8 text-sm" />
                    </div>
                  </div>

                  {datosExt.formaciones?.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No se detectaron formaciones o certificaciones adicionales.</p>
                  ) : (
                    datosExt.formaciones?.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded-lg border border-border p-2 bg-secondary/10 text-sm">
                        <select value={f.tipo} onChange={(e) => {
                          const fms = [...datosExt.formaciones]
                          fms[idx] = { ...fms[idx], tipo: e.target.value }
                          setDatosExt({ ...datosExt, formaciones: fms })
                        }} className="h-8 text-xs rounded border border-input bg-background px-2">
                          <option value="EDUCACION">Educación</option>
                          <option value="CERTIFICACION">Certificación</option>
                          <option value="CURSO">Curso</option>
                          <option value="DIPLOMADO">Diplomado</option>
                        </select>
                        <Input value={f.programa} onChange={(e) => {
                          const fms = [...datosExt.formaciones]
                          fms[idx] = { ...fms[idx], programa: e.target.value }
                          setDatosExt({ ...datosExt, formaciones: fms })
                        }} placeholder="Programa" className="h-8 text-sm flex-1" />
                        <Input value={f.institucion} onChange={(e) => {
                          const fms = [...datosExt.formaciones]
                          fms[idx] = { ...fms[idx], institucion: e.target.value }
                          setDatosExt({ ...datosExt, formaciones: fms })
                        }} placeholder="Institución" className="h-8 text-sm flex-1" />
                        <Input value={f.fechaFin ?? ''} onChange={(e) => {
                          const fms = [...datosExt.formaciones]
                          fms[idx] = { ...fms[idx], fechaFin: e.target.value }
                          setDatosExt({ ...datosExt, formaciones: fms })
                        }} placeholder="Año" className="h-8 text-xs w-20" />
                        <button type="button" onClick={() => {
                          const fms = datosExt.formaciones.filter((_, i) => i !== idx)
                          setDatosExt({ ...datosExt, formaciones: fms })
                        }} className="text-destructive hover:opacity-80 p-1">
                          <Trash className="size-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}


      {/* ── Edición ───────────────────────────────────────────────────────── */}
      {tab === 'edicion' && (
        <div className="flex flex-col gap-4">
          <Card className="rounded-lg border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Edición de hoja de vida</CardTitle>
              <CardDescription>
                Selecciona un estudiante para analizar su perfil, completar campos faltantes y generar su HV con la plantilla CAC ATS.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Programa</label>
                  <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={editPrograma} onChange={(e) => { setEditPrograma(e.target.value); setEditEstudianteId(''); setAnalisis(null) }}>
                    <option value="">Selecciona un programa</option>
                    {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Estudiante</label>
                  <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={editEstudianteId} onChange={(e) => { setEditEstudianteId(e.target.value); setAnalisis(null) }} disabled={!editPrograma}>
                    <option value="">Selecciona un estudiante</option>
                    {editEstudiantes.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Button onClick={async () => {
                  if (!editEstudianteId) return
                  setAnalizando(true); setEditError(null); setAnalisis(null)
                  try {
                    const res = await hvApi.analizar(editEstudianteId)
                    setAnalisis(res)
                    const form: Record<string, string> = {}
                    for (const sec of res.secciones) {
                      for (const c of sec.campos) {
                        if (c.valorActual) form[c.placeholder] = c.valorActual
                      }
                    }
                    setEditFormData(form)
                  } catch (err) {
                    setEditError(errorDe(err, 'Error al analizar el perfil'))
                  } finally { setAnalizando(false) }
                }} disabled={analizando || !editEstudianteId}>
                  {analizando ? <><CircleNotch className="size-4 animate-spin" /> Analizando…</> : <><ListChecks className="size-4" /> Analizar perfil</>}
                </Button>
              </div>
              {editError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{editError}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {analisis && (
            <>
              {/* Barra de configuración de Idioma y descarga PDF */}
              <Card className="rounded-lg border-border shadow-none bg-secondary/20">
                <CardContent className="pt-4 pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Globe className="size-4 text-primary" /> Idioma del PDF:
                    </span>
                    <div className="inline-flex rounded-lg border border-border p-0.5 bg-background gap-0.5">
                      <button
                        type="button"
                        onClick={() => setEditIdioma('es')}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          editIdioma === 'es' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        🇪🇸 Español (ES)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditIdioma('en')}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          editIdioma === 'en' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        🇬🇧 Inglés (EN)
                      </button>
                    </div>
                  </div>

                  <Button onClick={async () => {
                    if (!editEstudianteId) return
                    setGenerandoEdit(true)
                    try {
                      const hv = await hvApi.generar(editEstudianteId, {
                        idioma: editIdioma,
                        seccionesExcluidas,
                        camposExcluidos,
                      })
                      const apNom = typeof analisis.datosEstudiante.nombre === 'string' ? analisis.datosEstudiante.nombre : 'estudiante'
                      await hvApi.descargarPdf(hv.id, `HV-${apNom}-${editIdioma.toUpperCase()}.pdf`)
                    } catch (err) {
                      setEditError(errorDe(err, 'Error al generar la HV'))
                    } finally { setGenerandoEdit(false) }
                  }} disabled={generandoEdit}>
                    {generandoEdit ? (
                      <><CircleNotch className="size-4 animate-spin" /> Generando PDF ({editIdioma === 'es' ? 'Español' : 'Inglés'})…</>
                    ) : (
                      <><FileText className="size-4" /> Generar y descargar PDF ({editIdioma === 'es' ? 'Español' : 'Inglés'})</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Vista previa: lo que se va a descargar, antes de descargarlo.
                  No registra una versión, así que se puede consultar tantas
                  veces como haga falta mientras se ajustan las secciones. */}
              <Card className="rounded-lg border-border shadow-none">
                <CardContent className="pt-5">
                  <VistaPreviaPdf
                    cargar={cargarPreviewEstudiante}
                    titulo="Vista previa de la hoja de vida"
                    descripcion="Refleja los datos guardados del estudiante. Las secciones que retires abajo se aplican al generar el PDF definitivo."
                    altura="38rem"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setRevisionPreview((n) => n + 1)}>
                      <ArrowsClockwise className="size-3.5" /> Volver a generar la vista previa
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Barra de progreso general */}
              <Card className="rounded-lg border-border shadow-none">
                <CardContent className="pt-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Completitud general</span>
                    <span className={`text-lg font-bold tabular-nums ${
                      analisis.porcentajeTotal >= 80 ? 'text-[#0F6E56]' : analisis.porcentajeTotal >= 50 ? 'text-navy-600' : 'text-destructive'
                    }`}>{analisis.porcentajeTotal}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${
                      analisis.porcentajeTotal >= 80 ? 'bg-success' : analisis.porcentajeTotal >= 50 ? 'bg-navy-400' : 'bg-destructive'
                    }`} style={{ width: `${analisis.porcentajeTotal}%` }} />
                  </div>
                </CardContent>
              </Card>

              {/* Secciones con controles (+) / (-) por sección y por campo */}
              {analisis.secciones.map((sec) => {
                const sectionKey = sec.id.toUpperCase()
                const estaExcluidaSec = seccionesExcluidas.includes(sectionKey)
                const esRepetible = ['experience', 'education', 'certifications', 'achievements', 'skills', 'languages'].includes(sec.id)
                const tituloEs = TITULOS_SECCIONES_ES[sec.titulo] || TITULOS_SECCIONES_ES[sec.id] || sec.titulo

                return (
                  <Card key={sec.id} className={`rounded-lg border-border shadow-none transition-colors ${estaExcluidaSec ? 'border-destructive/30 bg-destructive/5' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className={`text-sm ${estaExcluidaSec ? 'line-through text-muted-foreground' : ''}`}>
                            {tituloEs}
                          </CardTitle>
                          {estaExcluidaSec && (
                            <Badge className="bg-destructive/10 text-destructive border-none text-[10px]">
                              Sección retirada del PDF
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium tabular-nums ${
                            sec.porcentaje >= 80 ? 'text-[#0F6E56]' : sec.porcentaje >= 50 ? 'text-navy-600' : 'text-destructive'
                          }`}>{sec.camposCompletos}/{sec.camposTotales}</span>

                          {/* Botón icono (+) para agregar más elementos a esta sección */}
                          {esRepetible && !estaExcluidaSec && (
                            <button
                              type="button"
                              onClick={() => setModalAgregar(sec.id as any)}
                              className="inline-flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 transition-colors shadow-sm"
                              title={`Agregar más elementos a ${tituloEs} (+)`}
                            >
                              <Plus className="size-4" />
                            </button>
                          )}

                          {/* Botón icono (+/-) de alternancia para incluir/retirar la sección completa */}
                          <button
                            type="button"
                            onClick={() => toggleSeccion(sectionKey)}
                            className={`inline-flex size-7 items-center justify-center rounded-full transition-colors shadow-sm ${
                              estaExcluidaSec
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-400'
                            }`}
                            title={estaExcluidaSec ? `Incluir sección ${tituloEs} completa (+)` : `Retirar sección ${tituloEs} completa (-)`}
                          >
                            {estaExcluidaSec ? <Plus className="size-4" /> : <Minus className="size-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden mt-1.5">
                        <div className={`h-full rounded-full ${
                          sec.porcentaje >= 80 ? 'bg-success' : sec.porcentaje >= 50 ? 'bg-navy-400' : 'bg-destructive'
                        }`} style={{ width: `${sec.porcentaje}%` }} />
                      </div>
                    </CardHeader>

                    {!estaExcluidaSec && (
                      <CardContent className="flex flex-col gap-3">
                        {sec.campos.map((c) => {
                          const fieldKey = c.placeholder.toUpperCase()
                          const labelEs = ETIQUETAS_CAMPOS_ES[c.label] || ETIQUETAS_CAMPOS_ES[c.placeholder] || c.label
                          const estaExcluidoFld = camposExcluidos.includes(fieldKey) ||
                            (fieldKey === 'LINKEDIN_URL' && camposExcluidos.includes('LINKEDIN')) ||
                            (fieldKey === 'CITY_COUNTRY' && camposExcluidos.includes('CITY'))

                          return (
                            <div key={c.placeholder} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <span className={`size-2 rounded-full ${c.completo ? 'bg-success' : 'bg-destructive'}`} />
                                  <span className={estaExcluidoFld ? 'line-through text-muted-foreground' : ''}>{labelEs}</span>
                                  {c.fuente === 'manual' && <span className="text-[10px] text-navy-400">(manual)</span>}
                                  {estaExcluidoFld && <span className="text-[10px] font-semibold text-destructive ml-1">(Retirado)</span>}
                                </label>
                                {/* Botón icono (+/-) para incluir/retirar campo individual */}
                                <button
                                  type="button"
                                  onClick={() => toggleCampo(fieldKey)}
                                  className={`inline-flex size-6 items-center justify-center rounded-full transition-colors ${
                                    estaExcluidoFld
                                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                                      : 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-400'
                                  }`}
                                  title={estaExcluidoFld ? `Incluir campo ${labelEs} en el PDF (+)` : `Retirar campo ${labelEs} del PDF (-)`}
                                >
                                  {estaExcluidoFld ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
                                </button>
                              </div>
                              <Input
                                value={editFormData[c.placeholder] ?? c.valorActual ?? ''}
                                onChange={(e) => setEditFormData((prev) => ({ ...prev, [c.placeholder]: e.target.value }))}
                                placeholder={c.completo ? 'Completado automáticamente' : `Ingresa ${labelEs.toLowerCase()}`}
                                className={`h-8 text-sm transition-all ${
                                  estaExcluidoFld
                                    ? 'opacity-40 bg-secondary/50 line-through'
                                    : (!c.completo ? 'border-destructive/50' : '')
                                }`}
                                disabled={estaExcluidoFld}
                              />
                            </div>
                          )
                        })}
                      </CardContent>
                    )}
                  </Card>
                )
              })}

              {/* Modal emergente para agregar un nuevo elemento (Experiencia / Educación / Certificación / Skills / Idiomas) */}
              {modalAgregar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
                  <Card className="w-full max-w-md bg-background shadow-lg rounded-xl border border-border">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-base">
                        {modalAgregar === 'experience'
                          ? 'Agregar Experiencia Laboral'
                          : modalAgregar === 'skills'
                          ? 'Agregar Habilidad Técnica / Competencia'
                          : modalAgregar === 'languages'
                          ? 'Agregar Idioma y Nivel'
                          : 'Agregar Formación / Certificación'}
                      </CardTitle>
                      <button
                        type="button"
                        onClick={() => setModalAgregar(null)}
                        className="rounded-full p-1 text-muted-foreground hover:bg-secondary transition-colors"
                      >
                        <X className="size-4" />
                      </button>
                    </CardHeader>
                    <form onSubmit={handleGuardarNuevoItem}>
                      <CardContent className="flex flex-col gap-3">
                        {modalAgregar === 'experience' ? (
                          <>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-muted-foreground">Cargo *</label>
                              <Input
                                value={nuevoCargo}
                                onChange={(e) => setNuevoCargo(e.target.value)}
                                placeholder="Ej: Desarrollador Backend Junior"
                                className="h-8 text-sm"
                                required
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-muted-foreground">Empresa / Organización *</label>
                              <Input
                                value={nuevaEmpresa}
                                onChange={(e) => setNuevaEmpresa(e.target.value)}
                                placeholder="Ej: Tech Solutions S.A.S."
                                className="h-8 text-sm"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-muted-foreground">Fecha inicio</label>
                                <Input
                                  value={nuevaFechaInicio}
                                  onChange={(e) => setNuevaFechaInicio(e.target.value)}
                                  placeholder="Ej: Ene 2023"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-muted-foreground">Fecha fin</label>
                                <Input
                                  value={nuevaFechaFin}
                                  onChange={(e) => setNuevaFechaFin(e.target.value)}
                                  placeholder="Ej: Presente"
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-muted-foreground">Funciones / Logros</label>
                              <Textarea
                                value={nuevasFunciones}
                                onChange={(e) => setNuevasFunciones(e.target.value)}
                                placeholder="Describe tus responsabilidades y logros medibles"
                                className="min-h-[70px] w-full rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                          </>
                        ) : modalAgregar === 'skills' ? (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">Habilidad Técnica / Competencia *</label>
                            <Input
                              value={nuevaSkill}
                              onChange={(e) => setNuevaSkill(e.target.value)}
                              placeholder="Ej: Python, Docker, React, Análisis de Datos"
                              className="h-8 text-sm"
                              required
                            />
                          </div>
                        ) : modalAgregar === 'languages' ? (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">Idioma y Nivel *</label>
                            <Input
                              value={nuevoIdioma}
                              onChange={(e) => setNuevoIdioma(e.target.value)}
                              placeholder="Ej: Inglés (B2 Intermedio-Alto)"
                              className="h-8 text-sm"
                              required
                            />
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-muted-foreground">Tipo de Formación</label>
                              <select
                                value={nuevoTipoFormacion}
                                onChange={(e) => setNuevoTipoFormacion(e.target.value)}
                                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                              >
                                <option value="CERTIFICACION">Certificación</option>
                                <option value="CURSO">Curso</option>
                                <option value="DIPLOMADO">Diplomado</option>
                                <option value="UNIVERSITARIA">Universitaria / Pregrado</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-muted-foreground">Programa / Certificado *</label>
                              <Input
                                value={nuevoPrograma}
                                onChange={(e) => setNuevoPrograma(e.target.value)}
                                placeholder="Ej: AWS Certified Cloud Practitioner"
                                className="h-8 text-sm"
                                required
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-muted-foreground">Institución *</label>
                              <Input
                                value={nuevaInstitucion}
                                onChange={(e) => setNuevaInstitucion(e.target.value)}
                                placeholder="Ej: Amazon Web Services / Universidad"
                                className="h-8 text-sm"
                                required
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-muted-foreground">Año / Fecha de obtención</label>
                              <Input
                                value={nuevaFechaFin}
                                onChange={(e) => setNuevaFechaFin(e.target.value)}
                                placeholder="Ej: 2024"
                                className="h-8 text-sm"
                              />
                            </div>
                          </>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setModalAgregar(null)}
                            className="h-8 text-xs"
                          >
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={guardandoItem} className="h-8 text-xs">
                            {guardandoItem ? <><CircleNotch className="size-3.5 animate-spin" /> Guardando…</> : 'Guardar y agregar'}
                          </Button>
                        </div>
                      </CardContent>
                    </form>
                  </Card>
                </div>
              )}

              {/* Recomendaciones */}
              {analisis.recomendaciones.length > 0 && (
                <Card className="rounded-lg border-border shadow-none">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <WarningCircle className="size-4 text-navy-400" /> Recomendaciones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col gap-2">
                      {analisis.recomendaciones.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-1 size-1.5 rounded-full bg-navy-400 shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
