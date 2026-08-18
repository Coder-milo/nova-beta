package com.novacrm.whatsapp;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lo que el portal del estudiante recibe del canal de WhatsApp.
 *
 * <p>{@code /whatsapp/mio} devolvia la ficha entera de configuracion, con el
 * identificador de telefono de Meta y si habia token guardado. La pantalla del
 * estudiante solo usa el numero al que escribir.
 *
 * <p>El {@code phoneId} no es una credencial por si solo —hace falta el token
 * para usarlo— pero es la otra mitad de lo que se necesita para enviar mensajes
 * en nombre de la institucion, y no pinta nada en el navegador de un
 * participante.
 */
class CanalDeSoporteSinCredencialesTest {

    private static WhatsappResponse fichaCompleta() {
        return new WhatsappResponse(UUID.randomUUID(), "Programa CAC",
                true, true, "+573001234567", "1234567890123456", true);
    }

    @Test
    @DisplayName("al portal le llega el numero y si el canal esta activo")
    void llevaLoQueLaPantallaUsa() {
        var canal = CanalDeSoporteResponse.de(fichaCompleta());

        assertThat(canal.numeroWhatsapp()).isEqualTo("+573001234567");
        assertThat(canal.configurado()).isTrue();
        assertThat(canal.activo()).isTrue();
    }

    @Test
    @DisplayName("y no lleva nada de la integracion")
    void noLlevaLaConfiguracionDeLaIntegracion() {
        var campos = Arrays.stream(CanalDeSoporteResponse.class.getRecordComponents())
                .map(java.lang.reflect.RecordComponent::getName)
                .toList();

        assertThat(campos)
                .as("el identificador de telefono de Meta no viaja al navegador del estudiante")
                .doesNotContain("phoneId", "tokenConfigurado");
        assertThat(campos).containsExactlyInAnyOrder("configurado", "activo", "numeroWhatsapp");
    }
}
