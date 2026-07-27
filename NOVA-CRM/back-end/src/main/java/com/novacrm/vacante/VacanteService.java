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
     * Registra una oferta a mano a partir de su enlace.
     *
     * <p>Lo que no venga en la peticion se intenta completar leyendo la propia
     * pagina; si no se puede, la oferta se guarda igual y queda por completar.
     */
    @Transactional
    public VacanteResponse crearDesdeUrl(VacanteRequest request, String creadaPor) {
        String url = request.url().trim();

        vacanteRepository.findByUrlOrigen(url).ifPresent(existente -> {
            throw new BusinessException("Esa oferta ya esta registrada: " + existente.getTitulo());
        });

        var vacante = new Vacante();
        vacante.setUrlOrigen(url);
        vacante.setUrlAplicar(url);
        vacante.setFuente(FUENTE_MANUAL);
        vacante.setCreadaPor(creadaPor);
        vacante.setActivo(true);
        vacante.setFechaPublicacion(LocalDateTime.now());
        vacante.setFechaExpiracion(request.fechaExpiracion());
        vacante.setHashDedup(sha256(FUENTE_MANUAL + "|" + url));

        var metadatos = lectorDeOferta.leer(url);

        vacante.setTitulo(primeroNoVacio(
                request.titulo(),
                metadatos.map(LectorDeOferta.Metadatos::titulo).orElse(null),
                "Oferta sin titulo"));
        vacante.setDescripcion(primeroNoVacio(
                request.descripcion(),
                metadatos.map(LectorDeOferta.Metadatos::descripcion).orElse(null)));

        vacante.setRequisitos(request.requisitos());
        vacante.setUbicacion(request.ubicacion());
        vacante.setRangoSalarial(request.rangoSalarial());
        vacante.setTipoContrato(request.tipoContrato());
        vacante.setModalidadTrabajo(request.modalidadTrabajo());
        vacante.setNivelInglesRequerido(request.nivelInglesRequerido());
        vacante.setAniosExperienciaRequeridos(request.aniosExperienciaRequeridos());

        String empresaNombre = primeroNoVacio(
                request.empresaNombre(),
                metadatos.map(LectorDeOferta.Metadatos::sitio).orElse(null));
        if (empresaNombre != null) {
            vacante.setEmpresa(empresaOCrear(empresaNombre));
        }

        return toResponse(vacanteRepository.save(vacante));
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
                v.getMotivoCierre() == null ? null : v.getMotivoCierre().name());
    }
}
