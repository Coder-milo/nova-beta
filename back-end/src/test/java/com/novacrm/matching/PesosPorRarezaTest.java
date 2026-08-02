package com.novacrm.matching;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Ponderacion por rareza y parecido entre conjuntos de tokens.
 *
 * <p>Es lo que hace tolerable conservar la cola larga del vocabulario: sin
 * ponderar, coincidir en "sistemas" valdria lo mismo que coincidir en "ccna".
 */
class PesosPorRarezaTest {

    /** Pool de ejemplo: "servicio_cliente" es comun, "ccna" aparece una vez. */
    private static final PesosPorRareza POOL = PesosPorRareza.de(List.of(
            Set.of("servicio_cliente", "ingles_nivel", "bogota"),
            Set.of("servicio_cliente", "ingles_nivel", "barranquilla"),
            Set.of("servicio_cliente", "trabajo_de_voz"),
            Set.of("redes", "ccna")));

    @Test
    void loRaroPesaMasQueLoComun() {
        assertTrue(POOL.peso("ccna") > POOL.peso("servicio_cliente"),
                "coincidir en una certificacion concreta informa mas que en un oficio generico");
    }

    @Test
    void unTokenQueElMercadoNoUsaNoPesa() {
        assertEquals(0.0, POOL.peso("siigo"), 0.0001);
    }

    /** Ni siquiera el token que sale en todas desaparece del reparto. */
    @Test
    void elTokenMasComunSiguePesandoAlgo() {
        assertTrue(POOL.peso("servicio_cliente") > 0);
    }

    @Test
    void elParecidoEsSimetrico() {
        var unos = Set.of("servicio_cliente", "ingles_nivel");
        var otros = Set.of("servicio_cliente", "trabajo_de_voz", "barranquilla");

        assertEquals(POOL.parecido(unos, otros), POOL.parecido(otros, unos));
    }

    /**
     * La regresion que motivo cambiar la metrica: dividir solo entre los tokens
     * del estudiante premiaba al perfil vacio. Quien escribio dos palabras y
     * ambas coinciden sacaba 1.0, y quien detallo su perfil profesional salia
     * peor por haberlo llenado.
     */
    @Test
    void unPerfilPobreNoLeGanaAUnoRicoQueCubreLoMismo() {
        var vacante = Set.of("servicio_cliente", "ingles_nivel", "trabajo_de_voz", "barranquilla");

        var pobre = Set.of("servicio_cliente");
        var rico = Set.of("servicio_cliente", "ingles_nivel", "trabajo_de_voz", "barranquilla");

        assertTrue(POOL.parecido(rico, vacante) > POOL.parecido(pobre, vacante),
                "cubrir todo lo que pide el anuncio debe puntuar mas que cubrir una parte");
    }

    @Test
    void cubrirTodoDaElMaximoYNoCubrirNadaDaCero() {
        var iguales = Set.of("servicio_cliente", "ingles_nivel");

        assertEquals(1.0, POOL.parecido(iguales, iguales), 0.0001);
        assertEquals(0.0, POOL.parecido(Set.of("ccna"), Set.of("servicio_cliente")), 0.0001);
    }

    /**
     * Sin vocabulario que el mercado use no hay con que juzgar, y eso es
     * distinto de juzgar y dar cero: el criterio queda fuera del reparto.
     */
    @Test
    void sinTokensConocidosNoHayParecidoQueMedir() {
        assertNull(POOL.parecido(Set.of("siigo"), Set.of("servicio_cliente")));
        assertNull(POOL.parecido(Set.of(), Set.of("servicio_cliente")));
        assertNull(POOL.parecido(null, Set.of("servicio_cliente")));
    }

    @Test
    void unPoolVacioNoDaPesoANadie() {
        var vacio = PesosPorRareza.de(List.of());

        assertEquals(0.0, vacio.peso("servicio_cliente"), 0.0001);
        assertNull(vacio.parecido(Set.of("servicio_cliente"), Set.of("servicio_cliente")));
    }
}
