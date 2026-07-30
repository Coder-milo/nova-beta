package com.novacrm.vacante;

import com.novacrm.vacante.dto.VacanteRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Una oferta se identifica por su enlace o por su titulo, y hace falta uno.
 *
 * <p>El enlace era obligatorio y eso dejaba fuera justo las ofertas que aporta
 * el programa: las de feria, las de un contacto, las que no estan en ningun
 * portal.
 */
class OfertaIdentificableTest {

    private static final Validator VALIDADOR =
            Validation.buildDefaultValidatorFactory().getValidator();

    private static VacanteRequest oferta(String url, String titulo) {
        return new VacanteRequest(url, titulo, null, null, null, null, null,
                null, null, null, null, null, null, null, null);
    }

    private static boolean valida(VacanteRequest peticion) {
        return VALIDADOR.validate(peticion).isEmpty();
    }

    @Test
    @DisplayName("con enlace y sin titulo vale: el titulo se lee de la pagina")
    void conEnlaceYSinTituloVale() {
        assertThat(valida(oferta("https://ejemplo.com/oferta", null))).isTrue();
    }

    @Test
    @DisplayName("con titulo y sin enlace vale: es la oferta de feria")
    void conTituloYSinEnlaceVale() {
        assertThat(valida(oferta(null, "Bilingual Customer Service Representative"))).isTrue();
        assertThat(valida(oferta("", "Bilingual Customer Service Representative"))).isTrue();
    }

    @Test
    @DisplayName("sin enlace ni titulo no hay oferta que guardar")
    void sinEnlaceNiTituloNoHayOferta() {
        assertThat(valida(oferta(null, null))).isFalse();
        assertThat(valida(oferta("", "   "))).isFalse();
    }

    @Test
    @DisplayName("un enlace que no empieza por http se rechaza")
    void unEnlaceQueNoEmpiezaPorHttpSeRechaza() {
        assertThat(valida(oferta("ejemplo.com/oferta", "Agente bilingue"))).isFalse();
    }

    @Test
    @DisplayName("una oferta nueva entra revisada; solo la del estudiante no")
    void unaOfertaNuevaEntraRevisada() {
        // El valor por defecto de la entidad importa: si naciera en false, todo
        // lo que scrapean los portales quedaria fuera del matching.
        assertThat(new Vacante().isRevisada()).isTrue();
    }
}
