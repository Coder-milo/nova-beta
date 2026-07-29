package com.novacrm.estudiante;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El puntaje tiene que dar exactamente lo mismo que la hoja de seguimiento.
 *
 * <p>Los valores esperados no estan inventados: son los de participantes reales
 * de la hoja, elegidos porque entre los cinco cubren las combinaciones que
 * importan. Si alguien "mejora" la formula, estos casos lo dicen.
 */
class PuntajeEmpleabilidadTest {

    private static PreparacionEmpleabilidad preparacion(EstadoHito cv, EstadoHito ingles,
                                                        EstadoHito liCreado, EstadoHito liOptimizado,
                                                        EstadoHito perfil) {
        var p = new PreparacionEmpleabilidad();
        p.setCvListo(cv);
        p.setCvEnIngles(ingles);
        p.setLinkedinCreado(liCreado);
        p.setLinkedinOptimizado(liOptimizado);
        p.setPerfilOcupacional(perfil);
        return p;
    }

    @Test
    @DisplayName("los tres hitos basicos suman 0,40, que es donde esta la mayoria del programa")
    void losTresHitosBasicosSuman40() {
        var p = preparacion(EstadoHito.SI, EstadoHito.SI, EstadoHito.SI, EstadoHito.NO, EstadoHito.NO);

        assertThat(PuntajeEmpleabilidad.calcular(p, false)).isEqualByComparingTo("0.40");
    }

    @Test
    @DisplayName("sin hoja de vida en ingles se pierden quince puntos, no siete")
    void sinHojaDeVidaEnInglesSePierdenQuincePuntos() {
        // Esteban: CV si, ingles no, LinkedIn creado, sin optimizar, sin perfil.
        var p = preparacion(EstadoHito.SI, EstadoHito.NO, EstadoHito.SI, EstadoHito.NO, EstadoHito.NO);

        assertThat(PuntajeEmpleabilidad.calcular(p, false)).isEqualByComparingTo("0.25");
    }

    @Test
    @DisplayName("un hito a medias aporta siete centesimas, sea cual sea su peso")
    void unHitoAMediasAportaSieteCentesimas() {
        // Aaron: los tres basicos mas el perfil ocupacional en proceso.
        var p = preparacion(EstadoHito.SI, EstadoHito.SI, EstadoHito.SI, EstadoHito.NO, EstadoHito.EN_PROCESO);

        // 0,40 + 0,07 = 0,47. No 0,475: el perfil pesa 0,15 y a medias no
        // aporta 0,075, sino el valor fijo. Es una rareza de la hoja que se
        // conserva a proposito para no mover el indicador publicado.
        assertThat(PuntajeEmpleabilidad.calcular(p, false)).isEqualByComparingTo("0.47");
    }

    @Test
    @DisplayName("dos hitos a medias aportan catorce centesimas")
    void dosHitosAMediasAportanCatorceCentesimas() {
        // Juan Carlos: CV si, ingles a medias, LinkedIn creado, perfil a medias.
        var p = preparacion(EstadoHito.SI, EstadoHito.EN_PROCESO, EstadoHito.SI,
                EstadoHito.NO, EstadoHito.EN_PROCESO);

        assertThat(PuntajeEmpleabilidad.calcular(p, false)).isEqualByComparingTo("0.39");
    }

    @Test
    @DisplayName("estar colocado suma treinta puntos sobre lo que ya se traia")
    void estarColocadoSumaTreintaPuntos() {
        // Salomon: todo menos LinkedIn optimizado, que va a medias, y colocado.
        var p = preparacion(EstadoHito.SI, EstadoHito.SI, EstadoHito.SI,
                EstadoHito.EN_PROCESO, EstadoHito.SI);

        assertThat(PuntajeEmpleabilidad.calcular(p, true)).isEqualByComparingTo("0.92");
    }

    @Test
    @DisplayName("el resultado se trunca, no se redondea")
    void elResultadoSeTruncaNoSeRedondea() {
        // 0,15 + 0,15 + 0,10 + 0,075 daria 0,475 si el hito a medias fuera la
        // mitad; con el aporte fijo son 0,47 y con redondeo saldria 0,48.
        var p = preparacion(EstadoHito.SI, EstadoHito.SI, EstadoHito.SI, EstadoHito.NO, EstadoHito.EN_PROCESO);

        assertThat(PuntajeEmpleabilidad.calcular(p, false).scale()).isEqualTo(2);
        assertThat(PuntajeEmpleabilidad.calcular(p, false)).isEqualByComparingTo("0.47");
    }

    @Test
    @DisplayName("los cinco hitos mas la colocacion dan uno redondo")
    void losCincoHitosMasLaColocacionDanUno() {
        var p = preparacion(EstadoHito.SI, EstadoHito.SI, EstadoHito.SI, EstadoHito.SI, EstadoHito.SI);

        assertThat(PuntajeEmpleabilidad.calcular(p, true)).isEqualByComparingTo("1.00");
    }

    @Test
    @DisplayName("una ficha sin nada no puntua")
    void unaFichaSinNadaNoPuntua() {
        assertThat(PuntajeEmpleabilidad.calcular(new PreparacionEmpleabilidad(), false))
                .isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("una preparacion nula no revienta: cuenta como sin empezar")
    void unaPreparacionNulaCuentaComoSinEmpezar() {
        assertThat(PuntajeEmpleabilidad.calcular(null, false)).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(PuntajeEmpleabilidad.calcular(null, true)).isEqualByComparingTo("0.30");
    }

    @Test
    @DisplayName("el porcentaje entero es el mismo numero sin la coma")
    void elPorcentajeEnteroEsElMismoNumero() {
        var p = preparacion(EstadoHito.SI, EstadoHito.SI, EstadoHito.SI, EstadoHito.NO, EstadoHito.EN_PROCESO);

        assertThat(PuntajeEmpleabilidad.porcentaje(p, false)).isEqualTo(47);
    }

    @Test
    @DisplayName("los pesos suman uno: nadie puede pasar del cien por cien")
    void losPesosSumanUno() {
        var total = PuntajeEmpleabilidad.PESO_CV
                .add(PuntajeEmpleabilidad.PESO_CV_INGLES)
                .add(PuntajeEmpleabilidad.PESO_LINKEDIN_CREADO)
                .add(PuntajeEmpleabilidad.PESO_LINKEDIN_OPTIMIZADO)
                .add(PuntajeEmpleabilidad.PESO_PERFIL_OCUPACIONAL)
                .add(PuntajeEmpleabilidad.PESO_COLOCADO);

        assertThat(total).isEqualByComparingTo("1.00");
    }
}
