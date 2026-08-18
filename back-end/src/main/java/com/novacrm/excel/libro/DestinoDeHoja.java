package com.novacrm.excel.libro;

import java.util.*;

/**
 * A qué parte del sistema alimenta una hoja, y con qué vocabulario se reconoce.
 *
 * <p>Un libro de seguimiento trae hojas de cosas distintas —participantes,
 * empresas, postulaciones, colocaciones— más otras que no son datos que
 * importar (un tablero de indicadores, una hoja vacía que alguien dejó
 * preparada). Aquí vive lo que hace falta para distinguirlas: los títulos que
 * cada destino sabe leer y los que no puede faltarle.
 */
public enum DestinoDeHoja {

    /**
     * Participantes del programa.
     */
    PARTICIPANTES("Participantes", Set.of("nombreCompleto"), Map.ofEntries(
            Map.entry("n", "numeroParticipante"),
            Map.entry("no", "numeroParticipante"),
            Map.entry("num", "numeroParticipante"),
            Map.entry("n participante", "numeroParticipante"),
            Map.entry("numero de participante", "numeroParticipante"),
            Map.entry("id participante", "numeroParticipante"),
            Map.entry("id_participante", "numeroParticipante"),
            Map.entry("nombre completo", "nombreCompleto"),
            Map.entry("nombre y apellidos", "nombreCompleto"),
            Map.entry("nombre_completo", "nombreCompleto"),
            Map.entry("participante", "nombreCompleto"),
            Map.entry("3.1 nombre s", "nombre"),
            Map.entry("3.1 nombres", "nombre"),
            Map.entry("nombre", "nombre"),
            Map.entry("nombres", "nombre"),
            Map.entry("3.2 apellido s", "apellido"),
            Map.entry("3.2 apellidos", "apellido"),
            Map.entry("apellido", "apellido"),
            Map.entry("apellidos", "apellido"),
            Map.entry("edad", "edad"),
            Map.entry("genero", "genero"),
            Map.entry("sexo", "genero"),
            Map.entry("3.7 genero", "genero"),
            Map.entry("nacionalidad", "nacionalidad"),
            Map.entry("3.5 nacionalidad", "nacionalidad"),
            Map.entry("nivel educativo", "nivelEducativo"),
            Map.entry("nivel_educativo", "nivelEducativo"),
            Map.entry("5.1 nivel educativo alcanzado", "nivelEducativo"),
            Map.entry("carrera titulo", "areaFormacion"),
            Map.entry("carrera / titulo", "areaFormacion"),
            Map.entry("carrera", "areaFormacion"),
            Map.entry("titulo", "areaFormacion"),
            Map.entry("area de formacion", "areaFormacion"),
            Map.entry("area_formacion", "areaFormacion"),
            Map.entry("programa academico", "programaAcademico"),
            Map.entry("programa_academico", "programaAcademico"),
            Map.entry("institucion educativa", "institucionEducativa"),
            Map.entry("institucion_educativa", "institucionEducativa"),
            Map.entry("estado formacion", "estadoFormacion"),
            Map.entry("estado_formacion", "estadoFormacion"),
            Map.entry("condicion estudio", "estadoFormacion"),
            Map.entry("condicion_estudio", "estadoFormacion"),
            Map.entry("tiempo de experiencia", "tiempoExperiencia"),
            Map.entry("tiempo experiencia", "tiempoExperiencia"),
            Map.entry("anos experiencia", "tiempoExperiencia"),
            Map.entry("anos_experiencia", "tiempoExperiencia"),
            Map.entry("anios experiencia", "tiempoExperiencia"),
            Map.entry("experiencia", "tiempoExperiencia"),
            Map.entry("4.3 cuanto tiempo de experiencia laboral tienes en total", "tiempoExperiencia"),
            Map.entry("tiene experiencia", "haTrabajado"),
            Map.entry("tiene_experiencia", "haTrabajado"),
            Map.entry("ha trabajado", "haTrabajado"),
            Map.entry("5.3 has trabajado antes", "haTrabajado"),
            Map.entry("ultimo cargo", "ultimoCargo"),
            Map.entry("ultimo_cargo", "ultimoCargo"),
            Map.entry("perfil profesional", "perfilProfesional"),
            Map.entry("perfil_profesional_sintesis", "perfilProfesional"),
            Map.entry("perfil_profesional", "perfilProfesional"),
            Map.entry("5.4 describe brevemente tu experiencia laboral", "perfilProfesional"),
            Map.entry("sector area", "sectorExperiencia"),
            Map.entry("sector experiencia", "sectorExperiencia"),
            Map.entry("sector_experiencia", "sectorExperiencia"),
            Map.entry("4.4 en cual de los siguientes sectores tienes mayor experiencia laboral o formacion principal", "sectorExperiencia"),
            Map.entry("nivel de ingles", "nivelIngles"),
            Map.entry("nivel ingles", "nivelIngles"),
            Map.entry("nivel_ingles", "nivelIngles"),
            Map.entry("6.1 cual consideras que es tu nivel actual de ingles", "nivelIngles"),
            Map.entry("cv listo", "cvListo"),
            Map.entry("hoja de vida lista", "cvListo"),
            Map.entry("hv revisada", "cvListo"),
            Map.entry("hv_revisada", "cvListo"),
            Map.entry("cv en ingles", "cvEnIngles"),
            Map.entry("hoja de vida en ingles", "cvEnIngles"),
            Map.entry("linkedin creado", "linkedinCreado"),
            Map.entry("linkedin optimizado", "linkedinOptimizado"),
            Map.entry("linkedin_optimizado", "linkedinOptimizado"),
            Map.entry("perfil ocupacional", "perfilOcupacional"),
            Map.entry("estado de empleabilidad", "estadoEmpleabilidad"),
            Map.entry("estado empleabilidad", "estadoEmpleabilidad"),
            Map.entry("cargos que puede aplicar", "cargoObjetivo"),
            Map.entry("cargos aplicables", "cargoObjetivo"),
            Map.entry("cargo objetivo", "cargoObjetivo"),
            Map.entry("cargo_objetivo", "cargoObjetivo"),
            Map.entry("sector objetivo", "sectorObjetivo"),
            Map.entry("sector_objetivo", "sectorObjetivo"),
            Map.entry("disponibilidad laboral", "disponibilidadLaboral"),
            Map.entry("disponibilidad_laboral", "disponibilidadLaboral"),
            Map.entry("estado busqueda", "estadoBusqueda"),
            Map.entry("estado_busqueda", "estadoBusqueda"),
            Map.entry("postulaciones enviadas", "postulacionesEnviadas"),
            Map.entry("postulaciones_enviadas", "postulacionesEnviadas"),
            Map.entry("empresas contactadas", "empresasContactadas"),
            Map.entry("empresas_contactadas", "empresasContactadas"),
            Map.entry("estado programa", "estadoPrograma"),
            Map.entry("estado_programa", "estadoPrograma"),
            Map.entry("habilidades tecnicas", "competencias"),
            Map.entry("competencias", "competencias"),
            Map.entry("link carpeta", "carpetaUrl"),
            Map.entry("carpeta", "carpetaUrl"),
            Map.entry("link linkdln", "linkedinUrl"),
            Map.entry("link linkedin", "linkedinUrl"),
            Map.entry("linkedin", "linkedinUrl"),
            Map.entry("3.9 correo electronico", "email"),
            Map.entry("correo", "email"),
            Map.entry("correo electronico", "email"),
            Map.entry("email", "email"),
            Map.entry("3.4 numero de documento", "numeroDocumento"),
            Map.entry("numero de documento", "numeroDocumento"),
            Map.entry("numero documento", "numeroDocumento"),
            Map.entry("documento", "numeroDocumento"),
            Map.entry("cedula", "numeroDocumento"),
            Map.entry("3.3 tipo de documento", "tipoDocumento"),
            Map.entry("tipo documento", "tipoDocumento"),
            Map.entry("3.8 celular whatsapp activo", "celular"),
            Map.entry("celular", "celular"),
            Map.entry("telefono", "telefono"),
            Map.entry("3.10 ciudad de residencia", "ciudad"),
            Map.entry("ciudad", "ciudad"),
            Map.entry("3.12 barrio", "barrio"),
            Map.entry("barrio", "barrio"),
            Map.entry("3.6 fecha de nacimiento", "fechaNacimiento"),
            Map.entry("fecha nacimiento", "fechaNacimiento"),
            Map.entry("4.1 cual es tu clasificacion en sisben iv", "clasificacionSisben"),
            Map.entry("clasificacion sisben", "clasificacionSisben"),
            Map.entry("4.2 actualmente cual es tu situacion laboral", "situacionLaboral"),
            Map.entry("situacion laboral", "situacionLaboral"),
            Map.entry("4.6 si trabajas actualmente cual es tu ingreso", "ingresoMensual"),
            Map.entry("ingreso mensual", "ingresoMensual"),
            Map.entry("4.7 eres responsable economicamente de otros", "responsableEconomico"),
            Map.entry("responsable economico", "responsableEconomico"),
            Map.entry("7.1 cual es tu principal motivacion", "motivacion"),
            Map.entry("motivacion", "motivacion"),
            Map.entry("7.3 tienes computador funcional", "tieneComputador"),
            Map.entry("tiene computador", "tieneComputador"),
            Map.entry("7.4 cuentas con conexion a internet estable", "tieneInternet"),
            Map.entry("tiene internet", "tieneInternet"),
            Map.entry("9.1 te interesaria migrar a otro pais", "interesMigratorio"),
            Map.entry("interes migratorio", "interesMigratorio"),
            Map.entry("9.4 cuentas actualmente con pasaporte vigente", "disponibilidadMovilidad"),
            Map.entry("disponibilidad movilidad", "disponibilidadMovilidad"),
            Map.entry("resultado prueba escrita", "resultadoPruebaEscrita"),
            Map.entry("resultado prueba oral", "resultadoPruebaOral"),
            Map.entry("empresas que puede aplicar", "observaciones"),
            Map.entry("empresas a las que aplica", "observaciones"),
            Map.entry("empresas objetivo", "observaciones"),
            Map.entry("empresas de interes", "observaciones"),
            Map.entry("empresas bilingues en barranquilla", "observaciones"),
            Map.entry("porcentaje empleabilidad", "observaciones"),
            Map.entry("empleabilidad", "observaciones"),
            Map.entry("observaciones", "observaciones"))),

    /** Directorio de empresas y su estado de relación con el programa. */
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
            Map.entry("canal de postulacion", "canalPostulacion"),
            Map.entry("nombres participantes", "notas"),
            Map.entry("participantes enviados", "notas"),
            Map.entry("respuestas recibidas", "notas"),
            Map.entry("contratados", "notas"))),

    /** Una fila por postulación enviada. */
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
            Map.entry("sector area", "observaciones"),
            Map.entry("sector / area", "observaciones"),
            Map.entry("nivel ingles", "observaciones"),
            Map.entry("porcentaje empleabilidad", "observaciones"),
            Map.entry("diferencia vs meta", "observaciones"),
            Map.entry("estado checklist", "observaciones"),
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

    /** Verifica qué campos obligatorios faltan considerando nombres compuestos o alternativos. */
    public List<String> camposFaltantes(Map<Integer, String> mapeo) {
        var campos = new HashSet<>(mapeo.values());
        return switch (this) {
            case PARTICIPANTES -> {
                boolean tieneIdentificador = campos.contains("nombreCompleto")
                        || (campos.contains("nombre") && campos.contains("apellido"))
                        || campos.contains("email")
                        || campos.contains("numeroDocumento");
                yield tieneIdentificador ? List.of() : List.of("nombreCompleto");
            }
            case EMPRESAS -> campos.contains("nombre") ? List.of() : List.of("nombre");
            case POSTULACIONES -> {
                var faltan = new ArrayList<String>();
                if (!campos.contains("nombreCompleto") && (!campos.contains("nombre") || !campos.contains("apellido"))) {
                    faltan.add("nombreCompleto");
                }
                if (!campos.contains("empresaNombre")) {
                    faltan.add("empresaNombre");
                }
                yield faltan;
            }
            case COLOCACIONES -> campos.contains("empresaNombre") ? List.of() : List.of("empresaNombre");
        };
    }

    /** Campo del sistema al que corresponde un título, o {@code null}. */
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
     * Mapea los títulos de una cabecera a campos del sistema.
     *
     * <p>Si dos columnas apuntan al mismo campo gana la primera.
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

    /** Normalización compartida de títulos de columna. */
    public static final class Normalizacion {

        private Normalizacion() {
        }

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
