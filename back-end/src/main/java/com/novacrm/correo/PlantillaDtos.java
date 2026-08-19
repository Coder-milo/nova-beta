package com.novacrm.correo;

import java.util.List;
import java.util.UUID;

/** Lo que entra y sale del modulo de plantillas. */
public final class PlantillaDtos {

    private PlantillaDtos() {}

    /** Lo que escribe el coordinador en el editor. */
    public record Guardar(
            UUID programaId,
            String nombre,
            String descripcion,
            String asunto,
            String cuerpo,
            String botonTexto,
            String botonUrl,
            String rolMinimo,
            Boolean activa) {}

    public record Respuesta(
            UUID id,
            UUID programaId,
            String nombre,
            String descripcion,
            String asunto,
            String cuerpo,
            String botonTexto,
            String botonUrl,
            String rolMinimo,
            boolean activa,
            /** Las variables que usa. La pantalla avisa si pide una que no habra. */
            List<String> variablesUsadas) {

        public static Respuesta de(PlantillaGuardada p) {
            return new Respuesta(
                    p.getId(), p.getProgramaId(), p.getNombre(), p.getDescripcion(),
                    p.getAsunto(), p.getCuerpo(), p.getBotonTexto(), p.getBotonUrl(),
                    p.getRolMinimo(), p.isActiva(),
                    Variables.usadasEn(p.getAsunto() + " " + p.getCuerpo()).stream()
                            .map(Variables::clave).toList());
        }
    }

    /** Una variable, para la ayuda del editor. */
    public record VariableDisponible(String clave, String marca, String descripcion, String ejemplo, String categoria) {
        public static VariableDisponible de(Variables v) {
            return new VariableDisponible(v.clave(), v.marca(), v.descripcion(), v.ejemplo(), v.categoria());
        }
    }

    /** Plantilla del sistema con valores predeterminados de fábrica. */
    public record PlantillaDefecto(
            String tipo,
            String nombre,
            String descripcion,
            String asunto,
            String cuerpo,
            String botonTexto,
            String botonUrl) {}

    /** Solicitud para enviar un correo de prueba directo. */
    public record EnviarPruebaRequest(
            String destinatario,
            String asunto,
            String cuerpo,
            String botonTexto,
            String botonUrl,
            UUID programaId,
            String textoCabecera,
            java.util.Map<String, String> variablesSimuladas) {

        public EnviarPruebaRequest(String destinatario, String asunto, String cuerpo,
                                   String botonTexto, String botonUrl, UUID programaId,
                                   java.util.Map<String, String> variablesSimuladas) {
            this(destinatario, asunto, cuerpo, botonTexto, botonUrl, programaId, null, variablesSimuladas);
        }

        public String emailDestino() {
            return destinatario == null ? "" : destinatario.trim();
        }
    }

    /**
     * Previsualizacion: el correo montado con valores de ejemplo.
     *
     * @param html          el mensaje entero, listo para meter en un iframe
     * @param textoPlano    la version que reciben los clientes sin HTML
     * @param avisos        cosas que conviene saber antes de enviar
     */
    public record Previsualizacion(
            String asunto,
            String html,
            String textoPlano,
            List<String> avisos) {}

    /** Lo que se pide al enviar. */
    public record EnviarRequest(
            /** Ids concretos; vacio = todos los estudiantes activos o segun programa/cohorte. */
            List<UUID> estudianteIds,
            UUID programaId,
            String cohorte,
            Boolean simulacion) {

        public EnviarRequest(List<UUID> estudianteIds, Boolean simulacion) {
            this(estudianteIds, null, null, simulacion);
        }
    }

    public record ResultadoEnvio(
            UUID estudianteId,
            String nombre,
            String email,
            boolean enviado,
            String detalle) {}

    public record ResumenEnvio(
            int destinatarios,
            int enviados,
            int bloqueadosPorLista,
            int fallidos,
            int sinCorreo,
            boolean simulacion,
            String canalDeCorreo,
            List<String> destinatariosPermitidos,
            List<ResultadoEnvio> detalle) {}
}
