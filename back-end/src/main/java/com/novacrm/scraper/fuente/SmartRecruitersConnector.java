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
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Ofertas publicadas por los propios empleadores, desde su portal de empleo.
 *
 * <p>{@code GET https://api.smartrecruiters.com/v1/companies/{empresa}/postings},
 * publica, documentada y sin credenciales. Es el mismo listado que la empresa
 * ensena en su web de empleo, servido en JSON para que lo consuman: no hay que
 * extraerlo del HTML ni pedir permiso, que es justo el motivo por el que
 * {@code ElempleoScraper} sigue apagado.
 *
 * <p>La lista de empresas no es generica: son los empleadores con los que el
 * programa ya trabaja —los mismos que estan en el directorio de {@code empresa}—
 * y que publican en esta plataforma. Buscar por empleador en vez de por palabra
 * suelta da ofertas del sector que interesa sin depender de que el portal
 * entienda "servicio al cliente bilingue".
 *
 * <p>Se filtran a Colombia y, dentro de ella, al area donde vive la cohorte:
 * 104 de los 108 participantes activos estan en Barranquilla, Soledad, Malambo
 * o Galapa. Una vacante en Bogota existe, pero para casi todos implica mudarse.
 */
@Component
public class SmartRecruitersConnector implements FuenteDeVacantes {

    private static final Logger log = LoggerFactory.getLogger(SmartRecruitersConnector.class);
    private static final String FUENTE = "SMARTRECRUITERS";
    private static final String ENDPOINT = "https://api.smartrecruiters.com/v1/companies/";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * Identificadores de empresa en SmartRecruiters.
     *
     * <p>Verificados uno a uno contra la API antes de entrar aqui: un
     * identificador que no existe devuelve 200 con cero resultados, asi que un
     * nombre mal escrito no falla, simplemente no trae nada nunca. Se
     * configuran por {@code app.scraping.smartrecruiters.empresas} para poder
     * anadir empleadores sin tocar el codigo.
     */
    private static final String EMPRESAS_POR_DEFECTO = "Sutherland,Alorica";

    /**
     * Tope de detalles pedidos por empresa y corrida.
     *
     * <p>El texto del anuncio solo está en el endpoint de detalle, así que cada
     * oferta que pasa el filtro de ciudad cuesta una petición más. Con
     * {@code limit=100} y dos empresas eso eran hasta 200 llamadas en serie, con
     * 15 s de tope cada una: en el peor caso la fuente sola se comía la corrida
     * entera, y encima en ráfaga contra la misma API.
     *
     * <p>Cuarenta cubre de sobra lo que un área metropolitana devuelve en un
     * día. Lo que sobrepasa el tope <strong>no se descarta</strong>: entra sin
     * descripción, y el enriquecedor la puntúa con lo que tenga. Media vacante
     * es mejor que ninguna, y mañana vuelve a intentarse.
     */
    static final int MAXIMO_DETALLES_POR_EMPRESA = 40;

    private final boolean habilitado;
    private final List<String> empresas;

    private volatile HttpClient httpClient;

    public SmartRecruitersConnector(
            @Value("${app.scraping.smartrecruiters.enabled:true}") boolean habilitado,
            @Value("${app.scraping.smartrecruiters.empresas:" + EMPRESAS_POR_DEFECTO + "}") String empresas) {
        this.habilitado = habilitado;
        this.empresas = Arrays.stream(empresas.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }

    @Override
    public String nombre() {
        return FUENTE;
    }

    @Override
    public Segmento segmento() {
        return Segmento.LOCAL_COLOMBIA;
    }

    @Override
    public boolean estaHabilitada() {
        return habilitado && !empresas.isEmpty();
    }

    /**
     * La consulta es por empleador, no por termino.
     *
     * <p>Se recorren todas las empresas en una sola llamada a
     * {@link #buscar}, asi que repetirla por cada termino del cohorte traeria
     * exactamente lo mismo varias veces.
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
                            .connectTimeout(Duration.ofSeconds(15))
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
        List<OfertaCruda> ofertas = new ArrayList<>();
        List<String> fallos = new ArrayList<>();

        for (String empresa : empresas) {
            try {
                String url = ENDPOINT + URLEncoder.encode(empresa, StandardCharsets.UTF_8)
                        + "/postings?country=co&limit=100";
                HttpResponse<String> respuesta = httpClient().send(
                        HttpRequest.newBuilder(URI.create(url))
                                .header("Accept", "application/json")
                                .header("User-Agent", "NOVA-CRM/1.0 (empleabilidad CAC)")
                                .timeout(Duration.ofSeconds(20))
                                .GET()
                                .build(),
                        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

                if (respuesta.statusCode() != 200) {
                    fallos.add(empresa + " respondio " + respuesta.statusCode());
                    continue;
                }
                ofertas.addAll(procesar(respuesta.body(), empresa));

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return ResultadoBusqueda.fallo("consulta a SmartRecruiters interrumpida");
            } catch (Exception e) {
                // Que un empleador falle no puede tumbar a los demas: cada uno
                // es una consulta independiente.
                fallos.add(empresa + ": " + e.getMessage());
            }
        }

        // Solo se da por fallida si no se obtuvo nada de nadie. Con resultados
        // parciales, informar el fallo escondería las ofertas que sí llegaron.
        if (ofertas.isEmpty() && !fallos.isEmpty()) {
            return ResultadoBusqueda.fallo("SmartRecruiters: " + String.join("; ", fallos));
        }
        if (!fallos.isEmpty()) {
            log.warn("SmartRecruiters devolvio {} ofertas con fallos parciales: {}",
                    ofertas.size(), String.join("; ", fallos));
        }
        return ResultadoBusqueda.de(ofertas);
    }

    List<OfertaCruda> procesar(String cuerpoJson, String empresa) throws Exception {
        List<OfertaCruda> ofertas = new ArrayList<>();
        JsonNode contenido = MAPPER.readTree(cuerpoJson).path("content");
        int detallesPedidos = 0;

        for (JsonNode oferta : contenido) {
            try {
                JsonNode ubicacion = oferta.path("location");
                String ciudad = texto(ubicacion, "city");
                String region = texto(ubicacion, "region");

                if (!AreaMetropolitana.esCercana(ciudad, region)) {
                    continue;
                }

                String titulo = texto(oferta, "name");
                String id = texto(oferta, "id");
                if (titulo.isBlank() || id.isBlank()) {
                    continue;
                }

                Vacante vacante = new Vacante();
                vacante.setTitulo(titulo);
                vacante.setCiudad(ciudad.isBlank() ? null : ciudad);
                vacante.setUbicacion(componerUbicacion(ciudad, region));
                vacante.setFuente(FUENTE);
                vacante.setSegmento(Segmento.LOCAL_COLOMBIA);
                // La oferta la publica el empleador, no un tercero: entra
                // revisada, como las que registra el equipo.
                vacante.setRevisada(true);
                vacante.setActivo(true);

                // El enlace publico de la oferta. Se construye con el id porque
                // el JSON de listado no siempre trae `applyUrl`.
                String enlace = "https://jobs.smartrecruiters.com/"
                        + URLEncoder.encode(empresa, StandardCharsets.UTF_8) + "/" + id;
                vacante.setUrlOrigen(enlace);
                vacante.setUrlAplicar(enlace);

                fecha(oferta).ifPresent(vacante::setFechaPublicacion);
                vacante.setTipoContrato(textoAnidado(oferta, "typeOfEmployment", "label"));

                // El texto del anuncio solo esta en el detalle, y sin el la
                // oferta llega con titulo y ciudad y nada mas: el motor no
                // tiene con que puntuar el ingles ni la experiencia, y con la
                // cobertura minima exigida no llega a generar match. Se pide
                // despues de filtrar por ciudad, para no gastar una peticion
                // por cada oferta que igualmente se iba a descartar.
                //
                // Y con tope, porque siguen siendo N peticiones en serie: ver
                // MAXIMO_DETALLES_POR_EMPRESA. Pasado el tope la oferta entra
                // igual, solo que sin descripcion.
                if (detallesPedidos < MAXIMO_DETALLES_POR_EMPRESA) {
                    completarConElDetalle(vacante, empresa, id);
                    detallesPedidos++;
                } else if (detallesPedidos == MAXIMO_DETALLES_POR_EMPRESA) {
                    log.info("[{}] {} trae mas de {} ofertas cercanas; el resto entra sin descripcion",
                            FUENTE, empresa, MAXIMO_DETALLES_POR_EMPRESA);
                    detallesPedidos++;
                }

                ofertas.add(new OfertaCruda(vacante, empresa));

            } catch (Exception e) {
                log.debug("Oferta de SmartRecruiters descartada: {}", e.getMessage());
            }
        }
        return ofertas;
    }

    /**
     * Trae el texto del anuncio y lo vuelca en la vacante.
     *
     * <p>{@code qualifications} es lo que el anuncio pide —de ahi salen el
     * nivel de ingles y los anios de experiencia que despues extrae el
     * enriquecedor— y {@code jobDescription} es lo que se hace en el puesto.
     * Los dos vienen en HTML; se guardan como texto plano porque asi es como
     * los lee el tokenizador del matching y como se muestran en el portal.
     *
     * <p>Si el detalle falla, la oferta se conserva con lo que ya tiene. Una
     * vacante con menos datos sigue siendo una oportunidad; perderla entera
     * por un error de red no.
     */
    private void completarConElDetalle(Vacante vacante, String empresa, String id) {
        try {
            String url = ENDPOINT + URLEncoder.encode(empresa, StandardCharsets.UTF_8)
                    + "/postings/" + URLEncoder.encode(id, StandardCharsets.UTF_8);
            HttpResponse<String> respuesta = httpClient().send(
                    HttpRequest.newBuilder(URI.create(url))
                            .header("Accept", "application/json")
                            .header("User-Agent", "NOVA-CRM/1.0 (empleabilidad CAC)")
                            .timeout(Duration.ofSeconds(15))
                            .GET()
                            .build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (respuesta.statusCode() != 200) {
                return;
            }
            aplicarDetalle(vacante, MAPPER.readTree(respuesta.body()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.debug("Sin detalle para la oferta {} de {}: {}", id, empresa, e.getMessage());
        }
    }

    /** Separado del envio para poder probarlo sin red. */
    void aplicarDetalle(Vacante vacante, JsonNode detalle) {
        JsonNode secciones = detalle.path("jobAd").path("sections");
        String descripcion = aTextoPlano(texto(secciones.path("jobDescription"), "text"));
        String requisitos = aTextoPlano(texto(secciones.path("qualifications"), "text"));

        if (!descripcion.isBlank()) vacante.setDescripcion(descripcion);
        if (!requisitos.isBlank()) vacante.setRequisitos(requisitos);

        // El enlace real de postulacion, mejor que el que se compone a mano.
        String aplicar = texto(detalle, "applyUrl");
        if (aplicar.isBlank()) aplicar = texto(detalle, "postingUrl");
        if (!aplicar.isBlank()) vacante.setUrlAplicar(aplicar);
    }

    private static String aTextoPlano(String html) {
        return html.isBlank() ? "" : Jsoup.parse(html).text().trim();
    }

    private static String componerUbicacion(String ciudad, String region) {
        if (ciudad.isBlank() && region.isBlank()) return null;
        if (region.isBlank()) return ciudad;
        if (ciudad.isBlank()) return region;
        return ciudad + ", " + region;
    }

    private static java.util.Optional<LocalDateTime> fecha(JsonNode oferta) {
        String valor = texto(oferta, "releasedDate");
        if (valor.isBlank()) return java.util.Optional.empty();
        try {
            // Viene como fecha ISO con zona; basta el dia.
            return java.util.Optional.of(LocalDate.parse(valor.substring(0, 10)).atStartOfDay());
        } catch (Exception e) {
            return java.util.Optional.empty();
        }
    }

    private static String texto(JsonNode nodo, String campo) {
        JsonNode valor = nodo.path(campo);
        return valor.isMissingNode() || valor.isNull() ? "" : valor.asText("").trim();
    }

    private static String textoAnidado(JsonNode nodo, String campo, String subcampo) {
        String valor = texto(nodo.path(campo), subcampo);
        return valor.isBlank() ? null : valor;
    }
}
