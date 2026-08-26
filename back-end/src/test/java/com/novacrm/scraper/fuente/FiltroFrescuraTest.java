package com.novacrm.scraper.fuente;

import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class FiltroFrescuraTest {

    private final LocalDateTime ref = LocalDateTime.of(2026, 8, 25, 12, 0, 0);

    @Test
    @DisplayName("Acepta fechas dentro de la ventana de 7 días")
    void aceptaFechasDentroDeVentana7Dias() {
        assertThat(FiltroFrescura.esFresca(ref, ref)).isTrue();
        assertThat(FiltroFrescura.esFresca(ref.minusHours(6), ref)).isTrue();
        assertThat(FiltroFrescura.esFresca(ref.minusDays(1), ref)).isTrue();
        assertThat(FiltroFrescura.esFresca(ref.minusDays(3), ref)).isTrue();
        assertThat(FiltroFrescura.esFresca(ref.minusDays(6), ref)).isTrue();
        assertThat(FiltroFrescura.esFresca(ref.minusDays(7), ref)).isTrue();
    }

    @Test
    @DisplayName("Rechaza fechas con antigüedad mayor a 7 días")
    void rechazaFechasMayoresA7Dias() {
        assertThat(FiltroFrescura.esFresca(ref.minusDays(7).minusMinutes(1), ref)).isFalse();
        assertThat(FiltroFrescura.esFresca(ref.minusDays(8), ref)).isFalse();
        assertThat(FiltroFrescura.esFresca(ref.minusDays(15), ref)).isFalse();
        assertThat(FiltroFrescura.esFresca(ref.minusDays(30), ref)).isFalse();
        assertThat(FiltroFrescura.esFresca(ref.minusDays(31), ref)).isFalse();
    }

    @Test
    @DisplayName("Admite tolerancia superior de +1 día para discrepancias de zona horaria UTC")
    void admiteToleranciaZonaHoraria() {
        assertThat(FiltroFrescura.esFresca(ref.plusHours(5), ref)).isTrue();
        assertThat(FiltroFrescura.esFresca(ref.plusHours(12), ref)).isTrue();
        assertThat(FiltroFrescura.esFresca(ref.plusDays(1), ref)).isTrue();

        // Fechas futuras más allá de 1 día se rechazan
        assertThat(FiltroFrescura.esFresca(ref.plusDays(1).plusMinutes(1), ref)).isFalse();
        assertThat(FiltroFrescura.esFresca(ref.plusDays(3), ref)).isFalse();
    }

    @Test
    @DisplayName("Rechaza valores nulos de fecha o referencia")
    void rechazaValoresNulos() {
        assertThat(FiltroFrescura.esFresca((LocalDateTime) null, ref)).isFalse();
        assertThat(FiltroFrescura.esFresca(ref, (LocalDateTime) null)).isFalse();
        assertThat(FiltroFrescura.esFresca((LocalDateTime) null)).isFalse();
    }

    @Test
    @DisplayName("Evalúa correctamente entidades Vacante")
    void evaluaVacante() {
        var vacanteFresca = new Vacante();
        vacanteFresca.setFechaPublicacion(ref.minusDays(2));
        assertThat(FiltroFrescura.esFresca(vacanteFresca, ref)).isTrue();

        var vacanteVieja = new Vacante();
        vacanteVieja.setFechaPublicacion(ref.minusDays(10));
        assertThat(FiltroFrescura.esFresca(vacanteVieja, ref)).isFalse();

        var vacanteSinFecha = new Vacante();
        vacanteSinFecha.setFechaPublicacion(null);
        assertThat(FiltroFrescura.esFresca(vacanteSinFecha, ref)).isFalse();

        assertThat(FiltroFrescura.esFresca((Vacante) null, ref)).isFalse();
        assertThat(FiltroFrescura.esFresca((Vacante) null)).isFalse();
    }

    @Test
    @DisplayName("Soporta configuración personalizada de días máximos")
    void soportaDiasPersonalizados() {
        assertThat(FiltroFrescura.esFresca(ref.minusDays(2), ref, 3)).isTrue();
        assertThat(FiltroFrescura.esFresca(ref.minusDays(4), ref, 3)).isFalse();
        assertThat(FiltroFrescura.esDentroDeUltimosDias(ref.minusDays(10), 14, ref)).isTrue();
        assertThat(FiltroFrescura.esDentroDeUltimosDias(ref.minusDays(15), 14, ref)).isFalse();
    }
}
