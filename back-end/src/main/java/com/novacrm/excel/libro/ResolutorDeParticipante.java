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
 * completo y un numero de orden. Las hojas de admision y matrices maestras
 * tambien traen correo o documento.
 *
 * <p>Se prioriza la busqueda por documento y correo cuando estan disponibles,
 * y se recurre a la coincidencia por nombre normalizado cuando no.
 */
public class ResolutorDeParticipante {

    /** Nombre normalizado → participantes que responden a el. */
    private final Map<String, List<Estudiante>> porNombre = new HashMap<>();
    /** Documento normalizado → participante. */
    private final Map<String, Estudiante> porDocumento = new HashMap<>();
    /** Correo en minúsculas → participante. */
    private final Map<String, Estudiante> porEmail = new HashMap<>();

    public ResolutorDeParticipante(EstudianteRepository repositorio) {
        this(repositorio.findAllByActivoTrue());
    }

    /** Construye el índice desde una carga ya hecha por el llamador. */
    public ResolutorDeParticipante(List<Estudiante> participantes) {
        for (Estudiante e : participantes) {
            for (String clave : clavesDe(e)) {
                porNombre.computeIfAbsent(clave, k -> new java.util.ArrayList<>()).add(e);
            }
            if (e.getNumeroDocumento() != null && !e.getNumeroDocumento().isBlank()) {
                String docNorm = normalizarDocumento(e.getNumeroDocumento());
                if (!docNorm.isBlank()) {
                    porDocumento.putIfAbsent(docNorm, e);
                }
            }
            if (e.getEmail() != null && !e.getEmail().isBlank()) {
                porEmail.putIfAbsent(e.getEmail().trim().toLowerCase(Locale.ROOT), e);
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

    public Resultado buscar(String nombreCompleto, String email, String documento) {
        if (documento != null && !documento.isBlank()) {
            String docNorm = normalizarDocumento(documento);
            var e = porDocumento.get(docNorm);
            if (e != null) {
                return new Resultado.Encontrado(e);
            }
        }
        if (email != null && !email.isBlank()) {
            var e = porEmail.get(email.trim().toLowerCase(Locale.ROOT));
            if (e != null) {
                return new Resultado.Encontrado(e);
            }
        }
        return buscar(nombreCompleto);
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
        return com.novacrm.shared.ClaveNormalizada.de(texto);
    }

    static String normalizarDocumento(String doc) {
        if (doc == null) return "";
        return doc.replaceAll("[^a-zA-Z0-9]", "").toLowerCase(Locale.ROOT);
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
