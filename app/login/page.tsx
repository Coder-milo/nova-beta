'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, GraduationCap, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth, ApiCallError } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        await login(email.trim(), password)
        router.replace('/')
      } catch (err) {
        if (err instanceof ApiCallError) {
          if (err.status === 401 || err.status === 403) {
            setError('Credenciales incorrectas. Verifica tu email y contraseña.')
          } else if (err.status === 429) {
            setError('Demasiados intentos. Espera un momento e inténtalo de nuevo.')
          } else {
            setError(`Error del servidor (${err.status}). Intenta más tarde.`)
          }
        } else {
          setError('No se pudo conectar con el servidor. ¿Está el backend activo?')
        }
      }
    })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Título */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <GraduationCap className="size-8" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Academia CAC
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Panel administrativo · Inicia sesión para continuar
            </p>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="login-email"
              className="text-sm font-medium text-foreground"
            >
              Correo electrónico
            </label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              placeholder="admin@novacrm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>

          {/* Contraseña */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="login-password"
              className="text-sm font-medium text-foreground"
            >
              Contraseña
            </label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                className="pr-10"
                aria-describedby={error ? 'login-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              id="login-error"
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={isPending}
            className="mt-1 h-9 w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Iniciando sesión…
              </>
            ) : (
              'Iniciar sesión'
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Credenciales de prueba:{' '}
          <code className="rounded bg-secondary px-1 py-0.5 text-foreground">
            admin@novacrm.com
          </code>{' '}
          /{' '}
          <code className="rounded bg-secondary px-1 py-0.5 text-foreground">
            admin123
          </code>
        </p>
      </div>
    </div>
  )
}
