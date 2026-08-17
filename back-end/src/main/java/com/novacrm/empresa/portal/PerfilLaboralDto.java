package com.novacrm.empresa.portal;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Lo unico que una empresa ve de un estudiante.
 *
 * <p>Este record es una <strong>lista blanca</strong>, y esa es toda su razon de
 * ser. La alternativa —reutilizar {@code EstudianteResponse} y confiar en que
 * nadie pinte los campos de mas— falla sola: basta con que alguien añada un
 * campo al DTO de gestion, que es lo que pasa cada semana, para que ese campo
 * empiece a viajar al portal externo sin que nadie lo decida. Aqui añadir un
 * campo obliga a escribirlo, y escribirlo obliga a pensarlo.
 *
 * <p><strong>Lo que la entidad {@code Estudiante} tiene y aqui NO sale:</strong>
 * {@code numeroDocumento}, {@code tipoDocumento}, {@code fechaNacimiento},
 * {@code genero}, {@code nacionalidad}, {@code direccion}, {@code barrio},
 * {@code telefono}, {@code celular}, {@code email}, {@code fotoUrl},
 * {@code linkedinAccessToken}, {@code estadoAcademico} y el historial de
 * seguimiento. Ninguno hace falta para decidir a quien se entrevista, y todos
 * son lo que no puede salir de la institucion.
 *
 * <p>Tampoco salen las <em>otras</em> postulaciones de esa persona. Una empresa
 * ve como va su propio proceso; saber que el candidato esta hablando con otras
 * tres es informacion que se usaria para negociar y que el estudiante no ha
 * dado a nadie.
 *
 * <p>El contacto va por dentro: la empresa escribe desde el portal y el mensaje
 * sale por el sistema. Entregar el correo o el telefono convertiria una
 * postulacion en una cesion de datos.
 */
public record PerfilLaboralDto(
        /** Identificador de la postulacion, no del estudiante: es lo que la empresa maneja. */
        UUID postulacionId,

        /**
         * Nombre y apellido.
         *
         * <p>Sale porque no se puede entrevistar a alguien sin saber como se
         * llama. Es el unico dato identificativo que cruza la frontera.
         */
        String nombreCompleto,

        /** Programa formativo que cursa o curso. */
        String programa,

        /** Ciudad. Sin direccion ni barrio: basta para saber si el puesto le queda cerca. */
        String ciudad,

        /** Titulo academico. */
        String tituloAcademico,

        /** Resumen profesional, redactado por el propio estudiante. */
        String perfilProfesional,

        String ultimoCargo,
        String sectorExperiencia,
        Integer aniosExperiencia,

        /** Nivel de ingles del catalogo, p. ej. «B2 - Intermedio alto». */
        String nivelIngles,

        List<String> habilidades,

        /** Si aceptaria mudarse. Nulo cuando no se ha preguntado. */
        Boolean disponibilidadMovilidad,

        // ── Lo relativo a ESTA postulacion, no a la persona ──────────────────

        LocalDate fechaPostulacion,
        String cargoAlQueSePostulo,

        /** En que punto va el proceso con esta empresa. */
        String estadoPostulacion,
        String estadoEtiqueta,

        /** Fecha y hora de la entrevista, si la hay. */
        java.time.LocalDateTime fechaHoraEntrevista,
        String modalidadEntrevista) {
}
