package com.novacrm.empresa.portal;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.exception.BusinessException;
import com.novacrm.habilidad.EstudianteHabilidadRepository;
import com.novacrm.postulacion.EstadoPostulacion;
import com.novacrm.postulacion.ModalidadEntrevista;
import com.novacrm.postulacion.Postulacion;
import com.novacrm.postulacion.PostulacionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Los postulantes a las vacantes de una empresa.
 *
 * <p>La empresa no consulta estudiantes: consulta <em>candidaturas a sus
 * propias vacantes</em>. La diferencia no es de redaccion. Con un buscador de
 * estudiantes habria que decidir en cada consulta a quien puede ver, y esa
 * decision repetida es donde aparecen los fallos; aqui el conjunto visible sale
 * solo de las vacantes que ella misma publico.
 */
@Service
public class PortalPostulanteService {

    /**
     * Estados que la empresa puede poner.
     *
     * <p>Deliberadamente no incluye {@code CONTRATADO}. Que una empresa lo
     * marque es una noticia, no un hecho verificado: la colocacion —con
     * contrato, salario y checklist— la registra el equipo, y de ella salen las
     * cifras que se reportan al cierre de cohorte. Es la misma razon por la que
     * {@code EstadoPostulacion.requiereConfirmacionDelEquipo()} ya existia para
     * los estudiantes.
     */
    private static final Set<EstadoPostulacion> MOVIMIENTOS_PERMITIDOS = Set.of(
            EstadoPostulacion.EN_PROCESO,
            EstadoPostulacion.ENTREVISTA_AGENDADA,
            EstadoPostulacion.ENTREVISTA_REALIZADA,
            EstadoPostulacion.RECHAZADO);

    private final PostulacionRepository postulacionRepository;
    private final EstudianteHabilidadRepository habilidadRepository;
    private final AccesoDelPortal acceso;

    public PortalPostulanteService(PostulacionRepository postulacionRepository,
                                   EstudianteHabilidadRepository habilidadRepository,
                                   AccesoDelPortal acceso) {
        this.postulacionRepository = postulacionRepository;
        this.habilidadRepository = habilidadRepository;
        this.acceso = acceso;
    }

    /** Quienes se postularon a una vacante concreta de la empresa. */
    @Transactional(readOnly = true)
    public List<PerfilLaboralDto> deVacante(UUID vacanteId, UUID empresaId) {
        acceso.exigirVacantePropia(vacanteId, empresaId);

        var postulaciones = postulacionRepository.findByVacanteIdOrderByFechaPostulacionDesc(vacanteId);
        return conHabilidades(postulaciones);
    }

    /** Todos los postulantes de la empresa, de todas sus vacantes. */
    @Transactional(readOnly = true)
    public List<PerfilLaboralDto> todos(UUID empresaId) {
        var postulaciones = postulacionRepository.findParaEmpresa(empresaId);
        return conHabilidades(postulaciones);
    }

    /**
     * Mueve el estado de una postulacion desde el lado de la empresa.
     *
     * <p>El comentario del resultado lo escribe la empresa y lo lee el equipo:
     * es lo que convierte un «Rechazado» en informacion aprovechable para
     * preparar al siguiente candidato.
     */
    @Transactional
    public PerfilLaboralDto mover(UUID postulacionId, UUID empresaId,
                                  EstadoPostulacion nuevo, String comentario) {
        Postulacion postulacion = acceso.exigirPostulacionPropia(postulacionId, empresaId);

        if (nuevo == null || !MOVIMIENTOS_PERMITIDOS.contains(nuevo)) {
            throw new BusinessException(
                    "La empresa no puede mover la postulacion a ese estado. "
                    + "La contratacion la confirma el equipo del programa.");
        }
        if (postulacion.getEstado().esFinal()) {
            throw new BusinessException("Esta postulacion ya esta cerrada");
        }

        postulacion.moverA(nuevo, LocalDate.now());
        if (comentario != null && !comentario.isBlank()) {
            postulacion.setResultado(comentario.trim());
        }
        return aPerfil(postulacionRepository.save(postulacion), habilidadesDe(postulacion));
    }

    /** Lo que la empresa manda al agendar. Sin estado: agendar ya lo implica. */
    public record CitaDeLaEmpresa(
            java.time.LocalDateTime fechaHoraEntrevista,
            ModalidadEntrevista modalidad,
            String lugar,
            String contactoNombre,
            String contactoTelefono,
            Boolean cancelar) {}

    /**
     * La empresa pone, mueve o cancela la cita de una de sus candidaturas.
     *
     * <p>Va por su propio metodo y no como un campo mas de {@link #mover}
     * porque agendar <em>es</em> el movimiento: quien pone fecha esta diciendo
     * que cita, y pedirle ademas que elija el estado en un desplegable es
     * pedirle que repita lo que acaba de hacer. El estado lo deduce
     * {@code alinearEstadoConLaCita} del lado del dominio.
     *
     * <p>El correo del contacto no se toca desde aqui: quien agenda es la
     * empresa y su correo ya lo tiene el sistema por la cuenta con la que
     * entro. Pedirlo otra vez invita a escribir uno distinto y a que el equipo
     * acabe con dos direcciones para el mismo interlocutor.
     */
    @Transactional
    public PerfilLaboralDto agendar(UUID postulacionId, UUID empresaId, CitaDeLaEmpresa datos) {
        Postulacion postulacion = acceso.exigirPostulacionPropia(postulacionId, empresaId);

        if (Boolean.TRUE.equals(datos.cancelar())) {
            postulacion.setFechaHoraEntrevista(null);
            postulacion.setModalidadEntrevista(null);
            postulacion.setLugarEntrevista(null);
            // El estado no vuelve atras solo: que se cancele una cita no
            // significa que el proceso muera, y decidirlo por la empresa
            // borraria un rechazo o una entrevista ya hecha.
            return aPerfil(postulacionRepository.save(postulacion), habilidadesDe(postulacion));
        }

        if (datos.fechaHoraEntrevista() == null) {
            throw new BusinessException("Falta la fecha y la hora de la entrevista");
        }
        if (datos.fechaHoraEntrevista().isBefore(java.time.LocalDateTime.now())) {
            throw new BusinessException("Esa fecha ya paso");
        }
        if (postulacion.getEstado().esFinal()) {
            throw new BusinessException("Esta postulacion ya esta cerrada");
        }

        postulacion.setFechaHoraEntrevista(datos.fechaHoraEntrevista());
        postulacion.setModalidadEntrevista(datos.modalidad());
        postulacion.setLugarEntrevista(recortar(datos.lugar()));
        if (datos.contactoNombre() != null) postulacion.setContactoNombre(recortar(datos.contactoNombre()));
        if (datos.contactoTelefono() != null) postulacion.setContactoTelefono(recortar(datos.contactoTelefono()));

        if (postulacion.getEstado() == EstadoPostulacion.ENVIADA
                || postulacion.getEstado() == EstadoPostulacion.EN_PROCESO) {
            postulacion.moverA(EstadoPostulacion.ENTREVISTA_AGENDADA, LocalDate.now());
        }

        return aPerfil(postulacionRepository.save(postulacion), habilidadesDe(postulacion));
    }

    // ── Interno ─────────────────────────────────────────────────────────────

    private static String recortar(String s) {
        if (s == null) return null;
        String limpio = s.trim();
        return limpio.isEmpty() ? null : limpio;
    }

    /**
     * Trae las habilidades de todos los postulantes en una sola consulta.
     *
     * <p>Con una consulta por fila, una vacante con cuarenta candidatos son
     * cuarenta viajes a la base solo para pintar unas etiquetas.
     */
    private List<PerfilLaboralDto> conHabilidades(List<Postulacion> postulaciones) {
        if (postulaciones.isEmpty()) {
            return List.of();
        }
        var idsEstudiante = postulaciones.stream()
                .map(p -> p.getEstudiante().getId())
                .distinct()
                .toList();

        Map<UUID, List<String>> porEstudiante = habilidadRepository.findByEstudianteIdIn(idsEstudiante)
                .stream()
                .filter(eh -> eh.getHabilidad() != null && eh.getHabilidad().getNombre() != null)
                .collect(Collectors.groupingBy(
                        eh -> eh.getEstudiante().getId(),
                        Collectors.mapping(eh -> eh.getHabilidad().getNombre(),
                                Collectors.toList())));

        return postulaciones.stream()
                .map(p -> aPerfil(p, porEstudiante.getOrDefault(p.getEstudiante().getId(), List.of())))
                .sorted(Comparator.comparing(PerfilLaboralDto::fechaPostulacion,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private List<String> habilidadesDe(Postulacion p) {
        return habilidadRepository.findByEstudianteId(p.getEstudiante().getId())
                .stream()
                .filter(eh -> eh.getHabilidad() != null && eh.getHabilidad().getNombre() != null)
                .map(eh -> eh.getHabilidad().getNombre())
                .toList();
    }

    /**
     * Traduce una postulacion a lo que la empresa puede ver.
     *
     * <p>Este metodo es el unico sitio del sistema donde datos de un estudiante
     * cruzan hacia fuera de la institucion. Cada campo que se añada aqui sale
     * al portal; si no esta claro que una empresa deba verlo, no se pone.
     */
    private PerfilLaboralDto aPerfil(Postulacion p, List<String> habilidades) {
        Estudiante e = p.getEstudiante();

        String nombre = ((e.getNombre() == null ? "" : e.getNombre()) + " "
                + (e.getApellido() == null ? "" : e.getApellido())).trim();

        ModalidadEntrevista modalidad = p.getModalidadEntrevista();

        return new PerfilLaboralDto(
                p.getId(),
                nombre.isEmpty() ? "Candidato" : nombre,
                e.getPrograma() == null ? null : e.getPrograma().getNombre(),
                e.getCiudad(),
                e.getTitulo(),
                e.getPerfilProfesional(),
                e.getUltimoCargo(),
                e.getSectorExperiencia(),
                e.getAniosExperiencia(),
                e.getNivelIngles() == null ? null : e.getNivelIngles().getNombre(),
                habilidades,
                e.getDisponibilidadMovilidad(),
                p.getFechaPostulacion(),
                p.getCargo(),
                p.getEstado().name(),
                p.getEstado().getEtiqueta(),
                p.getFechaHoraEntrevista(),
                modalidad == null ? null : modalidad.getEtiqueta());
    }
}
