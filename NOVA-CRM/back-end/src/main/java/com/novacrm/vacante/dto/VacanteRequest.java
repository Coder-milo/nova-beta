package com.novacrm.vacante.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * Alta manual de una oferta por parte del coordinador.
 *
 * <p>Basta con pegar el enlace: el titulo y la descripcion se completan solos
 * leyendo la pagina, y lo que quede se puede corregir a mano.
 */
public record VacanteRequest(

        /** Enlace a la oferta original. Unico campo imprescindible. */
        @NotBlank(message = "El enlace de la oferta es obligatorio")
        @Pattern(regexp = "^https?://.+", message = "El enlace debe empezar por http:// o https://")
        String url,

        @Size(max = 255) String titulo,
        String descripcion,
        String requisitos,
        @Size(max = 255) String ubicacion,
        @Size(max = 255) String rangoSalarial,
        @Size(max = 255) String tipoContrato,
        @Size(max = 255) String modalidadTrabajo,
        @Size(max = 255) String nivelInglesRequerido,
        Integer aniosExperienciaRequeridos,
        @Size(max = 255) String empresaNombre,

        /** Cuando deja de estar vigente. Sin fecha, permanece abierta. */
        LocalDateTime fechaExpiracion) {}
