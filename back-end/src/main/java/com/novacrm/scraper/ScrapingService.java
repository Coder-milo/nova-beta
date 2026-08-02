package com.novacrm.scraper;

import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.scraper.dto.ResultadoActualizacion;
import com.novacrm.scraper.fuente.FuenteDeVacantes;
import com.novacrm.scraper.fuente.OfertaCruda;
import com.novacrm.vacante.MotivoCierre;
import com.novacrm.vacante.RegistroDeVacante;
import com.novacrm.vacante.VacanteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Orquesta la actualizacion de vacantes: consulta las fuentes habilitadas,
 * guarda lo nuevo, cierra lo vencido y deja constancia de la corrida.
 *
 * <p>Compartido por la tarea diaria y por el boton de escaneo del panel.
 *
 * <p>Primero se consulta todo y despues se guarda. Antes la corrida entera
 * —decenas de llamadas de red— ocurria dentro de una sola transaccion, de modo
 * que una fuente lenta mantenia abierta una conexion a la base sin usarla, y un
 * fallo al final tiraba abajo lo que ya habia llegado bien.
 */
@Service
public class ScrapingService {

    private static final Logger log = LoggerFactory.getLogger(ScrapingService.class);

    private final List<FuenteDeVacantes> fuentes;
    private final EstudianteRepository estudianteRepository;
    private final VacanteRepository vacanteRepository;
    private final ScrapingEjecucionRepository ejecucionRepository;
    private final RegistroDeVacante registroDeVacante;

    public ScrapingService(List<FuenteDeVacantes> fuentes,
                           EstudianteRepository estudianteRepository,
                           VacanteRepository vacanteRepository,
                           ScrapingEjecucionRepository ejecucionRepository,
                           RegistroDeVacante registroDeVacante) {
        this.fuentes = fuentes;
        this.estudianteRepository = estudianteRepository;
        this.vacanteRepository = vacanteRepository;
        this.ejecucionRepository = ejecucionRepository;
        this.registroDeVacante = registroDeVacante;
    }

    public ResultadoActualizacion ejecutarScraping() {
        return actualizar(ScrapingEjecucion.Origen.MANUAL);
    }

    public ResultadoActualizacion actualizar(ScrapingEjecucion.Origen origen) {
        var inicio = LocalDateTime.now();
        var activas = fuentes.stream().filter(FuenteDeVacantes::estaHabilitada).toList();
        var errores = new ArrayList<String>();

        int cerradas = cerrarVencidas();

        // Fase de red, fuera de transaccion.
        var criterios = criteriosDeBusqueda();
        List<OfertaCruda> encontradas = consultarFuentes(activas, criterios, errores);

        // Fase de base de datos.
        int nuevas = guardar(encontradas);

        return registrarEjecucion(origen, inicio, activas, nuevas, cerradas, errores);
    }

    /**
     * Cierra las vacantes cuya fecha ya paso. Es lo que impide que se sigan
     * recomendando ofertas caducadas.
     */
    @Transactional
    public int cerrarVencidas() {
        var ahora = LocalDateTime.now();
        var vencidas = vacanteRepository.findVencidasSinCerrar(ahora);
        vencidas.forEach(v -> v.cerrar(MotivoCierre.EXPIRADA, ahora));
        vacanteRepository.saveAll(vencidas);
        return vencidas.size();
    }

    /** Terminos y ciudades derivados de lo que declararon los participantes. */
    @Transactional(readOnly = true)
    public Criterios criteriosDeBusqueda() {
        var terminos = TerminosDeBusqueda.desdeEstudiantes(
                estudianteRepository.findCargosObjetivoDeActivos(),
                estudianteRepository.findSectoresObjetivoDeActivos());
        var ciudades = TerminosDeBusqueda.ciudades(
                estudianteRepository.findCiudadesDeActivosPorFrecuencia());
        return new Criterios(terminos, ciudades);
    }

    public record Criterios(List<String> terminos, List<String> ciudades) {}

    /**
     * Consulta cada fuente con los pares que de verdad le cambian el resultado.
     *
     * <p>Antes se recorria termino×ciudad para todas por igual, aunque ninguna
     * implementacion usara la ciudad: eran cinco peticiones identicas por
     * termino, hasta cuarenta por corrida, contra APIs que piden como mucho
     * cuatro al dia o que cobran por llamada.
     */
    private List<OfertaCruda> consultarFuentes(List<FuenteDeVacantes> activas,
                                               Criterios criterios,
                                               List<String> errores) {
        List<OfertaCruda> encontradas = new ArrayList<>();

        for (var fuente : activas) {
            var consultas = consultasPara(fuente, criterios);
            log.info("[{}] {} consulta(s), segmento {}",
                    fuente.nombre(), consultas.size(), fuente.segmento());

            for (var consulta : consultas) {
                try {
                    var resultado = fuente.buscar(consulta.termino(), consulta.ciudad());
                    if (resultado.fallo()) {
                        errores.add(fuente.nombre() + ": " + resultado.error());
                        log.warn("[{}] '{}': {}",
                                fuente.nombre(), consulta.termino(), resultado.error());
                        continue;
                    }
                    encontradas.addAll(resultado.ofertas());
                } catch (Exception e) {
                    // Una fuente que revienta no puede llevarse las demas.
                    errores.add(fuente.nombre() + ": " + e.getMessage());
                    log.error("[{}] error con '{}': {}",
                            fuente.nombre(), consulta.termino(), e.getMessage());
                }
            }
        }
        return encontradas;
    }

    record Consulta(String termino, String ciudad) {}

    /**
     * Pares (termino, ciudad) a consultar, sin repetir y recortados al tope que
     * declara la fuente.
     */
    List<Consulta> consultasPara(FuenteDeVacantes fuente, Criterios criterios) {
        var consultas = new LinkedHashSet<Consulta>();
        for (String termino : criterios.terminos()) {
            if (!fuente.filtraPorCiudad()) {
                consultas.add(new Consulta(termino, null));
                continue;
            }
            for (String ciudad : criterios.ciudades()) {
                consultas.add(new Consulta(termino, ciudad));
            }
        }
        return consultas.stream().limit(fuente.maximoConsultasPorCorrida()).toList();
    }

    /**
     * Guarda lo que no estuviera ya, enriqueciendolo por el camino.
     *
     * <p>El indice unico de {@code hash_dedup} es la ultima palabra: dentro de
     * una misma corrida la misma oferta puede llegar por dos terminos distintos,
     * y dos corridas simultaneas pueden traerla a la vez.
     */
    @Transactional
    public int guardar(List<OfertaCruda> ofertas) {
        int nuevas = 0;
        for (var oferta : ofertas) {
            try {
                if (registroDeVacante
                        .registrarSiEsNueva(oferta.vacante(), oferta.nombreEmpresa())
                        .isPresent()) {
                    nuevas++;
                }
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                log.debug("Vacante duplicada descartada por el indice unico");
            }
        }
        return nuevas;
    }

    @Transactional
    public ResultadoActualizacion registrarEjecucion(ScrapingEjecucion.Origen origen,
                                                     LocalDateTime inicio,
                                                     List<FuenteDeVacantes> activas,
                                                     int nuevas, int cerradas,
                                                     List<String> errores) {
        var ejecucion = new ScrapingEjecucion();
        ejecucion.setInicio(inicio);
        ejecucion.setOrigen(origen);
        ejecucion.setPortales(activas.stream()
                .map(FuenteDeVacantes::nombre)
                .collect(Collectors.joining(",")));
        ejecucion.setVacantesNuevas(nuevas);
        ejecucion.setVacantesCerradas(cerradas);
        ejecucion.setFin(LocalDateTime.now());
        if (!errores.isEmpty()) {
            // Una corrida en la que fallaron las fuentes tiene que verse como
            // fallida en el panel, no como una tranquila sin novedades.
            ejecucion.setError(String.join("; ", errores));
        }
        ejecucionRepository.save(ejecucion);

        log.info("Actualizacion de vacantes: {} nuevas, {} cerradas, {} error(es)",
                nuevas, cerradas, errores.size());
        return new ResultadoActualizacion(nuevas, cerradas,
                vacanteRepository.contarVigentes(LocalDateTime.now()),
                ejecucion.getInicio(), ejecucion.getFin());
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
