package com.novacrm.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Genera un ejemplo del correo en {@code target/vista-previa-correo.html} para
 * poder abrirlo en el navegador y revisar el diseno.
 *
 * <p>Un correo no se puede corregir despues de enviarlo, y la plantilla usa
 * tablas y estilos en linea que no se aprecian leyendo el codigo. Escribe en
 * {@code target/}, que no se versiona.
 */
class VistaPreviaCorreoTest {

    @Test
    void generaUnaVistaPreviaRevisable() throws IOException {
        String cuerpo = """
                <p style="margin:0 0 14px 0;">
                  Te creamos un acceso al panel del programa. Desde ahi vas a poder
                  consultar tu perfil, tu hoja de vida y las vacantes que se ajustan a ti.
                </p>
                %s
                %s
                """.formatted(
                PlantillaCorreo.boton("Crear mi contrasena",
                        "http://localhost:3000/recuperar-contrasena?token=ejemplo"),
                PlantillaCorreo.recuadroDato("Tu usuario sera", "estudiante@ejemplo.com"));

        String html = PlantillaCorreo.construir(
                "Activa tu acceso al panel",
                "Hola Nombre Del Estudiante,",
                cuerpo,
                // Rutas donde deben quedar los recursos de la Ruta Accelerator.
                "http://localhost:3000/brand/ruta-accelerator-logo.png",
                "http://localhost:3000/brand/ruta-accelerator-pie.png");

        Path salida = Path.of("target", "vista-previa-correo.html");
        Files.createDirectories(salida.getParent());
        Files.writeString(salida, html, StandardCharsets.UTF_8);

        assertTrue(Files.exists(salida));
        assertTrue(Files.size(salida) > 500, "la vista previa deberia tener contenido");
    }
}
