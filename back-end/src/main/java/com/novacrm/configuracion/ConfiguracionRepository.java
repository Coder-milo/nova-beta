package com.novacrm.configuracion;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * La fila unica de configuracion. Se busca siempre por
 * {@link ConfiguracionGlobal#FILA_UNICA}; no hay listado porque no hay lista.
 */
@Repository
public interface ConfiguracionRepository extends JpaRepository<ConfiguracionGlobal, Integer> {
}
