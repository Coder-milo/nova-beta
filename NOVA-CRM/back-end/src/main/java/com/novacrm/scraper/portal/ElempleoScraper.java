package com.novacrm.scraper.portal;

import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.jsoup.Jsoup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class ElempleoScraper implements PortalScraper {

    private static final Logger log = LoggerFactory.getLogger(ElempleoScraper.class);
    private static final String BASE_URL = "https://www.elempleo.com/co";
    private static final String PORTAL = "ELEMPLEO";

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
            var url = BASE_URL + "/busqueda/" + keyword.replace(" ", "-")
                    + (ubicacion != null && !ubicacion.isBlank() ? "?ubicacion=" + ubicacion : "");
            var doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0")
                    .timeout(15000)
                    .get();

            doc.select(".offer-card").forEach(card -> {
                try {
                    var tituloEl = card.selectFirst(".offer-card__title a");
                    if (tituloEl == null) return;

                    var empresaEl = card.selectFirst(".offer-card__company a");
                    var hashDedup = sha256(PORTAL + "|" + tituloEl.text()
                            + "|" + (empresaEl != null ? empresaEl.text() : ""));
                    if (vacanteRepository.findByHashDedup(hashDedup).isPresent()) return;

                    var vacante = new Vacante();
                    vacante.setTitulo(tituloEl.text());
                    vacante.setUrlOrigen(tituloEl.absUrl("href"));
                    vacante.setFuente(PORTAL);
                    vacante.setHashDedup(hashDedup);

                    if (empresaEl != null) {
                        vacante.setEmpresa(empresaRepository.findByNombre(empresaEl.text())
                                .orElse(null));
                    }

                    var ubicacionEl = card.selectFirst(".offer-card__location");
                    if (ubicacionEl != null) vacante.setUbicacion(ubicacionEl.text());

                    var salarioEl = card.selectFirst(".offer-card__salary");
                    if (salarioEl != null) vacante.setRangoSalarial(salarioEl.text());

                    var descEl = card.selectFirst(".offer-card__description");
                    if (descEl != null) vacante.setDescripcion(descEl.text());

                    vacante.setActivo(true);
                    vacante.setFechaPublicacion(java.time.LocalDateTime.now());

                    resultados.add(vacanteRepository.save(vacante));
                } catch (Exception e) {
                    log.warn("Error parseando oferta en Elempleo: {}", e.getMessage());
                }
            });
        } catch (Exception e) {
            log.error("Error scraping Elempleo: {}", e.getMessage());
        }
        return resultados;
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
