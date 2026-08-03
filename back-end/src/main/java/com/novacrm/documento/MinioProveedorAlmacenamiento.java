package com.novacrm.documento;

import io.minio.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.UUID;

/**
 * Implementación de {@link ProveedorAlmacenamiento} basada en MinIO / AWS S3.
 */
@Component
public class MinioProveedorAlmacenamiento implements ProveedorAlmacenamiento {

    private static final Logger log = LoggerFactory.getLogger(MinioProveedorAlmacenamiento.class);

    private final ObjectProvider<MinioClient> minioProvider;
    private final String bucket;
    private final String accessKey;

    public MinioProveedorAlmacenamiento(ObjectProvider<MinioClient> minioProvider,
                                       @Value("${app.minio.bucket:novacrm}") String bucket,
                                       @Value("${app.minio.access-key:}") String accessKey) {
        this.minioProvider = minioProvider;
        this.bucket = bucket;
        this.accessKey = accessKey;
    }

    @Override
    public String nombre() {
        return "minio";
    }

    @Override
    public boolean estaConfigurado() {
        return accessKey != null && !accessKey.isBlank();
    }

    @Override
    public String subir(String carpeta, String nombreOriginal, byte[] contenido, String contentType) {
        String key = carpeta + "/" + UUID.randomUUID() + "-" + limpiarNombre(nombreOriginal);
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

    @Override
    public byte[] descargar(String objectKey) {
        try (InputStream in = minioProvider.getObject().getObject(GetObjectArgs.builder()
                .bucket(bucket).object(objectKey).build())) {
            return in.readAllBytes();
        } catch (Exception e) {
            throw new IllegalStateException("Error descargando archivo de MinIO: " + e.getMessage(), e);
        }
    }

    @Override
    public void eliminar(String objectKey) {
        try {
            minioProvider.getObject().removeObject(
                    RemoveObjectArgs.builder().bucket(bucket).object(objectKey).build());
        } catch (Exception e) {
            throw new IllegalStateException("Error eliminando archivo de MinIO: " + e.getMessage(), e);
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
