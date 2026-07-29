package com.novacrm.excel;

import com.novacrm.excel.dto.ImportPreviewResponse;
import com.novacrm.excel.dto.ImportacionHistorialResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/importar")
@Tag(name = "Importacion Excel", description = "Importacion masiva de estudiantes desde Excel")
public class ExcelController {

    private final ExcelService excelService;

    public ExcelController(ExcelService excelService) {
        this.excelService = excelService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Importar estudiantes desde archivo Excel")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Map<String, Object> importar(@RequestParam MultipartFile archivo,
                                         @RequestParam UUID programaId) {
        return excelService.importar(archivo, programaId);
    }

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Previsualizar importacion de estudiantes sin persistir cambios")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ImportPreviewResponse preview(@RequestParam MultipartFile archivo,
                                         @RequestParam UUID programaId) {
        return excelService.previewImport(archivo, programaId);
    }

    @GetMapping("/historial")
    @Operation(summary = "Historial de las ultimas 20 importaciones")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<ImportacionHistorialResponse> historial() {
        return excelService.obtenerHistorial();
    }
}
