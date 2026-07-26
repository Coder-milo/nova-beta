package com.novacrm.estudiante;

import com.novacrm.estudiante.dto.EstudianteRequest;
import com.novacrm.estudiante.dto.EstudianteResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/estudiantes")
@Tag(name = "Estudiantes", description = "Gestión de estudiantes")
public class EstudianteController {

    private final EstudianteService estudianteService;
    private final com.novacrm.auth.OwnershipService ownershipService;
    private final com.novacrm.documento.StorageService storageService;
    private final com.novacrm.hv.HvService hvService;

    public EstudianteController(EstudianteService estudianteService,
                                com.novacrm.auth.OwnershipService ownershipService,
                                com.novacrm.documento.StorageService storageService,
                                com.novacrm.hv.HvService hvService) {
        this.estudianteService = estudianteService;
        this.ownershipService = ownershipService;
        this.storageService = storageService;
        this.hvService = hvService;
    }

    @GetMapping("/mi-perfil")
    @Operation(summary = "Obtener el perfil del estudiante autenticado")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public EstudianteResponse obtenerMiPerfil(Authentication auth) {
        var est = ownershipService.obtenerEstudianteAutenticado(auth);
        return estudianteService.obtener(est.getId());
    }

    @PutMapping("/mi-perfil")
    @Operation(summary = "Actualizar el perfil del estudiante autenticado")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public EstudianteResponse actualizarMiPerfil(@Valid @RequestBody EstudianteRequest request, Authentication auth) {
        var est = ownershipService.obtenerEstudianteAutenticado(auth);
        return estudianteService.actualizar(est.getId(), request);
    }

    @GetMapping("/mi-perfil/hv-pdf")
    @Operation(summary = "Descargar Hoja de Vida CAC ATS oficial del estudiante autenticado")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public org.springframework.http.ResponseEntity<byte[]> descargarMiHvPdf(
            @RequestParam(required = false, defaultValue = "es") String idioma,
            Authentication auth) {
        var estEntity = ownershipService.obtenerEstudianteAutenticado(auth);
        var hv = hvService.generarIndividual(estEntity.getId(),
                new com.novacrm.hv.dto.GenerarHvOpcionesRequest(null, idioma, null, null));
        byte[] pdfBytes = hvService.pdf(hv.id());

        String filename = ("HV-CAC-" + estEntity.getNombre() + "-" + estEntity.getApellido() + ".pdf")
                .replaceAll("[^a-zA-Z0-9.\\-]", "_");

        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(org.springframework.http.MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    @GetMapping
    @Operation(summary = "Listar estudiantes por programa (paginado)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Page<EstudianteResponse> listar(
            @RequestParam UUID programaId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return estudianteService.listarPorPrograma(programaId, pageable);
    }

    @GetMapping("/incompletos")
    @Operation(summary = "Listar estudiantes activos con datos clave incompletos")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Page<EstudianteResponse> incompletos(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return estudianteService.listarConDatosFaltantes(pageable);
    }

    @GetMapping("/buscar")
    @Operation(summary = "Búsqueda avanzada sin exigir programa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Page<EstudianteResponse> buscarAvanzado(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UUID programaId,
            @RequestParam(required = false) String ciudad,
            @RequestParam(required = false) EstadoAcademico estadoAcademico,
            @RequestParam(required = false) EstadoEmpleabilidad estadoEmpleabilidad,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return estudianteService.buscarAvanzado(q, programaId, ciudad, estadoAcademico, estadoEmpleabilidad, pageable);
    }

    @PatchMapping("/{id}/programa")
    @Operation(summary = "Vincular el estudiante a otro programa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public EstudianteResponse vincularPrograma(@PathVariable UUID id,
                                               @RequestBody VincularProgramaRequest request) {
        return estudianteService.vincularPrograma(id, request.programaId());
    }

    public record VincularProgramaRequest(UUID programaId) {}

    @PostMapping(value = "/{id}/foto", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Subir o reemplazar la fotografía del estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public EstudianteResponse subirFoto(@PathVariable UUID id,
                                        @RequestParam("archivo") org.springframework.web.multipart.MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()
                || archivo.getContentType() == null || !archivo.getContentType().startsWith("image/")) {
            throw new com.novacrm.exception.BusinessException("Sube una imagen válida (JPG/PNG/WebP)");
        }
        try {
            String key = storageService.subir("fotos", archivo.getOriginalFilename(),
                    archivo.getBytes(), archivo.getContentType());
            return estudianteService.actualizarFoto(id, key);
        } catch (java.io.IOException e) {
            throw new com.novacrm.exception.BusinessException("No se pudo leer la imagen: " + e.getMessage());
        }
    }

    @GetMapping("/{id}/foto")
    @Operation(summary = "Descargar la fotografía del estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public org.springframework.http.ResponseEntity<byte[]> foto(@PathVariable UUID id) {
        var est = estudianteService.obtener(id);
        if (est.fotoUrl() == null) {
            return org.springframework.http.ResponseEntity.notFound().build();
        }
        return org.springframework.http.ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.IMAGE_JPEG)
                .body(storageService.descargar(est.fotoUrl()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener estudiante por ID")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public EstudianteResponse obtener(@PathVariable UUID id) {
        return estudianteService.obtener(id);
    }

    @PostMapping
    @Operation(summary = "Crear estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public EstudianteResponse crear(@Valid @RequestBody EstudianteRequest request) {
        return estudianteService.crear(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public EstudianteResponse actualizar(@PathVariable UUID id, @Valid @RequestBody EstudianteRequest request,
                                          Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, id);
        return estudianteService.actualizar(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar (soft delete) estudiante → va a la papelera")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable UUID id) {
        estudianteService.softDelete(id);
    }

    @PostMapping("/bulk-delete")
    @Operation(summary = "Eliminación masiva de estudiantes (soft o hard delete)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminarMasivo(@RequestBody BulkDeleteRequest request) {
        if (request.permanente()) {
            estudianteService.hardDeleteMasivo(request.ids());
        } else {
            estudianteService.softDeleteMasivo(request.ids());
        }
    }

    public record BulkDeleteRequest(java.util.List<UUID> ids, boolean permanente) {}

    // --- Papelera ---

    @GetMapping("/papelera")
    @Operation(summary = "Listar estudiantes en la papelera (inactivos) por programa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Page<EstudianteResponse> listarPapelera(
            @RequestParam UUID programaId,
            @PageableDefault(size = 20, sort = "deletedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return estudianteService.listarPapelera(programaId, pageable);
    }

    @PostMapping("/{id}/restaurar")
    @Operation(summary = "Restaurar estudiante de la papelera")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public EstudianteResponse restaurar(@PathVariable UUID id) {
        return estudianteService.restaurar(id);
    }
}
