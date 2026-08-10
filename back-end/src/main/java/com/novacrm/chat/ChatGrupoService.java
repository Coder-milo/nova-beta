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
    private final ReporteDeChatRepository reporteRepository;

    public ChatGrupoService(ChatGrupoRepository grupoRepository,
                             ChatGrupoMiembroRepository miembroRepository,
                             ChatGrupoMensajeRepository mensajeRepository,
                             EstudianteRepository estudianteRepository,
                             OwnershipService ownershipService,
                             ReporteDeChatRepository reporteRepository) {
        this.grupoRepository = grupoRepository;
        this.miembroRepository = miembroRepository;
        this.mensajeRepository = mensajeRepository;
        this.estudianteRepository = estudianteRepository;
        this.ownershipService = ownershipService;
        this.reporteRepository = reporteRepository;
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

    /**
     * Quién está en el grupo.
     *
     * <p>{@code soyYo} viaja resuelto desde el servidor para que la pantalla no
     * tenga que saber quién es el estudiante autenticado sólo para no ofrecerle
     * el botón de sacarse a sí mismo.
     */
    public record MiembroResponse(
            UUID estudianteId,
            String nombre,
            String fotoUrl,
            boolean esAdmin,
            boolean soyYo
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

        // Agregar miembros invitados. Por la misma puerta que los que se añaden
        // despues: son la misma decision —a quien se admite en este grupo— y
        // escrita dos veces acabo, otra vez, con una de las dos sin comprobar
        // el proyecto.
        if (req.miembroIds() != null) {
            admitir(guardado, req.miembroIds(), creador, 1);
        }

        int total = miembroRepository.findByGrupoId(guardado.getId()).size();
        return new GrupoResponse(guardado.getId(), guardado.getNombre(), guardado.getDescripcion(),
                guardado.getFotoUrl(), creador.getId(), total, guardado.getCreatedAt());
    }

    @Transactional
    public void agregarMiembros(UUID grupoId, List<UUID> estudianteIds, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        ChatGrupo grupo = grupoRepository.findById(grupoId)
                .orElseThrow(() -> new ResourceNotFoundException("Grupo no encontrado."));
        if (!miembroRepository.existsByGrupoIdAndEstudianteId(grupoId, propio.getId())) {
            throw new BusinessException("No perteneces a este grupo.");
        }
        if (estudianteIds == null) return;
        int yaDentro = miembroRepository.findByGrupoId(grupoId).size();
        admitir(grupo, estudianteIds, propio, yaDentro);
    }

    /**
     * Mete en el grupo a quien puede entrar, y a nadie mas.
     *
     * <p>La regla vive aqui y no repetida en cada puerta. Al crear el grupo se
     * comprobaba el proyecto, la cuenta activa y el tope; al añadir despues no
     * se comprobaba ninguna de las tres, asi que bastaba con crear un grupo de
     * dos y añadir luego para saltarse todo: gente de otro proyecto leyendose
     * entre si, cuentas dadas de baja dentro, y sin limite de tamaño. Dos
     * puertas para lo mismo y solo una cerrada, otra vez.
     *
     * <p>A quien no cumple se le ignora en silencio, sin decir por que: la
     * alternativa —«ese id existe pero es de otro proyecto»— convierte esto en
     * una forma de averiguar quien esta en el sistema.
     */
    private void admitir(ChatGrupo grupo, List<UUID> estudianteIds, Estudiante quienInvita,
                         int yaDentro) {
        if (estudianteIds.size() + yaDentro > MAXIMO_MIEMBROS) {
            throw new BusinessException(
                    "Un grupo admite hasta " + MAXIMO_MIEMBROS + " personas.");
        }
        UUID suPrograma = programaDe(quienInvita).getId();
        var vistos = new java.util.HashSet<UUID>();
        for (UUID id : estudianteIds) {
            if (id.equals(quienInvita.getId())) continue;
            // La misma lista puede traer el mismo id dos veces. La clave unica
            // de la tabla lo rechaza, pero conviene no llegar a eso: dentro de
            // una misma transaccion, la comprobacion de "ya esta" no ve todavia
            // lo que se acaba de insertar.
            if (!vistos.add(id)) continue;
            if (miembroRepository.existsByGrupoIdAndEstudianteId(grupo.getId(), id)) continue;
            estudianteRepository.findById(id)
                    .filter(Estudiante::isActivo)
                    .filter(e -> e.getPrograma() != null
                            && e.getPrograma().getId().equals(suPrograma))
                    .ifPresent(e -> {
                        var m = new ChatGrupoMiembro();
                        m.setGrupo(grupo);
                        m.setEstudiante(e);
                        m.setEsAdmin(false);
                        miembroRepository.save(m);
                    });
        }
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

        var mensajes = mensajeRepository.findByGrupoIdOrderByCreatedAtDescSecuenciaDesc(grupoId,
                org.springframework.data.domain.PageRequest.of(0, 200));
        var ordenados = new java.util.ArrayList<>(mensajes);
        java.util.Collections.reverse(ordenados);

        return ordenados.stream().map(m -> comoRespuesta(m, propio.getId())).toList();
    }

    @Transactional
    public GrupoMensajeResponse enviarAMensajeGrupo(UUID grupoId, String contenido, UUID enRespuestaA, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        ChatGrupo grupo = grupoRepository.findById(grupoId)
                .orElseThrow(() -> new ResourceNotFoundException("Grupo no encontrado."));
        if (!miembroRepository.existsByGrupoIdAndEstudianteId(grupoId, propio.getId())) {
            throw new BusinessException("No perteneces a este grupo.");
        }

        String texto = TextoDeMensaje.validado(contenido);

        // Se cita un mensaje de este grupo, no uno cualquiera.
        //
        // El identificador se guardaba tal cual, sin mirar de donde salia, asi
        // que se podia responder a un mensaje de otro grupo. Hoy la pantalla lo
        // resuelve contra lo que tiene cargado y no encuentra nada, con lo que
        // no se ve; pero queda guardada una respuesta a algo que no esta aqui,
        // y el dia que alguien resuelva la cita en el servidor eso pasa a ser
        // texto de otro grupo asomando en este.
        //
        // Es la comprobacion que la mensajeria con el equipo ya hacia, con un
        // comentario explicando este mismo riesgo.
        if (enRespuestaA != null) {
            var citado = mensajeRepository.findById(enRespuestaA)
                    .orElseThrow(() -> new ResourceNotFoundException("Mensaje citado no encontrado."));
            if (!citado.getGrupo().getId().equals(grupoId)) {
                throw new BusinessException(
                        "Solo puedes responder a un mensaje de este mismo grupo.");
            }
        }

        var mensaje = new ChatGrupoMensaje();
        mensaje.setGrupo(grupo);
        mensaje.setRemitente(propio);
        mensaje.setContenido(texto);
        mensaje.setEnRespuestaA(enRespuestaA);
        var guardado = mensajeRepository.save(mensaje);

        return comoRespuesta(guardado, propio.getId());
    }

    /**
     * Los miembros del grupo, para poder verlos y administrarlos.
     *
     * <p>Solo los ve quien pertenece: la lista de un grupo dice con quién se
     * junta la gente, y eso no es de dominio público dentro del proyecto.
     */
    public List<MiembroResponse> miembros(UUID grupoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        if (!miembroRepository.existsByGrupoIdAndEstudianteId(grupoId, propio.getId())) {
            throw new BusinessException("No perteneces a este grupo.");
        }
        return miembroRepository.findByGrupoIdOrderByCreatedAtAsc(grupoId).stream()
                .map(m -> new MiembroResponse(
                        m.getEstudiante().getId(),
                        nombreDe(m.getEstudiante()),
                        m.getEstudiante().getFotoUrl(),
                        m.isEsAdmin(),
                        m.getEstudiante().getId().equals(propio.getId())))
                .toList();
    }

    /**
     * La clave de la foto del grupo, si quien pregunta pertenece a él.
     *
     * <p>Igual que la de un compañero: {@code fotoUrl} no es una dirección sino
     * la clave con la que el archivo está guardado, así que hace falta alguien
     * que la sirva. Hoy los grupos no tienen forma de subir foto y esto
     * devuelve siempre vacío; existe para que el día que la tengan no aparezca
     * rota, que es como aparecieron las de las personas durante meses.
     */
    public String claveDeFotoDelGrupo(UUID grupoId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        if (!miembroRepository.existsByGrupoIdAndEstudianteId(grupoId, propio.getId())) {
            throw new BusinessException("No perteneces a este grupo.");
        }
        return grupoRepository.findById(grupoId)
                .orElseThrow(() -> new ResourceNotFoundException("Grupo no encontrado."))
                .getFotoUrl();
    }

    /** Cuantos mensajes se traen al abrir un grupo, y por tramo al subir. */
    private static final int MENSAJES_POR_TRAMO = 200;

    /**
     * Un mensaje de grupo, como lo ve quien pregunta.
     *
     * <p>Estaba escrito tres veces con los mismos diez argumentos en el mismo
     * orden. Diez argumentos posicionales copiados a mano son diez ocasiones
     * de cruzar dos, y el compilador no dice nada cuando los dos son del mismo
     * tipo: {@code editado} y {@code reenviado} son ambos booleanos.
     */
    private static GrupoMensajeResponse comoRespuesta(ChatGrupoMensaje m, UUID propioId) {
        return new GrupoMensajeResponse(
                m.getId(), m.getGrupo().getId(), m.getRemitente().getId(),
                nombreDe(m.getRemitente()), m.getContenido(), m.getCreatedAt(),
                m.getRemitente().getId().equals(propioId),
                m.isEditado(), m.getEnRespuestaA(), m.isReenviado());
    }

    /**
     * El tramo anterior a un mensaje del grupo.
     *
     * <p>Solo para quien pertenece, igual que leerlo. Y el mensaje de
     * referencia tiene que ser de este grupo: si no, bastaría con el
     * identificador de un mensaje de otro para empezar a leerlo desde
     * cualquier punto.
     */
    public List<GrupoMensajeResponse> anteriores(UUID grupoId, UUID antesDeId, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        if (!miembroRepository.existsByGrupoIdAndEstudianteId(grupoId, propio.getId())) {
            throw new BusinessException("No perteneces a este grupo.");
        }
        var referencia = mensajeRepository.findById(antesDeId)
                .orElseThrow(() -> new ResourceNotFoundException("Mensaje no encontrado."));
        if (!referencia.getGrupo().getId().equals(grupoId)) {
            throw new ResourceNotFoundException("Mensaje no encontrado.");
        }

        var recientes = mensajeRepository.anterioresA(grupoId,
                referencia.getCreatedAt(), referencia.getSecuencia(),
                org.springframework.data.domain.PageRequest.of(0, MENSAJES_POR_TRAMO));
        var enOrden = new java.util.ArrayList<>(recientes);
        java.util.Collections.reverse(enOrden);
        return enOrden.stream().map(m -> comoRespuesta(m, propio.getId())).toList();
    }

    /** Cuantos resultados devuelve una busqueda dentro del grupo. */
    private static final int RESULTADOS_DE_BUSQUEDA = 50;

    /** Minimo para buscar. Con una letra, el resultado es el grupo entero. */
    private static final int MINIMO_PARA_BUSCAR = 2;

    /**
     * Busca dentro de un grupo.
     *
     * <p>Solo lo puede hacer quien pertenece, igual que leerlo: si no, buscar
     * seria una forma de leer un grupo ajeno trozo a trozo.
     */
    public List<GrupoMensajeResponse> buscar(UUID grupoId, String consulta, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        if (!miembroRepository.existsByGrupoIdAndEstudianteId(grupoId, propio.getId())) {
            throw new BusinessException("No perteneces a este grupo.");
        }
        String termino = consulta == null ? "" : consulta.trim();
        if (termino.length() < MINIMO_PARA_BUSCAR) return List.of();

        return mensajeRepository.buscarEnElGrupo(grupoId, termino,
                        org.springframework.data.domain.PageRequest.of(0, RESULTADOS_DE_BUSQUEDA))
                .stream()
                .map(m -> comoRespuesta(m, propio.getId()))
                .toList();
    }

    /** Cuantos mensajes del grupo se guardan como prueba al reportar. */
    private static final int MENSAJES_DEL_EXTRACTO = 30;

    /**
     * Reporta a alguien del grupo por lo que escribió en él.
     *
     * <p>Se reporta a una persona, no al grupo. Un grupo es un espacio de
     * varios: cerrarlo por lo que escribió uno castiga a todos los demás, que
     * no hicieron nada. Y el equipo necesita saber a quién mirar, no solo
     * dónde.
     *
     * <p>El extracto es del grupo entero y no solo de los mensajes de esa
     * persona: una frase suelta sin lo que se dijo antes y después casi nunca
     * se entiende, y de eso depende que el equipo pueda juzgar.
     */
    @Transactional
    public void reportar(UUID grupoId, UUID estudianteId, String motivo, Authentication auth) {
        Estudiante propio = ownershipService.obtenerEstudianteAutenticado(auth);
        if (!miembroRepository.existsByGrupoIdAndEstudianteId(grupoId, propio.getId())) {
            throw new BusinessException("No perteneces a este grupo.");
        }
        if (estudianteId.equals(propio.getId())) {
            throw new BusinessException("No puedes reportarte a ti mismo.");
        }
        var grupo = grupoRepository.findById(grupoId)
                .orElseThrow(() -> new ResourceNotFoundException("Grupo no encontrado."));
        // Sin exigir que siga siendo miembro: se puede reportar a quien acaba de
        // salirse, que es justo cuando mas falta hace.
        Estudiante denunciado = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Compañero no encontrado."));

        if (reporteRepository.existsByDenuncianteIdAndDenunciadoIdAndEstado(
                propio.getId(), denunciado.getId(), ReporteDeChat.ABIERTO)) {
            throw new BusinessException(
                    "Ya reportaste a esta persona. El equipo lo está revisando.");
        }

        var recientes = mensajeRepository.findByGrupoIdOrderByCreatedAtDescSecuenciaDesc(grupoId,
                org.springframework.data.domain.PageRequest.of(0, MENSAJES_DEL_EXTRACTO));
        var enOrden = new java.util.ArrayList<>(recientes);
        java.util.Collections.reverse(enOrden);
        var extracto = new StringBuilder("Grupo: ").append(grupo.getNombre()).append('\n');
        for (var mensaje : enOrden) {
            extracto.append(mensaje.getCreatedAt()).append(" · ")
                    .append(nombreDe(mensaje.getRemitente())).append(": ")
                    .append(mensaje.getContenido()).append('\n');
        }

        var reporte = new ReporteDeChat();
        reporte.setDenunciante(propio);
        reporte.setDenunciado(denunciado);
        reporte.setMotivo(motivo == null ? null : motivo.trim());
        reporte.setExtracto(extracto.toString());
        reporteRepository.save(reporte);
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
