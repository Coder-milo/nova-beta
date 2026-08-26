package com.novacrm.vacante;

import com.novacrm.catalogo.nivel_ingles.NivelMcer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Rellena los campos que las fuentes dejan vacios, leyendolos del texto del
 * anuncio que ya venia descargado.
 *
 * <p>Existe porque ningun conector llenaba {@code nivelInglesRequerido},
 * {@code aniosExperienciaRequeridos}, {@code ciudad} ni {@code fechaExpiracion},
 * y el motor de matching trataba esos huecos como "no exige nada": una vacante
 * de la que no se sabia nada puntuaba mas alto que una bien descrita. El dato
 * casi siempre estaba escrito en la descripcion; solo faltaba leerlo.
 *
 * <p>Es deliberadamente conservador. Solo escribe cuando la senal es explicita,
 * porque inventar un requisito de ingles o de experiencia que el anuncio no pide
 * deja fuera a candidatos que si servian. Ante la duda no escribe nada, y el
 * criterio correspondiente queda sin datos —que ahora es un estado legitimo, no
 * un regalo de puntos.
 *
 * <p>Nunca pisa un valor ya presente: lo que trajo la fuente o escribio una
 * persona manda sobre lo inferido.
 */
@Component
public class EnriquecedorDeVacante {

    /**
     * Frases que declaran un nivel de ingles sin nombrar el codigo MCER.
     * Se recorren en orden: la primera que aparezca en el texto gana, asi que
     * van de mas exigente a menos para que "ingles avanzado" no lo resuelva una
     * mencion suelta de "ingles basico" mas adelante en el mismo anuncio.
     */
    private static final List<Map.Entry<List<String>, NivelMcer>> FRASES_INGLES = List.of(
            Map.entry(List.of(
                    "ingles nativo", "native english", "near native",
                    "ingles c1", "ingles c2", "c1 english", "c2 english",
                    "ingles profesional", "professional english", "professional working english"), NivelMcer.C1),
            Map.entry(List.of(
                    "ingles avanzado", "advanced english", "fluent english", "fluent in english",
                    "ingles fluido", "fully bilingual", "totalmente bilingue", "100% bilingue",
                    "100% bilingual", "ingles b2", "b2 english", "working english",
                    "business english", "ingles de negocios"), NivelMcer.B2),
            Map.entry(List.of(
                    "bilingue", "bilingual",
                    "ingles conversacional", "conversational english",
                    "ingles intermedio", "intermediate english",
                    "ingles tecnico", "technical english",
                    "ingles b1", "b1 english"), NivelMcer.B1),
            Map.entry(List.of(
                    "ingles basico", "basic english", "ingles a2", "a2 english"), NivelMcer.A2));

    /**
     * Senales de que el puesto pide ingles sin decir cuanto. Se resuelve como B1
     * —la barrera real de una entrevista de trabajo en ingles— y no mas arriba,
     * para no excluir de mas.
     */
    private static final List<String> INGLES_SIN_NIVEL = List.of(
            "ingles requerido", "requiere ingles", "dominio del ingles", "dominio de ingles",
            "english required", "must speak english", "english proficiency",
            "manejo de ingles", "manejo del ingles", "indispensable ingles", "ingles indispensable",
            "conocimiento de ingles", "conocimiento del ingles");

    /** El anuncio dice expresamente que no pide experiencia. */
    private static final List<String> SIN_EXPERIENCIA = List.of(
            "sin experiencia", "no se requiere experiencia", "experiencia no requerida",
            "no requiere experiencia", "no experience", "entry level", "sin experiencia previa",
            "no prior experience");

    /** Numero seguido de "año"/"year" dentro de la ventana que rodea a "experien". */
    private static final Pattern ANIOS = Pattern.compile("(\\d{1,2})\\s*\\+?\\s*(?:anos?|years?)");

    /**
     * Rango escrito como "2 a 4 anos", "2-4 years" o "entre 2 y 4 anos". Hace
     * falta aparte porque en esa forma el primer numero —el que manda— no toca
     * la palabra "anos" y {@link #ANIOS} solo veria el limite superior.
     */
    private static final Pattern RANGO_ANIOS = Pattern.compile(
            "(\\d{1,2})\\s*(?:a|y|to|-)\\s*(\\d{1,2})\\s*\\+?\\s*(?:anos?|years?)");

    /** Cuantos caracteres a cada lado de "experien" se consideran parte de la frase. */
    private static final int VENTANA = 60;

    /** Tope defensivo: por encima de esto el numero no es un requisito de experiencia. */
    private static final int MAX_ANIOS = 20;

    /**
     * Ciudades y municipios colombianos reconocibles en el texto del anuncio o ubicación.
     * Incluye las principales áreas metropolitanas del país y municipios con alta actividad laboral.
     */
    private static final List<String> CIUDADES = List.of(
            "barranquilla", "soledad", "malambo", "puerto colombia", "galapa", "baranoa", "sabanalarga",
            "bogota", "soacha", "chia", "zipaquira", "facatativa", "mosquera", "madrid", "funza", "cajica",
            "medellin", "bello", "itagui", "envigado", "sabaneta", "rionegro", "la estrella", "copacabana",
            "cali", "palmira", "buenaventura", "yumbo", "jamundi", "tulua", "cartago", "buga",
            "cartagena", "magangue", "turbaco",
            "bucaramanga", "floridablanca", "giron", "piedecuesta", "barrancabermeja",
            "santa marta", "cienaga",
            "cucuta", "ocana", "pamplona", "villa del rosario", "los patios",
            "pereira", "dosquebradas", "santa rosa de cabal",
            "manizales", "villamaria",
            "ibague", "espinal",
            "villavicencio", "acacias",
            "monteria", "cerete", "lorica",
            "valledupar", "aguachica",
            "neiva", "pitalito",
            "pasto", "ipiales", "tumaco",
            "armenia", "calarca",
            "sincelejo", "corozal",
            "popayan", "santander de quilichao",
            "riohacha", "maicao",
            "tunja", "duitama", "sogamoso", "chiquinquira",
            "florencia", "quibdo", "yopal", "mocoa", "san andres", "leticia",
            "arauca", "girardot", "fusagasuga");

    private static final List<java.util.Map.Entry<String, String>> DEPARTAMENTOS_A_CIUDAD = List.of(
            java.util.Map.entry("atlantico", "Barranquilla, Atlántico"),
            java.util.Map.entry("cundinamarca", "Bogotá, D.C."),
            java.util.Map.entry("bogota d.c.", "Bogotá, D.C."),
            java.util.Map.entry("bogota dc", "Bogotá, D.C."),
            java.util.Map.entry("antioquia", "Medellín, Antioquia"),
            java.util.Map.entry("valle del cauca", "Cali, Valle del Cauca"),
            java.util.Map.entry("santander", "Bucaramanga, Santander"),
            java.util.Map.entry("norte de santander", "Cúcuta"),
            java.util.Map.entry("bolivar", "Cartagena, Bolívar"),
            java.util.Map.entry("risaralda", "Pereira, Risaralda"),
            java.util.Map.entry("caldas", "Manizales, Caldas"),
            java.util.Map.entry("quindio", "Armenia, Quindío"),
            java.util.Map.entry("magdalena", "Santa Marta, Magdalena"),
            java.util.Map.entry("tolima", "Ibagué, Tolima"),
            java.util.Map.entry("meta", "Villavicencio, Meta"),
            java.util.Map.entry("huila", "Neiva, Huila"),
            java.util.Map.entry("cesar", "Valledupar, Cesar"),
            java.util.Map.entry("cordoba", "Montería, Córdoba"),
            java.util.Map.entry("sucre", "Sincelejo, Sucre"),
            java.util.Map.entry("la guajira", "Riohacha, La Guajira"),
            java.util.Map.entry("guajira", "Riohacha, La Guajira"),
            java.util.Map.entry("narino", "Pasto, Nariño"),
            java.util.Map.entry("cauca", "Popayán, Cauca"),
            java.util.Map.entry("boyaca", "Tunja, Boyacá"),
            java.util.Map.entry("casanare", "Yopal, Casanare"),
            java.util.Map.entry("san andres", "San Andrés")
    );

    /** Si la ubicacion dice esto, no hay ciudad que extraer: el puesto es remoto. */
    private static final List<String> SENALES_REMOTO = List.of(
            "remot", "remote", "worldwide", "anywhere", "global", "teletrabajo",
            "home office", "work from home", "desde casa", "virtual", "100% remot");

    private final int diasVigenciaPorDefecto;

    public EnriquecedorDeVacante(
            @Value("${app.vacantes.dias-vigencia-por-defecto:30}") int diasVigenciaPorDefecto) {
        this.diasVigenciaPorDefecto = diasVigenciaPorDefecto;
    }

    /** Completa in situ los huecos que se puedan deducir del anuncio. */
    public void enriquecer(Vacante vacante) {
        if (vacante == null) {
            return;
        }
        String texto = textoDelAnuncio(vacante);

        if (esBlanco(vacante.getNivelInglesRequerido())) {
            inferirIngles(texto).ifPresent(nivel -> vacante.setNivelInglesRequerido(nivel.name()));
        }
        if (vacante.getAniosExperienciaRequeridos() == null) {
            inferirExperiencia(texto).ifPresent(vacante::setAniosExperienciaRequeridos);
        }
        if (esBlanco(vacante.getCiudad())) {
            inferirCiudad(vacante.getUbicacion(), texto).ifPresent(vacante::setCiudad);
        }
        if (esBlanco(vacante.getUbicacion()) && !esBlanco(vacante.getCiudad())) {
            vacante.setUbicacion(vacante.getCiudad());
        }
        if (esBlanco(vacante.getModalidadTrabajo())) {
            inferirModalidad(texto, vacante.getUbicacion()).ifPresent(vacante::setModalidadTrabajo);
        }
        if (esBlanco(vacante.getUbicacion()) && "REMOTO".equalsIgnoreCase(vacante.getModalidadTrabajo())) {
            vacante.setUbicacion("Remoto");
        }
        if (esBlanco(vacante.getRangoSalarial())) {
            inferirSalario(vacante.getDescripcion()).ifPresent(vacante::setRangoSalarial);
        }
        if (esBlanco(vacante.getRequisitos())) {
            inferirRequisitos(vacante.getDescripcion()).ifPresent(vacante::setRequisitos);
        }
        if (vacante.getFechaExpiracion() == null) {
            vacante.setFechaExpiracion(vigenciaPorDefecto(vacante));
        }
    }

    /**
     * Infiere la modalidad de trabajo (Remoto, Híbrido, Presencial).
     */
    java.util.Optional<String> inferirModalidad(String texto, String ubicacion) {
        String t = normalizar(String.join(" ", texto == null ? "" : texto, ubicacion == null ? "" : ubicacion));
        if (SENALES_REMOTO.stream().anyMatch(t::contains)) {
            return java.util.Optional.of("Remoto");
        }
        if (t.contains("hibrid") || t.contains("hybrid") || t.contains("alternancia") || t.contains("semipresencial")) {
            return java.util.Optional.of("Híbrido");
        }
        if (t.contains("presencial") || t.contains("en sitio") || t.contains("on-site") || t.contains("onsite")) {
            return java.util.Optional.of("Presencial");
        }
        return java.util.Optional.empty();
    }

    private static final Pattern PATRON_SALARIO_RANGO = Pattern.compile(
            "(?i)(?:\\$\\s*)?([0-9]{1,3}(?:\\.[0-9]{3}){1,2})\\s*(?:a|-|–|hasta)\\s*(?:\\$\\s*)?([0-9]{1,3}(?:\\.[0-9]{3}){1,2})(?:\\s*COP)?");

    private static final Pattern PATRON_SALARIO_MILLONES = Pattern.compile(
            "(?i)(?:salario|sueldo|pago|asignacion|remuneracion)[:\\s]+\\$?\\s*([0-9]{1,2}(?:[.,][0-9]{1,2})?)\\s*(?:millones|m\\b)");

    private static final Pattern PATRON_SALARIO_EXPLICITO = Pattern.compile(
            "(?i)(?:salario|sueldo|pago|remuneracion)[:\\s]+\\$?\\s*([0-9]{1,3}(?:\\.[0-9]{3}){1,2})(?:\\s*COP)?");

    private static final Pattern PATRON_SALARIO_USD = Pattern.compile(
            "(?i)(?:usd|\\$)\\s*([0-9]{3,6}(?:\\.[0-9]{3})?)\\s*(?:a|-|–)\\s*(?:usd|\\$)?\\s*([0-9]{3,6}(?:\\.[0-9]{3})?)(?:\\s*usd)?");

    /**
     * Extrae el rango salarial si viene explícito en la descripción.
     */
    java.util.Optional<String> inferirSalario(String descripcion) {
        if (descripcion == null || descripcion.isBlank()) {
            return java.util.Optional.empty();
        }
        Matcher mRango = PATRON_SALARIO_RANGO.matcher(descripcion);
        if (mRango.find()) {
            return java.util.Optional.of("$" + mRango.group(1) + " - $" + mRango.group(2) + " COP");
        }
        Matcher mExp = PATRON_SALARIO_EXPLICITO.matcher(descripcion);
        if (mExp.find()) {
            return java.util.Optional.of("$" + mExp.group(1) + " COP");
        }
        Matcher mUsd = PATRON_SALARIO_USD.matcher(descripcion);
        if (mUsd.find()) {
            return java.util.Optional.of("USD $" + mUsd.group(1) + " - $" + mUsd.group(2));
        }
        Matcher mMill = PATRON_SALARIO_MILLONES.matcher(descripcion);
        if (mMill.find()) {
            return java.util.Optional.of("$" + mMill.group(1) + " Millones COP");
        }
        return java.util.Optional.empty();
    }

    /**
     * Extrae el bloque de requisitos si existe una sección dedicada en la descripción.
     */
    java.util.Optional<String> inferirRequisitos(String descripcion) {
        if (descripcion == null || descripcion.isBlank()) {
            return java.util.Optional.empty();
        }
        String lower = descripcion.toLowerCase(Locale.ROOT);
        String[] marcas = {"requisitos:", "perfil requerido:", "requirements:", "que buscamos:", "lo que necesitas:"};
        for (String marca : marcas) {
            int idx = lower.indexOf(marca);
            if (idx >= 0) {
                String sub = descripcion.substring(idx + marca.length()).trim();
                // Tomar hasta la siguiente sección o los primeros 400 caracteres
                int finSeccion = sub.indexOf("\n\n");
                if (finSeccion > 20) {
                    return java.util.Optional.of(sub.substring(0, finSeccion).trim());
                } else if (sub.length() > 20) {
                    return java.util.Optional.of(sub.length() > 500 ? sub.substring(0, 500) + "…" : sub);
                }
            }
        }
        return java.util.Optional.empty();
    }

    /**
     * Nivel de ingles exigido por el anuncio.
     *
     * <p>Primero busca un codigo MCER contextual ("B2", "nivel B1", "CEFR C1"),
     * garantizando que no sea una licencia C1, zona B2 o acrónimo B2B;
     * si no hay, cae a las frases jerarquizadas y señales generales.
     */
    java.util.Optional<NivelMcer> inferirIngles(String texto) {
        if (texto == null || texto.isBlank()) {
            return java.util.Optional.empty();
        }
        String t = normalizar(texto);

        // 1. Código MCER contextual con marco o idioma
        var porCodigo = inferirCodigoMcerContextual(t);
        if (porCodigo.isPresent()) {
            return porCodigo;
        }

        // 2. Frases ordenadas por nivel de exigencia
        for (var grupo : FRASES_INGLES) {
            for (String frase : grupo.getKey()) {
                if (t.contains(frase)) {
                    return java.util.Optional.of(grupo.getValue());
                }
            }
        }

        // 3. Señales sin nivel específico resueltas como B1
        for (String frase : INGLES_SIN_NIVEL) {
            if (t.contains(frase)) {
                return java.util.Optional.of(NivelMcer.B1);
            }
        }
        return java.util.Optional.empty();
    }

    private java.util.Optional<NivelMcer> inferirCodigoMcerContextual(String t) {
        // Marco explícito: "MCER B2", "CEFR C1", "Marco común europeo B2", "Marco europeo: C1"
        Pattern pMarco = Pattern.compile(
                "\\b(?:mcer|cefr|marco\\s+(?:comun\\s+)?europeo)\\s*[:\\-–—]?\\s*(?:nivel\\s*)?([abc][12])\\b");
        Matcher mMarco = pMarco.matcher(t);
        if (mMarco.find()) {
            try {
                return java.util.Optional.of(NivelMcer.valueOf(mMarco.group(1).toUpperCase(Locale.ROOT)));
            } catch (IllegalArgumentException ignored) {
            }
        }

        // Nivel con idioma: "ingles B2", "B2 English", "Required: B2+ English", "nivel de ingles B2", "ingles C1", "english proficiency B2"
        Pattern pInglesNivel = Pattern.compile(
                "\\b(?:ingles|english)\\s*(?:(?:proficiency|requirements?|requirement|nivel|level|hablado|escrito|conversacional|tecnico|fluido|avanzado|intermedio|de)\\s*){0,3}[:\\-–—]?\\s*([abc][12])\\b|\\b([abc][12])\\s*\\+?\\s*(?:de\\s+ingles|en\\s+ingles|english)\\b");
        Matcher mIngles = pInglesNivel.matcher(t);
        if (mIngles.find()) {
            String codigo = mIngles.group(1) != null ? mIngles.group(1) : mIngles.group(2);
            try {
                return java.util.Optional.of(NivelMcer.valueOf(codigo.toUpperCase(Locale.ROOT)));
            } catch (IllegalArgumentException ignored) {
            }
        }

        // Nivel genérico "Nivel B2", "Level C1", cuidando que no esté precedido por falsos positivos
        Pattern pNivel = Pattern.compile("\\b(?:nivel|level)\\s*[:\\-–—]?\\s*([abc][12])\\s*\\+?\\b");
        Matcher mNivel = pNivel.matcher(t);
        while (mNivel.find()) {
            int inicio = mNivel.start();
            String fragmento = t.substring(Math.max(0, inicio - 25), inicio);
            if (!fragmento.contains("zona") && !fragmento.contains("bodega") && !fragmento.contains("piso")
                    && !fragmento.contains("licencia") && !fragmento.contains("pase") && !fragmento.contains("vitamina")
                    && !fragmento.contains("sector") && !fragmento.contains("pasillo") && !fragmento.contains("bloque")
                    && !fragmento.contains("modulo") && !fragmento.contains("formato")) {
                try {
                    return java.util.Optional.of(NivelMcer.valueOf(mNivel.group(1).toUpperCase(Locale.ROOT)));
                } catch (IllegalArgumentException ignored) {
                }
            }
        }

        return java.util.Optional.empty();
    }

    /**
     * Anios de experiencia exigidos.
     *
     * <p>Solo mira lo que rodea a la palabra "experiencia": un anuncio que
     * presume de "15 anos en el mercado" no esta pidiendo quince anios de
     * experiencia al candidato. Cuando el rango es "2 a 4 anos" se queda con el
     * minimo, que es el requisito de entrada real.
     */
    java.util.Optional<Integer> inferirExperiencia(String texto) {
        Integer minimo = null;
        int desde = 0;
        while (true) {
            int pos = texto.indexOf("experien", desde);
            if (pos < 0) {
                break;
            }
            desde = pos + "experien".length();

            String ventana = texto.substring(
                    Math.max(0, pos - VENTANA),
                    Math.min(texto.length(), pos + VENTANA));

            if (contieneAlguna(ventana, SIN_EXPERIENCIA)) {
                return java.util.Optional.of(0);
            }
            // Los dos patrones se aplican a la misma ventana y se toma el menor
            // de todo lo hallado: en "de 2 a 4 anos" el rango aporta 2 y el
            // patron simple aporta 4, y gana el 2.
            minimo = menorDeLosHallados(minimo, RANGO_ANIOS.matcher(ventana));
            minimo = menorDeLosHallados(minimo, ANIOS.matcher(ventana));
        }
        return java.util.Optional.ofNullable(minimo);
    }

    /**
     * Ciudad colombiana del puesto.
     *
     * <p>Se busca sobre {@code ubicacion} —el campo que las fuentes si llenan—
     * y, si ahi no aparece, sobre el resto del anuncio. Si la ubicacion declara
     * que el puesto es remoto no se fuerza ninguna ciudad: "Worldwide" no es un
     * lugar donde el participante pueda presentarse.
     */
    java.util.Optional<String> inferirCiudad(String ubicacion, String texto) {
        String ubicacionNormalizada = normalizar(ubicacion == null ? "" : ubicacion);

        if (!ubicacionNormalizada.isBlank()) {
            if (contieneAlguna(ubicacionNormalizada, SENALES_REMOTO)) {
                return java.util.Optional.empty();
            }
            var enUbicacion = buscarCiudad(ubicacionNormalizada);
            if (enUbicacion.isPresent()) {
                return enUbicacion;
            }
        }
        return buscarCiudad(texto);
    }

    /**
     * Fecha de expiracion cuando la fuente no la trae.
     *
     * <p>Sin esto una vacante de portal no vence nunca y {@code cerrarVencidas}
     * no puede retirarla jamas, asi que el listado acumula plazas muertas y el
     * participante se postula a algo que ya no existe.
     */
    private LocalDateTime vigenciaPorDefecto(Vacante vacante) {
        LocalDateTime base = vacante.getFechaPublicacion() != null
                ? vacante.getFechaPublicacion()
                : LocalDateTime.now();
        return base.plusDays(diasVigenciaPorDefecto);
    }

    /** El menor entre lo que ya se tenia y el primer grupo de cada coincidencia. */
    private static Integer menorDeLosHallados(Integer minimo, Matcher m) {
        while (m.find()) {
            int anios = Integer.parseInt(m.group(1));
            if (anios <= MAX_ANIOS && (minimo == null || anios < minimo)) {
                minimo = anios;
            }
        }
        return minimo;
    }

    private java.util.Optional<String> buscarCiudad(String textoNormalizado) {
        if (textoNormalizado == null || textoNormalizado.isBlank()) {
            return java.util.Optional.empty();
        }
        for (String ciudad : CIUDADES) {
            Pattern p = Pattern.compile("\\b" + Pattern.quote(ciudad) + "\\b");
            if (p.matcher(textoNormalizado).find()) {
                return java.util.Optional.of(capitalizar(ciudad));
            }
        }
        for (var entry : DEPARTAMENTOS_A_CIUDAD) {
            Pattern p = Pattern.compile("\\b" + Pattern.quote(entry.getKey()) + "\\b");
            if (p.matcher(textoNormalizado).find()) {
                return java.util.Optional.of(entry.getValue());
            }
        }
        return java.util.Optional.empty();
    }

    private String textoDelAnuncio(Vacante v) {
        return normalizar(String.join(" ",
                v.getTitulo() == null ? "" : v.getTitulo(),
                v.getDescripcion() == null ? "" : v.getDescripcion(),
                v.getRequisitos() == null ? "" : v.getRequisitos()));
    }

    private static boolean contieneAlguna(String texto, List<String> frases) {
        return frases.stream().anyMatch(texto::contains);
    }

    private static boolean esBlanco(String valor) {
        return valor == null || valor.isBlank();
    }

    /** Sin tildes y en minusculas, para comparar contra las listas de senales. */
    private static String normalizar(String texto) {
        return Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .toLowerCase(Locale.ROOT);
    }

    private static String capitalizar(String ciudad) {
        StringBuilder salida = new StringBuilder(ciudad.length());
        boolean inicioDePalabra = true;
        for (char c : ciudad.toCharArray()) {
            salida.append(inicioDePalabra ? Character.toUpperCase(c) : c);
            inicioDePalabra = c == ' ';
        }
        return salida.toString();
    }
}
