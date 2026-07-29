import { cn } from '@/lib/utils'

/**
 * Lenguaje de estados del expediente: punto de color + texto teñido.
 * El color comunica el estado sin que el fondo compita con el contenido.
 */
export function EstadoDot({
  dot,
  text,
  label,
  className,
}: {
  dot: string
  text: string
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium',
        text,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-[7px] shrink-0 rounded-full', dot)} />
      {label}
    </span>
  )
}
