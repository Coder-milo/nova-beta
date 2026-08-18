package com.novacrm.chat;

import com.novacrm.auth.OwnershipService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.notificacion.NotificacionService;
import com.novacrm.programa.Programa;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * La lista de companeros con los que se puede montar un grupo.
 *
 * <p>La pantalla la pedia con la letra «a» para simular un «traemelos todos», y
 * el servicio exigia dos caracteres: devolvia lista vacia, asi que no habia
 * forma de elegir a nadie ni de crear un grupo.
 */
class ListarCompanerosTest {

    private EstudianteRepository estudiantes;
    private OwnershipService ownership;
    private BloqueoDeChatRepository bloqueos;
    private ChatDirectoService service;

    private static Estudiante companero(String nombre) {
        var e = new Estudiante();
        e.setId(UUID.randomUUID());
        e.setNombre(nombre);
        e.setApellido("Perez");
        return e;
    }

    @BeforeEach
    void configurar() {
        estudiantes = mock(EstudianteRepository.class);
        ownership = mock(OwnershipService.class);
        bloqueos = mock(BloqueoDeChatRepository.class);
        service = new ChatDirectoService(
                mock(ChatDirectoMensajeRepository.class), estudiantes, ownership,
                mock(NotificacionService.class), mock(ReporteDeChatRepository.class),
                bloqueos, mock(ConversacionArchivadaRepository.class),
                mock(ChatAdjuntoRepository.class), mock(com.novacrm.documento.StorageService.class));

        var programa = new Programa();
        programa.setId(UUID.randomUUID());
        var yo = companero("Yo");
        yo.setPrograma(programa);
        when(ownership.obtenerEstudianteAutenticado(any(Authentication.class))).thenReturn(yo);
        when(bloqueos.sinChatPosibleCon(any())).thenReturn(List.of());
        when(estudiantes.companerosQueCoinciden(any(), any(), any(), any(Pageable.class)))
                .thenReturn(List.of(companero("Luis"), companero("Yeison")));
    }

    @Test
    @DisplayName("sin termino se listan los companeros, no se devuelve vacio")
    void sinTerminoSeListan() {
        var lista = service.contactos("", mock(Authentication.class));

        assertThat(lista).hasSize(2);
        verify(estudiantes).companerosQueCoinciden(any(), any(), eq(""), any(Pageable.class));
    }

    /** Nulo es lo mismo que vacio: la pantalla puede no mandar el parametro. */
    @Test
    @DisplayName("y con null tambien")
    void conNullTambien() {
        assertThat(service.contactos(null, mock(Authentication.class))).hasSize(2);
    }

    @Test
    @DisplayName("con termino sigue filtrando")
    void conTerminoFiltra() {
        service.contactos("  Lui  ", mock(Authentication.class));

        verify(estudiantes).companerosQueCoinciden(any(), any(), eq("lui"), any(Pageable.class));
    }
}
