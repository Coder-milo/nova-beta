package com.novacrm.correo;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Las variables que se pueden escribir en una plantilla de correo.
 *
 * <p>Clase de funciones puras: se prueba sin Spring ni base de datos.
 *
 * <p>Dos decisiones que importan mas de lo que parecen:
 *
 * <ul>
 *   <li><strong>Los valores se escapan al sustituir.</strong> Vienen de una
 *       importacion de Excel con datos reales, y basta un nombre con
 *       {@code &} o {@code <} para romper el HTML del correo. Escapar aqui y no
 *       en cada sitio que construye un mensaje es lo que hace que no se olvide.
 *   <li><strong>Una variable desconocida es un error, no un hueco.</strong> Si
 *       {@code {{empresa}}} mal escrito se dejara pasar, los 108 estudiantes
 *       recibirian el texto literal en medio de la frase. Se rechaza al guardar,
 *       que es cuando hay alguien mirando la pantalla.
 * </ul>
 */
public enum Variables {

    // Estudiante
    NOMBRE("nombre", "Nombre del estudiante", "Héctor Luis", "Estudiante"),
    APELLIDO("apellido", "Apellidos del estudiante", "Suárez Arroyo", "Estudiante"),
    EMAIL("email", "Correo electrónico del estudiante", "hector@ejemplo.com", "Estudiante"),

    // Empleo / Vacante
    EMPRESA("empresa", "Empresa de la vacante o aliada", "Konecta", "Empleo"),
    CARGO("cargo", "Cargo o posición de la vacante", "Representante Bilingüe", "Empleo"),
    PROGRAMA("programa", "Nombre del programa de formación o inserción", "Ruta BPO Bilingüe", "Empleo"),

    // Entrevista
    FECHA_ENTREVISTA("fecha_entrevista", "Fecha y hora de la entrevista", "15 de Septiembre, 10:00 AM", "Entrevista"),
    MODALIDAD_ENTREVISTA("modalidad_entrevista", "Modalidad de la entrevista (Presencial / Virtual)", "Virtual (Microsoft Teams)", "Entrevista"),
    LUGAR_ENTREVISTA("lugar_entrevista", "Lugar físico o enlace de conexión", "https://teams.microsoft.com/l/meetup-join/ejemplo", "Entrevista"),

    // Coordinador y Emisor
    COORDINADOR_NOMBRE("coordinador_nombre", "Nombre del coordinador emisor", "Lic. Carlos Mendoza", "Coordinador"),
    COORDINADOR_CARGO("coordinador_cargo", "Cargo o rol del coordinador", "Coordinador de Empleabilidad", "Coordinador"),
    COORDINADOR_CONTACTO("coordinador_contacto", "Canal o correo del coordinador", "empleabilidad@novacrm.org", "Coordinador"),

    // Proyecto e Iniciativa
    PROYECTO_NOMBRE("proyecto_nombre", "Nombre del proyecto o iniciativa", "Ruta Accelerator", "Proyecto"),
    LEMA_PROYECTO("lema_proyecto", "Lema o eslogan del proyecto", "Impulsando el talento bilingüe", "Proyecto"),

    // Sistema
    ENLACE_BOTON("enlace_boton", "Enlace de destino para botón de acción", "https://panel.ejemplo.com/accion", "Sistema"),
    LINK("link", "Enlace personal de activación o recuperación",
            "https://panel.ejemplo.com/recuperar-contrasena?token=…", "Sistema");

    /** {@code {{ nombre }}} con espacios opcionales, insensible a mayusculas. */
    private static final Pattern MARCA = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_]+)\\s*}}");

    private final String clave;
    private final String descripcion;
    private final String ejemplo;
    private final String categoria;

    Variables(String clave, String descripcion, String ejemplo, String categoria) {
        this.clave = clave;
        this.descripcion = descripcion;
        this.ejemplo = ejemplo;
        this.categoria = categoria;
    }

    public String clave() { return clave; }
    public String descripcion() { return descripcion; }
    public String ejemplo() { return ejemplo; }
    public String categoria() { return categoria; }

    /** Como se escribe en la plantilla. Lo muestra la ayuda del editor. */
    public String marca() { return "{{" + clave + "}}"; }

    public static Optional<Variables> desde(String clave) {
        if (clave == null) return Optional.empty();
        String limpia = clave.trim().toLowerCase();
        return Arrays.stream(values()).filter(v -> v.clave.equals(limpia)).findFirst();
    }

    /**
     * Las variables que aparecen en un texto, en orden y sin repetir.
     *
     * <p>Sirve para avisar antes de enviar: una plantilla con {@code {{empresa}}}
     * necesita una vacante detras, y en un envio masivo a estudiantes puede no
     * haberla.
     */
    public static List<Variables> usadasEn(String texto) {
        var encontradas = new LinkedHashSet<Variables>();
        if (texto == null) return List.of();
        Matcher m = MARCA.matcher(texto);
        while (m.find()) {
            desde(m.group(1)).ifPresent(encontradas::add);
        }
        return List.copyOf(encontradas);
    }

    /**
     * Las marcas que parecen variables pero no lo son.
     *
     * @return los nombres tal como se escribieron, para poder senalarlos
     */
    public static List<String> desconocidasEn(String texto) {
        var malas = new ArrayList<String>();
        if (texto == null) return malas;
        Matcher m = MARCA.matcher(texto);
        while (m.find()) {
            if (desde(m.group(1)).isEmpty() && !malas.contains(m.group(1))) {
                malas.add(m.group(1));
            }
        }
        return malas;
    }

    /**
     * Sustituye las variables por sus valores, escapando cada valor.
     *
     * <p>Una variable sin valor se deja <strong>vacia</strong> y no con su
     * marca: es preferible una frase con un hueco a una que le ensena
     * {@code {{empresa}}} al destinatario.
     *
     * @param plantilla texto con marcas
     * @param valores   valor por clave; las claves que falten quedan vacias
     */
    public static String aplicar(String plantilla, Map<Variables, String> valores) {
        if (plantilla == null) return "";
        Matcher m = MARCA.matcher(plantilla);
        StringBuilder salida = new StringBuilder();
        while (m.find()) {
            String reemplazo = desde(m.group(1))
                    .map(v -> valores == null ? "" : valores.getOrDefault(v, ""))
                    .map(Variables::escapar)
                    // Una marca desconocida se borra en lugar de dejarla a la
                    // vista. No deberia llegar aqui —se valida al guardar—,
                    // pero si llega, el destinatario no tiene por que verla.
                    .orElse("");
            m.appendReplacement(salida, Matcher.quoteReplacement(reemplazo));
        }
        m.appendTail(salida);
        return salida.toString();
    }

    /** Valores de ejemplo, para la previsualizacion del editor. */
    public static Map<Variables, String> ejemplos() {
        var mapa = new java.util.EnumMap<Variables, String>(Variables.class);
        for (var v : values()) {
            mapa.put(v, v.ejemplo);
        }
        return mapa;
    }

    /**
     * El mismo escapado que usa la plantilla. Se repite aqui a proposito para
     * que esta clase no dependa de la de presentacion y siga siendo pura.
     */
    static String escapar(String valor) {
        if (valor == null) return "";
        return valor.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    /** Todas, para que el editor pinte la ayuda sin llevar la lista escrita. */
    public static Set<Variables> todas() {
        return java.util.EnumSet.allOf(Variables.class);
    }
}
