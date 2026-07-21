'use client'

/**
 * Página de Estudiantes (CRUD Completo).
 *
 * Consume:
 *   GET  /api/v1/programas                          → lista programas para el selector
 *   GET  /api/v1/estudiantes?programaId=&page=&size= → lista paginada
 *   GET  /api/v1/estudiantes/{id}                   → detalle (usado al refrescar)
 *   POST /api/v1/estudiantes                         → crear
 *   PUT  /api/v1/estudiantes/{id}                   → editar
 *   DEL  /api/v1/estudiantes/{id}                   → soft-delete
 *   GET  /api/v1/matches?estudianteId=              → matches de empleo
 */

import { useState, useEffect, useCallback, useTransition } from 'react'
import {
  GraduationCap,
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  X,
  User,
  Briefcase,
  DollarSign,
  Trophy,
  RotateCcw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EstadoDot } from '@/components/ui/estado-dot'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { estudiantesApi, programasApi, matchesApi, ApiCallError } from '@/lib/api'
import type {
  EstudianteResponse,
  ProgramaResponse,
  EstudianteRequest,
  MatchResponse,
  Page,
  EstadoAcademico,
  EstadoEmpleabilidad,
} from '@/lib/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const estadoAcademicoLabels: Record<string, { label: string; dot: string; text: string }> = {
  ACTIVO:     { label: 'Activo',     dot: 'bg-navy-500', text: 'text-navy-600' },
  GRADUADO:   { label: 'Graduado',   dot: 'bg-navy-800', text: 'text-navy-800' },
  RETIRADO:   { label: 'Retirado',   dot: 'bg-red-600',  text: 'text-red-700' },
  EN_PROCESO: { label: 'En proceso', dot: 'bg-navy-300', text: 'text-navy-500' },
}

const estadoEmpLabels: Record<string, { label: string; dot: string; text: string }> = {
  EMPLEADO: { label: 'Empleado',        dot: 'bg-success',             text: 'text-[#0F6E56]' },
  BUSCANDO: { label: 'Buscando empleo', dot: 'bg-navy-400',            text: 'text-navy-600' },
  SIN_INFO: { label: 'Sin información', dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
}

const estadoFallback = { dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' }

const emptyForm: EstudianteRequest = {
  nombre: '', apellido: '', email: '', telefono: '', celular: '',
  ciudad: '', barrio: '', tipoDocumento: 'CC', numeroDocumento: '',
  fechaNacimiento: '', genero: '', nacionalidad: '', nivelEducativo: '',
  titulo: '', aniosExperiencia: 0, sectorExperiencia: '', ultimoCargo: '',
  perfilProfesional: '', sectorObjetivo: '', cargoObjetivo: '',
  disponibilidadMovilidad: false, clasificacionSisben: '', situacionLaboral: '',
  ingresoMensual: '', responsableEconomico: false, haTrabajado: false,
  tieneComputador: false, tieneInternet: false, motivacion: '',
  interesMigratorio: false, resultadoPruebaEscrita: '', resultadoPruebaOral: '',
  institucionEducativa: '', programaAcademico: '', areaFormacion: '',
  estadoFormacion: '', disponibilidadLaboral: '', estadoBusqueda: '',
  postulacionesEnviadas: 0, empresasContactadas: 0,
  estadoAcademico: 'ACTIVO', estadoEmpleabilidad: 'SIN_INFO', programaId: '',
}

function studentToForm(s: EstudianteResponse): EstudianteRequest {
  return {
    nombre: s.nombre, apellido: s.apellido, email: s.email,
    telefono: s.telefono ?? '', celular: s.celular ?? '',
    ciudad: s.ciudad ?? '', barrio: s.barrio ?? '',
    tipoDocumento: s.tipoDocumento ?? 'CC', numeroDocumento: s.numeroDocumento ?? '',
    fechaNacimiento: '', genero: '', nacionalidad: s.nacionalidad ?? '',
    nivelEducativo: s.nivelEducativo ?? '', titulo: s.titulo ?? '',
    aniosExperiencia: s.aniosExperiencia ?? 0, sectorExperiencia: s.sectorExperiencia ?? '',
    ultimoCargo: s.ultimoCargo ?? '', perfilProfesional: s.perfilProfesional ?? '',
    sectorObjetivo: s.sectorObjetivo ?? '', cargoObjetivo: s.cargoObjetivo ?? '',
    disponibilidadMovilidad: s.disponibilidadMovilidad ?? false,
    clasificacionSisben: s.clasificacionSisben ?? '', situacionLaboral: s.situacionLaboral ?? '',
    ingresoMensual: s.ingresoMensual ?? '', responsableEconomico: s.responsableEconomico ?? false,
    haTrabajado: s.haTrabajado ?? false, tieneComputador: s.tieneComputador ?? false,
    tieneInternet: s.tieneInternet ?? false, motivacion: s.motivacion ?? '',
    interesMigratorio: s.interesMigratorio ?? false,
    resultadoPruebaEscrita: s.resultadoPruebaEscrita ?? '',
    resultadoPruebaOral: s.resultadoPruebaOral ?? '',
    institucionEducativa: s.institucionEducativa ?? '',
    programaAcademico: s.programaAcademico ?? '', areaFormacion: s.areaFormacion ?? '',
    estadoFormacion: s.estadoFormacion ?? '', disponibilidadLaboral: s.disponibilidadLaboral ?? '',
    estadoBusqueda: s.estadoBusqueda ?? '',
    postulacionesEnviadas: s.postulacionesEnviadas ?? 0,
    empresasContactadas: s.empresasContactadas ?? 0,
    estadoAcademico: s.estadoAcademico ?? 'ACTIVO',
    estadoEmpleabilidad: s.estadoEmpleabilidad ?? 'SIN_INFO',
    programaId: s.programaId,
  }
}

// Componente auxiliar para campos de detalle
function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">{label}</span>
      <span className="font-medium text-foreground text-xs">{value ?? 'No registrado'}</span>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function EstudiantesPage() {
  const [programas, setProgramas]     = useState<ProgramaResponse[]>([])
  const [selectedPgm, setSelectedPgm] = useState('')
  const [page, setPage]               = useState<Page<EstudianteResponse> | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [verPapelera, setVerPapelera] = useState(false)

  // Filtros
  const [searchQuery, setSearchQuery]             = useState('')
  const [academicFilter, setAcademicFilter]       = useState('ALL')
  const [employabilityFilter, setEmployabilityFilter] = useState('ALL')

  // Formulario
  const [showForm, setShowForm]         = useState(false)
  const [formMode, setFormMode]         = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [form, setForm]                 = useState<EstudianteRequest>(emptyForm)
  const [formError, setFormError]       = useState<string | null>(null)
  const [formSuccess, setFormSuccess]   = useState<string | null>(null)
  const [formTab, setFormTab]           = useState<'basic' | 'edu' | 'socio'>('basic')
  const [isPending, startTransition]    = useTransition()

  // Drawer
  const [selected, setSelected]           = useState<EstudianteResponse | null>(null)
  const [matches, setMatches]             = useState<MatchResponse[]>([])
  const [matchesPendientes, setMatchesPendientes] = useState(0)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [detailTab, setDetailTab]         = useState<'personal' | 'academic' | 'socio' | 'matches'>('personal')

  // Eliminación
  const [deleting, setDeleting]       = useState<EstudianteResponse | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [executingMatching, setExecutingMatching] = useState(false)

  // Selección Masiva
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy]       = useState(false)

  // ── Cargar programas ──────────────────────────────────────────────────────
  useEffect(() => {
    programasApi.listar().then((list) => {
      setProgramas(list)
      if (list.length > 0) setSelectedPgm(list[0].id)
    }).catch(() => setError('No se pudieron cargar los programas.'))
  }, [])

  // ── Limpiar selección al cambiar de vista o filtros ───────────────────────
  useEffect(() => {
    setSelectedIds([])
  }, [selectedPgm, verPapelera, searchQuery, academicFilter, employabilityFilter, currentPage])

  // ── Cargar estudiantes ────────────────────────────────────────────────────
  const loadEstudiantes = useCallback(async (pgmId: string, pg: number, pap = false) => {
    if (!pgmId) return
    setLoading(true); setError(null)
    try {
      if (pap) {
        setPage(await estudiantesApi.listarPapelera(pgmId, pg))
      } else {
        setPage(await estudiantesApi.listar(pgmId, pg))
      }
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.status === 401 || err.status === 403
          ? 'Sin permisos. Inicia sesión como ADMIN o COORDINADOR.'
          : `Error al cargar estudiantes (HTTP ${err.status}).`)
      } else {
        setError('No se pudo conectar con el backend.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedPgm) { setCurrentPage(0); loadEstudiantes(selectedPgm, 0, verPapelera) }
  }, [selectedPgm, loadEstudiantes, verPapelera])

  // ── Matches ───────────────────────────────────────────────────────────────
  const loadMatches = async (estudianteId: string) => {
    setLoadingMatches(true)
    setMatchesPendientes(0)
    try {
      const [res, pendientes] = await Promise.all([
        matchesApi.listarPorEstudiante(estudianteId, 0, 50),
        matchesApi.contarPendientes(estudianteId).catch(() => 0),
      ])
      setMatches(res.content)
      setMatchesPendientes(pendientes)
    } catch { setMatches([]) }
    finally { setLoadingMatches(false) }
  }

  // ── Filtrado local ────────────────────────────────────────────────────────
  const filtered = (page?.content ?? []).filter((est) => {
    const q = searchQuery.toLowerCase().trim()
    const matchQ = !q ||
      est.nombre.toLowerCase().includes(q) ||
      est.apellido.toLowerCase().includes(q) ||
      est.email.toLowerCase().includes(q) ||
      (est.numeroDocumento?.includes(q)) ||
      (est.ciudad?.toLowerCase().includes(q))
    const matchAcad = academicFilter === 'ALL' || est.estadoAcademico === academicFilter
    const matchEmp  = employabilityFilter === 'ALL' || est.estadoEmpleabilidad === employabilityFilter
    return matchQ && matchAcad && matchEmp
  })

  // ── Abrir creación ────────────────────────────────────────────────────────
  const openCreate = () => {
    setFormMode('create'); setEditingId(null); setFormError(null); setFormSuccess(null)
    setForm({ ...emptyForm, programaId: selectedPgm }); setFormTab('basic'); setShowForm(true)
  }

  // ── Abrir edición ─────────────────────────────────────────────────────────
  const openEdit = (s: EstudianteResponse, e: React.MouseEvent) => {
    e.stopPropagation()
    setFormMode('edit'); setEditingId(s.id); setFormError(null); setFormSuccess(null)
    setForm(studentToForm(s)); setFormTab('basic'); setShowForm(true)
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault(); setFormError(null); setFormSuccess(null)
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio.'); setFormTab('basic'); return }
    if (!form.apellido.trim()) { setFormError('El apellido es obligatorio.'); setFormTab('basic'); return }
    if (!form.email.trim()) { setFormError('El email es obligatorio.'); setFormTab('basic'); return }
    if (!form.programaId) { setFormError('Selecciona un programa.'); setFormTab('basic'); return }

    startTransition(async () => {
      try {
        if (formMode === 'create') {
          await estudiantesApi.crear({ ...form })
          setFormSuccess('Estudiante registrado exitosamente.')
        } else if (editingId) {
          await estudiantesApi.actualizar(editingId, { ...form })
          setFormSuccess('Estudiante actualizado exitosamente.')
        }
        setTimeout(() => { setShowForm(false); loadEstudiantes(selectedPgm, currentPage, verPapelera) }, 800)
      } catch (err) {
        if (err instanceof ApiCallError) {
          if (err.status === 400) setFormError('Datos inválidos: ' + (err.body.message ?? 'verifica los campos.'))
          else if (err.status === 409) setFormError('Ya existe un estudiante con ese correo electrónico.')
          else if (err.status === 401 || err.status === 403) setFormError('Sin permisos para esta acción.')
          else setFormError(`Error del servidor (HTTP ${err.status}).`)
        } else {
          setFormError('No se pudo conectar con el backend.')
        }
      }
    })
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const openDelete = (s: EstudianteResponse, e: React.MouseEvent) => {
    e.stopPropagation(); setDeleting(s)
  }

  const executeDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      await estudiantesApi.eliminar(deleting.id)
      setDeleting(null); loadEstudiantes(selectedPgm, currentPage, verPapelera)
    } catch (err) {
      if (err instanceof ApiCallError) alert(`Error: ${err.body.message ?? `HTTP ${err.status}`}`)
      else alert('No se pudo conectar con el backend.')
    } finally { setDeletingBusy(false) }
  }

  // ── Restaurar desde papelera ──────────────────────────────────────────────
  const handleRestore = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await estudiantesApi.restaurar(id)
      loadEstudiantes(selectedPgm, currentPage, verPapelera)
    } catch (err) {
      alert('No se pudo restaurar el estudiante.')
    }
  }

  // ── Ejecutar matching bajo demanda ────────────────────────────────────────
  const handleEjecutarMatching = async () => {
    setExecutingMatching(true)
    try {
      const res = await matchesApi.ejecutarMatching()
      alert(`Matching ejecutado exitosamente. Se crearon ${res.matchesCreados} matches nuevos.`)
      if (selected) {
        loadMatches(selected.id)
      }
    } catch (err) {
      alert('Error al ejecutar el matching.')
    } finally {
      setExecutingMatching(false)
    }
  }

  // ── Marcar postulado en match ─────────────────────────────────────────────
  const handlePostularMatch = async (matchId: string) => {
    try {
      await matchesApi.marcarPostulado(matchId)
      if (selected) {
        loadMatches(selected.id)
      }
    } catch (err) {
      alert('Error al registrar la postulación.')
    }
  }

  // ── Selección y Acciones Masivas ──────────────────────────────────────────
  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filtered.map((est) => est.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`¿Deseas restaurar los ${selectedIds.length} estudiantes seleccionados?`)) return
    setBulkBusy(true)
    try {
      await Promise.all(selectedIds.map(id => estudiantesApi.restaurar(id)))
      alert('Estudiantes restaurados exitosamente.')
      setSelectedIds([])
      loadEstudiantes(selectedPgm, currentPage, verPapelera)
    } catch {
      alert('Ocurrió un error al restaurar algunos estudiantes.')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkDelete = async (permanente: boolean) => {
    if (selectedIds.length === 0) return
    const msg = permanente
      ? `¡ADVERTENCIA CRÍTICA! ¿Estás seguro de eliminar permanentemente a los ${selectedIds.length} estudiantes seleccionados?\nEsta acción es irreversible y removerá todos sus registros asociados.`
      : `¿Deseas mover a la papelera a los ${selectedIds.length} estudiantes seleccionados?`
    
    if (!confirm(msg)) return
    setBulkBusy(true)
    try {
      await estudiantesApi.eliminarMasivo(selectedIds, permanente)
      alert(permanente ? 'Estudiantes eliminados definitivamente.' : 'Estudiantes enviados a la papelera.')
      setSelectedIds([])
      loadEstudiantes(selectedPgm, currentPage, verPapelera)
    } catch {
      alert('Ocurrió un error al realizar la eliminación masiva.')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleSinglePermanentDelete = async (est: EstudianteResponse, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`¡ADVERTENCIA! ¿Estás seguro de eliminar permanentemente a ${est.nombre} ${est.apellido}?\nEsta acción es irreversible.`)) return
    try {
      await estudiantesApi.eliminarMasivo([est.id], true)
      alert('Estudiante eliminado permanentemente.')
      loadEstudiantes(selectedPgm, currentPage, verPapelera)
    } catch {
      alert('No se pudo eliminar al estudiante.')
    }
  }

  // ── Abrir detalles ────────────────────────────────────────────────────────
  const openDetails = (s: EstudianteResponse) => {
    setSelected(s); setDetailTab('personal'); setMatches([]); loadMatches(s.id)
  }

  // ── helpers de update ─────────────────────────────────────────────────────
  const f = (key: keyof EstudianteRequest, val: unknown) => setForm((prev) => ({ ...prev, [key]: val }))

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <GraduationCap className="size-5" />
            Estudiantes
          </h2>
          <p className="text-sm text-muted-foreground">
            Consulta y gestiona el registro de estudiantes por programa.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEjecutarMatching} disabled={executingMatching} className="shrink-0">
            {executingMatching ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1" />
                Ejecutando...
              </>
            ) : (
              <>
                <Trophy className="size-4 mr-1 text-primary" />
                Ejecutar Matching
              </>
            )}
          </Button>
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="size-4" /> Registrar
          </Button>
        </div>
      </div>

      {/* ── Formulario ─────────────────────────────────────────────────────── */}
      {showForm && (
        <Card className="rounded-xl shadow-sm border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{formMode === 'create' ? 'Nuevo Estudiante' : 'Editar Estudiante'}</CardTitle>
                <CardDescription>Campos con * son obligatorios. Navega entre las pestañas.</CardDescription>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary">
                <X className="size-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Tabs */}
            <div className="flex border-b border-border mb-5 -mx-6 px-6 gap-1">
              {([
                ['basic', 'Datos Básicos', User],
                ['edu', 'Educación y Experiencia', GraduationCap],
                ['socio', 'Socioeconómico y Metas', DollarSign],
              ] as const).map(([id, label, Icon]) => (
                <button key={id} type="button" onClick={() => setFormTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${formTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-5">
              {/* Pestaña: Datos Básicos */}
              {formTab === 'basic' && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-nombre" className="text-xs font-medium">Nombre *</label>
                    <Input id="f-nombre" required value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Ej: Carlos" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-apellido" className="text-xs font-medium">Apellido *</label>
                    <Input id="f-apellido" required value={form.apellido} onChange={(e) => f('apellido', e.target.value)} placeholder="Ej: Ramírez" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-email" className="text-xs font-medium">Email *</label>
                    <Input id="f-email" type="email" required value={form.email} onChange={(e) => f('email', e.target.value)} placeholder="correo@ejemplo.com" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-celular" className="text-xs font-medium">Celular</label>
                    <Input id="f-celular" value={form.celular ?? ''} onChange={(e) => f('celular', e.target.value)} placeholder="300 000 0000" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-telefono" className="text-xs font-medium">Teléfono fijo</label>
                    <Input id="f-telefono" value={form.telefono ?? ''} onChange={(e) => f('telefono', e.target.value)} placeholder="601 000 0000" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-tipodoc" className="text-xs font-medium">Tipo documento</label>
                    <select id="f-tipodoc" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.tipoDocumento ?? 'CC'} onChange={(e) => f('tipoDocumento', e.target.value)} disabled={isPending}>
                      <option value="CC">CC</option><option value="CE">CE</option><option value="NIT">NIT</option><option value="PASAPORTE">Pasaporte</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-numdoc" className="text-xs font-medium">N° documento</label>
                    <Input id="f-numdoc" value={form.numeroDocumento ?? ''} onChange={(e) => f('numeroDocumento', e.target.value)} placeholder="1234567890" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-nacionalidad" className="text-xs font-medium">Nacionalidad</label>
                    <Input id="f-nacionalidad" value={form.nacionalidad ?? ''} onChange={(e) => f('nacionalidad', e.target.value)} placeholder="Colombiana" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-genero" className="text-xs font-medium">Género</label>
                    <select id="f-genero" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.genero ?? ''} onChange={(e) => f('genero', e.target.value)} disabled={isPending}>
                      <option value="">— Seleccionar —</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-ciudad" className="text-xs font-medium">Ciudad</label>
                    <Input id="f-ciudad" value={form.ciudad ?? ''} onChange={(e) => f('ciudad', e.target.value)} placeholder="Bogotá" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-barrio" className="text-xs font-medium">Barrio</label>
                    <Input id="f-barrio" value={form.barrio ?? ''} onChange={(e) => f('barrio', e.target.value)} placeholder="Teusaquillo" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-programa" className="text-xs font-medium">Programa *</label>
                    <select id="f-programa" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.programaId} onChange={(e) => f('programaId', e.target.value)} required disabled={isPending || formMode === 'edit'}>
                      <option value="">Selecciona un programa</option>
                      {programas.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-estadoacad" className="text-xs font-medium">Estado académico</label>
                    <select id="f-estadoacad" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.estadoAcademico ?? 'ACTIVO'} onChange={(e) => f('estadoAcademico', e.target.value as EstadoAcademico)} disabled={isPending}>
                      <option value="ACTIVO">Activo</option><option value="GRADUADO">Graduado</option><option value="RETIRADO">Retirado</option><option value="EN_PROCESO">En proceso</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Pestaña: Educación y Experiencia */}
              {formTab === 'edu' && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-niveledu" className="text-xs font-medium">Nivel educativo</label>
                    <Input id="f-niveledu" value={form.nivelEducativo ?? ''} onChange={(e) => f('nivelEducativo', e.target.value)} placeholder="Profesional, Tecnólogo" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-titulo" className="text-xs font-medium">Título obtenido</label>
                    <Input id="f-titulo" value={form.titulo ?? ''} onChange={(e) => f('titulo', e.target.value)} placeholder="Ing. de Sistemas" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-instedu" className="text-xs font-medium">Institución educativa</label>
                    <Input id="f-instedu" value={form.institucionEducativa ?? ''} onChange={(e) => f('institucionEducativa', e.target.value)} placeholder="Universidad Nacional" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-areaform" className="text-xs font-medium">Área de formación</label>
                    <Input id="f-areaform" value={form.areaFormacion ?? ''} onChange={(e) => f('areaFormacion', e.target.value)} placeholder="Tecnología" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-estform" className="text-xs font-medium">Estado formación</label>
                    <Input id="f-estform" value={form.estadoFormacion ?? ''} onChange={(e) => f('estadoFormacion', e.target.value)} placeholder="Graduado, Cursando" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-aniosexp" className="text-xs font-medium">Años experiencia</label>
                    <Input id="f-aniosexp" type="number" min={0} value={form.aniosExperiencia ?? 0} onChange={(e) => f('aniosExperiencia', parseInt(e.target.value) || 0)} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-secexp" className="text-xs font-medium">Sector experiencia</label>
                    <Input id="f-secexp" value={form.sectorExperiencia ?? ''} onChange={(e) => f('sectorExperiencia', e.target.value)} placeholder="BPO, Tecnología" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-ultcargo" className="text-xs font-medium">Último cargo</label>
                    <Input id="f-ultcargo" value={form.ultimoCargo ?? ''} onChange={(e) => f('ultimoCargo', e.target.value)} placeholder="Asesor de Servicio" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-prescrita" className="text-xs font-medium">Prueba escrita</label>
                    <Input id="f-prescrita" value={form.resultadoPruebaEscrita ?? ''} onChange={(e) => f('resultadoPruebaEscrita', e.target.value)} placeholder="85%" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-proral" className="text-xs font-medium">Prueba oral</label>
                    <Input id="f-proral" value={form.resultadoPruebaOral ?? ''} onChange={(e) => f('resultadoPruebaOral', e.target.value)} placeholder="B2" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                    <label htmlFor="f-perfil" className="text-xs font-medium">Perfil profesional</label>
                    <textarea id="f-perfil" rows={3} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={form.perfilProfesional ?? ''} onChange={(e) => f('perfilProfesional', e.target.value)} placeholder="Descripción del perfil..." disabled={isPending} />
                  </div>
                </div>
              )}

              {/* Pestaña: Socioeconómico y Metas */}
              {formTab === 'socio' && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-sisben" className="text-xs font-medium">Clasificación SISBEN</label>
                    <Input id="f-sisben" value={form.clasificacionSisben ?? ''} onChange={(e) => f('clasificacionSisben', e.target.value)} placeholder="A1, B3" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-sitlab" className="text-xs font-medium">Situación laboral</label>
                    <Input id="f-sitlab" value={form.situacionLaboral ?? ''} onChange={(e) => f('situacionLaboral', e.target.value)} placeholder="Desempleado, Informal" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-ingreso" className="text-xs font-medium">Ingreso mensual</label>
                    <Input id="f-ingreso" value={form.ingresoMensual ?? ''} onChange={(e) => f('ingresoMensual', e.target.value)} placeholder="Ninguno, 1 SMLV" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-displab" className="text-xs font-medium">Disponibilidad laboral</label>
                    <Input id="f-displab" value={form.disponibilidadLaboral ?? ''} onChange={(e) => f('disponibilidadLaboral', e.target.value)} placeholder="Inmediata" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-estbus" className="text-xs font-medium">Estado de búsqueda</label>
                    <Input id="f-estbus" value={form.estadoBusqueda ?? ''} onChange={(e) => f('estadoBusqueda', e.target.value)} placeholder="Activa" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-cargoobj" className="text-xs font-medium">Cargo objetivo</label>
                    <Input id="f-cargoobj" value={form.cargoObjetivo ?? ''} onChange={(e) => f('cargoObjetivo', e.target.value)} placeholder="Asesor Bilingüe" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-secobj" className="text-xs font-medium">Sector objetivo</label>
                    <Input id="f-secobj" value={form.sectorObjetivo ?? ''} onChange={(e) => f('sectorObjetivo', e.target.value)} placeholder="BPO" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-postulaciones" className="text-xs font-medium">Postulaciones enviadas</label>
                    <Input id="f-postulaciones" type="number" min={0} value={form.postulacionesEnviadas ?? 0} onChange={(e) => f('postulacionesEnviadas', parseInt(e.target.value) || 0)} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-empresas" className="text-xs font-medium">Empresas contactadas</label>
                    <Input id="f-empresas" type="number" min={0} value={form.empresasContactadas ?? 0} onChange={(e) => f('empresasContactadas', parseInt(e.target.value) || 0)} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-estemp" className="text-xs font-medium">Empleabilidad</label>
                    <select id="f-estemp" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.estadoEmpleabilidad ?? 'SIN_INFO'} onChange={(e) => f('estadoEmpleabilidad', e.target.value as EstadoEmpleabilidad)} disabled={isPending}>
                      <option value="SIN_INFO">Sin información</option><option value="BUSCANDO">Buscando empleo</option><option value="EMPLEADO">Empleado</option>
                    </select>
                  </div>
                  {/* Checkboxes */}
                  <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {([
                      ['disponibilidadMovilidad', 'Disponibilidad de movilidad'],
                      ['responsableEconomico', 'Responsable económico del hogar'],
                      ['haTrabajado', 'Ha trabajado antes'],
                      ['tieneComputador', 'Tiene computador'],
                      ['tieneInternet', 'Tiene internet'],
                      ['interesMigratorio', 'Interés migratorio'],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input type="checkbox" checked={!!form[key]} onChange={(e) => f(key, e.target.checked)} disabled={isPending} className="size-3.5 accent-primary rounded" />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                    <label htmlFor="f-motivacion" className="text-xs font-medium">Motivación</label>
                    <textarea id="f-motivacion" rows={3} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={form.motivacion ?? ''} onChange={(e) => f('motivacion', e.target.value)} placeholder="Motivación del estudiante..." disabled={isPending} />
                  </div>
                </div>
              )}

              {/* Feedback */}
              {formError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div role="status" className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" /><span>{formSuccess}</span>
                </div>
              )}

              {/* Acciones */}
              <div className="col-span-full flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={isPending}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <><Loader2 className="size-4 animate-spin" /> Guardando…</> : formMode === 'create' ? 'Registrar' : 'Actualizar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Filtros ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Programa selector */}
        {programas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Programa:</span>
            {programas.map((p) => (
              <button key={p.id} type="button" onClick={() => setSelectedPgm(p.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${selectedPgm === p.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-secondary'}`}>
                {p.nombre}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 shrink-0">
          <Button
            variant={verPapelera ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => {
              const nuevaPapelera = !verPapelera
              setVerPapelera(nuevaPapelera)
              setCurrentPage(0)
            }}
          >
            {verPapelera ? (
              <>Ver Activos</>
            ) : (
              <>
                <Trash2 className="size-3.5 mr-1" />
                Ver Papelera
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadEstudiantes(selectedPgm, currentPage, verPapelera)} className="shrink-0">
            <RefreshCw className="size-3.5" /> Refrescar
          </Button>
        </div>
      </div>

      {/* Búsqueda y filtros */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" placeholder="Buscar nombre, email, documento…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-secondary/40" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground shrink-0" />
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={academicFilter} onChange={(e) => setAcademicFilter(e.target.value)} aria-label="Filtrar por estado académico">
            <option value="ALL">Todos (estado acad.)</option>
            <option value="ACTIVO">Activo</option><option value="GRADUADO">Graduado</option><option value="RETIRADO">Retirado</option><option value="EN_PROCESO">En proceso</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Briefcase className="size-3.5 text-muted-foreground shrink-0" />
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={employabilityFilter} onChange={(e) => setEmployabilityFilter(e.target.value)} aria-label="Filtrar por empleabilidad">
            <option value="ALL">Todas (empleabilidad)</option>
            <option value="SIN_INFO">Sin información</option><option value="BUSCANDO">Buscando</option><option value="EMPLEADO">Empleado</option>
          </select>
        </div>
      </div>

      {/* ── Estados ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Cargando estudiantes…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => loadEstudiantes(selectedPgm, currentPage)}><RefreshCw className="size-4" /> Reintentar</Button>
        </div>
      )}

      {/* Barra de acciones masivas */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="text-xs font-medium text-destructive-foreground">
            {selectedIds.length} estudiante(s) seleccionado(s)
          </span>
          <div className="flex gap-2">
            {verPapelera ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs bg-background hover:bg-secondary"
                  disabled={bulkBusy}
                  onClick={handleBulkRestore}
                >
                  <RotateCcw className="size-3.5 mr-1" /> Restaurar Seleccionados
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  disabled={bulkBusy}
                  onClick={() => handleBulkDelete(true)}
                >
                  <Trash2 className="size-3.5 mr-1" /> Eliminar Definitivamente
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                className="text-xs"
                disabled={bulkBusy}
                onClick={() => handleBulkDelete(false)}
              >
                <Trash2 className="size-3.5 mr-1" /> Eliminar Seleccionados
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      {!loading && !error && page && (
        <>
          {filtered.length === 0 ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 py-16">
                <GraduationCap className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {verPapelera
                    ? 'No hay estudiantes eliminados en la papelera para este programa.'
                    : 'No hay estudiantes que coincidan con la búsqueda.'}
                </p>
                {!verPapelera && (
                  <Button onClick={openCreate} variant="outline"><Plus className="size-4" /> Registrar el primero</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-4 py-3 text-left w-10">
                        <input
                          type="checkbox"
                          className="size-3.5 rounded border-gray-300 accent-primary cursor-pointer"
                          checked={filtered.length > 0 && selectedIds.length === filtered.length}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          aria-label="Seleccionar todos los estudiantes de esta página"
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Documento</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Empleabilidad</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ciudad</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((est) => {
                      const ai = estadoAcademicoLabels[est.estadoAcademico] ?? { label: est.estadoAcademico, ...estadoFallback }
                      const ei = estadoEmpLabels[est.estadoEmpleabilidad] ?? { label: est.estadoEmpleabilidad, ...estadoFallback }
                      return (
                        <tr key={est.id} onClick={() => openDetails(est)} className="hover:bg-secondary/30 transition-colors cursor-pointer">
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="size-3.5 rounded border-gray-300 accent-primary cursor-pointer"
                              checked={selectedIds.includes(est.id)}
                              onChange={() => handleSelectRow(est.id)}
                              aria-label={`Seleccionar a ${est.nombre}`}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">{est.nombre} {est.apellido}</td>
                          <td className="px-4 py-3 text-muted-foreground">{est.email}</td>
                          <td className="px-4 py-3 text-muted-foreground">{est.tipoDocumento && est.numeroDocumento ? `${est.tipoDocumento} ${est.numeroDocumento}` : '—'}</td>
                          <td className="px-4 py-3"><EstadoDot {...ai} /></td>
                          <td className="px-4 py-3"><EstadoDot {...ei} /></td>
                          <td className="px-4 py-3 text-muted-foreground">{est.ciudad ?? '—'}</td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex gap-1">
                              {verPapelera ? (
                                <>
                                  <button type="button" onClick={(e) => handleRestore(est.id, e)} title="Restaurar estudiante" aria-label={`Restaurar a ${est.nombre}`}
                                    className="inline-flex size-8 items-center justify-center rounded-md text-green-600 dark:text-green-400 transition-colors hover:bg-green-50 dark:hover:bg-green-950/20">
                                    <RotateCcw className="size-4" />
                                  </button>
                                  <button type="button" onClick={(e) => handleSinglePermanentDelete(est, e)} title="Eliminar permanentemente" aria-label={`Eliminar permanentemente a ${est.nombre}`}
                                    className="inline-flex size-8 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10">
                                    <Trash2 className="size-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button type="button" onClick={(e) => openEdit(est, e)} aria-label={`Editar a ${est.nombre}`}
                                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                                    <Edit2 className="size-4" />
                                  </button>
                                  <button type="button" onClick={(e) => openDelete(est, e)} aria-label={`Eliminar a ${est.nombre}`}
                                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                                    <Trash2 className="size-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {page.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <span className="text-xs text-muted-foreground">Página {page.number + 1} de {page.totalPages} · {page.totalElements} estudiantes</span>
                  <div className="flex gap-1">
                    <button type="button" disabled={page.number === 0}
                      onClick={() => { const p = currentPage - 1; setCurrentPage(p); loadEstudiantes(selectedPgm, p, verPapelera) }}
                      className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
                      <ChevronLeft className="size-4" />
                    </button>
                    <button type="button" disabled={page.number >= page.totalPages - 1}
                      onClick={() => { const p = currentPage + 1; setCurrentPage(p); loadEstudiantes(selectedPgm, p, verPapelera) }}
                      className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* ── Drawer de Detalles ─────────────────────────────────────────────── */}
      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          {selected && (
            <>
              <SheetHeader className="p-6 border-b border-border shrink-0">
                <div className="flex items-start gap-4">
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-lg shrink-0">
                    {selected.nombre[0]}{selected.apellido[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-base truncate">{selected.nombre} {selected.apellido}</SheetTitle>
                    <SheetDescription className="text-xs truncate">{selected.programaNombre ?? 'Programa'} · Registro: {new Date(selected.createdAt).toLocaleDateString('es-CO')}</SheetDescription>
                    <div className="flex gap-3 mt-2 flex-wrap">
                      <EstadoDot {...(estadoAcademicoLabels[selected.estadoAcademico] ?? { label: selected.estadoAcademico, ...estadoFallback })} />
                      <EstadoDot {...(estadoEmpLabels[selected.estadoEmpleabilidad] ?? { label: selected.estadoEmpleabilidad, ...estadoFallback })} />
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Tabs */}
              <div className="flex border-b border-border px-4 shrink-0">
                {([
                  ['personal', 'Personal', User],
                  ['academic', 'Académico', GraduationCap],
                  ['socio', 'Social', DollarSign],
                  ['matches', 'Matches', Trophy],
                ] as const).map(([id, label, Icon]) => (
                  <button key={id} type="button" onClick={() => setDetailTab(id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${detailTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                    <Icon className="size-3.5" /> {label}
                    {id === 'matches' && matchesPendientes > 0 && (
                      <span className="ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                        title={`${matchesPendientes} match(es) pendiente(s) de notificar`}>
                        {matchesPendientes}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* Personal */}
                {detailTab === 'personal' && (
                  <div className="flex flex-col gap-5">
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Identificación y Contacto</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label="Nombres" value={selected.nombre} />
                        <DetailField label="Apellidos" value={selected.apellido} />
                        <DetailField label="Email" value={selected.email} />
                        <DetailField label="Celular" value={selected.celular} />
                        <DetailField label="Teléfono" value={selected.telefono} />
                        <DetailField label="Documento" value={selected.tipoDocumento && selected.numeroDocumento ? `${selected.tipoDocumento} ${selected.numeroDocumento}` : null} />
                      </div>
                    </section>
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Ubicación</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label="Nacionalidad" value={selected.nacionalidad} />
                        <DetailField label="Ciudad" value={selected.ciudad} />
                        <DetailField label="Barrio" value={selected.barrio} />
                      </div>
                    </section>
                  </div>
                )}

                {/* Académico */}
                {detailTab === 'academic' && (
                  <div className="flex flex-col gap-5">
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Educación</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label="Nivel educativo" value={selected.nivelEducativo} />
                        <DetailField label="Título" value={selected.titulo} />
                        <DetailField label="Institución" value={selected.institucionEducativa} />
                        <DetailField label="Área formación" value={selected.areaFormacion} />
                        <DetailField label="Estado formación" value={selected.estadoFormacion} />
                        <DetailField label="Nivel inglés" value={selected.nivelIngles} />
                      </div>
                    </section>
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Pruebas</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label="Prueba escrita" value={selected.resultadoPruebaEscrita} />
                        <DetailField label="Prueba oral" value={selected.resultadoPruebaOral} />
                      </div>
                    </section>
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Experiencia Laboral</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label="Años experiencia" value={selected.aniosExperiencia != null ? `${selected.aniosExperiencia} años` : null} />
                        <DetailField label="Último cargo" value={selected.ultimoCargo} />
                        <DetailField label="Sector experiencia" value={selected.sectorExperiencia} />
                        <DetailField label="Cargo objetivo" value={selected.cargoObjetivo} />
                        <DetailField label="Sector objetivo" value={selected.sectorObjetivo} />
                        <DetailField label="Movilidad" value={selected.disponibilidadMovilidad != null ? (selected.disponibilidadMovilidad ? 'Sí' : 'No') : null} />
                      </div>
                      {selected.perfilProfesional && (
                        <div className="mt-2">
                          <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">Perfil profesional</span>
                          <p className="text-xs text-muted-foreground italic leading-relaxed whitespace-pre-wrap mt-0.5">{selected.perfilProfesional}</p>
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* Social */}
                {detailTab === 'socio' && (
                  <div className="flex flex-col gap-5">
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Socioeconómico</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label="SISBEN" value={selected.clasificacionSisben} />
                        <DetailField label="Situación laboral" value={selected.situacionLaboral} />
                        <DetailField label="Ingreso mensual" value={selected.ingresoMensual} />
                        <DetailField label="Responsable económico" value={selected.responsableEconomico != null ? (selected.responsableEconomico ? 'Sí' : 'No') : null} />
                        <DetailField label="Computador" value={selected.tieneComputador != null ? (selected.tieneComputador ? 'Sí' : 'No') : null} />
                        <DetailField label="Internet" value={selected.tieneInternet != null ? (selected.tieneInternet ? 'Sí' : 'No') : null} />
                      </div>
                    </section>
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Metas y Búsqueda</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label="Disponibilidad laboral" value={selected.disponibilidadLaboral} />
                        <DetailField label="Estado búsqueda" value={selected.estadoBusqueda} />
                        <DetailField label="Postulaciones" value={selected.postulacionesEnviadas} />
                        <DetailField label="Empresas contactadas" value={selected.empresasContactadas} />
                        <DetailField label="Interés migratorio" value={selected.interesMigratorio != null ? (selected.interesMigratorio ? 'Sí' : 'No') : null} />
                      </div>
                      {selected.motivacion && (
                        <div className="mt-2">
                          <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">Motivación</span>
                          <p className="text-xs text-muted-foreground italic leading-relaxed whitespace-pre-wrap mt-0.5">{selected.motivacion}</p>
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* Matches */}
                {detailTab === 'matches' && (
                  <div className="flex flex-col gap-4">
                    {loadingMatches ? (
                      <div className="flex flex-col items-center py-12 gap-2">
                        <Loader2 className="size-6 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">Cargando matches…</span>
                      </div>
                    ) : matches.length === 0 ? (
                      <div className="bg-card border border-border rounded-xl p-6 text-center flex flex-col items-center gap-3">
                        <Briefcase className="size-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">Sin matches de empleo registrados.</p>
                        <p className="text-xs text-muted-foreground max-w-xs">El sistema evalúa vacantes de forma programada según el perfil del estudiante.</p>
                      </div>
                    ) : (
                      matches.map((m) => (
                        <div key={m.id} className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                          <div className="flex flex-col items-center justify-center px-3 py-2 bg-secondary rounded-lg shrink-0">
                            <span className="text-base font-bold text-primary leading-none">{Number(m.puntaje).toFixed(0)}</span>
                            <span className="text-[9px] text-muted-foreground font-medium mt-0.5">pts</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-semibold text-foreground truncate">{m.vacanteTitulo}</h5>
                            <span className="block text-[11px] text-muted-foreground truncate">{m.vacanteEmpresa} · {m.vacanteUbicacion ?? 'Remoto'}</span>
                            <div className="flex gap-2 items-center mt-1.5">
                              {m.postulado
                                ? <Badge className="bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 text-[10px] py-0 px-1.5">Postulado</Badge>
                                : <Badge variant="outline" className="text-[10px] py-0 px-1.5">Pendiente</Badge>}
                              <span className="text-[10px] text-muted-foreground">{m.notificado ? '✓ Notificado' : 'No notificado'}</span>
                            </div>
                          </div>
                          {!m.postulado && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground shrink-0"
                              onClick={() => handlePostularMatch(m.id)}
                            >
                              Postularse
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-border shrink-0 flex justify-end gap-2">
                <Button variant="outline" onClick={() => { if (selected) openEdit(selected, { stopPropagation: () => {} } as React.MouseEvent) }}>
                  <Edit2 className="size-4" /> Editar
                </Button>
                <Button variant="outline" onClick={() => setSelected(null)}>Cerrar</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Modal de eliminación ───────────────────────────────────────────── */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !deletingBusy && setDeleting(null)} onKeyDown={(e) => e.key === 'Escape' && !deletingBusy && setDeleting(null)}>
          <div className="bg-card rounded-xl border border-border shadow-lg p-6 max-w-sm w-full flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <AlertCircle className="size-6 text-destructive shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-foreground">¿Confirmas la eliminación?</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Estás a punto de eliminar a <span className="font-semibold text-foreground">{deleting.nombre} {deleting.apellido}</span>.
                  Esta acción desactiva el registro (soft-delete) y es reversible en la base de datos.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>Cancelar</Button>
              <Button variant="destructive" onClick={executeDelete} disabled={deletingBusy}>
                {deletingBusy ? <><Loader2 className="size-4 animate-spin" /> Eliminando…</> : 'Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
