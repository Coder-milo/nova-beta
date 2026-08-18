package com.novacrm.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UsuarioRepository extends JpaRepository<Usuario, UUID> {

    /**
     * La cuenta por su correo, sin distinguir mayusculas.
     *
     * <p>Se buscaba con igualdad exacta mientras la ficha del estudiante se
     * busca sin distinguir: la misma persona era dos cosas distintas segun la
     * mitad del sistema. En un movil que pone la primera letra en mayuscula por
     * su cuenta, eso se vive como "mi correo no existe".
     *
     * <p>Desde V45 los correos se guardan en minusculas y hay un indice unico
     * sobre {@code lower(email)}, asi que esto no puede devolver dos cuentas.
     */
    Optional<Usuario> findByEmailIgnoreCase(String email);

    Optional<Usuario> findByResetToken(String resetToken);
    boolean existsByEmailIgnoreCase(String email);

    /**
     * Las cuentas del portal atadas a una empresa, activas y revocadas.
     *
     * <p>Las revocadas tambien: una cuenta desactivada no desaparece —queda por
     * auditoria— y no verla desde la ficha lleva a invitar otra vez al mismo
     * correo sin entender por que el sistema dice que ya existe.
     */
    java.util.List<Usuario> findByEmpresaIdOrderByEmailAsc(UUID empresaId);

}
