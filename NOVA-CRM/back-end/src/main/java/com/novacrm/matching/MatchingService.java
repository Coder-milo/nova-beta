package com.novacrm.matching;

import com.novacrm.config.MatchingConfig;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.habilidad.EstudianteHabilidadRepository;
import com.novacrm.matching.dto.MatchResponse;
import com.novacrm.notificacion.NotificacionService;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class MatchingService {

    private final MatchRepository matchRepository;
    private final EstudianteRepository estudianteRepository;
    private final VacanteRepository vacanteRepository;
    private final EstudianteHabilidadRepository estudianteHabilidadRepository;
    private final SkillSynonyms skillSynonyms;
    private final MatchingConfig config;
    private final NotificacionService notificacionService;

    private static final List<String> NIVELES_INGLES = List.of("A1", "A2", "B1", "B2", "C1", "C2");

    public MatchingService(MatchRepository matchRepository,
                           EstudianteRepository estudianteRepository,
                           VacanteRepository vacanteRepository,
                           EstudianteHabilidadRepository estudianteHabilidadRepository,
                           SkillSynonyms skillSynonyms,
                           MatchingConfig config,
                           NotificacionService notificacionService) {
        this.matchRepository = matchRepository;
        this.estudianteRepository = estudianteRepository;
        this.vacanteRepository = vacanteRepository;
        this.estudianteHabilidadRepository = estudianteHabilidadRepository;
        this.skillSynonyms = skillSynonyms;
        this.config = config;
        this.notificacionService = notificacionService;
    }

    public Page<MatchResponse> obtenerMatches(UUID estudianteId, org.springframework.data.domain.Pageable pageable) {
        return matchRepository.findByEstudianteIdOrderByPuntajeDesc(estudianteId, pageable)
                .map(this::toResponse);
    }

    private MatchResponse toResponse(Match m) {
        var v = m.getVacante();
        return new MatchResponse(
                m.getId(),
                m.getEstudiante().getId(),
                v.getId(),
                v.getTitulo(),
                v.getEmpresa() != null ? v.getEmpresa().getNombre() : null,
                v.getUbicacion(),
                v.getUrlOrigen(),
                v.getUrlAplicar(),
                v.getRangoSalarial(),
                v.getModalidadTrabajo(),
                v.getRequisitos(),
                m.getPuntaje(),
                m.isNotificado(),
                m.isPostulado(),
                m.getCreatedAt());
    }

    public long contarMatchesPendientes(UUID estudianteId) {
        return matchRepository.countByEstudianteIdAndNotificadoFalse(estudianteId);
    }

    @Transactional
    public void marcarPostulado(UUID matchId) {
        var match = matchRepository.findById(matchId)
                .orElseThrow(() -> new com.novacrm.exception.ResourceNotFoundException("Match no encontrado: " + matchId));
        match.setPostulado(true);
        matchRepository.save(match);
    }

    @Transactional
    public int ejecutarMatching() {
        var estudiantes = estudianteRepository.findAll();
        int maxVacantes = config.getMaxVacantesPorEjecucion();
        int umbral = config.getUmbralMinimo();

        List<Match> matchesNuevos = new ArrayList<>();
        int procesadas = 0;
        int page = 0;

        while (procesadas < maxVacantes) {
            var pagina = vacanteRepository.findByActivoTrueOrderByCreatedAtDesc(PageRequest.of(page, 200));
            var vacantes = pagina.getContent();
            if (vacantes.isEmpty()) break;

            for (Vacante v : vacantes) {
                if (procesadas >= maxVacantes) break;
                for (Estudiante e : estudiantes) {
                    if (!e.isActivo()) continue;
                    if (matchRepository.existsByEstudianteIdAndVacanteId(e.getId(), v.getId())) continue;
                    BigDecimal puntaje = calcularPuntaje(e, v);
                    if (puntaje.compareTo(BigDecimal.valueOf(umbral)) >= 0) {
                        var match = new Match();
                        match.setEstudiante(e);
                        match.setVacante(v);
                        match.setPuntaje(puntaje);
                        matchRepository.save(match);
                        matchesNuevos.add(match);
                    }
                }
                procesadas++;
            }
            if (!pagina.hasNext()) break;
            page++;
        }

        if (!matchesNuevos.isEmpty()) {
            notificacionService.generarNotificacionesMatch(matchesNuevos);
        }

        return matchesNuevos.size();
    }

    private BigDecimal calcularPuntaje(Estudiante e, Vacante v) {
        double puntaje = 0;

        // 1) Afinidad de perfil: solapamiento de terminos normalizados por sinonimos.
        // Se incluyen mas campos del estudiante que antes (perfilProfesional, areaFormacion, nivelEducativo).
        Set<String> terminosEstudiante = skillSynonyms.tokenize(
                e.getCargoObjetivo(), e.getSectorObjetivo(), e.getSectorExperiencia(),
                e.getUltimoCargo(), e.getPerfilProfesional(), e.getAreaFormacion(),
                e.getNivelEducativo());
        Set<String> terminosVacante = skillSynonyms.tokenize(
                v.getTitulo(), v.getDescripcion(), v.getRequisitos());

        if (terminosEstudiante.isEmpty() || terminosVacante.isEmpty()) {
            puntaje += config.getPesoAfinidad() * 0.5;
        } else {
            long coincidencias = terminosEstudiante.stream()
                    .filter(terminosVacante::contains)
                    .count();
            double ratio = Math.min((double) coincidencias / terminosEstudiante.size(), 1.0);

            if (hayCoincidenciaSector(e, v)) {
                ratio = Math.min(ratio + 0.15, 1.0);
            }

            puntaje += config.getPesoAfinidad() * ratio;
        }

        // 2) Habilidades: las habilidades registradas del estudiante vs el texto de la vacante.
        var habilidades = estudianteHabilidadRepository.findByEstudianteId(e.getId());
        if (!habilidades.isEmpty()) {
            Set<String> habilidadesStudent = habilidades.stream()
                    .map(eh -> skillSynonyms.tokenize(eh.getHabilidad().getNombre()))
                    .flatMap(Set::stream)
                    .collect(Collectors.toSet());
            Set<String> habilidadesVacante = skillSynonyms.tokenize(v.getDescripcion(), v.getRequisitos());

            if (!habilidadesVacante.isEmpty() && !habilidadesStudent.isEmpty()) {
                long coincidenciasH = habilidadesStudent.stream()
                        .filter(habilidadesVacante::contains)
                        .count();
                double ratioH = Math.min((double) coincidenciasH / habilidadesStudent.size(), 1.0);
                puntaje += config.getPesoHabilidades() * ratioH;
            } else {
                puntaje += config.getPesoHabilidades() * 0.7;
            }
        } else {
            puntaje += config.getPesoHabilidades() * 0.4;
        }

        // 3) Nivel de ingles.
        int requerido = ordenNivelRequerido(v.getNivelInglesRequerido());
        if (requerido == 0) {
            puntaje += config.getPesoIngles();
        } else if (e.getNivelIngles() != null) {
            int estudiante = e.getNivelIngles().getOrden();
            double ratio = Math.min((double) estudiante / requerido, 1.0);
            puntaje += config.getPesoIngles() * ratio;
        }

        // 4) Ubicacion.
        if (e.getCiudad() != null && v.getUbicacion() != null) {
            if (v.getUbicacion().toLowerCase().contains(e.getCiudad().toLowerCase())
                    || e.getCiudad().toLowerCase().contains(v.getUbicacion().toLowerCase())) {
                puntaje += config.getPesoUbicacion();
            } else if (Boolean.TRUE.equals(e.getDisponibilidadMovilidad())) {
                puntaje += config.getPesoUbicacion() * 0.6;
            }
        } else {
            puntaje += config.getPesoUbicacion() * 0.5;
        }

        // 5) Experiencia.
        if (v.getAniosExperienciaRequeridos() == null || v.getAniosExperienciaRequeridos() <= 0) {
            puntaje += config.getPesoExperiencia();
        } else if (e.getAniosExperiencia() != null) {
            double ratio = Math.min((double) e.getAniosExperiencia() / v.getAniosExperienciaRequeridos(), 1.0);
            puntaje += config.getPesoExperiencia() * ratio;
        }

        return BigDecimal.valueOf(puntaje).setScale(2, RoundingMode.HALF_UP);
    }

    private boolean hayCoincidenciaSector(Estudiante e, Vacante v) {
        if (v.getEmpresa() == null || v.getEmpresa().getSector() == null) return false;
        String sectorVacante = v.getEmpresa().getSector().trim().toLowerCase();
        if (sectorVacante.isBlank()) return false;

        if (e.getSectorObjetivo() != null
                && e.getSectorObjetivo().toLowerCase().contains(sectorVacante)) {
            return true;
        }
        if (e.getSectorExperiencia() != null
                && e.getSectorExperiencia().toLowerCase().contains(sectorVacante)) {
            return true;
        }
        return false;
    }

    private int ordenNivelRequerido(String requerido) {
        if (requerido == null) return 0;
        String upper = requerido.toUpperCase();
        for (int i = NIVELES_INGLES.size() - 1; i >= 0; i--) {
            if (upper.contains(NIVELES_INGLES.get(i))) return i + 1;
        }
        return 0;
    }
}
