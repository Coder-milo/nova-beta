'use client'

/**
 * Canal de WhatsApp Cloud API de cada proyecto y automatizaciones de seguimiento.
 *
 * El token es el único campo solo-escritura: el servidor lo cifra y nunca lo
 * devuelve. Dejarlo vacío al guardar conserva el token ya guardado; sin token
 * no se puede activar el canal. Los avisos automáticos (match, cuenta creada,
 * anuncio, inactividad, resumen semanal y check-in de seguimiento) usan plantillas
 * aprobadas en Meta Business Manager con control de presupuesto integrado.
 *
 * Requiere ADMIN o COORDINADOR.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2 as CheckCircle,
  CircleAlert as WarningCircle,
  LoaderCircle as CircleNotch,
  RefreshCw as ArrowsClockwise,
  Save as FloppyDisk,
  Send as PaperPlaneTilt,
  Zap,
  PiggyBank,
  Users,
  Calendar,
  Eye,
  Clock,
  Briefcase,
  UserCheck,
  ShieldCheck,
} from 'lucide-react'
import { WhatsappLogo } from '@/components/ui/iconos-de-marca'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { programasApi, whatsappApi } from '@/lib/api'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'
import type {
  CandidatoAutomatizacionWhatsapp,
  MensajeWhatsappResponse,
  MetricasPresupuestoWhatsapp,
  ProgramaResponse,
  ResultadoEnvio,
  ResumenAutomatizacionWhatsapp,
  WhatsappResponse,
} from '@/lib/types'

/**
 * Textos propios de esta pantalla.
 */
function textos(english: boolean) {
  return english
    ? {
        mensajesAutomaticosA: 'Automatic messages and student nudges via the WhatsApp Cloud API. Each project has its own number, phone, token and budget optimizer.',
        esteProyectoAun: 'This project has no WhatsApp channel yet: students see no contact button and receive no message alerts.',
        elCanalEsta: 'The channel is saved but disabled. Enable it so the automatic alerts start going out.',
        codigoDePais: 'Country code included, with no spaces or dashes. Alerts are sent from this number.',
        mensajeDePrueba: 'Test message sent. Check the WhatsApp of the business number.',
        soloEscrituraNo: 'Write-only: it is not shown again',
        guardaYActiva: 'Save and enable the channel before testing',
        canalDeWhatsapp: 'Project WhatsApp channel',
        requiereGuardarEl: '(the token must be saved first)',
        numeroDesconocido: 'Unknown number',
        numeroDelNegocio: 'Business number',
        conexionConMeta: 'Connection to Meta',
        tokenDeAcceso: 'Access token',
        ultimosMensajes: 'Latest messages',
        automatizaciones: 'Smart Automations & Budget Control',
        controlPresupuesto: 'Smart budget control prevents sending per-job spam, grouping weekly digests and enforcing a 7-day cooldown per student.',
        simular: 'Simulate / Preview',
        ejecutar: 'Execute Real Send',
        diasInactividad: 'Inactivity threshold',
        resumenSemanal: 'Weekly Job Digest',
        nudgeInactividad: 'Inactivity Postulation Nudge',
        checkinSeguimiento: 'Employment Follow-up Check-in',
        enviadosMes: 'Sent this month',
        ahorroEstimado: 'Estimated savings',
        inactivosDetectados: 'Inactive candidates',
        conVacantes: 'With pending jobs',
        candidatosElegibles: 'Eligible candidates',
      }
    : {
        mensajesAutomaticosA: 'Mensajes automáticos y reenganche de participantes por WhatsApp Cloud API. Cada proyecto cuenta con su número, token y optimizador de presupuesto.',
        esteProyectoAun: 'Este proyecto aún no tiene canal de WhatsApp: los estudiantes no ven botón de contacto ni reciben avisos por mensaje.',
        elCanalEsta: 'El canal está guardado pero desactivado. Actívalo para que los avisos automáticos empiecen a enviarse.',
        codigoDePais: 'Código de país incluido, sin espacios ni guiones. Los avisos se envían desde este número.',
        mensajeDePrueba: 'Mensaje de prueba enviado. Revisa el WhatsApp del número del negocio.',
        soloEscrituraNo: 'Solo-escritura: no vuelve a mostrarse',
        guardaYActiva: 'Guarda y activa el canal antes de probar',
        canalDeWhatsapp: 'Canal de WhatsApp del proyecto',
        requiereGuardarEl: '(requiere guardar el token)',
        numeroDesconocido: 'Número desconocido',
        numeroDelNegocio: 'Número del negocio',
        conexionConMeta: 'Conexión con Meta',
        tokenDeAcceso: 'Token de acceso',
        ultimosMensajes: 'Últimos mensajes de la bitácora',
        automatizaciones: 'Automatizaciones Inteligentes y Control de Presupuesto',
        controlPresupuesto: 'El control de presupuesto evita costos por envío atómico diario: agrupa vacantes afines en resúmenes semanales y aplica un cooldown estricto de 7 días.',
        simular: 'Simular / Vista Previa',
        ejecutar: 'Ejecutar Envío Real',
        diasInactividad: 'Días de inactividad',
        resumenSemanal: 'Resumen Semanal de Ofertas',
        nudgeInactividad: 'Nudge por Inactividad en Postulaciones',
        checkinSeguimiento: 'Check-in de Seguimiento Laboral',
        enviadosMes: 'Enviados este mes',
        ahorroEstimado: 'Ahorro estimado',
        inactivosDetectados: 'Inactivos detectados',
        conVacantes: 'Con ofertas afines',
        candidatosElegibles: 'Candidatos elegibles',
      }
}

export function PanelWhatsapp({ programaIdInicial }: { programaIdInicial?: string } = {}) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [programas, setProgramas] = useState<ProgramaResponse[]>([])
  const [programaId, setProgramaId] = useState(programaIdInicial ?? '')
  const [canal, setCanal] = useState<WhatsappResponse | null>(null)

  const [numero, setNumero] = useState('')
  const [phoneId, setPhoneId] = useState('')
  const [token, setToken] = useState('')
  const [activo, setActivo] = useState(false)

  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [resultadoPrueba, setResultadoPrueba] = useState<ResultadoEnvio | null>(null)
  const [bandeja, setBandeja] = useState<MensajeWhatsappResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  // Automatizaciones y presupuesto
  const [metricas, setMetricas] = useState<MetricasPresupuestoWhatsapp | null>(null)
  const [diasInactividad, setDiasInactividad] = useState(7)
  const [ejecutandoAuto, setEjecutandoAuto] = useState(false)
  const [resumenEjecucion, setResumenEjecucion] = useState<ResumenAutomatizacionWhatsapp | null>(null)
  const [verCandidatos, setVerCandidatos] = useState(false)

  useEffect(() => {
    programasApi
      .listar()
      .then((lista) => {
        setProgramas(lista)
        if (lista.length > 0) setProgramaId((actual) => actual || programaIdInicial || lista[0].id)
      })
      .catch(() => setProgramas([]))
  }, [programaIdInicial])

  const cargar = useCallback(async (id: string) => {
    if (!id) return
    setCargando(true)
    setError(null)
    setGuardado(false)
    setResultadoPrueba(null)
    setResumenEjecucion(null)
    try {
      const [c, mensajes, met] = await Promise.all([
        whatsappApi.consultar(id),
        whatsappApi.bandeja(id),
        whatsappApi.metricas(id).catch(() => null),
      ])
      setCanal(c)
      setNumero(c.numeroWhatsapp ?? '')
      setPhoneId(c.phoneId ?? '')
      setActivo(c.activo)
      setBandeja(mensajes)
      setMetricas(met)
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar(programaId)
  }, [programaId, cargar])

  const guardar = async () => {
    if (!programaId) return
    setGuardando(true)
    setError(null)
    setGuardado(false)
    setResultadoPrueba(null)
    try {
      const c = await whatsappApi.guardar(programaId, {
        numeroWhatsapp: numero.trim() || null,
        phoneId: phoneId.trim() || null,
        // Vacío = conservar el token cifrado del servidor.
        token: token.trim() || null,
        activo,
      })
      setCanal(c)
      setToken('')
      setGuardado(true)
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setGuardando(false)
    }
  }

  const probar = async () => {
    if (!programaId) return
    setProbando(true)
    setResultadoPrueba(null)
    try {
      setResultadoPrueba(await whatsappApi.probar(programaId))
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setProbando(false)
    }
  }

  const ejecutarAutomatizacion = async (tipo: 'INACTIVIDAD' | 'SEMANAL' | 'SEGUIMIENTO', simulacion: boolean) => {
    if (!programaId) return
    setEjecutandoAuto(true)
    setError(null)
    try {
      let res: ResumenAutomatizacionWhatsapp
      if (tipo === 'INACTIVIDAD') {
        res = await whatsappApi.ejecutarInactividad(programaId, diasInactividad, simulacion)
      } else if (tipo === 'SEMANAL') {
        res = await whatsappApi.ejecutarResumenSemanal(programaId, simulacion)
      } else {
        res = await whatsappApi.ejecutarSeguimiento(programaId, 30, simulacion)
      }
      setResumenEjecucion(res)
      setVerCandidatos(true)
      // Refrescar bitácora y métricas si fue ejecución real
      if (!simulacion) {
        const [mensajes, met] = await Promise.all([
          whatsappApi.bandeja(programaId),
          whatsappApi.metricas(programaId).catch(() => null),
        ])
        setBandeja(mensajes)
        setMetricas(met)
      }
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setEjecutandoAuto(false)
    }
  }

  return (
    <Card className="rounded-2xl border-primary/25 bg-card/95 shadow-sm dark:border-primary/35 dark:bg-card">
      <CardHeader className="border-b border-border/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <WhatsappLogo className="size-5 text-primary" />
              {T.canalDeWhatsapp}
            </CardTitle>
            <CardDescription>
              {T.mensajesAutomaticosA}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => cargar(programaId)}
            disabled={cargando || !programaId}
          >
            <ArrowsClockwise className="mr-1 size-3.5" /> Recargar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 pt-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-foreground/85" htmlFor="whatsapp-programa">
            Proyecto
          </label>
          <select
            id="whatsapp-programa"
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            value={programaId}
            onChange={(e) => setProgramaId(e.target.value)}
          >
            {programas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        {cargando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleNotch className="size-4 animate-spin" /> Cargando…
          </p>
        )}

        {canal && !cargando && (
          <>
            {!canal.configurado && (
              <p className="rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
                {T.esteProyectoAun}
              </p>
            )}

            {canal.configurado && !canal.activo && (
              <p className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                {T.elCanalEsta}
              </p>
            )}

            {/* Configuración de Conexión */}
            <fieldset className="grid gap-4 rounded-xl border border-border/60 bg-secondary/10 p-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {T.conexionConMeta}
              </legend>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-foreground/85">{T.numeroDelNegocio}</label>
                <Input
                  className="h-10 font-mono"
                  placeholder="573001234567"
                  value={numero}
                  onChange={(e) => {
                    setNumero(e.target.value)
                    setGuardado(false)
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {T.codigoDePais}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-foreground/85">Phone ID</label>
                <Input
                  className="h-10 font-mono"
                  placeholder="123456789012345"
                  value={phoneId}
                  onChange={(e) => {
                    setPhoneId(e.target.value)
                    setGuardado(false)
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-foreground/85">{T.tokenDeAcceso}</label>
                <Input
                  className="h-10 font-mono"
                  type="password"
                  placeholder={canal.tokenConfigurado ? 'Ya hay un token guardado (vacío = conservarlo)' : T.soloEscrituraNo}
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value)
                    setGuardado(false)
                  }}
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer"
                  checked={activo}
                  disabled={!canal.tokenConfigurado && !token}
                  onChange={(e) => {
                    setActivo(e.target.checked)
                    setGuardado(false)
                  }}
                />
                <span className="text-[13px] font-medium text-foreground/85">
                  Canal activo
                  {!canal.tokenConfigurado && !token && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {T.requiereGuardarEl}
                    </span>
                  )}
                </span>
              </label>
            </fieldset>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={guardar} disabled={guardando}>
                {guardando ? <CircleNotch className="size-4 animate-spin" /> : <FloppyDisk className="size-4" />}
                Guardar canal
              </Button>
              <Button
                variant="outline"
                onClick={probar}
                disabled={probando || !canal.tokenConfigurado || !canal.activo}
                title={
                  !canal.tokenConfigurado || !canal.activo
                    ? T.guardaYActiva
                    : undefined
                }
              >
                {probando ? <CircleNotch className="size-4 animate-spin" /> : <PaperPlaneTilt className="size-4" />}
                Enviar mensaje de prueba
              </Button>
            </div>

            {resultadoPrueba && (
              resultadoPrueba.enviado ? (
                <p className="flex items-center gap-2 rounded-xl border border-green-500/25 bg-green-500/10 px-3 py-2.5 text-sm font-medium text-green-700 dark:text-green-300">
                  <CheckCircle className="size-4 shrink-0" />
                  {T.mensajeDePrueba}
                </p>
              ) : (
                <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  <WarningCircle className="mt-0.5 size-4 shrink-0" />
                  {resultadoPrueba.motivoFallo}
                </p>
              )
            )}

            {/* SECCIÓN DE AUTOMATIZACIONES Y CONTROL DE PRESUPUESTO */}
            <div className="rounded-2xl border border-primary/20 bg-muted/20 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Zap className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{T.automatizaciones}</h3>
                    <p className="text-xs text-muted-foreground">{T.controlPresupuesto}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-primary" /> Cooldown: 7 días
                </div>
              </div>

              {/* Métricas de Presupuesto */}
              {metricas && (
                <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="rounded-xl border border-border/50 bg-card p-3">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <PaperPlaneTilt className="size-3 text-primary" /> {T.enviadosMes}
                    </span>
                    <p className="mt-1 text-lg font-bold text-foreground">
                      {metricas.totalEnviadosMes}{' '}
                      <span className="text-[11px] font-normal text-muted-foreground">/ {metricas.limiteSugerido}</span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-card p-3">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <PiggyBank className="size-3 text-emerald-500" /> {T.ahorroEstimado}
                    </span>
                    <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      ~{metricas.porcentajeAhorroEstimado}%
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-card p-3">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Clock className="size-3 text-amber-500" /> {T.inactivosDetectados}
                    </span>
                    <p className="mt-1 text-lg font-bold text-foreground">
                      {metricas.estudiantesInactivosDetectados}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-card p-3">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Briefcase className="size-3 text-primary" /> {T.conVacantes}
                    </span>
                    <p className="mt-1 text-lg font-bold text-foreground">
                      {metricas.estudiantesConVacantesPendientes}
                    </p>
                  </div>
                </div>
              )}

              {/* Botonera de Automatizaciones */}
              <div className="grid gap-3 sm:grid-cols-3">
                {/* 1. Nudge por Inactividad */}
                <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card p-3.5 shadow-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-amber-500" />
                      <span className="text-xs font-bold text-foreground">{T.nudgeInactividad}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      Reengancha a estudiantes que no se han postulado en varios días pero tienen ofertas compatibles.
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-foreground/80">{T.diasInactividad}:</span>
                      <select
                        aria-label={T.diasInactividad}
                        className="h-7 rounded-lg border border-input bg-background px-2 text-xs"
                        value={diasInactividad}
                        onChange={(e) => setDiasInactividad(Number(e.target.value))}
                      >
                        <option value={7}>7 días</option>
                        <option value={14}>14 días</option>
                        <option value={21}>21 días</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={ejecutandoAuto}
                      onClick={() => ejecutarAutomatizacion('INACTIVIDAD', true)}
                    >
                      <Eye className="mr-1 size-3" /> {T.simular}
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={ejecutandoAuto || !canal.activo}
                      onClick={() => ejecutarAutomatizacion('INACTIVIDAD', false)}
                    >
                      <PaperPlaneTilt className="mr-1 size-3" /> {T.ejecutar}
                    </Button>
                  </div>
                </div>

                {/* 2. Resumen Semanal de Ofertas */}
                <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card p-3.5 shadow-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">{T.resumenSemanal}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      Agrupa las vacantes afines en un solo mensaje de alto impacto por semana (Weekly Digest económico).
                    </p>
                  </div>

                  <div className="mt-4 flex flex-col gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={ejecutandoAuto}
                      onClick={() => ejecutarAutomatizacion('SEMANAL', true)}
                    >
                      <Eye className="mr-1 size-3" /> {T.simular}
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={ejecutandoAuto || !canal.activo}
                      onClick={() => ejecutarAutomatizacion('SEMANAL', false)}
                    >
                      <PaperPlaneTilt className="mr-1 size-3" /> {T.ejecutar}
                    </Button>
                  </div>
                </div>

                {/* 3. Check-in de Seguimiento Laboral */}
                <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card p-3.5 shadow-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <UserCheck className="size-4 text-emerald-500" />
                      <span className="text-xs font-bold text-foreground">{T.checkinSeguimiento}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      Pregunta el estado de empleo a participantes sin contacto en &gt;30 días y actualiza la bitácora.
                    </p>
                  </div>

                  <div className="mt-4 flex flex-col gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={ejecutandoAuto}
                      onClick={() => ejecutarAutomatizacion('SEGUIMIENTO', true)}
                    >
                      <Eye className="mr-1 size-3" /> {T.simular}
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={ejecutandoAuto || !canal.activo}
                      onClick={() => ejecutarAutomatizacion('SEGUIMIENTO', false)}
                    >
                      <PaperPlaneTilt className="mr-1 size-3" /> {T.ejecutar}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Resultados de la Ejecución / Simulación */}
              {resumenEjecucion && (
                <div className="mt-4 rounded-xl border border-border/70 bg-card p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${resumenEjecucion.simulacion ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <h4 className="text-xs font-bold text-foreground">
                        {resumenEjecucion.simulacion ? 'Resultado de Simulación' : 'Ejecución Completada'} ({resumenEjecucion.tipo})
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>Evaluados: <strong>{resumenEjecucion.totalEvaluados}</strong></span>
                      <span>Elegibles: <strong className="text-primary">{resumenEjecucion.elegibles}</strong></span>
                      {!resumenEjecucion.simulacion && (
                        <span>Enviados: <strong className="text-emerald-600">{resumenEjecucion.enviados}</strong></span>
                      )}
                      {!resumenEjecucion.simulacion && resumenEjecucion.omitidosPorCooldown > 0 && (
                        <span>Cooldown: <strong>{resumenEjecucion.omitidosPorCooldown}</strong></span>
                      )}
                    </div>
                  </div>

                  {resumenEjecucion.candidatos.length > 0 ? (
                    <div className="mt-2.5 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                      {resumenEjecucion.candidatos.map((c) => (
                        <div key={c.estudianteId} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">{c.nombreCompleto}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{c.motivo}</p>
                          </div>
                          <span className="font-mono text-[11px] text-foreground/80 shrink-0 ml-2">{c.celular}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No hay estudiantes que cumplan los criterios de disparo en este momento.
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
              >
                <WarningCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}

            {guardado && (
              <p className="flex items-center gap-2 rounded-xl border border-green-500/25 bg-green-500/10 px-3 py-2.5 text-sm font-medium text-green-700 dark:text-green-300">
                <CheckCircle className="size-4 shrink-0" />
                Canal guardado.
              </p>
            )}

            {/* Bitácora de Mensajes */}
            {bandeja && bandeja.length > 0 && (
              <fieldset className="flex flex-col gap-2 rounded-xl border border-border/60 bg-secondary/10 p-4">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {T.ultimosMensajes}
                </legend>
                {bandeja.slice(0, 8).map((m) => (
                  <div key={m.id} className="flex items-start gap-2.5 rounded-lg bg-background/60 px-3 py-2">
                    <span
                      className={`mt-1 size-2 shrink-0 rounded-full ${m.tipo === 'ENTRANTE' ? 'bg-emerald-500' : 'bg-primary'}`}
                      title={m.tipo === 'ENTRANTE' ? 'Entrante' : 'Saliente'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {m.estudiante || m.remitente || T.numeroDesconocido}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {new Date(m.fecha).toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO')}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{m.texto}</p>
                    </div>
                  </div>
                ))}
              </fieldset>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
