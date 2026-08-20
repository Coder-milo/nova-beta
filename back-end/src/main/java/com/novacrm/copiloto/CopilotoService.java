package com.novacrm.copiloto;

import com.novacrm.colocacion.ColocacionRepository;
import com.novacrm.copiloto.CopilotoDtos.Audiencia;
import com.novacrm.copiloto.CopilotoDtos.CentroAccion;
import com.novacrm.copiloto.CopilotoDtos.GrupoAccion;
import com.novacrm.copiloto.CopilotoDtos.PersonaPrioritaria;
import com.novacrm.copiloto.CopilotoDtos.Prioridad;
import com.novacrm.copiloto.CopilotoDtos.Recomendacion;
import com.novacrm.copiloto.CopilotoDtos.Respuesta;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.estudiante.PuntajeEmpleabilidad;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.hv.HojaDeVidaRepository;
import com.novacrm.matching.MatchRepository;
import com.novacrm.postulacion.Postulacion;
import com.novacrm.postulacion.PostulacionRepository;
import com.novacrm.seguimiento.Seguimiento;
import com.novacrm.seguimiento.SeguimientoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Orquesta datos existentes y delega todas las decisiones al motor puro. */
@Service
@Transactional(readOnly = true)
public class CopilotoService {

    public static final int MAX_RECOMENDACIONES = 3;

    private final EstudianteRepository estudianteRepository;
    private final SeguimientoRepository seguimientoRepository;
    private final PostulacionRepository postulacionRepository;
    private final MatchRepository matchRepository;
    private final HojaDeVidaRepository hojaDeVidaRepository;
    private final ColocacionRepository colocacionRepository;

    public CopilotoService(EstudianteRepository estudianteRepository,
                           SeguimientoRepository seguimientoRepository,
                           PostulacionRepository postulacionRepository,
                           MatchRepository matchRepository,
                           HojaDeVidaRepository hojaDeVidaRepository,
                           ColocacionRepository colocacionRepository) {
        this.estudianteRepository = estudianteRepository;
        this.seguimientoRepository = seguimientoRepository;
        this.postulacionRepository = postulacionRepository;
        this.matchRepository = matchRepository;
        this.hojaDeVidaRepository = hojaDeVidaRepository;
        this.colocacionRepository = colocacionRepository;
    }

    public Respuesta recomendaciones(UUID estudianteId, Audiencia audiencia) {
        Estudiante estudiante = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));
        LocalDateTime ahora = LocalDateTime.now();
        var contexto = contextos(List.of(estudiante), ahora).get(estudianteId);
        var todas = MotorSiguienteAccion.evaluar(contexto, audiencia, ahora);
        return new Respuesta(estudianteId, Instant.now(), todas.size(),
                todas.stream().limit(MAX_RECOMENDACIONES).toList());
    }

    /**
     * Centro de Acción calculado en lote.
     *
     * <p>Seis consultas cubren toda la cohorte, independientemente del número
     * de estudiantes. No llama {@link #recomendaciones} en un bucle.
     */
    public CentroAccion centroAccion() {
        List<Estudiante> estudiantes = estudianteRepository.findAllByActivoTrue();
        LocalDateTime ahora = LocalDateTime.now();
        Map<UUID, MotorSiguienteAccion.Contexto> contextos = contextos(estudiantes, ahora);

        var evaluados = estudiantes.stream()
                .map(e -> new Evaluado(e, MotorSiguienteAccion
                        .evaluar(contextos.get(e.getId()), Audiencia.ADMINISTRACION, ahora)
                        .stream().limit(MAX_RECOMENDACIONES).toList()))
                .filter(e -> !e.recomendaciones().isEmpty())
                .toList();

        Map<String, List<Entrada>> porCodigo = new LinkedHashMap<>();
        evaluados.forEach(e -> e.recomendaciones().forEach(r ->
                porCodigo.computeIfAbsent(r.codigo(), ignorado -> new ArrayList<>())
                        .add(new Entrada(e.estudiante(), e.recomendaciones().size(), r))));

        List<GrupoAccion> grupos = porCodigo.values().stream()
                .map(this::grupoDe)
                .sorted(Comparator
                        .comparingInt((GrupoAccion g) -> rango(g.prioridad()))
                        .thenComparing(Comparator.comparingInt(GrupoAccion::total).reversed()))
                .toList();

        List<PersonaPrioritaria> ranking = evaluados.stream()
                .map(e -> persona(e.estudiante(), e.recomendaciones().get(0), e.recomendaciones().size()))
                .sorted(Comparator
                        .comparingInt((PersonaPrioritaria p) -> rango(p.prioridad()))
                        .thenComparing(Comparator.comparingInt(PersonaPrioritaria::totalRecomendaciones).reversed())
                        .thenComparing(PersonaPrioritaria::nombre))
                .limit(10)
                .toList();

        return new CentroAccion(Instant.now(), estudiantes.size(), grupos, ranking);
    }

    private Map<UUID, MotorSiguienteAccion.Contexto> contextos(
            List<Estudiante> estudiantes, LocalDateTime ahora) {
        if (estudiantes.isEmpty()) return Map.of();
        List<UUID> ids = estudiantes.stream().map(Estudiante::getId).toList();

        Map<UUID, List<Seguimiento>> seguimientos = seguimientoRepository.historialDeVarios(ids).stream()
                .collect(Collectors.groupingBy(s -> s.getEstudiante().getId()));
        Map<UUID, List<Postulacion>> postulaciones = postulacionRepository.deVariosEstudiantes(ids).stream()
                .collect(Collectors.groupingBy(p -> p.getEstudiante().getId()));
        Set<UUID> conHv = Set.copyOf(hojaDeVidaRepository.idsConHvVigente(ids));
        Set<UUID> colocados = Set.copyOf(colocacionRepository.idsColocados());
        Map<UUID, MatchRepository.OportunidadesPorEstudiante> oportunidades =
                matchRepository.resumirOportunidadesVigentes(ids, ahora).stream()
                        .collect(Collectors.toMap(
                                MatchRepository.OportunidadesPorEstudiante::getEstudianteId,
                                valor -> valor));

        Map<UUID, MotorSiguienteAccion.Contexto> resultado = new HashMap<>();
        for (Estudiante e : estudiantes) {
            List<Seguimiento> historial = seguimientos.getOrDefault(e.getId(), List.of());
            boolean simulacro = historial.stream().anyMatch(CopilotoService::esSimulacroCompletado);
            boolean colocado = colocados.contains(e.getId())
                    || e.getEstadoEmpleabilidad() == com.novacrm.estudiante.EstadoEmpleabilidad.EMPLEADO;
            boolean hvLista = conHv.contains(e.getId()) || e.getPreparacion().getCvListo().cumplido();
            var resumenOportunidades = oportunidades.get(e.getId());

            resultado.put(e.getId(), new MotorSiguienteAccion.Contexto(
                    e.getId(), nombre(e), e.getEstadoEmpleabilidad(),
                    hvLista,
                    e.getPreparacion().getLinkedinOptimizado().cumplido(),
                    simulacro,
                    PuntajeEmpleabilidad.porcentaje(e.getPreparacion(), colocado),
                    colocado,
                    historial.stream().map(CopilotoService::seguimientoDato).toList(),
                    postulaciones.getOrDefault(e.getId(), List.of()).stream()
                            .map(CopilotoService::postulacionDato).toList(),
                    resumenOportunidades == null ? 0 : resumenOportunidades.getTotal(),
                    resumenOportunidades == null ? null : resumenOportunidades.getMejorPuntaje()));
        }
        return resultado;
    }

    private GrupoAccion grupoDe(List<Entrada> entradas) {
        Recomendacion muestra = entradas.get(0).recomendacion();
        List<PersonaPrioritaria> personas = entradas.stream()
                .map(e -> persona(e.estudiante(), e.recomendacion(), e.totalRecomendaciones()))
                .sorted(Comparator.comparing(PersonaPrioritaria::nombre))
                .limit(8)
                .toList();
        return new GrupoAccion(
                muestra.codigo(), muestra.prioridad(),
                muestra.texto().tituloEs(), muestra.texto().tituloEn(),
                entradas.size(), personas);
    }

    private PersonaPrioritaria persona(Estudiante estudiante, Recomendacion r, int total) {
        return new PersonaPrioritaria(
                estudiante.getId(), nombre(estudiante), r.prioridad(),
                r.texto().queDetectoEs(), r.texto().queDetectoEn(),
                "/estudiantes/" + estudiante.getId(), total);
    }

    private static MotorSiguienteAccion.SeguimientoDato seguimientoDato(Seguimiento s) {
        return new MotorSiguienteAccion.SeguimientoDato(
                s.getFecha(), s.getTipo(), s.getEstado(), s.getProximaAccion(), s.getFechaProxima());
    }

    private static MotorSiguienteAccion.PostulacionDato postulacionDato(Postulacion p) {
        return new MotorSiguienteAccion.PostulacionDato(
                p.getFechaPostulacion(), p.getEstado(), p.getFechaHoraEntrevista(),
                p.getCargo(), p.nombreEmpresa());
    }

    private static boolean esSimulacroCompletado(Seguimiento s) {
        return s.getTipo() != null && s.getTipo().trim().toUpperCase().startsWith("SIMULACRO")
                && s.getEstado() != null && s.getEstado().trim().toUpperCase().startsWith("COMPLET");
    }

    private static String nombre(Estudiante e) {
        String valor = ((e.getNombre() == null ? "" : e.getNombre()) + " "
                + (e.getApellido() == null ? "" : e.getApellido())).trim();
        return valor.isEmpty() ? "Estudiante" : valor;
    }

    private static int rango(Prioridad prioridad) {
        return switch (prioridad) {
            case ALTA -> 0;
            case MEDIA -> 1;
            case BAJA -> 2;
        };
    }

    private record Evaluado(Estudiante estudiante, List<Recomendacion> recomendaciones) {}
    private record Entrada(Estudiante estudiante, int totalRecomendaciones, Recomendacion recomendacion) {}
}
