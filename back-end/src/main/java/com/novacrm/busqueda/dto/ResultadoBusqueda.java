package com.novacrm.busqueda.dto;

import java.util.UUID;

public record ResultadoBusqueda(
    UUID id,
    String titulo,
    String subtitulo,
    String tipo
) {}
