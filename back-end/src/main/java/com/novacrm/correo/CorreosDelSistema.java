package com.novacrm.correo;

import com.novacrm.config.MarcaCorreo;
import com.novacrm.config.PlantillaCorreo;

import java.util.List;

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
        CITA_ENTREVISTA("Cita de entrevista agendada",
                "Se envía cuando se programa una entrevista con una empresa aliada."),
        ENTREVISTA("Cita de entrevista agendada",
                "Se envía cuando se programa una entrevista con una empresa aliada."),
        ASIGNACION_VACANTE("Asignación a vacante",
                "Se envía cuando un estudiante es postulado o asignado a una oportunidad laboral."),
        POSTULACION("Asignación a vacante",
                "Se envía cuando un estudiante es postulado o asignado a una oportunidad laboral."),
        ANUNCIO("Anuncio del programa",
                "Se envía al publicar un anuncio dirigido a los estudiantes."),
        RECORDATORIO_HV("Recordatorio de hoja de vida",
                "Se envía para recordar a los estudiantes completar o actualizar su hoja de vida.");

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
     * Correo de cita de entrevista laboral agendada.
     */
    public static String citaEntrevista(String nombre, String empresa, String cargo,
                                        String fecha, String modalidad, String lugar,
                                        String enlace, MarcaCorreo marca) {
        String cuerpo = """
                <p style="margin:0 0 14px 0;">
                  Has sido programado para una entrevista laboral en <strong>%s</strong> para la vacante de <strong>%s</strong>.
                </p>
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                       style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px;margin:16px 0;">
                  <tr>
                    <td>
                      <p style="margin:0 0 8px 0;font-size:14px;color:#1F2A44;"><strong>Fecha y hora:</strong> %s</p>
                      <p style="margin:0 0 8px 0;font-size:14px;color:#1F2A44;"><strong>Modalidad:</strong> %s</p>
                      <p style="margin:0;font-size:14px;color:#1F2A44;"><strong>Lugar / Enlace:</strong> %s</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 4px 0;">
                  Por favor confirma tu asistencia y preséntate puntualmente:
                </p>
                %s
                <p style="margin:16px 0 0 0;font-size:14px;color:#6B7280;">
                  Si tienes algún inconveniente de fuerza mayor, notifícalo a tu coordinador con anticipación.
                </p>
                """.formatted(
                escapar(empresa),
                escapar(cargo),
                escapar(fecha),
                escapar(modalidad),
                escapar(lugar),
                enlace != null && !enlace.isBlank()
                        ? PlantillaCorreo.boton("Ver detalles de la entrevista", enlace, marca.colorPrimario())
                        : "");

        return PlantillaCorreo.construir("Cita de entrevista agendada", "Hola " + nombre + ",", cuerpo, marca);
    }

    /**
     * Correo de asignación o postulación a vacante.
     */
    public static String asignacionVacante(String nombre, String empresa, String cargo,
                                          String programa, String enlace, MarcaCorreo marca) {
        String cuerpo = """
                <p style="margin:0 0 14px 0;">
                  ¡Buenas noticias! Tu perfil ha sido postulado a la vacante de <strong>%s</strong> en <strong>%s</strong> como parte de tu proceso en <strong>%s</strong>.
                </p>
                %s
                <p style="margin:0 0 4px 0;">
                  Puedes consultar el estado y los requisitos de la vacante en el siguiente enlace:
                </p>
                %s
                <p style="margin:16px 0 0 0;font-size:14px;color:#6B7280;">
                  El equipo de selección estará revisando tu postulación. Mantén tu información y disponibilidad actualizadas.
                </p>
                """.formatted(
                escapar(cargo),
                escapar(empresa),
                escapar(programa),
                PlantillaCorreo.recuadroDato("Vacante asignada", cargo + " · " + empresa),
                enlace != null && !enlace.isBlank()
                        ? PlantillaCorreo.boton("Consultar vacante", enlace, marca.colorPrimario())
                        : "");

        return PlantillaCorreo.construir("Asignación a vacante", "Hola " + nombre + ",", cuerpo, marca);
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
     * Correo de recordatorio para completar la hoja de vida.
     */
    public static String recordatorioHv(String nombre, String programa, String enlace, MarcaCorreo marca) {
        String cuerpo = """
                <p style="margin:0 0 14px 0;">
                  Queremos recordarte que tu hoja de vida aún no está completa en el panel de <strong>%s</strong>.
                </p>
                <p style="margin:0 0 14px 0;">
                  Para que las empresas aliadas puedan revisar tu perfil y podamos postularte a las vacantes disponibles, es indispensable completar todos tus datos de formación y experiencia.
                </p>
                %s
                <p style="margin:16px 0 0 0;font-size:14px;color:#6B7280;">
                  Solo te tomará unos minutos. ¡Haz que tu perfil destaque!
                </p>
                """.formatted(
                escapar(programa),
                enlace != null && !enlace.isBlank()
                        ? PlantillaCorreo.boton("Actualizar mi hoja de vida", enlace, marca.colorPrimario())
                        : "");

        return PlantillaCorreo.construir("Completa tu hoja de vida", "Hola " + nombre + ",", cuerpo, marca);
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
            case CITA_ENTREVISTA, ENTREVISTA -> citaEntrevista("María Fernanda Gómez",
                    "Konecta", "Bilingual Customer Support",
                    "15 de Septiembre, 10:00 AM", "Virtual (Microsoft Teams)",
                    "https://teams.microsoft.com/l/meetup-join/ejemplo",
                    base + "/mis-entrevistas", marca);
            case ASIGNACION_VACANTE, POSTULACION -> asignacionVacante("María Fernanda Gómez",
                    "Konecta", "Bilingual Customer Support", "Ruta BPO Bilingüe",
                    base + "/mis-postulaciones", marca);
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
            case RECORDATORIO_HV -> recordatorioHv("María Fernanda Gómez",
                    "Ruta BPO Bilingüe",
                    base + "/mi-hoja-de-vida", marca);
        };
    }

    /**
     * Plantilla de correo por defecto de fábrica para un tipo de correo del sistema.
     */
    public static PlantillaDtos.PlantillaDefecto plantillaPorDefecto(Tipo tipo) {
        if (tipo == null) {
            tipo = Tipo.ACTIVACION;
        }
        return switch (tipo) {
            case ACTIVACION -> new PlantillaDtos.PlantillaDefecto(
                    "ACTIVACION",
                    "Activación de cuenta",
                    "Plantilla predeterminada enviada al crear el usuario del estudiante.",
                    "Activa tu acceso al panel de {{programa}}",
                    """
                    <p style="margin:0 0 14px 0;">
                      Te creamos un acceso al panel del programa. Desde ahí vas a poder
                      consultar tu perfil, tu hoja de vida y las vacantes que se ajustan a ti.
                    </p>
                    <p style="margin:0 0 4px 0;">
                      Para entrar, primero <strong>define tu contraseña</strong> pulsando el siguiente botón:
                    </p>
                    """,
                    "Crear mi contraseña",
                    "{{link}}");
            case RECUPERACION -> new PlantillaDtos.PlantillaDefecto(
                    "RECUPERACION",
                    "Recuperación de contraseña",
                    "Plantilla predeterminada enviada cuando un usuario solicita restablecer su contraseña.",
                    "Recupera tu contraseña de acceso",
                    """
                    <p style="margin:0 0 14px 0;">
                      Recibimos una solicitud para restablecer tu contraseña. Si fuiste tú,
                      usa el botón a continuación para elegir una nueva:
                    </p>
                    <p style="margin:0 0 14px 0;font-size:14px;color:#6B7280;">
                      El enlace caduca en 30 minutos y solo se puede usar una vez.
                    </p>
                    <p style="margin:16px 0 0 0;font-size:14px;color:#6B7280;">
                      Si no pediste este cambio, ignora este correo: tu contraseña actual
                      sigue funcionando y nadie ha accedido a tu cuenta.
                    </p>
                    """,
                    "Restablecer mi contraseña",
                    "{{link}}");
            case CITA_ENTREVISTA, ENTREVISTA -> new PlantillaDtos.PlantillaDefecto(
                    "CITA_ENTREVISTA",
                    "Cita de entrevista agendada",
                    "Plantilla predeterminada enviada al agendar una entrevista laboral.",
                    "Cita de entrevista: {{cargo}} en {{empresa}}",
                    """
                    <p style="margin:0 0 14px 0;">
                      Has sido seleccionado para una entrevista laboral para el cargo de
                      <strong>{{cargo}}</strong> en <strong>{{empresa}}</strong>.
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                           style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px;margin:16px 0;">
                      <tr>
                        <td>
                          <p style="margin:0 0 8px 0;font-size:14px;color:#1F2A44;"><strong>Fecha y hora:</strong> {{fecha_entrevista}}</p>
                          <p style="margin:0 0 8px 0;font-size:14px;color:#1F2A44;"><strong>Modalidad:</strong> {{modalidad_entrevista}}</p>
                          <p style="margin:0;font-size:14px;color:#1F2A44;"><strong>Lugar / Enlace:</strong> {{lugar_entrevista}}</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 4px 0;">
                      Por favor confirma tu asistencia y preséntate puntualmente.
                    </p>
                    """,
                    "Ver detalles de la entrevista",
                    "{{enlace_boton}}");
            case ASIGNACION_VACANTE, POSTULACION -> new PlantillaDtos.PlantillaDefecto(
                    "ASIGNACION_VACANTE",
                    "Asignación a vacante",
                    "Plantilla predeterminada enviada cuando se postula al estudiante a una vacante.",
                    "Nueva postulación: {{cargo}} en {{empresa}}",
                    """
                    <p style="margin:0 0 14px 0;">
                      ¡Buenas noticias! Tu perfil ha sido postulado a la vacante de
                      <strong>{{cargo}}</strong> en la empresa <strong>{{empresa}}</strong>
                      como parte de tu proceso en <strong>{{programa}}</strong>.
                    </p>
                    <p style="margin:0 0 4px 0;">
                      El equipo de selección estará revisando tu postulación. Mantén tu
                      información y disponibilidad actualizadas en el panel.
                    </p>
                    """,
                    "Consultar vacante",
                    "{{enlace_boton}}");
            case ANUNCIO -> new PlantillaDtos.PlantillaDefecto(
                    "ANUNCIO",
                    "Anuncio del programa",
                    "Plantilla predeterminada para comunicados y convocatorias generales.",
                    "Comunicado importante de {{programa}}",
                    """
                    <p style="margin:0 0 14px 0;">
                      Queremos compartirte información relevante sobre las actividades y
                      oportunidades en el marco de tu proceso de formación e inserción laboral.
                    </p>
                    <p style="margin:0 0 4px 0;">
                      Revisa los detalles ingresando a tu panel de notificaciones.
                    </p>
                    """,
                    "Ver comunicado",
                    "{{enlace_boton}}");
            case RECORDATORIO_HV -> new PlantillaDtos.PlantillaDefecto(
                    "RECORDATORIO_HV",
                    "Recordatorio de hoja de vida",
                    "Plantilla predeterminada para recordar a los estudiantes completar su hoja de vida.",
                    "Completa tu hoja de vida para aplicar a vacantes",
                    """
                    <p style="margin:0 0 14px 0;">
                      Notamos que tu hoja de vida aún no está completa en el panel de <strong>{{programa}}</strong>.
                    </p>
                    <p style="margin:0 0 14px 0;">
                      Para poder postularte a las oportunidades laborales de nuestras empresas aliadas,
                      es fundamental que registres tu formación, experiencia y nivel de inglés.
                    </p>
                    <p style="margin:0 0 4px 0;">
                      ¡Solo te tomará unos minutos!
                    </p>
                    """,
                    "Actualizar mi hoja de vida",
                    "{{enlace_boton}}");
        };
    }

    /**
     * Lista todas las plantillas predeterminadas de fábrica del sistema.
     */
    public static List<PlantillaDtos.PlantillaDefecto> plantillasPorDefecto() {
        return List.of(
                plantillaPorDefecto(Tipo.ACTIVACION),
                plantillaPorDefecto(Tipo.RECUPERACION),
                plantillaPorDefecto(Tipo.CITA_ENTREVISTA),
                plantillaPorDefecto(Tipo.ASIGNACION_VACANTE),
                plantillaPorDefecto(Tipo.ANUNCIO),
                plantillaPorDefecto(Tipo.RECORDATORIO_HV));
    }

    private static String escapar(String valor) {
        if (valor == null) return "";
        return valor.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
