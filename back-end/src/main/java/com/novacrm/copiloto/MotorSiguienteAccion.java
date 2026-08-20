package com.novacrm.copiloto;

import com.novacrm.copiloto.CopilotoDtos.Accion;
import com.novacrm.copiloto.CopilotoDtos.Audiencia;
import com.novacrm.copiloto.CopilotoDtos.Categoria;
import com.novacrm.copiloto.CopilotoDtos.Evidencia;
import com.novacrm.copiloto.CopilotoDtos.Prioridad;
import com.novacrm.copiloto.CopilotoDtos.Recomendacion;
import com.novacrm.copiloto.CopilotoDtos.Texto;
import com.novacrm.copiloto.CopilotoDtos.TipoAccion;
import com.novacrm.estudiante.EstadoEmpleabilidad;
import com.novacrm.postulacion.EstadoPostulacion;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Motor determinista de Next Best Action.
 *
 * <p>No llama una IA, no escribe datos y no infiere causas. Cada salida nace
 * de hechos incluidos en {@link Contexto}; por eso se puede probar y auditar.
 */
public final class MotorSiguienteAccion {

    public static final int DIAS_SIN_POSTULAR = 15;
    public static final int HORAS_PREPARAR_ENTREVISTA = 48;
    public static final int POSTULACIONES_PARA_RADAR = 5;

    private MotorSiguienteAccion() {
    }

    public record SeguimientoDato(
            LocalDate fecha,
            String tipo,
            String estado,
            String proximaAccion,
            LocalDate fechaProxima) {}

    public record PostulacionDato(
            LocalDate fechaPostulacion,
            EstadoPostulacion estado,
            LocalDateTime fechaHoraEntrevista,
            String cargo,
            String empresa) {}

    public record Contexto(
            UUID estudianteId,
            String nombre,
            EstadoEmpleabilidad estadoEmpleabilidad,
            boolean hojaDeVidaLista,
            boolean linkedinOptimizado,
            boolean simulacroRealizado,
            int porcentajePreparacion,
            boolean colocado,
            List<SeguimientoDato> seguimientos,
            List<PostulacionDato> postulaciones,
            long oportunidadesVigentes,
            BigDecimal mejorCompatibilidad) {
        public Contexto {
            seguimientos = seguimientos == null ? List.of() : List.copyOf(seguimientos);
            postulaciones = postulaciones == null ? List.of() : List.copyOf(postulaciones);
        }
    }

    private record Candidata(int orden, Recomendacion recomendacion) {}

    public static List<Recomendacion> evaluar(
            Contexto contexto,
            Audiencia audiencia,
            LocalDateTime ahora) {
        var candidatas = new ArrayList<Candidata>();
        entrevistaSinCerrar(contexto, audiencia, ahora, candidatas);
        seguimientoVencido(contexto, audiencia, ahora.toLocalDate(), candidatas);
        entrevistaSinPreparacion(contexto, audiencia, ahora, candidatas);
        hojaDeVidaComoBloqueo(contexto, audiencia, candidatas);
        preparadoSinPostular(contexto, audiencia, ahora.toLocalDate(), candidatas);
        cuelloPostulacionEntrevista(contexto, audiencia, candidatas);

        return candidatas.stream()
                .sorted(Comparator.comparingInt(Candidata::orden))
                .map(Candidata::recomendacion)
                .toList();
    }

    private static void entrevistaSinCerrar(Contexto c, Audiencia a, LocalDateTime ahora,
                                             List<Candidata> salida) {
        var vencidas = c.postulaciones().stream()
                .filter(p -> p.fechaHoraEntrevista() != null
                        && p.fechaHoraEntrevista().isBefore(ahora)
                        && p.estado() == EstadoPostulacion.ENTREVISTA_AGENDADA)
                .sorted(Comparator.comparing(PostulacionDato::fechaHoraEntrevista))
                .toList();
        if (vencidas.isEmpty()) return;
        var primera = vencidas.get(0);
        salida.add(new Candidata(10, new Recomendacion(
                "ENTREVISTA_SIN_CERRAR", Prioridad.ALTA, Categoria.ENTREVISTA,
                a == Audiencia.ADMINISTRACION
                        ? texto(
                            "Cerrar entrevista sin resultado", "Close interview without an outcome",
                            "La entrevista de " + c.nombre() + " ya pasó y el proceso continúa como agendado.",
                            c.nombre() + "'s interview has passed and the process is still marked as scheduled.",
                            "Sin el resultado no se sabe si hay que avanzar, acompañar o cerrar el proceso.",
                            "Without an outcome, the team cannot decide whether to advance, support or close the process.")
                        : texto(
                            "Cuéntanos cómo fue tu entrevista", "Tell us how your interview went",
                            "Tu entrevista ya pasó y todavía no tiene un resultado registrado.",
                            "Your interview has passed and does not have a recorded outcome yet.",
                            "Actualizarla ayuda a que el equipo te acompañe en el siguiente paso.",
                            "Updating it helps the team support your next step."),
                List.of(
                        evidencia("FECHA_ENTREVISTA", primera.fechaHoraEntrevista().toString(),
                                "Entrevista: " + primera.fechaHoraEntrevista(),
                                "Interview: " + primera.fechaHoraEntrevista()),
                        evidencia("PROCESOS_SIN_CIERRE", String.valueOf(vencidas.size()),
                                vencidas.size() + " proceso(s) sin cierre",
                                vencidas.size() + " process(es) without an outcome")),
                accion(a, c.estudianteId(), TipoAccion.POSTULACIONES,
                        "Registrar resultado", "Record outcome",
                        "Actualizar mi proceso", "Update my process"))));
    }

    private static void seguimientoVencido(Contexto c, Audiencia a, LocalDate hoy,
                                            List<Candidata> salida) {
        var vencidos = c.seguimientos().stream()
                .filter(s -> s.fechaProxima() != null
                        && s.fechaProxima().isBefore(hoy)
                        && !completado(s.estado()))
                .sorted(Comparator.comparing(SeguimientoDato::fechaProxima))
                .toList();
        if (vencidos.isEmpty()) return;
        var primero = vencidos.get(0);
        long dias = ChronoUnit.DAYS.between(primero.fechaProxima(), hoy);
        salida.add(new Candidata(20, new Recomendacion(
                "SEGUIMIENTO_VENCIDO", Prioridad.ALTA, Categoria.SEGUIMIENTO,
                a == Audiencia.ADMINISTRACION
                        ? texto(
                            "Retomar compromiso de seguimiento", "Resume overdue follow-up",
                            "Hay " + vencidos.size() + " acción(es) de seguimiento vencida(s) para " + c.nombre() + ".",
                            "There are " + vencidos.size() + " overdue follow-up action(s) for " + c.nombre() + ".",
                            "Un compromiso con fecha es una obligación operativa y debe volver a la cola de trabajo.",
                            "A dated commitment is operational work and must return to the work queue.")
                        : texto(
                            "Revisa tu próximo paso", "Review your next step",
                            "Hay una acción de acompañamiento pendiente en tu proceso.",
                            "There is a pending support action in your process.",
                            "Revisarla te permite coordinar con el equipo qué debes hacer ahora.",
                            "Reviewing it helps you coordinate your next step with the team."),
                List.of(
                        evidencia("FECHA_COMPROMISO", primero.fechaProxima().toString(),
                                "Fecha límite: " + primero.fechaProxima(),
                                "Due date: " + primero.fechaProxima()),
                        evidencia("DIAS_VENCIDO", String.valueOf(dias),
                                "Vencido hace " + dias + " día(s)",
                                "Overdue by " + dias + " day(s)")),
                accion(a, c.estudianteId(), TipoAccion.SEGUIMIENTO,
                        "Registrar seguimiento", "Add follow-up",
                        "Ver mi proceso", "View my process"))));
    }

    private static void entrevistaSinPreparacion(Contexto c, Audiencia a, LocalDateTime ahora,
                                                  List<Candidata> salida) {
        if (c.simulacroRealizado()) return;
        var proxima = c.postulaciones().stream()
                .filter(p -> p.fechaHoraEntrevista() != null
                        && !p.fechaHoraEntrevista().isBefore(ahora)
                        && !p.fechaHoraEntrevista().isAfter(ahora.plusHours(HORAS_PREPARAR_ENTREVISTA)))
                .min(Comparator.comparing(PostulacionDato::fechaHoraEntrevista));
        if (proxima.isEmpty()) return;
        var p = proxima.get();
        long horas = Math.max(0, Duration.between(ahora, p.fechaHoraEntrevista()).toHours());
        salida.add(new Candidata(30, new Recomendacion(
                "ENTREVISTA_SIN_PREPARACION", Prioridad.ALTA, Categoria.ENTREVISTA,
                a == Audiencia.ADMINISTRACION
                        ? texto(
                            "Preparar entrevista próxima", "Prepare upcoming interview",
                            c.nombre() + " tiene una entrevista en las próximas " + HORAS_PREPARAR_ENTREVISTA
                                    + " horas y no registra simulacro completado.",
                            c.nombre() + " has an interview within " + HORAS_PREPARAR_ENTREVISTA
                                    + " hours and no completed mock interview is recorded.",
                            "La preparación todavía puede hacerse antes de la cita.",
                            "There is still time to prepare before the interview.")
                        : texto(
                            "Prepárate para tu entrevista", "Prepare for your interview",
                            "Tienes una entrevista próxima y aún no aparece una preparación completada.",
                            "You have an upcoming interview and no completed preparation is recorded yet.",
                            "Prepararte hoy puede ayudarte a llegar con mayor claridad y confianza.",
                            "Preparing today can help you arrive with greater clarity and confidence."),
                List.of(
                        evidencia("HORAS_ENTREVISTA", String.valueOf(horas),
                                "Faltan aproximadamente " + horas + " hora(s)",
                                "Approximately " + horas + " hour(s) remaining"),
                        evidencia("CARGO", nulo(p.cargo()),
                                "Cargo: " + nulo(p.cargo()),
                                "Role: " + nulo(p.cargo())),
                        evidencia("SIMULACRO", "false",
                                "Sin simulacro completado", "No completed mock interview")),
                accion(a, c.estudianteId(), TipoAccion.PREPARACION,
                        "Preparar entrevista", "Prepare interview",
                        "Ver entrevista", "View interview"))));
    }

    private static void hojaDeVidaComoBloqueo(Contexto c, Audiencia a,
                                               List<Candidata> salida) {
        if (c.colocado() || c.estadoEmpleabilidad() != EstadoEmpleabilidad.BUSCANDO
                || c.hojaDeVidaLista()) return;
        salida.add(new Candidata(40, new Recomendacion(
                "CV_BLOQUEANTE", Prioridad.MEDIA, Categoria.HOJA_DE_VIDA,
                a == Audiencia.ADMINISTRACION
                        ? texto(
                            "Completar hoja de vida antes de postular", "Complete résumé before applying",
                            c.nombre() + " está buscando empleo pero no tiene una hoja de vida vigente o validada.",
                            c.nombre() + " is job seeking but has no current or validated résumé.",
                            "La hoja de vida es el principal insumo para presentar el perfil a una empresa.",
                            "The résumé is the main document used to present the profile to an employer.")
                        : texto(
                            "Completa tu hoja de vida", "Complete your résumé",
                            "Estás buscando oportunidades y tu hoja de vida todavía no figura como lista.",
                            "You are looking for opportunities and your résumé is not marked as ready yet.",
                            "Completarla habilita un perfil más claro para tus próximas postulaciones.",
                            "Completing it gives your next applications a clearer profile."),
                List.of(
                        evidencia("ESTADO_EMPLEABILIDAD", "BUSCANDO", "Estado: buscando empleo", "Status: job seeking"),
                        evidencia("CV_VIGENTE", "false", "Sin CV vigente o validado", "No current or validated résumé")),
                accion(a, c.estudianteId(), TipoAccion.HOJA_DE_VIDA,
                        "Revisar hoja de vida", "Review résumé",
                        "Actualizar mi hoja de vida", "Update my résumé"))));
    }

    private static void preparadoSinPostular(Contexto c, Audiencia a, LocalDate hoy,
                                              List<Candidata> salida) {
        if (c.colocado() || c.estadoEmpleabilidad() != EstadoEmpleabilidad.BUSCANDO
                || !c.hojaDeVidaLista() || !c.linkedinOptimizado()
                || c.oportunidadesVigentes() <= 0) return;

        var ultima = c.postulaciones().stream()
                .map(PostulacionDato::fechaPostulacion)
                .filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder());
        long dias = ultima.map(fecha -> ChronoUnit.DAYS.between(fecha, hoy)).orElse(Long.MAX_VALUE);
        if (dias < DIAS_SIN_POSTULAR) return;
        Prioridad prioridad = dias == Long.MAX_VALUE || dias >= 20 ? Prioridad.ALTA : Prioridad.MEDIA;
        String lapsoEs = dias == Long.MAX_VALUE ? "no registra postulaciones" : "lleva " + dias + " días sin postularse";
        String lapsoEn = dias == Long.MAX_VALUE ? "has no recorded applications" : "has not applied for " + dias + " days";
        salida.add(new Candidata(50, new Recomendacion(
                "PREPARADO_SIN_POSTULAR", prioridad, Categoria.EMPLEABILIDAD,
                a == Audiencia.ADMINISTRACION
                        ? texto(
                            "Reactivar postulaciones", "Reactivate applications",
                            c.nombre() + " tiene CV y LinkedIn preparados, pero " + lapsoEs + ".",
                            c.nombre() + " has a prepared résumé and LinkedIn profile, but " + lapsoEn + ".",
                            "Hay oportunidades vigentes que pueden revisarse sin esperar una nueva carga de datos.",
                            "There are current opportunities that can be reviewed without waiting for new data.")
                        : texto(
                            "Estás listo para revisar oportunidades", "You are ready to review opportunities",
                            "Tu CV y LinkedIn están preparados, y encontramos opciones vigentes para ti.",
                            "Your résumé and LinkedIn profile are ready, and we found current opportunities for you.",
                            "Revisarlas es el siguiente paso concreto para activar tu proceso.",
                            "Reviewing them is the next concrete step to activate your process."),
                evidenciasOportunidades(c, ultima.orElse(null), dias),
                accion(a, c.estudianteId(), TipoAccion.OPORTUNIDADES,
                        "Revisar oportunidades", "Review opportunities",
                        "Ver oportunidades", "View opportunities"))));
    }

    private static void cuelloPostulacionEntrevista(Contexto c, Audiencia a,
                                                     List<Candidata> salida) {
        long postulaciones = c.postulaciones().size();
        long entrevistas = c.postulaciones().stream()
                .filter(p -> p.fechaHoraEntrevista() != null
                        || p.estado() == EstadoPostulacion.ENTREVISTA_AGENDADA
                        || p.estado() == EstadoPostulacion.ENTREVISTA_REALIZADA
                        || p.estado() == EstadoPostulacion.CONTRATADO)
                .count();
        if (c.colocado() || postulaciones < POSTULACIONES_PARA_RADAR || entrevistas > 0) return;
        salida.add(new Candidata(60, new Recomendacion(
                "RADAR_POSTULACION_SIN_ENTREVISTA", Prioridad.MEDIA, Categoria.RADAR,
                a == Audiencia.ADMINISTRACION
                        ? texto(
                            "Revisar conversión a entrevista", "Review application-to-interview conversion",
                            c.nombre() + " registra " + postulaciones + " postulaciones y todavía no registra entrevistas.",
                            c.nombre() + " has " + postulaciones + " applications and no recorded interviews yet.",
                            "Esto no demuestra una causa; señala que conviene revisar CV, ajuste y selección de vacantes.",
                            "This does not prove a cause; it signals that résumé, fit and vacancy selection should be reviewed.")
                        : texto(
                            "Revisemos la estrategia de postulación", "Let's review your application strategy",
                            "Has realizado varias postulaciones y todavía no aparece una entrevista registrada.",
                            "You have submitted several applications and no interview is recorded yet.",
                            "Podemos revisar contigo el CV y el ajuste de las oportunidades, sin asumir una causa.",
                            "We can review your résumé and opportunity fit with you, without assuming a cause."),
                List.of(
                        evidencia("POSTULACIONES", String.valueOf(postulaciones),
                                postulaciones + " postulaciones", postulaciones + " applications"),
                        evidencia("ENTREVISTAS", "0", "0 entrevistas registradas", "0 recorded interviews")),
                accion(a, c.estudianteId(), TipoAccion.SEGUIMIENTO,
                        "Revisar estrategia", "Review strategy",
                        "Solicitar acompañamiento", "Request support"))));
    }

    private static List<Evidencia> evidenciasOportunidades(Contexto c, LocalDate ultima, long dias) {
        var evidencia = new ArrayList<Evidencia>();
        evidencia.add(evidencia("OPORTUNIDADES", String.valueOf(c.oportunidadesVigentes()),
                c.oportunidadesVigentes() + " oportunidad(es) vigente(s)",
                c.oportunidadesVigentes() + " current opportunity/opportunities"));
        if (c.mejorCompatibilidad() != null) {
            evidencia.add(evidencia("MEJOR_COMPATIBILIDAD", c.mejorCompatibilidad().toPlainString(),
                    "Mejor compatibilidad: " + c.mejorCompatibilidad() + "%",
                    "Best match: " + c.mejorCompatibilidad() + "%"));
        }
        if (ultima != null) {
            evidencia.add(evidencia("ULTIMA_POSTULACION", ultima.toString(),
                    "Última postulación: hace " + dias + " día(s)",
                    "Last application: " + dias + " day(s) ago"));
        } else {
            evidencia.add(evidencia("ULTIMA_POSTULACION", "SIN_REGISTRO",
                    "Sin postulaciones registradas", "No recorded applications"));
        }
        return List.copyOf(evidencia);
    }

    private static boolean completado(String estado) {
        return estado != null && estado.trim().toUpperCase().startsWith("COMPLET");
    }

    private static String nulo(String valor) {
        return valor == null || valor.isBlank() ? "Sin dato" : valor;
    }

    private static Texto texto(String tituloEs, String tituloEn,
                               String detectoEs, String detectoEn,
                               String importaEs, String importaEn) {
        return new Texto(tituloEs, tituloEn, detectoEs, detectoEn, importaEs, importaEn);
    }

    private static Evidencia evidencia(String codigo, String valor, String es, String en) {
        return new Evidencia(codigo, valor, es, en);
    }

    private static Accion accion(Audiencia audiencia, UUID estudianteId, TipoAccion tipo,
                                 String adminEs, String adminEn,
                                 String estudianteEs, String estudianteEn) {
        String rutaAdmin = "/estudiantes/" + estudianteId;
        String rutaEstudiante = switch (tipo) {
            case HOJA_DE_VIDA -> "/mi-hoja-de-vida";
            case POSTULACIONES, OPORTUNIDADES, PREPARACION -> "/mis-postulaciones";
            case SEGUIMIENTO -> "/mi-proceso";
        };
        return audiencia == Audiencia.ADMINISTRACION
                ? new Accion(tipo, adminEs, adminEn, rutaAdmin)
                : new Accion(tipo, estudianteEs, estudianteEn, rutaEstudiante);
    }
}
