package com.novacrm.scraper.fuente;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Adversarial Verification & Stress Test Suite for Milestone 1: Freshness Filtering and Date Parsing.
 *
 * <p>Empirically tests:
 * 1. Sub-second and sub-minute boundary conditions (167h 59m 59s vs 168h 00m vs 168h 00m 01s vs 168h 01m).
 * 2. Upper bound / future clock skew limits (+24h allowed, +24h 1s rejected, +2 days rejected).
 * 3. Strange relative strings with diacritics, Unicode, irregular casing, whitespace, and symbols.
 * 4. Leap year calculations (Feb 29 leap vs non-leap, month boundaries).
 * 5. Corrupted, malformed, injection, empty, and blank inputs.
 * 6. Gatekeeper verification ensuring 100% rejection of stale (>7d) or unverified vacancies.
 * 7. Concrete Bug Reproduction Demonstrations for Worker Remediation.
 */
public class M1AdversarialFreshnessStressTest {

    private final LocalDateTime ref = LocalDateTime.of(2026, 8, 25, 12, 0, 0);

    @Nested
    @DisplayName("1. Sub-Second & Sub-Minute Exact Temporal Boundary Challenges")
    class TemporalBoundaryStress {

        @Test
        @DisplayName("167 hours 59 minutes (inside 7-day window) -> MUST BE FRESH")
        void test167h59mInsideWindow() {
            LocalDateTime dt = ref.minusHours(167).minusMinutes(59);
            assertThat(FiltroFrescura.esFresca(dt, ref)).isTrue();
        }

        @Test
        @DisplayName("167 hours 59 minutes 59 seconds (inside 7-day window) -> MUST BE FRESH")
        void test167h59m59sInsideWindow() {
            LocalDateTime dt = ref.minusHours(167).minusMinutes(59).minusSeconds(59);
            assertThat(FiltroFrescura.esFresca(dt, ref)).isTrue();
        }

        @Test
        @DisplayName("168 hours 00 minutes 00 seconds (exact 7 days boundary) -> MUST BE FRESH")
        void testExact168hBoundary() {
            LocalDateTime dt = ref.minusDays(7);
            assertThat(FiltroFrescura.esFresca(dt, ref)).isTrue();
        }

        @Test
        @DisplayName("168 hours 00 minutes 01 seconds (1 second beyond 7 days) -> MUST BE STALE")
        void test168h01sBeyondBoundary() {
            LocalDateTime dt = ref.minusDays(7).minusSeconds(1);
            assertThat(FiltroFrescura.esFresca(dt, ref)).isFalse();
        }

        @Test
        @DisplayName("168 hours 01 minute (beyond 7 days) -> MUST BE STALE")
        void test168h01mBeyondBoundary() {
            LocalDateTime dt = ref.minusHours(168).minusMinutes(1);
            assertThat(FiltroFrescura.esFresca(dt, ref)).isFalse();
        }

        @Test
        @DisplayName("7 days 1 hour, 8 days, 15 days, 30 days -> MUST BE STALE")
        void testStaleDaysBeyond7() {
            assertThat(FiltroFrescura.esFresca(ref.minusDays(7).minusHours(1), ref)).isFalse();
            assertThat(FiltroFrescura.esFresca(ref.minusDays(8), ref)).isFalse();
            assertThat(FiltroFrescura.esFresca(ref.minusDays(15), ref)).isFalse();
            assertThat(FiltroFrescura.esFresca(ref.minusDays(30), ref)).isFalse();
            assertThat(FiltroFrescura.esFresca(ref.minusDays(365), ref)).isFalse();
        }
    }

    @Nested
    @DisplayName("2. Future Timestamps & Clock Skew Tolerance Stress")
    class FutureTimestampStress {

        @Test
        @DisplayName("Timestamps up to +24 hours (+1 day) accepted for UTC/timezone skew")
        void testWithin24hFutureTolerance() {
            assertThat(FiltroFrescura.esFresca(ref.plusMinutes(30), ref)).isTrue();
            assertThat(FiltroFrescura.esFresca(ref.plusHours(5), ref)).isTrue();
            assertThat(FiltroFrescura.esFresca(ref.plusHours(12), ref)).isTrue();
            assertThat(FiltroFrescura.esFresca(ref.plusHours(23).plusMinutes(59).plusSeconds(59), ref)).isTrue();
            assertThat(FiltroFrescura.esFresca(ref.plusDays(1), ref)).isTrue();
        }

        @Test
        @DisplayName("Timestamps beyond +24 hours (e.g. +24h 1s, +2 days, +30 days) MUST BE REJECTED")
        void testBeyond24hFutureRejected() {
            assertThat(FiltroFrescura.esFresca(ref.plusDays(1).plusSeconds(1), ref)).isFalse();
            assertThat(FiltroFrescura.esFresca(ref.plusDays(1).plusMinutes(1), ref)).isFalse();
            assertThat(FiltroFrescura.esFresca(ref.plusHours(25), ref)).isFalse();
            assertThat(FiltroFrescura.esFresca(ref.plusDays(2), ref)).isFalse();
            assertThat(FiltroFrescura.esFresca(ref.plusDays(7), ref)).isFalse();
            assertThat(FiltroFrescura.esFresca(ref.plusDays(365), ref)).isFalse();
        }
    }

    @Nested
    @DisplayName("3. Relative Date Parsing with Diacritics, Accents, Case, and Noise")
    class RelativeDateParsingStress {

        @ParameterizedTest
        @ValueSource(strings = {
                "Hace 1 minuto", "hace 1 MINUTO", "hace un minuto", "HACE 5 MINUTOS",
                "hace 1 hora", "HACE 1 HORA", "hace una hora", "hace 4 horas", "hace 23 horas", "hace 2 hrs",
                "Hace 1 día", "HACE 1 DÍA", "hace 1 dia", "hace 1 DIA", "hace un día",
                "hace 2 días", "HACE 2 DIAS", "hace 3 días", "hace 6 días", "hace 7 días", "hace 7 dias",
                "Hace 1 semana", "hace 1 SEMANA", "hace una semana", "hace 1 sem",
                "hoy", "HOY", "publicado hoy", "PUBLICADO HOY", "publicada hoy", "hoy mismo",
                "ayer", "AYER", "publicado ayer", "PUBLICADO AYER", "publicada ayer",
                "recién publicado", "RECIEN PUBLICADO", "recién publicada", "justo ahora", "hace instantes", "hace poco",
                "just now", "JUST NOW", "just posted", "today", "yesterday", "moments ago",
                "1 minute ago", "5 mins ago", "1 hour ago", "an hour ago", "12 hours ago", "23 hrs ago",
                "1 day ago", "a day ago", "2 days ago", "6 days ago", "7 days ago",
                "1 week ago"
        })
        @DisplayName("Fresh relative expressions parse and pass FiltroFrescura")
        void testFreshRelativeExpressions(String input) {
            Optional<LocalDateTime> parsed = ParserFechas.parsear(input, ref);
            assertThat(parsed)
                    .withFailMessage("Expected valid parsing for: " + input)
                    .isPresent();
            assertThat(FiltroFrescura.esFresca(parsed.get(), ref))
                    .withFailMessage("Expected fresh for parsed date from: " + input)
                    .isTrue();
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "hace 8 días", "hace 8 dias", "HACE 8 DÍAS", "hace 9 días", "hace 10 dias",
                "hace 14 días", "hace 15 dias", "hace 20 días", "hace 30 días", "hace 60 dias",
                "hace 2 semanas", "HACE 2 SEMANAS", "hace 3 semanas", "hace 4 sem", "hace 4 semanas",
                "hace 1 mes", "HACE 1 MES", "hace 2 meses", "hace 6 meses",
                "hace más de 7 días", "hace mas de 7 dias", "hace más de 30 días", "hace mas de 30 dias",
                "+30 dias", "+30 días", "+7 dias", "+8 días", "30+ days ago", "more than 30 days ago",
                "8 days ago", "10 days ago", "14 days ago", "15 days ago",
                "2 weeks ago", "3 weeks ago", "4 weeks ago",
                "1 month ago", "2 months ago", "6 months ago"
        })
        @DisplayName("Stale relative expressions parse but MUST BE REJECTED by FiltroFrescura")
        void testStaleRelativeExpressions(String input) {
            Optional<LocalDateTime> parsed = ParserFechas.parsear(input, ref);
            assertThat(parsed)
                    .withFailMessage("Expected parsing for: " + input)
                    .isPresent();
            assertThat(FiltroFrescura.esFresca(parsed.get(), ref))
                    .withFailMessage("Expected STALE (false) for date parsed from: " + input)
                    .isFalse();
        }

        @Test
        @DisplayName("Handles noisy whitespace, tabs, and newlines in relative strings")
        void testWhitespaceAndNoise() {
            Optional<LocalDateTime> p1 = ParserFechas.parsear("  \n\t  Hace   3   días \t\n ", ref);
            assertThat(p1).isPresent();
            assertThat(FiltroFrescura.esFresca(p1.get(), ref)).isTrue();

            Optional<LocalDateTime> p2 = ParserFechas.parsear(" \t  hace   10   dias  \n", ref);
            assertThat(p2).isPresent();
            assertThat(FiltroFrescura.esFresca(p2.get(), ref)).isFalse();
        }
    }

    @Nested
    @DisplayName("4. Leap Year and Calendar Edge Cases")
    class LeapYearStress {

        @Test
        @DisplayName("Leap year Feb 29 reference: accurate 1-day and 7-day calculations")
        void testLeapYearFeb29() {
            LocalDateTime leapRef = LocalDateTime.of(2024, 2, 29, 12, 0, 0);

            // 1 day before Feb 29 is Feb 28
            Optional<LocalDateTime> ayer = ParserFechas.parsear("ayer", leapRef);
            assertThat(ayer).contains(LocalDateTime.of(2024, 2, 28, 12, 0, 0));
            assertThat(FiltroFrescura.esFresca(ayer.get(), leapRef)).isTrue();

            // 7 days before Feb 29 is Feb 22
            Optional<LocalDateTime> d7 = ParserFechas.parsear("hace 7 días", leapRef);
            assertThat(d7).contains(LocalDateTime.of(2024, 2, 22, 12, 0, 0));
            assertThat(FiltroFrescura.esFresca(d7.get(), leapRef)).isTrue();

            // 8 days before is Feb 21 -> Stale
            Optional<LocalDateTime> d8 = ParserFechas.parsear("hace 8 días", leapRef);
            assertThat(d8).contains(LocalDateTime.of(2024, 2, 21, 12, 0, 0));
            assertThat(FiltroFrescura.esFresca(d8.get(), leapRef)).isFalse();
        }

        @Test
        @DisplayName("Mar 1 on leap year (2024) vs non-leap year (2025)")
        void testMar1Boundary() {
            LocalDateTime leapMar1 = LocalDateTime.of(2024, 3, 1, 12, 0, 0);
            Optional<LocalDateTime> ayerLeap = ParserFechas.parsear("ayer", leapMar1);
            assertThat(ayerLeap).contains(LocalDateTime.of(2024, 2, 29, 12, 0, 0));

            LocalDateTime nonLeapMar1 = LocalDateTime.of(2025, 3, 1, 12, 0, 0);
            Optional<LocalDateTime> ayerNonLeap = ParserFechas.parsear("ayer", nonLeapMar1);
            assertThat(ayerNonLeap).contains(LocalDateTime.of(2025, 2, 28, 12, 0, 0));
        }

        @Test
        @DisplayName("Standard date format 29/02/2024 (valid) vs 29/02/2025 (invalid) vs 29/02/2023 (invalid)")
        void testLeapYearDateStrings() {
            Optional<LocalDateTime> leapValid = ParserFechas.parsear("29/02/2024", ref);
            assertThat(leapValid).contains(LocalDateTime.of(2024, 2, 29, 0, 0, 0));
            // 2024 is in the past relative to ref (2026), so must be stale
            assertThat(FiltroFrescura.esFresca(leapValid.get(), ref)).isFalse();

            Optional<LocalDateTime> nonLeapInvalid1 = ParserFechas.parsear("29/02/2025", ref);
            assertThat(nonLeapInvalid1).isEmpty();

            Optional<LocalDateTime> nonLeapInvalid2 = ParserFechas.parsear("29-02-2023", ref);
            assertThat(nonLeapInvalid2).isEmpty();

            Optional<LocalDateTime> isoLeapValid = ParserFechas.parsearIso("2024-02-29T10:00:00Z");
            assertThat(isoLeapValid).contains(LocalDateTime.of(2024, 2, 29, 10, 0, 0));

            Optional<LocalDateTime> isoLeapInvalid = ParserFechas.parsearIso("2025-02-29T10:00:00Z");
            assertThat(isoLeapInvalid).isEmpty();
        }
    }

    @Nested
    @DisplayName("5. Malformed, Corrupted, SQL/HTML Injection, and Empty Inputs")
    class CorruptedAndMalformedInputsStress {

        @ParameterizedTest
        @ValueSource(strings = {
                "",
                "   ",
                "\t\n  \r",
                "null",
                "NULL",
                "undefined",
                "UNDEFINED",
                "N/A",
                "none",
                "salario negociable",
                "bogota",
                "barranquilla",
                "full-time",
                "remoto",
                "fecha no disponible",
                "2026-13-45",
                "2026-02-31",
                "2026-08-32T12:00:00Z",
                "2026-08-25T99:99:99",
                "32/13/2026",
                "99/99/9999",
                "<script>alert('xss')</script>",
                "'; DROP TABLE vacante; --",
                "SELECT * FROM vacante WHERE id = 1"
        })
        @DisplayName("Corrupted and adversarial inputs return Optional.empty() and are safely rejected")
        void testCorruptedAndAdversarialInputs(String malformed) {
            Optional<LocalDateTime> result = ParserFechas.parsear(malformed, ref);
            assertThat(result)
                    .withFailMessage("Expected empty for corrupted input: " + malformed)
                    .isEmpty();
        }

        @Test
        @DisplayName("Null handling across all entry points")
        void testNullHandling() {
            assertThat(ParserFechas.parsear(null, ref)).isEmpty();
            assertThat(ParserFechas.parsear(null, null)).isEmpty();
            assertThat(ParserFechas.parsearIso(null)).isEmpty();
            assertThat(ParserFechas.desdeEpoch((Long) null)).isEmpty();
            assertThat(ParserFechas.desdeEpoch((com.fasterxml.jackson.databind.JsonNode) null)).isEmpty();

            assertThat(FiltroFrescura.esFresca((LocalDateTime) null, ref)).isFalse();
            assertThat(FiltroFrescura.esFresca(ref, (LocalDateTime) null)).isFalse();
            assertThat(FiltroFrescura.esFresca((LocalDateTime) null)).isFalse();
            assertThat(FiltroFrescura.esFresca((Vacante) null, ref)).isFalse();
            assertThat(FiltroFrescura.esFresca((Vacante) null)).isFalse();
        }
    }

    @Nested
    @DisplayName("6. Epoch Timestamps Stress & Extreme Values")
    class EpochTimestampStress {

        @Test
        @DisplayName("10-digit seconds and 13-digit milliseconds epoch")
        void testEpochNormal() {
            long sec = 1787654321L;
            Optional<LocalDateTime> dtSec = ParserFechas.desdeEpoch(sec);
            assertThat(dtSec).isPresent();

            long ms = sec * 1000L;
            Optional<LocalDateTime> dtMs = ParserFechas.desdeEpoch(ms);
            assertThat(dtMs).isPresent();
            assertThat(dtMs).isEqualTo(dtSec);
        }

        @Test
        @DisplayName("Extreme and out-of-range epoch numbers")
        void testExtremeEpoch() {
            Optional<LocalDateTime> negative = ParserFechas.desdeEpoch(-100000000000000L);
            if (negative.isPresent()) {
                assertThat(FiltroFrescura.esFresca(negative.get(), ref)).isFalse();
            }

            Optional<LocalDateTime> futureExtreme = ParserFechas.desdeEpoch(999999999999999999L);
            if (futureExtreme.isPresent()) {
                assertThat(FiltroFrescura.esFresca(futureExtreme.get(), ref)).isFalse();
            }
        }
    }

    @Nested
    @DisplayName("7. Double-Ring Gatekeeper & ScrapingService.soloFrescas Simulation")
    class GatekeeperVerificationStress {

        @Test
        @DisplayName("Batch filtering rejects 100% of stale, null, unparseable, and far-future vacancies")
        void testBatchGatekeeperVerification() {
            List<Vacante> batch = new ArrayList<>();

            // 1. Fresh: 2 hours ago
            var v1 = new Vacante();
            v1.setTitulo("V1 - Fresh 2h");
            v1.setFechaPublicacion(ref.minusHours(2));
            batch.add(v1);

            // 2. Fresh: 6 days 23 hours ago (167h)
            var v2 = new Vacante();
            v2.setTitulo("V2 - Fresh 167h");
            v2.setFechaPublicacion(ref.minusHours(167));
            batch.add(v2);

            // 3. Fresh: Exact 7 days boundary (168h 00m 00s)
            var v3 = new Vacante();
            v3.setTitulo("V3 - Fresh Exact 7d");
            v3.setFechaPublicacion(ref.minusDays(7));
            batch.add(v3);

            // 4. Fresh: Future within 24h timezone skew tolerance
            var v4 = new Vacante();
            v4.setTitulo("V4 - Fresh Future +12h");
            v4.setFechaPublicacion(ref.plusHours(12));
            batch.add(v4);

            // 5. STALE: 7 days + 1 second (168h 0m 1s)
            var v5 = new Vacante();
            v5.setTitulo("V5 - Stale 7d+1s");
            v5.setFechaPublicacion(ref.minusDays(7).minusSeconds(1));
            batch.add(v5);

            // 6. STALE: 8 days
            var v6 = new Vacante();
            v6.setTitulo("V6 - Stale 8d");
            v6.setFechaPublicacion(ref.minusDays(8));
            batch.add(v6);

            // 7. STALE: 30 days
            var v7 = new Vacante();
            v7.setTitulo("V7 - Stale 30d");
            v7.setFechaPublicacion(ref.minusDays(30));
            batch.add(v7);

            // 8. INVALID: Far future +2 days
            var v8 = new Vacante();
            v8.setTitulo("V8 - Invalid Future +2d");
            v8.setFechaPublicacion(ref.plusDays(2));
            batch.add(v8);

            // 9. INVALID: Null date
            var v9 = new Vacante();
            v9.setTitulo("V9 - Null Date");
            v9.setFechaPublicacion(null);
            batch.add(v9);

            // Filter batch through FiltroFrescura
            List<Vacante> passed = batch.stream()
                    .filter(v -> FiltroFrescura.esFresca(v, ref))
                    .toList();

            // Exactly 4 must pass (v1, v2, v3, v4)
            assertThat(passed).hasSize(4);
            assertThat(passed).extracting(Vacante::getTitulo)
                    .containsExactly("V1 - Fresh 2h", "V2 - Fresh 167h", "V3 - Fresh Exact 7d", "V4 - Fresh Future +12h");

            // Specifically verify stale vacancies are rejected
            assertThat(passed).extracting(Vacante::getTitulo)
                    .doesNotContain("V5 - Stale 7d+1s", "V6 - Stale 8d", "V7 - Stale 30d", "V8 - Invalid Future +2d", "V9 - Null Date");
        }
    }

    @Nested
    @DisplayName("8. Remediated Bug Verification & Hardened Token Validation")
    class RemediatedBugVerification {

        @Test
        @DisplayName("VERIFIED REMEDIATION 1: Non-date and corrupted strings return Optional.empty() and do not default to 1")
        void testCorruptedTokensReturnEmpty() {
            // Corrupted non-numeric or negative tokens must return Optional.empty()
            Optional<LocalDateTime> nanDias = ParserFechas.parsear("hace NaN días", ref);
            Optional<LocalDateTime> undefinedHoras = ParserFechas.parsear("hace undefined horas", ref);
            Optional<LocalDateTime> negDias = ParserFechas.parsear("hace -5 días", ref);
            Optional<LocalDateTime> nullMins = ParserFechas.parsear("hace null minutos", ref);
            Optional<LocalDateTime> negDaysAgo = ParserFechas.parsear("-1 days ago", ref);
            Optional<LocalDateTime> jornada = ParserFechas.parsear("jornada 40 horas", ref);
            Optional<LocalDateTime> pagoHoras = ParserFechas.parsear("pago por horas", ref);
            Optional<LocalDateTime> singleLetterD = ParserFechas.parsear("d", ref);
            Optional<LocalDateTime> singleLetterH = ParserFechas.parsear("h", ref);

            assertThat(nanDias).isEmpty();
            assertThat(undefinedHoras).isEmpty();
            assertThat(negDias).isEmpty();
            assertThat(nullMins).isEmpty();
            assertThat(negDaysAgo).isEmpty();
            assertThat(jornada).isEmpty();
            assertThat(pagoHoras).isEmpty();
            assertThat(singleLetterD).isEmpty();
            assertThat(singleLetterH).isEmpty();
        }

        @Test
        @DisplayName("VERIFIED REMEDIATION 2: 'hace 1 año' and '1 year ago' are parsed and rejected by FiltroFrescura")
        void testYearParsingAndStaleness() {
            Optional<LocalDateTime> unAnio = ParserFechas.parsear("hace 1 año", ref);
            Optional<LocalDateTime> oneYear = ParserFechas.parsear("1 year ago", ref);
            Optional<LocalDateTime> dosAnios = ParserFechas.parsear("hace 2 años", ref);

            assertThat(unAnio).contains(ref.minusYears(1));
            assertThat(oneYear).contains(ref.minusYears(1));
            assertThat(dosAnios).contains(ref.minusYears(2));

            assertThat(FiltroFrescura.esFresca(unAnio.get(), ref)).isFalse();
            assertThat(FiltroFrescura.esFresca(oneYear.get(), ref)).isFalse();
            assertThat(FiltroFrescura.esFresca(dosAnios.get(), ref)).isFalse();
        }
    }
}
