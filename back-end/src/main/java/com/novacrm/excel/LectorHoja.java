package com.novacrm.excel;

import com.novacrm.exception.BusinessException;
import org.apache.poi.ss.usermodel.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Lectura genérica de una hoja de cálculo en filas de {@code campo → valor}.
 *
 * <p>La importación de estudiantes lleva su propio lector, atado al formato de
 * los formularios del programa. Empresas y colocaciones llegan en hojas que
 * arma cada quien —a veces exportadas de un Drive, a veces escritas a mano— y
 * lo que necesitan es lo contrario: reconocer la cabecera venga como venga y
 * decir claramente qué columna se está usando para qué.
 *
 * <p>Acepta {@code .xlsx} y {@code .xls}: buena parte de los listados que
 * circulan por el equipo siguen guardándose en el formato antiguo, y rechazarlos
 * obligaba a abrir y reguardar cada archivo antes de poder subirlo.
 */
public final class LectorHoja {

    /** Tope de filas por archivo. Protege la memoria del servidor. */
    public static final int MAX_FILAS = 5000;

    private static final DataFormatter FORMATO = new DataFormatter(new Locale("es", "CO"));

    private static final List<DateTimeFormatter> FECHAS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("d-M-yyyy"),
            DateTimeFormatter.ofPattern("yyyy/M/d"));

    private LectorHoja() {}

    /**
     * @param campos    valor por campo del sistema; solo trae los reconocidos
     * @param numeroFila número de fila tal como se ve en Excel (base 1)
     */
    public record Fila(int numeroFila, Map<String, String> campos) {
        public String texto(String campo) {
            String valor = campos.get(campo);
            return valor == null || valor.isBlank() ? null : valor.trim();
        }

        public boolean vacia() {
            return campos.values().stream().allMatch(v -> v == null || v.isBlank());
        }
    }

    /**
     * @param columnas cabecera → campo del sistema (nulo si no se reconoció)
     */
    public record Hoja(List<Fila> filas, LinkedHashMap<String, String> columnas) {}

    public static void validarArchivo(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new BusinessException("Adjunta un archivo de Excel (.xlsx o .xls)");
        }
        String nombre = archivo.getOriginalFilename() == null
                ? "" : archivo.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (!nombre.endsWith(".xlsx") && !nombre.endsWith(".xls")) {
            throw new BusinessException("Solo se admiten archivos .xlsx o .xls");
        }
    }

    /**
     * Lee la primera hoja del libro.
     *
     * @param alias    cabecera normalizada → campo, para los nombres propios de
     *                 este formato; tiene prioridad sobre {@code mapper}
     * @param mapper   diccionario general de sinónimos, como respaldo
     * @param permitidos campos que este importador sabe usar; cualquier otro se
     *                 ignora para no arrastrar columnas de otro módulo
     */
    public static Hoja leer(MultipartFile archivo,
                            Map<String, String> alias,
                            ColumnMapper mapper,
                            Set<String> permitidos) {
        validarArchivo(archivo);
        try (var entrada = archivo.getInputStream();
             Workbook libro = WorkbookFactory.create(entrada)) {

            Sheet hoja = libro.getSheetAt(0);
            if (hoja == null) throw new BusinessException("El archivo no tiene ninguna hoja");

            Row cabecera = hoja.getRow(hoja.getFirstRowNum());
            if (cabecera == null) throw new BusinessException("La primera fila debe tener los nombres de las columnas");

            var columnas = new LinkedHashMap<String, String>();
            var porIndice = new HashMap<Integer, String>();
            for (int c = cabecera.getFirstCellNum(); c < cabecera.getLastCellNum(); c++) {
                String titulo = celda(cabecera.getCell(c));
                if (titulo == null || titulo.isBlank()) continue;
                String campo = alias.get(normalizar(titulo));
                if (campo == null && mapper != null) campo = mapper.map(titulo);
                if (campo != null && !permitidos.contains(campo)) campo = null;
                // Dos columnas que apuntan al mismo campo: gana la primera. La
                // segunda suele ser un duplicado con la misma información a
                // medio rellenar, y sobrescribir con celdas vacías borraría lo
                // que sí traía la buena.
                if (campo != null && porIndice.containsValue(campo)) campo = null;
                columnas.put(titulo, campo);
                if (campo != null) porIndice.put(c, campo);
            }

            if (porIndice.isEmpty()) {
                throw new BusinessException(
                        "No se reconoció ninguna columna. Revisa que la primera fila tenga los títulos.");
            }

            var filas = new ArrayList<Fila>();
            for (int r = hoja.getFirstRowNum() + 1; r <= hoja.getLastRowNum(); r++) {
                if (filas.size() >= MAX_FILAS) {
                    throw new BusinessException("El archivo supera el máximo de " + MAX_FILAS + " filas");
                }
                Row fila = hoja.getRow(r);
                if (fila == null) continue;
                var valores = new LinkedHashMap<String, String>();
                for (var entrada2 : porIndice.entrySet()) {
                    valores.put(entrada2.getValue(), celda(fila.getCell(entrada2.getKey())));
                }
                var leida = new Fila(r + 1, valores);
                if (!leida.vacia()) filas.add(leida);
            }

            return new Hoja(filas, columnas);
        } catch (BusinessException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            throw new BusinessException("No se pudo leer el archivo: " + e.getMessage());
        }
    }

    /** Texto de una celda, con las fechas y los números ya formateados. */
    private static String celda(Cell celda) {
        if (celda == null) return null;
        if (celda.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(celda)) {
            return celda.getLocalDateTimeCellValue().toLocalDate().toString();
        }
        String valor = FORMATO.formatCellValue(celda);
        return valor == null ? null : valor.trim();
    }

    static String normalizar(String texto) {
        if (texto == null) return "";
        String s = java.text.Normalizer.normalize(texto.trim(), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .replaceAll("[^a-zA-Z0-9]", " ")
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
        return s;
    }

    /** Fecha en cualquiera de los formatos que salen de Excel. */
    public static LocalDate fecha(String valor) {
        if (valor == null || valor.isBlank()) return null;
        String limpio = valor.trim();
        for (var formato : FECHAS) {
            try {
                return LocalDate.parse(limpio, formato);
            } catch (Exception ignorado) {
                // Se prueba el siguiente formato.
            }
        }
        return null;
    }

    /**
     * Importe monetario.
     *
     * <p>Los salarios llegan como "$ 1.423.500", "1.423.500,00" o "1423500".
     * Se quita todo lo que no sea dígito y se usa la coma final, si la hay,
     * como separador decimal: en Colombia el punto agrupa los miles y tomarlo
     * por decimal convertiría 1.423.500 en algo más de mil pesos.
     */
    public static BigDecimal dinero(String valor) {
        if (valor == null || valor.isBlank()) return null;
        String limpio = valor.replaceAll("[^0-9,.-]", "").trim();
        if (limpio.isEmpty()) return null;
        int coma = limpio.lastIndexOf(',');
        if (coma >= 0) {
            limpio = limpio.substring(0, coma).replace(".", "").replace(",", "")
                    + "." + limpio.substring(coma + 1).replaceAll("[^0-9]", "");
        } else {
            limpio = limpio.replace(".", "");
        }
        try {
            return new BigDecimal(limpio);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Sí/No en cualquiera de sus formas habituales. */
    public static Boolean booleano(String valor) {
        if (valor == null || valor.isBlank()) return null;
        String v = normalizar(valor);
        if (v.startsWith("si") || v.equals("s") || v.equals("true") || v.equals("1") || v.startsWith("x")) return true;
        if (v.startsWith("no") || v.equals("n") || v.equals("false") || v.equals("0")) return false;
        return null;
    }

    /**
     * Busca el valor de un enum por su nombre o por su etiqueta.
     *
     * <p>Las hojas traen "Feria de empleo", no {@code FERIA}. Pedirle al equipo
     * que escriba las constantes internas es cambiar el trabajo de sitio.
     */
    public static <E extends Enum<E>> E enumDe(Class<E> tipo, String valor, java.util.function.Function<E, String> etiqueta) {
        if (valor == null || valor.isBlank()) return null;
        String buscado = normalizar(valor);
        for (E constante : tipo.getEnumConstants()) {
            if (normalizar(constante.name()).equals(buscado)) return constante;
            if (etiqueta != null && normalizar(etiqueta.apply(constante)).equals(buscado)) return constante;
        }
        return null;
    }
}
