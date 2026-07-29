package com.novacrm.postulacion;

import com.novacrm.seguimiento.EstadoContacto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Las reglas de cuando una postulacion mueve al estudiante de columna.
 *
 * <p>Son la parte delicada de dejar que el participante actualice su propio
 * seguimiento: sin ellas, el tablero del equipo se vuelve inservible en cuanto
 * alguien con cinco procesos abiertos toca cualquiera de ellos.
 */
class AvanceDelTableroTest {

    @Test
    @DisplayName("una entrevista agendada saca al estudiante de en proceso")
    void unaEntrevistaAgendadaSacaDeEnProceso() {
        var destino = AvanceDelTablero.destino(
                EstadoContacto.EN_PROCESO, EstadoPostulacion.ENTREVISTA_AGENDADA);

        assertThat(destino).contains(EstadoContacto.ENTREVISTA);
    }

    @Test
    @DisplayName("registrar una postulacion nueva no devuelve a quien ya tenia entrevista")
    void registrarUnaPostulacionNuevaNoDevuelveAQuienYaTeniaEntrevista() {
        // El caso que hace inservible el tablero: alguien con una entrevista
        // viva anota su sexta postulacion y retrocede una columna.
        var destino = AvanceDelTablero.destino(
                EstadoContacto.ENTREVISTA, EstadoPostulacion.ENVIADA);

        assertThat(destino).isEmpty();
    }

    @Test
    @DisplayName("un rechazo no mueve al estudiante: es informacion del proceso, no de la persona")
    void unRechazoNoMueveAlEstudiante() {
        var destino = AvanceDelTablero.destino(
                EstadoContacto.ENTREVISTA, EstadoPostulacion.RECHAZADO);

        assertThat(destino).isEmpty();
    }

    @Test
    @DisplayName("quedarse sin respuesta tampoco lo mueve")
    void quedarseSinRespuestaTampocoLoMueve() {
        assertThat(AvanceDelTablero.destino(EstadoContacto.EN_PROCESO, EstadoPostulacion.SIN_RESPUESTA))
                .isEmpty();
    }

    @Test
    @DisplayName("de una tarjeta cerrada a mano no se sale sola")
    void deUnaTarjetaCerradaAManoNoSeSaleSola() {
        // Alguien decidio dejar de hacerle seguimiento. Que reaparezca
        // actividad es motivo para avisar, no para deshacer esa decision.
        assertThat(AvanceDelTablero.destino(EstadoContacto.CERRADO, EstadoPostulacion.ENTREVISTA_AGENDADA))
                .isEmpty();
        assertThat(AvanceDelTablero.destino(EstadoContacto.CERRADO, EstadoPostulacion.CONTRATADO))
                .isEmpty();
    }

    @Test
    @DisplayName("quien no habia sido contactado pasa a en proceso al postularse")
    void quienNoHabiaSidoContactadoPasaAEnProceso() {
        var destino = AvanceDelTablero.destino(
                EstadoContacto.SIN_CONTACTO, EstadoPostulacion.ENVIADA);

        assertThat(destino).contains(EstadoContacto.EN_PROCESO);
    }

    @Test
    @DisplayName("un contratado llega hasta colocado desde cualquier peldano")
    void unContratadoLlegaHastaColocado() {
        assertThat(AvanceDelTablero.destino(EstadoContacto.SIN_CONTACTO, EstadoPostulacion.CONTRATADO))
                .contains(EstadoContacto.COLOCADO);
        assertThat(AvanceDelTablero.destino(EstadoContacto.ENTREVISTA, EstadoPostulacion.CONTRATADO))
                .contains(EstadoContacto.COLOCADO);
    }

    @Test
    @DisplayName("quien ya estaba colocado no se mueve por nada")
    void quienYaEstabaColocadoNoSeMuevePorNada() {
        for (EstadoPostulacion estado : EstadoPostulacion.values()) {
            assertThat(AvanceDelTablero.destino(EstadoContacto.COLOCADO, estado))
                    .as("colocado + %s", estado)
                    .isEmpty();
        }
    }

    @Test
    @DisplayName("sin estado de contacto previo se parte del inicial")
    void sinEstadoDeContactoPrevioSeParteDelInicial() {
        assertThat(AvanceDelTablero.destino(null, EstadoPostulacion.ENTREVISTA_AGENDADA))
                .contains(EstadoContacto.ENTREVISTA);
    }

    @Test
    @DisplayName("sin estado de postulacion no hay movimiento que calcular")
    void sinEstadoDePostulacionNoHayMovimiento() {
        assertThat(AvanceDelTablero.destino(EstadoContacto.EN_PROCESO, null)).isEmpty();
    }

    @Test
    @DisplayName("una entrevista realizada mantiene al estudiante en entrevista, no retrocede")
    void unaEntrevistaRealizadaMantieneEnEntrevista() {
        assertThat(AvanceDelTablero.destino(EstadoContacto.ENTREVISTA, EstadoPostulacion.ENTREVISTA_REALIZADA))
                .isEmpty();
    }
}
