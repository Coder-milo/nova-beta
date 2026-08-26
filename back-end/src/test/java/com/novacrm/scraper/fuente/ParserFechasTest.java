package com.novacrm.scraper.fuente;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

class ParserFechasTest {

    private final LocalDateTime ref = LocalDateTime.of(2026, 8, 25, 12, 0, 0);

    @Test
    @DisplayName("Parsea minutos relativos en español")
    void parseaMinutosRelativosEspanol() {
        Optional<LocalDateTime> res1 = ParserFechas.parsear("Hace 1 minuto", ref);
        assertThat(res1).contains(ref.minusMinutes(1));

        Optional<LocalDateTime> res2 = ParserFechas.parsear("hace 35 minutos", ref);
        assertThat(res2).contains(ref.minusMinutes(35));

        Optional<LocalDateTime> res3 = ParserFechas.parsear("hace 10 mins", ref);
        assertThat(res3).contains(ref.minusMinutes(10));

        Optional<LocalDateTime> res4 = ParserFechas.parsear("hace un minuto", ref);
        assertThat(res4).contains(ref.minusMinutes(1));
    }

    @Test
    @DisplayName("Parsea horas relativas en español")
    void parseaHorasRelativasEspanol() {
        Optional<LocalDateTime> res1 = ParserFechas.parsear("Hace 1 hora", ref);
        assertThat(res1).contains(ref.minusHours(1));

        Optional<LocalDateTime> res2 = ParserFechas.parsear("hace 4 horas", ref);
        assertThat(res2).contains(ref.minusHours(4));

        Optional<LocalDateTime> res3 = ParserFechas.parsear("hace 23 horas", ref);
        assertThat(res3).contains(ref.minusHours(23));

        Optional<LocalDateTime> res4 = ParserFechas.parsear("hace 2 hrs", ref);
        assertThat(res4).contains(ref.minusHours(2));
    }

    @Test
    @DisplayName("Parsea días relativos en español")
    void parseaDiasRelativosEspanol() {
        Optional<LocalDateTime> res1 = ParserFechas.parsear("Hace 1 día", ref);
        assertThat(res1).contains(ref.minusDays(1));

        Optional<LocalDateTime> res2 = ParserFechas.parsear("hace 2 dias", ref);
        assertThat(res2).contains(ref.minusDays(2));

        Optional<LocalDateTime> res3 = ParserFechas.parsear("hace 7 días", ref);
        assertThat(res3).contains(ref.minusDays(7));

        Optional<LocalDateTime> res4 = ParserFechas.parsear("hace 8 dias", ref);
        assertThat(res4).contains(ref.minusDays(8));
    }

    @Test
    @DisplayName("Parsea semanas relativas en español")
    void parseaSemanasRelativasEspanol() {
        Optional<LocalDateTime> res1 = ParserFechas.parsear("Hace 1 semana", ref);
        assertThat(res1).contains(ref.minusWeeks(1));

        Optional<LocalDateTime> res2 = ParserFechas.parsear("hace 2 semanas", ref);
        assertThat(res2).contains(ref.minusWeeks(2));

        Optional<LocalDateTime> res3 = ParserFechas.parsear("hace 3 sem", ref);
        assertThat(res3).contains(ref.minusWeeks(3));
    }

    @Test
    @DisplayName("Parsea meses relativos en español")
    void parseaMesesRelativosEspanol() {
        Optional<LocalDateTime> res1 = ParserFechas.parsear("Hace 1 mes", ref);
        assertThat(res1).contains(ref.minusMonths(1));

        Optional<LocalDateTime> res2 = ParserFechas.parsear("hace 2 meses", ref);
        assertThat(res2).contains(ref.minusMonths(2));
    }

    @Test
    @DisplayName("Parsea marcadores directos (hoy, ayer) en español")
    void parseaMarcadoresDirectosEspanol() {
        assertThat(ParserFechas.parsear("hoy", ref)).contains(ref);
        assertThat(ParserFechas.parsear("publicado hoy", ref)).contains(ref);
        assertThat(ParserFechas.parsear("publicada hoy", ref)).contains(ref);
        assertThat(ParserFechas.parsear("hoy mismo", ref)).contains(ref);

        assertThat(ParserFechas.parsear("ayer", ref)).contains(ref.minusDays(1));
        assertThat(ParserFechas.parsear("publicado ayer", ref)).contains(ref.minusDays(1));
        assertThat(ParserFechas.parsear("publicada ayer", ref)).contains(ref.minusDays(1));
    }

    @Test
    @DisplayName("Parsea inmediatez en español")
    void parseaInmediatosEspanol() {
        assertThat(ParserFechas.parsear("hace instantes", ref)).contains(ref);
        assertThat(ParserFechas.parsear("recién publicado", ref)).contains(ref);
        assertThat(ParserFechas.parsear("recien publicada", ref)).contains(ref);
        assertThat(ParserFechas.parsear("justo ahora", ref)).contains(ref);
        assertThat(ParserFechas.parsear("hace poco", ref)).contains(ref);
    }

    @Test
    @DisplayName("Parsea marcadores de más de 30 días")
    void parseaMasDe30Dias() {
        assertThat(ParserFechas.parsear("hace más de 30 días", ref)).contains(ref.minusDays(31));
        assertThat(ParserFechas.parsear("hace mas de 30 dias", ref)).contains(ref.minusDays(31));
        assertThat(ParserFechas.parsear("+30 dias", ref)).contains(ref.minusDays(31));
        assertThat(ParserFechas.parsear("30+ days ago", ref)).contains(ref.minusDays(31));
    }

    @Test
    @DisplayName("Parsea expresiones relativas en inglés")
    void parseaExpresionesRelativasIngles() {
        assertThat(ParserFechas.parsear("just now", ref)).contains(ref);
        assertThat(ParserFechas.parsear("just posted", ref)).contains(ref);
        assertThat(ParserFechas.parsear("today", ref)).contains(ref);
        assertThat(ParserFechas.parsear("yesterday", ref)).contains(ref.minusDays(1));
        assertThat(ParserFechas.parsear("15 minutes ago", ref)).contains(ref.minusMinutes(15));
        assertThat(ParserFechas.parsear("1 hour ago", ref)).contains(ref.minusHours(1));
        assertThat(ParserFechas.parsear("an hour ago", ref)).contains(ref.minusHours(1));
        assertThat(ParserFechas.parsear("3 days ago", ref)).contains(ref.minusDays(3));
        assertThat(ParserFechas.parsear("1 week ago", ref)).contains(ref.minusWeeks(1));
        assertThat(ParserFechas.parsear("2 weeks ago", ref)).contains(ref.minusWeeks(2));
        assertThat(ParserFechas.parsear("1 month ago", ref)).contains(ref.minusMonths(1));
    }

    @Test
    @DisplayName("Parsea formatos ISO-8601 con y sin zona horaria")
    void parseaIso8601() {
        Optional<LocalDateTime> isoUtc = ParserFechas.parsear("2026-08-25T14:30:00Z", ref);
        assertThat(isoUtc).contains(LocalDateTime.of(2026, 8, 25, 14, 30, 0));

        Optional<LocalDateTime> isoOffset = ParserFechas.parsear("2026-08-25T10:00:00-05:00", ref);
        assertThat(isoOffset).contains(LocalDateTime.of(2026, 8, 25, 10, 0, 0));

        Optional<LocalDateTime> isoLocal = ParserFechas.parsear("2026-08-25T14:30:00", ref);
        assertThat(isoLocal).contains(LocalDateTime.of(2026, 8, 25, 14, 30, 0));

        Optional<LocalDateTime> isoEspacio = ParserFechas.parsear("2026-08-25 14:30:00", ref);
        assertThat(isoEspacio).contains(LocalDateTime.of(2026, 8, 25, 14, 30, 0));

        Optional<LocalDateTime> isoSoloFecha = ParserFechas.parsear("2026-08-25", ref);
        assertThat(isoSoloFecha).contains(LocalDateTime.of(2026, 8, 25, 0, 0, 0));
    }

    @Test
    @DisplayName("Parsea formatos de fecha estándar DD/MM/YYYY y DD-MM-YYYY")
    void parseaFormatoEstandar() {
        Optional<LocalDateTime> f1 = ParserFechas.parsear("25/08/2026", ref);
        assertThat(f1).contains(LocalDateTime.of(2026, 8, 25, 0, 0, 0));

        Optional<LocalDateTime> f2 = ParserFechas.parsear("25-08-2026 15:45:00", ref);
        assertThat(f2).contains(LocalDateTime.of(2026, 8, 25, 15, 45, 0));
    }

    @Test
    @DisplayName("Parsea timestamps Epoch en segundos y milisegundos")
    void parseaEpoch() {
        long epochSegundos = 1787654321L;
        Optional<LocalDateTime> resSec = ParserFechas.desdeEpoch(epochSegundos);
        assertThat(resSec).isPresent();

        Optional<LocalDateTime> resStr = ParserFechas.parsear(String.valueOf(epochSegundos), ref);
        assertThat(resStr).isEqualTo(resSec);

        long epochMillis = 1787654321000L;
        Optional<LocalDateTime> resMs = ParserFechas.desdeEpoch(epochMillis);
        assertThat(resMs).isEqualTo(resSec);
    }

    @Test
    @DisplayName("Parsea Epoch desde JsonNode")
    void parseaEpochDesdeJsonNode() throws Exception {
        var mapper = new ObjectMapper();
        var node = mapper.readTree("{\"created_at\": 1787654321}");
        Optional<LocalDateTime> res = ParserFechas.desdeEpoch(node.get("created_at"));
        assertThat(res).isPresent();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "HACE 3 DÍAS",
            "PUBLICADO HOY",
            "Hace 1 Día",
            "1 WEEK AGO",
            "JUST NOW"
    })
    @DisplayName("Tolera mayúsculas y diacríticos en texto relativo")
    void toleraMayusculasYDiacriticos(String texto) {
        assertThat(ParserFechas.parsear(texto, ref)).isPresent();
    }

    @Test
    @DisplayName("Parsea años relativos en español e inglés")
    void parseaAniosRelativos() {
        Optional<LocalDateTime> res1 = ParserFechas.parsear("Hace 1 año", ref);
        assertThat(res1).contains(ref.minusYears(1));

        Optional<LocalDateTime> res2 = ParserFechas.parsear("hace un año", ref);
        assertThat(res2).contains(ref.minusYears(1));

        Optional<LocalDateTime> res3 = ParserFechas.parsear("hace 2 años", ref);
        assertThat(res3).contains(ref.minusYears(2));

        Optional<LocalDateTime> res4 = ParserFechas.parsear("1 year ago", ref);
        assertThat(res4).contains(ref.minusYears(1));

        Optional<LocalDateTime> res5 = ParserFechas.parsear("a year ago", ref);
        assertThat(res5).contains(ref.minusYears(1));

        Optional<LocalDateTime> res6 = ParserFechas.parsear("3 years ago", ref);
        assertThat(res6).contains(ref.minusYears(3));
    }

    @Test
    @DisplayName("Parsea unidades compactas con dígitos")
    void parseaUnidadesCompactasConDigitos() {
        assertThat(ParserFechas.parsear("5m", ref)).contains(ref.minusMinutes(5));
        assertThat(ParserFechas.parsear("24h", ref)).contains(ref.minusHours(24));
        assertThat(ParserFechas.parsear("3d", ref)).contains(ref.minusDays(3));
        assertThat(ParserFechas.parsear("2w", ref)).contains(ref.minusWeeks(2));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "",
            "   ",
            "salario negociable",
            "bogota",
            "atlantico",
            "tiempo completo",
            "xyz123abc",
            "hace NaN días",
            "hace undefined horas",
            "hace -5 días",
            "jornada 40 horas",
            "pago por horas",
            "40 horas semanales",
            "hace null minutos",
            "-1 days ago",
            "d",
            "h",
            "m",
            "w"
    })
    @DisplayName("Retorna Optional.empty() para textos no válidos, corruptos o no reconocibles")
    void retornaVacioParaTextosInvalidos(String texto) {
        assertThat(ParserFechas.parsear(texto, ref)).isEmpty();
    }

    @Test
    @DisplayName("Retorna Optional.empty() para nulo")
    void retornaVacioParaNulo() {
        assertThat(ParserFechas.parsear(null, ref)).isEmpty();
        assertThat(ParserFechas.desdeEpoch((Long) null)).isEmpty();
    }
}
