'use client'

/**
 * La ruta vieja del tablero de postulaciones.
 *
 * El tablero no desapareció: es la vista «Por postulación» de Seguimiento. Eran
 * dos ejes de lo mismo —cómo va la persona y cómo va cada proceso— repartidos
 * en dos entradas del menú, y quien entraba en una no tenía forma de saber que
 * existía la otra.
 *
 * Esta página se queda como redirección y no se borra: hay enlaces guardados y
 * marcadores apuntando aquí, y un 404 no explica a dónde se fue la pantalla.
 */

import { useEffect } from 'react'
import { useRouter } from '@/compat/next-navigation'
import { PageSpinner } from '@/components/ui/page-spinner'

export default function PostulacionesRedirigidas() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/seguimiento?vista=postulaciones')
  }, [router])

  return <PageSpinner />
}
