package com.novacrm.notificacion;

import com.novacrm.documento.StorageService;
import com.novacrm.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Almacenamiento seguro de los recursos publicos de un anuncio. */
@Service
public class AnuncioMediaService {

    private static final long MAX_BYTES = 25L * 1024 * 1024;
    private static final Set<String> TIPOS_IMAGEN = Set.of("image/png", "image/jpeg", "image/webp", "image/gif");
    private static final Set<String> TIPOS_VIDEO = Set.of("video/mp4", "video/webm", "video/quicktime");

    /**
     * Documentos que se adjuntan al cuerpo del anuncio.
     *
     * <p>Una convocatoria casi nunca es solo un poster: lleva las bases en PDF,
     * el formato de inscripcion en Word o el listado de vacantes en Excel. Se
     * incluyen los tipos MIME antiguos de Office porque los ficheros guardados
     * con versiones viejas siguen circulando y el navegador los declara asi.
     */
    private static final Set<String> TIPOS_DOCUMENTO = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private static final Pattern CLAVE_VALIDA = Pattern.compile("^anuncios/[A-Za-z0-9][A-Za-z0-9._-]{0,180}$");

    private final StorageService storageService;

    @Value("${app.correo.base-url-publica:http://localhost:8080}")
    private String baseUrlPublica;

    public AnuncioMediaService(StorageService storageService) {
        this.storageService = storageService;
    }

    public Recurso guardar(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) throw new BusinessException("Selecciona un archivo.");
        if (archivo.getSize() > MAX_BYTES) throw new BusinessException("El archivo supera el máximo de 25 MB.");
        String contentType = archivo.getContentType() == null ? "" : archivo.getContentType().toLowerCase(Locale.ROOT);
        String tipo = TIPOS_IMAGEN.contains(contentType) ? "IMAGE"
                : TIPOS_VIDEO.contains(contentType) ? "VIDEO"
                : TIPOS_DOCUMENTO.contains(contentType) ? "FILE"
                : null;
        if (tipo == null) {
            throw new BusinessException("Solo se permiten imágenes PNG, JPG, WEBP o GIF, "
                    + "videos MP4, WEBM o MOV y documentos PDF, DOC/DOCX o XLS/XLSX.");
        }
        try {
            String key = storageService.subir("anuncios", archivo.getOriginalFilename(), archivo.getBytes(), contentType);
            return new Recurso(urlPublicaDe(key), tipo, nombreVisible(archivo.getOriginalFilename()));
        } catch (Exception e) {
            throw new BusinessException("No se pudo guardar el archivo del anuncio: " + e.getMessage());
        }
    }

    /** Nombre para enseñar junto al enlace, sin la ruta que manda el navegador. */
    private static String nombreVisible(String original) {
        if (original == null || original.isBlank()) return "Documento adjunto";
        String limpio = original.replace('\\', '/');
        return limpio.substring(limpio.lastIndexOf('/') + 1);
    }

    public byte[] contenido(String key) {
        return storageService.descargar(claveSegura(key));
    }

    public static String claveSegura(String key) {
        if (key == null || !CLAVE_VALIDA.matcher(key).matches()) throw new BusinessException("Archivo de anuncio no encontrado");
        return key;
    }

    private String urlPublicaDe(String key) {
        String base = baseUrlPublica.endsWith("/") ? baseUrlPublica.substring(0, baseUrlPublica.length() - 1) : baseUrlPublica;
        return base + "/api/v1/notificaciones/adjunto/" + key;
    }

    /**
     * @param tipo IMAGE, VIDEO o FILE
     * @param nombre nombre original, para el texto del enlace de un documento
     */
    public record Recurso(String url, String tipo, String nombre) {}
}
