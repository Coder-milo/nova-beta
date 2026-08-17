package com.novacrm.estudiante.linea;

import com.novacrm.colocacion.Colocacion;
import com.novacrm.colocacion.ColocacionRepository;
import com.novacrm.documento.Documento;
import com.novacrm.documento.DocumentoRepository;
import com.novacrm.postulacion.Postulacion;
import com.novacrm.postulacion.PostulacionRepository;
import com.novacrm.seguimiento.Seguimiento;
import com.novacrm.seguimiento.SeguimientoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * La historia de un estudiante, en una sola lista.
 *
 * <p>Se compone en el servidor y no en el navegador. Hacerlo en el cliente
 * serían cuatro peticiones que hay que esperar todas antes de pintar nada, una
 * mezcla y un orden repetidos en cada pantalla que lo necesite, y —lo que lo
 * decide— ningún modo de limitar el resultado: con cuatro listas sueltas no se
 * puede pedir «los últimos treinta sucesos» sin traérselo todo primero.
 */
@Service
public class LineaDeTiempoService {

    /**
     * Tope de sucesos devueltos.
     *
     * <p>Una persona con dos años en el programa acumula cientos de apuntes de
     * seguimiento. Sin tope, abrir su ficha se traería la historia completa
     * para pintar los diez primeros.
     */
    private static final int TOPE = 60;

    private final PostulacionRepository postulaciones;
    private final SeguimientoRepository seguimientos;
    private final DocumentoRepository documentos;
    private final ColocacionRepository colocaciones;

    public LineaDeTiempoService(PostulacionRepository postulaciones,
                                SeguimientoRepository seguimientos,
                                DocumentoRepository documentos,
                                ColocacionRepository colocaciones) {
        this.postulaciones = postulaciones;
        this.seguimientos = seguimientos;
        this.documentos = documentos;
        this.colocaciones = colocaciones;
    }

    @Transactional(readOnly = true)
    public List<HitoDeLaLinea> de(UUID estudianteId) {
        var hitos = new ArrayList<HitoDeLaLinea>();

        for (Postulacion p : postulaciones.findByEstudianteIdOrderByFechaPostulacionDesc(estudianteId)) {
            hitos.add(new HitoDeLaLinea(
                    p.getId(), "POSTULACION",
                    aInstante(p.getFechaPostulacion()),
                    "Se postuló en " + p.nombreEmpresa(),
                    p.getCargo(),
                    p.getGestionadaPor(),
                    "/seguimiento"));

            // La entrevista es un suceso distinto de la postulación y va en su
            // propia fecha: agrupar las dos bajo el día en que se postuló
            // dejaría la cita fuera de sitio en la línea, que es justo donde se
            // busca.
            if (p.getFechaHoraEntrevista() != null) {
                String donde = p.getLugarEntrevista() == null ? "" : " · " + p.getLugarEntrevista();
                hitos.add(new HitoDeLaLinea(
                        p.getId(), "ENTREVISTA",
                        p.getFechaHoraEntrevista(),
                        "Entrevista en " + p.nombreEmpresa(),
                        (p.getModalidadEntrevista() == null
                                ? "" : p.getModalidadEntrevista().getEtiqueta()) + donde,
                        p.getContactoNombre(),
                        "/agenda"));
            }
        }

        for (Seguimiento s : seguimientos.findByEstudianteIdOrderByFechaDesc(estudianteId)) {
            hitos.add(new HitoDeLaLinea(
                    s.getId(), "SEGUIMIENTO",
                    aInstante(s.getFecha()),
                    s.getTipo() == null ? "Seguimiento" : s.getTipo(),
                    s.getObservacion(),
                    s.getResponsable(),
                    "/seguimiento"));
        }

        for (Documento d : documentos.findByEstudianteIdAndActualTrueOrderByCreatedAtDesc(estudianteId)) {
            hitos.add(new HitoDeLaLinea(
                    d.getId(), "DOCUMENTO",
                    d.getCreatedAt() == null ? null
                            : LocalDateTime.ofInstant(d.getCreatedAt(), ZoneId.systemDefault()),
                    "Documento: " + (d.getNombre() == null ? "sin nombre" : d.getNombre()),
                    d.getTipo(),
                    null,
                    "/documentos"));
        }

        for (Colocacion c : colocaciones.findByEstudianteIdOrderByFechaInicioDesc(estudianteId)) {
            hitos.add(new HitoDeLaLinea(
                    c.getId(), "COLOCACION",
                    aInstante(c.getFechaInicio()),
                    "Colocado en " + (c.getEmpresaNombre() == null ? "una empresa" : c.getEmpresaNombre()),
                    c.getCargo(),
                    null,
                    "/colocaciones"));
        }

        // Los sucesos sin fecha van al final y no al principio: un registro sin
        // fecha no es «lo más reciente», es un dato incompleto, y colarlo arriba
        // lo haría pasar por lo último que ocurrió.
        return hitos.stream()
                .sorted(Comparator.comparing(HitoDeLaLinea::cuando,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(TOPE)
                .toList();
    }

    /** Una fecha sin hora se ancla al mediodía, no a medianoche. */
    private static LocalDateTime aInstante(LocalDate fecha) {
        // A medianoche, un apunte del día 5 quedaría antes que una entrevista
        // de las 09:00 del día 5 —correcto— pero también antes que cualquier
        // cosa del día 4 por la tarde al invertir el orden. El mediodía lo
        // coloca dentro de su día sin fingir una hora de trabajo real.
        return fecha == null ? null : fecha.atTime(LocalTime.NOON);
    }
}
