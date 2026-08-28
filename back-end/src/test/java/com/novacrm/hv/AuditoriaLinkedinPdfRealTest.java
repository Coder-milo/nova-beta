package com.novacrm.hv;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.io.File;

class AuditoriaLinkedinPdfRealTest {

    @Test
    void probarPdfReal() throws Exception {
        File f = new File("C:/Users/HP 14/.gemini/antigravity/brain/6044e182-fd4f-436e-bc3a-1c0572fe9af9/.user_uploaded/media_1787635618102.pdf");
        if (!f.exists()) {
            System.out.println("Archivo no encontrado: " + f.getAbsolutePath());
            return;
        }

        try (PDDocument doc = PDDocument.load(f)) {
            PDFTextStripper stripper1 = new PDFTextStripper();
            stripper1.setSortByPosition(true);
            String textoConSort = stripper1.getText(doc);
            System.out.println("=== TEXTO CON SORT BY POSITION ===");
            System.out.println(textoConSort);

            PDFTextStripper stripper2 = new PDFTextStripper();
            stripper2.setSortByPosition(false);
            String textoSinSort = stripper2.getText(doc);
            System.out.println("=== TEXTO SIN SORT BY POSITION ===");
            System.out.println(textoSinSort);

            AuditoriaLinkedinService s = new AuditoriaLinkedinService();
            var resSinSort = s.auditarTexto(textoSinSort);
            System.out.println("=== RESULTADO SIN SORT ===");
            System.out.println("Puntos: " + resSinSort.puntuacion());
            System.out.println("Nivel: " + resSinSort.nivel());
            System.out.println("Optimizado: " + resSinSort.optimizado());
            for (var c : resSinSort.criterios()) {
                System.out.println("Criterio: " + c.clave() + " -> " + c.puntosObtenidos() + "/" + c.puntosMaximos() + " pts (" + c.cumplido() + ") - " + c.detalle());
            }
            System.out.println("Fortalezas: " + resSinSort.fortalezas());
            System.out.println("Recomendaciones: " + resSinSort.recomendaciones());
            System.out.println("Datos: " + resSinSort.datosExtraidos());
        }
    }
}
