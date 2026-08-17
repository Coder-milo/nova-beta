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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reportes")
@Tag(name = "Reportes", description = "Exportacion de reportes en Excel y PDF")
public class ReporteController {

    private static final Set<String> TIPOS_VALIDOS = Set.of("estudiantes", "empleabilidad",
        "academico", "proyectos", "perfiles-laborales", "panorama");

    private static final String XLSX_CONTENT_TYPE =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private final ReporteService reporteService;

    public ReporteController(ReporteService reporteService) {
        this.reporteService = reporteService;
    }

    /** El catalogo de columnas elegibles. Lo que no esta aqui no se puede pedir. */
    @GetMapping("/columnas")
    @Operation(summary = "Columnas disponibles para un informe a medida")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public java.util.List<ColumnaDisponible> columnas() {
        return java.util.Arrays.stream(ColumnaDeInforme.values())
                .map(c -> new ColumnaDisponible(c.name(), c.getEtiqueta(), c.esPersonal()))
                .toList();
    }

    /**
     * @param personal si identifica o permite contactar a la persona. No bloquea
     *                 nada —el equipo puede exportar su censo— pero la pantalla
     *                 lo avisa antes de que el archivo salga por correo
     */
    public record ColumnaDisponible(String id, String etiqueta, boolean personal) {}

    /**
     * Las ciudades escritas en las fichas, para que el filtro sea una lista y no
     * una caja de texto: la ciudad se compara por igualdad y entro del Excel
     * como texto libre.
     */
    @GetMapping("/ciudades")
    @Operation(summary = "Ciudades presentes en las fichas activas")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public java.util.List<String> ciudades() {
        return reporteService.ciudadesDisponibles();
    }

    public record InformeAMedida(java.util.List<String> columnas, UUID programaId,
                                 String ciudad, String estadoAcademico) {}

    /**
     * Informe con las columnas que se pidan, del catalogo cerrado.
     *
     * <p>Va por POST y no por GET porque la lista de columnas no cabe comoda en
     * una URL y porque un informe a medida no es cacheable: cambia con cada
     * combinacion.
     */
    @PostMapping("/personalizado/export")
    @Operation(summary = "Exportar un informe con las columnas elegidas")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResponseEntity<byte[]> exportarPersonalizado(@RequestParam String formato,
                                                        @RequestBody InformeAMedida cuerpo) {
        if (!"xlsx".equalsIgnoreCase(formato) && !"pdf".equalsIgnoreCase(formato)
                && !"csv".equalsIgnoreCase(formato)) {
            throw new BusinessException("Formato de exportacion no soportado: " + formato);
        }
        String f = formato.toLowerCase();
        byte[] contenido = reporteService.exportarPersonalizado(
                cuerpo.columnas(), f, cuerpo.programaId(), cuerpo.ciudad(), cuerpo.estadoAcademico());

        String contentType = "xlsx".equals(f) ? XLSX_CONTENT_TYPE
                : "csv".equals(f) ? "text/csv; charset=UTF-8" : "application/pdf";
        String filename = "informe-a-medida-"
                + java.time.LocalDate.now(java.time.ZoneId.of("America/Bogota")) + "." + f;
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(contenido);
    }

    @GetMapping("/{tipo}/export")
    @Operation(summary = "Exportar reporte en formato xlsx o pdf")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResponseEntity<byte[]> exportar(@PathVariable String tipo,
                                           @RequestParam String formato,
                                           @RequestParam(required = false) UUID programaId,
                                           @RequestParam(required = false) UUID vacanteId) {
        if (!TIPOS_VALIDOS.contains(tipo)) {
            throw new BusinessException("Tipo de reporte no valido: " + tipo);
        }
        if (!"xlsx".equalsIgnoreCase(formato) && !"pdf".equalsIgnoreCase(formato) && !"csv".equalsIgnoreCase(formato)) {
            throw new BusinessException("Formato de exportacion no soportado: " + formato);
        }

        String formatoNormalizado = formato.toLowerCase();
        byte[] contenido = reporteService.exportar(tipo, formatoNormalizado, programaId, vacanteId);

        String contentType = "xlsx".equals(formatoNormalizado)
            ? XLSX_CONTENT_TYPE
            : "csv".equals(formatoNormalizado)
                ? "text/csv; charset=UTF-8"
                : "application/pdf";
        // El nombre lleva la fecha: los reportes se guardan uno junto a otro en
        // la carpeta de descargas y "reporte-estudiantes.xlsx" se sobrescribia
        // con "(1)", "(2)" sin que nadie supiera cual era cual.
        String filename = "reporte-" + tipo + "-"
            + java.time.LocalDate.now(java.time.ZoneId.of("America/Bogota")) + "." + formatoNormalizado;

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.parseMediaType(contentType))
            .body(contenido);
    }
}
