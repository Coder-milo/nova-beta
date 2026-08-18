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
        return exportar(tipo, formato, programaId, null);
    }

    /**
     * @param vacanteId acota el banco de perfiles a quienes se postularon a esa
     *                  vacante. Es el caso real: una empresa pregunta por los
     *                  candidatos de <em>su</em> oferta, no por la cohorte
     */
    public byte[] exportar(String tipo, String formato, UUID programaId, UUID vacanteId) {
        // El panorama no es una tabla: son indicadores y graficos, y en PDF se
        // dibuja distinto. En xlsx y csv se entregan las mismas cifras en tabla,
        // porque quien pide el csv de un grafico quiere los numeros.
        if ("panorama".equals(tipo) && "pdf".equalsIgnoreCase(formato)) {
            return exportarPanoramaPdf(datosPanorama(programaId));
        }

        DatosReporte datos = construirDatos(tipo, programaId, vacanteId);
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

    private DatosReporte construirDatos(String tipo, UUID programaId, UUID vacanteId) {
        return switch (tipo) {
            case "estudiantes" -> datosEstudiantes(programaId);
            case "empleabilidad" -> datosEmpleabilidad(programaId);
            case "academico" -> datosAgrupados("Reporte academico", "estadoAcademico", programaId);
            case "proyectos" -> datosProyectos(programaId);
            case "perfiles-laborales" -> datosPerfilesLaborales(programaId, vacanteId);
            case "panorama" -> datosPanoramaEnTabla(programaId);
            default -> throw new BusinessException("Tipo de reporte no valido: " + tipo);
        };
    }

    // ── Informe a medida ────────────────────────────────────────────────────

    /**
     * Un informe con las columnas que pida quien lo saca.
     *
     * <p>Las columnas salen de un catálogo cerrado ({@link ColumnaDeInforme}):
     * lo que no esté en él no se puede pedir. Un constructor que aceptara
     * nombres de campo sería un generador de consultas contra la base expuesto
     * por HTTP.
     *
     * <p>Los filtros son los mismos tres que ya usa la pantalla —programa,
     * ciudad y estado académico—, por la misma razón: cada filtro nuevo es una
     * cláusula que hay que escribir y revisar aquí.
     *
     * @param columnas en el orden en que se quieren; vacío o nulo es un error,
     *                 porque un informe sin columnas es un archivo vacío que
     *                 parece un fallo del sistema
     */
    public byte[] exportarPersonalizado(List<String> columnas, String formato, UUID programaId,
                                        String ciudad, String estadoAcademico) {
        var datos = datosPersonalizados(columnas, programaId, ciudad, estadoAcademico);
        if ("csv".equalsIgnoreCase(formato)) return exportarCsv(datos);
        if ("xlsx".equalsIgnoreCase(formato)) return exportarXlsx(datos);
        if ("pdf".equalsIgnoreCase(formato)) return exportarPdf(datos);
        throw new BusinessException("Formato de exportacion no soportado: " + formato);
    }

    /**
     * Las ciudades que de verdad hay escritas en las fichas activas.
     *
     * <p>El filtro de ciudad compara por igualdad, y la ciudad entró del Excel
     * como texto libre: hay fichas con «Otro» y con «Sin dato». Una caja de
     * texto ahí devolvería cero filas en silencio cada vez que alguien escriba
     * «Bogota» donde la ficha dice «Bogotá D.C.», y un informe vacío no se
     * distingue de un informe sin resultados.
     */
    public List<String> ciudadesDisponibles() {
        return entityManager.createQuery(
                    "SELECT DISTINCT e.ciudad FROM Estudiante e"
                    + " WHERE e.activo = true AND e.ciudad IS NOT NULL AND e.ciudad <> ''"
                    + " ORDER BY e.ciudad", String.class)
                .getResultList();
    }

    private DatosReporte datosPersonalizados(List<String> columnas, UUID programaId,
                                             String ciudad, String estadoAcademico) {
        if (columnas == null || columnas.isEmpty()) {
            throw new BusinessException("Elige al menos una columna para el informe.");
        }
        var catalogo = ColumnaDeInforme.catalogo();
        var elegidas = new ArrayList<ColumnaDeInforme>();
        for (String id : columnas) {
            var columna = catalogo.get(id == null ? "" : id.trim().toUpperCase(java.util.Locale.ROOT));
            if (columna == null) {
                // Se nombra la columna que falla en vez de ignorarla: una
                // columna que desaparece del archivo sin decir nada es peor que
                // un error, porque el archivo parece correcto.
                throw new BusinessException("Columna no disponible para informes: " + id);
            }
            if (!elegidas.contains(columna)) {
                elegidas.add(columna);
            }
        }

        StringBuilder jpql = new StringBuilder(
            "SELECT e FROM Estudiante e JOIN FETCH e.programa LEFT JOIN FETCH e.nivelIngles"
            + " WHERE e.activo = true");
        if (programaId != null) jpql.append(" AND e.programa.id = :programaId");
        if (ciudad != null && !ciudad.isBlank()) jpql.append(" AND LOWER(e.ciudad) = LOWER(:ciudad)");
        if (estadoAcademico != null && !estadoAcademico.isBlank()) {
            jpql.append(" AND e.estadoAcademico = :estadoAcademico");
        }
        jpql.append(" ORDER BY e.apellido, e.nombre");

        var query = entityManager.createQuery(jpql.toString(), Estudiante.class);
        if (programaId != null) query.setParameter("programaId", programaId);
        if (ciudad != null && !ciudad.isBlank()) query.setParameter("ciudad", ciudad.trim());
        if (estadoAcademico != null && !estadoAcademico.isBlank()) {
            try {
                query.setParameter("estadoAcademico",
                        com.novacrm.estudiante.EstadoAcademico.valueOf(
                                estadoAcademico.trim().toUpperCase(java.util.Locale.ROOT)));
            } catch (IllegalArgumentException e) {
                throw new BusinessException("Estado academico no valido: " + estadoAcademico);
            }
        }

        var filas = new ArrayList<String[]>();
        for (Estudiante e : query.getResultList()) {
            var fila = new String[elegidas.size()];
            for (int i = 0; i < elegidas.size(); i++) {
                fila[i] = elegidas.get(i).leerDe(e);
            }
            filas.add(fila);
        }

        return new DatosReporte("Informe a medida",
                elegidas.stream().map(ColumnaDeInforme::getEtiqueta).toArray(String[]::new),
                filas);
    }

    // ── Banco de perfiles para empresas ─────────────────────────────────────

    /**
     * Los perfiles laborales, tal como se le pueden entregar a una empresa.
     *
     * <p>Existe porque cuando una empresa pide candidatos, lo que había a mano
     * era el reporte de estudiantes: y ese lleva <strong>documento, correo y
     * celular</strong>. Sale del CRM, se adjunta a un correo y ya está fuera de
     * la institución. Nadie decidió ceder esos datos; simplemente era el botón
     * que estaba ahí.
     *
     * <p>Las columnas son las mismas que ve una empresa en su portal —ver
     * {@code PerfilLaboralDto}—, y por el mismo motivo: para decidir a quién se
     * entrevista hace falta el perfil, no la cédula. Si la empresa quiere
     * contactar a alguien, pasa por el equipo, que es lo que convierte una
     * cesión de datos en una presentación.
     *
     * <p>El nombre sí va: un perfil anónimo no sirve para convocar a nadie, y
     * es el dato que el estudiante ya aceptó mostrar al postularse.
     */
    private DatosReporte datosPerfilesLaborales(UUID programaId, UUID vacanteId) {
        StringBuilder jpql = new StringBuilder(
            "SELECT DISTINCT e FROM Estudiante e JOIN FETCH e.programa LEFT JOIN FETCH e.nivelIngles"
            + " WHERE e.activo = true");
        if (programaId != null) {
            jpql.append(" AND e.programa.id = :programaId");
        }
        if (vacanteId != null) {
            // Solo quienes se postularon a esa vacante. Es lo que la empresa
            // puede preguntar: sobre su propia oferta.
            jpql.append(" AND EXISTS (SELECT 1 FROM Postulacion p"
                + " WHERE p.estudiante = e AND p.vacante.id = :vacanteId)");
        }
        jpql.append(" ORDER BY e.apellido, e.nombre");

        TypedQuery<Estudiante> query = entityManager.createQuery(jpql.toString(), Estudiante.class);
        if (programaId != null) {
            query.setParameter("programaId", programaId);
        }
        if (vacanteId != null) {
            query.setParameter("vacanteId", vacanteId);
        }

        List<String[]> filas = new ArrayList<>();
        for (Estudiante e : query.getResultList()) {
            filas.add(new String[] {
                (valor(e.getNombre()) + " " + valor(e.getApellido())).trim(),
                e.getPrograma() != null ? valor(e.getPrograma().getNombre()) : "",
                valor(e.getCiudad()),
                valor(e.getTitulo()),
                valor(e.getAreaFormacion()),
                valor(e.getUltimoCargo()),
                valor(e.getSectorExperiencia()),
                e.getAniosExperiencia() == null ? "" : String.valueOf(e.getAniosExperiencia()),
                e.getNivelIngles() != null ? valor(e.getNivelIngles().getNombre()) : "",
                valor(e.getCompetencias()),
                valor(e.getCargoObjetivo()),
                movilidad(e.getDisponibilidadMovilidad()),
                valor(e.getPerfilProfesional()),
            });
        }

        return new DatosReporte(
            "Banco de perfiles laborales",
            new String[] {"Nombre", "Programa", "Ciudad", "Titulo", "Area de formacion",
                "Ultimo cargo", "Sector de experiencia", "Anios de experiencia", "Nivel de ingles",
                "Habilidades", "Cargo objetivo", "Disponibilidad de movilidad", "Perfil profesional"},
            filas);
    }

    /** «Sin dato» y «dijo que no» no son lo mismo, y en una hoja se confunden. */
    private static String movilidad(Boolean disponible) {
        if (disponible == null) return "Sin preguntar";
        return disponible ? "Si" : "No";
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

    // ── Panorama: el banco completo, con graficos ───────────────────────────

    /** Una cifra de cabecera. */
    private record Indicador(String etiqueta, String valor, String nota) {}

    /** Un grafico de barras: etiqueta y cuanto. */
    private record Barra(String etiqueta, long valor) {}

    private record Grafico(String titulo, String nota, List<Barra> barras) {}

    private record DatosPanorama(List<Indicador> indicadores, List<Grafico> graficos) {}

    /**
     * Todo lo que hay sobre la cohorte, en un solo documento.
     *
     * <p>Los cuatro informes que existían responden cada uno a una pregunta y
     * hay que exportarlos por separado para armar el panorama a mano en el
     * comité. Este los junta y —lo que de verdad cambia— los <strong>dibuja</strong>:
     * «38 activos, 12 colocados» son dos números; la misma barra al lado de la
     * otra es una proporción, y es lo que se mira en una reunión.
     */
    private DatosPanorama datosPanorama(UUID programaId) {
        String filtro = programaId != null ? " AND e.programa.id = :programaId" : "";

        long activos = contar("SELECT COUNT(e) FROM Estudiante e WHERE e.activo = true" + filtro, programaId);
        long colocados = contar(
            "SELECT COUNT(DISTINCT c.estudiante.id) FROM Colocacion c JOIN c.estudiante e"
            + " WHERE c.activa = true AND e.activo = true" + filtro, programaId);
        long postulaciones = contar(
            "SELECT COUNT(p) FROM Postulacion p JOIN p.estudiante e WHERE e.activo = true" + filtro, programaId);
        long conEntrevista = contar(
            "SELECT COUNT(DISTINCT p.estudiante.id) FROM Postulacion p JOIN p.estudiante e"
            + " WHERE p.fechaHoraEntrevista IS NOT NULL AND e.activo = true" + filtro, programaId);

        var indicadores = List.of(
            new Indicador("Participantes activos", String.valueOf(activos), "en la cohorte"),
            new Indicador("Colocados", String.valueOf(colocados),
                porcentaje(colocados, activos) + " de los activos"),
            new Indicador("Postulaciones enviadas", String.valueOf(postulaciones),
                activos == 0 ? "" : String.format(java.util.Locale.ROOT, "%.1f por participante",
                    (double) postulaciones / activos)),
            new Indicador("Han llegado a entrevista", String.valueOf(conEntrevista),
                porcentaje(conEntrevista, activos) + " de los activos"));

        var graficos = new ArrayList<Grafico>();
        graficos.add(new Grafico("Estado academico", null,
            agrupar("SELECT e.estadoAcademico, COUNT(e) FROM Estudiante e"
                + " WHERE e.activo = true" + filtro + " GROUP BY e.estadoAcademico", programaId)));
        graficos.add(new Grafico("Participantes por programa", null,
            agrupar("SELECT e.programa.nombre, COUNT(e) FROM Estudiante e"
                + " WHERE e.activo = true" + filtro + " GROUP BY e.programa.nombre", programaId)));
        graficos.add(new Grafico("Ciudades", "Las diez con mas participantes",
            recortar(agrupar("SELECT e.ciudad, COUNT(e) FROM Estudiante e"
                + " WHERE e.activo = true" + filtro + " GROUP BY e.ciudad", programaId), 10)));
        graficos.add(new Grafico("Nivel de ingles", null,
            agrupar("SELECT e.nivelIngles.nombre, COUNT(e) FROM Estudiante e"
                + " WHERE e.activo = true AND e.nivelIngles IS NOT NULL" + filtro
                + " GROUP BY e.nivelIngles.nombre", programaId)));
        graficos.add(new Grafico("Estado de las postulaciones", null,
            agrupar("SELECT p.estado, COUNT(p) FROM Postulacion p JOIN p.estudiante e"
                + " WHERE e.activo = true" + filtro + " GROUP BY p.estado", programaId)));
        graficos.add(new Grafico("Colocaciones por mes", "Ultimos doce meses",
            colocacionesPorMes(programaId)));

        // Un grafico sin barras es una caja vacia con un titulo encima: se cae
        // del informe en vez de ocupar media pagina para no decir nada.
        graficos.removeIf(g -> g.barras().isEmpty());
        return new DatosPanorama(indicadores, graficos);
    }

    private static String porcentaje(long parte, long total) {
        if (total == 0) return "sin base";
        return String.format(java.util.Locale.ROOT, "%.1f%%", 100.0 * parte / total);
    }

    /** Consulta de dos columnas —etiqueta y conteo— a barras, de mayor a menor. */
    private List<Barra> agrupar(String jpql, UUID programaId) {
        var query = entityManager.createQuery(jpql, Object[].class);
        if (programaId != null && jpql.contains(":programaId")) {
            query.setParameter("programaId", programaId);
        }
        var barras = new ArrayList<Barra>();
        for (Object[] fila : query.getResultList()) {
            // Sin etiqueta es «sin dato», que es una respuesta y no un hueco:
            // veinte participantes sin ciudad registrada es justo lo que hay que
            // ver en el informe.
            String etiqueta = fila[0] == null ? "Sin dato" : String.valueOf(fila[0]);
            barras.add(new Barra(etiqueta, ((Number) fila[1]).longValue()));
        }
        barras.sort((a, b) -> Long.compare(b.valor(), a.valor()));
        return barras;
    }

    private static List<Barra> recortar(List<Barra> barras, int tope) {
        return barras.size() <= tope ? barras : new ArrayList<>(barras.subList(0, tope));
    }

    /**
     * Colocaciones de los últimos doce meses, en orden cronológico.
     *
     * <p>Los meses sin ninguna se dejan **en cero y visibles**: un hueco en la
     * serie se lee como «no hay dato», y aquí el dato es que ese mes no colocó
     * a nadie.
     */
    private List<Barra> colocacionesPorMes(UUID programaId) {
        String jpql = "SELECT c.fechaInicio FROM Colocacion c JOIN c.estudiante e"
            + " WHERE c.fechaInicio IS NOT NULL AND e.activo = true"
            + (programaId != null ? " AND e.programa.id = :programaId" : "");
        var query = entityManager.createQuery(jpql, java.time.LocalDate.class);
        if (programaId != null) {
            query.setParameter("programaId", programaId);
        }

        var hoy = java.time.YearMonth.now(java.time.ZoneId.of("America/Bogota"));
        var conteo = new java.util.LinkedHashMap<java.time.YearMonth, Long>();
        for (int i = 11; i >= 0; i--) {
            conteo.put(hoy.minusMonths(i), 0L);
        }
        for (java.time.LocalDate fecha : query.getResultList()) {
            var mes = java.time.YearMonth.from(fecha);
            conteo.computeIfPresent(mes, (k, v) -> v + 1);
        }

        var barras = new ArrayList<Barra>();
        conteo.forEach((mes, cuantas) -> barras.add(new Barra(mes.toString(), cuantas)));
        // Sin ninguna colocacion en todo el anio el grafico sobra: doce ceros no
        // son una serie, son la ausencia de una.
        return barras.stream().anyMatch(b -> b.valor() > 0) ? barras : List.of();
    }

    /** El panorama en tabla, para xlsx y csv: las mismas cifras sin dibujo. */
    private DatosReporte datosPanoramaEnTabla(UUID programaId) {
        var panorama = datosPanorama(programaId);
        var filas = new ArrayList<String[]>();
        for (Indicador i : panorama.indicadores()) {
            filas.add(new String[] {"Indicadores", i.etiqueta(), i.valor(), i.nota()});
        }
        for (Grafico g : panorama.graficos()) {
            long total = g.barras().stream().mapToLong(Barra::valor).sum();
            for (Barra b : g.barras()) {
                filas.add(new String[] {g.titulo(), b.etiqueta(), String.valueOf(b.valor()),
                    porcentaje(b.valor(), total)});
            }
        }
        return new DatosReporte("Panorama de la cohorte",
            new String[] {"Seccion", "Concepto", "Valor", "Detalle"}, filas);
    }

    /**
     * El panorama en PDF, con los gráficos dibujados.
     *
     * <p>Las barras son {@code div} con un ancho en porcentaje, no imágenes ni
     * SVG: openhtmltopdf no trae el módulo de SVG y añadir Batik por seis
     * gráficos de barras sería cargar un renderizador entero para dibujar
     * rectángulos. Además, así imprimen bien en blanco y negro.
     */
    private byte[] exportarPanoramaPdf(DatosPanorama datos) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><style>")
            .append("@page { size: A4 portrait; margin: 14mm 12mm 16mm 12mm; ")
            .append("@bottom-right { content: 'Pagina ' counter(page) ' de ' counter(pages); ")
            .append("font-family: Helvetica, Arial, sans-serif; font-size: 8px; color: #767676; } }")
            .append("body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; color: #1E293B; margin: 0; }")
            .append("h1 { font-size: 17px; color: #1F4E79; margin: 0 0 3px 0; }")
            .append("h2 { font-size: 12px; color: #1F4E79; margin: 0 0 6px 0; }")
            .append(".barra-marca { height: 4px; background: #E1251B; width: 90px; margin: 0 0 10px 0; }")
            .append(".meta { font-size: 8px; color: #767676; margin: 0 0 14px 0; }")
            .append(".kpis { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin-bottom: 16px; }")
            .append(".kpi { background: #F4F6F9; border: 1px solid #CBD5E1; padding: 8px; width: 25%; }")
            .append(".kpi .n { font-size: 20px; font-weight: bold; color: #1F4E79; }")
            .append(".kpi .e { font-size: 9px; color: #1E293B; }")
            .append(".kpi .s { font-size: 8px; color: #767676; }")
            .append(".gr { page-break-inside: avoid; margin-bottom: 14px; }")
            .append(".gr .nota { font-size: 8px; color: #767676; margin: -4px 0 6px 0; }")
            .append(".fila { width: 100%; border-collapse: collapse; }")
            .append(".fila td { padding: 2px 0; vertical-align: middle; border: none; }")
            .append(".et { width: 32%; font-size: 9px; padding-right: 6px; }")
            .append(".pista { width: 56%; background: #EDF1F6; }")
            .append(".rel { background: #1F4E79; height: 11px; }")
            .append(".num { width: 12%; text-align: right; font-size: 9px; font-weight: bold; padding-left: 6px; }")
            .append("</style></head><body>");

        html.append("<h1>Panorama de la cohorte</h1><div class=\"barra-marca\"></div>");
        html.append("<p class=\"meta\">Generado el ")
            .append(escapeHtml(FECHA_HORA_FORMATTER.format(java.time.Instant.now())))
            .append("</p>");

        html.append("<table class=\"kpis\"><tr>");
        for (Indicador i : datos.indicadores()) {
            html.append("<td class=\"kpi\"><div class=\"n\">").append(escapeHtml(i.valor()))
                .append("</div><div class=\"e\">").append(escapeHtml(i.etiqueta()))
                .append("</div><div class=\"s\">").append(escapeHtml(i.nota()))
                .append("</div></td>");
        }
        html.append("</tr></table>");

        for (Grafico g : datos.graficos()) {
            // La barra se mide contra el mayor del grafico, no contra el total:
            // con seis categorias repartidas, medir contra el total deja todas
            // las barras cortas y el grafico no dice nada.
            long maximo = g.barras().stream().mapToLong(Barra::valor).max().orElse(1);
            if (maximo == 0) maximo = 1;

            html.append("<div class=\"gr\"><h2>").append(escapeHtml(g.titulo())).append("</h2>");
            if (g.nota() != null) {
                html.append("<p class=\"nota\">").append(escapeHtml(g.nota())).append("</p>");
            }
            html.append("<table class=\"fila\">");
            for (Barra b : g.barras()) {
                long ancho = Math.round(100.0 * b.valor() / maximo);
                html.append("<tr><td class=\"et\">").append(escapeHtml(b.etiqueta())).append("</td>")
                    .append("<td class=\"pista\"><div class=\"rel\" style=\"width:")
                    .append(ancho).append("%\"></div></td>")
                    .append("<td class=\"num\">").append(b.valor()).append("</td></tr>");
            }
            html.append("</table></div>");
        }

        if (datos.graficos().isEmpty()) {
            html.append("<p style=\"color:#767676;font-style:italic\">")
                .append("No hay datos suficientes para dibujar el panorama.</p>");
        }
        html.append("</body></html>");

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html.toString(), null);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (IOException e) {
            throw new BusinessException("Error generando archivo PDF: " + e.getMessage());
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
