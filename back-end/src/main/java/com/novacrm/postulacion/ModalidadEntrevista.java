package com.novacrm.postulacion;

import java.util.Optional;

/**
 * Como se hace la entrevista.
 *
 * <p>Determina que dato acompaña a la cita y hace falta para presentarse: una
 * presencial necesita direccion, una virtual necesita enlace y una telefonica
 * no necesita ninguna de las dos. Sin esto, el equipo escribia el sitio o el
 * enlace dentro de las observaciones y no habia forma de recordarselo al
 * estudiante ni de listar las citas de la semana con su ubicacion.
 */
public enum ModalidadEntrevista {

    PRESENCIAL("Presencial"),
    VIRTUAL("Virtual"),
    TELEFONICA("Telefonica");

    private final String etiqueta;

    ModalidadEntrevista(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    public String getEtiqueta() {
        return etiqueta;
    }

    /** Necesita un sitio al que ir o al que conectarse. */
    public boolean requiereLugar() {
        return this != TELEFONICA;
    }

    public static Optional<ModalidadEntrevista> desde(String texto) {
        if (texto == null || texto.isBlank()) {
            return Optional.empty();
        }
        String limpio = texto.trim().toUpperCase();
        for (ModalidadEntrevista m : values()) {
            if (m.name().equals(limpio)) {
                return Optional.of(m);
            }
        }
        // La hoja de seguimiento escribia estas dos variantes.
        if ("REMOTA".equals(limpio) || "ONLINE".equals(limpio)) {
            return Optional.of(VIRTUAL);
        }
        return Optional.empty();
    }
}
