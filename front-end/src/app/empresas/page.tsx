'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowSquareOut,
  Buildings,
  CaretLeft,
  CaretRight,
  CheckCircle,
  CircleNotch,
  EnvelopeSimple,
  Funnel,
  MagnifyingGlass,
  MapPin,
  Plus,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react'
import { empresasApi, ApiCallError } from '@/lib/api'
import type { EmpresaRequest, EmpresaResponse, EstadoRelacionEmpresa, Page } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type Vista = 'sector' | 'contactadas'

const ESTADOS: Array<{ valor: EstadoRelacionEmpresa; etiqueta: string }> = [
  { valor: 'SIN_CONTACTAR', etiqueta: 'Sin contactar' },
  { valor: 'CONTACTADA', etiqueta: 'Contactada' },
  { valor: 'PERFIL_ENVIADO', etiqueta: 'Perfil enviado' },
  { valor: 'EN_CONVERSACION', etiqueta: 'En conversación' },
  { valor: 'ALIADA', etiqueta: 'Aliada' },
  { valor: 'DESCARTADA', etiqueta: 'Descartada' },
]

const vacia: EmpresaRequest = {
  nombre: '', sector: '', ciudad: '', sitioWeb: '', telefono: '', email: '', direccion: '',
  contactoNombre: '', contactoEmail: '', contactoCanal: '', fechaPrimerContacto: '',
  estadoRelacion: 'SIN_CONTACTAR', proximoPaso: '', notas: '', cargosTipicos: '', canalPostulacion: '',
}

function aFormulario(empresa: EmpresaResponse): EmpresaRequest {
  return {
    nombre: empresa.nombre,
    sector: empresa.sector ?? '', ciudad: empresa.ciudad ?? '', sitioWeb: empresa.sitioWeb ?? '',
    telefono: empresa.telefono ?? '', email: empresa.email ?? '', direccion: empresa.direccion ?? '',
    contactoNombre: empresa.contactoNombre ?? '', contactoEmail: empresa.contactoEmail ?? '',
    contactoCanal: empresa.contactoCanal ?? '', fechaPrimerContacto: empresa.fechaPrimerContacto ?? '',
    estadoRelacion: empresa.estadoRelacion, proximoPaso: empresa.proximoPaso ?? '', notas: empresa.notas ?? '',
    cargosTipicos: empresa.cargosTipicos ?? '', canalPostulacion: empresa.canalPostulacion ?? '',
  }
}

function errorDe(error: unknown, fallback: string) {
  if (error instanceof ApiCallError) return error.body.message ?? `${fallback} (HTTP ${error.status}).`
  return error instanceof Error ? error.message : fallback
}

function Kpi({ label, value, tone = 'text-primary' }: { label: string; value: number; tone?: string }) {
  return <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm"><p className={`text-xl font-semibold ${tone}`}>{value}</p><p className="mt-0.5 text-xs text-muted-foreground">{label}</p></div>
}

export default function EmpresasPage() {
  const [datos, setDatos] = useState<Page<EmpresaResponse> | null>(null)
  const [sectores, setSectores] = useState<string[]>([])
  const [pagina, setPagina] = useState(0)
  const [vista, setVista] = useState<Vista>('sector')
  const [q, setQ] = useState('')
  const [sector, setSector] = useState('')
  const [estado, setEstado] = useState<EstadoRelacionEmpresa | ''>('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [seleccionada, setSeleccionada] = useState<EmpresaResponse | null>(null)
  const [form, setForm] = useState<EmpresaRequest>(vacia)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [nota, setNota] = useState('')
  const [paso, setPaso] = useState('')
  const [estadoContacto, setEstadoContacto] = useState<EstadoRelacionEmpresa>('CONTACTADA')
  const [registrandoContacto, setRegistrandoContacto] = useState(false)

  const cargar = useCallback(async (p = 0) => {
    setCargando(true); setError('')
    try {
      const filtroEstado = vista === 'contactadas' && !estado ? 'CONTACTADA' : estado || undefined
      const [lista, sectoresDisponibles] = await Promise.all([
        empresasApi.buscar({ texto: q.trim() || undefined, sector: sector || undefined, estado: filtroEstado, page: p, size: 12 }),
        empresasApi.sectores(),
      ])
      setDatos(lista); setSectores(sectoresDisponibles); setPagina(p)
    } catch (e) {
      setError(errorDe(e, 'No se pudo cargar el directorio de empresas.'))
    } finally { setCargando(false) }
  }, [estado, q, sector, vista])

  useEffect(() => {
    const timer = window.setTimeout(() => { void cargar(0) }, 220)
    return () => window.clearTimeout(timer)
  }, [cargar])

  const empresas = useMemo(() => {
    if (vista !== 'contactadas') return datos?.content ?? []
    return (datos?.content ?? []).filter((empresa) => empresa.estadoRelacion !== 'SIN_CONTACTAR')
  }, [datos, vista])

  const abrir = (empresa: EmpresaResponse) => {
    setSeleccionada(empresa); setForm(aFormulario(empresa)); setEditando(true)
    setNota(''); setPaso(empresa.proximoPaso ?? ''); setEstadoContacto(empresa.estadoRelacion)
  }

  const nuevo = () => {
    setSeleccionada(null); setForm(vacia); setEditando(true)
    setNota(''); setPaso(''); setEstadoContacto('CONTACTADA')
  }

  const cerrarDrawer = (open: boolean) => {
    if (!open) { setEditando(false); setSeleccionada(null) }
  }

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault()
    setGuardando(true); setError('')
    try {
      if (seleccionada) await empresasApi.actualizar(seleccionada.id, form)
      else await empresasApi.crear(form)
      setEditando(false); setSeleccionada(null)
      await cargar(pagina)
    } catch (e) { setError(errorDe(e, 'No se pudo guardar la empresa.')) }
    finally { setGuardando(false) }
  }

  const registrarContacto = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!seleccionada) return
    setRegistrandoContacto(true); setError('')
    try {
      const actualizada = await empresasApi.registrarContacto(seleccionada.id, {
        estado: estadoContacto, proximoPaso: paso.trim() || undefined, nota: nota.trim() || undefined,
      })
      setSeleccionada(actualizada); setForm(aFormulario(actualizada)); setNota('')
      await cargar(pagina)
    } catch (e) { setError(errorDe(e, 'No se pudo registrar el acercamiento.')) }
    finally { setRegistrandoContacto(false) }
  }

  const cambiarVista = (proxima: Vista) => {
    setVista(proxima); setPagina(0)
    if (proxima === 'contactadas' && !estado) setEstado('CONTACTADA')
    if (proxima === 'sector' && estado === 'CONTACTADA') setEstado('')
  }

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><p className="text-sm text-muted-foreground">Directorio y relacionamiento empresarial</p><p className="mt-1 text-sm text-muted-foreground">Organiza sectores, empresas vinculadas y el siguiente paso de cada contacto.</p></div>
      <Button onClick={nuevo}><Plus className="size-4" /> Nueva empresa</Button>
    </div>

    <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
      <button type="button" onClick={() => cambiarVista('sector')} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${vista === 'sector' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Empresas por sector</button>
      <button type="button" onClick={() => cambiarVista('contactadas')} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${vista === 'contactadas' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Empresas contactadas</button>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Empresas en esta vista" value={datos?.totalElements ?? 0} />
      <Kpi label="Con vacantes abiertas" value={empresas.filter((e) => e.vacantesAbiertas > 0).length} tone="text-emerald-600" />
      <Kpi label="Perfiles enviados" value={empresas.reduce((total, e) => total + e.participantesEnviados, 0)} tone="text-sky-600" />
      <Kpi label="Contrataciones registradas" value={empresas.reduce((total, e) => total + e.contratados, 0)} tone="text-violet-600" />
    </div>

    <Card className="shadow-none"><CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
      <div className="relative"><MagnifyingGlass className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar empresa, sector o cargo frecuente" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <label className="relative"><Funnel className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><select aria-label="Filtrar por sector" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" value={sector} onChange={(e) => setSector(e.target.value)}><option value="">Todos los sectores</option>{sectores.map((valor) => <option key={valor} value={valor}>{valor}</option>)}</select></label>
      <select aria-label="Filtrar por estado de relacion" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={estado} onChange={(e) => setEstado(e.target.value as EstadoRelacionEmpresa | '')}><option value="">Todos los estados</option>{ESTADOS.map((item) => <option key={item.valor} value={item.valor}>{item.etiqueta}</option>)}</select>
    </CardContent></Card>

    {error && <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><WarningCircle className="size-5 shrink-0" />{error}</div>}

    {cargando ? <PageSpinner label="Cargando empresas…" /> : empresas.length === 0 ? <Card className="border-dashed shadow-none"><CardContent className="py-14 text-center"><Buildings className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No hay empresas con estos filtros</p><p className="mt-1 text-sm text-muted-foreground">Prueba otro sector o registra la primera empresa.</p></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{empresas.map((empresa) => <button type="button" key={empresa.id} onClick={() => abrir(empresa)} className="text-left"><Card className="h-full border-border shadow-none transition hover:border-primary/50 hover:shadow-sm"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="flex items-center gap-2 text-base"><Buildings className="size-5 shrink-0 text-primary" /> <span className="truncate">{empresa.nombre}</span></CardTitle><CardDescription className="mt-1">{empresa.sector || 'Sector por definir'}{empresa.ciudad ? ` · ${empresa.ciudad}` : ''}</CardDescription></div><Badge variant={empresa.estadoRelacion === 'ALIADA' ? 'default' : 'outline'} className="shrink-0">{empresa.estadoRelacionEtiqueta}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-3 gap-2 border-y border-border py-3 text-center"><div><p className="text-sm font-semibold">{empresa.vacantesAbiertas}</p><p className="text-[10px] text-muted-foreground">vacantes</p></div><div><p className="text-sm font-semibold">{empresa.participantesEnviados}</p><p className="text-[10px] text-muted-foreground">perfiles</p></div><div><p className="text-sm font-semibold">{empresa.contratados}</p><p className="text-[10px] text-muted-foreground">colocados</p></div></div><p className="line-clamp-2 text-sm text-muted-foreground">{empresa.proximoPaso ? `Siguiente paso: ${empresa.proximoPaso}` : 'Sin próximo paso registrado.'}</p>{empresa.contactoNombre && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><UsersThree className="size-3.5" />{empresa.contactoNombre}</p>}</CardContent></Card></button>)}</div>}

    {datos && datos.totalPages > 1 && <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Página {datos.number + 1} de {datos.totalPages} · {datos.totalElements} empresas</span><div className="flex gap-2"><Button variant="outline" size="icon" disabled={pagina === 0} onClick={() => void cargar(pagina - 1)}><CaretLeft /></Button><Button variant="outline" size="icon" disabled={pagina >= datos.totalPages - 1} onClick={() => void cargar(pagina + 1)}><CaretRight /></Button></div></div>}

    <Sheet open={editando || !!seleccionada} onOpenChange={cerrarDrawer}><SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-2xl"><SheetHeader className="shrink-0 border-b border-border p-6"><SheetTitle>{seleccionada ? seleccionada.nombre : 'Nueva empresa'}</SheetTitle><SheetDescription>{seleccionada ? 'Actualiza la ficha o registra el siguiente acercamiento con esta empresa.' : 'Crea una ficha para centralizar el relacionamiento y la empleabilidad.'}</SheetDescription></SheetHeader><div className="flex-1 overflow-y-auto"><form onSubmit={guardar} className="space-y-6 p-6"><section className="space-y-3"><h3 className="text-sm font-semibold">Información de la empresa</h3><div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">Nombre *</span><Input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre comercial" /></label><label><span className="mb-1.5 block text-xs font-medium">Sector</span><Input value={form.sector ?? ''} onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder="BPO, turismo, tecnología…" /></label><label><span className="mb-1.5 block text-xs font-medium">Ciudad</span><Input value={form.ciudad ?? ''} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} placeholder="Cartagena" /></label><label><span className="mb-1.5 block text-xs font-medium">Correo corporativo</span><Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label><span className="mb-1.5 block text-xs font-medium">Teléfono</span><Input value={form.telefono ?? ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">Sitio web</span><Input value={form.sitioWeb ?? ''} onChange={(e) => setForm({ ...form, sitioWeb: e.target.value })} placeholder="https://…" /></label></div></section><section className="space-y-3 border-t border-border pt-5"><h3 className="text-sm font-semibold">Contacto y oportunidad</h3><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-medium">Contacto principal</span><Input value={form.contactoNombre ?? ''} onChange={(e) => setForm({ ...form, contactoNombre: e.target.value })} /></label><label><span className="mb-1.5 block text-xs font-medium">Correo del contacto</span><Input type="email" value={form.contactoEmail ?? ''} onChange={(e) => setForm({ ...form, contactoEmail: e.target.value })} /></label><label><span className="mb-1.5 block text-xs font-medium">Canal de contacto</span><Input value={form.contactoCanal ?? ''} onChange={(e) => setForm({ ...form, contactoCanal: e.target.value })} placeholder="Correo, LinkedIn, llamada…" /></label><label><span className="mb-1.5 block text-xs font-medium">Estado de relación</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.estadoRelacion ?? 'SIN_CONTACTAR'} onChange={(e) => setForm({ ...form, estadoRelacion: e.target.value as EstadoRelacionEmpresa })}>{ESTADOS.map((item) => <option key={item.valor} value={item.valor}>{item.etiqueta}</option>)}</select></label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">Cargos que suele abrir</span><Input value={form.cargosTipicos ?? ''} onChange={(e) => setForm({ ...form, cargosTipicos: e.target.value })} placeholder="Agente bilingüe, asesor comercial, hotelería…" /></label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">Próximo paso</span><Input value={form.proximoPaso ?? ''} onChange={(e) => setForm({ ...form, proximoPaso: e.target.value })} placeholder="Enviar perfiles, confirmar reunión…" /></label></div></section><div className="flex justify-end gap-2 border-t border-border pt-5"><Button type="button" variant="outline" onClick={() => cerrarDrawer(false)}>Cancelar</Button><Button type="submit" disabled={guardando}>{guardando && <CircleNotch className="size-4 animate-spin" />}{guardando ? 'Guardando…' : 'Guardar ficha'}</Button></div></form>{seleccionada && <section className="border-t border-border bg-muted/20 p-6"><div className="mb-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><CheckCircle className="size-4 text-primary" />Registrar acercamiento</h3><p className="mt-1 text-xs text-muted-foreground">El estado, la nota y el próximo paso quedan centralizados en esta relación.</p></div><form className="space-y-3" onSubmit={registrarContacto}><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-medium">Nuevo estado</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={estadoContacto} onChange={(e) => setEstadoContacto(e.target.value as EstadoRelacionEmpresa)}>{ESTADOS.map((item) => <option key={item.valor} value={item.valor}>{item.etiqueta}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-medium">Próximo paso</span><Input value={paso} onChange={(e) => setPaso(e.target.value)} placeholder="Ej. enviar dos perfiles" /></label></div><label><span className="mb-1.5 block text-xs font-medium">Nota del acercamiento</span><textarea className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Qué ocurrió en la llamada, correo o reunión…" /></label><Button type="submit" variant="outline" disabled={registrandoContacto}>{registrandoContacto && <CircleNotch className="size-4 animate-spin" />}Guardar acercamiento</Button></form>{seleccionada.notas && <div className="mt-5 rounded-lg border border-border bg-background p-3 text-sm"><p className="mb-1 text-xs font-medium text-muted-foreground">Notas registradas</p><p className="whitespace-pre-wrap text-muted-foreground">{seleccionada.notas}</p></div>}</section>}</div></SheetContent></Sheet>
  </div>
}
