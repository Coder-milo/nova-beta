package com.novacrm.matching;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.shared.BaseEntity;
import com.novacrm.vacante.Vacante;
import jakarta.persistence.*;

import java.math.BigDecimal;

@Entity
@Table(name = "match_resultado", indexes = {
    @Index(name = "idx_match_estudiante_notificado", columnList = "estudiante_id, notificado")
})
public class Match extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "estudiante_id", nullable = false)
    private Estudiante estudiante;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vacante_id", nullable = false)
    private Vacante vacante;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal puntaje;

    @Column(nullable = false)
    private boolean notificado = false;

    private boolean postulado = false;

    /**
     * Desglose del puntaje, criterio por criterio, de 0 a 1; {@code null}
     * cuando ese criterio no se pudo evaluar.
     *
     * <p>Antes solo sobrevivia el escalar final, asi que no habia forma de
     * explicarle a nadie por que se recomendo una vacante ni de comparar un
     * 62.00 de marzo con uno de julio si entretanto habian cambiado los pesos.
     * Se guarda el ratio y no los puntos porque el ratio no depende del peso
     * configurado y sigue siendo legible despues de reajustarlo.
     */
    @Column(name = "puntaje_afinidad", precision = 5, scale = 4)
    private BigDecimal puntajeAfinidad;

    @Column(name = "puntaje_habilidades", precision = 5, scale = 4)
    private BigDecimal puntajeHabilidades;

    @Column(name = "puntaje_ingles", precision = 5, scale = 4)
    private BigDecimal puntajeIngles;

    @Column(name = "puntaje_ubicacion", precision = 5, scale = 4)
    private BigDecimal puntajeUbicacion;

    @Column(name = "puntaje_experiencia", precision = 5, scale = 4)
    private BigDecimal puntajeExperiencia;

    /** Fraccion del peso total que tenia datos reales cuando se puntuo. */
    @Column(precision = 5, scale = 4)
    private BigDecimal cobertura;

    /**
     * Pesos y umbral con los que se calculo, para que el puntaje siga siendo
     * interpretable despues de tocar {@code matching-config.yml}.
     */
    @Column(name = "config_version", length = 80)
    private String configVersion;

    /**
     * Descartado por el estudiante o por el equipo.
     *
     * <p>Antes descartar borraba la fila. El boton "No, gracias" de la
     * plantilla de WhatsApp es la etiqueta negativa mas limpia que recibe el
     * sistema —la persona miro la vacante y dijo que no— y se destruia al
     * llegar, justo el dato que hace falta para saber si un puntaje alto
     * predice algo. Ahora se marca y se conserva.
     */
    @Column(nullable = false)
    private boolean descartado = false;

    @Column(name = "descartado_en")
    private java.time.Instant descartadoEn;

    /** Quien lo descarto: "WhatsApp" si fue el estudiante, si no el usuario. */
    @Column(name = "descartado_por", length = 120)
    private String descartadoPor;

    /** Marca el descarte conservando la fila y con ella la etiqueta negativa. */
    public void descartar(String autor) {
        this.descartado = true;
        this.descartadoEn = java.time.Instant.now();
        this.descartadoPor = autor;
    }

    /** Vuelca un desglose recien calculado sobre la entidad. */
    public void aplicarDesglose(DesglosePuntaje desglose, String configVersion) {
        this.puntaje = desglose.puntaje();
        this.puntajeAfinidad = aDecimal(desglose.afinidad());
        this.puntajeHabilidades = aDecimal(desglose.habilidades());
        this.puntajeIngles = aDecimal(desglose.ingles());
        this.puntajeUbicacion = aDecimal(desglose.ubicacion());
        this.puntajeExperiencia = aDecimal(desglose.experiencia());
        this.cobertura = desglose.cobertura();
        this.configVersion = configVersion;
    }

    private static BigDecimal aDecimal(Double ratio) {
        return ratio == null ? null
                : BigDecimal.valueOf(ratio).setScale(4, java.math.RoundingMode.HALF_UP);
    }

    public Estudiante getEstudiante() { return estudiante; }
    public void setEstudiante(Estudiante estudiante) { this.estudiante = estudiante; }
    public Vacante getVacante() { return vacante; }
    public void setVacante(Vacante vacante) { this.vacante = vacante; }
    public BigDecimal getPuntaje() { return puntaje; }
    public void setPuntaje(BigDecimal puntaje) { this.puntaje = puntaje; }
    public boolean isNotificado() { return notificado; }
    public void setNotificado(boolean notificado) { this.notificado = notificado; }
    public boolean isPostulado() { return postulado; }
    public void setPostulado(boolean postulado) { this.postulado = postulado; }
    public BigDecimal getPuntajeAfinidad() { return puntajeAfinidad; }
    public BigDecimal getPuntajeHabilidades() { return puntajeHabilidades; }
    public BigDecimal getPuntajeIngles() { return puntajeIngles; }
    public BigDecimal getPuntajeUbicacion() { return puntajeUbicacion; }
    public BigDecimal getPuntajeExperiencia() { return puntajeExperiencia; }
    public BigDecimal getCobertura() { return cobertura; }
    public String getConfigVersion() { return configVersion; }
    public boolean isDescartado() { return descartado; }
    public java.time.Instant getDescartadoEn() { return descartadoEn; }
    public String getDescartadoPor() { return descartadoPor; }
}
