package com.novacrm.config;

import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.estudiante.Estudiante;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
public class PurgeScheduler {

    private static final Logger log = LoggerFactory.getLogger(PurgeScheduler.class);

    private final EstudianteRepository estudianteRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public PurgeScheduler(EstudianteRepository estudianteRepository) {
        this.estudianteRepository = estudianteRepository;
    }

    @Scheduled(cron = "0 0 3 * * SUN")
    @Transactional
    public void purgarPapelera() {
        var limite = Instant.now().minus(java.time.Duration.ofDays(30));
        List<UUID> ids = entityManager.createQuery(
                "SELECT e.id FROM Estudiante e WHERE e.activo = false AND e.deletedAt < :limite", UUID.class)
                .setParameter("limite", limite)
                .getResultList();

        if (ids.isEmpty()) {
            log.info("Purga semanal: no hay estudiantes en papelera para eliminar");
            return;
        }

        entityManager.createQuery(
                "DELETE FROM Credencial c WHERE c.estudianteCertificacion.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();
        entityManager.createQuery(
                "DELETE FROM Match m WHERE m.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();
        entityManager.createQuery(
                "DELETE FROM Notificacion n WHERE n.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();
        entityManager.createQuery(
                "DELETE FROM EstudianteHabilidad eh WHERE eh.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();
        entityManager.createQuery(
                "DELETE FROM EstudianteCertificacion ec WHERE ec.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();
        entityManager.createQuery(
                "DELETE FROM LinkedinConfiguracion lc WHERE lc.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();

        int eliminados = entityManager.createQuery(
                "DELETE FROM Estudiante e WHERE e.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();

        log.info("Purga semanal: {} estudiantes eliminados físicamente (más de 30 días en papelera)", eliminados);
    }
}
