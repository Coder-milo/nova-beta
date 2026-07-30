package com.novacrm.postulacion;

import com.novacrm.colocacion.ColocacionRepository;
import com.novacrm.empresa.Empresa;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.postulacion.dto.PostulacionDtos.ActualizarPostulacion;
import com.novacrm.postulacion.dto.PostulacionDtos.CrearPostulacion;
import com.novacrm.postulacion.dto.PostulacionDtos.PostulacionResponse;
import com.novacrm.postulacion.dto.PostulacionDtos.ResumenPostulaciones;
import com.novacrm.seguimiento.EstadoContacto;
import com.novacrm.seguimiento.EstadoDeContactoActual;
import com.novacrm.seguimiento.Seguimiento;
import com.novacrm.seguimiento.SeguimientoRepository;
import com.novacrm.vacante.VacanteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Postulaciones y su llegada al seguimiento.
 *
 * <p>Lo que justifica este servicio no es guardar filas, es la propagacion:
 * <strong>cada cambio de estado escribe en el historial de seguimiento</strong>,
 * de forma que lo que el estudiante actualiza desde su cuenta aparece en el
 * tablero del equipo sin que nadie lo transcriba. Esa transcripcion manual es
 * lo que hacia que la hoja de calculo tuviera una sola postulacion registrada
 * mientras habia ocho personas colocadas.
 */
@Service
public class PostulacionService {

    private static final Logger log = LoggerFactory.getLogger(PostulacionService.class);

    /**
     * {@code tipo} con el que se marcan los apuntes que genera este modulo.
     *
     * <p>{@code Seguimiento.tipo} es texto libre y ya guarda SIMULACRO, LLAMADA
     * y los movimientos del tablero (CONTACTO). Con una marca propia el
     * historial se puede filtrar sin tocar lo que ya existe.
     */
    public static final String TIPO_SEGUIMIENTO = "POSTULACION";

    private final PostulacionRepository postulacionRepository;
    private final EstudianteRepository estudianteRepository;
    private final VacanteRepository vacanteRepository;
    private final EmpresaRepository empresaRepository;
    private final SeguimientoRepository seguimientoRepository;
    private final ColocacionRepository colocacionRepository;

    public PostulacionService(PostulacionRepository postulacionRepository,
                              EstudianteRepository estudianteRepository,
                              VacanteRepository vacanteRepository,
                              EmpresaRepository empresaRepository,
                              SeguimientoRepository seguimientoRepository,
                              ColocacionRepository colocacionRepository) {
        this.postulacionRepository = postulacionRepository;
        this.estudianteRepository = estudianteRepository;
        this.vacanteRepository = vacanteRepository;
        this.empresaRepository = empresaRepository;
        this.seguimientoRepository = seguimientoRepository;
        this.colocacionRepository = colocacionRepository;
    }

    // ── Alta ────────────────────────────────────────────────────────────────

    @Transactional
    public PostulacionResponse crear(UUID estudianteId, CrearPostulacion datos,
                                     String autor, boolean laRegistraElEstudiante) {
        Estudiante estudiante = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));

        var postulacion = new Postulacion();
        postulacion.setEstudiante(estudiante);
        postulacion.setEmpresaNombre(datos.empresaNombre().trim());
        postulacion.setCargo(datos.cargo().trim());
        postulacion.setCanal(vacio(datos.canal()) ? null : datos.canal().trim());
        LocalDate fecha = datos.fechaPostulacion() == null ? LocalDate.now() : datos.fechaPostulacion();
        if (fecha.isAfter(LocalDate.now())) {
            fecha = LocalDate.now();
        }
        postulacion.setFechaPostulacion(fecha);
        postulacion.setEstado(datos.estado() == null ? EstadoPostulacion.ENVIADA : datos.estado());
        postulacion.setObservaciones(datos.observaciones());
        postulacion.setUrlOferta(vacio(datos.urlOferta()) ? null : datos.urlOferta().trim());
        postulacion.setGestionadaPor(autor);
        postulacion.setRegistradaPorEstudiante(laRegistraElEstudiante);

        if (datos.vacanteId() != null) {
            var vacante = vacanteRepository.findById(datos.vacanteId())
                    .orElseThrow(() -> new ResourceNotFoundException("Vacante no encontrada"));
            postulacionRepository.findByEstudianteIdAndVacanteId(estudianteId, vacante.getId())
                    .ifPresent(existente -> {
                        throw new BusinessException("Ya hay una postulacion registrada a esta vacante");
                    });
            postulacion.setVacante(vacante);
            if (vacante.getEmpresa() != null) {
                postulacion.setEmpresa(vacante.getEmpresa());
            }
            if (postulacion.getUrlOferta() == null) {
                postulacion.setUrlOferta(vacante.getUrlAplicar() != null
                        ? vacante.getUrlAplicar() : vacante.getUrlOrigen());
            }
        }
        if (postulacion.getEmpresa() == null) {
            empresaRepository.findByNombreIgnoreCase(postulacion.getEmpresaNombre())
                    .ifPresent(postulacion::setEmpresa);
        }

        var guardada = postulacionRepository.save(postulacion);

        registrarEnSeguimiento(guardada, autor,
                "Postulacion registrada en " + guardada.nombreEmpresa()
                        + " para " + guardada.getCargo() + ".");
        propagarAlTablero(guardada, autor);

        return aResponse(guardada);
    }

    // ── Actualizacion del seguimiento ───────────────────────────────────────

    /**
     * Actualiza una postulacion y deja constancia en el historial.
     *
     * <p>Solo se escribe apunte de seguimiento si el estado <em>cambio</em>.
     * Corregir una falta de ortografia en la observacion no es un hito y llenar
     * el historial de ruido es la forma de que nadie vuelva a leerlo.
     */
    @Transactional
    public PostulacionResponse actualizar(UUID postulacionId, ActualizarPostulacion cambios, String autor) {
        var postulacion = obtener(postulacionId);
        var anterior = postulacion.getEstado();

        if (cambios.canal() != null) {
            postulacion.setCanal(cambios.canal().isBlank() ? null : cambios.canal().trim());
        }
        if (cambios.resultado() != null) {
            postulacion.setResultado(cambios.resultado());
        }
        if (cambios.observaciones() != null) {
            postulacion.setObservaciones(cambios.observaciones());
        }
        if (cambios.fechaRespuesta() != null) {
            postulacion.setFechaRespuesta(cambios.fechaRespuesta());
        }

        boolean cambioDeEstado = cambios.estado() != null && cambios.estado() != anterior;
        if (cambioDeEstado) {
            postulacion.moverA(cambios.estado(), LocalDate.now());
        }

        var guardada = postulacionRepository.save(postulacion);

        if (cambioDeEstado) {
            registrarEnSeguimiento(guardada, autor, textoDelCambio(guardada, anterior, cambios));
            propagarAlTablero(guardada, autor);
            if (guardada.getEstado().requiereConfirmacionDelEquipo()) {
                log.info("Postulacion {} marcada como CONTRATADO por {}; falta registrar la colocacion",
                        guardada.getId(), autor);
            }
        }
        return aResponse(guardada);
    }

    @Transactional
    public void eliminar(UUID postulacionId) {
        var postulacion = obtener(postulacionId);
        postulacionRepository.delete(postulacion);
    }

    // ── Consulta ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PostulacionResponse> deEstudiante(UUID estudianteId) {
        return postulacionRepository.findByEstudianteIdOrderByFechaPostulacionDesc(estudianteId)
                .stream().map(this::aResponse).toList();
    }

    @Transactional(readOnly = true)
    public ResumenPostulaciones resumen(UUID estudianteId) {
        var lista = postulacionRepository.findByEstudianteIdOrderByFechaPostulacionDesc(estudianteId);
        return new ResumenPostulaciones(
                lista.size(),
                lista.stream().filter(p -> !p.getEstado().esFinal()).count(),
                lista.stream().filter(p -> p.getFechaRespuesta() != null).count(),
                lista.stream().filter(p -> p.getEstado() == EstadoPostulacion.ENTREVISTA_AGENDADA
                        || p.getEstado() == EstadoPostulacion.ENTREVISTA_REALIZADA).count(),
                lista.stream().filter(p -> p.getEstado() == EstadoPostulacion.CONTRATADO).count(),
                lista.stream().filter(p -> p.getEstado() == EstadoPostulacion.SIN_RESPUESTA).count());
    }

    @Transactional(readOnly = true)
    public Postulacion obtener(UUID id) {
        return postulacionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Postulacion no encontrada"));
    }

    /** Las que alguien marco como contratado y el equipo aun no ha verificado. */
    @Transactional(readOnly = true)
    public List<PostulacionResponse> pendientesDeConfirmar() {
        return postulacionRepository.contratadasSinColocacion().stream().map(this::aResponse).toList();
    }

    // ── Propagacion al seguimiento ──────────────────────────────────────────

    /** Apunte en el historial. Siempre; es el rastro de lo que paso. */
    private void registrarEnSeguimiento(Postulacion postulacion, String autor, String texto) {
        var apunte = new Seguimiento();
        apunte.setEstudiante(postulacion.getEstudiante());
        apunte.setTipo(TIPO_SEGUIMIENTO);
        apunte.setFecha(LocalDate.now());
        apunte.setResponsable(autor);
        apunte.setObservacion(texto);
        // El estado del apunte es el de la postulacion, no el del tablero: son
        // ejes distintos y mezclarlos haria que EstadoDeContactoActual leyera
        // "ENTREVISTA_AGENDADA" como si fuera una columna del tablero.
        apunte.setEstado(postulacion.getEstado().name());
        seguimientoRepository.save(apunte);
    }

    /**
     * Mueve la tarjeta del tablero si el cambio lo justifica.
     *
     * <p>Escribe un {@code Seguimiento} de tipo CONTACTO, que es lo que lee
     * {@code EstadoDeContactoActual}. No se toca ninguna columna de estado
     * porque no existe: el estado del estudiante es su ultimo apunte.
     */
    private void propagarAlTablero(Postulacion postulacion, String autor) {
        var historial = seguimientoRepository
                .findByEstudianteIdOrderByFechaDesc(postulacion.getEstudiante().getId());
        EstadoContacto actual = EstadoDeContactoActual.de(historial);

        AvanceDelTablero.destino(actual, postulacion.getEstado()).ifPresent(destino -> {
            var movimiento = new Seguimiento();
            movimiento.setEstudiante(postulacion.getEstudiante());
            movimiento.setTipo(EstadoContacto.TIPO);
            movimiento.setEstado(destino.name());
            movimiento.setFecha(LocalDate.now());
            movimiento.setResponsable(autor);
            movimiento.setObservacion("Movido automaticamente por la postulacion en "
                    + postulacion.nombreEmpresa() + " (" + postulacion.getEstado().getEtiqueta() + ").");
            seguimientoRepository.save(movimiento);
        });
    }

    private static String textoDelCambio(Postulacion p, EstadoPostulacion anterior,
                                         ActualizarPostulacion cambios) {
        var texto = new StringBuilder()
                .append(p.nombreEmpresa()).append(" - ").append(p.getCargo())
                .append(": ").append(anterior.getEtiqueta())
                .append(" a ").append(p.getEstado().getEtiqueta()).append('.');
        if (cambios.resultado() != null && !cambios.resultado().isBlank()) {
            texto.append(' ').append(cambios.resultado().trim());
        }
        return texto.toString();
    }

    // ── Mapeo ───────────────────────────────────────────────────────────────

    private PostulacionResponse aResponse(Postulacion p) {
        var estudiante = p.getEstudiante();
        LocalDate hoy = LocalDate.now();

        Integer diasHastaRespuesta = p.getFechaRespuesta() == null ? null
                : (int) ChronoUnit.DAYS.between(p.getFechaPostulacion(), p.getFechaRespuesta());
        Integer diasEsperando = p.getFechaRespuesta() != null || p.getEstado().esFinal() ? null
                : (int) ChronoUnit.DAYS.between(p.getFechaPostulacion(), hoy);

        boolean esperandoConfirmacion = p.getEstado().requiereConfirmacionDelEquipo()
                && !colocacionRepository.existsByEstudianteIdAndActivaTrue(estudiante.getId());

        return new PostulacionResponse(
                p.getId(),
                estudiante.getId(),
                nombreDe(estudiante),
                p.getVacante() == null ? null : p.getVacante().getId(),
                p.nombreEmpresa(),
                p.getCargo(),
                p.getCanal(),
                p.getFechaPostulacion(),
                p.getEstado().name(),
                p.getEstado().getEtiqueta(),
                p.getEstado().esFinal(),
                p.getFechaRespuesta(),
                diasHastaRespuesta,
                diasEsperando,
                p.getResultado(),
                p.getObservaciones(),
                p.getGestionadaPor(),
                p.isRegistradaPorEstudiante(),
                p.getUrlOferta(),
                esperandoConfirmacion);
    }

    private static String nombreDe(Estudiante e) {
        String nombre = e.getNombre() == null ? "" : e.getNombre();
        String apellido = e.getApellido() == null ? "" : e.getApellido();
        String completo = (nombre + " " + apellido).trim();
        return completo.isEmpty() ? "Estudiante" : completo;
    }

    private static boolean vacio(String s) {
        return s == null || s.isBlank();
    }

    /** Empresa asociada a una postulacion, para el CRM. Puede no existir. */
    public java.util.Optional<Empresa> empresaDe(Postulacion p) {
        return java.util.Optional.ofNullable(p.getEmpresa());
    }
}
