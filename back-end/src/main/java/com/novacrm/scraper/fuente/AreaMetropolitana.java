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
            "100% remoto", "totalmente remoto", "trabajo remoto", "worldwide",
            "anywhere", "global", "latam");

    /**
     * Todos los departamentos y municipios fuera del Atlántico (normalizados).
     * Si una oferta está ubicada en una de estas zonas y NO es 100% remota, se excluye.
     */
    private static final Set<String> OTRAS_CIUDADES_Y_REGIONES = Set.of(
            // Risaralda / Eje Cafetero
            "risaralda", "pereira", "dosquebradas", "santa rosa de cabal",
            "caldas", "manizales", "villamaria", "chinchina", "la dorada",
            "quindio", "armenia", "calarca", "montenegro", "quimbaya", "la tebaida",
            // Cundinamarca / Bogotá
            "cundinamarca", "bogota", "soacha", "chia", "zipaquira",
            "madrid", "funza", "mosquera", "facatativa", "girardot", "fusagasuga",
            "cajica", "tocancipa", "sopo", "cota", "sibate", "tabio", "tenjo", "la calera",
            // Antioquia
            "antioquia", "medellin", "bello", "itagui", "envigado",
            "rionegro", "sabaneta", "copacabana", "la estrella", "apartado",
            "turbo", "caucasia", "guatape",
            // Valle del Cauca
            "valle del cauca", "valle", "cali", "palmira", "buenaventura", "tulua",
            "cartago", "yumbo", "jamundi", "buga",
            // Santanderes
            "santander", "bucaramanga", "floridablanca", "giron", "piedecuesta",
            "barrancabermeja", "san gil",
            "norte de santander", "cucuta", "ocana", "villa del rosario", "los patios", "pamplona",
            // Tolima / Huila
            "tolima", "ibague", "espinal", "melgar", "chaparral", "mariquita", "honda",
            "huila", "neiva", "pitalito", "garzon", "la plata",
            // Meta / Llanos
            "meta", "villavicencio", "acacias", "granada", "puerto lopez",
            "casanare", "yopal", "aguazul", "arauca", "guaviare", "san jose del guaviare",
            "guainia", "inirida", "vaupes", "mitu", "vichada", "puerto carreno",
            // Nariño / Cauca / Putumayo / Caquetá
            "narino", "pasto", "tumaco", "ipiales",
            "cauca", "popayan", "santander de quilichao", "puerto tejada",
            "putumayo", "mocoa", "puerto asis",
            "caqueta", "florencia",
            // Costa Caribe (no Atlántico)
            "bolivar", "cartagena", "magangue", "turbaco", "arjona", "carmen de bolivar",
            "magdalena", "santa marta", "cienaga", "fundacion", "plato",
            "cesar", "valledupar", "aguachica", "agustin codazzi",
            "cordoba", "monteria", "cerete", "lorica", "sahagun", "montelibano",
            "sucre", "sincelejo", "corozal", "san marcos",
            "la guajira", "guajira", "riohacha", "maicao", "uribia", "san juan del cesar",
            "san andres", "providencia",
            // Boyacá / Chocó / Amazonas
            "boyaca", "tunja", "sogamoso", "duitama", "chiquinquira", "paipa",
            "choco", "quibdo",
            "amazonas", "leticia");

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
     * Si está ubicada en Risaralda, Bogotá, Medellín u otra ciudad fuera del Atlántico y es presencial, se descarta.
     */
    public static boolean esAtlanticoORemota(com.novacrm.vacante.Vacante vacante) {
        if (vacante == null) {
            return false;
        }
        if (vacante.getSegmento() == Segmento.REMOTO_INGLES) {
            return true;
        }

        String modalidad = normalizar(vacante.getModalidadTrabajo());
        String ubicacion = normalizar(vacante.getUbicacion());
        String ciudad = normalizar(vacante.getCiudad());
        String titulo = normalizar(vacante.getTitulo());
        String descripcion = normalizar(vacante.getDescripcion());
        String requisitos = normalizar(vacante.getRequisitos());
        String url = normalizar(vacante.getUrlOrigen());

        String textoCompleto = String.join(" ", modalidad, ubicacion, ciudad, titulo, descripcion, requisitos, url);

        // 1. ¿Es remota comprobada?
        boolean esRemoto = SENALES_REMOTO.stream().anyMatch(s -> modalidad.contains(s) || titulo.contains(s) || descripcion.contains(s));
        if (esRemoto && !"presencial".equalsIgnoreCase(modalidad)) {
            if (vacante.getModalidadTrabajo() == null || vacante.getModalidadTrabajo().isBlank()
                    || "Presencial".equalsIgnoreCase(vacante.getModalidadTrabajo())) {
                vacante.setModalidadTrabajo("Remoto");
            }
            return true;
        }

        // 2. ¿Es en el Atlántico?
        boolean esEnAtlantico = MUNICIPIOS.stream().anyMatch(m -> ciudad.contains(m) || ubicacion.contains(m) || url.contains(m))
                || REGIONES.stream().anyMatch(r -> ciudad.contains(r) || ubicacion.contains(r) || url.contains(r));

        // 3. ¿Es explícitamente en otra ciudad/departamento fuera del Atlántico?
        boolean esOtraCiudad = OTRAS_CIUDADES_Y_REGIONES.stream().anyMatch(oc ->
                ciudad.contains(oc) || ubicacion.contains(oc) || url.contains("-" + oc + "-") || url.contains("/" + oc + "/") || titulo.contains("en " + oc));

        if (esOtraCiudad && !esEnAtlantico) {
            return false;
        }

        return esEnAtlantico;
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
