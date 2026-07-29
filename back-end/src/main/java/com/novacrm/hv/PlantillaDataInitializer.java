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
        if (repo.findFirstByPredeterminadaTrueAndActivoTrue().isPresent()) {
            return;
        }
        var existentes = repo.findByActivoTrueOrderByCreatedAtDesc();
        if (existentes.stream().anyMatch(p -> p.getContenidoHtml() != null)) {
            return;
        }

        var html = new ClassPathResource("templates/hv/resume-ats-cac-flat.html")
                .getContentAsString(StandardCharsets.UTF_8);
        var manifest = new ClassPathResource("templates/hv/resume-ats-cac-manifest.json")
                .getContentAsString(StandardCharsets.UTF_8);

        var p = new PlantillaHv();
        p.setNombre("CAC ATS");
        p.setColorPrimario("#1F4E79");
        p.setContenidoHtml(html);
        p.setFieldManifest(manifest);
        p.setPredeterminada(true);
        repo.save(p);
    }
}
