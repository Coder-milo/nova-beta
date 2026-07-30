package com.novacrm.linkedin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/linkedin")
@Tag(name = "LinkedIn", description = "Integracion con LinkedIn para compartir credenciales")
public class LinkedinController {

    @Value("${app.linkedin.client-id}")
    private String clientId;

    @Value("${app.linkedin.redirect-uri}")
    private String redirectUri;

    public LinkedinController() {
    }

    @GetMapping("/auth-url")
    @Operation(summary = "Obtener URL de autorizacion de LinkedIn")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR', 'ESTUDIANTE')")
    public String obtenerAuthUrl(@RequestParam UUID estudianteId) {
        var scopes = "w_member_social";
        return "https://www.linkedin.com/oauth/v2/authorization?"
                + "response_type=code&client_id=" + clientId
                + "&redirect_uri=" + redirectUri
                + "&scope=" + scopes
                + "&state=" + estudianteId.toString();
    }

    @PostMapping("/callback")
    @Operation(summary = "Callback de autorizacion de LinkedIn")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR', 'ESTUDIANTE')")
    public String callback(@RequestParam String code,
                           @RequestParam UUID estudianteId) {
        return "Implementar intercambio de code por token";
    }

    @PostMapping("/compartir")
    @Operation(summary = "Compartir credencial en LinkedIn")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR', 'ESTUDIANTE')")
    public void compartir(@RequestParam UUID estudianteId,
                          @RequestParam UUID credencialId) {
        // Implementacion con LinkedIn API v2 /ugcPosts
    }
}
