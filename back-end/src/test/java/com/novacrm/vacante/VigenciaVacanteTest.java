package com.novacrm.vacante;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Vigencia y cierre de una oferta.
 *
 * <p>La columna {@code fechaExpiracion} existia desde la primera version y no
 * la leia ninguna consulta: las ofertas caducadas se seguian recomendando y el
 * estudiante se postulaba a plazas que ya no existian.
 */
class VigenciaVacanteTest {

    private static final LocalDateTime AHORA = LocalDateTime.of(2026, 7, 26, 12, 0);

    private Vacante vacante(LocalDateTime expiracion, boolean activa) {
        var v = new Vacante();
        v.setTitulo("Bilingual CSR");
        v.setFechaExpiracion(expiracion);
        v.setActivo(activa);
        return v;
    }

    @Test
    void unaOfertaSinFechaDeExpiracionSigueVigente() {
        assertTrue(vacante(null, true).estaVigente(AHORA));
    }

    @Test
    void unaOfertaConFechaFuturaSigueVigente() {
        assertTrue(vacante(AHORA.plusDays(5), true).estaVigente(AHORA));
    }

    @Test
    void unaOfertaVencidaYaNoEstaVigente() {
        assertFalse(vacante(AHORA.minusDays(1), true).estaVigente(AHORA),
                "aunque siga marcada como activa, su fecha ya paso");
    }

    @Test
    void unaOfertaCerradaNoEstaVigenteAunqueNoHayaVencido() {
        assertFalse(vacante(AHORA.plusDays(30), false).estaVigente(AHORA));
    }

    @Test
    void cerrarDejaConstanciaDelMotivoYLaFecha() {
        var v = vacante(null, true);

        v.cerrar(MotivoCierre.CUBIERTA, AHORA);

        assertFalse(v.isActivo());
        assertEquals(MotivoCierre.CUBIERTA, v.getMotivoCierre());
        assertEquals(AHORA, v.getFechaCierre());
        assertFalse(v.estaVigente(AHORA));
    }

    /**
     * Distinguir el motivo es lo que permite saber despues si el programa
     * llego tarde a la oferta o si la plaza efectivamente se cubrio.
     */
    @Test
    void elMotivoDistingueVencimientoDePlazaCubierta() {
        var vencida = vacante(AHORA.minusDays(1), true);
        var cubierta = vacante(null, true);

        vencida.cerrar(MotivoCierre.EXPIRADA, AHORA);
        cubierta.cerrar(MotivoCierre.CUBIERTA, AHORA);

        assertNotEquals(vencida.getMotivoCierre(), cubierta.getMotivoCierre());
    }

    @Test
    void justoEnElInstanteDeExpiracionYaNoEstaVigente() {
        assertFalse(vacante(AHORA, true).estaVigente(AHORA),
                "la vigencia termina al llegar la fecha, no despues");
    }
}
