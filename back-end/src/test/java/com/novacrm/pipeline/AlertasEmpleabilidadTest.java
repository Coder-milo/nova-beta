package com.novacrm.pipeline;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.seguimiento.Seguimiento;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Avisos por compromisos de seguimiento vencidos.
 *
 * <p>Los campos {@code proximaAccion} y {@code fechaProxima} existian desde el
 * principio y nada los leia: se anotaba el compromiso y nadie avisaba al
 * pasarse la fecha.
 */
class AlertasEmpleabilidadTest {

    private static final LocalDate HOY = LocalDate.of(2026, 7, 26);

    private Seguimiento seguimiento(String nombre, LocalDate fechaProxima,
                                    String estado, String proximaAccion) {
        var estudiante = new Estudiante();
        estudiante.setId(UUID.randomUUID());
        estudiante.setNombre(nombre);
        estudiante.setApellido("Perez");

        var s = new Seguimiento();
        s.setEstudiante(estudiante);
        s.setFechaProxima(fechaProxima);
        s.setEstado(estado);
        s.setProximaAccion(proximaAccion);
        return s;
    }

    @Test
    void avisaDeUnCompromisoVencido() {
        var vencido = seguimiento("Ana", HOY.minusDays(3), "PENDIENTE", "Enviar HV corregida");

        var avisos = AlertasEmpleabilidad.porSeguimientosVencidos(List.of(vencido), HOY);

        assertEquals(1, avisos.size());
        var aviso = avisos.get(0);
        assertEquals("SEGUIMIENTO_VENCIDO", aviso.tipo());
        assertTrue(aviso.titulo().contains("Ana Perez"));
        assertTrue(aviso.detalle().contains("Enviar HV corregida"));
        assertTrue(aviso.detalle().contains("3 dia"));
    }

    @Test
    void unCompromisoConFechaFuturaNoGeneraAviso() {
        var futuro = seguimiento("Luis", HOY.plusDays(2), "PENDIENTE", "Llamar");

        assertTrue(AlertasEmpleabilidad.porSeguimientosVencidos(List.of(futuro), HOY).isEmpty());
    }

    @Test
    void elDeHoyTodaviaNoEstaVencido() {
        var hoy = seguimiento("Luis", HOY, "PENDIENTE", "Llamar");

        assertTrue(AlertasEmpleabilidad.porSeguimientosVencidos(List.of(hoy), HOY).isEmpty(),
                "vence al terminar el dia, no al empezarlo");
    }

    /** A partir de una semana de retraso el aviso sube de severidad. */
    @Test
    void elRetrasoLargoSubeLaSeveridad() {
        var reciente = seguimiento("Ana", HOY.minusDays(2), "PENDIENTE", "Llamar");
        var antiguo = seguimiento("Luis", HOY.minusDays(20), "PENDIENTE", "Llamar");

        assertEquals("MEDIA",
                AlertasEmpleabilidad.porSeguimientosVencidos(List.of(reciente), HOY).get(0).severidad());
        assertEquals("ALTA",
                AlertasEmpleabilidad.porSeguimientosVencidos(List.of(antiguo), HOY).get(0).severidad());
    }

    @Test
    void elAvisoApuntaAlEstudiante() {
        var vencido = seguimiento("Ana", HOY.minusDays(1), "PENDIENTE", "Llamar");

        var aviso = AlertasEmpleabilidad.porSeguimientosVencidos(List.of(vencido), HOY).get(0);

        assertEquals(vencido.getEstudiante().getId().toString(), aviso.referenciaId());
        assertTrue(aviso.ruta().startsWith("/estudiantes/"));
    }

    @Test
    void toleraUnSeguimientoSinProximaAccion() {
        var vencido = seguimiento("Ana", HOY.minusDays(1), "PENDIENTE", null);

        var aviso = AlertasEmpleabilidad.porSeguimientosVencidos(List.of(vencido), HOY).get(0);

        assertTrue(aviso.detalle().contains("seguimiento pendiente"));
    }

    @Test
    void ignoraLosQueNoTienenFechaProxima() {
        var sinFecha = seguimiento("Ana", null, "PENDIENTE", "Llamar");

        assertTrue(AlertasEmpleabilidad.porSeguimientosVencidos(List.of(sinFecha), HOY).isEmpty());
    }
}
