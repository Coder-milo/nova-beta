package com.novacrm.certificacion;

import com.novacrm.certificacion.dto.CertificacionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/certificaciones")
@Tag(name = "Certificaciones", description = "Certificaciones digitales")
public class CertificacionController {

    private final CertificacionService certificacionService;

    public CertificacionController(CertificacionService certificacionService) {
        this.certificacionService = certificacionService;
    }

    @GetMapping
    @Operation(summary = "Listar certificaciones por programa")
    public List<CertificacionResponse> listar(@RequestParam UUID programaId) {
        return certificacionService.listarPorPrograma(programaId);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener certificacion por ID")
    public CertificacionResponse obtener(@PathVariable UUID id) {
        return certificacionService.obtener(id);
    }
}
