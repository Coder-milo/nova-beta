package com.novacrm.documento;

/**
 * Contrato unificado para proveedores de almacenamiento de archivos (MinIO / AWS S3, Disco Local).
 */
public interface ProveedorAlmacenamiento {

    /** Nombre identificador del proveedor (ej. "minio", "local"). */
    String nombre();

    /** Si el proveedor está configurado y listo para operar. */
    boolean estaConfigurado();

    /** Subes contenido y devuelve el objectKey generado. */
    String subir(String carpeta, String nombreOriginal, byte[] contenido, String contentType);

    /** Descarga el contenido binario del archivo según su objectKey. */
    byte[] descargar(String objectKey);

    /** Elimina un archivo según su objectKey. */
    void eliminar(String objectKey);
}
