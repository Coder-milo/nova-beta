package com.novacrm.whatsapp;

/**
 * El canal de WhatsApp visto desde el portal del estudiante.
 *
 * <p>Existe aparte de {@link WhatsappResponse} porque no son la misma pregunta.
 * La pantalla del estudiante solo necesita saber si hay un numero al que
 * escribir y cual es; la de administracion configura la integracion y necesita
 * ademas el identificador de telefono de Meta y si hay token guardado.
 *
 * <p>Antes {@code /whatsapp/mio} devolvia la ficha entera de configuracion. El
 * {@code phoneId} no es una credencial por si solo —hace falta el token para
 * usarlo— pero es la otra mitad de lo que se necesita para enviar mensajes en
 * nombre de la institucion, y no pinta nada en el navegador de un participante.
 * Es el mismo caso que la configuracion global: una respuesta pensada para la
 * pantalla de gestion, reutilizada tal cual para la del estudiante.
 */
public record CanalDeSoporteResponse(
        /** false = el programa no tiene canal de WhatsApp. */
        boolean configurado,
        boolean activo,
        String numeroWhatsapp) {

    static CanalDeSoporteResponse de(WhatsappResponse completa) {
        return new CanalDeSoporteResponse(
                completa.configurado(), completa.activo(), completa.numeroWhatsapp());
    }
}
