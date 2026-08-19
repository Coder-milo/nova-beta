package com.novacrm.hv;

import com.novacrm.exception.BusinessException;
import com.novacrm.hv.dto.DatosHvDto;
import com.novacrm.hv.dto.ExperienciaDto;
import com.novacrm.hv.dto.FormacionDto;
import com.novacrm.ia.ProveedorIa;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extrae campos de una hoja de vida en PDF mediante heurísticas avanzadas por bloques de sección,
 * filtrando metadatos irrelevantes (referencias, cédulas, expediciones) y construyendo una estructura
 * DatosHvDto optimizada para alimentar directamente la plantilla CAC ATS.
 *
 * <p>Con la IA configurada se le pide el mismo {@link DatosHvDto} al modelo: si responde algo
 * parseable y con datos, se usa; si no, las heurísticas de abajo siguen mandando. La IA es un
 * refuerzo, no una dependencia.
 */
@Service
public class ExtraccionHvService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ExtraccionHvService.class);

    public record CampoExtraido(String campo, String valor, int confianza) {}
    public record ResultadoExtraccion(List<CampoExtraido> campos, String textoCompleto, DatosHvDto datosEstructurados) {}

    private static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
    private static final Pattern CELULAR = Pattern.compile("(?<!\\d)3\\d{9}(?!\\d)");
    private static final Pattern DOCUMENTO = Pattern.compile("(?:C\\.?C\\.?|c[eé]dula|documento)[^\\d]{0,15}(\\d{6,11})", Pattern.CASE_INSENSITIVE);
    private static final Pattern DOCUMENTO_SUELTO = Pattern.compile("(?<!\\d)(\\d{7,10})(?!\\d)");
    private static final Pattern LINKEDIN = Pattern.compile("(?i)(?:https?://)?(?:www\\.)?linkedin\\.com/in/([a-zA-Z0-9_-]+)");
    private static final Pattern GITHUB = Pattern.compile("(?i)(?:https?://)?(?:www\\.)?github\\.com/([a-zA-Z0-9_-]+)");

    private static final String INSTRUCCIONES_IA = """
            Extraes datos de hojas de vida en espanol o ingles para un CRM de empleabilidad.
            Respondes SOLO con JSON, sin texto fuera del JSON.
            Usa null para los campos que no aparezcan; no inventes valores.
            El JSON debe encajar exactamente en esta estructura:
            {"nombre": string|null, "apellido": string|null, "cargoObjetivo": string|null,
             "email": string|null, "celular": string|null, "ciudad": string|null,
             "linkedinUserId": string|null, "perfilProfesional": string|null,
             "competencias": string|null, "idiomas": string|null,
             "titulo": string|null, "institucionEducativa": string|null, "nivelEducativo": string|null,
             "experiencias": [{"cargo": string, "empresa": string, "fechaInicio": string|null,
                               "fechaFin": string|null, "actual": boolean, "funciones": string|null}],
             "formaciones": [{"tipo": string, "programa": string, "institucion": string|null, "anio": string|null}]}
            """;

    // Regex estricto para años válidos (1970 - 2029) aislados de números largos (cédulas o teléfonos)
    private static final Pattern ANIO_ISOLADO = Pattern.compile("(?<!\\d)(19[7-9]\\d|20[0-2]\\d)(?!\\d)");

    private static final List<String> CIUDADES = List.of(
            "Soledad", "Malambo", "Puerto Colombia", "Galapa", "Barranquilla", "Atlántico", "Atlantico",
            "Bogotá", "Bogota", "Medellín", "Medellin", "Cali", "Cartagena",
            "Bucaramanga", "Pereira", "Manizales", "Cúcuta", "Cucuta", "Villavicencio",
            "Ibagué", "Ibague", "Santa Marta", "Montería", "Monteria", "Neiva", "Pasto", "Armenia",
            "Sincelejo", "Valledupar", "Popayán", "Popayan", "Tunja", "Riohacha", "Florencia", "Yopal", "Quibdó", "Quibdo");

    private record SeccionHeaderConfig(String tipo, List<String> palabrasClave) {}

    // Incluimos secciones de detención (DATOS_PERSONALES, REFERENCIAS) para evitar que contaminen Perfil/Educación/Experiencia
    private static final List<SeccionHeaderConfig> SECCIONES_CONFIG = List.of(
            new SeccionHeaderConfig("DATOS_PERSONALES", List.of("i. datos personales", "datos personales", "información personal", "informacion personal", "personal info", "personal details", "contact info", "contact details", "contacto", "contact")),
            new SeccionHeaderConfig("PERFIL", List.of("perfil profesional", "perfil laboral", "perfil ocupacional", "perfil", "resumen profesional", "resumen laboral", "resumen", "acerca de mí", "acerca de mi", "acerca de", "summary", "professional summary", "about me", "profile", "career objective")),
            new SeccionHeaderConfig("EXPERIENCIA", List.of("experiencia laboral", "experiencia profesional", "experiencia", "professional experience", "work experience", "employment history", "employment", "trayectoria laboral", "historial laboral", "relevant experience")),
            new SeccionHeaderConfig("EDUCACION", List.of("educación académica", "educacion academica", "educación", "educacion", "formación académica", "formacion academica", "formación", "formacion", "estudios", "education", "academic background", "academic history")),
            new SeccionHeaderConfig("CERTIFICACIONES", List.of("certificaciones", "certificados", "cursos", "formación adicional", "formacion adicional", "formación continua", "formacion continua", "certifications", "courses", "diplomados", "trainings", "training")),
            new SeccionHeaderConfig("COMPETENCIAS", List.of("habilidades técnicas", "habilidades tecnicas", "habilidades blandas", "habilidades", "competencias técnicas", "competencias tecnicas", "competencias", "technical skills", "technical skill", "skills", "tech stack", "herramientas", "stack tecnologico", "stack tecnológico", "tecnologias", "tecnologías", "conocimientos", "programming languages", "lenguajes de programación")),
            new SeccionHeaderConfig("IDIOMAS", List.of("idiomas", "languages", "language proficiency")),
            new SeccionHeaderConfig("REFERENCIAS", List.of("ii. referencias familiares", "iii. referencias personales", "referencias familiares", "referencias personales", "referencias laborales", "referencias comerciales", "referencias", "references")),
            new SeccionHeaderConfig("INFORMACION_ADICIONAL", List.of("información adicional", "informacion adicional", "additional information", "intereses", "interests"))
    );

    private final ProveedorIa proveedorIa;

    public ExtraccionHvService() {
        this(null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ExtraccionHvService(ProveedorIa proveedorIa) {
        this.proveedorIa = proveedorIa;
    }

    public ResultadoExtraccion extraer(MultipartFile archivo) {
        String texto = extraerTexto(archivo);
        String textoRecortado = texto.length() > 8000 ? texto.substring(0, 8000) : texto;

        var conIa = extraerConIa(textoRecortado);
        if (conIa != null) {
            return new ResultadoExtraccion(camposDesde(conIa), textoRecortado, conIa);
        }

        var campos = new ArrayList<CampoExtraido>();

        // 1. Campos planos en el encabezado
        String emailVal = null;
        var mEmail = EMAIL.matcher(texto);
        if (mEmail.find()) {
            emailVal = mEmail.group().toLowerCase();
            campos.add(new CampoExtraido("email", emailVal, 95));
        }

        String celularVal = null;
        var mCel = CELULAR.matcher(texto);
        if (mCel.find()) {
            celularVal = mCel.group();
            campos.add(new CampoExtraido("celular", celularVal, 85));
        }

        String docVal = null;
        var mDoc = DOCUMENTO.matcher(texto);
        if (mDoc.find()) {
            docVal = mDoc.group(1);
            campos.add(new CampoExtraido("numeroDocumento", docVal, 85));
        } else {
            var mDocSuelto = DOCUMENTO_SUELTO.matcher(texto);
            while (mDocSuelto.find()) {
                String candidato = mDocSuelto.group(1);
                if (candidato.equals(celularVal)) continue;
                docVal = candidato;
                campos.add(new CampoExtraido("numeroDocumento", docVal, 45));
                break;
            }
        }

        String ciudadVal = null;
        for (var ciudad : CIUDADES) {
            Pattern p = Pattern.compile("(?i)\\b" + Pattern.quote(ciudad) + "\\b");
            if (p.matcher(texto).find()) {
                ciudadVal = normalizarCiudad(ciudad);
                campos.add(new CampoExtraido("ciudad", ciudadVal, 70));
                break;
            }
        }

        String linkedinVal = null;
        String linkedinUrlVal = null;
        var mLi = LINKEDIN.matcher(texto);
        if (mLi.find()) {
            linkedinVal = mLi.group(1);
            linkedinUrlVal = mLi.group();
            campos.add(new CampoExtraido("linkedinUserId", linkedinVal, 90));
        }

        String githubUrlVal = null;
        var mGh = GITHUB.matcher(texto);
        if (mGh.find()) {
            githubUrlVal = mGh.group();
        }

        String nombreVal = null;
        String apellidoVal = null;
        String nombreDetectado = detectarNombre(texto);
        if (nombreDetectado != null) {
            var palabras = nombreDetectado.trim().split("\\s+");
            if (palabras.length == 4) {
                nombreVal = palabras[0] + " " + palabras[1];
                apellidoVal = palabras[2] + " " + palabras[3];
                campos.add(new CampoExtraido("nombre", nombreVal, 60));
                campos.add(new CampoExtraido("apellido", apellidoVal, 60));
            } else if (palabras.length == 3) {
                nombreVal = palabras[0] + " " + palabras[1];
                apellidoVal = palabras[2];
                campos.add(new CampoExtraido("nombre", nombreVal, 55));
                campos.add(new CampoExtraido("apellido", apellidoVal, 55));
            } else if (palabras.length == 2) {
                nombreVal = palabras[0];
                apellidoVal = palabras[1];
                campos.add(new CampoExtraido("nombre", nombreVal, 55));
                campos.add(new CampoExtraido("apellido", apellidoVal, 55));
            } else {
                nombreVal = nombreDetectado;
                campos.add(new CampoExtraido("nombre", nombreVal, 40));
            }
        }

        String cargoObjetivoVal = detectarCargoObjetivo(texto, nombreDetectado);
        if (cargoObjetivoVal != null) {
            campos.add(new CampoExtraido("cargoObjetivo", cargoObjetivoVal, 60));
        }

        // 2. Segmentar el documento en bloques por posición exacta de encabezados
        Map<String, String> bloques = segmentarTextoPorSecciones(texto);

        // Perfil profesional
        String perfilVal = limpiarTextoPerfil(bloques.get("PERFIL"));
        if (perfilVal != null && !perfilVal.isBlank()) {
            campos.add(new CampoExtraido("perfilProfesional", perfilVal, 60));
        }

        // Experiencias laborales
        List<ExperienciaDto> experiencias = parseExperienciasDelBloque(bloques.get("EXPERIENCIA"));

        // Educación & Certificaciones
        List<FormacionDto> formaciones = new ArrayList<>();
        formaciones.addAll(parseEducacionDelBloque(bloques.get("EDUCACION")));
        formaciones.addAll(parseCertificacionesDelBloque(bloques.get("CERTIFICACIONES")));

        // Competencias
        String competenciasVal = limpiarTextoCompetencias(bloques.get("COMPETENCIAS"));
        if (competenciasVal != null && !competenciasVal.isBlank()) {
            campos.add(new CampoExtraido("competencias", competenciasVal, 65));
        }

        // Idiomas
        String idiomasVal = bloques.get("IDIOMAS");
        if (idiomasVal == null || idiomasVal.isBlank()) {
            String adicional = bloques.get("INFORMACION_ADICIONAL");
            if (adicional != null && !adicional.isBlank()) {
                var mIdiomas = Pattern.compile("(?i)(?:languages?|idiomas?):?\\s*([^\\n]+(?:\\n\\s*[^\\n]+)?)").matcher(adicional);
                if (mIdiomas.find()) {
                    idiomasVal = mIdiomas.group(1).replaceAll("^[•\\-*▪\\s]+", "").replaceAll("\\n+", ", ").trim();
                }
            }
        }
        if (idiomasVal != null && !idiomasVal.isBlank()) {
            campos.add(new CampoExtraido("idiomas", idiomasVal, 70));
        }

        // Título / Institución principal para Educación
        String tituloVal = null;
        String institucionVal = null;
        var eduItem = formaciones.stream().filter(f -> "EDUCACION".equalsIgnoreCase(f.tipo())).findFirst();
        if (eduItem.isPresent()) {
            tituloVal = eduItem.get().programa();
            institucionVal = eduItem.get().institucion();
        }

        String portafolioOEnlace = githubUrlVal != null ? githubUrlVal : linkedinUrlVal;

        DatosHvDto datosEstructurados = new DatosHvDto(
                nombreVal,
                apellidoVal,
                cargoObjetivoVal,
                emailVal,
                celularVal,
                ciudadVal,
                linkedinVal,
                perfilVal,
                competenciasVal,
                idiomasVal,
                tituloVal,
                institucionVal,
                null,
                experiencias,
                formaciones,
                null,
                null,
                linkedinUrlVal != null ? linkedinUrlVal : portafolioOEnlace,
                null,
                null,
                null
        );

        return new ResultadoExtraccion(campos, textoRecortado, datosEstructurados);
    }

    /**
     * Pide el {@link DatosHvDto} al modelo. Se acepta la respuesta solo si
     * parsea contra el DTO y trae al menos un dato de contacto o de nombre;
     * un JSON vacío o ilegible devuelve {@code null} y se sigue con las heurísticas.
     */
    private DatosHvDto extraerConIa(String texto) {
        if (proveedorIa == null || !proveedorIa.disponible()) {
            log.info("Extracción de HV con IA omitida: Proveedor de IA no disponible o no configurado.");
            return null;
        }
        log.info("Enviando texto de HV a proveedor de IA '{}' ({} caracteres) para extracción estructurada...", proveedorIa.nombre(), texto.length());
        String contenido = """
                Hoja de vida (texto extraido del PDF):
                %s
                """.formatted(texto.length() > 8000 ? texto.substring(0, 8000) : texto);

        var resultado = proveedorIa.completarJson(INSTRUCCIONES_IA, contenido)
                .flatMap(this::aDatosHv)
                .orElse(null);

        if (resultado != null) {
            log.info("Extracción de HV completada con éxito mediante proveedor de IA '{}'.", proveedorIa.nombre());
        } else {
            log.warn("El proveedor de IA no devolvió datos estructurados válidos de la HV. Ejecutando fallback de heurísticas regex.");
        }

        return resultado;
    }

    private Optional<DatosHvDto> aDatosHv(com.fasterxml.jackson.databind.JsonNode json) {
        try {
            var datos = new com.fasterxml.jackson.databind.ObjectMapper()
                    .treeToValue(json, DatosHvDto.class);
            if (datos.nombre() == null && datos.apellido() == null
                    && datos.email() == null && datos.celular() == null) {
                log.warn("El JSON devuelto por Groq no contiene identificador básico (nombre, apellido, email ni celular).");
                return Optional.empty();
            }
            return Optional.of(datos);
        } catch (Exception e) {
            log.warn("Error al mapear la respuesta JSON de Groq a DatosHvDto: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private static List<CampoExtraido> camposDesde(DatosHvDto d) {
        var campos = new ArrayList<CampoExtraido>();
        if (d.nombre() != null) campos.add(new CampoExtraido("nombre", d.nombre(), 90));
        if (d.apellido() != null) campos.add(new CampoExtraido("apellido", d.apellido(), 90));
        if (d.cargoObjetivo() != null) campos.add(new CampoExtraido("cargoObjetivo", d.cargoObjetivo(), 90));
        if (d.email() != null) campos.add(new CampoExtraido("email", d.email(), 90));
        if (d.celular() != null) campos.add(new CampoExtraido("celular", d.celular(), 90));
        if (d.ciudad() != null) campos.add(new CampoExtraido("ciudad", d.ciudad(), 90));
        if (d.perfilProfesional() != null) campos.add(new CampoExtraido("perfilProfesional", d.perfilProfesional(), 90));
        if (d.competencias() != null) campos.add(new CampoExtraido("competencias", d.competencias(), 90));
        if (d.idiomas() != null) campos.add(new CampoExtraido("idiomas", d.idiomas(), 90));
        return campos;
    }

    private String extraerTexto(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) throw new BusinessException("El archivo PDF es obligatorio");
        try (PDDocument doc = PDDocument.load(archivo.getInputStream())) {
            var stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            String texto = stripper.getText(doc);
            if (texto == null || texto.isBlank()) {
                throw new BusinessException("El PDF no contiene texto extraíble (puede ser un escaneo). Usa un PDF con texto.");
            }
            return texto;
        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            throw new BusinessException("No se pudo leer el PDF: " + e.getMessage());
        }
    }

    private record SeccionIndex(String tipo, int posInicio, int posTexto) {}

    /**
     * Parte la hoja en bloques por sus encabezados.
     *
     * <p><strong>Un encabezado es una linea, no una palabra suelta.</strong>
     * Antes se buscaba la primera aparicion del texto en todo el documento con
     * {@code indexOf}, y las palabras de los encabezados son las mismas que
     * usa cualquiera al escribir: un perfil que dice «con mas de cinco años de
     * <em>experiencia</em> en servicio al cliente» abria ahi el bloque de
     * EXPERIENCIA, de modo que el perfil se cortaba a la mitad y la experiencia
     * laboral empezaba dentro de una frase. Lo mismo con «educacion» o
     * «habilidades» citadas de pasada. Ese es el desajuste que arrastraba todo
     * el mapeo hacia abajo.
     *
     * <p>Ahora una linea es encabezado solo si <em>es</em> el encabezado: la
     * palabra clave ocupa la linea entera, salvo signos de puntuacion, la
     * numeracion romana o arabiga de delante y las viñetas. Se admite ademas la
     * linea en mayusculas que sigue con contenido detras —«PERFIL PROFESIONAL
     * Soy…», que es como sale de algunos PDF—, y en ese caso lo que va despues
     * ya cuenta como contenido del bloque.
     */
    private static Map<String, String> segmentarTextoPorSecciones(String texto) {
        List<SeccionIndex> encontradas = new ArrayList<>();
        Set<String> yaVistas = new HashSet<>();

        int posLinea = 0;
        for (String linea : texto.split("\n", -1)) {
            int longitudLinea = linea.length();
            var marca = encabezadoDe(linea);
            if (marca != null && yaVistas.add(marca.tipo())) {
                encontradas.add(new SeccionIndex(
                        marca.tipo(),
                        posLinea,
                        posLinea + marca.finDelEncabezado()));
            }
            posLinea += longitudLinea + 1; // el \n que se comio el split
        }

        encontradas.sort(Comparator.comparingInt(SeccionIndex::posInicio));

        Map<String, String> resultado = new HashMap<>();
        for (int i = 0; i < encontradas.size(); i++) {
            var actual = encontradas.get(i);
            int fin = (i + 1 < encontradas.size()) ? encontradas.get(i + 1).posInicio() : texto.length();
            if (fin < actual.posTexto()) continue;
            resultado.put(actual.tipo(), texto.substring(actual.posTexto(), fin).trim());
        }

        return resultado;
    }

    private record MarcaEncabezado(String tipo, int finDelEncabezado) {}

    /** El encabezado que es esta linea, o {@code null} si es contenido. */
    private static MarcaEncabezado encabezadoDe(String linea) {
        String limpia = linea.strip();
        if (limpia.isEmpty()) return null;

        // La numeracion y las viñetas de delante no son parte del nombre:
        // «I. DATOS PERSONALES», «2) EXPERIENCIA», «• Idiomas».
        int desplazamiento = linea.indexOf(limpia.charAt(0));
        String sinPrefijo = limpia.replaceFirst("^(?:[•\\-*▪>]+\\s*)?(?:(?:[ivx]+|\\d{1,2})[.)]\\s*)?", "");
        desplazamiento += limpia.length() - sinPrefijo.length();

        String lower = sinPrefijo.toLowerCase();
        boolean enMayusculas = sinPrefijo.equals(sinPrefijo.toUpperCase());

        MarcaEncabezado mejor = null;
        int largoDeLaMejor = -1;
        for (var conf : SECCIONES_CONFIG) {
            for (String kw : conf.palabrasClave()) {
                if (!lower.startsWith(kw)) continue;
                String resto = sinPrefijo.substring(kw.length());
                String restoLimpio = resto.replaceFirst("^[\\s:.\\-–—|]+", "");
                boolean ocupaLaLinea = restoLimpio.isEmpty();
                if (!ocupaLaLinea && !enMayusculas) continue;

                int fin = desplazamiento + kw.length() + (resto.length() - restoLimpio.length());
                // Entre varias claves que encajan gana la mas larga: «experiencia
                // laboral» describe mejor la linea que «experiencia», y
                // «referencias personales» no es la seccion «perfil».
                if (kw.length() > largoDeLaMejor) {
                    mejor = new MarcaEncabezado(conf.tipo(), fin);
                    largoDeLaMejor = kw.length();
                }
                break;
            }
        }
        return mejor;
    }

    private static String normalizarCiudad(String ciudad) {
        return switch (ciudad) {
            case "Bogota" -> "Bogotá";
            case "Medellin" -> "Medellín";
            case "Cucuta" -> "Cúcuta";
            case "Ibague" -> "Ibagué";
            case "Monteria" -> "Montería";
            default -> ciudad;
        };
    }

    private static String detectarNombre(String texto) {
        var lineas = texto.lines().map(String::trim).filter(l -> !l.isBlank()).limit(8).toList();
        for (var linea : lineas) {
            String lower = linea.toLowerCase();
            if (linea.length() >= 5 && linea.length() <= 60
                    && !linea.contains("@") && !linea.matches(".*\\d.*")
                    && !linea.contains("http") && !linea.contains(".com")
                    && linea.split("\\s+").length >= 2 && linea.split("\\s+").length <= 6
                    && (Character.isUpperCase(linea.charAt(0)) || linea.equals(linea.toUpperCase()))
                    && !lower.contains("hoja de vida")
                    && !lower.contains("curriculum")
                    && !lower.contains("datos personales")
                    && !lower.contains("informacion")
                    && !lower.contains("summary")
                    && !lower.contains("perfil")) {
                return aTitleCase(linea);
            }
        }
        return null;
    }

    private static String aTitleCase(String texto) {
        if (texto == null || texto.isBlank()) return texto;
        String[] palabras = texto.toLowerCase().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < palabras.length; i++) {
            String p = palabras[i];
            if (p.isBlank()) continue;
            if (sb.length() > 0) sb.append(" ");
            sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1));
        }
        return sb.toString();
    }

    private static String detectarCargoObjetivo(String texto, String nombreDetectado) {
        var lineas = texto.lines().map(String::trim).filter(l -> !l.isBlank()).limit(12).toList();
        boolean trasNombre = false;
        for (var linea : lineas) {
            if (nombreDetectado != null && (linea.equalsIgnoreCase(nombreDetectado)
                    || normalizarCiudad(linea).equalsIgnoreCase(normalizarCiudad(nombreDetectado)))) {
                trasNombre = true;
                continue;
            }
            String lower = linea.toLowerCase();
            boolean esEncabezadoNoCargo = lower.matches("^(i|ii|iii|iv|v|vi|1|2|3)\\.\\s*.*")
                    || lower.contains("datos personales")
                    || lower.contains("información personal")
                    || lower.contains("informacion personal")
                    || lower.contains("perfil")
                    || lower.contains("summary")
                    || lower.contains("referencias")
                    || lower.contains("contacto")
                    || lower.contains("cédula")
                    || lower.contains("cedula")
                    || lower.contains("documento")
                    || lower.contains("hoja de vida")
                    || lower.contains("@")
                    || lower.contains("http")
                    || esDireccionOCiudad(lower);

            if (!esEncabezadoNoCargo && linea.length() >= 4 && linea.length() <= 50
                    && !linea.contains("@") && !linea.matches(".*\\d.*")) {
                return aTitleCase(linea);
            }
        }
        return null;
    }

    /** Una direccion o el nombre pelado de una ciudad, que no es un cargo. */
    private static boolean esDireccionOCiudad(String lower) {
        if (lower.matches("^(calle|carrera|cra\\.?|cll\\.?|kr\\.?|kra\\.?|av\\.?|avenida|diagonal|dg\\.?|transversal|tv\\.?|manzana|mz\\.?|barrio)\\b.*")) {
            return true;
        }
        for (var ciudad : CIUDADES) {
            String c = ciudad.toLowerCase();
            if (lower.equals(c) || lower.startsWith(c + ",") || lower.startsWith(c + " -") || lower.startsWith(c + " |")) return true;
        }
        return false;
    }

    private static String limpiarTextoPerfil(String texto) {
        if (texto == null || texto.isBlank()) return null;
        var lineas = texto.lines().map(String::trim).filter(l -> !l.isBlank()).toList();
        var validas = new ArrayList<String>();
        for (String l : lineas) {
            String lower = l.toLowerCase();
            if (esMetadataBasura(lower) || lower.startsWith("i.") || lower.startsWith("ii.") || lower.startsWith("iii.")) {
                continue;
            }
            validas.add(l);
        }
        return String.join(" ", validas);
    }

    private static String limpiarTextoCompetencias(String texto) {
        if (texto == null || texto.isBlank()) return null;
        var lineas = texto.lines().map(String::trim).filter(l -> !l.isBlank()).toList();
        var items = new LinkedHashSet<String>();
        for (String l : lineas) {
            String lower = l.toLowerCase();
            if (esMetadataBasura(lower)) continue;
            String limpia = l.replaceAll("^[•\\-*▪>\\s]+", "").trim();
            if (limpia.endsWith(":") && limpia.length() < 35) {
                continue;
            }
            if (limpia.contains(":")) {
                String[] partes = limpia.split(":", 2);
                if (partes.length == 2 && !partes[1].isBlank()) {
                    limpia = partes[1].trim();
                }
            }
            for (String item : limpia.split("[,;|/]+")) {
                String s = item.trim();
                if (!s.isBlank() && s.length() <= 45 && !s.equalsIgnoreCase("and") && !s.equalsIgnoreCase("y")) {
                    items.add(s);
                }
            }
        }
        return String.join(", ", items);
    }

    private static List<ExperienciaDto> parseExperienciasDelBloque(String bloque) {
        var result = new ArrayList<ExperienciaDto>();
        if (bloque == null || bloque.isBlank()) return result;

        var lineas = bloque.lines().map(String::trim).filter(l -> !l.isBlank()).toList();

        String cargo = null;
        String empresa = null;
        String fechaInicio = null;
        String fechaFin = null;
        boolean actual = false;
        var funciones = new ArrayList<String>();

        for (String linea : lineas) {
            String lower = linea.toLowerCase();
            if (esMetadataBasura(lower)) continue;

            boolean esViñeta = linea.startsWith("•") || linea.startsWith("-") || linea.startsWith("*") || linea.startsWith("▪") || linea.matches("^\\d+[.)]\\s+.*");
            boolean tieneAnio = tieneAnioValido(linea) || lower.contains("presente") || lower.contains("actualidad") || lower.contains("present");

            if (tieneAnio && !esViñeta) {
                if ((cargo != null || empresa != null) && (fechaInicio != null || !funciones.isEmpty())) {
                    result.add(new ExperienciaDto(
                            cargo != null ? cargo : "Experiencia",
                            empresa != null ? empresa : "Empresa / Proyecto",
                            null, fechaInicio, fechaFin, false, actual, String.join("\n", funciones)));
                    cargo = null;
                    empresa = null;
                    fechaInicio = null;
                    fechaFin = null;
                    actual = false;
                    funciones.clear();
                }
                var rango = parseRangoFechas(linea);
                fechaInicio = rango.inicio();
                fechaFin = rango.fin();
                actual = rango.actual();

                // Extraer cargo y empresa si vienen en la misma linea que el año
                String sinFecha = linea.replaceAll("(?i)(?:19[7-9]\\d|20[0-2]\\d)\\s*(?:[–\\-—/]|al|to)?\\s*(?:19[7-9]\\d|20[0-2]\\d|presente|actualidad|present|actual)?", "").trim();
                sinFecha = sinFecha.replaceAll("^[–—\\-|\\s]+|[–—\\-|\\s]+$", "").trim();
                if (!sinFecha.isBlank()) {
                    String[] partes = sinFecha.split("\\s+(?:–|—|-|\\||\\bat\\b)\\s+", 2);
                    if (cargo == null) {
                        if (partes.length == 2) {
                            cargo = partes[0].trim();
                            empresa = partes[1].trim();
                        } else {
                            cargo = sinFecha;
                        }
                    } else if (empresa == null) {
                        empresa = sinFecha;
                    }
                }
            } else if (!esViñeta) {
                if (cargo == null) {
                    String[] partes = linea.split("\\s+(?:–|—|-|\\||\\bat\\b)\\s+", 2);
                    if (partes.length == 2) {
                        cargo = partes[0].trim();
                        empresa = partes[1].trim();
                    } else {
                        cargo = linea;
                    }
                } else if (empresa == null) {
                    empresa = linea;
                } else {
                    funciones.add(linea);
                }
            } else {
                String funcion = linea.replaceAll("^[•\\-*▪\\d+.)\\s]+", "").trim();
                if (!funcion.isBlank()) funciones.add(funcion);
            }
        }

        if (cargo != null || empresa != null || !funciones.isEmpty()) {
            result.add(new ExperienciaDto(
                    cargo != null ? cargo : "Experiencia",
                    empresa != null ? empresa : "Empresa / Proyecto",
                    null,
                    fechaInicio,
                    fechaFin,
                    false,
                    actual,
                    String.join("\n", funciones)
            ));
        }

        return result;
    }

    private record RangoFecha(String inicio, String fin, boolean actual) {}

    private static boolean tieneAnioValido(String linea) {
        return ANIO_ISOLADO.matcher(linea).find();
    }

    private static RangoFecha parseRangoFechas(String linea) {
        String lower = linea.toLowerCase();
        boolean actual = lower.contains("presente") || lower.contains("actualidad") || lower.contains("present") || lower.contains("actual");

        var matcherAnio = ANIO_ISOLADO.matcher(linea);
        List<String> anios = new ArrayList<>();
        while (matcherAnio.find()) {
            anios.add(matcherAnio.group(1));
        }

        String inicio = !anios.isEmpty() ? anios.get(0) : null;
        String fin = null;
        if (actual) {
            fin = null;
        } else if (anios.size() >= 2) {
            fin = anios.get(1);
        } else if (!anios.isEmpty()) {
            fin = anios.get(0);
        }

        return new RangoFecha(inicio, fin, actual);
    }

    private static List<FormacionDto> parseEducacionDelBloque(String bloque) {
        var result = new ArrayList<FormacionDto>();
        if (bloque == null || bloque.isBlank()) return result;

        var lineas = bloque.lines().map(String::trim).filter(l -> !l.isBlank()).toList();
        var lineasFiltradas = lineas.stream().filter(l -> !esMetadataBasura(l.toLowerCase())).toList();

        String prog = null;
        String inst = null;
        String anio = null;

        for (String linea : lineasFiltradas) {
            boolean esViñeta = linea.startsWith("•") || linea.startsWith("-") || linea.startsWith("*") || linea.startsWith("▪") || linea.matches("^\\d+[.)]\\s+.*");
            if (esViñeta) continue;

            boolean tieneAnio = tieneAnioValido(linea);
            if (tieneAnio) {
                var matcher = ANIO_ISOLADO.matcher(linea);
                List<String> anios = new ArrayList<>();
                while (matcher.find()) anios.add(matcher.group(1));
                anio = !anios.isEmpty() ? anios.get(anios.size() - 1) : null;

                String sinAnio = linea.replaceAll("(?i)(?:19[7-9]\\d|20[0-2]\\d)\\s*(?:[–\\-—/]|al|to)?\\s*(?:19[7-9]\\d|20[0-2]\\d)?", "").trim();
                sinAnio = sinAnio.replaceAll("^[–—\\-|\\s]+|[–—\\-|\\s]+$", "").trim();

                if (prog == null) {
                    String[] partes = sinAnio.split("\\s+(?:–|—|-|\\||\\bat\\b)\\s+", 2);
                    if (partes.length == 2) {
                        prog = partes[0].trim();
                        inst = partes[1].trim();
                    } else if (!sinAnio.isBlank()) {
                        prog = sinAnio;
                    }
                } else if (inst == null && !sinAnio.isBlank()) {
                    inst = sinAnio;
                }

                if (prog != null) {
                    result.add(new FormacionDto("EDUCACION", prog, inst, anio));
                    prog = null;
                    inst = null;
                    anio = null;
                }
            } else {
                if (prog == null) {
                    String[] partes = linea.split("\\s+(?:–|—|-|\\||\\bat\\b)\\s+", 2);
                    if (partes.length == 2) {
                        prog = partes[0].trim();
                        inst = partes[1].trim();
                    } else {
                        prog = linea;
                    }
                } else if (inst == null) {
                    inst = linea;
                } else {
                    result.add(new FormacionDto("EDUCACION", prog, inst, anio));
                    prog = linea;
                    inst = null;
                    anio = null;
                }
            }
        }
        if (prog != null) {
            result.add(new FormacionDto("EDUCACION", prog, inst, anio));
        }
        return result;
    }

    private static List<FormacionDto> parseCertificacionesDelBloque(String bloque) {
        var result = new ArrayList<FormacionDto>();
        if (bloque == null || bloque.isBlank()) return result;

        var lineas = bloque.lines().map(String::trim).filter(l -> !l.isBlank()).toList();
        for (String linea : lineas) {
            if (esMetadataBasura(linea.toLowerCase())) continue;
            String t = linea.replaceAll("^[•\\-*▪>\\s]+", "").trim();
            if (!t.isBlank() && t.length() > 5) {
                var mAnio = ANIO_ISOLADO.matcher(t);
                String anio = mAnio.find() ? mAnio.group(1) : null;
                if (t.contains("-") || t.contains("—") || t.contains("–")) {
                    var partes = t.split("[-—–]", 2);
                    result.add(new FormacionDto("CERTIFICACION", partes[0].trim(), partes[1].trim(), anio));
                } else {
                    result.add(new FormacionDto("CERTIFICACION", t, null, anio));
                }
            }
        }
        return result;
    }

    /**
     * Filtra metadatos basura como referencias personales/familiares, expedición de documentos,
     * teléfonos y nombres de familiares que no deben ingresar a Educación ni Perfil.
     */
    private static boolean esMetadataBasura(String lower) {
        return lower.startsWith("nombre:")
                || lower.startsWith("cargo:")
                || lower.startsWith("teléfono:")
                || lower.startsWith("telefono:")
                || lower.startsWith("tel:")
                || lower.startsWith("cel:")
                || lower.startsWith("relación:")
                || lower.startsWith("relacion:")
                || lower.contains("se expide en")
                || lower.contains("expedida en")
                || lower.contains("referencias familiares")
                || lower.contains("referencias personales")
                || lower.contains("referencias laborales")
                || lower.matches("^(i|ii|iii|iv|v|vi|1|2|3)\\.\\s*referencias.*")
                || lower.matches(".*c\\.c\\.\\s*\\d+.*")
                || lower.matches(".*cédula\\s*\\d+.*");
    }
}
