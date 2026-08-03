package com.novacrm.excel.libro;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Encuentra al participante al que se refiere una fila.
 *
 * <p>Las tres hojas de participantes del libro de seguimiento —perfiles,
 * postulaciones y colocaciones— identifican a la persona por su nombre
 * completo y un numero de orden. Ninguna trae correo ni documento, que es por
 * lo unico que sabian buscar los importadores: exigian una columna que el
 * archivo real no tiene, asi que las tres hojas habrian fallado fila por fila.
 *
 * <p>Buscar por nombre es menos fiable que por documento, y por eso esta clase
 * no adivina. Compara nombres normalizados —sin tildes, sin mayusculas, sin
 * espacios de sobra— y cuando un nombre corresponde a mas de un participante
 * devuelve ambiguedad en vez de elegir: asignarle a la persona equivocada una
 * colocacion o una postulacion es peor que dejar la fila sin importar y
 * decirlo.
 *
 * <p>Tampoco crea participantes. {@code Estudiante.email} es obligatorio y
 * unico, y estas hojas no traen correo; inventar uno para poder insertar
 * romperia el acceso del estudiante y sus avisos. Los nombres que no existan se
 * informan para que alguien los d de alta con sus datos de contacto reales.
 */
public class ResolutorDeParticipante {

    /** Nombre normalizado → participantes que responden a el. */
    private final Map<String, List<Estudiante>> porNombre = new HashMap<>();

    public ResolutorDeParticipante(EstudianteRepository repositorio) {
        for (Estudiante e : repositorio.findAllByActivoTrue()) {
            for (String clave : clavesDe(e)) {
                porNombre.computeIfAbsent(clave, k -> new java.util.ArrayList<>()).add(e);
            }
        }
    }

    /** Resultado de buscar un nombre. */
    public sealed interface Resultado {

        record Encontrado(Estudiante estudiante) implements Resultado {}

        /** El nombre corresponde a mas de un participante activo. */
        record Ambiguo(int cuantos) implements Resultado {}

        record NoExiste() implements Resultado {}
    }

    public Resultado buscar(String nombreCompleto) {
        if (nombreCompleto == null || nombreCompleto.isBlank()) {
            return new Resultado.NoExiste();
        }
        var coincidencias = porNombre.get(normalizar(nombreCompleto));
        if (coincidencias == null || coincidencias.isEmpty()) {
            return new Resultado.NoExiste();
        }
        // Un mismo estudiante puede estar indexado por varias claves; lo que
        // importa es cuantas personas distintas responden al nombre.
        var distintos = coincidencias.stream().map(Estudiante::getId).distinct().count();
        if (distintos > 1) {
            return new Resultado.Ambiguo((int) distintos);
        }
        return new Resultado.Encontrado(coincidencias.get(0));
    }

    /** Mensaje listo para el informe de errores. */
    public static String explicar(Resultado resultado, String nombre) {
        if (resultado instanceof Resultado.Ambiguo ambiguo) {
            return "Hay " + ambiguo.cuantos() + " participantes activos llamados «" + nombre
                    + "»; hace falta el documento o el correo para saber cuál es";
        }
        if (resultado instanceof Resultado.NoExiste) {
            return "No hay ningún participante activo llamado «" + nombre
                    + "». Créalo primero con su correo, o corrige el nombre en la hoja";
        }
        return "";
    }

    /**
     * Formas bajo las que se indexa a un participante.
     *
     * <p>La ficha guarda nombre y apellidos por separado y la hoja los trae
     * juntos, pero no siempre en el mismo orden: hay listados exportados como
     * "Apellidos Nombre". Se indexan las dos combinaciones.
     */
    private static Set<String> clavesDe(Estudiante e) {
        String nombre = e.getNombre() == null ? "" : e.getNombre();
        String apellido = e.getApellido() == null ? "" : e.getApellido();
        var claves = new LinkedHashSet<String>();
        claves.add(normalizar(nombre + " " + apellido));
        claves.add(normalizar(apellido + " " + nombre));
        claves.remove("");
        return claves;
    }

    /**
     * Nombre comparable: sin tildes, en minusculas y sin espacios repetidos.
     *
     * <p>No se quitan las particulas ("de", "la", "del"): forman parte de los
     * apellidos y quitarlas juntaria personas distintas.
     */
    static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        return java.text.Normalizer.normalize(texto.trim(), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .replaceAll("[^\\p{Alnum}\\s]", " ")
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }

    /** Cuantos participantes activos se cargaron. Util para el informe. */
    public int indexados() {
        return (int) porNombre.values().stream()
                .flatMap(List::stream)
                .map(Estudiante::getId)
                .distinct()
                .count();
    }

    /** Fabrica, para que el servicio no dependa del repositorio al construirse. */
    public static Optional<ResolutorDeParticipante> de(EstudianteRepository repositorio) {
        return Optional.ofNullable(repositorio).map(ResolutorDeParticipante::new);
    }
}
