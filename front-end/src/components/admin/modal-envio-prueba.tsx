'use client'

/**
 * Modal de envío de correo de prueba directo.
 *
 * Permite a coordinadores y administradores despachar una prueba a su propia
 * casilla de correo (o a un destinatario específico) para verificar la visualización
 * real en clientes de correo (Gmail, Outlook, Apple Mail), validando el filtro
 * de seguridad y la sustitución de variables simuladas.
 */

import { useState } from 'react'
import {
  CircleAlert as WarningCircle,
  CircleCheck as CheckCircle,
  LoaderCircle as CircleNotch,
  Mail as EnvelopeSimple,
  Send as PaperPlaneTilt,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { correosApi, plantillasCorreoApi, mensajeDeError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { usePreferences } from '@/lib/preferences'
import type { ResumenEnvioCorreo } from '@/lib/types'

// RFC 5322 regex simplificado para validación estricta de correo electrónico
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export interface ModalEnvioPruebaProps {
  abierto: boolean
  onCerrar: () => void
  asunto?: string
  cuerpo?: string
  botonTexto?: string | null
  botonUrl?: string | null
  programaId?: string | null
  estudianteId?: string | null
  variablesSimuladas?: Record<string, string>
  tipo?: string | null
  onEnviado?: (
    resultado: {
      enviados: number
      bloqueadosPorLista: number
      fallidos: number
      canalDeCorreo: string
    },
    destinatario: string,
  ) => void
}

/** Textos propios de este modal, en los dos idiomas. */
function textos(english: boolean) {
  return english
    ? {
        titulo: 'Send Test Email',
        descripcion: 'Send a real test email to your inbox to inspect rendering, formatting, and responsiveness across email clients.',
        destinatario: 'Target Email Address',
        placeholderEmail: 'e.g. coordinator@example.com',
        asunto: 'Subject',
        variablesActivas: 'Active Simulation Profile',
        enviar: 'Send Test Email',
        enviando: 'Sending email…',
        cancelar: 'Cancel',
        emailInvalido: 'Please enter a valid email address (e.g. user@domain.com).',
        envioExitoso: 'Test email sent successfully!',
        bloqueadoFiltro: 'Email was filtered by whitelist (DestinatariosPermitidos).',
        falloEnvio: 'The test email could not be delivered.',
        resumenEnvio: 'Dispatch Telemetry',
        canal: 'Channel',
      }
    : {
        titulo: 'Enviar Correo de Prueba',
        descripcion: 'Despacha un correo de prueba real a tu bandeja de entrada para verificar diseño, botones y visualización responsive.',
        destinatario: 'Dirección de correo destino',
        placeholderEmail: 'ej. coordinador@novacrm.org',
        asunto: 'Asunto del correo',
        variablesActivas: 'Variables simuladas activas',
        enviar: 'Enviar prueba',
        enviando: 'Enviando correo…',
        cancelar: 'Cancelar',
        emailInvalido: 'Por favor ingresa una dirección de correo válida (ej. usuario@dominio.com).',
        envioExitoso: '¡Correo de prueba enviado con éxito!',
        bloqueadoFiltro: 'El correo fue interceptado por la lista de destinatarios permitidos.',
        falloEnvio: 'No se pudo enviar el correo de prueba.',
        resumenEnvio: 'Resumen de despacho',
        canal: 'Canal de transporte',
      }
}

export function ModalEnvioPrueba({
  abierto,
  onCerrar,
  asunto = '',
  cuerpo = '',
  botonTexto,
  botonUrl,
  programaId,
  estudianteId,
  variablesSimuladas = {},
  tipo,
  onEnviado,
}: ModalEnvioPruebaProps) {
  const { user } = useAuth()
  const { locale } = usePreferences()
  const T = textos(locale === 'en')

  const [destinatario, setDestinatario] = useState(user?.email ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResumenEnvioCorreo | null>(null)

  const emailValido = EMAIL_REGEX.test(destinatario.trim())

  const handleEnviar = async () => {
    const destinoLimpio = destinatario.trim()
    if (!EMAIL_REGEX.test(destinoLimpio)) {
      setError(T.emailInvalido)
      return
    }

    setEnviando(true)
    setError(null)
    setResultado(null)

    try {
      let res: {
        enviados: number
        bloqueadosPorLista: number
        fallidos: number
        canalDeCorreo: string
        destinatarios?: number
        sinCorreo?: number
        simulacion?: boolean
        destinatariosPermitidos?: string[]
        detalle?: any[]
      }

      if (tipo) {
        res = await correosApi.enviarPrueba({
          tipo,
          destinatario: destinoLimpio,
          programaId: programaId || undefined,
          estudianteId: estudianteId || undefined,
        })
      } else {
        res = await plantillasCorreoApi.enviarPrueba({
          destinatario: destinoLimpio,
          asunto,
          cuerpo,
          botonTexto: botonTexto || null,
          botonUrl: botonUrl || null,
          programaId: programaId || null,
          variablesSimuladas,
        })
      }

      setResultado({
        destinatarios: res.destinatarios ?? 1,
        enviados: res.enviados,
        bloqueadosPorLista: res.bloqueadosPorLista,
        fallidos: res.fallidos,
        sinCorreo: res.sinCorreo ?? 0,
        simulacion: res.simulacion ?? false,
        canalDeCorreo: res.canalDeCorreo,
        destinatariosPermitidos: res.destinatariosPermitidos ?? [],
        detalle: res.detalle ?? [],
      })

      if (res.enviados > 0) {
        onEnviado?.(res, destinoLimpio)
      }
    } catch (e) {
      setError(mensajeDeError(e, T.falloEnvio))
    } finally {
      setEnviando(false)
    }
  }

  const handleCerrar = () => {
    setError(null)
    setResultado(null)
    onCerrar()
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => { if (!open) handleCerrar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EnvelopeSimple className="size-5 text-primary" />
            {T.titulo}
          </DialogTitle>
          <DialogDescription>{T.descripcion}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              <WarningCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resultado && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-xs">
              <div className="flex items-center gap-2 font-medium text-foreground">
                {resultado.enviados > 0 ? (
                  <>
                    <CheckCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-400">{T.envioExitoso}</span>
                  </>
                ) : resultado.bloqueadosPorLista > 0 ? (
                  <>
                    <WarningCircle className="size-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-amber-700 dark:text-amber-400">{T.bloqueadoFiltro}</span>
                  </>
                ) : (
                  <>
                    <WarningCircle className="size-4 text-destructive" />
                    <span className="text-destructive">{T.falloEnvio}</span>
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="rounded border border-border bg-card p-2 text-center">
                  <p className="text-sm font-semibold tabular-nums text-foreground">{resultado.enviados}</p>
                  <p className="text-[10px] text-muted-foreground">Enviados</p>
                </div>
                <div className="rounded border border-border bg-card p-2 text-center">
                  <p className="text-sm font-semibold tabular-nums text-foreground">{resultado.bloqueadosPorLista}</p>
                  <p className="text-[10px] text-muted-foreground">Bloqueados</p>
                </div>
                <div className="rounded border border-border bg-card p-2 text-center">
                  <p className="text-sm font-semibold tabular-nums text-foreground">{resultado.fallidos}</p>
                  <p className="text-[10px] text-muted-foreground">Fallidos</p>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground pt-1">
                {T.canal}: <span className="font-mono text-foreground">{resultado.canalDeCorreo}</span>
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="email-destino-prueba">
              {T.destinatario}
            </label>
            <Input
              id="email-destino-prueba"
              type="email"
              value={destinatario}
              onChange={(e) => {
                setDestinatario(e.target.value)
                if (error) setError(null)
              }}
              placeholder={T.placeholderEmail}
              className="text-sm font-mono"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">{T.asunto}</p>
            <p className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground truncate">
              {asunto || '(Sin asunto definido)'}
            </p>
          </div>

          {Object.keys(variablesSimuladas).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {T.variablesActivas} ({Object.keys(variablesSimuladas).length})
              </p>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto rounded-lg border border-border bg-card p-2">
                {Object.entries(variablesSimuladas).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="font-mono text-[10px] py-0 px-1.5">
                    {`{{${k}}}`}: {v}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleCerrar} disabled={enviando}>
            {T.cancelar}
          </Button>
          <Button
            size="sm"
            onClick={handleEnviar}
            disabled={enviando || !destinatario.trim() || !emailValido}
            className="gap-1.5 cursor-pointer"
          >
            {enviando ? (
              <>
                <CircleNotch className="size-3.5 animate-spin" />
                {T.enviando}
              </>
            ) : (
              <>
                <PaperPlaneTilt className="size-3.5" />
                {T.enviar}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
