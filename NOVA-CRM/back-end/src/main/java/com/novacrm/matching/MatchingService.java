package com.novacrm.matching;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.matching.dto.MatchResponse;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class MatchingService {

    private final MatchRepository matchRepository;
    private final EstudianteRepository estudianteRepository;
    private final VacanteRepository vacanteRepository;

    public MatchingService(MatchRepository matchRepository,
                           EstudianteRepository estudianteRepository,
                           VacanteRepository vacanteRepository) {
        this.matchRepository = matchRepository;
        this.estudianteRepository = estudianteRepository;
        this.vacanteRepository = vacanteRepository;
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
                m.getPuntaje(),
                m.isNotificado(),
                m.isPostulado(),
                m.getCreatedAt());
    }

    public long contarMatchesPendientes(UUID estudianteId) {
        return matchRepository.countByEstudianteIdAndNotificadoFalse(estudianteId);
    }

    @Transactional
    public int ejecutarMatching() {
        var estudiantes = estudianteRepository.findAll();
        var vacantes = vacanteRepository.findByActivoTrueOrderByCreatedAtDesc(PageRequest.of(0, 100));
        int matchesCreados = 0;

        for (Estudiante e : estudiantes) {
            if (!e.isActivo()) continue;
            for (Vacante v : vacantes.getContent()) {
                if (matchRepository.existsByEstudianteIdAndVacanteId(e.getId(), v.getId())) continue;
                BigDecimal puntaje = calcularPuntaje(e, v);
                if (puntaje.compareTo(new BigDecimal("60")) >= 0) {
                    var match = new Match();
                    match.setEstudiante(e);
                    match.setVacante(v);
                    match.setPuntaje(puntaje);
                    matchRepository.save(match);
                    matchesCreados++;
                }
            }
        }
        return matchesCreados;
    }

    // Pesos del scoring (suman 100). Ajustables segun evolucione el negocio.
    private static final double PESO_AFINIDAD = 40;   // cargo/sector objetivo vs titulo/descripcion de la vacante
    private static final double PESO_INGLES = 20;     // nivel de ingles del estudiante vs requerido
    private static final double PESO_UBICACION = 20;  // misma ciudad / disponibilidad de movilidad
    private static final double PESO_EXPERIENCIA = 20; // anios de experiencia vs requeridos

    // Codigos de nivel de ingles ordenados (A1=1 ... C2=6), alineados con catalogo_nivel_ingles.
    private static final List<String> NIVELES_INGLES = List.of("A1", "A2", "B1", "B2", "C1", "C2");

    private BigDecimal calcularPuntaje(Estudiante e, Vacante v) {
        double puntaje = 0;

        // 1) Afinidad de perfil: solapamiento de palabras clave entre lo que busca el
        // estudiante (cargo/sector objetivo y experiencia) y el texto de la vacante.
        Set<String> terminosEstudiante = tokenizar(
                e.getCargoObjetivo(), e.getSectorObjetivo(), e.getSectorExperiencia(), e.getUltimoCargo());
        Set<String> terminosVacante = tokenizar(
                v.getTitulo(), v.getDescripcion(), v.getRequisitos());
        if (terminosEstudiante.isEmpty() || terminosVacante.isEmpty()) {
            puntaje += PESO_AFINIDAD * 0.5; // sin datos suficientes: puntaje neutro parcial
        } else {
            long coincidencias = terminosEstudiante.stream().filter(terminosVacante::contains).count();
            double ratio = Math.min((double) coincidencias / terminosEstudiante.size(), 1.0);
            puntaje += PESO_AFINIDAD * ratio;
        }

        // 2) Nivel de ingles: el del estudiante debe alcanzar el requerido por la vacante.
        int requerido = ordenNivelRequerido(v.getNivelInglesRequerido());
        if (requerido == 0) {
            puntaje += PESO_INGLES; // la vacante no exige ingles
        } else if (e.getNivelIngles() != null) {
            int estudiante = e.getNivelIngles().getOrden();
            double ratio = Math.min((double) estudiante / requerido, 1.0);
            puntaje += PESO_INGLES * ratio;
        }
        // else: exige ingles y el estudiante no tiene nivel registrado -> 0 en este criterio

        // 3) Ubicacion.
        if (e.getCiudad() != null && v.getUbicacion() != null) {
            if (v.getUbicacion().toLowerCase().contains(e.getCiudad().toLowerCase())
                    || e.getCiudad().toLowerCase().contains(v.getUbicacion().toLowerCase())) {
                puntaje += PESO_UBICACION;
            } else if (Boolean.TRUE.equals(e.getDisponibilidadMovilidad())) {
                puntaje += PESO_UBICACION * 0.6;
            }
        } else {
            puntaje += PESO_UBICACION * 0.5; // ubicacion desconocida: neutro parcial
        }

        // 4) Experiencia.
        if (v.getAniosExperienciaRequeridos() == null || v.getAniosExperienciaRequeridos() <= 0) {
            puntaje += PESO_EXPERIENCIA; // la vacante no exige experiencia
        } else if (e.getAniosExperiencia() != null) {
            double ratio = Math.min((double) e.getAniosExperiencia() / v.getAniosExperienciaRequeridos(), 1.0);
            puntaje += PESO_EXPERIENCIA * ratio;
        }
        // else: exige experiencia y el estudiante no la registra -> 0 en este criterio

        return BigDecimal.valueOf(puntaje).setScale(2, RoundingMode.HALF_UP);
    }

    /** Descompone los textos en palabras significativas (>=4 letras, sin acentos ni duplicados). */
    private Set<String> tokenizar(String... textos) {
        Set<String> tokens = new HashSet<>();
        for (String texto : textos) {
            if (texto == null || texto.isBlank()) continue;
            String normalizado = java.text.Normalizer.normalize(texto.toLowerCase(), java.text.Normalizer.Form.NFD)
                    .replaceAll("\\p{M}", "");
            for (String palabra : normalizado.split("[^a-z0-9]+")) {
                if (palabra.length() >= 4) tokens.add(palabra);
            }
        }
        return tokens;
    }

    /** Devuelve el orden (1-6) del nivel de ingles exigido por la vacante, o 0 si no exige. */
    private int ordenNivelRequerido(String requerido) {
        if (requerido == null) return 0;
        String upper = requerido.toUpperCase();
        for (int i = NIVELES_INGLES.size() - 1; i >= 0; i--) {
            if (upper.contains(NIVELES_INGLES.get(i))) return i + 1;
        }
        return 0;
    }
}
