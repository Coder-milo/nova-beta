'use client'

/**
 * A qué altura sale el panel del asistente.
 *
 * El zorro se arrastra a cualquier altura y su posición se guarda, pero el
 * panel de conversación se colgaba siempre del borde inferior de la ventana.
 * Con el zorro a media pantalla —o abajo del todo, que es donde lo deja casi
 * todo el mundo— el panel salía por su cuenta: subía hasta arriba, se metía
 * debajo de la cabecera y tapaba el título de la pantalla. Se veía descolocado
 * porque lo estaba: el globo no salía de quien hablaba.
 *
 * <p>Aquí se calcula el hueco desde abajo para que el panel termine a la altura
 * del zorro, sin salirse: nunca se pega al borde inferior ni sube por encima de
 * la cabecera. Lo devuelve en píxeles y se aplica sólo de `sm` para arriba; en
 * un teléfono el panel ocupa el ancho completo y va anclado abajo, que es lo
 * que cabe.
 */

import { useEffect, useState } from 'react'
import { TAMANO_Y } from './zorro-asistente'

/** Alto del panel: el mismo `min(70dvh, 560px)` que declara su clase. */
const ALTO_MAXIMO = 560
const PROPORCION_ALTO = 0.7

/** Lo que se reserva arriba para la cabecera de la aplicación. */
const MARGEN_SUPERIOR = 88

/** Lo mínimo que se separa del borde de abajo. */
const MARGEN_INFERIOR = 16

/** Debajo de esto el panel ocupa el ancho completo y va anclado abajo. */
const ANCHO_ESCRITORIO = 640

/**
 * @returns el estilo del contenedor del panel: en escritorio, el hueco desde
 *   abajo que lo deja a la altura del zorro; en móvil, nada, para que manden
 *   las clases. Va como estilo en línea y no como clase de Tailwind a
 *   propósito: es un número que cambia con el arrastre y con el tamaño de la
 *   ventana, y una clase por cada valor posible no existe.
 */
export function usarAnclaDelZorro(zorroY: number): { bottom?: string } {
  const [abajo, setAbajo] = useState<number | null>(null)

  useEffect(() => {
    const recalcular = () => {
      const alto = window.innerHeight
      if (window.innerWidth < ANCHO_ESCRITORIO) {
        setAbajo(null)
        return
      }
      const altoPanel = Math.min(alto * PROPORCION_ALTO, ALTO_MAXIMO)
      // El pie del zorro, medido desde abajo, que es como se ancla el panel.
      const pieDelZorro = alto - (zorroY + TAMANO_Y)
      const techo = Math.max(MARGEN_INFERIOR, alto - altoPanel - MARGEN_SUPERIOR)
      setAbajo(Math.round(Math.min(Math.max(pieDelZorro, MARGEN_INFERIOR), techo)))
    }
    recalcular()
    window.addEventListener('resize', recalcular)
    return () => window.removeEventListener('resize', recalcular)
  }, [zorroY])

  return abajo === null ? {} : { bottom: `${abajo}px` }
}
