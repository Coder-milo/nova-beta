package com.novacrm.vacante;

import com.novacrm.empresa.Empresa;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.vacante.dto.VacanteRequest;
import com.novacrm.vacante.dto.VacanteResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class VacanteService {

    private static final String FUENTE_MANUAL = "MANUAL";

    private final VacanteRepository vacanteRepository;
    private final EmpresaRepository empresaRepository;
    private final LectorDeOferta lectorDeOferta;
    private final com.novacrm.auditoria.AuditoriaService auditoriaService;

    public VacanteService(VacanteRepository vacanteRepository,
                          EmpresaRepository empresaRepository,
                          LectorDeOferta lectorDeOferta,
                          com.novacrm.auditoria.AuditoriaService auditoriaService) {
        this.vacanteRepository = vacanteRepository;
        this.empresaRepository = empresaRepository;
        this.lectorDeOferta = lectorDeOferta;
        this.auditoriaService = auditoriaService;
    }

    /** Ofertas que se pueden mostrar hoy: abiertas y sin vencer. */
    public Page<VacanteResponse> listarActivas(Pageable pageable, boolean paraGestion) {
        return vacanteRepository.findVigentes(LocalDateTime.now(), pageable)
                .map(v -> toResponse(v, paraGestion));
    }

    public VacanteResponse obtener(UUID id) {
        return toResponse(buscar(id));
    }

    public long contarActivas() {
        return vacanteRepository.contarVigentes(LocalDateTime.now());
    }

    /**
     * Registra una oferta a mano.
     *
     * <p>Si viene enlace, lo que falte se intenta completar leyendo la pagina;
     * si no se puede, la oferta se guarda igual y queda por completar. Sin
     * enlace tambien se guarda: las ofertas de feria o de contacto directo no
     * tienen ninguno y son las que no estan en ningun portal.
     *
     * @param revisada falso solo para las que registra un estudiante; esas se
     *                 ven y se pueden usar, pero no entran al matching hasta
     *                 que alguien del equipo las mire
     */
    @Transactional
    public VacanteResponse crearDesdeUrl(VacanteRequest request, String creadaPor, boolean revisada) {
        String url = request.url() == null || request.url().isBlank() ? null : request.url().trim();

        if (url != null) {
            vacanteRepository.findByUrlOrigen(url).ifPresent(existente -> {
                throw new BusinessException("Esa oferta ya esta registrada: " + existente.getTitulo());
            });
        }

        var vacante = new Vacante();
        vacante.setUrlOrigen(url);
        vacante.setUrlAplicar(primeroNoVacio(request.urlAplicar(), url));
        vacante.setFuente(FUENTE_MANUAL);
        vacante.setCreadaPor(creadaPor);
        vacante.setActivo(true);
        vacante.setRevisada(revisada);
        vacante.setFechaPublicacion(LocalDateTime.now());
        vacante.setFechaExpiracion(request.fechaExpiracion());
        // Sin enlace no hay nada estable con lo que deduplicar, asi que el
        // hash se calcula sobre titulo y empresa. No evita todos los duplicados
        // —dos personas escribiran el mismo cargo distinto— pero si el caso
        // habitual, que es registrar dos veces lo mismo.
        vacante.setHashDedup(sha256(FUENTE_MANUAL + "|"
                + (url != null ? url : nullSafe(request.titulo()) + "|" + nullSafe(request.empresaNombre()))));

        var metadatos = url == null
                ? java.util.Optional.<LectorDeOferta.Metadatos>empty()
                : lectorDeOferta.leer(url);

        vacante.setTitulo(primeroNoVacio(
                request.titulo(),
                metadatos.map(LectorDeOferta.Metadatos::titulo).orElse(null),
                "Oferta sin titulo"));
        vacante.setDescripcion(primeroNoVacio(
                request.descripcion(),
                metadatos.map(LectorDeOferta.Metadatos::descripcion).orElse(null)));

        aplicarDatos(vacante, request);

        String empresaNombre = primeroNoVacio(
                request.empresaNombre(),
                metadatos.map(LectorDeOferta.Metadatos::sitio).orElse(null));
        if (empresaNombre != null) {
            vacante.setEmpresa(empresaOCrear(empresaNombre));
        }

        return toResponse(vacanteRepository.save(vacante));
    }

    /**
     * Corrige una oferta ya registrada.
     *
     * <p>Faltaba: solo habia alta, asi que arreglar un salario mal tecleado
     * obligaba a cerrar la oferta y volver a crearla, perdiendo por el camino
     * las postulaciones que colgaban de ella.
     *
     * <p><strong>No toca {@code revisada}.</strong> Es la marca que decide si
     * una oferta entra al matching; dejarla en un PUT abierto seria una via
     * para colar al recomendador una oferta sin verificar. Se sube solo por
     * {@link #marcarRevisada(UUID)}, que exige COORDINADOR o ADMIN.
     */
    @Transactional
    public VacanteResponse actualizar(UUID id, VacanteRequest request) {
        var vacante = buscar(id);

        vacante.setTitulo(primeroNoVacio(request.titulo(), vacante.getTitulo(), "Oferta sin titulo"));
        if (request.descripcion() != null) vacante.setDescripcion(request.descripcion());
        aplicarDatos(vacante, request);
        if (request.fechaExpiracion() != null) vacante.setFechaExpiracion(request.fechaExpiracion());

        String url = vacio(request.url()) ? null : request.url().trim();
        if (url != null && !url.equals(vacante.getUrlOrigen())) {
            vacanteRepository.findByUrlOrigen(url).ifPresent(otra -> {
                if (!otra.getId().equals(id)) {
                    throw new BusinessException("Ya hay otra oferta registrada con ese enlace");
                }
            });
            vacante.setUrlOrigen(url);
        }
        vacante.setUrlAplicar(primeroNoVacio(request.urlAplicar(), url, vacante.getUrlAplicar()));

        if (!vacio(request.empresaNombre())) {
            vacante.setEmpresa(empresaOCrear(request.empresaNombre().trim()));
        }

        return toResponse(vacanteRepository.save(vacante));
    }

    /**
     * Campos que se copian igual al crear y al editar.
     *
     * <p>En edicion los nulos no se tocan: un PUT parcial no debe pisar el
     * resto de la oferta. En creacion da igual, el campo nace nulo.
     */
    private void aplicarDatos(Vacante vacante, VacanteRequest request) {
        if (request.requisitos() != null) vacante.setRequisitos(request.requisitos());
        if (request.ubicacion() != null) vacante.setUbicacion(request.ubicacion());
        if (request.ciudad() != null) vacante.setCiudad(request.ciudad());
        if (request.rangoSalarial() != null) vacante.setRangoSalarial(request.rangoSalarial());
        if (request.tipoContrato() != null) vacante.setTipoContrato(request.tipoContrato());
        if (request.jornada() != null) vacante.setJornada(request.jornada());
        if (request.modalidadTrabajo() != null) vacante.setModalidadTrabajo(request.modalidadTrabajo());
        if (request.nivelInglesRequerido() != null) vacante.setNivelInglesRequerido(request.nivelInglesRequerido());
        if (request.aniosExperienciaRequeridos() != null) vacante.setAniosExperienciaRequeridos(request.aniosExperienciaRequeridos());
    }

    private static boolean vacio(String valor) {
        return valor == null || valor.isBlank();
    }

    /**
     * Da por buena una oferta que registro un estudiante.
     *
     * <p>Hasta este momento la oferta se ve pero no se le recomienda a nadie
     * mas. Es el paso que impide que una oferta sin verificar llegue sola a
     * toda la cohorte.
     */
    @Transactional
    public VacanteResponse marcarRevisada(UUID id) {
        var vacante = buscar(id);
        vacante.setRevisada(true);
        // Aprobar borra el rechazo anterior: si no, una oferta corregida y ya
        // publicada seguiria enseñando el motivo por el que se rechazo la
        // primera vez.
        vacante.olvidarRechazo();
        if (vacante.getFechaPublicacion() == null) {
            vacante.setFechaPublicacion(java.time.LocalDateTime.now());
        }
        return toResponse(vacanteRepository.save(vacante));
    }

    /**
     * Rechaza una oferta dejando dicho por que.
     *
     * <p>No la cierra ni la borra: quien la publico la sigue viendo, con el
     * motivo, y puede corregirla y reenviarla. Cerrarla le obligaria a
     * escribirla otra vez desde cero, que es la forma segura de que no la
     * corrija nadie.
     *
     * <p>El motivo es obligatorio. Un rechazo sin explicacion deja a quien
     * publico exactamente igual que antes de publicar: no sabe que cambiar, asi
     * que vuelve a mandar lo mismo.
     */
    @Transactional
    public VacanteResponse rechazar(UUID id, String motivo, String autor) {
        if (motivo == null || motivo.isBlank()) {
            throw new com.novacrm.exception.BusinessException(
                    "Hace falta decir por que se rechaza; quien la publico tiene que poder corregirla");
        }
        var vacante = buscar(id);
        vacante.rechazar(motivo.trim(), autor, java.time.LocalDateTime.now());
        return toResponse(vacanteRepository.save(vacante));
    }

    /** La cola de revision: lo que espera a que alguien la mire. */
    public java.util.List<VacanteResponse> colaDeRevision() {
        return vacanteRepository.enColaDeRevision().stream().map(this::toResponse).toList();
    }

    @Transactional
    public void eliminar(UUID id) {
        var vacante = buscar(id);
        vacanteRepository.delete(vacante);
        String nombreEmpresa = vacante.getEmpresa() != null ? vacante.getEmpresa().getNombre() : "Sin empresa";
        auditoriaService.registrar("Vacantes", "Eliminación", "Vacante",
                id.toString(), vacante.getTitulo() + " (" + nombreEmpresa + ")", null, null);
    }

    private static String nullSafe(String valor) {
        return valor == null ? "" : valor.trim();
    }

    /**
     * Cierra una oferta indicando por que.
     *
     * <p>Es la accion de "ya encontraron personal": la oferta deja de
     * recomendarse pero se conserva junto con el motivo, para poder analizar
     * despues cuantas se perdieron por vencimiento y cuantas se cubrieron.
     */
    @Transactional
    public VacanteResponse cerrar(UUID id, MotivoCierre motivo) {
        var vacante = buscar(id);
        if (!vacante.isActivo()) {
            throw new BusinessException("La oferta ya estaba cerrada");
        }
        vacante.cerrar(motivo == null ? MotivoCierre.RETIRADA : motivo, LocalDateTime.now());
        return toResponse(vacanteRepository.save(vacante));
    }

    /** Vuelve a abrir una oferta cerrada por error. */
    @Transactional
    public VacanteResponse reabrir(UUID id) {
        var vacante = buscar(id);
        vacante.setActivo(true);
        vacante.setMotivoCierre(null);
        vacante.setFechaCierre(null);
        return toResponse(vacanteRepository.save(vacante));
    }

    @Transactional
    public Vacante crear(Vacante vacante) {
        return vacanteRepository.save(vacante);
    }

    private Vacante buscar(UUID id) {
        return vacanteRepository.findById(id).orElseThrow(
                () -> new ResourceNotFoundException("Vacante no encontrada: " + id));
    }

    private Empresa empresaOCrear(String nombre) {
        // Solo empresas activas: una empresa borrada no debe resucitar
        // silenciosamente al registrar una vacante con su nombre.
        return empresaRepository.findByNombreIgnoreCaseActiva(nombre).orElseGet(() -> {
            var empresa = new Empresa();
            empresa.setNombre(nombre);
            return empresaRepository.save(empresa);
        });
    }

    private static String primeroNoVacio(String... valores) {
        for (String valor : valores) {
            if (valor != null && !valor.isBlank()) {
                return valor.trim();
            }
        }
        return null;
    }

    private static String sha256(String input) {
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of()
                    .formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private VacanteResponse toResponse(Vacante v) {
        return toResponse(v, true);
    }

    /**
     * @param paraGestion si quien pregunta puede ver los campos internos
     *
     * <p>Dos de ellos no son del anuncio sino de como lo gestiona el equipo:
     * {@code creadaPor} —el correo de quien la registro— y {@code motivoCierre}.
     * El detalle por identificador ya estaba restringido a gestion justo por
     * eso, pero el listado devolvia los mismos campos y si lo alcanza el
     * estudiante. En una oferta sugerida, {@code creadaPor} es el correo de
     * <em>otro participante</em>: filtrar por vigencia no basta, hay que
     * filtrar tambien por campo.
     */
    private VacanteResponse toResponse(Vacante v, boolean paraGestion) {
        return new VacanteResponse(
                v.getId(), v.getTitulo(), v.getDescripcion(), v.getRequisitos(),
                v.getUbicacion(), v.getRangoSalarial(), v.getTipoContrato(), v.getModalidadTrabajo(),
                v.getNivelInglesRequerido(), v.getAniosExperienciaRequeridos(), v.getFuente(),
                v.getUrlOrigen(), v.getUrlAplicar(),
                v.getEmpresa() != null ? v.getEmpresa().getNombre() : null,
                v.getFechaPublicacion(), v.getCreatedAt(),
                v.isActivo(),
                v.getFechaExpiracion(),
                paraGestion && v.getMotivoCierre() != null ? v.getMotivoCierre().name() : null,
                v.getCiudad(), v.getJornada(), v.isRevisada(),
                paraGestion ? v.getCreadaPor() : null,
                // Datos de contacto de una persona: solo hacia gestion, por lo
                // mismo que `creadaPor`.
                paraGestion ? v.getEmpresaDeclarada() : null,
                paraGestion ? v.getContactoDeclarado() : null,
                paraGestion ? v.getEmailDeclarado() : null,
                paraGestion ? v.getTelefonoDeclarado() : null);
    }
}
