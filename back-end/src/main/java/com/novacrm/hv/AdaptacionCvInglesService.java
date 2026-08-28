package com.novacrm.hv;

import com.fasterxml.jackson.databind.JsonNode;
import com.novacrm.catalogo.nivel_ingles.NivelInglesRepository;
import com.novacrm.estudiante.EstadoHito;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.hv.dto.AdaptacionCvInglesRequest;
import com.novacrm.hv.dto.AdaptacionCvInglesResponse;
import com.novacrm.hv.dto.AplicarAdaptacionInglesRequest;
import com.novacrm.hv.dto.ExperienciaDto;
import com.novacrm.ia.ProveedorIa;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class AdaptacionCvInglesService {

    private static final Logger log = LoggerFactory.getLogger(AdaptacionCvInglesService.class);

    private final ProveedorIa proveedorIa;
    private final EstudianteRepository estudianteRepository;
    private final NivelInglesRepository nivelInglesRepository;
    private final com.novacrm.perfil.ExperienciaLaboralRepository experienciaLaboralRepository;

    public AdaptacionCvInglesService(ProveedorIa proveedorIa,
                                     EstudianteRepository estudianteRepository,
                                     NivelInglesRepository nivelInglesRepository) {
        this(proveedorIa, estudianteRepository, nivelInglesRepository, null);
    }

    @Autowired
    public AdaptacionCvInglesService(ProveedorIa proveedorIa,
                                     EstudianteRepository estudianteRepository,
                                     NivelInglesRepository nivelInglesRepository,
                                     @Autowired(required = false) com.novacrm.perfil.ExperienciaLaboralRepository experienciaLaboralRepository) {
        this.proveedorIa = proveedorIa;
        this.estudianteRepository = estudianteRepository;
        this.nivelInglesRepository = nivelInglesRepository;
        this.experienciaLaboralRepository = experienciaLaboralRepository;
    }

    public AdaptacionCvInglesResponse adaptar(UUID estudianteId, AdaptacionCvInglesRequest request) {
        Estudiante estudiante = null;
        if (estudianteId != null) {
            estudiante = estudianteRepository.findById(estudianteId).orElse(null);
        }

        String cargo = (request != null && request.cargoObjetivo() != null && !request.cargoObjetivo().isBlank())
                ? request.cargoObjetivo().trim()
                : (estudiante != null && estudiante.getCargoObjetivo() != null && !estudiante.getCargoObjetivo().isBlank()
                    ? estudiante.getCargoObjetivo().trim()
                    : (estudiante != null && estudiante.getPrograma() != null ? estudiante.getPrograma().getNombre() : "Professional"));

        String perfil = (request != null && request.perfilProfesional() != null && !request.perfilProfesional().isBlank())
                ? request.perfilProfesional().trim()
                : (estudiante != null && estudiante.getPerfilProfesional() != null && !estudiante.getPerfilProfesional().isBlank()
                    ? estudiante.getPerfilProfesional().trim()
                    : (cargo != null ? "Profesional en " + cargo + " con enfoque en resultados y mejora continua." : ""));

        String competencias = (request != null && request.competencias() != null && !request.competencias().isBlank())
                ? request.competencias().trim()
                : (estudiante != null && estudiante.getCompetencias() != null ? estudiante.getCompetencias().trim() : "");

        List<ExperienciaDto> expList = (request != null && request.experiencias() != null && !request.experiencias().isEmpty())
                ? request.experiencias()
                : List.of();

        if (expList.isEmpty() && estudianteId != null && experienciaLaboralRepository != null) {
            var expEntities = experienciaLaboralRepository.findByEstudianteIdOrderByFechaInicioDesc(estudianteId);
            if (!expEntities.isEmpty()) {
                expList = expEntities.stream()
                        .map(e -> new ExperienciaDto(
                                e.getCargo(),
                                e.getEmpresa(),
                                e.getCiudad() != null ? e.getCiudad() : "",
                                e.getFechaInicio() != null ? e.getFechaInicio().toString() : "",
                                e.getFechaFin() != null ? e.getFechaFin().toString() : (e.isActual() ? "Present" : ""),
                                e.isRelacionada(),
                                e.isActual(),
                                e.getFunciones() != null ? e.getFunciones() : ""
                        ))
                        .toList();
            }
        }

        if (proveedorIa != null && proveedorIa.disponible()) {
            try {
                String promptSistema = """
                        You are an expert bilingual career coach and ATS resume optimizer specializing in converting Latin American CVs into high-impact English Resumes for multinational and global recruiters.
                        Translate and adapt the candidate's Target Role, Professional Summary, Competencies, and Work Experiences from Spanish into professional US English.
                        Rules:
                        1. Use strong past-tense action verbs (e.g. Developed, Led, Spearheaded, Implemented, Streamlined, Engineered).
                        2. Write a concise, impact-oriented Professional Summary (2-4 sentences) highlighting key strengths and value.
                        3. Translate technical & soft skills into industry standard English terms.
                        4. For each work experience, translate the role title and transform bullet points/functions into action-oriented achievements.
                        5. Return ONLY a valid JSON object matching this schema:
                        {
                          "targetRole": "English Title",
                          "professionalSummary": "English Summary...",
                          "skills": "Skill 1, Skill 2, Skill 3...",
                          "experiences": [
                            {
                              "cargo": "English Position Title",
                              "empresa": "Company Name",
                              "ciudad": "City, Country",
                              "fechaInicio": "Date Start",
                              "fechaFin": "Date End",
                              "funciones": "Bullet points using action verbs..."
                            }
                          ],
                          "actionVerbsUsed": ["Engineered", "Spearheaded", "Led", "Optimized"],
                          "suggestions": "Brief advice on formatting for international remote jobs"
                        }
                        """;

                StringBuilder usuario = new StringBuilder();
                usuario.append("Candidate Data in Spanish:\n");
                usuario.append("Target Role: ").append(cargo).append("\n");
                usuario.append("Professional Summary: ").append(perfil).append("\n");
                usuario.append("Skills / Competencias: ").append(competencias).append("\n");
                usuario.append("Work Experiences:\n");
                for (var e : expList) {
                    usuario.append("- Role: ").append(e.cargo()).append(" at ").append(e.empresa())
                            .append(" (").append(e.fechaInicio()).append(" - ").append(e.fechaFin()).append(")\n")
                            .append("  Location: ").append(e.ciudad()).append("\n")
                            .append("  Duties: ").append(e.funciones()).append("\n");
                }

                Optional<JsonNode> resOpt = proveedorIa.completarJson(promptSistema, usuario.toString());
                if (resOpt.isPresent()) {
                    JsonNode node = resOpt.get();
                    String targetRole = node.path("targetRole").asText(cargo);
                    String summary = node.path("professionalSummary").asText(perfil);
                    String skills;
                    if (node.path("skills").isArray()) {
                        List<String> skList = new ArrayList<>();
                        for (JsonNode sk : node.path("skills")) {
                            skList.add(sk.asText());
                        }
                        skills = String.join(", ", skList);
                    } else {
                        skills = node.path("skills").asText(competencias);
                    }
                    String suggestions = node.path("suggestions").asText("Resume adapted to international ATS standards.");

                    List<String> verbs = new ArrayList<>();
                    if (node.has("actionVerbsUsed") && node.get("actionVerbsUsed").isArray()) {
                        for (JsonNode v : node.get("actionVerbsUsed")) {
                            verbs.add(v.asText());
                        }
                    }

                    List<ExperienciaDto> adaptedExp = new ArrayList<>();
                    if (node.has("experiences") && node.get("experiences").isArray()) {
                        for (JsonNode expNode : node.get("experiences")) {
                            adaptedExp.add(new ExperienciaDto(
                                    expNode.path("cargo").asText("Role"),
                                    expNode.path("empresa").asText("Company"),
                                    expNode.path("ciudad").asText(""),
                                    expNode.path("fechaInicio").asText(""),
                                    expNode.path("fechaFin").asText(""),
                                    false,
                                    false,
                                    expNode.path("funciones").asText("")
                            ));
                        }
                    } else {
                        adaptedExp = expList;
                    }

                    return new AdaptacionCvInglesResponse(targetRole, summary, skills, adaptedExp, verbs, suggestions);
                }
            } catch (Exception ex) {
                log.warn("Fallo llamando a proveedor IA para traducción de CV: {}", ex.getMessage());
            }
        }

        // Fallback Heurístico si la IA no está disponible
        return generarFallback(cargo, perfil, competencias, expList);
    }

    @Transactional
    public void aplicar(UUID estudianteId, AplicarAdaptacionInglesRequest request) {
        Estudiante estudiante = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + estudianteId));

        if (request != null && request.nivelIngles() != null && !request.nivelIngles().isBlank()) {
            nivelInglesRepository.findByCodigo(request.nivelIngles().toUpperCase())
                    .ifPresent(estudiante::setNivelIngles);
        }

        if (request != null && request.professionalSummary() != null && !request.professionalSummary().isBlank()) {
            estudiante.setPerfilProfesional(request.professionalSummary().trim());
        }

        if (request != null && request.targetRole() != null && !request.targetRole().isBlank()) {
            estudiante.setCargoObjetivo(request.targetRole().trim());
        }

        if (request != null && request.skills() != null && !request.skills().isBlank()) {
            estudiante.setCompetencias(request.skills().trim());
        }

        estudiante.getPreparacion().setCvEnIngles(EstadoHito.SI);
        estudianteRepository.save(estudiante);
    }

    private AdaptacionCvInglesResponse generarFallback(String cargo, String perfil, String competencias, List<ExperienciaDto> experiencias) {
        String targetRole = traducirCargoHeuristico(cargo);
        String summary = traducirTextoHeuristico(perfil);
        String skills = traducirCompetenciasHeuristico(competencias);

        List<ExperienciaDto> expAdaptadas = new ArrayList<>();
        for (var e : experiencias) {
            expAdaptadas.add(new ExperienciaDto(
                    traducirCargoHeuristico(e.cargo()),
                    e.empresa(),
                    e.ciudad(),
                    e.fechaInicio(),
                    e.fechaFin(),
                    e.relacionada(),
                    e.actual(),
                    traducirTextoHeuristico(e.funciones())
            ));
        }

        List<String> verbs = List.of("Developed", "Managed", "Led", "Executed", "Optimized");
        return new AdaptacionCvInglesResponse(
                targetRole,
                summary,
                skills,
                expAdaptadas,
                verbs,
                "Adapted using bilingual ATS keywords. Review your experience bullets for active impact."
        );
    }

    private String traducirCargoHeuristico(String c) {
        if (c == null) return "Professional";
        String l = c.toLowerCase();
        if (l.contains("desarrollador") || l.contains("programador")) return c.replaceAll("(?i)desarrollador", "Software Developer").replaceAll("(?i)programador", "Software Developer");
        if (l.contains("profesor") || l.contains("docente")) return c.replaceAll("(?i)profesor", "Instructor").replaceAll("(?i)docente", "Educator");
        if (l.contains("tecnico") || l.contains("técnico")) return c.replaceAll("(?i)t[eé]cnico", "Technician");
        if (l.contains("ingeniero")) return c.replaceAll("(?i)ingeniero", "Engineer");
        if (l.contains("asistente") || l.contains("auxiliar")) return c.replaceAll("(?i)asistente|auxiliar", "Assistant");
        return c;
    }

    private String traducirTextoHeuristico(String t) {
        if (t == null || t.isBlank()) return "";
        return t.replaceAll("(?i)\\bsoy\\b", "Experienced")
                .replaceAll("(?i)\\bapasionado por\\b", "passionate about")
                .replaceAll("(?i)\\bdesarrollo\\b", "development")
                .replaceAll("(?i)\\btecnolog[ií]a\\b", "technology")
                .replaceAll("(?i)\\bexperiencia\\b", "experience")
                .replaceAll("(?i)\\bconocimientos\\b", "knowledge")
                .replaceAll("(?i)\\bcapacidades\\b", "skills");
    }

    private String traducirCompetenciasHeuristico(String comp) {
        if (comp == null || comp.isBlank()) return "";
        return comp.replaceAll("(?i)liderazgo", "Leadership")
                .replaceAll("(?i)trabajo en equipo", "Teamwork")
                .replaceAll("(?i)comunicaci[oó]n", "Communication")
                .replaceAll("(?i)resoluci[oó]n de problemas", "Problem Solving")
                .replaceAll("(?i)formaci[oó]n", "Training");
    }
}
