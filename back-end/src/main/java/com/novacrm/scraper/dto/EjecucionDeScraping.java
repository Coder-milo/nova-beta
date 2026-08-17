package com.novacrm.scraper.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Una corrida de actualización de vacantes, como se ve desde el panel.
 *
 * <p>La tabla existía desde hacía tiempo pero solo se consultaba para sacar la
 * última cifra: el resto quedaba escrito y sin leer. Eso dejaba sin respuesta
 * la pregunta que de verdad se hace el equipo cuando dejan de entrar ofertas
 * —«¿desde cuándo?»—, porque un portal cuyos selectores se caen no falla: sigue
 * respondiendo 200 y devolviendo cero. Así estuvo Elempleo muerto sin que nadie
 * se enterara.
 *
 * @param portales portales consultados, ya separados: unirlos por coma era
 *                 cómodo para guardar y molesto para leer
 * @param errores  un renglón por fallo. Vacío no significa que todo fuera bien:
 *                 significa que nada falló <em>ruidosamente</em>
 * @param ofertasPorPortal cuántas devolvió cada portal antes de deduplicar.
 *                 <strong>Vacío significa «no se registró»</strong> —corridas
 *                 anteriores a la columna—, nunca «todos trajeron cero»
 * @param descartadasPorIdioma cuántas llegaron sin exigir inglés y no se
 *                 guardaron. Es lo que separa «el portal está caído» de «el
 *                 portal trajo cuarenta plazas monolingües»: sin este número los
 *                 dos casos se ven igual, como una corrida de cero nuevas
 */
public record EjecucionDeScraping(
        String id,
        LocalDateTime inicio,
        LocalDateTime fin,
        String origen,
        List<String> portales,
        int vacantesNuevas,
        int vacantesCerradas,
        List<String> errores,
        boolean enCurso,
        Long duracionSegundos,
        List<PortalConOfertas> ofertasPorPortal,
        int descartadasPorIdioma) {

    /** @param ofertas devueltas por el portal, antes de deduplicar */
    public record PortalConOfertas(String portal, int ofertas) {}

    /**
     * Portales que respondieron sin traer nada.
     *
     * <p>Es la señal de que a un portal le cambiaron el HTML: no falla,
     * responde 200 y devuelve cero. Un portal aquí una vez no dice nada —puede
     * no haber ofertas de lo que se buscó—; el mismo portal aquí varios días
     * seguidos es un scraper muerto.
     */
    @com.fasterxml.jackson.annotation.JsonProperty("portalesEnCero")
    public List<String> portalesEnCero() {
        return ofertasPorPortal.stream()
                .filter(p -> p.ofertas() == 0)
                .map(PortalConOfertas::portal)
                .toList();
    }

    /**
     * Cómo salió, en una palabra, para pintarla sin repetir la regla en el
     * frontend.
     *
     * <p>Lleva {@code @JsonProperty} porque es un método derivado y no un
     * componente del record: sin la anotación, Jackson no lo serializa —solo
     * mira los componentes— y el campo llegaría ausente al panel. Es lo que
     * pasa con {@code hojasImportadas()} en {@code ResultadoImportacionLibro},
     * que se calcula en el frontend por eso mismo.
     */
    @com.fasterxml.jackson.annotation.JsonProperty("estado")
    public String estado() {
        if (enCurso) {
            return "EN_CURSO";
        }
        if (!errores.isEmpty()) {
            // Con errores pero con ofertas nuevas: algo entró y algo falló. No
            // es lo mismo que una corrida limpia ni que una perdida, y pintar
            // las dos igual es como se deja de mirar el panel.
            return vacantesNuevas > 0 ? "PARCIAL" : "FALLIDA";
        }
        return "CORRECTA";
    }
}
