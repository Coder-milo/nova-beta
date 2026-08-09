package com.novacrm.mensaje;

import com.novacrm.auth.OwnershipService;
import com.novacrm.documento.StorageService;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.mensaje.dto.MensajeAdjuntoResponse;
import com.novacrm.mensaje.dto.MensajeRequest;
import com.novacrm.mensaje.dto.MensajeResponse;
import com.novacrm.mensaje.dto.MensajeTurnoResponse;
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
    private final MensajeTurnoRepository turnoRepository;
    private final MensajeReaccionRepository reaccionRepository;
    private final EstudianteRepository estudianteRepository;
    private final OwnershipService ownershipService;
    private final StorageService storageService;
    private final NotificacionService notificacionService;

    public MensajeEstudianteService(MensajeEstudianteRepository repository,
                                   MensajeAdjuntoRepository adjuntoRepository,
                                   MensajeTurnoRepository turnoRepository,
                                   MensajeReaccionRepository reaccionRepository,
                                   EstudianteRepository estudianteRepository,
                                   OwnershipService ownershipService,
                                   StorageService storageService,
                                   NotificacionService notificacionService) {
        this.repository = repository;
        this.adjuntoRepository = adjuntoRepository;
        this.turnoRepository = turnoRepository;
        this.reaccionRepository = reaccionRepository;
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
        var guardado = repository.save(mensaje);
        var turno = new MensajeTurno();
        turno.setMensaje(guardado);
        turno.setAutorEmail(auth.getName());
        turno.setAutorEsEstudiante(true);
        turno.setContenido(contenidoLimpio);
        var turnoGuardado = turnoRepository.save(turno);
        for (var adjunto : guardado.getAdjuntos()) {
            adjunto.setTurno(turnoGuardado);
            adjuntoRepository.save(adjunto);
        }
        return toResponse(guardado);
    }

    public List<MensajeResponse> listarTodos() {
        return repository.findAllByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public void eliminar(UUID id) {
        var mensaje = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Mensaje no encontrado: " + id));
        repository.delete(mensaje);
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
        var turno = new MensajeTurno();
        turno.setMensaje(guardado);
        turno.setAutorEmail(auth.getName());
        turno.setAutorEsEstudiante(false);
        turno.setContenido(respuestaLimpia);
        var turnoGuardado = turnoRepository.save(turno);
        for (var adjunto : guardado.getAdjuntos()) {
            if (adjunto.isRespuesta()) {
                adjunto.setTurno(turnoGuardado);
                adjuntoRepository.save(adjunto);
            }
        }
        // Sin esto la respuesta del equipo llega en silencio: el estudiante no
        // ve nada en la campana y solo se entera si vuelve a abrir el hilo por
        // su cuenta. Se perdio al pasar el mensaje a turnos.
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
        mensaje.setAsunto("CAC Academic");
        mensaje.setContenido("");
        mensaje.setRespuesta(texto);
        mensaje.setRespondidoPor(auth.getName());
        mensaje.setRespondidoAt(ahora);
        mensaje.setEstado(EstadoMensaje.RESPONDIDO);
        for (MultipartFile archivo : adjuntos) {
            mensaje.getAdjuntos().add(crearAdjunto(mensaje, archivo, true));
        }
        var guardado = repository.save(mensaje);
        var turno = new MensajeTurno();
        turno.setMensaje(guardado);
        turno.setAutorEmail(auth.getName());
        turno.setAutorEsEstudiante(false);
        turno.setContenido(texto);
        var turnoGuardado = turnoRepository.save(turno);
        for (var adjunto : guardado.getAdjuntos()) {
            adjunto.setTurno(turnoGuardado);
            adjuntoRepository.save(adjunto);
        }
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

    // ── Conversación por turnos ─────────────────────────────────────────────

    /**
     * Los emojis que se pueden poner.
     *
     * <p>Lista cerrada y no texto libre: la columna admite 16 caracteres y un
     * campo abierto acaba llevando lo que sea —incluida una cadena que el
     * navegador pinte como algo que no es—. Con una lista, la interfaz tiene
     * ademas una paleta definida en vez de inventarse una por su cuenta.
     */
    private static final Set<String> EMOJIS = Set.of("👍", "❤️", "🎉", "👏", "😀", "😮", "😢", "🙏");

    /** El hilo completo, en orden, con sus adjuntos y reacciones. */
    public List<MensajeTurnoResponse> turnos(UUID mensajeId, Authentication auth) {
        var mensaje = hiloAlQuePuedeAcceder(mensajeId, auth);
        var listaTurnos = turnoRepository.findByMensajeIdOrderByCreatedAtAsc(mensaje.getId());
        // Hilos anteriores a que cada envio se guardara como turno: se
        // reconstruyen para poder leerlos, pero no existen como fila. Van
        // marcados `historico` para que la pantalla no ofrezca reaccionar ni
        // citar: no hay a que apuntar y la accion fallaria siempre. El id sale
        // del propio mensaje y no de `randomUUID`, que cambiaba en cada
        // consulta y hacia que React rehiciera el hilo entero cada vez.
        if (listaTurnos.isEmpty()) {
            List<MensajeTurnoResponse> sintetizados = new java.util.ArrayList<>();
            var estudiante = mensaje.getEstudiante();
            String nombreEstudiante = ((estudiante.getNombre() == null ? "" : estudiante.getNombre()) + " "
                    + (estudiante.getApellido() == null ? "" : estudiante.getApellido())).trim();
            if (nombreEstudiante.isBlank()) nombreEstudiante = "Estudiante";

            if (mensaje.getContenido() != null && !mensaje.getContenido().isBlank()) {
                sintetizados.add(new MensajeTurnoResponse(
                        mensaje.getId(),
                        nombreEstudiante,
                        true,
                        mensaje.getContenido(),
                        mensaje.getCreatedAt(),
                        null, null,
                        mensaje.getAdjuntos().stream().filter(a -> !a.isRespuesta())
                                .map(a -> new MensajeAdjuntoResponse(a.getId(), a.getNombre(), a.getContentType(), a.getTamano(), "/api/v1/mensajes/adjuntos/" + a.getId() + "/archivo")).toList(),
                        List.of(),
                        true
                ));
            }
            if (mensaje.getRespuesta() != null && !mensaje.getRespuesta().isBlank()) {
                sintetizados.add(new MensajeTurnoResponse(
                        idDeRespuestaHistorica(mensaje.getId()),
                        mensaje.getRespondidoPor() == null ? "CAC Academic" : mensaje.getRespondidoPor(),
                        false,
                        mensaje.getRespuesta(),
                        mensaje.getRespondidoAt() == null ? mensaje.getCreatedAt() : mensaje.getRespondidoAt(),
                        null, null,
                        mensaje.getAdjuntos().stream().filter(MensajeAdjunto::isRespuesta)
                                .map(a -> new MensajeAdjuntoResponse(a.getId(), a.getNombre(), a.getContentType(), a.getTamano(), "/api/v1/mensajes/adjuntos/" + a.getId() + "/archivo")).toList(),
                        List.of(),
                        true
                ));
            }
            return sintetizados;
        }
        return listaTurnos.stream()
                .map(turno -> aRespuesta(turno, auth.getName()))
                .toList();
    }

    /**
     * Un id estable para la respuesta reconstruida de un hilo antiguo.
     *
     * <p>Se deriva del id del mensaje invirtiendo los bits altos, asi que sale
     * siempre el mismo y no choca con el del mensaje. Antes era
     * {@code randomUUID()}: cambiaba en cada consulta, y como la pantalla lo
     * usa de clave, rehacia el hilo entero cada vez que se refrescaba.
     */
    private static UUID idDeRespuestaHistorica(UUID mensajeId) {
        return new UUID(~mensajeId.getMostSignificantBits(), mensajeId.getLeastSignificantBits());
    }

    /**
     * Añade una intervención al hilo, opcionalmente citando otra.
     *
     * <p>Sustituye a {@code responder}, que sólo admitía un intercambio por
     * mensaje. Sirve a las dos partes: quien escribe queda registrado en el
     * turno, y de ahí sale de qué lado se pinta.
     */
    @Transactional
    public MensajeTurnoResponse escribirEnHilo(UUID mensajeId, String contenido, UUID enRespuestaA,
                                               List<MultipartFile> archivos, Authentication auth) {
        var mensaje = hiloAlQuePuedeAcceder(mensajeId, auth);

        String texto = contenido == null ? "" : contenido.trim();
        List<MultipartFile> adjuntos = archivos == null ? List.of()
                : archivos.stream().filter(a -> a != null && !a.isEmpty()).toList();
        if (texto.length() > 5000) {
            throw new BusinessException("El mensaje no puede superar 5000 caracteres.");
        }
        if (texto.isBlank() && adjuntos.isEmpty()) {
            throw new BusinessException("Escribe un mensaje o adjunta un archivo.");
        }
        if (adjuntos.size() > MAX_ADJUNTOS) {
            throw new BusinessException("Puedes adjuntar hasta " + MAX_ADJUNTOS + " archivos.");
        }

        boolean esEstudiante = esElEstudianteDelHilo(mensaje, auth);

        var turno = new MensajeTurno();
        turno.setMensaje(mensaje);
        turno.setAutorEmail(auth.getName());
        turno.setAutorEsEstudiante(esEstudiante);
        turno.setContenido(texto);
        if (enRespuestaA != null) {
            var citado = turnoRepository.findById(enRespuestaA)
                    .orElseThrow(() -> new ResourceNotFoundException("Turno no encontrado: " + enRespuestaA));
            // Citar un turno de otra conversación dejaría ver texto de un hilo
            // al que quien escribe no tiene acceso.
            if (!citado.getMensaje().getId().equals(mensaje.getId())) {
                throw new BusinessException("Sólo puedes responder a un mensaje de esta misma conversación.");
            }
            turno.setEnRespuestaA(citado);
        }
        var guardado = turnoRepository.save(turno);

        for (MultipartFile archivo : adjuntos) {
            var adjunto = crearAdjunto(mensaje, archivo, !esEstudiante);
            adjunto.setTurno(guardado);
            adjuntoRepository.save(adjunto);
            guardado.getAdjuntos().add(adjunto);
        }

        // El estado sigue siendo del hilo: si contesta el equipo queda
        // respondido, y si vuelve a escribir el estudiante vuelve a abrirse.
        mensaje.setEstado(esEstudiante ? EstadoMensaje.ABIERTO : EstadoMensaje.RESPONDIDO);
        if (!esEstudiante) {
            mensaje.setRespondidoPor(auth.getName());
            mensaje.setRespondidoAt(Instant.now());
            notificacionService.registrarMensajeDelEquipo(mensaje.getEstudiante(), mensaje.getId());
        }
        repository.save(mensaje);

        return aRespuesta(guardado, auth.getName());
    }

    /**
     * Pone o quita un emoji sobre un turno.
     *
     * <p>Alterna: pulsar el mismo dos veces lo retira, que es como se comporta
     * cualquier chat y lo que impide inflar un contador a base de pulsaciones.
     * La unicidad la sostiene además el índice de la tabla.
     */
    @Transactional
    public List<MensajeTurnoResponse.ReaccionResumen> alternarReaccion(UUID turnoId, String emoji,
                                                                       Authentication auth) {
        if (emoji == null || !EMOJIS.contains(emoji)) {
            throw new BusinessException("Ese emoji no está disponible.");
        }
        var turno = turnoRepository.findById(turnoId)
                .orElseThrow(() -> new ResourceNotFoundException("Turno no encontrado: " + turnoId));
        hiloAlQuePuedeAcceder(turno.getMensaje().getId(), auth);

        reaccionRepository.findByTurnoIdAndAutorEmailAndEmoji(turnoId, auth.getName(), emoji)
                .ifPresentOrElse(reaccionRepository::delete, () -> {
                    var reaccion = new MensajeReaccion();
                    reaccion.setTurno(turno);
                    reaccion.setAutorEmail(auth.getName());
                    reaccion.setEmoji(emoji);
                    reaccionRepository.save(reaccion);
                });

        // Desde la tabla y no desde la colección de la entidad: esa se cargó al
        // principio de la transacción y no incluye lo que se acaba de guardar.
        return resumirReacciones(
                reaccionRepository.findByTurnoIdOrderByCreatedAtAsc(turnoId), auth.getName());
    }

    /**
     * El hilo, si quien pregunta puede verlo.
     *
     * <p>Un estudiante sólo alcanza los suyos; el equipo, cualquiera. Se apoya
     * en la misma comprobación que el resto del portal para no tener aquí una
     * segunda idea de qué es "mío".
     */
    private MensajeEstudiante hiloAlQuePuedeAcceder(UUID mensajeId, Authentication auth) {
        var mensaje = repository.findById(mensajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Mensaje no encontrado: " + mensajeId));
        ownershipService.verificarAccesoEstudiante(auth, mensaje.getEstudiante().getId());
        return mensaje;
    }

    /** Si quien escribe es el propio estudiante del hilo y no alguien del equipo. */
    private boolean esElEstudianteDelHilo(MensajeEstudiante mensaje, Authentication auth) {
        boolean gestiona = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")
                        || a.getAuthority().equals("ROLE_COORDINADOR"));
        if (gestiona) return false;
        return mensaje.getEstudiante().getEmail() != null
                && mensaje.getEstudiante().getEmail().equalsIgnoreCase(auth.getName());
    }

    private MensajeTurnoResponse aRespuesta(MensajeTurno turno, String quienMira) {
        var citado = turno.getEnRespuestaA();
        return new MensajeTurnoResponse(
                turno.getId(),
                nombreDelAutor(turno),
                turno.isAutorEsEstudiante(),
                turno.getContenido(),
                turno.getCreatedAt(),
                citado == null ? null : citado.getId(),
                citado == null ? null : extracto(citado.getContenido()),
                turno.getAdjuntos().stream()
                        .sorted(java.util.Comparator.comparing(MensajeAdjunto::getCreatedAt,
                                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
                        .map(a -> new MensajeAdjuntoResponse(a.getId(), a.getNombre(), a.getContentType(),
                                a.getTamano(), "/api/v1/mensajes/adjuntos/" + a.getId() + "/archivo"))
                        .toList(),
                resumirReacciones(turno.getReacciones(), quienMira));
    }

    /**
     * Con qué nombre se muestra quien escribió.
     *
     * <p>Del estudiante se usa su nombre; del equipo, el correo con el que
     * responde. No se envía el correo del estudiante: quien lee el hilo puede
     * ser el propio equipo, pero también el estudiante, y no hace falta.
     */
    private String nombreDelAutor(MensajeTurno turno) {
        if (!turno.isAutorEsEstudiante()) return turno.getAutorEmail();
        var estudiante = turno.getMensaje().getEstudiante();
        String nombre = ((estudiante.getNombre() == null ? "" : estudiante.getNombre()) + " "
                + (estudiante.getApellido() == null ? "" : estudiante.getApellido())).trim();
        return nombre.isBlank() ? "Estudiante" : nombre;
    }

    private static String extracto(String texto) {
        if (texto == null) return null;
        String limpio = texto.strip().replaceAll("\\s+", " ");
        return limpio.length() <= 90 ? limpio : limpio.substring(0, 90).trim() + "…";
    }

    private List<MensajeTurnoResponse.ReaccionResumen> resumirReacciones(
            java.util.Collection<MensajeReaccion> reacciones, String quienMira) {
        // Se ordena por fecha antes de agrupar: la colección de la entidad es un
        // conjunto y no garantiza orden, así que sin esto los botones cambiarían
        // de sitio entre recargas.
        var porEmoji = new java.util.LinkedHashMap<String, java.util.List<MensajeReaccion>>();
        reacciones.stream()
                .sorted(java.util.Comparator.comparing(MensajeReaccion::getCreatedAt,
                        java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
                .forEach(r -> porEmoji.computeIfAbsent(r.getEmoji(), k -> new java.util.ArrayList<>()).add(r));
        return porEmoji.entrySet().stream()
                .map(e -> new MensajeTurnoResponse.ReaccionResumen(
                        e.getKey(),
                        e.getValue().size(),
                        e.getValue().stream().anyMatch(r -> r.getAutorEmail().equalsIgnoreCase(quienMira))))
                .toList();
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
