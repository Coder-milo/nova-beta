package com.novacrm.copiloto;

import com.novacrm.copiloto.CopilotoDtos.Audiencia;
import com.novacrm.copiloto.CopilotoDtos.Prioridad;
import com.novacrm.estudiante.EstadoEmpleabilidad;
import com.novacrm.postulacion.EstadoPostulacion;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MotorSiguienteAccionTest {

    private static final LocalDateTime AHORA = LocalDateTime.of(2026, 8, 20, 12, 0);

    @Test
    void priorizaEntrevistaPasadaYExplicaLosHechos() {
        var contexto = contexto(
                true, true, true,
                List.of(),
                List.of(postulacion(AHORA.minusDays(2), EstadoPostulacion.ENTREVISTA_AGENDADA)),
                0);

        var recomendacion = MotorSiguienteAccion.evaluar(
                contexto, Audiencia.ADMINISTRACION, AHORA).get(0);

        assertEquals("ENTREVISTA_SIN_CERRAR", recomendacion.codigo());
        assertEquals(Prioridad.ALTA, recomendacion.prioridad());
        assertTrue(recomendacion.evidencia().stream()
                .anyMatch(e -> e.codigo().equals("FECHA_ENTREVISTA")));
    }

    @Test
    void noExponeLaAccionInternaAlEstudiante() {
        var seguimiento = new MotorSiguienteAccion.SeguimientoDato(
                AHORA.toLocalDate().minusDays(10), "LLAMADA", "PENDIENTE",
                "Contactar a la empresa por información reservada", AHORA.toLocalDate().minusDays(3));
        var recomendacion = MotorSiguienteAccion.evaluar(
                contexto(true, true, true, List.of(seguimiento), List.of(), 0),
                Audiencia.ESTUDIANTE, AHORA).get(0);

        assertEquals("SEGUIMIENTO_VENCIDO", recomendacion.codigo());
        assertEquals("/mi-proceso", recomendacion.accion().ruta());
        assertFalse(recomendacion.texto().queDetectoEs().contains("empresa por información"));
        assertFalse(recomendacion.evidencia().stream()
                .anyMatch(e -> e.etiquetaEs().contains("información reservada")));
    }

    @Test
    void preparaUnaEntrevistaDentroDeCuarentaYOchoHoras() {
        var contexto = contexto(
                true, true, false,
                List.of(),
                List.of(postulacion(AHORA.plusHours(24), EstadoPostulacion.ENTREVISTA_AGENDADA)),
                0);

        var codigos = MotorSiguienteAccion.evaluar(
                contexto, Audiencia.ESTUDIANTE, AHORA).stream().map(r -> r.codigo()).toList();

        assertTrue(codigos.contains("ENTREVISTA_SIN_PREPARACION"));
    }

    @Test
    void cvFaltanteEsUnBloqueoPeroNoUnaPromesaDeContratacion() {
        var recomendacion = MotorSiguienteAccion.evaluar(
                contexto(false, true, false, List.of(), List.of(), 0),
                Audiencia.ESTUDIANTE, AHORA).get(0);

        assertEquals("CV_BLOQUEANTE", recomendacion.codigo());
        assertEquals(Prioridad.MEDIA, recomendacion.prioridad());
        assertFalse(recomendacion.texto().porQueImportaEs().toLowerCase().contains("probabilidad"));
    }

    @Test
    void perfilPreparadoSinPostulacionesRecomiendaOportunidadesReales() {
        var recomendaciones = MotorSiguienteAccion.evaluar(
                contexto(true, true, true, List.of(), List.of(), 3),
                Audiencia.ESTUDIANTE, AHORA);

        var recomendacion = recomendaciones.stream()
                .filter(r -> r.codigo().equals("PREPARADO_SIN_POSTULAR"))
                .findFirst().orElseThrow();
        assertEquals(Prioridad.ALTA, recomendacion.prioridad());
        assertTrue(recomendacion.evidencia().stream()
                .anyMatch(e -> e.codigo().equals("OPORTUNIDADES") && e.valor().equals("3")));
    }

    @Test
    void radarHablaDeRevisionPosibleYNoAfirmaLaCausa() {
        var postulaciones = java.util.stream.IntStream.range(0, 5)
                .mapToObj(i -> new MotorSiguienteAccion.PostulacionDato(
                        AHORA.toLocalDate().minusDays(i), EstadoPostulacion.ENVIADA,
                        null, "Cargo " + i, "Empresa"))
                .toList();
        var radar = MotorSiguienteAccion.evaluar(
                contexto(true, false, true, List.of(), postulaciones, 0),
                Audiencia.ADMINISTRACION, AHORA).stream()
                .filter(r -> r.codigo().startsWith("RADAR_"))
                .findFirst().orElseThrow();

        assertTrue(radar.texto().porQueImportaEs().contains("no demuestra una causa"));
    }

    private static MotorSiguienteAccion.Contexto contexto(
            boolean cv,
            boolean linkedin,
            boolean simulacro,
            List<MotorSiguienteAccion.SeguimientoDato> seguimientos,
            List<MotorSiguienteAccion.PostulacionDato> postulaciones,
            long oportunidades) {
        return new MotorSiguienteAccion.Contexto(
                UUID.fromString("4f587526-1aaf-4b17-9242-040450511111"),
                "Ana Pérez", EstadoEmpleabilidad.BUSCANDO,
                cv, linkedin, simulacro, 70, false,
                seguimientos, postulaciones, oportunidades,
                oportunidades > 0 ? new BigDecimal("86.50") : null);
    }

    private static MotorSiguienteAccion.PostulacionDato postulacion(
            LocalDateTime entrevista, EstadoPostulacion estado) {
        return new MotorSiguienteAccion.PostulacionDato(
                AHORA.toLocalDate().minusDays(20), estado, entrevista,
                "Backend Developer", "Empresa X");
    }
}
