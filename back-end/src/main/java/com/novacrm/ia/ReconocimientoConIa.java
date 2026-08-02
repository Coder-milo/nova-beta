package com.novacrm.ia;

import com.fasterxml.jackson.databind.JsonNode;
import com.novacrm.excel.libro.DestinoDeHoja;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Reconoce hojas y columnas con ayuda de la IA, cuando los diccionarios de
 * sinónimos no dan con ellas.
 *
 * <p>La IA nunca decide: sugiere, y aquí se valida la sugerencia contra el
 * vocabulario real del sistema antes de devolverla. Una hoja de la que no se
 * sabe nada, o una columna que la IA mapea a un campo inexistente, no vale.
 *
 * <p>Todo es opcional: sin clave de Groq, con un 429 del tier gratuito o con
 * una respuesta ilegible se devuelve vacío y el importador sigue con su
 * comportamiento de siempre.
 */
@Component
public class ReconocimientoConIa {

    private static final Logger log = LoggerFactory.getLogger(ReconocimientoConIa.class);

    private static final String INSTRUCCIONES = """
            Eres un asistente que reconoce hojas de calculo de un CRM de empleabilidad.
            Respondes SOLO con JSON, sin texto fuera del JSON.
            Nunca inventes valores: si no puedes decidir, responde {"valor": null}.
            """;

    /**
     * Tope de titulos recordados. Un titulo siempre se resuelve al mismo campo,
     * asi que preguntarlo dos veces es gastar una llamada y unos segundos para
     * obtener la misma respuesta. Se acota para que un archivo con basura en la
     * cabecera no haga crecer el mapa sin limite.
     */
    static final int MAXIMO_RECORDADO = 500;

    private final ProveedorIa proveedorIa;

    /**
     * Sugerencias ya resueltas, incluidas las negativas.
     *
     * <p>Recordar que un titulo <em>no</em> corresponde a ningun campo importa
     * tanto como recordar que si: sin eso, cada importacion vuelve a preguntar
     * por las mismas columnas de relleno.
     */
    private final Map<ClaveDeCampo, Optional<String>> recordadas = new ConcurrentHashMap<>();

    private record ClaveDeCampo(String titulo, Set<String> campos) {}

    public ReconocimientoConIa(ProveedorIa proveedorIa) {
        this.proveedorIa = proveedorIa;
    }

    /** Si hay proveedor configurado. Evita construir prompts para nada. */
    public boolean disponible() {
        return proveedorIa != null && proveedorIa.disponible();
    }

    /**
     * Pregunta a que destino pertenece una hoja cuyos titulos no se reconocen.
     *
     * @param nombreHoja nombre de la pestaña
     * @param titulos    titulos de su cabecera
     */
    public Optional<DestinoDeHoja> sugerirDestino(String nombreHoja, List<String> titulos) {
        String etiquetas = java.util.Arrays.stream(DestinoDeHoja.values())
                .map(d -> d.name() + " (" + d.getEtiqueta() + ")")
                .collect(Collectors.joining(", "));

        String contenido = """
                Nombre de la hoja: %s
                Titulos de la cabecera: %s
                Destinos posibles: %s
                Responde {"valor": "NOMBRE_DEL_DESTINO"} o {"valor": null} si no corresponde a ninguno.
                """.formatted(nombreHoja, titulos, etiquetas);

        return proveedorIa.completarJson(INSTRUCCIONES, contenido)
                .flatMap(this::valor)
                .flatMap(this::aDestino);
    }

    /**
     * Pregunta a que campo del sistema corresponde un titulo desconocido.
     *
     * @param titulo        titulo de la columna tal como viene en la hoja
     * @param camposPosibles campos del sistema a los que puede apuntar
     */
    public Optional<String> sugerirCampo(String titulo, Set<String> camposPosibles) {
        if (titulo == null || titulo.isBlank() || camposPosibles == null || camposPosibles.isEmpty()) {
            return Optional.empty();
        }
        var clave = new ClaveDeCampo(titulo.trim().toLowerCase(Locale.ROOT), camposPosibles);
        var recordada = recordadas.get(clave);
        if (recordada != null) {
            return recordada;
        }

        String contenido = """
                Titulo de la columna: %s
                Campos del sistema posibles: %s
                Responde {"valor": "NOMBRE_DEL_CAMPO"} o {"valor": null} si ninguno encaja.
                """.formatted(titulo, camposPosibles);

        var resuelta = proveedorIa.completarJson(INSTRUCCIONES, contenido)
                .flatMap(this::valor)
                .flatMap(sugerido -> canonico(sugerido, camposPosibles));

        if (recordadas.size() < MAXIMO_RECORDADO) {
            recordadas.put(clave, resuelta);
        }
        return resuelta;
    }

    /**
     * Busca el campo real que corresponde a lo que respondio la IA.
     *
     * <p>Se compara sin distinguir mayusculas pero se devuelve el nombre
     * canonico. Comparar en minusculas y quedarse con el texto de la IA no
     * servia: los campos del sistema son camelCase —{@code nombreCompleto},
     * {@code cargoObjetivo}, {@code areaFormacion}— y un
     * {@code Set.contains("nombrecompleto")} nunca acierta. Con esa version, 42
     * de los 63 campos del vocabulario eran inalcanzables y la sugerencia se
     * descartaba en silencio: parecia que la IA no reconocia la columna cuando
     * en realidad si la habia reconocido.
     */
    private Optional<String> canonico(String sugerido, Set<String> camposPosibles) {
        return camposPosibles.stream()
                .filter(campo -> campo.equalsIgnoreCase(sugerido))
                .findFirst();
    }

    private Optional<String> valor(JsonNode json) {
        JsonNode v = json.get("valor");
        if (v == null || v.isNull() || !v.isTextual() || v.asText().isBlank()) {
            return Optional.empty();
        }
        return Optional.of(v.asText().trim());
    }

    private Optional<DestinoDeHoja> aDestino(String nombre) {
        try {
            return Optional.of(DestinoDeHoja.valueOf(nombre.toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException e) {
            log.warn("Groq sugirió un destino inexistente: {}", nombre);
            return Optional.empty();
        }
    }
}
