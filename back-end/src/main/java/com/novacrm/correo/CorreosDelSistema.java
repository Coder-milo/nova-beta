package com.novacrm.correo;

import com.novacrm.config.MarcaCorreo;
import com.novacrm.config.PlantillaCorreo;

/**
 * Los cuerpos de los correos automáticos, en un solo sitio.
 *
 * <p>Antes cada servicio construía su HTML donde le tocaba: el de activación
 * pasaba por {@link PlantillaCorreo} y salía con la marca del programa, y el de
 * recuperación de contraseña se concatenaba a mano en {@code AuthService} —sin
 * cabecera, sin pie y sin color—, de modo que el mismo usuario recibía dos
 * correos que no parecían del mismo sistema.
 *
 * <p>Tenerlos juntos es además lo que permite previsualizarlos desde el panel
 * sin enviar nada: la pantalla de administración pide el mismo método que usa
 * el envío real, así que lo que se ve es lo que llega. Una previsualización que
 * reconstruye el HTML por su cuenta deja de parecerse al correo de verdad en
 * cuanto alguien toca uno de los dos.
 */
public final class CorreosDelSistema {

    private CorreosDelSistema() {}

    /** Cada correo automático que el sistema puede enviar. */
    public enum Tipo {
        ACTIVACION("Activación de cuenta",
                "Se envía al crear las cuentas de acceso de los estudiantes."),
        RECUPERACION("Recuperación de contraseña",
                "Se envía cuando alguien usa «Olvidé mi contraseña» en la pantalla de acceso."),
        ANUNCIO("Anuncio del programa",
                "Se envía al publicar un anuncio dirigido a los estudiantes.");

        private final String etiqueta;
        private final String cuando;

        Tipo(String etiqueta, String cuando) {
            this.etiqueta = etiqueta;
            this.cuando = cuando;
        }

        public String getEtiqueta() { return etiqueta; }
        public String getCuando() { return cuando; }
    }

    /**
     * Correo de activación.
     *
     * @param enlace URL completa para definir la contraseña
     * @param diasVigencia días que el enlace sigue sirviendo
     */
    public static String activacion(String nombre, String email, String enlace,
                                    int diasVigencia, MarcaCorreo marca) {
        // Con tildes: el correo lo reciben los estudiantes del programa y es la
        // primera cosa que ven del sistema. El HTML se sirve en UTF-8, así que
        // no hay motivo técnico para escribirlo sin acentos.
        String cuerpo = """
                <p style="margin:0 0 14px 0;">
                  Te creamos un acceso al panel del programa. Desde ahí vas a poder
                  consultar tu perfil, tu hoja de vida y las vacantes que se ajustan a ti.
                </p>
                <p style="margin:0 0 4px 0;">
                  Para entrar, primero <strong>define tu contraseña</strong>:
                </p>
                %s
                <p style="margin:0 0 14px 0;font-size:14px;">
                  El enlace es personal y caduca en %d días. Si se te vence, puedes pedir
                  uno nuevo desde <em>&laquo;Olvidé mi contraseña&raquo;</em> en la pantalla de acceso.
                </p>
                %s
                <p style="margin:16px 0 0 0;font-size:14px;">
                  Si tienes problemas para entrar, responde a este correo y te ayudamos.
                </p>
                """.formatted(
                PlantillaCorreo.boton("Crear mi contraseña", enlace, marca.colorPrimario()),
                diasVigencia,
                PlantillaCorreo.recuadroDato("Tu usuario será", email));

        return PlantillaCorreo.construir("Activa tu acceso al panel", "Hola " + nombre + ",", cuerpo, marca);
    }

    /**
     * Correo de recuperación de contraseña.
     *
     * <p>La vigencia se dice en minutos y no en días porque es la de verdad: un
     * enlace de restablecimiento vive media hora. Decir «caduca pronto» hace que
     * la gente lo intente al día siguiente y escriba a soporte.
     */
    public static String recuperacion(String nombre, String enlace, int minutosVigencia, MarcaCorreo marca) {
        String cuerpo = """
                <p style="margin:0 0 14px 0;">
                  Recibimos una solicitud para restablecer tu contraseña. Si fuiste tú,
                  usa este botón para elegir una nueva:
                </p>
                %s
                <p style="margin:0 0 14px 0;font-size:14px;">
                  El enlace caduca en %d minutos y solo se puede usar una vez.
                </p>
                <p style="margin:16px 0 0 0;font-size:14px;">
                  Si no pediste este cambio, ignora este correo: tu contraseña actual
                  sigue funcionando y nadie ha accedido a tu cuenta.
                </p>
                """.formatted(
                PlantillaCorreo.boton("Restablecer mi contraseña", enlace, marca.colorPrimario()),
                minutosVigencia);

        return PlantillaCorreo.construir("Recupera tu contraseña", "Hola " + nombre + ",", cuerpo, marca);
    }

    /**
     * Correo de un anuncio del programa.
     *
     * @param mensajeHtml cuerpo ya saneado por {@code HtmlEnriquecido}
     * @param urlMaterial recurso adjunto o enlace del anuncio; puede ser nulo
     */
    public static String anuncio(String nombre, String titulo, String mensajeHtml,
                                 String urlMaterial, MarcaCorreo marca) {
        var cuerpo = new StringBuilder();
        cuerpo.append("<div style=\"margin:0 0 14px 0;\">").append(mensajeHtml).append("</div>");
        if (urlMaterial != null && !urlMaterial.isBlank()) {
            cuerpo.append(PlantillaCorreo.boton("Ver el material del anuncio", urlMaterial, marca.colorPrimario()));
        }
        cuerpo.append("""
                <p style="margin:16px 0 0 0;font-size:14px;">
                  También puedes consultarlo desde tus notificaciones en el panel.
                </p>
                """);

        return PlantillaCorreo.construir(titulo, "Hola " + nombre + ",", cuerpo.toString(), marca);
    }

    /**
     * Datos de ejemplo para la previsualización del panel.
     *
     * <p>Se usan valores que parecen reales —un nombre con tilde, un enlace con
     * su token— porque el objetivo de mirar el correo antes de mandarlo es ver
     * si algo se desborda o se corta, y con «Lorem ipsum» eso no se aprecia.
     */
    public static String ejemplo(Tipo tipo, MarcaCorreo marca, String urlFrontend) {
        String base = urlFrontend == null || urlFrontend.isBlank() ? "https://nova.ejemplo.com" : urlFrontend;
        return switch (tipo) {
            case ACTIVACION -> activacion("María Fernanda Gómez", "maria.gomez@ejemplo.com",
                    base + "/recuperar-contrasena?token=token-de-ejemplo", 7, marca);
            case RECUPERACION -> recuperacion("María Fernanda Gómez",
                    base + "/recuperar-contrasena?token=token-de-ejemplo", 30, marca);
            case ANUNCIO -> anuncio("María Fernanda Gómez",
                    "Feria de empleo BPO — 12 de agosto",
                    """
                    <p>Se abre la convocatoria para la feria de empleo del sector BPO.</p>
                    <p><strong>Qué necesitas llevar:</strong></p>
                    <ul>
                      <li>Hoja de vida impresa (dos copias)</li>
                      <li>Documento de identidad</li>
                      <li>Certificado de nivel de inglés, si lo tienes</li>
                    </ul>
                    <p>Confirma tu asistencia antes del <em>8 de agosto</em>.</p>
                    """,
                    base + "/mis-notificaciones", marca);
        };
    }
}
