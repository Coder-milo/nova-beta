package com.novacrm.pipeline;

/**
 * Etapas del embudo de empleabilidad, en orden.
 *
 * <p>La etapa no se captura a mano: se deduce de lo que ya ocurrio en el
 * sistema (hoja de vida generada, simulacro registrado, postulaciones
 * enviadas). Es la razon por la que las columnas equivalentes de la hoja de
 * calculo llevaban meses vacias: nadie mantiene a mano un dato que el sistema
 * puede calcular.
 */
public enum EtapaEmpleabilidad {

    /** Sin hoja de vida: todavia no hay nada que presentar a una empresa. */
    SIN_PERFIL("Sin perfil", "Generar la hoja de vida del estudiante"),

    /** Ya tiene HV vigente, pero le falta preparacion antes de postular. */
    PERFIL_LISTO("Perfil listo", "Optimizar LinkedIn y agendar el simulacro de entrevista"),

    /** HV + LinkedIn + simulacro: listo para postular, pero aun sin postulaciones. */
    PREPARADO("Preparado", "Revisar vacantes sugeridas y enviar las primeras postulaciones"),

    /** Con postulaciones enviadas y en seguimiento. */
    POSTULANDO("Postulando", "Hacer seguimiento a las postulaciones enviadas"),

    /** Colocado laboralmente: fin del embudo. */
    COLOCADO("Colocado", "Registrar el cierre y programar seguimiento post-colocacion");

    private final String etiqueta;
    private final String proximaAccion;

    EtapaEmpleabilidad(String etiqueta, String proximaAccion) {
        this.etiqueta = etiqueta;
        this.proximaAccion = proximaAccion;
    }

    public String getEtiqueta() {
        return etiqueta;
    }

    /** Que corresponde hacer ahora con este estudiante. */
    public String getProximaAccion() {
        return proximaAccion;
    }
}
