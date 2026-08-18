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
        when(estudianteRepository.findByEmailIgnoreCase("admin@novacrm.com")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> ownershipService.obtenerEstudianteAutenticado(autenticado("admin@novacrm.com", "ADMIN")));

        verify(estudianteRepository, never()).save(any());
    }

    @Test
    void devuelveLaFichaDelUsuarioAutenticado() {
        var id = UUID.randomUUID();
        when(estudianteRepository.findByEmailIgnoreCase("ana@novacrm.com"))
                .thenReturn(Optional.of(estudiante(id, "ana@novacrm.com")));

        var resultado = ownershipService.obtenerEstudianteAutenticado(
                autenticado("ana@novacrm.com", "ESTUDIANTE"));

        assertEquals(id, resultado.getId());
        verify(estudianteRepository, never()).save(any());
    }

    /**
     * La ficha se busca ignorando la caja del correo.
     *
     * <p>Los correos se cargan desde Excel tal y como vengan escritos —7 de los
     * 108 participantes reales tienen mayusculas— mientras que el subject del
     * JWT sale de la tabla de usuarios. Con igualdad exacta, una sola letra
     * distinta entre las dos tablas dejaba a esa persona sin acceso a nada de
     * su portal: todo el area del estudiante pasa por este metodo.
     */
    @Test
    void encuentraLaFichaAunqueElCorreoEsteEnOtraCaja() {
        var id = UUID.randomUUID();
        when(estudianteRepository.findByEmailIgnoreCase("Ana.Perez@Novacrm.com"))
                .thenReturn(Optional.of(estudiante(id, "ana.perez@novacrm.com")));

        var resultado = ownershipService.obtenerEstudianteAutenticado(
                autenticado("Ana.Perez@Novacrm.com", "ESTUDIANTE"));

        assertEquals(id, resultado.getId());
    }

    @Test
    void unEstudianteNoPuedeVerLosDatosDeOtro() {
        var propio = UUID.randomUUID();
        var ajeno = UUID.randomUUID();
        when(estudianteRepository.findByEmailIgnoreCase("ana@novacrm.com"))
                .thenReturn(Optional.of(estudiante(propio, "ana@novacrm.com")));

        assertThrows(AccessDeniedException.class, () -> ownershipService.verificarAccesoEstudiante(
                autenticado("ana@novacrm.com", "ESTUDIANTE"), ajeno));
    }

    @Test
    void unEstudiantePuedeVerSusPropiosDatos() {
        var propio = UUID.randomUUID();
        when(estudianteRepository.findByEmailIgnoreCase("ana@novacrm.com"))
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

        verify(estudianteRepository, never()).findByEmailIgnoreCase(any());
    }

    /**
     * Un rol privilegiado no necesita ficha de estudiante: la comprobacion debe
     * cortar antes de buscarla, o un admin sin ficha recibiria un 404 al
     * consultar a cualquier estudiante.
     */
    @Test
    void elAdminSinFichaDeEstudianteSigueTeniendoAcceso() {
        when(estudianteRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> ownershipService.verificarAccesoEstudiante(
                autenticado("admin@novacrm.com", "ADMIN"), UUID.randomUUID()));
    }
}
