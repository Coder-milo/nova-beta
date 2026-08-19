package com.novacrm.scraper.portal;

import com.novacrm.scraper.fuente.FuenteDeVacantes;
import com.novacrm.scraper.fuente.OfertaCruda;
import com.novacrm.scraper.fuente.ReintentoConEspera;
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

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

/**
 * Conector para la extracción de ofertas de empleo desde Computrabajo Colombia
 * (co.computrabajo.com), enfocado en la región del Atlántico y Barranquilla.
 */
@Component
public class ComputrabajoScraper implements FuenteDeVacantes {

    private static final Logger log = LoggerFactory.getLogger(ComputrabajoScraper.class);
    private static final String SITE_ROOT = "https://co.computrabajo.com";
    private static final String PORTAL = "COMPUTRABAJO";
    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NOVA-CRM/1.0";
    private static final long PAUSA_MS = 200;

    /** Paginas de resultados por consulta; la 2 pincha ~16 ofertas nuevas (verificado 2026-08-12). */
    private static final int MAX_PAGINAS = 2;

    private final boolean habilitado;

    public ComputrabajoScraper(@Value("${app.scraping.computrabajo.enabled:true}") boolean habilitado) {
        this.habilitado = habilitado;
        if (habilitado) {
            log.info("Conector de Computrabajo Colombia ACTIVADO para la extracción de ofertas.");
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
            String ciudadBusqueda = (ciudad != null && !ciudad.isBlank()) ? ciudad : "Barranquilla";
            String baseUrl = SITE_ROOT + "/ofertas-de-trabajo/?q="
                    + URLEncoder.encode(termino.trim(), StandardCharsets.UTF_8)
                    + "&l=" + URLEncoder.encode(ciudadBusqueda, StandardCharsets.UTF_8)
                    + "&by=publicationdown";

            for (int pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
                Thread.sleep(PAUSA_MS);
                String url = baseUrl + (pagina > 1 ? "&p=" + pagina : "");
                try {
                    // Con reintento: el 403 que devuelve este portal cuando le
                    // llegan varias peticiones seguidas es del cortafuegos y se
                    // levanta solo. Antes tumbaba la consulta entera.
                    Document doc = ReintentoConEspera.documento(PORTAL, () -> Jsoup.connect(url)
                            .userAgent(USER_AGENT)
                            .referrer("https://co.computrabajo.com/")
                            .timeout(15000));
                    resultados.addAll(parsear(doc, ciudadBusqueda));
                } catch (org.jsoup.HttpStatusException e) {
                    if (pagina == 1) {
                        throw e;
                    }
                    log.warn("Computrabajo sin pagina {} para '{}'", pagina, termino);
                    break;
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResultadoBusqueda.fallo("Consulta a Computrabajo interrumpida");
        } catch (Exception e) {
            log.error("Error consultando Computrabajo Colombia: {}", e.getMessage());
            return ResultadoBusqueda.fallo("Error consultando Computrabajo: " + e.getMessage());
        }

        return ResultadoBusqueda.de(resultados);
    }

    /** Parseo contra el HTML real: el portal renderiza cada oferta en un {@code article.box_offer}. */
    static List<OfertaCruda> parsear(Document doc, String ciudadBusqueda) {
        List<OfertaCruda> resultados = new ArrayList<>();
        var tarjetas = doc.select("article, div.box_offer, div[class*='box_offer']");
        if (tarjetas.isEmpty()) {
            tarjetas = doc.select("a[href*='/ofertas-de-trabajo/']");
        }

        for (Element card : tarjetas) {
            try {
                String idOferta = card.attr("data-id");
                Element linkElem = card.is("a") ? card : card.selectFirst("a.js-o-link, a.title_offer, a[href*='/ofertas-de-trabajo/'], h2 a, h3 a, h1 a");
                if (linkElem == null) {
                    continue;
                }

                String titulo = linkElem.text().trim();
                String href = linkElem.attr("href");
                if (titulo.isBlank() || href.isBlank()) {
                    continue;
                }

                if (idOferta.isBlank()) {
                    idOferta = href;
                }

                Element empresaElem = card.selectFirst("a[offer-grid-article-company-url], a[href*='/empresas/'], p[class*='company']");
                String empresa = empresaElem != null ? empresaElem.text().trim() : "Empresa Confidencial";

                // 1. Extraer ubicación real desde la URL, elementos del HTML o el texto de la tarjeta
                String ubicacion = extraerUbicacionReal(card, href, titulo, ciudadBusqueda);
                String ciudad = extraerCiudad(ubicacion, href, titulo, ciudadBusqueda);

                Element salarioElem = card.selectFirst("span[class*='i_salary'], p[class*='salary']");
                String salario = salarioElem != null ? salarioElem.parent().text().trim() : null;

                Element descElem = card.selectFirst("p.dClear, p.build_desc, p.description, div[class*='description_offer']");
                String descripcion = descElem != null ? descElem.text().trim() : titulo;

                // Extraer etiquetas de modalidad, contrato y jornada
                String cardText = card.text().toLowerCase();
                String modalidad = "Presencial";
                if (cardText.contains("100% remoto") || cardText.contains("totalmente remoto")
                        || cardText.contains("trabajo remoto") || cardText.contains("teletrabajo")
                        || cardText.contains("home office") || cardText.contains("work from home")) {
                    modalidad = "Remoto";
                } else if (cardText.contains("hibrid") || cardText.contains("híbrid")) {
                    modalidad = "Híbrido";
                }

                String jornada = "Tiempo completo";
                if (cardText.contains("medio tiempo") || cardText.contains("part time")) {
                    jornada = "Medio tiempo";
                } else if (cardText.contains("por horas")) {
                    jornada = "Por horas";
                }

                String tipoContrato = null;
                if (cardText.contains("indefinido")) {
                    tipoContrato = "Término Indefinido";
                } else if (cardText.contains("obra o labor") || cardText.contains("obra labor")) {
                    tipoContrato = "Obra o Labor";
                } else if (cardText.contains("termino fijo") || cardText.contains("término fijo")) {
                    tipoContrato = "Término Fijo";
                } else if (cardText.contains("aprendizaje") || cardText.contains("practicante")) {
                    tipoContrato = "Contrato de Aprendizaje";
                }

                Vacante vacante = new Vacante();
                vacante.setTitulo(titulo);
                vacante.setFuente(PORTAL);
                vacante.setHashDedup(sha256(PORTAL + "|" + idOferta));
                vacante.setUbicacion(ubicacion);
                vacante.setCiudad(ciudad);
                vacante.setModalidadTrabajo(modalidad);
                vacante.setJornada(jornada);
                vacante.setTipoContrato(tipoContrato);
                vacante.setRangoSalarial(salario);
                vacante.setDescripcion(descripcion);
                vacante.setUrlOrigen(href.startsWith("http") ? href : SITE_ROOT + href);
                vacante.setUrlAplicar(vacante.getUrlOrigen());
                vacante.setSegmento(modalidad.equals("Remoto") ? Segmento.REMOTO_INGLES : Segmento.LOCAL_COLOMBIA);
                vacante.setActivo(true);
                vacante.setFechaPublicacion(LocalDateTime.now());

                resultados.add(new OfertaCruda(vacante, empresa));
            } catch (Exception e) {
                log.warn("Error parseando tarjeta individual en Computrabajo: {}", e.getMessage());
            }
        }
        return resultados;
    }

    private static String extraerUbicacionReal(Element card, String href, String titulo, String ciudadDefecto) {
        // A. Buscar en el slug de la URL (/oferta-...-en-pereira-HASH o -en-bogota-)
        String slugCiudad = extraerCiudadDeUrl(href);
        if (slugCiudad != null) {
            return slugCiudad;
        }

        // B. Buscar en elementos de texto de la tarjeta
        Element locElem = card.selectFirst("p.fs13.fc_base, span[class*='location'], p[class*='location']");
        if (locElem != null) {
            String text = locElem.text().trim();
            if (!text.isBlank() && !text.matches("^[0-9.,\\s]+$") && !text.toLowerCase().contains("hace ")) {
                return text;
            }
        }

        // C. Buscar menciones explícitas en el título
        String lowerTitulo = titulo.toLowerCase();
        if (lowerTitulo.contains("bogota") || lowerTitulo.contains("bogotá")) return "Bogotá, D.C.";
        if (lowerTitulo.contains("medellin") || lowerTitulo.contains("medellín")) return "Medellín, Antioquia";
        if (lowerTitulo.contains("pereira") || lowerTitulo.contains("risaralda")) return "Pereira, Risaralda";
        if (lowerTitulo.contains("cali")) return "Cali, Valle del Cauca";
        if (lowerTitulo.contains("barranquilla") || lowerTitulo.contains("soledad")) return "Barranquilla, Atlántico";

        return ciudadDefecto;
    }

    private static String extraerCiudadDeUrl(String href) {
        if (href == null || href.isBlank()) return null;
        String lower = href.toLowerCase();
        int idx = lower.indexOf("-en-");
        if (idx != -1) {
            String sub = lower.substring(idx + 4);
            int endHyphen = sub.lastIndexOf('-');
            String slug = (endHyphen > 0) ? sub.substring(0, endHyphen) : sub;
            if (slug.contains("pereira") || slug.contains("risaralda")) return "Pereira";
            if (slug.contains("bogota")) return "Bogotá";
            if (slug.contains("medellin")) return "Medellín";
            if (slug.contains("cali")) return "Cali";
            if (slug.contains("barranquilla")) return "Barranquilla";
            if (slug.contains("soledad")) return "Soledad";
            if (slug.contains("malambo")) return "Malambo";
            if (slug.contains("galapa")) return "Galapa";
            if (slug.contains("puerto-colombia")) return "Puerto Colombia";
            if (slug.contains("sabanalarga")) return "Sabanalarga";
            if (slug.contains("bucaramanga")) return "Bucaramanga";
            if (slug.contains("manizales")) return "Manizales";
            if (slug.contains("armenia")) return "Armenia";
            if (slug.contains("cartagena")) return "Cartagena";
            if (slug.contains("santa-marta")) return "Santa Marta";
            if (slug.contains("cucuta")) return "Cúcuta";
            if (slug.contains("ibague")) return "Ibagué";
            if (slug.contains("villavicencio")) return "Villavicencio";
            if (slug.contains("pasto")) return "Pasto";
            if (slug.contains("monteria")) return "Montería";
            if (slug.contains("valledupar")) return "Valledupar";
            if (slug.contains("neiva")) return "Neiva";
            if (slug.contains("popayan")) return "Popayán";
            if (slug.contains("sincelejo")) return "Sincelejo";
            if (slug.contains("tunja")) return "Tunja";
            if (slug.contains("riohacha")) return "Riohacha";
        }
        return null;
    }

    private static String extraerCiudad(String ubicacion, String href, String titulo, String ciudadDefecto) {
        String slugCiudad = extraerCiudadDeUrl(href);
        if (slugCiudad != null) {
            return slugCiudad;
        }
        if (ubicacion == null || ubicacion.isBlank() || ubicacion.matches("^[0-9.,\\s]+$")) {
            return ciudadDefecto;
        }
        String lower = (ubicacion + " " + titulo).toLowerCase();
        if (lower.contains("pereira") || lower.contains("risaralda")) return "Pereira";
        if (lower.contains("bogota") || lower.contains("bogotá")) return "Bogotá";
        if (lower.contains("medellin") || lower.contains("medellín")) return "Medellín";
        if (lower.contains("cali")) return "Cali";
        if (lower.contains("barranquilla")) return "Barranquilla";
        if (lower.contains("soledad")) return "Soledad";
        if (lower.contains("malambo")) return "Malambo";
        if (lower.contains("galapa")) return "Galapa";
        if (lower.contains("puerto colombia")) return "Puerto Colombia";
        if (lower.contains("sabanalarga")) return "Sabanalarga";
        if (lower.contains("atlantico") || lower.contains("atlántico")) return "Barranquilla";
        if (lower.contains("bucaramanga")) return "Bucaramanga";
        if (lower.contains("manizales")) return "Manizales";
        if (lower.contains("armenia")) return "Armenia";
        if (lower.contains("cartagena")) return "Cartagena";
        if (lower.contains("santa marta")) return "Santa Marta";
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
