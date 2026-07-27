package com.novacrm.vacante;

/**
 * Por que dejo de mostrarse una vacante.
 *
 * <p>Se guarda el motivo y no solo {@code activo = false} porque la diferencia
 * importa: una plaza cubierta significa que el proceso llego a su fin, y una
 * vencida que se dejo pasar la oportunidad. Sin distinguirlas no se puede
 * medir si el programa esta llegando tarde a las ofertas.
 */
public enum MotivoCierre {

    /** Paso su fecha de expiracion. */
    EXPIRADA("Expirada"),

    /** La empresa ya encontro a la persona. */
    CUBIERTA("Ya cubierta"),

    /** La retiro el portal de origen o el coordinador. */
    RETIRADA("Retirada");

    private final String etiqueta;

    MotivoCierre(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    public String getEtiqueta() {
        return etiqueta;
    }
}
