package com.novacrm.hv;

import com.novacrm.documento.StorageService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.hv.dto.*;
import com.novacrm.perfil.ExperienciaLaboral;
import com.novacrm.perfil.FormacionAdicional;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@Transactional(readOnly = true)
public class HvService {

    private static final Logger log = LoggerFactory.getLogger(HvService.class);

    private final PlantillaHvRepository plantillaRepository;
    private final HojaDeVidaRepository hvRepository;
    private final HvVersionService hvVersionService;
    private final EstudianteRepository estudianteRepository;
    private final HvPdfService pdfService;
    private final HvCustomTemplateService customTemplateService;
    private final StorageService storageService;
    private final CompletitudHvService completitudService;

    @PersistenceContext
    private EntityManager entityManager;

    public HvService(PlantillaHvRepository plantillaRepository,
                     HojaDeVidaRepository hvRepository,
                     HvVersionService hvVersionService,
                     EstudianteRepository estudianteRepository,
                     HvPdfService pdfService,
                     HvCustomTemplateService customTemplateService,
                     StorageService storageService,
                     CompletitudHvService completitudService) {
        this.plantillaRepository = plantillaRepository;
        this.hvRepository = hvRepository;
        this.hvVersionService = hvVersionService;
        this.estudianteRepository = estudianteRepository;
        this.pdfService = pdfService;
        this.customTemplateService = customTemplateService;
        this.storageService = storageService;
        this.completitudService = completitudService;
    }

    /**
     * Indica si el estudiante tiene una hoja de vida vigente.
     *
     * <p>Se expone aqui, y no el repositorio, para que el resto de modulos
     * consulten el hecho sin acoplarse al almacenamiento de este.
     */
    public boolean tieneHvVigente(java.util.UUID estudianteId) {
        return hvRepository.existsByEstudianteIdAndActualTrue(estudianteId);
    }

    // ── Plantillas ───────────────────────────────────────────────────────────

    public List<PlantillaResponse> listarPlantillas() {
        return plantillaRepository.findByActivoTrueOrderByCreatedAtDesc()
                .stream().map(this::toPlantillaResponse).toList();
    }

    @Transactional
    public PlantillaResponse crearPlantilla(String nombre, String colorPrimario, MultipartFile archivo) {
        if (nombre == null || nombre.isBlank()) throw new BusinessException("El nombre de la plantilla es obligatorio");
        if (archivo == null || archivo.isEmpty()) {
            throw new BusinessException("Selecciona la plantilla en formato Word (.docx) o PDF.");
        }
        var p = new PlantillaHv();
        p.setNombre(nombre.trim());
        if (colorPrimario != null && colorPrimario.matches("#[0-9a-fA-F]{6}")) {
            p.setColorPrimario(colorPrimario);
        }
        try {
            byte[] bytes = archivo.getBytes();
            var validation = customTemplateService.validar(
                    archivo.getOriginalFilename(), archivo.getContentType(), bytes);
            p.setObjectKey(storageService.subir("plantillas", archivo.getOriginalFilename(),
                    bytes, archivo.getContentType()));
            p.setContentType(validation.format() == HvCustomTemplateService.TemplateFormat.PDF
                    ? "application/pdf"
                    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            p.setFieldManifest(validation.manifest());
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("No se pudo guardar el archivo de la plantilla: " + e.getMessage());
        }
        if (plantillaRepository.findFirstByPredeterminadaTrueAndActivoTrue().isEmpty()) {
            p.setPredeterminada(true);
        }
        return toPlantillaResponse(plantillaRepository.save(p));
    }

    @Transactional
    public PlantillaResponse marcarPredeterminada(UUID id) {
        var plantilla = plantillaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Plantilla no encontrada: " + id));
        plantillaRepository.findByActivoTrueOrderByCreatedAtDesc()
                .forEach(p -> p.setPredeterminada(false));
        plantilla.setPredeterminada(true);
        return toPlantillaResponse(plantilla);
    }

    @Transactional
    public void eliminarPlantilla(UUID id) {
        var plantilla = plantillaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Plantilla no encontrada: " + id));
        plantilla.setActivo(false);
        plantilla.setPredeterminada(false);
        // Dejar la preferida apuntando a una plantilla borrada hace que la
        // generacion caiga a la predeterminada (resolverPlantilla), pero el
        // estudiante la seguiria viendo como opcion. Se desvincula aqui.
        estudianteRepository.desvincularPlantillaPreferida(id);
    }

    // ── Generación ───────────────────────────────────────────────────────────

    @Transactional
    public HojaDeVidaResponse generarIndividual(UUID estudianteId, UUID plantillaId) {
        return generarIndividual(estudianteId, new GenerarHvOpcionesRequest(plantillaId, "es", null, null));
    }

    @Transactional
    public HojaDeVidaResponse generarIndividual(UUID estudianteId, GenerarHvOpcionesRequest opciones) {
        var estudiante = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + estudianteId));
        UUID plantillaId = opciones != null ? opciones.plantillaId() : null;
        return toHvResponse(generarInterno(estudiante, resolverPlantilla(estudiante, plantillaId), opciones));
    }

    @Transactional
    public GeneracionMasivaResponse generarMasiva(GeneracionMasivaRequest request) {
        var plantilla = resolverPlantilla(request.plantillaId());
        List<Estudiante> estudiantes = resolverEstudiantes(request);
        if (estudiantes.isEmpty()) throw new BusinessException("No hay estudiantes para generar");
        if (estudiantes.size() > 500) throw new BusinessException("Máximo 500 hojas de vida por ejecución");

        var resultados = new ArrayList<ResultadoEstudiante>();
        int generadas = 0;
        for (var e : estudiantes) {
            String nombre = e.getNombre() + " " + e.getApellido();
            try {
                if (request.soloCompletos() && !perfilCompleto(e)) {
                    resultados.add(new ResultadoEstudiante(e.getId(), nombre, false, "Información incompleta"));
                    continue;
                }
                generarInterno(e, plantilla, null);
                resultados.add(new ResultadoEstudiante(e.getId(), nombre, true, null));
                generadas++;
            } catch (Exception ex) {
                log.warn("No se pudo generar la hoja de vida de {} ({})", e.getId(), nombre, ex);
                resultados.add(new ResultadoEstudiante(e.getId(), nombre, false, mensajeSeguro(ex)));
            }
        }
        return new GeneracionMasivaResponse(estudiantes.size(), generadas,
                estudiantes.size() - generadas, resultados);
    }

    /**
     * PDF de la hoja de vida sin registrar una versión nueva.
     *
     * <p>La previsualización se pide cada vez que el estudiante retoca el
     * formulario. Si reutilizara {@link #generarIndividual}, cada vistazo
     * dejaría un fichero en el almacén y una fila más en el histórico, y la
     * versión «vigente» acabaría siendo un borrador que nadie decidió publicar.
     */
    public byte[] vistaPreviaDeEstudiante(UUID estudianteId, GenerarHvOpcionesRequest opciones) {
        var estudiante = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + estudianteId));
        return renderizar(estudiante, resolverPlantilla(estudiante, opciones != null ? opciones.plantillaId() : null), opciones);
    }

    private byte[] renderizar(Estudiante estudiante, PlantillaHv plantilla, GenerarHvOpcionesRequest opciones) {
        var formaciones = formacionesDe(estudiante.getId());
        var experiencias = experienciasDe(estudiante.getId());

        String idioma = opciones != null && opciones.idioma() != null ? opciones.idioma() : "es";
        List<String> secEx = opciones != null ? opciones.seccionesExcluidas() : null;
        List<String> fldEx = opciones != null ? opciones.camposExcluidos() : null;

        if (plantilla != null && plantilla.getObjectKey() != null) {
            return customTemplateService.generar(plantilla, estudiante, formaciones, experiencias);
        }

        String fotoBase64 = obtenerFotoBase64(estudiante);
        String codigo = plantilla != null && plantilla.getCodigo() != null ? plantilla.getCodigo() : "CAC_ATS";

        return pdfService.generar(estudiante, formaciones, experiencias,
                plantilla != null ? plantilla.getColorPrimario() : null,
                idioma, secEx, fldEx, fotoBase64, codigo);
    }

    private List<FormacionAdicional> formacionesDe(UUID estudianteId) {
        return entityManager.createQuery(
                        "SELECT f FROM FormacionAdicional f WHERE f.estudiante.id = :id ORDER BY f.fechaInicio DESC",
                        FormacionAdicional.class)
                .setParameter("id", estudianteId).getResultList();
    }

    private List<ExperienciaLaboral> experienciasDe(UUID estudianteId) {
        return entityManager.createQuery(
                        "SELECT x FROM ExperienciaLaboral x WHERE x.estudiante.id = :id ORDER BY x.fechaInicio DESC",
                        ExperienciaLaboral.class)
                .setParameter("id", estudianteId).getResultList();
    }

    private HojaDeVida generarInterno(Estudiante estudiante, PlantillaHv plantilla, GenerarHvOpcionesRequest opciones) {
        byte[] pdf = renderizar(estudiante, plantilla, opciones);

        String docId = (estudiante.getNumeroDocumento() != null && !estudiante.getNumeroDocumento().isBlank())
                ? estudiante.getNumeroDocumento()
                : estudiante.getId().toString();
        String key = storageService.subir("hojas-de-vida",
                "hv-" + docId + ".pdf", pdf, "application/pdf");

        // Cada versión se confirma por separado. En una generación masiva, un
        // fallo de un estudiante no deja abortada la transacción de los demás.
        try {
            return hvVersionService.registrar(estudiante, plantilla, key, usuarioActual());
        } catch (RuntimeException ex) {
            // El PDF ya estaba subido. Si la fila no pudo guardarse, se evita
            // dejar un archivo huérfano ocupando el almacenamiento.
            try {
                storageService.eliminar(key);
            } catch (Exception cleanupError) {
                log.warn("No se pudo limpiar el PDF huérfano {}", key, cleanupError);
            }
            throw ex;
        }
    }

    // ── Consulta y descarga ──────────────────────────────────────────────────

    public List<HojaDeVidaResponse> versionesDeEstudiante(UUID estudianteId) {
        return hvRepository.findByEstudianteIdOrderByNumeroVersionDesc(estudianteId)
                .stream().map(this::toHvResponse).toList();
    }

    public byte[] pdf(UUID hvId) {
        return storageService.descargar(obtener(hvId).getObjectKey());
    }

    public byte[] vistaPreviaPlantilla(UUID plantillaId) {
        var plantilla = plantillaRepository.findById(plantillaId)
                .orElseThrow(() -> new ResourceNotFoundException("Plantilla no encontrada: " + plantillaId));
        if (!plantilla.isActivo()) {
            throw new ResourceNotFoundException("Plantilla no encontrada: " + plantillaId);
        }
        return customTemplateService.vistaPrevia(plantilla);
    }

    public HojaDeVida obtener(UUID hvId) {
        return hvRepository.findById(hvId)
                .orElseThrow(() -> new ResourceNotFoundException("Hoja de vida no encontrada: " + hvId));
    }

    @Transactional
    public HojaDeVidaResponse marcarActual(UUID hvId) {
        var hv = obtener(hvId);
        if (hv.isActual()) return toHvResponse(hv);
        hvRepository.findFirstByEstudianteIdAndActualTrue(hv.getEstudiante().getId())
                .ifPresent(h -> h.setActual(false));
        // Igual que al generar: primero se libera la única fila vigente y
        // después se activa la elegida.
        hvRepository.flush();
        hv.setActual(true);
        return toHvResponse(hvRepository.saveAndFlush(hv));
    }

    /** Elimina una versión generada y conserva una versión vigente cuando exista otra. */
    @Transactional
    public void eliminarHojaDeVida(UUID hvId) {
        var hv = obtener(hvId);
        var estudianteId = hv.getEstudiante().getId();
        boolean eraActual = hv.isActual();
        String objectKey = hv.getObjectKey();
        hvRepository.delete(hv);
        if (eraActual) {
            // Evita que el UPDATE de la siguiente versión se ejecute antes que
            // el DELETE de la actual y choque con uq_hv_estudiante_actual.
            hvRepository.flush();
            hvRepository.findByEstudianteIdOrderByNumeroVersionDesc(estudianteId).stream()
                    .findFirst().ifPresent(siguiente -> siguiente.setActual(true));
        }
        storageService.eliminar(objectKey);
    }

    /** Descarga en ZIP las HVs vigentes de los estudiantes indicados. */
    public byte[] zipDeEstudiantes(List<UUID> estudianteIds) {
        if (estudianteIds == null || estudianteIds.isEmpty()) {
            throw new BusinessException("Indica al menos un estudiante");
        }
        try (var buffer = new ByteArrayOutputStream(); var zip = new ZipOutputStream(buffer)) {
            int agregadas = 0;
            for (var id : estudianteIds) {
                var hvOpt = hvRepository.findFirstByEstudianteIdAndActualTrue(id);
                if (hvOpt.isEmpty()) continue;
                var hv = hvOpt.get();
                var e = hv.getEstudiante();
                String nombre = ("HV-" + e.getNombre() + "-" + e.getApellido() + "-v" + hv.getNumeroVersion() + ".pdf")
                        .replaceAll("[^a-zA-Z0-9.\\-]", "_");
                zip.putNextEntry(new ZipEntry(nombre));
                zip.write(storageService.descargar(hv.getObjectKey()));
                zip.closeEntry();
                agregadas++;
            }
            zip.finish();
            if (agregadas == 0) throw new BusinessException("Ninguno de los estudiantes tiene hoja de vida generada");
            return buffer.toByteArray();
        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            throw new IllegalStateException("Error creando el ZIP: " + e.getMessage(), e);
        }
    }

    public long totalGeneradas() {
        return hvRepository.countByActualTrue();
    }

    // ── Análisis de completitud ──────────────────────────────────────────

    public com.novacrm.hv.dto.AnalisisCompletitudResponse analizarCompletitud(UUID estudianteId) {
        var estudiante = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + estudianteId));
        return completitudService.analizar(estudiante);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private PlantillaHv resolverPlantilla(UUID plantillaId) {
        return resolverPlantilla(null, plantillaId);
    }

    private PlantillaHv resolverPlantilla(Estudiante e, UUID plantillaId) {
        if (plantillaId != null) {
            var plantilla = plantillaRepository.findById(plantillaId)
                    .orElseThrow(() -> new ResourceNotFoundException("Plantilla no encontrada: " + plantillaId));
            if (!plantilla.isActivo()) {
                throw new ResourceNotFoundException("Plantilla no encontrada: " + plantillaId);
            }
            return plantilla;
        }
        if (e != null && e.getPlantillaPreferida() != null) {
            // La preferida puede apuntar a una plantilla borrada despues.
            // En ese caso se cae a la predeterminada en lugar de fallar.
            if (e.getPlantillaPreferida().isActivo()) {
                return e.getPlantillaPreferida();
            }
        }
        return plantillaRepository.findFirstByPredeterminadaTrueAndActivoTrue().orElse(null);
    }

    private String obtenerFotoBase64(Estudiante e) {
        if (e == null || e.getFotoUrl() == null || e.getFotoUrl().isBlank()) return null;
        try {
            byte[] bytes = storageService.descargar(e.getFotoUrl());
            if (bytes != null && bytes.length > 0) {
                return java.util.Base64.getEncoder().encodeToString(bytes);
            }
        } catch (Exception ignored) {}
        return null;
    }

    private List<Estudiante> resolverEstudiantes(GeneracionMasivaRequest request) {
        if (request.estudianteIds() != null && !request.estudianteIds().isEmpty()) {
            return estudianteRepository.findAllById(request.estudianteIds());
        }
        if (request.programaId() != null) {
            return estudianteRepository.findAllByProgramaIdAndActivoTrue(request.programaId());
        }
        throw new BusinessException("Indica programaId o estudianteIds");
    }

    /** Perfil mínimo para una HV digna: contacto + algo de contenido profesional. */
    private boolean perfilCompleto(Estudiante e) {
        return notBlank(e.getEmail()) && (notBlank(e.getCelular()) || notBlank(e.getTelefono()))
                && notBlank(e.getNumeroDocumento())
                && (notBlank(e.getPerfilProfesional()) || notBlank(e.getTitulo()) || notBlank(e.getUltimoCargo()));
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private static String mensajeSeguro(Exception ex) {
        String mensaje = ex.getMessage();
        if (mensaje == null || mensaje.isBlank()) return "No se pudo generar la hoja de vida";
        return mensaje.length() <= 300 ? mensaje : mensaje.substring(0, 300);
    }

    private String usuarioActual() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "sistema";
    }

    private PlantillaResponse toPlantillaResponse(PlantillaHv p) {
        return new PlantillaResponse(p.getId(), p.getCodigo(), p.getNombre(), p.getColorPrimario(),
                p.isPredeterminada(), p.getObjectKey() != null,
                p.getContenidoHtml() != null, customTemplateService.tipoArchivo(p),
                customTemplateService.contarCampos(p.getFieldManifest()),
                customTemplateService.esAutomatica(p.getFieldManifest()), p.getCreatedAt());
    }

    private HojaDeVidaResponse toHvResponse(HojaDeVida h) {
        return new HojaDeVidaResponse(h.getId(),
                h.getEstudiante().getId(),
                h.getEstudiante().getNombre() + " " + h.getEstudiante().getApellido(),
                h.getPlantilla() != null ? h.getPlantilla().getId() : null,
                h.getPlantilla() != null ? h.getPlantilla().getNombre() : null,
                h.getNumeroVersion(), h.isActual(), h.getGeneradaPor(), h.getCreatedAt());
    }
}
