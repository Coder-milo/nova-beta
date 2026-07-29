package com.novacrm.branding;

import com.novacrm.documento.StorageService;
import com.novacrm.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.List;
import java.util.Set;

/**
 * Guarda las imagenes de marca y devuelve una URL que un cliente de correo
 * pueda abrir.
 *
 * <p><strong>El problema que resuelve.</strong> Las imagenes venian apuntando a
 * {@code http://localhost:3000/brand/...}. Eso funciona en un navegador de la
 * maquina de desarrollo y en ningun sitio mas: Gmail, Outlook o cualquier
 * bandeja abre esa URL desde el ordenador del destinatario, donde no hay nada
 * escuchando en el 3000. Un {@code data:} URI tampoco vale —Gmail las descarta
 * en {@code <img src>} y Outlook de escritorio no las dibuja—, asi que la unica
 * salida es una URL publica de verdad.
 *
 * <p>Se apoya en {@link StorageService}, que ya sabe hablar con MinIO y caer a
 * disco cuando no esta configurado, y se sirve por un endpoint abierto del
 * backend. En produccion {@code app.correo.base-url-publica} apunta al dominio
 * real y la misma URL deja de ser local.
 */
@Service
public class ImagenBrandingService {

    /** Lo que un cliente de correo dibuja con seguridad. */
    private static final Set<String> TIPOS = Set.of("image/png", "image/jpeg");

    /**
     * Tope de peso. Una cabecera de correo no necesita mas, y descargar cinco
     * megas en un movil con datos para ver una franja es desproporcionado.
     */
    private static final long MAX_BYTES = 2L * 1024 * 1024;

    private final StorageService storageService;

    /**
     * De donde cuelgan las URL que se escriben en los correos.
     *
     * <p>Por defecto el propio backend en local. En produccion tiene que ser el
     * dominio publico: es lo que el cliente de correo del destinatario va a
     * intentar abrir.
     */
    @Value("${app.correo.base-url-publica:http://localhost:8080}")
    private String baseUrlPublica;

    public ImagenBrandingService(StorageService storageService) {
        this.storageService = storageService;
    }

    /**
     * Valida y guarda una imagen de marca.
     *
     * <p>Las medidas se comprueban <strong>decodificando el archivo</strong> y
     * no creyendo lo que diga el cliente. La pantalla ya recorta con un
     * {@code canvas} antes de subir, pero un cliente puede mandar cualquier
     * cosa: si el servidor se fia, el correo sale descuadrado a 108 personas.
     *
     * @return la URL publica con la que referenciarla
     */
    public String guardar(MedidasExigidas.Medida exigida, MultipartFile archivo) {
        var motivos = new java.util.ArrayList<String>();

        if (archivo == null || archivo.isEmpty()) {
            throw new BusinessException("No llego ningun archivo.");
        }
        if (archivo.getSize() > MAX_BYTES) {
            motivos.add("Pesa " + (archivo.getSize() / 1024) + " KB y el maximo son "
                    + (MAX_BYTES / 1024) + " KB.");
        }
        String tipo = archivo.getContentType();
        if (tipo == null || !TIPOS.contains(tipo.toLowerCase())) {
            motivos.add("Tiene que ser PNG o JPEG; llego: " + tipo + ".");
        }

        byte[] contenido;
        BufferedImage imagen;
        try {
            contenido = archivo.getBytes();
            imagen = ImageIO.read(new ByteArrayInputStream(contenido));
        } catch (IOException e) {
            throw new BusinessException("No se pudo leer el archivo: " + e.getMessage());
        }
        if (imagen == null) {
            throw new BusinessException("El archivo no es una imagen que se pueda abrir.");
        }

        String fallo = MedidasExigidas.validar(exigida, imagen.getWidth(), imagen.getHeight());
        if (fallo != null) {
            motivos.add(fallo);
        }

        if (!motivos.isEmpty()) {
            throw new BusinessException(String.join(" ", motivos));
        }

        String key = storageService.subir("branding", nombreDe(exigida, tipo), contenido, tipo);
        return urlPublicaDe(key);
    }

    /** La URL absoluta con la que se referencia una imagen ya guardada. */
    public String urlPublicaDe(String key) {
        String base = baseUrlPublica.endsWith("/")
                ? baseUrlPublica.substring(0, baseUrlPublica.length() - 1)
                : baseUrlPublica;
        return base + "/api/v1/branding/imagen/" + key;
    }

    /**
     * Forma exacta que puede tener la clave de una imagen de marca.
     *
     * <p>Es lo unico que separa el endpoint publico de una lectura de archivos
     * arbitrarios: {@code StorageService} resuelve la clave contra un
     * directorio cuando MinIO no esta configurado, y {@code Path.resolve} con
     * un {@code ../} sale de ese directorio. Como el endpoint <strong>no pide
     * sesion</strong> —lo abre el cliente de correo del destinatario—, aceptar
     * cualquier texto seria dejar leer el disco a cualquiera.
     *
     * <p>Se valida por lista blanca y no quitando {@code ..}: quitar patrones
     * conocidos siempre deja alguna codificacion fuera.
     */
    private static final java.util.regex.Pattern CLAVE_VALIDA =
            java.util.regex.Pattern.compile("^branding/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$");

    /**
     * Comprueba que la clave sea una de las que genera este servicio.
     *
     * @throws BusinessException si no lo es
     */
    public static String claveSegura(String key) {
        if (key == null || !CLAVE_VALIDA.matcher(key).matches()) {
            throw new BusinessException("Imagen no encontrada");
        }
        return key;
    }

    /** Si una URL sigue apuntando a un host que solo existe en desarrollo. */
    public static boolean esLocal(String url) {
        if (url == null || url.isBlank()) return false;
        String u = url.toLowerCase();
        return u.contains("://localhost") || u.contains("://127.0.0.1") || u.startsWith("data:");
    }

    /** Avisos sobre las imagenes de un branding, para la pantalla de edicion. */
    public static List<String> avisosDeUrl(BrandingResponse branding) {
        var avisos = new java.util.ArrayList<String>();
        if (esLocal(branding.correoHeaderUrl())) {
            avisos.add("La cabecera del correo apunta a una direccion local: no se vera en "
                    + "ninguna bandeja de entrada. Vuelve a subir la imagen.");
        }
        if (esLocal(branding.correoPieUrl())) {
            avisos.add("El pie del correo apunta a una direccion local: no se vera en ninguna "
                    + "bandeja de entrada. Vuelve a subir la imagen.");
        }
        return avisos;
    }

    private static String nombreDe(MedidasExigidas.Medida exigida, String tipo) {
        String extension = "image/jpeg".equalsIgnoreCase(tipo) ? ".jpg" : ".png";
        return exigida.clave() + extension;
    }
}
