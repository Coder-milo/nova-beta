package com.novacrm.branding;

import com.novacrm.auth.OwnershipService;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.programa.ProgramaRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Lee y guarda la identidad visual de cada programa.
 *
 * <p>La regla de aislamiento vive aqui y no solo en el controlador: un
 * estudiante solo puede consultar el branding del programa en el que esta
 * matriculado. Ver la marca de otro cliente es ver que ese cliente existe.
 */
@Service
public class BrandingService {

    /** El mismo formato que valida la restriccion de la tabla. */
    private static final Pattern HEX = Pattern.compile("^#[0-9A-Fa-f]{6}$");

    private final BrandingRepository brandingRepository;
    private final ProgramaRepository programaRepository;
    private final OwnershipService ownershipService;

    public BrandingService(BrandingRepository brandingRepository,
                           ProgramaRepository programaRepository,
                           OwnershipService ownershipService) {
        this.brandingRepository = brandingRepository;
        this.programaRepository = programaRepository;
        this.ownershipService = ownershipService;
    }

    /**
     * La identidad de un programa, comprobando antes que quien pregunta puede
     * verla. Si no hay personalizacion devuelve una vacia, que es como se
     * expresa "usa la gama global del panel".
     */
    @Transactional(readOnly = true)
    public BrandingResponse consultar(Authentication auth, UUID programaId) {
        ownershipService.verificarAccesoPrograma(auth, programaId);
        return leer(programaId);
    }

    /** La identidad del programa del propio estudiante, sin que tenga que saber su id. */
    @Transactional(readOnly = true)
    public BrandingResponse consultarElMio(Authentication auth) {
        return leer(ownershipService.programaDelEstudianteAutenticado(auth));
    }

    private BrandingResponse leer(UUID programaId) {
        var programa = programaRepository.findById(programaId)
                .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado"));

        return brandingRepository.findById(programaId)
                .map(b -> BrandingResponse.de(programa.getNombre(), b))
                .orElseGet(() -> BrandingResponse.sinPersonalizar(programaId, programa.getNombre()));
    }

    /**
     * Guarda la identidad. Solo ADMIN o COORDINADOR llegan aqui; lo garantiza
     * la regla de URL y el {@code @PreAuthorize} del controlador.
     */
    @Transactional
    public BrandingResponse guardar(UUID programaId, BrandingRequest request) {
        var programa = programaRepository.findById(programaId)
                .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado"));

        validar(request);

        var branding = brandingRepository.findById(programaId)
                .orElseGet(() -> new ProgramaBranding(programaId));

        branding.setColorPrimario(normalizarColor(request.colorPrimario()));
        branding.setTituloHeader(vacioComoNulo(request.tituloHeader()));
        branding.setSubtituloHeader(vacioComoNulo(request.subtituloHeader()));

        branding.setBannerPanelUrl(vacioComoNulo(request.bannerPanelUrl()));
        branding.setBannerPanelAncho(request.bannerPanelAncho());
        branding.setBannerPanelAlto(request.bannerPanelAlto());

        branding.setCorreoHeaderUrl(vacioComoNulo(request.correoHeaderUrl()));
        branding.setCorreoHeaderAncho(request.correoHeaderAncho());
        branding.setCorreoHeaderAlto(request.correoHeaderAlto());

        branding.setCorreoPieUrl(vacioComoNulo(request.correoPieUrl()));
        branding.setCorreoPieAncho(request.correoPieAncho());
        branding.setCorreoPieAlto(request.correoPieAlto());
        branding.setCorreoTextoPie(vacioComoNulo(request.correoTextoPie()));

        branding.tocar();
        brandingRepository.save(branding);

        return BrandingResponse.de(programa.getNombre(), branding);
    }

    /** Volver a la gama global: se borra la fila, que es lo que eso significa. */
    @Transactional
    public void restablecer(UUID programaId) {
        brandingRepository.deleteById(programaId);
    }

    /**
     * Todos los motivos de rechazo de una vez.
     *
     * <p>Devolver el primero y callar el resto obliga a guardar, corregir y
     * volver a guardar tantas veces como errores haya; con tres imagenes y un
     * color eso son cuatro viajes para una sola pantalla.
     */
    private void validar(BrandingRequest request) {
        var motivos = new ArrayList<String>();

        String color = normalizarColor(request.colorPrimario());
        if (color != null && !HEX.matcher(color).matches()) {
            motivos.add("El color primario debe ser un hexadecimal tipo #1268E8; llego: "
                    + request.colorPrimario());
        }

        agregarSiFalla(motivos, MedidasExigidas.BANNER_PANEL,
                request.bannerPanelAncho(), request.bannerPanelAlto(), request.bannerPanelUrl());
        agregarSiFalla(motivos, MedidasExigidas.CORREO_HEADER,
                request.correoHeaderAncho(), request.correoHeaderAlto(), request.correoHeaderUrl());
        agregarSiFalla(motivos, MedidasExigidas.CORREO_PIE,
                request.correoPieAncho(), request.correoPieAlto(), request.correoPieUrl());

        if (!motivos.isEmpty()) {
            throw new BusinessException(String.join(" ", motivos));
        }
    }

    private void agregarSiFalla(List<String> motivos, MedidasExigidas.Medida exigida,
                                Integer ancho, Integer alto, String url) {
        if (vacioComoNulo(url) == null) {
            // Sin imagen no hay medidas que exigir.
            return;
        }
        String fallo = MedidasExigidas.validar(exigida, ancho, alto);
        if (fallo != null) {
            motivos.add(fallo);
        }
    }

    /** Hex en mayusculas para que #1268e8 y #1268E8 no se guarden distinto. */
    private static String normalizarColor(String color) {
        String limpio = vacioComoNulo(color);
        return limpio == null ? null : limpio.toUpperCase();
    }

    /**
     * Una cadena vacia y un null significan lo mismo —"no hay valor"— y
     * guardar las dos formas obliga a comprobarlas por separado en todas partes.
     */
    private static String vacioComoNulo(String valor) {
        if (valor == null) return null;
        String limpio = valor.trim();
        return limpio.isEmpty() ? null : limpio;
    }

    /** Lo que la aplicacion necesita para pintar un correo de este programa. */
    @Transactional(readOnly = true)
    public Optional<ProgramaBranding> paraCorreo(UUID programaId) {
        return programaId == null ? Optional.empty() : brandingRepository.findById(programaId);
    }
}
