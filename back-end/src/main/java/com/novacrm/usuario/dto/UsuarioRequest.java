package com.novacrm.usuario.dto;

import com.novacrm.auth.Rol;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Set;
import java.util.UUID;

public record UsuarioRequest(
    @Email @NotBlank String email,
    @NotBlank String nombre,
    @NotBlank @Size(min = 8) String password,
    Set<Rol> roles,
    UUID empresaId
) {}
