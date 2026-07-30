package com.novacrm.hv;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.perfil.ExperienciaLaboral;
import com.novacrm.perfil.FormacionAdicional;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La foto del estudiante dentro del PDF.
 *
 * <p>Los tests de render que ya existían pasaban {@code null} como foto, así que
 * comprobaban que la plantilla «Clásico con foto» genera un PDF, no que la foto
 * llegue a él. Es justo el fallo que no se ve: el documento sale bien formado y
 * con el hueco vacío, y solo abriéndolo se nota.
 *
 * <p>Aquí se cuenta la imagen incrustada en el PDF con PDFBox, que es lo único
 * que demuestra que el {@code <img>} sobrevivió al render de openhtmltopdf.
 */
class FotoEnHojaDeVidaTest {

    private final HvTemplateService templateService = new HvTemplateService();
    private final HvPdfService pdfService = new HvPdfService(templateService);

    /** Un JPEG real y diminuto; sirve para que ImageIO lo decodifique de verdad. */
    private static String fotoDeEjemploBase64() throws Exception {
        BufferedImage img = new BufferedImage(250, 250, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(0x2A, 0x5C, 0x8A));
        g.fillRect(0, 0, 250, 250);
        g.setColor(Color.WHITE);
        g.fillOval(85, 45, 80, 80);
        g.fillOval(55, 140, 140, 110);
        g.dispose();

        var salida = new ByteArrayOutputStream();
        ImageIO.write(img, "jpg", salida);
        return Base64.getEncoder().encodeToString(salida.toByteArray());
    }

    private static Estudiante estudiante() {
        var e = new Estudiante();
        e.setNombre("Andrea");
        e.setApellido("Martínez");
        e.setCargoObjetivo("Analista de Datos");
        e.setCiudad("Barranquilla");
        e.setNacionalidad("Colombia");
        e.setCelular("+57 300 123 4567");
        e.setEmail("andrea.martinez@ejemplo.com");
        e.setLinkedinUrl("https://www.linkedin.com/in/andrea-martinez");
        e.setPerfilProfesional("Profesional orientada a resultados, con experiencia en análisis de información.");
        e.setCompetencias("Excel avanzado, Power BI, SQL");
        e.setIdiomas("Español, Inglés B2");
        e.setTitulo("Administración de Empresas");
        e.setInstitucionEducativa("Universidad del Atlántico");
        e.setNivelEducativo("Profesional");
        return e;
    }

    private static List<FormacionAdicional> formaciones() {
        var f = new FormacionAdicional();
        f.setTipo("CERTIFICACION");
        f.setPrograma("Power BI Data Analyst");
        f.setInstitucion("Microsoft");
        f.setFechaFin(LocalDate.of(2025, 1, 15));
        return List.of(f);
    }

    private static List<ExperienciaLaboral> experiencias() {
        var x = new ExperienciaLaboral();
        x.setCargo("Analista de Datos");
        x.setEmpresa("Empresa Ejemplo");
        x.setCiudad("Barranquilla");
        x.setFechaInicio(LocalDate.of(2024, 1, 1));
        x.setActual(true);
        x.setFunciones("Construcción de tableros e indicadores.");
        return List.of(x);
    }

    /** Imágenes incrustadas en el PDF, recorriendo los recursos de cada página. */
    private static int contarImagenes(byte[] pdf) throws Exception {
        try (PDDocument doc = PDDocument.load(pdf)) {
            int total = 0;
            for (var pagina : doc.getPages()) {
                var recursos = pagina.getResources();
                if (recursos == null) continue;
                for (var nombre : recursos.getXObjectNames()) {
                    PDXObject xo = recursos.getXObject(nombre);
                    if (xo instanceof PDImageXObject) total++;
                }
            }
            return total;
        }
    }

    @Test
    @DisplayName("el diseño con foto incrusta la imagen en el PDF")
    void clasicoConFotoLlevaLaImagenDentro() throws Exception {
        byte[] pdf = pdfService.generar(estudiante(), formaciones(), experiencias(),
                "#2A5C8A", "es", null, null, fotoDeEjemploBase64(), "CLASICO_FOTO");

        assertThat(contarImagenes(pdf))
                .as("el PDF del diseño «Clásico con foto» debe llevar la foto incrustada")
                .isGreaterThanOrEqualTo(1);

        // Se exporta a PNG para poder mirarlo: un PDF con la imagen presente
        // pero fuera de sitio pasaría igual la comprobación de arriba.
        Path dir = Path.of("target", "hv-preview");
        Files.createDirectories(dir);
        Files.write(dir.resolve("hv-clasico-con-foto.pdf"), pdf);
        try (var doc = PDDocument.load(pdf)) {
            var img = new PDFRenderer(doc).renderImageWithDPI(0, 110);
            ImageIO.write(img, "PNG", dir.resolve("hv-clasico-con-foto.png").toFile());
        }
    }

    @Test
    @DisplayName("sin foto, el diseño con foto no deja hueco ni marcador crudo")
    void clasicoSinFotoDegradaLimpio() {
        String html = templateService.renderizar(estudiante(), formaciones(), experiencias(),
                "es", null, null, null, "CLASICO_FOTO");

        assertThat(html).doesNotContain("{{PHOTO_CONTAINER}}", "{{", "}}");
        assertThat(html).doesNotContain("<img");
        assertThat(html).contains("Andrea Martínez");
    }

    @Test
    @DisplayName("los diseños sin foto la ignoran aunque el estudiante tenga una")
    void disenosSinFotoNoLaPintan() throws Exception {
        String foto = fotoDeEjemploBase64();

        for (String codigo : List.of("CAC_ATS", "MODERNO")) {
            String html = templateService.renderizar(estudiante(), formaciones(), experiencias(),
                    "es", null, null, foto, codigo);
            assertThat(html)
                    .as("el diseño %s no declara marcador de foto, así que no debe pintarla", codigo)
                    .doesNotContain("<img");
            assertThat(html).doesNotContain("{{", "}}");
        }
    }

    @Test
    @DisplayName("los tres diseños generan PDF válido en español y en inglés")
    void losTresDisenosRenderizanEnAmbosIdiomas() throws Exception {
        String foto = fotoDeEjemploBase64();

        for (String codigo : List.of("CAC_ATS", "CLASICO_FOTO", "MODERNO")) {
            for (String idioma : List.of("es", "en")) {
                byte[] pdf = pdfService.generar(estudiante(), formaciones(), experiencias(),
                        "#1F4E79", idioma, null, null, foto, codigo);

                assertThat(new String(pdf, 0, 4, java.nio.charset.StandardCharsets.US_ASCII))
                        .as("%s/%s debe ser un PDF válido", codigo, idioma)
                        .isEqualTo("%PDF");
                assertThat(pdf.length)
                        .as("%s/%s debe tener contenido", codigo, idioma)
                        .isGreaterThan(2000);
            }
        }
    }

    @Test
    @DisplayName("las secciones excluidas se respetan en los tres diseños")
    void exclusionesEnLosTresDisenos() throws Exception {
        String foto = fotoDeEjemploBase64();

        for (String codigo : List.of("CAC_ATS", "CLASICO_FOTO", "MODERNO")) {
            String html = templateService.renderizar(estudiante(), formaciones(), experiencias(),
                    "es", List.of("LANGUAGES"), List.of("PHONE"), foto, codigo);

            assertThat(html)
                    .as("%s debe respetar el campo excluido", codigo)
                    .doesNotContain("+57 300 123 4567");
            assertThat(html)
                    .as("%s debe respetar la sección excluida", codigo)
                    .doesNotContain("Inglés B2");
        }
    }
}
