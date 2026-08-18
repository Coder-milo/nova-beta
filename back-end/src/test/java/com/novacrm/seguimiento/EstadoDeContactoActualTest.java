package com.novacrm.seguimiento;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * De donde sale el estado de contacto de un estudiante.
 *
 * <p>El estado no se guarda en ninguna columna: es el del ultimo movimiento del
 * historial. Lo que se prueba aqui es que esa lectura sea estable, porque de
 * ella depende en que columna del tablero aparece cada persona.
 */
class EstadoDeContactoActualTest {

    private static final LocalDate HOY = LocalDate.of(2026, 7, 28);

    private Seguimiento mov(String tipo, String estado, LocalDate fecha) {
        var s = new Seguimiento();
        s.setTipo(tipo);
        s.setEstado(estado);
        s.setFecha(fecha);
        return s;
    }

    @Test
    void sinHistorialNadieHaHablado() {
        assertEquals(EstadoContacto.SIN_CONTACTO, EstadoDeContactoActual.de(List.of()));
        assertEquals(EstadoContacto.SIN_CONTACTO, EstadoDeContactoActual.de(null));
    }

    @Test
    void mandaElMovimientoMasReciente() {
        var historial = List.of(
                mov("CONTACTO", "EN_PROCESO", LocalDate.of(2026, 7, 1)),
                mov("CONTACTO", "ENTREVISTA", LocalDate.of(2026, 7, 20)),
                mov("CONTACTO", "SIN_CONTACTO", LocalDate.of(2026, 6, 1)));

        assertEquals(EstadoContacto.ENTREVISTA, EstadoDeContactoActual.de(historial));
    }

    /**
     * El historial mezcla simulacros, llamadas y notas. Si contaran todos,
     * registrar un simulacro moveria la tarjeta de columna sin que nadie lo
     * pidiera.
     */
    @Test
    void otrosTiposDeSeguimientoNoMuevenLaTarjeta() {
        var historial = List.of(
                mov("CONTACTO", "ENTREVISTA", LocalDate.of(2026, 7, 1)),
                mov("SIMULACRO_TECNICO", "COMPLETADO", LocalDate.of(2026, 7, 25)));

        assertEquals(EstadoContacto.ENTREVISTA, EstadoDeContactoActual.de(historial),
                "un simulacro posterior no cambia el estado de contacto");
    }

    /**
     * La columna `estado` es texto libre y lleva anos aceptando cosas como
     * "PENDIENTE". Un valor viejo no puede tumbar el tablero.
     */
    @Test
    void unEstadoDesconocidoSeIgnoraEnVezDeReventar() {
        var historial = List.of(
                mov("CONTACTO", "EN_PROCESO", LocalDate.of(2026, 7, 1)),
                mov("CONTACTO", "PENDIENTE", LocalDate.of(2026, 7, 25)));

        assertEquals(EstadoContacto.EN_PROCESO, EstadoDeContactoActual.de(historial));
    }

    @Test
    void sinNingunMovimientoValidoSeVuelveAlInicial() {
        var historial = List.of(mov("CONTACTO", "LO_QUE_SEA", LocalDate.of(2026, 7, 1)));

        assertEquals(EstadoContacto.SIN_CONTACTO, EstadoDeContactoActual.de(historial));
    }

    @Test
    void losDiasSinContactoSeCuentanDesdeElUltimoMovimiento() {
        var historial = List.of(mov("CONTACTO", "EN_PROCESO", LocalDate.of(2026, 7, 14)));

        assertEquals(14, EstadoDeContactoActual.diasSinContacto(historial, HOY));
    }

    @Test
    void nuncaContactadoNoEsCeroDias() {
        // Cero dias significa "hoy hablamos"; nunca es otra cosa y la pantalla
        // tiene que poder distinguirlas.
        assertNull(EstadoDeContactoActual.diasSinContacto(List.of(), HOY));
    }

    @Test
    void unaFechaFuturaNoDaDiasNegativos() {
        var agendado = List.of(mov("CONTACTO", "EN_PROCESO", LocalDate.of(2026, 8, 10)));

        assertEquals(0, EstadoDeContactoActual.diasSinContacto(agendado, HOY));
    }

    /**
     * Una llamada apuntada es contacto.
     *
     * <p>La cuenta de dias usaba el mismo filtro que la columna del tablero, y
     * ese filtro existe por otra razon: que un simulacro no mueva a nadie de
     * columna. Como efecto, una coordinadora llamaba a un participante,
     * apuntaba la llamada y la tarjeta seguia diciendo «23 dias sin contacto» y
     * en alerta. La lista que dice a quien hay que llamar dejaba fuera
     * justamente las llamadas.
     */
    @Test
    void unaLlamadaApuntadaCuentaComoContacto() {
        var historial = List.of(
                mov("CONTACTO", "EN_PROCESO", LocalDate.of(2026, 7, 1)),
                mov("LLAMADA", "HECHA", LocalDate.of(2026, 7, 26)));

        assertEquals(2, EstadoDeContactoActual.diasSinContacto(historial, HOY),
                "hace dos dias que se le llamo, no veintisiete");
        assertEquals(LocalDate.of(2026, 7, 26),
                EstadoDeContactoActual.fechaUltimoContacto(historial).orElseThrow());
        // Y la tarjeta no se ha movido de columna: son dos preguntas distintas.
        assertEquals(EstadoContacto.EN_PROCESO, EstadoDeContactoActual.de(historial));
    }

    @Test
    void seCuentanTodasLasAccionesNoSoloLasDeContacto() {
        var historial = List.of(
                mov("CONTACTO", "EN_PROCESO", HOY),
                mov("SIMULACRO_TECNICO", "COMPLETADO", HOY),
                mov("LLAMADA", "HECHA", HOY));

        assertEquals(3, EstadoDeContactoActual.accionesRegistradas(historial));
    }

    @Test
    void unColocadoNoPideAtencionAunqueLleveMesesSinContacto() {
        var colocado = new TarjetaTablero(
                java.util.UUID.randomUUID(), "Ana", "ana@x.com",
                com.novacrm.pipeline.EtapaEmpleabilidad.COLOCADO, 100,
                EstadoContacto.COLOCADO, 3, 5, LocalDate.of(2026, 1, 1), 200, null);

        assertFalse(colocado.necesitaAtencion(), "lleva sin contacto por la mejor razon");
    }

    @Test
    void unEstudianteAlQueNadieLlamoPideAtencionDesdeElPrimerDia() {
        var nadie = new TarjetaTablero(
                java.util.UUID.randomUUID(), "Luis", "luis@x.com",
                com.novacrm.pipeline.EtapaEmpleabilidad.PREPARADO, 60,
                EstadoContacto.SIN_CONTACTO, 0, 0, null, null, null);

        assertTrue(nadie.necesitaAtencion(),
                "listo para postular y sin que nadie le haya hablado es justo lo que hay que ver");
    }
}
