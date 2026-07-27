package com.novacrm.vacante;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Lee los datos basicos de una oferta a partir de su enlace.
 *
 * <p>Sirve para que registrar una oferta a mano sea pegar el enlace y poco
 * mas. Se leen unicamente las etiquetas que la propia pagina publica para ser
 * compartida en redes ({@code og:title}, {@code og:description}) mas el
 * {@code <title>}: son metadatos pensados justamente para esto, no una copia
 * del contenido del portal.
 *
 * <p>Si la pagina no responde, no pasa nada: el coordinador rellena los campos
 * y la oferta se guarda igual con su enlace.
 */
@Component
public class LectorDeOferta {

    private static final Logger log = LoggerFactory.getLogger(LectorDeOferta.class);

    private static final String USER_AGENT =
            "NOVA-CRM/1.0 (+programa de empleabilidad CAC)";
    private static final int TIMEOUT_MS = 10_000;
    private static final int MAX_DESCRIPCION = 2_000;

    /** Datos que se han podido deducir del enlace. */
    public record Metadatos(String titulo, String descripcion, String sitio) {}

    public Optional<Metadatos> leer(String url) {
        try {
            Document doc = Jsoup.connect(url)
                    .userAgent(USER_AGENT)
                    .timeout(TIMEOUT_MS)
                    .followRedirects(true)
                    .get();

            String titulo = primeroNoVacio(
                    doc.select("meta[property=og:title]").attr("content"),
                    doc.select("meta[name=twitter:title]").attr("content"),
                    doc.title());

            String descripcion = primeroNoVacio(
                    doc.select("meta[property=og:description]").attr("content"),
                    doc.select("meta[name=description]").attr("content"));

            String sitio = primeroNoVacio(
                    doc.select("meta[property=og:site_name]").attr("content"));

            return Optional.of(new Metadatos(
                    recortar(titulo, 255),
                    recortar(descripcion, MAX_DESCRIPCION),
                    recortar(sitio, 255)));

        } catch (Exception e) {
            // No es un fallo del alta: solo significa que habra que escribir
            // los datos a mano.
            log.info("No se pudieron leer los datos de {}: {}", url, e.getMessage());
            return Optional.empty();
        }
    }

    private static String primeroNoVacio(String... valores) {
        for (String valor : valores) {
            if (valor != null && !valor.isBlank()) {
                return valor.trim();
            }
        }
        return null;
    }

    private static String recortar(String valor, int max) {
        if (valor == null) {
            return null;
        }
        return valor.length() <= max ? valor : valor.substring(0, max);
    }
}
