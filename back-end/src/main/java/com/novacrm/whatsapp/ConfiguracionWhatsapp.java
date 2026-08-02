package com.novacrm.whatsapp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.List;

/**
 * Fábrica de selección dinámica del proveedor de WhatsApp activo.
 */
@Configuration
public class ConfiguracionWhatsapp {

    private static final Logger log = LoggerFactory.getLogger(ConfiguracionWhatsapp.class);

    @Bean
    @Primary
    public ProveedorWhatsapp proveedorWhatsappActivo(List<ProveedorWhatsapp> proveedores,
                                                     @Value("${app.whatsapp.proveedor:meta}") String proveedorConfigurado) {
        String proveedorDeseado = proveedorConfigurado.toLowerCase().trim();
        log.info("Seleccionando proveedor de WhatsApp: '{}'", proveedorDeseado);

        return proveedores.stream()
                .filter(p -> p.nombre().equalsIgnoreCase(proveedorDeseado))
                .findFirst()
                .orElseGet(() -> {
                    log.warn("Proveedor de WhatsApp '{}' no encontrado. Usando SimuladoWhatsappProveedor.", proveedorDeseado);
                    return new SimuladoWhatsappProveedor();
                });
    }
}
