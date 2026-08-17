package com.novacrm.postulacion;

import com.novacrm.postulacion.dto.PostulacionDtos.ActualizarPostulacion;
import com.novacrm.postulacion.dto.PostulacionDtos.CrearPostulacion;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Los campos de texto libre de una postulacion tambien tienen tope.
 *
 * <p>Este archivo ya limitaba la empresa, el cargo, el canal y el enlace. Los
 * que faltaban —observaciones y resultado— son justo los que tienen columna
 * TEXT: los limites estaban donde el motor los obligaba, no donde hacen falta.
 *
 * <p>Los escribe el rol con menos permisos, y {@code resultado} ademas se copia
 * al historial de seguimiento, que es lo que el equipo lee para entender que ha
 * pasado con esa persona.
 */
class TopesDeLaPostulacionTest {

    private static final Validator VALIDADOR =
            Validation.buildDefaultValidatorFactory().getValidator();

    private static CrearPostulacion alta(String observaciones) {
        return new CrearPostulacion(null, null, "Solvo S.A.S.", "Asesora bilingue",
                "Feria", null, null, "", observaciones,
                null, null, null, null, null, null, null);
    }

    private static ActualizarPostulacion cambio(String resultado, String observaciones) {
        return new ActualizarPostulacion(null, null, resultado, observaciones, null,
                null, null, null, null, null, null, null, null);
    }

    @Test
    @DisplayName("una nota normal pasa")
    void loNormalPasa() {
        assertThat(VALIDADOR.validate(alta("Me contactaron por LinkedIn."))).isEmpty();
        assertThat(VALIDADOR.validate(cambio("Quedaron en llamar.", "Segunda entrevista."))).isEmpty();
    }

    @Test
    @DisplayName("las observaciones del alta tienen tope aunque la columna sea TEXT")
    void lasObservacionesDelAltaTienenTope() {
        assertThat(VALIDADOR.validate(alta("a".repeat(2_001)))).isNotEmpty();
        assertThat(VALIDADOR.validate(alta("a".repeat(2_000)))).isEmpty();
    }

    @Test
    @DisplayName("el resultado tiene tope: se copia al historial que lee el equipo")
    void elResultadoTieneTope() {
        assertThat(VALIDADOR.validate(cambio("a".repeat(1_001), null))).isNotEmpty();
        assertThat(VALIDADOR.validate(cambio("a".repeat(1_000), null))).isEmpty();
    }

    @Test
    @DisplayName("y las observaciones de la actualizacion tambien")
    void lasObservacionesDelCambioTienenTope() {
        assertThat(VALIDADOR.validate(cambio(null, "a".repeat(2_001)))).isNotEmpty();
        assertThat(VALIDADOR.validate(cambio(null, "a".repeat(2_000)))).isEmpty();
    }
}
