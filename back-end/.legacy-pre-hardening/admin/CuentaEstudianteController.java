package com.novacrm.admin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/cuentas-estudiante")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Administración", description = "Cuentas de acceso de estudiantes")
public class CuentaEstudianteController {

    private final CuentaEstudianteService cuentaEstudianteService;

    public CuentaEstudianteController(CuentaEstudianteService cuentaEstudianteService) {
        this.cuentaEstudianteService = cuentaEstudianteService;
    }

    @GetMapping
    @Operation(summary = "Listar estudiantes y el estado de sus cuentas")
    public CuentaEstudianteService.PadronResponse padron() {
        return cuentaEstudianteService.padron();
    }

    @PostMapping
    @Operation(summary = "Simular o crear las cuentas de acceso que faltan")
    public CuentaEstudianteService.ResumenAltaResponse crear(
            @RequestBody CuentaEstudianteService.CrearCuentasRequest request) {
        return cuentaEstudianteService.crear(request);
    }
}
