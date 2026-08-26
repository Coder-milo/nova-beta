package com.novacrm.correo;

import com.novacrm.config.EmailService;
import com.novacrm.config.MarcaCorreo;
import com.novacrm.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VistaPreviaCorreoTest {

    @Mock
    private MarcaCorreoService marcaService;

    @Mock
    private EmailService emailService;

    private VistaPreviaCorreoController controller;

    private static final MarcaCorreo MARCA = new MarcaCorreo(
            "https://cdn.ejemplo.com/logo.png", 520, 160,
            "https://cdn.ejemplo.com/pie.png", 1200, 200,
            "Aliados", "#1B6DF5");

    @BeforeEach
    void setUp() {
        controller = new VistaPreviaCorreoController(marcaService, emailService);
        lenient().when(marcaService.para(any())).thenReturn(MARCA);
        lenient().when(marcaService.frontendUrl()).thenReturn("https://nova.ejemplo.com");
    }

    @Test
    @DisplayName("GET /tipos devuelve todos los tipos de correo disponibles")
    void listarTiposDevuelveCatalogoCompleto() {
        var tipos = controller.tipos();

        assertThat(tipos).isNotEmpty();
        assertThat(tipos).extracting(VistaPreviaCorreoController.TipoCorreoResponse::id)
                .contains("ACTIVACION", "RECUPERACION", "CITA_ENTREVISTA", "ASIGNACION_VACANTE", "RECORDATORIO_HV", "ANUNCIO");
    }

    @Test
    @DisplayName("GET /vista-previa/{tipo} renderiza HTML para tipos válidos")
    void vistaPreviaGeneraHtmlParaTiposValidos() {
        for (var tipo : CorreosDelSistema.Tipo.values()) {
            String html = controller.vistaPrevia(tipo.name(), UUID.randomUUID());

            assertThat(html)
                    .as("Vista previa de %s debe ser HTML válido", tipo)
                    .startsWith("<!DOCTYPE html>")
                    .contains("https://cdn.ejemplo.com/logo.png");
        }
    }

    @Test
    @DisplayName("GET /vista-previa/{tipo} lanza BusinessException para tipo inexistente")
    void vistaPreviaLanzaExcepcionParaTipoInexistente() {
        assertThatThrownBy(() -> controller.vistaPrevia("NO_EXISTE", null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Tipo de correo no reconocido: NO_EXISTE");
    }

    @Test
    @DisplayName("POST /enviar-prueba despacha exitosamente un correo del sistema")
    void enviarPruebaExitoso() {
        when(emailService.canalActivo()).thenReturn("SES");
        when(emailService.enviar(anyString(), anyString(), anyString()))
                .thenReturn(EmailService.Resultado.ok());

        var req = new PlantillaDtos.EnviarPruebaSistemaRequest(
                CorreosDelSistema.Tipo.ACTIVACION,
                "admin@eurocentres.edu.co",
                UUID.randomUUID());

        var resp = controller.enviarPrueba(req);

        assertThat(resp.enviados()).isEqualTo(1);
        assertThat(resp.bloqueadosPorLista()).isEqualTo(0);
        assertThat(resp.fallidos()).isEqualTo(0);
        assertThat(resp.canalDeCorreo()).isEqualTo("SES");

        verify(emailService).enviar(
                eq("admin@eurocentres.edu.co"),
                eq("[Prueba] Activación de cuenta — NOVA CRM"),
                argThat(html -> html.contains("<!DOCTYPE html>") && html.contains("Activa tu acceso al panel")));
    }

    @Test
    @DisplayName("POST /enviar-prueba detecta bloqueo por lista de pruebas")
    void enviarPruebaBloqueadoPorLista() {
        when(emailService.canalActivo()).thenReturn("SMTP");
        when(emailService.enviar(anyString(), anyString(), anyString()))
                .thenReturn(EmailService.Resultado.fallo("Destinatario fuera de la lista de pruebas permitida"));

        var req = new PlantillaDtos.EnviarPruebaSistemaRequest(
                CorreosDelSistema.Tipo.RECUPERACION,
                "externo@empresa.com",
                null);

        var resp = controller.enviarPrueba(req);

        assertThat(resp.enviados()).isEqualTo(0);
        assertThat(resp.bloqueadosPorLista()).isEqualTo(1);
        assertThat(resp.fallidos()).isEqualTo(0);
        assertThat(resp.canalDeCorreo()).isEqualTo("SMTP");
    }

    @Test
    @DisplayName("POST /enviar-prueba maneja fallo general de transporte")
    void enviarPruebaFalloGeneral() {
        when(emailService.canalActivo()).thenReturn("SES");
        when(emailService.enviar(anyString(), anyString(), anyString()))
                .thenReturn(EmailService.Resultado.fallo("Conexión rechazada por el servidor"));

        var req = new PlantillaDtos.EnviarPruebaSistemaRequest(
                CorreosDelSistema.Tipo.ASIGNACION_VACANTE,
                "usuario@ejemplo.com",
                null);

        var resp = controller.enviarPrueba(req);

        assertThat(resp.enviados()).isEqualTo(0);
        assertThat(resp.bloqueadosPorLista()).isEqualTo(0);
        assertThat(resp.fallidos()).isEqualTo(1);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "notanemail", "admin@", "@dominio.com", "admin @dominio.com"})
    @DisplayName("POST /enviar-prueba rechaza emails inválidos con BusinessException")
    void enviarPruebaRechazaEmailInvalido(String emailInvalido) {
        var req = new PlantillaDtos.EnviarPruebaSistemaRequest(
                CorreosDelSistema.Tipo.ANUNCIO,
                emailInvalido,
                null);

        assertThatThrownBy(() -> controller.enviarPrueba(req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Dirección de correo electrónico inválida");

        verifyNoInteractions(emailService);
    }

    @Test
    @DisplayName("POST /enviar-prueba rechaza solicitud con tipo nulo")
    void enviarPruebaRechazaTipoNulo() {
        var req = new PlantillaDtos.EnviarPruebaSistemaRequest(
                null,
                "admin@eurocentres.edu.co",
                null);

        assertThatThrownBy(() -> controller.enviarPrueba(req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Debe especificar un tipo de correo del sistema.");

        assertThatThrownBy(() -> controller.enviarPrueba(null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Debe especificar un tipo de correo del sistema.");

        verifyNoInteractions(emailService);
    }
}
