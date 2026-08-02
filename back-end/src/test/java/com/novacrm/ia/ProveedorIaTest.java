package com.novacrm.ia;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProveedorIaTest {

    @Test
    @DisplayName("Debe seleccionar Groq cuando está configurado como proveedor")
    void debeSeleccionarGroq() {
        var groq = new ClienteGroq("", "llama", 1000);
        var openAi = new OpenAiProveedorIa("", "gpt-4o");
        var noop = new NoopProveedorIa();
        var config = new ConfiguracionIa();

        var seleccionado = config.proveedorIaActivo(List.of(groq, openAi, noop), "groq");

        assertThat(seleccionado).isNotNull();
        assertThat(seleccionado.nombre()).isEqualTo("groq");
    }

    @Test
    @DisplayName("Debe seleccionar OpenAI cuando está configurado como proveedor")
    void debeSeleccionarOpenAi() {
        var groq = new ClienteGroq("", "llama", 1000);
        var openAi = new OpenAiProveedorIa("", "gpt-4o");
        var noop = new NoopProveedorIa();
        var config = new ConfiguracionIa();

        var seleccionado = config.proveedorIaActivo(List.of(groq, openAi, noop), "openai");

        assertThat(seleccionado).isNotNull();
        assertThat(seleccionado.nombre()).isEqualTo("openai");
    }

    @Test
    @DisplayName("Debe seleccionar proveedor Custom/Genérico (DeepSeek, Ollama, etc.)")
    void debeSeleccionarCustom() {
        var groq = new ClienteGroq("", "llama", 1000);
        var custom = new GenericoOpenAiProveedorIa("", "deepseek-chat", "https://api.deepseek.com/v1", 0.0);
        var config = new ConfiguracionIa();

        var seleccionado = config.proveedorIaActivo(List.of(groq, custom), "custom");

        assertThat(seleccionado).isNotNull();
        assertThat(seleccionado.nombre()).isEqualTo("custom");
    }
}
