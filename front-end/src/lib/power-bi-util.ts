/**
 * Extrae la URL limpia tanto si el usuario pega un enlace directo como si pega
 * el fragmento HTML completo del <iframe> generado por Power BI.
 */
export function extraerUrlEmbedPowerBi(texto: string): string {
  if (!texto) return ''
  const trimmed = texto.trim()
  const matchIframe = trimmed.match(/src=["']([^"']+)["']/i)
  if (matchIframe && matchIframe[1]) {
    return matchIframe[1].trim()
  }
  return trimmed
}
