'use client'

/**
 * Hoja de vida del estudiante: los datos completos y su previsualización.
 *
 * <p>Antes esta pantalla solo resumía cuatro campos del perfil y ofrecía un
 * botón de descarga. Todo lo que da cuerpo a una hoja de vida —experiencia,
 * educación, certificaciones, habilidades— vivía en endpoints que únicamente
 * podía tocar un coordinador, así que el PDF salía con la mitad de las
 * secciones vacías. Aquí el estudiante mantiene su propia información y ve el
 * resultado antes de descargarlo.
 *
 * Consume:
 *   GET  /api/v1/estudiantes/mi-perfil
 *   PUT  /api/v1/estudiantes/mi-perfil
 *   GET  /api/v1/estudiantes/mi-perfil/hv-vista-previa
 *   GET  /api/v1/estudiantes/mi-perfil/hv-pdf
 *   CRUD /api/v1/estudiantes/{id}/experiencias
 *   CRUD /api/v1/estudiantes/{id}/formaciones
 */

import { useCallback, useEffect, useState } from 'react'
import { BriefcaseIcon as Briefcase, CheckIcon as Check, CircleNotchIcon as CircleNotch, GraduationCapIcon as GraduationCap, PlusIcon as Plus, TrashIcon as Trash, UserIcon as User, WarningCircleIcon as WarningCircle, XIcon as X } from '@phosphor-icons/react'
import { ApiCallError, estudiantesApi, hvApi, perfilApi } from '@/lib/api'
import type {
  EstudianteRequest,
  EstudianteResponse,
  ExperienciaRequest,
  ExperienciaResponse,
  FormacionRequest,
  FormacionResponse,
  PlantillaResponse,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { usePreferences } from '@/lib/preferences'
import { Campo, Selector, Aviso } from '@/components/ui/campo'
import { VistaPreviaPdf } from '@/components/ui/vista-previa-pdf'
import { useConfirmar } from '@/components/ui/confirmar'

/**
 * Los textos de esta pantalla, en los dos idiomas.
 *
 * Cada subcomponente del archivo la llama por su cuenta en vez de recibir los
 * textos como propiedad: son cuatro niveles y enhebrar una prop por todos
 * ellos solo para traducir es mas ruido que provecho.
 */
export function textosHv(english: boolean) {
  return english
    ? {
        todaviaNoHas: 'You have not added any experience yet. If you have never worked, you can leave it empty: the section will not appear in the PDF.',
        empiezaPorEl: 'Start with the most recent job. Each line of duties comes out as a bullet.',
        completaElCargo: 'Fill in the target role and the professional summary: they are the first thing a recruiter reads.',
        eligeElDiseno: 'Choose the design and language of your résumé. Your choice is saved automatically.',
        anadeAquiLos: 'Add here the courses and certificates you have taken, inside or outside the programme.',
        estoEsLo: 'This is what appears in the header and the professional summary of the PDF.',
        datosGuardadosActualiza: 'Details saved. Refresh the preview to see them in the PDF.',
        experienciaRelacionadaCon: 'Experience related to my profile / degree',
        educacionYCertificaciones: 'Education and certificates',
        datosDeTu: 'Your résumé details',
        sigoTrabajandoAqui: 'I still work here',
        disenoDePlantilla: 'Template design',
        idiomaDelPdf: 'PDF language',
        eliminarCorto: 'Delete',
        eliminarExperienciaTitulo: 'Delete this experience?',
        eliminarFormacionTitulo: 'Delete this education record?',
        seEliminaraExperiencia: (c: string) => `“${c}” will be removed from your résumé. This cannot be undone.`,
        seEliminaraFormacion: (p: string) => `“${p}” will be removed from your résumé. This cannot be undone.`,
        anadir: 'Add',
        editar: 'Edit',
        opcionalApareceComo: 'Optional. Shows as “Portfolio” next to your contact details.',
        describeTuExperiencia: 'Describe your experience, your strengths and your career goal…',
        unaPorLinea: 'One per line, or separated by commas. You can group them as “Office: Excel, Word”.',
        ejemploCompetencias: 'Advanced Excel\nCustomer service\nLanguages: English B2',
        tuNivelDe: 'Your recorded English level is added automatically if you do not mention it here.',
        unaPorLineaVerbo: 'One per line. Start with a verb: “Handled…”, “Coordinated…”.',
        ejemploLogros: 'Handled around 60 customers a day\nTrained 4 new team members',
        quinceDias: '15 days',
        treintaDias: '30 days',
        sesentaDias: '60 days',

        educacionFormal: 'Formal education', curso: 'Course', certificacion: 'Certificate',
        inmediata: 'Immediate', noDisponible: 'Not available',
        perfilProfesional: 'Professional summary',
        perfilAyuda: 'Three or four lines: what you can do and what you are looking for.',
        perfilPie: 'It is the headline shown under your name.',
        cargoObjetivo: 'Target role', habilidades: 'Skills and competencies',
        idiomas: 'Languages', idiomasEjemplo: 'Native Spanish, English B2',
        celular: 'Mobile / WhatsApp', ciudad: 'City of residence', ciudadEjemplo: 'Barranquilla',
        ciudadPie: 'It appears on the contact line.',
        pais: 'Country', paisPie: 'If you leave it empty only the city is printed.',
        linkedin: 'LinkedIn link', portafolio: 'Portfolio or work folder',
        disponibilidad: 'Availability', nivelEducativo: 'Education level',
        nivelEducativoEjemplo: 'Technical, Technologist, Professional\u2026',
        tituloPrincipal: 'Main academic qualification',
        tituloEjemplo: 'Systems Technician',
        guardarDatos: 'Save details', guardarCambios: 'Save changes', guardando: 'Saving\u2026',
        anadirExperiencia: 'Add experience', anadirFormacion: 'Add education',
        empresa: 'Company', cargo: 'Role', cargoEjemplo: 'Data analyst',
        funciones: 'Duties and achievements',
        funcionesAyuda: 'One per line. Start with a verb.',
        fechaInicio: 'Start date', fechaFin: 'End date', fechaFinalizacion: 'Completion date',
        empleoActual: 'Not applicable: this is your current job.',
        institucion: 'Institution', institucionEducativa: 'Educational institution',
        programa: 'Programme or course name',
        selecciona: 'Choose\u2026', cargando: 'Loading\u2026',
        vistaPrevia: 'Preview of your r\u00e9sum\u00e9', comoQueda: 'How it will look',
        descargarAviso: 'Downloading saves a new version in your history.',
        anoImpreso: 'This is where the printed year comes from.',
        errorExperiencia: 'Company and role are required.',
        errorFormacion: 'Institution and programme are required.',
        errorConexion: 'Could not reach the server.',
      }
    : {
        todaviaNoHas: 'Todavía no has registrado experiencia. Si nunca has trabajado, puedes dejarlo vacío: la sección no aparecerá en el PDF.',
        empiezaPorEl: 'Empieza por el empleo más reciente. Cada línea de funciones sale como una viñeta.',
        completaElCargo: 'Completa el cargo objetivo y el perfil profesional: son lo primero que lee un reclutador.',
        eligeElDiseno: 'Elige el diseño y el idioma de tu hoja de vida. Tu selección se guardará automáticamente.',
        anadeAquiLos: 'Añade aquí los cursos y certificaciones que hayas hecho, dentro o fuera del programa.',
        estoEsLo: 'Esto es lo que aparece en la cabecera y en el perfil profesional del PDF.',
        datosGuardadosActualiza: 'Datos guardados. Actualiza la vista previa para verlos en el PDF.',
        experienciaRelacionadaCon: 'Experiencia relacionada con mi perfil / carrera',
        educacionYCertificaciones: 'Educación y certificaciones',
        datosDeTu: 'Datos de tu hoja de vida',
        sigoTrabajandoAqui: 'Sigo trabajando aquí',
        disenoDePlantilla: 'Diseño de plantilla',
        idiomaDelPdf: 'Idioma del PDF',
        eliminarCorto: 'Eliminar',
        eliminarExperienciaTitulo: '¿Eliminar esta experiencia?',
        eliminarFormacionTitulo: '¿Eliminar esta formación?',
        seEliminaraExperiencia: (c: string) => `«${c}» saldrá de tu hoja de vida. No se puede deshacer.`,
        seEliminaraFormacion: (p: string) => `«${p}» saldrá de tu hoja de vida. No se puede deshacer.`,
        anadir: 'Añadir',
        editar: 'Editar',
        opcionalApareceComo: 'Opcional. Aparece como «Portafolio» junto a tus datos de contacto.',
        describeTuExperiencia: 'Describe tu experiencia, tus fortalezas y tu objetivo profesional…',
        unaPorLinea: 'Una por línea, o separadas por comas. Puedes agrupar con «Ofimática: Excel, Word».',
        ejemploCompetencias: 'Excel avanzado\nAtención al cliente\nIdiomas: inglés B2',
        tuNivelDe: 'Tu nivel de inglés registrado se añade solo si no lo mencionas aquí.',
        unaPorLineaVerbo: 'Una por línea. Empieza con un verbo: «Atendí…», «Coordiné…».',
        ejemploLogros: 'Atendí en promedio 60 clientes diarios\nCapacité a 4 personas nuevas del equipo',
        quinceDias: '15 días',
        treintaDias: '30 días',
        sesentaDias: '60 días',

        educacionFormal: 'Educaci\u00f3n formal', curso: 'Curso', certificacion: 'Certificaci\u00f3n',
        inmediata: 'Inmediata', noDisponible: 'No disponible',
        perfilProfesional: 'Perfil profesional',
        perfilAyuda: 'Tres o cuatro l\u00edneas: qu\u00e9 sabes hacer y qu\u00e9 buscas.',
        perfilPie: 'Es el titular que se lee bajo tu nombre.',
        cargoObjetivo: 'Cargo objetivo', habilidades: 'Habilidades y competencias',
        idiomas: 'Idiomas', idiomasEjemplo: 'Espa\u00f1ol nativo, Ingl\u00e9s B2',
        celular: 'Celular / WhatsApp', ciudad: 'Ciudad de residencia', ciudadEjemplo: 'Barranquilla',
        ciudadPie: 'Sale en la l\u00ednea de contacto.',
        pais: 'Pa\u00eds', paisPie: 'Si lo dejas vac\u00edo solo se imprime la ciudad.',
        linkedin: 'Enlace de LinkedIn', portafolio: 'Portafolio o carpeta de trabajos',
        disponibilidad: 'Disponibilidad laboral', nivelEducativo: 'Nivel educativo',
        nivelEducativoEjemplo: 'T\u00e9cnico, Tecn\u00f3logo, Profesional\u2026',
        tituloPrincipal: 'T\u00edtulo acad\u00e9mico principal',
        tituloEjemplo: 'T\u00e9cnico en Sistemas',
        guardarDatos: 'Guardar datos', guardarCambios: 'Guardar cambios', guardando: 'Guardando\u2026',
        anadirExperiencia: 'A\u00f1adir experiencia', anadirFormacion: 'A\u00f1adir formaci\u00f3n',
        empresa: 'Empresa', cargo: 'Cargo', cargoEjemplo: 'Analista de datos',
        funciones: 'Funciones y logros',
        funcionesAyuda: 'Una por l\u00ednea. Empieza con un verbo.',
        fechaInicio: 'Fecha de inicio', fechaFin: 'Fecha de fin', fechaFinalizacion: 'Fecha de finalizaci\u00f3n',
        empleoActual: 'No aplica: es tu empleo actual.',
        institucion: 'Instituci\u00f3n', institucionEducativa: 'Instituci\u00f3n educativa',
        programa: 'Programa o nombre del curso',
        selecciona: 'Selecciona\u2026', cargando: 'Cargando\u2026',
        vistaPrevia: 'Vista previa de tu hoja de vida', comoQueda: 'C\u00f3mo va a quedar',
        descargarAviso: 'Descargar guarda una versi\u00f3n nueva en tu historial.',
        anoImpreso: 'De aqu\u00ed sale el a\u00f1o que se imprime.',
        errorExperiencia: 'La empresa y el cargo son obligatorios.',
        errorFormacion: 'La instituci\u00f3n y el programa son obligatorios.',
        errorConexion: 'No se pudo conectar con el servidor.',
      }
}

export type TextosHv = ReturnType<typeof textosHv>

/** Tipos de formación que entiende el generador de la plantilla CAC. */
const tiposFormacion = (T: TextosHv) => [
  { valor: 'EDUCACION', etiqueta: T.educacionFormal },
  { valor: 'CURSO', etiqueta: T.curso },
  { valor: 'CERTIFICACION', etiqueta: T.certificacion },
]

const disponibilidades = (T: TextosHv) => [
  { valor: 'INMEDIATA', etiqueta: T.inmediata },
  { valor: '15_DIAS', etiqueta: T.quinceDias },
  { valor: '30_DIAS', etiqueta: T.treintaDias },
  { valor: '60_DIAS', etiqueta: T.sesentaDias },
  { valor: 'NO_DISPONIBLE', etiqueta: T.noDisponible },
]

/** @param respaldo texto para cuando el error no trae mensaje propio. */
function mensajeDe(error: unknown, respaldo: string): string {
  if (error instanceof ApiCallError) {
    return error.body.message ?? `Error del servidor (HTTP ${error.status}).`
  }
  return error instanceof Error ? error.message : respaldo
}

// ── Datos personales y profesionales ────────────────────────────────────────

type CamposHv = {
  celular: string
  ciudad: string
  nacionalidad: string
  direccion: string
  cargoObjetivo: string
  perfilProfesional: string
  competencias: string
  idiomas: string
  disponibilidadLaboral: string
  linkedinUrl: string
  carpetaUrl: string
  titulo: string
  institucionEducativa: string
  nivelEducativo: string
}

function camposDe(p: EstudianteResponse): CamposHv {
  return {
    celular: p.celular ?? '',
    ciudad: p.ciudad ?? '',
    nacionalidad: p.nacionalidad ?? '',
    direccion: p.direccion ?? '',
    cargoObjetivo: p.cargoObjetivo ?? '',
    perfilProfesional: p.perfilProfesional ?? '',
    competencias: p.competencias ?? '',
    idiomas: p.idiomas ?? '',
    disponibilidadLaboral: p.disponibilidadLaboral ?? '',
    linkedinUrl: p.linkedinUrl ?? '',
    carpetaUrl: p.carpetaUrl ?? '',
    titulo: p.titulo ?? '',
    institucionEducativa: p.institucionEducativa ?? '',
    nivelEducativo: p.nivelEducativo ?? '',
  }
}

function DatosHv({
  perfil,
  onUpdate,
  onGuardado,
}: {
  perfil: EstudianteResponse
  onUpdate: (p: EstudianteResponse) => void
  onGuardado: () => void
}) {
  const T = textosHv(usePreferences().locale === 'en')
  const [form, setForm] = useState<CamposHv>(() => camposDe(perfil))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const cambiar = (clave: keyof CamposHv, valor: string) => {
    setForm((actual) => ({ ...actual, [clave]: valor }))
    setOk(false)
  }

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    setOk(false)
    try {
      // Los campos nulos no se tocan en el backend, así que se mandan como
      // `undefined` cuando están vacíos y no se borra lo que haya puesto el
      // coordinador desde su lado.
      const body: EstudianteRequest = {
        nombre: perfil.nombre,
        apellido: perfil.apellido,
        email: perfil.email,
        programaId: perfil.programaId,
        ...Object.fromEntries(
          Object.entries(form).map(([clave, valor]) => [clave, valor.trim() || undefined]),
        ),
      } as EstudianteRequest
      const actualizado = await estudiantesApi.actualizarMiPerfil(body)
      onUpdate(actualizado)
      setForm(camposDe(actualizado))
      setOk(true)
      onGuardado()
    } catch (e) {
      setError(mensajeDe(e, T.errorConexion))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-5 text-primary" weight="duotone" />
          {T.datosDeTu}
        </CardTitle>
        <CardDescription>
          {T.estoEsLo}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={T.celular} ayuda={T.ciudadPie}>
            <Input
              type="tel"
              placeholder="+57 300 000 0000"
              value={form.celular}
              onChange={(e) => cambiar('celular', e.target.value)}
            />
          </Campo>

          <Campo etiqueta={T.ciudad}>
            <Input
              placeholder={T.ciudadEjemplo}
              value={form.ciudad}
              onChange={(e) => cambiar('ciudad', e.target.value)}
            />
          </Campo>

          <Campo etiqueta={T.pais} ayuda={T.paisPie}>
            <Input
              placeholder="Colombia"
              value={form.nacionalidad}
              onChange={(e) => cambiar('nacionalidad', e.target.value)}
            />
          </Campo>

          <Campo etiqueta={T.disponibilidad}>
            <Selector
              value={form.disponibilidadLaboral}
              onChange={(valor) => cambiar('disponibilidadLaboral', valor)}
              opciones={disponibilidades(T)}
              vacio={T.selecciona}
            />
          </Campo>

          <Campo etiqueta={T.linkedin} ancho>
            <Input
              type="url"
              placeholder="https://www.linkedin.com/in/tu-perfil"
              value={form.linkedinUrl}
              onChange={(e) => cambiar('linkedinUrl', e.target.value)}
            />
          </Campo>

          <Campo
            etiqueta={T.portafolio}
            ancho
            ayuda={T.opcionalApareceComo}
          >
            <Input
              type="url"
              placeholder="https://…"
              value={form.carpetaUrl}
              onChange={(e) => cambiar('carpetaUrl', e.target.value)}
            />
          </Campo>

          <Campo etiqueta={T.cargoObjetivo} ancho requerido ayuda={T.perfilPie}>
            <Input
              placeholder={T.cargoEjemplo}
              value={form.cargoObjetivo}
              onChange={(e) => cambiar('cargoObjetivo', e.target.value)}
            />
          </Campo>

          <Campo
            etiqueta={T.perfilProfesional}
            ancho
            requerido
            ayuda={T.perfilAyuda}
          >
            <Textarea
              minRows={4}
              placeholder={T.describeTuExperiencia}
              value={form.perfilProfesional}
              onChange={(e) => cambiar('perfilProfesional', e.target.value)}
            />
          </Campo>

          <Campo
            etiqueta={T.habilidades}
            ancho
            ayuda={T.unaPorLinea}
          >
            <Textarea
              minRows={3}
              placeholder={T.ejemploCompetencias}
              value={form.competencias}
              onChange={(e) => cambiar('competencias', e.target.value)}
            />
          </Campo>

          <Campo etiqueta={T.idiomas} ancho ayuda={T.tuNivelDe}>
            <Input
              placeholder={T.idiomasEjemplo}
              value={form.idiomas}
              onChange={(e) => cambiar('idiomas', e.target.value)}
            />
          </Campo>

          <Campo etiqueta={T.tituloPrincipal}>
            <Input
              placeholder={T.tituloEjemplo}
              value={form.titulo}
              onChange={(e) => cambiar('titulo', e.target.value)}
            />
          </Campo>

          <Campo etiqueta={T.institucionEducativa}>
            <Input
              placeholder="SENA"
              value={form.institucionEducativa}
              onChange={(e) => cambiar('institucionEducativa', e.target.value)}
            />
          </Campo>

          <Campo etiqueta={T.nivelEducativo} ancho>
            <Input
              placeholder={T.nivelEducativoEjemplo}
              value={form.nivelEducativo}
              onChange={(e) => cambiar('nivelEducativo', e.target.value)}
            />
          </Campo>
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">{T.datosGuardadosActualiza}</Aviso>}

        <div className="flex justify-end">
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? <CircleNotch className="size-4 animate-spin" /> : <Check className="size-4" />}
            {guardando ? T.guardando : T.guardarDatos}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Experiencia laboral ─────────────────────────────────────────────────────

const EXPERIENCIA_VACIA: ExperienciaRequest = {
  empresa: '',
  cargo: '',
  ciudad: '',
  fechaInicio: '',
  fechaFin: '',
  funciones: '',
  actual: false,
  relacionada: false,
}

function Experiencias({
  estudianteId,
  onCambio,
}: {
  estudianteId: string
  onCambio: () => void
}) {
  const T = textosHv(usePreferences().locale === 'en')
  const { confirmar, dialogo } = useConfirmar()
  const [items, setItems] = useState<ExperienciaResponse[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState<ExperienciaRequest>(EXPERIENCIA_VACIA)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setCargando(true)
    try {
      setItems(await perfilApi.experiencias(estudianteId))
    } catch (e) {
      setError(mensajeDe(e, T.errorConexion))
    } finally {
      setCargando(false)
    }
  }, [estudianteId])

  useEffect(() => {
    void recargar()
  }, [recargar])

  const cerrar = () => {
    setForm(EXPERIENCIA_VACIA)
    setEditandoId(null)
    setAbierto(false)
    setError(null)
  }

  const editar = (item: ExperienciaResponse) => {
    setForm({
      empresa: item.empresa,
      cargo: item.cargo,
      ciudad: item.ciudad ?? '',
      fechaInicio: item.fechaInicio ?? '',
      fechaFin: item.fechaFin ?? '',
      funciones: item.funciones ?? '',
      actual: item.actual,
      relacionada: item.relacionada,
    })
    setEditandoId(item.id)
    setAbierto(true)
  }

  const guardar = async () => {
    if (!form.empresa.trim() || !form.cargo.trim()) {
      setError(T.errorExperiencia)
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const body: ExperienciaRequest = {
        ...form,
        empresa: form.empresa.trim(),
        cargo: form.cargo.trim(),
        fechaInicio: form.fechaInicio || undefined,
        // Un empleo actual no lleva fecha de fin: si el estudiante marca la
        // casilla después de haberla escrito, mandarla haría que el PDF
        // imprimiera un rango cerrado y «Presente» a la vez.
        fechaFin: form.actual ? undefined : form.fechaFin || undefined,
        funciones: form.funciones?.trim() || undefined,
      }
      if (editandoId) await perfilApi.actualizarExperiencia(estudianteId, editandoId, body)
      else await perfilApi.crearExperiencia(estudianteId, body)
      cerrar()
      await recargar()
      onCambio()
    } catch (e) {
      setError(mensajeDe(e, T.errorConexion))
    } finally {
      setGuardando(false)
    }
  }

  /**
   * Borra una experiencia, preguntando primero.
   *
   * Es la hoja de vida de quien mira y no hay deshacer: un clic de mas borraba
   * lo que habia escrito. En el resto de la aplicacion todo borrado confirma;
   * este era el unico que no.
   */
  const eliminar = async (item: { id: string; cargo: string }) => {
    if (!(await confirmar({
      titulo: T.eliminarExperienciaTitulo,
      descripcion: T.seEliminaraExperiencia(item.cargo),
      textoConfirmar: T.eliminarCorto,
      destructivo: true,
    }))) return
    setError(null)
    try {
      await perfilApi.eliminarExperiencia(estudianteId, item.id)
      await recargar()
      onCambio()
    } catch (e) {
      setError(mensajeDe(e, T.errorConexion))
    }
  }

  return (
    <>
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="size-5 text-primary" weight="duotone" />
            Experiencia laboral
          </CardTitle>
          <CardDescription>
            {T.empiezaPorEl}
          </CardDescription>
        </div>
        {!abierto && (
          <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
            <Plus className="size-4" /> {T.anadir}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Aviso tipo="error">{error}</Aviso>}

        {abierto && (
          <div className="grid gap-4 rounded-xl border border-border bg-secondary/20 p-4 sm:grid-cols-2">
            <Campo etiqueta={T.empresa} requerido>
              <Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
            </Campo>
            <Campo etiqueta="Cargo" requerido>
              <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
            </Campo>
            <Campo etiqueta="Ciudad">
              <Input value={form.ciudad ?? ''} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} placeholder={T.ciudadEjemplo} />
            </Campo>
            <Campo etiqueta={T.fechaInicio}>
              <Input
                type="date"
                value={form.fechaInicio ?? ''}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
              />
            </Campo>
            <Campo etiqueta={T.fechaFin} ayuda={form.actual ? T.empleoActual : undefined}>
              <Input
                type="date"
                disabled={form.actual}
                value={form.actual ? '' : (form.fechaFin ?? '')}
                onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
              />
            </Campo>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={form.actual ?? false}
                  onChange={(e) => setForm({ ...form, actual: e.target.checked })}
                />
                {T.sigoTrabajandoAqui}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={form.relacionada ?? false}
                  onChange={(e) => setForm({ ...form, relacionada: e.target.checked })}
                />
                {T.experienciaRelacionadaCon}
              </label>
            </div>
            <Campo
              etiqueta={T.funciones}
              ancho
              ayuda={T.unaPorLineaVerbo}
            >
              <Textarea
                minRows={4}
                value={form.funciones ?? ''}
                onChange={(e) => setForm({ ...form, funciones: e.target.value })}
                placeholder={T.ejemploLogros}
              />
            </Campo>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="outline" onClick={cerrar} disabled={guardando}>
                <X className="size-4" /> Cancelar
              </Button>
              <Button onClick={guardar} disabled={guardando}>
                {guardando ? <CircleNotch className="size-4 animate-spin" /> : <Check className="size-4" />}
                {editandoId ? T.guardarCambios : T.anadirExperiencia}
              </Button>
            </div>
          </div>
        )}

        {cargando ? (
          <p className="text-sm text-muted-foreground">{T.cargando}</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            {T.todaviaNoHas}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.cargo}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.empresa}
                      {item.fechaInicio ? ` · ${item.fechaInicio}` : ''}
                      {item.actual ? ' — Presente' : item.fechaFin ? ` — ${item.fechaFin}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => editar(item)}>
                      {T.editar}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void eliminar(item)}>
                      <Trash className="size-4 text-destructive" />
                      <span className="sr-only">{T.eliminarCorto} {item.cargo}</span>
                    </Button>
                  </div>
                </div>
                {item.funciones && (
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{item.funciones}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
    {dialogo}
    </>
  )
}

// ── Educación y certificaciones ─────────────────────────────────────────────

const FORMACION_VACIA: FormacionRequest = {
  tipo: 'CURSO',
  institucion: '',
  programa: '',
  fechaInicio: '',
  fechaFin: '',
  estado: '',
}

function Formaciones({
  estudianteId,
  onCambio,
}: {
  estudianteId: string
  onCambio: () => void
}) {
  const T = textosHv(usePreferences().locale === 'en')
  const { confirmar, dialogo } = useConfirmar()
  const [items, setItems] = useState<FormacionResponse[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState<FormacionRequest>(FORMACION_VACIA)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setCargando(true)
    try {
      setItems(await perfilApi.formaciones(estudianteId))
    } catch (e) {
      setError(mensajeDe(e, T.errorConexion))
    } finally {
      setCargando(false)
    }
  }, [estudianteId])

  useEffect(() => {
    void recargar()
  }, [recargar])

  const cerrar = () => {
    setForm(FORMACION_VACIA)
    setEditandoId(null)
    setAbierto(false)
    setError(null)
  }

  const editar = (item: FormacionResponse) => {
    setForm({
      tipo: item.tipo,
      institucion: item.institucion,
      programa: item.programa,
      fechaInicio: item.fechaInicio ?? '',
      fechaFin: item.fechaFin ?? '',
      estado: item.estado ?? '',
    })
    setEditandoId(item.id)
    setAbierto(true)
  }

  const guardar = async () => {
    if (!form.institucion.trim() || !form.programa.trim()) {
      setError(T.errorFormacion)
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const body: FormacionRequest = {
        ...form,
        institucion: form.institucion.trim(),
        programa: form.programa.trim(),
        fechaInicio: form.fechaInicio || undefined,
        fechaFin: form.fechaFin || undefined,
        estado: form.estado?.trim() || undefined,
      }
      if (editandoId) await perfilApi.actualizarFormacion(estudianteId, editandoId, body)
      else await perfilApi.crearFormacion(estudianteId, body)
      cerrar()
      await recargar()
      onCambio()
    } catch (e) {
      setError(mensajeDe(e, T.errorConexion))
    } finally {
      setGuardando(false)
    }
  }

  /** Igual que en experiencias: sin deshacer, se pregunta antes. */
  const eliminar = async (item: { id: string; programa: string }) => {
    if (!(await confirmar({
      titulo: T.eliminarFormacionTitulo,
      descripcion: T.seEliminaraFormacion(item.programa),
      textoConfirmar: T.eliminarCorto,
      destructivo: true,
    }))) return
    setError(null)
    try {
      await perfilApi.eliminarFormacion(estudianteId, item.id)
      await recargar()
      onCambio()
    } catch (e) {
      setError(mensajeDe(e, T.errorConexion))
    }
  }

  return (
    <>
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" weight="duotone" />
            {T.educacionYCertificaciones}
          </CardTitle>
          <CardDescription>
            Lo marcado como curso o certificación va a su propia sección del PDF; el resto
            aparece bajo «Educación».
          </CardDescription>
        </div>
        {!abierto && (
          <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
            <Plus className="size-4" /> {T.anadir}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Aviso tipo="error">{error}</Aviso>}

        {abierto && (
          <div className="grid gap-4 rounded-xl border border-border bg-secondary/20 p-4 sm:grid-cols-2">
            <Campo etiqueta="Tipo" requerido>
              <Selector
                value={form.tipo}
                onChange={(valor) => setForm({ ...form, tipo: valor })}
                opciones={tiposFormacion(T)}
              />
            </Campo>
            <Campo etiqueta={T.institucion} requerido>
              <Input
                value={form.institucion}
                onChange={(e) => setForm({ ...form, institucion: e.target.value })}
              />
            </Campo>
            <Campo etiqueta={T.programa} ancho requerido>
              <Input value={form.programa} onChange={(e) => setForm({ ...form, programa: e.target.value })} />
            </Campo>
            <Campo etiqueta={T.fechaInicio}>
              <Input
                type="date"
                value={form.fechaInicio ?? ''}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
              />
            </Campo>
            <Campo etiqueta={T.fechaFinalizacion} ayuda={T.anoImpreso}>
              <Input
                type="date"
                value={form.fechaFin ?? ''}
                onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
              />
            </Campo>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="outline" onClick={cerrar} disabled={guardando}>
                <X className="size-4" /> Cancelar
              </Button>
              <Button onClick={guardar} disabled={guardando}>
                {guardando ? <CircleNotch className="size-4 animate-spin" /> : <Check className="size-4" />}
                {editandoId ? T.guardarCambios : T.anadirFormacion}
              </Button>
            </div>
          </div>
        )}

        {cargando ? (
          <p className="text-sm text-muted-foreground">{T.cargando}</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            {T.anadeAquiLos}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="font-semibold">{item.programa}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.institucion}
                    {item.fechaFin ? ` · ${item.fechaFin.slice(0, 4)}` : ''}
                    {` · ${tiposFormacion(T).find((t) => t.valor === item.tipo)?.etiqueta ?? item.tipo}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => editar(item)}>
                    {T.editar}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void eliminar(item)}>
                    <Trash className="size-4 text-destructive" />
                    <span className="sr-only">{T.eliminarCorto} {item.programa}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
    {dialogo}
    </>
  )
}

// ── Pantalla ────────────────────────────────────────────────────────────────

export function StudentHojaDeVida({
  perfil,
  onUpdate,
}: {
  perfil: EstudianteResponse
  onUpdate: (p: EstudianteResponse) => void
}) {
  const T = textosHv(usePreferences().locale === 'en')
  const [revision, setRevision] = useState(0)
  const [idioma, setIdioma] = useState<'es' | 'en'>('es')
  const [plantillas, setPlantillas] = useState<PlantillaResponse[]>([])
  const [plantillaId, setPlantillaId] = useState<string | undefined>(perfil.plantillaPreferidaId ?? undefined)
  const [errorPlantilla, setErrorPlantilla] = useState<string | null>(null)

  useEffect(() => {
    hvApi.plantillas().then((res) => {
      setPlantillas(res)
      if (!plantillaId && res.length > 0) {
        const pred = res.find((p) => p.predeterminada) ?? res[0]
        setPlantillaId(pred.id)
      }
    }).catch((e) => setErrorPlantilla(mensajeDe(e, T.errorConexion)))
  }, [plantillaId, T.errorConexion])

  /**
   * Guarda la plantilla elegida.
   *
   * Se marca antes de guardar para que la seleccion responda al instante, pero
   * si el servidor la rechaza hay que deshacerla: dejarla marcada sin haberse
   * guardado es peor que no marcarla, porque al volver aparece la anterior y
   * nada explica por que.
   */
  const seleccionarPlantilla = async (id: string) => {
    const anterior = plantillaId
    setPlantillaId(id)
    setErrorPlantilla(null)
    try {
      const nov = await estudiantesApi.guardarPlantillaPreferida(id)
      onUpdate(nov)
    } catch (e) {
      setPlantillaId(anterior)
      setErrorPlantilla(mensajeDe(e, T.errorConexion))
    }
  }

  const cargar = useCallback(
    () => estudiantesApi.vistaPreviaMiHv(idioma, plantillaId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idioma, plantillaId, revision],
  )

  const descargar = () =>
    estudiantesApi.descargarMiHvPdf(
      idioma,
      plantillaId,
      `HV-${perfil.nombre}-${perfil.apellido}.pdf`.replace(/[^\w.\-]/g, '_'),
    )

  const faltan = !perfil.cargoObjetivo || !perfil.perfilProfesional

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="space-y-5">
        {faltan && (
          <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <WarningCircle className="size-4 shrink-0" />
            {T.completaElCargo}
          </p>
        )}
        <DatosHv perfil={perfil} onUpdate={onUpdate} onGuardado={() => setRevision((n) => n + 1)} />
        <Experiencias estudianteId={perfil.id} onCambio={() => setRevision((n) => n + 1)} />
        <Formaciones estudianteId={perfil.id} onCambio={() => setRevision((n) => n + 1)} />
      </div>

      <Card className="h-fit shadow-none xl:sticky xl:top-24">
        <CardHeader>
          <CardTitle>{T.comoQueda}</CardTitle>
          <CardDescription>
            {T.eligeElDiseno}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plantillas.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {T.disenoDePlantilla}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {plantillas.map((p) => {
                  const sel = (plantillaId ?? perfil.plantillaPreferidaId) === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => seleccionarPlantilla(p.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        sel
                          ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-sm'
                          : 'border-border bg-background hover:bg-secondary text-foreground'
                      }`}
                    >
                      {p.nombre}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Fuera del bloque de arriba a proposito: si las plantillas no se
              pudieron cargar, ese bloque no se pinta y el aviso se habria ido
              con el, que es justo cuando hace falta. */}
          {errorPlantilla && <p className="text-xs text-destructive">{errorPlantilla}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {T.idiomaDelPdf}
            </label>
            <div className="flex gap-2">
              {(
                [
                  ['es', 'Español'],
                  ['en', 'English'],
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setIdioma(valor)}
                  aria-pressed={idioma === valor}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    idioma === valor
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-secondary'
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          </div>

          <VistaPreviaPdf
            cargar={cargar}
            onDescargar={descargar}
            titulo={T.vistaPrevia}
            descripcion={T.descargarAviso}
            altura="32rem"
          />
        </CardContent>
      </Card>
    </div>
  )
}
