package com.novacrm.correo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PlantillaRepository extends JpaRepository<PlantillaGuardada, UUID> {

    /**
     * Las plantillas que puede usar un programa: las suyas y las comunes.
     *
     * <p>Las comunes (programa_id null) salen tambien a proposito: tener una
     * sola "bienvenida" que cada proyecto envia con su marca es justo lo que
     * evita mantener la misma redaccion copiada en cada cliente.
     */
    @Query("""
            SELECT p FROM PlantillaGuardada p
            WHERE p.activa = true
              AND (p.programaId = :programaId OR p.programaId IS NULL)
            ORDER BY p.programaId NULLS LAST, p.nombre
            """)
    List<PlantillaGuardada> disponiblesPara(@Param("programaId") UUID programaId);

    List<PlantillaGuardada> findAllByOrderByNombreAsc();
}
