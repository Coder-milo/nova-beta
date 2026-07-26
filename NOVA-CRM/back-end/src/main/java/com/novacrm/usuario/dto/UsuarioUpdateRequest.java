package com.novacrm.usuario.dto;

import com.novacrm.auth.Rol;

import java.util.Set;

public record UsuarioUpdateRequest(
    String nombre,
    Set<Rol> roles,
    Boolean activo,
    String password
) {}
