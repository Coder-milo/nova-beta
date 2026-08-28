package com.novacrm.config.correo;

import com.novacrm.config.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.awscore.exception.AwsErrorDetails;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.SendEmailRequest;
import software.amazon.awssdk.services.ses.model.SendEmailResponse;
import software.amazon.awssdk.services.ses.model.SesException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SesProveedorCorreoTest {

    @Mock
    private SesClient sesClient;

    private SesProveedorCorreo proveedorConfigurado;
    private SesProveedorCorreo proveedorSinConfigurar;

    @BeforeEach
    void setUp() {
        proveedorConfigurado = new SesProveedorCorreo(sesClient, "noreply@novacrm.com", "AKIA_TEST_KEY_123");
        proveedorSinConfigurar = new SesProveedorCorreo(null, "noreply@novacrm.com", "");
    }

    @Test
    @DisplayName("estaConfigurado verifica la presencia de AWS_ACCESS_KEY_ID")
    void estaConfiguradoVerificaCredenciales() {
        assertThat(proveedorConfigurado.estaConfigurado()).isTrue();
        assertThat(proveedorSinConfigurar.estaConfigurado()).isFalse();

        var sesNullKey = new SesProveedorCorreo(null, "noreply@novacrm.com", null);
        assertThat(sesNullKey.estaConfigurado()).isFalse();

        var sesBlankKey = new SesProveedorCorreo(null, "noreply@novacrm.com", "   ");
        assertThat(sesBlankKey.estaConfigurado()).isFalse();
    }

    @Test
    @DisplayName("nombre y canalActivo retornan identificadores de SES")
    void identificadoresSonCorrectos() {
        assertThat(proveedorConfigurado.nombre()).isEqualTo("ses");
        assertThat(proveedorConfigurado.canalActivo()).isEqualTo("SES");
    }

    @Test
    @DisplayName("enviar sin configurar retorna fallo sin invocar cliente AWS")
    void enviarSinConfiguracionRetornaFallo() {
        EmailService.Resultado resultado = proveedorSinConfigurar.enviar(
                "destinatario@ejemplo.com", "Asunto", "<p>Hola</p>");

        assertThat(resultado.enviado()).isFalse();
        assertThat(resultado.motivoFallo()).contains("Amazon SES no configurado");
    }

    @Test
    @DisplayName("enviar configurado construye SendEmailRequest en UTF-8 y despacha exitosamente")
    void enviarConfiguradoDespachaExitosamente() {
        when(sesClient.sendEmail(any(SendEmailRequest.class)))
                .thenReturn(SendEmailResponse.builder().messageId("msg-12345").build());

        EmailService.Resultado resultado = proveedorConfigurado.enviar(
                "estudiante@eurocentres.edu.co",
                "Activación de tu cuenta",
                "<h1>Bienvenido</h1><p>Contenido con tildes: Canción, Acción</p>");

        assertThat(resultado.enviado()).isTrue();
        assertThat(resultado.motivoFallo()).isNull();

        ArgumentCaptor<SendEmailRequest> captor = ArgumentCaptor.forClass(SendEmailRequest.class);
        verify(sesClient).sendEmail(captor.capture());

        SendEmailRequest request = captor.getValue();
        assertThat(request.source()).isEqualTo("noreply@novacrm.com");
        assertThat(request.destination().toAddresses()).containsExactly("estudiante@eurocentres.edu.co");
        assertThat(request.message().subject().data()).isEqualTo("Activación de tu cuenta");
        assertThat(request.message().subject().charset()).isEqualTo("UTF-8");
        assertThat(request.message().body().html().data()).contains("Contenido con tildes");
        assertThat(request.message().body().html().charset()).isEqualTo("UTF-8");
        assertThat(request.message().body().text().data()).contains("Contenido con tildes");
        assertThat(request.message().body().text().charset()).isEqualTo("UTF-8");
    }

    @Test
    @DisplayName("enviar captura SesException y retorna fallo con mensaje detallado de AWS")
    void enviarCapturaSesException() {
        AwsErrorDetails awsError = AwsErrorDetails.builder()
                .errorMessage("Email address is not verified in Amazon SES.")
                .errorCode("MessageRejected")
                .build();

        SesException sesException = (SesException) SesException.builder()
                .message("MessageRejected")
                .awsErrorDetails(awsError)
                .build();

        when(sesClient.sendEmail(any(SendEmailRequest.class))).thenThrow(sesException);

        EmailService.Resultado resultado = proveedorConfigurado.enviar(
                "no.verificado@ejemplo.com", "Asunto", "<p>Mensaje</p>");

        assertThat(resultado.enviado()).isFalse();
        assertThat(resultado.motivoFallo()).isEqualTo("Email address is not verified in Amazon SES.");
    }

    @Test
    @DisplayName("enviar captura excepciones inesperadas y retorna fallo limpio")
    void enviarCapturaExcepcionesInesperadas() {
        when(sesClient.sendEmail(any(SendEmailRequest.class)))
                .thenThrow(new RuntimeException("Connection timeout to SES endpoint"));

        EmailService.Resultado resultado = proveedorConfigurado.enviar(
                "usuario@ejemplo.com", "Asunto", "<p>Mensaje</p>");

        assertThat(resultado.enviado()).isFalse();
        assertThat(resultado.motivoFallo()).contains("Connection timeout to SES endpoint");
    }
}
