package com.novacrm.pipeline;

import java.util.List;
import java.util.UUID;

/**
 * Estado de empleabilidad de un estudiante, calculado a partir de los hechos
 * registrados en el sistema. Es un modelo de solo lectura: no se persiste ni se
 * edita, se recalcula en cada consulta.
 *
 * @param hvGenerada          tiene hoja de vida vigente
 * @param linkedinOptimizado  tiene perfil de LinkedIn vinculado
 * @param simulacroRealizado  tiene un simulacro de entrevista completado
 * @param postulacionesEnviadas postulaciones efectivamente enviadas
 * @param empresasContactadas empresas distintas alcanzadas
 * @param etapa               etapa deducida del embudo
 * @param porcentajeAvance    avance sobre los hitos de preparacion (0-100)
 * @param pendientes          hitos de preparacion que faltan
 */
public record PipelineEmpleabilidad(
        UUID estudianteId,
        String nombreCompleto,
        boolean hvGenerada,
        boolean linkedinOptimizado,
        boolean simulacroRealizado,
        long postulacionesEnviadas,
        long empresasContactadas,
        EtapaEmpleabilidad etapa,
        int porcentajeAvance,
        List<String> pendientes,
        String proximaAccion) {

    /** Hitos de preparacion que se ponderan en {@link #porcentajeAvance()}. */
    public static final int TOTAL_HITOS_PREPARACION = 3;

    public PipelineEmpleabilidad {
        pendientes = pendientes == null ? List.of() : List.copyOf(pendientes);
    }
}
