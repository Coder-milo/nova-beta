package com.novacrm.scraper.portal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.scraper.fuente.FuenteDeVacantes;
import com.novacrm.scraper.fuente.OfertaCruda;
import com.novacrm.scraper.fuente.ResultadoBusqueda;
import com.novacrm.scraper.fuente.Segmento;
import com.novacrm.vacante.Vacante;
import org.jsoup.Jsoup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Lectura de ofertas de elempleo.com a partir del atributo
 * {@code data-ga4-offerdata} de la pagina de resultados, que trae la oferta en
 * JSON (id, titulo, empresa, ubicacion, salario, cargos equivalentes).
 *
 * <p><strong>Desactivado por defecto y a proposito.</strong> Extraer contenido
 * de un portal suele estar restringido por sus condiciones de uso, y hacerlo
 * sin permiso expone al programa y a sus aliados. Activarlo con
 * {@code app.scraping.elempleo.enabled=true} debe ser una decision consciente,
 * tomada solo si existe un acuerdo o un servicio contratado con el portal que
 * lo ampare.
 *
 * <p>Cuando se activa, se identifica con un agente propio —para que el portal
 * sepa quien consulta y pueda contactar— y espera entre peticiones para no
 * cargar su servidor.
 */
@Component
public class ElempleoScraper implements FuenteDeVacantes {

    private static final Logger log = LoggerFactory.getLogger(ElempleoScraper.class);
    private static final String SITE_ROOT = "https://www.elempleo.com";
    private static final String PORTAL = "ELEMPLEO";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Agente identificable: nada de hacerse pasar por un navegador. */
    private static final String USER_AGENT =
            "NOVA-CRM/1.0 (+programa de empleabilidad CAC; contacto: coordinacion@novacrm.com)";

    /** Pausa entre peticiones para no saturar el portal. */
    private static final long PAUSA_MS = 2_000;

    private final boolean habilitado;

    public ElempleoScraper(@org.springframework.beans.factory.annotation.Value(
                                   "${app.scraping.elempleo.enabled:false}") boolean habilitado) {
        this.habilitado = habilitado;
        if (habilitado) {
            log.warn("El scraping de elempleo.com esta ACTIVADO. Asegurate de contar con "
                    + "autorizacion del portal: sus condiciones de uso pueden prohibirlo.");
        }
    }

    @Override
    public String nombre() {
        return PORTAL;
    }

    @Override
    public Segmento segmento() {
        return Segmento.LOCAL_COLOMBIA;
    }

    @Override
    public boolean estaHabilitada() {
        return habilitado;
    }

    @Override
    public ResultadoBusqueda buscar(String termino, String ciudad) {
        if (!habilitado) {
            return ResultadoBusqueda.vacio();
        }
        List<OfertaCruda> resultados = new ArrayList<>();
        try {
            Thread.sleep(PAUSA_MS);
            // La búsqueda es por palabra clave; la ubicación llega por oferta en el JSON.
            var url = SITE_ROOT + "/co/ofertas-empleo/"
                    + termino.trim().toLowerCase().replace(" ", "-");
            var doc = Jsoup.connect(url)
                    .userAgent(USER_AGENT)
                    .timeout(15000)
                    .get();

            for (var card : doc.select(".js-area-bind[data-ga4-offerdata]")) {
                try {
                    JsonNode oferta = MAPPER.readTree(card.attr("data-ga4-offerdata"));
                    String id = oferta.path("id").asText("");
                    String titulo = oferta.path("title").asText("");
                    if (id.isBlank() || titulo.isBlank()) continue;

                    var vacante = new Vacante();
                    vacante.setTitulo(titulo);
                    vacante.setFuente(PORTAL);
                    vacante.setHashDedup(sha256(PORTAL + "|" + id));
                    vacante.setUbicacion(textoONull(oferta, "location"));
                    vacante.setRangoSalarial(textoONull(oferta, "salary"));

                    // Cargos equivalentes + tags alimentan los términos del matching.
                    String descripcion = (textoPlano(oferta, "equivalentPositions")
                            + " " + textoPlano(oferta, "tags")).trim();
                    if (!descripcion.isBlank()) vacante.setDescripcion(descripcion);

                    String dataUrl = card.attr("data-url");
                    if (!dataUrl.isBlank()) vacante.setUrlOrigen(SITE_ROOT + dataUrl);

                    vacante.setSegmento(Segmento.LOCAL_COLOMBIA);
                    vacante.setActivo(true);
                    vacante.setFechaPublicacion(java.time.LocalDateTime.now());

                    resultados.add(new OfertaCruda(vacante, textoONull(oferta, "company")));
                } catch (Exception e) {
                    log.warn("Error parseando oferta en Elempleo: {}", e.getMessage());
                }
            }
        } catch (InterruptedException e) {
            // No basta con registrarlo: hay que devolver el flag para que quien
            // gobierna el hilo pueda detenerlo de verdad.
            Thread.currentThread().interrupt();
            return ResultadoBusqueda.fallo("consulta a Elempleo interrumpida");
        } catch (Exception e) {
            return ResultadoBusqueda.fallo("error consultando Elempleo: " + e.getMessage());
        }
        return ResultadoBusqueda.de(resultados);
    }

    private static String textoONull(JsonNode nodo, String campo) {
        String valor = nodo.path(campo).asText("");
        return valor.isBlank() ? null : valor;
    }

    /**
     * Texto de un campo que puede venir como cadena o como lista.
     *
     * <p>{@code equivalentPositions} y {@code tags} llegan como arrays, y sobre
     * un nodo array {@code asText("")} devuelve el valor por defecto: la
     * descripcion quedaba vacia siempre, que es justo el texto del que el
     * matching saca los terminos de esta fuente.
     */
    private static String textoPlano(JsonNode nodo, String campo) {
        JsonNode valor = nodo.path(campo);
        if (valor.isArray()) {
            var partes = new ArrayList<String>();
            valor.forEach(elemento -> {
                String texto = elemento.isValueNode() ? elemento.asText("") : elemento.toString();
                if (!texto.isBlank()) partes.add(texto);
            });
            return String.join(" ", partes);
        }
        return valor.asText("");
    }

    private static String sha256(String input) {
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of()
                    .formatHex(digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
