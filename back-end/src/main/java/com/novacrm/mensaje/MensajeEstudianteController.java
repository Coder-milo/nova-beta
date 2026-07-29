package com.novacrm.mensaje;

import com.novacrm.mensaje.dto.MensajeRequest;
import com.novacrm.mensaje.dto.MensajeResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mensajes")
public class MensajeEstudianteController {
    private final MensajeEstudianteService service;

    public MensajeEstudianteController(MensajeEstudianteService service) { this.service = service; }

    @GetMapping("/mios")
    @PreAuthorize("hasRole('ESTUDIANTE')")
    public List<MensajeResponse> mios(Authentication auth) { return service.mios(auth); }

    @PostMapping("/mios")
    @PreAuthorize("hasRole('ESTUDIANTE')")
    public MensajeResponse crear(@Valid @RequestBody MensajeRequest request, Authentication auth) {
        return service.crear(request, auth);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public List<MensajeResponse> listarTodos() { return service.listarTodos(); }

    @PutMapping("/{id}/respuesta")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public MensajeResponse responder(@PathVariable UUID id,
                                     @RequestBody @Valid RespuestaRequest request,
                                     Authentication auth) {
        return service.responder(id, request.respuesta(), auth);
    }

    public record RespuestaRequest(@NotBlank @Size(max = 5000) String respuesta) { }
}
