import { Badge } from '@/components/ui/badge'

/** Se muestra junto al título de una tarjeta cuando usa mock-data en vez de datos reales del backend (FE-13). */
export function SampleDataBadge() {
  return (
    <Badge
      variant="outline"
      className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300"
    >
      Datos de ejemplo
    </Badge>
  )
}
