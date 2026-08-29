'use client'

/**
 * Diagnóstico técnico de conectores y fuentes de scraping.
 *
 * Muestra el estado operativo en tiempo real de los conectores multi-nivel:
 * - Nivel 1: Conectores Nativos Directos (LinkedIn, Computrabajo, ElEmpleo, Jooble, Remotive, Magneto 365)
 * - Nivel 2: Proxy Agregador (JSearch Indeed/Glassdoor con cuota mensual)
 * - Nivel 3: ATS Directo de Empleadores del Atlántico (SmartRecruiters)
 *
 * Vive exclusivamente en el panel de desarrollador. Permite pruebas
 * exploratorias aisladas (dry-run), sin crear ni modificar vacantes.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Globe,
  MapPin,
  Play,
  Radio,
  RefreshCw,
  ShieldAlert,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { desarrolladorApi } from '@/lib/api'
import type { EstadoConector, ResultadoPruebaFuente } from '@/lib/types'
import { usePreferences } from '@/lib/preferences'
import { errorDe } from '@/lib/errores'

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Job-board connector diagnostics',
        descripcion:
          'Technical status and isolated connector tests. Tests do not save vacancies; providers may still account for a request.',
        actualizarTodo: 'Refresh status',
        cargando: 'Loading connector status…',
        sinConectores: 'No active job connectors detected.',
        probar: 'Run test',
        probando: 'Testing…',
        estadoActivo: 'Active',
        estadoEspera: 'Needs API Key / Config',
        estadoError: 'Portal Error',
        estadoDesactivado: 'Disabled',
        cuota: 'Monthly Quota',
        cuotaRestante: 'remaining',
        ultimaEjecucion: 'Last run',
        ultimoConteo: 'Last yield',
        sinRegistros: 'No recent executions',
        ofertasRecuperadas: (n: number) => `${n} vacancies retrieved`,
        detallesDePrueba: 'Connector Diagnostic Result',
        latencia: 'Latency',
        resultado: 'Result status',
        ofertasEncontradas: 'Test vacancies found',
        mensaje: 'Message',
        cerrar: 'Close',
        filtroCiudadSi: 'Barranquilla & Atlántico filter active',
        filtroCiudadNo: 'Remote / Nationwide search',
        tier1: 'Tier 1 · Direct Portal',
        tier2: 'Tier 2 · Proxy Aggregator',
        tier3: 'Tier 3 · Direct ATS',
        tierExterior: 'International Visa',
        resumenActivos: 'Operational',
        resumenAtencion: 'Needs attention',
        resumenCuotas: 'Quota-based',
      }
    : {
        titulo: 'Diagnóstico de conectores de vacantes',
        descripcion:
          'Estado técnico y pruebas aisladas de los conectores. Las pruebas no guardan vacantes, aunque el proveedor puede contabilizar una petición.',
        actualizarTodo: 'Actualizar estado',
        cargando: 'Cargando estado de conectores…',
        sinConectores: 'No se detectaron conectores de vacantes.',
        probar: 'Ejecutar prueba',
        probando: 'Probando…',
        estadoActivo: 'Activo',
        estadoEspera: 'En espera de API Key',
        estadoError: 'Error de portal',
        estadoDesactivado: 'Desactivado',
        cuota: 'Cupo mensual',
        cuotaRestante: 'disponibles',
        ultimaEjecucion: 'Última corrida',
        ultimoConteo: 'Último rendimiento',
        sinRegistros: 'Sin registros recientes',
        ofertasRecuperadas: (n: number) => `${n} ofertas recuperadas`,
        detallesDePrueba: 'Diagnóstico de Prueba del Conector',
        latencia: 'Latencia',
        resultado: 'Diagnóstico',
        ofertasEncontradas: 'Ofertas encontradas en prueba',
        mensaje: 'Mensaje del proveedor',
        cerrar: 'Cerrar',
        filtroCiudadSi: 'Filtro geográfico Atlántico / Barranquilla activo',
        filtroCiudadNo: 'Búsqueda remota / nacional',
        tier1: 'Nivel 1 · Portal Directo',
        tier2: 'Nivel 2 · Proxy Agregador',
        tier3: 'Nivel 3 · ATS Directo',
        tierExterior: 'Empleo con Visa',
        resumenActivos: 'Operativos',
        resumenAtencion: 'Requieren atención',
        resumenCuotas: 'Con cuota',
      }
}

function clasificarTier(nombre: string): { tier: string; color: string } {
  const n = nombre.toUpperCase()
  if (n === 'JSEARCH') {
    return { tier: 'tier2', color: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400' }
  }
  if (n === 'SMARTRECRUITERS') {
    return { tier: 'tier3', color: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400' }
  }
  if (n === 'ARBEITNOW') {
    return { tier: 'tierExterior', color: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400' }
  }
  return { tier: 'tier1', color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' }
}

function formatoFecha(iso: string | null | undefined, locale: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PanelConectoresScraping() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')

  const [conectores, setConectores] = useState<EstadoConector[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)

  const [probandoFuente, setProbandoFuente] = useState<string | null>(null)
  const [resultadoPrueba, setResultadoPrueba] = useState<ResultadoPruebaFuente | null>(null)

  const cargarConectores = useCallback(async () => {
    setCargando(true)
    setErrorGlobal(null)
    try {
      const data = await desarrolladorApi.conectoresDeVacantes()
      setConectores(data)
    } catch (e) {
      setErrorGlobal(errorDe(e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargarConectores()
  }, [cargarConectores])

  const handleProbar = async (nombreFuente: string) => {
    setProbandoFuente(nombreFuente)
    try {
      const resultado = await desarrolladorApi.probarConectorDeVacantes(nombreFuente)
      setResultadoPrueba(resultado)
    } catch (e) {
      setResultadoPrueba({
        fuente: nombreFuente,
        exito: false,
        estado: 'ERROR',
        ofertasEncontradas: 0,
        latenciaMs: 0,
        mensaje: errorDe(e),
        timestamp: new Date().toISOString(),
      })
    } finally {
      setProbandoFuente(null)
    }
  }

  const badgeEstado = (estado: EstadoConector['estado']) => {
    switch (estado) {
      case 'ACTIVO':
        return (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1 font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {T.estadoActivo}
          </Badge>
        )
      case 'ESPERA_CONFIGURACION':
        return (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 gap-1 font-medium">
            <AlertTriangle className="size-3" />
            {T.estadoEspera}
          </Badge>
        )
      case 'ERROR':
        return (
          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive gap-1 font-medium">
            <ShieldAlert className="size-3" />
            {T.estadoError}
          </Badge>
        )
      case 'DESACTIVADO':
      default:
        return (
          <Badge variant="secondary" className="gap-1 font-normal text-muted-foreground">
            {T.estadoDesactivado}
          </Badge>
        )
    }
  }

  const conectoresActivos = conectores?.filter((conector) => conector.estado === 'ACTIVO').length ?? 0
  const conectoresConAtencion = conectores?.filter((conector) =>
    conector.estado === 'ERROR' || conector.estado === 'ESPERA_CONFIGURACION',
  ).length ?? 0
  const conectoresConCuota = conectores?.filter((conector) =>
    conector.cuotaLimite != null && conector.cuotaLimite > 0,
  ).length ?? 0

  return (
    <Card className="rounded-2xl border-border/80 bg-card/95 shadow-sm">
      <CardHeader className="flex flex-col gap-4 space-y-0 border-b border-border/70 pb-5 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Radio className="size-4 text-primary" />
            {T.titulo}
          </CardTitle>
          <CardDescription className="max-w-3xl text-sm leading-5 text-muted-foreground">
            {T.descripcion}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void cargarConectores()}
          disabled={cargando}
          className="shrink-0"
        >
          <RefreshCw className={`size-3.5 ${cargando ? 'animate-spin' : ''}`} />
          {T.actualizarTodo}
        </Button>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {errorGlobal && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {errorGlobal}
          </div>
        )}

        {conectores === null && !errorGlobal && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {T.cargando}
          </div>
        )}

        {conectores?.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {T.sinConectores}
          </div>
        )}

        {conectores && conectores.length > 0 && (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5">
                <p className="text-xs font-medium text-muted-foreground">{T.resumenActivos}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{conectoresActivos}</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5">
                <p className="text-xs font-medium text-muted-foreground">{T.resumenAtencion}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{conectoresConAtencion}</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2.5">
                <p className="text-xs font-medium text-muted-foreground">{T.resumenCuotas}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{conectoresConCuota}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {conectores.map((c) => {
              const tierInfo = clasificarTier(c.nombre)
              const esProbando = probandoFuente === c.nombre

              const tieneCuota = c.cuotaLimite != null && c.cuotaLimite > 0
              const porcentajeCuota = tieneCuota && c.cuotaRestante != null
                ? Math.round((c.cuotaRestante / c.cuotaLimite!) * 100)
                : 100

              return (
                <article
                  key={c.nombre}
                  className="flex min-w-0 flex-col justify-between rounded-2xl border border-border/80 bg-muted/[0.08] p-5 shadow-sm transition-colors hover:border-primary/30 hover:bg-card"
                >
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold tracking-tight text-foreground">
                            {c.nombre}
                          </h3>
                          <span
                            className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${tierInfo.color}`}
                          >
                            {T[tierInfo.tier as keyof typeof T] as string}
                          </span>
                      </div>
                      <p className="min-h-10 text-sm leading-5 text-muted-foreground line-clamp-2">
                        {c.descripcion}
                      </p>
                      <div>{badgeEstado(c.estado)}</div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-border/80 bg-card/70 px-2.5 py-2 text-xs text-muted-foreground">
                        <Globe className="size-3 text-primary/70" />
                        <span className="truncate">{c.segmento}</span>
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-border/80 bg-card/70 px-2.5 py-2 text-xs text-muted-foreground">
                        <MapPin className="size-3 text-primary/70" />
                        <span className="truncate">{c.filtraPorCiudad ? T.filtroCiudadSi : T.filtroCiudadNo}</span>
                      </span>
                    </div>

                    {tieneCuota && (
                      <div className="space-y-2 rounded-xl border border-border/80 bg-card/70 p-3">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Zap className="size-3 text-amber-500" />
                            {T.cuota}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            <strong className="text-foreground">{c.cuotaRestante}</strong> / {c.cuotaLimite} {T.cuotaRestante}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className={`h-full transition-all duration-300 ${
                              porcentajeCuota > 30
                                ? 'bg-primary'
                                : porcentajeCuota > 10
                                ? 'bg-amber-500'
                                : 'bg-destructive'
                            }`}
                            style={{ width: `${porcentajeCuota}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 border-t border-border/70 pt-4 text-xs">
                      <div className="min-w-0 rounded-lg bg-card/55 px-2.5 py-2">
                        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{T.ultimaEjecucion}</span>
                        <span className="mt-1 block font-medium leading-5 text-foreground">
                          {c.ultimaEjecucion ? formatoFecha(c.ultimaEjecucion, locale) : T.sinRegistros}
                        </span>
                      </div>
                      <div className="min-w-0 rounded-lg bg-card/55 px-2.5 py-2">
                        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{T.ultimoConteo}</span>
                        <span className="mt-1 block font-medium leading-5 text-foreground">
                          {c.ultimoConteo != null ? T.ofertasRecuperadas(c.ultimoConteo) : '—'}
                        </span>
                      </div>
                    </div>

                    {c.ultimoError && (
                      <div className="flex items-start gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs leading-5 text-destructive">
                        <ShieldAlert className="size-3.5 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{c.ultimoError}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 border-t border-border/70 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleProbar(c.nombre)}
                      disabled={esProbando}
                      className="w-full"
                    >
                      {esProbando ? (
                        <>
                          <RefreshCw className="size-3 animate-spin" />
                          {T.probando}
                        </>
                      ) : (
                        <>
                          <Play className="size-3 text-muted-foreground" />
                          {T.probar}
                        </>
                      )}
                    </Button>
                  </div>
                </article>
              )
            })}
            </div>
          </>
        )}
      </CardContent>

      {/* Modal de Diagnóstico de Prueba */}
      <Dialog open={resultadoPrueba !== null} onOpenChange={(open) => { if (!open) setResultadoPrueba(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Cpu className="size-4 text-primary" />
              {T.detallesDePrueba} · {resultadoPrueba?.fuente}
            </DialogTitle>
            <DialogDescription>
              {resultadoPrueba?.timestamp ? formatoFecha(resultadoPrueba.timestamp, locale) : ''}
            </DialogDescription>
          </DialogHeader>

          {resultadoPrueba && (
            <div className="space-y-3 py-2 text-xs">
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                <span className="font-medium text-foreground">{T.resultado}:</span>
                <Badge
                  variant="outline"
                  className={
                    resultadoPrueba.exito
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'border-destructive/30 bg-destructive/10 text-destructive'
                  }
                >
                  {resultadoPrueba.estado}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-muted/20 p-2.5">
                  <span className="text-[11px] text-muted-foreground block">{T.latencia}</span>
                  <strong className="text-sm font-mono text-foreground">{resultadoPrueba.latenciaMs} ms</strong>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-2.5">
                  <span className="text-[11px] text-muted-foreground block">{T.ofertasEncontradas}</span>
                  <strong className="text-sm font-mono text-foreground">{resultadoPrueba.ofertasEncontradas}</strong>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                <span className="font-semibold text-muted-foreground text-[11px] block">{T.mensaje}:</span>
                <p className="text-foreground leading-relaxed break-words font-mono text-[11px]">
                  {resultadoPrueba.mensaje}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setResultadoPrueba(null)}>
              {T.cerrar}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
