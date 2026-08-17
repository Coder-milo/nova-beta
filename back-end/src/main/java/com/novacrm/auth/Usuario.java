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

    /**
     * A que empresa pertenece, si es una cuenta del portal de empresas.
     *
     * <p>Nula para todo el personal del programa y para los estudiantes. Es la
     * unica llave por la que una cuenta con rol {@link Rol#EMPRESA} alcanza
     * datos: cada consulta del portal filtra por ella. Una cuenta EMPRESA sin
     * empresa asignada no ve absolutamente nada, y eso es deliberado —el fallo
     * por defecto tiene que ser no mostrar, no mostrarlo todo—.
     *
     * <p>Es {@code LAZY} porque la carga el filtro de seguridad en cada
     * peticion y la inmensa mayoria de las cuentas no son de empresa.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "empresa_id")
    private com.novacrm.empresa.Empresa empresa;

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
    /**
     * Siempre en minúsculas y sin espacios sobrantes.
     *
     * <p>La búsqueda ya no distingue mayúsculas y el índice único va sobre
     * {@code lower(email)}, así que guardarlo con otra caja solo sirve para que
     * la misma cuenta se lea distinta según la pantalla. Se normaliza aquí, en
     * el único sitio por el que pasan todos los caminos que lo escriben.
     *
     * <p>{@code Locale.ROOT} y no el del sistema: en turco, {@code "I"} en
     * minúscula no es {@code "i"}, y un servidor con esa configuración
     * regional dejaría fuera a quien tuviera una I en el correo.
     */
    public void setEmail(String email) {
        this.email = email == null ? null : email.trim().toLowerCase(java.util.Locale.ROOT);
    }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public Set<Rol> getRoles() { return roles; }
    public void setRoles(Set<Rol> roles) { this.roles = roles; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
    public com.novacrm.empresa.Empresa getEmpresa() { return empresa; }
    public void setEmpresa(com.novacrm.empresa.Empresa empresa) { this.empresa = empresa; }

    /** Cuenta del portal de empresas con una empresa detras. */
    public boolean esCuentaDeEmpresa() {
        return roles != null && roles.contains(Rol.EMPRESA) && empresa != null;
    }
}
