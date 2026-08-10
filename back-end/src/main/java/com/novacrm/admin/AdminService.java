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
    private final com.novacrm.configuracion.ConfiguracionService configuracionService;
    private final com.novacrm.auditoria.AuditoriaService auditoriaService;

    @PersistenceContext
    private EntityManager entityManager;

    public AdminService(EstudianteRepository estudianteRepository,
                        ProgramaRepository programaRepository,
                        com.novacrm.configuracion.ConfiguracionService configuracionService,
                        com.novacrm.auditoria.AuditoriaService auditoriaService) {
        this.estudianteRepository = estudianteRepository;
        this.programaRepository = programaRepository;
        this.configuracionService = configuracionService;
        this.auditoriaService = auditoriaService;
    }

    /**
     * Deja constancia de una operacion masiva sobre fichas de estudiantes.
     *
     * <p>Estas son las operaciones mas destructivas del sistema y eran las
     * unicas sin rastro: el registro de auditoria lleva tiempo anotando quien
     * edito una empresa, pero no quien vacio la base. Si un dia faltan fichas,
     * esto es lo unico que puede decir quien, cuando y desde donde.
     *
     * <p>Se anota aunque no borre nada: "alguien lo intento y no habia nada"
     * tambien es informacion, y un registro que solo aparece cuando el numero
     * es alto no sirve para reconstruir lo que paso.
     */
    private void anotar(String accion, String detalle, int afectados) {
        auditoriaService.registrar("ADMIN", accion, "Estudiante", null, detalle,
                null, "{\"afectados\":" + afectados + "}");
    }

    @Transactional
    public int softDeleteEstudiantesByPrograma(UUID programaId) {
        if (!programaRepository.existsById(programaId)) {
            throw new BusinessException("Programa no encontrado: " + programaId);
        }
        int afectados = estudianteRepository.softDeleteByProgramaId(programaId);
        anotar("PAPELERA_PROGRAMA", "Programa " + programaId, afectados);
        return afectados;
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

        if (ids.isEmpty()) {
            anotar("BORRADO_DEFINITIVO_PROGRAMA", "Programa " + programaId, 0);
            return 0;
        }

        int afectados = BorradoEstudiante.borrarEnCadena(entityManager, ids);
        anotar("BORRADO_DEFINITIVO_PROGRAMA", "Programa " + programaId, afectados);
        return afectados;
    }

    @Transactional
    public void cleanupSystem() {
        // Se cuenta antes de borrar: despues ya no hay a quien contar, y el
        // numero es lo unico que dice el tamaño de lo que se hizo.
        Long estudiantes = entityManager.createQuery(
                "SELECT COUNT(e) FROM Estudiante e", Long.class).getSingleResult();
        anotar("VACIADO_DEL_SISTEMA",
                "Borrado de todas las fichas, vacantes, matches y notificaciones",
                estudiantes == null ? 0 : estudiantes.intValue());

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
        int afectados = entityManager.createQuery(
                "UPDATE Estudiante e SET e.activo = true, e.deletedAt = null WHERE e.programa.id = :programaId AND e.activo = false")
                .setParameter("programaId", programaId)
                .executeUpdate();
        // Tambien se anota lo que devuelve fichas: reaparecer en las listas es
        // un cambio igual de grande que desaparecer de ellas.
        anotar("RESTAURACION_PROGRAMA", "Programa " + programaId, afectados);
        return afectados;
    }

    /**
     * Borra fisicamente lo que lleva demasiado en la papelera.
     *
     * <p>Los dias los decide la configuracion. Estaban clavados en 30 mientras
     * la pantalla ofrecia un campo para cambiarlos, asi que subirlos a 90 no
     * salvaba ninguna ficha del borrado del dia 31.
     */
    @Transactional
    public int purgarPapelera() {
        var limite = Instant.now().minus(
                java.time.Duration.ofDays(configuracionService.diasRetencionPapelera()));
        List<UUID> ids = entityManager.createQuery(
                "SELECT e.id FROM Estudiante e WHERE e.activo = false AND e.deletedAt < :limite", UUID.class)
                .setParameter("limite", limite)
                .getResultList();

        if (ids.isEmpty()) {
            anotar("PURGA_DE_PAPELERA", "Nada que purgar", 0);
            return 0;
        }

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

        anotar("PURGA_DE_PAPELERA",
                "Fichas con mas de " + configuracionService.diasRetencionPapelera()
                        + " dias en la papelera", eliminados);
        return eliminados;
    }
}
