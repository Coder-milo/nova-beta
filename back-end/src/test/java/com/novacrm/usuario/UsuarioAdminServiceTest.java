package com.novacrm.usuario;

import com.novacrm.auth.Rol;
import com.novacrm.auth.Usuario;
import com.novacrm.auth.UsuarioRepository;
import com.novacrm.empresa.Empresa;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.usuario.dto.UsuarioRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UsuarioAdminServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private EmpresaRepository empresaRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UsuarioAdminService service;

    @BeforeEach
    void setUp() {
        service = new UsuarioAdminService(usuarioRepository, empresaRepository, passwordEncoder);
    }

    @Test
    void crearUsuarioCoordinadorExitoso() {
        when(usuarioRepository.existsByEmailIgnoreCase("coord@test.com")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("encoded");
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(inv -> {
            Usuario u = inv.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });

        var req = new UsuarioRequest("coord@test.com", "Coordinador", "secret123", Set.of(Rol.COORDINADOR), null);
        var resp = service.crear(req);

        assertNotNull(resp);
        assertEquals("coord@test.com", resp.email());
        assertTrue(resp.roles().contains(Rol.COORDINADOR));
    }

    @Test
    void crearUsuarioEmpresaSinEmpresaLanzaExcepcion() {
        when(usuarioRepository.existsByEmailIgnoreCase("empresa@test.com")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("encoded");

        var req = new UsuarioRequest("empresa@test.com", "Contacto", "secret123", Set.of(Rol.EMPRESA), null);
        assertThrows(BusinessException.class, () -> service.crear(req));
    }

    @Test
    void crearUsuarioEmpresaConEmpresaVinculaCorrectamente() {
        UUID empresaId = UUID.randomUUID();
        Empresa empresa = new Empresa();
        empresa.setId(empresaId);
        empresa.setNombre("Tech Corp");

        when(usuarioRepository.existsByEmailIgnoreCase("empresa@test.com")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("encoded");
        when(empresaRepository.findById(empresaId)).thenReturn(Optional.of(empresa));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(inv -> {
            Usuario u = inv.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });

        var req = new UsuarioRequest("empresa@test.com", "Contacto", "secret123", Set.of(Rol.EMPRESA), empresaId);
        var resp = service.crear(req);

        assertNotNull(resp);
        assertEquals("empresa@test.com", resp.email());
        assertEquals("Tech Corp", resp.empresaNombre());
        assertEquals(empresaId, resp.empresaId());
        assertTrue(resp.roles().contains(Rol.EMPRESA));
    }
}
