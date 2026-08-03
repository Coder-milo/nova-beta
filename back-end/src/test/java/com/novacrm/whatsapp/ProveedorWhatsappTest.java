package com.novacrm.whatsapp;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ProveedorWhatsappTest {

    @Test
    @DisplayName("Debe seleccionar proveedor Meta cuando está configurado")
    void debeSeleccionarMeta() {
        var meta = new MetaCloudWhatsappProveedor(null);
        var simulado = new SimuladoWhatsappProveedor();
        var config = new ConfiguracionWhatsapp();

        var seleccionado = config.proveedorWhatsappActivo(List.of(meta, simulado), "meta");

        assertThat(seleccionado).isNotNull();
        assertThat(seleccionado.nombre()).isEqualTo("meta");
    }

    @Test
    @DisplayName("Debe seleccionar proveedor Simulado cuando está configurado")
    void debeSeleccionarSimulado() {
        var meta = new MetaCloudWhatsappProveedor(null);
        var simulado = new SimuladoWhatsappProveedor();
        var config = new ConfiguracionWhatsapp();

        var seleccionado = config.proveedorWhatsappActivo(List.of(meta, simulado), "simulado");

        assertThat(seleccionado).isNotNull();
        assertThat(seleccionado.nombre()).isEqualTo("simulado");

        var programaId = UUID.randomUUID();
        assertThat(seleccionado.estaConfigurado(programaId)).isTrue();

        var resultado = seleccionado.enviarTexto(programaId, "3001234567", "Hola test");
        assertThat(resultado.enviado()).isTrue();
    }

    @Test
    @DisplayName("Debe normalizar correctamente números de celular de Colombia")
    void debeNormalizarCelular() {
        assertThat(WhatsappSender.normalizarDestino("3001234567")).isEqualTo("+573001234567");
        assertThat(WhatsappSender.normalizarDestino("+573001234567")).isEqualTo("+573001234567");
        assertThat(WhatsappSender.normalizarDestino("invalid")).isNull();
    }
}
