'use client'

/**
 * Piezas de formulario compartidas.
 *
 * Estaban copiadas en Colocaciones, Empresas y Mis postulaciones con tres
 * variantes ligeramente distintas del mismo componente, que es como acaban
 * separándose los formularios sin que nadie lo decida.
 */

import { Children, cloneElement, isValidElement, useId } from 'react'
import { CheckCircle2 as CheckCircle, CircleAlert as WarningCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Campo ───────────────────────────────────────────────────────────────────

export interface CampoProps {
  etiqueta: string
  /** Marca visual y `aria-required` en el control. */
  requerido?: boolean
  /** Ocupa las dos columnas de una rejilla `sm:grid-cols-2`. */
  ancho?: boolean
  /** Texto de apoyo bajo el control. */
  ayuda?: string
  /** Mensaje de validación; sustituye a la ayuda y pinta el borde en rojo. */
  error?: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}

/**
 * Etiqueta + control + ayuda.
 *
 * <p>Si no se le pasa `htmlFor`, genera un id y lo enlaza con el `<label>`.
 * Sin eso, pulsar la etiqueta no enfoca el campo y un lector de pantalla lee
 * el control como si no tuviera nombre.
 */
export function Campo({
  etiqueta,
  requerido,
  ancho,
  ayuda,
  error,
  htmlFor,
  children,
  className,
}: CampoProps) {
  const idGenerado = useId()
  const id = htmlFor ?? idGenerado
  const idAyuda = `${id}-ayuda`

  return (
    <div className={cn('space-y-1.5', ancho && 'sm:col-span-2', className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {etiqueta}
        {requerido && (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        )}
      </label>

      <div
        // El id y el aria van al control real, no al contenedor: es el input
        // el que tiene que quedar descrito, no el div que lo envuelve.
        className={cn(
          '[&>input]:w-full [&>select]:w-full [&>textarea]:w-full',
          error && '[&>input]:border-destructive [&>select]:border-destructive [&>textarea]:border-destructive',
        )}
      >
        {enlazar(children, { id, 'aria-required': requerido || undefined, 'aria-describedby': ayuda || error ? idAyuda : undefined, 'aria-invalid': error ? true : undefined })}
      </div>

      {(error || ayuda) && (
        <p id={idAyuda} className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
          {error ?? ayuda}
        </p>
      )}
    </div>
  )
}

/**
 * Pasa los atributos de accesibilidad al primer hijo si acepta props.
 *
 * <p>Se hace con `cloneElement` en vez de exigir que cada llamada repita el id
 * porque, si depende de la disciplina de quien escribe el formulario, la mitad
 * de los campos acaban sin etiqueta enlazada.
 */
function enlazar(children: React.ReactNode, props: Record<string, unknown>): React.ReactNode {
  let yaEnlazado = false
  return Children.map(children, (hijo) => {
    // Solo el primer control: un campo con dos inputs (rango de fechas) no
    // debe acabar con el mismo id repetido, que es HTML inválido.
    if (yaEnlazado || !isValidElement(hijo)) return hijo
    yaEnlazado = true

    const existentes = hijo.props as Record<string, unknown>
    const nuevos: Record<string, unknown> = {}
    for (const [clave, valor] of Object.entries(props)) {
      // No pisar lo que el formulario haya puesto a mano.
      if (valor !== undefined && existentes[clave] === undefined) nuevos[clave] = valor
    }
    return cloneElement(hijo, nuevos)
  })
}

// ── Selector ────────────────────────────────────────────────────────────────

export interface SelectorProps {
  value: string
  onChange: (valor: string) => void
  /** Cadenas sueltas, o pares valor/etiqueta cuando no coinciden. */
  opciones: readonly (string | { valor: string; etiqueta: string })[]
  /** Texto de la opción vacía. Omitir para que no haya opción vacía. */
  vacio?: string
  id?: string
  disabled?: boolean
  className?: string
}

export function Selector({ value, onChange, opciones, vacio, id, disabled, className }: SelectorProps) {
  return (
    <select
      id={id}
      disabled={disabled}
      className={cn(
        'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {vacio !== undefined && <option value="">{vacio}</option>}
      {opciones.map((o) => {
        const valor = typeof o === 'string' ? o : o.valor
        const etiqueta = typeof o === 'string' ? o : o.etiqueta
        return (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        )
      })}
    </select>
  )
}

// ── Opción (grupo de botones excluyentes) ───────────────────────────────────

/**
 * Un valor de un grupo tipo radio dibujado como botones.
 *
 * <p>Se usa para los tri-estado —hitos de preparación, checklist de ingreso—,
 * donde un `<select>` de tres valores obliga a dos clics para ver las opciones
 * y aquí se necesita comparar de un vistazo qué está sin revisar.
 */
export function Opcion({
  activa,
  onClick,
  disabled,
  children,
}: {
  activa: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="radio"
      aria-checked={activa}
      className={cn(
        'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        activa
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background hover:bg-accent',
      )}
    >
      {children}
    </button>
  )
}

/** Contenedor de un grupo de `Opcion`. Aporta la semántica de radiogroup. */
export function GrupoOpciones({
  etiqueta,
  children,
  className,
}: {
  etiqueta: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className={cn('flex shrink-0 gap-1', className)}>
      {children}
    </div>
  )
}

// ── Aviso ───────────────────────────────────────────────────────────────────

export function Aviso({
  tipo,
  children,
  className,
}: {
  tipo: 'error' | 'ok'
  children: React.ReactNode
  className?: string
}) {
  const esError = tipo === 'error'
  return (
    <p
      // `alert` para el error y `status` para el acierto: el primero interrumpe
      // al lector de pantalla, el segundo espera turno. Un fallo al guardar sí
      // debe interrumpir.
      role={esError ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-lg p-3 text-sm',
        esError
          ? 'bg-destructive/10 text-destructive'
          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        className,
      )}
    >
      {esError ? (
        <WarningCircle className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CheckCircle className="mt-0.5 size-4 shrink-0" />
      )}
      {children}
    </p>
  )
}

// ── Cifra ───────────────────────────────────────────────────────────────────

export function Cifra({
  etiqueta,
  valor,
  icono,
  nota,
  className,
}: {
  etiqueta: string
  valor: string | number
  icono?: React.ReactNode
  nota?: string
  className?: string
}) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icono}
        {etiqueta}
      </div>
      <div className="mt-1 text-2xl font-bold">{valor}</div>
      {nota && <div className="text-xs text-amber-600 dark:text-amber-400">{nota}</div>}
    </div>
  )
}
