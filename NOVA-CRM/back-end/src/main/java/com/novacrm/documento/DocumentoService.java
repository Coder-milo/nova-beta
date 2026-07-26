package com.novacrm.documento;

import com.novacrm.documento.dto.DocumentoResponse;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.programa.ProgramaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class DocumentoService {

    public static final List<String> TIPOS = List.of(
            "HV_ORIGINAL", "HV_INSTITUCIONAL", "CERTIFICADO_CAC",
            "CERTIFICADO_EXTERNO", "FOTO", "DOCUMENTO_IDENTIDAD", "OTRO");

    private static final long MAX_TAMANO = 20L * 1024 * 1024; // 20 MB

    private final DocumentoRepository documentoRepository;
    private final EstudianteRepository estudianteRepository;
    private final ProgramaRepository programaRepository;
    private final StorageService storageService;

    public DocumentoService(DocumentoRepository documentoRepository,
                            EstudianteRepository estudianteRepository,
                            ProgramaRepository programaRepository,
                            StorageService storageService) {
        this.documentoRepository = documentoRepository;
        this.estudianteRepository = estudianteRepository;
        this.programaRepository = programaRepository;
        this.storageService = storageService;
    }

    public Page<DocumentoResponse> buscar(UUID estudianteId, UUID programaId, String tipo, String q, Pageable pageable) {
        return documentoRepository.buscar(estudianteId, programaId,
                        (tipo == null || tipo.isBlank()) ? null : tipo,
                        (q == null || q.isBlank()) ? null : q, pageable)
                .map(this::toResponse);
    }

    public List<DocumentoResponse> versiones(UUID id) {
        var doc = obtenerEntidad(id);
        return documentoRepository.findByGrupoIdOrderByNumeroVersionDesc(doc.getGrupoId())
                .stream().map(this::toResponse).toList();
    }

    public byte[] contenido(UUID id) {
        return storageService.descargar(obtenerEntidad(id).getObjectKey());
    }

    public Documento obtenerEntidad(UUID id) {
        return documentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Documento no encontrado: " + id));
    }

    @Transactional
    public DocumentoResponse subir(MultipartFile archivo, UUID estudianteId, UUID programaId, String tipo) {
        validarArchivo(archivo);
        String tipoNormalizado = normalizarTipo(tipo);

        var doc = new Documento();
        doc.setGrupoId(UUID.randomUUID());
        doc.setNumeroVersion(1);
        if (estudianteId != null) {
            doc.setEstudiante(estudianteRepository.findById(estudianteId)
                    .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + estudianteId)));
        }
        if (programaId != null) {
            doc.setPrograma(programaRepository.findById(programaId)
                    .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado: " + programaId)));
        }
        doc.setTipo(tipoNormalizado);
        doc.setNombre(archivo.getOriginalFilename() != null ? archivo.getOriginalFilename() : "archivo");
        doc.setContentType(archivo.getContentType());
        doc.setTamano(archivo.getSize());
        doc.setSubidoPor(usuarioActual());
        doc.setObjectKey(subirAStorage(archivo, "documentos"));
        return toResponse(documentoRepository.save(doc));
    }

    /** Reemplaza el archivo: crea una nueva versión dentro del mismo grupo. */
    @Transactional
    public DocumentoResponse reemplazar(UUID id, MultipartFile archivo) {
        validarArchivo(archivo);
        var anterior = obtenerEntidad(id);
        if (!anterior.isActual()) {
            throw new BusinessException("Solo se puede reemplazar la versión vigente del documento");
        }
        anterior.setActual(false);

        var nueva = new Documento();
        nueva.setGrupoId(anterior.getGrupoId());
        nueva.setNumeroVersion(anterior.getNumeroVersion() + 1);
        nueva.setEstudiante(anterior.getEstudiante());
        nueva.setPrograma(anterior.getPrograma());
        nueva.setTipo(anterior.getTipo());
        nueva.setNombre(archivo.getOriginalFilename() != null ? archivo.getOriginalFilename() : anterior.getNombre());
        nueva.setContentType(archivo.getContentType());
        nueva.setTamano(archivo.getSize());
        nueva.setSubidoPor(usuarioActual());
        nueva.setObjectKey(subirAStorage(archivo, "documentos"));
        return toResponse(documentoRepository.save(nueva));
    }

    @Transactional
    public void eliminar(UUID id) {
        var doc = obtenerEntidad(id);
        // Elimina el grupo completo (todas las versiones) del storage y la BD.
        var versiones = documentoRepository.findByGrupoIdOrderByNumeroVersionDesc(doc.getGrupoId());
        for (var v : versiones) {
            try { storageService.eliminar(v.getObjectKey()); } catch (Exception ignored) { /* best effort */ }
        }
        documentoRepository.deleteAll(versiones);
    }

    private byte[] leerBytes(MultipartFile archivo) {
        try {
            return archivo.getBytes();
        } catch (Exception e) {
            throw new BusinessException("No se pudo leer el archivo: " + e.getMessage());
        }
    }

    private String subirAStorage(MultipartFile archivo, String carpeta) {
        return storageService.subir(carpeta, archivo.getOriginalFilename(), leerBytes(archivo), archivo.getContentType());
    }

    private void validarArchivo(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) throw new BusinessException("El archivo es obligatorio");
        if (archivo.getSize() > MAX_TAMANO) throw new BusinessException("El archivo supera el tamaño máximo de 20 MB");
    }

    private String normalizarTipo(String tipo) {
        if (tipo == null || tipo.isBlank()) return "OTRO";
        String t = tipo.trim().toUpperCase();
        return TIPOS.contains(t) ? t : "OTRO";
    }

    private String usuarioActual() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "sistema";
    }

    private DocumentoResponse toResponse(Documento d) {
        return new DocumentoResponse(
                d.getId(), d.getGrupoId(), d.getNumeroVersion(),
                d.getEstudiante() != null ? d.getEstudiante().getId() : null,
                d.getEstudiante() != null ? d.getEstudiante().getNombre() + " " + d.getEstudiante().getApellido() : null,
                d.getPrograma() != null ? d.getPrograma().getId() : null,
                d.getPrograma() != null ? d.getPrograma().getNombre() : null,
                d.getTipo(), d.getNombre(), d.getContentType(), d.getTamano(),
                d.getSubidoPor(), d.isActual(), d.getCreatedAt());
    }
}
