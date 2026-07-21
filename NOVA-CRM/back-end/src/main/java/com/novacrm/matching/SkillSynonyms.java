package com.novacrm.matching;

import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class SkillSynonyms {

    private Map<String, Set<String>> canonicalMap;
    private List<SynonymGroup> sortedGroups;

    @PostConstruct
    public void init() {
        Map<String, List<String>> raw = loadYaml();
        this.canonicalMap = new HashMap<>();
        List<SynonymGroup> groups = new ArrayList<>();

        for (var entry : raw.entrySet()) {
            String canonical = entry.getKey();
            Set<String> normalized = entry.getValue().stream()
                    .map(this::normalize)
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toSet());
            canonicalMap.put(canonical, normalized);
            for (String synonym : normalized) {
                int wordCount = synonym.split("\\s+").length;
                groups.add(new SynonymGroup(canonical, synonym, wordCount));
            }
        }

        groups.sort((a, b) -> Integer.compare(b.wordCount, a.wordCount));
        this.sortedGroups = groups;
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

    public Set<String> tokenize(String... textos) {
        Set<String> tokens = new HashSet<>();
        for (String texto : textos) {
            if (texto == null || texto.isBlank()) continue;
            String normalized = normalize(texto);

            String resolved = replaceSynonyms(normalized);

            for (String token : resolved.split("\\s+")) {
                token = token.trim();
                if (token.length() >= 3 && canonicalMap.containsKey(token)) {
                    tokens.add(token);
                }
            }
        }
        return tokens;
    }

    private String replaceSynonyms(String text) {
        String result = text;
        for (SynonymGroup group : sortedGroups) {
            String placeholder = " " + group.canonical + " ";
            String pattern = " " + group.synonym + " ";
            result = result.replace(pattern, placeholder);
        }
        result = result.replaceAll("\\s+", " ").trim();
        return result;
    }

    public Optional<String> findCanonical(String rawSynonym) {
        String normalized = normalize(rawSynonym);
        for (var entry : canonicalMap.entrySet()) {
            if (entry.getValue().contains(normalized)) {
                return Optional.of(entry.getKey());
            }
        }
        return Optional.empty();
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
