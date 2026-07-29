package com.novacrm.pipeline;

import com.novacrm.seguimiento.Seguimiento;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Convierte hechos del seguimiento en avisos accionables.
 *
 * <p>El tablero avisaba solo de datos incompletos y de programas por finalizar.
 * Nada miraba los compromisos ya anotados: {@code proximaAccion} y
 * {@code fechaProxima} se guardaban y ahi se quedaban. Un compromiso vencido es
 * la senal mas barata que tiene el sistema para decirle al coordinador a quien
 * llamar hoy.
 *
 * <p>La logica se mantiene aparte del servicio de tablero para poder
 * ejercitarla sin base de datos.
 */
public final class AlertasEmpleabilidad {

    /** A partir de este retraso el aviso pasa de MEDIA a ALTA. */
    static final int DIAS_PARA_SEVERIDAD_ALTA = 7;

    private AlertasEmpleabilidad() {
    }

    /** Aviso listo para mostrar, sin depender del DTO del tablero. */
    public record Aviso(
            String tipo,
            String severidad,
            String titulo,
            String detalle,
            String referenciaId,
            String ruta) {}

    public static List<Aviso> porSeguimientosVencidos(List<Seguimiento> vencidos, LocalDate hoy) {
        return vencidos.stream()
                .filter(s -> s.getFechaProxima() != null && s.getFechaProxima().isBefore(hoy))
                .map(s -> aviso(s, hoy))
                .toList();
    }

    private static Aviso aviso(Seguimiento s, LocalDate hoy) {
        long dias = ChronoUnit.DAYS.between(s.getFechaProxima(), hoy);
        String nombre = nombreEstudiante(s);
        String accion = s.getProximaAccion() == null || s.getProximaAccion().isBlank()
                ? "seguimiento pendiente"
                : s.getProximaAccion();

        return new Aviso(
                "SEGUIMIENTO_VENCIDO",
                dias >= DIAS_PARA_SEVERIDAD_ALTA ? "ALTA" : "MEDIA",
                "Seguimiento vencido: " + nombre,
                "«" + accion + "» vencio hace " + dias + " dia(s) (" + s.getFechaProxima() + ").",
                s.getEstudiante() == null ? null : s.getEstudiante().getId().toString(),
                s.getEstudiante() == null ? "/seguimiento"
                        : "/estudiantes/" + s.getEstudiante().getId());
    }

    private static String nombreEstudiante(Seguimiento s) {
        if (s.getEstudiante() == null) {
            return "estudiante sin asignar";
        }
        String nombre = s.getEstudiante().getNombre();
        String apellido = s.getEstudiante().getApellido();
        String completo = ((nombre == null ? "" : nombre) + " "
                + (apellido == null ? "" : apellido)).trim();
        return completo.isEmpty() ? "estudiante sin nombre" : completo;
    }
}
