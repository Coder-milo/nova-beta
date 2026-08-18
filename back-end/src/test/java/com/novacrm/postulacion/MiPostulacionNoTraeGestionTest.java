package com.novacrm.postulacion;

import com.novacrm.postulacion.dto.MiPostulacion;
import com.novacrm.postulacion.dto.PostulacionDtos.PostulacionResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guarda de la frontera entre lo del estudiante y lo del equipo.
 *
 * <p>{@code /postulaciones/mias} devolvía el mismo {@code PostulacionResponse}
 * que usa el panel. La pantalla no pintaba los campos de gestión, pero iban en
 * la respuesta, que es lo que cuenta: cualquiera con la sesión abierta y la
 * pestaña de red del navegador los veía.
 *
 * <p>Como en {@code PerfilLaboralNoFiltraDatosTest}, esto no ejercita
 * comportamiento: fija una decisión. El riesgo no es que hoy esté mal, es que
 * dentro de seis meses alguien añada un campo «porque hacía falta en la
 * pantalla» sin caer en que esa pantalla la ve el estudiante. En el diff se ve
 * como una línea más en un record de veinte.
 */
class MiPostulacionNoTraeGestionTest {

    /**
     * Campos que son trabajo interno del equipo.
     *
     * <p>{@code contactoEmail} está aquí y {@code contactoTelefono} no, a
     * propósito: el correo es el canal por el que el equipo negocia la cita con
     * el reclutador, y el teléfono es a quién llama el estudiante si se retrasa
     * o no encuentra la oficina. Ocultarle el segundo sería proteger el dato
     * equivocado.
     */
    private static final Set<String> DE_GESTION = Set.of(
            "gestionadaPor", "gestionada_por",
            "proximoSeguimiento",
            "contactoEmail",
            "diasHastaRespuesta",
            "estudianteId", "estudianteNombre");

    private static List<String> componentesDe(Class<?> record) {
        return Arrays.stream(record.getRecordComponents())
                .map(RecordComponent::getName)
                .toList();
    }

    @Test
    @DisplayName("lo que ve el estudiante de su postulación no trae campos de gestión")
    void nadaDeGestionViajaAlEstudiante() {
        var filtrados = componentesDe(MiPostulacion.class).stream()
                .filter(DE_GESTION::contains)
                .toList();

        assertThat(filtrados)
                .as("estos campos son del equipo, no del estudiante; si hace falta uno "
                        + "en el portal, la decisión es de quién lleva el programa, no del diff")
                .isEmpty();
    }

    @Test
    @DisplayName("sí trae lo que hace falta para presentarse a la entrevista")
    void laCitaLlegaEntera() {
        // El punto del recorte no es esconder cosas: es que llegue lo justo.
        // Una lista blanca que se pasa de celosa deja al estudiante sin saber a
        // que hora es su propia cita, que es peor que el problema que resuelve.
        assertThat(componentesDe(MiPostulacion.class))
                .contains("fechaHoraEntrevista", "modalidadEntrevista", "modalidadEtiqueta",
                        "lugarEntrevista", "contactoNombre", "contactoTelefono",
                        "entrevistaPendiente", "entrevistaVencida", "horasParaEntrevista");
    }

    @Test
    @DisplayName("la vista de gestión sigue completa: el recorte es solo para el estudiante")
    void elPanelNoPierdeNada() {
        // Si alguien «unifica» los dos records, esto lo enseña: el panel
        // necesita exactamente los campos que el portal no puede ver.
        assertThat(componentesDe(PostulacionResponse.class))
                .contains("gestionadaPor", "proximoSeguimiento", "contactoEmail",
                        "estudianteId", "estudianteNombre");
    }
}
