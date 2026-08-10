package com.novacrm.perfil.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Un curso o titulo de la hoja de vida, escrito por el propio estudiante.
 *
 * <p>Los topes son los de las columnas. Ver {@link ExperienciaRequest} para el
 * porque: sin ellos el texto largo llega a la base y sale un 22001 crudo en vez
 * de un mensaje que se pueda leer.
 */
public record FormacionRequest(
        @NotBlank @Size(max = 30) String tipo,
        @NotBlank @Size(max = 255) String institucion,
        @NotBlank @Size(max = 255) String programa,
        LocalDate fechaInicio,
        LocalDate fechaFin,
        @Size(max = 30) String estado
) {}
