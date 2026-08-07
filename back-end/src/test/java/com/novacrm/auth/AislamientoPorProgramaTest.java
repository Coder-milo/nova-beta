package com.novacrm.auth;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.programa.Programa;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Un estudiante solo ve el programa en el que esta matriculado.
 *
 * <p>La plataforma aloja varios clientes a la vez. Que un estudiante de un
 * programa pueda asomarse a otro no es solo un fallo de permisos: le revela que
 * ese otro cliente existe y con que marca opera.
 */
class AislamientoPorProgramaTest {

    private static final UUID PROGRAMA_PROPIO = UUID.randomUUID();
    private static final UUID PROGRAMA_AJENO = UUID.randomUUID();

    private EstudianteRepository estudianteRepository;
    private OwnershipService ownershipService;

    @BeforeEach
    void configurar() {
        estudianteRepository = mock(EstudianteRepository.class);
        ownershipService = new OwnershipService(estudianteRepository);
    }

    private Authentication autenticado(String email, String... roles) {
        var authorities = List.of(roles).stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                .toList();
        return new UsernamePasswordAuthenticationToken(email, null, authorities);
    }

    private void estudianteEn(String email, UUID programaId) {
        var programa = new Programa();
        programa.setId(programaId);

        var estudiante = new Estudiante();
        estudiante.setId(UUID.randomUUID());
        estudiante.setEmail(email);
        estudiante.setPrograma(programa);

        when(estudianteRepository.findByEmailIgnoreCase(email)).thenReturn(Optional.of(estudiante));
    }

    @Test
    void unEstudianteEntraASuPrograma() {
        estudianteEn("hector@ejemplo.com", PROGRAMA_PROPIO);

        assertDoesNotThrow(() -> ownershipService.verificarAccesoPrograma(
                autenticado("hector@ejemplo.com", "ESTUDIANTE"), PROGRAMA_PROPIO));
    }

    @Test
    void unEstudianteNoEntraAlProgramaDeOtroCliente() {
        estudianteEn("hector@ejemplo.com", PROGRAMA_PROPIO);

        assertThrows(AccessDeniedException.class, () -> ownershipService.verificarAccesoPrograma(
                autenticado("hector@ejemplo.com", "ESTUDIANTE"), PROGRAMA_AJENO));
    }

    @Test
    void unCoordinadorVeCualquierPrograma() {
        // No se le pide ficha de estudiante: se decide por el rol antes de
        // buscarla, para que un coordinador sin ficha no reciba un 404.
        assertDoesNotThrow(() -> ownershipService.verificarAccesoPrograma(
                autenticado("coord@novacrm.com", "COORDINADOR"), PROGRAMA_AJENO));
        verify(estudianteRepository, never()).findByEmailIgnoreCase(anyString());
    }

    @Test
    void unAdminVeCualquierPrograma() {
        assertDoesNotThrow(() -> ownershipService.verificarAccesoPrograma(
                autenticado("admin@novacrm.com", "ADMIN"), PROGRAMA_AJENO));
    }

    @Test
    void seSabeElProgramaDelEstudianteSinQueTengaQueMandarlo() {
        estudianteEn("hector@ejemplo.com", PROGRAMA_PROPIO);

        assertEquals(PROGRAMA_PROPIO, ownershipService.programaDelEstudianteAutenticado(
                autenticado("hector@ejemplo.com", "ESTUDIANTE")));
    }
}
