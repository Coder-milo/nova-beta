package com.novacrm.notificacion;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "notificacion", indexes = {
    @Index(name = "idx_notificacion_estudiante_leida", columnList = "estudiante_id, leida")
})
public class Notificacion extends BaseEntity {

    @Column(nullable = false)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String mensaje;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "estudiante_id", nullable = false)
    private Estudiante estudiante;

    @Column(name = "tipo")
    private String tipo;

    @Column(name = "referencia_id")
    private String referenciaId;

    @Column(nullable = false)
    private boolean leida = false;

    @Column(name = "fecha_envio_email")
    private LocalDateTime fechaEnvioEmail;

    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getMensaje() { return mensaje; }
    public void setMensaje(String mensaje) { this.mensaje = mensaje; }
    public Estudiante getEstudiante() { return estudiante; }
    public void setEstudiante(Estudiante estudiante) { this.estudiante = estudiante; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public String getReferenciaId() { return referenciaId; }
    public void setReferenciaId(String referenciaId) { this.referenciaId = referenciaId; }
    public boolean isLeida() { return leida; }
    public void setLeida(boolean leida) { this.leida = leida; }
    public LocalDateTime getFechaEnvioEmail() { return fechaEnvioEmail; }
    public void setFechaEnvioEmail(LocalDateTime fechaEnvioEmail) { this.fechaEnvioEmail = fechaEnvioEmail; }
}
