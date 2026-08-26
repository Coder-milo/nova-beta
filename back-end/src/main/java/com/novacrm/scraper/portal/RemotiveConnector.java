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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Conector con la API publica de empleo remoto de Remotive.
 *
 * <p>A diferencia del scraping de HTML, aqui hay una API documentada y de uso
 * permitido: {@code GET https://remotive.com/api/remote-jobs}. Sus condiciones
 * piden enlazar de vuelta y citar la fuente —por eso se guarda siempre
 * {@code urlOrigen}— y no consultarla mas de cuatro veces al dia, de ahi que
 * solo se invoque desde la tarea programada diaria.
 *
 * <p>Se filtran las ofertas por la region que admiten: una vacante "USA Only"
 * no le sirve a un participante en Colombia, y colarla solo ensucia el
 * matching.
 */
@Component
public class RemotiveConnector implements FuenteDeVacantes {

    private static final Logger log = LoggerFactory.getLogger(RemotiveConnector.class);
    private static final String PORTAL = "REMOTIVE";
    private static final String ENDPOINT = "https://remotive.com/api/remote-jobs";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Tope por consulta: la API devuelve el tablero completo si no se limita. */
    private static final int LIMITE_POR_CONSULTA = 50;

    /**
     * Regiones desde las que un participante en Colombia puede trabajar. Se
     * comparan en minusculas contra {@code candidate_required_location}.
     */
    private static final List<String> REGIONES_ADMITIDAS = List.of(
            "worldwide", "anywhere", "global",
            "latam", "latin america", "south america", "americas",
            "colombia");

    private final boolean habilitado;

    /**
     * Se crea en la primera consulta y no en el constructor: montar el cliente
     * abre recursos de red, y hacerlo al construir el bean acopla el arranque
     * de la aplicacion —y cualquier prueba que instancie esta clase— a que la
     * pila de red este disponible.
     */
    private volatile HttpClient httpClient;

    public RemotiveConnector(@Value("${app.scraping.remotive.enabled:true}") boolean habilitado) {
        this.habilitado = habilitado;
    }

    @Override
    public String nombre() {
        return PORTAL;
    }

    @Override
    public Segmento segmento() {
        return Segmento.REMOTO_INGLES;
    }

    @Override
    public boolean estaHabilitada() {
        return habilitado;
    }

    /**
     * Sus condiciones piden no consultarla mas de cuatro veces al dia, y de
     * todos modos el tablero es el mismo para cualquier ciudad: pedirlo una vez
     * por cada ciudad del cohorte eran cinco peticiones con resultado
     * identico.
     */
    @Override
    public int maximoConsultasPorCorrida() {
        return 4;
    }

    private HttpClient httpClient() {
        HttpClient actual = httpClient;
        if (actual == null) {
            synchronized (this) {
                actual = httpClient;
                if (actual == null) {
                    httpClient = HttpClient.newBuilder()
                            .connectTimeout(Duration.ofSeconds(5))
                            .followRedirects(HttpClient.Redirect.NORMAL)
                            .build();
                    this.httpClient = httpClient;
                }
            }
        }
        return httpClient;
    }

    @Override
    public ResultadoBusqueda buscar(String termino, String ciudad) {
        if (!habilitado) {
            return ResultadoBusqueda.vacio();
        }
        try {
            String url = ENDPOINT
                    + "?limit=" + LIMITE_POR_CONSULTA
                    + "&search=" + URLEncoder.encode(termino == null ? "" : termino.trim(),
                            StandardCharsets.UTF_8);

            HttpResponse<String> respuesta = httpClient().send(
                    HttpRequest.newBuilder(URI.create(url))
                            .header("Accept", "application/json")
                            .header("User-Agent", "NOVA-CRM/1.0 (empleabilidad CAC)")
                            .timeout(Duration.ofSeconds(5))
                            .GET()
                            .build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (respuesta.statusCode() != 200) {
                return ResultadoBusqueda.fallo(
                        "Remotive respondio " + respuesta.statusCode() + " para '" + termino + "'");
            }
            return procesar(respuesta.body());

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResultadoBusqueda.fallo("consulta a Remotive interrumpida");
        } catch (Exception e) {
            return ResultadoBusqueda.fallo("error consultando Remotive: " + e.getMessage());
        }
    }

    /** Convierte la respuesta; guardar es cosa de quien la pidio. */
    ResultadoBusqueda procesar(String cuerpoJson) {
        List<OfertaCruda> ofertas = new ArrayList<>();
        try {
            JsonNode nodos = MAPPER.readTree(cuerpoJson).path("jobs");
            for (JsonNode oferta : nodos) {
                try {
                    Optional<Vacante> vacante = mapear(oferta);
                    if (vacante.isEmpty()) {
                        continue;
                    }
                    // El nombre de la empresa viaja aparte: en el modelo propio
                    // Empresa es una entidad del directorio, y resolverla —o
                    // crearla— es decision de quien persiste.
                    ofertas.add(new OfertaCruda(vacante.get(), texto(oferta, "company_name")));
                } catch (Exception e) {
                    log.warn("Error mapeando oferta de Remotive: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Respuesta de Remotive ilegible: {}", e.getMessage());
            return ResultadoBusqueda.fallo("respuesta de Remotive ilegible: " + e.getMessage());
        }
        return ResultadoBusqueda.de(ofertas);
    }

    /**
     * Traduce una oferta al modelo propio.
     *
     * @return vacio si le falta lo imprescindible o si la region no admite a un
     *         candidato en Colombia
     */
    Optional<Vacante> mapear(JsonNode oferta) {
        String id = texto(oferta, "id");
        String titulo = texto(oferta, "title");
        if (id == null || titulo == null) {
            return Optional.empty();
        }

        String region = texto(oferta, "candidate_required_location");
        if (!admiteCandidatoEnColombia(region)) {
            return Optional.empty();
        }

        var vacante = new Vacante();
        vacante.setTitulo(titulo);
        vacante.setFuente(PORTAL);
        vacante.setHashDedup(sha256(PORTAL + "|" + id));
        vacante.setUbicacion(region == null ? "Remoto" : region);
        vacante.setModalidadTrabajo("REMOTO");
        vacante.setRangoSalarial(texto(oferta, "salary"));
        vacante.setTipoContrato(texto(oferta, "job_type"));

        // La descripcion viene en HTML; se guarda en texto plano porque
        // alimenta la comparacion de terminos del matching.
        String descripcionHtml = texto(oferta, "description");
        if (descripcionHtml != null) {
            vacante.setDescripcion(Jsoup.parse(descripcionHtml).text());
        }

        // Las condiciones de uso piden enlazar de vuelta a la oferta original.
        String url = texto(oferta, "url");
        vacante.setUrlOrigen(url);
        vacante.setUrlAplicar(url);

        Optional<LocalDateTime> fechaPubOpt = com.novacrm.scraper.fuente.ParserFechas.parsear(texto(oferta, "publication_date"));
        if (fechaPubOpt.isEmpty()) {
            log.debug("Oferta de Remotive descartada por fecha no verificable: {}", id);
            return Optional.empty();
        }
        LocalDateTime fechaPub = fechaPubOpt.get();
        if (!com.novacrm.scraper.fuente.FiltroFrescura.esFresca(fechaPub)) {
            log.debug("Oferta de Remotive descartada por antigüedad > 7 días: {} (publicada: {})", id, fechaPub);
            return Optional.empty();
        }

        vacante.setFechaPublicacion(fechaPub);
        vacante.setSegmento(Segmento.REMOTO_INGLES);
        vacante.setActivo(true);
        return Optional.of(vacante);
    }

    static boolean admiteCandidatoEnColombia(String region) {
        if (region == null || region.isBlank()) {
            // Sin restriccion declarada se asume abierta.
            return true;
        }
        String normalizada = region.toLowerCase(Locale.ROOT);
        return REGIONES_ADMITIDAS.stream().anyMatch(normalizada::contains);
    }

    private static String texto(JsonNode nodo, String campo) {
        JsonNode valor = nodo.path(campo);
        if (valor.isMissingNode() || valor.isNull()) {
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
