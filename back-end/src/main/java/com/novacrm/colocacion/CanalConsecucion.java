package com.novacrm.colocacion;

/**
 * A que se le atribuye una colocacion.
 *
 * <p>Es la pregunta que hace quien financia el programa: de la gente que se
 * coloco, a cuanta la coloco el programa y cuanta lo consiguio por su cuenta.
 * Sin esta columna las dos cosas se cuentan igual y el impacto reportado es el
 * total de personas que encontraron trabajo, que no es lo mismo.
 *
 * <p>Va enumerado —al contrario que el canal de una postulacion, que es texto
 * libre— porque es una categoria de reporte: tiene que ser estable en el
 * tiempo y comparable entre cohortes. Un portal nuevo no cambia a quien se le
 * atribuye la colocacion.
 */
public enum CanalConsecucion {

    /** Jornada de la empresa organizada por el programa. */
    OPEN_HOUSE("Open House"),

    /** Visita concertada en la sede del CAC. */
    VISITA_CAC("Visita - CAC"),

    /** Feria de empleo. */
    FERIA("Feria de empleo"),

    /** Presentacion del perfil a una empresa aliada por parte del equipo. */
    ALIADO("Empresa aliada"),

    /** Vacante del sistema a la que se postulo con acompanamiento. */
    PORTAL("Portal / vacante del CRM"),

    /** LinkedIn, con el perfil trabajado en el programa. */
    LINKEDIN("LinkedIn"),

    /**
     * Lo consiguio la persona por su cuenta.
     *
     * <p>Se registra igual. Es un resultado del programa —la persona llego
     * preparada— pero no una colocacion gestionada, y mezclarlos infla la
     * cifra que se reporta.
     */
    AUTOGESTIONADO("Autogestionado"),

    OTRO("Otro");

    private final String etiqueta;

    CanalConsecucion(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    public String getEtiqueta() {
        return etiqueta;
    }

    /** Si la colocacion la gestiono el programa. */
    public boolean esGestionadaPorElPrograma() {
        return this != AUTOGESTIONADO && this != OTRO;
    }
}
