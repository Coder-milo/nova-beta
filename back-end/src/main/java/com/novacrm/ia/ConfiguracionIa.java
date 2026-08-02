package com.novacrm.ia;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.List;

/**
 * Fábrica de selección dinámica del proveedor de Inteligencia Artificial activo.
 * Selecciona según la propiedad {@code app.ia.proveedor} ("groq", "openai", "none").
 */
@Configuration
public class ConfiguracionIa {

    private static final Logger log = LoggerFactory.getLogger(ConfiguracionIa.class);

    @Bean
    @Primary
    public ProveedorIa proveedorIaActivo(List<ProveedorIa> proveedores,
                                         @Value("${app.ia.proveedor:groq}") String proveedorConfigurado) {
        String proveedorDeseado = proveedorConfigurado.toLowerCase().trim();
        log.info("Buscando proveedor de IA configurado: '{}'", proveedorDeseado);

        return proveedores.stream()
                .filter(p -> p.nombre().equalsIgnoreCase(proveedorDeseado))
                .findFirst()
                .orElseGet(() -> {
                    log.warn("Proveedor de IA '{}' no encontrado o no disponible. Usando NoopProveedorIa.", proveedorDeseado);
                    return new NoopProveedorIa();
                });
    }
}
