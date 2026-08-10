package com.novacrm.configuracion;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Leer la configuracion es de gestion, igual que escribirla.
 *
 * <p>Estaba abierta a cualquier usuario autenticado sin que ninguna pantalla del
 * estudiante la usara: los unicos sitios que la piden son la pantalla de
 * configuracion y sus paneles, todos de administracion. Mientras tanto la
 * respuesta lleva el NIT y el registro educativo de la institucion, y los dos
 * parametros con los que trabaja el sistema —el corte del matching y los dias
 * que aguanta una ficha en la papelera—.
 *
 * <p>Se comprueba sobre el fuente y no levantando el contexto porque lo que hay
 * que fijar es la decision, y la decision esta escrita en la anotacion. Si
 * alguien la afloja, esto se entera.
 */
class LaConfiguracionEsDeGestionTest {

    private static final Path CONTROLADOR = Path.of(
            "src", "main", "java", "com", "novacrm", "configuracion", "ConfiguracionController.java");

    private static String fuente() throws IOException {
        return Files.readString(CONTROLADOR, StandardCharsets.UTF_8);
    }

    /** El bloque de anotaciones y firma del metodo indicado. */
    private static String metodo(String fuente, String firma) {
        int fin = fuente.indexOf(firma);
        assertThat(fin).as("no se encontro %s", firma).isNotNegative();
        int inicio = Math.max(0, fin - 400);
        return fuente.substring(inicio, fin);
    }

    @Test
    @DisplayName("leer la configuracion pide rol de gestion, no solo sesion")
    void leerlaPideRolDeGestion() throws IOException {
        String antesDelGet = metodo(fuente(), "public ConfiguracionResponse obtener()");

        assertThat(antesDelGet)
                .as("un estudiante con sesion no tiene por que ver el NIT ni el corte del matching")
                .doesNotContain("isAuthenticated()");
        assertThat(antesDelGet).contains("hasAnyRole('COORDINADOR', 'ADMIN')");
    }

    @Test
    @DisplayName("y guardarla sigue pidiendolo")
    void guardarlaTambien() throws IOException {
        assertThat(metodo(fuente(), "public ConfiguracionResponse guardar("))
                .contains("hasAnyRole('COORDINADOR', 'ADMIN')");
    }
}
