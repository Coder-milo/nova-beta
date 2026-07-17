package com.novacrm.matching;

import com.novacrm.auth.OwnershipService;
import com.novacrm.matching.dto.MatchResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/matches")
@Tag(name = "Matches", description = "Resultados del matching")
public class MatchController {

    private final MatchingService matchingService;
    private final OwnershipService ownershipService;

    public MatchController(MatchingService matchingService, OwnershipService ownershipService) {
        this.matchingService = matchingService;
        this.ownershipService = ownershipService;
    }

    @GetMapping
    @Operation(summary = "Obtener matches de un estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public Page<MatchResponse> obtenerMatches(@RequestParam UUID estudianteId,
                                       @PageableDefault(size = 20, sort = "puntaje", direction = Sort.Direction.DESC) Pageable pageable,
                                       Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return matchingService.obtenerMatches(estudianteId, pageable);
    }

    @GetMapping("/pendientes")
    @Operation(summary = "Contar matches pendientes de notificar")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public long contarPendientes(@RequestParam UUID estudianteId, Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return matchingService.contarMatchesPendientes(estudianteId);
    }
}
