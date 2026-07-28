package com.novacrm.estudiante;

/**
 * Estado de un hito de preparacion para la empleabilidad.
 *
 * <p>No es un booleano. En el seguimiento del programa hay 14 perfiles
 * ocupacionales "en proceso" y 10 hojas de vida en ingles a medias; colapsar
 * ese estado a {@code false} borra trabajo hecho y a {@code true} inventa
 * trabajo que no esta terminado. El indicador se falsea en las dos
 * direcciones, y es el indicador que se reporta.
 */
public enum EstadoHito {

    NO("No"),
    EN_PROCESO("En proceso"),
    SI("Si");

    private final String etiqueta;

    EstadoHito(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    public String getEtiqueta() {
        return etiqueta;
    }

    /** Solo {@link #SI} cuenta como hito cumplido. */
    public boolean cumplido() {
        return this == SI;
    }

    /**
     * Lee el valor tal y como lo escribe la hoja de calculo: "Sí", "si", "No",
     * "En proceso", o vacio. Lo que no reconoce cae a {@link #NO}, que es lo
     * mismo que significa una celda en blanco en la hoja.
     */
    public static EstadoHito desde(String texto) {
        if (texto == null) {
            return NO;
        }
        String limpio = quitarTildes(texto).trim().toLowerCase();
        return switch (limpio) {
            case "si", "sí", "s", "true", "x" -> SI;
            case "en proceso", "enproceso", "proceso", "parcial" -> EN_PROCESO;
            default -> NO;
        };
    }

    private static String quitarTildes(String texto) {
        return java.text.Normalizer.normalize(texto, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    }
}
