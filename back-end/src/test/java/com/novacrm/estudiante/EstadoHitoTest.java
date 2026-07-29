package com.novacrm.estudiante;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La lectura de los hitos tal y como los escribe la hoja de seguimiento, que es
 * de donde van a llegar los 107 participantes.
 */
class EstadoHitoTest {

    @Test
    @DisplayName("lee el si con tilde, que es como esta escrito en la hoja")
    void leeElSiConTilde() {
        assertThat(EstadoHito.desde("Sí")).isEqualTo(EstadoHito.SI);
        assertThat(EstadoHito.desde("sí")).isEqualTo(EstadoHito.SI);
        assertThat(EstadoHito.desde("Si")).isEqualTo(EstadoHito.SI);
    }

    @Test
    @DisplayName("reconoce en proceso, que es un estado real y no un si a medias")
    void reconoceEnProceso() {
        assertThat(EstadoHito.desde("En proceso")).isEqualTo(EstadoHito.EN_PROCESO);
        assertThat(EstadoHito.desde("  EN PROCESO  ")).isEqualTo(EstadoHito.EN_PROCESO);
    }

    @Test
    @DisplayName("una celda vacia significa que no, igual que en la hoja")
    void unaCeldaVaciaSignificaQueNo() {
        assertThat(EstadoHito.desde(null)).isEqualTo(EstadoHito.NO);
        assertThat(EstadoHito.desde("")).isEqualTo(EstadoHito.NO);
        assertThat(EstadoHito.desde("   ")).isEqualTo(EstadoHito.NO);
    }

    @Test
    @DisplayName("un valor que no se reconoce no revienta la importacion")
    void unValorQueNoSeReconoceNoRevienta() {
        // Son 107 filas escritas a mano durante meses; una celda rara no puede
        // tumbar la importacion entera.
        assertThat(EstadoHito.desde("pendiente de revisar")).isEqualTo(EstadoHito.NO);
    }

    @Test
    @DisplayName("solo el si cuenta como hito cumplido")
    void soloElSiCuentaComoCumplido() {
        assertThat(EstadoHito.SI.cumplido()).isTrue();
        assertThat(EstadoHito.EN_PROCESO.cumplido()).isFalse();
        assertThat(EstadoHito.NO.cumplido()).isFalse();
    }

    @Test
    @DisplayName("los pendientes nombran lo que falta, incluido lo que va a medias")
    void losPendientesNombranLoQueFalta() {
        var p = new PreparacionEmpleabilidad();
        p.setCvListo(EstadoHito.SI);
        p.setCvEnIngles(EstadoHito.EN_PROCESO);
        p.setLinkedinCreado(EstadoHito.SI);

        assertThat(p.cumplidos()).isEqualTo(2);
        assertThat(p.pendientes()).containsExactly(
                "Traducir la hoja de vida al ingles",
                "Optimizar el perfil de LinkedIn",
                "Definir el perfil ocupacional");
    }

    @Test
    @DisplayName("poner un hito a nulo lo deja en no, no en nulo")
    void ponerUnHitoANuloLoDejaEnNo() {
        var p = new PreparacionEmpleabilidad();
        p.setCvListo(null);

        assertThat(p.getCvListo()).isEqualTo(EstadoHito.NO);
    }
}
