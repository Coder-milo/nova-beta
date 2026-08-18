package com.novacrm.perfil;

import com.novacrm.perfil.dto.ExperienciaRequest;
import com.novacrm.perfil.dto.FormacionRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lo que el estudiante escribe en su hoja de vida tiene que caber.
 *
 * <p>Ninguno de los dos formularios tenia tope. Un texto mas largo que la
 * columna llegaba hasta la base y salia un 22001 crudo —un 500 sin
 * explicacion— en vez de un mensaje que dijera que hay que acortar. La
 * importacion ya recorta por esta misma razon; aqui, que es donde escribe una
 * persona a mano, no habia nada.
 *
 * <p>Y {@code funciones} es TEXT: no tenia limite ninguno. Es el endpoint que
 * alcanza el rol con menos permisos, y lo que se guarde ahi se lee en cada
 * analisis de completitud y se pinta en cada hoja de vida generada.
 */
class TopesDelPerfilTest {

    private static final Validator VALIDADOR =
            Validation.buildDefaultValidatorFactory().getValidator();

    private static String texto(int largo) {
        return "a".repeat(largo);
    }

    private static ExperienciaRequest empleo(String empresa, String funciones) {
        return new ExperienciaRequest(empresa, "Asesora", "Barranquilla",
                LocalDate.of(2024, 1, 1), null, true, funciones, false);
    }

    @Test
    @DisplayName("un empleo normal pasa")
    void loNormalPasa() {
        assertThat(VALIDADOR.validate(empleo("Solvo S.A.S.", "Atencion al cliente."))).isEmpty();
    }

    @Test
    @DisplayName("un nombre de empresa mas largo que su columna se rechaza aqui, no en la base")
    void elNombreLargoSeRechazaAntesDeLaBase() {
        assertThat(VALIDADOR.validate(empleo(texto(256), "Funciones"))).isNotEmpty();
        assertThat(VALIDADOR.validate(empleo(texto(255), "Funciones"))).isEmpty();
    }

    @Test
    @DisplayName("las funciones tienen tope aunque la columna sea TEXT")
    void lasFuncionesTienenTope() {
        assertThat(VALIDADOR.validate(empleo("Solvo", texto(5_001)))).isNotEmpty();
        assertThat(VALIDADOR.validate(empleo("Solvo", texto(5_000)))).isEmpty();
    }

    @Test
    @DisplayName("la formacion tambien: el tipo cabe en treinta caracteres")
    void laFormacionTambienTieneTopes() {
        var largo = new FormacionRequest(texto(31), "SENA", "Ingles B2", null, null, null);
        var cabe = new FormacionRequest("CURSO", "SENA", "Ingles B2", null, null, null);

        assertThat(VALIDADOR.validate(largo)).isNotEmpty();
        assertThat(VALIDADOR.validate(cabe)).isEmpty();
    }
}
