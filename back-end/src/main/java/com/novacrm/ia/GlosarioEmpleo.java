package com.novacrm.ia;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * El vocabulario con el que esta cohorte se postula, en los dos idiomas.
 *
 * <p>No es un traductor: es la lista corta de terminos que aparecen una y otra
 * vez en una hoja de vida de BPO y servicio al cliente, que es a lo que aspira
 * la mayoria del programa. Para eso una tabla es mejor que un modelo, porque
 * las traducciones que importan aqui son las que un traductor generico hace
 * mal: "servicio al cliente" no es "client service", y una hoja de vida que lo
 * diga asi se lee como traduccion automatica desde el primer renglon.
 *
 * <p>Cuando hay proveedor de IA esto entra al prompt como vocabulario
 * preferido. Cuando no lo hay, es la respuesta.
 */
public final class GlosarioEmpleo {

    /** @param es termino en espanol, @param en como se escribe en una oferta real */
    public record Termino(String es, String en, String nota) {

        String comoLinea() {
            return nota == null || nota.isBlank()
                    ? "- %s = %s".formatted(es, en)
                    : "- %s = %s (%s)".formatted(es, en, nota);
        }
    }

    /**
     * Orden de insercion a proposito: se recorre buscando la frase mas larga
     * primero, para que "servicio al cliente" gane a "cliente".
     */
    private static final List<Termino> TERMINOS = List.of(
            new Termino("servicio al cliente", "customer service", null),
            new Termino("atencion al cliente", "customer support", null),
            new Termino("asesor de servicio al cliente", "customer service representative",
                    "en las ofertas aparece abreviado como CSR"),
            new Termino("agente de call center", "call center agent", null),
            new Termino("centro de llamadas", "call center", null),
            new Termino("linea de atencion", "helpdesk", null),
            new Termino("soporte tecnico", "technical support", null),
            new Termino("mesa de ayuda", "help desk", null),
            new Termino("ventas", "sales", null),
            new Termino("cobranza", "collections", null),
            new Termino("facturacion", "billing", null),
            new Termino("reclamo", "complaint", null),
            new Termino("queja", "complaint", null),
            new Termino("resolucion de problemas", "problem solving", null),
            new Termino("trabajo en equipo", "teamwork", "en la hoja de vida es mejor demostrarlo que nombrarlo"),
            new Termino("manejo de personal", "team leadership", null),
            new Termino("hoja de vida", "resume", "en Estados Unidos resume; en Reino Unido CV"),
            new Termino("carta de presentacion", "cover letter", null),
            new Termino("perfil profesional", "professional summary",
                    "va arriba del todo y ocupa dos o tres renglones"),
            new Termino("experiencia laboral", "work experience", null),
            new Termino("formacion academica", "education", null),
            new Termino("logros", "achievements", null),
            new Termino("referencias", "references", null),
            new Termino("practicas", "internship", null),
            new Termino("pasantia", "internship", null),
            new Termino("tiempo completo", "full time", null),
            new Termino("medio tiempo", "part time", null),
            new Termino("turnos rotativos", "rotating shifts", null),
            new Termino("disponibilidad inmediata", "immediate availability", null),
            new Termino("contrato a termino indefinido", "permanent contract", null),
            new Termino("contrato a termino fijo", "fixed term contract", null),
            new Termino("trabajo remoto", "remote work", null),
            new Termino("trabajo presencial", "on site", null),
            new Termino("trabajo hibrido", "hybrid", null),
            new Termino("salario", "salary", null),
            new Termino("pretension salarial", "salary expectation", null),
            new Termino("entrevista", "interview", null),
            new Termino("postularse", "to apply", "apply to a job, no apply for the job"),
            new Termino("vacante", "job opening", null),
            new Termino("empresa", "company", null),
            new Termino("jefe inmediato", "direct manager", null),
            new Termino("bilingue", "bilingual", null),
            new Termino("ingles conversacional", "conversational english", null),
            new Termino("nivel intermedio", "intermediate level", "en una oferta se escribe el nivel MCER: B1, B2"),
            new Termino("manejo de", "proficient in", "para herramientas: proficient in Excel"),
            new Termino("encargado de", "responsible for",
                    "en la hoja de vida es mejor un verbo de accion: managed, resolved, handled"));

    private GlosarioEmpleo() {
    }

    /** El glosario entero, para colgarlo del prompt. */
    public static String resumenParaPrompt() {
        StringBuilder sb = new StringBuilder();
        for (Termino t : TERMINOS) {
            sb.append(t.comoLinea()).append('\n');
        }
        return sb.toString();
    }

    /**
     * Los terminos del glosario que aparecen en el texto, en cualquiera de los
     * dos idiomas.
     *
     * <p>Se queda con la frase mas larga que encaja y descarta las que estan
     * contenidas en ella, porque de otro modo "servicio al cliente" respondia
     * tambien "cliente" y "servicio" y la respuesta se llenaba de ruido.
     */
    public static List<Termino> encontrar(String texto) {
        String normalizado = normalizar(texto);
        if (normalizado.isBlank()) return List.of();

        Map<String, Termino> hallados = new LinkedHashMap<>();
        List<Termino> porLongitud = new ArrayList<>(TERMINOS);
        porLongitud.sort((a, b) -> Integer.compare(
                Math.max(b.es().length(), b.en().length()),
                Math.max(a.es().length(), a.en().length())));

        StringBuilder consumido = new StringBuilder(normalizado);
        for (Termino t : porLongitud) {
            String es = normalizar(t.es());
            String en = normalizar(t.en());
            int posicion = consumido.indexOf(es);
            if (posicion < 0) posicion = consumido.indexOf(en);
            if (posicion < 0) continue;
            hallados.putIfAbsent(t.es(), t);
            // Se tacha lo ya reconocido para que un termino corto no vuelva a
            // encontrarse dentro de uno largo que ya se conto.
            int largo = consumido.indexOf(es) >= 0 ? es.length() : en.length();
            consumido.replace(posicion, posicion + largo, " ".repeat(largo));
        }
        return List.copyOf(hallados.values());
    }

    /** Las equivalencias encontradas, ya redactadas para responder sin modelo. */
    public static String comoTexto(List<Termino> encontrados) {
        if (encontrados.isEmpty()) {
            return """
                    No reconoci terminos de empleabilidad en ese texto. Escribeme la palabra o la \
                    frase que quieres traducir para tu hoja de vida y te doy la forma en que aparece \
                    de verdad en las ofertas, que no siempre es la traduccion literal.""";
        }
        StringBuilder sb = new StringBuilder("Asi se dice en una oferta real:\n");
        for (Termino t : encontrados) {
            sb.append(t.comoLinea()).append('\n');
        }
        return sb.toString().trim();
    }

    private static String normalizar(String texto) {
        if (texto == null) return "";
        String sinTildes = Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return sinTildes.toLowerCase(Locale.ROOT);
    }
}
