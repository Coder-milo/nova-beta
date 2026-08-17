package com.novacrm.configuracion;

/**
 * Lo que la pantalla manda al guardar. Va entero: es un formulario unico y
 * mandar solo lo cambiado obligaria a distinguir "no lo toque" de "lo borre",
 * que con campos opcionales es justo lo que se confunde.
 */
public record ConfiguracionRequest(
        String nombreOficial,
        String nit,
        String registroEducativo,
        String sedePrincipal,
        String telefonoContacto,
        String whatsappSoporte,
        String emailContacto,
        String emailSoporte,
        String sitioWeb,
        String linkedinUrl,
        String instagramUrl,

        String cohorteActiva,
        Integer umbralMatchMinimo,
        String reglaAsignacion,
        Integer diasRetencionPapelera) {

    /**
     * Sin regla de asignacion: queda apagada.
     *
     * <p>Existe para no reescribir las llamadas que ya habia. Un cuerpo que no
     * menciona la regla no puede significar "enciendela", asi que el valor
     * omitido es el mismo que trae la columna por defecto.
     */
    public ConfiguracionRequest(String nombreOficial, String nit, String registroEducativo,
                                String sedePrincipal, String telefonoContacto, String whatsappSoporte,
                                String emailContacto, String emailSoporte, String sitioWeb,
                                String linkedinUrl, String instagramUrl, String cohorteActiva,
                                Integer umbralMatchMinimo, Integer diasRetencionPapelera) {
        this(nombreOficial, nit, registroEducativo, sedePrincipal, telefonoContacto,
                whatsappSoporte, emailContacto, emailSoporte, sitioWeb, linkedinUrl,
                instagramUrl, cohorteActiva, umbralMatchMinimo, "NINGUNA", diasRetencionPapelera);
    }
}
