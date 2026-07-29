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

    public VacanteService(VacanteRepository vacanteRepository,
                          EmpresaRepository empresaRepository,
                          LectorDeOferta lectorDeOferta) {
        this.vacanteRepository = vacanteRepository;
        this.empresaRepository = empresaRepository;
        this.lectorDeOferta = lectorDeOferta;
    }

    /** Ofertas que se pueden mostrar hoy: abiertas y sin vencer. */
    public Page<VacanteResponse> listarActivas(Pageable pageable) {
        return vacanteRepository.findVigentes(LocalDateTime.now(), pageable)
                .map(this::toResponse);
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
        vacante.setDescripcion(request.descripcion());
        aplicarDatos(vacante, request);
        vacante.setFechaExpiracion(request.fechaExpiracion());

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

    /** Campos que se copian igual al crear y al editar. */
    private void aplicarDatos(Vacante vacante, VacanteRequest request) {
        vacante.setRequisitos(request.requisitos());
        vacante.setUbicacion(request.ubicacion());
        vacante.setCiudad(request.ciudad());
        vacante.setRangoSalarial(request.rangoSalarial());
        vacante.setTipoContrato(request.tipoContrato());
        vacante.setJornada(request.jornada());
        vacante.setModalidadTrabajo(request.modalidadTrabajo());
        vacante.setNivelInglesRequerido(request.nivelInglesRequerido());
        vacante.setAniosExperienciaRequeridos(request.aniosExperienciaRequeridos());
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
        return toResponse(vacanteRepository.save(vacante));
    }

    /** Ofertas registradas por estudiantes y aun sin validar. */
    public Page<VacanteResponse> pendientesDeRevisar(Pageable pageable) {
        return vacanteRepository.findByRevisadaFalseAndActivoTrue(pageable).map(this::toResponse);
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
        return empresaRepository.findByNombre(nombre).orElseGet(() -> {
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
        return new VacanteResponse(
                v.getId(), v.getTitulo(), v.getDescripcion(), v.getRequisitos(),
                v.getUbicacion(), v.getRangoSalarial(), v.getTipoContrato(), v.getModalidadTrabajo(),
                v.getNivelInglesRequerido(), v.getAniosExperienciaRequeridos(), v.getFuente(),
                v.getUrlOrigen(), v.getUrlAplicar(),
                v.getEmpresa() != null ? v.getEmpresa().getNombre() : null,
                v.getFechaPublicacion(), v.getCreatedAt(),
                v.isActivo(),
                v.getFechaExpiracion(),
                v.getMotivoCierre() == null ? null : v.getMotivoCierre().name(),
                v.getCiudad(), v.getJornada(), v.isRevisada(), v.getCreadaPor());
    }
}
