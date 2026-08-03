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
    private static final Pattern LINKEDIN = Pattern.compile("(?i)linkedin\\.com/in/([a-zA-Z0-9_-]+)");

    private static final String INSTRUCCIONES_IA = """
            Extraes datos de hojas de vida en espanol para un CRM de empleabilidad.
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
            "Bogotá", "Bogota", "Medellín", "Medellin", "Cali", "Barranquilla", "Cartagena",
            "Bucaramanga", "Pereira", "Manizales", "Cúcuta", "Cucuta", "Villavicencio",
            "Ibagué", "Ibague", "Santa Marta", "Montería", "Monteria", "Neiva", "Pasto", "Armenia");

    private record SeccionHeaderConfig(String tipo, List<String> palabrasClave) {}

    // Incluimos secciones de detención (DATOS_PERSONALES, REFERENCIAS) para evitar que contaminen Perfil/Educación/Experiencia
    private static final List<SeccionHeaderConfig> SECCIONES_CONFIG = List.of(
            new SeccionHeaderConfig("DATOS_PERSONALES", List.of("i. datos personales", "datos personales", "información personal", "informacion personal")),
            new SeccionHeaderConfig("PERFIL", List.of("perfil profesional", "perfil", "resumen profesional", "resumen", "acerca de mí", "acerca de mi", "acerca de", "summary", "profile", "about me")),
            new SeccionHeaderConfig("EXPERIENCIA", List.of("experiencia laboral", "experiencia profesional", "experiencia", "work experience", "employment", "trayectoria laboral")),
            new SeccionHeaderConfig("EDUCACION", List.of("educación académica", "educacion academica", "educación", "educacion", "formación académica", "formacion academica", "estudios", "education")),
            new SeccionHeaderConfig("CERTIFICACIONES", List.of("certificaciones", "cursos", "formación adicional", "formacion adicional", "certifications", "diplomados")),
            new SeccionHeaderConfig("COMPETENCIAS", List.of("habilidades técnicas", "habilidades tecnicas", "habilidades", "competencias", "skills", "technical skills", "herramientas")),
            new SeccionHeaderConfig("IDIOMAS", List.of("idiomas", "languages")),
            new SeccionHeaderConfig("REFERENCIAS", List.of("ii. referencias familiares", "iii. referencias personales", "referencias familiares", "referencias personales", "referencias laborales", "referencias"))
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
            if (mDocSuelto.find()) {
                docVal = mDocSuelto.group(1);
                campos.add(new CampoExtraido("numeroDocumento", docVal, 45));
            }
        }

        String ciudadVal = null;
        for (var ciudad : CIUDADES) {
            if (texto.contains(ciudad)) {
                ciudadVal = normalizarCiudad(ciudad);
                campos.add(new CampoExtraido("ciudad", ciudadVal, 70));
                break;
            }
        }

        String linkedinVal = null;
        var mLi = LINKEDIN.matcher(texto);
        if (mLi.find()) {
            linkedinVal = mLi.group(1);
            campos.add(new CampoExtraido("linkedinUserId", linkedinVal, 90));
        }

        String nombreVal = null;
        String apellidoVal = null;
        String nombreDetectado = detectarNombre(texto);
        if (nombreDetectado != null) {
            var partes = nombreDetectado.trim().split("\\s+", 3);
            if (partes.length >= 2) {
                nombreVal = partes[0];
                apellidoVal = nombreDetectado.substring(nombreDetectado.indexOf(' ') + 1).trim();
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
                "Profesional",
                experiencias,
                formaciones,
                null,
                null,
                // Lo que se extrae del PDF es la direccion del perfil, no el id
                // de la integracion OAuth: alimenta el enlace de la cabecera.
                linkedinVal,
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

    private static Map<String, String> segmentarTextoPorSecciones(String texto) {
        String lower = texto.toLowerCase();
        List<SeccionIndex> encontradas = new ArrayList<>();

        for (var conf : SECCIONES_CONFIG) {
            for (String kw : conf.palabrasClave()) {
                int idx = lower.indexOf(kw);
                if (idx >= 0) {
                    encontradas.add(new SeccionIndex(conf.tipo(), idx, idx + kw.length()));
                    break;
                }
            }
        }

        encontradas.sort(Comparator.comparingInt(SeccionIndex::posInicio));

        Map<String, String> resultado = new HashMap<>();
        for (int i = 0; i < encontradas.size(); i++) {
            var actual = encontradas.get(i);
            int fin = (i + 1 < encontradas.size()) ? encontradas.get(i + 1).posInicio() : texto.length();
            String sub = texto.substring(actual.posTexto(), fin).trim();
            resultado.put(actual.tipo(), sub);
        }

        return resultado;
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
        var lineas = texto.lines().map(String::trim).filter(l -> !l.isBlank()).limit(6).toList();
        for (var linea : lineas) {
            String lower = linea.toLowerCase();
            if (linea.length() >= 6 && linea.length() <= 60
                    && !linea.contains("@") && !linea.matches(".*\\d.*")
                    && linea.split("\\s+").length >= 2 && linea.split("\\s+").length <= 5
                    && Character.isUpperCase(linea.charAt(0))
                    && !lower.contains("hoja de vida")
                    && !lower.contains("curriculum")
                    && !lower.contains("datos personales")
                    && !lower.contains("informacion")
                    && !lower.contains("perfil")) {
                return linea;
            }
        }
        return null;
    }

    private static String detectarCargoObjetivo(String texto, String nombreDetectado) {
        var lineas = texto.lines().map(String::trim).filter(l -> !l.isBlank()).limit(10).toList();
        boolean trasNombre = false;
        for (var linea : lineas) {
            if (nombreDetectado != null && linea.equalsIgnoreCase(nombreDetectado)) {
                trasNombre = true;
                continue;
            }
            String lower = linea.toLowerCase();
            // Ignorar números romanos (I. DATOS PERSONALES, II. REFERENCIAS, etc.) o encabezados conocidos
            boolean esEncabezadoNoCargo = lower.matches("^(i|ii|iii|iv|v|vi|1|2|3)\\.\\s*.*")
                    || lower.contains("datos personales")
                    || lower.contains("información personal")
                    || lower.contains("informacion personal")
                    || lower.contains("perfil")
                    || lower.contains("referencias")
                    || lower.contains("contacto")
                    || lower.contains("cédula")
                    || lower.contains("cedula")
                    || lower.contains("documento")
                    || lower.contains("hoja de vida");

            if (!esEncabezadoNoCargo && linea.length() >= 4 && linea.length() <= 50
                    && !linea.contains("@") && !linea.matches(".*\\d.*")) {
                return linea;
            }
        }
        return null;
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
        var validas = new ArrayList<String>();
        for (String l : lineas) {
            String lower = l.toLowerCase();
            if (esMetadataBasura(lower)) continue;
            validas.add(l.replaceAll("^[•\\-*▪]\\s*", ""));
        }
        return String.join(", ", validas);
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
            boolean tieneAnio = tieneAnioValido(linea) || lower.contains("presente") || lower.contains("actualidad");

            if (tieneAnio && !esViñeta) {
                if (cargo != null && empresa != null) {
                    result.add(new ExperienciaDto(cargo, empresa, null, fechaInicio != null ? fechaInicio : "2022", fechaFin, false, actual, String.join("\n", funciones)));
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
            } else if (!esViñeta) {
                if (cargo == null) {
                    cargo = linea;
                } else if (empresa == null) {
                    empresa = linea;
                } else {
                    funciones.add(linea);
                }
            } else {
                String funcion = linea.replaceAll("^[•\\-*▪\\d+.)]+\\s*", "").trim();
                if (!funcion.isBlank()) funciones.add(funcion);
            }
        }

        if (cargo != null || empresa != null || !funciones.isEmpty()) {
            result.add(new ExperienciaDto(
                    cargo != null ? cargo : "Cargo Desempeñado",
                    empresa != null ? empresa : "Empresa / Organización",
                    null,
                    fechaInicio != null ? fechaInicio : "2022",
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

        String inicio = !anios.isEmpty() ? anios.get(0) : "2022";
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

        for (int i = 0; i < lineasFiltradas.size(); i += 2) {
            String prog = lineasFiltradas.get(i).replaceAll("^[•\\-*▪>\\s]+", "").trim();
            String inst = (i + 1 < lineasFiltradas.size()) ? lineasFiltradas.get(i + 1).replaceAll("^[•\\-*▪>\\s]+", "").trim() : "Institución Educativa";

            var mAnio = ANIO_ISOLADO.matcher(prog + " " + inst);
            String anio = mAnio.find() ? mAnio.group(1) : "2023";

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
                if (t.contains("-") || t.contains("—")) {
                    var partes = t.split("[-—]", 2);
                    result.add(new FormacionDto("CERTIFICACION", partes[0].trim(), partes[1].trim(), "2023"));
                } else {
                    result.add(new FormacionDto("CERTIFICACION", t, "Institución", "2023"));
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
