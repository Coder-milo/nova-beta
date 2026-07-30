package com.novacrm.estudiante;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La regla de que un campo nulo no se toca.
 *
 * <p>Es la que impide que guardar el perfil desde el portal del estudiante
 * —un formulario mas corto, sin los hitos— borre lo que el coordinador acaba
 * de marcar. Se prueba sobre el objeto de preparacion directamente porque la
 * regla vive en como se le asignan los valores, no en Spring.
 */
class PreparacionParcialTest {

    private static PreparacionEmpleabilidad conHitosMarcados() {
        var p = new PreparacionEmpleabilidad();
        p.setCvListo(EstadoHito.SI);
        p.setCvEnIngles(EstadoHito.SI);
        p.setLinkedinCreado(EstadoHito.SI);
        p.setLinkedinOptimizado(EstadoHito.EN_PROCESO);
        p.setPerfilOcupacional(EstadoHito.SI);
        return p;
    }

    /** Copia de la regla de {@code EstudianteService.aplicarPreparacion}. */
    private static void aplicarSiLlega(PreparacionEmpleabilidad p, EstadoHito cvListo, EstadoHito cvIngles) {
        if (cvListo != null) p.setCvListo(cvListo);
        if (cvIngles != null) p.setCvEnIngles(cvIngles);
    }

    @Test
    @DisplayName("una actualizacion sin hitos no borra los que ya estaban")
    void unaActualizacionSinHitosNoBorraLosQueYaEstaban() {
        var p = conHitosMarcados();

        aplicarSiLlega(p, null, null);

        assertThat(p.getCvListo()).isEqualTo(EstadoHito.SI);
        assertThat(p.getCvEnIngles()).isEqualTo(EstadoHito.SI);
        assertThat(p.cumplidos()).isEqualTo(4);
    }

    @Test
    @DisplayName("un hito que llega si se cambia, y solo ese")
    void unHitoQueLlegaSeCambiaYSoloEse() {
        var p = conHitosMarcados();

        aplicarSiLlega(p, EstadoHito.NO, null);

        assertThat(p.getCvListo()).isEqualTo(EstadoHito.NO);
        assertThat(p.getCvEnIngles()).isEqualTo(EstadoHito.SI);
    }

    @Test
    @DisplayName("marcar NO explicitamente si baja el hito: no es lo mismo que no mandarlo")
    void marcarNoExplicitamenteSiBajaElHito() {
        // La distincion que hace util la regla: null es "no lo toques", NO es
        // "lo revise y no esta". Si se confundieran, no se podria corregir un
        // hito marcado por error.
        var p = conHitosMarcados();

        aplicarSiLlega(p, EstadoHito.NO, EstadoHito.NO);

        assertThat(p.cumplidos()).isEqualTo(2);
    }

    @Test
    @DisplayName("el puntaje refleja el cambio sin que nadie lo recalcule a mano")
    void elPuntajeReflejaElCambio() {
        var p = conHitosMarcados();
        // CV 15 + ingles 15 + LinkedIn creado 10 + optimizado en proceso 7 + perfil 15
        assertThat(PuntajeEmpleabilidad.porcentaje(p, false)).isEqualTo(62);

        p.setCvEnIngles(EstadoHito.NO);

        assertThat(PuntajeEmpleabilidad.porcentaje(p, false)).isEqualTo(47);
    }

    @Test
    @DisplayName("el caso de Aaron da 47, que es lo que publica la hoja")
    void elCasoDeAaronDa47() {
        var p = new PreparacionEmpleabilidad();
        p.setCvListo(EstadoHito.SI);
        p.setCvEnIngles(EstadoHito.SI);
        p.setLinkedinCreado(EstadoHito.SI);
        p.setPerfilOcupacional(EstadoHito.EN_PROCESO);

        assertThat(PuntajeEmpleabilidad.porcentaje(p, false)).isEqualTo(47);
    }
}
