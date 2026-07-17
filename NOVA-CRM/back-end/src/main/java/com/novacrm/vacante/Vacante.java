package com.novacrm.vacante;

import com.novacrm.empresa.Empresa;
import com.novacrm.shared.BaseEntity;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "vacante", indexes = {
    @Index(name = "idx_vacante_activo_fecha", columnList = "activo, created_at")
})
public class Vacante extends BaseEntity {

    @Column(nullable = false)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String descripcion;

    @Column(columnDefinition = "TEXT")
    private String requisitos;

    private String ubicacion;

    @Column(name = "rango_salarial")
    private String rangoSalarial;

    @Column(name = "tipo_contrato")
    private String tipoContrato;

    @Column(name = "modalidad_trabajo")
    private String modalidadTrabajo;

    @Column(name = "nivel_ingles_requerido")
    private String nivelInglesRequerido;

    @Column(name = "anios_experiencia_requeridos")
    private Integer aniosExperienciaRequeridos;

    @Column(nullable = false)
    private boolean activo = true;

    @Column(name = "fuente")
    private String fuente;

    @Column(name = "url_origen")
    private String urlOrigen;

    @Column(name = "url_aplicar")
    private String urlAplicar;

    @Column(name = "fecha_publicacion")
    private LocalDateTime fechaPublicacion;

    @Column(name = "fecha_expiracion")
    private LocalDateTime fechaExpiracion;

    @Column(name = "hash_dedup")
    private String hashDedup;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "empresa_id")
    private Empresa empresa;

    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public String getRequisitos() { return requisitos; }
    public void setRequisitos(String requisitos) { this.requisitos = requisitos; }
    public String getUbicacion() { return ubicacion; }
    public void setUbicacion(String ubicacion) { this.ubicacion = ubicacion; }
    public String getRangoSalarial() { return rangoSalarial; }
    public void setRangoSalarial(String rangoSalarial) { this.rangoSalarial = rangoSalarial; }
    public String getTipoContrato() { return tipoContrato; }
    public void setTipoContrato(String tipoContrato) { this.tipoContrato = tipoContrato; }
    public String getModalidadTrabajo() { return modalidadTrabajo; }
    public void setModalidadTrabajo(String modalidadTrabajo) { this.modalidadTrabajo = modalidadTrabajo; }
    public String getNivelInglesRequerido() { return nivelInglesRequerido; }
    public void setNivelInglesRequerido(String nivelInglesRequerido) { this.nivelInglesRequerido = nivelInglesRequerido; }
    public Integer getAniosExperienciaRequeridos() { return aniosExperienciaRequeridos; }
    public void setAniosExperienciaRequeridos(Integer aniosExperienciaRequeridos) { this.aniosExperienciaRequeridos = aniosExperienciaRequeridos; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
    public String getFuente() { return fuente; }
    public void setFuente(String fuente) { this.fuente = fuente; }
    public String getUrlOrigen() { return urlOrigen; }
    public void setUrlOrigen(String urlOrigen) { this.urlOrigen = urlOrigen; }
    public String getUrlAplicar() { return urlAplicar; }
    public void setUrlAplicar(String urlAplicar) { this.urlAplicar = urlAplicar; }
    public LocalDateTime getFechaPublicacion() { return fechaPublicacion; }
    public void setFechaPublicacion(LocalDateTime fechaPublicacion) { this.fechaPublicacion = fechaPublicacion; }
    public LocalDateTime getFechaExpiracion() { return fechaExpiracion; }
    public void setFechaExpiracion(LocalDateTime fechaExpiracion) { this.fechaExpiracion = fechaExpiracion; }
    public String getHashDedup() { return hashDedup; }
    public void setHashDedup(String hashDedup) { this.hashDedup = hashDedup; }
    public Empresa getEmpresa() { return empresa; }
    public void setEmpresa(Empresa empresa) { this.empresa = empresa; }
}
