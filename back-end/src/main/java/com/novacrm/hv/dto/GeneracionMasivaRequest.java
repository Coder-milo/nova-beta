package com.novacrm.hv.dto;

import java.util.List;
import java.util.UUID;

public record GeneracionMasivaRequest(UUID programaId, List<UUID> estudianteIds,
                                      UUID plantillaId, boolean soloCompletos) {}
