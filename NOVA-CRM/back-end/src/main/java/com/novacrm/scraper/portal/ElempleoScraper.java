package com.novacrm.scraper.portal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.jsoup.Jsoup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Scraper de elempleo.com. La página de resultados incluye por cada oferta un
 * atributo data-ga4-offerdata con JSON estructurado (id, título, empresa,
 * ubicación, salario, cargos equivalentes) — se parsea ese JSON en lugar de
 * depender de la estructura visual del HTML.
 */
@Component
public class ElempleoScraper implements PortalScraper {

    private static final Logger log = LoggerFactory.getLogger(ElempleoScraper.class);
    private static final String SITE_ROOT = "https://www.elempleo.com";
    private static final String PORTAL = "ELEMPLEO";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final VacanteRepository vacanteRepository;
    private final EmpresaRepository empresaRepository;

    public ElempleoScraper(VacanteRepository vacanteRepository, EmpresaRepository empresaRepository) {
        this.vacanteRepository = vacanteRepository;
        this.empresaRepository = empresaRepository;
    }

    @Override
    public List<Vacante> buscar(String keyword, String ubicacion) {
        List<Vacante> resultados = new ArrayList<>();
        try {
            // La búsqueda es por palabra clave; la ubicación llega por oferta en el JSON.
            var url = SITE_ROOT + "/co/ofertas-empleo/"
                    + keyword.trim().toLowerCase().replace(" ", "-");
            var doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                    .timeout(15000)
                    .get();

            for (var card : doc.select(".js-area-bind[data-ga4-offerdata]")) {
                try {
                    JsonNode oferta = MAPPER.readTree(card.attr("data-ga4-offerdata"));
                    String id = oferta.path("id").asText("");
                    String titulo = oferta.path("title").asText("");
                    if (id.isBlank() || titulo.isBlank()) continue;

                    var hashDedup = sha256(PORTAL + "|" + id);
                    if (vacanteRepository.findByHashDedup(hashDedup).isPresent()) continue;

                    var vacante = new Vacante();
                    vacante.setTitulo(titulo);
                    vacante.setFuente(PORTAL);
                    vacante.setHashDedup(hashDedup);
                    vacante.setUbicacion(textoONull(oferta, "location"));
                    vacante.setRangoSalarial(textoONull(oferta, "salary"));

                    // Cargos equivalentes + tags alimentan los términos del matching.
                    String descripcion = (oferta.path("equivalentPositions").asText("")
                            + " " + oferta.path("tags").asText("")).trim();
                    if (!descripcion.isBlank()) vacante.setDescripcion(descripcion);

                    String dataUrl = card.attr("data-url");
                    if (!dataUrl.isBlank()) vacante.setUrlOrigen(SITE_ROOT + dataUrl);

                    String empresaNombre = oferta.path("company").asText("");
                    if (!empresaNombre.isBlank()) {
                        vacante.setEmpresa(empresaRepository.findByNombre(empresaNombre).orElse(null));
                    }

                    vacante.setActivo(true);
                    vacante.setFechaPublicacion(java.time.LocalDateTime.now());

                    resultados.add(vacanteRepository.save(vacante));
                } catch (Exception e) {
                    log.warn("Error parseando oferta en Elempleo: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Error scraping Elempleo: {}", e.getMessage());
        }
        return resultados;
    }

    private static String textoONull(JsonNode nodo, String campo) {
        String valor = nodo.path(campo).asText("");
        return valor.isBlank() ? null : valor;
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

    @Override
    public String getPortalNombre() {
        return PORTAL;
    }
}
