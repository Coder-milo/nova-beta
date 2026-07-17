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
}
