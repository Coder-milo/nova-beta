package com.novacrm.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UsuarioRepository extends JpaRepository<Usuario, UUID> {
    Optional<Usuario> findByEmail(String email);

    Optional<Usuario> findByResetToken(String resetToken);
    boolean existsByEmail(String email);
}
