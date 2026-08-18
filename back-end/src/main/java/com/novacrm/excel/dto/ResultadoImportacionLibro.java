package com.novacrm.excel.dto;

import java.util.List;
import java.util.UUID;

/**
 * Lo que paso con cada hoja de un libro importado.
 *
 * <p>Se informa hoja por hoja, incluidas las que no se importaron y por que. Un
 * libro de seguimiento trae tableros de indicadores y hojas preparadas y
 * vacias; omitirlas en silencio dejaria a quien carga sin saber si su hoja de
 * postulaciones entro o simplemente no se reconocio.
 *
 * @param simulacion si fue una pasada en seco, sin escribir nada
 * @param hojas      resultado por hoja, en el orden del libro
 * @param planId     identificador del análisis que produjo esto. La simulacion
 *                   lo devuelve y la importacion real lo trae de vuelta, para
 *                   ejecutar el mapeo que se reviso y no uno recalculado
 */
public record ResultadoImportacionLibro(
        boolean simulacion,
        List<HojaProcesada> hojas,
        UUID planId) {

    public ResultadoImportacionLibro(boolean simulacion, List<HojaProcesada> hojas) {
        this(simulacion, hojas, null);
    }

    /**
     * @param nombre          nombre de la pestaña, tal cual
     * @param destino         a que se importo, o {@code null} si se omitio
     * @param motivo          por que se omitio; {@code null} si se importo
     * @param detalle         cifras y errores de la importacion; {@code null} si se omitio
     * @param columnasPorIa   cabeceras que reconocio la IA, no el diccionario
     * @param destinoPorIa    si el destino de la hoja lo decidio la IA
     */
    public record HojaProcesada(
            String nombre,
            String destino,
            String motivo,
            ResultadoImportacionCrm detalle,
            List<String> columnasPorIa,
            boolean destinoPorIa) {

        public HojaProcesada(String nombre, String destino, String motivo, ResultadoImportacionCrm detalle) {
            this(nombre, destino, motivo, detalle, List.of(), false);
        }

        public static HojaProcesada omitida(String nombre, String motivo) {
            return new HojaProcesada(nombre, null, motivo, null);
        }

        public boolean importada() {
            return detalle != null;
        }

        /** Si la IA participó en que esta hoja llegara a importarse. */
        public boolean conAyudaDeIa() {
            return destinoPorIa || !columnasPorIa.isEmpty();
        }
    }

    public int hojasImportadas() {
        return (int) hojas.stream().filter(HojaProcesada::importada).count();
    }

    public int filasCreadas() {
        return hojas.stream().filter(HojaProcesada::importada)
                .mapToInt(h -> h.detalle().creados()).sum();
    }

    public int filasActualizadas() {
        return hojas.stream().filter(HojaProcesada::importada)
                .mapToInt(h -> h.detalle().actualizados()).sum();
    }

    public int filasConError() {
        return hojas.stream().filter(HojaProcesada::importada)
                .mapToInt(h -> h.detalle().errores().size()).sum();
    }
}
