package com.novacrm.documento;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.List;

/**
 * Fábrica de selección dinámica del proveedor de almacenamiento de archivos activo.
 */
@Configuration
public class ConfiguracionAlmacenamiento {

    private static final Logger log = LoggerFactory.getLogger(ConfiguracionAlmacenamiento.class);

    @Bean
    @Primary
    public ProveedorAlmacenamiento proveedorAlmacenamientoActivo(List<ProveedorAlmacenamiento> proveedores,
                                                                 @Value("${app.storage.proveedor:auto}") String proveedorConfigurado) {
        String proveedorDeseado = proveedorConfigurado.toLowerCase().trim();
        log.info("Seleccionando proveedor de almacenamiento: '{}'", proveedorDeseado);

        if (!"auto".equals(proveedorDeseado)) {
            return proveedores.stream()
                    .filter(p -> p.nombre().equalsIgnoreCase(proveedorDeseado))
                    .findFirst()
                    .orElseGet(() -> {
                        log.warn("Proveedor de almacenamiento '{}' no encontrado. Usando LocalProveedorAlmacenamiento.", proveedorDeseado);
                        return new LocalProveedorAlmacenamiento("./storage");
                    });
        }

        // Auto-detección: MinIO si está configurado, si no Local
        return proveedores.stream()
                .filter(p -> p.estaConfigurado() && "minio".equalsIgnoreCase(p.nombre()))
                .findFirst()
                .orElseGet(() -> new LocalProveedorAlmacenamiento("./storage"));
    }
}
