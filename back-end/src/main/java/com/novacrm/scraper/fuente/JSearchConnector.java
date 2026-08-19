package com.novacrm.scraper.fuente;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.vacante.Vacante;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Conector con JSearch (openwebninja), agregador de Indeed, LinkedIn y Glassdoor.
 *
 * <p>Es la unica via encontrada a vacantes colombianas reales: Adzuna no cubre
 * Colombia —en Latinoamerica solo Brasil y Mexico—, el Servicio Publico de
 * Empleo no publica datos abiertos, y extraer de elempleo.com esta restringido
 * por sus condiciones de uso. Sin esta fuente, el segmento local se queda sin
 * ofertas y el motor solo puede recomendar empleo remoto en ingles a una
 * poblacion que en su mayoria mide A1 oral.
 *
 * <p>Ademas es la fuente mas rica del conjunto: es la unica que trae
 * {@code requisitos}, hoy nulos en el 100% de las vacantes automaticas.
 *
 * <p>La clave sale de la variable de entorno {@code JSEARCH_API_KEY} y nunca
 * del repositorio. Si esta vacia el conector se apaga y lo registra: preferible
 * a lanzar peticiones sin credencial contra un cupo que se cobra.
 */
@Component
public class JSearchConnector implements FuenteDeVacantes {

    private static final Logger log = LoggerFactory.getLogger(JSearchConnector.class);
    private static final String FUENTE = "JSEARCH";
    private static final String ENDPOINT = "https://api.openwebninja.com/jsearch/search-v2";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final ControlDeCuota controlDeCuota;
    private final String apiKey;
    private final boolean habilitado;
    private final int limiteMensual;
    private final int maximoConsultasPorCorrida;
    private final String pais;

    private volatile HttpClient httpClient;

    public JSearchConnector(
            ControlDeCuota controlDeCuota,
            @Value("${app.scraping.jsearch.api-key:}") String apiKey,
            @Value("${app.scraping.jsearch.enabled:true}") boolean habilitado,
            @Value("${app.scraping.jsearch.limite-mensual:200}") int limiteMensual,
            @Value("${app.scraping.jsearch.consultas-por-corrida:6}") int maximoConsultasPorCorrida,
            @Value("${app.scraping.jsearch.pais:co}") String pais) {
        this.controlDeCuota = controlDeCuota;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.habilitado = habilitado;
        this.limiteMensual = limiteMensual;
        this.maximoConsultasPorCorrida = maximoConsultasPorCorrida;
        this.pais = pais;
        if (habilitado && this.apiKey.isBlank()) {
            log.warn("JSearch deshabilitado: falta JSEARCH_API_KEY. "
                    + "Sin el, no hay ninguna fuente de vacantes locales en Colombia.");
        }
    }

    @Override
    public String nombre() {
        return FUENTE;
    }

    @Override
    public Segmento segmento() {
        return Segmento.LOCAL_COLOMBIA;
    }

    /** Filtra de verdad: la ciudad va en la consulta y cambia los resultados. */
    @Override
    public boolean filtraPorCiudad() {
        return true;
    }

    @Override
    public boolean estaHabilitada() {
        return habilitado && !apiKey.isBlank();
    }

    @Override
    public int maximoConsultasPorCorrida() {
        return maximoConsultasPorCorrida;
    }

    private HttpClient httpClient() {
        HttpClient actual = httpClient;
        if (actual == null) {
            synchronized (this) {
                actual = httpClient;
                if (actual == null) {
                    actual = HttpClient.newBuilder()
                            .connectTimeout(Duration.ofSeconds(20))
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
        // El cupo se reserva antes de llamar: el proveedor cobra la peticion
        // aunque no devuelva nada, asi que preguntarle primero a la base es lo
        // unico que evita quemar el mes en unos dias.
        if (!controlDeCuota.intentarConsumir(FUENTE, limiteMensual)) {
            return ResultadoBusqueda.fallo("cupo mensual de JSearch agotado");
        }

        String consulta = ciudad == null || ciudad.isBlank()
                ? termino
                : termino + " in " + ciudad;
        try {
            String url = ENDPOINT
                    + "?query=" + URLEncoder.encode(consulta, StandardCharsets.UTF_8)
                    + "&country=" + URLEncoder.encode(pais, StandardCharsets.UTF_8)
                    + "&date_posted=month&page=1&num_pages=1";

            HttpResponse<String> respuesta = httpClient().send(
                    HttpRequest.newBuilder(URI.create(url))
                            .header("Accept", "application/json")
                            .header("X-API-Key", apiKey)
                            .timeout(Duration.ofSeconds(45))
                            .GET()
                            .build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (respuesta.statusCode() == 429) {
                return ResultadoBusqueda.fallo("JSearch respondio 429: cupo del proveedor agotado");
            }
            if (respuesta.statusCode() != 200) {
                return ResultadoBusqueda.fallo("JSearch respondio " + respuesta.statusCode());
            }
            return ResultadoBusqueda.de(procesar(respuesta.body()));

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResultadoBusqueda.fallo("consulta a JSearch interrumpida");
        } catch (Exception e) {
            return ResultadoBusqueda.fallo("error consultando JSearch: " + e.getMessage());
        }
    }

    /**
     * Traduce el sobre de openwebninja: {@code data[]} son paginas y cada una
     * trae las ofertas en {@code jobs[]}.
     */
    List<OfertaCruda> procesar(String cuerpoJson) throws Exception {
        List<OfertaCruda> ofertas = new ArrayList<>();
        JsonNode raiz = MAPPER.readTree(cuerpoJson);
        JsonNode dataNode = raiz.path("data");

        if (dataNode.isObject() && dataNode.has("jobs")) {
            for (JsonNode oferta : dataNode.path("jobs")) {
                try {
                    mapear(oferta).ifPresent(ofertas::add);
                } catch (Exception e) {
                    log.warn("Error mapeando oferta de JSearch: {}", e.getMessage());
                }
            }
        } else if (dataNode.isArray()) {
            for (JsonNode item : dataNode) {
                if (item.has("jobs")) {
                    for (JsonNode oferta : item.path("jobs")) {
                        try {
                            mapear(oferta).ifPresent(ofertas::add);
                        } catch (Exception e) {
                            log.warn("Error mapeando oferta de JSearch: {}", e.getMessage());
                        }
                    }
                } else if (item.has("job_id")) {
                    try {
                        mapear(item).ifPresent(ofertas::add);
                    } catch (Exception e) {
                        log.warn("Error mapeando oferta de JSearch: {}", e.getMessage());
                    }
                }
            }
        }
        return ofertas;
    }

    Optional<OfertaCruda> mapear(JsonNode oferta) {
        String id = texto(oferta, "job_id");
        String titulo = texto(oferta, "job_title");
        if (id == null || titulo == null) {
            return Optional.empty();
        }

        var vacante = new Vacante();
        vacante.setTitulo(titulo);
        vacante.setFuente(FUENTE);
        vacante.setSegmento(Segmento.LOCAL_COLOMBIA);
        vacante.setHashDedup(sha256(FUENTE + "|" + id));
        vacante.setDescripcion(texto(oferta, "job_description"));
        String city = texto(oferta, "job_city");
        vacante.setCiudad(city != null && !city.isBlank() ? city : "Barranquilla");
        vacante.setUbicacion(ubicacion(oferta));
        vacante.setTipoContrato(texto(oferta, "job_employment_type"));
        vacante.setModalidadTrabajo(
                oferta.path("job_is_remote").asBoolean(false) ? "REMOTO" : "PRESENCIAL");
        vacante.setRangoSalarial(salario(oferta));

        // Lo que ninguna otra fuente da: los requisitos por separado. Es la
        // entrada de la que el enriquecedor saca nivel de ingles y anios de
        // experiencia, los dos criterios que hasta ahora eran constantes.
        vacante.setRequisitos(listaDeTexto(oferta.path("job_highlights").path("Qualifications")));

        String url = texto(oferta, "job_apply_link");
        vacante.setUrlOrigen(url);
        vacante.setUrlAplicar(url);
        vacante.setFechaPublicacion(fecha(texto(oferta, "job_posted_at_datetime_utc")));
        vacante.setFechaExpiracion(fecha(texto(oferta, "job_offer_expiration_datetime_utc")));
        vacante.setActivo(true);

        return Optional.of(new OfertaCruda(vacante, texto(oferta, "employer_name")));
    }

    private static String ubicacion(JsonNode oferta) {
        String ciudad = texto(oferta, "job_city");
        String estado = texto(oferta, "job_state");
        String pais = texto(oferta, "job_country");
        var partes = new ArrayList<String>();
        if (ciudad != null) partes.add(ciudad);
        if (estado != null) partes.add(estado);
        if (pais != null) partes.add(pais);
        return partes.isEmpty() ? null : String.join(", ", partes);
    }

    private static String salario(JsonNode oferta) {
        JsonNode min = oferta.path("job_min_salary");
        JsonNode max = oferta.path("job_max_salary");
        if (min.isMissingNode() || min.isNull() || max.isMissingNode() || max.isNull()) {
            return null;
        }
        String moneda = texto(oferta, "job_salary_currency");
        return (min.asText() + " - " + max.asText()
                + (moneda == null ? "" : " " + moneda)).trim();
    }

    /**
     * Aplana un arreglo de textos.
     *
     * <p>Un {@code asText("")} sobre un nodo arreglo devuelve el valor por
     * defecto en vez del contenido —el mismo fallo que dejaba la descripcion de
     * elempleo siempre nula—, asi que hay que recorrerlo.
     */
    private static String listaDeTexto(JsonNode arreglo) {
        if (arreglo == null || !arreglo.isArray() || arreglo.isEmpty()) {
            return null;
        }
        var partes = new ArrayList<String>();
        for (JsonNode elemento : arreglo) {
            String valor = elemento.asText("").trim();
            if (!valor.isBlank()) {
                partes.add(valor);
            }
        }
        return partes.isEmpty() ? null : String.join("\n", partes);
    }

    private static LocalDateTime fecha(String valor) {
        if (valor == null) {
            return null;
        }
        try {
            return OffsetDateTime.parse(valor).toLocalDateTime();
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(valor.replace(" ", "T"));
            } catch (Exception otra) {
                return null;
            }
        }
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
