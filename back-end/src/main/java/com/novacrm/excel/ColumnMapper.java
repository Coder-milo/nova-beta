package com.novacrm.excel;

import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class ColumnMapper {

    private static final int MIN_SYNONYM_LENGTH_FOR_CONTAINS = 5;

    private Map<String, List<String>> synonyms;
    private Map<String, String> invertedIndex;
    private List<SynonymEntry> synonymEntries;

    @PostConstruct
    public void init() {
        this.synonyms = loadSynonyms();
        this.invertedIndex = buildInvertedIndex();
        this.synonymEntries = buildSynonymEntries();
    }

    private Map<String, List<String>> loadSynonyms() {
        try {
            Yaml yaml = new Yaml();
            InputStream is = new ClassPathResource("column-synonyms.yml").getInputStream();
            Map<String, List<String>> raw = yaml.load(is);
            return raw != null ? raw : Collections.emptyMap();
        } catch (Exception e) {
            throw new RuntimeException("Error al cargar column-synonyms.yml", e);
        }
    }

    private Map<String, String> buildInvertedIndex() {
        Map<String, String> idx = new HashMap<>();
        for (var entry : synonyms.entrySet()) {
            String field = entry.getKey();
            for (String synonym : entry.getValue()) {
                String norm = normalize(synonym);
                if (!norm.isBlank()) {
                    idx.putIfAbsent(norm, field);
                }
            }
        }
        return idx;
    }

    private List<SynonymEntry> buildSynonymEntries() {
        List<SynonymEntry> entries = new ArrayList<>();
        for (var entry : synonyms.entrySet()) {
            String field = entry.getKey();
            for (String synonym : entry.getValue()) {
                String norm = normalize(synonym);
                if (!norm.isBlank() && norm.length() >= MIN_SYNONYM_LENGTH_FOR_CONTAINS) {
                    Set<String> words = Arrays.stream(norm.split("\\s+"))
                            .filter(w -> w.length() >= 2)
                            .collect(Collectors.toSet());
                    entries.add(new SynonymEntry(field, norm, words));
                }
            }
        }
        return entries;
    }

    private record SynonymEntry(String field, String normalized, Set<String> words) {}

    public String map(String header) {
        if (header == null || header.isBlank()) return null;
        String normalized = normalize(header);

        String exact = invertedIndex.get(normalized);
        if (exact != null) return exact;

        SynonymEntry bestContains = null;
        for (SynonymEntry entry : synonymEntries) {
            if (normalized.contains(entry.normalized)) {
                if (bestContains == null || entry.normalized.length() > bestContains.normalized.length()) {
                    bestContains = entry;
                }
            }
        }
        if (bestContains != null) return bestContains.field;

        Set<String> headerWords = Arrays.stream(normalized.split("\\s+"))
                .filter(w -> w.length() >= 2)
                .collect(Collectors.toSet());

        SynonymEntry best = null;
        double bestRatio = 0.65;

        for (SynonymEntry entry : synonymEntries) {
            if (entry.words.size() < 2) continue;
            long overlap = entry.words.stream()
                    .filter(headerWords::contains)
                    .count();
            double ratio = (double) overlap / entry.words.size();
            if (ratio >= bestRatio && overlap >= 2) {
                if (best == null || ratio > bestRatio || entry.words.size() > best.words.size()) {
                    best = entry;
                    bestRatio = ratio;
                }
            }
        }

        return best != null ? best.field : null;
    }

    public Map<String, String> buildColumnMap(List<String> headers,
                                               Map<String, String> exactOverrides) {
        Map<String, String> result = new LinkedHashMap<>();
        for (String header : headers) {
            String field = exactOverrides.get(header);
            if (field == null) {
                field = map(header);
            }
            result.put(header, field);
        }
        return result;
    }

    private String normalize(String input) {
        if (input == null) return "";
        String s = input.trim();
        s = s.replace('_', ' ');

        s = s.replaceFirst("^\\d+(?:\\.\\d+)*\\s+", "");

        s = s.replaceAll("\\s*\\([^)]{1,60}\\)", "");

        s = Normalizer.normalize(s, Normalizer.Form.NFD);
        s = s.replaceAll("\\p{InCombiningDiacriticalMarks}", "");

        s = s.replaceAll("[^a-zA-Z0-9\\s]", " ");

        s = s.toLowerCase(Locale.ROOT);
        s = s.replaceAll("\\s+", " ");
        return s.trim();
    }
}
