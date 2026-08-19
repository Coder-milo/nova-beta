package com.novacrm.config;

import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.util.Map;

@Component
public class MatchingConfig {

    private int pesoAfinidad = 35;
    private int pesoHabilidades = 10;
    private int pesoIngles = 20;
    private int pesoUbicacion = 15;
    private int pesoExperiencia = 20;
    private int umbralMinimo = 55;
    private int maxVacantesPorEjecucion = 500;

    /**
     * Fraccion minima del peso total que debe tener datos reales para que un
     * par llegue a ser match.
     *
     * <p>Sin esto, un puntaje alto calculado sobre un unico criterio pesaria lo
     * mismo que uno calculado sobre los cinco, y volveriamos a recomendar
     * vacantes de las que apenas se sabe nada.
     */
    private double coberturaMinima = 0.35;

    @PostConstruct
    public void init() {
        try {
            Yaml yaml = new Yaml();
            InputStream is = new ClassPathResource("matching-config.yml").getInputStream();
            Map<String, Object> raw = yaml.load(is);
            if (raw == null) return;

            Map<String, Object> pesos = (Map<String, Object>) raw.get("pesos");
            if (pesos != null) {
                pesoAfinidad = toInt(pesos.getOrDefault("afinidad", pesoAfinidad), "pesos.afinidad");
                pesoHabilidades = toInt(pesos.getOrDefault("habilidades", pesoHabilidades), "pesos.habilidades");
                pesoIngles = toInt(pesos.getOrDefault("ingles", pesoIngles), "pesos.ingles");
                pesoUbicacion = toInt(pesos.getOrDefault("ubicacion", pesoUbicacion), "pesos.ubicacion");
                pesoExperiencia = toInt(pesos.getOrDefault("experiencia", pesoExperiencia), "pesos.experiencia");
            }

            umbralMinimo = toInt(raw.getOrDefault("umbral_minimo", umbralMinimo), "umbral_minimo");
            maxVacantesPorEjecucion = toInt(
                    raw.getOrDefault("max_vacantes_por_ejecucion", maxVacantesPorEjecucion),
                    "max_vacantes_por_ejecucion");
            coberturaMinima = toDouble(
                    raw.getOrDefault("cobertura_minima", coberturaMinima), "cobertura_minima");

            // BE-11: fallar rapido en el arranque si la config no tiene
            // sentido, en vez de dejar que el motor de matching puntue mal en
            // silencio con pesos que no suman 100 o un umbral fuera de rango.
            int sumaPesos = pesoAfinidad + pesoHabilidades + pesoIngles + pesoUbicacion + pesoExperiencia;
            if (sumaPesos != 100) {
                throw new IllegalStateException(
                        "Los pesos de matching-config.yml deben sumar 100 (suma actual: " + sumaPesos + ")");
            }
            if (umbralMinimo < 0 || umbralMinimo > 100) {
                throw new IllegalStateException(
                        "umbral_minimo debe estar entre 0 y 100 (valor actual: " + umbralMinimo + ")");
            }
            if (maxVacantesPorEjecucion <= 0) {
                throw new IllegalStateException(
                        "max_vacantes_por_ejecucion debe ser mayor que 0 (valor actual: " + maxVacantesPorEjecucion + ")");
            }
            if (coberturaMinima < 0 || coberturaMinima > 1) {
                throw new IllegalStateException(
                        "cobertura_minima debe estar entre 0 y 1 (valor actual: " + coberturaMinima + ")");
            }
        } catch (Exception e) {
            throw new RuntimeException("Error al cargar matching-config.yml", e);
        }
    }

    private double toDouble(Object val, String clave) {
        if (val instanceof Number n) return n.doubleValue();
        if (val instanceof String s) {
            try {
                return Double.parseDouble(s.trim());
            } catch (NumberFormatException e) {
                throw new IllegalStateException(
                        "Valor no numerico para '" + clave + "' en matching-config.yml: '" + s + "'");
            }
        }
        throw new IllegalStateException(
                "Valor invalido para '" + clave + "' en matching-config.yml: " + val);
    }

    private int toInt(Object val, String clave) {
        if (val instanceof Number n) return n.intValue();
        if (val instanceof String s) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException e) {
                throw new IllegalStateException(
                        "Valor no numerico para '" + clave + "' en matching-config.yml: '" + s + "'");
            }
        }
        throw new IllegalStateException(
                "Valor invalido para '" + clave + "' en matching-config.yml: " + val);
    }

    public int getPesoAfinidad() { return pesoAfinidad; }
    public int getPesoHabilidades() { return pesoHabilidades; }
    public int getPesoIngles() { return pesoIngles; }
    public int getPesoUbicacion() { return pesoUbicacion; }
    public int getPesoExperiencia() { return pesoExperiencia; }
    public int getUmbralMinimo() { return umbralMinimo; }
    public int getMaxVacantesPorEjecucion() { return maxVacantesPorEjecucion; }
    public double getCoberturaMinima() { return coberturaMinima; }

    /** Suma de los cinco pesos; siempre 100 tras la validacion de arranque. */
    public int getPesoTotal() {
        return pesoAfinidad + pesoHabilidades + pesoIngles + pesoUbicacion + pesoExperiencia;
    }
}
