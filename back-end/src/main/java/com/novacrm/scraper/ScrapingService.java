package com.novacrm.scraper;

import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.scraper.dto.ResultadoActualizacion;
import com.novacrm.scraper.portal.PortalScraper;
import com.novacrm.vacante.MotivoCierre;
import com.novacrm.vacante.VacanteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Orquesta la actualizacion de vacantes: consulta los portales habilitados,
 * cierra las que vencieron y deja constancia de la corrida.
 *
 * <p>Compartido por la tarea diaria y por el boton de escaneo del panel.
 */
@Service
public class ScrapingService {

    private static final Logger log = LoggerFactory.getLogger(ScrapingService.class);

    private final List<PortalScraper> scrapers;
    private final EstudianteRepository estudianteRepository;
    private final VacanteRepository vacanteRepository;
    private final ScrapingEjecucionRepository ejecucionRepository;

    public ScrapingService(List<PortalScraper> scrapers,
                           EstudianteRepository estudianteRepository,
                           VacanteRepository vacanteRepository,
                           ScrapingEjecucionRepository ejecucionRepository) {
        this.scrapers = scrapers;
        this.estudianteRepository = estudianteRepository;
        this.vacanteRepository = vacanteRepository;
        this.ejecucionRepository = ejecucionRepository;
    }

    @Transactional
    public ResultadoActualizacion ejecutarScraping() {
        return actualizar(ScrapingEjecucion.Origen.MANUAL);
    }

    @Transactional
    public ResultadoActualizacion actualizar(ScrapingEjecucion.Origen origen) {
        var ejecucion = new ScrapingEjecucion();
        ejecucion.setInicio(LocalDateTime.now());
        ejecucion.setOrigen(origen);
        ejecucion.setPortales(scrapers.stream()
                .map(PortalScraper::getPortalNombre)
                .collect(Collectors.joining(",")));

        int nuevas = 0;
        int cerradas = 0;
        var errores = new StringBuilder();

        try {
            cerradas = cerrarVencidas();
            nuevas = buscarEnPortales(errores);
        } catch (Exception e) {
            log.error("Fallo la actualizacion de vacantes: {}", e.getMessage());
            errores.append(e.getMessage());
        }

        ejecucion.setVacantesNuevas(nuevas);
        ejecucion.setVacantesCerradas(cerradas);
        ejecucion.setFin(LocalDateTime.now());
        if (errores.length() > 0) {
            ejecucion.setError(errores.toString());
        }
        ejecucionRepository.save(ejecucion);

        log.info("Actualizacion de vacantes: {} nuevas, {} cerradas", nuevas, cerradas);
        return new ResultadoActualizacion(nuevas, cerradas,
                vacanteRepository.contarVigentes(LocalDateTime.now()),
                ejecucion.getInicio(), ejecucion.getFin());
    }

    /**
     * Cierra las vacantes cuya fecha ya paso. Es lo que impide que se sigan
     * recomendando ofertas caducadas.
     */
    private int cerrarVencidas() {
        var ahora = LocalDateTime.now();
        var vencidas = vacanteRepository.findVencidasSinCerrar(ahora);
        vencidas.forEach(v -> v.cerrar(MotivoCierre.EXPIRADA, ahora));
        vacanteRepository.saveAll(vencidas);
        return vencidas.size();
    }

    private int buscarEnPortales(StringBuilder errores) {
        var terminos = TerminosDeBusqueda.desdeEstudiantes(
                estudianteRepository.findCargosObjetivoDeActivos(),
                estudianteRepository.findSectoresObjetivoDeActivos());
        var ciudades = TerminosDeBusqueda.ciudades(
                estudianteRepository.findCiudadesDeActivosPorFrecuencia());

        log.info("Buscando {} termino(s) en {} ciudad(es) sobre {} portal(es)",
                terminos.size(), ciudades.size(), scrapers.size());

        int total = 0;
        for (var scraper : scrapers) {
            for (String termino : terminos) {
                for (String ciudad : ciudades) {
                    try {
                        int encontradas = scraper.buscar(termino, ciudad).size();
                        if (encontradas > 0) {
                            log.info("[{}] '{}' en {}: {} nuevas",
                                    scraper.getPortalNombre(), termino, ciudad, encontradas);
                        }
                        total += encontradas;
                    } catch (Exception e) {
                        log.error("Error en {} con '{}': {}",
                                scraper.getPortalNombre(), termino, e.getMessage());
                        errores.append(scraper.getPortalNombre()).append(": ")
                                .append(e.getMessage()).append("; ");
                    }
                }
            }
        }
        return total;
    }

    /** Resumen de la ultima actualizacion terminada, para el panel. */
    @Transactional(readOnly = true)
    public Optional<ResultadoActualizacion> ultimaActualizacion() {
        return ejecucionRepository.findFirstByFinIsNotNullOrderByInicioDesc()
                .map(e -> new ResultadoActualizacion(
                        e.getVacantesNuevas(),
                        e.getVacantesCerradas(),
                        vacanteRepository.contarVigentes(LocalDateTime.now()),
                        e.getInicio(),
                        e.getFin()));
    }
}
