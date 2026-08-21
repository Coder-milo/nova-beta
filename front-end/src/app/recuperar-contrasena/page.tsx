'use client'

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2 as CheckCircle,
  CircleAlert as WarningCircle,
  Eye,
  EyeOff as EyeSlash,
  LoaderCircle as CircleNotch,
  Lock as LockKey,
  Mail as Envelope,
} from 'lucide-react'
import Image from '@/compat/next-image'
import { Suspense, useState, useTransition } from 'react'
import { useSearchParams } from '@/compat/next-navigation'
import Link from '@/compat/next-link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MedidorSeguridadContrasena } from '@/components/ui/medidor-seguridad-contrasena'
import { PageSpinner } from '@/components/ui/page-spinner'
import { authApi, ApiCallError } from '@/lib/api'
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
        siElCorreo: 'If the email exists, we sent a link to reset the password. Check your inbox.',
        elEnlaceDe: 'The recovery link is invalid or has expired. Request a new one.',
        laContrasenaDebe: 'The password must be at least 8 characters.',
        tuContrasenaFue: 'Your password was reset successfully.',
        teEnviaremosUn: 'We will email you a link to reset it.',
        defineTuNueva: 'Set your new sign-in password.',
        enviarEnlaceDe: 'Send recovery link',
        enviando: 'Sending…',
        guardando: 'Saving…',
        lasContrasenasNo: 'The passwords do not match.',
        noSePudo: 'Could not reach the server. Check that the backend is running.',
        restablecerContrasena: 'Reset password',
        recuperarContrasena: 'Recover password',
        confirmarContrasena: 'Confirm password',
        repiteLaContrasena: 'Repeat the password',
        volverAIniciar: 'Back to sign in',
        irAIniciar: 'Go to sign in',
        minimo8Caracteres: 'At least 8 characters',
        nuevaContrasena: 'New password',
        ocultarContrasena: 'Hide password',
        mostrarContrasena: 'Show password',
        correoElectronico: 'Email address',
        empleabilidadInteligentePara: 'Smart employability for your institution.',
        gestionaEstudiantesProyectos: 'Manage students, projects, résumés and vacancies from a single panel.',
        matchingDeVacantes: 'Vacancy matching',
        hojasDeVida: 'ATS résumés',
      }
    : {
        siElCorreo: 'Si el correo existe, enviamos un enlace para restablecer la contraseña. Revisa tu bandeja de entrada.',
        elEnlaceDe: 'El enlace de recuperación es inválido o ya expiró. Solicita uno nuevo.',
        laContrasenaDebe: 'La contraseña debe tener al menos 8 caracteres.',
        tuContrasenaFue: 'Tu contraseña fue restablecida correctamente.',
        teEnviaremosUn: 'Te enviaremos un enlace para restablecerla.',
        defineTuNueva: 'Define tu nueva contraseña de acceso.',
        enviarEnlaceDe: 'Enviar enlace de recuperación',
        enviando: 'Enviando...',
        guardando: 'Guardando...',
        lasContrasenasNo: 'Las contraseñas no coinciden.',
        noSePudo: 'No fue posible conectar con el servidor. Verifica que el backend esté activo.',
        restablecerContrasena: 'Restablecer contraseña',
        recuperarContrasena: 'Recuperar contraseña',
        confirmarContrasena: 'Confirmar contraseña',
        repiteLaContrasena: 'Repite la contraseña',
        volverAIniciar: 'Volver a iniciar sesión',
        irAIniciar: 'Ir a iniciar sesión',
        minimo8Caracteres: 'Mínimo 8 caracteres',
        nuevaContrasena: 'Nueva contraseña',
        ocultarContrasena: 'Ocultar contraseña',
        mostrarContrasena: 'Mostrar contraseña',
        correoElectronico: 'Correo electrónico',
        empleabilidadInteligentePara: 'Empleabilidad inteligente para tu institución.',
        gestionaEstudiantesProyectos: 'Gestiona estudiantes, proyectos, hojas de vida y vacantes desde un solo panel.',
        matchingDeVacantes: 'Matching de vacantes',
        hojasDeVida: 'Hojas de vida ATS',
      }
}

// ─── Modo 1: solicitar enlace por email ──────────────────────────────────────

function FormularioEmail() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await authApi.forgotPassword(email.trim())
        setEnviado(true)
      } catch (err) {
        if (err instanceof ApiCallError) {
          setError(
            err.body?.message ??
              `El servidor respondió con un error (${err.status}). Intenta más tarde.`,
          )
        } else {
          // Seguridad por diseño / respuesta uniforme
          setEnviado(true)
        }
      }
    })
  }

  if (enviado) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-3.5 py-3 text-xs font-medium text-emerald-100 backdrop-blur-md"
        >
          <CheckCircle className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          <span className="leading-5">{T.siElCorreo}</span>
        </div>
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0071E3] font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-[#0077ED] active:scale-[0.98]"
        >
          <ArrowLeft className="size-4" />
          {T.volverAIniciar}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="rec-email"
          className="ml-1 text-xs font-semibold uppercase tracking-wider text-white/70"
        >
          {T.correoElectronico}
        </label>
        <div className="group relative">
          <Envelope className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-[#86868B] transition-colors group-focus-within:text-[#0071E3]" />
          <Input
            id="rec-email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="correo@academiacac.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            className="h-12 rounded-xl border border-black/10 bg-white pl-11 pr-4 text-sm text-[#1D1D1F] shadow-xs transition-all placeholder:text-[#86868B]/60 focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/25"
          />
        </div>
      </div>

      {error && (
        <div
          id="rec-error"
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-300/40 bg-red-500/25 px-3.5 py-2.5 text-xs font-medium text-red-50 backdrop-blur-md"
        >
          <WarningCircle className="mt-0.5 size-4 shrink-0 text-red-200" />
          <span className="leading-5">{error}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="mt-2 h-11 w-full rounded-xl bg-[#0071E3] font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-[#0077ED] active:scale-[0.98]"
      >
        {isPending ? (
          <>
            <CircleNotch className="mr-2 size-4 animate-spin" />
            {T.enviando}
          </>
        ) : (
          <>
            {T.enviarEnlaceDe}
            <ArrowRight className="ml-2 size-4" />
          </>
        )}
      </Button>

      <div className="mt-4 flex items-center justify-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 transition-colors hover:text-white hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          {T.volverAIniciar}
        </Link>
      </div>
    </form>
  )
}

// ─── Modo 2: establecer nueva contraseña ─────────────────────────────────────

function FormularioNuevaContrasena({ token }: { token: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError(T.laContrasenaDebe)
      return
    }
    if (password !== confirmar) {
      setError(T.lasContrasenasNo)
      return
    }
    startTransition(async () => {
      try {
        await authApi.resetPassword(token, password)
        setListo(true)
      } catch (err) {
        if (err instanceof ApiCallError) {
          setError(
            err.status === 400 || err.status === 401 || err.status === 404
              ? T.elEnlaceDe
              : `Error del servidor (HTTP ${err.status}). Intenta más tarde.`,
          )
        } else {
          setError(T.noSePudo)
        }
      }
    })
  }

  if (listo) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-3.5 py-3 text-xs font-medium text-emerald-100 backdrop-blur-md"
        >
          <CheckCircle className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          <span className="leading-5">{T.tuContrasenaFue}</span>
        </div>
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0071E3] font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-[#0077ED] active:scale-[0.98]"
        >
          {T.irAIniciar}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nueva contraseña */}
      <div className="space-y-1.5">
        <label
          htmlFor="rec-pass"
          className="ml-1 text-xs font-semibold uppercase tracking-wider text-white/70"
        >
          {T.nuevaContrasena}
        </label>
        <div className="group relative">
          <LockKey className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-[#86868B] transition-colors group-focus-within:text-[#0071E3]" />
          <Input
            id="rec-pass"
            type={showPass ? 'text' : 'password'}
            autoComplete="new-password"
            required
            autoFocus
            placeholder={T.minimo8Caracteres}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
            className="h-12 rounded-xl border border-black/10 bg-white pl-11 pr-11 text-sm text-[#1D1D1F] shadow-xs transition-all placeholder:text-[#86868B]/60 focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/25"
            aria-describedby={error ? 'rec-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            aria-label={showPass ? T.ocultarContrasena : T.mostrarContrasena}
            className="absolute right-3 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#86868B] hover:bg-black/5 hover:text-[#1D1D1F] transition-colors"
          >
            {showPass ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/10 p-2.5 backdrop-blur-md">
          <MedidorSeguridadContrasena value={password} />
        </div>
      </div>

      {/* Confirmar contraseña */}
      <div className="space-y-1.5">
        <label
          htmlFor="rec-confirmar"
          className="ml-1 text-xs font-semibold uppercase tracking-wider text-white/70"
        >
          {T.confirmarContrasena}
        </label>
        <div className="group relative">
          <LockKey className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-[#86868B] transition-colors group-focus-within:text-[#0071E3]" />
          <Input
            id="rec-confirmar"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            required
            placeholder={T.repiteLaContrasena}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            disabled={isPending}
            className="h-12 rounded-xl border border-black/10 bg-white pl-11 pr-11 text-sm text-[#1D1D1F] shadow-xs transition-all placeholder:text-[#86868B]/60 focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/25"
            aria-describedby={error ? 'rec-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? T.ocultarContrasena : T.mostrarContrasena}
            className="absolute right-3 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#86868B] hover:bg-black/5 hover:text-[#1D1D1F] transition-colors"
          >
            {showConfirm ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div
          id="rec-error"
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-300/40 bg-red-500/25 px-3.5 py-2.5 text-xs font-medium text-red-50 backdrop-blur-md"
        >
          <WarningCircle className="mt-0.5 size-4 shrink-0 text-red-200" />
          <span className="leading-5">{error}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="mt-2 h-11 w-full rounded-xl bg-[#0071E3] font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-[#0077ED] active:scale-[0.98]"
      >
        {isPending ? (
          <>
            <CircleNotch className="mr-2 size-4 animate-spin" />
            {T.guardando}
          </>
        ) : (
          <>
            {T.restablecerContrasena}
            <ArrowRight className="ml-2 size-4" />
          </>
        )}
      </Button>

      <div className="mt-4 flex items-center justify-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 transition-colors hover:text-white hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          {T.volverAIniciar}
        </Link>
      </div>
    </form>
  )
}

// ─── Contenido (usa useSearchParams, requiere Suspense) ──────────────────────

function RecuperarContenido() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  return (
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
          {token ? T.nuevaContrasena : T.recuperarContrasena}
        </h1>
        <p className="mt-1 text-sm text-white/65">
          {token ? T.defineTuNueva : T.teEnviaremosUn}
        </p>
      </div>

      {token ? <FormularioNuevaContrasena token={token} /> : <FormularioEmail />}

      {/* Footer / Copyright */}
      <p className="mt-8 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50 lg:text-left">
        © {new Date().getFullYear()} Academy CAC · Nodo académico
      </p>
    </div>
  )
}

export default function RecuperarContrasenaPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const [backgroundIndex, setBackgroundIndex] = useState(0)
  const [backgroundLoaded, setBackgroundLoaded] = useState(false)
  const [backgroundFailed, setBackgroundFailed] = useState(false)

  const handleBackgroundError = () => {
    setBackgroundLoaded(false)
    if (backgroundIndex < LOGIN_BACKGROUNDS.length - 1) {
      setBackgroundIndex((current) => current + 1)
      return
    }
    setBackgroundFailed(true)
  }

  return (
    <main className="relative flex h-svh w-full overflow-hidden text-white">
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
            <Image
              src="/brand/cac-logo-white.png"
              alt="CAC Academic"
              width={44}
              height={44}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <h2 className="max-w-lg text-[2.1rem] font-bold leading-[1.12] tracking-tight text-white xl:text-[2.5rem]">
            {T.empleabilidadInteligentePara}
          </h2>
          <p className="max-w-md text-[0.95rem] leading-relaxed text-white/75">
            {T.gestionaEstudiantesProyectos}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {['Estudiantes', T.hojasDeVida, T.matchingDeVacantes].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur-md"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* DERECHA · panel de vidrio con el formulario */}
        <div className="flex w-full flex-1 items-center justify-center p-5 sm:p-8">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <PageSpinner />
              </div>
            }
          >
            <RecuperarContenido />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
