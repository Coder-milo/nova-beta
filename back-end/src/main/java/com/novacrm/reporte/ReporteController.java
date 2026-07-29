package com.novacrm.reporte;

import com.novacrm.exception.BusinessException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reportes")
@Tag(name = "Reportes", description = "Exportacion de reportes en Excel y PDF")
public class ReporteController {

    private static final Set<String> TIPOS_VALIDOS = Set.of("estudiantes", "empleabilidad", "academico", "proyectos");

    private static final String XLSX_CONTENT_TYPE =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private final ReporteService reporteService;

    public ReporteController(ReporteService reporteService) {
        this.reporteService = reporteService;
    }

    @GetMapping("/{tipo}/export")
    @Operation(summary = "Exportar reporte en formato xlsx o pdf")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResponseEntity<byte[]> exportar(@PathVariable String tipo,
                                           @RequestParam String formato,
                                           @RequestParam(required = false) UUID programaId) {
        if (!TIPOS_VALIDOS.contains(tipo)) {
            throw new BusinessException("Tipo de reporte no valido: " + tipo);
        }
        if (!"xlsx".equalsIgnoreCase(formato) && !"pdf".equalsIgnoreCase(formato)) {
            throw new BusinessException("Formato de exportacion no soportado: " + formato);
        }

        String formatoNormalizado = formato.toLowerCase();
        byte[] contenido = reporteService.exportar(tipo, formatoNormalizado, programaId);

        String contentType = "xlsx".equals(formatoNormalizado) ? XLSX_CONTENT_TYPE : "application/pdf";
        String filename = "reporte-" + tipo + "." + formatoNormalizado;

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.parseMediaType(contentType))
            .body(contenido);
    }
}
