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
        // Autoedicion, no edicion completa: el DTO es el mismo que usa la
        // gestion, y aplicarlo entero dejaba que cada quien se pusiera su propio
        // nivel de ingles medido y su estado de empleabilidad.
        return estudianteService.actualizarMiPerfil(est.getId(), request);
    }

    @GetMapping("/mi-perfil/hv-vista-previa")
    @Operation(summary = "Previsualizar la Hoja de Vida del estudiante autenticado sin registrar version")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public org.springframework.http.ResponseEntity<byte[]> vistaPreviaMiHv(
            @RequestParam(required = false, defaultValue = "es") String idioma,
            @RequestParam(required = false) UUID plantillaId,
            Authentication auth) {
        var estEntity = ownershipService.obtenerEstudianteAutenticado(auth);
        byte[] pdfBytes = hvService.vistaPreviaDeEstudiante(estEntity.getId(),
                new com.novacrm.hv.dto.GenerarHvOpcionesRequest(plantillaId, idioma, null, null));
        // `inline`, para que el visor lo pinte en el iframe en vez de
        // descargarlo: previsualizar es mirar, no guardar.
        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"vista-previa-hv.pdf\"")
                .contentType(org.springframework.http.MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    @GetMapping("/mi-perfil/hv-pdf")
    @Operation(summary = "Descargar Hoja de Vida CAC ATS oficial del estudiante autenticado")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public org.springframework.http.ResponseEntity<byte[]> descargarMiHvPdf(
            @RequestParam(required = false, defaultValue = "es") String idioma,
            @RequestParam(required = false) UUID plantillaId,
            Authentication auth) {
        var estEntity = ownershipService.obtenerEstudianteAutenticado(auth);
        var hv = hvService.generarIndividual(estEntity.getId(),
                new com.novacrm.hv.dto.GenerarHvOpcionesRequest(plantillaId, idioma, null, null));
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

    @PostMapping(value = "/mi-perfil/foto", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Subir o reemplazar la fotografía del estudiante autenticado")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public EstudianteResponse subirMiFoto(@RequestParam("archivo") org.springframework.web.multipart.MultipartFile archivo,
                                          Authentication auth) {
        var est = ownershipService.obtenerEstudianteAutenticado(auth);
        return subirFotoInterno(est.getId(), archivo);
    }

    @GetMapping("/mi-perfil/foto")
    @Operation(summary = "Obtener la fotografía del estudiante autenticado")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public org.springframework.http.ResponseEntity<byte[]> miFoto(Authentication auth) {
        var est = ownershipService.obtenerEstudianteAutenticado(auth);
        return descargarFotoInterno(est.getId());
    }

    @PostMapping(value = "/{id}/foto", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Subir o reemplazar la fotografía del estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public EstudianteResponse subirFoto(@PathVariable UUID id,
                                        @RequestParam("archivo") org.springframework.web.multipart.MultipartFile archivo,
                                        Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, id);
        return subirFotoInterno(id, archivo);
    }

    @GetMapping("/{id}/foto")
    @Operation(summary = "Descargar la fotografía del estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public org.springframework.http.ResponseEntity<byte[]> foto(@PathVariable UUID id, Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, id);
        return descargarFotoInterno(id);
    }

    @DeleteMapping("/mi-perfil/foto")
    @Operation(summary = "Eliminar la fotografía del estudiante autenticado")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public EstudianteResponse eliminarMiFoto(Authentication auth) {
        var est = ownershipService.obtenerEstudianteAutenticado(auth);
        return estudianteService.eliminarFoto(est.getId());
    }

    @DeleteMapping("/{id}/foto")
    @Operation(summary = "Eliminar la fotografía del estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public EstudianteResponse eliminarFoto(@PathVariable UUID id, Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, id);
        return estudianteService.eliminarFoto(id);
    }

    @PutMapping("/mi-perfil/plantilla-preferida")
    @Operation(summary = "Guardar la plantilla preferida de Hoja de Vida del estudiante autenticado")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public EstudianteResponse guardarPlantillaPreferida(@RequestBody GuardarPlantillaPreferidaRequest request, Authentication auth) {
        var est = ownershipService.obtenerEstudianteAutenticado(auth);
        return estudianteService.actualizarPlantillaPreferida(est.getId(), request.plantillaId());
    }

    public record GuardarPlantillaPreferidaRequest(UUID plantillaId) {}

    private EstudianteResponse subirFotoInterno(UUID id, org.springframework.web.multipart.MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()
                || archivo.getContentType() == null || !archivo.getContentType().startsWith("image/")) {
            throw new com.novacrm.exception.BusinessException("Sube una imagen válida (JPG/PNG/WebP)");
        }
        try {
            byte[] bytesProcesados = redimensionarImagen(archivo.getBytes(), archivo.getContentType());
            // El nombre pierde la extensión original a propósito: el contenido
            // sale siempre como JPEG del reescalado, y conservar un ".png" en la
            // clave hacía que la descarga respondiera `Content-Type: image/png`
            // con bytes JPEG. Con `nosniff` puesto, el navegador no lo corrige y
            // la foto no se ve.
            String key = storageService.subir("fotos", nombreJpg(archivo.getOriginalFilename()),
                    bytesProcesados, "image/jpeg");
            return estudianteService.actualizarFoto(id, key);
        } catch (java.io.IOException e) {
            throw new com.novacrm.exception.BusinessException("No se pudo leer la imagen: " + e.getMessage());
        }
    }

    /** El nombre original con extensión `.jpg`, que es lo que de verdad se guarda. */
    private static String nombreJpg(String original) {
        String base = original == null || original.isBlank() ? "foto" : original;
        int punto = base.lastIndexOf('.');
        if (punto > 0) base = base.substring(0, punto);
        return base + ".jpg";
    }

    private byte[] redimensionarImagen(byte[] bytesOriginales, String contentType) {
        try {
            java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(bytesOriginales);
            java.awt.image.BufferedImage img = javax.imageio.ImageIO.read(bais);
            if (img == null) return bytesOriginales;

            int w = img.getWidth();
            int h = img.getHeight();
            int minSquare = Math.min(w, h);
            int cropX = (w - minSquare) / 2;
            int cropY = (h - minSquare) / 2;

            java.awt.image.BufferedImage cropped = img.getSubimage(cropX, cropY, minSquare, minSquare);
            int targetSize = Math.min(minSquare, 250);

            java.awt.image.BufferedImage resized = new java.awt.image.BufferedImage(targetSize, targetSize, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = resized.createGraphics();
            g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(cropped, 0, 0, targetSize, targetSize, null);
            g.dispose();

            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(resized, "jpg", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            return bytesOriginales;
        }
    }

    private org.springframework.http.ResponseEntity<byte[]> descargarFotoInterno(UUID id) {
        var est = estudianteService.obtener(id);
        if (est.fotoUrl() == null) {
            return org.springframework.http.ResponseEntity.notFound().build();
        }
        org.springframework.http.MediaType mediaType = org.springframework.http.MediaType.IMAGE_JPEG;
        String keyLower = est.fotoUrl().toLowerCase();
        if (keyLower.endsWith(".png")) {
            mediaType = org.springframework.http.MediaType.IMAGE_PNG;
        } else if (keyLower.endsWith(".webp")) {
            mediaType = org.springframework.http.MediaType.parseMediaType("image/webp");
        } else if (keyLower.endsWith(".gif")) {
            mediaType = org.springframework.http.MediaType.IMAGE_GIF;
        }
        return org.springframework.http.ResponseEntity.ok()
                .contentType(mediaType)
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

    /**
     * Edicion completa de una ficha. Solo gestion.
     *
     * <p>Admitia tambien al rol ESTUDIANTE con la comprobacion de que la ficha
     * fuera la suya, y eso volvia inutil la lista blanca de {@code /mi-perfil}:
     * bastaba con llamar aqui con el propio identificador para escribir la
     * ficha entera, incluidos el nivel de ingles medido y el estado de
     * empleabilidad. El portal nunca uso esta ruta —su formulario va por
     * {@code /mi-perfil}—, asi que cerrarla no le quita nada al estudiante.
     */
    @PutMapping("/{id}")
    @Operation(summary = "Actualizar estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public EstudianteResponse actualizar(@PathVariable UUID id, @Valid @RequestBody EstudianteRequest request) {
        return estudianteService.actualizar(id, request);
    }

    /**
     * Mueve solo los hitos de preparacion.
     *
     * <p>Aparte del PUT completo porque es lo que el equipo toca a diario:
     * mandar la ficha entera para marcar una casilla arriesga pisar el resto
     * con lo que tuviera cargado el formulario. Sin rol de estudiante: los
     * hitos los verifica el programa, no el participante.
     */
    @PatchMapping("/{id}/preparacion")
    @Operation(summary = "Actualizar los hitos de preparacion de un participante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public EstudianteResponse actualizarPreparacion(
            @PathVariable UUID id,
            @RequestBody EstudianteService.PreparacionRequest cambios) {
        return estudianteService.actualizarPreparacion(id, cambios);
    }

    /**
     * Marca el mismo hito en varias fichas de una vez.
     *
     * <p>Poner al dia 107 participantes de uno en uno es lo que hace que el
     * equipo vuelva a la hoja de calculo.
     */
    @PatchMapping("/preparacion-masiva")
    @Operation(summary = "Marcar un hito en varios participantes")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public java.util.Map<String, Object> actualizarPreparacionMasiva(
            @RequestBody PreparacionMasivaRequest request) {
        int total = estudianteService.actualizarPreparacionMasiva(
                request.ids(), request.hito(), request.valor());
        return java.util.Map.of("actualizados", total);
    }

    /** Un solo hito por llamada: en bloque, varios a la vez casi siempre es un error. */
    public record PreparacionMasivaRequest(
            java.util.List<UUID> ids,
            String hito,
            EstadoHito valor) {}

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
    public void eliminarMasivo(@RequestBody BulkDeleteRequest request, Authentication auth) {
        if (request.permanente()) {
            boolean esAdmin = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
            if (!esAdmin) {
                throw new org.springframework.security.access.AccessDeniedException(
                        "Solo ADMIN puede eliminar estudiantes de forma permanente");
            }
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
