package com.novacrm.admin;

import com.novacrm.estudiante.BorradoEstudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.programa.ProgramaRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class AdminService {

    private final EstudianteRepository estudianteRepository;
    private final ProgramaRepository programaRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public AdminService(EstudianteRepository estudianteRepository,
                        ProgramaRepository programaRepository) {
        this.estudianteRepository = estudianteRepository;
        this.programaRepository = programaRepository;
    }

    @Transactional
    public int softDeleteEstudiantesByPrograma(UUID programaId) {
        if (!programaRepository.existsById(programaId)) {
            throw new BusinessException("Programa no encontrado: " + programaId);
        }
        return estudianteRepository.softDeleteByProgramaId(programaId);
    }

    @Transactional
    public int resetPrograma(UUID programaId) {
        if (!programaRepository.existsById(programaId)) {
            throw new BusinessException("Programa no encontrado: " + programaId);
        }

        List<UUID> ids = entityManager.createQuery(
                "SELECT e.id FROM Estudiante e WHERE e.programa.id = :programaId", UUID.class)
                .setParameter("programaId", programaId)
                .getResultList();

        if (ids.isEmpty()) return 0;

        return BorradoEstudiante.borrarEnCadena(entityManager, ids);
    }

    @Transactional
    public void cleanupSystem() {
        entityManager.createQuery("DELETE FROM Credencial").executeUpdate();
        entityManager.createQuery("DELETE FROM Match").executeUpdate();
        entityManager.createQuery("DELETE FROM Notificacion").executeUpdate();
        entityManager.createQuery("DELETE FROM EstudianteHabilidad").executeUpdate();
        entityManager.createQuery("DELETE FROM EstudianteCertificacion").executeUpdate();
        entityManager.createQuery("DELETE FROM LinkedinConfiguracion").executeUpdate();
        entityManager.createQuery("DELETE FROM Estudiante").executeUpdate();
        entityManager.createQuery("DELETE FROM Vacante").executeUpdate();
    }

    @Transactional
    public int restaurarEstudiantesByPrograma(UUID programaId) {
        if (!programaRepository.existsById(programaId)) {
            throw new BusinessException("Programa no encontrado: " + programaId);
        }
        return entityManager.createQuery(
                "UPDATE Estudiante e SET e.activo = true, e.deletedAt = null WHERE e.programa.id = :programaId AND e.activo = false")
                .setParameter("programaId", programaId)
                .executeUpdate();
    }

    @Transactional
    public int purgarPapelera() {
        var limite = Instant.now().minus(java.time.Duration.ofDays(30));
        List<UUID> ids = entityManager.createQuery(
                "SELECT e.id FROM Estudiante e WHERE e.activo = false AND e.deletedAt < :limite", UUID.class)
                .setParameter("limite", limite)
                .getResultList();

        if (ids.isEmpty()) return 0;

        entityManager.createQuery(
                "DELETE FROM Credencial c WHERE c.id IN (SELECT ec.id FROM EstudianteCertificacion ec WHERE ec.estudiante.id IN :ids)")
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

        return eliminados;
    }
}
