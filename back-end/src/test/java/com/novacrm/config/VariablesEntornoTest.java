package com.novacrm.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * docker-compose.yml y render.yaml inyectan DB_USER, DB_PASSWORD, DB_NAME,
 * JWT_SECRET, MINIO_ENDPOINT y AWS_*. Si application.yml leyera otros nombres,
 * la app arrancaria en produccion con los valores por defecto sin avisar.
 * Estos tests fijan la correspondencia real entre ambos lados.
 */
class VariablesEntornoTest {

    /**
     * Carga application.yml con las variables de entorno simuladas encima.
     *
     * <p>Se descartan las fuentes reales del sistema: si la maquina que ejecuta
     * los tests tiene definidas DB_USER, JWT_SECRET o similares (algo habitual
     * cuando se comparte el equipo con otros proyectos), el resultado dependeria
     * del entorno en vez del contenido de application.yml.
     */
    private StandardEnvironment entornoCon(Map<String, Object> variables) throws IOException {
        var env = new StandardEnvironment();
        env.getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        env.getPropertySources().remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
        env.getPropertySources().addFirst(new MapPropertySource("variables-simuladas", variables));
        for (var fuente : new YamlPropertySourceLoader()
                .load("application", new ClassPathResource("application.yml"))) {
            env.getPropertySources().addLast(fuente);
        }
        return env;
    }

    @Test
    void usaLosNombresQueInyectanDockerComposeYRender() throws IOException {
        var env = entornoCon(Map.of(
                "DB_HOST", "neon.example.com",
                "DB_NAME", "novacrm_prod",
                "DB_USER", "usuario_prod",
                "DB_PASSWORD", "password_prod",
                "JWT_SECRET", "secreto-de-pruebas-con-mas-de-32-bytes-de-longitud",
                "MINIO_ENDPOINT", "http://minio:9000",
                "AWS_REGION", "us-east-2",
                "AWS_SES_FROM_EMAIL", "hola@novacrm.com"));

        assertEquals("usuario_prod", env.getProperty("spring.datasource.username"));
        assertEquals("password_prod", env.getProperty("spring.datasource.password"));
        assertTrue(env.getProperty("spring.datasource.url").contains("novacrm_prod"),
                "la URL debe usar la base indicada en DB_NAME");
        assertEquals("secreto-de-pruebas-con-mas-de-32-bytes-de-longitud",
                env.getProperty("app.jwt.secret"));
        assertEquals("http://minio:9000", env.getProperty("app.minio.url"));
        assertEquals("us-east-2", env.getProperty("app.ses.region"));
        assertEquals("hola@novacrm.com", env.getProperty("app.ses.source-email"));
    }

    @Test
    void mantieneCompatibilidadConLosNombresNovaAntiguos() throws IOException {
        var env = entornoCon(Map.of(
                "NOVA_DB_USER", "usuario_legado",
                "NOVA_DB_PASSWORD", "password_legado",
                "NOVA_JWT_SECRET", "secreto-legado-con-mas-de-32-bytes-de-longitud"));

        assertEquals("usuario_legado", env.getProperty("spring.datasource.username"));
        assertEquals("password_legado", env.getProperty("spring.datasource.password"));
        assertEquals("secreto-legado-con-mas-de-32-bytes-de-longitud", env.getProperty("app.jwt.secret"));
    }

    @Test
    void elNombreCanonicoTienePrioridadSobreElAntiguo() throws IOException {
        var env = entornoCon(Map.of(
                "DB_USER", "canonico",
                "NOVA_DB_USER", "legado"));

        assertEquals("canonico", env.getProperty("spring.datasource.username"));
    }

    @Test
    void elSecretoJwtNoTieneValorPorDefecto() throws IOException {
        var env = entornoCon(Map.of());

        assertEquals("", env.getProperty("app.jwt.secret"),
                "application.yml no debe traer ningun secreto embebido");
    }
}
