package com.novacrm.empresa;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface ContactoEmpresaRepository extends JpaRepository<ContactoEmpresa,UUID>{
 List<ContactoEmpresa> findByEmpresaIdOrderByFechaDesc(UUID empresaId);
}
