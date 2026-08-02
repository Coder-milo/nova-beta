package com.novacrm.scraper.fuente;

/**
 * Una fuente de la que se pueden traer ofertas de empleo.
 *
 * <p>Sustituye a {@code PortalScraper}, cuyo contrato mentia en tres cosas:
 * decia devolver las vacantes encontradas pero en realidad las guardaba por su
 * cuenta y el llamador solo contaba el tamano de la lista; recibia una
 * {@code ubicacion} que ninguna implementacion usaba, de modo que el bucle
 * termino×ciudad disparaba cinco peticiones identicas por termino; y no tenia
 * como avisar de que una consulta habia fallado.
 *
 * <p>Aqui una fuente solo consulta y traduce. Guardar, deduplicar y enriquecer
 * es trabajo de {@code ScrapingService}, en un solo sitio y fuera de la
 * transaccion que abarca la red.
 */
public interface FuenteDeVacantes {

    /** Nombre corto, el que se guarda en {@code Vacante.fuente}. */
    String nombre();

    /** A quien le sirven las ofertas de esta fuente. */
    Segmento segmento();

    /**
     * Si la fuente filtra por ciudad.
     *
     * <p>Las que no —un tablero de empleo remoto, por ejemplo— reciben la
     * ciudad como {@code null} y se consultan una sola vez por termino, en vez
     * de una vez por cada ciudad del cohorte con resultado identico.
     */
    default boolean filtraPorCiudad() {
        return false;
    }

    /** Si esta configurada y activa. Una fuente sin credenciales no se consulta. */
    default boolean estaHabilitada() {
        return true;
    }

    /**
     * Cuantas consultas admite por corrida.
     *
     * <p>Las APIs gratuitas con tope mensual duro —JSearch da 200— se agotan en
     * pocos dias si cada corrida dispara decenas de peticiones.
     */
    default int maximoConsultasPorCorrida() {
        return Integer.MAX_VALUE;
    }

    /**
     * @param termino que buscar; nunca nulo ni vacio
     * @param ciudad  ciudad, o {@code null} si {@link #filtraPorCiudad()} es falso
     */
    ResultadoBusqueda buscar(String termino, String ciudad);
}
