package com.novacrm.usuario.dto;

import com.novacrm.auth.Rol;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record UsuarioResponse(
    UUID id,
    String email,
    String nombre,
    Set<Rol> roles,
    boolean activo,
    Instant createdAt,
    UUID empresaId,
    String empresaNombre
) {}
