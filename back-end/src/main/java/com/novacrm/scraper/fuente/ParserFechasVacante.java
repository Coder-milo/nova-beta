package com.novacrm.scraper.fuente;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Adaptador / Alias para {@link ParserFechas}.
 */
public final class ParserFechasVacante {

    private ParserFechasVacante() {}

    public static Optional<LocalDateTime> parsear(String texto) {
        return ParserFechas.parsear(texto);
    }

    public static Optional<LocalDateTime> parsear(String texto, LocalDateTime referencia) {
        return ParserFechas.parsear(texto, referencia);
    }

    public static Optional<LocalDateTime> parsearIso(String texto) {
        return ParserFechas.parsearIso(texto);
    }

    public static Optional<LocalDateTime> desdeEpoch(Long epoch) {
        return ParserFechas.desdeEpoch(epoch);
    }

    public static Optional<LocalDateTime> desdeEpoch(long epoch) {
        return ParserFechas.desdeEpoch(epoch);
    }

    public static Optional<LocalDateTime> desdeEpoch(JsonNode nodo) {
        return ParserFechas.desdeEpoch(nodo);
    }
}
