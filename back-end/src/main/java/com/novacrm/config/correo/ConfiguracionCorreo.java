package com.novacrm.config.correo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.List;

/**
 * Fábrica de selección dinámica del proveedor de correo activo.
 */
@Configuration
public class ConfiguracionCorreo {

    private static final Logger log = LoggerFactory.getLogger(ConfiguracionCorreo.class);

    @Bean
    @Primary
    public ProveedorCorreo proveedorCorreoActivo(List<ProveedorCorreo> proveedores,
                                                 @Value("${app.correo.proveedor:auto}") String proveedorConfigurado) {
        String proveedorDeseado = proveedorConfigurado.toLowerCase().trim();
        log.info("Seleccionando proveedor de correo: '{}'", proveedorDeseado);

        if (!"auto".equals(proveedorDeseado)) {
            return proveedores.stream()
                    .filter(p -> p.nombre().equalsIgnoreCase(proveedorDeseado))
                    .findFirst()
                    .orElseGet(() -> {
                        log.warn("Proveedor de correo '{}' no encontrado. Usando NoopProveedorCorreo.", proveedorDeseado);
                        return new NoopProveedorCorreo();
                    });
        }

        // Auto-detección: SMTP > SES > NOOP
        return proveedores.stream()
                .filter(p -> p.estaConfigurado() && !"noop".equalsIgnoreCase(p.nombre()))
                .findFirst()
                .orElseGet(() -> new NoopProveedorCorreo());
    }
}
