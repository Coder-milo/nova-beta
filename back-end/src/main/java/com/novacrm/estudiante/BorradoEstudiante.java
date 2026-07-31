package com.novacrm.estudiante;

import jakarta.persistence.EntityManager;

import java.util.List;
import java.util.UUID;

/**
 * Borrado fisico de estudiantes y de todo lo que cuelga de ellos.
 *
 * <p>Vivia duplicado en tres sitios (purga semanal, reset de programa y
 * borrado masivo) con el mismo orden de DELETE: primero las credenciales,
 * despues los demas dependientes y al final el estudiante. Un solo sitio para
 * que el orden y las entidades dependientes no se descuadren a medias.
 */
public final class BorradoEstudiante {

    private BorradoEstudiante() {
    }

    /** Elimina las credenciales y registros dependientes de los estudiantes y a ellos mismos. Devuelve cuantos estudiantes se borraron. */
    public static int borrarEnCadena(EntityManager em, List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return 0;

        em.createQuery(
                "DELETE FROM Credencial c WHERE c.estudianteCertificacion.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();
        em.createQuery(
                "DELETE FROM Match m WHERE m.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();
        em.createQuery(
                "DELETE FROM Notificacion n WHERE n.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();
        em.createQuery(
                "DELETE FROM EstudianteHabilidad eh WHERE eh.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();
        em.createQuery(
                "DELETE FROM EstudianteCertificacion ec WHERE ec.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();
        em.createQuery(
                "DELETE FROM LinkedinConfiguracion lc WHERE lc.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();

        return em.createQuery(
                "DELETE FROM Estudiante e WHERE e.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();
    }
}
