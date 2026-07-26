package com.novacrm.auth;

import java.util.Set;
import java.util.UUID;

public record LoginResponse(String token, String refreshToken, UUID usuarioId, String email, String nombre, Set<Rol> roles) {}
