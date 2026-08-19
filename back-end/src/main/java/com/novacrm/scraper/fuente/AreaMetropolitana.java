package com.novacrm.scraper.fuente;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Donde una oferta le sirve de verdad a esta cohorte.
 *
 * <p>No es una lista inventada: sale de donde viven los participantes. De los
 * 108 activos, 73 estan en Barranquilla, 26 en Soledad, 4 en Malambo y 1 en
 * Galapa —104 de 108 en la misma area metropolitana—. Una vacante en Bogota es
 * una oferta real, pero para casi todos ellos implica mudarse, y recomendarla
 * sin mas gasta la atencion que deberia ir a la que si pueden tomar.
 *
 * <p>Se incluyen tambien los municipios contiguos donde no vive nadie hoy
 * —Puerto Colombia, Sabanalarga— porque el desplazamiento diario es el mismo y
 * la cohorte cambia cada convocatoria.
 *
 * <p>Esto no descarta nada: {@code ScrapingService} guarda lo que le llegue.
 * Lo que hace es decirle a la fuente que no gaste sus consultas trayendo
 * ofertas que despues nadie va a poder tomar.
 */
public final class AreaMetropolitana {

    /**
     * Municipios del area metropolitana de Barranquilla y su entorno inmediato,
     * normalizados —sin tildes ni mayusculas— para poder compararlos con lo que
     * publique cada portal.
     */
    /**
     * Todos los municipios del departamento del Atlántico (Colombia),
     * normalizados sin tildes ni mayúsculas.
     */
    private static final Set<String> MUNICIPIOS = Set.of(
            "barranquilla",
            "soledad",
            "malambo",
            "galapa",
            "puerto colombia",
            "sabanalarga",
            "baranoa",
            "palmar de varela",
            "santo tomas",
            "polonuevo",
            "tubara",
            "luruaco",
            "suan",
            "campo de la cruz",
            "ponedera",
            "candelaria",
            "juan de acosta",
            "piojo",
            "repelon",
            "santa lucia",
            "usiacuri",
            "manati");

    /** El departamento, para cuando el portal solo publica la region. */
    private static final Set<String> REGIONES = Set.of("atlantico", "atlántico");

    /** Señales inequívocas de que la oferta es remota / teletrabajo. */
    private static final Set<String> SENALES_REMOTO = Set.of(
            "remoto", "remote", "teletrabajo", "home office", "work from home",
            "virtual", "desde casa", "trabajo en casa", "100% remoto", "worldwide",
            "anywhere", "global", "latam");

    /**
     * Principales ciudades y áreas metropolitanas fuera del Atlántico.
     * Si una oferta está en una de estas ciudades y NO es remota, se excluye.
     */
    private static final Set<String> OTRAS_CIUDADES = Set.of(
            "bogota", "medellin", "cali", "bucaramanga", "cartagena",
            "santa marta", "pereira", "manizales", "cucuta", "ibague",
            "villavicencio", "pasto", "monteria", "valledupar", "neiva",
            "armenia", "popayan", "sincelejo", "tunja", "riohacha",
            "florencia", "yopal", "quibdo", "arauca", "mocoa",
            "san andres", "leticia", "soacha", "bello", "itagui",
            "envigado", "palmira", "floridablanca", "dosquebradas",
            "chia", "facatativa", "zipaquira", "madrid", "funza",
            "mosquera", "girardot", "fusagasuga", "tulua", "cartago");

    private AreaMetropolitana() {
    }

    /** Las ciudades donde buscar, de mayor a menor poblacion del programa. */
    public static List<String> ciudadesDeBusqueda() {
        return List.of("Barranquilla", "Soledad", "Malambo");
    }

    /**
     * Si una oferta publicada en esa ciudad o region le sirve a la cohorte.
     */
    public static boolean esCercana(String ciudad, String region) {
        String c = normalizar(ciudad);
        String r = normalizar(region);
        if (c.isBlank() && r.isBlank()) {
            return true;
        }
        if (!c.isBlank() && MUNICIPIOS.stream().anyMatch(m -> c.contains(normalizar(m)))) {
            return true;
        }
        return !r.isBlank() && REGIONES.stream().anyMatch(reg -> r.contains(normalizar(reg)));
    }

    /**
     * Determina si una vacante es admisible para el programa:
     * 1. Es REMOTA (cualquier ciudad o país de origen, si la modalidad es remota/teletrabajo).
     * 2. O está ubicada físicamente en el Atlántico / Barranquilla.
     *
     * Si está ubicada en Bogotá u otra ciudad fuera del Atlántico y es presencial, se descarta.
     */
    public static boolean esAtlanticoORemota(com.novacrm.vacante.Vacante vacante) {
        if (vacante == null) {
            return false;
        }
        // Lo que viene de bolsas de empleo 100% remotas es válido por definición
        if (vacante.getSegmento() == Segmento.REMOTO_INGLES) {
            return true;
        }

        String modalidad = normalizar(vacante.getModalidadTrabajo());
        String ubicacion = normalizar(vacante.getUbicacion());
        String ciudad = normalizar(vacante.getCiudad());
        String titulo = normalizar(vacante.getTitulo());
        String descripcion = normalizar(vacante.getDescripcion());
        String requisitos = normalizar(vacante.getRequisitos());

        String textoCompleto = String.join(" ", modalidad, ubicacion, ciudad, titulo, descripcion, requisitos);

        // 1. ¿Es remota?
        boolean esRemoto = SENALES_REMOTO.stream().anyMatch(s -> textoCompleto.contains(s) || modalidad.contains(s));
        if (esRemoto) {
            // Asegurar que modalidadTrabajo refleje que es remota si no estaba definida
            if (vacante.getModalidadTrabajo() == null || vacante.getModalidadTrabajo().isBlank()
                    || "Presencial".equalsIgnoreCase(vacante.getModalidadTrabajo())) {
                vacante.setModalidadTrabajo("Remoto");
            }
            return true;
        }

        // 2. ¿Es en el Atlántico?
        boolean esEnAtlantico = MUNICIPIOS.stream().anyMatch(m -> ciudad.contains(m) || ubicacion.contains(m))
                || REGIONES.stream().anyMatch(r -> ciudad.contains(r) || ubicacion.contains(r));
        if (esEnAtlantico) {
            return true;
        }

        // 3. ¿Es explícitamente en otra ciudad (ej: Bogotá, Medellín) y NO es remota?
        boolean esOtraCiudad = OTRAS_CIUDADES.stream().anyMatch(oc -> ciudad.contains(oc) || ubicacion.contains(oc));
        if (esOtraCiudad) {
            return false;
        }

        // 4. Si no especifica ciudad o viene vacía, y no dice ser de otra ciudad
        return true;
    }

    public static boolean esRemoto(String texto) {
        if (texto == null || texto.isBlank()) return false;
        String normal = normalizar(texto);
        return SENALES_REMOTO.stream().anyMatch(normal::contains);
    }

    private static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        return Normalizer.normalize(texto.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .toLowerCase(Locale.ROOT);
    }
}
