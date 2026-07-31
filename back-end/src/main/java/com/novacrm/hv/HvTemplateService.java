package com.novacrm.hv;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.perfil.ExperienciaLaboral;
import com.novacrm.perfil.FormacionAdicional;
import com.novacrm.hv.dto.DatosHvDto;
import com.novacrm.hv.dto.ExperienciaDto;
import com.novacrm.hv.dto.FormacionDto;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class HvTemplateService {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("MM/yyyy");

    /** Separador rojo entre los datos de contacto de la cabecera. */
    private static final String SEP = "&#160;&#160;<span style=\"color:#E1251B;\">|</span>&#160;&#160;";
    private static final String ENLACE = "color:#1F4E79;text-decoration:none;";

    private static final String SEC_TITLE = "margin:18pt 0 0 0;font-size:14pt;font-weight:700;color:#1F4E79;text-transform:uppercase;line-height:14pt;letter-spacing:.4pt;border-bottom:1.5pt solid #1F4E79;border-left:4pt solid #E1251B;padding:0 0 3pt 8pt;";
    private static final String SEC_TITLE_FIRST = "margin:20pt 0 0 0;font-size:14pt;font-weight:700;color:#1F4E79;text-transform:uppercase;line-height:14pt;letter-spacing:.4pt;border-bottom:1.5pt solid #1F4E79;border-left:4pt solid #E1251B;padding:0 0 3pt 8pt;";
    private static final String PAR = "margin:8pt 0 0 0;font-size:11pt;line-height:14pt;";
    private static final String BLOCK = "margin-top:8pt;page-break-inside:avoid;";
    private static final String BLOCK_REST = "margin-top:10pt;page-break-inside:avoid;";
    private static final String TITLE = "font-size:11pt;font-weight:700;line-height:13.9pt;";
    private static final String SUB = "font-size:11pt;color:#595959;line-height:13.9pt;";
    private static final String SUB_ITALIC = "font-size:11pt;color:#595959;font-style:italic;line-height:13.9pt;";
    private static final String UL = "margin:4pt 0 0 0;padding-left:18pt;font-size:11pt;line-height:13.9pt;";
    private static final String UL_WIDE = "margin:8pt 0 0 0;padding-left:18pt;font-size:11pt;line-height:13.9pt;";
    private static final String LI_FIRST = "margin:0;";
    private static final String LI_REST = "margin:2pt 0 0 0;";

    private final String plantillaCacFlat;
    private final String plantillaClasicoFoto;
    private final String plantillaModerno;

    public HvTemplateService() {
        try {
            plantillaCacFlat = new ClassPathResource("templates/hv/resume-ats-cac-flat.html")
                    .getContentAsString(StandardCharsets.UTF_8);
            plantillaClasicoFoto = new ClassPathResource("templates/hv/resume-ats-clasico-foto.html")
                    .getContentAsString(StandardCharsets.UTF_8);
            plantillaModerno = new ClassPathResource("templates/hv/resume-ats-moderno.html")
                    .getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new RuntimeException("No se pudo cargar las plantillas HTML de HV", e);
        }
    }

    public String renderizar(Estudiante e,
                             List<FormacionAdicional> formaciones,
                             List<ExperienciaLaboral> experiencias) {
        return renderizar(e, formaciones, experiencias, "es", null, null, null, null);
    }

    public String renderizar(DatosHvDto d, String idioma, Collection<String> seccionesExcluidas, Collection<String> camposExcluidos) {
        return renderizar(d, idioma, seccionesExcluidas, camposExcluidos, null, null);
    }

    private record DesignStyles(
            String secTitle,
            String secTitleFirst,
            String title,
            String subtitle,
            String date,
            String par,
            String block,
            String blockRest
    ) {}

    public String renderizar(DatosHvDto d, String idioma, Collection<String> seccionesExcluidas, Collection<String> camposExcluidos, String fotoBase64, String codigoPlantilla) {
        var html = new StringBuilder(seleccionarPlantilla(codigoPlantilla));
        injectarFoto(html, fotoBase64);
        var st = resolverEstilos(codigoPlantilla);

        boolean isEn = "en".equalsIgnoreCase(idioma);
        Set<String> secEx = seccionesExcluidas != null ? new HashSet<>(seccionesExcluidas) : Collections.emptySet();
        Set<String> fldEx = camposExcluidos != null ? new HashSet<>(camposExcluidos) : Collections.emptySet();

        String nombreComp = (nvl(d.nombre(), "") + " " + nvl(d.apellido(), "")).trim();
        reemplazar(html, "{{FULL_NAME}}", esc(nombreComp));
        reemplazar(html, "{{PROFESSIONAL_TITLE}}", fldEx.contains("TITLE") ? "" : esc(nvl(d.cargoObjetivo(), "")));
        
        String contactHtml = "MODERNO".equalsIgnoreCase(codigoPlantilla)
                ? lineaContactoVertical(
                        fldEx.contains("CITY") ? null : ciudadPais(d.ciudad(), d.nacionalidad()),
                        fldEx.contains("PHONE") ? null : nvl(d.celular(), d.telefono()),
                        fldEx.contains("EMAIL") ? null : d.email(),
                        fldEx.contains("LINKEDIN") ? null : d.linkedinUrl(),
                        fldEx.contains("PORTFOLIO") ? null : d.portafolioUrl())
                : lineaContacto(
                        fldEx.contains("CITY") ? null : ciudadPais(d.ciudad(), d.nacionalidad()),
                        fldEx.contains("PHONE") ? null : nvl(d.celular(), d.telefono()),
                        fldEx.contains("EMAIL") ? null : d.email(),
                        fldEx.contains("LINKEDIN") ? null : d.linkedinUrl(),
                        fldEx.contains("PORTFOLIO") ? null : d.portafolioUrl());
        reemplazar(html, "{{CONTACT_LINE}}", contactHtml);

        injectarSummary(html, d.perfilProfesional(), isEn, secEx.contains("SUMMARY"), st);
        injectarExperienciasDto(html, d.experiencias(), isEn, secEx.contains("EXPERIENCE"), st);
        injectarEducacionDto(html, d, d.formaciones(), isEn, secEx.contains("EDUCATION"), st);
        injectarCertificacionesDto(html, d.formaciones(), isEn, secEx.contains("CERTIFICATIONS"), st);
        injectarAchievements(html, d.logros(), isEn, secEx.contains("ACHIEVEMENTS"), st);
        injectarSkills(html, d.competencias(), isEn, secEx.contains("SKILLS"), st);
        injectarLanguages(html, d.idiomas(), d.nivelIngles(), isEn, secEx.contains("LANGUAGES"), st);

        limpiarMarcadores(html);
        return html.toString();
    }

    public String renderizar(Estudiante e,
                             List<FormacionAdicional> formaciones,
                             List<ExperienciaLaboral> experiencias,
                             String idioma,
                             Collection<String> seccionesExcluidas,
                             Collection<String> camposExcluidos) {
        return renderizar(e, formaciones, experiencias, idioma, seccionesExcluidas, camposExcluidos, null, null);
    }

    public String renderizar(Estudiante e,
                             List<FormacionAdicional> formaciones,
                             List<ExperienciaLaboral> experiencias,
                             String idioma,
                             Collection<String> seccionesExcluidas,
                             Collection<String> camposExcluidos,
                             String fotoBase64,
                             String codigoPlantilla) {
        var html = new StringBuilder(seleccionarPlantilla(codigoPlantilla));
        injectarFoto(html, fotoBase64);
        var st = resolverEstilos(codigoPlantilla);

        boolean isEn = "en".equalsIgnoreCase(idioma);
        Set<String> secEx = seccionesExcluidas != null ? new HashSet<>(seccionesExcluidas) : Collections.emptySet();
        Set<String> fldEx = camposExcluidos != null ? new HashSet<>(camposExcluidos) : Collections.emptySet();

        reemplazar(html, "{{FULL_NAME}}", esc(nombreCompleto(e)));
        reemplazar(html, "{{PROFESSIONAL_TITLE}}", fldEx.contains("TITLE") ? "" : esc(nvl(e.getCargoObjetivo(), "")));
        
        String contactHtml = "MODERNO".equalsIgnoreCase(codigoPlantilla)
                ? lineaContactoVertical(
                        fldEx.contains("CITY") ? null : ciudadPais(e.getCiudad(), e.getNacionalidad()),
                        fldEx.contains("PHONE") ? null : nvl(e.getCelular(), e.getTelefono()),
                        fldEx.contains("EMAIL") ? null : e.getEmail(),
                        fldEx.contains("LINKEDIN") ? null : e.getLinkedinUrl(),
                        fldEx.contains("PORTFOLIO") ? null : e.getCarpetaUrl())
                : lineaContacto(
                        fldEx.contains("CITY") ? null : ciudadPais(e.getCiudad(), e.getNacionalidad()),
                        fldEx.contains("PHONE") ? null : nvl(e.getCelular(), e.getTelefono()),
                        fldEx.contains("EMAIL") ? null : e.getEmail(),
                        fldEx.contains("LINKEDIN") ? null : e.getLinkedinUrl(),
                        fldEx.contains("PORTFOLIO") ? null : e.getCarpetaUrl());
        reemplazar(html, "{{CONTACT_LINE}}", contactHtml);

        injectarSummary(html, e.getPerfilProfesional(), isEn, secEx.contains("SUMMARY"), st);
        injectarExperiencias(html, experiencias, isEn, secEx.contains("EXPERIENCE"), st);
        injectarEducacion(html, e, formaciones, isEn, secEx.contains("EDUCATION"), st);
        injectarCertificaciones(html, formaciones, isEn, secEx.contains("CERTIFICATIONS"), st);
        injectarAchievements(html, null, isEn, secEx.contains("ACHIEVEMENTS"), st);
        injectarSkills(html, e.getCompetencias(), isEn, secEx.contains("SKILLS"), st);
        injectarLanguages(html, e.getIdiomas(),
                e.getNivelIngles() != null ? e.getNivelIngles().getNombre() : null,
                isEn, secEx.contains("LANGUAGES"), st);

        limpiarMarcadores(html);
        return html.toString();
    }

    private void injectarSummary(StringBuilder html, String perfil, boolean isEn, boolean excluir, DesignStyles st) {
        if (excluir || isBlank(perfil)) { removeSection(html, "SUMMARY"); return; }
        String titulo = isEn ? "Professional Summary" : "Perfil Profesional";
        replaceSection(html, "SUMMARY",
                "<h2 style=\"" + st.secTitleFirst() + "\">" + esc(titulo) + "</h2>"
                + "<p style=\"" + st.par() + "\">" + esc(perfil) + "</p>");
    }

    private void injectarExperiencias(StringBuilder html, List<ExperienciaLaboral> experiencias, boolean isEn, boolean excluir, DesignStyles st) {
        if (excluir || experiencias == null || experiencias.isEmpty()) { removeSection(html, "EXPERIENCE"); return; }
        var sb = new StringBuilder();
        String tituloSec = isEn ? "Professional Experience" : "Experiencia Profesional";
        sb.append("<h2 style=\"").append(st.secTitle()).append("\">").append(esc(tituloSec)).append("</h2>");
        for (int idx = 0; idx < experiencias.size(); idx++) {
            var x = experiencias.get(idx);
            sb.append("<div style=\"").append(idx == 0 ? st.block() : st.blockRest()).append("\">");
            sb.append("<div style=\"").append(st.title()).append("\">").append(esc(x.getCargo()))
                    .append(" — <span style=\"").append(st.date()).append("\">")
                    .append(esc(fechas(x.getFechaInicio(), x.getFechaFin(), x.isActual(), isEn)))
                    .append("</span></div>");
            String subInfo = esc(x.getEmpresa());
            if (!isBlank(x.getCiudad())) {
                subInfo += " — " + esc(x.getCiudad());
            }
            sb.append("<div style=\"").append(st.subtitle()).append("\">").append(subInfo).append("</div>");
            if (!isBlank(x.getFunciones())) {
                var lineas = x.getFunciones().split("\n");
                sb.append("<ul style=\"").append(UL).append("\">");
                for (int i = 0; i < lineas.length; i++) {
                    var t = lineas[i].trim();
                    if (!t.isEmpty()) sb.append("<li style=\"").append(i == 0 ? LI_FIRST : LI_REST).append("\">").append(esc(t)).append("</li>");
                }
                sb.append("</ul>");
            }
            sb.append("</div>");
        }
        replaceSection(html, "EXPERIENCE", sb.toString());
    }

    private void injectarEducacion(StringBuilder html, Estudiante e, List<FormacionAdicional> formaciones, boolean isEn, boolean excluir, DesignStyles st) {
        if (excluir) { removeSection(html, "EDUCATION"); return; }
        var items = new ArrayList<String>();
        String tituloAcademico = primero(e.getTitulo(), e.getProgramaAcademico(), e.getAreaFormacion());
        if (!isBlank(tituloAcademico) || !isBlank(e.getInstitucionEducativa())) {
            var sb = new StringBuilder();
            sb.append("<div style=\"").append(st.block()).append("\">");
            sb.append("<div style=\"").append(st.title()).append("\">").append(esc(nvl(tituloAcademico, isEn ? "Academic Education" : "Formación académica"))).append("</div>");
            sb.append("<div style=\"").append(SUB_ITALIC).append("\">").append(esc(nvl(e.getInstitucionEducativa(), "")))
                    .append(!isBlank(e.getNivelEducativo()) ? " — " + esc(e.getNivelEducativo()) : "")
                    .append(!isBlank(e.getEstadoFormacion()) ? " (" + esc(e.getEstadoFormacion()) + ")" : "")
                    .append("</div>");
            sb.append("</div>");
            items.add(sb.toString());
        }
        if (formaciones != null) {
            for (var f : formaciones) {
                if (!"CERTIFICACION".equalsIgnoreCase(f.getTipo()) && !"CURSO".equalsIgnoreCase(f.getTipo())) {
                    var sb = new StringBuilder();
                    sb.append("<div style=\"margin-top:6pt;page-break-inside:avoid;\">");
                    sb.append("<div style=\"").append(st.title()).append("\">").append(esc(f.getPrograma())).append("</div>");
                    sb.append("<div style=\"").append(SUB_ITALIC).append("\">").append(esc(f.getInstitucion()))
                            .append(f.getFechaFin() != null ? " — " + f.getFechaFin().getYear() : "")
                            .append("</div>");
                    sb.append("</div>");
                    items.add(sb.toString());
                }
            }
        }
        if (items.isEmpty()) { removeSection(html, "EDUCATION"); return; }
        var sb = new StringBuilder();
        String tituloSec = isEn ? "Education" : "Educación";
        sb.append("<h2 style=\"").append(st.secTitle()).append("\">").append(esc(tituloSec)).append("</h2>");
        sb.append(String.join("", items));
        replaceSection(html, "EDUCATION", sb.toString());
    }

    private void injectarCertificaciones(StringBuilder html, List<FormacionAdicional> formaciones, boolean isEn, boolean excluir, DesignStyles st) {
        if (excluir || formaciones == null || formaciones.isEmpty()) { removeSection(html, "CERTIFICATIONS"); return; }
        var certs = formaciones.stream()
                .filter(f -> "CERTIFICACION".equalsIgnoreCase(f.getTipo()) || "CURSO".equalsIgnoreCase(f.getTipo()))
                .toList();
        if (certs.isEmpty()) { removeSection(html, "CERTIFICATIONS"); return; }
        var sb = new StringBuilder();
        String tituloSec = isEn ? "Continuing Education & Certifications" : "Educación Continua y Certificaciones";
        sb.append("<h2 style=\"").append(st.secTitle()).append("\">").append(esc(tituloSec)).append("</h2>");
        sb.append("<ul style=\"").append(UL_WIDE).append("\">");
        for (int i = 0; i < certs.size(); i++) {
            var c = certs.get(i);
            sb.append("<li style=\"").append(i == 0 ? LI_FIRST : LI_REST).append("\">").append(esc(c.getPrograma()))
                    .append(" — ").append(esc(c.getInstitucion()))
                    .append(c.getFechaFin() != null ? ", " + c.getFechaFin().getYear() : "")
                    .append("</li>");
        }
        sb.append("</ul>");
        replaceSection(html, "CERTIFICATIONS", sb.toString());
    }

    private void injectarAchievements(StringBuilder html, List<String> logros, boolean isEn, boolean excluir, DesignStyles st) {
        var items = logros == null ? List.<String>of()
                : logros.stream().filter(l -> !isBlank(l)).map(String::trim).toList();
        if (excluir || items.isEmpty()) { removeSection(html, "ACHIEVEMENTS"); return; }
        var sb = new StringBuilder();
        String tituloSec = isEn ? "Key Achievements" : "Logros Destacados";
        sb.append("<h2 style=\"").append(st.secTitle()).append("\">").append(esc(tituloSec)).append("</h2>");
        sb.append("<ul style=\"").append(UL_WIDE).append("\">");
        for (int i = 0; i < items.size(); i++) {
            sb.append("<li style=\"").append(i == 0 ? LI_FIRST : LI_REST).append("\">")
                    .append(esc(items.get(i))).append("</li>");
        }
        sb.append("</ul>");
        replaceSection(html, "ACHIEVEMENTS", sb.toString());
    }

    private void injectarSkills(StringBuilder html, String competencias, boolean isEn, boolean excluir, DesignStyles st) {
        if (excluir || isBlank(competencias)) { removeSection(html, "SKILLS"); return; }
        var lineas = separarCompetencias(competencias);
        if (lineas.isEmpty()) { removeSection(html, "SKILLS"); return; }
        var sb = new StringBuilder();
        String tituloSec = isEn ? "Technical Skills" : "Habilidades Técnicas";
        sb.append("<h2 style=\"").append(st.secTitle()).append("\">").append(esc(tituloSec)).append("</h2>");
        sb.append("<ul style=\"").append(UL_WIDE).append("\">");
        for (int i = 0; i < lineas.size(); i++) {
            var t = lineas.get(i);
            sb.append("<li style=\"").append(i == 0 ? LI_FIRST : LI_REST).append("\">");
            if (t.contains(":")) {
                var p = t.split(":", 2);
                sb.append("<strong>").append(esc(p[0].trim())).append(":</strong> ").append(esc(p[1].trim()));
            } else {
                sb.append(esc(t));
            }
            sb.append("</li>");
        }
        sb.append("</ul>");
        replaceSection(html, "SKILLS", sb.toString());
    }

    /**
     * Una competencia por línea; si no hay saltos, se parte por comas o puntos
     * y coma.
     *
     * <p>El formulario del estudiante y las importaciones de Excel entregan este
     * campo de las dos formas. Partir solo por {@code \n} dejaba "Excel
     * avanzado, Power BI, SQL" como una única viñeta larguísima, que es justo lo
     * contrario de lo que un ATS espera encontrar.
     *
     * <p>Las líneas con dos puntos se respetan enteras: "Ofimática: Excel, Word"
     * es una agrupación deliberada y partirla por la coma la destrozaría.
     */
    private static List<String> separarCompetencias(String competencias) {
        var salida = new ArrayList<String>();
        for (var linea : competencias.split("\\r?\\n")) {
            var t = linea.trim();
            if (t.isEmpty()) continue;
            if (t.contains(":")) { salida.add(t); continue; }
            for (var pieza : t.split("[;,]")) {
                var p = pieza.trim();
                if (!p.isEmpty()) salida.add(p);
            }
        }
        return salida;
    }

    /**
     * Idiomas declarados más el nivel de inglés del catálogo.
     *
     * <p>El nivel de inglés es el dato que más consulta un reclutador de este
     * programa y vivía solo en la ficha: si el estudiante no lo repetía a mano
     * en el campo libre de idiomas, no aparecía en el PDF. Se añade solo cuando
     * el texto libre no lo menciona ya, para no imprimir "Inglés B2 · Inglés B2".
     */
    private void injectarLanguages(StringBuilder html, String idiomas, String nivelIngles, boolean isEn, boolean excluir, DesignStyles st) {
        if (excluir) { removeSection(html, "LANGUAGES"); return; }
        var partes = new ArrayList<String>();
        if (!isBlank(idiomas)) partes.add(idiomas.trim());
        if (!isBlank(nivelIngles)
                && (isBlank(idiomas) || !idiomas.toLowerCase(Locale.ROOT).contains("ingl"))) {
            partes.add((isEn ? "English: " : "Inglés: ") + nivelIngles.trim());
        }
        if (partes.isEmpty()) { removeSection(html, "LANGUAGES"); return; }
        String tituloSec = isEn ? "Languages" : "Idiomas";
        replaceSection(html, "LANGUAGES",
                "<h2 style=\"" + st.secTitle() + "\">" + esc(tituloSec) + "</h2>"
                + "<p style=\"" + st.par() + "\">" + esc(String.join(" · ", partes)) + "</p>");
    }

    private void injectarExperienciasDto(StringBuilder html, List<ExperienciaDto> experiencias, boolean isEn, boolean excluir, DesignStyles st) {
        if (excluir || experiencias == null || experiencias.isEmpty()) { removeSection(html, "EXPERIENCE"); return; }
        var sb = new StringBuilder();
        String tituloSec = isEn ? "Professional Experience" : "Experiencia Profesional";
        sb.append("<h2 style=\"").append(st.secTitle()).append("\">").append(esc(tituloSec)).append("</h2>");
        for (int idx = 0; idx < experiencias.size(); idx++) {
            var x = experiencias.get(idx);
            sb.append("<div style=\"").append(idx == 0 ? st.block() : st.blockRest()).append("\">");
            String fechasStr = nvl(x.fechaInicio(), "") + (x.actual() ? (isEn ? " – Present" : " – Presente") : (isBlank(x.fechaFin()) ? "" : " – " + x.fechaFin()));
            sb.append("<div style=\"").append(st.title()).append("\">").append(esc(x.cargo()))
                    .append(fechasStr.isBlank() ? "" : " — <span style=\"" + st.date() + "\">" + esc(fechasStr) + "</span>")
                    .append("</div>");
            sb.append("<div style=\"").append(st.subtitle()).append("\">").append(esc(x.empresa())).append("</div>");
            if (!isBlank(x.funciones())) {
                var lineas = x.funciones().split("\n");
                sb.append("<ul style=\"").append(UL).append("\">");
                for (int i = 0; i < lineas.length; i++) {
                    var t = lineas[i].trim();
                    if (!t.isEmpty()) sb.append("<li style=\"").append(i == 0 ? LI_FIRST : LI_REST).append("\">").append(esc(t)).append("</li>");
                }
                sb.append("</ul>");
            }
            sb.append("</div>");
        }
        replaceSection(html, "EXPERIENCE", sb.toString());
    }

    private void injectarEducacionDto(StringBuilder html, DatosHvDto d, List<FormacionDto> formaciones, boolean isEn, boolean excluir, DesignStyles st) {
        if (excluir) { removeSection(html, "EDUCATION"); return; }
        var items = new ArrayList<String>();
        if (!isBlank(d.titulo()) || !isBlank(d.institucionEducativa())) {
            var sb = new StringBuilder();
            sb.append("<div style=\"").append(st.block()).append("\">");
            sb.append("<div style=\"").append(st.title()).append("\">").append(esc(nvl(d.titulo(), isEn ? "Academic Education" : "Formación académica"))).append("</div>");
            sb.append("<div style=\"").append(SUB_ITALIC).append("\">").append(esc(nvl(d.institucionEducativa(), "")))
                    .append(!isBlank(d.nivelEducativo()) ? " — " + esc(d.nivelEducativo()) : "")
                    .append("</div>");
            sb.append("</div>");
            items.add(sb.toString());
        }
        if (formaciones != null) {
            for (var f : formaciones) {
                if (!"CERTIFICACION".equalsIgnoreCase(f.tipo()) && !"CURSO".equalsIgnoreCase(f.tipo())) {
                    var sb = new StringBuilder();
                    sb.append("<div style=\"margin-top:6pt;page-break-inside:avoid;\">");
                    sb.append("<div style=\"").append(st.title()).append("\">").append(esc(f.programa())).append("</div>");
                    sb.append("<div style=\"").append(SUB_ITALIC).append("\">").append(esc(f.institucion()))
                            .append(!isBlank(f.fechaFin()) ? " — " + f.fechaFin() : "")
                            .append("</div>");
                    sb.append("</div>");
                    items.add(sb.toString());
                }
            }
        }
        if (items.isEmpty()) { removeSection(html, "EDUCATION"); return; }
        var sb = new StringBuilder();
        String tituloSec = isEn ? "Education" : "Educación";
        sb.append("<h2 style=\"").append(st.secTitle()).append("\">").append(esc(tituloSec)).append("</h2>");
        sb.append(String.join("", items));
        replaceSection(html, "EDUCATION", sb.toString());
    }

    private void injectarCertificacionesDto(StringBuilder html, List<FormacionDto> formaciones, boolean isEn, boolean excluir, DesignStyles st) {
        if (excluir || formaciones == null || formaciones.isEmpty()) { removeSection(html, "CERTIFICATIONS"); return; }
        var certs = formaciones.stream()
                .filter(f -> "CERTIFICACION".equalsIgnoreCase(f.tipo()) || "CURSO".equalsIgnoreCase(f.tipo()))
                .toList();
        if (certs.isEmpty()) { removeSection(html, "CERTIFICATIONS"); return; }
        var sb = new StringBuilder();
        String tituloSec = isEn ? "Continuing Education & Certifications" : "Educación Continua y Certificaciones";
        sb.append("<h2 style=\"").append(st.secTitle()).append("\">").append(esc(tituloSec)).append("</h2>");
        sb.append("<ul style=\"").append(UL_WIDE).append("\">");
        for (int i = 0; i < certs.size(); i++) {
            var c = certs.get(i);
            sb.append("<li style=\"").append(i == 0 ? LI_FIRST : LI_REST).append("\">").append(esc(c.programa()))
                    .append(" — ").append(esc(c.institucion()))
                    .append(!isBlank(c.fechaFin()) ? ", " + c.fechaFin() : "")
                    .append("</li>");
        }
        sb.append("</ul>");
        replaceSection(html, "CERTIFICATIONS", sb.toString());
    }

    private String seleccionarPlantilla(String codigo) {
        if ("CLASICO_FOTO".equalsIgnoreCase(codigo)) return plantillaClasicoFoto;
        if ("MODERNO".equalsIgnoreCase(codigo)) return plantillaModerno;
        return plantillaCacFlat;
    }

    private void injectarFoto(StringBuilder html, String fotoBase64) {
        if (fotoBase64 != null && !fotoBase64.isBlank()) {
            String circularPngBase64 = convertirACirculoPngBase64(fotoBase64);
            String srcData = circularPngBase64 != null ? "data:image/png;base64," + circularPngBase64 : "data:image/jpeg;base64," + fotoBase64;
            String fotoHtml = "<td style=\"width:75pt;padding:12pt 0 12pt 16pt;vertical-align:middle;text-align:center;\"><img src=\""
                    + srcData + "\" style=\"width:65pt;height:65pt;display:block;margin:0 auto;\" alt=\"Foto\" /></td>";
            reemplazar(html, "{{PHOTO_CONTAINER}}", fotoHtml);
        } else {
            reemplazar(html, "{{PHOTO_CONTAINER}}", "");
        }
    }

    private String convertirACirculoPngBase64(String base64) {
        try {
            byte[] bytes = java.util.Base64.getDecoder().decode(base64);
            java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(bytes);
            java.awt.image.BufferedImage src = javax.imageio.ImageIO.read(bais);
            if (src == null) return null;

            // La foto se muestra a 65pt (~87px). Sin downscale, una foto de
            // 6000x6000 creaba dos BufferedImage ARGB de ~144MB por request y
            // la generacion masiva de 500 estudiantes podia agotar el heap.
            final int MAX = 300;
            if (src.getWidth() > MAX || src.getHeight() > MAX) {
                double escala = Math.min((double) MAX / src.getWidth(), (double) MAX / src.getHeight());
                int ancho = Math.max(1, (int) (src.getWidth() * escala));
                int alto = Math.max(1, (int) (src.getHeight() * escala));
                var reducida = new java.awt.image.BufferedImage(ancho, alto, java.awt.image.BufferedImage.TYPE_INT_RGB);
                var g0 = reducida.createGraphics();
                g0.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g0.drawImage(src, 0, 0, ancho, alto, null);
                g0.dispose();
                src = reducida;
            }

            int size = Math.min(src.getWidth(), src.getHeight());
            java.awt.image.BufferedImage circleImg = new java.awt.image.BufferedImage(size, size, java.awt.image.BufferedImage.TYPE_INT_ARGB);
            java.awt.Graphics2D g2 = circleImg.createGraphics();
            g2.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);

            // Clip to circle
            g2.setClip(new java.awt.geom.Ellipse2D.Float(0, 0, size, size));
            int offsetX = (src.getWidth() - size) / 2;
            int offsetY = (src.getHeight() - size) / 2;
            g2.drawImage(src, -offsetX, -offsetY, null);
            g2.setClip(null);

            // Draw smooth white circular border ring
            float strokeWidth = Math.max(4.0f, size / 25.0f);
            g2.setStroke(new java.awt.BasicStroke(strokeWidth));
            g2.setColor(java.awt.Color.WHITE);
            g2.draw(new java.awt.geom.Ellipse2D.Float(strokeWidth / 2.0f, strokeWidth / 2.0f, size - strokeWidth, size - strokeWidth));

            g2.dispose();

            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(circleImg, "png", baos);
            return java.util.Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }
    private static String nvl(String s, String def) { return isBlank(s) ? def : s; }

    /** El primero de los candidatos que traiga algo. */
    private static String primero(String... candidatos) {
        for (var c : candidatos) if (!isBlank(c)) return c.trim();
        return null;
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    private static String lineaContactoVertical(String ciudadPais, String telefono, String email,
                                                String linkedinUrl, String portafolioUrl) {
        var partes = new ArrayList<String>();
        if (!isBlank(ciudadPais)) partes.add("<strong>Ubicación:</strong> " + esc(ciudadPais));
        if (!isBlank(telefono)) partes.add("<strong>Teléfono:</strong> " + esc(telefono));
        if (!isBlank(email)) partes.add("<strong>Email:</strong> " + esc(email));
        if (!isBlank(linkedinUrl)) partes.add("<strong>LinkedIn:</strong> " + enlace(linkedinUrl, "Ver Perfil"));
        if (!isBlank(portafolioUrl)) partes.add("<strong>Portafolio:</strong> " + enlace(portafolioUrl, "Ver Trabajos"));
        return String.join("<br style='margin-bottom:4pt;'/>", partes);
    }

    private static String lineaContacto(String ciudadPais, String telefono, String email,
                                        String linkedinUrl, String portafolioUrl) {
        var partes = new ArrayList<String>();
        if (!isBlank(ciudadPais)) partes.add(esc(ciudadPais));
        if (!isBlank(telefono)) partes.add(esc(telefono));
        if (!isBlank(linkedinUrl)) partes.add(enlace(linkedinUrl, "LinkedIn"));
        if (!isBlank(portafolioUrl)) partes.add(enlace(portafolioUrl, "Portafolio"));
        if (!isBlank(email)) partes.add(esc(email));
        return String.join(SEP, partes);
    }

    private DesignStyles resolverEstilos(String codigo) {
        if ("CLASICO_FOTO".equalsIgnoreCase(codigo)) {
            return new DesignStyles(
                    "font-size:12pt;font-weight:700;color:#1E3A8A;text-transform:uppercase;border-left:4pt solid #D97706;padding-left:7pt;margin:14pt 0 6pt 0;letter-spacing:.5pt;",
                    "font-size:12pt;font-weight:700;color:#1E3A8A;text-transform:uppercase;border-left:4pt solid #D97706;padding-left:7pt;margin:8pt 0 6pt 0;letter-spacing:.5pt;",
                    "font-size:11pt;font-weight:700;color:#1E293B;",
                    "font-size:10.5pt;font-weight:700;color:#D97706;",
                    "font-size:9.5pt;color:#64748B;font-style:italic;",
                    "margin:4pt 0 0 0;font-size:10.5pt;line-height:14.5pt;color:#334155;",
                    "margin-top:6pt;page-break-inside:avoid;",
                    "margin-top:10pt;page-break-inside:avoid;"
            );
        }
        if ("MODERNO".equalsIgnoreCase(codigo)) {
            return new DesignStyles(
                    "font-size:10.5pt;font-weight:700;color:#0F172A;text-transform:uppercase;background:#F1F5F9;border-left:3pt solid #0284C7;padding:3pt 6pt;margin:10pt 0 5pt 0;letter-spacing:.5pt;border-radius:2pt;",
                    "font-size:10.5pt;font-weight:700;color:#0F172A;text-transform:uppercase;background:#F1F5F9;border-left:3pt solid #0284C7;padding:3pt 6pt;margin:4pt 0 5pt 0;letter-spacing:.5pt;border-radius:2pt;",
                    "font-size:10.5pt;font-weight:700;color:#0F172A;",
                    "font-size:10pt;font-weight:700;color:#0284C7;",
                    "font-size:9pt;color:#64748B;",
                    "margin:3pt 0 0 0;font-size:10pt;line-height:13.5pt;color:#334155;",
                    "margin-top:4pt;page-break-inside:avoid;",
                    "margin-top:8pt;page-break-inside:avoid;"
            );
        }
        // Default CAC_ATS
        return new DesignStyles(
                "font-size:13pt;font-weight:700;color:#1F4E79;text-transform:uppercase;border-bottom:1.5pt solid #E1251B;padding-bottom:2pt;margin:12pt 0 6pt 0;letter-spacing:.5pt;",
                "font-size:13pt;font-weight:700;color:#1F4E79;text-transform:uppercase;border-bottom:1.5pt solid #E1251B;padding-bottom:2pt;margin:8pt 0 6pt 0;letter-spacing:.5pt;",
                "font-size:11pt;font-weight:700;color:#000000;",
                "font-size:10.5pt;font-weight:700;color:#1F4E79;",
                "font-size:10pt;color:#E1251B;font-weight:700;",
                "margin:4pt 0 0 0;font-size:11pt;line-height:14.5pt;color:#000000;",
                "margin-top:6pt;page-break-inside:avoid;",
                "margin-top:10pt;page-break-inside:avoid;"
        );
    }

    private static String enlace(String url, String texto) {
        String limpia = url.trim();
        if (!limpia.startsWith("http://") && !limpia.startsWith("https://")) {
            limpia = "https://" + limpia;
        }
        return "<a href=\"" + esc(limpia) + "\" style=\"" + ENLACE + "\">" + esc(texto) + "</a>";
    }

    private static String ciudadPais(String ciudad, String nacionalidad) {
        if (isBlank(ciudad)) return isBlank(nacionalidad) ? "" : nacionalidad.trim();
        if (isBlank(nacionalidad)) return ciudad.trim();
        return ciudad.trim() + ", " + nacionalidad.trim();
    }

    private void replaceSection(StringBuilder html, String name, String content) {
        int start = html.indexOf("<!-- SECTION:" + name + " -->");
        if (start < 0) return;
        int end = html.indexOf("<!-- /SECTION:" + name + " -->", start);
        if (end < 0) {
            html.replace(start, start + ("<!-- SECTION:" + name + " -->").length(), content);
            return;
        }
        html.replace(start, end + ("<!-- /SECTION:" + name + " -->").length(), content);
    }

    private void removeSection(StringBuilder html, String name) {
        int start = html.indexOf("<!-- SECTION:" + name + " -->");
        if (start < 0) return;
        int end = html.indexOf("<!-- /SECTION:" + name + " -->", start);
        if (end >= 0) html.delete(start, end + ("<!-- /SECTION:" + name + " -->").length());
        else html.replace(start, start + ("<!-- SECTION:" + name + " -->").length(), "");
    }

    private void limpiarMarcadores(StringBuilder html) {
        String s = html.toString();
        s = s.replaceAll("<!-- ?/?(SECTION|LIST):\\w+ ?-->", "");
        html.setLength(0);
        html.append(s);
    }

    private static void reemplazar(StringBuilder html, String token, String valor) {
        int idx = html.indexOf(token);
        while (idx >= 0) {
            html.replace(idx, idx + token.length(), valor);
            idx = html.indexOf(token, idx + valor.length());
        }
    }

    private static String nombreCompleto(Estudiante e) {
        return (nvl(e.getNombre(), "") + " " + nvl(e.getApellido(), "")).trim();
    }

    private static String fechas(LocalDate inicio, LocalDate fin, boolean actual) {
        return fechas(inicio, fin, actual, false);
    }

    private static String fechas(LocalDate inicio, LocalDate fin, boolean actual, boolean isEn) {
        var i = inicio != null ? FMT.format(inicio) : "";
        var f = fin != null ? FMT.format(fin) : (actual ? (isEn ? "Present" : "Presente") : "");
        if (i.isEmpty() && f.isEmpty()) return "";
        return i + (f.isEmpty() ? "" : " \u2013 " + f);
    }
}

