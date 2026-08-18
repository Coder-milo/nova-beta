package com.novacrm.reporte;

import com.novacrm.estudiante.Estudiante;

import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * Las columnas que se pueden elegir para un informe a medida.
 *
 * <p>Es un <strong>catálogo cerrado</strong>, y esa es la decisión que hace que
 * esto no sea peligroso. Un constructor de informes «de verdad» —escribe el
 * nombre del campo y te lo saco— es un generador de consultas contra la base
 * expuesto por HTTP: da igual cuánto se escape, el siguiente que añada un campo
 * decide sin querer qué sale de la institución.
 *
 * <p>Aquí cada columna es una función Java sobre {@link Estudiante} declarada de
 * antemano. Lo que no está en esta lista no se puede pedir, y añadir una
 * columna es un cambio de código que alguien revisa.
 *
 * <p>{@code personal} marca lo que identifica o contacta a una persona. No
 * bloquea nada —el equipo tiene derecho a exportar su propio censo— pero la
 * pantalla lo avisa: el informe de estudiantes ya salía por correo con
 * documento y celular sin que nadie lo hubiera decidido, y de ahí nació el
 * banco de perfiles del punto 12.
 */
public enum ColumnaDeInforme {

    NOMBRE("Nombre", false, e -> texto(e.getNombre())),
    APELLIDO("Apellido", false, e -> texto(e.getApellido())),
    PROGRAMA("Programa", false, e -> e.getPrograma() == null ? "" : texto(e.getPrograma().getNombre())),
    CIUDAD("Ciudad", false, e -> texto(e.getCiudad())),
    ESTADO_ACADEMICO("Estado academico", false,
            e -> e.getEstadoAcademico() == null ? "" : e.getEstadoAcademico().name()),
    ESTADO_EMPLEABILIDAD("Estado empleabilidad", false,
            e -> e.getEstadoEmpleabilidad() == null ? "" : e.getEstadoEmpleabilidad().name()),
    NIVEL_INGLES("Nivel de ingles", false,
            e -> e.getNivelIngles() == null ? "" : texto(e.getNivelIngles().getNombre())),
    TITULO("Titulo", false, e -> texto(e.getTitulo())),
    AREA_FORMACION("Area de formacion", false, e -> texto(e.getAreaFormacion())),
    ULTIMO_CARGO("Ultimo cargo", false, e -> texto(e.getUltimoCargo())),
    SECTOR_EXPERIENCIA("Sector de experiencia", false, e -> texto(e.getSectorExperiencia())),
    ANIOS_EXPERIENCIA("Anios de experiencia", false,
            e -> e.getAniosExperiencia() == null ? "" : String.valueOf(e.getAniosExperiencia())),
    CARGO_OBJETIVO("Cargo objetivo", false, e -> texto(e.getCargoObjetivo())),
    COMPETENCIAS("Habilidades", false, e -> texto(e.getCompetencias())),
    PERFIL_PROFESIONAL("Perfil profesional", false, e -> texto(e.getPerfilProfesional())),
    RESPONSABLE("Responsable", false,
            e -> e.getResponsable() == null ? "" : texto(e.getResponsable().getEmail())),
    FECHA_REGISTRO("Fecha de registro", false,
            e -> fecha(e.getCreatedAt())),

    // ── Lo que identifica o contacta a una persona ──────────────────────────
    DOCUMENTO("Documento", true, e -> texto(e.getNumeroDocumento())),
    EMAIL("Correo", true, e -> texto(e.getEmail())),
    CELULAR("Celular", true, e -> texto(e.getCelular())),
    TELEFONO("Telefono", true, e -> texto(e.getTelefono())),
    DIRECCION("Direccion", true, e -> texto(e.getDireccion())),
    BARRIO("Barrio", true, e -> texto(e.getBarrio()));

    private static final DateTimeFormatter FECHA =
            DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(java.time.ZoneOffset.UTC);

    private final String etiqueta;
    private final boolean personal;
    private final Function<Estudiante, String> lectura;

    ColumnaDeInforme(String etiqueta, boolean personal, Function<Estudiante, String> lectura) {
        this.etiqueta = etiqueta;
        this.personal = personal;
        this.lectura = lectura;
    }

    public String getEtiqueta() { return etiqueta; }

    /** Si identifica o permite contactar a la persona. */
    public boolean esPersonal() { return personal; }

    public String leerDe(Estudiante e) {
        String valor = lectura.apply(e);
        return valor == null ? "" : valor;
    }

    private static String texto(String v) {
        return v == null ? "" : v;
    }

    /**
     * La fecha, o vacio.
     *
     * <p>Es un metodo y no un uso directo del formateador porque las constantes
     * de un enum se inicializan <em>antes</em> que sus campos estaticos: la
     * lambda no puede nombrar `FECHA` sin que el compilador lo rechace.
     */
    private static String fecha(java.time.Instant instante) {
        return instante == null ? "" : FECHA.format(instante);
    }

    /** El catálogo, para que la pantalla lo pinte sin conocer el enum. */
    public static Map<String, ColumnaDeInforme> catalogo() {
        var mapa = new LinkedHashMap<String, ColumnaDeInforme>();
        Arrays.stream(values()).forEach(c -> mapa.put(c.name(), c));
        return mapa;
    }
}
