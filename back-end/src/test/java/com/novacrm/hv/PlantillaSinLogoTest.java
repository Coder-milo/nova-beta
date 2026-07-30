package com.novacrm.hv;

import com.novacrm.hv.dto.DatosHvDto;
import com.novacrm.hv.dto.ExperienciaDto;
import com.novacrm.hv.dto.FormacionDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La cabecera de la hoja de vida y la línea de contacto.
 *
 * <p>Se prueba aquí porque es lo que más se rompía en silencio: el PDF se
 * generaba sin error y el defecto solo se veía abriéndolo. La cabecera llevaba
 * un logo que robaba el ancho del nombre, y la línea de contacto se montaba en
 * la plantilla con un marcador por dato y separadores fijos, así que a un perfil
 * sin teléfono le salían dos barras rojas seguidas y un enlace «Portfolio» que
 * apuntaba a "#".
 */
class PlantillaSinLogoTest {

    private final HvTemplateService servicio = new HvTemplateService();

    /** Datos completos; cada prueba vacía lo que necesita comprobar. */
    private static DatosHvDto datos(String celular,
                                    String telefono,
                                    String linkedinUrl,
                                    String portafolioUrl,
                                    String nacionalidad) {
        return new DatosHvDto(
                "Andrea", "Martínez",
                "Analista de datos",
                "andrea@ejemplo.com",
                celular,
                "Barranquilla",
                "oauth-user-id-que-no-es-una-url",
                "Perfil profesional de ejemplo.",
                "Excel avanzado, Power BI, SQL",
                null,
                "Técnica en Sistemas",
                "SENA",
                "Técnico",
                List.of(new ExperienciaDto("Analista", "Empresa", "01/2024", "", true, "Construcción de tableros.")),
                List.of(new FormacionDto("CERTIFICACION", "Power BI", "Academia CAC", "2025")),
                telefono,
                nacionalidad,
                linkedinUrl,
                portafolioUrl,
                "B2",
                List.of("Redujo el cierre mensual en 30%."));
    }

    @Test
    @DisplayName("la cabecera no lleva logo ni deja el marcador sin sustituir")
    void cabeceraSinLogo() {
        String html = servicio.renderizar(
                datos("+57 300 000 0000", null, "https://linkedin.com/in/andrea", null, "Colombia"),
                "es", null, null);

        assertThat(html).doesNotContain("LOGO_PATH", "<img");
        assertThat(html).doesNotContain("{{", "}}");
        assertThat(html).contains("Andrea Martínez");
    }

    @Test
    @DisplayName("sin teléfono ni enlaces no quedan separadores huérfanos")
    void contactoSinSeparadoresSueltos() {
        String html = servicio.renderizar(
                datos(null, null, null, null, null),
                "es", null, null);

        // El separador es una barra roja entre dos datos. Con un solo dato
        // (el correo) no debe aparecer ninguno.
        assertThat(html).doesNotContain(">|</span>&#160;&#160;<span");
        assertThat(html).contains("andrea@ejemplo.com");
        // Y sin URL de portafolio, el enlace no se pinta en vez de apuntar a "#".
        assertThat(html).doesNotContain("Portafolio");
        assertThat(html).doesNotContain("href=\"#\"");
    }

    @Test
    @DisplayName("el enlace de LinkedIn sale de linkedinUrl, no del id de OAuth")
    void linkedinUsaLaUrlYNoElIdDeIntegracion() {
        String html = servicio.renderizar(
                datos("+57 300 000 0000", null, "https://linkedin.com/in/andrea", null, "Colombia"),
                "es", null, null);

        assertThat(html).contains("https://linkedin.com/in/andrea");
        assertThat(html).doesNotContain("oauth-user-id-que-no-es-una-url");
    }

    @Test
    @DisplayName("el teléfono fijo sirve de respaldo cuando no hay celular")
    void telefonoDeRespaldo() {
        String html = servicio.renderizar(
                datos(null, "605 300 1234", null, null, "Colombia"),
                "es", null, null);

        assertThat(html).contains("605 300 1234");
    }

    @Test
    @DisplayName("el país no se inventa: sin nacionalidad se imprime solo la ciudad")
    void paisNoSeInventa() {
        String html = servicio.renderizar(
                datos("+57 300 000 0000", null, null, null, null),
                "es", null, null);

        assertThat(html).contains("Barranquilla").doesNotContain("Colombia");
    }

    @Test
    @DisplayName("las competencias separadas por comas se parten en viñetas")
    void competenciasSeparadasPorComas() {
        String html = servicio.renderizar(
                datos("+57 300 000 0000", null, null, null, "Colombia"),
                "es", null, null);

        // "Excel avanzado, Power BI, SQL" llega en una sola línea y debe salir
        // como tres viñetas: un ATS no lee una lista de una sola entrada larga.
        assertThat(html).contains("<li style=\"margin:0;\">Excel avanzado</li>");
        assertThat(html).contains("Power BI</li>");
        assertThat(html).contains("SQL</li>");
    }

    @Test
    @DisplayName("el nivel de inglés se añade cuando el campo libre no lo menciona")
    void nivelDeInglesSeAgregaSiFalta() {
        String html = servicio.renderizar(
                datos("+57 300 000 0000", null, null, null, "Colombia"),
                "es", null, null);

        assertThat(html).contains("Inglés: B2");
    }

    @Test
    @DisplayName("un campo excluido no aparece en el PDF")
    void camposExcluidos() {
        String html = servicio.renderizar(
                datos("+57 300 000 0000", null, "https://linkedin.com/in/andrea", null, "Colombia"),
                "es", null, List.of("PHONE", "LINKEDIN"));

        assertThat(html).doesNotContain("+57 300 000 0000", "linkedin.com/in/andrea");
        assertThat(html).contains("andrea@ejemplo.com");
    }
}
