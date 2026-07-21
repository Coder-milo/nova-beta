'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, GraduationCap, Loader2, AlertCircle, Info } from 'lucide-react'
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
  const [info, setInfo]         = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Aviso cuando apiFetch redirige aquí tras un 401 (token vencido).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('expired') === '1') {
      setInfo('Tu sesión expiró. Inicia sesión de nuevo para continuar.')
    }
  }, [])

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
    <div className="flex min-h-svh bg-background">
      {/* Video promocional (izquierda) */}
      <div className="hidden w-1/2 lg:relative lg:flex lg:flex-col lg:items-center lg:justify-center lg:overflow-hidden lg:bg-[#1C315E]">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/nova-crm-promo.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="absolute inset-0 bg-[#1C315E]/30" />
        <div className="relative z-10 flex flex-col items-center gap-4 px-12 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <GraduationCap className="size-9 text-white" />
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            NOVA CRM
          </h2>
          <p className="text-lg text-white/70">
            Empleabilidad inteligente para tu institución
          </p>
        </div>
      </div>

      {/* Formulario (derecha) */}
      <div className="flex w-full items-center justify-center px-4 lg:w-1/2">
        <div className="w-full max-w-sm">
        {/* Logo / Título (móvil) */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
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

        {/* Logo / Título (escritorio) */}
        <div className="mb-8 hidden flex-col items-center gap-3 text-center lg:flex">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Iniciar sesión
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Accede al panel administrativo
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

          {/* Sesión expirada */}
          {info && !error && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-sm text-foreground"
            >
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{info}</span>
            </div>
          )}

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
    </div>
  )
}
