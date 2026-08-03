package com.novacrm.auditoria;

import com.novacrm.auditoria.dto.AuditoriaResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auditoria")
@Tag(name = "Auditoría", description = "Registro de auditoría del sistema")
public class AuditoriaController {

    private final AuditoriaService auditoriaService;

    public AuditoriaController(AuditoriaService auditoriaService) {
        this.auditoriaService = auditoriaService;
    }

    @GetMapping
    @Operation(summary = "Buscar registros de auditoría")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Page<AuditoriaResponse> buscar(
            @RequestParam(required = false) String usuario,
            @RequestParam(required = false) String modulo,
            @RequestParam(required = false) String accion,
            @RequestParam(required = false) String registroId,
            @PageableDefault(size = 20, sort = "fecha", direction = Sort.Direction.DESC) Pageable pageable) {
        return auditoriaService.buscar(usuario, modulo, accion, registroId, pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener registro de auditoría por ID")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public AuditoriaResponse obtener(@PathVariable UUID id) {
        return auditoriaService.obtener(id);
    }
}
