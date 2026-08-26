'use client'

/**
 * Panel de vista previa interactiva y responsive para correos electrónicos.
 *
 * Características:
 * - Alternador fluido Escritorio (600px centrado) vs Móvil (375px con marco de smartphone).
 * - Renderizado en iframe con sandbox estricto para aislar estilos CSS y evitar scripts.
 * - Selector de perfiles de simulación: Datos ficticios estándar, casos de prueba y datos de estudiantes reales.
 * - Editor interactivo de variables ficticias personalizables.
 * - Disparador integrado para el modal de envío de prueba real.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  CircleAlert as WarningCircle,
  Eye,
  Laptop,
  Maximize2,
  Minimize2,
  Send as PaperPlaneTilt,
  RefreshCw as ArrowsClockwise,
  Sliders,
  Smartphone,
  User,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { usePreferences } from '@/lib/preferences'
import {
  PERFILES_SIMULACION_PREDETERMINADOS,
  envolverEnDocumentoEmail,
  interpolarVariables,
  type PerfilSimulacion,
} from '@/components/admin/bloques-correo'
import { ModalEnvioPrueba } from '@/components/admin/modal-envio-prueba'
import { estudiantesApi } from '@/lib/api'
import type { EstudianteResponse } from '@/lib/types'

export type ModoDispositivo = 'desktop' | 'mobile'

export interface PanelVistaPreviaEmailProps {
  asunto: string
  cuerpo: string
  botonTexto?: string | null
  botonUrl?: string | null
  programaId?: string | null
  htmlServidor?: string | null
  avisos?: string[]
  className?: string
}

/** Textos propios de este panel, en los dos idiomas. */
function textos(english: boolean) {
  return english
    ? {
        vistaPrevia: 'Interactive Email Preview',
        escritorio: 'Desktop (600px)',
        movil: 'Mobile (375px)',
        perfilSimulacion: 'Simulation Profile',
        datosPersonalizados: 'Custom Mock Data',
        estudianteReal: 'Real Student Data',
        enviarPrueba: 'Send Test Email',
        avisos: 'Pre-send notices',
        sinAsunto: '(No subject defined)',
        variablesDetectadas: 'Detected variables',
        editarVariables: 'Edit simulation variables',
        guardarVariables: 'Apply variables',
        cerrar: 'Close',
        buscarEstudiante: 'Search real student…',
        cargandoEstudiantes: 'Loading students…',
        sinEstudiantes: 'No students found.',
        ningunEstudianteSeleccionado: 'Select a registered student',
        restablecerPerfil: 'Reset to preset defaults',
      }
    : {
        vistaPrevia: 'Vista Previa Interactiva',
        escritorio: 'Escritorio (600px)',
        movil: 'Móvil (375px)',
        perfilSimulacion: 'Perfil de simulación',
        datosPersonalizados: 'Datos personalizados',
        estudianteReal: 'Estudiante real del CRM',
        enviarPrueba: 'Enviar correo de prueba',
        avisos: 'Avisos antes de enviar',
        sinAsunto: '(Sin asunto definido)',
        variablesDetectadas: 'Variables detectadas',
        editarVariables: 'Editar variables simuladas',
        guardarVariables: 'Aplicar variables',
        cerrar: 'Cerrar',
        buscarEstudiante: 'Buscar estudiante real…',
        cargandoEstudiantes: 'Cargando estudiantes…',
        sinEstudiantes: 'No se encontraron estudiantes.',
        ningunEstudianteSeleccionado: 'Seleccionar estudiante registrado',
        restablecerPerfil: 'Restablecer valores del perfil',
      }
}

export function PanelVistaPreviaEmail({
  asunto,
  cuerpo,
  botonTexto,
  botonUrl,
  programaId,
  htmlServidor,
  avisos = [],
  className,
}: PanelVistaPreviaEmailProps) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')

  const [dispositivo, setDispositivo] = useState<ModoDispositivo>('desktop')
  const [perfilActivoId, setPerfilActivoId] = useState<string>(PERFILES_SIMULACION_PREDETERMINADOS[0].id)
  const [variablesSimuladas, setVariablesSimuladas] = useState<Record<string, string>>(
    PERFILES_SIMULACION_PREDETERMINADOS[0].variables,
  )

  const [abrirModalPrueba, setAbrirModalPrueba] = useState(false)
  const [abrirEditorVariables, setAbrirEditorVariables] = useState(false)
  const [abrirSelectorEstudiante, setAbrirSelectorEstudiante] = useState(false)

  const [estudiantes, setEstudiantes] = useState<EstudianteResponse[]>([])
  const [cargandoEstudiantes, setCargandoEstudiantes] = useState(false)
  const [busquedaEstudiante, setBusquedaEstudiante] = useState('')

  // Carga opcional de estudiantes reales para simulación con datos de producción
  useEffect(() => {
    if (!abrirSelectorEstudiante) return
    setCargandoEstudiantes(true)
    const timer = setTimeout(() => {
      estudiantesApi
        .buscarAvanzado({
          q: busquedaEstudiante.trim() || undefined,
          programaId: programaId || undefined,
          size: 50,
        })
        .then((res) => {
          setEstudiantes(res.content ?? [])
        })
        .catch(() => {
          setEstudiantes([])
        })
        .finally(() => {
          setCargandoEstudiantes(false)
        })
    }, 200)

    return () => clearTimeout(timer)
  }, [abrirSelectorEstudiante, busquedaEstudiante, programaId])

  // Cambio de perfil estándar
  const cambiarPerfil = (perfilId: string) => {
    setPerfilActivoId(perfilId)
    const encontrado = PERFILES_SIMULACION_PREDETERMINADOS.find((p) => p.id === perfilId)
    if (encontrado) {
      setVariablesSimuladas({ ...encontrado.variables })
    }
  }

  // Aplicar datos de un estudiante real
  const seleccionarEstudianteReal = (est: EstudianteResponse) => {
    setPerfilActivoId(`real_${est.id}`)
    setVariablesSimuladas((prev) => ({
      ...prev,
      nombre: est.nombre || 'Estudiante',
      apellido: est.apellido || '',
      email: est.email || 'estudiante@ejemplo.com',
      programa: est.programaNombre || 'Programa de Formación NOVA',
      empresa: 'Empresa Aliada',
      cargo: est.cargoObjetivo || est.ultimoCargo || 'Candidato a Vacante',
    }))
    setAbrirSelectorEstudiante(false)
  }

  // Interpolación de variables en asunto y cuerpo
  const asuntoRenderizado = useMemo(() => {
    return interpolarVariables(asunto || '', variablesSimuladas)
  }, [asunto, variablesSimuladas])

  const cuerpoRenderizado = useMemo(() => {
    // Si viene botón con texto y url, agregar bloque de botón al final si no está incluido
    let contenido = cuerpo || ''
    if (botonTexto && botonTexto.trim() && botonUrl && !contenido.includes('{{enlace_boton}}')) {
      const botonHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-collapse:collapse;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
        <tr>
          <td align="center" style="background-color:#1B6DF5;border-radius:8px;padding:12px 28px;">
            <a href="${botonUrl}" target="_blank" rel="noopener noreferrer" style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;display:inline-block;">
              ${botonTexto}
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
      contenido = `${contenido}\n${botonHtml}`
    }

    const conVariables = interpolarVariables(contenido, variablesSimuladas)
    return htmlServidor ? interpolarVariables(htmlServidor, variablesSimuladas) : envolverEnDocumentoEmail(conVariables, asuntoRenderizado)
  }, [cuerpo, botonTexto, botonUrl, variablesSimuladas, htmlServidor, asuntoRenderizado])

  // Detección de variables no sustituidas
  const variablesSinReemplazar = useMemo(() => {
    const matches = (asunto + ' ' + cuerpo).match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || []
    return Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, ''))))
  }, [asunto, cuerpo])

  const estudiantesFiltrados = useMemo(() => {
    return estudiantes
  }, [estudiantes])

  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm', className)}>
      {/* Barra superior de controles */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{T.vistaPrevia}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Alternador Escritorio / Móvil */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setDispositivo('desktop')}
              aria-label={T.escritorio}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
                dispositivo === 'desktop'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Laptop className="size-3.5" />
              <span className="hidden sm:inline">600px</span>
            </button>
            <button
              type="button"
              onClick={() => setDispositivo('mobile')}
              aria-label={T.movil}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
                dispositivo === 'mobile'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Smartphone className="size-3.5" />
              <span className="hidden sm:inline">375px</span>
            </button>
          </div>

          {/* Selector de perfil de simulación */}
          <select
            aria-label={T.perfilSimulacion}
            value={perfilActivoId}
            onChange={(e) => {
              if (e.target.value === 'selector_real') {
                setAbrirSelectorEstudiante(true)
              } else {
                cambiarPerfil(e.target.value)
              }
            }}
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground cursor-pointer"
          >
            {PERFILES_SIMULACION_PREDETERMINADOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombrePerfil}
              </option>
            ))}
            <option value="selector_real">{T.estudianteReal}…</option>
          </select>

          {/* Botón de edición de variables simuladas */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAbrirEditorVariables((v) => !v)}
            title={T.editarVariables}
            className="h-8 px-2 text-xs cursor-pointer"
          >
            <Sliders className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">{T.datosPersonalizados}</span>
          </Button>

          {/* Botón de Envío de Prueba Directo */}
          <Button
            size="sm"
            onClick={() => setAbrirModalPrueba(true)}
            className="h-8 gap-1 px-2.5 text-xs font-semibold cursor-pointer"
          >
            <PaperPlaneTilt className="size-3.5" />
            <span>{T.enviarPrueba}</span>
          </Button>
        </div>
      </div>

      {/* Editor Drawer de Variables Simuladas */}
      {abrirEditorVariables && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sliders className="size-3.5 text-primary" /> {T.editarVariables}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const def = PERFILES_SIMULACION_PREDETERMINADOS[0]
                setVariablesSimuladas({ ...def.variables })
              }}
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ArrowsClockwise className="size-3 mr-1" />
              {T.restablecerPerfil}
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-48 overflow-y-auto p-1">
            {Object.entries(variablesSimuladas).map(([k, val]) => (
              <label key={k} className="space-y-1">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">{`{{${k}}}`}</span>
                <Input
                  value={val}
                  onChange={(e) => {
                    const nuevo = e.target.value
                    setVariablesSimuladas((prev) => ({ ...prev, [k]: nuevo }))
                  }}
                  className="h-7 text-xs bg-background"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Selector Modal / Popover de Estudiante Real */}
      {abrirSelectorEstudiante && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Users className="size-3.5 text-primary" /> {T.estudianteReal}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAbrirSelectorEstudiante(false)}
              className="h-6 text-[11px]"
            >
              {T.cerrar}
            </Button>
          </div>

          <Input
            placeholder={T.buscarEstudiante}
            value={busquedaEstudiante}
            onChange={(e) => setBusquedaEstudiante(e.target.value)}
            className="h-8 text-xs bg-background"
          />

          <div className="max-h-36 overflow-y-auto divide-y divide-border rounded-md border border-border bg-background">
            {cargandoEstudiantes ? (
              <p className="p-3 text-center text-xs text-muted-foreground">{T.cargandoEstudiantes}</p>
            ) : estudiantesFiltrados.length === 0 ? (
              <p className="p-3 text-center text-xs text-muted-foreground">{T.sinEstudiantes}</p>
            ) : (
              estudiantesFiltrados.slice(0, 10).map((est) => (
                <button
                  key={est.id}
                  type="button"
                  onClick={() => seleccionarEstudianteReal(est)}
                  className="w-full text-left p-2 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-medium text-foreground truncate">
                      {est.nombre} {est.apellido}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{est.email || 'Sin correo'}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">
                    {est.numeroDocumento ? `${est.tipoDocumento || 'CC'} ${est.numeroDocumento}` : 'ID'}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Cabecera del correo con Asunto renderizado */}
      <div className="rounded-lg border border-border bg-muted/10 p-2.5 space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-muted-foreground">Asunto:</span>
          <span className="font-medium text-foreground truncate">
            {asuntoRenderizado || <span className="italic text-muted-foreground">{T.sinAsunto}</span>}
          </span>
        </div>

        {variablesSinReemplazar.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="text-[10px] text-muted-foreground">{T.variablesDetectadas}:</span>
            {variablesSinReemplazar.map((v) => (
              <Badge key={v} variant="secondary" className="font-mono text-[9px] py-0 px-1">
                {`{{${v}}}`}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Avisos previos si los hay */}
      {avisos.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <WarningCircle className="size-3.5" /> {T.avisos}
          </p>
          <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Contenedor del Iframe con modo responsivo */}
      <div className="flex justify-center rounded-xl bg-muted/40 p-3 sm:p-6 transition-all duration-300 min-h-[460px] overflow-hidden">
        {dispositivo === 'desktop' ? (
          // Modo Escritorio: Contenedor centrado de 600px
          <div className="w-[600px] max-w-full rounded-xl border border-border bg-card shadow-md overflow-hidden transition-all duration-300">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
              <span className="font-mono">Vista Escritorio (600px)</span>
              <span className="font-mono">HTML Email Compatible</span>
            </div>
            <iframe
              title="Vista previa correo escritorio"
              sandbox=""
              srcDoc={cuerpoRenderizado}
              className="h-[420px] w-full bg-white"
            />
          </div>
        ) : (
          // Modo Móvil: Silueta de Smartphone de 375px con muesca superior
          <div className="w-[375px] max-w-full rounded-[32px] border-[6px] border-border/80 bg-card shadow-2xl overflow-hidden transition-all duration-300 flex flex-col">
            {/* Notch / Barra superior de smartphone */}
            <div className="flex h-6 w-full items-center justify-center bg-muted/60 relative border-b border-border/50">
              <div className="h-3 w-24 rounded-full bg-foreground/20" />
            </div>
            <iframe
              title="Vista previa correo móvil"
              sandbox=""
              srcDoc={cuerpoRenderizado}
              className="h-[420px] w-full bg-white flex-1"
            />
            {/* Barra inferior de smartphone */}
            <div className="flex h-4 w-full items-center justify-center bg-muted/60 border-t border-border/50">
              <div className="h-1 w-28 rounded-full bg-foreground/20" />
            </div>
          </div>
        )}
      </div>

      {/* Modal de Envío de Prueba Directo */}
      {abrirModalPrueba && (
        <ModalEnvioPrueba
          abierto={abrirModalPrueba}
          onCerrar={() => setAbrirModalPrueba(false)}
          asunto={asuntoRenderizado}
          cuerpo={cuerpo}
          botonTexto={botonTexto}
          botonUrl={botonUrl}
          programaId={programaId}
          variablesSimuladas={variablesSimuladas}
        />
      )}
    </div>
  )
}
