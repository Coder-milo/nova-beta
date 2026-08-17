package com.novacrm.vista;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VistaGuardadaRepository extends JpaRepository<VistaGuardada, UUID> {

    /**
     * Las que esta persona puede abrir en esa lista: las suyas y las que otros
     * compartieron.
     *
     * <p>Las propias primero y luego por nombre. El orden por fecha de creacion
     * seria arbitrario para quien lee: nadie recuerda cuando guardo una vista,
     * pero si como la llamo.
     */
    @Query("""
            SELECT v FROM VistaGuardada v
            WHERE v.modulo = :modulo
              AND (LOWER(v.propietario) = LOWER(:correo) OR v.compartida = true)
            ORDER BY CASE WHEN LOWER(v.propietario) = LOWER(:correo) THEN 0 ELSE 1 END,
                     LOWER(v.nombre) ASC
            """)
    List<VistaGuardada> visiblesPara(@Param("modulo") ModuloDeVista modulo,
                                     @Param("correo") String correo);

    Optional<VistaGuardada> findByPropietarioIgnoreCaseAndModuloAndNombreIgnoreCase(
            String propietario, ModuloDeVista modulo, String nombre);
}
