package com.novacrm.estudiante;

import com.novacrm.estudiante.dto.EstudianteRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lo que se escribe en la ficha tiene que caber en la ficha.
 *
 * <p>Este DTO lo reciben dos rutas: la de gestion y {@code PUT /mi-perfil},
 * que es la que usa el propio estudiante. Tenia tope en dos campos —los dos de
 * URL— y en ninguno mas: los limites estaban donde alguien choco con ellos, no
 * donde una persona escribe.
 *
 * <p>Los de columna VARCHAR daban un 22001 crudo, o sea un 500 sin explicacion
 * mientras alguien rellena su propio perfil. Los de columna TEXT no daban nada,
 * que es peor: {@code competencias}, {@code perfilProfesional} y
 * {@code cargoObjetivo} los tokeniza el motor de matching contra todas las
 * vacantes de cada corrida.
 */
class TopesDeLaFichaTest {

    private static final Validator VALIDADOR =
            Validation.buildDefaultValidatorFactory().getValidator();

    /** Una ficha valida a la que se le cambia un campo por prueba. */
    private static EstudianteRequest ficha(String celular, String competencias, String cargoObjetivo) {
        return new EstudianteRequest(
                "Ana", "Perez", "ana@cac.test", null, celular, null,
                null, null, null, null, null, null,
                null, null, null, null, null, null,
                null, cargoObjetivo, null, null, null, null,
                null, null, null, null, null, null,
                null, null, null, null, null, null,
                null, null, null, null, null, null,
                null, null, competencias, null, null, null,
                null, null, null, null, null, null,
                null, null, null);
    }

    @Test
    @DisplayName("una ficha normal pasa")
    void loNormalPasa() {
        assertThat(VALIDADOR.validate(ficha("3001234567", "Servicio al cliente, Zendesk", "Asesora bilingue")))
                .isEmpty();
    }

    @Test
    @DisplayName("el celular no puede pasarse de su columna: seria un 500 al guardar el perfil")
    void elCelularTieneElTopeDeSuColumna() {
        assertThat(VALIDADOR.validate(ficha("3".repeat(51), null, null))).isNotEmpty();
        assertThat(VALIDADOR.validate(ficha("3".repeat(50), null, null))).isEmpty();
    }

    @Test
    @DisplayName("las competencias tienen tope aunque la columna sea TEXT: las lee el matching")
    void lasCompetenciasTienenTope() {
        assertThat(VALIDADOR.validate(ficha(null, "a".repeat(3_001), null))).isNotEmpty();
        assertThat(VALIDADOR.validate(ficha(null, "a".repeat(3_000), null))).isEmpty();
    }

    @Test
    @DisplayName("el cargo objetivo tambien, que es de donde salen los terminos de busqueda")
    void elCargoObjetivoTieneTope() {
        assertThat(VALIDADOR.validate(ficha(null, null, "a".repeat(501)))).isNotEmpty();
        assertThat(VALIDADOR.validate(ficha(null, null, "a".repeat(500)))).isEmpty();
    }
}
