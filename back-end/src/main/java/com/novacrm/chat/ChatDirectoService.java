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
    /** Cuantos companeros se ofrecen al escribir. Mas de esto no se lee. */
    private static final int MAXIMO_CONTACTOS = 20;

    @Transactional(readOnly = true)
    public List<ChatContactoResponse> contactos(String consulta, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        UUID programaId = programaDe(propio).getId();
        String termino = consulta == null ? "" : consulta.trim().toLowerCase(Locale.ROOT);
        if (termino.length() < 2) return List.of();

        // La busqueda la hace la base, que es quien sabe comparar sin tildes.
        // Antes se traia el programa entero y se filtraba con `contains()`
        // sobre minusculas: escribir "jose" no encontraba a «José» ni "nunez" a
        // «Núñez», y en esta cohorte 48 de 108 nombres llevan tilde.
        return estudianteRepository.companerosQueCoinciden(programaId, propio.getId(), termino,
                        org.springframework.data.domain.PageRequest.of(0, MAXIMO_CONTACTOS)).stream()
                .map(estudiante -> new ChatContactoResponse(estudiante.getId(), nombreDe(estudiante), estudiante.getFotoUrl()))
                .toList();
    }

    /**
     * Cuantos mensajes se traen al abrir un chat.
     *
     * <p>Bastante para no cortar una conversacion en curso y acotado para que
     * abrirlo no dependa de cuanto lleven escribiendose.
     */
    private static final int MENSAJES_AL_ABRIR = 200;

    @Transactional(readOnly = true)
    public List<ChatDirectoMensajeResponse> conversacion(UUID contactoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        Estudiante contacto = contactoDelMismoPrograma(contactoId, propio);
        var recientes = repository.ultimosDeLaConversacion(propio.getId(), contacto.getId(),
                org.springframework.data.domain.PageRequest.of(0, MENSAJES_AL_ABRIR));
        // Llegan del mas nuevo al mas viejo, que es como se acota; se devuelven
        // en orden de lectura.
        var enOrden = new java.util.ArrayList<>(recientes);
        java.util.Collections.reverse(enOrden);
        return enOrden.stream()
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
