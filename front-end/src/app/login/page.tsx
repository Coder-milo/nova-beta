'use client'

import { ArrowRight, CircleAlert as WarningCircle, Eye, EyeOff as EyeSlash, Info, LoaderCircle as CircleNotch, Lock as LockKey, Mail as Envelope } from 'lucide-react'
import Image from '@/compat/next-image'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from '@/compat/next-navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageSpinner } from '@/components/ui/page-spinner'
import { ApiCallError, useAuth } from '@/lib/auth'
import { RUTA_INICIO_ESTUDIANTE, soloEsEstudiante } from '@/lib/navigation'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

const LOGIN_BACKGROUNDS = [
  '/fondo-login.webp',
  '/fondo-login.png',
  '/fondo-login.jpg',
  '/fondo-login.jpeg',
]

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        noFuePosible: 'Could not reach the server. Check that the backend is running.',
        demasiadosIntentosEspera: 'Too many attempts. Wait a few minutes and try again.',
        credencialesIncorrectasVerifica: 'Wrong credentials. Check your email and password.',
        tuSesionExpiro: 'Your session expired. Sign in again to continue.',
        gestionaEstudiantesProyectos: 'Manage students, projects, résumés and vacancies from a single panel.',
        empleabilidadInteligentePara: 'Smart employability for your institution.',
        iniciaSesionEn: 'Sign in to the admin panel',
        olvidasteTuContrasena: 'Forgot your password?',
        iniciandoSesion: 'Signing in…',
        bienvenidoDeNuevo: 'Welcome back',
        iniciarSesion: 'Sign in',
        matchingDeVacantes: 'Vacancy matching',
        hojasDeVida: 'ATS résumés',
        ocultarContrasena: 'Hide password',
        mostrarContrasena: 'Show password',
        correoElectronico: 'Email address',
        contrasena: 'Password',
      }
    : {
        noFuePosible: 'No fue posible conectar con el servidor. Verifica que el backend esté activo.',
        demasiadosIntentosEspera: 'Demasiados intentos. Espera unos minutos e inténtalo nuevamente.',
        credencialesIncorrectasVerifica: 'Credenciales incorrectas. Verifica tu correo y contraseña.',
        tuSesionExpiro: 'Tu sesión expiró. Inicia sesión nuevamente para continuar.',
        gestionaEstudiantesProyectos: 'Gestiona estudiantes, proyectos, hojas de vida y vacantes desde un solo panel.',
        empleabilidadInteligentePara: 'Empleabilidad inteligente para tu institución.',
        iniciaSesionEn: 'Inicia sesión en el panel administrativo',
        olvidasteTuContrasena: '¿Olvidaste tu contraseña?',
        iniciandoSesion: 'Iniciando sesión...',
        bienvenidoDeNuevo: 'Bienvenido de nuevo',
        iniciarSesion: 'Iniciar sesión',
        matchingDeVacantes: 'Matching de vacantes',
        hojasDeVida: 'Hojas de vida ATS',
        ocultarContrasena: 'Ocultar contraseña',
        mostrarContrasena: 'Mostrar contraseña',
        correoElectronico: 'Correo electrónico',
        contrasena: 'Contraseña',
      }
}

export default function LoginPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const router = useRouter()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [backgroundIndex, setBackgroundIndex] = useState(0)
  const [backgroundLoaded, setBackgroundLoaded] = useState(false)
  const [backgroundFailed, setBackgroundFailed] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('expired') === '1') {
      setInfo(T.tuSesionExpiro)
    }
  }, [])

  const handleBackgroundError = () => {
    setBackgroundLoaded(false)

    if (backgroundIndex < LOGIN_BACKGROUNDS.length - 1) {
      setBackgroundIndex((current) => current + 1)
      return
    }

    setBackgroundFailed(true)
  }

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()

    setError(null)
    setInfo(null)

    startTransition(async () => {
      try {
        const usuario = await login(email.trim(), password)
        // Cada rol a su sitio. Mandar a todo el mundo a `/` dejaba al
        // estudiante en el dashboard de administracion, que no puede consultar.
        router.replace(
          soloEsEstudiante(usuario?.roles) ? RUTA_INICIO_ESTUDIANTE : '/',
        )
      } catch (err) {
        if (err instanceof ApiCallError) {
          if (err.status === 401 || err.status === 403) {
            setError(
              T.credencialesIncorrectasVerifica,
            )
          } else if (err.status === 429) {
            setError(
              T.demasiadosIntentosEspera,
            )
          } else {
            // El mensaje del backend antes de inventar uno. Decir "error del
            // servidor" ante cualquier código que no fuera 401/403/429 convertía
            // problemas del propio formulario en una avería imaginaria: el
            // usuario se quedaba esperando a que arreglaran algo que no estaba
            // roto en vez de revisar lo que había escrito.
            setError(
              err.body?.message ??
                `El servidor respondió con un error (${err.status}). Intenta más tarde.`,
            )
          }
        } else {
          setError(
            T.noFuePosible,
          )
        }
      }
    })
  }

  return (
    <main className="relative flex h-svh w-full overflow-hidden text-white">
      {isPending && <PageSpinner label={T.iniciandoSesion} />}
      {/* ═══ Foto del CAC a sangre (fondo completo) ═══ */}
      {!backgroundFailed ? (
        <Image
          src={LOGIN_BACKGROUNDS[backgroundIndex]}
          onError={handleBackgroundError}
          alt="Sede CAC Academic"
          fill
          priority
          sizes="100vw"
          className="scale-105 object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A1B3D] to-[#12224A]" />
      )}
      {/* Velos de marca navy: garantizan contraste del texto blanco sobre la foto */}
      <div className="absolute inset-0 bg-[#08152E]/55" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#08152E]/85 via-[#08152E]/35 to-[#08152E]/75" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0071E3]/12 via-transparent to-[#E02D24]/10" />

      {/* ═══ Contenido en 2 columnas sobre la foto ═══ */}
      <div className="relative z-10 flex h-full w-full">
        {/* IZQUIERDA · marca sobre la foto (solo escritorio) */}
        <div className="hidden w-1/2 flex-col justify-end gap-5 p-12 xl:p-16 lg:flex">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-white/25 bg-white/10 p-2.5 backdrop-blur-md">
            <Image src="/brand/cac-logo-white.png" alt="CAC Academic" width={44} height={44} priority className="h-full w-full object-contain" />
          </div>
          <h2 className="max-w-lg text-[2.1rem] font-bold leading-[1.12] tracking-tight text-white xl:text-[2.5rem]">
            {T.empleabilidadInteligentePara}
          </h2>
          <p className="max-w-md text-[0.95rem] leading-relaxed text-white/75">
            {T.gestionaEstudiantesProyectos}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {['Estudiantes', T.hojasDeVida, T.matchingDeVacantes].map((t) => (
              <span key={t} className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur-md">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* DERECHA · panel de vidrio con el formulario */}
        <div className="flex w-full flex-1 items-center justify-center p-5 sm:p-8">
          <div className="w-full max-w-[420px] rounded-[28px] border border-white/20 bg-white/10 p-7 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-9">
            {/* Logo + título */}
            <div className="mb-7 flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-white/25 bg-white/15 p-2 backdrop-blur-md">
                <Image
                  src="/brand/cac-logo-white.png"
                  alt="Logo CAC Academic"
                  width={38}
                  height={38}
                  priority
                  className="h-full w-full object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {T.bienvenidoDeNuevo}
              </h1>
              <p className="mt-1 text-sm text-white/65">
                {T.iniciaSesionEn}
              </p>
            </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Usuario / Correo */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="ml-1 text-xs font-semibold uppercase tracking-wider text-white/70"
              >
                {T.correoElectronico}
              </label>
              <div className="group relative">
                <Envelope className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-[#86868B] transition-colors group-focus-within:text-[#0071E3]" />
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  placeholder="correo@academiacac.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isPending}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="h-12 rounded-xl border border-black/10 bg-white pl-11 pr-4 text-sm text-[#1D1D1F] shadow-xs transition-all placeholder:text-[#86868B]/60 focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/25"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="ml-1 text-xs font-semibold uppercase tracking-wider text-white/70"
                >
                  {T.contrasena}
                </label>
                <a
                  href="/recuperar-contrasena"
                  className="text-xs font-medium text-white/80 hover:text-white hover:underline"
                >
                  {T.olvidasteTuContrasena}
                </a>
              </div>
              <div className="group relative">
                <LockKey className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-[#86868B] transition-colors group-focus-within:text-[#0071E3]" />
                <Input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isPending}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="h-12 rounded-xl border border-black/10 bg-white pl-11 pr-11 text-sm text-[#1D1D1F] shadow-xs transition-all placeholder:text-[#86868B]/60 focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((current) => !current)}
                  disabled={isPending}
                  aria-label={showPass ? T.ocultarContrasena : T.mostrarContrasena}
                  aria-pressed={showPass}
                  className="absolute right-3 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#86868B] hover:bg-black/5 hover:text-[#1D1D1F] transition-colors"
                >
                  {showPass ? (
                    <EyeSlash className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Mensajes de Alerta */}
            {info && !error && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-medium text-white backdrop-blur-md"
              >
                <Info className="mt-0.5 size-4 shrink-0 text-white/80" />
                <span className="leading-5">{info}</span>
              </div>
            )}

            {error && (
              <div
                id="login-error"
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-300/40 bg-red-500/25 px-3.5 py-2.5 text-xs font-medium text-red-50 backdrop-blur-md"
              >
                <WarningCircle className="mt-0.5 size-4 shrink-0 text-red-200" />
                <span className="leading-5">{error}</span>
              </div>
            )}

            {/* Botón Iniciar Sesión */}
            <Button
              type="submit"
              disabled={isPending}
              className="mt-2 h-11 w-full rounded-xl bg-[#0071E3] font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-[#0077ED] active:scale-[0.98]"
            >
              {isPending ? (
                <>
                  <CircleNotch className="mr-2 size-4 animate-spin" />
                  {T.iniciandoSesion}
                </>
              ) : (
                <>
                  {T.iniciarSesion}
                  <ArrowRight className="ml-2 size-4" />
                </>
              )}
            </Button>
          </form>

            {/* Footer / Copyright */}
            <p className="mt-8 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50 lg:text-left">
              © {new Date().getFullYear()} Academy CAC · Nodo académico
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
