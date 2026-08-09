'use client'

/**
 * Canal de WhatsApp Cloud API de cada proyecto.
 *
 * El token es el único campo solo-escritura: el servidor lo cifra y nunca lo
 * devuelve. Dejarlo vacío al guardar conserva el token ya guardado; sin token
 * no se puede activar el canal. Los avisos automáticos (match, cuenta creada,
 * anuncio) usan las plantillas nova_match, nova_cuenta y nova_anuncio, que
 * deben estar aprobadas en Meta Business Manager; el botón de prueba no las
 * necesita porque Meta permite mensajes de texto al propio número del negocio.
 *
 * Requiere ADMIN o COORDINADOR.
 */

import { useCallback, useEffect, useState } from 'react'
import { ArrowsClockwiseIcon as ArrowsClockwise, CheckCircleIcon as CheckCircle, CircleNotchIcon as CircleNotch, FloppyDiskIcon as FloppyDisk, PaperPlaneTiltIcon as PaperPlaneTilt, WhatsappLogoIcon as WhatsappLogo, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
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
  MensajeWhatsappResponse,
  ProgramaResponse,
  ResultadoEnvio,
  WhatsappResponse,
} from '@/lib/types'

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        mensajesAutomaticosA: 'Automatic messages to students via the WhatsApp Cloud API. Each project has its own number, phone and token.',
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
      }
    : {
        mensajesAutomaticosA: 'Mensajes automáticos a los estudiantes por WhatsApp Cloud API. Cada proyecto tiene su propio número, teléfono y token.',
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
        ultimosMensajes: 'Últimos mensajes',
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
    try {
      const [c, mensajes] = await Promise.all([
        whatsappApi.consultar(id),
        whatsappApi.bandeja(id),
      ])
      setCanal(c)
      setNumero(c.numeroWhatsapp ?? '')
      setPhoneId(c.phoneId ?? '')
      setActivo(c.activo)
      setBandeja(mensajes)
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

  return (
    <Card className="rounded-2xl border-primary/25 bg-card/95 shadow-sm dark:border-primary/35 dark:bg-card">
      <CardHeader className="border-b border-border/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <WhatsappLogo className="size-5 text-primary" weight="duotone" />
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

      <CardContent className="flex flex-col gap-5 pt-6">
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
                  <CheckCircle className="size-4 shrink-0" weight="fill" />
                  {T.mensajeDePrueba}
                </p>
              ) : (
                <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  <WarningCircle className="mt-0.5 size-4 shrink-0" />
                  {resultadoPrueba.motivoFallo}
                </p>
              )
            )}

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
                <CheckCircle className="size-4 shrink-0" weight="fill" />
                Canal guardado.
              </p>
            )}

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
                          {new Date(m.fecha).toLocaleString('es-CO')}
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
