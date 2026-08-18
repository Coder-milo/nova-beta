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
        if (normalized.isBlank()) return null;

        // Las preguntas de consentimiento, tratamiento de datos y texto libre auxiliar
        // no corresponden a campos de perfil y no deben asignarse por coincidencia difusa.
        if (esConsentimientoOTextoAuxiliar(header, normalized)) {
            return null;
        }

        // 1. Coincidencia exacta normalizada
        String exact = invertedIndex.get(normalized);
        if (exact != null) return exact;

        // 2. Coincidencia por contención completa de sinónimo
        SynonymEntry bestContains = null;
        for (SynonymEntry entry : synonymEntries) {
            if (normalized.contains(entry.normalized)) {
                if (bestContains == null || entry.normalized.length() > bestContains.normalized.length()) {
                    bestContains = entry;
                }
            }
        }
        if (bestContains != null) return bestContains.field;

        // 3. Coincidencia difusa ponderada por palabras clave
        Set<String> headerWords = Arrays.stream(normalized.split("\\s+"))
                .filter(w -> w.length() >= 2)
                .collect(Collectors.toSet());

        // Evitar falsos positivos en preguntas largas cuando solo coinciden 1 o 2 palabras genéricas
        if (headerWords.size() > 15) {
            return null;
        }

        SynonymEntry best = null;
        double bestRatio = 0.70;

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
        Map<String, String> normalizedOverrides = new HashMap<>();
        if (exactOverrides != null) {
            for (var entry : exactOverrides.entrySet()) {
                normalizedOverrides.put(normalize(entry.getKey()), entry.getValue());
            }
        }

        Map<String, String> result = new LinkedHashMap<>();
        for (String header : headers) {
            String field = exactOverrides != null ? exactOverrides.get(header) : null;
            if (field == null && !normalizedOverrides.isEmpty()) {
                field = normalizedOverrides.get(normalize(header));
            }
            if (field == null) {
                field = map(header);
            }
            result.put(header, field);
        }
        return result;
    }

    public String normalize(String input) {
        if (input == null) return "";
        String s = input.trim();
        s = s.replace('_', ' ');

        // Quitar numeración inicial de pregunta si existe (ej. "3.9 ", "6.1")
        s = s.replaceFirst("^\\d+(?:\\.\\d+)*\\s*", "");

        s = s.replaceAll("\\s*\\([^)]{1,60}\\)", "");

        s = Normalizer.normalize(s, Normalizer.Form.NFD);
        s = s.replaceAll("\\p{InCombiningDiacriticalMarks}", "");

        s = s.replaceAll("[^a-zA-Z0-9\\s]", " ");

        s = s.toLowerCase(Locale.ROOT);
        s = s.replaceAll("\\s+", " ");
        return s.trim();
    }

    private boolean esConsentimientoOTextoAuxiliar(String original, String norm) {
        String origNorm = Normalizer.normalize(original.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "");

        if (origNorm.contains("autorizas") || origNorm.contains("autorizacion")
                || origNorm.contains("tratamiento de datos") || origNorm.contains("uso de datos")
                || origNorm.contains("politica de seguridad") || origNorm.contains("politica de proteccion")
                || origNorm.contains("tratamiento de informacion")
                || origNorm.contains("si marco otro") || origNorm.contains("si marco otra")
                || origNorm.contains("si marco si") || origNorm.contains("si tu respuesta fue otro")
                || origNorm.contains("si marco no") || origNorm.contains("responda si no y a quien cuida")) {
            return true;
        }

        return false;
    }
}
