package com.novacrm.ia;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Revision de una hoja de vida sin preguntarle nada a un modelo.
 *
 * <p>Existe por dos razones. La primera es que la clave de la API se acaba y el
 * proveedor se cae, y "mejora mi hoja de vida" no puede quedarse en un mensaje
 * generico justo el dia antes de una entrevista. La segunda es que estas
 * revisiones son reglas, no opiniones: si el texto no tiene una sola cifra, le
 * falta una cifra, y eso no hace falta preguntarlo.
 *
 * <p>Lo que si es opinion —como reescribir un parrafo concreto, que tono usar
 * para una vacante concreta— se queda para el modelo, que recibe estas
 * observaciones como punto de partida en vez de empezar de cero.
 *
 * <p>Las senales se detectan en espanol y en ingles, porque media cohorte
 * escribe su hoja de vida en ingles para las vacantes bilingues; los consejos
 * se dan en espanol, que es el idioma en el que se trabaja el programa.
 */
public final class RevisorDeHojaDeVida {

    /**
     * @param senal        que se encontro en el texto
     * @param queCambiar   la correccion, en imperativo
     * @param ejemplo      el mismo tipo de frase ya corregida
     */
    public record Observacion(String senal, String queCambiar, String ejemplo) {

        String comoLinea() {
            return "- %s -> %s Ejemplo: \"%s\"".formatted(senal, queCambiar, ejemplo);
        }
    }

    /** Un texto por debajo de esto es una pregunta, no una hoja de vida. */
    private static final int MINIMO_PARA_REVISAR = 120;

    private static final Pattern TIENE_CIFRA = Pattern.compile("\\d");
    private static final Pattern TIENE_CORREO = Pattern.compile("[\\w.+-]+@[\\w-]+\\.[\\w.]+");
    private static final Pattern TIENE_TELEFONO = Pattern.compile("(?<!\\d)\\d{7,}(?!\\d)");

    /** Arranques en primera persona. La hoja de vida se escribe impersonal. */
    private static final List<String> PRIMERA_PERSONA = List.of(
            "yo soy", "yo tengo", "yo trabaje", "yo he", "mi nombre es", "i am a", "my name is");

    /** Formulas que ocupan la linea sin decir que se logro. */
    private static final List<String> VERBOS_DEBILES = List.of(
            "encargado de", "encargada de", "responsable de", "ayude a", "ayude en",
            "hice", "participe en", "apoye en", "labores de", "funciones de",
            "responsible for", "in charge of", "helped with", "worked on", "duties included");

    /** Adjetivos que todo el mundo pone y que por eso no distinguen a nadie. */
    private static final List<String> ADJETIVOS_VACIOS = List.of(
            "proactivo", "proactiva", "responsable y", "dinamico", "dinamica",
            "trabajo en equipo", "buena actitud", "don de gentes", "ganas de aprender",
            "hardworking", "team player", "self motivated", "detail oriented");

    /**
     * Datos que un anuncio no puede pedir y que dan pie a descartar por edad,
     * sexo o situacion familiar antes de leer la experiencia.
     */
    private static final List<String> DATOS_SENSIBLES = List.of(
            "estado civil", "cedula", "cedula de ciudadania", "numero de documento",
            "fecha de nacimiento", "edad:", "sexo:", "genero:", "hijos",
            "marital status", "date of birth");

    private RevisorDeHojaDeVida() {
    }

    /** Si el texto da para revisarse como hoja de vida o es solo una pregunta. */
    public static boolean pareceHojaDeVida(String texto) {
        if (texto == null) return false;
        String limpio = texto.trim();
        if (limpio.length() < MINIMO_PARA_REVISAR) return false;
        // Una pregunta larga sigue siendo una pregunta.
        return !limpio.endsWith("?") || limpio.chars().filter(c -> c == '\n').count() >= 2;
    }

    /**
     * Todo lo que se puede afirmar del texto sin opinar.
     *
     * <p>Devuelve lista vacia cuando el texto esta bien por estas reglas, que
     * es una respuesta legitima y no un fallo: no se inventa una pega para
     * tener algo que decir.
     */
    public static List<Observacion> revisar(String hojaDeVida) {
        String texto = normalizar(hojaDeVida);
        List<Observacion> observaciones = new ArrayList<>();
        if (texto.isBlank()) return observaciones;

        primeraCoincidencia(texto, PRIMERA_PERSONA).ifPresent(hallazgo -> observaciones.add(new Observacion(
                "Esta escrita en primera persona (\"" + hallazgo + "\")",
                "Quita el \"yo\" y empieza por el cargo o el logro.",
                "Asesor de servicio al cliente con 2 anios en operaciones bilingues.")));

        if (!TIENE_CIFRA.matcher(hojaDeVida).find()) {
            observaciones.add(new Observacion(
                    "No tiene ni una sola cifra",
                    "Pon numeros donde puedas: cuantas llamadas, cuantos clientes, cuanto tiempo, cuanto mejoro.",
                    "Atendi 60 llamadas diarias con 95% de satisfaccion."));
        }

        primeraCoincidencia(texto, VERBOS_DEBILES).ifPresent(hallazgo -> observaciones.add(new Observacion(
                "Usa formulas que no dicen el resultado (\"" + hallazgo + "\")",
                "Cambialas por un verbo de accion y cierra con lo que se consiguio.",
                "En vez de \"encargado de atender clientes\": \"Resolvi 40 casos diarios de facturacion\".")));

        primeraCoincidencia(texto, ADJETIVOS_VACIOS).ifPresent(hallazgo -> observaciones.add(new Observacion(
                "Se describe con adjetivos que todos ponen (\"" + hallazgo + "\")",
                "Sustituyelos por un hecho que los demuestre.",
                "En vez de \"proactivo\": \"Propuse un guion de respuesta que bajo el tiempo de llamada a la mitad\".")));

        primeraCoincidencia(texto, DATOS_SENSIBLES).ifPresent(hallazgo -> observaciones.add(new Observacion(
                "Incluye datos personales que no se piden (\"" + hallazgo + "\")",
                "Quitalos. No suman a la candidatura y dan pie a descartar por edad o situacion familiar.",
                "Deja solo nombre, ciudad, telefono, correo y LinkedIn.")));

        if (!TIENE_CORREO.matcher(hojaDeVida).find() && !TIENE_TELEFONO.matcher(hojaDeVida).find()) {
            observaciones.add(new Observacion(
                    "No se ve un dato de contacto",
                    "Pon correo y celular arriba del todo, en la primera linea.",
                    "Barranquilla · 300 000 0000 · nombre.apellido@correo.com"));
        }

        if (todoEnMayusculas(hojaDeVida)) {
            observaciones.add(new Observacion(
                    "Esta escrita en mayusculas sostenidas",
                    "Escribela en minusculas con mayuscula inicial: en mayusculas cuesta mas leerla y algunos filtros la leen peor.",
                    "Asesor de servicio al cliente bilingue"));
        }

        return observaciones;
    }

    /**
     * Las observaciones ya redactadas, para responder sin modelo.
     *
     * <p>Cuando no hay ninguna se dice justo eso, y se pasa a lo que las reglas
     * no alcanzan a comprobar: si lo que cuenta encaja con la vacante.
     */
    public static String comoTexto(List<Observacion> observaciones) {
        if (observaciones.isEmpty()) {
            return """
                    Revise tu texto y por las reglas basicas esta bien: no usa primera persona, \
                    tiene cifras, no se apoya en adjetivos genericos y no trae datos personales de mas.
                    Lo siguiente que conviene mirar ya depende de la vacante: que los tres primeros \
                    renglones digan lo que esa oferta esta pidiendo. Pegame la oferta y lo comparamos.""";
        }
        StringBuilder sb = new StringBuilder("Revise tu hoja de vida y encontre esto:\n");
        for (Observacion o : observaciones) {
            sb.append(o.comoLinea()).append('\n');
        }
        sb.append("Corrige eso primero; es lo que mas cambia la impresion en los primeros diez segundos de lectura.");
        return sb.toString();
    }

    /** Las mismas observaciones en crudo, para que el modelo parta de ellas. */
    public static String comoContextoParaPrompt(List<Observacion> observaciones) {
        if (observaciones.isEmpty()) return "";
        StringBuilder sb = new StringBuilder(
                "Revision automatica ya hecha sobre ese texto (usala, no la repitas literal):\n");
        for (Observacion o : observaciones) {
            sb.append(o.comoLinea()).append('\n');
        }
        return sb.toString();
    }

    private static java.util.Optional<String> primeraCoincidencia(String texto, List<String> marcas) {
        for (String marca : marcas) {
            if (texto.contains(normalizar(marca))) return java.util.Optional.of(marca);
        }
        return java.util.Optional.empty();
    }

    /**
     * Mayusculas sostenidas de verdad, no un titulo en mayusculas.
     *
     * <p>Se mide sobre las letras que tienen caja, asi que los numeros y los
     * signos de una hoja de vida normal no arrastran el resultado.
     */
    private static boolean todoEnMayusculas(String texto) {
        long mayusculas = texto.chars().filter(Character::isUpperCase).count();
        long minusculas = texto.chars().filter(Character::isLowerCase).count();
        return mayusculas + minusculas > 60 && minusculas * 4 < mayusculas;
    }

    private static String normalizar(String texto) {
        if (texto == null) return "";
        String sinTildes = Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return sinTildes.toLowerCase(Locale.ROOT);
    }
}
