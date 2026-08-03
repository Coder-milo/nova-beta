package com.novacrm.programa;

import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "programa")
public class Programa extends BaseEntity {

    @Column(nullable = false)
    private String nombre;

    @Column(columnDefinition = "TEXT")
    private String descripcion;

    @Column(name = "duracion_dias")
    private Integer duracionDias;

    @Column(name = "fecha_inicio")
    private java.time.LocalDate fechaInicio;

    @Column(name = "fecha_fin")
    private java.time.LocalDate fechaFin;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProgramaEstado estado = ProgramaEstado.BORRADOR;

    @Column(name = "config_matching", columnDefinition = "JSONB")
    @JdbcTypeCode(SqlTypes.JSON)
    private String configMatching;

    @Column(name = "logo_url")
    private String logoUrl;

    private String cliente;

    private String responsable;

    @Column(columnDefinition = "TEXT")
    private String observaciones;

    @Column(name = "porcentaje_avance", nullable = false)
    private int porcentajeAvance = 0;

    @Column(nullable = false)
    private boolean activo = true;

    @Column(name = "fecha_finalizacion")
    private java.time.LocalDateTime fechaFinalizacion;

    @Column(name = "fecha_archivado")
    private java.time.LocalDateTime fechaArchivado;

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public Integer getDuracionDias() { return duracionDias; }
    public void setDuracionDias(Integer duracionDias) { this.duracionDias = duracionDias; }
    public java.time.LocalDate getFechaInicio() { return fechaInicio; }
    public void setFechaInicio(java.time.LocalDate fechaInicio) { this.fechaInicio = fechaInicio; }
    public java.time.LocalDate getFechaFin() { return fechaFin; }
    public void setFechaFin(java.time.LocalDate fechaFin) { this.fechaFin = fechaFin; }
    public ProgramaEstado getEstado() { return estado; }
    public void setEstado(ProgramaEstado estado) { this.estado = estado; }
    public String getConfigMatching() { return configMatching; }
    public void setConfigMatching(String configMatching) { this.configMatching = configMatching; }
    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
    public String getCliente() { return cliente; }
    public void setCliente(String cliente) { this.cliente = cliente; }
    public String getResponsable() { return responsable; }
    public void setResponsable(String responsable) { this.responsable = responsable; }
    public String getObservaciones() { return observaciones; }
    public void setObservaciones(String observaciones) { this.observaciones = observaciones; }
    public int getPorcentajeAvance() { return porcentajeAvance; }
    public void setPorcentajeAvance(int porcentajeAvance) { this.porcentajeAvance = porcentajeAvance; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
    public java.time.LocalDateTime getFechaFinalizacion() { return fechaFinalizacion; }
    public void setFechaFinalizacion(java.time.LocalDateTime fechaFinalizacion) { this.fechaFinalizacion = fechaFinalizacion; }
    public java.time.LocalDateTime getFechaArchivado() { return fechaArchivado; }
    public void setFechaArchivado(java.time.LocalDateTime fechaArchivado) { this.fechaArchivado = fechaArchivado; }
}
