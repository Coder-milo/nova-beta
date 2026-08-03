package com.novacrm.plataforma.dto;

import java.util.List;

public record PlataformaAsignacionRequest(
        List<java.util.UUID> plataformaIds
) {}