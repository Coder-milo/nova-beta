package com.novacrm.colocacion;

/** Con que figura quedo vinculada la persona. */
public enum TipoVinculacion {

    EMPLEADO("Empleado"),
    PRACTICANTE("Practicante"),
    APRENDIZ("Aprendiz SENA"),
    CONTRATISTA("Prestacion de servicios"),
    /** Vinculado a una formacion, no a un empleo. Cuenta aparte. */
    FORMACION("Vinculado a formacion");

    private final String etiqueta;

    TipoVinculacion(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    public String getEtiqueta() {
        return etiqueta;
    }

    /**
     * Si cuenta como colocacion laboral.
     *
     * <p>{@link #FORMACION} no: la hoja de seguimiento lo lleva en una casilla
     * distinta del tablero por lo mismo. Sumarlo al total de empleados infla el
     * indicador con gente que sigue estudiando.
     */
    public boolean esEmpleo() {
        return this != FORMACION;
    }
}
