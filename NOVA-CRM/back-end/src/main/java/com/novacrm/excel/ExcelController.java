package com.novacrm.excel;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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
}
