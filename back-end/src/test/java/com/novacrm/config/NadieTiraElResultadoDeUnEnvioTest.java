package com.novacrm.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Nadie puede llamar a un envio y tirar lo que devuelve.
 *
 * <p>El mismo fallo aparecio tres veces en dias seguidos y siempre con la misma
 * forma: algo devuelve "no pude" y nadie lo lee. El enlace de recuperacion que
 * no se registraba porque solo se miraba la excepcion —y el proveedor nulo no
 * lanza, devuelve un fallo tranquilo—; las siete respuestas del webhook de
 * WhatsApp que se mandaban sin mirar si salieron. En los dos casos el sistema
 * daba por hecho algo que no habia pasado, y nadie se enteraba hasta que se
 * quejaba la persona del otro lado.
 *
 * <p>Esto es la regla de compilacion que haria un plugin como ErrorProne,
 * escrita como prueba para no meter una dependencia nueva en el build por una
 * sola regla. Lee el codigo fuente y falla si encuentra una llamada de envio
 * usada como sentencia suelta, sin asignar ni devolver.
 *
 * <p>Si algun dia hay una llamada que de verdad no necesita el resultado, la
 * forma de decirlo es asignarlo y explicarlo, no borrarlo de esta lista.
 */
class NadieTiraElResultadoDeUnEnvioTest {

    private static final Path RAIZ = Path.of("src", "main", "java");

    /**
     * Los metodos que devuelven un {@code Resultado} de envio.
     *
     * <p>Se buscan por nombre y no por tipo: aqui no hay compilador, solo el
     * texto del fuente. Es suficiente porque estos nombres no se repiten para
     * otra cosa en el proyecto.
     */
    private static final Pattern LLAMADA_DE_ENVIO = Pattern.compile(
            "(?<antes>^|[;{}])\\s*(?<llamada>\\w*(?:[eE]mailService|[wW]hatsappSender|proveedorCorreo"
                    + "|proveedorWhatsapp)\\.(?:enviar|enviarTexto|enviarPlantilla)\\s*\\()");

    @Test
    void ningunEnvioSeUsaComoSentenciaSuelta() throws IOException {
        List<String> sospechosos = new ArrayList<>();

        try (Stream<Path> ficheros = Files.walk(RAIZ)) {
            for (Path fichero : ficheros.filter(f -> f.toString().endsWith(".java")).toList()) {
                String fuente = Files.readString(fichero, StandardCharsets.UTF_8);
                Matcher m = LLAMADA_DE_ENVIO.matcher(enmascarar(fuente));
                while (m.find()) {
                    // Desde el grupo de la llamada y no desde el principio del
                    // match: el patron se traga el «;» de la sentencia anterior,
                    // que suele estar en la linea de arriba, y el aviso apuntaba
                    // una linea antes de la que hay que mirar.
                    int linea = 1 + (int) fuente.substring(0, m.start("llamada"))
                            .chars().filter(c -> c == '\n').count();
                    sospechosos.add(RAIZ.relativize(fichero) + ":" + linea
                            + "  " + m.group("llamada").trim());
                }
            }
        }

        assertTrue(sospechosos.isEmpty(), """
                Hay envios cuyo resultado se descarta. Un envio puede fallar por causas \
                normales —sin canal de correo configurado, token de WhatsApp caducado, \
                ventana de 24 horas cerrada— y si nadie mira lo que devuelve, el sistema \
                da por hecho algo que no paso. Asignalo y decide que hacer cuando \
                `enviado()` sea false:
                """ + String.join("\n", sospechosos));
    }

    /**
     * Tapa comentarios y textos entre comillas, sin mover nada de sitio.
     *
     * <p>Hace falta taparlos porque un ejemplo dentro de un javadoc o el nombre
     * de un metodo citado en un mensaje contarian como codigo, y la prueba
     * empezaria a fallar por lo que alguien escribio en una explicacion.
     *
     * <p>Se sustituye por espacios en vez de borrar, conservando los saltos de
     * linea: borrando, las posiciones dejan de corresponder con el fuente y el
     * numero de linea que sale en el fallo apunta a otra parte. Un aviso que
     * señala mal es peor que uno escueto, porque manda a mirar donde no es.
     */
    private static String enmascarar(String fuente) {
        StringBuilder salida = new StringBuilder(fuente);
        tapar(salida, Pattern.compile("(?s)/\\*.*?\\*/"));
        tapar(salida, Pattern.compile("(?m)//[^\\n]*"));
        // Sin alternancia dentro de la repeticion: la version que contemplaba
        // comillas escapadas desbordaba la pila por retroceso en los ficheros
        // largos. Un literal con comillas escapadas se corta antes de tiempo y
        // deja texto suelto, inofensivo: para estorbar tendria que contener una
        // llamada de envio al principio de una sentencia.
        tapar(salida, Pattern.compile("\"[^\"\\n]*\""));
        return salida.toString();
    }

    /** Cambia por espacios lo que encaje, dejando los saltos de linea. */
    private static void tapar(StringBuilder texto, Pattern patron) {
        Matcher m = patron.matcher(texto);
        while (m.find()) {
            for (int i = m.start(); i < m.end(); i++) {
                if (texto.charAt(i) != '\n') {
                    texto.setCharAt(i, ' ');
                }
            }
        }
    }
}
