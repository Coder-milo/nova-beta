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

    public PipelineEmpleabilidadService(EstudianteRepository estudianteRepository,
                                        HvService hvService,
                                        SeguimientoRepository seguimientoRepository,
                                        MatchRepository matchRepository) {
        this.estudianteRepository = estudianteRepository;
        this.hvService = hvService;
        this.seguimientoRepository = seguimientoRepository;
        this.matchRepository = matchRepository;
    }

    public PipelineEmpleabilidad calcular(UUID estudianteId) {
        var estudiante = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No existe el estudiante " + estudianteId));

        var hechos = new Hechos(
                hvService.tieneHvVigente(estudianteId),
                estudiante.getLinkedinUserId() != null && !estudiante.getLinkedinUserId().isBlank(),
                seguimientoRepository.existeSimulacroCompletado(estudianteId),
                matchRepository.countByEstudianteIdAndPostuladoTrue(estudianteId),
                matchRepository.contarEmpresasContactadas(estudianteId),
                estudiante.getEstadoEmpleabilidad() == EstadoEmpleabilidad.EMPLEADO);

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
