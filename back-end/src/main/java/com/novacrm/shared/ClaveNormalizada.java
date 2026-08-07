package com.novacrm.shared;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Texto comparable: minusculas, sin tildes y con los signos como espacio.
 *
 * <p>Es el gemelo en Java de la funcion SQL {@code novacrm_normalizar} (V38).
 * Existen las dos porque se usan en momentos distintos: la de SQL busca
 * duplicados contra lo que ya hay en la base, y esta compara filas dentro del
 * archivo que se esta importando, donde todavia no hay nada guardado contra lo
 * que consultar y hacer una ida a la base por fila seria absurdo.
 *
 * <p>Las dos tienen que dar el mismo resultado o la deduplicacion cojea: la
 * primera aparicion de una empresa en el archivo se buscaria en la base con un
 * criterio y la segunda se compararia con otro. {@code ClaveNormalizadaTest}
 * fija los casos que importan; si un dia cambia una, cambia la otra.
 *
 * <p>Esta version quita cualquier diacritico via Unicode, no solo los del
 * castellano que enumera la funcion SQL. La diferencia solo aparece con
 * alfabetos que estas hojas no traen, y es hacia el lado seguro: agrupa mas, no
 * menos.
 */
public final class ClaveNormalizada {

    private ClaveNormalizada() {
    }

    /**
     * Clave de comparacion para nombres, razones sociales y correos.
     *
     * <p>Devuelve cadena vacia para nulo o en blanco, y quien la use como clave
     * de un mapa debe descartar la vacia: si no, todas las filas sin nombre se
     * consideran la misma.
     */
    public static String de(String texto) {
        if (texto == null) {
            return "";
        }
        return Normalizer.normalize(texto.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .replaceAll("[^\\p{Alnum}\\s]", " ")
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }

    /**
     * Clave para documentos de identidad: se quitan los signos del todo.
     *
     * <p>Aqui no valen como espacio. El documento llega de Excel como
     * "1.234.567" y se busca "1234567"; convertir los puntos en espacio daria
     * "1 234 567", que no compara con ninguno de los dos.
     */
    public static String deDocumento(String documento) {
        if (documento == null) {
            return "";
        }
        return documento.replaceAll("[^0-9A-Za-z]", "").toLowerCase(Locale.ROOT);
    }

    /**
     * Clave para razones sociales: sin signos <em>ni</em> espacios.
     *
     * <p>Con la regla de los nombres —signo igual a espacio— «Solvo S.A.S.»
     * daba "solvo s a s" y «SOLVO SAS» daba "solvo sas", que no son iguales y
     * dejaban dos empleadores donde hay uno. En una razon social el punto y el
     * espacio son ruido de escritura, no separan nada: quitando los dos, las
     * dos formas caen en "solvosas".
     *
     * <p>No sirve para personas. Alli el espacio si separa —"perez gomez" no es
     * lo mismo que "perezgomez" cuando se compara contra un nombre escrito con
     * guion— y por eso son dos reglas y no una.
     */
    public static String deEmpresa(String razonSocial) {
        return de(razonSocial).replace(" ", "");
    }
}
