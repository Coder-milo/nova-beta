package com.novacrm.documento;

import io.minio.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

/**
 * Almacenamiento de archivos (documentos, fotos, plantillas y hojas de vida).
 * Usa MinIO cuando hay credenciales configuradas; si no, cae a disco local
 * (directorio app.storage.dir) para que los módulos funcionen en cualquier entorno.
 */
@Service
public class StorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageService.class);

    private final ObjectProvider<MinioClient> minioProvider;
    private final String bucket;
    private final boolean minioConfigurado;
    private final Path dirLocal;

    public StorageService(ObjectProvider<MinioClient> minioProvider,
                          @Value("${app.minio.bucket}") String bucket,
                          @Value("${app.minio.access-key:}") String accessKey,
                          @Value("${app.storage.dir:./storage}") String storageDir) {
        this.minioProvider = minioProvider;
        this.bucket = bucket;
        this.minioConfigurado = accessKey != null && !accessKey.isBlank();
        this.dirLocal = Path.of(storageDir);
        if (!minioConfigurado) {
            log.info("MinIO sin configurar: usando almacenamiento local en {}", dirLocal.toAbsolutePath());
        }
    }

    /** Sube contenido y devuelve el objectKey generado. */
    public String subir(String carpeta, String nombreOriginal, byte[] contenido, String contentType) {
        String key = carpeta + "/" + UUID.randomUUID() + "-" + limpiarNombre(nombreOriginal);
        if (minioConfigurado) {
            try {
                var minio = minioProvider.getObject();
                asegurarBucket(minio);
                minio.putObject(PutObjectArgs.builder()
                        .bucket(bucket)
                        .object(key)
                        .stream(new ByteArrayInputStream(contenido), contenido.length, -1)
                        .contentType(contentType != null ? contentType : "application/octet-stream")
                        .build());
                return key;
            } catch (Exception e) {
                throw new IllegalStateException("Error subiendo archivo a MinIO: " + e.getMessage(), e);
            }
        }
        try {
            Path destino = dirLocal.resolve(key);
            Files.createDirectories(destino.getParent());
            Files.write(destino, contenido);
            return key;
        } catch (Exception e) {
            throw new IllegalStateException("Error guardando archivo local: " + e.getMessage(), e);
        }
    }

    public byte[] descargar(String objectKey) {
        if (minioConfigurado) {
            try (InputStream in = minioProvider.getObject().getObject(GetObjectArgs.builder()
                    .bucket(bucket).object(objectKey).build())) {
                return in.readAllBytes();
            } catch (Exception e) {
                throw new IllegalStateException("Error descargando archivo: " + e.getMessage(), e);
            }
        }
        try {
            return Files.readAllBytes(dirLocal.resolve(objectKey));
        } catch (Exception e) {
            throw new IllegalStateException("Error leyendo archivo local: " + e.getMessage(), e);
        }
    }

    public void eliminar(String objectKey) {
        if (minioConfigurado) {
            try {
                minioProvider.getObject().removeObject(
                        RemoveObjectArgs.builder().bucket(bucket).object(objectKey).build());
            } catch (Exception e) {
                throw new IllegalStateException("Error eliminando archivo: " + e.getMessage(), e);
            }
            return;
        }
        try {
            Files.deleteIfExists(dirLocal.resolve(objectKey));
        } catch (Exception e) {
            throw new IllegalStateException("Error eliminando archivo local: " + e.getMessage(), e);
        }
    }

    private void asegurarBucket(MinioClient minio) throws Exception {
        boolean existe = minio.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
        if (!existe) {
            minio.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        }
    }

    private static String limpiarNombre(String nombre) {
        if (nombre == null || nombre.isBlank()) return "archivo";
        return nombre.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
