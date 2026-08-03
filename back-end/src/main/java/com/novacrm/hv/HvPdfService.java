package com.novacrm.hv;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.perfil.ExperienciaLaboral;
import com.novacrm.perfil.FormacionAdicional;
import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;

/**
 * Genera el PDF de la hoja de vida usando la plantilla CAC ATS flat HTML.
 * La "plantilla" heredada solo influye en la selección visual (color primario
 * se ignora porque la CAC es fija).
 */
@Service
public class HvPdfService {

    private final HvTemplateService templateService;

    public HvPdfService(HvTemplateService templateService) {
        this.templateService = templateService;
    }

    public byte[] generar(Estudiante e, List<FormacionAdicional> formaciones,
                          List<ExperienciaLaboral> experiencias, String colorPrimario) {
        return generar(e, formaciones, experiencias, colorPrimario, "es", null, null, null, null);
    }

    public byte[] generar(Estudiante e, List<FormacionAdicional> formaciones,
                          List<ExperienciaLaboral> experiencias, String colorPrimario,
                          String idioma, java.util.Collection<String> seccionesExcluidas,
                          java.util.Collection<String> camposExcluidos) {
        return generar(e, formaciones, experiencias, colorPrimario, idioma, seccionesExcluidas, camposExcluidos, null, null);
    }

    public byte[] generar(Estudiante e, List<FormacionAdicional> formaciones,
                          List<ExperienciaLaboral> experiencias, String colorPrimario,
                          String idioma, java.util.Collection<String> seccionesExcluidas,
                          java.util.Collection<String> camposExcluidos,
                          String fotoBase64, String codigoPlantilla) {
        String html = templateService.renderizar(e, formaciones, experiencias, idioma, seccionesExcluidas, camposExcluidos, fotoBase64, codigoPlantilla);
        return renderizarHtmlAPdf(html);
    }

    public byte[] generar(com.novacrm.hv.dto.DatosHvDto datos, String colorPrimario,
                          String idioma, java.util.Collection<String> seccionesExcluidas,
                          java.util.Collection<String> camposExcluidos) {
        return generar(datos, colorPrimario, idioma, seccionesExcluidas, camposExcluidos, null, null);
    }

    public byte[] generar(com.novacrm.hv.dto.DatosHvDto datos, String colorPrimario,
                          String idioma, java.util.Collection<String> seccionesExcluidas,
                          java.util.Collection<String> camposExcluidos,
                          String fotoBase64, String codigoPlantilla) {
        String html = templateService.renderizar(datos, idioma, seccionesExcluidas, camposExcluidos, fotoBase64, codigoPlantilla);
        return renderizarHtmlAPdf(html);
    }

    public byte[] renderizarHtmlAPdf(String html) {
        try (var out = new ByteArrayOutputStream()) {
            var builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.useFont(() -> fuente("Carlito-Regular.ttf"), "Carlito", 400,
                    BaseRendererBuilder.FontStyle.NORMAL, true);
            builder.useFont(() -> fuente("Carlito-Bold.ttf"), "Carlito", 700,
                    BaseRendererBuilder.FontStyle.NORMAL, true);
            builder.withHtmlContent(normalizarXhtml(html), null);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("Error generando el PDF: " + ex.getMessage(), ex);
        }
    }

    /**
     * OpenHTMLtoPDF procesa el contenido como XML. Normalizamos las entidades
     * HTML habituales que no forman parte de las cinco entidades nativas de XML
     * para que documentos importados desde Word no rompan la conversión.
     */
    private static String normalizarXhtml(String html) {
        if (html == null) return "";
        return html
                .replace("&nbsp;", "&#160;")
                .replace("&ensp;", "&#8194;")
                .replace("&emsp;", "&#8195;")
                .replace("&bull;", "&#8226;");
    }

    private static InputStream fuente(String archivo) {
        try {
            return new ClassPathResource("templates/hv/fonts/" + archivo).getInputStream();
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo cargar la fuente " + archivo, e);
        }
    }
}
