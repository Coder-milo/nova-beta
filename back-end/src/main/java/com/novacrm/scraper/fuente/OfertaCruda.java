package com.novacrm.scraper.fuente;

import com.novacrm.vacante.Vacante;

/**
 * Una oferta tal como la devuelve una fuente, antes de guardarla.
 *
 * <p>El nombre de la empresa viaja aparte porque en el modelo propio
 * {@code Empresa} es una entidad del directorio: resolverla —o crearla— es
 * decision de quien persiste, no de quien consulta la API.
 *
 * @param vacante      ya mapeada al modelo propio, todavia sin enriquecer
 * @param nombreEmpresa tal como lo publica la fuente; puede ser nulo
 */
public record OfertaCruda(Vacante vacante, String nombreEmpresa) {
}
