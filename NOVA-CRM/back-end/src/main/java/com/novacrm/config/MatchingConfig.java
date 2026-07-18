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

    @PostConstruct
    public void init() {
        try {
            Yaml yaml = new Yaml();
            InputStream is = new ClassPathResource("matching-config.yml").getInputStream();
            Map<String, Object> raw = yaml.load(is);
            if (raw == null) return;

            Map<String, Object> pesos = (Map<String, Object>) raw.get("pesos");
            if (pesos != null) {
                pesoAfinidad = toInt(pesos.getOrDefault("afinidad", pesoAfinidad));
                pesoHabilidades = toInt(pesos.getOrDefault("habilidades", pesoHabilidades));
                pesoIngles = toInt(pesos.getOrDefault("ingles", pesoIngles));
                pesoUbicacion = toInt(pesos.getOrDefault("ubicacion", pesoUbicacion));
                pesoExperiencia = toInt(pesos.getOrDefault("experiencia", pesoExperiencia));
            }

            umbralMinimo = toInt(raw.getOrDefault("umbral_minimo", umbralMinimo));
            maxVacantesPorEjecucion = toInt(raw.getOrDefault("max_vacantes_por_ejecucion", maxVacantesPorEjecucion));
        } catch (Exception e) {
            throw new RuntimeException("Error al cargar matching-config.yml", e);
        }
    }

    private int toInt(Object val) {
        if (val instanceof Number n) return n.intValue();
        if (val instanceof String s) return Integer.parseInt(s);
        return 0;
    }

    public int getPesoAfinidad() { return pesoAfinidad; }
    public int getPesoHabilidades() { return pesoHabilidades; }
    public int getPesoIngles() { return pesoIngles; }
    public int getPesoUbicacion() { return pesoUbicacion; }
    public int getPesoExperiencia() { return pesoExperiencia; }
    public int getUmbralMinimo() { return umbralMinimo; }
    public int getMaxVacantesPorEjecucion() { return maxVacantesPorEjecucion; }
}
