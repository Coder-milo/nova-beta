package com.novacrm.excel;

import com.novacrm.excel.dto.ImportPreviewResponse;
import com.novacrm.excel.dto.ImportacionHistorialResponse;
import com.novacrm.excel.dto.ResultadoImportacionCrm;
import com.novacrm.excel.dto.ResultadoImportacionLibro;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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
    private final ImportacionCrmService importacionCrmService;

    private final com.novacrm.excel.libro.ImportacionDeLibro importacionDeLibro;

    public ExcelController(ExcelService excelService,
                           ImportacionCrmService importacionCrmService,
                           com.novacrm.excel.libro.ImportacionDeLibro importacionDeLibro) {
        this.excelService = excelService;
        this.importacionCrmService = importacionCrmService;
        this.importacionDeLibro = importacionDeLibro;
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

    // ── Empresas y colocaciones ──────────────────────────────────────────────
    //
    // Van por su propia ruta y no por la de estudiantes porque la hoja, la
    // deduplicacion y las validaciones son otras. El parametro `simular` corre
    // la misma pasada sin escribir: es lo que alimenta la vista previa.

    // ── Libro completo ───────────────────────────────────────────────────────

    @PostMapping(value = "/libro", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Importar un libro de Excel con varias hojas (participantes, "
            + "empresas, postulaciones y colocaciones) en una sola subida")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResultadoImportacionLibro importarLibro(@RequestParam MultipartFile archivo,
                                                   @RequestParam(defaultValue = "false") boolean simular,
                                                   Authentication auth) {
        return importacionDeLibro.importar(archivo, simular,
                auth != null ? auth.getName() : "sistema");
    }

    @PostMapping(value = "/empresas", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Importar empresas desde Excel (.xlsx o .xls)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResultadoImportacionCrm importarEmpresas(@RequestParam MultipartFile archivo,
                                                    @RequestParam(defaultValue = "false") boolean simular) {
        return importacionCrmService.importarEmpresas(archivo, simular);
    }

    @PostMapping(value = "/colocaciones", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Importar colocaciones desde Excel (.xlsx o .xls)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResultadoImportacionCrm importarColocaciones(@RequestParam MultipartFile archivo,
                                                        @RequestParam(defaultValue = "false") boolean simular,
                                                        Authentication auth) {
        return importacionCrmService.importarColocaciones(archivo, simular,
                auth != null ? auth.getName() : "sistema");
    }
}
