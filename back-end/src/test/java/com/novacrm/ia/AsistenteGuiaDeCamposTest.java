package com.novacrm.ia;

import com.novacrm.ia.dto.ConsultaAsistenteDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La guía de campos del asistente de administración.
 *
 * <p>El caso que hay que blindar es el del nivel de inglés: un modelo sin guía
 * contesta "básico, intermedio, avanzado", que suena razonable y es justo lo
 * que deja el criterio de inglés del matching sin nada con que comparar.
 */
class AsistenteGuiaDeCamposTest {

    private final AsistenteIaService servicio = new AsistenteIaService(new NoopProveedorIa());

    @Test
    @DisplayName("responde el formato real del campo, no una escala inventada")
    void respondeElFormatoRealDelCampo() {
        var respuesta = servicio.procesarConsulta(new ConsultaAsistenteDto(
                "¿Qué pongo en el campo de nivel de inglés requerido de una vacante?", "/vacantes"));

        assertThat(respuesta.respuesta())
                .contains("MCER")
                .doesNotContain("intermedio, avanzado");
    }

    @Test
    @DisplayName("explica por qué importa el campo, no solo dónde está")
    void explicaElImpactoDeDejarloVacio() {
        var respuesta = servicio.procesarConsulta(new ConsultaAsistenteDto(
                "¿Para qué sirve el campo cargo objetivo?", "/estudiantes"));

        assertThat(respuesta.respuesta()).contains("afinidad");
        assertThat(respuesta.accionNavegacion()).isNotNull();
        assertThat(respuesta.accionNavegacion().url()).isEqualTo("/estudiantes");
    }

    @Test
    @DisplayName("busca sin tildes: se pregunta 'años' tanto como 'anios'")
    void buscaSinTildes() {
        assertThat(GuiaDeCampos.buscar("cuántos años de experiencia pongo")).isNotEmpty();
        assertThat(GuiaDeCampos.buscar("cuantos anios de experiencia pongo")).isNotEmpty();
    }

    @Test
    @DisplayName("no reconoce un campo que no existe en vez de inventarlo")
    void noInventaCamposQueNoExisten() {
        assertThat(GuiaDeCampos.buscar("cómo lleno el campo de puntaje crediticio")).isEmpty();
    }

    /**
     * El asistente solo puede publicar un botón hacia una ruta que exista: el
     * filtro descarta lo demás, así que una ruta mal escrita aquí se traduce en
     * que esa sección deja de ser alcanzable, en silencio.
     */
    @Test
    @DisplayName("toda ruta que el asistente ofrece existe en el router de la aplicación")
    void lasRutasOfrecidasExistenEnElRouter() {
        // Espejo de CrmApp.exactRoutes (front-end/src/CrmApp.tsx).
        Set<String> rutasDelRouter = Set.of(
                "/", "/auditoria", "/comunicaciones", "/colocaciones", "/configuracion",
                "/documentos", "/empresas", "/estudiantes", "/estudiantes/nuevo",
                "/hojas-de-vida", "/importaciones", "/login", "/portal-estudiante",
                "/power-bi", "/proyectos", "/recuperar-contrasena", "/reportes", "/vacantes",
                "/mi-perfil", "/mi-proceso", "/mis-actividades", "/mis-documentos",
                "/mi-hoja-de-vida", "/mis-postulaciones", "/mi-calendario", "/mis-mensajes",
                "/mis-notificaciones", "/ayuda-estudiante", "/configuracion-estudiante");

        for (String pregunta : new String[]{
                "estudiantes", "vacantes", "importar excel", "colocaciones", "whatsapp",
                "configuracion", "reportes", "auditoria", "proyectos", "empresas",
                "hojas de vida", "tablero", "matching", "cualquier otra cosa"}) {
            var accion = servicio.resolverLocalmente(pregunta).accionNavegacion();
            if (accion != null) {
                assertThat(rutasDelRouter)
                        .as("ruta ofrecida para '%s'", pregunta)
                        .contains(accion.url());
            }
        }

        for (String pregunta : new String[]{
                "documentos", "calendario", "postulaciones", "hoja de vida", "cualquier cosa"}) {
            var accion = servicio.resolverEstudianteLocalmente(pregunta).accionNavegacion();
            if (accion != null) {
                assertThat(rutasDelRouter)
                        .as("ruta ofrecida para '%s'", pregunta)
                        .contains(accion.url());
            }
        }
    }
}
