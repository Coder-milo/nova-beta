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
}
