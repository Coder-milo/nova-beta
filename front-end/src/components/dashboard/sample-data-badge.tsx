import { Badge } from '@/components/ui/badge'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

/** Se muestra junto al título de una tarjeta cuando usa mock-data en vez de datos reales del backend (FE-13). */
/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        datosDeEjemplo: 'Sample data',
      }
    : {
        datosDeEjemplo: 'Datos de ejemplo',
      }
}

export function SampleDataBadge() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  return (
    <Badge
      variant="outline"
      className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300"
    >
      {T.datosDeEjemplo}
    </Badge>
  )
}
