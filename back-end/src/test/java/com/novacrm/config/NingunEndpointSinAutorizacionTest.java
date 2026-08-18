package com.novacrm.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Ningun endpoint nuevo puede quedarse sin decir quien puede llamarlo.
 *
 * <p>Un metodo sin {@code @PreAuthorize} no queda abierto —{@code SecurityConfig}
 * exige sesion para todo lo que no este en su lista— pero si queda al alcance de
 * cualquiera que haya iniciado sesion, estudiantes incluidos. En una aplicacion
 * con los datos de 107 personas reales, «cualquiera con sesion» rara vez es la
 * respuesta correcta, y desde luego no es una respuesta que deba darse por
 * descuido.
 *
 * <p>Los que de verdad son publicos estan escritos abajo con su motivo. Añadir
 * uno nuevo obliga a apuntarlo aqui, que es justo el momento de pensarlo.
 */
class NingunEndpointSinAutorizacionTest {

    private static final Path RAIZ = Path.of("src", "main", "java");

    private static final Pattern MAPEO = Pattern.compile("@(Get|Post|Put|Patch|Delete)Mapping\\b");

    /**
     * Endpoints que a proposito no llevan {@code @PreAuthorize}, y por que.
     *
     * <p>Se apuntan por fichero y por la ruta del mapeo, no por numero de linea:
     * un numero se rompe al añadir un comentario y obliga a tocar esto por algo
     * que no cambio.
     */
    private static final Set<String> PUBLICOS_A_PROPOSITO = Set.of(
            // Iniciar sesion, renovarla y recuperar la contrasena: quien las
            // llama todavia no tiene sesion. Su defensa es el limite estricto
            // anti fuerza bruta de RateLimitFilter.
            "AuthController@PostMapping(\"/login\")",
            "AuthController@PostMapping(\"/refresh\")",
            "AuthController@PostMapping(\"/forgot-password\")",
            "AuthController@PostMapping(\"/reset-password\")",
            // Las abre el cliente de correo del destinatario, que no tiene
            // sesion ni la puede tener. La clave se valida por lista blanca
            // antes de tocar el disco.
            "BrandingController@GetMapping(\"/imagen/**\")",
            "NotificacionController@GetMapping(\"/adjunto/**\")",
            // La credencial se comparte con un empleador, que no es usuario.
            "CredencialPublicaController@GetMapping(value = \"/credencial/{uuid}\", produces = MediaType.TEXT_HTML_VALUE)",
            // Lo llama Meta, no el navegador. Su autenticacion es la firma HMAC.
            "WhatsappWebhookController@GetMapping(\"/webhook\")",
            "WhatsappWebhookController@PostMapping(\"/webhook\")",
            // Cualquiera con sesion ve las ofertas vigentes, incluidos los
            // estudiantes: es el tablon de empleo. La respuesta se recorta
            // segun el rol —creadaPor y motivoCierre solo viajan a gestion—.
            "VacanteController@GetMapping",
            // El formulario de captacion: una empresa que llega por su cuenta no
            // tiene cuenta con que entrar, porque las del portal son por
            // invitacion. Es la unica escritura sin identificar del sistema.
            //
            // Lo que hace las veces de autorizacion, por este orden: el limite
            // de tres por hora y por IP de RateLimitFilter, que no lee ninguna
            // URL ni manda ningun correo, que no enlaza con ninguna empresa del
            // CRM, y que lo que entra nace sin revisar y no aparece en ningun
            // listado hasta que una persona lo aprueba.
            "CaptacionPublicaController@PostMapping(\"/vacantes\")"
    );

    @Test
    void todoEndpointDiceQuienPuedeLlamarlo() throws IOException {
        List<String> sinDecirlo = new ArrayList<>();

        try (Stream<Path> ficheros = Files.walk(RAIZ)) {
            for (Path fichero : ficheros.filter(f -> f.toString().endsWith("Controller.java")).toList()) {
                String nombre = fichero.getFileName().toString().replace(".java", "");
                List<String> lineas = Files.readAllLines(fichero, StandardCharsets.UTF_8);

                int declaracionDeClase = indiceDeLaClase(lineas);
                boolean claseProtegida = lineas.subList(0, declaracionDeClase).stream()
                        .anyMatch(l -> l.contains("@PreAuthorize"));
                if (claseProtegida) continue;

                for (int i = declaracionDeClase; i < lineas.size(); i++) {
                    if (!MAPEO.matcher(lineas.get(i)).find()) continue;
                    if (anotacionesDelMetodo(lineas, i).stream().anyMatch(l -> l.contains("@PreAuthorize"))) continue;

                    String firma = nombre + lineas.get(i).trim();
                    if (PUBLICOS_A_PROPOSITO.contains(firma)) continue;
                    sinDecirlo.add(firma + "  (" + fichero.getFileName() + ":" + (i + 1) + ")");
                }
            }
        }

        assertTrue(sinDecirlo.isEmpty(), """
                Estos endpoints no dicen quien puede llamarlos, asi que los alcanza \
                cualquiera con sesion, estudiantes incluidos. Pon un @PreAuthorize; \
                si de verdad tienen que ser publicos, apuntalos en \
                PUBLICOS_A_PROPOSITO con el motivo:
                """ + String.join("\n", sinDecirlo));
    }

    /**
     * Las anotaciones de ese metodo, y solo de ese.
     *
     * <p>Primero se probo con una ventana de unas lineas alrededor del mapeo, y
     * pasaba con la anotacion quitada: la ventana alcanzaba el
     * {@code @PreAuthorize} del metodo de al lado. Un endpoint desprotegido
     * quedaba tapado por su vecino, que es la peor forma de fallar — la prueba
     * decia que todo estaba bien.
     *
     * <p>Asi que se recorta al metodo: hacia arriba mientras haya anotaciones o
     * comentarios suyos, y hacia abajo hasta la firma.
     */
    private static List<String> anotacionesDelMetodo(List<String> lineas, int mapeo) {
        var propias = new ArrayList<String>();

        // Hacia arriba hasta donde termina el miembro anterior: todo lo que hay
        // en medio —anotaciones, javadoc, comentarios sueltos— es de este.
        for (int i = mapeo - 1; i >= 0; i--) {
            String linea = lineas.get(i).trim();
            if (linea.isEmpty() || linea.endsWith("}") || linea.endsWith(";")) break;
            propias.add(linea);
        }

        propias.add(lineas.get(mapeo).trim());

        // Hacia abajo hasta la firma. No vale parar en la primera linea que no
        // empiece por «@»: entre el mapeo y el @PreAuthorize hay comentarios
        // —«// Solo el equipo: ...»— y anotaciones partidas en dos lineas, y
        // parando ahi se daban por desprotegidos endpoints que si lo estaban.
        for (int j = mapeo + 1; j < lineas.size(); j++) {
            String linea = lineas.get(j).trim();
            if (linea.startsWith("public ") || linea.startsWith("private ")
                    || linea.startsWith("protected ")) {
                break;
            }
            propias.add(linea);
        }
        return propias;
    }

    /** Donde empieza la clase: lo de antes son imports y anotaciones de clase. */
    private static int indiceDeLaClase(List<String> lineas) {
        for (int i = 0; i < lineas.size(); i++) {
            if (lineas.get(i).matches(".*\\bclass\\s+\\w+.*")) {
                return i;
            }
        }
        return lineas.size();
    }
}
