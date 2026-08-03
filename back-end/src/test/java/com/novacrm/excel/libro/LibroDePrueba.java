package com.novacrm.excel.libro;

import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;

/**
 * Construye libros de Excel en memoria para las pruebas.
 *
 * <p>Se generan aqui y no se versiona ningun archivo real: el libro de
 * seguimiento del programa trae nombres, edades y nacionalidades de mas de cien
 * personas, y meterlo en el repositorio seria publicar datos personales de la
 * cohorte. Lo que se reproduce son las <em>trampas estructurales</em> del
 * formato —titulo antes de la cabecera, bandas de grupo, columnas en blanco,
 * cabeceras repetidas, filas de leyenda y de seccion—, que es lo que hay que
 * probar.
 */
final class LibroDePrueba {

    private final Workbook libro = new XSSFWorkbook();

    private LibroDePrueba() {
    }

    static LibroDePrueba nuevo() {
        return new LibroDePrueba();
    }

    /**
     * @param filas contenido, fila a fila; {@code null} deja la fila en blanco
     */
    LibroDePrueba conHoja(String nombre, String[]... filas) {
        Sheet hoja = libro.createSheet(nombre);
        for (int r = 0; r < filas.length; r++) {
            if (filas[r] == null) {
                continue;
            }
            var fila = hoja.createRow(r);
            for (int c = 0; c < filas[r].length; c++) {
                if (filas[r][c] != null) {
                    fila.createCell(c).setCellValue(filas[r][c]);
                }
            }
        }
        return this;
    }

    Workbook build() {
        return libro;
    }

    Sheet hoja(String nombre) {
        return libro.getSheet(nombre);
    }

    MockMultipartFile comoArchivo() {
        try (var salida = new ByteArrayOutputStream()) {
            libro.write(salida);
            return new MockMultipartFile("archivo", "seguimiento.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    salida.toByteArray());
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Fila suelta, para que las pruebas se lean como la hoja que describen. */
    static String[] fila(String... celdas) {
        return celdas;
    }
}
