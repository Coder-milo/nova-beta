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

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/matches")
@Tag(name = "Matches", description = "Resultados del matching")
public class MatchController {

    private final MatchingService matchingService;
    private final OwnershipService ownershipService;
    private final MatchRepository matchRepository;

    public MatchController(MatchingService matchingService,
                           OwnershipService ownershipService,
                           MatchRepository matchRepository) {
        this.matchingService = matchingService;
        this.ownershipService = ownershipService;
        this.matchRepository = matchRepository;
    }

    @GetMapping("/mis-matches")
    @Operation(summary = "Obtener vacantes matcheadas del estudiante autenticado")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public Page<MatchResponse> obtenerMisMatches(
            @PageableDefault(size = 20, sort = "puntaje", direction = Sort.Direction.DESC) Pageable pageable,
            Authentication auth) {
        var est = ownershipService.obtenerEstudianteAutenticado(auth);
        return matchingService.obtenerMatches(est.getId(), pageable);
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

    /**
     * Marca un match como postulado y abre su postulacion.
     *
     * <p>Postularse desde aqui y anotar una postulacion a mano acaban en la
     * misma tabla, asi que a partir de este momento el proceso se puede seguir
     * —entrevista, respuesta, resultado— desde la cuenta del participante.
     */
    @PatchMapping("/{matchId}/postular")
    @Operation(summary = "Marcar un match como postulado y abrir su seguimiento")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public void marcarPostulado(@PathVariable UUID matchId, Authentication auth) {
        var match = matchRepository.findById(matchId)
                .orElseThrow(() -> new com.novacrm.exception.ResourceNotFoundException("Match no encontrado: " + matchId));
        ownershipService.verificarAccesoEstudiante(auth, match.getEstudiante().getId());
        boolean esElPropioEstudiante = auth.getAuthorities().stream()
                .noneMatch(a -> a.getAuthority().equals("ROLE_ADMIN")
                        || a.getAuthority().equals("ROLE_COORDINADOR"));
        matchingService.marcarPostulado(matchId, auth.getName(), esElPropioEstudiante);
    }

    @PatchMapping("/{matchId}/cancelar-postulacion")
    @Operation(summary = "Revertir o cancelar postulación de un match")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public void cancelarPostulacion(@PathVariable UUID matchId, Authentication auth) {
        var match = matchRepository.findById(matchId)
                .orElseThrow(() -> new com.novacrm.exception.ResourceNotFoundException("Match no encontrado: " + matchId));
        ownershipService.verificarAccesoEstudiante(auth, match.getEstudiante().getId());
        matchingService.cancelarPostulacion(matchId, auth.getName());
    }

    @PostMapping("/ejecutar")
    @Operation(summary = "Ejecutar matching bajo demanda")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Map<String, Object> ejecutarMatching() {
        int creados = matchingService.ejecutarMatching();
        return Map.of("matchesCreados", creados);
    }

    @DeleteMapping("/{matchId}")
    @Operation(summary = "Descartar un match")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public void descartarMatch(@PathVariable UUID matchId, Authentication auth) {
        var match = matchRepository.findById(matchId)
                .orElseThrow(() -> new com.novacrm.exception.ResourceNotFoundException("Match no encontrado: " + matchId));
        ownershipService.verificarAccesoEstudiante(auth, match.getEstudiante().getId());
        matchingService.descartarMatch(matchId, auth.getName());
    }
}
