package com.novacrm.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

/**
 * La aplicacion no debe arrancar nunca con un secreto JWT vacio, corto o con
 * uno de los valores que estuvieron versionados en el repositorio: con
 * cualquiera de ellos, un tercero podria firmar tokens de ADMIN validos.
 */
class SecretoJwtTest {

    private SecurityConfig configConSecreto(String secreto) {
        var config = new SecurityConfig();
        ReflectionTestUtils.setField(config, "jwtSecret", secreto);
        return config;
    }

    @Test
    void rechazaUnSecretoAusente() {
        var ex = assertThrows(IllegalStateException.class, () -> configConSecreto("").validarJwtSecret());
        assertTrue(ex.getMessage().contains("JWT_SECRET"));
    }

    @Test
    void rechazaUnSecretoEnBlanco() {
        assertThrows(IllegalStateException.class, () -> configConSecreto("   ").validarJwtSecret());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "TlfnNVy2SjMmDUao7a6XpWTBRG4iLr3ZGdveIrsy/o0=",
            "super_secret_jwt_key_nova_crm_2026_default_secret_key_32bytes"
    })
    void rechazaLosSecretosQueEstuvieronEnElRepositorio(String secretoFiltrado) {
        var ex = assertThrows(IllegalStateException.class,
                () -> configConSecreto(secretoFiltrado).validarJwtSecret());
        assertTrue(ex.getMessage().contains("repositorio"),
                "el mensaje debe explicar que el secreto ya no es secreto");
    }

    @Test
    void rechazaUnSecretoMasCortoDe32Bytes() {
        var ex = assertThrows(IllegalStateException.class,
                () -> configConSecreto("corto-31-bytes-1234567890abcde").validarJwtSecret());
        assertTrue(ex.getMessage().contains("32"));
    }

    @Test
    void aceptaUnSecretoValido() {
        assertDoesNotThrow(() -> configConSecreto("secreto-de-pruebas-con-mas-de-32-bytes-de-longitud")
                .validarJwtSecret());
    }
}
