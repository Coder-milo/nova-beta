package com.novacrm.catalogo.nivel_ingles;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Escala MCER (A1..C2) con su orden, alineada con {@code catalogo_nivel_ingles}.
 *
 * <p>Sirve para leer el nivel real desde textos heterogeneos: los resultados de
 * las pruebas llegan como "A2+" o "A1+", y el nivel declarado en el formulario
 * como "B1 (Puedo comunicarme en situaciones sencillas)". El sufijo "+" no
 * cambia el nivel: un A2+ sigue siendo A2 y no alcanza un B1.
 */
public enum NivelMcer {

    A1(1), A2(2), B1(3), B2(4), C1(5), C2(6);

    /** Mismo orden que la columna {@code orden} del catalogo. */
    private final int orden;

    /** Busca el codigo como palabra suelta para no capturar "A1" dentro de otra. */
    private static final Pattern CODIGO = Pattern.compile("\\b([ABC][12])\\b");

    NivelMcer(int orden) {
        this.orden = orden;
    }

    public int getOrden() {
        return orden;
    }

    /**
     * Extrae el nivel de un texto libre.
     *
     * @return el nivel, o vacio si el texto no contiene ningun codigo MCER
     *         (por ejemplo "No estoy seguro/a", que aparece en el formulario).
     */
    public static Optional<NivelMcer> desdeTexto(String texto) {
        if (texto == null || texto.isBlank()) {
            return Optional.empty();
        }
        String normalizado = Normalizer.normalize(texto.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .toUpperCase(Locale.ROOT);

        var matcher = CODIGO.matcher(normalizado);
        if (!matcher.find()) {
            return Optional.empty();
        }
        try {
            return Optional.of(NivelMcer.valueOf(matcher.group(1)));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /** El menor de dos niveles; util cuando uno de los dos puede faltar. */
    public static Optional<NivelMcer> menor(Optional<NivelMcer> uno, Optional<NivelMcer> otro) {
        if (uno.isEmpty()) return otro;
        if (otro.isEmpty()) return uno;
        return Optional.of(uno.get().orden <= otro.get().orden ? uno.get() : otro.get());
    }
}
