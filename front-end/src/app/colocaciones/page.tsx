'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from '@/compat/next-link'
import { BriefcaseIcon as Briefcase, BuildingsIcon as Buildings, CheckCircleIcon as CheckCircle, CircleNotchIcon as CircleNotch, CurrencyDollarIcon as CurrencyDollar, MagnifyingGlassIcon as MagnifyingGlass, PlusIcon as Plus, UsersIcon as Users, WarningCircleIcon as WarningCircle, XCircleIcon as XCircle } from '@phosphor-icons/react'
import { colocacionesApi, empresasApi, estudiantesApi, ApiCallError } from '@/lib/api'
import type { ColocacionRequest, ColocacionResponse, EmpresaResponse, EstudianteResponse, ResumenColocaciones } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Textarea } from '@/components/ui/textarea'

const vacia: ColocacionRequest = { estudianteId: '', empresaNombre: '', cargo: '', tipoVinculacion: 'EMPLEADO', fechaInicio: '', canalConsecucion: '', salario: null, modalidad: '', tipoContrato: '', observaciones: '' }
const tipos = [['EMPLEADO', 'Empleado'], ['PRACTICANTE', 'Practicante'], ['APRENDIZ', 'Aprendiz SENA'], ['CONTRATISTA', 'Prestación de servicios'], ['FORMACION', 'Vinculado a formación']]
const canales = [['OPEN_HOUSE', 'Open House'], ['VISITA_CAC', 'Visita - CAC'], ['FERIA', 'Feria de empleo'], ['ALIADO', 'Empresa aliada'], ['PORTAL', 'Portal / vacante del CRM'], ['LINKEDIN', 'LinkedIn'], ['AUTOGESTIONADO', 'Autogestionado'], ['OTRO', 'Otro']]

function dinero(valor: number | null) { return valor == null ? 'Sin salario registrado' : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor) }
function mensajeError(error: unknown, fallback: string) { return error instanceof ApiCallError ? error.body.message ?? `${fallback} (HTTP ${error.status}).` : fallback }
function Kpi({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Briefcase }) { return <Card className="shadow-none"><CardContent className="flex items-center gap-3 p-4"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div><p className="text-xl font-semibold text-foreground">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card> }

export default function ColocacionesPage() {
  const [registros, setRegistros] = useState<ColocacionResponse[]>([])
  const [resumen, setResumen] = useState<ResumenColocaciones | null>(null)
  const [estudiantes, setEstudiantes] = useState<EstudianteResponse[]>([])
  const [empresas, setEmpresas] = useState<EmpresaResponse[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState<ColocacionRequest>(vacia)

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const [lista, cifras, participantes, directorio] = await Promise.all([
        colocacionesApi.listar(), colocacionesApi.resumen(), estudiantesApi.buscarAvanzado({ page: 0, size: 250 }), empresasApi.buscar({ page: 0, size: 250 }),
      ])
      setRegistros(lista); setResumen(cifras); setEstudiantes(participantes.content); setEmpresas(directorio.content)
    } catch (err) { setError(mensajeError(err, 'No se pudo cargar el seguimiento de colocaciones.')) }
    finally { setCargando(false) }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const filtrados = useMemo(() => {
    const busqueda = q.trim().toLocaleLowerCase('es-CO')
    if (!busqueda) return registros
    return registros.filter((r) => [r.estudianteNombre, r.empresaNombre, r.cargo, r.canalConsecucionEtiqueta].filter(Boolean).some((v) => v!.toLocaleLowerCase('es-CO').includes(busqueda)))
  }, [q, registros])

  const abrirRegistro = () => { setForm(vacia); setAbierto(true); setError('') }
  const guardar = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    if (!form.estudianteId || !form.empresaNombre.trim()) return
    setGuardando(true); setError('')
    try {
      await colocacionesApi.registrar({ ...form, empresaNombre: form.empresaNombre.trim(), cargo: form.cargo?.trim() || null, fechaInicio: form.fechaInicio || null, canalConsecucion: form.canalConsecucion || null, salario: form.salario || null, modalidad: form.modalidad?.trim() || null, tipoContrato: form.tipoContrato?.trim() || null, observaciones: form.observaciones?.trim() || null })
      setAbierto(false); await cargar()
    } catch (err) { setError(mensajeError(err, 'No se pudo registrar la colocación.')) }
    finally { setGuardando(false) }
  }
  const cerrar = async (registro: ColocacionResponse) => {
    if (!confirm(`¿Cerrar la vinculación de ${registro.estudianteNombre} en ${registro.empresaNombre}? El historial se conserva.`)) return
    try { await colocacionesApi.cerrar(registro.id); await cargar() } catch (err) { setError(mensajeError(err, 'No se pudo cerrar la colocación.')) }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Seguimiento de empleabilidad</p><p className="text-sm text-muted-foreground">Vinculaciones verificadas, condiciones laborales y checklist de ingreso.</p></div><Button onClick={abrirRegistro}><Plus /> Registrar colocación</Button></div>
    {error && <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><WarningCircle className="size-5 shrink-0" />{error}</div>}
    {cargando ? <PageSpinner label="Cargando colocaciones…" /> : <>
      {resumen && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Kpi label="Colocaciones vigentes" value={resumen.total} icon={Briefcase} /><Kpi label="Sobre la meta salarial" value={resumen.sobreMeta} icon={CurrencyDollar} /><Kpi label="Gestionadas por Academy CAC" value={resumen.gestionadasPorElPrograma} icon={Users} /><Kpi label="Checklist completo" value={resumen.checklistCompletos} icon={CheckCircle} /><Kpi label="Salario promedio" value={dinero(resumen.salarioPromedio)} icon={CurrencyDollar} /></div>}
      <div className="relative max-w-xl"><MagnifyingGlass className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar participante, empresa o cargo" /></div>
      <Card className="shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base">Vinculaciones activas ({filtrados.length})</CardTitle><CardDescription>Este módulo reemplaza el listado manual de vinculados y colocados.</CardDescription></CardHeader><CardContent>{filtrados.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No hay colocaciones que coincidan con la búsqueda.</div> : <div className="divide-y rounded-xl border">{filtrados.map((registro) => <div key={registro.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={`/estudiantes/${registro.estudianteId}`} className="font-semibold text-foreground hover:text-primary hover:underline">{registro.estudianteNombre}</Link><Badge variant="outline" className="text-[10px]">{registro.tipoVinculacionEtiqueta}</Badge>{registro.gestionadaPorElPrograma && <span className="text-[10px] font-medium text-emerald-700">Gestionada por el programa</span>}</div><p className="mt-1 text-sm text-foreground">{registro.empresaNombre}{registro.cargo ? ` · ${registro.cargo}` : ''}</p><p className="mt-1 text-xs text-muted-foreground">Inicio: {registro.fechaInicio || 'Por confirmar'} · {registro.canalConsecucionEtiqueta || 'Canal sin registrar'} · {registro.modalidad || 'Modalidad sin registrar'}</p><p className="mt-1 text-xs text-muted-foreground">Checklist: {registro.checklistVerificados}/{registro.checklistTotal} · {registro.checklistResumen}</p></div><div className="flex items-center gap-3 lg:flex-col lg:items-end"><p className="text-sm font-semibold">{dinero(registro.salario)}</p><Button variant="outline" size="sm" onClick={() => void cerrar(registro)}><XCircle className="size-3.5" /> Cerrar</Button></div></div>)}</div>}</CardContent></Card>
    </>}
    <Sheet open={abierto} onOpenChange={setAbierto}><SheetContent side="right" className="flex h-dvh w-full flex-col p-0 sm:max-w-2xl"><SheetHeader className="shrink-0 border-b border-border p-6"><SheetTitle>Registrar colocación</SheetTitle><SheetDescription>Guarda la vinculación laboral con datos completos para el seguimiento de empleabilidad.</SheetDescription></SheetHeader><form className="flex min-h-0 flex-1 flex-col" onSubmit={guardar}><div className="flex-1 overflow-y-auto p-6"><div className="space-y-6"><section className="space-y-3"><div><p className="text-sm font-semibold">Vinculación</p><p className="mt-1 text-xs text-muted-foreground">Identifica al participante y la empresa donde se incorporó.</p></div><div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">Participante *</span><select required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.estudianteId} onChange={(event) => setForm({ ...form, estudianteId: event.target.value })}><option value="">Selecciona un participante</option>{estudiantes.map((estudiante) => <option key={estudiante.id} value={estudiante.id}>{estudiante.nombre} {estudiante.apellido} · {estudiante.nivelIngles || 'Inglés sin registrar'}</option>)}</select></label><label className="sm:col-span-2"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Buildings className="size-3.5 text-primary" />Empresa *</span><Input required list="empresas-colocacion" value={form.empresaNombre} onChange={(event) => setForm({ ...form, empresaNombre: event.target.value })} placeholder="Selecciona o escribe el nombre de una empresa" /><datalist id="empresas-colocacion">{empresas.map((empresa) => <option key={empresa.id} value={empresa.nombre}>{empresa.sector || 'Sin sector'}</option>)}</datalist><p className="mt-1 text-[11px] text-muted-foreground">El listado usa el directorio de empresas; también puedes registrar una empresa nueva.</p></label><label><span className="mb-1.5 block text-xs font-medium">Cargo</span><Input value={form.cargo || ''} onChange={(event) => setForm({ ...form, cargo: event.target.value })} placeholder="Cargo vinculado" /></label><label><span className="mb-1.5 block text-xs font-medium">Tipo de vinculación</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.tipoVinculacion || ''} onChange={(event) => setForm({ ...form, tipoVinculacion: event.target.value })}>{tipos.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}</select></label></div></section><section className="space-y-3 border-t border-border pt-5"><div><p className="text-sm font-semibold">Condiciones laborales</p><p className="mt-1 text-xs text-muted-foreground">Estos datos alimentan los indicadores de empleabilidad del programa.</p></div><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-medium">Fecha de inicio</span><Input type="date" value={form.fechaInicio || ''} onChange={(event) => setForm({ ...form, fechaInicio: event.target.value })} /></label><label><span className="mb-1.5 block text-xs font-medium">Canal de consecución</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.canalConsecucion || ''} onChange={(event) => setForm({ ...form, canalConsecucion: event.target.value })}><option value="">Sin registrar</option>{canales.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-medium">Salario mensual (COP)</span><Input type="number" min="0" value={form.salario ?? ''} onChange={(event) => setForm({ ...form, salario: event.target.value ? Number(event.target.value) : null })} placeholder="Ej. 2500000" /></label><label><span className="mb-1.5 block text-xs font-medium">Modalidad</span><Input value={form.modalidad || ''} onChange={(event) => setForm({ ...form, modalidad: event.target.value })} placeholder="Presencial, remoto o híbrido" /></label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">Tipo de contrato</span><Input value={form.tipoContrato || ''} onChange={(event) => setForm({ ...form, tipoContrato: event.target.value })} placeholder="Indefinido, fijo, prestación de servicios…" /></label></div></section><section className="space-y-1.5 border-t border-border pt-5"><label><span className="block text-sm font-semibold">Observaciones</span><span className="mt-1 block text-xs text-muted-foreground">Añade condiciones por verificar, compromisos o cualquier contexto útil.</span><Textarea className="mt-3 w-full rounded-md border border-input bg-background p-3 text-sm" value={form.observaciones || ''} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} placeholder="Ej. pendiente confirmar fecha de inicio con la empresa…" /></label></section></div></div><div className="flex shrink-0 justify-end gap-2 border-t border-border bg-background p-4"><Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button><Button type="submit" disabled={guardando}>{guardando && <CircleNotch className="size-4 animate-spin" />}{guardando ? 'Guardando…' : 'Registrar colocación'}</Button></div></form></SheetContent></Sheet>
  </div>
}
