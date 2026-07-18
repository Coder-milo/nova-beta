package com.novacrm.admin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Admin", description = "Operaciones administrativas masivas")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @DeleteMapping("/programas/{programaId}/estudiantes")
    @Operation(summary = "Soft delete masivo de estudiantes por programa")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> softDeleteEstudiantes(@PathVariable UUID programaId) {
        int afectados = adminService.softDeleteEstudiantesByPrograma(programaId);
        return Map.of("eliminados", afectados, "tipo", "soft-delete");
    }

    @DeleteMapping("/programas/{programaId}/reset")
    @Operation(summary = "Reset completo de un programa (elimina estudiantes y todas sus dependencias)")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> resetPrograma(@PathVariable UUID programaId) {
        int eliminados = adminService.resetPrograma(programaId);
        return Map.of("estudiantesEliminados", eliminados, "tipo", "hard-delete");
    }

    @DeleteMapping("/cleanup")
    @Operation(summary = "Vaciar todo el sistema transaccional (estudiantes, vacantes, matches, notificaciones)")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> cleanupSystem() {
        adminService.cleanupSystem();
        return Map.of("mensaje", "Sistema transaccional limpiado exitosamente");
    }

    @PostMapping("/programas/{programaId}/restaurar-estudiantes")
    @Operation(summary = "Restaurar todos los estudiantes de un programa desde la papelera")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> restaurarEstudiantes(@PathVariable UUID programaId) {
        int restaurados = adminService.restaurarEstudiantesByPrograma(programaId);
        return Map.of(
                "mensaje", "Estudiantes restaurados del programa " + programaId,
                "estudiantesRestaurados", restaurados
        );
    }

    @DeleteMapping("/purgar-papelera")
    @Operation(summary = "Eliminar físicamente estudiantes con más de 30 días en la papelera")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> purgarPapelera() {
        int eliminados = adminService.purgarPapelera();
        return Map.of("eliminados", eliminados, "tipo", "hard-delete", "retencion", "30 dias");
    }
}
