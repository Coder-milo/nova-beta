package com.novacrm.seguridad;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Que consultas quedan fuera del alcance del rol ESTUDIANTE.
 *
 * <p>Cada una de estas devuelve datos de mas de un programa, o deja elegir de
 * cual, y sus respuestas llevan el nombre del programa y el del responsable.
 * Estaban abiertas al estudiante sin que ninguna pantalla suya las usara —el
 * portal lee su agenda por {@code /actividades/mias}—, de modo que bastaba con
 * cambiar un identificador en la URL para asomarse al programa de otro cliente.
 *
 * <p>Es una prueba de anotaciones y no de comportamiento a proposito: no
 * levanta contexto, corre en milisegundos y falla en el momento en que alguien
 * vuelve a anadir el rol, que es justo el descuido del que protege. La
 * comprobacion de que la restriccion se aplica de verdad esta en
 * {@link AutoedicionDePerfilTest}.
 */
class AlcanceDeRolesEnEndpointsTest {

    /** Metodo del controlador y por que no puede alcanzarlo un estudiante. */
    private record Cerrado(Class<?> controlador, String metodo, String porque) {}

    private static final List<Cerrado> FUERA_DEL_ALCANCE = List.of(
            new Cerrado(com.novacrm.actividad.ActividadController.class, "listar",
                    "deja elegir el programa por la URL"),
            new Cerrado(com.novacrm.actividad.ActividadController.class, "proximas",
                    "cruza las actividades de todos los programas"),
            new Cerrado(com.novacrm.actividad.ActividadController.class, "agenda",
                    "es la agenda completa de todos los programas"),
            new Cerrado(com.novacrm.estudiante.EstudianteController.class, "actualizar",
                    "escribe la ficha entera; el portal edita por /mi-perfil"));

    @Test
    @DisplayName("las consultas que cruzan programas no admiten al rol ESTUDIANTE")
    void lasConsultasQueCruzanProgramasNoAdmitenEstudiante() {
        List<String> abiertas = new ArrayList<>();

        for (Cerrado c : FUERA_DEL_ALCANCE) {
            Method metodo = buscar(c.controlador(), c.metodo());
            PreAuthorize anotacion = metodo.getAnnotation(PreAuthorize.class);

            assertThat(anotacion)
                    .as("%s.%s no declara @PreAuthorize", c.controlador().getSimpleName(), c.metodo())
                    .isNotNull();

            if (anotacion.value().contains("ESTUDIANTE")) {
                abiertas.add("%s.%s (%s) -> %s".formatted(
                        c.controlador().getSimpleName(), c.metodo(), c.porque(), anotacion.value()));
            }
        }

        assertThat(abiertas)
                .as("estos endpoints volvieron a quedar al alcance de un estudiante")
                .isEmpty();
    }

    @Test
    @DisplayName("el portal conserva su propia vía para la agenda")
    void elPortalConservaSuVia() {
        // Si esta se cerrara junto con las otras, el estudiante se quedaria sin
        // agenda en vez de con una acotada, que no es lo que se quiso hacer.
        Method mias = buscar(com.novacrm.actividad.ActividadController.class, "mias");
        assertThat(mias.getAnnotation(PreAuthorize.class).value()).contains("ESTUDIANTE");

        Method miPerfil = buscar(com.novacrm.estudiante.EstudianteController.class, "actualizarMiPerfil");
        assertThat(miPerfil.getAnnotation(PreAuthorize.class).value()).contains("ESTUDIANTE");
    }

    @Test
    @DisplayName("todo endpoint declara alcance: por anotación propia o por la clase")
    void todoEndpointDeclaraAlcance() {
        // Un metodo sin @PreAuthorize cae en `anyRequest().authenticated()`, que
        // solo exige haber iniciado sesion: cualquier estudiante pasaria.
        List<Class<?>> controladores = List.of(
                com.novacrm.actividad.ActividadController.class,
                com.novacrm.certificacion.CertificacionController.class,
                com.novacrm.estudiante.EstudianteController.class);

        List<String> sinAlcance = new ArrayList<>();
        for (Class<?> c : controladores) {
            boolean alcanceEnLaClase = c.isAnnotationPresent(PreAuthorize.class);
            for (Method m : c.getDeclaredMethods()) {
                boolean esEndpoint = java.util.Arrays.stream(m.getAnnotations())
                        .anyMatch(a -> a.annotationType().isAnnotationPresent(RequestMapping.class));
                if (!esEndpoint) continue;
                if (!alcanceEnLaClase && !m.isAnnotationPresent(PreAuthorize.class)) {
                    sinAlcance.add(c.getSimpleName() + "." + m.getName());
                }
            }
        }
        assertThat(sinAlcance).isEmpty();
    }

    private static Method buscar(Class<?> controlador, String nombre) {
        return java.util.Arrays.stream(controlador.getDeclaredMethods())
                .filter(m -> m.getName().equals(nombre))
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "No existe " + controlador.getSimpleName() + "." + nombre
                                + "; si se renombró, actualiza esta prueba en vez de borrarla"));
    }
}
