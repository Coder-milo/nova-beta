package com.novacrm.matching;

import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Normaliza texto libre a tokens comparables.
 *
 * <p>Los sinonimos declarados en {@code matching-synonyms.yml} colapsan a su
 * clave canonica, y lo que no esta declarado <em>se conserva tal cual</em>. Esa
 * segunda mitad es deliberada: antes se descartaba toda palabra que no fuera
 * canonica, asi que el vocabulario entero del sistema eran las claves del yml
 * —28 conceptos, y casi todos de TI—. Un cargo objetivo como "Bilingual
 * Customer Service Representative" se quedaba en un unico token y un sector
 * como "BPO / Servicios tercerizados" en ninguno. La cola larga —{@code SIIGO},
 * {@code Zendesk}, {@code recepcion}, {@code bodega}— vuelve a contar.
 *
 * <p>El precio de conservarla es ruido, y se paga en dos sitios: aqui con una
 * lista de palabras vacias y un largo minimo, y en el motor ponderando cada
 * token por su rareza.
 */
@Component
public class SkillSynonyms {

    /** Por debajo de esto no hay concepto: "de", "en", "un", siglas de una letra. */
    private static final int LARGO_MINIMO = 3;

    /**
     * Palabras que aparecen en casi cualquier anuncio y en casi cualquier
     * perfil, asi que coincidir en ellas no dice nada. Solo las mas frecuentes:
     * la ponderacion por rareza se encarga del resto sin necesidad de que nadie
     * mantenga una lista exhaustiva.
     */
    private static final Set<String> PALABRAS_VACIAS = Set.of(
            // espanol
            "para", "con", "por", "los", "las", "del", "una", "uno", "que", "como",
            "mas", "sus", "sobre", "entre", "desde", "hasta", "este", "esta", "estos",
            "estas", "ser", "son", "sera", "tiene", "tener", "debe", "puede", "muy",
            "todo", "toda", "todos", "todas", "cada", "otro", "otra", "donde", "cual",
            "nos", "nuestro", "nuestra", "eres", "tus", "sino", "pero", "porque",
            // ingles
            "the", "and", "for", "with", "you", "your", "our", "are", "will", "have",
            "has", "this", "that", "these", "those", "from", "into", "than", "then",
            "they", "their", "them", "who", "what", "which", "been", "being", "were",
            "was", "can", "must", "should", "would", "could", "shall", "all", "any",
            "not", "job", "role", "work", "team", "company", "position",
            "opportunity", "requirements", "responsibilities", "about", "apply",
            "please", "years", "anos", "experiencia", "experience");

    private Map<String, Set<String>> canonicalMap;
    private List<SynonymGroup> sortedGroups;

    @PostConstruct
    public void init() {
        Map<String, List<String>> raw = loadYaml();
        this.canonicalMap = new HashMap<>();
        List<SynonymGroup> groups = new ArrayList<>();
        Map<String, String> duenoDelSinonimo = new HashMap<>();

        for (var entry : raw.entrySet()) {
            String canonical = entry.getKey();
            Set<String> normalized = entry.getValue().stream()
                    .map(this::normalize)
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toSet());
            canonicalMap.put(canonical, normalized);
            for (String synonym : normalized) {
                // Un sinonimo bajo dos canonicos hace que el resultado dependa
                // del orden en que se lea el yml, que es justo el fallo que se
                // corrigio en resolverCanonicos. Se detiene el arranque en vez
                // de dejar que el motor puntue distinto segun el dia.
                String previo = duenoDelSinonimo.putIfAbsent(synonym, canonical);
                if (previo != null) {
                    throw new IllegalStateException(
                            "El sinonimo '" + synonym + "' esta declarado bajo '" + previo
                                    + "' y bajo '" + canonical + "' en matching-synonyms.yml");
                }
                int wordCount = synonym.split("\\s+").length;
                groups.add(new SynonymGroup(canonical, synonym, wordCount));
            }
        }

        groups.sort((a, b) -> Integer.compare(b.wordCount, a.wordCount));
        this.sortedGroups = groups;
    }

    /** Si un token es una clave canonica del yml y no una palabra suelta. */
    public boolean esCanonico(String token) {
        return canonicalMap.containsKey(token);
    }

    private Map<String, List<String>> loadYaml() {
        try {
            Yaml yaml = new Yaml();
            InputStream is = new ClassPathResource("matching-synonyms.yml").getInputStream();
            Map<String, List<String>> raw = yaml.load(is);
            return raw != null ? raw : Collections.emptyMap();
        } catch (Exception e) {
            throw new RuntimeException("Error al cargar matching-synonyms.yml", e);
        }
    }

    /**
     * Tokens comparables de uno o varios textos.
     *
     * <p>Los canonicos entran siempre; los demas solo si superan el largo
     * minimo, no son palabras vacias y no son un numero suelto —un "2024" o un
     * "500" coincidiendo entre dos anuncios no significa nada—.
     */
    public Set<String> tokenize(String... textos) {
        Set<String> tokens = new HashSet<>();
        for (String texto : textos) {
            if (texto == null || texto.isBlank()) continue;
            String normalized = normalize(texto);
            if (normalized.isEmpty()) continue;

            for (String token : resolverCanonicos(normalized.split(" "))) {
                if (canonicalMap.containsKey(token) || esTokenUtil(token)) {
                    tokens.add(token);
                }
            }
        }
        return tokens;
    }

    private boolean esTokenUtil(String token) {
        return token.length() >= LARGO_MINIMO
                && !PALABRAS_VACIAS.contains(token)
                && !token.chars().allMatch(Character::isDigit);
    }

    /**
     * Mapea cada palabra (o frase de varias palabras) del texto ya tokenizado
     * a su canonico, probando primero las frases mas largas (sortedGroups
     * viene ordenado por cantidad de palabras descendente).
     *
     * <p>Antes esto se resolvia con reemplazos in-place sobre el string
     * completo: el resultado dependia del orden de declaracion en el yml
     * cuando un mismo sinonimo aparecia bajo mas de un canonico (el ya
     * reemplazado podia volver a matchear una regla posterior), y el padding
     * con un solo espacio perdia coincidencias al inicio/fin del texto
     * (BE-10). Trabajar sobre el arreglo de palabras original, sin
     * releer lo ya emparejado, elimina ambos problemas.
     */
    private List<String> resolverCanonicos(String[] palabras) {
        List<String> resultado = new ArrayList<>();
        int i = 0;
        while (i < palabras.length) {
            String canonico = null;
            int consumidas = 1;
            for (SynonymGroup group : sortedGroups) {
                if (i + group.wordCount > palabras.length) continue;
                String candidato = String.join(" ", Arrays.asList(palabras).subList(i, i + group.wordCount));
                if (candidato.equals(group.synonym)) {
                    canonico = group.canonical;
                    consumidas = group.wordCount;
                    break;
                }
            }
            resultado.add(canonico != null ? canonico : palabras[i]);
            i += consumidas;
        }
        return resultado;
    }

    private String normalize(String input) {
        if (input == null) return "";
        String s = input.trim().toLowerCase(Locale.ROOT);
        s = Normalizer.normalize(s, Normalizer.Form.NFD);
        s = s.replaceAll("\\p{InCombiningDiacriticalMarks}", "");
        s = s.replaceAll("[^a-z0-9\\s]", " ");
        s = s.replaceAll("\\s+", " ").trim();
        return s;
    }

    private record SynonymGroup(String canonical, String synonym, int wordCount) {}
}
