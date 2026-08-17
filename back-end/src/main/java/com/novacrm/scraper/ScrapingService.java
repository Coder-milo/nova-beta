package com.novacrm.scraper;

import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.scraper.dto.EjecucionDeScraping;
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
import java.util.Arrays;
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

    /**
     * Hilos como mucho para consultar portales.
     *
     * <p>Cuatro y no «uno por fuente»: el trabajo es espera de red, así que más
     * hilos no aceleran nada una vez saturado el enlace, y sí multiplican las
     * peticiones simultáneas al mismo portal —que es como se provoca el 429 que
     * después hay que reintentar—.
     */
    private static final int MAXIMO_HILOS = 4;

    /**
     * Tope de la fase de red.
     *
     * <p>Antes no había ninguno: una fuente que aceptaba la conexión y no
     * respondía dejaba la corrida abierta hasta el timeout de su propio cliente,
     * y con la tarea diaria eso solapaba una corrida con la siguiente.
     */
    private static final java.time.Duration TOPE_DE_LA_CORRIDA = java.time.Duration.ofMinutes(8);

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

        // Cuantas trajo cada portal, antes de deduplicar. Se cuenta aqui y no
        // despues de guardar porque lo que dice si un portal sigue vivo es lo
        // que devolvio, no lo que resulto ser nuevo: un portal sano en una
        // semana sin movimiento trae cuarenta ofertas ya conocidas y grabaria
        // cero igual que uno con los selectores rotos.
        var porPortal = contarPorPortal(activas, encontradas);

        // El colador bilingue va despues de contar por portal y antes de
        // guardar: asi el registro sigue diciendo que trajo cada fuente —que es
        // como se ve si un portal murio— y aparte, cuantas se dejaron fuera.
        var bilingues = soloBilingues(encontradas);
        int descartadas = encontradas.size() - bilingues.size();

        // Fase de base de datos.
        int nuevas = guardar(bilingues);

        return registrarEjecucion(origen, inicio, activas, nuevas, cerradas, errores,
                porPortal, descartadas);
    }

    /**
     * Deja solo las ofertas de trabajo en ingles.
     *
     * <p>El programa es de empleabilidad bilingue y el BPO del Atlantico es su
     * salida natural. Buscar «bilingue» en los portales acerca pero no basta:
     * un buscador que recibe «asesor bilingue» devuelve tambien «asesor
     * comercial», y esas ofertas llegaban al tablon a competir por la atencion
     * de gente que no puede tomarlas.
     *
     * <p>Se descartan aqui y no en cada fuente por dos razones: es un solo
     * sitio que revisar cuando la regla cambie, y el conteo por portal se hace
     * antes —una fuente que trae cuarenta monolingues sigue estando viva, y si
     * el descarte pasara por delante se leeria como un portal caido—.
     *
     * <p>Cuantas se dejaron fuera queda escrito en la corrida. Un filtro que
     * descarta en silencio es indistinguible de un portal que dejo de
     * responder, y ese es exactamente el diagnostico que hay que poder hacer.
     */
    private static List<OfertaCruda> soloBilingues(List<OfertaCruda> encontradas) {
        var bilingues = new ArrayList<OfertaCruda>();
        for (var oferta : encontradas) {
            if (com.novacrm.scraper.fuente.FiltroBilingue.esDeTrabajoEnIngles(oferta.vacante())) {
                bilingues.add(oferta);
            } else {
                log.debug("Descartada por no exigir ingles: {} [{}]",
                        oferta.vacante().getTitulo(), oferta.vacante().getFuente());
            }
        }
        return bilingues;
    }

    /** Portal → ofertas devueltas, incluidas las fuentes que no trajeron nada. */
    private static java.util.LinkedHashMap<String, Integer> contarPorPortal(
            List<FuenteDeVacantes> activas, List<OfertaCruda> encontradas) {
        var conteo = encontradas.stream()
                .collect(Collectors.groupingBy(o -> o.vacante().getFuente(), Collectors.counting()));
        var porPortal = new java.util.LinkedHashMap<String, Integer>();
        // Se parte de las fuentes activas para que las que devolvieron cero
        // aparezcan con su cero. Recorrer solo lo encontrado las omitiria, que
        // es exactamente la fuente que hay que ver.
        for (var fuente : activas) {
            porPortal.put(fuente.nombre(), conteo.getOrDefault(fuente.nombre(), 0L).intValue());
        }
        return porPortal;
    }

    /**
     * Cierra las ofertas abiertas que no exigen ingles.
     *
     * <p>Es una limpieza puntual, no parte de la corrida: lo que entra desde
     * que existe {@code FiltroBilingue} ya viene colado, pero lo que se guardo
     * antes sigue en el tablon compitiendo por la atencion de gente que no
     * puede tomarlo.
     *
     * <p>Se <strong>cierran</strong>, no se borran, y con motivo propio
     * ({@link MotivoCierre#FUERA_DE_PERFIL}). Borrarlas perderia el historico
     * —cuantas ofertas se vieron, de que portal— y contarlas como retiradas
     * inflaria las que «se perdieron»: nunca fueron de esta poblacion.
     *
     * <p>Deja las de segmento {@code REMOTO_INGLES} en paz por la misma razon
     * que el filtro: nacen en ingles y no lo anuncian.
     *
     * @return cuantas se cerraron
     */
    @Transactional
    public int cerrarLasQueNoExigenIngles() {
        var ahora = LocalDateTime.now();
        var fuera = vacanteRepository.findByActivoTrue().stream()
                .filter(v -> !com.novacrm.scraper.fuente.FiltroBilingue.esDeTrabajoEnIngles(v))
                .toList();
        fuera.forEach(v -> v.cerrar(MotivoCierre.FUERA_DE_PERFIL, ahora));
        vacanteRepository.saveAll(fuera);
        log.info("Depuracion bilingue: {} ofertas cerradas por no exigir ingles", fuera.size());
        return fuera.size();
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
    /** Visible para la prueba que comprueba en qué pool corre esto. */
    List<OfertaCruda> consultarFuentes(List<FuenteDeVacantes> activas,
                                       Criterios criterios,
                                       List<String> errores) {
        List<OfertaCruda> encontradas = java.util.Collections.synchronizedList(new ArrayList<>());
        List<String> erroresSync = java.util.Collections.synchronizedList(errores);

        // Pool propio, no `parallelStream()`.
        //
        // `parallelStream()` corre en el `ForkJoinPool.commonPool()` de la JVM,
        // que es de toda la aplicacion y esta dimensionado para trabajo de CPU:
        // tantos hilos como nucleos menos uno. Aqui el trabajo no es de CPU
        // sino espera de red —cada consulta se pasa hasta 15 s parada—, asi que
        // cuatro portales lentos bastaban para dejar el pool comun sin hilos
        // libres. Lo que se rompia entonces no era el scraping: era cualquier
        // otra cosa de la aplicacion que usara un stream paralelo, que se
        // quedaba esperando detras de una peticion a Computrabajo.
        var ejecutor = java.util.concurrent.Executors.newFixedThreadPool(
                Math.min(Math.max(activas.size(), 1), MAXIMO_HILOS), hiloDeScraping());
        try {
            var tareas = activas.stream()
                    .map(fuente -> (java.util.concurrent.Callable<Void>) () -> {
                        consultarUna(fuente, criterios, encontradas, erroresSync);
                        return null;
                    })
                    .toList();

            // Con tope: una fuente que no cierra la conexion mantenia la corrida
            // abierta indefinidamente, y la diaria se solapaba con la siguiente.
            var futuros = ejecutor.invokeAll(tareas,
                    TOPE_DE_LA_CORRIDA.toSeconds(), java.util.concurrent.TimeUnit.SECONDS);

            for (int i = 0; i < futuros.size(); i++) {
                String nombre = activas.get(i).nombre();
                try {
                    futuros.get(i).get();
                } catch (java.util.concurrent.CancellationException e) {
                    // Cortada por el tope. Tiene que constar como error: una
                    // fuente que no termino no es una fuente sin novedades.
                    erroresSync.add(nombre + ": no termino en "
                            + TOPE_DE_LA_CORRIDA.toMinutes() + " min, cancelada");
                    log.warn("[{}] cancelada por el tope de la corrida", nombre);
                } catch (java.util.concurrent.ExecutionException e) {
                    var causa = e.getCause() == null ? e : e.getCause();
                    erroresSync.add(nombre + ": " + causa.getMessage());
                    log.error("[{}] fallo la consulta: {}", nombre, causa.getMessage());
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            erroresSync.add("actualizacion interrumpida antes de terminar");
        } finally {
            // `shutdownNow` y no `shutdown`: si se llego aqui por el tope, las
            // tareas canceladas siguen bloqueadas en la red y hay que
            // interrumpirlas, no esperarlas.
            ejecutor.shutdownNow();
        }

        // Guard de hambruna silenciosa: una fuente que responde bien pero con
        // cero ofertas en todas sus consultas suele tener los selectores
        // caidos (asi murio Elempleo en BE-16, sin que nadie se enterara).
        var encontradasList = new ArrayList<>(encontradas);
        var porFuente = encontradasList.stream()
                .collect(Collectors.groupingBy(o -> o.vacante().getFuente(), Collectors.counting()));
        for (var fuente : activas) {
            long obtenidas = porFuente.getOrDefault(fuente.nombre(), 0L);
            boolean conError = erroresSync.stream().anyMatch(e -> e.startsWith(fuente.nombre() + ":"));
            if (obtenidas == 0 && !conError) {
                log.warn("[{}] cero ofertas en todas sus consultas: selectores caidos o sin resultados",
                        fuente.nombre());
            }
        }
        if (encontradasList.isEmpty() && errores.isEmpty()) {
            errores.add("todas las fuentes devolvieron cero ofertas: revisar selectores o busquedas");
        }
        return encontradasList;
    }

    /** Todas las consultas de una fuente, en su propio hilo. */
    private void consultarUna(FuenteDeVacantes fuente, Criterios criterios,
                              List<OfertaCruda> encontradas, List<String> errores) {
        var consultas = consultasPara(fuente, criterios);
        log.info("[{}] {} consulta(s), segmento {}",
                fuente.nombre(), consultas.size(), fuente.segmento());

        for (var consulta : consultas) {
            if (Thread.currentThread().isInterrupted()) {
                // Cancelada por el tope de la corrida. Sin esta comprobacion la
                // tarea seguia pidiendo paginas despues de que su `Future` ya
                // constara como cancelado.
                log.warn("[{}] interrumpida, se dejan {} consulta(s) sin hacer",
                        fuente.nombre(), consultas.size() - consultas.indexOf(consulta));
                return;
            }
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
                errores.add(fuente.nombre() + ": " + e.getMessage());
                log.error("[{}] error con '{}': {}",
                        fuente.nombre(), consulta.termino(), e.getMessage());
            }
        }
    }

    /** Hilos con nombre: en un volcado se distingue quién esperaba a quién. */
    private static java.util.concurrent.ThreadFactory hiloDeScraping() {
        var contador = new java.util.concurrent.atomic.AtomicInteger(1);
        return tarea -> {
            var hilo = new Thread(tarea, "scraping-" + contador.getAndIncrement());
            // Demonio: un portal colgado no puede impedir que el proceso pare.
            hilo.setDaemon(true);
            return hilo;
        };
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
                                                     List<String> errores,
                                                     java.util.Map<String, Integer> porPortal,
                                                     int descartadasPorIdioma) {
        var ejecucion = new ScrapingEjecucion();
        ejecucion.setInicio(inicio);
        ejecucion.setOrigen(origen);
        ejecucion.setPortales(activas.stream()
                .map(FuenteDeVacantes::nombre)
                .collect(Collectors.joining(",")));
        ejecucion.setOfertasPorPortal(porPortal.entrySet().stream()
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining(";")));
        ejecucion.setVacantesNuevas(nuevas);
        ejecucion.setVacantesCerradas(cerradas);
        ejecucion.setDescartadasPorIdioma(descartadasPorIdioma);
        ejecucion.setFin(LocalDateTime.now());
        if (!errores.isEmpty()) {
            // Una corrida en la que fallaron las fuentes tiene que verse como
            // fallida en el panel, no como una tranquila sin novedades.
            ejecucion.setError(String.join("; ", errores));
        }
        ejecucionRepository.save(ejecucion);

        log.info("Actualizacion de vacantes: {} nuevas, {} cerradas, "
                        + "{} descartadas por no exigir ingles, {} error(es)",
                nuevas, cerradas, descartadasPorIdioma, errores.size());
        return new ResultadoActualizacion(nuevas, cerradas,
                vacanteRepository.contarVigentes(LocalDateTime.now()),
                ejecucion.getInicio(), ejecucion.getFin());
    }

    /**
     * Las ultimas corridas, con su detalle, para el registro del panel.
     *
     * <p>Es lo que responde «desde cuando no entra nada de este portal». Un
     * portal cuyos selectores se caen no falla —responde 200 y devuelve cero—,
     * asi que sin ver la serie de corridas el sintoma es indistinguible de una
     * semana floja de ofertas.
     */
    @Transactional(readOnly = true)
    public List<EjecucionDeScraping> historial() {
        return ejecucionRepository.findTop20ByOrderByInicioDesc().stream()
                .map(ScrapingService::aDto)
                .toList();
    }

    private static EjecucionDeScraping aDto(ScrapingEjecucion e) {
        var portales = e.getPortales() == null || e.getPortales().isBlank()
                ? List.<String>of()
                : Arrays.stream(e.getPortales().split(",")).map(String::trim).filter(s -> !s.isBlank()).toList();
        // Los errores se guardan unidos por «; » porque la columna es una sola;
        // se parten aqui para que el panel pueda listarlos uno por renglon.
        var errores = e.getError() == null || e.getError().isBlank()
                ? List.<String>of()
                : Arrays.stream(e.getError().split(";\\s*")).map(String::trim).filter(s -> !s.isBlank()).toList();
        Long duracion = e.getFin() == null ? null
                : java.time.Duration.between(e.getInicio(), e.getFin()).toSeconds();
        return new EjecucionDeScraping(
                e.getId().toString(), e.getInicio(), e.getFin(), e.getOrigen().name(),
                portales, e.getVacantesNuevas(), e.getVacantesCerradas(), errores,
                e.getFin() == null, duracion, conteoPorPortal(e.getOfertasPorPortal()),
                e.getDescartadasPorIdioma());
    }

    /**
     * Lee los pares {@code PORTAL=n} de la corrida.
     *
     * <p>Lista vacía cuando la columna es nula: son las corridas anteriores a
     * que existiera, y no se puede inventar un cero para ellas. Un par
     * ilegible se salta en vez de tumbar el registro entero —el historial es
     * para diagnosticar, y romperlo por una fila mal escrita deja sin ver
     * también las buenas—.
     */
    static List<EjecucionDeScraping.PortalConOfertas> conteoPorPortal(String guardado) {
        if (guardado == null || guardado.isBlank()) {
            return List.of();
        }
        var conteos = new ArrayList<EjecucionDeScraping.PortalConOfertas>();
        for (String par : guardado.split(";")) {
            int igual = par.lastIndexOf('=');
            if (igual <= 0) {
                continue;
            }
            try {
                conteos.add(new EjecucionDeScraping.PortalConOfertas(
                        par.substring(0, igual).trim(),
                        Integer.parseInt(par.substring(igual + 1).trim())));
            } catch (NumberFormatException ignorado) {
                // Par mal escrito: se omite ese portal, no la corrida.
            }
        }
        return List.copyOf(conteos);
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
