package com.novacrm.estudiante;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class EdadParticipanteTest {

    private static final LocalDate HOY = LocalDate.of(2026, 7, 28);

    @Test
    @DisplayName("con fecha de nacimiento la edad es exacta")
    void conFechaDeNacimientoLaEdadEsExacta() {
        assertThat(EdadParticipante.resolver(LocalDate.of(2003, 1, 15), null, null, HOY))
                .isEqualTo(23);
    }

    @Test
    @DisplayName("quien aun no ha cumplido este año tiene un año menos")
    void quienAunNoHaCumplidoTieneUnAnoMenos() {
        assertThat(EdadParticipante.resolver(LocalDate.of(2003, 12, 31), null, null, HOY))
                .isEqualTo(22);
    }

    @Test
    @DisplayName("la edad importada de la hoja envejece desde el dia en que se capturo")
    void laEdadImportadaEnvejeceDesdeSuCaptura() {
        // El caso que motiva la clase: la hoja solo trae el numero. Guardarlo
        // tal cual dejaria a los 107 participantes con la edad del año pasado
        // en cuanto alguien reimportara el archivo.
        assertThat(EdadParticipante.resolver(null, 20, LocalDate.of(2024, 7, 28), HOY))
                .isEqualTo(22);
    }

    @Test
    @DisplayName("una edad capturada hoy se devuelve tal cual")
    void unaEdadCapturadaHoySeDevuelveTalCual() {
        assertThat(EdadParticipante.resolver(null, 20, HOY, HOY)).isEqualTo(20);
    }

    @Test
    @DisplayName("la fecha de nacimiento gana sobre la edad importada")
    void laFechaDeNacimientoGanaSobreLaEdadImportada() {
        // La hoja decia 30 y estaba mal; la fecha real dice 23. Manda la fecha.
        assertThat(EdadParticipante.resolver(
                LocalDate.of(2003, 1, 15), 30, LocalDate.of(2024, 7, 28), HOY))
                .isEqualTo(23);
    }

    @Test
    @DisplayName("sin ningun dato no se inventa una edad")
    void sinNingunDatoNoSeInventaUnaEdad() {
        assertThat(EdadParticipante.resolver(null, null, null, HOY)).isNull();
    }

    @Test
    @DisplayName("una edad sin fecha de captura no se puede envejecer, asi que no se usa")
    void unaEdadSinFechaDeCapturaNoSeUsa() {
        assertThat(EdadParticipante.resolver(null, 20, null, HOY)).isNull();
    }

    @Test
    @DisplayName("una fecha de nacimiento en el futuro no produce una edad negativa")
    void unaFechaDeNacimientoEnElFuturoNoProduceEdadNegativa() {
        assertThat(EdadParticipante.resolver(LocalDate.of(2030, 1, 1), null, null, HOY)).isNull();
    }
}
