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
            "polonuevo");

    /** El departamento, para cuando el portal solo publica la region. */
    private static final Set<String> REGIONES = Set.of("atlantico", "atlántico");

    private AreaMetropolitana() {
    }

    /** Las ciudades donde buscar, de mayor a menor poblacion del programa. */
    public static List<String> ciudadesDeBusqueda() {
        return List.of("Barranquilla", "Soledad", "Malambo");
    }

    /**
     * Si una oferta publicada en esa ciudad o region le sirve a la cohorte.
     *
     * <p>Una oferta sin ciudad se acepta: puede ser remota o no traer el dato,
     * y descartarla por no venir etiquetada perderia ofertas buenas. Filtrar de
     * mas es peor que filtrar de menos, porque lo que se pierde no se ve.
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

    private static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        return Normalizer.normalize(texto.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .toLowerCase(Locale.ROOT);
    }
}
