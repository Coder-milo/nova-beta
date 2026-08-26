package com.novacrm.scraper.fuente;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.vacante.Vacante;
import org.jsoup.Jsoup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Conector con el tablero publico de Arbeitnow.
 *
 * <p>{@code GET https://www.arbeitnow.com/api/job-board-api}, sin autenticacion
 * ni cupo. Cubre sobre todo Alemania y el resto de Europa, y marca que ofertas
 * patrocinan visa: por eso sirve al segmento de migracion, que hasta ahora no
 * tenia ninguna fuente.
 *
 * <p>Solo se quedan las que declaran patrocinio. Una vacante en Berlin sin
 * visa no es una oportunidad para alguien en Barranquilla, es ruido que ademas
 * compite por el cupo de recomendaciones.
 */
@Component
public class ArbeitnowConnector implements FuenteDeVacantes {

    private static final Logger log = LoggerFactory.getLogger(ArbeitnowConnector.class);
    private static final String FUENTE = "ARBEITNOW";
    private static final String ENDPOINT = "https://www.arbeitnow.com/api/job-board-api";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final boolean habilitado;
    private final boolean soloConVisa;

    private volatile HttpClient httpClient;

    public ArbeitnowConnector(
            @Value("${app.scraping.arbeitnow.enabled:true}") boolean habilitado,
            @Value("${app.scraping.arbeitnow.solo-con-visa:true}") boolean soloConVisa) {
        this.habilitado = habilitado;
        this.soloConVisa = soloConVisa;
    }

    @Override
    public String nombre() {
        return FUENTE;
    }

    @Override
    public Segmento segmento() {
        return Segmento.MIGRACION;
    }

    @Override
    public boolean estaHabilitada() {
        return habilitado;
    }

    /**
     * El tablero no acepta filtros: devuelve la pagina completa y el termino se
     * aplica en casa. Basta con pedirlo una vez por corrida.
     */
    @Override
    public int maximoConsultasPorCorrida() {
        return 1;
    }

    private HttpClient httpClient() {
        HttpClient actual = httpClient;
        if (actual == null) {
            synchronized (this) {
                actual = httpClient;
                if (actual == null) {
                    actual = HttpClient.newBuilder()
                            .connectTimeout(Duration.ofSeconds(5))
                            .followRedirects(HttpClient.Redirect.NORMAL)
                            .build();
                    httpClient = actual;
                }
            }
        }
        return actual;
    }

    @Override
    public ResultadoBusqueda buscar(String termino, String ciudad) {
        if (!estaHabilitada()) {
            return ResultadoBusqueda.vacio();
        }
        try {
            HttpResponse<String> respuesta = httpClient().send(
                    HttpRequest.newBuilder(URI.create(ENDPOINT))
                            .header("Accept", "application/json")
                            .header("User-Agent", "NOVA-CRM/1.0 (empleabilidad CAC)")
                            .timeout(Duration.ofSeconds(5))
                            .GET()
                            .build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (respuesta.statusCode() != 200) {
                return ResultadoBusqueda.fallo("Arbeitnow respondio " + respuesta.statusCode());
            }
            return ResultadoBusqueda.de(procesar(respuesta.body()));

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResultadoBusqueda.fallo("consulta a Arbeitnow interrumpida");
        } catch (Exception e) {
            return ResultadoBusqueda.fallo("error consultando Arbeitnow: " + e.getMessage());
        }
    }

    List<OfertaCruda> procesar(String cuerpoJson) throws Exception {
        List<OfertaCruda> ofertas = new ArrayList<>();
        JsonNode datos = MAPPER.readTree(cuerpoJson).path("data");
        for (JsonNode oferta : datos) {
            try {
                mapear(oferta).ifPresent(ofertas::add);
            } catch (Exception e) {
                log.warn("Error mapeando oferta de Arbeitnow: {}", e.getMessage());
            }
        }
        return ofertas;
    }

    Optional<OfertaCruda> mapear(JsonNode oferta) {
        String slug = texto(oferta, "slug");
        String titulo = texto(oferta, "title");
        if (slug == null || titulo == null) {
            return Optional.empty();
        }
        if (soloConVisa && !oferta.path("visa_sponsorship").asBoolean(false)) {
            return Optional.empty();
        }

        var vacante = new Vacante();
        vacante.setTitulo(titulo);
        vacante.setFuente(FUENTE);
        vacante.setSegmento(Segmento.MIGRACION);
        vacante.setHashDedup(sha256(FUENTE + "|" + slug));
        vacante.setUbicacion(texto(oferta, "location"));
        vacante.setModalidadTrabajo(
                oferta.path("remote").asBoolean(false) ? "REMOTO" : "PRESENCIAL");

        String descripcionHtml = texto(oferta, "description");
        if (descripcionHtml != null) {
            vacante.setDescripcion(Jsoup.parse(descripcionHtml).text());
        }
        // Los tipos de jornada vienen como arreglo ("full_time", "internship").
        vacante.setJornada(primerElemento(oferta.path("job_types")));

        String url = texto(oferta, "url");
        vacante.setUrlOrigen(url);
        vacante.setUrlAplicar(url);

        LocalDateTime fechaPub = desdeEpoch(oferta.path("created_at"));
        if (fechaPub == null) {
            log.debug("Oferta de Arbeitnow descartada por fecha no verificable: {}", slug);
            return Optional.empty();
        }
        if (!FiltroFrescura.esFresca(fechaPub)) {
            log.debug("Oferta de Arbeitnow descartada por antigüedad > 7 días: {} (publicada: {})", slug, fechaPub);
            return Optional.empty();
        }

        vacante.setFechaPublicacion(fechaPub);
        vacante.setActivo(true);

        return Optional.of(new OfertaCruda(vacante, texto(oferta, "company_name")));
    }

    private static String primerElemento(JsonNode arreglo) {
        if (arreglo == null || !arreglo.isArray() || arreglo.isEmpty()) {
            return null;
        }
        String valor = arreglo.get(0).asText("").trim();
        return valor.isBlank() ? null : valor;
    }

    private static LocalDateTime desdeEpoch(JsonNode nodo) {
        return ParserFechas.desdeEpoch(nodo).orElse(null);
    }

    private static String texto(JsonNode nodo, String campo) {
        JsonNode valor = nodo.path(campo);
        if (valor.isMissingNode() || valor.isNull() || valor.isContainerNode()) {
            return null;
        }
        String texto = valor.asText("").trim();
        return texto.isBlank() ? null : texto;
    }

    private static String sha256(String input) {
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of()
                    .formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
