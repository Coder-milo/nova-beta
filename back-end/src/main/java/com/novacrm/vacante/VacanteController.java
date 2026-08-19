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

import java.util.List;
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

    /**
     * Cierra las ofertas abiertas que no exigen ingles.
     *
     * <p>Limpieza puntual para lo que se guardo antes de que existiera el
     * colador bilingue. Se cierran con motivo propio, no se borran: el
     * historico de que ofertas se vieron y de que portal sigue sirviendo.
     */
    @PostMapping("/depurar-no-bilingues")
    @Operation(summary = "Cerrar las ofertas abiertas que no exigen ingles")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Map<String, Object> depurarNoBilingues() {
        int cerradas = scrapingService.cerrarLasQueNoExigenIngles();
        return Map.of("cerradas", cerradas);
    }

    @GetMapping("/scraping/ejecuciones")
    @Operation(summary = "Registro de las ultimas corridas de actualizacion, con sus errores")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public java.util.List<com.novacrm.scraper.dto.EjecucionDeScraping> ejecuciones() {
        return scrapingService.historial();
    }

    @GetMapping("/scraping/fuentes")
    @Operation(summary = "Listado de estado en vivo de conectores y fuentes de scraping")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<com.novacrm.scraper.dto.EstadoConectorDto> fuentes() {
        return scrapingService.listarEstadoConectores();
    }

    @PostMapping("/scraping/fuentes/{fuente}/probar")
    @Operation(summary = "Probar una fuente o conector específico sin persistir datos")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public com.novacrm.scraper.dto.ResultadoPruebaFuenteDto probarFuente(@PathVariable String fuente) {
        return scrapingService.probarFuente(fuente);
    }

    @PostMapping("/scraping/fuentes/{fuente}/sincronizar")
    @Operation(summary = "Sincronizar una sola fuente bajo demanda y guardar nuevas ofertas")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResultadoActualizacion sincronizarFuente(@PathVariable String fuente) {
        return scrapingService.sincronizarFuente(fuente);
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

    /**
     * El estudiante ve el anuncio; no ve como lo gestiona el equipo.
     *
     * <p>{@code creadaPor} y {@code motivoCierre} sólo viajan hacia gestión. El
     * detalle por identificador ya estaba restringido por ese motivo, pero este
     * listado devolvía los mismos campos y sí lo alcanza el estudiante: en una
     * oferta sugerida, {@code creadaPor} es el correo de otro participante.
     */
    @GetMapping
    @Operation(summary = "Listar vacantes vigentes (paginado)")
    public Page<VacanteResponse> listar(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable,
            Authentication auth) {
        return vacanteService.listarActivas(pageable, esGestion(auth));
    }

    /** ADMIN o COORDINADOR. Un estudiante nunca lo es, aunque tenga sesión. */
    private static boolean esGestion(Authentication auth) {
        if (auth == null) return false;
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")
                        || a.getAuthority().equals("ROLE_COORDINADOR"));
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

    @PostMapping("/{id}/revisar")
    @Operation(summary = "Dar por buena una oferta pendiente de revision")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public VacanteResponse revisar(@PathVariable UUID id) {
        return vacanteService.marcarRevisada(id);
    }

    /** Motivo del rechazo. Obligatorio: sin el, quien publico no sabe que corregir. */
    public record RechazoDeVacante(
            @jakarta.validation.constraints.NotBlank(message = "Hace falta decir por que se rechaza")
            @jakarta.validation.constraints.Size(max = 2000) String motivo) {}

    @PostMapping("/{id}/rechazar")
    @Operation(summary = "Rechazar una oferta diciendo por que, para que se pueda corregir")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public VacanteResponse rechazar(@PathVariable UUID id,
                                    @Valid @RequestBody RechazoDeVacante cuerpo,
                                    Authentication auth) {
        return vacanteService.rechazar(id, cuerpo.motivo(), auth.getName());
    }

    @GetMapping("/cola-revision")
    @Operation(summary = "Ofertas pendientes de revision, las del portal primero")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<VacanteResponse> colaDeRevision() {
        return vacanteService.colaDeRevision();
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
