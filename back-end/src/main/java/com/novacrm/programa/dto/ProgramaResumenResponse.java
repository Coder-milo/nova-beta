package com.novacrm.programa.dto;

public record ProgramaResumenResponse(
        long totalEstudiantes,
        long activos,
        long graduados,
        long retirados,
        long enProceso,
        long conInformacionIncompleta,
        long hojasDeVidaGeneradas,
        long documentos
) {}
