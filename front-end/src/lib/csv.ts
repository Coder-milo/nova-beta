/**
 * Generación de CSV pensada para que el archivo se abra bien en Excel.
 *
 * <p>El export anterior unía los valores con comas y los envolvía en comillas a
 * mano. En un equipo con la configuración regional de Colombia eso produce dos
 * problemas cada vez: Excel usa `;` como separador de listas, así que las filas
 * caían enteras en la columna A; y sin marca de orden de bytes el archivo se lee
 * como ANSI y «Medellín» sale como «MedellÃ­n».
 */

/** Separador de listas de la configuración regional en la que se abre el archivo. */
const SEPARADOR = ';'

/**
 * Marca de orden de bytes UTF-8. Es lo que le dice a Excel en qué codificación
 * está el archivo; sin ella supone la del sistema y rompe los acentos.
 */
const BOM = '﻿'

/**
 * Escapa un valor.
 *
 * <p>Lo que empieza por `= + - @` se prefija con un apóstrofo: Excel trata esas
 * celdas como fórmulas, de modo que un nombre exportado que empiece por «=» se
 * evaluaría al abrir el archivo en vez de leerse.
 */
function celda(valor: unknown): string {
  if (valor == null) return ''
  let texto = String(valor)
  if (texto.length > 0 && '=+-@'.includes(texto[0])) texto = `'${texto}`
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/** Arma el contenido del CSV a partir de la cabecera y las filas. */
export function construirCsv(columnas: readonly string[], filas: readonly unknown[][]): string {
  const lineas = [columnas.map(celda).join(SEPARADOR)]
  for (const fila of filas) lineas.push(fila.map(celda).join(SEPARADOR))
  // Fin de línea de Windows: es donde se abren estos archivos, y con `\n` a
  // secas algunas versiones de Excel dejan la última columna pegada a la
  // siguiente fila.
  return BOM + lineas.join('\r\n') + '\r\n'
}

/** Construye el CSV y dispara la descarga. */
export function descargarCsv(
  nombreArchivo: string,
  columnas: readonly string[],
  filas: readonly unknown[][],
): void {
  const blob = new Blob([construirCsv(columnas, filas)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
