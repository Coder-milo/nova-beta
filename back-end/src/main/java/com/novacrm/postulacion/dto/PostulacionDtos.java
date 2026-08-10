package com.novacrm.postulacion.dto;

import com.novacrm.postulacion.EstadoPostulacion;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

/** Todo lo que viaja del y hacia el modulo de postulaciones. */
public final class PostulacionDtos {

    private PostulacionDtos() {
    }

    /**
     * Alta de una postulacion.
     *
     * <p>Solo empresa y cargo son obligatorios. Una postulacion que sale de una
     * feria no tiene enlace, ni vacante registrada, ni portal; pedir esos datos
     * para poder anotarla es lo que hace que la gente deje de anotarlas.
     */
    public record CrearPostulacion(
            /** Solo lo manda el equipo. Un estudiante siempre se postula a si mismo. */
            UUID estudianteId,

            /** Si sale de una vacante del sistema. Opcional. */
            UUID vacanteId,

            @NotBlank(message = "Falta el nombre de la empresa")
            @Size(max = 255) String empresaNombre,

            @NotBlank(message = "Falta el cargo al que se postulo")
            @Size(max = 255) String cargo,

            @Size(max = 60) String canal,
            LocalDate fechaPostulacion,
            EstadoPostulacion estado,

            @Pattern(regexp = "^$|^https?://.+",
                     message = "El enlace debe empezar por http:// o https://")
            @Size(max = 1000) String urlOferta,

            @Size(max = 2000) String observaciones) {}

    /**
     * Actualizacion del seguimiento de una postulacion.
     *
     * <p>Es lo que el estudiante toca desde su cuenta. Los campos nulos no se
     * tocan, para que actualizar solo el estado no borre la nota que dejo el
     * coordinador la semana pasada.
     *
     * <p>Los topes de {@code resultado} y {@code observaciones} llegaron tarde
     * porque sus columnas son TEXT y la base no se quejaba: los limites de este
     * archivo estan donde el motor los obligaba, no donde hacen falta. Los dos
     * campos los escribe el rol con menos permisos y {@code resultado} ademas se
     * copia al historial de seguimiento, que es lo que el equipo lee para
     * entender que ha pasado con esa persona; sin tope, una sola nota puede
     * dejar ese panel inservible.
     */
    public record ActualizarPostulacion(
            EstadoPostulacion estado,
            LocalDate fechaRespuesta,
            @Size(max = 1000) String resultado,
            @Size(max = 2000) String observaciones,
            @Size(max = 60) String canal) {}

    public record PostulacionResponse(
            UUID id,
            UUID estudianteId,
            String estudianteNombre,
            UUID vacanteId,
            String empresaNombre,
            String cargo,
            String canal,
            LocalDate fechaPostulacion,
            String estado,
            String estadoEtiqueta,
            boolean estadoFinal,
            LocalDate fechaRespuesta,
            /** Dias entre la postulacion y la respuesta; nulo si aun no contestan. */
            Integer diasHastaRespuesta,
            /** Dias desde que se envio, para las que siguen esperando. */
            Integer diasEsperando,
            String resultado,
            String observaciones,
            String gestionadaPor,
            boolean registradaPorEstudiante,
            String urlOferta,
            /** Marcada como contratada por el estudiante y sin colocacion registrada. */
            boolean esperandoConfirmacion) {}

    /** Cifras de cabecera del panel de postulaciones. */
    public record ResumenPostulaciones(
            long total,
            long activas,
            long conRespuesta,
            long entrevistas,
            long contratados,
            long sinRespuesta) {}
}
