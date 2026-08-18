package com.novacrm.scraper.portal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.scraper.fuente.FuenteDeVacantes;
import com.novacrm.scraper.fuente.OfertaCruda;
import com.novacrm.scraper.fuente.ResultadoBusqueda;
import com.novacrm.scraper.fuente.Segmento;
import com.novacrm.vacante.Vacante;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

/**
 * Conector para la extracción de ofertas de empleo desde Magneto 365 (magneto365.com),
 * plataforma ampliamente utilizada en Colombia para BPO, tecnología y servicios.
 *
 * <p><strong>Desactivado por defecto y a propósito.</strong> La página de
 * búsqueda es un SPA renderizado por JS (Next.js RSC): el HTML no trae las
 * vacantes y la URL de búsqueda antigua responde 500. Sin un servicio
 * contratado o una API del portal, la extracción no tiene base. Reactivar con
 * {@code app.scraping.magneto.enabled=true} solo si aparece esa vía.
 */
@Component
public class MagnetoScraper implements FuenteDeVacantes {

    private static final Logger log = LoggerFactory.getLogger(MagnetoScraper.class);
    private static final String SITE_ROOT = "https://www.magneto365.com";
    private static final String PORTAL = "MAGNETO";
    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NOVA-CRM/1.0";
    private static final long PAUSA_MS = 200;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final boolean habilitado;
    private final HttpClient httpClient;

    // El valor por defecto es `false` y tiene que seguir siendolo. Estaba en
    // `true` mientras el javadoc de arriba y `application.yml` decian lo
    // contrario: bastaba con desplegar sin esa clave —otro perfil, un
    // application.yml recortado— para que el conector se encendiera solo y
    // gastara una consulta por termino y ciudad contra una pagina que no puede
    // devolver nada. Los tres sitios dicen ahora lo mismo.
    public MagnetoScraper(@Value("${app.scraping.magneto.enabled:false}") boolean habilitado) {
        this.habilitado = habilitado;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        if (habilitado) {
            log.info("Conector de Magneto 365 ACTIVADO para la extracción de ofertas.");
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
    public ResultadoBusqueda buscar(String termino, String ciudad) {
        if (!habilitado) {
            return ResultadoBusqueda.vacio();
        }

        List<OfertaCruda> resultados = new ArrayList<>();
        try {
            Thread.sleep(PAUSA_MS);
            String ciudadBusqueda = (ciudad != null && !ciudad.isBlank()) ? ciudad : "Barranquilla";
            String searchUrl = SITE_ROOT + "/co/empleos/busqueda?q="
                    + URLEncoder.encode(termino.trim(), StandardCharsets.UTF_8)
                    + "&l=" + URLEncoder.encode(ciudadBusqueda, StandardCharsets.UTF_8);

            // Intentar primero extracción vía HTML / Next.js __NEXT_DATA__ JSON si existe
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(searchUrl))
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", "text/html,application/xhtml+xml,application/json")
                    .timeout(Duration.ofSeconds(4))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                Document doc = Jsoup.parse(response.body(), searchUrl);
                Element nextData = doc.selectFirst("script#__NEXT_DATA__");

                if (nextData != null) {
                    try {
                        JsonNode root = MAPPER.readTree(nextData.html());
                        JsonNode jobsNode = root.at("/props/pageProps/initialState/jobs/data");
                        if (jobsNode.isMissingNode() || !jobsNode.isArray()) {
                            jobsNode = root.at("/props/pageProps/jobs");
                        }

                        if (jobsNode.isArray()) {
                            for (JsonNode job : jobsNode) {
                                String id = job.path("id").asText(job.path("slug").asText(""));
                                String titulo = job.path("title").asText(job.path("name").asText(""));
                                if (titulo.isBlank()) continue;

                                String empresa = job.path("company").path("name").asText("Empresa Aliada Magneto");
                                String loc = job.path("location").path("name").asText(job.path("city").asText(ciudadBusqueda));
                                String desc = job.path("description").asText(job.path("summary").asText(titulo));
                                String slug = job.path("slug").asText("");
                                String link = !slug.isBlank() ? SITE_ROOT + "/co/empleos/" + slug : searchUrl;

                                Vacante vacante = new Vacante();
                                vacante.setTitulo(titulo);
                                vacante.setFuente(PORTAL);
                                vacante.setHashDedup(sha256(PORTAL + "|" + (id.isBlank() ? titulo : id)));
                                vacante.setUbicacion(loc);
                                vacante.setCiudad(extraerCiudad(loc, ciudadBusqueda));
                                vacante.setDescripcion(desc);
                                vacante.setUrlOrigen(link);
                                vacante.setUrlAplicar(link);
                                vacante.setSegmento(Segmento.LOCAL_COLOMBIA);
                                vacante.setActivo(true);
                                vacante.setFechaPublicacion(LocalDateTime.now());

                                resultados.add(new OfertaCruda(vacante, empresa));
                            }
                        }
                    } catch (Exception e) {
                        log.debug("No se pudo extraer __NEXT_DATA__ en Magneto: {}", e.getMessage());
                    }
                }

                // Fallback a selectores DOM HTML estándar si __NEXT_DATA__ no dio frutos
                if (resultados.isEmpty()) {
                    var tarjetas = doc.select("a[href*='/empleos/'], div[class*='JobCard'], article");
                    for (Element card : tarjetas) {
                        String href = card.attr("href");
                        String titulo = card.selectFirst("h2, h3, div[class*='title'], span[class*='title']") != null
                                ? card.selectFirst("h2, h3, div[class*='title'], span[class*='title']").text().trim()
                                : card.text().trim();

                        if (titulo.isBlank() || href.isBlank() || !href.contains("/empleos/")) continue;

                        String empresa = card.selectFirst("span[class*='company'], div[class*='company']") != null
                                ? card.selectFirst("span[class*='company'], div[class*='company']").text().trim()
                                : "Empresa Aliada Magneto";

                        Vacante vacante = new Vacante();
                        vacante.setTitulo(titulo);
                        vacante.setFuente(PORTAL);
                        vacante.setHashDedup(sha256(PORTAL + "|" + href));
                        vacante.setUbicacion(ciudadBusqueda);
                        vacante.setCiudad(ciudadBusqueda);
                        vacante.setDescripcion(titulo);
                        vacante.setUrlOrigen(href.startsWith("http") ? href : SITE_ROOT + href);
                        vacante.setUrlAplicar(vacante.getUrlOrigen());
                        vacante.setSegmento(Segmento.LOCAL_COLOMBIA);
                        vacante.setActivo(true);
                        vacante.setFechaPublicacion(LocalDateTime.now());

                        resultados.add(new OfertaCruda(vacante, empresa));
                    }
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResultadoBusqueda.fallo("Consulta a Magneto 365 interrumpida");
        } catch (Exception e) {
            log.error("Error consultando Magneto 365: {}", e.getMessage());
            return ResultadoBusqueda.fallo("Error consultando Magneto: " + e.getMessage());
        }

        return ResultadoBusqueda.de(resultados);
    }

    private static String extraerCiudad(String ubicacion, String ciudadDefecto) {
        if (ubicacion == null || ubicacion.isBlank()) return ciudadDefecto;
        String lower = ubicacion.toLowerCase();
        if (lower.contains("barranquilla")) return "Barranquilla";
        if (lower.contains("soledad")) return "Soledad";
        if (lower.contains("malambo")) return "Malambo";
        if (lower.contains("galapa")) return "Galapa";
        if (lower.contains("puerto colombia")) return "Puerto Colombia";
        if (lower.contains("sabanalarga")) return "Sabanalarga";
        return ciudadDefecto;
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
