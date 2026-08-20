'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from '@/compat/next-link'
import { Briefcase, Building2 as Buildings, CheckCircle2 as CheckCircle, CircleAlert as WarningCircle, CircleX as XCircle, DollarSign as CurrencyDollar, LoaderCircle as CircleNotch, Pencil, Plus, Search as MagnifyingGlass, Users } from 'lucide-react'
import { colocacionesApi, empresasApi, estudiantesApi, ApiCallError } from '@/lib/api'
import { useConfirmar } from '@/components/ui/confirmar'
import type { CatalogosColocacion, ColocacionRequest, ColocacionResponse, EmpresaResponse, EstudianteResponse, ResumenColocaciones } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin, type TextosAdmin } from '@/lib/textos-admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Textarea } from '@/components/ui/textarea'

const vacia: ColocacionRequest = { estudianteId: '', empresaNombre: '', cargo: '', tipoVinculacion: 'EMPLEADO', fechaInicio: '', canalConsecucion: '', salario: null, modalidad: '', tipoContrato: '', observaciones: '' }
/**
 * Etiqueta de cada codigo de catalogo.
 *
 * Que valores existen lo dice el backend; como se leen, el diccionario. Si
 * aparece un codigo que esta pantalla todavia no conoce se usa la etiqueta que
 * mando el servidor: sale en espanol, pero sale, que es mejor que no poder
 * elegirlo.
 */
function etiquetaDeTipo(T: ReturnType<typeof textos>, C: TextosAdmin, valor: string, respaldo: string) {
  return ({
    EMPLEADO: C.empleado, PRACTICANTE: T.practicante, APRENDIZ: T.aprendizSena,
    CONTRATISTA: T.prestacionDeServicios, FORMACION: T.vinculadoAFormacion,
  } as Record<string, string>)[valor] ?? respaldo
}

function etiquetaDeCanal(T: ReturnType<typeof textos>, valor: string, respaldo: string) {
  return ({
    OPEN_HOUSE: T.openHouse, VISITA_CAC: T.visitaCac, FERIA: T.feriaDeEmpleo,
    ALIADO: T.empresaAliada, PORTAL: T.portalVacanteDel, LINKEDIN: 'LinkedIn',
    AUTOGESTIONADO: T.autogestionado, OTRO: T.otro,
  } as Record<string, string>)[valor] ?? respaldo
}

function dinero(valor: number | null, sinSalario: string, english = false) { return valor == null ? sinSalario : new Intl.NumberFormat(english ? 'en-GB' : 'es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor) }
function mensajeError(error: unknown, fallback: string) { return error instanceof ApiCallError ? error.body.message ?? `${fallback} (HTTP ${error.status}).` : fallback }
function valorChecklist(valor: boolean | null | undefined) { return valor == null ? '' : String(valor) }
function Kpi({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Briefcase }) { return <Card className="shadow-none"><CardContent className="flex items-center gap-3 p-4"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div><p className="text-xl font-semibold text-foreground">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card> }

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        seguimientoDeEmpleabilidad: 'Employability tracking',
        buscarParticipanteEmpresa: 'Search participant, company or role',
        cargandoColocaciones: 'Loading placements…',
        noHayColocaciones: 'No placements match this search.',
        noSePudo: 'Placement tracking could not be loaded.',
        noSePudoX: 'The placement could not be recorded.',
        noSePudoActualizar: 'The placement could not be updated.',
        noSePudoXX: 'The placement could not be closed.',
        registrarColocacion: 'Log a placement',
        editarColocacion: 'Edit placement',
        guardarCambios: 'Save changes',
        cerrarVinculacion: 'End employment',
        colocacionesVigentes: 'Active placements',
        gestionadasPorAcademy: 'Managed by Academy CAC',
        gestionadaPorEl: 'Managed by the programme',
        salarioPromedio: 'Average salary',
        sobreLaMeta: 'Above the salary target',
        sinSalarioRegistrado: 'No salary recorded',
        checklistCompleto: 'Checklist complete',
        condicionesLaborales: 'Working conditions',
        identificaAlParticipante: 'Identify the participant and the company they joined.',
        seleccionaUnParticipante: 'Choose a participant',
        seleccionaOEscribe: 'Choose or type a company name',
        participante: 'Participant *',
        empresa: 'Company *',
        cargoVinculado: 'Role',
        tipoDeContrato: 'Contract type',
        tipoDeVinculacion: 'Employment type',
        canalDeConsecucion: 'Sourcing channel',
        canalSinRegistrar: 'Channel not recorded',
        modalidadSinRegistrar: 'Work mode not recorded',
        inglesSinRegistrar: 'English level not recorded',
        salarioMensualCop: 'Monthly salary (COP)',
        fechaDeInicio: 'Start date',
        indefinidoFijoPrestacion: 'Permanent, fixed-term, services…',
        presencialRemotoO: 'On site, remote or hybrid',
        ej2500000: 'e.g. 2500000',
        ejPendienteConfirmar: 'e.g. pending start date confirmation with the company…',
        empresaAliada: 'Partner company',
        feriaDeEmpleo: 'Job fair',
        openHouse: 'Open house',
        portalVacanteDel: 'Portal / CRM vacancy',
        visitaCac: 'CAC visit',
        vinculadoAFormacion: 'Linked to training',
        autogestionado: 'Self-sourced',
        aprendizSena: 'SENA apprentice',
        practicante: 'Intern',
        prestacionDeServicios: 'Services contract',
        porConfirmar: 'To be confirmed',
        sinSector: 'No sector',
        observaciones: 'Notes',
        modalidad: 'Work mode',
        vinculacion: 'Employment',
        otro: 'Other',
        vinculacionesVerificadas: 'Verified placements, working conditions and onboarding checklist.',
        esteModuloReemplaza: 'This module replaces the manual list of hired and placed participants.',
        guardaLaVinculacion: 'Record the job placement with full data for employability follow-up.',
        editaLaVinculacion: 'Update the company, role, salary and other verified employment details.',
        elListadoUsa: 'The list uses the company directory; you can also add a new company.',
        estosDatosAlimentan: "These fields feed the programme's employability indicators.",
        anadeCondicionesPor: 'Add conditions still to verify, commitments, or any useful context.',
        vinculacionesActivas: (n: number) => `Active placements (${n})`,
        inicioX: (fecha: string) => `Start: ${fecha}`,
        checklistX: (hechos: number, total: number, resumen: string) => `Checklist: ${hechos}/${total} · ${resumen}`,
        cargo: 'Role',
        bonificaciones: 'Bonuses or additional benefits',
        bonificacionesEjemplo: 'e.g. commissions, transport allowance…',
        checklistIngreso: 'Onboarding checklist',
        checklistAyuda: 'Record whether each item has been checked and meets the programme criteria.',
        contratoFirmado: 'Signed contract',
        verificacionVacante: 'Vacancy verification',
        benchmarkSalarial: 'Salary benchmark',
        reglamentoInterno: 'Internal rules',
        primeraColillaPago: 'First payslip',
        sinRevisar: 'Not reviewed',
        cumple: 'Meets criteria',
        noCumple: 'Does not meet criteria',
      }
    : {
        seguimientoDeEmpleabilidad: 'Seguimiento de empleabilidad',
        buscarParticipanteEmpresa: 'Buscar participante, empresa o cargo',
        cargandoColocaciones: 'Cargando colocaciones…',
        noHayColocaciones: 'No hay colocaciones que coincidan con la búsqueda.',
        noSePudo: 'No se pudo cargar el seguimiento de colocaciones.',
        noSePudoX: 'No se pudo registrar la colocación.',
        noSePudoActualizar: 'No se pudo actualizar la colocación.',
        noSePudoXX: 'No se pudo cerrar la colocación.',
        registrarColocacion: 'Registrar colocación',
        editarColocacion: 'Editar colocación',
        guardarCambios: 'Guardar cambios',
        cerrarVinculacion: 'Cerrar vinculación',
        colocacionesVigentes: 'Colocaciones vigentes',
        gestionadasPorAcademy: 'Gestionadas por Academy CAC',
        gestionadaPorEl: 'Gestionada por el programa',
        salarioPromedio: 'Salario promedio',
        sobreLaMeta: 'Sobre la meta salarial',
        sinSalarioRegistrado: 'Sin salario registrado',
        checklistCompleto: 'Checklist completo',
        condicionesLaborales: 'Condiciones laborales',
        identificaAlParticipante: 'Identifica al participante y la empresa donde se incorporó.',
        seleccionaUnParticipante: 'Selecciona un participante',
        seleccionaOEscribe: 'Selecciona o escribe el nombre de una empresa',
        participante: 'Participante *',
        empresa: 'Empresa *',
        cargoVinculado: 'Cargo vinculado',
        tipoDeContrato: 'Tipo de contrato',
        tipoDeVinculacion: 'Tipo de vinculación',
        canalDeConsecucion: 'Canal de consecución',
        canalSinRegistrar: 'Canal sin registrar',
        modalidadSinRegistrar: 'Modalidad sin registrar',
        inglesSinRegistrar: 'Inglés sin registrar',
        salarioMensualCop: 'Salario mensual (COP)',
        fechaDeInicio: 'Fecha de inicio',
        indefinidoFijoPrestacion: 'Indefinido, fijo, prestación de servicios…',
        presencialRemotoO: 'Presencial, remoto o híbrido',
        ej2500000: 'Ej. 2500000',
        ejPendienteConfirmar: 'Ej. pendiente confirmar fecha de inicio con la empresa…',
        empresaAliada: 'Empresa aliada',
        feriaDeEmpleo: 'Feria de empleo',
        openHouse: 'Open House',
        portalVacanteDel: 'Portal / vacante del CRM',
        visitaCac: 'Visita - CAC',
        vinculadoAFormacion: 'Vinculado a formación',
        autogestionado: 'Autogestionado',
        aprendizSena: 'Aprendiz SENA',
        practicante: 'Practicante',
        prestacionDeServicios: 'Prestación de servicios',
        porConfirmar: 'Por confirmar',
        sinSector: 'Sin sector',
        observaciones: 'Observaciones',
        modalidad: 'Modalidad',
        vinculacion: 'Vinculación',
        otro: 'Otro',
        vinculacionesVerificadas: 'Vinculaciones verificadas, condiciones laborales y checklist de ingreso.',
        esteModuloReemplaza: 'Este módulo reemplaza el listado manual de vinculados y colocados.',
        guardaLaVinculacion: 'Guarda la vinculación laboral con datos completos para el seguimiento de empleabilidad.',
        editaLaVinculacion: 'Actualiza la empresa, el cargo, el salario y los demás datos verificados de la vinculación.',
        elListadoUsa: 'El listado usa el directorio de empresas; también puedes registrar una empresa nueva.',
        estosDatosAlimentan: 'Estos datos alimentan los indicadores de empleabilidad del programa.',
        anadeCondicionesPor: 'Añade condiciones por verificar, compromisos o cualquier contexto útil.',
        vinculacionesActivas: (n: number) => `Vinculaciones activas (${n})`,
        inicioX: (fecha: string) => `Inicio: ${fecha}`,
        checklistX: (hechos: number, total: number, resumen: string) => `Checklist: ${hechos}/${total} · ${resumen}`,
        cargo: 'Cargo',
        bonificaciones: 'Bonificaciones o beneficios adicionales',
        bonificacionesEjemplo: 'Ej. comisiones, auxilio de transporte…',
        checklistIngreso: 'Checklist de ingreso',
        checklistAyuda: 'Registra si cada elemento fue revisado y cumple con los criterios del programa.',
        contratoFirmado: 'Contrato firmado',
        verificacionVacante: 'Verificación de la vacante',
        benchmarkSalarial: 'Benchmark salarial',
        reglamentoInterno: 'Reglamento interno',
        primeraColillaPago: 'Primera colilla de pago',
        sinRevisar: 'Sin revisar',
        cumple: 'Cumple',
        noCumple: 'No cumple',
      }
}

export default function ColocacionesPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const { confirmar, dialogo } = useConfirmar()
  const [registros, setRegistros] = useState<ColocacionResponse[]>([])
  const [resumen, setResumen] = useState<ResumenColocaciones | null>(null)
  const [estudiantes, setEstudiantes] = useState<EstudianteResponse[]>([])
  const [empresas, setEmpresas] = useState<EmpresaResponse[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<ColocacionRequest>(vacia)
  const [catalogos, setCatalogos] = useState<CatalogosColocacion | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const [lista, cifras, participantes, directorio, catalogo] = await Promise.all([
        colocacionesApi.listar(), colocacionesApi.resumen(), estudiantesApi.buscarAvanzado({ page: 0, size: 250 }), empresasApi.buscar({ page: 0, size: 250 }),
        colocacionesApi.catalogos(),
      ])
      setRegistros(lista); setResumen(cifras); setEstudiantes(participantes.content); setEmpresas(directorio.content)
      setCatalogos(catalogo)
    } catch (err) { setError(mensajeError(err, T.noSePudo)) }
    finally { setCargando(false) }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const filtrados = useMemo(() => {
    const busqueda = q.trim().toLocaleLowerCase('es-CO')
    if (!busqueda) return registros
    return registros.filter((r) => [r.estudianteNombre, r.empresaNombre, r.cargo, r.canalConsecucionEtiqueta].filter(Boolean).some((v) => v!.toLocaleLowerCase('es-CO').includes(busqueda)))
  }, [q, registros])

  const abrirRegistro = () => { setEditandoId(null); setForm(vacia); setAbierto(true); setError('') }
  const abrirEdicion = (registro: ColocacionResponse) => {
    setEditandoId(registro.id)
    setForm({
      estudianteId: registro.estudianteId,
      empresaNombre: registro.empresaNombre,
      cargo: registro.cargo ?? '',
      tipoVinculacion: registro.tipoVinculacion,
      fechaInicio: registro.fechaInicio ?? '',
      canalConsecucion: registro.canalConsecucion ?? '',
      salario: registro.salario,
      bonificaciones: registro.bonificaciones ?? '',
      modalidad: registro.modalidad ?? '',
      tipoContrato: registro.tipoContrato ?? '',
      chkContrato: registro.chkContrato,
      chkVerificacionVacante: registro.chkVerificacionVacante,
      chkBenchmark: registro.chkBenchmark,
      chkReglamentoInterno: registro.chkReglamentoInterno,
      chkColillaPago: registro.chkColillaPago,
      observaciones: registro.observaciones ?? '',
    })
    setAbierto(true)
    setError('')
  }
  const guardar = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    if (!form.estudianteId || !form.empresaNombre.trim()) return
    setGuardando(true); setError('')
    try {
      const datos = { ...form, empresaNombre: form.empresaNombre.trim(), cargo: form.cargo?.trim() || null, fechaInicio: form.fechaInicio || null, canalConsecucion: form.canalConsecucion || null, salario: form.salario ?? null, bonificaciones: form.bonificaciones?.trim() || null, modalidad: form.modalidad?.trim() || null, tipoContrato: form.tipoContrato?.trim() || null, observaciones: form.observaciones?.trim() || null }
      if (editandoId) await colocacionesApi.actualizar(editandoId, datos)
      else await colocacionesApi.registrar(datos)
      setAbierto(false); setEditandoId(null); await cargar()
    } catch (err) { setError(mensajeError(err, editandoId ? T.noSePudoActualizar : T.noSePudoX)) }
    finally { setGuardando(false) }
  }
  const cerrar = async (registro: ColocacionResponse) => {
    if (!(await confirmar({
      titulo: T.cerrarVinculacion,
      descripcion: `Se cerrará la vinculación de ${registro.estudianteNombre} en ${registro.empresaNombre}. El historial se conserva.`,
      textoConfirmar: T.cerrarVinculacion,
    }))) return
    try { await colocacionesApi.cerrar(registro.id); await cargar() } catch (err) { setError(mensajeError(err, T.noSePudoXX)) }
  }

  const cambiarChecklist = (
    campo: 'chkContrato' | 'chkVerificacionVacante' | 'chkBenchmark' | 'chkReglamentoInterno' | 'chkColillaPago',
    valor: string,
  ) => setForm({ ...form, [campo]: valor === '' ? null : valor === 'true' })

  const opcionesChecklist = [
    { valor: '', etiqueta: T.sinRevisar },
    { valor: 'true', etiqueta: T.cumple },
    { valor: 'false', etiqueta: T.noCumple },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{T.seguimientoDeEmpleabilidad}</p>
          <p className="text-sm text-muted-foreground">{T.vinculacionesVerificadas}</p>
        </div>
        <Button onClick={abrirRegistro}><Plus /> {T.registrarColocacion}</Button>
      </div>

      {error && !abierto && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <WarningCircle className="size-5 shrink-0" />{error}
        </div>
      )}

      {cargando ? <PageSpinner label={T.cargandoColocaciones} /> : (
        <>
          {resumen && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Kpi label={T.colocacionesVigentes} value={resumen.total} icon={Briefcase} />
              <Kpi label={T.sobreLaMeta} value={resumen.sobreMeta} icon={CurrencyDollar} />
              <Kpi label={T.gestionadasPorAcademy} value={resumen.gestionadasPorElPrograma} icon={Users} />
              <Kpi label={T.checklistCompleto} value={resumen.checklistCompletos} icon={CheckCircle} />
              <Kpi label={T.salarioPromedio} value={dinero(resumen.salarioPromedio, T.sinSalarioRegistrado, locale === 'en')} icon={CurrencyDollar} />
            </div>
          )}
          <div className="relative max-w-xl">
            <MagnifyingGlass className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input className="pl-9" value={q} onChange={(event) => setQ(event.target.value)} placeholder={T.buscarParticipanteEmpresa} />
          </div>
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{T.vinculacionesActivas(filtrados.length)}</CardTitle>
              <CardDescription>{T.esteModuloReemplaza}</CardDescription>
            </CardHeader>
            <CardContent>
              {filtrados.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{T.noHayColocaciones}</div>
              ) : (
                <div className="divide-y rounded-xl border">
                  {filtrados.map((registro) => (
                    <div key={registro.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/estudiantes/${registro.estudianteId}`} className="font-semibold text-foreground hover:text-primary hover:underline">{registro.estudianteNombre}</Link>
                          <Badge variant="outline" className="text-[10px]">{registro.tipoVinculacionEtiqueta}</Badge>
                          {registro.gestionadaPorElPrograma && <span className="text-[10px] font-medium text-emerald-700">{T.gestionadaPorEl}</span>}
                        </div>
                        <p className="mt-1 text-sm text-foreground">{registro.empresaNombre}{registro.cargo ? ` · ${registro.cargo}` : ''}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{T.inicioX(registro.fechaInicio || T.porConfirmar)} · {registro.canalConsecucionEtiqueta || T.canalSinRegistrar} · {registro.modalidad || T.modalidadSinRegistrar}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{T.checklistX(registro.checklistVerificados, registro.checklistTotal, registro.checklistResumen)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
                        <p className="mr-auto text-sm font-semibold lg:mr-0">{dinero(registro.salario, T.sinSalarioRegistrado, locale === 'en')}</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => abrirEdicion(registro)}><Pencil className="size-3.5" /> {C.editar}</Button>
                          <Button variant="outline" size="sm" onClick={() => void cerrar(registro)}><XCircle className="size-3.5" /> {C.cerrar}</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Sheet open={abierto} onOpenChange={(open) => { setAbierto(open); if (!open) setEditandoId(null) }}>
        <SheetContent side="right" className="flex h-dvh w-full flex-col p-0 sm:max-w-2xl">
          <SheetHeader className="shrink-0 border-b border-border p-6">
            <SheetTitle>{editandoId ? T.editarColocacion : T.registrarColocacion}</SheetTitle>
            <SheetDescription>{editandoId ? T.editaLaVinculacion : T.guardaLaVinculacion}</SheetDescription>
          </SheetHeader>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={guardar}>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    <WarningCircle className="size-5 shrink-0" />{error}
                  </div>
                )}
                <section className="space-y-3">
                  <div><p className="text-sm font-semibold">{T.vinculacion}</p><p className="mt-1 text-xs text-muted-foreground">{T.identificaAlParticipante}</p></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                      <span className="mb-1.5 block text-xs font-medium">{T.participante}</span>
                      <select required disabled={Boolean(editandoId)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" value={form.estudianteId} onChange={(event) => setForm({ ...form, estudianteId: event.target.value })}>
                        <option value="">{T.seleccionaUnParticipante}</option>
                        {estudiantes.map((estudiante) => <option key={estudiante.id} value={estudiante.id}>{estudiante.nombre} {estudiante.apellido} · {estudiante.nivelIngles || T.inglesSinRegistrar}</option>)}
                      </select>
                    </label>
                    <label className="sm:col-span-2">
                      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Buildings className="size-3.5 text-primary" />{T.empresa}</span>
                      <Input required list="empresas-colocacion" value={form.empresaNombre} onChange={(event) => setForm({ ...form, empresaNombre: event.target.value })} placeholder={T.seleccionaOEscribe} />
                      <datalist id="empresas-colocacion">{empresas.map((empresa) => <option key={empresa.id} value={empresa.nombre}>{empresa.sector || T.sinSector}</option>)}</datalist>
                      <p className="mt-1 text-[11px] text-muted-foreground">{T.elListadoUsa}</p>
                    </label>
                    <label><span className="mb-1.5 block text-xs font-medium">{T.cargo}</span><Input value={form.cargo || ''} onChange={(event) => setForm({ ...form, cargo: event.target.value })} placeholder={T.cargoVinculado} /></label>
                    <label>
                      <span className="mb-1.5 block text-xs font-medium">{T.tipoDeVinculacion}</span>
                      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.tipoVinculacion || ''} onChange={(event) => setForm({ ...form, tipoVinculacion: event.target.value })}>
                        {(catalogos?.tiposVinculacion ?? []).map((t) => <option key={t.valor} value={t.valor}>{etiquetaDeTipo(T, C, t.valor, t.etiqueta)}</option>)}
                      </select>
                    </label>
                  </div>
                </section>

                <section className="space-y-3 border-t border-border pt-5">
                  <div><p className="text-sm font-semibold">{T.condicionesLaborales}</p><p className="mt-1 text-xs text-muted-foreground">{T.estosDatosAlimentan}</p></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label><span className="mb-1.5 block text-xs font-medium">{T.fechaDeInicio}</span><Input type="date" value={form.fechaInicio || ''} onChange={(event) => setForm({ ...form, fechaInicio: event.target.value })} /></label>
                    <label>
                      <span className="mb-1.5 block text-xs font-medium">{T.canalDeConsecucion}</span>
                      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.canalConsecucion || ''} onChange={(event) => setForm({ ...form, canalConsecucion: event.target.value })}>
                        <option value="">{C.sinRegistrar}</option>
                        {(catalogos?.canales ?? []).map((c) => <option key={c.valor} value={c.valor}>{etiquetaDeCanal(T, c.valor, c.etiqueta)}</option>)}
                      </select>
                    </label>
                    <label><span className="mb-1.5 block text-xs font-medium">{T.salarioMensualCop}</span><Input type="number" min="0" value={form.salario ?? ''} onChange={(event) => setForm({ ...form, salario: event.target.value ? Number(event.target.value) : null })} placeholder={T.ej2500000} /></label>
                    <label><span className="mb-1.5 block text-xs font-medium">{T.modalidad}</span><Input value={form.modalidad || ''} onChange={(event) => setForm({ ...form, modalidad: event.target.value })} placeholder={T.presencialRemotoO} maxLength={40} /></label>
                    <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">{T.tipoDeContrato}</span><Input value={form.tipoContrato || ''} onChange={(event) => setForm({ ...form, tipoContrato: event.target.value })} placeholder={T.indefinidoFijoPrestacion} maxLength={60} /></label>
                    <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">{T.bonificaciones}</span><Input value={form.bonificaciones || ''} onChange={(event) => setForm({ ...form, bonificaciones: event.target.value })} placeholder={T.bonificacionesEjemplo} maxLength={255} /></label>
                  </div>
                </section>

                <section className="space-y-3 border-t border-border pt-5">
                  <div><p className="text-sm font-semibold">{T.checklistIngreso}</p><p className="mt-1 text-xs text-muted-foreground">{T.checklistAyuda}</p></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      ['chkContrato', T.contratoFirmado],
                      ['chkVerificacionVacante', T.verificacionVacante],
                      ['chkBenchmark', T.benchmarkSalarial],
                      ['chkReglamentoInterno', T.reglamentoInterno],
                      ['chkColillaPago', T.primeraColillaPago],
                    ] as const).map(([campo, etiqueta]) => (
                      <label key={campo}>
                        <span className="mb-1.5 block text-xs font-medium">{etiqueta}</span>
                        <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={valorChecklist(form[campo])} onChange={(event) => cambiarChecklist(campo, event.target.value)}>
                          {opcionesChecklist.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="space-y-1.5 border-t border-border pt-5">
                  <label>
                    <span className="block text-sm font-semibold">{T.observaciones}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{T.anadeCondicionesPor}</span>
                    <Textarea className="mt-3 w-full rounded-md border border-input bg-background p-3 text-sm" value={form.observaciones || ''} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} placeholder={T.ejPendienteConfirmar} />
                  </label>
                </section>
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-background p-4">
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>{C.cancelar}</Button>
              <Button type="submit" disabled={guardando}>{guardando && <CircleNotch className="size-4 animate-spin" />}{guardando ? C.guardando : editandoId ? T.guardarCambios : T.registrarColocacion}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      {dialogo}
    </div>
  )
}
