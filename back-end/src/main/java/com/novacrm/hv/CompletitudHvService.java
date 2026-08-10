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
            // Los campos manuales se listan pero no cuentan: ver `contable`.
            int contables = 0;
            int completos = 0;
            for (var f : sec.fields) {
                String valor = obtenerValor(f, data);
                boolean completo = !isBlank(valor);
                campos.add(new CampoCompletitud(f.placeholder, f.label, completo, valor, f.source));
                if (contable(f)) {
                    contables++;
                    if (completo) completos++;
                }
                if (f.required && !completo && contable(f)) {
                    recomendaciones.add("Agrega " + f.label.toLowerCase() + " en la sección " + sec.titulo);
                }
            }
            int pct = contables == 0 ? 100 : (completos * 100 / contables);
            secciones.add(new SeccionCompletitud(sec.id, sec.titulo, pct, completos, contables, campos));
            totalCompletos += completos;
            totalCampos += contables;
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
        // Los tres que el manifiesto pide por su nombre y aqui no se ponian:
        // el enlace de LinkedIn (que no es el identificador de la integracion),
        // la carpeta de portafolio y el nivel de ingles. Sin ellos, esas tres
        // casillas no habia forma de marcarlas.
        put(m, "linkedinUrl", e.getLinkedinUrl());
        put(m, "carpetaUrl", e.getCarpetaUrl());
        put(m, "nivelIngles", e.getNivelIngles());

        m.put("_tieneExperiencias", experiencias != null && !experiencias.isEmpty() ? "true" : null);
        m.put("_tieneFormaciones", formaciones != null && !formaciones.isEmpty() ? "true" : null);
        m.put("_tieneFunciones", experiencias != null && !experiencias.isEmpty()
                && !isBlank(experiencias.get(0).getFunciones()) ? "true" : null);

        // La experiencia y la formacion mas recientes, que es lo que el
        // manifiesto mide. Sin esto, `data.get("cargo")` devolvia nulo siempre y
        // esos campos no habia forma de completarlos —ni con la hoja de vida
        // entera cargada—, asi que la seccion de experiencia se quedaba en el
        // 20% para todo el mundo.
        //
        // Con el prefijo de la fuente porque «fechaFin» significa dos cosas
        // distintas: el fin del ultimo empleo y el año en que se termino de
        // estudiar. Sin prefijo, poner uno marcaba el otro por accidente.
        if (experiencias != null && !experiencias.isEmpty()) {
            var reciente = experiencias.get(0);
            put(m, "experiencia.cargo", reciente.getCargo());
            put(m, "experiencia.empresa", reciente.getEmpresa());
            put(m, "experiencia.fechaInicio", reciente.getFechaInicio());
            put(m, "experiencia.fechaFin", reciente.getFechaFin());
        }
        if (formaciones != null && !formaciones.isEmpty()) {
            var reciente = formaciones.get(0);
            put(m, "formacion.programa", reciente.getPrograma());
            put(m, "formacion.institucion", reciente.getInstitucion());
            put(m, "formacion.fechaInicio", reciente.getFechaInicio());
            put(m, "formacion.fechaFin", reciente.getFechaFin());
        }
        return m;
    }

    /**
     * Si un campo entra en la cuenta del porcentaje.
     *
     * <p>Los de fuente {@code manual} no: son los que se escriben directamente
     * en el editor —la ciudad de un empleo, un logro— y no viven en ninguna
     * tabla, asi que el sistema no puede saber si estan puestos. Contarlos como
     * incompletos dejaba la barra sin poder llegar nunca al 100 por mucho que
     * el estudiante rellenara, que es la forma mas rapida de que deje de
     * mirarla. Se siguen listando, y la pantalla ya los marca «(manual)».
     */
    private static boolean contable(ManifestField f) {
        return !"manual".equals(f.source);
    }

    private String obtenerValor(ManifestField f, Map<String, String> data) {
        if (f.source.equals("template")) return "true";
        if (f.source.equals("manual")) return null;

        if (f.entityField == null || f.entityField.isBlank()) return null;
        if (f.entityField.contains("+")) {
            var parts = f.entityField.split("\\+");
            var sb = new StringBuilder();
            for (var p : parts) {
                String v = valorDe(f, p.trim(), data);
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
                String v = valorDe(f, p.trim(), data);
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
        String v = valorDe(f, f.entityField, data);
        if ("competencias".equals(f.entityField)) {
            return isBlank(v) ? data.get("ultimoCargo") : v;
        }
        return v;
    }

    /**
     * Un campo del manifiesto, buscado primero dentro de su propia fuente.
     *
     * <p>El nombre solo no basta: «fechaFin» es el fin del ultimo empleo en la
     * seccion de experiencia y el año de graduacion en la de educacion. Las
     * fuentes {@code experiencia} y {@code formacion} guardan sus valores con
     * prefijo; {@code estudiante} los guarda sueltos, que es lo que ya habia.
     */
    private static String valorDe(ManifestField f, String campo, Map<String, String> data) {
        String propio = data.get(f.source + "." + campo);
        return propio != null ? propio : data.get(campo);
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
                    extractBooleano(fJson, "required"),
                    extractString(fJson, "source"),
                    extractString(fJson, "entityField"),
                    extractString(fJson, "maxLength")
            );
            fields.add(f);
        }
        return fields;
    }

    /**
     * Un valor booleano del manifiesto.
     *
     * <p>`extractString` busca la siguiente comilla despues de los dos puntos,
     * asi que con `"required": true` —que es como se escribe un booleano en
     * JSON— se saltaba el valor y devolvia el nombre de la clave siguiente.
     * Trece campos marcados como obligatorios se leian como opcionales, y la
     * lista de «que te falta» salia sin ninguno de ellos: la pantalla decia el
     * porcentaje pero nunca decia que rellenar. Como abajo siempre hay dos o
     * tres consejos generales, parecia que funcionaba.
     */
    static boolean extractBooleano(String json, String key) {
        var k = "\"" + key + "\"";
        int idx = json.indexOf(k);
        if (idx < 0) return false;
        idx = json.indexOf(':', idx + k.length());
        if (idx < 0) return false;
        int fin = idx + 1;
        while (fin < json.length() && ",}]\n\r".indexOf(json.charAt(fin)) < 0) {
            fin++;
        }
        return "true".equals(json.substring(idx + 1, fin).trim().replace("\"", ""));
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
