package com.novacrm.hv.dto;

import java.util.UUID;

public record ResultadoEstudiante(UUID estudianteId, String nombre, boolean generada, String error) {}
