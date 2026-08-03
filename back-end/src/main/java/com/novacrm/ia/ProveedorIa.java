package com.novacrm.ia;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;

/**
 * Contrato unificado para proveedores de Inteligencia Artificial (LLM).
 * Permite intercambiar proveedores (Groq, OpenAI, Claude, modelos locales)
 * sin modificar la lógica del negocio.
 */
public interface ProveedorIa {

    /** Si el proveedor está configurado y listo para recibir consultas. */
    boolean disponible();

    /**
     * Completa un prompt esperando una respuesta estructurada en formato JSON.
     *
     * @param instrucciones prompt de sistema con las instrucciones de formato
     * @param contenido prompt de usuario con la información a analizar
     * @return el JSON parseado o vacío si la consulta falla
     */
    Optional<JsonNode> completarJson(String instrucciones, String contenido);

    /** Nombre identificador del proveedor (ej. "groq", "openai", "none"). */
    String nombre();
}
