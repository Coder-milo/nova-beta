package com.novacrm.dashboard;

import com.novacrm.dashboard.dto.AlertaResponse;
import com.novacrm.dashboard.dto.DashboardChartsResponse;
import com.novacrm.dashboard.dto.DashboardSummaryResponse;
import com.novacrm.dashboard.dto.PuntoDato;
import com.novacrm.estudiante.EstadoAcademico;
import com.novacrm.estudiante.EstadoEmpleabilidad;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaEstado;
import com.novacrm.programa.ProgramaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    private static final int DIAS_ALERTA_FIN_PROGRAMA = 45;

    private final EstudianteRepository estudianteRepository;
    private final ProgramaRepository programaRepository;
    private final com.novacrm.seguimiento.SeguimientoRepository seguimientoRepository;
    private final com.novacrm.vacante.VacanteRepository vacanteRepository;
    private final com.novacrm.scraper.ScrapingEjecucionRepository scrapingEjecucionRepository;
    private final com.novacrm.chat.ReporteDeChatRepository reporteDeChatRepository;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    public DashboardService(EstudianteRepository estudianteRepository,
                            ProgramaRepository programaRepository,
                            com.novacrm.seguimiento.SeguimientoRepository seguimientoRepository,
                            com.novacrm.vacante.VacanteRepository vacanteRepository,
                            com.novacrm.scraper.ScrapingEjecucionRepository scrapingEjecucionRepository,
                            com.novacrm.chat.ReporteDeChatRepository reporteDeChatRepository) {
        this.estudianteRepository = estudianteRepository;
        this.programaRepository = programaRepository;
        this.seguimientoRepository = seguimientoRepository;
        this.vacanteRepository = vacanteRepository;
        this.scrapingEjecucionRepository = scrapingEjecucionRepository;
        this.reporteDeChatRepository = reporteDeChatRepository;
    }

    public DashboardSummaryResponse resumen() {
        ZoneId zona = ZoneId.systemDefault();
        LocalDate hoy = LocalDate.now(zona);
        Instant inicioMesActual = hoy.withDayOfMonth(1).atStartOfDay(zona).toInstant();
        Instant inicioMesAnterior = hoy.withDayOfMonth(1).minusMonths(1).atStartOfDay(zona).toInstant();

        long nuevosEsteMes = estudianteRepository.countByCreatedAtGreaterThanEqual(inicioMesActual);
        long nuevosMesAnterior = estudianteRepository.countByCreatedAtBetween(inicioMesAnterior, inicioMesActual);

        return new DashboardSummaryResponse(
                estudianteRepository.count(),
                nuevosEsteMes,
                variacionPct(nuevosEsteMes, nuevosMesAnterior),
                estudianteRepository.countByEstadoAcademico(EstadoAcademico.ACTIVO),
                estudianteRepository.countByEstadoAcademico(EstadoAcademico.GRADUADO),
                estudianteRepository.countByEstadoAcademico(EstadoAcademico.RETIRADO),
                estudianteRepository.countByEstadoAcademico(EstadoAcademico.EN_PROCESO),
                programaRepository.countByActivoTrue(),
                contarDocumentosPendientes(),
                contarHvsPorGenerar()
        );
    }

    public DashboardChartsResponse graficos() {
        // Torta: distribución por estado académico.
        List<PuntoDato> distribucionEstado = List.of(
                PuntoDato.de("Activos", estudianteRepository.countByEstadoAcademico(EstadoAcademico.ACTIVO)),
                PuntoDato.de("Graduados", estudianteRepository.countByEstadoAcademico(EstadoAcademico.GRADUADO)),
                PuntoDato.de("Retirados", estudianteRepository.countByEstadoAcademico(EstadoAcademico.RETIRADO)),
                PuntoDato.de("En proceso", estudianteRepository.countByEstadoAcademico(EstadoAcademico.EN_PROCESO))
        );

        // Líneas: ingresos por mes del año actual.
        List<PuntoDato> historicoIngresos = estudianteRepository.contarIngresosPorMesAnioActual().stream()
                .map(p -> PuntoDato.de(p.getMes(), p.getTotal()))
                .toList();

        // Barras horizontales: estudiantes activos por proyecto.
        List<PuntoDato> estudiantesPorProyecto = estudianteRepository.contarActivosPorPrograma().stream()
                .map(p -> PuntoDato.de(p.getNombre(), p.getTotal()))
                .toList();

        // Dona: empleabilidad con porcentaje.
        //
        // Cuenta las colocaciones registradas y no solo el enum de la ficha. El
        // enum lo escriben la importacion antigua y la edicion manual; a quien
        // se coloca por el CRM nadie se lo cambia, asi que la grafica dejaba
        // fuera justamente los resultados que consiguio el programa: la persona
        // registraba su colocacion y aqui seguia apareciendo como «buscando».
        long empleados = estudianteRepository.contarEmpleadosConColocacionOEnum();
        long buscando = estudianteRepository.contarPorEmpleabilidadSinColocacion(EstadoEmpleabilidad.BUSCANDO);
        long sinInfo = estudianteRepository.contarPorEmpleabilidadSinColocacion(EstadoEmpleabilidad.SIN_INFO);
        long totalEmp = empleados + buscando + sinInfo;
        List<PuntoDato> empleabilidad = List.of(
                new PuntoDato("Empleado", empleados, pct(empleados, totalEmp)),
                new PuntoDato("Buscando", buscando, pct(buscando, totalEmp)),
                new PuntoDato("Sin info", sinInfo, pct(sinInfo, totalEmp))
        );

        return new DashboardChartsResponse(
                distribucionEstado, historicoIngresos, estudiantesPorProyecto, empleabilidad);
    }

    public List<AlertaResponse> alertas() {
        List<AlertaResponse> alertas = new ArrayList<>();

        // Reportes del chat sin revisar. Va lo primero y en severidad alta
        // porque es el unico aviso de esta lista que puede ser una persona
        // pidiendo ayuda. Hasta ahora el reporte se guardaba y nadie se
        // enteraba salvo que entrara a mirar la bandeja: una salvaguarda que
        // nadie vigila no es una salvaguarda.
        long reportesAbiertos = reporteDeChatRepository.countByEstado(
                com.novacrm.chat.ReporteDeChat.ABIERTO);
        if (reportesAbiertos > 0) {
            alertas.add(new AlertaResponse(
                    "CHAT_REPORTADO", "ALTA",
                    "Reportes del chat sin revisar",
                    reportesAbiertos + " estudiante(s) reportaron una conversación y esperan respuesta.",
                    null, "/reportes-chat"));
        }

        long conDatosFaltantes = estudianteRepository.contarActivosConDatosFaltantes();
        if (conDatosFaltantes > 0) {
            var primeros = estudianteRepository.buscarActivosConDatosFaltantes(
                    org.springframework.data.domain.PageRequest.of(0, 2)).getContent();
            String referencia = conDatosFaltantes == 1 && !primeros.isEmpty()
                    ? primeros.get(0).getId().toString() : null;
            String ruta = referencia != null
                    ? "/estudiantes/" + referencia
                    : "/estudiantes?incompletos=1";
            alertas.add(new AlertaResponse(
                    "DATOS_FALTANTES", "MEDIA",
                    "Estudiantes con datos incompletos",
                    conDatosFaltantes + " estudiante(s) activo(s) sin celular, correo o documento.",
                    referencia, ruta));
        }

        // Ofertas que registro un participante y nadie ha validado. Mientras
        // esperan no se le recomiendan a nadie, asi que una que se quede sin
        // mirar no es una tarea pendiente: es una oportunidad que se pierde en
        // silencio. Severidad alta porque caduca sola.
        long sinRevisar = vacanteRepository.contarSinRevisar(java.time.LocalDateTime.now());
        if (sinRevisar > 0) {
            alertas.add(new AlertaResponse(
                    "VACANTE_SIN_REVISAR", "ALTA",
                    "Ofertas pendientes de validar",
                    sinRevisar + " oferta(s) registrada(s) por participantes esperan revisión. "
                            + "Hasta validarlas no entran al matching.",
                    null, "/vacantes"));
        }

        // La ultima corrida de scraping, si termino con fuentes caidas. El error
        // se guardaba en `scraping_ejecucion` y no lo leia nadie: sin vacantes
        // nuevas nadie sospecha que el escaneo lleva semanas fallando, porque
        // una corrida rota y una tranquila se ven igual desde fuera.
        scrapingEjecucionRepository.findFirstByFinIsNotNullOrderByInicioDesc()
                .filter(e -> e.getError() != null && !e.getError().isBlank())
                .ifPresent(e -> alertas.add(new AlertaResponse(
                        "SCRAPING_CON_ERRORES", "MEDIA",
                        "El ultimo escaneo de vacantes fallo",
                        "Fuentes con problemas: " + e.getError(),
                        null, "/vacantes")));

        LocalDate hoy = LocalDate.now(ZoneId.systemDefault());
        List<Programa> porFinalizar = programaRepository.findByEstadoAndFechaFinBetween(
                ProgramaEstado.ACTIVO, hoy, hoy.plusDays(DIAS_ALERTA_FIN_PROGRAMA));
        for (Programa p : porFinalizar) {
            long dias = ChronoUnit.DAYS.between(hoy, p.getFechaFin());
            alertas.add(new AlertaResponse(
                    "PROGRAMA_POR_FINALIZAR", "ALTA",
                    "«" + p.getNombre() + "» próximo a finalizar",
                    "Finaliza en " + dias + " día(s) (" + p.getFechaFin() + ").",
                    p.getId().toString(), "/proyectos/" + p.getId()));
        }

        // Compromisos de seguimiento que ya vencieron. Es el aviso que le dice
        // al coordinador a quien llamar hoy.
        com.novacrm.pipeline.AlertasEmpleabilidad
                .porSeguimientosVencidos(seguimientoRepository.findVencidos(hoy), hoy)
                .forEach(a -> alertas.add(new AlertaResponse(
                        a.tipo(), a.severidad(), a.titulo(), a.detalle(),
                        a.referenciaId(), a.ruta())));

        return alertas;
    }

    private double variacionPct(long actual, long anterior) {
        if (anterior == 0) return actual > 0 ? 100.0 : 0.0;
        return redondear((double) (actual - anterior) / anterior * 100);
    }

    private Double pct(long parte, long total) {
        if (total == 0) return 0.0;
        return redondear((double) parte / total * 100);
    }

    private double redondear(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    /** Estudiantes activos que aún no tienen ningún documento cargado. */
    private long contarDocumentosPendientes() {
        return entityManager.createQuery(
                        """
                        SELECT COUNT(e) FROM Estudiante e WHERE e.activo = true
                        AND NOT EXISTS (SELECT 1 FROM Documento d WHERE d.estudiante.id = e.id AND d.actual = true)
                        """, Long.class)
                .getSingleResult();
    }

    /** Estudiantes activos sin hoja de vida generada vigente. */
    private long contarHvsPorGenerar() {
        return entityManager.createQuery(
                        """
                        SELECT COUNT(e) FROM Estudiante e WHERE e.activo = true
                        AND NOT EXISTS (SELECT 1 FROM HojaDeVida h WHERE h.estudiante.id = e.id AND h.actual = true)
                        """, Long.class)
                .getSingleResult();
    }
}
