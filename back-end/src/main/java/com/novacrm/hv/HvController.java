package com.novacrm.hv;

import com.novacrm.auth.OwnershipService;
import com.novacrm.hv.dto.*;
import com.novacrm.hv.dto.AnalisisCompletitudResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/hojas-de-vida")
@Tag(name = "Hojas de vida", description = "Plantillas, generación y extracción de hojas de vida")
public class HvController {

    private final HvService hvService;
    private final ExtraccionHvService extraccionService;
    private final HvPdfService pdfService;
    private final OwnershipService ownershipService;

    public HvController(HvService hvService, ExtraccionHvService extraccionService,
                        HvPdfService pdfService, OwnershipService ownershipService) {
        this.hvService = hvService;
        this.extraccionService = extraccionService;
        this.pdfService = pdfService;
        this.ownershipService = ownershipService;
    }

    // ── Plantillas ───────────────────────────────────────────────────────────

    @GetMapping("/plantillas")
    @Operation(summary = "Listar plantillas activas")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public List<PlantillaResponse> plantillas() {
        return hvService.listarPlantillas();
    }

    @PostMapping(value = "/plantillas", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Crear plantilla combinable desde Word o PDF")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public PlantillaResponse crearPlantilla(@RequestParam String nombre,
                                            @RequestParam(required = false) String colorPrimario,
                                            @RequestParam(required = false) MultipartFile archivo) {
        return hvService.crearPlantilla(nombre, colorPrimario, archivo);
    }

    @GetMapping("/plantillas/{id}/vista-previa")
    @Operation(summary = "Vista previa PDF de una plantilla con datos de ejemplo")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public ResponseEntity<byte[]> vistaPrevia(@PathVariable UUID id) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"vista-previa-plantilla.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(hvService.vistaPreviaPlantilla(id));
    }

    @PatchMapping("/plantillas/{id}/predeterminada")
    @Operation(summary = "Marcar plantilla como predeterminada")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public PlantillaResponse predeterminada(@PathVariable UUID id) {
        return hvService.marcarPredeterminada(id);
    }

    @DeleteMapping("/plantillas/{id}")
    @Operation(summary = "Eliminar plantilla (soft)")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public void eliminarPlantilla(@PathVariable UUID id) {
        hvService.eliminarPlantilla(id);
    }

    // ── Generación ───────────────────────────────────────────────────────────

    @PostMapping("/generar/{estudianteId}")
    @Operation(summary = "Generar hoja de vida de un estudiante")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public HojaDeVidaResponse generar(@PathVariable UUID estudianteId,
                                      @RequestParam(required = false) UUID plantillaId,
                                      @RequestBody(required = false) GenerarHvOpcionesRequest request,
                                      Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        if (request != null) {
            UUID pid = request.plantillaId() != null ? request.plantillaId() : plantillaId;
            var reqFinal = new GenerarHvOpcionesRequest(pid, request.idioma(), request.seccionesExcluidas(), request.camposExcluidos());
            return hvService.generarIndividual(estudianteId, reqFinal);
        }
        return hvService.generarIndividual(estudianteId, plantillaId);
    }

    @PostMapping("/generar-masiva")
    @Operation(summary = "Generar hojas de vida masivamente (por programa o lista de estudiantes)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public GeneracionMasivaResponse generarMasiva(@RequestBody GeneracionMasivaRequest request) {
        return hvService.generarMasiva(request);
    }

    // ── Consulta y descarga ──────────────────────────────────────────────────

    @GetMapping("/estudiante/{estudianteId}")
    @Operation(summary = "Versiones de la hoja de vida de un estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public List<HojaDeVidaResponse> deEstudiante(@PathVariable UUID estudianteId, Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return hvService.versionesDeEstudiante(estudianteId);
    }

    @GetMapping("/vista-previa/{estudianteId}")
    @Operation(summary = "Previsualizar la hoja de vida de un estudiante sin registrar una versión nueva")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public ResponseEntity<byte[]> vistaPreviaEstudiante(@PathVariable UUID estudianteId,
                                                        @RequestParam(required = false) UUID plantillaId,
                                                        @RequestParam(required = false, defaultValue = "es") String idioma,
                                                        Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"vista-previa-hv.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(hvService.vistaPreviaDeEstudiante(estudianteId,
                        new GenerarHvOpcionesRequest(plantillaId, idioma, null, null)));
    }

    @GetMapping("/{id}/pdf")
    @Operation(summary = "Descargar el PDF de una hoja de vida")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public ResponseEntity<byte[]> pdf(@PathVariable UUID id, Authentication auth) {
        var hv = hvService.obtener(id);
        ownershipService.verificarAccesoEstudiante(auth, hv.getEstudiante().getId());
        String nombre = "HV-" + hv.getEstudiante().getNombre() + "-" + hv.getEstudiante().getApellido()
                + "-v" + hv.getNumeroVersion() + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        com.novacrm.shared.NombreDeDescarga.adjunto(nombre))
                .contentType(MediaType.APPLICATION_PDF)
                .body(hvService.pdf(id));
    }

    @PatchMapping("/{id}/actual")
    @Operation(summary = "Marcar una versión como la vigente")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public HojaDeVidaResponse marcarActual(@PathVariable UUID id, Authentication auth) {
        var hv = hvService.obtener(id);
        ownershipService.verificarAccesoEstudiante(auth, hv.getEstudiante().getId());
        return hvService.marcarActual(id);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar una versión de hoja de vida")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public void eliminar(@PathVariable UUID id, Authentication auth) {
        var hv = hvService.obtener(id);
        ownershipService.verificarAccesoEstudiante(auth, hv.getEstudiante().getId());
        hvService.eliminarHojaDeVida(id);
    }

    @PostMapping("/descargar-zip")
    @Operation(summary = "Descargar en ZIP las HVs vigentes de varios estudiantes")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResponseEntity<byte[]> zip(@RequestBody List<UUID> estudianteIds) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"hojas-de-vida.zip\"")
                .contentType(MediaType.parseMediaType("application/zip"))
                .body(hvService.zipDeEstudiantes(estudianteIds));
    }

    // ── Análisis de completitud ──────────────────────────────────────────────

    @GetMapping("/analizar/{estudianteId}")
    @Operation(summary = "Analizar completitud del perfil para la plantilla CAC ATS")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public AnalisisCompletitudResponse analizar(@PathVariable UUID estudianteId, Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return hvService.analizarCompletitud(estudianteId);
    }

    // ── Extracción y Conversión a Plantilla CAC ──────────────────────────────

    @PostMapping(value = "/extraer", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Extraer campos de una hoja de vida en PDF (con confianza y DTO estructurado)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ExtraccionResponse extraer(@RequestParam("archivo") MultipartFile archivo) {
        return aRespuesta(extraccionService.extraer(archivo));
    }

    /**
     * Escanea la hoja de vida que el propio estudiante ya tenía hecha.
     *
     * <p>El portal solo dejaba llenar la hoja de vida campo por campo. Quien
     * llega con un PDF suyo —que es casi todo el mundo— tenía que volver a
     * teclearlo entero, así que la mitad de las fichas se quedaban a medias y
     * el PDF de la plantilla CAC salía con secciones vacías.
     *
     * <p>No toca la base: devuelve lo leído para que el estudiante lo revise y
     * decida qué se queda. Por eso no hay comprobación de propiedad —el archivo
     * lo aporta quien llama— y por eso el rol ESTUDIANTE sí entra aquí, a
     * diferencia de {@link #extraer}, que es la herramienta del equipo para
     * cargar hojas de vida de terceros.
     */
    @PostMapping(value = "/mi-extraccion", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Escanear la propia hoja de vida en PDF y devolver los campos detectados")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public ExtraccionResponse extraerMia(@RequestParam("archivo") MultipartFile archivo) {
        return aRespuesta(extraccionService.extraer(archivo));
    }

    private ExtraccionResponse aRespuesta(ExtraccionHvService.ResultadoExtraccion resultado) {
        return new ExtraccionResponse(
                resultado.campos().stream()
                        .map(c -> new CampoExtraidoDto(c.campo(), c.valor(), c.confianza()))
                        .toList(),
                resultado.textoCompleto(),
                resultado.datosEstructurados());
    }

    @PostMapping("/convertir-pdf")
    @Operation(summary = "Generar PDF en formato CAC ATS directamente desde DatosHvDto sin guardar estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public ResponseEntity<byte[]> convertirPdf(@RequestBody ConvertirHvRequest request) {
        var datos = request.datos();
        String idioma = request.idioma() != null ? request.idioma() : "es";
        byte[] pdfBytes = pdfService.generar(datos, "#1C315E", idioma, request.seccionesExcluidas(), request.camposExcluidos());

        String nombreNombre = datos != null && datos.nombre() != null ? datos.nombre() : "Candidato";
        String nombreArchivo = "HV-CAC-" + nombreNombre + ".pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        com.novacrm.shared.NombreDeDescarga.adjunto(nombreArchivo))
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }
}
