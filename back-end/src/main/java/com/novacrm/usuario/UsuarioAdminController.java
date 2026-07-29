package com.novacrm.usuario;

import com.novacrm.usuario.dto.UsuarioRequest;
import com.novacrm.usuario.dto.UsuarioResponse;
import com.novacrm.usuario.dto.UsuarioUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/usuarios")
@Tag(name = "Usuarios", description = "Administracion de usuarios del sistema")
@PreAuthorize("hasRole('ADMIN')")
public class UsuarioAdminController {

    private final UsuarioAdminService usuarioAdminService;

    public UsuarioAdminController(UsuarioAdminService usuarioAdminService) {
        this.usuarioAdminService = usuarioAdminService;
    }

    @GetMapping
    @Operation(summary = "Listar usuarios")
    public List<UsuarioResponse> listar() {
        return usuarioAdminService.listar();
    }

    @PostMapping
    @Operation(summary = "Crear usuario")
    @ResponseStatus(HttpStatus.CREATED)
    public UsuarioResponse crear(@Valid @RequestBody UsuarioRequest request) {
        return usuarioAdminService.crear(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar usuario")
    public UsuarioResponse actualizar(@PathVariable UUID id,
                                      @Valid @RequestBody UsuarioUpdateRequest request) {
        return usuarioAdminService.actualizar(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Desactivar usuario (borrado logico)")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desactivar(@PathVariable UUID id) {
        usuarioAdminService.desactivar(id);
    }
}
