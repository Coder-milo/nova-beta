package com.novacrm.hv;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;

/**
 * Si no existe una plantilla CAC predeterminada con contenido HTML,
 * la crea con el template flat y el manifest actuales.
 */
@Component
public class PlantillaDataInitializer implements CommandLineRunner {

    private final PlantillaHvRepository repo;

    public PlantillaDataInitializer(PlantillaHvRepository repo) {
        this.repo = repo;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        // Desactivar o migrar plantillas legadas sin código de sistema
        repo.findAll().forEach(p -> {
            if (p.getCodigo() == null && p.getObjectKey() == null) {
                if ("CAC ATS".equalsIgnoreCase(p.getNombre())) {
                    p.setCodigo("CAC_ATS");
                    p.setNombre("CAC ATS Tradicional (Sin foto)");
                    repo.save(p);
                } else {
                    p.setActivo(false);
                    repo.save(p);
                }
            }
        });

        crearSiNoExiste("CAC_ATS", "CAC ATS Tradicional (Sin foto)", "#1F4E79", true);
        crearSiNoExiste("CLASICO_FOTO", "Clásico Profesional (Con foto)", "#2A5C8A", false);
        crearSiNoExiste("MODERNO", "Moderno Compacto (Dos columnas)", "#0F4C81", false);
    }

    private void crearSiNoExiste(String codigo, String nombre, String color, boolean predeterminada) {
        if (repo.findAll().stream().anyMatch(p -> codigo.equals(p.getCodigo()))) {
            return;
        }
        var p = new PlantillaHv();
        p.setCodigo(codigo);
        p.setNombre(nombre);
        p.setColorPrimario(color);
        p.setPredeterminada(predeterminada && repo.findFirstByPredeterminadaTrueAndActivoTrue().isEmpty());
        p.setActivo(true);
        repo.save(p);
    }
}
