package com.novacrm.hv.dto;

import java.util.List;

public record GeneracionMasivaResponse(int solicitadas, int generadas, int fallidas,
                                       List<ResultadoEstudiante> resultados) {}
