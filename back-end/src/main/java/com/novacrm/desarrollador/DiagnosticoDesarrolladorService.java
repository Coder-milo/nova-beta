package com.novacrm.desarrollador;

import com.novacrm.configuracion.IntegracionesService;
import com.novacrm.configuracion.EstadoIntegracion;
import com.novacrm.scraper.ScrapingService;
import com.novacrm.scraper.dto.EjecucionDeScraping;
import com.novacrm.scraper.dto.EstadoConectorDto;
import com.novacrm.scraper.dto.ResultadoPruebaFuenteDto;
import org.springframework.boot.actuate.health.CompositeHealth;
import org.springframework.boot.actuate.health.HealthComponent;
import org.springframework.boot.actuate.health.HealthEndpoint;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/** Compone el estado vivo de la plataforma para la consola técnica. */
@Service
public class DiagnosticoDesarrolladorService {

    private final HealthEndpoint healthEndpoint;
    private final IntegracionesService integracionesService;
    private final ScrapingService scrapingService;
    private final Environment environment;

    public DiagnosticoDesarrolladorService(
            HealthEndpoint healthEndpoint,
            IntegracionesService integracionesService,
            ScrapingService scrapingService,
            Environment environment) {
        this.healthEndpoint = healthEndpoint;
        this.integracionesService = integracionesService;
        this.scrapingService = scrapingService;
        this.environment = environment;
    }

    public DiagnosticoDesarrolladorResponse resumen() {
        HealthComponent salud = healthEndpoint.health();
        List<DiagnosticoDesarrolladorResponse.Componente> componentes = componentesDe(salud);

        var integraciones = integracionesService.listar().stream()
                .map(estado -> new DiagnosticoDesarrolladorResponse.Integracion(
                        estado.id(),
                        estado.nombre(),
                        estado.categoria(),
                        estado.configurada(),
                        estado.probable(),
                        estado.resumen(),
                        estado.advertencia()))
                .toList();

        return new DiagnosticoDesarrolladorResponse(
                salud.getStatus().getCode(),
                Instant.now(),
                componentes,
                integraciones,
                new DiagnosticoDesarrolladorResponse.Runtime(
                        System.getProperty("java.version", "desconocida"),
                        perfilActivo()));
    }

    /**
     * Las fuentes de vacantes son operación técnica: permiten saber si un
     * proveedor responde, pero no exponen las ofertas ni escriben datos.
     */
    public List<EstadoConectorDto> conectoresDeVacantes() {
        return scrapingService.listarEstadoConectores();
    }

    /** Prueba aislada; no crea ni actualiza vacantes. */
    public ResultadoPruebaFuenteDto probarConectorDeVacantes(String fuente) {
        return scrapingService.probarFuente(fuente);
    }

    /** Historial técnico para investigar fallos de sincronización. */
    public List<EjecucionDeScraping> ejecucionesDeVacantes() {
        return scrapingService.historial();
    }

    /**
     * La prueba de una integración es deliberadamente distinta a editar su
     * configuración: no recibe ni devuelve credenciales.
     */
    public EstadoIntegracion.ResultadoPrueba probarIntegracion(String id) {
        return integracionesService.probar(id);
    }

    private static List<DiagnosticoDesarrolladorResponse.Componente> componentesDe(
            HealthComponent salud) {
        if (!(salud instanceof CompositeHealth compuesto)) {
            return List.of(new DiagnosticoDesarrolladorResponse.Componente(
                    "aplicación", salud.getStatus().getCode()));
        }

        List<DiagnosticoDesarrolladorResponse.Componente> componentes = compuesto.getComponents()
                .entrySet()
                .stream()
                .map(entry -> new DiagnosticoDesarrolladorResponse.Componente(
                        entry.getKey(), entry.getValue().getStatus().getCode()))
                .toList();

        if (componentes.isEmpty()) {
            componentes = List.of(new DiagnosticoDesarrolladorResponse.Componente(
                    "aplicación", salud.getStatus().getCode()));
        }
        return componentes;
    }

    private String perfilActivo() {
        String[] perfiles = environment.getActiveProfiles();
        return perfiles.length == 0 ? "default" : String.join(", ", perfiles);
    }
}
