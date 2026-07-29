package com.novacrm.mensaje;

import com.novacrm.auth.OwnershipService;
import com.novacrm.documento.StorageService;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.mensaje.dto.MensajeAdjuntoResponse;
import com.novacrm.mensaje.dto.MensajeRequest;
import com.novacrm.mensaje.dto.MensajeResponse;
import com.novacrm.notificacion.NotificacionService;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class MensajeEstudianteService {
    private static final int MAX_ADJUNTOS = 5;
    private static final long MAX_TAMANO_ADJUNTO = 10L * 1024 * 1024;
    private static final Set<String> TIPOS_ADMITIDOS = Set.of(
            "application/pdf",
            "text/plain",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    private final MensajeEstudianteRepository repository;
    private final MensajeAdjuntoRepository adjuntoRepository;
    private final EstudianteRepository estudianteRepository;
    private final OwnershipService ownershipService;
    private final StorageService storageService;
    private final NotificacionService notificacionService;

    public MensajeEstudianteService(MensajeEstudianteRepository repository,
                                   MensajeAdjuntoRepository adjuntoRepository,
                                   EstudianteRepository estudianteRepository,
                                   OwnershipService ownershipService,
                                   StorageService storageService,
                                   NotificacionService notificacionService) {
        this.repository = repository;
        this.adjuntoRepository = adjuntoRepository;
        this.estudianteRepository = estudianteRepository;
        this.ownershipService = ownershipService;
        this.storageService = storageService;
        this.notificacionService = notificacionService;
    }

    public List<MensajeResponse> mios(Authentication auth) {
        return repository.findByEstudianteIdOrderByCreatedAtDesc(
                ownershipService.obtenerEstudianteAutenticado(auth).getId()).stream().map(this::toResponse).toList();
    }

    @Transactional
    public MensajeResponse crear(MensajeRequest request, Authentication auth) {
        return crear(request.asunto(), request.contenido(), List.of(), auth);
    }

    /** Crea un mensaje con texto opcional y hasta cinco archivos de apoyo. */
    @Transactional
    public MensajeResponse crear(String asunto, String contenido, List<MultipartFile> archivos, Authentication auth) {
        String asuntoLimpio = asunto == null ? "" : asunto.trim();
        String contenidoLimpio = contenido == null ? "" : contenido.trim();
        List<MultipartFile> adjuntos = archivos == null ? List.of()
                : archivos.stream().filter(archivo -> archivo != null && !archivo.isEmpty()).toList();

        if (asuntoLimpio.isBlank() || asuntoLimpio.length() > 160) {
            throw new BusinessException("El asunto del mensaje es obligatorio y no puede superar 160 caracteres.");
        }
        if (contenidoLimpio.length() > 5000) {
            throw new BusinessException("El mensaje no puede superar 5000 caracteres.");
        }
        if (contenidoLimpio.isBlank() && adjuntos.isEmpty()) {
            throw new BusinessException("Escribe un mensaje o adjunta un archivo.");
        }
        if (adjuntos.size() > MAX_ADJUNTOS) {
            throw new BusinessException("Puedes adjuntar hasta " + MAX_ADJUNTOS + " archivos por mensaje.");
        }

        var mensaje = new MensajeEstudiante();
        mensaje.setEstudiante(ownershipService.obtenerEstudianteAutenticado(auth));
        mensaje.setAsunto(asuntoLimpio);
        mensaje.setContenido(contenidoLimpio);
        for (MultipartFile archivo : adjuntos) {
            mensaje.getAdjuntos().add(crearAdjunto(mensaje, archivo, false));
        }
        return toResponse(repository.save(mensaje));
    }

    public List<MensajeResponse> listarTodos() {
        return repository.findAllByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public MensajeResponse responder(UUID id, String respuesta, Authentication auth) {
        return responder(id, respuesta, List.of(), auth);
    }

    /** El equipo puede contestar texto, archivos o ambos sin crear otro hilo. */
    @Transactional
    public MensajeResponse responder(UUID id, String respuesta, List<MultipartFile> archivos, Authentication auth) {
        var mensaje = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Mensaje no encontrado: " + id));
        String respuestaLimpia = respuesta == null ? "" : respuesta.trim();
        List<MultipartFile> adjuntos = archivos == null ? List.of()
                : archivos.stream().filter(archivo -> archivo != null && !archivo.isEmpty()).toList();
        if (respuestaLimpia.length() > 5000) {
            throw new BusinessException("La respuesta no puede superar 5000 caracteres.");
        }
        if (respuestaLimpia.isBlank() && adjuntos.isEmpty()) {
            throw new BusinessException("Escribe una respuesta o adjunta un archivo.");
        }
        if (adjuntos.size() > MAX_ADJUNTOS) {
            throw new BusinessException("Puedes adjuntar hasta " + MAX_ADJUNTOS + " archivos por respuesta.");
        }
        mensaje.setRespuesta(respuestaLimpia);
        mensaje.setRespondidoPor(auth.getName());
        mensaje.setRespondidoAt(Instant.now());
        mensaje.setEstado(EstadoMensaje.RESPONDIDO);
        for (MultipartFile archivo : adjuntos) {
            mensaje.getAdjuntos().add(crearAdjunto(mensaje, archivo, true));
        }
        var guardado = repository.save(mensaje);
        notificacionService.registrarMensajeDelEquipo(mensaje.getEstudiante(), guardado.getId());
        return toResponse(guardado);
    }

    /** Guarda cada envío del equipo como un mensaje nuevo del mismo hilo. */
    @Transactional
    public MensajeResponse enviarAlEstudiante(UUID estudianteId, String respuesta,
                                              List<MultipartFile> archivos, Authentication auth) {
        var estudiante = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + estudianteId));
        if (!estudiante.isActivo()) {
            throw new ResourceNotFoundException("Estudiante no encontrado: " + estudianteId);
        }
        String texto = respuesta == null ? "" : respuesta.trim();
        List<MultipartFile> adjuntos = archivos == null ? List.of()
                : archivos.stream().filter(archivo -> archivo != null && !archivo.isEmpty()).toList();
        if (texto.length() > 5000) {
            throw new BusinessException("El mensaje no puede superar 5000 caracteres.");
        }
        if (texto.isBlank() && adjuntos.isEmpty()) {
            throw new BusinessException("Escribe un mensaje o adjunta un archivo.");
        }
        if (adjuntos.size() > MAX_ADJUNTOS) {
            throw new BusinessException("Puedes adjuntar hasta " + MAX_ADJUNTOS + " archivos por mensaje.");
        }

        Instant ahora = Instant.now();
        repository.findByEstudianteIdAndEstado(estudianteId, EstadoMensaje.ABIERTO).forEach(pendiente -> {
            pendiente.setEstado(EstadoMensaje.RESPONDIDO);
            pendiente.setRespondidoPor(auth.getName());
            pendiente.setRespondidoAt(ahora);
        });

        var mensaje = new MensajeEstudiante();
        mensaje.setEstudiante(estudiante);
        mensaje.setAsunto("CAC Academy");
        mensaje.setContenido("");
        mensaje.setRespuesta(texto);
        mensaje.setRespondidoPor(auth.getName());
        mensaje.setRespondidoAt(ahora);
        mensaje.setEstado(EstadoMensaje.RESPONDIDO);
        for (MultipartFile archivo : adjuntos) {
            mensaje.getAdjuntos().add(crearAdjunto(mensaje, archivo, true));
        }
        var guardado = repository.save(mensaje);
        notificacionService.registrarMensajeDelEquipo(estudiante, guardado.getId());
        return toResponse(guardado);
    }

    /** Recupera un adjunto solo si el solicitante participa en la conversación. */
    public ArchivoAdjunto descargarAdjunto(UUID id, Authentication auth) {
        var adjunto = adjuntoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Adjunto no encontrado: " + id));
        ownershipService.verificarAccesoEstudiante(auth, adjunto.getMensaje().getEstudiante().getId());
        return new ArchivoAdjunto(adjunto.getNombre(), adjunto.getContentType(),
                storageService.descargar(adjunto.getObjectKey()));
    }

    private MensajeAdjunto crearAdjunto(MensajeEstudiante mensaje, MultipartFile archivo, boolean esRespuesta) {
        if (archivo.getSize() > MAX_TAMANO_ADJUNTO) {
            throw new BusinessException("Cada archivo adjunto puede pesar hasta 10 MB.");
        }
        String nombre = nombreSeguro(archivo.getOriginalFilename());
        String tipo = tipoSeguro(archivo.getContentType());
        if (!tipoAdmitido(tipo, nombre)) {
            throw new BusinessException("El archivo " + nombre + " no es un formato admitido en el chat.");
        }
        try {
            var adjunto = new MensajeAdjunto();
            adjunto.setMensaje(mensaje);
            adjunto.setNombre(nombre);
            adjunto.setContentType(tipo);
            adjunto.setTamano(archivo.getSize());
            adjunto.setRespuesta(esRespuesta);
            adjunto.setObjectKey(storageService.subir("mensajes", nombre, archivo.getBytes(), tipo));
            return adjunto;
        } catch (IOException exception) {
            throw new BusinessException("No fue posible leer el archivo adjunto.");
        }
    }

    private static String nombreSeguro(String nombreOriginal) {
        String nombre = nombreOriginal == null ? "archivo" : nombreOriginal
                .replace('\\', '_').replace('/', '_').replaceAll("[\\r\\n]", "").trim();
        if (nombre.isBlank()) nombre = "archivo";
        return nombre.length() > 255 ? nombre.substring(0, 255) : nombre;
    }

    private static String tipoSeguro(String tipo) {
        return tipo == null || tipo.isBlank() ? "application/octet-stream" : tipo.toLowerCase(Locale.ROOT);
    }

    private static boolean tipoAdmitido(String tipo, String nombre) {
        if (tipo.startsWith("image/")) return true;
        if (TIPOS_ADMITIDOS.contains(tipo)) return true;
        String extension = nombre.contains(".") ? nombre.substring(nombre.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
        return Set.of("pdf", "txt", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "webp", "gif")
                .contains(extension);
    }

    private MensajeResponse toResponse(MensajeEstudiante mensaje) {
        var estudiante = mensaje.getEstudiante();
        String nombre = ((estudiante.getNombre() == null ? "" : estudiante.getNombre()) + " "
                + (estudiante.getApellido() == null ? "" : estudiante.getApellido())).trim();
        return new MensajeResponse(mensaje.getId(), estudiante.getId(),
                nombre.isBlank() ? estudiante.getEmail() : nombre, estudiante.getEmail(),
                mensaje.getAsunto(), mensaje.getContenido(),
                mensaje.getEstado().name(), mensaje.getCreatedAt(), mensaje.getRespuesta(),
                mensaje.getRespondidoPor(), mensaje.getRespondidoAt(), mensaje.getAdjuntos().stream()
                        .filter(adjunto -> !adjunto.isRespuesta())
                        .map(adjunto -> new MensajeAdjuntoResponse(adjunto.getId(), adjunto.getNombre(),
                                adjunto.getContentType(), adjunto.getTamano(),
                                "/api/v1/mensajes/adjuntos/" + adjunto.getId() + "/archivo"))
                        .toList(), mensaje.getAdjuntos().stream()
                        .filter(MensajeAdjunto::isRespuesta)
                        .map(adjunto -> new MensajeAdjuntoResponse(adjunto.getId(), adjunto.getNombre(),
                                adjunto.getContentType(), adjunto.getTamano(),
                                "/api/v1/mensajes/adjuntos/" + adjunto.getId() + "/archivo"))
                        .toList());
    }

    public record ArchivoAdjunto(String nombre, String contentType, byte[] contenido) { }
}
