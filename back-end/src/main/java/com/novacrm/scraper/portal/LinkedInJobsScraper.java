package com.novacrm.scraper.portal;

import com.novacrm.scraper.fuente.AreaMetropolitana;
import com.novacrm.scraper.fuente.FuenteDeVacantes;
import com.novacrm.scraper.fuente.OfertaCruda;
import com.novacrm.scraper.fuente.ReintentoConEspera;
import com.novacrm.scraper.fuente.ResultadoBusqueda;
import com.novacrm.scraper.fuente.Segmento;
import com.novacrm.vacante.Vacante;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Conector de empleo para LinkedIn Jobs Colombia mediante su endpoint público de invitados.
 *
 * <p>Extrae vacantes corporativas, tecnológicas y de BPO bilingüe sin necesidad de credenciales
 * ni ejecución de JavaScript pesado, apuntando a Barranquilla y el departamento del Atlántico.
 */
@Component
public class LinkedInJobsScraper implements FuenteDeVacantes {

    private static final Logger log = LoggerFactory.getLogger(LinkedInJobsScraper.class);
    private static final String PORTAL = "LINKEDIN";
    private static final String SEARCH_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 NOVA-CRM/1.0";
    private static final long PAUSA_MS = 300;
    private static final Pattern JOB_ID_PATTERN = Pattern.compile("([0-9]{8,12})");

    private final boolean habilitado;

    public LinkedInJobsScraper(@Value("${app.scraping.linkedin.enabled:true}") boolean habilitado) {
        this.habilitado = habilitado;
        if (habilitado) {
            log.info("Conector de LinkedIn Jobs ACTIVADO para extracción de vacantes.");
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
    public boolean filtraPorCiudad() {
        return true;
    }

    @Override
    public boolean estaHabilitada() {
        return habilitado;
    }

    @Override
    public int maximoConsultasPorCorrida() {
        return 8;
    }

    @Override
    public ResultadoBusqueda buscar(String termino, String ciudad) {
        if (!habilitado) {
            return ResultadoBusqueda.vacio();
        }
        if (termino == null || termino.isBlank()) {
            return ResultadoBusqueda.vacio();
        }

        List<OfertaCruda> resultados = new ArrayList<>();
        try {
            String ciudadBusqueda = (ciudad != null && !ciudad.isBlank()) ? ciudad : "Barranquilla";
            String ubicacionParam = ciudadBusqueda.toLowerCase().contains("colombia")
                    ? ciudadBusqueda
                    : ciudadBusqueda + ", Atlantico, Colombia";

            String url = SEARCH_URL
                    + "?keywords=" + URLEncoder.encode(termino.trim(), StandardCharsets.UTF_8)
                    + "&location=" + URLEncoder.encode(ubicacionParam, StandardCharsets.UTF_8)
                    + "&f_TPR=r604800"
                    + "&start=0";

            Thread.sleep(PAUSA_MS);

            Document doc = ReintentoConEspera.documento(PORTAL, () -> Jsoup.connect(url)
                    .userAgent(USER_AGENT)
                    .header("Accept-Language", "es-ES,es;q=0.9,en;q=0.8")
                    .timeout(15000));

            resultados.addAll(parsear(doc, ciudadBusqueda));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResultadoBusqueda.fallo("Consulta a LinkedIn Jobs interrumpida");
        } catch (Exception e) {
            log.warn("Error consultando LinkedIn Jobs para '{}' en '{}': {}", termino, ciudad, e.getMessage());
            return ResultadoBusqueda.fallo("Error consultando LinkedIn Jobs: " + e.getMessage());
        }

        return ResultadoBusqueda.de(resultados);
    }

    /**
     * Parsea los elementos {@code <li>} devueltos por el endpoint de LinkedIn.
     */
    static List<OfertaCruda> parsear(Document doc, String ciudadDefecto) {
        List<OfertaCruda> resultados = new ArrayList<>();
        Elements cards = doc.select("li");

        for (Element card : cards) {
            try {
                Element linkElem = card.selectFirst("a.base-card__full-link, a[href*='/jobs/view/']");
                if (linkElem == null) {
                    continue;
                }

                String href = linkElem.attr("href").trim();
                if (href.isBlank()) {
                    continue;
                }

                // Extraer ID de la vacante de LinkedIn
                String idOferta = extraerIdOferta(href);

                // 1. Extraer y validar fecha real de publicación
                String rawDate = extraerTextoFecha(card);
                var fechaPubOpt = com.novacrm.scraper.fuente.ParserFechas.parsear(rawDate);
                if (fechaPubOpt.isEmpty()) {
                    log.debug("Oferta de LinkedIn Jobs descartada por fecha no verificable: {}", idOferta);
                    continue;
                }
                LocalDateTime fechaPub = fechaPubOpt.get();
                if (!com.novacrm.scraper.fuente.FiltroFrescura.esFresca(fechaPub)) {
                    log.debug("Oferta de LinkedIn Jobs descartada por antigüedad > 7 días: {} (fecha: {})", idOferta, fechaPub);
                    continue;
                }

                Element titleElem = card.selectFirst("h3.base-search-card__title, a.base-card__full-link");
                String titulo = titleElem != null ? titleElem.text().trim() : "";
                if (titulo.isBlank()) {
                    continue;
                }

                Element companyElem = card.selectFirst("h4.base-search-card__subtitle, a[data-tracking-control-name*='company']");
                String empresa = companyElem != null ? companyElem.text().trim() : "Empresa Confidencial";

                Element locElem = card.selectFirst("span.job-search-card__location");
                String ubicacion = locElem != null ? locElem.text().trim() : ciudadDefecto;

                Element descElem = card.selectFirst("p.job-search-card__snippet, div.job-search-card__snippet");
                String descripcion = descElem != null && !descElem.text().isBlank()
                        ? descElem.text().trim()
                        : titulo + " en " + empresa + ". Oferta de empleo bilingüe publicada en LinkedIn Jobs para " + ubicacion + ".";

                // Detección de modalidad
                String lowerText = (titulo + " " + descripcion + " " + ubicacion).toLowerCase();
                String modalidad = "Presencial";
                if (lowerText.contains("remoto") || lowerText.contains("remote") || lowerText.contains("teletrabajo")
                        || lowerText.contains("work from home") || lowerText.contains("home office")) {
                    modalidad = "Remoto";
                } else if (lowerText.contains("hibrid") || lowerText.contains("híbrid")) {
                    modalidad = "Híbrido";
                }

                Vacante vacante = new Vacante();
                vacante.setTitulo(titulo);
                vacante.setFuente(PORTAL);
                vacante.setHashDedup(sha256(PORTAL + "|" + idOferta));
                vacante.setUbicacion(ubicacion);
                vacante.setCiudad(extraerCiudad(ubicacion, ciudadDefecto));
                vacante.setModalidadTrabajo(modalidad);
                vacante.setJornada("Tiempo completo");
                vacante.setDescripcion(descripcion);
                vacante.setUrlOrigen(href);
                vacante.setUrlAplicar(href);
                vacante.setSegmento(modalidad.equals("Remoto") ? Segmento.REMOTO_INGLES : Segmento.LOCAL_COLOMBIA);
                vacante.setActivo(true);
                vacante.setFechaPublicacion(fechaPub);

                // Validación de admisibilidad geográfica
                if (AreaMetropolitana.esAtlanticoORemota(vacante)) {
                    resultados.add(new OfertaCruda(vacante, empresa));
                }
            } catch (Exception e) {
                log.warn("Error parseando tarjeta individual de LinkedIn Jobs: {}", e.getMessage());
            }
        }
        return resultados;
    }

    private static String extraerTextoFecha(Element card) {
        Element timeElem = card.selectFirst("time.job-search-card__listdate, time.job-search-card__listdate--new, time[datetime], time");
        if (timeElem != null) {
            String dt = timeElem.attr("datetime").trim();
            if (!dt.isBlank()) {
                return dt;
            }
            String txt = timeElem.text().trim();
            if (!txt.isBlank()) {
                return txt;
            }
        }
        for (Element el : card.select("span, div, p")) {
            String t = el.text().trim();
            if (t.toLowerCase().contains("hace ") || t.toLowerCase().contains("ago") || t.toLowerCase().contains("today") || t.toLowerCase().contains("yesterday")) {
                if (com.novacrm.scraper.fuente.ParserFechas.parsear(t).isPresent()) {
                    return t;
                }
            }
        }
        return null;
    }

    private static String extraerIdOferta(String href) {
        Matcher matcher = JOB_ID_PATTERN.matcher(href);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return href.replaceAll("\\?.*$", "");
    }

    private static String extraerCiudad(String ubicacion, String ciudadDefecto) {
        if (ubicacion == null || ubicacion.isBlank()) {
            return ciudadDefecto;
        }
        String lower = ubicacion.toLowerCase();
        if (lower.contains("barranquilla")) return "Barranquilla";
        if (lower.contains("soledad")) return "Soledad";
        if (lower.contains("malambo")) return "Malambo";
        if (lower.contains("galapa")) return "Galapa";
        if (lower.contains("puerto colombia")) return "Puerto Colombia";
        if (lower.contains("sabanalarga")) return "Sabanalarga";
        if (lower.contains("atlantico") || lower.contains("atlántico")) return "Barranquilla";
        return ubicacion;
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
