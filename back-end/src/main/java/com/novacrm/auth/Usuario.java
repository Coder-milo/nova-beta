package com.novacrm.auth;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.util.Set;

@Entity
@Table(name = "usuario")
public class Usuario extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String nombre;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "usuario_rol", joinColumns = @JoinColumn(name = "usuario_id"))
    @Column(name = "rol")
    @Enumerated(EnumType.STRING)
    private Set<Rol> roles;

    @Column(nullable = false)
    private boolean activo = true;

    @Column(name = "reset_token")
    private String resetToken;

    @Column(name = "reset_token_expira")
    private java.time.LocalDateTime resetTokenExpira;

    /**
     * Desde cuándo valen las credenciales de esta cuenta.
     *
     * <p>Los tokens emitidos antes de esta marca dejan de poder renovarse. Sin
     * ella, cambiar la contraseña no echaba a nadie: quien ya tuviera una sesión
     * abierta —que es justo el motivo por el que uno cambia la contraseña—
     * seguía renovándola durante los siete días que dura el refresh.
     *
     * <p>Nula mientras nadie haya cambiado la suya: no hay nada que invalidar.
     */
    @Column(name = "credenciales_desde")
    private java.time.LocalDateTime credencialesDesde;

    /**
     * Cambia la contraseña y corta las sesiones anteriores.
     *
     * <p>La marca se trunca al segundo porque el {@code iat} de un JWT va en
     * segundos enteros: sin truncarla, un token emitido en el mismo segundo del
     * cambio parece anterior a la marca y se rechazaría sin motivo.
     */
    public void cambiarPassword(String passwordCodificada) {
        this.password = passwordCodificada;
        this.credencialesDesde = java.time.LocalDateTime.now()
                .truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
    }

    public java.time.LocalDateTime getCredencialesDesde() { return credencialesDesde; }
    public void setCredencialesDesde(java.time.LocalDateTime credencialesDesde) {
        this.credencialesDesde = credencialesDesde;
    }

    public String getResetToken() { return resetToken; }
    public void setResetToken(String resetToken) { this.resetToken = resetToken; }
    public java.time.LocalDateTime getResetTokenExpira() { return resetTokenExpira; }
    public void setResetTokenExpira(java.time.LocalDateTime resetTokenExpira) { this.resetTokenExpira = resetTokenExpira; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public Set<Rol> getRoles() { return roles; }
    public void setRoles(Set<Rol> roles) { this.roles = roles; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
}
