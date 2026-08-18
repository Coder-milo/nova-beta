package com.novacrm.excel;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Mapeo de columnas contra los encabezados reales de los archivos que usa
 * el programa: la BBDD cruda del formulario de admision y la Base Maestra de
 * empleabilidad.
 */
class MapeoColumnasRealesTest {

    /** Encabezados reales de "BBDD (107 participantes - Ruta Accelerator).xlsx". */
    private static final List<String> ENCABEZADOS_BBDD = List.of(
            "3.9 Correo electrónico",
            "3.1 Nombre (s)",
            "3.2 Apellido (s)",
            "3.3 Tipo de documento",
            "3.4 Número de documento",
            "3.6 Fecha de nacimiento",
            "3.7 Género",
            "3.8 Celular (WhatsApp activo)",
            "3.10 Ciudad de residencia",
            "3.11 Si marcó Otro, indique el Municipio o corregimiento:",
            "3.12 Barrio",
            "4.1 ¿Cuál es tu clasificación en SISBEN IV? \n  ",
            "4.2 Actualmente, ¿Cuál es tu situación laboral?",
            "4.3 ¿Cuánto tiempo de experiencia laboral tienes en total?  ",
            "4.4 ¿En cuál de los siguientes sectores tienes mayor experiencia laboral o formación principal? ",
            "4.5 Si tu respuesta fue \"Otro\", específica: ",
            "4.6 Si trabajas actualmente, ¿Cuál es tu ingreso mensual promedio?",
            "4.7 ¿Eres responsable económicamente de otras personas?",
            "5.1 Nivel educativo alcanzado",
            "5.2 Mencione el titulo obtenido,  certificaciones de educación para el trabajo o no formal. ",
            "5.3 ¿Has trabajado antes?",
            "5.4 Si respondiste “Sí”, describe brevemente tu experiencia laboral (cargo, sector y tiempo)",
            "6.1¿Cuál consideras que es tu nivel actual de inglés?",
            "7.1 ¿Cuál es tu principal motivación para aplicar a este programa?",
            "7.2 Disponibilidad de tiempo para asistir al proceso de capacitación:",
            "7.3 ¿Tienes computador funcional para clases virtuales?",
            "7.4 ¿Cuentas con conexión a internet estable?",
            "7.5  ¿En caso de no contar con un computador o presentar fallas técnicas, tiene acceso a un equipo prestado por alguna red de apoyo (familiares, amigos u otros)? ",
            "8.1 ¿En qué tipo de oportunidades laborales te gustaría trabajar?  ",
            "9.1 ¿Te interesaría migrar y trabajar en otro país si se presenta una oportunidad formal y acompañada?",
            "9.2 Si se presenta una oportunidad laboral en otro país (por ejemplo, Canadá), ¿estarías dispuesto(a) a asumir parcial o totalmente los gastos del proceso migratorio (trámites, pasaporte, exámenes, etc.)?",
            "10.1 ¿Autorizas el uso de tus datos para contacto, seguimiento y evaluación dentro del Prototipo NOVA?",
            "3.5 Nacionalidad",
            "2.1 ¿Autorizas a CAC Eurocentres, al uso de tus datos para los fines de contacto, seguimiento y evaluación dentro del programa Cuando sabes inglés se nota?  \n\nSi deseas conocer más sobre las políticas de tratamiento de datos de la entidad, puedes consultarlas en los enlaces a continuación: POLÍTICA DE SEGURIDAD Y TRATAMIENTO DE DATOS PERSONALES Y USO DE IMAGEN CAC-EUROCENTRES",
            "9.3 ¿Actualmente cuentas con núcleo familiar (pareja, hijos u otras personas a cargo) que debería migrar contigo en caso de acceder a una oportunidad laboral en otro país?",
            "9.4 ¿Cuentas actualmente con pasaporte vigente y en condiciones aptas para iniciar un proceso de movilidad laboral internacional?",
            "9.5 ¿Estarías dispuesto(a) a realizar los exámenes médicos requeridos para validar tu estado de salud, en el marco de un proceso de selección y vinculación laboral en el exterior?",
            "9.6  En relación con las oportunidades de colocación laboral, ¿cuál es tu preferencia principal? ",
            "4.9 ¿Tienes alguna discapacidad o condición física, sensorial o cognitiva que debamos considerar para brindarte un mejor acompañamiento?   ",
            "4.10 Si marcó otra, Indique cuál.",
            "4.8 ¿Tienes responsabilidades de cuidado de otras personas? (hijos, adultos mayores, personas con discapacidad, etc.)   \n\nResponda: SI, NO, y a quién cuida. Ej: Si, mamá.",
            "4.11 ¿Te identificas con algún grupo étnico o cultural?  ",
            "4.12 ¿Presentas alguna otra condición que pueda influir en tu acceso a oportunidades de formación o empleo?  ",
            "4.13 Si marcó SI, indique cuál.",
            "2.2  ¿Autorizas a Fundación Santo Domingo - FSD , al uso de tus datos para los fines de contacto, seguimiento y evaluación dentro del programa Cuando sabes inglés se nota?\nSi deseas conocer más sobre las políticas de tratamiento de datos de la entidad, puedes consultarlas en los enlaces a continuación:\nPOLITICA DE PROTECCIÓN DE DATOS PERSONALES FSD",
            "2.3 ¿Autorizas a Compartamos con Colombia - CCC, al uso de tus datos para los fines de contacto, seguimiento y evaluación dentro del programa Cuando sabes inglés se nota?  \nSi deseas conocer más sobre las políticas de tratamiento de datos de la entidad, puedes consultarlas en los enlaces a continuación:\nPOLÍTICA DE TRATAMIENTO DE INFORMACIÓN PERSONAL CCC",
            "Resultado Prueba Escrita",
            "Resultado Prueba oral");

    /** Encabezados reales de "Base_Maestra_Empleabilidad_Actualizada.xlsx". */
    private static final List<String> ENCABEZADOS_MAESTRA = List.of(
            "ID_Participante", "Nombre_Completo", "Documento", "Ciudad", "Celular", "Correo",
            "Nivel_Ingles", "Estado_Programa", "Condicion_Estudio", "Nivel_Educativo",
            "Programa_Academico", "Institucion_Educativa", "Area_Formacion", "Estado_Formacion",
            "Semestre_Actual", "Fecha_Estimada_Graduacion", "Tiene_Experiencia", "Anos_Experiencia",
            "Ultimo_Cargo", "Sector_Experiencia", "Perfil_Profesional_Sintesis", "Sector_Objetivo",
            "Cargo_Objetivo", "Disponibilidad_Laboral", "HV_Revisada", "LinkedIn_Optimizado",
            "Simulacro_Entrevista", "Postulaciones_Enviadas", "Empresas_Contactadas",
            "Estado_Busqueda");

    private ColumnMapper mapper;

    @BeforeEach
    void configurar() {
        mapper = new ColumnMapper();
        mapper.init();
    }

    private Map<String, String> mapear(List<String> encabezados, Map<String, String> overrides) {
        return mapper.buildColumnMap(encabezados, overrides);
    }

    /** Campos del formulario de admision sin los cuales el registro es inservible. */
    @Test
    void mapeaLosCamposEsencialesDelFormularioCrudo() {
        var resultado = mapear(ENCABEZADOS_BBDD, ExcelService.BBDD_COLUMNS);

        assertEquals("email", resultado.get("3.9 Correo electrónico"));
        assertEquals("nombre", resultado.get("3.1 Nombre (s)"));
        assertEquals("apellido", resultado.get("3.2 Apellido (s)"));
        assertEquals("numeroDocumento", resultado.get("3.4 Número de documento"));
        assertEquals("tipoDocumento", resultado.get("3.3 Tipo de documento"));
        assertEquals("celular", resultado.get("3.8 Celular (WhatsApp activo)"));
        assertEquals("ciudad", resultado.get("3.10 Ciudad de residencia"));
        assertEquals("genero", resultado.get("3.7 Género"));
        assertEquals("fechaNacimiento", resultado.get("3.6 Fecha de nacimiento"));
        assertEquals("nacionalidad", resultado.get("3.5 Nacionalidad"));
    }

    /** Campos de perfil y evaluacion que alimentan la HV y el matching. */
    @Test
    void mapeaLosCamposDePerfilDelFormularioCrudo() {
        var resultado = mapear(ENCABEZADOS_BBDD, ExcelService.BBDD_COLUMNS);

        assertEquals("nivelEducativo", resultado.get("5.1 Nivel educativo alcanzado"));
        assertEquals("nivelIngles", resultado.get("6.1¿Cuál consideras que es tu nivel actual de inglés?"));
        assertEquals("clasificacionSisben", resultado.get("4.1 ¿Cuál es tu clasificación en SISBEN IV? \n  "));
        assertEquals("situacionLaboral", resultado.get("4.2 Actualmente, ¿Cuál es tu situación laboral?"));
        assertEquals("aniosExperiencia", resultado.get("4.3 ¿Cuánto tiempo de experiencia laboral tienes en total?  "));
        assertEquals("disponibilidadMovilidad", resultado.get("9.4 ¿Cuentas actualmente con pasaporte vigente y en condiciones aptas para iniciar un proceso de movilidad laboral internacional?"));
        assertEquals("resultadoPruebaEscrita", resultado.get("Resultado Prueba Escrita"));
        assertEquals("resultadoPruebaOral", resultado.get("Resultado Prueba oral"));
    }

    /** La Base Maestra es la fuente de la HV y del estado de empleabilidad. */
    @Test
    void mapeaLosCamposDeLaBaseMaestra() {
        var resultado = mapear(ENCABEZADOS_MAESTRA, ExcelService.MAESTRA_COLUMNS);

        assertEquals("nombreCompleto", resultado.get("Nombre_Completo"));
        assertEquals("numeroDocumento", resultado.get("Documento"));
        assertEquals("email", resultado.get("Correo"));
        assertEquals("nivelIngles", resultado.get("Nivel_Ingles"));
        assertEquals("programaAcademico", resultado.get("Programa_Academico"));
        assertEquals("institucionEducativa", resultado.get("Institucion_Educativa"));
        assertEquals("areaFormacion", resultado.get("Area_Formacion"));
        assertEquals("estadoFormacion", resultado.get("Estado_Formacion"));
        assertEquals("haTrabajado", resultado.get("Tiene_Experiencia"));
        assertEquals("aniosExperiencia", resultado.get("Anos_Experiencia"));
        assertEquals("ultimoCargo", resultado.get("Ultimo_Cargo"));
        assertEquals("sectorExperiencia", resultado.get("Sector_Experiencia"));
        assertEquals("perfilProfesional", resultado.get("Perfil_Profesional_Sintesis"));
        assertEquals("sectorObjetivo", resultado.get("Sector_Objetivo"));
        assertEquals("cargoObjetivo", resultado.get("Cargo_Objetivo"));
        assertEquals("disponibilidadLaboral", resultado.get("Disponibilidad_Laboral"));
        assertEquals("cvListo", resultado.get("HV_Revisada"));
        assertEquals("linkedinOptimizado", resultado.get("LinkedIn_Optimizado"));
        assertEquals("postulacionesEnviadas", resultado.get("Postulaciones_Enviadas"));
        assertEquals("empresasContactadas", resultado.get("Empresas_Contactadas"));
        assertEquals("estadoBusqueda", resultado.get("Estado_Busqueda"));
    }

    /**
     * Las columnas de consentimiento y las de texto libre "Si marco otro..." no
     * deben caer por error en un campo del estudiante (falsos positivos).
     */
    @Test
    void noAsignaLasColumnasQueDebenIgnorarse() {
        var resultado = mapear(ENCABEZADOS_BBDD, ExcelService.BBDD_COLUMNS);

        String autorizacionNova =
                "10.1 ¿Autorizas el uso de tus datos para contacto, seguimiento y evaluación dentro del Prototipo NOVA?";
        assertNull(resultado.get(autorizacionNova),
                "la autorizacion de datos no es un campo del estudiante");
        assertNull(resultado.get("4.10 Si marcó otra, Indique cuál."),
                "los campos 'si marco otra' son texto libre auxiliar");
        assertNull(resultado.get("4.13 Si marcó SI, indique cuál."),
                "los campos 'si marco SI' son texto libre auxiliar");

        // Validar que las autorizaciones no se asignen a nivelIngles
        String authEurocentres = "2.1 ¿Autorizas a CAC Eurocentres, al uso de tus datos para los fines de contacto, seguimiento y evaluación dentro del programa Cuando sabes inglés se nota?  \n\nSi deseas conocer más sobre las políticas de tratamiento de datos de la entidad, puedes consultarlas en los enlaces a continuación: POLÍTICA DE SEGURIDAD Y TRATAMIENTO DE DATOS PERSONALES Y USO DE IMAGEN CAC-EUROCENTRES";
        String authFsd = "2.2  ¿Autorizas a Fundación Santo Domingo - FSD , al uso de tus datos para los fines de contacto, seguimiento y evaluación dentro del programa Cuando sabes inglés se nota?\nSi deseas conocer más sobre las políticas de tratamiento de datos de la entidad, puedes consultarlas en los enlaces a continuación:\nPOLITICA DE PROTECCIÓN DE DATOS PERSONALES FSD";
        String authCcc = "2.3 ¿Autorizas a Compartamos con Colombia - CCC, al uso de tus datos para los fines de contacto, seguimiento y evaluación dentro del programa Cuando sabes inglés se nota?  \nSi deseas conocer más sobre las políticas de tratamiento de datos de la entidad, puedes consultarlas en los enlaces a continuación:\nPOLÍTICA DE TRATAMIENTO DE INFORMACIÓN PERSONAL CCC";

        assertNull(resultado.get(authEurocentres), "consentimiento CAC Eurocentres debe ser null");
        assertNull(resultado.get(authFsd), "consentimiento FSD debe ser null");
        assertNull(resultado.get(authCcc), "consentimiento CCC debe ser null");

        // Validar que preguntas familiares/medicas no se asignen a disponibilidadLaboral
        String fam = "9.3 ¿Actualmente cuentas con núcleo familiar (pareja, hijos u otras personas a cargo) que debería migrar contigo en caso de acceder a una oportunidad laboral en otro país?";
        String med = "9.5 ¿Estarías dispuesto(a) a realizar los exámenes médicos requeridos para validar tu estado de salud, en el marco de un proceso de selección y vinculación laboral en el exterior?";
        assertNull(resultado.get(fam), "pregunta 9.3 no debe mapear a disponibilidadLaboral");
        assertNull(resultado.get(med), "pregunta 9.5 no debe mapear a disponibilidadLaboral");
    }

    /**
     * Diagnostico: deja constancia de que ninguna columna esencial queda sin
     * mapear. Si falla, el mensaje enumera exactamente cuales se perdieron.
     */
    @Test
    void ningunaColumnaEsencialQuedaSinMapear() {
        var bbdd = mapear(ENCABEZADOS_BBDD, ExcelService.BBDD_COLUMNS);
        var maestra = mapear(ENCABEZADOS_MAESTRA, ExcelService.MAESTRA_COLUMNS);

        var sinMapear = new TreeMap<String, String>();
        ExcelService.BBDD_COLUMNS.values().forEach(campo -> {
            if (!bbdd.containsValue(campo)) sinMapear.put("BBDD:" + campo, "no mapeado");
        });
        ExcelService.MAESTRA_COLUMNS.values().forEach(campo -> {
            if (!maestra.containsValue(campo)) sinMapear.put("MAESTRA:" + campo, "no mapeado");
        });

        assertTrue(sinMapear.isEmpty(),
                "campos declarados en los mapas que ningun encabezado real alcanza: " + sinMapear.keySet());
    }
}
