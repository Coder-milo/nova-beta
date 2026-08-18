'use client'

/**
 * Quién de la empresa puede entrar al portal.
 *
 * El alta y la baja existían en el backend desde que se hizo el portal
 * —`POST` y `DELETE` sobre `/empresas/{id}/cuentas`— y no había ninguna
 * pantalla que llamara a ninguno de los dos. Es la quinta vez en este proyecto
 * que aparece lo mismo: la función construida y sin puerta.
 *
 * Dos cosas que se ven aquí y son decisiones, no estilo:
 *
 * - **No se escribe una contraseña.** Se invita y la persona la define con el
 *   enlace que le llega. Que el equipo teclee la clave de alguien de fuera
 *   significa que la conoce, y una clave que conocen dos personas ya no
 *   identifica a ninguna.
 * - **Las cuentas revocadas siguen a la vista**, marcadas. Ocultarlas llevaba a
 *   invitar otra vez el mismo correo y chocar con un error que desde la ficha
 *   no explica nada.
 */

import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Mail, ShieldOff, UserPlus } from 'lucide-react'
import { cuentasEmpresaApi, ApiCallError, type CuentaDelPortal } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirmar } from '@/components/ui/confirmar'
import { useAvisos } from '@/components/ui/avisos'
import { usePreferences } from '@/lib/preferences'

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Portal access',
        desc: 'Who from this company can sign in to publish vacancies and see applicants.',
        correo: 'Contact email',
        nombre: 'Name (optional)',
        invitar: 'Send invitation',
        invitando: 'Sending…',
        vacio: 'Nobody from this company has access yet.',
        activa: 'Active',
        revocada: 'Revoked',
        pendiente: 'Invitation pending',
        revocar: 'Revoke',
        reinvitar: 'Resend invitation',
        confirmarTitulo: 'Revoke this access?',
        confirmarTexto: (e: string) =>
          `${e} will no longer be able to sign in, and any open session is closed. The account is kept for the audit trail.`,
        confirmarBoton: 'Revoke',
        faltaCorreo: 'Enter an email address.',
        fallo: 'The invitation could not be sent.',
        sinCorreo: 'Account ready, but the email did not go out. Use “Resend invitation”.',
        listo: 'Invitation sent.',
        revocado: 'Access revoked.',
        nota: 'The password is never typed here: the invitation sends a link and the person sets their own.',
      }
    : {
        titulo: 'Acceso al portal',
        desc: 'Quién de esta empresa puede entrar a publicar vacantes y ver postulantes.',
        correo: 'Correo de contacto',
        nombre: 'Nombre (opcional)',
        invitar: 'Enviar invitación',
        invitando: 'Enviando…',
        vacio: 'Todavía nadie de esta empresa tiene acceso.',
        activa: 'Activa',
        revocada: 'Revocada',
        pendiente: 'Invitación pendiente',
        revocar: 'Revocar',
        reinvitar: 'Reenviar invitación',
        confirmarTitulo: '¿Revocar este acceso?',
        confirmarTexto: (e: string) =>
          `${e} dejará de poder entrar y se cierra la sesión que tenga abierta. La cuenta se conserva para la auditoría.`,
        confirmarBoton: 'Revocar',
        faltaCorreo: 'Escribe un correo.',
        fallo: 'No se pudo enviar la invitación.',
        sinCorreo: 'Cuenta lista, pero el correo no salió. Usa «Reenviar invitación».',
        listo: 'Invitación enviada.',
        revocado: 'Acceso revocado.',
        nota: 'Aquí nunca se escribe una contraseña: la invitación manda un enlace y la persona define la suya.',
      }
}

export function CuentasDelPortal({ empresaId }: { empresaId: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const { confirmar, dialogo } = useConfirmar()
  const { mostrarExito, mostrarError, avisos } = useAvisos()

  const [cuentas, setCuentas] = useState<CuentaDelPortal[] | null>(null)
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setCuentas(await cuentasEmpresaApi.listar(empresaId))
    } catch {
      setCuentas([])
    }
  }, [empresaId])

  useEffect(() => { void cargar() }, [cargar])

  const invitar = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!email.trim()) { mostrarError(T.faltaCorreo); return }
    setEnviando(true)
    try {
      const r = await cuentasEmpresaApi.invitar(empresaId, email.trim(), nombre.trim() || undefined)
      // Se distingue «no se pudo» de «se creó pero el correo falló»: en el
      // segundo caso la cuenta existe y repetir el alta daría un error confuso;
      // lo que hay que hacer es reenviar.
      if (r.correoEnviado) mostrarExito(T.listo)
      else mostrarError(T.sinCorreo)
      setEmail(''); setNombre('')
      await cargar()
    } catch (err) {
      mostrarError(err instanceof ApiCallError ? (err.body.message ?? T.fallo) : T.fallo)
    } finally {
      setEnviando(false)
    }
  }

  const revocar = async (cuenta: CuentaDelPortal) => {
    const sigue = await confirmar({
      titulo: T.confirmarTitulo,
      descripcion: T.confirmarTexto(cuenta.email),
      textoConfirmar: T.confirmarBoton,
      destructivo: true,
    })
    if (!sigue) return
    try {
      await cuentasEmpresaApi.revocar(empresaId, cuenta.id)
      mostrarExito(T.revocado)
      await cargar()
    } catch (err) {
      mostrarError(err instanceof ApiCallError ? (err.body.message ?? T.fallo) : T.fallo)
    }
  }

  return (
    <section className="mt-6 border-t border-border pt-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="size-4 text-primary" strokeWidth={2} />
        {T.titulo}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{T.desc}</p>

      <form onSubmit={invitar} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={T.correo}
          aria-label={T.correo}
          disabled={enviando}
        />
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={T.nombre}
          aria-label={T.nombre}
          disabled={enviando}
        />
        <Button type="submit" disabled={enviando} className="gap-1.5">
          <UserPlus className="size-4" />
          {enviando ? T.invitando : T.invitar}
        </Button>
      </form>

      <p className="mt-2 text-[11px] text-muted-foreground">{T.nota}</p>

      <div className="mt-3 rounded-md border border-border">
        {cuentas === null ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">…</p>
        ) : cuentas.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">{T.vacio}</p>
        ) : cuentas.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 last:border-0"
          >
            <Mail className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">{c.email}</span>
              {c.nombre && c.nombre !== c.email && (
                <span className="block truncate text-[11px] text-muted-foreground">{c.nombre}</span>
              )}
            </span>

            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                c.activa
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {c.activa ? T.activa : T.revocada}
            </span>

            {/* Se distingue «entró» de «invitada y sin entrar»: sin esto, una
                invitación que se perdió en el correo se ve igual que una cuenta
                en uso, y nadie sabe que hay que reenviarla. */}
            {c.activa && c.invitacionPendiente && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                {T.pendiente}
              </span>
            )}

            {c.activa ? (
              <Button variant="ghost" size="sm" onClick={() => void revocar(c)} className="gap-1.5">
                <ShieldOff className="size-3.5" />
                {T.revocar}
              </Button>
            ) : (
              // Reinvitar reutiliza la misma cuenta y la reactiva: crear otra
              // dejaría dos filas para la misma persona y el histórico partido.
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEmail(c.email); setNombre(c.nombre) }}
                className="gap-1.5"
              >
                <Mail className="size-3.5" />
                {T.reinvitar}
              </Button>
            )}
          </div>
        ))}
      </div>

      {dialogo}
      {avisos}
    </section>
  )
}
