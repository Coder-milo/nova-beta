'use client'

/**
 * Consola de operación para el rol DESARROLLADOR.
 *
 * La página no intenta ser una segunda configuración administrativa. Presenta
 * datos vivos del servidor y el estado seguro de sus integraciones, sin
 * credenciales, datos de negocio ni acciones que puedan alterar el sistema.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  CircleX,
  FlaskConical,
  LoaderCircle,
  PlugZap,
  RefreshCw,
  ServerCog,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageSpinner } from '@/components/ui/page-spinner'
import { PanelConectoresScraping } from '@/components/admin/panel-conectores-scraping'
import { RegistroDeScraping } from '@/components/admin/registro-de-scraping'
import { ApiCallError, desarrolladorApi } from '@/lib/api'
import { usePreferences } from '@/lib/preferences'
import type { DiagnosticoDesarrollador } from '@/lib/types'

function esSaludable(estado: string): boolean {
  return estado.toUpperCase() === 'UP'
}

function EtiquetaEstado({ estado }: { estado: string }) {
  const saludable = esSaludable(estado)
  const desconocido = estado.toUpperCase() === 'UNKNOWN'
  return (
    <Badge variant={saludable ? 'default' : desconocido ? 'outline' : 'destructive'}>
      {saludable ? <CheckCircle2 /> : desconocido ? <CircleAlert /> : <CircleX />}
      {estado}
    </Badge>
  )
}

function MetricaTecnica({
  icono,
  etiqueta,
  valor,
  detalle,
}: {
  icono: ReactNode
  etiqueta: string
  valor: ReactNode
  detalle: string
}) {
  return (
    <Card className="min-w-0 rounded-2xl border-border/80 bg-card/95 shadow-sm">
      <CardContent className="flex items-start gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
          {icono}
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
          <div className="min-h-6 text-base font-semibold text-foreground">{valor}</div>
          <p className="text-xs leading-5 text-muted-foreground">{detalle}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PanelDesarrolladorPage() {
  const { locale } = usePreferences()
  const english = locale === 'en'
  const [diagnostico, setDiagnostico] = useState<DiagnosticoDesarrollador | null>(null)
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [probandoIntegracion, setProbandoIntegracion] = useState<string | null>(null)
  const [pruebasIntegracion, setPruebasIntegracion] = useState<Record<string, { exito: boolean; mensaje: string }>>({})

  const cargar = useCallback(async (manual = false) => {
    if (manual) setActualizando(true)
    else setCargando(true)
    setError(null)
    try {
      setDiagnostico(await desarrolladorApi.resumen())
    } catch (err) {
      if (err instanceof ApiCallError && err.status === 403) {
        setError(english
          ? 'This account does not have developer access.'
          : 'Esta cuenta no tiene acceso de desarrollador.')
      } else {
        setError(english
          ? 'The technical summary could not be loaded. Check the server and try again.'
          : 'No se pudo cargar el resumen técnico. Verifica el servidor y vuelve a intentarlo.')
      }
    } finally {
      setCargando(false)
      setActualizando(false)
    }
  }, [english])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const probarIntegracion = async (id: string) => {
    setProbandoIntegracion(id)
    try {
      const resultado = await desarrolladorApi.probarIntegracion(id)
      setPruebasIntegracion((anteriores) => ({ ...anteriores, [id]: resultado }))
    } catch (err) {
      const mensaje = err instanceof ApiCallError
        ? (english ? `Test failed (HTTP ${err.status}).` : `La prueba falló (HTTP ${err.status}).`)
        : (english ? 'The test could not be completed.' : 'No se pudo completar la prueba.')
      setPruebasIntegracion((anteriores) => ({ ...anteriores, [id]: { exito: false, mensaje } }))
    } finally {
      setProbandoIntegracion(null)
    }
  }

  if (cargando) return <PageSpinner />

  const ultimaActualizacion = diagnostico
    ? new Intl.DateTimeFormat(english ? 'en-US' : 'es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(diagnostico.generadoEn))
    : null

  const componentesSaludables = diagnostico?.componentes.filter((componente) => esSaludable(componente.estado)).length ?? 0
  const integracionesListas = diagnostico?.integraciones.filter((integracion) => integracion.configurada).length ?? 0

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 pb-10">
      <header className="rounded-2xl border border-border/80 bg-card/95 px-5 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <span className="flex size-7 items-center justify-center rounded-lg border border-primary/15 bg-primary/10">
                <ServerCog className="size-4" />
              </span>
              {english ? 'Developer workspace' : 'Centro de desarrollo'}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {english ? 'Platform operations' : 'Operación técnica de la plataforma'}
              </h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
                {english
                  ? 'Live diagnostics for the platform and its integrations. Credentials and CRM data are never displayed here.'
                  : 'Diagnóstico en vivo de la plataforma y sus integraciones. Las credenciales y los datos del CRM nunca se muestran aquí.'}
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => void cargar(true)} disabled={actualizando} className="shrink-0">
            <RefreshCw className={actualizando ? 'animate-spin' : ''} />
            {actualizando ? (english ? 'Refreshing…' : 'Actualizando…') : (english ? 'Refresh panel' : 'Actualizar panel')}
          </Button>
        </div>
        {ultimaActualizacion && (
          <div className="mt-5 flex flex-col gap-1 border-t border-border/70 pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{english ? 'Last refreshed' : 'Última actualización'}: <strong className="font-medium text-foreground">{ultimaActualizacion}</strong></span>
            <span>{english ? 'Developer role · read-only diagnostics' : 'Rol desarrollador · diagnósticos de solo lectura'}</span>
          </div>
        )}
      </header>

      {error ? (
        <Card className="border-destructive/35">
          <CardContent className="flex flex-col items-start gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-5 shrink-0" />
              <p>{error}</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => void cargar(true)}>
              {english ? 'Try again' : 'Reintentar'}
            </Button>
          </CardContent>
        </Card>
      ) : diagnostico && (
        <>
          <section aria-label={english ? 'Technical overview' : 'Resumen técnico'} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricaTecnica
              icono={<Activity className="size-5" />}
              etiqueta={english ? 'Platform health' : 'Salud de plataforma'}
              valor={<EtiquetaEstado estado={diagnostico.estado} />}
              detalle={english ? 'Live backend health check.' : 'Comprobación de salud en vivo.'}
            />
            <MetricaTecnica
              icono={<ServerCog className="size-5" />}
              etiqueta="Runtime"
              valor={`Java ${diagnostico.runtime.javaVersion}`}
              detalle={diagnostico.runtime.perfilActivo}
            />
            <MetricaTecnica
              icono={<CheckCircle2 className="size-5" />}
              etiqueta={english ? 'Server components' : 'Componentes de servidor'}
              valor={`${componentesSaludables}/${diagnostico.componentes.length}`}
              detalle={english ? 'Components reporting healthy.' : 'Componentes reportando estado saludable.'}
            />
            <MetricaTecnica
              icono={<PlugZap className="size-5" />}
              etiqueta={english ? 'Configured integrations' : 'Integraciones configuradas'}
              valor={`${integracionesListas}/${diagnostico.integraciones.length}`}
              detalle={english ? 'Services ready for platform use.' : 'Servicios listos para usarse en la plataforma.'}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
            <Card className="rounded-2xl border-border/80 bg-card/95 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2"><PlugZap className="size-5 text-primary" />{english ? 'Integrations' : 'Integraciones'}</CardTitle>
                <CardDescription>
                  {english ? 'Whether each connected service is ready. Keys and connection data are never sent to the browser.' : 'Indica si cada servicio está listo. Las claves y datos de conexión nunca se envían al navegador.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {diagnostico.integraciones.map((integracion) => (
                    <article key={integracion.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/75 bg-muted/15 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="text-sm font-semibold text-foreground">{integracion.nombre}</h2>
                          <p className="mt-0.5 text-xs text-muted-foreground">{integracion.categoria}</p>
                        </div>
                        <Badge variant={integracion.configurada ? 'default' : 'outline'}>
                          {integracion.configurada ? <CheckCircle2 /> : <CircleAlert />}
                          {integracion.configurada ? (english ? 'Ready' : 'Lista') : (english ? 'Not configured' : 'Sin configurar')}
                        </Badge>
                      </div>
                      <p className="text-sm leading-5 text-muted-foreground">{integracion.resumen}</p>
                      {integracion.advertencia && (
                        <p className="rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
                          {integracion.advertencia}
                        </p>
                      )}
                      {integracion.admitePrueba && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void probarIntegracion(integracion.id)}
                            disabled={probandoIntegracion === integracion.id}
                          >
                            {probandoIntegracion === integracion.id
                              ? <LoaderCircle className="animate-spin" />
                              : <FlaskConical />}
                            {english ? 'Run connection test' : 'Probar conexión'}
                          </Button>
                          {pruebasIntegracion[integracion.id] && (
                            <span className={`text-xs ${pruebasIntegracion[integracion.id].exito ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>
                              {pruebasIntegracion[integracion.id].mensaje}
                            </span>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/80 bg-card/95 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />{english ? 'Access scope' : 'Alcance del acceso'}</CardTitle>
                <CardDescription>
                  {english ? 'This role is intentionally limited.' : 'Este rol tiene límites intencionales.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm leading-5 text-muted-foreground">
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />{english ? 'Reads live application and integration status.' : 'Consulta el estado en vivo de la aplicación e integraciones.'}</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />{english ? 'Can run isolated connectivity tests; these never create or edit vacancies.' : 'Puede ejecutar pruebas aisladas de conexión; nunca crean ni modifican vacantes.'}</li>
                  <li className="flex gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{english ? 'Cannot access students, applications, messages, documents or admin settings.' : 'No accede a estudiantes, postulaciones, mensajes, documentos ni ajustes administrativos.'}</li>
                </ul>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <PanelConectoresScraping />
            <RegistroDeScraping />
          </section>
        </>
      )}
    </main>
  )
}
