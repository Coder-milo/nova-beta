package com.novacrm.scraper.fuente;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface CuotaFuenteRepository extends JpaRepository<CuotaFuente, UUID> {

    Optional<CuotaFuente> findByFuenteAndPeriodo(String fuente, String periodo);

    /**
     * Suma una consulta al contador solo si queda cupo.
     *
     * <p>Se hace en una sola sentencia y no leyendo-comprobando-guardando
     * porque dos corridas simultaneas —el cron y el boton del panel— leerian el
     * mismo valor y las dos se creerian con cupo. La base decide.
     *
     * @return 1 si quedaba cupo y se consumio, 0 si estaba agotado
     */
    @Modifying
    @Query("""
            update CuotaFuente c set c.consumidas = c.consumidas + 1
            where c.fuente = :fuente and c.periodo = :periodo and c.consumidas < c.limite
            """)
    int consumirUna(@Param("fuente") String fuente, @Param("periodo") String periodo);
}
