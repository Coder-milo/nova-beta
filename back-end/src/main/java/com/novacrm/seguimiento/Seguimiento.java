package com.novacrm.seguimiento;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(name = "seguimiento")
public class Seguimiento extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "estudiante_id", nullable = false)
    private Estudiante estudiante;

    @Column(nullable = false)
    private LocalDate fecha;

    @Column(nullable = false)
    private String tipo;

    private String responsable;

    @Column(columnDefinition = "TEXT")
    private String observacion;

    @Column(name = "proxima_accion", columnDefinition = "TEXT")
    private String proximaAccion;

    @Column(name = "fecha_proxima")
    private LocalDate fechaProxima;

    @Column(nullable = false)
    private String estado = "PENDIENTE";

    public Estudiante getEstudiante() { return estudiante; }
    public void setEstudiante(Estudiante estudiante) { this.estudiante = estudiante; }
    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public String getResponsable() { return responsable; }
    public void setResponsable(String responsable) { this.responsable = responsable; }
    public String getObservacion() { return observacion; }
    public void setObservacion(String observacion) { this.observacion = observacion; }
    public String getProximaAccion() { return proximaAccion; }
    public void setProximaAccion(String proximaAccion) { this.proximaAccion = proximaAccion; }
    public LocalDate getFechaProxima() { return fechaProxima; }
    public void setFechaProxima(LocalDate fechaProxima) { this.fechaProxima = fechaProxima; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
}
