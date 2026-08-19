package com.novacrm.matching;

import com.novacrm.config.MatchingConfig;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.matching.dto.MatchResponse;
import com.novacrm.notificacion.NotificacionService;
import com.novacrm.scraper.fuente.AreaMetropolitana;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class MatchingService {

    private final MatchRepository matchRepository;
    private final EstudianteRepository estudianteRepository;
    private final VacanteRepository vacanteRepository;
    private final SkillSynonyms skillSynonyms;
    private final MatchingConfig config;
    private final NotificacionService notificacionService;
    private final com.novacrm.postulacion.PostulacionService postulacionService;
    private final com.novacrm.postulacion.PostulacionRepository postulacionRepository;

    /**
     * De donde sale el umbral de verdad. El YAML solo pone el valor de partida:
     * quien lo cambia es el equipo desde la pantalla de configuracion, y hasta
     * ahora ese numero no llegaba aqui.
     */
    private final com.novacrm.configuracion.ConfiguracionService configuracionService;

    /**
     * Quien esta trabajando ahora mismo, segun el registro que lo dice.
     *
     * <p>Hasta ahora eso se preguntaba solo al enum {@code EstadoEmpleabilidad}
     * de la ficha, que unicamente escriben la importacion antigua y la edicion
     * manual. A quien se coloca por el CRM nadie se lo cambia, asi que seguia
     * contando como buscando empleo.
     */
    private final com.novacrm.colocacion.ColocacionRepository colocacionRepository;

    private static final List<String> NIVELES_INGLES = List.of("A1", "A2", "B1", "B2", "C1", "C2");

    public MatchingService(MatchRepository matchRepository,
                           EstudianteRepository estudianteRepository,
                           VacanteRepository vacanteRepository,
                           SkillSynonyms skillSynonyms,
                           MatchingConfig config,
                           NotificacionService notificacionService,
                           com.novacrm.postulacion.PostulacionService postulacionService,
                           com.novacrm.postulacion.PostulacionRepository postulacionRepository,
                           com.novacrm.configuracion.ConfiguracionService configuracionService,
                           com.novacrm.colocacion.ColocacionRepository colocacionRepository) {
        this.colocacionRepository = colocacionRepository;
        this.matchRepository = matchRepository;
        this.estudianteRepository = estudianteRepository;
        this.vacanteRepository = vacanteRepository;
        this.skillSynonyms = skillSynonyms;
        this.config = config;
        this.notificacionService = notificacionService;
        this.postulacionService = postulacionService;
        this.postulacionRepository = postulacionRepository;
        this.configuracionService = configuracionService;
    }

    /**
     * Vacantes recomendadas al estudiante.
     *
     * <p>Solo las vivas: sin filtrar vigencia, la lista acumulaba
     * indefinidamente vacantes ya cerradas y el estudiante se postulaba a
     * plazas que no existen. Y sin las descartadas, que se conservan para
     * calibrar pero no se le vuelven a mostrar a quien ya dijo que no.
     */
    public Page<MatchResponse> obtenerMatches(UUID estudianteId, org.springframework.data.domain.Pageable pageable) {
        return matchRepository.findVigentesDeEstudiante(
                        estudianteId, java.time.LocalDateTime.now(), pageable)
                .map(this::toResponse);
    }

    /**
     * Marca el match como descartado sin borrarlo.
     *
     * <p>Borraba la fila. El boton "No, gracias" de WhatsApp es la etiqueta
     * negativa mas limpia que recibe el sistema —la persona vio la vacante y
     * dijo que no— y se destruia al llegar; sin ella no hay forma de saber si
     * un puntaje alto predice algo. Ademas el par sigue registrado, asi que la
     * siguiente corrida no vuelve a proponerlo.
     */
    @Transactional
    public void descartarMatch(UUID matchId, String autor) {
        var match = matchRepository.findById(matchId)
                .orElseThrow(() -> new com.novacrm.exception.ResourceNotFoundException("Match no encontrado: " + matchId));
        if (match.isDescartado()) {
            return;
        }
        match.descartar(autor);
        matchRepository.save(match);
    }

    private MatchResponse toResponse(Match m) {
        var v = m.getVacante();
        return new MatchResponse(
                m.getId(),
                m.getEstudiante().getId(),
                v.getId(),
                v.getTitulo(),
                v.getEmpresa() != null ? v.getEmpresa().getNombre() : null,
                v.getUbicacion(),
                v.getUrlOrigen(),
                v.getUrlAplicar(),
                v.getRangoSalarial(),
                v.getModalidadTrabajo(),
                v.getRequisitos(),
                v.getDescripcion(),
                v.getCiudad(),
                v.getTipoContrato(),
                v.getJornada(),
                v.getNivelInglesRequerido(),
                v.getAniosExperienciaRequeridos(),
                v.getFechaExpiracion(),
                v.getFuente(),
                m.getPuntaje(),
                m.isNotificado(),
                m.isPostulado(),
                m.getCreatedAt(),
                razonesDe(m),
                m.getCobertura());
    }

    /**
     * Traduce el desglose guardado a algo que se le pueda ensenar a la persona.
     *
     * <p>Solo los criterios que se pudieron evaluar; los que no tenian datos no
     * entraron en el puntaje y mostrarlos como cero mentiria. Ordenados por
     * peso: lo que mas movio el resultado se lee primero.
     */
    private List<MatchResponse.RazonDeMatch> razonesDe(Match m) {
        var razones = new ArrayList<MatchResponse.RazonDeMatch>();
        agregarRazon(razones, "Afinidad de perfil", m.getPuntajeAfinidad(), config.getPesoAfinidad());
        agregarRazon(razones, "Competencias", m.getPuntajeHabilidades(), config.getPesoHabilidades());
        agregarRazon(razones, "Inglés", m.getPuntajeIngles(), config.getPesoIngles());
        agregarRazon(razones, "Ubicación", m.getPuntajeUbicacion(), config.getPesoUbicacion());
        agregarRazon(razones, "Experiencia", m.getPuntajeExperiencia(), config.getPesoExperiencia());
        razones.sort(java.util.Comparator.comparingInt(MatchResponse.RazonDeMatch::peso).reversed());
        return razones;
    }

    private static void agregarRazon(List<MatchResponse.RazonDeMatch> razones,
                                     String criterio, BigDecimal ratio, int peso) {
        if (ratio != null) {
            razones.add(new MatchResponse.RazonDeMatch(criterio, ratio, peso));
        }
    }

    public long contarMatchesPendientes(UUID estudianteId) {
        return matchRepository.countByEstudianteIdAndNotificadoFalse(estudianteId);
    }

    /**
     * Marca el match y abre la postulacion correspondiente.
     *
     * <p>Antes solo ponia un booleano, y ahi se acababa el rastro: no quedaba
     * ni la fecha ni forma de anotar despues que hubo entrevista. Ahora esto es
     * la puerta de entrada al seguimiento —una sola decision en un solo sitio—,
     * de modo que postularse desde las vacantes recomendadas y anotar una
     * postulacion a mano acaban en la misma tabla.
     */
    @Transactional
    public void marcarPostulado(UUID matchId, String autor, boolean loHaceElEstudiante) {
        var match = matchRepository.findById(matchId)
                .orElseThrow(() -> new com.novacrm.exception.ResourceNotFoundException("Match no encontrado: " + matchId));
        boolean yaEstaba = match.isPostulado();
        match.setPostulado(true);
        matchRepository.save(match);

        if (yaEstaba) {
            return;
        }
        var vacante = match.getVacante();
        var estudianteId = match.getEstudiante().getId();
        // Si ya hay postulacion a esa vacante no se duplica: pudo registrarla
        // el coordinador a mano antes de que el estudiante pulsara el boton.
        if (postulacionRepository.findByEstudianteIdAndVacanteId(estudianteId, vacante.getId()).isPresent()) {
            return;
        }
        try {
            String empresaNombre = vacante.getEmpresa() != null && vacante.getEmpresa().getNombre() != null && !vacante.getEmpresa().getNombre().isBlank()
                    ? vacante.getEmpresa().getNombre()
                    : "Sin registrar";
            String cargo = vacante.getTitulo() != null && !vacante.getTitulo().isBlank()
                    ? vacante.getTitulo()
                    : "Vacante";
            String rawUrl = vacante.getUrlAplicar() != null && !vacante.getUrlAplicar().isBlank()
                    ? vacante.getUrlAplicar()
                    : vacante.getUrlOrigen();
            String urlOferta = sanitizarUrl(rawUrl);

            postulacionService.crear(estudianteId,
                    new com.novacrm.postulacion.dto.PostulacionDtos.CrearPostulacion(
                            estudianteId,
                            vacante.getId(),
                            empresaNombre,
                            cargo,
                            vacante.getFuente(),
                            java.time.LocalDate.now(),
                            com.novacrm.postulacion.EstadoPostulacion.ENVIADA,
                            urlOferta,
                            null,
                            // Postularse desde un match no agenda nada: la cita
                            // la pone la empresa cuando contesta.
                            null, null, null, null, null, null, null),
                    autor, loHaceElEstudiante);
        } catch (com.novacrm.exception.BusinessException e) {
            // Carrera entre dos clics sobre el mismo match: el perdedor llega a
            // crear() con el duplicado ya guardado. El match queda marcado y la
            // postulacion la creo el ganador, asi que este intento es no-op.
            if (postulacionRepository.findByEstudianteIdAndVacanteId(estudianteId, vacante.getId()).isEmpty()) {
                throw e;
            }
        }
    }

    /**
     * Revierte una postulación realizada por error o desistida por el estudiante.
     * Marca el match como no postulado y retira la postulación en estado ENVIADA.
     */
    @Transactional
    public void cancelarPostulacion(UUID matchId, String autor) {
        var match = matchRepository.findById(matchId)
                .orElseThrow(() -> new com.novacrm.exception.ResourceNotFoundException("Match no encontrado: " + matchId));
        if (!match.isPostulado()) {
            return;
        }
        match.setPostulado(false);
        matchRepository.save(match);

        var estudianteId = match.getEstudiante().getId();
        var vacanteId = match.getVacante().getId();
        postulacionRepository.findByEstudianteIdAndVacanteId(estudianteId, vacanteId)
                .ifPresent(p -> {
                    if (p.getEstado() == com.novacrm.postulacion.EstadoPostulacion.ENVIADA
                            && p.getFechaHoraEntrevista() == null) {
                        postulacionRepository.delete(p);
                    } else {
                        p.moverA(com.novacrm.postulacion.EstadoPostulacion.RECHAZADO, java.time.LocalDate.now());
                        postulacionRepository.save(p);
                    }
                });
    }

    private static String sanitizarUrl(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String trimmed = url.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed;
        }
        if (trimmed.startsWith("www.") || trimmed.contains(".")) {
            return "https://" + trimmed;
        }
        return null;
    }

    /** Una vacante del pool con sus tokens ya resueltos, para no repetirlo. */
    private record VacanteTokenizada(Vacante vacante, Set<String> terminos, Set<String> competencias) {}

    @Transactional
    public int ejecutarMatching() {
        // Primero se carga el pool entero y despues se puntua. Hace falta en
        // ese orden porque el peso de cada token —cuanto informa coincidir en
        // el— se estima sobre el conjunto de vacantes de la corrida, y eso no
        // se puede saber pagina a pagina. Son como mucho 500 vacantes con sus
        // tokens: cabe de sobra en memoria.
        var pool = cargarPool();
        if (pool.isEmpty()) {
            return 0;
        }
        // `activo` solo dice que la ficha no esta en la papelera: incluia a
        // quien se retiro del programa y a quien ya esta empleado. Mandarles
        // recomendaciones —y avisos de WhatsApp— es ruido para ellos y trabajo
        // perdido para el equipo.
        // Quien tiene una colocacion vigente ya no busca, lo diga o no el enum
        // de su ficha. En una consulta para toda la corrida, no una por persona.
        var colocados = java.util.Set.copyOf(colocacionRepository.idsColocados());
        var estudiantes = estudianteRepository.findAllByActivoTrue().stream()
                .filter(e -> buscaEmpleo(e, colocados))
                .toList();
        if (estudiantes.isEmpty()) {
            return 0;
        }
        // El de la pantalla de configuracion si alguien lo fijo; si no, el de
        // matching-config.yml. Antes se leia siempre el del YAML mientras la
        // pantalla ofrecia editarlo: subirlo a 80 no cambiaba nada y nada lo
        // decia.
        int umbral = configuracionService.umbralDeMatch();
        String versionDeConfig = versionDeConfig(umbral);

        var pesos = PesosPorRareza.de(pool.stream().map(VacanteTokenizada::terminos).toList());

        // Precalculado una sola vez por estudiante, no en cada par
        // estudiante×vacante (BE-05): tokens de perfil y de competencias solo
        // dependen del estudiante, no de la vacante que se este evaluando.
        //
        // Las competencias salen del campo de texto de la ficha —que llenan el
        // equipo y la extraccion de hojas de vida— y no de `estudiante_habilidad`:
        // esa tabla no la escribe nadie en todo el backend, asi que el criterio
        // de habilidades era una constante para el 100% de los pares.
        Map<UUID, Set<String>> terminosPerfilPorEstudiante = new HashMap<>();
        Map<UUID, Set<String>> competenciasPorEstudiante = new HashMap<>();
        for (Estudiante e : estudiantes) {
            terminosPerfilPorEstudiante.put(e.getId(), skillSynonyms.tokenize(
                    e.getCargoObjetivo(), e.getSectorObjetivo(), e.getSectorExperiencia(),
                    e.getUltimoCargo(), e.getPerfilProfesional(), e.getAreaFormacion(),
                    e.getNivelEducativo()));
            competenciasPorEstudiante.put(e.getId(),
                    skillSynonyms.tokenize(e.getCompetencias()));
        }

        // Pares ya emparejados, en una sola consulta (BE-05): antes era un
        // existsBy... por cada par estudiante×vacante.
        var vacanteIds = pool.stream().map(p -> p.vacante().getId()).toList();
        Set<String> paresExistentes = matchRepository.findByVacanteIdIn(vacanteIds).stream()
                .map(m -> m.getEstudiante().getId() + "|" + m.getVacante().getId())
                .collect(Collectors.toSet());

        List<Match> matchesNuevos = new ArrayList<>();
        for (VacanteTokenizada candidata : pool) {
            var v = candidata.vacante();
            for (Estudiante e : estudiantes) {
                if (paresExistentes.contains(e.getId() + "|" + v.getId())) continue;
                // Antes de puntuar: recomendarle empleo remoto en ingles a
                // quien no tiene computador, o una plaza en Berlin a quien no
                // busca migrar, no es una recomendacion debil sino una
                // imposible.
                if (!ElegibilidadPorSegmento.esElegible(e, v)) continue;
                var desglose = calcularPuntaje(e, v,
                        terminosPerfilPorEstudiante.get(e.getId()), candidata.terminos(),
                        competenciasPorEstudiante.get(e.getId()), candidata.competencias(),
                        pesos);
                if (!superaElCorte(desglose, umbral)) continue;

                var match = new Match();
                match.setEstudiante(e);
                match.setVacante(v);
                match.aplicarDesglose(desglose, versionDeConfig);
                try {
                    matchRepository.save(match);
                } catch (org.springframework.dao.DataIntegrityViolationException ex) {
                    // Dos ejecuciones del scheduler en paralelo: el otro hilo
                    // ya creo el par y el unique lo rechaza. Es un no-op, no un
                    // fallo.
                    continue;
                }
                matchesNuevos.add(match);
            }
        }

        if (!matchesNuevos.isEmpty()) {
            notificacionService.generarNotificacionesMatch(matchesNuevos);
        }

        return matchesNuevos.size();
    }

    /**
     * Vacantes candidatas de esta corrida, ya tokenizadas.
     *
     * <p>Solo vigentes: recomendar una vacante vencida hace que el estudiante
     * se postule a una plaza que ya no existe. Y solo revisadas: una oferta que
     * sugirio un participante se ve, pero no se le recomienda a los otros 106
     * hasta que el equipo la valide.
     */
    private List<VacanteTokenizada> cargarPool() {
        int maxVacantes = Math.max(config.getMaxVacantesPorEjecucion(), 1000);
        List<VacanteTokenizada> pool = new ArrayList<>();
        int page = 0;

        while (pool.size() < maxVacantes) {
            var pagina = vacanteRepository.findVigentes(
                    java.time.LocalDateTime.now(), PageRequest.of(page, 200));
            if (pagina.getContent().isEmpty()) break;
            for (Vacante v : pagina.getContent()) {
                if (!v.isRevisada()) continue;
                if (pool.size() >= maxVacantes) break;
                pool.add(new VacanteTokenizada(v,
                        skillSynonyms.tokenize(v.getTitulo(), v.getDescripcion(), v.getRequisitos()),
                        skillSynonyms.tokenize(v.getDescripcion(), v.getRequisitos())));
            }
            if (!pagina.hasNext()) break;
            page++;
        }
        return pool;
    }

    /**
     * Si tiene sentido recomendarle vacantes.
     *
     * <p>Quien se retiro del programa ya no participa, y a quien esta empleado
     * recomendarle plazas no le sirve: el seguimiento de esa persona es la
     * permanencia en el puesto, no una nueva busqueda.
     *
     * <p>«Empleado» son dos cosas y hasta ahora se miraba solo una. El enum
     * {@code EstadoEmpleabilidad} viene de la hoja antigua y lo escriben la
     * importacion y la edicion manual; la colocacion es el registro real —con
     * empresa, fecha y salario— y es por donde entra todo el que se coloca por
     * el CRM. Mirando solo el enum, a quien acababa de encontrar trabajo con el
     * programa se le seguian mandando vacantes recomendadas, con su aviso de
     * WhatsApp y sus botones de si/no, mientras estaba trabajando.
     *
     * @param colocados ids con colocacion vigente, resueltos de una vez para
     *                  toda la corrida
     */
    static boolean buscaEmpleo(Estudiante e, java.util.Set<UUID> colocados) {
        return e.getEstadoAcademico() != com.novacrm.estudiante.EstadoAcademico.RETIRADO
                && e.getEstadoEmpleabilidad() != com.novacrm.estudiante.EstadoEmpleabilidad.EMPLEADO
                && !colocados.contains(e.getId());
    }

    /**
     * Un par llega a ser match si supera el umbral y ademas se apoya en
     * suficiente evidencia.
     *
     * <p>Las dos condiciones hacen falta: sin la de cobertura, un par evaluado
     * por un unico criterio con suerte volveria a colarse por encima del
     * umbral, que es exactamente lo que hacia que toda vacante emparejara con
     * todo participante.
     */
    boolean superaElCorte(DesglosePuntaje desglose, int umbral) {
        return desglose.puntaje().compareTo(BigDecimal.valueOf(umbral)) >= 0
                && desglose.cobertura().doubleValue() >= config.getCoberturaMinima();
    }

    /**
     * Huella de los pesos vigentes, para saber con que se calculo un puntaje.
     *
     * <p>El umbral llega como parametro y no se relee de la configuracion: si
     * alguien lo cambia a mitad de una corrida, la huella tiene que decir con
     * cual se puntuo de verdad, no con cual esta guardado ahora.
     */
    private String versionDeConfig(int umbral) {
        return "a%d-h%d-i%d-u%d-e%d/umbral%d/cob%s".formatted(
                config.getPesoAfinidad(), config.getPesoHabilidades(), config.getPesoIngles(),
                config.getPesoUbicacion(), config.getPesoExperiencia(),
                umbral, config.getCoberturaMinima());
    }

    /**
     * Evalua un par estudiante×vacante criterio por criterio.
     *
     * <p>Cada criterio devuelve un ratio de 0 a 1, o {@code null} si no hay con
     * que juzgarlo. Los que no se pueden evaluar quedan fuera del reparto en
     * vez de puntuar: antes un dato ausente valia como dato bueno —una vacante
     * sin nivel de ingles ni experiencia declarada se llevaba enteros esos dos
     * criterios— y el resultado era que toda vacante superaba el umbral contra
     * todo participante.
     */
    DesglosePuntaje calcularPuntaje(Estudiante e, Vacante v,
            Set<String> terminosEstudiante, Set<String> terminosVacante,
            Set<String> competenciasEstudiante, Set<String> competenciasVacante,
            PesosPorRareza pesos) {

        Double afinidad = ratioAfinidad(e, v, terminosEstudiante, terminosVacante, pesos);
        Double habilidades = pesos.parecido(competenciasEstudiante, competenciasVacante);
        Double ingles = ratioIngles(e, v, terminosVacante);
        Double ubicacion = ratioUbicacion(e, v);
        Double experiencia = ratioExperiencia(e, v);

        var balanza = new DesglosePuntaje.Balanza();
        balanza.agregar(config.getPesoAfinidad(), afinidad);
        balanza.agregar(config.getPesoHabilidades(), habilidades);
        balanza.agregar(config.getPesoIngles(), ingles);
        balanza.agregar(config.getPesoUbicacion(), ubicacion);
        balanza.agregar(config.getPesoExperiencia(), experiencia);

        return new DesglosePuntaje(afinidad, habilidades, ingles, ubicacion, experiencia,
                balanza.puntaje(), balanza.cobertura(config.getPesoTotal()));
    }

    /**
     * Afinidad de perfil: solapamiento de terminos normalizados por sinonimos,
     * con un empujon si el sector del estudiante coincide con el de la empresa.
     */
    private Double ratioAfinidad(Estudiante e, Vacante v,
                                 Set<String> terminosEstudiante, Set<String> terminosVacante,
                                 PesosPorRareza pesos) {
        Double solape = pesos.parecido(terminosEstudiante, terminosVacante);
        if (solape == null) {
            return null;
        }
        return hayCoincidenciaSector(e, v) ? Math.min(solape + 0.15, 1.0) : solape;
    }

    /**
     * Ajuste de ingles entre estudiante y vacante.
     *
     * <p>Encierra la decision que mas afecta al resultado: que nivel del
     * estudiante se compara. Se usa el medido en las pruebas y no el declarado
     * en el formulario de admision, que en la primera cohorte estaba inflado en
     * 89 de 102 casos; y si la vacante es de voz se compara contra el oral, que
     * es donde esta la brecha real de esta poblacion.
     *
     * <p>Nulo cuando la vacante no declara nivel —no se puede juzgar algo que
     * el anuncio no pide— y tambien cuando del estudiante no hay ni nivel
     * declarado ni medido. Que la vacante no exija ingles ya no reparte puntos
     * a todo el mundo: simplemente ese criterio no aplica a ese par.
     */
    Double ratioIngles(Estudiante e, Vacante v, Set<String> terminosVacante) {
        int requerido = ordenNivelRequerido(v.getNivelInglesRequerido());
        if (requerido == 0) {
            return null;
        }
        var perfil = PerfilIngles.de(e);
        var nivel = VacanteDeVoz.esDeVoz(terminosVacante) ? perfil.paraVacanteDeVoz() : perfil.efectivo();
        if (nivel.isEmpty()) {
            return null;
        }
        return Math.min((double) nivel.get().getOrden() / requerido, 1.0);
    }

    /**
     * Cercania geografica.
     *
     * <p>Se prefiere {@code ciudad} —limpia, y ahora poblada por el
     * enriquecedor— sobre el texto libre de {@code ubicacion}. Una vacante
     * remota vale para cualquier ciudad: el participante no tiene que
     * desplazarse.
     */
    private Double ratioUbicacion(Estudiante e, Vacante v) {
        if (esRemota(v)) {
            return 1.0;
        }
        String ciudadEstudiante = normalizar(e.getCiudad());
        String lugarVacante = normalizar(v.getCiudad() != null ? v.getCiudad() : v.getUbicacion());
        if (ciudadEstudiante.isBlank() || lugarVacante.isBlank()) {
            return null;
        }
        if (lugarVacante.contains(ciudadEstudiante) || ciudadEstudiante.contains(lugarVacante)) {
            return 1.0;
        }
        // Coincidencia dentro del Área Metropolitana de Barranquilla / Atlántico
        if (AreaMetropolitana.esCercana(ciudadEstudiante, null)
                && AreaMetropolitana.esCercana(v.getCiudad(), v.getUbicacion())) {
            return 1.0;
        }
        return Boolean.TRUE.equals(e.getDisponibilidadMovilidad()) ? 0.6 : 0.0;
    }

    /**
     * Experiencia.
     *
     * <p>Que la vacante pida cero anios es un dato —y bueno para esta
     * poblacion—, asi que puntua completo. Que no diga nada, en cambio, no se
     * puede juzgar; igual que no poder saber los anios del estudiante.
     */
    private Double ratioExperiencia(Estudiante e, Vacante v) {
        Integer requeridos = v.getAniosExperienciaRequeridos();
        if (requeridos == null) {
            return null;
        }
        if (requeridos <= 0) {
            return 1.0;
        }
        if (e.getAniosExperiencia() == null) {
            return null;
        }
        return Math.min((double) e.getAniosExperiencia() / requeridos, 1.0);
    }

    private static boolean esRemota(Vacante v) {
        String modalidad = normalizar(v.getModalidadTrabajo());
        return modalidad.contains("remoto") || modalidad.contains("remote");
    }

    private static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        return java.text.Normalizer.normalize(texto.trim(), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .toLowerCase(java.util.Locale.ROOT);
    }

    private boolean hayCoincidenciaSector(Estudiante e, Vacante v) {
        if (v.getEmpresa() == null || v.getEmpresa().getSector() == null) return false;
        String sectorVacante = v.getEmpresa().getSector().trim().toLowerCase();
        if (sectorVacante.isBlank()) return false;

        if (e.getSectorObjetivo() != null
                && e.getSectorObjetivo().toLowerCase().contains(sectorVacante)) {
            return true;
        }
        if (e.getSectorExperiencia() != null
                && e.getSectorExperiencia().toLowerCase().contains(sectorVacante)) {
            return true;
        }
        return false;
    }

    private int ordenNivelRequerido(String requerido) {
        if (requerido == null) return 0;
        String upper = requerido.toUpperCase();
        for (int i = NIVELES_INGLES.size() - 1; i >= 0; i--) {
            if (upper.contains(NIVELES_INGLES.get(i))) return i + 1;
        }
        return 0;
    }
}
