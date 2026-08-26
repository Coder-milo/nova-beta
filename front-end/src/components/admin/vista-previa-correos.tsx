'use client'

/**
 * Previsualización de los correos automáticos del sistema con soporte responsive
 * y prueba de envío directo.
 *
 * Consume:
 *   GET /api/v1/correos/tipos
 *   GET /api/v1/correos/vista-previa/{tipo}?programaId=
 */

import { useCallback, useEffect, useState } from 'react'
import {
  CircleAlert as WarningCircle,
  Laptop,
  LoaderCircle as CircleNotch,
  Mail as Envelope,
  Send as PaperPlaneTilt,
  RefreshCw as ArrowsClockwise,
  Smartphone,
  User,
  Users,
} from 'lucide-react'
import { ApiCallError, correosApi, programasApi, estudiantesApi } from '@/lib/api'
import type { TipoCorreo } from '@/lib/api'
import type { EstudianteResponse, ProgramaResponse } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Campo, Selector } from '@/components/ui/campo'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ModalEnvioPrueba } from '@/components/admin/modal-envio-prueba'
import { useAvisos } from '@/components/ui/avisos'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin, type TextosAdmin } from '@/lib/textos-admin'
import { cn } from '@/lib/utils'

/** No es un componente: no puede leer el idioma, se lo pasan. */
function mensajeDe(error: unknown, C: TextosAdmin): string {
  if (error instanceof ApiCallError) {
    if (error.status === 401 || error.status === 403) {
      return C.errorPermisos
    }
    return error.body.message ?? `Error ${error.status}.`
  }
  return C.errorConexion
}

/** Textos propios de esta pantalla. */
function textos(english: boolean) {
  return english
    ? {
        miralosAntesDe: 'See them before they go out. They are shown with sample data or customized for a real student, with the exact branding and alliances of the selected project.',
        cadaProgramaPuede: 'Each project has its own funding partners, footer, header and colour.',
        correosQueEnvia: 'Emails the system sends',
        eligeUnCorreo: 'Choose an email to view it.',
        montandoElCorreo: 'Building the email…',
        marcaDelPrograma: 'Project / Programme Branding',
        estudiantePersonalizado: 'Target Student / Personalization',
        datosEjemplo: 'Standard sample data (María Gómez)',
        buscarEstudiante: 'Search real student…',
        cargandoEstudiantes: 'Searching students…',
        sinEstudiantes: 'No students found.',
        escritorio: 'Desktop (600px)',
        movil: 'Mobile (375px)',
        enviarPrueba: 'Send Test Email',
      }
    : {
        miralosAntesDe: 'Míralos antes de que salgan. Se muestran con datos de ejemplo o de un estudiante real específico, con la marca, aliados y colores exactos del proyecto seleccionado.',
        cadaProgramaPuede: 'Cada proyecto cuenta con sus propios aliados de financiación, cabecera y pie de página.',
        correosQueEnvia: 'Correos que envía el sistema',
        eligeUnCorreo: 'Elige un correo para verlo.',
        montandoElCorreo: 'Montando el correo…',
        marcaDelPrograma: 'Proyecto / Marca del Programa',
        estudiantePersonalizado: 'Estudiante / Personalización',
        datosEjemplo: 'Datos de ejemplo (María Gómez)',
        buscarEstudiante: 'Buscar estudiante real…',
        cargandoEstudiantes: 'Buscando estudiantes…',
        sinEstudiantes: 'No se encontraron estudiantes.',
        escritorio: 'Escritorio (600px)',
        movil: 'Móvil (375px)',
        enviarPrueba: 'Enviar correo de prueba',
      }
}

export function VistaPreviaCorreos() {
  const { locale } = usePreferences()
  const { mostrarExito, mostrarError, avisos } = useAvisos()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [tipos, setTipos] = useState<TipoCorreo[]>([])
  const [programas, setProgramas] = useState<ProgramaResponse[]>([])
  const [tipo, setTipo] = useState('')
  const [programaId, setProgramaId] = useState('')
  const [estudianteId, setEstudianteId] = useState('')
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<EstudianteResponse | null>(null)
  const [estudiantes, setEstudiantes] = useState<EstudianteResponse[]>([])
  const [busquedaEstudiante, setBusquedaEstudiante] = useState('')
  const [cargandoEstudiantes, setCargandoEstudiantes] = useState(false)
  const [mostrarBuscadorEstudiante, setMostrarBuscadorEstudiante] = useState(false)

  const [html, setHtml] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dispositivo, setDispositivo] = useState<'desktop' | 'mobile'>('desktop')
  const [modalPruebaAbierto, setModalPruebaAbierto] = useState(false)

  useEffect(() => {
    correosApi
      .tipos()
      .then((lista) => {
        setTipos(lista)
        if (lista.length > 0) setTipo((actual) => actual || lista[0].id)
      })
      .catch((e) => setError(mensajeDe(e, C)))

    // Sin programas la pantalla sigue sirviendo: se ve la marca institucional.
    programasApi.listar().then(setProgramas).catch(() => setProgramas([]))
  }, [])

  // Búsqueda de estudiantes dinámica con debounce
  useEffect(() => {
    if (!mostrarBuscadorEstudiante) return
    setCargandoEstudiantes(true)
    const timer = setTimeout(() => {
      estudiantesApi
        .buscarAvanzado({
          q: busquedaEstudiante.trim() || undefined,
          programaId: programaId || undefined,
          size: 30,
        })
        .then((res) => {
          setEstudiantes(res.content ?? [])
        })
        .catch(() => setEstudiantes([]))
        .finally(() => setCargandoEstudiantes(false))
    }, 200)

    return () => clearTimeout(timer)
  }, [mostrarBuscadorEstudiante, busquedaEstudiante, programaId])

  const cargar = useCallback(async () => {
    if (!tipo) return
    setCargando(true)
    setError(null)
    try {
      setHtml(await correosApi.vistaPrevia(tipo, programaId || undefined, estudianteId || undefined))
    } catch (e) {
      setError(mensajeDe(e, C))
      setHtml('')
    } finally {
      setCargando(false)
    }
  }, [tipo, programaId, estudianteId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const elegirEstudiante = (est: EstudianteResponse | null) => {
    setEstudianteSeleccionado(est)
    setEstudianteId(est ? est.id : '')
    if (est?.programaId && !programaId) {
      setProgramaId(est.programaId)
    }
    setMostrarBuscadorEstudiante(false)
  }

  const elegido = tipos.find((t) => t.id === tipo)

  return (
    <Card className="rounded-lg border-border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Envelope className="size-4 text-primary" />
          {T.correosQueEnvia}
        </CardTitle>
        <CardDescription>{T.miralosAntesDe}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Correo" ayuda={elegido?.cuando}>
            <Selector
              value={tipo}
              onChange={setTipo}
              opciones={tipos.map((t) => ({ valor: t.id, etiqueta: t.etiqueta }))}
            />
          </Campo>

          <Campo etiqueta={T.marcaDelPrograma} ayuda={T.cadaProgramaPuede}>
            <Selector
              value={programaId}
              onChange={setProgramaId}
              opciones={programas.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
              vacio="Marca institucional"
            />
          </Campo>

          <Campo
            etiqueta={T.estudiantePersonalizado}
            ayuda={estudianteSeleccionado ? `${estudianteSeleccionado.nombre} ${estudianteSeleccionado.apellido}` : T.datosEjemplo}
          >
            <div className="relative">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMostrarBuscadorEstudiante((prev) => !prev)}
                  className="w-full justify-between h-9 text-xs font-normal bg-background"
                >
                  <span className="truncate">
                    {estudianteSeleccionado
                      ? `${estudianteSeleccionado.nombre} ${estudianteSeleccionado.apellido}`
                      : T.datosEjemplo}
                  </span>
                  <Users className="size-3.5 text-muted-foreground shrink-0 ml-1" />
                </Button>
                {estudianteSeleccionado && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => elegirEstudiante(null)}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                    title="Restablecer a datos de ejemplo"
                  >
                    ✕
                  </Button>
                )}
              </div>

              {mostrarBuscadorEstudiante && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-card p-2 shadow-lg space-y-2">
                  <Input
                    placeholder={T.buscarEstudiante}
                    value={busquedaEstudiante}
                    onChange={(e) => setBusquedaEstudiante(e.target.value)}
                    className="h-8 text-xs bg-background"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto divide-y divide-border rounded-md border border-border bg-background">
                    <button
                      type="button"
                      onClick={() => elegirEstudiante(null)}
                      className="w-full text-left p-2 hover:bg-muted/50 transition-colors text-xs font-medium text-foreground cursor-pointer flex items-center justify-between"
                    >
                      <span>{T.datosEjemplo}</span>
                      {!estudianteSeleccionado && <Badge variant="secondary" className="text-[10px]">Activo</Badge>}
                    </button>
                    {cargandoEstudiantes ? (
                      <p className="p-3 text-center text-xs text-muted-foreground">{T.cargandoEstudiantes}</p>
                    ) : estudiantes.length === 0 ? (
                      <p className="p-3 text-center text-xs text-muted-foreground">{T.sinEstudiantes}</p>
                    ) : (
                      estudiantes.map((est) => (
                        <button
                          key={est.id}
                          type="button"
                          onClick={() => elegirEstudiante(est)}
                          className="w-full text-left p-2 hover:bg-muted/50 transition-colors text-xs cursor-pointer flex items-center justify-between"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="font-medium text-foreground truncate">
                              {est.nombre} {est.apellido}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">{est.email || 'Sin correo'}</p>
                          </div>
                          {est.id === estudianteId && (
                            <Badge variant="default" className="text-[9px]">Seleccionado</Badge>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </Campo>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            <WarningCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border py-2">
          {/* Alternador Desktop / Mobile */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setDispositivo('desktop')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
                dispositivo === 'desktop'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Laptop className="size-3.5" />
              <span>{T.escritorio}</span>
            </button>
            <button
              type="button"
              onClick={() => setDispositivo('mobile')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
                dispositivo === 'mobile'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Smartphone className="size-3.5" />
              <span>{T.movil}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalPruebaAbierto(true)}
              disabled={!html}
              className="cursor-pointer"
            >
              <PaperPlaneTilt className="size-3.5 mr-1" />
              {T.enviarPrueba}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void cargar()} disabled={cargando} className="cursor-pointer">
              <ArrowsClockwise className={cargando ? 'size-3.5 animate-spin' : 'size-3.5'} />
              Actualizar
            </Button>
          </div>
        </div>

        {cargando && !html ? (
          <div className="flex h-96 items-center justify-center gap-2 rounded-xl border border-border bg-secondary/30 text-sm text-muted-foreground">
            <CircleNotch className="size-5 animate-spin" />
            {T.montandoElCorreo}
          </div>
        ) : html ? (
          <div className="flex justify-center rounded-xl bg-muted/30 p-3 sm:p-6 transition-all duration-300 overflow-hidden">
            {dispositivo === 'desktop' ? (
              <div className="w-[600px] max-w-full rounded-xl border border-border bg-card shadow-md overflow-hidden transition-all duration-300">
                <iframe
                  title={`Vista previa del correo: ${elegido?.etiqueta ?? tipo}`}
                  srcDoc={html}
                  sandbox=""
                  className="h-[38rem] w-full bg-white"
                />
              </div>
            ) : (
              <div className="w-[375px] max-w-full rounded-[32px] border-[6px] border-border/80 bg-card shadow-2xl overflow-hidden transition-all duration-300 flex flex-col">
                <div className="flex h-6 w-full items-center justify-center bg-muted/60 relative border-b border-border/50">
                  <div className="h-3 w-24 rounded-full bg-foreground/20" />
                </div>
                <iframe
                  title={`Vista previa móvil del correo: ${elegido?.etiqueta ?? tipo}`}
                  srcDoc={html}
                  sandbox=""
                  className="h-[38rem] w-full bg-white flex-1"
                />
                <div className="flex h-4 w-full items-center justify-center bg-muted/60 border-t border-border/50">
                  <div className="h-1 w-28 rounded-full bg-foreground/20" />
                </div>
              </div>
            )}
          </div>
        ) : (
          !error && (
            <div className="flex h-96 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              {T.eligeUnCorreo}
            </div>
          )
        )}

        {modalPruebaAbierto && (
          <ModalEnvioPrueba
            abierto={modalPruebaAbierto}
            onCerrar={() => setModalPruebaAbierto(false)}
            tipo={tipo}
            asunto={`[Prueba] ${elegido?.etiqueta ?? 'Correo del Sistema'}`}
            cuerpo={html}
            programaId={programaId || null}
            estudianteId={estudianteId || null}
            onEnviado={(_res, dest) => {
              mostrarExito(
                locale === 'en'
                  ? `Test email sent to ${dest}`
                  : `Correo de prueba enviado a ${dest}`,
              )
            }}
          />
        )}
      </CardContent>
      {avisos}
    </Card>
  )
}
