package com.novacrm.auth;

public enum Rol {
    ADMIN,
    COORDINADOR,
    ESTUDIANTE,

    /**
     * Alguien de una empresa aliada, entrando desde fuera de la institucion.
     *
     * <p>Es el primer rol que <strong>no</strong> pertenece al programa, y eso
     * cambia como hay que pensar los permisos. Con ADMIN, COORDINADOR y
     * ESTUDIANTE bastaba preguntar "que puede hacer": todos son de casa y el
     * peor caso es que alguien vea de mas dentro de su propia institucion. Una
     * empresa es un tercero, asi que la pregunta pasa a ser "que puede ver", y
     * la respuesta por defecto tiene que ser nada.
     *
     * <p>Lo que ve una empresa se limita a: sus propias vacantes, quien se
     * postulo a ellas, y de cada postulante <em>solo el perfil laboral</em>
     * —hoja de vida, habilidades, programa formativo, disponibilidad—. Nunca el
     * censo de estudiantes, nunca el documento de identidad, la direccion, las
     * notas internas del equipo ni nada del expediente que no sea laboral.
     *
     * <p>El vinculo con su empresa vive en {@code Usuario.empresa}: sin el, una
     * cuenta con este rol no alcanza ningun dato, que es el fallo seguro.
     */
    EMPRESA
}
