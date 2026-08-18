package com.novacrm.ia.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * @param pregunta   lo que escribe el usuario. El tope es de 4000 y no de 500
 *                   porque el asistente del estudiante revisa y traduce el
 *                   texto que le peguen: con 500 caracteres no cabe ni el
 *                   perfil profesional de una hoja de vida, que es justo lo
 *                   que se quiere corregir.
 */
public record ConsultaAsistenteDto(
        @NotBlank(message = "La pregunta no puede estar vacía")
        @Size(max = 4000, message = "La pregunta no puede superar 4000 caracteres")
        String pregunta,
        @Size(max = 120, message = "La ruta actual no puede superar 120 caracteres")
        String rutaActual
) {}
