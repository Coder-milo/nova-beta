package com.novacrm.ia;

import com.novacrm.ia.dto.ConsultaAsistenteDto;
import com.novacrm.ia.dto.RespuestaAsistenteDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/ia")
@Tag(name = "Asistente IA", description = "Endpoints de asistencia e inteligencia artificial para la plataforma")
public class AsistenteIaController {

    private final AsistenteIaService asistenteIaService;

    @Autowired
    public AsistenteIaController(AsistenteIaService asistenteIaService) {
        this.asistenteIaService = asistenteIaService;
    }

    @PostMapping("/asistente-admin")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    @Operation(summary = "Asistente virtual de navegación y consultas para Administradores",
            description = "Responde preguntas sobre el funcionamiento del sitio y genera acciones de navegación directa.")
    public ResponseEntity<RespuestaAsistenteDto> consultarAsistenteAdmin(
            @Valid @RequestBody ConsultaAsistenteDto consulta) {
        RespuestaAsistenteDto respuesta = asistenteIaService.procesarConsulta(consulta);
        return ResponseEntity.ok(respuesta);
    }

    @PostMapping("/asistente-estudiante")
    @PreAuthorize("hasRole('ESTUDIANTE')")
    @Operation(summary = "Asistente virtual seguro para estudiantes",
            description = "Orienta sobre empleabilidad y el portal del estudiante sin exponer funciones administrativas.")
    public ResponseEntity<RespuestaAsistenteDto> consultarAsistenteEstudiante(
            @Valid @RequestBody ConsultaAsistenteDto consulta) {
        return ResponseEntity.ok(asistenteIaService.procesarConsultaEstudiante(consulta));
    }
}
