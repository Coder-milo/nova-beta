package com.novacrm.documento;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

/**
 * Implementación de {@link ProveedorAlmacenamiento} basada en el sistema de archivos local.
 */
@Component
public class LocalProveedorAlmacenamiento implements ProveedorAlmacenamiento {

    private static final Logger log = LoggerFactory.getLogger(LocalProveedorAlmacenamiento.class);

    private final Path dirLocal;

    public LocalProveedorAlmacenamiento(@Value("${app.storage.dir:./storage}") String storageDir) {
        this.dirLocal = Path.of(storageDir);
        log.info("Almacenamiento local listo en {}", dirLocal.toAbsolutePath());
    }

    @Override
    public String nombre() {
        return "local";
    }

    @Override
    public boolean estaConfigurado() {
        return true;
    }

    @Override
    public String subir(String carpeta, String nombreOriginal, byte[] contenido, String contentType) {
        String key = carpeta + "/" + UUID.randomUUID() + "-" + limpiarNombre(nombreOriginal);
        try {
            Path destino = dirLocal.resolve(key);
            Files.createDirectories(destino.getParent());
            Files.write(destino, contenido);
            return key;
        } catch (Exception e) {
            throw new IllegalStateException("Error guardando archivo local: " + e.getMessage(), e);
        }
    }

    @Override
    public byte[] descargar(String objectKey) {
        try {
            return Files.readAllBytes(dirLocal.resolve(objectKey));
        } catch (Exception e) {
            throw new IllegalStateException("Error leyendo archivo local: " + e.getMessage(), e);
        }
    }

    @Override
    public void eliminar(String objectKey) {
        try {
            Files.deleteIfExists(dirLocal.resolve(objectKey));
        } catch (Exception e) {
            throw new IllegalStateException("Error eliminando archivo local: " + e.getMessage(), e);
        }
    }

    private static String limpiarNombre(String nombre) {
        if (nombre == null || nombre.isBlank()) return "archivo";
        return nombre.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
