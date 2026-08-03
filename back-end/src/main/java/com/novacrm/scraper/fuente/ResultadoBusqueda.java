package com.novacrm.scraper.fuente;

import java.util.List;

/**
 * Lo que devuelve una consulta a una fuente.
 *
 * <p>Distingue "no encontre nada" de "no pude preguntar", que es justo lo que
 * el contrato anterior perdia: los conectores se tragaban toda excepcion y
 * devolvian lista vacia, asi que una corrida en la que se cayo la red se veia
 * en el panel exactamente igual que una tranquila sin ofertas nuevas.
 *
 * @param ofertas lo encontrado; vacio tanto si no hubo resultados como si fallo
 * @param error   descripcion del fallo, o {@code null} si la consulta salio bien
 */
public record ResultadoBusqueda(List<OfertaCruda> ofertas, String error) {

    public static ResultadoBusqueda de(List<OfertaCruda> ofertas) {
        return new ResultadoBusqueda(ofertas == null ? List.of() : List.copyOf(ofertas), null);
    }

    public static ResultadoBusqueda vacio() {
        return new ResultadoBusqueda(List.of(), null);
    }

    public static ResultadoBusqueda fallo(String motivo) {
        return new ResultadoBusqueda(List.of(), motivo == null ? "error desconocido" : motivo);
    }

    public boolean fallo() {
        return error != null;
    }
}
