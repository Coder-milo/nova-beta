package com.novacrm.dashboard.dto;

/** Punto genérico para gráficos: etiqueta, valor y (opcional) porcentaje. */
public record PuntoDato(String label, long value, Double pct) {

    public static PuntoDato de(String label, long value) {
        return new PuntoDato(label, value, null);
    }
}
