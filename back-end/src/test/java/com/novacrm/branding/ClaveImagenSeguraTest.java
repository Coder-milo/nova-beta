package com.novacrm.branding;

import com.novacrm.exception.BusinessException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * La clave con la que se pide una imagen de marca.
 *
 * <p>El endpoint que la usa <strong>no pide sesion</strong>: lo abre el cliente
 * de correo del destinatario. Y {@code StorageService} resuelve la clave contra
 * un directorio del disco cuando MinIO no esta configurado. Sin esta validacion,
 * un {@code ../} en la URL seria una lectura de archivos arbitrarios sin
 * autenticar.
 */
class ClaveImagenSeguraTest {

    @Test
    void aceptaLasClavesQueGeneraElPropioServicio() {
        assertDoesNotThrow(() ->
                ImagenBrandingService.claveSegura("branding/9f8a7b6c-1234-correoHeader.png"));
        assertDoesNotThrow(() ->
                ImagenBrandingService.claveSegura("branding/abc123.jpg"));
    }

    @Test
    void rechazaSalirDelDirectorio() {
        assertThrows(BusinessException.class,
                () -> ImagenBrandingService.claveSegura("branding/../../etc/passwd"));
        assertThrows(BusinessException.class,
                () -> ImagenBrandingService.claveSegura("../application.yml"));
        assertThrows(BusinessException.class,
                () -> ImagenBrandingService.claveSegura("branding/..%2f..%2fsecret"));
    }

    @Test
    void rechazaOtrasCarpetas() {
        // El endpoint sirve marca, no documentos de estudiantes.
        assertThrows(BusinessException.class,
                () -> ImagenBrandingService.claveSegura("documentos/hoja-de-vida.pdf"));
    }

    @Test
    void rechazaSubcarpetasYRutasAbsolutas() {
        assertThrows(BusinessException.class,
                () -> ImagenBrandingService.claveSegura("branding/sub/carpeta.png"));
        assertThrows(BusinessException.class,
                () -> ImagenBrandingService.claveSegura("/etc/passwd"));
        assertThrows(BusinessException.class,
                () -> ImagenBrandingService.claveSegura("C:/Windows/win.ini"));
    }

    @Test
    void rechazaVacioYNulo() {
        assertThrows(BusinessException.class, () -> ImagenBrandingService.claveSegura(null));
        assertThrows(BusinessException.class, () -> ImagenBrandingService.claveSegura(""));
        assertThrows(BusinessException.class, () -> ImagenBrandingService.claveSegura("branding/"));
    }

    @Test
    void elMensajeNoDelataSiElArchivoExiste() {
        // "Imagen no encontrada" y no "clave invalida": el endpoint es publico y
        // no tiene por que confirmar que rutas existen en el servidor.
        var e = assertThrows(BusinessException.class,
                () -> ImagenBrandingService.claveSegura("../../etc/passwd"));
        assertEquals("Imagen no encontrada", e.getMessage());
    }
}
