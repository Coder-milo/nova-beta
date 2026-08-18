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
