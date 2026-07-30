package com.novacrm.correo;

import com.novacrm.config.MarcaCorreo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Los correos automáticos del sistema.
 *
 * <p>Se comprueba lo que de verdad se rompe en un correo y no da error: que el
 * enlace de acción esté, que no queden marcadores sin sustituir y que todos
 * pasen por la plantilla de marca. El de recuperación de contraseña iba antes
 * en HTML crudo —sin cabecera, sin pie y sin color—, así que el mismo usuario
 * recibía dos correos que no parecían del mismo sistema.
 *
 * <p>Además exporta cada uno a {@code target/correos-preview} para poder mirarlos
 * en un navegador: un correo válido pero descuadrado pasa cualquier assert.
 */
class CorreosDelSistemaTest {

    private static final MarcaCorreo MARCA = new MarcaCorreo(
            "https://cdn.ejemplo.com/logo.png", 520, 160,
            "https://cdn.ejemplo.com/pie.png", 1200, 200,
            "CAC Eurocentres · Barranquilla, Colombia",
            "#1F4E79");

    private static Path exportar(String nombre, String html) throws Exception {
        Path dir = Path.of("target", "correos-preview");
        Files.createDirectories(dir);
        Path destino = dir.resolve(nombre + ".html");
        Files.writeString(destino, html, StandardCharsets.UTF_8);
        return destino;
    }

    @Test
    @DisplayName("los tres correos salen con la marca y sin marcadores sueltos")
    void todosPasanPorLaPlantillaDeMarca() throws Exception {
        for (var tipo : CorreosDelSistema.Tipo.values()) {
            String html = CorreosDelSistema.ejemplo(tipo, MARCA, "https://nova.ejemplo.com");
            exportar(tipo.name().toLowerCase(), html);

            assertThat(html)
                    .as("%s debe pasar por la plantilla de marca", tipo)
                    .contains("https://cdn.ejemplo.com/logo.png", "CAC Eurocentres");
            assertThat(html)
                    .as("%s no debe dejar marcadores de formato sin sustituir", tipo)
                    .doesNotContain("%s", "%d", "{{", "}}");
            assertThat(html).startsWith("<!DOCTYPE html>");
            // El color de la marca tiene que llegar al correo: es lo que
            // distingue el de un programa del de otro.
            assertThat(html).containsIgnoringCase("#1F4E79");
        }
    }

    @Test
    @DisplayName("cada correo lleva su enlace de acción")
    void cadaCorreoLlevaSuEnlace() {
        String activacion = CorreosDelSistema.activacion(
                "María Gómez", "maria@ejemplo.com", "https://nova.ejemplo.com/activar?token=abc", 7, MARCA);
        assertThat(activacion)
                .contains("https://nova.ejemplo.com/activar?token=abc")
                .contains("maria@ejemplo.com")
                .contains("7 días");

        String recuperacion = CorreosDelSistema.recuperacion(
                "María Gómez", "https://nova.ejemplo.com/reset?token=xyz", 30, MARCA);
        assertThat(recuperacion)
                .contains("https://nova.ejemplo.com/reset?token=xyz")
                .contains("30 minutos");
    }

    @Test
    @DisplayName("el anuncio sin material no deja un botón vacío")
    void anuncioSinMaterialNoPintaBoton() {
        String conMaterial = CorreosDelSistema.anuncio("Ana", "Feria", "<p>Cuerpo</p>",
                "https://nova.ejemplo.com/material", MARCA);
        assertThat(conMaterial).contains("Ver el material del anuncio");

        String sinMaterial = CorreosDelSistema.anuncio("Ana", "Feria", "<p>Cuerpo</p>", null, MARCA);
        assertThat(sinMaterial).doesNotContain("Ver el material del anuncio");
        assertThat(sinMaterial).contains("Cuerpo");
    }

    @Test
    @DisplayName("sin marca de programa el correo sigue siendo presentable")
    void marcaVaciaNoRompeElCorreo() {
        var sinMarca = MarcaCorreo.global(null, null);
        for (var tipo : CorreosDelSistema.Tipo.values()) {
            String html = CorreosDelSistema.ejemplo(tipo, sinMarca, null);
            assertThat(html)
                    .as("%s sin marca configurada", tipo)
                    .startsWith("<!DOCTYPE html>")
                    .doesNotContain("null", "{{", "}}");
        }
    }
}
