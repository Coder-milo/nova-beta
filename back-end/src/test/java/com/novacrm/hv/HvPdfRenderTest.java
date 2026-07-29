package com.novacrm.hv;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.perfil.ExperienciaLaboral;
import com.novacrm.perfil.FormacionAdicional;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Render de humo de la plantilla ATS CAC: genera el PDF con datos de ejemplo
 * y exporta la página 1 a PNG en target/hv-preview para inspección visual.
 */
class HvPdfRenderTest {

    @Test
    void generaPdfConPlantillaCompleta() throws Exception {
        var e = new Estudiante();
        e.setNombre("Camila");
        e.setApellido("Carbonell Pérez");
        e.setCargoObjetivo("Analista de Datos");
        e.setCiudad("Barranquilla");
        e.setCelular("+57 300 123 4567");
        e.setEmail("camila.carbonell@email.com");
        e.setLinkedinUserId("camila-carbonell");
        e.setPerfilProfesional("Profesional en ingeniería de sistemas con 3 años de experiencia en análisis de datos; "
                + "certificada en Power BI. Experiencia complementaria en automatización de reportes financieros. "
                + "Enfocada en decisiones basadas en datos y mejora continua.");
        e.setTitulo("Ingeniería de Sistemas");
        e.setInstitucionEducativa("Universidad del Norte");
        e.setNivelEducativo("Profesional");
        e.setCompetencias("Tools: Excel avanzado, Power BI, SQL\nAnálisis: Modelado de datos, ETL, dashboards\nSoft skills: Liderazgo, comunicación, trabajo en equipo");
        e.setIdiomas("Español (Nativo)  |  Inglés B2 (TOEFL 92, 2024)");

        var exp1 = new ExperienciaLaboral();
        exp1.setCargo("Analista de Datos Junior");
        exp1.setEmpresa("Tecnoglass, Barranquilla");
        exp1.setFechaInicio(LocalDate.of(2023, 2, 1));
        exp1.setActual(true);
        exp1.setFunciones("Construí dashboards en Power BI que redujeron 40% el tiempo de reporte mensual.\nAutomaticé procesos ETL para 12 fuentes de datos con SQL y Python.\nApoyé la migración del data warehouse corporativo.");

        var exp2 = new ExperienciaLaboral();
        exp2.setCargo("Practicante de Analítica");
        exp2.setEmpresa("Promigas, Barranquilla");
        exp2.setFechaInicio(LocalDate.of(2022, 1, 15));
        exp2.setFechaFin(LocalDate.of(2022, 12, 20));
        exp2.setFunciones("Depuré y consolidé bases de clientes (150k registros).\nGeneré reportes semanales para la gerencia comercial.");

        var f1 = new FormacionAdicional();
        f1.setTipo("DIPLOMADO");
        f1.setPrograma("Diplomado en Ciencia de Datos");
        f1.setInstitucion("Universidad de los Andes");
        f1.setFechaFin(LocalDate.of(2024, 6, 1));

        var c1 = new FormacionAdicional();
        c1.setTipo("CERTIFICACION");
        c1.setPrograma("Microsoft Certified: Power BI Data Analyst");
        c1.setInstitucion("Microsoft");
        c1.setFechaFin(LocalDate.of(2024, 3, 1));

        var c2 = new FormacionAdicional();
        c2.setTipo("CURSO");
        c2.setPrograma("SQL for Data Analysis");
        c2.setInstitucion("Coursera");
        c2.setFechaFin(LocalDate.of(2023, 8, 1));

        var pdfService = new HvPdfService(new HvTemplateService());
        byte[] pdf = pdfService.generar(e, List.of(f1, c1, c2), List.of(exp1, exp2), "#1C315E");
        assertTrue(pdf.length > 5000, "El PDF debería tener contenido");

        Path dir = Path.of("target", "hv-preview");
        Files.createDirectories(dir);
        Files.write(dir.resolve("hv-ejemplo.pdf"), pdf);

        try (var doc = PDDocument.load(pdf)) {
            var renderer = new PDFRenderer(doc);
            for (int i = 0; i < doc.getNumberOfPages(); i++) {
                var img = renderer.renderImageWithDPI(i, 110);
                ImageIO.write(img, "PNG", dir.resolve("hv-ejemplo-p" + (i + 1) + ".png").toFile());
            }
        }
    }

    @Test
    void generaPdfEnInglesYExclusiones() throws Exception {
        var e = new Estudiante();
        e.setNombre("Carlos");
        e.setApellido("Mendoza");
        e.setCargoObjetivo("Software Engineer");
        e.setEmail("carlos@example.com");
        e.setPerfilProfesional("Experienced developer specializing in Java and Spring Boot.");

        var templateService = new HvTemplateService();
        var pdfService = new HvPdfService(templateService);

        byte[] pdfEn = pdfService.generar(e, List.of(), List.of(), "#1C315E", "en", List.of("LANGUAGES"), List.of("PHONE"));
        assertTrue(pdfEn.length > 2000, "El PDF en inglés debería generarse con éxito");

        String htmlEn = templateService.renderizar(e, List.of(), List.of(), "en", List.of("LANGUAGES"), List.of("PHONE"));
        assertTrue(htmlEn.contains("Professional Summary"), "Debería contener el título en inglés 'Professional Summary'");
    }

    @Test
    void aceptaEntidadesHtmlComunesEnPlantillasWord() {
        var pdfService = new HvPdfService(new HvTemplateService());
        byte[] pdf = pdfService.renderizarHtmlAPdf("""
                <!DOCTYPE html>
                <html><head><meta charset="UTF-8"/></head>
                <body><p>&bull;&nbsp;Experiencia profesional</p></body></html>
                """);

        assertTrue(pdf.length > 1000, "La entidad nbsp no debe impedir la generación del PDF");
        assertTrue(new String(pdf, 0, 4, java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF"),
                "La salida debe ser un PDF válido");
    }
}
