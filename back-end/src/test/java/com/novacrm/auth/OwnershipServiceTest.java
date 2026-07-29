package com.novacrm.auth;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.ResourceNotFoundException;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Reglas de acceso a los datos de un estudiante.
 *
 * <p>Cubre tambien que consultar un perfil no cree registros: la version
 * anterior insertaba un estudiante ficticio matriculado en un programa
 * arbitrario cuando el usuario autenticado no tenia ficha.
 */
class OwnershipServiceTest {

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

    private Estudiante estudiante(UUID id, String email) {
        var e = new Estudiante();
        e.setId(id);
        e.setEmail(email);
        return e;
    }

    @Test
    void consultarUnPerfilInexistenteNoCreaNingunRegistro() {
        when(estudianteRepository.findByEmail("admin@novacrm.com")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> ownershipService.obtenerEstudianteAutenticado(autenticado("admin@novacrm.com", "ADMIN")));

        verify(estudianteRepository, never()).save(any());
    }

    @Test
    void devuelveLaFichaDelUsuarioAutenticado() {
        var id = UUID.randomUUID();
        when(estudianteRepository.findByEmail("ana@novacrm.com"))
                .thenReturn(Optional.of(estudiante(id, "ana@novacrm.com")));

        var resultado = ownershipService.obtenerEstudianteAutenticado(
                autenticado("ana@novacrm.com", "ESTUDIANTE"));

        assertEquals(id, resultado.getId());
        verify(estudianteRepository, never()).save(any());
    }

    @Test
    void unEstudianteNoPuedeVerLosDatosDeOtro() {
        var propio = UUID.randomUUID();
        var ajeno = UUID.randomUUID();
        when(estudianteRepository.findByEmail("ana@novacrm.com"))
                .thenReturn(Optional.of(estudiante(propio, "ana@novacrm.com")));

        assertThrows(AccessDeniedException.class, () -> ownershipService.verificarAccesoEstudiante(
                autenticado("ana@novacrm.com", "ESTUDIANTE"), ajeno));
    }

    @Test
    void unEstudiantePuedeVerSusPropiosDatos() {
        var propio = UUID.randomUUID();
        when(estudianteRepository.findByEmail("ana@novacrm.com"))
                .thenReturn(Optional.of(estudiante(propio, "ana@novacrm.com")));

        assertDoesNotThrow(() -> ownershipService.verificarAccesoEstudiante(
                autenticado("ana@novacrm.com", "ESTUDIANTE"), propio));
    }

    @Test
    void coordinadorYAdminAccedenACualquierEstudiante() {
        var ajeno = UUID.randomUUID();

        assertDoesNotThrow(() -> ownershipService.verificarAccesoEstudiante(
                autenticado("coord@novacrm.com", "COORDINADOR"), ajeno));
        assertDoesNotThrow(() -> ownershipService.verificarAccesoEstudiante(
                autenticado("admin@novacrm.com", "ADMIN"), ajeno));

        verify(estudianteRepository, never()).findByEmail(any());
    }

    /**
     * Un rol privilegiado no necesita ficha de estudiante: la comprobacion debe
     * cortar antes de buscarla, o un admin sin ficha recibiria un 404 al
     * consultar a cualquier estudiante.
     */
    @Test
    void elAdminSinFichaDeEstudianteSigueTeniendoAcceso() {
        when(estudianteRepository.findByEmail(any())).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> ownershipService.verificarAccesoEstudiante(
                autenticado("admin@novacrm.com", "ADMIN"), UUID.randomUUID()));
    }
}
