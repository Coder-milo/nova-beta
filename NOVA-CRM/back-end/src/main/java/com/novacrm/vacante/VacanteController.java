package com.novacrm.vacante;

import com.novacrm.scraper.ScrapingService;
import com.novacrm.vacante.dto.VacanteResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vacantes")
@Tag(name = "Vacantes", description = "Vacantes de empleo")
public class VacanteController {

    private final VacanteService vacanteService;
    private final ScrapingService scrapingService;

    public VacanteController(VacanteService vacanteService, ScrapingService scrapingService) {
        this.vacanteService = vacanteService;
        this.scrapingService = scrapingService;
    }

    @PostMapping("/scraping")
    @Operation(summary = "Escanear portales de empleo bajo demanda")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Map<String, Object> escanear() {
        int nuevas = scrapingService.ejecutarScraping();
        return Map.of("vacantesNuevas", nuevas);
    }

    @GetMapping
    @Operation(summary = "Listar vacantes activas (paginado)")
    public Page<VacanteResponse> listar(@PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return vacanteService.listarActivas(pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener vacante por ID")
    public VacanteResponse obtener(@PathVariable UUID id) {
        return vacanteService.obtener(id);
    }
}
