package com.novacrm.branding;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Identidad visual por programa.
 *
 * <p>La lectura la puede hacer cualquiera que haya iniciado sesion —la
 * interfaz necesita los colores para pintarse—, pero {@code BrandingService}
 * comprueba antes que el programa sea el suyo. La escritura es de ADMIN o
 * COORDINADOR.
 */
@RestController
@RequestMapping("/api/v1/branding")
@Tag(name = "Branding", description = "Identidad visual y plantilla de correo de cada programa")
public class BrandingController {

    private final BrandingService brandingService;
    private final ImagenBrandingService imagenService;
    private final com.novacrm.documento.StorageService storageService;

    public BrandingController(BrandingService brandingService,
                              ImagenBrandingService imagenService,
                              com.novacrm.documento.StorageService storageService) {
        this.brandingService = brandingService;
        this.imagenService = imagenService;
        this.storageService = storageService;
    }

    /**
     * La identidad del programa del propio usuario.
     *
     * <p>Existe para que un estudiante no tenga que conocer —ni mandar— el id
     * de su programa: pedirselo le obligaria a manejar un identificador de otro
     * y a que el servidor comprobase que no lo cambio por el de otro cliente.
     */
    @GetMapping("/mio")
    @Operation(summary = "Identidad visual del programa del usuario autenticado")
    @PreAuthorize("isAuthenticated()")
    public BrandingResponse mio(Authentication auth) {
        return brandingService.consultarElMio(auth);
    }

    @GetMapping("/{programaId}")
    @Operation(summary = "Identidad visual de un programa")
    @PreAuthorize("isAuthenticated()")
    public BrandingResponse consultar(Authentication auth, @PathVariable UUID programaId) {
        return brandingService.consultar(auth, programaId);
    }

    @PutMapping("/{programaId}")
    @Operation(summary = "Guardar la identidad visual de un programa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public BrandingResponse guardar(@PathVariable UUID programaId,
                                    @RequestBody BrandingRequest request) {
        return brandingService.guardar(programaId, request);
    }

    @DeleteMapping("/{programaId}")
    @Operation(summary = "Volver a la gama global del panel")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResponseEntity<Void> restablecer(@PathVariable UUID programaId) {
        brandingService.restablecer(programaId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Sube una imagen de marca y devuelve la clave con la que referenciarla.
     *
     * <p>El servidor <strong>decodifica el archivo</strong> para comprobar las
     * medidas en vez de creer lo que diga el cliente: la pantalla ya recorta
     * con un canvas, pero si el servidor se fia, una imagen del tamano
     * equivocado sale descuadrada a 108 bandejas de entrada.
     *
     * <p>Devuelve la clave de almacenamiento y no una URL porque la URL lleva
     * el host de quien la subio; la URL publica se construye al servir con
     * {@code app.correo.base-url-publica}.
     */
    @PostMapping(value = "/{programaId}/imagen", consumes = "multipart/form-data")
    @Operation(summary = "Subir una imagen de marca")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public java.util.Map<String, String> subirImagen(
            @PathVariable UUID programaId,
            @RequestParam("clave") String clave,
            @RequestParam("archivo") org.springframework.web.multipart.MultipartFile archivo) {

        var exigida = MedidasExigidas.TODAS.stream()
                .filter(m -> m.clave().equalsIgnoreCase(clave))
                .findFirst()
                .orElseThrow(() -> new com.novacrm.exception.BusinessException(
                        "Imagen desconocida: " + clave));

        return java.util.Map.of("clave", imagenService.guardar(exigida, archivo));
    }

    /**
     * Sirve una imagen de marca. <strong>Abierto a proposito</strong>: lo abre
     * el cliente de correo del destinatario, que no tiene sesion ni la puede
     * tener. Son imagenes de marca, no datos de nadie.
     */
    @GetMapping("/imagen/**")
    @Operation(summary = "Servir una imagen de marca (publico)")
    public ResponseEntity<byte[]> imagen(jakarta.servlet.http.HttpServletRequest request) {
        String prefijo = "/api/v1/branding/imagen/";
        String bruta = request.getRequestURI().substring(
                request.getRequestURI().indexOf(prefijo) + prefijo.length());

        // Sin esta comprobacion, un `../` en la URL leeria cualquier archivo del
        // servidor, y este endpoint no pide sesion.
        String key = ImagenBrandingService.claveSegura(
                java.net.URLDecoder.decode(bruta, java.nio.charset.StandardCharsets.UTF_8));

        byte[] contenido = storageService.descargar(key);
        return ResponseEntity.ok()
                .header("Content-Type", key.endsWith(".jpg") ? "image/jpeg" : "image/png")
                // Las imagenes de marca cambian poco y las pide cada bandeja que
                // abre el correo; sin cache es una descarga por apertura.
                .header("Cache-Control", "public, max-age=604800")
                .body(contenido);
    }
}
