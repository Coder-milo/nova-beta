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

    private final PlantillaHvRepository plantillaRepository;
    private final HojaDeVidaRepository hvRepository;
    private final EstudianteRepository estudianteRepository;
    private final HvPdfService pdfService;
    private final HvCustomTemplateService customTemplateService;
    private final StorageService storageService;
    private final CompletitudHvService completitudService;

    @PersistenceContext
    private EntityManager entityManager;

    public HvService(PlantillaHvRepository plantillaRepository,
                     HojaDeVidaRepository hvRepository,
                     EstudianteRepository estudianteRepository,
                     HvPdfService pdfService,
                     HvCustomTemplateService customTemplateService,
                     StorageService storageService,
                     CompletitudHvService completitudService) {
        this.plantillaRepository = plantillaRepository;
        this.hvRepository = hvRepository;
        this.estudianteRepository = estudianteRepository;
        this.pdfService = pdfService;
        this.customTemplateService = customTemplateService;
        this.storageService = storageService;
        this.completitudService = completitudService;
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
        return toHvResponse(generarInterno(estudiante, resolverPlantilla(plantillaId), opciones));
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
                resultados.add(new ResultadoEstudiante(e.getId(), nombre, false, ex.getMessage()));
            }
        }
        return new GeneracionMasivaResponse(estudiantes.size(), generadas,
                estudiantes.size() - generadas, resultados);
    }

    private HojaDeVida generarInterno(Estudiante estudiante, PlantillaHv plantilla, GenerarHvOpcionesRequest opciones) {
        var formaciones = entityManager.createQuery(
                        "SELECT f FROM FormacionAdicional f WHERE f.estudiante.id = :id ORDER BY f.fechaInicio DESC",
                        FormacionAdicional.class)
                .setParameter("id", estudiante.getId()).getResultList();
        var experiencias = entityManager.createQuery(
                        "SELECT x FROM ExperienciaLaboral x WHERE x.estudiante.id = :id ORDER BY x.fechaInicio DESC",
                        ExperienciaLaboral.class)
                .setParameter("id", estudiante.getId()).getResultList();

        String idioma = opciones != null && opciones.idioma() != null ? opciones.idioma() : "es";
        List<String> secEx = opciones != null ? opciones.seccionesExcluidas() : null;
        List<String> fldEx = opciones != null ? opciones.camposExcluidos() : null;

        byte[] pdf;
        if (plantilla != null && plantilla.getObjectKey() != null) {
            pdf = customTemplateService.generar(plantilla, estudiante, formaciones, experiencias);
        } else {
            pdf = pdfService.generar(estudiante, formaciones, experiencias,
                    plantilla != null ? plantilla.getColorPrimario() : null,
                    idioma, secEx, fldEx);
        }

        String key = storageService.subir("hojas-de-vida",
                "hv-" + estudiante.getNumeroDocumento() + ".pdf", pdf, "application/pdf");

        int siguienteVersion = hvRepository.findByEstudianteIdOrderByNumeroVersionDesc(estudiante.getId())
                .stream().findFirst().map(h -> h.getNumeroVersion() + 1).orElse(1);
        hvRepository.findFirstByEstudianteIdAndActualTrue(estudiante.getId())
                .ifPresent(h -> h.setActual(false));

        var hv = new HojaDeVida();
        hv.setEstudiante(estudiante);
        hv.setPlantilla(plantilla);
        hv.setNumeroVersion(siguienteVersion);
        hv.setObjectKey(key);
        hv.setActual(true);
        hv.setGeneradaPor(usuarioActual());
        return hvRepository.save(hv);
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
        hvRepository.findFirstByEstudianteIdAndActualTrue(hv.getEstudiante().getId())
                .ifPresent(h -> h.setActual(false));
        hv.setActual(true);
        return toHvResponse(hv);
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
        if (plantillaId != null) {
            return plantillaRepository.findById(plantillaId)
                    .orElseThrow(() -> new ResourceNotFoundException("Plantilla no encontrada: " + plantillaId));
        }
        return plantillaRepository.findFirstByPredeterminadaTrueAndActivoTrue().orElse(null);
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

    private String usuarioActual() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "sistema";
    }

    private PlantillaResponse toPlantillaResponse(PlantillaHv p) {
        return new PlantillaResponse(p.getId(), p.getNombre(), p.getColorPrimario(),
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
