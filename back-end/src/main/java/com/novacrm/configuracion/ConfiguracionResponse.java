package com.novacrm.configuracion;

import java.time.Instant;

/**
 * La configuracion de la instalacion tal y como la consume la pantalla.
 *
 * <p>Lleva {@code guardado} explicito para que la interfaz pueda distinguir
 * "esto lo escribio alguien" de "esto es lo que trae de fabrica". Deducirlo de
 * un campo vacio no vale: alguien puede haber borrado el Instagram a proposito.
 *
 * <p>Lleva tambien los dos valores por defecto para poder decir de donde sale
 * el numero cuando nadie lo ha tocado. Es la diferencia entre "el corte esta en
 * 55" y "el corte esta en 55 porque lo dice matching-config.yml": lo segundo se
 * puede ir a cambiar, lo primero no.
 */
public record ConfiguracionResponse(
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
        Integer diasRetencionPapelera,

        boolean guardado,
        Instant actualizadoEn,
        int umbralPorDefecto,
        int diasRetencionPorDefecto) {

    static ConfiguracionResponse de(ConfiguracionGlobal c, int umbralPorDefecto, int diasPorDefecto) {
        return new ConfiguracionResponse(
                c.getNombreOficial(), c.getNit(), c.getRegistroEducativo(), c.getSedePrincipal(),
                c.getTelefonoContacto(), c.getWhatsappSoporte(), c.getEmailContacto(),
                c.getEmailSoporte(), c.getSitioWeb(), c.getLinkedinUrl(), c.getInstagramUrl(),
                c.getCohorteActiva(),
                c.getUmbralMatchMinimo() != null ? c.getUmbralMatchMinimo() : umbralPorDefecto,
                c.getReglaAsignacion() == null ? "NINGUNA" : c.getReglaAsignacion(),
                c.getDiasRetencionPapelera() != null ? c.getDiasRetencionPapelera() : diasPorDefecto,
                true, c.getUpdatedAt(), umbralPorDefecto, diasPorDefecto);
    }

    /**
     * Lo que se responde cuando no hay fila. Los campos de texto van vacios a
     * proposito: la pantalla traia un NIT y una resolucion de ejemplo escritos
     * a mano, y sembrarlos aqui los convertiria en datos de la institucion sin
     * que nadie los hubiera escrito nunca.
     */
    static ConfiguracionResponse porDefecto(int umbralPorDefecto, int diasPorDefecto) {
        return new ConfiguracionResponse(
                null, null, null, null, null, null, null, null, null, null, null,
                null, umbralPorDefecto, "NINGUNA", diasPorDefecto,
                false, null, umbralPorDefecto, diasPorDefecto);
    }
}
