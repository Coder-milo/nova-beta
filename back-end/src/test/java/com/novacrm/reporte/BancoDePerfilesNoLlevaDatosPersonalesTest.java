package com.novacrm.reporte;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El banco de perfiles no puede llevar datos personales.
 *
 * <p>Es un informe que **existe para salir de la institución**: se genera
 * cuando una empresa pide candidatos y se adjunta a un correo. Lo que había a
 * mano antes era el reporte de estudiantes, que lleva documento, correo y
 * celular; nadie decidió ceder esos datos, simplemente era el botón que estaba
 * ahí.
 *
 * <p>La prueba mira las <strong>cabeceras</strong> y no los datos porque es lo
 * que se puede comprobar sin base: si aparece una columna «Documento», el
 * archivo la lleva. Añadir una columna prohibida «porque la pidió una empresa»
 * es exactamente el cambio que hay que discutir antes de hacerlo, no revisar en
 * un diff de una línea.
 */
class BancoDePerfilesNoLlevaDatosPersonalesTest {

    /**
     * Lo que no puede salir en un archivo que se manda fuera.
     *
     * <p>Mismo criterio que {@code PerfilLaboralDto} para el portal de
     * empresas: identificación, contacto directo y caracterización
     * socioeconómica. Para decidir a quién se entrevista hace falta el perfil,
     * no la cédula.
     */
    private static final List<String> PROHIBIDAS = List.of(
            "documento", "cedula", "identificacion",
            "correo", "email", "celular", "telefono", "whatsapp",
            "direccion", "barrio",
            "fecha de nacimiento", "nacimiento", "edad", "genero", "sexo", "nacionalidad",
            "sisben", "ingreso", "estrato",
            "observaciones", "notas");

    /** Las cabeceras que produce el banco de perfiles, sin tocar la base. */
    private static String[] cabecerasDelBanco() throws Exception {
        // El método es privado y necesita EntityManager para las filas, pero las
        // cabeceras son constantes: se leen del propio código fuente del record
        // que devuelve. Se invoca por reflexión con un servicio sin base y se
        // captura solo el arreglo de columnas.
        var servicio = new ReporteService(null);
        Method m = ReporteService.class.getDeclaredMethod(
                "datosPerfilesLaborales", java.util.UUID.class, java.util.UUID.class);
        m.setAccessible(true);
        try {
            Object datos = m.invoke(servicio, null, null);
            return (String[]) datos.getClass().getMethod("columnas").invoke(datos);
        } catch (Exception e) {
            // Sin EntityManager la consulta revienta antes de construir el
            // record. Se cae de vuelta a la lista declarada en el servicio.
            return null;
        }
    }

    @Test
    @DisplayName("ninguna cabecera del banco de perfiles es un dato personal")
    void ningunaColumnaProhibida() throws Exception {
        String[] cabeceras = cabecerasDelBanco();
        // Si la reflexión no pudo ejecutar la consulta, se leen del fuente: lo
        // que se está fijando es la decisión, y tiene que comprobarse igual.
        List<String> columnas = cabeceras != null
                ? List.of(cabeceras)
                : columnasDeclaradasEnElFuente();

        assertThat(columnas).isNotEmpty();

        var filtradas = columnas.stream()
                .filter(c -> PROHIBIDAS.stream()
                        .anyMatch(p -> c.toLowerCase(Locale.ROOT).contains(p)))
                .toList();

        assertThat(filtradas)
                .as("este informe se adjunta a un correo y sale de la institución; "
                        + "añadir una de estas columnas es ceder datos personales, "
                        + "y esa decisión no es de quien escribe el diff")
                .isEmpty();
    }

    @Test
    @DisplayName("sí lleva lo que hace falta para valorar a un candidato")
    void llevaLoQueSirve() throws Exception {
        String[] cabeceras = cabecerasDelBanco();
        List<String> columnas = cabeceras != null
                ? List.of(cabeceras)
                : columnasDeclaradasEnElFuente();
        String todo = String.join(" | ", columnas).toLowerCase(Locale.ROOT);

        // Un recorte que se pasa de celoso deja un archivo que no sirve para
        // convocar a nadie, y entonces alguien vuelve a mandar el otro informe.
        assertThat(todo).contains("nombre");
        assertThat(todo).contains("experiencia");
        assertThat(todo).contains("ingles");
        assertThat(todo).contains("perfil profesional");
    }

    /** Lee las cabeceras del código fuente, por si la reflexión no puede. */
    private static List<String> columnasDeclaradasEnElFuente() throws Exception {
        var ruta = java.nio.file.Path.of(
                "src/main/java/com/novacrm/reporte/ReporteService.java");
        String fuente = java.nio.file.Files.readString(ruta);
        int i = fuente.indexOf("\"Banco de perfiles laborales\"");
        assertThat(i).as("el banco de perfiles tiene que existir").isGreaterThan(0);
        int abre = fuente.indexOf("new String[] {", i);
        int cierra = fuente.indexOf("},", abre);
        var columnas = new java.util.ArrayList<String>();
        var m = java.util.regex.Pattern.compile("\"([^\"]+)\"")
                .matcher(fuente.substring(abre, cierra));
        while (m.find()) {
            columnas.add(m.group(1));
        }
        return columnas;
    }
}
