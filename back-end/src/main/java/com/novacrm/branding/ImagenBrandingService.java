package com.novacrm.branding;

import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Set;
import java.util.UUID;

/**
 * Guarda las imagenes de marca y devuelve la clave con la que se las referencia.
 *
 * <p><strong>El problema que resuelve.</strong> Las imagenes venian apuntando a
 * {@code http://localhost:3000/brand/...}. Eso funciona en un navegador de la
 * maquina de desarrollo y en ningun sitio mas: Gmail, Outlook o cualquier
 * bandeja abre esa URL desde el ordenador del destinatario, donde no hay nada
 * escuchando en el 3000. Un {@code data:} URI tampoco vale —Gmail las descarta
 * en {@code <img src>} y Outlook de escritorio no las dibuja—, asi que la unica
 * salida es una URL publica de verdad.
 *
 * <p>La tabla de marca guarda la <strong>clave</strong> de la imagen, no su URL:
 * una URL lleva el host de quien la subio y se queda rota cuando el despliegue
 * cambia. La URL publica se construye al servir con {@link #urlDe}, colgada de
 * {@code app.correo.base-url-publica}, que en produccion apunta al dominio real.
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

    private final BrandingImagenRepository imagenRepository;

    public ImagenBrandingService(BrandingImagenRepository imagenRepository) {
        this.imagenRepository = imagenRepository;
    }

    /**
     * Valida y guarda una imagen de marca.
     *
     * <p>Las medidas se comprueban <strong>decodificando el archivo</strong> y
     * no creyendo lo que diga el cliente. La pantalla ya recorta con un
     * {@code canvas} antes de subir, pero un cliente puede mandar cualquier
     * cosa: si el servidor se fia, el correo sale descuadrado a 108 personas.
     *
     * @return la clave de almacenamiento con la que se referenciara la imagen
     */
    @Transactional
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

        String key = "branding/" + UUID.randomUUID() + "-" + nombreDe(exigida, tipo);
        imagenRepository.save(new BrandingImagen(key, tipo.toLowerCase(), contenido));
        return key;
    }

    @Transactional(readOnly = true)
    public BrandingImagen descargar(String key) {
        return imagenRepository.findById(claveSegura(key))
                .orElseThrow(() -> new ResourceNotFoundException("Imagen no encontrada"));
    }

    /** La clave con la que se pide una imagen de marca.
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

    /**
     * Reduce a su clave lo que el administrador manda al guardar: una clave ya
     * normalizada, la URL completa de este mismo servidor o una URL externa.
     *
     * <p>La tabla guarda claves —no URLs— porque una URL lleva el host de quien
     * la subio y se queda rota cuando el despliegue cambia. La URL publica se
     * reconstruye al servir con {@link #urlDe}, colgada de la base que tenga el
     * entorno en ese momento. Una URL externa (un CDN, por ejemplo) no es
     * nuestra imagen y se conserva tal cual.
     */
    public static String claveDe(String valor) {
        if (valor == null || valor.isBlank()) return null;
        String v = valor.trim();
        if (v.startsWith("http://") || v.startsWith("https://")) {
            int i = v.indexOf("/api/v1/branding/imagen/");
            if (i >= 0) return v.substring(i + "/api/v1/branding/imagen/".length());
            return v;
        }
        return v;
    }

    /**
     * La URL con la que una clave de marca se pone en un correo: la clave
     * colgada de la base publica configurada, o la URL externa tal cual.
     */
    public static String urlDe(String valor, String basePublica) {
        String clave = claveDe(valor);
        if (clave == null) return null;
        if (clave.startsWith("http://") || clave.startsWith("https://")) return clave;
        String base = basePublica == null || basePublica.isBlank()
                ? "http://localhost:8080"
                : (basePublica.endsWith("/") ? basePublica.substring(0, basePublica.length() - 1) : basePublica);
        return base + "/api/v1/branding/imagen/" + clave;
    }

    private static String nombreDe(MedidasExigidas.Medida exigida, String tipo) {
        String extension = "image/jpeg".equalsIgnoreCase(tipo) ? ".jpg" : ".png";
        return exigida.clave() + extension;
    }
}
