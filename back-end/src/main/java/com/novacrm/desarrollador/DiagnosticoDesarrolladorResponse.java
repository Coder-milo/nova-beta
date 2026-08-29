package com.novacrm.desarrollador;

import java.time.Instant;
import java.util.List;

/**
 * Vista técnica deliberadamente reducida para el rol DESARROLLADOR.
 *
 * <p>Expone solamente estados operativos. No incluye secretos, variables de
 * entorno, hosts, usuarios, nombres de estudiantes ni detalles internos de los
 * health checks.
 */
public record DiagnosticoDesarrolladorResponse(
        String estado,
        Instant generadoEn,
        List<Componente> componentes,
        List<Integracion> integraciones,
        Runtime runtime) {

    public record Componente(String nombre, String estado) {}

    public record Integracion(
            String id,
            String nombre,
            String categoria,
            boolean configurada,
            String resumen,
            String advertencia) {}

    public record Runtime(String javaVersion, String perfilActivo) {}
}
