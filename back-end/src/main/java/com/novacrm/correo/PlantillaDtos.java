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
    public record VariableDisponible(String clave, String marca, String descripcion, String ejemplo) {
        public static VariableDisponible de(Variables v) {
            return new VariableDisponible(v.clave(), v.marca(), v.descripcion(), v.ejemplo());
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
            /** Ids concretos; vacio = todos los estudiantes activos. */
            List<UUID> estudianteIds,
            Boolean simulacion) {}

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
