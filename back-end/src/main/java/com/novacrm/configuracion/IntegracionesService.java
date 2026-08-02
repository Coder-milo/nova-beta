package com.novacrm.configuracion;

import com.novacrm.configuracion.EstadoIntegracion.Detalle;
import com.novacrm.configuracion.EstadoIntegracion.ResultadoPrueba;
import com.novacrm.ia.ProveedorIa;
import com.novacrm.scraper.fuente.ControlDeCuota;
import com.novacrm.scraper.fuente.FuenteDeVacantes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Que integraciones estan realmente conectadas.
 *
 * <p>Todo lo que se informa se lee del estado vivo de la aplicacion —los mismos
 * objetos que usan el importador, el matching y el envio de correo—, no de una
 * copia guardada aparte. La pantalla de configuracion enseñaba valores que
 * alguien habia tecleado en el navegador y que el servidor nunca veia; con esto
 * lo que se ve es lo que hay.
 */
@Service
public class IntegracionesService {

    private final ProveedorIa proveedorIa;
    private final List<FuenteDeVacantes> fuentes;
    private final ControlDeCuota controlDeCuota;

    private final String modeloIa;
    private final int limiteJsearch;
    private final String smtpHost;
    private final String smtpUsuario;
    private final String remitente;
    private final String minioEndpoint;
    private final String minioBucket;
    private final String minioAccessKey;

    public IntegracionesService(
            ProveedorIa proveedorIa,
            List<FuenteDeVacantes> fuentes,
            ControlDeCuota controlDeCuota,
            @Value("${app.ia.groq.modelo:}") String modeloIa,
            @Value("${app.scraping.jsearch.limite-mensual:200}") int limiteJsearch,
            @Value("${spring.mail.host:}") String smtpHost,
            @Value("${spring.mail.username:}") String smtpUsuario,
            @Value("${app.correo.remitente:}") String remitente,
            @Value("${app.minio.url:}") String minioEndpoint,
            @Value("${app.minio.bucket:}") String minioBucket,
            @Value("${app.minio.access-key:}") String minioAccessKey) {
        this.proveedorIa = proveedorIa;
        this.fuentes = fuentes;
        this.controlDeCuota = controlDeCuota;
        this.modeloIa = modeloIa;
        this.limiteJsearch = limiteJsearch;
        this.smtpHost = smtpHost;
        this.smtpUsuario = smtpUsuario;
        this.remitente = remitente;
        this.minioEndpoint = minioEndpoint;
        this.minioBucket = minioBucket;
        this.minioAccessKey = minioAccessKey;
    }

    public List<EstadoIntegracion> listar() {
        var estados = new ArrayList<EstadoIntegracion>();
        estados.add(ia());
        estados.addAll(fuentesDeVacantes());
        estados.add(correo());
        estados.add(almacenamiento());
        return estados;
    }

    /** Asistencia de IA para reconocer hojas, columnas y hojas de vida. */
    private EstadoIntegracion ia() {
        boolean lista = proveedorIa != null && proveedorIa.disponible();
        var detalles = new ArrayList<Detalle>();
        if (proveedorIa != null) {
            detalles.add(new Detalle("Proveedor", proveedorIa.nombre()));
        }
        if (!modeloIa.isBlank()) {
            detalles.add(new Detalle("Modelo", modeloIa));
        }
        return new EstadoIntegracion(
                "ia", "Asistencia de IA", "Reconocimiento", lista,
                lista
                        ? "Reconoce hojas y columnas que los diccionarios de sinónimos no cubren, y extrae datos de hojas de vida."
                        : "Sin clave. La importación y la extracción de HV siguen funcionando con los diccionarios y las heurísticas de siempre.",
                detalles,
                List.of("GROQ_API_KEY", "GROQ_MODELO"),
                lista,
                "La IA solo sugiere: el sistema valida cada sugerencia contra su propio vocabulario antes de usarla.");
    }

    /** Una entrada por portal de vacantes registrado. */
    private List<EstadoIntegracion> fuentesDeVacantes() {
        var estados = new ArrayList<EstadoIntegracion>();
        for (var fuente : fuentes) {
            boolean activa = fuente.estaHabilitada();
            var detalles = new ArrayList<Detalle>();
            detalles.add(new Detalle("Segmento", legible(fuente.segmento().name())));
            detalles.add(new Detalle("Consultas por corrida",
                    fuente.maximoConsultasPorCorrida() == Integer.MAX_VALUE
                            ? "sin tope" : String.valueOf(fuente.maximoConsultasPorCorrida())));

            String resumen;
            String advertencia = null;
            if ("JSEARCH".equals(fuente.nombre())) {
                // El cupo es lo unico que de verdad hay que vigilar aqui: son
                // 200 al mes y es la unica via a vacantes colombianas.
                int restantes = controlDeCuota.restantes(fuente.nombre(), limiteJsearch);
                detalles.add(new Detalle("Cupo restante este mes",
                        restantes + " de " + limiteJsearch));
                resumen = activa
                        ? "Única fuente de vacantes locales en Colombia."
                        : "Sin clave. El segmento local se queda sin ofertas.";
                if (activa && restantes == 0) {
                    advertencia = "Cupo agotado: no se traerán vacantes locales hasta el próximo mes.";
                } else if (activa && restantes < limiteJsearch / 10) {
                    advertencia = "Queda menos del 10% del cupo mensual.";
                }
            } else if ("ELEMPLEO".equals(fuente.nombre())) {
                resumen = activa
                        ? "Activo. Requiere acuerdo con el portal."
                        : "Desactivado a propósito.";
                advertencia = "Extraer contenido de elempleo.com está restringido por sus condiciones de uso. "
                        + "No activar sin un acuerdo con el portal.";
            } else {
                resumen = activa ? "Conectado, sin cupo." : "Desactivado.";
            }

            estados.add(new EstadoIntegracion(
                    "fuente-" + fuente.nombre().toLowerCase(Locale.ROOT),
                    legible(fuente.nombre()), "Vacantes", activa, resumen, detalles,
                    variablesDe(fuente.nombre()),
                    // Probar gastaria una peticion del cupo mensual, que es
                    // justo lo que se intenta cuidar.
                    false, advertencia));
        }
        return estados;
    }

    private static List<String> variablesDe(String fuente) {
        return switch (fuente) {
            case "JSEARCH" -> List.of("JSEARCH_API_KEY", "SCRAPING_JSEARCH_ENABLED",
                    "JSEARCH_LIMITE_MENSUAL", "JSEARCH_CONSULTAS_POR_CORRIDA");
            case "REMOTIVE" -> List.of("SCRAPING_REMOTIVE_ENABLED");
            case "ARBEITNOW" -> List.of("SCRAPING_ARBEITNOW_ENABLED", "ARBEITNOW_SOLO_CON_VISA");
            case "ELEMPLEO" -> List.of("SCRAPING_ELEMPLEO_ENABLED");
            default -> List.of();
        };
    }

    private EstadoIntegracion correo() {
        boolean smtp = !smtpHost.isBlank();
        var detalles = new ArrayList<Detalle>();
        detalles.add(new Detalle("Vía", smtp ? "SMTP" : "Amazon SES"));
        if (smtp) {
            detalles.add(new Detalle("Servidor", smtpHost));
            if (!smtpUsuario.isBlank()) {
                detalles.add(new Detalle("Usuario", smtpUsuario));
            }
        }
        if (!remitente.isBlank()) {
            detalles.add(new Detalle("Remitente", remitente));
        }
        return new EstadoIntegracion(
                "correo", "Correo saliente", "Mensajería", smtp || !remitente.isBlank(),
                smtp ? "Los correos salen por SMTP." : "Sin servidor SMTP: se usa Amazon SES.",
                detalles,
                List.of("SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "CORREO_REMITENTE"),
                false,
                "Mientras CORREO_DESTINATARIOS_PERMITIDOS tenga direcciones, solo se escribe a ellas.");
    }

    private EstadoIntegracion almacenamiento() {
        boolean listo = !minioAccessKey.isBlank();
        return new EstadoIntegracion(
                "almacenamiento", "Almacenamiento de archivos", "Infraestructura", listo,
                listo ? "Hojas de vida y adjuntos se guardan en el bucket."
                      : "Sin credenciales: no se pueden guardar archivos.",
                List.of(new Detalle("Endpoint", minioEndpoint),
                        new Detalle("Bucket", minioBucket)),
                List.of("MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "MINIO_BUCKET"),
                false, null);
    }

    /**
     * Prueba de conexion en vivo.
     *
     * <p>Solo para lo que se puede comprobar sin efectos: la IA responde a una
     * consulta minima. Las fuentes con cupo no se prueban —gastar una de las
     * 200 peticiones del mes para saber que la clave sirve es justo lo que se
     * intenta evitar— y el correo tampoco, porque una prueba real implica
     * mandar un mensaje a alguien.
     */
    public ResultadoPrueba probar(String id) {
        if (!"ia".equals(id)) {
            return new ResultadoPrueba(false, "Esta integración no admite prueba en vivo.");
        }
        if (proveedorIa == null || !proveedorIa.disponible()) {
            return new ResultadoPrueba(false, "No hay clave configurada: define GROQ_API_KEY y reinicia.");
        }
        var respuesta = proveedorIa.completarJson(
                "Respondes SOLO con JSON.",
                "Responde exactamente {\"ok\": true}");
        if (respuesta.isEmpty()) {
            return new ResultadoPrueba(false,
                    "El proveedor no respondió. Puede ser una clave inválida, el cupo del tier gratuito agotado o un problema de red.");
        }
        return new ResultadoPrueba(true, "Conexión correcta con " + proveedorIa.nombre() + ".");
    }

    private static String legible(String constante) {
        String texto = constante.replace('_', ' ').toLowerCase(Locale.ROOT);
        return texto.substring(0, 1).toUpperCase(Locale.ROOT) + texto.substring(1);
    }
}
