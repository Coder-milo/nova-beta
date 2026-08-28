package com.novacrm.hv;

import com.novacrm.exception.BusinessException;
import com.novacrm.hv.dto.*;
import com.novacrm.hv.dto.AuditoriaLinkedinDto.CriterioAuditoriaDto;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Motor de análisis, extracción y auditoría ATS para perfiles de LinkedIn exportados en PDF.
 *
 * <p>Reconoce el estándar visual oficial de dos columnas de LinkedIn (Barra lateral de contacto,
 * aptitudes, idiomas y certificaciones; columna principal con titular, extracto, experiencia y educación).
 *
 * <p>Evalúa objetivamente la calidad del perfil mediante 5 pilares estratégicos de empleabilidad,
 * otorgando una puntuación del 0 al 100 y recomendaciones claras para mejorar la visibilidad ante reclutadores.
 */
@Service
public class AuditoriaLinkedinService {

    private static final Logger log = LoggerFactory.getLogger(AuditoriaLinkedinService.class);

    private static final Pattern URL_LINKEDIN = Pattern.compile(
            "(?i)(?:https?://)?(?:www\\.|[a-z]{2}\\.)?linkedin\\.com/in/([\\p{L}\\p{N}_.\\-%]+)");
    private static final Pattern EMAIL = Pattern.compile(
            "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
    private static final Pattern CELULAR = Pattern.compile("(?<!\\d)3\\d{9}(?!\\d)");
    private static final Pattern RANGO_FECHA = Pattern.compile(
            "(?i)(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)\\s+(?:de\\s+)?(19\\d\\d|20\\d\\d|presente|present|actualidad)");

    /**
     * Procesa y audita un PDF exportado desde LinkedIn.
     */
    public AuditoriaLinkedinDto auditar(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new BusinessException("El archivo PDF de LinkedIn es requerido.");
        }
        String texto = extraerTextoPdf(archivo);
        if (texto.isBlank()) {
            throw new BusinessException("No se pudo extraer texto legible del PDF. Asegúrate de exportarlo con la opción 'Guardar en PDF' de LinkedIn.");
        }

        return auditarTexto(texto);
    }

    /**
     * Audita el texto plano extraído de un PDF de LinkedIn.
     */
    public AuditoriaLinkedinDto auditarTexto(String texto) {
        String normal = normalizarTexto(texto);

        // 1. Extracción de entidades
        String linkedinUrl = extraerLinkedinUrl(texto);
        String email = extraerEmail(texto);
        String celular = extraerCelular(texto);
        String nombre = extraerNombre(texto);
        String titular = extraerTitular(texto, nombre);
        String ciudad = extraerCiudad(texto, titular);
        String extracto = extraerSeccion(texto, List.of("Extracto", "Summary", "Acerca de", "About"), List.of("Experiencia", "Experience", "Educación", "Education"));
        List<String> aptitudes = extraerListaAptitudes(texto);
        List<String> idiomas = extraerListaIdiomas(texto);
        List<String> certificaciones = extraerListaCertificaciones(texto);
        List<ExperienciaDto> experiencias = extraerExperiencias(texto);
        List<FormacionDto> formaciones = extraerEducacion(texto);

        // Si hay certificaciones, las añadimos como formaciones de tipo CERTIFICACION
        for (String cert : certificaciones) {
            formaciones.add(new FormacionDto("CERTIFICACION", cert, "LinkedIn / Certificación", ""));
        }

        // Combinar aptitudes y certificaciones en competencias
        String competencias = String.join(", ", aptitudes);
        String idiomasStr = String.join(", ", idiomas);

        // Identificar nivel de inglés
        String nivelIngles = null;
        for (String idm : idiomas) {
            String idmNorm = normalizarTexto(idm);
            if (idmNorm.contains("ingles") || idmNorm.contains("english")) {
                if (idmNorm.contains("native") || idmNorm.contains("bilingual") || idmNorm.contains("bilingue") || idmNorm.contains("c2")) {
                    nivelIngles = "C2";
                } else if (idmNorm.contains("c1") || idmNorm.contains("avanzado") || idmNorm.contains("advanced")) {
                    nivelIngles = "C1";
                } else if (idmNorm.contains("b2") || idmNorm.contains("intermedio alto") || idmNorm.contains("upper intermediate")) {
                    nivelIngles = "B2";
                } else if (idmNorm.contains("b1") || idmNorm.contains("intermedio") || idmNorm.contains("intermediate")) {
                    nivelIngles = "B1";
                } else {
                    nivelIngles = "Intermedio / Bilingüe";
                }
            }
        }

        // 2. Evaluación de Pilares (0 a 100)
        List<CriterioAuditoriaDto> criterios = new ArrayList<>();
        List<String> fortalezas = new ArrayList<>();
        List<String> recomendaciones = new ArrayList<>();

        // Pilar 1: Titular Estratégico (Headline) - Max 25 pts
        int ptsTitular = 0;
        String detalleTitular = "Sin titular profesional detectado.";
        String sugerenciaTitular = "Agrega un titular con tu cargo objetivo y palabras clave (ej: Desarrollador Java | Spring Boot).";
        if (titular != null && !titular.isBlank()) {
            ptsTitular += 15;
            boolean tieneDelimitadores = titular.contains("|") || titular.contains("/") || titular.contains("•") || titular.contains("-");
            boolean largoAdecuado = titular.length() >= 25;
            if (tieneDelimitadores || largoAdecuado) {
                ptsTitular += 10;
                detalleTitular = "Titular completo y enriquecido con especialidades y tecnologías.";
                sugerenciaTitular = null;
                fortalezas.add("Titular profesional enriquecido con especialidades.");
            } else {
                detalleTitular = "Titular básico (" + titular + ").";
                sugerenciaTitular = "Separa tu rol principal y tecnologías clave usando barras (ej. " + titular + " | Herramienta | Metodologías).";
                recomendaciones.add("Enriquece tu titular con tecnologías clave y especialidades separadas por barras (|).");
            }
        } else {
            recomendaciones.add("Define un titular profesional estratégico en tu perfil de LinkedIn.");
        }
        criterios.add(new CriterioAuditoriaDto("titular", "Titular Profesional Estratégico", ptsTitular >= 15, ptsTitular, 25, detalleTitular, sugerenciaTitular));

        // Pilar 2: Extracto / Summary (Acerca de) - Max 25 pts
        int ptsExtracto = 0;
        String detalleExtracto = "No se detectó la sección 'Acerca de' o Extracto.";
        String sugerenciaExtracto = "Redacta un extracto profesional en primera persona explicando tu trayectoria, pasión y valor que aportas.";
        if (extracto != null && !extracto.isBlank()) {
            ptsExtracto += 10;
            if (extracto.length() >= 150) {
                ptsExtracto += 10;
            }
            String extNorm = normalizarTexto(extracto);
            if (extNorm.contains("apasionad") || extNorm.contains("experiencia") || extNorm.contains("habilidad") || extNorm.contains("busco") || extNorm.contains("enfoque") || extNorm.contains("desarrollo")) {
                ptsExtracto += 5;
            }
            detalleExtracto = "Extracto profesional estructurado (" + extracto.length() + " caracteres).";
            sugerenciaExtracto = null;
            fortalezas.add("Extracto profesional redactado con enfoque de valor y trayectoria.");
        } else {
            recomendaciones.add("Escribe un extracto profesional en tu 'Acerca de' de al menos 3 párrafos destacando tus fortalezas.");
        }
        criterios.add(new CriterioAuditoriaDto("extracto", "Extracto / Acerca de (Summary)", ptsExtracto >= 15, ptsExtracto, 25, detalleExtracto, sugerenciaExtracto));

        // Pilar 3: Experiencia Laboral y Proyectos - Max 20 pts
        int ptsExp = 0;
        String detalleExp = "Sin experiencia laboral registrada en LinkedIn.";
        String sugerenciaExp = "Agrega tus roles profesionales, voluntariados, monitorías o proyectos relevantes con descripción de funciones.";
        if (!experiencias.isEmpty()) {
            ptsExp += 12;
            if (experiencias.size() >= 2 || experiencias.stream().anyMatch(e -> e.funciones() != null && e.funciones().length() > 30)) {
                ptsExp += 8;
                detalleExp = experiencias.size() + " experiencias registradas con detalle de logros y funciones.";
                sugerenciaExp = null;
                fortalezas.add("Historial laboral con " + experiencias.size() + " posiciones y funciones detalladas.");
            } else {
                detalleExp = experiencias.size() + " experiencia registrada con descripción breve.";
                sugerenciaExp = "Añade logros cuantificables y responsabilidades a cada experiencia.";
                recomendaciones.add("Detalla las funciones y logros clave de tus experiencias laborales.");
            }
        } else {
            recomendaciones.add("Registra al menos una experiencia laboral, monitoría o proyecto destacado en LinkedIn.");
        }
        criterios.add(new CriterioAuditoriaDto("experiencia", "Experiencia Laboral y Proyectos", ptsExp >= 12, ptsExp, 20, detalleExp, sugerenciaExp));

        // Pilar 4: Aptitudes Principales e Idiomas - Max 15 pts
        int ptsApt = 0;
        String detalleApt = "Pocas aptitudes o idiomas registrados.";
        String sugerenciaApt = "Agrega al menos 5 aptitudes principales en LinkedIn para que los reclutadores te encuentren en búsquedas.";
        if (!aptitudes.isEmpty()) {
            ptsApt += 8;
            fortalezas.add(aptitudes.size() + " aptitudes clave registradas.");
        }
        if (!idiomas.isEmpty() || nivelIngles != null) {
            ptsApt += 7;
            fortalezas.add("Dominio de idiomas registrado" + (nivelIngles != null ? " (" + nivelIngles + ")" : "") + ".");
        }
        if (ptsApt >= 15) {
            detalleApt = aptitudes.size() + " aptitudes y " + idiomas.size() + " idiomas verificados.";
            sugerenciaApt = null;
        } else if (aptitudes.size() < 3) {
            recomendaciones.add("Agrega más habilidades técnicas y blandas en la sección 'Aptitudes principales' de LinkedIn.");
        }
        criterios.add(new CriterioAuditoriaDto("aptitudes", "Aptitudes e Idiomas", ptsApt >= 8, ptsApt, 15, detalleApt, sugerenciaApt));

        // Pilar 5: Educación y Certificaciones - Max 15 pts
        int ptsEdu = 0;
        String detalleEdu = "Sin formación académica detectada.";
        String sugerenciaEdu = "Registra tus estudios universitarios, técnicos o certificaciones profesionales.";
        if (!formaciones.isEmpty()) {
            ptsEdu += 10;
            if (formaciones.size() >= 2 || !certificaciones.isEmpty()) {
                ptsEdu += 5;
                detalleEdu = formaciones.size() + " registros de educación y certificaciones.";
                sugerenciaEdu = null;
                fortalezas.add("Formación académica y certificaciones acreditadas (" + formaciones.size() + ").");
            } else {
                detalleEdu = "1 registro académico detectado.";
                sugerenciaEdu = "Agrega cursos adicionales o diplomados para robustecer tu perfil.";
            }
        } else {
            recomendaciones.add("Registra tu formación universitaria o técnica en LinkedIn.");
        }
        criterios.add(new CriterioAuditoriaDto("educacion", "Educación y Certificaciones", ptsEdu >= 10, ptsEdu, 15, detalleEdu, sugerenciaEdu));

        // Puntuación total
        int puntuacionTotal = Math.min(100, Math.max(0, ptsTitular + ptsExtracto + ptsExp + ptsApt + ptsEdu));

        // Bonus / Check URL personalizada
        if (linkedinUrl != null && !linkedinUrl.matches(".*-\\d{6,}.*")) {
            fortalezas.add("URL pública personalizada de LinkedIn.");
        } else if (linkedinUrl != null && linkedinUrl.matches(".*-\\d{6,}.*")) {
            recomendaciones.add("Personaliza tu URL pública de LinkedIn (ej. linkedin.com/in/tu-nombre) eliminando los números del final.");
        }

        String nivel;
        if (puntuacionTotal >= 85) {
            nivel = "Estelar / All-Star";
        } else if (puntuacionTotal >= 70) {
            nivel = "Avanzado";
        } else if (puntuacionTotal >= 50) {
            nivel = "Intermedio";
        } else {
            nivel = "Básico";
        }

        boolean optimizado = puntuacionTotal >= 70;

        // Estructurar DatosHvDto
        String[] partesNombre = separarNombreApellido(nombre);
        DatosHvDto datosExtraidos = new DatosHvDto(
                partesNombre[0],
                partesNombre[1],
                titular != null && titular.contains("|") ? titular.split("\\|")[0].trim() : titular,
                email,
                celular,
                ciudad,
                extraerLinkedinUsername(linkedinUrl),
                extracto,
                competencias,
                idiomasStr,
                !formaciones.isEmpty() ? formaciones.get(0).programa() : null,
                !formaciones.isEmpty() ? formaciones.get(0).institucion() : null,
                "Universitario",
                experiencias,
                formaciones,
                null,
                "Colombia",
                linkedinUrl,
                null,
                nivelIngles,
                List.of()
        );

        return new AuditoriaLinkedinDto(
                puntuacionTotal,
                nivel,
                optimizado,
                criterios,
                fortalezas,
                recomendaciones,
                datosExtraidos
        );
    }

    private String extraerTextoPdf(MultipartFile archivo) {
        try (PDDocument doc = PDDocument.load(archivo.getInputStream())) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(false);
            return stripper.getText(doc);
        } catch (IOException e) {
            log.warn("Error leyendo PDF de LinkedIn: {}", e.getMessage());
            throw new BusinessException("No se pudo leer el archivo PDF: " + e.getMessage());
        }
    }

    private String extraerLinkedinUrl(String texto) {
        String textoLimpio = texto.replaceAll("(?i)(linkedin\\.com/in/[\\p{L}\\p{N}_.\\-%]+)\\s*\\r?\\n\\s*([\\p{L}\\p{N}_.\\-%]+)", "$1$2");
        Matcher m = URL_LINKEDIN.matcher(textoLimpio);
        if (m.find()) {
            String slug = m.group(1).replaceAll("(?i)\\s*\\(LinkedIn\\)", "").trim();
            return "https://www.linkedin.com/in/" + slug;
        }
        return null;
    }

    private String extraerLinkedinUsername(String url) {
        if (url == null) return null;
        Matcher m = URL_LINKEDIN.matcher(url);
        if (m.find()) {
            return m.group(1);
        }
        return null;
    }

    private String extraerEmail(String texto) {
        String[] lineas = texto.split("\\r?\\n");
        for (int i = 0; i < lineas.length; i++) {
            String l = lineas[i].trim();
            Matcher m = EMAIL.matcher(l);
            if (m.find()) {
                return m.group(0);
            }
            if (l.contains("@") && i + 1 < lineas.length) {
                String combinada = l + lineas[i + 1].trim();
                Matcher m2 = EMAIL.matcher(combinada);
                if (m2.find()) {
                    return m2.group(0);
                }
            }
        }
        return null;
    }

    private String extraerCelular(String texto) {
        Matcher m = CELULAR.matcher(texto);
        if (m.find()) {
            return m.group(0);
        }
        return null;
    }

    private String extraerNombre(String texto) {
        String[] lineas = texto.split("\\r?\\n");
        int idxExtracto = -1;
        for (int i = 0; i < lineas.length; i++) {
            String l = lineas[i].trim();
            if (l.equalsIgnoreCase("Extracto") || l.equalsIgnoreCase("Summary") || l.equalsIgnoreCase("Acerca de") || l.equalsIgnoreCase("Experiencia") || l.equalsIgnoreCase("Experience")) {
                idxExtracto = i;
                break;
            }
        }

        if (idxExtracto > 0) {
            // Retroceder desde Extracto buscando la primera línea que tenga formato de Nombre propio
            for (int i = Math.max(0, idxExtracto - 7); i < idxExtracto; i++) {
                String l = lineas[i].trim();
                String norm = normalizarTexto(l);
                if (l.matches("^[\\p{L}\\s]{4,35}$")
                        && !norm.contains("certific")
                        && !norm.contains("language")
                        && !norm.contains("idioma")
                        && !norm.contains("aptitud")
                        && !norm.contains("contact")
                        && !norm.contains("colombia")
                        && !norm.contains("atlantico")
                        && !norm.contains("bogota")
                        && !norm.contains("medellin")
                        && !norm.contains("formacion")
                        && !norm.contains("educacion")
                        && !norm.contains("developer")
                        && !norm.contains("profesor")
                        && !norm.contains("ingenier")
                        && !norm.contains("tecnico")
                        && !l.contains("|")
                        && !l.contains("/")) {
                    return l;
                }
            }
        }

        for (String l : lineas) {
            String lim = l.trim();
            String norm = normalizarTexto(lim);
            if (lim.matches("^[\\p{L}\\s]{4,35}$") && !norm.contains("contact") && !norm.contains("aptitud") && !norm.contains("language") && !norm.contains("certific") && !norm.contains("formacion") && !norm.contains("experiencia") && !norm.contains("educacion")) {
                return lim;
            }
        }
        return "Candidato";
    }

    private String extraerTitular(String texto, String nombre) {
        String[] lineas = texto.split("\\r?\\n");
        for (int i = 0; i < lineas.length; i++) {
            String l = lineas[i].trim();
            if ((l.equalsIgnoreCase(nombre) || (nombre != null && l.contains(nombre))) && i + 1 < lineas.length) {
                StringBuilder titular = new StringBuilder();
                int j = i + 1;
                while (j < lineas.length) {
                    String sig = lineas[j].trim();
                    if (sig.equalsIgnoreCase("Extracto") || sig.equalsIgnoreCase("Summary") || sig.equalsIgnoreCase("Acerca de") || sig.contains("Colombia") || sig.contains("Atlántico") || sig.contains("Bogotá") || sig.contains("Medellín")) {
                        break;
                    }
                    if (!titular.isEmpty()) titular.append(" ");
                    titular.append(sig);
                    j++;
                }
                return titular.toString().trim();
            }
        }
        return null;
    }

    private String extraerCiudad(String texto, String titular) {
        String[] lineas = texto.split("\\r?\\n");
        for (String l : lineas) {
            String norm = normalizarTexto(l);
            if (norm.contains("colombia") || norm.contains("atlantico") || norm.contains("bogota") || norm.contains("medellin") || norm.contains("barranquilla") || norm.contains("soledad")) {
                if (titular != null && titular.contains(l)) continue;
                return l.trim();
            }
        }
        return "Colombia";
    }

    private String extraerSeccion(String texto, List<String> encabezados, List<String> finEncabezados) {
        String[] lineas = texto.split("\\r?\\n");
        boolean dentro = false;
        StringBuilder sb = new StringBuilder();

        for (String l : lineas) {
            String lim = l.trim();
            if (!dentro) {
                for (String enc : encabezados) {
                    if (lim.equalsIgnoreCase(enc)) {
                        dentro = true;
                        break;
                    }
                }
            } else {
                for (String fin : finEncabezados) {
                    if (lim.equalsIgnoreCase(fin)) {
                        return sb.toString().trim();
                    }
                }
                if (lim.startsWith("Page ") && lim.contains(" of ")) {
                    continue;
                }
                if (!lim.isBlank()) {
                    if (!sb.isEmpty()) sb.append("\n");
                    sb.append(lim);
                }
            }
        }
        return sb.toString().trim();
    }

    private List<String> extraerListaAptitudes(String texto) {
        List<String> apts = new ArrayList<>();
        String[] lineas = texto.split("\\r?\\n");
        boolean dentro = false;

        for (String l : lineas) {
            String lim = l.trim();
            if (!dentro) {
                if (lim.equalsIgnoreCase("Aptitudes principales") || lim.equalsIgnoreCase("Top Skills")) {
                    dentro = true;
                }
            } else {
                if (lim.equalsIgnoreCase("Languages") || lim.equalsIgnoreCase("Idiomas") || lim.equalsIgnoreCase("Certifications") || lim.equalsIgnoreCase("Certificaciones") || lim.equalsIgnoreCase("Extracto") || lim.equalsIgnoreCase("Summary")) {
                    break;
                }
                if (!lim.isBlank() && !lim.startsWith("Page ")) {
                    apts.add(lim);
                }
            }
        }
        return apts;
    }

    private List<String> extraerListaIdiomas(String texto) {
        List<String> idiomas = new ArrayList<>();
        String[] lineas = texto.split("\\r?\\n");
        boolean dentro = false;

        for (String l : lineas) {
            String lim = l.trim();
            if (!dentro) {
                if (lim.equalsIgnoreCase("Languages") || lim.equalsIgnoreCase("Idiomas")) {
                    dentro = true;
                }
            } else {
                if (lim.equalsIgnoreCase("Certifications") || lim.equalsIgnoreCase("Certificaciones") || lim.equalsIgnoreCase("Extracto") || lim.equalsIgnoreCase("Summary") || lim.equalsIgnoreCase("Experiencia")) {
                    break;
                }
                if (!lim.isBlank() && !lim.startsWith("Page ")) {
                    idiomas.add(lim);
                }
            }
        }
        return idiomas;
    }

    private List<String> extraerListaCertificaciones(String texto) {
        List<String> certs = new ArrayList<>();
        String[] lineas = texto.split("\\r?\\n");
        boolean dentro = false;

        for (String l : lineas) {
            String lim = l.trim();
            if (!dentro) {
                if (lim.equalsIgnoreCase("Certifications") || lim.equalsIgnoreCase("Certificaciones")) {
                    dentro = true;
                }
            } else {
                if (lim.equalsIgnoreCase("Extracto")
                        || lim.equalsIgnoreCase("Summary")
                        || lim.equalsIgnoreCase("Experiencia")
                        || lim.equalsIgnoreCase("Educación")
                        || lim.contains("|")
                        || lim.contains("Colombia")
                        || lim.contains("Atlántico")
                        || lim.startsWith("Page ")) {
                    break;
                }
                if (!lim.isBlank()) {
                    certs.add(lim);
                }
            }
        }
        return certs;
    }

    private List<ExperienciaDto> extraerExperiencias(String texto) {
        List<ExperienciaDto> experiencias = new ArrayList<>();
        String bloqueExp = extraerSeccion(texto, List.of("Experiencia", "Experience"), List.of("Educación", "Education", "Idiomas"));
        if (bloqueExp.isBlank()) return experiencias;

        String[] lineas = bloqueExp.split("\\r?\\n");
        List<String> validas = new ArrayList<>();
        for (String l : lineas) {
            String lim = l.trim();
            if (!lim.isBlank() && !(lim.startsWith("Page ") && lim.contains(" of "))) {
                validas.add(lim);
            }
        }

        List<Integer> idxFechas = new ArrayList<>();
        for (int i = 0; i < validas.size(); i++) {
            String l = validas.get(i);
            if (RANGO_FECHA.matcher(l).find() || l.contains(" - ") || l.contains("·") || l.matches(".*\\(\\d+\\s+(?:mes|meses|año|años|month|year).*\\)")) {
                idxFechas.add(i);
            }
        }

        for (int k = 0; k < idxFechas.size(); k++) {
            int idxFecha = idxFechas.get(k);
            String fechas = validas.get(idxFecha);
            String cargo = idxFecha > 0 ? validas.get(idxFecha - 1) : "Posición";
            String empresa = idxFecha > 1 ? validas.get(idxFecha - 2) : "Empresa";

            String ciudad = (idxFecha + 1 < validas.size() && (validas.get(idxFecha + 1).contains("Colombia") || validas.get(idxFecha + 1).contains("Atlántico") || validas.get(idxFecha + 1).contains(","))) ? validas.get(idxFecha + 1) : "";

            int inicioFunciones = !ciudad.isEmpty() ? idxFecha + 2 : idxFecha + 1;
            int finFunciones = (k + 1 < idxFechas.size()) ? Math.max(inicioFunciones, idxFechas.get(k + 1) - 2) : validas.size();

            StringBuilder funciones = new StringBuilder();
            for (int j = inicioFunciones; j < finFunciones && j < validas.size(); j++) {
                if (!funciones.isEmpty()) funciones.append(" ");
                funciones.append(validas.get(j));
            }

            String funcionesStr = funciones.toString()
                    .replaceAll("(?i)\\s*Page\\s+\\d+\\s+of\\s+\\d+\\s*", " ")
                    .replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\uFFFD]", "")
                    .trim();

            experiencias.add(new ExperienciaDto(cargo, empresa, ciudad, fechas, "", false, false, funcionesStr));
        }

        return experiencias;
    }

    private List<FormacionDto> extraerEducacion(String texto) {
        List<FormacionDto> educacion = new ArrayList<>();
        String bloqueEdu = extraerSeccion(texto, List.of("Educación", "Education"), List.of("Certifications", "Idiomas"));
        if (bloqueEdu.isBlank()) return educacion;

        String[] lineas = bloqueEdu.split("\\r?\\n");
        List<String> validas = new ArrayList<>();
        for (String l : lineas) {
            String lim = l.trim();
            if (!lim.isBlank() && !(lim.startsWith("Page ") && lim.contains(" of "))) {
                validas.add(lim);
            }
        }

        String instActual = null;
        for (int i = 0; i < validas.size(); i++) {
            String l = validas.get(i);
            if (l.matches("^[\\d\\s\\-–a-zA-ZáéíóúÁÉÍÓÚde]+\\)$") && !educacion.isEmpty()) {
                var ultima = educacion.remove(educacion.size() - 1);
                educacion.add(new FormacionDto(ultima.tipo(), ultima.programa(), ultima.institucion(), (ultima.fechaFin() + " " + l.replace(")", "").trim()).trim()));
                continue;
            }

            if (l.contains("·") || l.contains("(")) {
                String programa = l;
                String anio = "";
                String[] parts = l.split("[·(]");
                programa = parts[0].trim();
                anio = parts.length > 1 ? parts[1].replace(")", "").trim() : "";

                if (instActual == null && i > 0) {
                    instActual = validas.get(i - 1);
                }
                educacion.add(new FormacionDto("UNIVERSITARIA", programa, instActual != null ? instActual : "Educación", anio));
                instActual = null;
            } else {
                instActual = l;
            }
        }

        return educacion;
    }

    private String[] separarNombreApellido(String nombreCompleto) {
        if (nombreCompleto == null || nombreCompleto.isBlank()) return new String[]{"Candidato", ""};
        String[] partes = nombreCompleto.trim().split("\\s+");
        if (partes.length == 1) return new String[]{partes[0], ""};
        if (partes.length == 2) return new String[]{partes[0], partes[1]};
        return new String[]{partes[0] + " " + partes[1], String.join(" ", Arrays.copyOfRange(partes, 2, partes.length))};
    }

    private String normalizarTexto(String texto) {
        if (texto == null) return "";
        String nfd = Normalizer.normalize(texto, Normalizer.Form.NFD);
        return nfd.replaceAll("\\p{M}", "").toLowerCase();
    }
}
