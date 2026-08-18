package com.novacrm.busqueda.dto;

import java.util.List;

public record BusquedaResponse(
    List<ResultadoBusqueda> estudiantes,
    List<ResultadoBusqueda> empresas,
    List<ResultadoBusqueda> vacantes,
    List<ResultadoBusqueda> programas,
    List<ResultadoBusqueda> documentos,
    List<ResultadoBusqueda> colocaciones
) {}
