package com.novacrm.seguimiento;

import com.novacrm.pipeline.EtapaEmpleabilidad;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Una tarjeta del tablero de seguimiento.
 *
 * <p>Lleva los dos ejes juntos a proposito, porque el valor del tablero esta en
 * verlos a la vez: {@code etapa} es lo que el sistema deduce del estudiante y
 * {@code estadoContacto} es lo que el equipo ha hecho con el. Un
 * {@code PREPARADO} en {@code SIN_CONTACTO} es alguien listo al que nadie ha
 * llamado; un {@code SIN_PERFIL} en {@code ENTREVISTA} es una entrevista sin
 * hoja de vida detras. Las dos cosas hay que verlas de un vistazo.
 *
 * @param diasSinContacto dias desde el ultimo movimiento; null si nunca hubo
 */
public record TarjetaTablero(
        UUID estudianteId,
        String nombre,
        String email,
        EtapaEmpleabilidad etapa,
        int porcentajeAvance,
        EstadoContacto estadoContacto,
        int postulaciones,
        int accionesSeguimiento,
        LocalDate ultimoContacto,
        Integer diasSinContacto,
        String proximaAccion) {

    /**
     * A partir de cuantos dias sin noticias conviene mirar una tarjeta.
     *
     * <p>Dos semanas: menos genera ruido con quien esta en conversacion normal,
     * y mas deja enfriar procesos que se pierden por silencio.
     */
    public static final int DIAS_PARA_ALERTAR = 14;

    /**
     * Si la tarjeta pide atencion. No aplica a los estados finales: un
     * estudiante colocado lleva sin contacto por la mejor de las razones.
     */
    public boolean necesitaAtencion() {
        if (estadoContacto.esFinal()) {
            return false;
        }
        return diasSinContacto == null || diasSinContacto >= DIAS_PARA_ALERTAR;
    }
}
