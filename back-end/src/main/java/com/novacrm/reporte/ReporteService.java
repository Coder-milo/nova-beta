package com.novacrm.reporte;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.exception.BusinessException;
import com.novacrm.programa.Programa;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
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

    private final EntityManager entityManager;

    public ReporteService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public byte[] exportar(String tipo, String formato, UUID programaId) {
        DatosReporte datos = construirDatos(tipo, programaId);
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
            case "empleabilidad" -> datosAgrupados("Reporte de empleabilidad", "estadoEmpleabilidad", programaId);
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

    private byte[] exportarXlsx(DatosReporte datos) {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Reporte");

            Font boldFont = workbook.createFont();
            boldFont.setBold(true);
            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFont(boldFont);

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < datos.columnas().length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(datos.columnas()[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowNum = 1;
            for (String[] fila : datos.filas()) {
                Row row = sheet.createRow(rowNum++);
                for (int i = 0; i < fila.length; i++) {
                    row.createCell(i).setCellValue(fila[i]);
                }
            }

            for (int i = 0; i < datos.columnas().length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new BusinessException("Error generando archivo Excel: " + e.getMessage());
        }
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

    private String construirHtml(DatosReporte datos) {
        StringBuilder html = new StringBuilder();
        html.append("<html><head><style>")
            .append("body { font-family: sans-serif; font-size: 10px; }")
            .append("h1 { font-size: 16px; }")
            .append("table { width: 100%; border-collapse: collapse; }")
            .append("th, td { border: 1px solid #999; padding: 4px; text-align: left; }")
            .append("th { background-color: #eeeeee; }")
            .append("</style></head><body>");
        html.append("<h1>").append(escapeHtml(datos.titulo())).append("</h1>");
        html.append("<table><thead><tr>");
        for (String columna : datos.columnas()) {
            html.append("<th>").append(escapeHtml(columna)).append("</th>");
        }
        html.append("</tr></thead><tbody>");
        for (String[] fila : datos.filas()) {
            html.append("<tr>");
            for (String celda : fila) {
                html.append("<td>").append(escapeHtml(celda)).append("</td>");
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
