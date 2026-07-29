package com.novacrm.hv.dto;

import java.time.Instant;
import java.util.UUID;

public record HojaDeVidaResponse(UUID id, UUID estudianteId, String estudianteNombre,
                                 UUID plantillaId, String plantillaNombre,
                                 int numeroVersion, boolean actual, String generadaPor,
                                 Instant createdAt) {}
