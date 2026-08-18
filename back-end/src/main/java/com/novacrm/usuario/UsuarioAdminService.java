package com.novacrm.usuario;

import com.novacrm.auth.Usuario;
import com.novacrm.auth.UsuarioRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.usuario.dto.UsuarioRequest;
import com.novacrm.usuario.dto.UsuarioResponse;
import com.novacrm.usuario.dto.UsuarioUpdateRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class UsuarioAdminService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public UsuarioAdminService(UsuarioRepository usuarioRepository,
                               PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<UsuarioResponse> listar() {
        return usuarioRepository.findAll().stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    @Transactional
    public UsuarioResponse crear(UsuarioRequest request) {
        if (usuarioRepository.existsByEmailIgnoreCase(request.email())) {
            throw new BusinessException("Ya existe un usuario con el email: " + request.email());
        }
        Usuario usuario = new Usuario();
        usuario.setEmail(request.email());
        usuario.setNombre(request.nombre());
        usuario.setPassword(passwordEncoder.encode(request.password()));
        usuario.setRoles(request.roles());
        usuario.setActivo(true);
        return toResponse(usuarioRepository.save(usuario));
    }

    @Transactional
    public UsuarioResponse actualizar(UUID id, UsuarioUpdateRequest request) {
        Usuario usuario = obtenerPorId(id);
        if (request.nombre() != null && !request.nombre().isBlank()) {
            usuario.setNombre(request.nombre());
        }
        if (request.roles() != null && !request.roles().isEmpty()) {
            usuario.setRoles(request.roles());
        }
        if (request.activo() != null) {
            usuario.setActivo(request.activo());
        }
        if (request.password() != null && !request.password().isBlank()) {
            // cambiarPassword y no setPassword: si un administrador cambia la
            // contrasena de alguien es porque esa cuenta ya no es de fiar, y
            // dejarle la sesion abierta vacia el gesto.
            usuario.cambiarPassword(passwordEncoder.encode(request.password()));
        }
        return toResponse(usuarioRepository.save(usuario));
    }

    @Transactional
    public void desactivar(UUID id) {
        Usuario usuario = obtenerPorId(id);
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && usuario.getEmail() != null && usuario.getEmail().equalsIgnoreCase(auth.getName())) {
            throw new BusinessException("No puedes desactivar tu propio usuario");
        }
        usuario.setActivo(false);
        usuarioRepository.save(usuario);
    }

    private Usuario obtenerPorId(UUID id) {
        return usuarioRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado: " + id));
    }

    private UsuarioResponse toResponse(Usuario usuario) {
        return new UsuarioResponse(
            usuario.getId(),
            usuario.getEmail(),
            usuario.getNombre(),
            usuario.getRoles(),
            usuario.isActivo(),
            usuario.getCreatedAt()
        );
    }
}
