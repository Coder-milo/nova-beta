package com.novacrm.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "El email es obligatorio")
        @Email(message = "El email no es valido")
        String email,

        @NotBlank(message = "La contrasena es obligatoria")
        String password) {}
