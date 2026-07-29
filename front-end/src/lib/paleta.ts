/**
 * Paleta armónica derivada de un solo color.
 *
 * Al administrador se le pide **un** color y de ahí sale toda la gama. La
 * alternativa —pedirle diez— produce combinaciones que no funcionan: casi nadie
 * elige a mano un tono de hover que contraste, y menos aún un color de texto
 * que se lea encima del primario.
 *
 * Se trabaja en HSL y no en RGB porque las variaciones que hacen falta
 * —más claro, más oscuro, más apagado— son movimientos de una sola coordenada
 * en HSL, mientras que en RGB hay que tocar los tres canales a la vez y el tono
 * se desvía.
 *
 * Funciones puras, sin dependencias del DOM: se pueden probar sueltas.
 */

export interface Hsl {
  h: number
  s: number
  l: number
}

/** Un hex `#RRGGBB` a HSL. Devuelve null si no es un hex válido. */
export function hexAHsl(hex: string): Hsl | null {
  const limpio = hex.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(limpio)) return null

  const r = parseInt(limpio.slice(1, 3), 16) / 255
  const g = parseInt(limpio.slice(3, 5), 16) / 255
  const b = parseInt(limpio.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2

  if (delta === 0) return { h: 0, s: 0, l: l * 100 }

  const s = delta / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === r) h = ((g - b) / delta) % 6
  else if (max === g) h = (b - r) / delta + 2
  else h = (r - g) / delta + 4

  h = h * 60
  if (h < 0) h += 360

  return { h, s: s * 100, l: l * 100 }
}

function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

export function hslACss({ h, s, l }: Hsl): string {
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`
}

/**
 * El mismo color pero translúcido.
 *
 * Hace falta para los fondos que tienen que funcionar en claro **y** en oscuro.
 * Estas variables se escriben en línea sobre `<html>`, y un estilo en línea gana
 * siempre a la regla `.dark`: un color sólido pensado para fondo claro se queda
 * puesto también de noche. Con alfa, el mismo valor se lee como tinte suave
 * sobre claro y como brillo tenue sobre oscuro.
 */
export function hslACssAlfa({ h, s, l }: Hsl, alfa: number): string {
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${alfa})`
}

/**
 * Luminancia relativa según WCAG. Hace falta para decidir si encima del color
 * va texto blanco o negro; a ojo se falla justo en los tonos medios, que son
 * los que más se eligen.
 */
export function luminancia(hex: string): number {
  const canal = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const r = canal(parseInt(hex.slice(1, 3), 16))
  const g = canal(parseInt(hex.slice(3, 5), 16))
  const b = canal(parseInt(hex.slice(5, 7), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * El color de texto que se lee encima del primario.
 *
 * El umbral 0.45 —y no el 0.5 intuitivo— sale de comparar el contraste contra
 * blanco y contra negro: el ojo percibe el blanco más luminoso, así que el
 * punto en que conviene cambiar está algo por debajo de la mitad.
 */
export function textoSobre(hex: string): string {
  return luminancia(hex) > 0.45 ? '#101828' : '#FFFFFF'
}

/** Las variables CSS que consume la interfaz. */
export type VariablesTema = Record<string, string>

/**
 * Deriva la gama completa.
 *
 * Devuelve null si el color no es válido, para que quien llama pueda quedarse
 * con la gama global en vez de pintar la interfaz con valores rotos.
 */
export function paletaDesde(colorPrimario: string): VariablesTema | null {
  const base = hexAHsl(colorPrimario)
  if (!base) return null

  const { h, s, l } = base

  // La saturación se acota: por debajo de 25 el color deja de leerse como una
  // marca y por encima de 95 vibra sobre fondo blanco y cansa la vista.
  const sBase = limitar(s, 25, 95)
  const primaryCss = hslACss({ h, s: sBase, l: limitar(l, 30, 62) })
  const primaryForegroundCss = textoSobre(colorPrimario)
  const primarySoftCss = hslACss({ h, s: limitar(sBase * 0.55, 18, 70), l: 95 })
  const ringCss = hslACss({ h, s: limitar(sBase + 5, 30, 95), l: limitar(l, 35, 60) })

  return {
    '--primary': primaryCss,
    '--primary-foreground': primaryForegroundCss,

    // Hover más oscuro y activo aún más: el usuario tiene que notar los tres
    // estados sin leer nada.
    '--primary-hover': hslACss({ h, s: sBase, l: limitar(l - 8, 22, 55) }),
    '--primary-active': hslACss({ h, s: sBase, l: limitar(l - 15, 16, 48) }),

    // Fondos teñidos, para tarjetas y estados seleccionados.
    '--primary-soft': primarySoftCss,
    '--primary-muted': hslACss({ h, s: limitar(sBase * 0.4, 12, 55), l: 88 }),
    '--primary-border': hslACss({ h, s: limitar(sBase * 0.5, 15, 60), l: 80 }),

    // Un acento a 30 grados de distancia: lo bastante cerca para que parezca de
    // la misma familia y lo bastante lejos para distinguirse.
    '--accent': hslACss({ h: (h + 30) % 360, s: sBase, l: limitar(l + 6, 38, 68) }),

    // El anillo de foco. Va más saturado a propósito: es una señal de
    // accesibilidad y tiene que verse.
    '--ring': ringCss,

    // Variables de la barra lateral (Sidebar) y menú para que todo el panel se
    // actualice. Las tres primeras son colores de trazo o de relleno con texto
    // propio calculado, así que valen igual en claro y en oscuro.
    '--sidebar-primary': primaryCss,
    '--sidebar-primary-foreground': primaryForegroundCss,
    '--sidebar-ring': ringCss,

    // El fondo del ítem activo va translúcido y NO sólido. Con `primarySoft`
    // —95 % de luminosidad— el modo oscuro quedaba con la fila casi blanca y el
    // texto (#F8FAFC) encima, ilegible: el estilo en línea pisa la regla `.dark`
    // y no hay forma de que un valor sólido sirva para los dos modos.
    '--sidebar-accent': hslACssAlfa({ h, s: sBase, l: limitar(l, 35, 60) }, 0.16),

    // ── El tono de la marca, como dato ──────────────────────────────────────
    //
    // El fondo del body, el del menú, las tarjetas y los bordes no son grises:
    // son neutros teñidos (hoy de azul, `#EDF3F9` y compañía). Para que sigan a
    // la marca no se les puede escribir un color en línea, porque un valor
    // pensado para modo claro se quedaría puesto también de noche —el estilo en
    // línea gana a `.dark`—. Lo que se publica aquí es solo el tono y cuánto
    // teñir; la claridad de cada modo se queda en `globals.css`, que es donde
    // `.dark` puede hacer su trabajo.
    '--marca-h': h.toFixed(1),
    // Los neutros van muy por debajo de la saturación de la marca: al 50 % del
    // primario un fondo de pantalla completa marea, y por debajo de 18 el tinte
    // deja de percibirse y todo vuelve a parecer gris.
    '--marca-sn': `${limitar(sBase * 0.62, 18, 60).toFixed(1)}%`,
  }
}
