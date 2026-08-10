package com.novacrm.seguimiento;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface SeguimientoRepository extends JpaRepository<Seguimiento, UUID> {
    List<Seguimiento> findByEstudianteIdOrderByFechaDesc(UUID estudianteId);

    /**
     * El historial de varios estudiantes de una vez.
     *
     * <p>El tablero pedia el de cada uno por separado: 108 viajes a la base
     * para armar una pantalla que se rehace entera al abrirla y despues de
     * cada movimiento de tarjeta. Con la cohorte completa cabe de sobra en
     * memoria, y agruparlo por estudiante cuesta menos que ir 108 veces.
     *
     * <p>El orden es el mismo que la version de uno —lo mas reciente primero—
     * porque de ahi sale el estado actual de la tarjeta: quien lo agrupe puede
     * confiar en que la primera fila de cada persona es la ultima que paso.
     */
    @Query("""
            select s from Seguimiento s
            where s.estudiante.id in :estudianteIds
            order by s.fecha desc
            """)
    List<Seguimiento> historialDeVarios(@Param("estudianteIds") Collection<UUID> estudianteIds);

    /**
     * Indica si al estudiante ya se le hizo el simulacro de entrevista.
     *
     * <p>{@code tipo} es texto libre, asi que se reconoce cualquier valor que
     * empiece por "SIMULACRO" (por ejemplo "SIMULACRO_ENTREVISTA" o
     * "Simulacro de entrevista"). Solo cuenta si quedo en estado COMPLETADA:
     * un simulacro agendado todavia no es un simulacro hecho.
     */
    @Query("""
            SELECT CASE WHEN COUNT(s) > 0 THEN true ELSE false END
            FROM Seguimiento s
            WHERE s.estudiante.id = :estudianteId
              AND UPPER(s.estado) = 'COMPLETADA'
              AND UPPER(s.tipo) LIKE 'SIMULACRO%'
            """)
    boolean existeSimulacroCompletado(@Param("estudianteId") UUID estudianteId);

    /**
     * Seguimientos cuya proxima accion ya vencio y siguen sin completarse.
     *
     * <p>Los campos {@code proximaAccion} y {@code fechaProxima} se registraban
     * pero no los leia nadie: el compromiso quedaba anotado y nada avisaba
     * cuando pasaba la fecha.
     */
    @Query("""
            SELECT s FROM Seguimiento s
            WHERE s.fechaProxima IS NOT NULL
              AND s.fechaProxima < :fecha
              AND UPPER(s.estado) <> 'COMPLETADA'
            ORDER BY s.fechaProxima ASC
            """)
    List<Seguimiento> findVencidos(@Param("fecha") java.time.LocalDate fecha);
}
