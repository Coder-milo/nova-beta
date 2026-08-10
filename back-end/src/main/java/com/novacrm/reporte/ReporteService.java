package com.novacrm.reporte;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.exception.BusinessException;
import com.novacrm.programa.Programa;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ReporteService {

    private static final DateTimeFormatter FECHA_FORMATTER =
        DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneOffset.UTC);

    /** Sello de generacion de los reportes, en la hora de Colombia. */
    private static final DateTimeFormatter FECHA_HORA_FORMATTER =
        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(java.time.ZoneId.of("America/Bogota"));

    /** Azul y gris de la identidad CAC, los mismos de la hoja de vida. */
    private static final java.awt.Color AZUL_CAC = new java.awt.Color(0x1F, 0x4E, 0x79);
    private static final java.awt.Color GRIS_SUAVE = new java.awt.Color(0xF4, 0xF6, 0xF9);

    private final EntityManager entityManager;

    public ReporteService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public byte[] exportar(String tipo, String formato, UUID programaId) {
        DatosReporte datos = construirDatos(tipo, programaId);
        if ("csv".equalsIgnoreCase(formato)) {
            return exportarCsv(datos);
        }
        if ("xlsx".equalsIgnoreCase(formato)) {
            return exportarXlsx(datos);
        }
        if ("pdf".equalsIgnoreCase(formato)) {
            return exportarPdf(datos);
        }
        throw new BusinessException("Formato de exportacion no soportado: " + formato);
    }

    private DatosReporte construirDatos(String tipo, UUID programaId) {
        return switch (tipo) {
            case "estudiantes" -> datosEstudiantes(programaId);
            case "empleabilidad" -> datosEmpleabilidad(programaId);
            case "academico" -> datosAgrupados("Reporte academico", "estadoAcademico", programaId);
            case "proyectos" -> datosProyectos(programaId);
            default -> throw new BusinessException("Tipo de reporte no valido: " + tipo);
        };
    }

    private DatosReporte datosEstudiantes(UUID programaId) {
        StringBuilder jpql = new StringBuilder(
            "SELECT e FROM Estudiante e JOIN FETCH e.programa WHERE e.activo = true");
        if (programaId != null) {
            jpql.append(" AND e.programa.id = :programaId");
        }
        TypedQuery<Estudiante> query = entityManager.createQuery(jpql.toString(), Estudiante.class);
        if (programaId != null) {
            query.setParameter("programaId", programaId);
        }

        List<String[]> filas = new ArrayList<>();
        for (Estudiante e : query.getResultList()) {
            filas.add(new String[] {
                valor(e.getNumeroDocumento()),
                valor(e.getNombre()),
                valor(e.getApellido()),
                valor(e.getEmail()),
                valor(e.getCelular()),
                valor(e.getCiudad()),
                e.getPrograma() != null ? valor(e.getPrograma().getNombre()) : "",
                e.getEstadoAcademico() != null ? e.getEstadoAcademico().name() : "",
                e.getEstadoEmpleabilidad() != null ? e.getEstadoEmpleabilidad().name() : "",
                e.getCreatedAt() != null ? FECHA_FORMATTER.format(e.getCreatedAt()) : ""
            });
        }

        return new DatosReporte(
            "Reporte de estudiantes",
            new String[] {"Documento", "Nombre", "Apellido", "Email", "Celular", "Ciudad",
                "Programa", "Estado académico", "Estado empleabilidad", "Fecha registro"},
            filas);
    }

    /**
     * Cuantos estan trabajando, cuantos buscan y de cuantos no se sabe.
     *
     * <p>No se agrupa por el enum {@code estadoEmpleabilidad} como el reporte
     * academico agrupa por el suyo, aunque se pareciesen. Ese enum viene de la
     * hoja antigua y solo lo escriben la importacion y la edicion manual: a
     * quien se coloca por el CRM nadie se lo cambia. Agrupando por el, este
     * reporte —que se exporta a PDF y se manda fuera— dejaba fuera justamente
     * las colocaciones que consiguio el programa.
     *
     * <p>Manda la colocacion vigente, que es el registro real —empresa, fecha,
     * salario—; el enum solo cuenta para las fichas antiguas que nunca tuvieron
     * colocacion registrada. Misma regla que el panel y que el pipeline.
     */
    private DatosReporte datosEmpleabilidad(UUID programaId) {
        String activos = "SELECT COUNT(e) FROM Estudiante e WHERE e.activo = true"
                + (programaId != null ? " AND e.programa.id = :programaId" : "");
        String tieneColocacion =
                " EXISTS (SELECT 1 FROM Colocacion c WHERE c.estudiante.id = e.id AND c.activa = true)";

        long empleados = contar(activos
                + " AND (e.estadoEmpleabilidad = com.novacrm.estudiante.EstadoEmpleabilidad.EMPLEADO"
                + " OR" + tieneColocacion + ")", programaId);
        long buscando = contar(activos
                + " AND e.estadoEmpleabilidad = com.novacrm.estudiante.EstadoEmpleabilidad.BUSCANDO"
                + " AND NOT" + tieneColocacion, programaId);
        // El nulo cuenta como sin informacion, que es lo que es. El reporte
        // anterior lo hacia al pintar; aqui se hace al contar, o esas fichas
        // desaparecerian del total.
        long sinInfo = contar(activos
                + " AND (e.estadoEmpleabilidad = com.novacrm.estudiante.EstadoEmpleabilidad.SIN_INFO"
                + " OR e.estadoEmpleabilidad IS NULL)"
                + " AND NOT" + tieneColocacion, programaId);

        return new DatosReporte("Reporte de empleabilidad",
                new String[] {"Estado", "Cantidad"},
                List.of(
                        new String[] {"EMPLEADO", String.valueOf(empleados)},
                        new String[] {"BUSCANDO", String.valueOf(buscando)},
                        new String[] {"SIN_INFO", String.valueOf(sinInfo)}));
    }

    private long contar(String jpql, UUID programaId) {
        TypedQuery<Long> query = entityManager.createQuery(jpql, Long.class);
        if (programaId != null) {
            query.setParameter("programaId", programaId);
        }
        return query.getSingleResult();
    }

    private DatosReporte datosAgrupados(String titulo, String campo, UUID programaId) {
        StringBuilder jpql = new StringBuilder(
            "SELECT e." + campo + ", COUNT(e) FROM Estudiante e WHERE e.activo = true");
        if (programaId != null) {
            jpql.append(" AND e.programa.id = :programaId");
        }
        jpql.append(" GROUP BY e.").append(campo);

        TypedQuery<Object[]> query = entityManager.createQuery(jpql.toString(), Object[].class);
        if (programaId != null) {
            query.setParameter("programaId", programaId);
        }

        List<String[]> filas = new ArrayList<>();
        for (Object[] fila : query.getResultList()) {
            filas.add(new String[] {
                fila[0] != null ? fila[0].toString() : "SIN_INFO",
                String.valueOf(fila[1])
            });
        }

        return new DatosReporte(titulo, new String[] {"Estado", "Cantidad"}, filas);
    }

    private DatosReporte datosProyectos(UUID programaId) {
        StringBuilder jpql = new StringBuilder("SELECT p FROM Programa p");
        if (programaId != null) {
            jpql.append(" WHERE p.id = :programaId");
        }
        TypedQuery<Programa> query = entityManager.createQuery(jpql.toString(), Programa.class);
        if (programaId != null) {
            query.setParameter("programaId", programaId);
        }
        List<Programa> programas = query.getResultList();

        Map<UUID, Long> conteos = new HashMap<>();
        List<Object[]> agrupado = entityManager.createQuery(
                "SELECT e.programa.id, COUNT(e) FROM Estudiante e WHERE e.activo = true GROUP BY e.programa.id",
                Object[].class)
            .getResultList();
        for (Object[] fila : agrupado) {
            conteos.put((UUID) fila[0], (Long) fila[1]);
        }

        List<String[]> filas = new ArrayList<>();
        for (Programa p : programas) {
            filas.add(new String[] {
                valor(p.getNombre()),
                valor(p.getCliente()),
                p.getEstado() != null ? p.getEstado().name() : "",
                valor(p.getResponsable()),
                p.getFechaInicio() != null ? p.getFechaInicio().toString() : "",
                p.getFechaFin() != null ? p.getFechaFin().toString() : "",
                String.valueOf(conteos.getOrDefault(p.getId(), 0L))
            });
        }

        return new DatosReporte(
            "Reporte de proyectos",
            new String[] {"Nombre", "Cliente", "Estado", "Responsable", "Fecha inicio", "Fecha fin", "Estudiantes activos"},
            filas);
    }

    private byte[] exportarCsv(DatosReporte datos) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             java.io.OutputStreamWriter writer = new java.io.OutputStreamWriter(out, java.nio.charset.StandardCharsets.UTF_8)) {

            // Escribir BOM UTF-8 para apertura correcta en Excel para Windows
            writer.write("\uFEFF");

            // Cabecera separada por punto y coma (;)
            for (int i = 0; i < datos.columnas().length; i++) {
                writer.write(sanitizarCsv(datos.columnas()[i]));
                if (i < datos.columnas().length - 1) writer.write(";");
            }
            writer.write("\r\n");

            // Filas de datos
            for (String[] fila : datos.filas()) {
                for (int i = 0; i < fila.length; i++) {
                    writer.write(sanitizarCsv(fila[i]));
                    if (i < fila.length - 1) writer.write(";");
                }
                writer.write("\r\n");
            }

            writer.flush();
            return out.toByteArray();
        } catch (IOException e) {
            throw new BusinessException("Error generando archivo CSV: " + e.getMessage());
        }
    }

    private String sanitizarCsv(String val) {
        if (val == null) return "";
        String s = val.trim();
        // Evitar inyección de fórmulas en Excel
        if (s.startsWith("=") || s.startsWith("+") || s.startsWith("-") || s.startsWith("@")) {
            s = "'" + s;
        }
        if (s.contains(";") || s.contains("\"") || s.contains("\n")) {
            s = "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    /**
     * Libro de Excel listo para trabajar sobre el.
     *
     * <p>Lleva encima de que reporte es y cuando se saco, porque el archivo se
     * reenvia por correo y se consulta semanas despues, cuando ya nadie
     * recuerda con que filtros se genero. Y lleva autofiltro y la cabecera
     * congelada: sin eso, a la fila treinta ya no se sabe que columna se esta
     * mirando.
     */
    private byte[] exportarXlsx(DatosReporte datos) {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Reporte");
            sheet.setDisplayGridlines(false);
            int columnas = datos.columnas().length;

            Font fuenteTitulo = workbook.createFont();
            fuenteTitulo.setBold(true);
            fuenteTitulo.setFontHeightInPoints((short) 14);
            fuenteTitulo.setColor(IndexedColors.WHITE.getIndex());
            CellStyle estiloTitulo = workbook.createCellStyle();
            estiloTitulo.setFont(fuenteTitulo);
            estiloTitulo.setFillForegroundColor(new XSSFColor(AZUL_CAC, null));
            estiloTitulo.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            estiloTitulo.setVerticalAlignment(VerticalAlignment.CENTER);

            Font fuenteMeta = workbook.createFont();
            fuenteMeta.setItalic(true);
            fuenteMeta.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            CellStyle estiloMeta = workbook.createCellStyle();
            estiloMeta.setFont(fuenteMeta);

            Font fuenteCabecera = workbook.createFont();
            fuenteCabecera.setBold(true);
            fuenteCabecera.setColor(IndexedColors.WHITE.getIndex());
            CellStyle estiloCabecera = workbook.createCellStyle();
            estiloCabecera.setFont(fuenteCabecera);
            estiloCabecera.setFillForegroundColor(new XSSFColor(AZUL_CAC, null));
            estiloCabecera.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            estiloCabecera.setAlignment(HorizontalAlignment.CENTER);
            estiloCabecera.setWrapText(true);
            bordes(estiloCabecera);

            CellStyle estiloFila = workbook.createCellStyle();
            bordes(estiloFila);
            CellStyle estiloFilaAlterna = workbook.createCellStyle();
            bordes(estiloFilaAlterna);
            estiloFilaAlterna.setFillForegroundColor(new XSSFColor(GRIS_SUAVE, null));
            estiloFilaAlterna.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            Row filaTitulo = sheet.createRow(0);
            filaTitulo.setHeightInPoints(26);
            for (int i = 0; i < Math.max(columnas, 1); i++) {
                filaTitulo.createCell(i).setCellStyle(estiloTitulo);
            }
            filaTitulo.getCell(0).setCellValue(datos.titulo());

            Row filaMeta = sheet.createRow(1);
            Cell celdaMeta = filaMeta.createCell(0);
            celdaMeta.setCellValue("Generado el " + FECHA_HORA_FORMATTER.format(java.time.Instant.now())
                + " · " + datos.filas().size() + " registro(s)");
            celdaMeta.setCellStyle(estiloMeta);

            if (columnas > 1) {
                sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, columnas - 1));
                sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, columnas - 1));
            }

            final int filaCabecera = 3;
            Row headerRow = sheet.createRow(filaCabecera);
            headerRow.setHeightInPoints(22);
            for (int i = 0; i < columnas; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(datos.columnas()[i]);
                cell.setCellStyle(estiloCabecera);
            }

            int rowNum = filaCabecera + 1;
            for (String[] fila : datos.filas()) {
                Row row = sheet.createRow(rowNum);
                CellStyle estilo = (rowNum - filaCabecera) % 2 == 0 ? estiloFilaAlterna : estiloFila;
                for (int i = 0; i < columnas; i++) {
                    Cell cell = row.createCell(i);
                    cell.setCellValue(i < fila.length && fila[i] != null ? fila[i] : "");
                    cell.setCellStyle(estilo);
                }
                rowNum++;
            }

            for (int i = 0; i < columnas; i++) {
                sheet.autoSizeColumn(i);
                // `autoSizeColumn` mide solo el contenido: con una cabecera
                // larga y celdas cortas la columna sale estrecha y el titulo se
                // corta. Y sin tope, una observacion de 300 caracteres se lleva
                // toda la pantalla.
                sheet.setColumnWidth(i, Math.min(Math.max(sheet.getColumnWidth(i) + 768, 2800), 12000));
            }

            if (!datos.filas().isEmpty()) {
                sheet.setAutoFilter(new CellRangeAddress(filaCabecera, rowNum - 1, 0, columnas - 1));
            }
            sheet.createFreezePane(0, filaCabecera + 1);

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new BusinessException("Error generando archivo Excel: " + e.getMessage());
        }
    }

    private static void bordes(CellStyle estilo) {
        estilo.setBorderTop(BorderStyle.THIN);
        estilo.setBorderBottom(BorderStyle.THIN);
        estilo.setBorderLeft(BorderStyle.THIN);
        estilo.setBorderRight(BorderStyle.THIN);
        estilo.setTopBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        estilo.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        estilo.setLeftBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        estilo.setRightBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        estilo.setVerticalAlignment(VerticalAlignment.CENTER);
    }

    private byte[] exportarPdf(DatosReporte datos) {
        String html = construirHtml(datos);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (IOException e) {
            throw new BusinessException("Error generando archivo PDF: " + e.getMessage());
        }
    }

    /**
     * Plantilla del PDF.
     *
     * <p>Estos informes se imprimen y se llevan a comite, asi que la cabecera se
     * repite en cada hoja ({@code thead} + {@code table-header-group}), las
     * paginas van numeradas y no se parte una fila por la mitad. Horizontal
     * porque el reporte de estudiantes tiene diez columnas y en vertical
     * quedaban ilegibles.
     */
    private String construirHtml(DatosReporte datos) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><style>")
            .append("@page { size: A4 landscape; margin: 12mm 10mm 14mm 10mm; ")
            .append("@bottom-right { content: 'Pagina ' counter(page) ' de ' counter(pages); ")
            .append("font-family: Helvetica, Arial, sans-serif; font-size: 8px; color: #767676; } }")
            .append("body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9px; color: #1E293B; margin: 0; }")
            .append("h1 { font-size: 15px; color: #1F4E79; margin: 0 0 3px 0; font-weight: bold; }")
            .append(".barra { height: 4px; background: #E1251B; width: 90px; margin: 0 0 8px 0; }")
            .append(".meta { font-size: 8px; color: #767676; margin: 0 0 10px 0; }")
            .append("table { width: 100%; border-collapse: collapse; margin-top: 8px; }")
            .append("thead { display: table-header-group; }")
            .append("tr { page-break-inside: avoid; }")
            .append("th { background-color: #1F4E79; color: #FFFFFF; font-weight: bold; text-align: left; padding: 6px 5px; border: 1px solid #1F4E79; }")
            .append("td { border: 1px solid #CBD5E1; padding: 5px; text-align: left; }")
            .append("tbody tr:nth-child(even) td { background-color: #F4F6F9; }")
            .append(".vacio { padding: 18px; text-align: center; color: #767676; font-style: italic; }")
            .append("</style></head><body>");
        html.append("<h1>").append(escapeHtml(datos.titulo())).append("</h1>");
        html.append("<div class=\"barra\"></div>");
        html.append("<p class=\"meta\">Generado el ")
            .append(escapeHtml(FECHA_HORA_FORMATTER.format(java.time.Instant.now())))
            .append(" &#183; ").append(datos.filas().size()).append(" registro(s)</p>");

        if (datos.filas().isEmpty()) {
            // Una tabla con la cabecera y nada debajo se lee como un fallo del
            // sistema. Decirlo con palabras evita la consulta de "no me exporta".
            html.append("<p class=\"vacio\">No hay datos para los filtros seleccionados.</p>")
                .append("</body></html>");
            return html.toString();
        }

        html.append("<table><thead><tr>");
        for (String columna : datos.columnas()) {
            html.append("<th>").append(escapeHtml(columna)).append("</th>");
        }
        html.append("</tr></thead><tbody>");
        for (String[] fila : datos.filas()) {
            html.append("<tr>");
            for (int i = 0; i < datos.columnas().length; i++) {
                html.append("<td>").append(escapeHtml(i < fila.length ? fila[i] : "")).append("</td>");
            }
            html.append("</tr>");
        }
        html.append("</tbody></table></body></html>");
        return html.toString();
    }

    private String escapeHtml(String val) {
        if (val == null) return "";
        return val.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String valor(String val) {
        return val != null ? val : "";
    }

    private record DatosReporte(String titulo, String[] columnas, List<String[]> filas) {}
}
