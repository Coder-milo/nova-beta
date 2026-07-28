package com.novacrm.pipeline;

import com.novacrm.estudiante.EstadoEmpleabilidad;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.hv.HvService;
import com.novacrm.matching.MatchRepository;
import com.novacrm.seguimiento.SeguimientoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Calcula el estado de empleabilidad de un estudiante a partir de los hechos ya
 * registrados en el sistema, en lugar de leerlo de campos que alguien deba
 * mantener a mano.
 *
 * <p>Las columnas equivalentes de la hoja de calculo (HV revisada, LinkedIn
 * optimizado, simulacro, postulaciones, empresas contactadas) estaban vacias en
 * el 100% de los participantes. No es un problema de disciplina del equipo: es
 * que ese dato ya existe en otras tablas y duplicarlo a mano nunca se sostiene.
 */
@Service
@Transactional(readOnly = true)
public class PipelineEmpleabilidadService {

    private final EstudianteRepository estudianteRepository;
    private final HvService hvService;
    private final SeguimientoRepository seguimientoRepository;
    private final MatchRepository matchRepository;
    private final com.novacrm.postulacion.PostulacionRepository postulacionRepository;
    private final com.novacrm.colocacion.ColocacionRepository colocacionRepository;

    public PipelineEmpleabilidadService(EstudianteRepository estudianteRepository,
                                        HvService hvService,
                                        SeguimientoRepository seguimientoRepository,
                                        MatchRepository matchRepository,
                                        com.novacrm.postulacion.PostulacionRepository postulacionRepository,
                                        com.novacrm.colocacion.ColocacionRepository colocacionRepository) {
        this.estudianteRepository = estudianteRepository;
        this.hvService = hvService;
        this.seguimientoRepository = seguimientoRepository;
        this.matchRepository = matchRepository;
        this.postulacionRepository = postulacionRepository;
        this.colocacionRepository = colocacionRepository;
    }

    public PipelineEmpleabilidad calcular(UUID estudianteId) {
        var estudiante = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No existe el estudiante " + estudianteId));

        // Postulaciones: manda la tabla de postulaciones. Se toma el maximo
        // con los matches marcados porque quedan registros anteriores a que
        // existiera la tabla; sumarlos contaria dos veces la misma postulacion,
        // ya que marcar un match ahora crea tambien su postulacion.
        long postulaciones = Math.max(
                postulacionRepository.countByEstudianteId(estudianteId),
                matchRepository.countByEstudianteIdAndPostuladoTrue(estudianteId));

        // Colocado es tener una colocacion registrada. El enum antiguo se
        // sigue mirando porque hay fichas marcadas EMPLEADO de antes, pero es
        // el que sobra: no dice ni donde ni desde cuando.
        boolean colocado = colocacionRepository.existsByEstudianteIdAndActivaTrue(estudianteId)
                || estudiante.getEstadoEmpleabilidad() == EstadoEmpleabilidad.EMPLEADO;

        var hechos = new Hechos(
                hvService.tieneHvVigente(estudianteId),
                // Optimizado es un hito que alguien revisa, no el hecho de
                // tener el perfil vinculado. Se deducia de linkedinUserId y era
                // falso: en el programa hay 74 perfiles creados y 9 optimizados.
                estudiante.getPreparacion().getLinkedinOptimizado().cumplido(),
                seguimientoRepository.existeSimulacroCompletado(estudianteId),
                postulaciones,
                matchRepository.contarEmpresasContactadas(estudianteId),
                colocado);

        return construir(estudianteId, nombreCompleto(estudiante), hechos);
    }

    private static String nombreCompleto(Estudiante estudiante) {
        return (nullSafe(estudiante.getNombre()) + " " + nullSafe(estudiante.getApellido())).trim();
    }

    private static String nullSafe(String valor) {
        return valor == null ? "" : valor;
    }

    /**
     * Hechos verificables de los que se deduce el estado. Se extrae aparte para
     * poder ejercitar la deduccion sin base de datos.
     */
    public record Hechos(
            boolean hvGenerada,
            boolean linkedinOptimizado,
            boolean simulacroRealizado,
            long postulacionesEnviadas,
            long empresasContactadas,
            boolean empleado) {}

    /** Deduccion pura: mismos hechos, mismo resultado. */
    public static PipelineEmpleabilidad construir(UUID estudianteId, String nombreCompleto, Hechos h) {
        var etapa = deducirEtapa(h);

        var pendientes = new ArrayList<String>();
        if (!h.hvGenerada()) pendientes.add("Generar la hoja de vida");
        if (!h.linkedinOptimizado()) pendientes.add("Optimizar el perfil de LinkedIn");
        if (!h.simulacroRealizado()) pendientes.add("Realizar el simulacro de entrevista");

        int cumplidos = PipelineEmpleabilidad.TOTAL_HITOS_PREPARACION - pendientes.size();
        int porcentaje = etapa == EtapaEmpleabilidad.COLOCADO
                ? 100
                : Math.round(100f * cumplidos / PipelineEmpleabilidad.TOTAL_HITOS_PREPARACION);

        return new PipelineEmpleabilidad(
                estudianteId,
                nombreCompleto,
                h.hvGenerada(),
                h.linkedinOptimizado(),
                h.simulacroRealizado(),
                h.postulacionesEnviadas(),
                h.empresasContactadas(),
                etapa,
                porcentaje,
                List.copyOf(pendientes),
                etapa.getProximaAccion());
    }

    /**
     * El orden importa: se evalua de la etapa mas avanzada a la mas basica, de
     * modo que un estudiante ya colocado no retroceda por no tener registrado
     * el simulacro.
     */
    private static EtapaEmpleabilidad deducirEtapa(Hechos h) {
        if (h.empleado()) {
            return EtapaEmpleabilidad.COLOCADO;
        }
        if (h.postulacionesEnviadas() > 0) {
            return EtapaEmpleabilidad.POSTULANDO;
        }
        if (h.hvGenerada() && h.linkedinOptimizado() && h.simulacroRealizado()) {
            return EtapaEmpleabilidad.PREPARADO;
        }
        if (h.hvGenerada()) {
            return EtapaEmpleabilidad.PERFIL_LISTO;
        }
        return EtapaEmpleabilidad.SIN_PERFIL;
    }
}
