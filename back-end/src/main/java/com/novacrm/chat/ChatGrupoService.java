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
