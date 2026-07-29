package com.novacrm.auditoria;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AuditoriaRepository extends JpaRepository<Auditoria, UUID> {

    @Query("""
            select a from Auditoria a
            where (:usuario is null or lower(a.usuario) like lower(concat('%', cast(:usuario as string), '%')))
              and (:modulo is null or a.modulo = cast(:modulo as string))
              and (:accion is null or a.accion = cast(:accion as string))
              and (:registroId is null or a.registroId = cast(:registroId as string))
            """)
    Page<Auditoria> buscar(@Param("usuario") String usuario,
                           @Param("modulo") String modulo,
                           @Param("accion") String accion,
                           @Param("registroId") String registroId,
                           Pageable pageable);

    List<Auditoria> findByRegistroIdOrderByFechaDesc(String registroId);
}
