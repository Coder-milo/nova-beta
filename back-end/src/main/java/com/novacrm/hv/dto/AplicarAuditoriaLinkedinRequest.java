package com.novacrm.hv.dto;

/**
 * Petición para registrar la aprobación del hito de optimización de LinkedIn
 * y opcionalmente sincronizar los campos extraídos con el perfil del estudiante.
 */
public record AplicarAuditoriaLinkedinRequest(
        String linkedinUrl,
        boolean sincronizarPerfil,
        DatosHvDto datosASincronizar
) {}
