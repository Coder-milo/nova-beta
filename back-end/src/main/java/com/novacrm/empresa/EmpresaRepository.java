package com.novacrm.empresa;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmpresaRepository extends JpaRepository<Empresa, UUID> {

    /**
     * Solo activas: una empresa eliminada (soft) no puede reengancharse ni
     * bloquear el nombre, y una vacante no puede colgar de ella.
     *
     * <p>Compara normalizado y no con LOWER(): la hoja de contactos trae la
     * misma empresa como «Solvo S.A.S.», «SOLVO SAS» y «Solvo sas», y con
     * igualdad exacta cada variante creaba un empleador distinto. Al
     * normalizar, las tres son la misma.
     */
    @Query("""
            SELECT e FROM Empresa e
            WHERE novacrm_normalizar_empresa(e.nombre)
                = novacrm_normalizar_empresa(CAST(:nombre AS string))
              AND e.activo = true
            """)
    Optional<Empresa> findByNombreIgnoreCaseActiva(@Param("nombre") String nombre);

    @Query("SELECT e FROM Empresa e WHERE e.id = :id AND e.activo = true")
    Optional<Empresa> findActivaById(@Param("id") UUID id);

    List<Empresa> findByEstadoRelacion(EstadoRelacion estadoRelacion);

    /**
     * Busqueda del directorio.
     *
     * <p>Cubre tambien {@code cargosTipicos} porque el equipo no busca por
     * nombre de empresa sino por lo que necesita colocar: "freight", "paralegal".
     */
    @Query("""
            SELECT e FROM Empresa e
            WHERE e.activo = true
              AND (:texto IS NULL OR :texto = ''
                   OR LOWER(e.nombre) LIKE LOWER(CONCAT('%', :texto, '%'))
                   OR LOWER(COALESCE(e.sector, '')) LIKE LOWER(CONCAT('%', :texto, '%'))
                   OR LOWER(COALESCE(e.cargosTipicos, '')) LIKE LOWER(CONCAT('%', :texto, '%')))
              AND (:sector IS NULL OR :sector = '' OR e.sector = :sector)
              AND (:estado IS NULL OR e.estadoRelacion = :estado)
            """)
    Page<Empresa> buscar(@Param("texto") String texto,
                         @Param("sector") String sector,
                         @Param("estado") EstadoRelacion estado,
                         Pageable pageable);

    @Query("SELECT DISTINCT e.sector FROM Empresa e WHERE e.sector IS NOT NULL ORDER BY e.sector")
    List<String> sectores();

    @Query("SELECT e.estadoRelacion, COUNT(e) FROM Empresa e WHERE e.activo = true GROUP BY e.estadoRelacion")
    List<Object[]> recuentoPorEstadoRelacion();
}
