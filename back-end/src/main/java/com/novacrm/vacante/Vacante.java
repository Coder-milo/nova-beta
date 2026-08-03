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

    /**
     * Tiempo completo, medio tiempo, por horas.
     *
     * <p>Distinto de {@link #tipoContrato} —indefinido, termino fijo, obra o
     * labor—, que es la figura juridica. Se metian en el mismo campo y luego no
     * se podia filtrar "solo tiempo completo", que es lo primero que pregunta
     * quien necesita el ingreso completo.
     */
    @Column(length = 40)
    private String jornada;

    /**
     * Ciudad de la plaza.
     *
     * <p>Aparte de {@link #ubicacion}, que es texto libre del anuncio
     * ("Barranquilla, Atlantico - Zona norte"). Sin una ciudad limpia no se
     * puede filtrar por lo unico que decide si la persona puede tomar el
     * empleo.
     */
    @Column(length = 255)
    private String ciudad;

    /**
     * Validada por el equipo.
     *
     * <p>Falso solo en las que registra un estudiante. La oferta se guarda y se
     * ve, pero no entra al matching hasta que alguien la mira: recomendarle a
     * los otros 106 participantes una oferta sin revisar es exactamente el
     * camino por el que una estafa de empleo llega a toda una cohorte.
     */
    @Column(nullable = false)
    private boolean revisada = true;

    /**
     * A quien le sirve esta oferta.
     *
     * <p>Nulo en las que registra el equipo a mano y en las anteriores a que
     * existiera el campo: no hay con que deducirlo, y suponerlo mandaria
     * ofertas del exterior a quien no las busca. Una vacante sin segmento se
     * considera apta para todos, como hasta ahora.
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private com.novacrm.scraper.fuente.Segmento segmento;

    @Enumerated(EnumType.STRING)
    @Column(name = "motivo_cierre", length = 30)
    private MotivoCierre motivoCierre;

    @Column(name = "fecha_cierre")
    private LocalDateTime fechaCierre;

    /** Correo de quien la registro a mano; nulo si vino de un portal. */
    @Column(name = "creada_por")
    private String creadaPor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "empresa_id")
    private Empresa empresa;

    /**
     * Cierra la vacante dejando constancia del porque.
     *
     * <p>Se hace aqui y no desde fuera para que no pueda quedar una vacante
     * inactiva sin motivo, que es lo que impide saber despues si la plaza se
     * cubrio o simplemente vencio.
     */
    public void cerrar(MotivoCierre motivo, LocalDateTime cuando) {
        this.activo = false;
        this.motivoCierre = motivo;
        this.fechaCierre = cuando;
    }

    /** Vigente: sigue abierta y no ha pasado su fecha de expiracion. */
    public boolean estaVigente(LocalDateTime ahora) {
        return activo && (fechaExpiracion == null || fechaExpiracion.isAfter(ahora));
    }

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
    public MotivoCierre getMotivoCierre() { return motivoCierre; }
    public void setMotivoCierre(MotivoCierre motivoCierre) { this.motivoCierre = motivoCierre; }
    public java.time.LocalDateTime getFechaCierre() { return fechaCierre; }
    public void setFechaCierre(java.time.LocalDateTime fechaCierre) { this.fechaCierre = fechaCierre; }
    public String getCreadaPor() { return creadaPor; }
    public void setCreadaPor(String creadaPor) { this.creadaPor = creadaPor; }
    public String getJornada() { return jornada; }
    public void setJornada(String jornada) { this.jornada = jornada; }
    public String getCiudad() { return ciudad; }
    public void setCiudad(String ciudad) { this.ciudad = ciudad; }
    public boolean isRevisada() { return revisada; }
    public void setRevisada(boolean revisada) { this.revisada = revisada; }
    public com.novacrm.scraper.fuente.Segmento getSegmento() { return segmento; }
    public void setSegmento(com.novacrm.scraper.fuente.Segmento segmento) { this.segmento = segmento; }
}
