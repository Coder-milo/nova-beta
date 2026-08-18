package com.novacrm.empresa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * El historial de acercamientos a una empresa.
 *
 * <p>La entidad, sus dos DTO y la tabla existían desde la migración V9. Nadie
 * los usaba: no había repositorio, ni endpoint, ni una sola escritura, y la
 * tabla llevaba desde entonces con cero filas.
 *
 * <p>Lo que sí ocurría es que cada acercamiento se <strong>concatenaba a un
 * campo de texto</strong> de la empresa, {@code notas}, como
 * {@code "2026-08-16: llamé y no contestan"}. Eso parece un hilo y no lo es:
 *
 * <ul>
 *   <li>No se sabe quién escribió cada línea.
 *   <li>Corregir una obliga a editar el bloque entero.
 *   <li>No se puede ordenar, filtrar ni contar.
 *   <li>Dos personas guardando a la vez: la última pisa la línea de la otra,
 *       porque las dos leyeron el mismo texto antes de añadir la suya.
 * </ul>
 */
public interface ContactoEmpresaRepository extends JpaRepository<ContactoEmpresa, UUID> {

    /** El hilo de una empresa, lo más reciente primero, que es como se lee. */
    List<ContactoEmpresa> findByEmpresaIdOrderByFechaDesc(UUID empresaId);
}
