'use client'

import { ArrowLeft, CheckCircle2 as CheckCircle, ChevronLeft as CaretLeft, ChevronRight as CaretRight, CircleAlert as WarningCircle, Info, LoaderCircle as CircleNotch, UserPlus } from 'lucide-react'
/**
 * Registro de estudiante — asistente en 6 pasos.
 *
 * Consume:
 *   GET  /api/v1/programas    → selector de programa
 *   POST /api/v1/estudiantes  → crear estudiante
 *
 * El estado del formulario se guarda como borrador en localStorage
 * (clave 'nova_draft_estudiante') y se restaura al volver a la página.
 */

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from '@/compat/next-navigation'
import Link from '@/compat/next-link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { estudiantesApi, programasApi, ApiCallError } from '@/lib/api'
import type { ProgramaResponse, EstudianteRequest, EstadoAcademico, EstadoEmpleabilidad } from '@/lib/types'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'
import { Textarea } from '@/components/ui/textarea'

const DRAFT_KEY = 'nova_draft_estudiante'

const emptyForm: EstudianteRequest = {
  nombre: '', apellido: '', email: '', tipoDocumento: 'CC', numeroDocumento: '',
  celular: '', telefono: '', direccion: '', ciudad: '', genero: '',
  programaId: '', nivelEducativo: '', titulo: '', institucionEducativa: '',
  estadoAcademico: 'ACTIVO', estadoEmpleabilidad: 'SIN_INFO',
  perfilProfesional: '', cargoObjetivo: '', sectorObjetivo: '',
  aniosExperiencia: 0, ultimoCargo: '', competencias: '', idiomas: '',
  disponibilidad: '',
}

function nombresDePaso(T: ReturnType<typeof textos>): string[] {
  return [
    T.informacionPersonal, T.academica, T.profesional,
    T.formacionAdicional, T.experiencia, T.revision,
  ]
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
        datosBasicosDe: 'Basic identification and contact details. Fields marked * are required.',
        registroGuiadoEn: 'A guided six-step form. Progress is saved automatically as a draft.',
        podrasAgregarFormaciones: 'You will be able to add education (courses, diplomas, further qualifications) from the student profile once created, on the tab',
        podrasAgregarLa: 'You will be able to add detailed work experience from the student profile once created, on the tab',
        borradorRestauradoPuedes: 'Draft restored. You can pick up where you left off.',
        yaExisteUn: 'A student with that email already exists.',
        programaYEstados: 'Programme, plus academic and employability status.',
        perfilProfesionalY: 'Professional summary and job goals.',
        revisaLosDatos: 'Check the details before creating the record.',
        experienciaLaboralDel: "The student's work experience.",
        formacionAdicionalDel: "The student's further education.",
        ejExcelAvanzado: 'e.g. Advanced Excel, customer service…',
        sinPermisosPara: 'No permission for this action.',
        estadoDeEmpleabilidad: 'Employability status',
        descripcionDelPerfil: 'Profile description…',
        institucionEducativa: 'Educational institution',
        elApellidoEs: 'The last name is required.',
        elEmailEs: 'The email is required.',
        seleccionaUnPrograma: 'Choose a programme.',
        seleccionaUnProgramaX: 'Choose a programme',
        informacionPersonal: 'Personal details',
        formacionAdicional: 'Further education',
        numeroDeDocumento: 'ID number',
        tipoDeDocumento: 'ID type',
        anosDeExperiencia: 'Years of experience',
        anosExperiencia: 'Years of exp.',
        estadoAcademico: 'Academic status',
        verificaLosCampos: 'check the fields.',
        datosInvalidos: 'Invalid data:',
        especializacion: 'Specialisation',
        crearEstudiante: 'Create student',
        nuevoEstudiante: 'New student',
        asesorDeServicio: 'Customer service advisor',
        espanolInglesB2: 'Spanish, English B2',
        ingDeSistemas: 'Systems engineering',
        seleccionar: '— Choose —',
        ultimoCargo: 'Last role',
        telefonoFijo: 'Landline',
        formacion: 'Education',
        profesional: 'Professional',
        experiencia: 'Experience',
        tecnologo: 'Technologist',
        academica: 'Academic',
        direccion: 'Address',
        revision: 'Review',
        tecnico: 'Technician',
        maestria: "Master's",
        titulo: 'Qualification',
        genero: 'Gender',
        bogota: 'Bogotá',
        ejRamirez: 'e.g. Ramírez',
      }
    : {
        datosBasicosDe: 'Datos básicos de identificación y contacto. Campos con * son obligatorios.',
        registroGuiadoEn: 'Registro guiado en 6 pasos. El progreso se guarda automáticamente como borrador.',
        podrasAgregarFormaciones: 'Podrás agregar formaciones (cursos, diplomados, títulos adicionales) desde el perfil del estudiante después de crearlo, en la pestaña',
        podrasAgregarLa: 'Podrás agregar la experiencia laboral detallada desde el perfil del estudiante después de crearlo, en la pestaña',
        borradorRestauradoPuedes: 'Borrador restaurado. Puedes continuar donde lo dejaste.',
        yaExisteUn: 'Ya existe un estudiante con ese correo electrónico.',
        programaYEstados: 'Programa y estados académico y de empleabilidad.',
        perfilProfesionalY: 'Perfil profesional y objetivos laborales.',
        revisaLosDatos: 'Revisa los datos antes de crear el registro.',
        experienciaLaboralDel: 'Experiencia laboral del estudiante.',
        formacionAdicionalDel: 'Formación adicional del estudiante.',
        ejExcelAvanzado: 'Ej: Excel avanzado, atención al cliente…',
        sinPermisosPara: 'Sin permisos para esta acción.',
        estadoDeEmpleabilidad: 'Estado de empleabilidad',
        descripcionDelPerfil: 'Descripción del perfil…',
        institucionEducativa: 'Institución educativa',
        elApellidoEs: 'El apellido es obligatorio.',
        elEmailEs: 'El email es obligatorio.',
        seleccionaUnPrograma: 'Selecciona un programa.',
        seleccionaUnProgramaX: 'Selecciona un programa',
        informacionPersonal: 'Información personal',
        formacionAdicional: 'Formación adicional',
        numeroDeDocumento: 'Número de documento',
        tipoDeDocumento: 'Tipo de documento',
        anosDeExperiencia: 'Años de experiencia',
        anosExperiencia: 'Años experiencia',
        estadoAcademico: 'Estado académico',
        verificaLosCampos: 'verifica los campos.',
        datosInvalidos: 'Datos inválidos:',
        especializacion: 'Especialización',
        crearEstudiante: 'Crear estudiante',
        nuevoEstudiante: 'Nuevo estudiante',
        asesorDeServicio: 'Asesor de Servicio',
        espanolInglesB2: 'Español, Inglés B2',
        ingDeSistemas: 'Ing. de Sistemas',
        seleccionar: '— Seleccionar —',
        ultimoCargo: 'Último cargo',
        telefonoFijo: 'Teléfono fijo',
        formacion: 'Formación',
        profesional: 'Profesional',
        experiencia: 'Experiencia',
        tecnologo: 'Tecnólogo',
        academica: 'Académica',
        direccion: 'Dirección',
        revision: 'Revisión',
        tecnico: 'Técnico',
        maestria: 'Maestría',
        titulo: 'Título',
        genero: 'Género',
        bogota: 'Bogotá',
        ejRamirez: 'Ej: Ramírez',
      }
}

function Campo({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function ResumenItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  return (
    <div>
      <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">{label}</span>
      <span className="font-medium text-foreground text-xs">{value !== undefined && value !== null && value !== '' ? value : '—'}</span>
    </div>
  )
}

export default function NuevoEstudiantePage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const router = useRouter()
  const [paso, setPaso]           = useState(1)
  const [form, setForm]           = useState<EstudianteRequest>(emptyForm)
  const [programas, setProgramas] = useState<ProgramaResponse[]>([])
  const [error, setError]         = useState<string | null>(null)
  const [restaurado, setRestaurado] = useState(false)
  const [isPending, startTransition] = useTransition()
  const hidratado = useRef(false)

  // ── Cargar programas ──────────────────────────────────────────────────────
  useEffect(() => {
    programasApi.listar().then(setProgramas).catch(() => setError(C.errorProgramas))
  }, [])

  // ── Restaurar borrador ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw) as Partial<EstudianteRequest>
        setForm({ ...emptyForm, ...draft })
        setRestaurado(true)
      }
    } catch { /* borrador corrupto: ignorar */ }
    hidratado.current = true
  }, [])

  // ── Persistir borrador ────────────────────────────────────────────────────
  useEffect(() => {
    if (!hidratado.current) return
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)) } catch { /* noop */ }
  }, [form])

  const f = (key: keyof EstudianteRequest, val: unknown) => setForm((prev) => ({ ...prev, [key]: val }))

  // ── Navegación entre pasos ────────────────────────────────────────────────
  const siguiente = () => {
    setError(null)
    if (paso === 1) {
      if (!form.nombre.trim()) { setError(C.errorNombre); return }
      if (!form.apellido.trim()) { setError(T.elApellidoEs); return }
      if (!form.email.trim()) { setError(T.elEmailEs); return }
    }
    if (paso === 2 && !form.programaId) { setError(T.seleccionaUnPrograma); return }
    setPaso((p) => Math.min(6, p + 1))
  }

  const anterior = () => { setError(null); setPaso((p) => Math.max(1, p - 1)) }

  const descartarBorrador = () => {
    localStorage.removeItem(DRAFT_KEY)
    setForm(emptyForm)
    setRestaurado(false)
    setPaso(1)
  }

  // ── Crear ─────────────────────────────────────────────────────────────────
  const handleCrear = () => {
    setError(null)
    startTransition(async () => {
      try {
        const creado = await estudiantesApi.crear({ ...form })
        localStorage.removeItem(DRAFT_KEY)
        router.push(`/estudiantes/${creado.id}`)
      } catch (err) {
        if (err instanceof ApiCallError) {
          if (err.status === 400) setError(`${T.datosInvalidos} ${err.body.message ?? T.verificaLosCampos}`)
          else if (err.status === 409) setError(T.yaExisteUn)
          else if (err.status === 401 || err.status === 403) setError(T.sinPermisosPara)
          else setError(`Error del servidor (HTTP ${err.status}).`)
        } else {
          setError(C.errorConexion)
        }
      }
    })
  }

  const progreso = Math.round((paso / 6) * 100)
  const programaNombre = programas.find((p) => p.id === form.programaId)?.nombre

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href="/estudiantes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Volver a estudiantes
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <UserPlus className="size-5" /> {T.nuevoEstudiante}
        </h2>
        <p className="text-sm text-muted-foreground">{T.registroGuiadoEn}</p>
      </div>

      {restaurado && (
        <div role="status" className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-foreground">
            <Info className="size-4 text-primary shrink-0" /> {T.borradorRestauradoPuedes}
          </span>
          <Button variant="ghost" size="xs" onClick={descartarBorrador}>Descartar borrador</Button>
        </div>
      )}

      {/* Barra de progreso */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Paso {paso} de 6 · {nombresDePaso(T)[paso - 1]}
          </span>
          <span className="text-xs font-semibold tabular-nums text-foreground">{progreso}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full bg-navy-800 transition-all" style={{ width: `${progreso}%` }} />
        </div>
      </div>

      <Card className="rounded-lg border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">{nombresDePaso(T)[paso - 1]}</CardTitle>
          <CardDescription>
            {paso === 1 && T.datosBasicosDe}
            {paso === 2 && T.programaYEstados}
            {paso === 3 && T.perfilProfesionalY}
            {paso === 4 && T.formacionAdicionalDel}
            {paso === 5 && T.experienciaLaboralDel}
            {paso === 6 && T.revisaLosDatos}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Paso 1: Información personal */}
          {paso === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Nombre *" htmlFor="n-nombre">
                <Input id="n-nombre" required value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Ej: Carlos" disabled={isPending} />
              </Campo>
              <Campo label="Apellido *" htmlFor="n-apellido">
                <Input id="n-apellido" required value={form.apellido} onChange={(e) => f('apellido', e.target.value)} placeholder={T.ejRamirez} disabled={isPending} />
              </Campo>
              <Campo label="Email *" htmlFor="n-email">
                <Input id="n-email" type="email" required value={form.email} onChange={(e) => f('email', e.target.value)} placeholder="correo@ejemplo.com" disabled={isPending} />
              </Campo>
              <Campo label={T.tipoDeDocumento} htmlFor="n-tipodoc">
                <select id="n-tipodoc" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.tipoDocumento ?? 'CC'} onChange={(e) => f('tipoDocumento', e.target.value)} disabled={isPending}>
                  <option value="CC">CC</option><option value="TI">TI</option><option value="CE">CE</option><option value="PASAPORTE">Pasaporte</option>
                </select>
              </Campo>
              <Campo label={T.numeroDeDocumento} htmlFor="n-numdoc">
                <Input id="n-numdoc" value={form.numeroDocumento ?? ''} onChange={(e) => f('numeroDocumento', e.target.value)} placeholder="1234567890" disabled={isPending} />
              </Campo>
              <Campo label="Celular" htmlFor="n-celular">
                <Input id="n-celular" value={form.celular ?? ''} onChange={(e) => f('celular', e.target.value)} placeholder="300 000 0000" disabled={isPending} />
              </Campo>
              <Campo label={T.telefonoFijo} htmlFor="n-telefono">
                <Input id="n-telefono" value={form.telefono ?? ''} onChange={(e) => f('telefono', e.target.value)} placeholder="601 000 0000" disabled={isPending} maxLength={50} />
              </Campo>
              <Campo label={T.direccion} htmlFor="n-direccion">
                <Input id="n-direccion" value={form.direccion ?? ''} onChange={(e) => f('direccion', e.target.value)} placeholder="Calle 1 # 2-34" disabled={isPending} />
              </Campo>
              <Campo label="Ciudad" htmlFor="n-ciudad">
                <Input id="n-ciudad" value={form.ciudad ?? ''} onChange={(e) => f('ciudad', e.target.value)} placeholder={T.bogota} disabled={isPending} />
              </Campo>
              <Campo label={T.genero} htmlFor="n-genero">
                <select id="n-genero" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.genero ?? ''} onChange={(e) => f('genero', e.target.value)} disabled={isPending}>
                  <option value="">{T.seleccionar}</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="Otro">Otro</option>
                </select>
              </Campo>
            </div>
          )}

          {/* Paso 2: Académica */}
          {paso === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Programa *" htmlFor="n-programa">
                <select id="n-programa" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.programaId} onChange={(e) => f('programaId', e.target.value)} required disabled={isPending}>
                  <option value="">{T.seleccionaUnProgramaX}</option>
                  {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </Campo>
              <Campo label="Nivel educativo" htmlFor="n-niveledu">
                <select id="n-niveledu" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.nivelEducativo ?? ''} onChange={(e) => f('nivelEducativo', e.target.value)} disabled={isPending}>
                  <option value="">{T.seleccionar}</option>
                  <option value="Bachiller">Bachiller</option>
                  <option value={T.tecnico}>{T.tecnico}</option>
                  <option value={T.tecnologo}>{T.tecnologo}</option>
                  <option value={T.profesional}>{T.profesional}</option>
                  <option value={T.especializacion}>{T.especializacion}</option>
                  <option value={T.maestria}>{T.maestria}</option>
                </select>
              </Campo>
              <Campo label={T.titulo} htmlFor="n-titulo">
                <Input id="n-titulo" value={form.titulo ?? ''} onChange={(e) => f('titulo', e.target.value)} placeholder={T.ingDeSistemas} disabled={isPending} />
              </Campo>
              <Campo label={T.institucionEducativa} htmlFor="n-inst">
                <Input id="n-inst" value={form.institucionEducativa ?? ''} onChange={(e) => f('institucionEducativa', e.target.value)} placeholder="Universidad Nacional" disabled={isPending} />
              </Campo>
              <Campo label={T.estadoAcademico} htmlFor="n-estacad">
                <select id="n-estacad" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.estadoAcademico ?? 'ACTIVO'} onChange={(e) => f('estadoAcademico', e.target.value as EstadoAcademico)} disabled={isPending}>
                  <option value="ACTIVO">{C.activo}</option><option value="GRADUADO">Graduado</option><option value="RETIRADO">Retirado</option><option value="EN_PROCESO">En proceso</option>
                </select>
              </Campo>
              <Campo label={T.estadoDeEmpleabilidad} htmlFor="n-estemp">
                <select id="n-estemp" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.estadoEmpleabilidad ?? 'SIN_INFO'} onChange={(e) => f('estadoEmpleabilidad', e.target.value as EstadoEmpleabilidad)} disabled={isPending}>
                  <option value="SIN_INFO">{C.sinInfo}</option><option value="BUSCANDO">Buscando empleo</option><option value="EMPLEADO">Empleado</option>
                </select>
              </Campo>
            </div>
          )}

          {/* Paso 3: Profesional */}
          {paso === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Campo label="Perfil profesional" htmlFor="n-perfil">
                  <Textarea id="n-perfil" minRows={3} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={form.perfilProfesional ?? ''} onChange={(e) => f('perfilProfesional', e.target.value)} placeholder={T.descripcionDelPerfil} disabled={isPending} />
                </Campo>
              </div>
              <Campo label="Cargo objetivo" htmlFor="n-cargoobj">
                <Input id="n-cargoobj" value={form.cargoObjetivo ?? ''} onChange={(e) => f('cargoObjetivo', e.target.value)} placeholder="Asesor Bilingüe" disabled={isPending} />
              </Campo>
              <Campo label="Sector objetivo" htmlFor="n-secobj">
                <Input id="n-secobj" value={form.sectorObjetivo ?? ''} onChange={(e) => f('sectorObjetivo', e.target.value)} placeholder="BPO" disabled={isPending} />
              </Campo>
              <Campo label={T.anosDeExperiencia} htmlFor="n-anios">
                <Input id="n-anios" type="number" min={0} value={form.aniosExperiencia ?? 0} onChange={(e) => f('aniosExperiencia', parseInt(e.target.value) || 0)} disabled={isPending} />
              </Campo>
              <Campo label={T.ultimoCargo} htmlFor="n-ultcargo">
                <Input id="n-ultcargo" value={form.ultimoCargo ?? ''} onChange={(e) => f('ultimoCargo', e.target.value)} placeholder={T.asesorDeServicio} disabled={isPending} />
              </Campo>
              <div className="sm:col-span-2">
                <Campo label="Competencias" htmlFor="n-competencias">
                  <Textarea id="n-competencias" minRows={2} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={form.competencias ?? ''} onChange={(e) => f('competencias', e.target.value)} placeholder={T.ejExcelAvanzado} disabled={isPending} />
                </Campo>
              </div>
              <Campo label="Idiomas" htmlFor="n-idiomas">
                <Input id="n-idiomas" value={form.idiomas ?? ''} onChange={(e) => f('idiomas', e.target.value)} placeholder={T.espanolInglesB2} disabled={isPending} />
              </Campo>
              <Campo label="Disponibilidad" htmlFor="n-disp">
                <Input id="n-disp" value={form.disponibilidad ?? ''} onChange={(e) => f('disponibilidad', e.target.value)} placeholder="Inmediata" disabled={isPending} />
              </Campo>
            </div>
          )}

          {/* Paso 4: Formación adicional */}
          {paso === 4 && (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-4">
              <Info className="size-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {T.podrasAgregarFormaciones} <span className="font-medium text-foreground">{T.formacion}</span>.
              </p>
            </div>
          )}

          {/* Paso 5: Experiencia */}
          {paso === 5 && (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-4">
              <Info className="size-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {T.podrasAgregarLa} <span className="font-medium text-foreground">{T.experiencia}</span>.
              </p>
            </div>
          )}

          {/* Paso 6: Revisión */}
          {paso === 6 && (
            <div className="flex flex-col gap-5">
              <section className="flex flex-col gap-3">
                <h4 className="text-[11px] uppercase tracking-wider font-semibold text-primary border-b border-border pb-1">{T.informacionPersonal}</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <ResumenItem label="Nombre" value={`${form.nombre} ${form.apellido}`.trim()} />
                  <ResumenItem label="Email" value={form.email} />
                  <ResumenItem label="Documento" value={form.numeroDocumento ? `${form.tipoDocumento} ${form.numeroDocumento}` : null} />
                  <ResumenItem label="Celular" value={form.celular} />
                  <ResumenItem label={C.telefono} value={form.telefono} />
                  <ResumenItem label={T.direccion} value={form.direccion} />
                  <ResumenItem label="Ciudad" value={form.ciudad} />
                  <ResumenItem label={T.genero} value={form.genero} />
                </div>
              </section>
              <section className="flex flex-col gap-3">
                <h4 className="text-[11px] uppercase tracking-wider font-semibold text-primary border-b border-border pb-1">{T.academica}</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <ResumenItem label="Programa" value={programaNombre} />
                  <ResumenItem label="Nivel educativo" value={form.nivelEducativo} />
                  <ResumenItem label={T.titulo} value={form.titulo} />
                  <ResumenItem label={C.institucion} value={form.institucionEducativa} />
                  <ResumenItem label={T.estadoAcademico} value={form.estadoAcademico} />
                  <ResumenItem label="Empleabilidad" value={form.estadoEmpleabilidad} />
                </div>
              </section>
              <section className="flex flex-col gap-3">
                <h4 className="text-[11px] uppercase tracking-wider font-semibold text-primary border-b border-border pb-1">{T.profesional}</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <ResumenItem label="Cargo objetivo" value={form.cargoObjetivo} />
                  <ResumenItem label="Sector objetivo" value={form.sectorObjetivo} />
                  <ResumenItem label={T.anosExperiencia} value={form.aniosExperiencia} />
                  <ResumenItem label={T.ultimoCargo} value={form.ultimoCargo} />
                  <ResumenItem label="Idiomas" value={form.idiomas} />
                  <ResumenItem label="Disponibilidad" value={form.disponibilidad} />
                </div>
                {form.perfilProfesional && (
                  <div>
                    <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">Perfil profesional</span>
                    <p className="text-xs text-muted-foreground italic leading-relaxed whitespace-pre-wrap mt-0.5">{form.perfilProfesional}</p>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Error */}
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span>
            </div>
          )}

          {/* Navegación */}
          <div className="flex justify-between border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={anterior} disabled={paso === 1 || isPending}>
              <CaretLeft className="size-4" /> Anterior
            </Button>
            {paso < 6 ? (
              <Button type="button" onClick={siguiente} disabled={isPending}>
                Siguiente <CaretRight className="size-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleCrear} disabled={isPending}>
                {isPending ? <><CircleNotch className="size-4 animate-spin" /> Creando…</> : <><CheckCircle className="size-4" /> {T.crearEstudiante}</>}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
