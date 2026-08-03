package com.novacrm.configuracion;

import java.util.List;

/**
 * Estado real de una integracion externa.
 *
 * <p><strong>Nunca lleva secretos, ni siquiera enmascarados.</strong> Solo dice
 * si la credencial esta puesta y donde se pone. La pantalla de configuracion
 * ofrecia campos para escribir la clave de Groq, el token de WhatsApp y la de
 * JSearch, y las guardaba en {@code localStorage}: texto plano legible por
 * cualquier script inyectado, que es el mismo fallo que se corrigio para el JWT
 * (FE-12). Ademas no servia de nada, porque el backend lee esas credenciales de
 * variables de entorno al arrancar y nada de lo que se escribiera ahi llegaba
 * al servidor.
 *
 * <p>Asi que la pantalla deja de ser un formulario y pasa a ser un tablero: se
 * ve que hay conectado, con que cuota y donde tocarlo.
 *
 * @param id             identificador estable, para la ruta de prueba
 * @param nombre         como se llama para quien lo lee
 * @param categoria      para agrupar en la pantalla
 * @param configurada    si tiene lo que necesita para funcionar
 * @param resumen        que hace, o que le falta, en una frase
 * @param detalles       datos no sensibles: proveedor, modelo, bucket, region
 * @param variablesEntorno nombres de las variables que la configuran
 * @param probable       si admite una prueba de conexion en vivo
 * @param advertencia    riesgo a tener en cuenta; nulo si no lo hay
 */
public record EstadoIntegracion(
        String id,
        String nombre,
        String categoria,
        boolean configurada,
        String resumen,
        List<Detalle> detalles,
        List<String> variablesEntorno,
        boolean probable,
        String advertencia) {

    /** Un dato que se puede enseñar sin comprometer nada. */
    public record Detalle(String etiqueta, String valor) {}

    /** Resultado de una prueba de conexion en vivo. */
    public record ResultadoPrueba(boolean exito, String mensaje) {}
}
