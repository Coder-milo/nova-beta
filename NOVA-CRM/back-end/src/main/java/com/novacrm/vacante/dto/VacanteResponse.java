package com.novacrm.vacante.dto;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

public record VacanteResponse(
        UUID id,
        String titulo,
        String descripcion,
        String requisitos,
        String ubicacion,
        String rangoSalarial,
        String tipoContrato,
        String modalidadTrabajo,
        String nivelInglesRequerido,
        Integer aniosExperienciaRequeridos,
        String fuente,
        String urlOrigen,
        String urlAplicar,
        String empresaNombre,
        LocalDateTime fechaPublicacion,
        Instant createdAt
) {}
