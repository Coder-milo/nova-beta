package com.novacrm.chat;

import com.novacrm.auth.OwnershipService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ChatGrupoService {

    /** Cuanta gente cabe en un grupo. Es un curso, no una lista de difusion. */
    private static final int MAXIMO_MIEMBROS = 60;

    private final ChatGrupoRepository grupoRepository;
    private final ChatGrupoMiembroRepository miembroRepository;
    private final ChatGrupoMensajeRepository mensajeRepository;
    private final EstudianteRepository estudianteRepository;
    private final OwnershipService ownershipService;

    public ChatGrupoService(ChatGrupoRepository grupoRepository,
                             ChatGrupoMiembroRepository miembroRepository,
                             ChatGrupoMensajeRepository mensajeRepository,
                             EstudianteRepository estudianteRepository,
                             OwnershipService ownershipService) {
        this.grupoRepository = grupoRepository;
        this.miembroRepository = miembroRepository;
        this.mensajeRepository = mensajeRepository;
        this.estudianteRepository = estudianteRepository;
        this.ownershipService = ownershipService;
    }

    public record GrupoResponse(
            UUID id,
            String nombre,
            String descripcion,
            String fotoUrl,
            UUID creadoPorId,
            int totalMiembros,
            Instant createdAt
    ) {}

    public record GrupoMensajeResponse(
            UUID id,
            UUID grupoId,
            UUID remitenteId,
            String remitenteNombre,
            String contenido,
            Instant createdAt,
            boolean enviadoPorMi,
            boolean editado,
            UUID enRespuestaA,
            boolean reenviado
    ) {}

    public record CrearGrupoRequest(
            String nombre,
            String descripcion,
            List<UUID> miembroIds
    ) {}

    @Transactional
    public GrupoResponse crearGrupo(CrearGrupoRequest req, Authentication auth) {
        Estudiante creador = ownershipService.obtenerEstudianteAutenticado(auth);
        String nombre = req.nombre() == null ? "" : req.nombre().trim();
        if (nombre.isBlank() || nombre.length() > 100) {
            throw new BusinessException("El nombre del grupo es obligatorio (máx 100 caracteres).");
        }

        var grupo = new ChatGrupo();
        grupo.setNombre(nombre);
        grupo.setDescripcion(req.descripcion() != null ? req.descripcion().trim() : "");
        grupo.setCreadoPor(creador);
        var guardado = grupoRepository.save(grupo);

        // Agregar al creador como Admin
        var adminMiembro = new ChatGrupoMiembro();
        adminMiembro.setGrupo(guardado);
        adminMiembro.setEstudiante(creador);
        adminMiembro.setEsAdmin(true);
        miembroRepository.save(adminMiembro);

        // Agregar miembros invitados
        if (req.miembroIds() != null) {
            if (req.miembroIds().size() > MAXIMO_MIEMBROS) {
                throw new BusinessException(
                        "Un grupo admite hasta " + MAXIMO_MIEMBROS + " personas.");
            }
            UUID miPrograma = programaDe(creador).getId();
            var yaInvitados = new java.util.HashSet<UUID>();
            for (UUID id : req.miembroIds()) {
                if (id.equals(creador.getId())) continue;
                // La misma lista puede traer el mismo id dos veces; la base lo
                // rechaza por la clave unica, pero conviene no llegar a eso.
                if (!yaInvitados.add(id)) continue;
                estudianteRepository.findById(id)
                        // Del mismo proyecto y en activo, igual que el chat de
                        // dos: si no, bastaba con conocer un id para meter en un
                        // grupo a alguien de otro proyecto, y a partir de ahi
                        // todos se leen entre si.
                        .filter(Estudiante::isActivo)
                        .filter(e -> e.getPrograma() != null
                                && e.getPrograma().getId().equals(miPrograma))
                        .ifPresent(e -> {
                            var m = new ChatGrupoMiembro();
                            m.setGrupo(guardado);
                            m.setEstudiante(e);
                            m.setEsAdmin(false);
                            miembroRepository.save(m);
                        });
            }
        }

        int total = miembroRepository.findByGrupoId(guardado.getId()).size();
        return new GrupoResponse(guardado.getId(), guardado.getNombre(), guardado.getDescripcion(),
                guardado.getFotoUrl(), creador.getId(), total, guardado.getCreatedAt());
    }

    public List<GrupoResponse> misGrupos(Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        return grupoRepository.gruposDeEstudiante(propio.getId()).stream()
                .map(g -> {
                    int total = miembroRepository.findByGrupoId(g.getId()).size();
                    return new GrupoResponse(g.getId(), g.getNombre(), g.getDescripcion(),
                            g.getFotoUrl(), g.getCreadoPor().getId(), total, g.getCreatedAt());
                }).toList();
    }

    public List<GrupoMensajeResponse> mensajesDelGrupo(UUID grupoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        if (!miembroRepository.existsByGrupoIdAndEstudianteId(grupoId, propio.getId())) {
            throw new BusinessException("No perteneces a este grupo.");
        }

        var mensajes = mensajeRepository.findByGrupoIdOrderByCreatedAtDesc(grupoId,
                org.springframework.data.domain.PageRequest.of(0, 200));
        var ordenados = new java.util.ArrayList<>(mensajes);
        java.util.Collections.reverse(ordenados);

        return ordenados.stream().map(m -> new GrupoMensajeResponse(
                m.getId(), m.getGrupo().getId(), m.getRemitente().getId(),
                nombreDe(m.getRemitente()), m.getContenido(), m.getCreatedAt(),
                m.getRemitente().getId().equals(propio.getId()),
                m.isEditado(), m.getEnRespuestaA(), m.isReenviado()
        )).toList();
    }

    @Transactional
    public GrupoMensajeResponse enviarAMensajeGrupo(UUID grupoId, String contenido, UUID enRespuestaA, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        ChatGrupo grupo = grupoRepository.findById(grupoId)
                .orElseThrow(() -> new ResourceNotFoundException("Grupo no encontrado."));
        if (!miembroRepository.existsByGrupoIdAndEstudianteId(grupoId, propio.getId())) {
            throw new BusinessException("No perteneces a este grupo.");
        }

        String texto = contenido == null ? "" : contenido.trim();
        if (texto.isBlank()) throw new BusinessException("Escribe un mensaje.");

        var mensaje = new ChatGrupoMensaje();
        mensaje.setGrupo(grupo);
        mensaje.setRemitente(propio);
        mensaje.setContenido(texto);
        mensaje.setEnRespuestaA(enRespuestaA);
        var guardado = mensajeRepository.save(mensaje);

        return new GrupoMensajeResponse(guardado.getId(), grupo.getId(), propio.getId(),
                nombreDe(propio), guardado.getContenido(), guardado.getCreatedAt(),
                true, false, enRespuestaA, false);
    }

    /**
     * Salir de un grupo.
     *
     * <p>Hasta ahora no se podia: a un grupo se entraba porque otro te metia, y
     * de ahi no habia salida. Con la posibilidad de reportar puesta la semana
     * pasada, quedarse esto sin hacer era dejar la mitad del problema.
     *
     * <p>Si se va el ultimo, el grupo se borra con sus mensajes: un grupo sin
     * nadie no lo puede volver a abrir ninguno de los dos lados, y sus mensajes
     * quedarian guardados sin que nadie pueda leerlos. Si se va el unico
     * administrador y queda gente, hereda quien lleve mas tiempo, para que no
     * quede un grupo que nadie puede administrar.
     */
    @Transactional
    public void salir(UUID grupoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        var miembro = miembroRepository.findByGrupoIdAndEstudianteId(grupoId, propio.getId())
                .orElseThrow(() -> new ResourceNotFoundException("No perteneces a este grupo."));
        miembroRepository.delete(miembro);

        var quedan = miembroRepository.findByGrupoIdOrderByCreatedAtAsc(grupoId).stream()
                .filter(m -> !m.getId().equals(miembro.getId()))
                .toList();
        if (quedan.isEmpty()) {
            grupoRepository.deleteById(grupoId);
            return;
        }
        if (quedan.stream().noneMatch(ChatGrupoMiembro::isEsAdmin)) {
            var heredero = quedan.get(0);
            heredero.setEsAdmin(true);
            miembroRepository.save(heredero);
        }
    }

    /**
     * Sacar a alguien del grupo. Solo un administrador, y no a otro
     * administrador: para eso ese administrador se sale por su cuenta.
     */
    @Transactional
    public void expulsar(UUID grupoId, UUID estudianteId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        var yo = miembroRepository.findByGrupoIdAndEstudianteId(grupoId, propio.getId())
                .orElseThrow(() -> new ResourceNotFoundException("No perteneces a este grupo."));
        if (!yo.isEsAdmin()) {
            throw new BusinessException("Solo un administrador del grupo puede sacar a alguien.");
        }
        if (estudianteId.equals(propio.getId())) {
            throw new BusinessException("Para salirte del grupo usa la opción de salir.");
        }
        var otro = miembroRepository.findByGrupoIdAndEstudianteId(grupoId, estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Esa persona no está en el grupo."));
        if (otro.isEsAdmin()) {
            throw new BusinessException("No puedes sacar a otro administrador del grupo.");
        }
        miembroRepository.delete(otro);
    }

    /** El proyecto al que pertenece alguien, o un error que se entiende. */
    private static com.novacrm.programa.Programa programaDe(Estudiante estudiante) {
        var programa = estudiante.getPrograma();
        if (programa == null) {
            throw new BusinessException("Tu cuenta aún no está asociada a un proyecto.");
        }
        return programa;
    }

    private static String nombreDe(Estudiante estudiante) {
        String nombre = ((estudiante.getNombre() == null ? "" : estudiante.getNombre()) + " "
                + (estudiante.getApellido() == null ? "" : estudiante.getApellido())).trim();
        return nombre.isBlank() ? "Estudiante CAC" : nombre;
    }
}
