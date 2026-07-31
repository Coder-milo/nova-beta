package com.novacrm.hv;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.hv.dto.AnalisisCompletitudResponse;
import com.novacrm.hv.dto.CampoCompletitud;
import com.novacrm.hv.dto.SeccionCompletitud;
import com.novacrm.perfil.ExperienciaLaboral;
import com.novacrm.perfil.FormacionAdicional;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Analiza qué tan completo está el perfil de un estudiante
 * para la plantilla CAC ATS y genera recomendaciones.
 */
@Service
public class CompletitudHvService {

    @PersistenceContext
    private EntityManager em;

    private final List<ManifestSection> sections;

    public CompletitudHvService() {
        try {
            String json = new ClassPathResource("templates/hv/resume-ats-cac-manifest.json")
                    .getContentAsString(StandardCharsets.UTF_8);
            this.sections = parseManifest(json);
        } catch (IOException e) {
            throw new RuntimeException("No se pudo cargar el field manifest", e);
        }
    }

    public AnalisisCompletitudResponse analizar(Estudiante e) {
        var formaciones = em.createQuery(
                "SELECT f FROM FormacionAdicional f WHERE f.estudiante.id = :id ORDER BY f.fechaInicio DESC",
                FormacionAdicional.class).setParameter("id", e.getId()).getResultList();
        var experiencias = em.createQuery(
                "SELECT x FROM ExperienciaLaboral x WHERE x.estudiante.id = :id ORDER BY x.fechaInicio DESC",
                ExperienciaLaboral.class).setParameter("id", e.getId()).getResultList();

        var data = buildData(e, formaciones, experiencias);

        var secciones = new ArrayList<SeccionCompletitud>();
        var recomendaciones = new ArrayList<String>();

        int totalCompletos = 0;
        int totalCampos = 0;

        for (var sec : sections) {
            var campos = new ArrayList<CampoCompletitud>();
            for (var f : sec.fields) {
                String valor = obtenerValor(f, data);
                boolean completo = !isBlank(valor);
                campos.add(new CampoCompletitud(f.placeholder, f.label, completo, valor, f.source));
                if (f.required && !completo) {
                    recomendaciones.add("Agrega " + f.label.toLowerCase() + " en la sección " + sec.titulo);
                }
            }
            int completos = (int) campos.stream().filter(CampoCompletitud::completo).count();
            int pct = campos.isEmpty() ? 100 : (completos * 100 / campos.size());
            secciones.add(new SeccionCompletitud(sec.id, sec.titulo, pct, completos, campos.size(), campos));
            totalCompletos += completos;
            totalCampos += campos.size();
        }

        int pctTotal = totalCampos == 0 ? 100 : (totalCompletos * 100 / totalCampos);

        if (experiencias.isEmpty() && !isBlank(e.getUltimoCargo())) {
            recomendaciones.add("Registra las experiencias laborales con fechas y logros en la sección Experiencia");
        }
        if (experiencias.size() > 0 && isBlank(experiencias.get(0).getFunciones())) {
            recomendaciones.add("Agrega logros medibles (con métricas) a tu experiencia laboral más reciente");
        }
        if (isBlank(e.getIdiomas())) {
            recomendaciones.add("Indica tu nivel de idiomas (inglés u otros) para mejorar tu perfil ATS");
        }

        var datosMap = new LinkedHashMap<String, Object>();
        datosMap.put("nombre", e.getNombre() + " " + e.getApellido());
        datosMap.put("email", e.getEmail());
        datosMap.put("celular", e.getCelular());
        datosMap.put("telefono", e.getTelefono());
        datosMap.put("ciudad", e.getCiudad());
        datosMap.put("cargoObjetivo", e.getCargoObjetivo());
        datosMap.put("perfilProfesional", e.getPerfilProfesional());
        datosMap.put("competencias", e.getCompetencias());
        datosMap.put("idiomas", e.getIdiomas());
        datosMap.put("nivelEducativo", e.getNivelEducativo());
        datosMap.put("titulo", e.getTitulo());
        datosMap.put("institucionEducativa", e.getInstitucionEducativa());
        datosMap.put("experiencias", experiencias.size());
        datosMap.put("formaciones", formaciones.size());

        return new AnalisisCompletitudResponse("Resume ATS CAC", pctTotal,
                secciones, recomendaciones, datosMap);
    }

    private Map<String, String> buildData(Estudiante e, List<FormacionAdicional> formaciones,
                                          List<ExperienciaLaboral> experiencias) {
        var m = new HashMap<String, String>();
        put(m, "nombre", e.getNombre());
        put(m, "apellido", e.getApellido());
        put(m, "email", e.getEmail());
        put(m, "celular", e.getCelular());
        put(m, "telefono", e.getTelefono());
        put(m, "ciudad", e.getCiudad());
        put(m, "cargoObjetivo", e.getCargoObjetivo());
        put(m, "perfilProfesional", e.getPerfilProfesional());
        put(m, "competencias", e.getCompetencias());
        put(m, "idiomas", e.getIdiomas());
        put(m, "titulo", e.getTitulo());
        put(m, "institucionEducativa", e.getInstitucionEducativa());
        put(m, "nivelEducativo", e.getNivelEducativo());
        put(m, "ultimoCargo", e.getUltimoCargo());
        put(m, "aniosExperiencia", e.getAniosExperiencia() != null ? String.valueOf(e.getAniosExperiencia()) : null);
        put(m, "linkedinUserId", e.getLinkedinUserId());
        put(m, "nacionalidad", e.getNacionalidad());

        m.put("_tieneExperiencias", experiencias != null && !experiencias.isEmpty() ? "true" : null);
        m.put("_tieneFormaciones", formaciones != null && !formaciones.isEmpty() ? "true" : null);
        m.put("_tieneFunciones", experiencias != null && !experiencias.isEmpty()
                && !isBlank(experiencias.get(0).getFunciones()) ? "true" : null);
        return m;
    }

    private String obtenerValor(ManifestField f, Map<String, String> data) {
        if (f.source.equals("template")) return "true";
        if (f.source.equals("manual")) return null;

        if (f.entityField == null || f.entityField.isBlank()) return null;
        if (f.entityField.contains("+")) {
            var parts = f.entityField.split("\\+");
            var sb = new StringBuilder();
            for (var p : parts) {
                String v = data.get(p.trim());
                if (!isBlank(v)) {
                    if (!sb.isEmpty()) sb.append(" ");
                    sb.append(v);
                }
            }
            return sb.isEmpty() ? null : sb.toString();
        }
        if (f.entityField.contains("|")) {
            // Alternativas: el valor que exista ("celular | telefono").
            for (var p : f.entityField.split("\\|")) {
                String v = data.get(p.trim());
                if (!isBlank(v)) return v;
            }
            return null;
        }
        if ("_tieneExperiencias".equals(f.entityField)) {
            return data.get("_tieneExperiencias");
        }
        if ("_tieneFormaciones".equals(f.entityField)) {
            return data.get("_tieneFormaciones");
        }
        if ("funciones".equals(f.entityField)) {
            return data.get("_tieneFunciones");
        }
        String v = data.get(f.entityField);
        if ("competencias".equals(f.entityField)) {
            return isBlank(v) ? data.get("ultimoCargo") : v;
        }
        return v;
    }
    private static void put(Map<String, String> m, String k, Object v) {
        m.put(k, v != null ? v.toString() : null);
    }
    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    // ── Manifest parser (lightweight, no Jackson dependency needed in this path) ──

    private static List<ManifestSection> parseManifest(String json) {
        var sections = new ArrayList<ManifestSection>();
        var secs = extractJsonArray(json, "sections");
        for (var secJson : secs) {
            var sec = new ManifestSection(
                    extractString(secJson, "id"),
                    extractString(secJson, "title"),
                    parseFields(secJson)
            );
            sections.add(sec);
        }
        return sections;
    }

    private static List<ManifestField> parseFields(String secJson) {
        var fields = new ArrayList<ManifestField>();
        var fieldArray = extractJsonArray(secJson, "fields");
        for (var fJson : fieldArray) {
            var f = new ManifestField(
                    extractString(fJson, "placeholder"),
                    extractString(fJson, "label"),
                    extractString(fJson, "type"),
                    "true".equals(extractString(fJson, "required")),
                    extractString(fJson, "source"),
                    extractString(fJson, "entityField"),
                    extractString(fJson, "maxLength")
            );
            fields.add(f);
        }
        return fields;
    }

    // Minimal JSON helpers (no Jackson)
    private static String extractString(String json, String key) {
        var k = "\"" + key + "\"";
        int idx = json.indexOf(k);
        if (idx < 0) return "";
        idx = json.indexOf(':', idx + k.length());
        if (idx < 0) return "";
        idx = json.indexOf('"', idx + 1);
        if (idx < 0) return "";
        int end = json.indexOf('"', idx + 1);
        if (end < 0) return "";
        return json.substring(idx + 1, end);
    }

    private static List<String> extractJsonArray(String json, String key) {
        var result = new ArrayList<String>();
        var k = "\"" + key + "\"";
        int idx = json.indexOf(k);
        if (idx < 0) return result;
        idx = json.indexOf('[', idx + k.length());
        if (idx < 0) return result;
        int depth = 0;
        int start = -1;
        for (int i = idx; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '{') {
                if (depth == 0) start = i;
                depth++;
            } else if (c == '}') {
                depth--;
                if (depth == 0 && start >= 0) {
                    result.add(json.substring(start, i + 1));
                    start = -1;
                }
            }
        }
        return result;
    }

    private record ManifestSection(String id, String titulo, List<ManifestField> fields) {}
    private record ManifestField(String placeholder, String label, String type,
                                 boolean required, String source, String entityField,
                                 String maxLength) {}
}
