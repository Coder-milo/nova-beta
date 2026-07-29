package com.novacrm.config;

import io.minio.MinioClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;

@Configuration
public class MinioConfig {

    @Value("${app.minio.url}")
    private String url;

    @Value("${app.minio.access-key}")
    private String accessKey;

    @Value("${app.minio.secret-key}")
    private String secretKey;

    // @Lazy: el almacenamiento de archivos aun no se usa. Sin esto, el bean se crearia
    // al arrancar y fallaria si no hay credenciales MinIO (ej. en produccion gratuita sin
    // MinIO). Se instanciara solo cuando algo lo inyecte, ya con credenciales reales.
    @Bean
    @Lazy
    public MinioClient minioClient() {
        return MinioClient.builder()
                .endpoint(url)
                .credentials(accessKey, secretKey)
                .build();
    }
}
