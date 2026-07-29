package com.novacrm.seguimiento;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Deduce en que estado de contacto esta un estudiante a partir de su historial.
 *
 * <p>No hay columna "estado actual" en ninguna tabla, y es deliberado: el estado
 * es el del ultimo movimiento registrado. Guardarlo aparte obliga a mantener dos
 * cosas sincronizadas —la columna y el historial— y en cuanto una escritura
 * falla a medias dejan de coincidir, sin forma de saber cual miente.
 *
 * <p>Arrastrar una tarjeta escribe un {@code Seguimiento} nuevo; el estado sale
 * de leerlos. Asi el historial es la unica fuente y sale gratis.
 *
 * <p>Clase de funciones puras: se prueba sin Spring ni base de datos.
 */
public final class EstadoDeContactoActual {

    private EstadoDeContactoActual() {}

    /**
     * Ordena por fecha y, a igualdad, por cuando se creo. Dos movimientos el
     * mismo dia son normales —se llama y luego se agenda entrevista— y sin el
     * desempate el resultado dependeria del orden que devuelva la base.
     */
    private static final Comparator<Seguimiento> MAS_RECIENTE_PRIMERO =
            Comparator.comparing(Seguimiento::getFecha, Comparator.nullsFirst(Comparator.naturalOrder()))
                    .thenComparing(s -> s.getCreatedAt() == null ? java.time.Instant.EPOCH : s.getCreatedAt())
                    .reversed();

    /**
     * El estado actual segun el historial completo del estudiante.
     *
     * @param historial cualquier seguimiento suyo, en cualquier orden
     * @return el del ultimo movimiento de contacto, o SIN_CONTACTO si no hay
     */
    public static EstadoContacto de(List<Seguimiento> historial) {
        return ultimoMovimiento(historial)
                .flatMap(s -> EstadoContacto.desde(s.getEstado()))
                .orElse(EstadoContacto.INICIAL);
    }

    /** La fecha del ultimo movimiento de contacto, si lo hubo. */
    public static Optional<LocalDate> fechaUltimoContacto(List<Seguimiento> historial) {
        return ultimoMovimiento(historial).map(Seguimiento::getFecha);
    }

    /**
     * Cuantos dias lleva sin noticias. Null si nunca hubo contacto, que no es
     * lo mismo que cero: cero dias es "hoy hablamos".
     */
    public static Integer diasSinContacto(List<Seguimiento> historial, LocalDate hoy) {
        return fechaUltimoContacto(historial)
                .map(f -> (int) java.time.temporal.ChronoUnit.DAYS.between(f, hoy))
                // Una fecha futura (agendado) no es "hace -3 dias".
                .map(d -> Math.max(d, 0))
                .orElse(null);
    }

    /**
     * Solo los movimientos del tablero cuentan para el estado.
     *
     * <p>El historial mezcla llamadas, simulacros y notas sueltas; tomar el
     * ultimo de todos haria que registrar un simulacro moviese la tarjeta de
     * columna sin que nadie lo pidiera.
     */
    private static Optional<Seguimiento> ultimoMovimiento(List<Seguimiento> historial) {
        if (historial == null || historial.isEmpty()) {
            return Optional.empty();
        }
        return historial.stream()
                .filter(s -> EstadoContacto.TIPO.equalsIgnoreCase(s.getTipo()))
                .filter(s -> EstadoContacto.desde(s.getEstado()).isPresent())
                .min(MAS_RECIENTE_PRIMERO);
    }

    /** Cuantas acciones de seguimiento se le han registrado, de cualquier tipo. */
    public static int accionesRegistradas(List<Seguimiento> historial) {
        return historial == null ? 0 : historial.size();
    }
}
