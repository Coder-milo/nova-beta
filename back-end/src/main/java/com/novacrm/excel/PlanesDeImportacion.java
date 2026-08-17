package com.novacrm.excel;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.exception.BusinessException;
import com.novacrm.excel.libro.AnalisisDeLibro;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Guarda lo que se previsualizó para que sea eso mismo lo que se importe.
 *
 * <p>El problema que resuelve: previsualizar y confirmar son dos peticiones, y
 * la segunda volvía a analizar el archivo desde cero. Mientras el
 * reconocimiento era un diccionario eso daba siempre lo mismo y nadie lo notó.
 * Desde que hay IA de por medio ya no. El detalle de por qué está en
 * {@link AnalisisDeLibro}; en corto: el destino de una hoja no se memoriza
 * nunca, lo que sí se memoriza vive en el proceso, y un 429 del proveedor en la
 * segunda pasada deja columnas sin mapear sin avisar. Lo revisado y lo escrito
 * habían dejado de ser lo mismo.
 *
 * <p>Ahora la previsualización devuelve el identificador de su análisis y la
 * importación lo trae de vuelta. Antes de aplicarlo se comprueba que el archivo
 * es <strong>el mismo</strong>: se compara la huella de su contenido, no el
 * nombre. Un archivo que se corrige entre las dos pantallas conserva el nombre
 * y ya no dice lo que decía, y aplicarle un plan hecho para la versión anterior
 * escribiría columnas cambiadas de sitio sin avisar de nada.
 */
@Service
public class PlanesDeImportacion {

    private static final Logger log = LoggerFactory.getLogger(PlanesDeImportacion.class);

    /**
     * Cuánto vive un plan.
     *
     * <p>Da margen para revisar una previsualización larga con calma y volver
     * después de una reunión, sin dejar creciendo indefinidamente una tabla de
     * análisis que ya nadie va a confirmar. Pasado el plazo se vuelve a
     * previsualizar, que es lo correcto: un archivo aprobado hace una semana no
     * debería importarse a ciegas hoy.
     */
    static final Duration VIGENCIA = Duration.ofHours(6);

    private static final String CADUCADO =
            "La previsualización ya no está disponible. Vuelve a subir el archivo "
            + "para revisar qué va a pasar antes de importarlo.";

    private final PlanDeImportacionRepository repositorio;
    private final ObjectMapper json;

    public PlanesDeImportacion(PlanDeImportacionRepository repositorio, ObjectMapper json) {
        this.repositorio = repositorio;
        this.json = json;
    }

    /** Guarda el análisis de una previsualización y devuelve su identificador. */
    @Transactional
    public UUID guardar(MultipartFile archivo, AnalisisDeLibro analisis) {
        var plan = new PlanDeImportacion();
        plan.setHuella(huella(archivo));
        plan.setArchivo(nombre(archivo));
        plan.setUsuario(quienEs());
        plan.setExpiraEn(Instant.now().plus(VIGENCIA));
        try {
            plan.setAnalisis(json.writeValueAsString(analisis));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("No se pudo serializar el analisis del libro", e);
        }
        return repositorio.save(plan).getId();
    }

    /**
     * Recupera el análisis aprobado, si el archivo sigue siendo el mismo.
     *
     * <p>Los tres motivos por los que puede no valer —no existe, caducó, o es
     * de otra cuenta— dan el mismo mensaje y la misma salida: volver a
     * previsualizar. Distinguirlos no le sirve de nada a quien carga y sí le
     * diría a cualquiera qué identificadores existen.
     */
    @Transactional(readOnly = true)
    public AnalisisDeLibro recuperar(UUID id, MultipartFile archivo) {
        var plan = repositorio.findById(id).orElseThrow(() -> new BusinessException(CADUCADO));
        if (plan.caducado(Instant.now()) || !plan.getUsuario().equals(quienEs())) {
            throw new BusinessException(CADUCADO);
        }
        if (!plan.getHuella().equals(huella(archivo))) {
            throw new BusinessException(
                    "Este archivo no es el que se previsualizó: cambió después de revisarlo. "
                    + "Vuelve a subirlo para ver qué va a pasar con esta versión.");
        }
        try {
            return json.readValue(plan.getAnalisis(), AnalisisDeLibro.class);
        } catch (IOException e) {
            // Un plan ilegible es un plan que no existe: se rehace, no se
            // adivina. Lo contrario seria importar con un mapeo a medias.
            log.warn("El plan de importacion {} no se pudo leer: {}", id, e.getMessage());
            throw new BusinessException(CADUCADO);
        }
    }

    /** SHA-256 del contenido, en hexadecimal. */
    static String huella(MultipartFile archivo) {
        try {
            var sha = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha.digest(archivo.getBytes()));
        } catch (IOException | NoSuchAlgorithmException e) {
            throw new BusinessException("No se pudo leer el archivo: " + e.getMessage());
        }
    }

    /**
     * Los planes caducados se borran solos.
     *
     * <p>Cada uno guarda el mapeo completo de un libro de siete hojas. Sin
     * limpieza, una tabla que solo sirve durante unos minutos acaba siendo de
     * las más grandes del esquema.
     */
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void limpiarCaducados() {
        int borrados = repositorio.borrarCaducados(Instant.now());
        if (borrados > 0) {
            log.info("Planes de importacion caducados borrados: {}", borrados);
        }
    }

    private static String nombre(MultipartFile archivo) {
        String nombre = archivo == null ? null : archivo.getOriginalFilename();
        if (nombre == null || nombre.isBlank()) {
            return "(sin nombre)";
        }
        return nombre.length() > 255 ? nombre.substring(0, 255) : nombre;
    }

    private static String quienEs() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null ? auth.getName() : "sistema";
    }
}
