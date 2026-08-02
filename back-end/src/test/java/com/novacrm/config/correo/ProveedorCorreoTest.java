package com.novacrm.config.correo;

import com.novacrm.config.EmailService;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class ProveedorCorreoTest {

    @Test
    @DisplayName("Debe seleccionar SMTP cuando está configurado")
    void debeSeleccionarSmtp() {
        var smtp = new SmtpProveedorCorreo(Optional.empty());
        var ses = new SesProveedorCorreo(null, "noreply@novacrm.com", "");
        var noop = new NoopProveedorCorreo();
        var config = new ConfiguracionCorreo();

        var seleccionado = config.proveedorCorreoActivo(List.of(smtp, ses, noop), "smtp");

        assertThat(seleccionado).isNotNull();
        assertThat(seleccionado.nombre()).isEqualTo("smtp");
    }

    @Test
    @DisplayName("Debe seleccionar SES cuando está configurado")
    void debeSeleccionarSes() {
        var smtp = new SmtpProveedorCorreo(Optional.empty());
        var ses = new SesProveedorCorreo(null, "noreply@novacrm.com", "AKIA123");
        var noop = new NoopProveedorCorreo();
        var config = new ConfiguracionCorreo();

        var seleccionado = config.proveedorCorreoActivo(List.of(smtp, ses, noop), "ses");

        assertThat(seleccionado).isNotNull();
        assertThat(seleccionado.nombre()).isEqualTo("ses");
    }

    @Test
    @DisplayName("Debe caer en NoopProveedorCorreo si no hay ningún canal configurado en modo auto")
    void debeCaerEnNoopEnAutoSinConfiguracion() {
        var smtp = new SmtpProveedorCorreo(Optional.empty());
        var ses = new SesProveedorCorreo(null, "noreply@novacrm.com", "");
        var noop = new NoopProveedorCorreo();
        var config = new ConfiguracionCorreo();

        var seleccionado = config.proveedorCorreoActivo(List.of(smtp, ses, noop), "auto");

        assertThat(seleccionado).isNotNull();
        assertThat(seleccionado.nombre()).isEqualTo("noop");
        assertThat(seleccionado.estaConfigurado()).isFalse();

        var resultado = seleccionado.enviar("test@example.com", "Asunto", "<p>Hola</p>");
        assertThat(resultado.enviado()).isFalse();
    }
}
