'use client'

import { ArrowLeft, CheckCircle, CircleNotch, Eye, EyeSlash, GraduationCap, WarningCircle } from '@phosphor-icons/react'
/**
 * Página de recuperación de contraseña.
 *
 * Dos modos según la URL:
 *   /recuperar-contrasena            → formulario de email (forgot password)
 *   /recuperar-contrasena?token=...  → formulario de nueva contraseña (reset)
 */

import { Suspense, useState, useTransition } from 'react'
import { useSearchParams } from '@/compat/next-navigation'
import Link from '@/compat/next-link'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authApi, ApiCallError } from '@/lib/api'

// ─── Modo 1: solicitar enlace por email ──────────────────────────────────────

function FormularioEmail() {
  const [email, setEmail]   = useState('')
  const [enviado, setEnviado] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try { await authApi.forgotPassword(email.trim()) } catch { /* respuesta uniforme por seguridad */ }
      setEnviado(true)
    })
  }

  if (enviado) {
    return (
      <div className="flex flex-col gap-4">
        <div role="status" className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 px-3 py-3 text-sm text-green-700 dark:text-green-300">
          <CheckCircle className="mt-0.5 size-4 shrink-0" />
          <span>Si el correo existe, enviamos un enlace para restablecer la contraseña. Revisa tu bandeja de entrada.</span>
        </div>
        <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Volver a iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="rec-email" className="text-sm font-medium text-foreground">Correo electrónico</label>
        <Input id="rec-email" type="email" autoComplete="email" required placeholder="tu@correo.com"
          value={email} onChange={(e) => setEmail(e.target.value)} disabled={isPending} />
      </div>
      <Button type="submit" disabled={isPending} className="mt-1 h-9 w-full">
        {isPending ? <><CircleNotch className="size-4 animate-spin" /> Enviando…</> : 'Enviar enlace de recuperación'}
      </Button>
      <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Volver a iniciar sesión
      </Link>
    </form>
  )
}

// ─── Modo 2: establecer nueva contraseña ─────────────────────────────────────

function FormularioNuevaContrasena({ token }: { token: string }) {
  const [password, setPassword]   = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [listo, setListo]         = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (password !== confirmar) { setError('Las contraseñas no coinciden.'); return }
    startTransition(async () => {
      try {
        await authApi.resetPassword(token, password)
        setListo(true)
      } catch (err) {
        if (err instanceof ApiCallError) {
          setError(err.status === 400 || err.status === 401 || err.status === 404
            ? 'El enlace de recuperación es inválido o ya expiró. Solicita uno nuevo.'
            : `Error del servidor (HTTP ${err.status}). Intenta más tarde.`)
        } else { setError('No se pudo conectar con el servidor.') }
      }
    })
  }

  if (listo) {
    return (
      <div className="flex flex-col gap-4">
        <div role="status" className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 px-3 py-3 text-sm text-green-700 dark:text-green-300">
          <CheckCircle className="mt-0.5 size-4 shrink-0" />
          <span>Tu contraseña fue restablecida correctamente.</span>
        </div>
        <Link href="/login" className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">
          Ir a iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="rec-pass" className="text-sm font-medium text-foreground">Nueva contraseña</label>
        <div className="relative">
          <Input id="rec-pass" type={showPass ? 'text' : 'password'} autoComplete="new-password" required
            placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)}
            disabled={isPending} className="pr-10" aria-describedby={error ? 'rec-error' : undefined} />
          <button type="button" onClick={() => setShowPass((v) => !v)}
            aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPass ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="rec-confirmar" className="text-sm font-medium text-foreground">Confirmar contraseña</label>
        <Input id="rec-confirmar" type={showPass ? 'text' : 'password'} autoComplete="new-password" required
          placeholder="Repite la contraseña" value={confirmar} onChange={(e) => setConfirmar(e.target.value)}
          disabled={isPending} aria-describedby={error ? 'rec-error' : undefined} />
      </div>

      {error && (
        <div id="rec-error" role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="mt-1 h-9 w-full">
        {isPending ? <><CircleNotch className="size-4 animate-spin" /> Guardando…</> : 'Restablecer contraseña'}
      </Button>
      <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Volver a iniciar sesión
      </Link>
    </form>
  )
}

// ─── Contenido (usa useSearchParams, requiere Suspense) ──────────────────────

function RecuperarContenido() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <GraduationCap className="size-8" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {token ? 'Nueva contraseña' : 'Recuperar contraseña'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {token
              ? 'Define tu nueva contraseña de acceso.'
              : 'Te enviaremos un enlace para restablecerla.'}
          </p>
        </div>
      </div>

      {token ? <FormularioNuevaContrasena token={token} /> : <FormularioEmail />}
    </div>
  )
}

export default function RecuperarContrasenaPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <Suspense fallback={
        <div className="flex items-center justify-center py-20">
          <PageSpinner />
        </div>
      }>
        <RecuperarContenido />
      </Suspense>
    </div>
  )
}
