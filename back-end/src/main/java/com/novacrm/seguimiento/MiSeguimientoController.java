package com.novacrm.seguimiento;
import com.novacrm.seguimiento.dto.SeguimientoDelEstudianteResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @RequestMapping("/api/v1/seguimientos")
public class MiSeguimientoController {
 private final SeguimientoService service;
 public MiSeguimientoController(SeguimientoService service){this.service=service;}
 @GetMapping("/mio") @PreAuthorize("hasRole('ESTUDIANTE')")
 public List<SeguimientoDelEstudianteResponse> mio(Authentication auth){return service.listarPorEmail(auth.getName());}
}
