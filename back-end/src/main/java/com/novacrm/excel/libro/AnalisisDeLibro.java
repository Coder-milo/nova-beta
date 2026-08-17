package com.novacrm.excel.libro;

import java.util.LinkedHashMap;
import java.util.List;

/**
 * El resultado de analizar un libro, en forma guardable.
 *
 * <p>Analizar y escribir son dos peticiones distintas: primero se previsualiza
 * y después se confirma. Hasta ahora la segunda volvía a analizar el archivo
 * desde cero y podía llegar a otra conclusión, por tres motivos concretos:
 *
 * <ul>
 *   <li>{@code ReconocimientoConIa.sugerirDestino} <strong>no se memoriza</strong>:
 *       cada análisis vuelve a preguntar a qué destino va una hoja renombrada,
 *       y nada garantiza la misma respuesta.
 *   <li>Lo que sí se memoriza —el campo de cada columna— vive en el proceso y
 *       tiene tope. Un redespliegue entre las dos pantallas, o un libro ancho
 *       que llene el mapa, y se vuelve a preguntar.
 *   <li>El presupuesto de consultas por libro es finito y el proveedor falla:
 *       ya hay reintentos por los 429 del tier gratuito. Si en la segunda
 *       pasada se agota o corta antes, las columnas que quedan sin resolver
 *       caen al diccionario y desaparecen del mapeo <em>sin decirlo</em>.
 * </ul>
 *
 * <p>Esto es ese análisis, congelado: qué hoja va a qué destino, en qué fila
 * está su cabecera y qué campo recibe cada columna. Al confirmar se vuelve a
 * leer el archivo —los mismos bytes, comprobados por huella— pero aplicando
 * este plan en vez de deducirlo otra vez. No se consulta a la IA, así que la
 * importación real también sale más rápida y sin volver a pagar el análisis.
 *
 * <p>Se guardan los <em>índices</em> de columna y no los títulos porque es lo
 * que necesita la relectura, y porque dos columnas pueden llamarse igual.
 */
public record AnalisisDeLibro(List<Hoja> hojas) {

    /** El plan que quedó tras clasificar un libro, listo para guardarse. */
    public static AnalisisDeLibro de(List<LectorDeLibro.HojaClasificada> clasificadas) {
        return new AnalisisDeLibro(clasificadas.stream()
                .map(LectorDeLibro.HojaClasificada::analisis)
                .toList());
    }

    /**
     * @param destino       a qué se importa; {@code null} si la hoja se omite
     * @param motivo        por qué se omite; {@code null} si se importa
     * @param filaCabecera  índice de la fila de títulos (base 0, la de POI);
     *                      {@code -1} en las hojas omitidas
     * @param titulos       índice de columna → título tal como está escrito
     * @param campos        índice de columna → campo del sistema. Solo las
     *                      mapeadas: las que faltan son las que se ignoran
     * @param columnasPorIa títulos que reconoció la IA y no el diccionario
     * @param destinoPorIa  si el destino de la hoja lo decidió la IA
     */
    public record Hoja(
            String nombre,
            DestinoDeHoja destino,
            String motivo,
            int filaCabecera,
            LinkedHashMap<Integer, String> titulos,
            LinkedHashMap<Integer, String> campos,
            List<String> columnasPorIa,
            boolean destinoPorIa) {

        public static Hoja omitida(String nombre, String motivo) {
            return new Hoja(nombre, null, motivo, -1,
                    new LinkedHashMap<>(), new LinkedHashMap<>(), List.of(), false);
        }

        /**
         * Cabecera → campo, como lo espera {@link HojaLeida} y lo enseña la
         * pantalla. Las entradas con valor nulo son las columnas ignoradas:
         * verlas es lo que explica por qué un dato no llegó.
         */
        public LinkedHashMap<String, String> columnas() {
            var columnas = new LinkedHashMap<String, String>();
            titulos.forEach((indice, titulo) -> columnas.put(titulo, campos.get(indice)));
            return columnas;
        }
    }
}
