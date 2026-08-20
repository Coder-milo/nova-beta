package com.novacrm.seguimiento;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.matching.MatchRepository;
import com.novacrm.pipeline.PipelineEmpleabilidadService;
import com.novacrm.seguimiento.dto.SeguimientoResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tablero de seguimiento: quien esta en que punto de la conversacion.
 *
 * <p>Las columnas son el <strong>estado de contacto</strong>, que es lo unico
 * que se captura a mano. La etapa del pipeline viaja en cada tarjeta como dato
 * de solo lectura: la deduce {@code PipelineEmpleabilidadService} de hechos que
 * ya registran otros modulos y moverla a mano no significaria nada.
 */
@Service
public class TableroService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(TableroService.class);

    private final EstudianteRepository estudianteRepository;
    private final SeguimientoRepository seguimientoRepository;
    private final MatchRepository matchRepository;
    private final PipelineEmpleabilidadService pipelineService;

    public TableroService(EstudianteRepository estudianteRepository,
                          SeguimientoRepository seguimientoRepository,
                          MatchRepository matchRepository,
                          PipelineEmpleabilidadService pipelineService) {
        this.estudianteRepository = estudianteRepository;
        this.seguimientoRepository = seguimientoRepository;
        this.matchRepository = matchRepository;
        this.pipelineService = pipelineService;
    }

    /** Una columna del tablero, con sus tarjetas ya ordenadas. */
    public record Columna(
            EstadoContacto estado,
            int total,
            int necesitanAtencion,
            List<TarjetaTablero> tarjetas) {}

    public record Tablero(int totalEstudiantes, List<Columna> columnas) {}

    /**
     * Arma el tablero completo.
     *
     * <p>Se consulta el historial de cada estudiante por separado. Con 108
     * personas es asumible; si el programa crece a miles habra que traerlo en
     * una sola consulta agrupada, porque esto son 108 viajes a la base.
     */
    @Transactional(readOnly = true)
    public Tablero construir() {
        return construir(null);
    }

    @Transactional(readOnly = true)
    public Tablero construir(UUID programaId) {
        var hoy = LocalDate.now();
        var porEstado = new EnumMap<EstadoContacto, List<TarjetaTablero>>(EstadoContacto.class);
        for (var estado : EstadoContacto.values()) {
            porEstado.put(estado, new ArrayList<>());
        }

        List<Estudiante> estudiantes = (programaId != null)
                ? estudianteRepository.findAllByProgramaIdAndActivoTrue(programaId)
                : estudianteRepository.findAllByActivoTrue();

        // A debug: el tablero se rehace al abrirlo y despues de cada tarjeta que
        // se mueve, asi que en INFO son varias lineas por minuto de trabajo
        // normal enterrando lo que si hay que ver en el log.
        log.debug("Tablero del programa {}: {} estudiantes", programaId, estudiantes.size());

        // El historial y las postulaciones de toda la cohorte, en dos consultas
        // y no en 216. Antes se pedian dentro de cada tarjeta: 108 viajes a la
        // base para el historial y otros 108 para el conteo, cada vez que se
        // abre el tablero y despues de cada movimiento de tarjeta.
        var ids = estudiantes.stream().map(Estudiante::getId).toList();
        Map<UUID, List<Seguimiento>> historialPorEstudiante = ids.isEmpty()
                ? Map.of()
                : seguimientoRepository.historialDeVarios(ids).stream()
                        .collect(java.util.stream.Collectors.groupingBy(s -> s.getEstudiante().getId()));
        Map<UUID, Long> postuladosPorEstudiante = ids.isEmpty()
                ? Map.of()
                : matchRepository.contarPostuladosDeVarios(ids).stream()
                        .collect(java.util.stream.Collectors.toMap(
                                MatchRepository.PostuladosPorEstudiante::getEstudianteId,
                                MatchRepository.PostuladosPorEstudiante::getTotal));
        Map<UUID, com.novacrm.pipeline.PipelineEmpleabilidad> pipelines = ids.isEmpty()
                ? Map.of()
                : pipelineService.calcularVarios(
                        estudiantes, historialPorEstudiante, postuladosPorEstudiante);

        for (Estudiante estudiante : estudiantes) {
            var tarjeta = tarjetaDe(estudiante, hoy,
                    // Sin fila en el agrupado significa cero, no ausencia: un
                    // `group by` no devuelve nada para quien no tiene ninguna.
                    historialPorEstudiante.getOrDefault(estudiante.getId(), List.of()),
                    postuladosPorEstudiante.getOrDefault(estudiante.getId(), 0L),
                    pipelines.get(estudiante.getId()));
            porEstado.get(tarjeta.estadoContacto()).add(tarjeta);
        }

        var columnas = new ArrayList<Columna>();
        for (var entrada : porEstado.entrySet()) {
            var tarjetas = entrada.getValue();
            // Primero lo que pide atencion, y dentro de eso lo mas antiguo:
            // el tablero se lee de arriba abajo y arriba debe estar lo urgente.
            tarjetas.sort((a, b) -> {
                int porAtencion = Boolean.compare(b.necesitaAtencion(), a.necesitaAtencion());
                if (porAtencion != 0) return porAtencion;
                int diasA = a.diasSinContacto() == null ? Integer.MAX_VALUE : a.diasSinContacto();
                int diasB = b.diasSinContacto() == null ? Integer.MAX_VALUE : b.diasSinContacto();
                return Integer.compare(diasB, diasA);
            });
            columnas.add(new Columna(
                    entrada.getKey(),
                    tarjetas.size(),
                    (int) tarjetas.stream().filter(TarjetaTablero::necesitaAtencion).count(),
                    tarjetas));
        }

        return new Tablero(estudiantes.size(), columnas);
    }

    /** Para una tarjeta suelta: pide lo suyo y delega. */
    private TarjetaTablero tarjetaDe(Estudiante estudiante, LocalDate hoy) {
        return tarjetaDe(estudiante, hoy,
                seguimientoRepository.findByEstudianteIdOrderByFechaDesc(estudiante.getId()),
                matchRepository.countByEstudianteIdAndPostuladoTrue(estudiante.getId()),
                null);
    }

    /**
     * La tarjeta, con lo que ya se trajo por su cuenta.
     *
     * <p>El historial y el conteo llegan de fuera para que el tablero pueda
     * traerlos de toda la cohorte en dos consultas. Armar la tarjeta no cambia:
     * lo unico distinto es quien pide los datos.
     */
    private TarjetaTablero tarjetaDe(Estudiante estudiante, LocalDate hoy,
                                     List<Seguimiento> historial, long postulados,
                                     com.novacrm.pipeline.PipelineEmpleabilidad pipelineCalculado) {
        // Con la ficha, no con su identificador: la version por identificador
        // la vuelve a buscar, y aqui ya la tenemos leida.
        var pipeline = pipelineCalculado != null
                ? pipelineCalculado
                : pipelineService.calcular(estudiante);

        return new TarjetaTablero(
                estudiante.getId(),
                nombreCompleto(estudiante),
                estudiante.getEmail(),
                pipeline.etapa(),
                pipeline.porcentajeAvance(),
                EstadoDeContactoActual.de(historial),
                (int) postulados,
                EstadoDeContactoActual.accionesRegistradas(historial),
                EstadoDeContactoActual.fechaUltimoContacto(historial).orElse(null),
                EstadoDeContactoActual.diasSinContacto(historial, hoy),
                pipeline.proximaAccion());
    }

    /**
     * Mueve una tarjeta de columna.
     *
     * <p><strong>Escribe un movimiento nuevo; no edita el anterior.</strong> El
     * estado actual es el del ultimo registro, asi que mover la tarjeta deja el
     * rastro de quien la movio y cuando sin necesidad de una tabla de auditoria
     * aparte. Rehacer el recorrido de un estudiante es leer su historial.
     */
    @Transactional
    public TarjetaTablero mover(UUID estudianteId, EstadoContacto nuevoEstado,
                                String responsable, String observacion) {
        var estudiante = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));

        if (nuevoEstado == null) {
            throw new BusinessException("Falta el estado al que se mueve la tarjeta");
        }

        // Soltar la tarjeta donde ya estaba no es un movimiento.
        //
        // Como aqui se escribe un registro nuevo y el estado actual es el del
        // ultimo, sin esto cada vez que alguien suelta la tarjeta donde la
        // cogio se apunta un movimiento a la misma columna. Ese historial es lo
        // que lee el equipo para entender que ha pasado con la persona, y se
        // llenaba de lineas que no cuentan nada.
        //
        // La comprobacion estaba solo en la pantalla, que es el sitio
        // equivocado para una regla: el asistente tambien mueve tarjetas, y
        // cualquier cliente futuro tambien.
        //
        // Con observacion si se apunta, aunque la columna no cambie: entonces
        // lo que se registra es la nota, y descartarla por no haber cambio de
        // columna seria tirar lo unico que traia informacion.
        boolean sinNota = observacion == null || observacion.isBlank();
        var historialPrevio = seguimientoRepository.findByEstudianteIdOrderByFechaDesc(estudianteId);
        if (sinNota && EstadoDeContactoActual.de(historialPrevio) == nuevoEstado) {
            return tarjetaDe(estudiante, LocalDate.now());
        }

        var movimiento = new Seguimiento();
        movimiento.setEstudiante(estudiante);
        movimiento.setTipo(EstadoContacto.TIPO);
        movimiento.setEstado(nuevoEstado.name());
        movimiento.setFecha(LocalDate.now());
        movimiento.setResponsable(responsable);
        movimiento.setObservacion(observacion);
        seguimientoRepository.save(movimiento);

        return tarjetaDe(estudiante, LocalDate.now());
    }

    /**
     * El historial de un estudiante, para el panel expandido.
     *
     * <p>Devuelve DTO y no la entidad. Serializar {@code Seguimiento} arrastra
     * su {@code Estudiante} —nombre, documento, celular— por un endpoint que
     * solo necesita fecha, tipo y nota; y ademas revienta con el proxy lazy de
     * Hibernate cuando la sesion ya se cerro.
     */
    @Transactional(readOnly = true)
    public List<SeguimientoResponse> historial(UUID estudianteId) {
        return seguimientoRepository.findByEstudianteIdOrderByFechaDesc(estudianteId).stream()
                .map(s -> new SeguimientoResponse(
                        s.getId(),
                        s.getFecha(),
                        s.getTipo(),
                        s.getResponsable(),
                        s.getObservacion(),
                        s.getProximaAccion(),
                        s.getFechaProxima(),
                        s.getEstado(),
                        s.getCreatedAt()))
                .toList();
    }

    private static String nombreCompleto(Estudiante estudiante) {
        String nombre = estudiante.getNombre() == null ? "" : estudiante.getNombre();
        String apellido = estudiante.getApellido() == null ? "" : estudiante.getApellido();
        String completo = (nombre + " " + apellido).trim();
        return completo.isEmpty() ? "Estudiante" : completo;
    }

    /** Cuantos hay en cada estado. Para las cifras de cabecera. */
    public static Map<EstadoContacto, Integer> recuento(Tablero tablero) {
        var mapa = new EnumMap<EstadoContacto, Integer>(EstadoContacto.class);
        tablero.columnas().forEach(c -> mapa.put(c.estado(), c.total()));
        return mapa;
    }
}
