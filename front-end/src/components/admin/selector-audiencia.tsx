'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Calendar,
  Check,
  GraduationCap,
  Layers,
  Search,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { estudiantesApi } from '@/lib/api'
import type { EstudianteResponse, ProgramaResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

export type TipoAudiencia = 'TODOS' | 'PROGRAMA' | 'COHORTE' | 'INDIVIDUAL'

export interface AudienciaSeleccionada {
  tipo: TipoAudiencia
  programaId?: string
  programaNombre?: string
  cohorte?: string
  estudianteIds: string[]
  estudiantes: Array<{ id: string; nombre: string; email?: string; programa?: string }>
}

interface SelectorAudienciaProps {
  programas: ProgramaResponse[]
  valorInicial?: Partial<AudienciaSeleccionada>
  onChange: (audiencia: AudienciaSeleccionada) => void
  className?: string
  mostrarCohortes?: boolean
}

export function SelectorAudiencia({
  programas,
  valorInicial,
  onChange,
  className,
  mostrarCohortes = true,
}: SelectorAudienciaProps) {
  const [tipo, setTipo] = useState<TipoAudiencia>(valorInicial?.tipo ?? 'TODOS')
  const [programaId, setProgramaId] = useState<string>(valorInicial?.programaId ?? '')
  const [cohorte, setCohorte] = useState<string>(valorInicial?.cohorte ?? '')
  const [estudiantesSeleccionados, setEstudiantesSeleccionados] = useState<
    Array<{ id: string; nombre: string; email?: string; programa?: string }>
  >(valorInicial?.estudiantes ?? [])

  // Búsqueda de estudiantes individuales
  const [busqueda, setBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<EstudianteResponse[]>([])
  const [buscando, setBuscando] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Notificar al padre cada vez que cambie la selección
  const notificar = useCallback(
    (
      nuevoTipo: TipoAudiencia,
      nuevoProgramaId: string,
      nuevaCohorte: string,
      nuevosEstudiantes: typeof estudiantesSeleccionados,
    ) => {
      const prog = programas.find((p) => p.id === nuevoProgramaId)
      onChange({
        tipo: nuevoTipo,
        programaId: nuevoTipo === 'PROGRAMA' ? nuevoProgramaId || undefined : undefined,
        programaNombre: nuevoTipo === 'PROGRAMA' ? prog?.nombre : undefined,
        cohorte: nuevoTipo === 'COHORTE' ? nuevaCohorte || undefined : undefined,
        estudianteIds: nuevoTipo === 'INDIVIDUAL' ? nuevosEstudiantes.map((e) => e.id) : [],
        estudiantes: nuevoTipo === 'INDIVIDUAL' ? nuevosEstudiantes : [],
      })
    },
    [onChange, programas],
  )

  const cambiarTipo = (nuevoTipo: TipoAudiencia) => {
    setTipo(nuevoTipo)
    notificar(nuevoTipo, programaId, cohorte, estudiantesSeleccionados)
  }

  const cambiarPrograma = (nuevoProgramaId: string) => {
    setProgramaId(nuevoProgramaId)
    notificar(tipo, nuevoProgramaId, cohorte, estudiantesSeleccionados)
  }

  const cambiarCohorte = (nuevaCohorte: string) => {
    setCohorte(nuevaCohorte)
    notificar(tipo, programaId, nuevaCohorte, estudiantesSeleccionados)
  }

  // Buscar estudiantes cuando escribe en modo individual
  useEffect(() => {
    if (tipo !== 'INDIVIDUAL' || !busqueda.trim()) {
      setResultadosBusqueda([])
      return
    }

    const timer = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await estudiantesApi.buscarAvanzado({
          q: busqueda.trim(),
          programaId: programaId || undefined,
          size: 8,
        })
        setResultadosBusqueda(res.content)
        setMenuAbierto(true)
      } catch {
        setResultadosBusqueda([])
      } finally {
        setBuscando(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [busqueda, programaId, tipo])

  const agregarEstudiante = (est: EstudianteResponse) => {
    if (estudiantesSeleccionados.some((e) => e.id === est.id)) return
    const nombreCompleto = `${est.nombre} ${est.apellido || ''}`.trim()
    const nuevos = [
      ...estudiantesSeleccionados,
      {
        id: est.id,
        nombre: nombreCompleto,
        email: est.email,
        programa: est.programaNombre ?? est.programaAcademico ?? undefined,
      },
    ]
    setEstudiantesSeleccionados(nuevos)
    setBusqueda('')
    setMenuAbierto(false)
    notificar(tipo, programaId, cohorte, nuevos)
  }

  const removerEstudiante = (id: string) => {
    const nuevos = estudiantesSeleccionados.filter((e) => e.id !== id)
    setEstudiantesSeleccionados(nuevos)
    notificar(tipo, programaId, cohorte, nuevos)
  }

  return (
    <div className={cn('space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-sm', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Audiencia y Destinatarios
        </span>
        <Badge variant="outline" className="bg-secondary/40 text-[11px] font-normal">
          {tipo === 'TODOS' && 'Todos los participantes activos'}
          {tipo === 'PROGRAMA' && (programas.find((p) => p.id === programaId)?.nombre || 'Selecciona un proyecto')}
          {tipo === 'COHORTE' && (cohorte ? `Cohorte: ${cohorte}` : 'Especifica la cohorte')}
          {tipo === 'INDIVIDUAL' && `${estudiantesSeleccionados.length} estudiante(s) seleccionado(s)`}
        </Badge>
      </div>

      {/* Pestañas de modo de segmentación */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Button
          type="button"
          size="sm"
          variant={tipo === 'TODOS' ? 'default' : 'outline'}
          onClick={() => cambiarTipo('TODOS')}
          className="flex h-9 items-center justify-center gap-1.5 text-xs font-medium"
        >
          <Users className="size-3.5" />
          <span>Todos</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant={tipo === 'PROGRAMA' ? 'default' : 'outline'}
          onClick={() => cambiarTipo('PROGRAMA')}
          className="flex h-9 items-center justify-center gap-1.5 text-xs font-medium"
        >
          <Layers className="size-3.5" />
          <span>Por Proyecto / Ruta</span>
        </Button>

        {mostrarCohortes && (
          <Button
            type="button"
            size="sm"
            variant={tipo === 'COHORTE' ? 'default' : 'outline'}
            onClick={() => cambiarTipo('COHORTE')}
            className="flex h-9 items-center justify-center gap-1.5 text-xs font-medium"
          >
            <Calendar className="size-3.5" />
            <span>Por Cohorte</span>
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          variant={tipo === 'INDIVIDUAL' ? 'default' : 'outline'}
          onClick={() => cambiarTipo('INDIVIDUAL')}
          className="flex h-9 items-center justify-center gap-1.5 text-xs font-medium"
        >
          <UserCheck className="size-3.5" />
          <span>Específico(s)</span>
        </Button>
      </div>

      {/* Sub-selector según el tipo activo */}
      {tipo === 'PROGRAMA' && (
        <div className="pt-1">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Selecciona el Proyecto o Ruta de destino:
            </span>
            <select
              value={programaId}
              onChange={(e) => cambiarPrograma(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">-- Elige un proyecto o iniciativa --</option>
              {programas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {tipo === 'COHORTE' && (
        <div className="pt-1">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Identificador o nombre de la cohorte (ej. 2026-1, BPO-Q3):
            </span>
            <Input
              value={cohorte}
              onChange={(e) => cambiarCohorte(e.target.value)}
              placeholder="Ej. 2026-1"
              className="h-9 text-xs"
            />
          </label>
        </div>
      )}

      {tipo === 'INDIVIDUAL' && (
        <div className="space-y-2.5 pt-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onFocus={() => {
                if (resultadosBusqueda.length > 0) setMenuAbierto(true)
              }}
              placeholder="Buscar estudiante por nombre, apellido, correo o documento…"
              className="h-9 pl-9 text-xs"
            />

            {/* Dropdown de resultados predictivos */}
            {menuAbierto && resultadosBusqueda.length > 0 && (
              <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                {resultadosBusqueda.map((est) => {
                  const yaEsta = estudiantesSeleccionados.some((e) => e.id === est.id)
                  const nombreCompleto = `${est.nombre} ${est.apellido || ''}`.trim()
                  const progNombre = est.programaNombre ?? est.programaAcademico
                  return (
                    <button
                      key={est.id}
                      type="button"
                      disabled={yaEsta}
                      onClick={() => agregarEstudiante(est)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition',
                        yaEsta
                          ? 'opacity-40 cursor-not-allowed bg-muted/30'
                          : 'hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{nombreCompleto}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {est.email || 'Sin correo'} {progNombre ? `· ${progNombre}` : ''}
                        </span>
                      </div>
                      {yaEsta ? (
                        <Check className="size-3.5 text-primary" />
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Seleccionar
                        </Badge>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Chips de estudiantes seleccionados */}
          {estudiantesSeleccionados.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {estudiantesSeleccionados.map((est) => (
                <Badge
                  key={est.id}
                  variant="secondary"
                  className="flex items-center gap-1.5 py-1 pl-2.5 pr-1.5 text-xs font-normal"
                >
                  <User className="size-3 text-primary" />
                  <span className="font-medium text-foreground">{est.nombre}</span>
                  {est.email && <span className="text-[10px] text-muted-foreground">({est.email})</span>}
                  <button
                    type="button"
                    onClick={() => removerEstudiante(est.id)}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEstudiantesSeleccionados([])
                  notificar(tipo, programaId, cohorte, [])
                }}
                className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10"
              >
                Limpiar lista
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Busca y añade uno o varios estudiantes para enviarles este mensaje de forma personalizada.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
