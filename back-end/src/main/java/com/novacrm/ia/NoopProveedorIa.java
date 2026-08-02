package com.novacrm.ia;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Proveedor nulo / deshabilitado para entornos donde no se requiera o no se desee usar IA.
 */
@Component
public class NoopProveedorIa implements ProveedorIa {

    @Override
    public String nombre() {
        return "none";
    }

    @Override
    public boolean disponible() {
        return false;
    }

    @Override
    public Optional<JsonNode> completarJson(String instrucciones, String contenido) {
        return Optional.empty();
    }
}
