package com.novacrm.documento;

import org.springframework.stereotype.Service;

/**
 * Servicio Façade de Almacenamiento. Delega la gestión de archivos al {@link ProveedorAlmacenamiento} activo.
 */
@Service
public class StorageService {

    private final ProveedorAlmacenamiento proveedorAlmacenamiento;

    public StorageService(ProveedorAlmacenamiento proveedorAlmacenamiento) {
        this.proveedorAlmacenamiento = proveedorAlmacenamiento;
    }

    /** Sube contenido y devuelve el objectKey generado. */
    public String subir(String carpeta, String nombreOriginal, byte[] contenido, String contentType) {
        return proveedorAlmacenamiento.subir(carpeta, nombreOriginal, contenido, contentType);
    }

    /** Descarga el contenido binario del archivo según su objectKey. */
    public byte[] descargar(String objectKey) {
        return proveedorAlmacenamiento.descargar(objectKey);
    }

    /** Elimina un archivo según su objectKey. */
    public void eliminar(String objectKey) {
        proveedorAlmacenamiento.eliminar(objectKey);
    }
}
