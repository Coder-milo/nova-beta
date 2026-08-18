package com.novacrm.excel;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.UUID;

public interface PlanDeImportacionRepository extends JpaRepository<PlanDeImportacion, UUID> {

    @Modifying
    @Query("delete from PlanDeImportacion p where p.expiraEn < :limite")
    int borrarCaducados(@Param("limite") Instant limite);
}
