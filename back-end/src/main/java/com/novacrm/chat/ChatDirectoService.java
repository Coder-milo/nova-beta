package com.novacrm.chat;

import com.novacrm.auth.OwnershipService;
import com.novacrm.chat.ChatDirectoMensajeRepository.ResumenConversacion;
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
    private final com.novacrm.notificacion.NotificacionService notificacionService;

    public ChatDirectoService(ChatDirectoMensajeRepository repository,
                              EstudianteRepository estudianteRepository,
                              OwnershipService ownershipService,
                              com.novacrm.notificacion.NotificacionService notificacionService) {
        this.repository = repository;
        this.estudianteRepository = estudianteRepository;
        this.ownershipService = ownershipService;
        this.notificacionService = notificacionService;
    }

    /**
     * Solo se muestran compañeros activos del mismo proyecto, nunca toda la base.
     *
     * <p>Cuantos se ofrecen al escribir: mas de esto no se lee.
     */
    private static final int MAXIMO_CONTACTOS = 20;

    /** Cuanto del ultimo mensaje se manda a la lista. Una linea, no mas. */
    private static final int RESUMEN_MAXIMO = 120;

    /**
     * Las conversaciones que ya existen, de la mas reciente a la mas antigua.
     *
     * <p>Sin esto solo se llegaba a un chat buscando el nombre de la persona o
     * pinchando un aviso: no habia forma de ver con quien se ha hablado, ni de
     * volver a una conversacion de la que se recuerda a medias con quien fue.
     */
    @Transactional(readOnly = true)
    public List<com.novacrm.chat.dto.ChatConversacionResponse> conversaciones(Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        var resumenes = repository.conversacionesDe(propio.getId());
        if (resumenes.isEmpty()) return List.of();

        var sinLeer = new java.util.HashMap<UUID, Long>();
        for (var fila : repository.sinLeerPorContacto(propio.getId())) {
            sinLeer.put(fila.getRemitenteId(), fila.getTotal());
        }
        // Los nombres en una sola consulta y no uno por fila.
        var porId = estudianteRepository.findAllById(
                        resumenes.stream().map(ResumenConversacion::getOtroId).toList()).stream()
                .collect(java.util.stream.Collectors.toMap(Estudiante::getId, e -> e));

        UUID miPrograma = programaDe(propio).getId();
        var lista = new java.util.ArrayList<com.novacrm.chat.dto.ChatConversacionResponse>();
        for (var r : resumenes) {
            Estudiante otro = porId.get(r.getOtroId());
            // Solo lo que se puede abrir. Quien se retiro del programa o se
            // cambio a otro ya no pasa el control de `enviar` ni el de
            // `conversacion`, asi que su fila seria una que siempre da error
            // al pulsarla. Preferible no ofrecerla.
            if (otro == null || !otro.isActivo()) continue;
            var programaDelOtro = otro.getPrograma();
            if (programaDelOtro == null || !programaDelOtro.getId().equals(miPrograma)) continue;

            lista.add(new com.novacrm.chat.dto.ChatConversacionResponse(
                    otro.getId(), nombreDe(otro), otro.getFotoUrl(),
                    recortar(r.getUltimoMensaje()), r.getUltimaFecha(),
                    r.getMioElUltimo(), sinLeer.getOrDefault(otro.getId(), 0L)));
        }
        lista.sort((a, b) -> b.ultimaFecha().compareTo(a.ultimaFecha()));
        return lista;
    }

    private static String recortar(String texto) {
        if (texto == null) return "";
        // `\s+` y no `\s+`: desde Java 15 esto ultimo es un escape valido que
        // significa un espacio, asi que compilaba y dejaba pasar los saltos de
        // linea. Decia una cosa y hacia otra.
        // \\s+ y no \s+: desde Java 15 esto ultimo es un escape valido que
        // significa un espacio, asi que compilaba y dejaba pasar los saltos de
        // linea. Decia una cosa y hacia otra, y las dos formas se leen igual.
        String limpio = texto.strip().replaceAll("\\s+", " ");
        return limpio.length() <= RESUMEN_MAXIMO ? limpio : limpio.substring(0, RESUMEN_MAXIMO) + "…";
    }

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

    @Transactional
    public List<ChatDirectoMensajeResponse> conversacion(UUID contactoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        Estudiante contacto = contactoDelMismoPrograma(contactoId, propio);
        var recientes = repository.ultimosDeLaConversacion(propio.getId(), contacto.getId(),
                org.springframework.data.domain.PageRequest.of(0, MENSAJES_AL_ABRIR));
        // Llegan del mas nuevo al mas viejo, que es como se acota; se devuelven
        // en orden de lectura.
        var enOrden = new java.util.ArrayList<>(recientes);
        java.util.Collections.reverse(enOrden);
        // Abrir la conversacion es haberla leido. Se marca aqui y no con una
        // llamada aparte porque una segunda peticion que el cliente puede
        // olvidar deja el estado a medias sin que nada lo delate.
        var ahora = java.time.Instant.now();
        boolean alguno = false;
        for (var mensaje : enOrden) {
            if (!mensaje.getDestinatario().getId().equals(propio.getId())) continue;
            if (mensaje.getLeidoAt() != null) continue;
            mensaje.setLeidoAt(ahora);
            alguno = true;
        }
        if (alguno) repository.saveAll(enOrden);
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
        var guardado = repository.save(mensaje);
        // Sin esto el chat era de una sola direccion: el mensaje llegaba y el
        // destinatario no se enteraba salvo que buscara a esa persona y abriera
        // la conversacion por su cuenta.
        notificacionService.registrarMensajeDeCompanero(contacto, propio.getId(), nombreDe(propio));
        return respuesta(guardado, propio.getId());
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
                mensaje.getRemitente().getId().equals(propioId), mensaje.getLeidoAt());
    }
}
