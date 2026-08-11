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
    private final ReporteDeChatRepository reporteRepository;
    private final BloqueoDeChatRepository bloqueoRepository;
    private final ConversacionArchivadaRepository archivadaRepository;
    private final ChatAdjuntoRepository adjuntoRepository;
    private final com.novacrm.documento.StorageService storageService;

    public ChatDirectoService(ChatDirectoMensajeRepository repository,
                              EstudianteRepository estudianteRepository,
                              OwnershipService ownershipService,
                              com.novacrm.notificacion.NotificacionService notificacionService,
                              ReporteDeChatRepository reporteRepository,
                              BloqueoDeChatRepository bloqueoRepository,
                              ConversacionArchivadaRepository archivadaRepository,
                              ChatAdjuntoRepository adjuntoRepository,
                              com.novacrm.documento.StorageService storageService) {
        this.repository = repository;
        this.estudianteRepository = estudianteRepository;
        this.ownershipService = ownershipService;
        this.notificacionService = notificacionService;
        this.reporteRepository = reporteRepository;
        this.bloqueoRepository = bloqueoRepository;
        this.archivadaRepository = archivadaRepository;
        this.adjuntoRepository = adjuntoRepository;
        this.storageService = storageService;
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

        var archivadaDesde = new java.util.HashMap<UUID, java.time.Instant>();
        for (var a : archivadaRepository.archivadasDe(propio.getId())) {
            archivadaDesde.put(a.getContactoId(), a.getDesde());
        }

        UUID miPrograma = programaDe(propio).getId();
        var lista = new java.util.ArrayList<com.novacrm.chat.dto.ChatConversacionResponse>();
        for (var r : resumenes) {
            Estudiante otro = porId.get(r.getOtroId());
            // Solo lo que se puede abrir. Quien se retiro o se cambio de
            // proyecto ya no pasa el control de `conversacion` ni el de
            // `enviar`, asi que su fila seria una que siempre da error al
            // pulsarla. Preferible no ofrecerla.
            if (otro == null || !otro.isActivo()) continue;
            var programaDelOtro = otro.getPrograma();
            if (programaDelOtro == null || !programaDelOtro.getId().equals(miPrograma)) continue;

            // Archivada solo mientras no haya pasado nada desde entonces: un
            // mensaje nuevo la devuelve a la bandeja. Apartar una conversacion
            // no puede significar dejar de enterarse de lo que pasa en ella.
            var desde = archivadaDesde.get(otro.getId());
            boolean archivada = desde != null && !r.getUltimaFecha().isAfter(desde);

            lista.add(new com.novacrm.chat.dto.ChatConversacionResponse(
                    otro.getId(), nombreDe(otro), otro.getFotoUrl(),
                    recortar(r.getUltimoMensaje()), r.getUltimaFecha(),
                    r.getMioElUltimo(), sinLeer.getOrDefault(otro.getId(), 0L), archivada));
        }
        lista.sort((a, b) -> b.ultimaFecha().compareTo(a.ultimaFecha()));
        return lista;
    }

    private static String recortar(String texto) {
        if (texto == null) return "";
        // \\s+ y no \s+: desde Java 15 esto ultimo es un escape valido que
        // significa un espacio, asi que compilaba y dejaba pasar los saltos de
        // linea. Decia una cosa y hacia otra, y las dos formas se leen igual.
        String limpio = texto.strip().replaceAll("\\s+", " ");
        return limpio.length() <= RESUMEN_MAXIMO ? limpio : limpio.substring(0, RESUMEN_MAXIMO) + "…";
    }

    @Transactional(readOnly = true)
    public List<ChatContactoResponse> contactos(String consulta, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        // Sin termino se devuelve la lista de companeros, no una lista vacia.
        // La pantalla de crear grupo la pedia con la letra "a" para simular un
        // "traemelos todos", y con el minimo de dos caracteres eso no devolvia
        // a nadie: no habia forma de elegir con quien montar un grupo. Buscar y
        // listar son dos usos del mismo endpoint, y el tope de abajo protege
        // los dos por igual.
        String termino = consulta == null ? "" : consulta.trim().toLowerCase(Locale.ROOT);

        UUID programaId = propio.getPrograma() != null ? propio.getPrograma().getId() : null;
        List<Estudiante> coincidencia;
        if (programaId != null) {
            coincidencia = estudianteRepository.companerosQueCoinciden(programaId, propio.getId(), termino,
                    org.springframework.data.domain.PageRequest.of(0, MAXIMO_CONTACTOS));
        } else {
            coincidencia = estudianteRepository.todosLosEstudiantesQueCoinciden(propio.getId(), termino,
                    org.springframework.data.domain.PageRequest.of(0, MAXIMO_CONTACTOS));
        }

        // Aqui habia un plan B: si la busqueda por programa no encontraba nada,
        // se recorria estudianteRepository.findAll() y se comparaba el nombre.
        // Es decir, cuando en tu proyecto no habia ninguna Ana, aparecian las
        // Anas de todos los demas proyectos. Devolvia nombres de gente real de
        // fuera de tu grupo, y ademas no servia de nada: al pulsarlas,
        // contactoValido las rechaza. Sin resultados es la respuesta correcta.

        // A quien bloqueaste, y quien te bloqueo, no se ofrece: una fila que
        // siempre da error al pulsarla es peor que no estar.
        var sinChat = new java.util.HashSet<>(bloqueoRepository.sinChatPosibleCon(propio.getId()));
        return coincidencia.stream()
                .filter(estudiante -> !sinChat.contains(estudiante.getId()))
                .map(estudiante -> new ChatContactoResponse(estudiante.getId(), nombreDe(estudiante), estudiante.getFotoUrl()))
                .toList();
    }

    /**
     * Cuantos mensajes se traen al abrir un chat.
     */
    private static final int MENSAJES_AL_ABRIR = 200;

    @Transactional
    public List<ChatDirectoMensajeResponse> conversacion(UUID contactoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        Estudiante contacto = contactoValido(contactoId, propio);
        var recientes = repository.ultimosDeLaConversacion(propio.getId(), contacto.getId(),
                org.springframework.data.domain.PageRequest.of(0, MENSAJES_AL_ABRIR));
        var enOrden = new java.util.ArrayList<>(recientes);
        java.util.Collections.reverse(enOrden);
        var ahora = java.time.Instant.now();
        boolean alguno = false;
        for (var mensaje : enOrden) {
            if (!mensaje.getDestinatario().getId().equals(propio.getId())) continue;
            if (mensaje.getLeidoAt() != null) continue;
            mensaje.setLeidoAt(ahora);
            alguno = true;
        }
        if (alguno) repository.saveAll(enOrden);
        notificacionService.marcarLeidosLosAvisosDeChat(propio.getId(), contacto.getId());
        return enOrden.stream()
                .map(mensaje -> respuesta(mensaje, propio.getId()))
                .toList();
    }

    @Transactional
    public ChatDirectoMensajeResponse enviar(UUID contactoId, String contenido, Authentication auth) {
        return enviar(contactoId, contenido, java.util.List.of(), null, auth);
    }

    /**
     * Manda un mensaje, con archivos si los lleva.
     *
     * <p>Con adjuntos el texto puede ir vacio: mandar una foto sin comentario es
     * normal. Sin adjuntos sigue haciendo falta escribir algo, que un mensaje
     * vacio no es un mensaje.
     *
     * @param duracionSegundos duracion declarada por el navegador para una nota
     *                         de voz; se acota y se ignora si no encaja
     */
    @Transactional
    public ChatDirectoMensajeResponse enviar(UUID contactoId, String contenido,
                                             java.util.List<org.springframework.web.multipart.MultipartFile> archivos,
                                             Integer duracionSegundos, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        Estudiante contacto = contactoValido(contactoId, propio);
        comprobarQueNoHayBloqueo(propio, contacto);

        var adjuntos = archivos == null ? java.util.List.<org.springframework.web.multipart.MultipartFile>of()
                : archivos.stream().filter(a -> a != null && !a.isEmpty()).toList();
        if (adjuntos.size() > AdjuntoDeChat.MAXIMO_POR_MENSAJE) {
            throw new BusinessException(
                    "Puedes enviar hasta " + AdjuntoDeChat.MAXIMO_POR_MENSAJE + " archivos por mensaje.");
        }

        String texto = adjuntos.isEmpty()
                ? TextoDeMensaje.validado(contenido)
                : TextoDeMensaje.validadoOVacio(contenido);

        var mensaje = new ChatDirectoMensaje();
        mensaje.setRemitente(propio);
        mensaje.setDestinatario(contacto);
        mensaje.setContenido(texto);
        var guardado = repository.save(mensaje);

        for (var archivo : adjuntos) {
            guardado.getAdjuntos().add(guardarAdjunto(guardado, archivo, duracionSegundos));
        }

        notificacionService.registrarMensajeDeCompanero(contacto, propio.getId(), nombreDe(propio));
        return respuesta(guardado, propio.getId());
    }

    private ChatAdjunto guardarAdjunto(ChatDirectoMensaje mensaje,
                                       org.springframework.web.multipart.MultipartFile archivo,
                                       Integer duracionSegundos) {
        String tipo = AdjuntoDeChat.tipoValidado(archivo);
        String nombre = AdjuntoDeChat.nombreSeguro(archivo.getOriginalFilename());
        try {
            var adjunto = new ChatAdjunto();
            adjunto.setMensaje(mensaje);
            adjunto.setNombre(nombre);
            adjunto.setContentType(tipo);
            adjunto.setTamano(archivo.getSize());
            adjunto.setDuracionSegundos(AdjuntoDeChat.duracionValidada(duracionSegundos, tipo));
            adjunto.setObjectKey(storageService.subir("chat", nombre, archivo.getBytes(), tipo));
            return adjuntoRepository.save(adjunto);
        } catch (java.io.IOException e) {
            throw new BusinessException("No fue posible leer el archivo adjunto.");
        }
    }

    /**
     * El archivo, solo si quien lo pide participa en esa conversacion.
     *
     * <p>La comprobacion es la misma que para leer el mensaje: si no puedes ver
     * la conversacion, no puedes bajarte lo que se mando en ella. Sin esto,
     * conocer el id de un adjunto —o acertarlo— bastaria para descargarlo.
     */
    @Transactional(readOnly = true)
    public ArchivoDeChat descargarAdjunto(UUID adjuntoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        var adjunto = adjuntoRepository.findById(adjuntoId)
                .orElseThrow(() -> new ResourceNotFoundException("Adjunto no encontrado."));
        var mensaje = adjunto.getMensaje();
        boolean participo = mensaje.getRemitente().getId().equals(propio.getId())
                || mensaje.getDestinatario().getId().equals(propio.getId());
        if (!participo) {
            // Mismo texto que si no existiera: quien pregunta por un adjunto
            // ajeno no tiene por que enterarse de que existe.
            throw new ResourceNotFoundException("Adjunto no encontrado.");
        }
        return new ArchivoDeChat(adjunto.getNombre(), adjunto.getContentType(),
                storageService.descargar(adjunto.getObjectKey()));
    }

    /** Un archivo del chat listo para responderlo. */
    public record ArchivoDeChat(String nombre, String contentType, byte[] contenido) { }

    @Transactional
    public ChatDirectoMensajeResponse editar(UUID mensajeId, String nuevoContenido, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        var mensaje = repository.findById(mensajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Mensaje no encontrado."));
        if (!mensaje.getRemitente().getId().equals(propio.getId())) {
            throw new BusinessException("Solo puedes editar tus propios mensajes.");
        }
        // Editar tiene el mismo limite que escribir: si no, se manda uno corto
        // y se edita para dejar el megabyte que el envio no admitia.
        String texto = TextoDeMensaje.validado(nuevoContenido);
        // Y el mismo bloqueo. Sin esto, a quien bloquean le queda una puerta
        // abierta: no puede mandar nada nuevo, pero si reescribir cualquiera de
        // sus mensajes anteriores, y el texto nuevo aparece en la conversacion
        // de la otra persona. Bloquear tiene que cortar tambien eso, que es
        // justo para lo que se bloquea a alguien.
        comprobarQueNoHayBloqueo(propio, mensaje.getDestinatario());
        mensaje.setContenido(texto);
        mensaje.setEditado(true);
        var guardado = repository.save(mensaje);
        return respuesta(guardado, propio.getId());
    }

    @Transactional
    public void borrar(UUID mensajeId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        var mensaje = repository.findById(mensajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Mensaje no encontrado."));
        if (!mensaje.getRemitente().getId().equals(propio.getId())) {
            throw new BusinessException("Solo puedes borrar tus propios mensajes.");
        }
        repository.delete(mensaje);
    }

    @Transactional
    public ChatDirectoMensajeResponse reenviar(UUID mensajeId, UUID destinoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        var mensajeOriginal = repository.findById(mensajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Mensaje original no encontrado."));
        // Solo se reenvia lo que uno ha recibido o escrito.
        //
        // Esto no estaba, y era la puerta mas grande del chat: se cogia el
        // mensaje por identificador y se copiaba su contenido, sin mirar de
        // quien era. Con un identificador cualquiera se podia reenviar a uno
        // mismo una conversacion entre otras dos personas y leerla entera,
        // mensaje a mensaje, sin haber estado nunca en ella.
        //
        // Mismo mensaje que cuando no existe: decir «existe pero no es tuyo»
        // convierte esto en una forma de comprobar identificadores.
        boolean participo = mensajeOriginal.getRemitente().getId().equals(propio.getId())
                || mensajeOriginal.getDestinatario().getId().equals(propio.getId());
        if (!participo) {
            throw new ResourceNotFoundException("Mensaje original no encontrado.");
        }

        Estudiante destino = contactoValido(destinoId, propio);

        var nuevo = new ChatDirectoMensaje();
        nuevo.setRemitente(propio);
        nuevo.setDestinatario(destino);
        comprobarQueNoHayBloqueo(propio, destino);
        nuevo.setContenido(mensajeOriginal.getContenido());
        nuevo.setReenviado(true);
        var guardado = repository.save(nuevo);
        notificacionService.registrarMensajeDeCompanero(destino, propio.getId(), nombreDe(propio));
        return respuesta(guardado, propio.getId());
    }

    private Estudiante contactoValido(UUID contactoId, Estudiante propio) {
        if (contactoId.equals(propio.getId())) {
            throw new BusinessException("No puedes abrir un chat contigo mismo.");
        }
        Estudiante contacto = estudianteRepository.findById(contactoId)
                .orElseThrow(() -> new ResourceNotFoundException("Compañero no encontrado."));
        if (!contacto.isActivo()) {
            throw new ResourceNotFoundException("El compañero ya no está activo.");
        }
        return contacto;
    }

    /**
     * Deja de recibir mensajes de esa persona, y de poder escribirle.
     *
     * <p>Corta en las dos direcciones aunque se guarde en una. Si solo cortara
     * el sentido de quien bloquea hacia quien es bloqueado, el que bloquea
     * podria seguir escribiendo: la herramienta para protegerse serviria para
     * insistir.
     *
     * <p>Lo ya escrito no se borra. Sigue estando para leerlo y, sobre todo,
     * para reportarlo: bloquear no debe hacer desaparecer la prueba.
     */
    @Transactional
    public void bloquear(UUID contactoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        if (contactoId.equals(propio.getId())) {
            throw new BusinessException("No puedes bloquearte a ti mismo.");
        }
        Estudiante contacto = estudianteRepository.findById(contactoId)
                .orElseThrow(() -> new ResourceNotFoundException("Compañero no encontrado."));
        if (bloqueoRepository.findByBloqueadorIdAndBloqueadoId(propio.getId(), contactoId).isPresent()) {
            return; // Ya estaba bloqueado: pulsarlo otra vez no es un error.
        }
        var bloqueo = new BloqueoDeChat();
        bloqueo.setBloqueador(propio);
        bloqueo.setBloqueado(contacto);
        bloqueoRepository.save(bloqueo);
    }

    /**
     * Corta el envío si hay bloqueo, lo haya puesto quien lo haya puesto.
     *
     * <p>El mensaje no dice quién bloqueó a quién: enterarte de que te han
     * bloqueado es información sobre la otra persona, y decirla convierte el
     * bloqueo en un aviso que invita a buscar otra vía.
     */
    private void comprobarQueNoHayBloqueo(Estudiante propio, Estudiante contacto) {
        if (bloqueoRepository.hayBloqueoEntre(propio.getId(), contacto.getId())) {
            throw new BusinessException("No es posible enviar mensajes en esta conversación.");
        }
    }

    /** Deshace el bloqueo. Solo puede deshacerlo quien lo puso. */
    @Transactional
    public void desbloquear(UUID contactoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        bloqueoRepository.findByBloqueadorIdAndBloqueadoId(propio.getId(), contactoId)
                .ifPresent(bloqueoRepository::delete);
    }

    /** A quienes bloqueó esta persona, para poder pintarlo y deshacerlo. */
    @Transactional(readOnly = true)
    public List<UUID> bloqueados(Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        return bloqueoRepository.aQuienesBloqueo(propio.getId());
    }

    /**
     * Aparta una conversación de la bandeja de quien lo pide.
     *
     * <p>Solo de quien lo pide: el otro no se entera y su bandeja no cambia.
     *
     * <p>Si ya estaba archivada se rehace la marca, y no es un detalle: la
     * fecha es lo que decide si sigue apartada. Una conversación archivada en
     * la que después escribieron vuelve a la bandeja, y volver a archivarla
     * tiene que contar desde ahora y no desde la primera vez.
     */
    @Transactional
    public void archivar(UUID contactoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        Estudiante contacto = contactoValido(contactoId, propio);

        archivadaRepository.findByEstudianteIdAndContactoId(propio.getId(), contacto.getId())
                .ifPresent(archivadaRepository::delete);
        archivadaRepository.flush();

        var archivada = new ConversacionArchivada();
        archivada.setEstudiante(propio);
        archivada.setContacto(contacto);
        archivadaRepository.save(archivada);
    }

    /**
     * La clave de la foto de un compañero, si se le puede ver.
     *
     * <p>Pasa por el mismo control que escribirle. El endpoint de la ficha no
     * sirve para esto: solo deja ver la foto propia, asi que las caras de la
     * lista de conversaciones eran imagenes rotas —el chat pintaba la clave de
     * almacenamiento como si fuera una direccion—. Se resuelve aqui y no
     * abriendo aquel, porque quien puede ver la cara de alguien es una decision
     * del chat: compañeros del mismo proyecto, y nadie mas.
     */
    @Transactional(readOnly = true)
    public String claveDeFotoDe(UUID contactoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        return contactoValido(contactoId, propio).getFotoUrl();
    }

    /** Devuelve la conversación a la bandeja. */
    @Transactional
    public void desarchivar(UUID contactoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        archivadaRepository.findByEstudianteIdAndContactoId(propio.getId(), contactoId)
                .ifPresent(archivadaRepository::delete);
    }

    /**
     * El tramo anterior a un mensaje, para poder subir por la conversación.
     *
     * <p>Abrir el chat trae los últimos doscientos. Lo de más atrás existía y no
     * había forma de alcanzarlo: la conversación se cortaba sin que nada lo
     * dijera, y quien buscaba algo de hace meses no encontraba ni el mensaje ni
     * la explicación.
     *
     * <p>Mismo control que abrirla, y el mensaje de referencia tiene que ser de
     * esta conversación: si no, bastaría con el identificador de un mensaje
     * ajeno para empezar a leer desde cualquier punto de cualquier chat.
     */
    @Transactional(readOnly = true)
    public List<ChatDirectoMensajeResponse> anteriores(UUID contactoId, UUID antesDeId,
                                                       Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        Estudiante contacto = contactoValido(contactoId, propio);

        var referencia = repository.findById(antesDeId)
                .orElseThrow(() -> new ResourceNotFoundException("Mensaje no encontrado."));
        boolean esDeEstaConversacion =
                (referencia.getRemitente().getId().equals(propio.getId())
                        && referencia.getDestinatario().getId().equals(contacto.getId()))
                || (referencia.getRemitente().getId().equals(contacto.getId())
                        && referencia.getDestinatario().getId().equals(propio.getId()));
        if (!esDeEstaConversacion) {
            throw new ResourceNotFoundException("Mensaje no encontrado.");
        }

        var recientes = repository.anterioresA(propio.getId(), contacto.getId(),
                referencia.getCreatedAt(), referencia.getSecuencia(),
                org.springframework.data.domain.PageRequest.of(0, MENSAJES_AL_ABRIR));
        var enOrden = new java.util.ArrayList<>(recientes);
        java.util.Collections.reverse(enOrden);
        return enOrden.stream()
                .map(mensaje -> respuesta(mensaje, propio.getId()))
                .toList();
    }

    /** Cuantos resultados devuelve una busqueda dentro del chat. */
    private static final int RESULTADOS_DE_BUSQUEDA = 50;

    /** Minimo para buscar. Con una letra, el resultado es la conversacion entera. */
    private static final int MINIMO_PARA_BUSCAR = 2;

    /**
     * Busca dentro de una conversacion.
     *
     * <p>Pasa por el mismo control que abrirla: si no se puede leer, tampoco se
     * puede buscar dentro. Sin eso, la busqueda seria una puerta de atras para
     * leer conversaciones ajenas trozo a trozo.
     */
    @Transactional(readOnly = true)
    public List<ChatDirectoMensajeResponse> buscar(UUID contactoId, String consulta, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        Estudiante contacto = contactoValido(contactoId, propio);
        String termino = consulta == null ? "" : consulta.trim();
        if (termino.length() < MINIMO_PARA_BUSCAR) return List.of();

        return repository.buscarEnLaConversacion(propio.getId(), contacto.getId(), termino,
                        org.springframework.data.domain.PageRequest.of(0, RESULTADOS_DE_BUSQUEDA))
                .stream()
                .map(mensaje -> respuesta(mensaje, propio.getId()))
                .toList();
    }

    /** Cuantos mensajes se guardan como prueba al reportar. */
    private static final int MENSAJES_DEL_EXTRACTO = 30;

    /**
     * Reporta a un compañero por lo que le escribió.
     *
     * <p>No exige que el otro siga en el proyecto: se puede reportar a quien
     * acaba de irse, que es justo cuando mas falta hace. Lo que si exige es que
     * exista conversacion entre los dos, para que el boton no sirva para
     * denunciar a desconocidos.
     *
     * <p>El extracto se copia aqui y no se apunta a los mensajes: quien acosa
     * borra, y un reporte que apunta a mensajes borrados no le sirve a nadie.
     */
    @Transactional
    public void reportar(UUID contactoId, String motivo, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        if (contactoId.equals(propio.getId())) {
            throw new BusinessException("No puedes reportarte a ti mismo.");
        }
        Estudiante contacto = estudianteRepository.findById(contactoId)
                .orElseThrow(() -> new ResourceNotFoundException("Compañero no encontrado."));

        var recientes = repository.ultimosDeLaConversacion(propio.getId(), contacto.getId(),
                org.springframework.data.domain.PageRequest.of(0, MENSAJES_DEL_EXTRACTO));
        if (recientes.isEmpty()) {
            throw new BusinessException("Solo puedes reportar una conversación que existe.");
        }
        if (reporteRepository.existsByDenuncianteIdAndDenunciadoIdAndEstado(
                propio.getId(), contacto.getId(), ReporteDeChat.ABIERTO)) {
            throw new BusinessException(
                    "Ya reportaste a esta persona. El equipo lo está revisando.");
        }

        var enOrden = new java.util.ArrayList<>(recientes);
        java.util.Collections.reverse(enOrden);
        var extracto = new StringBuilder();
        for (var mensaje : enOrden) {
            extracto.append(mensaje.getCreatedAt()).append(" · ")
                    .append(nombreDe(mensaje.getRemitente())).append(": ")
                    .append(mensaje.getContenido()).append('\n');
        }

        var reporte = new ReporteDeChat();
        reporte.setDenunciante(propio);
        reporte.setDenunciado(contacto);
        reporte.setMotivo(motivo == null ? null : motivo.trim());
        reporte.setExtracto(extracto.toString());
        reporteRepository.save(reporte);
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

    private static ChatDirectoMensajeResponse respuesta(ChatDirectoMensaje mensaje, UUID propioId) {
        return new ChatDirectoMensajeResponse(mensaje.getId(), mensaje.getRemitente().getId(),
                nombreDe(mensaje.getRemitente()), mensaje.getContenido(), mensaje.getCreatedAt(),
                mensaje.getRemitente().getId().equals(propioId), mensaje.getLeidoAt(),
                mensaje.isEditado(), mensaje.getEnRespuestaA(), mensaje.isReenviado(),
                mensaje.getAdjuntos().stream()
                        .map(com.novacrm.chat.dto.ChatAdjuntoResponse::de)
                        .toList());
    }
}
