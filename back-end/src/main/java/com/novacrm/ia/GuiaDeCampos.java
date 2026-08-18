package com.novacrm.ia;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Que significa cada campo del CRM y como se llena para que sirva de algo.
 *
 * <p>El asistente de administracion no puede improvisar esto. Un modelo al que
 * se le pregunta "que pongo en nivel de ingles requerido" contesta algo
 * plausible —"basico, intermedio, avanzado"— y esa respuesta es exactamente la
 * que rompe el motor: el puntaje compara contra la escala MCER, y un
 * "intermedio" escrito a mano no compara con nada. Por eso el catalogo vive
 * aqui, en codigo, junto a los campos que describe, y el modelo lo recibe como
 * material de consulta en vez de tener que recordarlo.
 *
 * <p>Sirve para las dos mitades del asistente: se inyecta en el prompt cuando
 * hay proveedor de IA, y es la respuesta directa cuando no lo hay. Que la
 * version sin IA responda lo mismo que la version con IA es deliberado: la
 * clave de la API se acaba, y la guia de como llenar el CRM no puede
 * desaparecer con ella.
 */
public final class GuiaDeCampos {

    /**
     * @param modulo         donde se llena, con el nombre que ve el usuario
     * @param campo          etiqueta del campo en la pantalla
     * @param comoLlenarlo   formato o valores que espera
     * @param ejemplo        un valor real, escrito como debe quedar
     * @param porQueImporta  que deja de funcionar si se deja vacio o mal puesto
     */
    public record Campo(
            String modulo,
            String campo,
            String comoLlenarlo,
            String ejemplo,
            String porQueImporta,
            Set<String> palabrasClave) {

        /** Una linea compacta, que es como entra al prompt del modelo. */
        String comoLinea() {
            return "- %s > %s: %s. Ejemplo: \"%s\". Impacto: %s".formatted(
                    modulo, campo, comoLlenarlo, ejemplo, porQueImporta);
        }

        /** El texto que se le muestra a quien pregunta cuando no hay IA. */
        String comoRespuesta() {
            return "%s (%s): %s\nEjemplo: \"%s\".\nPor que importa: %s".formatted(
                    campo, modulo, comoLlenarlo, ejemplo, porQueImporta);
        }
    }

    /**
     * Los campos que deciden si el CRM sirve, no todos los que existen.
     *
     * <p>El criterio para entrar aqui es que dejarlo vacio degrade algo
     * concreto —el matching, un filtro, un aviso— y que no sea evidente como se
     * llena. Un "nombre" no entra: nadie pregunta como se llena un nombre.
     */
    private static final List<Campo> CAMPOS = List.of(
            new Campo("Estudiantes", "Cargo objetivo",
                    "Uno o varios cargos separados por coma, tal y como los buscaria la persona en un portal",
                    "Asesor de servicio al cliente bilingue, Agente call center",
                    "Es la entrada principal de la afinidad del matching y de los terminos con los que se buscan vacantes en los portales. Vacio, la persona solo empareja por ingles y ubicacion",
                    Set.of("cargo", "objetivo", "puesto", "aspiracion")),

            new Campo("Estudiantes", "Sector objetivo",
                    "Sector en el que quiere trabajar, en palabras normales",
                    "BPO / Servicios tercerizados",
                    "Suma al puntaje de afinidad y permite agrupar la cohorte por sector en reportes",
                    Set.of("sector", "industria", "rubro")),

            new Campo("Estudiantes", "Competencias",
                    "Lista separada por comas de herramientas y habilidades concretas, no adjetivos",
                    "Zendesk, Excel intermedio, atencion al cliente, facturacion",
                    "Es el unico campo que alimenta el criterio de competencias del matching. \"Proactivo\" o \"responsable\" no coinciden con ninguna vacante; \"Zendesk\" si",
                    Set.of("competencia", "habilidad", "skill", "destreza")),

            new Campo("Estudiantes", "Nivel de ingles",
                    "Escala MCER: A1, A2, B1, B2, C1 o C2",
                    "B1",
                    "El criterio de ingles pesa fuerte en el puntaje. Si se deja vacio la persona no se descarta, pero tampoco se le puede reservar una vacante bilingue con criterio",
                    Set.of("ingles", "mcer", "idioma", "nivel")),

            new Campo("Estudiantes", "Resultado prueba escrita / oral",
                    "El nivel MCER medido en cada prueba, por separado",
                    "Escrita B1, Oral A2",
                    "El programa mide muy distinto lo escrito y lo oral. Guardarlos separados es lo que evita mandar a una vacante de voz a quien escribe bien pero no sostiene una llamada",
                    Set.of("prueba", "escrita", "oral", "examen", "resultado")),

            new Campo("Estudiantes", "Ciudad",
                    "Solo la ciudad, sin departamento ni barrio",
                    "Barranquilla",
                    "Es el criterio de ubicacion del matching y el filtro con el que se descarta una vacante inviable. \"Barranquilla, Atlantico - zona norte\" no compara igual que \"Barranquilla\"",
                    Set.of("ciudad", "ubicacion", "municipio", "donde vive")),

            new Campo("Estudiantes", "Anios de experiencia",
                    "Un numero entero. Cero es un dato valido y util; vacio no",
                    "2",
                    "Se compara contra los anios que pide la vacante. Vacio, ese criterio queda sin datos y baja la cobertura del match",
                    Set.of("experiencia", "anios", "años", "trayectoria")),

            new Campo("Estudiantes", "Estado de empleabilidad",
                    "El estado real del proceso, no una intencion",
                    "EN_BUSQUEDA",
                    "Decide a quien entra en la siguiente corrida de matching y en los avisos. Un COLOCADO mal marcado sigue recibiendo ofertas que ya no necesita",
                    Set.of("estado", "empleabilidad", "situacion", "pipeline")),

            new Campo("Estudiantes", "Tiene computador / Tiene internet / Interes migratorio",
                    "Si o no, sin dejar en blanco",
                    "Tiene computador: si",
                    "Deciden a que segmento de vacantes es elegible. Sin computador ni internet no se le recomiendan ofertas remotas; sin interes migratorio no se le mandan ofertas del exterior",
                    Set.of("computador", "internet", "migratorio", "remoto", "segmento")),

            new Campo("Vacantes", "Nivel de ingles requerido",
                    "Escala MCER: A1, A2, B1, B2, C1 o C2. Nunca \"basico\" o \"intermedio\"",
                    "B2",
                    "Se compara letra a letra contra el nivel del estudiante. Un texto libre no compara con nada y el criterio queda sin datos",
                    Set.of("ingles", "requerido", "mcer", "nivel vacante")),

            new Campo("Vacantes", "Anios de experiencia requeridos",
                    "Un numero entero. Para una vacante sin experiencia, cero",
                    "0",
                    "Dejarlo vacio no hace la vacante mas accesible: hace que el criterio no puntue y que la vacante llegue a gente que no encaja",
                    Set.of("experiencia requerida", "anios requeridos", "años requeridos")),

            new Campo("Vacantes", "Ciudad",
                    "Solo la ciudad. Aparte de Ubicacion, que es el texto libre del anuncio",
                    "Soledad",
                    "Es lo unico que decide si la persona puede tomar el empleo. El texto libre del anuncio no sirve para filtrar",
                    Set.of("ciudad vacante", "plaza", "sede")),

            new Campo("Vacantes", "Requisitos",
                    "Lo que pide el anuncio, en frases sueltas, incluyendo herramientas por su nombre",
                    "Manejo de CRM, ingles conversacional, disponibilidad fines de semana",
                    "De aqui salen los terminos que se comparan con las competencias del estudiante. Vacio, el matching se queda solo con el titulo",
                    Set.of("requisito", "perfil vacante", "exigencia")),

            new Campo("Vacantes", "Jornada y Tipo de contrato",
                    "Son dos campos distintos: Jornada es tiempo completo o medio tiempo; Tipo de contrato es la figura juridica",
                    "Jornada: tiempo completo. Tipo de contrato: termino indefinido",
                    "Quien necesita el ingreso completo filtra por jornada. Mezclarlos en un campo deja ese filtro inservible",
                    Set.of("jornada", "contrato", "tiempo completo", "medio tiempo")),

            new Campo("Vacantes", "Fecha de expiracion",
                    "La fecha en que el anuncio deja de estar vigente",
                    "2026-09-30",
                    "Es lo que permite cerrar la vacante sola. Sin ella la oferta se queda viva para siempre y se sigue recomendando meses despues de cerrada",
                    Set.of("expiracion", "vence", "vigencia", "caduca")),

            new Campo("Vacantes", "Revisada",
                    "Se marca cuando alguien del equipo verifico que la oferta es real",
                    "Revisada: si",
                    "Una vacante sin revisar no entra al matching. Es la barrera que impide que una estafa de empleo llegue a toda la cohorte",
                    Set.of("revisada", "verificada", "aprobar vacante")),

            new Campo("Colocaciones", "Salario y Canal de consecucion",
                    "El salario mensual en pesos y por que via se consiguio el empleo",
                    "Salario 1600000, canal PORTAL",
                    "El salario mide el cumplimiento de la meta de colocacion digna; el canal es lo unico que dice cuantas contrataciones vinieron del CRM",
                    Set.of("colocacion", "salario", "canal", "contratado", "digna")),

            new Campo("Empresas", "Sector y NIT",
                    "Sector economico y el NIT sin puntos ni digito de verificacion",
                    "Sector: BPO. NIT: 900123456",
                    "El sector conecta la empresa con el sector objetivo del estudiante; el NIT es lo que evita duplicar la misma empresa con dos nombres",
                    Set.of("empresa", "nit", "sector empresa", "duplicad")));

    private GuiaDeCampos() {
    }

    /**
     * Todo el catalogo en texto, para colgarlo del prompt de sistema.
     *
     * <p>Va entero y no filtrado por la pregunta: son dieciocho lineas, cabe de
     * sobra, y filtrar antes de preguntar significaria adivinar de que habla el
     * usuario con las mismas palabras clave que ya fallan cuando pregunta
     * distinto a como esta escrito el campo.
     */
    public static String resumenParaPrompt() {
        StringBuilder sb = new StringBuilder();
        for (Campo c : CAMPOS) {
            sb.append(c.comoLinea()).append('\n');
        }
        return sb.toString();
    }

    /**
     * Los campos que encajan con lo que se pregunto, del que mas coincide al
     * que menos.
     *
     * <p>Devuelve lista vacia si no reconoce nada, y quien llama decide que
     * hacer con eso. Inventar una respuesta cuando no se reconoce el campo es
     * peor que decir que no se sabe: quien pregunta la aplica.
     */
    public static List<Campo> buscar(String pregunta) {
        String texto = normalizar(pregunta);
        if (texto.isBlank()) return List.of();

        record Puntuado(Campo campo, int aciertos) {
        }
        List<Puntuado> encontrados = new ArrayList<>();
        for (Campo c : CAMPOS) {
            int aciertos = 0;
            for (String clave : c.palabrasClave()) {
                if (texto.contains(normalizar(clave))) aciertos++;
            }
            if (aciertos > 0) encontrados.add(new Puntuado(c, aciertos));
        }
        encontrados.sort((a, b) -> Integer.compare(b.aciertos(), a.aciertos()));
        return encontrados.stream().limit(3).map(Puntuado::campo).toList();
    }

    /** Sin tildes y en minusculas: se pregunta "años" tanto como "anios". */
    private static String normalizar(String texto) {
        if (texto == null) return "";
        String sinTildes = Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return sinTildes.toLowerCase(Locale.ROOT).trim();
    }
}
