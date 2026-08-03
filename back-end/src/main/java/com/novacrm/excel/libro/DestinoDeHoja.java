package com.novacrm.excel.libro;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * A que parte del sistema alimenta una hoja, y con que vocabulario se reconoce.
 *
 * <p>Un libro de seguimiento trae hojas de cosas distintas —participantes,
 * empresas, postulaciones, colocaciones— mas otras que no son datos que
 * importar (un tablero de indicadores, una hoja vacia que alguien dejo
 * preparada). Aqui vive lo que hace falta para distinguirlas: los titulos que
 * cada destino sabe leer y los que no puede faltarle.
 *
 * <p>El vocabulario es unico para toda la aplicacion a proposito. Estaba
 * repartido en constantes privadas de cada servicio, asi que anadir un sinonimo
 * en un sitio no lo anadia en el otro.
 */
public enum DestinoDeHoja {

    /**
     * Participantes del programa.
     *
     * <p>Ojo: la hoja los identifica por nombre completo, no por correo ni
     * documento. Ver {@code ResolutorDeParticipante}.
     */
    PARTICIPANTES("Participantes", Set.of("nombreCompleto"), Map.ofEntries(
            Map.entry("n", "numeroParticipante"),
            Map.entry("no", "numeroParticipante"),
            Map.entry("num", "numeroParticipante"),
            Map.entry("n participante", "numeroParticipante"),
            Map.entry("numero de participante", "numeroParticipante"),
            Map.entry("nombre completo", "nombreCompleto"),
            Map.entry("nombre y apellidos", "nombreCompleto"),
            Map.entry("participante", "nombreCompleto"),
            Map.entry("edad", "edad"),
            Map.entry("genero", "genero"),
            Map.entry("sexo", "genero"),
            Map.entry("nacionalidad", "nacionalidad"),
            Map.entry("nivel educativo", "nivelEducativo"),
            Map.entry("carrera titulo", "areaFormacion"),
            Map.entry("carrera", "areaFormacion"),
            Map.entry("titulo", "areaFormacion"),
            Map.entry("area de formacion", "areaFormacion"),
            Map.entry("tiempo de experiencia", "tiempoExperiencia"),
            Map.entry("experiencia", "tiempoExperiencia"),
            Map.entry("sector area", "sectorExperiencia"),
            Map.entry("sector experiencia", "sectorExperiencia"),
            Map.entry("nivel de ingles", "nivelIngles"),
            Map.entry("nivel ingles", "nivelIngles"),
            Map.entry("cv listo", "cvListo"),
            Map.entry("hoja de vida lista", "cvListo"),
            Map.entry("cv en ingles", "cvEnIngles"),
            Map.entry("hoja de vida en ingles", "cvEnIngles"),
            Map.entry("linkedin creado", "linkedinCreado"),
            Map.entry("linkedin optimizado", "linkedinOptimizado"),
            Map.entry("perfil ocupacional", "perfilOcupacional"),
            Map.entry("estado de empleabilidad", "estadoEmpleabilidad"),
            Map.entry("estado empleabilidad", "estadoEmpleabilidad"),
            Map.entry("cargos que puede aplicar", "cargoObjetivo"),
            Map.entry("empresas que puede aplicar", "observaciones"),
            Map.entry("empresas a las que aplica", "observaciones"),
            Map.entry("empresas objetivo", "observaciones"),
            Map.entry("empresas de interes", "observaciones"),
            Map.entry("cargo objetivo", "cargoObjetivo"),
            Map.entry("sector objetivo", "sectorObjetivo"),
            Map.entry("habilidades tecnicas", "competencias"),
            Map.entry("competencias", "competencias"),
            Map.entry("link carpeta", "carpetaUrl"),
            Map.entry("carpeta", "carpetaUrl"),
            Map.entry("link linkdln", "linkedinUrl"),
            Map.entry("link linkedin", "linkedinUrl"),
            Map.entry("linkedin", "linkedinUrl"),
            Map.entry("correo", "email"),
            Map.entry("correo electronico", "email"),
            Map.entry("email", "email"),
            Map.entry("numero de documento", "numeroDocumento"),
            Map.entry("documento", "numeroDocumento"),
            Map.entry("cedula", "numeroDocumento"),
            Map.entry("celular", "celular"),
            Map.entry("telefono", "telefono"),
            Map.entry("ciudad", "ciudad"),
            Map.entry("observaciones", "observaciones"))),

    /** Directorio de empresas y su estado de relacion con el programa. */
    EMPRESAS("Empresas", Set.of("nombre"), Map.ofEntries(
            Map.entry("empresa", "nombre"),
            Map.entry("nombre de la empresa", "nombre"),
            Map.entry("razon social", "nombre"),
            Map.entry("compania", "nombre"),
            Map.entry("sector", "sector"),
            Map.entry("industria", "sector"),
            Map.entry("tipo", "sector"),
            Map.entry("ciudad", "ciudad"),
            Map.entry("sitio web", "sitioWeb"),
            Map.entry("pagina web", "sitioWeb"),
            Map.entry("web", "sitioWeb"),
            Map.entry("telefono", "telefono"),
            Map.entry("numero de contacto", "telefono"),
            Map.entry("correo", "email"),
            Map.entry("email", "email"),
            Map.entry("direccion", "direccion"),
            Map.entry("contacto", "contactoNombre"),
            Map.entry("nombre del contacto", "contactoNombre"),
            Map.entry("persona de contacto", "contactoNombre"),
            Map.entry("correo del contacto", "contactoEmail"),
            Map.entry("email contacto", "contactoEmail"),
            Map.entry("contacto canal", "contactoCanal"),
            Map.entry("canal de contacto", "contactoCanal"),
            Map.entry("fecha 1er contacto", "fechaPrimerContacto"),
            Map.entry("fecha primer contacto", "fechaPrimerContacto"),
            Map.entry("fecha de contacto", "fechaPrimerContacto"),
            Map.entry("estado relacion", "estadoRelacion"),
            Map.entry("estado de la relacion", "estadoRelacion"),
            Map.entry("proximo paso", "proximoPaso"),
            Map.entry("siguiente paso", "proximoPaso"),
            Map.entry("notas", "notas"),
            Map.entry("observaciones", "notas"),
            Map.entry("cargos", "cargosTipicos"),
            Map.entry("cargos tipicos", "cargosTipicos"),
            Map.entry("perfiles que contrata", "cargosTipicos"),
            Map.entry("canal de postulacion", "canalPostulacion"))),

    /** Una fila por postulacion enviada. */
    POSTULACIONES("Postulaciones", Set.of("nombreCompleto", "empresaNombre"), Map.ofEntries(
            Map.entry("n participante", "numeroParticipante"),
            Map.entry("n", "numeroParticipante"),
            Map.entry("nombre completo", "nombreCompleto"),
            Map.entry("participante", "nombreCompleto"),
            Map.entry("correo", "email"),
            Map.entry("email", "email"),
            Map.entry("empresa", "empresaNombre"),
            Map.entry("cargo aplicado", "cargo"),
            Map.entry("cargo", "cargo"),
            Map.entry("canal", "canal"),
            Map.entry("fecha postulacion", "fechaPostulacion"),
            Map.entry("fecha de postulacion", "fechaPostulacion"),
            Map.entry("estado", "estado"),
            Map.entry("hubo respuesta", "huboRespuesta"),
            Map.entry("fecha respuesta", "fechaRespuesta"),
            Map.entry("resultado", "resultado"),
            Map.entry("gestionado por", "gestionadoPor"),
            Map.entry("url oferta", "urlOferta"),
            Map.entry("enlace", "urlOferta"),
            Map.entry("observaciones", "observaciones"))),

    /** Participantes ya vinculados a una empresa. */
    COLOCACIONES("Colocaciones", Set.of("empresaNombre"), Map.ofEntries(
            Map.entry("n", "numeroParticipante"),
            Map.entry("n participante", "numeroParticipante"),
            Map.entry("nombre completo", "nombreCompleto"),
            Map.entry("participante", "nombreCompleto"),
            Map.entry("documento", "documento"),
            Map.entry("numero de documento", "documento"),
            Map.entry("cedula", "documento"),
            Map.entry("identificacion", "documento"),
            Map.entry("correo", "email"),
            Map.entry("correo del estudiante", "email"),
            Map.entry("email", "email"),
            Map.entry("empresa", "empresaNombre"),
            Map.entry("nombre de la empresa", "empresaNombre"),
            Map.entry("cargo", "cargo"),
            Map.entry("puesto", "cargo"),
            Map.entry("tipo vinculacion", "tipoVinculacion"),
            Map.entry("tipo de vinculacion", "tipoVinculacion"),
            Map.entry("vinculacion", "tipoVinculacion"),
            Map.entry("fecha inicio", "fechaInicio"),
            Map.entry("fecha de inicio", "fechaInicio"),
            Map.entry("fecha de ingreso", "fechaInicio"),
            Map.entry("canal", "canalConsecucion"),
            Map.entry("canal de consecucion", "canalConsecucion"),
            Map.entry("como se consiguio", "canalConsecucion"),
            Map.entry("salario cop", "salario"),
            Map.entry("salario", "salario"),
            Map.entry("sueldo", "salario"),
            Map.entry("remuneracion", "salario"),
            Map.entry("bonificaciones", "bonificaciones"),
            Map.entry("modalidad", "modalidad"),
            Map.entry("tipo contrato", "tipoContrato"),
            Map.entry("tipo de contrato", "tipoContrato"),
            Map.entry("contrato", "checklistContrato"),
            Map.entry("verificacion vacante", "checklistVerificacionVacante"),
            Map.entry("benchmark", "checklistBenchmark"),
            Map.entry("reglamento interno", "checklistReglamento"),
            Map.entry("colilla de pago", "checklistColilla"),
            Map.entry("observaciones", "observaciones")));

    private final String etiqueta;
    private final Set<String> camposObligatorios;
    private final Map<String, String> alias;

    DestinoDeHoja(String etiqueta, Set<String> camposObligatorios, Map<String, String> alias) {
        this.etiqueta = etiqueta;
        this.camposObligatorios = camposObligatorios;
        var normalizado = new HashMap<String, String>();
        alias.forEach((titulo, campo) -> normalizado.put(Normalizacion.titulo(titulo), campo));
        this.alias = Map.copyOf(normalizado);
    }

    public String getEtiqueta() {
        return etiqueta;
    }

    /** Campos sin los cuales la hoja no se puede importar a este destino. */
    public Set<String> camposObligatorios() {
        return camposObligatorios;
    }

    /** Campo del sistema al que corresponde un titulo, o {@code null}. */
    public String campoDe(String titulo) {
        return alias.get(Normalizacion.titulo(titulo));
    }

    /** Todos los campos del sistema que este destino sabe importar. */
    public Set<String> camposPosibles() {
        return alias.values().stream()
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    public boolean reconoce(String titulo) {
        return campoDe(titulo) != null;
    }

    /**
     * Mapea los titulos de una cabecera a campos del sistema.
     *
     * <p>Si dos columnas apuntan al mismo campo gana la primera: la segunda
     * suele ser un duplicado a medio rellenar —la hoja de empresas por sector
     * trae dos veces "Numero de Contacto"— y sobrescribir con celdas vacias
     * borraria lo que si traia la buena.
     */
    public LinkedHashMap<Integer, String> mapear(Map<Integer, String> titulos) {
        var porIndice = new LinkedHashMap<Integer, String>();
        for (var entrada : titulos.entrySet()) {
            String campo = campoDe(entrada.getValue());
            if (campo != null && !porIndice.containsValue(campo)) {
                porIndice.put(entrada.getKey(), campo);
            }
        }
        return porIndice;
    }

    /** Normalizacion compartida de titulos de columna. */
    public static final class Normalizacion {

        private Normalizacion() {
        }

        /**
         * Deja el titulo comparable: sin tildes, sin puntuacion, en minusculas
         * y sin espacios de sobra. Tambien quita los simbolos de estado que el
         * equipo pone en las cabeceras ("Contrato ✓", "% Empleabilidad").
         */
        public static String titulo(String texto) {
            if (texto == null) {
                return "";
            }
            return java.text.Normalizer.normalize(texto.trim(), java.text.Normalizer.Form.NFD)
                    .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                    .replaceAll("[^a-zA-Z0-9]", " ")
                    .toLowerCase(Locale.ROOT)
                    .replaceAll("\\s+", " ")
                    .trim();
        }
    }
}
