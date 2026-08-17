package com.novacrm.config;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Funciones Java registradas como ALIAS en H2 para simular las funciones SQL de PostgreSQL en entorno de test.
 */
public class H2Functions {

    public static String normalizar(String texto) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        String limpio = Normalizer.normalize(texto.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[^a-z0-9]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return limpio.isEmpty() ? null : limpio;
    }

    public static String normalizarEmpresa(String texto) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        String limpio = normalizar(texto);
        if (limpio == null) return null;
        limpio = limpio.replaceAll("\\b(sas|s a s|sa|s a|ltd|ltda|inc|corp|co)\\b", "").trim();
        return limpio.isEmpty() ? null : limpio;
    }

    public static String normalizarDocumento(String texto) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        String limpio = texto.replaceAll("[^0-9a-zA-Z]+", "").toUpperCase(Locale.ROOT).trim();
        return limpio.isEmpty() ? null : limpio;
    }

    public static String soloAlfanumerico(String texto) {
        return normalizarDocumento(texto);
    }

    public static double datePart(String part, java.sql.Timestamp timestamp) {
        if (timestamp == null) return 0;
        java.time.LocalDateTime dt = timestamp.toLocalDateTime();
        if ("year".equalsIgnoreCase(part)) return dt.getYear();
        if ("month".equalsIgnoreCase(part)) return dt.getMonthValue();
        if ("day".equalsIgnoreCase(part)) return dt.getDayOfMonth();
        return 0;
    }
}
