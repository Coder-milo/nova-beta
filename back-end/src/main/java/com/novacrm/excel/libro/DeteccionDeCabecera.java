package com.novacrm.excel.libro;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Predicate;

/**
 * Encuentra en que fila de una hoja estan los titulos de las columnas.
 *
 * <p>Los importadores daban por hecho que la cabecera era la primera fila. Las
 * hojas que de verdad usa el equipo casi nunca empiezan ahi: llevan un titulo
 * ("SEGUIMIENTO DE EMPLEABILIDAD"), a veces un subtitulo, a veces una banda de
 * grupos que abarca varias columnas ("DATOS DEL PARTICIPANTE", "CONDICIONES
 * LABORALES") y solo despues la fila de titulos reales. En el libro de
 * seguimiento del programa la cabecera esta en la fila 3, en la 4 o en la 6
 * segun la hoja.
 *
 * <p>No se busca "la primera fila con varias celdas" —una banda de grupos
 * tambien las tiene— sino la fila que <em>mas titulos reconocibles</em> aporta.
 * Las bandas no aportan ninguno, porque "DATOS DEL PARTICIPANTE" no es el
 * nombre de ningun campo.
 */
public final class DeteccionDeCabecera {

    /**
     * Hasta donde se busca. Da margen de sobra para titulo, subtitulo, banda de
     * grupos y filas en blanco sin llegar a confundir la cabecera con datos.
     */
    static final int FILAS_A_EXPLORAR = 15;

    /** Minimo de titulos reconocidos para creer que una fila es la cabecera. */
    static final int TITULOS_MINIMOS = 2;

    private static final DataFormatter FORMATO = new DataFormatter(new Locale("es", "CO"));

    /**
     * @param fila     indice de la fila de cabecera (base 0, el de POI)
     * @param titulos  indice de columna → titulo, solo las que traen algo
     * @param aciertos cuantos de esos titulos se reconocieron
     */
    public record Cabecera(int fila, LinkedHashMap<Integer, String> titulos, int aciertos) {

        /** Numero de fila tal como se ve en Excel. */
        public int filaEnExcel() {
            return fila + 1;
        }
    }

    private DeteccionDeCabecera() {
    }

    /**
     * @param reconocido dice si un titulo corresponde a algun campo conocido
     * @return la cabecera, o vacio si la hoja no tiene uno que valga la pena
     */
    public static Optional<Cabecera> buscar(Sheet hoja, Predicate<String> reconocido) {
        if (hoja == null) {
            return Optional.empty();
        }
        Cabecera mejor = null;
        int ultima = Math.min(hoja.getLastRowNum(), hoja.getFirstRowNum() + FILAS_A_EXPLORAR);

        for (int r = hoja.getFirstRowNum(); r <= ultima; r++) {
            var candidata = evaluar(hoja.getRow(r), r, reconocido);
            if (candidata.isEmpty()) {
                continue;
            }
            // Gana la que mas titulos reconoce. A igualdad, la que mas columnas
            // trae: entre una banda de grupos y la fila de titulos completa que
            // viene debajo, la segunda describe mejor la tabla.
            if (mejor == null
                    || candidata.get().aciertos() > mejor.aciertos()
                    || (candidata.get().aciertos() == mejor.aciertos()
                        && candidata.get().titulos().size() > mejor.titulos().size())) {
                mejor = candidata.get();
            }
        }
        return Optional.ofNullable(mejor);
    }

    private static Optional<Cabecera> evaluar(Row fila, int indice, Predicate<String> reconocido) {
        if (fila == null) {
            return Optional.empty();
        }
        var titulos = new LinkedHashMap<Integer, String>();
        int aciertos = 0;

        for (int c = fila.getFirstCellNum(); c >= 0 && c < fila.getLastCellNum(); c++) {
            String titulo = texto(fila.getCell(c));
            if (titulo == null || titulo.isBlank()) {
                // Una columna vacia en medio de la cabecera no corta la fila:
                // la hoja de empresas por sector tiene vacias la A y la C, y
                // cortar ahi dejaba fuera todas las columnas siguientes.
                continue;
            }
            titulos.put(c, titulo);
            if (reconocido.test(titulo)) {
                aciertos++;
            }
        }

        if (aciertos < TITULOS_MINIMOS) {
            return Optional.empty();
        }
        return Optional.of(new Cabecera(indice, titulos, aciertos));
    }

    /** Texto de una celda, con fechas y numeros ya formateados. */
    static String texto(Cell celda) {
        if (celda == null) {
            return null;
        }
        if (celda.getCellType() == org.apache.poi.ss.usermodel.CellType.NUMERIC
                && DateUtil.isCellDateFormatted(celda)) {
            return celda.getLocalDateTimeCellValue().toLocalDate().toString();
        }
        String valor = FORMATO.formatCellValue(celda);
        return valor == null ? null : valor.trim();
    }
}
