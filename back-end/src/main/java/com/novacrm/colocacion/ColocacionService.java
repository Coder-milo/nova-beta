package com.novacrm.colocacion;

import com.novacrm.colocacion.dto.ColocacionDtos.ColocacionResponse;
import com.novacrm.colocacion.dto.ColocacionDtos.ConteoCanal;
import com.novacrm.colocacion.dto.ColocacionDtos.GuardarColocacion;
import com.novacrm.colocacion.dto.ColocacionDtos.ResumenColocaciones;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.estudiante.PuntajeEmpleabilidad;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.postulacion.EstadoPostulacion;
import com.novacrm.postulacion.PostulacionRepository;
import com.novacrm.seguimiento.EstadoContacto;
import com.novacrm.seguimiento.Seguimiento;
import com.novacrm.seguimiento.SeguimientoRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Colocaciones laborales.
 *
 * <p>Registrar una colocacion cierra tres cosas a la vez, y por eso vive en un
 * servicio y no en el controlador: marca la postulacion de la que salio como
 * contratada, mueve al estudiante a la columna COLOCADO del tablero y deja el
 * apunte en su historial. Hacerlo a mano en tres sitios es como la hoja acabo
 * con ocho personas colocadas y el tablero diciendo "sin iniciar" para las 104.
 */
@Service
public class ColocacionService {

    /** {@code tipo} de los apuntes que genera este modulo. */
    public static final String TIPO_SEGUIMIENTO = "COLOCACION";

    /**
     * Meta salarial del programa.
     *
     * <p>Es configuracion, no una constante: sube con el salario minimo todos
     * los años. Por eso la diferencia contra la meta se calcula al leer y no se
     * guarda en la fila; si se guardara, subir la meta dejaria historico que
     * miente.
     */
    private final BigDecimal metaSalarial;

    private final ColocacionRepository colocacionRepository;
    private final EstudianteRepository estudianteRepository;
    private final PostulacionRepository postulacionRepository;
    private final EmpresaRepository empresaRepository;
    private final SeguimientoRepository seguimientoRepository;
    private final com.novacrm.auditoria.AuditoriaService auditoriaService;

    public ColocacionService(ColocacionRepository colocacionRepository,
                             EstudianteRepository estudianteRepository,
                             PostulacionRepository postulacionRepository,
                             EmpresaRepository empresaRepository,
                             SeguimientoRepository seguimientoRepository,
                             com.novacrm.auditoria.AuditoriaService auditoriaService,
                             @Value("${app.colocacion.meta-salarial:2276176}") BigDecimal metaSalarial) {
        this.colocacionRepository = colocacionRepository;
        this.estudianteRepository = estudianteRepository;
        this.postulacionRepository = postulacionRepository;
        this.empresaRepository = empresaRepository;
        this.seguimientoRepository = seguimientoRepository;
        this.auditoriaService = auditoriaService;
        this.metaSalarial = metaSalarial;
    }

    public BigDecimal getMetaSalarial() {
        return metaSalarial;
    }

    // ── Alta y edicion ──────────────────────────────────────────────────────

    @Transactional
    public ColocacionResponse registrar(GuardarColocacion datos, String autor) {
        var estudiante = estudianteRepository.findById(datos.estudianteId())
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado"));

        var colocacion = new Colocacion();
        colocacion.setEstudiante(estudiante);
        aplicar(colocacion, datos);

        if (datos.postulacionId() != null) {
            var postulacion = postulacionRepository.findById(datos.postulacionId())
                    .orElseThrow(() -> new ResourceNotFoundException("Postulacion no encontrada"));
            colocacion.setPostulacion(postulacion);
            // La postulacion de la que salio queda contratada sin que nadie
            // tenga que acordarse de cerrarla a mano.
            if (postulacion.getEstado() != EstadoPostulacion.CONTRATADO) {
                postulacion.moverA(EstadoPostulacion.CONTRATADO, LocalDate.now());
                postulacionRepository.save(postulacion);
            }
        }

        var guardada = colocacionRepository.save(colocacion);
        anotar(guardada, autor, "Colocacion registrada en " + guardada.nombreEmpresa()
                + (guardada.getCargo() == null ? "" : " como " + guardada.getCargo()) + ".");
        moverTableroAColocado(guardada, autor);

        return aResponse(guardada);
    }

    @Transactional
    public ColocacionResponse actualizar(UUID id, GuardarColocacion datos, String autor) {
        var colocacion = obtener(id);
        aplicar(colocacion, datos);
        return aResponse(colocacionRepository.save(colocacion));
    }

    /**
     * Cierra una colocacion sin borrarla.
     *
     * <p>Alguien que deja el empleo no borra el hecho de que lo tuvo: que la
     * retencion en el primer trabajo sea baja es un hallazgo del programa, no
     * un error de datos.
     */
    @Transactional
    public void cerrar(UUID id, String motivo, String autor) {
        var colocacion = obtener(id);
        colocacion.setActiva(false);
        if (motivo != null && !motivo.isBlank()) {
            String previo = colocacion.getObservaciones() == null ? "" : colocacion.getObservaciones() + "\n";
            colocacion.setObservaciones(previo + "Cierre: " + motivo.trim());
        }
        colocacionRepository.save(colocacion);
        anotar(colocacion, autor, "Colocacion cerrada en " + colocacion.nombreEmpresa()
                + (motivo == null || motivo.isBlank() ? "." : ": " + motivo.trim()));
    }

    @Transactional
    public void eliminar(UUID id, String autor) {
        var colocacion = obtener(id);
        // Si la colocacion salio de una postulacion, esa postulacion quedo
        // marcada CONTRATADO al crearla. Borrarla sin tocar el estado dejaba
        // un CONTRATADO huerfano en el historial del estudiante.
        if (colocacion.getPostulacion() != null
                && colocacion.getPostulacion().getEstado() == EstadoPostulacion.CONTRATADO) {
            colocacion.getPostulacion().moverA(EstadoPostulacion.EN_PROCESO, LocalDate.now());
            postulacionRepository.save(colocacion.getPostulacion());
        }
        colocacionRepository.delete(colocacion);
        String nombreEstudiante = colocacion.getEstudiante() != null ? (colocacion.getEstudiante().getNombre() + " " + colocacion.getEstudiante().getApellido()) : "Estudiante";
        auditoriaService.registrar("Colocaciones", "Eliminación", "Colocacion",
                id.toString(), nombreEstudiante + " - " + colocacion.nombreEmpresa(), null, null);
    }

    private void aplicar(Colocacion colocacion, GuardarColocacion d) {
        colocacion.setEmpresaNombre(d.empresaNombre().trim());
        empresaRepository.findByNombreIgnoreCaseActiva(colocacion.getEmpresaNombre())
                .ifPresent(colocacion::setEmpresa);
        colocacion.setCargo(d.cargo());
        colocacion.setTipoVinculacion(
                d.tipoVinculacion() == null ? TipoVinculacion.EMPLEADO : d.tipoVinculacion());
        colocacion.setFechaInicio(d.fechaInicio());
        colocacion.setCanalConsecucion(d.canalConsecucion());
        colocacion.setSalario(d.salario());
        colocacion.setBonificaciones(d.bonificaciones());
        colocacion.setModalidad(d.modalidad());
        colocacion.setTipoContrato(d.tipoContrato());
        colocacion.setObservaciones(d.observaciones());

        var chk = colocacion.getChecklist();
        chk.setContrato(d.chkContrato());
        chk.setVerificacionVacante(d.chkVerificacionVacante());
        chk.setBenchmark(d.chkBenchmark());
        chk.setReglamentoInterno(d.chkReglamentoInterno());
        chk.setColillaPago(d.chkColillaPago());
    }

    // ── Consulta ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Colocacion obtener(UUID id) {
        return colocacionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Colocacion no encontrada"));
    }

    @Transactional(readOnly = true)
    public List<ColocacionResponse> vigentes() {
        return colocacionRepository.vigentes().stream().map(this::aResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ColocacionResponse> deEstudiante(UUID estudianteId) {
        return colocacionRepository.findByEstudianteIdOrderByFechaInicioDesc(estudianteId)
                .stream().map(this::aResponse).toList();
    }

    @Transactional(readOnly = true)
    public ResumenColocaciones resumen() {
        var vigentes = colocacionRepository.vigentes();
        long sobreMeta = vigentes.stream().filter(c -> c.getSalario() != null && c.superaMeta(metaSalarial)).count();
        long conSalario = vigentes.stream().filter(c -> c.getSalario() != null).count();

        var porCanal = colocacionRepository.recuentoPorCanal().stream()
                .map(fila -> {
                    var canal = (CanalConsecucion) fila[0];
                    return new ConteoCanal(
                            canal == null ? "SIN_DATO" : canal.name(),
                            canal == null ? "Sin registrar" : canal.getEtiqueta(),
                            (Long) fila[1]);
                })
                .toList();

        return new ResumenColocaciones(
                vigentes.size(),
                sobreMeta,
                conSalario - sobreMeta,
                vigentes.stream().filter(c -> c.getCanalConsecucion() != null
                        && c.getCanalConsecucion().esGestionadaPorElPrograma()).count(),
                vigentes.stream().filter(c -> c.getCanalConsecucion() == CanalConsecucion.AUTOGESTIONADO).count(),
                metaSalarial,
                colocacionRepository.salarioPromedio(),
                vigentes.stream().filter(c -> c.getChecklist().completo()).count(),
                porCanal);
    }

    // ── Propagacion ─────────────────────────────────────────────────────────

    private void anotar(Colocacion colocacion, String autor, String texto) {
        var apunte = new Seguimiento();
        apunte.setEstudiante(colocacion.getEstudiante());
        apunte.setTipo(TIPO_SEGUIMIENTO);
        apunte.setFecha(LocalDate.now());
        apunte.setResponsable(autor);
        apunte.setObservacion(texto);
        apunte.setEstado(colocacion.isActiva() ? "COLOCADO" : "CERRADO");
        seguimientoRepository.save(apunte);
    }

    /**
     * Lleva la tarjeta a COLOCADO.
     *
     * <p>Aqui si se mueve siempre, sin las reservas de
     * {@code AvanceDelTablero}: una colocacion la registra el equipo con
     * contrato delante, no es una postulacion que alguien dice haber ganado.
     */
    private void moverTableroAColocado(Colocacion colocacion, String autor) {
        if (!colocacion.getTipoVinculacion().esEmpleo()) {
            return;
        }
        var movimiento = new Seguimiento();
        movimiento.setEstudiante(colocacion.getEstudiante());
        movimiento.setTipo(EstadoContacto.TIPO);
        movimiento.setEstado(EstadoContacto.COLOCADO.name());
        movimiento.setFecha(LocalDate.now());
        movimiento.setResponsable(autor);
        movimiento.setObservacion("Colocado en " + colocacion.nombreEmpresa() + ".");
        seguimientoRepository.save(movimiento);
    }

    // ── Mapeo ───────────────────────────────────────────────────────────────

    private ColocacionResponse aResponse(Colocacion c) {
        var estudiante = c.getEstudiante();
        var chk = c.getChecklist();
        return new ColocacionResponse(
                c.getId(),
                estudiante.getId(),
                nombreDe(estudiante),
                estudiante.getSectorObjetivo(),
                estudiante.getNivelIngles() == null ? null : estudiante.getNivelIngles().getCodigo(),
                PuntajeEmpleabilidad.porcentaje(estudiante.getPreparacion(), true),
                c.nombreEmpresa(),
                c.getCargo(),
                c.getTipoVinculacion().name(),
                c.getTipoVinculacion().getEtiqueta(),
                c.getFechaInicio(),
                c.getCanalConsecucion() == null ? null : c.getCanalConsecucion().name(),
                c.getCanalConsecucion() == null ? null : c.getCanalConsecucion().getEtiqueta(),
                c.getCanalConsecucion() != null && c.getCanalConsecucion().esGestionadaPorElPrograma(),
                c.getSalario(),
                c.diferenciaVsMeta(metaSalarial),
                c.superaMeta(metaSalarial),
                c.getBonificaciones(),
                c.getModalidad(),
                c.getTipoContrato(),
                chk.getContrato(),
                chk.getVerificacionVacante(),
                chk.getBenchmark(),
                chk.getReglamentoInterno(),
                chk.getColillaPago(),
                chk.verificados(),
                chk.total(),
                chk.resumen(),
                chk.incumplidos(),
                c.getObservaciones(),
                c.isActiva());
    }

    private static String nombreDe(Estudiante e) {
        String completo = ((e.getNombre() == null ? "" : e.getNombre()) + " "
                + (e.getApellido() == null ? "" : e.getApellido())).trim();
        return completo.isEmpty() ? "Estudiante" : completo;
    }
}
