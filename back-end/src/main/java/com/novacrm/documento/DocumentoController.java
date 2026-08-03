package com.novacrm.documento;

import com.novacrm.documento.dto.DocumentoResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
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
@RequestMapping("/api/v1/documentos")
@Tag(name = "Documentos", description = "Gestión de documentos con versiones (MinIO)")
public class DocumentoController {

    private final DocumentoService documentoService;

    public DocumentoController(DocumentoService documentoService) {
        this.documentoService = documentoService;
    }

    @GetMapping
    @Operation(summary = "Buscar documentos (versión vigente) con filtros")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Page<DocumentoResponse> buscar(@RequestParam(required = false) UUID estudianteId,
                                          @RequestParam(required = false) UUID programaId,
                                          @RequestParam(defaultValue = "false") boolean soloAdministrativos,
                                          @RequestParam(required = false) String tipo,
                                          @RequestParam(required = false) String q,
                                          @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return documentoService.buscar(estudianteId, programaId, soloAdministrativos, tipo, q, pageable);
    }

    @GetMapping("/tipos")
    @Operation(summary = "Tipos de documento soportados")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR', 'ESTUDIANTE')")
    public List<String> tipos() {
        return DocumentoService.TIPOS;
    }

    @GetMapping("/mios")
    @Operation(summary = "Listar los documentos propios del estudiante autenticado")
    @PreAuthorize("hasRole('ESTUDIANTE')")
    public Page<DocumentoResponse> buscarMios(@RequestParam(required = false) String tipo,
                                              @RequestParam(required = false) String q,
                                              @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
                                              Authentication auth) {
        return documentoService.buscarMios(tipo, q, pageable, auth);
    }

    @GetMapping("/{id}/versiones")
    @Operation(summary = "Historial de versiones del documento")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<DocumentoResponse> versiones(@PathVariable UUID id) {
        return documentoService.versiones(id);
    }

    @GetMapping("/{id}/descargar")
    @Operation(summary = "Descargar el archivo")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResponseEntity<byte[]> descargar(@PathVariable UUID id) {
        var doc = documentoService.obtenerEntidad(id);
        byte[] contenido = documentoService.contenido(id);
        String headerCd = org.springframework.http.ContentDisposition.builder("attachment")
                .filename(doc.getNombre() != null ? doc.getNombre() : "documento", java.nio.charset.StandardCharsets.UTF_8)
                .build()
                .toString();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, headerCd)
                .contentType(doc.getContentType() != null
                        ? MediaType.parseMediaType(doc.getContentType())
                        : MediaType.APPLICATION_OCTET_STREAM)
                .body(contenido);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Subir un documento")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentoResponse subir(@RequestParam("archivo") MultipartFile archivo,
                                   @RequestParam(required = false) UUID estudianteId,
                                   @RequestParam(required = false) UUID programaId,
                                   @RequestParam(required = false) String tipo) {
        return documentoService.subir(archivo, estudianteId, programaId, tipo);
    }

    @PostMapping(value = "/mios", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Subir un documento a la propia ficha del estudiante")
    @PreAuthorize("hasRole('ESTUDIANTE')")
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentoResponse subirMio(@RequestParam("archivo") MultipartFile archivo,
                                      @RequestParam(required = false) String tipo,
                                      Authentication auth) {
        return documentoService.subirMio(archivo, tipo, auth);
    }

    @GetMapping("/{id}/mi-descarga")
    @Operation(summary = "Descargar un documento propio")
    @PreAuthorize("hasRole('ESTUDIANTE')")
    public ResponseEntity<byte[]> descargarMio(@PathVariable UUID id, Authentication auth) {
        var doc = documentoService.obtenerEntidad(id);
        byte[] contenido = documentoService.contenidoMio(id, auth);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + doc.getNombre() + "\"")
                .contentType(doc.getContentType() != null
                        ? MediaType.parseMediaType(doc.getContentType())
                        : MediaType.APPLICATION_OCTET_STREAM)
                .body(contenido);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Reemplazar el archivo (crea nueva versión)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public DocumentoResponse reemplazar(@PathVariable UUID id,
                                        @RequestParam("archivo") MultipartFile archivo) {
        return documentoService.reemplazar(id, archivo);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar documento y todas sus versiones")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable UUID id) {
        documentoService.eliminar(id);
    }

    @DeleteMapping("/{id}/mio")
    @Operation(summary = "Eliminar un documento subido por el propio estudiante")
    @PreAuthorize("hasRole('ESTUDIANTE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminarMio(@PathVariable UUID id, Authentication auth) {
        documentoService.eliminarMio(id, auth);
    }
}
