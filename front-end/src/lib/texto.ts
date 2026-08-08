/**
 * Texto comparable, con las mismas reglas que usa el servidor.
 *
 * Es el tercer gemelo de una misma regla: la función SQL `novacrm_normalizar`
 * (migración V38) y `ClaveNormalizada.de` en Java son los otros dos. Las tres
 * tienen que dar el mismo resultado, porque el listado de estudiantes lo filtra
 * el servidor y la papelera lo filtra el navegador: si divergieran, buscar
 * «Pérez» daría resultados distintos según la pestaña en la que estés.
 *
 * Vive aquí y no dentro de una página para poder probarla — `texto.test.ts`
 * fija los mismos casos que `ClaveNormalizadaTest` en el backend.
 */
export function normalizarParaBuscar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Clave de comparación para documentos de identidad.
 *
 * Los signos desaparecen del todo en vez de convertirse en espacio: el
 * documento llega de Excel como "1.234.567" y se busca "1234567". Espeja a
 * `novacrm_solo_alfanumerico` (V39) y a `ClaveNormalizada.deDocumento`.
 */
export function normalizarDocumento(documento: string): string {
  return documento.replace(/[^0-9A-Za-z]/g, '').toLowerCase()
}
