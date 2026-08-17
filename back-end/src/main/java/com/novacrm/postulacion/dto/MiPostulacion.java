package com.novacrm.postulacion.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Una postulación vista por el estudiante que la hizo.
 *
 * <p>Existe como lista blanca aparte porque {@code /postulaciones/mias} devolvía
 * el mismo {@code PostulacionResponse} que usa gestión, con todo dentro. El
 * estudiante recibía —aunque la pantalla no los pintara, que da igual: van en la
 * respuesta— quién de la institución lleva su caso, la fecha del próximo
 * seguimiento interno y el correo de contacto del reclutador.
 *
 * <p>Es el mismo corte que ya se hizo en {@code VacanteController} —«el
 * estudiante ve el anuncio; no ve cómo lo gestiona el equipo»— y en
 * {@code PerfilLaboralDto} para las empresas. Cuando la regla es la misma tres
 * veces, conviene que el tipo también lo diga.
 *
 * <p>Lo que <strong>sí</strong> viaja de la entrevista es lo que hace falta para
 * presentarse a ella: cuándo, en qué modalidad, dónde, con quién y a qué
 * teléfono. Ocultarle a alguien la hora de su propia cita para proteger un dato
 * interno sería proteger el dato equivocado.
 *
 * @param observaciones las escribe el propio estudiante al registrar una
 *                      postulación suya, así que devolvérselas no revela nada:
 *                      es su texto
 * @param contactoTelefono el del contacto en la empresa. Se conserva porque
 *                      quien va a una entrevista y se retrasa o no encuentra la
 *                      oficina necesita a quién llamar
 */
public record MiPostulacion(
        java.util.UUID id,
        java.util.UUID vacanteId,
        String empresaNombre,
        String cargo,
        String canal,
        LocalDate fechaPostulacion,
        String estado,
        String estadoEtiqueta,
        boolean estadoFinal,
        LocalDate fechaRespuesta,
        Integer diasEsperando,
        String resultado,
        String observaciones,
        boolean registradaPorEstudiante,
        String urlOferta,
        boolean esperandoConfirmacion,

        LocalDateTime fechaHoraEntrevista,
        String modalidadEntrevista,
        String modalidadEtiqueta,
        String lugarEntrevista,
        String contactoNombre,
        String contactoTelefono,
        boolean entrevistaPendiente,
        boolean entrevistaVencida,
        Long horasParaEntrevista) {

    // Fuera, y cada uno por su motivo:
    //
    //   estudianteId / estudianteNombre  es el propio estudiante
    //   gestionadaPor                    quién de la institución lleva el caso
    //   proximoSeguimiento               fecha de trabajo interno del equipo
    //   contactoEmail                    el canal del equipo con el reclutador;
    //                                    la negociación de la cita pasa por ahí
    //   diasHastaRespuesta               métrica de gestión, no de la persona
}
