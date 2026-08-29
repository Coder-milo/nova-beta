package com.novacrm.desarrollador;

import com.novacrm.configuracion.IntegracionesService;
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
    private final Environment environment;

    public DiagnosticoDesarrolladorService(
            HealthEndpoint healthEndpoint,
            IntegracionesService integracionesService,
            Environment environment) {
        this.healthEndpoint = healthEndpoint;
        this.integracionesService = integracionesService;
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
