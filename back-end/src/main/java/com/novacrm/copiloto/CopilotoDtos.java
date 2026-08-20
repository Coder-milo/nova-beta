package com.novacrm.copiloto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Contrato estable del Copiloto. No expone entidades ni notas internas. */
public final class CopilotoDtos {

    private CopilotoDtos() {
    }

    public enum Prioridad { ALTA, MEDIA, BAJA }
    public enum Categoria { SEGUIMIENTO, EMPLEABILIDAD, ENTREVISTA, HOJA_DE_VIDA, RADAR }
    public enum TipoAccion { SEGUIMIENTO, POSTULACIONES, PREPARACION, HOJA_DE_VIDA, OPORTUNIDADES }
    public enum Audiencia { ADMINISTRACION, ESTUDIANTE }

    /** Redaccion explicable, ya adaptada a la audiencia del endpoint. */
    public record Texto(
            String tituloEs,
            String tituloEn,
            String queDetectoEs,
            String queDetectoEn,
            String porQueImportaEs,
            String porQueImportaEn) {}

    /** Un hecho verificable utilizado por la regla. */
    public record Evidencia(
            String codigo,
            String valor,
            String etiquetaEs,
            String etiquetaEn) {}

    /** La ruta nunca ejecuta la accion sensible: lleva a la pantalla que la confirma. */
    public record Accion(
            TipoAccion tipo,
            String etiquetaEs,
            String etiquetaEn,
            String ruta) {}

    public record Recomendacion(
            String codigo,
            Prioridad prioridad,
            Categoria categoria,
            Texto texto,
            List<Evidencia> evidencia,
            Accion accion) {
        public Recomendacion {
            evidencia = evidencia == null ? List.of() : List.copyOf(evidencia);
        }
    }

    public record Respuesta(
            UUID estudianteId,
            Instant generadoEn,
            int totalSenales,
            List<Recomendacion> recomendaciones) {
        public Respuesta {
            recomendaciones = recomendaciones == null ? List.of() : List.copyOf(recomendaciones);
        }
    }

    public record PersonaPrioritaria(
            UUID estudianteId,
            String nombre,
            Prioridad prioridad,
            String motivoEs,
            String motivoEn,
            String ruta,
            int totalRecomendaciones) {}

    public record GrupoAccion(
            String codigo,
            Prioridad prioridad,
            String tituloEs,
            String tituloEn,
            int total,
            List<PersonaPrioritaria> estudiantes) {
        public GrupoAccion {
            estudiantes = estudiantes == null ? List.of() : List.copyOf(estudiantes);
        }
    }

    public record CentroAccion(
            Instant generadoEn,
            int estudiantesEvaluados,
            List<GrupoAccion> grupos,
            List<PersonaPrioritaria> ranking) {
        public CentroAccion {
            grupos = grupos == null ? List.of() : List.copyOf(grupos);
            ranking = ranking == null ? List.of() : List.copyOf(ranking);
        }
    }
}
