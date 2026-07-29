package com.novacrm.chat;

import com.novacrm.auth.OwnershipService;
import com.novacrm.chat.dto.ChatContactoResponse;
import com.novacrm.chat.dto.ChatDirectoMensajeResponse;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ChatDirectoService {
    private final ChatDirectoMensajeRepository repository;
    private final EstudianteRepository estudianteRepository;
    private final OwnershipService ownershipService;

    public ChatDirectoService(ChatDirectoMensajeRepository repository,
                              EstudianteRepository estudianteRepository,
                              OwnershipService ownershipService) {
        this.repository = repository;
        this.estudianteRepository = estudianteRepository;
        this.ownershipService = ownershipService;
    }

    /** Solo se muestran compañeros activos del mismo proyecto, nunca toda la base. */
    public List<ChatContactoResponse> contactos(String consulta, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        UUID programaId = programaDe(propio).getId();
        String termino = consulta == null ? "" : consulta.trim().toLowerCase(Locale.ROOT);
        if (termino.length() < 2) return List.of();

        return estudianteRepository.findAllByProgramaIdAndActivoTrue(programaId).stream()
                .filter(estudiante -> !estudiante.getId().equals(propio.getId()))
                .filter(estudiante -> nombreDe(estudiante).toLowerCase(Locale.ROOT).contains(termino))
                .sorted((a, b) -> nombreDe(a).compareToIgnoreCase(nombreDe(b)))
                .limit(20)
                .map(estudiante -> new ChatContactoResponse(estudiante.getId(), nombreDe(estudiante), estudiante.getFotoUrl()))
                .toList();
    }

    public List<ChatDirectoMensajeResponse> conversacion(UUID contactoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        Estudiante contacto = contactoDelMismoPrograma(contactoId, propio);
        return repository.conversacion(propio.getId(), contacto.getId()).stream()
                .map(mensaje -> respuesta(mensaje, propio.getId()))
                .toList();
    }

    @Transactional
    public ChatDirectoMensajeResponse enviar(UUID contactoId, String contenido, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        Estudiante contacto = contactoDelMismoPrograma(contactoId, propio);
        String texto = contenido == null ? "" : contenido.trim();
        if (texto.isBlank()) throw new BusinessException("Escribe un mensaje antes de enviarlo.");
        if (texto.length() > 5000) throw new BusinessException("El mensaje no puede superar 5000 caracteres.");

        var mensaje = new ChatDirectoMensaje();
        mensaje.setRemitente(propio);
        mensaje.setDestinatario(contacto);
        mensaje.setContenido(texto);
        return respuesta(repository.save(mensaje), propio.getId());
    }

    private Estudiante contactoDelMismoPrograma(UUID contactoId, Estudiante propio) {
        if (contactoId.equals(propio.getId())) {
            throw new BusinessException("No puedes abrir un chat contigo mismo.");
        }
        Estudiante contacto = estudianteRepository.findById(contactoId)
                .orElseThrow(() -> new ResourceNotFoundException("Compañero no encontrado."));
        if (!contacto.isActivo() || !programaDe(contacto).getId().equals(programaDe(propio).getId())) {
            throw new ResourceNotFoundException("Compañero no encontrado.");
        }
        return contacto;
    }

    private static com.novacrm.programa.Programa programaDe(Estudiante estudiante) {
        if (estudiante.getPrograma() == null) {
            throw new BusinessException("Tu ficha no está asociada a un proyecto.");
        }
        return estudiante.getPrograma();
    }

    private static String nombreDe(Estudiante estudiante) {
        String nombre = ((estudiante.getNombre() == null ? "" : estudiante.getNombre()) + " "
                + (estudiante.getApellido() == null ? "" : estudiante.getApellido())).trim();
        return nombre.isBlank() ? "Estudiante CAC" : nombre;
    }

    private static ChatDirectoMensajeResponse respuesta(ChatDirectoMensaje mensaje, UUID propioId) {
        return new ChatDirectoMensajeResponse(mensaje.getId(), mensaje.getRemitente().getId(),
                nombreDe(mensaje.getRemitente()), mensaje.getContenido(), mensaje.getCreatedAt(),
                mensaje.getRemitente().getId().equals(propioId));
    }
}
