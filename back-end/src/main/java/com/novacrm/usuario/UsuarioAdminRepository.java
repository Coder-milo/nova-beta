package com.novacrm.usuario;

import com.novacrm.auth.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UsuarioAdminRepository extends JpaRepository<Usuario, UUID> {
    boolean existsByEmail(String email);
}
