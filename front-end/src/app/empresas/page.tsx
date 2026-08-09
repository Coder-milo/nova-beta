'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from '@/compat/next-link'
import { ArrowSquareOutIcon as ArrowSquareOut, BuildingsIcon as Buildings, CaretLeftIcon as CaretLeft, CaretRightIcon as CaretRight, CheckCircleIcon as CheckCircle, CircleNotchIcon as CircleNotch, EnvelopeSimpleIcon as EnvelopeSimple, FunnelIcon as Funnel, MagnifyingGlassIcon as MagnifyingGlass, MapPinIcon as MapPin, PlusIcon as Plus, UploadSimpleIcon as UploadSimple, UsersThreeIcon as UsersThree, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
import { empresasApi } from '@/lib/api'
import { errorDe } from '@/lib/errores'
import type { EmpresaRequest, EmpresaResponse, EstadoRelacionEmpresa, OpcionCatalogo, Page } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'

type Vista = 'sector' | 'contactadas'

/**
 * Etiqueta de cada estado de relacion.
 *
 * Que estados existen lo dice el enum del backend, que es quien los valida al
 * guardar; como se leen, el diccionario. Si aparece uno que esta pantalla
 * todavia no conoce se usa la etiqueta del servidor: sale en espanol, pero
 * sale, en vez de quedar fuera del desplegable.
 */
function etiquetaDeEstado(T: ReturnType<typeof textos>, valor: string, respaldo: string): string {
  return ({
    SIN_CONTACTAR: T.sinContactar, CONTACTADA: T.contactada,
    PERFIL_ENVIADO: T.perfilEnviado, EN_CONVERSACION: T.enConversacion,
    ALIADA: T.aliada, DESCARTADA: T.descartada,
  } as Record<string, string>)[valor] ?? respaldo
}

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

function Kpi({ label, value, tone = 'text-primary' }: { label: string; value: number; tone?: string }) {
  return <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm"><p className={`text-xl font-semibold ${tone}`}>{value}</p><p className="mt-0.5 text-xs text-muted-foreground">{label}</p></div>
}

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion —Cancelar, Ciudad,
 * Guardando, los errores genericos— sale de `textosAdmin` y no se copia
 * aqui: catorce copias de la misma palabra son catorce traducciones que
 * pueden separarse.
 */
function textos(english: boolean) {
  return english
    ? {
        directorioYRelacionamiento: 'Company directory and relationships',
        buscarEmpresaSector: 'Search company, sector or usual role',
        filtrarPorEstado: 'Filter by relationship status',
        filtrarPorSector: 'Filter by sector',
        conVacantesAbiertas: 'With open vacancies',
        empresasEnEsta: 'Companies in this view',
        empresasContactadas: 'Companies contacted',
        empresasPorSector: 'Companies by sector',
        contratacionesRegistradas: 'Hires recorded',
        cargandoEmpresas: 'Loading companies…',
        noHayEmpresas: 'No companies match these filters',
        noSePudo: 'The company directory could not be loaded.',
        noSePudoX: 'The company could not be saved.',
        noSePudoXX: 'The outreach could not be recorded.',
        informacionDeLa: 'Company details',
        contactoYOportunidad: 'Contact and opportunity',
        contactoPrincipal: 'Main contact',
        correoDelContacto: 'Contact email',
        correoCorporativo: 'Corporate email',
        canalDeContacto: 'Contact channel',
        estadoDeRelacion: 'Relationship status',
        cargosQueSuele: 'Roles it usually opens',
        guardarFicha: 'Save record',
        sinContactar: 'Not contacted',
        perfilEnviado: 'Profile sent',
        perfilesEnviados: 'Profiles sent',
        sectorPorDefinir: 'Sector to be defined',
        nuevaEmpresa: 'New company',
        actualizaLaFicha: 'Update the record or log the next approach to this company.',
        creaUnaFicha: 'Create a record to keep the relationship and employability in one place.',
        nombreComercial: 'Trading name',
        queOcurrioEn: 'What happened on the call, email or meeting…',
        organizaSectoresEmpresas: 'Organise sectors, linked companies and the next step for each contact.',
        importarExcel: 'Import Excel',
        todosLosSectores: 'All sectors',
        todosLosEstados: 'All statuses',
        pruebaOtroSector: 'Try another sector, or add the first company.',
        vacantes: 'vacancies',
        perfiles: 'profiles',
        colocados: 'placed',
        sector: 'Sector',
        sitioWeb: 'Website',
        proximoPaso: 'Next step',
        registrarAcercamiento: 'Log an approach',
        elEstadoLa: 'The status, the note and the next step all stay on this relationship.',
        nuevoEstado: 'New status',
        notaDelAcercamiento: 'Note on the approach',
        notasRegistradas: 'Notes on record',
        guardarAcercamiento: 'Save approach',
        sinProximoPaso: 'No next step recorded.',
        siguientePaso: (paso: string) => `Next step: ${paso}`,
        aliada: 'Partner',
        contactada: 'Contacted',
        enConversacion: 'In conversation',
        descartada: 'Ruled out',
        bpoTurismoTecnologia: 'BPO, tourism, technology…',
        agenteBilingueAsesor: 'Bilingual agent, sales rep, hospitality…',
        correoLinkedinLlamada: 'Email, LinkedIn, call…',
        enviarPerfilesConfirmar: 'Send profiles, confirm meeting…',
        ejEnviarDos: 'e.g. send two profiles',
      }
    : {
        directorioYRelacionamiento: 'Directorio y relacionamiento empresarial',
        buscarEmpresaSector: 'Buscar empresa, sector o cargo frecuente',
        filtrarPorEstado: 'Filtrar por estado de relacion',
        filtrarPorSector: 'Filtrar por sector',
        conVacantesAbiertas: 'Con vacantes abiertas',
        empresasEnEsta: 'Empresas en esta vista',
        empresasContactadas: 'Empresas contactadas',
        empresasPorSector: 'Empresas por sector',
        contratacionesRegistradas: 'Contrataciones registradas',
        cargandoEmpresas: 'Cargando empresas…',
        noHayEmpresas: 'No hay empresas con estos filtros',
        noSePudo: 'No se pudo cargar el directorio de empresas.',
        noSePudoX: 'No se pudo guardar la empresa.',
        noSePudoXX: 'No se pudo registrar el acercamiento.',
        informacionDeLa: 'Información de la empresa',
        contactoYOportunidad: 'Contacto y oportunidad',
        contactoPrincipal: 'Contacto principal',
        correoDelContacto: 'Correo del contacto',
        correoCorporativo: 'Correo corporativo',
        canalDeContacto: 'Canal de contacto',
        estadoDeRelacion: 'Estado de relación',
        cargosQueSuele: 'Cargos que suele abrir',
        guardarFicha: 'Guardar ficha',
        sinContactar: 'Sin contactar',
        perfilEnviado: 'Perfil enviado',
        perfilesEnviados: 'Perfiles enviados',
        sectorPorDefinir: 'Sector por definir',
        nuevaEmpresa: 'Nueva empresa',
        actualizaLaFicha: 'Actualiza la ficha o registra el siguiente acercamiento con esta empresa.',
        creaUnaFicha: 'Crea una ficha para centralizar el relacionamiento y la empleabilidad.',
        nombreComercial: 'Nombre comercial',
        queOcurrioEn: 'Qué ocurrió en la llamada, correo o reunión…',
        organizaSectoresEmpresas: 'Organiza sectores, empresas vinculadas y el siguiente paso de cada contacto.',
        importarExcel: 'Importar Excel',
        todosLosSectores: 'Todos los sectores',
        todosLosEstados: 'Todos los estados',
        pruebaOtroSector: 'Prueba otro sector o registra la primera empresa.',
        vacantes: 'vacantes',
        perfiles: 'perfiles',
        colocados: 'colocados',
        sector: 'Sector',
        sitioWeb: 'Sitio web',
        proximoPaso: 'Próximo paso',
        registrarAcercamiento: 'Registrar acercamiento',
        elEstadoLa: 'El estado, la nota y el próximo paso quedan centralizados en esta relación.',
        nuevoEstado: 'Nuevo estado',
        notaDelAcercamiento: 'Nota del acercamiento',
        notasRegistradas: 'Notas registradas',
        guardarAcercamiento: 'Guardar acercamiento',
        sinProximoPaso: 'Sin próximo paso registrado.',
        siguientePaso: (paso: string) => `Siguiente paso: ${paso}`,
        aliada: 'Aliada',
        contactada: 'Contactada',
        enConversacion: 'En conversación',
        descartada: 'Descartada',
        bpoTurismoTecnologia: 'BPO, turismo, tecnología…',
        agenteBilingueAsesor: 'Agente bilingüe, asesor comercial, hotelería…',
        correoLinkedinLlamada: 'Correo, LinkedIn, llamada…',
        enviarPerfilesConfirmar: 'Enviar perfiles, confirmar reunión…',
        ejEnviarDos: 'Ej. enviar dos perfiles',
      }
}

export default function EmpresasPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [catalogoEstados, setCatalogoEstados] = useState<OpcionCatalogo[]>([])
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
      const [lista, sectoresDisponibles, estadosDisponibles] = await Promise.all([
        empresasApi.buscar({ texto: q.trim() || undefined, sector: sector || undefined, estado: filtroEstado, page: p, size: 12 }),
        empresasApi.sectores(),
        empresasApi.estadosRelacion(),
      ])
      setDatos(lista); setSectores(sectoresDisponibles); setPagina(p)
      setCatalogoEstados(estadosDisponibles)
    } catch (e) {
      setError(errorDe(e, T.noSePudo))
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

  const guardar = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    setGuardando(true); setError('')
    try {
      if (seleccionada) await empresasApi.actualizar(seleccionada.id, form)
      else await empresasApi.crear(form)
      setEditando(false); setSeleccionada(null)
      await cargar(pagina)
    } catch (e) { setError(errorDe(e, T.noSePudoX)) }
    finally { setGuardando(false) }
  }

  const registrarContacto = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    if (!seleccionada) return
    setRegistrandoContacto(true); setError('')
    try {
      const actualizada = await empresasApi.registrarContacto(seleccionada.id, {
        estado: estadoContacto, proximoPaso: paso.trim() || undefined, nota: nota.trim() || undefined,
      })
      setSeleccionada(actualizada); setForm(aFormulario(actualizada)); setNota('')
      await cargar(pagina)
    } catch (e) { setError(errorDe(e, T.noSePudoXX)) }
    finally { setRegistrandoContacto(false) }
  }

  const cambiarVista = (proxima: Vista) => {
    setVista(proxima); setPagina(0)
    if (proxima === 'contactadas' && !estado) setEstado('CONTACTADA')
    if (proxima === 'sector' && estado === 'CONTACTADA') setEstado('')
  }

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><p className="text-sm text-muted-foreground">{T.directorioYRelacionamiento}</p><p className="mt-1 text-sm text-muted-foreground">{T.organizaSectoresEmpresas}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/importaciones" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium transition hover:bg-secondary">
          <UploadSimple className="size-4 text-emerald-600" />
          {T.importarExcel}
        </Link>
        <Button onClick={nuevo}><Plus className="size-4" /> {T.nuevaEmpresa}</Button>
      </div>
    </div>

    <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
      <button type="button" onClick={() => cambiarVista('sector')} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${vista === 'sector' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{T.empresasPorSector}</button>
      <button type="button" onClick={() => cambiarVista('contactadas')} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${vista === 'contactadas' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{T.empresasContactadas}</button>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label={T.empresasEnEsta} value={datos?.totalElements ?? 0} />
      <Kpi label={T.conVacantesAbiertas} value={empresas.filter((e) => e.vacantesAbiertas > 0).length} tone="text-emerald-600" />
      <Kpi label={T.perfilesEnviados} value={empresas.reduce((total, e) => total + e.participantesEnviados, 0)} tone="text-sky-600" />
      <Kpi label={T.contratacionesRegistradas} value={empresas.reduce((total, e) => total + e.contratados, 0)} tone="text-violet-600" />
    </div>

    <Card className="shadow-none"><CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
      <div className="relative"><MagnifyingGlass className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" placeholder={T.buscarEmpresaSector} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <label className="relative"><Funnel className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><select aria-label={T.filtrarPorSector} className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" value={sector} onChange={(e) => setSector(e.target.value)}><option value="">{T.todosLosSectores}</option>{sectores.map((valor) => <option key={valor} value={valor}>{valor}</option>)}</select></label>
      <select aria-label={T.filtrarPorEstado} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={estado} onChange={(e) => setEstado(e.target.value as EstadoRelacionEmpresa | '')}><option value="">{T.todosLosEstados}</option>{catalogoEstados.map((item) => <option key={item.valor} value={item.valor}>{etiquetaDeEstado(T, item.valor, item.etiqueta)}</option>)}</select>
    </CardContent></Card>

    {error && <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><WarningCircle className="size-5 shrink-0" />{error}</div>}

    {cargando ? <PageSpinner label={T.cargandoEmpresas} /> : empresas.length === 0 ? <Card className="border-dashed shadow-none"><CardContent className="py-14 text-center"><Buildings className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">{T.noHayEmpresas}</p><p className="mt-1 text-sm text-muted-foreground">{T.pruebaOtroSector}</p></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{empresas.map((empresa) => <button type="button" key={empresa.id} onClick={() => abrir(empresa)} className="text-left"><Card className="h-full border-border shadow-none transition hover:border-primary/50 hover:shadow-sm"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="flex items-center gap-2 text-base"><Buildings className="size-5 shrink-0 text-primary" /> <span className="truncate">{empresa.nombre}</span></CardTitle><CardDescription className="mt-1">{empresa.sector || T.sectorPorDefinir}{empresa.ciudad ? ` · ${empresa.ciudad}` : ''}</CardDescription></div><Badge variant={empresa.estadoRelacion === 'ALIADA' ? 'default' : 'outline'} className="shrink-0">{empresa.estadoRelacionEtiqueta}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-3 gap-2 border-y border-border py-3 text-center"><div><p className="text-sm font-semibold">{empresa.vacantesAbiertas}</p><p className="text-[10px] text-muted-foreground">{T.vacantes}</p></div><div><p className="text-sm font-semibold">{empresa.participantesEnviados}</p><p className="text-[10px] text-muted-foreground">{T.perfiles}</p></div><div><p className="text-sm font-semibold">{empresa.contratados}</p><p className="text-[10px] text-muted-foreground">{T.colocados}</p></div></div><p className="line-clamp-2 text-sm text-muted-foreground">{empresa.proximoPaso ? T.siguientePaso(empresa.proximoPaso) : T.sinProximoPaso}</p>{empresa.contactoNombre && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><UsersThree className="size-3.5" />{empresa.contactoNombre}</p>}</CardContent></Card></button>)}</div>}

    {datos && datos.totalPages > 1 && <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Página {datos.number + 1} de {datos.totalPages} · {datos.totalElements} empresas</span><div className="flex gap-2"><Button variant="outline" size="icon" disabled={pagina === 0} onClick={() => void cargar(pagina - 1)}><CaretLeft /></Button><Button variant="outline" size="icon" disabled={pagina >= datos.totalPages - 1} onClick={() => void cargar(pagina + 1)}><CaretRight /></Button></div></div>}

    <Sheet open={editando || !!seleccionada} onOpenChange={cerrarDrawer}><SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-2xl"><SheetHeader className="shrink-0 border-b border-border p-6"><SheetTitle>{seleccionada ? seleccionada.nombre : T.nuevaEmpresa}</SheetTitle><SheetDescription>{seleccionada ? T.actualizaLaFicha : T.creaUnaFicha}</SheetDescription></SheetHeader><div className="flex-1 overflow-y-auto"><form onSubmit={guardar} className="space-y-6 p-6"><section className="space-y-3"><h3 className="text-sm font-semibold">{T.informacionDeLa}</h3><div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">{C.nombreObligatorio}</span><Input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder={T.nombreComercial} /></label><label><span className="mb-1.5 block text-xs font-medium">{T.sector}</span><Input value={form.sector ?? ''} onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder={T.bpoTurismoTecnologia} /></label><label><span className="mb-1.5 block text-xs font-medium">{C.ciudad}</span><Input value={form.ciudad ?? ''} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} placeholder="Cartagena" /></label><label><span className="mb-1.5 block text-xs font-medium">{T.correoCorporativo}</span><Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label><span className="mb-1.5 block text-xs font-medium">{C.telefono}</span><Input value={form.telefono ?? ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} maxLength={50} /></label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">{T.sitioWeb}</span><Input value={form.sitioWeb ?? ''} onChange={(e) => setForm({ ...form, sitioWeb: e.target.value })} placeholder="https://…" /></label></div></section><section className="space-y-3 border-t border-border pt-5"><h3 className="text-sm font-semibold">{T.contactoYOportunidad}</h3><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-medium">{T.contactoPrincipal}</span><Input value={form.contactoNombre ?? ''} onChange={(e) => setForm({ ...form, contactoNombre: e.target.value })} /></label><label><span className="mb-1.5 block text-xs font-medium">{T.correoDelContacto}</span><Input type="email" value={form.contactoEmail ?? ''} onChange={(e) => setForm({ ...form, contactoEmail: e.target.value })} /></label><label><span className="mb-1.5 block text-xs font-medium">{T.canalDeContacto}</span><Input value={form.contactoCanal ?? ''} onChange={(e) => setForm({ ...form, contactoCanal: e.target.value })} placeholder={T.correoLinkedinLlamada} /></label><label><span className="mb-1.5 block text-xs font-medium">{T.estadoDeRelacion}</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.estadoRelacion ?? 'SIN_CONTACTAR'} onChange={(e) => setForm({ ...form, estadoRelacion: e.target.value as EstadoRelacionEmpresa })}>{catalogoEstados.map((item) => <option key={item.valor} value={item.valor}>{etiquetaDeEstado(T, item.valor, item.etiqueta)}</option>)}</select></label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">{T.cargosQueSuele}</span><Input value={form.cargosTipicos ?? ''} onChange={(e) => setForm({ ...form, cargosTipicos: e.target.value })} placeholder={T.agenteBilingueAsesor} /></label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">{T.proximoPaso}</span><Input value={form.proximoPaso ?? ''} onChange={(e) => setForm({ ...form, proximoPaso: e.target.value })} placeholder={T.enviarPerfilesConfirmar} /></label></div></section><div className="flex justify-end gap-2 border-t border-border pt-5"><Button type="button" variant="outline" onClick={() => cerrarDrawer(false)}>{C.cancelar}</Button><Button type="submit" disabled={guardando}>{guardando && <CircleNotch className="size-4 animate-spin" />}{guardando ? C.guardando : T.guardarFicha}</Button></div></form>{seleccionada && <section className="border-t border-border bg-muted/20 p-6"><div className="mb-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><CheckCircle className="size-4 text-primary" />{T.registrarAcercamiento}</h3><p className="mt-1 text-xs text-muted-foreground">{T.elEstadoLa}</p></div><form className="space-y-3" onSubmit={registrarContacto}><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-medium">{T.nuevoEstado}</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={estadoContacto} onChange={(e) => setEstadoContacto(e.target.value as EstadoRelacionEmpresa)}>{catalogoEstados.map((item) => <option key={item.valor} value={item.valor}>{etiquetaDeEstado(T, item.valor, item.etiqueta)}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-medium">{T.proximoPaso}</span><Input value={paso} onChange={(e) => setPaso(e.target.value)} placeholder={T.ejEnviarDos} /></label></div><label><span className="mb-1.5 block text-xs font-medium">{T.notaDelAcercamiento}</span><Textarea className="w-full rounded-md border border-input bg-background p-3 text-sm" value={nota} onChange={(e) => setNota(e.target.value)} placeholder={T.queOcurrioEn} /></label><Button type="submit" variant="outline" disabled={registrandoContacto}>{registrandoContacto && <CircleNotch className="size-4 animate-spin" />}{T.guardarAcercamiento}</Button></form>{seleccionada.notas && <div className="mt-5 rounded-lg border border-border bg-background p-3 text-sm"><p className="mb-1 text-xs font-medium text-muted-foreground">{T.notasRegistradas}</p><p className="whitespace-pre-wrap text-muted-foreground">{seleccionada.notas}</p></div>}</section>}</div></SheetContent></Sheet>
  </div>
}
