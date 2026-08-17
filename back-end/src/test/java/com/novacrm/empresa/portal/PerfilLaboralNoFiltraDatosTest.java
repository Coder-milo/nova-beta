package com.novacrm.empresa.portal;

import com.novacrm.estudiante.Estudiante;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guarda de la frontera: que datos de un estudiante no salgan al portal.
 *
 * <p>Esta prueba no ejercita comportamiento, fija una decision. El riesgo real
 * de {@link PerfilLaboralDto} no es que hoy este mal —hoy esta bien— sino que
 * dentro de seis meses alguien añada un campo «porque hacia falta en la
 * pantalla» sin caer en que esa pantalla la ve una empresa externa. Revisando
 * el diff no se ve: es una linea mas en un record de veinte.
 *
 * <p>Si alguien añade uno de los campos prohibidos, esto falla y explica por
 * que. Es el unico sitio donde esa decision queda escrita de forma ejecutable.
 */
class PerfilLaboralNoFiltraDatosTest {

    /**
     * Campos de {@code Estudiante} que no pueden viajar al portal de empresas.
     *
     * <p>Datos de identificacion, de contacto directo y de caracterizacion. No
     * hacen falta para decidir a quien se entrevista, y son justamente los que
     * convierten una postulacion en una cesion de datos personales.
     */
    private static final Set<String> PROHIBIDOS = Set.of(
            "numeroDocumento", "tipoDocumento", "documento",
            "fechaNacimiento", "edad",
            "genero", "nacionalidad",
            "direccion", "barrio",
            "telefono", "celular", "email", "correo",
            "fotoUrl", "foto",
            "linkedinAccessToken", "linkedinUserId",
            "estadoAcademico", "estadoEmpleabilidad",
            "observaciones", "notas", "seguimiento");

    private static List<String> componentesDe(Class<?> record) {
        return Arrays.stream(record.getRecordComponents())
                .map(RecordComponent::getName)
                .toList();
    }

    @Test
    @DisplayName("el perfil que ve una empresa no incluye ningun dato personal prohibido")
    void noSeFiltraNingunDatoProhibido() {
        var filtrados = componentesDe(PerfilLaboralDto.class).stream()
                .filter(c -> PROHIBIDOS.contains(c))
                .collect(Collectors.toList());

        assertThat(filtrados)
                .as("""
                    Estos campos llegarian a una empresa externa. Si de verdad hace \
                    falta alguno, quitalo de PROHIBIDOS con un motivo escrito \
                    y avisa a quien lleve proteccion de datos: no es un cambio \
                    de codigo, es un cambio de que sale de la institucion.""")
                .isEmpty();
    }

    @Test
    @DisplayName("el perfil no expone el identificador del estudiante, solo el de la postulacion")
    void noSeExponeElIdDelEstudiante() {
        var componentes = componentesDe(PerfilLaboralDto.class);

        // Con el id del estudiante fuera, una empresa no puede acumular una
        // lista estable de personas entre vacantes ni cruzarla con nada.
        assertThat(componentes).doesNotContain("estudianteId", "id");
        assertThat(componentes).contains("postulacionId");
    }

    @Test
    @DisplayName("todo campo del perfil existe de verdad en Estudiante o en la postulacion")
    void nadaInventado() {
        // Evita lo contrario del filtrado: prometer en el DTO datos que no
        // existen, que es como acaban los portales enseñando huecos.
        Set<String> deEstudiante = Arrays.stream(Estudiante.class.getDeclaredFields())
                .map(f -> f.getName())
                .collect(Collectors.toSet());

        Set<String> deLaPostulacion = Set.of(
                "postulacionId", "nombreCompleto", "programa", "nivelIngles",
                "habilidades", "fechaPostulacion", "cargoAlQueSePostulo",
                "estadoPostulacion", "estadoEtiqueta",
                "fechaHoraEntrevista", "modalidadEntrevista", "tituloAcademico");

        var huerfanos = componentesDe(PerfilLaboralDto.class).stream()
                .filter(c -> !deEstudiante.contains(c) && !deLaPostulacion.contains(c))
                .toList();

        assertThat(huerfanos)
                .as("Campos del perfil sin origen conocido en el modelo")
                .isEmpty();
    }
}
