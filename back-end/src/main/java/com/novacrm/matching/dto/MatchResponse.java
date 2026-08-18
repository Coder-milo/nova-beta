package com.novacrm.matching.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record MatchResponse(
        UUID id,
        UUID estudianteId,
        UUID vacanteId,
        String vacanteTitulo,
        String vacanteEmpresa,
        String vacanteUbicacion,
        String vacanteUrlOrigen,
        String vacanteUrlAplicar,
        String vacanteRangoSalarial,
        String vacanteModalidadTrabajo,
        String vacanteRequisitos,

        // Detalle para decidir si vale la pena postularse, sin salir de la ficha.
        // Todos pueden venir nulos: una oferta de portal rara vez trae todo.
        String vacanteDescripcion,
        String vacanteCiudad,
        String vacanteTipoContrato,
        String vacanteJornada,
        String vacanteNivelInglesRequerido,
        Integer vacanteAniosExperienciaRequeridos,
        LocalDateTime vacanteFechaExpiracion,
        String vacanteFuente,

        BigDecimal puntaje,
        boolean notificado,
        boolean postulado,
        Instant createdAt,

        /**
         * Por que se recomendo, criterio por criterio, de 0 a 1.
         *
         * <p>Al estudiante se le mostraba el escalar crudo como
         * "% Compatibilidad" sin una sola razon detras. Nulo en los matches
         * anteriores a que se guardara el desglose: no habia con que
         * rellenarlos.
         */
        List<RazonDeMatch> razones,

        /**
         * Fraccion del peso que tenia datos reales al puntuar.
         *
         * <p>Un 90% respaldado por un solo criterio no es lo mismo que un 70%
         * respaldado por los cinco, y hasta ahora los dos se veian igual.
         */
        BigDecimal cobertura
) {
    /**
     * Un criterio evaluado.
     *
     * @param criterio nombre legible ("Inglés", "Ubicación")
     * @param ratio    0 a 1; cuanto cumple el participante ese criterio
     * @param peso     cuanto pesaba en el total, para poder ordenar por importancia
     */
    public record RazonDeMatch(String criterio, BigDecimal ratio, int peso) {}
}
