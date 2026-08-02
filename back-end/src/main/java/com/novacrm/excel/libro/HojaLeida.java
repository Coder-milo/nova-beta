package com.novacrm.excel.libro;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Una hoja ya leida a filas de {@code campo → valor}.
 *
 * <p>Se lee una sola vez y se pasa a quien la vaya a importar. Antes cada
 * importador abria el archivo por su cuenta, asi que un libro con siete hojas
 * habia que subirlo tres veces y se parseaba entero tres veces.
 */
public record HojaLeida(
        String nombre,
        int filaCabecera,
        LinkedHashMap<String, String> columnas,
        List<Fila> filas) {

    /**
     * @param numeroFila numero tal como se ve en Excel (base 1)
     * @param campos     valor por campo del sistema
     */
    public record Fila(int numeroFila, Map<String, String> campos) {

        public String texto(String campo) {
            String valor = campos.get(campo);
            return valor == null || valor.isBlank() ? null : valor.trim();
        }

        /** Cuantos campos del sistema trae con algo dentro. */
        public int camposConValor() {
            return (int) campos.values().stream().filter(v -> v != null && !v.isBlank()).count();
        }

        public boolean vacia() {
            return camposConValor() == 0;
        }
    }

    /** Si alguna columna de la hoja quedo mapeada a este campo. */
    public boolean tiene(String campo) {
        return columnas.containsValue(campo);
    }

    /**
     * Lee las filas de datos que hay debajo de una cabecera.
     *
     * @param porIndice indice de columna → campo del sistema
     * @param maxFilas  tope de filas, para no comerse la memoria del servidor
     */
    static List<Fila> filasDebajoDe(Sheet hoja, int filaCabecera,
                                    Map<Integer, String> porIndice, int maxFilas) {
        var filas = new ArrayList<Fila>();
        boolean empezaronLosDatos = false;

        for (int r = filaCabecera + 1; r <= hoja.getLastRowNum() && filas.size() < maxFilas; r++) {
            Row fila = hoja.getRow(r);
            if (fila == null) {
                continue;
            }
            var valores = new LinkedHashMap<String, String>();
            for (var columna : porIndice.entrySet()) {
                valores.put(columna.getValue(), DeteccionDeCabecera.texto(fila.getCell(columna.getKey())));
            }
            var leida = new Fila(r + 1, valores);
            if (leida.vacia()) {
                continue;
            }

            // Entre la cabecera y los datos suele haber una leyenda que ocupa
            // una sola celda ("Estados posibles: Enviado / En proceso / ..."),
            // y leerla como registro produce una fila de error que no le dice
            // nada a nadie. Se salta mientras los datos no hayan empezado: en
            // cuanto aparece la primera fila con varios campos se deja de
            // filtrar, para no descartar un registro escaso de mas abajo.
            if (!empezaronLosDatos) {
                if (leida.camposConValor() < 2 && porIndice.size() > 1) {
                    continue;
                }
                empezaronLosDatos = true;
            }
            filas.add(leida);
        }
        return filas;
    }
}
