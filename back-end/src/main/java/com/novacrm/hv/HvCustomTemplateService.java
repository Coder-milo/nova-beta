package com.novacrm.hv;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.documento.StorageService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.exception.BusinessException;
import com.novacrm.hv.dto.DatosHvDto;
import com.novacrm.hv.dto.ExperienciaDto;
import com.novacrm.hv.dto.FormacionDto;
import com.novacrm.perfil.ExperienciaLaboral;
import com.novacrm.perfil.FormacionAdicional;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;
import org.apache.pdfbox.pdmodel.interactive.form.PDField;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.UnderlinePatterns;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFFooter;
import org.apache.poi.xwpf.usermodel.XWPFHeader;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFPicture;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Convierte archivos DOCX o PDF en plantillas combinables.
 *
 * DOCX: los marcadores {{CAMPO}} se reemplazan y el documento se transforma a
 * HTML/PDF conservando tipografias, tablas, imagenes, colores y alineacion.
 *
 * PDF: se rellenan preferentemente campos de formulario (AcroForm) llamados
 * CAMPO. Como alternativa admite marcadores visibles {{CAMPO}} sobre areas
 * claras del PDF.
 */
@Service
public class HvCustomTemplateService {

    public static final long MAX_TEMPLATE_BYTES = 10L * 1024L * 1024L;
    private static final String FOTO_MUESTRA_BASE64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

    private static final Pattern PLACEHOLDER =
            Pattern.compile("\\{\\{\\s*([\\p{L}0-9_]+)\\s*}}", Pattern.CASE_INSENSITIVE);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("MM/yyyy");

    private static final Map<String, String> FIELD_ALIASES = Map.ofEntries(
            Map.entry("FULL_NAME", "FULL_NAME"),
            Map.entry("NOMBRE_COMPLETO", "FULL_NAME"),
            Map.entry("FIRST_NAME", "FIRST_NAME"),
            Map.entry("NOMBRE", "FIRST_NAME"),
            Map.entry("LAST_NAME", "LAST_NAME"),
            Map.entry("APELLIDOS", "LAST_NAME"),
            Map.entry("EMAIL", "EMAIL"),
            Map.entry("CORREO", "EMAIL"),
            Map.entry("PHONE", "PHONE"),
            Map.entry("TELEFONO", "PHONE"),
            Map.entry("CELULAR", "PHONE"),
            Map.entry("CITY_COUNTRY", "CITY_COUNTRY"),
            Map.entry("CIUDAD", "CITY_COUNTRY"),
            Map.entry("ADDRESS", "ADDRESS"),
            Map.entry("DIRECCION", "ADDRESS"),
            Map.entry("DOCUMENT_ID", "DOCUMENT_ID"),
            Map.entry("DOCUMENTO", "DOCUMENT_ID"),
            Map.entry("PROFESSIONAL_TITLE", "PROFESSIONAL_TITLE"),
            Map.entry("TITULO_PROFESIONAL", "PROFESSIONAL_TITLE"),
            Map.entry("PROFESSIONAL_SUMMARY", "PROFESSIONAL_SUMMARY"),
            Map.entry("SUMMARY", "PROFESSIONAL_SUMMARY"),
            Map.entry("PERFIL_PROFESIONAL", "PROFESSIONAL_SUMMARY"),
            Map.entry("SKILLS", "SKILLS"),
            Map.entry("COMPETENCIAS", "SKILLS"),
            Map.entry("LANGUAGES", "LANGUAGES"),
            Map.entry("IDIOMAS", "LANGUAGES"),
            Map.entry("EDUCATION", "EDUCATION"),
            Map.entry("EDUCACION", "EDUCATION"),
            Map.entry("EXPERIENCE", "EXPERIENCE"),
            Map.entry("EXPERIENCIA", "EXPERIENCE"),
            Map.entry("REFERENCES", "REFERENCES"),
            Map.entry("REFERENCIAS", "REFERENCES"),
            Map.entry("PROGRAM_NAME", "PROGRAM_NAME"),
            Map.entry("PROGRAMA", "PROGRAM_NAME"),
            Map.entry("LINKEDIN_URL", "LINKEDIN_URL"),
            Map.entry("LINKEDIN", "LINKEDIN_URL"),
            Map.entry("PORTFOLIO_URL", "PORTFOLIO_URL"),
            Map.entry("PORTAFOLIO", "PORTFOLIO_URL"),
            Map.entry("ENGLISH_LEVEL", "ENGLISH_LEVEL"),
            Map.entry("NIVEL_INGLES", "ENGLISH_LEVEL"),
            Map.entry("OBJECTIVE_ROLE", "OBJECTIVE_ROLE"),
            Map.entry("CARGO_OBJETIVO", "OBJECTIVE_ROLE"),
            Map.entry("AVAILABILITY", "AVAILABILITY"),
            Map.entry("DISPONIBILIDAD", "AVAILABILITY")
    );

    private final StorageService storageService;
    private final HvPdfService pdfService;
    private final ObjectMapper objectMapper;

    public HvCustomTemplateService(StorageService storageService,
                                   HvPdfService pdfService,
                                   ObjectMapper objectMapper) {
        this.storageService = storageService;
        this.pdfService = pdfService;
        this.objectMapper = objectMapper;
    }

    public TemplateValidation validar(String filename, String contentType, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new BusinessException("Selecciona un archivo Word (.docx) o PDF.");
        }
        if (bytes.length > MAX_TEMPLATE_BYTES) {
            throw new BusinessException("La plantilla supera el limite de 10 MB.");
        }

        TemplateFormat format = detectarFormato(filename, contentType);
        Set<String> fields;
        try {
            fields = format == TemplateFormat.DOCX
                    ? detectarCamposDocx(bytes)
                    : detectarCamposPdf(bytes);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("No se pudo leer la plantilla " + format.label
                    + ": " + mensaje(ex));
        }

        boolean automatic = fields.isEmpty();
        if (automatic) {
            fields = detectarCamposAutomaticos(format, bytes);
        }

        String manifest;
        try {
            manifest = objectMapper.writeValueAsString(Map.of(
                    "format", format.name(),
                    "fields", fields,
                    "mode", automatic ? "AUTO" : "MARKERS"
            ));
        } catch (JsonProcessingException ex) {
            throw new BusinessException("No se pudo registrar la lista de campos de la plantilla.");
        }
        return new TemplateValidation(format, fields, manifest);
    }

    public byte[] generar(PlantillaHv plantilla,
                          Estudiante estudiante,
                          List<FormacionAdicional> formaciones,
                          List<ExperienciaLaboral> experiencias) {
        if (plantilla == null || plantilla.getObjectKey() == null) {
            throw new BusinessException("La plantilla seleccionada no tiene un archivo base.");
        }
        byte[] source = storageService.descargar(plantilla.getObjectKey());
        TemplateFormat format = detectarFormato(plantilla.getObjectKey(), plantilla.getContentType());
        Map<String, String> values = valores(estudiante, formaciones, experiencias);
        boolean automatic = esAutomatica(plantilla.getFieldManifest());
        try {
            if (format == TemplateFormat.PDF) {
                return automatic
                        ? generarDesdePdfAutomatico(source, values)
                        : generarDesdePdf(source, values);
            }
            return automatic
                    ? generarDesdeDocxAutomatico(source, values)
                    : generarDesdeDocx(source, values);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("No se pudo combinar la plantilla "
                    + plantilla.getNombre() + ": " + mensaje(ex));
        }
    }

    public byte[] vistaPrevia(PlantillaHv plantilla) {
        if (plantilla.getObjectKey() == null) {
            var datos = new DatosHvDto(
                    "Andrea", "Martinez",
                    "Analista de datos",
                    "andrea.martinez@ejemplo.com",
                    "+57 300 123 4567",
                    "Barranquilla",
                    "linkedin.com/in/andrea-martinez",
                    "Profesional orientada a resultados, con experiencia en analisis de informacion y mejora de procesos.",
                    "Analisis de datos, Excel avanzado, Power BI, comunicacion efectiva",
                    "Espanol nativo, Ingles B2",
                    "Profesional en Administracion",
                    "Universidad del Atlantico",
                    "Profesional",
                    List.of(new ExperienciaDto(
                            "Analista de datos", "Empresa Ejemplo", "Barranquilla",
                            "01/2024", "", false, true,
                            "Construccion de tableros e indicadores para apoyar la toma de decisiones.")),
                    List.of(new FormacionDto(
                            "CERTIFICACION", "Power BI para analisis empresarial",
                            "Academia CAC", "2025")),
                    "+57 605 300 1234",
                    "Colombia",
                    "https://www.linkedin.com/in/andrea-martinez",
                    "https://portafolio.ejemplo.com/andrea",
                    "B2",
                    List.of("Redujo en 30% el tiempo de cierre mensual automatizando el reporte de indicadores.")
            );
            String fotoMuestra = "CLASICO_FOTO".equalsIgnoreCase(plantilla.getCodigo()) ? FOTO_MUESTRA_BASE64 : null;
            return pdfService.generar(datos, plantilla.getColorPrimario(), "es", null, null, fotoMuestra, plantilla.getCodigo());
        }

        byte[] source = storageService.descargar(plantilla.getObjectKey());
        Map<String, String> values = valoresMuestra();
        try {
            TemplateFormat format = detectarFormato(plantilla.getObjectKey(), plantilla.getContentType());
            // Las plantillas creadas antes de incorporar campos combinables no tienen
            // manifest. Aun así deben poder consultarse como documento original.
            if (contarCampos(plantilla.getFieldManifest()) == 0) {
                return format == TemplateFormat.PDF
                        ? source
                        : generarDesdeDocx(source, Map.of());
            }
            if (esAutomatica(plantilla.getFieldManifest())) {
                return format == TemplateFormat.PDF
                        ? generarDesdePdfAutomatico(source, values)
                        : generarDesdeDocxAutomatico(source, values);
            }
            return format == TemplateFormat.PDF
                    ? generarDesdePdf(source, values)
                    : generarDesdeDocx(source, values);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("No se pudo generar la vista previa: " + mensaje(ex));
        }
    }

    public int contarCampos(String manifest) {
        if (manifest == null || manifest.isBlank()) return 0;
        try {
            var node = objectMapper.readTree(manifest).path("fields");
            return node.isArray() ? node.size() : 0;
        } catch (Exception ignored) {
            return 0;
        }
    }

    public boolean esAutomatica(String manifest) {
        if (manifest == null || manifest.isBlank()) return false;
        try {
            return "AUTO".equalsIgnoreCase(objectMapper.readTree(manifest).path("mode").asText());
        } catch (Exception ignored) {
            return false;
        }
    }

    public String tipoArchivo(PlantillaHv plantilla) {
        if (plantilla.getObjectKey() == null) {
            return plantilla.getContenidoHtml() != null ? "CAC" : null;
        }
        return detectarFormato(plantilla.getObjectKey(), plantilla.getContentType()).label;
    }

    private byte[] generarDesdeDocx(byte[] source, Map<String, String> values) throws IOException {
        try (var document = new XWPFDocument(new ByteArrayInputStream(source))) {
            reemplazarDocumento(document, values);
            String html = convertirDocxAHtml(document);
            return pdfService.renderizarHtmlAPdf(html);
        }
    }

    private byte[] generarDesdeDocxAutomatico(byte[] source,
                                               Map<String, String> values) throws IOException {
        try (var document = new XWPFDocument(new ByteArrayInputStream(source))) {
            adaptarDocumentoAutomatico(document, values);
            String html = convertirDocxAHtml(document);
            return pdfService.renderizarHtmlAPdf(html);
        }
    }

    private byte[] generarDesdePdf(byte[] source, Map<String, String> values) throws IOException {
        try (var document = PDDocument.load(source)) {
            if (document.isEncrypted()) {
                throw new BusinessException("La plantilla PDF esta protegida con contrasena.");
            }

            boolean formFilled = rellenarFormularioPdf(document, values);
            List<PdfPlaceholder> placeholders = localizarMarcadoresPdf(document);
            if (!placeholders.isEmpty()) {
                cubrirMarcadoresPdf(document, placeholders, values);
            }
            if (!formFilled && placeholders.isEmpty()) {
                throw new BusinessException("El PDF ya no contiene campos combinables.");
            }

            try (var out = new ByteArrayOutputStream()) {
                document.save(out);
                return out.toByteArray();
            }
        }
    }

    private byte[] generarDesdePdfAutomatico(byte[] source,
                                              Map<String, String> values) throws IOException {
        try (var document = PDDocument.load(source)) {
            if (document.isEncrypted()) {
                throw new BusinessException("La plantilla PDF esta protegida con contrasena.");
            }
            if (document.getNumberOfPages() > 1) {
                // Antes se descartaban las paginas extra en silencio, perdiendo
                // contenido del usuario sin avisar. El generador automatico
                // soporta una sola pagina; mejor error claro que datos perdidos.
                throw new BusinessException(
                        "El generador automatico soporta una sola pagina y esta plantilla tiene "
                                + document.getNumberOfPages() + ".");
            }

            PDPage page = document.getPage(0);
            float width = page.getCropBox().getWidth();
            float height = page.getCropBox().getHeight();
            float margin = Math.max(28f, width * .055f);
            float contentWidth = width - margin * 2f;

            PDType0Font regular;
            PDType0Font bold;
            try (var regularStream = new ClassPathResource(
                    "templates/hv/fonts/Carlito-Regular.ttf").getInputStream();
                 var boldStream = new ClassPathResource(
                         "templates/hv/fonts/Carlito-Bold.ttf").getInputStream()) {
                regular = PDType0Font.load(document, regularStream, true);
                bold = PDType0Font.load(document, boldStream, true);
            }

            try (var cs = new PDPageContentStream(document, page,
                    PDPageContentStream.AppendMode.APPEND, true, true)) {
                var panelState = new PDExtendedGraphicsState();
                panelState.setNonStrokingAlphaConstant(.96f);
                cs.setGraphicsStateParameters(panelState);
                cs.setNonStrokingColor(Color.WHITE);
                cs.addRect(margin - 10f, margin - 10f,
                        contentWidth + 20f, height - margin * 2f + 20f);
                cs.fill();

                var solidState = new PDExtendedGraphicsState();
                solidState.setNonStrokingAlphaConstant(1f);
                cs.setGraphicsStateParameters(solidState);
                cs.setNonStrokingColor(new Color(20, 27, 157));
                cs.addRect(margin - 10f, margin - 10f, 5f,
                        height - margin * 2f + 20f);
                cs.fill();

                float y = height - margin - 18f;
                y = drawWrappedText(cs, bold, 22f,
                        values.getOrDefault("FULL_NAME", ""), margin, y,
                        contentWidth, 24f, 2, new Color(12, 24, 44));
                y = drawWrappedText(cs, regular, 11f,
                        values.getOrDefault("PROFESSIONAL_TITLE", ""), margin, y - 1f,
                        contentWidth, 13f, 2, new Color(20, 27, 157));
                y = drawWrappedText(cs, regular, 8.5f,
                        contacto(values), margin, y - 5f,
                        contentWidth, 10f, 2, new Color(65, 75, 92));
                y -= 9f;

                y = drawPdfSection(cs, bold, regular, "PERFIL PROFESIONAL",
                        values.get("PROFESSIONAL_SUMMARY"), margin, y, contentWidth, 4);
                y = drawPdfSection(cs, bold, regular, "COMPETENCIAS",
                        values.get("SKILLS"), margin, y, contentWidth, 3);
                y = drawPdfSection(cs, bold, regular, "EXPERIENCIA",
                        values.get("EXPERIENCE"), margin, y, contentWidth, 8);
                y = drawPdfSection(cs, bold, regular, "EDUCACION",
                        values.get("EDUCATION"), margin, y, contentWidth, 5);
                drawPdfSection(cs, bold, regular, "IDIOMAS Y REFERENCIAS",
                        additionalInformation(values), margin, y, contentWidth, 3);
            }

            try (var out = new ByteArrayOutputStream()) {
                document.save(out);
                return out.toByteArray();
            }
        }
    }

    private boolean rellenarFormularioPdf(PDDocument document, Map<String, String> values) throws IOException {
        PDAcroForm form = document.getDocumentCatalog().getAcroForm();
        if (form == null || form.getFieldTree() == null) return false;
        if (form.getDefaultResources() == null) form.setDefaultResources(new PDResources());
        form.setNeedAppearances(true);

        boolean filled = false;
        for (PDField field : form.getFieldTree()) {
            String canonical = canonical(field.getFullyQualifiedName());
            if (canonical == null) continue;
            field.setValue(values.getOrDefault(canonical, ""));
            filled = true;
        }
        if (filled) {
            try {
                form.refreshAppearances();
                form.flatten();
            } catch (Exception ignored) {
                // Algunos PDF no permiten a PDFBox regenerar apariencias; el valor
                // sigue guardado y los visores modernos lo muestran correctamente.
            }
        }
        return filled;
    }

    private List<PdfPlaceholder> localizarMarcadoresPdf(PDDocument document) throws IOException {
        var stripper = new PlaceholderLocator();
        stripper.setSortByPosition(true);
        stripper.getText(document);
        return stripper.placeholders;
    }

    private void cubrirMarcadoresPdf(PDDocument document,
                                     List<PdfPlaceholder> placeholders,
                                     Map<String, String> values) throws IOException {
        PDType0Font font;
        try (var in = new ClassPathResource("templates/hv/fonts/Carlito-Regular.ttf").getInputStream()) {
            font = PDType0Font.load(document, in, true);
        }

        for (var marker : placeholders) {
            PDPage page = document.getPage(marker.pageIndex);
            float pageHeight = page.getCropBox().getHeight();
            float pageWidth = page.getCropBox().getWidth();
            float baseline = pageHeight - marker.yTop;
            float size = Math.max(7f, Math.min(marker.fontSize, 12f));
            String value = singleLine(values.getOrDefault(marker.field, ""));
            float available = Math.max(20f, pageWidth - marker.x - 24f);
            while (size > 6f && textWidth(font, value, size) > available) size -= .5f;

            try (var cs = new PDPageContentStream(document, page,
                    PDPageContentStream.AppendMode.APPEND, true, true)) {
                cs.setNonStrokingColor(Color.WHITE);
                cs.addRect(marker.x - 1f, baseline - marker.height,
                        Math.max(marker.width + 2f, textWidth(font, value, size) + 3f),
                        marker.height + 3f);
                cs.fill();
                if (!value.isBlank()) {
                    cs.beginText();
                    cs.setNonStrokingColor(Color.DARK_GRAY);
                    cs.setFont(font, size);
                    cs.newLineAtOffset(marker.x, baseline);
                    cs.showText(value);
                    cs.endText();
                }
            }
        }
    }

    private static float textWidth(PDType0Font font, String value, float size) throws IOException {
        if (value == null || value.isEmpty()) return 0f;
        return font.getStringWidth(value) / 1000f * size;
    }

    private static float drawPdfSection(PDPageContentStream cs,
                                        PDType0Font bold,
                                        PDType0Font regular,
                                        String heading,
                                        String value,
                                        float x,
                                        float y,
                                        float width,
                                        int maxLines) throws IOException {
        if (value == null || value.isBlank() || y < 58f) return y;
        y = drawWrappedText(cs, bold, 9.5f, heading, x, y, width,
                11f, 1, new Color(20, 27, 157));
        y = drawWrappedText(cs, regular, 8.8f, value, x, y - 2f, width,
                10.5f, maxLines, new Color(34, 42, 55));
        return y - 8f;
    }

    private static float drawWrappedText(PDPageContentStream cs,
                                         PDType0Font font,
                                         float fontSize,
                                         String value,
                                         float x,
                                         float y,
                                         float width,
                                         float lineHeight,
                                         int maxLines,
                                         Color color) throws IOException {
        List<String> lines = wrapPdfText(font, nvl(value), fontSize, width, maxLines);
        cs.setNonStrokingColor(color);
        for (String line : lines) {
            if (line.isBlank()) {
                y -= lineHeight;
                continue;
            }
            cs.beginText();
            cs.setFont(font, fontSize);
            cs.newLineAtOffset(x, y);
            cs.showText(line);
            cs.endText();
            y -= lineHeight;
        }
        return y;
    }

    private static List<String> wrapPdfText(PDType0Font font,
                                            String value,
                                            float fontSize,
                                            float width,
                                            int maxLines) throws IOException {
        List<String> lines = new ArrayList<>();
        for (String paragraph : value.replace("\r", "").split("\n", -1)) {
            StringBuilder current = new StringBuilder();
            for (String word : paragraph.trim().split("\\s+")) {
                if (word.isBlank()) continue;
                String candidate = current.isEmpty() ? word : current + " " + word;
                if (!current.isEmpty() && textWidth(font, candidate, fontSize) > width) {
                    lines.add(current.toString());
                    current = new StringBuilder(word);
                } else {
                    current = new StringBuilder(candidate);
                }
                if (lines.size() >= maxLines) break;
            }
            if (lines.size() < maxLines && !current.isEmpty()) lines.add(current.toString());
            if (lines.size() >= maxLines) break;
        }
        if (lines.size() == maxLines && !lines.isEmpty()) {
            int last = lines.size() - 1;
            String line = lines.get(last);
            while (!line.isBlank() && textWidth(font, line + "...", fontSize) > width) {
                int split = line.lastIndexOf(' ');
                line = split > 0 ? line.substring(0, split) : "";
            }
            if (!line.isBlank()) lines.set(last, line + "...");
        }
        return lines;
    }

    private Set<String> detectarCamposDocx(byte[] bytes) throws IOException {
        try (var document = new XWPFDocument(new ByteArrayInputStream(bytes))) {
            StringBuilder text = new StringBuilder();
            appendDocumentText(document, text);
            return detectarMarcadores(text.toString());
        }
    }

    private Set<String> detectarCamposPdf(byte[] bytes) throws IOException {
        try (var document = PDDocument.load(bytes)) {
            if (document.isEncrypted()) {
                throw new BusinessException("La plantilla PDF esta protegida con contrasena.");
            }
            Set<String> fields = new LinkedHashSet<>();
            PDAcroForm form = document.getDocumentCatalog().getAcroForm();
            if (form != null) {
                for (PDField field : form.getFieldTree()) {
                    String canonical = canonical(field.getFullyQualifiedName());
                    if (canonical != null) fields.add(canonical);
                }
            }
            fields.addAll(detectarMarcadores(new PDFTextStripper().getText(document)));
            return fields;
        }
    }

    private Set<String> detectarCamposAutomaticos(TemplateFormat format, byte[] bytes) {
        Set<String> fields = new LinkedHashSet<>();
        fields.add("FULL_NAME");
        fields.add("PROFESSIONAL_TITLE");
        fields.add("EMAIL");
        fields.add("PHONE");
        fields.add("CITY_COUNTRY");
        try {
            String text;
            if (format == TemplateFormat.DOCX) {
                try (var document = new XWPFDocument(new ByteArrayInputStream(bytes))) {
                    var builder = new StringBuilder();
                    appendDocumentText(document, builder);
                    text = builder.toString();
                }
            } else {
                try (var document = PDDocument.load(bytes)) {
                    text = new PDFTextStripper().getText(document);
                }
            }
            String normalized = normalizeText(text);
            if (containsAny(normalized, "SUMMARY", "PROFILE", "PERFIL", "RESUMEN", "ABOUT ME")) {
                fields.add("PROFESSIONAL_SUMMARY");
            }
            if (containsAny(normalized, "SKILL", "COMPETENC", "HABILIDAD")) {
                fields.add("SKILLS");
            }
            if (containsAny(normalized, "EXPERIENCE", "EXPERIENCIA", "EMPLOYMENT", "TRAYECTORIA")) {
                fields.add("EXPERIENCE");
            }
            if (containsAny(normalized, "EDUCATION", "EDUCACION", "FORMACION ACADEMICA", "ACADEMIC")) {
                fields.add("EDUCATION");
            }
            if (containsAny(normalized, "LANGUAGE", "IDIOMA", "ADDITIONAL INFORMATION", "INFORMACION ADICIONAL")) {
                fields.add("LANGUAGES");
            }
            if (containsAny(normalized, "REFERENCE", "REFERENCIA")) {
                fields.add("REFERENCES");
            }
        } catch (Exception ignored) {
            // El archivo ya fue validado como Word/PDF. Si su texto no se puede
            // clasificar, se conserva el conjunto mínimo de datos de cabecera.
        }
        return fields;
    }

    private static Set<String> detectarMarcadores(String text) {
        Set<String> fields = new LinkedHashSet<>();
        Matcher matcher = PLACEHOLDER.matcher(text == null ? "" : text);
        while (matcher.find()) {
            String canonical = canonical(matcher.group(1));
            if (canonical != null) fields.add(canonical);
        }
        return fields;
    }

    private static void appendDocumentText(XWPFDocument document, StringBuilder text) {
        appendBodyElements(document.getBodyElements(), text);
        document.getHeaderList().forEach(header -> appendBodyElements(header.getBodyElements(), text));
        document.getFooterList().forEach(footer -> appendBodyElements(footer.getBodyElements(), text));
    }

    private static void appendBodyElements(List<IBodyElement> elements, StringBuilder text) {
        for (IBodyElement element : elements) {
            if (element instanceof XWPFParagraph paragraph) {
                text.append(paragraph.getText()).append('\n');
            } else if (element instanceof XWPFTable table) {
                for (var row : table.getRows()) {
                    for (var cell : row.getTableCells()) {
                        text.append(cell.getText()).append('\n');
                    }
                }
            }
        }
    }

    private static void adaptarDocumentoAutomatico(XWPFDocument document,
                                                    Map<String, String> values) {
        List<XWPFParagraph> paragraphs = new ArrayList<>();
        collectParagraphs(document.getBodyElements(), paragraphs);

        List<Integer> headings = new ArrayList<>();
        for (int i = 0; i < paragraphs.size(); i++) {
            if (autoSection(paragraphs.get(i).getText()) != null) headings.add(i);
        }
        int firstHeading = headings.isEmpty() ? paragraphs.size() : headings.get(0);
        List<XWPFParagraph> headerContent = new ArrayList<>();
        for (int i = 0; i < firstHeading; i++) {
            if (!paragraphs.get(i).getText().isBlank()) headerContent.add(paragraphs.get(i));
        }
        if (!headerContent.isEmpty()) {
            setParagraphText(headerContent.get(0), values.getOrDefault("FULL_NAME", ""));
        }
        if (headerContent.size() > 1) {
            setParagraphText(headerContent.get(1), values.getOrDefault("PROFESSIONAL_TITLE", ""));
        }
        if (headerContent.size() > 2) {
            setParagraphText(headerContent.get(2), contacto(values));
            for (int i = 3; i < headerContent.size(); i++) {
                setParagraphText(headerContent.get(i), "");
            }
        }

        for (int headingIndex = 0; headingIndex < headings.size(); headingIndex++) {
            int start = headings.get(headingIndex) + 1;
            int end = headingIndex + 1 < headings.size()
                    ? headings.get(headingIndex + 1)
                    : paragraphs.size();
            String section = autoSection(paragraphs.get(headings.get(headingIndex)).getText());
            String value = autoSectionValue(section, values);
            XWPFParagraph target = null;
            for (int i = start; i < end; i++) {
                XWPFParagraph paragraph = paragraphs.get(i);
                if (paragraph.getText().isBlank()) continue;
                if (target == null) {
                    target = paragraph;
                    setParagraphText(target, value);
                } else {
                    setParagraphText(paragraph, "");
                }
            }
        }
    }

    private static void collectParagraphs(List<IBodyElement> elements,
                                          List<XWPFParagraph> paragraphs) {
        for (IBodyElement element : elements) {
            if (element instanceof XWPFParagraph paragraph) {
                paragraphs.add(paragraph);
            } else if (element instanceof XWPFTable table) {
                for (var row : table.getRows()) {
                    for (XWPFTableCell cell : row.getTableCells()) {
                        collectParagraphs(cell.getBodyElements(), paragraphs);
                    }
                }
            }
        }
    }

    private static String autoSection(String text) {
        String value = normalizeText(text).trim();
        if (value.isBlank()) return null;
        if (value.matches("^(PROFESSIONAL |CAREER )?(SUMMARY|PROFILE)$")
                || value.matches("^(PERFIL|RESUMEN)( PROFESIONAL)?$")
                || value.equals("ABOUT ME") || value.equals("ACERCA DE MI")) {
            return "PROFESSIONAL_SUMMARY";
        }
        if (value.matches("^(TECHNICAL |CORE |PROFESSIONAL )?SKILLS$")
                || value.matches("^(HABILIDADES|COMPETENCIAS)( TECNICAS| PROFESIONALES)?$")) {
            return "SKILLS";
        }
        if (value.matches("^(PROFESSIONAL |WORK |EMPLOYMENT )?EXPERIENCE$")
                || value.matches("^(EXPERIENCIA|TRAYECTORIA)( LABORAL| PROFESIONAL)?$")) {
            return "EXPERIENCE";
        }
        if (value.matches("^(EDUCATION|ACADEMIC BACKGROUND|ACADEMIC TRAINING)$")
                || value.matches("^(EDUCACION|FORMACION)( ACADEMICA)?$")) {
            return "EDUCATION";
        }
        if (value.matches("^(LANGUAGES|IDIOMAS)$")) {
            return "LANGUAGES";
        }
        if (value.matches("^(REFERENCES|REFERENCIAS)( PROFESIONALES| LABORALES)?$")) {
            return "REFERENCES";
        }
        if (value.matches("^(ADDITIONAL|OTHER) INFORMATION$")
                || value.matches("^INFORMACION ADICIONAL$|^OTROS DATOS$")) {
            return "ADDITIONAL";
        }
        return null;
    }

    private static String autoSectionValue(String section, Map<String, String> values) {
        if ("ADDITIONAL".equals(section)) return additionalInformation(values);
        return values.getOrDefault(section, "");
    }

    private static String contacto(Map<String, String> values) {
        return joinNonBlank(" | ",
                values.get("ADDRESS"),
                values.get("CITY_COUNTRY"),
                values.get("PHONE"),
                values.get("EMAIL"));
    }

    private static String additionalInformation(Map<String, String> values) {
        List<String> parts = new ArrayList<>();
        String languages = values.getOrDefault("LANGUAGES", "");
        String references = values.getOrDefault("REFERENCES", "");
        if (!languages.isBlank()) parts.add("Idiomas: " + languages);
        if (!references.isBlank()) parts.add("Referencias: " + references);
        return String.join("\n", parts);
    }

    private static void setParagraphText(XWPFParagraph paragraph, String value) {
        List<XWPFRun> runs = paragraph.getRuns();
        XWPFRun first = runs.isEmpty() ? paragraph.createRun() : runs.get(0);
        for (XWPFRun run : runs) clearRunText(run);
        String[] lines = nvl(value).split("\\R", -1);
        first.setText(lines.length == 0 ? "" : lines[0], 0);
        for (int i = 1; i < lines.length; i++) {
            first.addBreak();
            first.setText(lines[i]);
        }
    }

    private static void reemplazarDocumento(XWPFDocument document, Map<String, String> values) {
        replaceBodyElements(document.getBodyElements(), values);
        for (XWPFHeader header : document.getHeaderList()) {
            replaceBodyElements(header.getBodyElements(), values);
        }
        for (XWPFFooter footer : document.getFooterList()) {
            replaceBodyElements(footer.getBodyElements(), values);
        }
    }

    private static void replaceBodyElements(List<IBodyElement> elements, Map<String, String> values) {
        for (IBodyElement element : elements) {
            if (element instanceof XWPFParagraph paragraph) {
                replaceParagraph(paragraph, values);
            } else if (element instanceof XWPFTable table) {
                for (var row : table.getRows()) {
                    for (XWPFTableCell cell : row.getTableCells()) {
                        replaceBodyElements(cell.getBodyElements(), values);
                    }
                }
            }
        }
    }

    private static void replaceParagraph(XWPFParagraph paragraph, Map<String, String> values) {
        String original = paragraph.getText();
        if (original == null || !original.contains("{{")) return;

        Matcher matcher = PLACEHOLDER.matcher(original);
        StringBuffer replaced = new StringBuffer();
        boolean changed = false;
        while (matcher.find()) {
            String canonical = canonical(matcher.group(1));
            if (canonical == null) continue;
            matcher.appendReplacement(replaced,
                    Matcher.quoteReplacement(values.getOrDefault(canonical, "")));
            changed = true;
        }
        if (!changed) return;
        matcher.appendTail(replaced);

        List<XWPFRun> runs = paragraph.getRuns();
        XWPFRun first = runs.isEmpty() ? paragraph.createRun() : runs.get(0);
        for (XWPFRun run : runs) clearRunText(run);
        String[] lines = replaced.toString().split("\\R", -1);
        first.setText(lines.length == 0 ? "" : lines[0], 0);
        for (int i = 1; i < lines.length; i++) {
            first.addBreak();
            first.setText(lines[i]);
        }
    }

    private static void clearRunText(XWPFRun run) {
        int count = run.getCTR().sizeOfTArray();
        for (int i = 0; i < count; i++) {
            run.getCTR().getTArray(i).setStringValue("");
        }
    }

    private String convertirDocxAHtml(XWPFDocument document) {
        StringBuilder html = new StringBuilder("""
                <!DOCTYPE html><html><head><meta charset="UTF-8"/>
                <style>
                @page { size: A4; margin: 18mm; }
                body { font-family: Carlito, Arial, sans-serif; color:#202938; font-size:11pt; line-height:1.25; }
                p { margin:0 0 7pt; white-space:normal; }
                table { width:100%; border-collapse:collapse; margin:0 0 7pt; page-break-inside:avoid; }
                td { vertical-align:top; padding:4pt; }
                img { max-width:100%; height:auto; }
                .doc-header { margin-bottom:10pt; }
                .doc-footer { margin-top:12pt; }
                </style></head><body>
                """);

        for (XWPFHeader header : document.getHeaderList()) {
            html.append("<div class=\"doc-header\">");
            renderBodyElements(header.getBodyElements(), html);
            html.append("</div>");
        }
        renderBodyElements(document.getBodyElements(), html);
        for (XWPFFooter footer : document.getFooterList()) {
            html.append("<div class=\"doc-footer\">");
            renderBodyElements(footer.getBodyElements(), html);
            html.append("</div>");
        }
        html.append("</body></html>");
        return html.toString();
    }

    private static void renderBodyElements(List<IBodyElement> elements, StringBuilder html) {
        for (IBodyElement element : elements) {
            if (element instanceof XWPFParagraph paragraph) {
                renderParagraph(paragraph, html);
            } else if (element instanceof XWPFTable table) {
                renderTable(table, html);
            }
        }
    }

    private static void renderParagraph(XWPFParagraph paragraph, StringBuilder html) {
        String align = switch (paragraph.getAlignment()) {
            case CENTER -> "center";
            case RIGHT -> "right";
            case BOTH, DISTRIBUTE -> "justify";
            default -> "left";
        };
        int before = Math.max(0, paragraph.getSpacingBefore());
        int after = Math.max(0, paragraph.getSpacingAfter());
        boolean bullet = paragraph.getNumID() != null;
        html.append("<p style=\"text-align:").append(align)
                .append(";margin-top:").append(before / 20.0).append("pt")
                .append(";margin-bottom:").append(after > 0 ? after / 20.0 : 5).append("pt;\">");
        // OpenHTMLtoPDF analiza el documento como XHTML/XML. Las entidades HTML
        // con nombre (como &nbsp;) no existen sin un DTD, por eso usamos siempre
        // la referencia numérica equivalente.
        if (bullet) html.append("&#8226;&#160;");
        if (paragraph.getRuns().isEmpty()) {
            html.append(escape(paragraph.getText()));
        } else {
            for (XWPFRun run : paragraph.getRuns()) renderRun(run, html);
        }
        if (hasBlueDrawingLine(paragraph)) {
            html.append("<span style=\"display:block;width:100%;margin-top:4pt;border-top:1.25pt solid #1D61CB;\"></span>");
        }
        html.append("</p>");
    }

    private static boolean hasBlueDrawingLine(XWPFParagraph paragraph) {
        String xml = paragraph.getCTP().xmlText();
        return xml.contains("1D61CB")
                && (xml.contains("straightConnector1")
                || xml.contains("custGeom")
                || xml.contains("<a:ln"));
    }

    private static void renderRun(XWPFRun run, StringBuilder html) {
        for (XWPFPicture picture : run.getEmbeddedPictures()) {
            try {
                var data = picture.getPictureData();
                String contentType = data.getPackagePart().getContentType();
                html.append("<img alt=\"\" src=\"data:").append(contentType)
                        .append(";base64,")
                        .append(Base64.getEncoder().encodeToString(data.getData()))
                        .append("\"/>");
            } catch (Exception ignored) {
                // Si una imagen embebida esta danada, el resto de la HV aun se genera.
            }
        }
        String text = run.text();
        if (text == null || text.isEmpty()) return;
        html.append("<span style=\"");
        if (run.isBold()) html.append("font-weight:700;");
        if (run.isItalic()) html.append("font-style:italic;");
        if (run.getUnderline() != UnderlinePatterns.NONE) html.append("text-decoration:underline;");
        if (run.getColor() != null) html.append("color:#").append(escapeCss(run.getColor())).append(";");
        if (run.getFontFamily() != null) html.append("font-family:'").append(escapeCss(run.getFontFamily())).append("';");
        Double size = run.getFontSizeAsDouble();
        if (size != null && size > 0) html.append("font-size:").append(size).append("pt;");
        html.append("\">").append(escape(text).replace("\n", "<br/>")).append("</span>");
    }

    private static void renderTable(XWPFTable table, StringBuilder html) {
        html.append("<table>");
        for (var row : table.getRows()) {
            html.append("<tr>");
            for (XWPFTableCell cell : row.getTableCells()) {
                String color = cell.getColor();
                html.append("<td");
                if (color != null && !color.equalsIgnoreCase("auto")) {
                    html.append(" style=\"background:#").append(escapeCss(color)).append(";\"");
                }
                html.append(">");
                renderBodyElements(cell.getBodyElements(), html);
                html.append("</td>");
            }
            html.append("</tr>");
        }
        html.append("</table>");
    }

    private static Map<String, String> valores(Estudiante e,
                                               List<FormacionAdicional> formaciones,
                                               List<ExperienciaLaboral> experiencias) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("FULL_NAME", join(e.getNombre(), e.getApellido()));
        values.put("FIRST_NAME", nvl(e.getNombre()));
        values.put("LAST_NAME", nvl(e.getApellido()));
        values.put("EMAIL", nvl(e.getEmail()));
        values.put("PHONE", first(e.getCelular(), e.getTelefono()));
        values.put("CITY_COUNTRY", cityCountry(e));
        values.put("ADDRESS", nvl(e.getDireccion()));
        values.put("DOCUMENT_ID", join(e.getTipoDocumento(), e.getNumeroDocumento()));
        values.put("PROFESSIONAL_TITLE", first(e.getCargoObjetivo(), e.getTitulo(), e.getUltimoCargo()));
        values.put("PROFESSIONAL_SUMMARY", nvl(e.getPerfilProfesional()));
        values.put("SKILLS", nvl(e.getCompetencias()));
        values.put("LANGUAGES", nvl(e.getIdiomas()));
        values.put("EDUCATION", education(e, formaciones));
        values.put("EXPERIENCE", experience(experiencias));
        values.put("REFERENCES", nvl(e.getReferencias()));
        values.put("PROGRAM_NAME", e.getPrograma() != null ? nvl(e.getPrograma().getNombre()) : "");
        // Datos que ya estaban en la ficha pero no llegaban a las plantillas que
        // sube el equipo: una plantilla con {{LINKEDIN}} salia con el marcador
        // crudo impreso en el PDF.
        values.put("LINKEDIN_URL", nvl(e.getLinkedinUrl()));
        values.put("PORTFOLIO_URL", nvl(e.getCarpetaUrl()));
        values.put("ENGLISH_LEVEL", e.getNivelIngles() != null ? nvl(e.getNivelIngles().getNombre()) : "");
        values.put("OBJECTIVE_ROLE", nvl(e.getCargoObjetivo()));
        values.put("AVAILABILITY", first(e.getDisponibilidadLaboral(), e.getDisponibilidad()));
        return values;
    }

    private static Map<String, String> valoresMuestra() {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("FULL_NAME", "Andrea Martinez");
        values.put("FIRST_NAME", "Andrea");
        values.put("LAST_NAME", "Martinez");
        values.put("EMAIL", "andrea.martinez@ejemplo.com");
        values.put("PHONE", "+57 300 123 4567");
        values.put("CITY_COUNTRY", "Barranquilla - Colombia");
        values.put("ADDRESS", "Carrera 53 # 80-67");
        values.put("DOCUMENT_ID", "CC - 1.234.567.890");
        values.put("PROFESSIONAL_TITLE", "Analista de datos");
        values.put("PROFESSIONAL_SUMMARY",
                "Profesional orientada a resultados, con experiencia en analisis de informacion y mejora de procesos.");
        values.put("SKILLS", "Analisis de datos, Excel avanzado, Power BI, comunicacion efectiva");
        values.put("LANGUAGES", "Espanol nativo, Ingles B2");
        values.put("EDUCATION", "Profesional en Administracion - Universidad del Atlantico - 2023");
        values.put("EXPERIENCE",
                "Analista de datos - Empresa Ejemplo - 01/2024 - Actual\nConstruccion de tableros e indicadores.");
        values.put("REFERENCES", "Disponibles a solicitud");
        values.put("PROGRAM_NAME", "Programa de Empleabilidad CAC");
        values.put("LINKEDIN_URL", "https://www.linkedin.com/in/andrea-martinez");
        values.put("PORTFOLIO_URL", "https://portafolio.ejemplo.com/andrea");
        values.put("ENGLISH_LEVEL", "B2");
        values.put("OBJECTIVE_ROLE", "Analista de datos");
        values.put("AVAILABILITY", "Inmediata");
        return values;
    }

    private static String education(Estudiante e, List<FormacionAdicional> forms) {
        List<String> lines = new ArrayList<>();
        if (!nvl(e.getTitulo()).isBlank() || !nvl(e.getInstitucionEducativa()).isBlank()) {
            lines.add(join(e.getTitulo(), e.getInstitucionEducativa(), e.getNivelEducativo()));
        }
        if (forms != null) {
            for (var f : forms) {
                String dates = dates(f.getFechaInicio(), f.getFechaFin(), false);
                lines.add(join(f.getPrograma(), f.getInstitucion(), dates));
            }
        }
        return String.join("\n", lines);
    }

    private static String experience(List<ExperienciaLaboral> experiences) {
        if (experiences == null) return "";
        List<String> lines = new ArrayList<>();
        for (var x : experiences) {
            String head = join(x.getCargo(), x.getEmpresa(),
                    dates(x.getFechaInicio(), x.getFechaFin(), x.isActual()));
            String functions = nvl(x.getFunciones()).trim();
            lines.add(functions.isBlank() ? head : head + "\n" + functions);
        }
        return String.join("\n\n", lines);
    }

    private static String dates(LocalDate start, LocalDate end, boolean current) {
        String a = start != null ? DATE.format(start) : "";
        String b = end != null ? DATE.format(end) : (current ? "Actual" : "");
        return join(a, b);
    }

    private static String cityCountry(Estudiante e) {
        String city = nvl(e.getCiudad());
        String country = nvl(e.getNacionalidad());
        if (country.isBlank()) country = "Colombia";
        return join(city, country);
    }

    private static TemplateFormat detectarFormato(String filename, String contentType) {
        String name = filename == null ? "" : filename.toLowerCase(Locale.ROOT);
        String type = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        if (name.endsWith(".docx") || type.contains("wordprocessingml")) return TemplateFormat.DOCX;
        if (name.endsWith(".pdf") || type.equals("application/pdf")) return TemplateFormat.PDF;
        throw new BusinessException("Formato no compatible. Usa Word .docx o PDF.");
    }

    private static String canonical(String raw) {
        if (raw == null) return null;
        return FIELD_ALIASES.get(raw.trim().toUpperCase(Locale.ROOT));
    }

    private static String nvl(String value) {
        return value == null ? "" : value;
    }

    private static String first(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value.trim();
        return "";
    }

    private static String join(String... values) {
        List<String> clean = new ArrayList<>();
        for (String value : values) {
            if (value != null && !value.isBlank()) clean.add(value.trim());
        }
        return String.join(" - ", clean);
    }

    private static String joinNonBlank(String separator, String... values) {
        List<String> clean = new ArrayList<>();
        for (String value : values) {
            if (value != null && !value.isBlank()) clean.add(value.trim());
        }
        return String.join(separator, clean);
    }

    private static String normalizeText(String value) {
        String normalized = Normalizer.normalize(nvl(value), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return normalized.toUpperCase(Locale.ROOT);
    }

    private static boolean containsAny(String value, String... fragments) {
        for (String fragment : fragments) {
            if (value.contains(fragment)) return true;
        }
        return false;
    }

    private static String singleLine(String value) {
        return value == null ? "" : value.replaceAll("\\s*\\R\\s*", " | ").trim();
    }

    private static String escape(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private static String escapeCss(String value) {
        if (value == null) return "";
        return value.replaceAll("[^a-zA-Z0-9# ,.'_-]", "");
    }

    private static String mensaje(Exception ex) {
        String message = ex.getMessage();
        return message == null || message.isBlank() ? ex.getClass().getSimpleName() : message;
    }

    public enum TemplateFormat {
        DOCX("Word"), PDF("PDF");
        private final String label;
        TemplateFormat(String label) { this.label = label; }
        public String label() { return label; }
    }

    public record TemplateValidation(TemplateFormat format, Set<String> fields, String manifest) {}

    private record PdfPlaceholder(int pageIndex, String field, float x, float yTop,
                                  float width, float height, float fontSize) {}

    private static final class PlaceholderLocator extends PDFTextStripper {
        private final List<PdfPlaceholder> placeholders = new ArrayList<>();
        private int pageIndex = -1;

        private PlaceholderLocator() throws IOException {}

        @Override
        protected void startPage(PDPage page) throws IOException {
            pageIndex++;
            super.startPage(page);
        }

        @Override
        protected void writeString(String text, List<TextPosition> positions) throws IOException {
            Matcher matcher = PLACEHOLDER.matcher(text);
            while (matcher.find()) {
                String field = canonical(matcher.group(1));
                if (field == null || positions.isEmpty()) continue;
                int start = Math.min(matcher.start(), positions.size() - 1);
                int end = Math.min(Math.max(matcher.end() - 1, start), positions.size() - 1);
                TextPosition first = positions.get(start);
                TextPosition last = positions.get(end);
                float x = first.getXDirAdj();
                float width = Math.max(first.getWidthDirAdj(),
                        last.getXDirAdj() + last.getWidthDirAdj() - x);
                placeholders.add(new PdfPlaceholder(pageIndex, field, x,
                        first.getYDirAdj(), width, first.getHeightDir(),
                        first.getFontSizeInPt()));
            }
            super.writeString(text, positions);
        }
    }
}
