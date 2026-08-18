package com.novacrm.chat;

import com.novacrm.documento.StorageService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.auth.OwnershipService;
import com.novacrm.notificacion.NotificacionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/**
 * Quien puede bajarse un archivo del chat.
 *
 * <p>La comprobacion es la misma que para leer el mensaje: si no puedes ver la
 * conversacion, no puedes bajarte lo que se mando en ella. Sin esto, conocer el
 * id de un adjunto —o acertarlo— bastaria para descargarlo.
 */
class AdjuntoSoloParaQuienParticipaTest {

    private ChatAdjuntoRepository adjuntos;
    private StorageService almacenamiento;
    private OwnershipService ownership;
    private ChatDirectoService service;

    private Estudiante ana;
    private Estudiante beto;
    private Estudiante ajeno;
    private ChatAdjunto adjunto;

    private static Estudiante estudiante(String nombre) {
        var e = new Estudiante();
        e.setId(UUID.randomUUID());
        e.setNombre(nombre);
        return e;
    }

    @BeforeEach
    void configurar() {
        adjuntos = mock(ChatAdjuntoRepository.class);
        almacenamiento = mock(StorageService.class);
        ownership = mock(OwnershipService.class);
        service = new ChatDirectoService(
                mock(ChatDirectoMensajeRepository.class), mock(EstudianteRepository.class),
                ownership, mock(NotificacionService.class), mock(ReporteDeChatRepository.class),
                mock(BloqueoDeChatRepository.class), mock(ConversacionArchivadaRepository.class),
                adjuntos, almacenamiento);

        ana = estudiante("Ana");
        beto = estudiante("Beto");
        ajeno = estudiante("Ajeno");

        var mensaje = new ChatDirectoMensaje();
        mensaje.setRemitente(ana);
        mensaje.setDestinatario(beto);

        adjunto = new ChatAdjunto();
        adjunto.setMensaje(mensaje);
        adjunto.setNombre("nota.webm");
        adjunto.setContentType("audio/webm");
        adjunto.setObjectKey("chat/xyz-nota.webm");
        when(adjuntos.findById(any())).thenReturn(Optional.of(adjunto));
        when(almacenamiento.descargar("chat/xyz-nota.webm")).thenReturn(new byte[] {1, 2, 3});
    }

    private void miraA(Estudiante quien) {
        when(ownership.obtenerEstudianteAutenticado(any(Authentication.class))).thenReturn(quien);
    }

    @Test
    @DisplayName("quien lo mando puede bajarselo")
    void elRemitenteSi() {
        miraA(ana);
        assertThat(service.descargarAdjunto(UUID.randomUUID(), mock(Authentication.class)).contenido())
                .hasSize(3);
    }

    @Test
    @DisplayName("y quien lo recibio tambien")
    void elDestinatarioSi() {
        miraA(beto);
        assertThat(service.descargarAdjunto(UUID.randomUUID(), mock(Authentication.class)).nombre())
                .isEqualTo("nota.webm");
    }

    /**
     * Y con el mismo mensaje que si no existiera: quien pregunta por un adjunto
     * ajeno no tiene por que enterarse de que existe.
     */
    @Test
    @DisplayName("un tercero no, aunque tenga el id")
    void unTerceroNo() {
        miraA(ajeno);

        assertThatThrownBy(() -> service.descargarAdjunto(UUID.randomUUID(), mock(Authentication.class)))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("no encontrado");
        verify(almacenamiento, never()).descargar(any());
    }
}
