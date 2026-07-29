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
        var hoy = LocalDate.now();
        var porEstado = new EnumMap<EstadoContacto, List<TarjetaTablero>>(EstadoContacto.class);
        for (var estado : EstadoContacto.values()) {
            porEstado.put(estado, new ArrayList<>());
        }

        List<Estudiante> estudiantes = estudianteRepository.findAllByActivoTrue();
        for (Estudiante estudiante : estudiantes) {
            var tarjeta = tarjetaDe(estudiante, hoy);
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

    private TarjetaTablero tarjetaDe(Estudiante estudiante, LocalDate hoy) {
        var historial = seguimientoRepository.findByEstudianteIdOrderByFechaDesc(estudiante.getId());
        var pipeline = pipelineService.calcular(estudiante.getId());

        return new TarjetaTablero(
                estudiante.getId(),
                nombreCompleto(estudiante),
                estudiante.getEmail(),
                pipeline.etapa(),
                pipeline.porcentajeAvance(),
                EstadoDeContactoActual.de(historial),
                (int) matchRepository.countByEstudianteIdAndPostuladoTrue(estudiante.getId()),
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
