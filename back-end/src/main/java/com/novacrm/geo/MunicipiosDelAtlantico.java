package com.novacrm.geo;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Los 23 municipios del Atlantico, con su codigo oficial.
 *
 * <p>El codigo es el del DANE —division politico-administrativa— y no un
 * identificador nuestro: un municipio que cambie de nombre sigue siendo el
 * mismo codigo, y es lo que permite que el mapa del panel y esta tabla se
 * emparejen sin comparar cadenas de texto.
 *
 * <p>Existe porque la ciudad de una ficha es <strong>texto libre</strong>: entro
 * del Excel de matricula y hay valores como «Otro» o vacio. Para pintar un mapa
 * hay que llevar ese texto a un municipio concreto, y hacerlo con un
 * {@code equals} dejaria fuera «Barranquilla D.E.» o «Sto. Tomas».
 *
 * <p>No confundir con {@code AreaMetropolitana} del scraper: aquella es una
 * lista corta —el area metropolitana y su entorno inmediato— que responde «¿le
 * sirve esta oferta a la cohorte?». Esta es el departamento entero y responde
 * «¿donde vive esta persona?». Son dos preguntas distintas y por eso son dos
 * listas distintas.
 */
public final class MunicipiosDelAtlantico {

    /** Codigo DANE → nombre, en el orden en que se leen. */
    private static final Map<String, String> POR_CODIGO = new LinkedHashMap<>();

    /** Nombre normalizado o alias → codigo DANE. */
    private static final Map<String, String> POR_NOMBRE = new LinkedHashMap<>();

    private static void municipio(String codigo, String nombre, String... alias) {
        POR_CODIGO.put(codigo, nombre);
        POR_NOMBRE.put(normalizar(nombre), codigo);
        for (String a : alias) {
            POR_NOMBRE.put(normalizar(a), codigo);
        }
    }

    static {
        // Los alias no son adornos: salen de como escribe la gente la ciudad en
        // la matricula. «Barranquilla D.E.» y «Sto Tomas» son valores reales de
        // este tipo de planilla, y sin ellos esas fichas caerian en «sin ubicar»
        // aunque se sepa perfectamente donde viven.
        municipio("08001", "Barranquilla", "barranquilla d.e.", "barranquilla de",
                "distrito de barranquilla", "b/quilla", "bquilla");
        municipio("08078", "Baranoa");
        municipio("08137", "Campo de la Cruz", "campo de la cruz atlantico");
        municipio("08141", "Candelaria");
        municipio("08296", "Galapa");
        municipio("08372", "Juan de Acosta");
        municipio("08421", "Luruaco");
        municipio("08433", "Malambo");
        municipio("08436", "Manatí", "manati");
        municipio("08520", "Palmar de Varela");
        municipio("08549", "Piojó", "piojo");
        municipio("08558", "Polonuevo");
        municipio("08560", "Ponedera");
        municipio("08573", "Puerto Colombia", "pto colombia", "pto. colombia");
        municipio("08606", "Repelón", "repelon");
        municipio("08634", "Sabanagrande", "sabana grande");
        municipio("08638", "Sabanalarga", "sabana larga");
        municipio("08675", "Santa Lucía", "santa lucia", "sta lucia");
        municipio("08685", "Santo Tomás", "santo tomas", "sto tomas", "sto. tomas");
        municipio("08758", "Soledad");
        municipio("08770", "Suan", "suán");
        municipio("08832", "Tubará", "tubara");
        municipio("08849", "Usiacurí", "usiacuri");
    }

    private MunicipiosDelAtlantico() {
    }

    /** Los 23, en orden alfabetico de nombre. */
    public static List<Municipio> todos() {
        return POR_CODIGO.entrySet().stream()
                .map(e -> new Municipio(e.getKey(), e.getValue()))
                .sorted(java.util.Comparator.comparing(Municipio::nombre))
                .toList();
    }

    /**
     * A que municipio corresponde un texto libre, si a alguno.
     *
     * <p>Vacio cuando no se reconoce. Devolver un {@code Optional} y no un
     * «Otro» de relleno es deliberado: quien llama tiene que decidir que hacer
     * con lo que no se ubica, y contarlo aparte —repartirlo en silencio entre
     * los municipios conocidos falsearia el mapa—.
     */
    public static Optional<Municipio> desdeTextoLibre(String ciudad) {
        String limpio = normalizar(ciudad);
        if (limpio.isEmpty()) {
            return Optional.empty();
        }
        String codigo = POR_NOMBRE.get(limpio);
        if (codigo == null) {
            // Segundo intento por contencion: «Barranquilla, Atlantico» o
            // «Soledad (Atlantico)» son la misma ciudad escrita con adorno.
            // Se recorre en el orden declarado, que empieza por los nombres
            // completos, para que «sabanagrande» no lo capture «sabanalarga».
            for (var entrada : POR_NOMBRE.entrySet()) {
                if (limpio.contains(entrada.getKey())) {
                    codigo = entrada.getValue();
                    break;
                }
            }
        }
        return codigo == null ? Optional.empty()
                : Optional.of(new Municipio(codigo, POR_CODIGO.get(codigo)));
    }

    /** @param codigo codigo DANE de cinco digitos */
    public record Municipio(String codigo, String nombre) {}

    static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        return Normalizer.normalize(texto.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }
}
