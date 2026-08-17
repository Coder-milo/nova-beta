package com.novacrm.captacion;

import com.novacrm.auditoria.AuditoriaService;
import com.novacrm.exception.BusinessException;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;

/**
 * Una empresa que no tiene cuenta manda una oferta.
 *
 * <p>Hoy solo publica quien ya tiene cuenta del portal, y las cuentas son por
 * invitación: una empresa que llega por su cuenta —una feria, una recomendación,
 * el pie de una página— no tiene por dónde entrar y se pierde.
 *
 * <h2>Lo que este servicio no hace, y por qué</h2>
 *
 * <p>Es la única escritura del sistema que puede hacer cualquiera sin
 * identificarse. Casi todo el diseño es lo que <em>no</em> ocurre:
 *
 * <ul>
 *   <li><strong>No crea ni toca una cuenta.</strong> Ni de empresa ni de nadie.
 *       Un formulario público que crea credenciales es un alta de usuarios
 *       abierta a internet.
 *   <li><strong>No enlaza con una empresa existente por el nombre.</strong> El
 *       alta interna sí lo hace, y aquí sería dejar que un desconocido publique
 *       como «Tecnoglass» y que la empresa real lo vea entre sus vacantes.
 *       El nombre queda como texto declarado; el enlace lo hace una persona.
 *   <li><strong>No lee ninguna URL.</strong> El alta interna completa datos
 *       leyendo el enlace de la oferta. Hacerlo sin autenticar convertiría el
 *       servidor en un cliente HTTP a las órdenes de cualquiera, capaz de
 *       alcanzar direcciones internas que desde fuera no se ven.
 *   <li><strong>No manda ningún correo</strong>, ni siquiera de confirmación a
 *       quien lo envía. La dirección no está verificada: mandarle algo la
 *       convierte en un relay —se pone el correo de una víctima y el sistema le
 *       escribe— y en un delator de si esa dirección existe.
 *   <li><strong>No devuelve identificadores.</strong> La respuesta es la misma
 *       frase siempre, así que no se puede usar para averiguar nada.
 *   <li><strong>No se ve hasta que alguien la lee.</strong> Nace
 *       {@code revisada = false} y el listado excluye lo público sin revisar,
 *       cosa que no hace con las que sugiere un participante: eso lo escribe
 *       alguien conocido; esto, cualquiera.
 * </ul>
 *
 * <p>El límite de peticiones vive en {@code RateLimitFilter}, que es donde
 * puede frenar antes de tocar la base de datos.
 */
@Service
public class CaptacionPublicaService {

    private static final Logger log = LoggerFactory.getLogger(CaptacionPublicaService.class);

    /** Marca de origen. La consulta del listado la usa para no enseñarlas. */
    public static final String FUENTE = "FORMULARIO_PUBLICO";

    private final VacanteRepository vacanteRepository;
    private final AuditoriaService auditoriaService;

    public CaptacionPublicaService(VacanteRepository vacanteRepository,
                                   AuditoriaService auditoriaService) {
        this.vacanteRepository = vacanteRepository;
        this.auditoriaService = auditoriaService;
    }

    @Transactional
    public void recibir(SolicitudPublicaDeVacante solicitud) {
        // La trampa: un campo que el formulario esconde y ninguna persona ve.
        // Se rechaza con un mensaje claro en vez de fingir que se guardó —si un
        // autocompletado agresivo se lo llena a alguien de verdad, esa persona
        // tiene que poder darse cuenta y corregirlo—.
        if (solicitud.apodo() != null && !solicitud.apodo().isBlank()) {
            throw new BusinessException("Deja vacio el campo que dice no llenar.");
        }

        String empresa = limpiar(solicitud.empresa(), 200);
        String titulo = limpiar(solicitud.titulo(), 200);
        String huella = sha256(FUENTE + "|" + empresa.toLowerCase() + "|" + titulo.toLowerCase());

        // Mismo texto y misma empresa: es un reenvío, no una oferta nueva. Sin
        // esto, el botón «enviar» pulsado tres veces llena la cola con tres
        // copias que alguien tiene que leer y descartar una por una.
        if (vacanteRepository.findByHashDedup(huella).isPresent()) {
            throw new BusinessException(
                    "Ya recibimos esa oferta y esta en revision. No hace falta enviarla otra vez.");
        }

        var vacante = new Vacante();
        vacante.setFuente(FUENTE);
        vacante.setTitulo(titulo);
        vacante.setDescripcion(limpiar(solicitud.descripcion(), 5000));
        vacante.setRequisitos(limpiarOpcional(solicitud.requisitos(), 3000));
        vacante.setCiudad(limpiarOpcional(solicitud.ciudad(), 255));
        vacante.setUbicacion(limpiarOpcional(solicitud.ciudad(), 255));
        vacante.setModalidadTrabajo(limpiarOpcional(solicitud.modalidad(), 60));
        vacante.setTipoContrato(limpiarOpcional(solicitud.tipoContrato(), 60));
        vacante.setRangoSalarial(limpiarOpcional(solicitud.rangoSalarial(), 100));

        vacante.setEmpresaDeclarada(empresa);
        vacante.setContactoDeclarado(limpiar(solicitud.contacto(), 200));
        vacante.setEmailDeclarado(limpiar(solicitud.email(), 255));
        vacante.setTelefonoDeclarado(limpiarOpcional(solicitud.telefono(), 40));

        vacante.setActivo(true);
        vacante.setBorrador(false);
        vacante.setRevisada(false);
        vacante.setHashDedup(huella);
        // Sin fecha de publicación: no está publicada. La pone quien la apruebe.
        vacante.setFechaPublicacion(null);

        var guardada = vacanteRepository.save(vacante);

        // Queda en auditoría con la IP que resuelve AuditoriaService. Si un día
        // llega una tanda de basura, es lo único con lo que se puede saber de
        // dónde vino.
        auditoriaService.registrar("Vacantes", "Captacion publica", "Vacante",
                guardada.getId().toString(), titulo + " (" + empresa + ")", null, null);
        log.info("Oferta recibida por el formulario publico: {} ({})", titulo, empresa);
    }

    /**
     * Recorta y valida largo.
     *
     * <p>El {@code @Size} del DTO ya rechaza lo que se pasa, pero el recorte
     * está igualmente: la columna tiene un límite y una excepción de base de
     * datos aquí sería un 500 en vez de un mensaje.
     */
    private static String limpiar(String valor, int max) {
        String limpio = valor == null ? "" : valor.trim();
        return limpio.length() > max ? limpio.substring(0, max) : limpio;
    }

    private static String limpiarOpcional(String valor, int max) {
        String limpio = limpiar(valor, max);
        return limpio.isEmpty() ? null : limpio;
    }

    private static String sha256(String entrada) {
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of()
                    .formatHex(digest.digest(entrada.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }
}
