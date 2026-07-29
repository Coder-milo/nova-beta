'use client'

import { ArrowLeft, CaretLeft, CaretRight, CheckCircle, CircleNotch, Info, UserPlus, WarningCircle } from '@phosphor-icons/react'
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

const pasos = [
  'Información personal',
  'Académica',
  'Profesional',
  'Formación adicional',
  'Experiencia',
  'Revisión',
] as const

function Campo({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function ResumenItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">{label}</span>
      <span className="font-medium text-foreground text-xs">{value !== undefined && value !== null && value !== '' ? value : '—'}</span>
    </div>
  )
}

export default function NuevoEstudiantePage() {
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
    programasApi.listar().then(setProgramas).catch(() => setError('No se pudieron cargar los programas.'))
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
      if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
      if (!form.apellido.trim()) { setError('El apellido es obligatorio.'); return }
      if (!form.email.trim()) { setError('El email es obligatorio.'); return }
    }
    if (paso === 2 && !form.programaId) { setError('Selecciona un programa.'); return }
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
          if (err.status === 400) setError('Datos inválidos: ' + (err.body.message ?? 'verifica los campos.'))
          else if (err.status === 409) setError('Ya existe un estudiante con ese correo electrónico.')
          else if (err.status === 401 || err.status === 403) setError('Sin permisos para esta acción.')
          else setError(`Error del servidor (HTTP ${err.status}).`)
        } else {
          setError('No se pudo conectar con el backend.')
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
          <UserPlus className="size-5" /> Nuevo estudiante
        </h2>
        <p className="text-sm text-muted-foreground">Registro guiado en 6 pasos. El progreso se guarda automáticamente como borrador.</p>
      </div>

      {restaurado && (
        <div role="status" className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-foreground">
            <Info className="size-4 text-primary shrink-0" /> Borrador restaurado. Puedes continuar donde lo dejaste.
          </span>
          <Button variant="ghost" size="xs" onClick={descartarBorrador}>Descartar borrador</Button>
        </div>
      )}

      {/* Barra de progreso */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Paso {paso} de 6 · {pasos[paso - 1]}
          </span>
          <span className="text-xs font-semibold tabular-nums text-foreground">{progreso}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full bg-navy-800 transition-all" style={{ width: `${progreso}%` }} />
        </div>
      </div>

      <Card className="rounded-lg border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">{pasos[paso - 1]}</CardTitle>
          <CardDescription>
            {paso === 1 && 'Datos básicos de identificación y contacto. Campos con * son obligatorios.'}
            {paso === 2 && 'Programa y estados académico y de empleabilidad.'}
            {paso === 3 && 'Perfil profesional y objetivos laborales.'}
            {paso === 4 && 'Formación adicional del estudiante.'}
            {paso === 5 && 'Experiencia laboral del estudiante.'}
            {paso === 6 && 'Revisa los datos antes de crear el registro.'}
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
                <Input id="n-apellido" required value={form.apellido} onChange={(e) => f('apellido', e.target.value)} placeholder="Ej: Ramírez" disabled={isPending} />
              </Campo>
              <Campo label="Email *" htmlFor="n-email">
                <Input id="n-email" type="email" required value={form.email} onChange={(e) => f('email', e.target.value)} placeholder="correo@ejemplo.com" disabled={isPending} />
              </Campo>
              <Campo label="Tipo de documento" htmlFor="n-tipodoc">
                <select id="n-tipodoc" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.tipoDocumento ?? 'CC'} onChange={(e) => f('tipoDocumento', e.target.value)} disabled={isPending}>
                  <option value="CC">CC</option><option value="TI">TI</option><option value="CE">CE</option><option value="PASAPORTE">Pasaporte</option>
                </select>
              </Campo>
              <Campo label="Número de documento" htmlFor="n-numdoc">
                <Input id="n-numdoc" value={form.numeroDocumento ?? ''} onChange={(e) => f('numeroDocumento', e.target.value)} placeholder="1234567890" disabled={isPending} />
              </Campo>
              <Campo label="Celular" htmlFor="n-celular">
                <Input id="n-celular" value={form.celular ?? ''} onChange={(e) => f('celular', e.target.value)} placeholder="300 000 0000" disabled={isPending} />
              </Campo>
              <Campo label="Teléfono fijo" htmlFor="n-telefono">
                <Input id="n-telefono" value={form.telefono ?? ''} onChange={(e) => f('telefono', e.target.value)} placeholder="601 000 0000" disabled={isPending} />
              </Campo>
              <Campo label="Dirección" htmlFor="n-direccion">
                <Input id="n-direccion" value={form.direccion ?? ''} onChange={(e) => f('direccion', e.target.value)} placeholder="Calle 1 # 2-34" disabled={isPending} />
              </Campo>
              <Campo label="Ciudad" htmlFor="n-ciudad">
                <Input id="n-ciudad" value={form.ciudad ?? ''} onChange={(e) => f('ciudad', e.target.value)} placeholder="Bogotá" disabled={isPending} />
              </Campo>
              <Campo label="Género" htmlFor="n-genero">
                <select id="n-genero" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.genero ?? ''} onChange={(e) => f('genero', e.target.value)} disabled={isPending}>
                  <option value="">— Seleccionar —</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="Otro">Otro</option>
                </select>
              </Campo>
            </div>
          )}

          {/* Paso 2: Académica */}
          {paso === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Programa *" htmlFor="n-programa">
                <select id="n-programa" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.programaId} onChange={(e) => f('programaId', e.target.value)} required disabled={isPending}>
                  <option value="">Selecciona un programa</option>
                  {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </Campo>
              <Campo label="Nivel educativo" htmlFor="n-niveledu">
                <select id="n-niveledu" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.nivelEducativo ?? ''} onChange={(e) => f('nivelEducativo', e.target.value)} disabled={isPending}>
                  <option value="">— Seleccionar —</option>
                  <option value="Bachiller">Bachiller</option>
                  <option value="Técnico">Técnico</option>
                  <option value="Tecnólogo">Tecnólogo</option>
                  <option value="Profesional">Profesional</option>
                  <option value="Especialización">Especialización</option>
                  <option value="Maestría">Maestría</option>
                </select>
              </Campo>
              <Campo label="Título" htmlFor="n-titulo">
                <Input id="n-titulo" value={form.titulo ?? ''} onChange={(e) => f('titulo', e.target.value)} placeholder="Ing. de Sistemas" disabled={isPending} />
              </Campo>
              <Campo label="Institución educativa" htmlFor="n-inst">
                <Input id="n-inst" value={form.institucionEducativa ?? ''} onChange={(e) => f('institucionEducativa', e.target.value)} placeholder="Universidad Nacional" disabled={isPending} />
              </Campo>
              <Campo label="Estado académico" htmlFor="n-estacad">
                <select id="n-estacad" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.estadoAcademico ?? 'ACTIVO'} onChange={(e) => f('estadoAcademico', e.target.value as EstadoAcademico)} disabled={isPending}>
                  <option value="ACTIVO">Activo</option><option value="GRADUADO">Graduado</option><option value="RETIRADO">Retirado</option><option value="EN_PROCESO">En proceso</option>
                </select>
              </Campo>
              <Campo label="Estado de empleabilidad" htmlFor="n-estemp">
                <select id="n-estemp" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.estadoEmpleabilidad ?? 'SIN_INFO'} onChange={(e) => f('estadoEmpleabilidad', e.target.value as EstadoEmpleabilidad)} disabled={isPending}>
                  <option value="SIN_INFO">Sin información</option><option value="BUSCANDO">Buscando empleo</option><option value="EMPLEADO">Empleado</option>
                </select>
              </Campo>
            </div>
          )}

          {/* Paso 3: Profesional */}
          {paso === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Campo label="Perfil profesional" htmlFor="n-perfil">
                  <textarea id="n-perfil" rows={3} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={form.perfilProfesional ?? ''} onChange={(e) => f('perfilProfesional', e.target.value)} placeholder="Descripción del perfil…" disabled={isPending} />
                </Campo>
              </div>
              <Campo label="Cargo objetivo" htmlFor="n-cargoobj">
                <Input id="n-cargoobj" value={form.cargoObjetivo ?? ''} onChange={(e) => f('cargoObjetivo', e.target.value)} placeholder="Asesor Bilingüe" disabled={isPending} />
              </Campo>
              <Campo label="Sector objetivo" htmlFor="n-secobj">
                <Input id="n-secobj" value={form.sectorObjetivo ?? ''} onChange={(e) => f('sectorObjetivo', e.target.value)} placeholder="BPO" disabled={isPending} />
              </Campo>
              <Campo label="Años de experiencia" htmlFor="n-anios">
                <Input id="n-anios" type="number" min={0} value={form.aniosExperiencia ?? 0} onChange={(e) => f('aniosExperiencia', parseInt(e.target.value) || 0)} disabled={isPending} />
              </Campo>
              <Campo label="Último cargo" htmlFor="n-ultcargo">
                <Input id="n-ultcargo" value={form.ultimoCargo ?? ''} onChange={(e) => f('ultimoCargo', e.target.value)} placeholder="Asesor de Servicio" disabled={isPending} />
              </Campo>
              <div className="sm:col-span-2">
                <Campo label="Competencias" htmlFor="n-competencias">
                  <textarea id="n-competencias" rows={2} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={form.competencias ?? ''} onChange={(e) => f('competencias', e.target.value)} placeholder="Ej: Excel avanzado, atención al cliente…" disabled={isPending} />
                </Campo>
              </div>
              <Campo label="Idiomas" htmlFor="n-idiomas">
                <Input id="n-idiomas" value={form.idiomas ?? ''} onChange={(e) => f('idiomas', e.target.value)} placeholder="Español, Inglés B2" disabled={isPending} />
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
                Podrás agregar formaciones (cursos, diplomados, títulos adicionales) desde el perfil del estudiante después de crearlo, en la pestaña <span className="font-medium text-foreground">Formación</span>.
              </p>
            </div>
          )}

          {/* Paso 5: Experiencia */}
          {paso === 5 && (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-4">
              <Info className="size-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Podrás agregar la experiencia laboral detallada desde el perfil del estudiante después de crearlo, en la pestaña <span className="font-medium text-foreground">Experiencia</span>.
              </p>
            </div>
          )}

          {/* Paso 6: Revisión */}
          {paso === 6 && (
            <div className="flex flex-col gap-5">
              <section className="flex flex-col gap-3">
                <h4 className="text-[11px] uppercase tracking-wider font-semibold text-primary border-b border-border pb-1">Información personal</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <ResumenItem label="Nombre" value={`${form.nombre} ${form.apellido}`.trim()} />
                  <ResumenItem label="Email" value={form.email} />
                  <ResumenItem label="Documento" value={form.numeroDocumento ? `${form.tipoDocumento} ${form.numeroDocumento}` : null} />
                  <ResumenItem label="Celular" value={form.celular} />
                  <ResumenItem label="Teléfono" value={form.telefono} />
                  <ResumenItem label="Dirección" value={form.direccion} />
                  <ResumenItem label="Ciudad" value={form.ciudad} />
                  <ResumenItem label="Género" value={form.genero} />
                </div>
              </section>
              <section className="flex flex-col gap-3">
                <h4 className="text-[11px] uppercase tracking-wider font-semibold text-primary border-b border-border pb-1">Académica</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <ResumenItem label="Programa" value={programaNombre} />
                  <ResumenItem label="Nivel educativo" value={form.nivelEducativo} />
                  <ResumenItem label="Título" value={form.titulo} />
                  <ResumenItem label="Institución" value={form.institucionEducativa} />
                  <ResumenItem label="Estado académico" value={form.estadoAcademico} />
                  <ResumenItem label="Empleabilidad" value={form.estadoEmpleabilidad} />
                </div>
              </section>
              <section className="flex flex-col gap-3">
                <h4 className="text-[11px] uppercase tracking-wider font-semibold text-primary border-b border-border pb-1">Profesional</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <ResumenItem label="Cargo objetivo" value={form.cargoObjetivo} />
                  <ResumenItem label="Sector objetivo" value={form.sectorObjetivo} />
                  <ResumenItem label="Años experiencia" value={form.aniosExperiencia} />
                  <ResumenItem label="Último cargo" value={form.ultimoCargo} />
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
                {isPending ? <><CircleNotch className="size-4 animate-spin" /> Creando…</> : <><CheckCircle className="size-4" /> Crear estudiante</>}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
