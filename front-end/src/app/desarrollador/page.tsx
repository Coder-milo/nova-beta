'use client'

/**
 * Consola de operación para el rol DESARROLLADOR.
 *
 * La página no intenta ser una segunda configuración administrativa. Presenta
 * datos vivos del servidor y el estado seguro de sus integraciones, sin
 * credenciales, datos de negocio ni acciones que puedan alterar el sistema.
 */

import { useCallback, useEffect, useState } from 'react'
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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <ServerCog className="size-4" />
            {english ? 'Developer console' : 'Consola de desarrollador'}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {english ? 'Platform technical status' : 'Estado técnico de la plataforma'}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {english
              ? 'Live, read-only diagnostics. This panel never exposes credentials or student data.'
              : 'Diagnóstico en vivo y de solo lectura. Este panel no expone credenciales ni datos de estudiantes.'}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void cargar(true)} disabled={actualizando}>
          <RefreshCw className={actualizando ? 'animate-spin' : ''} />
          {actualizando ? (english ? 'Refreshing…' : 'Actualizando…') : (english ? 'Refresh' : 'Actualizar')}
        </Button>
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
          <section className="grid gap-4 lg:grid-cols-[1.05fr_1.95fr]">
            <Card>
              <CardHeader>
                <CardDescription>{english ? 'Application health' : 'Salud de la aplicación'}</CardDescription>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Activity className="size-5 text-primary" />
                  <EtiquetaEstado estado={diagnostico.estado} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
                  <p className="text-xs font-medium text-muted-foreground">{english ? 'Last check' : 'Última comprobación'}</p>
                  <p className="mt-1 font-medium text-foreground">{ultimaActualizacion}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
                  <p className="text-xs font-medium text-muted-foreground">Runtime</p>
                  <p className="mt-1 font-medium text-foreground">Java {diagnostico.runtime.javaVersion}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{diagnostico.runtime.perfilActivo}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{english ? 'Server components' : 'Componentes del servidor'}</CardTitle>
                <CardDescription>
                  {english ? 'A compact health view; sensitive diagnostic details stay on the server.' : 'Una vista compacta de salud; los detalles sensibles permanecen en el servidor.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {diagnostico.componentes.map((componente) => (
                    <div key={componente.nombre} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/55 px-3 py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium capitalize text-foreground">{componente.nombre}</span>
                      <EtiquetaEstado estado={componente.estado} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.95fr_1.05fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><PlugZap className="size-5 text-primary" />{english ? 'Integrations' : 'Integraciones'}</CardTitle>
                <CardDescription>
                  {english ? 'Whether each connected service is ready. Keys and connection data are never sent to the browser.' : 'Indica si cada servicio está listo. Las claves y datos de conexión nunca se envían al navegador.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/70 rounded-xl border border-border/70">
                  {diagnostico.integraciones.map((integracion) => (
                    <article key={integracion.id} className="space-y-2 p-3.5 first:rounded-t-xl last:rounded-b-xl">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
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
                        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2.5">
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

            <Card>
              <CardHeader>
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

          <section className="grid gap-4 xl:grid-cols-[1.15fr_1.85fr]">
            <PanelConectoresScraping />
            <RegistroDeScraping />
          </section>
        </>
      )}
    </main>
  )
}
