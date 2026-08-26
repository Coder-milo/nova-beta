package com.novacrm.scraper.fuente;

import com.fasterxml.jackson.databind.JsonNode;

import java.text.Normalizer;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Utilidad unificada y determinista para el parseo de fechas de publicación de vacantes.
 *
 * <p>Soporta:
 * <ul>
 *   <li>Expresiones relativas en español ("hace 1 hora", "hace 2 días", "publicado hoy", "ayer", "hace 1 semana", "hace más de 30 días")</li>
 *   <li>Expresiones relativas en inglés ("just now", "1 hour ago", "3 days ago", "1 week ago", "30+ days ago")</li>
 *   <li>Marcas de tiempo ISO-8601 con zona UTC/offset o locales ("2026-08-25T14:30:00Z", "2026-08-25 14:30:00", "2026-08-25")</li>
 *   <li>Marcas de tiempo Epoch en segundos (10 dígitos) o milisegundos (13 dígitos)</li>
 *   <li>Formatos de fecha estándar DD/MM/YYYY o DD-MM-YYYY</li>
 * </ul>
 *
 * <p>Todas las operaciones reciben una fecha de referencia para garantizar determinismo en pruebas.
 * Retorna {@link Optional#empty()} cuando la entrada es nula, vacía o no reconocible.
 */
public final class ParserFechas {

    private static final Pattern PATRON_DIGITOS_PUROS = Pattern.compile("^(\\d{9,13})$");
    private static final Pattern PATRON_FECHA_ESTANDAR = Pattern.compile(
            "^(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4})(?:[ T](\\d{1,2}):(\\d{1,2})(?::(\\d{1,2}))?)?$");

    private static final Pattern PATRON_CORRUPTO = Pattern.compile("\\b(?:nan|undefined|null|none|n/a)\\b");
    private static final Pattern PATRON_NEGATIVO = Pattern.compile("-\\s*\\d+");

    private static final Pattern PATRON_MAS_DE_DIAS = Pattern.compile(
            "\\b(?:hace\\s+)?(?:mas|more)\\s+(?:de|than)\\s+(\\d+)\\s*(?:dias?|days?|d)(?:\\s+ago)?\\b");
    private static final Pattern PATRON_PLUS_DIAS = Pattern.compile(
            "(?:\\+\\s*(\\d+)|(\\d+)\\s*\\+)\\s*(?:dias?|days?|d)(?:\\s+ago)?\\b");
    private static final Pattern PATRON_MAS_DE_SEMANAS = Pattern.compile(
            "\\b(?:hace\\s+)?(?:mas|more)\\s+(?:de|than)\\s+(\\d+)\\s*(?:semanas?|weeks?|sem|w)(?:\\s+ago)?\\b");
    private static final Pattern PATRON_PLUS_SEMANAS = Pattern.compile(
            "(?:\\+\\s*(\\d+)|(\\d+)\\s*\\+)\\s*(?:semanas?|weeks?|sem|w)(?:\\s+ago)?\\b");
    private static final Pattern PATRON_MAS_DE_MESES = Pattern.compile(
            "\\b(?:hace\\s+)?(?:mas|more)\\s+(?:de|than)\\s+(\\d+)\\s*(?:meses?|months?|month|mes|m)(?:\\s+ago)?\\b");
    private static final Pattern PATRON_PLUS_MESES = Pattern.compile(
            "(?:\\+\\s*(\\d+)|(\\d+)\\s*\\+)\\s*(?:meses?|months?|month|mes|m)(?:\\s+ago)?\\b");
    private static final Pattern PATRON_MAS_DE_ANIOS = Pattern.compile(
            "\\b(?:hace\\s+)?(?:mas|more)\\s+(?:de|than)\\s+(\\d+)\\s*(?:anos?|anios?|years?|year|y)(?:\\s+ago)?\\b");
    private static final Pattern PATRON_PLUS_ANIOS = Pattern.compile(
            "(?:\\+\\s*(\\d+)|(\\d+)\\s*\\+)\\s*(?:anos?|anios?|years?|year|y)(?:\\s+ago)?\\b");

    private static final Pattern PATRON_MINUTOS = Pattern.compile(
            "\\b(?:hace\\s+(\\d+|un|una)\\s*(?:minutos?|mins?|min)|(\\d+|a|an)\\s*(?:minutes?|mins?|min)\\s+ago|(\\d+)\\s*(?:mins|min|m)(?:\\s+ago)?)\\b");
    private static final Pattern PATRON_HORAS = Pattern.compile(
            "\\b(?:hace\\s+(\\d+|un|una)\\s*(?:horas?|hrs?|hr)|(\\d+|a|an)\\s*(?:hours?|hrs?|hr)\\s+ago|(\\d+)\\s*(?:hrs|hr|h)(?:\\s+ago)?)\\b");
    private static final Pattern PATRON_DIAS = Pattern.compile(
            "\\b(?:hace\\s+(\\d+|un|una)\\s*(?:dias?|dia)|(\\d+|a|an)\\s*(?:days?|day)\\s+ago|(\\d+)\\s*d(?:\\s+ago)?)\\b");
    private static final Pattern PATRON_SEMANAS = Pattern.compile(
            "\\b(?:hace\\s+(\\d+|un|una)\\s*(?:semanas?|semana|sem)|(\\d+|a|an)\\s*(?:weeks?|week)\\s+ago|(\\d+)\\s*(?:sem|w)(?:\\s+ago)?)\\b");
    private static final Pattern PATRON_MESES = Pattern.compile(
            "\\b(?:hace\\s+(\\d+|un|una)\\s*(?:meses?|mes)|(\\d+|a|an)\\s*(?:months?|month)\\s+ago|(\\d+)\\s*(?:mo)(?:\\s+ago)?)\\b");
    private static final Pattern PATRON_ANIOS = Pattern.compile(
            "\\b(?:hace\\s+(\\d+|un|una)\\s*(?:anos?|anios?|ano|anio)|(\\d+|a|an)\\s*(?:years?|year|yr)\\s+ago|(\\d+)\\s*(?:yr|y)(?:\\s+ago)?)\\b");

    private ParserFechas() {}

    /**
     * Parsea un texto de fecha utilizando la fecha/hora actual como referencia.
     */
    public static Optional<LocalDateTime> parsear(String texto) {
        return parsear(texto, LocalDateTime.now());
    }

    /**
     * Parsea un texto de fecha contra una fecha de referencia dada.
     */
    public static Optional<LocalDateTime> parsear(String texto, LocalDateTime referencia) {
        if (texto == null || texto.isBlank()) {
            return Optional.empty();
        }
        if (referencia == null) {
            referencia = LocalDateTime.now();
        }

        String limpio = texto.trim();

        // 1. Verificar si es número Epoch puro
        Matcher matcherEpoch = PATRON_DIGITOS_PUROS.matcher(limpio);
        if (matcherEpoch.matches()) {
            try {
                long valor = Long.parseLong(limpio);
                return desdeEpoch(valor);
            } catch (NumberFormatException ignored) {}
        }

        // 2. Intentar parseo directo ISO-8601
        Optional<LocalDateTime> isoOpt = parsearIso(limpio);
        if (isoOpt.isPresent()) {
            return isoOpt;
        }

        // 3. Intentar formato estándar DD/MM/YYYY
        Matcher matcherEstandar = PATRON_FECHA_ESTANDAR.matcher(limpio);
        if (matcherEstandar.matches()) {
            try {
                int dia = Integer.parseInt(matcherEstandar.group(1));
                int mes = Integer.parseInt(matcherEstandar.group(2));
                int anio = Integer.parseInt(matcherEstandar.group(3));
                int hora = matcherEstandar.group(4) != null ? Integer.parseInt(matcherEstandar.group(4)) : 0;
                int min = matcherEstandar.group(5) != null ? Integer.parseInt(matcherEstandar.group(5)) : 0;
                int sec = matcherEstandar.group(6) != null ? Integer.parseInt(matcherEstandar.group(6)) : 0;
                return Optional.of(LocalDateTime.of(anio, mes, dia, hora, min, sec));
            } catch (DateTimeException ignored) {}
        }

        // 4. Normalizar caracteres Unicode (remover diacríticos) y minúsculas para parseo relativo
        String normalizado = Normalizer.normalize(limpio, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();

        return parsearRelativo(normalizado, referencia);
    }

    /**
     * Parsea cadenas con formato ISO-8601 (con o sin zona horaria/offset).
     */
    public static Optional<LocalDateTime> parsearIso(String texto) {
        if (texto == null || texto.isBlank()) {
            return Optional.empty();
        }
        String limpio = texto.trim();

        // Con offset o zona horaria (ej. 2026-08-25T14:30:00Z o 2026-08-25T14:30:00-05:00)
        try {
            return Optional.of(OffsetDateTime.parse(limpio).toLocalDateTime());
        } catch (DateTimeParseException ignored) {}

        try {
            return Optional.of(ZonedDateTime.parse(limpio).toLocalDateTime());
        } catch (DateTimeParseException ignored) {}

        // Sin zona (ej. 2026-08-25T14:30:00 o 2026-08-25 14:30:00)
        try {
            return Optional.of(LocalDateTime.parse(limpio.replace(" ", "T")));
        } catch (DateTimeParseException ignored) {}

        // Solo fecha ISO (ej. 2026-08-25)
        try {
            return Optional.of(LocalDate.parse(limpio).atStartOfDay());
        } catch (DateTimeParseException ignored) {}

        return Optional.empty();
    }

    /**
     * Convierte un valor numérico Unix Epoch (segundos o milisegundos) a LocalDateTime.
     */
    public static Optional<LocalDateTime> desdeEpoch(Long epoch) {
        if (epoch == null) {
            return Optional.empty();
        }
        return desdeEpoch(epoch.longValue());
    }

    /**
     * Convierte un valor numérico Unix Epoch primitivo a LocalDateTime.
     */
    public static Optional<LocalDateTime> desdeEpoch(long epoch) {
        try {
            // Si tiene más de 11 dígitos, asumimos milisegundos; en caso contrario, segundos
            Instant instant = (epoch > 99_999_999_999L)
                    ? Instant.ofEpochMilli(epoch)
                    : Instant.ofEpochSecond(epoch);
            return Optional.of(LocalDateTime.ofInstant(instant, ZoneId.systemDefault()));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /**
     * Extrae y convierte un campo Epoch desde un JsonNode de Jackson.
     */
    public static Optional<LocalDateTime> desdeEpoch(JsonNode nodo) {
        if (nodo == null || !nodo.canConvertToLong()) {
            return Optional.empty();
        }
        return desdeEpoch(nodo.asLong());
    }

    private static Optional<LocalDateTime> parsearRelativo(String normalizado, LocalDateTime ref) {
        // Descartar de inmediato entradas con artefactos corruptos o números negativos
        if (PATRON_CORRUPTO.matcher(normalizado).find() || PATRON_NEGATIVO.matcher(normalizado).find()) {
            return Optional.empty();
        }

        // Marcadores de inmediatez ("just now", "hace instantes", "recién publicado", "justo ahora", "hace poco")
        if (normalizado.equals("just now") || normalizado.equals("just posted")
                || normalizado.contains("hace instantes") || normalizado.contains("recien publicad")
                || normalizado.contains("justo ahora") || normalizado.contains("hace poco")
                || normalizado.contains("moments ago") || normalizado.contains("hace un momento")) {
            return Optional.of(ref);
        }

        // Marcadores de hoy ("hoy", "publicado hoy", "today")
        if (normalizado.equals("hoy") || normalizado.equals("today")
                || normalizado.contains("publicado hoy") || normalizado.contains("publicada hoy")
                || normalizado.contains("hoy mismo") || normalizado.contains("posted today")) {
            return Optional.of(ref);
        }

        // Marcadores de ayer ("ayer", "publicado ayer", "yesterday")
        if (normalizado.equals("ayer") || normalizado.equals("yesterday")
                || normalizado.contains("publicado ayer") || normalizado.contains("publicada ayer")
                || normalizado.contains("posted yesterday")) {
            return Optional.of(ref.minusDays(1));
        }

        // Marcadores explícitos de antigüedad ("hace más de 30 días", "+30 días", "30+ days ago")
        Matcher mMasDias = PATRON_MAS_DE_DIAS.matcher(normalizado);
        if (mMasDias.find()) {
            try {
                int dias = Integer.parseInt(mMasDias.group(1));
                return Optional.of(ref.minusDays(dias + 1));
            } catch (NumberFormatException ignored) {}
        }
        Matcher mPlusDias = PATRON_PLUS_DIAS.matcher(normalizado);
        if (mPlusDias.find()) {
            try {
                String dStr = mPlusDias.group(1) != null ? mPlusDias.group(1) : mPlusDias.group(2);
                int dias = Integer.parseInt(dStr);
                return Optional.of(ref.minusDays(dias + 1));
            } catch (NumberFormatException ignored) {}
        }
        Matcher mMasSemanas = PATRON_MAS_DE_SEMANAS.matcher(normalizado);
        if (mMasSemanas.find()) {
            try {
                int sem = Integer.parseInt(mMasSemanas.group(1));
                return Optional.of(ref.minusWeeks(sem + 1));
            } catch (NumberFormatException ignored) {}
        }
        Matcher mPlusSemanas = PATRON_PLUS_SEMANAS.matcher(normalizado);
        if (mPlusSemanas.find()) {
            try {
                String dStr = mPlusSemanas.group(1) != null ? mPlusSemanas.group(1) : mPlusSemanas.group(2);
                int sem = Integer.parseInt(dStr);
                return Optional.of(ref.minusWeeks(sem + 1));
            } catch (NumberFormatException ignored) {}
        }
        Matcher mMasMeses = PATRON_MAS_DE_MESES.matcher(normalizado);
        if (mMasMeses.find()) {
            try {
                int mes = Integer.parseInt(mMasMeses.group(1));
                return Optional.of(ref.minusMonths(mes + 1));
            } catch (NumberFormatException ignored) {}
        }
        Matcher mPlusMeses = PATRON_PLUS_MESES.matcher(normalizado);
        if (mPlusMeses.find()) {
            try {
                String dStr = mPlusMeses.group(1) != null ? mPlusMeses.group(1) : mPlusMeses.group(2);
                int mes = Integer.parseInt(dStr);
                return Optional.of(ref.minusMonths(mes + 1));
            } catch (NumberFormatException ignored) {}
        }
        Matcher mMasAnios = PATRON_MAS_DE_ANIOS.matcher(normalizado);
        if (mMasAnios.find()) {
            try {
                int anio = Integer.parseInt(mMasAnios.group(1));
                return Optional.of(ref.minusYears(anio + 1));
            } catch (NumberFormatException ignored) {}
        }
        Matcher mPlusAnios = PATRON_PLUS_ANIOS.matcher(normalizado);
        if (mPlusAnios.find()) {
            try {
                String dStr = mPlusAnios.group(1) != null ? mPlusAnios.group(1) : mPlusAnios.group(2);
                int anio = Integer.parseInt(dStr);
                return Optional.of(ref.minusYears(anio + 1));
            } catch (NumberFormatException ignored) {}
        }

        // Minutos
        Matcher mMin = PATRON_MINUTOS.matcher(normalizado);
        if (mMin.find()) {
            OptionalInt cantidad = extraerCantidad(mMin);
            if (cantidad.isPresent()) {
                return Optional.of(ref.minusMinutes(cantidad.getAsInt()));
            }
        }

        // Horas
        Matcher mHoras = PATRON_HORAS.matcher(normalizado);
        if (mHoras.find()) {
            OptionalInt cantidad = extraerCantidad(mHoras);
            if (cantidad.isPresent()) {
                return Optional.of(ref.minusHours(cantidad.getAsInt()));
            }
        }

        // Días
        Matcher mDias = PATRON_DIAS.matcher(normalizado);
        if (mDias.find()) {
            OptionalInt cantidad = extraerCantidad(mDias);
            if (cantidad.isPresent()) {
                return Optional.of(ref.minusDays(cantidad.getAsInt()));
            }
        }

        // Semanas
        Matcher mSem = PATRON_SEMANAS.matcher(normalizado);
        if (mSem.find()) {
            OptionalInt cantidad = extraerCantidad(mSem);
            if (cantidad.isPresent()) {
                return Optional.of(ref.minusWeeks(cantidad.getAsInt()));
            }
        }

        // Meses
        Matcher mMes = PATRON_MESES.matcher(normalizado);
        if (mMes.find()) {
            OptionalInt cantidad = extraerCantidad(mMes);
            if (cantidad.isPresent()) {
                return Optional.of(ref.minusMonths(cantidad.getAsInt()));
            }
        }

        // Años
        Matcher mAnios = PATRON_ANIOS.matcher(normalizado);
        if (mAnios.find()) {
            OptionalInt cantidad = extraerCantidad(mAnios);
            if (cantidad.isPresent()) {
                return Optional.of(ref.minusYears(cantidad.getAsInt()));
            }
        }

        return Optional.empty();
    }

    private static OptionalInt extraerCantidad(Matcher matcher) {
        for (int i = 1; i <= matcher.groupCount(); i++) {
            String val = matcher.group(i);
            if (val != null && !val.isBlank()) {
                return parsearCantidad(val);
            }
        }
        return OptionalInt.empty();
    }

    private static OptionalInt parsearCantidad(String valor) {
        if (valor == null || valor.isBlank()) {
            return OptionalInt.empty();
        }
        String v = valor.trim().toLowerCase(Locale.ROOT);
        if (v.equals("un") || v.equals("una") || v.equals("a") || v.equals("an")) {
            return OptionalInt.of(1);
        }
        try {
            int num = Integer.parseInt(v);
            return num >= 0 ? OptionalInt.of(num) : OptionalInt.empty();
        } catch (NumberFormatException e) {
            return OptionalInt.empty();
        }
    }
}
