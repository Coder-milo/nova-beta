'use client'

/**
 * Avisos in-app (éxito / error), en vez de `alert()` del navegador.
 *
 * <p>El `alert()` bloquea el hilo, no se estila y rompe la sensación de
 * producto. Este hook mantiene un aviso a la vez y lo pinta como un toast fijo
 * abajo a la derecha, que se cierra solo a los seis segundos o a mano.
 *
 * <pre>
 * const { mostrarExito, mostrarError, avisos } = useAvisos()
 * // ...
 * catch (e) { mostrarError(mensajeDeError(e, 'No se pudo guardar.')) }
 * // en el JSX, una vez:
 * {avisos}
 * </pre>
 */

import { useCallback, useState } from 'react'
import { CheckCircleIcon as CheckCircle, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
import { usePreferences } from '@/lib/preferences'

export type TipoAviso = 'exito' | 'error'

interface Aviso {
  tipo: TipoAviso
  mensaje: string
}

export function useAvisos() {
  const [aviso, setAviso] = useState<Aviso | null>(null)

  const mostrar = useCallback((tipo: TipoAviso, mensaje: string) => {
    setAviso({ tipo, mensaje })
    window.setTimeout(
      () => setAviso((actual) => (actual?.mensaje === mensaje ? null : actual)),
      6000,
    )
  }, [])

  const mostrarExito = useCallback((mensaje: string) => mostrar('exito', mensaje), [mostrar])
  const mostrarError = useCallback((mensaje: string) => mostrar('error', mensaje), [mostrar])

  const avisos = <ToastAviso aviso={aviso} onCerrar={() => setAviso(null)} />

  return { mostrarExito, mostrarError, avisos }
}

function ToastAviso({ aviso, onCerrar }: { aviso: Aviso | null; onCerrar: () => void }) {
  const { locale } = usePreferences()
  if (!aviso) return null
  const exito = aviso.tipo === 'exito'
  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[calc(100vw-2rem)] max-w-sm">
      <div
        role="status"
        className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-sm shadow-lg ${
          exito
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
            : 'border-destructive/30 bg-destructive/10 text-destructive'
        }`}
      >
        <div className="flex items-start gap-2.5">
          {exito ? (
            <CheckCircle className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <WarningCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          )}
          <span className="font-medium leading-snug">{aviso.mensaje}</span>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-md p-1 opacity-70 hover:opacity-100"
          aria-label={locale === 'en' ? 'Dismiss notice' : 'Cerrar aviso'}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
