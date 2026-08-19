package com.novacrm.hv;

import com.novacrm.hv.dto.DatosHvDto;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.*;

class ExtraccionHvServiceTest {

    @Test
    void extraeCamposYEstructuraDePdfSintetico() throws Exception {
        byte[] pdfBytes;
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            try (PDPageContentStream contents = new PDPageContentStream(doc, page)) {
                contents.beginText();
                contents.setFont(PDType1Font.HELVETICA_BOLD, 14);
                contents.newLineAtOffset(50, 700);
                contents.showText("Maria Fernanda Lopez");
                contents.setFont(PDType1Font.HELVETICA, 10);
                contents.newLineAtOffset(0, -15);
                contents.showText("Analista Financiera");
                contents.newLineAtOffset(0, -15);
                contents.showText("maria.lopez@example.com - 3009876543 - Bogota");
                contents.newLineAtOffset(0, -25);
                contents.showText("PERFIL PROFESIONAL");
                contents.newLineAtOffset(0, -15);
                contents.showText("Profesional en finanzas con 4 anos de experiencia en presupuestos y tesoreria.");
                contents.newLineAtOffset(0, -25);
                contents.showText("EXPERIENCIA LABORAL");
                contents.newLineAtOffset(0, -15);
                contents.showText("Analista Senior - Banco de Bogota");
                contents.newLineAtOffset(0, -15);
                contents.showText("2021 - Presente");
                contents.newLineAtOffset(0, -15);
                contents.showText("- Lidere la gestion de liquidez diario.");
                contents.endText();
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            pdfBytes = out.toByteArray();
        }

        MockMultipartFile file = new MockMultipartFile("archivo", "hoja.pdf", "application/pdf", pdfBytes);
        ExtraccionHvService service = new ExtraccionHvService();
        var resultado = service.extraer(file);

        assertNotNull(resultado);
        assertNotNull(resultado.datosEstructurados());

        DatosHvDto dto = resultado.datosEstructurados();
        assertEquals("maria.lopez@example.com", dto.email());
        assertEquals("3009876543", dto.celular());
        assertEquals("Bogotá", dto.ciudad());
        assertFalse(dto.experiencias().isEmpty(), "Debería extraer al menos una experiencia");
    }

    @Test
    void respuestaDeIaConDatosSeUsaSobreLasHeuristicas() throws Exception {
        var ia = new com.novacrm.ia.ClienteGroq("gsk-test", "modelo", 5_000) {
            @Override
            public java.util.Optional<com.fasterxml.jackson.databind.JsonNode> completarJson(String instrucciones, String contenido) {
                try {
                    return java.util.Optional.of(new com.fasterxml.jackson.databind.ObjectMapper().readTree("""
                            {"nombre": "Maria", "apellido": "Lopez", "cargoObjetivo": "CFO",
                             "email": "ia@example.com", "celular": "3110000000", "ciudad": "Cali",
                             "perfilProfesional": "Perfil desde la IA",
                             "experiencias": [], "formaciones": []}
                            """));
                } catch (Exception e) {
                    return java.util.Optional.empty();
                }
            }
        };
        var service = new ExtraccionHvService(ia);
        var resultado = service.extraer(pdfDe("Maria Fernanda Lopez", "maria.lopez@example.com"));

        assertEquals("ia@example.com", resultado.datosEstructurados().email());
        assertEquals("CFO", resultado.datosEstructurados().cargoObjetivo());
        assertEquals("Perfil desde la IA", resultado.datosEstructurados().perfilProfesional());
    }

    @Test
    void respuestaVaciaDeIaNoTumbaLasHeuristicas() throws Exception {
        var ia = new com.novacrm.ia.ClienteGroq("gsk-test", "modelo", 5_000) {
            @Override
            public java.util.Optional<com.fasterxml.jackson.databind.JsonNode> completarJson(String instrucciones, String contenido) {
                return java.util.Optional.empty();
            }
        };
        var service = new ExtraccionHvService(ia);
        var resultado = service.extraer(pdfDe("Maria Fernanda Lopez", "maria.lopez@example.com"));

        assertEquals("maria.lopez@example.com", resultado.datosEstructurados().email());
    }

    /**
     * Lo que sale del PDF alimenta un enlace, y quien lo construye antepone
     * "https://" a lo que reciba. Con el identificador suelto salia
     * {@code <a href="https://maria-lopez">}: un enlace roto en la hoja de vida
     * que esa persona manda a las empresas.
     */
    @Test
    void elPerfilDeLinkedinViajaComoDireccionCompleta() throws Exception {
        var resultado = new ExtraccionHvService()
                .extraer(pdfDe("Maria Fernanda Lopez", "linkedin.com/in/maria-lopez"));

        var dto = resultado.datosEstructurados();
        assertEquals("maria-lopez", dto.linkedinUserId(), "el identificador se queda como identificador");
        assertEquals("linkedin.com/in/maria-lopez", dto.linkedinUrl());
    }

    /**
     * El nivel educativo se imprime junto a la institucion —«SENA —
     * Profesional»—. Ponerlo fijo era afirmar una titulacion que nadie escribio
     * en el documento con el que alguien se presenta a un empleo.
     */
    @Test
    void elNivelEducativoNoSeInventa() throws Exception {
        var resultado = new ExtraccionHvService()
                .extraer(pdfDe("Maria Fernanda Lopez", "maria.lopez@example.com"));

        assertNull(resultado.datosEstructurados().nivelEducativo());
    }

    @Test
    void extraeCvEnInglesFormatoTecnico() throws Exception {
        byte[] pdfBytes;
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            try (PDPageContentStream contents = new PDPageContentStream(doc, page)) {
                contents.beginText();
                contents.setFont(PDType1Font.HELVETICA_BOLD, 14);
                contents.newLineAtOffset(50, 700);
                contents.showText("HECTOR LUIS SUAREZ ARROYO");
                contents.setFont(PDType1Font.HELVETICA, 10);
                contents.newLineAtOffset(0, -15);
                contents.showText("BACKEND DEVELOPER");
                contents.newLineAtOffset(0, -15);
                contents.showText("Soledad, Atlantico | hector.suarez.contac@gmail.com | https://github.com/TheHector2614");
                contents.newLineAtOffset(0, -25);
                contents.showText("SUMMARY");
                contents.newLineAtOffset(0, -15);
                contents.showText("Junior Backend Developer with hands-on experience building RESTful APIs using Java and Spring Boot.");
                contents.newLineAtOffset(0, -25);
                contents.showText("TECHNICAL SKILL");
                contents.newLineAtOffset(0, -15);
                contents.showText("Programming Languages: Java, Python, JavaScript");
                contents.newLineAtOffset(0, -15);
                contents.showText("Backend: Spring Boot, PostgreSQL, Git");
                contents.newLineAtOffset(0, -25);
                contents.showText("PROFESSIONAL EXPERIENCE");
                contents.newLineAtOffset(0, -15);
                contents.showText("Backend Developer - No Country Simulation Project 2025");
                contents.newLineAtOffset(0, -15);
                contents.showText("- Contributed to backend development and RESTful APIs.");
                contents.newLineAtOffset(0, -25);
                contents.showText("EDUCATION");
                contents.newLineAtOffset(0, -15);
                contents.showText("Bachelor's Degree in Social Sciences");
                contents.newLineAtOffset(0, -15);
                contents.showText("Universidad del Atlantico - 2025");
                contents.endText();
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            pdfBytes = out.toByteArray();
        }

        MockMultipartFile file = new MockMultipartFile("archivo", "hector_cv.pdf", "application/pdf", pdfBytes);
        ExtraccionHvService service = new ExtraccionHvService();
        var resultado = service.extraer(file);

        assertNotNull(resultado);
        var dto = resultado.datosEstructurados();
        assertEquals("Hector Luis", dto.nombre());
        assertEquals("Suarez Arroyo", dto.apellido());
        assertEquals("Backend Developer", dto.cargoObjetivo());
        assertEquals("hector.suarez.contac@gmail.com", dto.email());
        assertEquals("Soledad", dto.ciudad());
        assertTrue(dto.perfilProfesional().contains("Junior Backend Developer"));
        assertTrue(dto.competencias().contains("Java"));
        assertFalse(dto.experiencias().isEmpty(), "Debe extraer experiencia");
        assertEquals("Backend Developer", dto.experiencias().get(0).cargo());
        assertEquals("No Country Simulation Project", dto.experiencias().get(0).empresa());
        assertEquals("2025", dto.experiencias().get(0).fechaInicio());
        assertFalse(dto.formaciones().isEmpty(), "Debe extraer educacion");
    }

    private static MockMultipartFile pdfDe(String nombre, String email) throws Exception {
        byte[] pdfBytes;
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            try (PDPageContentStream contents = new PDPageContentStream(doc, page)) {
                contents.beginText();
                contents.setFont(PDType1Font.HELVETICA_BOLD, 14);
                contents.newLineAtOffset(50, 700);
                contents.showText(nombre);
                contents.setFont(PDType1Font.HELVETICA, 10);
                contents.newLineAtOffset(0, -15);
                contents.showText(email);
                contents.endText();
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            pdfBytes = out.toByteArray();
        }
        return new MockMultipartFile("archivo", "hoja.pdf", "application/pdf", pdfBytes);
    }
}
