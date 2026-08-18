package com.novacrm.usuario.dto;

import com.novacrm.auth.Rol;

import java.util.Set;
import java.util.UUID;

public record UsuarioUpdateRequest(
    String nombre,
    Set<Rol> roles,
    Boolean activo,
    String password,
    UUID empresaId
) {}
