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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
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

    // noRollbackFor: el duplicado es un fallo esperado en una carrera de doble
    // clic, no un estado sucio. Sin esto, el catch de MatchingService traga la
    // excepcion pero la transaccion queda rollback-only y el commit revienta
    // con UnexpectedRollbackException (500) en lugar del no-op buscado.
    @Transactional(noRollbackFor = BusinessException.class)
    public PostulacionResponse crear(UUID estudianteId, CrearPostulacion datos,
                                     String autor, boolean laRegistraElEstudiante) {
        return aResponse(crearEntidad(estudianteId, datos, autor, laRegistraElEstudiante));
    }

    /**
     * Igual que {@link #crear}, devolviendo la vista del estudiante.
     *
     * <p>La misma escritura con otra salida: quien registra su propia
     * postulacion no tiene por que recibir de vuelta los campos de gestion.
     */
    @Transactional
    public com.novacrm.postulacion.dto.MiPostulacion crearPropia(UUID estudianteId,
                                                                 CrearPostulacion datos, String autor) {
        return aMiPostulacion(crearEntidad(estudianteId, datos, autor, true));
    }

    private Postulacion crearEntidad(UUID estudianteId, CrearPostulacion datos,
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
        postulacion.setUrlOferta(sanitizarUrl(datos.urlOferta()));
        postulacion.setGestionadaPor(autor);
        postulacion.setRegistradaPorEstudiante(laRegistraElEstudiante);
        postulacion.setFechaHoraEntrevista(datos.fechaHoraEntrevista());
        postulacion.setModalidadEntrevista(datos.modalidadEntrevista());
        postulacion.setLugarEntrevista(recortar(datos.lugarEntrevista()));
        postulacion.setContactoNombre(recortar(datos.contactoNombre()));
        postulacion.setContactoEmail(recortar(datos.contactoEmail()));
        postulacion.setContactoTelefono(recortar(datos.contactoTelefono()));
        postulacion.setProximoSeguimiento(datos.proximoSeguimiento());
        alinearEstadoConLaCita(postulacion);

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
                postulacion.setUrlOferta(sanitizarUrl(vacante.getUrlAplicar() != null
                        ? vacante.getUrlAplicar() : vacante.getUrlOrigen()));
            }
        }
        if (postulacion.getEmpresa() == null) {
            empresaRepository.findByNombreIgnoreCaseActiva(postulacion.getEmpresaNombre())
                    .ifPresent(postulacion::setEmpresa);
        }

        // El check de duplicado de arriba es check-then-act: dos clics a la vez
        // pasan la revision y el segundo revienta aqui con un 500 crudo por el
        // unique index. Se traduce al mismo error de negocio que el caso normal.
        final Postulacion guardada;
        try {
            guardada = postulacionRepository.save(postulacion);
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("Ya hay una postulacion registrada a esta vacante");
        }

        String origenTexto = laRegistraElEstudiante
                ? "Postulación registrada directamente por el estudiante en " + guardada.nombreEmpresa() + " para " + guardada.getCargo() + "."
                : "Postulación gestionada por coordinación (" + autor + ") en " + guardada.nombreEmpresa() + " para " + guardada.getCargo() + ".";
        if (guardada.getFechaHoraEntrevista() != null) {
            origenTexto += " Entrevista agendada para el " + guardada.getFechaHoraEntrevista().toLocalDate() + " (" + (guardada.getModalidadEntrevista() != null ? guardada.getModalidadEntrevista().getEtiqueta() : "Cita") + ").";
        }
        registrarEnSeguimiento(guardada, autor, origenTexto);
        propagarAlTablero(guardada, autor);

        return guardada;
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
        return aResponse(actualizarEntidad(postulacionId, cambios, autor));
    }

    /**
     * Igual que {@link #actualizar}, devolviendo la vista del estudiante.
     *
     * <p>Misma escritura, otra salida: cambiar de estado desde el portal no
     * tiene por que devolver los campos de gestion.
     */
    @Transactional
    public com.novacrm.postulacion.dto.MiPostulacion actualizarPropia(
            UUID postulacionId, ActualizarPostulacion cambios, String autor) {
        return aMiPostulacion(actualizarEntidad(postulacionId, cambios, autor));
    }

    private Postulacion actualizarEntidad(UUID postulacionId, ActualizarPostulacion cambios, String autor) {
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

        aplicarCita(postulacion, cambios);

        boolean cambioDeEstado = cambios.estado() != null && cambios.estado() != anterior;
        if (cambioDeEstado) {
            postulacion.moverA(cambios.estado(), LocalDate.now());
        } else {
            // Agendar la cita sin tocar el estado tambien lo mueve. Se hace solo
            // cuando el estado no venia en la peticion: si vino, manda lo que
            // pidio quien edita.
            alinearEstadoConLaCita(postulacion);
            cambioDeEstado = postulacion.getEstado() != anterior;
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
        return guardada;
    }

    // ── Tablero ─────────────────────────────────────────────────────────────

    /**
     * Las postulaciones vivas, para el tablero por estado.
     *
     * <p>Se devuelve una lista plana y no un mapa por columna. Agrupar aquí
     * obligaria a que el orden de las columnas lo fijara el backend, y el
     * tablero es una pantalla: quien decide que columnas se ven y en que orden
     * es ella, no el servidor.
     */
    public List<PostulacionResponse> paraTablero(UUID programaId) {
        return postulacionRepository.paraTablero(programaId).stream()
                .map(this::aResponse)
                .toList();
    }

    // ── Agenda ──────────────────────────────────────────────────────────────

    /**
     * Las citas de un tramo, de la primera a la ultima.
     *
     * <p>El tramo se recibe en dias y se abre a instantes de forma
     * semiabierta: desde las 00:00 del primer dia hasta las 00:00 del siguiente
     * al ultimo. Con {@code BETWEEN} sobre fechas, una entrevista a las 16:00
     * del ultimo dia del rango se quedaba fuera, que es el fallo clasico de
     * comparar marcas de tiempo contra fechas.
     */
    public List<PostulacionResponse> agenda(LocalDate desde, LocalDate hasta) {
        return postulacionRepository
                .agendaEntre(desde.atStartOfDay(), hasta.plusDays(1).atStartOfDay())
                .stream()
                .map(this::aResponse)
                .toList();
    }

    /** Citas pasadas que siguen abiertas: hay que anotar que ocurrio. */
    public List<PostulacionResponse> entrevistasSinCerrar() {
        return postulacionRepository.entrevistasSinCerrar(LocalDateTime.now())
                .stream()
                .map(this::aResponse)
                .toList();
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

    /**
     * Las postulaciones de un estudiante, como las ve él.
     *
     * <p>Recorta lo que es trabajo interno del equipo. Ver
     * {@link com.novacrm.postulacion.dto.MiPostulacion}.
     */
    @Transactional(readOnly = true)
    public List<com.novacrm.postulacion.dto.MiPostulacion> mias(UUID estudianteId) {
        return postulacionRepository.findByEstudianteIdOrderByFechaPostulacionDesc(estudianteId)
                .stream().map(this::aMiPostulacion).toList();
    }

    private com.novacrm.postulacion.dto.MiPostulacion aMiPostulacion(Postulacion p) {
        LocalDate hoy = LocalDate.now();
        Integer diasEsperando = p.getFechaRespuesta() != null || p.getEstado().esFinal() ? null
                : (int) ChronoUnit.DAYS.between(p.getFechaPostulacion(), hoy);

        boolean esperandoConfirmacion = p.getEstado().requiereConfirmacionDelEquipo()
                && !colocacionRepository.existsByEstudianteIdAndActivaTrue(p.getEstudiante().getId());

        return new com.novacrm.postulacion.dto.MiPostulacion(
                p.getId(),
                p.getVacante() == null ? null : p.getVacante().getId(),
                p.nombreEmpresa(),
                p.getCargo(),
                p.getCanal(),
                p.getFechaPostulacion(),
                p.getEstado().name(),
                p.getEstado().getEtiqueta(),
                p.getEstado().esFinal(),
                p.getFechaRespuesta(),
                diasEsperando,
                p.getResultado(),
                p.getObservaciones(),
                p.isRegistradaPorEstudiante(),
                p.getUrlOferta(),
                esperandoConfirmacion,
                p.getFechaHoraEntrevista(),
                p.getModalidadEntrevista() == null ? null : p.getModalidadEntrevista().name(),
                p.getModalidadEntrevista() == null ? null : p.getModalidadEntrevista().getEtiqueta(),
                p.getLugarEntrevista(),
                p.getContactoNombre(),
                p.getContactoTelefono(),
                p.tieneEntrevistaPendiente(),
                p.entrevistaVencidaSinCerrar(),
                p.getFechaHoraEntrevista() == null ? null
                        : ChronoUnit.HOURS.between(LocalDateTime.now(), p.getFechaHoraEntrevista()));
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

    /**
     * Deja el estado y la cita contando lo mismo.
     *
     * <p>Poner una entrevista deberia bastar para que el proceso figure como
     * agendado: hacerlo en dos pasos —fecha por un lado, estado por otro—
     * garantiza tableros donde una persona tiene la cita el jueves y aparece
     * como «Enviada». Solo sube desde los estados anteriores a la entrevista;
     * una postulacion ya rechazada o contratada no vuelve atras porque alguien
     * anote cuando fue la entrevista que ya ocurrio.
     */
    private static void alinearEstadoConLaCita(Postulacion p) {
        if (p.getFechaHoraEntrevista() == null) {
            return;
        }
        if (p.getEstado() == EstadoPostulacion.ENVIADA
                || p.getEstado() == EstadoPostulacion.EN_PROCESO) {
            p.setEstado(EstadoPostulacion.ENTREVISTA_AGENDADA);
        }
    }

    /** Aplica los datos de la cita que vengan; los nulos no tocan lo guardado. */
    private static void aplicarCita(Postulacion p, ActualizarPostulacion c) {
        if (Boolean.TRUE.equals(c.cancelarEntrevista())) {
            p.setFechaHoraEntrevista(null);
            p.setModalidadEntrevista(null);
            p.setLugarEntrevista(null);
            return;
        }
        if (c.fechaHoraEntrevista() != null) p.setFechaHoraEntrevista(c.fechaHoraEntrevista());
        if (c.modalidadEntrevista() != null) p.setModalidadEntrevista(c.modalidadEntrevista());
        if (c.lugarEntrevista() != null) p.setLugarEntrevista(recortar(c.lugarEntrevista()));
        if (c.contactoNombre() != null) p.setContactoNombre(recortar(c.contactoNombre()));
        if (c.contactoEmail() != null) p.setContactoEmail(recortar(c.contactoEmail()));
        if (c.contactoTelefono() != null) p.setContactoTelefono(recortar(c.contactoTelefono()));
        if (c.proximoSeguimiento() != null) p.setProximoSeguimiento(c.proximoSeguimiento());
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
                esperandoConfirmacion,
                p.getFechaHoraEntrevista(),
                p.getModalidadEntrevista() == null ? null : p.getModalidadEntrevista().name(),
                p.getModalidadEntrevista() == null ? null : p.getModalidadEntrevista().getEtiqueta(),
                p.getLugarEntrevista(),
                p.getContactoNombre(),
                p.getContactoEmail(),
                p.getContactoTelefono(),
                p.getProximoSeguimiento(),
                p.tieneEntrevistaPendiente(),
                p.entrevistaVencidaSinCerrar(),
                p.getFechaHoraEntrevista() == null ? null
                        : ChronoUnit.HOURS.between(LocalDateTime.now(), p.getFechaHoraEntrevista()));
    }

    /** Recorta y convierte el texto vacio en nulo, que es como se guarda «sin dato». */
    private static String recortar(String s) {
        if (s == null) return null;
        String limpio = s.trim();
        return limpio.isEmpty() ? null : limpio;
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

    private static String sanitizarUrl(String url) {
        if (vacio(url)) return null;
        String trimmed = url.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed;
        }
        if (trimmed.startsWith("www.") || trimmed.contains(".")) {
            return "https://" + trimmed;
        }
        return null;
    }

    /** Empresa asociada a una postulacion, para el CRM. Puede no existir. */
    public java.util.Optional<Empresa> empresaDe(Postulacion p) {
        return java.util.Optional.ofNullable(p.getEmpresa());
    }
}
