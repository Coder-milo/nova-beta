package com.novacrm.vacante;

import com.novacrm.scraper.ScrapingService;
import com.novacrm.scraper.dto.ResultadoActualizacion;
import com.novacrm.vacante.dto.VacanteRequest;
import com.novacrm.vacante.dto.VacanteResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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

    @PostMapping("/actualizar")
    @Operation(summary = "Buscar ofertas nuevas en los portales y cerrar las vencidas")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResultadoActualizacion actualizar() {
        return scrapingService.ejecutarScraping();
    }

    /** Se mantiene el nombre anterior para no romper al frontend ya desplegado. */
    @PostMapping("/scraping")
    @Operation(summary = "Alias de /actualizar", deprecated = true)
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResultadoActualizacion escanear() {
        return scrapingService.ejecutarScraping();
    }

    @GetMapping("/ultima-actualizacion")
    @Operation(summary = "Cuantas ofertas entraron en la ultima actualizacion")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Map<String, Object> ultimaActualizacion() {
        return scrapingService.ultimaActualizacion()
                .<Map<String, Object>>map(r -> Map.of(
                        "vacantesNuevas", r.vacantesNuevas(),
                        "vacantesCerradas", r.vacantesCerradas(),
                        "vigentesTotal", r.vigentesTotal(),
                        "fecha", r.fin()))
                .orElse(Map.of("mensaje", "Todavia no se ha ejecutado ninguna actualizacion"));
    }

    @GetMapping
    @Operation(summary = "Listar vacantes vigentes (paginado)")
    public Page<VacanteResponse> listar(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return vacanteService.listarActivas(pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener vacante por ID")
    // Solo el equipo: devuelve tambien cerradas, con motivo de cierre interno y
    // quien la registro (email del coordinador). El estudiante ve las vigentes
    // por el listado, que ya filtra.
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public VacanteResponse obtener(@PathVariable UUID id) {
        return vacanteService.obtener(id);
    }

    @PostMapping
    @Operation(summary = "Registrar una oferta, con enlace o escribiendola a mano")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public VacanteResponse crear(@Valid @RequestBody VacanteRequest request, Authentication auth) {
        return vacanteService.crearDesdeUrl(request, auth.getName(), true);
    }

    /**
     * Alta de una oferta por parte de un participante.
     *
     * <p>Los estudiantes encuentran ofertas que el sistema no ve —grupos de
     * WhatsApp, avisos en la universidad, un conocido— y perderlas es perder lo
     * mejor que tiene el programa. Entra {@code revisada = false}: se guarda y
     * el participante puede postularse a ella, pero no se le recomienda a nadie
     * mas hasta que alguien del equipo la valide.
     */
    @PostMapping("/sugeridas")
    @Operation(summary = "Registrar una oferta encontrada por un estudiante")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public VacanteResponse sugerir(@Valid @RequestBody VacanteRequest request, Authentication auth) {
        return vacanteService.crearDesdeUrl(request, auth.getName(), false);
    }

    @GetMapping("/pendientes-de-revisar")
    @Operation(summary = "Ofertas sugeridas por estudiantes y aun sin validar")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Page<VacanteResponse> pendientesDeRevisar(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return vacanteService.pendientesDeRevisar(pageable);
    }

    @PostMapping("/{id}/revisar")
    @Operation(summary = "Dar por buena una oferta sugerida por un estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public VacanteResponse revisar(@PathVariable UUID id) {
        return vacanteService.marcarRevisada(id);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Corregir una oferta ya registrada")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public VacanteResponse actualizar(@PathVariable UUID id,
                                      @Valid @RequestBody VacanteRequest request) {
        return vacanteService.actualizar(id, request);
    }

    @PostMapping("/{id}/cerrar")
    @Operation(summary = "Cerrar una oferta (ya cubierta, retirada o vencida)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public VacanteResponse cerrar(@PathVariable UUID id,
                                  @RequestParam(required = false) MotivoCierre motivo) {
        return vacanteService.cerrar(id, motivo);
    }

    @PostMapping("/{id}/reabrir")
    @Operation(summary = "Volver a abrir una oferta cerrada por error")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public VacanteResponse reabrir(@PathVariable UUID id) {
        return vacanteService.reabrir(id);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar una vacante")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public void eliminar(@PathVariable UUID id) {
        vacanteService.eliminar(id);
    }
}
