package com.novacrm.hv.dto;

import java.time.Instant;
import java.util.UUID;

public record PlantillaResponse(UUID id, String codigo, String nombre, String colorPrimario,
                                boolean predeterminada, boolean tieneArchivo,
                                boolean tieneHtml, String tipoArchivo,
                                int camposDetectados, boolean automatica,
                                Instant createdAt) {}
