package com.novacrm.hv.dto;

import java.util.List;

/**
 * Resultado completo del diagnóstico y auditoría ATS de un perfil de LinkedIn exportado en PDF.
 *
 * @param puntuacion Puntuación global del 0 al 100 basada en los pilares de optimización.
 * @param nivel Clasificación de calidad ("Básico", "Intermedio", "Avanzado", "Estelar / All-Star").
 * @param optimizado Verdadero si la puntuación alcanza o supera el umbral institucional (>= 70).
 * @param criterios Desglose detallado por cada pilar de optimización evaluado.
 * @param fortalezas Aspectos sobresalientes encontrados en el perfil.
 * @param recomendaciones Sugerencias accionables para maximizar visibilidad ante reclutadores.
 * @param datosExtraidos Información estructurada lista para previsualizar o sincronizar con la ficha del CRM.
 */
public record AuditoriaLinkedinDto(
        int puntuacion,
        String nivel,
        boolean optimizado,
        List<CriterioAuditoriaDto> criterios,
        List<String> fortalezas,
        List<String> recomendaciones,
        DatosHvDto datosExtraidos
) {
    public record CriterioAuditoriaDto(
            String clave,
            String titulo,
            boolean cumplido,
            int puntosObtenidos,
            int puntosMaximos,
            String detalle,
            String sugerencia
    ) {}
}
